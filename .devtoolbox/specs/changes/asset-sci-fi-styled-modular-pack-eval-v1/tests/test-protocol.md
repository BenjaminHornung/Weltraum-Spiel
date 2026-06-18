# Test Protocol: Sci-Fi Styled Modular Pack Evaluation

Date: 2026-06-18  
Change: `asset-sci-fi-styled-modular-pack-eval-v1`  
Checkout policy: direct `main` work per user instruction; no branch/worktree used for the final import.

## Objective

Evaluate the Unity Asset Store package `Sci-Fi Styled Modular Pack` as candidate content for Weltraum stations/outposts/hangar/TestRange/SpaceVerticalSlice without modifying product scenes, Prototype scripts, or Clean Core assets.

## Preconditions and Context

Reviewed project constraints from:

- `AGENTS.md`
- `docs/architecture/scene-management-v1.md`
- `docs/architecture/prototype-legacy-boundary-audit-2026-06-15.md`
- `docs/roadmap/milestones.md`
- `docs/current-prototype-state.md`
- `docs/assets/asset-store-evaluation-2026-06-18.md`

Important constraints:

- Import only this asset.
- Keep vendor content isolated.
- Do not modify existing scenes or product scenes.
- Do not touch `Assets/Scripts/Prototype`.
- Do not copy prefabs into `Assets/_Weltraum`.
- Document material/shader/import issues instead of silently fixing them.

## Import Steps

Package source:

```text
C:\Users\benni\AppData\Roaming\Unity\Asset Store-5.x\karboosx\3D ModelsEnvironmentsSci-Fi\Sci-Fi Styled Modular Pack.unitypackage
```

Final import method on `main`:

```csharp
AssetDatabase.ImportPackage(packagePath, false);
AssetDatabase.Refresh();
```

Imported root:

```text
Assets/Sci-Fi Styled Modular Pack/
```

## Inventory Evidence

Unity AssetDatabase count after import:

```text
rootExists=True
folders=26
mainAssetFiles=424
extCounts=.anim=16, .controller=4, .fbx=202, .mat=24, .png=23, .prefab=152, .txt=1, .unity=2
monoScripts=0; shaders=0; prefabs=152; scenes=2
```

Static file scan found:

```text
scripts=0
shaderFiles=0
prefabScriptRefs=0
sceneScriptRefs=1
unresolvedSceneScriptRefs=1
```

Unresolved demo-scene script reference:

```text
Assets/Sci-Fi Styled Modular Pack/Example scenes/outpost with snow.unity
guid: dbf7dc3bb84e0fd439f2310aef0205da
```

## Unity Console Validation

Validation sequence:

1. `unityMCP_refresh_unity` with `mode=force`, `scope=assets`, `compile=none`, `wait_for_ready=true`.
2. `unityMCP_execute_code` importing the `.unitypackage` via `AssetDatabase.ImportPackage`.
3. AssetDatabase inventory scan.
4. `unityMCP_read_console` clear.
5. `unityMCP_execute_code` recursive reimport of `Assets/Sci-Fi Styled Modular Pack` using `ForceUpdate | ImportRecursive`.
6. `unityMCP_read_console` for errors/warnings.

Observed console result after isolated recursive reimport:

```text
total warning/exception entries: 21
primary exception: MaterialLocation.External is obsolete. External Material Location is no longer supported.
```

Representative affected paths:

```text
Assets/Sci-Fi Styled Modular Pack/Models/hologram_LOD1.fbx
Assets/Sci-Fi Styled Modular Pack/Models/decorative_wall_3_LOD1.fbx
Assets/Sci-Fi Styled Modular Pack/Models/window_big_blocker.fbx
Assets/Sci-Fi Styled Modular Pack/Models/decorative_wall_4_computer_LOD1.fbx
Assets/Sci-Fi Styled Modular Pack/Models/floor_1_LOD1.fbx
```

## Build/Test Decision

`dotnet build "Weltraum Spiel.sln" --no-restore` was not run because the package imported no C# scripts (`MonoScript=0`, no `.cs` files under the imported root). No runtime code changed.

## Result

The evaluation completed, but the asset is **not cleanly import-compatible** in the current Unity version due to FBX `MaterialLocation.External` exceptions. The pack remains usable only as isolated evaluation/blockout content unless material import compatibility is remediated or explicitly accepted.

## Definition of Done Check

- [x] Asset imported directly on `main`.
- [x] Import root remains vendor-isolated under `Assets/Sci-Fi Styled Modular Pack/`.
- [x] Inventory documented.
- [x] Scripts/shaders checked.
- [x] Unity console validation run through Unity MCP.
- [x] Import compatibility risk documented.
- [x] `dotnet build` skipped with rationale.
- [x] No intentional `Assets/Scripts/Prototype` changes.
