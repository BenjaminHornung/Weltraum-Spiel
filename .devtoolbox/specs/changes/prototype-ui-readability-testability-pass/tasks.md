# Tasks: prototype-ui-readability-testability-pass

## Spec

- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add specs/ui-readability/spec.md
- [x] Add tasks.md
- [x] Validate spec with DevToolbox

## Discovery

- [x] Inspect existing PrototypeDebugOverlay, PrototypeFlightDebugConsole, PrototypeFlightHud, PrototypeBootstrap, PlayerShipController, README, and physics docs for reuse points

## Implementation

- [x] Add shared IMGUI window state, layout manager, presets, clamping, persistence, and reset support
- [x] Convert Debug Overlay, Debug Console, and HUD/Navball to draggable/collapsible compact windows with F2/F3/F4 behavior
- [x] Add draggable F1 Keybind Overlay and keep README controls in sync
- [x] Reduce navball marker/text clutter and default debug force markers off
- [x] Add consistent prototype module color palette and apply it to generated primitive modules
- [x] Add Debug Console UI presets for Basic, Flight Test, RCS Test, Full Diagnostics, and optional hide-all behavior

## Verification

- [x] Validate changed Unity scripts with Unity MCP validate_script
- [x] Refresh Unity and check console for compile errors
- [x] Run Unity MCP EditMode tests
- [x] Run explicit dotnet build/test against Weltraum Spiel.sln
- [x] Add test-protocol.md under this change with automated verification and manual sight-check notes
