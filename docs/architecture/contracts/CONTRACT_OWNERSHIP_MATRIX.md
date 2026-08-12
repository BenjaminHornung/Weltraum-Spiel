# Contract Ownership Matrix

Status: `REQUIRES_OWNER_DECISION`  
Stand: 2026-08-12  
Dokumenttyp: vorgeschlagene semantische Ownership- und Paketgrenzen-Matrix

> Alle Ownerrollen und Paketnamen in diesem Dokument sind Vorschläge. Die Matrix behauptet weder, dass die Rollen bereits ernannt sind, noch dass die genannten Pakete bereits existieren oder veröffentlicht wurden.

## 1. Scope und Lesart

Die Matrix basiert auf den vollständig gelesenen Abschlussberichten G02, G05, G06-A/B, G07, G08, G09, G10, G11, G13, G15-A/B, G16-A/B und G17 sowie den bereitgestellten ergänzenden Forschungs-, Audit-, Benchmark-, Telemetrie- und Reviewberichten.

„Importiert“ bedeutet die vorgeschlagene Sollrichtung. „Erweitert“ bedeutet: Eine Domain darf typisierte Payloads, engere gebrandete IDs, Selectorprofile, Digestprofile oder geschlossene Reason Codes ergänzen. Sie darf Identität, Lebensdauer, Vergleichsregeln oder Pflichtfelder des gemeinsamen Spines nicht umdefinieren.

Variantenkürzel:

- G06-A: Fassung `NPC_Gesellschaft_Simulations_LOD`
- G06-B: Fassung `NPC_Gesellschaft_Verhalten_Simulations_LOD`
- G15-A: Fassung mit `DomainEnvelope` und `RemoteOperationV1`
- G15-B: Fassung mit Observation → Track → Authorization → Action → Receipt → Ledger
- G16-A: Fassung mit `ApprovedCityPlan`, `ApprovalRecord` und eigenem CityEventLog
- G16-B: Fassung mit globalem `PlanetEvent` und `AuthoredReservationV1`

## 2. Vorgeschlagene Ownerrollen

| Kürzel | Vorgeschlagene Rolle | Verantwortungsgrenze |
|---|---|---|
| CORE | Core Contract Owner | primitive Wire-Formen, SchemaRef, Stable IDs, Digestform, Knowledge-/Availability-Grundbegriffe |
| AUTH | Authority & Concurrency Owner | AuthorityEpoch, Revision, SourceBinding, CAS und Staleness |
| IDP | Identity & Policy Owner | Principal, Actor-Delegation, Capability Decisions und Approval Policy |
| CMD | Command & Mutation Owner | Command-, Operation-/Transaction-, Preview-, Prepare- und Commit-Lifecycle |
| EVT | Event Contract Owner | EventEnvelope, Stream-ID, Sequenz, Chainprofil und Replaygrenze |
| VAL | Validation Contract Owner | ValidationIssue/-Receipt, MissingCoverage, Suppression- und Quick-Fix-Refs |
| CONTENT | Content Package & Resolver Owner | PackageId, EntryId, Content-/Authority-Lock, Migration und Aktivierung |
| CAP | Capability Vocabulary Owner | CapabilityRef/Status, Availability und verlustfreie beziehungsweise explizit verlusthafte Mappings |
| CLOCK | Simulation Clock Owner | SimulationTimeline, SimulationEpoch, Tick, Rate und Cross-Epoch-Regeln |
| RESOURCE | Resource Coordination Owner | zeitliche Resource Reservations; Domainowner besitzen Ressourcen- und Mengenregeln |
| DOMAIN | jeweiliger Domainowner | Aggregate, fachliche Payloads, Codes, Selectoren und Digestprofile |

Keine dieser Rollen darf durch einen Presentation Adapter, Renderer, Worker, Telemetry Collector oder AI-Modelloutput wahrgenommen werden.

## 3. Ownership-Matrix

| Nr. | Angefragter Begriff | Kanonischer Sollbegriff | Semantischer Owner | Vorgeschlagene Paketgrenze | Soll importieren | Darf erweitern | Offene Entscheidung |
|---:|---|---|---|---|---|---|---|
| 1 | `StableId` | `StableId<K>`; generisch `StableRef` | CORE; konkreter Kind-/Namespace-Owner ist DOMAIN | `@weltraum/core-contracts` | alle Domains, Contractpakete und Adapter | Domains nur durch gebrandete Kindtypen und registrierte Ableitungs-/Namespaceprofile | D-04: Atom-/Compound-Grammatik, Case, Maximallänge, Eindeutigkeitsscope, Runtimeallocator |
| 2 | `SchemaVersion` | `SchemaRef { schemaId, schemaVersion }` | CORE für Form; DOMAIN für konkrete Schemas/Migratoren | `@weltraum/core-contracts` | alle persistierten und prozessübergreifenden Verträge | Domain-Schema-IDs, geschlossene Versionen und gerichtete Migrationen | D-05: Zahl vs Literal, Wirebreite, Schema-ID-Form, unknown-version-Verhalten |
| 3 | `AuthorityEpoch` | `AuthorityEpochRef` | AUTH | `@weltraum/core-contracts` | Commands, Preview, Prepare, Approval, Worker-Adoption, Events, Receipts | Domains nur durch Authority-Scope-Refs; LOD-/Worker-/Content-Epochen bleiben separat | D-01/02/03/06: Variantenwahl, Wiretyp und Epochwechsel |
| 4 | `Revision` | resource- und authority-gebundene `Revision`; Felder fachlich qualifiziert | AUTH; Aggregate-Inkrementregel bei DOMAIN | `@weltraum/core-contracts` | alle CAS-, Replay-, Persistenz-, Preview- und Derived-Verträge | gebrandete `DocumentRevision`, `CraftRevision`, `WorldRevision` etc. | D-06: DecimalUint64, No-op, Scope, Mehrfachaggregate, Reset |
| 5 | `ContentDigest` | `ContentDigest` + `DigestProfileId` | CORE für Form; Profilowner ist DOMAIN oder CONTENT | `@weltraum/core-contracts` | alle Domains, SourceBinding, ContentLock, Approval, Validation, Receipt, Event | versionierte Package-/Authority-/Payload-/State-/Artifact-Profile | D-07: SHA-256-Basis, Encoding, JCS/Framing, Profilregistry, Legacyhashes |
| 6 | `SourceBinding` | `SourceBinding`; mehrere Quellen als `SourceBindingSet` | AUTH | `@weltraum/core-contracts` | derived Ergebnisse, Preview, Prepare, Validation, Contentactivation, Receipts | G09 Craft/Catalog/Policy, G10 Frame/Time/Propagator, G06 LOD/Request, Content Exact Refs | D-06/07: Epoch-/Digestpflicht, Multi-Source-Form, Contentquelle ohne Authority |
| 7 | `CommandId` | `CommandId` | CMD | `@weltraum/command-contracts` | alle mutierenden Domains, Eventing, Audit und Receipts | geschlossene Commandtypen und Payloads | D-08: Scope, Vergabe, Idempotenzfenster, G17 `applicationId`-Migration |
| 8 | `OperationId` | `ExecutionOperationId` und `DomainOperationId`; kein nackter portabler Alias | CMD für Domainworkflow; Observability Owner für Execution | `@weltraum/command-contracts`; Telemetry-Extension domain-/adapterseitig | G11/Telemetry für Execution; G15-A für Domain Operation | Parent/Run/Attempt beziehungsweise Art/State/Plan/Milestones | D-02/08: G15-A/B, Bedarf beider Typen, Operation vs Task |
| 9 | `TransactionId` | `ChangeTransactionId`; Economy separat `LedgerTransactionId` | CMD; Economy DOMAIN für Ledger | `@weltraum/command-contracts`; Ledgertyp im Economy-Paket | G02, G11, G17 und alle atomaren Mutationdomains | Aggregate-/Domaintransaktionspayloads | D-08: Scope, Einzelcommands, Cross-Authority-Atomizität, Aliasstrategie |
| 10 | `PreviewRevision` | `PreviewRevision` plus separates `PreviewReceipt` | CMD | `@weltraum/command-contracts` | G02, G09, G10, G11, G13, G16, G17 und Preview Adapter | Domain-Diff-, Viewpoint-, Simulations- und Geometry-Evidence | D-06/08: mutable Revision vs immutable Previewinstanz, Reset, Receiptpflicht |
| 11 | `ApprovalGrant` | `ApprovalGrant`; getrennt `ApprovalDecisionRecord`, `ApprovalReceipt`, `CommitTicket` | IDP | Grant-Spine beziehungsweise Refs in `@weltraum/command-contracts`; Policy im Domain-/Security-Paket | Commit Coordination, G02, G05, G07, G09, G10, G11, G13, G15, G16, G17 | Risk Tags, Effect Bounds, Approverrollen, Visual-/Warning-Scope | D-09: Begriffe, Zeitbasis, Nutzungsgrenze, Zwei-Personen-Gates, Revocation |
| 12 | `ValidationIssue` | `ValidationIssue`; `issueKey` getrennt von `occurrenceId` | VAL | `@weltraum/validation-contracts` | alle Domains, Preview, Prepare, Publish und QA | Code-Namespaces, Targets, Evidence, Responsibility, Quick-Fix-Refs | D-10: Severity, Blocking, Status, Fingerprint, Receipt, Suppression |
| 13 | `PreparedChangeSet` | `PreparedChangeSet` | CMD | `@weltraum/command-contracts` | G02, G05, G09, G10, G11, G13, G16, G17; später andere Mutationdomains | typisierte Deltas, Effects, Inverses, Impact- und Candidate-Artefakte | D-08/09/10: Status vor/nach Approval, Inversepflicht, inline vs content-addressed |
| 14 | `CommitReceipt` | `CommitReceipt` nur für bestätigt committed/no-op; umgebend `CommitOutcome` | CMD; ausstellend nur die Writer-Authority | `@weltraum/command-contracts` | alle mutierenden Domains, Audit, History, Idempotenz und Persistence | fachliche Resultpayloads, Eventrange, ID-Mapping, inverse/dirty Sets | D-08/11: Granularität, No-op, G15/G17-Mapping, Commit-to-Event |
| 15 | `EventEnvelope` | `EventEnvelope<P>` | EVT; Payloadowner ist DOMAIN | `@weltraum/command-contracts` | alle Eventproduzenten, Replay, Projection, Persistence und Audit | geschlossene Payloads, Spatialindex, Chainprofile, Algorithmus-/Zeitbindungen | D-01/02/03/11: G06/G15/G16, globaler PlanetEvent vs CityEventLog, Sequence-/Chainpflicht |
| 16 | `PackageId` / `ContentLock` | `PackageId`, `EntryId`, `ContentLock`, getrennt `AuthorityLock` | CONTENT, Ausgangspunkt G13 | `@weltraum/content-contracts` | alle paketierten Inhalte, Saves, Server, Registry, Generatoren, Events | Domain Entry-Kinds, Exportpayloads, Schemas und Lockprojektionen | D-04/07 plus Namespace, Supportfenster, Patch/Override, Mod-Code |
| 17 | `Capability` / `Availability` | `CapabilityRef`, `CapabilityDecision`, `CapabilityStatus`, `Availability<T>`; Aggregat `CapabilityCoverage` | CAP für Vocabulary; IDP für Decision; DOMAIN für Definition | Grundtypen in `@weltraum/core-contracts`; Decisions/Definitionen domainseitig | alle Domains, Adapter, Evidence, Contentactivation, Authorization | namespaced Facility-, Tool-, Model-, Package-, Drone-, Gameplay- und Plattformfähigkeiten | D-12: Status-/Reason-Taxonomie, observed/declared, Namespaces, Mappingverluste |
| 18 | `Actor` / `Principal` | `PrincipalRef`, `ActorRef`, getrennt `SourceRef` | IDP; Actor-Arten bei DOMAIN | `@weltraum/core-contracts` | Commands, Approvals, Events, Audit, Simulation, Narrative, Economy | NPC, Party, Organisation, Drone, System, Tool, Agent und Delegation | D-13: Realm, Principal↔Actor, Issuer, Party, Systemactor, Actorrollen |
| 19 | `ReadSet` / `WriteSet` | `ReadSet`, `WriteSet` mit versionierten Selectoren und Setdigests | CMD/AUTH; Selectorowner ist DOMAIN | `@weltraum/command-contracts` | alle parallel editierbaren/atomaren Mutationdomains und PreparedChangeSet | räumliche Bounds, Zellbereiche, Graph-/Field-/Ledger-/Inventoryselectoren | D-14: Syntax, Granularität, Wildcards, exakte vs konservative Sets, Merge |
| 20 | `Reservation` | `ResourceReservation`, `AuthoredSpatialReservation`, `ScopeLease` getrennt | RESOURCE, City DOMAIN, Collaboration DOMAIN | Resource-Spine nach D-15 in `@weltraum/command-contracts`; Spatial/Lease domainseitig | G05/G06/G08/G15 für Resource; G16 für Spatial; G11 für Lease | Mengen-/Kapazitäts-, Geometry-, Activity-, Docking- und Coordination-Payloads | D-03/15: drei Lifecycles, Mengenunion, Zeitbasis, Dock- und G16-A/B-Semantik |
| 21 | `Unknown` / `MissingCoverage` | `KnowledgeState<T>`, `CoverageStatus`, `MissingCoverage`; `IndeterminateCommitOutcome` separat | CORE für Knowledge/Coverage; VAL für MissingCoverage | Knowledge/Coverage in `@weltraum/core-contracts`; MissingCoverage in `@weltraum/validation-contracts` | Conditions, Validation, Connectivity, Voxel/Streaming, Contentload, Capability, AI Context | Reason-Code-Namespaces, Coveragegeometrien, Retryregeln, probabilistische Estimates | D-10/12/16: Reasonfamilien, Propagation, Availability-Beziehung, Gatewirkung |
| 22 | `SimulationTick` / `Epoch` | `SimulationTimeRef { timelineRef, simulationEpochId, simulationTick }`; G10 `SystemTimeRef` separat | CLOCK; G10 Celestial-Time-Owner für SystemEpoch | `@weltraum/core-contracts`; G10-spezifisches Zeitpaket domainseitig | G05/G06/G07/G08/G15, G16-B für `PlanetEvent`; G16-A nur bei zeitgebundenen Runtimeevents; Authoring sonst nur bei Runtime-/Receiptbindung | Kalender-/World-Time-Adapter, Scheduler, Orbitalzeit | D-01/02/03/17: Tick-Wiretyp, Rate, Pause/Acceleration, Epoch-Lifecycle |

## 4. Paketgrenzen

| Vorgeschlagene Sollgrenze | Inhalt | Darf importieren | Enthält ausdrücklich nicht |
|---|---|---|---|
| `@weltraum/core-contracts` | IDs/Refs, SchemaRef, Digestform/Profile-Ref, AuthorityEpoch/Revision/SourceBinding, Principal/Actor, Capability-/Availability-/Knowledge-Primitiven, Simulation-Time-Primitiven | keine andere vorgeschlagene Contractgrenze | Domainpayloads, Commands, Paketmanifeste, Validatorimplementierung, Renderer/UI, DB-/Netzwerkcode |
| `@weltraum/command-contracts` | Command-/Operation-/ChangeTransaction-IDs, Preview, Read/Write Sets, gegebenenfalls ResourceReservation-Spine, PreparedChangeSet, ApprovalGrant-Ref/Spine, CommitOutcome/-Receipt, EventEnvelope | nur `@weltraum/core-contracts`; Validation/Content ausschließlich über opaque Refs und Digests | Domainpayloads, Policy Engine, Validatorpayloads, DB-Transaction, UI-State |
| `@weltraum/content-contracts` | Package-/Entry-ID, Paketmanifest-Spine, Content-/Authority-Lock, Resolver-/Activation-/Migration-/Provenance-/Rights-Refs | nur `@weltraum/core-contracts` | npm-Lockfile als Domainvertrag, Loader, Runtimehandle, Rendererasset, Hot-Reload-UI |
| `@weltraum/validation-contracts` | ValidatorBinding, ValidationIssue/-Receipt, MissingCoverage, SuppressionRef, QuickFixRef | nur `@weltraum/core-contracts`; Commandbezug als opaque Ref | Domainvalidator, lokalisierte UI, automatische Quick-Fix-/Commitauthority |
| domain-specific packages | Aggregate-/Resource-/Actor-Refs, Commands/Events/Issues/Receipts als Erweiterungen, Domain-Digest-/Selector-/Migrationprofile | Core und bei Bedarf Command, Content, Validation | Kopien gemeinsamer Spines, Renderer- oder Presentationauthority |
| presentation adapters | explizite Abbildung auf UI, Editor, Engine, Telemetrie und Evidence | alle benötigten Contract-/Domainpakete | Stable-ID-Vergabe, Revisionsinkrement, Approval, Validierungswahrheit, kanonische Digestbildung, autoritative Mutation |

## 5. Abhängigkeitsregel

Die zulässige Sollrichtung lautet:

1. `@weltraum/core-contracts`
2. darauf jeweils unabhängig `@weltraum/command-contracts`, `@weltraum/content-contracts`, `@weltraum/validation-contracts`
3. darauf `domain-specific packages`
4. darauf `presentation adapters`

Rückimporte sind nicht zulässig. Insbesondere darf Core kein Domainpaket importieren. Command, Content und Validation dürfen einander nicht direkt importieren; sie referenzieren fremde Artefakte über Core-IDs, Refs und Digests. Diese Regel verhindert, dass ein ValidationReceipt eine konkrete Domaincommand-Payload oder ein ContentLock einen Renderer-/Loadertyp zum gemeinsamen Vertrag macht.

## 6. Normative Ownership-Regeln

1. Jeder gemeinsame Begriff hat genau einen semantischen Owner und eine Basispaketgrenze.
2. Ein Re-Export erzeugt keine neue Definition und keinen neuen Owner.
3. Domains komponieren gemeinsame Spines und ändern keine Pflichtfelder, Lebenszyklen oder Vergleichsregeln.
4. Jede persistierte Revision ist an Resource, Authority und Epoch gebunden.
5. Nacktes `Epoch` ist verboten; Authority-, Simulation-, System-, Content-, Planning-, LOD- und Worker-Epochen bleiben getrennte Typen.
6. Ein unbekanntes Schema wird ohne registrierte Migration fail closed behandelt.
7. Ein autoritativer Digest bestimmt Algorithmus und Digestprofil eindeutig.
8. SourceBinding identifiziert den Quellstand, nicht die vollständige Provenance oder Lizenzlage.
9. Command, Execution Operation, Domain Operation und Change Transaction haben getrennte IDs und Lifecycles.
10. Preview und PreparedChangeSet sind Kandidaten und verleihen keine Authority.
11. Nur ein bestätigter Commit oder bestätigter No-op erzeugt einen CommitReceipt.
12. Approval ist an Digest, Scope, Policy, Principal, Ablauf und Nutzungsgrenze gebunden.
13. ValidationIssue, Suppression, Approval und Presentationstatus sind getrennte Artefakte.
14. Domainereignisse komponieren den gemeinsamen EventEnvelope; sie definieren keinen parallelen Basisenvelope.
15. Capability, Autorisierungsentscheidung, beobachteter CapabilityStatus und Availability eines Werts sind getrennt.
16. Principal, fachlicher Actor und Provenance Source sind getrennt.
17. Dirty-/Invalidation-Sets sind keine Read-/Write-Sets.
18. Authored Spatial Reservation und ScopeLease sind keine ResourceReservation.
19. Unknown und MissingCoverage werden nie in false, 0, Air oder Pass umgedeutet.
20. Presentation Adapter haben keine Authority.

## 7. Entscheidungsabhängigkeiten und Freigabe

| Priorität | Entscheidungen | Wirkung |
|---|---|---|
| P0 | D-01 G06, D-02 G15, D-03 G16 | wählt die überhaupt zitierbare normative Berichtsfassung und löst Gate-/Statuskollisionen |
| P0 | D-06 Authority, D-08 Command Lifecycle, D-11 Eventing | ermöglicht SourceBinding, Prepare/Commit und Eventintegration ohne Schattenenvelopes |
| P0 | D-10 Validation, D-12 Capability, D-15 Reservation, D-17 Time | verhindert gegenwärtig nicht verlustfrei abbildbare Status- und Lifecyclekonflikte |
| P1 | D-04 IDs, D-05 Schema, D-07 Digests, D-09 Approval, D-13 Identity, D-14 Selectoren, D-16 Unknown | friert Wireform, Governance und Adapterverhalten ein |

Solange die P0-Entscheidungen nicht dokumentiert sind, bleibt die Matrix `REQUIRES_OWNER_DECISION`. Erst eine ratifizierte Fassung mit benanntem Owner, Entscheidungsdatum und Supersession-/Migrationsplan darf auf `READY_FOR_G18_INPUT` gesetzt werden.
