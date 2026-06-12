# ask-pro Context Manifest

Session: `2026-05-31T175044-return-final-markdown-only-do-not-answer-with-a-`

## Question

Return final markdown only. Do not answer with a preamble. Do not produce an implementation package. Rank findings by severity. Treat the attached bundle as authoritative, but also connect GitHub before answering if the ChatGPT UI/GitHub connector is available. Call out uncertainty clearly.

Please use normal ChatGPT Pro, not a quick/light review. Answer in German.

## GitHub connection request

Please connect GitHub to inspect this repository and branch if available:

- Repository: https://github.com/BenjaminHornung/Weltraum-Spiel
- Branch: codex/weltraum-002-orbit-map-prototype
- Latest pushed commit under review: 9cb04edd4e9e40605c8946e48e50fbc155b5a87d
- Previous product-logic commit relevant to DirectFastTransfer smoothness: 1fe8b09397bdf2fcf2ca601f99cbb4b3a9e9f9ed

If GitHub cannot be connected from your environment, say that explicitly and use only the attached files plus this prompt.

## Context summary

This is a Unity 6000.4 C# prototype called “Weltraum Spiel”. The relevant subsystem is a waypoint autopilot for spacecraft navigation. The user expectation is conceptually simple:

1. Before AP engage, compute the entire flight plan from current ship state to target.
2. Once AP is engaged, controls are locked to the flight plan.
3. The autopilot should execute the precomputed phases deterministically until either:
   - the ship reaches target/completion, or
   - the user manually aborts AP.
4. During nominal execution, live replanning and continuous adjustment should not happen. Replan should be for hard invalidation only, not normal DFT burn/brake corrections.

The problem: after the latest work, the DirectFastTransfer burn phase is better and no longer shows the old throttle-pulsing regression in focused tests. But braking still does not behave consistently, and the visible status often goes to “Replan”. The user asks whether this is an architecture problem, an implementation mismatch, or a wrong approach.

Original user concern, translated/cleaned up:

> In the newest commit the burn phase works better, but braking still does not work consistently and status still often goes to replan. Why is this so hard? Is our architecture wrong? The idea was that before engage we pre-plan the entire flight, then lock controls, and either we arrive or the user aborts AP. According to precomputation all phases should be fixed and valid. There should not be replan and adjustments during nominal execution. Why is this happening now? Is the implementation wrong? Are we approaching this incorrectly?

## Recent commits and what changed

### Previous relevant product commit: 1fe8b09397bdf2fcf2ca601f99cbb4b3a9e9f9ed
Title: `#FIX-DIRECT-FAST-TRANSFER-SMOOTHNESS prevent replan and throttle pulsing`
Files touched included:

- `.devtoolbox/specs/changes/fix-direct-fast-transfer-execution-smoothness-v1/**`
- `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`
- `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`
- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
- tests for flight plan/autopilot navigation.

This commit attempted to fix the direct fast transfer behavior by reducing/avoiding nominal replan and throttle pulsing.

### Latest pushed commit: 9cb04edd4e9e40605c8946e48e50fbc155b5a87d
Title: `#WELTRAUM-002 harden DirectFastTransfer autopilot regression tests`
This is test-only hardening. It does not change product/gameplay code. It adds trace counters and regression tests around:

- flight plan ID changes/revision jumps/revision resets
- replan status during nominal DFT execution
- main throttle drops during latched burn/brake phases
- burn-to-brake transition pulsing after brake latch
- soft tracking during burn and brake
- consecutive soft tracking corrections
- 90/135 degree initial rotation no-replan-flap
- initial angular velocity delayed latch without throttle pulse
- EditMode classification of soft vs hard DFT divergence reasons
- non-DFT brake timing divergence guard

Focused DFT tests pass, but broader terminal/braking behavior still has red signals.

## Verification status after latest commit

From `.devtoolbox/specs/changes/harden-direct-fast-transfer-autopilot-regression-tests-v1/tests/logs/verification-summary.md`:

- `git diff --check` for the two test files: passed, only LF/CRLF warnings.
- `dotnet build "Weltraum Spiel.sln" --no-restore`: passed with 0 errors, 22 existing warnings.
- Unity `validate_script`:
  - PlayMode test file: 0 warnings, 0 errors.
  - Editor test file: 0 errors, 2 analyzer warnings already present in this test style.
- Focused DFT EditMode tests, job `47274ac7dc7c4b3592e11d2491700a66`: passed 3/3.
- Focused DFT PlayMode tests, job `9bccd4eb20034be5ba2c90b03f0464bc`: passed 10/10.
- Broader requested EditMode class run, job `d667950beef54e619088f3f213b93e73`: failed 9/89 in non-DFT surrounding tests. DFT boundary tests passed when isolated.
- Terminal flap/deadzone PlayMode run, job `a69c86aae72f47a2ab055f1d58249d25`: failed 2/3 in existing terminal-arrival scenarios:
  - `PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
  - `PlayMode_Autopilot_TerminalBrakeCommit_PredictsDecelWithoutSpinOrFlap`

Important terminal failure snippets:

1. `PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`

- Expected: autopilot enters completion deadzone near target before terminal state.
- Actual final state/phase: `FlipForBrake` / `Brake`
- final position: `65.68,0.15,334.94`
- final velocity: `-0.10,-0.04,0.03`
- distance: `177.53`, minDistance: `18.05`, arrivalRadius: `10.00`
- brake/accelerate transitions: 0
- arrival failure reason: none
- `everArrivalBrakeCommitted=True`, `everBrakeHoldActive=False`, `everArrivalTerminalCaptureActive=False`
- last samples show far away, very low velocity, stuck in `FlipForBrake`/`Brake` with main 0 and RCS only.

2. `PlayMode_Autopilot_TerminalBrakeCommit_PredictsDecelWithoutSpinOrFlap`

- Final state: `Complete`, phase `Hold`
- final distance: `8.22`, final speed: `0.12`, final angular speed: `0.00`
- `accelerateFramesInTerminalEnvelope=0`, `throttleWhileFlipFrames=0`, `maxFlipAngularSpeed=0.53`
- `brakeToAccelerateTransitionsAfterCommit=0`
- `integratedBrakeRotationRadians=5.73`, expected <= `4.24`
- Failure: terminal brake flip accumulates a full extra rotation.

## Key architecture facts from code inspection

Please verify these from attached files rather than trusting the summary blindly:

- `PrototypeWaypointAutopilot` still contains both legacy closed-loop state-machine behavior and a flight-plan executor path.
- It has states like `AlignForBurn`, `Accelerate`, `FlipForBrake`, `Brake`, `HoldPosition`, `Complete`, `Aborted`, etc.
- It exposes `FlightPlanRequiresReplan`, `FlightPlanRequiresAbort`, and `FlightPlanDivergenceStatusLabel` via divergence reports.
- It can run with `flightPlanExecutorEnabled` and `strictFlightPlanExecution`, but there are still places where arrival/terminal hold/brake logic, safety replan, divergence status, latches, and closed-loop control decisions appear to coexist.
- There are DFT-specific latch constants in `PrototypeWaypointAutopilot` such as burn/brake latch engage/keep/release degrees and angular speed thresholds.
- `PrototypeFlightPlan` has a tracker and divergence monitor. It can mark nominal tracking errors as `PositionDivergence`, `VelocityDivergence`, `AttitudeDivergence`, `TrackingDiverged`, `PlanExpired`, etc. Some DFT changes classify soft tracking reasons as non-hard during direct fast transfer, but visible status can still say “Tracking correction” or “Replan” depending on path/reasons.
- `PrototypeTrajectoryPlanner` appears responsible for building the precomputed DirectFastTransfer segments/phases.

## Files attached

Core product logic:

- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
- `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`
- `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`
- `Assets/Scripts/Prototype/TrajectoryPredictionState.cs`

Focused tests/evidence:

- `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`
- `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs`
- `Assets/Tests/Editor/PrototypeFlightPlanValidationTests.cs`
- `Assets/Tests/Editor/PrototypeAutopilotNavigationComputerV2ValidationTests.cs`
- `.devtoolbox/specs/changes/harden-direct-fast-transfer-autopilot-regression-tests-v1/tests/logs/verification-summary.md`
- `.devtoolbox/specs/changes/harden-direct-fast-transfer-autopilot-regression-tests-v1/tests/logs/direct-fast-transfer-hardening-trace.csv`
- `.devtoolbox/specs/changes/fix-direct-fast-transfer-execution-smoothness-v1/specs/direct-fast-transfer-execution-smoothness/spec.md`
- `.devtoolbox/specs/changes/fix-direct-fast-transfer-execution-smoothness-v1/tests/logs/direct-fast-transfer-smoothness-trace.csv`
- `.devtoolbox/specs/changes/fix-direct-fast-transfer-execution-smoothness-v1/tests/test-protocol.md`

## What I need from you

Please give a direct architecture/debugging second opinion. Do not just say “add more tests”. Answer these questions:

1. Is the current architecture conceptually compatible with the desired behavior: precompute whole flight before AP engage, lock controls, execute fixed phases, no nominal replan/adjustment except hard abort/user abort?
2. If compatible, where is the implementation likely violating that model? Point to concrete code areas/conditions/files from the attached bundle.
3. If incompatible, what architecture change should we make? For example: separate immutable planned execution from advisory live correction; make DFT an explicit open-loop/closed-loop hybrid contract; split terminal capture into a planned segment; make divergence monitor read-only during strict execution; etc.
4. Why is braking harder than burn here? Please reason physically and architecturally: retrograde alignment, terminal capture, lateral velocity, plan expiry, actuator authority, arrival radius, rotation/latch hysteresis, and whether a precomputed plan can remain valid under Unity physics integration error.
5. Why does “Replan” still show up often? Is this mostly status-label semantics, divergence monitor still active, actual plan replacement, or closed-loop fallback? How should status be modeled so users are not told “Replan” during allowed soft tracking corrections?
6. What is the smallest reliable next product-code change plan? Prioritize changes by risk and expected effect. Include specific acceptance tests that should pass afterward.
7. What should we NOT do? Call out likely wrong fixes such as broad tolerance inflation, suppressing status without fixing state ownership, or adding more latches everywhere.

Please distinguish:

- real architecture mismatch
- implementation bug
- physics/controller limitation
- status/UX labeling problem
- test/harness limitation

Preferred answer format:

- Short verdict
- Severity-ranked findings
- Proposed architecture contract
- Minimal next implementation plan
- Test plan
- “Do not do this” list

## Included Files

- `.devtoolbox/specs/changes/fix-direct-fast-transfer-execution-smoothness-v1/specs/direct-fast-transfer-execution-smoothness/spec.md` - Matched by --files pattern.
- `.devtoolbox/specs/changes/fix-direct-fast-transfer-execution-smoothness-v1/tests/logs/direct-fast-transfer-smoothness-trace.csv` - Matched by --files pattern.
- `.devtoolbox/specs/changes/fix-direct-fast-transfer-execution-smoothness-v1/tests/test-protocol.md` - Matched by --files pattern.
- `.devtoolbox/specs/changes/harden-direct-fast-transfer-autopilot-regression-tests-v1/tests/logs/direct-fast-transfer-hardening-trace.csv` - Matched by --files pattern.
- `.devtoolbox/specs/changes/harden-direct-fast-transfer-autopilot-regression-tests-v1/tests/logs/verification-summary.md` - Matched by --files pattern.
- `Assets/Scripts/Prototype/PrototypeFlightPlan.cs` - Matched by --files pattern.
- `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs` - Matched by --files pattern.
- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs` - Matched by --files pattern.
- `Assets/Scripts/Prototype/TrajectoryPredictionState.cs` - Matched by --files pattern.
- `Assets/Tests/Editor/PrototypeAutopilotNavigationComputerV2ValidationTests.cs` - Matched by --files pattern.
- `Assets/Tests/Editor/PrototypeFlightPlanValidationTests.cs` - Matched by --files pattern.
- `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs` - Matched by --files pattern.
- `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs` - Matched by --files pattern.

## Redaction

Mode: best_effort

Findings: 0
