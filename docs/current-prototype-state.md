# Current Prototype State

Stand: 2026-06-12

## Playable State

The prototype boots into a playable zero-gravity flight/combat sandbox. The default ship is the imported Blender Demo Scout, bound as a functional ship with main thrusters, RCS nozzles, engine VFX, weapon muzzle/flash markers, visible turret tracking, Weapon Computer ownership, fuel usage, projectile firing, target dummies, navigation waypoints, and a small PvE arena loop. Generated primitive ships remain available as explicit fallback/debug variants only.

The current default gameplay surface is the uGUI player HUD. Legacy IMGUI windows still exist for diagnostics, but they are not the default player view.

## Standard Scene

Use `Assets/Scenes/PrototypeBootstrapHost.unity`.

Pressing Play from an empty or nearly empty scene is also supported: `PrototypeBootstrap` creates the required runtime roots when needed. The bootstrap keeps exactly one active main camera, binds HUD/debug/minimap/follow camera components after rebuilds, and snaps/reframes the follow camera to the active ship.

## Primary Controls

| Input | Current behavior |
| --- | --- |
| `W/S`, `A/D`, `Q/E` | Pitch, yaw, roll in Cruise/Precision; translation mappings change in Translation mode. |
| `Left Shift` / `Left Control` | Increase/decrease persistent main throttle in Cruise only. |
| `X` / `Y` or `Z` | Cut throttle / full throttle. |
| `R` | Toggle RCS. |
| `T` | Toggle SAS angular stabilization. |
| `Caps Lock` | Cycle `Cruise -> Precision -> Translation -> Cruise`. |
| `Tab` / `B` | Select next / previous navigation waypoint. |
| `G` | Toggle waypoint autopilot for the selected target. |
| `Space` | Fire the current main gun; Weapon Computer target tracking gates turret fire. |
| `V` | Cycle camera mode: `ChaseLocked -> OrbitInspect -> Side -> FreeInspect -> ChaseLocked`. |
| RMB + mouse / wheel | Look/orbit and zoom camera. |
| `F1` | Toggle player HUD help in Basic view. |
| `F2` / `F3` / `F4` / `F5` / `F6` | Prototype diagnostics, debug console, legacy HUD/Navball, legacy minimap, visual mode cycling. |

Control-mode summary:

- Cruise: main-thruster flight mode; Shift/Ctrl throttle works; waypoint autopilot uses main burn/brake path.
- Precision: RCS available, main thruster/gimbal forced off, attitude control stays on W/S/A/D/Q/E.
- Translation: RCS available, main thruster/gimbal forced off, W/S/A/D/H/N map to linear translation while Q/E stays roll.

## HUD And Debug Presets

The default Basic view uses `PrototypePlayerHudRenderer` with flight status, fuel/throttle/RCS/SAS, warning and assist chips, player radar, Kill Momentum, contextual navigation/combat panels, and F1 help.

Debug Console presets:

| Preset | Purpose |
| --- | --- |
| Basic | Gameplay-facing default; legacy IMGUI windows mostly hidden. |
| Flight Test | Focused flight diagnostics without opening every heavy window. |
| RCS Test | RCS/SAS diagnostics, allocator state, and related debug surfaces. |
| Full Diagnostics | Full prototype debug surface for investigation. |

Presets only change visibility/collapsed state and debug marker visibility. They do not change physics, bindings, ship authority, or control mappings.

## Verification Contract

DevToolbox must use the workspace-local verify config at `.devtoolbox/verify.json`. The current resolved plan source is `verify-config`, and the project verification steps are:

```powershell
dotnet build "Weltraum Spiel.sln" --no-restore
dotnet test "Weltraum Spiel.sln" --no-build
```

For Unity-facing work, authoritative evidence should combine:

- Unity MCP script validation or console checks after script edits.
- Focused Unity EditMode/PlayMode tests for the affected runtime slice.
- Explicit solution build/test above.
- Evidence under `.devtoolbox/specs/changes/<change-name>/tests/`.

Generic root commands such as bare `dotnet build`, bare `dotnet test`, and root `dotnet format --verify-no-changes` are not authoritative for this Unity workspace because the root contains multiple MSBuild files and known pre-existing formatting/reference warnings.

Current validation caveat: workspace-wide `specs_validate` is still blocked by incomplete draft/old change folders, not by the verify config. Validate individual ready changes when archiving or completing work.

## Change Consolidation

| Change | Fachlicher Status | Offene Tasks | Evidence | Entscheidung |
| --- | --- | ---: | --- | --- |
| `weltraum-001-celestial-backbone` | Completed, verified, not archived | 0 | Execution verification passed; one old review finding flags build warnings only. | Keep active until the stale review finding is resolved or explicitly superseded; then archive. |
| `player-ui-regression-controls-autopilot-rcs-v1` | Completed | 0 | Test protocol/screenshots exist; linked execution lacked formal verification result. | Archived on 2026-06-12 with verification/commit warnings acknowledged. |
| `weltraum-002-orbit-map-prototype` | Completed | 0 | Test protocol exists; previously built and pushed as orbit-map prototype. | Archive candidate after focused preflight. |
| `weltraum-004-map-hud-navigation-readout` | Completed | 0 | Test protocol records Unity and solution verification. | Archive candidate after focused preflight. |
| `player-ui-concept-runtime-audit-v1` | Audit/evidence change completed in practice | Check before archive | Test matrix, findings, and screenshots exist. | Archive candidate after review of any remaining task checkboxes. |
| `player-target-indicators-v1` | Completed in practice | Check before archive | Test protocol, findings, screenshots, and logs exist. | Archive candidate after focused preflight. |
| `player-hud-live-aspect-ratio-scaling-v1` | Likely completed by later HUD/aspect work | Check remaining tasks | Evidence folder present. | Verify task state, then archive or roll remaining work into a new small follow-up. |
| `fix-functional-blender-ship-vfx-turret-v1` | Functionality now appears in README/current runtime, but DevToolbox tasks are untouched | 20 | `tests/test-protocol.md` exists; task list still 0/20. | Do short PlayMode acceptance, confirm Cargo remains out of scope, check stale project references, then toggle/close tasks. |
| `fix-prototype-usability-flight-feel` | Partially completed; much was absorbed by later control/HUD work | 25 | Test protocol has explicit solution build/test and notes generic verify blocker. | Close implemented slices; convert remaining UI/environment/visual polish into a smaller follow-up. |
| `fix-prototype-ui-performance-v1` | Mostly completed | 1 | EditMode/performance evidence exists; latest old verifier failed on lint. | Manual PlayMode responsiveness note is the only open task; record evidence, then close/archive. |
| `fix-autopilot-plan-execution-fidelity-v1` | New active work | 20 | No task completion yet. | Keep as current feature/fix slice, but add required spec file before relying on workspace-wide validation. |
| `player-navigation-planner-ui-overhaul-v1` | Draft only | n/a | Proposal only; tasks/spec missing. | Either complete scaffold or delete/archive as draft if superseded. |

## Accepted Limits

- This is not the final ship editor, economy, mission framework, multiplayer mode, or final gameplay architecture.
- Controller support has compile/play coverage, but physical hardware feel remains manually unverified.
- Navigation Computer and trajectory preview are local-space prototype guidance, not full orbital navigation, patched conics, SOI planning, or maneuver-node planning.
- Docking hard lock is a documented placeholder, not an active joint.
- RCS allocation is bounded prototype logic, not a final optimizer.
- IMGUI debug windows remain temporary diagnostic surfaces.
- Full armor balance, part detachment, visual destruction, and combat economy remain out of scope.

## Next Feature Slice

Recommended next slice: close `fix-functional-blender-ship-vfx-turret-v1` with a short runtime acceptance pass.

Done state for that slice:

- PlayMode boots `PrototypeBootstrapHost.unity` into the imported Demo Scout default.
- Main thruster and RCS VFX originate from imported sockets.
- Weapon muzzle/flash origins are imported markers; no root fallback is used.
- Visible turret tracks a selected target and only fires when alignment/arc/cooldown allow it.
- Cargo functional binding is explicitly documented as out of scope unless a separate cargo slice is opened.
- Stale references to moved/renamed Blender project files are checked and either fixed or documented.
- `dotnet build "Weltraum Spiel.sln" --no-restore` and `dotnet test "Weltraum Spiel.sln" --no-build` pass for the current workspace.
