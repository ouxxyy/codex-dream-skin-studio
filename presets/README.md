# Preset Packs

This folder contains bundled Codex Dream Skin presets. During install, `install-dream-skin-macos.sh` seeds every `preset-*/` directory into:

```text
~/Library/Application Support/CodexDreamSkinStudio/themes/
```

Seeded presets are available from the menu bar or:

```bash
~/.codex/codex-dream-skin-studio/scripts/switch-theme-macos.sh --id preset-midnight-aurora
```

## Pack Structure

```text
preset-<slug>/
├── theme.json
└── background.jpg
```

Rules:

- Directory name and `theme.json` id must both use `preset-<slug>`.
- `image` must point to a file in the same preset directory.
- Supported images: png, jpg, jpeg, webp.
- Prepared images must be under 16 MB, max 16384 px per side, max 50 megapixels.
- Prefer `2560 x 1440` for a 16:9 master image.
- Keep the left side calm enough for native Codex content.
- Do not use screenshots that already include UI, text, logos, watermarks, or window chrome.

## Asset Policy

Bundled presets are redistributed with the repository, so only include assets you can legally share:

- Original artwork
- Licensed artwork that allows redistribution
- CC0 or public-domain assets
- Procedurally generated abstract backgrounds

Do not add:

- Celebrity or influencer likenesses
- Copyrighted anime, game, film, or TV characters
- Screenshots from products you do not have permission to redistribute
- Customer, task, project, or local machine data

By contributing a preset, you confirm that the asset can be redistributed with this open-source project.

## Procedural Presets

`generate-presets.mjs` creates deterministic abstract backgrounds with Node.js and macOS `sips`. It has no third-party npm dependencies.

To regenerate:

```bash
node presets/generate-presets.mjs
```

Before submitting changes:

```bash
node scripts/injector.mjs --check-payload --theme-dir presets/preset-<slug>/
npm test
```
