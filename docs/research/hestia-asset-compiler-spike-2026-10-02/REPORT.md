# Isolated Hestia asset compiler spike — accepted C8 report

Package/path date **2026-10-02**; verification and closure 2026-10-03. **SPIKE_ACCEPTED_WITH_NOTES by user-relayed META**, following all three independent scoped endreviews PASS_WITH_NOTES/no open findings. This is not human review, product readiness or a release. Exact final commit is authorized; actual Git SHA is recorded externally after commit, not predicted here. Push/merge/PR remain outside this writer's closeout. `PRODUCT_INTEGRATED = NO`.

## Identity, authority and scope

| Item | Actual frozen identity / boundary |
| --- | --- |
| Base / recorded origin/main | `25bc7f5bbd2db6317c42193873eadeaf10a092c5` |
| Branch | `agent/hestia-asset-compiler-spike-2026-10-02` |
| Sole writer | `72981f9a-14c7-4b4f-add6-27398d86c473` |
| Implementation / independent review freeze HEAD | `c8e451a3e52fc8da743df011debae682f93c89a3`, sole parent `bc83267745906c956c69815e91db64766ea5d676` |
| Compiler Git tree at freeze | `a458f03f2aae82846a666ce29d57ec1f6505ab94` |
| Actual Python-source manifest SHA-256 | `c2a6c63cb94f2f24d29e3a727cc1f72e88ca90e60d26a504886d291118cf7e1a`; paths/sizes/bytes and hash definition retained in C8_DETERMINISM |
| Lease | `tools/hestia_asset_compiler/**`, `docs/research/hestia-asset-compiler-spike-2026-10-02/**` only |
| C8 actual changes | Own research docs/evidence and `verify_c8.py` verification wrapper only; compiler/product code, upstream, dependencies, limits, versions, preimages and frozen expected hashes unchanged |
| Final Git SHA / branch publication | Actual final SHA belongs in Git and the external post-commit checkpoint, not its self-referential contents. Authorized sole parent: c8e451...; exact title `feat(asset-compiler): complete isolated Hestia asset compiler spike`. Writer stops after commit; META owns normal dedicated push after fresh identity/base checks. |

C0–C8 are accepted by EXTERNAL user-relayed META. All C6/C7 findings and C8 endreviews are CLOSED, scoped in [REVIEW.md](REVIEW.md). Own 134/58/native-corpus/diagnostic execution is external to META; META's separate final program Exit0 independently checked the 25-source manifest, test log/raw-corpus hashes, all370 C7-equal records/outcomes and401 unique inventory entries. R1 checked authority/status/handoff; R2 pins/inventory/counts/actual repeat loop/source freeze; R3 actual logs/hashes/faults/caps/benchmark/cleanup. No human review or real Blender E2E implied. Historical META131/61.092s belongs to bc832; META21/19.220s to c8e451. No new agents/tracking/services/dependencies/privileges/upstream or throughput edits.

## Explicit status axes

| Axis | Current status / meaning |
| --- | --- |
| IMPLEMENTED | YES — strict bounded GLB2/report admission, finite world baking/mirrors, canonical oriented triangles, inclusive exact SAT surface, reference flood/even-odd/topology proof for admitted support, measured thin decisions, Part/material-owned bricks, actual-byte hash-tree verifier and five real CLI subcommands |
| CODE_VERIFIED | PASS — fresh 134 compiler tests, read-only 58 Blender host tests, compiler-only compileall; not a claim of general geometry support or real exporter E2E |
| CORPUS_VERIFIED | YES / own PASS — exact G01–G30, both profiles, unchanged 285 SUCCESS / 77 EXPECTED_REJECTION / 8 reasoned BLOCKED per logical set. Expected-outcome verification, NOT every asset SUCCESS or final acceptance. |
| DETERMINISM_VERIFIED | YES / own PASS — complete native 370 logical records ×10 / 3700 actual case executions, all same-input file/brick/tree/diagnostic bytes and ordering comparisons; actual pipeline, not cache replay. Root call count NOT_INSTRUMENTED. |
| BLENDER_E2E_VERIFIED | NOT RUN — EXECUTION_ROOT_BLOCKER; confirmed Blender 5.2 binary exists outside Ctree, not globally unavailable; host mocks are not real exporter evidence |
| PERF_DIAGNOSTIC | YES / CONTAMINATED_DIAGNOSTIC — ONE current 1008-triangle Small/profile after correctness; memory UNSUPPORTED, Medium/Large budget excluded, no isolated/qualified result. C7 artifact untouched. |
| GWN | GWN_NO_ADOPTION / REASONED_NOT_IMPLEMENTED — accepted research decision, no executed sample/candidate claim |
| PUBLICATION | Native package CLI/fault ownership PASS; actual401-file corpus and benchmark generations verified/removed. Repeated packages are in-memory, not3700 published directories. Exact Git closeout commit authorized; actual result recorded externally. Push NOT RUN by this writer. |
| PIN | PASS — unchanged original cube: 12 files / 41,295 bytes / tree `d9a27b06a65a37b6c7af4c75b58ad327c1fe9c04452fcf96a03bfecc75f4494b`; all C7 frozen artifacts unchanged |
| INDEPENDENT_END_REVIEW | EXTERNAL SCOPED PASS_WITH_NOTES for all R1/R2/R3; no open findings, user-relayed. Not human review or unrestricted product acceptance. |
| PRODUCT_INTEGRATED | NO — no HVP, runtime loader, renderer, public format, Destruction/Cut/Save/Physics or A+B adoption |

## Actual own verification and commands

Every executable/script/cwd/TEMP is inside Ctree. Workdir is `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-Agent3-AssetCompiler-2026-10-02`. Explicit Python prefix and task-owned TEMP:

```powershell
$env:TEMP='C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a'; $env:TMP='C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a'
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -X utf8 docs/research/hestia-asset-compiler-spike-2026-10-02/verify_c8.py foundation
```

The wrapper invokes this exact interpreter with `-B -X utf8` and these actual argv suffixes:

| Command | Actual result |
| --- | --- |
| `-m unittest discover -s tools/hestia_asset_compiler/tests -p test_*.py -v` | 134 tests, 60.630 s, Exit 0 / PASS |
| `-m unittest discover -s tools/blender/tests -p test_*.py -v` | 58 tests, 0.140 s, Exit 0 / PASS, read-only host/pure tests |
| `-m compileall -q tools/hestia_asset_compiler` | Exit 0 / PASS; explicit PYTHONPYCACHEPREFIX under one task-owned TEMP generation; 25 actual .pyc files, only that cache removed; compiler/Blender source trees cachefree before/after |
| `-m tools.hestia_asset_compiler golden --repeats 10 --output <OWNED_CTREE_GENERATION>` | Managed completed/Exit0/stderr0/1426.516652s; 90-min max/5250-s child timeout/40-line bound; full expected-outcome/byte/ordering checks PASS |
| `-m tools.hestia_asset_compiler benchmark --population small --output <OWNED_CTREE_GENERATION>` | Exit0; ONE actual diagnostic/profile after correctness, owned publication verified/removed |
| `-m tools.hestia_asset_compiler benchmark --population medium` and `--population large` | Each Exit0/both profiles NOT_RUN_BUDGET_EXCLUDED before builder/core, not successful population compilation |
| Browser / Unity / UI / screenshot | NOT APPLICABLE — offline pure tool and doc/evidence-only C8 |

The first managed launcher rejected PowerShell `&` BEFORE Python (40ms/Exit1/zero cases). Only launcher syntax was corrected to direct Ctree Python; readiness and final Exit0 were confirmed for `bg_murxlpal_3g`. No compiler failure/retry or foreign process stopped. One300-s managed completion wait reached its own bound without terminating the task; bounded background Wait-Process on task-owned PID42068 delivered automatic completion notification/Exit0, no polling loop. This is separate from historical UNKNOWN/non-reproduced publication.io. A later read-only inline evidence-inspection SyntaxError was corrected to simpler queries; it did not execute verification, change artifacts or rerun corpus/benchmark.

Fresh suite contains native compile→validate→inspect both profiles with source bytes unchanged; missing required flags/default/profile/exit-code guards; existing targets and corrupt inspect rejection; wrong report bindings; private source warnings; typed/rehashed metadata/count probes; owned staging faults; native junction/broken-junction/collision checks; RAM-rootescape guard; actual G24 core/API/CLI reject with synthetic clocks; independent grid/bounds/h³ descriptor probes; and Medium/Large allocation spies. All 192 test entries PASS: 188 single-line `... ok` entries and four host fault tests that intentionally print expected ERROR diagnostics before a separate `ok`. The two native suite summaries are 134/58 with Exit 0, no failures/skips; a single-line-only log-inspection assumption was corrected without any verification rerun or artifact change. Exact fault classes are in REVIEW. Native symlink/broken-symlink remains NOT RUN after WinError 1314, no privilege change.

## Corpus, source bindings and comparison contracts

C7 frozen logical inventory is exact G01–G30, 185 variant-addressed input pairs / 179 different GLB-report SHA pairs; six lawful identity transports remain addressed cases, not deduplicated. Two explicit profiles produce 370 logical records: **285 SUCCESS / 77 EXPECTED_REJECTION / 8 reasoned BLOCKED**. G05 matrix SUCCESS versus ordinary quaternion C3 VALID/compile `thin.unproven`, G06 finite TRS baking VALID/nonorthogonal proof BLOCKED, G11 tube/rod and G12 multilayer preservation BLOCKED remain honest. No snap, repair, invalid-rotation label or Shell relabel. G16 ambiguity rejection is allowed.

G01/G02/G13 (both inner windings) have independent FULL authored interval cell-set oracles, G27 an independent L-union/source-volume/COM oracle. Decoded owned brick bytes, explicit material bindings, independent grid/bounds/h³/moments and G14 through-body six-neighbor Air/source–raster topology correspondence are checked. G01/G13/G16/G27/G28 have the actual 3×2×2×2 triangle-list/node/primitive/material permutation matrix with correctly remapped references. G29 additionally exercises a real reindexed transport.

Same delivered source bytes/profile/versions require ALL output/diagnostic/brick/file/tree bytes equal on every repeat. Correctly remapped semantics require geometry/semantics/voxel content hashes, EXACT projection and owned brick bytes equal; raw source/payload/provenance/full tree may change truthfully. Opposite inner winding is NOT oriented-geometry/projection identity; only its expected even/odd occupancy and owned bricks agree. File-tree verification proves integrity/format/self-consistency, **not source authentication against coherent replacement**.

Raw engine labels `hestia.asset-compiler-golden.c7.v1`, `C7_SMOKE_PASS`, `finalC8Acceptance: NOT_RUN` remain engine/review-boundary fields. C8 machine strings `PENDING_INDEPENDENT_END_REVIEW` / `REPEAT_VERIFIED_PENDING_END_REVIEW` truthfully identify their immutable PRE-COMMIT capture, not current document acceptance. META now accepts the spike; no raw evidence was rewritten to turn a historical capture into a later review. **370×10 =3700 actual case executions**, frozen loop baseline+9 real calls/record and native Exit0, not cache replay; root calls NOT_INSTRUMENTED. All records equal C7,185addressed/179different inputs independently rehashed,401 actual files inventoried/verified/removed. Stdout SHA `090be9cd17a4e503233ea07984601ded2f730fd478c2f2446568dcc6938d19a2`, stderr0.

| Profile | Logical SUCCESS / EXPECTED_REJECTION / BLOCKED | Logical records / actual repeats |
| --- | --- | --- |
| micro-0125-research-v1 | 143 / 38 / 4 | 185 / 10 |
| standard-025-v1 | 142 / 39 / 4 | 185 / 10 |

## Artifacts and immutable old pins

Fully qualified paths below are repository-relative; short C8/document names are relative to `docs/research/hestia-asset-compiler-spike-2026-10-02/`. New raw machine evidence has no private absolute host paths or wall-clock timestamps. Source payload bytes and all old ExpectedHashes are untouched.

| Artifact | Bytes / SHA-256 / disposition |
| --- | --- |
| `tools/hestia_asset_compiler/tests/golden_hashes.json` | 958,962 / `bb803dbfd408f075453f340d7a69a34f24b732debbbb318f04f02995fd073aa6` / UNCHANGED |
| `docs/research/hestia-asset-compiler-spike-2026-10-02/C7_GOLDEN_SMOKE.json` | 2,370,698 / `f377ecb149fecb784ac146bdc5932999998c635bfb9d4cc2e81924c3ced173a6` / UNCHANGED |
| `docs/research/hestia-asset-compiler-spike-2026-10-02/C7_BENCHMARK_SMOKE.json` | 8,468 / `81d58223018d026d86b24fecb3f9377d4a73846a3119f73da9a06c851c03c964` / UNCHANGED |
| `docs/research/hestia-asset-compiler-spike-2026-10-02/C8_TESTS.json` | 996 / `f7b5c79c81d335ea2dc36c83399ae6f0c9d1619a743873f65b684f2b9e5776c7` / fresh foundation; actual log hash linked within |
| `docs/research/hestia-asset-compiler-spike-2026-10-02/C8_TESTS.log` | 30,928 / `66d181b18fc5ec944e2b28f989bf7b538f96a26371b578e36ea23aba975972a4` / actual native test names/results, redacted invocation paths |
| `C8_GOLDEN_RAW.json` | 2,370,658 / `49aa818ac90c1fa157fcf0e2e63015d9d7ad36bdc4c3316117bcbb9e26b7139f` / actual full repeat summary/unchanged case records |
| `C8_DETERMINISM.json` | 62,020 / `4dfa31a6891cb46548eb44992d872e675bb8ec94733f981db84cdb4069eb8ede` / native completed phase/repeats/source tree/401 file inventory/cleanup; pending field is historical PRE-COMMIT capture |
| `C8_BENCHMARK.json` | 11,343 / `70bf1eff5020c856af12a2c8b7bbc05a02060417aa1926ac0d0034de8e089cca` / actual current Small phases/counts/env and actual Medium/Large exclusions |
| `REVIEW.md`, `INTEGRATION_HANDOFF.md`, `REPORT.md`, current own contract/plan/corpus/benchmark/format/register | Current C8 scope, fault evidence, all scoped endreviews closed, META acceptance with notes, support and future-only handoff |

## Benchmark and GWN boundaries

After correctness/full corpus, exactly ONE real1008-input AND expanded-triangle Small run/profile,84 genuine mesh copies/672actual vertices. Unchanged preflight/caps enforced; no validation bypass/population inflation. Medium25k–50k/Large100k–250k are NOT_RUN_BUDGET_EXCLUDED before builder/core under20k expanded limit. CPU exclusivity unproven: ALL durations CONTAMINATED_DIAGNOSTIC, memory UNSUPPORTED. Inclusive/nested/combined/partial scope is explicit, never fake zero for unavailable phase. C7 timing artifact unchanged, not reused as fresh C8 data or valid performance comparison. Exact phase table in BENCHMARK, raw values in C8_BENCHMARK.

| Current diagnostic | micro | standard |
| --- | ---: | ---: |
| Wall ms / CPU ms | 10474.151 / 10093.750 | 5267.0417 / 5062.500 |
| Actual owned cells / bricks / total bytes | 18,144 / 504 / 2,407,633 | 5,376 / 420 / 2,036,443 |
| Combined work / unchanged limit | 9,424,296 / 10,000,000 | 4,237,128 / 10,000,000 |

EnvironmentPython3.12.13/win32/10.0.26200/AMD64; sourceGLB/report69,796/23,648bytes. Exact reference O(n²) topology work remains bounded by per-Part2000/aggregate2M pairs; no general-scale capacity claim. Measured phases include nested SAT/fill/geometry/hash verification; fixture generation/file I/O/research publication excluded from in-memory total.

GWN_NO_ADOPTION is REASONED_NOT_IMPLEMENTED: signed winding 2 in equal-outward cavity conflicts with accepted even/odd Air and offers no validated thin/topology authority replacement. No GWN experiment or timing/candidate numbers, tensor dependency, unsupported rotated-fill adoption or algorithm-version change.

## Limits, cleanup and next authorization

Real Blender E2E: **NOT RUN — EXECUTION_ROOT_BLOCKER**; only confirmed executable `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` is outside permitted root, never executed, staged or installed. Actual exporter/GLB parity/version pin and ordinary quaternion/TRS interoperability remain unresolved; host tests do not close them. General rotations, tube/rod and multilayer usable proof, volume selectors, physical density/kg/inertia and material-registry adoption are not fabricated.

Own pre-review diff/document/helper/lease/artifact/cleanup checks PASS, preserved in the immutable evidence. Final authorized closure changes textual acceptance boundaries only; source/versions/caps/preimages/pins and raw C7/C8 bytes remain identical. EXACT15 research paths (six modified/nine new docs/evidence/helper files) are the authorized staging set. Fresh closure diff/staged allowlist/whitespace/checksums precede commit; actual SHA/sole parent/files/clean tracked-index result is reported externally afterward. Entire baseline diff stays within the two leased roots. No verification resweep or push.

All managed/native runs finished; only invocation-owned cache/corpus/benchmark generations were removed. Fresh owned TEMP is empty, parent retained; no compiler/Blender .pyc. Accepted foreign untracked `.opencode/throughput.jsonl` and `.opencode/throughput.md` stay untouched. No UI/browser/screenshot proof needed or claimed.

Publication NOTE: C8_TESTS.log is ignored by existing `.gitignore:8` (`*.log`). Authorized closeout includes exactly that unchanged owned log via literal scoped force-add, preserving ignore rules and both foreign `.opencode` files. No evidence rename/content/hash change to evade ignore rules.

Git's `text=auto` would normalize this log's captured mixed CRLF/LF bytes. After its literal force-add, stage only this path's original no-filter blob with `hash-object -w --no-filters` and literal `update-index --cacheinfo`; verify staged SHA/bytes against the unchanged capture before commit. Staged whitespace check uses command-local `core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol`, recognizing native CRLF terminators while retaining the default whitespace checks. No attributes, configuration or raw evidence edits.

The next slice in INTEGRATION_HANDOFF is a PROPOSAL: one trusted static authored asset → verified original-source package → explicit READ-ONLY adapter → render projection, under a separate trust/profile/registry/frame/loader spec. No Destruction/Cut/Save/Physics/runtime/HVP/A+B integration now. Known upstream joint/ancestor/export-membership/evaluated-vs-GLB/version/default-TRS gaps remain read-only proposals, not silent fixes.

EXTERNAL closure: all three endreviews SCOPEDPASS_WITH_NOTES/no open findings; META accepts SPIKE_ACCEPTED_WITH_NOTES and authorizes the exact final commit. META also relays fresh fetch origin--prune Exit0, EXPECTED_PUSH_REMOTE=True (GitHub BenjaminHornung/WeltraumSpiel), origin/main still25bc7f5..., exact branch/HEAD and baseline diffcheck0. These are META operations, not this writer's fetch/push. Writer performs bounded documentation closure/stages only15 literal paths/commits once, then STOPS. Actual SHA is recorded after commit; META independently validates and owns subsequent non-force dedicated push with fresh identity/base checks. No amend/merge/PR/push/bundle/archive here. Residual Blender/symlink/unsupported-proof/contaminated-performance/UNKNOWN-IO notes remain, PRODUCT_INTEGRATED=NO.
