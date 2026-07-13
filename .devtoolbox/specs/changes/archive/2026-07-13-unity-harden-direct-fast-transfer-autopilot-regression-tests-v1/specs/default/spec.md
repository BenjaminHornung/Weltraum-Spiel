# Capability: DirectFastTransfer Autopilot Regression Detection

## Requirements

- Nominal DirectFastTransfer PlayMode traces must detect unexpected replan flags, `Replan:` status labels, plan revision changes, and revision resets.
- Nominal DirectFastTransfer traces must detect main-throttle drops during latched prograde burn, latched retrograde burn, and the burn-to-brake transition window.
- DirectFastTransfer traces must detect any main throttle published during flip/alignment-only phases.
- Soft tracking correction must be tested during burn, brake, and repeated correction cases without clearing actuator output or forcing nominal replans.
- Off-axis start and initial angular velocity scenarios must verify that delayed latch behavior does not create throttle pulses or replans.
- EditMode coverage must prove DirectFastTransfer soft-only reason mixes remain soft and hard/non-DFT divergence behavior still triggers normal safety paths.

## Expected Behavior

A regression that reintroduces throttle pulsing, plan flapping, or soft-correction actuator clearing should fail with diagnostics showing the phase, state, revision, reasons, throttle, and recent trace samples.

## Constraints

- This change must be test-only unless a new test exposes a current product defect.
- Reuse the existing PlayMode rig and DirectFastTransfer trace harness.
