# Design

## Trace-proven root cause

The failure is not a stale segment handoff and not a false geometric off-route result. The terminal segment is active from tick 4013. In `StopWithinEnvelope`, the executor calculates `needsBraking` but returns the terminal PD command for the entire terminal segment, so the existing hard-brake and distance/segment-speed-cap path is bypassed outside the actual capture envelope.

On the 650 m terminal leg the ship accelerates to about 70.217 m/s, crosses within 0.485 m of the target at about 37.010 m/s, correctly fails the 0.5 m/s arrival-speed gate, then physically overshoots the finite locked segment. At divergence, projection `t=1.047613`, axial overshoot is about 30.970 m, and finite-segment distance equals endpoint distance; strict `OffLockedRoute` is therefore correct.

## Chosen correction

Reserve the terminal PD capture command for positions inside the actual arrival/capture envelope. Outside that envelope, `StopWithinEnvelope` terminal execution must reuse the existing bounded hard-braking and distance-limited `segment.desiredSpeed` path. This is general for terminal legs of arbitrary length and does not alter route geometry, divergence thresholds, planner calls, or arrival gates.

## Rejected alternatives

- A handoff corridor or next-segment distance check does not address the failure because the terminal segment is already active for 469 ticks before divergence.
- Loosening `divergenceDistance` would hide a real finite-segment departure.
- Expanding the terminal route past the target or accepting high-speed target crossing would weaken locked geometry or arrival truth.
- Course-specific speeds/constants would not generalize.

## Preserved invariants

- Planner is not called during execution; no plan replacement or silent replan.
- `planHash` remains stable.
- Real lateral disturbances still become `Diverged / OffLockedRoute` with `replanRequired=true`.
- No position or waypoint snap, velocity-zero shortcut, direct velocity clamp, global acceleration increase, or terminal-envelope weakening.
- FlightController retains physical actuation and terminal-arrival ownership.
- UI/render/runtime-command/Assets/package files remain untouched.

## Verification strategy

Retain a deterministic before trace covering the valid handoff, braking transition, target crossing, first threshold crossing, and final 100 ticks. Add focused unit coverage for a high-speed/long terminal-segment approach and true departure near a handoff. Update the 2500 m classification and query-gated browser acceptance only after the fixed scenario physically arrives. Keep the 1000 m, direct 2500 m Safe/Balanced/Fast, blocked corridor, and real disturbance cases unchanged. Run the complete requested unit/build/Playwright matrix, parse JSON evidence, and run forbidden-path plus diff checks.
