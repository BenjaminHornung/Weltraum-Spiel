# Test Protocol - ship-blueprint-builder-v0

## Scope

Validate the first prototype-only data-driven ship blueprint layer. The evidence covers module definition/instance validation, conversion into existing generated `PrototypeShipVariant` and `PrototypeShipLayout` paths, two playable sample ships, derived mass/COM/fuel/main/RCS/gun behavior, docs, and source guards against imported-demo hardcoding.

## Commands And Evidence

- `dotnet build "Weltraum Spiel.sln" --no-restore -v:minimal`
  - Result: PASS.
  - Notes: Existing Unity/MCP assembly conflict and obsolete API warnings remain; no compile errors.
- `dotnet test "Weltraum Spiel.sln" --no-build -v:minimal --filter "FullyQualifiedName~PrototypeShipBlueprintBuilderValidationTests"`
  - Result: PASS / exit 0.
  - Notes: Unity EditMode tests are the authoritative runner for these NUnit tests.
- Unity MCP `validate_script`
  - `Assets/Scripts/Prototype/PrototypeShipBlueprint.cs`: 0 errors, 0 warnings.
  - `Assets/Scripts/Prototype/PrototypeShipLayout.cs`: 0 errors, 0 warnings.
  - `Assets/Tests/Editor/PrototypeShipBlueprintBuilderValidationTests.cs`: 0 errors, 0 warnings.
- Unity MCP EditMode run `PrototypeShipBlueprintBuilderValidationTests`
  - Result: PASS, 5/5 tests.
  - Duration: 0.3368133 seconds.
  - Job id: `38f7517329af4c28b7ff1f0eec04c0d3`.
  - Note: A transient MCP runner initialization attempt failed before this run; the final targeted run succeeded after Unity reported ready for tools.
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".devtoolbox/specs/changes/ship-blueprint-builder-v0/tests/verify-ship-blueprint-builder.ps1"`
  - Result: PASS.
  - Evidence logs: `tests/logs/verify-ship-blueprint-builder-dotnet-build.log` and `tests/logs/verify-ship-blueprint-builder-dotnet-test.log`.
  - Note: The wrapper was rerun outside the filesystem sandbox after the sandbox blocked SDK cache access under `C:\Users\benni\AppData\Local\Microsoft SDKs`.

## Acceptance Mapping

- Data-driven module definitions, module instances, and blueprints: covered by `PrototypeShipBlueprint.cs` and `BuiltInBlueprintsValidateAndExposeTwoGeneratedVariants`.
- Two playable sample ships: Scout Blueprint and Hauler Blueprint are built into `PrototypeShipBlueprintCatalog` and exposed as generated variants.
- Mass/COM/fuel/thruster/RCS/gun behavior from parts: covered by `SampleBlueprintsDeriveDistinctMassFuelThrustRcsAndGunValues` and `BlueprintGeneratedVariantsSpawnPlayableRuntimeShips`.
- Deterministic validation: covered by `InvalidBlueprintReportsDuplicateMissingAndRequiredData`.
- No hardcoded imported demo hierarchy paths: covered by `BlueprintLayerDoesNotHardcodeImportedDemoHierarchyPaths`.
- Docs: README and `docs/physics-flight-model.md` describe the blueprint layer and sample ships.
