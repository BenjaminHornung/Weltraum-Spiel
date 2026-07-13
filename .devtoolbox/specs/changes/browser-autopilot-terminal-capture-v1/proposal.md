# browser-autopilot-terminal-capture-v1 Proposal

## Problem

The browser autopilot currently treats the default proving-ground navigation targets as `Arrived` while the ship is still moving at roughly 8 m/s. This comes from `navigationAlpha` and `navigationBeta` using `terminalSpeed: 8` with `stopBehavior: "MatchTerminalSpeed"`.

After `Arrived`, `AutopilotExecutor.step()` has an early branch that sets telemetry to `Arrived` and returns the previous `ShipState` before the FlightController can integrate drift, braking, or station-keeping. The visible ship therefore appears hard-stopped/frozen while the state can still contain nonzero velocity.

## Outcome

Default browser navigation targets must become real stop/capture goals. The executor must continue through the FlightController path during terminal capture and holding so velocity trends toward zero and the locked plan hash remains stable without snaps, velocity-zero shortcuts, or silent replans.

## Scope

- Change default proving-ground navigation target arrival semantics.
- Add executor terminal phase telemetry for TerminalBrake/Capture/Holding.
- Add a browser-native terminal capture/holding controller using desired acceleration through `applyFlightControllerStep()`.
- Add unit and Playwright coverage for terminal capture, no-freeze, no-snap, stable `planHash`, and fail-closed behavior.
- Add evidence screenshots/telemetry and update browser-mainline docs.

## Non-goals

- No Unity start/install and no `unity-legacy-final-2026-07:Assets/**` changes.
- No Demo Scout GLB visual parity removal and no procedural fallback removal.
- No VFX nozzle/per-nozzle allocator work.
- No silent replan, target snap, waypoint snap, or velocity-zero arrival shortcut.
- No full Unity terminal-capture/SAS parity claim.
