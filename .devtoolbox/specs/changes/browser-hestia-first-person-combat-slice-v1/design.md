# Design

## Change
`browser-hestia-first-person-combat-slice-v1`

## Architecture Decisions

### Bounded authoritative region
V1 owns one deterministic Hestia `SurfaceRegion`, identified by body, local frame, region, generator version, seed, and monotonically revisioned terrain state. It makes no global planet-shell claim.

### Domain authority and projections
Player, collision, combat, and voxel-edit authority exchange plain renderer-independent values. Three.js, DOM, browser globals, workers, HUD, hashes used only for diagnostics, and TestBridge are excluded from these contracts. Presentation ports receive derived immutable snapshots for player, terrain, target, weapon, and impact and cannot mutate world, damage, or edit authority.

### Frame and revision binding
Every collision query and voxel edit is explicitly bound to a `surfaceFrameId` and region revision. Stale or mismatched inputs fail closed with typed rejection; no position snap or velocity-zero shortcut is permitted.

### Determinism and immutability
Public factories validate exact finite SI values, safe ticks/revisions, stable IDs, and dense plain data. They defensively copy nested values and freeze snapshots. Commands that need identity use canonical serialization and a stable hash so equal validated inputs yield equal identities.

### Existing authority reuse
- Existing Combat Core remains damage/event authority; the surface layer adapts accepted fire and hit information rather than duplicating damage rules.
- Adaptive/Structural microvoxel authority remains edit/revision/hash authority; surface contracts request `SubtractSphere` and expose typed receipts.
- SurfaceLocalFrame remains spatial authority; render-relative coordinates never become canonical gameplay state.
- Surface Lab remains independently reachable through `?surfaceLab=1` and is not changed.

### Route and UI boundary
The later normal player route is exactly `?surfacePlay=1`. Suit HUD exposes player-facing mode, movement, energy, heat, cooldown, target condition, and latest action/rejection only; worker, queue, region-hash, brick, and debug telemetry is excluded.

## Parallel Ownership
Agent 1 owns locomotion/collision, Agent 2 combat, Agent 3 Hestia presentation, Agent 4 voxel impact authority, Agent 5 Suit HUD, Agent 6 integration/route, and Agent 7 E2E/evidence/docs/review. Only Agent 0 and later Agents 6/7 may mutate `tasks.md` or toggle tasks. Worker agents must reuse the single change execution and add notes; they must not create per-task executions.

## Risks
- Remote feature branches predate current main and are not safe to merge wholesale.
- Hash formats differ across Combat, Voxel, and Adaptive modules; adapters must not relabel one authority hash as another.
- Terrain revisions can become stale between ray hit and edit submission.
- Freezing metadata does not make typed-array voxel channels immutable.
- Input ownership can leak ship/planner commands unless the later integration proves mode isolation.
- Hestia 0.25/0.50 m generation resolution and Adaptive 0.125 m quantum require an explicit adapter choice in the implementation task.

## Deferred Decisions
Final keybinds, weapon balance, full planet streaming, orbit/surface transition, first-ship story, broader damage taxonomy, cargo/ammo economy, and multiplayer are not decided here.