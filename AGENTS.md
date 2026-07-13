# AGENTS.md - Weltraum-Spiel

## Projektregel

Die Produkt-Mainline ist die Browser-Anwendung unter `apps/weltraum-browser` mit Three.js und TypeScript. Unity bleibt ausschließlich als unveränderlicher Tag `unity-legacy-final-2026-07`, Archiv-Branch und kuratierte Legacy-Evidence erhalten.

Arbeite spec-first, klein, überprüfbar und mit Evidence. Keine opportunistischen Großrefactors und keine stillen Änderungen an fachlichen Autoritätsgrenzen.

## Wichtige Pfade

```text
apps/weltraum-browser/          Produkt-Mainline
  src/                          Runtime, Flight, Navigation, Celestial, World, UI, Three.js
  tests/unit/                   Vitest
  tests/e2e/                    Playwright
  evidence/                     JSON, Markdown und Screenshots

docs/current-mainline-state.md   Aktueller Browser-Produktstatus
docs/browser-mainline/          Browser-Architektur, Tests, CI und Port-Dokumente
docs/roadmap/                   Living Master Plan und Meilensteine
docs/architecture/              Gemeinsame Architekturverträge
docs/ux/                        UI-, Input- und Flow-Verträge
docs/legacy-unity/              Historische Unity-Intent-/Evidence-Referenz
art/                            Neutrale wiederverwendbare Quellen und Exporte
.devtoolbox/specs/changes/       Changes, Tasks und Evidence
.agent/PLANS.md                  ExecPlan-Regeln
```

## Vor jeder Aufgabe

1. Lies diese Datei.
2. Lies `README.md` und `docs/current-mainline-state.md`.
3. Lies die relevante Spec und bei größeren Vorhaben `docs/roadmap/living-master-plan.md`.
4. Prüfe aktuelle Runtime-, Test- und Evidence-Pfade, statt aus älteren Unity-Dokumenten zu schließen.
5. Schreibe für komplexe Aufgaben einen kurzen Plan und halte den Scope ein.

## Nicht verhandelbare Browser-Regeln

- Auf diesem Branch existiert kein aktives Unity-Projekt; historische Quellen nur über den Archiv-Tag oder `docs/legacy-unity` lesen.
- Archivobjekte nicht als schreibbare Mainline behandeln; wiederverwendbare Quellen unter `art/` pflegen.
- Keine Package- oder Lockfile-Änderung ohne technisch zwingenden Grund.
- TestBridge nur über `?testBridge=1`. Auf `/` muss `window.TestBridge` fehlen.
- Keine Fake-Progression, keine Positions-Snaps und kein Velocity-Zero-Shortcut.
- Der Planner erzeugt zuerst einen Plan. Der Executor führt genau den zugelassenen gelockten Plan aus.
- Kein stilles Replan. Invalidation und Divergence bleiben sichtbar und benötigen eine explizite neue Planung.
- `planHash` bleibt bei gleichen Inputs stabil und während Execution unverändert.
- Terminal Capture, Arrival und Holding bleiben Runtime-/FlightController-owned.
- Renderer, Three.js-Objekte, CSS und HUD sind Projektionen, niemals Gameplay- oder World-Truth.
- Demo Scout GLB und Procedural Fallback bleiben beide funktionsfähig.
- UI darf keine Ready-, Arrival-, Combat- oder World-State-Behauptung erfinden.

## Architekturregeln

- Domain- und Runtime-Zustand liegt in `core`, `flight`, `navigation`, `celestial`, `world`, `resources`, `shipBuilder` oder klaren Runtime-Ownern.
- UI liest ViewModels/Snapshots und sendet explizite Commands.
- Three.js konsumiert Render-/World-Presentation-Snapshots.
- Persistent relevante Identitäten sind stabile IDs, keine Anzeigenamen oder Objekt-Hierarchien.
- Navigation trennt Target, Preview, Admission, Locked Plan, Execution, Completion und Station Keeping.
- Celestial-Katalog, Ephemeris und Gravity Core bleiben reine deterministische Daten/Math, bis eine eigene Spec die Integration in Flight, Navigation, Renderer oder UI definiert.
- Resource/Cargo- und Ship-Builder-Foundations nicht als fertige Gameplay-Loops darstellen.
- Keine Surface-, Orbit-, Voxel-, Economy- oder Multiplayer-Implementation ohne eigenen Datenvertrag und eigene Spec.

## Verifikation

Befehle aus `apps/weltraum-browser`:

```bash
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

Für einen gezielten Slice zuerst fokussierte Unit-/E2E-Tests ausführen, danach die relevanten Gruppen. Bei Änderungen an Gruppenmitgliedschaften muss die CI-Inventarprüfung weiterhin jede `tests/e2e/**/*.spec.ts` genau einer Gruppe zuordnen.

Windows kann für Playwright einen expliziten Browserpfad benötigen:

```powershell
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## Evidence-Regeln

- Normale Spieler-Flows auf `/` mit sichtbaren UI-Aktionen prüfen.
- TestBridge nur für bewusst synthetische, deterministische Harness-Szenarien verwenden.
- Sichtbare UI-Änderungen mit Playwright-Screenshots prüfen.
- Nicht sichtbare Pure-Core-Slices dürfen JSON-/Markdown-Evidence ohne Screenshot verwenden, wenn ausdrücklich dokumentiert ist, dass es keine UI-/Renderänderung gibt.
- Telemetrie, Screenshot und fachliche Behauptung müssen dieselbe Runtime-Truth abbilden.
- Concept Art und Referenzbilder sind Design-Input, keine Runtime-Evidence.
- Regenerierte Evidence nicht ungeprüft überschreiben oder als neu behaupten.

## DevToolbox

Wenn der Workspace verfügbar ist, den Spec-Workflow verwenden:

```text
workspace_prepare_for_agent
specs_get_status
tasks_load
execution_create
verify_run
tasks_completion_preflight
tasks_toggle
```

Tasks erst nach Implementierung, frischer Evidence und Completion Preflight schließen. Wenn DevToolbox in einem Worktree nicht autorisiert ist, die äquivalenten Checks und den Grund im Testprotokoll dokumentieren.

## UI-Regeln

- Player UI und Debug/Test UI strikt trennen.
- Aktiven Modus, Zustand, Risiko und nächste Aktion sichtbar machen.
- Planner-Interaktionen dürfen gehaltene Flight-Inputs nicht weiter ausführen.
- Blockierte oder veraltete Route Previews dürfen keine Engage-Authority erhalten.
- Keine generischen Dashboard-Muster, unnötige Floating Cards oder Debugdaten im Spieler-HUD.
- Sichtbare Änderungen gegen die relevante Screenshot-Matrix und reale Runtime prüfen.

## Dokumentationsregeln

- `README.md` ist der Einstieg in die Browser-Mainline.
- `docs/current-mainline-state.md` ist der kompakte Status-Snapshot.
- `docs/roadmap/living-master-plan.md` ist der Planungsindex, keine Implementierungsspec.
- Unity-Dokumente und Archivobjekte klar als historische Legacy/Referenz markieren.
- Implementiert, Foundation, integriert, geplant und ausdrücklich nicht implementiert sauber trennen.
- Nach größeren Mainline-Merges Status, Evidence-Links und bekannte Grenzen aktualisieren.

## Wenn die Aufgabe komplex ist

Nutze einen ExecPlan nach `.agent/PLANS.md`. Parallelisiere read-heavy Analyse und unabhängige Tests, aber vermeide parallele write-heavy Änderungen an denselben Verträgen oder Dateien.
