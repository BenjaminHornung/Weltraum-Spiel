# Test Protocol

## Change

`player-ui-concept-runtime-audit-v1`

## Scope

Audit and tighten the current Player HUD against `docs/player-facing-ui-concept-v0.md` sections 3-8. This continuation also fixed two runtime UX regressions found during visual inspection:

- `Combat: No target` no longer preempts Navigation or Objective when no combat target is selected and Auto Fire is off.
- `PrototypeBootstrap.Start()` resets stale prototype/debug presets to Basic so the real runtime starts in the Player HUD view even after editor/test activity leaves a static preset behind.

## Fresh Verification

| Check | Result | Evidence |
| --- | --- | --- |
| DevToolbox `specs_validate player-ui-concept-runtime-audit-v1` | PASS | 6 tasks parsed; proposal/design/spec/tasks present. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs` | PASS | 0 errors, 2 existing analyzer warnings: Rigidbody work should use FixedUpdate; Update string concat can allocate. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypeUiLayoutManager.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypeInputBindingCatalog.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` before context fix | PASS | Job `31b2f03d51554cc6935f0a443597bc6d`, 29/29 passed. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` after combat context fix | PASS | Job `20fbac9d35ff4ab39fea0ea66a843bbc`, 30/30 passed. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` after Basic preset reset | PASS | Job `ea5907aff8544b20a2351bf99228dfb0`, 31/31 passed. |
| `dotnet build "Weltraum Spiel.sln" --no-restore` | PASS | Exit code 0 after final code changes; 25 known Unity/reference warnings, 0 errors. |
| Unity MCP GameView screenshot | PASS | `tests/screenshots/04-basic-player-nav-context-final.png`. |
| Unity console after final screenshot | PASS | 1 expected `PrototypeBootstrap visibility diagnostics` log; no errors/warnings in the final capture pass. |
| DevToolbox `verify_run 00ebd7d16e534551b94075b268f7c023` | BLOCKED BY GENERIC ROOT COMMANDS | Specs passed; generic `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011 / multiple MSBuild files. Targeted Unity MCP tests and explicit solution build above passed. |
| DevToolbox `tasks_completion_preflight` line 3 | BLOCKED | Latest verification state is failed because of the generic root-command verifier, so tasks were left unchecked. |

## Runtime Screenshot

`tests/screenshots/04-basic-player-nav-context-final.png`

Verified visually:

- Basic Player HUD only; legacy Debug Console, Flight Diagnostics, HUD/Navball IMGUI, Keybinds, Minimap/Radar IMGUI, and Weapon Computer IMGUI are not visible.
- Navigation context is active for the selected waypoint; `Combat: No target` no longer hijacks the context panel.
- Objective panel is separate from Ship Systems.
- Radar, top assist strip, bottom flight bar, left system panel, left objective panel, right context panel, and world target labels do not overlap at the captured GameView size.
- Mode hint text is compact and no longer clipped in the bottom bar.

## Tooling Limitations Observed

- Unity MCP `execute_code` still fails immediately with `Error running ... mono.exe: The filename or extension is too long`, even for a short code snippet. This blocks programmatic runtime switching into specialized docking/help/warning screenshots through that route.
- One Unity MCP test job (`c4389dfbd577470d86ae22348e8551e3`) failed to initialize after 120 seconds before the final successful rerun. The follow-up `PrototypePlayerHudValidationTests` run succeeded 31/31, so the failed job is recorded as tooling noise rather than an implementation failure.
- Generic DevToolbox verifier commands are expected to remain limited in this Unity workspace when they invoke root-level unscoped `dotnet build/test/format`; explicit solution build and Unity MCP checks are the authoritative evidence here.

## Current Acceptance Judgement

This slice proves the current Basic runtime view, context priority, script validity, focused HUD tests, and solution build. It does not prove the full thread goal complete because specialized docking/help/warning runtime screenshots still need either a stable runtime state setup path or manual/MCP interaction that does not depend on `execute_code`.
