# Browser Live Flight + Objective Integration v1 Evidence

Generated on integration branch `integration/browser-live-flight-objectives-v1` and updated from the final mainline objective-chain audit.

## Integrated Branches

Merge order:

1. `feature/browser-live-large-field-flight-acceptance-v1`
2. `feature/browser-large-field-navigation-objective-v1`

No merge conflicts were reported by Git. Both live E2E specs are present:

- `apps/weltraum-browser/tests/e2e/playable-large-field-live-flight.spec.ts`
- `apps/weltraum-browser/tests/e2e/large-field-navigation-objective.spec.ts`

## Mainline Objective Chain Audit - 2026-07-05

The final mainline merge also integrated `feature/browser-large-field-objective-chain-live-v1` after `integration/browser-live-flight-objectives-v1`.

Mainline merge order:

1. `integration/browser-live-flight-objectives-v1`
2. `feature/browser-large-field-objective-chain-live-v1`

No merge conflicts were reported by Git. All three live E2E specs are present on `main`:

- `apps/weltraum-browser/tests/e2e/playable-large-field-live-flight.spec.ts`
- `apps/weltraum-browser/tests/e2e/large-field-navigation-objective.spec.ts`
- `apps/weltraum-browser/tests/e2e/large-field-objective-chain-live.spec.ts`

All three live E2E specs ran against the normal product URL `/`; none used `/?testBridge=1`, and each asserted default TestBridge absence.

| Flow | Command | Result | Current evidence |
| --- | --- | --- | --- |
| Live flight acceptance | `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts` | Pass: 1 Chromium test, 42.2s | `apps/weltraum-browser/evidence/browser-live-large-field-flight-acceptance-v1.md` |
| Navigation objective HUD | `npm run test:e2e -- tests/e2e/large-field-navigation-objective.spec.ts` | Pass: 1 Chromium test, 41.9s | `apps/weltraum-browser/evidence/browser-large-field-navigation-objective-v1.md` |
| Objective chain live | `npm run test:e2e -- tests/e2e/large-field-objective-chain-live.spec.ts` | Pass: 1 Chromium test, 45.0s | `apps/weltraum-browser/evidence/browser-large-field-objective-chain-live-v1.md` |

Integrated outcomes:

- Live flight still reaches `Arrived at selected target` / `holding at target; new route ready` for `range-500m`; the final route action now reports `Next objective available`.
- The Range 500m objective reaches `Complete` with `next objective available`, proving the objective HUD did not regress completion handling.
- The objective chain completes Range 500m, unlocks Range 1000m, enters Range 1000m `Enroute`, and keeps Range 2500m visible as locked/future.

## Live Browser Acceptance

Both required live browser specs ran against the normal product URL `/`. Neither live spec uses `/?testBridge=1` or calls `window.TestBridge`; both assert TestBridge remains hidden on the default product URL.

| Flow | Command | Result | Evidence |
| --- | --- | --- | --- |
| Live flight acceptance | `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts` | Pass: 1 test, 40.7s live browser runtime | `apps/weltraum-browser/evidence/browser-live-large-field-flight-acceptance-v1.md` |
| Navigation objective HUD | `npm run test:e2e -- tests/e2e/large-field-navigation-objective.spec.ts` | Pass: 1 test, 41.0s live browser runtime | `apps/weltraum-browser/evidence/browser-large-field-navigation-objective-v1.md` |

Live flight acceptance selected `range-500m`, engaged autopilot from the player HUD, reduced HUD distance from `500.0 m` to `473.6 m`, and reached `Arrived at selected target` / `holding at target; new route ready`. After objective-chain integration the final route action correctly reports `Next objective available`.

Navigation objective acceptance selected `Reach Range 500m`, engaged autopilot from the player HUD, reached `Enroute`, then reached objective `Complete` at `1.5 m` with next action `next objective available`.

## Regression Verification

| Command | Result |
| --- | --- |
| `npm run test` | Pass: 14 files, 140 tests |
| `npm run build` | Pass; Vite reported the existing large chunk warning |
| `npm run test:e2e -- tests/e2e/playable-large-proving-ground.spec.ts` | Pass: 1 test |
| `npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts` | Pass: 2 tests |
| `npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts` | Pass: 3 tests |
| `npm run test:e2e -- tests/e2e/multi-obstacle-planner.spec.ts` | Pass: 2 tests |
| JSON parse check for changed regression JSON evidence | Pass: `autopilot-long-range-summary.json`, `browser-multi-obstacle-route-planner-v1-summary.json` |

## Screenshot Evidence

- `apps/weltraum-browser/evidence/live-large-field-before-engage.png`
- `apps/weltraum-browser/evidence/live-large-field-in-flight.png`
- `apps/weltraum-browser/evidence/live-large-field-arrival-or-progress.png`
- `apps/weltraum-browser/evidence/large-field-objective-ready.png`
- `apps/weltraum-browser/evidence/large-field-objective-enroute.png`
- `apps/weltraum-browser/evidence/large-field-objective-complete-or-progress.png`

## Guardrails

- No `Assets/**` changes were introduced by the committed integration diff; pre-existing local dirty `Assets/**` files remained uncommitted and untouched.
- No package files or lockfiles were modified.
- Demo Scout GLB and ProceduralFallback paths remain intact.
- No TestBridge exposure was added to the default product URL.
- No flight-core invariants were weakened: the integration did not snap ship position, zero velocity, relax terminal capture, or change planner/executor completion gates.
