# Common Contract Vocabulary V1 Proposal

Status: `REQUIRES_OWNER_DECISION`  
Stand: 2026-08-12  
Geltung: engine-neutraler Vorschlag, keine Implementierungs- oder Paketexistenzbehauptung

## 1. Ergebnis in einem Satz

Die Berichte liefern genug Material für ein gemeinsames Vokabular, aber noch keinen widerspruchsfreien V1-Vertrag: G06, G15 und G16 liegen jeweils in zwei materiell verschiedenen Fassungen vor, und mehrere Grundbegriffe besitzen inkompatible Wire-Formen oder Lebenszyklen. Dieser Vorschlag kann daher erst nach den in Abschnitt 6 benannten Ownerentscheidungen als Input für G18 freigegeben werden.

## 2. Quellenbasis und Lesestatus

Vollständig gelesen wurden die vorhandenen Abschlussberichte zu G02, G05, G06, G07, G08, G09, G10, G11, G13, G15, G16 und G17. Byte-identische Mehrfachkopien wurden als eine Inhaltsfassung behandelt. Inhaltlich verschiedene Fassungen wurden nicht zusammengezogen:

| Kürzel | Inhaltsfassung | Befund |
|---|---|---|
| G02 | `G02_unified_ingame_authoring_platform_abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung |
| G05 | `G05_Mission_Dialog_Narrative_Authoring_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung |
| G06-A | `G06_NPC_Gesellschaft_Simulations_LOD_Abschlussbericht_2026-08-12` | Hashpräfix `5d977174`; Status und Gates weichen von G06-B ab |
| G06-B | `G06_NPC_Gesellschaft_Verhalten_Simulations_LOD_Abschlussbericht_2026-08-12` | Hashpräfix `e75c5e35`; eigenständige Vertragsfassung |
| G07 | `G07_Fraktionen_Gilden_Reputation_Recht_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung |
| G08 | `G08_Wirtschaft_Handel_Produktion_Logistik_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung |
| G09 | `G09_Ship_Vehicle_Drone_Builder_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung; selbst `REQUIRES_OWNER_DECISION` |
| G10 | `G10_Planet_System_Orbit_Editor_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung |
| G11 | `G11_AI_Authoring_Copilot_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung |
| G13 | `G13_Content_Data_Modding_Versioning_Hot_Reload_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung; selbst `REQUIRES_OWNER_DECISION` |
| G15-A | `G15_Combat_Mining_Drone_Operations_Abschlussbericht_2026-08-12` | Hashpräfix `411659af`; `REQUIRES_OWNER_DECISION` |
| G15-B | `G15_combat_mining_drone_operations_abschlussbericht_2026-08-12` | Hashpräfix `a4c6f95c`; `READY_FOR_SYNTHESIS`, aber materiell abweichend |
| G16-A | G16-Fassung mit `ApprovedCityPlan`, `ApprovalRecord` und eigenem `CityEventLogV1` | Hashpräfix `bac5d04f`; `REQUIRES_SPIKE` |
| G16-B | G16-Fassung mit globalem `PlanetEvent` und `AuthoredReservationV1` | Hashpräfix `0e5f31c3`; `REQUIRES_SPIKE` |
| G17 | `G17_Editor_QA_Validation_Playwright_Automation_Abschlussbericht_2026-08-12` | eine eindeutige Inhaltsfassung; selbst `REQUIRES_OWNER_DECISION` |

Zusätzlich wurden die bereitgestellten Forschungs-, Audit-, Benchmark-, Telemetrie- und Reviewberichte vollständig gelesen. Sie werden als ergänzende Evidenz verwendet, nicht als Ersatz für die G-Domänenowner. Besonders relevant sind der explizite `VoxelSourceBindingV1`, der `PlanetEvent`, die BR-01/BR-02/BR-03/BR-04-Vertragsdrifts und die dort belegte, nicht verlustfrei abbildbare Capability-Taxonomie.

Quellenverweise im Dokument verwenden `Gxx:Zeilen`. Bei Varianten wird immer `G06-A`, `G06-B`, `G15-A`, `G15-B`, `G16-A` oder `G16-B` genannt. Eine unqualifizierte Referenz auf ein kollidierendes Gate ist unzulässig.

## 3. Auslegungsregeln des Vorschlags

1. Ein gemeinsamer Name bezeichnet genau eine Lebensdauer, Authority und Vergleichsregel.
2. Ein gleiches Wort mit anderer Semantik erhält einen qualifizierten Namen. Beispiele sind `ChangeTransactionId` und `LedgerTransactionId` sowie `AuthorityEpoch`, `SimulationEpochId`, `SystemEpochId` und `ContentEpoch`.
3. Ein Domainvertrag komponiert den gemeinsamen Spine. Er kopiert ihn nicht und ändert keine Pflichtfelder oder Invarianten.
4. Schema-, Content-, Policy-, Algorithmus-, Package- und Revisionsachsen bleiben getrennt.
5. Ein Digest ist nur mit Algorithmus und versioniertem Digestprofil vergleichbar.
6. `Unknown`, `MissingCoverage`, `unsupported`, `unavailable`, `invalid`, `error`, `false`, `0`, `Air` und `Detached` sind verschiedene Aussagen.
7. Presentation, Renderer, Worker und Telemetrie dürfen Authority-Daten transportieren oder projizieren, aber nicht erzeugen oder neu deuten.
8. Die vorgeschlagenen Paketnamen in Abschnitt 5 sind Sollgrenzen. Dieses Dokument behauptet ausdrücklich nicht, dass diese Pakete schon existieren.

## 4. Engine-neutraler Crosswalk

### 4.1 `StableId`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | `StableId`, `StableId<K>`, `CanonicalId`, `EntityId`, `PackageId`, `EntryId`, `actorRef`, `resourceRef`, Material-/Palette-IDs, Run-/Record-/Plan-IDs. G02/G07 verwenden nackte Strings; G05 gebrandete, namespaced IDs; G08 und BR-01 eine Lowercase-Grammatik; G13 eigene zusammengesetzte Package-/Entry-Grammatiken; G06-A fordert opake, mindestens 128-Bit-äquivalente IDs. BR-03 macht sein `planId` zum Digest kanonischer Planbytes, während G15-B `planId` und `planHash` trennt; lokale Slots sind wiederum nur scope-spezifische IDs. |
| 2. Kanonischer Name | `StableId<K>` als typisierter semantischer Grundbegriff; serialisierte fachübergreifende Referenz als `StableRef { kind, value }`. Empfohlener Wire-Baukasten: lowercase `StableIdAtom` mit höchstens 128 Zeichen; zusammengesetzte Refs werden aus Atomen und zentral definierten Trennzeichen gebildet. |
| 3. Semantischer Owner | vorgeschlagener Core-Contract-Owner. Der Owner eines konkreten ID-Kinds besitzt Namespace, Erzeugung, Eindeutigkeitsscope und Retention. |
| 4. Minimale Felder | Skalar innerhalb eines bekannten Schemas: `value`. Generische Referenz: `kind`, `value`. Der Kindvertrag muss Scope, Grammatik, Case-Regel, Erzeugung und Nichtwiederverwendung festlegen. |
| 5. Importierende Domains | alle G-Domains; insbesondere Commands, Events, Content, Validation, Persistence und Audit. |
| 6. Erweiternde Domains | jede Domain darf gebrandete Aliase wie `NpcId`, `FactionId`, `PackageId`, `CommandId` oder `CelestialBodyId` definieren. G13 erweitert die Grammatik für Package-/Entry-IDs; Domains dürfen deterministische Ableitungsprofile definieren. |
| 7. Ausdrücklich nicht enthalten | Anzeigename, Rolle, Typbeweis durch Stringpräfix allein, Revision, Digest, Position, Chunk-/Array-/GPU-/Meshindex, mutable Runtimehandle, Autorisierungsnachweis. |
| 8. Migration und Versionsgrenze | veröffentlichte IDs werden nicht normalisiert, umbenannt oder wiederverwendet. Split/Merge erzeugt neue IDs mit expliziter Lineage. Alias und Tombstone sind versionierte Records. Ein Allocatorwechsel ändert keine bestehenden Werte. G02 verbietet Wiederverwendung; G05/G13 verlangen stabile authored IDs (G02:506-512; G05:446-453; G13:361-404). |
| 9. Offener Konflikt und Ownerentscheidung | `D-04`: Atomgrammatik, Trennzeichen, Maximallänge, Case-Regel, Entropie für Runtime-IDs und Namespace-Governance ratifizieren. G08/BR-01, G13, G05 und G06-A sind ohne diese Entscheidung nicht wire-kompatibel. |

### 4.2 `SchemaVersion`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | kombinierte Literale wie `weltraum.../v1`, `npc-person-v1` oder `br03.../v1`; numerisches `schemaVersion: 1\|2`; getrenntes `schema`/`schemaVersion`; `contractId`, `contractVersion`, `protocolVersion`, JSON-Schema `$schema`/`$id`. Diese Varianten werden zusätzlich mit Package-, Content-, Algorithmus-, Policy- und Canonicalization-Versionen vermischt. |
| 2. Kanonischer Name | `SchemaRef` mit getrennten Bestandteilen `schemaId` und `schemaVersion`. `SchemaVersion` ist eine geschlossene Version innerhalb genau einer `schemaId`, nicht global vergleichbar. |
| 3. Semantischer Owner | Core-Schema-Governance besitzt Form und Evolutionsregeln; jede Domain besitzt ihre Schema-IDs, Versionen und Migratoren. |
| 4. Minimale Felder | `schemaId`, `schemaVersion`. Empfohlen ist ein nichtnegativer kanonischer Dezimalwert für die Version; die endgültige Wire-Form bleibt `D-05`. |
| 5. Importierende Domains | alle Domains und alle persistierten oder prozessübergreifenden Envelopes. |
| 6. Erweiternde Domains | Domains registrieren eigene IDs, geschlossene Felder, Extension Points und gerichtete Migrationsketten. |
| 7. Ausdrücklich nicht enthalten | JSON-Schema-Dialekt, Package-Semver, ContentRevision, AuthorityRevision, ProtocolVersion, RegistryVersion, PolicyVersion, AlgorithmVersion oder CanonicalizationVersion. |
| 8. Migration und Versionsgrenze | unbekannte Versionen fail closed. Migration ist explizit, deterministisch, wiederholbar und erzeugt neue Bytes, neue Digests und einen Receipt. Kein In-place-Upgrade und kein stilles Ignorieren unbekannter Felder. G13 und G17 liefern die stärksten Regeln; G09 fordert V1→V2-Receipt und Originalerhalt (G13:406-460; G17:515-544; G09:222-235, 767-780). |
| 9. Offener Konflikt und Ownerentscheidung | `D-05`: Zahl gegenüber Stringliteral, Breite, kanonische Schema-ID-Form und Beziehung zu bestehenden kombinierten Literalen entscheiden. |

### 4.3 `AuthorityEpoch`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | `authorityEpoch`, `sourceAuthorityEpoch`, Authority-/Worker-`Epoch`, `lodEpoch`, `workerGeneration`, G13 `contentEpoch`, G10 `SystemEpochV1`, G16 `Planning Epoch`. Nur G11, G15-A und G06-B verwenden eine klare Authority-Staleness-Semantik; G15-B lässt sie in Kerncommands aus. |
| 2. Kanonischer Name | `AuthorityEpochRef`. Ein `AuthorityEpoch` bezeichnet genau eine ununterbrochene Tenure einer benannten Authority über einen benannten Scope. |
| 3. Semantischer Owner | vorgeschlagener Authority-/Concurrency-Owner. |
| 4. Minimale Felder | `authorityRef`, `epochId`. Revision steht separat im `SourceBinding`. |
| 5. Importierende Domains | Command, Transaction, Preview, Approval, Worker-Adoption, Simulation, Eventing und alle abgeleiteten Artefakte mit Staleness-Risiko. |
| 6. Erweiternde Domains | Domains definieren Authority-Scope-Refs. G06 darf `lodEpoch`, G13 `contentEpoch` und Worker dürfen `generationToken` als getrennte Typen führen. |
| 7. Ausdrücklich nicht enthalten | Revision, SimulationTick, Orbit-/Systemzeit, Planning Epoch, LOD-Epoche, Worker Generation, UTC oder Algorithmusgeneration. |
| 8. Migration und Versionsgrenze | Wechsel, Restart, Failover oder Authority-Übernahme erzeugt eine neue Epoch. Offene Previews, Approvals und Workerresultate der alten Epoch sind stale und werden nicht rebased. G11 verlangt diese Invalidierung; G15-A startet bei Remote→Near eine neue Epoch (G11:1492-1499; G15-A:1066-1077). |
| 9. Offener Konflikt und Ownerentscheidung | `D-01`, `D-02`, `D-03`, `D-06`: Wire-Typ, Monotonie oder Zufallstoken, Wechselregeln sowie Umgang mit G15-B und G06-A festlegen. |

### 4.4 `Revision`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | World-, Workspace-, Document-, Aggregate-, Craft-, Chunk-, Artifact-, Content-, Task-, Operation-, Source-, View-, Browser-, Device- und historische Git-Revision. Wire-Formen sind `number`, `bigint`, opaker String und Dezimalstring. Eventsequenzen und Source-SHAs werden teilweise ebenfalls Revision genannt. |
| 2. Kanonischer Name | `Revision` als gebrandeter monotoner Stand eines benannten Resources innerhalb derselben Authority-Epoch. Persistierte Felder sollen qualifiziert heißen, etwa `documentRevision` oder `craftRevision`. |
| 3. Semantischer Owner | Authority-/Concurrency-Owner; der jeweilige Aggregate-Owner bestimmt Inkrement und Commitpunkt. |
| 4. Minimale Felder | im Binding: `resourceRef`, `authorityRef`, `authorityEpoch`, `revision`. Empfohlene Wire-Form: nichtnegativer kanonischer `DecimalUint64`. |
| 5. Importierende Domains | alle Domains mit CAS, Replay, Persistence, Worker-Adoption, Preview oder derived Artefakten. |
| 6. Erweiternde Domains | Domain-Aliase und Aggregate-Grenzen. Derived Artefakte dürfen eine eigene `artifactRevision` führen, müssen aber die Source-Revision importieren. |
| 7. Ausdrücklich nicht enthalten | Schema-, Package-, Content- oder Algorithmusversion; Digest; Tick; Eventsequence; AuthorityEpoch; Git SHA; View-/Cachegeneration. |
| 8. Migration und Versionsgrenze | Revisionen werden nicht zwischen Authorities oder Epochen verglichen und nicht still renummeriert. Eine Schemamigration erzeugt einen neuen autoritativen Stand mit Source-Lineage. Stale CAS fail closed; kein Last-Writer-Wins. Empfohlener No-op: keine Revisionsinkrementierung, aber expliziter No-op-Receipt nach G17 (G17:236-245, 281-306). |
| 9. Offener Konflikt und Ownerentscheidung | `D-06`: Wire-Typ, Scope, Mehrfachaggregate, No-op-Regel, Reset und Counter-Overflow ratifizieren. |

### 4.5 `ContentDigest`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | `Sha256`, `contentHash`, `stateHash`, `payloadHash`, `semanticSha256`, `packageDigest`, `authorityDigest`, `rawByteDigest`, `canonicalContentDigest`, FNV-Welthash, CRC und Git-Commit-SHA. Sie binden unterschiedliche Byteprojektionen und Sicherheitszwecke. |
| 2. Kanonischer Name | `ContentDigest` mit benanntem `DigestProfileId`. Konkrete Felder bleiben semantisch qualifiziert, etwa `packageDigest` oder `payloadDigest`. |
| 3. Semantischer Owner | Core-Contract-Owner besitzt die Digestform; der Schema-/Content-/Domainowner besitzt das jeweilige Digestprofil. |
| 4. Minimale Felder | `algorithm`, `value`, `digestProfileId`. Das Profil legt Canonicalization, Projektion, Domain-Separation und ausgeschlossene Felder fest. |
| 5. Importierende Domains | alle Domains, Content Locks, SourceBindings, Approval, Validation, Receipts, Events, Evidence und Persistence. |
| 6. Erweiternde Domains | G13 definiert Package-/Authority-/Presentation-Profile; andere Domains definieren State-, Command-, Payload-, Diff- oder Artifact-Profile. |
| 7. Ausdrücklich nicht enthalten | Signatur, Provenance, Lizenz, Revision, SchemaVersion, CRC, Git-Identität, semantische Validität oder Equality zwischen verschiedenen Profilen. |
| 8. Migration und Versionsgrenze | Algorithmus-, Canonicalization- oder Projektionswechsel erzeugt ein neues Profil und neue Digests. Alte Werte werden nie unter gleichem Profil neu interpretiert. Nichtkryptografische Hashes bleiben nur qualifizierte Legacy-/Diagnosewerte. G13 trennt `packageDigest` und `authorityDigest` explizit (G13:280-318). |
| 9. Offener Konflikt und Ownerentscheidung | `D-07`: verpflichtender Basisalgorithmus, Textpräfix, JCS/Byteframing und Profilregistrierung festlegen. G09s bestehender Canonicalizer/FNV-Kompatibilität braucht eine explizite Migrationsentscheidung. |

### 4.6 `SourceBinding`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G09 `SourceBinding` für Craft/Catalog/Policy/Frame; `ExactSourceRef`; G02 Base-/Target-Preconditions; G06-B Epoch/Revision/LOD/Request; G11 ContextManifest/ExpectedRevisions; `VoxelSourceBindingV1`; Evidence Lineage; Build-/Lizenzprovenienz. Diese letzten drei Provenienzformen sind breiter als Runtime-Staleness. |
| 2. Kanonischer Name | schmaler `SourceBinding`; mehrere Quellen als kanonisch sortiertes `SourceBindingSet`. |
| 3. Semantischer Owner | Authority-/Concurrency-Owner. |
| 4. Minimale Felder | `sourceRef`, `authorityRef`, `authorityEpoch`, `revision`, `contentDigest`. Für nichtautoritative Contentquellen darf ein spezialisierter Exact Content Ref Authority-Felder ersetzen. Das Set besitzt einen Set-Digest. |
| 5. Importierende Domains | derived Workerprodukte, Previews, PreparedChangeSets, Validation Runs, Receipts, Contentaktivierung, Simulationprojektionen und Evidence. |
| 6. Erweiternde Domains | G09 ergänzt Catalog/Policy/Frame; G10 Zeit/Frame/Propagator; G06 LOD/Request; Content Exact Package Refs. Erweiterungen bleiben separate Felder neben dem Spine. |
| 7. Ausdrücklich nicht enthalten | Outputpayload oder -digest, Actor/Principal, Approval, vollständige Provenance, Lizenzdaten, Toolchain, Hardware, UI-Auswahl oder Cachehandle. |
| 8. Migration und Versionsgrenze | SourceBindings sind immutable. Jede relevante Quelländerung macht das Resultat stale und erzeugt ein neues Binding; keine stille Neubindung. Unauflösbare Versionen fail closed. |
| 9. Offener Konflikt und Ownerentscheidung | `D-06`, `D-07`: Pflicht von Epoch/Digest, Contentquelle ohne Authority, Multi-Source-Form und `contractSetDigest` entscheiden. G09s Typ ist in `CraftSourceBinding` umzubenennen oder explizit zu erweitern. |

### 4.7 `CommandId`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | `commandId`, G17 `applicationId`, `idempotencyKey`, Request-/Proposal-/Task-/Event-ID. G10 und G11 referenzieren Domaincommands, definieren aber keine gemeinsame Command-ID. |
| 2. Kanonischer Name | `CommandId`, Identität genau eines eingereichten fachlichen Intents. G17 `applicationId` ist Migrationsalias, sofern der Owner die Gleichheit bestätigt. |
| 3. Semantischer Owner | Command-/Mutation-Contract-Owner. |
| 4. Minimale Felder | die ID ist ein `StableId<Command>`. Im Envelope: `commandId`, `commandSchema`, `requestDigest`, `actorRef` oder `principalRef`, `targetRef`, `preconditions`. |
| 5. Importierende Domains | alle mutierenden Domains, Eventing, Audit, Receipts und Idempotenzspeicher. |
| 6. Erweiternde Domains | geschlossene Commandtypen und Payloadschemas, niemals neue Bedeutungen derselben ID. |
| 7. Ausdrücklich nicht enthalten | OperationId, TransactionId, EventId, TaskId, RequestId, Berechtigung, Revisionsstand oder Commitbestätigung. |
| 8. Migration und Versionsgrenze | Retry/Replay verwendet dieselbe ID und denselben Requestdigest. Gleiche ID mit anderem Digest ist harter Idempotenzkonflikt; semantisch geänderter Intent bekommt neue ID. |
| 9. Offener Konflikt und Ownerentscheidung | `D-08`: Scope, Erzeugung, Idempotenzfenster, G17-Alias und Pflicht für G10/G11 festlegen. |

### 4.8 `OperationId`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | BR-02 `TelemetryOperationId` ist run-lokale Ausführungskorrelation mit Parent; G15-A `RemoteOperationV1.operationId` ist ein langlebiger, revisionierter Domainworkflow über Ticks. G02 `operation` und G05 Effect IDs sind Typen/Assets, keine OperationId. |
| 2. Kanonischer Name | der unqualifizierte Name wird nicht freigegeben. Vorgeschlagene Trennung: `ExecutionOperationId` für Ausführungs-/Telemetrykorrelation und `DomainOperationId` für langlebige fachliche Workflows. |
| 3. Semantischer Owner | Execution-/Observability-Owner für `ExecutionOperationId`; Command-/Workflow-Owner für `DomainOperationId`. |
| 4. Minimale Felder | Execution: `operationId`, optional `parentOperationId`, Run-/Scope-Ref. Domain: `operationId`, `operationRevision`, Domain-/Owner-Ref. |
| 5. Importierende Domains | G11/Telemetry für Execution; G15 für Domain Operation; andere Domains nur bei nachgewiesenem Lebenszyklus. |
| 6. Erweiternde Domains | Telemetry ergänzt Attempts/Spans; G15 Art, State, Plan, Budget und Milestones. |
| 7. Ausdrücklich nicht enthalten | atomare Commitgrenze, Idempotenzbeweis, CommandId, TransactionId, RequestId, TaskId oder EventId. |
| 8. Migration und Versionsgrenze | vorhandene run-lokale Telemetry-IDs werden nicht in langlebige Domain-IDs umgedeutet. Die Einführung ist für alte Artefakte optional/additiv. Mode- oder Epochwechsel ändert nicht automatisch die DomainOperationId. |
| 9. Offener Konflikt und Ownerentscheidung | `D-02`, `D-08`: G15-A versus G15-B, Bedarf beider Typen, Parent-/Scope-Regeln und Abgrenzung zu DroneTask entscheiden. |

### 4.9 `TransactionId`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G02/G11/G17 verwenden Transaktion für atomare Authoring-/Commandgruppen; G08 `CurrencyTransactionV1` bezeichnet eine Double-Entry-Buchung. DB-Transaktionen und UI History Entries sind weitere, nicht äquivalente Bedeutungen. |
| 2. Kanonischer Name | `ChangeTransactionId` für atomare Mutation; `LedgerTransactionId` bleibt Economy-spezifisch. Der nackte Alias `TransactionId` soll nur innerhalb eines eindeutig qualifizierten Schemas verwendet werden. |
| 3. Semantischer Owner | Command-/Mutation-Contract-Owner; Economy-Owner für Ledgertransaktionen. |
| 4. Minimale Felder | Change Transaction: `transactionId`, `transactionRequestDigest`, `atomicity`, `orderedCommandIds`, `sourceBindings`, `readSet`, `writeSet`. |
| 5. Importierende Domains | G02, G11, G17 und alle Domains mit atomaren Mehrfachänderungen; G08 importiert nur die Stable-ID-Grundform für Ledger. |
| 6. Erweiternde Domains | Domaintransaktionspayloads und Aggregategrenzen. |
| 7. Ausdrücklich nicht enthalten | einzelne Buchungspostings im gemeinsamen Spine, CommandId, OperationId, StagingHandle, HistoryEntryId, CommitReceipt oder DB-Handle. |
| 8. Migration und Versionsgrenze | alte Einzelcommands können als Ein-Command-Transaktion umhüllt werden. Nach Seal/Terminalzustand wird eine Transaktion nicht wieder geöffnet; Repair/Merge erzeugt neue ID und neuen Digest. Gleiche ID mit anderem Digest ist Konflikt. |
| 9. Offener Konflikt und Ownerentscheidung | `D-08`: globaler oder Aggregate-Scope, Cross-Authority-Atomizität, Einzelcommand-Regel und Aliasstrategie entscheiden. |

### 4.10 `PreviewRevision`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G02 `previewRevision`; G10 `viewRevision`, `previewTickUs` und `EditSessionDraft`; G11 `PreviewReceipt`; G16-A Shadow-Plan/Planrevision; G13 Working Revision. Nur G02 definiert eine klare transaction-lokale Previewrevision. |
| 2. Kanonischer Name | `PreviewRevision` als Version eines nichtautoritativen Preview-Overlays; Evidence wird separat als `PreviewReceipt` serialisiert. |
| 3. Semantischer Owner | Command-/Mutation-Contract-Owner. |
| 4. Minimale Felder | `previewId`, `transactionId`, `previewRevision`, `baseSourceBindingSet`, `preparedChangeSetDigest`, `previewDigest`, `status`. |
| 5. Importierende Domains | G02, G09, G10, G11, G13, G16, G17 sowie Presentation/Preview-Worker. |
| 6. Erweiternde Domains | Diff-, Viewpoint-, Simulation-, Geometry- oder Validationartefakte im PreviewReceipt. |
| 7. Ausdrücklich nicht enthalten | Authority-/DocumentRevision, ViewRevision, SimulationTick, Approval, Commitrecht, Live-Root oder UI-Zustand. |
| 8. Migration und Versionsgrenze | Source-, Epoch-, Transaction- oder Prepared-Digest-Wechsel macht die Preview stale. Keine Migration über abgeschlossene Transaktionen. Jede Neuberechnung erzeugt neue Revision oder neue Preview-ID gemäß `D-08`. |
| 9. Offener Konflikt und Ownerentscheidung | `D-06`, `D-08`: mutable revisionierte Preview gegenüber immutable Previewinstanzen, Reset, Startwert und Rolle des PreviewReceipt entscheiden. |

### 4.11 `ApprovalGrant`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G02 einmaliger `ApprovalGrantV1`; G11 `ApprovalReceipt` mit approve/reject und separates `CommitTicket`; G05/G13 Content Approval/Reviewstatus; G15-B `ActionAuthorizationV1`; G16-A `ApprovalRecord`; G10 Warning Override. Diese Artefakte erlauben unterschiedliche Aktionen und Zeitbasen. |
| 2. Kanonischer Name | `ApprovalGrant` nur für eine positive, aktive, scope- und digest-gebundene Freigabe. Getrennt: `ApprovalDecisionRecord` kann approve/reject/revoke protokollieren; `CommitTicket` ist ein kurzlebiges technisches Ausführungsticket. |
| 3. Semantischer Owner | Approval-/Security-Policy-Owner; Command Contracts transportieren den Grant-Ref. |
| 4. Minimale Felder | `grantId`, `issuerPrincipalRef`, `beneficiaryRef`, `scope`, `boundPreparedChangeSetDigest`, `boundPreviewDigest` falls erforderlich, `sourceBindingSet`, `policyRef`/`policyDigest`, `issuedAt`, `validUntil`, `maxUses`, `status`, `proofRef`. |
| 5. Importierende Domains | G02, G05, G07, G09, G10, G11, G13, G15, G16, G17 und Commit Coordination. |
| 6. Erweiternde Domains | Risk Tags, Effect Bounds, Warning-/Visual-Scope, approver roles und fachliche EvidenceRefs. |
| 7. Ausdrücklich nicht enthalten | Capability selbst, Berechtigung des Approvers, ValidationPass, UI-Status `approved`, Reject, Content-Provenance-Review, Track-/ROE-Autorisierung oder automatische Commitauthority. |
| 8. Migration und Versionsgrenze | Änderung an Bytes, Source, Epoch, Scope, Policy, Registry, Validator oder Risiko invalidiert den Grant. Revoke/Supersede erzeugt einen neuen Decision Record. Kein Transfer auf neuen Digest; `maxUses` wird atomar verbraucht. |
| 9. Offener Konflikt und Ownerentscheidung | `D-09`: Grant/Decision/Receipt/Ticket trennen, Zeitbasis, Zwei-Personen-Gates und Verhältnis von G16 ApprovalRecord beziehungsweise G15 ActionAuthorization entscheiden. |

### 4.12 `ValidationIssue`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G02 `ValidationIssueV1`, G09 `ValidationFindingV1`, G13 Content Issue, G17 `EditorIssueV1`, BR-04 `ContractIssueV1`, Rejection Codes und Telemetry Invalidations. Severity, Blockingwirkung, Laufstatus, JSON Pointer, Message und Evidence sind uneinheitlich. |
| 2. Kanonischer Name | `ValidationIssue`; stabiler `issueKey`/Fingerprint getrennt von optionaler `occurrenceId`. |
| 3. Semantischer Owner | Validation-Contract-Owner; Domainvalidator besitzt seinen Code-Namespace und Rule-Versionen. |
| 4. Minimale Felder | `issueSchema`, `issueKey`, optional `occurrenceId`, `issueCode`, `validatorRef` mit Version/Digest, `phase`, `status`, `severity`, `blockingScopes`, `observedSourceBinding`, `targetRefs`, `messageKey`, strukturierte `messageArgs`, `evidenceRefs`, `quickFixRefs`. |
| 5. Importierende Domains | alle Domains, PreparedChangeSet, Preview, Publish und QA. |
| 6. Erweiternde Domains | Targettypen, Rule Codes, Evidence Facts, Responsibility Domain und Quick-Fix-Arten. |
| 7. Ausdrücklich nicht enthalten | lokalisierter Freitext als Identität, Suppression, Approval, Stacktrace, Secret, Raw Prompt, automatische Ausführung eines Quick Fix oder Gesamt-Run-Entscheidung. |
| 8. Migration und Versionsgrenze | semantische Regeländerung erzeugt neue Rule-/Validatorversion und neue Bindung. Issuekey bindet Version und Source. Suppression wird separat migriert oder ungültig. Unbekannte Pflichtvalidatorversion fail closed. |
| 9. Offener Konflikt und Ownerentscheidung | `D-10`: Severity-Taxonomie, `blocker` gegenüber `blockingScopes`, Status, Fingerprint, Target- und Evidence-Spine sowie ValidationReceipt ratifizieren. |

### 4.13 `PreparedChangeSet`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G02 `PreparedTransactionV1` plus `preparedChangeSetHash`; G11 `ProposalBundleV1`, sealed `AuthoringTransactionV1` und `CommitPrepared`; G17 `PreparedTransaction`; G10 EditSessionDraft; G13 Working Candidate; G16 Shadow Plan. Manche Typen heißen bereits Applied, obwohl der Text nur einen Vorschlag beschreibt. |
| 2. Kanonischer Name | `PreparedChangeSet`, ein immutable, content-addressed Ergebnis der Prepare-Phase. |
| 3. Semantischer Owner | Command-/Mutation-Contract-Owner. |
| 4. Minimale Felder | `preparedChangeSetId` oder Digest, `schemaRef`, `transactionId`, `sourceBindingSet`, `orderedCommandDigests`, `readSet`, `writeSet`, `forwardDeltaDigest`, `inverseOrBeforeDeltaDigest`, `candidateRootDigests`, `diffDigest`, `impactDigest`, `validationReceiptRef`/Digest, `requiredApprovalScopes`, `algorithmVersions`, `expiresAt` oder Supersessionregel. |
| 5. Importierende Domains | G02, G05, G09, G10, G11, G13, G16, G17 und andere mutierende Domains. |
| 6. Erweiternde Domains | typisierte Delta-, Effect-, Geometry-, Impact- und Inverse-Payloads. |
| 7. Ausdrücklich nicht enthalten | mutable Draft, Live-Root, Authority, ApprovalGrant selbst, Commitstatus, CommitReceipt, UI-Diff als Wahrheit oder automatisches Rebase. |
| 8. Migration und Versionsgrenze | nach Seal immutable. Änderung an Command, Reihenfolge, Source, Epoch, Policy, Validator, Algorithmus oder Delta erzeugt neues PreparedChangeSet und neue Preview/Approval. Keine Adoption über SourceBinding-Wechsel. |
| 9. Offener Konflikt und Ownerentscheidung | `D-08`, `D-09`, `D-10`: offizieller Name, Status vor/nach Validation und Approval, Pflicht des Inversen sowie inline oder content-addressed Delta entscheiden. |

### 4.14 `CommitReceipt`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G02 `CommitReceiptV1`; G09 `BuildCommandReceiptV1`; G15-A/B Damage-/Extraction-/Drone-Receipts; G17 `TransactionSuccess`, `NoOp`, `Rejection`, `CommitOutcomeUnknown`; G07 Decision-/Preflight-Receipts; BR-04 erfundener Validation Receipt. Viele davon belegen keinen Commitpunkt. |
| 2. Kanonischer Name | `CommitReceipt` nur für bestätigten `committed`- oder bestätigten `no-op`-Ausgang. Die übergeordnete Union heißt `CommitOutcome` und enthält zusätzlich `rejected` sowie `outcome-indeterminate`, die keine Receipts sind. |
| 3. Semantischer Owner | Command-/Mutation-Contract-Owner; ausgestellt ausschließlich von der autoritativen Writer-/Commit-Authority. |
| 4. Minimale Felder | `receiptId`/`commitId`, `transactionId` oder ausdrücklich einzelner `commandId`, `requestDigest`, `preparedChangeSetDigest`, `authorityEpoch`, `beforeSourceBindings`, `afterSourceBindings`, `committedCommandDigests`, `validationReceiptRef`, `approvalGrantRefs`, optional `eventRange`/Event IDs, `resultDigest`, `outcome` (`committed` oder `no-op`). |
| 5. Importierende Domains | alle mutierenden Domains, Audit, History, Undo/Compensation, Network Idempotency und Persistence. |
| 6. Erweiternde Domains | G09 inverse/invalidated projections; G15 Masse/Zellen/Costs/Fragments; G08 Ledgerrefs; G17 changed owners/cells/dirty sets; temporäre→produktive ID-Mapping. |
| 7. Ausdrücklich nicht enthalten | unbestätigter Workerjob, TestFlight-/Validation-/Decision-Receipt, Rejection, Timeout, `commit-outcome-unknown`, Side-Effect-Outbox-Erfolg, Telemetrie oder UI-Optimismus. |
| 8. Migration und Versionsgrenze | Receipt ist append-only und immutable. Undo ist neuer kompensierender Commit. Unbekannte Receiptversion fail closed. Idempotenter Retry liefert dasselbe Receipt. Domainoutcomes werden versioniert, nicht durch Umdeutung alter Enums verändert. |
| 9. Offener Konflikt und Ownerentscheidung | `D-08`, `D-11`: Granularität pro Command/Transaction/Authority, No-op-Felder, Commit-to-Event-Beziehung und G15/G17-Outcome-Mapping ratifizieren. |

### 4.15 `EventEnvelope`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G06-A `SocietyEventV1`; G07 `FactionEventEnvelopeV1`; G08 global geordnete Economyevents; G10 `ScenarioEventV1`; G11 AuditEvent; G15-A `DomainEnvelope<T>`; G16-B globaler `PlanetEvent`; G16-A eigener `CityEventLogV1`; BR-02 TelemetryRecord. Envelope und Domainpayload sind teils verschmolzen. |
| 2. Kanonischer Name | `EventEnvelope<P>` für ein immutable akzeptiertes Domainfaktum. TelemetryRecord und AuditEvent sind spezialisierte Profile, keine alternative Grundsemantik. |
| 3. Semantischer Owner | Event-Contract-Owner in enger Abstimmung mit Command-/Mutation-Owner. Der Streamowner besitzt Sequenz und Chainprofil; die Domain besitzt das Payloadschema. |
| 4. Minimale Felder | `eventSchema`, `eventId`, `eventType`, `streamRef`, `sequence`, `authorityEpoch`, `revisionBefore`, `revisionAfter`, `correlationId`, optionale `causationId`/`commandId`, getrennte `actorRef` und `sourceRef`, optional diskriminierte logische Zeit, `payloadSchema`, `payloadDigest`, `payload`. `previousEventDigest` ist Pflicht in einem geketteten Streamprofil. |
| 5. Importierende Domains | alle event-emittierenden Domains, Replay, Persistence, Projection, Audit und Networking. |
| 6. Erweiternde Domains | Planet/City: Bounds, Tile Cover, Coordinate-/Generator-/Algorithmusbindung; G07: Chain; G06: Place/Subject/LOD; Audit: attestation; Payloads bleiben geschlossen. |
| 7. Ausdrücklich nicht enthalten | EventProposal, Command Intent, UI-Notification, mutable Projection, City-/Damagefelder im Basisspine, `recordCrc` als ContentDigest, Approval oder CommitReceipt. |
| 8. Migration und Versionsgrenze | Envelope und Payload werden getrennt versioniert. Historische Events bleiben immutable; Korrektur als neues Event oder explizite Migration. Unbekannte Version fail closed. Sequence-Scope und Chainprofil werden nie still gewechselt. |
| 9. Offener Konflikt und Ownerentscheidung | `D-01`, `D-02`, `D-03`, `D-11`: globaler PlanetEvent versus CityEventLog, Sequence-Scope, Chainpflicht, Pflicht der SimulationTime, Actor/Source-Split und G15 Envelope entscheiden. |

### 4.16 `PackageId` / `ContentLock`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | Package ID + contentHash, Narrative Package ID/Semver/hash, ExactSourceRef, Catalog refs, Generator content address, Bundle ID, npm/Git/Research pins. Nur G13 definiert `PackageId`, `ContentLock` und `AuthorityLock` geschlossen. |
| 2. Kanonischer Name | `PackageId`, `EntryId`, `ContentLock`; getrennte Projektion `AuthorityLock`. G13s Namens- und Locksemantik ist der Ausgangsvorschlag. |
| 3. Semantischer Owner | Content-Package-/Resolver-Owner, Kandidat G13. |
| 4. Minimale Felder | `PackageId`: `namespace`, `slug`. `ContentLock`: `lockSchemaVersion`, Resolver-/Content-API-/Schema-Set-/Registry-Versionen, Roots, exakt aufgelöste Packages mit PackageId/Version/PackageDigest/AuthorityDigest/Impact/Features, Dependency Edges, Activation Order, `contentLockDigest`. |
| 5. Importierende Domains | alle paketierten Inhalte, Save/Load, Server/Multiplayer, Contentauthoring, Registry, Generatoren und World/Event-Profile. |
| 6. Erweiternde Domains | Entry-Kinds, Exportpayloads, Domain-Schemas und zusätzliche Lockprojektionen. Resolution Policy erzeugt einen separaten ResolutionRecord. |
| 7. Ausdrücklich nicht enthalten | mutable Catalog, `latest`-Range, Installationsstatus, Runtimehandle, npm-Lockfile, Quellcommit allein, Packagebytes selbst, Presentationauswahl, Lizenzfreigabe oder ausführbarer Mod-Code. |
| 8. Migration und Versionsgrenze | exakter Lock oder zertifizierte Migrationskette; nie still auf `latest`. PackageId+Version beziehungsweise PackageId+Digest bleibt immutable. Alte Saves behalten ihren Lock; fehlender Lock führt zu Migration/Fehler. G13:475-542. |
| 9. Offener Konflikt und Ownerentscheidung | `D-04`, `D-07` sowie Contententscheidungen zu Namespace, Supportfenster, Overrides/Patches, Mod-Code und Authority-/Presentation-Lock. |

### 4.17 `Capability` / `Availability`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | Security-/Gameplay-/Facility-/Drone-/Tool-/Model-/Hardware-Capability; requested versus granted; BR-01/BR-02/BR-03/BR-04 Statusfamilien; G09 `{availability,value,unit}`; G10 Availability als Zeitfenster; CapabilityCoverage als Aggregat. Lossless Mapping ist derzeit unmöglich. |
| 2. Kanonischer Name | getrennte Begriffe: `CapabilityRef`, `CapabilityDecision` für Autorisierung, `CapabilityStatus` für beobachtete Unterstützung, `Availability<T>` für Wertverfügbarkeit und `CapabilityCoverage` nur für Aggregate. G10-Felder heißen `availableDuring`. |
| 3. Semantischer Owner | Core-Capability-Vocabulary-Owner für Spine/Status; Identity-/Policy-Owner für Decisions/Grants; Domainowner für Capability-Definitionen. |
| 4. Minimale Felder | CapabilityRef: `capabilityId`, `capabilityVersion`. Decision: Subject/Principal, CapabilityRef, Scope, Decision, Reasons, PolicyBinding. Status: CapabilityRef, `status`, ReasonCode, observed SourceBinding. Availability: tagged `available` mit Wert und SourceKind/Stability oder `unavailable`/`unknown` mit Reason und MissingRefs. |
| 5. Importierende Domains | alle Domains, Platform Adapter, Benchmark/Evidence, Contentactivation und Authorization. |
| 6. Erweiternde Domains | G07 Recht/Organisation, G08 Facility/Logistik, G09 Craft/Physics, G11 Tool/Model, G13 Package Permissions, G15 Drone/Actor. |
| 7. Ausdrücklich nicht enthalten | Rolle, Rang, Mitgliedschaft, Kategorie oder Anfrage als Grant; null/zero als Missing; Zeitintervall als Status; CapabilityCoverage als Einzelstatus; Permission und Hardwarefeature in einem Namespace. |
| 8. Migration und Versionsgrenze | unbekannte Capability-ID/-Version fail closed. Grants werden nie still erweitert. Status/Availability ist beobachtungs- und sourcegebunden. Status-Taxonomieänderung ist Contractversion; Adapter müssen Verlust explizit melden. |
| 9. Offener Konflikt und Ownerentscheidung | `D-12`: Status- und Reason-Code-Taxonomie, Namespaces, observed/declared, unsupported/unavailable/unknown und Mappingregeln ratifizieren. |

### 4.18 `Actor` / `Principal`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | `principalId`, `actorId`, `actorIds`, `actorRef`, `actorOrSourceId`, `issuerPartyId`, user/tool/agent/migration origin, approver/reviewer/creator. Party, fachlicher Actor, technische Source und Security Principal werden vermischt. |
| 2. Kanonischer Name | `PrincipalRef` für AuthN/AuthZ-Identität; `ActorRef` für den fachlich kausalen Handelnden. `SourceRef` bleibt getrennt. |
| 3. Semantischer Owner | Identity-/Authorization-Owner für Principal; jeweilige Domain für Actor-Arten und Rollen. |
| 4. Minimale Felder | Principal: `principalId`, `issuerRealm`, `principalType`. Actor: `actorId`, `actorType`, optional `principalRef` und DelegationRef. Rollen eines Actors stehen separat im Ereignis/Command. |
| 5. Importierende Domains | alle Commands, Approvals, Events, Audit, Narrative, Simulation und Economy. |
| 6. Erweiternde Domains | NPC, Organisation, Party, Drone, System, Tool und Automation Runner als Actor-Typen; Delegation-/Mappingverträge. |
| 7. Ausdrücklich nicht enthalten | Displayname, Credentials, Capability/Grant, Party-Eigentum, Provenance, SourceSystem, Sessiontoken oder Approverrolle als Identität. |
| 8. Migration und Versionsgrenze | IDs bleiben immutable; Realm-/Alias-/Principal-Actor-Mapping wird auditierbar versioniert. Rollen und Rechte werden bei Nutzung neu evaluiert. `issuerPartyId` wird nicht automatisch Principal. |
| 9. Offener Konflikt und Ownerentscheidung | `D-13`: Principal/Actor/Issuer/Source, Delegation, Systemidentitäten, Actorlisten/-rollen und Auflösung von `actorOrSourceId` ratifizieren. |

### 4.19 `ReadSet` / `WriteSet`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G11 first-class `ResourceFieldRefV1[]`; G05 abgeleitete Read/Write/Exclusive Keys; G02 Targets/Preconditions; implizite SourceBindings; changed/dirty/invalidation chunks; conservative Tile Cover. Nur die ersten Gruppen beschreiben Concurrency, die letzten sind Resultat oder Rebuildfolge. |
| 2. Kanonischer Name | `ReadSet` und `WriteSet`, jeweils kanonisch sortierte, deduplizierte Selectorlisten mit Set-Digest. |
| 3. Semantischer Owner | Command-/Concurrency-Owner; Domainowner besitzt die versionierte Resource-/Selector-Grammatik. |
| 4. Minimale Felder | ReadEntry: `resourceRef`, `selector`, `expectedSourceBinding` oder erwartete Revision/Digest, optional deklarierte Coverage. WriteEntry: `resourceRef`, `selector`, `writeKind`, `expectedSourceBinding`, `effectOrDeltaDigest`. Set: `selectorSchemaRef`, `entries`, `setDigest`. |
| 5. Importierende Domains | alle parallel editierbaren oder atomar mutierenden Domains, PreparedChangeSet und Conflict Detection. |
| 6. Erweiternde Domains | räumliche Bounds, Zellbereiche, Graphpfade, Inventory-/Ledgerkeys und Domain Merge Policy. |
| 7. Ausdrücklich nicht enthalten | tatsächlicher DB-Queryplan, Lock/Lease/Reservation, Permission Scope, UI Diff, Cacheinvalidierung oder tatsächlich geschriebenes Resultat. |
| 8. Migration und Versionsgrenze | Selector-/Ableitungsalgorithmus wird versioniert. Seal berechnet Sets autoritativ neu; Model-/Clientangaben sind nicht maßgeblich. Rebase/Merge erzeugt neue Sets, Digest, Preview und Approval. |
| 9. Offener Konflikt und Ownerentscheidung | `D-14`: Pfadsyntax, Feld-/Objekt-/Raumgranularität, Wildcards, exakte Sets gegenüber konservativen Supersets und Cross-Owner-Atomizität entscheiden. |

### 4.20 `Reservation`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | G05 Reservation Tokens, G06 Claims, G08 Cargo/Funds/Capacity/Energy/Labor Reservations, G11 `ScopeLeaseV1`, G15 Dock `reservationRevision`, G16-A `LandmarkReservation`, G16-B `AuthoredReservationV1`. Dauerhafte authored Geometrie, zeitliche Ressourcenbelegung und Koordinationslease haben verschiedene Invarianten. |
| 2. Kanonischer Name | kein universeller Payload. Trennung in `ResourceReservation` für zeitliche/exklusive Belegung, `AuthoredSpatialReservation` für persistente City-Geometrie und `ScopeLease` für Arbeitskoordination. |
| 3. Semantischer Owner | Resource-Coordination-/Economy-Owner für `ResourceReservation`; City-Owner für `AuthoredSpatialReservation`; Collaboration-Owner für `ScopeLease`. |
| 4. Minimale Felder | ResourceReservation: `reservationId`, `reservationRevision`, `resourceRef`, `reservationKind`, Quantity/Capacity, `holderRef`, `purposeRef`, `sourceCommandId`/Transaction, `createdAt`, optional `expiresAt`, `status`, `sourceBinding`. Spatial/Lease besitzen eigene Schemas. |
| 5. Importierende Domains | G05, G06, G08, G15 und gegebenenfalls G02 für ResourceReservation; G16 für Spatial; G11 für Lease. |
| 6. Erweiternde Domains | Inventory, Capacity, Activity, Narrative, Docking und City definieren ihre Resource-/Geometry-Payloads. |
| 7. Ausdrücklich nicht enthalten | dauerhaftes Ownership, TerritoryClaim, Mutex, Approval, Capability, tatsächliche Allocation/Custody, authored Geometrie im Resource-Spine oder Korrektheitsbeweis durch Lease. |
| 8. Migration und Versionsgrenze | offene Reservations werden ereignis-/receiptgebunden migriert, settled oder kontrolliert freigegeben; keine stillen Drops/Reaktivierungen. Räumliche Scopeänderung erzeugt neue Revision/Supersession. |
| 9. Offener Konflikt und Ownerentscheidung | `D-03`, `D-15`: gemeinsamer Lifecycle, Mengenunion, Zeitbasis, G15 Docksemantik sowie G16-A/B-Feldsatz entscheiden. |

### 4.21 `Unknown` / `MissingCoverage`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | Condition `unknown`, epistemische Berichtsklasse, `UnknownBoundary`, `unknown-missing-coverage`, missing/unloaded/invalid, Capability unknown/unsupported, Missing Slot, Review `UNKNOWN`, TS `unknown`, `commit-outcome-unknown`, unbekannte Provenance. |
| 2. Kanonischer Name | `KnowledgeState<T>` mit strukturierter `UnknownReason`; `CoverageStatus` mit `known-present`, `known-empty`, `unloaded`, `missing`, `invalid`; `MissingCoverage` als konkrete Pflichtabdeckungslücke. `IndeterminateCommitOutcome` bleibt separat. |
| 3. Semantischer Owner | Core-Knowledge-State-Owner; Validation-Owner für MissingCoverage; World-/Connectivity-Owner für CoverageRefs. |
| 4. Minimale Felder | Unknown: `reasonCode`, `missingRefs`, `sourceBinding`, optional `retryability`. MissingCoverage: `requiredCoverage`, `observedCoverage`, `missingSegments`, `reasonCode`, `impact`, `evidenceRefs`. |
| 5. Importierende Domains | Conditions, Validation, Connectivity, Voxel/Streaming, Capability/Availability, Contentload, AI Context und Presentation. |
| 6. Erweiternde Domains | geschlossene Reason Codes, Coverage-Geometrien, Retryregeln und probabilistische Estimates. G08s Surveyintervalle bleiben Estimate, nicht Unknown. |
| 7. Ausdrücklich nicht enthalten | `false`, `deny`, `0`, null, Air, empty, Detached, unsupported, unavailable, pending, stale, rejected, invalid, error, TS-Platzhalter oder Forschungsunsicherheit. |
| 8. Migration und Versionsgrenze | neue Reason-/Coverage-Enumwerte sind Contractversion und fail closed. Alte null-/fehlende Werte werden nicht automatisch als empty interpretiert. Pflichtgates blockieren sichtbar; Drafts dürfen Unknown tragen. |
| 9. Offener Konflikt und Ownerentscheidung | `D-10`, `D-12`, `D-16`: Reason-Code-Familien, Propagation, Verhältnis zu Availability und MissingCoverage als eigener Typ versus ValidationIssue entscheiden. |

### 4.22 `SimulationTick` / `Epoch`

| Geforderter Aspekt | Crosswalk-Vorschlag |
|---|---|
| 1. Konkurrierende Namen und Bedeutungen | `Tick=number`, `SimTick=bigint`, `UnsignedDecimal`, `WorldTime=bigint`, `simulationTime:number`, G10 signiertes `tickUs` relativ zu `SystemEpochV1`, `AuthorityEpoch`, `lodEpoch`, Worker Generation, `contentEpoch`, Planning Epoch, monotone Clock Epoch und GPU Query Tick. |
| 2. Kanonischer Name | `SimulationTimeRef` mit `timelineRef`, `simulationEpochId`, `simulationTick`. Daneben getrennt: `SystemTimeRef` für G10 Orbitzeit, `AuthorityEpoch`, `ContentEpoch`, `PlanningEpoch` und `WorkerGeneration`. Kein nackter Export `Epoch`. |
| 3. Semantischer Owner | Simulation-Clock-Owner; G10 Celestial-Time-Owner für SystemEpoch/TickUs. |
| 4. Minimale Felder | Simulation: `timelineRef`, `simulationEpochId`, `simulationTick`; das Simulationprofil bindet Tickrate, Quantisierung und Pause/Acceleration. Empfohlener Tick-Wiretyp: `DecimalUint64`. SystemEpoch bindet `epochId`, `timeScale`, Ursprung oder Converter. |
| 5. Importierende Domains | G05, G06, G07, G08 und G15; G16-B für die `PlanetEvent`-Zeit, G16-A nur falls City-Runtimeevents an Simulationszeit gebunden werden; G02/G11/G17 nur bei Runtime-/Receiptbindung; G10 nutzt zusätzlich SystemTime. |
| 6. Erweiternde Domains | Kalender-/World-Time-Adapter, Eventzeit, Orbitalzeit und deterministische Scheduler, ohne die Grundachsen zu vermischen. |
| 7. Ausdrücklich nicht enthalten | Wallclock, UTC, Frame delta, Eventsequence, Revision, AuthorityEpoch, LOD/Worker/Content/Planning Epoch oder GPU-Timestamp. |
| 8. Migration und Versionsgrenze | Tickrate-, Einheit-, Skalen- oder Quantisierungswechsel erzeugt ein neues Simulationprofil und gegebenenfalls eine neue SimulationEpoch; keine stille Skalierung. Cross-Epoch-Vergleich ist verboten. G10s Mikrosekundenauflösung ist eine eigene Schemamigrationsgrenze (G10:134-157). |
| 9. Offener Konflikt und Ownerentscheidung | `D-01`, `D-02`, `D-03`, `D-17`: Wireencoding, Tickrate, Pause/Acceleration, Epoch-Lifecycle und Abgrenzung G06-A/B, G15-A/B sowie G10 entscheiden. |

### 4.23 Zentrale Quellenanker für den Crosswalk

Diese Auswahl ersetzt nicht die vollständige Lektüre. Sie markiert die wichtigsten Definitions- und Konfliktstellen für die Ownerreview.

| Begriff | Zentrale Quellenanker |
|---|---|
| StableId | G02:190-290, 506-512; G05:241-258, 446-453; G08:189-195; G13:361-404; G17:162-218 |
| SchemaVersion | G02:204-330; G05:241-442; G09:200-256, 751-780; G13:320-335, 406-460; G17:162-205, 515-544 |
| AuthorityEpoch | G06-B:89-127, 402-417; G11:329-365, 714-737; G15-A:144-168, 1066-1077; G16-B:189-205 |
| Revision | G02:204-330; G07:169-197; G08:257-293; G10:106-132; G17:162-245 |
| ContentDigest | G02:190-330; G09:175-198, 751-765; G13:280-318, 475-531; G17:162-208 |
| SourceBinding | G09:183-198, 367-388; G11:329-389, 714-737; G16-A:236-245; G17:236-245 |
| CommandId | G02:250-290; G08:142-149; G09:719-749; G17:162-218 |
| OperationId | G15-A:1026-1056; ergänzend BR-02:152-197, 602-626 |
| TransactionId | G02:204-330; G08:367-388; G11:714-769; G17:409-441 |
| PreviewRevision | G02:441-479; G10:488-538; G11:849-867; G17:219-245 |
| ApprovalGrant | G02:369-439; G11:304-321, 901-935; G15-B:244-271; G16-A:680-696 |
| ValidationIssue | G02:608-638; G09:606-644; G13:879-900; G17:650-707 |
| PreparedChangeSet | G02:295-330; G11:370-392, 710-769; G17:219-245 |
| CommitReceipt | G02:315-330; G09:730-749; G15-A:455-489, 576-608, 776-798; G15-B:387-419, 536-573, 707-738; G17:248-336 |
| EventEnvelope | G06-A:94-110; G07:1102-1168; G15-A:144-168; G16-B:591-620 |
| PackageId / ContentLock | G02:640-687; G05:304-475; G13:361-404, 475-542 |
| Capability / Availability | G07:247-347; G09:94-106, 456-465; G11:203-256; G13:727-742 |
| Actor / Principal | G02:250-266; G07:247-347, 1102-1168; G11:216-245, 901-925; G17:162-205 |
| ReadSet / WriteSet | G02:713-725; G05:188-211, 477-570; G11:216-256, 370-389, 710-769, 1299-1338 |
| Reservation | G05:572-593; G06-B:240-328; G08:257-293, 473-490, 611-656, 892-912; G16-B:501-524 |
| Unknown / MissingCoverage | G05:188-211, 477-524; G09:94-106, 623-644, 826-837; G13:639-652; G15-B:387-437, 536-573; G17:307-336 |
| SimulationTick / Epoch | G06-B:148-178, 444-483; G07:169-197; G08:189-195, 1614-1636; G10:134-157, 609-646; G15-A:144-168, 1026-1056 |

## 5. Vorgeschlagene Paketgrenzen

Die folgenden Namen sind ausschließlich vorgeschlagene Grenzen. Sie dürfen erst nach Ownerentscheidung, Paketmanifest und Importregeln als reale Pakete bezeichnet werden.

### `@weltraum/core-contracts`

Soll enthalten:

- `StableId<K>`, `StableRef` und grundlegende Refs;
- `SchemaRef` und Versionierungsprimitive;
- `ContentDigest` und `DigestProfileRef`;
- `AuthorityEpochRef`, `Revision`, `SourceBinding` und `SourceBindingSet`;
- `PrincipalRef`, `ActorRef`, Capability-/Availability- und Knowledge-State-Primitiven;
- Simulation-Time-Primitiven.

Soll nicht enthalten: Domainpayloads, Commands, Package-Manifeste, Validatorimplementierungen, Renderer-/UI-Typen, Datenbank- oder Netzwerkimplementierung.

### `@weltraum/command-contracts`

Soll enthalten:

- Command-, Execution-/Domain-Operation- und Change-Transaction-Identitäten;
- ExpectedRevision-/Precondition-Spine, PreviewRevision und PreviewReceipt;
- ReadSet/WriteSet sowie den generischen ResourceReservation-Spine, falls `D-15` ihn bestätigt;
- PreparedChangeSet, ApprovalGrant-Referenzen, CommitOutcome und CommitReceipt;
- EventEnvelope und Eventstream-Metadaten.

Soll nur `@weltraum/core-contracts` importieren. Validation- und Contentbezüge erfolgen über opaque Refs und Digests, um Zyklen zu vermeiden.

Soll nicht enthalten: Domaincommand-Payloads, Policy Engine, Approvalentscheidungscode, Validatorpayloads, Datenbanktransaktionen oder UI-State.

### `@weltraum/content-contracts`

Soll enthalten:

- PackageId, EntryId, Paketmanifest-Spine;
- ContentLock, AuthorityLock und explizite Presentation-Lock-Projektion;
- Resolver-, Activation-, Migration-, Provenance- und Rights-Refs;
- ContentEpoch-/Loadset-Metadaten.

Soll nur `@weltraum/core-contracts` importieren.

Soll nicht enthalten: npm-Lockfile als Domainvertrag, Loaderimplementierung, Runtimehandles, Asset- oder Rendererobjekte, ausführbaren Mod-Code oder Hot-Reload-UI.

### `@weltraum/validation-contracts`

Soll enthalten:

- ValidatorRef/-Binding, ValidationIssue und ValidationReceipt;
- MissingCoverage, SuppressionRef und QuickFixRef;
- gemeinsame Issue-Phase-, Status- und Blocking-Spines nach `D-10`.

Soll nur `@weltraum/core-contracts` importieren. Commandbezüge erfolgen als opaque IDs/Refs.

Soll nicht enthalten: Domainvalidatorcode, lokalisierte UI, automatische Quick-Fix-Ausführung oder Commitauthority.

### Domain-specific packages

Sollen gemeinsame Spines importieren und nur Folgendes besitzen:

- fachliche Aggregate-/Actor-/Resource-Refs;
- Command- und Eventpayloads;
- Capability-Definitionen und Reason-Code-Namespaces;
- Selector-, Reservation-, Delta-, Issue- und Receipt-Erweiterungen;
- Domainmigrationen und Domain-Digestprofile.

Sie dürfen keine zweite Definition von StableId, Revision, Command/Event Envelope, ApprovalGrant, ValidationIssue oder ContentLock erzeugen.

### Presentation adapters

Sollen kanonische und Domainverträge in UI-, Editor-, Engine-, Telemetrie- oder Evidenceansichten abbilden. Verlustbehaftete Abbildungen müssen als solche markiert werden.

Sie dürfen keine Stable IDs vergeben, Revisionen erhöhen, Digests umdeuten, Approval erteilen, Validationwahrheit erzeugen oder autoritative Zustände mutieren.

Vorgeschlagene Importregel:

`core` → `command | content | validation` → `domain-specific` → `presentation adapters`

Rückimporte sind verboten. Die drei fachlichen Contractpakete referenzieren einander nur über Core-IDs, Refs und Digests.

## 6. Offene Ownerentscheidungen

| ID | Entscheidung | Mindestoutput |
|---|---|---|
| D-01 | G06-A, G06-B oder normativen Mergebericht auswählen | autoritative Fassung, Gate-Mapping, LOD- und Zeitvertrag |
| D-02 | G15-A, G15-B oder normativen Mergebericht auswählen | Status, Envelope, Operation-/Task-, Damage-/Extraction- und Receipt-Mapping |
| D-03 | G16-A, G16-B oder normativen Mergebericht auswählen | globaler PlanetEvent versus CityEventLog, Manifest, Approval, Reservation, Gateumfang |
| D-04 | Stable-ID- und Package-Namespace-Governance ratifizieren | Atom-/Compound-Grammatik, Scope, Allocator, Tombstone/Alias |
| D-05 | SchemaRef-Wireformat ratifizieren | Schema-ID-Form, Versionswert, unknown/migration |
| D-06 | Authority-/Epoch-/Revision-/SourceBinding-Regeln ratifizieren | Scope, No-op, Reset, Multi-Source und Staleness |
| D-07 | Digest- und Canonicalization-Profile ratifizieren | Algorithmus, Encoding, JCS/Framing, Profilregistry |
| D-08 | Command-/Operation-/Transaction-/Preview-/Prepare-/Commit-Lifecycle ratifizieren | IDs, Zustände, Idempotenz, Granularität und Receipts |
| D-09 | Approvalbegriffe trennen | Grant, DecisionRecord, Receipt, CommitTicket, Invalidierung |
| D-10 | Validation-Spine ratifizieren | Issue/Receipt, Severity, Blocking, Fingerprint, Suppression |
| D-11 | Eventstream-Spine ratifizieren | Envelope, Sequence-Scope, Chain, Commitrelation, Zeitpflicht |
| D-12 | Capability-/Availability-Taxonomie ratifizieren | Status, Reasons, Namespaces, lossless/lossy Adapterregeln |
| D-13 | Principal-/Actor-/Source-Modell ratifizieren | Identity, Delegation, Rollen, Systemactor, Party-Mapping |
| D-14 | Read-/Write-Selectoren ratifizieren | Syntax, Granularität, Supersetregel, Merge/Conflict |
| D-15 | Reservation-Lebenszyklen trennen | ResourceReservation, AuthoredSpatialReservation, ScopeLease |
| D-16 | Unknown-/MissingCoverage-Propagation ratifizieren | Reasonfamilien, Coverageformen, Gatewirkung |
| D-17 | Simulationszeit ratifizieren | Tick-Wiretyp, Rate, Epoch, Pause/Acceleration, Migration |

## 7. Freigabegrenze

`READY_FOR_G18_INPUT` ist erst zulässig, wenn mindestens D-01, D-02 und D-03 durch eine dokumentierte Supersession oder einen normativen Merge geschlossen sind und die gemeinsamen Spines D-04 bis D-17 entweder ratifiziert oder mit einem eindeutig benannten Owner, Entscheidungsdatum und nicht überlappender temporärer Adapterregel versehen wurden.

Bis dahin lautet der Status dieses Vorschlags: `REQUIRES_OWNER_DECISION`.
