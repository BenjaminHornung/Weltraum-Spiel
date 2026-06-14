# Proposal: Planet First-Person Worldbuilding v1

## Problem

Weltraum-Spiel already has a strong zero-G space prototype direction: ship flight, autopilot, weapons, ship builder concepts, map/orbit thinking, drones and future planetary ideas. The future on-planet first-person layer is large enough that implementing pieces without a shared concept would risk creating a separate game loop that does not reinforce ships, drones, cargo, autopilot, resources or the ship builder.

The project needs a planning package before runtime work begins.

## Outcome

Create a spec-only concept package that defines the future player-facing shape of on-planet first-person gameplay:

- why the player goes onto planets,
- what the player can do on foot that ships and drones cannot do as well,
- how resources, mining, crafting, fuel, ammo, upgrades and economy connect,
- how on-foot weapons differ from ship weapons,
- what surface dangers and activities exist,
- how outposts, factions, settlements, ruins and environmental storytelling work,
- what the minimum first playable slice should be,
- what remains explicitly future scope.

## Scope

This change creates only planning documents and a formal DevToolbox spec:

- `docs/spielkonzept/on-planet-first-person-mode.md`
- `docs/spielkonzept/resources-mining-crafting.md`
- `docs/spielkonzept/weapons-combat-progression.md`
- `docs/spielkonzept/worldbuilding-factions-economy.md`
- `docs/spielkonzept/planetary-exploration-loop.md`
- `docs/spielkonzept/planetary-settlements-outposts.md`
- `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/design.md`
- `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/tasks.md`
- `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/specs/planet-first-person-mode/spec.md`

## Non-Goals

- No runtime code.
- No tests.
- No Unity scenes.
- No assets, prefabs, Blender models, FBX files or materials.
- No UI implementation.
- No ship builder runtime edits.
- No autopilot or harness changes.
- No planet terrain implementation.
- No first-person controller implementation.

## Why Now

Planetary gameplay will affect many later systems: cargo, resource definitions, mining tools, ship landing, drones, economy, factions, weapon progression, outposts, persistence and map/autopilot targets. Defining the player experience now helps later implementation slices stay aligned with the core space game and prevents isolated feature work from drifting into unrelated survival/RPG mechanics.

## Success Criteria

- The concept package answers the main design questions for planet-first-person gameplay.
- The package clearly keeps the surface loop connected to ships, drones, autopilot, resources, economy, factions and the ship builder.
- The formal spec states requirements for future implementation without requiring implementation now.
- Verification is Markdown/spec-only.
