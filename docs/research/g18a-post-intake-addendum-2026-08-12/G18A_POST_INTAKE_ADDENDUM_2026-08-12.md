# G18A Post-Intake-Addendum

**Datum des Quellstands:** 2026-08-12  
**Auswertung:** 2026-08-13  
**Gesamtstatus:** `REQUIRES_OWNER_DECISION`  
**Dokumenttyp:** Delta/Addendum zu G18, kein zweites Master-GDD  
**Arbeitsmodus:** vollständig read-only

## 1. Ergebnis in einem Satz

G18 bleibt als historischer Synthesestand unverändert; G18A aktualisiert ausschließlich die nach G18 eingegangenen Belege zu Prototypen, Vertragsvokabular, Ownerentscheidungen, technischer Lab-Reife, Storyboard-Sequenzen und Hestias visueller Sprache. Implementierung, Produktintegration und der erste Editor- oder Command-Kernel-Write bleiben gesperrt.

## 2. Start-Gate

Das Start-Gate wurde gegen den GitHub-Remote geprüft.

| Prüfung | Ergebnis |
|---|---|
| Repository | `BenjaminHornung/hestia-voxel-kernel-lab` |
| Branch | `integration/voxel-kernel-lab-v1` |
| Erwarteter Head | `c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d` |
| Remote-Head | `c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d` |
| Gate | `PASS` |

Der ältere Stand `d95992df05952ac4be6221ca1809c1c9e3c0ac9d` ist damit `HISTORICAL/SUPERSEDED` als aktueller Integrationsstand. Er bleibt als WP03-Basis und Parent der späteren WP04-Arbeit nachvollziehbar.

## 3. Verifizierte Quellenbasis

Alle nachfolgenden Branch-Heads entsprachen zum Prüfzeitpunkt exakt den vorgegebenen Commits. Die Inhalte wurden commitgebunden gelesen.

| Kürzel | Repository, Branch und Commit | Gelesener Scope |
|---|---|---|
| G18 | `BenjaminHornung/Weltraum-Spiel`, `docs/g18-master-synthesis-v1`, `ef6d2b4b6589d93b69da7ced737aa16679610a2d` | vollständig `docs/research/g18-master-synthesis-v1/**`, einschließlich aller zehn Folgeprompts |
| P06 | `BenjaminHornung/Weltraum-Spiel`, `docs/p06-prototype-intake-audit-2026-08-12`, `9da5a187d68fd801ee3acafa9db5837215350cbd` | `docs/design-audits/P06_PROTOTYPE_INTAKE_AND_ADOPTION_AUDIT_2026-08-12.md` |
| X01 | `BenjaminHornung/Weltraum-Spiel`, `docs/x01-common-contract-vocabulary-v1`, `e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30` | Proposal, Ownership Matrix und Shadow Contract Risks |
| X02 | `BenjaminHornung/Weltraum-Spiel`, `docs/x02-owner-decision-freeze-2026-08-12`, `53a78b3465075f52bcaa44df1a48bdb2f28cbc7a` | Owner Decision Freeze und Decision Log Patch Proposal |
| Storyboard | `BenjaminHornung/Weltraum-Spiel`, `docs/storyboard-sequence-animation-editor-research-2026-08-12`, `48fded871345129b606b89344fe3ca3d2fd63715` | Storyboard-/Sequence-/Animation-Editor-Research |
| Hestia Visual | `BenjaminHornung/Weltraum-Spiel`, `docs/hestia-visual-language-v1-2026-08-12`, `f7828d186f9db52ac92961dbf6446fb10045605f` | vollständiges Hestia-Dokumentset mit README, Visual Bible, Authoring Spec und Conflict Register |
| Produkt-Main | `BenjaminHornung/Weltraum-Spiel@15f3550bd604856b25d40a7ac700ec4d5106b89e` | ausschließlich Implementierungs- und Integrationsgrenze |
| Voxel-Lab | `BenjaminHornung/hestia-voxel-kernel-lab@c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d` | technischer Lab-Stand, Commit `#VOXEL-LAB-004 Complete WP04 visual evidence contract` |

### 3.1 Exaktes Pfadregister

- G18, vollständiger Subtree: [`docs/research/g18-master-synthesis-v1/`](https://github.com/BenjaminHornung/Weltraum-Spiel/tree/ef6d2b4b6589d93b69da7ced737aa16679610a2d/docs/research/g18-master-synthesis-v1)
- P06: [`docs/design-audits/P06_PROTOTYPE_INTAKE_AND_ADOPTION_AUDIT_2026-08-12.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/9da5a187d68fd801ee3acafa9db5837215350cbd/docs/design-audits/P06_PROTOTYPE_INTAKE_AND_ADOPTION_AUDIT_2026-08-12.md)
- X01 Proposal: [`docs/architecture/contracts/COMMON_CONTRACT_VOCABULARY_V1_PROPOSAL.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30/docs/architecture/contracts/COMMON_CONTRACT_VOCABULARY_V1_PROPOSAL.md)
- X01 Ownership: [`docs/architecture/contracts/CONTRACT_OWNERSHIP_MATRIX.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30/docs/architecture/contracts/CONTRACT_OWNERSHIP_MATRIX.md)
- X01 Risks: [`docs/architecture/contracts/SHADOW_CONTRACT_RISKS.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30/docs/architecture/contracts/SHADOW_CONTRACT_RISKS.md)
- X02 Freeze: [`docs/research/OWNER_DECISION_FREEZE_2026-08-12.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/53a78b3465075f52bcaa44df1a48bdb2f28cbc7a/docs/research/OWNER_DECISION_FREEZE_2026-08-12.md)
- X02 Patch: [`docs/research/DECISION_LOG_PATCH_PROPOSAL_2026-08-12.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/53a78b3465075f52bcaa44df1a48bdb2f28cbc7a/docs/research/DECISION_LOG_PATCH_PROPOSAL_2026-08-12.md)
- Storyboard: [`docs/research/storyboard-sequence-animation-editor-research-2026-08-12.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/48fded871345129b606b89344fe3ca3d2fd63715/docs/research/storyboard-sequence-animation-editor-research-2026-08-12.md)
- Hestia Index: [`docs/art-direction/hestia/README.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/f7828d186f9db52ac92961dbf6446fb10045605f/docs/art-direction/hestia/README.md)
- Hestia Visual Bible: [`docs/art-direction/hestia/01_Hestia_Visual_Design_Language_v1.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/f7828d186f9db52ac92961dbf6446fb10045605f/docs/art-direction/hestia/01_Hestia_Visual_Design_Language_v1.md)
- Hestia Authoring Spec: [`docs/art-direction/hestia/02_Hestia_Worldgen_Editor_Authoring_Spec_v1.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/f7828d186f9db52ac92961dbf6446fb10045605f/docs/art-direction/hestia/02_Hestia_Worldgen_Editor_Authoring_Spec_v1.md)
- Hestia Conflict Register: [`docs/art-direction/hestia/03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md`](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/f7828d186f9db52ac92961dbf6446fb10045605f/docs/art-direction/hestia/03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md)
- Produkt-Main: [`15f3550bd604856b25d40a7ac700ec4d5106b89e`](https://github.com/BenjaminHornung/Weltraum-Spiel/tree/15f3550bd604856b25d40a7ac700ec4d5106b89e)
- Voxel-Lab WP04: [`c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d`](https://github.com/BenjaminHornung/hestia-voxel-kernel-lab/commit/c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d)

## 4. Evidenzklassen

G18A verwendet die folgenden Klassen strikt. Eine Aussage darf nur in ihrer stärksten belegten Klasse erscheinen.

| Klasse | Bedeutung | Beispiele in G18A |
|---|---|---|
| `Design Target` | Bindendes sichtbares Ziel, kein Laufzeitbeweis | Hestia Visual Design Language, aktuelle Hestia-Konzeptbilder |
| `Runtime Evidence` | Nachweis an einem konkreten Commit oder Build, kein allgemeiner Produktvertrag | Produkt-Main bei `15f3550...`; WP04 im Voxel-Lab bei `c64aeef...` |
| `Technical Contract` | Akzeptierte technische Grenze für einen benannten Scope | Browser-/Chromium-first, CPU-Voxelzustand als Authority, Lab-Profilgrenzen, kein Lab-zu-Produkt vor WP12 |
| `Research Proposal` | Präziser Vorschlag, der noch Ownerentscheidung, Spike oder Benchmark benötigt | X01-Vokabular, X02-Patch, `SequenceDocumentV1`, große Teile der Hestia Authoring Spec |
| `Historical/Rejected` | Für Provenienz oder Negativlernen erhalten, nicht als Ziel oder aktueller Status | Low-Poly-Hestia, Surface-Nets-Zielbild, P05-Distribution, G18s alter WP04-Blocker, `d95992...` als aktueller Head |

## 5. Delta gegenüber G18

### 5.1 Prototypen

P06 liegt nun vor und ersetzt G18s unsichere Intake-Annahme durch auditierten Paketstatus:

- P01: `ADAPT`.
- P02: `ADAPT`, aber Lizenz- und Dependency-Grenze sichtbar halten; kein Codeimport ohne geklärte Rechte.
- P03: `ADAPT` für RoadGraph-/Parcel-Vertragsideen und UX-Learnings; visuelle Captures und nicht belegte Funktionen bleiben klar getrennt.
- P04: `ADAPT` für View-State- und Handoff-Learnings; Mock-Daten und unbestätigte Laufzeitsemantik werden nicht übernommen.
- P05: aktuelle Distribution `QUARANTINED`, Paket `DISCARD`; nur abstrahierte UX-/Contract-Learnings `ADAPT`.

Kein G18A-Artefakt nennt, kopiert oder referenziert einen Secret-Wert aus P05. Die kompromittierte Distribution ist kein zulässiges Evidence-, Quell- oder Adoptionsartefakt.

### 5.2 Gemeinsame Contracts

X01 liefert ein belastbares vorgeschlagenes Vokabular und eine vorgeschlagene Paketgrenze. Es ist nicht akzeptiert und nicht auf Main implementiert. Insbesondere bleiben die inkompatiblen Varianten G06-A/G06-B, G15-A/G15-B und G16-A/G16-B offen. G18A wählt keine Variante still aus.

### 5.3 Ownerentscheidungen

X02 liefert eine commitgebundene Freeze- und Patch-Vorlage. Nur ausdrücklich als bereits akzeptiert belegte Anker werden als `ACCEPT` geführt. Empfehlungen bleiben Empfehlungen. `DEFER` bedeutet keine Freigabe. `SPIKE_FIRST` ist keine Produktfreigabe.

`D-037` ist ein harter Write-Blocker: Vor dem ersten Editor- oder Command-Kernel-Write müssen Ziel-Repository und Zielpfad, Basis-SHA, Scope und alleiniger Write-Owner ausdrücklich benannt und akzeptiert sein. Der aktuelle Status `DEFER` autorisiert keinen Write.

### 5.4 Technische Reife

Der alte G18-Satz, WP04 sei blockiert, ist historisch überholt. Für das Voxel-Lab gilt:

- WP04 ist `ACCEPTED_AND_INTEGRATED` bei `c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d`.
- Das ist technische Lab-Wahrheit, keine Produktintegration.
- C08 bleibt ein separates Benchmark-Synthese-Gate.
- Vor WP12 und einer expliziten Integrationsentscheidung darf kein Lab-Kern in `Weltraum-Spiel` integriert werden.

### 5.5 Storyboard und Sequenzen

Der Storyboard-Bericht ergänzt einen vorgeschlagenen, zeitlinearen Workspace um `SequenceDocumentV1`. Er bleibt getrennt von `StoryGraph`, `MissionGraph` und `DialogueGraph`. Canonical Content, Editorlayout, kompiliertes Programm und Runtime-Persistenz sind getrennte Artefakte. Die Sequenz darf keine privilegierten Domänenwrites umgehen.

### 5.6 Hestia Visual Language

Die Hestia Visual Language ist die visuelle Owner-Source-of-Truth für Hestia:

- harte, kleine, achsenorientierte Block- und Microvoxels;
- organische Makroformen bei klarer blockiger Nahbereichswahrheit;
- authored Macro/Meso/Micro-Hierarchie vor Noise;
- hydrologisch verbundene Gewässer, habitatgebundene Vegetation und semantische Materialrollen;
- biophile Hard-SF-Städte und funktionslesbare Infrastruktur in derselben Microvoxel-Grammatik;
- unabhängige menschliche visuelle Freigabe.

Low-Poly, facettierte Heightfields, Surface Nets als sichtbarer Zielstil, primitive Dioramen, Lollipop-Bäume und opake Cyan-Wasserplatten sind `HISTORICAL/REJECTED`. Ein technischer Lab-Pass ist kein visueller Hestia-Pass.

## 6. Unveränderte harte Grenzen

1. G18 bleibt historisch unverändert.
2. G18A ist kein zweites Master-GDD.
3. G18A enthält keine Implementierung und keinen Mega-Prompt.
4. Branch-Dokumente werden nicht als auf Produkt-Main implementiert dargestellt.
5. Lab-Wahrheit wird nicht zu Produkt-Wahrheit hochgestuft.
6. X01 bleibt `Research Proposal`, bis Ownerentscheidungen die offenen Varianten und Paketgrenzen schließen.
7. X02-Patchstatus wird nicht mit einem angewandten Decision Log verwechselt.
8. `D-037` blockiert alle einschlägigen Writes.
9. Voxel-Lab-C08 bleibt außerhalb von G18A und wird nicht in diese Synthese hineingezogen.
10. Geheimnisse, Secret-Werte und kompromittierte P05-Distributionen werden weder zitiert noch kopiert.

## 7. Offene Ownerentscheidungen mit höchster Hebelwirkung

| Priorität | Entscheidung | Wirkung |
|---:|---|---|
| 1 | D-037 mit Repo/Pfad, Basis-SHA, Scope und sole Write Owner explizit `ACCEPT` setzen oder akzeptiert ersetzen | Erst danach ist ein erster Editor-/Command-Kernel-Write zulässig. |
| 2 | X01-Varianten G06, G15 und G16 sowie die zugehörigen D-01 bis D-17 entscheiden | Erst danach kann ein gemeinsames Vokabular verbindlich werden. |
| 3 | X02-Patch durch benannten Owner anwenden oder gezielt revidieren | Erst dann werden vorgeschlagene Statuswerte zu Decision-Log-Wahrheit. |
| 4 | Scope und Rechte für P02 sowie eine sichere Source-only-Neupaketierung von P05 entscheiden | Erst danach kann Adoptionsarbeit über abstrakte Learnings hinausgehen. |
| 5 | Storyboard-Sequenzdomäne und ihre Prerequisites entscheiden | Erst danach ist ein isolierter Contract-Spike zulässig. |

## 8. Schlussstatus

`REQUIRES_OWNER_DECISION`

Die Dokumentationsdelta ist vollständig genug für einen Owner-Freeze. Der Projektzustand ist jedoch nicht write-ready: D-037, X01-Varianten, mehrere X02-Entscheidungen, Prototyprechte und Storyboard-Prerequisites bleiben offen.
