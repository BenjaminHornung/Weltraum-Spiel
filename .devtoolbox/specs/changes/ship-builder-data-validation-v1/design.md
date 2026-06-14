# Design: Ship Builder Data Validation v1

## Change

`ship-builder-data-validation-v1`

This is a planning/spec-only change. It documents future data contracts,
validation behavior, stat formulas, and serialization rules for the Ship Builder.

## Existing foundations to reuse

- `PrototypeShipBlueprint` planning already points toward definitions,
  instances, validation, stats, persistence, and conversion into a flyable
  prototype variant.
- The modular parts package defines the catalog direction, socket naming, axes,
  marker roles, no root fallback policy, and art-independent metadata.
- The Ship Builder UX package defines that the builder must show validity and
  stats before test flight.
- The resource/cargo model defines stable `resourceId` values, shared capacity
  rules, and cargo mass as data that ship physics and autopilot can query later.

## Data ownership decisions

### Definitions vs instances

Definitions describe reusable parts. Instances describe player placement and
future per-part state. Validation and stats are derived from both. This prevents
catalog data from being copied into every save and keeps tuning/migration
possible.

### Sockets as data

Sockets are part metadata, not scene-only transforms. A socket must carry local
position, orientation, type, compatibility, and direction where the role needs it.
Imported Blender markers can feed this data later, but pure metadata fixtures must
be enough for validation and formulas.

### Functional components over category guesses

Category helps palette and filtering, but capability comes from functional
components. A utility part might include a docking connector; a cockpit might
also include a camera anchor; a weapon might be fixed or turreted. Components keep
those differences explicit.

### Stats separate from visuals

Gameplay stats come from metadata and formulas, not mesh details. Visual assets,
helper objects, VFX, and collider assets can improve presentation, bounds, and
import validation later, but they are not required to validate a blueprint or
compute MVP stats.

### Resource/cost references

Future costs use `resourceId` from the unified resource model. Display strings
are for UI only and must not be saved as cost identifiers.

## Validation model

Validation runs as deterministic passes:

1. Schema/reference integrity.
2. Numeric sanity.
3. Grid/layout sanity.
4. Socket occupancy and structural graph.
5. Required flight systems.
6. Spatial overlap.
7. Functional socket completeness.
8. Handling/stat warnings.
9. Serialization/resource integration checks.

Errors block test flight and active-ship selection. Warnings remain visible but
allow draft save and, in the MVP, can still allow test flight.

## Formula model

The v0 formulas are intentionally simple:

- mass is summed from enabled instances
- fuel and cargo mass are explicit additions
- acceleration is thrust divided by mass
- RCS authority comes from nozzle force vectors
- torque estimates use lever arms from COM
- delta-v uses the rocket equation when fuel burn data exists
- COM is mass-weighted instance position
- thrust offset is distance from COM to the thrust axis
- weapon DPS and recoil are rough, deterministic estimates

These are not final flight simulation formulas. They are builder-facing estimates
that must be stable enough for tests and player comparison.

## Serialization strategy

Blueprint JSON should store:

- blueprint ID
- display name
- schema version
- catalog version or referenced part definition IDs
- part instances
- optional validation/stat caches
- future timestamps
- future active variant flag

Caches are optional and must be invalidated when source definitions, instances, or
formula versions change.

## Risks and mitigations

- Risk: implementation reads scene objects or renderer bounds for gameplay stats.
  Mitigation: spec requires pure data validation and formula determinism.
- Risk: sockets become visual marker names only. Mitigation: socket definitions
  carry explicit type, local transform, direction, and compatibility.
- Risk: resource costs drift into localized strings. Mitigation: docs require
  stable resource IDs for all future costs.
- Risk: validation text becomes debug-only. Mitigation: validation rules include
  stable codes plus player-facing messages and suggested fixes.
- Risk: formulas are mistaken for final physics. Mitigation: docs call them v0
  builder estimates and leave room for later higher fidelity.

## No implementation in this change

This change does not modify runtime code, tests, scenes, assets, prefabs,
ScriptableObjects, Blender files, FBX files, or autopilot/harness files.
