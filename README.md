# Shan Shui for VS Code

A lightweight, endlessly scrolling ink landscape behind the **actual bottom status bar**. Every window launch or reload gets a fresh random seed.

Version **1.1.0** replaces the expensive full-size SVG renderer with small canvas tiles designed for a 22-pixel status bar. Mountains and trees use the same scale in both directions.

## Remove version 1.0 first

1. Run **Shan Shui: Restore Original Status Bar** from the Command Palette.
2. Reload, then **close every VS Code window** to release the old renderer.
3. Reopen VS Code and uninstall **Shan Shui** from Extensions.

If you already uninstalled it, install the new VSIX temporarily and run Restore; it also removes the old 1.0 patch. Disabling/uninstalling an extension alone cannot remove an existing workbench customization.

## Install 1.1.0

1. [Download shan-shui-statusbar-1.1.0.vsix](https://github.com/ElyesBradai/shan-shui-inf-for-VSCode/raw/refs/heads/master/releases/shan-shui-statusbar-1.1.0.vsix).
2. In VS Code choose **Extensions → … → Install from VSIX…**.
3. Run **Shan Shui: Enable / Repair Landscape** and choose **Reload Window**.

Keep **View → Appearance → Status Bar** enabled. By default, scrolling pauses when the window loses focus or your operating system requests reduced motion.

## Resource use

- No SVG documents, image decoders, blobs, workers, or stored scene geometry.
- Only the visible 256-pixel tiles are cached. Evicted canvas buffers are explicitly zeroed.
- At a 1920 × 22 status bar and 2× display scaling, the display and tile buffers total **under 1.5 MiB**. This is backing-buffer accounting, not a promise about total VS Code process memory or browser overhead.
- Default **20 FPS**, with no timer or animation callback running while paused.
- Both axes scale equally; the scene is drawn for the status bar's height rather than squeezing a tall painting.
- No observer on the editor's full DOM tree.
- Offline, zero runtime dependencies, no telemetry.

## Commands and settings

| Command | Action |
| --- | --- |
| **Enable / Repair Landscape** | Install or apply settings, then reload. |
| **Restore Original Status Bar** | Remove the patch, then reload. Run before uninstalling. |
| **New Random Landscape** | Reload with a new seed. |
| **Settings** | Open the extension settings. |

All commands start with **Shan Shui:**.

| Setting | Default | Range / behavior |
| --- | --- | --- |
| `shanShui.speed` | `6` | 0–80 pixels/second; 0 pauses. |
| `shanShui.opacity` | `0.85` | 0.1–1. |
| `shanShui.maxFPS` | `20` | 10–30. |
| `shanShui.pauseWhenUnfocused` | `true` | Pause while another window has focus. |
| `shanShui.respectReducedMotion` | `true` | Honor the OS motion preference. |

Choose **Apply** and **Reload Window** after changing settings. Existing user settings are preserved on upgrade; reset `shanShui.speed` and `shanShui.maxFPS` to use the new defaults.

## Desktop customization

VS Code's supported API does not expose native status-bar images. This extension uses a **reversible, unsupported desktop workbench patch**. It backs up `workbench.html` and adds local script/style references. Version 1.1 leaves the Content Security Policy unchanged and removes the old worker policy when upgrading.

A writable **desktop VS Code 1.96+** installation is required. Windows User Setup or a user-owned Linux archive is suitable; macOS application files must be writable. Install the extension locally when using SSH/WSL/containers. VS Code for the Web and read-only installations are unsupported. No administrator privileges are requested.

VS Code can show a **modified/corrupt installation** warning. The extension does not hide integrity checks. Updates can replace the patch; previously enabled installations are repaired on startup and prompt for a reload. Future changes to VS Code's internal UI may require an extension update. Reload every affected window after applying or restoring the patch.

If VS Code cannot open: close all its windows, locate `resources/app/out/vs/code/electron-browser/workbench/` (older versions: `electron-sandbox`), replace `workbench.html` with its sibling `workbench.html.shan-shui-original` backup, and remove `shan-shui-assets`. If other customizers changed the file after the backup, reinstall VS Code for a clean application installation.

## Development

Node.js 20+; no build or dependency installation is required:

```sh
npm test
npm run package
```

The VSIX is written to `artifacts/`. F5 launches an Extension Development Host; use a disposable VS Code installation because enabling patches that installation.

Optional integration tests:

```sh
npm install --no-save --package-lock=false playwright@1 @vscode/test-electron@2
npx playwright install chromium
npm run test:browser
npm run test:electron
```

Use `xvfb-run -a npm run test:electron` on headless Linux. [CI](https://github.com/ElyesBradai/shan-shui-inf-for-VSCode/actions) checks official VSIX packaging, native desktop rendering, command activation, fresh seeds, resizing, clicks, reduced motion, and a 5,000-tile browser stress run. The stress test checks JS heap growth, retained DOM nodes, bounded raster buffers, and Linux renderer RSS growth; its JSON report and screenshots are uploaded with the package.

## Origin and license

Inspired by [Lingdong Huang's Shan Shui](https://github.com/LingDong-/shan-shui-inf). The original full-page generator and demo assets were removed from the current extension to keep it small; they remain in Git history. The original [MIT license](LICENSE) is retained.
