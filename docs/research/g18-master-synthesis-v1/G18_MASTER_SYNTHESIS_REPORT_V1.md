# G18 Master-Synthese V1

Datum: 2026-08-12  
Gesamtstatus: `REQUIRES_OWNER_DECISION`  
Arbeitsmodus: read-only Synthese, keine Implementierung  
Technische Referenzgrenze: Voxel-Lab `BenjaminHornung/hestia-voxel-kernel-lab@d95992df05952ac4be6221ca1809c1c9e3c0ac9d`

## 1. Ergebnis

Die G18-Synthese ist fachlich abgeschlossen. Sie legt eine gemeinsame Produkt- und Authoring-Richtung fest, autorisiert aber keine Implementierung. Das Spiel wird als kausale Aufstiegssimulation geplant: vom gestrandeten Ueberlebenden ueber eine erste Stadt und belastbare Vertragsbeziehungen bis zu Schiff, Orbit und einem kleinen interstellaren Netzwerk. Materie, Energie, Logistik, Wissen, Rechte, Beziehungen und Weltzustand bleiben dabei dieselben nachvollziehbaren Ledgers.

Die zentrale Architekturentscheidung ist ein gemeinsamer renderneutraler Command-/Transaction-/Receipt-Kern. Developer Editor und Player Builder verwenden kompatible Domain-Vertraege und Commit-Semantik, bleiben aber getrennte Produkte mit getrennten Berechtigungen, Oberflaechen und Distributionsgrenzen. Der Kern wird als `PROPOSED_FOR_OWNER_ACCEPTANCE` gefuehrt. Vor seiner Annahme und den aufgefuehrten Spikes besteht keine technische Integrationsfreigabe.

Die erste Write-Arbeit ist ausschliesslich der kleine G03A-Topologie-Spike in einem neuen isolierten Ort ausserhalb von Produktrepo und Voxel-Lab. Danach wird gestoppt und eine ADR vom Owner entschieden. WP04 ist keine integrierte technische Wahrheit, solange kein spaeteres `ACCEPT` und keine nachgewiesene `--ff-only`-Integration vorliegen.

## 2. Harte Startbedingung und Quellen-Freeze

Die Startbedingung ist durch das Launch-Addendum des Owners erfuellt. Die Finalbestaetigung bezieht sich auf die aktive Dateiidentitaet und ihre Eignung als Syntheseeingang. Sie bedeutet nicht, dass jede darin vorgeschlagene Produktentscheidung bereits akzeptiert ist.

| Aktive Quelle | SHA-256 | Quellenstatus fuer G18 | Interner Entscheidungsstatus |
|---|---|---|---|
| `G03A_owner_freeze_command_receipt_rfc_spike1_plan_2026-08-12.md` | `052b292977229abfec977ac4a2ac6341b3a8e1aabbca7bee5400ea5c4a79f5da` | final bestaetigter aktiver G03-Folgeeingang | `REQUIRES_OWNER_DECISION`, danach isolierter Spike |
| `G04_settlement_city_builder_system_abschlussbericht_2026-08-12(1).md` | `cdb98f5404028b23f2c907fee3d4679bfb084a4dd05cee2eb72e72c1cd1efb54` | final bestaetigter aktiver Eingang | Bericht `COMPLETED`, Produktvorschlaege teils `REQUIRES_OWNER_DECISION` |
| `G08_Wirtschaft_Handel_Produktion_Logistik_Abschlussbericht_2026-08-12(4).md` | `f04f80f890ff3e079e35c83ef2c5baae0ba4e8c53b0b59cda968760c98cdf572` | aktiver Eingang | `READY_FOR_SYNTHESIS` |
| `G13_Content_Data_Modding_Versioning_Hot_Reload_Abschlussbericht_2026-08-12(3).md` | `dfd28aec6ca16ed6f65fa032f55f5c9760cedf2a12b27ad43dc7c235f64b0b28` | aktiver Eingang | `REQUIRES_OWNER_DECISION`, sekundär `REQUIRES_SPIKE` |
| `G16_procedural_settlement_city_generation_abschlussbericht_2026-08-12(4)(2).md` | `0e5f31c3f180dc0824f09500d770276601c88c7c6c60b05ba4dfe75579e40295` | aktiver Eingang | `REQUIRES_SPIKE` |
| `G17_Editor_QA_Validation_Playwright_Automation_Abschlussbericht_2026-08-12(2).md` | `a46416858744904359b7719fd5ca158b6d90fce17f9c00b6415ca4fdf0dc1365` | aktiver Eingang | `REQUIRES_OWNER_DECISION` |

G03A ist die vom Owner als aktuell bestaetigte G03-nahe Grundlage. Der in G03A referenzierte urspruengliche G03-Technologie-Bakeoff lag nicht als eigene Datei vor und wird daher nicht rekonstruiert oder erfunden. Aeltere File-Library-Versionen sind nicht in den aktiven Quellen-Freeze eingeflossen.

Die bereitgestellten G01-, G02-, G05-, G06-, G07-, G09-, G10-, G11-, G12-, G14- und G15-Berichte wurden als weitere Fachquellen verwendet. Bei mehrfach vorhandenen G06-, G07- und G15-Fassungen wurde keine alte Fassung stillschweigend ueber eine neuere gestellt; konservative, kompatible Aussagen wurden synthetisiert und Konflikte bleiben Ownerfragen.

Projekt-Memory, Instructions Addendum, Research Register sowie die bereitgestellten Research- und Benchmarkberichte waren verfuegbar. Separate Dateien mit den exakten Namen `WELTRAUM_RESEARCH_SYNTHESIS_2026-08-12.md`, `WELTRAUM_RESEARCH_DECISION_LOG_2026-08-12.md` und `WELTRAUM_GAMEPLAY_EDITOR_VISION_ADDENDUM_2026-08-12.md` lagen nicht vor. P06 Intake Audit und X01 Contract Crosswalk lagen ebenfalls nicht vor. X01 ist deshalb als Folgegate 02 vorgesehen. Keine dieser Luecken wurde mit erfundenem Inhalt gefuellt.

## 3. Nachweisgrenze

- Keine Repositorydatei wurde veraendert, kein Commit, Push, Merge, PR oder Rebase ausgefuehrt.
- Keine lokale Produkt- oder Voxel-Lab-Ausfuehrung wurde vorgenommen.
- Builds, Tests und Benchmarkangaben aus Berichten oder Prototype-Delivery-Notes sind Fremdclaims und wurden nicht als eigene Messung ausgegeben.
- P01 bis P05 wurden als Prototype-Quellen untersucht. Ihre UX ist keine implementierte Produktfunktion.
- WP04-Berichte duerfen Research-Kontext liefern, aber keine integrierte Wahrheit. Die Integrationsgrenze bleibt ein spaeteres `ACCEPT` plus nachgewiesenes `--ff-only`.
- G18 bleibt von Voxel-Lab-C08 getrennt.

## 4. Systemisches Produktbild

### 4.1 Spielerische Saeulen

1. Physische Agency: Ressourcen, Bauteile, Ladung und Beschaedigung besitzen nachvollziehbare Konsequenzen.
2. Erarbeitete Reichweite: neue Orte und der Orbit entstehen aus Wissen, Rechten, Logistik und Infrastruktur, nicht aus einem abstrakten Levelsprung.
3. Logistik und Engineering: Transport, Verarbeitung, Energie, Kapazitaet und Wartung verbinden alle Massstaebe.
4. Zugehoerigkeit und Folgen: Organisationen, Reputation, Recht, Beziehungen und Verträge veraendern den Zugang zur Welt.
5. Persistente, selbst gewaehlte Geschichte: Missionen und Krisen greifen auf reale Weltzustaende zu, bleiben aber autorisiert und nachvollziehbar.

### 4.2 Kernloop

`verstehen -> sichern -> verarbeiten oder konfigurieren -> transportieren oder einsetzen -> Ziel oder Vertrag erfuellen -> materielle und soziale Folge verbuchen`

### 4.3 Scope-Regel

Tiefe entsteht zunaechst durch genaue Vertraege, deterministische Reducer und kleine nachweisbare Ledgers. Breite wird nur nach einem Gate erweitert. Das MVP endet mit dem ersten belastbaren Vertragskreislauf in der ersten Stadt, nicht mit einer vollstaendigen Planeten-, NPC-, Economy-, Schiffs- und Raumfahrtsimulation.

## 5. Aufgeloeste Konflikte

| Konflikt | G18-Aufloesung | Restgate |
|---|---|---|
| Developer Editor vs Player Builder | Getrennte Produkte und Policies, gemeinsame versionierte Domain- und Command-Semantik. Der Player Builder importiert nie die Developer-Shell. | Owner akzeptiert Produktgrenze. |
| In-runtime vs separate Browser-App | Zielhypothese: separate gekoppelte Developer-App; Player Construction bleibt Runtime-Workspace. G03A muss `SEP-D` gegen `OVR-D` vergleichen. | Topologie-ADR nach Spike 1. |
| Simulationstiefe vs Scope | Hohe Integritaet in kleinen Datenmengen; vertikale Erweiterung erst nach Exit Gate. | Slice-Budgets und Abbruchschwellen. |
| Individuelle NPCs vs Kohorten | Vorgeschlagen: 2048 persistente Personen-IDs; Kohorten reduzieren Ausfuehrung, nicht Existenz. Aktiv detailliert werden nur etwa 80 bis 250 Aequivalente, visuell noch weniger. | Browserbudget-Spikes. |
| Dynamische Economy vs authored progression | G08 besitzt eine deterministische Stock-and-Flow-Authority innerhalb authored Recipes, Budgets, Contracts und Recovery Bounds. Preise folgen lokaler realer Knappheit. | Integer-/Auction-Spike und Balancing. |
| Story Graph vs dynamische Missionen | StoryGraph, MissionGraph und DialogueGraph bleiben getrennt. Dynamische Angebote stammen aus deterministischen Templates; kein Runtime-LLM. | G05-Schema- und Compiler-Gates. |
| Custom Editor vs externe Tools | Headless eigener Kern und Browser-Shell. Blender ist Source-DCC; React Flow kann Graphprojektion sein. PlayCanvas, Babylon und Prototype-Shells sind keine Authorities. | G03A-ADR und Lizenzpruefung. |
| 0,25 m vs 0,125 m Assets | 0,25 m ist V1-Authoring- und HVOX-Norm. 0,125 m bleibt lokale Hero-Research-Option. Das 0,5-m-Builderraster ist davon getrennt. | G12-Spikes, keine G18-Integration. |
| Surface, City, Space Reihenfolge | Crash/Sicherung, Wilderness, erste Stadt und Vertrag, Surface Logistics, Schiff, Orbit, contested route, zwei Systeme. | Jedes Slice besitzt eigenes Exit Gate. |
| AI-Autonomie vs Approval | AI darf lesen, vorschlagen, previewen und isoliert stagen. Nur Host und Mensch autorisieren exakten Commit; kein Commit- oder Destructive-Tool fuer das Modell. | Security- und Approval-Tests. |
| Modding vs Save/Security | V1 nur deklarative datenbasierte Packages mit IDs, Digests, Locks, Provenienz und Quarantaene. Kein JS; Wasm erst nach eigenem Spike. | G13 Owner-Freeze und Goldens. |

## 6. Architekturentscheidung

### Entscheidung A01: Gemeinsamer renderneutraler Kern

Status: `PROPOSED_FOR_OWNER_ACCEPTANCE`

Alle autorisierten Mutationen laufen durch genau einen Command-/Transaction-/Receipt-Pfad. Eine Domain Authority besitzt den kanonischen Zustand. Oberflaechen, Renderer, Graphen, Karten, AI und externe Tools sind Projektionen oder Antragsteller, niemals parallele Authorities.

Der minimale Pfad lautet:

`Intent -> trusted Gateway Binding -> Validate/Dry Run -> isolierte Preview -> Impact und Approval -> Prepare -> CAS Commit -> atomarer Root-/History-/Receipt-Schreibvorgang -> Projektionen`

Pflichtinvarianten:

- Actor, Policy und Capability stammen aus einer vertrauenswuerdigen Gateway-Session, nicht aus dem Client-Envelope.
- Revisionen sind monoton.
- Basisrevision und Basisdigest werden per CAS geprueft.
- Wiederholungen sind idempotent und unbekannte Commit-Ausgaenge werden abgeglichen statt blind wiederholt.
- Undo ist eine neue autorisierte Transaction mit exaktem Inverse, kein Rueckdrehen der Revisionsnummer.
- Commit Receipt, Projection Receipt, Validation Report, Approval Record und E2E Receipt sind getrennte Typen.
- AI kann nur einen versiegelten Vorschlag zur menschlichen Freigabe liefern.

Die normative Detailfassung steht in `EDITOR_COMMAND_CONTRACT_V1.md`. G03A stellt die praezise Low-Level-Spike-Grundlage, G02 die Plattform- und Approval-Policy, G11 die AI-Sicherheitsgrenze und G17 Validierung, Persistenz sowie E2E-Nachweise.

## 7. Entscheidungs- und Reifegradmatrix

| Thema | Entscheidung | Status | Naechster Beleg |
|---|---|---|---|
| Command-Kern | gemeinsam, renderneutral, eine Commit-Authority | `REQUIRES_OWNER_DECISION` | Owner Receipt, X01, Spike 1 |
| Developer-Topologie | separate App als Zielhypothese, Overlay als Vergleich | `REQUIRES_SPIKE` | G03A `SEP-D` vs `OVR-D` ADR |
| Player Builder | schmale Runtime-Allowlist, keine Developer-Shell | `REQUIRES_OWNER_DECISION` | Capability-Matrix |
| Persistenz | Snapshot als Primaerwahrheit plus kurzer ChangeSet-Tail | `REQUIRES_OWNER_DECISION` | Kernel- und Recovery-Goldens |
| Collaboration | spaeter CAS, sequenzierte Commits, Leases und semantischer Merge, kein allgemeines CRDT | `DEFERRED` | eigener spaeterer Spike |
| Settlement | eigene Authority fuer Strassen, Parcels, Rechte, Gebaeude, Services und Bauzustand | `REQUIRES_OWNER_DECISION` | G04-Goldens |
| Economy | G08 als einzige Economy-Authority | `PROPOSED_FOR_OWNER_ACCEPTANCE` | headless Reducer-/Auction-Spike |
| NPC/Society | persistente Identitaeten plus LOD-Ausfuehrung | `REQUIRES_SPIKE` | 128, 512, 2048 Browsergates |
| Mission/Narrative | getrennte Graphen, deterministischer Compiler | `REQUIRES_SPIKE` | Folgeprompt 08 |
| City Generation | semantischer Feature Graph, authored reservations, ein globaler PlanetEvent-Log | `REQUIRES_SPIKE` | Folgeprompts 09 und 10 |
| Content/Mods | data-only, immutable Versionen, Digests und Locks | `REQUIRES_OWNER_DECISION` | Folgeprompt 05 |
| AI Copilot | Proposal-only, Host Commit, Human Approval | `REQUIRES_OWNER_DECISION` | Sandbox-/Injection-/Approval-Evidence |
| Voxel-Integration | ausserhalb G18, WP04 bis ACCEPT plus ff-only blockiert | `BLOCKED` | separater Voxel-Lab-Prozess |

## 8. Prototype-Adoption

| Paket | Gesamtklasse | Belastbare Nutzung | Nicht uebernehmen |
|---|---|---|---|
| P01, SHA `615b0165b356060dd9ad9a6373682923b7be297c7cb7e606192076edcf5e7fd1` | `Adapt` | Preview-Validate-Commit-Fluss und Revisionsdarstellung als UX-Input | lokale Mock-Authority, flache Tests, AI-Attribution und fehlende CAS/Persistenz |
| P02, SHA `6dbf7636dc5153e66e960ab948149fe0fb503120717eae4c6a663330e8678eb7` | `Adapt` | kanonischer Compiler, Validatorideen und React-Flow-Projektion | gemischte Graph-Authority, lokale Effects; Quellcodeadoption bleibt wegen `UNLICENSED` blockiert |
| P03, SHA `af9cc7f65d1f781006a23ad75d83e358b5fca02c0923339df270aa8bd137eddb` | `Reference only` | Road-/Zone-/Parcel-/Building-Interaktionsidee und Findings | Placeholder-PNGs, unbelegte Build-/Sites-Claims, Provenienzabweichung |
| P04, SHA `60a309d9441b1c4fc8464f0e93ab5fd3a3cf9d5606d9e26c18d4c4943bd93152` | `Reference only` | gekoppelte 2D-/3D-Auswahlprojektion | trigonometrische Mockpropagation, Stub-Handoff und Meta-only-Test |
| P05, SHA `988257c9d9ad74e57b7c963387c695612ace099aa8e55ed82e0982ac6cc4cbb7` | `Adapt` | gestufter Vorschlag, Owner-Ack und Transaction-Review als UX-Input | hartcodierte Hashes, Validator-, Commit- und Undo-Ausgaenge |

Kein Gesamtpaket erhaelt `Preserve` oder `Discard`. Auf Komponentenebene koennen stabile visuelle Muster bewahrt und Mock-Authorities verworfen werden. Details und Lizenzgrenzen stehen in `PROTOTYPE_ADOPTION_MATRIX.md`.

## 9. Vertical-Slice-Reihenfolge

1. VS01 Crash Site: Orientierung, Sicherung, erste Verarbeitung, nachweisbare Ledgerfolge.
2. VS02 Wilderness Expedition: Route, Risiko, Transport und Rueckkehr.
3. VS03 First Contract Circuit: erste Stadt, Servicewiederherstellung, Mining-Guild-Trial und lokaler Handelskreislauf. Hier endet das MVP.
4. VS04 Surface Logistics: belastbare Transportkette und entfernte Infrastruktur.
5. VS05 Ship Project: Part Graph, Readiness, Ressourcen und Testflight Snapshot.
6. VS06 Orbital Economy: Start, Survey, Extraktion, Return und lokale Orbitalnachfrage.
7. VS07 Contested Route: Sensor Track, Authorization, Encounter und rechtlich-soziale Folge.
8. VS08 Two-System Network: zweite Systemauthority, Route und begrenztes interstellares Netz.

Jedes Slice hat messbare Entry-, Exit- und Stop-Gates in `VERTICAL_SLICE_ROADMAP.md`. Ein spaeteres Slice darf keinen fehlenden Kernvertrag des frueheren Slices verdecken.

## 10. Serielle Research-/Spike-/Implementation-Queue

| Nr. | Gate | Typ | Exit | Stop |
|---|---|---|---|---|
| 01 | Owner- und Quellen-Freeze | Review, kein Code | signiertes Decision Receipt | Quellenhash weicht ab oder Kern wird revidiert |
| 02 | X01 Contract Crosswalk | Spezifikation, kein Code | jede Mutation hat genau eine Authority | doppelte Root-Ownership |
| 03 | G03A Editor-Topologie | erster isolierter Write-Spike | gleiche Kern-Tests, ADR | Ort nicht isoliert oder Scope-Leak |
| 04 | Renderneutraler Command-Kern | headless Spike | CAS, Idempotenz, Undo und Receipts belegt | Canonicalization oder Unknown-Recovery unklar |
| 05 | Content Package Locks | Contract-Goldens | stabile Digests, Konfliktquarantaene | Last-wins oder Lock-Bypass |
| 06 | Validation und Quick Fix | headless Spike | reine Validatoren, stale-safe Quick Fix | Validator mutiert |
| 07 | Playwright Evidence | isolierter Browser-Spike | echter Clean-/Failure-Run, versiegeltes E2E Receipt | Sleeps, Mock-Commit oder fehlende Browser-ID |
| 08 | Mission Compiler | headless Domain-Spike | getrennte Graphen, deterministische Goldens | lokale Effect-Mutation oder Lizenzproblem |
| 09 | Settlement Contracts | Contract-Goldens | eine Authority, stabile Lineage und State-Transition | Economy- oder Eventlog-Doppelung |
| 10 | Road/Block/Parcel | isolierter Geometrie-Spike | deterministische 128x128-Goldens | Voxel-/NPC-/Economy-Scope-Leak |

Die vollstaendigen Copy-and-paste-Auftraege liegen im Ordner `prompts/`. Nach Gate 10 endet die Queue. Kein elfter Prompt und keine Produktintegration starten automatisch.

## 11. Kritische offene Ownerentscheidungen

Vor dem ersten Write-Spike muessen mindestens diese Punkte explizit entschieden werden:

1. Annahme oder Revision des gemeinsamen renderneutralen Command-/Transaction-/Receipt-Kerns.
2. Annahme von G03A-DR1 und des isolierten Spike-Orts samt Lizenz- und Archivierungsregel.
3. Authority-Namen, Persistenzroots und Receipt-Namensraum fuer X01.
4. Developer-App-Zielhypothese und Kriterien fuer `SEP-D` vs `OVR-D`.
5. Player-Builder-Allowlist und harte Trennung von Developer-Berechtigungen.
6. Settlement-zu-Economy-Grenze mit G08 als einziger Economy-Authority.
7. NPC-Populationsziel, Detailfenster und Browser-Abbruchbudget.
8. G13 Namespace-, Override-, Signing-, Lizenz- und Save-Support-Policy.
9. AI-Approval-Stufe, immer-menschliche Freigabe in V1 und geschuetzte Datenklassen.
10. Mod- und Prototype-Lizenzfreigabe, insbesondere P02 `UNLICENSED`.

Die vollstaendige, priorisierte Liste steht in `OPEN_OWNER_DECISIONS.md`.

## 12. Output-Index

### Kerndokumente

- `MASTER_GDD_V1.md`
- `AUTHORING_PLATFORM_ARCHITECTURE_V1.md`
- `EDITOR_COMMAND_CONTRACT_V1.md`
- `FEATURE_DEPENDENCY_GRAPH.md`
- `VERTICAL_SLICE_ROADMAP.md`
- `TOOL_DECISION_LOG.md`
- `PROTOTYPE_ADOPTION_MATRIX.md`
- `OPEN_OWNER_DECISIONS.md`
- `TECHNICAL_READINESS_CROSSWALK.md`

### Serielle Folgeprompts

- `prompts/01_OWNER_SOURCE_FREEZE_REVIEW_PROMPT.md`
- `prompts/02_CONTRACT_CROSSWALK_PROMPT.md`
- `prompts/03_G03A_EDITOR_TOPOLOGY_SPIKE_PROMPT.md`
- `prompts/04_RENDERNEUTRAL_COMMAND_KERNEL_SPIKE_PROMPT.md`
- `prompts/05_CONTENT_PACKAGE_LOCK_GOLDENS_PROMPT.md`
- `prompts/06_VALIDATION_ISSUE_QUICKFIX_SPIKE_PROMPT.md`
- `prompts/07_PLAYWRIGHT_E2E_EVIDENCE_SPIKE_PROMPT.md`
- `prompts/08_MISSION_COMPILER_VALIDATOR_SPIKE_PROMPT.md`
- `prompts/09_SETTLEMENT_AUTHORITY_CONTRACT_GOLDENS_PROMPT.md`
- `prompts/10_ROAD_BLOCK_PARCEL_GEOMETRY_SPIKE_PROMPT.md`

## 13. Spaeterer Copy-and-paste-Handoff

```text
Arbeite ausschliesslich nach 01_OWNER_SOURCE_FREEZE_REVIEW_PROMPT.md. Lies zuvor G18_MASTER_SYNTHESIS_REPORT_V1.md, OPEN_OWNER_DECISIONS.md und TECHNICAL_READINESS_CROSSWALK.md vollstaendig. Verifiziere die dort eingefrorenen Dateinamen und SHA-256-Werte von G03A und G04. Erzeuge nur den geforderten dokumentarischen Owner-Entscheidungsbeleg. Kein Code, kein Produktrepo, kein Voxel-Lab, kein Build, kein Test und keine WP04-Integration. Stoppe bei jeder Quellenabweichung oder fehlenden Ownerantwort. Starte keinen Folgeprompt automatisch.
```

## 14. Schlussstatus

`REQUIRES_OWNER_DECISION`

Begruendung: Die Synthese und die serielle Queue sind vollstaendig, aber Kern-Authority, Developer-Topologie, Player-Builder-Grenze, Content-/Mod-Policy, Populationbudgets und mehrere Domainvertraege brauchen explizite Ownerannahme. Technische Risiken sind als kleine isolierte Spikes abgegrenzt. G18 selbst endet hier ohne Implementierung.
