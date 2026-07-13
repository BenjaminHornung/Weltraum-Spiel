# Browser Mainline Architecture

Stand: 2026-07-13

## Purpose

This document describes the implemented browser-native architecture and the boundaries future work must preserve. The product mainline is `apps/weltraum-browser`; Unity is available only through `unity-legacy-final-2026-07`, its archive branch and curated records under `docs/legacy-unity`, and is not imported as runtime architecture.

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

celestial
  Validated body/catalog identities, canonical signatures, explicit reference
  frames, deterministic elliptic Kepler propagation and local gravity queries.

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
  Three.js scene, cameras, Demo Scout GLB adapter, nozzle VFX binding,
  procedural fallback, render interpolation and world-presentation projection.

tests/evidence
  Vitest, Playwright, query-gated TestBridge scenarios and recorded artifacts.
```

Directory names may evolve, but these authority boundaries are product contracts.

## Dependency Direction

- Core/domain contracts do not depend on UI or Three.js.
- Flight owns executable physical state and actuator truth.
- Navigation consumes flight/world snapshots and emits plans or typed rejection.
- Celestial owns pure validated data and math. It does not currently drive flight, navigation, renderer, UI or world bootstrap.
- Runtime coordinates commands and exposes immutable snapshots.
- UI reads ViewModels/snapshots and sends commands.
- Three.js consumes render/world-presentation snapshots only.
- Tests may orchestrate layers but must not become product-rule owners.

Do not let UI or rendering become a second implementation of planner, executor, objective, celestial, world or arrival rules.

## Truth Ownership

### Gameplay and flight truth

Runtime/domain state owns ship pose and velocity, manual input, control mode, fuel, mass, authority, braking reserve, actuator requests, terminal capture, Arrival and station keeping.

### Navigation truth

Navigation/runtime contracts own selected targets, route previews, validation, exact-hash admission, locked plans, execution segments, completion history and explicit invalidation/replan-required state.

A displayable route is not automatically engageable. `displayPlan` may provide context; only `admittedPlan` can authorize Engage for its exact stable `planHash`.

### Celestial truth

The celestial core owns validated catalog identities, physical/orbital fields, explicit-time ephemeris results, reference-frame metadata, canonical signatures and pure gravity-query results.

Current boundary:

- deterministic bound elliptic propagation only;
- explicit caller-provided times only;
- local inverse-square source queries only;
- no wall clock, renderer, floating origin, hidden replan or gameplay state in the calculation;
- no flight/navigation integration, SOI switching, patched conics, N-body physics, landing, terrain or atmosphere runtime.

The root star remains at the absolute system origin. Floating-origin translation is an external projection concern and cannot alter ephemeris truth.

### World truth

World data/snapshots own absolute entity state, local projections, obstacle and target identities, chunk registry, simulation residency, render eligibility and contact provenance.

### Presentation truth

Three.js and UI may own meshes, materials, interpolated render pose, camera damping, label layout, CSS state and visual transitions. They cannot authorize engagement, complete objectives, alter absolute/celestial state or manufacture contacts.

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

The executor must not silently plan or replace its locked plan. Replanning is a new explicit planning/admission action.

## TestBridge Boundary

- Normal player route: `/`
- Explicit test route: `/?testBridge=1`

Live player acceptance should prefer visible UI interactions on `/`. The query-gated route is reserved for deterministic harness scenarios. No player-facing component may depend on TestBridge.

Pure-core browser smokes may dynamically import a domain module from `/` while proving TestBridge remains absent, as done for the celestial core.

## Render And Asset Boundary

The Demo Scout GLB is the preferred player-facing visual. The procedural ship remains a required fallback and test-safe source.

- GLB axis/scale correction is render-only.
- Marker/socket binding may consume named GLB nodes or manifest fallback descriptors.
- Main-engine and RCS nozzle effects derive from actuator telemetry and resolved bindings, not raw key state.
- Missing visual nodes must not create phantom gameplay thrusters, targets or world state.
- Render interpolation affects ship/camera presentation only.
- Decorative objects remain outside radar/world truth unless backed by explicit runtime entities.

## World-Scale And Orbital Foundations

Implemented:

- stable absolute coordinates and local projection frames;
- floating-origin invariants;
- deterministic simulation bubble, LOD, chunk registry and streaming plans;
- renderer-owned instancing without renderer-owned simulation truth;
- a pure celestial catalog, ephemeris and local gravity-query core.

Still missing:

- celestial integration with flight, navigation and world runtime;
- shared trajectory prediction, SOI and patched conics;
- production content/chunk IO;
- generated planets, terrain and voxel data;
- surface-local gameplay transitions;
- timewarp, persistence and multiplayer universe authority.

Future planetary and voxel work must preserve absolute simulation state while streaming local render/physics regions.

## Unity Reference Boundary

Archived Unity sources may be read through `unity-legacy-final-2026-07:<path>` for feature intent, player-visible behavior, terminology, historical defects, evidence scenarios and test-backed constants. Curated intent/evidence lives under `docs/legacy-unity`; retained reusable source assets live under `art/`.

Do not port MonoBehaviour shape, `Update`/`FixedUpdate` ownership, scene wiring as domain state, Rigidbody state as deterministic authority, IMGUI as player UI, root/default semantic fallbacks, or silent replan behavior.

## Core Contracts To Preserve

- Deterministic stable plan and domain signatures.
- One admitted locked plan per execution.
- No target/waypoint snap or hidden velocity reset.
- FlightController-owned actuator and terminal-capture behavior.
- Explicit target semantics and arrival envelopes.
- Fail-closed authority, fuel and braking checks.
- Stable IDs across serialization and future persistence.
- Explicit frame metadata across absolute/local/surface/orbital boundaries.
- Celestial calculations remain explicit-time, deterministic and independent from presentation.
- UI and rendering remain command/snapshot adapters.
- Demo Scout and Procedural Fallback remain available.

## Related Documents

- `docs/current-mainline-state.md`
- `docs/browser-mainline/adr-0001-threejs-mainline.md`
- `docs/browser-mainline/testing-and-evidence.md`
- `docs/browser-mainline/ci-verification.md`
- `docs/browser-mainline/port-roadmap.md`
- `docs/browser-mainline/celestial-gravity-core-v1.md`
- `docs/roadmap/living-master-plan.md`
- `docs/architecture/autopilot-v2-design.md`
- `docs/architecture/coordinate-spaces-and-floating-origin.md`
- `docs/architecture/real-scale-world-architecture.md`
