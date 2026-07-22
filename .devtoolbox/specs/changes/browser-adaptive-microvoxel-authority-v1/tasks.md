# Tasks: Browser Adaptive Microvoxel Authority V1

This Continuation reconstructs the Adaptive source restdiff
`4c1449e2bb0486fe59ee6b68da495c27abee21b5..5fb372bdba677e43e71566121c53efb5e244b93a`
on freshly fetched `origin/main` at
`f6d3fe69175b168ddea5e385c6d7b3452e6cba16` in
`feature/browser-structural-microvoxel-destruction-core-v1-continuation`.
Source baseline `4c1449e2bb0486fe59ee6b68da495c27abee21b5` and source head
`5fb372bdba677e43e71566121c53efb5e244b93a` are restdiff inputs only, never
merge or tree-overlay inputs. Historical completion state, execution IDs, test
counts, evidence results, and review results are context only and are not
current proof. DevToolbox execution `bbca9639a41142918a493bee5173de45` records
this Adaptive stage. Every task starts open and is closed only after fresh Node 22
evidence and its own completion preflight.

## Phase 1 - Reconcile the existing change before product edits

- [x] 1.1 Revise and validate the five existing artifacts in this change.
  - Objective: encode the approved first-publish contract for the Continuation before any product edit is applied.
  - Acceptance: all five artifacts agree on the closed `constant-v1`
    descriptor/exhaustive pure evaluator, descriptor digest bindings, opaque
    proofs, non-circular snapshot projection, planner recomputation, fail-closed
    stale/forged rejection, ancestry-closed safe `number` coordinates,
    code-unit canonical ordering, named finite input caps, safe-number geometry,
    the separate Authority-domain boundary, unpaired-surrogate ID rejection,
    exact current E2E grouping, no compatibility path, and deferred scope.
  - Evidence: focused stale-term search, artifact cross-check, and clean
    `git diff --check`; no implementation task is toggled from this evidence.
  - Stop: return for a decision if implementation requires a forbidden shared
    path, a second provider, crypto, BigInt coordinate/gameplay representation,
    compatibility, or worker work. Internal BigInt hashing is not a stop.

## Phase 2 - Identity and coordinate publication

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
    ancestry-unsafe keys reject; no clamping, normalization, or BigInt
    coordinate/gameplay/sphere-geometry representation. Sphere and
    materialization geometry use bounded safe `number` arithmetic and reject
    unsafe intermediates. Internal BigInt use remains allowed only for
    unchanged FNV-1a64 and canonical hashing semantics.
  - Evidence: every-level boundary fixtures, parent/child partition assertions,
    focused unit results, and browser matrix fields.

## Phase 3 - Closed descriptor, journal, and materialization

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
  - Acceptance: malformed/ambiguous/non-finite edits fail closed; a named
    finite journal-record cap is checked before copy/sort/hash/materialization;
    over-cap input fails closed without mutation or partial output; equal inputs
    rematerialize identically; collapse/eviction cannot lose authority. Select
    and review the concrete cap during implementation; do not guess it here.
  - Evidence: focused journal/materialization/residency tests and literal pinned
    vectors for key, provider, journal, brick, and provenance.

## Phase 4 - Snapshot proofs and planner

- [x] 4.1 Implement canonical authority context and non-circular snapshot
  projection.
  - Objective: validate/deep-freeze body/frame/region/generator, descriptor and
    digest, journal and digest, revisions, epoch, resident summaries, coverage,
    refinement requests, and budgets.
  - Acceptance: derived proof/digest fields are excluded; named finite caps for
    residents, active coverage, refinement requests, and aggregate planning work
    are checked before copy/sort/hash/enumeration; over-cap and invalid inputs
    publish nothing. Concrete cap values require implementation review.
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
    replan from invalid proof; required budget rejection is empty of side
    effects; planner work remains within the named finite caps.
  - Evidence: focused planner matrix, accepted-plan and rejected-plan vectors,
    coverage/fallback/budget evidence.

## Phase 5 - Independent vectors and browser protocol

- [x] 5.1 Add literal, human-reviewed canonical vectors.
  - Objective: pin expected canonical UTF-8 bytes and FNV-1a64 V1 hashes for
    key, provider, journal, brick content, provenance, snapshot projection,
    proof, accepted plan, and typed rejection.
  - Acceptance: assertions do not generate expected values with production
    helpers; canonical collection sorting uses an explicit code-unit comparator
    and never `localeCompare`; non-ASCII ordering has a regression vector;
    every hash-vector change has an intentional schema/algorithm reason and
    review note. FNV-1a64/canonical hash semantics remain unchanged.

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

## Phase 6 - Documentation and scope reconciliation

- [x] 6.1 Update the approved implementation documentation and fresh evidence only.
  - Acceptance: obsolete callback, self-asserted receipt, and locally-safe-only
    coordinate claims are gone; the current package E2E-group exception and all
    other deferred boundaries are explicit; changed paths match the approved
    surface; historical evidence is never presented as current. Document
    exactly that Surface-Lab-/Voxel-Authority and Adaptive-Microvoxel-Authority
    are separate domains and neither may concurrently publish World-Truth
    without a later adapter contract.
  - Evidence: documentation/evidence review and exact changed-path audit.

## Phase 7 - Review, verification, completion, and publication gate

- [x] 7.1 Run the complete fresh Node 22 verification matrix serially:
  TypeScript; each of the three Adaptive unit files separately; Adaptive E2E
  twice with retries disabled and byte-identical evidence/signatures; full unit;
  build; current `test:e2e:core`; exact E2E inventory; normal `/` without
  TestBridge; Surface-Lab smoke; scope and forbidden-import/authority scans;
  `git diff --check`; DevToolbox verification; Adaptive completion preflight.
  - Acceptance: every required command passes and the only allowed shared-file
    edit is the minimal current `package.json` addition that assigns the
    Adaptive E2E spec exactly once to `test:e2e:core` while retaining every
    current Main entry; no dependency, lockfile, bootstrap, Playwright config,
    CI, renderer, worker, Surface-Lab, or unrelated change is present.

- [x] 7.2 Obtain one complete technical reviewer pass and fix only confirmed
  in-scope findings.
  - Acceptance: correctness/contract, regression, maintainability, and
    authority-boundary findings are clean; affected verification is rerun after
    every fix. Add a second model only if a new security/data-loss risk appears.

- [x] 7.3 Run the Adaptive completion preflight, record the fresh verified
  milestone in execution `bbca9639a41142918a493bee5173de45`, and commit
  Adaptive as its own integration commit.
  - Acceptance: all Adaptive evidence is fresh, deterministic, timestamp-free, reviewed, and
    linked to this Continuation; Structural has not begun; the change remains
    unarchived.
  - Stop: do not start Structural until this task and every Adaptive gate pass.
    Do not merge to `main`.
