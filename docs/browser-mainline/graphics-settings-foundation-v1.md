# Browser Graphics Settings Foundation V1

## Purpose

This foundation gives the browser mainline a versioned player-preference contract and a narrow presentation adapter. The renderer remains a projection of canonical runtime state and never becomes world truth.

## Stable contract

- Storage key: `weltraum.browser.graphics-settings`
- Schema: version 1 with strict fail-closed decoding
- Default: compatibility-oriented High
- Quality presets: Low, Medium, High, Ultra, and derived Custom
- Personal values outside preset ownership: FOV, FPS limit, fullscreen preference
- Draft flow: Apply persists/applies, Cancel discards, Reset stages High defaults

## Runtime application

Live settings are render scale/max DPR, FOV, camera-only render distance, FPS presentation limit, tone mapping, exposure, supported anisotropy, and explicitly render-only decor density. Anti-aliasing is applied during renderer construction and may require a page reload. VSync and Fullscreen remain browser-managed.

The current scene has no effective shadow chain or post-processing pipeline. Shadows are Planned, bloom/motion are Unsupported, and environment/reflection plus texture asset variants are future capabilities. Desired values may be preserved, but unavailable effects are never reported as applied.

## Safety boundary

Graphics settings never change simulation cadence, ship state, fuel, route, plan hash, world residency, detection, canonical navigation entities, or telemetry truth. FPS limiting gates only the final draw. Render distance changes only the perspective camera. Decor scaling touches only objects explicitly marked render-only.

## UI and evidence

The Graphics dialog is player-facing, accessible, modal, and mutually exclusive with the Navigation Planner. It blocks manual flight/camera controls while simulation continues. Normal Playwright tests use `/` without TestBridge and inspect only visible UI plus presentation-safe canvas metadata. Exact gameplay non-mutation is proven through immutable snapshot unit tests.
