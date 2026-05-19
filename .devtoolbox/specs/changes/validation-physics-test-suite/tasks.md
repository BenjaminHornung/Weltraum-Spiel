# Tasks: validation-physics-test-suite

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect existing Unity MCP probes and test evidence conventions
- [ ] Define deterministic generated ship test setup
- [ ] Add main thrust force/torque check
- [ ] Add gimbal torque check
- [ ] Add RCS allocator force/torque/nozzle-budget checks
- [ ] Add fuel partial-step checks when fuel mass-flow exists
- [ ] Add projectile momentum checks when recoil exists
- [ ] Add timestep stability comparison where practical
- [ ] Document how to run and store evidence

## Verification
- [ ] Validate changed Unity scripts/test assets with Unity MCP
- [ ] Run the physics test suite or documented probes
- [ ] Confirm evidence is stored under the active spec tests folder
- [ ] Confirm tolerances are documented
- [ ] Commit implementation with spec title and changelog
