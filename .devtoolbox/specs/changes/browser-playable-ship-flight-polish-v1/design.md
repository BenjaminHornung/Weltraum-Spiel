# Design: Browser Playable Ship Flight Polish v1

## Approach

This is a narrow follow-up to the playable-flight slice. It should improve presentation and evidence without changing the gameplay model.

## GLB handling

The Demo Scout GLB is treated as an optional browser asset candidate. The implementation must first validate it read-only from `unity-legacy-final-2026-07:Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb` (header/size/basic path). A copy to `apps/weltraum-browser/public/ships/demo_scout_mk1.glb` is allowed only if it does not mutate `unity-legacy-final-2026-07:Assets/**` and does not introduce fragile asynchronous loader behavior that would weaken the current deterministic E2E path.

If integration is deferred, the procedural visual remains the runtime source of truth for this slice, and evidence records the reason. This is preferable to adding a brittle loader or losing required marker descriptors.

## Descriptor validation

Future authored assets need stable attachment points. The current procedural ship already defines marker-like descriptors; this change hardens them with tests and render snapshot metadata rather than relying on screenshots alone.

## HUD polish

The player HUD should remain player-facing. The scalar speed belongs in the HUD; raw world-frame velocity components are diagnostic and should remain in telemetry/TestBridge only. The help hint should explicitly call out desktop keyboard/mouse manual flight and mobile target/autopilot-only behavior.

## VFX polish

Main flame visibility is already telemetry-driven. Scaling should use acceleration magnitude so off-axis thrust does not collapse to the base scale just because world-X acceleration is small.

## Verification strategy

Use existing unit tests and E2E paths. Add focused tests for descriptor markers, HUD velocity text, visual source snapshot, and VFX scale if practical. Preserve known Playwright fallback documentation: default bundled Chromium may fail with `browserType.launch: spawn UNKNOWN`, while Chrome executable fallback is acceptable evidence.
