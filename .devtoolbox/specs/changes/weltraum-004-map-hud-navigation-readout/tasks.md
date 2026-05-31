# Tasks

## Sequence

- [x] 1. Create DevToolbox scaffold
  - Create proposal, design, tasks, and spec artifacts for `weltraum-004-map-hud-navigation-readout`.
  - Keep this step planning-only; do not implement runtime code.

- [x] 2. Record initial reuse discovery
  - Identify existing HUD/map/debug surfaces to reuse: `PrototypePlayerHud`, `PrototypeMinimapOverlay`, `PrototypeBootstrap`, `PrototypeOrbitMapDebugWindow`, and `CelestialOrbitMapSnapshotBuilder`.
  - Record that DirectFastTransfer/autopilot/benchmark files are out of scope.

- [ ] 3. Pre-implementation Z.AI UI review
  - Request `zai-ui-glm51` review before changing visible HUD/map UI.
  - Resolve any blocking findings before implementation.

- [ ] 4. Implementation plan lock-in
  - Decide the smallest adapter/data-flow from `CelestialOrbitMapSnapshotBuilder` into existing HUD/map readouts.
  - Confirm no `PrototypePlayerHudRenderer` replacement and no final System Map UX.

- [ ] 5. Implement read-only navigation readout
  - Surface current target body, body ID, parent, real-meter distance, and map-scale context in existing prototype HUD/map debug surfaces.
  - Keep all outputs read-only and non-actionable.

- [ ] 6. Add focused tests
  - Add or extend EditMode/PlayMode tests for readout content and bootstrap wiring.
  - Verify the readout uses real catalog/orbit values and does not mutate source data.

- [ ] 7. Capture UI evidence
  - Capture screenshot/manual evidence under this change's `tests/` directory.
  - Confirm the readout does not block basic ship control in `PrototypeBootstrapHost`.

- [ ] 8. Final Z.AI UI review
  - Run `zai-ui-glm51` review against screenshot/evidence.
  - Record accepted backlog notes or required fixes.

- [ ] 9. Verification and closeout
  - Run Unity script validation for touched files.
  - Run relevant HUD/map PlayMode tests and targeted EditMode tests.
  - Run `dotnet build "Weltraum Spiel.sln" --no-restore`.
  - Run `specs_validate` and `verify_fresh`.
