# Shadow Contract Risks

Status: `REQUIRES_OWNER_DECISION`  
Stand: 2026-08-12  
Scope: G02, G05, G06-A/B, G07, G08, G09, G10, G11, G13, G15-A/B, G16-A/B, G17 sowie ergänzende Audit-/Benchmark-/Telemetry-/Reviewevidenz

## 1. Gesamturteil

Das größte Risiko ist nicht eine fehlende Felddefinition, sondern falsche Konvergenz: gleich benannte Begriffe haben unterschiedliche Lifecycles, während semantisch gleiche Grundkonzepte unter mehreren Namen erneut entworfen werden. Drei Berichtspaare sind zusätzlich materiell widersprüchlich. Ohne Ownerentscheid würden neue gemeinsame Pakete diese Konflikte nur einfrieren und als scheinbar bestehende Projektwahrheit verbreiten.

Der Status ist deshalb `REQUIRES_OWNER_DECISION`.

## 2. Risikoskala

| Stufe | Bedeutung |
|---|---|
| P0 | blockiert einen gemeinsamen V1-Vertrag oder kann Authority/Persistenz/Commitsemantik beschädigen |
| P1 | erzeugt mit hoher Wahrscheinlichkeit inkompatible Adapter, Migrationsverlust oder falsche Gateentscheidungen |
| P2 | erzeugt Governance-, Benennungs- oder Wartungsdrift, ist aber lokal eindämmbar |

## 3. Materielle Variantenblocker

### R-001, P0: Zwei unvereinbare G06-Fassungen

| Thema | G06-A | G06-B | Risiko |
|---|---|---|---|
| Status | `REQUIRES_SPIKE`, Contracts `PROPOSED` | `READY_FOR_SYNTHESIS` trotz offener Inputs | eine Fassung kann die Reife der anderen nicht erben |
| First-City-Scope | 64 NPCs, höchstens 16 FULL; First Slice mit acht NPCs | 2.048 Residents, 64 FULL_AGENT, 256 REDUCED_AGENT; erstes Harness 128 Personen | Budget-, Speicher-, Test- und Saveannahmen sind nicht kombinierbar |
| LOD-Namen | `FULL`, `REDUCED`, `COHORT`, `AGGREGATE` | `FULL_AGENT`, `REDUCED_AGENT` plus Kohorten/Aggregate | Enum-/Schemafreeze wäre mehrdeutig |
| G06.0 | Domain-/Zeittypen, Fake Clock, EventEnvelope, 8-NPC-Harness | nur Contract Freeze | jede unqualifizierte Gate-Referenz kann das falsche Deliverable anfordern |
| G06.1 | Reduced-Agent-Slice | deterministisches 128-Personen-Harness | Roadmap-/Abnahmekollision |
| Zeit | `simulationTime:number` | `WorldTime=bigint`, Fixed-Tick/Next-Event | Wire- und Offline-Semantik kollidieren |
| Event | vollständiges `SocietyEventV1` | kein vollständiger gemeinsamer Envelope | Eventfelder dürfen nicht „G06“ allgemein zugeschrieben werden |
| Epoch/Binding | AuthorityRevision/Basisprüfung | `authorityEpoch`, `sourceRevision`, `lodEpoch`, `requestId`, `subjectId` | AuthorityEpoch stammt nur aus G06-B |
| IDs | opak, mindestens 128-Bit-äquivalent | fachliche String-IDs, Allocator offen | Stable-ID-Wireform kollidiert |
| Needs/Edges | 4 Needs; 32 Relationship Edges | 6 Needs; 16 aktive Edges | Save-/Simulation-Schema inkompatibel |

Eindämmung: Bis D-01 darf jede Aussage nur `G06-A` oder `G06-B` zitieren. Kein gemeinsamer Gate- oder Enumname darf eingefroren werden.

### R-002, P0: Zwei unvereinbare G15-Fassungen

| Thema | G15-A | G15-B | Risiko |
|---|---|---|---|
| Evidenzstatus | drei Pflichtprojektdateien fehlen; Entscheidungen unzulässig | nennt Product SHA und behauptet Synthesis-/Decision-/Vision-Quellen gelesen | Normativität und Reife widersprechen sich direkt |
| Gesamtstatus | `REQUIRES_OWNER_DECISION` | `READY_FOR_SYNTHESIS` | B kann A nicht still superseden |
| Schemaform | numerisches `schemaVersion:1`, gemeinsamer `DomainEnvelope` | kombinierte Literale wie `damage-bridge-command.v1`; kein gemeinsamer Envelope | Wire- und Eventmodell kollidieren |
| AuthorityEpoch | Pflicht in Envelope/DroneTask; Epochwechsel bei Remote→Near | fehlt in Kerncommands/-tasks, nur Derived-Adoption erwähnt | stale Remoteresultate können unterschiedlich behandelt werden |
| Damage | `DamageProposalV1` → `DamageCommitV1` | `DamageBridgeCommandV1` → `DamageBridgeReceiptV1` | Prepare, Command und Commit sind anders geschnitten |
| Operation | `RemoteOperationV1` mit `operationId` und Revision | kein OperationId-Vertrag | Crosswalk für OperationId hängt an Variantenwahl |
| Drone/Extraction | eigene Task-, State-, Receipt- und Autonomiemodelle | inkompatible Felder und Statusvokabulare | keine verlustfreie Migration ohne explizites Mapping |
| Slice/Gates | Decision Freeze, gemeinsamer Envelope, Kinetik+Cutter, unbewaffnete erste Drohne | Pure Operations „ready“, Projectile-Familie, Reservoir-First, Voxelbridge deferred | Roadmap und Akzeptanzumfang kollidieren |

Eindämmung: D-02 muss eine Fassung superseden oder einen normativen Merge mit Feld-/Status-/Gate-Mapping veröffentlichen. Besonders wertvolle Teile dürfen nicht durch Copy/Paste kombiniert werden: A hat das stärkere Epoch-/Envelope-/Operationmodell, B bessere Before/After-Receipts, ActionAuthorization und MissingCoverage.

### R-003, P0: Zwei unvereinbare G16-Fassungen

| Thema | G16-A | G16-B | Risiko |
|---|---|---|---|
| Eventauthority | eigener geordneter `CityEventLogV1` plus Checkpoints | zweiter City-/Voxel-Log ausdrücklich verboten; CityPayload genau einmal im globalen `PlanetEvent` | doppelte Weltwahrheit und Replaydivergenz |
| Manifest | `cityId`, `cityRevision`, Terrainrevision, Approvalstatus/-evidence | `worldEventCursor`, Quantization-/Validationprofile; kein City Approval im Manifest | Persistenz und Freigabegrenze kollidieren |
| Approval | `ApprovedCityPlan` und formaler `ApprovalRecord` | Human Gates ohne formalen Record | Audit-/Publishfreigabe nicht konsistent |
| Reservation | `LandmarkReservation` | wire-näheres `AuthoredReservationV1` | Feldsatz und Name sind nicht freeze-fähig |
| Voxelparameter | 0,25 m / 32³ als Pilotvertrag | nur Fixture, keine Produktentscheidung | Fixture kann versehentlich Produktcontract werden |
| Golden Seeds | 8 Seeds, jeder technisch und visuell Pass | 3–5 Golden Seeds; mindestens drei bewusst unterschiedliche Seeds erfüllen alle harten QA-Invarianten | Abnahmevertrag kollidiert |
| Spikeumfang | Brücken/Tunnel, Growth-/Destructionteile enthalten | Brücken/Tunnel, Growth und aktive Destruction aus Spike 1 ausgeschlossen | Gateumfang und Budget kollidieren |

Eindämmung: D-03 muss Eventauthority zuerst entscheiden. Der globalen PlanetEvent-Integration aus G16-B sollte keine parallele Citylog-Basis hinzugefügt werden. Der ApprovalRecord aus G16-A kann als separater ApprovalDecision-Vertrag übernommen werden, nicht als stilles Manifestfeld.

## 4. Cross-Domain-Risikoregister

| ID | Prio | Schattenvertrag | Beleg / konkurrierende Formen | Mögliche Folge | Eindämmung / Ownerentscheidung |
|---|---|---|---|---|---|
| R-004 | P0 | SchemaVersion-Darstellung | kombinierte Stringliterale in G02/G07/G11/G17, Zahl+Schema in G05/G09/G13/G16, `schema` statt `schemaVersion` in G10; BR-Berichte nutzen vier weitere Muster | Parser akzeptieren unterschiedliche Zukunftsversionen; Migration wird mit Protocol-/Packageversion verwechselt | D-05: `SchemaRef` und unknown-version-Regel ratifizieren |
| R-005 | P1 | Stable-ID-Grammatik und Scope | G08/BR-01 Lowercase-Grammatik; G13 `namespace:slug`; G05 menschenlesbare namespaced IDs; G06-A 128-Bit-opak; run-lokale Telemetry IDs; BR-03 `planId` als Digest kanonischer Planbytes, aber G15-B `planId` neben separatem `planHash` | gleiche Strings werden in falschem Scope verglichen, normalisiert oder wiederverwendet | D-04: Atom-/Compound-Grammatik, Typed Refs und Lifecycle-Governance |
| R-006 | P0 | unqualifizierte Revision | `number`, `bigint`, Dezimalstring und opaque String; World/Craft/Document/Task/Content/View/Browser/Device/Git | Overflow, falsche CAS-Vergleiche, Derived Revision wird Authority | D-06: resource-/authority-/epochgebundene Revision; qualifizierte Feldnamen |
| R-007 | P0 | Epoch-Überladung | AuthorityEpoch, SystemEpoch, SimulationEpoch, `lodEpoch`, contentEpoch, Planning Epoch, Worker Generation, Clock Epoch | alte Resultate werden angenommen oder Zeitachsen falsch verglichen | D-06/D-17: nacktes `Epoch` verbieten; getrennte Typen/Wechselregeln |
| R-008 | P0 | Digest ohne Projektion | SHA-256, FNV, CRC, Git SHA, raw byte, semantic, package, authority, payload, chain; teils nackte Strings | falsche Equality, Approval bindet andere Bytes, ContentLock kann nicht reproduziert werden | D-07: Algorithmus + DigestProfileId; CRC/Git/Legacyhash separat |
| R-009 | P1 | SourceBinding wird Provenancecontainer | Runtime Authority Binding, Build-/Dependencylock, Evidence Lineage und Lizenzprovenienz werden vermischt | schlanker Stalenesscheck wächst, sensitive/irrelevante Daten wandern in Runtime | D-06: schmaler SourceBinding; Provenance/Rights/Evidence über Refs |
| R-010 | P0 | Command/Application/Idempotency-ID | G02/G08/G09/G15 `commandId`; G17 `applicationId`; separate `idempotencyKey`, Request-/Task-/Event-IDs | Retry kann doppelt anwenden oder verschiedene Intents kollidieren | D-08: CommandId + RequestDigest; Alias-/Migrationsregel |
| R-011 | P1 | OperationId-Doppelbedeutung | BR-02 run-lokale TelemetryOperation; G15-A langlebige RemoteOperation | Telemetryretention oder Parentbeziehung wird auf Domainworkflow übertragen | D-08: `ExecutionOperationId` und `DomainOperationId` trennen |
| R-012 | P0 | TransactionId-Doppelbedeutung | G02/G11/G17 atomare Change Transaction; G08 Ledgerbuchung | Commit-/Idempotenzcode verwechselt Buchung mit Änderungsgruppe | D-08: `ChangeTransactionId` und `LedgerTransactionId` |
| R-013 | P1 | PreviewRevision/ViewRevision/PreviewReceipt | G02 Revision, G10 View/Time/Draft, G11 Receipt, G13 WorkingRevision, G16 Shadow Plan | Preview wird als Authoritystand oder Approvalbasis ohne vollständiges Binding benutzt | D-06/D-08: PreviewRevision + PreviewReceipt, Base Source zwingend |
| R-014 | P0 | Approval Grant/Decision/Receipt/Ticket | G02 einmaliger Grant; G11 approve/reject Receipt und CommitTicket; G05/G13 Reviewstatus; G15 Authorization; G16 ApprovalRecord | „approved“ kann ohne digest-/scopegebundene Commiterlaubnis interpretiert werden | D-09: vier Lifecycles und Invalidierungsregeln trennen |
| R-015 | P1 | ValidationIssue/Finding/Rejection/Invalidation | G02, G09, G13, G17, BR-01/02/03/04 mit verschiedenen Severity-, Phase-, Status- und Targetmodellen | Suppression greift falsche Regelversion; Warning wird Blocker oder umgekehrt | D-10: gemeinsamer Spine; Blockingwirkung getrennt von Severity |
| R-016 | P0 | Prepare heißt bereits Applied | R09-Text beschreibt Kernelvorschlag, Typ `VoxelEditResult` Status `Applied`; G02 PreparedTransaction; G11 Proposal/Sealed/CommitPrepared; G17 PreparedTransaction | nichtautoritativer Vorschlag kann veröffentlicht oder quittiert werden | D-08: immutable PreparedChangeSet; `Applied` nur nach Writer-Commit |
| R-017 | P0 | CommitReceipt umfasst Nicht-Commits | G15 Statusfamilien, G17 Rejection/OutcomeUnknown, G07 Decision Receipts, TestFlight/Validation Receipts | Timeout/Rejection wird als persistierter Erfolg behandelt; Retry unsicher | D-08/D-11: CommitOutcome; Receipt nur committed/no-op |
| R-018 | P0 | EventEnvelope und Eventlog-Authority | G06/G07/G08/G10/G11/G15/G16 haben unterschiedliche IDs, Sequenzen, Zeit, Chain, Actor, Revision; G16-A/B widersprechen sich beim Streamowner | parallele History, doppelte Anwendung, Replaydivergenz | D-11 nach D-01/02/03: Envelope/Stream/Chain/Commitrelation ratifizieren |
| R-019 | P0 | PackageId/ContentLock wird zu Lockfile-/Git-Pin | G02/G05 Package+Hash, G13 Closure/AuthorityLock, npm lock, repo@SHA, generator content address | Save löst „latest“ oder Toolchainpin statt autoritativem Content auf | CONTENT-Owner übernimmt G13-Spine; D-04/D-07 und Supportfenster |
| R-020 | P0 | Capability-/Availability-Taxonomie | BR-01 supported/unsupported/unavailable/not-requested; BR-02 weitere sechs Status; BR-03 observed/declared/missing; BR-04 lossy Projektion; G07 permission; G08 facility; G09 value availability; G10 time window | lossless Mapping unmöglich; denied, missing und unsupported werden gleichgesetzt | D-12: vier Begriffe und versionierte Adapter; Loss sichtbar machen |
| R-021 | P0 | Actor/Principal/Party/Source | G02 principal; G08 issuerParty; G11 ActorRef; G16 `actorOrSourceId`; G17 origin actor; reviewer/approver/creator als Provenance | fachlicher Actor gilt fälschlich als authentifiziert oder Source als verantwortliche Person | D-13: PrincipalRef, ActorRef, SourceRef, Delegation/Party-Mapping |
| R-022 | P0 | implizite Read-/Write-Sets | G11 first-class Sets; G02/G05 Preconditions/Keys; andere Berichte nur changed/dirty/invalidation/tile cover | versteckte Abhängigkeit umgeht OCC; Dirtyregion wird als autoritatives WriteSet missbraucht | D-14: kanonische Selectoren, Vollständigkeits-/Supersetregel, Setdigest |
| R-023 | P0 | Reservation-Doppelbedeutung | G05 Tokens, G06 Claims, G08 Ressourcen, G11 ScopeLease, G15 Dock, G16 authored Geometrie | temporäre Belegung, Besitz, Geometrie und Arbeitslease teilen falschen Lifecycle | D-15: ResourceReservation, AuthoredSpatialReservation, ScopeLease |
| R-024 | P0 | Unknown/MissingCoverage-Kollaps | Condition unknown, unknown boundary, G15 missing coverage, G13 missing/unloaded/invalid, unsupported capability, review unknown, commit outcome unknown, TS unknown | fehlende Weltzellen werden Air/false; unbestätigter Commit wird fachliches Unknown | D-16: KnowledgeState, CoverageStatus, MissingCoverage; qualifizierte andere Unknowns |
| R-025 | P0 | SimulationTick/SystemEpoch/Clock Epoch | number/bigint/decimal Tick; G10 signed tickUs/SystemEpoch; Authority/LOD/Content/Planning/Worker/GPU epochs | Cross-Timeline-Vergleich, nondeterministischer Replay, Overflow | D-17: SimulationTimeRef; G10 SystemTimeRef separat |
| R-026 | P1 | Presentation wird Authority | ViewRevision, UI Diff, Screenshot, renderer material/representation key, cache artifact revision | UI/Renderer erzeugt Stable IDs, Revisionen oder Commitwahrheit | Paketregel: Adapter nur projizieren; keine Rückimporte/Mutationen |
| R-027 | P1 | BR-04 behauptet nicht vorhandenen Upstream-Receipt | BR-04 entwirft `br01ValidationReceipt`, obwohl BR-01 in der vorliegenden Fassung keinen solchen Typ definiert; BR-04 erklärt selbst, Upstreamberichte hätten gefehlt | erfundene Projection wird fälschlich als BR-01-Authority importiert | BR-04-Typ nur als lokale Adapterprojektion markieren; VAL-Owner entscheidet Receipt |
| R-028 | P1 | lokale Gatecodes werden als Domaincodes gelesen | R09 verwendet `G0`…`G13` als lokale Stop-Gates; G06-A/B und G15/G16 haben kollidierende Gatefolgen | Ticket/Plan verweist auf falsche Domain oder Akzeptanzbedingung | jede Gate-ID mit Dokumentvariante und Version qualifizieren |
| R-029 | P1 | Berichtstatus wird als implementierter Contract gelesen | mehrere Berichte sind `PROPOSED`, `REQUIRES_SPIKE` oder `REQUIRES_OWNER_DECISION`; G08/G11 verbieten produktive Authority-Freigabe; Projekthierarchie priorisiert Git/Tests/Evidence | nicht existente Typen/Pakete werden als Produktwahrheit behandelt | Status/Evidenzrang im Handoff mitführen; keine Existenzbehauptung |
| R-030 | P2 | vorgeschlagene Paketgrenzen werden als reale Pakete bezeichnet | Auftrag benennt gewünschte Sollnamen, Repositoryevidence liegt nicht vor | Imports/Tasks referenzieren Artefakte, die nicht existieren | stets „vorgeschlagen“; Existenz erst nach Repo-/Manifestbeleg |

## 5. Verstärkende Shadow-Contract-Muster

### 5.1 Gleicher Feldname, anderer Lifecycle

- `revision`: Worldzustand, Sourcecode, Browserbuild, GPU-Gerät und Viewcache.
- `transactionId`: atomare Authoringänderung und Ledgerbuchung.
- `approval`: positive Commiterlaubnis, Reviewentscheidung und Provenance-Status.
- `availability`: Wertstatus, Capabilityunterstützung und Zeitfenster.
- `reservation`: Ressourcenhold, authored Geometrie und Coordination Lease.
- `epoch`: Authority-Tenure, Simulationszeit, Orbitzeit, Contentroot und Workerinkarnation.

Regel: Diese Felder dürfen nicht durch einen gemeinsamen String-/Number-Alias „vereinheitlicht“ werden. Zuerst muss der Lifecycle qualifiziert werden.

### 5.2 Anderer Feldname, gleicher Spine

- `CanonicalId`, `StableId`, `applicationId` und viele Domain-IDs benötigen denselben ID-Spine.
- `ValidationIssue`, `ValidationFinding`, Content Issue und ContractIssue benötigen denselben Diagnose-Spine.
- `PreparedTransaction`, Proposal Bundle, Working Candidate und Shadow Plan benötigen eine gemeinsame Prepare-Grenze.
- DomainEnvelope, FactionEventEnvelope, SocietyEvent und PlanetEvent benötigen eine gemeinsame Eventmetadatenbasis.

Regel: Domains dürfen diese Typen nicht durch Copy/Paste angleichen. Sie müssen eine gemeinsame Basisspezifikation importieren und ihre Payloads getrennt versionieren.

### 5.3 Adapter verlieren Information

Der konkret belegte Capabilitykonflikt zeigt das allgemeine Risiko: BR-04 reduziert mehrere Upstreamstatus auf `supported|unsupported|error` und kann `unavailable`, `not-requested`, `not-active`, `permission-denied`, `blocked`, `observed`, `declared` oder `unknown` nicht verlustfrei darstellen. Ein solcher Adapter darf weder als canonical noch als Rückkonverter gelten.

Regel: Jeder verlustbehaftete Adapter muss `losses[]` oder ein gleichwertiges maschinenlesbares Mapping-Resultat liefern und darf nicht in eine Authority zurückschreiben.

## 6. Sofortige Eindämmungsregeln bis zur Ownerentscheidung

1. Keine neue gemeinsame Definition eines der 22 Begriffe außerhalb der vorgeschlagenen Ownergrenze.
2. G06-, G15- und G16-Zitate immer mit Variantenkürzel versehen.
3. Keine unqualifizierten Gate-IDs aus diesen Berichten in Roadmaps, Tickets oder Tests übernehmen.
4. Keine automatische Codegeneration oder Packageerstellung aus diesem Vorschlag.
5. Bestehende Domainformen nur über explizite, versionierte Adapter verbinden.
6. Adapter sind unidirektional, solange Verlustfreiheit nicht bewiesen ist.
7. Schema-/Digest-/Selector-/Status-Mappings erhalten Golden Fixtures und negative Tests.
8. Unknown/Missing/Unsupported/Invalid/Error bleiben beim Mapping getrennt; kein Null-/Default-Fallback.
9. Preview, Proposal, PreparedChangeSet und Workerresultat dürfen nie den autoritativen Writer umgehen.
10. Ein Receipt darf nur vom semantischen Owner des bestätigten Ergebnisses ausgestellt werden.
11. Presentation-/Telemetrytypen dürfen nicht in Authority-/Persistence-Schemas zurückexportiert werden.
12. Die vorgeschlagenen Paketnamen werden bis zum Repositorybeleg ausschließlich als Sollgrenzen bezeichnet.

## 7. Ownerentscheidungen und Risikoabbau

| Entscheidung | Schließt primär | Benötigte Evidenz |
|---|---|---|
| D-01 G06-Fassung | R-001, Teile R-007/R-018/R-025 | Supersession oder Merge, Gate-Mapping, Time/LOD/ID-Freeze |
| D-02 G15-Fassung | R-002, R-011, R-016 bis R-018, R-024 | normativer Status, Envelope-/Task-/Operation-/Receipt-Mapping |
| D-03 G16-Fassung | R-003, R-018, R-023 | Eventauthority, Manifest, Approval, Reservation, Fixture/Gates |
| D-04 Stable IDs | R-005, Teile R-019 | Grammatik, Scope, Allocator, Alias/Tombstone |
| D-05 SchemaRef | R-004 | Wireform, Migration, Unknown-Version-Goldens |
| D-06 Authority/Revision/Source | R-006, R-007, R-009, R-013 | CAS-/Epoch-/No-op-/Staleness-Tests |
| D-07 Digests | R-008, Teile R-019 | kanonische Bytefixtures und Cross-Runtime-Goldens |
| D-08 Command Lifecycle | R-010 bis R-017 | Idempotenz-, Prepare-/Commit-, Retry- und Outcome-Tests |
| D-09 Approval | R-014 | Digest-/Scope-/Expiry-/Revocation-Tests |
| D-10 Validation | R-015, R-027 | Issue-/Receipt-Schema, Fingerprint-/Suppression-Goldens |
| D-11 Eventing | R-018 | Stream-/Sequence-/Chain-/Replay- und Commitrelation-Goldens |
| D-12 Capability | R-020 | vollständige Crosswalk-Tabelle und Verlusttests aller Statuswerte |
| D-13 Identity | R-021 | Principal-/Actor-/Source-/Delegationsmodell und Auditbeispiele |
| D-14 Read/Write Sets | R-022 | Selector-Goldens, Konfliktmatrix, Supersetbeweis |
| D-15 Reservations | R-023 | getrennte State Machines und Migrationsfälle |
| D-16 Unknown/Coverage | R-024 | Reason-/Propagation-Matrix und Missing-never-Air-Negativtests |
| D-17 Simulation Time | R-025 | Tick-/Epoch-/Pause-/Migration- und Cross-Timeline-Tests |

## 8. Freigabekriterium für G18

Der Status darf erst auf `READY_FOR_G18_INPUT` wechseln, wenn:

- D-01, D-02 und D-03 eine autoritative Fassung oder einen normativen Merge benennen;
- für jeden der 22 Begriffe genau ein semantischer Owner und eine Basispaketgrenze dokumentiert sind;
- D-04 bis D-17 entweder entschieden sind oder eine zeitlich begrenzte, nicht überlappende Adapterregel mit benanntem Owner besitzen;
- Schema-, Digest-, Status-, Selector- und Replay-Goldens die Cross-Domain-Grenzen prüfen;
- kein Dokument behauptet, die vorgeschlagenen Pakete existierten, bevor Repository, Manifest und veröffentlichte Importgrenze dies belegen.

Bis dahin bleibt der einzig belastbare Gesamtstatus: `REQUIRES_OWNER_DECISION`.
