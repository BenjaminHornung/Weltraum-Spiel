# Design

## Change
`fix-flight-control-jitter-regression-v1`

## Approach
This is an evidence-preservation change. The existing test artifacts already document a PlayMode probe across translation, attitude, SAS, main thrust, visual switching, camera binding, and stale assist clearing.

## Evidence
The completed evidence lives in:

- `tests/test-protocol.md`
- `tests/logs/unity-playmode-movement.log`
- `tests/performance/movement-diagnostics.csv`
- `tests/screenshots/*.png`

## Risks
- This metadata repair should not imply new runtime behavior was changed during the archive-maintenance pass.
- Future gameplay changes should add fresh tests instead of relying only on this captured evidence.
