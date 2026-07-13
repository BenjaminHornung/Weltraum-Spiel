# Browser UI Concept Parity

## Requirements

### Flight HUD Parity

- The normal product URL `/` must show a player-facing flight HUD closer to `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png`.
- The layout must include a left ship-status stack, bottom-left radar/minimap, right target/autopilot/navigation stack, top mode/status affordance, and clear center flight area.
- Speed, thrust/throttle, fuel, RCS/SAS, objective, selected target, route/action, and warnings/status must remain readable.
- The Demo Scout GLB must remain visible and the center safe area must not be covered by opaque HUD panels.

### Navigation Planner Parity

- A normal-runtime player-facing navigation planner must be openable without TestBridge.
- The planner must show a dominant route/map area, selected target and distance, waypoint/route visualization, route detail/timeline panel, profile controls, and Engage action.
- It must use existing runtime targets/route preview data and must not become renderer truth.

### Combat/Contact Presentation

- A combat/contact HUD shell must be available for parity evidence.
- If real combat/contact runtime data is missing, the shell may be scoped to an explicit presentation scenario such as `?uiScenario=combat-contact`.
- Presentation-only contacts must not appear as default gameplay truth on `/`.

### Evidence And Verification

- Playwright must capture real browser screenshots at concept/regression viewports.
- `apps/weltraum-browser/tests/e2e/ui-concept-parity.spec.ts` must verify DOM/layout structure instead of relying on pixel-perfect image comparisons.
- Evidence must include an audit report, final parity report, generated screenshots, and a JSON layout report.
- Existing live flight, objective, objective-chain, proving-ground, flight UI, unit, and build verification must pass before completion.

## Constraints

- Do not edit `Assets/**`, package files, or lockfiles.
- Do not expose TestBridge by default or use it for the parity flow.
- Do not weaken flight/autopilot invariants or objective progression.
- Do not add heavy visual-diff dependencies.
