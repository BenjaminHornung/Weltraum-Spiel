# Proposal: Browser Adaptive Microvoxel Authority V1

## Declared baseline

This is the existing single change in its isolated repository worktree, on
`feature/browser-adaptive-microvoxel-authority-v1`, with declared base
`4c1449e2bb0486fe59ee6b68da495c27abee21b5`. The browser mainline is the
product authority. Unity and Hestia surface-lab material are reference-only;
the unrelated parent checkout is not part of this change.

The current status source is `docs/current-mainline-state.md`; this checkout
does not contain `docs/current-prototype-state.md`. The relevant browser
reference is `docs/research/browser-voxel-runtime-reference-audit-v1.md`.

## Objective

Define and then implement the browser-owned, renderer-neutral adaptive
microvoxel authority core as a fail-closed, first-publish V1 contract. This
handoff revises these five existing artifacts before product implementation;
it does not implement product code or close implementation tasks.

## Binding first-publish contract

- The base quantum is exactly **0.125 m** and the only levels are integer
  `0..4`. Every brick is `16^3`; alignment, half-open bounds, mathematical
  floor division, and the eight-child hierarchy are integer contracts.
- A key is valid only when its origin and exclusive maximum are safe `Number`
  integers and every derived parent through L0 is aligned and safe. Ordinary
  negative coordinates may be valid. Locally safe but ancestry-unsafe keys are
  rejected. There is no clamping, wrapping, normalization to another key, or
  `BigInt` path.
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
  rejected plans bind the verified snapshot digest. No silent downgrade or
  replan is allowed.
- This proof is deterministic, explicitly **non-cryptographic local staleness
  protection**. It is not authentication and does not provide signatures,
  keys, hostile-process security, or cross-worker proof transport.

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

## Deferred, forbidden, and migration rules

This is a first-publish migration: replace the draft callback and receipt
contracts in place. Do not add a compatibility reader, deprecated callback
adapter, permissive old receipt reader, or edge-key clamping path. No second
provider kind, dynamic provider registry, cryptographic signature, `BigInt`,
renderer/Three.js/UI/scene/bootstrap integration, worker/streaming, cache,
persistence, gameplay, network, database, package, lockfile, Playwright
configuration, CI group, or shared-file change is allowed. No test-data
generation or mutation, service start, PR, merge, archive, deployment, or
force-push is part of this handoff.

## Completion and authorization

All five artifacts must remain mutually consistent, and all task checkboxes
remain open until implementation evidence, fresh verification, technical
review, completion preflight, and the single final human review gate exist.
The existing execution `2c4851b6e0004855bfa7389a1f55a0a2` is reused only after
approval; no execution is created by this handoff. After the final gate and
separate user authorization, the exact commit may be
`#WELTRAUM-000 Add adaptive microvoxel authority core`, pushed non-force only
to `origin/feature/browser-adaptive-microvoxel-authority-v1`. No commit or push
is authorized by this artifact edit.
