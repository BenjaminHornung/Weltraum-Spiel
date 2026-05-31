# Tasks

## Sequence

- [x] 1. Discovery lock-in
  - Read weltraum-001 artifacts and confirm reuse boundaries for `CelestialBodyCatalog`, `CelestialBodyRegistry`, `CelestialBodyDefinition`, `OrbitDefinition`, `AbsoluteState`, `LargeWorldVector3d`, `GravityDefinition`, and `VisualScaleProfile`.
  - Reconfirm runtime location (`Assets/Scripts/Prototype/Celestial/`) and test location (`Assets/Tests/Editor/`).
  - Record one execution note before implementation work starts.

- [x] 2. Z.AI and design gates before implementation
  - Request `zai-review-glm51` review of runtime boundaries, contracts, and scale separation.
  - Request `zai-ui-glm51` review of minimal debug viewer/readout approach before any UI work.
  - Resolve critical feedback as task prerequisites.

- [x] 3. Implementation plan for runtime orbit-map prototype
  - Add an orbit map capability under runtime scope that computes analytical body positions from `OrbitDefinition`.
  - Keep real-meter analytics and display scale values separate in public outputs.
- [x] 4. Implement orbit lines for the four starter bodies
  - Include `star.aurelia`, `planet.hestia`, `moon.hestia.luma`, and `asteroid.eber` in debug orbit geometry generation.
  - Verify orbit lines draw from analytical orbit state where available.

- [x] 5. Implement debug map snapshots
  - Generate scaled orbit and map snapshot data that does not mutate source real units.
  - Record both real-meter and map-scale values when producing diagnostics.

- [x] 6. Implement debug readout overlays
  - Add readouts for ID, body type, real radius, real semi-major axis, `mu`, parent ID, and map scaling ratio.
  - Keep display updates in a lightweight debug/prototype window.

- [x] 7. Implement minimal debug viewer shell
  - Add a self-contained `MonoBehaviour` with IMGUI controls and `PrototypeUiWindowState` + `PrototypeUiLayoutManager` integration.
  - Explicitly avoid `PrototypePlayerHudRenderer` and final map UX flow.

- [x] 8. Z.AI UI gate before implementation continuation
  - Request `zai-ui-glm51` review of the draft debug viewer/readout design before enabling visual output in runtime build.

- [x] 9. Add and extend EditMode tests
  - Add new tests for orbit map projection and orbit line generation.
  - Add tests for real-meter to map-scale conversion separation and deterministic debug readout output.
  - Add targeted `OrbitDefinition` analytical position sanity checks.
  - Keep tests in `Assets/Tests/Editor/`.

- [x] 10. Add verification and evidence tasks
  - Run `dotnet build "Weltraum Spiel.sln" --no-restore`.
  - Run Unity script validation/compile checks.
  - Run `specs_validate`.
  - Run `verify_fresh`.
  - Run EditMode tests for new orbit map tests.
  - Run existing `FloatingOriginValidationTests`, `CelestialRuntimeValidationTests`, and relevant regression tests if available.
  - Capture proof under `.devtoolbox/specs/changes/weltraum-002-orbit-map-prototype/tests/`.

- [x] 11. Final Z.AI review after visible UI evidence
  - If any prototype UI is visible, run a second `zai-ui-glm51` review on screenshot/evidence.
  - Resolve any findings and capture notes under the change evidence directory.

- [x] 12. Task closeout
  - Create or update execution notes for each completed task.
  - Toggle each task after verification.
  - Re-run `specs_validate` to confirm final artifact integrity.
