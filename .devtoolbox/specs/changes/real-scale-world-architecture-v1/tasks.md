# Tasks

## Phase 1
- [ ] Review `proposal.md` for `real-scale-world-architecture-v1`
- [ ] Refine `specs/default/spec.md`
- [ ] Implement and verify the change
# Tasks: Real-Scale World Architecture v1

## Phase 0: Architecture Docs

- [x] Create `docs/architecture/real-scale-world-architecture.md`
- [x] Create `docs/architecture/coordinate-spaces-and-floating-origin.md`
- [x] Create `docs/architecture/surface-local-frame-architecture.md`
- [x] Create `docs/architecture/background-simulation-boundaries.md`
- [x] Create DevToolbox proposal/design/tasks/spec artifacts
- [x] Define coordinate spaces and ownership of truth
- [x] Define floating-origin planning rules
- [x] Define SurfaceLocalFrame planning rules
- [x] Define background simulation boundaries
- [x] Define formal requirements for real-scale world architecture

## Phase 1: Coordinate Math Library Later

- [ ] Implement pure coordinate/frame math library later
- [ ] Add absolute/local round-trip tests later
- [ ] Add planet-centered conversion tests later
- [ ] Add velocity reference-frame tests later

## Phase 2: Absolute Entity State Later

- [ ] Implement durable absolute entity state later
- [ ] Add loaded/unloaded entity state tests later
- [ ] Add save/load reconstruction tests later

## Phase 3: Floating-Origin Test Harness Later

- [ ] Implement floating-origin runtime/test harness later
- [ ] Add origin-shift invariant tests later
- [ ] Add camera/HUD/autopilot shift evidence later

## Phase 4: SurfaceLocalFrame Prototype Later

- [ ] Implement SurfaceLocalFrame prototype later
- [ ] Add surface frame spawn/conversion tests later
- [ ] Add landed ship/player/resource/outpost frame tests later

## Phase 5: Ship/Player/Drone Handoff Later

- [ ] Implement ship/player/drone state handoff later
- [ ] Add cockpit/on-foot/drone save-load tests later
- [ ] Add cargo port and pickup target handoff tests later

## Phase 6: Background Simulation Tick Later

- [ ] Implement background simulation tick later
- [ ] Add deterministic drone/mining/outpost job tests later
- [ ] Add save/load no-duplicate-progress tests later

## Phase 7: Large Map/Orbit Integration Later

- [ ] Implement large map/orbit integration later
- [ ] Add map target descriptor handoff tests later
- [ ] Add landing zone to exact target point tests later

## Deferred By Design

- [ ] Unity prototype intentionally deferred
- [ ] Runtime implementation intentionally deferred
- [ ] Scene changes intentionally deferred
- [ ] Asset/prefab creation intentionally deferred
- [ ] Autopilot harness changes intentionally deferred
- [ ] Ship builder runtime changes intentionally deferred
