# Sci-Fi Styled Modular Pack Evaluation

Date: 2026-06-18  
Asset: `Sci-Fi Styled Modular Pack`  
Source package: `C:\Users\benni\AppData\Roaming\Unity\Asset Store-5.x\karboosx\3D ModelsEnvironmentsSci-Fi\Sci-Fi Styled Modular Pack.unitypackage`  
Import root: `Assets/Sci-Fi Styled Modular Pack/`  
Checkout policy: evaluated directly on `main` per user instruction; no product scene changes.

## Scope

- Imported only `Sci-Fi Styled Modular Pack`.
- Kept content vendor-isolated under `Assets/Sci-Fi Styled Modular Pack/`.
- Did not copy prefabs into `Assets/_Weltraum`.
- Did not modify existing scenes or product scenes.
- Did not touch `Assets/Scripts/Prototype`.
- Did not perform material/shader remediation; compatibility is documented as a risk.

## Imported Inventory

Unity AssetDatabase scan after import:

| Type | Count |
| --- | ---: |
| `.anim` | 16 |
| `.controller` | 4 |
| `.fbx` | 202 |
| `.mat` | 24 |
| `.png` | 23 |
| `.prefab` | 152 |
| `.txt` | 1 |
| `.unity` | 2 |

Total non-folder main assets: 424.  
Imported folders: 26.  
Prefabs: 152.  
Demo scenes: 2.

Demo scene paths:

- `Assets/Sci-Fi Styled Modular Pack/Example scenes/outpost on desert.unity`
- `Assets/Sci-Fi Styled Modular Pack/Example scenes/outpost with snow.unity`

## Static Compatibility Findings

- Runtime/editor scripts: none imported (`MonoScript=0`, no `.cs` files under the package root).
- Custom shader files: none imported (`Shader=0`, no `.shader`, `.shadergraph`, `.compute`, `.hlsl`, or `.cginc` files under the package root).
- Prefab script references: none found in the 152 imported prefabs.
- Demo scene script reference issue: `outpost with snow.unity` contains one `m_Script` reference to GUID `dbf7dc3bb84e0fd439f2310aef0205da`; no matching `.meta` file exists in `Assets/`, so that demo scene likely has a missing-script reference.

## Unity Validation

Unity MCP validation was run in the active Unity Editor:

1. Forced AssetDatabase refresh with Unity MCP.
2. Imported the `.unitypackage` directly into the active `main` checkout via `AssetDatabase.ImportPackage(packagePath, false)`.
3. Confirmed root exists and inventory counts via AssetDatabase.
4. Cleared the Unity console.
5. Reimported only `Assets/Sci-Fi Styled Modular Pack` recursively with `ForceUpdate | ImportRecursive`.
6. Read warnings/errors from the Unity console.

Result: validation is **not clean**. The isolated recursive reimport produced 21 warning/exception entries. Representative exception:

```text
MaterialLocation.External is obsolete. External Material Location is no longer supported.
```

Representative affected model paths from the current validation run:

- `Assets/Sci-Fi Styled Modular Pack/Models/hologram_LOD1.fbx`
- `Assets/Sci-Fi Styled Modular Pack/Models/decorative_wall_3_LOD1.fbx`
- `Assets/Sci-Fi Styled Modular Pack/Models/window_big_blocker.fbx`
- `Assets/Sci-Fi Styled Modular Pack/Models/decorative_wall_4_computer_LOD1.fbx`
- `Assets/Sci-Fi Styled Modular Pack/Models/floor_1_LOD1.fbx`

Because no scripts were imported, `dotnet build "Weltraum Spiel.sln" --no-restore` was not required for this evaluation.

## Suitability Assessment

The pack is visually relevant as vendor-isolated reference/blockout content for sci-fi interiors, outposts, corridors, machines, windows, doors, floors, stairs, and hangar-like modular spaces. It is **not product-ready** for Clean Core use yet because Unity 6000.4.7f1 reports FBX material import compatibility exceptions and one demo scene likely contains a missing script reference.

## Recommendation

Keep the imported pack only as isolated evaluation/vendor content for now.

Do not migrate assets into `Assets/_Weltraum` or use the demo scenes as product scenes until a later curation pass verifies:

- Unity 6000 material import remediation or explicit acceptance of the `MaterialLocation.External` risk.
- Render-pipeline/material appearance in the target scene setup.
- Scale, pivots, colliders, LOD behavior, and light usage.
- Scene manifest compliance for any future TestRange or VerticalSlice scene.
- No Prototype dependencies and no missing scripts in curated prefabs/scenes.
