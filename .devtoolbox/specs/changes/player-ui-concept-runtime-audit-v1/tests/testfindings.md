# Test Findings

## Findings Fixed In This Slice

### Fixed: Combat no-target context preempted Navigation

- Severity: High UX.
- Evidence: the first fresh GameView pass showed `Combat: No target` in the right context panel while a navigation waypoint was selected and Auto Fire was off.
- Expected: combat context takes priority only for a selected combat target or active Auto Fire; Navigation/Objectives should remain visible otherwise.
- Fix: `PrototypePlayerHudRenderer.ApplyContext()` now treats no-target/off combat as a fallback after Navigation and Objective.
- Regression test: `PrototypePlayerHudValidationTests.CombatNoTargetDoesNotPreemptNavigationOrObjective`.

### Fixed: stale debug preset could leak into runtime Basic view

- Severity: High visual/runtime evidence.
- Evidence: one screenshot pass showed legacy IMGUI Debug Console, Diagnostics, HUD/Navball, Keybinds, Minimap/Radar, and Weapon Computer over the Player HUD after editor/test activity.
- Expected: real runtime starts in Basic Player HUD unless the player/dev explicitly switches prototype presets.
- Fix: `PrototypeBootstrap.Start()` calls `PrototypeUiLayoutManager.ResetPresetToBasic()` before building the runtime prototype.
- Regression test: `PrototypePlayerHudValidationTests.BootstrapStartResetsStalePrototypePresetToBasicPlayerView`.

### Previously fixed and reverified: mode hint clipping

- Severity: Medium readability.
- Evidence: the original committed screenshot in this change showed the Translation hint clipped at the bottom bar.
- Fix: `PrototypeInputBindingCatalog.GetModeSummary()` now uses compact player-facing mode hints.
- Regression test: `SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry` asserts the compact Translation hint.

### Fixed: Help overlay could visually compete with 4:3 side panels

- Severity: Medium responsive layout.
- Evidence: the new `07-warning-help-4x3-gameview.png` audit target required Help, warnings, and the bottom bar to fit at 1024x768 without overlapping the context/radar/system panels.
- Fix: `PrototypePlayerHudRenderer.SetHelpVisible()` now treats Player Help as a modal player panel and hides Ship Systems, Objective, Context, Radar, overlay graphics, and target labels while Help is visible.
- Regression test: `PrototypePlayerHudValidationTests.ResponsiveLayoutKeepsHelpPanelClearOfContextAtFourByThree`.

### Fixed: runtime evidence exporter caused Edit Mode material warnings

- Severity: Low tooling/evidence quality.
- Evidence: Unity logged `Instantiating material due to calling renderer.material during edit mode` on the first exporter pass.
- Fix: `PrototypePlayerHudRuntimeEvidenceExporter` assigns tracked `sharedMaterial` instances to temporary evidence primitives and destroys those materials after capture.
- Verification: Unity console after forced script refresh and exporter rerun contains only the MCP menu log and exporter success log.

### Addressed from Claude review: asymmetric screenshot matrix

- Severity: Medium evidence quality.
- Evidence: Claude plan review pointed out that Combat/Docking were only shown at 16:9 and Help/Warnings only at 4:3, and that exporter snapshots should not be presented as live subsystem-driven captures.
- Fix: the exporter now also writes `08-active-combat-target-4x3-gameview.png`, `09-active-docking-4x3-gameview.png`, `10-warning-help-16x9-gameview.png`, and `11-warning-combat-4x3-gameview.png`.
- Documentation: the protocol now distinguishes Unity-rendered exporter snapshots from manually driven live subsystem states.

### Addressed: synthetic-only runtime evidence gap

- Severity: Medium evidence quality.
- Evidence: the previous audit matrix explicitly stated that the screenshot matrix was renderer/snapshot evidence, not live subsystem-driven capture.
- Fix: added `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests`, which builds the real `PrototypeBootstrap` runtime, drives waypoint autopilot, weapon computer, docking assist, arena/objective, low-fuel warning, and Help states through real components, and writes live screenshots `12-live-cruise-objective-16x9.png` through `18-live-docking-assist-4x3.png`.
- Verification: Unity MCP PlayMode job `c9af37373d5b47f8a5a95977be43f09b` passed 1/1, with assertions for snapshot state, radar/target indicators, rendered pixels, and panel separation.

### Addressed later: 4:3 live cruise/navigation symmetry

- Severity: Medium evidence quality.
- Evidence: the live matrix already covered 4:3 combat, docking, and warning/help states, but cruise/objective and navigation/autopilot only had 16:9 live captures in the runtime audit folder.
- Fix: `player-ui-live-evidence-symmetry-v1` adds real Bootstrap PlayMode captures for `31-live-cruise-objective-4x3.png` and `32-live-navigation-autopilot-4x3.png`.
- Verification: the focused PlayMode test asserts expected cruise/navigation snapshot state, radar/target evidence for navigation, active button fit, and panel separation.

### Addressed later: target-indicator aspect evidence

- Severity: Medium visual-scaling evidence.
- Evidence: the first dedicated target-indicator screenshot proved only the representative 1280x720 Basic state.
- Fix: `player-target-indicators-v1` now adds live Bootstrap PlayMode captures for target indicators at 1024x768, 2560x1080, and 900x1600.
- Verification: the focused PlayMode test asserts navigation/combat/objective indicators, no inactive docking marker, panel separation, active button fit, target label-to-label separation, and no target label overlap with fixed HUD panels.

## Evidence Status

### Proven: specialized runtime screenshot matrix

Focused tests cover navigation, radar, combat, docking, target indicators, help filtering, warnings, TMP text, and aspect-ratio layout. Current Unity-rendered exporter evidence covers Basic cruise/objective/navigation plus active combat at 16:9 and 4:3, active docking at 16:9 and 4:3, warning/help at 4:3 and 16:9, and warning+combat at 4:3. PlayMode live evidence covers real Bootstrap/runtime cruise/objective, navigation/autopilot, combat, docking, warning/help, combat 4:3, docking 4:3, the later symmetric cruise/navigation 4:3 states, and dedicated target-indicator Basic states at 16:9, 4:3, ultrawide, and portrait.

### Proven: docking visual proof

Docking snapshot translation, context gating, soft-capture labels, and placeholder-safe hard lock wording are covered by tests. `tests/screenshots/06-active-docking-gameview.png` proves the active Docking context and target marker render without colliding with the rest of the HUD.

`tests/screenshots/09-active-docking-4x3-gameview.png` additionally proves the active Docking context at the narrower 1024x768 aspect ratio.

### Deferred: builder/loadout, full mission/reward UI, remapping/settings

These are explicitly out of v0 scope in the concept document. The current UI reserves space through objective/status architecture but does not claim a final builder, reward screen, or remapping UI.

## Risk Notes

- Earlier runtime GameView evidence included large world-space `ORIGIN` labels. They were not generated by HUD panels, and the later `player-world-label-readability-v1` slice suppresses those debug-style Training labels while preserving FullDebug diagnostics.
- The UI still uses compact text-heavy panels. Layout tests protect overlap, but visual polish can continue after functional coverage.
- Screenshots `05` through `11` remain synthetic HUD snapshot renders in Unity and are retained as renderer-state evidence. Screenshots `12` through `18`, the later `31`/`32`, and the dedicated target-indicator aspect evidence are live PlayMode captures driven through real Bootstrap-created runtime components; they are still automated RenderTexture captures, not a human manual playthrough recording.
- Claude follow-up review after live screenshots did not flag a commit-blocking issue. Residual suggested follow-ups that remain outside this slice are: reduce reflection coupling in evidence tests and optionally write an evidence manifest next to PNGs.
