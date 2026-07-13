# Tasks: browser-persistence-universe-time-event-core-v1

All tasks intentionally remain unchecked. DevToolbox MCP is `NOT RUN` because its restricted workspace root excludes this isolated Temp worktree. No task may be toggled or closed until implementation evidence exists and `tasks_completion_preflight` succeeds in an eligible workspace.

## Ownership and base

- Branch: `feature/browser-persistence-universe-time-event-core-v1`
- Recorded base: `origin/main` at `7e1d0237cdf272bfb759f26e2be8cdb3a760e15c`
- Product source: `apps/weltraum-browser/src/persistence/**`
- Unit tests: the six named `apps/weltraum-browser/tests/unit/persistence*.test.ts` files
- Browser/Evidence: the named persistence E2E spec and evidence files
- Documentation: `docs/browser-mainline/persistence-universe-time-event-core-v1.md`
- Spec: `.devtoolbox/specs/changes/browser-persistence-universe-time-event-core-v1/**`
- Approved exceptions: append only the persistence E2E filename to `apps/weltraum-browser/package.json` `test:e2e:core`; add the user-requested low-poly `apps/weltraum-browser/public/favicon.png` and its single `apps/weltraum-browser/index.html` link; no dependency, lockfile, other script, or other app-shell change.

## Phase 1: Spec and contract gate

- [ ] Validate the five spec artifacts and lock the public V1 contracts before product implementation.
  - Deliverables: proposal, design, normative spec, tasks, and test protocol in this change directory.
  - Acceptance: explicit 120 Hz/game-epoch/Mission-Time semantics, ID grammar/classification, strict V1 envelope, definition resolution, mobile state, generic migration fixture, events, exact mode matrix, canonical signatures, all 30 mandatory scenarios, E2E behavior, non-goals, allowlist, and stop rules are documented.
  - Verify: `git diff --check -- .devtoolbox/specs/changes/browser-persistence-universe-time-event-core-v1` plus manual requirement/scenario review.
  - Completion gate: leave unchecked until eligible DevToolbox status/validation and completion preflight have run.

## Phase 2: Time, identity, and schema foundation

- [ ] Implement stable IDs, explicit clocks, shared persistence types, strict SaveGame V1 schema/validation, fixtures, public exports, and focused tests.
  - Files: `src/persistence/ids.ts`, `time.ts`, `types.ts`, `saveSchema.ts`, `validation.ts`, `fixtures.ts`, `index.ts`; `tests/unit/persistenceUniverseTime.test.ts`; `tests/unit/persistenceSaveSchema.test.ts`.
  - Acceptance: pure 120 Hz advances and explicit rounding; independent Mission Time; fixed ID prefixes; deterministic fixture factory; duplicate rejection; strict unknown-field validation; JSON-pointer issues; explicit definition-version resolution; definition/mutable separation; finite mobile state; V1 future-version rejection; immutable outputs.
  - Verify: typecheck plus the two focused suites.

## Phase 3: Migration, event, mode, and canonical cores

- [ ] Implement the immutable migration registry, deterministic event queue, exact simulation-mode transition validator, independent persistence canonicalizer/signature wrapper, and focused tests.
  - Files: `src/persistence/migrations.ts`, `events.ts`, `simulationMode.ts`, `canonical.ts`, supporting exports/fixtures; `tests/unit/persistenceMigrations.test.ts`, `persistenceEvents.test.ts`, `persistenceSimulationMode.test.ts`, `persistenceCanonical.test.ts`.
  - Acceptance: only consecutive per-stage-validated migrations; neutral generic V1-to-V2 fixture without product V2; tick/ID event order and explicit acknowledgement idempotency; exact documented mode matrix; plain JSON validation; schema-aware unordered collection normalization; defensive deep freeze; direct `fnv1aHash` signature over canonical bytes.
  - Verify: typecheck plus the four focused suites and all cross-suite mandatory cases.

## Phase 4: Normal-route browser evidence and documentation

- [ ] Implement the browser acceptance scenario, deterministic evidence, and browser-mainline contract document.
  - Files: `tests/e2e/persistence-universe-time-event-core.spec.ts`; the two `evidence/browser-persistence-universe-time-event-core-v1*` files; `docs/browser-mainline/persistence-universe-time-event-core-v1.md`; user-approved `public/favicon.png` and its single `index.html` link.
  - Package exception: append only the new spec to `test:e2e:core` in `apps/weltraum-browser/package.json`; assert `package-lock.json` is byte-identical.
  - Acceptance: error listeners registered before normal `/`; `TestBridge` absent; dynamic persistence import; clock/save/event/mode/generic-migration/roundtrip scenario runs twice; bytes/signatures identical; evidence written only after success and contains no timestamp, duration, screenshot, random value, or machine path.
  - Verify: focused E2E twice, parse evidence JSON, compare repeated evidence bytes, and run `test:e2e:core`.

## Phase 5: Full verification, review, and delivery

- [ ] Run fresh focused/full verification and record exact results in `tests/test-protocol.md` and evidence.
  - Verify: `npm ci`, TypeScript typecheck, all six focused unit suites, focused E2E, full unit/build, `test:e2e:core`, `test:e2e:live`, `test:e2e:ui`, aggregate `test:e2e`, JSON/evidence checks, `git diff --check`, and allowlist/forbidden-path audits.
  - Acceptance: every exit code is inspected; unexpected failures are resolved or reported; package lock remains unchanged; only the exact package script append and user-approved favicon/app-shell files are present outside the original allowlist.
- [ ] Obtain independent read-only review of contracts, determinism, regression risk, security boundaries, and test evidence, then perform a fresh completion verification.
  - Acceptance: actionable findings are resolved and rerun; evidence, diff, and test protocol support Done independently of implementer claims.
- [ ] Complete eligible DevToolbox validation/evidence/preflight, toggle tasks only after successful preflight, commit, and push the feature branch without merging.
  - DevToolbox sequence when eligible: `workspace_prepare_for_agent`, `specs_get_status`, `tasks_load`, `execution_create`, `verify_run`, `tasks_completion_preflight`, then `tasks_toggle` only for evidence-backed tasks.
  - Planned commits:
    1. `#WELTRAUM-000 Specify persistence universe time and event core`
    2. `#WELTRAUM-000 Add persistence universe time and event core`
    3. `#WELTRAUM-000 Verify persistence universe time and event core`
  - Commit bodies: short English summary plus a `Changes:` list naming every included file.
  - Delivery: `git push -u origin feature/browser-persistence-universe-time-event-core-v1`; do not merge to `main`.

## Verification matrix

- Unit cases: all numbered Scenarios 01-30 in `specs/default/spec.md`.
- Browser: normal-route dynamic import, clean console/network, full scenario twice, canonical byte/signature equality, deterministic JSON/Markdown evidence.
- Regression: complete browser unit, build, and all configured E2E groups.
- Scope: diff allowlist, approved package-script and favicon/app-shell exceptions, byte-identical lockfiles, unchanged forbidden domain cores and Unity paths.
- Completion: fresh evidence, independent review, DevToolbox completion preflight, then task toggles.

## Safe stops

Stop and report without expanding scope if:

- `origin/main` or the worktree base no longer matches the recorded task context in a way that introduces a competing persistence core;
- the branch/worktree has unexpected ownership or conflicting changes;
- a contract requires a product decision absent from proposal/design/spec;
- implementation needs a change outside the owned paths or more than the exact package-script and favicon/app-shell exceptions;
- dependencies or a lockfile would change;
- browser errors require generic filtering or evidence cannot be deterministic;
- an existing domain core, runtime loop, production storage, offline progression, timewarp, or real V2 save schema would need modification; or
- DevToolbox tasks would be toggled before successful completion preflight.
