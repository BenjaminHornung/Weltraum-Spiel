# Tasks

## Spec
- [x] Decide whether to extend fix-blender-ship-kit-unity-import-vfx or create prototype-functional-ship-part-sockets-v0
- [x] Create/update proposal.md
- [x] Create/update design.md
- [x] Create specs/functional-ship-part-sockets/spec.md
- [x] Create specs/imported-ship-runtime-binder/spec.md
- [x] Create specs/thruster-vfx-runtime-binding/spec.md
- [x] Create specs/weapon-muzzle-binding/spec.md
- [x] Create specs/main-thruster-gimbal-binding/spec.md
- [x] Create specs/blender-export-socket-contract/spec.md
- [x] Run specs_validate

## Discovery
- [ ] Inspect PrototypeBootstrap generated nozzle/muzzle/VFX setup
- [ ] Inspect GunModule muzzle resolution and fallback behavior
- [ ] Inspect RcsThrusterController nozzle discovery and VFX expectations
- [ ] Inspect EngineVfxController nozzle resolution
- [ ] Inspect MainThrusterModule gimbal visual support
- [ ] Inspect PrototypeShipKitVfxBinder preview-only behavior
- [ ] Inspect manifest socket names and axis convention
- [ ] Inspect demo Scout/Cargo imported hierarchy in Unity

## Socket Contract
- [ ] Add PrototypeShipSocket component and enums
- [ ] Add socket detection helpers
- [ ] Support canonical runtime names and imported manifest names
- [ ] Document axis conventions
- [ ] Update manifest schema documentation

## Imported Runtime Binder
- [ ] Add PrototypeImportedShipBinder
- [ ] Detect and normalize main thruster sockets
- [ ] Detect and normalize RCS sockets
- [ ] Detect and normalize weapon muzzle sockets
- [ ] Configure MainThrusterModule/MainThrusterBank
- [ ] Configure EngineVfxController or per-nozzle VFX controllers
- [ ] Configure RcsThrusterController and RcsThrusterBlock
- [ ] Configure GunModule with actual muzzle
- [ ] Add binding diagnostics/report

## Weapon Fix
- [ ] Update GunModule muzzle resolution to support PrototypeShipSocket and *_MUZZLE
- [ ] Prevent fallback root Muzzle when real imported muzzle exists
- [ ] Add tests for projectile spawn from imported muzzle
- [ ] Add turret pivot metadata without implementing full turret AI

## Thruster VFX Runtime Binding
- [ ] Create or update PrototypeShipVfxLibrary
- [ ] Ensure Main Thruster VFX can be runtime-driven
- [ ] Ensure RCS VFX child named VFX exists for runtime controller or controller supports prefab child
- [ ] Ensure RCS VFX activates from actual nozzle throttle
- [ ] Preserve Preview VFX mode

## Gimbal Binding
- [ ] Add ConfigureGimbalVisualTransform or Configure overload to MainThrusterModule
- [ ] Bind imported gimbal pivot to MainThrusterModule
- [ ] Ensure visual engine bell rotates with gimbal
- [ ] Ensure VFX remains attached to nozzle
- [ ] Add gimbal/no-gimbal diagnostics

## Blender / Asset Update
- [ ] Open Blender ship kit via Blender MCP
- [ ] Add or normalize socket empties/aliases
- [ ] Add MainThrusterGimbal/MainThrusterNozzle structure to engine part
- [ ] Add RCS_Nozzle_* canonical aliases to RCS pods
- [ ] Add Muzzle canonical alias to gun/turret part
- [ ] Add TurretYawPivot/TurretPitchPivot placeholders
- [ ] Re-export demo Scout/Cargo
- [ ] Update prototype_ship_kit_manifest.json

## Tests
- [ ] Add editor test: imported Scout has main nozzle, RCS nozzles, muzzle
- [ ] Add editor test: GunModule resolves imported muzzle
- [ ] Add editor test: projectile spawn position equals imported muzzle position
- [ ] Add editor test: RcsThrusterController detects imported RCS nozzles
- [ ] Add editor test: RCS VFX child exists and toggles
- [ ] Add editor test: Engine VFX binds to imported main nozzle
- [ ] Add editor test: gimbal pivot rotates when gimbal command is applied
- [ ] Add editor test: binder is idempotent and does not duplicate VFX/sockets

## Verification
- [ ] Unity MCP refresh_unity
- [ ] Unity MCP read_console
- [ ] Unity MCP validate_script for changed scripts
- [ ] Unity MCP run_tests EditMode
- [ ] Open PrototypeShipKitPreview scene
- [ ] Verify visually: main/RCS/gun/gimbal effects use real sockets and not ship root
- [ ] Write tests/test-protocol.md
- [ ] Run tasks_completion_preflight before toggling tasks
