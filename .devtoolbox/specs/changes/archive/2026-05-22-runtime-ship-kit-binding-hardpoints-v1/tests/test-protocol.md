# Test Protocol: Runtime ShipKit Hardpoint Binding v1

Date: 2026-05-21
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Scope

- Imported ShipKit hardpoints are bound or reported through `PrototypeShipHardpointBinder`.
- Generated primitive fallback creates and binds builder hardpoint sockets without changing fallback flight behavior.
- Binding is idempotent and avoids demo hierarchy path special cases.

## Evidence

- DevToolbox `execution_create`: `21738f050098478995073d65e748443b`; launch/run preflight passed.
- DevToolbox `specs_validate runtime-ship-kit-binding-hardpoints-v1`: passed with proposal, design, one spec file, and 7 parsed tasks.
- `dotnet build "Weltraum Spiel.sln" --no-restore`: passed with existing Unity/MCP reference and obsolete API warnings only.
- Unity MCP `validate_script`: 0 errors and 0 warnings for `PrototypeShipHardpointBinder.cs`, `PrototypeImportedShipBinder.cs`, `PrototypeBootstrap.cs`, and `PrototypeFunctionalShipSocketValidationTests.cs`.
- Unity TestRunner API EditMode run `PrototypeFunctionalShipSocketValidationTests`: 11 total, 11 passed, 0 failed, 0 skipped. XML: `tests/hardpoints-editmode-api-2026-05-22.xml`.
- `dotnet test "Weltraum Spiel.sln" --no-build`: exited 0.
- Unity console was cleared after the TestRunner API result-save noise and then reread: 0 error entries.
- DevToolbox default `verify_run` passed the Specs step, then failed its bare root-level Build/Test/Lint steps with the known Unity-root `MSB1011` multiple project/solution-file ambiguity. The scoped replacement evidence is `tests/verify-runtime-hardpoints.ps1`, which runs solution build/test and checks the Unity XML result while writing dotnet logs under `tests/logs/`.
- DevToolbox `verify_fresh` with the scoped preset passed 2/2 steps: Specs plus `tests/verify-runtime-hardpoints.ps1`. Execution `21738f050098478995073d65e748443b` is now `verified`; stale generic root verification is archived under previous verification history.

## Result

- Imported demo scout hardpoints are reported and bound through `PrototypeImportedShipBinder` / `PrototypeShipHardpointBinder`.
- Generated primitive fallback creates a `GeneratedConnectorRig`, binds generated connector hardpoints, keeps generated RCS fallback mode active, and keeps engine fallback nozzle support enabled.
- Repeated hardpoint binding is idempotent: second binds create 0 new hardpoint records in tests.
- Source guard test verifies the hardpoint binder does not hardcode demo scout/cargo hierarchy tokens.
