# G18A Storyboard Sequence Delta

**Status:** `REQUIRES_OWNER_DECISION`  
**Quelle:** `BenjaminHornung/Weltraum-Spiel@48fded871345129b606b89344fe3ca3d2fd63715`  
**Source-Status:** `PROPOSED`, `REQUIRES_OWNER_DECISION`, `REQUIRES_SPIKE`, `BLOCKED_BY_PREREQUISITES`

## 1. Delta zu G18

G18A ergänzt einen neuen vorgeschlagenen Authoring-Workspace für zeitlineare Inszenierung. Dieser Workspace ist kein weiterer universeller Graph und kein Ersatz für Story-, Mission- oder Dialogautorität.

`SequenceDocumentV1` ist ein eigenständiger linearer Zeitbereich. Ein Story- oder Missionknoten kann eine Sequenz über `sequenceId` oder eine semantisch gleichwertige `PlaySequence`-Operation referenzieren. Die Sequenz selbst bleibt getrennt.

## 2. Domänengrenzen

| Domäne | Kanonische Verantwortung | Darf nicht durch Sequence übernommen werden |
|---|---|---|
| `StoryGraph` | narrative Zustände und Verzweigungen | Timeline-Keyframes als Storyzustand missbrauchen |
| `MissionGraph` | Missionslogik, Ziele, Bedingungen und Outcomes | Missionserfolg durch Presentation Track direkt setzen |
| `DialogueGraph` | Dialoglogik, Auswahl und Gesprächszustand | Dialogbaum in Clip- oder Markerlisten duplizieren |
| `SequenceDocumentV1` | zeitlineare Inszenierung und semantische Cues | Welt-, Economy-, Mission-, Voxel- oder Movement-Authority übernehmen |

## 3. Vorgeschlagene Artefakte

| Artefakt | Rolle | Status |
|---|---|---|
| `SequenceDocumentV1` | kanonischer Sequenzinhalt | `Research Proposal` |
| `SequenceLayoutV1` | Editorlayout und rein visuelle Metadaten | abgeleitet/authoringbezogen; nicht Teil des semantischen Digests |
| `CompiledSequenceProgramV1` | deterministisch kompiliertes Laufzeitprogramm | Derived Product |
| `SequenceRunStateV1` | persistenter Laufzeitfortschritt | vorgeschlagene Runtime Authority für Sequenzfortschritt |
| `AnimationClipManifestV1` | kanonische Assetmetadaten | Proposal |
| `RigProfileV1` | kanonisches Rig-/Bindingprofil | Proposal |
| GLB, Waveform, Thumbnail | Anzeige- und Laufzeitprodukte | Derived Products, keine Autorität |

## 4. Geschlossene Track-Union

Der Bericht schlägt eine geschlossene, versionierte Track-Union vor:

- Camera
- Presentation Transform
- Animation Clip
- Actor Intent
- Look At
- Dialogue Cue
- Audio
- VFX/Visibility
- Marker
- Semantic Cue

Canonical Documents dürfen keine Funktionen, Scripts, Three.js-Objekte oder engineabhängigen Pfade enthalten.

## 5. Authority- und Mutationgrenze

| Operation | Zulässiger Pfad |
|---|---|
| Kamera, UI- oder rein visuelle Transformabtastung | pure `sample`-Auswertung ohne Side Effects |
| Actor Intent | Übergabe an akzeptierten Actor-/Movement-Command-Pfad |
| Mission-/Story-/Dialogue-Cue | Übergabe an jeweilige Domain, kein direkter State-Write |
| Economy, Inventory, World oder Voxel | ausschließlich Domain Command, Prepare, Approval und Receipt/Outcome |
| Skip | expliziter `SkipPlan`, nicht einfach Seek-to-End |
| Zeitfortschritt | `advance` über ein Intervall mit exakt geordneter Cue-Ausgabe |

`sample` muss pure sein. `advance` muss alle im Intervall fälligen Cues in deterministischer Reihenfolge ausgeben. Skip muss deklarieren, welche semantischen Effekte angewendet, zusammengefasst oder ausgelassen werden dürfen.

## 6. Zeitdomäne

Die Sequenz benötigt eine eigene `SequenceTick`-Domäne. Der Bericht nennt 48.000 Ticks pro Sekunde als Spike-Default, nicht als akzeptierten Produktwert. Diese Zahl darf erst nach Ownerentscheid und Timing-/Asset-Evidence in einen verbindlichen Contract gelangen.

## 7. Prerequisites und Realisierungsgates

| Gate | Inhalt | Aktueller Status |
|---|---|---|
| SEQ-00 | Contract Freeze | blockiert durch Ownerentscheidungen, X01, G03A, gemeinsamen Kernel und G05 |
| SEQ-01 | isoliertes Document-/Compiler-Fixture | noch nicht autorisiert |
| SEQ-02 | Editor-UX und deterministic preview | noch nicht autorisiert |
| SEQ-03 | Runtime Player und Run State | nachgelagert |
| SEQ-04 | Domain Cue Adapter | nach akzeptierten gemeinsamen Contracts |
| SEQ-05 | Integration und Evidence | erst nach Mainline- und Owner-Gates |

D-037 gilt vor jedem ersten Write zusätzlich und unabhängig.

## 8. Explizite Nichtziele

- kein Mega-Graph;
- keine Verschmelzung mit Mission-, Story- oder DialogueGraph;
- kein Root-Motion-Vertrag in V1;
- kein In-Browser-Bone-Editor;
- kein Enginewechsel;
- keine direkte KI-Mutation;
- keine Produktimplementierung durch dieses Addendum;
- keine Adoption der P05-Distribution.

## 9. Produkt-Main-Grenze

Am gebundenen Produkt-Main-Stand existiert kein belegtes `SequenceDocumentV1`-System. Vorhandene Mission- oder Renderingfunktionen sind keine Sequence-Implementierung. Der Storyboard-Bericht bleibt ein branchgebundener Research Proposal.

## 10. Ergebnis

Die vorgeschlagene Sequenzdomäne ist fachlich ausreichend klar, um nach einem Owner-Freeze einen kleinen Contract-Spike zu definieren. Derzeit ist sie nicht write-ready und nicht als Produktfeature akzeptiert.

