# Design: Prototype Regression Test Harness

Stand: 2026-06-12. Zeilen-/Dateiangaben = Commit `a68333b`.

## 1. Ist-Zustand

### 1.1 Vorhandene Bausteine (gut, wiederverwenden)

- `Assets/Tests/Support/PrototypeScenarioBuilder.cs`: baut Headless-Rigs (Ship mit Stats/PhysicsCore/Main/RCS/Controller, Autopilot-Rig, Combat-Rig, Targets, Obstacles) mit sauberem `Dispose()`-Tracking.
- `Assets/Tests/Support/HeadlessSimulationRunner.cs`: `Physics.simulationMode = Script` + `Physics.Simulate(dt)`-Stepping mit reflektierten `Update`/`FixedUpdate`-Ticks. Schnell, aber: Tick-Reihenfolge ist Registrier-Reihenfolge, nicht Unitys Player-Loop (`DefaultExecutionOrder(-200)` des Autopiloten wird ignoriert) — gut fuer Logik-Smokes, kein Ersatz fuer PlayMode.
- `Assets/Tests/Support/`: `ShipDriver`/`AutopilotDriver`/`CombatDriver`, `SimulationSnapshots` (Telemetrie), `SimulationAssertions`.
- `Assets/Tests/Editor/*ValidationTests.cs` (28 Dateien): schnelle NUnit-`[Test]`s, laufen im Editor (kein asmdef; Teil von Assembly-CSharp-Editor).
- `Assets/Tests/PlayMode/*` (7 Dateien): `[UnityTest]`-Coroutinen, echter Player-Loop; `PrototypeBootstrap.IsUnityTestRunnerContextActive()`/`IsUnityTestRunnerScene()` existieren bereits als Schutz gegen Bootstrap-Kontamination.
- Evidence-Konvention: Artefakte unter `.devtoolbox/specs/changes/<change>/tests/` (Screenshots, CSV, Protokolle).

### 1.2 Luecken

1. **Kein einheitlicher Runner.** PlayMode-Tests laufen nur via Editor-Testrunner/MCP; es gibt kein Skript, keinen Standard-Ausgabepfad, keine Exit-Code-Semantik. `verify.json` (`dotnet build` + `dotnet test`) erfasst Unity-Tests nicht zuverlaessig (Unity-generierte Framework-csproj, keine Engine-Runtime unter `dotnet test`) — der Schritt suggeriert Testabdeckung, ist aber nur ein Compile-Gate.
2. **Kein Tiering.** Alle Tests sind gleichrangig; die teuren Evidence-Laeufe (z. B. `PrototypeAutopilotNavigationPlayModeTests.cs`, 167 KB, inkl. CSV-/Screenshot-Erzeugung) verhindern, dass "alles laufen lassen" praktikabel ist.
3. **Szenarien sind in Tests eingebacken.** Jeder Test baut seine Welt selbst; es gibt keine benannten, wiederverwendbaren Szenarien mit Erfolgskriterien. Dadurch testen aehnliche Tests subtil Verschiedenes, und neue Features (Gravitation!) muessen N Tests einzeln anfassen.
4. **Implizite Umgebungsannahmen.** `PrototypeScenarioBuilder.CreateShip` setzt `useGravity=false` hart; Positionen sind absolute Weltkoordinaten um den Ursprung; kein Konzept fuer zentrale Gravitation, Floating-Origin-Shifts oder Referenzframes. `PrototypeShipPlanningSnapshot` kennt bereits `centralGravityEnabled`/`atmosphereEnabled`-Flags — die Testseite kennt nichts davon.
5. **Verhaltens- statt Invarianten-Asserts.** Teile der Autopilot-Tests fixieren heutiges Verhalten (Hold/Skip-Mechanik), statt Eigenschaften zu pruefen — bei jedem legitimen Verhaltens-Fix muessen Tests "mit-gefixt" werden, was Regressionen tarnen kann.
6. **Keine Quergates:** kein Console-Error-Watchdog ueber Szenarien, kein Leak-Check (uebrig gebliebene GameObjects/Singletons zwischen Tests), kein Check, dass `Time.fixedDeltaTime`/`Physics.simulationMode` restauriert wurden (HeadlessRunner tut es via Dispose, aber nichts erzwingt Dispose).

## 2. Soll-Architektur

```
tools/run-tests.ps1  ──>  Unity.exe -batchmode -projectPath . -runTests
                            -testPlatform EditMode|PlayMode
                            -testCategory "Smoke[;Regression]"
                            -testResults artifacts/test-results/<timestamp>-<suite>.xml
                            -logFile    artifacts/test-results/<timestamp>-<suite>.log
                          ──> XML-Parse ──> Konsolen-Summary + Exit-Code

Assets/Tests/Support/
  PrototypeTestEnvironmentConfig   (Gravitation/Atmosphaere/FloatingOrigin/Obstacles, deklarativ)
  PrototypeTestScenarioCatalog     (benannte Szenarien: Setup + Erfolgskriterien)
  PrototypeScenarioBuilder         (erweitert: Environment-Config anwenden)
  PrototypeInvariantAssertions     (Ankunft, Replan-/Flip-Zaehler, NaN, Fuel-Budget, ...)
  PrototypeConsoleErrorWatchdog    (LogAssert-Wrapper pro Szenario)
  PrototypeHarnessGuards           (Leak-/Settings-Restore-Checks via [SetUp]/[TearDown]-Basisklasse)
```

### 2.1 Suiten und Kategorien

NUnit-`[Category]` als einzige Quelle der Zugehoerigkeit:

| Kategorie | Inhalt | Budget | Wann |
| --- | --- | --- | --- |
| `Smoke` | ~10-15 Szenarien, EditMode-Schnellpruefungen + kurze PlayMode-Szenarien | < ~3 min gesamt | nach jeder Aenderung |
| `Regression` | alle Validation-Tests + alle PlayMode-Szenarien | < ~15 min | vor Merge / nach groesseren Aenderungen |
| `Evidence` | Laeufe, die CSV/Screenshots fuer Spec-Evidence erzeugen | unbegrenzt | auf Anforderung im jeweiligen Change |
| `Performance` | bestehende Performance-/Benchmark-Tests | unbegrenzt | auf Anforderung |
| `Quarantine` | bekannte Flaky-Tests; laufen, brechen aber den Gate nicht | — | immer mit, getrennt gemeldet |

Regeln: Jeder Test traegt genau eine Haupt-Kategorie. Neue Tests ohne Kategorie schlagen in einem Meta-Test fehl (Reflection ueber Test-Assemblies: alle `[Test]`/`[UnityTest]` muessen kategorisiert sein) — so bleibt das System verbindlich ohne Disziplin-Appelle.

### 2.2 Szenario-Katalog

Ein Szenario ist deklarativ und besitzt eine stabile ID:

```csharp
public sealed class PrototypeTestScenario
{
    public string Id;                       // "autopilot-direct-3km"
    public PrototypeTestEnvironmentConfig Environment;
    public PrototypeTestShipConfig Ship;    // PrimitiveRig | BlueprintId | ImportedFunctional
    public Vector3 ShipStartPosition; public Vector3 ShipStartVelocity; public Quaternion ShipStartRotation;
    public ScenarioObjective Objective;     // Zielposition/Radius, Zielzustand, Timeout-Sekunden
}
```

`PrototypeTestEnvironmentConfig` (Kern der Zukunftssicherheit):

```csharp
public sealed class PrototypeTestEnvironmentConfig
{
    public GravityMode Gravity;       // None | CentralBody(position, mu) | (spaeter) Patched
    public bool Atmosphere;
    public bool FloatingOriginActive; // Szenario muss Shifts ueberleben
    public ObstacleSpec[] Obstacles;
    public float FixedDeltaTime = 0.02f;
}
```

Start-Szenarien (Smoke-Kern):

| ID | Inhalt | Invarianten |
| --- | --- | --- |
| `autopilot-direct-3km` | Stillstand → Wegpunkt 3 km | Ankunft ≤ arrivalRadius; relSpeed ≤ arrivalSpeed*1.5; ForceReplan-Zaehler == 0; Flip-Zaehler == 1; Dauer ≤ Plan*1.3; kein NaN; keine Console-Errors |
| `autopilot-direct-moving-start` | Engage mit 40 m/s Quergeschwindigkeit | Ankunft; Replans ≤ 1 |
| `autopilot-avoidance` | Obstacle auf Direktlinie | Ankunft; min. Abstand ≥ clearance; Avoidance aktiviert |
| `killmomentum-50ms` | 50 m/s + Rotation → Kill Momentum | Endspeed ≤ 0.2 m/s; AngularSpeed ≤ Schwelle; Dauer-Budget |
| `flightcontrols-modes` | Cruise/Precision/Translation-Mapping | Diagnostics-Snapshot-Invarianten (bestehende Tests kategorisieren) |
| `bootstrap-playerhud` | Bootstrap in Testszene | HUD-Bindings vollstaendig; keine Errors; keine Szenen-Kontamination |
| `combat-turret-arc` | Ziel in/aus Arc, Cooldown | FireStatus-Folge korrekt |
| `docking-soft-capture` | Anflug bis Soft-Capture-Eligibility | Eligibility-Diagnose korrekt |
| `blueprint-spawn-fly` | Scout-Blueprint → Variant → Spawn → 10 s Flug | Validation ok; Schiff fliegt; Masse/Fuel == Blueprint-Summe |

Telemetrie: jedes PlayMode-Szenario schreibt optional (nur `Evidence`) `SimulationSnapshots`-CSV; Smoke-Laeufe asserten nur, schreiben nichts.

**Zaehler-Hooks:** Fuer Invarianten wie "Replan-Zaehler == 0" braucht der Autopilot zaehlbare Ereignisse. Falls nicht vorhanden, minimale oeffentliche Counter ergaenzen (`PrototypeWaypointAutopilot.ForcedReplanCount`, `FlipCount` — analog zu existierendem `NavigationPlanRefreshCount`). Produktionscode-Aenderung klein halten, nur Zaehler/Events, keine Logik.

### 2.3 Invarianten-Asserts statt goldener Werte

`PrototypeInvariantAssertions` kapselt wiederverwendbare Pruefungen mit klaren Fehlermeldungen:

- `AssertArrived(rig, objective)` — Distanz/Speed/Lateral gegen Objective-Toleranzen.
- `AssertNoForcedReplans(autopilot, max: 0)`.
- `AssertSingleFlip(telemetry)` — Zaehlung von Vorzeichenwechseln der Forward·RouteDirection-Projektion oder Zustands-Uebergaengen.
- `AssertFinite(telemetry)` — kein NaN/Inf in Position/Velocity/Fuel ueber alle Samples.
- `AssertFuelBudget(actualKg, plannedKg, tolerance: 0.25f)` — relative Toleranz, nicht Absolutwert.
- `AssertNoConsoleErrors(watchdog)`.

Verbot in der Doku verankern: keine Asserts auf exakte Weltpositionen/Sample-Indizes/Plan-Revisionen in `Smoke`/`Regression` — solche Werte gehoeren nur in `Evidence`-Protokolle.

### 2.4 Runner

`tools/run-tests.ps1`:

1. Parameter: `-Suite Smoke|Regression|Evidence|Performance|All`, `-Platform EditMode|PlayMode|Both` (Default Both), `-UnityPath` (Default: aus `Library/EditorInstance.json` bzw. Hub-Standardpfad ermitteln, Fehler mit klarer Meldung).
2. Pruefen, dass keine Unity-Instanz das Projekt offen hat (Lockfile `Temp/UnityLockfile`) → klare Fehlermeldung statt Haengen.
3. Unity-Aufruf wie oben; PlayMode und EditMode als getrennte Laeufe (Unity-Restriktion), XML-Ergebnisse mergen.
4. XML parsen → Summary (`passed/failed/skipped`, Dauer, fehlgeschlagene Testnamen) auf stdout; Exit-Code = Anzahl Failures (Quarantine-Failures gesondert gemeldet, zaehlen nicht).
5. Artefakte: `artifacts/test-results/` (gitignored; `.gitignore` ergaenzen). Evidence-Artefakte kopiert der jeweilige Change selbst in seinen `tests/`-Ordner.

`verify.json`: `dotnet test`-Schritt umbenennen/ersetzen — entweder entfernen (nur Build behalten, reason anpassen: "Compile-Gate") oder durch `tools/run-tests.ps1 -Suite Smoke` ersetzen, falls Timeout (300 s) und Unity-Verfuegbarkeit im Verify-Kontext das hergeben; sonst Smoke-Aufruf nur in `docs/testing.md` als Pflichtschritt vor Merge dokumentieren. Entscheidung beim Umsetzen anhand realer Laufzeit treffen; wichtig ist nur: **kein Schritt darf Testabdeckung vortaeuschen.**

### 2.5 Guards

Basisklasse `PrototypeHarnessTestBase` (Opt-in fuer neue Tests, Migration alter Tests schrittweise):

- `[SetUp]`: Watchdog aktivieren (`LogAssert.ignoreFailingMessages = false`, Error-Zaehler via `Application.logMessageReceived`), Ausgangswerte von `Time.fixedDeltaTime`, `Physics.simulationMode`, `Physics.gravity` merken.
- `[TearDown]`: Szenario-Dispose erzwingen, Restwerte vergleichen (Abweichung = Testfehler "Settings leaked"), Szenen-Root auf uebrig gebliebene Objekte mit Praefix `Headless`/`Scenario` pruefen, statische Registries leeren (`PrototypeWeaponTargetRegistry.ClearForTests()` u. ae. — Liste beim Umsetzen vervollstaendigen).
- Timeout-Helper fuer PlayMode-Waits: `yield return WaitUntilOrFail(condition, seconds, message)` — kein unbegrenztes `WaitUntil`.

### 2.6 Zukunftssicherheit gegenueber kommenden Systemen

| Kommendes Feature | Harness-Vorkehrung (jetzt) |
| --- | --- |
| Planeten-/Zentralgravitation | `GravityMode.CentralBody` im EnvironmentConfig + Anwendung im ScenarioBuilder (Kraft pro FixedTick oder vorhandenes Gravitations-System aktivieren). Smoke-Szenarien werden via `[TestCaseSource]` ueber `{None, CentralBody}` parametrisiert, sobald das Feature existiert — Szenario-IDs bleiben stabil (`autopilot-direct-3km@central`). Invarianten bleiben gueltig, nur Toleranzen/Objectives pro Mode. |
| Orbital-Simulation / Referenzframes | Telemetrie/Asserts arbeiten ausschliesslich **relativ** (Schiff↔Ziel, Schiff↔Szenario-Ursprung), nie auf absoluten Weltkoordinaten. Regel im Doku-Abschnitt + Review-Checkliste. |
| Floating Origin / Large World | `FloatingOriginActive`-Flag; ein dediziertes Szenario `floating-origin-shift-during-autopilot` (Shift mitten im Transfer, Invariante: Ankunft trotzdem). |
| Timewarp | Szenarien bekommen optionales `timeScaleProfile`; Invarianten sind zeitskalenfrei formuliert (Budgets in Missionszeit). Noch nicht bauen, nur nicht verbauen: keine `Time.time`-basierten Asserts in Szenarien, immer simulierte Zeit zaehlen. |
| Drohnen/mehrere Schiffe | ScenarioBuilder unterstuetzt bereits mehrere Rigs; Objective-Struktur pro Rig auslegen (Liste statt Einzelfeld). |
| Blueprint-Schiffe | `PrototypeTestShipConfig.BlueprintId` nutzt den bestehenden `PrototypeShipBlueprintCatalog`/`BuildVariant()`-Pfad; damit testet der Harness automatisch jede Schiffskonfiguration, die der Builder (siehe `prototype-ship-blueprint-v0`) erzeugt. |

### 2.7 Monolith-Split

`PrototypeAutopilotNavigationPlayModeTests.cs` (167 KB) entlang des Szenario-Katalogs in Dateien pro Szenario-Gruppe aufteilen (`AutopilotDirectTransferPlayModeTests`, `AutopilotAvoidancePlayModeTests`, `AutopilotArrivalPlayModeTests`, ...). Evidence-Erzeugung (CSV/Screenshots) von Assert-Logik trennen: gleiche Szenarien, `Evidence`-Tests schreiben Artefakte, `Smoke`/`Regression`-Tests asserten nur. Keine Verhaltensaenderung der Pruefungen beim Split (reine Umzugs-Phase), Umbau auf Invarianten erfolgt getrennt und bewusst (Abstimmung mit `fix-autopilot-plan-execution-fidelity-v1`, dessen Phase 6 dieselben Tests anfasst — **Reihenfolge: Harness-Split zuerst, dann Autopilot-Fix auf die neuen Szenarien**, sonst doppelte Arbeit).

## 3. Doku

`docs/testing.md`: Suiten + Budgets, Runner-Aufrufe (CLI, Editor-Testrunner, Unity-MCP), Szenario-Katalog-Tabelle, Regeln (Kategorisierungspflicht, Invarianten statt Goldwerte, relative Koordinaten, Timeout-Pflicht, Evidence-Konvention), How-To "neues Szenario anlegen" mit Codebeispiel.

## 4. Risiken

- **Unity-CLI-Laufzeit:** Batchmode-Start + Domain-Reload kostet 1-3 min Grundrauschen; Smoke-Budget daher als "Testzeit", Gesamtlauf realistisch ~5 min. Akzeptabel; nicht versuchen, das mit dauerhaft offener Editor-Instanz zu "optimieren" (Lock-Konflikte).
- **PhysX-Nichtdeterminismus:** identische Maschine + feste `fixedDeltaTime` ist reproduzierbar genug fuer Invarianten; keine exakten Vergleiche.
- **HeadlessRunner vs Player-Loop:** Headless-Smokes duerfen Player-Loop-sensitive Systeme (Bootstrap, HUD, Kamera) nicht abdecken — dafuer sind PlayMode-Szenarien da. Im Doku-Abschnitt klar abgrenzen.
- **Flaky-Tests:** Quarantine-Kategorie verhindert, dass der Gate erodiert ("ist eh immer rot"); Quarantaene-Eintraege brauchen ein Ablaufdatum im Kommentar.
