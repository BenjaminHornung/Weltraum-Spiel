# Design: Navigation Planner UI Overhaul

Stand: 2026-06-12. Zeilennummern = Commit `a68333b`. Screenshots des Ist-Zustands: Haupt-HUD (Nav-Kontext unten rechts, Minimap oben rechts, Top-Strip) und Navigation-Planner-Fenster.

## 1. Befund im Detail

### 1.1 Planner-Body ist Entwickler-Telemetrie

`BuildNavigationPlannerBody` (`PrototypePlayerHud.cs:5157`) konkateniert pro Frame einen 11-Zeilen-String. Quellen:

- `BuildNavigationPlanAuthorityLabel` (`:1447`) → "Authority: Flight plan emitted | executor pending | rev 122"
- `BuildNavigationPlanIdentityLabel` (`:1391`) → "Plan: trajectory--520--120-3000-Burn rev 122 | Preview=Executor pending | Exec pending | Samples 470"
- `BuildNavigationTrackingErrorLabel` (`:1409`) → "Track: pos 0.0m | cross 0.0m | vel 0.0m/s | sample 36"
- `BuildNavigationTrackingCommandLabel` (`:1428`) → "Cmd: accel 0.01m/s2 | main 0% | RCS 35.3N | dot 0.00"

Plan-IDs, Revisionen, Sample-Indizes, Tangenten-Dotprodukte sind reine Entwicklerdaten. Die eigenen Konzept-Docs verbieten genau das im Player-HUD (`docs/legacy-unity/ux/player-facing-ui-concept-v0.md` §3.2 "Nicht anzeigen: candidate scores, raw selectedCandidateReason, planned force vectors, internal segment table"; `docs/spielkonzept/navigation-computer.md` §16 listet die gewuenschten Spieler-Ausgaben).

### 1.2 Manoever als Textliste statt Timeline

`BuildNavigationManeuverRows` (`:1241`, `:1264`) erzeugt Zeilen wie `2 T+3.7s-6.6s Main burn | MAIN 100% | dV 34.3 | fuel 1.69kg`. Alle Daten fuer eine grafische Timeline existieren bereits pro `PrototypeManeuverSegment` (startTime, endTime, phase, commandMode, mainThrottle, expectedDeltaV, ExpectedFuelKg) plus Live-Fortschritt aus `CurrentFlightPlanExecutionState` (`activeSegmentIndex`, `activeProgress01`). Es fehlt nur die Darstellung.

### 1.3 Map nicht route-first, Guidelines nur teilweise umgesetzt

`CreateNavigationPlannerMapLayer` (`:4139`) rezykliert den Radar-Zeichenpfad (gleiche Pools `MaxRadarRouteSegments` etc., `:3635-3638`). `MaxNavigationPlannerMapBlips = 3` (`:2978`) existiert als Filter, aber: kein Framing auf Route+Schiff+Ziel (Schiff haengt am Kartenrand, vgl. Screenshot), keine Manoever-Marker (Burn-Start, Flip-Punkt, Brake-Start, Arrival-Radius), Route/Preview nur als zwei Farben ohne Legende im Fenster, Map-Label mischt vier Infos in eine Pipe-Zeile (`BuildNavigationPlannerMapLabel` `:5223`). `docs/player-hud-minimap-design-guidelines.md` fordert explizit: route-first, Layer-Prioritaet, fixe Icon-Groessen, Edge-Indikatoren, getrennte Compact-/Planner-Darstellung — Backlog dort ist offen.

### 1.4 Statuswidersprueche und Doppel-Quellen

- Top-Strip zeigt "HOLDING | No target" waehrend der Nav-Kontext "Nav Waypoint 3 ... Angekommen" zeigt (zwei verschiedene Statusquellen: vermutlich Momentum-Assist/Arena-Status vs. Autopilot-Snapshot — beim Umbau verifizieren und auf eine Quelle zusammenfuehren).
- "ETA nicht auf Kurs | Closing -57.8 m/s": Negative Closing-Speed mitten im Planner-Header, waehrend "Manoever: Direkt-Burn bereit" daneben steht. Konzept §5.4 (ui-concept-v0): ETA verbergen oder "nicht auf Kurs" sagen — aber dann nicht zusaetzlich rohe Zahlen dazu.
- Im Haupt-HUD sind "Route" und "Preview" volle Farbbalken ohne Map-Bezug (Legende ohne Bild) — verwirrend und nutzlos.
- "Burn 12.5s / avail 393.7s | Schedule 9.3s": drei Zeitangaben ohne erkennbare Bedeutung fuereinander.

### 1.5 Buttons ohne Zustaende und mit inkonsistenter Benennung

Haupt-HUD: `Prev/Next/Engage/Plan/Preview On`; Planner: `Prev/Next/Engage/Replan/Preview On/Close` (`:3053-3063`). "Plan" und "Replan" machen dasselbe (`ReplanNow()`). Es gibt keinen Engaged-Zustand (Engage muesste zu "Abort" werden), kein Busy/Planning-Feedback, keine Disabled-Tooltips (warum kann ich nicht engagen: kein Ziel? Fuel? Plan blocked?). Der parallel laufende UI-Review (anderer Agent) hat dasselbe fuer alle `CreateButton`-Stellen festgestellt — Button-State-Slice dort ist Grundlage fuer diesen Change.

### 1.6 Fehlender ΔV-/Fuel-Margin-Block

`navigation-computer.md` §11 verlangt: benoetigtes/verfuegbares ΔV, Fuel-Verbrauch, Reserve nach Ankunft, groesster Einzelburn, Bremsreserve. Daten existieren: `PrototypeFlightPlan.totalExpectedFuelKg`, `expectedRemainingFuelKg`, Segment-ΔV, `LastFuelEstimate` (required/available burn seconds). Angezeigt wird davon nur die kryptische Burn-Zeile.

### 1.7 Weapon Computer: keine Spieler-UI

`PrototypeWeaponComputerPanel.cs` ist komplett IMGUI (37 `OnGUI`/`GUILayout`-Stellen) und mischt Spielerdaten (Target, Health, AutoFire, Turret-Status) mit Tuning-Werten (HitChance, Recoil, Yaw/Pitch). Das Konzept-Doc §6 definiert bereits die Soll-Aufteilung Player vs. Debug — es fehlt nur das uGUI-Panel im Player-HUD (`CreateCombatComputerPanel` `:4197` existiert als Ansatz; pruefen was dort schon gerendert wird und auf Konzept §6 ausbauen).

### 1.8 Chase-Kamera bei Flips

`SimpleFollowCamera.UpdateAutopilotFlipAssistState` (`SimpleFollowCamera.cs:1139`) aktiviert den Flip-Assist nur bei `targetAutopilot.CurrentState == FlipForBrake` oder (`Brake` && Drehrate > 1.5 rad/s) (`:1163-1167`). Luecken:

- **Kill Momentum fehlt komplett**: `PrototypeMomentumAssist` (Zustaende AlignForBrake/MainBrake) wird in der Kamera nirgends referenziert — genau die vom Spieler beschriebenen "komischen Sachen" bei Kill Momentum.
- **Executor-Align fehlt**: Grosse Align-Drehungen des Flugplan-Executors (State `AlignForBurn`, z. B. 180° Richtungsumkehr beim Replan) triggern den Assist nicht.
- Referenzmodus `VelocityOrPrevious` (`:58`, Aufloesung `:1270-1280`): bei v≈0 (Ende von Kill Momentum, Hold) ist die Velocity-Referenz degeneriert.
- Der Assist ist zustandsbasiert statt ursachenbasiert: Jede neue Assist-Quelle muss einzeln verdrahtet werden.

## 2. Soll-Design

### 2.1 Neues Planner-Layout (uGUI, bestehender Renderer)

```
+--------------------------------------------------------------+
| Nav Waypoint 3        (2/3)      [● PLAN BEREIT]             |  Header: Ziel + Planstatus-Badge
| Dist 461 m   ETA 12s   Closing 57.8 m/s →                    |  Kennzahlen, eine Zeile, grosse Werte
| ΔV 68 / 393 m/s   Fuel nach Ankunft 78%   Bremsreserve OK    |  Margin-Block (gruen/gelb/rot)
+--------------------------------------------------------------+
| [Align|■■■■ Burn ■■■■|Flip|■■■ Brake ■■■|Final|Hold]   ▼9.3s |  Segment-Timeline, Breite ∝ Dauer,
|        ▲ Live-Marker bei Ausfuehrung                          |  Phasenfarben, Hover/Detail je Segment
+--------------------------------------------------------------+
|                    [ MAP route-first ]                        |  Schiff + Ziel + Route im Frame,
|   ◆ Schiff → ━━━ Burn ━━━ ⟳Flip ─── Brake ─── ◎ Ziel        |  Manoever-Marker auf der Route
|                              Range: Auto | 2.5 km   [-][A][+] |
+--------------------------------------------------------------+
| [◀][▶]  [ ENGAGE ]  [ NEU PLANEN ]  [Preview ✓]  [Details ▸] |  Buttons mit Zustaenden
+--------------------------------------------------------------+
```

Kernregeln:

1. **Planstatus-Badge** aus einer einzigen Quelle, gemappt auf die Zustandsmaschine aus navigation-computer.md §17: `Kein Ziel / Plane... / Plan bereit / Ausfuehrung / Ueberwache / Neuplanung / Angekommen / Abgebrochen / Nicht moeglich (Grund)`. Der Top-Strip des Haupt-HUDs konsumiert dieselbe Quelle (behebt "HOLDING | No target" vs "Angekommen").
2. **Kennzahlen mit Semantik:** Closing-Speed mit Richtungspfeil (auf Ziel zu / vom Ziel weg) statt Vorzeichen; ETA `--` wenn nicht finit; Stop-Distanz nur bei Annaeherung.
3. **Margin-Block** (navigation-computer.md §11): ΔV benoetigt/verfuegbar als Balken, Fuel nach Ankunft in %, Bremsreserve als Ampel. Quelle: `CurrentFlightPlan.totalExpectedFuelKg/expectedRemainingFuelKg`, Segment-ΔV-Summe, `LastFuelEstimate`.
4. **Segment-Timeline** als neues Widget (eigene `MaskableGraphic` analog zu vorhandenen Radar-Pools): horizontale Leiste, Segmentbreite ∝ `durationSeconds` (Mindestbreite fuer kurze Segmente), Phasenfarben aus `PrototypeUiStyle`-Token (Align=neutral, Burn=blau, Flip=gelb, Brake=orange, Final/Hold=gruen), Live-Marker aus `FlightPlanExecutorElapsedSeconds/totalDurationSeconds`, aktives Segment hervorgehoben. Unter der Leiste eine Zeile fuer das aktive/ausgewaehlte Segment: "Hauptburn — 100% Schub, 2.9s, ΔV 34.3 m/s".
5. **Map route-first** gemaess Guidelines: Framing umstellen von ship-zentriert auf "fit route + ship + target" (mit Mindest-/Maximalzoom, Range-Override durch Spieler bleibt); Manoever-Marker (Burn-Start, Flip, Brake-Start) aus den Segment-Erwartungspositionen (`expectedStartPosition`); Ziel mit Arrival-Radius-Ring; Blips weiterhin auf `MaxNavigationPlannerMapBlips` gefiltert; Edge-Indikator fuer Off-Range-Ziel. Route vs. Preview vs. Avoidance: drei klar unterscheidbare Stile (durchgezogen/gestrichelt-Ersatz via Segmentluecken/duenner) + Mini-Legende im Fenster statt Farbbalken im Haupt-HUD.
6. **Buttons:** `Plan`/`Replan` vereinheitlichen zu **"Neu planen"** (eine Aktion, ein Name, beide Orte); `Engage` wird Toggle mit Zustaenden `Engage → Abbrechen (engaged)`, disabled mit Grund-Tooltip/Untertext ("Kein Ziel", "Treibstoff reicht nicht", "Plan blockiert"); Busy-Zustand "Plane..." waehrend `ReplanNow` (Planung ist synchron schnell, trotzdem 1-Frame-Feedback + falls spaeter async: Spinner-Pfad vorsehen).
7. **Details-Bereich (einklappbar, default zu):** Hier duerfen Authority/PlanId/rev/Track/Cmd/Samples weiterleben. In Basic-Preset eingeklappt, in Debug-Presets (`PrototypeUiLayoutManager`) default offen. Kein Loeschen der Diagnose — nur Verlagerung.

### 2.2 Haupt-HUD Nav-Kontext (unten rechts)

- 3 Zeilen statt 5: `Ziel + Status-Badge`, `Dist | ETA | Closing→`, Mini-Timeline (gleiche Komponente wie Planner, nur ohne Labels). Manoever-Intent ("Direkt-Burn bereit") wird vom Status-Badge abgedeckt.
- "Route"/"Preview"-Farbbalken (Screenshot) ersatzlos streichen; die Mini-Timeline + Radar-Route uebernehmen das.
- Buttons hier auf `Prev/Next/Engage` reduzieren; "Neu planen" + Preview nur im Planner-Fenster (weniger Doppel-Steuerung).

### 2.3 Minimap/Radar (oben rechts)

Umsetzung des offenen Backlogs aus `docs/player-hud-minimap-design-guidelines.md`:

1. Range-Modi `Auto/250m/1km/2.5km/5km` mit sichtbarem Label (Buttons `-/A/+` existieren schon, aber aus der Map-Flaeche heraus unter die Map verschieben, Mindestgroesse 24px).
2. Prioritaetsfilter: ausgewaehltes Ziel + Route + Gefahren immer; generische Kontakte gecappt/gefadet ("37 contacts" ist zu viel fuer 2.5 km Range).
3. Heading-Anzeige: Schiffsymbol mit Richtungskeil statt Punkt; Norden/Referenz konsistent zwischen Radar und Planner-Map.
4. Edge-Indikator fuer das selektierte Ziel ausserhalb der Range.

### 2.4 Weapon-Computer-Panel (uGUI, neu)

Nach `player-facing-ui-concept-v0.md` §6 (Daten alle vorhanden):

- Header: aktives Ziel + Health-Balken (`PrototypeWeaponComputer.ActiveTarget`, Target-Health).
- Statuszeile: `Bereit / Ausrichten / Ausserhalb Feuerwinkel / Ausser Reichweite / Cooldown x.xs / Waffe offline` (Mapping von `TurretStatusLabel`/`PrototypeTurretFireStatus`).
- AutoFire-Chip: `AUTO: Armed / Waiting (Grund) / No target`; Priority-Mode-Auswahl (ManualOrder/Nearest/HighestHealth/LowestHealth) als Segmented Buttons.
- Zielliste (gecappt, sortiert nach Priority-Mode) mit Range.
- Tuning/Recoil/HitChance bleiben im IMGUI-`PrototypeWeaponComputerPanel` (Debug-Preset).
- Einbau in den bestehenden Kontext-Mechanismus (`CreateCombatComputerPanel` `PrototypePlayerHud.cs:4197` pruefen/ausbauen): Combat-Kontext ersetzt Nav-Kontext, wenn ein Weapon-Target selektiert ist (Konzept §3.3, "nur ein Kontext gleichzeitig").

### 2.5 Manoever-Kameramodus (SimpleFollowCamera)

Vom zustandsbasierten Autopilot-Sonderfall zum **ursachenbasierten Manoever-Modus**:

1. Neue Triggerquelle: ein gemeinsames Signal "assistgesteuerte Drehung aktiv" statt Einzelabfragen. Implementierung: Interface/Flag am Schiff (z. B. `PlayerShipController` exponiert `IsAssistRotationActive` + `AssistRotationReferenceDirection`), gespeist von (a) Autopilot-States `FlipForBrake`, `AlignForBurn` bei Soll-Ist-Winkel > 60°, `Brake` mit hoher Drehrate (heutige Logik), (b) `PrototypeMomentumAssist` States `AlignForBrake`/`MainBrake`, (c) kuenftigen Assists automatisch ueber dasselbe Flag. Kamera fragt nur noch dieses Signal ab (`UpdateAutopilotFlipAssistState` `SimpleFollowCamera.cs:1139` verallgemeinern, `targetAutopilot`-Spezialcode reduzieren).
2. Referenzrichtung robust machen: Prioritaet `AssistRotationReferenceDirection` (vom Assist geliefert, z. B. Bremsrichtung) → Velocity (nur wenn |v| > Schwellwert `autopilotFlipReferenceSpeedThreshold` `:49`) → letzte stabile Kameravorwaertsrichtung. Nie auf degenerierte Velocity bei v≈0 referenzieren (Kill-Momentum-Endphase).
3. Verhalten im Modus: Kamera haelt weltstabile Framing-Richtung (kein Mitdrehen mit dem Rumpf), Schiff bleibt im Frame; nach Abschluss (Winkel klein + Drehrate klein + Release-Delay `:53`) weiches Re-Lock auf neue Bugrichtung. Bestehende Blend-Parameter (`:50-52`) wiederverwenden.
4. Hysterese gegen Flattern: Eintritt sofort, Austritt erst nach `autopilotFlipAssistReleaseDelay` UND Drehrate < Schwelle — heutige Logik beibehalten, aber pro Quelle (Replan-Flip-Ketten duerfen den Modus nicht im 0,5s-Takt togglen; solange `fix-autopilot-plan-execution-fidelity-v1` nicht umgesetzt ist, ist das der Haupt-Stressfall).

### 2.6 Daten-/Architekturpfad

Bestehendes Muster beibehalten (Snapshot → Translator → Renderer, vgl. ui-concept-v0 §9.2):

- `PrototypePlayerNavigationSnapshot` erweitern: `PlanStateBadge` (enum + Text + Severity), `DeltaVRequired/Available`, `FuelAfterArrivalFraction`, `BrakeReserveOk`, `TimelineSegments[]` (Start/Dauer/Phase/Throttle/ΔV/Label), `TimelineProgress01`, `ActiveSegmentIndex`, `ManeuverMarkersWorld[]` (Positionen Burn/Flip/Brake), `ClosingTowardsTarget` (bool).
- Neue `PrototypePlayerCombatSnapshot` fuer das Weapon-Panel.
- Debug-Labels (`PlanIdentityLabel`, `TrackingErrorLabel`, `TrackingCommandLabel`, `PlanAuthorityLabel`) bleiben im Snapshot, werden aber nur im Details-Bereich/Debug-Preset gerendert.
- Alle neuen Texte durch den Uebersetzungs-/Severity-Layer (deutsche Spieler-Labels gemaess Tabellen in ui-concept-v0 §5.2).

### 2.7 Abgrenzung zu den parallelen UI-Slices (anderer Agent)

Dessen Slice 1 (Typografie/Severity-Token in `PrototypeUiStyle`) und Slice 2 (Button-States in zentraler `CreateButton`) sind **Voraussetzung** und werden hier konsumiert, nicht dupliziert. Slice 3 (IMGUI→uGUI FlightHud/Minimap-Migration) ueberschneidet sich mit 2.3 — Koordination: 2.3 arbeitet nur am bestehenden uGUI-Radar; die IMGUI-Minimap bleibt unberuehrt Developer-Layer. Slice 4 (Panel-Fades) gilt auch fuer das Planner-Fenster.

## 3. Reihenfolge

1. Snapshot-/Translator-Erweiterung + Statusquelle vereinheitlichen (behebt Widersprueche sofort, reiner Datenlayer, gut testbar).
2. Planner-Fenster-Umbau (Header/Kennzahlen/Margin/Details-Collapse) — noch ohne Timeline-Widget.
3. Segment-Timeline-Widget (Planner gross, HUD-Mini-Variante).
4. Planner-Map route-first + Manoever-Marker; Radar-Backlog.
5. Buttons/Zustaende (nach Slice-2-Grundlage), Haupt-HUD-Kontext verschlanken.
6. Weapon-Computer-uGUI-Panel.
7. Manoever-Kameramodus.

## 4. Verifikation

- EditMode: Snapshot-Mapping (Badge aus Autopilot-States, Margin-Berechnung, Timeline-Segmente aus FlightPlan, Closing-Richtung), Combat-Snapshot-Mapping, Kamera-Triggerlogik (Momentum + Autopilot + Degenerate-Velocity-Fallback) als reine Logiktests.
- PlayMode: bestehende HUD-Layout-/Overlap-Tests erweitern (Planner bei 1280x720, 1024x768, 2560x1080, schmales Hochformat — Matrix aus `player-hud-minimap-design-guidelines.md` §8); Kamera-Smoke: Kill Momentum aus 50 m/s → kein Kamerasprung > X°/Frame, Schiff bleibt im Viewport (ViewportSafety-Diagnose `SimpleFollowCamera.cs:359` existiert bereits als Messpunkt).
- Screenshot-Evidence unter `tests/screenshots/` fuer: kein Ziel, Plan bereit, Ausfuehrung mit Live-Marker, Replan-Fall, Combat-Kontext, jede Aufloesung.

## 5. Risiken

- `PrototypePlayerHud.cs` ist mit ~8000 Zeilen schon ueberladen; neue Widgets (Timeline, Margin-Gauges, Combat-Panel) als eigene Dateien/Komponenten anlegen, nicht weiter in die Monolith-Datei.
- Solange der Autopilot-Fix nicht gelandet ist, zeigt auch die beste UI staendig "Neuplanung" — Erwartung beim Testen entsprechend setzen; UI-Abnahme-Screenshots idealerweise nach dem Autopilot-Fix wiederholen.
- HUD-Find-by-Name-Bindung (`FindHudComponent`, `:3627ff`) ist fragil; neue Elemente brauchen Namen + Bindungs-Checks in `HasCompleteHudBindings` (`:3752`), sonst schlaegt der Rebind nach Bootstrap still fehl.
