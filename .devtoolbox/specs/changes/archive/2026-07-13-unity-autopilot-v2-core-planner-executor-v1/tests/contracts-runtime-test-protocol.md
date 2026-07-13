# Contracts Runtime Test Protocol

Change: `autopilot-v2-core-planner-executor-v1`

## Files created or changed

### Runtime
- `Assets/_Weltraum/Runtime/Simulation/SpatialVector3.cs`
- `Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`
- `Assets/_Weltraum/Runtime/Flight/FlightContracts.cs`
- Unity-generated `.meta` files for those three runtime scripts
  (`SpatialVector3.cs.meta`, `AutopilotContracts.cs.meta`,
  `FlightContracts.cs.meta`)

### Tests
- `Assets/_Weltraum/Tests/EditMode/Navigation/TargetDescriptorTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/ArrivalEnvelopeTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/RouteSegmentTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/RouteScoreTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/RoutePlanTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/RouteCandidateTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/NavigationEnvironmentSnapshotTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/ShipAuthoritySnapshotTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/ObstacleSnapshotTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Navigation/PlanInvalidationReasonTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Flight/FuelBudgetTests.cs`
- `Assets/_Weltraum/Tests/EditMode/Flight/BrakeReserveTests.cs`
- Unity-generated `.meta` files for the two new test folders
  (`Assets/_Weltraum/Tests/EditMode/Flight.meta`,
  `Assets/_Weltraum/Tests/EditMode/Navigation.meta`)
- Unity-generated `.meta` files for the twelve new test scripts in the allowed
  test folders (all currently untracked)

## Tests added / covered

- Valid construction for all contract types.
- Rejection of NaN / Infinity / negative values where relevant.
- Strengthened explicit coverage for NaN / Infinity in arrival, obstacle,
  fuel, brake, segment and target validation paths.
- Arrival envelope gate validation.
- `RoutePlan` requires at least one segment.
- `RouteCandidate` requires at least one segment and non-null / non-empty diagnostics.
- Defensive copy semantics for collection-backed contracts.
- Deterministic equality semantics for representative DTOs.
- `FuelBudget` / `BrakeReserve` reject insufficient reserve instead of masking a negative remainder.

## Commands attempted / results

- `git status --short --untracked-files=all`
  - Result: pass; final status lists only the evidence file plus new runtime/test
    `.cs` and `.meta` files under allowed paths.
- `git diff --check`
  - Result: pass; no output.
- Forbidden-scope check:
  - `git status --short --untracked-files=all | rg "^(\?\?|[ MARCUD?!]{2})\s+(Assets/Scripts/Prototype/|Assets/Scenes/|.*\.(prefab|mat)$)"`
  - Result: no output / pass.
- `.sln` / `.csproj` presence check:
  - `glob *.sln` in worktree root: no files found.
  - `glob *.csproj` in worktree root: no files found.
  - Blocker: initial worktree scan found no solution/project files.
- Unity batchmode / EditMode attempts against this worktree (Unity 6000.4.7f1):
  - First attempt used `-runTests -testPlatform EditMode -assemblyNames Weltraum.Tests.EditMode` with output paths under this tests folder.
  - Result: no results XML. `contracts-runtime-unity-editmode.log` failed during package resolution with EPERM rename for `com.unity.timeline` (lines 156-158).
  - Retry: no results XML. `contracts-runtime-unity-editmode-retry.log` contains PackageCache/editor-package errors such as `UnityEditor.GUID` missing in `com.unity.serialization`, `com.unity.asset-manager-for-unity`, and `com.unity.shadergraph`.
  - Grep result: no new-file errors for `AutopilotContracts`, `FlightContracts`, or `SpatialVector3`.
  - Unity batchmode also produced unintended tracked side effects outside scope:
    `Assets/TextMesh Pro/Resources/Fonts & Materials/LiberationSans SDF - Fallback.asset`
    and `ProjectSettings/Packages/com.unity.asset-manager-for-unity/Settings.json`.
    These were removed from the working tree via
    `git stash push -m "temp-unity-batchmode-side-effects" -- <two paths>`, and
    the final `git status --short --untracked-files=all` no longer lists them.
- Unity-generated solution/project files after import:
  - The generated solution is `weltraum-spiel--codex-autopilot-v2-contracts-runtime-v1.sln` (worktree name derived), not `Weltraum Spiel.sln`.
- `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: failed with `MSBUILD : error MSB1009: Project file does not exist. Switch: Weltraum Spiel.sln`.
- `dotnet build "weltraum-spiel--codex-autopilot-v2-contracts-runtime-v1.sln" --no-restore`
  - Result: succeeded; build succeeded with 25 warnings, 0 errors.
- `dotnet test "weltraum-spiel--codex-autopilot-v2-contracts-runtime-v1.sln" --no-build --verbosity normal --logger "trx;LogFileName=contracts-runtime-dotnet-test.trx"`
  - Result: completed VSTest target with build succeeded, 0 warnings, 0 errors, but did not execute Unity EditMode tests or produce Unity test result evidence; not a substitute for Unity Test Runner.
- Unity MCP:
  - `unityMCP_debug_request_context` showed the active instance is bound to `E:\Unity\Weltraum Spiel\Weltraum Spiel`, not this worktree.
  - Blocker: do not validate the wrong checkout; Unity MCP validation skipped.

## Updated validation focus

- Arrival envelope: rejects NaN / Infinity on every gate and invalid minimums.
- Obstacle snapshot: validates finite radii before relational comparison and rejects out-of-range hazard/confidence values.
- Fuel and brake contracts: reject NaN / Infinity inputs and insufficient reserves.
- Target descriptor: rejects null arrival envelopes and invalid optional attitude / velocity inputs.
- Route segment: rejects negative and non-finite distance / duration values.

## Scope confirmation

- No final working-tree changes remain under `Assets/Scripts/Prototype`,
  `Assets/Scenes`, prefabs, or materials.
- No `ProjectSettings` changes remain in the working tree.
- No executor, planner algorithm, UI, or MonoBehaviour runtime was added in this slice.
