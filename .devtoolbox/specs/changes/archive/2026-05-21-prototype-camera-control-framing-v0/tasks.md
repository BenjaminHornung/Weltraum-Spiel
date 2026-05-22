# Tasks

## Spec

- [x] Create proposal.md and design.md for prototype camera control/framing scope
- [x] Create camera mode, mouse wheel zoom, visual bounds framing, and UI/docs spec files
- [x] Validate the change with specs_validate

## Discovery

- [x] Inspect current camera, bootstrap, visual switcher, stats/config, UI docs, and existing EditMode test patterns
- [x] Check relevant Unity API documentation for renderer bounds, input, and camera transform behavior

## Implementation

- [x] Add FreeInspect and OrbitInspect camera mode behavior while preserving ChaseLocked and Side defaults
- [x] Add local mouse wheel zoom, effective distance diagnostics, reset/refocus behavior, and visual-bounds-based framing
- [x] Notify camera after F6 visual switching and keep gameplay rig/physics unchanged
- [x] Update debug console controls, HUD/keybind camera diagnostics, and README documentation
- [x] Add or extend EditMode camera tests for mode cycle, zoom, reframe, and reset

## Verification

- [x] Run Unity MCP validate_script for changed scripts
- [x] Run Unity MCP refresh_unity and read_console
- [x] Run Unity MCP EditMode tests
- [x] Run local build/test verification for Weltraum Spiel.sln where applicable
- [x] Write tests/test-protocol.md with automated and manual PlayMode evidence
- [x] Run tasks_completion_preflight before toggling completed tasks
