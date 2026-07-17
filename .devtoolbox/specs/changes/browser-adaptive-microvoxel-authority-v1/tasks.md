# Tasks: Browser Adaptive Microvoxel Authority V1

One existing DevToolbox execution covers the complete change after approval;
the phases below are ordered and are not separate executions. This handoff
does not create or mutate an execution. Keep every checkbox open until the
listed implementation evidence, fresh verification, review, and completion
preflight exist; editing these artifacts alone never completes a task.

## Phase 1 — Reconcile the existing change before product edits

- [x] 1.1 Revise and validate the five existing artifacts in this change.
  - Objective: encode the approved first-publish contract without adding a
    second change or making product edits.
  - Acceptance: all five artifacts agree on the closed `constant-v1`
    descriptor/exhaustive pure evaluator, descriptor digest bindings, opaque
    proofs, non-circular snapshot projection, planner recomputation, fail-closed
    stale/forged rejection, ancestry-closed safe `number` coordinates,
    unpaired-surrogate ID rejection, no compatibility path, and deferred scope.
  - Evidence: focused stale-term search, artifact cross-check, and clean
    `git diff --check`; no implementation task is toggled from this evidence.
  - Stop: return for a decision if implementation requires a forbidden shared
    path, a second provider, crypto, `BigInt`, compatibility, or worker work.

## Phase 2 — Identity and coordinate publication

- [x] 2.1 Harden stable IDs at construction.
  - Objective: reject empty, untrimmed, oversized, and unpaired high/low
    surrogate values with the established identity error before publication.
  - Acceptance: no invalid stable ID reaches canonical serialization or an
    authority hash.
  - Evidence: positive/negative focused unit cases and named browser evidence.

- [x] 2.2 Centralize the complete ancestry-closure validator.
  - Objective: validate aligned origins, safe half-open maxima, and every parent
    through L0 using safe `number` arithmetic, including negative coordinates.
  - Acceptance: valid L0-L4 relationships are gap-free; locally safe but
    ancestry-unsafe keys reject; no clamping, normalization, or `BigInt` path.
  - Evidence: every-level boundary fixtures, parent/child partition assertions,
    focused unit results, and browser matrix fields.

## Phase 3 — Closed descriptor, journal, and materialization

- [x] 3.1 Replace executable base-field input with the immutable `constant-v1`
  descriptor and exhaustive pure evaluator.
  - Objective: validate/freeze the fixed schema, identity/version, source
    revision, finite sample, and canonical nullable IDs.
  - Acceptance: no function-valued provider input, sampler, callback, registry,
    mutable receiver, or closure retention remains in the public API; descriptor
    digest is in authority, content, and provenance.
  - Evidence: focused type/contract tests, descriptor A-B-A rematerialization,
    descriptor-field variation hashes, and forbidden-term scans.

- [x] 3.2 Preserve immutable ordered journal and deterministic materialization.
  - Objective: validate/apply edits exactly once, retain the complete journal,
    and produce canonical bytes, FNV-1a64 V1 hashes, and provenance.
  - Acceptance: malformed/ambiguous/non-finite edits fail closed; equal inputs
    rematerialize identically; collapse/eviction cannot lose authority.
  - Evidence: focused journal/materialization/residency tests and literal pinned
    vectors for key, provider, journal, brick, and provenance.

## Phase 4 — Snapshot proofs and planner

- [x] 4.1 Implement canonical authority context and non-circular snapshot
  projection.
  - Objective: validate/deep-freeze body/frame/region/generator, descriptor and
    digest, journal and digest, revisions, epoch, resident summaries, coverage,
    refinement requests, and budgets.
  - Acceptance: derived proof/digest fields are excluded; identical projections
    hash identically; invalid inputs publish nothing.
  - Evidence: literal snapshot-projection vector and focused validation tests.

- [x] 4.2 Issue and verify opaque resident validation proofs.
  - Objective: use only the public constructor from validated materialized
    content/current context and bind key, content/provenance, descriptor,
    journal, revisions, epoch, and snapshot digest.
  - Acceptance: structural/self-asserted receipt objects, relabelled, forged,
    stale, prior-authority, prior-journal, prior-revision, prior-epoch, and
    prior-snapshot proofs fail closed; this remains explicitly non-cryptographic
    local staleness protection.
  - Evidence: literal proof vector and focused wrong-binding/isolation tests.

- [x] 4.3 Make planner recomputation fail closed and bind plan outcomes.
  - Objective: independently recompute snapshot digest before selected/fallback
    coverage and bind verified digest into accepted and rejected plan hashes.
  - Acceptance: no silent downgrade, fallback use, partial publication, or
    replan from invalid proof; required budget rejection is empty of side effects.
  - Evidence: focused planner matrix, accepted-plan and rejected-plan vectors,
    coverage/fallback/budget evidence.

## Phase 5 — Independent vectors and browser protocol

- [x] 5.1 Add literal, human-reviewed canonical vectors.
  - Objective: pin expected canonical UTF-8 bytes and FNV-1a64 V1 hashes for
    key, provider, journal, brick content, provenance, snapshot projection,
    proof, accepted plan, and typed rejection.
  - Acceptance: assertions do not generate expected values with production
    helpers; every vector change has an intentional schema/algorithm reason and
    review note.

- [x] 5.2 Complete the browser proof and deterministic evidence.
  - Objective: run the full approved obligation matrix in a real browser via
    the normal `/` route with read-only evidence and no TestBridge authority.
  - Acceptance: prove all L0-L4/parent-child and negative-boundary cases,
    descriptor A-B-A, ordered immutable edits/rejection, valid and stale/
    cancelled/forged proof isolation, required/optional requests, atomic
    fallback, complete selected coverage, empty budget rejection, collapse,
    eviction/rematerialization, no browser errors, and no presentation authority.
  - Evidence: timestamp-free JSON/Markdown, no screenshots unless the approved
    harness visibly renders proof state, and two runs whose evidence files are
    byte-identical by SHA-256.

## Phase 6 — Documentation and scope reconciliation

- [x] 6.1 Update the approved implementation documentation and evidence only.
  - Acceptance: obsolete callback, self-asserted receipt, and locally-safe-only
    coordinate claims are gone; deferred renderer/worker/package boundaries and
    trust limits are explicit; changed paths match the approved surface.
  - Evidence: documentation/evidence review and exact changed-path audit.

## Phase 7 — Review, verification, completion, and publication gate

- [x] 7.1 Run the complete fresh Node 22 verification matrix, deterministic
  evidence rerun, forbidden-term/scope scans, and `git diff --check`.
  - Acceptance: every required command passes and no package, lockfile,
    bootstrap, Playwright config, CI, renderer, worker, or unrelated parent
    change is present.

- [x] 7.2 Obtain one complete technical reviewer pass and fix only confirmed
  in-scope findings.
  - Acceptance: correctness/contract, regression, maintainability, and
    authority-boundary findings are clean; affected verification is rerun after
    every fix. Add a second model only if a new security/data-loss risk appears.

- [x] 7.3 Run completion preflight, record one final verified milestone in the
  existing execution, and open exactly one final human review for this worktree.
  - Acceptance: all evidence is fresh, deterministic, timestamp-free, and
    reviewed; the change remains unarchived; human approval is returned before
    any commit/push.
  - Stop: do not archive, commit, push, publish, or expand scope from this
    handoff. After separate authorization only, commit the exact approved title
    and non-force push the exact approved feature branch.
