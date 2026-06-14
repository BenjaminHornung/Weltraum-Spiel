# Proposal

## Change
`real-scale-world-architecture-v1`

## Problem
- Describe the user or workflow problem.

## Goal
- Describe the expected outcome for the change.
# Proposal: Real-Scale World Architecture v1

## Problem

Weltraum-Spiel is currently a local zero-G prototype with ship flight, exact point autopilot work, route previews, combat, modular ship-builder direction, resource/cargo planning and future planet surface gameplay. Those systems can grow for a while in Unity local coordinates, but real planets, large distances, landing zones, outposts, drones, mining jobs, cargo transfer and background simulation need a shared architecture before implementation begins.

If coordinate ownership is not planned now, later work can accidentally create:

- ship positions that exist only as Unity transforms,
- surface sites that cannot map back to system coordinates,
- drone jobs that depend on unloaded GameObjects,
- cargo and mining state that cannot survive save/load,
- autopilot targets that blur exact point arrival into broad landing zones,
- floating-origin shifts that break camera, HUD, route samples or physics bodies,
- ship builder sockets and surface frames that disagree about up/forward/right.

## Outcome

This change creates a docs/spec-only architecture package for future real-scale world handling:

- absolute system coordinates,
- current local physics frame,
- ship-local frame,
- planet-centered frame,
- `SurfaceLocalFrame`,
- outpost/local site frame,
- UI/map coordinates,
- builder/local part coordinates,
- floating-origin behavior,
- local physics bubble boundaries,
- background simulation boundaries,
- save/load responsibilities,
- autopilot integration constraints,
- phased implementation plan.

## Why Planning Is Needed Now

The next likely feature slices connect systems that are easy to prototype independently but expensive to reconcile later:

- surface target descriptors and map handoff,
- cargo mass affecting autopilot and ship physics,
- player/ship/drone state handoff,
- on-foot mining and cargo transfer,
- outpost services,
- background drone/mining jobs,
- large local range and future orbital navigation.

All of these need explicit frame data and durable entity state. Planning now prevents a disconnected planet prototype that cannot feed the space game loop.

## Scope

In scope:

- architecture documentation,
- formal requirements,
- coordinate space taxonomy,
- ownership-of-truth rules,
- floating-origin design constraints,
- surface frame design constraints,
- background simulation boundaries,
- future testing strategy,
- phased implementation plan.

## Non-Goals

This is not an implementation task. It does not add or modify:

- Unity runtime code,
- tests,
- scenes,
- prefabs,
- assets,
- Blender models,
- UI,
- terrain streaming,
- orbital mechanics,
- autopilot harness files,
- ship builder runtime code.

## Success Criteria

The change is successful when:

- the allowed Markdown/spec files exist,
- the docs define the required coordinate spaces and ownership rules,
- the formal spec states testable requirements,
- implementation phases are planned but not implemented,
- `specs_validate real-scale-world-architecture-v1` passes if available,
- the commit contains only allowed docs/spec files.
