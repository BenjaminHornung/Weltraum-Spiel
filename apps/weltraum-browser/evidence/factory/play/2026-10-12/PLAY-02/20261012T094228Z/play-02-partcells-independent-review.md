# PLAY-02-PARTCELLS independent review

Reviewer: `/root/play_cell_bridge/independent_review`. Read-only source/spec review; no product edit, test, typecheck, browser, build, Blender, Native job or new agent was performed by this reviewer. This report is the sole reviewer output.

**Verdict: PASS for the bounded PLAY-02-PARTCELLS compiler lane on the fingerprints below. No actionable P0/P1/P2/P3 code finding was identified in the two authorized files.** This permits the writer to commit its exact two-file compiler slice. It does not establish accepted S1, a World/Native runtime pass, GLB controller/import acceptance, restore acceptance or human/Owner acceptance.

## Reviewed scope and source precedence

Worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-play-cells-2026-10-12`; observed HEAD `d76e5fa764a1e62fbe215c589b6aa8b18adf1040`. Before and after review, `git status --short` contains only the two authorized new untracked product paths; `git diff --name-only` is empty. No shared/product source mutation was observed.

Grant: Root control worktree `docs/factory/fp06/play/2026-10-12/grants/play-02-partcells-writer.json`, SHA256 `cb59311bd7d59fcfec9997129fb4777629bd6f9dd134cf0e5db6b846a516ea97`. The grant binds exactly `src/factory/presentation/factoryPartCells.ts` and `tests/unit/factory/factoryPartCells.test.ts` beneath `apps/weltraum-browser`.

Read AGENTS.md, README.md and current-mainline-state.md; the latter explicitly describes historical pinned main and is not treated as proof of this local candidate. Read current Root exec-plan.md (SHA256 `451ba97ed9765f4bea1645d02732901580edad24edb336f34002665a847b8809`) and the S1 read-only bridge preflight (SHA256 `7d639cba2daf532f1b4d63e16b89c698974f6507a5db956ee41ef8209783d2b7`). Read original FP01 §14.2, FP02 §3.5/B06/B07, and follow-up Review §7.4–7.5. The preflight is a design proposal; the two-file compiler review closes only its bounded source/cell lane.

## Contract assessment

| Requirement | Reviewed evidence and result |
| --- | --- |
| Closed original B06/B07 definition/source/version/frame/grid | `factoryPartCells.ts:77–91` admits only B06/B07, exact catalog/version/digest, raw-source and authoring string signatures/lengths, meter frame/origin, separate 0.25-m authoring and 0.125-m cell grids. `:114–133` compares the complete semantic source with the imported original and checks all authoring/part/joint signatures. Cache admission is repeated before a hit is returned (`:138–142`). PASS. |
| Exact native boxes and unchanged identity/ports/supports/joints/BOM/mass | No original source/profile/catalog file was modified; their hashes match the fresh receipts. The source census has 12/13 parts and 33/34 boxes. `:134–137` binds the existing installation profile, and `:159–162` retains its frozen source/profile evidence. Tests `:18–35` preserve the original profile, 208/341-kg masses, source ports/supports/joints and original authoring grid. The compiler creates no physical mass or BOM recipe. PASS within the pure lane. |
| Exact cells before occupancy allocation | `:95–112` rejects rotation, nonfinite/nonpositive dimensions, unknown render roles and noninteger 125-mm edges; it computes all part bounds before `new Uint8Array` at `:144`. No rounding/epsilon repair is used. PASS. |
| Per-part union and cross-part identity | Separate buffers are allocated per source part; original source-box order sets deterministic documented last-box render priority (`:145–148`). No cross-part culling or union exists. Test `factoryPartCells.test.ts:69–105` compares every bounded cell against the unchanged Native Cuboid recipe, checks deduplicated occupied counts, last-box slot priority, exact part digest and retained overlapping part owners. PASS. |
| Copy-safe frozen occupancy/cache | Private slots remain captured by closures, `copySlots` slices, read indices are validated, and returned metadata is deeply frozen (`:151–164`). Source products exclude mutable caller/instance ref aliases. Tests `:107–120` check buffer/ref isolation and frozen records. PASS. |
| Four semantic Slider parents | `:128–132` requires four distinct source joint children, exact original joint digest, Slider type and the correct original frame parent. `semanticParents` is frozen. Both original authoring files bind tool, infeed carriage, clamp and outfeed carriage to cutter_frame/former_frame; tests `:123–129` verify both sets/digests. PASS. |
| Existing mesher, accepted material profiles and MeshArtifacts | `:173–188` obtains accepted Factory profiles, calls the actual `meshHvpOccupancy`, maps local render-role slots to those existing profiles and uses `createMeshArtifact`. No physical HVP material/density/ingest/World path is introduced. Instance-specific keys and fresh snapshot buffers remain uncached; tests `:132–152` exercise actual mesher geometry, validation, profile equality and instance/caller isolation. PASS. |
| Bounds/budgets and no global raise | Local bounding occupancy ceiling is 32,768 cells; all three dimensions must remain below the existing packed-mesher 1024 limit. Local visited/quads/vertices/indices caps are 32,768/196,608/786,432/1,179,648 (`:176–178`), below unchanged shared-mesher defaults 8,388,608/250,000/1,000,000/1,500,000. A per-part maximum of 393,216 triangles is below the existing 500,000 scene cap. Exact source bounding sums are 10,504/21,680 cells, largest parts 6,912/16,896. No shared cap changed. Combined Host retained/transient costs, draws and scene admission remain the sole Integrator's separate required responsibility. PASS for local bounds; no combined ledger claim. |
| Meaningful rejection coverage | Tests reject foreign/stale definitions, altered getter source/revision/frame/part/motion, off-grid/rotated/oversized/palette data, changed raw source bytes and changed authoring parent/part/schema (`:37–66`, `:155–171`). The complete business RED exercised callable empty functions and failed all 28 tests, distinct from fixture/import/collection failures. PASS for this focused contract. |

The raw-source admission uses the repository's deterministic canonical FNV signatures, explicitly documented in the code as noncryptographic. Returned SHA256 fields are pinned provenance labels; the reviewer separately checked their actual source file hashes against the source and fresh receipt fingerprints. This is a closed checked-in-source derivative, not an untrusted general asset compiler.

## Fresh verification receipts reviewed, not rerun

All current compiler/test/source/profile/mesher SHA256 inputs in runs 05 and 06 were recomputed by this reviewer and matched. Both raw-log hashes also matched. Source fingerprint capture: `2026-10-12T09:24:35.152650+00:00`.

- `02-complete-business-red`: focused 28/28 tests failed intentionally on the empty callable scaffold; exit 1; raw log SHA256 `27a96523f3ea2de2286f38d3c49f669922d04afb23b7e2825ed523eed84a96f8`. The unchanged final test file has the same SHA256 as this complete RED.
- `03-focused-green` is retained historical FAIL: 26 passed/2 failed, exit 1. `04-original-typecheck` is retained historical FAIL: literal-role Map key typing, exit 1. These are not presented as successful runs. Current `Map<string,number>` and legal colon algorithm-version separator address the observed errors.
- `05-focused-regression-green`: `npm run test -- tests/unit/factory/factoryPartCells.test.ts tests/unit/factory/presentation.test.ts`; 09:23:04.471412–09:23:07.314153 UTC, exit 0; **44/44 tests, two files passed** (28 new compiler tests plus 16 existing presentation tests). Raw log SHA256 `29e3b36d412694b682f0d9f5cb0d1ca7611de50f5aa96237f22e578363fc8a92`.
- `06-original-typecheck`: `npx tsc -p tsconfig.json --noEmit`; 09:23:07.314330–09:23:10.438245 UTC, exit 0. Its empty stdout is corroborated by the actual command receipt and exit status; it is not treated as stand-alone pass evidence. Raw log SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Both successful commands used `/workspace/.cloud-setup/activate.sh` in cwd `/workspace/Weltraum-Spiel/.worktrees/fp06-play-cells-2026-10-12/apps/weltraum-browser`; exact argv, UTC, exits and inputs remain in the sibling `.command.json` files.

## Product/source fingerprints

Paths below are repository-relative. All are observed actual bytes and match the 05/06 receipts.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| apps/weltraum-browser/src/factory/presentation/factoryPartCells.ts | 14,059 | `59572d57d473c26e58898c6f6417cbd68777d53a0e570268114e36d70c9ccdd8` |
| apps/weltraum-browser/tests/unit/factory/factoryPartCells.test.ts | 10,788 | `127c6db8a63c952917884738af2cb8cdb5c813aa30588647e8e28f06b7f80d69` |
| apps/weltraum-browser/src/factory/presentation/factoryAssets.ts | 14,061 | `a9d707c53d8ae401e952076007aff523bcec127f4c0b58d37020aaea9ced973c` |
| apps/weltraum-browser/src/factory/construction/installationProfile.ts | 5,568 | `4e5d3f027da5aef0ba68243b911c55d7558eab86477e2ebd3e134a26f82d8b8b` |
| apps/weltraum-browser/src/hvp/hvpCoastMesher.ts | 41,736 | `b41750395c78426e2c8b75325af91c72c01b7e2342607c60fae7fdf1c868503c` |
| art/factory/fp02/cutter/source.scene.json | 19,222 | `abd1ce25fd19ad61a9cb65de9f5ba10c303aa5c1a1aa16260de9dce9534fa5fd` |
| art/factory/fp02/cutter/authoring-v1.json | 5,596 | `0cdb071fb15c5b7c5ee57fa5f10685b8919b741adbe0d10c5e7f47f93cca1a61` |
| art/factory/fp02/former/source.scene.json | 19,487 | `4e27abd922e46516d1db0307b8dfb5edaf1b8c6807e80006781344b9dfcf535d` |
| art/factory/fp02/former/authoring-v1.json | 5,889 | `31500d6c38d06be22226940222c8abcba5d2e9e48483e36293910da71575c34b` |

Additional read contracts: presentation/validation.ts SHA256 `e93eadb015c284865184a997b9542fc351ab4c0b4f67247a9adb80890bafb1ff`, presentation/meshArtifact.ts `a0b0d23160b37de3ec5cc17f9688c9d54123d4faf4af16da9cd300f5542e9af0`, hvp/hvpCoastSource.ts `2f3fd41bea2edb1756f1b7933ac0243ee98c1e742bb4c6fe26b6756f70b09408`.

## Acceptance limit

The exact compiler slice is suitable for its writer commit and later Integrator adoption. Actual same-World native part observation, confirmed-work publication, semantic-parent removal/motion binding, reviewed GLB admission, full hidden-stage/publish/disposal/ledger integration, normal-game Cutter/Former evidence and complete W10 restore remain separate acceptance work. **Compiler/typecheck success alone cannot claim S1, World-Art or Owner PASS.**
