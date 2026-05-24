# Design - player-hud-live-aspect-ratio-scaling-v1

## Decision

Extend the existing live PlayMode HUD evidence path instead of adding another manual screenshot workflow. The current `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests` already builds the real `PrototypeBootstrap` runtime, drives navigation, combat, docking, and help states through runtime components, and captures RenderTexture screenshots at explicit dimensions.

## Evidence Strategy

The new slice adds a second PlayMode evidence test that writes to `.devtoolbox/specs/changes/player-hud-live-aspect-ratio-scaling-v1/tests/screenshots/`. It captures representative states at:

- `2560x1080` ultrawide.
- `1440x900` 16:10.
- `900x1600` portrait.
- `640x480` minimum supported.

Each capture forces the HUD layout to the requested dimensions before rendering to a matching `RenderTexture`, then asserts the screenshot exists, is nontrivial, and contains varied pixels.

## Layout Assertions

Live assertions reuse the existing fixed-panel overlap checks and add canvas-containment checks so a panel cannot pass by sliding offscreen. Active navigation and combat control rows are also checked against their context panel when present.

## Tradeoffs

This is a proof and hardening slice, not a redesign. If the matrix exposes a layout failure, the renderer will be patched minimally in the existing responsive layout code. Deferred concept items such as builder UI, mission reward screens, and remapping remain out of scope unless their gameplay systems exist.
