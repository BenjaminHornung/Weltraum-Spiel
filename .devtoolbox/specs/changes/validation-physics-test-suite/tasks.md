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
- [x] Define deterministic generated ship test setup
- [x] Add main thrust force/torque check
- [x] Add gimbal torque check
- [x] Add RCS allocator force/torque/nozzle-budget checks
- [x] Add fuel partial-step checks when fuel mass-flow exists
- [x] Add projectile momentum checks when recoil exists
- [x] Add timestep stability comparison where practical
- [x] Document how to run and store evidence

## Verification
- [x] Validate changed Unity scripts/test assets with Unity MCP
- [x] Run the physics test suite or documented probes
- [x] Confirm evidence is stored under the active spec tests folder
- [x] Confirm tolerances are documented
- [x] Commit implementation with spec title and changelog
