## Kurzurteil

GitHub konnte verbunden werden. Der Vergleich `1fe8b09397bdf2fcf2ca601f99cbb4b3a9e9f9ed..9cb04edd4e9e40605c8946e48e50fbc155b5a87d` bestätigt: Der neueste Commit ist test-/spec-/log-only. Er ändert keinen Product-Code. Dass die fokussierten DFT-Regressionsfälle jetzt grün sind, beweist also nur, dass die aktuelle Testhülle die bisherigen DFT-Pulsing-Fälle abdeckt. Es erklärt nicht die weiter roten Terminal-/Braking-Szenarien.

Meine Einschätzung: Die gewünschte Architektur ist **konzeptionell kompatibel**, aber der aktuelle Code erfüllt diesen Vertrag nicht sauber. Das Problem ist nicht “DFT ist grundsätzlich falsch”, sondern ein **Ownership-Mismatch**: `PrototypeWaypointAutopilot` enthält gleichzeitig einen Flight-Plan-Executor, Legacy-Closed-Loop-Braking, Terminal-Hold-/Capture-Logik, Divergence-Monitoring, Safety-Replan und UI-Status-Erzeugung. Diese Systeme dürfen während einer strikt geplanten DFT-Ausführung noch mitentscheiden. Genau deshalb taucht “Replan” weiter auf und genau deshalb ist Braking schwerer stabil zu bekommen als Burn.

Unsicherheit: Ich habe die angehängten Dateien und den GitHub-Commitvergleich geprüft, aber die Unity-Simulation nicht selbst ausgeführt. Die konkrete letzte Frame-Ursache der zwei roten PlayMode-Tests kann ich ohne erweiterten Trace nicht beweisen. Die strukturellen Konflikte im Code sind aber klar genug, um die nächste Product-Code-Änderung einzugrenzen.

---

## Severity-ranked Findings

### S1: Flight-Plan-Executor und Legacy-Terminal/Brake-State-Machine besitzen denselben Aktuatorpfad

**Kategorie:** realer Architektur-Mismatch in der aktuellen Implementierung, nicht zwingend falsche Grundidee.

Der stärkste Befund ist die Kontrollfluss-Reihenfolge in `PrototypeWaypointAutopilot.FixedUpdate()`:

* Vor dem Flight-Plan-Executor kann Terminal-/Hold-Logik übernehmen: `PrototypeWaypointAutopilot.cs:441-444`.
* Danach läuft erst `TryRunFlightPlanExecutor()`: `PrototypeWaypointAutopilot.cs:449-452`.
* Danach wird Legacy-Fallback blockiert oder `RunAutopilotStep()` ausgeführt: `PrototypeWaypointAutopilot.cs:454-459`.

Das bedeutet: Selbst bei aktiviertem `flightPlanExecutorEnabled` und `strictFlightPlanExecution` ist die Ausführung nicht rein “Plan owns controls”. Der Plan ist eine Autorität, aber nicht die einzige.

Besonders kritisch ist dieser Pfad:

* `ApplyFlightPlanSegment()` kann bei DFT-Segmenten in Legacy-`ApplyBrakeRequest()` umleiten, sobald `arrivalBrakeCommitted` gesetzt ist: `PrototypeWaypointAutopilot.cs:1755-1764`.
* `ApplyFlightPlanBrakeSegment()` setzt genau dieses Legacy-Flag für Flight-Plan-Braking: `PrototypeWaypointAutopilot.cs:2305-2314`.
* `ApplyBrakeRequest()` benutzt dann wieder dynamische Legacy-Brake-Logik: `PrototypeWaypointAutopilot.cs:2797-2814`.

Das ist gegen das gewünschte Modell: Eine geplante DFT-Brake-Phase darf nicht global ein Legacy-Flag setzen, das später Align/Burn/Reacquire/Terminal-Pfade überstimmt.

**Auswirkung auf den roten Test `PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`:**
Das Endbild “sehr langsam, aber 177 m vom Ziel entfernt, State `FlipForBrake` / Phase `Brake`, main 0, RCS only, `arrivalBrakeCommitted=True`” passt zu einem Ownership-Fehler: Der Controller hat Energie abgebaut, ist aber nicht sauber in Terminal Capture oder Reacquire gewechselt. Er bleibt in einer Brake-/Flip-Verpflichtung hängen, obwohl das Ziel noch weit außerhalb der Arrival-Deadzone liegt.

Der Test meldet keine Brake/Accelerate-Flaps. Das ist wichtig: Das sieht nicht mehr wie das alte Throttle-Pulsing aus. Es sieht wie ein **stabiler falscher Zustand** aus.

---

### S1: Terminal Capture ist nicht Teil des unveränderlichen DFT-Plans

**Kategorie:** Architekturvertrag unvollständig, Product-Code-Design-Lücke.

`PrototypeTrajectoryPlanner` erzeugt für DirectFastTransfer im Kern ProgradeBurn, RetrogradeBurn und Hold. Align und Flip werden später eingefügt:

* DFT-Segmente: `PrototypeTrajectoryPlanner.cs:852-934`.
* Align/Flip-Insertion in `BuildFlightPlan()`: `PrototypeTrajectoryPlanner.cs:1192-1284`.

Was fehlt, ist ein explizites geplantes Terminal-Segment mit Vertrag:

* Was passiert, wenn der Brake am Ziel knapp daneben endet?
* Was passiert, wenn die Geschwindigkeit niedrig ist, aber die Distanz noch groß ist?
* Wer darf nach DFT-Brake die Richtung bestimmen: Planrichtung, Retrograde, Target-Direction oder RCS?
* Wann ist Reacquire erlaubt?
* Wann ist Plan-Miss ein harter Fehler?

Aktuell wird dieser Übergang durch verstreute Live-Logik erledigt:

* `TryRunFlightPlanTerminalSafety()`: `PrototypeWaypointAutopilot.cs:1584-1628`.
* `ShouldCaptureAnyArrivalHold()`: `PrototypeWaypointAutopilot.cs:3335-3345`.
* `ShouldUseTerminalLateralCorrection()`: `PrototypeWaypointAutopilot.cs:3354-3395`.
* `ResolveBrakeDirection()`: `PrototypeWaypointAutopilot.cs:3431-3512`.

Das ist der Hauptgrund, warum “vorher planen, dann deterministisch ausführen” nicht wirklich stimmt. Der grobe DFT-Transfer ist geplant. Der terminale Hand-off ist weiterhin live und opportunistisch.

**Praktische Konsequenz:**
Die Architektur kann funktionieren, aber nur, wenn Terminal Capture als geplanter Abschnitt oder als explizite Executor-Policy modelliert wird. Ein bloßes `Hold` nach dem Brake reicht nicht, wenn Unity-Integration, Rotationslatenz, Lateral Velocity und Deadzone-Toleranzen real mitspielen.

---

### S2: “Replan” wird als Status, Divergence-Kategorie und echte Plan-Ersetzung vermischt

**Kategorie:** Status/UX-Problem plus Implementierungsrisiko.

Es gibt mindestens drei unterschiedliche Dinge, die im Code ähnlich aussehen:

1. **Beobachtete Abweichung:** Position/Velocity/Attitude weicht von der idealen Trajektorie ab.
2. **Korrektur während gültigem Plan:** DFT soft tracking correction.
3. **Echte Plan-Ersetzung:** `ForceFlightPlanSafetyReplan()` setzt Revision/Plan neu.

Der Code vermischt diese Ebenen:

* `PrototypeFlightPlanTracker.Track()` erzeugt bei Toleranzverletzungen ein Statuslabel `Replan: ...`: `PrototypeFlightPlan.cs:1471-1474`.
* `PrototypeFlightPlanDivergenceMonitor.Evaluate()` macht aus jedem nicht-Abort-Grund standardmäßig `Replan: ...`: `PrototypeFlightPlan.cs:1774-1788`.
* `SetFlightPlanDivergenceReport()` schreibt den Status und hält ihn für 2 Sekunden sichtbar: `PrototypeWaypointAutopilot.cs:1294-1330`.
* `ForceFlightPlanSafetyReplan()` ist dagegen die echte Plan-Ersetzung: `PrototypeWaypointAutopilot.cs:1254-1291`.

Für DFT gibt es inzwischen eine Sonderbehandlung:

* `TryHandleDirectFastTransferSoftTrackingCorrection()` wandelt bestimmte Gründe in `Tracking correction` um und verhindert Replan: `PrototypeWaypointAutopilot.cs:1112-1145`.
* Die Soft-Gründe sind `PositionDivergence`, `VelocityDivergence`, `AttitudeDivergence`, `TrackingDiverged`, plus im Code auch `FuelMismatch`: `PrototypeWaypointAutopilot.cs:109-114`.

Aber diese Sonderbehandlung greift nur, wenn gerade ein aktives DFT-Segment erkannt wird und die Reasons exakt in diese Soft-Klasse fallen. Sobald `PlanExpired`, `TimeSlip`, `InvalidPlanDirection`, `ActuatorLimited`, `NonExecutable`, Terminal Safety oder Legacy-Fallback beteiligt sind, landet man wieder bei “Replan”.

**Wahrscheinliche Erklärung für sichtbares “Replan”:**

* In fokussierten DFT-Traces gibt es laut beigefügtem Hardening-Trace 0 Replan-Frames und 0 Replan-Status-Frames.
* In breiteren Terminal-/Braking-Szenarien stammt “Replan” daher wahrscheinlich aus PlanExpired/Terminal/Legacy/Safety-Pfaden oder aus Status-Label-Semantik, nicht zwingend aus dem alten DFT-Burn-Pulsing.
* Es kann aber auch echte Plan-Ersetzung sein, wenn `ForceFlightPlanSafetyReplan()` tatsächlich aufgerufen wird. Ohne Revision-/PlanId-Trace im roten Terminalfall ist das nicht sicher zu trennen.

**Korrekte Modellierung:**
UI sollte nicht “Replan” anzeigen, nur weil eine Abweichung beobachtet wurde. UI sollte unterscheiden:

* `Tracking correction`
* `Plan valid, correcting`
* `Plan invalidated`
* `Replanned`
* `Abort required`
* `Manual abort`

---

### S2: Braking-Richtung wird terminal weiter verfolgt und kann zusätzliche Rotation aufsummieren

**Kategorie:** Implementierungsbug plus Controller-Limitation.

Der zweite rote Test endet erfolgreich in `Complete` / `Hold`, aber mit zu viel integrierter Brake-Rotation:

* Ist: `integratedBrakeRotationRadians=5.73`
* Erwartet: `<= 4.24`
* `maxFlipAngularSpeed=0.53`, also kein wilder Spin, sondern langsames Nachdrehen.

Der relevante Code ist die Legacy-Richtungsauswahl:

* `ResolveBrakeDirection()` bestimmt dynamisch `observedBrakeDirection = -relativeVelocity.normalized`: `PrototypeWaypointAutopilot.cs:3431-3512`.
* In Terminalnähe kann die Richtung geglättet, neu committed oder langsam in Richtung beobachteter Velocity gedreht werden.
* `ComputeBrakeAttitudeTorqueLocal()` begrenzt zwar Turn Rates und Dämpfung: `PrototypeWaypointAutopilot.cs:4102-4137`.

Das Problem ist nicht, dass der Controller zu aggressiv rotiert. Der Test sagt eher: Er rotiert zu lange. Bei seitlicher Geschwindigkeit, RCS-Korrektur und sinkender Geschwindigkeit ändert sich `-velocity` dauernd. Wenn die Brake-Richtung weiter “retrograde chasing” betreibt, sammelt sich Rotationsarbeit an, obwohl man terminal besser eine Richtung latchen und dann an RCS/Hold übergeben sollte.

DFT selbst hat schon eine bessere Regel: Für DirectFastTransfer Flip/RetrogradeBurn bevorzugt `ResolveMainDirection()` die Segmentrichtung: `PrototypeFlightPlan.cs:1597-1610`. Aber der rote Terminaltest läuft offensichtlich in einem Bereich, wo Legacy-Terminal-Brake-Logik wieder relevant ist.

---

### S2: Der aktuelle “strikte” Plan ist nicht wirklich “einmal planen und nie anfassen”

**Kategorie:** Architektur-/Semantik-Mismatch.

Selbst in strict mode wird die Navigation periodisch refreshed:

* `ShouldRefreshNavigationPlanThisTick()` lässt bei Strict-Execution periodische Safety Refreshes zu: `PrototypeWaypointAutopilot.cs:4513-4516`.
* `RefreshNavigationPlan()` versucht zwar, den aktiven Plan zu bewahren, kann aber bei nicht-preservable Reasons eine neue Revision zuweisen: `PrototypeWaypointAutopilot.cs:4420-4498`.

Das kann als Safety-Mechanismus sinnvoll sein. Es ist aber nicht dasselbe wie “precompute whole flight, lock controls, execute fixed plan”. Es ist eher:

> Precompute plan, execute it, monitor live, periodically rebuild/preserve unless invalidated.

Das ist eine valide Architektur, aber sie muss ehrlich benannt werden. Wenn das Produktversprechen “keine nominale Live-Replanung” lautet, dann darf der Refresh nur Hard-Invalidation prüfen und nicht als normale Korrektur-/Statusquelle auftreten.

---

### S3: DFT-Planung ist idealisiert, während Unity-Physik und Controller nicht ideal sind

**Kategorie:** Physics-/Controller-Limitation, kein reiner Bug.

Der Planner modelliert Abschnitte idealisiert:

* `AddManeuverSegment()` propagiert ideal mit Segmentbeschleunigung und kinematischer Rotation: `PrototypeTrajectoryPlanner.cs:1318-1438`.
* DFT berücksichtigt inzwischen initiale Align-Drift: `PrototypeTrajectoryPlanner.cs:710-729`.
* DFT berücksichtigt auch Flip-Drift: `PrototypeTrajectoryPlanner.cs:741-749`.

Nicht vollständig modelliert sind aber:

* tatsächliche Latch-Wartezeit,
* Rotationsüberschwingen,
* FixedUpdate-Quantisierung,
* RCS-Korrektur während Main-Burn,
* Terminal-Deadzone-Capture,
* Richtungschase bei sinkender Geschwindigkeit,
* eventuelle Differenzen zwischen geplanter und realer Bremsautorität.

Ein möglicher Verdacht, mit Unsicherheit: `SolveDirectFastTransfer()` setzt `brakeAcceleration = burnAcceleration` in `PrototypeTrajectoryPlanner.cs:708-710`. In `PrototypeWaypointAutopilot.GetMaxDeceleration()` wird dagegen ein Reverse-Thrust-Scalar verwendet: `PrototypeWaypointAutopilot.cs:4732-4736`. Das kann korrekt sein, wenn DFT-Retrograde ein gedrehter Forward-Main-Burn ist. Es wäre falsch, wenn die reale Brake-Phase tatsächlich reduzierte Reverse-Thrust-Autorität nutzt. Das sollte einmal explizit verifiziert werden.

---

## Warum Braking schwerer ist als Burn

Burn ist in diesem Setup relativ dankbar:

* Zielrichtung und Prograde-Richtung sind meistens ähnlich.
* Full Main Throttle entlang der geplanten Route ist stabil.
* Kleine Tracking Errors können mit RCS und PD-Korrektur behandelt werden.
* Wenn der Burn etwas länger oder kürzer ist, ist der Zustand meist noch energetisch “reparierbar”.

Brake ist schwieriger, weil mehrere “richtige” Richtungen konkurrieren:

1. **Planned brake direction:** meist `-routeDirection`.
2. **Physical retrograde:** `-velocity`.
3. **Terminal target correction:** Richtung zum Ziel oder gegen Closing Speed.
4. **Lateral correction:** RCS soll seitliche Geschwindigkeit abbauen, ohne Main ständig umzudrehen.

Bei Lateral Velocity sind diese Richtungen nicht identisch. Wenn der Main Brake der echten `-velocity` folgt, kann er seitliche Geschwindigkeit gut abbauen, aber vom Zielpfad wegdrücken. Wenn er der geplanten Route folgt, bleibt Lateral Velocity übrig und RCS muss sie kontrollieren. Wenn er terminal zum Ziel “hilft”, ist es kein reines Bremsen mehr.

Dazu kommt: Bremsen braucht vorher Rotation. Jede zusätzliche Rotation kostet Strecke. Wenn die Rotation länger dauert als geplant, beginnt der Brake zu spät. Wenn der Brake zu früh oder zu lange greift, steht das Schiff langsam, aber weit vor dem Ziel. Genau das sieht der rote Deadzone-Test.

Ein rein open-loop vorab berechneter Plan bleibt in Unity nur dann robust, wenn entweder die Physik extrem genau modelliert ist oder die Korrekturen als Teil des Plans erlaubt sind. Realistischer ist ein klarer Hybrid:

> Immutable phase schedule, immutable authority ownership, bounded feedback inside each phase.

Also nicht “keine Anpassung”, sondern “keine Plan-Neubewertung und kein Ownership-Wechsel während nominaler Ausführung”.

---

## Vorgeschlagener Architekturvertrag

### 1. Plan ist nach Engage immutable

Nach AP Engage wird ein `FlightPlanInstance` erzeugt mit:

* PlanId
* Revision
* Segmentliste
* Segmentzeiten
* Segment-Authority
* erlaubten Soft Corrections
* Hard-Invalidation-Kriterien
* Terminal-Handoff-Kriterien

Während nominaler Ausführung darf keine neue Revision entstehen.

### 2. Executor ist alleiniger Writer der Controls

Solange ein strikter Plan aktiv ist, schreibt nur der Executor:

* Main throttle
* RCS request
* desired attitude
* Autopilot state/phase
* visible execution status

Legacy-Methoden wie `ApplyBrakeRequest()`, `RunAutopilotStep()`, `TryEnterHoldPosition()` und Terminal-Hold dürfen nicht global vor oder neben dem Executor übernehmen. Sie dürfen höchstens als Segment-Strategien vom Executor aufgerufen werden.

### 3. Divergence Monitor ist read-only

Der Monitor darf sagen:

* “Tracking error observed”
* “Soft correction active”
* “Hard invalidation pending”
* “Abort required”

Er darf nicht eigenständig “Replan” semantisch erzeugen, keine Aktuatorausgabe löschen und nicht selbst Plan-Replacement auslösen. Das entscheidet der Executor anhand des Planvertrags.

### 4. DFT ist ein expliziter Hybrid

Für DFT:

* Main direction ist pro Segment geplant.
* Main throttle ist pro Burn/Brake geplant und latched.
* RCS/PD darf innerhalb definierter Bounds korrigieren.
* Soft Tracking Errors ändern keinen Plan.
* Wenn Bounds überschritten sind, ist es nicht “nominal replan”, sondern `Plan invalidated` oder `Lost track`.

### 5. Terminal Capture wird geplant

Nach DFT-Brake braucht es ein explizites Segment, zum Beispiel `TerminalCapture` oder `TerminalRcsCapture`.

Minimaler Vertrag:

* Entry: nach RetrogradeBurn oder wenn Brake-End erreicht.
* Wenn innerhalb Capture Envelope: RCS/Hold-Damping.
* Wenn langsam, aber weit weg: geplantes Reacquire zum Ziel, nicht weiter Brake.
* Wenn schnell und außerhalb Envelope: Hard invalidation oder geplante emergency brake, aber nicht stilles Legacy-Hijacking.
* Completion: distance <= arrival radius/deadzone und speed <= completion speed.
* Status: `Terminal capture`, nicht `Replan`.

---

## Minimaler nächster Implementierungsplan

### 1. DFT-Execution-Ownership absichern

**Änderung:** Während `strictFlightPlanExecution && CurrentFlightPlan.IsDirectFastTransfer` und solange der Plan nicht explizit terminal complete ist:

* Pre-Executor-Hold in `FixedUpdate()` nicht ausführen, außer der aktive Segmentvertrag erlaubt Hold.
* Den DFT-Shortcut in `ApplyFlightPlanSegment()` entfernen oder stark einschränken: `PrototypeWaypointAutopilot.cs:1755-1764`.
* `arrivalBrakeCommitted` nicht mehr als globales Legacy-Authority-Flag für DFT verwenden. Für DFT entweder eigenes Executor-internes Flag nutzen oder das Flag nur diagnostisch setzen.
* `ApplyFlightPlanBrakeSegment()` sollte DFT-Brake-Commit nicht in Legacy-Terminal-Ownership übersetzen: `PrototypeWaypointAutopilot.cs:2305-2314`.

**Erwarteter Effekt:** Der Plan bleibt während Align/Burn/Flip/Brake Eigentümer der Controls. Ein einmal gesetztes Brake-Flag kann den Transfer nicht mehr in eine Legacy-Brake-Schleife zwingen.

**Akzeptanztests:**

* Alle 10 fokussierten DFT-PlayMode-Tests bleiben grün.
* `PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone` endet nicht mehr langsam und weit entfernt in `FlipForBrake` / `Brake`.
* Neuer Test: Wenn `arrivalBrakeCommitted=true` während aktivem DFT-ProgradeBurn/Align gesetzt ist, darf `ApplyBrakeRequest()` nicht als globaler Override laufen.

---

### 2. DFT-Terminal-Capture als eigenen Pfad einführen

**Änderung:** Einen fokussierten Product-Code-Pfad bauen, zum Beispiel `TryRunDirectFastTransferTerminalCapture()`, der nur nach DFT-Brake/Plan-Ende greift.

Er sollte drei Zustände sauber unterscheiden:

1. **Inside capture envelope:** RCS/Hold-Damping, Completion prüfen.
2. **Slow but far:** Brake-Commit lösen und geplantes Reacquire zum Ziel ausführen.
3. **Fast and unsafe/outside bounds:** Hard invalidation oder Abort, aber nicht nominal “Replan”.

Wichtig: Dieser Pfad sollte nicht über verstreute `ShouldCaptureAnyArrivalHold()`-/`ApplyBrakeRequest()`-/Legacy-State-Machine-Entscheidungen laufen.

**Akzeptanztests:**

* Der Deadzone-Test erreicht die Completion-Deadzone.
* Wenn Speed sehr niedrig und Distance deutlich > ArrivalRadius ist, wird nicht weiter `FlipForBrake` / `Brake` gehalten.
* Keine Planrevision bei nominalem DFT-Terminal-Capture.
* Status lautet `Terminal capture`, `Reacquire`, `Hold` oder `Complete`, nicht `Replan`.

---

### 3. Terminal-Brake-Richtung latchen statt Velocity endlos zu jagen

**Änderung:** In der Legacy-Terminal-Brake-Logik eine explizite Direction-Latch-Policy einführen:

* Beim Terminal-Brake-Commit `committedBrakeDirection` setzen.
* Während des Commit-Fensters nicht jedes Frame `-velocity` verfolgen.
* Richtung nur ändern, wenn:

  * Fehler sehr groß ist,
  * Speed noch hoch genug ist,
  * und die bisherige Richtung nachweislich unsicher ist.
* Sobald Speed klein genug ist, Übergabe an RCS/Hold, keine weitere Main-Brake-Rotation.

Der konkrete Zielbereich ist `ResolveBrakeDirection()`: `PrototypeWaypointAutopilot.cs:3431-3512`.

**Akzeptanztests:**

* `PlayMode_Autopilot_TerminalBrakeCommit_PredictsDecelWithoutSpinOrFlap` erfüllt `integratedBrakeRotationRadians <= PI * 1.35`.
* `maxFlipAngularSpeed` bleibt im bestehenden Limit.
* Keine Accelerate-Frames nach Terminal-Brake-Commit.
* Keine Main-Throttle-Ausgabe während reiner Flip-Phase.

---

### 4. Statusmodell entkoppeln

**Änderung:** Nicht nur Stringlabels ändern. Ein kleines Statusmodell einführen:

```text
DeviationKind:
  None
  SoftTracking
  HardInvalidation
  AbortRequired

ActionKind:
  None
  Correcting
  Holding
  PlanInvalidated
  PlanReplaced
  Aborted
```

Dann UI-Label daraus ableiten:

* Soft tracking: `Tracking correction`
* DFT latch wait: `Aligning` oder `Waiting for brake latch`
* Plan noch gültig, aber Fehler beobachtet: `Correcting`
* Harte Invalidation: `Plan invalidated: reason`
* Tatsächliche Revision geändert: `Replanned: reason`
* Abort: `Abort: reason`

Die Stellen, die aktuell pauschal `Replan:` erzeugen, sind:

* `PrototypeFlightPlanTracker.Track()`: `PrototypeFlightPlan.cs:1471-1474`
* `PrototypeFlightPlanDivergenceMonitor.Evaluate()`: `PrototypeFlightPlan.cs:1774-1788`
* `SetFlightPlanDivergenceReport()`: `PrototypeWaypointAutopilot.cs:1294-1330`

**Akzeptanztests:**

* DFT soft correction erzeugt nie ein `Replan:`-Label.
* `Replan:` oder `Replanned:` erscheint nur, wenn Revision/PlanId tatsächlich wechselt oder ein Hard-Invalidation-Pfad bestätigt wurde.
* Status-Hold von 2 Sekunden zeigt keine veraltete Replan-Meldung nach Soft-Korrektur.

---

### 5. DFT-Physikannahmen prüfen, aber nicht als ersten Fix behandeln

**Änderung:** Verifizieren, ob `brakeAcceleration = burnAcceleration` im DFT-Solver korrekt ist: `PrototypeTrajectoryPlanner.cs:708-710`.

Wenn RetrogradeBurn physisch ein gedrehter Forward-Main-Burn ist, ist das wahrscheinlich korrekt. Wenn die reale Brake-Autorität den Reverse-Thrust-Multiplier nutzt, ist der DFT-Plan systematisch falsch. Der Vergleichspunkt ist `GetMaxDeceleration()`: `PrototypeWaypointAutopilot.cs:4732-4736`.

**Akzeptanztest:**

* Ein EditMode-Test vergleicht Planner-Bremsbeschleunigung mit der tatsächlich vom Autopilot verwendeten Main-Brake-Autorität für DFT.

---

## Testplan

### Muss nach dem nächsten Product-Code-Fix grün sein

* `PlayMode_DirectFastTransfer_NoNominalReplanDuringFullBurn`
* `PlayMode_DirectFastTransfer_MainThrottleContinuousDuringBurn`
* `PlayMode_DirectFastTransfer_MainThrottleContinuousDuringBrakeAfterLatch`
* `PlayMode_DirectFastTransfer_BurnToBrakeTransition_DoesNotPulseMainThrottle`
* `PlayMode_DirectFastTransfer_SoftTrackingDuringBurnDoesNotClearActuatorOutput`
* `PlayMode_DirectFastTransfer_SoftTrackingDuringBrakeDoesNotClearActuatorOutput`
* `PlayMode_DirectFastTransfer_ConsecutiveSoftTrackingCorrectionsDoNotReplan`
* `PlayMode_DirectFastTransfer_StartRotation90deg_NoReplanFlap`
* `PlayMode_DirectFastTransfer_StartRotation135deg_NoReplanFlap`
* `PlayMode_DirectFastTransfer_InitialAngularVelocity_DelaysLatchWithoutThrottlePulse`

### Die zwei roten Terminaltests müssen gezielt adressiert werden

* `PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`

  * Erwartung zusätzlich: niemals länger als N Frames in `Brake` / `FlipForBrake`, wenn `speed <= completionSpeed * X` und `distance > terminalCaptureRange`.
  * Erwartung zusätzlich: bei “slow but far” muss Brake-Commit gelöst oder Reacquire aktiviert werden.

* `PlayMode_Autopilot_TerminalBrakeCommit_PredictsDecelWithoutSpinOrFlap`

  * Erwartung zusätzlich: Terminal-Brake-Direction darf nach Commit nicht permanent kleinen Velocity-Änderungen folgen.
  * Erwartung zusätzlich: Richtungslatch/Handoff wird explizit getraced.

### Neue Tests, die ich konkret hinzufügen würde

1. **DFT strict plan blocks legacy brake hijack**

   Setup: aktives DFT-ProgradeBurn oder AlignForBurn, `arrivalBrakeCommitted=true` künstlich gesetzt.
   Erwartung: kein Aufruf/kein Effekt von Legacy `ApplyBrakeRequest()`, Plansegment bleibt Owner.

2. **DFT brake end outside capture enters reacquire, not replan**

   Setup: DFT-Brake endet mit niedriger Geschwindigkeit, aber Distanz deutlich größer als ArrivalRadius.
   Erwartung: Status `Reacquire` oder definierter Terminal-Capture-Pfad, keine Revision, kein `Replan:`.

3. **Soft correction label is not replan**

   Setup: DFT Burn/Brake mit `PositionDivergence | VelocityDivergence | AttitudeDivergence | TrackingDiverged`.
   Erwartung: `Tracking correction`, `requiresReplan=false`, keine PlanId-/Revision-Änderung.

4. **Hard invalidation label is explicit**

   Setup: Target bewegt sich oder InvalidPlanDirection hart verletzt.
   Erwartung: `Plan invalidated` und erst bei tatsächlicher Neubildung `Replanned`.

5. **Terminal brake direction latch**

   Setup: Terminal Brake mit lateral velocity, danach RCS-Korrektur.
   Erwartung: integrierte Rotation unter Limit, Richtung ändert sich nur oberhalb definierter Hysterese.

---

## Nicht tun

* **Nicht einfach Toleranzen aufblasen.** Das versteckt Drift und macht “slow but far” zu einem stillen Fehlschlag.

* **Nicht nur das Wort `Replan` im UI unterdrücken.** Wenn Status und echte Plan-Ersetzung nicht getrennt werden, wird Debugging schlechter.

* **Nicht noch mehr Latches überall hinzufügen.** Burn/Brake-Latches haben das alte Pulsing eingegrenzt. Das aktuelle Problem ist State Ownership und Terminal-Handoff.

* **Nicht DFT nominal in `RunAutopilotStep()` zurückfallen lassen.** Das reproduziert genau den Konflikt zwischen geplantem Executor und Legacy-State-Machine.

* **Nicht `arrivalBrakeCommitted` als globales Signal für Plan- und Legacy-Braking teilen.** Dieses Flag ist aktuell zu mächtig und zu unspezifisch.

* **Nicht `PlanExpired` als Erfolg behandeln.** Plan-Ende ist nur dann Erfolg, wenn das Schiff wirklich in der Capture-/Hold-Envelope ist.

* **Nicht fokussierte DFT-Tests als Beweis für Terminal-Korrektheit lesen.** Die aktuellen DFT-Tests beweisen: kein nominales Replan/Pulsing in den abgedeckten Segmenten. Sie beweisen nicht: robuste Arrival-Capture nach Brake.

* **Nicht Product-Fixes in Test-Hardening-Commits verstecken.** Der neueste Commit ist test-only. Der nächste Schritt muss bewusst Product-Code ändern und genau die Ownership-/Terminal-Verträge absichern.
