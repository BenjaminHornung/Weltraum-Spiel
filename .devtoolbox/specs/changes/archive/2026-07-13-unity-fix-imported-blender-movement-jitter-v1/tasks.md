# Tasks

## Phase 1: Spec and Bounded Diagnosis
- [x] Create the `fix-imported-blender-movement-jitter-v1` DevToolbox change.
- [x] Validate spec artifacts.
- [x] Read camera, anchor, flight-control, RCS, visual switcher/binder, docking assist, and current evidence tests.
- [x] Add evidence-only jitter classification diagnostics.
- [x] Run a pre-fix PlayMode classification pass and record whether jitter is physics, visual, camera, or assist conflict.

## Phase 2: Minimal Fix
- [x] If classified as camera/focus jitter, smooth ChaseLocked focus/position/rotation and keep snap for reset/reframe/teleport.
- [x] If classified as translation assist jitter, add diagnostics plus release grace/fade-in so auto-stop never fights held translation.
- [x] Keep imported visual root and functional socket rig steady during normal movement.

## Phase 3: Verification and Evidence
- [x] Run focused compile and Unity console checks.
- [x] Run PlayMode/EditMode regression checks for flight/camera evidence.
- [x] Run real PrototypeBootstrapHost jitter evidence with ImportedDemoScout, GeneratedPrimitives, SAS on/off, DockingAssist on/off, and Cargo comparison.
- [x] Save `tests/test-protocol.md`, `tests/logs/imported-blender-jitter.log`, `tests/performance/imported-blender-jitter.csv`, and screenshots.
- [x] Run Claude plan review double-check.
- [x] Commit and push the verified change.
