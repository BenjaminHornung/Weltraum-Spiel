# Tasks

## Spec

- [ ] Create proposal.md and design.md for prototype camera control/framing scope
- [ ] Create camera mode, mouse wheel zoom, visual bounds framing, and UI/docs spec files
- [ ] Validate the change with specs_validate

## Discovery

- [ ] Inspect current camera, bootstrap, visual switcher, stats/config, UI docs, and existing EditMode test patterns
- [ ] Check relevant Unity API documentation for renderer bounds, input, and camera transform behavior

## Implementation

- [ ] Add FreeInspect and OrbitInspect camera mode behavior while preserving ChaseLocked and Side defaults
- [ ] Add local mouse wheel zoom, effective distance diagnostics, reset/refocus behavior, and visual-bounds-based framing
- [ ] Notify camera after F6 visual switching and keep gameplay rig/physics unchanged
- [ ] Update debug console controls, HUD/keybind camera diagnostics, and README documentation
- [ ] Add or extend EditMode camera tests for mode cycle, zoom, reframe, and reset

## Verification

- [ ] Run Unity MCP validate_script for changed scripts
- [ ] Run Unity MCP refresh_unity and read_console
- [ ] Run Unity MCP EditMode tests
- [ ] Run local build/test verification for Weltraum Spiel.sln where applicable
- [ ] Write tests/test-protocol.md with automated and manual PlayMode evidence
- [ ] Run tasks_completion_preflight before toggling completed tasks