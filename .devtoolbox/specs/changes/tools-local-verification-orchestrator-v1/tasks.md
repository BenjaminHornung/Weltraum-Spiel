# Tasks

Authorized implementation scope uses the underscore Python source path `tools/local_verification/**`, required by `python -m tools.local_verification`; tests remain under `tools/local-verification-tests/**`.

## 1. Implement deterministic models, profiles, and CLI planning/status surfaces

- [x] Objective: Create the package entry point, explicit versioned profile JSON, canonical plan schema/hash, path normalization, Git read-only inspection, and `status`, `plan`, `verify-git`, and `summarize` command surfaces.
- Files/search targets: `tools/local_verification/**`; inspect only nearby repository tool conventions as needed.
- Acceptance: Required fields and profile values are explicit; equivalent plans hash identically; CLI accepts documented commands; no destructive Git verbs exist in executable Git command construction.
- Guidance: Python standard library only; argv arrays; canonical JSON excludes runtime-only absolute paths; preserve exclusive scope.
- Skills/MCPs: `subagent-driven-development`, project `AGENTS.md`; DevToolbox purpose statement required.
- Verification: focused `python -m unittest` model/profile/CLI/Git tests and CLI help/status smoke.
- Report back: changed files, tests, blockers, risks, unverified behavior.
- Stop: stop on scope conflict, unclear schema, or need for non-standard dependency.

## 2. Implement resource coordination and owned process execution

- [x] Objective: Add atomic worktree/token/port reservations, pre/post port checks, process-group ownership, streaming logs, timeout/signal/Ctrl-C cleanup, and plan-authorized single diagnostic retry.
- Files/search targets: only `tools/local_verification/**` and its new tests.
- Acceptance: concurrency is bounded by profile; only owned process groups are terminated; no unrelated PID scanning/killing; no automatic retry; runtime metadata is noncanonical.
- Guidance: cross-platform standard library; explicit run IDs; `finally` cleanup; no real product commands in tests.
- Skills/MCPs: `subagent-driven-development`, `systematic-debugging` if failures arise.
- Verification: fake-process tests for timeout, Ctrl-C, port/token contention, streaming, retry authorization.
- Report back: changed files, tests, blockers, risks, unverified OS behavior.
- Stop: stop before any destructive Git/service/process action outside owned fake children.

## 3. Implement parsers, classification, redaction, summaries, docs, and complete unit suite

- [x] Objective: Parse Vitest/Playwright counts, compare expected counts, classify failures, redact secrets/paths, generate normalized summaries, document operations, and fill all required test scenarios.
- Files/search targets: `tools/local_verification/**`, `tools/local-verification-tests/**`, `docs/tools/local-verification-orchestrator-v1.md`.
- Acceptance: all eight classifications are supported; path/secret redaction is tested; summaries derive claims from plan hash, exit codes, and counts; docs explain safety and examples; Windows/POSIX path tests exist.
- Guidance: synthetic logs only; no evidence directory; no package/CI edits.
- Skills/MCPs: `subagent-driven-development`, project instructions.
- Verification: `python -m unittest discover -s tools/local-verification-tests -v`; `python -m compileall tools/local_verification tools/local-verification-tests`; required CLI smokes.
- Report back: changed files, full checks, blockers, risks, unverified items.
- Stop: stop on scope expansion or any need to start a real product matrix.

## 4. Review and fix concrete findings

- [x] Objective: Run independent `reviewer` and `reviewer-glm` reviews for correctness, safety, scope, regression, reuse, and test gaps; implement bounded fixes through the correct worker lane.
- Files/search targets: diff limited to approved scope.
- Acceptance: findings first with file references; all concrete high/medium findings fixed and focused review rerun; no out-of-scope files changed.
- Skills/MCPs: `devtoolbox-review`, `maintainability-decay-review`, `requesting-code-review`.
- Verification: focused tests for each fix plus diff/scope audit.
- Report back: findings, fixes, remaining risks, unverified items.
- Stop: escalate on conflicting reviewers, security/data-loss concern, or scope expansion.

## 5. Fresh verification, completion preflight, commit, and push

- [x] Objective: Fresh Python unit tests, compileall, CLI smoke, verification review, DevToolbox completion preflight, exact commit, and non-force push.
- Files/search targets: approved scope and Git metadata only.
- Acceptance: required checks pass; completion preflight permits closure; commit message is `#WELTRAUM-000 Add local verification orchestrator`; branch is pushed without force; no PR, merge, or archive.
- Skills/MCPs: `verification-before-completion`, `commit-message`, `devtoolbox-specs-execution`.
- Verification: `python -m unittest discover -s tools/local-verification-tests -v`; `python -m compileall tools/local_verification tools/local-verification-tests`; smoke all five CLI commands with temporary/local artifacts.
- Report back: commit SHA, push result, exact checks, remaining risk.
- Stop: do not commit/push if scope audit or verification fails.
