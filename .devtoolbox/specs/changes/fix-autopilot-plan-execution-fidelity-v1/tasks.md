# Tasks: Autopilot Plan Execution Fidelity

Referenz: `design.md` (Zeilennummern = Commit `a68333b`).

## Phase 0 — Repro & Telemetrie
- [x] PlayMode-Diagnosetest: entfernter Wegpunkt, CSV-Log pro FixedUpdate (planElapsed, Segment/Phase, Soll-Pos/Vel aus Samples, Ist-Pos/Vel, requestedMainThrottle, DivergenceReasons, ForceReplan-Zaehler). Beleg fuer Befund 2.1/2.3 ablegen unter `tests/performance/`.

## Phase 1 — Physikgetreue Planung (`PrototypeTrajectoryPlanner.cs`)
- [x] Gemeinsame Turn-Limits: Konstanten `BrakeFlipMaxTurnRateDegreesPerSecond`, `BrakeFlipMaxAngularAccelerationRadPerSecondSquared`, `BrakeFlipDampingTimeSeconds` aus `PrototypeWaypointAutopilot.cs:91-93` in gemeinsame Konfig (statische Klasse oder `PrototypeShipPlanningSnapshot`) verschieben.
- [x] `EstimateAttitudeSegmentSeconds` (`:1620`) durch Trapezprofil-Modell mit diesen Limits + Latch-Marge ersetzen; `MaximumAttitudeSegmentSeconds` anheben (z. B. 12 s).
- [x] Spool-Up/Down in `SolveDirectFastTransfer` (`:687`) und `PredictManeuverEnd` (`:1451`) modellieren (Snapshot-Felder `mainThrottleSpoolUpRate/DownRate` nutzen); gilt fuer Burn UND Brake.
- [x] vPeak-/Distanzbilanz (`:741-758`) mit Spool-Verlusten und neuer Flipzeit korrigieren.
- [x] Brake-Ende auf `arrivalSpeed` am Arrival-Radius auslegen statt v=0 vor dem Ziel.

## Phase 2 — Zeitbasis (`PrototypeWaypointAutopilot.cs`)
- [x] `TrySkipCompletedFlightPlanAlignSegment` (`:2339`) + `TrySkipCompletedFlightPlanBrakeFlipSegment` (`:2369`) + `TryAdvanceToNextFlightPlanSegment` (`:2389`) entfernen; Aufrufer in `ApplyFlightPlanSegment` (`:2171`, `:2268`) bereinigen.
- [x] Clock-Hold-Pfad entfernen: `ShouldHoldDirectFastTransferSegmentClock` (`:2527`) und Hold-Zweig in `TryRunFlightPlanExecutor` (`:1024-1042`); Uhr laeuft immer. Throttle-Latches bleiben als Aktuator-Gate; Authority-Timeout (`:2654`) bleibt.
- [x] Geschwindigkeitsabhaengige Toleranzen in `CreateFlightPlanTolerance` (Planner `:1667`) bzw. pro Segment.

## Phase 3 — Brems-Metriken
- [x] `GetEffectiveBrakeDeceleration()` einfuehren; `RefreshDiagnostics` (`:4764`) nutzt vollen Hauptschub, wenn Flip-Brake geplant ist (statt `GetMaxDeceleration()` mit ReverseThrustMultiplier `:5266`).
- [ ] Hold-/Terminal-Gates (`FixedUpdate` `:447-454`, `ShouldUseConservativeFlightPlanBrakeSafety` `:1609`) waehrend nominaler Planausfuehrung deaktivieren.

## Phase 4 — Replan-Hygiene
- [ ] `FlightPlanDivergenceReplanCooldownSeconds` 0,45 → 2,0 s; Confirm-Fenster fuer weiche Gruende 0,5 s.
- [ ] Planner: Align-/Flip-Segment entfaellt, wenn Startrotation bereits passt (kein Doppel-Flip nach Replan); nach `directFastTransferBrakeCommitted` nur Brake/Hold-Replaene.
- [ ] `ToggleAutopilot` (`:575-577`): frischen gueltigen Plan vom Plan-Knopf uebernehmen statt erzwungener Neuplanung.

## Phase 5 — UI-Status
- [ ] `BuildNavigationWarningChips` (`:726`): REPLAN-Chip nur bei realem erzwungenem Replan; Tracking-Korrektur als eigener Status.

## Phase 6 — Tests & Evidence
- [ ] EditMode: Turn-Modell, Spool-Solver, Toleranzskalierung.
- [ ] PlayMode-Regression: 1 Flip, 0 erzwungene Replans, Ankunft in Radius/Speed, Dauer ≈ Plan ± 15 %.
- [ ] Bestehende DFT-/Navigations-Tests (u. a. `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`, Haertungstests aus `harden-direct-fast-transfer-autopilot-regression-tests-v1`) an neues Verhalten anpassen.
- [ ] Evidence (CSV, Screenshots, Protokoll) unter `tests/` dieses Changes.

## Phase 7 (optional, separater Change)
- [ ] Executor in `PrototypeFlightPlanExecutor` extrahieren, DFT-Sonderpfade reduzieren, Legacy-Pfad eingrenzen.
