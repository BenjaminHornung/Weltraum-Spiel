# Test Protocol: fix-blender-ship-kit-unity-import-vfx

Date: 2026-05-20
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Scope

Validated the Blender low-poly ship kit asset repair, Unity import material readiness, and prototype thruster VFX binding. This run did not intentionally change flight physics, player control logic, RCS allocation, or the final ship-builder workflow.

## Blender Mesh And Export Verification

Source blend:
- `art/blender/prototype_modular_ship_kit_v0.blend`

Generated validation script/report:
- `art/blender/validate_ship_kit_meshes.py`
- `art/blender/ship_kit_mesh_validation_report.md`

Blender validation report result: PASS

Key report values:
- Object count: 411
- Mesh count: 264
- Material count: 13
- Meshes with material assignment: 264
- Connector/nozzle/muzzle empties: 99
- Negative scale objects: 0
- Meshes missing materials: 0
- Non-opaque materials: 0
- Loose vertices/edges/faces: 0 / 0 / 0
- Non-manifold edges: 0
- Boundary edges: 0
- Zero-area faces: 0
- Missing exports: 0

Export verification:
- Parts GLB: 9/9
- Parts FBX for Unity import: 9/9
- DemoShips GLB: 2/2
- DemoShips FBX for Unity import: 2/2

## Unity Import And Material Verification

Created canonical Unity material assets under:
- `Assets/Art/PrototypeShipKit/Materials/`

Structural material assets verified as opaque by Editor test:
- `MAT_Hull_DarkGrey`
- `MAT_Hull_Panel`
- `MAT_Cockpit_Glass_DarkBlue`
- `MAT_Fuel_Green`
- `MAT_Engine_DarkMetal`
- `MAT_Engine_Emission_Orange`
- `MAT_RCS_Cyan`
- `MAT_Weapon_YellowRed`
- `MAT_Cargo_Violet`
- `MAT_Connector_Lime`

Notes:
- Canopy uses opaque dark-blue material for this prototype.
- GLB files remain exported, but Unity runtime/preview import paths use the matching FBX assets because this project imports GLB as `DefaultAsset`.
- `PrototypeShipKitMaterialNormalizer` remaps imported material slots by canonical material names and fallback category names.

## Thruster VFX Verification

Created prototype ParticleSystem prefabs:
- `Assets/Art/PrototypeShipKit/VFX/Prefabs/MainThrusterVfx.prefab`
- `Assets/Art/PrototypeShipKit/VFX/Prefabs/RcsThrusterVfx.prefab`

Created helper scripts:
- `Assets/Scripts/Prototype/PrototypeShipKitMaterialNormalizer.cs`
- `Assets/Scripts/Prototype/PrototypeShipKitVfxBinder.cs`
- `Assets/Scripts/Prototype/PrototypeShipKitVfxPreview.cs`

Preview scene:
- `Assets/Scenes/PrototypeShipKitPreview.unity`

Diagnostic counts from Unity Editor code:
- partFbx: 9
- partGlb: 9
- demoFbx: 2
- demoGlb: 2
- canonicalMaterials: 10
- scoutMainBindings: 1
- scoutRcsBindings: 20
- previewScene: true
- mainVfxPrefab: true
- rcsVfxPrefab: true
- preview scene particle systems: 42

Binding rules verified:
- Main VFX attaches to transforms containing `THRUST_NOZZLE_MAIN`.
- RCS VFX attaches to transforms containing `RCS_NOZZLE_`, including side and vertical nozzles.
- Visual marker meshes named `VIS_PART_*`, `GEO_*`, or `*_Mesh` are ignored so VFX binds to connector/nozzle transforms rather than decorative marker geometry.
- VFX local rotation is `Quaternion.Euler(0, 180, 0)`, matching the project convention that nozzle forward is force direction and visible exhaust points opposite the nozzle forward axis.
- Re-running the binder creates no duplicate VFX children.

## Screenshot Evidence

Rendered from `Assets/Scenes/PrototypeShipKitPreview.unity` after simulating preview particles:
- `tests/screenshots/preview_front.png`
- `tests/screenshots/preview_rear.png`
- `tests/screenshots/preview_side.png`
- `tests/screenshots/preview_top.png`

## Unity MCP Verification

Refresh/console:
- `refresh_unity` completed after asset and scene generation.
- `read_console` reported no errors after script validation and tests.

Script validation:
- `Assets/Scripts/Prototype/PrototypeShipKitMaterialNormalizer.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PrototypeShipKitVfxBinder.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PrototypeShipKitVfxPreview.cs`: 0 errors, 0 warnings
- `Assets/Tests/Editor/PrototypeShipKitImportVfxValidationTests.cs`: 0 errors, 0 warnings

Unity tests:
- `PrototypeShipKitImportVfxValidationTests`: 4/4 passed
- Full Unity EditMode suite: 112/112 passed

Dotnet verification:
- `dotnet build 'Weltraum Spiel.sln'`: passed with existing Unity/reference warnings, 0 errors
- `dotnet test 'Weltraum Spiel.sln' --no-build`: exit 0

## Non-Scope Checks

- No final ship builder was implemented.
- No flight physics or RCS allocation logic was intentionally changed.
- No external asset packs were used.
- VFX is prototype ParticleSystem-based and ready for later runtime control by existing gameplay systems.
