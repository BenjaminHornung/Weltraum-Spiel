# Hestia Cut RT V3 — intermediate checkpoint, 2026-10-02

This is a planning/publication checkpoint, **not V3 acceptance**. The feature branch is
`feature/hvp-cut-rt-v3-completion-2026-09-23`, based on `f2ee73cf`.
It includes the earlier uncommitted V3 work and the subsequent bounded source/mesh slices.

## Contract that remains unchanged

- One native Rapier World owner; 0.125 m quantum; exact colliders, source/save formats,
  hashes, IDs, public errors, and generic getter/proxy/species semantics.
- CPU 268435456 B; mesh 134217728 B; 500000 triangles; 300 draws.
- Preparation allowance 96 MiB; output 8 MiB; two heavy jobs; queue 32;
  total optional diagnostic reserve 512 KiB.
- Maximum contiguous work 8 ms, slice p95 4 ms; real Input→Applied/Render p95 250 ms;
  true body World-Hold p95 50 ms; no preparation-induced timer gaps above 20 ms.
- No automatic Resume, timeout relaxation, quality fallback, foreign proof adoption,
  new public payload restrictions, or global shallow-freeze/canonicalization shortcut.
- B1 Body before B2 Terrain before B3 access. Matching a hash never issues native authority.

## Implemented at this checkpoint

- First-party Physics-owner plan preparation runs before the native hold, with terminal
  cancellation/disposal and bounded optional diagnostics. Existing generic factories keep
  their original canonical hash route; the owner-only route uses the private incremental hash.
- Owner-generated child-cell projection uses 16-cell batches, preserving generic `.map`.
- The owned hit route reuses the existing **object** mass from the genuine parent recipe,
  checked against the identical issued source, revision, hash, occupancy and 32768-cell limit.
  Generic/no-context planning still derives mass; native pose and velocities are sampled at Stage.
- `hvpCoastMesher.ts` has one shared synchronous/bounded geometry algorithm. The new
  cursor is direct-module/internal, not exported by the HVP barrel. Generic callback/error
  order and mesh bytes have an independent pre-cursor historical oracle.
- `presentation/bodyMeshAdmission.ts` reconstructs and compares expected geometry from
  retained owner-local cells/recipe, never from returned worker cells. Missing/cavity/duplicate
  faces, winding, degeneration, AO/diagonal, material and signed-zero mutations are tested.
  **This verifier and the mesh-only protocol are not wired into production.**
- Moving render staging preflights numeric mesh/source coexistence before key registration,
  grouping, foliage and artifact snapshots. Existing foliage topology supplies its exact buffer
  counts. The post-preparation ledger check remains. This is a modeled admission, not heap proof.
- Earlier V3 ephemeral-representation/lifecycle, cut diagnostics and K34 test work is included.
  It must not be confused with fresh full K34/browser acceptance.

## Fresh verification and limits

| Check | Result |
| --- | --- |
| Mesher/wire/coast/R2/residency/AO regression group | PASS, 170/170 |
| Independent historical geometry/getter/error oracle plus owned admission/cancellation | PASS, 28/28 (overlaps the preceding group) |
| Parent mass, owner lifecycle/parity, current native pose, body Save, Worker restore/clock/opt-out | PASS, 73/73 across six files |
| Body presentation/K34 staging subset | Six existing cases PASS; new mesh-cap case PASS |
| Corrected CPU and mesh preallocation cases | PASS, 2/2; no grouping reads, foliage/artifacts or keys on rejection |
| TypeScript and production Vite build | PASS; existing large-chunk warning retained |
| Scoped diff whitespace checks | PASS |
| Full unit suite, current browser flow, formal p95/cap/peak matrix, visual/Art acceptance | NOT RUN / NOT PROVEN |

The first preflight retest was 7/8: its CPU fixture rejected startup before creating the
consumer. The corrected test uses the unchanged default CPU cap and a controlled source-cost
estimate, not an allocated 256-MiB source or native proof. The two affected cases passed freshly.
No product cap/deadline was raised. Independent read-only review found no confirmed defect in
parent-mass reuse; parent review caught and corrected an early-preflight cap bypass.

Source-bound Node 22.23.2 probes are **not** browser or acceptance benchmarks:

- Exact authored384→child352 source/hash parity passed. Controlled same-bundle AB/BA
  (one cold pair plus five warm pairs) reduced parentMass median from **50.3549 ms to
  0.0199 ms**. Whole medians were **1153.2002 ms vs 1228.2705 ms**, with paired median gain
  only **6.8440 ms**. No reliable whole-flow improvement is claimed.
- A separate before/candidate probe likewise proved phase/parity, not end-to-end gain.
- The legal 32768-cell mesher diagnostic took synchronous median 22.0027 ms before slicing.
  The bounded Node cursor's observed maximum was 2.2673 ms; no real task waits, Chrome/GC
  maxima, formal p95 or coexistence peaks were proved.
- Isolated transition composite-freeze profiling did not justify a payload rewrite. It stopped
  without a product patch; canonical/validated leaf construction remains expensive.

Raw reports/probe bundles are retained locally outside the repository. Older September profile
and browser artifacts were missing after environment migration; they were not recreated or
represented as fresh. Historical normal-UI BodyBox384 ended Rejected/SimulationHold with no
native Stage, Applied or confirmed render. No fresh normal-player reproduction has superseded it.

## Next parallel planning cards — not permission to overlap writes

1. **B1 source kernels:** destruction, classification finalization, child ingest/materialization,
   transition payload and removed-material preparation still contain whole synchronous work.
   Attribute and bound the real kernel before changing it; preserve generic validation/error order.
2. **Owner-first mesh-only flow:** finish one owner-local plan, export bounded child mesh inputs,
   compile meshes only, and admit exact cells/geometry against the retained plan. Return admitted
   render buffers before hidden staging so transfers cannot detach already-staged arrays.
   Retain the original hit and stage at current pose; do not adopt a compiler-native proof.
3. **Memory gate:** existing pool queue/concurrency limits are not aggregate byte reservations.
   Reuse `admitScene`/`estimateHvpStageCpuBytes` with transaction-local ownership and terminal
   settlement. Account for seven-channel input/output, three decoder lifetimes, one expected child,
   sort/maps/arrays, old/new source and render snapshots, GC, and uncertain cleanup ownership.
   Actual 96-MiB coexistence is still unproved; GPU/native unsupported values are not zero.
4. Bind incarnation/ticket and monotone snapshot sequence independently of request ID; test
   stale/late replies, cancellation, thrown yields, Restore, publication failure and zero children.
5. Only after the gates are defensible, activate and rerun normal-player BodyBox384 with
   Applied/native/render binding. Separate input latency, slices, timer gaps and true hold;
   then run the seven-variant Cold/Warm p95 and cap/visual matrix. Proceed to B2/B3 serially.

All source writers are paused at this checkpoint. Agent/provider configuration, local
`.opencode`, `.playwright-mcp` captures, generated build output and external profiler artifacts
are excluded from publication. No deployment, release, schema change or final human review occurred.
