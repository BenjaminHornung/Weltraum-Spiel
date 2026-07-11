# Tasks

## Phase 1: Deterministic registry
- [x] Implement canonical world chunk contracts, immutable registry operations, spatial queries, signatures, and focused unit tests.
  - Files: `apps/weltraum-browser/src/world/chunkRegistry.ts`, `apps/weltraum-browser/tests/unit/chunkRegistry.test.ts`
  - Verify: `npm run test -- tests/unit/chunkRegistry.test.ts`

## Phase 2: Streaming planner
- [x] Implement independent simulation residency/render LOD planning, budgets, hysteresis, transition events, canonical serialization/signatures, and focused unit tests.
  - Files: `apps/weltraum-browser/src/world/worldStreaming.ts`, `apps/weltraum-browser/tests/unit/worldStreaming.test.ts`
  - Verify: `npm run test -- tests/unit/worldStreaming.test.ts` and the existing world-frame/simulation/low-poly unit regressions.

## Phase 3: Browser scenario and evidence
- [ ] Implement the deterministic world-streaming scenario, query-gated TestBridge method, Playwright acceptance test, and required app evidence.
  - Files: `apps/weltraum-browser/src/world/worldStreamingScenario.ts`, `apps/weltraum-browser/src/test-harness/browserBridge.ts`, `apps/weltraum-browser/tests/e2e/world-chunk-streaming.spec.ts`, required evidence files.
  - Verify: targeted Playwright spec, repeated byte-equivalence, three observer positions, ordered transitions, budgets, floating-origin invariance, and normal-root TestBridge absence.

## Phase 4: Documentation and full verification
- [ ] Update Browser roadmap/intent documentation, create the DevToolbox test protocol, run all required unit/build/Playwright regressions, and prove forbidden paths remain unchanged.
  - Files: `docs/browser-mainline/port-roadmap.md`, `docs/browser-mainline/feature-intent-index.md`, `.devtoolbox/specs/changes/browser-world-chunk-registry-streaming-core-v1/tests/test-protocol.md`
  - Verify: full `npm run test`, `npm run build`, required Playwright regressions, JSON parse checks, `git diff --check`, staged diff check when applicable, and forbidden-path status/diff audit.
