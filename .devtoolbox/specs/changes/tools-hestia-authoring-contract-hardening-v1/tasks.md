# Tasks: Hestia Asset Authoring Contract V1 Hardening

All tasks are intentionally unchecked. Execute them in order. Every task must
leave command output, changed paths, or review results sufficient for
`tasks_completion_preflight`; a failed gate or contradictory evidence stops the
handoff rather than being waived.

## Phase 0 - Baseline, authorization, and gates

- [ ] Confirm the exact worktree/repository root, branch
  `feature/tools/hestia-asset-authoring-contract-v1`, and baseline
  `84a24fe341e55412b25272d9b2307d573e778f7b`; record `git status --short` and
  prove that only the authorized change directory is intentionally untracked or
  changed. Acceptance: baseline and path evidence are recorded and no unrelated
  path is modified.
- [ ] Re-read this change's `proposal.md`, `design.md`, and capability
  `spec.md`, plus the current Hestia contract/schema and current-mainline
  documentation; confirm the generated change structure is intact. Acceptance:
  the implementation plan and all non-goals match the approved contract with no
  missing or contradictory decision; stop if they do not.
- [ ] Prepare exactly one DevToolbox execution for this complete change after the
  spec is accepted; reuse that execution for every task, retry, review, and
  verification. Acceptance: one execution identity is recorded; no per-agent,
  per-task, or per-retry execution is created.
- [ ] Perform the current-main integration check against the then-current main
  baseline before product-file edits. Inspect overlap with the Hestia contract,
  schema, browser package/lockfile, and test lane. Acceptance: integration is
  either explicitly compatible or a documented blocker; stop on conflicting
  evidence instead of redesigning this contract.

## Phase 1 - Contract documentation and schema annotation-equivalence

- [ ] Update the Hestia contract documentation with the normative bounds-safe
  inventory, lossless Hestia-member projection with transport `kind` consumed for
  classification but never serialized or directly hashed as a field, closed
  canonical root, schema-before-semantic ordering, deterministic
  canonicalization, negative-zero normalization, and registry-independent
  authoring hash. Acceptance: the prose states that changing `kind` requires
  full reclassification and validation, may change the canonical document/hash
  or yield no valid document/hash, and has equal hashes only when the transport
  encodings classify to the same valid canonical document; it does so without
  requiring implementation in this change.
- [ ] Check schema annotation-equivalence and the existing closed-schema behavior
  without changing schema version, required properties, or schema behavior.
  Acceptance: `kind` and unknown canonical fields remain rejected, no registry
  field is added, and no v2/new-required-property behavior is introduced.
- [ ] Document the read-only invariant for Agent F and Agent G, including restore
  on success/error/abort, no source Blender/GLB save or overwrite, explicit new
  output allowance, and in-memory/derived compiler transforms. Acceptance:
  source-state ownership and every outcome are stated normatively; executable
  Blender behavior tests are deferred to Agent F.
- [ ] Document compiler binding and hash domains: exactly one registry ID/version,
  fail-closed absent/unknown/ambiguous binding, compiler and registry identity in
  the output manifest, authoring hash excluding registry binding, and
  compilation/manifest hash including it. Acceptance: the contract preserves
  these normative rules; executable registry/hash tests are deferred to Agent G.
- [ ] Replace the invalid canonical example with the complete golden fixture as
  the single object-equivalent source of truth, and correct the minimal-fixture
  description to required root/asset fields with empty collections. Acceptance:
  locked Ajv and the focused test prove schema validity and deep equality.
- [ ] Record rejected alternatives in the design: registry fields in the
  authoring root, no registry binding, hand-written/manual-only validation proof,
  and compiler/exporter implementation in this change. Acceptance: each
  rejection states the approved reason and no alternative is silently adopted.

## Phase 2 - Locked Ajv/Vitest proof and fixtures

- [ ] Add exactly one explicitly pinned Ajv version as a devDependency of
  `apps/weltraum-browser` and update its lockfile with the matching resolved
  package/integrity data. Acceptance: package and lockfile agree, no caret/tilde
  or other range is used, and no unrelated dependency is changed.
- [ ] Add the complete golden fixture and the minimal valid fixture to the
  focused Hestia contract fixture set. Acceptance: both pass locked Ajv
  Draft 2020-12 schema validation and the golden fixture is the documented
  canonical example/reference.
- [ ] Add negative fixtures/tests for missing required property, unknown
  canonical property, wrong schema version, `kind` in canonical data, decorative
  invalid collision policy, and duplicate tag. Acceptance: each fails for the
  intended closed-schema reason; tests do not rely on a hand-written validator.
- [ ] Add static/normative contract assertions for transport `kind`
  classification and removal as a direct canonical/hash field,
  unknown Hestia-member rejection, provenance-only non-Hestia extras, empty tags,
  namespace separation, and the read-only boundary. Acceptance: assertions
  inspect contract/schema/fixture evidence only and do not implement runtime
  behavior.
- [ ] Explicitly defer executable tests for GLB bounds-safe ingest and inventory,
  semantic ID/reference/cycle guards, deterministic canonicalization, external
  registry resolution, and both hash domains to Agent G's compiler change.
  Acceptance: this change adds no decoder, canonicalizer, resolver, hash engine,
  or compiler implementation; Agent F owns Blender/exporter behavior tests.
- [ ] Execute the existing exporter compatibility tests read-only for v1 transport
  `kind` and empty tags without requiring new exporter authoring properties.
  Acceptance: compatibility evidence is collected without modifying the
  exporter/compiler implementation worktrees.

## Phase 3 - Verification and exact-head evidence

- [ ] Run the focused Hestia Ajv/Vitest tests under Node 22 from
  `apps/weltraum-browser`; capture the exact command, exit code, test count, and
  fixture/result evidence. Acceptance: focused Ajv/schema-fixture, embedded
  example deep-equality, and static/normative contract assertions pass freshly.
- [ ] Run the full allowed browser-unit suite and production build under Node 22
  using the approved commands (`npm run test` and `npm run build`); capture exact
  commands and exit codes. Acceptance: both pass without test-data mutation or
  unrelated file changes. If Node 22 or a required gate is unavailable, record
  the check as NOT RUN with the concrete blocker; never report it as passing.
- [ ] Run the required exporter compatibility tests and inspect their exit code
  and evidence. Acceptance: transport compatibility is proven and no exporter or
  compiler worktree is written.
- [ ] Inspect exact-head and diff evidence: `git diff --check`, changed-path
  allowlist, package/lockfile consistency, schema/spec consistency, and absence
  of source saves or generated unrelated artifacts. Acceptance: only approved
  paths are present and all checks are fresh.
- [ ] Dispatch one technical reviewer for the complete change using the single
  execution. Acceptance: findings are recorded by severity; any confirmed issue
  is fixed within scope and the affected verification is rerun before proceeding.
- [ ] Run DevToolbox verification on the single execution, then run completion
  preflight. Acceptance: verify and preflight both pass with fresh evidence;
  toggle tasks only after their evidence is complete, never before.

## Phase 4 - Human review and post-approval publication handoff

- [ ] Run exactly one final Plannotator review for this worktree only after all
  implementation, review, verification, and preflight tasks are complete.
  Acceptance: the review covers the exact worktree diff and returns approval;
  do not substitute a project-root or other-worktree review.
- [ ] After human approval only, selectively stage the approved paths and create
  the requested commit with title `#WELTRAUM-000 Define Hestia asset authoring
  contract v1`. Acceptance: staged paths are inspected before commit and no
  unrelated file is included.
- [ ] Push the branch without force and create/update the PR with title
  `#WELTRAUM-000 Define Hestia asset authoring contract v1`. Acceptance: the
  pushed commit is the reviewed exact head and remote status is recorded.
- [ ] Resolve all review findings and rerun affected technical review and fresh
  verification. Acceptance: no unresolved review finding remains and exact-head
  CI is green.
- [ ] Merge only after exact-head CI is green, then run and record Main-CI.
  Acceptance: merge and Main-CI evidence are green; do not merge on local-only
  evidence.
- [ ] Archive this completed change, then delete the contract remote/worktree
  only after merge and Main-CI success. Acceptance: archive path, cleanup result,
  and final repository status are recorded; no source or unrelated worktree is
  deleted.
