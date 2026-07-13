# Design: Quick Wins & latente Bugs (Sweep 2026-06)

Stand: 2026-06-12, Zeilennummern = Commit `a68333b`. Jedes Item ist unabhaengig umsetzbar; pro Item ein Commit. Bei Items 1, 2 und 7 Koordination mit `fix-autopilot-plan-execution-fidelity-v1` (gleiche Dateien): zuerst dieses Change, dann der Fidelity-Fix.

## Item 1 — Fixed-Timestep-Annahme im Autopilot (latenter Bug)

**Befund:** `Mathf.Max(Time.fixedDeltaTime, 0.02f)` kommt 8x in `PrototypeWaypointAutopilot.cs` vor (u. a. `FixedUpdate` `:400` fuer `autopilotElapsedSeconds`, Executor-Ticks `:946`, `:956`, `:1023`, Terminal-Lead `:2478`, Brake-End-Envelope `:2728`, `:2095`). Bei `Time.fixedDeltaTime = 0.01` (100-Hz-Physik) addiert jede FixedUpdate-Iteration 0,02 s → alle Uhren (Autopilot-Elapsed, Flugplan-Clock) laufen doppelt so schnell wie die Physik; Plaene "expiren" nach halber Realzeit.

**Fix:** Zentraler Getter `private static float AutopilotTickSeconds => Time.fixedDeltaTime > 0f ? Time.fixedDeltaTime : 0.02f;` — alle 8 Stellen ersetzen. Der 0.02-Fallback bleibt nur fuer den degenerierten Fall `fixedDeltaTime <= 0`.

**Test:** EditMode: Tick-Getter bei manipuliertem `Time.fixedDeltaTime` (0.01/0.02/0.04) — Erwartung: identisch mit fixedDeltaTime.

## Item 2 — Toter/duplizierter Avoidance-Zweig im Planner

**Befund:** `PrototypeTrajectoryPlanner.BuildSegments` (`:985-987`):

```csharp
return avoidance
    ? new[] { burnSegment, coast, brake, final, hold }
    : new[] { burnSegment, coast, brake, final, hold };
```

Beide Zweige identisch. Entweder sollte der Avoidance-Fall anders aussehen (der `burnSegment`-Typ unterscheidet sich bereits via `avoidance ? AvoidanceBurn : Burn` in `:972` — dann ist die Ternary schlicht tot), oder hier fehlt ein geplanter Unterschied (z. B. zusaetzliches Reacquire-Segment).

**Fix:** Git-Blame/Verhalten pruefen; nach aktuellem Code ist die Ternary toter Code → auf eine Zeile reduzieren. Falls beim Pruefen ein gewollter Unterschied auffaellt (Spec `add-autopilot-obstacle-avoidance-v1` gegenlesen), als echten Bug mit Test fixen.

**Test:** bestehende Avoidance-EditMode-Tests muessen gruen bleiben; kein neues Verhalten.

## Item 3 — `Resources.Load` pro Frame im Player-HUD

**Befund:** `PrototypePlayerHud.RefreshNow()` laeuft jeden Frame (`Update()` `:3177`) und ruft `ResolveCelestialBodyCatalogReference()` (`:3242-3250`); wenn kein Katalog gebunden ist, wird `Resources.Load<CelestialBodyCatalog>` **jeden Frame** ausgefuehrt.

**Fix:** `private bool celestialCatalogLoadAttempted;` — nach erstem Fehlversuch nicht erneut laden; Reset des Flags in `Bind(...)` (falls Katalog spaeter explizit gesetzt wird, greift der `!= null`-Fruehausstieg ohnehin).

## Item 4 — Origin-Shift-Signal fehlt (latenter Bug, Real-Scale-Blocker)

**Befund:** `FloatingOriginManager.ShiftOriginBy` (`FloatingOriginManager.cs:71`) verschiebt nur registrierte `FloatingOriginBody`s. Es gibt kein Event/Callback fuer andere Systeme (Grep `OnOriginShifted|FloatingOrigin` in `PrototypeWaypointAutopilot.cs`: 0 Treffer). Absolute Weltpositionen, die dadurch falsch werden: Flugplan-Segmente (`expectedStart/EndPosition`, `predictedSamples`), `targetPositionWorld`, `stableAvoidanceWaypoint`, HUD-Routen/`PredictedRoute`. Erster Shift waehrend eines Autopilot-Flugs → sofortige Positionsdivergenz bzw. falsche Routenanzeige.

**Fix (v0, bewusst einfach):**
1. `FloatingOriginManager`: `public event System.Action<Vector3> OriginShifted;` — Invoke am Ende von `ShiftOriginBy` mit dem lokalen Shift-Vektor.
2. `PrototypeWaypointAutopilot`: in `OnEnable/OnDisable` (de)abonnieren (Manager via vorhandener Aufloesung/`FindAnyObjectByType` einmalig); Handler: `forceNextFlightPlanRevision = true; MarkNavigationPlanDirty();` plus `stableAvoidanceWaypoint -= shift;` (oder Avoidance-Lock aufheben). Kein Versuch, den Plan zu verschieben — ehrlicher Replan ist fuer v0 korrekt und billig.
3. `PrototypePlayerHud`: Handler invalidiert den letzten Snapshot (naechster RefreshNow rechnet ohnehin neu — hier reicht ggf. nichts zu tun; pruefen, ob gecachte Routen-Arrays existieren).

**Test:** EditMode: Manager-Event feuert mit korrektem Vektor; Autopilot-Handler setzt Dirty/ForceRevision. PlayMode-Szenario `floating-origin-shift-during-autopilot` kommt aus dem Harness-Spec (Phase 5) — dort referenzieren, nicht doppelt bauen.

## Item 5 — Szenen-Scan pro Frame im HUD-Radar

**Befund:** `AddSceneNavigationRadarBlips` (`PrototypePlayerHud.cs:1920-1948`) ruft jeden Frame `FindObjectsByType<PrototypeNavigationTarget>` und bei leerem Ergebnis sogar `Resources.FindObjectsOfTypeAll` (scannt ALLE geladenen Objekte inkl. Assets).

**Fix:** Zielquelle wechseln: `PrototypeWaypointManager` haelt bereits die Zielliste (`RefreshFromScene`-Mechanik, `PrototypeWaypointManager.cs:72`). Radar-Blips aus `waypointManager.Targets` speisen; Fallback-Scan nur, wenn kein Manager gebunden ist, und dann ueber einen 1-Hz-Cache (`PrototypeUiSampleGate`). `Resources.FindObjectsOfTypeAll` komplett entfernen (Radar zeigt dann eben nichts — korrekt fuer leere Szene).

## Item 6 — HUD-Vollrefresh pro Frame drosseln

**Befund:** `RefreshNow()` in `Update()` (`:3177`) baut jeden Frame den kompletten Snapshot (inkl. aller Stringaufbereitung, z. B. `BuildNavigationPlannerBody`) und weist alle TMP-Texte zu. `PrototypeUiSampleGate` existiert (`PrototypeUiSampling.cs`), wird aber nur im `PrototypeDebugOverlay` (`:28-29`) genutzt.

**Fix:**
1. SampleGate (Intervall 0,1 s) um den Snapshot-/Text-Pfad in `Update()`; erzwungener Refresh (`force`) bei Sichtbarkeits-Toggles (F1/F5/F7-Handler rufen bereits `RefreshNow` indirekt — pruefen) und bei `Bind(...)`.
2. Positionskritisches (Marker, Reticle, Radar-Blip-Positionen, Zielindikatoren) in einen leichten Pro-Frame-Pfad trennen, der nur Transforms/anchoredPositions setzt — keine Strings.
3. Vor jeder TMP-Zuweisung: `if (!string.Equals(text.text, value, Ordinal)) text.text = value;` als Helfer `SetTextIfChanged` (TMP-Layout-Rebuilds sind der teure Teil).

**Beleg:** Profiler-Screenshot/Frame-Zeiten vorher/nachher (1 Minute Flug mit offenem Planner) unter `tests/` ablegen. Verhalten identisch bei 10 Hz Text — Werte aendern sich ohnehin langsam; Abweichungen (z. B. traege Countdown-Anzeigen) im Protokoll festhalten.

## Item 7 — GetComponent im Autopilot-Hot-Path cachen

**Befund:** `GetRcsTranslationForceScale()` (`PrototypeWaypointAutopilot.cs:4741`, `:5296`) und `CanUseMainThrottle`-Pfad (`:5343`) machen `shipController.GetComponent<RcsThrusterController>()` bzw. `<MainThrusterBank>` bei jedem Aufruf — und diese Getter laufen mehrfach pro FixedUpdate (Authority-Checks, Tracker-Settings, Fuel-Schaetzung).

**Fix:** Felder `cachedRcsThrusterController`/`cachedMainThrusterBank` in `ResolveReferences()` befuellen (inkl. Neuaufloesung, wenn sich `shipController` aendert — Vergleichsfeld merken). Getter nutzen nur den Cache.

**Test:** bestehende Autopilot-EditMode-Tests bleiben gruen; kein Verhaltenseffekt.

## Item 8 — Repo-Hygiene

**Befund:** `Assets/_Recovery/0 (4).unity` + `.meta` (Unity-Crash-Recovery-Artefakt) liegen untracked im Assets-Ordner und werden von Unity importiert; `.idea/`-Dateien und `UpgradeLog.htm` untracked im Repo-Root.

**Fix:** Recovery-Dateien loeschen (vorher kurz oeffnen/pruefen, dass nichts Gewolltes drinsteckt — es ist eine 0-benannte Recovery-Szene, sehr wahrscheinlich Muell); `.gitignore` ergaenzen: `.idea/`, `UpgradeLog.htm`, `Assets/_Recovery/`, `artifacts/` (letzteres deckt sich mit dem Harness-Spec — nur einmal eintragen).

## Item 9 — Audit der restlichen Find*-Aufrufe (Folgeliste, kein Blind-Fix)

Per-Frame-Verdacht nur dort fixen, wo er sich bestaetigt; Rest dokumentieren und schliessen:

| Stelle | Verdacht | Aktion |
| --- | --- | --- |
| `PrototypePlayerHud.cs:3455` (`FindObjectsByType<PlayerShipController>`) | nur in ResolveReferences? | Frequenz pruefen |
| `PrototypePlayerHud.cs:2107`, `:2956`, `:3392` (TestEnvironment/TargetDummy/ArenaLoop) | pro Snapshot-Build? | nach Item 6 ohnehin 10 Hz; pruefen ob zusaetzlich cachebar |
| `PrototypeFlightHud.cs:236`, `PrototypeMinimapOverlay.cs:150` | IMGUI-Debug-Layer | nur fixen, wenn pro OnGUI-Frame |
| `PrototypeWeaponTarget.cs:124-126` (3x FindObjectsByType) | Discovery | ist registry-versioniert gegated (`PrototypeWeaponComputer.Update` `:48`) — vermutlich ok, Debug-Fallback-Intervall pruefen |
| `PrototypeDockingApproachAssist.cs:380`, `PrototypeBootstrap.cs` div. | Einmal-/Setup-Pfade | nur dokumentieren |

## Abnahme

- Alle Items einzeln committet, EditMode-Suite gruen, PlayMode-Smoke (sofern Harness schon existiert: `-Suite Smoke`) gruen.
- Profiler-Vorher/Nachher fuer Items 5+6 als Evidence.
- Kein Verhaltensunterschied ausser den dokumentierten (HUD-Text 10 Hz; Origin-Shift erzwingt Replan).
