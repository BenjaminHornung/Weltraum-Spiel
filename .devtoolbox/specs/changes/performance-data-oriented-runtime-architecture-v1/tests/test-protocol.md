# Test Protocol: Data-Oriented Runtime Architecture v1

## Scope

This change documents the architecture and evidence needed to support a phased move of runtime hot paths to data-oriented execution.

## Verification objectives

1. Confirm baseline hotpaths are named and covered:
- SimpleFollowCamera visual bounds.
- RcsThrusterController nozzle refresh/allocation.
- Projectile simulation.
- Weapon target discovery.
- Autopilot path/obstacle logic.
- Minimap/sensor data.
- Debug UI diagnostics.

2. Confirm architecture layers are explicit and complete:
- Unity Scene Layer.
- Runtime Data Layer.
- Simulation Systems.
- Apply Layer.

3. Confirm threading contract is explicit:
- Main-thread API exclusions and allowances.
- Jobs/Burst restriction to data math.
- Snapshot build on main thread and patch apply on main thread.

4. Confirm required data model entries exist:
- `ProjectileData`
- `TargetData`
- `ShipRuntimeState`
- `RcsNozzleData`
- `TrajectoryCandidateData`
- `SensorContactData`
- `CameraVisualBoundsData`

5. Confirm migration phasing is documented:
- Phase 1 cache and dirty flags
- Phase 2 projectile movement/hitscan candidates
- Phase 3 target scoring
- Phase 4 autopilot trajectory candidates
- Phase 5 sensor/minimap filtering
- Phase 6 optional RCS allocator math

6. Confirm performance budget items are explicit:
- No steady-state hierarchy scans.
- No `Instantiate`/`Destroy` in hot paths.
- No per-frame allocations in projectile/target/camera/RCS paths.
- Jobs are data-math only.

7. Confirm local Unity doc references are listed:
- `E:\Unity\Documentation\en\Manual\job-system-overview.html`
- `E:\Unity\Documentation\en\Manual\job-system-thread-safe-types.html`
- `E:\Unity\Documentation\en\Manual\job-system-native-container.html`
- `E:\Unity\Documentation\en\ScriptReference\Rigidbody.AddForce.html`
- `E:\Unity\Documentation\en\ScriptReference\Component.GetComponentsInChildren.html`

## Test steps

- Manual doc scan of `design.md` for all section headers listed above.
- Manual scan of data model names and fields.
- Manual scan of migration phase ordering and labels.
- Manual scan of budget constraints and main-thread vs job boundary language.
- Validate `docs/performance-runtime-architecture.md` exists and matches the same contract.

## Local evidence

- `docs/performance-runtime-architecture.md` created.
- `.devtoolbox/specs/changes/performance-data-oriented-runtime-architecture-v1/design.md` updated with architecture, boundaries, data models, and phasing.
- `.devtoolbox/specs/changes/performance-data-oriented-runtime-architecture-v1/tests/test-protocol.md` updated with acceptance-oriented checks.
- Runtime snapshots added in `Assets/Scripts/Prototype/PrototypeRuntimeDataSnapshots.cs`.
- Camera, RCS, projectile, and target registry producers expose cache-backed snapshot data.
- Focused EditMode tests were added for camera dirty flags, RCS snapshot stability, projectile snapshots, target registry snapshots, and source guards.

## Execution status

- `npx --yes openspec validate performance-data-oriented-runtime-architecture-v1 --type change --json --no-interactive` was attempted in the sandbox and failed because npm could not access the registry/cache.
- The required escalated retry was rejected by the security reviewer because it would download and execute unpinned npm code from the registry.
- Safe local structure validation passed:
  - missing required files: none
  - spec count: 6
  - specs without `Scenario:` headings: none
- Manual evidence-first verification completed by file inspection.
- `dotnet build "Weltraum Spiel.sln"` was run with required filesystem escalation and passed:
  - 0 errors
  - 24 warnings
  - warnings were pre-existing Unity/MSBuild assembly conflicts, serialized-field warnings, and obsolete test API warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build` exited 0 with no console output. This is recorded only as a weak .NET test runner signal because Unity EditMode tests require the Unity runner.
- Source guard scan of `PrototypeRuntimeDataSnapshots.cs` found no Unity object references, `GetComponent`, `GetComponentsInChildren`, `FindObjectsByType`, `Instantiate`, `Destroy`, or `Physics.` usage.
- Unity MCP validation was retried:
  - MCP server reachable
  - no Unity session registered (`instance_count: 0`, `no_unity_session`)
- Unity batchmode EditMode test execution was attempted and aborted immediately because the project is already open in a live Unity Editor instance.
- Force-closing the live Unity Editor was not performed because it risks losing unsaved editor work and was rejected by the safety reviewer.

## Open checks

- Run Unity EditMode tests from the existing editor or after closing it cleanly.
- Run openspec validation in an environment with a preinstalled/trusted `openspec` executable.
- Add runtime microbench marks once the next implementation phase starts.
