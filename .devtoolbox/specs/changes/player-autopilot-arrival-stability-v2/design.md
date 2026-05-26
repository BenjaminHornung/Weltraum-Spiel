# Design: Player Autopilot Arrival Stability v2

## Approach

The fix keeps the current physics path. The autopilot still requests attitude torque, RCS damping force, and main throttle through `FlightAssistRequest`; it does not set position or velocity directly.

The arrival controller needs two pieces of hysteresis:

- Brake phase hysteresis: once braking starts, continue braking through noisy `shouldBrake` threshold changes while relative speed is still meaningful.
- Arrival hold hysteresis: once inside the near-target deadzone, hold and damp residual velocity instead of flipping back into a transfer burn.

The brake flip should use the available attitude authority to approach the retrograde attitude with a bounded angular velocity. Main throttle is only allowed after the attitude is aligned and the angular velocity is low enough that the ship is not still spinning through the target attitude.

## Verification

- Focused Unity validation for `PrototypeWaypointAutopilot.cs`.
- Focused PlayMode test for autopilot arrival/deadzone/flap behavior.
- `dotnet build "Weltraum Spiel.sln" --no-restore`.
