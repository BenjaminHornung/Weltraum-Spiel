# Proposal: Autopilot Large Local Test Range v1

## Problem

The current autopilot proving ground exposes strict point-arrival failures at prototype distances, but it is not meant to answer whether the autopilot remains stable and readable across larger local-space runs. After exact arrival is fixed, the project needs a deterministic local test range that can exercise kilometer-scale transfers without mixing in orbital navigation, gravity assists, or final-map content.

## Outcome

Define a future large local-space autopilot test range that validates deterministic 1km, 5km, and 10km navigation; obstacle corridors; return-to-origin behavior; lateral starts; Floating Origin readiness; and UI readability.

This change is spec-only. It does not implement the range.

## Dependency

Future implementation MUST wait until `fix-autopilot-exact-point-arrival-v1` is completed and verified.

Before this range can become an acceptance gate:

- `fix-autopilot-exact-point-arrival-v1` must pass.
- The current `autopilot-proving-ground-harness-v1` strict exact-arrival scenarios must pass without expected-current-bug status.
- Any future large-range thresholds must be based on the passing exact-arrival baseline, not on today's loose or failing behavior.

## Scope

- Programmatic, deterministic large local-space range for waypoint autopilot validation.
- Local-space distances of 1km, 5km, and 10km.
- Obstacle-corridor, lateral-start, and return-to-origin scenario families.
- Evidence requirements for distance error, final velocity, route phases, obstacle reacquire behavior, local coordinate magnitude, and UI readability.
- Readiness checks for a future Floating Origin layer while still running in local Unity space.

## Non-Goals

- No runtime code changes in this draft.
- No Unity test changes in this draft.
- No Unity scene changes in this draft.
- No new assets in this draft.
- No edits to current autopilot harness files in this draft.
- Not orbital navigation.
- Not gravity assist.
- Not a final game map.
- Not a replacement for the exact-arrival fix.
- Not a threshold-relaxation pass for current autopilot behavior.

## Success Criteria

- The future range is specified as additive and blocked behind exact-arrival success.
- Required scenarios cover 1km, 5km, 10km, obstacle corridors, return-to-origin, lateral starts, Floating Origin readiness, and UI readability.
- Verification for this draft is limited to DevToolbox spec validation.
