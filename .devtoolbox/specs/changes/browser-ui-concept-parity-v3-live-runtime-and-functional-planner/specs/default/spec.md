# Capability: Live Concept Flight Surface and Functional Runtime Planner

## Requirements

### Authoritative player surface

- Normal `/` MUST use a semantic flight surface and the concept-quality player HUD.
- `?uiScenario=flight-cruise-concept` MUST be a compatibility alias to the same live flight surface.
- `?uiScenario=combat-contact` MUST remain the only combat surface.
- `debugHud=1` and `testBridge=1` MUST remain independent opt-ins.
- Normal player mode MUST keep the live WebGL canvas opaque and changing, hide raw debug strips/helpers, and retain gameplay input outside the planner.

### Runtime-owned presentation

- Target, route, fuel, speed, warnings, ETA, objectives, autopilot, radar, and planner values MUST derive from telemetry or plans.
- CSS pseudo-content and decorative art MUST NOT substitute semantic values, routes, obstacles, or named bodies.
- Credits and reputation MUST remain hidden until runtime systems exist.
- The HUD MUST support idle, selected, preview-ready, executing, holding, and blocked states with one valid contextual action.

### Preview and lock correctness

- Route profiles MUST be Safe, Balanced, and Fast; Balanced is the default.
- Player planning MUST use obstacle-aware planning, which may return direct segments when clear.
- Target/profile changes MAY auto-create an unlocked preview.
- Preview MUST reuse a fresh preview or compute one; Replan MUST recompute while unlocked.
- Target/profile/replan changes MUST be rejected while locked.
- Cancel MUST preserve the previous preview, mark it stale, and MUST NOT replan.
- Engage MUST receive the expected visible plan hash, validate the stored preview, and lock that exact plan with no planner call.
- Tick age alone MUST NOT make a preview stale.
- Lock admission MUST reject missing/stale previews, hash mismatch, existing lock, target/profile/planner/environment/authority/relevant ship-state changes, invalid continuity, excessive first-segment start distance, and failed exact route/flight admission.
- First-segment start tolerance MUST be `max(1 metre, clearanceRadius * 0.1)`.
- `fuelCostEstimate` MUST remain presentation-only.

### Functional planner

- Profiles, Preview, Replan, Focus, Orbit, Zoom, Engage, and Close MUST be semantic buttons.
- The planner MUST be modal, trap and restore focus, make the background inert, close on Escape without commands, continue simulation/autopilot, and gate manual flight/camera input.
- Engage failure MUST keep the planner open and focus a visible `aria-live` error.
- Engage success MUST close the planner and restore focus to the flight HUD.
- The map MUST project runtime X/Z geometry, include ship/target/segments/obstacle radii with 12% padding, handle degenerate axes and zero-length segments, preserve straight route segments, and persist view state.
- Focus resets fit-all; Orbit toggles north-up/ship-up; Zoom cycles 1.0/1.25/1.6.

## Acceptance Scenarios

1. Normal `/` shows live WebGL with the concept flight HUD and no TestBridge/debug strips.
2. Target -> profile -> preview -> replan -> Engage locks the visible hash and progresses through the existing executor.
3. Locked, stale, and hash-mismatch actions fail visibly without recomputation.
4. Escape/Close preserves route state; keyboard map controls change measurable view state.
5. Flight, planner, and combat pass fresh side-by-side Product Design comparison with no actionable P0/P1/P2 findings.
6. Existing live-flight, objective, terminal capture, final speed/distance, planHash, and multi-obstacle invariants remain passing.
