# WELTRAUM Prototype Adoption Matrix V1

**Stand:** 2026-08-12  
**Dokumentstatus:** `PROPOSED`  
**Scope:** P01 bis P05, read-only Artefaktaudit ohne Build, Test oder Benchmark

## 1. Bedeutung der Klassifikationen

| Klassifikation | Verbindliche Verwendung |
|---|---|
| `Preserve` | Artefakt unveraendert als Research-, Provenienz- oder Evidence-Nachweis aufbewahren. Dies bedeutet nicht, dass es Produktcode oder Produktfunktion ist. |
| `Adapt` | Idee oder begrenztes Muster neu gegen akzeptierte WELTRAUM-Vertraege implementieren. Keine ungepruefte Quellkopie. |
| `Reference only` | Nur zum Vergleich oder fuer UX-Fragen konsultieren. Keine normative Abhaengigkeit und keine Implementierungszusage. |
| `Discard` | Aus dem Produktpfad ausschliessen. Darf hoechstens als Negativbeispiel im Audit verbleiben. |

Keine Zeile dieser Matrix erklaert eine Prototype-UX zur implementierten Produktfunktion.

## 2. Paketidentitaet und Gesamtklassifikation

| Paket | Archiv-SHA-256 | Gesamtklassifikation | Beleglage | Produktfolge |
|---|---|---|---|---|
| P01 Editor Shell | `615b0165b356060dd9ad9a6373682923b7be297c7cb7e606192076edcf5e7fd1` | `Adapt` | Source, Dist, vier Screenshots mit stimmigem Hashmanifest, JSON-Fixture, flacher Quelltexttest | UX-Muster in gemeinsamen Commandkern uebersetzen. Kein Sourcecopy vor P06/X01. |
| P02 Mission Graph | `6dbf7636dc5153e66e960ab948149fe0fb503120717eae4c6a663330e8678eb7` | `Adapt` | Source, Dist, Beispiele, Screenshots, substanzielle Unit- und E2E-Testquellen; dokumentierte Passzahlen wurden nicht neu ausgefuehrt | Headless Compiler-/Validatorstruktur adaptieren. G05-Vertraege ersetzen das konkrete Mischgraphmodell. |
| P03 Settlement Editor | `af9cc7f65d1f781006a23ad75d83e358b5fca02c0923339df270aa8bd137eddb` | `Reference only` | Source und Dokumentation vorhanden; drei PNGs sind ausdrueckliche `PENDING CAPTURE`-Placeholder; kein Dist im Archiv | Findings als Road-/Parcel-Spikeinput lesen. Quellcode und Mockalgorithmen nicht adoptieren. |
| P04 Star System Map | `60a309d9441b1c4fc8464f0e93ab5fd3a3cf9d5606d9e26c18d4c4943bd93152` | `Reference only` | Source und drei echte Screenshots; kein Dist; einziger Test prueft nur Preview-Metadaten | Shared-State- und Handoff-UX referenzieren. Physik und Contracts aus G10. |
| P05 AI Transaction UX | `988257c9d9ad74e57b7c963387c695612ace099aa8e55ed82e0982ac6cc4cbb7` | `Adapt` | Source und Dist; keine Screenshotdateien; linearer Ablauf und alle fachlichen Resultate fest codiert | Transaktionsstufen adaptieren. Echte Policy, Digests, CAS, Approval und Receipts aus G02/G03A/G11. |

## 3. P01 Editor Shell

| Teilaspekt | Klassifikation | Befund | G18-Verwendung oder Gate |
|---|---|---|---|
| README, Findings, Screenshotmanifest und vier Screenshots | `Preserve` | Nachvollziehbare Prototyp-Evidence; Bildhashes stimmen mit dem Manifest ueberein | Als UX-Research aufbewahren, nicht als visuelle Produktfreigabe. |
| Permanente Folge `Preview -> Validate -> Commit` | `Adapt` | Im React-State und in der UI sichtbar modelliert | Gegen echten Prepared-, Validation- und Commit-Receipt-Vertrag neu implementieren. |
| Getrennte Draft- und Authoritydarstellung | `Adapt` | Amber-Ghost, Base Revision und Previewstatus vorhanden | In Developer Editor und Player Builder mit unterschiedlicher Policy verwenden. |
| Issue-to-object Navigation | `Adapt` | Issue selektiert Mockobjekt und oeffnet den Inspector | An stabile DomainTargetRefs und G17-Issuevertraege binden. |
| Monotone Revision und vorwaertslaufendes Undo/Redo | `Adapt` | Revision sinkt nicht; History zeigt inverse und Replay-Eintraege | Mit G03A-CAS, Inversionsplan, Idempotenz und Receipt neu bauen. |
| Copilot als Proposal | `Adapt` | AI kann einen Draft stage-en | Actortrennung korrigieren und Hostpolicy erzwingen. |
| `Copilot · mock` als Actor eines committed Eintrags | `Discard` | Proposal-Origin und Committer werden vermischt | `proposedBy`, `approvedBy` und `committedBy` strikt trennen. |
| Custom SVG-Viewport | `Reference only` | Isometrische Blockdarstellung ohne Three.js oder Renderer-Backend | Keine Renderer- oder Engineevidence. |
| Mockvalidator und lokale JSON-Authority | `Discard` | Grenzpruefung und In-Memory-State, keine Produktauthority | Durch Domainvalidator, Gateway und persistente Receipts ersetzen. |
| Monolithische `EditorShell.tsx` | `Discard` | UI, Domainmock, History und Validation in einer Datei gekoppelt | Keine Produktcodebasis. |

## 4. P02 Mission Graph

| Teilaspekt | Klassifikation | Befund | G18-Verwendung oder Gate |
|---|---|---|---|
| README, Findings, Beispiele und Testquellen | `Preserve` | Beste technische Spike-Evidence im Prototyppaket | Als Referenzfixture und fuer spaeteren X01-Abgleich behalten. |
| Authoring-/Runtime-Trennung | `Adapt` | Layout, Edge-IDs und Runnerstate fehlen im kompilierten Artefakt | Als Grundmuster fuer G05-Compiler uebernehmen. |
| Reachability, Kardinalitaet und Tarjan-Zyklen | `Adapt` | Headless und deterministisch im Source vorhanden | In geschlossenen G05-Vertrag uebertragen und um Domainregeln ergaenzen. |
| Kanonische Serialisierung | `Adapt` | Rekursive Schluesselsortierung und ordinale ID-Sortierung | Mit normativer UTF-8-Kanonisierung und SHA-256 neu spezifizieren. |
| React Flow 12.11.3 | `Adapt` | MIT-lizenzierter Projektionskandidat, nicht Authority | Erst nach Graph-Contract-Gate und Accessibility-Gate als isolierten Kandidaten vergleichen. |
| Gemischter Mission-/Dialogue-/Reward-/Faction-Graph | `Discard` | Konflikt mit G05-Trennung und Effect-Gateway | Durch StoryGraph, MissionGraph und DialogueGraph mit gemeinsamen Conditions/Effects ersetzen. |
| Condition als Anzeigestring | `Discard` | Wird nicht ausgefuehrt und besitzt keine typisierte Semantik | Geschlossene, reine Condition-AST definieren. |
| Direkte lokale Reward-/Reputation-Mutation | `Discard` | Mock-Runner schreibt direkt in lokalen Context | Effekte nur ueber Gateway, Preflight, Reservation und atomisches Receipt. |
| FNV-1a als Integritaet | `Discard` | Dokumentiert selbst nur als Diagnosehash | Vollstaendige SHA-256-Digests ueber definierte Bytes. |

## 5. P03 Settlement Editor

| Teilaspekt | Klassifikation | Befund | G18-Verwendung oder Gate |
|---|---|---|---|
| `P03_DELIVERY_NOTE.md` | `Preserve` | Nennt gelieferten Scope, behauptete Verifikation und bekannte Evidence-Luecke | Als Provenienz- und Claimnachweis behalten. Behauptete Testresultate nicht als G18-Evidence hochstufen. |
| `docs/FINDINGS.md` | `Preserve` | Trennt beobachtete UX-Fragen von offenen Produktvertraegen | Als Input fuer G04 Road-/Parcel-Gate und X01 behalten. |
| `docs/ACCEPTANCE_MATRIX.md` | `Reference only` | PASS/PARTIAL bezieht sich auf isolierten Prototyp und wurde hier nicht reproduziert | Keine Produktabnahme daraus ableiten. |
| Drei `PENDING CAPTURE`-PNG | `Discard` als visuelle Evidence | Bilder zeigen nur Placeholder und benennen die fehlende Browserbindung | Die Evidence-Luecke dokumentieren. Keine UI-Bewertung aus den Bildern. |
| Expliziter Road-Draft und benanntes Snapziel | `Reference only` | UX-Frage ist nachvollziehbar, Browserinteraktion nicht neu ausgefuehrt | Im G04-Spike mit echten Command-, Tie-Break- und Quantisierungsregeln neu pruefen. |
| Invalidgruende mit Messwert und Objekt-ID | `Adapt` | Sinnvolles Diagnosemuster | An `Valid | Invalid | Unknown`, Source Revision und DomainTargetRef binden. |
| Authority versus Derived Products | `Adapt` | Road-/Zone-/Building-State ist getrennt von Parcels, Intersections und SVG | In G04 formal mit Settlement-, World- und Voxel-Authority umsetzen. |
| Polyline, Offset-Lots und radiale Coverage | `Discard` | Keine robuste Topologie, Lineage, Route oder Kapazitaet | Durch G04-Vertraege und isolierten Road-/Parcel-Spike ersetzen. |
| Snapshot-History und FNV-1a | `Discard` | Keine CAS-, Idempotenz-, Receipt- oder kollisionsresistente Persistenz | Gemeinsamen Kern und G13 Savevertraege verwenden. |
| Next/Vinext/Cloudflare/Drizzle-Sites-Scaffold | `Discard` als Produktentscheidung | Hostingrahmen ohne Nachweis fuer Produktfit | Nicht in G03-Toolentscheidung einrechnen. |
| ZIP-Provenienz | `Reference only` | ZIP-Kommentar `6e3a4aa9c72de567d453366f00971fe1cde723d7`; Delivery Note nennt lokalen Commit `cb064e9`; Beziehung ist nicht dokumentiert | P06 muss die Abweichung klaeren, bevor irgendein Sourcecopy diskutiert wird. |

## 6. P04 Star System Map

| Teilaspekt | Klassifikation | Befund | G18-Verwendung oder Gate |
|---|---|---|---|
| Drei 1920x1080-Screenshots | `Preserve` | Echte Bildartefakte, aber ohne Capturemanifest oder reproduzierten Browserlauf | Als Prototyp-Evidence behalten, nicht als Ownerfreigabe. |
| Gemeinsamer UI-State fuer 2D und 3D | `Adapt` | Auswahl, Zeit, Overlays und Ziel bleiben ausserhalb der SVG-Projektion | Mit G10-Systemdocument und read-only View Models neu umsetzen. |
| Expliziter Surface-Handoff | `Adapt` | Stub zeigt Body-, Site-, Frame- und Anzeigezeitbindung | Gegen akzeptierten SurfaceRef- und Routingvertrag crosswalken. |
| SVG-Kartenpraesentation | `Reference only` | Visuell ausgearbeitet, aber kein Three- oder Enginevergleich | Keine Rendererentscheidung daraus ableiten. |
| Mockpropagation und trigonometrische Positionen | `Discard` | Keine Orbitalmechanik oder Frame-Transformation | G10-Zweikoerper-Propagator und benannte Frames verwenden. |
| Mockroute, ETA, Fuel, Delta-v und Risk | `Discard` | Anzeigeformeln ohne Navigationsevidence | Nur Werte eines zustaendigen Navigationsdienstes darstellen. |
| Next/Vinext/Cloudflare/Drizzle-Sites-Scaffold | `Discard` als Produktentscheidung | Dasselbe Hostinggeruest wie andere Sites-Prototypen | Nicht als Technologie-Bake-off werten. |

## 7. P05 AI Transaction UX

| Teilaspekt | Klassifikation | Befund | G18-Verwendung oder Gate |
|---|---|---|---|
| README und Findings | `Preserve` | Beschreiben Scope, Grenzen und Folgegates korrekt | Als UX-Research und fuer X01 aufbewahren. |
| Neun sichtbare Transaktionsstufen | `Adapt` | Prompt, Plan, Dry-run, Issues, Fix, Diff, Approval, Commit und Undo sind getrennt | Auf Host-CommitCoordinator und echte Artefakte abbilden. |
| Sichtbare Permission Levels | `Adapt` | Read, Propose, Validate, Commit und Undo werden unterschieden | `APPROVE`, Publish und verbotene Aktionen im echten Capabilityvertrag ergaenzen. |
| Approval-Bindungsanzeige | `Adapt` | Base, Plan, Diff und Validatorstatus werden sichtbar | Vollstaendige, nicht gekuerzte Digests, Epoch, Policy, Tool Registry und Proposal Revision binden. |
| Append-only Provenienzrail | `Adapt` | Commit und Undo bleiben sichtbar | Mit authentifizierten Actoren und immutable Receipts neu implementieren. |
| Fest codierte Hashes, Validatorresultate und Receipts | `Discard` | Keine Berechnung oder fachliche Ausfuehrung | Niemals als Contract- oder Security-Evidence verwenden. |
| Lokaler React-State als Authority | `Discard` | Kein CAS, keine Persistenz, keine Authentifizierung | Hostauthority und atomare Persistenz verwenden. |
| `restoreSnapshot(base:v42)` als Undo | `Discard` | Kein revision-sicherer kompensierender Commit | G03A-Inversionsplan und vorwaertslaufende History-Transaction. |
| Screenshotclaim ohne Dateien | `Discard` als visuelle Evidence | Evidence-Notiz sagt, Export sei wegen `EROFS` gescheitert | Vor UX-Freigabe reproduzierbare G17-Captures erzeugen. |

## 8. Uebergreifende Adoption

| Muster | Ergebnis |
|---|---|
| Renderneutrale Authority | `Adapt` aus P01/P03/P04, normativ aus G02/G03A/G04 ableiten |
| Gemeinsamer Command-/Transaction-/Receipt-Kern | `Adapt`, aber `REQUIRES_OWNER_DECISION` vor Produkt-RFC |
| AI Proposal Boundary | `Adapt` aus P01/P05, echte Enforcement aus G11 |
| Deterministischer Headless Compiler | `Adapt` aus P02 |
| Prototype-Screenshots | `Preserve` als Research-Evidence, niemals Produktfunktion oder Performancebeleg |
| Prototype-Dist-Bundles | `Reference only`, keine vertrauenswuerdige oder lizenzgeklaerte Produktquelle |
| Hosting-Scaffolds | `Discard` als Toolentscheidung |
| Mockphysik, Mockwirtschaft und Mockcoverage | `Discard` |

## 9. Fehlende Intake-Artefakte

| Artefakt | Lage | Wirkung |
|---|---|---|
| P06 Intake Audit | nicht vorliegend | Blockiert die G18-Synthese nicht. Blockiert Sourcecopy, Lizenzannahme, Provenienzfreigabe und Produktadoption eines Prototyppakets. |
| X01 Contract Crosswalk | nicht vorliegend | Blockiert die G18-Synthese nicht. Blockiert die normative Uebernahme von Feldnamen, Statuswerten, IDs, Hashsemantik und Commandformen aus P01 bis P05. |

## 10. Abschlussregel

Bis P06 und X01 vorliegen, duerfen P01 bis P05 nur als isolierte Researchartefakte behandelt werden. `Adapt` autorisiert eine Neuimplementierung des Musters nach akzeptierten Vertraegen, nicht das Kopieren des gelieferten Codes. WP04 und sein paralleler Write-Pfad bleiben ausserhalb jeder Adoption.

