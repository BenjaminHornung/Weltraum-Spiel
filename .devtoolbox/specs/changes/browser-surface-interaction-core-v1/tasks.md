# Tasks: Browser Surface Interaction Core v1

An early parent availability check looked only for a DevToolbox CLI/resources, so the historical pre-dispatch records were not created and are not backfilled. The registered DevToolbox MCP tools worked later: `workspace_discover`, `specs_get_status`, and `specs_validate` succeeded for this four-task change. Real executions are `be54107d7ec54203b17cb80641eba52c`, `9766201d66cb419686ccaf0160e0fc0e`, and fallback reconciliation execution `bbcaada1b762441896293be33e2db406`. All task checkboxes remain open because the parent owns completion preflights and toggles.

## Phase 1 — Deterministic contracts and evaluation

- [x] 1. Implement public contracts, validation, canonical serialization, hashing, and deterministic interaction evaluation.
  - Objective: deliver the renderer/UI-independent domain boundary and `evaluateInteraction(candidate, context)` with exact verbs, result states, closed reasons, precedence, and target tie-breaking.
  - Files/search targets: create/reuse only `apps/weltraum-browser/src/interaction/**`; add `tests/unit/interaction*.test.ts`; search `apps/weltraum-browser/src/core/**` for existing canonical/hash/immutability conventions before adding local equivalents; do not modify searched files outside the interaction allowlist.
  - Acceptance criteria: all minimum contracts are exported; verbs are exactly the eleven specified; evaluation returns only Allowed/Blocked/Unavailable; every closed block reason and precedence layer is covered; stable target ID is the final tie-break; unknown verbs/capabilities and malformed/non-finite values fail closed; equivalent inputs have stable serialization/hashes; inputs remain unchanged and outputs are frozen; no Three/DOM/Date/Random imports or calls.
  - Implementation guidance: use branded stable IDs, integer revisions, readonly discriminated unions, explicit world/physics-evaluated distance/LOS/reachability/focus fields without positions, a fixed check pipeline, canonical ordering, and existing local utilities where their contracts fit.
  - Required skills/MCPs: project `AGENTS.md`, `subagent-driven-development`; `systematic-debugging` only for failures; no Unity MCP/editor and no DevToolbox execution record from a subagent.
  - Verification command/browser scenario: from `apps/weltraum-browser`, run `npx tsc -p tsconfig.json` and focused `npm run test -- tests/unit/interaction*.test.ts --maxWorkers=1`; include cases 1–4, 10–11, and 13–17 from `tests/test-protocol.md`.
  - Report-back format: changed files, exported contracts, precedence/tie-break behavior, reuse decisions, exact commands/results, blockers, risks, unverified items, and forbidden-path audit.
  - Stopping rule: stop and return to the parent on any need for architecture outside the approved contract, edits outside owned paths, UI/world/Cargo/Persistence integration, package/config changes, or conflicting ownership.

## Phase 2 — Tick sessions and atomic completion

- [x] 2. Implement pure start, advance, cancel, and complete behavior plus deterministic mutation intent/results.
  - Objective: provide integer-tick hold progression and interruption semantics that complete only against exact locked authority and return externally applicable atomic intent without applying mutations.
  - Files/search targets: `apps/weltraum-browser/src/interaction/**`; `tests/unit/interaction*.test.ts`; reuse task 1 contracts and local canonical helpers; search only the interaction module and approved test targets for integration points.
  - Acceptance criteria: Allowed decisions expose required hold and all interruption fields; hold tick 0 works; progress is integer, monotonic, bounded, and never completes early; movement/damage/focus policy interruptions are deterministic; stale target or actor revisions fail closed; cancellation/rejection/no-op has no mutation; successful completion returns expected revisions, finite nonnegative canonical energy/resources, generated capability/discovery facts, semantic events, result code, and next action; outputs are immutable.
  - Implementation guidance: lock actor/target IDs and revisions in sessions, require explicit ticks and completion requests, model interruption as data, separate completion intent from external application, and never read clocks or hide progress.
  - Required skills/MCPs: project `AGENTS.md`, `subagent-driven-development`; `systematic-debugging` if focused tests fail; no Unity MCP/editor or DevToolbox subagent records.
  - Verification command/browser scenario: run focused Interaction units with `--maxWorkers=1`, covering cases 5–13 and 15–17 in `tests/test-protocol.md`, then `npx tsc -p tsconfig.json`.
  - Report-back format: changed files, session transition table, mutation/no-op shape, commands/results, blockers, risks, unverified items, and scope audit.
  - Stopping rule: stop if completion would mutate world/inventory state, use wall clock/randomness, require positions/raycast/animation, or touch any forbidden path.

## Phase 3 — Browser proof, evidence, and documentation

- [x] 3. Add exhaustive unit coverage, normal-route browser proof, deterministic evidence, and focused documentation.
  - Objective: prove all 18 mandatory cases and the locked-door/resource-node/repair-terminal scenario through the real Browser module loader without TestBridge authority or presentation changes.
  - Files/search targets: `tests/unit/interaction*.test.ts`; `tests/e2e/surface-interaction-core.spec.ts`; `apps/weltraum-browser/evidence/browser-surface-interaction-core-v1*`; one focused file under `docs/browser-mainline/`; change-local `tests/**`; search existing E2E/evidence fixtures for normal-route dynamic-import and deterministic file-writing conventions without editing them.
  - Acceptance criteria: the 18 cases in `tests/test-protocol.md` are explicitly covered; `/` loads normally and lacks TestBridge authority; dynamic import exercises a locked cargo door, resource node, repair terminal, scanner+cutter actor, allowed Scan, insufficient-energy Extract, hold-to-open, and stale completion rejection; JSON evidence is `apps/weltraum-browser/evidence/browser-surface-interaction-core-v1.json` and Markdown evidence is `apps/weltraum-browser/evidence/browser-surface-interaction-core-v1.md`; both are timestamp-free; no screenshot; the E2E is not added to a CI group.
  - Implementation guidance: use normal Vite module loading, deterministic fixture IDs/ticks/revisions, task-prefixed evidence, and documentation that distinguishes the pure foundation from deferred runtime/UI/world mutation integration.
  - Required skills/MCPs: project `AGENTS.md`, `playwright`, `verification-before-completion`; no Unity MCP/editor; use browser-debugger only if the focused scenario fails.
  - Verification command/browser scenario: `npm run test -- tests/unit/interaction*.test.ts --maxWorkers=1`; start/use the project-supported server on port 5201 and run the focused `tests/e2e/surface-interaction-core.spec.ts`; parse generated JSON and inspect Markdown for timestamps.
  - Report-back format: changed files, case-to-test mapping, browser scenario result, evidence/docs paths, TestBridge assertion, commands/results, blockers, risks/unverified items, and forbidden-path audit.
  - Stopping rule: stop on any need to alter runtime/UI/main/style/CI groups, use TestBridge as authority, add screenshots, or overwrite unrelated evidence.

## Phase 4 — Full verification, review, and delivery

- [x] 4. Run the Node 22 verification matrix, scope/security audits, independent reviews, and completion preflight.
  - Objective: establish fresh release-quality evidence for the bounded interaction core, reach verified delivery readiness, and obtain a successful completion preflight when available.
  - Files/search targets: all task-owned paths listed above; inspect `git status`/`git diff`; scan changed source and dependency graph for forbidden imports, secrets, and out-of-scope files; no implementation edits except fixes within owned paths for concrete failures or review findings.
  - Acceptance criteria: Node 22 is active; install, TypeScript, focused/all units, build, focused E2E, diff, import/scope/secret scans pass; reviewer and reviewer-GLM have no unresolved material findings; DevToolbox completion preflight is attempted only if available and its actual result is recorded. The exact commit `#WELTRAUM-000 Add surface interaction core` and non-force same-branch push are parent-owned post-task delivery actions already authorized by the user, not prerequisites for marking Task 4 complete; no PR, merge, archive, or E2E CI-group edit.
  - Implementation guidance: run serial focused tests before broader tests, preserve timestamp-free evidence, restore unrelated generated changes, fix only confirmed in-scope defects, and never fabricate DevToolbox IDs/results.
  - Required skills/MCPs: `verification-before-completion`, `requesting-code-review`, `devtoolbox-review`, reviewer plus independent reviewer-GLM; no Unity MCP/editor.
  - Verification command/browser scenario: with Node 22 from `apps/weltraum-browser`, run `npm ci`; `npx tsc -p tsconfig.json`; focused Interaction units `--maxWorkers=1`; all units `--maxWorkers=4`; `npm run build`; focused Playwright E2E on port 5201; then repository-root `git diff --check`, forbidden-import scan, exact allowlist/scope scan, secret scan, reviewer checks, and completion preflight when available.
  - Report-back format: changed files, Node version, command-by-command results, E2E/evidence paths, scan findings, review findings/fixes, DevToolbox availability/result, delivery-readiness status, blockers, and remaining risks/unverified items.
  - Stopping rule: stop and return any unresolved gate or review to the parent; leave the authorized exact commit and non-force same-branch push to the parent after Task 4 completion; stop before PR/merge/archive, force push, config/CI changes, or any out-of-scope fix.
