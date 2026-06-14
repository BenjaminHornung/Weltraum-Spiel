# Arrival Terminal Capture Verification

Change: `stabilize-autopilot-arrival-terminal-capture-v1`

## Implementation Evidence

- `ApplyDirectFastTransferTerminalBrake()` uses a tapered terminal brake throttle inside the capture zone.
- Terminal capture entry now requires a short stable entry window; a transient false tick resets the entry window.
- Terminal capture release now requires a sustained outside-release window; a return inside terminal range cancels release.
- Terminal capture and brake hold no longer release into `Accelerate` while terminal capture or brake latches are active near the capture zone.
- Near-terminal DFT reacquire keeps control in final approach, lateral correction, damping, or terminal brake instead of accelerating through an overshoot.
- Slow DFT terminal capture may enter HoldPosition with a small DirectFastTransfer-only distance slack; generic arrival/launch completion still uses the stricter finished-distance gate.
- Fine approach release allows RCS damping after terminal brake when speed/lateral error are already settled near the finished-distance envelope.

## Final Validation

- `dotnet build "Weltraum Spiel.sln" --no-restore`: passed, 0 errors, known Unity/MSBuild warnings.
- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: 0 errors, 1 known GC warning.
  - `Assets/Tests/Editor/PrototypeWaypointAutopilotArrivalTerminalCaptureTests.cs`: 0 errors, 0 warnings.
  - `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`: 0 errors, 0 warnings.
- Unity MCP EditMode job `5a2ffa6a91354b7ab7477c37c6bfb22e`: passed 13/13 for obstacle + arrival terminal tests.
- Unity MCP PlayMode job `6f3874b5c4f34f1c8652e6c5c2d262a7`: passed 6/6:
  - `PlayMode_DistantWaypoint_PlanExecution_FidelityRegression`
  - `PlayMode_Autopilot_TerminalOvershootBrakesAndHoldsWithoutReaccelerating`
  - `PlayMode_Autopilot_NearTargetLateralOvershoot_NoTerminalAccelerateOrSpin`
  - `PlayMode_Autopilot_OffAxisTerminalDeadzoneWithRealisticAuthority_LatchesHoldWithoutAccelerateFlap`
  - `PlayMode_Autopilot_TerminalOvershootWithoutRcsDoesNotEnterHold`
  - `PlayMode_Autopilot_OffAxisLongRangeTerminalBrakeCommit_DoesNotReenterAccelerateOrSpin`
- Unity MCP PlayMode job `ddaaa1a28fb743699fcb8d4a3d288575`: passed 2/2 launch-corridor regression tests after the DFT-only hold slack and terminal capture stability fixes.
- DevToolbox `specs_validate` for this change: passed.
