import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  MetricsAggregator,
  clippedRuntimeMs,
  parseJsonlChunk,
  summarizeRolloutEvents,
  sumWindowTokens,
} from "../scripts/metrics-aggregator.mjs";

const base = Date.parse("2026-07-18T10:00:00.000Z");
const event = (timestampMs, payload) => ({
  timestamp: new Date(timestampMs).toISOString(),
  type: "event_msg",
  payload,
});

const half = parseJsonlChunk('{"type":"event_msg"', "");
assert.deepEqual(half.events, []);
const completedHalf = parseJsonlChunk(',"payload":{"type":"task_started"}}\n', half.carry);
assert.equal(completedHalf.events.length, 1, "A half-written JSONL record must wait for its newline.");

const fixtureEvents = [
  event(base - 5000, { type: "task_started", turn_id: "done", started_at: (base - 5000) / 1000 }),
  event(base - 4000, {
    type: "token_count",
    info: {
      total_token_usage: { input_tokens: 100, cached_input_tokens: 80, total_tokens: 1000 },
      last_token_usage: { input_tokens: 100, cached_input_tokens: 80, total_tokens: 100 },
    },
    rate_limits: { primary: { used_percent: 25, window_minutes: 10080, resets_at: (base + 5000) / 1000 } },
  }),
  event(base - 3500, {
    type: "token_count",
    info: {
      total_token_usage: { input_tokens: 150, cached_input_tokens: 120, total_tokens: 1050 },
      last_token_usage: { input_tokens: 50, cached_input_tokens: 40, total_tokens: 50 },
    },
  }),
  event(base - 3000, { type: "task_complete", turn_id: "done", completed_at: (base - 3000) / 1000 }),
  event(base - 2000, { type: "task_started", turn_id: "active", started_at: (base - 2000) / 1000 }),
  event(base - 1000, {
    type: "token_count",
    info: {
      total_token_usage: { input_tokens: 200, cached_input_tokens: 160, total_tokens: 1350 },
      last_token_usage: { input_tokens: 200, cached_input_tokens: 160, total_tokens: 200 },
    },
  }),
];

const summary = summarizeRolloutEvents(fixtureEvents, base);
assert.equal(summary.latestThreadTokens, 1350, "Task tokens use native total_tokens, including cached input.");
assert.equal(clippedRuntimeMs(summary.turns, base - 4500, base + 5000, base), 3500);
assert.equal(sumWindowTokens(summary.turns, base - 4500, base + 5000), 350,
  "Weekly tokens include every incremental token_count sample within a turn.");

const aborted = summarizeRolloutEvents([
  event(base - 3000, { type: "task_started", turn_id: "aborted", started_at: (base - 3000) / 1000 }),
  event(base - 1000, { type: "turn_aborted", turn_id: "aborted", aborted_at: (base - 1000) / 1000 }),
], base);
assert.equal(clippedRuntimeMs(aborted.turns, null, null, base), 2000, "Aborted turns retain actual runtime.");

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "luce-metrics-"));
const dbPath = path.join(temp, "state.sqlite");
const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE threads (
    id TEXT PRIMARY KEY, title TEXT, rollout_path TEXT, updated_at INTEGER,
    updated_at_ms INTEGER, created_at INTEGER, created_at_ms INTEGER
  );
  CREATE TABLE thread_spawn_edges (
    parent_thread_id TEXT, child_thread_id TEXT PRIMARY KEY, status TEXT
  );
`);

const rootPath = path.join(temp, "root.jsonl");
const childPath = path.join(temp, "child.jsonl");
const orphanPath = path.join(temp, "orphan.jsonl");
const oldHugePath = path.join(temp, "old-huge.jsonl");
await fs.writeFile(rootPath, `${fixtureEvents.map(JSON.stringify).join("\n")}\n`);
await fs.writeFile(childPath, `${[
  event(base - 2500, { type: "task_started", turn_id: "child", started_at: (base - 2500) / 1000 }),
  event(base - 2000, { type: "token_count", info: {
    total_token_usage: { total_tokens: 500 }, last_token_usage: { total_tokens: 50 },
  } }),
  event(base - 500, { type: "task_complete", turn_id: "child", completed_at: (base - 500) / 1000 }),
].map(JSON.stringify).join("\n")}\n`);
await fs.writeFile(orphanPath, `${[
  event(base - 3500, { type: "task_started", turn_id: "orphan", started_at: (base - 3500) / 1000 }),
  event(base - 3000, { type: "token_count", info: {
    total_token_usage: { total_tokens: 700 }, last_token_usage: { total_tokens: 70 },
  } }),
  event(base - 1500, { type: "turn_aborted", turn_id: "orphan", aborted_at: (base - 1500) / 1000 }),
].map(JSON.stringify).join("\n")}\n`);
await fs.writeFile(oldHugePath, `${"not-json\n".repeat(80_000)}`);

const insert = db.prepare("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?)");
insert.run("11111111-1111-4111-8111-111111111111", "Root task", rootPath, base / 1000, base, base / 1000, base);
insert.run("22222222-2222-4222-8222-222222222222", "Child task", childPath, base / 1000 - 1, base - 1000, base / 1000, base);
insert.run("33333333-3333-4333-8333-333333333333", "Orphan task", orphanPath, base / 1000 - 2, base - 2000, base / 1000, base);
for (let index = 0; index < 55; index += 1) {
  const fillerPath = path.join(temp, `filler-${index}.jsonl`);
  await fs.writeFile(fillerPath, "");
  insert.run(
    `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`,
    `Filler ${index}`,
    fillerPath,
    Math.floor((base - 10_000 - index) / 1000),
    base - 10_000 - index,
    base / 1000,
    base,
  );
}
insert.run(
  "99999999-9999-4999-8999-999999999999",
  "Old huge task",
  oldHugePath,
  Math.floor((base - 10080 * 60000 - 60_000) / 1000),
  base - 10080 * 60000 - 60_000,
  base / 1000,
  base,
);
db.prepare("INSERT INTO thread_spawn_edges VALUES (?, ?, ?)").run(
  "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "running",
);
db.close();

const aggregator = new MetricsAggregator({ dbPath, now: () => base });
const snapshot = await aggregator.snapshot({ threadId: "local:11111111-1111-4111-8111-111111111111" });
assert.equal(snapshot.stale, false);
assert.equal(snapshot.week.remainingPercent, 75);
assert.equal(snapshot.week.totalTokens, 470, "Weekly tokens sum every native last_token_usage increment in the window.");
assert.equal(snapshot.task.id, "11111111-1111-4111-8111-111111111111");
assert.equal(snapshot.task.runtimeMs, 6000, "Current task runtime includes descendant threads.");
assert.equal(snapshot.task.totalTokens, 1850, "Current task tokens include descendant thread totals.");
assert.equal(aggregator.fileCache.has(oldHugePath), false, "Old rollout files outside the active window must not be opened.");
assert.equal(
  [...aggregator.fileCache.values()].some((cache) => Array.isArray(cache.events)),
  false,
  "Rollout cache must retain compact summaries, not raw event arrays.",
);

const fallback = await aggregator.snapshot({ threadId: "local:client-new-thread:unknown", title: "Root task" });
assert.equal(fallback.task.id, "11111111-1111-4111-8111-111111111111", "Client-new tasks map by active title.");
assert.equal(aggregator.resolveThread(
  [{ id: "44444444-4444-4444-8444-444444444444", title: "New chat" }],
  { threadId: "local:client-new-thread:fresh", title: "New chat" },
), null, "A generic new-task title must not match an older task with the same placeholder title.");
const fresh = await aggregator.snapshot({ threadId: "local:client-new-thread:fresh", title: "New chat" });
assert.equal(fresh.task.id, null, "An unresolved new task must not fall back to the previously active task.");
assert.equal(fresh.task.runtimeMs, 0);
assert.equal(fresh.task.totalTokens, 0);
const noActiveRow = await aggregator.snapshot({});
assert.equal(noActiveRow.task.id, null, "A missing active sidebar row must not reuse the previously active task.");
assert.equal(noActiveRow.task.runtimeMs, 0);
assert.equal(noActiveRow.task.totalTokens, 0);
aggregator.close();
await fs.rm(temp, { recursive: true, force: true });

console.log("PASS: Luce metrics aggregation handles quota windows, active/completed/aborted turns, cached tokens, descendants, half-lines and thread fallback.");
