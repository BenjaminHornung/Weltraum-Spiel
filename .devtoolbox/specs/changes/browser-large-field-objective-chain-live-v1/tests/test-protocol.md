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
