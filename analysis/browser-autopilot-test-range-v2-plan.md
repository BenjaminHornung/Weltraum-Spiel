# Browser Autopilot Test Range v2 Plan

Branch: `analysis/browser-autopilot-test-range-v2-plan`  
Change: `browser-autopilot-test-range-v2`  
Scope: analysis/spec only; no Browser source, Browser tests, Browser evidence JSON/PNG, package files, or Unity assets were changed.

## Goal

Define an expanded Browser Autopilot proving-ground/test range that can be implemented after the parallel Autopilot lifecycle/jitter and UI branches are merged. The v2 range should stress longer routes, higher start speeds, lateral/tangential velocity, tighter obstacles, authority/fuel limits, midcourse disturbances, speed profiles, and fail-closed replanning contracts without weakening the existing terminal-capture and no-silent-replan invariants.

## Sources Inventoried

Browser current-state sources:

- `apps/weltraum-browser/src/world/provingGroundWorld.ts`
- `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts`
- `apps/weltraum-browser/src/test-harness/scenarios.ts`
- `apps/weltraum-browser/src/test-harness/scenarioRunner.ts`
- `apps/weltraum-browser/src/flight/executor.ts`
- `apps/weltraum-browser/src/flight/flightController.ts`
- `apps/weltraum-browser/src/navigation/planners.ts`
- `apps/weltraum-browser/src/navigation/validation.ts`
- `apps/weltraum-browser/tests/unit/provingGroundScenarios.test.ts`
- `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts`
- `apps/weltraum-browser/tests/e2e/autopilot-terminal-capture.spec.ts`
- `apps/weltraum-browser/evidence/browser-autopilot-terminal-capture-v1.md`
- `apps/weltraum-browser/evidence/autopilot-terminal-capture-telemetry.json`
- `docs/browser-mainline/port-roadmap.md`
- `docs/browser-mainline/known-unity-bug-traps.md`
- `docs/current-prototype-state.md`

Unity/reference-only sources:

- `Assets/Tests/PlayMode/PrototypeAutopilotProvingGroundPlayModeTests.cs`
- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
- `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`
- `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`

> [!IMPORTANT]
> The current `main` already contains an initial Browser-native v2 course catalog, runner metrics, unit tests, and an E2E spec. This package treats those files as current inventory and a conflict risk for the next implementation agent, not as files to edit in this planning branch.

## 1. Current Browser Test Stand Inventory

### Current deterministic Browser harness scenarios

`apps/weltraum-browser/src/test-harness/scenarios.ts` defines 9 deterministic harness scenarios:

| Scenario | Planner | Expected contract |
| --- | --- | --- |
| `direct-local-arrival` | `DirectLocal` | Arrives at near waypoint; no replan; plan hash preserved. |
| `obstacle-avoidance-route` | `ObstacleAvoidanceLocal` | Keeps executing an avoidance route; avoidance segment required; no replan; plan hash preserved. |
| `insufficient-fuel` | `DirectLocal` | Fails closed as `OutOfFuel`; `FuelDepleted`; replan required; plan hash preserved. |
| `no-authority` | `DirectLocal` | Fails closed as `NoAuthority`; `AutopilotUnavailable`; plan hash preserved. |
| `no-main-thrusters` | `DirectLocal` | Fails closed as `NoAuthority`; `MainThrustersUnavailable`; plan hash preserved. |
| `brake-reserve-insufficient` | `DirectLocal` | Fails closed as `BrakeReserveInsufficient`; fuel/brake reason codes visible. |
| `off-route-divergence` | `DirectLocal` | Midcourse position offset causes `Diverged`, `OffLockedRoute`, `routeValid=false`; no plan replacement. |
| `locked-plan-hash-preservation` | `DirectLocal` | Route continues executing with stable locked `planHash`. |
| `explicit-replan-required-signal` | `ObstacleAvoidanceLocal` | Divergence surfaces `replanRequired=true` without replacing the locked plan. |

### Current Browser-native proving-ground v2 courses already present on main

`apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts` currently defines 11 additive courses:

| Course | Category fit | Outcome | Notes |
| --- | --- | --- | --- |
| `direct-long` | Basic / speed-profile baseline | `Pass` | Long route with terminal capture and fuel cap. |
| `s-curve-obstacles` | Obstacle | `KnownStress` | Multi-obstacle stress; current planner only detours first blocking obstacle. |
| `narrow-corridor` | Obstacle | `KnownStress` | Tighter than one-obstacle detour support. |
| `offset-gates` | Obstacle | `Pass` | Offset two-obstacle transit should not require replan. |
| `target-behind-obstacle` | Obstacle | `Pass` | Single blocking obstacle, current supported avoidance shape. |
| `target-near-obstacle` | Obstacle | `Pass` | Target envelope remains outside obstacle safety radius. |
| `high-initial-speed` | Basic | `Pass` | Starts at `26 m/s`; terminal speed remains gate. |
| `lateral-initial-velocity` | Basic / disturbance-like | `Pass` | Starts with lateral velocity `(4, 12, 0)`. |
| `low-authority-terminal` | Authority/Fuel | `Pass` | Low authority is represented by high mass, not global acceleration tuning. |
| `low-fuel-long-route` | Authority/Fuel | `ExpectedFail` | Requires `FuelInsufficient`; fail-closed expected. |
| `off-route-disturbance-midcourse` | Disturbance | `ExpectedFail` | Position disturbance requires `OffLockedRoute` without silent replan. |

### Current Browser targets

`apps/weltraum-browser/src/world/provingGroundWorld.ts` exposes three standard proving-ground targets:

| Target | Kind | Position | Arrival envelope |
| --- | --- | --- | --- |
| `arrival-near` | `Waypoint` | `(1.5, 0, 0)` | radius `2`, `NoStopRequired` |
| `nav-alpha` | `Waypoint` | `(120, 0, -30)` | radius `3`, terminal speed `0.5`, `StopWithinEnvelope` |
| `nav-beta` | `Point` | `(90, 0, 0)` | radius `3`, terminal speed `0.5`, `StopWithinEnvelope` |

The current v2 course catalog creates additional point targets per course using stop envelopes with radius `3`, terminal speed `0.5`, and `StopWithinEnvelope`.

### Current Browser obstacle constellations

Base world obstacles:

- `rock-a`: `(58, 0, -14)`, radius `11`, padding `8`.
- `corridor-rock`: `(45, 0, 0)`, radius `10`, padding `6`.
- Render-only asteroid field `asteroid-a` through `asteroid-f`; this is visual evidence support, not navigation truth.

Current v2 course obstacles:

- `s-curve-obstacles`: 3 rocks at `(50,0,0)`, `(90,22,0)`, `(130,-20,0)`.
- `narrow-corridor`: upper/lower pair plus center rock at `(70,17,0)`, `(70,-17,0)`, `(115,0,0)`.
- `offset-gates`: two offset gate rocks.
- `target-behind-obstacle`: one front rock.
- `target-near-obstacle`: one near-target rock.

### Current acceptance metrics

The existing harness and v2 runner already measure or assert:

- `planHashBefore` and `planHashAfter` stability.
- `status`, `arrivalPhase`, `replanRequired`, `invalidationReasons`, `failureReasonCodes`, `routeValid`.
- target kind and arrival envelope fields.
- route validation/score: distance, segment count, clearance risk, fuel estimate, authority risk.
- mass/fuel: initial/final mass, initial/final fuel, fuel used.
- terminal-capture telemetry: terminal speed limit, current speed, terminal error, terminal speed error, radial/tangential terminal speed, desired terminal velocity, capture/holding flags.
- v2 metrics: `ticksToArrival`, `peakSpeed`, `finalSpeed`, `finalDistance`, `minObstacleClearance`, `fuelUsed`, `segmentKinds`, and classification.

Current v2 acceptance structure:

- `maxFinalDistance`
- `maxFinalSpeed`
- `minObstacleClearance`
- `maxTicks`
- optional `maxFuelUsed`
- optional `allowReplanRequired`
- optional `expectedFailureReasonCodes`

### Current hard invariants

- The executor consumes one locked route plan and does not call a planner during execution.
- Plan hashes must remain stable during execution, including `KnownStress` and `ExpectedFail` classifications.
- `replanRequired=true` is a visible signal, not permission to silently replace a route.
- `StopWithinEnvelope` arrival requires both distance and terminal speed gates.
- Normal runtime must not snap the ship to the target, zero velocity, or clamp terminal velocity as a shortcut.
- Speed profiles may change route desired speeds and non-terminal brake-margin metadata, but must not raise executor `maxAcceleration` globally or weaken terminal capture.

## 2. Gaps Compared To Unity Proving Ground

Unity reference coverage from `PrototypeAutopilotProvingGroundPlayModeTests.cs` includes:

- direct routes at 100 m, 500 m, and 2400 m;
- lateral initial velocity at 500 m with `18 m/s` lateral velocity;
- off-axis rotation at 500 m with `145°` yaw;
- obstacle corridor at 500 m with three obstacles and reacquire evidence;
- near-target overshoot with high initial velocity;
- low-RCS terminal correction;
- no-RCS negative/no-false-complete;
- acceptance metrics for final error, final speed, final angular speed, minimum distance reached, max distance after entering 2 m, safety replans, avoidance/reacquire/direct-after-avoidance flags, obstacle clearance, planner-profile counts, and terminal reacceleration transitions.

### Important Browser v2 gaps

- Browser needs explicit short/medium/long direct cases, not only `direct-long` and `arrival-near`.
- Browser should split high starting speed, lateral starting velocity, and overspeed terminal disturbances into separate courses so failures identify the stressed mechanic.
- Browser needs a broader obstacle taxonomy: single blocker, S-curve, narrow corridor, offset gates, target behind obstacle, and target near obstacle.
- Browser needs Authority/Fuel negative courses for no main thrusters and no autopilot authority in the v2 course classification model, even though the older scenario harness already covers them.
- Browser should make `KnownStress` vs `ExpectedFail` explicit so current one-obstacle planner limitations remain visible instead of being hidden as generic failures.
- Browser needs speed-profile comparison scenarios where `Balanced` is measurably faster than `Safe` while terminal capture remains conservative.

### Lower-priority or not-v2 gaps

- Unity-specific exact thresholds such as `0.75 m`, `0.15 m/s`, and `0.15 rad/s` should inform Browser acceptance but not be copied blindly.
- Unity scene/bootstrap, Rigidbody details, IMGUI diagnostics, and exact control feel are reference context only.
- Gravity, orbital, slingshot, docking hard-lock, cargo, economy, mission, multiplayer, and final ship-editor behavior remain out of scope for this Browser local-space test range.
- Off-axis rotation is useful later, but the v2 Browser matrix should prioritize velocity/disturbance/authority/obstacle coverage because current Browser orientation/control-mode work is active in parallel.

## 3. Scenario Matrix Design

The proposed full matrix is stored in `analysis/browser-autopilot-test-range-v2-scenario-matrix.json` and contains 25 scenarios across these categories:

- `Basic`: 5 scenarios.
- `Obstacle`: 6 scenarios.
- `AuthorityFuel`: 5 scenarios.
- `Disturbance`: 4 scenarios.
- `SpeedProfile`: 5 scenarios.

The matrix intentionally separates `expectedOutcome` from implementation failure state:

- `Pass`: must satisfy all acceptance gates.
- `KnownStress`: may miss route-quality gates, but hard invariants still fail the course if violated.
- `ExpectedFail`: must fail closed with required reason codes/signals; accidental success is a failure.

## 4. Speed Profiles

Speed profiles must tune route intent, not physics shortcuts.

| Profile | Midcourse desired speed | Terminal capture margin | Brake aggressiveness | Obstacle behavior | Fuel tradeoff | Max speed cap plan |
| --- | ---: | --- | --- | --- | --- | --- |
| `Safe` | Low/direct ~12, avoidance ~10 | Largest non-terminal brake margin | Earliest braking | Largest clearance preference and most tolerant route time | Lowest peak burn, longest route time | Cap desired cruise/avoidance speed below current Balanced values. |
| `Balanced` | Medium/direct ~18, avoidance ~14 | Standard conservative margin | Current default | Normal clearance gates; no terminal relaxation | More fuel than Safe, faster arrival | Cap near current default profile values. |
| `Fast` | Higher/direct ~22+, avoidance ~18 | Terminal capture unchanged | Later non-terminal braking only | Allowed as `KnownStress` in tight fields | Highest fuel/peak speed | Cap non-terminal desired speed; terminal speed remains hard gate. |

Required profile evidence:

- `Balanced` on `direct-long` must arrive in fewer ticks than `Safe`.
- `Balanced` and `Safe` must both satisfy final distance and final speed gates.
- `Balanced` should show higher peak speed than `Safe` without plan hash replacement or replan requirement.
- `Fast` may start as `KnownStress` in corridor/obstacle courses, but terminal capture failures, plan hash changes, or silent replans are hard failures.
- Terminal capture remains conservative for all profiles; no profile may raise executor `maxAcceleration` globally, bypass `StopWithinEnvelope`, or accept speed above terminal limit.

## 5. Future Implementation Prompt

Use this prompt only after the parallel Autopilot lifecycle/jitter and UI branches have merged and the implementation branch is rebased on the resulting `main`.

```text
Task: browser-autopilot-proving-ground-v2

Repo: BenjaminHornung/Weltraum-Spiel. Start from latest main after the Autopilot lifecycle/jitter and UI branches are merged. Create a dedicated implementation branch/worktree before editing.

plan_status: approved. explicit_replan: false.

Objective:
Implement the Browser Autopilot proving-ground v2 test range described by:
- analysis/browser-autopilot-test-range-v2-plan.md
- analysis/browser-autopilot-test-range-v2-scenario-matrix.json
- analysis/browser-autopilot-test-range-v2-implementation-map.md
- .devtoolbox/specs/changes/browser-autopilot-test-range-v2/**

Success criteria:
1. Implement all 25 matrix scenarios with IDs exactly matching the JSON matrix unless a spec update is approved first.
2. Preserve existing deterministic harness scenarios and all terminal-capture/no-snap/no-silent-replan/planHash invariants.
3. Add/extend course definitions, runner metrics, scenario metric helpers, unit tests, E2E test, and evidence output without weakening old tests.
4. Classify results as Pass, KnownStress, ExpectedFail, or Fail exactly as the spec defines.
5. Safe/Balanced/Fast only tune route desired speeds and non-terminal brake-margin behavior; do not globally raise executor maxAcceleration or weaken terminal capture.

Likely files to change or create:
- apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts
- apps/weltraum-browser/src/test-harness/autopilotCourseRunner.ts
- apps/weltraum-browser/src/test-harness/scenarioMetrics.ts
- apps/weltraum-browser/src/test-harness/scenarioRunner.ts only as a compatibility bridge if needed
- apps/weltraum-browser/src/core/types.ts only if the course/metric contracts need extension
- apps/weltraum-browser/src/navigation/planners.ts only for profile metadata/clearance behavior, not broad replanning
- apps/weltraum-browser/tests/unit/autopilotProvingGroundCourses.test.ts
- apps/weltraum-browser/tests/unit/autopilotSpeedProfiles.test.ts
- apps/weltraum-browser/tests/unit/provingGroundScenarios.test.ts only to preserve or bridge old coverage
- apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts
- apps/weltraum-browser/evidence/browser-autopilot-proving-ground-v2.md
- apps/weltraum-browser/evidence/autopilot-proving-ground-v2-summary.json

Known context and constraints:
- Current main may already contain an initial 11-course v2 catalog and E2E spec; extend carefully instead of deleting useful coverage.
- ObstacleAvoidanceLocal currently detours around only the first blocking obstacle; multi-obstacle/corridor scenarios may be KnownStress until planner scope expands.
- Unity sources are reference-only. Do not port Unity scene/Rigidbody/IMGUI implementation.
- Keep player UI and TestBridge/debug contracts separate.

Forbidden actions:
- Do not silently replace a locked plan during execution.
- Do not snap position to target, zero velocity, or clamp terminal velocity as a shortcut.
- Do not weaken old unit/E2E acceptance or remove existing scenarios to make the new suite pass.
- Do not run destructive Git, publish, deployment, service install, database migration, or data-generator commands.

Required skills/project instructions:
- Read repo AGENTS.md.
- Use subagent-driven-development, verification-before-completion, systematic-debugging if failures occur, and requesting-code-review before completion.
- For Browser UI/E2E work, use browser-debugger/test-runner lanes rather than ad hoc foreground servers.

Implementation steps:
1. Re-read the analysis/spec package and current source after rebase.
2. Normalize the course catalog to all 25 scenario IDs in the matrix.
3. Move reusable course execution/metric logic into focused test-harness modules if current scenarioRunner has grown too large.
4. Add unit tests for catalog schema, profiles, classification gates, expected failure reason checks, and no weakening of old harness scenarios.
5. Extend TestBridge/E2E only as needed to run and record the matrix under `?testBridge=1` while keeping default product bootstrap hidden.
6. Generate Markdown/JSON evidence with scenario summaries and profile comparisons.
7. Run required verification and record evidence.

Verification:
- npm run test -- tests/unit/provingGroundScenarios.test.ts tests/unit/autopilotProvingGroundCourses.test.ts tests/unit/autopilotSpeedProfiles.test.ts
- npm run build
- npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts
- JSON parse generated evidence summary
- Confirm no old terminal-capture and no-silent-replan tests were weakened

Report back:
- Changed files
- Scenario count and categories
- Pass/KnownStress/ExpectedFail counts
- Speed-profile evidence (`Safe` vs `Balanced`, `Fast` stress notes)
- Tests/evidence run with exact commands and results
- Remaining KnownStress limitations and risks

Stopping rule:
Stop and escalate if implementing all 25 scenarios requires planner architecture changes beyond one-blocking-obstacle support, if lifecycle/UI merge conflicts obscure source of truth, or if terminal capture/no-silent-replan invariants fail.
```
