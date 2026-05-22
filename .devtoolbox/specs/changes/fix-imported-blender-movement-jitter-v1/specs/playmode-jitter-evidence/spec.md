# playmode-jitter-evidence

## Requirements

- Evidence must run in `Assets/Scenes/PrototypeBootstrapHost.unity` in Unity PlayMode.
- Evidence must cover ImportedDemoScout ChaseLocked translation, ImportedDemoScout Orbit/Side comparison, GeneratedPrimitives comparison, SAS on/off, DockingAssist enabled/disabled, and a short ImportedDemoCargo probe.
- Evidence artifacts must be stored under `.devtoolbox/specs/changes/fix-imported-blender-movement-jitter-v1/tests/`.
- CSV rows must include ship, Rigidbody, visual, functional rig, camera, focus, bounds, RCS, assist, and classification metrics.

## Expected Behavior

The final protocol identifies the pre-fix classification and the post-fix result. ImportedDemoScout in ChaseLocked translates visibly smoothly without camera spikes, visual root drift, force flipping, or assist conflicts.