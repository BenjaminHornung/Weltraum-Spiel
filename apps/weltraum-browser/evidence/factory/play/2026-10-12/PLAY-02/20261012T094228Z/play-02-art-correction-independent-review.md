# PLAY-02 corrections R2 / R6 / R3 — independent bounded review

Reviewer `/root/play_art_review`; read-only product inspection. Only this report was written. No tests, build, Blender, browser/GPU, generator execution, product/index/branch mutation, new compiler plan or subagent. The recorded actor runs below were inspected, not rerun.

Reviewed worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-play-art-2026-10-12`; actual HEAD/base `e752cc7fce43a50b4bcb4800d9d27584b44b6a0e`. Corrections are **staged, not committed**, with writer HOLD. Root correction grant: `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/play/2026-10-12/grants/play-02-art-corrections.json`.

Primary inputs: `correction-report.md`, `10-review-package.json`, `09-correction-full.patch`, actual staged source and materialized payloads. Full patch SHA256 `867830fac37e1bc800952c6ea7e9ffb6150709b35c242e63f03731289b0c783f` matches both the package and the actual `git diff --cached --binary` bytes. Manifest mirrors SHA256 `f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1`.

## Separate verdicts

| Verdict | Result |
|---|---|
| SpecCOMPLIANCE | **BOUNDED PASS — exact correction grant R2/R6 and fresh R3 evidence.** Twelve paths only: five modifications/seven additions. No shared Runtime/Native/Host/Save/catalog/source-scene/package/budget mutation. |
| Quality | **BOUNDED PASS — inspected source and conditional storage-open artifact.** Folded geometry, scale, source/root binding and palette are supported by actual bytes. Normal-game selection/motion/visual quality remains unrun. |
| ArtifactEvidence | **VERIFIED for the current staged correction package.** New blend/GLB/report/provenance, two new local LFS payloads/pointers, five process receipts/log hashes and previous delivery preservation agree. |
| ReadyForIntegratorHandoff | **YES after Root adjudication and an immutable full-SHA commit/seal.** Admission must carry the two actual new LFS payloads and matching manifest. Review does not unhold the writer or admit Runtime/S1/Owner behavior. |

**No new blocking or nonblocking defect was found in this correction scope.** R6's missing early catalog guard is repaired. R3's missing persisted execution receipt is closed by a genuine fresh tsc run. R2's missing independently selectable visual-open state is repaired by the explicitly granted inspection variant; an independent native door animation/body/state remains deliberately outside this delivery.

## R6 — early source and catalog guard

Evidence: `art/factory/play-2026-10-12/build_assets.py:48–58,74–103,152–167`; correction tests `playAssetDerivatives.test.ts:92–120`.

- FROZEN now includes the seventh declared source owner `apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts`, actual **23,335 bytes**, SHA256 `e746f2408314511a9e82315734fc78993b13ddc2627216b72dc0aa2c35d73fd3`.
- `read_snapshot_data()` first checks frozen source bytes, performs the existing read-only SSR source/catalog read, parses the result and rejects a catalogDigest unequal to `fnv1a:f3a8c642` immediately. It returns only after that check. Both ordinary snapshot and storage-only snapshot call it before their directory/source/blob/model-spec writes.
- Storage-only preparation additionally compares the current B09 source and definition ref to the preserved closed model spec before copying any new files. It copies the unchanged native snapshot and historical owner blob rather than creating new native geometry.
- The recorded initial RED contains three real assertion failures: the old guard accepted a catalog-only edit; the incompatible SSR digest generated twelve native snapshots in a temporary root; the visual-open variant was missing. The SSR result substitution is explicitly a dependency input for the negative test, and actual filesystem writes/cleanup are observed. These tests are not normal-runtime acceptance evidence.

The current generator SHA256 is `9017f6aa208d1b84e2d3e381d6c44a8c9f36d790be2f43489a7a8b5b20ceece9`, **36,161 bytes**, and matches the new provenance and top-level generator receipt. Historical native source head `96cced…`, original Art/code commit `e752cc…`, original model generator `91978…` and current correction generator are kept distinct. No current owner-code change is falsely described as a native geometry migration.

## R2 — conditional storage inspection-open derivative

Evidence: generator `build_assets.py:152–167,216–244,381–394,461–475,522–535`; `README.md:63–80`; correction test `playAssetDerivatives.test.ts:123–149`; actual new GLB and source files.

Stable asset ID `play_storage_inspection_open_v1`, URL `/factory/play-2026-10-12/storage-open.glb`. Metadata is exactly:

```json
{"baseAssetId":"play_storage_v1","kind":"confirmed-local-inventory-inspection","pose":"access-open","requiresConfirmedLocalAccess":true}
```

Actual B09 native snapshot and historical owner blob are byte-identical to the closed derivative. Definition `B09` version 1 / digest `fnv1a:b4a9402f`, native bounds, source part IDs/root parents, ports, supports and references agree. The same five neutral sibling mesh roots are present: `body`, `support_0`…`support_3`. There is no new native door part/joint, mass, collider, persistent opening flag or stock.

Independent binary inspection found:

| Actual new artifact property | Observation |
|---|---|
| Native blend | **587,660 bytes**, SHA256 `e5ace75bd20e8f3888efeb8708cc6b3c374f610191c205c77c25ce00b9beec4a`; real `BLENDER-v403` stream, 1,638 complete blocks, DNA1 and ENDB. |
| GLB | **24,380 bytes**, SHA256 `569557420499f023373f1f5fd7fc1ac0f7d72c9cd89f9b91277c8787dd7054d4`; valid GLB v2 JSON/BIN header, chunk sizes and scene roots. |
| Mesh census | Five distinct part meshes, seven primitives, 600 POSITION vertices, 300 indexed triangles. Finite actual positions, in-range triangle indices, neutral transforms, no child/skin/clip hierarchy. |
| Native containment | Every actual vertex lies in its part's original native box. Body actual bounds remain `[-1,.25,-1]` to `[1,1.5,1]` m; original four support bounds remain unchanged. Accessor bounds match actual position bytes. |
| Folded leaves | Actual leaf corners match centers `[±.475,1.44,.390]` and sizes `[.925,.07,1.13]` m. Petrol panel and handle corners match their corresponding folded centers/sizes. The code's +90-degree fold correctly exchanges original local Y/Z dimensions and offsets. |
| Visual front opening | Independent clipping of actual indexed body triangles against the visual access prism X `[-.8,.8]`, Y `[.4,1.35]`, Z `[.93,1.01]` m finds **zero** intersections in storage-open. The preserved closed asset has 52 intersections in that same prism. This is geometric inspection, not an in-game/collider clearance claim. |
| Source / semantics | `extras.hestia.partId`, playBinding part/sourceAsset/definition/source SHA and manifest part sets agree. Exporter report binds the actual GLB hash and has no diagnostics; semantics remain Decorative, collision/navigation None, destructible=false. |
| Palette / resources | Actual PBR RGB factors match the accepted sRGB→linear palette. No external images/textures/buffers, Draco extension, skin or standalone animation track. |

The recorded Blender command uses `--only-new storage-open`. Code rejects any selected slug from the original 22-entry baseline. The raw log has exactly **one Saved blend, one Read blend and one export marker**, then `updated 1 entries`. Save/reopen is explicit in the code before the existing exporter call. The optional missing-Draco import diagnostic is retained; the actual new GLB is uncompressed.

Doors/panels/handles share the original body root. Removing body can remove all its detail; a future variant switch must retain current Native part presence and must not restore an absent body. Selection is conditional on the Integrator's confirmed **local inventory inspection/access** projection. This artifact does not claim that B09's native solid collider opened, that a player can walk through it, that an independently hinged door animation exists, or that stored goods were created. Old and new variants are alternative presentations of one native facility, never two installed objects or duplicated contents.

## R3 — genuine fresh typecheck receipt

Evidence: external evidence wrapper `corrections/run-command.py`; `05-fresh-typecheck.receipt.json`; `05-fresh-typecheck.log`; matching package receipt SHA/hash fields.

The wrapper uses `subprocess.run(argv, cwd=…)`, captures stdout/stderr to the named log, records UTC start/end, monotonic elapsed duration, the actual returncode and the resulting log hash, and exits with that returncode. It does not synthesize a success from stdout or retroactively reconstruct the original silent run.

Fresh persisted typecheck receipt:

- argv: `./node_modules/.bin/tsc -p tsconfig.json`.
- cwd: `/workspace/Weltraum-Spiel/.worktrees/fp06-play-art-2026-10-12/apps/weltraum-browser`.
- start: `2026-10-12T08:53:04.503550+00:00`; end: `2026-10-12T08:53:06.748353+00:00`.
- actual process Exit0; monotonic duration **2.244817646 s**.
- log: zero bytes, SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, now bound to this actual process receipt.

All five correction receipts match the package and actual log bytes; UTC/monotonic durations are consistent. RED Exit1 is preserved. The final focused receipt says Exit0, and its raw Vitest log identifies the actual ART browser cwd, the two named test files, **28/28 passed**, no skipped cases: twelve derivative cases plus sixteen existing presentation cases. Vitest duration is 5.45 s; full npm subprocess duration is 6.025191532 s. No reviewer rerun or broader build/browser success is claimed.

The original `13-typecheck.log` remains historically empty without its original process receipt. This fresh check closes current verification readiness and does not rewrite the historical evidence finding.

## Scope, baseline preservation and delivery evidence

- Actual staged paths, grant writeSet, seal changedFiles and changed-path text agree exactly: **12 unique paths, 5M/7A**. No unstaged/untracked product change is present. The supplied full patch equals the exact staged binary diff. Existing grant beforeBytes match base Git blobs.
- The 157 preserved records are exactly the original 162 delivery paths minus the five modified old files, with no omissions/duplicates. Every actual preserved file matches its original `e752cc…` blob or exact LFS pointer SHA/size. Thus all old 22 blend/GLB/source/spec/blob/provenance/exporter products remain unchanged; old generator hashes are not retroactively replaced.
- Every old 22 manifest entry is exactly equal, in order, to the original entries. Only the new variant entry and explicit top-level generatorReceipts are added. Both manifest copies are byte-identical. Base generator receipt matches actual original Git generator bytes; correction receipt matches current generator bytes.
- All **20 original protected Native/source/runtime files** still match their original grant SHA/size. No Native/Host/Physics/Save/catalog/BOM/port/recipe/grid/budget/dependency/attribute change appears in this diff.
- Exactly **two new local LFS payloads, 612,040 bytes** total: actual worktree bytes, staged pointers and corresponding real shared local LFS object bytes agree. This review inspected those two new cache objects and targeted old delivery preservation, not a historical/global fsck or library scan. Local/global attribute files remain unchanged.
- New source/GLB/blend/report/provenance/license refs match their actual byte hashes and package/seal entries. Actual original 326-byte project license is preserved. No remote/provider asset was added.

## Remaining boundaries and Root handoff

No S1/runtime/normal-game/animation/Owner PASS follows from this correction. Original independent-review R1/R4/R5 boundaries remain: actual loader/current definition-and-anchor/readview admission, normal-game pose/removal/stock proof, accepted Cutter/Former S1 bridge and human Art/usability/hardware acceptance are separate work. The already issued bounded S1 grant is not modified or replanned here. All human decisions remain `OWNER_REVIEW_PENDING`.

Root may adjudicate this bounded PASS, authorize the exact staged commit, then keep Art committed/HOLD. Before Integrator adoption, bind the actual full correction commit and final clean status to the reviewed patch/manifest/generator/two payload hashes. Preserve the actual two LFS objects when admitting the immutable delivery; a textual patch or pointer-only copy is insufficient. The reviewer has not authorized a writer resume, committed, merged, published, changed a grant or mutated product/index contents.
