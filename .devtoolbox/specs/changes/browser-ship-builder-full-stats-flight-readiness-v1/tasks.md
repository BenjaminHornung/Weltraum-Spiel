# Tasks: Browser Ship Builder Full Stats and Flight Readiness V1

Original implementation base SHA: `7e1d0237cdf272bfb759f26e2be8cdb3a760e15c`.
The final PR scope is audited against current `origin/main` after synchronizing it.

## Shared execution contract

All changes stay inside the explicit request allowlist. `STARTER_CATALOG` remains
`5aaa27fd`; `package.json` may differ only by appending the named Ship Builder spec
to `test:e2e:core`, while package lockfiles, Unity, UI, runtime, combat, renderer,
flight, navigation, resource, celestial, settings, and test-harness files may not
change relative to current `origin/main`. Each task requires fresh verification,
`tasks_completion_preflight`, and only then `tasks_toggle`.

## Phase 1: Contracts and canonical policy

- [x] Add optional typed propulsion metadata, stat availability/unit envelopes, preview/policy factories, canonical projections, public exports, and legacy starter-signature guards.
  - Owned files: `src/ship-builder/{types,catalog,statCanonical,index}.ts`, focused unit tests.
  - Verify: `npx tsc -p tsconfig.json` and focused catalog/full-stat tests.

## Phase 2: Full stat aggregation

- [x] Implement deterministic mass preview, loaded COM, thrust/acceleration, RCS force/torque, delta-v/burn time, cargo, weapon, thrust-axis/offset, braking, and power/heat placeholder reports.
  - Owned files: `src/ship-builder/shipStats.ts` and focused stat/RCS tests.
  - Verify: `shipBuilderFullStats.test.ts` and `shipBuilderRcsAuthority.test.ts`.

## Phase 3: Diagnostics and readiness

- [x] Implement stable handling diagnostics/fix codes, gameplay-AABB hard-overlap, and Draft/TestFlight/Active readiness with signed immutable reports.
  - Owned files: `src/ship-builder/{handlingDiagnostics,flightReadiness}.ts` and focused diagnostic/readiness tests.
  - Verify: `shipBuilderHandlingDiagnostics.test.ts` and `shipBuilderFlightReadiness.test.ts`.

## Phase 4: Browser evidence and documentation

- [x] Add the normal-route Vite E2E, deterministic JSON/Markdown evidence, and browser-mainline contract document.
  - Owned files: the single new E2E, the two task-prefixed evidence files, and
    `docs/browser-mainline/ship-builder-full-stats-flight-readiness-v1.md`.
  - Integration dependency: retain and assert the current mainline `/favicon.png` declaration.
  - Verify: focused Playwright test; no TestBridge, console, request, or HTTP failures.

## Phase 5: Regression and handoff

- [x] Run the full protocol, exact current-target allowlist/import/signature audits, fresh review and DevToolbox verification; synchronize current `main`, push the feature branch, and require green PR checks before any separately authorized merge.
  - Verify: every command in `tests/test-protocol.md`, `git diff --check`, clean scope audit, reviewer and verification-reviewer approval.
  - Commit: `#WELTRAUM-000 Add ship builder full stats and flight readiness`.
