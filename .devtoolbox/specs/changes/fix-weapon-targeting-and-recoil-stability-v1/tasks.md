# Tasks: Fix Weapon Targeting And Recoil Stability v1

## Spec

- [ ] 1. Author proposal, design, capability specs, and initial validation for `fix-weapon-targeting-and-recoil-stability-v1`.

## Implementation

- [ ] 2. Replace hot-path Weapon Computer target discovery with an explicit registry/marker path and remove generic Rigidbody fallback discovery.
- [ ] 3. Preserve Weapon Computer selection, health aggregation, manual refresh, and projectile/weapon-visual exclusion with focused tests.
- [ ] 4. Add weapon recoil stabilization through a `WeaponStabilization` flight-assist request source routed through existing RCS/SAS allocation.
- [ ] 5. Expose combat-flight diagnostics for recoil impulse, estimated angular impulse, stabilization request, actual/residual RCS torque, and authority status.

## Verification And Docs

- [ ] 6. Add EditMode tests and source-path guard tests for target registry, selection modes, recoil angular impulse, RCS request routing, authority residuals, and manual priority.
- [ ] 7. Update README, physics docs, and `tests/test-protocol.md` with behavior, limits, and verification evidence.
- [ ] 8. Run final DevToolbox/Unity/dotnet verification and record any tooling blockers.
