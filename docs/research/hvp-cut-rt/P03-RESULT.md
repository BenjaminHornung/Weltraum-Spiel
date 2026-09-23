# P03 — bounded binary body-cut output

## Scope and source binding

Implement the supplied seven-buffer V2 transport without changing body products, material/source identity, collision, save format or native admission. Algorithm1 keeps the existing JSON output; algorithm2 is supported but not selected by the live compiler until P05. Work is direct and serial in the existing task-owned worktree; no agents, Plannotator, commit, publication or configuration changes.

P02 full regression completed first:201 files/2134 tests PASS, Exit0. The source now includes the verified P00/P01/P02 overlay on HEAD `9341fb906383515057e659a99e16a381632f2bea`. The Owner's P00-D worker-diagnostic deferral remains unrelated and unchanged.

Current raw anchors (paths relative to `apps/weltraum-browser`):

- `src/workers/hvpBodyCutJob.ts`: `a4117d4bc7b328f6108797b842f7bf94a5c8232b`, current126-line V1 producer/decoder.
- Protected `protocol.ts`: `27ca3f57c5e3fb931c27635e5e55ca4c8cb9cecb`; generic bundle validation252–284 checks ownership, native buffers, aliases and view ranges; result hash/algorithm binding remains at the existing gate.
- Protected `resultGate.ts`: `fd3a1f6c0775c5a7b9d51c376ce525a397c81f37`; algorithm mismatch57, actual content hash63–66.
- Protected `workerPool.ts`: `48043f10e9c503d4af868aa577ac5e1dc1b586d2`, `streamingWorker.ts`: `55890438a6edc266c24735d3eea1e3aab1252c0a`, `terrainProducts.ts`: `938f291d4df270fd87392f970559a27e0fe4f111`.
- Protected `physics/bodyCutPlan.ts`: `3a11d66e1a2b7e213be05da69ff48cf87758ef84`, `presentation/terrainFragment.ts`: `40d51d6b7ec38a9813fdda0a01d7e626a9732d08` under `src/hestia-prototype`.

Only the existing job module, new `src/workers/hvpBodyCutWire.ts`, new `tests/unit/hvpBodyCutWire.test.ts` and this document may change. Existing tests, global pool/protocol, support jobs, native owner, compiler activation and all caps remain protected.

## Frozen layout and reuse decisions

1. Exactly seven distinct full fixed-length ArrayBuffers in the specified order: metadata/Uint8, cells/Int32, positions/Float32, normals/Float32, colors/Float32, indices/Uint32, ranges/Uint32. Metadata is at most65536 bytes; total remains8MiB. Reject shared/resizable/aliased/detached or partial/mistyped views. Use native ArrayBuffer accessors to avoid treating caller-shadowed length/resizable properties as ownership proof.
2. The header has exactly wire,binding,removedCells,removedMassKg,parts. Each part has exactly the supplied18 fields; center has x,y,z. Binding is compared with the unchanged complete `identity(payload)` tuple. Offsets are in cells/vertices/index-elements/range-triples, with checked safe arithmetic and gapless exact coverage. Indices and material ranges remain part-local. Empty parts are legal only with the existing complete-removal receipt semantics.
3. The wire reader first validates envelope/layout/header/all prefix spans before reconstructing cell/range records. It may borrow typed views internally; only the public job decoder publishes products, with separate full owned mesh arrays and copied/frozen cell records. No WeakMap or validation cache. All later calls revalidate current transport bytes/semantics.
4. Reuse the existing job decoder's complete semantic block once for both wire forms; do not duplicate or remove its checks. Its raw numeric-sequence checks admit the specific typed V2 channels as well as parsed V1 arrays. Preserve exact owner order, digest validation, duplicate/removed-cell rules, mass/COM tolerances, source-brick bytes, finite/axis-normal/color/index checks, face/range coverage, Float32-rounded bounds and mass partition. Preserve Uint16 output at at most65535 vertices, Uint32 otherwise. Do not introduce a stricter positive-part-mass rule in place of the existing finite-plus-tolerance check.
5. The encoder computes all counts/prefixes and serialized metadata before allocating aggregate numeric buffers, validates limits, then copies into one buffer per channel. No large numeric `Array.from`/JSON path in V2. Keep the one8MiB constant shared and re-exported at the existing job API when integrating; do not create divergent caps. Existing V1 encoding stays unchanged in behavior.
6. Producer retains source-derived meshes while aggregating and self-decoding; these are real copies, not zero-cost transfer. Record the bounded buffer peak and replaced V1 numeric/JSON allocations explicitly before acceptance. No borrowing unproven prepare-reserve slack, retained cache or activation outside P05.

## Sequence and verification

- **A:** closed header/types, safe spans and read-only layout reader, then focused layout/bounds/ownership tests. No producer activation.
- **B:** encoder with actual preallocation admission and hand-small/full-removal fixtures; tests prove contiguous prefixes and local indices.
- **C:** shared semantic decoder, genuine V1/V2 box/sphere/mixed/negative-coordinate equivalence, fresh-hash tamper cases, and output ownership after input mutation.
- **D:** accept only request algorithms1/2, select matching output and self-validate, preserve existing result gate and legacy callers. Exercise actual jobs and real structured-clone pool transport in the new test file; no fake native stage.

Use the existing `workerPoolLifecycle.test.ts` RuntimeTransport/real job fixture pattern and `hvp-moving-session.test.ts` real native regression, without importing test modules or editing them. BW01–BW13 include overflow/gaps/aliases/shared/resize,65,537-byte metadata/8MiB+1 payload, invalid geometry/cells/mass/source counts and mismatched result algorithm. Tamper helpers recompute transport hashes to reach semantic checks. Existing V1 tests remain mandatory.

Each slice receives direct self-review and fresh focused checks; final package verification includes TypeScript, build and full unit regression. A separate quiet comparison reports actual encoded size and worker transport cost only; no end-to-end or native performance claim. Independent/human review is NOT RUN under the current execution rule. Stop on changed semantic products, weakened validation or unaccounted ownership/peak instead of adjusting expected results.

## Status

- [x] Current producer/decoder/callers, generic transport, result gate and adjacent fixtures inspected; layout/reuse decisions self-reviewed.
- [x] A: bounded layout and ownership checks.
- [x] B: admitted encoder.
- [x] C: shared semantic decoder and adversarial parity.
- [x] D: dual job path and unchanged live activation; focused/native regressions and build pass.
- [x] Quiet actual-source/browser-worker cost comparison completed; size target passes, round-trip target fails.
- [x] Complete package regression:202 files/2191 tests PASS, zero skipped, Exit0 (`p03-full-unit-self-verified.json`).

## Implementation and fresh focused evidence

The final job is152 lines and the new wire module207 lines. V1 retains its original per-part numeric-array/JSON conversion lifetime; V2 computes source-derived meshes, rejects an impossible over-cap retained mesh set, checks complete wire totals before allocating aggregate channels, and self-decodes through the same semantic block. No global pool/protocol, compiler, native, persistence or old test file changed.

Live typed-buffer bounds are explicit: accepted V2 raw mesh buffers at most8MiB, output packet at most8MiB, and decoded owned mesh buffers no larger than that packet, hence a conservative24MiB coexistence bound for these buffers. Source/input data, bounded cell/range records and metadata remain additional existing/declared costs; this is not a full JavaScript-heap or immediate-GC measurement. A rejected next mesh can temporarily coexist with the previously admitted8MiB set and the existing mesher's10,752,000-byte single-mesh maximum before rejection; no aggregate buffers or further parts are created afterward. No unproven prepare-reserve discount is taken.

Genuine staged failures are retained: missing module; missing V2 decoder; unsupported algorithm2. The first D report named `p03d-dual-green.json` actually failed one of50 checks because two complete real Sphere pipelines exceeded the new test's default5s harness timeout. It is not reported as a pass or removed. The identical two new expensive Sphere cases now have a bounded30s harness allowance, consistent with the existing120s native cases; no old test, assertion, product limit or latency gate changed.

After the final boundary/tamper additions, direct self-review and fresh checks passed: `p03-focused-self-verified.json`,57 new wire/job tests +31 existing pool tests +4 existing native moving-session tests =92/92, zero skipped, Exit0. TypeScript, diff-check and production build PASS (269 modules; existing large-chunk warning). Exact65536-byte metadata/8MiB packets, detached empty channels, local indices at both owned index widths, absolute mass/COM tolerances and actual seven-buffer structured-clone transfer are covered. Decoder-only synthetic layout/width fixtures are not presented as native source proofs.

Candidate raw hashes: job `121b7707e11a93a24ed60b33684fac98e27a1e50`; wire `cf0b908734de89284f39d0366a4cd4143078c370`; new test `7475078242981d13942318c94bbd710a9e01c8dc`. Protected source hashes above were rechecked unchanged. Independent/human review remains NOT RUN.

## Predeclared cost comparison

The external-only Vite benchmark imports the actual job, gate and consumer decoder, using two real browser Workers with only one active job at a time. It is not the complete WorkerPool scheduler or a native World. Fixed fixture:4096 cells in16x16x16, density512, Box cell[8,8,8]/edge4 removing64 cells. One first pair, two excluded warmup pairs and seven measured pairs alternate order, without cached end products, retries or successful-only selection. Source/fixture construction and full metadata/cell/exact-mesh-byte SHA-256 comparisons occur outside timing. Whole worker-job time, native round trip, main gate/decode time and encoded bytes remain separate.

`p03-body-worker-browser-20260922-01.json` retains all20 attempts, browser metadata and source hashes. All jobs passed the unchanged result gate and complete output fingerprint comparison (`fa2dfe7d3701ef472c5eb4558afb2a8c6dcbf9a54b99555922dfbacd63c210e3`); sender input buffers were detached. The report's `status: passed` refers to these run/parity checks, not the performance targets.

| Warm median / fixed packet size | V1 JSON | V2 binary | Interpretation |
|---|---:|---:|---|
| Output bytes, including metadata | 171000 | 75270 | 56.0% smaller; at least30% target PASS |
| Worker job | 18341.0ms | 17882.2ms | Full source/plan/mesh/codec/self-validation job, not isolated codec |
| Worker round trip | 18341.7ms | 17882.8ms | Ratio0.975; at most0.5 target FAIL |
| Main gate and owned decode | 3.7ms | 3.2ms | Separate from the worker job |
| Round trip through owned decode | 18344.0ms | 17886.2ms | Not Input-to-Applied or a native World operation |

This dense fixture's overall job cost remains almost unchanged; no50% runtime reduction or end-to-end performance acceptance is claimed. No validation was removed and no faster fixture substituted. The proposed diagnostic speed target is not a functional rejection or permission to expand this package into source/World refactoring.

The local benchmark build used the pinned Vite toolchain and actual source imports (79 modules). Raw bundle hashes: main `9eafe919dd9d76c09c237dd8b421f99ea06ed860`, worker `fea55a8325479b9333e4f87ac8372bae85c72ad9`. Windows Chrome153,16 reported hardware threads,1536x791,DPR1.25; no concurrent own heavy job during measurement. No console errors/warnings. The owned tab and managed preview were closed, port5182 has no listener, and raw captures remain local. The separate complete unit regression passed202 files/2191 tests, zero skipped, Exit0 in1042.95s (`p03-full-unit-self-verified.json`). No source/test files changed during that run; P04 test preparation began only afterward. The diagnostic runtime target above remains failed despite this functional pass.
