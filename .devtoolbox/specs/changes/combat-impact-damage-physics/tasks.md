# Tasks: combat-impact-damage-physics

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect projectile hit feedback, module descriptors, RCS, and main thruster through Unity MCP
- [ ] Define impact event data
- [ ] Add simple module damage state
- [ ] Apply one physical degradation path for RCS or engine thrust
- [ ] Add optional impact impulse routing through ShipPhysicsCore
- [ ] Add debug damage diagnostics
- [ ] Update README and physics docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify hit event data is populated
- [ ] Verify damaged RCS/engine reduces physical authority
- [ ] Verify diagnostics show degraded state
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
