# Tasks: architecture-fuel-mass-flow

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect ShipStats, MainThrusterModule, RcsThrusterController, and ShipPhysicsCore through Unity MCP
- [x] Fix zero-fuel-cost thrust semantics
- [x] Add partial-fuel thrust scaling for main engines
- [x] Add RCS fuel consumption from final allocator output
- [x] Feed fuel mass into total mass model or documented interim total mass
- [ ] Add fuel flow diagnostics to debug overlay
- [ ] Update README and physics docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify full, half, and zero throttle fuel use
- [ ] Verify almost-empty tank applies partial thrust
- [ ] Verify RCS combined commands consume fuel once per final nozzle output
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
