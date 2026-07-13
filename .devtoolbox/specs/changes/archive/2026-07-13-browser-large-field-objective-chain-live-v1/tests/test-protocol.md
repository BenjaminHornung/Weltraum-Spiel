# Test Protocol

## Focused Implementation Checks

- `npm run test -- tests/unit/simulation.test.ts tests/unit/statusHud.test.ts`
- `npm run test:e2e -- tests/e2e/large-field-objective-chain-live.spec.ts`

## Required Final Verification

- `npm run test:e2e -- tests/e2e/large-field-objective-chain-live.spec.ts`
- `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts`
- `npm run test:e2e -- tests/e2e/large-field-navigation-objective.spec.ts`
- `npm run test:e2e -- tests/e2e/playable-large-proving-ground.spec.ts`
- `npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts`
- `npm run test`
- `npm run build`
- `git diff --check`
- `git status --short -- Assets package.json package-lock.json apps/weltraum-browser/package.json apps/weltraum-browser/package-lock.json`

## Evidence

- `apps/weltraum-browser/evidence/browser-large-field-objective-chain-live-v1.md`
- `apps/weltraum-browser/evidence/objective-chain-ready.png`
- `apps/weltraum-browser/evidence/objective-chain-500m-enroute.png`
- `apps/weltraum-browser/evidence/objective-chain-500m-complete.png`
- `apps/weltraum-browser/evidence/objective-chain-1000m-ready-or-enroute.png`

## Mainline Merge Audit - 2026-07-05

Mainline merge order:

1. `integration/browser-live-flight-objectives-v1`
2. `feature/browser-large-field-objective-chain-live-v1`

No merge conflicts were reported by Git. All three live E2E specs are present on `main` and ran against the normal product URL `/` without `/?testBridge=1`.

| Command | Result |
| --- | --- |
| `npm run test` | Pass: 14 files, 140 tests |
| `npm run build` | Pass; Vite reported the existing large chunk warning |
| `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts` | Pass: 1 Chromium test, 42.2s |
| `npm run test:e2e -- tests/e2e/large-field-navigation-objective.spec.ts` | Pass: 1 Chromium test, 41.9s |
| `npm run test:e2e -- tests/e2e/large-field-objective-chain-live.spec.ts` | Pass: 1 Chromium test, 45.0s |
| `npm run test:e2e -- tests/e2e/playable-large-proving-ground.spec.ts` | Pass: 1 Chromium test, 3.4s |
| `npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts` | Pass: 2 Chromium tests, 8.0s |
| `npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts` | Pass: 3 Chromium tests, 4.7s |
| `npm run test:e2e -- tests/e2e/multi-obstacle-planner.spec.ts` | Pass: 2 Chromium tests, 3.4s |
| `git diff --check` | Pass; only existing CRLF conversion warnings were reported |
| `git diff --cached --check` | Pass |

Objective-chain evidence from the integrated run:

| Field | Value |
| --- | --- |
| Product URL | `/` |
| TestBridge | Hidden/absent in default product URL |
| Range 500m result | `Complete` at `1.1 m` |
| Range 1000m result | `Enroute` with distance reduced from `501.0 m` to `489.6 m` |
| Range 2500m state | Visible as locked/future until earlier prerequisites complete |
| Guardrails | No package files touched; pre-existing unrelated `Assets/**` dirty/untracked files remained unstaged and untouched |
