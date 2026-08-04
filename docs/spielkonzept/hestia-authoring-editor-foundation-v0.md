# Hestia Authoring Editor Foundation V0

Stand: 2026-07-28

Status: Entscheidungsreifer Docs-only-Vorschlag; keine Runtime-Spec, keine
Implementierungsfreigabe und keine Änderung an V3.1

## 1. Entscheidungsvorlage

Hestias Städte, Straßen, Parzellen, Gebäudegruppen und gestaltete
Vegetationsräume sollen nicht vollständig in Produktcode codiert und auch
nicht bei jedem Runtime-Start neu erfunden werden. Empfohlen wird deshalb ein
eigener Creative-/City-Builder-Arbeitsbereich, in dem Benutzer und Agenten
versionierten authored Content erzeugen. Der Editor arbeitet auf einem
unveränderlichen prozeduralen Basissnapshot, hält Änderungen zunächst in einer
Working Copy und exportiert erst nach expliziter menschlicher Annahme ein
renderer-neutrales `AuthoredWorldOverlay`.

Die zentrale Produktentscheidung lautet:

> Generatoren und Agenten dürfen Vorschläge erzeugen. Nur ein explizites
> `Human Accept` darf eine validierte, versionierte Overlay-Revision schreiben.

Damit bleiben drei Arten von Wahrheit getrennt:

1. der reproduzierbare prozedurale Basissnapshot,
2. das bewusst angenommene authored Overlay und
3. spätere persistente Spieler-, Zustands- und Zerstörungsdeltas.

Diese Vorlage empfiehlt einen neuen renderer-neutralen Authoring-Kern unter
`apps/weltraum-browser/src/authoring/`. Eine Runtime-Anbindung wird ausdrücklich
zurückgestellt, bis der Owner für `WorldTemplate`/`WorldInstance` und die
Präzedenz der drei Schichten genehmigt sind. Der normale Surface-Play-Pfad
erhält keine Creative-Kommandos, keine Cheat-Schnittstelle und keinen
Runtime-Stadtgenerator.

## 2. Problem, Ziele und Nicht-Ziele

### 2.1 Problem

Die heutige Hestia-Runtime kann deterministische Terrain-, Wasser- und
Population-Fakten erzeugen. Es gibt aber noch keinen Vertrag, mit dem Menschen
oder Agenten eine Stadt über mehreren Arbeitsschritten gestalten, prüfen,
versionieren und reproduzierbar laden können. Würden Gebäude, Straßen und
Vegetationskompositionen direkt in Bootstrap-, Scene- oder Three-Code
geschrieben, entstünden schwer reviewbare Sonderfälle und eine zweite,
renderergebundene World Authority.

### 2.2 Ziele

- Direkte Auswahl, Platzierung und Bearbeitung vordefinierter modularer
  Gebäude und Vegetation.
- SimCity-ähnliche, kontrollierte Gestaltung von Straßen, Parzellen,
  Distrikten, Biom- und Ausschlussflächen.
- Deterministische Hilfen für Wiederholung und Verteilung, deren Ergebnis vor
  Annahme vollständig als Diff sichtbar ist.
- Gemeinsame Arbeit von Mensch und Agent mit stabilen IDs, kleinen
  Git-freundlichen Manifesten, Provenienz und strikter Konflikterkennung.
- Ein exportierbares Overlay, das World/Runtime unveränderlich lädt und das
  Three/DOM nur präsentiert.
- Ein kleiner Coast/Lush-MVP, mit dem Datenmodell, Workflow und Budgets vor
  einer größeren Stadt belegt werden.

### 2.3 Nicht-Ziele

- Keine Änderung oder Erweiterung des laufenden V3.1-Surface-Play-Vertrags.
- Kein prozeduraler Runtime-Stadtgenerator.
- Keine implizite Annahme eines Agenten- oder Generatorergebnisses.
- Keine Creative-Kommandos im normalen Surface Play.
- Keine Three-Szene, DOM-Struktur, GLB-Meshgrenze oder Collider-Geometrie als
  World Authority.
- Keine Vermischung des authored Overlays mit persistenten Spieler-,
  Besitz-, Schadens- oder Zerstörungsdeltas.
- Kein globaler Planeteneditor, Multiuser-Live-Editing, Economy-Simulator,
  Straßenverkehr, Strom-/Wassernetz oder vollständige Planetenstreaming-Lösung
  im MVP.
- Keine autonome oder vollständige prozedurale Stadtgeneration und kein
  Multiplayer-/Live-Coauthoring im MVP. Deterministische Helfer bleiben
  begrenzte Preview-Werkzeuge innerhalb einer vollständig hand-authored Stadt.
- Kein `window.TestBridge`, Gameplay-Cheat oder versteckter Editorzugriff als
  Abnahmemechanismus.
- Kein neuer generischer `Normalize*`-/`Canonicalize*`-Layer. Werte werden am
  jeweiligen Parser-/Command-Boundary strikt geprüft; kanonische Ausgabe ist
  eine explizite Overlay-Vertragsfunktion.

## 3. Repository-Evidence und Reuse-Matrix

| Evidence-Pfad | Belegter, wiederverwendbarer Beitrag | Grenze oder Unsicherheit |
| --- | --- | --- |
| `docs/spielkonzept/hestia-biome-design-foundation-v0.md` | Authored Städte kommen später von Benutzer und Agenten; Straßen-, Parzellen-, Gebäude- und Vegetationsvorschläge bleiben bis `Human Accept` Preview. Editor und Surface Play sind getrennt. | Docs-only; legt keine IDs, Schemas, Speicherorte oder Runtime-Anbindung fest. |
| `docs/browser-mainline/hestia-first-person-combat-slice-v1-recovery-execplan.md` | V3.1 schließt Creative/City Builder, authored Persistence und Biome-Placement explizit aus. Ein paralleles Planungsartefakt darf Command History, Overlay, Building Kits und MVP entscheiden. | Die laufende Recovery besitzt Priorität. Diese Vorlage darf weder deren Contracts noch Tasks verändern. |
| `docs/architecture/surface-local-frame-architecture.md` | Stabile `SurfaceLocalFrame`-Identität und Achsen: `+X` rechts, `+Y` oben, `+Z` vorwärts; lokale Positionen werden über Frame und Planet in Absolute Space aufgelöst. | Nur Architekturvorschlag. Große Städte benötigen möglicherweise mehrere Frames/Subframes; V0 darf das nicht still entscheiden. |
| `docs/architecture/procedural-voxel-planet-runtime.md` | World/Voxel bleibt rendererneutral; authored Hotspot-Overlays referenzieren stabile IDs, Frames, Bounds und semantische Zustände. GLB/LOD/Schadensdarstellungen sind Projektionen. | `AuthoredHotspotOverlay`, Stadt-Compiler und persistente Voxel-/Strukturdeltas sind noch nicht implementiert. |
| `docs/architecture/voxel-asset-authoring-and-compilation.md` | GLB/glTF, Source Hash, Tool-Version, Provenienz und semantische Metadaten werden an einer kontrollierten Compilergrenze geprüft; Collision/Nav und Voxel sind abgeleitete Produkte statt Mesh-Authority. | Produktive GLB-to-Voxel-, Collision- oder Nav-Bakes sind nicht vorhanden und werden durch den Editorplan nicht als implementiert behauptet. |
| `docs/architecture/world-template-instance-online-offline-transition.md` | `WorldTemplate` ist die unveränderliche Basis, `WorldInstance` trägt revisionsgebundene Deltas; Migrationen müssen deterministisch und fail-closed sein. | Im Browser existiert noch kein beschlossenes `WorldTemplate`-/`WorldInstance`-Schema und kein Owner für die Overlay-Präzedenz. |
| `docs/architecture/world-runtime-render-backend-boundary.md` | Runtime liefert immutable, revisionsgebundene Snapshots/Artefakte; Three und DOM sind ausschließlich Projektionen. | Es gibt noch keinen Authoring-Projection-Port. |
| `docs/browser-mainline/voxel-representation-ladder-v2.md` | Repräsentationsstufen, Revision-Pins, stabile IDs, Content Hashes und atomarer Fallback sind geeignete Muster für Building-Kit-LOD-Projektionen. | Die Ladder ist noch kein Runtime-Consumer und darf nicht als Building-Kit- oder Kollisionsvertrag umgedeutet werden. |
| `docs/roadmap/living-master-plan.md` | Authored Städte als Overlay über prozeduraler Basis sind Roadmap-Richtung; `WorldTemplate`/`WorldInstance` bleiben offene Foundation-Arbeit. | Roadmap ist kein freigegebener öffentlicher Vertrag. |
| `apps/weltraum-browser/src/persistence/canonical.ts` | Sortierte Objektschlüssel, endliche JSON-Werte, Deep Freeze und reproduzierbare Signatur sind ein reifes Serialisierungsmuster. | `SaveGameEnvelopeV1` darf nicht um Authoring-Felder erweitert werden. Overlay benötigt eine neue domainspezifische kanonische Funktion. |
| `apps/weltraum-browser/src/persistence/migrations.ts` | Immutable Registry, lückenlose Einzelversionsschritte, Quell-/Zielvalidierung und fail-closed Verhalten sind direkt übertragbare Migrationsprinzipien. | Eine neue Overlay-Registry ist eine neue Migrationsgrenze; V1 hat noch keinen historischen Migrationsschritt. |
| `apps/weltraum-browser/src/persistence/saveSchema.ts` | Strikte Allowed-Field-Prüfung, stabile IDs und eingefrorene Parse-Ergebnisse sind geeignete Boundary-Regeln. | Das Save-Game-Schema ist nicht Owner des Authoring-Projekts oder Overlays. |
| `apps/weltraum-browser/src/ship-builder/ids.ts` | Gebrandete, validierte, begrenzte stabile IDs sind ein reifes lokales Muster. | Ship-Builder-ID-Typen dürfen nicht für Gebäude oder Straßen wiederverwendet werden; Authoring braucht eine neue ID-Familie. |
| `apps/weltraum-browser/src/ship-builder/types.ts` | Lokale Transforms, Footprints, Varianten, Asset-Referenzen, Sockets und Catalog/Instance-Trennung zeigen eine bewährte Vertragsteilung. | Part-, Component- und Socket-Semantik ist raumschiffspezifisch und wird nicht geerbt. |
| `apps/weltraum-browser/src/ship-builder/sockets.ts` | Sockets werden vollständig validiert; fehlende Werte werden nicht erfunden; Position, Rotation und Richtung sind lokale Daten. | Building Sockets brauchen eigene Rollen wie Eingang, Straßenkante, Anbau und Hero Anchor. |
| `apps/weltraum-browser/src/ship-builder/serialization.ts` | Parser lehnt Zukunftsversionen ab, migriert schrittweise und liefert unveränderliche kanonische Snapshots. | Building-Kit- und Overlay-Serializer sind neue Contracts, keine neuen Fälle im Ship Builder. |
| `apps/weltraum-browser/src/world-generation/hestia/seed.ts` | ASCII-Seeds, benannte Seed-Domänen, sichere Koordinaten und deterministische Hashableitung sind ein konkretes Muster. | Authoring-Helfer benötigen eigene benannte Seed-Domänen und Tool-Versionen; Hestia-Terrain-Seeds dürfen nicht zweckentfremdet werden. |
| `apps/weltraum-browser/src/world-generation/hestia/scatterGenerator.ts` | Deterministische Kandidaten, stabile IDs und explizite Endsortierung belegen reproduzierbare Vegetationsverteilung. | Der aktuelle Scatter ist neutrale Präsentationspopulation und kein akzeptiertes authored Overlay. |
| `apps/weltraum-browser/src/surface-play/world/hestiaSurfaceWorld.ts` | World-owned Identität, Traversal Domain, Shore Boundary, Population, Collision-relevante Facts, Revision und lokale Meterkoordinaten sind aktuelle Runtime-Evidence. | Der Slice ist `64 x 32 x 64 m` groß und kein Stadt- oder Editorvertrag. Seine Typen werden nicht erweitert. |
| `apps/weltraum-browser/src/presentation/` und `apps/weltraum-browser/src/render/three/` | Bestehende Trennung von Presentation-Artefakten und Three-Backend ist der Zielpfad für eine spätere Editor-/Runtime-Projektion. | Konkrete Authoring-Render-Commands und Asset Registry fehlen. |
| `apps/weltraum-browser/src/main.ts` und `apps/weltraum-browser/src/surface-play/surfacePlayQuery.ts` | Der Browser besitzt bereits einen expliziten Route-Boundary für Surface Play. | Name, Zugriffsschutz und Bootstrap eines separaten Authoring-Einstiegs sind noch zu genehmigen. |
| `docs/UI-Screenshots/19-lokale-karte-siedlung-outpost.png`, `30-hestia-biom-atlas-regionen.png`, `36-hestia-archipel-landschaft-konzept.png` und `38-hestia-nebelwald-outpost-konzept.png` | Inventarisierte visuelle Referenzen für Siedlungslesbarkeit, Hestia-Biome, Küstenform und authored Outpost-Stimmung. | Concept Art definiert keine Placement-Metrik, kein Schema, keine World Truth und keine Runtime-Evidence; die Foundation leitet daraus keine versteckte Fachlogik ab. |

### 3.1 Reuse-Urteil

Wiederverwendet werden Prinzipien und kleine neutrale Hilfen: strikte Parser,
Deep Freeze, stabile IDs, kanonische Sortierung, lückenlose Migration,
Seed-Domänen, revisionsgebundene Snapshots und Presentation-Ports.

Nicht wiederverwendet werden die fachlichen Verträge von Save Game, Ship
Builder, Hestia Scatter oder Surface Play. Insbesondere ist ein Building Kit
kein `PartDefinition`, ein Gebäude-Socket kein `PartSocket` und ein Overlay
kein Save-Game-Feld.

## 4. Autorität und Schichten

### 4.1 Empfohlene Zuständigkeit

| Schicht | Owner | Darf schreiben | Darf nicht |
| --- | --- | --- | --- |
| `ProceduralBaseSnapshot` | World/Voxel/Generator | Nur der versionierte Generator bzw. spätere `WorldTemplate`-Compiler. | Editor, Agent, Three oder DOM verändern den Snapshot nicht. |
| `EditorWorkingCopy` | Authoring Core | Validierte Editor-Transaktionen und explizit angenommene Preview-Operationen. | Keine Runtime- oder Spielerwahrheit; kein Export ohne vollständige Validierung. |
| `AuthoredWorldOverlay` | World-Authoring-Vertrag | Ausschließlich `Human Accept` plus erfolgreicher Export. | Keine stillen Generatorwrites und keine persistenten Schadens-/Spielerdeltas. |
| `PersistentInstanceDeltas` | spätere WorldInstance-/Gameplay-Authority | Spielerzustand, Besitz, Schaden, Zerstörung und vergleichbare fortlaufende Zustände. | Keine Rückschreibung in Basis oder authored Overlay. |
| `RuntimeWorldSnapshot` | World/Runtime | Immutable Komposition der genehmigten Schichten nach expliziter Präzedenz. | Keine Bearbeitung über Three-Objekte oder Editor-Commands. |
| `Presentation` | Presentation/Three/DOM | Abgeleitete Render-, Auswahl-, Gizmo- und UI-Artefakte. | Keine World-, Collision-, Placement- oder Save-Authority. |

### 4.2 Präzedenz

Der empfohlene, aber noch genehmigungspflichtige Kompositionsweg ist:

```text
ProceduralBaseSnapshot
  + AuthoredWorldOverlay (Mask/Add/Replace nur an explizit erlaubten Targets)
  + PersistentInstanceDeltas (spätere Instanzrevision, nie Teil des Editors)
  -> RuntimeWorldSnapshot
  -> PresentationSnapshot / RenderCommands
  -> Three + DOM
```

Ein Overlay darf die Basis nur über deklarierte Masken, Platzierungen und
semantische Referenzen ergänzen oder ausblenden. Es darf weder Generator-Seed
noch Basissnapshot umschreiben. Player-/Destruction-Deltas adressieren stabile
Overlay- oder Basis-Targets und werden beim Editieren nicht mitgespeichert.
Kann eine Ziel-ID oder Basisrevision nicht exakt aufgelöst werden, ist Laden
oder Rebase `Blocked`, nicht best effort.

## 5. Vollständiger Authoring- und Runtime-Flow

```text
[versionierter ProceduralBaseSnapshot + Frame/Revision/Hash]
                            |
                            v
          [AuthoringProject + EditorWorkingCopy]
                            |
             Editor-Commands in Transaktionen
                            |
                            +-------------------------+
                            |                         |
                            v                         v
                  [direkte Änderung]      [deterministischer Helper/Agent]
                                                      |
                                                      v
                                            [SuggestionPreview]
                                            Diff + Budget + Diagnose
                                                      |
                                         Reject ------+------ Lock
                                                      |
                                                      v
                                          explizites Human Accept
                                                      |
                                                      v
                                      [eine atomare CommandTransaction]
                            |                         |
                            +-------------------------+
                            |
                            v
       Schema + Referenzen + Geometrie + Konflikte + Budgets validieren
                            |
                 Fehler -> Working Copy bleibt, Export stoppt
                            |
                            v
        kanonisches, diff-freundliches AuthoredWorldOverlay-Paket
            + Content Hash + Exportreport + Provenienz-Sidecar
                            |
                 separater Runtime-Integrationsgate
                            |
                            v
       immutable Base + Overlay (+ spätere Instance Deltas) laden
                            |
                            v
          RuntimeWorldSnapshot -> Presentation -> Three/DOM
```

Wichtige Flow-Regeln:

- Ein Vorschauobjekt ist weder Working-Copy-Änderung noch Overlay.
- `Accept` erzeugt genau eine atomare Transaktion gegen eine bekannte
  Working-Copy-Revision. Eine veraltete Preview muss neu berechnet werden.
- `Save Project` speichert Arbeitszustand; `Export Overlay` schreibt nur einen
  vollständig validierten Accepted State.
- `Play Preview` kompiliert einen unveränderlichen temporären Snapshot im
  separaten Authoring-Arbeitsbereich. Es schreibt weder Overlay noch
  Surface-Play-State.
- Runtime lädt nur exportierte Overlay-Releases, niemals offene Projekte,
  Command History oder Suggestion Previews.

## 6. Vorgeschlagenes Datenmodell und neue Vertragsgrenzen

Alle folgenden Verträge sind Vorschläge. Kein Name ist heute öffentlicher
Runtime-Vertrag.

### 6.1 Vertragsinventar

| Vertrag | Einstufung | Konsumenten | Migration |
| --- | --- | --- | --- |
| `AuthoringStableIdsV1` | **[NEUER VERTRAG]** renderer-neutrale ID-Familien für Overlay, Entity, Kit, Asset, Frame-Ref, Transaction, Preview und Provenienz. | Authoring Core, Compiler, Loader. | IDs selbst werden nie umgeschrieben; Schemaänderungen migrieren Container. |
| `AuthoringProjectV1` | **[NEUER VERTRAG]** editorinterner, persistierbarer Arbeitszustand. Kein Runtime-Input. | Editor Core und Projekt-Storage. | **[NEUE MIGRATIONSGRENZE]** eigene lückenlose Project-Registry. |
| `AuthoringCommandTransactionV1` | **[NEUER VERTRAG]** validierte Working-Copy-Operationen mit Preconditions. | Editor Core, Undo/Redo, Collaboration. | Teil der Project-Migration; kein Overlay-Bestandteil. |
| `SuggestionPreviewV1` | **[NEUER VERTRAG]** flüchtiger, reproduzierbarer Vorschlagsdiff. | Helper/Agent, Review UI. | Nicht langfristig migriert; veraltete Tool-Version muss neu previewen. |
| `BuildingKitCatalogV1` | **[NEUER VERTRAG]** vorgefertigte Building-, Prop- und Vegetation-Definitionen mit Varianten, Footprints/Clearance, Placement-Regeln und Asset-/Runtime-Refs. | Palette, Validator, Compiler, Runtime Loader. | **[NEUE MIGRATIONSGRENZE]** eigene Catalog-Registry. |
| `AuthoredWorldOverlayV1` | **[NEUER ÖFFENTLICHER VERTRAG]** kanonischer renderer-neutraler authored Content. | World Compiler/Loader und Editor. | **[NEUE MIGRATIONSGRENZE]** eigene Overlay-Registry; V1 ist Startversion ohne Altstep. |
| `AuthoringProvenanceV1` | **[NEUER TEILVERTRAG]** reproduzierbare Actor-/Tool-/Seed-/Input-Herkunft für akzeptierten Content. | Overlay, Editor, Review. | Wird zusammen mit der referenzierenden Overlay-Version migriert. |
| `AuthoringBudgetProfileV1` | **[NEUER VERTRAG]** versionierte Admission Caps ohne automatische Contentreduktion. | Validator, Helper, Compiler. | Profile sind immutable und werden über neue ID/Version ersetzt, nicht in-place migriert. |
| `AuthoringValidationReportV1` | **[NEUER ARTEFAKTVERTRAG]** geordnete Diagnosen, Budgetmessung und Input-/Output-Hashes. | Editor, CI, menschliches Review. | Report ist regenerierbar und kein Runtime-Save; Schema-Version bleibt trotzdem explizit. |
| `AuthoredOverlayRuntimeLoadResultV1` | **[NEUER ZUKÜNFTIGER PORTVERTRAG]** immutable World-Facts oder fail-closed Diagnose. | World/Runtime. | Erst nach WorldTemplate-/WorldInstance-Freigabe; nicht Teil des Editor-MVP. |

Keiner dieser Verträge wird in `SaveGameEnvelopeV1`, Ship Builder oder V3.1
eingeschoben. Jede Implementierung beginnt mit isolierten Golden Fixtures und
einer öffentlichen Impact-Freigabe.

### 6.2 IDs, Versionen und deterministische Ordnung

- Jede serialisierte Root besitzt `schemaVersion`, eine stabile Root-ID und
  eine fachliche `contentVersion`.
- IDs sind opake ASCII-Tokens mit maximal 128 Zeichen. Vorgeschlagenes
  Allocationsmuster:
  `authoring:<authorNamespace>:<entityKind>:<base36Counter>`.
- `authorNamespace` und nächster Counter sind Teil des Authoring-Projekts.
  Duplizieren allokiert aus der aktuellen Transaktion; es wird niemals aus
  Display Name oder Arrayposition abgeleitet.
- Parser prüfen IDs einmal am Owning Boundary und liefern gebrandete,
  unveränderliche Werte. Es gibt keinen nachträglichen ID-Normalizer.
- Root-Referenzlisten sind nach stabiler ID in ASCII-Reihenfolge sortiert.
  Geometrische Punkte behalten semantische Reihenfolge; ungeordnete Tags und
  Referenzen werden als sortierte, duplikatfreie Arrays validiert.
- Der Content Hash umfasst ausschließlich kanonischen Runtime-Content.
  lokale UI-Auswahl, Dateizeit, Fensterlayout, Undo Cursor und frei
  formulierter Review-Text sind Sidecar-/Project-Metadaten.

Die konkrete Namespace-Vergabe ist vor Implementierung zu genehmigen. Der
Parser behandelt IDs bereits in V1 als opak, sodass der Inhalt später nicht
wegen eines schöneren ID-Formats migriert werden muss.

### 6.3 `AuthoringProjectV1`

Vorgeschlagene Root-Felder:

| Feld | Inhalt |
| --- | --- |
| `schemaVersion`, `projectId`, `projectVersion` | explizite Projektgrenze und stabile Identität |
| `baseSnapshotRef` | `worldTemplateId` oder vorläufige Fixture-ID, Generator-/Compiler-Version, `baseRevision`, `baseContentHash` |
| `surfaceFrameRefs` | erlaubte Frame-IDs mit Revision und Hash; keine kopierte Three-Matrix |
| `acceptedOverlayRef` | zuletzt exportierte Overlay-ID, Version und Hash oder `null` |
| `workingRevision` | strikt monoton innerhalb des Projekts |
| `workingEntities` | renderer-neutrale Arbeitskopie, intern nach ID indexiert |
| `transactions`, `undoCursor` | atomare Command History; Redo-Zweig wird bei neuer Änderung explizit verworfen |
| `suggestionPreviews` | flüchtige oder kurzlebige Preview-Refs; nicht Runtime-relevant |
| `authorNamespaces` | reservierte menschliche/agentische Namespaces und nächste Counter |
| `editorSettings` | Snap-/Grid-/Sichtbarkeitspräferenzen; nicht Teil des Overlay-Hashes |

`Save Project` schreibt atomar eine neue Projektdatei oder einen
projektinternen Snapshot. Ein unvollständig geschriebenes Projekt ersetzt nie
die letzte gültige Revision.

### 6.4 `AuthoredWorldOverlayV1`

Vorgeschlagene Root-Felder:

| Feld | Inhalt |
| --- | --- |
| `schemaVersion`, `overlayId`, `overlayVersion` | neue Overlay-Vertragsversion und fachliche Release-Identität |
| `worldTemplateRef` | Base-ID, Base-Version, Generator-/Compiler-Version und exakter Base-Hash |
| `surfaceFrameRefs` | Frame-ID, Frame-Revision und Frame-Hash der verwendeten lokalen Räume |
| `buildingKitCatalogRefs` | Catalog-ID, Content-Version und Hash |
| `budgetProfileId` | explizit genehmigtes Budgetprofil |
| `layers` | kleine geordnete Layer-Manifeste |
| `placements`, `roads`, `parcels`, `districts`, `waterAreas`, `masks`, `heroLocks` | Root-Referenzen auf einzelne Entity-Dateien |
| `provenanceRef` | Hash eines getrennten Provenienzmanifests |
| `contentHash` | Signatur über Root plus alle referenzierten kanonischen Inhalte |

Der Root enthält Referenzen und Hashes, nicht tausende eingebettete Objekte.
Jede Entity-Datei besitzt genau eine stabile Haupt-ID. Dadurch können Mensch
und Agent an disjunkten Entities arbeiten, ohne ein gemeinsames Groß-JSON neu
zu formatieren.

### 6.5 Frames und lokale Transforms

Jede räumliche Entity besitzt:

```text
surfaceFrameId
localPositionMeters { x, y, z }
localRotation { x, y, z, w }
uniformScale
```

`localRotation` ist ein endliches, normalisiertes Quaternion im Vertrag;
Editor-Gizmos dürfen Yaw/Pitch/Roll anzeigen. Die Achsen folgen
`SurfaceLocalFrame`: `+X` rechts, `+Y` oben, `+Z` vorwärts. Der V0-Editor
schreibt keine absoluten Planet-/Three-Koordinaten.

Empfehlung für V1:

- Gebäude erlauben nur die in der Kit-Variante deklarierte Menge diskreter
  uniformer Skalierungen; MVP standardmäßig nur `1`.
- Straßenpunkte, Parcel-/District-Polygone und Masken skalieren nicht.
- Vegetationsvarianten dürfen eine begrenzte, im Kit deklarierte diskrete
  Skalenmenge besitzen.
- Terrain Fit wird beim Platzieren und Export gegen den World-owned
  Basissnapshot geprüft. Ein Mesh-Raycaster ist kein Höhen- oder
  Kollisionsbeweis.

Framewechsel einer Entity ist kein normales Move, sondern eine explizite
`ReframeEntity`-Migration mit Roundtrip- und Toleranzprüfung. Sie bleibt
außerhalb des MVP.

### 6.6 Layer

`AuthoringLayerV1` **[NEUER TEILVERTRAG DES OVERLAYS]** enthält `layerId`,
Name, Sortierordnung, Sichtbarkeit im
Editor, Export-Status und eine geschlossene semantische Rolle:
`Buildings`, `Props`, `Roads`, `Parcels`, `Districts`, `Water`, `Vegetation`,
`BiomeMasks`, `ExclusionMasks` oder `Hero`. Sichtbarkeit und Lock im Viewport sind
Editorzustand; `exportEnabled` ist authored Content.

Eine Entity gehört genau einem Layer. Layer ändern keine fachliche Authority
und ersetzen keine District-/Maskenzuordnung.

### 6.7 Platzierungen

`AuthoredPlacementV1` **[NEUER TEILVERTRAG DES OVERLAYS]** enthält:

- `placementId`, `layerId`, `surfaceFrameId`,
- genau eine `buildingDefinitionId`, `propDefinitionId` oder
  `vegetationDefinitionId` plus `variantId`,
- lokalen Transform,
- optional `parcelId`, `districtId`,
- optionale deklarierte Snap Bindings von Placement-Socket zu
  Road-/Parcel-/Hero-Socket,
- `placementMode` (`Direct`, `SuggestionAccepted`, `Imported`),
- `provenanceId`,
- optionale semantische Tags; keine Renderobjekt-ID.

Footprint, Collider, Destruction und LOD werden über versionierte Definitionen
referenziert und nicht aus dem sichtbaren Mesh zurückgerechnet.

### 6.8 Straßen, Parzellen und Distrikte

`AuthoredRoadV1` **[NEUER TEILVERTRAG DES OVERLAYS]** ist ein kleiner
gerichteter oder bidirektionaler Graph:
stabile Node-IDs mit lokalen Punkten und Edge-IDs mit geordneter Centerline,
Straßenprofil-ID, Breite, Anschluss-Sockets und erlaubten Höhen-/Steigungs-
grenzen. Der MVP braucht eine bidirektionale Straße ohne Kreuzungsautomation.

`AuthoredParcelV1` **[NEUER TEILVERTRAG DES OVERLAYS]** enthält eine stabile
ID, ein einfaches geschlossenes
Polygon im Surface Frame, `roadEdgeRefs`, Setback-Regel und optionale
District-Zuordnung. Selbstüberschneidung, falsche Orientierung, zu kleine
Kanten und Überlappungen oberhalb der genehmigten Toleranz blockieren Export.

`AuthoredDistrictV1` **[NEUER TEILVERTRAG DES OVERLAYS]** enthält ID, Name,
optionales Begrenzungspolygon,
Parcel-Referenzen, erlaubte Building-Kit-Tags und Biome-/Gestaltungsprofil.
Districts sind Gestaltungshilfe, keine Economy- oder Governance-Simulation.

### 6.9 Authored Water Area

`AuthoredWaterAreaV1` **[NEUER TEILVERTRAG DES OVERLAYS]** beschreibt
ausschließlich den bewusst gestalteten Wasser-Intent einer Stadt: stabile ID,
Layer, Surface Frame, einen einfachen geschlossenen Polygonring,
`waterProfileRef`, quantisierte Sollhöhe oder Offset zur gepinnten
Basis-Wasserhöhe, Shore-Clearance und Provenienz. Der MVP erlaubt genau eine
kleine Fläche ohne Strömung, Tide, Kanalnetz, Terrain-Carving oder
Hydrologiesimulation.

Die authored Fläche ist noch kein Water-/Shore-, Collision- oder
Traversal-Fakt. Erst ein World-owned Compiler prüft sie gegen Basisrevision,
Terrain und Wasserprofil und erzeugt revisionsgebundene Runtime-Fakten oder
eine fail-closed Diagnose. Editor, Three-Mesh, Material und sichtbare
Wasseroberfläche dürfen diese Prüfung nicht ersetzen.

### 6.10 Biom- und Ausschlussmasken

Für V1 wird ein gemeinsamer `AuthoringMaskV1`
**[NEUER TEILVERTRAG DES OVERLAYS]** mit stabiler ID, Frame, Maskenrolle,
einfachen lokalen Polygonringen und Priorität empfohlen:

- `BiomeOverride`: weist innerhalb der Fläche ein genehmigtes Biome-Profil zu,
- `ExcludeProceduralVegetation`,
- `ExcludeBuildingPlacement`,
- `ExcludeRoadPlacement`,
- `ReserveHeroSpace`.

MVP unterstützt pro Maske genau einen einfachen äußeren Ring ohne Löcher.
Mehrteilige Polygone, Raster-Painting und planetenweite Masken sind später.
Der Editor darf Brush-Strokes anbieten, muss sie aber vor Preview in
explizite, validierbare Polygon-Commands übersetzen. Der Compiler erzeugt
gegebenenfalls rasterisierte/gekachelte Ableitungen; diese sind nicht die
authored Wahrheit.

Masken ersetzen keine bestehenden Voxel oder persistenten Deltas. Der
Runtime-Compiler entscheidet ausschließlich gemäß genehmigter Maskenrolle,
welche Basis-Population ausgeblendet oder welches Biome-Profil projiziert wird.

### 6.11 Hero Sockets und Locks

`HeroSocketV1` **[NEUER TEILVERTRAG DES BUILDING KITS]** ist ein
Building-Kit- oder Site-Socket mit stabiler ID, lokalem Transform, erlaubten
Kategorien und optionalem Approach-/Clearance-Volumen.
Ein Hero Socket markiert einen bewusst gestalteten Fokuspunkt, nicht bereits
ein Gameplay-Feature.

`HeroLockV1` **[NEUER TEILVERTRAG DES OVERLAYS]** enthält `lockId`, stabile
Target-Referenz, `lockMode`
(`Transform`, `Topology`, `Content` oder `All`), Begründung und Provenienz.
Generatoren und Agenten müssen Locks als harte Inputs behandeln. Unlock ist
eine eigene menschlich bestätigte Transaktion; kein Helper darf einen Lock
automatisch entfernen.

### 6.12 Seeds, Tools und Provenienz

`AuthoringProvenanceV1` **[NEUER TEILVERTRAG DES OVERLAYS]** enthält:

- `provenanceId`,
- Actor-Klasse (`Human`, `Agent`, `Tool`, `Import`) und opake Actor-ID,
- `toolId`, `toolVersion`, benannte `seedDomain` und Seed, falls relevant,
- Input-Hashes für Basis, Overlay, Catalog und Lock Set,
- Quell-Transaction-/Preview-IDs,
- optionalen Review-/Ticket-Verweis als Sidecar-Metadatum.

Wall-Clock-Zeit ist Auditmetadatum, aber kein Input des Content Hash. Gleiche
Inputs, Seed-Domäne, Tool-Version und akzeptierte Operationsliste müssen den
gleichen Overlay-Inhalt und Hash erzeugen.

### 6.13 Budgets und Diagnosen

Das Overlay referenziert ein versioniertes Budgetprofil. Der Validator erzeugt
`AuthoringValidationReportV1` mit:

- Input- und Output-Hash,
- tatsächlichen Entity-, Vertex-, Socket-, Asset- und Byte-Zahlen,
- geordneten Issues mit stabilem Code, Severity, Entity- und Pfadreferenz,
- Ergebnis `Valid`, `Invalid` oder `BudgetExceeded`,
- Compiler-/Validator-Version.

Diagnosen werden nicht in das Overlay zurückgeschrieben. Warnings müssen
explizit reviewbar sein; Errors und Budgetüberschreitungen blockieren Export.

## 7. Editor-Command-Modell

### 7.1 Commands

Der V1-Command-Satz:

| Bereich | Commands |
| --- | --- |
| Auswahl | `SetSelection`, `AddToSelection`, `ClearSelection`; nur Session/Project, nicht Overlay |
| Platzierung | `PlaceEntity`, `PlaceOnSocket`, `PlaceOnParcel` |
| Transform | `MoveEntity`, `RotateEntity`, `SetPlacementHeight`, `SetAllowedScale`, `SnapEntity` |
| Struktur | `DuplicateEntities`, `DeleteEntities`, `AssignLayer`, `SetLayerExportEnabled` |
| Straßen/Flächen | `CreateRoad`, `EditRoadPoint`, `CreateParcel`, `CreateWaterArea`, `EditPolygonPoint`, `CreateMask` |
| Locks | `CreateHeroLock`, `RemoveHeroLock` |
| Vorschläge | `AcceptSuggestionOperations`; Reject verändert nur Preview-Status |
| Projekt | `SaveProject`, `LoadProject`, `ImportPackageAsPreview`, `ExportOverlay`; diese orchestrieren Boundary-Funktionen und sind keine direkte Overlay-Entity-Mutation |

Jeder mutierende Command trägt `commandId`, `transactionId`,
`expectedWorkingRevision`, Target-IDs und explizite Vorherbedingungen. Er wird
zuerst vollständig validiert und dann atomar angewendet. Teilmutation ist
verboten.

### 7.2 Raster, Snapping, Rotation und Höhe

V1-Snap-Modi sind explizit und kombinierbar:

- lokale Meter-/Winkelraster,
- Terrain-Fit gegen World Probe,
- Building-/Hero-Socket,
- Straßenkante oder Parcel-Anker,
- Ausschlussmasken als harte Ablehnung.

Die UI zeigt Quelle, Ziel und resultierenden Transform vor Commit. Ein Snap,
dessen Target-Revision nicht mehr passt, wird nicht angenähert, sondern
abgelehnt. Rasterweite, Winkelschritt und Höhenstufe sind explizite
Project-/Session-Einstellungen mit endlichen, positiv begrenzten Werten; sie
werden nicht aus Zoom oder Meshgröße abgeleitet. Rotation snappt nur auf den
vom Kit erlaubten diskreten Winkel oder wird numerisch eingegeben.

`SetPlacementHeight` setzt eine quantisierte lokale Höhe beziehungsweise einen
expliziten Ground-/Socket-Offset. Vertikales Gizmo und numerisches Feld zeigen
vor Commit Terrain Probe, resultierende Welt-Höhe, Clearance und zulässigen
Bereich. Ein Three-Rayhit, sichtbarer Meshboden oder implizites Fallenlassen
schreibt keine Höhe. Freie nicht-uniforme Skalierung ist in V1 ausgeschlossen.

### 7.3 Transaktionen, Undo und Redo

- Eine direkte Geste wie Drag oder Rotate erzeugt viele Preview-Frames, aber
  genau eine bestätigte Transaktion.
- Eine angenommene Suggestion ist genau eine Transaktion, auch wenn sie viele
  Entities enthält.
- Undo/Redo bewegt einen Cursor über immutable Transaktionen oder wendet
  validierte inverse Operationen an. Welche interne Variante verwendet wird,
  ist Implementierungsdetail; beide müssen zum selben Working-Copy-Hash führen.
- Eine neue Mutation nach Undo verwirft den Redo-Zweig explizit.
- Autosave darf nur abgeschlossene Transaktionen persistieren.
- Export referenziert die exakte Working Revision und scheitert, wenn während
  der Validierung eine neue Transaktion hinzukommt.

### 7.4 Save, Load, Export und Konflikte

- `Save Project`: atomarer Editorzustand inklusive History, UI-Präferenzen und
  Accepted-Overlay-Ref.
- `Load Project`: strikter Parse, lückenlose Migration, Catalog-/Base-Hash-
  Prüfung; keine stillen Defaults für fehlende fachliche Felder.
- `Import Package as Preview`: strikter Parse, lückenlose Migration,
  kanonischer Roundtrip sowie Base-/Frame-/Catalog-/Content-Hash-Prüfung. Der
  Import erzeugt nur einen geordneten Diff gegen eine exakte Working Revision;
  erst `Human Accept` übernimmt ausgewählte Operationen als normale atomare
  Transaktion. Unbekannte Zukunftsversionen, ID-/Vorherhash-Konflikte oder
  fehlende Provenienz blockieren ohne Teilwrite.
- `Export Overlay`: vollständige Validierung, kanonische Dateierzeugung,
  Roundtrip-Parse, Hash und atomarer Austausch des Release-Verzeichnisses.
- Git-/Agentkonflikte: gleiche Entity-ID oder Root-Ref-Liste mit
  widersprüchlichem Hash blockiert Merge/Import. Kein Last-Writer-Wins.
- Rebase auf neuen Basissnapshot erzeugt zunächst einen Review-Diff und neue
  Diagnosen. Es schreibt nicht automatisch.

## 8. UI, Wireframe und Workflow

### 8.1 Kompakter Desktop-Aufbau

```text
+--------------------------------------------------------------------------------+
| HESTIA AUTHORING | Project | Base hash | Working r42 | Validierung 2/0 | Export |
+-------------------+----------------------------------------------+-------------+
| Palette           | Viewport                                     | Hierarchy   |
| [Suche/Tags]      |                                              | Layers      |
| Buildings         |   Terrain/Basis     Accepted Overlay         |  Buildings  |
| Roads/Parcels     |   Working Diff      Suggestion Preview       |  Roads      |
| Props/Vegetation  |   Gizmo / Snap / Lock / Mask/Water Overlay   |  Vegetation |
| Masks/Hero        |                                              | Selection   |
+-------------------+----------------------------------------------+-------------+
| Suggestion Review | Inspector: Transform, Kit, Footprint, Sockets, Provenienz |
+-------------------+------------------------------------------------------------+
| Validation: Errors | Warnings | Budgets | Diff | Play Preview | Accept/Reject  |
+--------------------------------------------------------------------------------+
```

### 8.2 Hauptworkflow

1. Projekt und exakten Basissnapshot laden.
2. Layer wählen, Palette filtern, Entity direkt platzieren oder Helper starten.
3. Viewport zeigt Basis, Accepted Overlay, Working Diff und Suggestion Preview
   mit unterscheidbaren, nicht nur farbcodierten Darstellungen.
4. Inspector zeigt stabile ID, Transform, Footprint, Socket-Bindings, Kit- und
   Provenienzversion.
5. Validation Panel verlinkt Issue direkt zu Entity und Feld.
6. Suggestion Review gruppiert Add/Move/Delete/Mask-Diffs, Budgetänderungen
   und verletzte Locks. Mensch akzeptiert alle oder explizit ausgewählte
   Operations, lehnt ab oder setzt zuerst Locks und berechnet neu.
7. Play Preview kompiliert einen read-only temporären Snapshot.
8. Erst ein separater Export schreibt eine Overlay-Release-Version.

Die UI liest ausschließlich Authoring-ViewModels und sendet die oben
definierten Commands. Palette, Inspector, Hierarchy, Picking und Gizmos
mutieren weder Working Copy noch World-/Voxel-Interna direkt.

### 8.3 Input und Accessibility

- Pointer: Linksklick Select, Drag Gizmo, Wheel/Orbit nur im Viewport.
- Tastatur: `W/E/R` Move/Rotate/zulässige Scale, `Ctrl/Cmd+Z` Undo,
  `Ctrl/Cmd+Shift+Z` Redo, `Delete` mit Bestätigung bei Hero/Mehrfachauswahl,
  Pfeiltasten für quantisierte Nudge-Schritte.
- Alle Pointeraktionen benötigen erreichbare Menü-/Inspector-Alternativen.
- Focus Order folgt Palette, Viewport Tools, Hierarchy, Inspector, Review,
  Validation.
- Selection, Lock, Error, Warning und Preview verwenden zusätzlich Form,
  Muster, Text/ARIA-Label und nicht nur Farbe.
- Shortcuts sind sichtbar und umbelegbar; Drag-Gesten haben numerische
  Eingabefelder.

Der Editor benötigt einen separaten, expliziten Bootstrap. `/?surfacePlay=1`
bleibt davon unberührt. Ein möglicher Authoring-Queryname ist eine offene
Produktentscheidung, kein hier freigegebener Route-Vertrag.

## 9. Building-Kit-Pipeline

### 9.1 Pipeline

```text
Quellasset + Lizenz/Provenienz + semantische Definition
  -> BuildingKit-Manifest validieren
  -> Footprint/Socket/Terrain-Fit prüfen
  -> LOD-/Representation-, Collision- und Destruction-Refs prüfen
  -> kanonischen BuildingKitCatalog kompilieren
  -> Golden Roundtrip + Hash
  -> Palette/Placement/Overlay
  -> später Runtime Loader
  -> abgeleitete Presentation-/Three-Artefakte
```

### 9.2 `BuildingKitCatalogV1`

Eine `BuildingDefinitionV1`
**[NEUER TEILVERTRAG DES BUILDING-KIT-CATALOGS]** enthält mindestens:

- `buildingDefinitionId`, `kitId`, `schemaVersion`, Display-/Palette-Metadaten,
- stabile Varianten mit `variantId`,
- lokale Meterabmessungen und ein explizites 2D-Footprint-Polygon,
- Placement- und Hero-Sockets mit lokalem Transform, Rolle, Kompatibilität und
  Clearance,
- erlaubte diskrete Rotation-/Scale-Werte,
- `terrainFitProfile` mit maximaler Steigung, Clearance und
  Fundament-/Pad-Regel,
- Asset-Refs mit `assetId`, Content Hash, Format und Variante,
- Representation-Refs für nahe authored Darstellung und optionale
  revisionsgebundene Mid-/Far-Proxies,
- World-owned `collisionProfileRef`,
- World-/Structural-owned `destructionProfileRef` oder explizit
  `NonDestructibleMvp`,
- Quell-/Lizenz-/Tool-Provenienz.

Dasselbe Catalog-Paket enthält zwei kleinere, ausdrücklich typisierte
Definitionsfamilien:

- `PropDefinitionV1` besitzt stabile Definition/Variante, Palette-Kategorie
  und Tags, lokale Abmessungen, Footprint/Clearance, erlaubte
  Rotation-/Scale-Werte, Placement-/Snap-Modi, Asset Hash, Provenienz und ein
  explizites Collision-/Destruction-Profil oder
  `NonCollidingDecorativeMvp`/`NonDestructibleMvp`.
- `VegetationDefinitionV1` ergänzt Biome-Tags, Klasse
  `Decorative` oder `Structural`, Mindestabstand, Dichte-/Brush-Eignung,
  Terrain-Fit und die für ihre Klasse verpflichtenden
  Collision-/Destruction-Refs. Ein Scatter- oder Meshname ersetzt diese
  Metadaten nicht.

Gemeinsame Felder werden als Catalog-Vertragsbaustein wiederverwendet; Props
werden nicht als Gebäude mit erfundenen Sockets modelliert und Vegetation
nicht aus GLB-Bounds oder Three-Hierarchie klassifiziert.

### 9.3 Fachliche Grenzen

- Das Footprint-Manifest, nicht die sichtbare Mesh-Bounding-Box, entscheidet
  Platzierungsüberlappung.
- Sockets werden nicht aus Node-Namen geraten. Fehlende oder doppelte Socket-
  IDs sind Fehler.
- Terrain Fit fragt World-Daten ab; Three-Raycasts dienen nur der Interaktion.
- LOD-/Proxy-Artefakte sind aus Definition und Asset Hash abgeleitet. Ein
  Proxy darf weder Placement-, Collision- noch Destruction-Authority ändern.
- Collision und Destruction sind getrennte semantische Profile. Ein GLB-
  Collider ist höchstens ein abgeleitetes Artefakt.
- Assetwechsel bei gleicher ID erfordert neue Content-Version und Hash; kein
  stiller Austausch.

Im MVP sind zwei modulare Gebäude mit je mindestens zwei kompatiblen
Anbau-/Straßen-Sockets, zwei Props und ein kleines explizites
Vegetationsdefinitionsset ausreichend. Komplexe Innenräume,
Physikzerstörung, Streaming-LOD und automatische Fundamentverformung bleiben
später.

### 9.4 Derived-Bake-Grenzen

Das Overlay exportiert semantische Quellen und gepinnte Profilreferenzen,
keine zufällig aus der Editor-Szene übernommenen Bakes. Collision-, Nav- und
Streaming-Produkte sind getrennte, regenerierbare Artefakte:

- Collision/Traversal wird von World/Physics aus Overlay-, Catalog-, Basis-
  und Compiler-Revision erzeugt; Mesh- oder Gizmo-Collider sind nur Preview.
- Nav erzeugt gegebenenfalls eigene begehbare Flächen, Links und
  Sperrbereiche aus denselben gepinnten Quellen. Ein Navmesh ist niemals
  Stadt-, Straßen- oder Water-Authority.
- Streaming partitioniert akzeptierte Entities und Derived Products nach
  stabilen Frame-/Tile-Adressen. Chunk-Zugehörigkeit, LOD und Far-Proxies
  verändern weder Entity-ID noch authored Transform.

Jedes Derived Artifact trägt Source Hashes, Compiler-/Profil-Version,
deterministischen Artifact Key und Bounds. Fehlende, veraltete oder
widersprüchliche Bakes blockieren einen späteren Runtime-Publish/Load
fail-closed, aber dürfen weder Projekt-Save noch authored Quelle umschreiben.
Der Editor-MVP prüft nur Contract/Invalidation über Golden Fixtures; produktive
Collision-/Nav-/Streaming-Bakes benötigen eigene genehmigte Runtime-Specs.

## 10. Deterministische semi-prozedurale Helfer

### 10.1 Gemeinsamer Vertrag

Jeder Helper erhält:

- exakte Base-, Working-Copy-, Catalog- und Lock-Hashes,
- benannte Seed-Domäne plus Seed,
- Tool-ID und Tool-Version,
- explizite lokale Bounds/Frames,
- Budgetprofil und fachliche Parameter.

Er liefert ausschließlich `SuggestionPreviewV1`:

- geordnete Add/Move/Delete-Operations,
- Vorher-/Nachher-Hashes,
- räumlichen Preview-Diff,
- Budgetdelta und Diagnosen,
- verwendete Locks und Masken,
- reproduzierbare Provenienz.

Kein Helper besitzt einen Overlay-Writer. `Accept` validiert die Preview gegen
die aktuelle Working Revision und übersetzt die ausgewählten Operationen in
eine normale atomare Transaktion. `Reject` verwirft sie ohne Contentänderung.
Ein neues `Lock` invalidiert die Preview und verlangt Neuberechnung.

### 10.2 V1-Helfer

| Helper | Eingaben | Vorschlag | Harte Grenzen |
| --- | --- | --- | --- |
| Road Sketch Assist | menschliche Stützpunkte, Straßenprofil, Maximalsteigung, Masken | deterministisch geglättete Centerline und Nodes | keine Kreuzung, Brücke oder Terrainmodifikation ohne eigenes späteres Profil |
| Parcel Subdivision | akzeptierte Straßenkante, District-Grenze, Zielbreite/-tiefe | geordnete Parcel-Polygone | Hero Locks, Exclusion Masks und Mindestfläche |
| Building Repetition | Parcel-Set, Building-Kit-Tags, Abstand, Variantenfolge | Placement-Operations mit Socket-/Frontage-Bezug | keine Kollision, kein ungeprüfter Scale, kein Hero-Lock-Verstoß |
| Vegetation Brush/Fill | Polygon, Kit-Tags, Dichte, Mindestabstand | stabile Vegetationsplacements | Exclusion/Biome Mask, Straßen-/Footprint-Clearance und Budget |

Der Nutzer führt die Form: Stützpunkte, Flächen, Zielkits, Locks und Parameter
kommen aus bewusster Eingabe. Der Helper füllt Lücken reproduzierbar; er
entscheidet nicht selbst, wo eine Stadt entsteht.

## 11. Mensch-, Agent- und Git-Zusammenarbeit

### 11.1 Diff-freundliches Paket

Empfohlene Source-Struktur eines Overlay-Releases:

```text
overlay.json
layers/<layer-id>.json
placements/<placement-id>.json
roads/<road-id>.json
parcels/<parcel-id>.json
districts/<district-id>.json
water/<water-area-id>.json
masks/<mask-id>.json
locks/<lock-id>.json
provenance/<provenance-id>.json
validation/report.json
```

`overlay.json` referenziert jede Datei mit stabiler ID und Content Hash.
Dateinamen werden aus bereits validierten IDs abgeleitet, nicht umgekehrt.
Runtime-Content und regenerierbarer Validation Report haben getrennte
Hashbereiche.

### 11.2 Arbeitsregeln

- Menschen und Agenten reservieren disjunkte Author Namespaces und bevorzugen
  disjunkte Entity-Dateien.
- Jeder Change nennt Base Hash, Overlay-Basisversion, Tool-/Agent-Version und
  betroffene IDs.
- Arrays und Root-Refs folgen deterministischer ASCII-Sortierung. Formatierung
  ist kanonisch; Agenten dürfen sie nicht individuell ändern.
- Ein Agent darf Suggestions und einen patchbaren Diff vorbereiten, aber nicht
  `Human Accept` behaupten.
- Bei gleicher Entity-ID mit unterschiedlichem Vorherhash stoppt Merge oder
  Import. Es gibt kein automatisches semantisches Last-Writer-Wins.
- Ein Rebase auf eine neue Basis oder einen neuen Kit Catalog erzeugt neue
  Diagnosen und benötigt erneutes menschliches Review.
- Kleine, fachlich zusammenhängende Transaktionen und Manifeste sind
  bevorzugt. Große generierte Stadt-Rewrites werden in reviewbare
  District-/Layer-Pakete geteilt, ohne atomare Invarianten zu brechen.
- Git-Commit, Push und Veröffentlichung bleiben außerhalb des Editors und
  unterliegen dem normalen menschlichen Review-Gate.

## 12. MVP und spätere Stufen

### 12.1 MVP: Coast/Lush Blockout

Der erste belastbare Slice umfasst genau einen genehmigten
`SurfaceLocalFrame` über einer kleinen reproduzierbaren Coast/Lush-Base-
Fixture und:

- einen Building-Kit-Catalog,
- eine direkt platzierte bzw. Road-Sketch-assistierte Straße,
- eine daraus bewusst angenommene Parzelle,
- zwei modulare Gebäude mit Varianten, Footprints und kompatiblen Sockets,
- zwei vorgefertigte Props und ein kleines typisiertes Vegetationsset,
- eine authored Vegetationsgruppe,
- eine kleine authored Water Area als World-Compiler-Intent,
- eine `ExcludeProceduralVegetation`-Maske,
- genau einen Hero Socket plus Lock,
- Layer, Auswahl, Move/Rotate/Height, Raster/Snap, Duplicate/Delete,
  Undo/Redo,
- eine deterministische Vegetations- oder Building-Repetition-Preview mit
  Accept, Reject und Lock-Neuberechnung,
- Save/Load des Projekts,
- deterministischen Package-Import als Preview mit Accept/Reject,
- validierten kanonischen Overlay-Export und identischen Roundtrip-Hash,
- read-only Play Preview im Authoring-Arbeitsbereich.

MVP-Done bedeutet nicht Integration in V3.1. Runtime-Load wird zunächst durch
einen isolierten Loader-/Presentation-Fixture belegt. Ein Einbau in normales
Surface Play benötigt eine eigene genehmigte Spec und Recovery-Gates.

### 12.2 Später

- mehrere benachbarte Surface Frames und frameübergreifende Straßen,
- Polygonlöcher, Multi-Polygone und skalierbares Raster-/Brush-Maskenformat,
- komplexe Kreuzungen, Brücken, Tunnel und Terrainformung,
- Distriktregeln, größere Building-Kit-Bibliothek und Innenräume,
- authored Structural-/Destruction-Profile und persistente Instance Deltas,
- planetare Streaming-/Representation-Integration,
- Online-Kollaboration, Locks/Leases und serverseitiges Review,
- Agentenplanung über mehrere Districts,
- Runtime-Lebenszyklus, Economy, Verkehr und Bewohner.

## 13. Prospektive Dateien und Owner

Alle Pfade sind Vorschläge; in diesem Dokument wird keiner angelegt.

| Prospektiver Pfad | Owner | Zweck / Impact |
| --- | --- | --- |
| `apps/weltraum-browser/src/authoring/contracts/ids.ts` | Authoring Domain | **[NEUER VERTRAG]** ID-Brands und Parser. |
| `apps/weltraum-browser/src/authoring/contracts/types.ts` | Authoring Domain | **[NEUE VERTRÄGE]** Project, Command, Preview, Overlay-Entities. |
| `apps/weltraum-browser/src/authoring/contracts/budgets.ts` | Authoring Domain | **[NEUER VERTRAG]** versionierte Budgetprofile und Admission Caps. |
| `apps/weltraum-browser/src/authoring/contracts/validation.ts` | Authoring Domain | strikte Schema-, Referenz-, Transform- und Geometrieprüfung. |
| `apps/weltraum-browser/src/authoring/overlay/canonical.ts` | Authoring Domain | domainspezifische kanonische Ausgabe und Hash; nutzt neutrale JSON-/Hash-Primitiven. |
| `apps/weltraum-browser/src/authoring/overlay/serialization.ts` | Authoring Domain | Parse, Roundtrip und Paketmanifest. |
| `apps/weltraum-browser/src/authoring/overlay/migrations.ts` | Authoring Domain | **[NEUE MIGRATIONSGRENZE]** lückenlose Overlay-Migration. |
| `apps/weltraum-browser/src/authoring/project/serialization.ts` | Authoring Domain | Project Save/Load. |
| `apps/weltraum-browser/src/authoring/project/migrations.ts` | Authoring Domain | **[NEUE MIGRATIONSGRENZE]** Project-Migration. |
| `apps/weltraum-browser/src/authoring/editor/commands.ts` | Authoring Core | Command Parser/Dispatcher und Preconditions. |
| `apps/weltraum-browser/src/authoring/editor/history.ts` | Authoring Core | Transaktionen, Undo/Redo und Working Revision. |
| `apps/weltraum-browser/src/authoring/building-kit/types.ts` | Building Kit Domain | **[NEUER VERTRAG]** Kit/Catalog/Building/Socket/Profile. |
| `apps/weltraum-browser/src/authoring/building-kit/serialization.ts` | Building Kit Domain | Catalog Roundtrip und Hash. |
| `apps/weltraum-browser/src/authoring/building-kit/migrations.ts` | Building Kit Domain | **[NEUE MIGRATIONSGRENZE]** Catalog-Migration. |
| `apps/weltraum-browser/src/authoring/building-kit/compiler.ts` | Building Kit Domain | geprüfte Definitionen und abgeleitete Asset-/Representation-Refs. |
| `apps/weltraum-browser/src/authoring/suggestions/` | Authoring Helpers | reine deterministic Road/Parcel/Building/Vegetation-Preview-Funktionen. |
| `apps/weltraum-browser/src/authoring/ui/` | Editor UI | Palette, Hierarchy, Inspector, Review und Validation über ViewModels/Commands. |
| `apps/weltraum-browser/src/render/three/authoring/` | Three Projection | Viewport, Picking und Gizmos als Projektion. |
| `apps/weltraum-browser/src/authoring/authoringBootstrap.ts` | Browser Bootstrap | separater Authoring-Einstieg; Name/Route erst nach Freigabe. |
| `apps/weltraum-browser/content/hestia/authoring/kits/` | Content Source | neue Git-geführte Building-Kit-Manifeste; neuer Source-Root benötigt Freigabe. |
| `apps/weltraum-browser/content/hestia/authoring/overlays/` | Content Source | kleine versionierte Overlay-Pakete und Provenienz. |
| `apps/weltraum-browser/tests/unit/authoring/` | Test Owner | Commands, Schema, Hash, Migration, Helper, Konflikte und Budgets. |
| `apps/weltraum-browser/tests/e2e/hestia-authoring-editor.spec.ts` | Browser Test Owner | reale Editor-Controls, Save/Load/Export, Preview und Accessibility. |
| `apps/weltraum-browser/src/world/authored-overlay/` | World/Runtime, später | **[NEUER ZUKÜNFTIGER PORTVERTRAG]** immutable Loader/Komposition; blockiert bis Owner-/Präzedenzfreigabe. |

Die Trennung `src/authoring` versus `src/world/authored-overlay` ist bewusst:
Editorlogik schreibt Arbeitsinhalt; nur World kompiliert genehmigte Releases
in Runtime-Fakten. Sollte die kommende `WorldTemplate`-Foundation einen
anderen Owner bestimmen, stoppt die Implementierung vor Anlage des
Runtime-Pfads und aktualisiert zuerst diesen Plan.

## 14. Phasen und Verifikation

### Phase 0: Entscheidungen und Spec

**Arbeit:** Offene Fragen aus Abschnitt 17 entscheiden, Owner festlegen,
DevToolbox-Spec und Public-Impact-Liste erstellen.

**Gate:** Kein Ownerkonflikt; V3.1 bleibt explizit out of scope; genaue MVP-
Budgets und Content-Root sind genehmigt.

### Phase 1: Verträge und Golden Fixtures

**Arbeit:** IDs, Project/Command/Overlay/Kit/Report-Verträge, strikte Parser,
kanonische Serializer, Hashes, Water-/Prop-/Vegetation-Definitionen und
getrennte Migration Registries.

**Unit-/Schema-Gates:**

- gültige Minimal-/MVP-/Maximal-Fixtures,
- unbekannte Felder, Nicht-Endlichkeit, `-0`, doppelte IDs, Future Version,
  falscher Frame-/Catalog-/Base-Hash und kaputte Referenzen werden abgelehnt,
- parse -> serialize -> parse ergibt denselben Deep-Frozen Content und Hash,
- unterschiedliche Eingabeschlüsselreihenfolge ergibt identische kanonische
  Bytes,
- jede Migration ist einzeln validiert; Lücke oder stiller Feldverlust
  scheitert,
- Golden Hashes laufen auf Node 22 reproduzierbar.

### Phase 2: Working Copy und Commands

**Arbeit:** Transaktionen, Preconditions, Selection,
Place/Move/Rotate/Height/Scale, Raster/Snap, Duplicate/Delete, Layer, Lock,
Undo/Redo, Project Save/Load und Import-as-Preview.

**Gates:**

- jede ungültige Transaktion hinterlässt Working Revision und Hash unverändert,
- Undo/Redo-Roundtrip erreicht bitgleich den Ausgangshash,
- Drag commitet genau eine Transaktion,
- Save/Load erhält Working Hash, History Cursor und ID-Counter,
- veraltete Revision, Socket oder Base-Ref scheitert fail-closed.

### Phase 3: Building Kit und Overlay-Compiler

**Arbeit:** zwei MVP-Gebäude, Props, Vegetationsdefinitionen,
Footprints/Sockets/Terrain Fit, eine kleine Water Area, Catalog Compiler,
Overlay-Paket, Validation Report und atomarer Export.

**Gates:**

- Mesh-/Assetwechsel kann Footprint oder Socket nicht still verändern,
- fehlende Asset-/Collision-/Destruction-Refs erzeugen definierte Fehler,
- Overlay-Paket roundtript datei- und hashstabil,
- Exportfehler lässt letzte gültige Release-Version unangetastet,
- gleiche Content-Inputs erzeugen plattformgleich dieselbe Referenzordnung und
  denselben Hash.

### Phase 4: Deterministische Helfer

**Arbeit:** Road Sketch, Parcel Subdivision und genau ein Repetition-/Vegetation
Helper für den MVP.

**Gates:**

- gleiche Inputs/Seeds/Tool-Versionen erzeugen denselben Preview-Diff,
- Accept erzeugt genau eine normale Transaktion,
- Reject verändert keinen Content Hash,
- Lock invalidiert alte Preview und verhindert betroffene Operationen,
- Budgetüberschreitung ist Diagnose und niemals automatische Kürzung.

### Phase 5: Editor UI und Three-Projektion

**Arbeit:** separater Bootstrap, Wireframe-Panels, Picking/Gizmos, Suggestion
Review, Validation, Diff-Ansichten und read-only Play Preview.

**Browser-/Manual-Matrix:**

| Fall | Erwarteter Beleg |
| --- | --- |
| Direct Placement | Gebäude aus Palette wählen, auf World Probe snappen, ID/Footprint/Socket im Inspector prüfen. |
| Multi-Edit | Auswahl, Move/Rotate/Height, Rasterwechsel, Duplicate/Delete, Layerwechsel, Undo/Redo ohne Hashdrift. |
| Catalog | Building, Prop und Decorative/Structural Vegetation zeigen vollständige typisierte Metadaten; fehlende Profile/Hashes blockieren. |
| Water | authored Water Area bleibt sichtbarer Intent; World-Validierung erzeugt Fakten oder blockiert, ohne Basis oder Mesh zur Authority zu machen. |
| Suggestion | Preview optisch und textuell vom Accepted/Working Content unterscheidbar; Reject/Accept/Lock verifiziert. |
| Mask | Vegetationsexclusion sichtbar; Helper respektiert sie; Basis wird nicht mutiert. |
| Hero | Hero Socket und Lock sichtbar; Delete/Helper benötigt explizite Aufhebung. |
| Save/Load/Export | Browser reload lädt Projekt; Exportreport und Roundtrip-Hash stimmen. |
| Import | identisches Paket erzeugt identischen Preview-Diff; Konflikt/Future Version blockiert; Accept ist genau eine Transaktion. |
| Derived Bakes | gleiche Source-/Compiler-Revision ergibt gleiche Artifact Keys; stale Collision/Nav/Streaming-Refs blockieren Runtime-Publish. |
| Play Preview | temporärer immutable Snapshot; Rückkehr erhält Working Copy; kein Surface-Play-Write. |
| Input | Pointer und Tastaturpfad; numerische Eingabe; Fokusreihenfolge; keine nur farbliche Zustandsanzeige. |
| Failure | falscher Base-/Catalog-Hash, Asset fehlt, Budget überschritten, Git-Konflikt: klare Blockade ohne Teilwrite. |
| Isolation | `/?surfacePlay=1` zeigt keine Palette, Commands, TestBridge oder Authoring-State. |

### Phase 6: Separater Runtime-Integrationsentscheid

Erst nach freigegebenem `WorldTemplate`-/`WorldInstance`-Owner darf ein
immutable Overlay Loader entstehen. Er benötigt eigene Unit-, Loader-,
Snapshot-, Collision-/Destruction- und Presentation-Evidence. Diese Phase ist
nicht Teil der V3.1-Recovery und nicht Voraussetzung für den Editor-MVP.

## 15. Provisorische MVP-Budgets

Die folgenden Werte sind vorgeschlagene Admission Caps für den ersten
Coast/Lush-Blockout, keine gemessenen Performanceversprechen. Phase 0 muss sie
bestätigen oder ersetzen.

| Größe | Vorschlag |
| --- | ---: |
| Surface Frames | 1 |
| exportierte Layer | 16 |
| Placements gesamt | 576 |
| Building Placements | 128 |
| Prop Placements | 64 |
| Vegetationsplacements | 384 |
| Straßen-Nodes / Edges | 128 / 128 |
| Parcels / Districts | 128 / 8 |
| Water Areas / Punkte pro Fläche | 4 / 128 |
| Masken / Punkte pro Maske | 32 / 128 |
| Sockets pro Building Definition | 32 |
| Operations pro Transaktion | 256 |
| Operations pro Suggestion Preview | 1.024 |
| Undo-History im Projekt | 1.000 Transaktionen |
| kanonisches Overlay-Paket ohne Binärassets | 4 MiB |
| einzelne Entity-Datei | 64 KiB |
| Validation Issues | 2.000, danach eigener `DiagnosticsTruncated`-Error |

Performanceziele müssen auf Zielhardware gemessen werden:

- einzelne Command-Anwendung und ViewModel-Publish p95 unter 16 ms,
- Viewport-Interaktion p95 mindestens 55 FPS im MVP-Datensatz,
- vollständige MVP-Validierung p95 unter 500 ms,
- deterministische Suggestion p95 unter 1 s,
- Save/Load/Export jeweils mit sichtbarem Progress ab 250 ms und ohne
  blockierten Input-Thread.

Ein Zielbruch führt nicht zu stiller Ausdünnung. Das Tool zeigt Budget oder
Performance-Diagnose; der Mensch reduziert Scope oder genehmigt ein neues
Profil.

## 16. Risiken, Rollback und Safe Stop

| Risiko | Gegenmaßnahme | Safe Stop / Rollback |
| --- | --- | --- |
| Ownerkonflikt zwischen Authoring, WorldTemplate und Surface Play | Runtime Loader getrennt halten; Public Impact vor Code freigeben. | Nur Verträge/Fixtures oder nur Editor-Projekt fortführen; keine Runtime-Datei anlegen. |
| Overlay, Basis und Player-Deltas werden vermischt | getrennte Root-IDs, Hashes, Speicherpfade und Kompositionsphase. | Loader lehnt unklare Target-/Revision-Präzedenz ab. |
| Generator-/Agentoutput schreibt ungeprüft | Preview besitzt keinen Writer; Accept ist normale validierte Transaktion. | Preview verwerfen; letzte Working/Release Revision bleibt gültig. |
| Große JSON-Diffs und Merge-Konflikte | eine Entity pro Datei, stabile Reihenfolge, kleine Transaktionen. | Konflikt auf Entity-/Hash-Ebene blockieren und manuell neu previewen. |
| Asset/Mesh wird heimliche Authority | Footprint, Socket, Collision und Destruction explizit manifestieren. | Catalog Compile stoppt bei fehlender/abweichender Referenz. |
| Surface Frames driften | Frame Revision und Hash in Projekt/Overlay pinnen. | Rebase als separater Review-Diff; kein automatisches Umrechnen. |
| Maskengeometrie wird zu komplex | MVP nur einfache Ringe, harte Limits und Geometrievalidierung. | Maske aufteilen oder spätere Schemaentscheidung; kein stilles Vereinfachen. |
| Undo/Redo oder Autosave korrumpiert Projekt | immutable Transaktionen, atomare Save-Grenze, Roundtrip-Hash. | letzte gültige Projektdatei laden; unvollständige Revision ignorieren. |
| Performancebudget wird überschritten | Admission Caps, gemessene Reports, asynchrone schwere Preview-Jobs. | Export/Preview blockieren und Diagnose zeigen; keine automatische Contentlöschung. |
| V3.1-Recovery wird destabilisiert | separater Bootstrap und keine Imports in Surface Play. | Authoring-Einstieg deaktivieren/entfernen, ohne V3.1-Vertrag zu ändern. |

Rollback-Einheit ist eine vollständige Overlay-Release-Version mit Root-Hash.
Die Runtime darf auf die letzte validierte Version zurückpinnen. Ein Rollback
ändert nicht den Basissnapshot und löscht keine späteren Instance Deltas; deren
Target-Kompatibilität muss vor Umschalten geprüft werden.

## 17. Explizit zu genehmigende Entscheidungen

Vor Implementierung sind folgende Fragen zu beantworten:

1. **Owner:** Wird `src/authoring` als neuer renderer-neutraler Domain-Owner
   akzeptiert, und bleibt der Runtime Loader bis zur
   `WorldTemplate`-/`WorldInstance`-Foundation blockiert?
2. **Content Source:** Darf
   `apps/weltraum-browser/content/hestia/authoring/` als neuer Git-geführter
   Source-Root entstehen, oder soll ein repositoryweiter Content-Root
   verwendet werden?
3. **Overlay-Präzedenz:** Sind Basis -> authored Overlay -> persistente
   Instance Deltas die verbindliche Reihenfolge, und welche Mask/Replace-
   Operationen sind in V1 erlaubt?
4. **IDs:** Wird das author-namespace-basierte, opake 128-ASCII-ID-Modell
   akzeptiert? Wie werden Namespaces für Benutzer und Agenten reserviert?
5. **Frames:** Ist ein einzelner gepinnter `SurfaceLocalFrame` für den MVP
   ausreichend, während Reframe/Multi-Frame explizit später bleibt?
6. **Transforms:** Bleibt Building Scale in V1 diskret und im MVP exakt `1`,
   mit Quaternion als serialisierter Rotation?
7. **Masken:** Wird der einfache lokale Polygonring als V1-Authoring-Wahrheit
   akzeptiert, während Raster/Brush nur UI bzw. abgeleitet ist?
8. **Building Kit:** Welche Assetformate, Collision-/Destruction-Profile und
   minimalen LOD-/Representation-Refs sind für Gebäude, Props und
   Decorative/Structural Vegetation Pflicht?
9. **Route und Zugriff:** Wie heißt der separate Authoring-Einstieg, und ist
   er Development-only, rollen-/featureflaggebunden oder produktiv sichtbar?
10. **Budgets:** Werden die provisorischen Caps und Messziele aus Abschnitt 15
    als Startprofil akzeptiert?
11. **Human Accept:** Wer darf ein Overlay-Release annehmen und exportieren,
    und welches Review-Artefakt muss dafür vorliegen?
12. **Runtime-Timing:** Soll der MVP bei isoliertem Loader/Play Preview enden,
    oder wird später eine eigene, von V3.1 getrennte Runtime-Integrationsspec
    beauftragt?
13. **Water Intent:** Ist `AuthoredWaterAreaV1` mit gepinntem Wasserprofil und
    quantisierter Sollhöhe die akzeptierte authored Quelle, während
    Water/Shore/Traversal World-owned kompiliert bleiben?
14. **Derived Bakes:** Welche Domain-Owner und Profile genehmigen
    Collision-, Nav- und Streaming-Artefakte, und blockiert ihr Fehlen erst
    Runtime-Publish statt Project Save?
15. **Import:** Welche Paketquellen und Signatur-/Provenienzregeln dürfen als
    Preview importiert werden, und wer akzeptiert Konfliktauflösungen?

Bleibt eine dieser Fragen für Owner, Präzedenz, Persistenz oder öffentlichen
Vertrag offen, ist der sichere nächste Schritt eine reine Contract-/Fixture-
Spike-Spec. Produktcode, Surface Play und Runtime Loader bleiben dann
unverändert.

## 18. Abgrenzung zu V3.1

Dieses Dokument ist ausschließlich ein Vorschlag für eine spätere Foundation.
Es implementiert, migriert oder veröffentlicht keinen der genannten
Verträge. Es ändert keine V3.1-Runtime, keine Surface-Play-Query, keine World-
oder Voxel-Authority, keine Tests und keine Recovery-Tasks.

Insbesondere bleibt der aktuelle Status `airborne`/Grounding-/Fall-Flow eine
separate V3.1-Korrektheitsaufgabe. Der Authoring-Editor ist weder Ursache noch
Lösung dieses Runtime-Verhaltens und darf nicht in dessen Fix einfließen.
