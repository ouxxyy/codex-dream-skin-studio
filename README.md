# Codex Dream Skin Studio

Unofficial macOS theme studio for the official Codex Desktop app.

把喜欢的背景图变成一套可交互的 Codex 桌面皮肤。它通过本机 loopback CDP 注入主题层，不修改官方 `.app`、`app.asar` 或代码签名；恢复时可以回到 Codex 原始外观。

> Not affiliated with OpenAI. Codex and OpenAI are trademarks of their respective owners.

## 适用环境

- macOS on Apple Silicon or Intel Mac
- Official Codex Desktop installed and launched at least once
- `~/.codex/config.toml` already exists
- No third-party npm packages required

This repo intentionally has no runtime npm dependencies. The installer validates and uses the Node.js executable bundled with the signed official Codex/ChatGPT desktop app, so users do not need to install a global Node.js just to use the skin.

## 一键安装

```bash
git clone https://github.com/ouxxyy/codex-dream-skin-studio.git
cd codex-dream-skin-studio

# Optional: run the local safety checks first.
npm test

# Close Codex, then install the engine and Desktop launchers.
./scripts/install-dream-skin-macos.sh --no-launch

# Start the themed Codex session.
./scripts/start-dream-skin-macos.sh
```

The installer creates these stable local paths:

| Item | Path |
| --- | --- |
| Engine | `~/.codex/codex-dream-skin-studio` |
| State, logs, custom images | `~/Library/Application Support/CodexDreamSkinStudio` |
| Desktop launchers | `~/Desktop/Codex Dream Skin*.command` |

Desktop launchers created after install:

- `Codex Dream Skin.command`: start or re-apply the skin
- `Codex Dream Skin - Customize.command`: choose your own background image
- `Codex Dream Skin - Verify.command`: verify runtime health and save a screenshot
- `Codex Dream Skin - Restore.command`: stop the injector and restore original Codex appearance

## 切换内置主题

```bash
~/.codex/codex-dream-skin-studio/scripts/switch-theme-macos.sh --id preset-midnight-aurora
~/.codex/codex-dream-skin-studio/scripts/switch-theme-macos.sh --id preset-codex-luce
```

Bundled presets live under [`presets/`](./presets/). The public repository only includes abstract or project-owned assets. Personal task screenshots, local rollout records, customer delivery prompts, and private reference materials are not included.

## 使用自己的图片

```bash
~/.codex/codex-dream-skin-studio/scripts/customize-theme-macos.sh
```

Recommended image rules:

- PNG, JPEG, HEIC, TIFF, or WebP
- Source image under 50 MB
- Prepared theme image under 16 MB, max 16384 px per side, max 50 megapixels
- `2560 x 1440` is a good master size
- Keep the left half calm and low contrast for Codex native content
- Do not use screenshots that already include UI, text, window chrome, logos, or watermarks

Advanced CLI example:

```bash
~/.codex/codex-dream-skin-studio/scripts/load-image-theme-macos.sh \
  --file "/path/to/image.png" \
  --appearance auto \
  --focus-x 0.72 \
  --focus-y 0.45 \
  --safe-area left \
  --task-mode banner
```

## Menu Bar

SwiftBar users can install a menu bar control for apply, pause, import, and switch actions:

```bash
./Install\ Menu\ Bar.command
```

Look for `Skin` in the top-right menu bar after SwiftBar loads the plugin.

## Verify And Restore

```bash
npm test
./scripts/doctor-macos.sh
./scripts/restore-dream-skin-macos.sh --restore-base-theme --restart-codex
```

`npm test` checks shell syntax, JavaScript syntax, bundled preset validity, renderer behavior, config backup/restore safety, theme staging, menu bar escaping, and injector identity guards.

## Privacy Boundary

This project is designed to avoid shipping local user data:

- No Codex task content is committed.
- No local rollout logs, screenshots, backups, or Application Support state are committed.
- No API keys, tokens, cookies, or model-provider configuration are needed.
- The theme image analysis runs locally in the Codex renderer Canvas.
- CDP binds to `127.0.0.1`; treat that local debugging port as sensitive while the themed session is running.

When contributing, keep private files out of the repo. The `.gitignore` blocks common local state, logs, archives, screenshots, and environment files.

## Build A Release ZIP

```bash
./scripts/build-release.sh
```

The archive is written to `release/codex-dream-skin-studio-v<version>.zip` with a `SHA256SUMS.txt` file.

## About 欧八同学

全网同名：**欧八同学**

这里是关于 AI 时代职业成长、副业探索和个人实践复盘的长期记录分享。

8 年产品经理，经历过网易、搜狐、MINISO，也是国家三级心理咨询师。

I share:

- AI 时代的职业选择思路
- 真实使用的 AI 工具方法
- 副业探索记录

Follow on X: [@albertouoo](https://x.com/albertouoo?s=11)

关注公众号：

<p align="center">
  <img src="./assets/community/wechat-qrcode.jpg" alt="欧八同学公众号二维码" width="220">
</p>

## License

MIT - see [`LICENSE`](./LICENSE). Additional notices in [`NOTICE.md`](./NOTICE.md) cover trademarks, runtime boundaries, and bundled assets.
