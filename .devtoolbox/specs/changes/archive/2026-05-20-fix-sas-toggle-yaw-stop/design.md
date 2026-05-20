# Design: Fix SAS Toggle Yaw Stop

## Current Failure Signal

The reproduction is manual and direct:

1. SAS off.
2. Briefly press `A` to yaw left.
3. Release `A` so the ship keeps rotating in vacuum.
4. Enable SAS.
5. A relevant residual yaw motion remains instead of converging to almost zero.

The previous fix removed a coarse command cutoff, but this repro shows the controller still needs stronger convergence after SAS is enabled late.

## Intended Behavior

SAS should behave like an active angular-velocity brake. It should not need to be on during the original attitude input. If the ship is already rotating when SAS is enabled, SAS should use available RCS to counter that local angular velocity until the remaining yaw, pitch, and roll are below a near-zero threshold.

SAS-off behavior remains pure vacuum inertia: no passive damping and no hidden brake.

## Investigation Focus

Check these points before editing:

- Whether SAS braking torque is too weak relative to yaw inertia/nozzle torque.
- Whether the controller stops at the dead zone but still leaves visible yaw because the threshold is too high.
- Whether the SAS command changes sign too late or oscillates around zero.
- Whether the verification probe needs a full scenario simulation instead of a one-frame command test.

## Implementation Strategy

Prefer a minimal control-law improvement in `RcsThrusterController`: either tighten the angular velocity dead zone, strengthen SAS proportional/minimum braking, or add a small convergence/snap-to-zero safeguard only when SAS is enabled and angular velocity is below a tiny threshold. Avoid any damping when SAS is disabled.

If a snap/squash safeguard is needed, it must be explicitly SAS-gated and threshold-bound so it does not hide physics while SAS is off.

## Verification Strategy

Use Unity MCP for script edits and verification. Add a deterministic probe that models the exact user flow: SAS off yaw impulse, coast, SAS on stabilization window, final local yaw angular velocity below `0.005 rad/s`. Also verify pitch/roll and SAS-off inertia.

## Risks

- Too much braking can cause oscillation or fight manual input.
- Too low a threshold may require unrealistic simulation time with placeholder RCS.
- A SAS-only snap-to-zero threshold is acceptable for prototype feel only if documented and kept very small.
