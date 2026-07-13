# Proposal: Stabilize Autopilot Arrival Terminal Capture v1

## Problem

`PrototypeWaypointAutopilot` can destabilize during `DirectFastTransfer` arrival when terminal capture and brake hold logic oscillate between taper/release conditions near the target. This shows up as brief re-accel events, throttle edge chatter, and reduced approach settlement quality after the terminal phase begins.

The control currently allows terminal capture to release and re-enter too quickly when range, speed, and alignment signals fluctuate close together. We need a conservative gate so the terminal hold feels intentional and stable without broadening current DFT behavior.

## Outcome

Add a conservative `DirectFastTransfer` arrival terminal capture and brake hold stabilization plan that reduces terminal oscillation and prevents brake throttle chatter, while keeping immediate safety and hard-abort semantics intact.

## Scope

- `DirectFastTransfer` arrival terminal capture state transitions during approach completion.
- Conservative terminal capture gate and brake throttle taper/release guard definitions.
- EditMode + PlayMode verification plan for throttle taper, hold capture, and no-regression evidence.
- Placeholder evidence files under `.devtoolbox/specs/changes/stabilize-autopilot-arrival-terminal-capture-v1/tests`.

## Non-Goals

- Full arrival replanner or phase refactor.
- Obstacle replan debounce behavior.
- Player UI or input-path changes.

## Target Outcome

- Terminal capture triggers only when entry conditions are stable.
- Brake throttle ramps down predictably and does not reopen from signal jitter.
- Evidence package includes baseline and stabilized DFT/arrival behavior measurements.

## Constraints

- No production code changes in this step.
- Keep edits scoped to this change scaffold only.

