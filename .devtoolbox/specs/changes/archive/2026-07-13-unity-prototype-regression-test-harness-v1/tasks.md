# Tasks: Prototype Regression Test Harness

Referenz: `design.md`. Reihenfolge beachten: Phase 4 (Monolith-Split) muss vor der Test-Anpassung aus `fix-autopilot-plan-execution-fidelity-v1` Phase 6 passieren.

## Phase 1 — Runner & Doku
- [ ] `tools/run-tests.ps1`: Unity-Pfad-Ermittlung (Library/EditorInstance.json, Fallback Hub-Pfad, Fehlermeldung), Lockfile-Check, `-runTests` fuer EditMode+PlayMode mit `-testCategory`, XML nach `artifacts/test-results/`, Summary + Exit-Code; Quarantine-Failures gesondert.
- [ ] `.gitignore`: `artifacts/` ergaenzen.
- [ ] `verify.json`: `dotnet test`-Schritt ehrlich machen (entfernen oder als Compile-Gate umbenennen); Entscheidung Smoke-Aufruf im Verify anhand realer Laufzeit dokumentieren.
- [ ] `docs/testing.md` anlegen (Suiten, Budgets, Aufrufe, Regeln, How-To neues Szenario).

## Phase 2 — Support-Layer
- [ ] `PrototypeTestEnvironmentConfig` (GravityMode None/CentralBody, Atmosphere, FloatingOriginActive, Obstacles, FixedDeltaTime) + Anwendung in `PrototypeScenarioBuilder` (Assets/Tests/Support/PrototypeScenarioBuilder.cs).
- [ ] `PrototypeTestScenarioCatalog` mit den Smoke-Szenarien aus design.md §2.2 (IDs stabil halten).
- [ ] `PrototypeInvariantAssertions` (Arrived, NoForcedReplans, SingleFlip, Finite, FuelBudget, NoConsoleErrors) mit sprechenden Fehlermeldungen.
- [ ] `PrototypeHarnessTestBase`: Console-Error-Watchdog, Settings-Restore-Check, Leak-Check, statische Registries leeren, `WaitUntilOrFail`-Helper.
- [ ] Produktions-Hooks (minimal): `ForcedReplanCount`/`FlipCount` o. ae. Zaehler am Autopilot, falls fuer Invarianten noetig (nur Zaehler, keine Logik).

## Phase 3 — Kategorisierung
- [ ] Alle bestehenden Editor-Tests mit `[Category("Regression")]` (schnelle Kandidaten zusaetzlich `Smoke`) versehen; Performance-/Evidence-Tests entsprechend.
- [ ] Meta-Test: jede `[Test]`/`[UnityTest]`-Methode in den Test-Assemblies hat genau eine Haupt-Kategorie (Reflection).
- [ ] `Quarantine`-Kategorie einfuehren; aktuell bekannte Flakies (falls vorhanden) eintragen mit Ablaufdatum-Kommentar.

## Phase 4 — PlayMode-Monolith-Split
- [ ] `PrototypeAutopilotNavigationPlayModeTests.cs` (167 KB) entlang Szenario-Katalog in Dateien pro Gruppe splitten; reine Umzugs-Phase, keine Assert-Aenderung.
- [ ] Evidence-Erzeugung (CSV/Screenshots) von Asserts trennen: gleiche Szenarien, getrennte `Evidence`-Tests.
- [ ] Neue Smoke-PlayMode-Szenarien implementieren: `autopilot-direct-3km`, `killmomentum-50ms`, `bootstrap-playerhud`, `blueprint-spawn-fly` (Rest aus Katalog in Regression).

## Phase 5 — Zukunftssicherungs-Szenarien
- [ ] `floating-origin-shift-during-autopilot`-Szenario (Shift mitten im Transfer, Invariante: Ankunft).
- [ ] Telemetrie/Asserts auf relative Koordinaten pruefen/umstellen (keine absoluten Weltpositionen in Smoke/Regression).
- [ ] `[TestCaseSource]`-Parametrisierung der Smoke-Szenarien ueber GravityMode vorbereiten (heute nur `None` aktiv; `CentralBody` als skipped/ignored Platzhalter mit TODO-Verweis auf Gravitations-Feature).

## Phase 6 — Abnahme
- [ ] `tools/run-tests.ps1 -Suite Smoke` laeuft gruen in Budget (< ~5 min inkl. Unity-Start); Protokoll + Summary als Evidence unter `tests/` dieses Changes.
- [ ] `-Suite Regression` laeuft gruen; Laufzeit dokumentieren.
- [ ] Negativprobe: absichtlicher Bruch (z. B. Autopilot-Konstante verstellen) laesst Smoke rot werden; Evidence festhalten.
