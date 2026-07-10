# Focused Test Protocol

## Trace

- Before behavior was preserved in `apps/weltraum-browser/evidence/browser-multi-obstacle-2500m-trace.json` before editing `executor.ts`.
- The trace records terminal handoff tick 4013, terminal braking tick 4275, target crossing tick 4455, first divergence-threshold crossing tick 4482, divergence tick 4483, and the final 100 ticks.

## Completed Verification Matrix

From `apps/weltraum-browser`:

| Command | Result |
| --- | --- |
| `npm run test -- tests/unit/autopilotSpeedProfiles.test.ts` | PASS, 4/4 |
| `npm run test -- tests/unit/executor.test.ts` | PASS, 26/26 |
| `npm run test -- tests/unit/multiObstaclePlanner.test.ts` | PASS, 9/9 |
| `npm run test -- tests/unit/provingGroundScenarios.test.ts tests/unit/autopilotCourseMetrics.test.ts` | PASS, 26/26 |
| `npm run test` | PASS, 147/147 across 14 files |
| `npm run test:e2e -- tests/e2e/multi-obstacle-2500m-execution.spec.ts` | PASS, 2/2 |
| `npm run test:e2e -- tests/e2e/multi-obstacle-planner.spec.ts` | PASS, 2/2 |
| `npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts` | PASS, 3/3 |
| `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts` | PASS, 1/1 |
| `npm run build` | PASS, with the existing Vite chunk-size warning |

The exact 2500 m course now reports `Pass / Arrived`, final distance 1.6702 m, final speed 0.4969 m/s, settled distance 1.2315 m, settled speed 0.3847 m/s, 11.8833 m minimum clearance, stable `ab9e1027` plan hash, no replan, and no failure or invalidation reasons.

The direct 2500 m Fast settling regression is also closed: first arrival 1.6749 m / 0.4986 m/s, 30-tick settled 1.2349 m / 0.3858 m/s. Capture-to-holding now requires the shared PD command not to add kinetic energy.

## Final Verification State

Independent verification passed all nine required commands. Playwright used bundled Chromium successfully; no fallback was required. The only warning was the existing Vite build chunk-size warning.
