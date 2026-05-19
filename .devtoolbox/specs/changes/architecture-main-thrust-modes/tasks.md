# Tasks: architecture-main-thrust-modes

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect existing MainThrusterModule and ShipPhysicsCore force routing through Unity MCP
- [x] Add explicit main-thrust mode enum
- [x] Keep ComSafeSteeringOnly as default
- [x] Implement FullyPhysicalNozzleForce path through ShipPhysicsCore
- [x] Add inspector fields and safe defaults
- [ ] Add debug overlay fields for mode and main-thrust torque
- [ ] Update README and physics docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify default throttle-only torque remains near zero
- [ ] Verify fully physical mode applies force at nozzle position
- [ ] Verify gimbal torque diagnostics match expected cross product
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
