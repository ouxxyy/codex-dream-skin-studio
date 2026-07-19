import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const WEEK_MINUTES = 10080;
const DEFAULT_STALE_AFTER_MS = 15000;
const RATE_DISCOVERY_ROWS = 50;
const CACHE_RECENT_ROWS = 24;
const READ_CHUNK_BYTES = 1024 * 1024;

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const eventTimeMs = (event) => {
  const value = Date.parse(event?.timestamp || "");
  return Number.isFinite(value) ? value : null;
};
const epochMs = (value) => {
  const number = finite(value);
  if (number == null) return null;
  return number < 10_000_000_000 ? number * 1000 : number;
};

export function parseJsonlChunk(chunk, carry = "") {
  const combined = `${carry}${chunk}`;
  const lines = combined.split("\n");
  const nextCarry = lines.pop() ?? "";
  const events = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
  return { events, carry: nextCarry };
}

function createRolloutState() {
  return {
    turns: new Map(),
    activeTurnId: null,
    latestRate: null,
    latestThreadTokens: null,
  };
}

function applyRolloutEvent(state, event) {
  const turns = state.turns;
  const activeTurnId = state.activeTurnId;
  if (event?.type !== "event_msg") return;
  const payload = event.payload || {};
  const timestampMs = eventTimeMs(event);
  if (payload.type === "task_started") {
    const id = String(payload.turn_id || `turn:${turns.size}`);
    const startedAt = epochMs(payload.started_at) ?? timestampMs;
    turns.set(id, {
      id,
      startedAt,
      endedAt: null,
      aborted: false,
      lastTokens: 0,
      tokenAt: null,
      tokenSamples: [],
    });
    state.activeTurnId = id;
    return;
  }
  if (payload.type === "task_complete" || payload.type === "turn_aborted") {
    const id = String(payload.turn_id || activeTurnId || "");
    const turn = turns.get(id);
    if (turn) {
      turn.endedAt = epochMs(payload.completed_at) ?? epochMs(payload.aborted_at) ?? timestampMs;
      turn.aborted = payload.type === "turn_aborted";
    }
    if (activeTurnId === id) state.activeTurnId = null;
    return;
  }
  if (payload.type !== "token_count") return;
  const total = finite(payload.info?.total_token_usage?.total_tokens);
  if (total != null) state.latestThreadTokens = total;
  const last = finite(payload.info?.last_token_usage?.total_tokens);
  const turn = activeTurnId ? turns.get(activeTurnId) : null;
  if (turn && last != null) {
    const tokens = Math.max(0, last);
    turn.lastTokens += tokens;
    turn.tokenAt = timestampMs;
    turn.tokenSamples.push({ at: timestampMs, tokens });
  }
  const primary = payload.rate_limits?.primary;
  if (primary && finite(primary.used_percent) != null && finite(primary.resets_at) != null) {
    state.latestRate = {
      usedPercent: Math.min(100, Math.max(0, finite(primary.used_percent))),
      windowMinutes: finite(primary.window_minutes) ?? WEEK_MINUTES,
      resetsAt: epochMs(primary.resets_at),
      observedAt: timestampMs,
    };
  }
}

function rolloutStateToSummary(state, nowMs = Date.now()) {
  const normalizedTurns = [...state.turns.values()].map((turn) => ({
    ...turn,
    endedAt: turn.endedAt ?? (turn.id === state.activeTurnId ? nowMs : turn.startedAt),
    active: turn.id === state.activeTurnId,
  }));
  return {
    turns: normalizedTurns,
    latestRate: state.latestRate,
    latestThreadTokens: state.latestThreadTokens,
  };
}

export function summarizeRolloutEvents(events, nowMs = Date.now()) {
  const state = createRolloutState();
  for (const event of events) applyRolloutEvent(state, event);
  return rolloutStateToSummary(state, nowMs);
}

export function clippedRuntimeMs(turns, startsAt, resetsAt, nowMs = Date.now()) {
  return turns.reduce((total, turn) => {
    const start = Math.max(turn.startedAt ?? nowMs, startsAt ?? -Infinity);
    const rawEnd = turn.active ? nowMs : (turn.endedAt ?? start);
    const end = Math.min(rawEnd, resetsAt ?? Infinity, nowMs);
    return total + Math.max(0, end - start);
  }, 0);
}

export function sumWindowTokens(turns, startsAt, resetsAt) {
  return turns.reduce((total, turn) => {
    if (Array.isArray(turn.tokenSamples)) {
      return total + turn.tokenSamples.reduce((sampleTotal, sample) => {
        const at = sample.at;
        return at != null && (startsAt == null || at >= startsAt) && (resetsAt == null || at <= resetsAt)
          ? sampleTotal + Math.max(0, finite(sample.tokens) ?? 0)
          : sampleTotal;
      }, 0);
    }
    const at = turn.tokenAt;
    return at != null && (startsAt == null || at >= startsAt) && (resetsAt == null || at <= resetsAt)
      ? total + Math.max(0, finite(turn.lastTokens) ?? 0)
      : total;
  }, 0);
}

function normalizeThreadId(value) {
  const id = String(value || "").trim().replace(/^local:/, "");
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) ? id : null;
}

function normalizedTitle(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export class MetricsAggregator {
  constructor({
    dbPath = path.join(os.homedir(), ".codex", "state_5.sqlite"),
    now = () => Date.now(),
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
  } = {}) {
    this.dbPath = dbPath;
    this.now = now;
    this.staleAfterMs = staleAfterMs;
    this.fileCache = new Map();
    this.lastGood = null;
    this.lastRate = null;
    this.db = null;
  }

  open() {
    if (!this.db) this.db = new DatabaseSync(this.dbPath, { readOnly: true });
    return this.db;
  }

  close() {
    try { this.db?.close(); } catch {}
    this.db = null;
  }

  async readRollout(filePath, nowMs = this.now()) {
    let cache = this.fileCache.get(filePath);
    if (!cache) cache = { offset: 0, carry: "", summary: createRolloutState(), size: 0, mtimeMs: 0 };
    const stat = await fs.stat(filePath);
    if (stat.size < cache.offset || stat.mtimeMs < cache.mtimeMs) {
      cache = { offset: 0, carry: "", summary: createRolloutState(), size: 0, mtimeMs: 0 };
    }
    if (stat.size > cache.offset) {
      const handle = await fs.open(filePath, "r");
      try {
        while (cache.offset < stat.size) {
          const length = Math.min(READ_CHUNK_BYTES, stat.size - cache.offset);
          const buffer = Buffer.allocUnsafe(length);
          const { bytesRead } = await handle.read(buffer, 0, length, cache.offset);
          if (bytesRead <= 0) break;
          const parsed = parseJsonlChunk(buffer.subarray(0, bytesRead).toString("utf8"), cache.carry);
          for (const event of parsed.events) applyRolloutEvent(cache.summary, event);
          cache.carry = parsed.carry;
          cache.offset += bytesRead;
        }
      } finally {
        await handle.close();
      }
    }
    cache.size = stat.size;
    cache.mtimeMs = stat.mtimeMs;
    this.fileCache.set(filePath, cache);
    return rolloutStateToSummary(cache.summary, nowMs);
  }

  listThreads() {
    return this.open().prepare(`
      SELECT id, title, rollout_path AS rolloutPath,
        COALESCE(updated_at_ms, updated_at * 1000) AS updatedAt
      FROM threads
      WHERE rollout_path <> ''
      ORDER BY COALESCE(updated_at_ms, updated_at * 1000) DESC
    `).all();
  }

  childMap() {
    const rows = this.open().prepare(
      "SELECT parent_thread_id AS parentId, child_thread_id AS childId FROM thread_spawn_edges",
    ).all();
    const map = new Map();
    for (const row of rows) {
      const list = map.get(row.parentId) ?? [];
      list.push(row.childId);
      map.set(row.parentId, list);
    }
    return map;
  }

  resolveThread(rows, active = {}) {
    const exact = normalizeThreadId(active.threadId);
    if (exact) return rows.some((row) => row.id === exact) ? exact : null;
    const title = normalizedTitle(active.title);
    const placeholderTitle = /^(?:new chat|new task|新聊天|新对话|新任务)$/.test(title);
    if (title && !placeholderTitle) {
      const matched = rows.find((row) => {
        const candidate = normalizedTitle(row.title);
        return candidate === title || candidate.startsWith(title) || title.startsWith(candidate.slice(0, 48));
      });
      if (matched) return matched.id;
    }
    return null;
  }

  collectTree(rootId, map) {
    if (!rootId) return new Set();
    const result = new Set([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift();
      for (const child of map.get(id) ?? []) {
        if (result.has(child)) continue;
        result.add(child);
        queue.push(child);
      }
    }
    return result;
  }

  evictFileCache(keepPaths) {
    const keep = new Set(keepPaths);
    for (const key of this.fileCache.keys()) {
      if (!keep.has(key)) this.fileCache.delete(key);
    }
  }

  staleFallback(error) {
    const now = this.now();
    if (!this.lastGood) return {
      week: { runtimeMs: null, totalTokens: null, remainingPercent: null },
      window: { startsAt: null, resetsAt: null },
      task: { id: null, runtimeMs: null, totalTokens: null },
      updatedAt: now,
      stale: true,
      error: String(error?.message || error || "metrics unavailable").slice(0, 160),
    };
    return {
      ...this.lastGood,
      stale: now - this.lastGood.updatedAt > this.staleAfterMs,
    };
  }

  async snapshot(active = {}) {
    const now = this.now();
    try {
      const rows = this.listThreads();
      const rootId = this.resolveThread(rows, active);
      const tree = this.collectTree(rootId, this.childMap());
      const rowById = new Map(rows.map((row) => [row.id, row]));
      const recordsByPath = new Map();
      const readRecord = async (row) => {
        if (!row?.rolloutPath) return null;
        if (recordsByPath.has(row.rolloutPath)) return recordsByPath.get(row.rolloutPath);
        let record = null;
        try {
          record = { row, summary: await this.readRollout(row.rolloutPath, now) };
        } catch {}
        recordsByPath.set(row.rolloutPath, record);
        return record;
      };

      const cachedRates = [...this.fileCache.values()]
        .map((cache) => cache.summary?.latestRate)
        .filter(Boolean);
      const rates = [...cachedRates];
      for (const row of rows.slice(0, RATE_DISCOVERY_ROWS)) {
        const record = await readRecord(row);
        if (record?.summary.latestRate) rates.push(record.summary.latestRate);
      }
      if (!rates.length) {
        for (const row of rows) {
          const record = await readRecord(row);
          if (record?.summary.latestRate) {
            rates.push(record.summary.latestRate);
            break;
          }
        }
      }
      const rate = rates
        .sort((a, b) => (b.observedAt ?? 0) - (a.observedAt ?? 0));
      this.lastRate = rate[0] ?? this.lastRate;
      const activeRate = this.lastRate ?? null;
      const resetsAt = activeRate?.resetsAt ?? null;
      const startsAt = resetsAt == null ? null : resetsAt - (activeRate.windowMinutes || WEEK_MINUTES) * 60000;
      const selectedRows = new Map();
      for (const row of rows.slice(0, CACHE_RECENT_ROWS)) selectedRows.set(row.id, row);
      for (const row of rows) {
        if (startsAt == null || row.updatedAt >= startsAt) selectedRows.set(row.id, row);
      }
      for (const id of tree) {
        const row = rowById.get(id);
        if (row) selectedRows.set(row.id, row);
      }
      for (const row of selectedRows.values()) await readRecord(row);
      const records = [...recordsByPath.values()].filter(Boolean);
      const windowRecords = records.filter(({ row }) => startsAt == null || row.updatedAt >= startsAt);
      const weekTurns = windowRecords.flatMap((record) => record.summary.turns);
      const taskRecords = records.filter(({ row }) => tree.has(row.id));
      this.evictFileCache([...selectedRows.values()].map((row) => row.rolloutPath));
      const snapshot = {
        week: {
          runtimeMs: clippedRuntimeMs(weekTurns, startsAt, resetsAt, now),
          totalTokens: sumWindowTokens(weekTurns, startsAt, resetsAt),
          remainingPercent: activeRate ? Math.max(0, 100 - activeRate.usedPercent) : null,
        },
        window: { startsAt, resetsAt },
        task: {
          id: rootId,
          runtimeMs: clippedRuntimeMs(taskRecords.flatMap((record) => record.summary.turns), null, null, now),
          totalTokens: taskRecords.reduce(
            (sum, record) => sum + Math.max(0, finite(record.summary.latestThreadTokens) ?? 0), 0,
          ),
        },
        updatedAt: now,
        stale: false,
      };
      this.lastGood = snapshot;
      return snapshot;
    } catch (error) {
      return this.staleFallback(error);
    }
  }
}
