# Design: Stabilize Autopilot Arrival Terminal Capture v1

## Current Instability Pattern

Terminal capture in `DirectFastTransfer` transitions from approach to settle with short-range signals that can alternate: distance crosses terminal threshold, speed crosses throttle release bands, and attitude alignment jitter remains transient. When these alternations happen close together, brake throttle and hold capture can release/re-arm repeatedly.

## Minimal Design

Keep the existing DFT state flow and add a conservative terminal capture hold layer:

1. Add `TerminalCaptureStability` gate around terminal capture entry/exit.
2. Record a short stability run for capture arm and release conditions.
3. Use a throttle taper envelope once terminal capture is armed:
   - gradual command reduction over a bounded window,
   - then a hold throttle floor,
   - then a gated release branch only after release conditions remain stable.
4. Preserve direct emergency and safety behavior; this is arrival-only damping, not removal of immediate-stop semantics.

## Data and State

- `terminalCaptureState` (enum): `Idle`, `Arming`, `Capturing`, `Releasing`.
- `terminalCaptureArmedAt` (fixed-time), `terminalCaptureCaptureAt`.
- `terminalCaptureEntryWindowSeconds` (config, short, e.g. 0.1-0.25).
- `terminalBrakeTaperWindowSeconds` (config, short, e.g. 0.2-0.4).
- `terminalReleaseHoldWindowSeconds` (config, short, e.g. 0.2-0.35).
- `terminalReleaseSpeedDeadband`, `terminalReleaseAlignmentDeadband`.

## Rules

- Capture entry is delayed until `Arming` conditions stay valid for the entry window.
- Tapered brake request is only applied in `Capturing` state.
- Repeated toggling between valid/invalid arrival signals within `terminalReleaseHoldWindowSeconds` is ignored.
- Release is allowed only when both speed and alignment remain inside release deadbands for the hold window.
- Emergency or hard safety branches continue to bypass capture smoothing and reassert direct authority.

## Risk and Correctness

- Conservative defaults should reduce terminal oscillation and re-accel chatter without delaying true safe-stop behavior.
- Immediate abort/replan paths remain unchanged by scope.
- This design narrows behavior change to a terminal-state gate, minimizing cross-cutting impact.

## Constraints

- No arrival planner rewrite.
- No production code changes in this scaffold phase.
- No unrelated `DirectFastTransfer` behavior outside terminal capture and brake hold.

