# Changelog

## 1.2.0

- Add layered distant, foreground, and detail rendering for depth.
- Add parallax motion between landscape layers.
- Add atmospheric mist and restrained ink hatching.
- Add seeded pagodas, boats, and bridges as rare foreground landmarks.
- Soften existing status-bar labels with translucent backgrounds so they remain readable without completely blocking the artwork.
- Raster atmospheric layers at 1× on high-DPR displays while keeping foreground details at native display DPR.
- Update documentation with the new renderer architecture and visual preview.

## 1.1.0

- Replace 22–28 MiB SVG tiles and tens of thousands of shapes per tile with native canvas scenery.
- Remove the SVG worker, image decoding, blob URLs, full-workbench DOM observer and extraction build.
- Draw mountains and trees with equal horizontal/vertical scale at the status bar's actual height.
- Cache only visible tiles and explicitly release discarded canvas backing stores.
- Limit default animation to 20 FPS and cancel all scheduled rendering while paused.
- Remove the original web demo, unused screenshots, old custom-domain file and obsolete packaged installer.
- Preserve 1.0 restore/upgrade compatibility; remove its worker Trusted Types policy.
- Add sustained browser memory checks and native desktop integration coverage.

## 1.0.0

Initial native status-bar adaptation. Superseded because its full-size SVG pipeline used excessive memory and distorted the artwork.
