# Proposal: Quick Wins & latente Bugs (Sweep 2026-06)

## Problem

Ein gezielter Code-Sweep (Hot-Paths, Unity-Fallen, Copy-Paste-Muster, Per-Frame-Scans) hat eine Reihe kleiner, bisher unauffaelliger Probleme gefunden: latente Bugs, die erst bei kuenftigen Aenderungen zuschlagen (Fixed-Timestep-Wechsel, Floating-Origin-Aktivierung), sowie unnoetige Per-Frame-Kosten im Player-HUD und Autopilot. Jedes Einzelitem ist klein (Minuten bis wenige Stunden), zusammen ergeben sie ein sinnvolles Batch-Change.

Wichtigste Funde (Details mit Datei:Zeile in `design.md`):

1. **Fixed-Timestep-Annahme im Autopilot:** 8x `Mathf.Max(Time.fixedDeltaTime, 0.02f)` — alle Autopilot-/Flugplan-Uhren laufen falsch (zu schnell), sobald jemand den Physik-Timestep unter 0,02 s stellt (z. B. 120-Hz-Physik). Tickende Zeitbombe fuer Performance-Tuning.
2. **Toter Code-Zweig im Planner:** `BuildSegments` gibt fuer Avoidance- und Normalfall exakt dasselbe Array zurueck (identische Ternary-Zweige) — entweder Bug (Avoidance sollte anders sein) oder toter Code.
3. **`Resources.Load` pro Frame** im Player-HUD, wenn kein CelestialBodyCatalog gefunden wird.
4. **Kein Origin-Shift-Signal:** `FloatingOriginManager` verschiebt nur registrierte Bodies. Autopilot-Flugplaene, Avoidance-Waypoints und HUD-Routen speichern absolute Weltpositionen — beim ersten echten Origin-Shift waehrend eines Autopilot-Flugs divergiert alles sofort. Blocker fuer die Real-Scale-World-Roadmap.
5. **Szenen-Scan pro Frame im HUD-Radar:** `FindObjectsByType<PrototypeNavigationTarget>` jeden Frame, mit `Resources.FindObjectsOfTypeAll`-Fallback (sehr teuer).
6. **HUD baut jeden Frame alles neu:** kompletter Snapshot inkl. aller Panel-Strings/TMP-Zuweisungen in `Update()`; die vorhandene Drossel-Klasse `PrototypeUiSampleGate` wird nur im Debug-Overlay genutzt, nicht im Player-HUD.
7. **GetComponent im Hot-Path:** Autopilot holt `RcsThrusterController`/`MainThrusterBank` mehrfach pro FixedUpdate per `GetComponent` statt zu cachen.
8. **Repo-Hygiene:** Unity-Recovery-Szene `Assets/_Recovery/0 (4).unity` liegt im Assets-Ordner (wird importiert), `.idea/` und `UpgradeLog.htm` sind untracked statt ignoriert.

## Outcome

- Beide Zeit-/Origin-Zeitbomben entschaerft, bevor Performance-Tuning bzw. Real-Scale-World sie ausloesen.
- Spuerbar weniger Per-Frame-Arbeit im HUD (Snapshot ~10 Hz, Marker weiterhin pro Frame) und keine Szenen-Scans/Resources-Loads pro Frame mehr; kurzer Vorher/Nachher-Profiler-Beleg.
- Toter/duplizierter Code entfernt oder als echter Bug gefixt (mit Test).
- Saubere Arbeitskopie (.gitignore, Recovery-Artefakte raus aus Assets).

## Scope

- `PrototypeWaypointAutopilot.cs` (Tick-Konstante, Component-Caching), `PrototypeTrajectoryPlanner.cs` (BuildSegments), `PrototypePlayerHud.cs` (SampleGate, Radar-Quellen, Resources.Load), `FloatingOriginManager.cs` (+Abonnenten), `.gitignore`, Loeschung der Recovery-Dateien.
- Pro Item ein fokussierter Commit; EditMode-Tests wo sinnvoll.

## Non-Goals

- Keine Ueberschneidung mit den grossen Specs: Autopilot-Logik (`fix-autopilot-plan-execution-fidelity-v1`), Planner-UI-Redesign (`player-navigation-planner-ui-overhaul-v1`) und Harness (`prototype-regression-test-harness-v1`) bleiben unberuehrt; dieses Change macht nur punktuelle Fixes. **Koordination:** Items am Autopilot/Planner vor oder zusammen mit dem Fidelity-Fix landen (gleiche Dateien, Merge-Konflikte vermeiden).
- Kein allgemeines Performance-Projekt (dafuer existieren die performance-* Specs); nur die hier konkret belegten Per-Frame-Kosten.
