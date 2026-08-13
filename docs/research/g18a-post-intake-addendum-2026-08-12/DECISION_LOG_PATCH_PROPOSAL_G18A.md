# Decision Log Patch Proposal G18A

**Patchstatus:** `PROPOSED_NOT_APPLIED`  
**Gesamtstatus:** `REQUIRES_OWNER_DECISION`  
**Owner-Signoff:** ausstehend

## 1. Patchregeln

1. Bestehende akzeptierte Entscheidungen werden nicht neu nummeriert oder still umgeschrieben.
2. X02-Statuswerte werden nur als Patchvorschlag übernommen, bis ein benannter Owner den Patch anwendet.
3. Recommendations werden nicht zu `ACCEPT` hochgestuft.
4. Evidence-Updates werden von Produktentscheidungen getrennt.
5. Neue IDs werden erst beim Anwenden kollisionsfrei vergeben.

## 2. Evidence- und Statuspatches, keine neuen Produktentscheidungen

### PATCH-EVIDENCE-01: Voxel-Lab-Integrationsstand

| Feld | Wert |
|---|---|
| Typ | Evidence/Status Update |
| Alter aktueller Stand | `d95992df05952ac4be6221ca1809c1c9e3c0ac9d` |
| Neuer aktueller Stand | `c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d` |
| Repository | `BenjaminHornung/hestia-voxel-kernel-lab` |
| Branch | `integration/voxel-kernel-lab-v1` |
| WP04 | `ACCEPTED_AND_INTEGRATED`, Lab-Scope |
| Begrenzung | keine Produktintegration, kein Hestia-Artpass, C08 separat, WP12 bleibt Pflicht |

Vorgeschlagene Logaktion: historischen `d95992...`-Current-Head-Claim als `SUPERSEDED` markieren. Seine Rolle als WP03-Basis und WP04-Parent bleibt erhalten.

### PATCH-EVIDENCE-02: Prototype Intake P06

| Paket | Evidenzstatus | Decision-Log-Folge |
|---|---|---|
| P01 | `ADAPT` | kein neuer Accept für Codeadoption |
| P02 | `ADAPT`, unlicensed/dependency-bound | Rechteentscheidung erforderlich |
| P03 | enges `ADAPT` | alte `REFERENCE_ONLY`-Aussage superseden, Implementierung weiter nicht übernommen |
| P04 | enges `ADAPT` | alte `REFERENCE_ONLY`-Aussage superseden, Mock-Runtime nicht übernommen |
| P05 | Distribution `QUARANTINED`, Paket `DISCARD`, nur Learnings `ADAPT` | Security-/Rights-Fix vor jeder Neuprüfung |

### PATCH-EVIDENCE-03: Hestia Visual Source of Truth

| Feld | Wert |
|---|---|
| Klasse | `Design Target` |
| Source | Hestia-Dokumentset bei `f7828d186f9db52ac92961dbf6446fb10045605f` |
| Bindender Kern | harte detaillierte Block-/Microvoxels; kein Low-Poly-Hauptstil |
| Historisch/abgelehnt | Low-Poly-Hestia, Surface-Nets-Zielstil, facettierte Heightfields, grobe Dioramen |
| Laufzeitgrenze | Branchdokument und Konzeptbilder beweisen keine Main-Implementierung |

Vorgeschlagene Logaktion: als Owner-Source-Entscheidung mit Scope `Hestia visible design only` eintragen. Status beim Anwenden: `ACCEPT`, weil der G18A-Auftrag diese Source ausdrücklich als aktuelle visuelle Owner-Source-of-Truth setzt. Diese Annahme gilt nicht für Engine-, Voxelgrößen-, LOD- oder Runtimeentscheidungen.

## 3. X02-Patchübernahme

Der vollständige Wortlaut bleibt in X02 bei `53a78b3465075f52bcaa44df1a48bdb2f28cbc7a` maßgeblich. Vorgeschlagene Anwendung:

| IDs | Status |
|---|---|
| D-024 bis D-029 | `DEFER` |
| D-030 | `SPIKE_FIRST` |
| D-031 | `DEFER` |
| D-032 | `SPIKE_FIRST` |
| D-033 | `REJECT` für privilegierte direkte KI-Mutation; neue Log-ID/Anwendung ownerseitig bestätigen |
| D-034 bis D-035 | `DEFER` |
| D-036 | `SPIKE_FIRST` |
| D-037 bis D-041 | `DEFER` |
| D-042 | `SPIKE_FIRST` |
| D-043 bis D-048 | `DEFER` |

### D-037 Sperrnotiz

Dem D-037-Eintrag ist beim Anwenden folgende normative Notiz beizufügen:

> Kein erster Editor- oder Command-Kernel-Write, bis Ziel-Repository und Zielpfad, exakte Basis-SHA, enger Scope und alleiniger Write-Owner ausdrücklich akzeptiert sind. `DEFER` und `SPIKE_FIRST` autorisieren keinen Write.

## 4. Vorgeschlagene neue Entscheidungen

Die IDs sind Platzhalter und müssen beim Anwenden kollisionsfrei zugewiesen werden.

### NEW-G18A-VISUAL-OWNER

| Feld | Wert |
|---|---|
| vorgeschlagener Status | `ACCEPT` |
| Scope | sichtbares Hestia-Designziel |
| Entscheidung | Hestia verwendet eine hochdetaillierte, kleinteilig blockartige Voxel-/Microvoxelsprache. Low-Poly und geglättete sichtbare Heightfields sind kein positives Hestia-Ziel. |
| Nicht entschieden | Engine, globale Zellgröße, LOD-Algorithmus, finale Palette, Wassertechnik, City-Generatoranteil |
| Source | `f7828d186f9db52ac92961dbf6446fb10045605f` plus expliziter G18A-Auftrag |

### NEW-G18A-SHARED-VOCABULARY

| Feld | Wert |
|---|---|
| vorgeschlagener Status | `DEFER` |
| Scope | X01 Proposed Shared Contract Vocabulary |
| Begründung | G06/G15/G16 und X01-D-01 bis D-17 sind nicht vollständig entschieden. |
| Safe Default | X01 darf als Proposal-Crosswalk verwendet werden, aber keine Package- oder Runtime-Authority beanspruchen. |

### NEW-G18A-SEQUENCE-DOMAIN

| Feld | Wert |
|---|---|
| vorgeschlagener Status | `DEFER` |
| Scope | `SequenceDocumentV1` und Storyboard Workspace |
| Begründung | Research Proposal, Prerequisites offen, keine Main-Implementierung |
| Safe Default | getrennt von Story/Mission/Dialogue halten; keine Domainwrites; kein Implementierungsprompt |

### NEW-G18A-P05-REINTAKE

| Feld | Wert |
|---|---|
| vorgeschlagener Status | `REJECT` für aktuelle Distribution |
| Scope | aktuelles P05-Distributionspaket |
| Begründung | kompromittierte Distribution, daher Quarantäne und Paket-Discard |
| Zulässige Zukunft | neuer Ownerentscheid erst nach Secret-Invalidierung/-Rotation, Source-only-Repack und erneuten Audits |

## 5. Unveränderte akzeptierte Anker

Die vorhandenen D-001, D-004, D-005, D-010, D-012, D-013 und D-022 bleiben unverändert. G18A erweitert ihren Scope nicht.

## 6. Owner-Checkliste für Anwendung

- [ ] X02-Wortlaut und IDs gegen aktuellen Decision Log kollisionsfrei geprüft.
- [ ] D-037-Notiz unverändert übernommen.
- [ ] Hestia-Visualentscheidung auf sichtbares Design begrenzt.
- [ ] Kein Runtime-, Engine- oder Zellgrößen-Accept aus der Visualentscheidung abgeleitet.
- [ ] X01 bleibt `DEFER`, bis Varianten und Ownership entschieden sind.
- [ ] Storyboard bleibt `DEFER` oder wird separat mit klaren Prerequisites entschieden.
- [ ] P05-Secret oder Inhalte der kompromittierten Distribution wurden nicht in den Log kopiert.
- [ ] WP04 als Lab-Status, nicht als Produktintegration, eingetragen.
- [ ] C08 und WP12 bleiben separate Gates.
- [ ] benannter Owner, Datum und angewandter Commit werden ergänzt.

## 7. Abschluss

Dieser Patch darf erst nach explizitem Owner-Signoff als Decision-Log-Wahrheit gelten. Bis dahin bleibt der Projektstatus `REQUIRES_OWNER_DECISION`.
