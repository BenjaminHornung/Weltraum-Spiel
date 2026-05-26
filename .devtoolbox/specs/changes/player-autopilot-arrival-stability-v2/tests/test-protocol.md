# Test Protocol: Player Autopilot Arrival Stability v2

## Scope

Stabilize waypoint autopilot arrival behavior so the ship commits to a brake/decel phase, avoids repeated accelerate/brake flapping, bounds brake flip rotation, and captures a near-target arrival deadzone instead of circling around the target.

## Implementation Evidence

- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
  - Added an arrival brake commit latch.
  - Added post-brake settle logic inside the near-target window.
  - Added a wider arrival hold capture deadzone based on distance, relative speed, and lateral speed.
  - Added a terminal post-brake fallback so committed arrivals cannot fall back to `Accelerate`/`LongRangeBurn` inside terminal range.
  - Added a stable committed brake direction so low-speed terminal braking does not chase noisy velocity vectors.
  - Added terminal overshoot capture: high residual velocity keeps braking, while moderate residual velocity inside the arrival bubble enters physical Hold damping.
  - Terminal Hold capture now requires real RCS translation authority; No-RCS ships stay out of `HoldPosition` unless another stricter arrival path applies.
  - Terminal obstacle avoidance now wins over the new committed brake latch when the normal radial stopping metric is not requesting urgent brake.
  - Added a shared hold-entry path that captures true near-arrival/settled cases without bypassing hold confirmation.
  - Added an angular-rate gate before main-thruster brake burns.
  - Dampened brake attitude commands based on full local angular velocity and bounded over-speed output without making the flip too sluggish for the decel burn.
  - Added terminal lateral correction as a real RCS-only damping phase with no main-throttle request.
  - Added brake throttle shaping near the arrival completion envelope.
  - Added low-but-nonzero RCS authority detection for terminal lateral correction.
  - Added low-but-nonzero RCS authority detection for Hold damping.
  - Prevented no-RCS approach from entering Hold before a real brake commit.
  - Target switching now clears brake alignment, brake hold, committed brake direction, and hold confirmation hysteresis.
- `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`
  - Strengthened `PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone` with off-axis position, lateral velocity, initial angular velocity, state-transition counters, flip-throttle guard, and final angular-speed assertions.
  - Added a terminal brake-to-accelerate transition counter and assertion so committed terminal arrival cannot flap back to `Accelerate`.
  - Added flip-specific angular speed tracking.
  - Added `PlayMode_Autopilot_TerminalOvershootBrakesAndHoldsWithoutReaccelerating`.
  - Added `PlayMode_Autopilot_TerminalOvershootWithoutRcsDoesNotEnterHold`.
  - Added `PlayMode_Autopilot_TerminalAvoidanceStillWinsOverCommittedBrakeLatch`.
  - Added `PlayMode_Autopilot_SelectTargetClearsArrivalBrakeAndHoldHysteresis`.
  - Added `PlayMode_Autopilot_NearTargetOffAxisVelocity_DampsLaterallyWithoutMainThrottle`.
  - Added `PlayMode_Autopilot_NearTargetHighMassLowRcs_DetectsLimitedLateralAuthority`.

## Verification

- Unity MCP validate_script follow-up after terminal capture latch
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: success, 0 errors, 1 existing GC warning.
  - `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`: success, 0 errors, 0 warnings.
  - `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs`: success, 0 errors, 2 existing warnings.
- Unity MCP PlayMode terminal capture focused regression
  - Tests:
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalOvershootBrakesAndHoldsWithoutReaccelerating`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_NearTargetLateralOvershoot_NoTerminalAccelerateOrSpin`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_LongRangeBrakeCommitDoesNotActivateTerminalCaptureBeforeEnvelope`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalAvoidanceStillWinsOverCommittedBrakeLatch`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalOvershootWithoutRcsDoesNotEnterHold`
  - Result: `Passed`, total `6`, passed `6`, failed `0`.
- Unity MCP PlayMode terminal capture reviewer-regression
  - Tests:
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalOvershootBrakesAndHoldsWithoutReaccelerating`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_NearTargetLateralOvershoot_NoTerminalAccelerateOrSpin`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_LongRangeBrakeCommitDoesNotActivateTerminalCaptureBeforeEnvelope`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_BrakeDirectionUsesRetrogradeOutsideTerminalRangeEvenWithCaptureLatch`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalAvoidanceStillWinsOverCommittedBrakeLatch`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalOvershootWithoutRcsDoesNotEnterHold`
  - Result: `Passed`, total `7`, passed `7`, failed `0`.
- Unity MCP PlayMode suite terminal capture follow-up
  - Test filter: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: `Passed`, total `17`, passed `17`, failed `0`.
- Unity MCP PlayMode suite terminal capture final reviewer follow-up
  - Test filter: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: `Passed`, total `18`, passed `18`, failed `0`.
- Unity MCP EditMode suite terminal capture follow-up
  - Test filter: `PrototypeWaypointAutopilotValidationTests`
  - Result: `Passed`, total `32`, passed `32`, failed `0`.
- `.NET` build terminal capture follow-up
  - Command: `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: exit code `0`, `0 Error(s)`, `22 Warning(s)` from the same existing Unity/.NET assembly reference conflicts and analyzer warnings.
- `.NET` build terminal capture final reviewer follow-up
  - Command: `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: exit code `0`, `0 Error(s)`, `22 Warning(s)` from the same existing Unity/.NET assembly reference conflicts and analyzer warnings.

- Unity MCP `validate_script`
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: success, 0 errors, 1 existing GC warning.
  - `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`: success, 0 errors, 0 warnings.
- Unity MCP EditMode focused follow-up regression
  - Tests:
    - `PrototypeWaypointAutopilotValidationTests.AutopilotFastApproachFlipsBeforeMainDecelBurn`
    - `PrototypeWaypointAutopilotValidationTests.AutopilotClosedLoopApproachBrakesWithoutManualAlignment`
    - `PrototypeWaypointAutopilotValidationTests.MetricsComputeClosingLateralAndStoppingDistance`
    - `PrototypeWaypointAutopilotValidationTests.AutopilotNoRcsAllowsCoarseBurnAndReportsLimitedApproach`
    - `PrototypeAutopilotNavigationComputerV2ValidationTests.Autopilot_HoldRequiresStableVelocityWindow`
  - Result: `Passed`, total `5`, passed `5`, failed `0`.
- Unity MCP EditMode focused regression
  - Test: `PrototypeWaypointAutopilotValidationTests.AutopilotNoRcsAllowsCoarseBurnAndReportsLimitedApproach`
  - Result: `Passed`, total `1`, passed `1`, failed `0`.
- Unity MCP EditMode suite
  - Test filter: `PrototypeWaypointAutopilotValidationTests`
  - Result: `Passed`, total `31`, passed `31`, failed `0`.
- Unity PlayMode focused regression
  - Test: `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
  - Result XML: `.devtoolbox/specs/changes/player-autopilot-arrival-stability-v2/tests/logs/playmode-arrival-deadzone-results.xml`
  - Result: `Passed`, total `1`, passed `1`, failed `0`.
  - Timestamp: `2026-05-26 12:10:36Z` to `2026-05-26 12:10:37Z`.
- Unity MCP PlayMode focused regression
  - Tests:
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_NoRcs_DoesNotFakePrecisionComplete`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_ClosedLoopBrake_RotatesAndUsesMainThrusterWithoutHarnessRotation`
  - Result: `Passed`, total `3`, passed `3`, failed `0`.
- Unity MCP PlayMode terminal/authority regression
  - Tests:
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_NearTargetOffAxisVelocity_DampsLaterallyWithoutMainThrottle`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_NearTargetHighMassLowRcs_DetectsLimitedLateralAuthority`
  - Result: `Passed`, total `3`, passed `3`, failed `0`.
- Unity MCP PlayMode suite
  - Test filter: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: `Passed`, total `11`, passed `11`, failed `0`.
- Unity MCP PlayMode follow-up focused regression
  - Tests:
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalOvershootBrakesAndHoldsWithoutReaccelerating`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_ClosedLoopBrake_RotatesAndUsesMainThrusterWithoutHarnessRotation`
  - Result: `Passed`, total `3`, passed `3`, failed `0`.
- Unity MCP PlayMode suite follow-up
  - Test filter: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: `Passed`, total `12`, passed `12`, failed `0`.
- Unity MCP PlayMode review-regression follow-up
  - Tests:
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalOvershootWithoutRcsDoesNotEnterHold`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_TerminalAvoidanceStillWinsOverCommittedBrakeLatch`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_SelectTargetClearsArrivalBrakeAndHoldHysteresis`
  - Result: `Passed`, total `3`, passed `3`, failed `0`.
- Unity MCP PlayMode suite final follow-up
  - Test filter: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: `Passed`, total `15`, passed `15`, failed `0`.
- Unity MCP EditMode suite follow-up
  - Test filter: `PrototypeWaypointAutopilotValidationTests`
  - Result: `Passed`, total `31`, passed `31`, failed `0`.
- Unity MCP EditMode suite final follow-up
  - Test filter: `PrototypeWaypointAutopilotValidationTests`
  - Result: `Passed`, total `31`, passed `31`, failed `0`.
- Unity MCP console check
  - Result: no Unity console errors after the focused/full autopilot test runs; console only showed test runner setup/result log entries.
- `.NET` build
  - Command: `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: exit code `0`, `0 Error(s)`, `22 Warning(s)` from existing Unity/.NET assembly reference conflicts and pre-existing Unity analyzer warnings.
  - Follow-up result: exit code `0`, `0 Error(s)`, `22 Warning(s)` from the same existing Unity/.NET warnings.
  - Final follow-up result: exit code `0`, `0 Error(s)`, `22 Warning(s)` from the same existing Unity/.NET warnings.

## Iteration Notes

- Earlier failed focused PlayMode runs reproduced the user issue as repeated accelerate/brake transitions or final drift after over-constraining the brake gate.
- The passing version keeps at most one brake-to-accelerate and one accelerate-to-brake transition, forbids main-throttle requests during `FlipForBrake`, and accepts final `Complete` or `HoldPosition` inside the arrival deadzone.
- A focused review found that low-but-nonzero RCS could hide insufficient terminal lateral authority; the final patch now compares desired lateral correction force with the clamped request and reports `LimitedRcsAuthority`.
- A full EditMode rerun initially caught an over-broad Hold capture in the no-RCS approach case; the final patch now keeps no-RCS approach in `FinalApproach`/`LimitedRcsAuthority` unless a real brake commit already happened.
- A follow-up user report showed the brake flip still overshot and terminal approach could spin or flap. The follow-up patch keeps terminal arrivals out of `Accelerate` after brake commit, damps brake attitude against full local angular velocity, and allows true completion-window cases to enter `HoldPosition` without faking `Complete`.
- A later follow-up reproduced the remaining issue as a terminal overshoot with negative/low closing speed and high lateral velocity. The final follow-up keeps high-energy terminal overshoot in Brake, captures moderate residual velocity into Hold damping, and treats near-target off-axis damping as player-facing Hold rather than transfer FinalApproach.
- A reviewer pass flagged terminal No-RCS Hold, terminal Avoidance, and target-switch hysteresis as missing characterization. The final patch added explicit behavior and tests for all three axes.
- Unity initially kept running the stale pre-refresh assembly for `Autopilot_HoldRequiresStableVelocityWindow`; after forcing `Assets/Refresh`, the single test passed and the focused EditMode group passed.
- The latest follow-up adds a terminal arrival capture latch that activates only inside the terminal range, releases if the ship leaves that range by a margin, and prevents transfer `Accelerate` while the ship is slow inside the terminal window.
- Terminal brake direction smoothing now only applies in terminal/captured arrival contexts; long-range brake commits continue using the current retrograde direction and are covered by `PlayMode_Autopilot_LongRangeBrakeCommitDoesNotActivateTerminalCaptureBeforeEnvelope`.
- Reviewer follow-up tightened the brake-direction smoothing gate so the capture latch alone cannot keep smoothing alive after leaving terminal range, and added `PlayMode_Autopilot_BrakeDirectionUsesRetrogradeOutsideTerminalRangeEvenWithCaptureLatch` to prove recovery uses the actual retrograde vector outside terminal range.
- The terminal avoidance regression now also sets `arrivalTerminalCaptureActive`, pinning ObstacleAvoidance against the new latch as well as the older brake commit latch.

## Known Tooling Notes

- After the final PlayMode pass, Unity MCP test-job polling stayed stale even though Unity wrote the passing XML result to AppData and the copied evidence file.
- A follow-up closed-loop brake rerun was blocked by Unity MCP returning `tests_running` despite the editor being idle.
- Claude plan review was attempted for the autopilot patch context and timed out after 120 seconds; no Claude findings were available for this slice.
- DevToolbox `verify_run` was executed on execution `0cc8a590b50f4c7b85b7a3660b4cffc2`; `Specs` passed, but the generic `Build`, `Test`, and `Lint` presets failed because they invoke `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` without specifying `Weltraum Spiel.sln` in a folder containing multiple MSBuild files. The targeted Unity/.NET verification above is the authoritative result for this slice.
- DevToolbox `verify_run` was executed again on execution `65fad3b13b444ea2b7f8d25ad0f03d20`; it reproduced the same tooling issue: `Specs` passed, while generic `Build`, `Test`, and `Lint` failed on MSB1011 / multiple workspace files. Targeted Unity MCP tests and `dotnet build "Weltraum Spiel.sln" --no-restore` remain the authoritative verification.
- DevToolbox `verify_run` was executed again on execution `c887d815c1d94e10ae9bff20d7bd15a3`; it reproduced the same tooling issue: `Specs` passed, while generic `Build`, `Test`, and `Lint` failed because the presets run bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` in a folder with multiple MSBuild files. Targeted Unity MCP tests and `dotnet build "Weltraum Spiel.sln" --no-restore` remain the authoritative verification.
- DevToolbox `verify_run` was executed again on execution `8221c4a8f13e4de083011a89b5ab8493`; it reproduced the same tooling issue: `Specs` passed, while generic `Build`, `Test`, and `Lint` failed because the presets run bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` in a folder with multiple MSBuild files. Targeted Unity MCP tests and `dotnet build "Weltraum Spiel.sln" --no-restore` remain the authoritative verification.
