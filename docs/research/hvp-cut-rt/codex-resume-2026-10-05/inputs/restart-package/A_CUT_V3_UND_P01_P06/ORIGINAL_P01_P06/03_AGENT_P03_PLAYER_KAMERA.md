# P03: Player- und Inspektionskamera ohne vermeidbare Frame-Allokationen

> Eigenständig nutzbarer Arbeitsauftrag. In einer neuen Agent-Session starten.
> Bei Implementierung die vorhandenen Superpowers-Workflows für isoliertes Arbeiten,
> Planung, TDD und Verifikation verwenden; keine automatische Weiterdelegation in
> gemeinsam beschriebene Worktrees.

**Arbeitsbranch:** `agent/hvp-parallel-p03-camera-2026-10-02`  
**Basis:** `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`  
**Ziel:** Player- und Inspektionskamera ohne vermeidbare Frame-Allokationen.  
**Architektur:** Bestehende Hestia-/Three.js-/Rapier-Grenzen bleiben erhalten.
Nur die explizite Paket-Allowlist wird verändert. A0 bleibt alleiniger Integrator.  
**Stack:** Repositorygesperrtes TypeScript/Three.js/Rapier, Node 22, Vitest und Playwright.  
**Spec:** Gepinnter Cut-RT-V3-Checkpoint und HVP-ExecPlan, ergänzt um diesen Paketauftrag.

**Neue Testdateien:**
- `apps/weltraum-browser/tests/unit/hvp-parallel-p03-camera.test.ts`
- `apps/weltraum-browser/tests/reference/hvp-parallel-p03-camera-reference.ts`



## Eigene Dokumentationspfade

Zusätzlich zur oben benannten Allowlist darfst du ausschließlich diese neuen Dokumente schreiben:

- `docs/research/hvp-parallel-2026-10-02/P03-PLAN.md`
- `docs/research/hvp-parallel-2026-10-02/P03-RESULT.md`

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



## Ziel und belegter Ansatzpunkt

Entferne unnötige kurzlebige Vektoren in der bestehenden reinen Darstellung.
`createHvpPlayerVisualPose.update` erzeugt am Ausgangsstand im normalen Interpolationspfad
zwei temporäre `Vector3`. Die Fly-Inspektionskamera erzeugt Forward-/Right-/Up-/Movement-
Vektoren und weitere temporäre Vektoren beim Anwenden der Ansicht.

Das ist ein direkt sichtbarer Allokationsbefund, **kein Nachweis**, dass diese Stellen
die derzeitigen Sekundenlatenzen eines Body-Cuts verursachen. Dieses kleine Paket
darf schnell abgeschlossen werden, statt zu einem Kameraframe­work zu wachsen.

## Exklusive Allowlist

- `apps/weltraum-browser/src/hestia-prototype/player/presentation.ts`
- `apps/weltraum-browser/src/hvp/hvpCamera.ts`
- Neue P03-Test-/Referenzdateien aus dem Paketkopf.
- Bericht `docs/research/hvp-parallel-2026-10-02/P03-result.md`.

In `player/presentation.ts` wird nur `createHvpPlayerVisualPose` optimiert.
`createHvpAvatarMesh`, dessen Maße, Geometrie und Identitäten bleiben bytegleich.
Keine Änderung an `player/input.ts`, Physics-Profil, Solver, Autostep, Kamerakollision,
Bootstrap, Controls, Preset-Koordinaten oder Saveformat.

## Produktionsaufrufer vor Optimierung nachweisen

Prüfe am festen Kandidaten die tatsächlichen Aufrufer beider Module. Ein Export oder
Unit-Test allein beweist keinen produktiven Frame-Hotpath. Falls der Player-Posefilter
nur testseitig verwendet wird, lasse ihn unverändert und beschränke das Produktpaket
auf belegte laufende Kamera-Arbeit. Aktiviere keine bisher ungenutzte Glättung, nur
um einen Benchmarknutzen zu erzeugen. Melde klar, ob der gemessene Nutzen den
Inspektions-Fly-Modus oder den normalen Spielermodus betrifft.

## Durchführung

- [ ] **Verhalten als Referenz aufzeichnen.** Positions-/Kamerasequenzen für Initialisierung,
  normale Updates, Reset, große Sprünge, Orbit, Fly, Presetwechsel, Restore, Focus-/Lock-
  Wechsel und Dispose erzeugen.
- [ ] **Negative und Eigentumstests zuerst ergänzen.** Öffentliche unveränderliche
  Snapshots dürfen nicht nachträglich mit internem Scratch verändert werden.
- [ ] **Minimale lokale Wiederverwendung einführen.** Wenige pro Controller angelegte
  Scratch-Vektoren statt globalem Pool. `set`/`copy` nur mit der bisherigen
  Berechnungsreihenfolge verwenden. Die öffentliche `position` behält ihre bisherige
  Identität. Keine Spieler- oder Sollposition wird extrapoliert.
- [ ] **Aliasing ausschließen.** Forward/Offset/Movement dürfen einander nicht
  überschreiben. Insbesondere darf `applyView` keinen Vektor mutieren, den der
  aktuelle Bewegungsupdate noch benötigt.
- [ ] **Öffentliche Reads erhalten.** Für gültige normale Snapshots identische
  Ergebnisse; öffentliche Getter-/Throw-Reihenfolge nicht unbemerkt durch einmaliges
  Einlesen oder geänderte Validierung ersetzen.
- [ ] **Messung und echte Bedienregression.** Konstruktionen bzw. Allokationsprofil
  auf dem relevanten Update-Pfad prüfen; Frame-/GC-Effekt im Browser nur melden,
  wenn tatsächlich nachgewiesen. Input-/Pointer-Lock-Tests unverändert wiederholen.

## Testkatalog

P03-T01: Initialer Pose-Read, reset=true, Entfernung >2 m und laufender Lag-Filter.
Die Zeitkonstante bleibt 0,045 s, keine Prädiktion, gleiche numerische Ergebnisse.

P03-T02: 0, negative, NaN und unendliche Delta-/Positionswerte: exakt dasselbe
bisherige Fehler- oder Clamp-Verhalten in der jeweiligen öffentlichen Funktion.
Nicht die Kamera-Clamp-Regel auf den Player-Filter übertragen.

P03-T03: Fly-WASD, gegensätzliche Tasten, diagonale Normierung, Q/E, Shift und Alt.
Bisherige Geschwindigkeiten, Achsen und Pitchgrenzen bleiben erhalten.

P03-T04: Orbit/Fly/Preset-/Wheel-/Pointer-Folgen liefern die bisherigen Posen.
Alle festen C01–C05/C07-Ansichten bleiben unverändert.

P03-T05: Pointer Lock oder isInputBlocked stoppt den Inspektionsinput; keine
Doppelsteuerung des laufenden Spielers. Blur und Restore entfernen alte Tastenzustände.

P03-T06: `readPose()` und `checkpoint()` liefern weiterhin stabile eigenständige
Snapshots. Spätere Updates dürfen zuvor gespeicherte Werte nicht verändern.

P03-T07: Dispose ist idempotent; Listener und Pointer Capture werden korrekt beendet.
Mehrere unabhängige Controller dürfen keinen globalen Scratch teilen.

P03-T08: `createHvpAvatarMesh` bleibt vollständig bytegleich; keine Änderung an
Quellen, Collider, 1,8-m-Maßstab oder Profilwerten.

P03-T09: Nach Initialisierung keine neuen **eigenen temporären Vector3-Konstruktionen**
im tatsächlich optimierten normalen Update-Zweig. Das ist keine Behauptung, dass
Three.js intern, `readPose()` oder die ganze Anwendung allokationsfrei seien.

## Abnahme

Die Korrektheit folgt aus Referenzsequenzen und Ownership-Tests. Der KISS-Gewinn
darf hier bereits in nachweislich entfernten Frame-Allokationen bestehen, ohne einen
statistisch nicht belastbaren Gesamt-FPS-Gewinn zu erfinden.

Expliziter Testbefehl:
`npm run test -- tests/unit/hvp-parallel-p03-camera.test.ts`

Lieferung: kleiner Kandidatencommit, Vorher-/Nachher-Allokationsbefund, Referenzparität
und Ergebnis der echten Focus-/Pointer-Lock-Bedienprüfung.
