# Draft Spec: prototype-ship-blueprint-v0

Status: draft only. Promote to `.devtoolbox/specs/changes/prototype-ship-blueprint-v0/` before implementation.

## Purpose

Move from a hardcoded generated ship toward a data-driven prototype ship description. This is the first step toward the main product goal: players build ships from functional modules whose mass, fuel, thrust, RCS, weapons, and layout affect how the ship flies and fights.

## In Scope

- Prototype-only ship blueprint data model.
- Prototype module definition data model.
- Prototype module instance data model.
- Module categories such as Cockpit, Hull, FuelTank, MainThruster, RCSBlock, Gun, Utility.
- Local positions and rotations for modules.
- Bootstrap can build the current generated ship from a default blueprint.
- Ship stats are calculated from blueprint module data rather than only scattered component defaults.
- The default blueprint should reproduce current gameplay values closely enough for continuity.

## Out of Scope

- No visual ship editor.
- No drag/drop placement UI.
- No inventory.
- No economy.
- No save/load.
- No final module inheritance architecture.
- No final art assets.
- No begehbare/interior ship logic.

## Suggested Data Concepts

- `PrototypeModuleDefinition`
  - id
  - display name
  - category
  - primitive shape/visual hints
  - local size
  - dry mass
  - fuel capacity
  - thrust
  - fuel consumption
  - RCS thrust
  - projectile speed/fire rate/lifetime where relevant
  - allowed connector/snap metadata placeholder

- `PrototypeModuleInstance`
  - instance id
  - module definition id
  - local position
  - local rotation
  - optional scale override for placeholder visuals

- `PrototypeShipBlueprint`
  - blueprint id
  - display name
  - module instance list
  - optional config/tuning reference

## Acceptance Criteria

- A default blueprint exists that generates the current playable prototype ship.
- Changing a module instance position changes the generated ship layout.
- Changing a module definition mass changes Rigidbody mass/debug mass after bootstrap.
- Changing fuel tank capacity affects fuel debug values.
- Changing engine thrust affects main acceleration.
- Changing gun data affects projectile behavior.
- Generated RCS nozzles remain transform-driven after blueprint construction.
- The current `PrototypeShipConfig` either remains compatible or is clearly integrated/replaced for prototype tuning.
- No player-facing editor is introduced in this slice.
- README or developer docs explain how to alter the default blueprint for testing.

## Design Notes

Keep this intentionally prototype-scale. It is acceptable to use ScriptableObjects or serialized classes. Do not try to design the full final game's module/item/database architecture yet.

The goal is to unlock the next spec, `simple-ship-builder-v0`, by making ship shape and stats data-driven first.

## Risks

- Overengineering here would slow iteration. Avoid perfect abstractions.
- Existing physics scripts may assume named children. If so, preserve names or add a narrow adapter rather than rewriting every system at once.
