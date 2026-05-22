# Spec: Space PvE Arena Loop v0

## Capability: Prototype Arena Objective

### Requirements

- The prototype shall provide a bounded PvE arena loop with a destroy-all-targets objective.
- Starting or resetting the arena shall create or restore at least three objective targets/enemies.
- Objective progress shall be derived from actual target alive/destroyed state, not from a timer or scripted completion shortcut.
- The arena shall transition to complete when all objective targets are destroyed.
- Completion shall expose a reward stub message or value that is non-persistent and does not introduce economy, inventory, loot, or unlock behavior.
- The loop shall be replayable/resettable in Play mode without requiring an editor scene reload.

### Expected Behavior

- A player can enter the prototype scene and receive a clear arena objective.
- Existing player weapons can destroy objective targets.
- The arena reports target count, destroyed count, remaining count, objective status, and reward stub.
- Resetting the arena returns the objective to active state and restores target count/progress deterministically.
- Missing or invalid target references fail safely by reporting inactive or incomplete state instead of throwing repeated runtime errors.

## Capability: Player-Facing Arena Status

### Requirements

- Player-facing UI shall show the current arena objective name, progress, completion state, and reward stub when complete.
- UI data shall be produced from a small snapshot/status model so tests can validate it without depending on frame rendering.
- The arena status shall coexist with existing flight, autopilot, RCS, fuel, camera, targeting, and HUD information.
- Debug-only controls may exist, but the required objective progress must be visible through player-facing status UI.

### Expected Behavior

- During the objective, the HUD shows an active objective and progress such as targets destroyed out of total targets.
- After completion, the HUD shows complete state and the reward stub.
- After reset, the HUD returns to active progress state.

## Capability: Deterministic Validation

### Requirements

- Deterministic tests shall cover target spawning/restoration, destruction-driven progress, completion, reward stub exposure, HUD snapshot output, and reset/replay behavior.
- Unity validation shall include script validation and focused EditMode or PlayMode tests where available.
- DevToolbox evidence shall be stored under `.devtoolbox/specs/changes/space-pve-arena-loop-v0/tests/`.

### Constraints

- Reuse existing combat, target, damage, registry, bootstrap, and HUD patterns where they fit.
- Keep enemies simple: stationary, slow drift, or simple patrol/chase only if already cheap to integrate.
- Do not build a full mission framework, full economy, multiplayer, advanced AI, factions, or loot.
- Do not hardcode editor-only scene hierarchy paths for runtime logic.
- Do not change gameplay code outside the prototype systems needed for this v0 loop.
