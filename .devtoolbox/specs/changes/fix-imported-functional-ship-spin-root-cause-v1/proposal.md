# Proposal

## Change
`fix-imported-functional-ship-spin-root-cause-v1`

## Problem
Commit `0c68e1f` made the default RCS path use `StablePrototype`, but the imported functional Blender scout can still spin wildly in live PlayMode. The likely causes are coupled: imported functional ships do not get safe mass/inertia descriptors, stable attitude torque is still derived from potentially mis-scaled RCS nozzle lever arms, and weapon recoil is still applied at the imported muzzle position by default.

The visible user bug is physical instability, not primarily camera shake:
- WASD in Normal/Precision can drive excessive angular velocity.
- Space/weapon fire can inject excessive angular impulse.
- Translation mode is less catastrophic but can still jitter if SAS or recoil sees invalid inertia.

## Goal
Make the imported functional scout the safe default live-flight path:
- Sane mass, center of mass, and inertia are applied for imported functional ships.
- `StablePrototype` attitude/SAS torque is bounded by explicit gameplay angular acceleration/velocity limits, not by imported nozzle lever arms.
- Prototype weapon recoil defaults to center-of-mass safe recoil and only uses physical muzzle recoil when explicitly enabled and sane.
- PlayMode tests and evidence capture numeric diagnostics for WASD, translation, and Space/fire with imported visuals.

## Scope
- Prototype flight-control, imported functional ship binding, RCS diagnostics, weapon recoil, and tests/evidence for this regression.
- No DOTS/ECS migration.
- No camera-first fix. Camera evidence is recorded only to confirm it is not the root cause.

## Non-Goals
- Perfect physical realism for every imported asset.
- Reworking visual scale/import settings globally.
- Replacing the experimental physical nozzle allocator; it remains available as opt-in experimental behavior.
