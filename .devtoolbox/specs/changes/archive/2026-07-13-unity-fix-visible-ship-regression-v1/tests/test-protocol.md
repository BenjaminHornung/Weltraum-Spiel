# fix-visible-ship-regression-v1 Test Protocol

Date: 2026-05-23
Workspace: E:\Unity\Weltraum Spiel\Weltraum Spiel
Unity: 6000.4.7f1

## Scope

Bug: `PrototypeBootstrapHost.unity` could start with no visible ship when imported functional binding failed, because generated fallback was disabled and weapon/turret renderer validation was coupled to whole-ship functional readiness.

Conclusion: The regression matches Functional Blender / weapon binder fallback policy. It does not match the earlier camera jitter/performance fix.

## Implemented Fix

- `PrototypeBootstrapHost.unity` now allows generated fallback again for visible-ship safety.
- `PrototypeBootstrap` now separates imported flight failure from weapon/visual degradation and forces a visible generated fallback if imported flight sockets are missing.
- `PrototypeFunctionalShipBinder` now reports flight sockets, weapon sockets, visible weapon renderers, and imported renderer visibility separately.
- Missing visible turret yaw/pitch renderers no longer fail the whole ship spawn.
- Turret visual cloning now validates clone renderers before hiding original renderers.
- `PrototypeShipVisualSwitcher` keeps generated primitives visible unless the imported visual has an active enabled renderer.

## Build

Command:

```powershell
dotnet build "Weltraum Spiel.sln" --no-restore
```

Result: PASS, with known Unity/MCP assembly conflict warnings and obsolete Unity API warnings.

## Unity Script Validation

Unity MCP `validate_script` result: 0 errors for:

- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`
- `Assets/Scripts/Prototype/PrototypeFunctionalShipBinder.cs`
- `Assets/Scripts/Prototype/PrototypeShipVisualSwitcher.cs`
- `Assets/Tests/Editor/PrototypeFunctionalShipSocketValidationTests.cs`
- `Assets/Tests/Editor/PrototypeShipVisualSwitcherValidationTests.cs`
- `Assets/Tests/PlayMode/PrototypeFunctionalBlenderRuntimePlayModeTests.cs`

## Focused EditMode Tests

Unity MCP job: `0d48b44e121944e1bd31549e15494e1a`

Result: PASS 6/6

- `PrototypeFunctionalShipSocketValidationTests.FunctionalBinderUsesImportedDemoScoutAsRuntimeRootWithoutFallbacks`
- `PrototypeFunctionalShipSocketValidationTests.FunctionalBinderTreatsMissingTurretRenderersAsWeaponVisualDegradationOnly`
- `PrototypeFunctionalShipSocketValidationTests.FunctionalBinderCloneVisualChildrenLeavesOriginalVisibleWhenCloneHasNoRenderer`
- `PrototypeFunctionalShipSocketValidationTests.PrototypeBootstrapHostSceneAllowsGeneratedFallbackForVisibleShipSafety`
- `PrototypeShipVisualSwitcherValidationTests.ImportedVisualSwitcherKeepsGeneratedVisibleWhenImportedHasNoEnabledRenderers`
- `PrototypeShipVisualSwitcherValidationTests.ImportedScoutVisualKeepsGameplayRigAndCanReturnToGeneratedPrimitives`

## Focused PlayMode Tests

Initial run failed only because the latest `#PLAYER-HUD-V2` Basic preset intentionally leaves `PrototypeWeaponComputerPanel` hidden/collapsed. The assertion was updated to match current main behavior.

Unity MCP job: `025f4e5ac89149049defedae38802e23`

Result: PASS 2/2

- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeKeepsImportedScoutVisibleAndPlayableForTenSeconds`
- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeRegistersDefaultTargetForWeaponComputer`

Bootstrap diagnostic from passing PlayMode test:

```text
PrototypeBootstrap visibility diagnostics: buildMode=ImportedDemoScoutFunctionalDefault allowGeneratedFallbackWhenImportedAssetMissing=False useGeneratedFallbackBeforePolicy=False useGeneratedFallbackAfterPolicy=False hasRequiredFlightSockets=True hasRequiredWeaponSockets=True hasRequiredVisibleWeaponRenderers=True hasVisibleImportedShip=True missingRequiredSockets= missingWeaponSockets= missingVisibleWeaponRenderers= importedVisualRoot=True importedVisualRootActive=True importedShipInstance=ImportedDemoScoutVisual importedShipInstanceActive=True functionalSocketRig=True importedRendererCount=126 importedEnabledRendererCount=81 generatedRendererCount=0 generatedEnabledRendererCount=0 cameraTargetDistance=19.0
```

## Manual Play Mode Evidence

Unity MCP Play Mode check for `Assets/Scenes/PrototypeBootstrapHost.unity`:

- `PrototypeShip` exists.
- `ImportedShipVisual` exists and is active.
- `ImportedDemoScoutVisual` exists and is active.
- `FunctionalSocketRig` exists and is active.
- Game View screenshot shows the ship visible.

Artifacts:

- `tests/logs/bootstrap-visibility.log`
- `tests/screenshots/ship-visible-playmode.png`

## Notes

- Unity MCP `execute_code` failed with a CodeDom path-length style error in this environment, so hierarchy/resource checks and Game View screenshot capture were used instead.
- Unity console contains unrelated Unity Asset Manager SerializeReference warnings from existing dirty package/import state.
- Unrelated working tree changes in `Packages/`, `ProjectSettings/`, `uam/`, and other spec folders were left untouched.
