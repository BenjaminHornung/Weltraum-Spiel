# Current Prototype State

Stand: 2026-06-14

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
| `F1` | Toggle player-facing HUD help in Basic view. |
| `F2` | Toggle prototype diagnostics/developer overlay. |
| `F3` | Toggle prototype debug console. |
| `F4` | Toggle legacy IMGUI HUD/Navball diagnostic surface. |
| `F5` | Toggle legacy prototype minimap/test-environment diagnostic surface. |
| `F6` | Cycle prototype visual/debug display mode. |

Control-mode summary:

- Cruise: main-thruster flight mode; Shift/Ctrl throttle works; waypoint autopilot uses main burn/brake path.
- Precision: RCS available, main thruster/gimbal forced off, attitude control stays on W/S/A/D/Q/E.
- Translation: RCS available, main thruster/gimbal forced off, W/S/A/D/H/N map to linear translation while Q/E stays roll.

## HUD And Debug Presets

The default Basic view uses `PrototypePlayerHudRenderer` with flight status, fuel/throttle/RCS/SAS, warning and assist chips, player radar, Kill Momentum, contextual navigation/combat panels, and F1 help.

`F1` is the player-facing help entry point. `F2` through `F6` are intentionally prototype/developer controls for diagnostics, legacy surfaces, and visual debugging; they are not part of the polished player control contract.

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
| `fix-functional-blender-ship-vfx-turret-v1` | Completed/closed for functional default scope | 0 | Tasks are checked off; `tests/test-protocol.md` records Blender validation, compile checks, EditMode/PlayMode evidence, manual scene verification, imported Demo Scout functional default, imported sockets, weapon binders, and no root muzzle/nozzle fallback. | Keep closed; Cargo functional binding remains out of scope unless a separate cargo slice is opened. |
| `fix-prototype-usability-flight-feel` | Partially completed; much was absorbed by later control/HUD work | 25 | Test protocol has explicit solution build/test and notes generic verify blocker. | Close implemented slices; convert remaining UI/environment/visual polish into a smaller follow-up. |
| `fix-prototype-ui-performance-v1` | Mostly completed | 1 | EditMode/performance evidence exists; latest old verifier failed on lint. | Manual PlayMode responsiveness note is the only open task; record evidence, then close/archive. |
| `fix-autopilot-plan-execution-fidelity-v1` | Implemented and evidence-backed | 0 | Tasks are checked off through evidence/test coverage; later stabilization docs record terminal-capture and obstacle-replan-chatter verification. | Keep as implemented, but do not treat it as proof of exact live point arrival; see Known Current Regression. |
| `player-navigation-planner-ui-overhaul-v1` | Implemented and evidenced | 0 | Tasks are checked off; evidence plan includes screenshot matrix, layout/overlap checks, planner timeline/map/radar/HUD controls, combat panel split, and PlayMode/EditMode coverage. | Keep implemented; no supported UI-quality blocker is documented in the required evidence set. Continue using screenshots/layout checks for future polish. |
| `prototype-ship-blueprint-v0` | Implemented prototype slice | 0 | `tests/ship-builder-v0-verification.md` records script validation, focused EditMode/PlayMode passes, solution build, and screenshots. | Keep as current builder prototype evidence; remaining ship-editor depth belongs in later blueprint/builder slices. |

## Accepted Limits

- This is not the final ship editor, economy, mission framework, multiplayer mode, or final gameplay architecture.
- Controller support has compile/play coverage, but physical hardware feel remains manually unverified.
- Navigation Computer, trajectory preview, and waypoint autopilot are local-space prototype guidance. They are not full orbital navigation, patched conics, SOI planning, maneuver-node planning, or slingshot navigation.
- Docking hard lock is a documented placeholder, not an active joint.
- RCS allocation is bounded prototype logic, not a final optimizer.
- IMGUI debug windows remain temporary diagnostic surfaces.
- Full armor balance, part detachment, visual destruction, and combat economy remain out of scope.

## Next Feature Slice

Recommended next slices, in order:

1. `autopilot-proving-ground-harness-v1`
2. `fix-autopilot-exact-point-arrival-v1`
3. Control-mode/HUD visibility fix, if still reproducible after the autopilot harness and exact-arrival pass

Done state for `autopilot-proving-ground-harness-v1`:

- A repeatable PlayMode proving ground captures approach, flip/brake, obstacle avoidance, terminal hold, overshoot, wander, and exact-arrival metrics.
- The harness records enough CSV/screenshot/log evidence to compare behavior before and after autopilot changes.
- The acceptance criteria distinguish "inside loose arrival radius" from "arrived at the requested point and held there."
- No further autopilot tuning is treated as complete without proving-ground evidence.

## Known Current Regression

- Live waypoint navigation avoids obstacles reasonably, but some scenarios still overshoot or wander after the flip/brake phase.
- Current automated tests may accept a loose arrival radius rather than proving exact point arrival and stable terminal hold.
- A new `autopilot-proving-ground-harness-v1` slice is required before further autopilot fixes, so the next tuning pass has repeatable evidence instead of ad hoc scene observation.
