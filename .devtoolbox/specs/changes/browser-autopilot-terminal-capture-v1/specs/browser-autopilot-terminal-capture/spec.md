# browser-autopilot-terminal-capture Specification

## Capability

Browser autopilot terminal capture and holding for proving-ground navigation targets.

## Requirements

1. `navigationAlpha` and `navigationBeta` MUST be stop/capture targets, not 8 m/s match-speed fly-through targets.
2. Stop/capture targets MUST NOT report `Arrived` unless distance is within the arrival radius and speed is at or below the terminal speed limit.
3. For StopWithinEnvelope targets, terminal speed MUST be 0.5 m/s or lower unless evidence justifies a different stricter value.
4. `AutopilotExecutor.step()` MUST NOT freeze a locked-plan ship by returning an unchanged state from an early `Arrived` branch.
5. Once captured, the executor MUST continue controller integration in a Holding phase while the locked plan remains active.
6. Terminal capture and holding MUST use `applyFlightControllerStep()` and actuator telemetry, not renderer-side corrections.
7. The locked `planHash` MUST remain unchanged throughout terminal brake, capture, and holding.
8. The runtime MUST NOT snap position to target or zero velocity as an arrival shortcut.
9. Fail-closed states for fuel, authority, main-thruster, and brake-reserve failures MUST remain fail-closed and preserve the locked plan hash.
10. TestBridge, GLBLoaded visual parity, procedural fallback, HUD snapshot/ViewModel flow, and renderer-not-truth invariants MUST remain intact.

## Expected behavior

- Approaching a default navigation target at overspeed enters terminal braking/capture and remains `Executing` until speed is within the terminal limit.
- Entering the stop envelope at approximately 8 m/s is not `Arrived`.
- After capture, telemetry reports `status: "Arrived"` with `arrivalPhase: "Holding"` or equivalent.
- Additional ticks after arrival continue to integrate and reduce/hold velocity rather than freezing contradictory nonzero velocity.
- Evidence exposes terminal speed, current speed, terminal error, radial/tangential speed, distance, desired terminal velocity, and capture/holding activity through executor telemetry.

## Non-goals

- No Unity runtime work.
- No `Assets/**` mutation.
- No VFX nozzle allocator or per-nozzle particle parity.
- No full Unity terminal-capture parity claim.
