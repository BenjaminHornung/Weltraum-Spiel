# Test Protocol: Player Autopilot Arrival Stability v2

## Scope

Stabilize waypoint autopilot arrival behavior so the ship commits to a brake/decel phase, avoids repeated accelerate/brake flapping, bounds brake flip rotation, and captures a near-target arrival deadzone instead of circling around the target.

## Implementation Evidence

- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
  - Added an arrival brake commit latch.
  - Added post-brake settle logic inside the near-target window.
  - Added a wider arrival hold capture deadzone based on distance, relative speed, and lateral speed.
  - Added an angular-rate gate before main-thruster brake burns.
  - Dampened brake attitude commands based on current angular velocity.
  - Added terminal lateral correction as a real RCS-only damping phase with no main-throttle request.
  - Added brake throttle shaping near the arrival completion envelope.
  - Added low-but-nonzero RCS authority detection for terminal lateral correction.
  - Prevented no-RCS approach from entering Hold before a real brake commit.
- `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`
  - Strengthened `PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone` with off-axis position, lateral velocity, initial angular velocity, state-transition counters, flip-throttle guard, and final angular-speed assertions.
  - Added `PlayMode_Autopilot_NearTargetOffAxisVelocity_DampsLaterallyWithoutMainThrottle`.
  - Added `PlayMode_Autopilot_NearTargetHighMassLowRcs_DetectsLimitedLateralAuthority`.

## Verification

- Unity MCP `validate_script`
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: success, 0 errors, 1 existing GC warning.
  - `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`: success, 0 errors, 0 warnings.
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
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_NearTargetOffAxisVelocity_DampsLaterallyWithoutMainThrottle`
    - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_NearTargetHighMassLowRcs_DetectsLimitedLateralAuthority`
  - Result: `Passed`, total `3`, passed `3`, failed `0`.
- Unity MCP PlayMode suite
  - Test filter: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: `Passed`, total `11`, passed `11`, failed `0`.
- `.NET` build
  - Command: `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: exit code `0`, `0 Error(s)`, `22 Warning(s)` from existing Unity/.NET assembly reference conflicts and pre-existing Unity analyzer warnings.

## Iteration Notes

- Earlier failed focused PlayMode runs reproduced the user issue as repeated accelerate/brake transitions or final drift after over-constraining the brake gate.
- The passing version keeps at most one brake-to-accelerate and one accelerate-to-brake transition, forbids main-throttle requests during `FlipForBrake`, and accepts final `Complete` or `HoldPosition` inside the arrival deadzone.
- A focused review found that low-but-nonzero RCS could hide insufficient terminal lateral authority; the final patch now compares desired lateral correction force with the clamped request and reports `LimitedRcsAuthority`.
- A full EditMode rerun initially caught an over-broad Hold capture in the no-RCS approach case; the final patch now keeps no-RCS approach in `FinalApproach`/`LimitedRcsAuthority` unless a real brake commit already happened.

## Known Tooling Notes

- After the final PlayMode pass, Unity MCP test-job polling stayed stale even though Unity wrote the passing XML result to AppData and the copied evidence file.
- A follow-up closed-loop brake rerun was blocked by Unity MCP returning `tests_running` despite the editor being idle.
- Claude plan review was attempted for the autopilot patch context and timed out after 120 seconds; no Claude findings were available for this slice.
- DevToolbox `verify_run` was executed on execution `0cc8a590b50f4c7b85b7a3660b4cffc2`; `Specs` passed, but the generic `Build`, `Test`, and `Lint` presets failed because they invoke `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` without specifying `Weltraum Spiel.sln` in a folder containing multiple MSBuild files. The targeted Unity/.NET verification above is the authoritative result for this slice.
