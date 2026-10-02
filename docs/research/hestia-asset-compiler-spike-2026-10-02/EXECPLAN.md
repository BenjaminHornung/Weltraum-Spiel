# ExecPlan: isolated Hestia asset compiler spike

## Goal

Current authorization is **C2 then C3**, serially, following the accepted C0/C1 checkpoint `89f068dfff2d965177165dce082c5289a35d0df4`. Implement and freshly verify the narrow reader, then canonical geometry; make their two exact scoped commits and **STOP before C4**. No full compile, voxelization, package, or CLI success is claimed.

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

- No C4-C8 implementation before further authorization; no future gate marked complete from a plan.
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

All gates are serial. Completion requires fresh evidence and self-review; the superorchestrator retains gate authorization and independent-review responsibility. **C2 then C3 are authorized; C4-C8 remain NOT AUTHORIZED / NOT RUN.** File splits are minimum intended owners, not a requirement to create empty scaffolding.

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

### C4 — conservative surface and addressing

- Intended files: `voxel.py`, `tests/test_surface.py`; share integer addressing rather than creating a runtime adapter.
- Apply contact A and full SAT, prevalidate complete surface/candidate/brick bounds and work budgets, then allocate. Mathematical floor division, x-fastest 16³ packing, deterministic candidate sets and per-part ownership.
- Independent SAT negative: triangle `x=0, y>=0, z>=0, y+z<=1` does **not** overlap a cell with `y,z>=0.75`, despite overlapping broadphase bounds.
- Verification: surface portions of G01-G12/G16/G27-G30; negative coordinates; reordered candidate owners; budget rejection before allocation. G13/G14 final interiors wait for C5.
- Commit: `feat(asset-compiler): add conservative reference surface voxelizer`.

### C5 — reference interiors, cavities, tunnels

- Intended files: reference classification in `voxel.py`, `tests/test_classification.py`, independent interval oracle helpers in tests.
- Implement the padded 6-neighbor flood + per-part cavity-aware geometric parity rule above. Stable ambiguous-case rejection; no GWN dependency. Prove hollow regions and topology preservation, not just exterior flood reachability.
- Run mandatory G13 at **both** profiles against independent analytic cell intervals. Include nested cavity winding, disconnected solids, resolvable tunnels, under-resolved tunnels, phase/diagonal cases, and grazing/edge/vertex ambiguity. Shell/LayeredShell never get Solid fill.
- Verification: G01/G02/G13/G14/G15 and the exact interval/count oracles below. A rejected under-resolved tunnel cannot be reported as successful preserved connectivity.
- Commit: `feat(asset-compiler): classify solid interiors with reference flood fill`.

### C6 — bound semantics, thin safety, packages, atomicity

- Intended files: `semantics.py`, `package.py`, `diagnostics.py`, `tests/test_semantics.py`, `tests/test_package.py`.
- Check raw GLB SHA against **both** report GLB fields, and canonical payload SHA using the existing helper. Record raw report source SHA separately. Reject null GLB hashes, Error diagnostics, digest-valid semantic conflicts, ambiguous ownership, or malformed references.
- Preserve asset/revision, parts/parent, joints/world placement, markers/interface/world placement, policies, materials and tags. Unused declared report materials can be legitimate exporter slots; the 255 cap counts only active voxelized slots. `paletteIndex` is not a local slot.
- Homogeneous Solid material assignment can use its unique geometry-bound semantic material. Do not invent interior precedence for multiple distinct materials; reject ambiguity without a committed rule. Carry part ownership in brick entries.
- Add honest thickness/replacement proofs and outcomes; overdeclared-thickness negatives. Geometric cell count/volume/center sums per structural material only, optional explicitly defined second moments; no physical density/mass/inertia.
- Freeze exact research manifest, semantic projection, hash preimages, diagnostics, source inventory and deterministic compile report; manifest-tree preimage excludes its self field. No timing/path/host/user/locale in content hashes.
- Whole-generation task-owned sibling staging, finish and validate all files, single atomic directory rename. Reject **any existing target**, including empty dir/file/link/junction, unchanged. No target deletion/replacement. Faults: after brick 1, before manifest, rename failure, unwritable parent, publish collision with sentinel intact; clean only owned staging.
- Commit: `feat(asset-compiler): emit semantic deterministic asset packages`.

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

Fresh C2 command: the Python `-B` unittest command above with `-p 'test_glb.py' -v`, same explicit TEMP/TMP/interpreter/worktree. Exact final summary: `Ran 17 tests in 0.176s` / `OK`, exit 0, no skips. `git diff --check` and read-only Blender/schema/apps/README/AGENTS/DevToolbox baseline comparison both exit 0, empty. Status inventory is exactly the six new compiler files, this leased plan modification, and the two untouched instrumentation files. `-B`/no Blender or compiler caches/empty task TEMP check PASS, exit 0. Self-review corrected no production contract; confirmed offset oracle corrected as described. Staged diff/allowlist is checked again immediately before the exact C2 commit.

### Future independent contact-A goldens — NOT RUN

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
- [x] C2 reader/fixture implementation and fresh scoped tests/self-review: 17 PASS, exit 0; exact C2 publication follows final staged lease/whitespace checks, resulting SHA recorded by Git/checkpoint.
- [ ] C3 implementation/verification: authorized after the C2 commit, not yet run.
- [ ] C4-C8: **NOT AUTHORIZED / NOT RUN**; STOP before C4.

R1 reviewer `731643b5-d353-4147-82e7-6d6d4eab31fb` independently approved the comparison and cavity-design interpretations (R1-A2, relayed by superorchestrator). R2 `a9f5de5b-43db-4fbc-bb1b-625a06dfa53d` and R3 `23ac2427-9a49-4c2e-a3da-7996b5affb7e` completed read-only technical prechecks, also relayed. None is described as a review of implemented compiler code; no implementation or independent hollow/tunnel oracle has run.

## Definition of Done

**Current checkpoint:** accepted C0/C1 preserved; executable C2 ingestion and C3 canonical geometry/semantics freshly tested and self-reviewed; two exact separately scoped commits, no upstream modifications; branch/base preserved; SHAs, exact test counts/output, profiles/budgets, limits and cleanup reported; **STOP before C4**. No full-spike acceptance or successful compile claim. The superorchestrator will commission independent Parser/Budget and Geometry implementation reviews after this checkpoint.

**Eventual separately authorized spike:** working narrow reader/geometry/reference classifier/semantic package/CLI; G01-G30 outcomes and independent oracles including both-profile G13; honest thin/topology/material rejection; same-input byte determinism and explicit permutation classes; fault-safe whole-package publication; fresh tests/baseline/compileall; coordinated benchmark or explicit nonqualified status; real Blender E2E or precise NOT RUN blocker; independent full review with confirmed fixes verified; final reports/handoff and lease-clean commit. `PRODUCT_INTEGRATED = NO` even if accepted.
