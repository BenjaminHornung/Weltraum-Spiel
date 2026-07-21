# Capability: Browser Adaptive Microvoxel Authority V1

## Requirement: Continuation identity and restdiff

This capability is reconstructed on
`feature/browser-structural-microvoxel-destruction-core-v1-continuation` from
fresh `origin/main` at `f6d3fe69175b168ddea5e385c6d7b3452e6cba16`.
The Adaptive source baseline is
`4c1449e2bb0486fe59ee6b68da495c27abee21b5`, the source head is
`5fb372bdba677e43e71566121c53efb5e244b93a`, and the only source payload is
`4c1449e2bb0486fe59ee6b68da495c27abee21b5..5fb372bdba677e43e71566121c53efb5e244b93a`. Neither old head is a merge target or complete tree
overlay.

### Scenario: Restdiff reconstruction

Given the verified source SHAs and current Main, when Adaptive is reconstructed,
then only the Adaptive restdiff plus explicitly approved Continuation hardening
and the minimal current E2E-group edit are present.

## Requirement: Fixed quantum and level set

The authority shall define exactly `MICROVOXEL_BASE_QUANTUM_METERS = 0.125`
and accept exactly integer levels `0`, `1`, `2`, `3`, and `4`. Level 0 is
2.000 m, level 1 is 1.000 m, level 2 is 0.500 m, level 3 is 0.250 m, and
level 4 is 0.125 m. Level 4 is finest. For integer `L` in `0..4`,
`cellSizeMeters(L) = 0.125 * 2^(4-L)`. Any other quantum, fractional level,
or out-of-range level shall fail closed before publication.

### Scenario: Invalid resolution

Given a request with a non-0.125 base quantum or a level outside 0..4, when it
is validated, then no brick, plan, hash, provenance, or coverage is published.

## Requirement: Aligned 16-cubed brick hierarchy

Every brick shall contain exactly `16^3` cells and use integer level-0 cell
coordinates. Its level-`L` edge shall be `16 * cellSizeMeters(L)` metres. A
level-`L` origin shall be aligned to `16 * 2^(4-L)` base cells on every axis.
A parent at level `L` shall have eight children at `L+1`, where `L < 4`.
Parent/child lookup shall use mathematical integer floor division, including
negative coordinates. Coverage shall be integer-aligned and half-open.

### Scenario: Parent/child alignment

Given an aligned level-`L` brick, when its children and parent are derived, then
all eight children partition the parent exactly, with no gap, overlap, or
floating-point alignment decision.

## Requirement: Ancestry-closed safe coordinate domain

A key shall use safe `number` arithmetic. Its aligned origin and half-open
exclusive maximum shall be safe integers, and every parent derived repeatedly
through L0 shall also have aligned safe origins and safe exclusive maxima. The
domain is complete for all valid L0-L4 relationships, including ordinary
negative aligned coordinates. A locally safe key with an unsafe ancestor shall
fail closed. Coordinates and gameplay values, including sphere/materialization
geometry, shall use bounded safe `number` arithmetic. Invalid keys and unsafe
geometry shall be rejected without clamping, wrapping, normalizing, or switching
to `BigInt`. Internal `BigInt` use is allowed only in the unchanged
FNV-1a64/canonical hashing implementation; hash semantics shall not change.

### Scenario: Locally safe but ancestry-unsafe key

Given a key whose own origin and exclusive maximum are safe but whose derived
parent is not safely representable, when the key is created or validated, then
it is rejected and no alternate key, plan, or coverage is published.

## Requirement: Canonical stable identity validation

Every stable authority/body/frame/region/generator ID shall be validated before
publication. Empty, untrimmed, oversized, and unpaired high/low UTF-16
surrogate values shall throw the established identity-oriented
`AdaptiveAuthorityError`; canonical serialization shall not be the first place
an invalid published ID is detected.

### Scenario: Unpaired identity surrogate

Given an ID containing an unpaired high or low surrogate, when the stable ID is
constructed, then identity validation rejects it before authority output or
canonical hashing.

## Requirement: Closed constant provider descriptor

V1 shall expose exactly one immutable provider kind: `constant-v1`. Its fixed
schema version, stable identity/version, source revision, and one canonical
sample shall be validated; density shall be finite, occupancy shall be finite
and in `[0,1]`, and material/semantic IDs shall be canonical nullable IDs. The
adaptive core shall evaluate it through an exhaustive pure switch. Function-
valued samples, samplers, callbacks, registries, dynamic code, mutable
receivers, renderer objects, and timing sources shall be rejected. The
descriptor shall be deeply frozen before publication.

### Scenario: Descriptor determinism and variation

Given equal descriptors and authority inputs, when they are evaluated and
materialized repeatedly, then the canonical bytes, content hash, and provenance
hash are equal. Given any descriptor-field change, then the descriptor digest
and every dependent authority/content/provenance binding changes or validation
fails.

## Requirement: Descriptor-bound authority

The descriptor's canonical digest shall be included in authority input,
materialized content, provenance, validation-proof bindings, snapshot
projection, accepted plan hashes, and rejected plan hashes. Operational and
presentation metadata shall not affect those values.

### Scenario: Provider identity cannot drift

Given the same key and journal but a changed descriptor identity, version,
source revision, or sample, when planning is attempted, then the changed
descriptor is a distinct authority and cannot reuse the prior binding.

## Requirement: Stable identity and transient metadata separation

Stable spatial identity shall be independent of request, queue, worker epoch,
cache, telemetry, renderer, camera, and timing metadata. Those values shall
not affect content or provenance hashes.

### Scenario: Same authority, different request

Given equal authority inputs submitted in different request/completion orders,
then identity, materialized bytes, content hash, provenance, and coverage are
equal.

## Requirement: Separate authority domains

Surface-Lab-/Voxel-Authority und Adaptive-Microvoxel-Authority
sind getrennte Domänen.

Keine von beiden darf ohne späteren Adaptervertrag
gleichzeitig World-Truth publizieren.

The Adaptive capability shall produce pure results only. It shall not add
runtime wiring, replace Surface Lab, treat renderer meshes as truth, mutate an
existing voxel-state owner, or publish concurrent World-Truth.

### Scenario: No cross-authority publication

Given both domains are present in the repository, when Adaptive plans or
materializes a result, then no Surface-Lab/Voxel state or product World-Truth is
mutated or published without a later explicit adapter contract.

## Requirement: Base-field authority

The validated versioned base descriptor shall be authoritative for unedited
content. Fallbacks, caches, meshes, and presentation projections shall not
mutate or replace it. Missing, unsupported, malformed, or non-finite base data
shall fail closed; no empty, air, zero, or default field is implicit.

### Scenario: No implicit base

Given a brick whose required base field is unavailable or invalid, then the
brick is rejected and is not treated as empty, air, or a successful fallback.

## Requirement: Immutable ordered edit journal

Edits shall be represented by a validated immutable ordered journal. Records
shall be applied exactly once in declared order; malformed, duplicated,
ambiguous, unsupported, out-of-range, conflicting, or non-finite records shall
be rejected before materialization. Append shall create a new snapshot and
cannot rewrite a prior journal. The complete ordered journal is provenance and
shall not be compacted lossily. A named finite journal-record limit shall be
validated before records are copied, sorted, hashed, or materialized. Exceeding
the limit shall fail closed without mutating the input or publishing partial
content. The implementation and review shall select the concrete constant;
this specification does not invent a numeric value.

### Scenario: Order is authority

Given two valid edits whose order changes effective cell values, then the two
journal orders produce distinct deterministic results, and a consumer cannot
mutate either prior journal.

## Requirement: Deterministic materialization, hashing, and provenance

Materialization, content hashing, and provenance shall depend only on canonical
authority inputs and explicit algorithm/schema versions, including the
descriptor digest and ordered journal digest. Sphere and cell-overlap geometry
shall use bounded safe `number` arithmetic and reject unsafe intermediate
values; coordinate/radius `BigInt` arithmetic is forbidden. Equal inputs shall
reproduce byte-identical values and deterministic FNV-1a64 V1 hashes; changed
authoritative inputs shall not reuse an unrelated result.

### Scenario: Re-materialization

Given a validated key, descriptor, and journal, when materialized repeatedly
after different cache or worker histories, then bytes, content hash, and
provenance are identical.

## Requirement: Canonical serialization restrictions

Canonical serialization shall use explicit versioned fields, stable ordering,
stable encodings, integer alignment, descriptor digest, authoritative channels,
and journal records only. Every canonical collection comparator shall use
explicit code-unit ordering; `localeCompare`, host locale, and ICU behavior
shall not affect ordering or signatures. It shall exclude timestamps, random
values, insertion/object ordering, request/worker/cache metadata, timing,
camera/render state, and derived presentation buffers. Unknown fields, duplicate keys,
non-finite values, unsupported versions, alternate numeric spellings, and
implicit defaults shall fail closed without normalization or hidden precision
loss.

### Scenario: Transient metadata exclusion

Given equal authority data with different operational metadata, then canonical
bytes and hashes remain equal.

## Requirement: Literal independent canonical vectors

The unit suite shall contain literal, human-reviewed expected canonical UTF-8
bytes and FNV-1a64 V1 hashes for a representative key, provider descriptor,
edit journal, materialized brick content, provenance, non-circular snapshot
projection, opaque proof, accepted plan, and typed rejected plan. Expected
values shall not be generated by the production serializer/hash helper inside
the assertion. A changed vector requires an identified intentional
schema/algorithm reason and a review note.

### Scenario: Canonical drift

Given a producer and consumer serializer/hash implementation changed together,
when pinned literals are checked, then any byte/hash drift fails independently.

## Requirement: Authority context and opaque resident proof

The canonical authority context shall contain body, surface frame, region,
generator identity, the complete descriptor and descriptor digest, validated
journal and journal digest, source/edit/brick revisions, and planning epoch.
Only a public validation constructor, given validated materialized content and
the current context, may issue an opaque locally branded resident proof. The
proof shall bind the exact key, content hash, provenance hash, descriptor
digest, journal digest, all revisions, planning epoch, and snapshot digest.
Pending/absent residents have no ready proof. A structural object literal,
self-asserted receipt, relabelled proof, or old proof shape is invalid.

The snapshot constructor shall validate and deep-freeze context and inputs,
validate ready proof sources, and hash a projection containing context, epoch,
normalized resident summaries, active coverage, refinement requests, and
budgets. Named finite limits shall cap resident summaries, active coverage,
refinement requests, and aggregate derived planning work before copying,
sorting, hashing, or enumeration. Exceeding a cap shall fail closed without a
partial projection or plan. Concrete numeric values require implementation and
review and are not guessed in this specification. Derived proof/digest fields
are excluded from this projection so it is non-circular.

This digest binding is explicitly non-cryptographic local staleness protection,
not authentication, signatures, key management, hostile-process security, or
cross-worker proof transport.

### Scenario: Exact proof binding

Given a proof created by the validation constructor for a current materialized
brick and snapshot, when the planner verifies it, then it is accepted only when
key, content, provenance, descriptor, journal, revisions, epoch, branding, and
snapshot digest all match exactly.

## Requirement: Planner recomputation and fail-closed stale rejection

The planner shall independently recompute the canonical snapshot projection and
digest before selecting or using fallback coverage. Forged, malformed,
wrong-key, wrong-authority, wrong-provider, wrong-journal, wrong-revision,
prior-epoch, prior-snapshot, missing, or stale proofs shall fail closed before
they affect selected/fallback coverage. A ready resident with an invalid proof
shall not be silently downgraded to pending, used as fallback, or trigger a
silent replan. Accepted plans and typed budget rejections shall bind the
verified snapshot digest in their canonical plan hash input.

### Scenario: Stale proof isolation

Given a proof from another key, authority context, descriptor, journal,
revision, planning epoch, or snapshot, when it is presented to the planner,
then planning rejects it and selected/fallback coverage and prior accepted
state remain unchanged.

## Requirement: Deterministic planner and explicit fallback

The planner shall produce a deterministic ordered plan from aligned request
coverage, allowed levels, priority, finite budgets, and a verified snapshot.
Fallback shall name a validated coarser ancestor and its half-open coverage; it
shall never fabricate data, use invalid proof, or be reported as fine-level
authority. A finer validated result replaces only its exact fallback range.

### Scenario: Fine result replaces fallback

Given a valid coarse fallback followed by a valid finer result, then the finer
result replaces only the exact covered range, the fallback state is removed for
that range, and no mixed incompatible authority is published.

## Requirement: Budget and coverage semantics

Budget admission shall fail closed before publication. Settled coverage shall
be half-open, integer-aligned, gap-free, and non-overlapping for its selected
authority level. Partial, stale, rejected, or over-budget work shall not count
as settled coverage. Required budget rejection shall have empty desired, keep,
materialize, evict, fallback, and coverage side-effect arrays; optional work
may be omitted according to the existing contract.

### Scenario: Over-budget request

Given a request whose required plan exceeds any declared finite budget, then the
planner returns a typed budget outcome with the verified snapshot digest and
publishes no false complete coverage or side effects.

## Requirement: Lossless collapse and eviction

Collapse and eviction shall release only derived resident products. The closed
descriptor, complete ordered journal, provenance inputs, and identity needed
for reconstruction shall remain retained. Re-expansion after either operation
shall reproduce prior canonical bytes, hash, and provenance; lossy release is
rejected.

### Scenario: Evicted brick reload

Given a validated materialized brick that is collapsed or evicted, when it is
requested again with unchanged authority inputs, then it is reconstructed
losslessly and no journal record or authoritative cell is lost.

## Requirement: Rejection and ownership safety

Rejected, stale, cancelled, malformed, incomplete, over-budget, or
fallback-unmarked values shall not enter authority, coverage, cache admission,
or browser evidence as successful content. Validated authority values shall be
immutable to consumers. A ready value with an invalid proof is a rejected
snapshot, not a pending downgrade.

### Scenario: Rejected output isolation

Given an invalid or stale result, then it affects only typed rejection
diagnostics and cannot replace a valid current result.

## Requirement: First-publish migration has no compatibility path

The draft callback sampler, executable base-field input, self-asserted receipt,
permissive old receipt reader, and ancestry-unsafe edge-key behavior shall be
replaced in place. No deprecated adapter, compatibility reader, callback path,
clamping behavior, or alternate provider shall be added. Old inputs fail
closed.

### Scenario: Draft input rejection

Given callback-shaped provider input, a fabricated receipt-shaped proof, or an
ancestry-unsafe edge key, when it reaches a V1 publication boundary, then it is
rejected without compatibility reinterpretation or side effects.

## Requirement: Minimal current E2E-group integration

The current `apps/weltraum-browser/package.json` shall add
`tests/e2e/adaptive-microvoxel-authority.spec.ts` exactly once to the existing
`test:e2e:core` group and preserve every current Main entry. No old package
file, dependency, lockfile, bootstrap, worker/streaming path,
Three.js/Presentation path, Hestia Surface-Lab runtime, flight, navigation,
persistence, gameplay, Playwright configuration, CI file, or other shared file
shall change.

### Scenario: Scope and inventory audit

Given the reconstructed implementation and fresh evidence, when changed paths
and E2E inventory are audited, then the Adaptive spec occurs exactly once in
`test:e2e:core`, all prior Main specs remain, and only approved isolated
authority/test/evidence/docs/spec paths plus the minimal current package edit
are present.

## Requirement: Browser proof and final governance

The browser proof shall use a real browser and read-only evidence to prove the
authority behavior through the normal `/` route without TestBridge authority
or runtime integration. It shall prove every L0-L4 relationship, negative
alignment/half-open bounds, descriptor A-B-A determinism, ordered immutable
edits and invalid rejection, valid/stale/cancelled/forged/mismatched proofs,
required/optional requests, atomic fallback, complete selected coverage,
side-effect-empty budget rejection, collapse/eviction authority retention,
and no browser/page/console/request errors or presentation authority.
Evidence shall be deterministic, timestamp-free, and byte-identical across
two runs.

The change shall remain active and unarchived. No implementation task is
complete from artifact editing alone, and historical tests, evidence, reviews,
or preflights are not current. Execution
`bbca9639a41142918a493bee5173de45` records the fresh Adaptive stage. The
ordered gate is fresh Node 22 evidence, technical review, Adaptive completion
preflight, and a separate Adaptive integration commit. Structural shall not
begin before that stop-gate. No merge to `main`, deployment, or force-push is
allowed.
