# Capability: Weapon Recoil Spin Guard

## Requirement
Prototype weapon recoil must not make the default imported functional ship spin wildly when Space/fire is pressed.

## Expected Behavior
- Prototype weapons default to `CenterOfMassSafe` recoil.
- Safe recoil applies the linear recoil impulse at the center of mass.
- Physical muzzle recoil is opt-in and only applies when muzzle lever arm and angular impulse are sane.
- Physical recoil clamps angular impulse when needed.
- Diagnostics report muzzle position, muzzle lever arm, recoil impulse, recoil angular impulse, and post-fire angular velocity.

## Scenarios
- A single real `GunModule.TryFire()` path on the imported default scout keeps angular velocity under the recoil threshold.
- Existing weapon tests that need physical muzzle recoil can opt into `PhysicalMuzzle`.
- If the imported muzzle is too far from COM, default play remains safe and the excessive lever arm is visible in diagnostics.
