# Status Snapshot Contracts Test Protocol

Date: 2026-06-15

## Scope

This protocol covers the runtime status-contract slice only:

- `Assets/_Weltraum/Runtime/UI/StatusAuthorityContracts.cs`
- `Assets/_Weltraum/Runtime/UI/StatusSnapshots.cs`
- `Assets/_Weltraum/Tests/EditMode/UI/StatusAuthorityContractsTests.cs`

No Prototype, Scene, Prefab, Package, ProjectSettings, ViewModel, or rendering changes are part of this slice.

## Current Evidence

- `dotnet build "Weltraum Spiel.sln" --no-restore` passed with 0 errors.
  Known workspace warning noise remains (`MSB3277` conflict warnings; warning count
  varied by incremental build output, but no errors were reported).
- `dotnet test "Weltraum Spiel.sln" --no-build` exited successfully but produced no
  console output in this Unity-generated solution.
- Unity MCP force-refresh and compile completed; focused EditMode run for
  `Weltraum.Tests.EditMode` passed: 26 total, 26 passed, 0 failed, 0 skipped.
- The earlier Unity EditMode failures from NUnit `Has.Count` against
  `IReadOnlyList` were fixed by asserting `definitions.Count` directly.
- Review cleanup was verified in the same Unity EditMode run: duplicate warning
  codes are de-duplicated before sorting, scanner blank codes are filtered, and
  player text keys are normalized by definition constructors.
- Unity MCP `validate_script` passed for all new C# files with 0 warnings and 0
  errors:
  - `Assets/_Weltraum/Runtime/UI/StatusAuthorityContracts.cs`
  - `Assets/_Weltraum/Runtime/UI/StatusSnapshots.cs`
  - `Assets/_Weltraum/Tests/EditMode/UI/StatusAuthorityContractsTests.cs`
- Final forbidden-path check for `Assets/Scripts/Prototype`, `Assets/Scenes`,
  `Packages`, and `ProjectSettings` returned no changes.

## Contract Assertions Under Test

- Warning chip definitions expose owner, severity, action hint, fallback text, and dismissibility.
- Failure reason definitions expose owner, action hint, and fallback text.
- Domain snapshot DTOs expose a hardcoded/validated `Owner`:
  - `NavigationComputer`
  - `CargoService`
  - `ScannerService`
  - `FactionLegalService`
  - `ShipAuthority`
  - `SuitVitalsService`
- Snapshot constructors reject unknown owners and invalid warning/failure codes instead of storing them silently.
- `PlayerFacingStatusSnapshot` stays as an aggregate container only.

## Caveat / Deferred Mapping

AutopilotTelemetry mapping is deferred. There is no clean-core `AutopilotTelemetry` source type to map from yet, so this protocol does not claim that contract.

## Follow-up Verification Still Needed

- No follow-up verification is required for this contract slice.
- AutopilotTelemetry mapping remains intentionally deferred until the clean-core
  telemetry source contract exists.
