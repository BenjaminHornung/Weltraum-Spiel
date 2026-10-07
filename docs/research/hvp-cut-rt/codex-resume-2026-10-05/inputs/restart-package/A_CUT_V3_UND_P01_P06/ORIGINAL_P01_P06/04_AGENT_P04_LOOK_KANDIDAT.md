# P04: Sichtbarer Hestia-Look-Kandidat ohne mehr Renderkomplexität

> Eigenständig nutzbarer Arbeitsauftrag. In einer neuen Agent-Session starten.
> Bei Implementierung die vorhandenen Superpowers-Workflows für isoliertes Arbeiten,
> Planung, TDD und Verifikation verwenden; keine automatische Weiterdelegation in
> gemeinsam beschriebene Worktrees.

**Arbeitsbranch:** `agent/hvp-parallel-p04-look-2026-10-02`  
**Basis:** `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`  
**Ziel:** Sichtbarer Hestia-Look-Kandidat ohne mehr Renderkomplexität.  
**Architektur:** Bestehende Hestia-/Three.js-/Rapier-Grenzen bleiben erhalten.
Nur die explizite Paket-Allowlist wird verändert. A0 bleibt alleiniger Integrator.  
**Stack:** Repositorygesperrtes TypeScript/Three.js/Rapier, Node 22, Vitest und Playwright.  
**Spec:** Gepinnter Cut-RT-V3-Checkpoint und HVP-ExecPlan, ergänzt um diesen Paketauftrag.

**Neue Testdateien:**
- `apps/weltraum-browser/tests/unit/hvp-parallel-p04-look.test.ts`
- `apps/weltraum-browser/tests/e2e/hvp-parallel-p04-look.spec.ts`



## Eigene Dokumentationspfade

Zusätzlich zur oben benannten Allowlist darfst du ausschließlich diese neuen Dokumente schreiben:

- `docs/research/hvp-parallel-2026-10-02/P04-PLAN.md`
- `docs/research/hvp-parallel-2026-10-02/P04-RESULT.md`

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



## Ziel und ehrliche Reichweite

Erzeuge einen überprüfbaren **visuellen Kandidaten** auf der vorhandenen Hestia-Küste:
lesbare helle Küsten, unterscheidbare trockene/nasse Materialrollen, durchsichtige
Wasserwirkung, erkennbare Wurzeln und atmosphärische Tiefe.

Dies ist weder neue Geometrie noch vollständige Konzeptparität. Eine Palette repariert
keine fehlenden Silhouetten. Ein negativer Befund zu Wurzeln, Kronen oder Landschaftsform
wird getrennt dokumentiert und nicht durch Sättigung oder veränderte Kamerawinkel versteckt.

## Exklusive Allowlist

Produkt: `apps/weltraum-browser/src/hestia-prototype/presentation/look.ts`.
Neue P04-Unit-/E2E-Dateien aus dem Paketkopf.
Bericht `docs/research/hvp-parallel-2026-10-02/P04-result.md`.
Originalcaptures kommen in ein eigenes unveränderliches externes Evidence-Verzeichnis.

Kein Write an `visualEffects.ts`, `vegetation.ts`, Mesher, Materialfactory, Bootstrap,
Physik, Kamera, Saves, HUD oder vorhandenen Golden-/Testdateien.
Kein zweiter Renderer, keine zusätzlichen Lichter, Shadowmaps, Render Targets,
SSR/SSAO, Texturen oder dynamische Wellensimulation.

## Wichtige existierende Bindungen

`look.ts` definiert momentan ausschließlich die Variante `"readable"` und
`hvp:readable-coast-v6`. Materialrollen benutzen den vorhandenen `BasicLit`-Vertrag.
Es gibt hier keinen frei erfindbaren Roughness-/PBR-Parameter.

Die Glanzrichtung im existierenden Wasser-Shader von `visualEffects.ts` verwendet
die feste Richtung aus `(-28, 42, -18)`. Daher bleiben **alle Lichtpositionen** und
die Sonnenrichtung in diesem Paket unverändert. Eine neue Licht-/Shader-Abstimmung
wäre ein anderes gemeinsames Paket mit A0.

Wasser bleibt transparent, depthWrite=false, renderOrder=1, nicht kollidierend und
nicht physikalisch simuliert. Trocken/Nass/Soil/Moss-Rollen bleiben dieselben.
Keine Quell- oder Saveversion und keine Look-ID ändern. `gameCheckpoint.ts` nimmt
die Look-ID in `HVP_SAVE_PROFILES` auf und lehnt fremde Profile ab. Der Kandidat wird
durch Git-SHA und Bildbericht bezeichnet, nicht durch eine neue persistierte ID.

## Durchführung

- [ ] **Originale prüfen.** Vor einem Patch Konzeptbilder und Visual Design Language
  öffnen und tatsächliche Ausgangscaptures erzeugen. Ist ein Original nicht vorhanden,
  genau diese Lücke ausweisen. Keine fremden Reddit-Bilder als neue einzige Wahrheit.
- [ ] **Feste Ausgangsansichten aufnehmen.** C01-EYE, C02-SHORE, C03-ROOTS und C04-WIDE
  am b3-Stand bzw. freigegebenen Übergabestand; gleiche Camera-Pose, Bildgröße, DPR,
  Source-Digest, UI-Zustand und Renderbedingungen. Originale unverändert behalten.
- [ ] **Drei präzise Defizite oder ein No-Change-Ergebnis festhalten.** Beispielsweise
  nicht lesbarer Kalkstein/Nässekontrast, zu opake Wasserwirkung oder absaufende
  Wurzelunterseiten – nur wenn in den aufgenommenen Bildern tatsächlich vorhanden.
- [ ] **Kleinsten Parameterpatch erstellen.** Nur bestehende Farben, Intensitäten,
  Wasser-Opacity und vorhandene Fog-Werte innerhalb der bisherigen Verträge ändern.
  Nicht zur Diagnose passende Parameter bleiben unverändert. Kein Entwurf, der
  lediglich „mehr Sättigung“ oder „alles heller“ als Konzepttreue verkauft.
- [ ] **Savegebundene Look-ID erhalten.** Lies `src/hestia-prototype/persistence/gameCheckpoint.ts`.
  `HVP_SAVE_PROFILES.look` und der strenge Profilvergleich müssen unverändert bleiben.
  Kein v7-Profil und keine neue öffentliche Variante. Kandidaten nur über Git-SHA und
  Bildbericht unterscheiden. Falls eine übergeordnete Regel neue Look-IDs verlangt,
  melde den Kompatibilitätsentscheid an A0/Owner und ändere nicht heimlich ID oder Validator.
- [ ] **Unveränderte Ansichten wiederholen.** Vorher/nachher und Konzeptreferenz
  getrennt beschriften. Nicht unterschiedliche Kameraausschnitte gegeneinander werten.
  Raw-PNGs, Source-/Build-/Browserbindung und numerische Renderkosten festhalten.
- [ ] **Schnitt-/Restore-Ansichten prüfen, sobald vorhanden.** Derselbe Materiallook
  muss auch auf echten neuen Schnittflächen und Fragmenten gelten. Falls b3/A0s
  Zwischenstand noch kein Applied erreicht, ist dieser Teil BLOCKED_BY_V3, nicht PASS.
  Keine direkte State-Manipulation, um ein scheinbares Nachherbild zu erzeugen.
- [ ] **Menschliche Auswahl vorbereiten.** Ein kleiner Satz eindeutiger Vergleichsbilder
  und ein offener Geometrie-/Silhouetten-Gap-Bericht. Keine automatische ART_ACCEPTED-
  Einstufung; bei Ablehnung bleibt der unveränderte v6-Look die Integrationsoption.

## Test- und Abnahmekatalog

P04-T01: `createHvpLookProfile("readable")` erfüllt dieselben Rolle-/Wasserverträge;
andere Varianten werden wie vorher abgewiesen.

P04-T02: `projectHvpLook` bewahrt Material-IDs, Dichten und contentHash; keinerlei
Änderung an Kollisions-/Massendaten oder Pflanz-Sourcebytes.

P04-T03: Lichtanzahl/-positionen, Geometrie, Shadowmap-Auflösung, Texture-/RenderTarget-
Anzahl, Draw Calls und Dreiecke bleiben unverändert. Tatsächliche GPU-/Framekosten
trotzdem messen, nicht allein aus gleich vielen Draws ableiten.

P04-T04: Bestehende C01/C02/C03/C04-Kameras, Eyeheight und FOV bleiben gleich.
Unterwassergeometrie und Wurzelzwischenräume müssen im Zielbild beurteilbar bleiben.

P04-T05: Technische Bildmetriken werden nicht gelockert und Goldens nicht überschrieben.
Eine gewünschte Bildänderung ist ein neuer Kandidat, keine rückwirkend geänderte Baseline.

P04-T06: Standardraumflug `/` und TestBridge-Isolation unverändert.
Kein neuer Zugang, Auto-Resume oder Umgehen von SimulationHold.

P04-T07: Cut/Fragment/Load zeigen nach erreichbarem echten Applied denselben
Materialvertrag; bei noch fehlendem Flow explizit offen.

Explizite Befehle:
`npm run test -- tests/unit/hvp-parallel-p04-look.test.ts`
`npm run test:e2e -- tests/e2e/hvp-parallel-p04-look.spec.ts --workers=1 --retries=0`

Keine Golden-Aufnahmeflags aktivieren. Diagnose-Captures nicht gleichzeitig mit P06s
qualifizierter Latenzmessung durchführen.


P04-T08: `HVP_SAVE_PROFILES` ist exakt zum Ausgangsstand identisch, einschließlich
`look`. Ein am festen Ausgangsstand gültiger HVP-Spielstand wird mit unveränderten
Bytes vom Kandidaten angenommen; Canonical-/Signature-/Profile-Gates bleiben aktiv.
Keine Änderung an `gameCheckpoint.ts`, `saveStore.ts`, Migrationen oder Savefixtures,
um das Ergebnis zu erzwingen. Bildänderungen sind separat am Commit zu dokumentieren.

## Lieferung

Kandidaten-SHA, Vorher-/Nachherbilder, belegte Parameteränderungen, unveränderte
Source-/Geometriekosten, GPU-/Frame-Diagnostik und verbleibende Form-/Materiallücken.
Das Paket liefert sichtbaren Fortschritt **als überprüfbaren Vorschlag**, nicht die
Behauptung, mit einem Farbtuning schon die ganze Hestia-Konzeptwelt erreicht zu haben.
