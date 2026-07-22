# Design: Browser Adaptive Microvoxel Authority V1

## Boundary and ownership

This is a renderer-neutral pure authority core reconstructed as the first
Continuation stage from source baseline
`4c1449e2bb0486fe59ee6b68da495c27abee21b5` to source head
`5fb372bdba677e43e71566121c53efb5e244b93a`; the exact restdiff is
`4c1449e2bb0486fe59ee6b68da495c27abee21b5..5fb372bdba677e43e71566121c53efb5e244b93a`, onto current Main
`f6d3fe69175b168ddea5e385c6d7b3452e6cba16` on
`feature/browser-structural-microvoxel-destruction-core-v1-continuation`.
Only the isolated Adaptive source, tests, fresh evidence, documentation, five
change artifacts, and the minimal current `package.json` E2E-group addition
are in scope. Old heads are not merge or tree-overlay inputs. Scenes, bootstrap,
UI, Three.js/Presentation, workers/streaming, persistence, gameplay, and the
Hestia Surface-Lab path remain outside the boundary.

Stable authority identity/content is separate from request, cache, telemetry,
renderer, worker, timing, and presentation metadata. Rejected or stale values
cannot be promoted by an adapter.

Surface-Lab-/Voxel-Authority und Adaptive-Microvoxel-Authority
sind getrennte Domänen.

Keine von beiden darf ohne späteren Adaptervertrag
gleichzeitig World-Truth publizieren.

The Adaptive core therefore has no runtime wiring, renderer authority, global
state, wall-clock input, randomness, or mutation path into an existing
Voxel-/Surface-Lab state owner.

## Coordinate and hierarchy contract

- `MICROVOXEL_BASE_QUANTUM_METERS` is exactly `0.125`.
- The only levels are integer `0, 1, 2, 3, 4`; level 0 is 2.000 m, level 1
  1.000 m, level 2 0.500 m, level 3 0.250 m, and level 4 0.125 m.
- Every brick is exactly `16^3` cells. At level `L`, cell size is
  `0.125 * 2^(4-L)` m, the brick extent is `16 * cellSizeMeters(L)`, and
  each origin component is an integer base-cell coordinate divisible by
  `16 * 2^(4-L)`.
- Parent/child lookup is the integer eight-child hierarchy. Negative values
  use mathematical floor division, never truncation toward zero. Regions are
  half-open integer ranges.
- Key validation is one centralized, reused invariant. A key is valid only if
  its own aligned origin and exclusive maximum are `Number.isSafeInteger`
  values and repeatedly deriving its parent through L0 yields aligned origins
  and safe exclusive maxima at every level. Coordinates, gameplay values,
  sphere intersection, and materialization geometry stay in bounded safe
  `number` arithmetic; `BigInt` is not a geometry fallback. Internal
  `BigInt` is permitted only inside the unchanged FNV-1a64/canonical hashing
  implementation. Invalid edge keys are rejected, never clamped, wrapped,
  normalized, or silently replaced. Ordinary negative aligned keys remain
  supported.

## Canonical stable IDs

Every published stable authority/body/frame/region/generator identity passes
canonical string validation at construction. Empty, untrimmed, oversized, and
unpaired high/low UTF-16 surrogate values fail with the established
identity-oriented `AdaptiveAuthorityError` before publication or hashing.
Canonical serialization is not the first validation boundary.

## Closed base-field descriptor

V1 has exactly one provider representation: an immutable discriminated
`AdaptiveBaseFieldDescriptor` of kind `constant-v1`, fixed schema version,
stable `identity`, stable `version`, `sourceRevision`, and one canonical sample.
The sample is fully validated: density is finite, occupancy is finite and in
`[0,1]`, and material/semantic IDs are canonical nullable IDs.

The adaptive core owns an exhaustive pure evaluator for the closed descriptor.
It accepts no function-valued sample, sampler, callback, dynamic code, registry
injection, mutable receiver, renderer value, or timing source. A future provider
requires a separate schema/spec decision and is not an extension point in V1.
The descriptor is deeply frozen before authority publication.

The descriptor's canonical digest is included in authority input, materialized
content, provenance, proof bindings, snapshot projection, and plan hashes. Any
descriptor-field change therefore changes all dependent authority bindings.

## Base authority and edit journal

The validated versioned descriptor is the sole authority for unedited samples.
Missing, unsupported, malformed, or non-finite base data fails closed; no air,
zero, default, cache, mesh, fallback, or prior product is implicit base data.

The edit journal is a validated immutable sequence. Records are applied exactly
once in declared order. Equal-order ambiguity, duplicate identity, invalid
range, unsupported operation/version, conflicting authority metadata, malformed
payload, or non-finite value rejects before materialization/publication. Append
returns a new snapshot and cannot rewrite an earlier journal. The full ordered
journal is provenance; no lossy compaction, record dropping, or reordering is
allowed. A named finite journal limit is checked before copying, sorting, or
materializing records. The implementation task must select and review the
constant; this Continuation document does not invent its numeric value.

## Materialization, canonical bytes, and provenance

Materialization consumes only stable identity, selected level, the closed
descriptor, and the validated journal. Equal canonical inputs produce identical
cell bytes/content hash/provenance regardless of request, cache, worker, browser,
camera, timing, or completion history. Canonical hashes use the existing
versioned deterministic FNV-1a64 V1 representation and lowercase encoding.

Canonical field/type order, numeric encoding, stable IDs, integer coordinates,
levels, aligned bounds, descriptor digest, journal records, materialized
channels, algorithm/schema versions, and required parent provenance are
explicit. Collection ordering uses one explicit code-unit comparator; it does
not call `localeCompare` or read host locale/ICU state. Unknown fields,
duplicate keys, unsupported versions, non-finite values, alternate numeric
spellings, implicit defaults, and precision loss fail closed. Timestamps,
random values, insertion order, request/worker/cache IDs, queue order,
camera/render state, telemetry, and derived presentation buffers are excluded.

## Authority context, snapshot projection, and opaque proof

The canonical authority context contains body, surface frame, region, generator
identity, the complete descriptor and descriptor digest, validated journal and
journal digest, source/edit/brick revisions, and planning epoch.

A snapshot constructor must validate and deep-freeze the context and snapshot
inputs, validate every ready brick/proof source against materialized content and
provenance, then calculate one canonical snapshot digest. Its projection
contains the authority context, planning epoch, normalized resident summaries
(`key`, readiness, costs, content/provenance hashes, and revisions), active
coverage, refinement requests, and budgets. Named finite limits for resident
summaries, active coverage, refinement requests, and aggregate planning work
are checked before copying, sorting, hashing, or enumeration. Exceeding a limit
fails closed with no partial projection or plan. Concrete numeric limits remain
an implementation/review decision and are not guessed here. Derived
proof/digest fields stay excluded so hashing is non-circular.

Only that validated constructor may issue an opaque, locally branded resident
validation proof. A proof binds the exact key, content hash, provenance hash,
descriptor digest, journal digest, source/edit/brick revisions, planning epoch,
and snapshot digest. Pending or absent residents carry no ready proof. A
structural object literal, relabelled proof, or old self-asserted receipt is not
a proof.

This is deterministic digest binding and **non-cryptographic local staleness
protection**, not authentication. It does not supply signatures, key management,
hostile-process protection, or cross-worker proof transport.

## Planner, fallback, budget, and coverage

The planner independently reconstructs the canonical snapshot projection and
recomputes its digest. Before using any resident for selected or fallback
coverage it verifies proof branding and every key/content/provenance/descriptor/
journal/revision/epoch/snapshot binding. Wrong-authority, wrong-key, stale,
forged, prior-journal/provider/revision/epoch/snapshot, missing, or malformed
proofs fail closed and invalidate planning; they are not silently downgraded to
pending, air, or a replan.

Accepted plans and typed budget rejections include the verified snapshot digest
in canonical plan-hash input. Identical canonical inputs yield identical plan
hash and ordered identities. Budget admission occurs before publication; a
required over-budget rejection has no desired/keep/materialize/evict/fallback/
coverage side effects. Optional work may be omitted according to the existing
contract while required valid coverage remains valid.

Fallback is explicit and tied to the exact validated coarser ancestor and
half-open coverage. A validated finer result replaces only its exact fallback
range. Settled selected-level coverage is integer-aligned, gap-free, and
non-overlapping; fallback is marked and is never counted as fine-level
authority. No silent replan or incompatible level mixing occurs.

## Lossless residency

Collapse and eviction release only derived resident products. They retain the
closed descriptor, complete journal, provenance inputs, and reconstruction
identity; they never average, downsample, overwrite, or truncate authority.
They are idempotent. Re-expansion/rematerialization reproduces canonical bytes,
content hash, and provenance exactly. If required authority inputs cannot be
retained, eviction rejects rather than becoming lossy.

## Browser proof boundary

The real browser proof imports the pure core through the normal `/` route,
exposes read-only evidence, and does not use `window.TestBridge` as authority.
It must assert every obligation listed in the test protocol: all L0-L4
relationships and parent/child coverage; negative alignment and half-open
bounds; descriptor variation and A-B-A determinism; ordered immutable edits and
invalid-edit rejection; valid proof use plus stale/cancelled-epoch and
forged/mismatched-proof isolation; required/optional requests, atomic fallback,
and complete selected coverage; deterministic side-effect-empty budget
rejection; collapse/eviction with retained rematerialization authority; and a
normal route with no TestBridge, browser errors, or presentation authority.

The proof is timestamp-free and must regenerate JSON/Markdown evidence twice,
without retry, with byte-identical files and signatures. The current
`package.json` must list the Adaptive E2E spec exactly once in
`test:e2e:core` while retaining all Main entries. No old package file,
dependency, lockfile, Playwright configuration, CI, bootstrap, or other shared
file may change. Historical evidence is not current verification.
