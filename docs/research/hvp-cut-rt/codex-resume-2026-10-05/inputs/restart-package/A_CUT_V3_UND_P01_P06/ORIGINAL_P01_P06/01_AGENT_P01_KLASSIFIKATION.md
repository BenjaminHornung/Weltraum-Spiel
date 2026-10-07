# P01: B1-Klassifikation: belegte synchrone Kerne verkleinern

> Eigenständig nutzbarer Arbeitsauftrag. In einer neuen Agent-Session starten.
> Bei Implementierung die vorhandenen Superpowers-Workflows für isoliertes Arbeiten,
> Planung, TDD und Verifikation verwenden; keine automatische Weiterdelegation in
> gemeinsam beschriebene Worktrees.

**Arbeitsbranch:** `agent/hvp-parallel-p01-classification-2026-10-02`  
**Basis:** `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`  
**Ziel:** B1-Klassifikation: belegte synchrone Kerne verkleinern.  
**Architektur:** Bestehende Hestia-/Three.js-/Rapier-Grenzen bleiben erhalten.
Nur die explizite Paket-Allowlist wird verändert. A0 bleibt alleiniger Integrator.  
**Stack:** Repositorygesperrtes TypeScript/Three.js/Rapier, Node 22, Vitest und Playwright.  
**Spec:** Gepinnter Cut-RT-V3-Checkpoint und HVP-ExecPlan, ergänzt um diesen Paketauftrag.

**Neue Testdateien:**
- `apps/weltraum-browser/tests/unit/hvp-parallel-p01-classification.test.ts`
- `apps/weltraum-browser/tests/reference/hvp-parallel-p01-classification-reference.ts`



## Eigene Dokumentationspfade

Zusätzlich zur oben benannten Allowlist darfst du ausschließlich diese neuen Dokumente schreiben:

- `docs/research/hvp-parallel-2026-10-02/P01-PLAN.md`
- `docs/research/hvp-parallel-2026-10-02/P01-RESULT.md`

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



## Ziel und klare Grenze

Entlaste die bestehende B1-Klassifikation, ohne A0s Owner-/Compiler-Umbau nachzubauen.
Die aktuelle `structuralComponentClassificationSteps(object, budgetValue)` yieldet
bei der Occupied-Cell-Extraktion; Facts-Indexierung, Lookup-Aufbau, BFS,
Komponentensortierung, Projektionen, Hashes und Fragmentfinalisierung enthalten
danach noch ganze synchrone Abschnitte. Diese Feststellung ergibt sich direkt
aus dem Code, nicht aus einer neuen Laufzeitmessung.

Du übernimmst **nicht** automatisch alle verbliebenen B1-Kerne. Destruction,
Child-Ingest, Recipe/Transition und die Owner-first-Integration bleiben bei A0.
Insbesondere wird ein besserer BFS nicht als Lösung eines weiterhin blockierenden
kanonischen Hashaufrufs ausgegeben.

### Exklusive Produkt-Allowlist nach Übergabe

- `apps/weltraum-browser/src/voxel/structural/classificationSteps.ts`
- `apps/weltraum-browser/src/voxel/structural/occupiedEntries.ts`

Neue Tests/Referenz: die im gemeinsamen Paketkopf genannten P01-Dateien.
Eigene Dokumentation: `docs/research/hvp-parallel-2026-10-02/P01-result.md`.

Kein Write in `connectivity.ts`, `massProperties.ts`, `canonical.ts`, `model.ts`,
`physicsTransition.ts`, `ownedCanonicalHashSteps.ts`, `structuralPlan.ts`,
`rigidRecipe.ts`, Barrels, Worker-Protokollen oder Bootstrap.
Die existierende interne Generator-Signatur und ihre Ergebnisstruktur bleiben erhalten.

## Durchführung

- [ ] **Übergabe prüfen.** A0 gibt genau diese beiden Produktdateien frei und pinnt
  ihren vollständigen Stand. Ohne Übergabe nur Analyse und unabhängige Referenztests.
- [ ] **Kosten auftrennen.** Aus dem vorhandenen Owner-/Plan-Profil die tatsächliche
  Klassifikationszeit und die größten Restabschnitte ableiten. Für eine lokale
  Diagnostik dürfen Facts, Index, BFS, Ordnung, Projektion und Hash/Freeze getrennt
  gemessen werden; Messinstrumentierung bleibt testlokal bzw. außerhalb des
  veröffentlichten Produktpatches.
- [ ] **Unabhängige Referenz festhalten.** Den öffentlichen synchronen Ausgangspfad,
  seine Sortierordnung, Werte/Hashes, Fehlerklasse/-code/-reihenfolge sowie relevante
  Getter-/Proxy-/Species-Reads an b3 oder dem expliziten Übergabestand einfrieren.
  Die Referenz darf nicht dieselben neuen Helfer verwenden wie der Kandidat.
- [ ] **Minimalen gemessenen Kern wählen.** Bearbeite zuerst den größten nachgewiesenen
  Anteil innerhalb der Allowlist. Kein pauschaler Wechsel zu Union-Find, WASM, GPU,
  globalen Integer-Caches oder ein zweiter Klassifikationsalgorithmus.
- [ ] **Arbeit inkrementell ausführen, wo belegt nötig.** Bestehende Generatorstruktur,
  Reihenfolge und synchrone Drain-Nutzung erhalten. Zusammenhängende Own-Work-Batches
  werden begrenzt; neue Diagnose-Labels müssen endlich und mit A0 abgestimmt sein.
  Öffentliche Getter dürfen nicht neu über asynchrone Fremdmutationen beobachtet werden.
- [ ] **Residuals ehrlich ausweisen.** Kann ein fremder synchroner Hash-/Freeze-Aufruf
  innerhalb der Allowlist nicht verkleinert werden, melde Symbol, Inputgröße und
  Messwert an A0. Kein Übergriff auf die kanonische API und keine Abnahme „alle Steps
  bounded“. Der gelieferte Teilpatch darf nur seinen tatsächlich nachgewiesenen
  Phasenbereich beanspruchen.
- [ ] **Abbruch und Abschluss prüfen.** Generator schließen, Throw beim Host-Yield,
  dieselbe Fehlerursache bei mehrfacher Beobachtung, keine behaltenen Scratch-Container
  nach terminalem Abschluss. Neue Scratch-Strukturen müssen in der Kostenbilanz stehen.
- [ ] **Referenzvergleich, AB/BA und Integration durchführen.** Zuerst paketlokal;
  A0 übernimmt danach den Patch in die echte Owner-Vorbereitung und kalibriert dort
  Slice-Zeit einschließlich realer Task-Wartezeiten.

## Testkatalog

P01-T01: Zusammenhängender Körper; vollständiger Deep-/Hash-Vergleich aller Komponenten,
Anchors, Joints und Fragmentfelder gegen die unabhängige Referenz.

P01-T02: Nicht verbundene Teilmengen, negativer Koordinatenbereich und Brick-Grenzen;
gleiche Komponenten- und Fragmentreihenfolge bei erlaubten Eingabepermutationen.

P01-T03: Leere/kleine Quellen, maximal erlaubte HVP-Population von 32768 belegten
Zellen sowie 32 Komponenten. Der Fall 33 Komponenten bei Budget 32 muss unverändert
am korrekten öffentlichen Fehler scheitern, nicht still gekürzt werden.

P01-T04: MaxVisitedCells- und MaxIndexedFacts-Grenzen einschließlich der Ablehnung
unmittelbar oberhalb der gesetzten Grenze. Anchors und beide Joint-Endpunkte zählen
nach dem bisherigen Vertrag, nicht nach einer bequemeren neuen Interpretation.

P01-T05: Generische Sparse-/Getter-/Proxy-/Species- und Throw-Oracles entsprechend den
vorhandenen Sort-/Hash-Vertragstests. Ein schneller Owner-Pfad darf diese Semantik
nicht rückwirkend verengen.

P01-T06: Abbruch an jedem neuen Yield-Punkt sowie Host-Yield-Rejection. Kein nativer
World-Zugriff in dieser reinen Source-Phase und kein Erfolg nach terminalem Abbruch.

P01-T07: Gleiche Masse-/Recipe-Eingaben downstream; die neue Klassifikation darf nicht
durch andere Reihenfolge unbemerkt Summation oder IDs ändern.

P01-T08: Profil mit kleinen typischen und legalen großen Quellen. Neue eigene Batches
gegen 4-ms-p95/8-ms-Maximum beurteilen; verbleibende fremde synchrone Aufrufe separat
ausweisen. Ein lokaler Drain-Benchmark misst nicht automatisch die Owner-Task-Latenz.

## Abnahme und Lieferung

Der Patch wird nur als Performance-Kandidat empfohlen, wenn ein relevanter gemessener
Kern schneller/kleiner wird oder eine belegte Liveness-Grenze verbessert, ohne
Semantik- und Speicherregression. Kein komplexer Patch für einen Effekt im Messrauschen.
Kann das Profil die Priorität nicht bestätigen, liefere `NO_PRODUCT_CHANGE` mit
Kostenbeleg statt eine nutzlose Optimierung zu erzwingen.

Expliziter Testbefehl:
`npm run test -- tests/unit/hvp-parallel-p01-classification.test.ts`

Danach relevante bestehende Structural-/Owner-/Recipe-Tests unverändert mitlaufen lassen.
Ein Fehler in einer A0-eigenen Testdatei wird dokumentiert und abgestimmt, nicht durch
eigenmächtiges Abschwächen der Assertion beseitigt.

Lieferung: Kandidaten-SHA, Referenzbindung, Kostenprofil, verbleibende synchrone Symbole,
Yield-/Label-Vertrag, beobachtete Bounds und Integrationshinweis an A0.
**P01 beendet nicht B1, B2 oder V3 insgesamt.**
