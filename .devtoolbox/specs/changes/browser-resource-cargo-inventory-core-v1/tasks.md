# Tasks

## Phase 1 — Domain core

- [ ] 1. Implement resource identity, catalog, starter data, stack rules, serialization, fixtures, and requirement validation.
  - Objective: deliver a standalone deterministic catalog/identity foundation and all eight provisional starter resources.
  - Files/search targets: `apps/weltraum-browser/src/resources/{ids,types,categories,catalog,starterCatalog,serialization,fixtures,index}.ts`; `tests/unit/resourceCatalog.test.ts`; reuse conventions from `src/core/hash.ts` without modifying it.
  - Acceptance: catalog scenarios 1–6 pass; IDs/numbers/duplicates/categories/stack rules validate at runtime; registration order does not affect canonical JSON/signature; requirements reject unknown IDs; no random/time/global registry.
  - Guidance: branded save-safe IDs, extensible category records, discriminated stack-rule unions, readonly cloned outputs, namespaced extensions, explicit provisional balance comments.
  - Skills/MCPs: project `AGENTS.md`, `subagent-driven-development`; no Unity MCP/editor.
  - Verification: `npm run test -- tests/unit/resourceCatalog.test.ts` from `apps/weltraum-browser`.
  - Report: changed files, exported API, starter values, checks run/results, blockers, risks, unverified items.
  - Stop/escalate: stop on any need to edit package/lock/Ship Builder/runtime/UI/Assets files or overlap with parallel work.

- [ ] 2. Implement generic container definitions/state/snapshots and container unit coverage.
  - Objective: derive canonical capacity/aggregate/summary/depletion data for all required container types through one model.
  - Files/search targets: `apps/weltraum-browser/src/resources/{types,containers,fixtures,index}.ts`; `tests/unit/resourceContainers.test.ts`.
  - Acceptance: scenarios 7–13 pass; stack order is signature-independent; mass/volume/totals/remaining capacity are derived; policy eligibility is generic; mission metadata and mining depletion are deterministic; inputs stay unchanged.
  - Guidance: reuse catalog APIs from task 1, canonicalize by stack ID, remove zero-quantity stacks from canonical state, validate max capacities/counts and policy arrays.
  - Skills/MCPs: project `AGENTS.md`, `subagent-driven-development`; no Unity MCP/editor.
  - Verification: `npm run test -- tests/unit/resourceContainers.test.ts`.
  - Report: changed files, container policy shapes, derived fields, checks/results, blockers, risks, unverified items.
  - Stop/escalate: do not add per-container engines or touch flight/mining gameplay/Ship Builder/forbidden paths.

- [ ] 3. Implement pure transfer engine and transfer/mining extraction unit coverage.
  - Objective: support deterministic explicit full/partial/rejected transfers with stable diagnostics and immutable revisions.
  - Files/search targets: `apps/weltraum-browser/src/resources/{types,transfer,containers,serialization,fixtures,index}.ts`; `tests/unit/resourceTransfer.test.ts` and focused reservoir extraction coverage.
  - Acceptance: scenarios 14–25 pass; every requested rejection code exists; capacity/policy/ownership/mission/sealed/revision checks are ordered; atomic rejection changes nothing; accepted revisions increment once; partial retained source ID is stable; target IDs deterministic/supplied; replay rejects.
  - Guidance: consume source candidates in canonical order, never merge metadata-incompatible stacks, compute capacity from both kg and m3, preserve legal/ownership/mission/condition/grade metadata, no clock/random/global state.
  - Skills/MCPs: project `AGENTS.md`, `subagent-driven-development`, `systematic-debugging` if tests fail; no Unity MCP/editor.
  - Verification: `npm run test -- tests/unit/resourceTransfer.test.ts` plus all three resource unit files.
  - Report: changed files, result/status/code behavior, commands/results, blockers, risks, unverified items.
  - Stop/escalate: stop if requirements require UI/economy/flight/mining gameplay/package changes or incompatible parallel edits.

## Phase 2 — Browser evidence and documentation

- [ ] 4. Add normal-page module smoke test, deterministic evidence, focused Browser docs, and complete review/verification.
  - Objective: prove Browser import compatibility and document the delivered contract/deferred seams without runtime integration.
  - Files/search targets: `tests/e2e/resource-cargo-core.spec.ts`; `evidence/browser-resource-cargo-inventory-core-v1{.md,-summary.json}`; `docs/browser-mainline/resource-cargo-inventory-core-v1.md`; permitted focused updates to `feature-intent-index.md` and `port-roadmap.md`; change-local `tests/**` artifacts.
  - Acceptance: normal `/` has no TestBridge; dynamic `/src/resources/index.ts` import runs full, partial, and mission-locked flows; deterministic signatures repeat; JSON parses; evidence records commands/results; docs list catalog, policies, codes, provisional balance, and deferred integrations; no runtime/UI changes.
  - Guidance: follow existing Playwright `process.cwd()/evidence` write conventions, no screenshot because no visual change, keep evidence deterministic and task-owned.
  - Skills/MCPs: project `AGENTS.md`, `playwright`/browser-debugger for evidence if needed, `devtoolbox-review`, `verification-before-completion`; no Unity MCP/editor.
  - Verification: required three focused unit commands, `npm run test`, `npm run build`, `npm run test:e2e -- tests/e2e/resource-cargo-core.spec.ts`, JSON parse, `git diff --check`, staged check if applicable, exact forbidden-status path check, allowlist audit, reviewer + reviewer-glm.
  - Report: changed files, test/build/Playwright results, evidence paths, review findings/fixes, blockers, remaining risks/unverified items, forbidden-path audit.
  - Stop/escalate: stop on package/lock/unity-legacy-final-2026-07:Assets/Ship Builder/runtime/UI/render/sim or existing-evidence modification; do not commit/push until orchestrator presents summary and user confirms.