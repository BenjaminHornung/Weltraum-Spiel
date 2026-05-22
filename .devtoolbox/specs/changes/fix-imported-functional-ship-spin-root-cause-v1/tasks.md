# Tasks

## Phase 1: Spec and Root-Cause Grounding
- [x] Create `fix-imported-functional-ship-spin-root-cause-v1` change.
- [x] Trace imported default build, functional binder scale/proxy positions, mass descriptors, RCS torque authority, and weapon recoil paths.
- [x] Validate spec artifacts.

## Phase 2: Physics Sanity and Stable RCS
- [x] Add imported functional mass/inertia descriptors or safe fallback inertia.
- [x] Add structured physics sanity diagnostics for rigidbody, functional rig, RCS, and weapon recoil.
- [x] Decouple `StablePrototype` RCS torque authority from nozzle lever arms.

## Phase 3: Weapon Recoil Spin Guard
- [x] Add safe prototype recoil modes.
- [x] Make prototype default recoil center-of-mass safe.
- [x] Keep physical muzzle recoil opt-in and clamped.

## Phase 4: Regression Tests
- [x] Add PlayMode tests for imported functional inertia/lever-arm sanity.
- [x] Add bounded WASD attitude tests.
- [x] Add Space/fire no-wild-spin test.
- [x] Add all-axis translation stability test.

## Phase 5: Real PlayMode Evidence
- [x] Run Unity PlayMode evidence in `Assets/Scenes/PrototypeBootstrapHost.unity`.
- [x] Write logs, CSV diagnostics, and screenshots under this change.
- [x] Record pass/fail findings in `tests/test-protocol.md`.

## Phase 6: Review and Publish
- [x] Run focused compile/tests/checks.
- [x] Run Claude plan review double-check.
- [x] Commit and push the verified change.
