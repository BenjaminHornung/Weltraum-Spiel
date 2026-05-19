# Tasks: combat-projectile-recoil-sweep

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect Projectile, GunModule, PrototypeTargetDummy, and ShipPhysicsCore through Unity MCP
- [x] Add projectile mass and optional recoil settings
- [x] Apply recoil impulse to shooter
- [x] Track projectile previous position
- [x] Add raycast or sphere-cast sweep detection
- [x] Ignore firing ship colliders
- [ ] Expose hit data for future damage systems
- [ ] Update README and physics docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify relative projectile velocity is unchanged
- [ ] Verify recoil impulse direction and magnitude
- [ ] Verify thin target sweep hit
- [ ] Verify no immediate self-hit
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
