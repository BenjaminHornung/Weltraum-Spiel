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
- [x] Inspect current transform/camera/particle assumptions through Unity MCP
- [x] Define absolute state data model
- [x] Add optional floating origin manager
- [x] Implement local origin shift for registered objects
- [x] Preserve velocities and relative offsets
- [x] Add diagnostics for absolute/local coordinates
- [x] Document limitations for particles, trails, and joints

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify origin shift preserves relative positions
- [x] Verify Rigidbody velocity is preserved
- [x] Verify current prototype works with feature disabled
- [x] Add test evidence under this spec
- [x] Commit implementation with spec title and changelog
