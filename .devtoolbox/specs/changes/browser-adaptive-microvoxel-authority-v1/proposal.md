# Proposal: Browser Adaptive Microvoxel Authority V1

## Declared baseline

This Continuation is reconstructed in the new isolated worktree on
`feature/browser-structural-microvoxel-destruction-core-v1-continuation`.
The freshly fetched target baseline is `origin/main` at
`f6d3fe69175b168ddea5e385c6d7b3452e6cba16`. The Adaptive source head is
`5fb372bdba677e43e71566121c53efb5e244b93a`; its source baseline is
`4c1449e2bb0486fe59ee6b68da495c27abee21b5`, so this stage reconstructs only
`4c1449e2bb0486fe59ee6b68da495c27abee21b5..5fb372bdba677e43e71566121c53efb5e244b93a`.
The old head is evidence, not a merge target or complete tree overlay.

The current status source is `docs/current-mainline-state.md`; this checkout
does not contain `docs/current-prototype-state.md`. The relevant browser
reference is `docs/research/browser-voxel-runtime-reference-audit-v1.md`.

## Objective

Reconstruct the browser-owned, renderer-neutral Adaptive Microvoxel Authority
as the first separate Continuation stage. The reconstructed source is hardened
against the current Main contracts before any Structural work begins. Artifact
editing alone does not implement product code, close tasks, or make historical
verification current.

## Binding first-publish contract

- The base quantum is exactly **0.125 m** and the only levels are integer
  `0..4`. Every brick is `16^3`; alignment, half-open bounds, mathematical
  floor division, and the eight-child hierarchy are integer contracts.
- A key is valid only when its origin and exclusive maximum are safe `Number`
  integers and every derived parent through L0 is aligned and safe. Ordinary
  negative coordinates may be valid. Locally safe but ancestry-unsafe keys are
  rejected. Coordinates, gameplay values, sphere geometry, and materialization
  geometry use bounded safe `number` arithmetic and fail closed outside that
  domain. Internal `BigInt` use is allowed only for the unchanged FNV-1a64 and
  canonical hashing implementation; hash semantics must not change.
- The only V1 base-field provider is one deeply immutable, discriminated
  `constant-v1` descriptor with fixed schema version, stable identity/version,
  source revision, and one validated finite sample (occupancy `[0,1]`,
  canonical nullable IDs). The adaptive core owns an exhaustive pure evaluator.
  No executable sampler, callback, registry, dynamic code, mutable receiver,
  renderer object, or timing source is accepted.
- The descriptor canonical digest is bound into authority input, materialized
  content, provenance, validation proofs, snapshot projections, and plan
  hashes. The edit journal is validated, immutable, ordered, complete, and
  hashed.
- A public validation constructor issues opaque resident proofs only from a
  validated materialized brick and the current planner authority context.
  Proofs bind the exact key, content hash, provenance hash, descriptor digest,
  journal digest, source/edit/brick revisions, planning epoch, and a
  recomputed, non-circular snapshot digest. A self-asserted receipt or object
  literal is never accepted.
- The planner independently reconstructs and hashes the snapshot projection,
  validates proof branding and every binding, and fails closed before selected
  or fallback coverage when a proof is absent, forged, relabelled, stale, or
  from another authority/journal/revision/epoch/snapshot. Accepted and budget
  rejected plans bind the verified snapshot digest. Canonical collection order
  uses an explicit code-unit comparator, never locale-sensitive ordering.
  Named finite limits cap journals, residents, active coverage, refinement
  requests, and derived planning work before copying, sorting, or
  materialization. Exceeding a limit fails closed. No silent downgrade or
  replan is allowed.
- This proof is deterministic, explicitly **non-cryptographic local staleness
  protection**. It is not authentication and does not provide signatures,
  keys, hostile-process security, or cross-worker proof transport.

## Authority-domain boundary

Surface-Lab-/Voxel-Authority und Adaptive-Microvoxel-Authority
sind getrennte Domänen.

Keine von beiden darf ohne späteren Adaptervertrag
gleichzeitig World-Truth publizieren.

The Adaptive stage supplies pure planning/materialization results only. It does
not replace Surface Lab, publish renderer meshes as truth, mutate a current
voxel-state owner, or add runtime wiring.

## Existing authority behavior retained

The validated base field is authoritative for unedited content. Canonical
materialization, content hashes, provenance, planning, explicit validated
fallback, coverage, budgets, collapse, eviction, and rematerialization remain
deterministic and independent of request order, cache state, workers, timing,
renderer, or presentation. Collapse and eviction release only derived resident
products; the authority descriptor and complete journal remain available.
Budget rejection is bounded, deterministic, side-effect empty, and typed.

## Exclusive scope

- The existing isolated adaptive authority implementation, its focused unit
  tests, the existing browser proof/evidence, and this one change directory.
- Canonical identity, coordinates, descriptor evaluation, journal,
  materialization, provenance, snapshot/proof validation, planner, fallback,
  coverage, budget, collapse, and eviction behavior described here.
- Deterministic Node 22/browser verification and timestamp-free evidence,
  without claiming product integration.
- One minimal edit to the current `apps/weltraum-browser/package.json` that
  adds `tests/e2e/adaptive-microvoxel-authority.spec.ts` exactly once to the
  existing `test:e2e:core` group while preserving every current Main entry.

## Deferred, forbidden, and migration rules

This is a first-publish migration: replace the draft callback and receipt
contracts in place. Do not add a compatibility reader, deprecated callback
adapter, permissive old receipt reader, or edge-key clamping path. No second
provider kind, dynamic provider registry, cryptographic signature, coordinate
or gameplay `BigInt`, renderer/Three.js/UI/scene/bootstrap integration,
worker/streaming, cache, persistence, gameplay, network, or database change is
allowed. Do not import an old package file or change dependencies, lockfiles,
Playwright configuration, or CI. The sole shared-file exception is the minimal
current `package.json` E2E-group membership described above. No test-data
mutation, merge, archive, deployment, or force-push is authorized.

## Completion and authorization

All five artifacts must remain mutually consistent, and all task checkboxes
remain open until implementation evidence, fresh verification, technical
review, and the separate Adaptive completion preflight exist. Execution
`bbca9639a41142918a493bee5173de45` records this Continuation stage; older
execution, test, evidence, review, and preflight results are historical context
only. Adaptive is committed as its own integration commit only after every
Adaptive gate passes. Structural must not begin before that stop-gate. The
target branch must not be merged to `main` without explicit later approval.
