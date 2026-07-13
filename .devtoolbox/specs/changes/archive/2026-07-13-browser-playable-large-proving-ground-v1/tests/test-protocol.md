# Test Protocol

Date: 2026-07-05

## Commands

All npm commands were run from `apps/weltraum-browser`.

| Command | Result |
| --- | --- |
| `npm run test -- tests/unit/playableLargeProvingGroundWorld.test.ts` | Passed: 1 file, 4 tests |
| `npm run test -- tests/unit/autopilotProvingGroundCourses.test.ts tests/unit/autopilotSpeedProfiles.test.ts tests/unit/autopilotCourseMetrics.test.ts tests/unit/provingGroundScenarios.test.ts` | Passed: 4 files, 31 tests |
| `npm run test` | Passed: 14 files, 134 tests |
| `npm run build` | Passed; Vite emitted the existing large chunk warning |
| `npm run test:e2e -- tests/e2e/playable-large-proving-ground.spec.ts` | Passed: 1 test |
| `npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts` | Passed: 3 tests |
| `npm run test:e2e -- tests/e2e/multi-obstacle-planner.spec.ts` | Passed: 2 tests |
| `node -e "const fs=require('fs'); for (const file of ['evidence/autopilot-long-range-summary.json','evidence/browser-multi-obstacle-route-planner-v1-summary.json']) { JSON.parse(fs.readFileSync(file,'utf8')); console.log(file + ' OK'); }"` | Passed: both JSON files parsed |
| `git diff --check` | Passed; Git reported line-ending warnings for pre-existing and touched files only |
| `git status --short -- Assets package.json package-lock.json apps/weltraum-browser/package.json apps/weltraum-browser/package-lock.json` | Package files clean; pre-existing unrelated `Assets/**` dirty files remain in the worktree |

## Evidence

- `apps/weltraum-browser/evidence/browser-playable-large-proving-ground-v1.md`
- `apps/weltraum-browser/evidence/playable-large-field-overview.png`
- `apps/weltraum-browser/evidence/playable-large-field-1000m-target.png`
- `apps/weltraum-browser/evidence/playable-large-field-2500m-target.png`

The normal runtime preview labels recorded by the E2E were `514.1 m`, `1.0 km`, and `2.5 km`.
