# Tasks: browser-live-world-presentation-truth-v1

## Task 1 — Pure contract + telemetry unit layer

- [x] Implement and verify `worldPresentation` adapter contract from telemetry snapshots, deterministic hashing/signature, and target/route/obstacle shape without render writes.
  - Execution:
    - Create/update `apps/weltraum-browser/src/world/worldPresentation.ts`.
    - Write focused tests in `apps/weltraum-browser/tests/unit/worldPresentation.test.ts`.
    - Keep route ID/sourcePlanHash, signature, and sorted deterministic ordering in contract code.
  - Verification:
    - `mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task1-pure-contract"`
    - `mcp__servicerunner__.verify_plan`
    - `mcp__servicerunner__.verify_run`
    - `npm run test -- tests/unit/worldPresentation.test.ts`
    - `mcp__servicerunner__.tasks_completion_preflight`
    - `mcp__servicerunner__.tasks_toggle`
  - Commit: `Define telemetry presentation contracts and unit coverage`

## Task 2 — Renderer + DebugScene contract seam

- [x] Implement `worldPresentationRenderer` lifecycle and `DebugScene` integration as projection-only rendering for truth and decorative separation.
  - Execution:
    - Create `apps/weltraum-browser/src/render/three/worldPresentationRenderer.ts`.
    - Update `apps/weltraum-browser/src/render/three/debugScene.ts` adapter read points.
    - Implement and run `apps/weltraum-browser/tests/unit/worldPresentationRenderer.test.ts`.
  - Verification:
    - `mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task2-renderer-seam"`
    - `mcp__servicerunner__.verify_plan`
    - `mcp__servicerunner__.verify_run`
    - `npm run test -- tests/unit/worldPresentation.test.ts tests/unit/worldPresentationRenderer.test.ts`
    - `mcp__servicerunner__.tasks_completion_preflight`
    - `mcp__servicerunner__.tasks_toggle`
  - Commit: `Add world presentation renderer and debug scene contract`

## Task 3 — NavigationMapSnapshot truth reconciliation

- [x] Reconcile `WorldPresentationSnapshot` with `TelemetrySnapshot.navigationMap` as the only spatial truth and bind all fourteen low-poly world entity slots by exact map entity ID.
  - Execution:
    - Require `telemetry.navigationMap` in `buildWorldPresentationSnapshot` and remove spatial fallbacks.
    - Project ship, target, canonical route, obstacles, entity position, chunk residence, render LOD, and presentation key from the map snapshot; classify `Ambient`/`Landmark` only from the exact fixed entity-ID set without changing `NavigationMapSnapshot`.
    - Keep only velocity, executor lifecycle, preview admission, and arrival metadata as raw telemetry enrichment.
    - Bind the eight landmark and six ambient low-poly slots to their map entity IDs; zero-scale missing, dormant, or `Culled` entries.
    - Restrict normal canvas attributes to states/counts and query-gate complete IDs, hashes, segments, and signatures.
  - Verification:
    - `mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task3-navigation-map-reconciliation"`
    - `mcp__servicerunner__.verify_plan`
    - `mcp__servicerunner__.verify_run`
    - `npm run test -- tests/unit/worldPresentation.test.ts tests/unit/worldPresentationRenderer.test.ts`
    - `npm run test:e2e -- tests/e2e/browser-navigation-map-world-truth.spec.ts`
    - `mcp__servicerunner__.tasks_completion_preflight`
    - `mcp__servicerunner__.tasks_toggle`
  - Commit: `#WELTRAUM-000 Reconcile world presentation with navigation map truth`

## Task 4 — Playwright evidence + docs capture

- [ ] Add E2E evidence suite and final docs entry for normal `/` mode and query-gated test bridge observations.
  - Execution:
    - Add `apps/weltraum-browser/tests/e2e/live-world-presentation-truth.spec.ts` and screenshot capture.
    - Write `docs/browser-mainline/live-world-presentation-truth-v1.md` with evidence references.
    - Confirm `?testBridge=1` evidence is separated from base `/` route target visibility assertions.
  - Verification:
    - `mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task4-evidence"`
    - `mcp__servicerunner__.verify_plan`
    - `mcp__servicerunner__.verify_run`
    - `npm run test:e2e -- tests/e2e/live-world-presentation-truth.spec.ts`
    - `mcp__servicerunner__.tasks_completion_preflight`
    - `mcp__servicerunner__.tasks_toggle`
  - Commit: `#WELTRAUM-000 Add live world presentation truth evidence`

## Task 5 — Review + full regression finalization

- [ ] Review and close implementation, execute full regression and scope validation, and produce final rebase-ready state.
  - Execution:
    - Execute full command set in `tests/test-protocol.md`.
    - Run explicit allowlist forbidden-path validation including evidence/test/render/world files required by this change.
    - Resolve regressions and finalize task evidence before full regression is marked complete.
  - Verification:
    - `mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task5-full-regression"`
    - `mcp__servicerunner__.verify_plan`
    - `mcp__servicerunner__.verify_run`
    - `npm run test`
    - `npm run build`
    - `npm run test:e2e -- tests/e2e/live-world-presentation-truth.spec.ts`
    - `npm run test:e2e -- tests/e2e/browser-navigation-map-world-truth.spec.ts`
    - `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts`
    - `npm run test:e2e -- tests/e2e/playable-large-proving-ground.spec.ts`
    - `npm run test:e2e -- tests/e2e/normal-runtime-functional-planner.spec.ts`
    - `npm run test:e2e -- tests/e2e/debug-scene.spec.ts`
    - `npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts`
    - `npm run test:e2e -- tests/e2e/world-chunk-streaming.spec.ts`
    - `npm run test:e2e -- tests/e2e/multi-obstacle-planner.spec.ts`
    - `git diff --check`
    - `mcp__servicerunner__.tasks_completion_preflight`
    - `mcp__servicerunner__.tasks_toggle`
  - Commit: `#WELTRAUM-000 Complete live world presentation truth verification`

## Progress rule
- Each task must only be marked done after implementation, `verify_run`, and its listed verification evidence succeed.
- Reload `tasks.md` before completion calls and use the task's current `sourceLine`.
- `tasks_completion_preflight` MUST pass before `tasks_toggle`; create exactly one task commit only after the toggle succeeds.
