# Design: DirectFastTransfer Regression Test Hardening

## Approach

Reuse the current PlayMode DirectFastTransfer trace loop because it already samples every physics step and has stable diagnostics. Extend it with additional invariant counters instead of adding a separate harness. This keeps the regression checks close to the existing DFT tests and avoids duplicating scene setup.

## Key Decisions

- Treat this as test-only hardening. If a new assertion exposes a real production bug, stop and create a bugfix plan rather than burying a product fix inside this test change.
- Parameterize soft tracking injection by phase so burn, brake, and repeated-correction scenarios share the same trace code.
- Count segment-boundary and flip-phase failures explicitly so short throttle pulses cannot hide between the existing burn/brake buckets.
- Keep brake-end tolerance: low throttle near planned brake completion is not considered a pulse when outside the latched full-brake envelope.
- Add EditMode guards for DFT soft reason combinations and non-DFT brake timing behavior to prevent the DFT exception from becoming global.

## Verification Strategy

Run fast EditMode checks first, then focused PlayMode DFT/terminal-flap checks. Use reviewer and Z.AI GLM review after implementation to catch missing scenarios and test flakiness risks.
