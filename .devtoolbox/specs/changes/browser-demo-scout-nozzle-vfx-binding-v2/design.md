# Design: Browser Demo Scout Nozzle VFX Binding v2

## Truth and frame contracts

- `lastAppliedAcceleration` remains the combined linear acceleration in the
  owner world/local-physics frame for compatibility.
- New applied-main and applied-RCS-translation vectors are published in that
  same world/local-physics frame and sum to the combined vector.
- `lastAppliedAngularAcceleration` remains body-local. The renderer must not
  rotate it again.
- RCS translation is transformed to body-local with the current owner ship
  orientation. The interpolated render-group orientation is presentation only.
- Main flame magnitude comes only from applied main acceleration. RCS selection
  comes only from applied RCS translation plus body-local angular acceleration.

## Directional nozzle convention

Each logical nozzle records a stable id, block id, expected GLB node name,
fallback local position, normalized local force direction, and normalized local
exhaust direction. Force and exhaust directions are opposites. Compatibility is
computed with force direction; the visual puff points along exhaust direction.

The twenty Demo Scout RCS nodes are the five authored directions on each of four
blocks: front-left, front-right, aft-left, and aft-right. The registry is a
render contract, not an allocation claim.

This directional contract belongs exclusively to the authored Demo Scout GLB
registry and each logical nozzle's manifest fallback. The procedural visual has
six legacy position markers: front-left, front-right, aft-left, aft-right,
dorsal, and ventral. They deliberately contain no force/exhaust direction,
compatibility score, or allocator semantics. A discriminated binding union keeps
the two contracts impossible to confuse.

## Binding resolution

The GLB scene is traversed once into a name index. Each logical nozzle resolves
independently. Exactly one unused matching node with a finite transformed
position produces a `GLBNode` binding. Missing, duplicate, ambiguous, already
used, or invalid-position matches use that nozzle's own manifest position and
emit a deterministic diagnostic. No GLB object may bind multiple logical
nozzles.

GLB failure continues to show the procedural ship with exactly six explicit
legacy marker bindings. A partial directional nozzle registry does not turn a
successful GLB mesh load into a whole-ship failure.

## Selection

- For directional GLB bindings, translation compatibility is a positive dot product between normalized
  body-local applied RCS translation and local force direction.
- Rotation/SAS compatibility is a positive dot product between normalized
  `cross(localPosition, localForceDirection)` and normalized body-local angular
  acceleration.
- Simultaneous translation and rotation use the union.
- For the six procedural legacy markers, actual nonzero separated RCS
  translation or body-local angular acceleration shows all six as an aggregate
  presentation-only indicator. Net zero shows none.
- Idle or incompatible telemetry honestly selects zero puffs. There is no
  minimum visibility floor, parity rule, or input-state fallback.

## Presentation and evidence

Current main flame geometry, cyan additive material, scale formula, RCS puff
geometry/color, and pulse intent remain. The snapshot exposes every puff's
logical id, binding kind, source, actual local position, and final visibility.
Force/exhaust direction, selection scores, and binding diagnostics exist only
on directional entries. TestBridge remains
available only through `/?testBridge=1`.
