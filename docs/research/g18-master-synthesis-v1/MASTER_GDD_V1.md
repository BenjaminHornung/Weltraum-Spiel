# WELTRAUM Master GDD V1

## Dokumentstatus

| Feld | Wert |
|---|---|
| Dokument | `MASTER_GDD_V1.md` |
| Stand | 2026-08-12 |
| Zweck | Systemische Produktsynthese aus G01 bis G17 und den geprüften Research-Baselines |
| Synthesestatus | `REQUIRES_OWNER_DECISION` |
| Implementierungsstatus | Keine Implementierungsfreigabe |
| Produktintegration | Vor WP12 und ausdrücklicher Integrationsentscheidung gesperrt |
| WP04 | `BLOCKED`, bis ein Abschlussbericht `ACCEPT` ausweist und ein autorisierter `--ff-only`-Integrationsschritt erfolgt |

Dieses Dokument ist eine Design- und Architekturgrundlage. Es behauptet weder implementierte Features noch bestandene Tests, Benchmarks oder Produktintegration. Prototypen gelten ausschließlich als UX- und Contract-Evidence.

## 1. Quellenlage und Evidenzgrenze

### 1.1 Status der Domänenberichte

| Domäne | Verwendeter Stand | Einordnung für diese Synthese |
|---|---|---|
| G01 Produktvision und Core Loop | `REQUIRES_OWNER_DECISION` | tragfähige Produktthese und Slice-Reihenfolge, Zeitziele offen |
| G02 Authoring Platform | `REQUIRES_OWNER_DECISION` | maßgebliche Trennung von Developer Authoring und Player Construction |
| G03 Editor-/Tool-Bake-off | Basis-Abschlussbericht nicht beigefügt | formale Evidence-Lücke |
| G03A | `G03A_owner_freeze_command_receipt_rfc_spike1_plan_2026-08-12.md`, SHA-256 `052b292977229abfec977ac4a2ac6341b3a8e1aabbca7bee5400ea5c4a79f5da`, `REQUIRES_OWNER_DECISION` | Addendum und isolierte Spike-Charter, kein Ersatz für den G03-Bake-off |
| G04 Settlement-/City-Builder | `G04_settlement_city_builder_system_abschlussbericht_2026-08-12(1).md`, SHA-256 `cdb98f5404028b23f2c907fee3d4679bfb084a4dd05cee2eb72e72c1cd1efb54`; Bericht `COMPLETED`, Projekt `PROPOSED`, Workflow `REQUIRES_OWNER_DECISION` | systemisch nutzbar, Road-/Parcel-Spike und Ownerentscheidungen bleiben offen |
| G05 Narrative/Mission | `REQUIRES_SPIKE` | Contract-Richtung nutzbar, Toolwahl und Integration offen |
| G06 NPC und Gesellschaft | `READY_FOR_SYNTHESIS` | maßgeblich für persistente Identitäten und Simulations-LOD |
| G07 Organisationen, Recht und Diplomatie | `REQUIRES_OWNER_DECISION` | Domänengrenzen nutzbar, politische Tiefe offen |
| G08 Economy und Logistik | `READY_FOR_SYNTHESIS` | maßgebliche wirtschaftliche Authority und Slice-Verträge |
| G09 Ship/Vehicle Builder | `REQUIRES_OWNER_DECISION`, Physics-Adapter `REQUIRES_SPIKE` | Buildergraph und Projektionen nutzbar, Frames und Integrationsdetails offen |
| G10 Star System Map | `READY_FOR_SYNTHESIS` | maßgebliche Systemdokument- und Kartenrichtung |
| G11 AI Copilot | `READY_FOR_SYNTHESIS` | maßgebliche Sicherheits- und Approvalgrenze |
| G12 Asset-Voxelization | `REQUIRES_SPIKE` | HVOX-Pipeline und Auflösungsnorm nutzbar, Voxelizer muss belegt werden |
| G13 Content, Modding und Saves | `REQUIRES_OWNER_DECISION`, mehrere Teilspikes nötig | maßgebliche Paket-, Lock-, Hot-Reload- und Savegrenze |
| G14 UX, Modus und Input | `REQUIRES_OWNER_DECISION` | maßgebliche orthogonale Modus- und Target-Referenzrichtung |
| G15 Combat, Mining und Drones | konservativ `REQUIRES_OWNER_DECISION` | gemeinsame Operations-Pipeline nutzbar, zwei Berichtsvarianten nicht doppelt gewichtet |
| G16 Prozedurale Stadtgenerierung | `REQUIRES_SPIKE` | Pipeline- und Contract-Richtung nutzbar, keine Generatorreife behauptet |
| G17 Editor QA und Automation | `REQUIRES_OWNER_DECISION` | maßgeblich für Validation, Issues, E2E und Evidence |

### 1.2 Quellenpriorität

Separate Dateien mit den exakten Namen `WELTRAUM_RESEARCH_SYNTHESIS_2026-08-12.md`, `WELTRAUM_RESEARCH_DECISION_LOG_2026-08-12.md` und `WELTRAUM_GAMEPLAY_EDITOR_VISION_ADDENDUM_2026-08-12.md` lagen nicht vor. Sie werden weder als gelesen behandelt noch inhaltlich rekonstruiert.

Bei Widerspruch gilt folgende Reihenfolge:

1. akzeptierte Projektentscheidungen und Launch-Addenda;
2. bereitgestellte Projekt-Memory und Integration Boundaries sowie nur tatsächlich vorliegende, akzeptierte Decision Logs;
3. Abschlussberichte mit klarer Authority- und Evidenztrennung;
4. Spike-Pläne und Prototypen;
5. externe Referenzen nur als Studien- oder Lizenzquelle.

Ein `READY_FOR_SYNTHESIS` ist keine Implementierungsfreigabe. Ein Prototyp ist keine Produktfunktion.

## 2. Produktthese

WELTRAUM ist ein browserbasiertes, systemisches Weltraumspiel, in dem ein gestrandeter Mensch durch dieselben nachvollziehbaren Kausalketten vom Überleben auf einer Planetenoberfläche bis zum Aufbau eines interstellaren Netzwerks wächst.

Der Spieler gewinnt Reichweite nicht durch abstrakte Freischaltungen allein, sondern durch:

- physische Handlungsfähigkeit;
- Wissen, Survey und Planung;
- Material, Energie und Produktionskapazität;
- Transport, Lager und Wartung;
- Rechte, Beziehungen und gesellschaftliche Verlässlichkeit;
- robuste Schiffe, Infrastruktur und Organisation.

Die zentrale Fantasie lautet:

> Aus begrenzten lokalen Mitteln wird durch Verständnis, Bau, Logistik und soziale Einbettung eine selbst gewählte, dauerhaft wirksame Präsenz im Weltraum.

## 3. Designpfeiler

### 3.1 Physische Agency

Die Welt reagiert auf Material, Masse, Struktur, Energie, Schaden, Transport und Reparatur. Renderer und Effekte dürfen keine Fähigkeiten vortäuschen, die der Domainzustand nicht besitzt.

### 3.2 Earned Reach

Jede neue räumliche Stufe benötigt reale Voraussetzungen. Oberfläche, Stadt, Orbit und Systemnetz werden seriell erschlossen. Reichweite ohne Infrastruktur, Treibstoff, Wartung, Rechte oder Information ist nicht verfügbar.

### 3.3 Logistik und Engineering

Gewinnung, Verarbeitung, Lagerung, Transport, Konstruktion und Reparatur bilden einen zusammenhängenden Kreislauf. Automation beseitigt wiederholte Bedienung, aber nicht Kosten, Risiko oder Verantwortung.

### 3.4 Belonging, Rights and Consequence

Personen, Organisationen, Jurisdiktionen, Verträge und Reputation beeinflussen Zugang und Handlungsmöglichkeiten. Weltwahrheit, beobachtete Evidenz und gesellschaftliche Bewertung bleiben getrennt.

### 3.5 Persistent Self-Chosen Story

Story entsteht aus authored Inhalten, systemischen Verträgen und dauerhaften Konsequenzen. Dynamik erweitert authored Ziele, ersetzt aber weder Narrative Authority noch menschlich freigegebene Inhalte.

## 4. Gemeinsamer Core Loop

Jede Entwicklungsstufe verwendet dieselbe Grundfolge:

1. **Verstehen:** Umgebung, Bedarf, Risiko, Rechte und Möglichkeiten erfassen.
2. **Sichern:** Zugang, Schutz, Claim, Vertrag, Budget oder Infrastruktur herstellen.
3. **Verarbeiten oder konfigurieren:** Material, Werkzeug, Drohne, Anlage oder Schiff vorbereiten.
4. **Transportieren oder einsetzen:** Güter, Energie, Personen oder Fähigkeiten an den benötigten Ort bringen.
5. **Ziel oder Vertrag erfüllen:** eine überprüfbare Zustandsänderung erzeugen.
6. **Folge tragen:** materielle, wirtschaftliche, rechtliche, soziale und narrative Konsequenzen übernehmen.

Die dazugehörigen gemeinsamen Ledgers sind:

- Material und Cargo;
- Energie und Kapazität;
- Wissen und Survey;
- Rechte und Verpflichtungen;
- Beziehungen und Reputation;
- Welt-, Content- und Ereigniszustand.

## 5. Nicht verhandelbare Systeminvarianten

1. Browser und Chromium bleiben der primäre Zielpfad.
2. CPU-seitiger, renderneutraler Domainzustand ist Authority.
3. Mesh, GLB, Collider, Navmesh, Karten, Heatmaps und UI sind Ableitungen.
4. Welt-, Content-, Economy-, Settlement-, NPC- und Narrative-Authorities besitzen eindeutige Zustandsgrenzen.
5. Alle Mutationen laufen durch versionierte Commands, Validation, Policy und atomare Commitgrenzen.
6. Retry, Reload, Workerreihenfolge, Kameradistanz und Render-LOD dürfen keine Doppelmutation oder fachliche Ergebnisänderung erzeugen.
7. Persistenz bindet exakte Content-, Generator-, Schema- und Eventversionen. Keine stille Neuinterpretation alter Saves.
8. AI darf lesen, vorschlagen, dry-runnen und stage-en. AI darf in V1 weder committen noch veröffentlichen.
9. Player Construction und Developer Authoring teilen Verträge und Validatoren, aber keine uneingeschränkte Oberfläche oder Capability.
10. Kein Produktfeature übernimmt ungeklärten, nichtkommerziellen, Copyleft-inkompatiblen oder unlizenzierten Code.
11. Kein Performanceclaim ohne BR01-/BR02-konformen Messvertrag, Rohdaten und vollständige Provenienz.
12. WP04 ist keine technische Wahrheit, bis `ACCEPT` und ein autorisierter `--ff-only`-Integrationsschritt dokumentiert sind.

## 6. Welt- und Technologiegrundlage

### 6.1 Voxelwelt

- harte quadratische Voxel im Nahfeld;
- globale Terrainchunks und objektlokale Voxelvolumen für separat bewegliche oder zerstörbare Objekte;
- konservative Connectivity mit `Unknown` oder `Pending`, wenn Analysegrenzen erreicht sind;
- Chunk-, Feature- und Objektidentitäten bleiben stabil und werden nicht aus Rendergeometrie abgeleitet;
- Weltgenerierung beginnt mit Feature- und Constraint-Graph, Hydrologie und lokalen 3D-Strukturen, erst danach erfolgt harte Voxelmaterialisierung;
- Cube-Sphere-Quadtree plus radial sparse Bricks ist die planetare Skalierungsrichtung;
- Simulations-LOD und Render-LOD bleiben getrennt.

### 6.2 Asset-Authority

Die native Authoringquelle wird über einen deterministischen Compiler in `HVOX` plus `asset.hestia.json` überführt. HVOX ist die voxelbezogene Asset-Authority. GLB bleibt Preview- und Austauschprojektion.

V1 verwendet 0,25 m als normative authored Voxelauflösung. 0,125 m bleibt auf lokale Hero-Asset- und Forschungsfälle beschränkt. Der funktionale Ship-Builder darf unabhängig davon ein 0,5-m-Raster besitzen.

### 6.3 Engine und Darstellung

Three.js/WebGPU bleibt der aktuelle Produktreferenzpfad. Die endgültige Engine- und Rendererentscheidung bleibt WP12 vorbehalten. Raw WebGPU und Three WebGPU/TSL werden nur in kontrollierten Spikes verglichen.

## 7. Gesellschaft, Narrative und Recht

### 7.1 Persistente Personen

Alle 2.048 vorgeschlagenen Einwohner der First City besitzen persistente Identität. Ausführungs-LOD reduziert Verhalten, Planung und Darstellung, nicht Existenz oder Historie.

Die Ebenen sind:

- `FULL` für unmittelbar relevante Personen;
- `REDUCED` für lokale, aber nicht fokussierte Personen;
- `COHORT` für gebündelte Ausführung mit stabilen Mitgliedsreferenzen;
- `AGGREGATE` für gesellschaftliche und wirtschaftliche Summaries ohne Identitätsverlust.

Verhalten kombiniert verständliche Zustandsmodi, Utility-Zielwahl, begrenzte Planung und ausführende Behaviour Trees.

### 7.2 Organisation und Recht

Settlement, Organisation und Jurisdiktion sind verschiedene Dinge:

- Settlement beschreibt Ort und Infrastruktur;
- Organisation beschreibt Mitgliedschaft, Rollen und Ziele;
- Territory und Jurisdiction beschreiben räumliche Rechtswirkung;
- Eigentum, Kontrolle, Betrieb, Capability, Verpflichtung und Lizenz bleiben getrennt.

Recht folgt einer nachvollziehbaren Kette aus Handlung, Entdeckung, Evidenz, Charge, Case, Urteil und Sanktion. Diplomatie ist ein Zustands- und Vertragsmodell, kein einzelner Hostility-Wert.

### 7.3 Narrative Authority

StoryGraph, MissionGraph und DialogueGraph bleiben getrennte, versionierte Domänen mit gemeinsamen Conditions und Effects. Narrative Effects mutieren die Welt nie direkt. Sie beantragen Commands über das Authoring beziehungsweise Runtime Gateway und erhalten Receipts.

Dynamische Missionen stammen aus deterministischen Templates, echten Bedarfen, Verträgen oder Weltzuständen. Ein Runtime-LLM erzeugt in V1 keine Mission Authority.

## 8. Settlement, Stadt und Wirtschaft

### 8.1 Settlement Authority

Settlement besitzt die Semantik von Straßen, Parzellen, Frontage, Rechten, Gebäuden, Diensten, Populationseinbindung, Bau und Reparatur. Terrain- und Voxelzustand bleiben bei der World Authority.

Roads sind stabile Graphfeatures mit Referenzlinie, Höhenprofil, Querschnitt, Wegerecht und explizitem Cut-/Fill-/Structure-Plan. Parcels entstehen deterministisch aus grade-aware Blocks, besitzen Frontage und erhalten Split-/Merge-/Reshape-Lineage.

### 8.2 Stadtumfang

Der erste aktive Detailbereich umfasst 128 x 128 m und etwa 80 bis 250 Einwohner im aktuellen operativen Fenster. Die vollständige First City kann 2.048 persistente Personen umfassen, deren Ausführung außerhalb des Detailfensters auf reduziertem LOD läuft.

Das Detailfenster beweist:

- Road und Frontage;
- direkte Gebäudeplatzierung;
- Strom, Wasser und Zugang;
- Bau, Schaden und Reparatur;
- Haushalts-, Job- und Servicewirkung;
- einen realen externen Handelsanschluss.

### 8.3 Economy Authority

G08 besitzt die wirtschaftliche Wahrheit. G04 hält keine parallelen Geld-, Cargo- oder Produktionsledgers.

Die Economy Authority besitzt:

- Resource Registry, Cargo Lots und serialized Assets;
- Eigentum, beneficial Ownership, Custody, Location und Reservation;
- Double-Entry-Konten, Escrow, Kredit und explizite Sources/Sinks;
- Facilities, Recipes, Jobs, Energie-, Arbeits-, Wartungs- und Abfallflüsse;
- lokale Call-Auktionen, Verträge, Shipments, Routen und Versicherungen;
- Deposits, Survey, Claims und Depletion;
- versionierte Jurisdiction-Policies als G07-Integration.

Ein Systemindex vermittelt Information und Verträge, hält aber keinen globalen Warenpool. Cargo bewegt sich nur durch reale Assets, Lager, Handling, Energie und Reisezeit.

## 9. Schiffe, Raumkarte und Operations

### 9.1 Ship und Vehicle Builder

Der Buildergraph ist funktionale Build-Authority. Physik, Rendering und spätere lokale Voxelvolumen sind Projektionen. Part, Socket, Connection, Interface, Masse, Schwerpunkt, Trägheit, Wrench, Fuel, Power, Thermal und Readiness werden versioniert abgeleitet oder geprüft.

Partgraph und HVOX dürfen nie gleichzeitig strukturelle Authority für denselben Sachverhalt sein. Ein expliziter Frameadapter löst den noch offenen Konflikt zwischen Builder- und Flight-Achsen.

### 9.2 Celestial System

`CelestialSystemDocumentV1` ist Authority für Körper, Frames, State Vector am Epoch und Systemzeit. Orbital Elements sind Eingabe- und Diagnoseform, nicht alleinige Wahrheit. V1 verwendet zunächst einen analytischen Two-Body-Propagator nach mathematischem Spike.

True-distance 3D, Local-orbit 2D und schematische Netzwerkansicht sind verschiedene Projektionen desselben Systemdokuments.

### 9.3 Operations

Combat, Mining und Drones teilen die Prozessform:

`Observation -> Track -> Authorization -> Action -> Receipt -> Ledger`

G15 besitzt Sensortracks, Rules of Engagement, aktive Steuerung und physische Operationsausführung. G08 besitzt Deposit, Depletion, Cargo und wirtschaftliche Buchung. Physisch bestätigte Extraktion erzeugt genau ein idempotentes Economy-Ereignis.

V1 beginnt mit projectile-basiertem Combat, logischem Schaden und beaufsichtigten unbewaffneten Mining-Drohnen. Voxel Structural Damage folgt erst nach eigenem Gate.

## 10. Authoring, Content und Qualität

### 10.1 Developer Authoring und Player Construction

Es existieren zwei Produktebenen:

- **Developer Authoring App oder Developer Bundle:** volle Diagnose, Content, World, Mission, Economy und Systemwerkzeuge mit expliziten Overrides und Audit.
- **Player Construction Workspace:** enge, spielökonomisch und rechtlich beschränkte Bauoperationen innerhalb der Runtime.

Beide verwenden denselben renderneutralen Command-, Transaction-, Receipt- und Validation-Kern. Sie verwenden getrennte Oberflächen, Capability-Profile und Gateways.

### 10.2 Content Packages

Content ist deklarativ und engine-neutral. V1-Pakete enthalten Daten, HVOX und binäre Payloads, aber keinen JS-, TS-, HTML-, WGSL-, Wasm- oder nativen Code.

Veröffentlichte Paketversionen sind immutable. Runtime und Saves binden:

- `packageDigest` und `authorityDigest`;
- `contentLockDigest` und `authorityLockDigest`;
- `simulationContractDigest`;
- Generator-, Material-, Schema- und Eventversionen.

Hot Reload baut ein vollständiges Kandidaten-Loadset und adoptiert es atomar. Simulationsrelevante Änderungen sind in der Regel `restart-required` oder `migration-required`.

### 10.3 Validation und Issues

Validatoren lesen immutable Snapshots, mutieren nicht und verwerfen stale Resultate. Issues besitzen stabile fachliche Identität, konkrete Occurrences, Severity, Blocking Scopes und auditierbare Suppression.

Quick Fixes laufen als normale Preview- und Transactionpfade. Auto-Anwendung bleibt in V1 deaktiviert.

Playwright bedient die echte UI. Der Testbuild darf nur allowlistete Bootstrap-Fixtures und Capture-Presets wählen. Es gibt keinen allgemeinen Test-Mutator. Semantische Oracles gehen Screenshots voraus.

## 11. Explizite Auflösung der elf G18-Konflikte

| Nr. | Konflikt | Entscheidung V1 | Verbleibendes Gate |
|---:|---|---|---|
| 1 | Developer Editor versus Player Builder | Zwei getrennte Oberflächen und Capability-Profile, ein gemeinsamer renderneutraler Contract-, Command-, Transaction-, Receipt- und Validation-Kern | konkrete Player-Allowlist und Developer-Override-Policy |
| 2 | In-runtime versus separate Browser-App | Developer Authoring bevorzugt als separate Browser-App oder getrenntes Developer-Bundle; Player Construction bleibt in der Runtime. G03A Spike 1 vergleicht `SEP-D` und `OVR-D`, ohne die Produktentscheidung vorwegzunehmen | G03A-DR1, Gate-1-ADR und dokumentierter Umgang mit der nicht separat vorliegenden Basis-Bake-off-Evidence |
| 3 | Simulation depth versus scope | Tiefe Contracts und Conservation-Invarianten werden früh gebaut, aktive Simulation bleibt pro Slice klein. LOD reduziert Ausführung, nicht fachliche Wahrheit | Browserbudgets und Slice-Kappen |
| 4 | Individual NPCs versus cohorts | Persistente Personen sind Authority. Haushalte und Cohorts sind verlustfreie Ausführungs- und Wirtschaftsindizes mit stabilen Mitgliedsreferenzen | G06- und G08-Adaptervertrag |
| 5 | Dynamic economy versus authored progression | Economy reagiert systemisch auf reale Bestände, Orders und Schäden. Progression, Starterhilfe, Verträge, Budgets und Recovery sind authored Guardrails | Economy-Balancing und Härtegrad |
| 6 | Story graph versus dynamic mission generation | Story, Mission und Dialogue bleiben authored, versionierte Graphen. Dynamische Missionen sind deterministische Templates über echte Bedürfnisse und Receipts | G05 Simulator- und Integration-Spike |
| 7 | Custom editor versus PlayCanvas, Blender und externe Tools | Eigener headless Contract- und Authoring-Kern. Blender bleibt upstream DCC für Assets. PlayCanvas, Babylon, Three Editor und andere Tools sind Study- oder UX-Referenzen, keine Authority | G03A-Tool-ADR und dokumentierte Evidence-Luecke des nicht separat vorliegenden Basis-Bake-offs |
| 8 | 0,25 m versus 0,125 m authored assets | 0,25 m ist die normative V1-Assetauflösung. 0,125 m bleibt lokaler Hero-Research-Pilot. Ship-Builder-Raster 0,5 m ist ein separater funktionaler Vertrag | G12 Asset-Pilot und WP12 |
| 9 | Surface, City und Space Feature Order | Crash Site -> Wilderness -> First City Contract -> Surface Logistics -> Ship Project -> Orbital Economy -> Contested Route -> Two-System Network | serielle Slice-Gates |
| 10 | AI autonomy versus approval | AI darf lesen, planen, vorschlagen, dry-runnen und stage-en. Jeder Commit und jedes Publish benötigt in V1 menschliche Freigabe über den Host-CommitCoordinator | G11 Security Suite und G17 AI/E2E Gate |
| 11 | Modding versus Save und Security | V1 erlaubt additive data-only Packages mit exakten Locks, Provenienz, Quarantäne und Migration. Kein ausführbarer Modcode, kein allgemeines Last-file-wins und keine stillen Save-Upgrades | G13 Owner Freeze und Registry-/Save-Spikes |

## 12. MVP-Grenze

Das MVP endet nach **VS03 First Contract Circuit**.

Das MVP muss beweisen:

- physische Interaktion und Cargo;
- Oberflächenexploration und Rückkehr;
- First City als authored, funktionaler Ort;
- ein echter Vertrag mit Material-, Geld-, Rechte- und Reputationsfolge;
- persistente Save-/Load-Reproduktion;
- verständliche Ursache und Wirkung über mindestens eine Störung oder Reparatur;
- dieselbe Grundschleife, die später auf Logistik, Schiffbau und Orbit skaliert.

Nicht im MVP:

- freier City Builder;
- vollständige dynamische Stadtökonomie;
- Ship Builder;
- Orbit und Systemhandel;
- Krieg und bewaffnete Drohnen;
- voxelbasierte Structural Destruction als Produktfeature;
- Multiplayer;
- ausführbare Mods;
- AI-Autocommit;
- viele Sternsysteme.

## 13. Prototypen

| Prototyp | G18-Einstufung | Zulässige Nutzung |
|---|---|---|
| P01 Editor Shell | `ADAPT` | Workflow, navigierbare Issues, Preview/Validate/Commit-Informationsarchitektur |
| P02 Mission Graph | `ADAPT` | Headless Compiler, Validator, Simulator und React-Flow-Projektion, Domainmodell ersetzen |
| P03 Settlement Editor | `REFERENCE_ONLY` | Road-Draft-, Snap- und Invalid-Reason-UX |
| P04 Star System Map | `REFERENCE_ONLY` | Auswahl, Zeit-Scrubber, 2D/3D-Projektions- und Handoff-UX |
| P05 AI Transaction UX | `ADAPT` | sichtbare Plan-, Validation-, Approval-, Commit- und Compensation-Folge |

Kein Prototyp liefert Produkt-Authority, Integrationsreife, Securityfreigabe oder belastbare Performanceevidence. Prototype-Code und Prototype-Assets benötigen vor Übernahme einen separaten Lizenz- und Provenienzentscheid.

## 14. Noch offene Ownerentscheidungen

Vor Implementierungsfreigabe sind mindestens zu entscheiden:

1. Die nicht separat vorliegende G03-Basis-Bake-off-Evidence nachliefern oder ihren verbleibenden Entscheidungsumfang formell als Evidence-Luecke behandeln. Der Launch-Freeze von G03A bleibt davon unberuehrt.
2. G03A-DR1 und die genaue Developer-Editor-Topologie bestätigen.
3. MVP-Zeitziele und Hardware-/Browser-Tiers festlegen.
4. City-Detailfenster, vollständige First-City-Population und aktive Agentenkappen bestätigen.
5. Wirtschaftshärte, Single Currency, Pause/Beschleunigung und kein Offlinefortschritt bestätigen.
6. Framekonvention und Builder-/Flight-Adapter für Ships festlegen.
7. Terrain-, Adaptive-, Structural- und Building-Ownership-Matrix beschließen.
8. WorldTransactionCoordinator, Eventlog und Save-Manifest-Owner benennen.
9. Daten-only-Modding, Namespace, Override-, Signatur- und Save-Supportpolitik bestätigen.
10. AI-Provider-, Retention-, Approval- und Auditpolitik bestätigen.
11. Lizenz- und Kommerzialisierungsstrategie für Produkt, Voxel-Lab und Prototypen festlegen.
12. WP04 erst nach dokumentiertem `ACCEPT` und autorisiertem `--ff-only` übernehmen.

## 15. Abschlussstatus

Das Design ist systemisch kohärent und ausreichend für Ownerentscheidungen, Contract-Freeze und isolierte Spikes. Es ist nicht implementierungs- oder integrationsfreigegeben.

**Status: `REQUIRES_OWNER_DECISION`**

Hauptgründe:

- der vollständige G03-Bake-off fehlt;
- zentrale Produkt-, Authority-, Zeit-, Lizenz- und Scopeentscheidungen sind offen;
- G04, G09, G13, G14, G15 und G17 benötigen Ownerentscheidungen;
- G05, G12 und G16 benötigen Spikes;
- WP04 bleibt bis `ACCEPT` plus autorisiertem `--ff-only` blockiert;
- Produktintegration bleibt bis WP12 und separater Freigabe gesperrt.
