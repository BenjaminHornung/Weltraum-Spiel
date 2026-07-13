# Capability: Visible Turret Auto Aim

## Requirement
The imported Demo Scout SHALL have a visible functional gun turret whose yaw and pitch meshes rotate with the runtime turret pivots, track selected targets with slew-rate limiting, and fire only when aligned and otherwise eligible.

## Scenarios
- Given the Blender Demo Scout asset, when inspected in Blender and Unity, then `WEAPON_TURRET_BASE_PRIMARY`, `WEAPON_TURRET_YAW_PRIMARY`, `WEAPON_TURRET_PITCH_PRIMARY`, `WEAPON_MUZZLE_PRIMARY`, and `WEAPON_MUZZLE_FLASH_PRIMARY` exist with visible yaw assembly/barrel geometry parented under the matching pivots.
- Given a weapon target is selected and auto-fire is enabled, when frames advance, then the turret yaw and pitch pivots rotate over time toward the target using `turretSlewDegreesPerSecond` instead of snapping instantly.
- Given a target is outside arc or range, when status is evaluated, then the turret does not fire and status reports out-of-arc/out-of-range without mutating aim unexpectedly.
- Given a target is in arc/range but not aligned within the configured tolerance, when auto-fire runs, then status reports tracking/aligning and no projectile is fired until alignment is reached.
- Given cooldown is ready and the turret is aligned, when auto-fire or target-aware manual fire runs, then projectile/tracer/muzzle flash originate at imported `WEAPON_MUZZLE_PRIMARY` or `WEAPON_MUZZLE_FLASH_PRIMARY`.
- Given no weapon computer target is active, when manual fire is requested, then the weapon may fire along muzzle forward only if a valid imported muzzle exists.
- Given the panel is visible, when weapon state changes, then status can distinguish no target, tracking, aligning, in arc, out of arc, cooldown, no muzzle, and missing imported marker.
