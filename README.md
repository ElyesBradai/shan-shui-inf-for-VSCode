# Shan Shui for VS Code

An infinitely generated Chinese ink landscape scrolling across the **actual bottom status bar**, behind its normal controls. Every window launch or reload starts with a fresh random seed. Scenery is generated continuously; this is not a looping wallpaper.

Based on [Lingdong Huang's Shan Shui](https://github.com/LingDong-/shan-shui-inf). The original browser artwork remains in `index.html`.

## Install

1. [Download shan-shui-statusbar-1.0.0.vsix](https://github.com/ElyesBradai/shan-shui-inf-for-VSCode/raw/refs/heads/master/releases/shan-shui-statusbar-1.0.0.vsix).
2. In desktop VS Code, open **Extensions → … → Install from VSIX…** and select the downloaded file.
3. Open the Command Palette (`Ctrl+Shift+P` on Windows/Linux, `Cmd+Shift+P` on macOS). Run **Shan Shui: Enable / Repair Landscape** and accept the installation notice.
4. Click **Reload Window**. The landscape starts automatically on future launches.

Keep **View → Appearance → Status Bar** enabled. Default speed is a gentle 8 pixels/second. By default, motion pauses while another application has focus and honors your operating system's reduced-motion preference. Change these settings if you want it moving while unfocused.

Alternatively, with the VS Code CLI available:

```sh
code --install-extension shan-shui-statusbar-1.0.0.vsix
```

Then run the enable command and reload as above.

## How this integrates with VS Code

VS Code's [supported extension API](https://code.visualstudio.com/api/extension-capabilities/overview#restrictions) does not allow images or arbitrary HTML in its native status bar. This extension therefore uses an **unsupported, reversible desktop workbench customization**. It saves a backup of `workbench.html`, adds local script/style references, and authorizes one narrowly scoped Trusted Types policy for its worker. It does not disable the Content Security Policy or alter VS Code's integrity checks.

- VS Code may show an **installation appears to be corrupt / modified** warning because its workbench was customized. Restoring the original status bar reverses this customization. Other installed customizers may independently cause the same warning.
- This requires **desktop VS Code 1.96+ with a writable installation**. Windows User Setup and a user-owned Linux archive are convenient options. A macOS installation must be writable. Read-only/Snap/system-managed installations can reject the change; the extension explains the permission error and never elevates itself.
- The extension runs locally (`extensionKind: ui`) when using desktop VS Code with SSH, WSL or containers. Install it on the **local** side. VS Code for the Web is unsupported.
- VS Code updates can replace the customization. When previously enabled, the extension reapplies it and asks you to reload. If a future VS Code changes its internal layout, use Restore and report the version; compatibility with arbitrary future internal changes cannot be guaranteed.
- The customization affects windows of the same VS Code installation. Settings apply when you enable/repair and reload the affected windows. Windows each use their own seed. The extension does not modify workspace settings.

## Commands and settings

| Command | Action |
| --- | --- |
| **Shan Shui: Enable / Repair Landscape** | Install, repair after updates, or apply settings; then reload. |
| **Shan Shui: Restore Original Status Bar** | Remove the customization and restore the native bar; then reload. |
| **Shan Shui: New Random Landscape** | Reload the window with new randomly generated scenery. |
| **Shan Shui: Settings** | Open the extension's settings. |

| Setting | Default | Description |
| --- | --- | --- |
| `shanShui.speed` | `8` | Pixels/second, 0–80; `0` pauses. |
| `shanShui.opacity` | `0.85` | Artwork opacity, 0.1–1. Labels retain a solid background for readability. |
| `shanShui.maxFPS` | `30` | Frame cap, 10–60. |
| `shanShui.pauseWhenUnfocused` | `true` | Pause when the window loses focus. |
| `shanShui.respectReducedMotion` | `true` | Honor the operating system's reduced-motion setting. |

After editing a setting, choose **Apply** and **Reload Window**, or run Enable / Repair manually. There is intentionally no fixed seed setting: every launch/reload is random.

## Remove or recover

**Run Restore Original Status Bar and reload before disabling or uninstalling this extension.** Disabling an extension alone cannot undo an already applied workbench customization. The restore command removes only this extension's marked HTML block and policy entry, preserving unrelated customizations. If the workbench has not otherwise changed, the saved file is restored byte-for-byte.

If VS Code cannot open, close it and locate its `resources/app/out/vs/code/electron-browser/workbench/` directory (some versions use `electron-sandbox`). Replace `workbench.html` with the sibling **`workbench.html.shan-shui-original`** backup and delete the `shan-shui-assets` folder. If other customizers changed the file after that backup, reinstalling VS Code is the clean recovery route; your projects are separate from the application files.

## Performance and privacy

The original SVG drawing engine runs in a dedicated worker, separate from the editor UI. The display rasterizes generated tiles and scrolls a small canvas with `requestAnimationFrame`. New scenery is prefetched; old tiles, drawing objects and planner cells are discarded. If rendering falls behind, scrolling waits for the next tile rather than exposing an empty gap. Hidden windows stop animation. Status bar height, commands, hover behavior and clicks remain available.

The extension works offline. It has no runtime dependencies, telemetry, network requests, or external images. It never overrides the workbench's `Math.random`; the drawing engine has its own seeded generator.

## Build and test

Node.js 20+ is sufficient; no dependency installation is needed for the build or core tests:

```sh
npm test
npm run package
```

The VSIX appears in `artifacts/`. `npm run build` extracts the upstream drawing code from `index.html` and combines it with the isolated worker adapter. Press F5 to run the extension in an Extension Development Host. **Enabling there customizes that VS Code installation too; use a disposable installation for development.**

Core tests execute the real generator for 35 sequential tiles and verify seed behavior, valid SVG, bounded caches, install/repair/restore, update handling, locking and CSP preservation. Browser and real desktop tests run in [GitHub Actions](https://github.com/ElyesBradai/shan-shui-inf-for-VSCode/actions) and can be run locally with optional test tools:

```sh
npm install --no-save --package-lock=false playwright@1 @vscode/test-electron@2
npx playwright install chromium
npm run test:browser
npm run test:electron
```

On headless Linux use `xvfb-run -a npm run test:electron`. The desktop test downloads a disposable VS Code, installs the packaged VSIX using its CLI, verifies extension commands, checks actual status bar rendering/scrolling via Chromium debugging, and restores the test installation. CI also validates packaging with Microsoft's `@vscode/vsce` and uploads the VSIX and screenshots.

## Attribution

Original landscape algorithms and browser demo: **Lingdong Huang**, copyright 2018, [MIT License](LICENSE). The generator includes its upstream Perlin noise attribution to Processing/p5.js. This adaptation retains the original license and artwork source.
