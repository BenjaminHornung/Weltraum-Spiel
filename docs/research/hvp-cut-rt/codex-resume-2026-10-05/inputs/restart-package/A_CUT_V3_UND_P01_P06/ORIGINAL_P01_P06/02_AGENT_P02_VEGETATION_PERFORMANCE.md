# P02: Vegetation schneller aufbereiten – identische Quellen und Meshes

> Eigenständig nutzbarer Arbeitsauftrag. In einer neuen Agent-Session starten.
> Bei Implementierung die vorhandenen Superpowers-Workflows für isoliertes Arbeiten,
> Planung, TDD und Verifikation verwenden; keine automatische Weiterdelegation in
> gemeinsam beschriebene Worktrees.

**Arbeitsbranch:** `agent/hvp-parallel-p02-vegetation-2026-10-02`  
**Basis:** `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`  
**Ziel:** Vegetation schneller aufbereiten – identische Quellen und Meshes.  
**Architektur:** Bestehende Hestia-/Three.js-/Rapier-Grenzen bleiben erhalten.
Nur die explizite Paket-Allowlist wird verändert. A0 bleibt alleiniger Integrator.  
**Stack:** Repositorygesperrtes TypeScript/Three.js/Rapier, Node 22, Vitest und Playwright.  
**Spec:** Gepinnter Cut-RT-V3-Checkpoint und HVP-ExecPlan, ergänzt um diesen Paketauftrag.

**Neue Testdateien:**
- `apps/weltraum-browser/tests/unit/hvp-parallel-p02-vegetation.test.ts`
- `apps/weltraum-browser/tests/reference/hvp-parallel-p02-vegetation-reference.ts`



## Eigene Dokumentationspfade

Zusätzlich zur oben benannten Allowlist darfst du ausschließlich diese neuen Dokumente schreiben:

- `docs/research/hvp-parallel-2026-10-02/P02-PLAN.md`
- `docs/research/hvp-parallel-2026-10-02/P02-RESULT.md`

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



## Ziel und Ausgangsbefund

Verkleinere belegte Aufbau-/Meshing-Kosten der vorhandenen Vegetation. Keine neuen
Pflanzenarten, mehr Bäume oder geänderte Silhouetten in diesem Paket. Der aktuelle
Dateistand enthält bereits vier Baumvarianten, Habitat-Cluster, Holzwurzeln und
separate masselose Dekoration; das wird nicht neu implementiert.

Konkrete Prüfstellen: `volumeBuilder`, die `copySlots()`-Kopien für Dekor-Ausschluss
und Digest, `hvpPlantSourceDigest`, wiederholte kleine Arrays in der Vertex-Paletten-
Projektion von `meshHvpVegetation`. Diese Operationen sind im Code sichtbar; welcher
Anteil auf dem Zielgerät dominiert, muss erst gemessen werden.

## Exklusive Allowlist

Produkt: `apps/weltraum-browser/src/hestia-prototype/presentation/vegetation.ts`.
Neue Tests/Referenz: die P02-Dateien im Paketkopf.
Bericht: `docs/research/hvp-parallel-2026-10-02/P02-result.md`.

Unverändert bleiben HVP_VEGETATION_VERSION, öffentliche Typen/Exporte, sourceDigest,
Slotbytes, Anchor-/Attachment-IDs, Supportzellen, Pflanzpositionen und alle Meshbytes.
Kein Write an Mesher, StructuralPart/Foliage-Transfer, Physik, Saves, Bootstrap,
Look-Datei, Materialfactory oder bestehenden gemeinsam benutzten Tests.

## Durchführung

- [ ] **Eingefrorene Vergleichspopulation erzeugen.** Alle vorhandenen Bäume sowie die
  tatsächlich geplanten Reed-/Broadleaf-/Violet-/Amber-Beds. Für jeden Owner Quelle,
  Bounds, Anchors, Attachments, Digest, Mesharrays, Indexbreite, Materialranges und
  Artefaktbindungen aufnehmen.
- [ ] **Phasenprofil erheben.** Slotaufbau, Holzausschluss, Digest, Meshing,
  Farbprojektion und Artefakterstellung trennen. Kopierte Bufferbytes zählen und
  logisch belegte Reserven nicht mit Browser-Heap-Messung verwechseln.
- [ ] **Öffentliche Semantik zuerst testen.** `copySlots()` bleibt eine unabhängige
  Kopie. Eine Änderung dieser Kopie darf keinen späteren Quellread verändern.
  Generische `hvpPlantSourceDigest`-Aufrufe behalten ihren bestehenden Vertrag;
  öffentliche oder fremde Volumes bekommen keinen neuen „trusted“-Shortcut.
- [ ] **Lokale Kopien nur lokal vermeiden.** Innerhalb des privaten Builders dürfen
  dessen eigenen noch unveröffentlichten Slots direkt für Ausschluss bzw. Hashfaltung
  benutzt werden, wenn das ohne Leck eines veränderlichen Buffers möglich ist.
  Bevorzugt einfache private Funktionen/Closures; keine globale Registry und kein
  dauerhaftes Pflanzen-Mesh-Cache-System.
- [ ] **Vertex-Paletten-Projektion verkleinern.** Nur bei relevantem Messanteil temporäre
  `map`-/Koordinatenarrays durch einfache lokale Skalare oder wiederverwendbaren
  Scratch ersetzen. Numerische Auswertungsreihenfolge, Float32-Werte, Signed Zero,
  Facesampling und Fehlerverhalten erhalten.
- [ ] **Reihenfolge und Lifecycle prüfen.** Keine Wiederverwendung zwischen verschiedenen
  Ownern; kein gemeinsamer mutierbarer Meshbuffer. Dispose/erneuter Aufbau darf nicht
  den vorherigen Kandidaten oder dessen Source mutieren.
- [ ] **Kompletten realen Satz vergleichen.** Nicht nur einen kleinen isolierten Baum.
  Startup-/Aufbauzeiten und Spitzenkoexistenz des gesamten Satzes erfassen; A0/P06
  bestätigt später den Effekt im echten Browser-Startpfad.

## Testkatalog

P02-T01: Für den gesamten bestehenden Pflanzsatz sind alle Source-Slotbytes, Digests,
Positionen, Anchor-/Attachment-Felder und Bounds gegen die Ausgangsreferenz identisch.

P02-T02: Für Holz und Dekoration sind Positions-, Normalen-, Farb- und Indexarrays
einschließlich Typ/Bytebreite bytegleich; Materialranges und Artefaktidentität gleich.

P02-T03: Ändern einer zurückgegebenen `copySlots()`-Kopie beeinflusst weder Source noch
Digest, spätere Kopien oder einen anderen Pflanzenowner.

P02-T04: Gleiches Ergebnis bei wiederholtem und umgekehrt angeordnetem Aufbau.
Bestehende Habitatverbote, Salvage-Lichtung und tatsächliche Luft unter Wurzelbögen
bleiben unverändert.

P02-T05: Ungültige Palette/Variant/Pose/Habitat und fehlerhafte Volumes werden nach
dem bisherigen beobachtbaren Vertrag behandelt. Keine neue Eingabeverengung als
Performance-Abkürzung.

P02-T06: Bestehende Attachment- und Foliage-Transfer-Regressionen unverändert ausführen.
Auch nach Schnitt/Restore dürfen Dekorationen nicht den falschen Owner bekommen.
Native Browserprüfung dafür an A0/P06 übergeben, nicht mit einer reinen Meshprobe ersetzen.

P02-T07: Bestehende Lifecycle-Tests wiederverwenden. Für dieses Paket 20 deterministische
Build-/Dispose-Zyklen als ergänzende Regression vorsehen; dies ist eine neue Testvorgabe,
keine Behauptung über die Größe einer bereits gelaufenen Population. Verbleibende
produktive Referenzen, Bufferkosten und reale Backend-Ressourcen getrennt ausweisen. GC-Verzögerung nicht als „bereits freigegeben“ buchen.

P02-T08: Source- und Meshing-Profil vorher/nachher, kalt und warm, mit gleicher Population.
Keine neuen Draws, Dreiecke, retained Meshbytes oder zusätzlichen Dauer-Caches.

## Abnahme

Unveränderte Bilder und Bytes sind bei dieser **Performance-Optimierung** der Erfolg,
kein fehlender visueller Fortschritt. Sie schafft Spielraum für spätere reichere Formen,
ohne den laufenden V3-Save-/Owner-Vertrag umzubauen.
Erwarteter Nutzen muss aus gemessenen Kopien/Allokationen und Zeitprofilen stammen;
kein FPS-Versprechen aus einem Startup-Mikrobenchmark.

Expliziter Testbefehl:
`npm run test -- tests/unit/hvp-parallel-p02-vegetation.test.ts`

Lieferung: Kandidaten-SHA, vollständige Paritätsmatrix, Phasenvergleich, Kostenbilanz
und kleinster Integrationspatch. Bei fehlendem relevanten Gewinn bleibt der einfache
Ausgangscode bestehen.
