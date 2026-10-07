# P06: Realer Browserflow, Messpopulation und unabhängige Endabnahme

> Eigenständig nutzbarer Arbeitsauftrag. In einer neuen Agent-Session starten.
> Bei Implementierung die vorhandenen Superpowers-Workflows für isoliertes Arbeiten,
> Planung, TDD und Verifikation verwenden; keine automatische Weiterdelegation in
> gemeinsam beschriebene Worktrees.

**Arbeitsbranch:** `audit/hvp-parallel-p06-evidence-2026-10-02`  
**Basis:** `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`  
**Ziel:** Realer Browserflow, Messpopulation und unabhängige Endabnahme.  
**Architektur:** Bestehende Hestia-/Three.js-/Rapier-Grenzen bleiben erhalten.
Nur die explizite Paket-Allowlist wird verändert. A0 bleibt alleiniger Integrator.  
**Stack:** Repositorygesperrtes TypeScript/Three.js/Rapier, Node 22, Vitest und Playwright.  
**Spec:** Gepinnter Cut-RT-V3-Checkpoint und HVP-ExecPlan, ergänzt um diesen Paketauftrag.

**Neue Testdateien:**
Keine; vorhandene Testpopulation read-only ausführen.



## Eigene Dokumentationspfade

Zusätzlich zur oben benannten Allowlist darfst du ausschließlich diese neuen Dokumente schreiben:

- `docs/research/hvp-parallel-2026-10-02/P06-PLAN.md`
- `docs/research/hvp-parallel-2026-10-02/P06-RESULT.md`

Andere gemeinsame Pläne und historische Evidence bleiben read-only. Die eigene Plan- und Ergebnisdatei dürfen gemeinsam geführt werden, wenn die Trennung von Auftrag, ausgeführten Schritten und Nachweisen klar erhalten bleibt.

## Gemeinsamer Auftrag und unveränderliche Grenzen

Du arbeitest am Repository `https://github.com/BenjaminHornung/Weltraum-Spiel`, Produktpfad `apps/weltraum-browser`. Prüf- und Startbasis ist
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Vorgänger ist `f2ee73cfbfa80b6c09d540c784d3ad426ae83a04`. Der während der Planung gelesene GitHub-main war
`25bc7f5bbd2db6317c42193873eadeaf10a092c5`. Ein Branchname ersetzt keinen dieser SHA-Pins.

Diese Session bearbeitet ausschließlich ihr unten benanntes Paket. Ein anderer Agent
arbeitet bereits an **Cut RT V3 insgesamt**. Er bleibt A0: Owner-/Compiler-Integration,
native Transaktion, Speicher-Gate, Body vor Terrain vor Access. Ein alter Checkpoint
mit dem Satz „all source writers are paused“ ist **keine aktuelle Schreibfreigabe**.
Der Owner hat ausdrücklich mitgeteilt, dass der bestehende Agent weiterarbeitet.

### Ziel und Pflichtlektüre

Das Ziel ist eine fein blockige, begehbare Hestia-Welt mit charakteristischer Küste,
Wurzel-/Schirmvegetation, echten Schnitten, fallenden und erneut schneidbaren Teilen,
Save/Restore und einem tatsächlich spielbaren Bergungsablauf. Kein reines Debug-Diorama.
Die normale Hestia-Testpopulation benutzt `/?hestiaPrototype=1`, nicht einen erfundenen
neuen Zugang. Der normale Raumflugpfad `/` muss unangetastet bleiben.

Lies am festen Stand `AGENTS.md`, `README.md`, `.agent/PLANS.md`,
`docs/current-mainline-state.md`,
`docs/architecture/voxel-world-decision-and-supersession-index.md`,
`docs/architecture/hvp-playable-prototype-execplan.md` und
`docs/browser-mainline/hestia-cut-rt-v3-checkpoint-2026-10-02.md`.
Ordne historische Statusangaben nach Datum und SHA ein; der September-6-Mainline-Snapshot
ist keine vollständige Beschreibung dieses Oktober-Kandidaten.

Für visuelle Entscheidungen zusätzlich die vorhandene Hestia Visual Design Language,
Worldgen-/Authoring-Spezifikation und Originalbilder unter `docs/Konzeptart/Hestia`.
Zusätzliche Reddit-Referenzen aus dem Projekt ersetzen diese Quellen nicht.
Fehlende Originalbilder werden als fehlend ausgewiesen, nicht durch Agentenfantasie ersetzt.

### Hard Start, Isolation und Schreibrechte

1. Ermittle Remote-Refs, den festen Commit und den tatsächlichen eigenen HEAD. Ein später
   weitergelaufener V3-Branch verändert deine Basis nicht automatisch.
2. Verwende eine eigene Arbeitskopie oder einen eigenen Worktree und einen eigenen Branch.
   Keinen fremden Worktree umschalten, stagen, bereinigen oder anderweitig verändern.
   Kein `reset --hard`, `clean`, Stash fremder Änderungen oder Force-Push.
3. Gleiche deine **exakte** unten stehende Allowlist mit A0s aktueller Dateiübergabe ab.
   Für P01 ist eine ausdrückliche Übergabe zwingend. Bei P02–P04 reicht die dokumentierte
   Bestätigung, dass die benannten Dateien im aktiven WIP nicht zusätzlich belegt sind.
   Fehlt dieser Nachweis, beginne nur mit Lesen, Referenztests und deinem Bericht.
   Kein globaler Projektstopp: A0 arbeitet an seinen anderen Dateien weiter.
4. Existiert benötigtes, unveröffentlichtes Vorwissen in A0s betroffenen Dateien,
   darfst du es nicht durch den älteren Snapshot ersetzen. A0 veröffentlicht zuerst
   einen unveränderlichen Übergabestand. Pinne diesen vollständig im Paketbericht.
5. Produktdateien außerhalb deiner Allowlist sind read-only. Notwendige Änderungen dort
   gehen als begründeter Integrationsauftrag an A0, nicht als heimlicher Scope-Zuwachs.
6. Erlaubt sind eigene kleine Kandidatencommits und ein normaler Push des eigenen
   Agent-Branches. Kein PR, Main-Merge, Release, Deployment, History-Rewrite oder neues
   Repository. Rohcaptures, Browserprofile, lokale Agentenkonfigurationen und ungeprüfte
   Logs werden nicht veröffentlicht.
7. Nur A0 integriert Pakete in den gemeinsamen Feature-Kandidaten. Kein Agent zieht
   nebenbei fremde Paketbranches in seinen Arbeitsstand.

### Unveränderliche Produktverträge

- Genau ein nativer Rapier-World-Owner; lokales Quantum **0,125 m**; exakte Kollisionsgeometrie.
- Quellen, Saves, kanonische Hashes, IDs, Fehlerverhalten, generische Getter-/Proxy-/
  Array-Species-Semantik und Eigentumsnachweise bleiben erhalten.
- CPU-Cap **268435456 B**, Mesh-Cap **134217728 B**, **500000 Dreiecke**, **300 Draw Calls**.
- Prepare **96 MiB**, Output **8 MiB**, höchstens **2 schwere Jobs**, Queue **32**,
  gesamte optionale Diagnose-Reserve **512 KiB**.
- Zusammenhängende Arbeit höchstens **8 ms**, Slice-p95 höchstens **4 ms**.
  Reales Input→Applied und Input→bestätigtes Render jeweils p95 höchstens **250 ms**.
  Echter Body-World-Hold p95 höchstens **50 ms**; keine vorbereitungsbedingten Timerlücken
  über **20 ms**. Das sind V3-Gesamtgates, nicht automatisch Resultate deines Teilpakets.
- Keine automatische Wiederaufnahme, erhöhten Produkt-Timeouts, Qualitätsreduktion,
  zweite Physics-World, fremde native Proofs oder globale Shallow-Freeze-Abkürzung.
- Ein hashgleiches Ergebnis ist nicht automatisch vom zuständigen Owner autorisiert.
  Unbekannte GPU-/WASM-/GC-Kosten sind nicht null.
- Keine Dependency-/Lockfile-Upgrades, neue Engine, neue globale Cache-/Scheduler-/
  Budget-Abstraktion oder API-Verbreiterung ohne eigenständigen belegten Bedarf.

### KISS und Performance-Abnahme

Optimiere eine nachgewiesene Arbeit, nicht eine Vermutung. Bevorzugt wird der kleinste
korrekte A/B-Patch. Eine weitere Alternative ist nur bei einer konkreten Kostenfrage
sinnvoll. Bei innerhalb der Messstreuung gleichen Resultaten gewinnt die einfachere
Variante; behaupte nicht, das globale Performance-Optimum bewiesen zu haben.

Zuerst Referenz/Negativtest am Ausgangsstand, dann minimaler Patch, dann frische Tests.
Zeit-Slicing allein ist keine Senkung der Gesamtarbeit. Weniger Kopien sind nur dann
zulässig, wenn die bisherige Buffer-Eigentümerschaft und öffentliche Semantik erhalten
bleiben. Kein Cache ohne explizite Lebensdauer und bilanzierte Obergrenze.

Vergleiche gleiche Quellen, Fixtures, Node-/Browser-Versionen, Buildmodus und Geräte.
Erfasse zumindest median/p95, maximale beobachtete Arbeit, Allokationen bzw. deren
belegte Stellvertreter, modellierte und gemessene Speicherkosten getrennt sowie
Fehler-/Abbruchfälle. Für sehr kleine Funktionen sind exakte Allokations- und
Ergebnisinvarianten aussagekräftiger als verrauschte FPS-Versprechen.
Ein Node-Mikrobenchmark ist kein Browser- oder End-to-End-Nachweis.

Keine konkurrierenden Build-, Volltest- oder Benchmarklasten während einer qualifizierten
Messung auf demselben Referenzgerät. P06 besitzt das abgestimmte Messfenster.
Browser-Trace/Capture-Diagnostik und nicht instrumentierte Latenzmessung trennen.

### Verifikation und Ergebnisformat

Repositorygepinntes Node 22 verwenden; die Checkpoint-Probes nennen 22.23.2.
Tatsächlich verwendete Version, Lockfile-Hash und Befehle aufzeichnen. Kein stiller
Wechsel auf das global installierte Node 24. Aus `apps/weltraum-browser` stehen tatsächlich zur Verfügung:

```text
npm run test -- <deine expliziten Testdateien>
npm run build
npm run test
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

Der Platzhalter bezeichnet die im Paket unten ausgeschriebenen Dateipfade; verwende
keinen Paketmanager-Download anstelle der gesperrten lokalen Toolchain.
Für Paketarbeit zuerst fokussierte Tests. Vollsuite und Browserprüfungen am Paketkandidaten
nach Wirkung und Messfenster koordinieren; den vollständigen kombinierten Lauf führt
A0/P06 am eingefrorenen Integrationsstand aus. Nicht gelaufene Prüfungen bleiben NOT_RUN.

Der Bericht enthält: Basis- und Kandidaten-SHA, Übergabe-/Allowlist-Nachweis, vollständiges
Diff-Inventar, Ausgangsbefund, minimale Lösung, verworfene Alternativen, frische Befehle
mit Exitcodes, rohe Messpopulation/Fehler, Kostenvergleich, Restlücken und genaue
Integrationshinweise. Trenne `IMPLEMENTED`, `CODE_VERIFIED`, `PLAYABLE_VERIFIED`,
`VISUAL_TECH_VERIFIED`, `PERF_ACCEPTED` und `ART_ACCEPTED`.
Ein grüner Unit-Test oder ein schönes Bild erteilt keine der anderen Freigaben.



## Rolle und Scope

Du bist der unabhängige Browser-/Evidence-Agent. Kein Produkt-, Harness- oder
Config-Write. Beginne jetzt mit reproduzierbarer Diagnose auf dem festen Checkpoint
und bereite die finale Population vor. Eine laufend veränderte Branchspitze wird
nicht als Messbasis verwendet.

Erlaubte persistente Repoausgabe:
`docs/research/hvp-parallel-2026-10-02/P06-result.md`.
Rohreports, Screenshots, Prozessdaten und Traces nur in eigene neue externe
Verzeichnisse; vorher auf private Inhalte prüfen. Keine Golden-Ersetzung.

Die Performance-Suite besitzt bereits sieben Varianten und eine vollständige
Population. Baue keinen zweiten konkurrierenden Benchmarkrunner.

## Phase A – jetzt: tatsächliche Ausgangslage und Funktions-Smoke

- [ ] **Eigenen Build binden.** Sauberer SHA, src-/dist-Inventar, Lockfile, WASM,
  Node, installierter Chrome, tatsächlicher WebGL-Adapter/Driver, Auflösung/DPR,
  Powerprofil und Messmodus erfassen. Die vorhandene Suite enthält Windows-/
  PowerShell-Gerätebindung; sie darf auf einer abweichenden Work-Umgebung nicht
  durch erfundene Werte „portabel“ gemacht werden.
- [ ] **Native Browserfähigkeit klären.** Steht nur ein anderer Headless-/Software-
  Renderer oder kein passendes Gerät zur Verfügung, liefere verfügbare funktionale
  Diagnostik und NOT_RUN für die Hardwareabnahme. Keine Schwellenanpassung.
- [ ] **BodyBox384 normal bedienen.** Benutze die vorhandene Hestia-Oberfläche,
  echtes Picking/Pointer Lock und einen tatsächlichen Input. Binde ursprünglichen
  Hit, Owner, Revision, Quellenhash und gemessene Zellzahl.
  Die P07-Testbezeichnung allein beweist nicht, dass tatsächlich 384 Zellen vorliegen.
- [ ] **Terminales Ergebnis festhalten.** Applied samt Native-/Renderbindung oder
  tatsächliches Rejected/SimulationHold/RecoveryHold. Ein Rejected in kurzer Zeit
  ist kein schneller erfolgreicher Cut.
- [ ] **Früh abbrechen statt falscher Großserie.** Solange der reale Flow die
  Voraussetzungen nicht erfüllt, keine 1400 erfolglosen Zielmessungen starten.
  Repro, erste problematische Phase und Rohdaten an A0/A5 geben.
- [ ] **Vorhandene kleine Funktionsfälle wiederholen.** Box/Sphere, bewegter/
  schlafender Körper, Terrain/Rock-Arm, Recut, Save/Restore, Salvage und normaler
  Raumflugroute/TestBridge-Isolation – nur die erreichbaren Fälle als bestanden melden.

Ein geeigneter vorhandener Diagnoseaufruf aus `apps/weltraum-browser` ist:

```text
node node_modules/@playwright/test/cli.js test --config playwright.cut-v3.config.ts --grep "P07 body-box-moving cold session 1" --workers=1 --retries=0
```

Voraussetzungen: `WELTRAUM_HVP_CUT_RT_CLASS=diagnostic`,
`WELTRAUM_HVP_MEASURE_DIR` auf ein neues absolutes externes Verzeichnis und
`WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` auf den wirklich installierten Chrome gesetzt.
Pfad und Population aus der tatsächlichen Config prüfen. Keine privaten, unbekannten
Windows-Pfade aus einem historischen Bericht blind übernehmen.

## Phase B – nach A0-Gates: finale Messpopulation

Vorbedingungen: Owner-first-Integration wirksam, Admission/Coexistence vertretbar,
normaler Body-Smoke mit echten Native-/Renderbelegen erfolgreich; B1, danach B2
und B3 in ihrer vorhandenen Reihenfolge bearbeitet. P02/P03 und ein eventuell
angenommener P04-Look stehen bereits im endgültig ausgewählten Produktbuild.

Der vorhandene Runner definiert:

- quarry-box
- quarry-sphere
- rock-arm
- body-box-moving
- body-box-sleeping
- body-sphere-moving
- body-sphere-sleeping

Je Variante **100 Cold + 100 Warm**, verteilt auf **34/33/33** über drei Sessions:
**1400 Zielmessungen** insgesamt. Setup-Cuts und die vorgesehenen ungemessenen
Warmup-Cuts sind zusätzlich und dürfen nicht in die Zielpopulation hineingezählt werden.
„Cold“ bedeutet die vorhandene Fixture-Policy (neues Dokument/Worker), nicht automatisch
kalten OS-Diskcache oder einen neuen Browserprozess für jeden Einzelcut.

Der vorhandene vollständige Aufruf ist:

```text
node node_modules/@playwright/test/cli.js test --config playwright.cut-v3.config.ts --workers=1 --retries=0
```

Dazu `WELTRAUM_HVP_CUT_RT_CLASS=measurement`, neues externes Outputverzeichnis
und die echte installierte Browserdatei. Die Suite verwendet 1280×720/DPR1.
K34s separate 1920×1080-Population und Art-Captures nicht als dieselbe Gerätemessung
zusammenfassen. Die vorhandene K34-Config nicht verändern.

- [ ] Population und Reihenfolge vorab festhalten; keine schlechten Versuche aus der
  Menge entfernen und keine unauffälligen Retry-Erfolge an ihre Stelle setzen.
- [ ] Separate Zeitgrößen ausgeben: echter Input→Applied, echter Input→bestätigte
  Render-Submission, Applied→Render, tatsächlicher Body-Hold, Slice-Zeiten, Task-/Timer-
  Lücken und Framezeiten. Eine Projektion in die Szene ist nicht automatisch die
  erste bestätigte sichtbare Render-Submission.
- [ ] Neueste gültige Health-Daten, Drops und Timing-Sink-Fehler beachten.
  Fehlende oder fremd gebundene Belege sind fehlend, nicht null Millisekunden.
- [ ] Byte-/Cap-Matrix über Erfolg, Ablehnung, Abbruch, Publish-Failure und Restore
  mit A5s Befunden abgleichen. Modellwerte und Messwerte strikt trennen.
- [ ] Diagnose mit Trace/Video/Screenshots von der formalen Latenzmessung trennen.
  Nur eine qualifizierte Messung je Referenzgerät; andere Agenten können währenddessen
  lesen/reviewen, aber dort keine konkurrierende Last erzeugen.
- [ ] Den Source-/Buildstand nach jedem Messblock erneut binden. Mutierte Stände
  nicht zu einer gemeinsamen Population zusammenrechnen.

## Phase C – visuelle und spielbare Gesamtprüfung

Nutze die zwölf im bestehenden V3-Auftrag vorgegebenen Visualfälle, sofern dessen
Originalkatalog tatsächlich vorliegt. Rekonstruiere fehlende Fallnamen nicht als
angeblich Originale. Bis zur verfügbaren eindeutigen Liste bleibt deren vollständige
Abdeckung NOT_PROVEN. Erstelle ergänzend eine klar als neue ergänzende Prüfung
markierte Zuordnung für bestehende Küsten-/Wurzelansichten, reale Schnittflächen,
fallendes Teil, Recut, Hot-Load und Cold-Load.

Der normale Spielerablauf muss aus echten Inputs erreichbar bleiben:
Welt betreten → laufen → zielen → schneiden → sichtbarer/geometrisch korrekter
Abtrag bzw. abgetrenntes fallendes Teil → erneut schneiden → speichern/laden →
Bergungsfortschritt wiederfinden. Inspektionsaufnahmen alleine erfüllen das nicht.

Keine automatische ART_ACCEPTED-Freigabe. Zeige menschlich vergleichbare Bilder,
die Source/Owner/Native-/Renderbindungen und die noch offenen Bild- oder Gameplaymängel.

## Lieferung und Stop-Regeln

Lieferung: Run-Manifeste, echte Prozess-/Gerätebindung, vollständige Population
einschließlich Fehler/Not-Run, getrennte Kennzahlen, Caps/Spitzen, Visual- und
Gameplaymatrix sowie ein pro Gate begründetes Urteil.

Eine neue Produktänderung nach dem Messfreeze invalidiert deren Übertragbarkeit auf
den geänderten Build. Rein dokumentarische Folgecommits erfordern dagegen keine
erfundenen neuen Produktläufe, wenn identische gebundene Source-/Buildbytes belegt sind.

Kein Main-Merge und kein Release. A0 und der Owner entscheiden über Integration
und visuelle Abnahme; du lieferst unabhängige Ausführungsbelege.
