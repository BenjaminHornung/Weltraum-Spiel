# An den laufenden V3-Agenten: abgegrenzte Parallelisierung

Dies ist eine Ergänzung zu deinem laufenden Auftrag, **kein Neustart und keine V3-Abnahme**.
Du bleibst A0 und alleiniger Integrator des V3-Feature-Kandidaten. Arbeite weiter;
pausiere nur einen ausdrücklich zur Übergabe vereinbarten Dateibereich.

## Unveränderliche Basis

Repository: `https://github.com/BenjaminHornung/Weltraum-Spiel`  
Veröffentlichter Planungssnapshot: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`  
V3-Branch: `feature/hvp-cut-rt-v3-completion-2026-09-23`  
Vorherige Evidencepublikation: `f2ee73cfbfa80b6c09d540c784d3ad426ae83a04`  
Während der Planung gelesener `main`: `25bc7f5bbd2db6317c42193873eadeaf10a092c5`

Der Owner hat ausdrücklich erklärt, dass du weiterarbeitest. Die historische Aussage
„all source writers are paused“ aus dem Checkpoint ist deshalb keine aktuelle
Schreibfreigabe für andere Agenten.

## Dein verbleibender Auftrag

Du behältst die Owner-first Mesh-only-Integration, den echten Speicher-/Koexistenz-Gate,
Compiler-/Worker-Anbindung, native Stage/Commit/Publish/Rollback/Finalize-Transaktion,
Incarnation/Ticket/Snapshot-Bindung und den Bootstrap. Ebenso die übrigen B1-Kerne,
insbesondere Destruction, Child-Ingest/Materialisierung, Recipe/Transition und
Removed-Material-Vorbereitung, soweit nicht separat übergeben. B1 Body bleibt vor
B2 Terrain vor B3 Access. Kein anderer Agent startet parallel den gesamten V3-Auftrag.

Alle bisherigen Qualitäts-, Quell-, Save-, Hash-, Collider-, Fehler-, Speicher- und
Zeitverträge bleiben unverändert. Keine automatische Wiederaufnahme, erhöhte Caps,
Qualitätsabstufung oder neue Engine. Kein Main-Merge, Release oder Deployment.

## Jetzt benötigte, begrenzte Übergabe

Prüfe deinen **tatsächlichen aktuellen WIP**, nicht nur das veröffentlichte Diff.
Gib je Zeile `RELEASED` oder `RETAINED` mit dem verwendbaren vollständigen Commit-SHA an.

| Paket | Gewünschte Produktionsdateien | Abgrenzung |
|---|---|---|
| P01 | `apps/weltraum-browser/src/voxel/structural/classificationSteps.ts`; `apps/weltraum-browser/src/voxel/structural/occupiedEntries.ts` | Nur gemessene Klassifikationskerne; keine Native-/Session-/Recipe-/Destruction-Integration. Explizite Übergabe zwingend. |
| P02 | `apps/weltraum-browser/src/hestia-prototype/presentation/vegetation.ts` | Bytegleiche Aufbereitung; keine Form-, Quellen-, Save- oder Ownershipänderung. |
| P03 | `apps/weltraum-browser/src/hestia-prototype/player/presentation.ts`; `apps/weltraum-browser/src/hvp/hvpCamera.ts` | Im ersten Modul nur `createHvpPlayerVisualPose`; Avatar und Solver unverändert. Kleine instanzlokale Scratch-Werte statt Frame-Temporaries. |
| P04 | `apps/weltraum-browser/src/hestia-prototype/presentation/look.ts` | Nur belegte Look-Parameter, keine Lichtpositionen oder neuen Rendertechniken. Eigenständiger visueller Kandidat. |

Eine lokale unveröffentlichte Änderung in einem Übergabepfad muss zuerst in einem
normalen, unveränderlichen Übergabestand verfügbar sein. Niemand ersetzt deinen
neueren Stand durch b3. Andere aktive Arbeiten dürfen dabei weiterlaufen.

P04 behält insbesondere die bestehende Look-ID bei: `gameCheckpoint.ts` bindet sie
in `HVP_SAVE_PROFILES` und lehnt abweichende Profile ab. Kein kosmetisch genannter
Versionssprung darf damit alte Saves sperren. Zusätzlicher Versions-/Migrationsbedarf
wird getrennt entschieden, nicht vom Look-Agenten selbst umgesetzt.

Für P01 beschreibe zusätzlich den bestehenden Generator-/Yield-/Label-Vertrag, die
betroffenen Aufrufer und die Frage, ob neue Labels innerhalb der Diagnosegrenzen
zulässig sind. Der Worker soll nicht trotz gleichnamiger Typen semantisch anders
reagieren. Bestehende öffentliche Signaturen und Fehlerreihenfolgen bleiben stabil.

P05 ist ein unabhängiger Produkt-read-only-Reviewer mit eigenen neuen Negativtestdateien.
P06 führt in einer isolierten Kopie echte Browserdiagnostik aus. Beide benötigen
**keine Produktions-Schreiblease**. Ihre Reports überschreiben deine Evidence nicht.
Koordiniere für P06 nur das exklusive Messfenster auf dem tatsächlichen Referenzgerät.

## Antwortformat an den Owner

```text
A0-HEAD: <40 Zeichen>
A0-WIP-Abgrenzung: <betroffene Pfade / keine privaten Inhalte>
P01: RELEASED | RETAINED; Basis-SHA; relevante Schnittstellen/Labels
P02: RELEASED | RETAINED; Basis-SHA
P03: RELEASED | RETAINED; Basis-SHA
P04: RELEASED | RETAINED; Basis-SHA
P06-Messfenster: <wie konkurrierende Rechnerlast vermieden wird>
Offene Konflikte: <konkrete Datei/Schnittstelle, keine pauschale Projektsperre>
```

Bei `RETAINED` dürfen die betreffenden Agenten Referenzen, Tests und Kostenanalyse
vorbereiten, aber den Produktpfad nicht ändern. Der Owner kann die zwei P01-Dateien
später an einem sicheren Schnitt übergeben; ein globaler Entwicklungsstopp ist unnötig.

## Integration

Jeder neue Agent liefert einen eigenen kleinen Kandidatenbranch, ein vollständiges
Diff-Inventar, frische Tests und Kostenbelege. Du übernimmst nur fachlich geprüfte
Änderungen. Prüfe nicht nur Git-Konflikte, sondern tatsächliche Imports, Contracts,
Source-/Mesh-/Save-Parität und Verhalten unter Abbruch/Restore.

Integriere P01 an der vereinbarten Schnittstelle und die angenommenen bytegleichen
P02/P03-Patches vor dem endgültigen Produktfreeze. P04 wird bewusst angenommen oder
außerhalb des Messkandidaten gehalten. Eine neue Look-/Produktänderung nach dem Freeze
darf nicht unbemerkt mit alten Messungen beworben werden.

P05 rebindet den Review auf den integrierten Kandidaten. P06 beginnt mit einem echten
BodyBox384-Gegenbeweis/Smoke-Test; erst nach funktionsfähiger normaler Spielerroute und
geschlossenen Gates folgt die bestehende vollständige Population. Die 1400 geplanten
Zielmessungen ersetzen weder die B1/B2/B3-Reihenfolge noch die menschliche Art-Abnahme.
