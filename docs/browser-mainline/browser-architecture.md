# Browser Mainline Architecture

## Goal

Define the browser-native architecture target for the Three.js mainline without importing Unity's scene, MonoBehaviour or Rigidbody architecture.

## Layer Model

```text
core
  IDs, Result-style outcomes, deterministic time, event log, hash helpers.

math
  Vec3, transforms, frame descriptors, stable numeric helpers.

sim
  Fixed-step loop, simulation clock, active simulation bubble, replay hooks.

flight
  ShipState, mass, fuel, thrust, RCS/SAS abstractions, authority snapshots.

navigation
  TargetDescriptor, ArrivalEnvelope, RoutePlan, Planner, Validator,
  Executor, Supervisor, Telemetry.

world
  Bodies, obstacles, zones, stations, resources, frame/chunk metadata.

render-three
  Three.js scene, cameras, mesh factories, instancing, debug gizmos.

ui
  HUD, input modes, route status panels, warning chips, settings.

test-harness
  Scenario catalog, TestBridge, evidence recorder, browser automation API.
```

## Dependency Rule

```text
core knows nobody.
math knows core.
sim knows core + math.
flight knows core + math + sim.
world knows core + math.
navigation knows core + math + sim + flight + world contracts.
render-three consumes render snapshots and debug snapshots only.
ui consumes ViewModels/snapshots and sends commands.
test-harness may orchestrate all layers but must not contain product rules.
```

## Truth Ownership

- Durable world truth is data: entity state, absolute/local frames, ownership and simulation state.
- Current render truth is a projection: Three.js objects, camera transforms, labels and debug gizmos.
- Player UI truth is read-only presentation: warning chips, route state, fuel/authority status, telemetry and next actions from owners.
- Test truth is recorded evidence: scenario JSON/Markdown/screenshots/telemetry from the same core APIs used by the browser runtime.

## Mainline Contracts To Preserve

Source paths:

- `docs/architecture/autopilot-v2-design.md`
- `docs/architecture/autopilot-v2-test-harness.md`
- `docs/architecture/coordinate-spaces-and-floating-origin.md`
- `docs/architecture/real-scale-world-architecture.md`
- `docs/architecture/surface-local-frame-architecture.md`
- `docs/ux/player-facing-status-authority-v1.md`
- `docs/ux/unified-ui-input-mode-architecture.md`
- `analysis/threejs-mainline/source-evidence/current-core-inventory.md`
- `analysis/threejs-mainline/source-evidence/unity-to-threejs-port-map.json`

Required contracts:

- `RoutePlan` identity must be deterministic and stable across equal inputs.
- Executor accepts one locked plan and reports divergence/invalidation without plan replacement.
- `TargetDescriptor` must carry exact target semantics plus arrival envelope. Broad zones/sites resolve before execution.
- Authority/fuel/brake reserve are owned by flight/navigation services, not HUD rendering.
- Frame descriptors travel with positions and velocities whenever systems cross absolute, local physics, ship-local, planet-centered or surface-local spaces.
- Browser UI and renderer are snapshot consumers. Commands enter core through explicit APIs.

## Unity Reference Boundary

Read Unity/legacy sources for:

- player-visible behavior,
- domain vocabulary,
- edge cases and historic defects,
- evidence scenarios,
- useful constants when test-backed.

Do not port:

- `Update`/`FixedUpdate` lifecycle ordering as architecture,
- MonoBehaviour class shape,
- scene wiring as domain truth,
- Rigidbody integration as deterministic truth,
- IMGUI debug windows as player UI,
- root/zero/default fallbacks for missing targets, sockets or markers,
- silent replan/fallback behavior.

## Browser Runtime Shape

The browser app should start as a low-poly proving ground: one ship, one route, one target, optional obstacles, HUD readout, telemetry bridge and evidence recorder. It then expands by scenarios and contracts, not by copying Unity scene breadth.

## Open-World Preparedness

From `docs/architecture/coordinate-spaces-and-floating-origin.md`, `docs/architecture/real-scale-world-architecture.md` and historical external package low-poly planning (not a live repo path in this worktree):

- use floating origin/local frames as projection corrections only;
- keep absolute simulation state stable;
- simulate nearby active objects in a bubble;
- treat far objects as data/snapshots;
- budget object counts and avoid unchecked `O(n^2)` world loops;
- use instancing/LOD for low-poly fields before adding content volume.
