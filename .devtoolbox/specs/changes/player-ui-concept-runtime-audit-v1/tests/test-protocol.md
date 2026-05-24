# Test Protocol

## Change

`player-ui-concept-runtime-audit-v1`

## Scope

Audit and tighten the current Player HUD against `docs/player-facing-ui-concept-v0.md` sections 3-8. This continuation also fixed two runtime UX regressions found during visual inspection:

- `Combat: No target` no longer preempts Navigation or Objective when no combat target is selected and Auto Fire is off.
- `PrototypeBootstrap.Start()` resets stale prototype/debug presets to Basic so the real runtime starts in the Player HUD view even after editor/test activity leaves a static preset behind.
- The runtime evidence matrix now includes Unity-rendered active Combat, active Docking, Warning/Help, and combined Warning+Combat captures through `Tools/Prototype/Export Player HUD Runtime Evidence`.
- The live evidence path now includes a PlayMode test that builds the real `PrototypeBootstrap` runtime, drives the actual waypoint autopilot, weapon computer, docking assist, arena/objective, low-fuel warning, and Help states, and captures the bound Player HUD from the runtime camera.

## Fresh Verification

| Check | Result | Evidence |
| --- | --- | --- |
| DevToolbox `specs_validate player-ui-concept-runtime-audit-v1` | PASS | 6 tasks parsed; proposal/design/spec/tasks present. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs` | PASS | 0 errors, 2 existing analyzer warnings: Rigidbody work should use FixedUpdate; Update string concat can allocate. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypeUiLayoutManager.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypeInputBindingCatalog.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Editor/PrototypePlayerHudRuntimeEvidenceExporter.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` before context fix | PASS | Job `31b2f03d51554cc6935f0a443597bc6d`, 29/29 passed. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` after combat context fix | PASS | Job `20fbac9d35ff4ab39fea0ea66a843bbc`, 30/30 passed. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` after Basic preset reset | PASS | Job `ea5907aff8544b20a2351bf99228dfb0`, 31/31 passed. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` after 4:3 Help modal and exporter updates | PASS | Job `c341d04eb30447229e138f607a5f5b83`, 32/32 passed. |
| Unity MCP PlayMode `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesLiveStates` | PASS | Job `c9af37373d5b47f8a5a95977be43f09b`, 1/1 passed. |
| `dotnet build "Weltraum Spiel.sln" --no-restore` | PASS | Exit code 0 after final code changes; 25 known Unity/reference/obsolete API warnings, 0 errors. |
| Unity MCP GameView screenshot | PASS | `tests/screenshots/04-basic-player-nav-context-final.png`. |
| Unity MCP runtime evidence exporter | PASS | `05-active-combat-target-gameview.png`, `06-active-docking-gameview.png`, `07-warning-help-4x3-gameview.png`, `08-active-combat-target-4x3-gameview.png`, `09-active-docking-4x3-gameview.png`, `10-warning-help-16x9-gameview.png`, and `11-warning-combat-4x3-gameview.png` written under `tests/screenshots/`. |
| Unity MCP live PlayMode evidence screenshots | PASS | `12-live-cruise-objective-16x9.png` through `18-live-docking-assist-4x3.png` written under `tests/screenshots/`; each capture asserts live snapshot state, non-trivial rendered pixels, and panel separation. |
| Unity console after final screenshot | PASS | 1 expected `PrototypeBootstrap visibility diagnostics` log; no errors/warnings in the final capture pass. |
| Unity console after runtime evidence exporter | PASS | 2 expected logs (`ExecuteMenuItem`, exporter success); no errors or warnings after forced script refresh. |
| DevToolbox `verify_run 69d997a094714f548202231846f79abd` | BLOCKED BY GENERIC ROOT COMMANDS | Specs passed; generic `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011 / multiple MSBuild files. Targeted Unity MCP tests and explicit solution build above passed. |
| DevToolbox `verify_run 7d1c85aae5c645f487f117890da5c583` | BLOCKED BY GENERIC ROOT COMMANDS | Specs passed; generic root `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` again failed with MSB1011 / multiple MSBuild files. Targeted Unity MCP PlayMode/EditMode tests and explicit solution build above passed. |
| DevToolbox `tasks_completion_preflight` line 3 | BLOCKED | Latest verification state is failed because of the generic root-command verifier, so tasks were left unchecked. |
| DevToolbox `tasks_completion_preflight` line 6 | BLOCKED | Latest verification state is failed because the generic verifier records the `Lint` MSB1011 workspace-shape failure, so the screenshot/evidence task remains unchecked despite targeted verification passing. |

## Runtime Screenshots

`tests/screenshots/04-basic-player-nav-context-final.png`

Verified visually:

- Basic Player HUD only; legacy Debug Console, Flight Diagnostics, HUD/Navball IMGUI, Keybinds, Minimap/Radar IMGUI, and Weapon Computer IMGUI are not visible.
- Navigation context is active for the selected waypoint; `Combat: No target` no longer hijacks the context panel.
- Objective panel is separate from Ship Systems.
- Radar, top assist strip, bottom flight bar, left system panel, left objective panel, right context panel, and world target labels do not overlap at the captured GameView size.
- Mode hint text is compact and no longer clipped in the bottom bar.

`tests/screenshots/05-active-combat-target-gameview.png`

Verified visually:

- Active combat context owns the right context panel only when a target is selected.
- Combat target marker, health/range/status label, compact combat controls, Auto Fire chip, radar, objective panel, ship systems, and bottom flight bar all fit without overlap at 16:9.
- Arena progress remains in the Objective panel, not the Ship Systems panel.

`tests/screenshots/08-active-combat-target-4x3-gameview.png`

Verified visually:

- Active combat target, radar, objective panel, ship systems, context controls, warning/assist strip, and bottom flight bar also fit at 1024x768.
- The 4:3 combat capture closes the aspect-ratio gap called out by Claude review.

`tests/screenshots/06-active-docking-gameview.png`

Verified visually:

- Active Docking context appears only in the docking state and shows distance, angle, relative speed, offset, soft-capture state, and assist state with player-facing labels.
- Docking target marker and docking context do not collide with objective, ship systems, radar, warning strip, or flight controls at 16:9.
- The UI still avoids claiming a completed hard lock/docked state.

`tests/screenshots/09-active-docking-4x3-gameview.png`

Verified visually:

- Active Docking context and docking target marker also fit at 1024x768.
- Objective, ship systems, radar, context, warning strip, and bottom flight bar remain separated.

`tests/screenshots/07-warning-help-4x3-gameview.png`

Verified visually:

- 4:3 Help overlay is modal and hides side/context/radar panels while visible, preventing window overlap at the narrower aspect ratio.
- Warning strip remains visible above Help with low-fuel/RCS warning text and the assist chip.
- Bottom flight bar stays readable and does not collide with Help.

`tests/screenshots/10-warning-help-16x9-gameview.png`

Verified visually:

- Help modal behavior also holds at 1280x720.
- Side/context/radar panels remain hidden while Help is visible, and the bottom flight bar stays readable.

`tests/screenshots/11-warning-combat-4x3-gameview.png`

Verified visually:

- Combined Warning+Combat state at 1024x768 keeps warning strip, assist chip, combat target marker, radar, objective panel, ship systems, right context controls, and bottom flight bar separated.
- This closes the combined-state gap from Claude review for warnings during active combat.

## Live PlayMode Runtime Screenshots

These captures are produced by `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests` rather than by injected synthetic HUD snapshots. The test builds the real `PrototypeBootstrap` runtime, uses the actual `PrototypePlayerHudRenderer` bound to the runtime ship and camera, and drives subsystem state through existing APIs before each screenshot.

`tests/screenshots/12-live-cruise-objective-16x9.png`

Verified visually and by assertions:

- Real Bootstrap runtime, real ship/camera/HUD.
- Objective panel and ship systems are visible; no active combat target is projected.
- Docking is not selected and does not preempt the cruise/objective state.
- Top strip, radar, left panels, right context, and bottom bar are separated at 1280x720.

`tests/screenshots/13-live-navigation-autopilot-16x9.png`

Verified visually and by assertions:

- Waypoint autopilot is selected/engaged through `PrototypeWaypointAutopilot` APIs.
- Navigation snapshot is visible with a target count, radar blips, and a navigation target indicator.
- The capture uses the same runtime Player HUD renderer bound by `PrototypeBootstrap`.

`tests/screenshots/14-live-combat-target-16x9.png`

Verified visually and by assertions:

- Weapon computer selects a real discovered runtime target through `PrototypeWeaponComputer.SelectNextTarget()`.
- Combat context, selected combat radar blip, combat target indicator, Auto Fire state, and priority label are visible.
- Panels and controls remain separated at 1280x720.

`tests/screenshots/15-live-docking-assist-16x9.png`

Verified visually and by assertions:

- Docking target comes from the real `PrototypeDockingApproachAssist.TargetDockingPort`.
- Docking context, docking radar blip, docking target indicator, soft-capture label, and assist state are visible.
- The UI still avoids claiming a completed hard lock/docked state.

`tests/screenshots/16-live-warning-help-4x3.png`

Verified visually and by assertions:

- Low fuel is induced on the real `ShipStats` runtime component and produces `Treibstoff niedrig`.
- Player Help is opened on the real HUD renderer; Help is modal and hides context/radar/systems/objective panels while keeping the bottom bar readable.
- The 1024x768 layout guard verifies Help does not overlap the bottom bar.

`tests/screenshots/17-live-combat-target-4x3.png`

Verified visually and by assertions:

- The real weapon computer combat context remains readable at 1024x768.
- Warning strip, objective panel, radar, ship systems, combat controls, and bottom bar remain separated.

`tests/screenshots/18-live-docking-assist-4x3.png`

Verified visually and by assertions:

- The real docking-assist context remains readable at 1024x768.
- Warning strip, objective panel, radar, ship systems, docking gauges, and bottom bar remain separated.

## Tooling Limitations Observed

- Unity MCP `execute_code` still fails immediately with `Error running ... mono.exe: The filename or extension is too long`, even for a short code snippet. The audit bypasses that route with the checked-in Editor menu exporter.
- Screenshots `05` through `11` remain Unity-rendered exporter snapshots against the real `PrototypePlayerHudRenderer`; screenshots `12` through `18` are live PlayMode captures driven through real runtime components. Both paths use RenderTexture capture, not a human manual playthrough recording.
- One Unity MCP test job (`c4389dfbd577470d86ae22348e8551e3`) failed to initialize after 120 seconds before the final successful rerun. The follow-up `PrototypePlayerHudValidationTests` run succeeded 31/31, so the failed job is recorded as tooling noise rather than an implementation failure.
- Generic DevToolbox verifier commands are expected to remain limited in this Unity workspace when they invoke root-level unscoped `dotnet build/test/format`; explicit solution build and Unity MCP checks are the authoritative evidence here.

## Current Acceptance Judgement

This slice proves the current Basic runtime view, context priority, active Combat, active Docking, Warning/Help, combined Warning+Combat, 4:3 and 16:9 layout behavior, script validity, focused HUD tests, live PlayMode subsystem evidence, and solution build. The screenshot matrix now includes both exporter-rendered HUD snapshots and live Bootstrap/runtime captures. Remaining non-player-HUD concept items are deferred by the concept itself or belong to broader future mission/builder/remapping work, not this v0 runtime HUD audit.
