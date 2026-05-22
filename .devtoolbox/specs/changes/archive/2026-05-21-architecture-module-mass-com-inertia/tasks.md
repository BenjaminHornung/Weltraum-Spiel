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
- [x] Inspect existing ShipStats, PrototypeBootstrap, and ShipPhysicsCore through Unity MCP
- [x] Define module mass descriptor data
- [x] Add generated descriptors for prototype modules
- [x] Calculate total mass from descriptors
- [x] Calculate local center of mass
- [x] Apply Rigidbody centerOfMass
- [x] Add simple box inertia approximation
- [x] Publish mass diagnostics to overlay/docs

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify symmetric ship COM is centered
- [x] Verify moving a heavy module shifts COM predictably
- [x] Verify wider/longer ships alter angular acceleration
- [x] Add test evidence under this spec
- [x] Commit implementation with spec title and changelog
