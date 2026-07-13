# Design: Browser Graphics Settings Foundation V1

## Data flow

1. `main.ts` loads and strictly validates `weltraum.browser.graphics-settings` before renderer construction.
2. The desired anti-aliasing value is passed into `WebGLRenderer`; all live settings are applied through a narrow Three.js adapter after construction.
3. A controller owns confirmed, draft, runtime, capability, pending, and restart-required state. The UI receives immutable view models and sends commands.
4. Apply validates and persists before applying supported runtime fields. Cancel discards the draft. Reset stages High defaults only.

## Schema and presets

The storage envelope is `{ schemaVersion: 1, settings }`. Unknown, malformed, non-finite, out-of-range, or future-version payloads fail closed to defaults without throwing or overwriting storage at startup.

High is the compatibility default: render scale 1, max DPR 2, FOV 58, render distance 5000, uncapped presentation, windowed preference, AA on, no tone mapping, exposure 1, and decor density 1.

| Setting | Low | Medium | High | Ultra |
| --- | ---: | ---: | ---: | ---: |
| Render scale | 0.65 | 0.8 | 1 | 1.25 |
| Max DPR | 1 | 1.5 | 2 | 2 |
| Render distance | 1500 | 3000 | 5000 | 10000 |
| Shadows | Off | Low | Medium | High |
| Anisotropy | 1x | 2x | min(4x, max) | max |
| Tone mapping / exposure | None / 0.85 | Reinhard / 0.95 | None / 1 | ACES / 1 |
| Decor density | 0.35 | 0.65 | 1 | 1 |
| Bloom / motion preference | off / off | off / off | off / off | on / on |
| Anti-aliasing | off | on | on | on |

Presets own quality/performance fields only. FOV, FPS limit, and fullscreen are personal preferences. Changing a preset-owned field derives `Custom`; changing a personal field preserves the selected quality preset.

## Capability truth

- `SupportedLive`: scale/DPR, FOV, camera far plane, FPS presentation gate, tone mapping, exposure, decor density, and anisotropy when supported.
- `SupportedAfterRendererRestart`: anti-aliasing; desired and actual values remain separate until reload.
- `BrowserManaged`: VSync and available Fullscreen. Fullscreen is requested only from a changed preference during the Apply user gesture.
- `Planned`: current shadow chain, environment/reflection quality, texture-size/mip/asset variants.
- `Unsupported`: bloom and motion effects without a post-processing pipeline.

Shadow policies are deterministic: Off=`disabled/0/Never`, Low=`Basic/512/OnDemand`, Medium=`PCF/1024/OnDemand`, High=`PCFSoft/2048/EveryFrame`. They are not reported as applied when no effective light/caster/receiver chain exists.

## Renderer boundary

Effective pixel ratio is `min(devicePixelRatio, maxDpr) * renderScale`, additionally capped by renderer maximum texture size for the current CSS dimensions. Resize reuses the confirmed settings.

FOV and render distance update only the active perspective camera and projection matrix. Decor scaling touches only explicitly tagged scalable `renderOnly` objects. Async ship textures receive anisotropy after the visual leaves `Loading`. The FPS scheduler gates only `renderer.render`; RAF, input, telemetry, HUD, and simulation continue normally.

Canvas `data-graphics-*` attributes expose presentation-safe applied values for normal tests. No gameplay coordinates, IDs, truth snapshots, or normal window bridge are added.

## UI and input

The player HUD exposes a secondary Settings action and a native modal Graphics dialog. It uses the established navy/cyan visual language, green Applied, amber Restart Required, muted Unsupported/Planned, visible focus, focus trap, inert background, Escape/Back semantics, and opener focus restoration.

Planner and Settings dialogs cannot stack. Opening Settings neutralizes held manual axes and blocks flight/camera controls without pausing simulation. Apply keeps the dialog open so status is visible; Cancel, Escape, and Back discard pending changes and close.
