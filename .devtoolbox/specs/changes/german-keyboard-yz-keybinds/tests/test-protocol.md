# Test Protocol: german-keyboard-yz-keybinds

Date: 2026-05-18

## Scope

- Confirmed `PlayerShipController.PollInput` now treats `Keyboard.current.yKey.wasPressedThisFrame` and `Keyboard.current.zKey.wasPressedThisFrame` as full-throttle commands.
- Confirmed existing throttle controls remain unchanged in the same input block:
  - `X` sets `cutThrottle`.
  - `Left Shift` sets `throttleUp`.
  - `Left Control` and `Right Control` set `throttleDown`.
- Confirmed README controls documentation lists full throttle as `Y/Z` and includes a German keyboard compatibility note.
- Did not touch `InputSystem_Actions.inputactions`.
- Did not add a remapping UI.

## Unity MCP Validation

- `validate_script(uri: Assets/Scripts/Prototype/PlayerShipController.cs, level: standard, include_diagnostics: true)`:
  - Result: success
  - Errors: 0
  - Warnings: 1
  - Warning: `String concatenation in Update() can cause garbage collection issues`
- `refresh_unity(scope: scripts, mode: force, compile: request, wait_for_ready: true)`:
  - Result: success
  - Compile requested: true
  - Editor state after refresh: `ready_for_tools: true`, `is_compiling: false`, `is_domain_reload_pending: false`
- `read_console(action: get, types: error/warning, count: 20, format: detailed)` after clearing console and recompiling:
  - Errors: 0
  - Warnings: 1
  - Warning source: MCP-for-Unity transport warning, `[WebSocket] Unexpected receive error: WebSocket is not initialised`

## Notes

- A pre-clear console read while the editor was still in play-mode transition showed stale scene-level `The referenced script (Unknown) on this Behaviour is missing!` errors. After stopping play mode through Unity MCP, clearing the console, and recompiling scripts, no console errors were present.

## DevToolbox Validation

- `specs_validate(workspaceRoot: E:\Unity\Weltraum Spiel\Weltraum Spiel, changeName: german-keyboard-yz-keybinds)`:
  - Result: passed
  - Parsed tasks: 16
  - Checks passed: Proposal, Tasks, Specs, Design, Task parsing, Change root
- `verify_run(executionId: dd294a068739494fa17a332ff7d432a8)`:
  - Specs step: passed
  - Build/Test/Lint steps: failed with `MSB1011` / multiple project or solution files at the Unity workspace root
  - Assessment: generic .NET root commands are not a useful verifier for this Unity slice; Unity MCP script validation and `specs_validate` are the applicable checks.
