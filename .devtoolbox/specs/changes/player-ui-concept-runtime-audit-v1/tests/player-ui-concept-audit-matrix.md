# Player UI Concept Audit Matrix

Source: `docs/player-facing-ui-concept-v0.md` sections 3-8.

Legend:

- `Proven`: current code plus fresh tests or runtime screenshot directly cover the item.
- `Partial`: implemented or tested in part, but current runtime screenshot proof is incomplete.
- `Deferred`: intentionally not part of v0 according to the concept.
- `Not claimed`: no current feature claim is made.

Screenshot scope: this audit uses 1280x720 (16:9) and 1024x768 (4:3) Unity-rendered exporter captures for runtime HUD states. Broader aspect ratios are covered by focused responsive layout tests, but not claimed as screenshot-proven for every state in this matrix.

## Section 3: Information Architecture

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| 3.1 Flight HUD: reticle markers, speed, throttle, fuel, mode, RCS/SAS, warnings, assists | Proven | `PrototypePlayerHud.cs` snapshot/renderer; `PrototypePlayerHudValidationTests.SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; screenshot `04-basic-player-nav-context-final.png`; test run `ea5907...` 31/31 | Basic HUD is current runtime default and uses compact mode hints. |
| 3.1 No raw RCS/SAS/Physics debug telemetry in Player HUD | Proven | `SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; `PlayerHelpExcludesDebugOnlyControlsByDefault`; screenshot `04-basic-player-nav-context-final.png` | Legacy debug layers remain available only outside Basic/default. |
| 3.2 Navigation/Autopilot target, distance, ETA, friendly phase, warnings, route/radar | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues`; `NavigationComputerControlsReuseAutopilotAndPreviewApis`; `RadarSnapshotCollectsGameplayBlipsRoutePreviewAndHazards`; screenshot `04-basic-player-nav-context-final.png` | Current runtime now correctly shows Navigation context instead of no-target Combat. |
| 3.2 No candidate scores / raw planner vectors in player layer | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues` | Dev planner details remain outside the player context. |
| 3.3 Combat active target, health, range, fire status, Auto Fire, priority | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak`; `CombatAutoFireNoTargetUsesPlayerLabelWithoutDebugTuning`; `CombatComputerControlsReuseWeaponComputerApis`; screenshots `05-active-combat-target-gameview.png`, `08-active-combat-target-4x3-gameview.png`, `11-warning-combat-4x3-gameview.png` | Active combat target is covered by Unity-rendered exporter evidence at 16:9, 4:3, and a warning+combat combined state. |
| 3.3 Combat no hit chance/projectile tuning/yaw-pitch/recoil leak | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak` | Debug weapon panel remains separate. |
| 3.4 Docking shown only for active docking context and translated diagnostics | Proven | `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder`; `ContextPriorityShowsCriticalCombatDockingNavigationObjectiveInOrder`; `PrototypeDockingApproachAssistValidationTests`; screenshots `06-active-docking-gameview.png`, `09-active-docking-4x3-gameview.png` | Active docking is covered by Unity-rendered exporter evidence at 16:9 and 4:3. |
| 3.4 Hard Lock placeholder-safe wording | Proven | `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder`; `DockingPortValidationTests.DockingHardLockPlaceholderOnlyRequestsWhenConstraintsPass` | UI does not claim "Docked". |
| 3.5 Ship status: fuel, main, RCS, SAS, weapon, simple damage | Proven | `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals`; screenshot `04-basic-player-nav-context-final.png` | Current visible systems stay ship-only; arena/objective is separate. |
| 3.6 Builder/loadout full UI | Deferred | Concept says no true builder in v0 | Not claimed. |
| 3.7 Mission/rewards full UI | Deferred / partial objective architecture | `ObjectivePanelSeparatesArenaProgressFromShipSystems`; `PrototypePveArenaLoopValidationTests` | Arena objective exists because a gameplay loop exists; full mission/reward UI remains deferred. |
| 3.8 Player help from catalog, debug-only controls excluded | Proven | `PlayerHelpExcludesDebugOnlyControlsByDefault`; `PrototypeUiLayoutManager.ShouldRouteF1ToPrototypeKeybindOverlay` coverage; screenshots `07-warning-help-4x3-gameview.png`, `10-warning-help-16x9-gameview.png` | Help is modal at 4:3 and 16:9 and excludes debug-only lines by default. |

## Section 4: Moment-to-Moment Flight HUD v0

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Center reticle FWD/PRO/RET/TGT with no large panel text in center | Proven | `PrototypePlayerHudOverlayGraphic`; `RuntimeOverlayRendersBelowFixedHudPanels`; screenshot `04-basic-player-nav-context-final.png` | World labels can still pass through the center and should get a later readability pass. |
| Top alert/assist strip avoids duplicate assist text | Proven | `WarningChipsAreUniqueAndDangerSeverityWinsPriority`; `WarningStripDoesNotDuplicateAssistChipWhenWarningsAreEmpty` | Current screenshot shows trajectory/objective strip without duplicate assist spam. |
| Bottom flight bar shows speed/throttle/fuel/mode/RCS/SAS and fits text | Proven | `ResponsiveLayoutKeepsHudPanelsSeparatedAcrossAspectRatios`; compact `GetModeSummary` assertion; screenshot `04-basic-player-nav-context-final.png` | Original clipped screenshot removed from final evidence set. |
| Left ship systems and separate objective panel | Proven | `ObjectivePanelSeparatesArenaProgressFromShipSystems`; screenshot `04-basic-player-nav-context-final.png` | Arena no longer lives in Ship Systems. |
| Right context panel switches by priority | Proven | `ContextPriorityShowsCriticalCombatDockingNavigationObjectiveInOrder`; `CombatNoTargetDoesNotPreemptNavigationOrObjective`; screenshot `04-basic-player-nav-context-final.png` | Fix in this slice prevents no-target Combat from hijacking Navigation/Objective. |
| One uGUI player radar; no second IMGUI radar in Basic | Proven | `PlayerHudDoesNotRenderSecondImguiRadarPath`; `BootstrapStartResetsStalePrototypePresetToBasicPlayerView`; screenshot `04-basic-player-nav-context-final.png` | A debug preset leak was found and fixed. |
| Required contextual fields for active docking/combat/warnings | Proven | Focused tests cover synthetic states; screenshots `05-active-combat-target-gameview.png`, `06-active-docking-gameview.png`, `07-warning-help-4x3-gameview.png`, `08-active-combat-target-4x3-gameview.png`, `09-active-docking-4x3-gameview.png`, `10-warning-help-16x9-gameview.png`, `11-warning-combat-4x3-gameview.png` | Current audit evidence covers combat, docking, warning/help, warning+combat, 16:9, and 4:3. |
| Interactions: nav controls, kill momentum, combat controls | Proven by tests | `KillMomentumButtonActivatesIdleAbortsActiveAndDisablesUnavailable`; `NavigationComputerControlsReuseAutopilotAndPreviewApis`; `CombatComputerControlsReuseWeaponComputerApis` | Controller support is not claimed. |

## Section 5: Navigation / Autopilot UI

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Selected target name, distance, target count/type, marker/radar | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues`; `TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets`; screenshot `04-basic-player-nav-context-final.png` | Screenshot shows selected waypoint and target count. |
| Friendly Autopilot/arrival/navigation labels | Proven | `TranslateNavigationState`, `TranslateArrivalPhase`, `TranslateNavigationPhase`; test assertions in `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues` | No internal enum labels in player context. |
| Warnings as chips, not paragraphs | Proven | `TranslateWarning`; `WarningChipsAreUniqueAndDangerSeverityWinsPriority`; screenshots `07-warning-help-4x3-gameview.png`, `10-warning-help-16x9-gameview.png`, `11-warning-combat-4x3-gameview.png` | Warning strip remains compact above Help and during active Combat. |
| ETA/distance/closing/lateral hierarchy | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues`; screenshot `04-basic-player-nav-context-final.png` | Screenshot shows `ETA nicht auf Kurs`, distance, closing, lateral. |

## Section 6: Combat / Weapon Computer UI

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Active target bracket/indicator and health/range/status | Proven | `TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets`; `TargetIndicatorProjectionClampsOffscreenAndHidesRiskyLabels`; screenshots `05-active-combat-target-gameview.png`, `08-active-combat-target-4x3-gameview.png`, `11-warning-combat-4x3-gameview.png` | Current audit screenshots cover active combat target marker and status across 16:9, 4:3, and warning+combat. |
| Auto Fire labels for Armed/Waiting/No target | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak`; `CombatAutoFireNoTargetUsesPlayerLabelWithoutDebugTuning` | No-target/off no longer preempts Nav/Objective. |
| Player controls for cycle/clear/auto/priority | Proven | `CombatComputerControlsReuseWeaponComputerApis`; `ResponsiveLayoutKeepsCombatComputerControlsSeparated` | Controls are hidden outside active/fallback combat context. |
| Debug values excluded | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak` | Hit chance, tuning, yaw/pitch, recoil do not surface in Player context. |

## Section 7: Docking UI

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Docking diagnostics translated | Proven | `TranslateDockingDiagnostic`; `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder` | Covers capture radius, angle, velocity, soft capture, hard lock placeholder labels. |
| Docking director visual helpers | Proven | `PrototypePlayerHudOverlayGraphic.DrawDockingDirector`; `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder`; screenshots `06-active-docking-gameview.png`, `09-active-docking-4x3-gameview.png` | Active docking proof is included at both supported audit aspect ratios. |
| Soft capture only when eligible/requested | Proven | `PrototypeDockingApproachAssistValidationTests`; `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder` | Soft-capture routed label tested. |
| No fake completed Docked state | Proven | `DockingPortValidationTests.DockingHardLockPlaceholderOnlyRequestsWhenConstraintsPass`; docking snapshot test | Hard lock wording stays placeholder-safe. |

## Section 8: Ship Status / Damage / Modules

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Fuel first-class with low/no fuel warning support | Proven | `SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; screenshots `04-basic-player-nav-context-final.png`, `07-warning-help-4x3-gameview.png`, `10-warning-help-16x9-gameview.png`, `11-warning-combat-4x3-gameview.png` | Exporter evidence covers low-fuel warning behavior in Help and Combat contexts. |
| RCS/Main/SAS chips | Proven | `SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals`; screenshot `04-basic-player-nav-context-final.png` | Shows Main/RCS/SAS player labels. |
| Weapon status in ship/context panels, no ammo UI | Proven | `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals`; combat translator tests | Ammo UI not invented. |
| Cargo inventory | Deferred | Concept says cargo is future gameplay only | Not claimed. |
| Damage summary and RCS reduced warning | Proven | `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals` | Expanded schematic remains later work. |
| Builder semantic alignment | Partial architecture | Ship systems categories align with existing module terms | Full builder UI remains deferred. |

## Overall Audit Result

The current Player HUD is implemented and proven for the v0 flight/navigation/radar/objective/ship-status/combat/docking/help/warning surface described in sections 3-8. The audit now has focused tests plus Unity-rendered exporter screenshots for Basic navigation, active combat, active docking, warning/help, warning+combat, and both 16:9 and 4:3 audit aspect ratios. These are renderer/snapshot evidence, not manually driven live subsystem captures. Remaining items are deferred by the concept itself or belong to future builder/mission/reward/remapping work.
