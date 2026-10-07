# Hestia Cut RT V3: vollständiger Ausführungsauftrag

**Stand:** 23. September 2026  
**Empfänger:** ein primärer Ausführungsorchestrator mit unabhängig prüfenden Worker-Sessions  
**Ziel:** Review, notwendige Fixes, reale Cut-Performance, technische visuelle Qualität, Save/Recovery und einen kleinen zweiten Kernverbraucher in einem zusammenhängenden Auftrag liefern.  
**Arbeitsbasis:** `BenjaminHornung/Weltraum-Spiel@f2ee73cfbfa80b6c09d540c784d3ad426ae83a04`  
**Ergebnis:** getesteter Feature-Branch, belastbare Rohdaten, technische Abnahme und genau ein abschließender Owner-Handoff. Kein automatischer Main-Merge.

> Für den Orchestrator: Dieses Dokument ist Spezifikation, Entscheidungsspielraum, Arbeitsplan und Promptbibliothek in einer Datei. Nach ausdrücklicher Übergabe als Ausführungsauftrag interne Entwürfe, Reviews, Korrekturen und Folgephasen selbst koordinieren. Nicht nach jedem Gate zum Menschen zurückkehren. Nicht erneut nur einen Reviewerprompt liefern.
>
> Die Ziele unten sind Abnahmekriterien, keine Zusage bereits erreichter Laufzeit. Fehlende Evidenz darf nicht durch erfundene Ergebnisse ersetzt werden. Die Erstellung dieses Dokuments hat keinen Produktcode geändert oder den Gesamt-Review ausgeführt.

## 0. Sofort starten, nicht erneut ein Übergabepaket schreiben

Lies das gesamte Dokument einmal. Danach:

1. Reale Source und Befugnisse gemäß Abschnitt 1 binden.
2. Den unabhängigen Startreview selbst starten, offene konkrete Befunde reproduzieren und beheben.
3. Fehlende Messgrenzen ergänzen, größte reale Kosten reduzieren und notwendige kooperative Terrain-/Body-Vorbereitung implementieren.
4. Technische visuelle Fehler und Recovery-/Ownershipfehler schließen; den kleinen headless Reuse-Verbraucher mitliefern.
5. Auf der integrierten finalen Source alle geforderten Prüfungen einschließlich formaler Zielmessung ausführen.
6. Ergebnisse und Feature-Branch liefern. Menschliche Art-Direction- und Main-Merge-Entscheidung ausschließlich am Ende offen ausweisen.

Ein großer Auftrag bedeutet **nicht** ein unkontrollierter Großdiff oder ein einziger Commit. Die folgenden Karten sind interne Arbeitseinheiten. Ihre Freigabe erteilt innerhalb des beschriebenen Scopes der Orchestrator nach unabhängiger Prüfung, nicht der Nutzer in einer weiteren Chat-Runde.

### Einmaliger Aktivierungstext

```text
Führe HESTIA_V3_GESAMTAUFTRAG.md vollständig aus.
Ich gebe den dort abgegrenzten Implementierungs-, Mess-, Review- und
Reuse-Scope einschließlich der neuen internen Vorbereitung und der
benannten Diagnosefelder frei. Starte unabhängige Reviewer selbst.
Lokale Branches/Commits und normale Pushes auf den neuen V3-Feature-
Branch sind erlaubt. Keine PR, kein Main-Merge, kein Force-Push.
Die im Auftrag ausdrücklich supersedierten alten Zwischenfreigaben
sind keine erneuten Rückfragepunkte. Technische und visuelle Gates
intern abarbeiten; nur echte Scope-/Zugriffsblocker oder die finale
menschliche Abnahme an mich geben.
```

Ein bloßer Download ist keine Toolfreigabe. Der vorstehende Text zusammen mit diesem Dokument ist dagegen der vollständige Ausführungsauftrag. Bestehende Plattform-/Repositoryschutzmechanismen nicht umgehen.

## 1. Mandat, Scope und Supersession

### 1.1 Einmal freigegebener Scope

Die Ausführung darf innerhalb dieses Auftrags:

- den noch fehlenden unabhängigen Code-/Evidence-Review starten;
- reproduzierte Defekte in den Cut-, Restore-, Observability-, Renderer- und Ressourcenpfaden korrigieren;
- Diagnosefelder für konkrete Kernelphasen, echte Terrain-/Body-Haltezeiten und Arbeitsscheiben implementieren, streng begrenzt nach Abschnitt 6;
- nachgewiesene überflüssige Vollableitungen und Kopien beseitigen, ohne Prüfgarantien zu streichen;
- reine Kernalgorithmen semantikgleich optimieren und bei Bedarf in kooperative Cursor zerlegen;
- ephemere interne Main-/Worker-Protokolle und Request-/Reply-Typen für kooperative Vorbereitung ändern, sofern beide Enden gemeinsam umgestellt, nach Reinitialisierung alte Nachrichten abgelehnt und persistente Formate unverändert bleiben;
- Terrain- und Body-Vorbereitung außerhalb des mutativen World-Holds ausführen, jedoch nur mit tatsächlich kurzen Arbeitsscheiben und unverändert atomarem Stage/Commit/Finalize;
- den in Abschnitt 11 definierten kleinen TD-Begehbarkeitsverbraucher implementieren;
- existierende Tests erweitern und erforderliche neue Tests, Runnerkonfigurationen und begrenzte testinterne Fehlerhaken ergänzen;
- normale Feature-Commits erzeugen, integrieren und ohne Force veröffentlichen;
- neue bereinigte Evidence veröffentlichen, deren Scope und Inhalt vorher geprüft wurden. Historische Rohberichte bleiben unverändert.

### 1.2 Ausdrücklich ersetzte alte Ablaufstopps

| Frühere Anweisung | Gilt in V3 stattdessen |
|---|---|
| Reviewer nur manuell vorbereiten, nicht starten | Orchestrator startet frische unabhängige Reviewer selbst. |
| Nach Intake/Rebind stoppen | Nach geprüftem Rebind im freigegebenen Scope implementieren. |
| Jeder konkrete Fix benötigt neue Ownernachricht | Reproduzierte, scopekonforme Fixes sind mitfreigegeben. |
| P00-D/Body-Hold-Spans generell vertagt | Die begrenzten Felder und Speicherregeln aus V3 sind freigegeben. Kein beliebiges Telemetriesystem. |
| Kooperativer Folgeplan ist nur Planung | Die hier konkretisierten Terrain-/Body-Verträge sind zur Umsetzung freigegeben, nach internem starkem Designreview. |
| R01 grundsätzlich noch kein Write | Genau der kleine zweite Verbraucher nach Abschnitt 11 ist freigegeben. |
| Große Messserie nicht starten | Nach erfolgreichem internem Qualifikationslauf die formale Serie selbst starten. |
| Vor jedem Paket erneut stoppen | Bei erfülltem internen Gate ohne menschliche Zwischenbestätigung weiterarbeiten. |

**Nicht supersediert:** Exaktheit, Single-Owner, stale rejection, Rollback, RecoveryHold, Save-Kompatibilität, Goldens, Caps, Privacy, Least Privilege, unabhängige Reviews, die menschliche finale Art-Direction-Entscheidung und das Main-Merge-Verbot.

Das alte P06 darf weiterhin nicht blind ausgeführt werden. Seine bekannte synchrone Rezeptverlagerung ist keine Lösung. V3 ersetzt diesen Implementierungsansatz durch eine geprüfte kooperative und rechenärmere Vorbereitung. Ein neuer Dateiname oder eine vorgezogene Pause ändert keine Laufzeitkosten.

### 1.3 Nicht im Scope

Kein vollständiges TD-/RTS-Spiel, kein allgemeines ECS-, Plugin-, Content-, Editor-, NPC-, Economy- oder Netzwerkframework. Kein Enginewechsel, Rapier-Upgrade, WASM-Threading-/SharedArrayBuffer-Umbau, GPU-Authority, gröbere Collider, Physik-LOD oder neues Saveformat. Keine Änderung der Grafikqualität, Zellgröße, Kamerapresets, Simulationsschritte oder Caps zum Bestehen der Messung. Kein Plannotator. Keine neue Modellstudie oder globale Agentenkonfiguration.

Der Orchestrator darf bestehende Implementierungsdetails selbst entscheiden. Die genannten Ausschlüsse darf er nicht als technische Nebenentscheidung umgehen. Notwendige Änderung außerhalb dieses Korridors wird als konkreter Restblocker ausgewiesen, während unabhängige zulässige Arbeiten fertiggestellt werden.

### 1.4 Versionskontrolle und Umgebung

Arbeite vorzugsweise auf einem neuen Branch:

`feature/hvp-cut-rt-v3-completion-2026-09-23`

Ausgangspunkt ist die volle f2ee-SHA. Existiert der Branch bereits, anhand des Journals feststellen, ob dies derselbe Auftrag ist, und dann fortsetzen. Keinen fremden Branch überschreiben. `main` und der veröffentlichte V2/EV01-Verlauf bleiben unangetastet.

Ein eigener isolierter Checkout/Worktree ist erlaubt, sofern keine fremden Arbeitskopien umgeschaltet, bereinigt oder konfiguriert werden. Kein Reset/Stash/Clean fremder Arbeit. Gemeinsame Gitmetadaten und globale Providerkonfigurationen nicht während paralleler Sessions verändern. Normale Pushes nur auf eigene V3-Arbeitsbranches; kein Force, kein PR, kein Merge nach Main, kein Deployment und kein Release.

Gepinnte bestehende Dependencies dürfen aus dem vorhandenen Lockfile installiert werden. Keine Versionen aktualisieren. Fehlende Toolberechtigung, Authentisierung oder Freigabe bleibt eine echte Zugriffsgrenze; nicht umgehen. Ein aktiver geschützter Messlauf hat Vorrang vor anderen lokalen Builds.

## 2. Ausgangswahrheit und Quellen

### 2.1 Fixierte Bindungen

| Rolle | Volle SHA |
|---|---|
| Ursprüngliche Cut-Codebasis | `9341fb906383515057e659a99e16a381632f2bea` |
| Alter Main-Merge und ursprüngliche R00-Referenz | `25bc7f5bbd2db6317c42193873eadeaf10a092c5` |
| Cut-RT-V2-Codekandidat | `45188b2b90049f496e918b8701a314c883792ce5` |
| V2-Code-Tree | `74cd849977333fa4014501d5b6c34cd1b2fcda50` |
| EV01 und V3-Ausgangspunkt | `f2ee73cfbfa80b6c09d540c784d3ad426ae83a04` |
| EV01-Tree | `3cd735e701127d04e61fdea571105b188b32ff63` |

Bei Erstellung wurde der Branch-Ref über GitHub auf f2ee gebunden. Eine spätere Branchbewegung nicht still als neuen Startstand verwenden. Wenn ein anderer Orchestrator bereits Folgecode geschrieben hat, seine unveränderte Source und Leases zuerst aufnehmen; zulässige unabhängige Lesearbeit fortsetzen, aber keinen Misch-Snapshot implementieren.

### 2.2 Vorhandene Befunde, keine neuen eigenen Testergebnisse

Der Autorenbericht meldet: V2-Gesamtrun 2343/2343 nach separat erhaltenem Timeout-Fail, 4/4 Restore-Flows, 14/14 diagnostische Fälle. EV01 ergänzt 14 Statusdateien; erwartet sind 255 Manifestpayloads. Diese 14 Statusdateien sind keine zusätzlichen Schnittversuche.

Die veröffentlichte P07-Diagnosematrix nennt folgende **Einzelmessungen**, jeweils n=1 pro Variante/Temperatur:

| Variante | Cold Input→Applied ms | Warm Input→Applied ms |
|---|---:|---:|
| Quarry Box | 272,3 | 246,6 |
| Quarry Sphere | 313,4 | 231,3 |
| Rock arm | 1870,9 | 2086,1 |
| Body Box moving | 2924,6 | 2628,9 |
| Body Box sleeping | 2983,6 | 3510,1 |
| Body Sphere moving | 3658,7 | 3358,1 |
| Body Sphere sleeping | 3286,4 | 3102,3 |

Weitere veröffentlichte Diagnose: Rock-arm Cold Support 1283,1 ms, Compile 177,9 ms, native Prepare 242,5 ms, Rezept 230,0 ms, Terrain-Hold 357,7 ms. Im Folgeplan werden 0,7 ms Terrain-Cooking und etwa 1631,8 ms für einen StageBodyCut-Handler genannt. Phasen können überlappen. Body-Hold ist damit nicht gemessen.

Keine Regression gegen die viel älteren 1667 ms behaupten, ohne gleiche Source, Fixture, Hardware, Browser und Messgrenze zu belegen. Keine Subphasen durch Subtraktion überlappender Spans erfinden. Die Tabellenwerte begründen Profiling und Verbesserung, keinen bereits bewiesenen p95.

### 2.3 Pflichtlektüre am gebundenen Commit

```text
AGENTS.md
README.md
docs/current-mainline-state.md
docs/research/hvp-cut-rt/P00-RESULT.md bis P07-RESULT.md, soweit im Tree vorhanden
docs/research/hvp-cut-rt/P07-DIAGNOSTIC-MATRIX-01.md
docs/research/hvp-cut-rt/CUT-COOPERATIVE-FOLLOWUP-PLAN.md
docs/research/hvp-cut-rt/R00-SOURCE-LEASE-GATE-2026-09-22.md
docs/research/hvp-cut-rt/EV01-EVIDENCE-PUBLICATION-CORRECTION.md
apps/weltraum-browser/evidence/hvp-cut-rt-v2/README.md
apps/weltraum-browser/evidence/hvp-cut-rt-v2/MANIFEST.json
apps/weltraum-browser/package.json
apps/weltraum-browser/playwright.performance.config.ts
```

Danach tatsächlichen Produktdiff und seine notwendigen Abhängigkeiten lesen. Keine Komplettlektüre sämtlicher älterer G-Berichte verlangen. Die alten G-Berichte sind Research an älteren Quellen, kein Auftrag zum Bau aller dort beschriebenen Systeme. Historische 0,25-m-Lab-Profile ersetzen hier nicht den 0,125-m-HVP-Vertrag.

Lokale R00-Ergebnisse sind hilfreiche Eingaben, keine neue Blockade:

```text
C:\IFI_SourceCode\Utils\npm-tmp\opencode\core-reuse-r00-output-20260922-25bc7f5b-7c18
C:\IFI_SourceCode\Utils\npm-tmp\opencode\hestia-post-push-intake-20260923\R01-REBIND-DRAFT.md
```

Nur tatsächlich lesbare Dateien verwenden. Liegt der lokale R01-Draft nicht vor, den vollständig abgegrenzten Fallback aus Abschnitt 11 direkt an die tatsächliche API binden. Keine Inhalte lokaler Dateien erfinden und keinen erneuten R00-Forschungsauftrag starten.

### 2.4 Inhaltlich geprüfte Sourceanker bei Erstellung

Alle Pfade in dieser Tabelle sind relativ zu `apps/weltraum-browser/`. Symbolnamen sind die dauerhaften Suchanker; Zeilen gelten nur an f2ee. Nach jeder Änderung zuerst tatsächliche neue Signaturen lesen.

| Datei / Bereich | Tatsächlicher Anker | Bedeutung für V3 |
|---|---|---|
| `src/voxel/adaptive/materialization.ts:225–360` | `MaterializeAdaptiveBrickInput`, `materializeAdaptiveBrick` | Editweise Boxmaterialisierung ist bereits da. Nicht P02 noch einmal implementieren. |
| `src/hestia-prototype/terrain/structuralIngest.ts` | `ingestHvpStructuralCells`, Phasen `ingestSortRunsMs`, `ingestJournalMs`, `ingestMaterializeMs`, `ingestProofsMs`, `ingestStructuralMs` | Vorhandene Zerlegung für gezielte Kostenmessung; ganzer Aufruf noch synchron. |
| `src/hestia-prototype/physics/rigidRecipe.ts` | `prepareHvpRigidBody`, `admitHvpTransferredRigidBody`, `hvpRigidColliderBoxes` | Transferzulassung existiert bereits. Masse, Connectivity, Coverage und kanonische Colliderreihenfolge nicht streichen. |
| `src/hestia-prototype/physics/terrainFragment.ts` | `prepareHvpTerrainFragment` | Ingest plus exakte native-ownerlokale Admission aus transferierten Angaben. |
| `src/hestia-prototype/physics/session.ts:307–352` | `advance`, `pause`, `resume`, `beginBodyCut`, `stageBodyCut` | `moving.busy` und `moving.holdsWorld` bereits getrennt; Stage pausiert vor lokaler Ableitung. |
| `src/hestia-prototype/physics/session.ts:372–470` | `prepareTerrain`, `commitTerrain`, `rollbackTerrain`, `finalizeTerrain` | Rezeptbildung erfolgt nach `tick.pause`; getrennte Rezept-/Cook-/Install-/Holdwerte existieren. |
| `src/hestia-prototype/physics/bodyCutSession.ts` | `begin`, `stage`, `commit`, `rollback`, `finalize` | Stage ruft aktuell `prepareHvpBodyCut` erneut auf und vergleicht Produkte mit eigenem Plan. |
| `src/hestia-prototype/physics/bodyCut.ts` | `captureHvpBodyHit`, `prepareHvpBodyCut`, `stageHvpBodyCut` | Hits/Plans besitzen lokale Ausstellungsnachweise. Native Pose und Impuls erst beim Stage lesen. |
| `src/hestia-prototype/physics/bodyCutPlan.ts` | `readHvpBodyCells`, `prepareHvpLocalBodyCut` | Source-gebundener Cell-Cache, eigener Removed-Mass-Pfad und exakte Brush-Semantik. |
| `src/voxel/structural/massProperties.ts:73–205` | `canonicalAddresses`, `derive` | Adressierung, geordnete Traversierung und Massenzellen. Ein kompletter Optimierungsnachweis erfordert weitere Sourcelektüre. |
| `src/hestia-prototype/physics/physicsWorker.ts` | `HvpPhysicsMessage`, `HvpPhysicsReply`, `port.onmessage`, Timer | Neue Asynchronität braucht Reentranzschutz und Snapshotordnung; heutige lange Handlerzeit ist nicht reine CPU-Zeit. |
| `tests/performance/hvp-cut-rt.spec.ts:1–120,298–Ende` | `variants`, `classification`, `schedule`, `processInfo`, `profile` | Vorhandener produktiver Runner und 34/33/33-Schedule werden erweitert, nicht dupliziert. |

Weitere mandatory Callsitelektüre vor Änderung: `terrainProducts.ts`, `terrainConsumer.ts`, `bodyCutConsumer.ts`, `supportPlan.ts`, `structuralPlan.ts`, `structuralBreak.ts`, `client.ts`, `runtime/cutTrace.ts`, `hvpBodyCutJob.ts`, `hvpSupportJob.ts`, `workerPool.ts`, `streamingWorker.ts`, `hvpBootstrap.ts`, betroffene Save-/Residencypfade und bestehende Tests. Wo bei Erstellung keine vollständige Lektüre erfolgte, ist damit keine Signatur oder Testbehauptung erfunden.

## 3. Verbindlicher Zielvertrag

### 3.1 Herkunft der Ziele

**Geerbt:** echter Input→Applied p95 ≤ 250 ms, exakte 0,125-m-Geometrie, bestehende Caps/Goldens/Source-/Save-/Native-Garantien.

**Neu für diesen V3-Auftrag vorgeschlagen und bei Aktivierung verbindlich:** zusätzliche Render-, Hold-, Arbeitsscheiben-, technische Visual-, Reuse- und Codequalitätsgates in den folgenden Tabellen. Keine dieser neuen Zahlen ist ein bereits gemessener Wert oder eine Aussage über alle zukünftigen Spiele.

### 3.2 Leistungs- und Funktionsziele

| ID | Gate | Abnahmebedingung |
|---|---|---|
| G-P01 | Echter Schnitt | p95 Input→Applied ≤ 250 ms **für jede** der sieben Varianten, Cold/Warm getrennt. Kein Pooling langsamer mit schnellen Klassen. |
| G-P02 | Bestätigte Darstellung | p95 Input→erste zur bestätigten Generation passende Render-Submission ≤ 250 ms je derselben Klasse. Keine Vorschau als Ergebnis. |
| G-P03 | Nachlauf Darstellung | p95 Applied→bestätigte Render-Submission ≤ 33,34 ms; negative oder falsch gebundene Werte sind Messfehler. |
| G-P04 | World-Hold | p95 echte transaktionsbedingte Terrain- und Body-Haltedauer ≤ 50 ms je betroffener Klasse; exakt gemessene Start-/Endpunkte, nicht Handlerdauer. |
| G-P05 | Kooperative Arbeit | Neue zerlegbare Source-/Rezept-/Validierungs-/Packschleifen: p95 zusammenhängende Arbeitsscheibe ≤ 4 ms, maximale gemessene eigene Scheibe ≤ 8 ms auf Referenzgerät. Ganze nicht unterbrechbare Unterfunktionen zählen mit. |
| G-P06 | Physics-Liveness | Keine bestätigte rezeptbedingte Timerlücke > 20 ms in kontrollierten Vorbereitungsdiagnosen. Tatsächliche Intervalle erfassen, nicht nur das bisherige >60-ms-Ausreißerlog. Unklare Ursachen als unklar führen. |
| G-P07 | Sichtbare Frame-Stabilität | Im Fenster vom Input bis 2 s nach bestätigter Darstellung: p95 Frameabstand ≤ 20 ms, p99 ≤ 33,34 ms; kein reproduzierbarer durch den Schnitt verursachter Freeze >100 ms. Auswertung getrennt von instrumentierten Captureläufen. |
| G-F01 | Funktion | Alle regulär geplanten Cuts erfüllen ihre echten Preconditions, enden Applied und besitzen korrekte Source-/Native-/Renderbindungen. Fehlerfälle in der separaten Negativmatrix enden genau wie vorgeschrieben. |
| G-F02 | Integrität | Kein verändertes bestehendes kanonisches Byte-/Hash-/Save-/Massentoleranz-Golden. Keine Phantomkörper, kein Materialverlust und keine fehlerhaft akzeptierten stale Ergebnisse. |
| G-F03 | Erholung | Für jede geprüfte Fehlergrenze ist alter oder neuer vollständiger Zustand nachgewiesen; bei nicht beweisbarer Erholung bleibt RecoveryHold sticky und sichtbar. |

G-P07 ist ein Frameabstandsvertrag, keine aus wenigen FPS-Werten berechnete Behauptung „konstant 60 FPS“. OS-/GPU-Ausreißer werden nicht verschwiegen. G-P05/G-P06 sind eigene Diagnosegates; ihre detaillierte Instrumentierung darf die saubere formale Serie nicht künstlich verlangsamen oder deren Ergebnis ersetzen.

### 3.3 Unveränderte Ressourcenlimits

| Ressource | Obergrenze |
|---|---:|
| Gameplay-CPU-Budget nach bestehendem Ledger | 256 MiB |
| Meshbudget | 128 MiB |
| Dreiecke | 500.000 |
| Draw Calls | 300 |
| Prepare-Reservierung | 96 MiB |
| Gleichzeitig schwere Compilerjobs im vorhandenen Pool | 2 |
| Poolqueue | 32 |
| Bestehende optionale Observer-Reservierung | 512 KiB, nicht zusätzlich 512 KiB pro neuer Funktion |
| Existierende native/cell/fragment/Collider-Admittance | unverändert aus aktuellen Validators übernehmen |

Die Physics-Owner-Session bleibt eine einzige; kein zusätzlicher Solverworker. Neue Diagnose- und Cachespeicher innerhalb der vorhandenen Gesamt- und Coexistencebilanz unterbringen. Ein HashCache mit scheinbar kleinen Metadaten darf keine großen Sources unbegrenzt halten. Ein Heap-Screenshot ist ergänzende Diagnose, kein Ersatz für nachvollziehbare kontrollierte Bytebudgets.

### 3.4 Codequalität

Null bestätigte offene Blocker oder Major-Defekte im finalen unabhängigen Scope-Review. Typecheck, Build, betroffene Tests und finale Vollsuite bestehen. Vorhandene Timeouts, Fehleroracles und Goldens nicht lockern. Kein `any`-/`as unknown as`-Bypass für Protokollzulassung, keine unterdrückte Runtimeprüfung, kein leerer Catch zur Erfolgsbehauptung.

Neue Module haben je eine fachliche Verantwortung. Kein Universal-Manager, keine neue Eventbus-/Scheduler-/Serializerbibliothek. Keine Hashing-/JSON-/Clone-Vollrunde im per-Zelle-Loop. Der Reviewer verlangt für jeden größeren neuen Hot-Path-Container Anzahl, Byteobergrenze, Owner, Aliasregeln und Freigabepunkt. Keine LoC-Quote, die durch unlesbare Einzeiler erfüllt werden kann.

### 3.5 Status bei nicht erreichter Abnahme

Ein Ziel wird bei Überschreitung **nicht angepasst**. Ein vollständiger gültiger Messlauf über dem Grenzwert heißt `TARGET_NOT_MET`; ein fehlender oder ungültiger Nachweis heißt `NOT_PROVEN`. `TECHNICAL_COMPLETE` erfordert sämtliche scopezugehörigen technischen Gates. Menschliche Schönheit/Art Direction heißt separat `OWNER_VISUAL_PENDING`, bis Benni die finalen Aufnahmen tatsächlich akzeptiert.

Ein technisch kompletter Kandidat kann zur einmaligen finalen menschlichen Abnahme geliefert werden. Ein Kandidat mit fehlender Referenzhardware oder nicht erreichtem Ziel wird als getesteter Zwischenstand geliefert, nicht als erledigter Gesamtauftrag. Ein internes „grün“ eines Workers ersetzt keine dieser Bedingungen.

## 4. Orchestrierung ohne Rückfrageschleife

### 4.1 Rollen

Ein primärer `orchestrator-alternate` besitzt das Arbeitsjournal und die Integration. Ausschließlich `worker-alternate` für delegierte Implementierung, Tests und unabhängige Reviews. Kein zweiter Orchestrator und keine rekursive Delegation aus einem Worker.

Die vorhandenen bestätigten Rollenprofile weiterverwenden: starke Orchestrator-/Reviewerroute aus V2, bevorzugt dort als `gpt-6-astra`/`max` gebunden, dokumentierter `gpt-5.6-sol`/`max`-Ersatz; mehrdateilige Implementierung über das bestätigte `muse-spark-1.3`/`max`-Profil; `gpt-5.6-luna`/`max` nur für vollständig determinierte Reporter-/Fixturehilfen. Dies sind die geerbten Harnessbezeichnungen, kein neuer Herstellervergleich oder eine Behauptung, jeder Provider unterstütze dieselben API-Parameter.

Bereits erfolgreiche Modell-/Effortbindung aus dem aktuellen Harnessjournal übernehmen. Nur bei fehlender oder geänderter Route einmal minimal prüfen. Keine neue M00-Studie. Echte Authentisierungs-/Toolbarrieren bleiben sichtbar; Profile nicht still herabstufen. Der schwächere Implementierer entscheidet weder 3D-Frames noch Transaktionssemantik selbst.

### 4.2 Delegierbare Arbeitskarte

Der Orchestrator füllt vor jedem Writerstart **intern**, aus tatsächlichem Code, folgende neun Felder in seinem bestehenden Journal aus:

1. Karte, Basis-SHA, Branch/Worktree und exklusives Write-Set.
2. Aktuelle Symbole, vollständige Signaturen und relevante Datei-/Zeilenanker.
3. Verbrauchte Daten samt Einheiten, Koordinatenraum, Ownership und Version.
4. Exaktes Ergebnis samt Fehlerverhalten und Releasepunkt.
5. Unveränderliche bestehende Oracles und neue Gegenbeispiele.
6. Konkrete Arbeitsschritte, nicht „robust/schnell machen“.
7. Kostentreiber, gemessene Ausgangskosten oder begrenzte Operationshypothese.
8. Tatsächlich ausführbare Tests aus dem vorhandenen Projekt.
9. Vorgänger und Freigabekriterium für die nächste Karte.

Keine neue Benutzerrückfrage für lokal lesbare Fakten. Wenn Codeanker nach einem Fix verschoben sind, selbst nachlesen und aktualisieren. Kein Delegieren mit ungeklärter Masseneinheit, unbekanntem Savevertrag oder erratenem Protokollfeld.

### 4.3 Arbeitsrhythmus

Der Worker liefert einen kurzen Readback: Aufgabe, Source-/Native-/Renderautorität, Einheiten, Fehlerfall, Testoracle, Kosten. Der Orchestrator korrigiert Missverständnisse und erteilt die Karte. Danach Tests, Diffcheck, unabhängiges Review bei Paket-/Vertragsgrenzen, Korrekturen und nächste Karte automatisch.

Ein unabhängiger Reviewer bekommt Originalscope, Fixdiff, aktuelle Source, Tests und konkrete Risiken, nicht nur eine Erfolgsgeschichte des Writers. Er ist eine frische Session und war nicht Writer dieses Diffs. Ein Rollenwechsel desselben laufenden Writers ist kein unabhängiger Review.

Zwei identische erfolglose Reparaturversuche lösen **keine Ownernachfrage** aus. Der Orchestrator lässt eine frische starke Diagnose erstellen und verkleinert oder präzisiert den Patch. Ein generischer Retry mit demselben Prompt ist verboten. Bei fehlendem messbaren Gewinn einer Hypothese Änderung zurücknehmen oder separat verwerfen, dann auf den nächsten belegten Engpass wechseln.

### 4.4 Parallelität

Standard höchstens zwei aktive Implementierungsworker. Mehr nicht erforderlich. Compiler-Runtimeparallelität bleibt unabhängig davon bei zwei.

| Phase | Parallel sinnvoll | Nicht parallel schreiben |
|---|---|---|
| Start | unabhängiger Source-/Evidencereview und reine Runner-/Testinventur | Autorenfixes an der gerade als unverändert geprüften Arbeitskopie |
| Nach Messgrenzen | V3-02 reine Kernarbeit und V3-05 Render-/Aliasarbeit, nach echten freien Pfaden | gemeinsame Bootstrap-/Client-/Traceänderungen |
| Transaktionen | V3-03 Terrain, danach V3-04 Body | beide gleichzeitig an `session.ts`, `client.ts`, `physicsWorker.ts` |
| Reuse | V3-06 nach stabiler V3-02-Grenze neben adapterseitiger Arbeit | Import von lebend mutierenden fremden Source-Dateien |
| Messung | nur ruhige Lesearbeit auf anderem Host | lokale Builds, Browsercapture, weitere Benchmarks oder umfangreiche Scans |
| Finalreview | Review eines eingefrorenen Kandidaten | Integrationsänderungen ohne neue SHA und Delta-Review |

Jede Branchintegration berücksichtigt echte Abhängigkeiten, nicht nur Pfadgleichheit. Divergierte Branches nicht als gegenseitig FF-kompatibel behandeln. Cherry-picks erzeugen neue SHAs; dort die relevanten Prüfungen erneut ausführen. Bereits enthaltene Vorgängercommits nicht doppelt integrieren.

### 4.5 Keine künstlichen Zwischenstopps

Nach `REVIEW_ACCEPTED`, behobenem Defekt, erfolgreichem Rebind oder bestandener Teilmessung selbst weiterarbeiten. Nicht mit „nächster zulässiger Schritt wäre …“ enden, wenn dieser Schritt hier bereits freigegeben ist. Kleine interne Contracts sind Ergebnis des Orchestrators und seines Reviewers, keine neue Ownerentscheidung innerhalb des unveränderten Scopekorridors.

Echte Stopgründe: benötigter Zugriff nicht verfügbar; physische Zielhardware nicht verfügbar; fremde aktive Leases verhindern genau diesen Write; Erfolg erfordert eine ausgeschlossene Semantik-/Engine-/Capänderung; Sicherheits-/Privacyproblem verlangt geschützte Offenlegung. Nur den betroffenen Zweig halten, unabhängige freigegebene Arbeit abschließen und einen einzigen präzisen Restbericht liefern.

Bei Kontextgrenze vorhandenen Harness-Resume mit Journalstand nutzen, sofern das Harness das unterstützt. Kein neues Orchestrierungsframework bauen und keine nicht vorhandene Background-Fähigkeit versprechen. Journal enthält nächste Karte, offene Pfade, laufende Prozess-IDs und letzte geprüfte SHA, damit dieselbe Ausführung weitergeführt werden kann.

## 5. Technische Leitentscheidung: weniger Arbeit plus echte Kooperativität

### 5.1 Was schon existiert, nicht erneut bauen

- Editweise Boxmaterialisierung mit geometrischem Fallback ist im betrachteten Kandidaten vorhanden.
- Übertragene Terrain-Fragmentrezepte werden bereits durch `admitHvpTransferredRigidBody` zugelassen.
- `readHvpBodyCells` besitzt bereits einen Source-Objekt-bezogenen Cache.
- Body-Hits und Pläne werden ownerlokal ausgestellt und geprüft.
- Messrunner, Body-/Terrain-Inputbeobachtung und ein formaler Schedule sind vorhanden.

V3 korrigiert oder erweitert diese Pfade. Es ersetzt sie nicht durch zweite Schattenimplementierungen.

### 5.2 Auswahl einer Optimierung

Pro gemessener langsamer Phase in dieser Reihenfolge entscheiden:

1. Wird unveränderter Besitz/validierte Information innerhalb **derselben Vertrauensgrenze** wiederholt vollständig abgeleitet? Lokale Wiederverwendung prüfen.
2. Besitzt die Implementierung vermeidbare volle Journal-/Objekt-/Zellscans? Lokalere oder indexierte Verarbeitung mit identischem Oracle prüfen.
3. Werden dieselben Sourceprodukte zur Render- und Nativevorbereitung unnötig serialisiert oder kopiert? Besitzerwechsel und die tatsächlichen Decodergrenzen prüfen.
4. Bleibt eine notwendige lange Rechnung? Durch denselben Algorithmus kooperativ und mit stabiler Rechenreihenfolge ausführen.
5. Erst nachgewiesene native Cookingkosten rechtfertigen feinere exakte Colliderprodukte. Kein Hull-/LOD-Ersatz und kein Versionsupgrade.

Yielding alleine verkürzt keine 1,6 Sekunden Rechenarbeit auf 250 ms. Es darf auch nicht so viele Timerwechsel erzeugen, dass das Ende-zu-Ende-Ziel weiter wegrückt. Beide Effekte separat messen. Ebenso senkt Prefetch allein keinen kalten verpflichtenden Pfad.

### 5.3 Erlaubte Wiederverwendung versus unzulässiger Vertrauenssprung

Erlaubt: ein unveränderlicher Sourcezustand in derselben Owner-Session mit exakter Sourceidentität, Material-/Policy-/Algorithmusversion und Lebenszyklusbindung. Cacheeinträge auf unveränderlichen, besitzklaren Daten oder tatsächlich geprüften Objekten aufbauen. Bei Restore, Epochwechsel, Quellenwechsel, Dispose und Algorithmuswechsel invalidieren. Admissionbudgets auch bei einem Cachehit prüfen, insbesondere kleinere vom Aufrufer gesetzte Budgets.

Nicht erlaubt: ein fremdes Workerobjekt wegen passendem Hash in eine lokale WeakSet-Ausstellung aufnehmen; veränderliche Typed-Array-Bytes nur wegen `Object.freeze` als unveränderlich behandeln; höhere Budgets vom letzten Aufruf für einen kleineren Folgeaufruf wiederverwenden; kanonische IDs nach Zeit, Workerfolge oder Cachezustand erzeugen.

### 5.4 Kooperativer reiner Cursor

Kein allgemeiner Scheduler nötig. Für einen tatsächlich langen reinen Kernel ist folgende kleine Form zulässig. Die Namen sind **V3-Entwurf**, keine Behauptung bestehender Exporte:

```ts
export type WorkStep<T> =
  | { readonly done: false }
  | { readonly done: true; readonly value: T };

export interface WorkCursor<T> {
  // Führt höchstens maxUnits definierte kleine Rechenoperationen aus.
  // Keine versteckte vollständige Sourcevalidierung pro advance-Aufruf.
  advance(maxUnits: number): WorkStep<T>;
  // Nur private Scratchdaten freigeben. Ein bereits ausgegebenes Resultat
  // gehört dem Aufrufer und darf dadurch nicht geleert werden.
  // Idempotent und nicht werfend, damit kein Ergebnis/Originalfehler
  // durch die Freigabe im finally überschrieben wird.
  dispose(): void;
}

export interface CooperativeHost {
  now(): number;
  yieldTask(): Promise<void>;
  assertCurrent(): void; // wirft bei Cancel, Dispose oder Sourcewechsel
}

export async function drainCooperatively<T>(
  cursor: WorkCursor<T>, host: CooperativeHost
): Promise<T> {
  try {
    for (;;) {
      host.assertCurrent();
      const started = host.now();
      do {
        const step = cursor.advance(64);
        if (step.done) {
          host.assertCurrent();
          return step.value;
        }
      } while (host.now() - started < 4);
      await host.yieldTask();
      host.assertCurrent();
    }
  } finally {
    cursor.dispose();
  }
}
```

Der Cursor-Macher prüft positive ganzzahlige Workbudgets und validiert den gesamten gebundenen Input vor dessen Nutzung. Große Validierung selbst gehört gegebenenfalls in denselben Cursor. `advance()` auf disposed oder bereits abgeschlossenem Cursor besitzt eine explizite getestete Ablehnung; ein Ergebnis wird genau einmal ausgegeben. `dispose()` darf fremde Eingaben und bereits ausgegebene Resultate nicht ändern. Ein Fehler im Yield-Adapter löst dieselbe Scratchfreigabe wie ein Kernfehler aus.

Dieser Treiber ist nur ein Umsetzungsmuster. 64 Einheiten sind kein garantierter 4-ms-Slice. Vor Übernahme den maximalen Unitaufwand messen und nötigenfalls auf 16/32 verkleinern. Auch die Initialisierung, finale Validierung, Sortierung und Digestbildung müssen einbezogen sein; ein kurzes `advance` mit nachfolgendem 200-ms-Finalizer besteht G-P05 nicht. Endliche Gesamtoperationszahl und Fortschritt jedes Advances prüfen. Exceptions nicht als `done` umdeuten.

Der reine Cursor importiert weder `performance` noch DOM/Worker/Rapier/Hestia. Ein synchroner bestehender Einstieg kann denselben Cursor ohne Yield bis zum Ende treiben. So bleibt eine Kernelimplementierung statt zweier auseinanderlaufender Algorithmen. Reihenfolge von Gleitkommasummen, Sortierung, Fehlerprüfung und kanonischen Bytes darf sich durch Grenzen nicht ändern.

Ein Adapter kann nach Prüfung der gepinnten Laufzeit `scheduler.yield()` verwenden, ansonsten einen vorhandenen echten Task-Yield oder einen kleinen `setTimeout`-Fallback. `await Promise.resolve()`, Microtaskketten und `requestIdleCallback` für zeitkritische Fertigstellung sind keine zugelassene Ersatzstrategie. Ein Promise macht einen vorherigen synchronen Kernel nicht kooperativ. Keine neue Schedulerdependency installieren.

### 5.5 Reentranz und Nachrichtensequenz

Durch `await` kann `port.onmessage` zwischen zwei Teilschritten andere Nachrichten bearbeiten. Deshalb:

- Pendingzustand und zugehörige Besitz-/Versionsbindung **vor** dem ersten Await installieren.
- Nur sourcebasierte Vorbereitung ohne Worldmutation darf yielden.
- Eine neue ephemere Worker-Inkarnation und monotoner Snapshot-/Reply-Sequence verhindern, dass ein verspätetes älteres Ergebnis eine neuere Read-Pose überschreibt.
- Antwort-ID korreliert einen Request, sie ersetzt nicht die Snapshot-Frische.
- Source-Ready-Ergebnis und dynamischen World-Snapshot getrennt behandeln. Ein altes Source-Ready enthält keine neue Autorität über Position und Geschwindigkeit.
- Jede Fortsetzung prüft Pending-Objektidentität, Command-ID, Source-/Revision-/Epochbindung und Dispose-/Cancelstatus.
- Zu Ende berechnetes, aber nicht mehr gültiges Produkt wird verworfen und gibt alle eigenen Reservierungen frei.
- Save, andere Cut-/Restore-/Residencytransaktionen können nicht neben einem offenen sourcegebundenen Mutationsvorhaben durchlaufen. Read/Input und normale Simulation bleiben während reiner Vorbereitung möglich.

Ephemere neue Felder gehören nicht in bestehende Saves, kanonische Objekt-Hashes oder persistente Receipts. Beide Enden der internen Protokolländerung gemeinsam testen. Keine still gemischte Worker-/Client-Version.

## 6. Messvertrag und Vorbereitungsmatrix

### 6.1 Drei unterschiedliche Zeitarten

1. **Wallclock-Latenz:** echter Input bis tatsächliches Applied beziehungsweise bestätigter Render-Submit. Enthält auch Warten und Scheduling.
2. **Synchroner Arbeitsanteil:** Summe und Maximum einzelner nicht unterbrochener Rechenabschnitte, je Besitzer/Phase gemessen.
3. **World-Hold:** Intervall, in dem die normale native Simulation wegen der Transaktion tatsächlich nicht fortschreiten darf.

Diese Größen nicht addieren oder gegeneinander austauschen. Manuelle Pausezeit gesondert kennzeichnen. Ein vorbestehender Benutzerpausezustand ist keine neue Cut-Rechenzeit. Den bestehenden Begriff des echten transaktionsbedingten Holds konkret am Tick-/Sessionzustand belegen.

### 6.2 Minimal notwendige Phasen

| Familie | Getrennt erfassen |
|---|---|
| Terrain-Support | Inputpacken, Queue, Workerkernel, Ingest, Masse, Connectivity/Transition, Encode/Decode, Ergebnisprüfung |
| Native Terrain | Sourceingest, transferierte Admission, exakte Colliderprüfung, native Trimesherstellung, Bodyinstallation, tatsächlicher Hold |
| Moving Body | Hit/Sourceaufnahme, lokale Workerableitung, native Sourceplanvorbereitung, Produktevergleich, Stage, Commit/Rollback/Finalize, tatsächlicher Hold |
| Darstellung | Fragmentmeshing, Artefaktprüfung, hidden Stage, Publish, Projektion, Shadows, erster bestätigter Render-Submit |
| Gemeinsame Arbeit | Queuezeiten, Transfergrößen, Anzahl Source-/Zell-/Journal-/Colliderbesuche, tatsächlich behaltene Buffer |

Bestehende `HvpRigidRecipeSpans`, `measureHvpCut` und Runnerbeobachtung erweitern, statt ein zweites Traceframework zu bauen. `handlerMs` nach einer kooperativen Umstellung ist Async-Elapsed, kein CPU-Span. Die >60-ms-Delayed-Callbackliste reicht nicht als Nachweis für eine 20-ms-Grenze.

### 6.3 Bounded Diagnostics

Neue detaillierte Diagnostik nur im bereits erlaubten Mess-/Testmodus aktivieren. Im normalen Spiel keine per-Zelle-Marks, JSON-Logs oder Observernachrichten. Eine komplette Pause-/Resume-Zustandskorrektur ist dagegen echte Runtimefunktion und nicht hinter Messmodus zu verstecken.

**Maximaler neuer logischer Diagnoseanteil:** 128 KiB innerhalb der bestehenden 512-KiB-Observer-Gesamtbilanz, einschließlich gleichzeitig existierender Kopien im Main, Worker und Reply. Richtform: numerischer Ring für höchstens 1024 feste 64-Byte-Records, höchstens 32 begrenzte Commandheader und höchstens ein begrenzter transportierter Batch. Tatsächliche Implementierung und alle Überschneidungen nachrechnen; wenn die bisherige Bilanz keinen Platz hat, existierende Daten umstrukturieren, nicht 512 KiB erhöhen. Modellierte Bytes und real beobachteter Heap bleiben unterschiedliche Nachweise.

Pro Record numerische Phase, Commandkorrelation, Owner/Worker-Inkarnation, Start/Ende oder Dauer, Work-Units und Outcome. Keine retained Source-/Mesh-/Native-Snapshots im Diagnosebuffer. Overflow und gelöschte Messung zählen als Drop; betroffene Abnahme ist nicht bewiesen. Fehlende Body-Hold-Werte bleiben `null`/fehlend, niemals `0`.

Messfehler dürfen den Game-Outcome nicht nachträglich ändern. Ein nicht verfügbarer Traceconsumer schaltet die Diagnostik geordnet ab. Die Ressourcenreservierung wird trotzdem korrekt freigegeben. Rohdaten außerhalb des Produktbaums speichern.

### 6.4 Zustandsmatrix für kooperative Vorbereitung

Die folgende Semantik ist innerhalb V3 freigegeben. Interne Typnamen an die tatsächliche API binden. Kein großes Framework daraus bauen.

| Zustand | Worldsimulation | Read/Input/Aim | Neue Cut-/Restore-/Residencytransaktion | Save | Cancel/Dispose |
|---|---|---|---|---|---|
| Idle | bestehende Politik | bestehendes Verhalten | vorhandene Admission | bestehender Safe Point | bestehendes Verhalten |
| SourcePreparing | fortschreiten, sofern nicht manuell pausiert | zulässig, kein Neuausstellen des ursprünglichen Hits | Busy/abgewiesen nach bestehender Fehlerfamilie | Busy, keine halbe Snapshotfreigabe | Vorbereitung ungültig machen, Scratch freigeben |
| SourceReady, noch kein Stage | wie SourcePreparing | zulässig | Busy | Busy | wie oben |
| PreparedHeld | gehalten | Read zulässig; keine konkurrierende Mutationswirkung | abgewiesen | nicht speichern | vorhandener vollständiger Rollback oder RecoveryHold |
| CommittedHeld | gehalten | Read gemäß bestehendem atomarem Publikationsvertrag | abgewiesen | nicht speichern | nur vorhandener zulässiger Abschluss-/Recoverypfad |
| RecoveryHold | gehalten | Diagnose/Read, keine automatische Freigabe | abgewiesen | keine neue behauptete konsistente Speicherung | vorhandene Recovery-/Disposepolitik |
| Disposed | keine Nutzung der World mehr | keine alten Replies adoptieren | abgewiesen | abgewiesen | idempotent |

**Pause/Inspect/Resume/Play:** bestehende Spielersemantik bewahren. Während SourcePreparing darf eine Pause nicht beim späteren Finish versehentlich aufgehoben werden. Inspect nicht pauschal als Pause neu interpretieren; aktuelles Produktverhalten und UI-Verkettung lesen. Verwendet der bestehende Sessioncode mehrere `...WasRunning`-Flags, eine kleine getestete Zustandsbindung statt zusätzlicher widersprüchlicher Kopien verwenden. Keine Zeit- oder Eingabeveränderung nur zur Erfüllung eines Tests.

**Impulse:** während sourcebasierter Vorbereitung nur soweit nach vorhandener Spieler-/Solverpolitik erlaubt; dadurch dynamisch geänderte Pose/Geschwindigkeit wird erst im Stage abgefragt. Nicht wegen unveränderter Source so tun, als sei die Bewegung eingefroren. Drop-/Teleport-/andere Strukturänderungen bleiben während einer solchen Transaktion nach den bestehenden Gates gesperrt.

**Cancel:** im neuen Prepared-Source-Pfad ownerlokalen Token ungültig machen. Ein späterer Reply darf weder Scratch wiederbeleben noch eine neue Stage beginnen. Nach mutativem Stage nicht lediglich ein Promise ablehnen und den Worldzustand zurücklassen; echter Rollback erforderlich. Ein Tick-/Zeitlimit darf keine halbfertige World durch automatische Resume verbergen.

## 7. Arbeitskarten und Abhängigkeiten

| Karte | Ergebnis | Voraussetzung | Primäre Write-Verantwortung |
|---|---|---|---|
| V3-00 | eigener Startreview, belegte Ausgangslage, kleine Fixes | Sourcezugriff | nur bestätigte Fixpfade aus vollständigem Review |
| V3-01 | exakte Diagnose, Body-Hold und reproduzierbarer Runner | V3-00, kritische Mess-/Ownershipfehler geschlossen | Trace, Client/Worker, Session, Performance-Runner |
| V3-02 | weniger reine Ableitungsarbeit bei gleicher Semantik | V3-01-Kosten | `voxel/adaptive`, `voxel/structural`, `structuralIngest`, Rezeptableitung |
| V3-03 | kooperative Terrain-Sourcevorbereitung, kurzer Stage-Hold | V3-02 und interne Commandmatrixprüfung | Terrain-Consumer, Fragment, Rezept, Session, Client/Worker |
| V3-04 | ein ownerlokaler Bodyplan, aktuelle Pose erst beim Stage | V3-03 oder begründet unnötiges Terrain-Delta; V3-02 | Bodyplan/-session/-worker, Client, Native-Session |
| V3-05 | vollständige Darstellung, begrenzte Alias-/Shadowkosten | V3-01; Integrationsverträge aus V3-03/04 später nachziehen | Bootstrap, Presentation, Artefakte, visuelle Tests |
| V3-06 | zweiter headless Materializerverbraucher | stabile V3-02-API | nur neue Referenz-/Testdateien |
| V3-07 | vollständige Negative-/Recovery-/Stressabdeckung | jeweilige betroffene Änderungen | fokussierte Testdateien, testinterne Fehlerhaken |
| V3-08 | integrierte technische Visual- und Performanceabnahme | V3-02 bis V3-07 integriert und geprüft | Runner/Reporter; Messung source-stabil |
| V3-09 | unabhängiger Finalreview, Feature-Publikation, einmaliger Handoff | V3-08 oder ehrlicher nicht behebbarer Reststatus | Journal, neue Evidence, Abschlussdokumentation |

Nicht jede Karte erzwingt einen Codefix: existierende korrekte Funktion mit ausreichenden eigenen Belegen wird `NO_CHANGE_VERIFIED`. Das ist kein Ersatz für fehlende Performancearbeit. V3-01 bis V3-04 dürfen nicht allein deshalb übersprungen werden, weil alte Unit-Suites grün waren.

### 7.1 V3-00: Startreview und realer Ausgangspunkt

**Liest:** die Pflichtquellen, vollständiges Gitdiff `9341fb9 → 45188b2` und `45188b2 → f2ee73c`, aktuelles Journal, alle geänderten Source-/Test-/Configdateien und notwendige Invariantenimplementierungen.

**Ausführung:** Orchestrator lässt einen unabhängigen starken `worker-alternate` sofort prüfen. Bei bereits tatsächlich vorhandenem vollständigem Review exakt passender Source diesen lesen und nur offene Teilbereiche ergänzen. Kein weiterer manueller Reviewerprompt als Endprodukt.

- [ ] Codebasis, Code-Tree, EV01-Tree und Elternbezüge prüfen. Nicht nur ersten Teil einer gekürzten 305-Dateien-API-Liste lesen.
- [ ] EV01-Diff auf die 14 Statusdateien und zwei Dokumentpfade eingrenzen. Alle 255 Payloads am tatsächlichen Gitobjekt auf sichere eindeutige Pfade, Länge, SHA-256 und JSON prüfen. Ein lokaler Dateibaum allein reicht nicht.
- [ ] Historische Source-/Buildinventare zu den Claims zuordnen. Unveröffentlichte alte Builds und Originalredaktionen bleiben als Herkunftsgrenze ausgewiesen, nicht durch neue Builds rückwirkend bewiesen.
- [ ] Kritische Startfelder prüfen: Hash-/Materialisierungsparität, Binärdecoder, Poolfehler-Drain, Main-/Body-Messzuordnung, Restorealias-/Tombstones, aktueller native Posebezug, Save/Recovery und begrenzte Observer-/Historienmengen.
- [ ] Tatsächlich vorhandene Typecheck-/Testbefehle ermitteln. Vorhandene unveränderte relevante Tests ausführen. Bei fehlenden Dependencybytes aus dem Lockfile installieren, keine Versionen tauschen.
- [ ] Jeden bestätigten Blocker/Major als reproduzierbare kleine Fixkarte sofort beheben lassen, dann unabhängig nachprüfen. Nicht die gesamte weitere Arbeit wegen eines rein historischen Dokumentfehlers blockieren.

**Pflichtbefundform:** ID, Schwere, Datei:Zeile, Eingabe/Vorbedingung, Mechanismus, beobachtete Folge, Test/Quelle, kleinster Fix, betroffene Garantie. Hypothese, Datenlücke und reproduzierter Defekt getrennt.

**Exit:** Source ist gebunden, notwendige Korrektheitsvorbedingungen stehen, Reviewabdeckung ist ehrlich protokolliert. Direkt V3-01 beginnen.

### 7.2 V3-01: Exakte Kosten und reproduzierbare Prüfung

**Modify:** `src/hestia-prototype/runtime/cutTrace.ts`, `src/hestia-prototype/physics/physicsWorker.ts`, `session.ts`, `bodyCutSession.ts`, `client.ts`, `terrain/bodyCutConsumer.ts`, `terrain/terrainConsumer.ts`, `src/hvp/hvpBootstrap.ts` nur für die erforderliche Observation; `tests/performance/hvp-cut-rt.spec.ts`, `hvpCutRtReport.ts` und `playwright.performance.config.ts` beziehungsweise eine versionierte V3-spezifische Konfiguration. Bestehende Funktionen zuerst lesen, keine zweite Producer-/Observerfamilie anlegen.

**Neue Tests:** vorhandene Trace-/Clock-/Consumer-/Reporterdateien erweitern; genaue Pfade im Sourceinventar auflösen. Keine neuen Paketdependencies.

- [ ] Vor Änderung behauptete Spangrenzen gegen Code prüfen. Körper-Hold genau dort starten, wo die native Simulation transaktionsbedingt angehalten wird, und in allen realen Rollback-/Finalize-/Recoverywegen beenden oder als offen markieren.
- [ ] Synchronous CPU-Slices getrennt von Async-Elapsed und Queue erfassen. Timeorigin-/Replybezug explizit halten. Tracefehler ändern keine Spielresultate.
- [ ] Sourceingest und Rezeptschritte mit bestehenden Hooks auflösen. Zunächst keine performancerelevante Kernänderung in derselben Messkarte.
- [ ] Die bisher externe Messkonfiguration als minimale, sichere, versionierte Konfiguration reproduzierbar machen. Keine historische lokale Konfiguration als bytegleich erfinden. Neue Config und tatsächliche Abweichungen in der neuen Evidence binden.
- [ ] Fokustests für fehlende/negative/duplizierte Marker, falsche Commands, Inkarnationswechsel, Drops, stale Read-Snapshots, manuelle Pause, Rejection und `null`-Hold schreiben und bestehen lassen.
- [ ] Eine feste kurze Diagnose aller sieben Varianten × Cold/Warm durchführen, mit echten UI-Cuts, allen Versuchen und getrennten Warmups. Bei bekannten Funktionsfehlern zunächst den jeweiligen reproduzierenden Fall reparieren.
- [ ] Ergebnis als Pareto-Tabelle darstellen: gemessene Phase, inklusive/exklusive Grenze, synchroner Maximalslice, Workunits, Bytes, Callcount. Keine Summe von überlappenden Quantilen.

**Priorisierung danach:** mindestens die beiden tatsächlich größten noch relevanten exklusiven Rechenanteile adressieren, bis andere Phasen dominieren oder die Zielwerte erfüllt sind. Die alte 1283-ms-Supportzahl ist nicht automatisch der neue Gesamtengpass.

**Exit:** Messung kann echte Input-/Applied-/Render-/Terrain-/Body-Hold-Zusammenhänge nachweisen; Speicher oberhalb und innerhalb der 512-KiB-Bilanz ist geprüft. Keine manuelle Fortsetzungsfreigabe nötig.

### 7.3 V3-02: Ableitungsarbeit reduzieren und Kern schmal halten

**Modify nach Kostenbeleg:** `src/hestia-prototype/terrain/structuralIngest.ts`, `src/hestia-prototype/physics/rigidRecipe.ts`, `bodyCutPlan.ts`, `structuralPlan.ts`; tatsächlich notwendige Funktionen in `src/voxel/adaptive/{materialization,validation,canonical,...}.ts` und `src/voxel/structural/{model,massProperties,connectivity,physicsTransition,...}.ts`. Die Auslassung bezeichnet keine offene Write-Freigabe: der Orchestrator löst vor Delegation jedes konkrete File im gelesenen Abhängigkeitsgraphen auf und vergibt genau diese Pfade.

**Bestehende Oracles:** vor der ersten Änderung vollständige relevante Ergebnis-/Fehler-/Hashgoldens sichern. Referenzimplementation im unveränderten Basis-Snapshot beziehungsweise sehr kleiner unabhängiger Fixtureoracle, nicht die eigene neue Ausgabe.

**Konkrete Schritte:**

- [ ] Pro Phase die tatsächliche Zahl vollständiger Validation-/Hash-/Cell-/Journal-/Connectivity-/Massendurchläufe erfassen.
- [ ] Falls Masse und Komponenten für dieselbe intern besitzklare Source mehrfach neu entstehen: Ergebnis einmal bilden, nur an passende interne Folgefunktionen weiterreichen. Public-/Workergrenzen weiter vollständig zulassen. Kleinere Folge-Aufrufbudgets nicht durch Wiederverwendung umgehen.
- [ ] Falls Massenzugriff pro Zelle wiederholt globale Strukturen durchsucht: einen lokalen bounded Index aus validierter Source bauen oder vorhandenen Index verwenden. Gleiche kanonische Traversierungs- und Summenreihenfolge erhalten. Keine Float-Neuordnung unter dem Etikett „semantikgleich“.
- [ ] Falls Journal-/Proofbildung dominiert: unveränderte Teilinputs innerhalb derselben Authority ableiten und wiederverwenden; weder vollständigen Journal-Digest durch einen lokalen Subset-Digest ersetzen noch fremde Proofobjekte neu ausstellen.
- [ ] Falls nach den Reduktionen notwendige lange Teilfunktionen verbleiben: zu einem reinen Cursor gemäß 5.4 umformen. Bestehender synchroner APIpfad bleibt Wrapper desselben Algorithmus. Synchronous/Cooperative-Parität über Teilungsgrenzen beweisen.
- [ ] Whole-input-Initialisierung, Sortierung, finale kanonische Serialisierung und Hashing in die Kostentabelle aufnehmen. Kein >8-ms-Endblock hinter einer kooperativen Frontschleife verstecken.
- [ ] Nach jeder algorithmischen Änderung Produktionsfixture kurz gegen exakt dieselbe Source/Hardware ausführen und Verbesserung sowie Peakbytes dokumentieren. Ohne Verbesserung oder eindeutig erforderlichen Livenessgewinn keinen Komplexitätszuwachs behalten.

**Pflichttests:** leere beziehungsweise abgewiesene Source, eine Zelle, mehrere Materialien, negative/große Koordinaten, Boxrand und Sphere-Fallback, Journalüberschneidung/-reihenfolge, voneinander getrennte Komponenten, Anchor/Joint-Kontext, maxCells und maxCells+1, kleineres Budget auf Cachehit, Mutation nach zulässiger Callerübergabe, Sourcewechsel, 1/7/64/257 Einheiten pro Cursoradvance, Abbruch an jeder Phase, identische Fehlercodes/Hashes.

**Kostenziel:** kein doppelter Vollkernel ohne nachgewiesene separate Vertrauensgrenze; keine asymptotische Verschlechterung; G-P05. Der Hauptnachweis bleibt G-P01 nach Integration. Keine isolierte Mikrobenchmarkbeschleunigung als End-to-End-Erfolg melden.

**Reuseregel:** Neue reine Voxelalgorithmen enthalten keine Hestia-, Three-, Rapier-, DOM- oder Workerinitialisierungsimporte. Existierende Prefixe und persistente Hashsemantik nicht nebenbei umbenennen. V3-06 verwendet den real verbesserten Kernel.

### 7.4 V3-03: Kooperative Terrainvorbereitung und frühere hidden Darstellung

**Modify:** `physics/terrainFragment.ts`, `rigidRecipe.ts`, `session.ts`, `physicsWorker.ts`, `client.ts`, `terrain/terrainConsumer.ts`, erforderliche Teile von `terrainProducts.ts` und `hvpBootstrap.ts` nach Leaseabgleich. Dies ist eine serielle Integrationskarte, kein Parallelwrite mit V3-04.

**Ziel:** notwendige Sourcearbeit vor dem mutativen Hold erledigen, während Input/Simulation weiterlaufen; erst danach kurzer exakter nativer Stage. Bereits vorhandene transferierte Colliderzulassung nicht entfernen.

**Interner Zielablauf:**

```text
Cutrequest + before-Source festlegen
  -> Supportreport vollständig zulassen
  -> Sourcevorbereitung im Physics-Owner anfangen und Pending binden
  -> gleichzeitig, soweit Budgets es erlauben: Terrainprodukte kompilieren
  -> kooperative native-ownerlokale Ingest-/Rezeptzulassung beenden
  -> sourcegebundene Render-Metadaten zurückgeben, keine eingefrorene Pose
  -> neue Rendergeometrie vollständig prüfen und unsichtbar bereithalten
  -> native Stage mit gültigem Prepared-Source-Ticket
  -> bestehender Commit + gepaarte Root/Render/Physics-Publikation
  -> Finalize, alte Ressourcen freigeben, Tick korrekt fortsetzen
```

**Default für neue interne Commands:** `PrepareTerrainSource`, `StageTerrainPrepared`, `CancelTerrainSource`. Der Orchestrator bindet konkrete Typen vor dem Writerstart, mit mindestens den folgenden Daten; vorhandene äquivalente enge Typen wiederverwenden statt duplizieren:

```ts
// Nur ephemerer Main/Worker-Vertrag; kein Save-/Contentformat.
interface PreparedSourceBinding {
  readonly sessionId: string;
  readonly worldIncarnation: number;
  readonly transactionId: string;
  readonly expectedTerrainGeneration: number;
  readonly sourceDigest: string;
  readonly requestDigest: string;
}

interface TerrainSourceReady {
  readonly binding: PreparedSourceBinding;
  readonly ticket: string; // ownerlokal ausgestellt, einmalig konsumierbar
  readonly fragments: readonly {
    readonly ownerId: string;
    readonly sourceDigest: string;
    readonly cellCount: number;
    readonly massKg: number;
    readonly center: Readonly<{x: number; y: number; z: number}>;
  }[];
}
```

`sourceDigest`/`requestDigest` exakt aus der vorhandenen kanonischen Bindung bestimmen, keine neue persistente Hashversion. Ticketvergleich gegen die tatsächliche ownerlokale Pendinginstanz, nicht nur gegen einen Stringpräfix. Keine Bodyhandles oder komplette native Snapshots im Ready-Reply. Maximal eine solche Prepared-Source pro World.

**Implementierungsfolge:**

- [ ] Interne Typen und Zustandstabelle 6.4 gegen alle vorhandenen Sessioncommands prüfen; starker unabhängiger Designreview. Dies ist die bereits freigegebene interne Designentscheidung.
- [ ] Ownerlokales Pending vor erstem Await setzen. Fragmentsnapshot, Admission und Reservierung vor längeren Allokationen validieren. Alle Exits räumen Pending/Reservation auf oder führen zu RecoveryHold, nie Phantom-Idle.
- [ ] `prepareHvpTerrainFragment` und benötigte Ingest-/Rezeptpfade über dieselben geprüften Kerncursor treiben. Reine Sourcephase darf weder Bodies noch Collider erzeugen, World.pause aufrufen oder Positionszustände ändern.
- [ ] SourceReady gibt nur für die Rendergeometrie benötigte lokale Metadaten frei. Existing admitted center/source/cellcount/mass binding vollständig prüfen. Main darf damit unsichtbare Artefakte vorbereiten, keine Worldmutation.
- [ ] `StageTerrainPrepared` prüft Ticket, Generation, Registry, tatsächliche aktuelle World-Mitgliedschaften und alle Coexistencebudgets erneut. Erst dann pause, exakte Collider erstellen, Bodies installieren und Stage registrieren.
- [ ] Native Pose-/Runstatus nicht aus Ready-Reply übernehmen. Auch während Pausen-/Inspectwechseln den aktuellen Benutzerwunsch erhalten.
- [ ] Bestehende Commit-/Rollback-/Finalize-Reihenfolge und Recoveryprüfungen erhalten. Resultat Applied erst an derselben fachlichen Abschlussgrenze wie bisher. Keine neue Teilpublikation.
- [ ] SourceReady-Cancel, Dispose während Yield, verspätetes Ready nach Restore, Jobfehler, Renderstagingfehler und native Stagefehler tatsächlich testen. Keine Microtask- statt Task-Yields.

**Wichtige Nebenbedingung:** Ein synchrones `world.createCollider` ist nicht unterbrechbar. Überschreitet eine solche native Operation unerwartet das zulässige Blockadebudget, zunächst echte Kosten belegen. Keine „Pause aus, dann synchron kochen“-Abkürzung. Feinere exakte Produkte nur innerhalb bestehender Adress-/Save-/Collisionverträge; andernfalls scopeabhängigen Restblocker ausweisen.

**Exit:** dieselben source-/material-/mass-/inertia-/collidergeordneten Resultate, kurze eigene Slices, true Hold gemessen und reduziert, Input/Simulation während Sourcephase funktionsfähig. Danach V3-04 ohne Owner-Zwischenfrage.

### 7.5 V3-04: Bewegte Körper ohne wiederholten Stage-Vollplan

**Modify:** `physics/bodyCut.ts`, `bodyCutPlan.ts`, `bodyCutSession.ts`, `structuralPlan.ts`, erforderliche `structuralBreak.ts`-Adapterstellen, `session.ts`, `physicsWorker.ts`, `client.ts`, `workers/hvpBodyCutJob.ts`, `terrain/terrainProducts.ts`, `bodyCutConsumer.ts` und die minimal nötige hidden-Renderanbindung.

**Vorliegender Mechanismus:** `bodyCutSession.stage` ruft `prepareHvpBodyCut` auf, nachdem die Session pausiert hat. `stageHvpBodyCut` bindet dagegen korrekt erst beim Stage aktuelle native Pose/Geschwindigkeit. Diese letzte Grenze bleibt bestehen.

**Gewähltes Ziel:** genau ein endgültiger autoritativer Sourceplan pro Bodycommand in der tatsächlichen Physics-Owner-Session. Nicht das renderseitige Workerprodukt zur nativen Wahrheit erklären. Der Plan wird kooperativ vorbereitet, sein lokaler Ausstellungsnachweis bleibt in `bodyCut.ts`.

```text
ursprünglichen nativen Hit aufnehmen
  -> immutable Source, Cutshape und Parentmembership binden
  -> ownerlokal kooperativ vollständigen lokalen Sourceplan berechnen
  -> gültige Childsource-/Massen-/COM-Metadaten und Meshinputs ableiten
  -> Rendererworker baut daraus reine Meshprodukte, ohne zweite Authority
  -> Mesh-/Metadatenergebnisse streng gegen den ausgestellten Plan prüfen
  -> native Stage fragt JETZT Pose, linvel, angvel, Membership ab
  -> bestehende Impuls-/Split-/Rollback-/Finalizefunktion benutzen
```

**Konkrete Regeln:**

- Der beim ursprünglichen `begin` autorisierte Hit bleibt bindend. Bei Stage keine neue Aim-/Range-Rayquery als vermeintliche Frischeprüfung einführen. Ein inzwischen anderer Kamerablick macht den ursprünglichen getroffenen lokalen Zellbereich nicht zu einem anderen Treffer.
- Source und Membership müssen weiterhin passen. Eine bewegte Pose alleine invalidiert nicht den sourcebasierten Plan; entfernte/ersetzte Parentinstanz oder Sourceänderung dagegen schon.
- Der vorhandene WeakMap-/WeakSet-Ausstellungsnachweis wird nach erfolgreichem ownerlokalen Cursorabschluss erzeugt. Untrusted Workerdeskriptoren erhalten keinen lokalen Nachweis durch Copy/Cast.
- Für `StageBodyCut` einen vorbereiteten lokalen Plan/Ticket aus dem bestehenden Pending verwenden. Nicht dieselbe vollständige Klassifikation/Materialisierung ein zweites Mal im Stage ausführen.
- Ist die vorhandene Workerableitung danach nachweislich doppelt, einen kleinen, diskriminierten **mesh-only** Auftrag innerhalb des bestehenden Bodyjobmoduls verwenden. Eingabe sind native-ownergebundene Childsource-Daten; Ausgabe bleibt normales streng geprüftes Mesh. Kein allgemeines Wireframework und kein zweiter geometrischer Kern.
- Der mesh-only Pfad muss Indexgrenzen, Materialien, AABB, vollständige Zelloberflächenabdeckung, Source-/Ownerreihenfolge, Bufferownership und Bytes vor Allokation beweisen. Metadatengleichheit alleine ist kein Beweis vollständiger Geometrie.
- Frühere V1/V2-Decoderoracles nicht einfach löschen. Ein bewusst entfernter interner Produktionspfad erhält eine dokumentierte Ablösung und einen Fehlerfall für gemischte Versionen. Public-/Saveformate bleiben gleich.
- Vollständige Entfernung mit null Children bleibt korrekt; kein erfundener leerer Rigidbody. Removed-Mass/Momentum bleibt aus echten entfernten Zellen abgeleitet.
- Aktuelle Rotation, COM-Offset, linearer und angularer Impuls werden an der bereits existierenden Stage-Grenze gebunden. Keine Pose-/Velocity-Zero-Shortcuts, keine heuristische Masse, keine reparierte Trägheit durch andere Toleranzen.

**Mindestens diese Tests zuerst definieren:**

1. Parent bewegt/rotiert zwischen Hit und Stage; Source bleibt gleich. Childpose und Geschwindigkeiten entsprechen dem aktuellen Parent, Cutregion dem ursprünglichen lokalen Hit.
2. Kamera wird zwischen Hit und Stage weggedreht: kein neuer unautorisierter Treffer und kein anderes Sourcevolumen.
3. Parent ersetzt, Source geändert oder Restore/Incarnation gewechselt: keine Stage und keine sichtbare Adoption.
4. Gleicher Hit/Request erneut: bestehende Idempotenz bleibt; Fremdticket oder wiederverbrauchtes Ticket abweisen.
5. Box und Sphere, terrain- und timberfamily, moving und sleeping, vollständige/teilweise Entfernung, mehrere Materialien.
6. Cancel/Dispose zwischen jedem Yield und vor/nach Meshreply: maximal eine Aufräumaktion, kein hängendes Promise und keine lebende Prepared-Source.
7. Schadhafte Meshindices, falscher Childdigest, geänderte COM/Masse, fehlende Childfläche: abweisen vor Commit.
8. Native Fehler an Install/Commit/Finalize: bestehender old/new/RecoveryHold-Vertrag; Parentregistry und Sequenz rollbacken, soweit bisher bewiesen.
9. Run-/Pausezustand während Prepare ändern: späterer Abschluss darf keine manuelle Pause überschreiben.
10. Kalter und warmer echter Restore/Recut bleiben funktionsfähig; Token-/Snapshotordnung wird nach Restore neu gebunden.

**Exit:** kein synchroner Stage-Vollplan mehr im produktiven Standardpfad, genau ein lokaler Ausstellungsowner, keine neue Mess-/Saveautorität, echte Body-Holdwerte, Aufwand und End-to-End-Latenz nachgemessen. Ein bloß kürzeres Holdlabel ohne weniger Blockade besteht nicht.

### 7.6 V3-05: Renderkonsistenz, Aliaslifecycle und sichtbare Qualität

**Modify:** gezielt `src/hvp/hvpBootstrap.ts`, `src/hestia-prototype/presentation/{terrainFragment,visualEffects}.ts`, `src/presentation/meshArtifact.ts` und betroffene bestehende Render-/Backendadapter nur bei reproduziertem Kosten-/Korrektheitsbefund. Bootstrap-Lease mit V3-01/03/04 koordinieren.

**Nicht Ziel:** neues Hestia-Art-Design, neue Vegetation, Wasser-/Lichtqualität senken oder bestehende Szene vereinfachen. Die aktuelle Microvoxel-Bildsprache und Szenenkomplexität sind die Referenz.

- [ ] Im Startreview bekannte lange native IDs, Alias-/Native-ID-Kollisionen, Cold-Load mit bereits residentem kollidierendem Owner und Terrain-/Foliage-Aliasfamilien tatsächlich prüfen.
- [ ] Kurze ausschließlich renderseitige Keys beibehalten; Source-/Owner-/Saveidentitäten nicht daraus ableiten. Countergrenzen und Restore-/Sessionreset explizit prüfen. Kein Wraparound mit Wiederverwendung alter Tombstones.
- [ ] Jede hidden Stage besitzt genau ihre neuen Ressourcen. Fehler entsorgen ausschließlich diese; der zuvor publizierte Zustand bleibt darstellbar. Nested Batch, Throw, Rollback und Dispose verlieren keine nötige finalisierte Projektion.
- [ ] Historische Keymengen und Backend-Tombstones auf wirklich erreichbare Bounds/Lifecycle prüfen. Kein blindes Löschen zum Bestehen eines Leaktests. Stalevisibilityschutz muss auch nach einer zulässigen bereinigten Generation bestehen.
- [ ] Gültige neue Geometrie höchstens einmal pro Generation vollständig projizieren. Kein kompletter Scene-/Visibility-Publish nach jedem Child, soweit gebündelte Publikation dieselbe synchrone Authoritygrenze erhält.
- [ ] Shadowinvalidierung durch tatsächliche Caster-, Licht-, Geometrie-, Visibility- und Poseänderungen auslösen. Nichtcaster-/HUDänderungen erzeugen keinen unnötigen Vollshadowpass, sofern sie dessen Ergebnis nicht beeinflussen.
- [ ] Nach Cut keine alten Geometriestücke, doppelte Fragmente, Ghostcollider, falsche Normals/Materialflächen, verschwundene Schatten oder Clippinglücken. Numeric-/Semantikoracle plus echte Bilder verwenden.
- [ ] Pendingfeedback innerhalb G-V01; keine frühe persistente Schnittdarstellung, die noch nicht zur alten Kollision passt. Ein deutlich gekennzeichneter Wireframe/Ghost darf existieren, aber keine echte Öffnung vortäuschen.

**Exit:** alle technischen Visualpflichten aus Abschnitt 10 erfüllt und neue Ressourcenlifecyclekosten belegt. Änderungen von Capturemasken oder Goldens nie zur Verdeckung eines sichtbaren Fehlers verwenden.

### 7.7 V3-06: kleiner zweiter Verbraucher

Siehe vollständigen Contract in Abschnitt 11. Implementiere genau diesen Scope nach stabiler Kern-API und ohne weitere Ownerfreigabe. Ein vorhandener passender lokaler R01-Draft wird auf denselben Scope eingegrenzt, nicht als Pflichtabhängigkeit gesucht, bis der Gesamtauftrag stockt.

### 7.8 V3-07: Korrektheit, Fault/Recovery und Lifecycle

**Ziel:** Nicht nur erfolgreiche Positivfälle, sondern die in Abschnitt 9 aufgeführten negativen Übergänge nachweisen. Tests nach dem Besitzer der betroffenen Funktion aufteilen. Testinterne Fault-Injection darf keine playerseitige alternative Mutations-API einführen.

- [ ] Vorhandene Unit-, native Rapier- und Browser-Tests klassifizieren: echte Native, echtes Three mit Fake-Transport, pure Source oder bloßer Mock. Diese Beweisstufen getrennt berichten.
- [ ] Fehlende Matrixfälle implementieren, zunächst real reproduzierbares Rot für Defekte beziehungsweise bestehendes Oracle für semantikgleiche Refactors sichern.
- [ ] Save-Load-Save auf übereinstimmenden deterministischen Zuständen/Simticks vergleichen, nicht nach zufällig anderer Wallclockdauer. Alle bestehenden Persistenzbytes und Sourceidentitäten erhalten.
- [ ] Referenzsample vor dem ersten Yield und native Stage-State nach realer Bewegung getrennt prüfen. Masse, vollständiger Tensor und Impuls in geeigneten unabhängigen kleinen Fixtures nachrechnen.
- [ ] Wiederholte Load/Cut/Rollback/Retry-Zyklen innerhalb vorhandener Admissionlimits laufen lassen. Erwartete neue Commands/Receipts von unerlaubter Ressourcenretention unterscheiden.
- [ ] Nach Cleanup keine offenen Timer/Channels/Promises/Workerjobs/tickets, kein versehentlich weiter pausierter Simulationsowner und kein liegengelassenes Testbrowserprofil.
- [ ] Fehler beseitigen und alle betroffenen Vorgängertests frisch prüfen. Keine Testtimeout-Erhöhung zur Verdeckung einer Algorithmus- oder Flakinessregression.

**Exit:** die vollständige zutreffende Faultmatrix besteht mit realen Oracles; fehlende Umgebungen sind ehrlich kenntlich und verhindern die entsprechende technische Abnahme.

### 7.9 V3-08: integrierte Ziele erreichen

Alle bestätigten Fixes und der Reuse-Verbraucher werden in eine konsistente Kandidaten-SHA integriert. Erst auf dieser gemeinsamen Source:

- [ ] Typecheck, Produktionsbuild, relevante Units und reale Browserflows.
- [ ] Technische Visualmatrix und Schutz vor Hestia-Startregressionen.
- [ ] Kurzer fester Qualifikationslauf auf Referenzhardware.
- [ ] Bei Zielverletzung ohne Scopeblocker automatisch zurück in die zuständige V3-Karte, kleinsten belegten Fix, Review und erneuter Qualifikationslauf. Keine Ownerchat-Schleife.
- [ ] Erst wenn die Qualifikation die formale Messung sinnvoll macht: vollständige 1400-Regulärversuche-Serie nach Abschnitt 8.
- [ ] Vollständige finale Unitsuite auf integrierter finaler Source und geltenden Limits; ursprüngliche Failhistorie nicht überschreiben.

Keine zusätzliche große Serie auf einem unveränderten klar langsamen Kandidaten nur für ein formales FAIL. Der Qualifikationslauf ist hierfür die wirtschaftliche Schranke, kein Ersatzerfolg. Ein gültiger formaler Fail bleibt erhalten; nach echter Sourcekorrektur beginnt eine neue klar gebundene Serie, nicht ein Austausch einzelner langsamer Zeilen.

### 7.10 V3-09: unabhängiger Finalreview und einmaliger Abschluss

Ein frischer starker Reviewer prüft den vollständigen V3-Diff gegen f2ee und die bisherige Reviewabdeckung von V2. Wenn der initiale volle V2-Review fehlt, ist das kein Grund, nur den V3-Diff abzunehmen. Ganze unberührte Bereiche nicht endlos erneut lesen, aber Auswirkungen veränderter Abhängigkeiten beurteilen.

- [ ] Zero unresolved Blocker/Major und sämtliche bindenden technischen Gates anhand echter Rohdaten bestätigen.
- [ ] Letzte gemessene Code-/Test-/Config-SHA vom späteren reinen Evidencecommit sauber unterscheiden. Keine zirkuläre Forderung, ein Commit müsse im eigenen Inhalt schon seine eigene endgültige SHA enthalten.
- [ ] Neue Evidence aus tatsächlichen Gitbytes beziehungsweise einem klar gebundenen externen Artefaktarchiv prüfen. Keine Wiederholung des EV01-Ignorefehlers.
- [ ] Normalen V3-Feature-Branch ohne Force pushen und Remote-SHA bestätigen. Bei fehlendem Pushzugriff lokalen getesteten Kandidaten liefern; keine ungeprüfte Alternative verwenden.
- [ ] Genau einen finalen Bericht liefern, keine Sammlung neuer Startprompts. Inhalt in Abschnitt 14.

Kein PR und kein Main-Merge. Finale menschliche Art-Direction-Bestätigung am Ende separat offen lassen. Der Agent darf sie nicht durch ein künstliches `OWNER_ACCEPTED` ersetzen.

## 8. Reale Performanceabnahme

### 8.1 Referenzgerät und Bildqualität

Die bisherige P07-Ownerdesignation ist der zuerst zu verwendende Zielpfad: lokales Windows-Gerät mit Intel Core Ultra 7 255H; in der Diagnose tatsächlich ausgewählte Intel Arc Pro 140T; Balanced-Energieprofil; installierter Chrome; headed, foreground, Canvas/Framebuffer 1280×720, DPR 1. Vor jeder Serie die tatsächlich vorhandenen CPU/GPU-/Treiber-/Browser-/Powerdaten messen. Nicht aus der Liste vorhandener Grafikkarten auf die ausgewählte GPU schließen.

Keine Verbesserung durch Wechsel auf eine stärkere GPU, kleinere Auflösung, reduzierten DPR, reduzierte Grafikdetails, gelöschte Schatten oder kleinere Szene. Ein abweichendes Gerät ist eine zusätzliche Messung und nicht automatisch der frühere Zielnachweis. Ist die bezeichnete Hardware nicht verfügbar, alle übrigen Code-/Funktions-/Visualarbeiten fortführen und die Zielhardwaremessung am Ende ausdrücklich offen lassen, statt die Grenzwerte zu erhöhen.

Die Konfiguration, Browserbinary, Node/npm, Paketlock, WASM, Src-/Test-/Fixtureinventare und Produktionsbundle mit Hashes binden. Der alte historische externe Build wird nicht umgeschrieben. Ein neuer reproduzierbarer Build ist eine neue Evidencegeneration.

### 8.2 Stufen

**Diagnose:** eine feste kleine Serie, bei Bedarf Detailspans; zählt nicht als p95-Gate.

**Qualifikation:** 3 reguläre Versuche pro sieben Varianten × Cold/Warm = 42 geplante Versuche, für alle gleiche vorab deklarierte Ausführungsregeln. Alle Versuche erhalten Records, keine Retries. Ein formaler Nachweis ist das noch nicht. Wenn ein Functionalfehler oder klarer reproduzierbarer Multi-Sekunden-Cut vorliegt, zuerst verbessern.

**Formale Abnahme:** Der vorhandene Runner nutzt pro Variante/Temperatur `[34,33,33]`. Das bedeutet 7 × 2 × 3 = **42 Varianten-/Temperatur-Sessions**, jeweils ein frischer Browserprozess pro Session, insgesamt **1400 regulär geplante Versuche**. Nicht als drei Browserprozesse insgesamt umdeuten. Jede der 14 Populationen besitzt 100 geplante reguläre Versuche über drei Sessions.

Cold und Warm behalten die bestehenden Definitionen: neuer Dokument-/Workerzustand je Versuch; Warm besitzt einen echten ungemessenen Cut und normalen Hot-Restore. Moving wird durch echte vorhandene Bewegung/Impuls vorconditioniert. Ein moving-Case ist kein automatischer Nachweis des freien Falls. Reale fallende terrain-/timberBodies werden deshalb in der ergänzenden Funktionsmatrix geprüft.

### 8.3 Fehlermengen und Statistik

Für reguläre formale Szenarien erwarten wir 100/100 fachlich gültige Applied-Cuts pro Population. Keine absichtlichen NoOps in diese Population mischen. Negativ-/Budgettests bilden eigene Szenarien. Jeder geplante Versuch bleibt mit `not-run`, precondition-failed, Applied, NoOp, Rejected, RecoveryHold oder Timeout nachvollziehbar, nach dem vorhandenen Reportervertrag.

Fehlgeschlagene Preconditions werden nicht so lange ersetzt, bis zufällig 100 Erfolge übrig bleiben. Unvollständige Serie erfüllt die Abnahme nicht. Alle realen Zeitwerte einschließlich Ausreißern bleiben; keine Winsorisierung, kein 5%-Trimmen, kein Ersetzen langsamer Runs. Pro Population p50/p95/p99/max und Anzahl/Warmups/Preconditionfehler/Commandfehler/Drop-/Messfehler ausweisen. Ein optionales zusammenfassendes Gesamtdiagramm ersetzt nicht die Einzelgates.

Nearest-rank-Oracle: `rank = ceil(p*n)`, sortierte Werte am Index `rank - 1`. Die vorhandene Funktion wiederverwenden. Tests: Werte 1..100 ergeben p95=95, p99=99; Werte 1..15 ergeben p95=15; Eingabearray bleibt unverändert. NaN/Infinity/negative/missing Zeitwerte invalidieren die zutreffende Messung, nicht zu 0 wandeln.

Die Latenzen entstehen an echten Produktmarkern, nicht aus der Uhr vor `page.click()`. First RenderSubmit verlangt echten Renderaufruf plus aktuelle Source-/Native-/Key-/Posebindung. Weder ein beliebiges `requestAnimationFrame` noch ein GPU-Fence belegt einen tatsächlichen Monitor-Scanout. Im Bericht genau Render-Submission nennen.

### 8.4 Runner und ausführbare Befehle

Vorhandener Standardstack an f2ee: TypeScript 7.0.2, Vitest 4.1.11, Vite 8.1.5, Playwright 1.61.1, Three 0.185.1 und Rapier 0.12.0. Keine neue Toolversion beschaffen, um den Plan unverändert abspielen zu können. Bei tatsächlich späterem autorisiertem Stand dessen gebundenen Lock verwenden und Delta dokumentieren.

Aus `apps/weltraum-browser`, nach Prüfung der vorhandenen Installation:

```text
npm ci
npx tsc -p tsconfig.json --noEmit
npm run test
npm run build
npx playwright test tests/e2e/hvp-look.spec.ts tests/e2e/hvp-visible-coast.spec.ts
```

`npm ci` nur wenn die gepinnte Installation fehlt/abweicht, nicht vor jeder Karte. Neue Testdateien sinnvoll im vorhandenen Testinventar registrieren, ohne andere Gruppen zu entfernen. Zusätzliche Fokustests aus dem tatsächlichen V3-Write-Set auflösen; keine erratenen alten Dateinamen aus früheren Anhängen voraussetzen.

Das folgende PowerShell-Gerüst verwendet die **tatsächlich vorhandenen** Runner-Umgebungsvariablen. Der Orchestrator löst Browserpfad und Ausgabeordner lokal auf und trägt sie ins Journal ein, nicht in eine neue Nutzerfrage:

```powershell
# Voraussetzung: WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH ist auf eine
# vorhandene, gebundene Chrome-Executable gesetzt. Fehlt er, den
# schon verwendeten Pfad im Thread-A-Journal/Host ermitteln.
if (-not (Test-Path -LiteralPath $env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH)) {
    throw "Gebundene Browser-Executable fehlt"
}
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$root = Join-Path ([System.IO.Path]::GetTempPath()) "hvp-v3-measure-$runId"
if (Test-Path -LiteralPath $root) { throw "Evidenceordner existiert bereits" }
New-Item -ItemType Directory -Path $root | Out-Null
$env:WELTRAUM_HVP_MEASURE_DIR = $root
$env:WELTRAUM_HVP_CUT_RT_CLASS = "measurement"
npx playwright test -c playwright.performance.config.ts tests/performance/hvp-cut-rt.spec.ts --workers=1 --retries=0
if ($LASTEXITCODE -ne 0) { throw "Messserie fehlgeschlagen; Rohdaten erhalten" }
```

Vor diesem Kommando muss V3-01 die tatsächlich verwendete Produktionspreview-Konfiguration geprüft haben: Port 5173 ausschließlich task-owned, kein reused dev server, richtige Produktionsbundle-Source, Trace/Screenshots/Video aus. Falls eine schmale `playwright.cut-rt-v3.config.ts` notwendig ist, genau diesen tatsächlich erzeugten Konfigurationspfad einsetzen und mitbinden. Nicht die Defaults der alten Konfiguration ungeprüft für geeignet erklären.

Das bestehende `diagnostic` liefert eine Beobachtung je Population. Für die 42-Versuche-Qualifikation einen klar benannten zusätzlichen Runner-Modus oder separaten kleinen Scheduleparameter ergänzen. `measurement` behält exakt `[34,33,33]`. Sein Default darf nicht versehentlich zur verkürzten Diagnose werden.

### 8.5 Datenschutz und Wiederholbarkeit

Rohreports enthalten keine Tokens, Browserstart-Commandlines, privaten Dateiinhalte oder unbereinigten Profilverzeichnisse. Neue Sourceinventare repo-relativ schreiben; historische Inventare nicht nachträglich ändern. Privaten vollständigen Rohstand und öffentlichen redigierten Export mit Original-/Published-Hash und exakten Redaktionspfaden trennen. PNGs nur für die echte Spielcanvas, keine Desktop-/Accountinformationen.

Ein Hash ist Integrität, nicht Vertraulichkeitsfreigabe. Neue Zeitmessung mit Tracing/Capture ist Diagnose. Die formale Serie läuft ohne diese Zusatzinstrumente und ohne konkurrierende CPU-/GPU-Tasks.

## 9. Pflichtmatrix für funktionale und native Korrektheit

Jeder folgende Fall erhält einen konkreten Test oder einen belegten vorhandenen Test plus frischen Lauf auf betroffener Source. `NOT_APPLICABLE` nur mit API-/Scopebegründung, nicht wegen unangenehmer Implementierung. Die angegebenen Erwartungswerte sind Verträge; sie sind keine bereits ausgeführten Ergebnisse.

| ID | Setup / Aktion | Erwartetes Resultat |
|---|---|---|
| K01 | identische Source/Box/Sphere über Sync und Cursor mit Schritten 1,7,64,257 | gleiche kanonische Bytes, Fehler, Materialfolge und Hashes |
| K02 | überlappende Edits umgekehrt versus Originalreihenfolge | Reihenfolge bleibt fachlich relevant und stimmt mit unverändertem Oracle |
| K03 | negative und maximal erlaubte Koordinaten, Rand auf positiver Boxgrenze | identische halb offene Zellselektion; kein unsicherer Integerfastpath |
| K04 | Mix aus mindestens zwei echten Materialdichten | exakte vorhandene Massensumme, COM und voller Tensor innerhalb bestehender unveränderter Toleranzen |
| K05 | Source mit Anchors/Joints im jeweiligen öffentlichen Pfad | bestehende korrekte Ablehnung/Klassifikation; kein transferred-Claim-Bypass |
| K06 | Cachehit mit kleinerem Budget als beim Cacheaufbau | bestehendes Budgetlimit wird weiterhin durchgesetzt |
| K07 | erlaubte Callermutation nach Snapshotübergabe | keine unzulässige Aliasmutation im Pending; bestehende Ownershipsemantik erhalten |
| K08 | Cancel vor erstem, während mittlerem und nach letztem Yield | kein NativeStage, kein neuer Root, keine offene Reservation |
| K09 | Dispose während Yield und spätes Ready/Reply | einmalige Freigabe, keine Worldnutzung nach free, kein stale Snapshotadoptieren |
| K10 | Pause nach Begin, dann Abschluss | Benutzerpause bleibt; keine automatische Resume durch altes WasRunning |
| K11 | Resume/Play während reiner Sourcevorbereitung, wo vorhanden zulässig | aktuelle Spielerpolitik gilt; Hold-/Backlogwerte bleiben fachlich richtig |
| K12 | Read2 wird vor verspätetem Read1/SourceReady adoptiert | keine Rücksetzung auf ältere Pose oder ältere Inkarnation |
| K13 | PrepareRestore/Neighbor/Residency/zweiter Cut während Pending | Busy/korrekte Ablehnung, kein zweiter Mutationsowner |
| K14 | Save während SourcePreparing/PreparedHeld/CommittedHeld | kein inkonsistenter gespeicherter Zustand; korrekter bestehender Busy-/Safe-Point-Pfad |
| K15 | Parent bewegt und rotiert nach originalem Hit | ursprüngliche lokale Cutshape, aktuelle Stagepose/-velocity/-momentum |
| K16 | Kamera wegdrehen nach originalem Hit | keine neue Stage-Raycast-Autorisierung und keine andere getroffene Zellmenge |
| K17 | Parent wird entfernt/ersetzt, Source/Revision wechselt | Ergebnis abweisen, kein Phantomchild und kein fremder Renderkey |
| K18 | komplette Bodyentfernung | null Children zulässig, volle echte Removed-Mass-/Momentum-Bilanz |
| K19 | lange erlaubte native ID, renderähnliche native ID | kurze separate Renderidentität ohne Änderung von Native-/Save-ID |
| K20 | Cold-Load mit residentem kollidierendem Body-/Terrain-/Foliage-Key | korrekt gültige Aliase oder vorhandene fail-closed Zulassung; niemals falsches Objekt überschreiben |
| K21 | gleiches Source-/Artifactlevel nach Rollback/Retry | Tombstoneguard unverändert wirksam, neuer zulässiger render-only Lifecycle |
| K22 | falscher Meshindex/Materialrange/Bounds/Digest/COM | Ablehnung vor Veröffentlichung, keine teure unbeschränkte Allokation |
| K23 | erste/letzte Collider- oder Bodyinstallation schlägt fehl | keine Leaks und vollständiger alter Zustand oder sticky RecoveryHold |
| K24 | Commitfehler nach einem bereits vorbereiteten Produkt | kein beobachtbarer gemischter persistenter Root; bestehender Recoveryvertrag |
| K25 | Renderpublish/Finalize/Cleanup schlägt fehl | kein erfundenes Applied; echter nachgewiesener Recovery-/Rollbackstatus |
| K26 | duplizierte idempotente Anfrage versus gleiche ID anderer Request | bestehendes Receipt/Conflictverhalten, niemals Doppelanwendung |
| K27 | verzögerter/fehlerhafter Compilerjob, danach Queueabbruch | maximal zwei aktive schwere Jobs, keine neuen Dispatches nach Abbruch, laufende Jobs vollständig abgeräumt |
| K28 | maxCells/Fragments/Colliderbudget und jeweils +1 | Grenzfall wie bisher, Überschreitung fail-closed ohne veränderte Caps |
| K29 | NoOp/Rejected/Timeout im Beobachter | keine künstlichen Nullzeiten, keine neue Sourcegeneration, ursprüngliche Fehlerwirkung |
| K30 | Header-/Telemetrydrop oder deaktivierter Observer | Gamefunktion unverändert; betroffene Performanceevidence nicht gültig |
| K31 | realer Hot-Restore und Cold-Restore, dann Recut | native/Source/Renderbindung stimmt, keine tombstoned Geometrie |
| K32 | real fallender und real schlafender Body, Box und Sphere | echte aktuelle native Pose und vollständige Geometrie-/Massenbilanz |
| K33 | Save-Load-Save bei gleichem Simzustand | ursprüngliche kanonische Bytes/Hashes/Identitäten erhalten |
| K34 | wiederholte zulässige Cut-/Rollback-/Restorefolgen | keine unbeschränkte Job-/Buffer-/GPU-/Aliasretention, Caps bleiben eingehalten |
| K35 | Hestia normaler Start ohne TestBridge | keine neue Debug-/Referenzspielabhängigkeit im Spielerstart |
| K36 | TD-Referenzconsumer ohne Browser/Rapier/Hestia-Content | tatsächlicher bestehender Materializer nutzbar; keine Copy-/Mockkernlösung |

### 9.1 Echte Mechanikoracles

Nicht alle Physikwerte aus derselben getesteten Funktion ableiten. Für eine einzelne belegte Würfelzelle mit gegebener Dichte gelten handprüfbar Volumen `s³`, Masse `rho*s³` und Schwerpunkt im Zellzentrum; diagonal für einen homogenen Würfel um den Schwerpunkt `m*s²/6`, Offdiagonalen 0. Für zwei Zellen das bekannte Parallelachsen-Theorem im separaten kleinen Test verwenden. Keine bestehenden Toleranzen ausweiten. Bei source-/frameabhängigen Koordinaten den tatsächlich geltenden Frame einrechnen.

Große komplexe Fälle vergleichen den unveränderten ursprünglichen Oraclepfad beziehungsweise vorhandene Goldens. Neue cooperative Schritte dürfen mathematische Summenreihenfolge nicht unbemerkt ändern. Browserfälle prüfen echte Rapierzustände; ein fake transport mit echtem Renderer wird genau so bezeichnet.

### 9.2 Lifecycle- und Speicherprüfung

Eine feste 50-Zyklen-Folge aus normalem Load, Cut, zulässigem Rollback/Retry und erneuter Lastbereinigung verwenden, solange sie innerhalb der unveränderten Receiptabmessungen des Szenarios liegt. Falls ein vorhandenes Admissionlimit früher greift, dessen erwartete Ablehnung prüfen, nicht das Limit anheben. Nach definiertem Cleanup müssen offene Jobs, Tickets, native Stageobjekte, neue Geometrien/Materialien und retained Meshbuffer zu ihrer erwarteten Basismenge zurückkehren.

Legitime historisierte Receipts/Tombstones nicht als Leak bezeichnen, aber einen endlichen, im Budget enthaltenen Maximalumfang und Release-/Epochwechsel beweisen. Wachstum bei gleicher kanonischer Szene darf nicht unbegrenzt sein. Heapentwicklung, JS-GC und GPU-Zähler gesondert mit Rohdaten berichten; keine Bytes durch einen ungesicherten `forceGC`-Effekt wegdefinieren.

## 10. Technisch verbindliche visuelle Abnahme

### 10.1 Referenz und Scope

Die bestehende Hestia-Szene am f2ee-Produktstand ist visuelle Nichtregressionsreferenz. Konzeptbilder sind Designinput, keine Runtimegoldens. Kein neuer Kunststil, keine Verringerung der Microvoxelauflösung, keine Entfernung von Gras/Bäumen/Wasser/Schatten für Performance. Korrekturen reproduzierter falscher Geometrie dürfen die erwartete fehlerfreie Szene ändern, müssen aber als konkreter Bugfix belegt werden.

Die technische Abnahme entscheidet der unabhängige Reviewer aus Bild- UND Semantikbelegen. Menschliche Art Direction wird gesammelt **einmal am Ende** vorgelegt. Auf dieses Urteil während rein technischer Korrekturen nicht warten. Der Agent behauptet keine menschliche Zustimmung.

### 10.2 Visual-Matrix

| ID | Aufnahme / Interaktion | Technisches Muss |
|---|---|---|
| G-V01 | normaler Cutinput, Blick weiterhin bewegen | sofortige ehrliche Pending-/Toolreaktion: p95 Input→Pending-Render ≤33,34 ms in separater Diagnose; Kamera bleibt steuerbar, keine Applied-Behauptung vor Commit |
| G-V02 | Quarry Box vor/nach | sichtbare exakte Öffnung, passende Colliderabdeckung, keine alte Oberfläche oder doppelte Innenfläche |
| G-V03 | Quarry Sphere vor/nach | bestehende quantisierte Kugelsemantik, keine glatte Ersatzhülle |
| G-V04 | Rock arm nach Trennung | abgetrenntes Volumen verschwindet exakt aus Terrain und erscheint einmal als korrekt platzierter nativer Body |
| G-V05 | bewegter Bodyrecut | Childgeometry folgt aktueller nativer Pose; kein Sprung zur Inputpose, kein Frame mit altem Parent plus neuen Childs |
| G-V06 | schlafender/fallender Body | korrektes Recut-/Wake-/Fallverhalten; kein Einfrieren durch lange Vorbereitung und kein Visibility-Fake |
| G-V07 | Hot-/Cold-Restore, dann Cut | kein fehlender/überschriebener Teil, keine tombstoned oder wiederauferstandene alte Representation |
| G-V08 | Rollback/Retry und Rendererfehler | alte bestätigte Szene bleibt vollständig oder Recovery wird korrekt angezeigt; keine halbe erfolgreiche Szene |
| G-V09 | Licht/Caster/Geometrie verändern | Schatten aktualisieren sich korrekt; statische Szene benötigt keine unnötige Cut-bedingte Dauerinvalidierung |
| G-V10 | Sektor-/Brickrand und gemischte Materialien | keine unerwarteten Risse, Flimmerflächen, falschen Materialfarben oder Normalen |
| G-V11 | Pause/Resume/Inspect und Pointer-Lock-Verlust | bestehende explizite Nutzeraktion, keine Geisterinputs, kein automatischer unerlaubter Relock |
| G-V12 | normaler Spielerstart | keine TestBridge, keine TD-Testanzeige, keine neue Debugdatenflut und keine Referenzfixture statt Hestia |

Je Case tatsächliche Source-/Build-/Szenario-/Kamerabindung, Auflösung, DPR und Rohaufnahmen speichern. Statische Vergleichsbilder nach identischer deterministischer Szenensituation aufnehmen, nicht nur nach gleicher Wallclockdauer. Bei bewegten Bodies die aktuelle native Pose und die sourcegebundene lokale Geometrie als semantisches Oracle verwenden; ein anderer echter Simtick ist kein automatischer Pixeldefekt.

### 10.3 Pixel- und Semantikoracles

Bestehende engere akzeptierte ROI-Toleranzen bleiben bestehen. Für neue statische Nichtregressions-ROIs gilt als V3-Startvertrag maximal 0,1 % abweichende Pixel bei identischer Captureumgebung und unveränderten semantischen Flächen; Pixelvergleichsschwelle 0,1 im vorhandenen Vergleichstool. Toleranzen vor Candidatecapture fixieren, nicht nach den Ergebnissen vergrößern.

Dynamische Wolken/Wasser/HUD-Zeiten nur in **vorher benannten** dynamischen ROIs maskieren, niemals Schnittfläche, Body, Schattenkontakt oder relevante UIfehler. Sind deterministische statische Pixelbedingungen nicht herstellbar, das genaue Hindernis nennen und stärkere geometrische/posegebundene Oracles sowie menschlich überprüfte Rohaufnahmen liefern. Nicht automatisch PASS vergeben oder die gesamte Szene maskieren. Technische automatische Pixelabnahme und menschliche Freigabe getrennt halten.

Für tatsächliche Cut-Geometrie zuerst exakte Zell-/Mesh-/Collider-/Source-/Owner-Übereinstimmung prüfen; ein schöner Screenshot reicht nicht. Sichtbare Leerstellen bei falscher Kollision sind Fehler, genauso wie korrekte Collision mit weiterhin sichtbarem Parentmesh.

### 10.4 Capture nicht zum Benchmark machen

Screenshots, kurze lokale canvasbezogene Clips und Trace-Debugläufe gehören in eine separate Visual-/Diagnoselane. Die formale Performance-Serie ist capturefrei. Neue Beauty-Goldens nicht automatisch promoten. Ein neues Testfixture-Golden ist nur mit unabhängigem fachlichem Oracle und Review zulässig; bestehende Goldens bleiben unverändert.

## 11. R01 innerhalb dieses Auftrags: wirklicher zweiter Kernverbraucher

### 11.1 Gewählter Scope

Ein synthetischer headless TD-Begehbarkeitsverbraucher verwendet **denselben** `materializeAdaptiveBrick`-Leaf-Export. Hestias Aufruf, kanonische Kernsemantik und normaler Spieleinstieg werden dafür nicht verändert. Keine Packageextraktion und keine Kernelkopie als Vorbedingung. Das ist ein erster Wiederverwendungsnachweis, noch keine universelle Enginebibliothek.

**Vorgeschlagene neue Pfade, nach Inventur bei Kollision mit bestehenden Dateien sinnvoll wiederverwenden:**

```text
apps/weltraum-browser/tests/reference/tdWalkabilityReference.ts
apps/weltraum-browser/tests/unit/td-walkability-reference.test.ts
```

Der direkte Leaf-Import des Referenzconsumers bleibt:

```ts
import {
  materializeAdaptiveBrick,
  type MaterializeAdaptiveBrickInput
} from "../../src/voxel/adaptive/materialization";
```

Diese relative Importform gilt für die vorgeschlagene Datei in `tests/reference`. Nicht aus einem Produktentry importieren. Weder `hvpBootstrap`, Hestia-Materialregistries, native Physics noch Three sind zulässige Dependencies dieses Referenzmoduls. APIkonstruktoren für Inputs in Tests aus ihren tatsächlich vorhandenen neutralen Leafmodulen importieren, nicht ein neues öffentliches Package behaupten.

### 11.2 Konkrete Fixture und Semantik

Dies ist ein absichtlich kleines synthetisches Rasterprofil, keine menschenmaßstäbliche Navigationsphysik:

- Ein vorhandener Level-4-Brick mit Zellgröße 1 Quantum, 16×16×16 Zellen und 0,125 m Quantum.
- Ausgabe: 16×16 Begehbarkeitsbytes, X-fastest: `x + 16*z`.
- Jede Spalte benötigt in lokaler y-Schicht 0 eine voll belegte, registrierte Bodenzelle.
- Lokale y-Schichten 1 und 2 müssen beide frei sein. Sie repräsentieren nur die definierte synthetische Clearance dieses Tests, keinen Hestia-Avatar.
- Andere Level, nicht vollständig vorliegende Kanäle und nichtbinäre Occupancy gehören nicht zu diesem Referenzprofil und werden explizit abgewiesen.
- Nicht registriertes Material einer belegten geprüften Zelle ist ein Fehler, nicht automatisch Air oder walkable.
- Ergebnis referenziert den tatsächlichen kanonischen Brick-Contenthash. Walkability ist ein Derivat, keine neue Sourceauthority.
- Keine Supportanalyse, strukturellen Brüche, Collider oder Bodyinitialisierung. Kein Pfadfinder, HP-System, Tower-UI oder Savevertrag.

**Basisfixture:** konstanter Air-Basefield, AddBox für Boden mit min `(0,0,0)` inklusive und max `(16,1,16)` exklusive. Material-ID neutral, etwa `td.ref.solid`, nach tatsächlichem Stable-ID-Vertrag. Standardausgabe 256 begehbare Spalten.

**Hindernisfixture:** zusätzliche AddBox min `(6,1,6)`, max `(8,2,8)`: genau vier blockierte Spalten. Die einzigen null-Indices sind **102,103,118,119**, alle übrigen 252 Bytes sind 1.

**Bodenlochfixture:** SubtractBox min `(3,0,4)`, max `(4,1,5)`: genau Index **67** blockiert, 255 begehbar.

**Niedrige-Decke-Fixture:** AddBox min `(2,2,5)`, max `(3,3,6)`: genau Index **82** blockiert, 255 begehbar.

**Kombinierte Fixture:** die obigen Änderungen zusammen: genau **67,82,102,103,118,119** blockiert, 250 begehbar. Handprüfbare Literalindices als Testoracle verwenden, nicht die erwartete Ausgabe vom getesteten Kern neu generieren.

### 11.3 Umsetzungsmuster des dünnen Consumers

Die vorhandene Ergebnisform an der neuen Source prüfen. Das folgende Muster passt zur gelesenen Materializerform mit `occupancy`, `material`, `cellCount` und `cellSizeQuantum`. Es ist ein Codevorschlag, kein ausgeführter Produktnachweis:

```ts
import {
  materializeAdaptiveBrick,
  type MaterializeAdaptiveBrickInput
} from "../../src/voxel/adaptive/materialization";

export function buildTdWalkabilityReference(
  input: MaterializeAdaptiveBrickInput,
  allowedMaterials: ReadonlySet<string>
) {
  const brick = materializeAdaptiveBrick(input); // genau eine echte Ableitung
  if (brick.cellCount !== 4096 || brick.cellSizeQuantum !== 1 ||
      brick.occupancy.length !== 4096 || brick.material.length !== 4096) {
    throw new Error("TD_REF_UNSUPPORTED_COVERAGE");
  }
  const occupied = (x: number, y: number, z: number): boolean => {
    const index = x + 16 * (y + 16 * z);
    const value = brick.occupancy[index];
    const material = brick.material[index];
    if (value !== 0 && value !== 1) {
      throw new Error("TD_REF_UNSUPPORTED_OCCUPANCY");
    }
    if (value === 1 &&
        (typeof material !== "string" || !allowedMaterials.has(material))) {
      throw new Error("TD_REF_UNKNOWN_MATERIAL");
    }
    return value === 1;
  };
  const walkable = new Uint8Array(256);
  for (let z = 0; z < 16; z += 1) {
    for (let x = 0; x < 16; x += 1) {
      // Keine Short-Circuit-Auslassung unbekannter Clearance-Zellen:
      // alle drei Zellen nach demselben Profil tatsächlich prüfen.
      const floor = occupied(x, 0, z);
      const low = occupied(x, 1, z);
      const high = occupied(x, 2, z);
      walkable[x + 16 * z] = floor && !low && !high ? 1 : 0;
    }
  }
  return {
    sourceContentHash: brick.contentHash,
    originQuantum: brick.key.originQuantum,
    cellSizeMeters: brick.cellSizeMeters,
    walkable
  };
}
```

Der neue `walkable`-Buffer gehört dem Verbraucher; keine Kernchannels als beschreibbaren Alias herausreichen. Metadaten befolgen den vorhandenen Immutable-Vertrag. Ein unbekannter Materialfehler auch dann prüfen, wenn dieselbe Spalte schon wegen eines Bodenlochs blockiert wäre; deshalb keine verkürzte `&&`-Abfrage mit ausgelassener Validation.

### 11.4 Konkrete Tests und Kosten

- [ ] Die fünf oben beschriebenen echten Materializerinputs über vorhandene Basefield-/Key-/Editjournal-Konstruktoren erzeugen. Kein Mock für `materializeAdaptiveBrick`.
- [ ] Literalindices, Count und Contenthashbezug prüfen. Gleiche Inputs wiederholt ergeben gleichen Inhalt; unterschiedliche gültige Originübersetzung mit konsistent übersetzten Edits bleibt lokal gleich, aber der reale sourcegebundene Hash darf sich erwartungsgemäß unterscheiden.
- [ ] Ein nicht unterstützter gröberer Level wird abgelehnt, keine still angenommene 0,125-m-Abdeckung.
- [ ] Nicht registriertes verwendetes Material wird abgelehnt, auch in bereits blockierter Spalte.
- [ ] Consumer verändert Input, Journal oder Kernkanäle nicht. Mutation seiner Ausgabe beeinflusst keinen späteren Kernlauf.
- [ ] Import-/Typgraph bis zu allen transitiven Abhängigkeiten prüfen. Ohne `window`, DOM, Workerconstructor und Rapierinitialisierung tatsächlich in einer Node-Testumgebung ausführen. Kein Mock von Browserglobalen, um die Freiheit vorzutäuschen.
- [ ] Normale Hestia-Entrypoint-/Bundleinventur erreicht weder Consumer noch seine Fixtures. Bestehende Hestia-/Materializergoldens auf finalem integrierten Stand unverändert bestehen lassen.
- [ ] Kosten nachweisen: eine Brickmaterialisierung, danach 768 Zellprüfungen und ein zusätzlicher 256-Byte-Ausgabebuffer plus konstante Metadaten. Keine zusätzliche Materialisierung pro Spalte/Zelle, kein JSONtransport, kein neuer Cache und kein Framework.

**Ergebnis:** `REUSE_SLICE_PASS`, wenn derselbe verbesserte Kernel ohne Hestia/Renderer/Nativephysik einen zweiten konkreten fachlichen Verbraucher trägt. Nicht behaupten, dass damit allgemeine RTS-Navigation, ein veröffentlichbares Multi-Game-Package oder universelle Zerstörung bereits implementiert seien.

## 12. Selbstständige Korrekturschleife und Kostenkontrolle

### 12.1 Entscheidung nach jedem Messlauf

```text
Korrektheitsfehler?
  -> reproduzieren -> minimal beheben -> passende Unit/Native/E2E prüfen
Kein Korrektheitsfehler, echter kritischer Rechenanteil zu langsam?
  -> genau eine belegte Hypothese -> begrenzter Patch -> A/B -> Review
Rechenarbeit geringer, aber Timer/Frame/Hold weiter zu lang?
  -> Slices, Queue, Interleaving und tatsächliche Holdgrenzen prüfen
Qualifikation besteht?
  -> finalen Sourcefreeze -> formale Serie -> Finalreview
Formale Serie verletzt Gate?
  -> Report erhalten -> konkretes Delta optimieren -> neue volle Serie
Alle technischen Gates erfüllt?
  -> Featurestand publizieren -> ein finaler menschlicher Handoff
```

Keine wiederholte Bitte „Soll ich den nächsten Fix starten?“ innerhalb dieses Scopes. Keine Aufgabe nach einem bloßen Plan als abgeschlossen erklären. Auch ein genauer Bericht über einen reproduzierbaren Fehler ist noch nicht die geforderte Behebung, solange diese zulässig ist.

### 12.2 Umgang mit fehlendem Fortschritt

Ein Patch, der nur Phasennamen verschiebt, keine Arbeit reduziert und keinen nachgewiesenen Livenessgewinn bringt, wird nicht integriert. Nach zwei erfolglosen Varianten derselben Hypothese muss ein frischer starker Reviewer Ursache und Beweis prüfen. Nach drei unterschiedlichen widerlegten Hypothesen im selben Engpass genau einmal neue Attribution durchführen statt immer weiter Architektur zu bauen.

Ergibt diese Attribution, dass das Ziel mit den freigegebenen Mitteln weiterhin nicht erreicht ist, zulässige nächste belegte Änderung selbst ausführen. Ergibt sie dagegen, dass eine ausgeschlossene Semantik-/Engine-/Capänderung notwendig wäre oder entscheidende Messumgebung fehlt, den getesteten Zwischenstand und eine konkrete Grenze liefern. Kein endloses autonomes Ressourcenverbrennen und keine falsche Erfolgsmeldung. Ein schweres Ziel ist kein Grund, ohne Diagnose aufzugeben.

### 12.3 Kommunikationsregel

Der Orchestrator gibt kurze Fortschrittsmeldungen bei echten Meilensteinen: erster bestätigter Defekt, messbarer Gewinn, Source-/Native-Vertrag stabil, erste komplette Visualmatrix, formales Ergebnis. Diese Meldungen verlangen keine Nutzerantwort. Keine Flut aus 30 Microcard-Statusmeldungen.

Nur eine gebündelte finale Entscheidungsvorlage. Echte Zugriffs-/Scopeblocker dürfen früher transparent gemeldet werden; unabhängig zulässige Arbeit läuft trotzdem weiter. Der Auftrag verspricht keine Durchführung außerhalb der Fähigkeiten des tatsächlich verwendeten Harnesses.

## 13. Kopierbare Rollenprompts für den Orchestrator

Diese Vorlagen sind Bestandteil der einzigen Gesamtdatei. Der Orchestrator ergänzt seine tatsächlich ausgefüllte aktuelle Arbeitskarte. Das sind keine Anhänge, die Benni nachreichen muss.

### 13.1 Startprompt des Orchestrators

```text
Du bist der einzige primäre orchestrator-alternate für Hestia Cut RT V3.
Führe den vollständigen Auftrag dieses Dokuments aus, nicht nur Planung.
Nutze die vorhandene bestätigte starke Route und den bestehenden Tracker.
Du darfst unabhängige worker-alternate-Reviewer selbst starten,
scopekonforme Fixes implementieren lassen, die definierten internen
Vorbereitungsprotokolle und Messgrenzen umsetzen, R01 liefern sowie
Tests und formale Abnahme nach der Qualifikation selbst ausführen.

Die alten rein manuellen Review-/Write-Zwischenstopps sind für den
expliziten V3-Scope supersediert. Die harten Produktinvarianten nicht.
Kein Plannotator, kein neues Modell-/Scheduler-/Engineframework.
Vor jeder Delegation reale Codeanker, Einheiten, Ownership, Fehlerfälle,
Tests und Kosten auflösen. Schwächere Worker raten keine Architektur.

Binde f2ee73cfbfa80b6c09d540c784d3ad426ae83a04 als Ausgangspunkt.
Nutze eigene isolierte V3-Branches und vollständige Source-/Evidence-
Bindung. Stelle nach internen Reviews und Tests die nächste zulässige
Karte selbst zu, ohne neue Ownernachricht.

Stoppe nicht bei einem Reviewerprompt oder READY_FOR_OWNER_DECISION
für bereits freigegebene technische Arbeit. Liefere am Ende echten
Code, überprüfte Ergebnisse und genau eine Abschlussentscheidung.
Keine PR, kein Main-Merge, kein Force-Push, keine Golden-/Caplockerung.
Menschliche Art Direction bleibt final und wird nicht erfunden.
```

### 13.2 Implementiererprompt

```text
Du bist worker-alternate als begrenzter Implementierer.
Du erhältst eine konkret gebundene V3-Karte, ihre API-/Dateianhänge
und die einschlägigen Invarianten aus diesem Gesamtauftrag.

Lies vor dem Write die tatsächlichen Funktionen und vorhandenen Tests.
Liefere einen kurzen Readback zu Datenquelle, Einheiten, Besitz,
Fehlerfällen und unabhängigem Oracle. Bei Unklarheit frage den
Orchestrator oder lies die Source, nicht den Nutzer.

Ändere nur dein Write-Set. Keine Delegation und keine fremden Worktrees.
Kein eigenständiger neuer Framework-, Cache-, Plugin- oder Solverentwurf.
Keine Kopie des Kernalgorithmus. Bestehende Prüfungen und Goldens erhalten.
Kein as-any-Beweis, kein leerer Catch als Erfolg, kein Fake-Applied.
Neue Allokationen haben Bound, Owner und Cleanup. Yield betrifft auch
teure Unterfunktionen, nicht nur die äußere Schleife.

Nutze vorhandene Testwerkzeuge. Reproduziere einen Bug zuerst; bei rein
semantikgleicher Optimierung vorab gesicherte Oracles verwenden.
Führe fokussierte Tests und Diffcheck aus. Berichte exakte Befehle,
Exitcodes, Source-SHA, Ergebnisdateien und offene Risiken.
Keine eigene unabhängige Abnahme oder Mainintegration.
Bei Reviewbefund eng korrigieren, keine neue globale Umstrukturierung.
```

### 13.3 Unabhängiger Reviewerprompt

```text
Du bist eine frische worker-alternate-Session als unabhängiger starker
Reviewer. Du warst nicht Writer des vorgelegten Diffs. Prüfe tatsächliche
Source und Rohdaten, nicht die Selbsteinschätzung des Implementierers.

Prüfe Scope, semantische Parität, aktuelle native Posebindung,
Single-Owner-Ausstellung, Pause/Cancel/Dispose/Reentranz, Bufferbesitz,
realen kritischen Pfad und neue Ressourcenlimits. Alte Test-PASS-Angaben
bleiben von eigenen Läufen getrennt. Vorhandene negative Fälle nicht
wegen neuer APIs entfernen.

Prüfe echte Runtimeimporte, nicht nur Typnamen. Ein schmaler Wrapper
beweist keine Enginefreiheit. Eine neue kurze Handlerdauer beweist
keine kurze Inputlatenz; ein Photon-/Owner-Visualnachweis wird nicht aus
RenderSubmit oder Pixelthreshold erfunden.

Liefere reproduzierbare Befunde mit Datei:Zeile, Vorbedingungen,
Mechanismus, Konsequenz und kleinstem Fix. Kein Produktwrite.
Gib das Ergebnis direkt an den Orchestrator zurück. Dieser organisiert
Korrekturen und Folgekarten innerhalb des V3-Auftrags selbst.
ACCEPT_WITH_NOTES ist kein Ersatz für ungelesene kritische Teile.
```

### 13.4 Test-/Performanceworkerprompt

```text
Du bist worker-alternate als Tester eines fixierten Kandidaten.
Nutze genau Source, Lockfile, Browser und Gerätekonfiguration aus dem
gebundenen Laufplan. Keine Dependencyupdates, Timeoutlockerungen,
Retries, Ergebnisauswahl oder Golden-Promotion.

Capture/Tracing und formale Messung sind getrennte Läufe.
Jeder geplante Versuch bleibt einschließlich Fehler/Precondition/Timeout
in den Rohdaten. 14 diagnostische Fälle sind kein p95. Formale Population
ist jede einzelne Variante × Temperatur mit 34/33/33 regulären Versuchen.

Prüfe echte Produktmarker, aktuelle native Child-/Source-/Renderbindung,
World-Hold und Drops. Keine UI-Pollzeit als Input und keine Terrain-Hold-
Werte für Body-Cuts. Fehlend bleibt fehlend.

Liefere Rohdaten, Konfigurations- und Quellenhashes, genaue Kommandos,
Exitcodes und alle Abweichungen. Bei ungültiger Umgebung keine Ersatz-
Hardware als formalen Zielnachweis ausgeben. Keine Produktfixes;
Befunde an den Orchestrator, der nötige Korrekturen selbst beauftragt.
```

## 14. Genau ein Abschluss, keine neue Promptkette

### 14.1 Minimale Ergebnisstruktur

Bestehendes Arbeitsjournal weiterverwenden. Für neue V3-Ergebnisse genügt eine kompakte Struktur:

```text
docs/research/hvp-cut-rt-v3/RESULT.md
  Ergebnis, technische Gate-Tabelle, erkannte/behobene Defekte,
  unveränderte Verträge, Reuseumfang, verbleibende echte Grenzen

evidence/hvp-cut-rt-v3/<run-id>/
  tatsächliche neue Rohreports, Code-/Build-/Umgebungsbindung,
  ausgewählte neue sichere Capturedateien und Manifest
```

Der Evidencepfad liegt entweder als neu geprüftes Unterverzeichnis von `apps/weltraum-browser/evidence/` oder in einem ausdrücklich benannten externen Artefaktspeicher. Große Rohdaten nicht ohne Sinn in einen riesigen Codecommit kippen. Ein öffentliches Manifest darf nur tatsächlich veröffentlichte Payloads behaupten; externe Originale als extern deklarieren. Bereits veröffentlichte V2/EV01-Berichte unverändert lassen.

Kein neuer Reviewprompt als Hauptlieferung. Das Ergebnis ist ein implementierter, geprüfter Branch mit einem Report. Ein kleiner maschinenlesbarer Gatelog und die Rohoutputs sind keine zusätzliche Planungsrunde.

### 14.2 Finaler Report

Der Abschluss nennt:

1. Ausgangs-SHA, tatsächliche finale Code-/Test-/Konfigurations-SHA, Evidence-Publikations-SHA, Remote-Branch und tatsächlichen sauberen/unsaubern Worktreestatus.
2. Vollständig gelesenen Reviewumfang und konkrete behobene Defekte; verbleibende Minorhinweise, keine verdeckten Blocker.
3. Pro jeder der 14 formalen Populationen Anzahl, Fehler, p50/p95/p99/max für Input→Applied und RenderSubmit; getrennte Hold-/Slice-/Framewerte.
4. CPU-/Mesh-/Draw-/Trianglepeaks sowie native Ressourcen und Cleanupnachweise.
5. Technische Visualmatrix mit echten Aufnahmen und tatsächlichem Ergebnis; ein zusammengefasster finaler Owner-Visual-Hinweis.
6. Echter Reuse-Slice und seine Tests; keine pauschale Multi-Game-Enginebehauptung.
7. Typecheck, Build, fokussierte Tests, Vollsuite, Native, Browser, Fault/Recovery, Perf, Visual und Reuse jeweils einzeln `PASS`, `FAIL`, `NOT_RUN`, `NOT_PROVEN` oder passend eng `NOT_APPLICABLE`.
8. Exakt welches Ziel noch offen ist und warum, wenn volle Zielerreichung nicht bewiesen ist. Kein „fertig“ bei bekannten Sekundenlatenzen.

Ein späterer reiner Evidencecommit darf Testergebnisse eines vorangegangenen Codecommits tragen, wenn der komplette relevante Source-/Test-/Config-Tree unverändert nachgewiesen ist. Der Commitinhalt wird vor Push gegen Manifestpfade geprüft, auch für Punktdateien unter ignorierten Ordnern. Keine `git add -f`-Verzeichniswildcards; nur einzelne geprüfte Dateien.

### 14.3 Endzustände

| Endzustand | Bedeutung |
|---|---|
| `TECHNICAL_COMPLETE_OWNER_VISUAL_PENDING` | Alle definierten technischen Ziele nachgewiesen, nur finale menschliche Art-/Mergeentscheidung offen. |
| `PARTIAL_TARGET_NOT_MET` | Implementierungen/Fixes geliefert, aber gültig gemessene Ziele nicht erreicht. Konkrete Zahlen und Grenzen offen ausweisen. |
| `PARTIAL_ENVIRONMENT_BLOCKED` | Source-/Codearbeit soweit möglich geliefert, erforderliche Native-/Browser-/Zielhardwareprüfung nicht verfügbar. |
| `PARTIAL_SCOPE_BLOCKED` | Zulässige Arbeit ausgeschöpft, nächster tatsächlich notwendiger Schritt liegt außerhalb der festgelegten Semantik-/Engine-/Capgrenzen. |

Ein fehlender automatischer visueller oder Codebeleg darf nicht unter den menschlichen Owner-Visualrest geschoben werden. `TECHNICAL_COMPLETE_OWNER_VISUAL_PENDING` ist nur bei vollständiger technischer Abnahme zulässig. Mainintegration bleibt unabhängig davon eine Owneraktion.

## 15. Quellenbasis und Grenzen dieses Dokuments

### 15.1 Direkt gelesen bei der Erstellung

GitHub-Read auf dem fest gebundenen f2ee-Stand, kein Produktwrite:

- Branchref `feature/hvp-cut-rt-p00`.
- Vollständiger `CUT-COOPERATIVE-FOLLOWUP-PLAN.md`.
- Vollständige Dateien `rigidRecipe.ts`, `terrainFragment.ts`, `bodyCutSession.ts`, `bodyCut.ts`, `bodyCutPlan.ts`, `structuralIngest.ts`, `voxel/structural/index.ts`, `package.json`.
- Gezielte Bereiche aus `session.ts:285–Ende`, `materialization.ts:215–360`, `massProperties.ts:1–205`, `hvp-cut-rt.spec.ts:1–120,280–Ende`.
- `physicsWorker.ts` wurde breit gelesen; die Toolanzeige war am Ende gekürzt. Deshalb kein Vollständigkeitsanspruch für diese Datei in der Paketerstellung. Ausführender Orchestrator liest alle geänderten relevanten Teile vollständig.
- Der vorherige vollständige externe Reviewauftrag und der V2-Orchestratorvertrag wurden aus den angehängten Dateien gelesen. Die realen lokalen R00-/R01-Ergebnisse wurden hier nicht geöffnet.

Der Container konnte den öffentlichen Raw-GitHub-Pfad wegen DNS nicht abrufen. Daher keine lokale Repoausführung, kein eigener Produktbuild, keine neuen HVP-Benchmarks und keine Prüfung sämtlicher 255 Payloadbytes bei Erstellung dieses Auftrags. Codeanker sind Sourcebeobachtung, nicht Laufzeitnachweis.

### 15.2 Ergänzende Primärdokumentation

Diese Quellen begründen lediglich einzelne Plattform-/Testregeln, keine Hestia-Benchmarks:

- Chrome for Developers, `Use scheduler.yield() to break up long tasks`: https://developer.chrome.com/blog/use-scheduler-yield
- MDN, `Scheduler.yield()` und Worker-Verfügbarkeit: https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield
- Playwright, visuelle Vergleiche und Umgebungsabhängigkeit: https://playwright.dev/docs/test-snapshots
- Playwright, teure Traceaufnahme getrennt behandeln: https://playwright.dev/docs/best-practices

Das alte G17-QA-Dokument ist eine historische fachliche Referenz für getrennte semantische Oracles, technische Pixelprüfung und menschliche Art Direction, keine neue Implementierungsfreigabe aller dort beschriebenen Editorfunktionen.

### 15.3 Selbstenthaltenheit

Alle in diesem Dokument genannten Arbeitskarten, Zielwerte, Übergangsregeln, Reviewer-/Workerprompts und der TD-Fallback sind hier enthalten. Weitere alte `02`-/`03`-Dateien oder ein ganzer Researcharchivsatz sind **keine** Voraussetzung zur Auslegung des Auftrags. Echte Source, Laufzeitumgebung und tatsächliche Rohdaten können selbstverständlich nicht durch einen Plantext ersetzt werden.

Neue V3-Zahlen sind Zielentscheidungen für diesen Auftrag; bestehende Quellenangaben und Autorenmessungen wurden nicht still als bereits erreichte Ergebnisse übernommen. Die Aufgabe des ausführenden Agents ist die Implementierung und der Nachweis, nicht nur die Weitergabe dieses Dokuments.
