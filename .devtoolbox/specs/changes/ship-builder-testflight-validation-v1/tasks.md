# Tasks: Ship Builder Test-Flight Validation v1

This change is planning/spec-only. These tasks describe future implementation
slices that should consume the design package.

## Phase 1 - Test-flight entry

- [ ] Add a future Test Flight path that runs after builder data validation.
- [ ] Block normal test flight when hard builder validation errors exist.
- [ ] Allow debug-only launches for negative ships with an explicit `DebugOnly`
  result that cannot activate a ship.
- [ ] Keep test-flight ships temporary until saved and accepted.

## Phase 2 - BuilderTestFlightRange

- [ ] Create an isolated `BuilderTestFlightRange` concept with known spawn state,
  simple target dummy, simple marker/obstacle, and deterministic reset.
- [ ] Keep the range independent from autopilot, planets, economy, final art,
  multiplayer, and mission framework systems.
- [ ] Start ships with known fuel, cargo, velocity, control mode, RCS, SAS, and
  weapon state.

## Phase 3 - Automated checklist

- [ ] Measure main-thrust forward acceleration, yaw, pitch, roll, RCS translation
  by axis, fuel decrease, finite physics, mass/inertia validity, camera framing,
  and return-to-builder behavior.
- [ ] Validate weapon muzzle origin, projectile origin, muzzle flash origin,
  turret arc limits, target tracking, and recoil handling for combat ships.
- [ ] Validate main thruster VFX, RCS particles, turret pivots, camera bounds,
  missing socket warnings, unbound functional parts, and no root fallback markers.

## Phase 4 - Scenario categories

- [ ] Add future acceptance scenarios for minimal valid ship, combat-capable ship,
  cargo ship, RCS maneuver ship, bad negative ships, and visual/VFX binding.
- [ ] Keep scenarios role-aware so ships only run checks that match their
  installed capability.
- [ ] Verify negative ships are blocked before normal test flight unless debug
  override is active.

## Phase 5 - Evidence

- [ ] Capture builder valid-state screenshot, test-flight screenshot, VFX firing
  screenshot, turret tracking screenshot, and short CSV/markdown summary.
- [ ] Store evidence under the implementing DevToolbox change's `tests/` folder.
- [ ] Report pass, warning, fail, or debug-only result with failure reasons.

## Phase 6 - Activation gate

- [ ] Allow activation only after data validation passes, applicable test-flight
  acceptance passes, functional bindings are complete, and the player saves and
  explicitly sets the variant active.
- [ ] Keep warnings visible when activation is allowed with non-blocking caveats.
- [ ] Ensure test-flight acceptance does not depend on final art quality.
