# Tasks: fix-physics-consistency-regressions

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral requirements spec
- [x] Validate spec change

## Critical Consistency Fixes
- [x] Replace recoil-path-only validation with a real opposite recoil impulse test
- [x] Pass configured projectile mass into Projectile.Initialize
- [x] Ensure projectile Rigidbody, impact impulse, and impact damage use the configured mass
- [x] Split continuous force/torque diagnostics from impulse/angular-impulse diagnostics in ShipPhysicsCore
- [x] Add validation for force-vs-impulse diagnostic separation

## RCS and Control Consistency
- [x] Normalize RCS allocator force/torque residual cost
- [x] Track desired, actual, and residual RCS force/torque diagnostics
- [x] Implement RCS nozzle spool-up/spool-down response
- [x] Preserve manual attitude torque priority before SAS/assist torque budget
- [x] Add validation for RCS diagnostics/spool/manual-priority behavior where practical

## Configuration Consistency
- [x] Apply default settings when PrototypeShipConfig is null
- [x] Add validation that reused prototype components reset to defaults after config removal

## Documentation and Evidence
- [x] Update README or physics docs for new diagnostics semantics if needed
- [x] Store test evidence under this change
- [x] Mark completed tasks after verification

## Verification
- [x] Unity MCP script validation passes for changed scripts
- [x] Relevant Unity EditMode tests pass
- [x] dotnet build/test checked or blocker documented
- [x] Commit and push the completed change