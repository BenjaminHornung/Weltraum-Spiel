# Design

## Change
`real-scale-world-architecture-v1`

## Architecture Notes
- Document important decisions only when they matter.

## Risks
- List technical risks or migration concerns.
# Design: Real-Scale World Architecture v1

## Status

Architecture/spec only. This change intentionally does not implement code, tests, scenes, assets, prefabs, UI, autopilot harness changes or ship-builder runtime changes.

## Chosen Architecture Shape

The future world architecture should use three layers of truth:

1. Durable absolute state for long-lived entities.
2. Explicit frame descriptors for conversions and handoffs.
3. Local Unity projections for active physics, rendering and interaction.

The practical rule is:

```text
Save/load, map, background simulation and long-lived jobs use durable state.
Rigidbody, camera and local combat use the current local physics projection.
Surface play uses a named SurfaceLocalFrame anchored to a planet/site.
```

## Key Decisions

### Absolute State Owns Long-Lived Position

Ships, drones, outposts, resource nodes, deployed drills, important wrecks, surface sites and cargo containers must be representable without a loaded Unity GameObject. This keeps save/load, background simulation and map state stable.

### Local Physics Is A Projection

Unity transforms and Rigidbody state are the active local projection. They can be shifted by floating origin and rebuilt from durable data. They should not be the only source of truth for real-scale location.

### Frames Travel With Coordinates

Any cross-system coordinate should carry its frame descriptor. A map marker, target point, landing pad, cargo port, drone mission target or surface node should not be passed as a naked local vector.

### SurfaceLocalFrame Is First-Class

Planet gameplay should not be a free-floating Unity scene. A `SurfaceLocalFrame` defines the local tangent axes, surface up, anchor, site identity and conversion back to planet/system coordinates.

### Exact Arrival Remains Protected

Landing zones, outposts and pickup areas can be broad concepts, but navigation execution must resolve them to exact target points plus arrival gates. This keeps the exact-arrival autopilot work valuable for landing, cargo pickup and drone rendezvous.

### Background Simulation Is Data-Driven

Unloaded drones, drills, cargo transfer, outpost services, faction events and resource depletion should progress through durable jobs and deterministic events, not hidden active Unity objects.

## Reuse Strategy

Future implementation should reuse existing concepts where appropriate:

- existing local-space autopilot exact target semantics,
- existing Navigation Computer diagnostics style,
- existing ship-local `+Z` forward, `+Y` up, `+X` right convention,
- existing resource/cargo/inventory draft vocabulary,
- existing drone/remote mission planning concepts,
- existing DevToolbox evidence convention under change-specific `tests/`.

This change does not extract shared runtime utilities. That belongs in later implementation slices.

## Integration Boundaries

| System | Boundary |
| --- | --- |
| Autopilot | Consumes explicit target/frame data; local exact-arrival remains separate from future orbit/landing planners. |
| Map/HUD/scanner | Display derived positions and status; they do not own gameplay truth. |
| Ship builder | Uses ship-local part coordinates and metadata; runtime spawn converts sockets into active frame coordinates. |
| Cargo/resources | Store durable container/resource state; loaded visuals are projections. |
| Drones | Loaded drones can use local simulation; unloaded drones use mission/job state. |
| Outposts | Store services, storage, owner and target points as durable site data. |
| Save/load | Reconstructs the active frame from absolute and frame-relative state. |

## Implementation Slicing

### Phase 0: Architecture Docs

Goal:

- Create the architecture and formal spec package.
- Define coordinate spaces, ownership of truth, floating origin, surface frames, background boundaries and phased implementation order.

Files likely touched later:

- None for implementation in this phase.
- This phase only creates Markdown/spec files under `docs/architecture/` and `.devtoolbox/specs/changes/real-scale-world-architecture-v1/`.

Tests/evidence needed later:

- `specs_validate real-scale-world-architecture-v1`.
- Markdown scope check and commit file scope check.

Non-goals:

- No runtime code.
- No Unity tests.
- No dotnet build.
- No scenes/assets/prefabs.

Risks:

- Architecture could be too broad unless later slices keep small, testable boundaries.

### Phase 1: Coordinate Math Library Later

Goal:

- Add pure math types and conversion functions for absolute, local, planet-centered, surface and ship-local frames.
- Keep the library scene-independent and test-first.

Files likely touched later:

- New runtime math/data files under a future allowed runtime change.
- New EditMode or pure C# tests for frame conversion.

Tests/evidence needed later:

- absolute/local round trip,
- planet-centered conversion,
- surface tangent axes,
- velocity frame conversion,
- invalid/mismatched frame rejection.

Non-goals:

- No terrain streaming.
- No floating origin runtime shift.
- No autopilot behavior changes unless explicitly scoped.

Risks:

- Overengineering before concrete users exist.
- Choosing numeric representations without precision evidence.

### Phase 2: Absolute Entity State Later

Goal:

- Define durable entity state records for ships, drones, sites, outposts, resource nodes and deployed jobs.
- Establish how loaded GameObjects bind to durable IDs.

Files likely touched later:

- Save/state model files.
- Entity registry or world-state files.
- Focused tests for serialization-like state behavior.

Tests/evidence needed later:

- loaded/unloaded entity state round trip,
- absolute position persistence,
- entity ID stability,
- unloaded resource/outpost/drone state persistence.

Non-goals:

- No full save-game UI.
- No final database or multiplayer authority.

Risks:

- Duplicate state may drift if runtime Transform remains too authoritative.

### Phase 3: Floating-Origin Test Harness Later

Goal:

- Add a deterministic harness proving origin shifts do not change gameplay state.
- Measure camera, Rigidbody, HUD marker, route sample and obstacle invariants.

Files likely touched later:

- Floating-origin service/harness files.
- Focused tests and evidence under the future change.

Tests/evidence needed later:

- relative distances unchanged,
- velocities unchanged,
- route samples reprojected,
- camera focus preserved,
- projectile previous positions corrected,
- UI distance unchanged.

Non-goals:

- No large planet implementation.
- No seamless orbital travel.

Risks:

- Shift order bugs can create subtle physics and visual defects.
- Particle and previous-frame sweep state are easy to forget.

### Phase 4: SurfaceLocalFrame Prototype Later

Goal:

- Prototype one surface frame around a small test site.
- Prove landed ship, player spawn, resource node and outpost target points share a frame.

Files likely touched later:

- Surface frame data types.
- Test-only surface site setup.
- Focused spawn/conversion tests.

Tests/evidence needed later:

- surface frame axes valid,
- ship landing pose maps to frame,
- exit point maps safely,
- node/outpost/cargo targets resolve,
- unload/reload preserves local state.

Non-goals:

- No full planet terrain.
- No procedural streaming.
- No first-person gameplay polish.

Risks:

- A surface test range can accidentally become a separate game mode if cargo/navigation handoff is skipped.

### Phase 5: Ship/Player/Drone Handoff Later

Goal:

- Define and implement safe transitions between cockpit, on-foot player, remote drone, vehicle and ship cargo interaction contexts.

Files likely touched later:

- Player state/context files.
- Drone control state.
- Ship entry/exit and cargo port interaction files.
- Tests for save/load and control transfer.

Tests/evidence needed later:

- exit/enter ship,
- remote drone control and return,
- cargo transfer target validity,
- save/load mid-handoff,
- blocked handoff reasons.

Non-goals:

- No full RPG interaction.
- No final animation/body system.

Risks:

- Control ownership bugs can strand the player or duplicate inventory/cargo state.

### Phase 6: Background Simulation Tick Later

Goal:

- Add deterministic job/event simulation for unloaded drones, drills, outposts, cargo transfer and faction alerts.

Files likely touched later:

- Background simulation service.
- Job/state models.
- Resource/cargo integration files.
- Deterministic tests.

Tests/evidence needed later:

- mining job tick,
- cargo full stop,
- drone travel/return event,
- outpost storage persistence,
- save/load no double progress,
- timewarp aggregate result.

Non-goals:

- No full economy simulation.
- No distant per-frame combat simulation.

Risks:

- Event outcomes can feel unfair if scanner/UI did not show risk before the player left.

### Phase 7: Large Map/Orbit Integration Later

Goal:

- Connect absolute/entity state and frame descriptors to map targets, future orbit planning, landing approach and larger local ranges.

Files likely touched later:

- System map target descriptors.
- Navigation planner handoff.
- Future orbit/landing planner files.
- UI/map tests.

Tests/evidence needed later:

- map marker resolves to exact target descriptor,
- orbit/approach handoff preserves frame data,
- landing zone resolves to exact point,
- large local range remains readable,
- authority/fuel warnings stay frame-aware.

Non-goals:

- No gravity-assist feature unless separately scoped.
- No seamless planet streaming.

Risks:

- Scope can balloon into full orbital navigation. Keep local exact-arrival and target descriptors as prerequisites.

## Verification Boundary

For this spec-only change:

- run `specs_validate real-scale-world-architecture-v1` if available,
- run Markdown/file-scope checks,
- do not run Unity tests,
- do not run dotnet build,
- commit only allowed docs/spec files.
