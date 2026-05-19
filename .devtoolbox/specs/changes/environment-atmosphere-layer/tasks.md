# Tasks: environment-atmosphere-layer

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect ShipPhysicsCore environment-force hooks through Unity MCP
- [x] Define optional atmosphere settings/volume
- [x] Keep vacuum as default
- [x] Add simple drag force calculation
- [x] Route drag through ShipPhysicsCore
- [x] Add atmosphere diagnostics to overlay/docs

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify default scene has zero atmosphere force
- [x] Verify drag opposes velocity in a test atmosphere
- [x] Verify drag scales with squared speed
- [x] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
