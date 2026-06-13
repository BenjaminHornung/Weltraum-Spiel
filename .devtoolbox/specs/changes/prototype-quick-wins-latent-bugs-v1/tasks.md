# Tasks: Quick Wins & latente Bugs (Sweep 2026-06)

Referenz: `design.md` (Befunde mit Datei:Zeile, Stand Commit `a68333b`). Jedes Item = eigener fokussierter Commit. Items 1, 2, 7 VOR dem Autopilot-Fidelity-Fix landen (gleiche Dateien).

## Latente Bugs
- [x] **Item 1:** `AutopilotTickSeconds`-Getter einfuehren und alle 8 `Mathf.Max(Time.fixedDeltaTime, 0.02f)`-Stellen in `PrototypeWaypointAutopilot.cs` ersetzen (`:400`, `:946`, `:956`, `:1023`, `:2095`, `:2478`, `:2728`, +1 per Grep verifizieren). EditMode-Test fuer 0.01/0.02/0.04.
- [x] **Item 2:** Duplizierte Ternary in `PrototypeTrajectoryPlanner.BuildSegments` (`:985-987`) aufloesen; vorher Spec `add-autopilot-obstacle-avoidance-v1` gegenlesen, ob ein Avoidance-Unterschied beabsichtigt war; Avoidance-Tests muessen gruen bleiben.
- [x] **Item 3:** `Resources.Load`-Wiederholung in `PrototypePlayerHud.ResolveCelestialBodyCatalogReference` (`:3242`) mit Attempted-Flag stoppen.
- [x] **Item 4:** `FloatingOriginManager.OriginShifted`-Event (Ende von `ShiftOriginBy`, `FloatingOriginManager.cs:71`); Autopilot abonniert (OnEnable/OnDisable) und erzwingt Replan + korrigiert/verwirft `stableAvoidanceWaypoint`; HUD-Cache pruefen. EditMode-Tests fuer Event + Handler. PlayMode-Abdeckung via Harness-Szenario `floating-origin-shift-during-autopilot` (prototype-regression-test-harness-v1, Phase 5) — dort nicht doppeln.

## Performance
- [x] **Item 5:** HUD-Radar-Ziele aus `PrototypeWaypointManager` statt `FindObjectsByType` pro Frame (`PrototypePlayerHud.cs:1925`); `Resources.FindObjectsOfTypeAll`-Fallback (`:1928`) entfernen; Fallback-Scan nur ohne Manager, 1-Hz-Gate.
- [ ] **Item 6:** Snapshot-/Text-Refresh in `PrototypePlayerHud.Update` (`:3177`) per `PrototypeUiSampleGate` auf 10 Hz; Marker-/Blip-Positionen in leichten Pro-Frame-Pfad trennen; `SetTextIfChanged`-Helfer vor allen TMP-Zuweisungen; Force-Refresh bei Panel-Toggles/Bind.
- [x] **Item 7:** `RcsThrusterController`/`MainThrusterBank` im Autopilot cachen (`:4741`, `:5296`, `:5343`), Invalidierung bei Controller-Wechsel in `ResolveReferences()`.
- [ ] Profiler-Evidence vorher/nachher (1 min Flug, Planner offen) unter `tests/` ablegen.

## Housekeeping
- [x] **Item 8:** `Assets/_Recovery/` loeschen (Inhalt vorher kurz sichten); `.gitignore` ergaenzen: `.idea/`, `UpgradeLog.htm`, `Assets/_Recovery/`, `artifacts/`.
- [ ] **Item 9:** Find*-Audit-Tabelle aus design.md abarbeiten: Frequenz je Stelle pruefen, nur bestaetigte Pro-Frame-Faelle fixen, Ergebnis je Zeile dokumentieren.

## Abnahme
- [ ] EditMode-Suite gruen; PlayMode-Smoke gruen (falls Harness vorhanden: `tools/run-tests.ps1 -Suite Smoke`).
- [ ] Kurzprotokoll: pro Item 1-2 Saetze Ergebnis + Commit-Hash unter `tests/`.
