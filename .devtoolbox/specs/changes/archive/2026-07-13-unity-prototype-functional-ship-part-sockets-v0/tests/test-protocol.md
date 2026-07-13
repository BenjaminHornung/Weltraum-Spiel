# Test Protocol

Change: `prototype-functional-ship-part-sockets-v0`
Execution: `2eafc7276826469eb4160c59f994343a`
Date: 2026-05-20

## Scope

This verification covers the functional socket contract for the procedural Blender ship kit and Unity runtime binding:

- Main thruster nozzle, VFX binding, and gimbal pivot metadata.
- RCS nozzle sockets, runtime RCS VFX children, and RCS allocator compatibility.
- Weapon muzzle resolution for imported `*_MUZZLE` transforms.
- Builder hardpoint metadata in the manifest.
- Blender export/socket readiness for Parts and DemoShips.

## DevToolbox

- `specs_validate` passed for `prototype-functional-ship-part-sockets-v0`.
- Parsed artifacts: proposal, design, tasks, and 7 spec files.
- Parsed tasks: 70.
- `verify_run` executed and recorded the spec validation pass, but its default bare `dotnet build`, `dotnet test`, and `dotnet format` steps failed with `MSB1011` / multiple MSBuild files in the Unity root. This is the known project-local DevToolbox limitation; explicit solution-based verification below passed.
- `tasks_completion_preflight` was run before task toggling and blocked on the failed/default verification metadata, so remaining unchecked tasks were intentionally not toggled.

## Blender / Asset Verification

Blender validation report: `art/blender/ship_kit_mesh_validation_report.md`

- Result: PASS.
- Object count: 473.
- Mesh count: 266.
- Material count: 13.
- Connector/nozzle/muzzle empties: 101.
- Negative scale objects: 0.
- Meshes missing materials: 0.
- Non-opaque materials: 0.
- Loose vertices/edges/faces: 0.
- Non-manifold edges: 0.
- Boundary edges: 0.
- Zero-area faces: 0.
- Missing exports: 0.

Export verification:

- Parts GLB exports: 9.
- Parts FBX imports for Unity runtime: 9.
- DemoShip GLB exports: 2.
- DemoShip FBX imports for Unity runtime: 2.
- Blender source exists: `art/blender/prototype_modular_ship_kit_v0.blend`.
- VFX library exists: `Assets/Art/PrototypeShipKit/VFX/PrototypeShipVfxLibrary.asset`.
- Preview scene exists and loads additively: `Assets/Scenes/PrototypeShipKitPreview.unity`.

Manifest verification:

- Manifest parses as valid JSON.
- `kitId`: `prototype_low_poly_ship_kit_v0`.
- Parts: 9.
- DemoShips: 2.
- `socketContract` present.
- Total manifest socket records: 28.
- `main_engine_bell_mk1`: 3 sockets, 2 runtime sockets.
- `rcs_pod_4way_mk1`: 7 sockets, 6 runtime sockets including Up and Down.
- `gun_mount_light_mk1`: 4 sockets, 1 runtime muzzle plus turret pivot metadata.

## Unity Verification

Unity MCP refresh:

- `refresh_unity` completed after the editor became idle.
- Unity Editor Console has no project errors.
- Remaining console warning is the known MCP WebSocket warning: `WebSocket is not initialised`.

Unity MCP `validate_script`:

- `Assets/Scripts/Prototype/PrototypeShipSocket.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeImportedShipBinder.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/GunModule.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeShipVfxLibrary.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeShipKitVfxBinder.cs`: 0 errors, 0 warnings.
- `Assets/Tests/Editor/PrototypeFunctionalShipSocketValidationTests.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/EngineVfxController.cs`: 0 errors, 1 analyzer warning about Rigidbody work in `FixedUpdate`; existing runtime behavior is unchanged.

Unity EditMode tests:

- Job: `acf0c7075def45c1a6ebd596e0e2b387`.
- Test set: `PrototypeFunctionalShipSocketValidationTests`, `PrototypeShipKitImportVfxValidationTests`.
- Result: 9/9 passed, 0 failed, 0 skipped.

Runtime binding probe:

- Scout: `main=1`, `gimbal=1`, `rcs=20`, `muzzle=1`, `boundMain=1`, `boundRcs=20`, `boundGuns=1`, `rcsController=20`, `vfx=20`.
- Cargo: `main=1`, `gimbal=1`, `rcs=20`, `muzzle=0`, `boundMain=1`, `boundRcs=20`, `boundGuns=0`, `rcsController=20`, `vfx=20`.
- Single RCS part: `rcs=6`, `boundRcs=6`, `rcsController=6`, `vfx=6`.
- Raw imported hierarchies still include legacy plus canonical aliases; binder and RCS controller deduplicate them by socket type, direction, and position.

Preview scene probe:

- `PrototypeShipKitPreview.unity` loads additively.
- Socket tokens are present in the loaded scene hierarchy.
- Runtime VFX binding is verified through `PrototypeImportedShipBinder` and targeted EditMode tests; scene-saved preview-only VFX children are not required for this runtime socket change.

Local .NET verification:

- `dotnet build 'Weltraum Spiel.sln' --no-restore`: passed.
- Build warnings are existing Unity/MCP reference conflicts (`MSB3277`) and existing obsolete Unity API warnings in editor tests.
- `dotnet test 'Weltraum Spiel.sln' --no-build`: exit code 0.

## Notes

- The Cargo demo intentionally has no gun muzzle; the binder reports that as a warning and does not create a root fallback gun.
- The RCS base part now includes Up and Down runtime nozzles in addition to Forward, Back, Left, and Right.
- Visual nozzle geometry names such as `GEO_*` and `VIS_*` are ignored by runtime socket inference so they do not become extra thrusters.
- A few unrelated UI/control files were already dirty from parallel work. The functional socket implementation avoids manual per-ship effect positions and does not change flight physics allocation semantics.
