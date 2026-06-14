# Tasks

## Phase 0: Planning Docs

- [x] Read current concept and architecture docs for surface play, resources, exploration, outposts, factions, ship builder, current prototype state and real-scale world architecture.
- [x] Create `docs/spielkonzept/drones-remote-missions.md`.
- [x] Create `docs/architecture/background-simulation-drones.md`.
- [x] Create `docs/spielkonzept/drone-types-and-progression.md`.
- [x] Create `docs/spielkonzept/drone-surface-mining-logistics.md`.
- [x] Create DevToolbox proposal, design, tasks and formal spec for `drones-remote-missions-background-sim-v1`.
- [x] Run scoped spec/docs validation for this planning-only change.

## Phase 1: Drone Mission Data Model Later

- [ ] Define runtime drone, mission, route, risk, cargo plan and mission event data structures.
- [ ] Add save/load-safe mission ids, owner/faction context and target references.
- [ ] Add focused data model tests for serialization, stable ids and blocked prerequisites.

## Phase 2: Deterministic Background Tick Later

- [ ] Implement deterministic mission tick for travel, extraction, cargo transfer and energy consumption.
- [ ] Add deterministic tick tests for repeated runs and save/load continuation.
- [ ] Add blocked/failure reason outputs for low energy, full cargo and missing target.

## Phase 3: One Mining Drone Prototype Later

- [ ] Add one scout/mining drone record and minimal loaded presentation hook.
- [ ] Support assigning the drone to one known resource node.
- [ ] Keep behavior data-first and avoid full AI/pathfinding scope.

## Phase 4: Ship Cargo Transfer Later

- [ ] Connect drone cargo output to the shared ship cargo target.
- [ ] Enforce cargo mass/volume/resource identity constraints.
- [ ] Add tests for no duplicate cargo on tick completion and save/load.

## Phase 5: Surface Resource Integration Later

- [ ] Connect drone mining to one surface resource node record.
- [ ] Deplete node mass deterministically while filling drone/ship cargo.
- [ ] Report node depleted, cargo full and tool/energy blocked states.

## Phase 6: UI/Status Panel Later

- [ ] Add a minimal drone mission status panel or ship-computer surface.
- [ ] Show state, target, cargo, ETA, risk, blocked reason and recall action.
- [ ] Add player-facing notification rules for complete, warning, distress and failure.

## Phase 7: Combat/Security Drone Later

- [ ] Define minimal combat/security drone mission behavior and rules of engagement.
- [ ] Integrate ammo/energy consumption and faction/legal consequences.
- [ ] Add deterministic hostile-zone risk handling before full combat AI.

## Phase 8: Remote Camera/Control Later

- [ ] Define remote camera/control activation, wake conditions and return-to-body safety.
- [ ] Load real Unity drone objects only when the player watches, controls or intervenes.
- [ ] Add recovery behavior for lost link, disabled drone and recall failure.
