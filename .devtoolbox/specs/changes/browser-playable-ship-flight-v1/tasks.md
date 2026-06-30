# browser-playable-ship-flight-v1 Tasks

## Status

- [x] Task 1 implementation slice: procedural low-poly ship fallback used; GLB candidate verified read-only but not copied/used; no `Assets/**` mutation.
- [x] Task 2 implementation slice: Flight State V2 and shared `applyFlightControllerStep` actuator controller foundation implemented.
- [x] Task 3 implementation slice: manual controls, HUD keybind help and camera modes implemented.
- [x] Task 4 implementation slice: telemetry-driven main-thruster and RCS/SAS VFX implemented.
- [x] Task 5 implementation slice: autopilot actuator/no-snap refactor implemented.
- [x] Task 6 docs/evidence slice: `browser-playable-ship-flight-v1` evidence and browser-mainline docs updated from implementation-lane facts.
- [ ] Review remaining docs/evidence against the final diff.
- [ ] Commit the completed bounded slice after review/verification.

## Task 1 — Implement browser ship visual descriptor

- Objective: replace cone-only ship marker with a browser ship visual descriptor/render group.
- Files/search targets: `apps/weltraum-browser/src/render/three/debugScene.ts`, new `apps/weltraum-browser/src/render/three/shipVisual.ts`, optional safe copy to `apps/weltraum-browser/public/ships/`, `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb` read-only.
- Acceptance criteria:
  - Ship visual has hull/body, cockpit/front marker, main engine marker(s), at least four RCS markers, muzzle placeholder, and camera anchor descriptor.
  - Renderer consumes descriptor/snapshot only; no domain truth is stored in Three.js meshes.
  - E2E/TestBridge can prove visual is not the old cone-only placeholder.
- Guidance:
  - Prefer safe GLB copy only if it does not mutate `Assets/**` and does not require Unity/export tooling.
  - Fall back to procedural low-poly ship if GLB loading is risky.
- Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`; no Unity MCP.
- Verification: focused E2E render snapshot plus screenshot nonblank check.
- Report-back: changed files, asset decision, marker counts, verification run, risks.
- Stopping rule: stop if asset use requires unsafe mutation/export tooling or licensing assumptions.

## Task 2 — Add Flight State V2 and actuator controller

- Objective: add owner flight state fields and a deterministic browser flight controller.
- Files/search targets: `apps/weltraum-browser/src/core/types.ts`, `apps/weltraum-browser/src/flight/state.ts`, new `apps/weltraum-browser/src/flight/flightController.ts` or similar, `apps/weltraum-browser/src/sim/telemetry.ts`, unit tests.
- Acceptance criteria:
  - `ShipState` includes orientation quaternion, angular velocity, throttle, control mode, RCS/SAS state, command vectors, and actuator telemetry.
  - Manual/autopilot commands use the same controller path.
  - Idle and cancel preserve drift unless an explicit brake/kill-momentum command is later added.
- Guidance:
  - Keep vectors/quaternions immutable-by-convention; clone where snapshots cross boundaries.
  - Preserve existing mass/fuel/authority/brake owner snapshot rules.
- Required skills/MCPs: `verification-before-completion`.
- Verification: unit tests for control mode, throttle/cut/full, RCS/SAS toggles, drift on idle/cancel, actuator telemetry and serialization.
- Report-back: state fields added, controller API, tests run, residual physics approximations.
- Stopping rule: stop if this becomes a Unity Rigidbody parity port.

## Task 3 — Wire manual controls and camera modes

- Objective: make the browser ship manually controllable and camera-followed.
- Files/search targets: `apps/weltraum-browser/src/runtime/commands.ts`, `apps/weltraum-browser/src/runtime/browserRuntime.ts`, `apps/weltraum-browser/src/render/three/debugScene.ts`, possible new `apps/weltraum-browser/src/runtime/input.ts`, HUD files, E2E tests.
- Acceptance criteria:
  - Required key/mouse bindings dispatch to runtime-owned control state.
  - `ChaseLocked` is default and follows the ship; `OrbitInspect`, `Side`, `FreeInspect` are switchable.
  - HUD/help documents keybinds.
- Guidance:
  - Do not expose TestBridge by default.
  - Keep UI/render code from computing flight truth.
- Required skills/MCPs: `playwright` or browser verification lane if needed.
- Verification: E2E key presses move/rotate ship, camera follows, camera mode cycles.
- Report-back: controls implemented, camera mode snapshot fields, tests/screenshots.
- Stopping rule: stop if controls require debug-only bridge for normal play.

## Task 4 — Add telemetry-driven thruster and RCS VFX

- Objective: show main-thruster and RCS activity from actuator telemetry.
- Files/search targets: `apps/weltraum-browser/src/render/three/debugScene.ts`, ship visual file, telemetry snapshot, E2E tests.
- Acceptance criteria:
  - Main flame appears only when `mainThrustActive` telemetry is true.
  - RCS puffs appear only when translation/rotation/SAS telemetry is active.
  - Render snapshot exposes VFX state for tests.
- Guidance: VFX is low-poly/simple; do not implement full particle system unless trivial.
- Required skills/MCPs: `ui-designer` for visual review after implementation.
- Verification: E2E screenshots `autopilot-thruster-burn.png`, `rcs-translation.png` and snapshot assertions.
- Report-back: VFX state mapping, screenshots, risks.
- Stopping rule: stop if VFX is driven from keydown instead of actuator telemetry.

## Task 5 — Refactor autopilot to use actuator layer and remove normal snap shortcuts

- Objective: make autopilot fly the same ship state through the same flight controller.
- Files/search targets: `apps/weltraum-browser/src/flight/executor.ts`, flight controller, runtime, `tests/unit/executor.test.ts`, `tests/unit/provingGroundScenarios.test.ts`, E2E.
- Acceptance criteria:
  - No normal-runtime snap to target/waypoints.
  - No normal-runtime waypoint velocity zero.
  - No idle/cancel velocity zero.
  - Arrival requires distance/speed envelope and stable `planHash`.
  - No silent replan/replacement.
- Guidance:
  - Preserve fuel/authority/brake fail-closed checks.
  - If a debug migration snap remains, make it explicit and prove final player evidence does not use it.
- Required skills/MCPs: `systematic-debugging` if tests fail; `verification-before-completion`.
- Verification: unit tests for no snap, cancel keeps drift, autopilot actuator requests, arrival envelope/speed, planHash stability; E2E visible autopilot movement and arrival screenshot.
- Report-back: removed shortcuts, autopilot request model, tests/evidence.
- Stopping rule: stop if all proving-ground cases require old snap semantics and need a smaller migration plan.

## Task 6 — Docs, evidence, review and final verification

- Objective: complete player HUD/docs/evidence and final gates.
- Files/search targets: `apps/weltraum-browser/src/ui/statusHud.ts`, `apps/weltraum-browser/evidence/browser-playable-ship-flight-v1.md`, screenshot evidence, `.devtoolbox/specs/changes/browser-playable-ship-flight-v1/**`, `docs/browser-mainline/port-roadmap.md`, `feature-intent-index.md`, `known-unity-bug-traps.md`.
- Acceptance criteria:
  - HUD displays requested control/camera/throttle/speed/RCS/SAS/autopilot/target/warnings/help state from snapshots.
  - Evidence summarizes tests, Chrome fallback if used, screenshots, what is playable, and what is still worse than Unity.
  - Docs list parity gaps and next slice.
- Guidance: keep player/debug UI separated; no raw JSON/TestBridge/internal solver leakage.
- Required skills/MCPs: `requesting-code-review`, `devtoolbox-review`, `ui-designer`, `verification-before-completion`.
- Verification:
  - `npm ci`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`
  - Chrome fallback if default fails only with `spawn UNKNOWN`
  - `git status --short -- Assets`
- Report-back: full verification table, screenshot paths, changed files, parity gaps, next task.
- Stopping rule: do not close task if required browser evidence is missing or `Assets/**` changed unexpectedly.
