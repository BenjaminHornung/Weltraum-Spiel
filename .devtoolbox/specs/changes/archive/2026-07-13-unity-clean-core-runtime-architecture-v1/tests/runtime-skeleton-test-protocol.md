# Runtime Skeleton Test Protocol

- Date: 2026-06-15
- Source docs/context read:
  - `AGENTS.md`
  - `.agent/PLANS.md`
  - `docs/legacy-unity/architecture/clean-core-runtime-architecture.md`
  - `docs/legacy-unity/architecture/scene-management-v1.md`
  - `.devtoolbox/specs/changes/clean-core-runtime-architecture-v1/proposal.md`
  - `.devtoolbox/specs/changes/clean-core-runtime-architecture-v1/design.md`
  - `.devtoolbox/specs/changes/clean-core-runtime-architecture-v1/tasks.md`

## Created folders

- `Assets/_Weltraum/Runtime/Core`
- `Assets/_Weltraum/Runtime/Simulation`
- `Assets/_Weltraum/Runtime/Flight`
- `Assets/_Weltraum/Runtime/Navigation`
- `Assets/_Weltraum/Runtime/UI`
- `Assets/_Weltraum/Runtime/Map`
- `Assets/_Weltraum/Runtime/ShipBuilder`
- `Assets/_Weltraum/Runtime/CargoResources`
- `Assets/_Weltraum/Runtime/World`
- `Assets/_Weltraum/Runtime/Combat`
- `Assets/_Weltraum/Runtime/Missions`
- `Assets/_Weltraum/Runtime/FactionsEconomy`
- `Assets/_Weltraum/Runtime/Drones`
- `Assets/_Weltraum/Runtime/Persistence`
- `Assets/_Weltraum/Content`
- `Assets/_Weltraum/Scenes/Product`
- `Assets/_Weltraum/Scenes/VerticalSlices`
- `Assets/_Weltraum/Scenes/TestRanges`
- `Assets/_Weltraum/Scenes/UIShowroom`
- `Assets/_Weltraum/Editor`
- `Assets/_Weltraum/Tests/EditMode`
- `Assets/_Weltraum/Tests/PlayMode`
- `Assets/_Weltraum/Tests/Fixtures`

## Created asmdefs and references

- `Assets/_Weltraum/Runtime/Core/Weltraum.Core.asmdef` — no references
- `Assets/_Weltraum/Runtime/Simulation/Weltraum.Simulation.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/Flight/Weltraum.Flight.asmdef` — `Weltraum.Core`, `Weltraum.Simulation`
- `Assets/_Weltraum/Runtime/Navigation/Weltraum.Navigation.asmdef` — `Weltraum.Core`, `Weltraum.Simulation`, `Weltraum.Flight`
- `Assets/_Weltraum/Runtime/UI/Weltraum.UI.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/Map/Weltraum.Map.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/ShipBuilder/Weltraum.ShipBuilder.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/CargoResources/Weltraum.CargoResources.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/World/Weltraum.World.asmdef` — `Weltraum.Core`, `Weltraum.Simulation`
- `Assets/_Weltraum/Runtime/Combat/Weltraum.Combat.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/Missions/Weltraum.Missions.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/FactionsEconomy/Weltraum.FactionsEconomy.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/Drones/Weltraum.Drones.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Runtime/Persistence/Weltraum.Persistence.asmdef` — `Weltraum.Core`
- `Assets/_Weltraum/Editor/Weltraum.Editor.asmdef` — `Weltraum.Core`, Editor-only
- `Assets/_Weltraum/Tests/EditMode/Weltraum.Tests.EditMode.asmdef` — all runtime assemblies plus `Weltraum.Editor`, `TestAssemblies`

## Marker and test files created

- Marker files for all runtime assemblies under `Assets/_Weltraum/Runtime/*/*AssemblyMarker.cs`
- `Assets/_Weltraum/Editor/WeltraumEditorAssemblyMarker.cs`
- `Assets/_Weltraum/Tests/EditMode/RuntimeSkeletonCompileSmokeTests.cs`

## Scope exclusions

- No gameplay logic was added.
- No `MonoBehaviour` types were added.
- No scenes, prefabs, or materials were created or modified.
- No `Packages/` or `ProjectSettings/` files were changed.
- `Assets/Scripts/Prototype` was left unchanged.

## Validation

### Completed checks

- Command: `git status --short -- "Assets/_Weltraum" ".devtoolbox/specs/changes/clean-core-runtime-architecture-v1" "Assets/Scripts/Prototype" "Packages" "ProjectSettings"`
- Result: no output before the new skeleton files were written.
- Command: `git status --short -- "Assets/_Weltraum" ".devtoolbox/specs/changes/clean-core-runtime-architecture-v1" "Assets/Scripts/Prototype" "Packages" "ProjectSettings"`
- Result: only new untracked entries under `.devtoolbox/specs/changes/clean-core-runtime-architecture-v1/tests/runtime-skeleton-test-protocol.md` and `Assets/_Weltraum/`; no `Assets/Scripts/Prototype` changes were reported.

### C# 9 compatibility follow-up

- Updated all `Assets/_Weltraum/**/*.cs` file-scoped namespaces to block namespace syntax.
- Set `Assets/_Weltraum/Tests/EditMode/Weltraum.Tests.EditMode.asmdef` `autoReferenced` to `false`.

### Fresh verification results

- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS. Build succeeded with 0 errors and 2 MSB3277 warnings from Unity package/reference conflicts (`MCPForUnity.Editor`, `Unity.Cloud.*`, `Unity.AssetManager.*`); assessed as pre-existing/unrelated to `_Weltraum`.
- `dotnet test "Weltraum Spiel.sln" --no-build`: attempted and assessed, but no test execution via VSTest; Unity EditMode tests are run through Unity Test Runner for this project.
- Unity MCP `refresh_unity` force compile: PASS; Unity became ready.
- Unity MCP console check: PASS; 0 errors and 36 warnings, all from third-party `Unity.AssetManager.Core.Editor` / `UI.Editor` `SerializeReference` code; none from `_Weltraum`.
- Unity MCP EditMode test run for `Weltraum.Tests.EditMode` / `RuntimeSkeletonCompileSmokeTests`: PASS; 15 total, 15 passed, 0 failed, 0 skipped, duration 0.6186472s, job id starts `a4d863b4`.
- Scoped `git status` after verification: `Assets/_Weltraum/` has the expected untracked skeleton source plus Unity-generated `.meta` files; this evidence markdown is untracked; `Assets/Scripts/Prototype`, `Packages`, and `ProjectSettings` have zero entries.
- Unity import generated the `.meta` files under `Assets/_Weltraum`; they are expected to be committed together with the skeleton in any later commit.
