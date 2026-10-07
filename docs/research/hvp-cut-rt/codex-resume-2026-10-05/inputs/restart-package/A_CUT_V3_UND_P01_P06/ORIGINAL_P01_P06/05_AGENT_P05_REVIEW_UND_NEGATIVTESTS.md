# P05: Unabhängiger V3-Diffreview und adversariale Vertragstests

> Eigenständig nutzbarer Arbeitsauftrag. In einer neuen Agent-Session starten.
> Bei Implementierung die vorhandenen Superpowers-Workflows für isoliertes Arbeiten,
> Planung, TDD und Verifikation verwenden; keine automatische Weiterdelegation in
> gemeinsam beschriebene Worktrees.

**Arbeitsbranch:** `audit/hvp-parallel-p05-contracts-2026-10-02`  
**Basis:** `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`  
**Ziel:** Unabhängiger V3-Diffreview und adversariale Vertragstests.  
**Architektur:** Bestehende Hestia-/Three.js-/Rapier-Grenzen bleiben erhalten.
Nur die explizite Paket-Allowlist wird verändert. A0 bleibt alleiniger Integrator.  
**Stack:** Repositorygesperrtes TypeScript/Three.js/Rapier, Node 22, Vitest und Playwright.  
**Spec:** Gepinnter Cut-RT-V3-Checkpoint und HVP-ExecPlan, ergänzt um diesen Paketauftrag.

**Neue Testdateien:**
- `apps/weltraum-browser/tests/unit/hvp-parallel-p05-admission.test.ts`
- `apps/weltraum-browser/tests/unit/hvp-parallel-p05-lifecycle.test.ts`
- `apps/weltraum-browser/tests/unit/hvp-parallel-p05-memory.test.ts`



## Eigene Dokumentationspfade

Zusätzlich zur oben benannten Allowlist darfst du ausschließlich diese neuen Dokumente schreiben:

- `docs/research/hvp-parallel-2026-10-02/P05-PLAN.md`
- `docs/research/hvp-parallel-2026-10-02/P05-RESULT.md`

Andere gemeinsame Pläne und historische Evidence bleiben read-only. Die eigene Plan- und Ergebnisdatei dürfen gemeinsam geführt werden, wenn die Trennung von Auftrag, ausgeführten Schritten und Nachweisen klar erhalten bleibt.

Zusätzliche kleine, selbst erzeugte Testfixtures sind ausschließlich unter `apps/weltraum-browser/tests/reference/hvp-parallel-p05/` erlaubt. Keine fremden Saves oder privaten Rohdaten veröffentlichen.

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



## Rolle und Ziel

Du bist ein unabhängiger Reviewer, kein zweiter V3-Implementierer.
Beginne sofort am festen Commit mit vollständiger Inventarisierung des Diffs
`f2ee73cfbfa80b6c09d540c784d3ad426ae83a04..b3c6523a94cd050f5a9a22dc27f4777fcc03363e`
und den davon beanspruchten Aufrufer-/Owner-Verträgen. Beschränke die Prüfung nicht
auf die Commitbeschreibung oder die ersten API-Seiten. Der Planungsreview hat
entscheidungsrelevante Pfade untersucht, aber keinen vollständigen Zeilenreview
aller geänderten Dateien behauptet; du schließt diese konkrete Abdeckungslücke.

Keine erneute Grundsatzrunde zu R00, kein Re-Design des Projekts und kein Wiederaufrollen
der historischen EV01-Publikation ohne einen konkreten neuen Integritätsbefund.

## Schreibumfang

Produktcode vollständig read-only. Erlaubt sind ausschließlich die drei neuen
P05-Testdateien im Paketkopf und eigene kleine Testfixtures unter
`apps/weltraum-browser/tests/reference/hvp-parallel-p05/`.
Bericht: `docs/research/hvp-parallel-2026-10-02/P05-result.md`.

Bestehende Tests, Assertion-Schwellen, Configs, Compiler- und Performance-Harnessdateien
bleiben unverändert. Eine reproduzierte rote Regression darf auf deinem separaten
Reviewbranch veröffentlicht werden, aber nicht als grünes Paket integriert werden.
Produktkorrekturen gehen an A0 bzw. den eindeutigen Dateiowner.

## Konkrete Prüffelder

1. **Owner-/Compiler-Grenze.** `bodyCutConsumer.ts`, `bodyCutSession.ts`,
   `bodyCutPlan.ts`, `bodyCut.ts`, `terrainProducts.ts`, `hvpBodyCutJob.ts`,
   `hvpBodyCutWire.ts`, `bodyMeshAdmission.ts`.
   Der Compiler plant am Checkpoint noch selbst; mesh-only Admission ist vorbereitet,
   aber nicht produktiv verdrahtet. Bezeichne eine fehlende, bereits deklarierte
   V3-Integration als OPEN_IMPLEMENTATION, nicht als überraschend reproduzierten Bug.

2. **Laufzeit und Identität.** `client.ts`, `physicsWorker.ts`, `session.ts`,
   `worldReplacement.ts`, Worker-Pool/Transport und deren tatsächliche Call-Sites.
   Untersuche Inkarnation/Ticket/Snapshot-Reihenfolge unabhängig von commandId.
   Ein vorhandenes Feld oder eine fortlaufende Nummer beweist alleine keinen
   wirksamen Stale-Reply-Schutz.

3. **Render-/Speichereigentum.** Bootstrap-Preflight, `estimateHvpStageCpuBytes`,
   `admitScene`, ArrayBuffer-Transfer/Decode, `threeRenderBackend.ts`,
   `threeResourceRegistry.ts` und ephemeral Representation-Identitäten.
   Ein rechnerischer Admission-Pass ist kein gemessener Heap-Peak.

4. **Pure Source-Änderungen.** FNV-Schritte, OccupiedEntry-/Classification-/Mass- und
   Transition-Verträge. Prüfe tatsächlichen Diff und unabhängige historische
   Oracles; neue Produkt-Helfer dürfen nicht ihr eigener einziger Test-Oracle sein.

5. **Mess- und Testintegrität.** `cutTrace.ts`, `hvpCutRtReport.ts`, K34-Readiness,
   Browser-Configs und alle geänderten Tests. Doppelt gezählte Teilmengen und alte
   Autorenläufe dürfen nicht als frische vollständige Abnahme erscheinen.

## Durchführung und Tests

- [ ] **Coverage-Liste erzeugen.** Jede geänderte Datei: gelesen/teilgelesen/offen,
  Rolle, abhängige Garantie, nötige Tests. Unveränderte Aufrufer mit hoher Relevanz
  dazunehmen. Dateiname oder Commitstatistik allein gilt nicht als gelesen.
- [ ] **Befunde unterscheiden.** REPRODUCED_DEFECT, STATIC_RISK,
  OPEN_IMPLEMENTATION, NOT_RUN und OUT_OF_SCOPE sind getrennte Zustände.
  Keine Sicherheitslücke aus einem nur theoretischen Trace behaupten.
- [ ] **Minimalrepros bauen.** Bestehende echte Typen/Factories und Testports
  wiederverwenden, ohne ein neues Framework zu bauen. Repros am Ausgangsstand
  tatsächlich ausführen und erwartete rote/positive Kontrollen dokumentieren.
- [ ] **Adversarial-Population durchgehen.** Die folgenden Cases zuerst gegen den
  Checkpoint, später gegen den von A0 gelieferten vollständigen Kandidaten testen.

P05-T01: Ein layout- und hashformal passendes Mesh mit falscher Face/Winding/
Cavity/AO/Material-Geometrie darf vom Owner-Geometry-Verifier nicht akzeptiert werden.
Benutze echte lokale Ownerquellen, nicht nur eine Payload, die schon die Transport-
Validierung gar nicht erreicht.

P05-T02: Worker-Rückgabe mit gleichen IDs/Hashes, aber nicht der aktuellen
Inkarnation bzw. dem aktuellen Ticket. Nach Restore/Neustart darf sie weder
State überschreiben noch Render, Commit oder Resume auslösen.

P05-T03: Cancellation vor/zwischen/nach realen Yield-Punkten, geworfenes Yield,
verspätete Antworten nach Dispose und zwei terminale Signale. Promise-Abschluss,
Cleanup und erste Fehlerursache bleiben stabil. Kein Native-Stage nach Abbruch.

P05-T04: Rollback nach Hidden Stage, Fehler beim Commit, Render-Publish-Fehler,
Finalize-Fehler und unklare native Rücknahme. Nur belegte Wiederherstellung darf
als Rejected enden; unbewiesene Wiederherstellung behält RecoveryHold.

P05-T05: Null Kinder nach vollständigem legalem Entfernen, ein Kind, maximale
erlaubte Kinderzahl, Recut und Cold-/Hot-Load. Keine „erster Part muss existieren“-
Annahme außerhalb des tatsächlichen Vertrags.

P05-T06: Alte/neue Source und Renderdaten, sieben Wirekanäle, Decode-Lebensdauern,
erwartetes Vergleichsmesh, Indices/Sort-/Map-Scratch und laufende Jobs gemeinsam
bilanzieren. Unterschied zwischen geteiltem Bufferalias und physischer Kopie
belegen; Fehlerpfade dürfen Reserven nicht doppelt freigeben.

P05-T07: CPU-/Mesh-Cap ablehnen **vor** Allocation/Registration/Grouping/Artifacts,
soweit der jeweilige Vertrag Vorabablehnung zusagt. Pending-Limits alleine nicht
als aggregiertes Byte-Gate akzeptieren.

P05-T08: Temporäre und dauerhafte Representation-/Owner-IDs bleiben getrennt.
Stale Visibility, Restore-Aliase, Tombstones und spätere Ressourcenretirement-
Unsicherheit prüfen. Optional diagnostischer Fehler darf Gameplay nicht verändern.

P05-T09: Diagnose aus/an sowie observer throw/drop. Eingaben und Gameplay-Outcomes
bleiben gleich; unvollständige Timingdaten dürfen keine Performance-Abnahme erzeugen.

P05-T10: Alle geänderten öffentlichen Hash-/Getter-/Species-/Error-Pfade gegen
unabhängige Referenzen, nicht gegen die gerade optimierte Implementierung prüfen.

## Testbefehle und Grenzen

`npm run test -- tests/unit/hvp-parallel-p05-admission.test.ts tests/unit/hvp-parallel-p05-lifecycle.test.ts tests/unit/hvp-parallel-p05-memory.test.ts`

Nutze für native Assertions echte Rapier-Sessions aus den vorhandenen Testmustern.
Fake-Transport-Tests dürfen Transportfehler beweisen, aber keine bestandene reale
World- oder Browserabnahme. Browser- und Hardwarebelege kommen von P06.

Keine riesigen realen Allocations nur zum Testen einer numerischen Cap: vorhandene
kontrollierte Kostenmodelle verwenden und diese als solche kennzeichnen.
GC- oder GPU-Freigabe nicht aus fehlenden JavaScript-Referenzen behaupten.

## Lieferung

Priorisierte Befunde mit exakten SHA/Datei/Zeilen, Vorbedingungen, Reproduktion,
Auswirkung, minimalem Fixauftrag und dem zuständigen Owner. Keine Fixes außerhalb
der erlaubten Testpfade. Bestehende Blocker zügig an A0 melden, statt bis zum
gesamten Auditende zu warten.

Nach A0s Integration wird derselbe Review auf den neuen festen Kandidaten regebunden:
geänderte Teile erneut lesen, relevante Negativtests frisch ausführen, alte Befunde
als behoben/offen/nicht mehr anwendbar einzeln nachweisen.
