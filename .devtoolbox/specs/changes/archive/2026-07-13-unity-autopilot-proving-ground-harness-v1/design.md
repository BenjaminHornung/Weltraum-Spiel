# Design: Autopilot Proving Ground Harness v1

## Approach

The proving ground is a programmatic PlayMode test rather than a scene asset. Each scenario builds a deterministic ship, target, and optional obstacles, runs scripted physics, samples the autopilot every FixedUpdate, and writes artifacts before asserting failures.

## Scenario Model

Each scenario defines:

- name
- target position
- initial ship position, velocity, rotation, and angular velocity
- obstacle list
- maximum arrival error, final speed, final angular speed, completion time, and safety replans
- allowed planner profiles
- obstacle-avoidance expectation
- gravity flag, default false
- harness-only RCS/main authority knobs

## Metrics

The harness samples exact target distance, relative/closing/lateral speed, autopilot state, navigation and flight-plan phases, active segment, requested and actual main/RCS commands, planner timing, replan state, candidate selection, obstacle status, terminal latch diagnostics, transition counters, minimum distance, and maximum distance after first entering the 2m range.

## Reporting

Every scenario writes `tests/performance/<scenario>.csv`. The suite writes `tests/autopilot-proving-ground-summary.json` and `tests/test-protocol.md`. Scenario status is one of `PASS`, `FAIL_EXPECTED_CURRENT_BUG`, `BLOCKED_BY_TEST_SETUP`, or `NOT_RUN`.

## Constraints

Autopilot behavior must remain unchanged. Production edits are limited to read-only diagnostics required for measurement.
