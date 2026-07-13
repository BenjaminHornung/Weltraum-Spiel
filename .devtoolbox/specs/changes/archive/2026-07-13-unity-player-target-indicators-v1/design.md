# Design

## Reuse strategy

The change extends `PrototypePlayerHudSnapshotBuilder` and the existing Screen Space Overlay canvas. It should not create a second HUD, an IMGUI path, or world-space marker prefabs. The existing radar snapshot already collects most target candidates, and the existing `PrototypePlayerHudOverlayGraphic` already draws reticle geometry without allocations-heavy UI objects.

## Data model

Add a compact target-indicator model near the other Player HUD snapshots:

- `PrototypePlayerTargetIndicatorKind`
- `PrototypePlayerTargetIndicator`
- `PrototypePlayerTargetIndicatorSnapshot`

Each indicator carries kind, label, world position, optional status text, severity, health fraction, distance behavior, and whether it is selected. The snapshot is part of `PrototypePlayerHudSnapshot`.

## Candidate rules

- Selected combat target: highest visual priority, combat bracket, health/status label.
- Active docking context: docking ring/diamond and approach status near the docking port.
- Selected navigation target: navigation diamond and distance label.
- Active arena objectives: small objective diamonds, capped to a low count to avoid clutter.
- Offscreen indicators: clamp to a safe viewport edge and draw an arrow/edge cue instead of placing text under fixed panels.

If a combat target and arena objective resolve to the same transform/position, show the selected combat indicator once rather than duplicating markers.

## Projection and layout

Projection belongs in `PrototypePlayerHudRenderer`, because it owns the camera and the overlay canvas dimensions. The snapshot stores world data; the renderer creates lightweight screen-space projections each refresh and passes them to the overlay graphic and a small label pool.

The indicator safe rect leaves margins for top strip, radar, objective panel, context panel, system panel, and bottom bar. On narrow/short screens, labels are hidden before they overlap fixed HUD panels; geometry remains clamped inside the safe rect.

## Render behavior

- Navigation: cyan diamond with distance label.
- Combat: bracket with severity color, range/weapon status, health tick/bar if available.
- Docking: blue square/ring cue and approach label only when docking context is active.
- Objective: compact amber/white diamond, no large text unless selected/contextual.
- Offscreen: edge arrow/chevron in the same kind color, with optional short distance label.

Keep strokes simple and functional; no glow, animated flourish, or decorative card treatment.

## Verification

Tests cover snapshot contents, projection behavior for onscreen/offscreen/behind-camera targets, label pool bounds, and responsive safe-area behavior. Runtime verification captures a Unity Game View screenshot in the real scene after compilation and focused HUD tests pass.
