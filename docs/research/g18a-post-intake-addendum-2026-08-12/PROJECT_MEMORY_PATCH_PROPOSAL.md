# Project Memory Patch Proposal: G18A

**Patchstatus:** `PROPOSED_NOT_APPLIED`  
**Gesamtstatus:** `REQUIRES_OWNER_DECISION`  
**Zweck:** präzises Delta für Project Memory, ohne historische G18- oder Memory-Inhalte still umzuschreiben

## 1. Anwendungshinweis

Dieser Text ist ein Patchvorschlag. Bei Anwendung müssen bestehende Aussagen erhalten oder explizit als `SUPERSEDED`, `HISTORICAL` oder `REJECTED` markiert werden. Keine Zeile dieses Vorschlags beweist allein eine Mainline-Implementierung.

## 2. Vorgeschlagener Memory-Eintrag

### G18A Post-Intake-Stand, Quellen vom 2026-08-12

#### Quellen-Freeze

| Input | Exakter Stand |
|---|---|
| G18 | `BenjaminHornung/Weltraum-Spiel@ef6d2b4b6589d93b69da7ced737aa16679610a2d`, Branch `docs/g18-master-synthesis-v1` |
| P06 | `BenjaminHornung/Weltraum-Spiel@9da5a187d68fd801ee3acafa9db5837215350cbd`, Branch `docs/p06-prototype-intake-audit-2026-08-12` |
| X01 | `BenjaminHornung/Weltraum-Spiel@e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30`, Branch `docs/x01-common-contract-vocabulary-v1` |
| X02 | `BenjaminHornung/Weltraum-Spiel@53a78b3465075f52bcaa44df1a48bdb2f28cbc7a`, Branch `docs/x02-owner-decision-freeze-2026-08-12` |
| Storyboard | `BenjaminHornung/Weltraum-Spiel@48fded871345129b606b89344fe3ca3d2fd63715`, Branch `docs/storyboard-sequence-animation-editor-research-2026-08-12` |
| Hestia Visual | `BenjaminHornung/Weltraum-Spiel@f7828d186f9db52ac92961dbf6446fb10045605f`, Branch `docs/hestia-visual-language-v1-2026-08-12` |
| Produkt-Main-Grenze | `BenjaminHornung/Weltraum-Spiel@15f3550bd604856b25d40a7ac700ec4d5106b89e` |
| Voxel-Lab | `BenjaminHornung/hestia-voxel-kernel-lab@c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d`, Branch `integration/voxel-kernel-lab-v1` |

#### Wahrheitsklassen

- `Design Target`: bindendes sichtbares Ziel, kein Buildbeweis.
- `Runtime Evidence`: belegter Zustand eines konkreten Commits/Builds, kein universeller Produktvertrag.
- `Technical Contract`: akzeptierte technische Grenze für einen benannten Scope.
- `Research Proposal`: Empfehlung oder präziser Zielvertrag ohne Owneraccept.
- `Historical/Rejected`: für Provenienz oder Negativlernen erhalten, nicht als aktuelles Ziel.

#### Technischer Lab-Stand

- Der aktuelle akzeptierte und integrierte Voxel-Lab-Stand ist `c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d`.
- `d95992df05952ac4be6221ca1809c1c9e3c0ac9d` bleibt als historische WP03-Basis und WP04-Parent erhalten, ist aber als aktueller Integrations-SHA `SUPERSEDED`.
- WP04 ist im Voxel-Lab `ACCEPTED_AND_INTEGRATED`.
- WP04 ist technische Lab-Wahrheit, keine Produktintegration und kein visueller Hestia-Artpass.
- C08 bleibt ein separates Benchmark-Synthese-Gate.
- Keine Lab-zu-Produkt-Integration vor WP12 und einer expliziten Integrationsentscheidung.

#### Prototype Intake nach P06

| Paket | Memory-Status |
|---|---|
| P01 | `ADAPT`, UI-/Validation-Learnings; Lizenz und neutrale Fixtures vor Codeadoption |
| P02 | `ADAPT`, aber unlicensed und dependency-bound; keine direkte Codeadoption |
| P03 | `ADAPT` für RoadGraph-/Parcel- und UX-Learnings; aktuelle Mock-/Geometrieimplementation nicht übernehmen |
| P04 | `ADAPT` für View-State-/Handoff-Learnings; Mock-Runtimewerte nicht übernehmen |
| P05 | Distribution `QUARANTINED`, Paket `DISCARD`, nur abstrahierte Learnings `ADAPT` |

P05-Sicherheitsregel: keine Secret-Werte, keine Inhalte oder Pfade der kompromittierten Distribution und keine aktuelle Distribution zitieren, kopieren, ausführen oder adoptieren. Vor jeder Neuprüfung Secret invalidieren/rotieren, Source-only neu paketieren und Lizenz-/Secret-Audit wiederholen.

#### X01 Contract Vocabulary

- X01 ist ein `Research Proposal`, nicht akzeptiert und nicht als Produkt-Main-Implementierung belegt.
- G06-A/G06-B, G15-A/G15-B und G16-A/G16-B sind inkompatible offene Varianten.
- Keine Variante still auswählen oder synthetisieren.
- Vorgeschlagene Paketgrenzen: core, command, content, validation, domain, presentation.
- Vorgeschlagene Importrichtung: core zu command/content/validation zu domain zu presentation, ohne reverse Authority.
- Preview, Prepare, Approval, Outcome/Receipt, Reservationstypen, Coverage und Principal/Actor/Source müssen semantisch getrennt bleiben.

#### X02 Owner Freeze

- X02-Patch ist nicht als angewandt belegt.
- Statussemantik: `ACCEPT`, `REJECT`, `DEFER`, `SPIKE_FIRST`.
- `DEFER` und `SPIKE_FIRST` sind keine Write- oder Produktfreigabe.
- Akzeptierte Anker umfassen D-001, D-004, D-005, D-010, D-012, D-013 und D-022.
- D-033 schließt im X02-Patchvorschlag privilegierte direkte KI-Mutation aus; keine direkte KI-Write-Route verwenden.
- D-037 steht auf `DEFER` und ist ein harter Write-Blocker.

D-037-Entry-Gate: Vor dem ersten Editor- oder Command-Kernel-Write müssen Ziel-Repository/Pfad, Basis-SHA, Scope und alleiniger Write-Owner ausdrücklich akzeptiert sein. D-037 selbst muss `ACCEPT` sein oder durch eine mindestens gleich strenge akzeptierte Entscheidung ersetzt werden.

#### Storyboard und Sequenzen

- `SequenceDocumentV1` ist ein vorgeschlagener eigener linearer Zeitbereich.
- StoryGraph, MissionGraph und DialogueGraph bleiben separate Domain Authorities.
- Canonical Sequence Content, Editorlayout, Compiled Program und Runtime Run State sind getrennte Artefakte.
- Sequenztracks dürfen rein visuell samplen; fachliche Writes laufen ausschließlich über Domain Commands und ihre Approval-/Outcome-Verträge.
- Skip benötigt einen expliziten SkipPlan.
- Der Storyboardstand ist `PROPOSED`, `REQUIRES_OWNER_DECISION`, `REQUIRES_SPIKE` und `BLOCKED_BY_PREREQUISITES`.
- Keine Main-Implementierung ist belegt.

#### Hestia Visual Owner Source of Truth

- Hestia ist keine Low-Poly-Welt.
- Hestia ist eine hochdetaillierte, kleinteilig blockartige Voxel- und Microvoxelwelt.
- Sichtbare Formen verwenden kleine harte achsenorientierte Blockelemente, organische Makroformen und klar erkennbare Microvoxel-Nahbereichswahrheit.
- Authoring geht vor Noise; Macro, Meso und Micro müssen gemeinsam lesbar sein.
- Hydrologie ist verbunden; Vegetation ist habitatgebunden; Materialrollen und Licht machen Voxel lesbar.
- Gratia City ist biophile Hard-SF in derselben feinen Blockgrammatik.
- Low-Poly, Surface Nets als sichtbarer Zielstil, facettierte Heightfields, primitive Dioramen, Lollipop-Bäume und opake Cyan-Wasserplatten sind `HISTORICAL/REJECTED`.
- Technische Captures sind Runtime Evidence, keine Art Direction.
- Die visuelle Schlussfreigabe ist menschlich und unabhängig.
- Zellprofil, universelle Chunkkante, finale Palette, AO-Stärke, Wassertechnik, LOD-Verfahren, City-Generatoranteil und finale Engine bleiben ganz oder teilweise offen.

#### G18-Folgeprompts

| Prompt | Status |
|---|---|
| 01 Owner Source Freeze | `SUPERSEDED` durch X02 |
| 02 Common Contract Crosswalk | `SUPERSEDED` durch X01-Lieferung, Ownerentscheid offen |
| 03 G03A Editor Topology | `BLOCKED_BY_D037` |
| 04 Renderneutral Command Kernel | `BLOCKED_BY_D037` |
| 05 Content Package Lock | `BLOCKED_BY_OWNER` |
| 06 Validation/Issue/Quick-Fix | `BLOCKED_BY_OWNER` |
| 07 Playwright Evidence Runner | `BLOCKED_BY_OWNER` |
| 08 Mission Compiler | `BLOCKED_BY_OWNER` |
| 09 Settlement Contracts | `REQUIRES_FIX` |
| 10 Road/Block/Parcel Geometry | `REQUIRES_FIX` |

#### Gesamtstatus

`REQUIRES_OWNER_DECISION`

## 3. Vorgeschlagene Supersession-Markierungen

| Historische Memory-Aussage | Patchaktion |
|---|---|
| „Der akzeptierte Lab-Integrations-SHA ist d95992...“ | als `SUPERSEDED` markieren; neuer Stand `c64aeef...` |
| „WP04 ist blockiert/nicht integriert“ | als `HISTORICAL` markieren; Labstatus aktualisieren |
| „P03/P04 nur Reference Only“ | mit P06-spezifischem `ADAPT`-Delta ergänzen |
| „P05 adaptieren“ | durch Distribution `QUARANTINED`, Paket `DISCARD`, nur Learnings `ADAPT` präzisieren |
| „gemeinsamer Contract fehlt vollständig“ | durch „X01 Proposal vorhanden, Ownerentscheid offen“ präzisieren |
| Low-Poly als Hestia-Ziel | `REJECTED/HISTORICAL` für Hestia markieren |

## 4. Nicht in Memory übernehmen

- keine Secret-Werte oder P05-Distributiondetails;
- keine Performancezahlen ohne Benchmarkprotokoll;
- keine X01-Paketnamen als implementierte Packages;
- keine X02-Disposition als angewandter Decision Log;
- keine Storyboard- oder Hestia-Branchartefakte als Main-Funktion;
- keine globale 0,125-m-Produktauflösung;
- keine automatische visuelle Freigabe.
