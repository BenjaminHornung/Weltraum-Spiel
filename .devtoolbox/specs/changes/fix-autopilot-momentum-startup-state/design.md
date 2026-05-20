# Design: Autopilot, Momentum and Startup State Stabilization

## Reuse Strategy

Reuse the existing prototype systems instead of creating parallel controllers:

- `PrototypeBootstrap` remains responsible for generated-scene assembly.
- `PlayerShipController` remains the single owner of control mode, SAS/RCS toggles, throttle clamping, and the diagnostics snapshot.
- `PrototypeWaypointAutopilot` remains the waypoint state machine but must route through a normal external-control request instead of debug pulses as its primary path.
- `PrototypeMomentumAssist` remains the physical kill-momentum assist and continues to use actuator requests only.
- HUD, `PrototypeDebugOverlay`, and `PrototypeFlightDebugConsole` must read the controller snapshot and assist/autopilot state rather than keeping local copies.

No new architecture layer is added beyond small request/snapshot extensions because this is a stabilization pass, not the final flight-control framework.

## Startup Reset Model

`PrototypeBootstrap.BuildPrototype()` may reuse an existing `PrototypeShip`. Reuse is fine, but the reused runtime state must be reset after modules/components are rebuilt:

- transform position/rotation reset to the configured spawn
- `Rigidbody.linearVelocity` and `Rigidbody.angularVelocity` reset to zero as a spawn reset
- main throttle reset to zero
- external assist request cleared
- autopilot and momentum assist aborted/reset
- control mode set to Normal
- RCS and SAS enabled
- SAS target rotation captured

Direct velocity assignment is acceptable only in this bootstrap/reset context. Runtime assists must not use direct velocity zeroing.

## Runtime State Snapshot

`PrototypeFlightControlDiagnostics` should become the shared display contract for flight-control status. It should distinguish armed/toggled state from effective/physical state:

- raw SAS enabled vs effective SAS enabled
- whether SAS/RCS currently has physical authority or actual torque/force
- RCS toggle state vs RCS availability and allocator status
- control mode and main/gimbal allowed flags
- waypoint autopilot engaged/state/status
- momentum assist active/state/status

The snapshot can include strings/enums for UI readability, but the owner should remain `PlayerShipController` plus bound `PrototypeWaypointAutopilot`/`PrototypeMomentumAssist` references.

## Autopilot Routing

Autopilot is a system-level controller, so engaging it from Precision or Translation should switch back to Normal/Cruise before it requests main thrust. Engagement should also enable SAS and RCS, clear conflicting momentum assist requests, and avoid stale manual input aborts for a short grace period.

The autopilot should send a bounded external assist/control request with source `WaypointAutopilot`, desired attitude/torque, desired RCS translation, and desired main throttle. If a full refactor is too large, a temporary adapter may translate the existing calculated commands into that request path, but debug pulse methods must not be the primary control path.

## Momentum Assist Runtime

The visible Kill Momentum command should call a UI-safe activation method that grants a short manual-input grace period. The assist must report explicit states and reasons instead of silently doing nothing. In Normal mode it may align and use main braking plus RCS damping. In Precision/Translation it must use RCS-only damping because main thrust is intentionally disabled.

The assist must keep the physical rule: no runtime direct velocity or angular velocity reset. It should generate force/torque requests through `FlightAssistRequest`, RCS allocator, main engine request, or `ShipPhysicsCore` force paths already present in the prototype.

## Gimbal Defaults

The calmer runtime gimbal behavior is the intended default. `PrototypeMainThrusterSettings.Default` and any built-in variant path that applies defaults must match:

- gimbal limit: 10 degrees
- response scalar: 0.14
- gimbal slew: 30 deg/s

This avoids runtime modules being reset back to older aggressive values when config defaults are applied.

## Risks

- Autopilot and momentum assist can compete if both are active. Engagement should abort or clear the other controller explicitly.
- EditMode physics tests can prove request generation and deterministic state, but full flight feel still needs manual Play Mode checks.
- Existing uncommitted art/visual-switcher work is unrelated and must be preserved.