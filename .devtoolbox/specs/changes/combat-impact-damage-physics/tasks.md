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
- [x] Define impact event data
- [x] Add simple module damage state
- [x] Apply one physical degradation path for RCS or engine thrust
- [x] Add optional impact impulse routing through ShipPhysicsCore
- [x] Add debug damage diagnostics
- [x] Update README and physics docs

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify hit event data is populated
- [x] Verify damaged RCS/engine reduces physical authority
- [ ] Verify diagnostics show degraded state
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
