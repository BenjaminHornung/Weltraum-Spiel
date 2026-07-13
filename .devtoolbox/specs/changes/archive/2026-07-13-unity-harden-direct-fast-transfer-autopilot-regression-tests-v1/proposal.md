# Proposal: Harden DirectFastTransfer Autopilot Regression Tests

## Motivation

The DirectFastTransfer smoothness fix added focused checks for nominal replan and throttle pulsing, but the regression surface still has gaps around segment transitions, brake-phase soft tracking, revision resets, and delayed latch conditions. We need the tests to catch future autopilot flapping regressions before manual playtesting.

## Outcome

The PlayMode suite should fail when a nominal DirectFastTransfer flight shows unexpected replan status, plan revision jumps/resets, main-throttle pulses during latched burn/brake, throttle during flip phases, or actuator clearing during soft tracking correction. EditMode tests should preserve the boundary between DirectFastTransfer soft correction exceptions and hard/non-DFT divergence behavior.

## Scope

- Harden tests and diagnostics only.
- Reuse the existing DirectFastTransfer trace harness and existing autopilot test patterns.
- Save focused verification evidence under this change's `tests/` folder.

## Non-Goals

- Do not change gameplay/autopilot product behavior as part of this change.
- Do not broaden into full-suite performance or visual screenshot automation.
