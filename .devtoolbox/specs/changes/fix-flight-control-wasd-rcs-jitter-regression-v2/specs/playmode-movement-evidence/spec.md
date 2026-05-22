# Capability: playmode-movement-evidence

## Requirement
The change SHALL store concrete Unity PlayMode evidence for the default/imported Blender ship under `.devtoolbox/specs/changes/fix-flight-control-wasd-rcs-jitter-regression-v2/tests/`.

## Scenarios
- The evidence protocol records scene, visual mode, driver, Unity version, pass/fail checks, and final verdict.
- The log records per-phase movement diagnostics for idle, translation, attitude, SAS comparison, imported visual movement, F6 switching, and external assist priority.
- The CSV contains the required flight-control columns for commands, velocities, desired/actual/residual force and torque, allocator status, nozzle counts, throttle, camera error, and cache refresh counts.
- Screenshots are captured for idle SAS on, forward translation, left/right translation, normal attitude SAS on, and imported ship translation.

## Constraints
- Evidence must come from Unity PlayMode or Unity-MCP runtime execution of the real scene/components.
- If Unity Editor or MCP prevents full GUI/GameView proof, the blocker must be documented with logs and the unmet acceptance criteria.
