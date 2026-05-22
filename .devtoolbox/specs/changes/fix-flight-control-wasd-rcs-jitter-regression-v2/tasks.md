# Tasks

## Phase 1: Spec and Reproduction
- [x] Replace scaffolded proposal/design/tasks/specs with v2 flight-control regression requirements.
- [x] Build or update a PlayMode/Evidence procedure that exercises the real `PlayerShipController` path for idle, translation, attitude, SAS on/off, imported visual, F6 switching, and stale assist priority.
- [x] Capture a pre-fix or current-state reproduction/diagnosis from the live path before claiming a fix.

## Phase 2: Stable RCS Solver
- [x] Add `RcsSolverMode.StablePrototype` as the default and preserve the greedy allocator as `ExperimentalPhysicalNozzles`.
- [x] Apply StablePrototype translation at center of mass and attitude/SAS/assist as torque through `ShipPhysicsCore`.
- [x] Preserve fuel, diagnostics, and RCS VFX behavior in the stable solver.

## Phase 3: Runtime Stability Guards
- [x] Ensure manual input cannot be blocked by stale external assist requests and document all assist request paths.
- [x] Throttle or dirty-gate runtime mass-property application so it is not blindly applied twice per `FixedUpdate`.
- [x] Verify `PrototypeShipVisualSwitcher` does not strip Rigidbody/Collider/Renderer from `PrototypeShip` or Main Camera.

## Phase 4: Verification and Evidence
- [x] Run focused compile/tests for flight control, RCS, physics core, visual switching, and assist priority.
- [x] Run Unity PlayMode evidence in `Assets/Scenes/PrototypeBootstrapHost.unity` and write required log/CSV/screenshots under `tests/`.
- [x] Review the final patch and evidence for regressions.
- [x] Commit and push relevant changes without staging unrelated dirty workspace files.
