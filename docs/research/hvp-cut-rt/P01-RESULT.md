# P01 — byte-identical Adaptive FNV-1a 64-bit

## Goal and scope

Replace only the Adaptive BigInt-per-byte hash loop with the specified two-uint32 kernel. Preserve canonical validation, UTF-8 input, serialization, all `fnv1a64-v1:` values and existing materialization/save goldens. No cache, normalization, format/version change, dependency or neighboring refactor.

Execution is direct and serial in the existing task-owned `feature/hvp-cut-rt-p00` worktree. HEAD remains `9341fb906383515057e659a99e16a381632f2bea` plus the explicitly recorded uncommitted P00 overlay. There is no second writer, new agent session, Plannotator gate, commit or publication. Self-review and fresh verification replace the superseded delegation workflow; independent/human review is NOT RUN.

The Owner authorized proceeding after C2B while new P00-D worker spans remain NOT_MEASURED. C2B has106 focused passes and three unchanged production E2E passes; the full P00 baseline regression must finish before these source/test files change. Additional P00 rock-arm MCP traces remain blocked before any cut by browser Pointer Lock denial, not silently accepted.

## Source anchors before implementation

- `apps/weltraum-browser/src/voxel/adaptive/canonical.ts`: raw blob `1f20e446ccd3e6fc2c5daaeb4438a05035e3fcf0`; `hashAdaptiveCanonical` at96–104. Change only import and byte-loop delegation.
- `apps/weltraum-browser/src/presentation/canonical.ts`: raw blob `54720c15972daeccfa1b8bc781deb2933da4c4b4`; existing `Fnv1a64Writer` at5–27 supplies the mature arithmetic pattern. Its streaming framing and prefix differ; leave this file unchanged.
- `apps/weltraum-browser/tests/unit/adaptiveMicrovoxelMaterialization.test.ts`: raw blob `b13a738ce79fa069e381ed9b7bc07d02eba76991`; existing complete Level3/4 SHA-256 goldens stay unchanged.

## Steps and checks

1. **P01-A:** add only `src/core/fnv1a64.ts` and `tests/unit/hvpAdaptiveFnv64.test.ts`. First capture the genuine missing-helper failure, then verify the kernel against an independent BigInt oracle: three fixed vectors,1200 deterministic random buffers, all bytes, an unaligned view, long0xff input, UTF-8 and input immutability. FNV prime is `2^40 + 435`; the low-product carry is exact below `2^53`. No speculative hash-state abstraction.
2. **P01-B:** replace only the Adaptive byte loop with the tested helper. Keep `canonicalAdaptiveJson`, `TextEncoder`, validation/error behavior, negative-zero handling and prefix unchanged. Verify invalid values/accessors/sparse arrays/surrogates, mutable-input freshness, existing Adaptive/Structural tests and unchanged complete materialization goldens.
3. Inspect the exact four-file P01 diff and protected-file hashes; run fresh focused checks, TypeScript, build and package regression. Benchmark identical bytes with actual candidate arithmetic and BigInt in the same quiet browser, reporting cold/warm raw timings separately. The relative kernel target is at most50% of baseline median, not a CI wallclock test or an end-to-end latency claim.

All commands use the already pinned local Node/TypeScript/Vitest binaries from `apps/weltraum-browser`; raw reports go to the existing external evidence root. Stop on any semantic/golden difference or source drift rather than adjusting expected output. No new runtime or performance result is claimed until executed.

## Status

- [x] P00 full baseline finished:199 files/1903 tests PASS, Exit0 (`p00-full-unit-self-verified.json`); source/test edits may begin.
- [x] P01-A: genuine missing-helper failure captured; then21 tests PASS, including1200 deterministic BigInt comparisons and unchanged public validation checks (`p01a-missing-helper-red.json`, `p01a-kernel-green.json`).
- [x] P01-B narrow integration and canonical/golden regression: five files/83 tests PASS; existing Level3/4 complete materialization SHA-256 values unchanged (`p01b-adaptive-green.json`).
- [x] Self-review, TypeScript, production build and bounded browser-kernel comparison.
- [x] Fresh complete package unit regression:200 files/1924 tests PASS, Exit0 (`p01-full-unit-self-verified.json`).

## Implemented candidate and verification

Product delta is the13-line stateless byte helper plus one import and replacement of the six-line Adaptive byte loop. The existing presentation implementation, canonicalizer, validation, serialized framing/prefix, materialization and old tests are untouched by P01. Mutable caller objects are rehashed, not cached. New runtime state is two numeric limbs and bounded temporary/result strings; there is no new retained collection or payload clone.

Self-review checked the prime decomposition, unsigned carry/wrap and unchanged owning validation boundary. Protected presentation and materialization-test raw hashes still match the anchors above. Candidate blobs: helper `eb1c04905f219a396d418e86a9e6b7f5929d4e9b`, Adaptive canonical `daa39024f8474a64d2a0658bb9678aefb57cdbeb`, new test `88947a67612b8a47b6c6b553e9e762042a62508b`. Independent/human review NOT RUN.

Fresh TypeScript noEmit/diff-check PASS; production TypeScript/Vite build PASS with268 modules and the existing large-chunk warning. The full unit suite finished on this frozen source/test candidate at2026-09-22T08:46:01.320Z:200 files/1924 tests PASS, no skipped tests,850.18s, actual Exit0. P01 is locally verified; combined later-package and formal P07 acceptance remain separate.

## Isolated kernel evidence

Local artifact `p01-kernel-browser-20260922-0827.json` contains the actual TypeScript-emitted ES2022 module, independent BigInt reference, source blobs, browser metadata and every measured pair. Measurement used an owned blank Chrome153 page without an application runtime or competing task-owned build/test workload:1MiB deterministic bytes, seed `0x17309a7`, one first-call pair, three explicitly excluded warm-up pairs, then31 predeclared alternately ordered pairs. Every result matched `858a455446e3d012`.

First calls: BigInt44.0ms, candidate9.9ms. Warm medians: BigInt34.9ms, candidate8.1ms, ratio0.2321; the relative kernel-only target of at most0.5 is met. This is not an ingestion, native-physics, frame-time or Input-to-Applied result. No p95/250ms or hardware/visual-owner acceptance is inferred. The owned tab was closed and the raw artifact moved to the authorized external evidence directory; the pre-existing blank tab was preserved.
