# Browser Mainline Architecture

Stand: 2026-07-13

## Purpose

This document describes the implemented browser-native architecture and the boundaries that future work must preserve. The product mainline is `apps/weltraum-browser`; Unity is a legacy/reference source and is not imported as runtime architecture.

## Current Layer Model

```text
core
  Stable IDs, deterministic hashing, Result-style outcomes and shared utilities.

math
  Vec3/quaternion helpers and stable numeric operations.

flight
  Flight state, manual input, control modes, mass, fuel, authority,
  braking reserve, actuators, fixed-step controller and terminal capture.

navigation
  Target descriptors, arrival envelopes, planners, route candidates,
  validation, preview/admission, immutable RoutePlan, executor and telemetry.

runtime
  Browser command dispatch, selected target, preview state, locked execution,
  objective progression, station keeping and owner snapshots.

world
  Obstacles, proving-ground entities, frame descriptors, floating-origin
  projection, chunk registry, simulation residency, LOD and streaming plans.

resources
  Resource catalog, stacks, containers, capacity, transfers, provenance and
  serialization contracts.

shipBuilder
  Part catalog, blueprints, sockets, compatibility, structure, mass, COM and
  bounds contracts.

ui
  HUD and navigation-planner ViewModels/presentation plus explicit commands.

render/three
  Three.js scene, cameras, Demo Scout GLB adapter, procedural fallback,
  render interpolation and world-presentation projection.

tests/evidence
  Vitest, Playwright, query-gated TestBridge scenarios and recorded artifacts.
```

Directory names may evolve, but these authority boundaries are part of the product contract.

## Dependency Direction

```text
Core/domain contracts do not depend on UI or Three.js.
Flight owns executable physical state and actuator truth.
Navigation consumes flight/world snapshots and emits plans or typed rejection.
Runtime coordinates commands and exposes immutable snapshots.
UI reads ViewModels/snapshots and sends commands.
Three.js consumes render/world-presentation snapshots only.
Tests may orchestrate layers but must not become product-rule owners.
```

Do not let UI or rendering become a second implementation of planner, executor, objective, world or arrival rules.

## Truth Ownership

### Gameplay and flight truth

Owned by runtime/domain state:

- ship position, orientation and velocity;
- manual input and control mode;
- fuel, mass, authority and braking reserve;
- actuator requests and applied flight-controller state;
- terminal capture, Arrival and station keeping.

### Navigation truth

Owned by navigation/runtime contracts:

- selected target and target identity;
- route preview and validation result;
- admission result for the exact preview hash;
- locked plan and active execution segment;
- completion history and `completedPlanHash`;
- explicit invalidation/replan-required state.

A displayable route is not automatically engageable. `displayPlan` may provide context; only `admittedPlan` can authorize Engage, and only for its exact stable `planHash`.

### World truth

Owned as data and snapshots:

- absolute entity positions and velocities;
- frame descriptors and local projections;
- obstacle and target identities;
- chunk registry, simulation residency and render eligibility;
- runtime world-contact provenance.

### Presentation truth

Three.js and UI may own only presentation state such as:

- mesh instances and materials;
- interpolated render pose;
- camera damping and inspection distance;
- label layout, CSS state and visual transitions.

These layers cannot authorize engagement, complete objectives, alter absolute world state or manufacture runtime contacts.

## Navigation Lifecycle

```text
Target selection
  -> route planning
  -> preview validation
  -> exact-hash admission
  -> explicit Engage command
  -> immutable locked execution
  -> terminal brake/capture
  -> Arrival/Holding
  -> completedPlanHash history + station keeping
```

Failure paths are explicit:

```text
Unavailable
StalePreview
ValidationRejected
FlightAdmissionRejected
VelocityMismatch
Diverged
Invalidated
ReplanRequired
FuelInsufficient
NoAuthority
BrakeReserveInsufficient
```

The executor must not silently plan or replace its locked plan. Replanning is a new explicit planning/admission action.

## TestBridge Boundary

`window.TestBridge` is test infrastructure, not part of the product runtime.

- Normal player route: `/`
- Explicit test route: `/?testBridge=1`

Live player acceptance must prefer visible UI interactions on `/`. The query-gated route is reserved for deterministic harness scenarios that cannot be expressed as a practical player-flow test.

No player-facing component may depend on TestBridge being present.

## Render And Asset Boundary

The Demo Scout GLB is the preferred player-facing visual. The procedural ship remains a required fallback and test-safe source.

Rules:

- GLB axis/scale correction is render-only.
- Marker/socket binding may consume named GLB nodes or manifest fallback descriptors.
- Missing visual nodes must not create phantom gameplay thrusters, targets or world state.
- Render interpolation affects ship/camera presentation only; HUD and gameplay state continue to read owner snapshots.
- Decorative objects are excluded from radar/world truth unless they have explicit runtime-backed entities.

## World-Scale Foundation

Implemented foundations:

- stable absolute coordinates;
- local projection frames and floating-origin invariants;
- deterministic simulation bubble and render LOD;
- chunk registry and streaming transition plans;
- renderer-owned instancing without renderer-owned simulation truth.

Still missing:

- production content/chunk IO;
- generated planets and terrain;
- voxel data and destruction;
- surface-local gameplay transitions;
- orbit/gravity/SOI/timewarp;
- persistent or multiplayer universe authority.

Future planet and voxel work must preserve absolute simulation state while streaming local render/physics regions. A future 3D-asset-to-voxel converter should target an explicit voxel resolution and material/interaction schema rather than baking renderer meshes directly into gameplay truth.

## Unity Reference Boundary

Unity sources may be read for:

- feature intent and player-visible behavior;
- vocabulary and historical defects;
- evidence scenarios;
- useful test-backed constants;
- reusable source assets.

Do not port as architecture:

- MonoBehaviour class shape;
- `Update`/`FixedUpdate` ownership;
- scene wiring as domain state;
- Rigidbody state as deterministic authority;
- IMGUI as player UI;
- root/default fallbacks for missing semantic objects;
- silent replan or hidden assist behavior.

## Core Contracts To Preserve

- Deterministic, stable plan and domain signatures.
- One admitted locked plan per execution.
- No target/waypoint snap or hidden velocity reset.
- FlightController-owned actuator and terminal-capture behavior.
- Explicit target semantics and arrival envelopes.
- Fail-closed authority, fuel and braking checks.
- Stable IDs across serialization and future persistence.
- Frame metadata whenever state crosses absolute/local/surface/orbital boundaries.
- UI and rendering remain command/snapshot adapters.
- Demo Scout and Procedural Fallback remain available.

## Related Documents

- `docs/current-prototype-state.md`
- `docs/browser-mainline/adr-0001-threejs-mainline.md`
- `docs/browser-mainline/testing-and-evidence.md`
- `docs/browser-mainline/ci-verification.md`
- `docs/browser-mainline/port-roadmap.md`
- `docs/roadmap/living-master-plan.md`
- `docs/architecture/autopilot-v2-design.md`
- `docs/architecture/coordinate-spaces-and-floating-origin.md`
- `docs/architecture/real-scale-world-architecture.md`
- `docs/ux/player-facing-status-authority-v1.md`
