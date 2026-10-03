# ExecPlan: isolated Hestia asset compiler spike

## Goal

C2-C5 and the separate reader correction are preserved at accepted HEAD `6d55238c076ec2ccf9e743ea63470ead4e25690c`. Current authorization is **C6 ONLY**: executable report-bound core, honest thin/semantic/geometric packages, actual-byte verification and local Windows no-replace publication, one prescribed scoped commit after fresh tests/self-review. **STOP before C7** for user-dispatched independent C6 review. Supported synthetic package SUCCESS is not full corpus/CLI/Blender/performance/product or full-spike acceptance.

After separately authorized serial gates C2-C8, the eventual goal is an executable, standard-library-only offline GLB/report compiler, independent golden corpus, deterministic packages, and bounded verification. Documentation alone will not satisfy that eventual goal. `PRODUCT_INTEGRATED = NO` throughout.

## Context

| Item | Pinned value |
| --- | --- |
| Repository | `BenjaminHornung/Weltraum-Spiel` |
| Base and expected `origin/main` | `25bc7f5bbd2db6317c42193873eadeaf10a092c5` |
| Branch | `agent/hestia-asset-compiler-spike-2026-10-02` |
| Worktree / every command's working directory | `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-Agent3-AssetCompiler-2026-10-02` |
| Sole writer | `72981f9a-14c7-4b4f-add6-27398d86c473` |
| Python | `C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe` |
| Git | `C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe` |
| Task-owned test TEMP/TMP | `C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a` |

The complete input package was read under `C:\IFI_SourceCode\Temp\Hestia-Agent3-Input-2026-10-02\Hestia_Agent3_AssetCompiler_2026-10-02`: `00_AGENT3_MASTER_PROMPT.md` through `07_COMPLETION_CHECKLIST.md`, `README.md`, and `PACKAGE_MANIFEST.json`. All nine manifest-listed file lengths and SHA-256 values were independently rechecked: PASS, exit 0. The ZIP SHA-256 supplied and verified by the superorchestrator is `3062741a47375df1112872f38e01b340886faa913da68151d7ec59ee400b1fbf`; this agent did not claim a second ZIP verification.

Repository preparation included the nearest `AGENTS.md`, `README.md`, `docs/current-mainline-state.md`, `.agent/PLANS.md`, and the complete `docs/roadmap/living-master-plan.md`. The nearest worktree instructions designate the browser application as mainline; outer historical Unity instructions do not make Unity a writable target. Status/roadmap snapshots contain older pins and are not substitutes for the actual base source.

The complete primary-source inventory and runtime cross-checks are in [CONTRACT_AUDIT.md](CONTRACT_AUDIT.md). Decisions, gaps, and independent precheck attribution are in [CONFLICT_REGISTER.md](CONFLICT_REGISTER.md).

### Lease and authority

Only **new** files beneath `tools/hestia_asset_compiler/**` and `docs/research/hestia-asset-compiler-spike-2026-10-02/**` are writable. C1 creates only `EXECPLAN.md`, `CONTRACT_AUDIT.md`, and `CONFLICT_REGISTER.md`. Existing Blender, schema, product, runtime, README, package, lockfile, and DevToolbox files remain read-only. No outer checkout, other worktree, or foreign process/session is owned by this task.

The explicit branch name is retained. No push, PR, merge, rebase, forced Git action, or deletion is authorized. User-provided fetch/prune and pristine prelaunch checks are recorded as external preparation, not as commands rerun here. If `origin/main` differs from the exact pin, stop and report SHA/diff without rebasing.

DevToolbox tracking is explicitly inactive. Equivalent checks are the source/lease preparation, gate-specific acceptance, fresh verification, diff allowlist, and progress/evidence log here; no change, spec, execution, or task mutation is created.

## Non-goals

- No C7/C8/GWN/CLI/benchmark implementation before further authorization; no future gate marked complete from a plan.
- No HVP, save, physics, renderer, worker, terrain, material-registry, or authoring-schema integration. Renderer projections never become world truth.
- No broad upstream fixes. Confirmed exporter gaps become later `INTEGRATION_HANDOFF.md` items.
- No invented density, kg mass, physical inertia, strength, or collision/navigation authority.
- No dependency/package/lockfile changes, Blender installation, execution of binaries outside `C:\IFI_SourceCode`, or qualified benchmark while parallel strands run.
- No further agents. Independent reviewers are user-dispatched, read-only, and have no write lease; do not wait indefinitely for more preparatory reviews.
- No staging, deletion, ignoring, or reconfiguration of `.opencode/throughput.jsonl` or `.opencode/throughput.md`.

## Architecture decision

### Input, identity, and output boundaries

Input is GLB 2.0 + matching `.hestia-authoring-report.json` + an explicit profile: `micro-0125-research-v1` (0.125 m) or `standard-025-v1` (0.25 m). Neither is a global product default. Preserve `metersPerUnit=1`, `RIGHT`, `+Y` up, and `+Z` forward; bake actual GLB world matrices without a Blender-axis guess or a TRS roundtrip.

Read-only reuse of the existing pure `tools.blender.hestia_asset_authoring.canonical.canonical_json_bytes` is the exact report-payload digest boundary. Do not replace its collection/tag ordering and negative-zero behavior with plain `json.dumps`.

The future pipeline is bounded input validation -> exact report/transport binding -> baked canonical per-part triangles and joint/marker placements -> conservative surface coverage -> padded exterior flood and cavity-aware classification -> explicit ownership/material/thin decisions -> research bricks and hashes -> verified atomic directory publication. No successful artifact may precede semantic admission; geometry tests in earlier gates do not assert final compile success.

The output is `hestia.asset-compiler-spike.v1`, not accepted `hestia.asset-manifest.v1`, HVOX, or a drop-in runtime brick. A brick contains 4096 slot bytes, x-fastest, Air=0, active slots 1..255. Preserve per-part ownership in each manifest brick entry and its stable key, not merely in an unrelated part list. Reject unresolved owner/material overlap; never use traversal order or RGB as a tie-breaker.

### Reference geometry and contact convention

Freeze **research closed/inclusive contact A**: a cell's closed box touching a triangle counts as surface coverage. Candidate bounds must include the cells on both sides of grid-aligned boundary planes. Triangle/AABB SAT includes box axes, triangle normal, and edge-cross axes; triangle bounding-box overlap alone is insufficient. Integer floor division governs negative brick addressing.

For each closed Solid part, validate the actual baked triangles across all primitives: exact coincident-position seam merging, no epsilon weld, nondegenerate/nonduplicate faces (including duplicate geometry with different materials), each edge twice in opposite directions, closed vertex fans, and no self-intersection. Preserve world-matrix shear. Correct winding once for the **world** determinant; never force each nested shell/component to positive signed volume.

C5 reference: surface cells -> one additional **free** padding layer beyond the complete surface-cell bounds -> 6-neighbor exterior flood -> connected components of remaining non-surface cells -> deterministic geometric ray-parity label of a cell-center representative. Even/odd classification is **per Solid part**, not a combined XOR of separate parts. Material-labelled regions fill; cavity-labelled regions remain Air. Grazing/edge/vertex hits, inconsistent geometry, or unproven regional classification reject stably. Padding is never occupancy. GWN is not a C5 prerequisite or oracle authority.

G13 remains a closed Solid with an enclosed cavity, never reclassified as Shell. A sealed raster tunnel is not proven open merely because parity leaves a cavity empty. Use a both-profile resolvable tunnel control and under-resolved/profile/phase/diagonal variants; topology loss must be diagnosed/rejected visibly.

### Hash comparison and preservation

The exact comparison classes approved by R1-A2 are frozen in the audit: identical input bytes/profile/versions require complete output byte/tree identity; semantically equivalent ordering permutations require canonical content identity, while truthful raw source hashes and their binding full tree may differ. The canonical semantic manifest projection excludes only explicitly identified provenance bindings, not content or ownership. No public authoring schema changes.

`PreservedSemantic` requires actual replacement geometry/parameters and semantic payload, not a policy string. A tube must not become a filled rod. Without a real thickness/replacement proof, emit `RejectedUnprovenThickness`; never treat declared thickness or an AABB as measurement.

## Implementation phases

All gates are serial. Completion requires fresh evidence and self-review; the superorchestrator retains gate authorization and independent-review responsibility. **C6 ONLY is currently authorized; C7/C8 remain NOT AUTHORIZED / NOT RUN.** Prior gate stops below are historical, not permanent prohibitions after explicit authorization. File splits are actual minimum owners, never empty scaffolding.

### C0 — preflight and baseline

- Verify the exact base, branch, tracked cleanliness, new-file lease, instructions, environment, and existing Blender host tests.
- Record the explicitly accepted harness-instrumentation exception separately from Git's nonempty porcelain output.
- Acceptance: exact pin/branch; no tracked changes or foreign task edits; real baseline output; environment/Blender limitations explicit.
- Evidence: 58 host tests PASS, exit 0; details below. No code or qualified performance benchmark.

### C1 — contract freeze (accepted prior checkpoint)

- Create these three research files, including R1-A2 comparison/design resolutions and R2/R3 minimal requirements.
- Check all required plan headings, source references, statuses, diff whitespace, and the **exact three added-file** allowlist; self-review the entire staged diff.
- Commit only these paths: `docs(asset-compiler): freeze spike contract audit`.
- Report the resulting commit and status, then **STOP before C2**. Independent prechecks are not an implemented-code or full-spike acceptance review.

### C2 — narrow reader and deterministic fixtures

- Intended files: `tools/hestia_asset_compiler/{__init__.py,errors.py,profiles.py,glb.py}`, `tests/glb_fixtures.py`, `tests/test_glb.py`; add a model only when needed.
- TDD malformed inputs before reader success. Bound file/report bytes before reads; pre-load JSON depth/strict UTF-8, duplicate keys, finite numbers, and boolean-vs-integer checks before decoding structures.
- Freeze conservative numeric budgets and their versioned diagnostic codes in `profiles.py` **before** parser expansion or voxel allocation: bytes, JSON/graph depth, nodes/edges, accessor counts/decoded bytes, expanded triangles, absolute safe grid coordinates, padding/flood/candidate work, bricks, and output bytes. No unbounded intermediate list hidden behind a final-output cap.
- Validate chunk/buffer lengths, valid 0..3 BIN slack, alignment, exact strided last access, unsigned nonnormalized scalar indices and forbidden sentinel values, hierarchy cycles/duplicate children/roots/multiple parents. Mesh reuse is allowed; node-parent ambiguity is not.
- Explicit render-data allowlist supports normal Blender UV/PBR/embedded-image transport without image decoding or network fetch. Reject all external/network URIs; finite NORMAL/TANGENT validation; reject unsupported geometry-altering optional extensions as well as unknown required ones.
- Reject any reachable mesh without an exact authored Part binding; validate used extras and ancestor bindings. Do not guess Decorative or trust the report as geometry/security truth.
- Verification: focused parser negatives including G23-G26/G30 and minimal valid/reused-mesh fixtures; existing Blender files unchanged.
- Commit: `feat(asset-compiler): add deterministic narrow GLB ingestion`.

### C3 — transforms, topology, and canonical identities

- Intended files: `geometry.py`, a small `model.py` if needed, `tests/test_geometry.py`.
- Compose column-major matrix/TRS and ancestry in Float64 meters, retaining nonuniform-parent/rotated-child shear. Independently finite/nonsingular-check **all** relevant node/ancestor transforms, including joints and markers; keep their normalized world placement.
- World reflection swaps winding exactly once. Triangle keys use stable part/material IDs and content; select only among three cyclic vertex rotations, never full vertex sorting or winding reversal. Sort canonical triangles before accumulation.
- Prove Solid topology on baked geometry across primitive seams; report counts alone do not admit a solid. Keep semantic part-parent graph distinct from transform ancestry.
- Verification: G03-G08, G17-G19, G20-G22, G28-G29; geometric duplicates across materials; invalid joint/marker ancestors and shear fixtures.
- Commit: `feat(asset-compiler): canonicalize authored geometry and semantics`.

### R3-B correction — completed reader-only checkpoint

- Files: only `tools/hestia_asset_compiler/glb.py`, `tools/hestia_asset_compiler/tests/test_glb.py`, and this own leased `EXECPLAN.md`. Geometry, profiles/budgets, upstream Blender/schema/runtime, inputs and dependencies stay unchanged. `.opencode` is not edited or staged by this writer; independent harness appends are not claimed absent.
- Prevalidate material/node owner list forms, existing 1024/2048 caps, and object members before building identity sets or scanning locations. Use bounded identity-set membership, not a linear material search for each extension owner.
- Admit direct `extras.hestia` only on exact asset/node/material objects; reject all other transport locations with `glb.semantics-location`. Other extras are opaque metadata, not aliases or extension owners; no semantic records are moved or defaults inferred.
- Preflight **all** primitive vertex attributes before any binary decoding: accessor-relative offset, absolute offset, and effective stride must be multiples of four. Component-specific index alignment remains unchanged. Naturally aligned U16/VEC2 and U8/VEC4 need no explicit stride.
- Only render `alphaCutoff` and `emissiveStrength` gain finite nonnegative validation; absent emissive strength is validated against its schema default 1 without writing into input. Thickness/force `positive()` is unchanged.
- Acceptance: negative/positive repros first, red on C3; all four groups and the full compiler suite green; exact three-file diff/lease/whitespace self-review; no budget increase, new agents, services, or C4 implementation.
- Commit: `fix(asset-compiler): harden GLB admission before voxelization`, separate child of C3, no amend/rewrite/push. Actual publication SHA/result is recorded after execution in Git and the checkpoint response; independent R3 closure is not claimed by this writer.

### C4 — conservative surface and addressing

- Intended files: `voxel.py`, `tests/test_surface.py`; share integer addressing rather than creating a runtime adapter.
- Apply contact A and full SAT, prevalidate complete surface/candidate/brick bounds and work budgets, then allocate. Mathematical floor division, x-fastest 16³ packing, deterministic candidate sets and per-part ownership.
- Independent SAT negative: triangle `x=0, y>=0, z>=0, y+z<=1` does **not** overlap a cell with `y,z>=0.75`, despite overlapping broadphase bounds.
- Verification: surface portions of G01-G12/G16/G27-G30; negative coordinates; reordered candidate owners; budget rejection before allocation. G13/G14 final interiors wait for C5.
- Commit: `feat(asset-compiler): add conservative reference surface voxelizer`.
- Actual implementation uses exact rational SAT on baked Float64 coordinates, all 13 axis families, no epsilon/snap. Surface material unions reject ambiguity, active byte slots sort stable render/structural bindings, owned brick keys include part/address/version. No final volume material or report admission is claimed.

### C5 — reference interiors, cavities, tunnels

- Actual files: `classification.py`, `tests/test_classification.py`, and small synthetic mesh helpers in the already leased `tests/glb_fixtures.py`; surface/address ownership stays in `voxel.py`. No empty future files.
- Implement the padded 6-neighbor flood + per-part cavity-aware geometric parity rule above. Stable ambiguous-case rejection; no GWN dependency. Prove hollow regions and topology preservation, not just exterior flood reachability.
- Run mandatory G13 at **both** profiles against independent analytic cell intervals. Include both equal-outward and reversed-inner nested winding variants (source signed volumes 9 and 7), with the same cavity parity oracle. `closed` is topology evidence, never sufficient fill authorization. Include disconnected solids, resolvable tunnels, under-resolved tunnels, phase/diagonal cases, and grazing/edge/vertex ambiguity. Shell/LayeredShell never get Solid fill.
- Verification: G01/G02/G13/G14/G15 and the exact interval/count oracles below. A rejected under-resolved tunnel cannot be reported as successful preserved connectivity.
- Commit: `feat(asset-compiler): classify solid interiors with reference flood fill`.
- The implemented narrow certificate supports orthogonal closed Solid faces only. It proves source-to-conservative-raster inclusion in a common cubical refinement, actual Material/Air component correspondences, and a sequence of pure boundary-disk attachments. Equal Euler/counts alone do not pass. Unsupported diagonal/sheared Solid geometry rejects `classification.topology-unproven`; there is no repair or relabelling.

### C6 — bound semantics, thin safety, packages, atomicity

- Actual owners: `admission.py`, `thin.py`, `package.py`; `tests/package_fixtures.py`, `tests/test_admission.py`, `tests/test_thin.py`, `tests/test_package.py`. Existing own `classification.py` exposes functional `classify_cells` before packing and preserves old wrapper behavior; own compiler version advances to C6. No speculative diagnostics/framework files. This plan/audit/register and `PACKAGE_FORMAT.md` own the executable format/support/handoff evidence.
- Check raw GLB SHA against **both** report GLB fields, and canonical payload SHA using the existing helper. Record raw report source SHA separately. Reject null GLB hashes, Error diagnostics, digest-valid semantic conflicts, ambiguous ownership, or malformed references.
- Preserve asset/revision, parts/parent, joints/world placement, markers/interface/world placement, policies, materials and tags. Unused declared report materials can be legitimate exporter slots; the 255 cap counts only active voxelized slots. `paletteIndex` is not a local slot.
- Homogeneous Solid material assignment can use its unique geometry-bound semantic material. Do not invent interior precedence for multiple distinct materials; reject ambiguity without a committed rule. Carry part ownership in brick entries.
- Add honest thickness/replacement proofs and outcomes; overdeclared-thickness negatives. Geometric cell count/volume/center sums per structural material only, optional explicitly defined second moments; no physical density/mass/inertia.
- Freeze exact research manifest, semantic projection, hash preimages, diagnostics, source inventory and deterministic compile report; manifest-tree preimage excludes its self field. No timing/path/host/user/locale in content hashes.
- Whole-generation task-owned sibling staging, finish and validate all files, single atomic directory rename. Reject **any existing target**, including empty dir/file/link/junction, unchanged. No target deletion/replacement. Faults: after brick 1, before manifest, rename failure, unwritable parent, publish collision with sentinel intact; clean only owned staging.
- Commit: `feat(asset-compiler): emit semantic deterministic asset packages`.

### C6 actual evidence and scoped support — 2026-10-03

**Relayed EXTERNAL evidence, not this writer's runs/reviews:** superorchestrator accepted C5 HEAD `6d55238c076ec2ccf9e743ea63470ead4e25690c`, sole parent C4. R2-C SCOPED PASS math/no P1/P2: four bounded programs exit 0; independent 64 face patches plus 1280 extra edge/vertex contacts; induced-map counterexamples; full G01/G02/G13/G27 sets and decoded brick bytes both profiles/both windings; tunnel controls/G15. R3-C SCOPED PASS: two bounded programs exit 0, global admission/owned 255-vs-256/8193-brick preallocation, multipart/refinement/eight-ray/105-witness bounds. META fresh 74 PASS exit 0 in 33.336 s, independent package-independent sets/brick bytes, 90 Matrix-vs-quaternion repro, baseline diff whitespace 0 and status only two instrumentation files. R1-C SCOPED PASS WITH NOTES: G05/G06 require actual geometry baking, not universal rotated fill; mandatory G01/G02/G13 SUCCESS cannot be replaced by rejection, EXACT G01-G30 inventory/variants/reasoned BLOCKED and G16 ambiguity rejection are retained. None is independent C6 review/full spike PASS.

Actual C6 API/hash/projection/thin/support/atomicity is frozen in [PACKAGE_FORMAT.md](PACKAGE_FORMAT.md), with audit/register amendments. Input semantics/digests/options/inventory/diagnostics are validated before world/raster; current pure `build_report` interoperates READ ONLY. Canonical payload-only hash is reused exactly, raw report SHA separate; source warning messages/host paths never enter outputs. Tests use deliberately nonmatching evaluated inventory counts to prove actual triangles remain geometry truth.

Focused tests were written BEFORE production modules; missing admission/package imports reproduced red (exit 1). A real dyadic just-under-0.5-m witness later reproduced **1 FAIL in 0.017 s, exit 1** before replacing rounded threshold comparison with exact Fraction; a rehashed false-grid/bool/malformed package test reproduced **2 failures + 1 error in 0.350 s, exit 1** before actual decoded-bound verification/bool-safe metadata/stable malformed rejection. No input repair, profile/budget change or weakened oracle.

Own first full C6 suite: **107 tests PASS in 44.201 s**, exit 0; no failures/skips. Own fresh unchanged Blender host baseline: **58 PASS in 0.163 s**, exit 0 (intentional asserted negative diagnostics are not failures). Further exact-preimage, path-core, shell-package and precise witness metadata checks follow; final counts/output/diff/lease/cleanup and actual publication SHA are recorded after fresh execution, not predicted. Commands retain the literal Python/Git/TEMP/TMP/worktree above; unit durations are NOT benchmarks.

Own complete source/test self-review found descriptor validation gaps in the first verifier. Negative rehashed proof/missing-version/false-fill/changed-component and preserved-binding tests were added FIRST: **1 test, 8 subtest failures in 0.527 s, exit 1**. Seven were actual verifier acceptance gaps; one first endpoint mutation was a no-op (numerator already 1), corrected to 3 without weakening production. Common verifier now checks versioned complete admitted proof descriptors, exact axial endpoints and declared usable replacement/assembly bindings. No claim of authenticating fully forged geometry without original source. Subsequent actual full suite **111 PASS in 41.018 s**, exit 0: original 74 + 7 admission + 8 thin + 22 package. Own read-only Blender baseline **58 PASS in 0.173 s**, exit 0. No failures/skips in either green run. Focused independent preimage selection and frozen synthetic cube example (12 files/41,295 bytes) are recorded in PACKAGE_FORMAT; final staged review/checkpoint will collect fresh evidence again after the final assertions.

Final own pre-commit verification after all code/frozen-example assertions: **111 PASS in 42.823 s**, exit 0; unchanged read-only Blender host baseline **58 PASS in 0.153 s**, exit 0. Exact commands from the pinned worktree (task TEMP/TMP set to the existing bounded directory above):

```powershell
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_*.py' -q
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/blender/tests -p 'test_*.py' -q
& 'C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe' diff --cached --check
```

**PASS** full tests, frozen hash/length/preimage regression, actual publication/fault controls, original dyadic and rehashed-malformed regressions, complete own final source/test/doc and staged diff self-review, staged whitespace check (exit 0). **PASS** lease: all 13 staged paths belong to the two authorized directories; accepted C5 HEAD/parent preserved; no upstream/dependency/profile/budget modifications. **PASS** cleanup: task TEMP empty with parent retained, no compiler/Blender bytecode caches; only two accepted untracked `.opencode/throughput.*` files remain untouched. No services or agents were started. **NOT RUN** independent C6 review, native symlink/broken-symlink execution (WinError 1314), actual Blender E2E, C7/C8/full corpus/ten repeats/GWN/qualified benchmarks; **NOT APPLICABLE** product/runtime integration. The single prescribed commit SHA and post-commit clean/status evidence are reported after publication, not fabricated inside its self-referential contents.

All mandatory Cube/Box/Hollow/L-body full owned sets/decoded bricks/center sums pass both profiles; G13 passes both inner windings. Two identical generation file maps/tree hashes match; properly remapped input orders preserve content/brick/projection while truthful sources/full tree differ. These are C6 focused smoke, NOT complete 30-case/ten-run certification. Exact 90 Matrix package succeeds; common 90 TRS bakes valid geometry but thin proof rejects without snap/invalid-rotation claim. The partial support/corpus/handoff inventory is exactly G01-G30 in PACKAGE_FORMAT.

Thin sampling is explicit 2*h, proved complete orthogonal material-axis sections with exact rational witness/endpoint parameters, not authored minimum/global AABB. Real box-beam/single-layer shell/assembly parameters are preserved; generic rod/tube/multilayer/arbitrary proof blocks whole asset. Homogeneous explicit material bindings must agree; palette/unused declarations are not slots. Geometric inputs group owned Part/structural-material contributions, mark unbound data, explicitly disavow net overlapping physical volume, density/kg/inertia and analytic-source-volume substitution.

Metadata byte/depth/token and combined metadata+binary output guards precede brick payload allocation. Core spies exercise output cap and 256 actual-cell bindings before packing (allocation controls only, not fake successful geometry/compiles); 256 unused declarations plus one voxelized binding compile with one slot. Existing C4/C5 physical allocation guards and caps remain unchanged. `classify_cells` reuses actual C5 proof but delays pack until C6 metadata preflight; old classifier tests are retained.

Owned unique sibling staging is actually verified before one local Windows no-replace directory rename. Real existing file/empty/nonempty dir/junction/**broken junction** and late empty/nonempty publish collision controls preserve foreign state. Faults cover temp/unwritable-parent mock/no ACL change, after brick 1, before manifest, failed verification/corrupt brick and rename; own staging is removed and foreign stale sibling/sentinel retained. **Native symlink/broken-symlink tests NOT RUN:** actual creation failed WinError 1314; separately labelled lexical mocks are unit branch evidence only. No privilege/ACL changes. POSIX/UNC/mapped network publication fails explicitly; no portable atomicity or crash-durability claim.

Independent C6 review remains user-dispatched after freeze. C7/C8/GWN/CLI/full corpus/ten repeats/compileall/Blender E2E/qualified benchmark remain NOT RUN. No services/new agents/upstream/dependency/lockfile/product writes, push/amend/merge or instrumentation cleanup.

### C7 — CLI and optional bounded classifier comparison

- Intended files: `__main__.py`, focused CLI tests, optional `gwn.py` only if justified.
- `argparse` subcommands: compile/validate/inspect/golden/benchmark; explicit profile, useful stable errors, no framework. Existing strict validation/budgets remain enabled.
- GWN only after C0-C6 green and further authorization: stable triangle order, Float64, uncertainty band around 0.5 with rejection, independent golden/reference comparisons. `GWN_NO_ADOPTION` is valid; do not add a dependency for an optional candidate.
- Commit: `feat(asset-compiler): add CLI and bounded classifier bakeoff`.

### C8 — fresh verification, external review, handoff

- Fresh new tests, Blender baseline, compiler-only compileall, all G01-G30 with both profiles where applicable, ten-run determinism, permutation classes, atomic faults, and actual Blender E2E only from an allowed executable root.
- Coordinate isolated performance time with the superorchestrator before benchmarks; otherwise `CONTAMINATED_DIAGNOSTIC`. Separate input hashing, parsing, transforms, geometry validation, surface, classification, optional GWN, materials, packing, serialization, total. Small 1k-5k and Medium 25k-50k triangles; Large 100k-250k only within frozen budgets. Profiles separate; wall/CPU/counts/bytes and qualified memory or `UNSUPPORTED`. Do not raise limits to obtain nicer numbers.
- User coordinates independent Contract/Authority, Geometry/Voxel, and Parser/Budget/Fault review. Sole writer fixes confirmed scoped findings, reruns affected checks, and documents unresolved blockers. No new agents created here.
- New research outputs: `GOLDEN_CORPUS.md`, `BENCHMARK.md`, `REVIEW.md`, `REPORT.md`, `INTEGRATION_HANDOFF.md`; update this plan and register. Handoff includes upstream joint-transform/unannotated-export gaps and the separate future static-asset/read-only-adapter slice, not an implemented adapter.
- Final diff whitespace/lease check, explicit statuses and cleanup; `SPIKE_ACCEPTED`, `SPIKE_ACCEPTED_WITH_NOTES`, `REQUIRES_FIX`, or `BLOCKED`, never PRODUCT_READY.
- Commit: `feat(asset-compiler): complete isolated Hestia asset compiler spike`. No push/PR/merge authorized.

## Tests and evidence

### C0 actual evidence — 2026-10-02

| Check | Actual result |
| --- | --- |
| `rev-parse HEAD origin/main` | PASS, exit 0; both exact `25bc7f5bbd2db6317c42193873eadeaf10a092c5` |
| `branch --show-current` | PASS, exit 0; exact requested branch |
| `diff --exit-code HEAD` | PASS, exit 0; all tracked files unchanged |
| Prelaunch pristine worktree / fetch-prune / sanitized remote | Superorchestrator-provided evidence, not rerun by this agent |
| `status --porcelain=v1 --untracked-files=all` | Exit 0, **not empty**: only `?? .opencode/throughput.jsonl` and `?? .opencode/throughput.md` before C1 writes |
| Instrumentation exception | Explicitly accepted by superorchestrator after R3-A/meta prelaunch/current checks; preserve the two harness-generated logs without staging/deleting/ignoring/reconfiguring |
| New lease paths / `.opencode` tracked inventory | PASS, exit 0; `git ls-files` returned no entries before creation |
| Python/environment | Python 3.12.13, MSC v.1944 64-bit AMD64; Windows-11-10.0.26200-SP0 / AMD64; exact executable above; `-B` verified active |
| Blender host baseline | **PASS**, exit 0; **58 tests**, 0.240 s, `OK`; 34 boundary + 24 authoring-contract tests, no failed/skipped tests |
| Read-only Blender/schema post-baseline diff | PASS, exit 0, empty |
| Cache/temp hygiene | `tools/blender/**/__pycache__`: none; task-owned temp children: none after tests; empty parent retained |
| Real Blender E2E | **NOT RUN — EXECUTION_ROOT_BLOCKER**; discovered Blender 5.2 executable only outside allowed root, metadata inspected, never executed |
| Qualified CPU/memory benchmark | **NOT RUN**, C0/C1 scope and parallel-strand exclusion |

Baseline command, executed from the pinned worktree:

```powershell
$env:TEMP = 'C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a'
$env:TMP = 'C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a'
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/blender/tests -p 'test_*.py' -v
```

Negative-path tests intentionally print `export.failed`, `adapter.failed`, `output.invalid`, and `schema.invalid` diagnostics; the asserted tests all passed. These are not failed baseline tests and no Blender process was invoked.

Blender discovery was bounded: no application on PATH (`Get-Command` exit 1), no executable found in the inspected `C:\IFI_SourceCode\Utils` and direct Temp scopes. Read-only discovery found `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`, FileVersion/ProductVersion 5.2. No `--version`, export, install, or staging of that executable occurred. Do not describe Blender as globally unavailable.

### C1 actual document verification — 2026-10-02

| Check | Actual result |
| --- | --- |
| Python `-B` inline document assertions | PASS, exit 0: exact three-file inventory, all ten required plan headings, local Markdown links, primary-source file paths, current schema frame constants, R1 resolution status values and all three reviewer IDs |
| No C2 side effects / hygiene | PASS in the same check: `tools/hestia_asset_compiler` absent, no Blender `__pycache__`, task-owned TEMP directory empty, `sys.dont_write_bytecode` true |
| Fresh pre-stage base/index/source | PASS, exit 0: HEAD and origin/main still exact pin, index initially empty, existing tracked source diff empty |
| Staged whitespace | `diff --cached --check`: PASS, exit 0, no output |
| Staged allowlist | `diff --cached --name-status`: PASS, exit 0; exactly three `A` entries for this directory's EXECPLAN/CONTRACT_AUDIT/CONFLICT_REGISTER, no other entry |
| Self-review | All three documents and their scoped staged diff inspected; no current same-boundary MUST conflict or unauthorized implementation claimed |
| Independent review scope | R1-A2 interpretation approvals and R2/R3 read-only prechecks are attributed; no implemented-code/full-spike review claimed |
| Unnecessary checks | Baseline not repeated for Markdown-only edits; compiler tests/compileall/oracles/CLI/performance NOT RUN; browser/npm NOT APPLICABLE |

Document-check output: `PASS C1 document structure, 3-file inventory, relative links/source paths, current frame, reviewer resolutions, no compiler scaffold, cache/temp hygiene; no compiler/oracle test run`. This is document validation, not a golden geometry test.

The publication step follows a final fresh staged check with these literal paths:

```powershell
& 'C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe' add -- docs/research/hestia-asset-compiler-spike-2026-10-02/EXECPLAN.md docs/research/hestia-asset-compiler-spike-2026-10-02/CONTRACT_AUDIT.md docs/research/hestia-asset-compiler-spike-2026-10-02/CONFLICT_REGISTER.md
& 'C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe' diff --cached --check
& 'C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe' diff --cached --name-status
& 'C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe' commit -m 'docs(asset-compiler): freeze spike contract audit' -- docs/research/hestia-asset-compiler-spike-2026-10-02/EXECPLAN.md docs/research/hestia-asset-compiler-spike-2026-10-02/CONTRACT_AUDIT.md docs/research/hestia-asset-compiler-spike-2026-10-02/CONFLICT_REGISTER.md
```

The commit's own SHA cannot be embedded in its content. The final checkpoint response and Git log record the actual commit result/SHA, parent, remaining status and cleanup **after** execution; this document does not claim the publication command ran before it did. No second bookkeeping commit or amend is required. Final status must retain only the two untracked instrumentation logs; they are not part of the publication.

### C2 actual implementation and bounded verification — 2026-10-02

Implemented `__init__.py`, `errors.py`, `profiles.py`, `glb.py`, `tests/glb_fixtures.py`, and `tests/test_glb.py` beneath the compiler lease; no dependency or upstream source changed. The reader returns validated transport semantics and decoded primitives, not an admitted report-bound compile artifact. `read_report` only pre-bounds/parses bytes and records their SHA; digest/semantic report binding remains C6.

Negative fixtures preceded implementation: first run was the expected missing-reader import failure (exit 1). The first implementation run identified a mistaken negative oracle: offset 4 with stride 16 and 48-byte view is legal (`4 + 2*16 + 12 = 48`). Retained it as a positive and used offset 8 as the negative; no invalid last access was relaxed. Subsequent focused runs passed. Fresh publication evidence is recorded below after execution.

Frozen `spike-budgets-v1` limits (all have limit/limit+1/boolean negative checks): GLB 33,554,432 bytes; report/JSON 4,194,304 bytes each; JSON depth 64/tokens 250,000; nodes 2048/edges 2047/graph depth 64; meshes 1024/primitives 4096/materials 1024/accessors 4096/buffer views 4096; accessor elements 262,144; logical decoded Float64 bytes 33,554,432; instance-expanded triangles 20,000; absolute world coordinate 1,000,000 m/grid coordinate 8,000,000; inclusive padded grid/flood cells 2,000,000 each; candidate work 10,000,000/topology pairs 2,000,000; bricks 8192/output bytes 67,108,864. These are admission ceilings, not measured performance guarantees. Whole-file/JSON/accessor/hierarchy/instance guards run before their corresponding read/decode/expansion; future work/flood/output consumers must also call the frozen guards before allocation.

Explicit render-only subset: core PBR, UV0/UV1 and COLOR0 Float32 or normalized U8/U16; finite Float32 NORMAL/TANGENT; embedded PNG/JPEG buffer-view references without decoding; core texture/sampler refs; material-local `KHR_materials_unlit` and `KHR_materials_emissive_strength`. Other extensions and all external/data URIs are rejected. Exactly one scene is the deliberate narrow subset; mesh reuse is valid, multiple node parents are not. Sparse/morph/skin/animation/non-TRIANGLES and unowned reachable meshes reject. No topology proof is inferred from this reader or report inventory.

Profiles remain explicit `micro-0125-research-v1=0.125 m` and `standard-025-v1=0.25 m`; no default/adoption. C2 tests cover parser portions of G23-G26/G30 and valid reused meshes; G03-G08/G17-G22/G28-G29 geometry portions wait for C3, all voxel portions for C4+.

Fresh C2 command: the Python `-B` unittest command above with **`-s tools/hestia_asset_compiler/tests -p 'test_glb.py' -v`**, same explicit TEMP/TMP/interpreter/worktree. Exact final summary: `Ran 17 tests in 0.176s` / `OK`, exit 0, no skips. `git diff --check` and read-only Blender/schema/apps/README/AGENTS/DevToolbox baseline comparison both exit 0, empty. Status inventory is exactly the six new compiler files, this leased plan modification, and the two untouched instrumentation files. `-B`/no Blender or compiler caches/empty task TEMP check PASS, exit 0. Self-review corrected no production contract; confirmed offset oracle corrected as described. Publication succeeded at `6b6e6fb1eb38642bca6045630270134337a705ce`, exact parent `89f068dfff2d965177165dce082c5289a35d0df4`, exact prescribed message; staged lease/whitespace checks and complete diff self-review preceded it.

### C3 actual geometry implementation and verification — 2026-10-02

Added only `tools/hestia_asset_compiler/geometry.py` and `tests/test_geometry.py`; updated the compiler's own `__init__.py` to `hestia-asset-compiler-spike-c3-v1` and this leased plan. Self-review also fixed a confirmed C2 allocation-budget defect in the leased `glb.py` with a focused regression in `tests/test_glb.py`, detailed below. No empty model/scaffolding, external dependency, input, schema, Blender or runtime change. Geometry consumes `read_glb` output; no report digest/binding, thickness proof, voxelization, output publication or successful full compile is asserted.

Column-major Float64 matrices compose `parent * (T * R * S)`, including shear. Matrix/TRS mixing, projective/nonfinite matrices, singular local/world matrices and invalid quaternions reject. Unit-quaternion squared-norm tolerance is `1e-6`; components are retained, not repaired/renormalized. Every reachable node, including unannotated transform ancestors and geometryless joints/markers, is independently checked. Placements preserve stable semantic IDs and their canonical world matrix. Exact determinant signs of the stored Float64 matrix control a single total-world reflection winding swap. Triangle keys use part/render-material IDs and only cyclic rotations.

Topology is actual per-part baked geometry, not report counters: exact positional seam joining, duplicates independent of material/winding, zero area, edge incidence/orientation, closed Solid vertex fans, and illegal self/component intersection/contact. Stdlib `Fraction` predicates operate on the **already baked Float64 coordinates**, with no epsilon weld or alternate authoring geometry. Only shared topological vertices/edges may intersect. Separate disjoint/nested components are allowed and cavity winding is retained. This is geometry proof only, not a cavity/interior/air classifier. Shell surfaces can be open; other representations do not silently receive Solid fill authority.

The versioned limits remain unchanged. Preflight bounds instance-expanded triangles to 20,000 and the **sum of per-part unordered triangle pairs to 2,000,000 before world expansion/topology maps**. Thus the quadratic reference admits at most 2,000 triangles in one part (2,001 rejects); there is no new unbounded pair list. Referenced-vertex expansion is at most three vertices per admitted triangle; unused accessor rows are not multiplied by mesh instances. Tests mock expansion/topology to prove the pair guard runs first and prove 2×1000-row instances transform only 18 points (two origins plus 2×8 used vertices). World points and geometryless placements obey the 1,000,000 m absolute coordinate ceiling. Grid/flood/candidate/brick/output consumers are still C4+ and must apply the C2 frozen guards before allocation.

Negative fixtures preceded `geometry.py`: expected missing-module failure, exit 1. The first implementation run exposed a **production** canonical-hash defect: root TRS integer-valued matrix entries differed in serialization from composed Float64 entries after two mirrors. Fixed the owning matrix boundary to always store Float64; the two-mirror, equivalent explicit-matrix/TRS, and canonical-permutation regressions now pass. No oracle, winding rule, report contract, or source provenance was relaxed to get green.

Confirmed self-review finding: C2 capped accessor decoding and reachable instances but constructed separate flat index tuples for **all** primitives, including unreachable meshes sharing an accessor. Many such primitives could multiply stored indices beyond the byte ceiling. A negative test with mocked binary decoding reproduced the missing guard for indexed and nonindexed primitives (two subtest failures, exit 1), without allocating the oversized copies. The reader now charges every primitive's flat index storage to the **existing** cumulative 33,554,432-byte logical decoding budget before any binary decoding. Numeric limits/version/profiles and accepted geometry semantics are unchanged; the guard closes an omitted intermediate, rather than increasing limits or relaxing validation. Both cases and all prior tests pass.

Fresh own verification, with explicit TEMP/TMP/interpreter/worktree from above:

```text
-B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_*.py' -v
Ran 45 tests in 0.398s
OK
exit 0; 18 reader + 27 geometry tests, no failures/skips

-B -m unittest discover -s tools/blender/tests -p 'test_*.py' -v
Ran 58 tests in 0.193s
OK
exit 0; intentional negative-path diagnostics as in C0, no Blender process
```

Coverage is the relevant **partial gates** of G03-G08/G17-G19/G20-G26/G28-G30: negative/origin-crossing bounds, exact 90-degree matrix and three-axis quaternion TRS oracles, Float64 translation, nonuniform-parent/rotated-child shear, one/two mirrors, reused meshes/part parent graph, joint/CutInterface placements and invalid ancestors, open/nonmanifold/degenerate/duplicate faces (including across materials), exact seam joining, disconnected/nested components, coplanar/noncoplanar/adjacent-face intersection and touch negatives, no epsilon weld, canonical list/cyclic/node/primitive/material reorder equivalence, truthful changed raw source SHA, and pre-expansion budget failures. Full golden voxel occupancy, ten-run package determinism, flood/tunnel topology, thin decisions, report admission and package faults are **NOT RUN**, not implied by these unit tests.

Read-only Blender/schema/apps/README/AGENTS/DevToolbox comparison to the accepted C1 commit: PASS, exit 0, empty. HEAD before C3 publication remains exact C2 SHA and `origin/main` exact base; lease/status contains only the C3 files/plan and untouched instrumentation. `git diff --check` PASS, exit 0 (normal LF/CRLF warning, not a whitespace error). Cache/TEMP checks PASS with `-B`; repeat the hygiene check after tests and inspect the complete staged C3 diff before the exact scoped commit. Publication SHA/parent/result and a **fresh post-commit** test/diff/status checkpoint are reported after execution, not fabricated into this commit's own content.

### R2-B / R3-B external review and actual narrow correction — 2026-10-02

**Relayed external evidence, not this agent's runs:** superorchestrator reported R2-B **GEOMETRY PASS** on C3 `286d7a89f588ee33fa48f748ea14216bb61e7239`, 15 independent in-memory case groups, no current geometry findings. R3-B reported **Reader REQUIRES_FIX**, four confirmed findings below. Its separate small geometry check passed 1008 triangles / 84 disconnected closed boxes / 507528 pairs; this was not a voxel/package or timing benchmark. Its pre-read/depth/token/duplicate/nonfinite/absolute-coordinate/instance/unreachable-index negative checks passed. Medium/Large remained budget-excluded / NOT RUN. User's fresh meta-run: `Ran 45 tests in 0.477s`, PASS, exit 0; baseline-to-HEAD whitespace exit 0; name-status only the three new research docs and eight new compiler files; status only the two accepted instrumentation logs. Official Khronos minimum/default facts for the two render fields were freshly verified by the superorchestrator, not claimed as this writer's documentation fetch.

R2's future warning is retained in the C5 plan: equal-outward nested boundaries can be geometrically closed with signed volume 9, while reversed-inner boundaries give 7. Neither the closed flag nor signed volume alone authorizes fill. C5 must independently test per-part regional parity and both winding variants at both profiles. **No geometry modification or C5 implementation is made here.**

Own TDD: added four reader regression methods with negative/positive subcases **before editing production**. Actual red run: `Ran 22 tests in 0.307s` / `FAILED (failures=21, errors=6)`, exit 1. These were expected admission/positive-control failures, not setup/import failures. The 1025-material fixture produced 526850 counted owner-list visits before its late cap (including scanner traversal); the externally reported 525825 value counted only identity comparisons. The at-limit material test also reproduced the repeated list scan. Unknown transport locations and U8 UV natural-stride/offset negatives were accepted; zero/default render positives and opaque ordinary extras were rejected.

Implemented common-reader fixes and retained all original tests:

1. Material/node list form, cap and object-member checks now precede bounded identity-set preparation and location scanning. Over-limit tests assert **zero owner-list visits**, and the valid 1024-material case asserts at most four list passes; no timing/memory benchmark is inferred.
2. Root/scene/mesh/primitive/buffer/view/accessor/image/sampler/texture/PBR/texture-info/extension-child Hestia records all reject stably with `glb.semantics-location`. Valid asset/node/material records and normal opaque extras remain accepted with unchanged geometry/semantic hashes.
3. Attribute alignment runs in common primitive preflight, before any binary accessor decode. Mocked decoder negatives prove ordering. U8 UV stride 4, natural U16/VEC2, natural U8/VEC4, padded U8/VEC3, finite NORMAL/TANGENT, and component-aligned U8/U16 indices remain accepted.
4. Render zero/positive/default cases are accepted without input/default rewriting; negative/bool/null/string/list/nonfinite cases reject. Full-reader thickness-zero and threshold-force-zero regressions prove strict positive semantic values remain required.

Own fresh commands use the same explicit interpreter, `-B`, worktree and task TEMP/TMP above:

```text
-B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_glb.py' -v
Ran 22 tests in 0.248s
OK
exit 0

-B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_*.py' -v
Ran 49 tests in 0.586s
OK
exit 0; 22 reader + 27 unchanged geometry methods, no failures/skips
```

Fresh working-diff whitespace and name-status checks: PASS, exit 0, exactly the three correction paths. Index was empty before staging. Own `-B` hygiene check: PASS, exit 0; no Blender/compiler `__pycache__`, task TEMP empty, parent retained. Normal LF-to-CRLF warnings are not whitespace failures.

Numeric limits, `spike-budgets-v1`, profiles, geometry/semantic hash algorithms and `positive()` are unchanged. No report binding, package publication, Blender E2E or benchmark run; unchanged Blender host baseline need not be rerun for this reader-only correction. Final staged diff/lease/whitespace self-review and post-commit compiler/status/hygiene checkpoint are required before reporting publication. Targeted independent R3 closure remains user-owned and pending; green unit tests do not claim that review or full-spike acceptance.

### C4 actual surface evidence and external gate acceptance — 2026-10-02

**External evidence relayed by the superorchestrator, not this writer's runs:** R3-B2 independently closed all four reader findings PASS at `9328d5c629c7de31c7462c983ca810bc726625a6` by source/diff and in-memory closure checks; R2-B geometry PASS remains unchanged. Meta full compiler suite: 49 PASS, exit 0, 0.599 s; baseline-to-HEAD whitespace exit 0, exact three corrective paths, status only the two accepted instrumentation logs. This is checkpoint acceptance, not full-spike acceptance. The correction's own post-commit run was 49 PASS in 0.819 s, separately reported.

Own C4 TDD: wrote `tests/test_surface.py` first; missing `voxel` module produced one failed-import test / `FAILED (errors=1)`, exit 1. Implemented `voxel.py` only, then focused 10 PASS in 14.611 s, exit 0. After adding at-limit 255 slot, remapped primitive ordering and aggregate candidate-work controls, the fresh full compiler run was `Ran 59 tests in 13.492s` / `OK`, exit 0 (22 reader + 27 geometry + 10 surface, no failures/skips). Same explicit Python/TEMP/TMP/worktree; command `-B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_*.py' -v`.

Versions: `spike-exact-sat-contact-a-v1`, `spike-owned-16-x-fastest-v1`. Exact `Fraction` projections are the conservative numerical reference, not rounded Float64 separation guesses. Candidate intervals are `ceil(min/h)-1 .. floor(max/h)`; padding adds a free layer outside the complete conservative span. Before cell enumeration/sets/packing, preflight charges triangle-box candidates per part and globally, absolute integer bounds including padding, summed part domains/flood cells, summed part-scoped brick spans and 4096-byte output capacity to unchanged `spike-budgets-v1` ceilings.

Independent results: the off-triangle overlapping-AABB negative rejects; exact face/edge/vertex contact and dyadic 2^-80 near-contact checks pass. Negative floor/address oracle passes, including `(-1,-16,16)` -> brick `(-1,-1,1)`, local `(15,0,0)`, offset 15. Cube **surface-only** full sets: 784 cells at 0.125 m and 208 at 0.25 m, with correct free padding and byte count. Final cube occupancy goldens remain C5. Triangle, node, remapped material and primitive orderings give identical cell/binding/owned-brick results; material seams with unresolved competing bindings reject `surface.material-ambiguity` in either order. Air-only pack is empty; duplicate owned cells reject rather than overwrite; 255 slots pass and 256 reject.

Allocation-spy negatives call neither `rasterize` nor `pack_bricks`: 100 m cube exhausts candidate work; 100 separate 8 m instances exhaust **aggregate** candidate work; 50 separate 4 m instances exhaust **aggregate** grid cells; 1025 tiny instances exhaust **aggregate owned** bricks; a 0.125 m span reaching x=1,000,000 m rejects padded absolute grid coordinates. Three unit-cube parts charge 5184 domain/flood cells, 7200 triangle-cell candidates, 24 potential owned bricks / 98,304 bytes, not a single shared global brick estimate. The caps are bounds, not measured heap/performance guarantees.

Complete staged C4 diff self-review and scoped lease/whitespace/hygiene checks passed, followed by fresh focused `Ran 10 tests in 12.743s` / `OK`, exit 0. Publication succeeded at `4a5e6a427bb67d28ef8850fb8aa9b1e8c747cca2`, sole parent `9328d5c629c7de31c7462c983ca810bc726625a6`, exact prescribed message. No Blender baseline rerun (unchanged), services, renderer/UI, package files, or qualified benchmark. C5 edits started only after this C4 commit; surface tests alone did not claim G13/G14 classification.

### C5 actual classification/oracle evidence — 2026-10-03

Added `classification.py` and `tests/test_classification.py`, plus deterministic test-only mesh-combination/orthogonal-union builders in the leased fixture file. Independent expected occupancy is supplied by explicit interval sets, not by those mesh builders or production classifiers. C3/C4, reader, schemas, profiles, numeric budgets, Blender and runtime remain unchanged. These are in-memory research projections, not report-bound successful compiled packages.

Versions: `spike-exterior-six-parity-v1`, `spike-exact-eight-directions-v1`, `spike-orthogonal-cubical-inclusion-v1`; C4 SAT/address versions are unchanged. A free padded-domain corner seeds the required 6-neighbor exterior flood. Each remaining non-surface component is labelled by exact even/odd ray parity at its stable lexicographic cell-center representative, separately per Solid part. Eight fixed directions are tried in order; exact shared-edge/vertex/coplanar hits abandon that direction, never jitter. No proven direction yields `classification.ray-ambiguity`. Winding and signed-volume sums do not select inside. Interior Binding is admitted here only for a unique homogeneous geometry-bound render/structural pair; mixed candidates reject `classification.volume-material-unproven` before rasterization, without a default/first/last priority. Final material/thickness/report admission remains C6.

Topology proof choice and limits:

1. Require every actual Solid triangle plane to be axis-normal. Between the complete set of these planes, each source arrangement region is surface-free and has a constant exact parity label. Collect source Material cubes by those labels; no AABB or fixture ID classifies them. General diagonal/sheared surfaces fail visibly before rasterization.
2. Refine with all actual profile grid planes, preserving exact baked Float64 coordinates as rationals. Source and raster occupy a common cubical complex. Require actual source Material inclusion in raster Material and bijections induced by that inclusion for both Material and complementary Air 6-neighbor regions. No source cavity may disappear/split and no material component may merge/appear.
3. Euler is only an early necessary invariant. Grow source to target using deterministic candidate worklists. Each added cube's **entire** closed intersection with current Material (faces/edges/vertices from all 26 neighbors) must equal the closure of its shared faces: no dangling edge/vertex contacts. That pure face patch must be connected with Euler 1, hence a PL disk in the cube boundary. Gluing the cube ball along this boundary disk replaces one boundary disk by the complementary disk without changing embedded Material/Air topology; in particular inclusion is a homotopy equivalence. A complete finite sequence certifies handles/cavities, not just counts. Incomplete sequences reject `TopologyUnproven`. A test with matching Euler/Material/Air counts but a filled old hole and different new hole is rejected by this certificate.

This is deliberately a bounded orthogonal reference, not a general-purpose mesh topology kernel or physics/World authority. Source-surface topology is already established by C3; `closed` alone is never fill authority. Shell/LayeredShell/StructuralAssembly remain surface-only, Decorative yields no voxel payload, with explicit part policies retained in the original canonical semantics. Separate parts at identical coordinates remain separately owned and classified, never a global XOR.

Own TDD/evidence: classification test file preceded production; first run failed on the expected missing-classification-module import, exit 1. First focused 12 PASS in 13.513 s; expanded 13 PASS in 16.873 s. After adding independent overlapping-Part and mixed-volume-material controls, the fresh full run was **`Ran 74 tests in 36.681s` / `OK`, exit 0**: 22 reader + 27 geometry + 10 surface + 15 classification methods, no failures/skips. A final local certificate bounds assertion/regression also prevents out-of-domain cells before Euler-set allocation.

Complete initial staged diff self-review exposed an insufficient **proof condition**, not a golden failure: connected/Euler-1 attachments with a dangling edge are contractible, sufficient for Material homotopy but not the stronger embedded-boundary/complement claim. Added that counterexample first: `Ran 1 test in 0.001s` / `FAILED (failures=1)`, exit 1. Tightened the same local checker to a pure shared-face closure (a PL boundary disk); did not alter any expected golden, numeric budget, ray rule or accepted control. Fresh focused **`Ran 15 tests in 18.399s` / `OK`, exit 0** includes all mandatory oracles, the strengthened counterexample and certificate bounds guard. Final incremental diff self-review/fresh full publication checkpoint follow and are reported after execution. Unit durations are not qualified benchmarks.

Final source state names the predicate `attachment_is_disk`. Complete initial 778-line staged diff and every subsequent incremental source/test/document change were self-reviewed. Fresh after those changes: **`Ran 74 tests in 36.174s` / `OK`, exit 0**, no failures/skips. Staged whitespace check passed, exact four-path C5 name-status passed, and unstaged diff was empty. Whole nonleased Blender/schema/apps/README/AGENTS/DevToolbox comparison remained empty; numeric source/profile budgets were not edited. Publication and post-commit run/status/hygiene results follow in Git/checkpoint; no second bookkeeping commit or amend is needed to embed the commit's own SHA.

Commands, from the pinned worktree with the explicit Python and task TEMP/TMP above:

```powershell
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_surface.py' -v
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_classification.py' -v
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_*.py' -v
```

Actual independent oracle outcomes: full owned cell sets/bounds/bindings and raw brick byte occupancy agree for G01 N=1000/216, G02 N=840/192, G13 N=5616/992 with cavity Air 216/8, and G27 N=504/128 at micro/standard respectively. G13 passed **both** equal-outward signed-volume-9 and reversed-inner signed-volume-7 variants against the same hollow interval oracle. L-body independent signed-source integrals give volume 3/8 and center (5/12, 5/12, 1/4); raster moments/material mass inputs are not implemented here. Raster `N*h^3` is not analytic source volume or kg.

G14 narrow aligned opening `(0.5,1)^2`: micro passes all four straight external 6-neighbor Air paths; standard rejects `classification.topology-loss` before packing because the handle is sealed. Width-1 control passes both profiles with independent through-body Air paths, not an outside detour. Offset opening y=(0.5625,1.0625), z=(0.625,1.125) also passes both profiles; sheared diagonal source rejects `classification.topology-unproven` before raster allocation. G15 separated solids preserve both components; a second closed-source resolution-loss case rejects a coarse raster merger. Reversed/shuffled triangle lists and correctly remapped node/material/primitive lists preserve final owned cells, bricks and proof data. Boundary-ray ambiguity is visible; no epsilon, random jitter, GWN or force-positive component-volume rule exists.

All C5 allocation sizes/work are preflighted **in aggregate across parts** before grid-range enumeration, cell sets, rasterization, flood, common refinement or packing. Unchanged `spike-budgets-v1` charges surface work plus up to `8*faces*(domain+sourceArrangement)` ray/triangle attempts, `6*domain` flood neighbor visits, and `105*commonRefinement` witness work units (27 possible attachment attempts, 24 region-label neighbor visits, 54 Euler feature enumerations per cell). Each attachment attempt has a fixed 26-neighbor boundary test, like a SAT attempt has a fixed axis family count; these are bounded reference-work units, not measured instructions/CPU. Grid/flood totals include extra arrangement/refinement state; owned brick/output totals remain conservative padded per-part sums. Logical bounds do not claim qualified Python/Fraction peak heap memory.

Own numeric preflight evidence at micro (upper bounds, not performance measurements):

| Case | Total work / 10,000,000 | Grid / 2,000,000 | Flood / 2,000,000 | Source / common cells | Owned potential bricks / output bytes |
| --- | --- | --- | --- | --- | --- |
| G13 | 2,458,176 | 16,125 | 40,000 | 125 / 8000 | 27 / 110,592 |
| G14 | 5,034,048 | 16,075 | 40,000 | 75 / 8000 | 27 / 110,592 |
| Offset control | 5,116,880 | 16,875 | 43,200 | 75 / 8800 | 27 / 110,592 |

Negative allocation spies prove no raster/axes/source-grid/enumeration/flood/brick calls for 50 unit-cube parts exhausting **aggregate** C5 work, 100 tiny diagonal-separated boxes exhausting source/common grid totals (source arrangement alone 201³ > 2,000,000), and massive bounds exhausting C4 candidate work. C4 already proves absolute padded-coordinate, aggregate domain and owned-brick guards. No cap was raised. Final full staged diff/lease/whitespace/hygiene review and publication checkpoint are required; actual commit SHA/parent/result and final post-commit outputs are recorded in Git/checkpoint, not self-predicted here. R2/R3 independent C4/C5 review is pending. Blender host baseline is not rerun for unchanged upstream; report/output/faults/CLI/full G01-G30 hash corpus/10 repeats/GWN/Blender E2E/qualified performance remain NOT RUN under C6-C8 gates.

### Independent contact-A interval goldens — executed at C5, NOT RUN at C4

These counts are analytic interval oracles for this explicit research convention, not compiler-produced expected values or a global runtime norm. Intervals are inclusive integer cell coordinates. They describe final surface-plus-material fill; the extra flood padding is excluded.

| Fixture / source bounds | 0.125 m oracle | 0.25 m oracle | Source geometric volume |
| --- | --- | --- | --- |
| G01 `[0,1]^3` | `[-1..8]^3`, N=1000 | `[-1..4]^3`, N=216 | 1 m³ |
| G02 `[0,1] × [0,1.5] × [0,0.5]` | `[-1..8] × [-1..12] × [-1..4]`, N=840 | `[-1..4] × [-1..6] × [-1..2]`, N=192 | 0.75 m³ |
| G13 `[0,2]^3` minus cavity `(0.5,1.5)^3` | occupied `[-1..16]^3` minus Air `[5..10]^3`, N=5616 | occupied `[-1..8]^3` minus Air `[3..4]^3`, N=992 | 7 m³ |

`N * h^3` is the conservative raster approximation, deliberately not the analytic source volume. G14's grid-aligned `(0.5,1.0)^2` tunnel cross-section has 2×2 free cells at 0.125 m but none at 0.25 m under contact A; the latter requires a visible topology-loss rejection, not a claimed preserved tunnel. A separate resolvable control must succeed at both profiles.

### Future corpus and command matrix — NOT RUN

Corpus obligations remain G01 cube, G02 noncube box, G03 negative coordinates, G04 origin crossing, G05 90-degree rotation, G06 arbitrary TRS, G07 reflection, G08 mesh reuse, G09 thin plate, G10 beam, G11 rod/tube, G12 shell, G13 hollow closed Solid, G14 tunnel, G15 disconnected solids, G16 multimaterial wedge, G17 part hierarchy, G18 joint, G19 CutInterface, G20 open Solid, G21 nonmanifold, G22 degenerate, G23 nonfinite, G24 required extension, G25 OOB, G26 sparse, G27 L-body, G28 triangle permutation, G29 node/material permutation, G30 bounds/budget. Each later corpus record needs stable fixture identity, input hashes, independent oracle, diagnostic/outcome, profile, and actual evidence; rejection/BLOCKED is explicit, not silent omission. G13 is mandatory at both profiles.

Ordering matrix for G01/G13/G16/G27/G28: triangle list normal/reversed/fixed-seed, nodes normal/reversed, primitives normal/reversed, materials normal/reversed with references updated. Reversing a **list** is not reversing each triangle's winding. Compare the two exact hash classes in the audit. Ten repetitions of identical inputs compare every deterministic output file, tree, brick, and diagnostic order.

Future commands use the same TEMP/TMP and worktree above:

```powershell
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/hestia_asset_compiler/tests -p 'test_*.py' -v
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m unittest discover -s tools/blender/tests -p 'test_*.py' -v
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -m compileall tools/hestia_asset_compiler
& 'C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe' diff --check
```

`compileall` intentionally writes caches only under the future compiler lease; `-B` continues to protect normal imports. Do not compileall the existing Blender tree. Exact CLI options are defined and tested at C7 rather than inventing executable options here. Browser/npm/Playwright/screenshots are NOT APPLICABLE to this documentation/offline-only slice; no UI/render changes exist.

## Risks

- Raw provenance changes under permutations; stripping source hashes to force a full-tree equality would falsify the handoff.
- Flood-only complement fills closed cavities, and conservative surface cells can seal tunnels. Parity ambiguity or unproven topology must not become invented occupancy.
- Exporter report inventory is not baked topology, transform, thickness, or exact Part ownership proof. Joint validation and unannotated export gaps need downstream rejection/validation, not upstream writes.
- Palette IDs, terrain material 0, terrain brick shapes, and adaptive/structural proof inputs are different boundaries; a research package cannot claim runtime compatibility.
- Path/graph/accessor/instance/grid/flood/output budgets must cover intermediates before allocation. Qualified performance remains unknown.
- Exact-predicate quadratic topology is a deliberately bounded reference, not a scalable production kernel. Current 20,000-instance-triangle / 2,000,000-pair limits exclude the proposed Medium/Large benchmark input sizes, and one-part cases above 2,000 faces reject. Do not quietly raise budgets: future coordinated benchmark/admission scope must explicitly report this limitation or receive a separately authorized versioned revision. Logical decoded byte caps are not measured Python/Fraction peak memory guarantees.
- C5's orthogonal cubical certificate is intentionally narrow; general diagonal/sheared Solid topology is `TopologyUnproven`, and incomplete deterministic attachment sequences reject even if Euler/component counts agree. Certification and source/refinement/ray aggregate budgets can reject otherwise valid geometry. This is honest unsupported admission, not an accepted full compiler or a silently adopted runtime policy.
- Real Blender axis/unit/exporter-version behavior remains unverified until allowed-root E2E; metadata-only discovery is not that proof.

## Rollback / safe stop

Stop on a changed base, write outside lease, new current same-boundary contradictory MUST, unknown material/ownership/thickness proof, invalid geometry, exhausted budget, or existing publish target. Report exact evidence; do not repair by rewriting inputs, silently changing profiles, guessing defaults, deleting outputs, or broadening source ownership.

At C1 retain the authorized docs commit, untouched instrumentation, and empty task temp parent; no product rollback is needed. No destructive reset/clean/worktree/file deletion is authorized. Later failures clean only compiler-owned staging and leave source/existing output unchanged. Any upstream contract change or product adapter needs a separate task and approval.

## Progress log

- [x] C0 discovery/baseline: exact base/branch, complete required reading, 58 host tests PASS, no tracked source changes. Instrumentation exception explicitly accepted; porcelain is not claimed empty.
- [x] C1 read-only contract audit and three-document draft; R1-A2 comparison/design resolutions and R2-A/R3-A requirements recorded below and in the register.
- [x] C1 fresh document/diff allowlist verification and self-review: PASS as recorded above. Authorized publication result and SHA are recorded in the final checkpoint response/Git after the exact scoped commit, not predicted here.
- Superorchestrator independently accepted C0/C1 (not the full spike): read all three documents; HEAD `89f068dfff2d965177165dce082c5289a35d0df4`, exact parent `25bc7f5bbd2db6317c42193873eadeaf10a092c5`; scoped diff whitespace exit 0; only the two untracked instrumentation files; independently reran Blender host tests using Python `-B`: **58 PASS**, exit 0, **0.320 s**. This is relayed external meta-evidence, not this agent's run.
- C2 then C3 authorized explicitly, serial sole writer, exact separate commits; stop before C4. No further agents or independent implementation review dispatched here.
- [x] C2 reader/fixture implementation, fresh scoped tests/self-review and publication: 17 PASS, exit 0; exact scoped commit `6b6e6fb1eb38642bca6045630270134337a705ce` with the accepted C1 commit as sole parent.
- [x] C3 geometry/semantics implementation, scoped reader budget-defect fix and fresh combined tests: 45 PASS (18 reader + 27 geometry), exit 0; fresh own unchanged Blender baseline 58 PASS, exit 0. Full staged self-review/lease/whitespace verification immediately precedes the exact C3 publication; its SHA/result and fresh post-commit checkpoint are recorded in Git/final response.
- C3 publication completed at `286d7a89f588ee33fa48f748ea14216bb61e7239`, sole parent C2; own post-commit compiler 45 PASS in 0.576 s and unchanged Blender host baseline 58 PASS in 0.223 s, exit 0, as previously reported. These are distinct from the later external 45-test / 0.477 s meta-run.
- Superorchestrator relayed implemented-code reviews: R2-B GEOMETRY PASS (15 case groups), R3-B Reader REQUIRES_FIX (four findings); authorized only the narrow shared-reader fixes/regressions/this plan and the exact separate corrective commit. No new reviewer agent dispatched by this writer.
- [x] Four R3-B regression groups reproduced red before production changes; common-reader fixes and fresh full suite: 49 PASS (22 reader + 27 geometry), exit 0. Numeric budgets/profiles/geometry/upstream unchanged; publication follows final scoped staged self-review/checks, actual result/SHA recorded after execution. Independent R3 targeted closure remains pending.
- R3-B correction published at `9328d5c629c7de31c7462c983ca810bc726625a6`, sole parent C3. User-relayed R3-B2 independent closure PASS and fresh meta 49 PASS in 0.599 s are external evidence above. C4 then C5 explicitly authorized; no repeat C2/C3 review loop.
- [x] C4 exact SAT/surface/address implementation, fresh full 59 PASS and post-self-review focused 10 PASS, exit 0; published `4a5e6a427bb67d28ef8850fb8aa9b1e8c747cca2`, sole parent reader correction, exact prescribed message and scoped three-path lease.
- [x] C5 padded exterior flood/exact parity/pure boundary-disk inclusion certificate and independent interval/tunnel controls implemented; full scoped self-review and fresh full 74 PASS in 36.174 s, exit 0. Separate prescribed publication and post-commit checkpoint follow; actual result/SHA is reported in Git/final response. C6 remains STOP.
- C5 published `6d55238c076ec2ccf9e743ea63470ead4e25690c`, sole parent C4, own post-commit 74 PASS in 34.854 s, exit 0. Later relayed scoped R1-C/R2-C/R3-C and META 74/33.336 s are external evidence in the C6 section, not this writer's runs.
- [x] C6 scoped implementation, own full diff/self-review, final fresh 111-test compiler verification and unchanged 58-test host baseline PASS, fault/preimage/support evidence and clean lease/cleanup verified. Single prescribed commit publication follows these verified contents; SHA/parent and post-commit status are reported externally. Independent C6 review and full-spike acceptance are not claimed. STOP before C7.
- [ ] C7-C8: **NOT AUTHORIZED / NOT RUN**; STOP before C7.

R1 reviewer `731643b5-d353-4147-82e7-6d6d4eab31fb`, R2 `a9f5de5b-43db-4fbc-bb1b-625a06dfa53d`, and R3 `23ac2427-9a49-4c2e-a3da-7996b5affb7e` are user-dispatched read-only reviewers; earlier prechecks and later implemented-code scoped results are explicitly attributed. C4/C5 scoped closures were relayed by the superorchestrator; **independent review of actual C6 code remains pending**. This writer claims implementation/tests/self-review only, no full spike/human acceptance. C3 signed source volume is not C5 cavity topology or C6 raster volume.

## Definition of Done

**Current checkpoint:** preserve accepted C0-C5 commits; actual report-bound C6 core/thin/semantic/geometric deterministic package and verified atomic publication, focused positive/negative/fault/preimage tests, fresh full suite/read-only baseline and complete scoped self-review; one exact separate prescribed commit; report actual SHA/parent/files/commands/counts/faults/preimages/examples/limits/cleanup. **STOP before C7** for user-dispatched independent C6 reviews. No amend/rewrite/push, budget increase, full corpus/ten-repeat/Blender/performance/product/full-spike claim.

**Eventual separately authorized spike:** working narrow reader/geometry/reference classifier/semantic package/CLI; G01-G30 outcomes and independent oracles including both-profile G13; honest thin/topology/material rejection; same-input byte determinism and explicit permutation classes; fault-safe whole-package publication; fresh tests/baseline/compileall; coordinated benchmark or explicit nonqualified status; real Blender E2E or precise NOT RUN blocker; independent full review with confirmed fixes verified; final reports/handoff and lease-clean commit. `PRODUCT_INTEGRATED = NO` even if accepted.
