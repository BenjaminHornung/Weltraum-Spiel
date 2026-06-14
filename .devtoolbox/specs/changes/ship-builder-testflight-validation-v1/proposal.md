# Proposal: Ship Builder Test-Flight Validation v1

## Change

`ship-builder-testflight-validation-v1`

## Problem

The Ship Builder planning stack now defines modular parts, builder UX, data
model, validation rules, and stat formulas. The remaining gap is a future
test-flight acceptance contract: how a custom generated ship proves that it is
playable, functional, and safe before becoming the player's active ship.

Without that contract, future implementation can validate only data shape while
missing runtime issues such as unbound nozzles, root projectile fallback, camera
framing problems, unusable RCS, missing VFX origins, or ships that technically
spawn but cannot be controlled.

## Outcome

This planning package defines:

- Future test-flight flow from builder validation to temporary test range,
  checklist validation, return to builder, save, and activation.
- Acceptance scenario categories for minimal valid ships, combat ships, cargo
  ships, RCS maneuver ships, bad negative ships, and visual/VFX binding checks.
- Automated metrics for movement, rotation, RCS, fuel, weapons, camera, VFX
  origins, socket warnings, unbound functional parts, mass, and finite physics.
- Manual evidence expectations for screenshots and summary files.
- A `BuilderTestFlightRange` concept with simple target/marker support and no
  dependency on autopilot, planets, economy, final art, or multiplayer.

## Scope

In scope:

- `docs/spielkonzept/ship-builder-testflight-validation.md`
- `docs/spielkonzept/ship-builder-acceptance-scenarios.md`
- This DevToolbox change package under
  `.devtoolbox/specs/changes/ship-builder-testflight-validation-v1/`

Out of scope:

- Runtime code, tests, scenes, assets, prefabs, Blender files, FBX files, UI, or
  runtime systems.
- Changes to existing ship builder runtime code.
- Autopilot or proving-ground harness files.
- Economy, planet, final art, multiplayer, or mission framework implementation.

## Success criteria

- The docs define the requested test-flight flow, acceptance categories,
  automated metrics, manual evidence, and test scene concept.
- The formal spec requires a future test-flight path before activation,
  temporary ships unless saved/accepted, validation of functional bindings,
  physics response, fuel, weapons, camera, and VFX marker origins.
- Negative ships are blocked before normal test flight unless launched in debug
  mode.
- Test-flight acceptance is explicitly independent of final art quality.
- `specs_validate ship-builder-testflight-validation-v1` passes.
