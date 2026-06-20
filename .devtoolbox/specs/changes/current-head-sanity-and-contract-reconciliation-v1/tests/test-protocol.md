# Current HEAD Sanity and Contract Reconciliation Test Protocol

Date: 2026-06-20

## HEAD / Commit

- HEAD: `78144066867f2df06b06614d7f446007361c99c5`
- Recent commits:
  - `78144066 #WELTRAUM-000 Merge pending asset and tooling state`
  - `afdfd1e8 #WELTRAUM-000 Commit Unity package tooling state`
  - `61734370 #WELTRAUM-000 Merge autopilot V2 contracts runtime layer`

## Build / Test / Unity Results

- `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: PASS.
  - Summary: 23 projects, 0 errors, 49 warnings.
  - Warning scope: known current warning noise including `CS0162` unreachable code
    and `CS0649` unassigned fields in `CodeGenerator.*`.
- `dotnet test "Weltraum Spiel.sln" --no-build`
  - Result: PASS.
  - Summary: completed in binlog-only mode; test counts unavailable from console.
- Unity MCP checkout binding:
  - Result: PASS.
  - Active instance was bound to `E:\Unity\Weltraum Spiel\Weltraum Spiel` as
    `Weltraum Spiel@49c909b3e97ba6e8`.
- Unity MCP refresh / console check:
  - Result: PASS with warnings.
  - Refresh and compile were requested.
  - Console warnings included MCP websocket initialization and Unity AssetManager
    `SerializeReference` warning noise; no compile errors were reported.
- Focused Unity EditMode tests:
  - First attempt was blocked because the Editor was in or entering Play Mode.
  - After exiting Play Mode, focused `Weltraum.Tests.EditMode` run passed.
  - Result: 76 total, 76 passed, 0 failed, 0 skipped, duration 2.1985081s.

## Package / Tooling Status

- Cinemachine is present in `Packages/manifest.json` as
  `com.unity.cinemachine` 3.1.7 and in `packages-lock.json` as a registry
  package.
- ProBuilder is present as `com.unity.probuilder` 6.1.2 and in
  `packages-lock.json` as a registry package.
- VFX Graph is present as `com.unity.visualeffectgraph` 17.4.0 and in
  `packages-lock.json` as a builtin package.
- AI Navigation is present as `com.unity.ai.navigation` 2.0.13 and in
  `packages-lock.json` as a registry package.
- Roslyn DLLs are present under `Assets/Plugins/Roslyn/`:
  - `Microsoft.CodeAnalysis.dll`
  - `Microsoft.CodeAnalysis.CSharp.dll`
  - `System.Collections.Immutable.dll`
  - `System.Reflection.Metadata.dll`
- Build/test status after the package/tooling commit: solution build PASS,
  solution test PASS, focused Unity EditMode PASS. No package-specific compile
  regression was observed in this validation pass.

## Reconciled Tasks

- Updated Autopilot V2 Phase 1 contract tasks in
  `.devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/tasks.md`:
  - `TargetDescriptor` definition marked complete.
  - `ArrivalEnvelope` definition marked complete.
  - Route plan and segment data contracts marked complete.
  - Pure tests for equality / contract semantics marked complete.
- Evidence basis:
  - Runtime files: `Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`,
    `Assets/_Weltraum/Runtime/Flight/FlightContracts.cs`,
    `Assets/_Weltraum/Runtime/Simulation/SpatialVector3.cs`.
  - Focused tests exist and ran under `Weltraum.Tests.EditMode` for
    `TargetDescriptor`, `ArrivalEnvelope`, `RoutePlan`, `RouteSegment`,
    `RouteCandidate`, `RouteScore`, `NavigationEnvironmentSnapshot`,
    `ShipAuthoritySnapshot`, `ObstacleSnapshot`, `FuelBudget` and
    `BrakeReserve`.

## Tasks Remaining Open

- Autopilot V2 deterministic planning tasks remain open.
- Autopilot V2 executor / no-silent-replan tasks remain open.
- Autopilot V2 UI integration tasks remain open.
- Status Authority `Map AutopilotTelemetry codes to status snapshot fields`
  remains open intentionally because no clean-core `AutopilotTelemetry` source
  contract exists yet.
- Scene Registry future application tasks remain open; no scene manifest was
  applied in this slice.

## DTO Class-vs-Struct Decision

- Decision documented in
  `.devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/implementation-plan.md`.
- The current immutable sealed class implementation is retained.
- No code conversion to `readonly struct` was performed because the implemented
  class contracts are immutable, tested, defensively copy collections, and are
  more appropriate for Unity serialization / editor tooling than a broad nested
  value-type graph.
- `SpatialVector3` remains a `readonly struct` because it is a small value-type
  math primitive.

## Scope Confirmation

- No gameplay implementation was added.
- No planner or executor algorithm was added.
- No `Assets/Scripts/Prototype` file was intentionally changed.
- No `.unity`, `.prefab` or `.mat` file was intentionally changed.
- Unity tooling briefly modified
  `ProjectSettings/Packages/com.unity.probuilder/Settings.json`; the side effect
  was removed before final guardrail checks.

## Final Guardrail Checks

- `git diff --check`
  - Result: PASS; no whitespace errors. Git reported line-ending warnings for
    edited markdown files only.
- Forbidden Prototype check:
  - Command: `git status --short --untracked-files=all` filtered for
    `Assets/Scripts/Prototype/`.
  - Result: PASS; no output.
- Forbidden scene/prefab/material check:
  - Command: `git status --short --untracked-files=all` filtered for
    `.unity`, `.prefab` and `.mat` paths.
  - Result: PASS; no output.
- Unintended `ProjectSettings` check:
  - Command: `git status --short --untracked-files=all` filtered for
    `ProjectSettings/`.
  - Result: PASS; no output.
- DevToolbox spec validation:
  - `current-head-sanity-and-contract-reconciliation-v1`: PASS.
  - `autopilot-v2-core-planner-executor-v1`: PASS.
