# Player UI Concept Audit Matrix

Source: `docs/player-facing-ui-concept-v0.md` sections 3-8.

Legend:

- `Proven`: current code plus fresh tests or runtime screenshot directly cover the item.
- `Partial`: implemented or tested in part, but current runtime screenshot proof is incomplete.
- `Deferred`: intentionally not part of v0 according to the concept.
- `Not claimed`: no current feature claim is made.

## Section 3: Information Architecture

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| 3.1 Flight HUD: reticle markers, speed, throttle, fuel, mode, RCS/SAS, warnings, assists | Proven | `PrototypePlayerHud.cs` snapshot/renderer; `PrototypePlayerHudValidationTests.SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; screenshot `04-basic-player-nav-context-final.png`; test run `ea5907...` 31/31 | Basic HUD is current runtime default and uses compact mode hints. |
| 3.1 No raw RCS/SAS/Physics debug telemetry in Player HUD | Proven | `SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; `PlayerHelpExcludesDebugOnlyControlsByDefault`; screenshot `04-basic-player-nav-context-final.png` | Legacy debug layers remain available only outside Basic/default. |
| 3.2 Navigation/Autopilot target, distance, ETA, friendly phase, warnings, route/radar | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues`; `NavigationComputerControlsReuseAutopilotAndPreviewApis`; `RadarSnapshotCollectsGameplayBlipsRoutePreviewAndHazards`; screenshot `04-basic-player-nav-context-final.png` | Current runtime now correctly shows Navigation context instead of no-target Combat. |
| 3.2 No candidate scores / raw planner vectors in player layer | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues` | Dev planner details remain outside the player context. |
| 3.3 Combat active target, health, range, fire status, Auto Fire, priority | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak`; `CombatAutoFireNoTargetUsesPlayerLabelWithoutDebugTuning`; `CombatComputerControlsReuseWeaponComputerApis`; prior screenshot `player-weapon-computer-controls-v1-gameview.png` | Active combat target runtime screenshot exists in prior slice; current audit screenshot covers no-target fallback behavior. |
| 3.3 Combat no hit chance/projectile tuning/yaw-pitch/recoil leak | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak` | Debug weapon panel remains separate. |
| 3.4 Docking shown only for active docking context and translated diagnostics | Proven by tests; runtime screenshot partial | `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder`; `ContextPriorityShowsCriticalCombatDockingNavigationObjectiveInOrder`; `PrototypeDockingApproachAssistValidationTests` | Need active docking GameView screenshot once runtime state setup is stable. |
| 3.4 Hard Lock placeholder-safe wording | Proven | `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder`; `DockingPortValidationTests.DockingHardLockPlaceholderOnlyRequestsWhenConstraintsPass` | UI does not claim "Docked". |
| 3.5 Ship status: fuel, main, RCS, SAS, weapon, simple damage | Proven | `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals`; screenshot `04-basic-player-nav-context-final.png` | Current visible systems stay ship-only; arena/objective is separate. |
| 3.6 Builder/loadout full UI | Deferred | Concept says no true builder in v0 | Not claimed. |
| 3.7 Mission/rewards full UI | Deferred / partial objective architecture | `ObjectivePanelSeparatesArenaProgressFromShipSystems`; `PrototypePveArenaLoopValidationTests` | Arena objective exists because a gameplay loop exists; full mission/reward UI remains deferred. |
| 3.8 Player help from catalog, debug-only controls excluded | Proven by tests; runtime screenshot partial | `PlayerHelpExcludesDebugOnlyControlsByDefault`; `PrototypeUiLayoutManager.ShouldRouteF1ToPrototypeKeybindOverlay` coverage | Need current help overlay screenshot when state switching/input capture is stable. |

## Section 4: Moment-to-Moment Flight HUD v0

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Center reticle FWD/PRO/RET/TGT with no large panel text in center | Proven | `PrototypePlayerHudOverlayGraphic`; `RuntimeOverlayRendersBelowFixedHudPanels`; screenshot `04-basic-player-nav-context-final.png` | World labels can still pass through the center and should get a later readability pass. |
| Top alert/assist strip avoids duplicate assist text | Proven | `WarningChipsAreUniqueAndDangerSeverityWinsPriority`; `WarningStripDoesNotDuplicateAssistChipWhenWarningsAreEmpty` | Current screenshot shows trajectory/objective strip without duplicate assist spam. |
| Bottom flight bar shows speed/throttle/fuel/mode/RCS/SAS and fits text | Proven | `ResponsiveLayoutKeepsHudPanelsSeparatedAcrossAspectRatios`; compact `GetModeSummary` assertion; screenshot `04-basic-player-nav-context-final.png` | Original clipped screenshot removed from final evidence set. |
| Left ship systems and separate objective panel | Proven | `ObjectivePanelSeparatesArenaProgressFromShipSystems`; screenshot `04-basic-player-nav-context-final.png` | Arena no longer lives in Ship Systems. |
| Right context panel switches by priority | Proven | `ContextPriorityShowsCriticalCombatDockingNavigationObjectiveInOrder`; `CombatNoTargetDoesNotPreemptNavigationOrObjective`; screenshot `04-basic-player-nav-context-final.png` | Fix in this slice prevents no-target Combat from hijacking Navigation/Objective. |
| One uGUI player radar; no second IMGUI radar in Basic | Proven | `PlayerHudDoesNotRenderSecondImguiRadarPath`; `BootstrapStartResetsStalePrototypePresetToBasicPlayerView`; screenshot `04-basic-player-nav-context-final.png` | A debug preset leak was found and fixed. |
| Required contextual fields for active docking/combat/warnings | Partial runtime evidence | Focused tests cover synthetic states; current screenshot covers cruise/objective/navigation | Need runtime screenshots for active docking, active combat target, low-fuel/no-RCS, and help overlay. |
| Interactions: nav controls, kill momentum, combat controls | Proven by tests | `KillMomentumButtonActivatesIdleAbortsActiveAndDisablesUnavailable`; `NavigationComputerControlsReuseAutopilotAndPreviewApis`; `CombatComputerControlsReuseWeaponComputerApis` | Controller support is not claimed. |

## Section 5: Navigation / Autopilot UI

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Selected target name, distance, target count/type, marker/radar | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues`; `TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets`; screenshot `04-basic-player-nav-context-final.png` | Screenshot shows selected waypoint and target count. |
| Friendly Autopilot/arrival/navigation labels | Proven | `TranslateNavigationState`, `TranslateArrivalPhase`, `TranslateNavigationPhase`; test assertions in `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues` | No internal enum labels in player context. |
| Warnings as chips, not paragraphs | Proven | `TranslateWarning`; `WarningChipsAreUniqueAndDangerSeverityWinsPriority` | Warning screenshot still pending for runtime matrix. |
| ETA/distance/closing/lateral hierarchy | Proven | `NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues`; screenshot `04-basic-player-nav-context-final.png` | Screenshot shows `ETA nicht auf Kurs`, distance, closing, lateral. |

## Section 6: Combat / Weapon Computer UI

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Active target bracket/indicator and health/range/status | Proven by tests/prior screenshot | `TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets`; `TargetIndicatorProjectionClampsOffscreenAndHidesRiskyLabels`; prior `player-target-indicators-v1` and `player-weapon-computer-controls-v1` evidence | Current audit screenshot only covers no active target. |
| Auto Fire labels for Armed/Waiting/No target | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak`; `CombatAutoFireNoTargetUsesPlayerLabelWithoutDebugTuning` | No-target/off no longer preempts Nav/Objective. |
| Player controls for cycle/clear/auto/priority | Proven | `CombatComputerControlsReuseWeaponComputerApis`; `ResponsiveLayoutKeepsCombatComputerControlsSeparated` | Controls are hidden outside active/fallback combat context. |
| Debug values excluded | Proven | `CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak` | Hit chance, tuning, yaw/pitch, recoil do not surface in Player context. |

## Section 7: Docking UI

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Docking diagnostics translated | Proven | `TranslateDockingDiagnostic`; `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder` | Covers capture radius, angle, velocity, soft capture, hard lock placeholder labels. |
| Docking director visual helpers | Proven by code/tests, partial runtime | `PrototypePlayerHudOverlayGraphic.DrawDockingDirector`; `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder` | Active docking GameView screenshot still needed. |
| Soft capture only when eligible/requested | Proven | `PrototypeDockingApproachAssistValidationTests`; `DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder` | Soft-capture routed label tested. |
| No fake completed Docked state | Proven | `DockingPortValidationTests.DockingHardLockPlaceholderOnlyRequestsWhenConstraintsPass`; docking snapshot test | Hard lock wording stays placeholder-safe. |

## Section 8: Ship Status / Damage / Modules

| Concept item | Status | Current evidence | Notes / next step |
| --- | --- | --- | --- |
| Fuel first-class with low/no fuel warning support | Proven | `SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; screenshot `04-basic-player-nav-context-final.png` | Runtime low-fuel screenshot still pending. |
| RCS/Main/SAS chips | Proven | `SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry`; `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals`; screenshot `04-basic-player-nav-context-final.png` | Shows Main/RCS/SAS player labels. |
| Weapon status in ship/context panels, no ammo UI | Proven | `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals`; combat translator tests | Ammo UI not invented. |
| Cargo inventory | Deferred | Concept says cargo is future gameplay only | Not claimed. |
| Damage summary and RCS reduced warning | Proven | `ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals` | Expanded schematic remains later work. |
| Builder semantic alignment | Partial architecture | Ship systems categories align with existing module terms | Full builder UI remains deferred. |

## Overall Audit Result

The current Player HUD is substantially implemented for v0 flight/navigation/radar/objective/ship-status/combat-control basics and has fresh tests plus a clean real GameView screenshot. The full thread goal remains open because this audit still lacks real runtime screenshots for active docking, active combat target, help/warning states, and at least one non-16:9 live visual capture.
