# Tasks: Combat Weapon Computer / Turret Mode v0

## Spec

- [x] 1. Author proposal, design, capability specs, and initial validation for `combat-weapon-computer-turret-mode-v0`.

## Implementation

- [x] 2. Extend data-driven weapon settings and projectile diameter handling while preserving existing `GunModule` fire/recoil behavior.
- [x] 3. Add turret mount/weapon components with real-muzzle enforcement, local yaw/pitch arc limits, cooldown status, deterministic hit chance, recoil diagnostics, and arc safety validation.
- [x] 4. Add Weapon Computer target adapters, target selection, priority modes, active target/status output, auto-fire hook, and separate camera-bound IMGUI panel.
- [x] 5. Add marker-based `PrototypeShipKitWeaponBinder` and bootstrap/generated fallback binding for turret-compatible weapon markers without hardcoded ship paths.

## Verification And Docs

- [x] 6. Add/extend editor tests for settings clamp, target priority, turret arc, fire control, projectile diameter, recoil, binder idempotency, bootstrap, and UI status safety.
- [x] 7. Update README, physics docs, and change test protocol with validation results, Unity test results, Blender/preview status, and known limits.
- [x] 8. Run final DevToolbox/Unity/dotnet verification, fix remaining failures, and push completed commits to `origin/main`.
