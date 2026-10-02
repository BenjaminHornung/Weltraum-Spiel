# Hestia: Parallelplan ab b3c6523a — 2. Oktober 2026

**Status:** quellengebundener Plan und sechs eigenständige Agentenaufträge; keine
Produktimplementierung, keine V3-Abnahme und keine bereits erteilte Dateiübergabe.

**Empfehlung:** Der bestehende V3-Agent bleibt A0. Zusätzlich können sechs Sessions
gezielt arbeiten: vier schmale Produktionspakete, ein unabhängiger Review-/Test-Agent
und ein Browser-/Evidence-Agent. Die Produktionsrechte bleiben exakt getrennt.
P01 greift in den laufenden V3-Kern ein und benötigt deshalb eine ausdrückliche
Übergabe von zwei Dateien. P02–P04 benötigen die Bestätigung, dass ihre Dateien nicht
durch unveröffentlichten WIP belegt sind. Lesen, Referenzen und unabhängige Tests
können schon vorher beginnen.

## 1. Benutzung des Pakets

Zuerst `00_ZUERST_AN_LAUFENDEN_AGENTEN.md` an den bereits laufenden Agenten geben.
Danach je eine frische Session mit genau einem der sechs `AGENT_*.md`-Dokumente starten.
Die Einzelprompts enthalten die Basis, Quellen, Allowlist, Nicht-Ziele, kleine
Arbeitsschritte, konkrete Tests und Abnahmegrenzen vollständig.

| Session | Auftrag | Produkt-Schreibbereich | Sofortiger Beginn |
|---|---|---|---|
| A0, bestehend | V3-Gesamtintegration und übrige B1/B2/B3-Arbeit | Bereits aktiver V3-Bereich, abzüglich bestätigter Übergaben | Weiterarbeiten; kein Neustart |
| P01 | Gemessene Klassifikationskerne begrenzen/optimieren | `classificationSteps.ts`, `occupiedEntries.ts` | Analyse/Referenztests jetzt; Schreiben erst nach Übergabe |
| P02 | Bytegleiche Vegetationsaufbereitung beschleunigen | `presentation/vegetation.ts` | Nach Bestätigung der Dateiabgrenzung |
| P03 | Kleine Frame-Allokationen in Player-/Kamera-Darstellung entfernen | `player/presentation.ts` nur Posefilter; `hvpCamera.ts` | Nach Bestätigung der Dateiabgrenzung |
| P04 | Sichtbaren Look-Kandidaten aus echten Bildvergleichen entwickeln | `presentation/look.ts` | Bildvergleich jetzt; Schreiben nach Dateiabgrenzung |
| P05 | Vollständiger V3-Änderungsreview und gezielte Negativtests | Keine Produktdateien; eigene neue Tests | Jetzt, isolierter fester Stand |
| P06 | Tatsächlichen Browserflow und später die komplette Abnahme messen | Keine Produktdateien | Jetzt Diagnose; große Messserie erst nach Gates |

„Sofort beginnen“ bedeutet nicht, dass die Planung den Inhalt eines fremden aktuellen
Worktrees kennt oder dessen Schreiblease automatisch aufhebt.

## 2. Das Ziel, auf das die Pakete einzahlen

Die unmittelbare Produktaufgabe ist eine **sichtbare und spielbare lokale Hestia-Szene**:
feine harte Voxel, helle gebrochene Küsten, terrassierte Formen, Wurzel-/Schirmbäume,
habitatgebundene Untervegetation, durchsichtige Gewässer und lesbare Beleuchtung.
Der Spieler soll laufen, zielen, schneiden, echte Teile abtrennen und fallen sehen,
erneut schneiden, speichern/laden und den Bergungsablauf tatsächlich spielen können.
Eine reine Inspektionskamera oder ein Mesh-Benchmark erfüllt diesen Auftrag nicht. [S1, S4]

Die aktuelle HVP-Quelle bindet ein lokales Quantum von 0,125 m. Das ist **keine**
Entscheidung, einen ganzen Planeten global als dichtes 0,125-m-Gitter zu speichern.
Die Visual Language lehnt glatte Low-Poly-Ersatzwelten, grobe Würfel-Dioramen und
primitive Kugel-/Lollipop-Bäume ab; sie verlangt zugleich organische Gesamtformen,
Materiallesbarkeit und menschliche visuelle Freigabe. [S1; Visual Language]

Die zusätzlichen Reddit-Verweise des Owners bleiben ergänzende Verhaltens-/
Look-Referenzen. Ihre bloße Erwähnung begründet keine neue Engine, kein Raymarching-
Rewrite und keine automatische Umdeutung der bestehenden Konzeptdateien.
Die Originalpixel wurden in dieser Planungsrunde nicht frisch visuell beurteilt.
P04 muss deshalb vor jeder Änderung Originalkonzepte und reale neue Vergleichsbilder öffnen.

## 3. Quellenstand und Reichweite dieser Prüfung

| Bezug | Festgestellter Stand |
|---|---|
| Planungskandidat / V3-Branch-Head | `b3c6523a94cd050f5a9a22dc27f4777fcc03363e` |
| Unmittelbarer Vorgänger | `f2ee73cfbfa80b6c09d540c784d3ad426ae83a04` |
| Während der Planung gelesener GitHub-main | `25bc7f5bbd2db6317c42193873eadeaf10a092c5` |
| Neuer veröffentlichter Schritt | Ein Commit nach dem Vorgänger; dessen vollständiges Änderungsinventar wurde abgerufen |
| Aktuell unveröffentlichter Agenten-WIP | Nicht zugänglich; der Owner meldet den Agenten ausdrücklich als weiterarbeitend |
| Eigene Produkt-Tests/Builds/Browserläufe hier | **NOT_RUN** |
| Eigene aktuelle Pixel-/Art-Abnahme | **NOT_RUN** |

Grundlage sind der bereitgestellte Checkpoint, abrufbare frühere Projektaufträge und
Konzeptabschnitte, Live-GitHub-Refs, das vollständige Änderungsinventar und die im
Prüfumfang-Dokument genannten direkten Quellcode-Lesungen.

**Das ist keine behauptete Vollprüfung jeder Codezeile.** Große Dateien wurden
teilweise nur in relevanten Bereichen gelesen. Die kompletten historischen Chatverläufe,
die neuesten lokalen Änderungen und mehrere nur durch ältere Uploadpfade benannte
Masterplan-/Testkatalogdateien waren nicht vollständig verfügbar. P05 erhält die
vollständige geänderte-Code-Prüfung ausdrücklich als eigenständigen Auftrag.
Keine solche Lücke wird durch eine erfundene Freigabe oder Testausführung geschlossen.

Eine wichtige Quellenfalle: `docs/current-mainline-state.md` bindet noch den Stand
vom 6. September 2026, und der Living Master Plan ist ausdrücklich ein historischer
Planungsindex. Ihre älteren „noch nicht vorhanden“-Listen beschreiben nicht zuverlässig
den Oktober-HVP-Kandidaten. Direkter aktueller Code enthält bereits SaveStore,
Bergungslogik und Body-Box-/Sphere-Verarbeitung. [S2, S3, S6, S11, S12]

## 4. Was am Checkpoint tatsächlich vorliegt

### 4.1 Implementierung und Autorenbelege

Der Checkpoint beschreibt Owner-lokale Planvorbereitung vor dem nativen Hold,
terminale Abbruchbehandlung und eine private inkrementelle Hashroute, während
generische Hash-/Getter-Verträge erhalten bleiben. Die erzeugten Child-Zellen werden
auf der Ownerroute in 16er-Batches projiziert. Die Masse des identisch gebundenen,
wirklich ausgegebenen Parent-Rezepts wird wiederverwendet; aktuelle native Pose und
Geschwindigkeiten werden weiterhin beim Stage verwendet. [S1, S5, S7]

Der Occupancy-Mesher besitzt einen gemeinsamen synchronen und schrittweisen Algorithmus.
Die neue Mesh-Admission rekonstruiert erwartete Geometrie aus dem behaltenen
Owner-Childplan und vergleicht unter anderem Positionen, Normalen, Farben, Indices,
Bounds, Materialranges und Signed Zero. Das ist mehr als ein Transporthash. [S1, S8]

Frühe numerische Admission vor Gruppierung/Keys/Foliage/Artefakten und Arbeiten an
ephemeren Renderidentitäten sind enthalten. Der Checkpoint nennt frische fokussierte
Tests und TypeScript/Build als PASS. Das sind **Autorenbelege**, keine in dieser
Planung wiederholten Ausführungen. Überlappende Testgruppen dürfen nicht zu einer
künstlich erhöhten Testanzahl addiert werden. [S1]

### 4.2 Die maßgeblichen offenen Punkte

**Die Mesh-only-Route und die neue vollständige Owner-Mesh-Prüfung sind noch nicht
produktiv verdrahtet.** Im gelesenen Compiler wird die Quelle weiterhin rekonstruiert,
`prepareHvpLocalBodyCut` erneut aufgerufen und anschließend gemesht/encodiert/decodiert.
Der Physik-Owner besitzt daneben seine eigene Planarbeit. Die Beseitigung dieser
doppelten semantischen Planberechnung gehört A0. Die weiterhin notwendige unabhängige
Geometrie-Admission ist bei jeder Performancebilanz mitzurechnen. [S1, S5, S6, S8]

`classificationSteps.ts` yieldet derzeit bei der Occupied-Cell-Extraktion; Facts-Index,
BFS, weitere Sorts, Projektionen, Hashes und Abschlussarbeiten sind noch zusammenhängende
Arbeit. `structuralPlan.ts` enthält außerdem weitere ganze Destruction-/Ingest-Schritte.
Nur den äußersten Ablauf in einen Generator zu legen beweist daher keine 8-ms-Grenze. [S7, S9]

Die vorhandenen Queue-/Jobzahlen beweisen keine gesamte Byte-Reservation. Alter und
neuer Sourcezustand, Renderpuffer, Wirekanäle, Decoderkopien, temporäre Maps/Arrays,
ein erwartetes Childmesh und unsichere Cleanup-Lebensdauern müssen zusammen passen.
Ein Kostenmodell ist keine Messung des tatsächlichen Heap-/GPU-/WASM-Peaks. [S1]

Der letzte im bereitgestellten Bericht genannte normale BodyBox384-Spielerflow endete
in `Rejected/SimulationHold`, ohne bestätigte Stage-/Applied-/Renderfolge. Ein frischer
erfolgreicher Spieler-Gegenbeweis steht im Checkpoint nicht. Die dort berichtete
Parent-Mass-Verbesserung von rund 50,35 auf 0,02 ms ist beeindruckend für diesen
Teil, beweist aber ausdrücklich keinen verlässlichen Gesamtflow-Gewinn. [S1]

## 5. Die sechs Pakete im Detail

### P01 — Höchster direkter Beitrag zum V3-Kern, aber nur mit Übergabe

Dokument: `01_AGENT_P01_KLASSIFIKATION.md`

P01 übernimmt genau `classificationSteps.ts` und `occupiedEntries.ts`. Der Agent
profilert zuerst die realen Restkerne und optimiert anschließend den größten belegten
Anteil innerhalb dieses Bereichs. Er soll nicht vorab BFS, Hashing oder Sortierung zum
Gewinner erklären und dann eine neue Architektur rechtfertigen.

Die öffentlichen synchronen Resultate, Komponentenreihenfolge, IDs, Hashes,
Fehlerpräzedenz und generische Getter-/Proxy-/Array-Species-Semantik müssen erhalten
bleiben. Der schrittweise und der synchrone Weg sollen dieselbe fachliche Berechnung
bleiben. Tatsächliche Task-Yields und Diagnose-Label-Grenzen werden mit A0 abgestimmt.

Die Testpopulation enthält kleine Quellen, legal große 32768-Zellen-Quellen,
einzelne/getrennte Komponenten, 32 Komponenten und den 33.-Komponenten-Reject,
Anker/Joints, negative Koordinaten, Eingabereihenfolge, Abbruch und erste Fehler.
Eine unabhängige Vorher-Referenz darf nicht einfach den optimierten Helper aufrufen.

**Lieferwert:** messbar kleinere/schnellere Klassifikationsarbeit oder eine belegte
Verbesserung der zusammenhängenden Blockierungszeit. Ganze fremde Hash-/Ingest-Kerne
außerhalb der Allowlist bleiben offen, wenn sie das Budget noch verletzen. Ein solcher
Teilbefund wird nicht als „B1 vollständig bounded“ ausgegeben.

### P02 — Vegetation schneller, ohne das Source-/Save-Problem neu aufzumachen

Dokument: `02_AGENT_P02_VEGETATION_PERFORMANCE.md`

Im bestehenden Vegetationsmodul sind konkrete Kopierstellen sichtbar:
`copySlots()` erzeugt eigenständige Arrays; Wood-Exclusion und Digestbildung rufen
solche Kopien auf. Beim Einfärben des bereits erzeugten Meshes entstehen kleine
temporäre Arrays je Fläche/Vertex. Welche davon relevant teuer sind, muss das
Phasenprofil zeigen. [S10]

P02 darf ausschließlich private Builder-/Aufbereitungsarbeit vereinfachen. Das
öffentliche `copySlots()` bleibt eine unabhängige Kopie. Keine Rückgabe mutierbarer
innerer Slots, kein unbeschränkter Cache und kein Form-/Versionswechsel.

Für die vollständige vorhandene Pflanzenpopulation müssen Slots, Digests, Instanzen,
Anker, Attachments, Mesharrays, Bounds, Materialranges und Draw-/Trianglemengen gleich
bleiben. Bestehende Foliage-Transfer-/Restore-Tests bleiben unverändert.

**Lieferwert:** weniger Startup-/Rebuild-Arbeit und temporärer Speicher bei identischen
Pflanzen. Das ist bewusst keine neue sichtbare Baumgeneration. Es schafft belastbares
Budget für spätere Formverbesserungen, ohne gleichzeitig Canonical Source und V3 zu ändern.

### P03 — Kleiner, gut isolierbarer KISS-Patch im Framepfad

Dokument: `03_AGENT_P03_PLAYER_KAMERA.md`

Der gelesene Player-Posefilter konstruiert im normalen Update zwei temporäre
`Vector3`-Objekte. Der Fly-Kamerapfad erzeugt weitere Forward-/Right-/Up-/Movement-
Temporaries. Ein paar instanzlokale Scratch-Vektoren können diese eigene Arbeit
ersetzen, ohne neue Pools, Manager oder mathematische Semantikänderungen. [S13, S14]

Unverändert bleiben 0,045-s-Filter, Resetgrenze, Kamerapresets, Geschwindigkeiten,
Diagonalen, Fehlerbehandlung, Pointer-Lock-/Focus-Ownership, Restore, Snapshots und
der 1,8-m-Avatar. Keine Solverposition wird geglättet, vorhergesagt oder korrigiert.

**Lieferwert:** direkt nachgewiesene Entfernung vermeidbarer eigener Frame-Temporaries.
Das ist ein kleines Optimierungspaket, kein ehrliches Versprechen eines großen
FPS-Sprungs oder einer Behebung des Schnitt-Holds.

### P04 — Sichtbares Ergebnis, ohne gleichzeitig einen neuen Renderer zu bauen

Dokument: `04_AGENT_P04_LOOK_KANDIDAT.md`

Der Agent öffnet zuerst Originalkonzepte und frische C01-/C02-/C03-/C04-Aufnahmen.
Danach entwickelt er höchstens einen begründeten neuen Look-Kandidaten über bestehende
Farb-, Intensitäts-, Wassertransparenz- und Fogparameter.

**Wichtige feste Grenze:** Die Lichtpositionen bleiben unverändert. Die bestehende
Wasser-Glanzberechnung kodiert die Sonnenrichtung im Shader; nur die Position im
Lookprofil zu ändern würde Beleuchtung und Glanz auseinanderziehen. [S15, S16]

Auch die Look-ID bleibt unverändert: `gameCheckpoint.ts` speichert sie in
`HVP_SAVE_PROFILES` und vergleicht das Profil beim Laden strikt. Eine neue visuelle
Versions-ID wäre daher keine harmlose Umbenennung, sondern würde alte Profile ablehnen.
Der Kandidat wird durch seinen Git-SHA und Bildbericht gebunden; P04 erhält einen
expliziten Alt-Save-Kompatibilitätstest. Ein benötigter Versions-/Migrationsentscheid
liegt außerhalb dieses Pakets. [S20]

Keine zusätzlichen Lights, Fullscreen-Passes, Render Targets, SSR/SSAO, Texturen,
Schattentechniken, Wasserphysik oder geometrischen Pflanzenänderungen. Der vorhandene
`BasicLit`-Vertrag wird nicht um erfundene Roughness-/PBR-Parameter erweitert.

**Lieferwert:** echte Vorher-/Nachherbilder bei festen Ansichten und unveränderten
Geometriekosten. Die GPU-Zeit wird trotzdem gemessen; gleiche Drawanzahl ist kein
Beweis gleicher Laufzeit. Der Agent darf nicht behaupten, Farbwerte könnten fehlende
Wurzelbögen, Kronensilhouetten oder die komplette Materialwirkung ersetzen.
`ART_ACCEPTED` bleibt beim Menschen. Post-Cut-Bilder benötigen zuvor einen echten
erfolgreichen V3-Spielerflow.

### P05 — Unabhängige Fehlersuche, die A0 nicht mit Gegenfixes überschreibt

Dokument: `05_AGENT_P05_REVIEW_UND_NEGATIVTESTS.md`

P05 liest das vollständige geänderte Produkt-/Test-/Konfigurationsinventar von
`f2ee73cf` nach `b3c6523a` und nötige unveränderte Aufrufer. Er prüft insbesondere
Owner-/Compiler-Vertrauen, geometrische Admission, Lifecycle, Restore,
ephemere Renderidentitäten, Speicher-Vorabprüfung und Diagnose-Opt-out.

Eigene Negativtests sollen geometrisch gefälschte, transportseitig gültige Antworten,
Late-/Stale-Replies, wiederverwendete Request-IDs über Incarnations hinweg,
geworfene Yields, Publikations-/Rollbackfehler, leere Childmengen und Cap-Grenzen
gegen die wirklichen Verträge prüfen. Behauptete native Garantien brauchen native
Tests; Fake-Transport reicht dafür nicht.

Er meldet belegte Fehler sofort an den zuständigen Writer, ändert aber keinen Produktcode.
Bekannt noch unverdrahtete Funktionen werden als offene Implementierung eingeordnet,
nicht als überraschender neuer Defekt. Reine Risiken bleiben von reproduzierten Fehlern getrennt.

**Lieferwert:** reproduzierbare Befunde und unabhängig tragfähige Regressionstests.
Nach der Integration wird auf den neuen festen Kandidaten re-reviewed; ein sauberer
Review des alten b3-Snapshots ist keine automatische Freigabe späterer Änderungen.

### P06 — Wirklich spielen und messen, statt noch mehr grüne Teilstatistiken sammeln

Dokument: `06_AGENT_P06_BROWSER_EVIDENCE.md`

Zuerst einmal den realen normalen BodyBox384-Ablauf am festen b3-Stand ausführen:
echter Input, wirklicher Parent/Hit, native Stage, Applied und bestätigte
Renderübernahme. Bei Scheitern den ersten blockierten Abschnitt samt Quellenbindung
an A0 liefern. Keine Zustandsinjektion oder versteckte Resume-Abkürzung.

Die vorhandene Suite definiert sieben Varianten: Quarry Box/Sphere, Rock Arm sowie
Body Box/Sphere jeweils Moving/Sleeping. Die vollständige Messpopulation hat pro
Variante und Cold/Warm jeweils 100 Zielversuche über 34/33/33 Sitzungsversuche.
Das ergibt **1400 Zielmessungen**, zuzüglich Setup und Warmup, nicht 1400 beliebige
gesammelte Events. Die Suite bezeichnet „Cold“ als neues Dokument/neue Worker;
das ist nicht automatisch ein neuer Browserprozess oder leerer OS-Diskcache. [S17]

Die eigentliche 1400er-Serie beginnt erst, wenn A0 einen funktionsfähigen, eingefrorenen
Kandidaten liefert und die Gates tragfähig sind. Ein exklusives Referenzgerätefenster
verhindert Messungen gleichzeitig mit Volltests, Builds oder konkurrierenden Browsern.
Remote-Agenten können währenddessen weiter lesen oder auf anderen Geräten arbeiten.

**Lieferwert:** getrennte Input→Applied-, Input→Render-, Apply→Render-, Hold-,
Slice-, Timer-/Frame- und Speicherbelege, inklusive aller Fehler/Not-Run/Drops.
Die vorhandene Windows-/Chrome-/GPU-/Power-Bindung wird nicht still durch ein
anderes Profil ersetzt. K34 benutzt eine getrennte Population/Ansicht und bleibt getrennt.
Der ältere vollständige Katalog der zwölf visuellen Fälle liegt dieser Planung nicht
vor; niemand darf zwölf neue Namen erfinden und das als Erfüllung des Originals ausgeben.

## 6. KISS und „performanteste Lösung“ als überprüfbare Forderung

Die belastbare Forderung lautet:

> Für definierte Quellen, Geräte, Qualitäts- und Speichergrenzen die schnellste
> nachgewiesene korrekte Variante wählen; bei praktisch gleichem Ergebnis den
> einfacheren Code behalten.

Ein absoluter Optimalitätsbeweis über alle denkbaren Implementierungen ist durch
ein paar Benchmarks nicht gegeben. Agenten sollen deshalb keine solchen Behauptungen
abgeben und nicht beliebig viele Architekturen bauen, um das Wort „optimal“ zu erfüllen.

| Gate aus dem Checkpoint | Unverändert |
|---|---:|
| Reales Input→Applied / Input→Render p95 | jeweils höchstens 250 ms |
| Echter Body-World-Hold p95 | höchstens 50 ms |
| Slice p95 / maximale zusammenhängende Arbeit | 4 ms / 8 ms |
| Vorbereitungsbedingte Timerlücke | nicht über 20 ms |
| CPU / Mesh | 268435456 B / 134217728 B |
| Dreiecke / Draw Calls | 500000 / 300 |
| Prepare / Output | 96 MiB / 8 MiB |
| Schwere Jobs / Queue / optionale Diagnose | 2 / 32 / insgesamt 512 KiB |

Ein Reject ist kein schneller erfolgreicher Schnitt. Aufwendige Arbeit nur in
einen anderen Thread zu verlagern ist nicht automatisch weniger Arbeit.
Inputlatenz, Framezeit, nativer Hold, Durchsatz und temporärer Speicher sind
verschiedene Größen. Ein zusätzlicher Cache kann Arbeit sparen und zugleich
das Coexistence-Budget verletzen. Ein Yield nach einer langen Funktion macht
die Funktion selbst nicht bounded. Diese Gegensätze müssen in den Berichten sichtbar bleiben.

Keine Cap-/Timeout-Erhöhung, keine schlechtere Kollisionsgeometrie, keine heimliche
Voxelvergröberung und keine Abschwächung der öffentlichen Semantik werden als Optimierung akzeptiert.

## 7. Start- und Integrationsfolge

**Schritt 1:** A0 erhält die Übergabekarte. P05/P06 können gleichzeitig isoliert lesen
bzw. diagnostizieren. P02/P03/P04 können ebenfalls Quellen, Referenzen und Bildvergleiche
vorbereiten. P01 beginnt die Kernanalyse ohne konkurrierenden Produktschreibzugriff.

**Schritt 2:** Nach der knappen Dateiabgrenzung laufen P02/P03/P04 als drei voneinander
getrennte Writer. P01 schreibt erst nach der ausdrücklichen Zwei-Dateien-Übergabe.
Alle sechs Agenten besitzen eigene Branches, Testdateien und Dokumentationspfade.

**Schritt 3:** A0 übernimmt fachlich angenommene kleine Kandidaten. P01 wird am
vereinbarten Kernvertrag integriert; P02/P03 werden mit Source-/Mesh-/Verhaltensparität
eingebunden. Für P04 wird bewusst entschieden, ob der Look in denselben Messkandidaten
kommt oder separat bleibt.

**Schritt 4:** B1 normaler Body-Gegenbeweis und Restgates, dann B2 Terrain, dann B3
gemäß bestehendem V3-Auftrag. Kein paralleler Vollumbau des Terrainpfads, während
A0 noch den gemeinsamen Transaktionsvertrag ändert.

**Schritt 5:** Geprüfter Kombinationsstand einfrieren, P05-Re-Review, vollständige
kombinierte funktionale Tests, P06-Messpopulation und Bild-/Gameplaymatrix.
Änderungen nach dem Freeze benötigen neue Bindung/Nachweise für betroffene Claims.
Ein rein dokumentarischer Folgecommit muss dagegen keine identischen Produktbytes
künstlich als neuen Benchmark darstellen.

**Schritt 6:** Owner entscheidet über Art/Integration. Der Plan erteilt keinen
Main-Merge, keine Veröffentlichung eines spielbaren Releases und keine automatische Abnahme.

## 8. Was jetzt ausdrücklich nicht parallel gestartet wird

Keine zweite V3-Gesamtimplementierung, kein zweiter Budgetmanager, kein weiterer
nativer World-Owner, kein allgemeiner Engine-/Raymarcher-/WebGPU-/WASM-Umbau.
Auch kein neues Save-, Missions- oder Salvagesystem neben dem vorhandenen.

Kein größerer Pflanzen-Source-/Saveversionswechsel während dieser Paritätsrunde.
Keine globale Planetengenerierung, kein Settlement-/Narrative-Repo-Bootstrap und
kein früher blockierter R01-Core-Auftrag allein aufgrund überschüssiger Quota.

Der gelesene allgemeine Content-Cache enthält zwar Kopier-/Sortierarbeit. Ohne
Nachweis, dass diese den jetzigen Spielerflow relevant begrenzt, wird daraus
absichtlich kein siebter Optimierungsauftrag gemacht. Das Ziel ist weniger
blockierende Arbeit und echte Spielbarkeit, nicht möglichst viele geänderte Dateien.

Nach dem funktional und technisch angenommenen V3-Stand ist der nächste **inhaltliche**
Schritt ein konkreter größerer, visuell referenzierter Interaktionsabschnitt
(zum Beispiel ein originalgetreuer Wurzel-/Baumbereich mit nachgewiesenem realem
Schnitt-/Fall-/Recut-Verhalten). Dafür braucht es eine eigene Source-/Save- und
Budgetentscheidung. Diese Planung behauptet nicht, das bereits freigegeben zu haben.

## 9. Quellen

S1. [Bereitgestellter Checkpoint im Repository](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/docs/browser-mainline/hestia-cut-rt-v3-checkpoint-2026-10-02.md), 2. Oktober 2026; lokale Originalkopie im Paket.
S2. [Historischer Mainline-Status](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/docs/current-mainline-state.md).
S3. [Living Master Plan, ausdrücklich Planungsindex](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/docs/roadmap/living-master-plan.md).
S4. [Playable-Prototype-ExecPlan](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/docs/architecture/hvp-playable-prototype-execplan.md), gelesener Anfang mit Ziel und historischen Paketständen.
S5. [Owner-Body-Cut-Session](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/physics/bodyCutSession.ts).
S6. [Compiler-Body-Cut-Job](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/workers/hvpBodyCutJob.ts).
S7. [Structural-Plan](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/physics/structuralPlan.ts).
S8. [Owner-lokale Mesh-Admission](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/presentation/bodyMeshAdmission.ts).
S9. [Klassifikationsschritte](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/voxel/structural/classificationSteps.ts).
S10. [Vegetation](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/presentation/vegetation.ts).
S11. [HVP-SaveStore](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/persistence/saveStore.ts).
S12. [Bergungsloop](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/gameplay/salvageLoop.ts).
S13. [Player-Darstellung](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/player/presentation.ts).
S14. [HVP-Kamera](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hvp/hvpCamera.ts).
S15. [Lookprofil](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/presentation/look.ts).
S16. [Visuelle Effekte und Wasser-Shader](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts).
S17. [Bestehende Cut-RT-Messsuite](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/tests/performance/hvp-cut-rt.spec.ts).
S18. [Gepinnte Toolchain und Skripte](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/package.json).
S19. [Occupied-Entry-Cursor und Sort-/Freeze-Restarbeit](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/voxel/structural/occupiedEntries.ts).
S20. [Save-Profil und strikte Look-ID-Bindung](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/b3c6523a94cd050f5a9a22dc27f4777fcc03363e/apps/weltraum-browser/src/hestia-prototype/persistence/gameCheckpoint.ts).

Zusätzliche private Projektquellen: `01_Hestia_Visual_Design_Language_v1.md`,
gelesene Worldgen-/Authoring- und Konfliktregisterabschnitte sowie abrufbare
Projektchat-Rückblicke. Die Visual Language wurde nicht vollständig als Originalpixel-
Paket geprüft. Für den genauen Leseumfang und die offenen Quellen siehe
`07_PRUEFUMFANG_UND_QUELLEN.md`.

Dieser Plan enthält keine selbst ausgeführten Produktbenchmarks. Alle neu formulierten
Paketgrenzen und Empfehlungen sind Planung, nicht nachträglich behauptete Owner-Entscheidungen.
