# Design: Ship Builder Test-Flight Validation v1

## Change

`ship-builder-testflight-validation-v1`

This is a planning/spec-only change. It defines the future acceptance and
test-flight validation model for generated ships.

## Existing foundations

- The current prototype already has playable zero-gravity flight, generated
  primitive ship variants, socket-bound VFX, turret/muzzle binding, fuel usage,
  RCS, SAS, camera anchor behavior, and target dummies.
- `prototype-ship-blueprint-v0` evidence records focused builder EditMode and
  PlayMode tests plus screenshots for builder and test-flight behavior.
- Ship Builder UX documentation defines that data validation comes before test
  flight and that activation requires explicit save/selection.
- Ship Builder data and validation docs define hard errors, warnings, sockets,
  formulas, and no root fallback behavior.
- Modular part docs define functional socket and marker expectations, including
  main thruster, RCS, turret, muzzle, cargo, docking, and camera anchor markers.

## Design decisions

### Test flight after data validation

Builder data validation remains the first gate. Test flight is only available for
valid or warning-only drafts unless debug mode explicitly overrides it. This keeps
known-bad ships from entering a normal player acceptance path.

### Temporary ship first

Test flight uses a temporary ship instance. The temporary instance may burn fuel,
fire weapons, or take damage without mutating the saved draft. Promotion to active
ship remains a separate saved/accepted player action.

### Isolated range

The future `BuilderTestFlightRange` should be smaller and more deterministic than
the general prototype sandbox. It needs a simple target dummy, marker/obstacle,
known spawn state, and enough open space for movement checks. It should not
depend on planets, economy, full autopilot, multiplayer, or final art.

### Acceptance by role

Acceptance should be role-aware. A minimal valid ship does not need combat
acceptance. A combat-capable ship does. A cargo ship needs loaded/empty mass
checks. An RCS maneuver ship needs axis coverage and SAS compatibility checks.

### Functional origins over art quality

Acceptance cares where functionality comes from: nozzles, RCS sockets, pivots,
muzzles, camera anchors, and VFX marker origins. It does not care whether the
final mesh is pretty. Primitive visuals and metadata fixtures are acceptable for
MVP validation.

### Separate from autopilot acceptance

Ship-builder test flight may use target dummies and simple markers, but it should
not depend on waypoint autopilot or exact-arrival behavior. Autopilot proving
ground evidence remains separate.

## Evidence model

Future evidence should include:

- automated checklist result
- measured metrics
- builder valid-state screenshot
- test-flight screenshot
- VFX firing screenshot
- turret tracking screenshot
- short CSV or markdown summary

Evidence should be stored under the implementing change's `tests/` folder.

## Risks and mitigations

- Risk: ships pass data validation but spawn with unbound runtime parts.
  Mitigation: acceptance includes no missing socket warnings and no unbound
  functional parts.
- Risk: root fallback returns unnoticed.
  Mitigation: acceptance explicitly checks projectile, VFX, main thruster, and
  RCS origins.
- Risk: test range becomes an autopilot or planet test by accident.
  Mitigation: design excludes autopilot, planet, and economy dependencies.
- Risk: acceptance blocks harmless role omissions.
  Mitigation: acceptance is role-based; combat/cargo checks apply only to those
  role ships.
- Risk: visual polish blocks functionality work.
  Mitigation: final art quality is not an acceptance dependency.

## No implementation in this change

This change does not modify runtime code, tests, scenes, assets, prefabs, Blender
files, FBX files, or autopilot/harness files.
