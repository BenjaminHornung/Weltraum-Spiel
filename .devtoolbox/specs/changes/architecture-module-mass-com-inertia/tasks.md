# Tasks: architecture-module-mass-com-inertia

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [ ] Inspect existing ShipStats, PrototypeBootstrap, and ShipPhysicsCore through Unity MCP
- [ ] Define module mass descriptor data
- [ ] Add generated descriptors for prototype modules
- [ ] Calculate total mass from descriptors
- [ ] Calculate local center of mass
- [ ] Apply Rigidbody centerOfMass
- [ ] Add simple box inertia approximation
- [ ] Publish mass diagnostics to overlay/docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify symmetric ship COM is centered
- [ ] Verify moving a heavy module shifts COM predictably
- [ ] Verify wider/longer ships alter angular acceleration
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
