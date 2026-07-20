# Tasks: Browser Simulation Scheduler Core V1

- [x] Implement and deliver the deterministic simulation scheduler core V1.
  - Establish the public contracts, strict validation, deterministic bounded planner, fairness, explicit commands, CAS/idempotent result application, and eight neutral fixtures using only public Persistence authorities.
  - Add focused unit tests and the normal-route Playwright proof/config, generate byte-stable JSON/Markdown evidence, and document the public API and boundaries.
  - Run all required Node 22 verification, repeated E2E evidence-hash comparison, diff/scope/secret/package audits, independent reviews, and Completion Preflight.
  - Commit exactly `#WELTRAUM-000 Add deterministic simulation scheduler core` and push normally to `origin/feature/browser-simulation-scheduler-core-v1`; do not create a PR, merge, or archive.

- [x] Integrate current main and harden retry backoff for PR #35.
  - Preserve the complete current-main E2E grouping and assign `simulation-scheduler-core.spec.ts` exactly once without lockfile drift.
  - Reject `RetryableFailure` `AtTick` values that are not strictly future relative to both completion and the validated scheduler snapshot, with deterministic errors and no mutation.
  - Add focused regressions for boundary ticks, `None`, immutability, same-UniverseTime reselection, and deterministic error identity.
  - Run the requested serial Node 22 unit/full/build/E2E matrices, repeated focused evidence comparison, audits, DevToolbox verification/preflight, and exact-head review gate.
