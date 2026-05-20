# Capability: Stabilization Overview

## Requirements

- This change stabilizes existing prototype control/runtime behavior only.
- Detailed behavioral requirements live in:
  - `startup-reset-defaults`
  - `runtime-state-consistency`
  - `autopilot-control-routing`
  - `momentum-assist-runtime`
  - `gimbal-default-consistency`
- Implementation must reuse the existing prototype controllers and UI components unless a small adapter is required to route state or requests cleanly.

## Acceptance

- All detailed specs validate together.
- Tests and documentation map back to the detailed spec files.