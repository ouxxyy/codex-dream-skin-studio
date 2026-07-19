import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const macosRoot = path.resolve(here, "..");
const template = await fs.readFile(path.join(macosRoot, "assets", "renderer-inject.js"), "utf8");
const css = await fs.readFile(path.join(macosRoot, "assets", "dream-skin.css"), "utf8");
const geometry = JSON.parse(await fs.readFile(path.join(macosRoot, "assets", "luce-geometry.json"), "utf8"));

assert.doesNotMatch(
  css,
  /main\.main-surface\s*>\s*header\.app-header-tint\s*\{[^}]*\b(?:position|z-index)\s*:/,
  "The skin must preserve Codex's native fixed header so the side-panel toggle remains reachable.",
);
assert.doesNotMatch(
  css,
  /main\.main-surface:not\(\.dream-skin-home-shell\)\s*>\s*\*\s*\{[^}]*\bposition\s*:/,
  "Task-route child layering must not overwrite the native header position.",
);

assert.doesNotMatch(
  css,
  /background-image:\s*var\(--dream-skin-art\),\s*var\(--dream-skin-art\)/,
  "The home hero must not stack duplicate copies of the selected image.",
);
assert.match(
  css,
  /data-dream-art-safe="left"[\s\S]{0,140}--ds-art-position:\s*100% var\(--ds-focus-y\);/,
  "A left text-safe image must preserve its right-side subject on narrower windows.",
);
assert.doesNotMatch(
  css,
  /background-size:\s*auto 100% !important;/,
  "Wide home artwork must not leave an unpainted half-card by fitting only to height.",
);
assert.doesNotMatch(
  css,
  /background-size:\s*100% 100%,\s*100% 100%,\s*100% auto;/,
  "Wide task artwork must cover the full route instead of ending above the composer.",
);
assert.match(
  css,
  /data-dream-art-task-mode="ambient"[\s\S]{0,500}body\s*\{[\s\S]{0,500}background-image:\s*var\(--dream-skin-art\) !important;[\s\S]{0,200}background-size:\s*cover !important;/,
  "Wide ambient task artwork should cover the full application window.",
);
assert.match(
  css,
  /data-dream-task-mode="banner"[\s\S]{0,900}body\s*\{[\s\S]{0,500}background-image:\s*var\(--dream-skin-art\) !important;[\s\S]{0,200}background-size:\s*cover !important;/,
  "Wide banner task artwork should use the same full-window wallpaper contract as ambient routes.",
);
assert.match(
  css,
  /data-dream-art-wide="true"\]:has\(main\.main-surface\.dream-skin-home-shell\)[\s\S]{0,100}body\s*\{[\s\S]{0,300}background-image:\s*var\(--dream-skin-art\) !important;/,
  "Wide home artwork should use the same full-window image as utility routes.",
);
assert.match(
  css,
  /data-dream-art-wide="true"\]:has\(main\.main-surface\.dream-skin-home-shell\)[\s\S]{0,120}body\s*\{[\s\S]{0,260}background-position:\s*var\(--ds-art-position\) !important;/,
  "Wide home artwork must honor the configured focal point instead of forcing a centered crop.",
);
assert.match(
  css,
  /data-dream-art-task-mode="ambient"[\s\S]{0,260}data-dream-art-wide="true"\]:has\(main\.main-surface:not\(\.dream-skin-home-shell\)\)[\s\S]{0,120}body\s*\{[\s\S]{0,260}background-position:\s*var\(--ds-art-position\) !important;/,
  "Wide task artwork must retain the same focal point as the home route.",
);
assert.match(
  css,
  /data-dream-art-wide="true"\]\s+\.composer-surface-chrome\s*\{[\s\S]{0,500}backdrop-filter:\s*none !important;/,
  "Wide artwork should use one uniform composer surface without a split blur layer.",
);
assert.match(
  css,
  /--ds-immersive-composer-solid:\s*rgb\(var\(--ds-panel-rgb\) \/ \.74\);/,
  "The light composer should retain enough transparency to reveal the selected artwork.",
);
assert.match(
  css,
  /data-dream-shell="light"\]\[data-dream-art-wide="true"\][\s\S]{0,100}\.composer-surface-chrome\s*\{[\s\S]{0,400}backdrop-filter:\s*blur\(8px\) saturate\(102%\) !important;/,
  "The translucent light composer should softly separate text from detailed artwork.",
);
assert.match(
  template,
  /\[class\*="_homeUtilityBar_"\][\s\S]{0,500}dream-skin-home-utility/,
  "The renderer should give the current native home utility bar a stable theme class.",
);
assert.match(
  css,
  /\.dream-skin-home:has\(\.dream-skin-home-utility\)[\s\S]{0,120}\.composer-surface-chrome\s*\{[\s\S]{0,180}border-radius:\s*0 0 22px 22px !important;/,
  "The home utility bar and composer should render as one continuous control.",
);
assert.match(
  css,
  /\.composer-surface-chrome button:not\(\[class~="bg-token-foreground"\]\)[\s\S]{0,100}color:\s*var\(--ds-muted\) !important;/,
  "Composer controls must remain readable when Codex native tokens lag behind a forced dark appearance.",
);
assert.match(
  css,
  /\.composer-surface-chrome button:not\(\[class~="bg-token-foreground"\]\) \*\s*\{[\s\S]{0,80}color:\s*currentColor !important;/,
  "Nested labels inside composer controls must inherit the corrected theme color.",
);
assert.match(
  css,
  /\.composer-surface-chrome p\.placeholder::after\s*\{[\s\S]{0,120}color:\s*rgb\(var\(--ds-muted-rgb\) \/ \.82\) !important;[\s\S]{0,80}opacity:\s*1 !important;/,
  "Composer placeholder text must not inherit a stale native color with double opacity.",
);
assert.match(
  css,
  /header\.app-header-tint\s*\{[\s\S]{0,180}background:\s*transparent !important;/,
  "Wide artwork should not paint a separate opaque header band.",
);
assert.match(
  css,
  /\.thread-scroll-container \.bg-gradient-to-t\.from-token-main-surface-primary\s*\{[\s\S]{0,100}background:\s*transparent !important;/,
  "Wide artwork should remove the native opaque fade behind the sticky composer.",
);
assert.match(
  css,
  /div\.sticky:has\(input\[type="text"\]\)[\s\S]{0,100}background:\s*transparent !important;/,
  "Search routes should not retain the native opaque sticky band.",
);
assert.match(
  css,
  /\[class~="bg-token-main-surface-primary"\]\[class~="h-full"\]\[class~="w-full"\][\s\S]{0,100}background:\s*transparent !important;/,
  "Full-size utility route wrappers should not hide the selected artwork.",
);
assert.match(
  css,
  /data-dream-theme="preset-codex-luce"[\s\S]{0,180}\.composer-surface-chrome\s*\{[\s\S]{0,300}border-radius:\s*8px !important;/,
  "Codex Luce must style the native composer as a tactile control surface.",
);
assert.match(
  css,
  /#codex-dream-skin-chrome\[data-instrumented="true"\][\s\S]{0,180}\.dream-skin-instruments\s*\{[\s\S]{0,300}grid-template-columns:/,
  "Codex Luce must expose its read-only native-state instrumentation.",
);
assert.match(
  css,
  /#codex-dream-skin-luce-dynamics\s*\{[\s\S]{0,260}pointer-events:\s*none !important;/,
  "Codex Luce's dynamic gauges must never intercept native interaction.",
);
assert.match(
  css,
  /\.luce-v3-value,[\s\S]{0,300}font-family:\s*"Doto"/,
  "Codex Luce V3 must use the declared Nothing display face for primary metrics.",
);
assert.match(
  css,
  /data-quota-level="warning"[\s\S]{0,180}#ff6a00/,
  "Low remaining quota should retain the Nothing orange event color.",
);
assert.match(
  css,
  /--color-token-editor-selection-background:\s*rgb\(255 106 0 \/ \.32\) !important;[\s\S]{0,1500}--color-token-list-active-selection-foreground:\s*#ff8a2a !important;/,
  "Codex Luce must preserve orange native selection semantics independently of neutral chrome colors.",
);
assert.match(
  css,
  /:is\(input, textarea, \[contenteditable="true"\], \.ProseMirror\)\s*\{[\s\S]{0,100}caret-color:\s*#ff6a00 !important;/,
  "Editable native controls must keep the orange Luce caret.",
);
assert.match(
  css,
  /::selection\s*\{[\s\S]{0,120}background:\s*rgb\(255 106 0 \/ \.32\);/,
  "Selected text must retain the orange Luce highlight.",
);
assert.match(
  css,
  /--color-token-list-hover-background:\s*rgb\(255 106 0 \/ \.12\) !important;[\s\S]{0,500}--color-token-toolbar-hover-background:\s*rgb\(255 106 0 \/ \.12\) !important;/,
  "Codex Luce must map native list and toolbar hover tokens to the same orange tint.",
);
assert.match(
  css,
  /:is\(button, \[role="button"\], \[role="menuitem"\], \[role="option"\], \[role="tab"\],[\s\S]{0,220}:not\(\[class~="bg-token-foreground"\]\):hover\s*\{[\s\S]{0,180}color:\s*#ff6a00 !important;[\s\S]{0,180}background-color:\s*rgb\(255 106 0 \/ \.12\) !important;/,
  "All non-primary native controls must share the orange Luce hover state.",
);
assert.match(
  css,
  /button\[class~="bg-token-foreground"\]:not\(:disabled\):hover\s*\{[\s\S]{0,140}background:\s*#ff6a00 !important;/,
  "Primary controls must use a solid orange hover state.",
);
assert.match(
  css,
  /data-route="task"\][^\{]*> \.luce-wallpaper-svg-v3\s*\{[\s\S]{0,80}opacity:\s*0;/,
  "The large wallpaper gauges must withdraw from task threads instead of showing through native content.",
);
assert.match(
  css,
  /data-route="utility"\][^\{]*> \.luce-wallpaper-svg-v3\s*\{[\s\S]{0,80}opacity:\s*0;/,
  "The large wallpaper gauges must also withdraw from Settings and other utility routes.",
);
assert.match(
  css,
  /\.luce-task-dock-v3\s*\{[\s\S]{0,500}visibility:\s*hidden;[\s\S]{0,300}cubic-bezier\(\.25, \.1, \.25, 1\)/,
  "Task threads must keep the real gauge dock mounted for a buffered reveal.",
);
assert.match(
  css,
  /\.luce-task-dock-v3\s*\{[\s\S]{0,420}transform:\s*translate3d\(10px, 0, 0\) scale\(\.92\);[\s\S]{0,420}transform \.34s cubic-bezier\(\.25, \.1, \.25, 1\)/,
  "The task gauge dock must shrink and slide out using compositor-friendly transform animation.",
);
assert.match(
  css,
  /data-route="task"\]\[data-task-dock="visible"\] \.luce-task-dock-v3\s*\{[\s\S]{0,120}transform:\s*translate3d\(0, 0, 0\) scale\(1\);/,
  "The task gauge dock must scale back to full size when the native side panel closes.",
);
assert.match(
  css,
  /\.luce-task-dock-v3\s*\{[\s\S]{0,400}background-image:\s*var\(--luce-task-chassis\);[\s\S]{0,180}background-size:\s*100% 100%;/,
  "The task gauges must use the exact-coordinate V3 chassis without a second cover crop.",
);
assert.match(
  css,
  /main\.main-surface:not\(\.dream-skin-home-shell\)\s*\{[\s\S]{0,180}background-image:\s*none !important;/,
  "Task content must not reuse the home dashboard as a misaligned crop.",
);
assert.match(
  css,
  /:has\(main\.main-surface\.dream-skin-home-shell\)[\s\S]{0,100}body > #root\s*\{[\s\S]{0,120}position:\s*relative !important;[\s\S]{0,80}z-index:\s*1 !important;/,
  "The complete native Codex root must form one stacking context above the read-only dashboard.",
);
assert.match(
  css,
  /:has\(main\.main-surface\.dream-skin-home-shell\)[\s\S]{0,100}body > #codex-dream-skin-luce-dynamics\s*\{[\s\S]{0,80}z-index:\s*0 !important;/,
  "The dashboard must remain below every native panel, chat surface and dialog.",
);
assert.match(
  css,
  /#codex-dream-skin-luce-dynamics\[data-route="task"\]\s*\{[\s\S]{0,80}z-index:\s*2 !important;/,
  "Home stacking changes must not bury the bounded task dashboard.",
);
assert.match(
  css,
  /aside\.app-shell-left-panel\s*\{[\s\S]{0,100}z-index:\s*10 !important;/,
  "The expanded native sidebar must stay above the home dashboard layer.",
);
assert.match(
  css,
  /\[data-app-shell-tabs="true"\]:has\(\[data-app-shell-tab-strip-controller="right"\]\)\s*\{[\s\S]{0,140}z-index:\s*20 !important;/,
  "The native right tool panel must stack above the home dashboard layer.",
);
assert.match(
  css,
  /:is\(article, \[data-message-author-role\], \.composer-surface-chrome\)[\s\S]{0,100}z-index:\s*4;/,
  "Messages and the composer must remain above the bounded task dock.",
);
assert.doesNotMatch(
  template,
  /class="luce-v3-needle"[^>]*\btransform=/,
  "Quota needles must use bounded endpoints instead of an uncontained transform.",
);
assert.match(
  template,
  /WEEK RUNTIME[\s\S]{0,900}WEEK TOKENS[\s\S]{0,1300}WEEK LEFT/,
  "Home gauges must expose the three requested quota-cycle metrics.",
);
assert.match(
  template,
  /TASK RUNTIME[\s\S]{0,700}TASK TOKENS[\s\S]{0,900}WEEK LEFT/,
  "Task gauges must expose the current task metrics and weekly remaining quota.",
);
assert.match(
  template,
  /luce-v3-task-runtime-clip[\s\S]{0,600}luce-v3-task-left-clip[\s\S]{0,700}clip-path="url\(#luce-v3-task-runtime-clip\)"[\s\S]{0,1600}clip-path="url\(#luce-v3-task-left-clip\)"/,
  "Every task metric must be clipped to its own mechanical well.",
);
assert.match(
  css,
  /\.luce-v3-task-label\s*\{\s*font-size:\s*34px;[\s\S]{0,180}\.luce-v3-task-value\s*\{\s*font-size:\s*74px;/,
  "Task labels and values must remain inside the narrow vertical wells.",
);
assert.match(
  css,
  /\.luce-v3-needle\s*\{\s*stroke:\s*#ff6a00;/,
  "Nothing orange must be reserved for the primary mechanical indicator.",
);
assert.match(
  template,
  /const setNeedleAngle[\s\S]{0,1800}const duration = 720[\s\S]{0,500}1 - \(1 - progress\) \*\* 4/,
  "Gauge needles must use the requested bounded 720ms ease-out interpolation.",
);
assert.match(
  template,
  /const animateMetric[\s\S]{0,1500}\/ 680[\s\S]{0,500}1 - \(1 - progress\) \*\* 4/,
  "Metric values must use the requested buffered 680ms numeric motion.",
);
assert.match(
  template,
  /const scheduleRuntimeTick[\s\S]{0,500}1000 - remainder \+ 16[\s\S]{0,1800}const syncRuntimeClock/,
  "The task runtime must advance as a locally anchored one-second clock while a turn is running.",
);
assert.match(
  template,
  /syncRuntimeClock\([\s\S]{0,180}parts\.taskRuntime,[\s\S]{0,180}state\.activity === "RUNNING",[\s\S]{0,80}task\.id,[\s\S]{0,40}\);/,
  "The task runtime clock must follow native running state, snapshot time and task identity.",
);
assert.doesNotMatch(
  template,
  /animateMetric\(parts\.taskRuntime/,
  "Task runtime must not ease between delayed snapshots and visibly jump seconds.",
);
assert.deepEqual(
  { home: geometry.home.wells[0], task: geometry.task.wells[0] },
  { home: { cx: 1316, cy: 664, r: 154 }, task: { cx: 320, cy: 424, r: 152 } },
  "Home and task overlays must share an explicit measured geometry contract.",
);
const luceV3Markup = template.slice(
  template.indexOf("const ensureLuceLayerV3"),
  template.indexOf("const syncLuceLayerV3"),
);
assert.doesNotMatch(
  luceV3Markup,
  /model|run-count|luce-v3-meta/i,
  "V3 gauges must not retain unreadably small model or run metadata.",
);

function createStyleDeclaration() {
  const values = new Map();
  return {
    values,
    getPropertyValue(name) { return values.get(name) ?? ""; },
    setProperty(name, value) { values.set(name, value); },
    removeProperty(name) { values.delete(name); },
  };
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    values,
    add(...names) { for (const name of names) values.add(name); },
    remove(...names) { for (const name of names) values.delete(name); },
    contains(name) { return values.has(name); },
    toggle(name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    },
  };
}

function createFixture(theme, {
  nativeShell = "light",
  analysisFixture = null,
  analysisCache = null,
  instrumentFixture = null,
  sidePanelOpen = false,
} = {}) {
  let fixtureShell = nativeShell;
  let fixtureSidePanelOpen = sidePanelOpen;
  const nodes = new Map();
  const attributes = new Map();
  const bodyAttributes = new Map();
  const observers = [];
  const resizeObservers = [];
  const timers = new Map();
  let nextTimer = 1;
  let nextBlob = 1;
  const rootStyle = createStyleDeclaration();
  const root = {
    className: nativeShell === "dark" ? "electron-dark" : "electron-light",
    classList: createClassList(),
    style: rootStyle,
    appendChild(node) {
      node.parentElement = root;
      if (node.id) nodes.set(node.id, node);
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
  };
  const body = {
    className: "",
    appendChild(node) {
      node.parentElement = body;
      if (node.id) nodes.set(node.id, node);
    },
    getAttribute(name) { return bodyAttributes.get(name) ?? null; },
    setAttribute(name, value) { bodyAttributes.set(name, String(value)); },
  };
  const shellBox = { left: 280, top: 36, width: 1000, height: 764 };
  const shellMain = {
    classList: createClassList(),
    getBoundingClientRect() {
      return { ...shellBox };
    },
  };

  const createElement = (tagName) => {
    if (tagName === "canvas" && analysisFixture) {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage() {},
            getImageData() { return { data: analysisFixture.pixels }; },
          };
        },
      };
    }
    const childNodes = new Map();
    const element = {
      id: "",
      dataset: {},
      style: createStyleDeclaration(),
      classList: createClassList(),
      parentElement: null,
      textContent: "",
      innerHTML: "",
      setAttribute() {},
      querySelector(selector) {
        if (!childNodes.has(selector)) {
          childNodes.set(selector, {
            textContent: "",
            dataset: {},
            style: createStyleDeclaration(),
            setAttribute() {},
          });
        }
        return childNodes.get(selector);
      },
      remove() { if (element.id) nodes.delete(element.id); },
    };
    return element;
  };

  const document = {
    documentElement: root,
    head: root,
    body,
    createElement,
    getElementById(id) { return nodes.get(id) ?? null; },
    querySelector(selector) {
      if (selector === "main.main-surface" || selector === "main") return shellMain;
      if (selector === ".composer-surface-chrome") return instrumentFixture;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button[aria-label="Toggle side panel"]') {
        return [{
          getAttribute(name) {
            if (name === "aria-label") return "Toggle side panel";
            if (name === "aria-pressed") return fixtureSidePanelOpen ? "true" : "false";
            return null;
          },
          getBoundingClientRect() {
            return { left: 1240, right: 1268, top: 9, bottom: 37, width: 28, height: 28 };
          },
        }];
      }
      return [];
    },
  };
  const mediaQuery = {
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  };
  const revokedUrls = [];
  const window = {
    addEventListener() {},
    removeEventListener() {},
    matchMedia() {
      mediaQuery.matches = fixtureShell === "dark";
      return mediaQuery;
    },
  };
  if (analysisCache) window.__CODEX_DREAM_SKIN_ANALYSIS_CACHE__ = analysisCache;
  if (analysisFixture) {
    window.Image = class {
      naturalWidth = analysisFixture.naturalWidth;
      naturalHeight = analysisFixture.naturalHeight;
      set src(_) { this.onload(); }
    };
  }
  const context = {
    window,
    document,
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.target = null;
        resizeObservers.push(this);
      }
      observe(target) { this.target = target; }
      disconnect() { this.target = null; }
    },
    URL: {
      createObjectURL() { return `blob:fixture-${nextBlob++}`; },
      revokeObjectURL(value) { revokedUrls.push(value); },
    },
    Blob,
    Uint8Array,
    atob,
    getComputedStyle() {
      const skinShell = root.classList.contains("codex-dream-skin")
        ? (attributes.get("data-dream-shell") || "dark") : fixtureShell;
      return {
        colorScheme: skinShell,
        backgroundColor: fixtureShell === "dark" ? "rgb(24, 24, 27)" : "rgb(250, 250, 250)",
      };
    },
    setInterval: () => 1,
    clearInterval() {},
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    cancelAnimationFrame() {},
  };
  const payloadFor = (nextTheme, cssText = ".fixture { color: blue; }") => template
    .replace("__DREAM_SKIN_CSS_JSON__", JSON.stringify(cssText))
    .replace("__DREAM_SKIN_ART_JSON__", JSON.stringify("data:image/png;base64,AA=="))
    .replace("__LUCE_TASK_CHASSIS_JSON__", JSON.stringify("data:image/jpeg;base64,AA=="))
    .replace("__DREAM_SKIN_THEME_JSON__", JSON.stringify(nextTheme))
    .replace("__LUCE_GEOMETRY_JSON__", JSON.stringify(geometry))
    .replace("__DREAM_SKIN_VERSION_JSON__", JSON.stringify("test"))
    .replace("__DREAM_SKIN_STYLE_REVISION_JSON__", JSON.stringify(cssText));
  const flushTimers = (maximumDelay = Infinity) => {
    const pending = [...timers.entries()].filter(([, timer]) => timer.delay <= maximumDelay);
    for (const [id, timer] of pending) {
      timers.delete(id);
      timer.callback();
    }
  };

  return {
    attributes,
    body,
    bodyAttributes,
    context,
    flushTimers,
    nodes,
    observers,
    payload: payloadFor(theme),
    payloadFor,
    revokedUrls,
    resizeObservers,
    root,
    rootStyle,
    shellBox,
    timers,
    window,
    setNativeShell(value) { fixtureShell = value; },
    setSidePanelOpen(value) { fixtureSidePanelOpen = Boolean(value); },
  };
}

const defaults = createFixture({
  id: "default-contract",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
});
const defaultResult = vm.runInNewContext(defaults.payload, defaults.context);
assert.equal(defaultResult.installed, true);
assert.equal(defaults.attributes.get("data-dream-shell"), "light");
assert.equal(defaults.attributes.get("data-dream-art-safe-area"), "center");
assert.equal(defaults.attributes.get("data-dream-art-task-mode"), "ambient");
assert.equal(defaults.attributes.get("data-dream-art-ready"), "false");
assert.equal(defaults.rootStyle.values.get("--dream-art-position"), "50.00% 50.00%");
const defaultMetrics = defaults.window.__CODEX_DREAM_SKIN_STATE__.metrics;
assert.equal(defaultMetrics.rootPasses, 1);
assert.equal(defaultMetrics.routePasses, 1);
assert.equal(defaultMetrics.layoutReads, 1);
for (let index = 0; index < 50; index += 1) defaults.observers[0].callback([]);
assert.equal(defaults.timers.size, 1, "Mutation bursts should coalesce into one scheduled ensure.");
defaults.flushTimers(100);
assert.equal(defaultMetrics.rootPasses, 1, "Subtree mutations must not recompute root theme tokens.");
assert.equal(defaultMetrics.routePasses, 2);
assert.equal(defaultMetrics.layoutReads, 1, "Subtree mutations must not force shell layout reads.");
const defaultChrome = defaults.nodes.get("codex-dream-skin-chrome");
defaults.observers[0].callback([{
  type: "childList",
  target: defaults.body,
  addedNodes: [defaultChrome],
  removedNodes: [],
}]);
assert.equal(defaults.timers.size, 0, "Skin-owned DOM updates must not schedule native route sync.");
defaults.observers[1].callback([{
  type: "attributes",
  target: defaults.root,
  attributeName: "class",
  oldValue: "electron-light codex-dream-skin",
}]);
defaults.flushTimers(64);
assert.equal(defaultMetrics.rootPasses, 1, "Root class mutations that only reflect the skin token must be ignored.");
assert.equal(defaults.resizeObservers.length, 1);
assert.ok(defaults.resizeObservers[0].target);
defaults.shellBox.left = 196;
defaults.shellBox.width = 1084;
defaults.resizeObservers[0].callback([]);
defaults.flushTimers(64);
assert.equal(defaultMetrics.layoutReads, 2, "Shell ResizeObserver changes must refresh chrome geometry.");
assert.equal(defaultChrome.style.values.get("left"), "196px");
assert.equal(defaultChrome.style.values.get("width"), "1084px");

// Auto appearance must continue following the native shell after the skin is
// already installed. The fixture makes the injected root color-scheme win
// whenever our class remains on <html>, so a temporary native probe is needed
// for each light → dark → light transition.
const shellFollow = createFixture({
  id: "shell-follow",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
});
shellFollow.root.className = "";
vm.runInNewContext(shellFollow.payload, shellFollow.context);
assert.equal(shellFollow.attributes.get("data-dream-shell"), "light");
shellFollow.setNativeShell("dark");
shellFollow.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(shellFollow.attributes.get("data-dream-shell"), "dark");
shellFollow.setNativeShell("light");
shellFollow.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(shellFollow.attributes.get("data-dream-shell"), "light");

defaults.root.className = "";
defaults.body.setAttribute("data-theme", "dark");
defaults.observers[1].callback([{ type: "attributes", target: defaults.body }]);
defaults.flushTimers(64);
assert.equal(defaults.attributes.get("data-dream-shell"), "dark", "Body theme changes must apply without the fallback interval.");

const synchronousWide = createFixture({
  id: "synchronous-wide",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
  artKey: "wide-art",
  artMetadata: {
    width: 2400,
    height: 1350,
    ratio: 2400 / 1350,
    wide: true,
    aspect: "wide",
    taskMode: "ambient",
  },
});
vm.runInNewContext(synchronousWide.payload, synchronousWide.context);
assert.equal(synchronousWide.attributes.get("data-dream-art-wide"), "true");
assert.equal(synchronousWide.attributes.get("data-dream-art-aspect"), "wide");
assert.equal(synchronousWide.attributes.get("data-dream-art-task-mode"), "ambient");
assert.equal(synchronousWide.attributes.get("data-dream-art-ready"), "false");

const cachedAnalysis = {
  width: 2400,
  height: 1350,
  ratio: 2400 / 1350,
  wide: true,
  aspect: "wide",
  taskMode: "ambient",
  safeArea: "left",
  focusX: 0.72,
  focusY: 0.48,
  accentRgb: { r: 180, g: 90, b: 110 },
};
const cached = createFixture({
  id: "cached-wide",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
  artKey: "cached-art",
  artMetadata: synchronousWide.window.__CODEX_DREAM_SKIN_STATE__.artMetadata,
}, { analysisCache: new Map([["cached-art", cachedAnalysis]]) });
vm.runInNewContext(cached.payload, cached.context);
assert.equal(cached.attributes.get("data-dream-art-ready"), "true");
assert.equal(cached.attributes.get("data-dream-art-safe-area"), "left");
assert.equal(cached.window.__CODEX_DREAM_SKIN_STATE__.metrics.analysisCacheHits, 1);
assert.equal(cached.window.__CODEX_DREAM_SKIN_STATE__.metrics.analysisRuns, 0);

const previousWideState = synchronousWide.window.__CODEX_DREAM_SKIN_STATE__;
const stableStyle = synchronousWide.nodes.get("codex-dream-skin-style");
vm.runInNewContext(synchronousWide.payloadFor({
  id: "switched-wide",
  appearance: "dark",
  art: { safeArea: "right", taskMode: "ambient" },
  artKey: "switched-art",
  artMetadata: {
    width: 2400,
    height: 1350,
    ratio: 2400 / 1350,
    wide: true,
    aspect: "wide",
    taskMode: "ambient",
  },
}, ".fixture { color: red; }"), synchronousWide.context);
assert.equal(synchronousWide.nodes.get("codex-dream-skin-style"), stableStyle);
assert.equal(stableStyle.textContent, ".fixture { color: red; }");
assert.equal(stableStyle.dataset.dreamSkinVersion, "test");
assert.equal(synchronousWide.rootStyle.values.get("--dream-skin-art"), 'url("blob:fixture-2")');
assert.deepEqual(synchronousWide.revokedUrls, ["blob:fixture-1"]);
assert.equal(previousWideState.cleanup(), false, "An old async cleanup must not remove the new theme.");

const brightPixels = new Uint8ClampedArray(96 * 32 * 4);
for (let offset = 0; offset < brightPixels.length; offset += 4) {
  brightPixels[offset] = 245;
  brightPixels[offset + 1] = 224;
  brightPixels[offset + 2] = 224;
  brightPixels[offset + 3] = 255;
}
const nativeDark = createFixture({
  id: "native-dark-contract",
  appearance: "auto",
  art: { safeArea: "auto", taskMode: "auto" },
}, {
  nativeShell: "dark",
  analysisFixture: { naturalWidth: 2400, naturalHeight: 800, pixels: brightPixels },
});
vm.runInNewContext(nativeDark.payload, nativeDark.context);
await Promise.resolve();
await Promise.resolve();
nativeDark.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(nativeDark.window.__CODEX_DREAM_SKIN_STATE__.analysis.shell, "light");
assert.equal(nativeDark.attributes.get("data-dream-shell"), "dark");
assert.match(nativeDark.rootStyle.values.get("--ds-bg"), /^#[0-9a-f]{6}$/);
assert.ok(Number.parseInt(nativeDark.rootStyle.values.get("--ds-bg").slice(1), 16) < 0x303030);

const explicit = createFixture({
  id: "explicit-contract",
  appearance: "dark",
  art: { focusX: 0.15, focusY: 0.8, safeArea: "none", taskMode: "off" },
});
const explicitResult = vm.runInNewContext(explicit.payload, explicit.context);
assert.equal(explicitResult.shell, "dark");
assert.equal(explicit.attributes.get("data-dream-shell"), "dark");
assert.equal(explicit.attributes.get("data-dream-art-safe-area"), "none");
assert.equal(explicit.attributes.get("data-dream-art-safe"), "none");
assert.equal(explicit.attributes.get("data-dream-art-task-mode"), "off");
assert.equal(explicit.rootStyle.values.get("--dream-art-position"), "15.00% 80.00%");
assert.equal(explicit.window.__CODEX_DREAM_SKIN_STATE__.analysis, null);

const banner = createFixture({
  id: "banner-contract",
  appearance: "auto",
  art: { safeArea: "left", taskMode: "banner" },
  artMetadata: {
    width: 2560,
    height: 1440,
    ratio: 2560 / 1440,
    wide: true,
    aspect: "ultrawide",
    taskMode: "banner",
    safeArea: "left",
    focusX: 0.72,
    focusY: 0.44,
  },
});
vm.runInNewContext(banner.payload, banner.context);
assert.equal(banner.attributes.get("data-dream-art-wide"), "true");
assert.equal(banner.attributes.get("data-dream-art-task-mode"), "banner");
assert.equal(banner.attributes.get("data-dream-task-mode"), "banner");

const nativeModelButton = {
  textContent: "GPT-5 Codex",
  getAttribute() { return null; },
};
const nativeSendButton = {
  disabled: false,
  textContent: "Send",
  getAttribute() { return null; },
};
const nativeEditor = { value: "Refactor the renderer tests" };
const nativeContext = {
  getAttribute(name) { return name === "aria-label" ? "Context usage: 68%" : null; },
};
const nativeComposer = {
  getBoundingClientRect() { return { left: 420, right: 2280, top: 1100, bottom: 1260, width: 1860, height: 160 }; },
  querySelectorAll(selector) {
    return selector === "button" ? [nativeModelButton, nativeSendButton] : [];
  },
  querySelector(selector) {
    if (selector === 'textarea, [contenteditable="true"]') return nativeEditor;
    if (selector === 'button[class~="bg-token-foreground"]') return nativeSendButton;
    if (selector === '[aria-label^="Context usage:"]') return nativeContext;
    return null;
  },
};
const instrumented = createFixture({
  id: "preset-codex-luce",
  appearance: "dark",
  instrumentation: { enabled: true },
  art: { safeArea: "left", taskMode: "ambient" },
}, { instrumentFixture: nativeComposer });
vm.runInNewContext(instrumented.payload, instrumented.context);
assert.equal(instrumented.attributes.get("data-dream-theme"), "preset-codex-luce");
assert.equal(instrumented.nodes.get("codex-dream-skin-chrome").dataset.instrumented, "true");
assert.deepEqual(
  { ...instrumented.window.__CODEX_DREAM_SKIN_STATE__.actual },
  { route: "TASK", model: "", activity: "DRAFT", metrics: null },
  "Luce V3 must keep route/activity internally without displaying model or context metadata.",
);
assert.ok(
  instrumented.nodes.has("codex-dream-skin-luce-dynamics"),
  "Codex Luce must mount its read-only dynamic gauge layer.",
);
assert.equal(
  instrumented.nodes.get("codex-dream-skin-luce-dynamics").dataset.schema,
  "7",
  "Dynamic gauge DOM must carry a schema so hot reloads replace stale structures.",
);
assert.equal(
  instrumented.nodes.get("codex-dream-skin-luce-dynamics").dataset.route,
  "task",
  "The dynamic layer must expose its native route so task CSS can adapt it.",
);
assert.equal(
  instrumented.nodes.get("codex-dream-skin-luce-dynamics").dataset.taskDock,
  "visible",
  "The task gauge dock must remain useful when a safe gutter is available.",
);
const instrumentedWithSidePanel = createFixture({
  id: "preset-codex-luce",
  appearance: "dark",
  instrumentation: { enabled: true },
  art: { safeArea: "left", taskMode: "ambient" },
}, { instrumentFixture: nativeComposer, sidePanelOpen: true });
vm.runInNewContext(instrumentedWithSidePanel.payload, instrumentedWithSidePanel.context);
assert.equal(
  instrumentedWithSidePanel.nodes.get("codex-dream-skin-luce-dynamics").dataset.sidePanel,
  "open",
  "The Luce layer must mirror the native right-side panel state.",
);
assert.equal(
  instrumentedWithSidePanel.nodes.get("codex-dream-skin-luce-dynamics").dataset.taskDock,
  "hidden",
  "Opening the native right-side panel must withdraw the task gauges.",
);

const livePanelLayer = instrumented.nodes.get("codex-dream-skin-luce-dynamics");
const livePanelMetrics = instrumented.window.__CODEX_DREAM_SKIN_STATE__.metrics;
const layoutReadsBeforePanelToggle = livePanelMetrics.layoutReads;
const livePanelButton = {
  getAttribute(name) {
    if (name === "aria-label") return "Toggle side panel";
    if (name === "aria-pressed") return livePanelLayer.dataset.sidePanel === "open" ? "true" : "false";
    return null;
  },
};
instrumented.setSidePanelOpen(true);
instrumented.observers[0].callback([
  { type: "childList", target: instrumented.body, addedNodes: [], removedNodes: [] },
  { type: "attributes", target: livePanelButton, attributeName: "aria-pressed", oldValue: "false" },
]);
instrumented.flushTimers(100);
assert.equal(
  livePanelLayer.dataset.sidePanel,
  "open",
  "A batched native child mutation must not hide a later side-panel aria-pressed change.",
);
assert.equal(livePanelLayer.dataset.taskDock, "hidden");
assert.equal(
  livePanelMetrics.layoutReads,
  layoutReadsBeforePanelToggle,
  "Side-panel state animation must not force a composer or shell geometry read.",
);
instrumented.setSidePanelOpen(false);
instrumented.observers[0].callback([
  { type: "childList", target: instrumented.body, addedNodes: [], removedNodes: [] },
  { type: "attributes", target: livePanelButton, attributeName: "aria-pressed", oldValue: "true" },
]);
instrumented.flushTimers(100);
assert.equal(livePanelLayer.dataset.sidePanel, "closed");
assert.equal(livePanelLayer.dataset.taskDock, "visible");

nativeModelButton.textContent = "Stop";
const runningState = instrumented.window.__CODEX_DREAM_SKIN_STATE__;
runningState.setMetrics({
  week: { runtimeMs: 600_000, totalTokens: 1_000, remainingPercent: 60 },
  task: { id: "task-a", runtimeMs: 600_000, totalTokens: 1_000 },
  updatedAt: Date.now(),
  stale: false,
});
instrumented.flushTimers(64);
runningState.setMetrics({
  week: { runtimeMs: 601_000, totalTokens: 1_100, remainingPercent: 60 },
  task: { id: "task-b", runtimeMs: 1_000, totalTokens: 100 },
  updatedAt: Date.now(),
  stale: false,
});
instrumented.flushTimers(64);
const switchedTaskClock = [...runningState.runtimeClocks.values()][0];
assert.equal(switchedTaskClock.scopeId, "task-b", "The runtime clock must be scoped to the active task id.");
assert.ok(
  switchedTaskClock.anchorRuntime < 10_000,
  "A newly opened running task must not inherit the previous task's elapsed time.",
);
nativeModelButton.textContent = "GPT-5 Codex";
assert.doesNotMatch(
  instrumented.nodes.get("codex-dream-skin-chrome").innerHTML,
  /<button\b/i,
  "Injected instrumentation must remain read-only and must not add fake controls.",
);

const previousChrome = synchronousWide.nodes.get("codex-dream-skin-chrome");
vm.runInNewContext(synchronousWide.payloadFor({
  id: "preset-codex-luce",
  appearance: "dark",
  instrumentation: { enabled: true },
  art: { safeArea: "left", taskMode: "ambient" },
}), synchronousWide.context);
assert.notEqual(
  synchronousWide.nodes.get("codex-dream-skin-chrome"),
  previousChrome,
  "Switching to an instrumented theme must rebuild the chrome contract.",
);
assert.equal(synchronousWide.nodes.get("codex-dream-skin-chrome").dataset.instrumented, "true");

assert.equal(explicit.window.__CODEX_DREAM_SKIN_STATE__.cleanup(), true);
assert.equal(explicit.root.classList.contains("codex-dream-skin"), false);
assert.equal(explicit.attributes.has("data-dream-shell"), false);
assert.equal(explicit.attributes.has("data-dream-art-safe-area"), false);
assert.equal(explicit.attributes.has("data-dream-art-task-mode"), false);
assert.equal(explicit.rootStyle.values.has("--dream-art-position"), false);
assert.equal(explicit.nodes.has("codex-dream-skin-style"), false);
assert.equal(explicit.nodes.has("codex-dream-skin-chrome"), false);
assert.deepEqual(explicit.revokedUrls, ["blob:fixture-1"]);
await Promise.resolve();
await Promise.resolve();
assert.equal(explicit.root.classList.contains("codex-dream-skin"), false);
assert.equal(explicit.nodes.has("codex-dream-skin-style"), false);
assert.equal(explicit.window.__CODEX_DREAM_SKIN_STATE__, undefined);

console.log("PASS: renderer honors adaptive art metadata, fallback, and cleanup behavior.");
