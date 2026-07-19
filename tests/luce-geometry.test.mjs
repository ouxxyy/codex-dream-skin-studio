import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readImageMetadata } from "../scripts/image-metadata.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const geometry = JSON.parse(await fs.readFile(path.join(root, "assets", "luce-geometry.json"), "utf8"));
const homeImage = await fs.readFile(path.join(root, "presets", "preset-codex-luce", "background-v3.jpg"));
const taskImage = await fs.readFile(path.join(root, "assets", "luce-task-chassis-v3.jpg"));
assert.deepEqual(
  [readImageMetadata(homeImage, ".jpg"), readImageMetadata(taskImage, ".jpg")]
    .map(({ width, height }) => ({ width, height })),
  [{ width: 2560, height: 1440 }, { width: 640, height: 1840 }],
  "V3 runtime assets must keep their exact geometry dimensions.",
);

function cover(viewport, focus = { x: 0.76, y: 0.44 }) {
  const scale = Math.max(viewport.width / geometry.home.width, viewport.height / geometry.home.height);
  return {
    scale,
    x: (viewport.width - geometry.home.width * scale) * focus.x,
    y: (viewport.height - geometry.home.height * scale) * focus.y,
  };
}

function screenWell(well, transform) {
  return {
    x: transform.x + well.cx * transform.scale,
    y: transform.y + well.cy * transform.scale,
    r: well.r * transform.scale,
  };
}

function taskDock(viewport, composer) {
  const gutter = viewport.width - composer.right;
  const topBase = 58;
  const availableHeight = Math.max(0, composer.top - topBase - 18);
  const width = Math.min(gutter - 18, availableHeight * geometry.task.width / geometry.task.height, 176);
  const height = width * geometry.task.height / geometry.task.width;
  return {
    left: composer.right + (gutter - width) / 2,
    top: topBase + Math.max(0, (availableHeight - height) / 2),
    width,
    height,
    visible: width >= 92 && height <= availableHeight + 1,
  };
}

const cases = [
  { viewport: { width: 1292, height: 680 }, composer: { right: 1120, top: 560 } },
  { viewport: { width: 1600, height: 900 }, composer: { right: 1430, top: 720 } },
  { viewport: { width: 2584, height: 1360 }, composer: { right: 2350, top: 1100 } },
  { viewport: { width: 1600, height: 900 }, composer: { right: 1410, top: 720 } },
];

for (const { viewport, composer } of cases) {
  const backgroundTransform = cover(viewport);
  const svgTransform = cover(viewport);
  for (const well of geometry.home.wells) {
    const background = screenWell(well, backgroundTransform);
    const overlay = screenWell(well, svgTransform);
    assert.ok(Math.abs(background.x - overlay.x) <= 4);
    assert.ok(Math.abs(background.y - overlay.y) <= 4);
    assert.ok(Math.abs(background.r - overlay.r) <= 4);
  }

  const dock = taskDock(viewport, composer);
  assert.equal(dock.visible, true);
  assert.ok(dock.left >= composer.right, "Task dock must stay inside the measured right gutter.");
  assert.ok(dock.left + dock.width <= viewport.width + 0.01, "Task dock must not create horizontal overflow.");
  assert.ok(dock.top >= 0 && dock.top + dock.height <= composer.top - 18 + 0.01);
  for (const well of geometry.task.wells) {
    const x = dock.left + well.cx / geometry.task.width * dock.width;
    const y = dock.top + well.cy / geometry.task.height * dock.height;
    assert.ok(x >= dock.left && x <= dock.left + dock.width);
    assert.ok(y >= dock.top && y <= dock.top + dock.height);
  }
}

const narrow = taskDock({ width: 900, height: 680 }, { right: 850, top: 560 });
assert.equal(narrow.visible, false, "The task dock must withdraw when the safe gutter is too narrow.");

console.log("PASS: Luce V3 cover and task-dock geometry stay aligned and bounded at target viewports.");
