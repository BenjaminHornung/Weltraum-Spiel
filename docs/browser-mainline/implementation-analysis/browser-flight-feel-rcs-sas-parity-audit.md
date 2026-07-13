# Browser Flight Feel RCS/SAS Parity Audit

Branch: `analysis/browser-flight-feel-rcs-sas-parity-v1`

Scope: analysis/spec-only package for `browser-flight-feel-rcs-sas-parity-v1`.
Forbidden paths honored: no changes to `apps/weltraum-browser/src/**`, `apps/weltraum-browser/tests/**`, `apps/weltraum-browser/evidence/*.png`, `apps/weltraum-browser/package.json`, `apps/weltraum-browser/package-lock.json`, or `unity-legacy-final-2026-07:Assets/**`.

## Executive summary

Unity already has the richer flight-feel model: explicit Cruise/Precision/Translation behavior, persistent throttle with spool and cut/full overrides, RCS toggle and allocator diagnostics, SAS with hold/kill/invert-style behavior, and player HUD labels that explain why an actuator is active or disabled.

The browser is not missing the entire control stack. It already has the control-mode enum, input state, controller gating, flight snapshot/telemetry, and executor protections that preserve manual/idle requests. The remaining work is to make those seams feel distinct and player-readable: Precision needs a real differentiation from Cruise, throttle needs inertia/spool instead of direct command feel, RCS needs clearer translation-vs-rotation authority, SAS needs more than damping-only behavior, and the HUD/visualization story needs browser-native telemetry rather than a Unity nozzle-tree port.

## Unity capability table

| Topic | Unity source(s) | Capability in Unity | Browser parity implication |
| --- | --- | --- | --- |
| Cruise / Precision / Translation | `PlayerShipController.cs`, current prototype state doc | `Normal` is Cruise, `Precision` and `Translation` force RCS on, and `Caps Lock`/HUD mode controls cycle Cruise -> Precision -> Translation -> Cruise. | Browser already exposes the mode enum, but Precision must become behaviorally distinct rather than a label-only variant. |
| Throttle | `PlayerShipController.cs`, `MainThrusterModule.cs` | Persistent main throttle, spool up/down, `X` cut throttle, `Y`/`Z` full throttle, `Shift`/`Ctrl` ramp in Cruise, and COM-safe / physical thrust behavior with thermal and fuel gating. | Browser currently treats throttle more like a direct command. It needs an applied-vs-commanded feel model and no-snap/no-idle-zero protection. |
| RCS toggle | `PlayerShipController.cs`, `RcsThrusterController.cs` | `R` toggles RCS; Precision and Translation force it on. Manual attitude and translation inputs can route through RCS with axis-specific masking. | Browser already has `rcsEnabled` and RCS gating, so the work is authority refinement, not invention. |
| SAS | `PlayerShipController.cs`, `RcsThrusterController.cs` | `T` toggles SAS; `SasControlMode` supports KillRotation/HoldAttitude; behavior is PD-like, uses local angular velocity plus angular error, and masks manual axes through the RCS/SAS path. | Browser already has toggleable SAS damping. It needs a clearer browser-native stabilization contract, readable effectiveness, and explicit scope boundaries before any hold-attitude behavior is attempted. |
| Translation controls | `PlayerShipController.cs` | Translation mode remaps movement to RCS translation while keeping roll separate; vertical translation mapping exists but the current H/N split is a documented open point. | Browser already has translation commands, but the exact control legend and feel mapping must be finalized without copying Unity bindings blindly. |
| Pitch / yaw / roll | `PlayerShipController.cs`, `RcsThrusterController.cs` | W/S/A/D/Q/E drive attitude in Cruise/Precision; SAS/RCS masking can influence axes and assist released stick inputs. | Browser has `rotationCommand`, but the response curve and axis authority need feel tuning. |
| Main thruster | `PlayerShipController.cs`, `MainThrusterModule.cs` | Main thrust is gated by mode, can be assist-owned, and includes fuel burn, thermal gating, gimbal lag, and force/torque telemetry. | Browser has main-thrust telemetry, but not the spool, lag, and assist-owned feel model. |
| RCS allocator diagnostics | `RcsThrusterController.cs` | Stable/experimental solvers, nozzle allocation, residuals, saturation, fuel requested/consumed, active nozzle IDs, and torque authority are exposed. | Browser actuator telemetry is coarser; per-nozzle allocation is missing and should be staged, not blindly copied. |
| HUD / diagnostics | `PrototypeRuntimeDataSnapshots.cs`, `PrototypePlayerHud.cs` | Runtime snapshots and readable labels show main ready/disabled, RCS ready/off/no authority, SAS on/inverted/off/ineffective, plus warning and assist chips. | Browser needs player-readable status, not only low-level state. A dedicated HUD/telemetry slice is warranted. |
| Camera / feel | current prototype state doc, `PlayerShipController.cs` | Camera mode cycling and follow/orbit behavior are part of the feel surface, but they are not control authority. | Treat camera as presentation-only. It can support feel, but it must not alter flight semantics. |

## Browser comparison matrix

| Topic | Browser current state | Status | Gap |
| --- | --- | --- | --- |
| Cruise / Precision / Translation | `FlightControlMode` already exists; `ManualFlightInputState` carries `controlMode`; `FlightController` gates main thrust, RCS translation, and SAS damping; `executor` preserves manual/idle requests. | present, but approximated | Precision lacks a distinct behavior contract; mode labels exist before the feel model does. |
| Throttle | Browser has `mainThrottleCommand` and carries it through the executor. | approximated | No spool/inertia/applied-throttle layer yet; direct feel risks snapping or over-responding. |
| RCS toggle | `rcsEnabled` is present in input, ship state, and controller gating. | present | Needs clearer player-facing authority readout and finer separation of translation vs rotation. |
| SAS | `sasEnabled` exists; `applyFlightControllerStep` can damp angular motion when authority is available. | approximated | Damping-only SAS is not the same as Unity's hold/kill/invert feel or axis masking. |
| Translation controls | `translationCommand` exists and Translation mode is explicitly modeled. | present, but approximated | Input mapping and motion feel need explicit tuning; H/N behavior is still unsettled. |
| Pitch / yaw / roll | `rotationCommand` exists and is used by the controller. | present, but approximated | Response curves and axis masking are not yet treated as a dedicated feel surface. |
| Main thruster | Cruise-only main thrust gating exists in the controller. | present, but approximated | No assist-owned throttle, spool, thermal lag, or physical-feel envelope. |
| RCS allocator diagnostics | Actuator telemetry exposes active flags and last applied acceleration/torque only. | missing | No nozzle-level allocation, residuals, saturation, or per-nozzle status. |
| HUD / diagnostics | Flight snapshots exist in the runtime/executor layer, but no parity-level player labels are evidenced here. | missing | Need player-readable flight status and assist state that explains why controls are active or disabled. |
| Camera / feel | Camera mode enum exists in input state; feel coupling is not yet defined. | approximated | Camera should stay presentation-only while supporting motion readability. |

The browser is therefore in a "present but incomplete" state for most flight concepts. This is good news: the task is to refine the control contract and presentation, not rebuild a controller from scratch.

## What must not be ported 1:1 from Unity

- Do not copy the Unity Rigidbody / child-nozzle / socket discovery topology.
- Do not require imported GLB hierarchy names to define control behavior.
- Do not copy stable-vs-experimental allocator mechanics unless a diagnostic slice explicitly needs them.
- Do not recreate hidden assist-owned main throttle or gimbal ownership as a literal implementation detail.
- Do not treat the H/N translation split as settled truth; verify the control legend before freezing bindings.
- Do not port IMGUI debug surfaces as the player-facing contract.
- Do not carry Unity force constants or PD coefficients over unchanged just because they exist.
- Do not break the browser's no-snap / no-idle-zero protection when manual input is absent.

## Implementation direction and suggested next slices

1. Lock the browser-native control-mode contract first: Cruise, Precision, and Translation must each have a distinct authority profile and feel.
2. Add applied-throttle inertia/spool in the browser controller layer so manual throttle feels persistent instead of instantaneous.
3. Separate RCS translation from rotation in the browser telemetry and input routing, then expose readable status for both.
4. Upgrade SAS from simple damping telemetry to a browser-native stabilization contract with explicit state and readable effectiveness; keep full hold-attitude behavior optional/deferred unless a later product decision requires it.
5. Stage RCS/nozzle visualization as browser markers or debug primitives first; keep it independent from GLB/socket work.
6. Expand HUD telemetry so the player can see why throttle/RCS/SAS are active, disabled, inverted, or ineffective.

## Open questions

- What exact translation mapping should the browser control legend settle on for the up/down translation axis?
- Should Precision be "fine attitude control" or "RCS-only attitude mode" in the browser feel contract?
- Which parts of Unity's SAS hold/kill/invert behavior are required for parity versus merely useful as reference behavior, and should HoldAttitude remain deferred for v1?
- How much of the main-thruster assist ownership should stay hidden in the browser versus surfaced as telemetry?
- Which camera feel changes are presentation only, and which (if any) belong to the flight-feel slice?

## Future verification expectations

- Bounded unit coverage for mode gates, throttle ramping, RCS translation/rotation separation, and SAS effectiveness.
- Browser evidence for manual flight feel, including mode switching, throttle change, and camera changes that do not alter authority.
- Regression coverage for no-snap / no-idle-zero behavior when manual input is absent.
- HUD evidence showing readable status instead of actuator-only telemetry.
