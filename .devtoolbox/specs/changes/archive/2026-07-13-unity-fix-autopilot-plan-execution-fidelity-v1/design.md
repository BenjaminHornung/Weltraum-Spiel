# Design: Autopilot Plan Execution Fidelity

Stand: 2026-06-12. Alle Zeilennummern beziehen sich auf den Stand von Commit `a68333b`.

## 1. Ist-Architektur (Kurzfassung)

Ablauf pro `FixedUpdate` in `PrototypeWaypointAutopilot` (`Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs:386`):

1. `RefreshDiagnostics()` berechnet `LastMetrics` (Distanz, Closing Speed, `shouldBrake`, Stopping Distance).
2. `RefreshNavigationPlan()` (`:4829`) baut bei Bedarf via `PrototypeTrajectoryPlanner.Plan(...)` einen `PrototypeTrajectoryPlan` inkl. `PrototypeFlightPlan` (Manoever-Segmente + vorberechnete Samples).
3. Hold-/Terminal-Gates (`ShouldMaintainArrivalHold`, `ShouldCaptureAnyArrivalHold`, `:447-454`).
4. `TryRunFlightPlanExecutor()` (`:880`): waehlt Segment per `flightPlanElapsedSeconds`, baut `ExecutionState` (Soll-Ist-Vergleich gegen interpolierte Segment-Endpunkte), `TrackingCommand` (PD-Regler gegen vorberechnete Samples), `DivergenceReport`, und wendet das Segment an.
5. Fallback: Legacy `RunAutopilotStep()` (bei `strictFlightPlanExecution=true` fuer DirectFastTransfer blockiert).

Der DirectFastTransfer-Plan entsteht in `PrototypeTrajectoryPlanner.SolveDirectFastTransfer` (`PrototypeTrajectoryPlanner.cs:687-804`): zeitoptimales Bang-Bang-Profil Burn→Flip→Brake mit `vPeak` aus `(2*a_burn*a_brake*d + a_brake*v0^2)/(a_burn+a_brake)`, Flip-Drift-Korrektur, danach Segment-Bau in `TryBuildDirectFastTransferSegments` (`:852`) und Umwandlung in Manoever-Segmente + Samples in `BuildFlightPlan`/`AddManeuverSegment` (`:1145-1438`).

## 2. Befund: Warum der Plan nicht abgearbeitet wird

### 2.1 Kernfehler B — Plan-Uhr wird manipuliert, Referenztrajektorie nicht (Hauptursache fuer Dauer-REPLAN)

Der Executor indiziert den Plan ueber `flightPlanElapsedSeconds`. Soll-Position/-Geschwindigkeit kommen aus zeitindizierten Samples (`PrototypeFlightPlanTracker.TryInterpolateSample`, `PrototypeFlightPlan.cs:1205`) bzw. Segment-Lerp (`PrototypeFlightPlanExecutionState.FromPlan`, `PrototypeFlightPlan.cs:839-916`). Zwei Mechanismen verschieben die Uhr gegen die Physik:

- **Clock-Holds** (`ShouldHoldDirectFastTransferSegmentClock`, `PrototypeWaypointAutopilot.cs:2527`; angewendet in `TryRunFlightPlanExecutor` `:1024-1042`): Bei Align/Flip-Segmenten wird die Uhr eingefroren, solange `Vector3.Angle(transform.forward, dir)` > 8°/12° oder die Drehrate > 20°/s ist. Am Flip-Anfang ist der Winkel ~180°, d. h. **die Uhr steht waehrend des gesamten realen Flips**. Das Schiff driftet derweil mit `vPeak` weiter, die Soll-Position bleibt eingefroren → Positionsfehler waechst mit `v * Δt`. Bei vPeak ≈ 50 m/s und Positions-Toleranz `max(4 m, arrivalRadius*0.5)` (`CreateFlightPlanTolerance`, Planner `:1667`) ist die Toleranz nach ~0,1 s gerissen → `PositionDivergence|VelocityDivergence` → Status "Tracking correction"/"Replan" praktisch dauerhaft.
- **Clock-Skips** (`TrySkipCompletedFlightPlanAlignSegment` `:2339`, `TrySkipCompletedFlightPlanBrakeFlipSegment` `:2369`, beide via `TryAdvanceToNextFlightPlanSegment` `:2389`): Ist das Schiff frueher ausgerichtet als geplant (Flip: schon bei ≤30°, `BrakeMainThrottleRetrogradeAlignmentDegrees`), springt `flightPlanElapsedSeconds` auf das Segment-Ende. Die Soll-Position springt damit um die restliche Flip-Drift (`vPeak * restliche Flipzeit`) **vor** das echte Schiff. Der Retrograde-Burn beginnt zu frueh (das ist der beobachtete "Flip/Brems-Burn viel zu frueh"), laeuft die volle geplante `tBrake` und bringt das Schiff **vor** dem Ziel auf null → `PlanExpired`/`InvalidPlanDirection` → Replan → neuer Burn → naechster Flip.

Beide Richtungen (Hold = Uhr zu langsam, Skip = Uhr zu schnell) zerstoeren die Zeit-Positions-Korrespondenz, auf der ExecutionState, Tracker und Divergence-Monitor basieren.

### 2.2 Kernfehler A — Plan-Physik ≠ Schiffs-Physik

- **Kein Throttle-Spool-Up/-Down:** `PredictManeuverEnd` (Planner `:1451`) und `SolveDirectFastTransfer` rechnen mit sofort anliegender Vollbeschleunigung. `PrototypeShipPlanningSnapshot` enthaelt `mainThrottleSpoolUpRate/DownRate` (wird von `PrototypeShipPlanningSnapshotBuilder` befuellt), **wird aber nirgends im Planner benutzt**. Real verzoegert `MainThrusterModule.ThrottleSpoolUpRate` den Schubaufbau → reale ΔV pro Segment < geplante ΔV → Velocity-/Positionsdivergenz schon im Burn.
- **Falsche Drehzeit-Schaetzung:** `EstimateAttitudeSegmentSeconds` (Planner `:1620`) rechnet `angularAcceleration = rcsAttitudeForceNewtons / inertia` — dimensional falsch (Kraft statt Drehmoment, kein Hebelarm), keine Drehratenbegrenzung, Clamp auf [0,2 s; 6 s]. Die Ausfuehrung limitiert den Flip aber auf `BrakeFlipMaxTurnRateDegreesPerSecond = 58 °/s`, `BrakeFlipMaxAngularAccelerationRadPerSecondSquared = 3 rad/s²`, Damping 0,4 s (Autopilot `:91-93`) plus Latch-Einrastwinkel. Ein 180°-Flip dauert real eher 4-6+ s; die Schaetzung kann in beide Richtungen stark abweichen. Genau diese Diskrepanz erzwingt die Holds/Skips aus 2.1.
- **Burn setzt perfekte Ausrichtung ab Segmentstart voraus**, real gibt es Restwinkel/Latch-Verzoegerung.

### 2.3 Kernfehler C — Replan-Schleife mit Bang-Bang-Kipppunkt

`TryHandleFlightPlanDivergence` → `ForceFlightPlanSafetyReplan` (`:1382`) hat nur 0,45 s Cooldown (`FlightPlanDivergenceReplanCooldownSeconds`, `:96`). Jeder Replan plant ab Ist-Zustand neu. Nach dem energetischen Mittelpunkt gilt in `SolveDirectFastTransfer` `vPeak <= vAlong0` → `brakeImmediately = true` (`:754-755`) → der neue Plan ist ein reiner Brake+Hold-Plan. Da die Bremsung (wegen 2.1/2.2 plus Margen) vor dem Ziel endet, folgt der naechste Replan mit neuem Burn-Flip-Brake. Ergebnis: die beobachtete Oszillation "zu frueh flippen, zu frueh bremsen, staendig Replan".

### 2.4 Fehler D — Inkonsistente Brems-Annahmen in den Live-Metriken

`RefreshDiagnostics` (`:4745-4769`) uebergibt `GetMaxDeceleration()` = `GetMaxAcceleration() * ReverseThrustMultiplier` (Clamp 0,1-1, Fallback 0,35; `:5266-5271`) an `CalculateMetrics`. Der DFT-Plan bremst aber nach dem Flip mit **vollem** Hauptschub (`brakeAcceleration = burnAcceleration`, Planner `:709`). `LastMetrics.stoppingDistance`/`shouldBrake` sind damit ~3x zu konservativ; `ShouldUseConservativeFlightPlanBrakeSafety` (`:1609`) rechnet zusaetzlich mit Faktor 0,45 → ~6x zu konservativ. Diese Metriken speisen Terminal-/Hold-Gates (`ShouldCaptureAnyArrivalHold`, `ShouldSettleFlightPlanBrakeSegment` `:2884`, Brake-Timing-Divergenz fuer Nicht-DFT-Plaene `:1593`) und draengen die Ausfuehrung zusaetzlich zu fruehem Bremsen/Halten.

### 2.5 Fehler E — Plan-Knopf-Ergebnis wird beim Engage verworfen

`ToggleAutopilot` (`:501`) setzt `forceNextFlightPlanRevision = true` + `MarkNavigationPlanDirty()` (`:575-577, 594`) → beim Start wird zwingend ein neuer Plan gerechnet; der per `ReplanNow()` (Plan-Knopf) erzeugte Plan wird nie ausgefuehrt. Funktional meist gleichwertig (Neuplanung ab Ist-Zustand), aber es widerspricht dem gewuenschten Modell "erst planen, dann exakt diesen Plan ausfuehren" und verhindert UI-seitige Plan-Vorschau == Ausfuehrung.

### 2.6 Strukturproblem F

5510 Zeilen `PrototypeWaypointAutopilot` mit drei konkurrierenden Autoritaeten (Hold-Gates vor dem Executor, Executor+Tracker+Monitor mit DFT-Sonderpfaden, Legacy-Fallback) und ~30 Latch-/Lock-Feldern. Die Git-Historie (`#FIX-DIRECT-FAST-TRANSFER-BANGBANG`, `#FIX-...-SMOOTHNESS`, `#FIX-AUTHORITATIVE-FLIGHTPLAN-TRACKING`) zeigt, dass bisher Symptome mit weiteren Sonderfaellen (Latches, Soft-Correction-Maskierung, Terminal-Capture) ueberdeckt wurden, statt die Zeitbasis- und Modellfehler zu beheben.

## 3. Soll-Design

Leitprinzip: **Plan-Zeit == Physik-Zeit, und der Plan ist fliegbar.** Der Executor folgt der Uhr strikt; der Planner garantiert, dass das Schiff den Zeitplan mit seinen echten Aktuator-Limits einhalten kann. Divergenz ist dann selten und ehrlich.

### Phase 1 — Physikgetreue Planung (PrototypeTrajectoryPlanner.cs)

1.1 **Drehzeitmodell vereinheitlichen.** Neue Hilfsfunktion (z. B. `EstimateTurnSeconds(angleDeg, maxRateDegPerSec, maxAngularAccelRadPerSec2, dampingSeconds)`) mit Trapezprofil. Die Limits kommen aus denselben Konstanten, die die Ausfuehrung benutzt (58 °/s, 3 rad/s², 0,4 s Damping — diese Konstanten aus `PrototypeWaypointAutopilot` in eine gemeinsame statische Konfigklasse oder in den `PrototypeShipPlanningSnapshot` verschieben, damit Planner und Executor identische Werte sehen). Aufschlag fuer Latch-Einrasten (`DirectFastTransferBurnLatchEngageDegrees`-Fenster, ~0,3-0,5 s Marge). `EstimateAttitudeSegmentSeconds` (`:1620`) ersetzen; `MaximumAttitudeSegmentSeconds` auf realistisch (z. B. 12 s) anheben.

1.2 **Spool-Up/-Down modellieren.** In `SolveDirectFastTransfer` und `PredictManeuverEnd`: effektive Burn-ΔV um Spool-Rampe korrigieren. Analytisch reicht: `spoolUpSeconds = 1/spoolUpRate` (Rampe 0→1), Verlust ≈ `0.5 * a * spoolUpSeconds`; `tBurn`/`tBrake` entsprechend verlaengern und die Samples in `PredictManeuverEnd` mit gerampter Beschleunigung integrieren (Erweiterung von `TrajectoryPredictionSettings` um Start-Throttle/Spool-Rate, oder Vor-Segment "SpoolUp" mit linear steigendem Schub). Wichtig: dieselbe Korrektur fuer den Brake (Spool-Up nach Flip!) — der Brake beginnt real mit 0 % Schub.

1.3 **vPeak-Iteration mit korrigierten Zeiten.** Die bestehende 3-fach-Iteration (`:741-749`) uebernimmt die neuen `flipTime`-Werte automatisch; zusaetzlich Spool-Verluste in die Distanzbilanz aufnehmen (sBurn/sBrake um Rampenanteile korrigieren). Akzeptanzkriterium: Vorhersage-Endposition des Plans gegen einen PlayMode-Lauf < 0,5 % der Distanz Fehler.

1.4 **Brake-Sicherheitsmarge explizit in den Plan legen** statt in Live-Gates: `tBrake` so legen, dass die geplante Endgeschwindigkeit beim Erreichen des Arrival-Radius ≈ `arrivalSpeed` ist (nicht 0 weit vor dem Ziel), Restgeschwindigkeit faengt der bestehende Terminal-Capture/Hold ab.

### Phase 2 — Zeitbasis reparieren (PrototypeWaypointAutopilot.cs)

2.1 **Clock-Skips entfernen.** `TrySkipCompletedFlightPlanAlignSegment` (`:2339`) und `TrySkipCompletedFlightPlanBrakeFlipSegment` (`:2369`) ersatzlos streichen (Aufrufer in `ApplyFlightPlanSegment` `:2171, :2268`). Wer frueher ausgerichtet ist, haelt die Lage bis zum geplanten Segmentende (AttitudeOnly-Segment tut dann nichts weiter — das ist korrekt, weil die Soll-Trajektorie die Drift dieser Zeit bereits enthaelt).

2.2 **Clock-Holds entfernen.** `ShouldHoldDirectFastTransferSegmentClock` (`:2527`) samt `ShouldHoldDirectFastTransferAttitudeSegmentClock`, `ShouldHoldDirectFastTransferMainSegmentClock` und der Hold-Zweig in `TryRunFlightPlanExecutor` (`:1024-1042`) entfaellt; die Uhr laeuft immer mit `Time.fixedDeltaTime`. Die Throttle-Latches (`UpdateDirectFastTransferMainThrottleLatch`) bleiben als reine Aktuator-Gates erhalten (kein Schub bei Fehlausrichtung), aber ohne Uhr-Eingriff. Der bestehende Authority-Timeout (`TryTimeoutDirectFastTransferMainAuthorityBlock`, 6 s) wird zum ehrlichen Replan-/Fail-Pfad, falls die Ausrichtung dauerhaft nicht gelingt.

2.3 **Geschwindigkeitsabhaengige Toleranzen.** Da kleine Timing-Restfehler bei hoher Geschwindigkeit grosse Positionsfehler erzeugen: in `CreateFlightPlanTolerance` (Planner `:1667`) bzw. pro Segment Positions-Toleranz = `max(Default, plannedSpeed * 0.5 s)`, Velocity-Toleranz = `max(Default, 0.05 * plannedSpeed)`. Damit traegt die Toleranz die realen Regelabweichungen, ohne Divergenz-Spam.

### Phase 3 — Konsistente Brems-Metriken

3.1 `RefreshDiagnostics` (`:4764-4769`): Wenn ein gueltiger Flip-Brake-Plan aktiv ist (DFT oder Brake-Segment mit MainThrottle), volle `GetMaxAcceleration()` als `maxDeceleration` an `CalculateMetrics` uebergeben (neue Methode `GetEffectiveBrakeDeceleration()`); `ReverseThrustMultiplier` nur fuer reine Reverse-Brems-Szenarien ohne Flip.

3.2 `ShouldUseConservativeFlightPlanBrakeSafety` (`:1609`) und die Hold-/Terminal-Gates vor dem Executor (`FixedUpdate` `:447-454`) duerfen waehrend eines aktiven, nicht-divergenten Flugplans nicht eingreifen; Bedingung an `IsStrictDirectFastTransferExecutionActive()` bzw. ein neues `FlightPlanIsNominal` koppeln.

### Phase 4 — Replan-Hygiene

4.1 `FlightPlanDivergenceReplanCooldownSeconds` 0,45 → 2,0 s; `FlightPlanDivergenceConfirmSeconds` 0,3 → 0,5 s (nur fuer weiche Gruende; harte Gruende bleiben sofort).

4.2 **Kein Doppel-Flip nach Replan:** Wenn der neue Plan mit Brake beginnt und das Schiff bereits retrograd ausgerichtet ist (Winkel ≤ Latch-Keep), Align-/Flip-Segment beim Bau ueberspringen (im Planner anhand `shipSnapshot.initialState.rotation` entscheiden — nicht im Executor per Uhr-Sprung). Nach `directFastTransferBrakeCommitted` nur noch Brake/Hold-Plaene zulassen (Hysterese im `RefreshNavigationPlan`-Pfad via `suppressDirectFastTransfer`-Flag analog `:4869`).

4.3 **Plan-Knopf autoritativ:** In `ToggleAutopilot` (`:575-577`) `forceNextFlightPlanRevision` nur setzen, wenn kein gueltiger frischer Plan existiert (Ziel unveraendert per `ShouldPreserveActiveFlightPlan`-Logik `:4949`, Alter < `FlightPlanSafetyRefreshIntervalSeconds`, Tracking-Fehler klein). Sonst vorhandenen Plan mit neuer Revision uebernehmen und ausfuehren.

### Phase 5 — UI-Status ehrlich machen

`BuildNavigationWarningChips` (`:726`): `REPLAN`-Chip nur bei tatsaechlich erzwungenem Replan (z. B. Zeitstempel `lastFlightPlanSafetyReplanAtTime` < 2 s), nicht bei `requiresReplan` aus einem 2 s gehaltenen Divergenz-Report (`FlightPlanDivergenceStatusHoldSeconds`). Tracking-Korrekturen als eigener, neutraler Status ("TRACKING").

### Phase 6 — Tests & Evidence

- **EditMode:** (a) `EstimateTurnSeconds`-Trapezprofil gegen analytische Werte; (b) Solver mit Spool-Rampe: geplante Endposition == integrierte Vorhersage; (c) Toleranzskalierung.
- **PlayMode-Regression (Kernkriterium):** Engage auf entfernten Wegpunkt (>= 2 km, stehend): genau 1 `FlipToRetrograde`-Phase, 0 Aufrufe von `ForceFlightPlanSafetyReplan`, Ankunft `distance <= arrivalRadius`, `relativeSpeed <= arrivalSpeed*1.5`, Gesamtdauer ≈ `plan.totalDurationSeconds` ± 15 %. Bestehende Tests in `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs` und die DFT-Haertungstests anpassen (sie kodieren teilweise das Skip/Hold-Verhalten!).
- Evidence (CSV-Telemetrie Plan vs. Ist, Screenshots) unter `tests/` dieses Changes ablegen.

### Phase 7 (optional, Folge-Change) — Strukturabbau

Executor (+Tracker-Anbindung) in eigene Klasse `PrototypeFlightPlanExecutor` extrahieren; DFT-Sonderpfade (Soft-Correction-Maskierung `TryHandleDirectFastTransferSoftTrackingCorrection`, Terminal-Reacquire) reduzieren, sobald Phasen 1-4 die Divergenzfrequenz gesenkt haben. Legacy-`RunAutopilotStep` nur noch fuer Avoidance/No-Authority.

## 4. Reihenfolge & Abhaengigkeiten

Phase 1 und 2 gehoeren zusammen in einen Schritt (Holds entfernen ohne korrektes Drehzeitmodell wuerde sofortige Divergenzen erzeugen). Danach 3, 4, 5 unabhaengig. Tests (6) begleitend, Regression zuletzt gruen.

## 5. Risiken

- Schiffs-Varianten mit sehr schwacher RCS-Attitude-Authority: Drehzeitmodell braucht die realen Limits aus dem Snapshot, sonst wieder Modell-Drift. Der 6-s-Authority-Timeout bleibt als Netz.
- Bestehende Regressionstests kodieren das heutige (fehlerhafte) Hold/Skip-Verhalten und muessen bewusst angepasst werden — nicht "gruen gemacht" durch Rueckbau der Fixes.
- `brakeImmediately`-Plaene (Engage mit hoher Anfangsgeschwindigkeit) brauchen den Spool-korrigierten Brake ebenfalls, sonst Overshoot.
