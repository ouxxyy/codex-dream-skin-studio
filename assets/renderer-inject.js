((cssText, artDataUrl, taskChassisDataUrl, themeConfig, luceGeometry) => {
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const DISABLED_KEY = "__CODEX_DREAM_SKIN_DISABLED__";
  const STYLE_ID = "codex-dream-skin-style";
  const CHROME_ID = "codex-dream-skin-chrome";
  const LUCE_LAYER_ID = "codex-dream-skin-luce-dynamics";
  const LUCE_LAYER_SCHEMA = "7";
  const ROUTE_MUTATION_THROTTLE_MS = 100;
  const FALLBACK_REFRESH_MS = 30000;
  const SHELL_ATTR = "data-dream-shell";
  const THEME_ATTR = "data-dream-theme";
  const ART_ATTRS = [
    "data-dream-art-wide", "data-dream-art-safe", "data-dream-task-mode",
    "data-dream-art-safe-area", "data-dream-art-task-mode", "data-dream-art-aspect",
    "data-dream-art-ready",
  ];
  const VERSION = __DREAM_SKIN_VERSION_JSON__;
  const STYLE_REVISION = __DREAM_SKIN_STYLE_REVISION_JSON__;
  const THEME = themeConfig && typeof themeConfig === "object" ? themeConfig : {};
  const ART = THEME.art && typeof THEME.art === "object" ? THEME.art : {};
  const INSTRUMENTATION = THEME.instrumentation && typeof THEME.instrumentation === "object"
    ? THEME.instrumentation : {};
  const WANTS_INSTRUMENTATION = INSTRUMENTATION.enabled === true;
  const IS_CODEX_LUCE = THEME.id === "preset-codex-luce";
  const ART_METADATA = THEME.artMetadata && typeof THEME.artMetadata === "object"
    ? THEME.artMetadata : null;
  const ANALYSIS_CACHE_KEY = "__CODEX_DREAM_SKIN_ANALYSIS_CACHE__";
  const THEME_VARIABLES = [
    "--ds-bg", "--ds-panel", "--ds-panel-2", "--ds-green", "--ds-lime",
    "--ds-cyan", "--ds-purple", "--ds-text", "--ds-muted", "--ds-line",
    "--ds-bg-rgb", "--ds-panel-rgb", "--ds-panel-2-rgb", "--ds-accent-rgb",
    "--ds-accent-alt-rgb", "--ds-secondary-rgb", "--ds-highlight-rgb",
    "--ds-text-rgb", "--ds-muted-rgb", "--ds-line-rgb",
    "--dream-art-focus-x", "--dream-art-focus-y", "--dream-art-position",
    "--dream-skin-focus-x", "--dream-skin-focus-y", "--dream-skin-art-position",
    "--dream-skin-name", "--dream-skin-tagline", "--dream-skin-project-prefix",
    "--dream-skin-project-label", "--luce-task-chassis",
  ];
  const installToken = {};
  const existingAnalysisCache = window[ANALYSIS_CACHE_KEY];
  const analysisCache = existingAnalysisCache && typeof existingAnalysisCache.get === "function" &&
    typeof existingAnalysisCache.set === "function" ? existingAnalysisCache : new Map();
  window[ANALYSIS_CACHE_KEY] = analysisCache;
  let artAnalysis = typeof THEME.artKey === "string" ? analysisCache.get(THEME.artKey) ?? null : null;
  let analysisTimer = null;
  let samplingNativeShell = false;
  let rootObserver = null;
  const now = () => typeof performance === "object" && typeof performance.now === "function"
    ? performance.now() : Date.now();
  const metrics = {
    ensureCalls: 0,
    rootPasses: 0,
    routePasses: 0,
    layoutReads: 0,
    attributeWrites: 0,
    styleWrites: 0,
    textWrites: 0,
    analysisRuns: 0,
    analysisCacheHits: artAnalysis ? 1 : 0,
    firstEnsureMs: null,
    analysisMs: null,
  };
  window[DISABLED_KEY] = false;

  const previous = window[STATE_KEY];
  const artUrl = (() => {
    const comma = artDataUrl.indexOf(",");
    const mime = /^data:([^;,]+)/.exec(artDataUrl)?.[1] || "image/png";
    const binary = atob(artDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  })();

  if (previous?.observer) previous.observer.disconnect();
  if (previous?.rootObserver) previous.rootObserver.disconnect();
  if (previous?.resizeObserver) previous.resizeObserver.disconnect();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.scheduler?.timeout) clearTimeout(previous.scheduler.timeout);
  if (previous?.scheduler?.frame != null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(previous.scheduler.frame);
  }
  if (previous?.runtimeClocks) {
    for (const clock of previous.runtimeClocks.values()) {
      if (clock.timer != null) clearTimeout(clock.timer);
    }
  }
  if (previous?.analysisTimer) clearTimeout(previous.analysisTimer);
  if (previous?.resizeHandler) window.removeEventListener("resize", previous.resizeHandler);
  if (previous?.mediaHandler && previous?.mediaQuery) {
    try { previous.mediaQuery.removeEventListener("change", previous.mediaHandler); } catch {}
  }

  const cssString = (value) => JSON.stringify(String(value ?? ""));

  const setStyleProperty = (root, name, value) => {
    if (root.style.getPropertyValue(name) !== value) {
      root.style.setProperty(name, value);
      metrics.styleWrites += 1;
    }
  };

  const setAttribute = (root, name, value) => {
    const normalized = String(value);
    if (root.getAttribute(name) !== normalized) {
      root.setAttribute(name, normalized);
      metrics.attributeWrites += 1;
    }
  };

  const setDatasetValue = (node, name, value) => {
    if (!node?.dataset) return;
    const normalized = String(value);
    if (node.dataset[name] !== normalized) {
      node.dataset[name] = normalized;
      metrics.attributeWrites += 1;
    }
  };

  const setDomAttribute = (node, name, value) => {
    const normalized = String(value);
    if (node?.getAttribute?.(name) !== normalized) {
      node?.setAttribute?.(name, normalized);
      metrics.attributeWrites += 1;
    }
  };

  const setClassToken = (node, token, enabled = true) => {
    if (!node?.classList) return;
    const hasToken = node.classList.contains(token);
    if (enabled && !hasToken) {
      node.classList.add(token);
      metrics.attributeWrites += 1;
    } else if (!enabled && hasToken) {
      node.classList.remove(token);
      metrics.attributeWrites += 1;
    }
  };

  const setTextContent = (node, value) => {
    if (node && node.textContent !== value) {
      node.textContent = value;
      metrics.textWrites += 1;
    }
  };

  const parseRgb = (value) => {
    if (!value || value === "transparent") return null;
    const hex = String(value).trim().match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const number = Number.parseInt(hex[1], 16);
      return { r: number >> 16, g: (number >> 8) & 255, b: number & 255 };
    }
    const m = String(value).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  const rgbString = (value) => {
    const rgb = parseRgb(value);
    return rgb ? `${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)}` : null;
  };

  const rgbToHex = ({ r, g, b }) => `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

  const rgbToHsl = ({ r, g, b }) => {
    const values = [r, g, b].map((value) => value / 255);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const lightness = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: lightness };
    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue;
    if (max === values[0]) hue = (values[1] - values[2]) / delta + (values[1] < values[2] ? 6 : 0);
    else if (max === values[1]) hue = (values[2] - values[0]) / delta + 2;
    else hue = (values[0] - values[1]) / delta + 4;
    return { h: hue * 60, s: saturation, l: lightness };
  };

  const hslToRgb = ({ h, s, l }) => {
    const hue = ((h % 360) + 360) % 360 / 360;
    if (s === 0) {
      const neutral = Math.round(l * 255);
      return { r: neutral, g: neutral, b: neutral };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (offset) => {
      let t = hue + offset;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: channel(1 / 3) * 255, g: channel(0) * 255, b: channel(-1 / 3) * 255 };
  };

  const luminance = ({ r, g, b }) => {
    const lin = [r, g, b].map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };

  /** Detect Codex app light/dark shell for CSS branching. */
  const detectShellMode = () => {
    const root = document.documentElement;
    const body = document.body;
    const cls = `${root.className || ""} ${body?.className || ""}`.toLowerCase();

    if (/\b(dark|theme-dark|appearance-dark)\b/.test(cls)) return "dark";
    if (/\b(light|theme-light|appearance-light)\b/.test(cls)) return "light";

    const dataTheme = (
      root.getAttribute("data-theme") ||
      root.getAttribute("data-appearance") ||
      root.getAttribute("data-color-mode") ||
      body?.getAttribute("data-theme") ||
      body?.getAttribute("data-appearance") ||
      ""
    ).toLowerCase();
    if (dataTheme.includes("dark")) return "dark";
    if (dataTheme.includes("light")) return "light";

    // Radios in profile menu (if present in DOM)
    const checked = document.querySelector('input[name="appearance-theme"]:checked');
    if (checked) {
      const label = (checked.getAttribute("aria-label") || checked.value || "").toLowerCase();
      if (label.includes("暗") || label.includes("dark")) return "dark";
      if (label.includes("浅") || label.includes("light")) return "light";
      if (label.includes("系统") || label.includes("system")) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    }

    // The skin itself declares color-scheme on :root.  Once installed,
    // reading getComputedStyle(root) directly would therefore keep `auto`
    // themes locked to the previous shell mode. Temporarily remove only our
    // own root class/attribute, sample the native computed scheme, then restore
    // synchronously. Mutation records created by this probe are drained below
    // so the root observer does not schedule a redundant ensure pass.
    try {
      const hadSkin = root.classList.contains("codex-dream-skin");
      const savedShell = root.getAttribute(SHELL_ATTR);
      samplingNativeShell = true;
      if (hadSkin) root.classList.remove("codex-dream-skin");
      if (savedShell !== null) root.removeAttribute(SHELL_ATTR);
      let colorScheme = "";
      try {
        colorScheme = getComputedStyle(root).colorScheme || "";
      } finally {
        if (hadSkin) root.classList.add("codex-dream-skin");
        if (savedShell !== null) root.setAttribute(SHELL_ATTR, savedShell);
        rootObserver?.takeRecords?.();
        samplingNativeShell = false;
      }
      if (colorScheme.includes("dark") && !colorScheme.includes("light")) return "dark";
      if (colorScheme.includes("light") && !colorScheme.includes("dark")) return "light";
    } catch {
      samplingNativeShell = false;
    }

    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {}

    // Only use surface luminance before the skin owns those surfaces. Sampling
    // our own translucent layers would create route-dependent light/dark flips.
    if (!root.classList.contains("codex-dream-skin")) {
      const samples = [
        body,
        document.querySelector("main.main-surface"),
        document.querySelector("aside.app-shell-left-panel"),
      ].filter(Boolean);
      let votesLight = 0;
      let votesDark = 0;
      for (const el of samples) {
        try {
          const rgb = parseRgb(getComputedStyle(el).backgroundColor);
          if (!rgb) continue;
          const L = luminance(rgb);
          if (L >= 0.55) votesLight += 1;
          else if (L <= 0.25) votesDark += 1;
        } catch {}
      }
      if (votesLight > votesDark) return "light";
      if (votesDark > votesLight) return "dark";
    }
    return "light";
  };

  const makeAdaptivePalette = (sample, shell) => {
    const source = sample || { r: 108, g: 126, b: 136 };
    const hsl = rgbToHsl(source);
    const hue = hsl.s < 0.12 ? 214 : hsl.h;
    const saturation = clamp(hsl.s, 0.38, 0.72);
    const accent = hslToRgb({ h: hue, s: saturation, l: shell === "light" ? 0.42 : 0.66 });
    const accentAlt = hslToRgb({ h: hue + 12, s: saturation * 0.82, l: shell === "light" ? 0.52 : 0.73 });
    const secondary = hslToRgb({ h: hue - 24, s: saturation * 0.64, l: shell === "light" ? 0.56 : 0.62 });
    const highlight = hslToRgb({ h: hue + 24, s: saturation * 0.76, l: shell === "light" ? 0.36 : 0.58 });
    const neutral = (lightness, chroma = 0.08) => rgbToHex(hslToRgb({ h: hue, s: chroma, l: lightness }));
    return shell === "light" ? {
      background: neutral(0.965, 0.07),
      panel: neutral(0.987, 0.035),
      panelAlt: neutral(0.945, 0.09),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.13, 0.10),
      muted: neutral(0.42, 0.08),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .24)`,
    } : {
      background: neutral(0.055, 0.045),
      panel: neutral(0.085, 0.04),
      panelAlt: neutral(0.125, 0.05),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.93, 0.025),
      muted: neutral(0.69, 0.03),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .28)`,
    };
  };

  const resolvedShell = () => {
    if (THEME.appearance === "light" || THEME.appearance === "dark") return THEME.appearance;
    // Image luminance may tune accents and scrims, but auto appearance follows
    // Codex/ChatGPT (or the OS fallback) so a bright wallpaper cannot flip a
    // native dark session back to a light shell after analysis.
    return detectShellMode();
  };

  const applyTheme = (root, shell) => {
    const colors = THEME.colors || {};
    const explicit = new Set(Array.isArray(THEME.explicitColorKeys) ? THEME.explicitColorKeys : []);
    const adaptive = makeAdaptivePalette(artAnalysis?.accentRgb, shell);
    const legacyLight = !THEME.appearance && shell === "light";
    const structural = new Set(["background", "panel", "panelAlt", "text", "muted"]);
    const pick = (name) => {
      const allowExplicit = explicit.has(name) && !(legacyLight && structural.has(name));
      return allowExplicit && typeof colors[name] === "string" ? colors[name] : adaptive[name];
    };
    const accent = pick("accent");
    const accentAlt = explicit.has("accentAlt") ? pick("accentAlt") : (explicit.has("accent") ? accent : adaptive.accentAlt);
    const variables = {
      "--ds-bg": pick("background"),
      "--ds-panel": pick("panel"),
      "--ds-panel-2": pick("panelAlt"),
      "--ds-green": accent,
      "--ds-lime": accentAlt,
      "--ds-cyan": pick("secondary"),
      "--ds-purple": pick("highlight"),
      "--ds-text": pick("text"),
      "--ds-muted": pick("muted"),
      "--ds-line": explicit.has("line") && typeof colors.line === "string" ? colors.line : adaptive.line,
    };

    for (const [name, value] of Object.entries(variables)) {
      if (typeof value === "string" && value) setStyleProperty(root, name, value);
    }
    const rgbVariables = {
      "--ds-bg-rgb": variables["--ds-bg"],
      "--ds-panel-rgb": variables["--ds-panel"],
      "--ds-panel-2-rgb": variables["--ds-panel-2"],
      "--ds-accent-rgb": variables["--ds-green"],
      "--ds-accent-alt-rgb": variables["--ds-lime"],
      "--ds-secondary-rgb": variables["--ds-cyan"],
      "--ds-highlight-rgb": variables["--ds-purple"],
      "--ds-text-rgb": variables["--ds-text"],
      "--ds-muted-rgb": variables["--ds-muted"],
      "--ds-line-rgb": variables["--ds-line"],
    };
    for (const [name, value] of Object.entries(rgbVariables)) {
      const rgb = rgbString(value);
      if (rgb) setStyleProperty(root, name, rgb);
    }
    setStyleProperty(root, "--dream-skin-name", cssString(THEME.name || "Codex Dream Skin"));
    setStyleProperty(root, "--dream-skin-tagline", cssString(THEME.tagline || "Make something wonderful."));
    setStyleProperty(root, "--dream-skin-project-prefix", cssString(THEME.projectPrefix || "选择项目 · "));
    setStyleProperty(root, "--dream-skin-project-label", cssString(THEME.projectLabel || "◉  选择项目"));
  };

  const applyArtMetadata = (root) => {
    const profile = artAnalysis || ART_METADATA;
    const inferredSafe = profile?.safeArea || "center";
    const safeArea = ART.safeArea && ART.safeArea !== "auto" ? ART.safeArea : inferredSafe;
    const canonicalSafe = ["left", "right", "center", "none"].includes(safeArea)
      ? safeArea : "center";
    const focusX = typeof ART.focusX === "number" ? ART.focusX
      : profile?.focusX ?? (safeArea === "left" ? 0.72 : safeArea === "right" ? 0.28 : 0.5);
    const focusY = typeof ART.focusY === "number" ? ART.focusY : profile?.focusY ?? 0.5;
    const taskMode = ART.taskMode && ART.taskMode !== "auto"
      ? ART.taskMode : profile?.taskMode || "ambient";
    const wide = profile?.wide || false;
    const aspect = profile?.aspect || "unknown";
    const focusXValue = `${(clamp(focusX, 0, 1) * 100).toFixed(2)}%`;
    const focusYValue = `${(clamp(focusY, 0, 1) * 100).toFixed(2)}%`;

    setAttribute(root, "data-dream-art-wide", wide ? "true" : "false");
    setAttribute(root, "data-dream-art-safe", canonicalSafe);
    setAttribute(root, "data-dream-task-mode", taskMode);
    setAttribute(root, "data-dream-art-safe-area", safeArea);
    setAttribute(root, "data-dream-art-task-mode", taskMode);
    setAttribute(root, "data-dream-art-aspect", aspect);
    setAttribute(root, "data-dream-art-ready", artAnalysis ? "true" : "false");
    setStyleProperty(root, "--dream-art-focus-x", focusXValue);
    setStyleProperty(root, "--dream-art-focus-y", focusYValue);
    setStyleProperty(root, "--dream-art-position", `${focusXValue} ${focusYValue}`);
    setStyleProperty(root, "--dream-skin-focus-x", focusXValue);
    setStyleProperty(root, "--dream-skin-focus-y", focusYValue);
    setStyleProperty(root, "--dream-skin-art-position", `${focusXValue} ${focusYValue}`);
  };

  const analyzeArt = () => new Promise((resolve) => {
    const startedAt = now();
    metrics.analysisRuns += 1;
    if (typeof window.Image !== "function" || !document?.createElement) {
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(null);
      return;
    }
    const image = new window.Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (analysisTimer) clearTimeout(analysisTimer);
      analysisTimer = null;
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(value);
    };
    analysisTimer = setTimeout(() => finish(null), 6000);
    image.onerror = () => finish(null);
    image.onload = () => {
      try {
        const ratio = image.naturalWidth / image.naturalHeight;
        if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("Invalid image dimensions");
        const maxDimension = 96;
        const width = Math.max(16, Math.round(ratio >= 1 ? maxDimension : maxDimension * ratio));
        const height = Math.max(16, Math.round(ratio >= 1 ? maxDimension / ratio : maxDimension));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(image, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height).data;
        const samples = new Array(width * height);
        const bins = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
        let lightTotal = 0;
        let count = 0;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            if (data[offset + 3] < 32) continue;
            const rgb = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
            const light = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
            const hsl = rgbToHsl(rgb);
            samples[y * width + x] = { light, saturation: hsl.s };
            lightTotal += light;
            count += 1;
            if (hsl.s >= 0.16 && hsl.l >= 0.16 && hsl.l <= 0.86) {
              const bin = bins[Math.min(23, Math.floor(hsl.h / 15))];
              const weight = hsl.s * (1 - Math.abs(hsl.l - 0.52) * 0.85);
              bin.weight += weight;
              bin.r += rgb.r * weight;
              bin.g += rgb.g * weight;
              bin.b += rgb.b * weight;
            }
          }
        }
        if (!count) throw new Error("Image has no visible pixels");
        const brightness = lightTotal / count;
        const information = (start, end) => {
          let total = 0;
          let totalSquared = 0;
          let edges = 0;
          let edgeCount = 0;
          let pixels = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = start; x < end; x += 1) {
              const sample = samples[y * width + x];
              if (!sample) continue;
              total += sample.light;
              totalSquared += sample.light * sample.light;
              pixels += 1;
              const previous = x > start ? samples[y * width + x - 1] : null;
              const above = y > 0 ? samples[(y - 1) * width + x] : null;
              if (previous) { edges += Math.abs(sample.light - previous.light); edgeCount += 1; }
              if (above) { edges += Math.abs(sample.light - above.light); edgeCount += 1; }
            }
          }
          const mean = pixels ? total / pixels : 0;
          const variance = pixels ? Math.max(0, totalSquared / pixels - mean * mean) : 1;
          return Math.sqrt(variance) * 0.58 + (edgeCount ? edges / edgeCount : 1) * 0.42;
        };
        const zoneWidth = Math.max(1, Math.floor(width * 0.38));
        const leftInformation = information(0, zoneWidth);
        const rightInformation = information(width - zoneWidth, width);
        let safeArea = "center";
        if (leftInformation < rightInformation * 0.86) safeArea = "left";
        else if (rightInformation < leftInformation * 0.86) safeArea = "right";

        let saliencyTotal = 0;
        let saliencyX = 0;
        let saliencyY = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const sample = samples[y * width + x];
            if (!sample) continue;
            const previous = x > 0 ? samples[y * width + x - 1] : null;
            const above = y > 0 ? samples[(y - 1) * width + x] : null;
            const edge = (previous ? Math.abs(sample.light - previous.light) : 0) +
              (above ? Math.abs(sample.light - above.light) : 0);
            const weight = 0.01 + Math.abs(sample.light - brightness) * 0.48 +
              sample.saturation * 0.34 + edge * 0.28;
            saliencyTotal += weight;
            saliencyX += (x + 0.5) / width * weight;
            saliencyY += (y + 0.5) / height * weight;
          }
        }
        let focusX = saliencyTotal ? saliencyX / saliencyTotal : 0.5;
        let focusY = saliencyTotal ? saliencyY / saliencyTotal : 0.5;
        if (safeArea === "left") focusX = Math.max(0.64, focusX);
        if (safeArea === "right") focusX = Math.min(0.36, focusX);
        focusX = clamp(focusX, 0.12, 0.88);
        focusY = clamp(focusY, 0.18, 0.82);

        const accentBin = bins.reduce((best, candidate) => candidate.weight > best.weight ? candidate : best, bins[0]);
        const accentRgb = accentBin.weight > 0 ? {
          r: accentBin.r / accentBin.weight,
          g: accentBin.g / accentBin.weight,
          b: accentBin.b / accentBin.weight,
        } : null;
        const aspect = ratio >= 2.25 ? "ultrawide" : ratio >= 1.45 ? "wide"
          : ratio >= 1.08 ? "landscape" : ratio >= 0.9 ? "square" : "portrait";
        finish({
          width: image.naturalWidth,
          height: image.naturalHeight,
          ratio,
          wide: ratio >= 1.75,
          aspect,
          brightness,
          shell: brightness >= 0.58 ? "light" : "dark",
          safeArea,
          focusX,
          focusY,
          taskMode: ratio >= 2.25 ? "banner" : "ambient",
          accentRgb,
        });
      } catch {
        finish(null);
      }
    };
    image.src = artUrl;
  });

  let chromeParts = null;
  let luceParts = null;
  const needleMotions = new Map();
  const valueMotions = new Map();
  const runtimeClocks = new Map();
  let observedShellMain = null;
  let resizeObserver = null;
  let actualState = null;
  let metricsSnapshot = window.__CODEX_DREAM_SKIN_METRICS__ ?? null;
  let lastRoute = null;
  let luceLayoutCache = null;

  const ensureStyle = (root) => {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = cssText;
      style.dataset.dreamSkinVersion = VERSION;
      (document.head || root).appendChild(style);
    } else if (style.dataset.dreamSkinStyleRevision !== STYLE_REVISION) {
      style.textContent = cssText;
    }
    style.dataset.dreamSkinVersion = VERSION;
    style.dataset.dreamSkinStyleRevision = STYLE_REVISION;
    return style;
  };

  const applyRootState = (root) => {
    metrics.rootPasses += 1;
    ensureStyle(root);
    const shell = resolvedShell();
    setAttribute(root, SHELL_ATTR, shell);
    setStyleProperty(root, "--dream-skin-art", `url("${artUrl}")`);
    setStyleProperty(root, "--luce-task-chassis", `url("${taskChassisDataUrl}")`);
    applyTheme(root, shell);
    applyArtMetadata(root);
    setAttribute(root, THEME_ATTR, THEME.id || "custom");
    setClassToken(root, "codex-dream-skin", true);
    return shell;
  };

  const compactNativeText = (node, limit = 24) => {
    const value = String(node?.getAttribute?.("aria-label") || node?.innerText || node?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    return value && value.length <= limit ? value : "";
  };

  const readNativeModel = () => {
    const composer = document.querySelector(".composer-surface-chrome");
    const buttons = composer?.querySelectorAll?.("button") || [];
    for (const button of buttons) {
      const value = compactNativeText(button, 32);
      if (button.getAttribute?.("data-codex-intelligence-trigger") === "true" ||
        /\b(?:gpt[-\s]?\d|o[134](?:-mini)?|codex(?:-[\w.]+)?|model)\b|模型/i.test(value)) {
        return value.toUpperCase();
      }
    }
    return "";
  };

  const readNativeActivity = () => {
    const composer = document.querySelector(".composer-surface-chrome");
    if (!composer) return "IDLE";
    const buttons = composer.querySelectorAll?.("button") || [];
    for (const button of buttons) {
      const value = compactNativeText(button, 32);
      if (/\b(?:stop|cancel)\b|停止|取消/i.test(value)) return "RUNNING";
    }
    const editor = composer.querySelector?.('textarea, [contenteditable="true"]');
    const draft = String(editor?.value ?? editor?.textContent ?? "").trim();
    if (draft) return "DRAFT";
    const send = composer.querySelector?.('button[class~="bg-token-foreground"]');
    if (send && !send.disabled && send.getAttribute?.("aria-disabled") !== "true") return "READY";
    return "IDLE";
  };

  const readNativeContext = () => {
    const composer = document.querySelector(".composer-surface-chrome");
    const indicator = composer?.querySelector?.('[aria-label^="Context usage:"]') ||
      document.querySelector('[aria-label^="Context usage:"]');
    const value = indicator?.getAttribute?.("aria-label") || "";
    const match = /Context usage:\s*([\d.]+)%/i.exec(value);
    if (!match) return null;
    const percent = Number(match[1]);
    return Number.isFinite(percent) ? clamp(percent, 0, 100) : null;
  };

  const readNativeTaskRuntime = () => {
    const entries = new Set();
    for (const node of document.querySelectorAll("body *")) {
      if (node.children.length !== 0) continue;
      const value = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (/^(?:worked for|运行了)\s+/i.test(value)) entries.add(value);
    }
    let seconds = 0;
    let runs = 0;
    for (const entry of entries) {
      const hours = Number(/(\d+)\s*(?:h|小时)/i.exec(entry)?.[1] || 0);
      const minutes = Number(/(\d+)\s*(?:m|分钟)/i.exec(entry)?.[1] || 0);
      const explicitSeconds = /(\d+)\s*(?:s|秒)/i.exec(entry)?.[1];
      const compactSeconds = /(?:\d+\s*(?:m|分钟))\s+(\d+)\b/i.exec(entry)?.[1];
      const entrySeconds = hours * 3600 + minutes * 60 + Number(explicitSeconds || compactSeconds || 0);
      if (entrySeconds > 0) {
        seconds += entrySeconds;
        runs += 1;
      }
    }
    return seconds > 0 ? { seconds, runs } : null;
  };

  const formatTaskRuntime = (runtime) => {
    if (!runtime) return { value: "--", meta: "NO RUNS" };
    const totalMinutes = Math.floor(runtime.seconds / 60);
    const remainingSeconds = runtime.seconds % 60;
    const hours = Math.floor(totalMinutes / 60);
    const value = hours > 0 ? `${hours}H${String(totalMinutes % 60).padStart(2, "0")}` : `${totalMinutes}M`;
    return { value, meta: `${runtime.runs} ${runtime.runs === 1 ? "RUN" : "RUNS"} · ${String(remainingSeconds).padStart(2, "0")}S` };
  };

  const ensureLuceLayer = () => {
    let layer = document.getElementById(LUCE_LAYER_ID);
    if (!IS_CODEX_LUCE) {
      layer?.remove();
      luceParts = null;
      return null;
    }
    if (!layer || layer.parentElement !== document.body || layer.dataset?.schema !== LUCE_LAYER_SCHEMA) {
      layer?.remove();
      layer = document.createElement("div");
      layer.id = LUCE_LAYER_ID;
      layer.dataset.schema = LUCE_LAYER_SCHEMA;
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = `
        <svg class="luce-wallpaper-svg" viewBox="0 0 2560 1440" width="2560" height="1440" aria-hidden="true">
          <defs>
            <clipPath id="luce-output-clip"><circle cx="1368" cy="690" r="164"></circle></clipPath>
            <clipPath id="luce-activity-clip"><circle cx="1770" cy="690" r="179"></circle></clipPath>
            <clipPath id="luce-context-clip"><circle cx="2206" cy="690" r="164"></circle></clipPath>
          </defs>
          <g class="luce-gauge luce-gauge-output" clip-path="url(#luce-output-clip)">
            <circle class="luce-gauge-face" cx="1368" cy="690" r="166"></circle>
            <text class="luce-gauge-label" x="1368" y="606">TASK TIME</text>
            <text class="luce-gauge-value luce-output-state" x="1368" y="716">--</text>
            <text class="luce-gauge-meta luce-output-meta" x="1368" y="756">NO RUNS</text>
          </g>
          <g class="luce-gauge luce-gauge-activity" clip-path="url(#luce-activity-clip)">
            <circle class="luce-gauge-face" cx="1770" cy="690" r="181"></circle>
            <text class="luce-gauge-label" x="1770" y="568">ACTIVITY</text>
            <g class="luce-ticks">
              <line x1="1640" y1="690" x2="1662" y2="690"></line>
              <line x1="1668" y1="611" x2="1686" y2="623"></line>
              <line x1="1770" y1="542" x2="1770" y2="565"></line>
              <line x1="1872" y1="611" x2="1854" y2="623"></line>
              <line x1="1900" y1="690" x2="1878" y2="690"></line>
            </g>
            <line class="luce-needle" x1="1770" y1="708" x2="1770" y2="570"></line>
            <circle class="luce-needle-hub" cx="1770" cy="690" r="15"></circle>
            <circle class="luce-needle-pin" cx="1770" cy="690" r="5"></circle>
            <text class="luce-gauge-value luce-activity-state" x="1770" y="784">IDLE</text>
            <text class="luce-gauge-meta luce-model-value" x="1770" y="820"></text>
          </g>
          <g class="luce-gauge luce-gauge-context" clip-path="url(#luce-context-clip)">
            <circle class="luce-gauge-face" cx="2206" cy="690" r="166"></circle>
            <text class="luce-gauge-label" x="2206" y="584">CONTEXT</text>
            <circle class="luce-context-track" cx="2206" cy="690" r="112" pathLength="100"></circle>
            <circle class="luce-context-progress" cx="2206" cy="690" r="112" pathLength="100"></circle>
            <text class="luce-context-value" x="2206" y="704">--</text>
            <text class="luce-gauge-meta luce-context-meta" x="2206" y="754">NATIVE</text>
          </g>
          <circle class="luce-lamp-cover" cx="1780" cy="397" r="23"></circle>
          <circle class="luce-run-lamp" cx="1780" cy="397" r="10"></circle>
        </svg>
        <div class="luce-task-dock" aria-hidden="true">
          <svg class="luce-task-panel" viewBox="0 0 140 390" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern id="luce-task-panel-dots" width="5" height="5" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r=".55" fill="#b8b8b2" opacity=".22"></circle>
              </pattern>
            </defs>
            <path class="luce-task-panel-shell" d="M18 1 H122 Q139 1 139 18 V372 Q139 389 122 389 H18 Q1 389 1 372 V18 Q1 1 18 1 Z"></path>
            <path class="luce-task-panel-glass" d="M22 7 H118 Q132 7 132 21 V369 Q132 383 118 383 H22 Q8 383 8 369 V21 Q8 7 22 7 Z"></path>
            <path class="luce-task-panel-texture" d="M24 9 H116 Q130 9 130 23 V367 Q130 381 116 381 H24 Q10 381 10 367 V23 Q10 9 24 9 Z"></path>
            <line class="luce-task-panel-bridge" x1="20" y1="128" x2="120" y2="128"></line>
            <line class="luce-task-panel-bridge" x1="20" y1="262" x2="120" y2="262"></line>
            <circle class="luce-task-panel-well" cx="70" cy="68" r="62"></circle>
            <circle class="luce-task-panel-well" cx="70" cy="195" r="62"></circle>
            <circle class="luce-task-panel-well" cx="70" cy="322" r="62"></circle>
            <line class="luce-task-panel-rail" x1="6" y1="14" x2="6" y2="376"></line>
            <line class="luce-task-panel-rail" x1="134" y1="14" x2="134" y2="376"></line>
            <circle class="luce-task-panel-lamp" cx="70" cy="7" r="2.7"></circle>
          </svg>
          <div class="luce-task-gauge luce-task-output">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle class="luce-task-bezel-outer" cx="60" cy="60" r="59"></circle>
              <circle class="luce-task-bezel" cx="60" cy="60" r="56"></circle>
              <circle class="luce-task-face" cx="60" cy="60" r="50"></circle>
              <path class="luce-task-glass-highlight" d="M27 46 A38 38 0 0 1 93 39"></path>
              <text class="luce-task-label" x="60" y="32">TASK TIME</text>
              <text class="luce-task-value luce-task-output-value" x="60" y="69">--</text>
              <text class="luce-task-meta luce-task-output-meta" x="60" y="89">NO RUNS</text>
            </svg>
          </div>
          <div class="luce-task-gauge luce-task-activity">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <defs><clipPath id="luce-task-activity-clip"><circle cx="60" cy="60" r="49"></circle></clipPath></defs>
              <circle class="luce-task-bezel-outer" cx="60" cy="60" r="59"></circle>
              <circle class="luce-task-bezel" cx="60" cy="60" r="56"></circle>
              <circle class="luce-task-face" cx="60" cy="60" r="50"></circle>
              <path class="luce-task-glass-highlight" d="M27 46 A38 38 0 0 1 93 39"></path>
              <g class="luce-task-activity-mechanics" clip-path="url(#luce-task-activity-clip)">
                <line class="luce-task-tick" x1="22" y1="60" x2="29" y2="60"></line>
                <line class="luce-task-tick" x1="33" y1="33" x2="38" y2="38"></line>
                <line class="luce-task-tick" x1="60" y1="22" x2="60" y2="29"></line>
                <line class="luce-task-tick" x1="87" y1="33" x2="82" y2="38"></line>
                <line class="luce-task-tick" x1="98" y1="60" x2="91" y2="60"></line>
                <line class="luce-task-needle" x1="60" y1="65" x2="60" y2="29"></line>
              </g>
              <circle class="luce-task-needle-hub" cx="60" cy="60" r="5"></circle>
              <circle class="luce-task-needle-pin" cx="60" cy="60" r="1.8"></circle>
              <text class="luce-task-label" x="60" y="19">ACTIVITY</text>
              <text class="luce-task-value luce-task-activity-value" x="60" y="91">IDLE</text>
              <text class="luce-task-meta luce-task-model-value" x="60" y="104"></text>
            </svg>
          </div>
          <div class="luce-task-gauge luce-task-context">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle class="luce-task-bezel-outer" cx="60" cy="60" r="59"></circle>
              <circle class="luce-task-bezel" cx="60" cy="60" r="56"></circle>
              <circle class="luce-task-face" cx="60" cy="60" r="50"></circle>
              <path class="luce-task-glass-highlight" d="M27 46 A38 38 0 0 1 93 39"></path>
              <circle class="luce-task-context-track" cx="60" cy="60" r="47" pathLength="100"></circle>
              <circle class="luce-task-context-progress" cx="60" cy="60" r="47" pathLength="100"></circle>
              <text class="luce-task-label" x="60" y="48">CONTEXT</text>
              <text class="luce-task-context-value" x="60" y="75">--</text>
            </svg>
          </div>
        </div>`;
      document.body.appendChild(layer);
      luceParts = null;
    }
    if (!luceParts || luceParts.layer !== layer) {
      luceParts = {
        layer,
        wallpaper: layer.querySelector(".luce-wallpaper-svg"),
        taskDock: layer.querySelector(".luce-task-dock"),
        needle: layer.querySelector(".luce-needle"),
        output: layer.querySelector(".luce-output-state"),
        outputMeta: layer.querySelector(".luce-output-meta"),
        activity: layer.querySelector(".luce-activity-state"),
        model: layer.querySelector(".luce-model-value"),
        context: layer.querySelector(".luce-context-value"),
        contextMeta: layer.querySelector(".luce-context-meta"),
        contextProgress: layer.querySelector(".luce-context-progress"),
        taskOutput: layer.querySelector(".luce-task-output-value"),
        taskOutputMeta: layer.querySelector(".luce-task-output-meta"),
        taskNeedle: layer.querySelector(".luce-task-needle"),
        taskActivity: layer.querySelector(".luce-task-activity-value"),
        taskModel: layer.querySelector(".luce-task-model-value"),
        taskContext: layer.querySelector(".luce-task-context-value"),
        taskContextProgress: layer.querySelector(".luce-task-context-progress"),
      };
    }
    return luceParts;
  };

  const setNeedleAngle = (node, cx, cy, tail, length, targetAngle) => {
    if (!node) return;
    const write = (angle) => {
      const radians = angle * Math.PI / 180;
      const sine = Math.sin(radians);
      const cosine = Math.cos(radians);
      node.setAttribute?.("x1", String(cx - sine * tail));
      node.setAttribute?.("y1", String(cy + cosine * tail));
      node.setAttribute?.("x2", String(cx + sine * length));
      node.setAttribute?.("y2", String(cy - cosine * length));
    };
    const previous = needleMotions.get(node);
    if (!previous || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      write(targetAngle);
      needleMotions.set(node, { angle: targetAngle, target: targetAngle, frame: null });
      return;
    }
    if (previous.target === targetAngle) return;
    if (previous.frame != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(previous.frame);
    }
    const motion = {
      angle: previous.angle,
      target: targetAngle,
      frame: null,
      startedAt: now(),
      startAngle: previous.angle,
    };
    const duration = 720;
    const tick = (timestamp) => {
      const progress = clamp((timestamp - motion.startedAt) / duration, 0, 1);
      const eased = 1 - (1 - progress) ** 4;
      motion.angle = motion.startAngle + (motion.target - motion.startAngle) * eased;
      write(motion.angle);
      if (progress < 1) motion.frame = requestAnimationFrame(tick);
      else motion.frame = null;
    };
    needleMotions.set(node, motion);
    motion.frame = requestAnimationFrame(tick);
  };

  const syncLuceLayer = (state) => {
    const parts = ensureLuceLayer();
    if (!parts) return;
    const width = window.innerWidth || document.documentElement?.clientWidth || 2560;
    const height = window.innerHeight || document.documentElement?.clientHeight || 1440;
    const scale = Math.max(width / 2560, height / 1440);
    const renderedWidth = 2560 * scale;
    const renderedHeight = 1440 * scale;
    const safeArea = document.documentElement?.getAttribute("data-dream-art-safe-area") || ART.safeArea;
    const positionX = safeArea === "left" ? 1 : safeArea === "right" ? 0 : (ART.focusX ?? 0.5);
    const positionY = ART.focusY ?? 0.5;
    const offsetX = (width - renderedWidth) * positionX;
    const offsetY = (height - renderedHeight) * positionY;
    parts.wallpaper.style.transform = `translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px) scale(${scale.toFixed(6)})`;
    setDatasetValue(parts.layer, "route", state.route.toLowerCase());
    setDatasetValue(parts.layer, "activity", state.activity.toLowerCase());
    const context = state.context;
    const taskRuntime = formatTaskRuntime(state.taskRuntime);
    setDatasetValue(parts.layer, "contextLevel", context == null ? "unknown" : context >= 90 ? "critical" : context >= 70 ? "high" : "normal");
    const needleAngles = { IDLE: -52, DRAFT: -22, READY: 0, RUNNING: 48 };
    const needleAngle = needleAngles[state.activity] ?? -52;
    setNeedleAngle(parts.needle, 1770, 690, 18, 120, needleAngle);
    setNeedleAngle(parts.taskNeedle, 60, 60, 5, 31, needleAngle);
    setTextContent(parts.output, taskRuntime.value);
    setTextContent(parts.outputMeta, taskRuntime.meta);
    setTextContent(parts.activity, state.activity);
    setTextContent(parts.model, state.model);
    setTextContent(parts.context, context == null ? "--" : `${Math.round(context)}%`);
    setTextContent(parts.contextMeta, context == null ? "UNAVAILABLE" : "NATIVE");
    setDomAttribute(parts.contextProgress, "stroke-dasharray", `${context ?? 0} 100`);
    setTextContent(parts.taskOutput, taskRuntime.value);
    setTextContent(parts.taskOutputMeta, taskRuntime.meta);
    setTextContent(parts.taskActivity, state.activity);
    setTextContent(parts.taskModel, state.model);
    setTextContent(parts.taskContext, context == null ? "--" : `${Math.round(context)}%`);
    setDomAttribute(parts.taskContextProgress, "stroke-dasharray", `${context ?? 0} 100`);

    const composer = document.querySelector(".composer-surface-chrome");
    const composerRect = composer?.getBoundingClientRect?.();
    const gutter = composerRect ? width - composerRect.right : 0;
    const dockTop = 76;
    const dockGap = 8;
    const availableHeight = composerRect ? composerRect.top - 24 - dockTop : 0;
    const maxDialByHeight = (availableHeight - dockGap * 2 - 16) / 3;
    const dialSize = Math.min(gutter - 32, maxDialByHeight, 132);
    const canPlaceTaskDock = state.route === "TASK" && gutter >= 110 && dialSize >= 78;
    setDatasetValue(parts.layer, "taskDock", canPlaceTaskDock ? "visible" : "hidden");
    if (canPlaceTaskDock) {
      const dockWidth = dialSize + 16;
      const dialLeft = composerRect.right + (gutter - dockWidth) / 2;
      const dockHeight = dialSize * 3 + dockGap * 2 + 16;
      parts.taskDock.style.left = `${dialLeft.toFixed(2)}px`;
      parts.taskDock.style.top = `${dockTop}px`;
      parts.taskDock.style.width = `${dockWidth.toFixed(2)}px`;
      parts.taskDock.style.height = `${dockHeight.toFixed(2)}px`;
      parts.taskDock.style.setProperty?.("--luce-task-dial-size", `${dialSize.toFixed(2)}px`);
    }
  };

  const LUCE_GEOMETRY = luceGeometry && typeof luceGeometry === "object"
    ? luceGeometry
    : { home: { width: 2560, height: 1440 }, task: { width: 640, height: 1840 } };

  const prefersReducedMotion = () => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  };

  const formatDurationMs = (value) => {
    if (!Number.isFinite(value) || value < 0) return "--";
    const seconds = Math.floor(value / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours >= 100) return `${Math.floor(hours / 24)}D`;
    if (hours > 0) return `${hours}H ${String(minutes).padStart(2, "0")}`;
    return `${minutes}M ${String(seconds % 60).padStart(2, "0")}`;
  };

  const formatTokenCount = (value) => {
    if (!Number.isFinite(value) || value < 0) return "--";
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 1 : 2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
    return String(Math.round(value));
  };

  const animateMetric = (node, target, formatter) => {
    if (!node) return;
    if (!Number.isFinite(target)) {
      const previousMotion = valueMotions.get(node);
      if (previousMotion?.frame != null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(previousMotion.frame);
      }
      valueMotions.delete(node);
      setTextContent(node, "--");
      return;
    }
    const previous = valueMotions.get(node);
    if (!previous || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      setTextContent(node, formatter(target));
      valueMotions.set(node, { value: target, target, frame: null });
      return;
    }
    if (previous.target === target) return;
    if (previous.frame != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(previous.frame);
    const motion = {
      value: previous.value,
      target,
      startValue: previous.value,
      startedAt: now(),
      frame: null,
    };
    const tick = (timestamp) => {
      const progress = clamp((timestamp - motion.startedAt) / 680, 0, 1);
      const eased = 1 - (1 - progress) ** 4;
      motion.value = motion.startValue + (motion.target - motion.startValue) * eased;
      setTextContent(node, formatter(motion.value));
      if (progress < 1) motion.frame = requestAnimationFrame(tick);
      else motion.frame = null;
    };
    valueMotions.set(node, motion);
    motion.frame = requestAnimationFrame(tick);
  };

  const clearRuntimeClock = (node) => {
    const clock = runtimeClocks.get(node);
    if (clock?.timer != null) clearTimeout(clock.timer);
    runtimeClocks.delete(node);
  };

  const scheduleRuntimeTick = (node, clock) => {
    if (!clock.running || clock.timer != null) return;
    const current = clock.anchorRuntime + Math.max(0, Date.now() - clock.anchorAt);
    const remainder = ((current % 1000) + 1000) % 1000;
    const delay = Math.max(80, 1000 - remainder + 16);
    clock.timer = setTimeout(() => {
      clock.timer = null;
      if (!clock.running || runtimeClocks.get(node) !== clock) return;
      const value = clock.anchorRuntime + Math.max(0, Date.now() - clock.anchorAt);
      setTextContent(node, formatDurationMs(value));
      scheduleRuntimeTick(node, clock);
    }, delay);
  };

  /* Runtime is a clock, not a quantity to tween. Anchor it to each truthful
     metrics snapshot, then advance locally on exact second boundaries while
     Codex reports an active turn. */
  const syncRuntimeClock = (node, target, updatedAt, running, scopeId) => {
    if (!node) return;
    if (!Number.isFinite(target)) {
      clearRuntimeClock(node);
      setTextContent(node, "--");
      return;
    }
    const timestamp = Date.now();
    const snapshotAt = Number.isFinite(updatedAt) ? Math.min(timestamp, updatedAt) : timestamp;
    const projected = target + (running ? Math.max(0, timestamp - snapshotAt) : 0);
    const scope = String(scopeId || "");
    let clock = runtimeClocks.get(node);
    if (!clock || clock.scopeId !== scope) {
      if (clock?.timer != null) clearTimeout(clock.timer);
      clock = { anchorRuntime: projected, anchorAt: timestamp, running, timer: null, scopeId: scope };
      runtimeClocks.set(node, clock);
    } else {
      const current = clock.anchorRuntime + (clock.running ? Math.max(0, timestamp - clock.anchorAt) : 0);
      clock.anchorRuntime = running ? Math.max(projected, current) : target;
      clock.anchorAt = timestamp;
      clock.running = running;
    }
    setTextContent(node, formatDurationMs(clock.anchorRuntime));
    if (running) scheduleRuntimeTick(node, clock);
    else if (clock.timer != null) {
      clearTimeout(clock.timer);
      clock.timer = null;
    }
  };

  const ensureLuceLayerV3 = () => {
    let layer = document.getElementById(LUCE_LAYER_ID);
    if (!IS_CODEX_LUCE) {
      layer?.remove();
      luceParts = null;
      return null;
    }
    if (!layer || layer.parentElement !== document.body || layer.dataset?.schema !== LUCE_LAYER_SCHEMA) {
      clearRuntimeClock(luceParts?.taskRuntime);
      layer?.remove();
      layer = document.createElement("div");
      layer.id = LUCE_LAYER_ID;
      layer.dataset.schema = LUCE_LAYER_SCHEMA;
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = `
        <svg class="luce-wallpaper-svg luce-wallpaper-svg-v3" viewBox="0 0 2560 1440" width="2560" height="1440" aria-hidden="true">
          <defs>
            <clipPath id="luce-v3-week-runtime"><circle cx="1316" cy="664" r="154"></circle></clipPath>
            <clipPath id="luce-v3-week-tokens"><circle cx="1740" cy="668" r="174"></circle></clipPath>
            <clipPath id="luce-v3-week-left"><circle cx="2196" cy="692" r="166"></circle></clipPath>
          </defs>
          <g class="luce-v3-gauge" clip-path="url(#luce-v3-week-runtime)">
            <text class="luce-v3-label" x="1316" y="610">WEEK RUNTIME</text>
            <text class="luce-v3-value luce-v3-week-runtime" x="1316" y="698">--</text>
          </g>
          <g class="luce-v3-gauge" clip-path="url(#luce-v3-week-tokens)">
            <text class="luce-v3-label" x="1740" y="610">WEEK TOKENS</text>
            <text class="luce-v3-value luce-v3-week-tokens" x="1740" y="698">--</text>
          </g>
          <g class="luce-v3-gauge luce-v3-quota" clip-path="url(#luce-v3-week-left)">
            <text class="luce-v3-label" x="2196" y="604">WEEK LEFT</text>
            <path class="luce-v3-arc" d="M2079 735 A126 126 0 0 1 2313 735"></path>
            <g class="luce-v3-ticks">
              <line x1="2088" y1="735" x2="2106" y2="728"></line>
              <line x1="2132" y1="594" x2="2142" y2="610"></line>
              <line x1="2196" y1="566" x2="2196" y2="586"></line>
              <line x1="2260" y1="594" x2="2250" y2="610"></line>
              <line x1="2304" y1="735" x2="2286" y2="728"></line>
            </g>
            <line class="luce-v3-needle luce-v3-week-needle" x1="2196" y1="712" x2="2196" y2="572"></line>
            <circle class="luce-v3-hub" cx="2196" cy="692" r="15"></circle>
            <circle class="luce-v3-pin" cx="2196" cy="692" r="5"></circle>
            <text class="luce-v3-percent luce-v3-week-left" x="2196" y="806">--</text>
          </g>
        </svg>
        <div class="luce-task-dock luce-task-dock-v3" aria-hidden="true">
          <svg class="luce-task-svg-v3" viewBox="0 0 640 1840" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <clipPath id="luce-v3-task-runtime-clip"><circle cx="320" cy="424" r="146"></circle></clipPath>
              <clipPath id="luce-v3-task-tokens-clip"><circle cx="328" cy="864" r="150"></circle></clipPath>
              <clipPath id="luce-v3-task-left-clip"><circle cx="328" cy="1304" r="150"></circle></clipPath>
            </defs>
            <g class="luce-v3-task-gauge" clip-path="url(#luce-v3-task-runtime-clip)">
              <text class="luce-v3-task-label" x="320" y="376">TASK RUNTIME</text>
              <text class="luce-v3-task-value luce-v3-task-runtime" x="320" y="458">--</text>
            </g>
            <g class="luce-v3-task-gauge" clip-path="url(#luce-v3-task-tokens-clip)">
              <text class="luce-v3-task-label" x="328" y="816">TASK TOKENS</text>
              <text class="luce-v3-task-value luce-v3-task-tokens" x="328" y="898">--</text>
            </g>
            <g class="luce-v3-task-gauge luce-v3-task-quota" clip-path="url(#luce-v3-task-left-clip)">
              <text class="luce-v3-task-label" x="328" y="1238">WEEK LEFT</text>
              <path class="luce-v3-task-arc" d="M202 1346 A132 132 0 0 1 454 1346"></path>
              <g class="luce-v3-task-ticks">
                <line x1="210" y1="1344" x2="232" y2="1334"></line>
                <line x1="264" y1="1200" x2="276" y2="1220"></line>
                <line x1="328" y1="1174" x2="328" y2="1198"></line>
                <line x1="392" y1="1200" x2="380" y2="1220"></line>
                <line x1="446" y1="1344" x2="424" y2="1334"></line>
              </g>
              <line class="luce-v3-needle luce-v3-task-needle" x1="328" y1="1322" x2="328" y2="1180"></line>
              <circle class="luce-v3-hub" cx="328" cy="1304" r="18"></circle>
              <circle class="luce-v3-pin" cx="328" cy="1304" r="6"></circle>
              <text class="luce-v3-task-percent luce-v3-task-left" x="328" y="1422">--</text>
            </g>
          </svg>
        </div>`;
      document.body.appendChild(layer);
      luceParts = null;
    }
    if (!luceParts || luceParts.layer !== layer || !luceParts.weekRuntime) {
      luceParts = {
        layer,
        wallpaper: layer.querySelector(".luce-wallpaper-svg-v3"),
        taskDock: layer.querySelector(".luce-task-dock-v3"),
        weekRuntime: layer.querySelector(".luce-v3-week-runtime"),
        weekTokens: layer.querySelector(".luce-v3-week-tokens"),
        weekLeft: layer.querySelector(".luce-v3-week-left"),
        weekNeedle: layer.querySelector(".luce-v3-week-needle"),
        taskRuntime: layer.querySelector(".luce-v3-task-runtime"),
        taskTokens: layer.querySelector(".luce-v3-task-tokens"),
        taskLeft: layer.querySelector(".luce-v3-task-left"),
        taskNeedle: layer.querySelector(".luce-v3-task-needle"),
      };
    }
    return luceParts;
  };

  const isNativeSidePanelOpen = () => {
    const toggles = document.querySelectorAll('button[aria-label="Toggle side panel"]');
    return [...toggles].some((button) => button.getAttribute?.("aria-pressed") === "true");
  };

  const syncLuceLayerV3 = (state, { layout = false } = {}) => {
    const parts = ensureLuceLayerV3();
    if (!parts) return;
    const width = window.innerWidth || document.documentElement?.clientWidth || 2560;
    const height = window.innerHeight || document.documentElement?.clientHeight || 1440;
    const scale = Math.max(width / LUCE_GEOMETRY.home.width, height / LUCE_GEOMETRY.home.height);
    const renderedWidth = LUCE_GEOMETRY.home.width * scale;
    const renderedHeight = LUCE_GEOMETRY.home.height * scale;
    const positionX = clamp(ART.focusX ?? 0.76, 0, 1);
    const positionY = clamp(ART.focusY ?? 0.44, 0, 1);
    const offsetX = (width - renderedWidth) * positionX;
    const offsetY = (height - renderedHeight) * positionY;
    setStyleProperty(parts.wallpaper, "transform", `translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px) scale(${scale.toFixed(6)})`);
    setDatasetValue(parts.layer, "route", state.route.toLowerCase());

    const snapshot = metricsSnapshot && typeof metricsSnapshot === "object" ? metricsSnapshot : null;
    const week = snapshot?.week || {};
    const task = snapshot?.task || {};
    const available = snapshot && snapshot.stale !== true;
    const runtime = available ? finite(week.runtimeMs) : null;
    const tokens = available ? finite(week.totalTokens) : null;
    const taskRuntime = available ? finite(task.runtimeMs) : null;
    const taskTokens = available ? finite(task.totalTokens) : null;
    const remaining = available ? finite(week.remainingPercent) : null;
    const quotaLevel = remaining == null ? "unknown" : remaining < 5 ? "critical" : remaining < 20 ? "warning" : "normal";
    setDatasetValue(parts.layer, "quotaLevel", quotaLevel);
    setDatasetValue(parts.layer, "metricsStale", snapshot?.stale ? "true" : "false");

    animateMetric(parts.weekRuntime, runtime, formatDurationMs);
    animateMetric(parts.weekTokens, tokens, formatTokenCount);
    syncRuntimeClock(
      parts.taskRuntime,
      taskRuntime,
      finite(snapshot?.updatedAt),
      state.activity === "RUNNING",
      task.id,
    );
    animateMetric(parts.taskTokens, taskTokens, formatTokenCount);
    animateMetric(parts.weekLeft, remaining, (value) => `${Math.round(value)}%`);
    animateMetric(parts.taskLeft, remaining, (value) => `${Math.round(value)}%`);
    const angle = remaining == null ? -120 : clamp(-120 + remaining * 2.4, -120, 120);
    setNeedleAngle(parts.weekNeedle, 2196, 692, 20, 120, angle);
    setNeedleAngle(parts.taskNeedle, 328, 1304, 18, 122, angle);

    const sidePanelOpen = isNativeSidePanelOpen();
    const layoutKey = `${state.route}:${width}x${height}`;
    if (layout || !luceLayoutCache || luceLayoutCache.key !== layoutKey) {
      const composer = document.querySelector(".composer-surface-chrome");
      const composerRect = composer?.getBoundingClientRect?.();
      const gutter = composerRect ? width - composerRect.right : 0;
      const dockTop = 58;
      const availableHeight = composerRect ? Math.max(0, composerRect.top - dockTop - 18) : 0;
      const dockWidth = Math.min(gutter - 18, availableHeight * 640 / 1840, 176);
      const dockHeight = dockWidth * 1840 / 640;
      luceLayoutCache = {
        key: layoutKey,
        canFitTaskDock: dockWidth >= 92 && dockHeight <= availableHeight + 1,
        left: composerRect ? composerRect.right + (gutter - dockWidth) / 2 : 0,
        top: dockTop + Math.max(0, (availableHeight - dockHeight) / 2),
        dockWidth,
        dockHeight,
      };
    }
    const canPlaceTaskDock = state.route === "TASK" && !sidePanelOpen && luceLayoutCache.canFitTaskDock;
    setDatasetValue(parts.layer, "sidePanel", sidePanelOpen ? "open" : "closed");
    setDatasetValue(parts.layer, "taskDock", canPlaceTaskDock ? "visible" : "hidden");
    if (canPlaceTaskDock) {
      setStyleProperty(parts.taskDock, "left", `${luceLayoutCache.left.toFixed(2)}px`);
      setStyleProperty(parts.taskDock, "top", `${luceLayoutCache.top.toFixed(2)}px`);
      setStyleProperty(parts.taskDock, "width", `${luceLayoutCache.dockWidth.toFixed(2)}px`);
      setStyleProperty(parts.taskDock, "height", `${luceLayoutCache.dockHeight.toFixed(2)}px`);
    }
  };

  const syncRouteState = (shell, { layout = false } = {}) => {
    metrics.routePasses += 1;
    const root = document.documentElement;
    if (!root) return;
    shell ||= root.getAttribute(SHELL_ATTR) || resolvedShell();
    const shellMain = document.querySelector("main.main-surface") || document.querySelector("main");
    const homeIndicator = document.querySelector('[data-testid="home-icon"]');
    const home = homeIndicator?.closest('[role="main"]') ||
      [...document.querySelectorAll('[role="main"]')].find((candidate) =>
        candidate.querySelector('[data-feature="game-source"]') &&
        candidate.querySelector('.group\\\\/home-suggestions')) || null;
    for (const candidate of document.querySelectorAll('[role="main"].dream-skin-home')) {
      if (candidate !== home) setClassToken(candidate, "dream-skin-home", false);
    }
    if (home) setClassToken(home, "dream-skin-home", true);
    const homeUtilityBars = new Set(home
      ? home.querySelectorAll('[class*="_homeUtilityBar_"]')
      : []);
    for (const candidate of document.querySelectorAll(".dream-skin-home-utility")) {
      if (!homeUtilityBars.has(candidate)) setClassToken(candidate, "dream-skin-home-utility", false);
    }
    for (const candidate of homeUtilityBars) setClassToken(candidate, "dream-skin-home-utility", true);

    if (!shellMain || !document.body) {
      const utilityParts = ensureLuceLayerV3();
      if (utilityParts) {
        setDatasetValue(utilityParts.layer, "route", "utility");
        setDatasetValue(utilityParts.layer, "taskDock", "hidden");
      }
      return;
    }
    if (observedShellMain !== shellMain) {
      resizeObserver?.disconnect();
      resizeObserver?.observe(shellMain);
      observedShellMain = shellMain;
      layout = true;
    }
    setClassToken(shellMain, "dream-skin-home-shell", Boolean(home));
    let chrome = document.getElementById(CHROME_ID);
    let created = false;
    const hasExpectedChrome = chrome?.dataset?.instrumented === String(WANTS_INSTRUMENTATION);
    if (!chrome || chrome.parentElement !== document.body || !hasExpectedChrome) {
      chrome?.remove();
      chrome = document.createElement("div");
      chrome.id = CHROME_ID;
      chrome.setAttribute("aria-hidden", "true");
      chrome.dataset.instrumented = String(WANTS_INSTRUMENTATION);
      if (WANTS_INSTRUMENTATION) {
        chrome.innerHTML = `
          <div class="dream-skin-instruments">
            <div class="dream-skin-instrument dream-skin-instrument-route"><small>ROUTE</small><b></b></div>
            <div class="dream-skin-instrument dream-skin-instrument-model"><small>MODEL</small><b></b></div>
            <div class="dream-skin-instrument dream-skin-instrument-activity"><i></i><small>ACTIVITY</small><b></b></div>
          </div>`;
      } else {
        chrome.innerHTML = `
          <div class="dream-skin-brand">
            <span class="dream-skin-portal-mark">◉</span>
            <span><b></b><small></small></span>
          </div>
          <div class="dream-skin-status"><i></i><span></span></div>
          <div class="dream-skin-quote"></div>
          <div class="dream-skin-particles"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="dream-skin-orbit"></div>`;
      }
      document.body.appendChild(chrome);
      created = true;
      chromeParts = null;
    }
    if (!chromeParts || chromeParts.chrome !== chrome) {
      chromeParts = WANTS_INSTRUMENTATION ? {
        chrome,
        route: chrome.querySelector(".dream-skin-instrument-route b"),
        model: chrome.querySelector(".dream-skin-instrument-model b"),
        activity: chrome.querySelector(".dream-skin-instrument-activity b"),
      } : {
        chrome,
        name: chrome.querySelector(".dream-skin-brand b"),
        subtitle: chrome.querySelector(".dream-skin-brand small"),
        status: chrome.querySelector(".dream-skin-status span"),
        quote: chrome.querySelector(".dream-skin-quote"),
      };
    }
    if (WANTS_INSTRUMENTATION) {
      actualState = {
        route: home ? "HOME" : "TASK",
        model: "",
        activity: readNativeActivity(),
        metrics: metricsSnapshot,
      };
      setTextContent(chromeParts.route, actualState.route);
      setTextContent(chromeParts.model, actualState.model);
      setTextContent(chromeParts.activity, actualState.activity);
      if (chrome.dataset.activity !== actualState.activity.toLowerCase()) {
        setDatasetValue(chrome, "activity", actualState.activity.toLowerCase());
      }
      if (window[STATE_KEY]) window[STATE_KEY].actual = actualState;
      const routeChanged = lastRoute !== actualState.route;
      if (routeChanged) {
        lastRoute = actualState.route;
        layout = true;
      }
      syncLuceLayerV3(actualState, { layout });
    } else {
      setTextContent(chromeParts.name, THEME.name || "Codex Dream Skin");
      setTextContent(chromeParts.subtitle, THEME.brandSubtitle || "CODEX DREAM SKIN");
      setTextContent(chromeParts.status, THEME.statusText || "DREAM SKIN ONLINE");
      setTextContent(chromeParts.quote, THEME.quote || "MAKE SOMETHING WONDERFUL");
    }
    if (layout || created) {
      metrics.layoutReads += 1;
      const shellBox = shellMain.getBoundingClientRect();
      setStyleProperty(chrome, "left", `${Math.round(shellBox.left)}px`);
      setStyleProperty(chrome, "top", `${Math.round(shellBox.top)}px`);
      setStyleProperty(chrome, "width", `${Math.round(shellBox.width)}px`);
      setStyleProperty(chrome, "height", `${Math.round(shellBox.height)}px`);
    }
    setClassToken(chrome, "dream-skin-home-shell", Boolean(home));
    setDatasetValue(chrome, "dreamShell", shell);
  };

  const ensure = ({ root: rootPass = true, route = true, layout = true } = {}) => {
    if (window[DISABLED_KEY]) return;
    const root = document.documentElement;
    if (!root) return;
    metrics.ensureCalls += 1;
    const shell = rootPass ? applyRootState(root) : null;
    if (route) syncRouteState(shell, { layout });
  };

  const cleanup = () => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken) return false;
    window[DISABLED_KEY] = true;
    document.documentElement?.classList.remove("codex-dream-skin");
    document.documentElement?.removeAttribute(SHELL_ATTR);
    document.documentElement?.removeAttribute(THEME_ATTR);
    for (const name of ART_ATTRS) document.documentElement?.removeAttribute(name);
    document.documentElement?.style.removeProperty("--dream-skin-art");
    for (const name of THEME_VARIABLES) document.documentElement?.style.removeProperty(name);
    document.querySelectorAll(".dream-skin-home").forEach((node) => node.classList.remove("dream-skin-home"));
    document.querySelectorAll(".dream-skin-home-shell").forEach((node) => node.classList.remove("dream-skin-home-shell"));
    document.querySelectorAll(".dream-skin-home-utility").forEach((node) => node.classList.remove("dream-skin-home-utility"));
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CHROME_ID)?.remove();
    document.getElementById(LUCE_LAYER_ID)?.remove();
    for (const motion of needleMotions.values()) {
      if (motion.frame != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(motion.frame);
    }
    needleMotions.clear();
    for (const motion of valueMotions.values()) {
      if (motion.frame != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(motion.frame);
    }
    valueMotions.clear();
    for (const clock of runtimeClocks.values()) {
      if (clock.timer != null) clearTimeout(clock.timer);
    }
    runtimeClocks.clear();
    state?.observer?.disconnect();
    state?.rootObserver?.disconnect();
    state?.resizeObserver?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
    if (state?.scheduler?.frame != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(state.scheduler.frame);
    }
    if (analysisTimer) clearTimeout(analysisTimer);
    if (state?.resizeHandler) window.removeEventListener("resize", state.resizeHandler);
    if (state?.mediaHandler && state?.mediaQuery) {
      try { state.mediaQuery.removeEventListener("change", state.mediaHandler); } catch {}
    }
    if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
    delete window[STATE_KEY];
    return true;
  };

  const skinClassSignature = (value) => String(value || "")
    .split(/\s+/)
    .filter((token) => token && token !== "codex-dream-skin")
    .sort()
    .join(" ");
  const isSkinNode = (node) => {
    if (!node || node === document.documentElement || node === document.body) return false;
    if (node.id === STYLE_ID || node.id === CHROME_ID || node.id === LUCE_LAYER_ID) return true;
    if (typeof node.closest === "function") {
      return Boolean(node.closest(`#${STYLE_ID}, #${CHROME_ID}, #${LUCE_LAYER_ID}`));
    }
    let cursor = node.parentElement;
    while (cursor) {
      if (cursor.id === STYLE_ID || cursor.id === CHROME_ID || cursor.id === LUCE_LAYER_ID) return true;
      cursor = cursor.parentElement;
    }
    return false;
  };
  const mutationNodes = (record) => [
    ...Array.from(record.addedNodes || []),
    ...Array.from(record.removedNodes || []),
  ].filter((node) => node && node.nodeType !== 3);
  const mutationIsSkinOnly = (record) => {
    if (isSkinNode(record.target)) return true;
    const nodes = mutationNodes(record);
    return nodes.length > 0 && nodes.every(isSkinNode);
  };
  const nativeMutationIntent = (records) => {
    if (!records?.length) return { layout: false };
    let hasNativeMutation = false;
    for (const record of records) {
      if (mutationIsSkinOnly(record)) continue;
      hasNativeMutation = true;
    }
    return hasNativeMutation ? { layout: false } : null;
  };
  const rootMutationChangedNativeState = (records) => {
    if (!records?.length) return true;
    for (const record of records) {
      if (mutationIsSkinOnly(record)) continue;
      const target = record.target;
      const name = record.attributeName;
      if (name === "class") {
        if (skinClassSignature(record.oldValue) === skinClassSignature(target?.className)) continue;
        return true;
      }
      const current = target?.getAttribute?.(name) ?? "";
      if (record.oldValue != null && String(record.oldValue) === String(current)) continue;
      return true;
    }
    return false;
  };

  const scheduler = { timeout: null, frame: null, root: false, route: false, layout: false };
  const flushScheduledEnsure = () => {
    if (scheduler.frame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(scheduler.frame);
    }
    if (scheduler.timeout) clearTimeout(scheduler.timeout);
    scheduler.frame = null;
    scheduler.timeout = null;
    const pending = { root: scheduler.root, route: scheduler.route, layout: scheduler.layout };
    scheduler.root = false;
    scheduler.route = false;
    scheduler.layout = false;
    ensure(pending);
  };
  const scheduleEnsure = ({ root = false, route = true, layout = false, throttleMs = 0 } = {}) => {
    scheduler.root ||= root;
    scheduler.route ||= route;
    scheduler.layout ||= layout;
    if (scheduler.timeout || scheduler.frame !== null) return;
    if (throttleMs > 0) {
      scheduler.timeout = setTimeout(flushScheduledEnsure, throttleMs);
    } else if (typeof requestAnimationFrame === "function") {
      scheduler.frame = requestAnimationFrame(flushScheduledEnsure);
      scheduler.timeout = setTimeout(flushScheduledEnsure, 96);
    } else {
      scheduler.timeout = setTimeout(flushScheduledEnsure, 64);
    }
  };
  const observer = new MutationObserver((records) => {
    const intent = nativeMutationIntent(records);
    if (!intent) return;
    scheduleEnsure({ route: true, layout: intent.layout, throttleMs: ROUTE_MUTATION_THROTTLE_MS });
  });
  rootObserver = new MutationObserver((records) => {
    if (samplingNativeShell || !rootMutationChangedNativeState(records)) return;
    scheduleEnsure({ root: true, route: true });
  });
  const resizeHandler = () => scheduleEnsure({ route: true, layout: true });
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => scheduleEnsure({ route: true, layout: true }));
  }

  let mediaQuery = null;
  let mediaHandler = null;
  try {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaHandler = () => scheduleEnsure({ root: true, route: true });
  } catch {}

  window[STATE_KEY] = {
    ensure,
    cleanup,
    observer,
    rootObserver,
    resizeObserver,
    timer: null,
    scheduler,
    resizeHandler,
    mediaQuery,
    mediaHandler,
    artUrl,
    installToken,
    analysis: artAnalysis,
    artMetadata: ART_METADATA,
    metrics,
    runtimeClocks,
    version: VERSION,
    themeId: THEME.id || "custom",
    actual: actualState,
    setMetrics(snapshot) {
      metricsSnapshot = snapshot && typeof snapshot === "object" ? snapshot : null;
      this.actual = this.actual ? { ...this.actual, metrics: metricsSnapshot } : this.actual;
      scheduleEnsure({ route: true, layout: false });
    },
    detectShellMode,
  };
  const firstEnsureStartedAt = now();
  ensure({ layout: !previous || !document.getElementById(CHROME_ID) });
  metrics.firstEnsureMs = Number((now() - firstEnsureStartedAt).toFixed(3));
  if (previous?.artUrl && previous.artUrl !== artUrl) URL.revokeObjectURL(previous.artUrl);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-pressed", "data-state"],
  });
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["class", "data-theme", "data-appearance", "data-color-mode", "style"],
  });
  if (document.body) {
    rootObserver.observe(document.body, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["class", "data-theme", "data-appearance", "data-color-mode", "style"],
    });
  }
  const timer = setInterval(() => ensure({ root: true, route: true, layout: false }), FALLBACK_REFRESH_MS);
  window[STATE_KEY].timer = timer;
  window.addEventListener("resize", resizeHandler, { passive: true });
  if (mediaHandler && mediaQuery) {
    mediaQuery.addEventListener("change", mediaHandler);
  }
  const analysisPromise = artAnalysis ? Promise.resolve(null) : analyzeArt();
  window[STATE_KEY].analysisTimer = analysisTimer;
  analysisPromise.then((analysis) => {
    const state = window[STATE_KEY];
    if (!analysis || state?.installToken !== installToken || window[DISABLED_KEY]) return;
    artAnalysis = analysis;
    state.analysis = analysis;
    if (typeof THEME.artKey === "string") {
      analysisCache.set(THEME.artKey, analysis);
      while (analysisCache.size > 8) analysisCache.delete(analysisCache.keys().next().value);
    }
    ensure({ root: true, route: false, layout: false });
  }).catch(() => {});
  return {
    installed: true,
    version: VERSION,
    themeId: THEME.id || "custom",
    shell: resolvedShell(),
    analysis: artAnalysis,
  };
})(__DREAM_SKIN_CSS_JSON__, __DREAM_SKIN_ART_JSON__, __LUCE_TASK_CHASSIS_JSON__, __DREAM_SKIN_THEME_JSON__, __LUCE_GEOMETRY_JSON__)
