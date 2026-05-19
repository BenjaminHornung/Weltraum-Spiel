# Tasks: infrastructure-floating-origin-large-world

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [ ] Inspect current transform/camera/particle assumptions through Unity MCP
- [ ] Define absolute state data model
- [ ] Add optional floating origin manager
- [ ] Implement local origin shift for registered objects
- [ ] Preserve velocities and relative offsets
- [ ] Add diagnostics for absolute/local coordinates
- [ ] Document limitations for particles, trails, and joints

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify origin shift preserves relative positions
- [ ] Verify Rigidbody velocity is preserved
- [ ] Verify current prototype works with feature disabled
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
