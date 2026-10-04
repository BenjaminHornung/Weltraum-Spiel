# Hestia Agent3 — Planner review package

## Start here

Open `index.html` in a browser: no installation, JavaScript, CDN, build or network dependency. It shows the actual retained real Blender cube next to the actual decoded compiler bricks. Navigation selects both explicit profiles and the real 90°-TRS rejection. This is a working **offline compiler review demo**, not a playable region or gameplay integration.

In this session the managed loopback server is running at **http://127.0.0.1:8769/**. It serves only this review directory. Screenshots in `screenshots/` were captured from this actual served demo at 1440×1050, plus a 390×844 mobile check, using Playwright, not generated concept images. SVG drawing is a deterministic presentation of data, not gameplay authority. Exact capture/check attribution is in `VISUAL_VERIFICATION.json`.

## Actual results

| Delivered real Blender cube | 0.125 m | 0.25 m |
| --- | ---: | ---: |
| Decoded occupied cells | 1000 | 216 |
| Sparse 16³ bricks | 4 | 2 |
| Package files / bytes | 8 / 24005 | 6 / 15198 |
| Original delivered GLB SHA | `52e2d51ec970e50c823a4120708ff9b407b8033f62d7728fe9bbb736f39d7ca9` | same |
| Package verification | PASS | PASS |
| Ordinary real 90°-TRS | `thin.unproven`, no output | `thin.unproven`, no output |

`data.json` and `packages/*/asset-manifest.json` bind the view to the real output files and tree hashes. Micro tree: `f69980c657ae375f9dfb9899845412f6d81ffb9d6256b8456f356d6c013677f7`. Standard tree: `51549b85a8d0b5699f9632840ef6b6d9d5ce04be9b0f81bd4a7682ea96e4edcb`. Both match the previously captured real Blender E2E. Cell count includes conservative boundary contact; do not equate raster volume with physical or analytic source volume.

## Existing evidence included, not rerun or re-labelled

Full evidence is under `evidence/`, reproducible compiler code under `source/`, original task package under `original-task/` in the final ZIP. Original C0–C8 and real Blender evidence keep their historical timestamps/statuses. The new visual-review run does not falsely turn old pending fields into new executions.

* 134 compiler tests + 58 Blender host tests passed at the recorded code freeze; compiler-only compileall passed.
* Exactly G01–G30, 185 variant-addressed / 179 byte-distinct inputs, 370 profile records ×10 actual executions: **285 SUCCESS / 77 EXPECTED_REJECTION / 8 reasoned BLOCKED** per logical set. Same-input complete byte identity and correctly remapped semantic ordering were verified.
* Real Blender 5.2.0 LTS/build `fbe6228777e7`, glTF exporter 5.2.39: real cube export→compile→validate→inspect PASS in both profiles; real rotation export succeeds but compiler proof is unsupported.
* Three independent scoped final reviews PASS_WITH_NOTES; later Blender followup and this visual demo have META self-review, not an invented new independent/human review.
* C8 Small diagnostic: actual 1008 input and expanded triangles / 672 vertices. Micro wall **10474.151 ms**, CPU **10093.750 ms**, 18144 cells / 504 bricks / 2407633 bytes. Standard wall **5267.0417 ms**, CPU **5062.500 ms**, 5376 cells / 420 bricks / 2036443 bytes. **CONTAMINATED_DIAGNOSTIC**, not a qualified performance comparison. Raw inclusive/nested/partial timings and bounds are in `evidence/C8_BENCHMARK.json` and `evidence/BENCHMARK.md`. Medium/Large exceed frozen budgets; memory unsupported. No new performance measurement for static rendering is claimed.

## Reproduction

From the provided source checkout (all executable paths on the recorded machine are under `C:\IFI_SourceCode`):

```powershell
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -X utf8 -m tools.hestia_asset_compiler.review_demo --output 'C:\IFI_SourceCode\Temp\Hestia-Review-Reproduction'
```

Use a **new, absent output directory**. The generator performs actual compile and package-file verification, never silently overwrites previous evidence. It also executes the actual rotated-input negative control. Run from the repository root; Blender-delivered input files are retained under the research directory. Open its `index.html` afterward.

```powershell
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -X utf8 -m unittest discover -s tools/hestia_asset_compiler/tests -p test_review_demo.py -v
```

For the portable archived static view, simply open `demo/index.html`; it does not require Python or Blender. To reproduce actual compiler execution, use `source/` as the checkout root. The archive retains the unchanged existing Blender authoring helper/schema needed by the compiler; it does not retain or install Blender itself.

## Planner decisions, not silent fixes

**Planner review instruction:** examine source, delivered packages, screenshots and raw evidence together. Confirm implemented versus unsupported/integrated status; assess the eight blocked records and the real TRS reproduction. Recommend the next bounded integration/proof work package with explicit contracts and acceptance tests. Do not turn this research acceptance into a gameplay, physical-mass, public-format or universal-authoring acceptance.

1. Specify a justified general rotation/thickness/topology proof or a deliberate authoring interoperability contract. Ordinary Blender 90° quaternion residuals are valid geometry but outside exact axis-aligned proof. Never snap silently.
2. Rod/tube and multilayer reconstruction, ambiguous multi-material volume ownership and physical density/inertia need their own contracts. No fabricated successful output.
3. Only after A+B+C evaluation define a trusted read-only runtime adapter: explicit material registry, profile/address/frame/identity policy, immutable accepted state and render projection. Terrain material 0 is not automatically this asset's Air slot.
4. Product/gameplay integration, destruction, cut execution, physics, saves and global profile adoption remain **NOT IMPLEMENTED BY AGENT3**. `PRODUCT_INTEGRATED = NO`.

Known residuals: seven invocation-owned Blender bytecode caches were created despite environment suppression and subsequently inventoried/removed; future real Blender replay must set `sys.dont_write_bytecode=True` inside its exporter process before imports. Native symlink test lacked privilege. One earlier publication I/O failure was non-reproducible, cause unknown. GWN was reasoned NO_ADOPTION, not an executed experiment.

## Package integrity

`PACKAGE_MANIFEST.json` lists exact relative paths, lengths and SHA-256 values for every archived payload file; excludes only itself to avoid self-hash recursion. Screenshots and measurement files are first-class payload entries. ZIP integrity and all manifest entries are checked after packaging. No secrets, unrelated worktrees, `.opencode` instrumentation, caches or foreign sessions are included.
