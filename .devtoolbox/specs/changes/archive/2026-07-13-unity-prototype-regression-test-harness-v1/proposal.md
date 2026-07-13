# Proposal: Prototype Regression Test Harness

## Problem

Das Projekt hat bereits viele Tests (28 EditMode-Validation-Dateien, 7 PlayMode-Dateien, ein Support-Layer mit `PrototypeScenarioBuilder`, `HeadlessSimulationRunner`, Drivers und Snapshots), aber keinen **Harness**: keine wiederholbare, schnelle, abgestufte Suite, die vor/nach jeder Aenderung gleich laeuft und Kernverhalten schuetzt. Konsequenzen, sichtbar in der Git-Historie:

1. Features wie der Autopilot regredieren wiederholt (`#FIX-DIRECT-FAST-TRANSFER-*`, `#FIX-AUTHORITATIVE-FLIGHTPLAN-TRACKING`, Bootstrap-Kontamination), weil es keinen verbindlichen Smoke-Gate gibt.
2. PlayMode-Tests sind monolithische Evidence-Laeufe (`PrototypeAutopilotNavigationPlayModeTests.cs` = 167 KB) statt kleiner, benannter Szenarien; niemand laesst sie "mal eben" laufen.
3. `verify.json` prueft nur `dotnet build` + `dotnet test` auf der Solution — das ist ein Compile-Gate; Unity-abhaengige Tests (alles mit GameObjects/Physik) laufen dort nicht zuverlaessig. Es entsteht falsche Sicherheit.
4. Tests kodieren teils aktuelles (fehlerhaftes) Verhalten statt Invarianten — beim Autopilot-Fix muessen Tests bewusst umgebaut werden; ein Harness mit Invarianten-Asserts haette das verhindert.
5. Kommende Systeme (Planeten-Gravitation, Orbital-Simulation, Floating Origin/Large World, Timewarp, Drohnen) wuerden heutige Tests brechen, weil Umgebung (Gravitation aus, Welt-Ursprung, absolute Positionen) implizit hart kodiert ist.

## Outcome

- **Eine Kommandozeile, ein Ergebnis:** `tools/run-tests.ps1 -Suite Smoke|Regression|Evidence` startet Unity headless (batchmode `-runTests`), schreibt NUnit-XML + Kurz-Summary nach `artifacts/test-results/`, Exit-Code != 0 bei Fehlern. Identisch fuer Mensch, Agent und spaeter CI.
- **Tiering:** `Smoke` (< ~3 min, nach jeder Aenderung), `Regression` (vor Merge), `Evidence`/`Performance` (auf Anforderung, erzeugt Artefakte). Umsetzung ueber NUnit-`[Category]`.
- **Szenario-Katalog:** benannte, deklarative Szenarien (Schiff + Umgebung + Startzustand + Erfolgskriterien) auf Basis des bestehenden `PrototypeScenarioBuilder`, die von allen Suiten wiederverwendet werden. Die Umgebung ist explizit konfigurierbar (Gravitation, Atmosphaere, Floating Origin, Obstacles), damit z. B. Planeten-Gravitation spaeter ein **neuer Szenario-Parameter** ist statt ein Suite-Bruch.
- **Invarianten statt goldener Trajektorien:** Asserts pruefen Eigenschaften, die Physikaenderungen ueberleben (Ankunft im Radius, Replan-Zaehler, Flip-Zaehler, kein NaN, keine Console-Errors, Fuel-Budget ±Toleranz), nicht exakte Positionen.
- Kernverhalten ist als Smoke-Szenarien abgedeckt: Autopilot-Direkttransfer, Autopilot-Avoidance, Kill Momentum, Flight-Control-Modi, Bootstrap/HUD-Aufbau, Turret/Weapon-Computer, Docking Soft Capture, Blueprint→Variant→Spawn.

## Scope

- Neues `tools/run-tests.ps1` + Doku `docs/testing.md` (wie ausfuehren: CLI, Editor-Testrunner, Unity-MCP).
- `Assets/Tests/Support`: Szenario-Katalog (`PrototypeTestScenarioCatalog`), Umgebungs-Config (`PrototypeTestEnvironmentConfig`), Invarianten-Asserts, Console-Error-Watchdog, Leak-/Settings-Restore-Guards.
- Kategorisierung aller bestehenden Tests; Aufbrechen des PlayMode-Monolithen entlang der Szenarien.
- `verify.json` ehrlich machen (Compile-Gate) und um den dokumentierten Harness-Aufruf ergaenzen.

## Non-Goals

- Keine CI-Infrastruktur (kein GitHub-Actions-Setup) — der Harness muss nur lokal/per Agent identisch laufen; CI kann ihn spaeter aufrufen.
- Kein Umschreiben aller Alt-Tests auf einmal; nur Kategorisierung + Monolith-Split + neue Szenarien. Alt-Tests bleiben gueltig.
- Keine Performance-Benchmark-Neuentwicklung (bestehende Performance-Evidence-Tests werden nur als `Performance` kategorisiert).
- Kein Determinismus-Anspruch ueber das hinaus, was Unity-PhysX hergibt (gleiche Maschine, gleiche Schrittweite); Asserts sind toleranzbasiert.
