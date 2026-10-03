# Real Blender exporter → compiler followup — accepted with notes

Executed 2026-10-03 under the same Agent3 lease. **Plain closed cube: real E2E PASS in both profiles. Ordinary authored 90° TRS: real export and finite closed geometry PASS, compile REJECTED `thin.unproven` in both profiles.** Current followup status is **ACCEPTED_WITH_NOTES by external user-relayed META**, not blanket authoring interoperability, human review, product integration or a release. `PRODUCT_INTEGRATED = NO`. Exact additive research commit is authorized; no compiler/exporter/schema/runtime source change, new tracking/agents/services/dependencies or verification rerun. Writer stops after commit, without push/amend/merge.

The previous `EXECUTION_ROOT_BLOCKER` is resolved by the user-provided approved-root binary, not by changing historical C7/C8 captures. E2E capture HEAD and authorized additive commit parent: `de0f405f2d0e1084d0fa7f993d3cf74761b66dca`; compiler code/review freeze `c8e451a3e52fc8da743df011debae682f93c89a3`, compiler Git tree `a458f03f2aae82846a666ce29d57ec1f6505ab94`. The 25-source manifest SHA remains `c2a6c63cb94f2f24d29e3a727cc1f72e88ca90e60d26a504886d291118cf7e1a`. Original C8 disposition and all immutable evidence remain intact. Actual additive Git SHA is reported externally after commit, never predicted within itself.

## External focused META review and acceptance — 2026-10-03

User relays **ACCEPTED_WITH_NOTES** after META read this document and independently checked retained REAL delivered inputs using the approved Ctree Python with `-B -X utf8`. The review program replays `compile_core` → `verify_files` in memory; reported Exit **0**, no Blender invocation, TEMP or native publication writes. The exact inline program body was not supplied in the relay and is not reconstructed or claimed as this writer's command. This is one focused external META review, **not another three-agent review or human review**.

| External check / actual result | Result |
| --- | --- |
| Four retained input SHA pins | PASS |
| Plain / micro: 1,000 cells, tree `f69980c657ae375f9dfb9899845412f6d81ffb9d6256b8456f356d6c013677f7` | Independent in-memory compile + file verification PASS |
| Plain / standard: 216 cells, tree `51549b85a8d0b5699f9632840ef6b6d9d5ce04be9b0f81bd4a7682ea96e4edcb` | Independent in-memory compile + file verification PASS |
| Real 90° TRS / both profiles | `thin.unproven` independently confirmed; expected known unsupported proof, not blanket E2E PASS |
| Execution JSON 81,458 bytes / cleanup JSON 2,340 bytes | Independently read and SHA-matched to the unchanged pins below |
| Seven owned generated caches and exclusive removal | Explicitly accepted NOTE; never a zero-source-write claim |

`BLENDER_E2E_CHECKS.json: independentFollowupReview=PENDING_META` truthfully describes its immutable pre-review capture, not current document acceptance. Raw execution/cleanup/checks JSON, retained inputs, historical C7/C8 PENDING/NOT RUN bytes and the exact executed helper remain unchanged. No past code is rewritten to pretend cache prevention worked. META authorizes exactly the eleven leased research paths and normal additive commit `test(asset-compiler): record real Blender exporter E2E evidence`. Fresh diff/lease/source-freeze/hash/staged-byte checks precede commit; final SHA/parent/files/cleanup are reported externally. Writer does not repeat Blender, tests, corpus, benchmark or META's replay. META owns later commit validation and normal same-branch push.

## Actual runtime and exporter

* Binary: `C:\IFI_SourceCode\Utils\Blender 5.2\blender.exe`; actual child output **Blender 5.2.0 LTS / build fbe6228777e7 / 2026-07-14 01:35:40**. Embedded Python **3.13.13 / Win64**. Host compiler interpreter is the approved Python **3.12.13**, not Blender's Python.
* Actual `io_scene_gltf2.bl_info.version`: **5.2.39**; delivered GLB generator `Khronos glTF Blender I/O v5.2.39`. Module SHA `0cd8903bd1a72ef1edbd728bee70d24a3ecc93c9901db68927b00910bb38be70`. No exporter installation or source modification.
* Existing documented CLI `tools/blender/hestia_asset_authoring/export_hestia_glb.py`, not a replacement exporter or synthetic GLB/report builder. Collection `HestiaE2E`, `--unapplied-scale warning`. Exact snake_case properties are recorded in machine fixture metadata and canonical report/GLB extras.
* Explicit existing operator options: `export_format=GLB`, `use_selection=True`, `export_extras=True`, plus the invocation's temporary filepath. `export_custom_properties` is **not available**, so the existing adapter correctly does not pass it. All 111 available RNA properties and captured factory defaults are in [BLENDER_E2E.json](BLENDER_E2E.json), not assumed from a different Blender version.
* Relevant captured defaults: `export_yup=True`, `export_apply=False`, normals/texcoords `True`, materials `EXPORT`, animations `True`, Draco compression `False`, shared accessors `False`. These are runtime defaults, not newly pinned public authoring policy; only the existing explicit adapter kwargs were supplied. No compression extension was used in the delivered cube transport.

## Actual commands and bounds

Workdir: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-Agent3-AssetCompiler-2026-10-02`. Every executable/script/cwd/TEMP is under `C:\IFI_SourceCode`. Exact per-child argv, stdout/stderr and raw-stream hashes are in BLENDER_E2E.json. No retry. Each child timeout **180 seconds**, outer command bound **360 seconds**; all returned normally.

Executed launcher (Exit **0**):

```powershell
$env:TEMP='C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a'; $env:TMP=$env:TEMP; $env:PYTHONDONTWRITEBYTECODE='1'
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -X utf8 docs/research/hestia-asset-compiler-spike-2026-10-02/verify_blender_e2e.py
```

The helper is retained **exactly as executed**, SHA `82836485da250da9fcacd0583fdbfe55b397525ea70dc59b8784c4e0b3b2e836`, exclusive-create evidence/no overwrite. It must **not be replayed unchanged**: see the explicit bytecode deviation below. Historical executed script/command bytes were not altered to pretend this deviation was prevented.

Actual owned generation was `C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a\blender-e2e-tz5zplil`, now removed. `--background --factory-startup --python-exit-code 1` was used for all three Blender invocations. First, the own helper's `-- fixture <generation>` created and saved two actual `.blend` files with `bpy`. Then, separately for each owned `.blend`:

```text
"C:\IFI_SourceCode\Utils\Blender 5.2\blender.exe" --background --factory-startup <owned variant.blend> --python-exit-code 1 --python <worktree>/tools/blender/hestia_asset_authoring/export_hestia_glb.py -- --output <owned variant.glb> --collection HestiaE2E --unapplied-scale warning
<approved Python> -B -X utf8 -m tools.hestia_asset_compiler compile --glb <actual delivered GLB> --report <actual sidecar> --profile <explicit profile> --output <new owned target>
<approved Python> -B -X utf8 -m tools.hestia_asset_compiler validate <actual successful package>
<approved Python> -B -X utf8 -m tools.hestia_asset_compiler inspect <actual successful package> --json
```

The expanded literal paths/argv for all **11 actual children** are captured in JSON. No GUI or user file was opened. User config/scripts/data paths were isolated to the invocation-owned generation. The factory scene's default objects were removed only in the new in-memory fixture; no external `.blend` was loaded or overwritten.

## Results and actual delivered bytes

Both fixtures have one 1-m closed Solid cube, one material, Reject thin policy, declared minimum 1 m, unit scale and translation `(0.5,1,1.5)` in Blender. The second changes only authored Euler Z rotation to 90°; it is **not applied/snapped**. Reports have **zero diagnostics**. Evaluated inventory: **8 vertices / 12 edges / 6 polygons / 12 triangles**, zero boundary/nonmanifold/degenerate counts. Actual GLB: one reachable mesh/primitive, **24 POSITION rows** due normal/UV seams, 36 indices, **12 canonical triangles / 8 distinct world vertices / one closed component**. Inventory and accessor counts need not be equal; no fake count-parity claim.

| Variant / profile | Export Exit | Compile Exit / outcome | Validate / Inspect | Owned cells / bricks | Published files / bytes |
| --- | ---: | --- | --- | ---: | ---: |
| Plain / micro-0125-research-v1 | 0 | 0 / SUCCESS | 0 / 0, PASS | 1,000 / 4 | 8 / 24,005 |
| Plain / standard-025-v1 | 0 | 0 / SUCCESS | 0 / 0, PASS | 216 / 2 | 6 / 15,198 |
| 90° TRS / micro-0125-research-v1 | 0 | 1 / KNOWN_UNSUPPORTED_PROOF `thin.unproven` | NOT APPLICABLE — no package | NOT APPLICABLE | No target created |
| 90° TRS / standard-025-v1 | 0 | 1 / KNOWN_UNSUPPORTED_PROOF `thin.unproven` | NOT APPLICABLE — no package | NOT APPLICABLE | No target created |

Fixture creation Exit0; each actual export Exit0/stderr empty. Compile/validate/inspect JSON agrees for each successful package, with actual-byte package verification and unchanged delivered sources. Per-file inventories and manifest/hash/proof fields are captured before owned package cleanup. Contact-inclusive cells are not analytic volume or physical mass. Micro tree `f69980c657ae375f9dfb9899845412f6d81ffb9d6256b8456f356d6c013677f7`; standard tree `51549b85a8d0b5699f9632840ef6b6d9d5ce04be9b0f81bd4a7682ea96e4edcb`.

Actual retained GLB/report bytes live under `BLENDER_E2E_INPUTS/`, not generated substitutes:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `plain-cube.glb` | 2,576 | `52e2d51ec970e50c823a4120708ff9b407b8033f62d7728fe9bbb736f39d7ca9` |
| `plain-cube.hestia-authoring-report.json` | 1,660 | `2dad2dac080f61c46c94395655c7f1b7fc47c15e995d321f9b0c0c757f0bd8f5` |
| `rotation-z-90.glb` | 2,632 | `db3594fa54750fe1a7ecaeea30c054a421aada7b4b055904fbc980d66d032b9c` |
| `rotation-z-90.hestia-authoring-report.json` | 1,663 | `0b1d520447270b54716b1f179c921eb34b3619e9123c3f739f83d1abe0bb4b30` |

The helper independently rehashed both delivered GLB bindings and canonical report-payload preimages. Payload hashes: plain `dcbc9c6dbe960760a62156b51e105b30e52d35b358819f097b40422673e81e5f`; TRS `3c20dde15cab661c11380bcfc7f9ae383d3ebca666dc6259074204e09635aa6c`. Whole report byte hashes above are different preimages. Original `.blend` byte lengths/hashes and authored matrices/vertices are captured, but the scratch `.blend` files are not retained.

## Frame, finite geometry and known TRS limitation

Report/GLB semantics say **metersPerUnit=1, +Y up, +Z forward, RIGHT**. With actual `export_yup=True`, Blender world `(x,y,z)` maps to glTF `(x,z,-y)`. The plain Blender world bounds `[(0,0.5,1),(1,1.5,2)]` become exactly `[(0,1,-1.5),(1,2,-0.5)]`, the actual compiler world bounds. Local report bounds stay `[-0.5,0.5]^3` and are provenance, not baked world truth.

The real 90° transport emits quaternion **`[0,0.7071068286895752,0,0.7071068286895752]`**, translation `[0.5,1.5,-1]`. The compiler accepts its unit-quaternion input tolerance and bakes finite, nonsingular, closed geometry without renormalizing. Its matrix has diagonal residual **`-1.3435885648505064e-7`** and off-diagonal magnitude **`1.0000001343588565`**. Actual bounds are `[(-1.3435885648505064e-7,1,-1.5000001343588565),(1.0000001343588565,2,-0.4999998656411435)]`. This is valid non-exact-orthogonal geometry, not invalid rotation. The existing exact orthogonal section proof is unavailable, so both compile commands truthfully reject before publication with `thin.unproven`. This reproduces the known G05/G06 interoperability limit; no proof/cap/schema/Exporter fix, snap, normalization or Shell relabel was attempted. It is **not an all-assets E2E PASS**.

## Observed deviation, cleanup and review boundary

`PYTHONDONTWRITEBYTECODE=1` was set, and the own fixture process sets `sys.dont_write_bytecode=True`. Nevertheless, the **separate existing-exporter Blender processes created seven new CPython313 `.pyc` files** under `tools/blender/hestia_asset_authoring/__pycache__`. Therefore strict no-source-tree-write prevention was **NOT achieved**, even though no tracked source code changed. This is explicitly reported, not hidden as zero writes. Fresh initial status contained no such untracked paths; the exact seven-file generated set was inventoried and removed with only its newly empty cache directory. No foreign cache/process/file cleanup. [BLENDER_E2E_CLEANUP.json](BLENDER_E2E_CLEANUP.json) records their paths/bytes/hashes and zero final source caches/TEMP entries. Future execution must explicitly set `sys.dont_write_bytecode=True` **in the exporter process before its entrypoint**, not rely on environment alone. No rerun was made to cosmetically replace the original evidence.

Fixture preparation also prints two RNA enum-default introspection warnings and one `Material.use_nodes` deprecation warning. These are preserved in stdout/stderr; they are not authoring-report errors or failed export. Both actual exports have empty stderr and zero report diagnostics. No new upstream source bug is asserted or fixed.

Raw execution JSON: **81,458 bytes / SHA `dce2d851f30ab44bb754afce2b5534cfb5eb20ea4c1bf41dd593470ae3a031b2`**. Separate cleanup JSON: **2,340 bytes / SHA `ebbe973934f0a14a83f41d1b631668c7b40c386ba3cf38bff95fa3a3e7f38e1e`**. Raw execution's owned-generation cleanup fields concern its own TEMP generation, not a claim that source caches never existed; the later cleanup evidence records that distinction. Retained inputs and new evidence are additive leased research paths only. Historical C7/C8 machine evidence and captured NOT RUN/PENDING fields remain byte-identical and historical.

Historical own checks: `BLENDER_E2E_CHECKS.json` records PASS_WITH_DOCUMENTED_CACHE_DEVIATION for delivered input/payload/stream hashes, all11 native exits, source/frame/finite closed geometry, captured outcomes, unchanged eight old artifacts/helper plus golden pins/25-source manifest, helper syntax-only, doc links/whitespace, tracked lease/index and cleanup. Actual native package-byte verification happened before scratch cleanup; the later independent META replay used retained inputs and in-memory packages, not those removed directories. Current external focused acceptance is recorded above without changing captured PENDING_META. Native symlinks NOT RUN/1314, eight historical support BLOCKED records, general TRS/rod/tube/multilayer proof gaps, contaminated performance/unsupported memory and once-UNKNOWN publication IO risk remain. Runtime/renderer/HVP/format adoption is still NO. **STOP AFTER the exact authorized additive commit; no push/amend/merge or reruns.**
