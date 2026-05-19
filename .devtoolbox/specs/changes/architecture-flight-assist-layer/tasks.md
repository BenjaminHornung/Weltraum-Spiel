# Tasks: architecture-flight-assist-layer

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect input, SAS, RCS allocator, and ShipPhysicsCore through Unity MCP
- [x] Define flight-assist mode enum/data
- [x] Add explicit request-source diagnostics
- [x] Ensure Simulation Mode preserves momentum
- [ ] Route any assist force/torque through core/allocators
- [ ] Mark debug-only non-physical helpers clearly if needed
- [ ] Update README and physics docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify assist off preserves vacuum inertia
- [ ] Verify assist requests are visible separately from manual/SAS
- [ ] Verify no hidden damping is introduced
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
