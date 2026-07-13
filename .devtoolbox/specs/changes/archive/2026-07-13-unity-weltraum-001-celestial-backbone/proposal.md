# Proposal

## Goal
Create the first data-driven celestial runtime backbone for the Aurelia starter system without implementing travel, autopilot, timewarp, drones, persistence, landing, or a final system map.

## Motivation
The concept files define real-scale bodies, large-world coordinates, and staged orbital simulation, but the runtime does not yet have one shared source for celestial IDs, physical values, parent relationships, gravity data, or visual scale separation. Future navigation, map, drone, savegame, and timewarp work should not each invent their own planet data.

This change establishes a small tested foundation that later features can consume safely.

## Scope
- Create minimal celestial runtime data shapes for body definitions, body type, orbit data, gravity data, visual scale data, and absolute/reference-frame state.
- Seed a small Aurelia-system catalog asset for `star.aurelia`, `planet.hestia`, `moon.hestia.luma`, and `asteroid.eber` from the existing concept documents.
- Provide a registry or loader that exposes definitions by stable ID and reports validation results.
- Validate unique IDs, parent links, positive radii, mass or `mu`, `mu` consistency when both mass and `mu` are present, orbit plausibility, and visual-scale availability.
- Add simple debug visibility for real values and placeholder celestial visualization while keeping physical values separate from visual scale.
- Add focused EditMode validation tests, a catalog asset load test, and evidence under this change.

## Non-goals
- No autopilot execution changes.
- No timewarp implementation.
- No drone or remote mission implementation.
- No savegame migration or persistence layer.
- No landing, surface streaming, atmosphere gameplay, day/night rotation gameplay, or resource economy.
- No complete seven-planet system map.
- No Patched Conics, SOI switching, full Kepler propagation, or full N-Body simulation.
- No orbit-intersection validation for asteroid belt bodies.
- No final art, materials, or polished UI.

## Concept references
- `docs/spielkonzept/celestial-runtime-data-contract.md`
- `docs/spielkonzept/real-scale-world-architecture.md`
- `docs/spielkonzept/orbital-simulation-model.md`
- `docs/spielkonzept/startsystem.md`

## Success criteria
- The four starter bodies can be loaded from one catalog asset and queried by stable ID.
- Invalid catalog data produces explicit validation failures instead of silently entering runtime.
- Real physical values remain separate from visual map/local display scale.
- Existing prototype flight, HUD, navigation, and floating-origin behavior are not required to consume the new catalog in this first slice.
- The implementation is covered by focused editor tests, catalog asset load verification, and standard Unity/C# verification.
