# Design: Fix WASD SAS Residual Momentum

## Current Failure Signal

The user-observed overlay can show non-zero angular velocity, non-zero SAS command, but zero estimated RCS torque/nozzle activity. Pitch/yaw stabilization from W/A/S/D feels weaker than roll stabilization from Q/E and stops before the ship is fully stabilized.

## Intended Behavior

SAS is a counter-command system, not passive drag. When SAS is enabled and attitude input is released, it should command available RCS nozzles to oppose angular velocity on pitch, yaw, and roll until the residual angular velocity is below a small near-zero threshold.

With SAS disabled, the existing vacuum behavior stays intact: released input does not magically remove angular velocity.

## Investigation Focus

Check these likely failure points before editing:

- Axis mapping between `PlayerShipController` attitude vectors and `RcsThrusterController` torque requests.
- Dead zone or command threshold values that may suppress small pitch/yaw braking while visible momentum remains.
- RCS nozzle selection scoring that may fail to find pitch/yaw torque candidates even when SAS produces a command.
- Debug overlay values that may hide the difference between requested SAS torque and actual selected RCS nozzles.

## Implementation Strategy

Prefer a minimal fix in the existing controller path. Keep the current transform-driven RCS model and avoid a broad solver rewrite. If the problem is thresholding, lower or scale thresholds so SAS continues braking visible residual angular velocity. If the problem is axis/nozzle scoring, fix the mapping so pitch/yaw candidates are selected consistently with roll.

The overlay should keep reporting angular velocity, SAS command, active nozzle count, and estimated torque so this behavior can be manually verified from play mode.

## Verification Strategy

Use Unity MCP for script validation, compilation, console checks, and any play-mode probes. Verification should compare SAS-off inertia against SAS-on braking for pitch, yaw, and roll.

## Risks

- Too much counter-command can create oscillation. The fix should avoid overcorrecting by using an angular-velocity dead zone near zero.
- Pitch/yaw and roll may have different available torque because the placeholder RCS layout is not physically identical on every axis. The target is reliable convergence, not identical acceleration numbers.
- Debug-only values must not become new gameplay dependencies.
