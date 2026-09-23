# P02 — edit-wise, byte-identical materialization

## Goal and current source

Replace only channel construction in `materializeAdaptiveBrick`: initialize from the same validated constant sample, visit relevant edits in the same canonical journal order, and rasterize safe Box intersections. Sphere geometry, unsafe-difference fallback, application semantics, validation, complete output, hashes and provenance stay unchanged. No new public API, dependency, cache or trusted-input bypass.

This is direct serial work in the existing task-owned worktree. No agents, independent/human review, Plannotator, commit or publication. P01's complete regression finished before P02 edits:200 files/1924 tests PASS, actual Exit0. The Owner's new-worker-span deferral remains NOT_MEASURED and is unrelated to this pure-core optimization.

Bound source before P02:

- `src/voxel/adaptive/materialization.ts`: raw `22f02783af0cc388d2d00c79ce3472da29c6abd8`; channel block255–289, existing conservative brick prefilter246–254. Preserve the prefilter and its existing exact predicates rather than remove the earlier accepted work.
- `coordinates.ts`: `ef71e270296aa2a4d7ffa1ca7345025e4f026294`; level cell size `2 ** (4 - level)`,16 cells per axis, aligned safe-integer ancestry/bounds. `validateQuantumBounds` rejects `min >= max` on every axis; degenerate boxes remain rejected, never inflated.
- `edits.ts`: `33b2b1c0645a1b52927168d888de58e09ff4a5cf`; at most4096 records, canonical contiguous sequence/revisions, shape/optional-field rules and full journal digest remain unchanged.
- `validation.ts`: `54f39f44b0256fc37c7b97a66fd06dbaa2bd74d6`; no edits.

Actual runtime callers are `hestia-prototype/terrain/structuralIngest.ts:57` and `provingGround/pgTragwerkPlayerSlice.ts:136`. Ingest groups exact cells into at most4096 AddBox X-runs and level4 bricks, then obtains public proofs and structural authority. The channel optimization must not omit any record from that authoritative journal or bypass downstream validation.

## Mathematical self-review before write

For cell index `i`, edge `s > 0`, origin `o`, and valid half-open Box `[a,b)`, the existing predicate is `o+i*s < b && o+(i+1)*s > a`. Thus the first possible integer index is `floor((a-o)/s)` and the exclusive upper bound is `ceil((b-o)/s)`. Clip to `[0,16)`; an empty intersection executes no writes. Mathematical floor is required for negative differences; bit shifts/truncation are not substitutes.

Compute local differences only for the fast decision when every difference is a safe integer. Division by the existing positive power-of-two cell sizes is exact for these values. If any difference is unsafe, keep the original full-cell footprint predicate. In particular, a box spanning from `-2^52` to a brick at `+2^52` still overlaps but has an unsafe local minimum; the fallback must be exercised, not accidentally skipped by a far-away prefilter fixture.

Reordering from cell-then-edit to edit-then-cell is valid because edits modify only the selected cell's private sample. Each cell still sees its applicable edits in unchanged journal order. Subtract retains material/semantic fields, Add only overwrites fields actually supplied, and SetMaterial also affects air. Every output numeric channel receives the existing finite check and the complete freeze/hash/provenance tail is unchanged. The private footprint is synchronously consumed and not retained.

Sphere fallback is the existing exact integer squared-distance test against a half-open footprint, including its exclusive-positive-face tangent rule. It is not the HVP cell-center sphere. No sphere fast path or floating-point squared-distance approximation is authorized.

## Steps and independent test oracle

1. **P02-A (test only):** retain the old cells-times-edits algorithm in the new `tests/unit/hvpAdaptiveEditRaster.test.ts`. Its reference must not call the optimized channel loop. Use the original footprint geometry; test-side BigInt may independently express the same exact squared-distance comparison, with identical half-open tangent handling. Pin the old metadata construction with existing validated canonical APIs, not values copied from the candidate output.
2. Before product changes, verify200 deterministic mixed journal patterns at all five levels, including negative aligned origins. Compare all four channels and complete serialized results; validate and freeze the actual output. Explicit cases cover edit order/field retention, air material, clipping, an external edit changing provenance only, safe-integer fallback, excluded/included sphere tangency, degenerate bounds and existing adversarial validation. Semantic baseline tests may already be green; no artificial Red or new Golden promotion.
3. **P02-B:** change only the existing channel block in `materialization.ts`. Reuse existing `applyEdit`, `appliesToFootprint`, prefilter and private scratch pattern. Keep the full journal metadata/tail untouched. Inspect the focused diff and rerun exact oracles plus existing Level3/4 SHA-256 goldens.
4. **P02-C:** fresh type/build/full package tests and quiet, separately reported raw comparisons for thin X-runs, dense mixed coverage and non-overlapping edits. Report channel-only versus full validation/hash costs honestly; the research537/1.3ms figures are not product measurements or a subtraction from historical support time. No CI wallclock thresholds or unrelated optimization.

Only product path `src/voxel/adaptive/materialization.ts`, new unit file and this result document are in scope. Other P00/P01 changes and all existing Goldens remain protected. Stop on semantic drift, unsafe ownership, changed validation or unexplained peak; do not repair expected values.

## Status

- [x] Current source/callers/validation inspected; Box bounds and fallback proof self-reviewed.
- [x] P01 full regression finished; P02 test-only baseline:224/224 PASS, Exit0 (`p02a-reference-baseline.json`).
- [x] P02 narrow channel implementation and fresh semantic/golden verification:224/224 PASS, Exit0 (`p02b-raster-green.json`).
- [x] P02 self-review, TypeScript, production build and bounded cost comparison.
- [x] Fresh complete package regression (`p02-full-unit-self-verified.json`):201 files/2134 tests PASS, Exit0.

## Implemented candidate

Only the channel block changed relative to the bound P02 predecessor. Four fixed4096-entry arrays now start with the same validated base values; one private sample is loaded/applied/written at each affected cell. Safe Box bounds use clipped floor/ceil ranges. Spheres and unsafe local differences still use the unchanged exact predicate. The inherited brick prefilter and full journal/hash/provenance/freeze tail were not altered.

Self-review checked that each cell retains canonical edit order and complete fields, fast bounds cannot index outside the brick, both minimum and maximum differences are guarded, and no scratch escapes the synchronous operation. Extra working state is bounded per invocation/per edit: one sample and up to four three-number bound arrays, not a retained cache or a new per-cell object graph. The four output channel lengths and existing resource contracts are unchanged; this is not a measured JS-heap claim.

Candidate raw blobs: materialization `2cb17886fc72a557e587958e93bbe443f962f6f1`, new reference test `85f4ff9198cdcccef7e4f05402d78038094bd03f`. P01 canonical remains `daa39024f8474a64d2a0658bb9678aefb57cdbeb`; coordinates/edits/validation hashes above and existing materialization test `b13a738ce79fa069e381ed9b7bc07d02eba76991` are unchanged. TypeScript/diff-check PASS. Production build PASS,268 modules, existing large-chunk warning. No independent/human review was run.

## Cost evidence

`p02-materialization-browser-20260922-0920.json` contains all predeclared runs from a quiet owned Chrome153 page: one first pair per fixture, two explicitly excluded warm-up pairs, then nine alternately ordered pairs. Complete serialized outputs matched before measuring repeated pairs; every recorded hash, including warm-ups, matched. No retries or sample filtering. First-pair data is retained even where the candidate was slower (dense mixed case).

The temporary Vite builds use the actual before/after source with the same two injected clocks only in their external benchmark copies, from the existing prefilter/channel boundary to the original freeze boundary. No timing hook entered product source. Bundle blobs are `8c42d2ce7b1a6c9945396f52dc96d0710c6983c0` and `d815301a12c94e559644d6af1f604e15c5f1e090`. The remainder includes input validation, hashing, freeze and small harness overhead; it is not falsely labelled pure hash time.

| Fixture | Before/after channel median | Before/after full materialization median | Channel ratio |
|---|---|---|---|
|512 X-runs,4 bricks,16384 cells|411.1 /2.3ms|615.6 /202.4ms|0.0056|
|15 dense mixed edits,1 brick|19.6 /14.0ms|42.1 /33.8ms|0.7143|
|512 external edits,1 brick|0.3 /0.3ms|33.6 /34.9ms|1.0|

The proposed thin-channel and dense-regression diagnostic targets are met. Remaining thin-fixture work is about200ms; no whole-Ingest/Cut/p95/250ms claim follows. External-edit total time did not improve and is reported unchanged/slightly higher, not hidden. These instrumented pure-core comparisons are not native gameplay or a formal hardware acceptance.

Only a task-owned loopback benchmark server/tab was used, now stopped/closed; port5181 is free and the original blank tab remains. The sole browser console error was a missing optional favicon404. Temporary builds warned about the deliberately shared external output/root; fixed before/after filenames and `emptyOutDir:false` preserved all sources/artifacts. No runtime configuration, source schema, cap, publication or other worktree changed.

The fresh full unit regression completed on this frozen source/test candidate as managed process `bg_mucgyx1s_l`:201 files/2134 tests PASS,0 skipped, actual Exit0,1017.58s. P03 source/test work starts only after that completed baseline. No independent/human review was run.
