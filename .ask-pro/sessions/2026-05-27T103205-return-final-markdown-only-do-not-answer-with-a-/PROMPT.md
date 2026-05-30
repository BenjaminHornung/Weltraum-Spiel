Return final markdown only. Do not answer with a preamble. Do not produce an implementation package. Treat the attached bundle as authoritative. Call out uncertainty.

We are in E:\Unity\Weltraum Spiel\Weltraum Spiel on branch main. Goal: stabilize the player autopilot arrival/terminal path so it does not flap between Brake and Accelerate and does not fall back to AlignForBurn after a terminal brake commit. Please review only the attached files and the current failure signatures.

Attached files:
- Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs
- Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs
- .devtoolbox/specs/changes/player-autopilot-arrival-stability-v2/specs/autopilot/spec.md

What changed in PrototypeWaypointAutopilot.cs:
- BrakeMainThrottleRetrogradeAlignmentDegrees was raised from 30 to 35.
- BrakeFlipMaxAngularAccelerationRadPerSecondSquared was raised from 2 to 3.
- BrakeFlipDampingTimeSeconds was lowered from 0.5 to 0.4.
- shouldSettleAfterBrakeCommit now requires closingSpeed > BrakeHoldReleaseZeroSpeed.
- requestedFineApproach was recently relaxed again to remove the extra closing-speed gate.
- There is now an early return to ApplyBrakeRequest() if arrivalBrakeCommitted || brakeHoldActive || arrivalTerminalCaptureActive before the final Accelerate fallback.
- ShouldKeepTerminalBrakeCommitted no longer drops out because ShouldCaptureAnyArrivalHold() is true.
- ResolveBrakeDirection now prefers directionToTarget when closingSpeed <= 0 and only freezes once capture/hold is active.
- ApplyAutopilotRequest now lets brakeVelocityAlignmentReady pass when closingSpeed <= 0 and the ship is already aligned to the brake angle.
- ShapeMainThrottleForState no longer hard-zeros throttle at low speed; it now relies on the distance/speed scale.

Latest PlayMode failures from the three target tests:
1. Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone
- finalState=Brake
- finalPhase=Brake
- distance=105.11
- everArrivalBrakeCommitted=True
- everBrakeHoldActive=True
- finalArrivalBrakeCommitted=True
- finalBrakeHoldActive=False
- finalArrivalTerminalCaptureActive=False
- It never entered the completion window.

2. TerminalOvershootBrakesAndHoldsWithoutReaccelerating
- finalState=Brake
- finalDistance=40.47
- everArrivalBrakeCommitted=True
- everBrakeHoldActive=True
- finalArrivalBrakeCommitted=True
- finalBrakeHoldActive=False
- finalArrivalTerminalCaptureActive=False
- firstMainBrakeSample occurred at distance=43.10, then it never settled.

3. NearTargetLateralOvershoot_NoTerminalAccelerateOrSpin
- finalState=Brake
- finalDistance=125.14
- finalSpeed=0.26
- finalAngularSpeed=0.00
- It still does not settle into HoldPosition or Complete.

Question:
What is the single most likely root cause now, and what is the smallest safe code change to get these three tests passing without reintroducing brake/accelerate flapping or throttle during FlipForBrake?

Please rank the likely fix options by confidence and explicitly say if any of the current changes should be reverted.


I attached a context bundle named CONTEXT.zip. Use the files inside it as the authoritative repo context for this question.

Be direct and practical. Prefer boring, reliable implementation choices over cleverness. Do not ask the calling agent to execute generated scripts automatically.
