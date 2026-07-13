# Tasks: Autopilot Large Local Test Range v1

This task list is for future implementation after exact arrival is fixed. The current change is spec-only.

## Phase 0 - Prerequisite

- [ ] Complete and verify `fix-autopilot-exact-point-arrival-v1`.
- [ ] Confirm `autopilot-proving-ground-harness-v1` strict exact-arrival gates pass without expected-current-bug status.
- [ ] Record the passing exact-arrival baseline that the large local range will extend.

## Phase 1 - Range Definition

- [ ] Define additive scenario data for 1km, 5km, and 10km local-space transfers.
- [ ] Define lateral-start scenarios with starting offset, initial lateral velocity, and terminal hold gates.
- [ ] Define obstacle-corridor scenarios with deterministic obstacle placement and avoid/reacquire expectations.
- [ ] Define return-to-origin scenarios that validate outbound navigation followed by a stable local-origin return.

## Phase 2 - Evidence Model

- [ ] Define per-step CSV fields for position, velocity, autopilot state, navigation phase, obstacle state, local-origin magnitude, and UI-readable distance.
- [ ] Define suite summary JSON fields for pass/fail status, final error, final speed, max local coordinate magnitude, scenario duration, and Floating Origin readiness notes.
- [ ] Define markdown protocol sections for baseline dependency, scenario results, known limitations, and follow-up risks.

## Phase 3 - Future Implementation

- [ ] Implement the range as a separate additive harness without editing current autopilot harness files.
- [ ] Keep setup programmatic; do not require a Unity scene or authored assets.
- [ ] Add UI readability capture using existing player-facing navigation surfaces.
- [ ] Keep orbital navigation, gravity assist, and final-map behaviors out of the range.

## Phase 4 - Future Verification

- [ ] Run focused large-local-range PlayMode coverage after the prerequisite baseline is green.
- [ ] Verify 1km, 5km, 10km, lateral-start, obstacle-corridor, return-to-origin, Floating Origin readiness, and UI readability scenarios.
- [ ] Store evidence under `.devtoolbox/specs/changes/autopilot-large-local-test-range-v1/tests/`.
- [ ] Run `specs_validate autopilot-large-local-test-range-v1`.

## Current Draft Verification

- [ ] Run `specs_validate autopilot-large-local-test-range-v1`.
- [ ] Do not run Unity tests for this draft.
