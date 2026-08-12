# WELTRAUM Tool Decision Log V1

**Stand:** 2026-08-12  
**Dokumentstatus:** `PROPOSED`  
**Zweck:** konsolidierte Werkzeug-, Plattform- und Prototypentscheidungen fuer die G18-Synthese  
**Evidence-Grenze:** Dieses Dokument wertet Research, Quellpakete und vorhandene Prototypartefakte aus. Es behauptet keine implementierte Produktfunktion, keinen ausgefuehrten Test und keinen bestandenen Benchmark.

## 1. Entscheidungslegende

| Status | Bedeutung |
|---|---|
| `BASELINE` | Bereits gesetzte Projektinvariante, die G18 nicht neu entscheidet |
| `PROPOSED` | Technisch begruendete Empfehlung, noch nicht vom Owner angenommen |
| `REQUIRES_OWNER_DECISION` | Vor dem genannten Write- oder Adoptionsgate ist eine explizite Ownerentscheidung erforderlich |
| `REQUIRES_SPIKE` | Entscheidung darf erst nach einem isolierten, vorab definierten Spike fallen |
| `REFERENCE_ONLY` | Darf als Research- oder UX-Referenz dienen, aber keine Produktabhaengigkeit oder Authority bilden |
| `REJECTED` | Fuer den beschriebenen Produktpfad ausgeschlossen |
| `DEFERRED` | Bewusst in ein spaeteres Gate verschoben |

## 2. Aktuelle Identitaeten und Freeze-Grenzen

| Bereich | Aktuelle Identitaet | Status | Konsequenz |
|---|---|---|---|
| G03 | `G03A_owner_freeze_command_receipt_rfc_spike1_plan_2026-08-12.md`, SHA-256 `052b292977229abfec977ac4a2ac6341b3a8e1aabbca7bee5400ea5c4a79f5da` | aktive Datei durch Launch-Addendum final bestaetigt; interner Workflow `REQUIRES_OWNER_DECISION` | G03A ist der aktive G03-Folgeeingang und friert die Charter fuer einen isolierten Spike 1 ein. Der referenzierte Basis-Bake-off lag nicht separat vor und wird nicht rekonstruiert. Die Quellenfinalitaet entscheidet weder Produktarchitektur noch Editor-Topologie. |
| G03 technische Referenz | `BenjaminHornung/hestia-voxel-kernel-lab@d95992df05952ac4be6221ca1809c1c9e3c0ac9d` | Referenz-SHA | Darf als gefrorene Forschungsreferenz verwendet werden. Daraus folgt kein Recht, unlizenzierte Labquellen in das Produkt zu kopieren. |
| G04 | `G04_settlement_city_builder_system_abschlussbericht_2026-08-12(1).md`, SHA-256 `cdb98f5404028b23f2c907fee3d4679bfb084a4dd05cee2eb72e72c1cd1efb54` | aktive Datei durch Launch-Addendum final bestaetigt; Bericht `COMPLETED`, Workflow `REQUIRES_OWNER_DECISION`, Projektentscheidung `PROPOSED` | Die semantische Settlement-Architektur ist entscheidungsreif. Implementierung und Road-/Parcel-Spike bleiben bis zu den Ownerentscheidungen gesperrt. |
| G04 Produkt-Audit | historischer SHA `15f3550bd604856b25d40a7ac700ec4d5106b89e` | vor Integration veraltet | Vor jeder Produktintegration muss der aktuelle Produkt-SHA read-only neu ermittelt werden. |
| WP04 | paralleler, lokaler Write-Pfad | aktuelle Branch- und Commitidentitaet `UNKNOWN` | WP04 darf nicht inspiziert, veraendert, vorausgesetzt oder durch Prototypcode vorweggenommen werden. Das vorhandene Reviewprotokoll ist kein Urteil ueber einen tatsaechlichen WP04-Stand. |

## 3. Konsolidierte Entscheidungen

| ID | Thema | Entscheidung | Status | Begruendung und naechstes Gate |
|---|---|---|---|---|
| `TD-001` | Domain Authority | Kanonischer Welt- und Authoringzustand bleibt CPU-seitig und renderneutral. Renderer, DOM, Graphcanvas, Three-Objekte, Auswahl, Kamera und Layout sind Projektionen oder Sessionzustand. | `BASELINE` | Entspricht der Browser-/Chromium-first-Basis und verhindert eine zweite World Truth. |
| `TD-002` | Gemeinsamer Command-Kern | Developer Authoring und spaeteres Player Construction sollen denselben renderneutralen Command-, Transaction-, Validation-, Approval- und Receipt-Kern verwenden. Rechte und erlaubte Commandmengen unterscheiden sich durch Policy, nicht durch getrennte Wahrheiten. | `REQUIRES_OWNER_DECISION` | G03A und G04 konvergieren auf diesen Kern. Vor Produkt-RFC ist die Ownerentscheidung `OOD-002` und danach X01 erforderlich. |
| `TD-003` | Write-Eingang | Ein vertrauenswuerdiges Authoring Gateway beziehungsweise ein domain-eigener Commit Coordinator bleibt der einzige Mutationsweg. UI, Renderer, AI und importierte Assets erzeugen nur Drafts oder Commands. | `PROPOSED` | P01 und P05 zeigen die UX-Idee, aber keine Sicherheitsgrenze. Produktannahme gemeinsam mit `TD-002`. |
| `TD-004` | Editor-Topologie | Separate Browser-Shell und In-Runtime-Overlay bleiben offene Alternativen. Keine Variante wird vor dem G03-Spike als Produktarchitektur markiert. | `REQUIRES_SPIKE` | G03A Spike 1 vergleicht `SEP-D` und `OVR-D` mit identischer Authority, Bridge und Dockingkomponente. Die Topologie-ADR folgt erst aus Gate 1. |
| `TD-005` | Docking | `dockview-core@8.0.0` ist ausschliesslich die vorgeschlagene, gepinnte Dockingkomponente fuer G03A Spike 1. | `REQUIRES_OWNER_DECISION` | Kein React im Spike und nur eine veraenderte Versuchsachse. Keine Produktadoption ohne Spikeergebnis, Lizenzaufnahme und ADR. |
| `TD-006` | Renderer | Three.js `0.185.1` bleibt Referenzpfad fuer G03A Spike 1. Der finale Renderer- und Engineentscheid bleibt WP12. | `BASELINE` fuer Referenz, `DEFERRED` fuer Produktentscheidung | P01, P03 und P04 liefern keine Renderer-Bake-off-Evidence. P04 ist eine SVG-Praesentation. |
| `TD-007` | React und Sites-Scaffold | React, Next, Vinext, Cloudflare, Drizzle und Sites-Scaffolding aus P03 bis P05 werden nicht als Produkt-Toolentscheidung gewertet. | `REJECTED` als Schlussfolgerung aus Prototypen | Die Pakete dienen dem isolierten Prototyp-Hosting. Sie pruefen weder Produktarchitektur noch Bundle-, Runtime- oder Integrationsanforderungen. |
| `TD-008` | Mission-Graph-UI | React Flow 12.11.3 aus P02 darf als MIT-lizenzierter Projektionskandidat fuer einen spaeteren G05-Graphspike dienen. Es wird weder Graph-Authority noch bereits akzeptierte Produktabhaengigkeit. | `REQUIRES_SPIKE` | Vorher muessen Story-, Mission- und Dialogue-Vertraege, Condition-AST, Text-IDs und Effect-Gateway akzeptiert sein. |
| `TD-009` | Headless Graph-Kern | Deterministischer, headless Compiler, Validator und Simulator werden als Muster adaptiert. Authoringlayout und Runtimeartefakt bleiben getrennt. | `PROPOSED` | P02 besitzt hier die staerkste Spike-Evidence, sein konkretes Mischgraphmodell wird jedoch nicht uebernommen. |
| `TD-010` | AI-Berechtigung | AI bleibt in V1 auf Read, Propose, Preview und Stage begrenzt. AI darf nicht validieren, approven, committen, publishen oder History umschreiben. | `BASELINE` fuer Autonomiegrenze, Produktvertrag noch `PROPOSED` | P01 trennt den sichtbaren Workflow, vermischt aber Proposal-Origin und Commit-Actor. P05 simuliert nur UI-Gates. G11 und der gemeinsame Kern muessen die echte Grenze erzwingen. |
| `TD-011` | Provenienzrollen | `proposedBy`, `validatedBy`, `approvedBy` und `committedBy` muessen getrennt gespeichert werden. Ein AI-originierter Vorschlag darf nie als AI-Commit erscheinen. | `PROPOSED` | Korrigiert den P01-Widerspruch, bei dem `Copilot · mock` als Actor eines committed History-Eintrags erscheint. |
| `TD-012` | Undo und Redo | Nach Commit werden Undo und Redo als neue, vorwaertslaufende, CAS-gepruefte Transactions mit Receipt modelliert. Revisionen werden nicht zurueckgedreht. | `PROPOSED` | P01 vermittelt monotone Revisionen. P03 nutzt nur Snapshots. P05 zeigt ein ungeeignetes `restoreSnapshot`-Mock. G03A spezifiziert den belastbareren Inversionsplan. |
| `TD-013` | Persistenz | IndexedDB ist fuer G03A Spike 1 als atomarer lokaler Store fuer State, Receipts, History, Idempotenz und Outbox vorgeschlagen. Das ist keine allgemeine Produktpersistenzentscheidung. | `REQUIRES_OWNER_DECISION` fuer Spike, `DEFERRED` fuer Produkt | Produkt-Saves folgen G13 und den jeweiligen Domainbarrieren. P01, P02, P03 und P04 liefern keine Produktpersistenz. |
| `TD-014` | Settlement-Geometrie | P03-Polyline, Offset-Lots, radiale Coverage und analytische Neigung werden nicht als Road-, Parcel-, Terrain- oder Serviceauthority uebernommen. | `REJECTED` | G04 verlangt RoadGraph, grade-aware Crossings, MultiPolygon/holes, Frontage, Parcel-Lineage, revisionsgebundene Terraincoverage und einen isolierten Spike. |
| `TD-015` | Systemkarte | P04-Orbits, Route, ETA, Fuel, Delta-v und Risiko bleiben Mockdarstellung. Die gemeinsame 2D/3D-Auswahl- und Handoff-UX darf nur als Referenz dienen. | `REFERENCE_ONLY` | Physik und fachliche Kartenwahrheit muessen aus `CelestialSystemDocumentV1`, benannten Frames und read-only Navigationsprodukten stammen. |
| `TD-016` | Player versus Developer UI | Developer Authoring App und Player Construction Workspace bleiben getrennte Oberflaechen und Berechtigungsprofile. Gemeinsame Vertraege bedeuten keine identischen Werkzeuge oder sichtbaren Commands. | `PROPOSED` | Verhindert, dass P01 oder P03 versehentlich als Player Builder interpretiert werden. |
| `TD-017` | QA und Playwright | Vorhandene Screenshot-, Test- und Dist-Artefakte sind Prototyp-Evidence. Produktabnahme erfordert G17-konforme, reproduzierbare Contract-, Browser-, Accessibility- und Evidence-Gates auf gefrorener Identitaet. | `PROPOSED` | In diesem Audit wurden keine Tests ausgefuehrt. P03 besitzt nur Placeholderbilder, P05 keine Bilddateien. |
| `TD-018` | Lizenz und Quelladoption | Kein Prototypquellcode wird vor P06, Lizenzklaerung, Provenienzaufnahme und X01 in ein Produktrepository kopiert. | `BASELINE` fuer Lizenzgrenze | P01, P03, P04 und P05 besitzen keine eigene Lizenzangabe. P02 ist `UNLICENSED`, dokumentiert aber seine Drittkomponenten. |
| `TD-019` | Intake und Crosswalk | P06 Intake Audit und X01 Contract Crosswalk liegen nicht vor. Sie blockieren die G18-Synthese nicht, aber jede Quelladoption beziehungsweise normative Felduebernahme. | `REQUIRES_OWNER_DECISION` fuer Terminierung | P06 klaert Artefaktintegritaet, Lizenz, Herkunft und Adoptionsscope. X01 ordnet Prototypfelder den akzeptierten G02/G03/G04/G05/G10/G11/G13-Vertraegen zu. |
| `TD-020` | WP04-Isolation | Kein G03-/G04-Spike, kein Prototyp und keine G18-Roadmap darf den parallelen WP04-Write-Pfad beruehren oder uncommittete Zwischenstaende annehmen. | `BASELINE` | WP04 bleibt bis zum tatsaechlichen Branchreview `UNKNOWN`. Produktintegration ist zudem vor WP12 gesperrt. |

## 4. Prototypklassifikation auf Paketebene

| Paket | Klassifikation | Kurzentscheidung |
|---|---|---|
| P01 Editor Shell | `Adapt` | Preview-, Validation-, Commit- und Issue-UX in den gemeinsamen Kern uebersetzen, nicht den monolithischen Mockcode uebernehmen. |
| P02 Mission Graph | `Adapt` | Headless-Diagnostik und Compile-Trennung adaptieren, konkreten Graphvertrag und lokale Effekte ersetzen. |
| P03 Settlement Editor | `Reference only` | Findings und offene Contractfragen konsultieren, Mockgeometrie und Sites-Code nicht als Implementierungsbasis verwenden. |
| P04 Star System Map | `Reference only` | Darstellungs- und Handoffmuster konsultieren, keine Physik- oder Kartenvertraege ableiten. |
| P05 AI Transaction UX | `Adapt` | Transaktionsstufen und sichtbare Bindungen in den echten Host-Commitpfad uebersetzen, die fest codierte Demo verwerfen. |

## 5. Serielle Tool-Gates

1. Owner entscheidet `OOD-002` zum gemeinsamen renderneutralen Kern.
2. Owner akzeptiert oder verwirft `G03A-DR1` mit exaktem Dokument-SHA.
3. P06 wird vor jeder Quelladoption erstellt. X01 wird vor jeder normativen Prototypfelduebernahme erstellt.
4. G03A Spike 1 laeuft isoliert und ohne Zugriff auf Produktrepositorys oder WP04.
5. Erst nach Gate 1 entsteht eine Topologie-ADR.
6. G04 Ownerfragen und Authoritygrenzen werden entschieden.
7. Erst danach darf der isolierte Road-/Parcel-Spike autorisiert werden.
8. Produktintegration bleibt bis WP12 und einer ausdruecklichen Integrationsentscheidung gesperrt.

## 6. No-Go-Liste

- keine UI- oder Rendererinstanz als Domain Authority;
- kein AI-Autocommit und keine UI-only Sicherheitsgrenze;
- keine direkte Uebernahme des P02-Mischgraphvertrags;
- keine Uebernahme der P03-Parcel- oder Coverage-Algorithmen;
- keine Interpretation der P04-Mockwerte als Navigation oder Physik;
- keine Interpretation des P05-React-State als Transaktionsengine;
- keine Produktentscheidung aus einem Prototyp-Screenshot;
- kein Codecopy aus unlizenzierter oder ungeklaerter Quelle;
- kein Zugriff auf den parallelen WP04-Write-Pfad;
- kein Performanceurteil aus diagnostischen oder nicht reproduzierten Werten.
