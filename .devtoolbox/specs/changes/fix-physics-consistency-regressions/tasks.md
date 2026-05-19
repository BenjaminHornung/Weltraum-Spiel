# Tasks: fix-physics-consistency-regressions

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral requirements spec
- [x] Validate spec change

## Critical Consistency Fixes
- [ ] Replace recoil-path-only validation with a real opposite recoil impulse test
- [ ] Pass configured projectile mass into Projectile.Initialize
- [ ] Ensure projectile Rigidbody, impact impulse, and impact damage use the configured mass
- [ ] Split continuous force/torque diagnostics from impulse/angular-impulse diagnostics in ShipPhysicsCore
- [ ] Add validation for force-vs-impulse diagnostic separation

## RCS and Control Consistency
- [ ] Normalize RCS allocator force/torque residual cost
- [ ] Track desired, actual, and residual RCS force/torque diagnostics
- [ ] Implement RCS nozzle spool-up/spool-down response
- [ ] Preserve manual attitude torque priority before SAS/assist torque budget
- [ ] Add validation for RCS diagnostics/spool/manual-priority behavior where practical

## Configuration Consistency
- [ ] Apply default settings when PrototypeShipConfig is null
- [ ] Add validation that reused prototype components reset to defaults after config removal

## Documentation and Evidence
- [ ] Update README or physics docs for new diagnostics semantics if needed
- [ ] Store test evidence under this change
- [ ] Mark completed tasks after verification

## Verification
- [ ] Unity MCP script validation passes for changed scripts
- [ ] Relevant Unity EditMode tests pass
- [ ] dotnet build/test checked or blocker documented
- [ ] Commit and push the completed change