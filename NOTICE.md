# Notices

Codex Dream Skin Studio is an unofficial customization project and is not affiliated with, endorsed by, or sponsored by OpenAI.

## Software License

The MIT License in `LICENSE` applies to the software source code in this repository, including shell scripts, JavaScript modules, CSS, tests, and documentation.

It does not grant rights to:

- OpenAI or Codex trademarks, product names, logos, or trade dress
- Official Codex or ChatGPT desktop application binaries
- `.app` bundles, `app.asar`, or any signed OpenAI application files
- User-supplied images or third-party artwork added by downstream users
- Character likenesses, franchise art, celebrity imagery, or copyrighted screenshots

## Bundled Assets

The public repository only includes abstract or project-owned demo assets. They are intended to demonstrate the theme system and can be replaced by the user.

Do not redistribute images that you do not own or have permission to share. Pull requests that add presets should use original, licensed, public-domain, or procedurally generated assets.

## Runtime

This project does not redistribute Node.js. At runtime it validates and uses the Node.js executable already signed and bundled inside the user's official Codex or ChatGPT desktop application.

## Security Model

Themes are applied through Chromium DevTools Protocol on loopback only. While a themed session is running, treat the local debugging port as sensitive and do not run untrusted local software that could attach to it.

Use the Restore launcher or `scripts/restore-dream-skin-macos.sh` to stop the injector and restore the original appearance.
