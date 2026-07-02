# browser-autopilot-terminal-capture-v1 Design

## Current failure

- `apps/weltraum-browser/src/world/provingGroundWorld.ts` defines `navigationAlpha` and `navigationBeta` with `terminalSpeed: 8` and `stopBehavior: "MatchTerminalSpeed"`, so the executor can validly report `Arrived` near 8 m/s.
- `AutopilotExecutor.step()` currently checks `isArrived(...)` before any controller integration, writes `Arrived` telemetry, and returns `ship`. Repeated ticks freeze the same nonzero-velocity state instead of braking, drifting, or holding.

## Chosen semantics

Use Option B from the task brief: keep the locked plan active after capture and continue station-keeping/holding through `applyFlightControllerStep()`.

Default navigation targets are stop/capture targets:

- `navigationAlpha`: `stopBehavior: "StopWithinEnvelope"`, `terminalSpeed: 0.5`, radius retained unless tests justify a change.
- `navigationBeta`: `stopBehavior: "StopWithinEnvelope"`, `terminalSpeed: 0.5`, radius retained unless tests justify a change.
- Explicit `NoStopRequired` targets remain separate fly-through/no-stop cases.

## Executor model

Add an arrival phase such as `None | TerminalBrake | Capture | Holding` to executor telemetry. `ExecutorStatus` can remain compatible: terminal braking/capture is still `Executing`; once the capture gate is satisfied, status can be `Arrived` while `arrivalPhase` is `Holding`.

The executor must not return early on `Arrived` while a plan is locked. It should compute a terminal/holding actuator request and call `applyFlightControllerStep()` every tick unless a fail-closed condition applies.

## Capture controller

For terminal capture and holding, compute a browser-native PD-style acceleration request:

```text
positionError = target.position - ship.position
desiredTerminalVelocity = target.desiredVelocity ?? vec3()
velocityError = desiredTerminalVelocity - ship.velocity
desiredAcceleration = kP * positionError + kD * velocityError
desiredAcceleration = clampMagnitude(desiredAcceleration, accelerationLimit)
```

The request is passed through `applyFlightControllerStep()` as `desiredAcceleration` and `desiredFacingDirection`. This keeps fuel, actuators, VFX, and owner telemetry on the existing flight-controller path.

## Invariants

- The locked `planHash` stays stable.
- No target or waypoint position snap is introduced.
- No velocity-zero shortcut is introduced.
- No silent replan is introduced.
- Idle and cancel drift preservation remain unchanged.
- Renderer and HUD remain telemetry consumers, not flight truth owners.
- TestBridge remains query-gated.
