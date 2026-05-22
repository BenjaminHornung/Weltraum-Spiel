# Capability: Imported Functional Ship Physics Sanity

## Requirement
Imported functional demo ships must have sane rigidbody mass, center of mass, and inertia before live flight controls can apply forces or torque.

## Expected Behavior
- The default imported scout build uses custom mass descriptors or a conservative fallback inertia.
- `Rigidbody.automaticCenterOfMass` and `Rigidbody.automaticInertiaTensor` are disabled after mass properties are applied.
- Inertia tensor axes for the default imported scout are each greater than a sane minimum.
- Functional socket lever arms are measured and exposed through diagnostics.
- Scout RCS, muzzle, and main-nozzle lever arms remain below the scout sanity threshold.
- Cargo uses a larger documented threshold or is marked unsafe if it exceeds that threshold.

## Scenarios
- Building `ImportedDemoScoutFunctionalDefault` yields nonzero module mass descriptors and stable inertia.
- Switching visuals back to imported scout reapplies imported functional mass descriptors.
- Missing descriptors do not leave a colliderless body on Unity automatic inertia.
