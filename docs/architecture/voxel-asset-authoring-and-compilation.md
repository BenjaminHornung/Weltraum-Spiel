# Voxel Asset Authoring And Compilation

Stand: 2026-07-13
Status: verbindliche Zielarchitektur, Docs-only, keine Compiler-Implementierung

## 1. Binding Target Decision

GLB/glTF 2.0 ist der kanonische Input des Hestia-Asset-Compilers. Blender,
Blockbench und MagicaVoxel dürfen gemäß Adoption Matrix als externe
Authoring-Werkzeuge vorgesehen werden; Goxel bleibt Konzeptquelle. Kein Editor,
Editorformat oder externes Projekt wird Runtime Authority.

Der Compiler ist ein reproduzierbares Offline-Tool hinter einem eigenen
Adapter. Er validiert, normalisiert und hasht den Input und erzeugt eine
kanonische, versionierte Assetdefinition. Runtime-Import eines beliebigen GLB
ist kein Ersatz für Compilerdiagnosen, Thin-Feature-Entscheidungen,
Structural Semantics, Collision/Nav-Projektionen oder Masseneigenschaften.

## 2. Current Main / Code Foundation

- [Browser / Three.js Mainline ADR](../browser-mainline/adr-0001-threejs-mainline.md)
  und [Browser Mainline Architecture](../browser-mainline/browser-architecture.md)
  erlauben GLB-basierte Renderassets, halten aber Gameplay Truth außerhalb von
  Three.js und Scene Objects.
- **[Observed Demo Evidence]** Der Observability-Audit hat im aktuellen
  Browserlauf einen sichtbaren Viewport und einen HTTP-200-Request für das
  GLB-Schiffsasset beobachtet. Das beweist weder erfolgreiches Parsen oder
  Binden des GLB noch einen Voxel-Compiler, Structural Semantics oder
  deterministische Assetnormalisierung.
- [Surface Local Frame Architecture](surface-local-frame-architecture.md)
  besitzt die Platzierungs- und Site-Frame-Regeln. Der Compiler erzeugt lokale
  Assetframes; die Weltinstanz platziert sie später in einem expliziten
  Body-/Surface-/Site-Frame.
- Eine produktive GLB-to-Voxel-Pipeline, ein Golden Asset Corpus oder
  automatisches Mass-/Collision-/Nav-Baking werden durch dieses Dokument nicht
  als vorhanden behauptet.

## 3. Research Evidence

Quellen:

- [Voxel Platform Reference Adoption Matrix v1](../research/voxel-platform-reference-adoption-matrix-v1.md)
- [Voxel Meshing, Destruction, and Asset Audit v1](../research/voxel-meshing-destruction-asset-audit-v1.md)
- [Browser Voxel Runtime Reference Audit v1](../research/browser-voxel-runtime-reference-audit-v1.md)

**[Code Evidence]** Das Meshing-Audit belegt glTF-`extras` als
anwendungsspezifischen Transportkanal, Blender-Custom-Property-Export,
Blockbench-GLB-Fähigkeiten sowie Referenzmuster für sparse Bricks,
Semantic Channels, Transvoxel, Greedy Meshing, BVH und Meshoptimierung.

**[Inference]** Diese Fähigkeiten rechtfertigen die Compilergrenzen, aber keine
Runtimedependency. `extras` besitzen ohne eigenes Schema keine Hestia-Semantik.
Ein README, eine sichtbare Editorinteraktion oder ein vorhandener Exporter
beweist weder deterministische Compileroutputs noch korrekte Masse, Collision
oder Thin Features.

Die Kategorien, Lizenzgrenzen und Reuse-Gates werden ausschließlich durch die
Adoption Matrix normalisiert. Diese Datei kopiert weder fremden Source noch
Lizenztexte.

## 4. Authoring Tool Roles

| Werkzeug | Zulässige Rolle | Verbindliche Grenze |
| --- | --- | --- |
| Blender | Primäre Production-Pipeline, GLB-Export, authored LODs, lokale Marker und JSON-fähige Custom Properties | Externes Tool; Version und Exportoptionen pinnen. Evaluierte Geometrie ist Input, nicht Blender-Source oder Nodegraph als Runtime Truth. |
| Blockbench | Boxige Props, modulare Technikobjekte und einfache authored GLB-Geometrie | Externes Tool; Hestia-Semantik benötigt eine validierte Konvention oder ein getrennt geprüftes Plugin. Keine GPL-Source in der Runtime. |
| MagicaVoxel | Stil-, Paletten- und kleine Referenzassets | Extern nutzen, nicht bundeln oder redistribuieren. Ein automatisierter Importpfad ist nicht beschlossen. |
| Goxel | Studienquelle für tiled Editing, Layers, Undo und Painterkonzepte | Keine Runtime- oder Compilerintegration; GPL-Source wird nicht übernommen. |

Assetrechte, Toollizenz, Source-Lizenz und Datenlizenz bleiben getrennte
Inventare. Ein externes Authoring-Tool erteilt keine Rechte an fremden Assets
und keine Erlaubnis zum Tool-Bundling.

## 5. Canonical Input Contract

Der Compiler akzeptiert GLB oder kontrolliert aufgelöstes glTF 2.0. GLB ist der
bevorzugte transportierbare Einzelcontainer. Für jeden Lauf werden mindestens
erfasst:

- Source-URI oder Provenance-ID und Sourcehash,
- glTF-/Container-Version und verwendete Extensions,
- Authoring-Tool und gepinnte Exportversion,
- deklarierte Einheit, Achsen und Assetframe,
- Nodes, Meshes, Primitive, Materialien, Instanzen und Transformationen,
- Semantic Metadata und deren Schemaversion,
- Compiler-, Registry-, Materialdatenbank- und Algorithmusversion,
- Warnungen, Fehler und explizite Fallbackentscheidungen.

Der Compiler normalisiert in den projektweiten lokalen Assetframe mit Metern,
`+Y` oben, `+Z` vorwärts und `+X` rechts. Negative Determinanten, Winding,
Instanzen, Modifiers, Morph-/Skin-Support und nicht unterstützte Extensions
werden ausdrücklich behandelt. Unbekannte Pflichtfeatures schlagen fehl; sie
werden nicht still verworfen.

## 6. Validation And Provenance Pipeline

Die verbindliche Offline-Pipeline ist:

```text
GLB/glTF ingest
  -> provenance and feature inventory
  -> unit / axis / transform normalization
  -> geometry and topology validation
  -> semantic schema validation
  -> material and representation mapping
  -> deterministic voxelization / structural compilation
  -> derived product generation
  -> canonical manifest and hashes
```

### 6.1 Geometry Validation

Pflichtprüfungen umfassen:

- finite Position-, Normal-, Tangent- und Transformwerte,
- gültige Indizes und Primitive,
- degenerierte oder duplizierte Dreiecke,
- offene, non-manifold oder widersprüchlich orientierte Flächen,
- Selbstschnitt- und Inside/Outside-Risiken,
- Instanz-, Transform- und Materialzuordnung,
- UV-/Tangentanforderungen authored Render-LODs,
- Bounds, Mindestdicken und Compilerauflösung.

Ein offenes Mesh darf nur mit einer expliziten `Shell`-Policy kompiliert werden.
`SolidFill` verlangt ein belastbares Volumengate.

### 6.2 Provenance And Hashes

Separat gehasht werden:

- Source-GLB,
- normalisierte Geometrie,
- kanonische Semantik,
- Material- und Structural-Materialdaten,
- Brick-/Graphoutputs,
- jedes Derived Product,
- kompletter Manifestbaum.

Reproduzierbarkeit bedeutet gleiche Outputs für gleiche gepinnte Inputs und
Toolversionen. Dateizeit, Objektiteration, Locale oder aktueller Renderbackend
dürfen den kanonischen Hash nicht beeinflussen.

## 7. Semantic Metadata And Materials

glTF-`extras` sind der bevorzugte Transportkanal für namespaced,
JSON-kompatible Hestia-Metadaten. Der Compiler validiert ein versioniertes
Schema und normalisiert die Daten in sein Canonical Manifest.

Benötigte semantische Konzepte umfassen je nach Asset:

- stabile Asset-, Part-, Component- und Interface-IDs,
- Repräsentationsmodus wie Solid, Shell, Layered Shell, Semantic Volume,
  Structural Assembly, Modular Part, Decorative oder Hybrid,
- Render-Material getrennt von Structural Material,
- Dichte, Festigkeit, Schichtdicke und Damage-/Fracture-Policy,
- Snap-, Docking-, Cargo-, Interaktions- und Storymarker,
- Collision- und Navigation-Policy,
- Cut Interfaces, Sollbruchstellen, Parent-/Child-Assembly und Joints,
- authored LOD- und Proxyreferenzen.

`extras` werden nicht blind kopiert. Unbekannte Pflichtfelder sind Fehler;
unbekannte optionale Felder dürfen mit Provenance erhalten bleiben. Kritische
Masse-, Collision- oder Sicherheitswerte gelten erst nach Geometrie- und
Plausibilitätsprüfung.

## 8. Deterministic Voxelization And Thin Features

Voxelization verwendet konservative Triangle-Coverage und eine dokumentierte
Inside/Outside- beziehungsweise Shell-Regel. Kanonische Sortierung,
Quantisierung, Materialauflösung, Palette und Grenzownership sind Teil der
Algorithmusversion.

Die Thin-Feature-Policy verhindert stillen Informationsverlust:

1. Strukturell, kollisions- oder navigationsrelevante Features benötigen in
   ihrer feinsten Richtung genügend Samples plus Rekonstruktionsrand.
2. Unteraufgelöste tragende Stäbe, Kabel, Rohre und Platten bleiben als
   analytische Beam-/Rod-/Shell-Elemente im Semantic/Structural Graph.
3. Nichttragende und nichtkollidierende Details dürfen ausdrücklich
   `Decorative` bleiben.
4. Layered Shells benötigen je Lage Material, Dicke und eine dokumentierte
   Unterauflösungsregel.
5. Kritische Features ohne zulässige Ersatzklasse sind Compilerfehler mit
   Asset-ID, Node-Pfad, gemessener Dicke, Zielauflösung und Abhilfehinweis.

`0,25 m` ist das lokale Qualitätsziel und `0,50 m` der Performance-Fallback.
Der Compiler darf je Assetklasse strengere Thin-Feature-Anforderungen stellen;
er darf die Zielauflösung nicht als Beweis ausreichender Qualität behandeln.

## 9. Canonical Compiler Outputs

Der Compiler erzeugt zwei Klassen von Outputs.

### 9.1 Canonical Outputs

- Canonical Asset Manifest mit Schema, Frames, Versionen und Hashes,
- sparse, sortierte Brickkanäle oder Brickgeneratorparameter,
- Semantic-/Structural-Assembly-Graph,
- stabile Part-, Joint-, Marker-, Interface- und Material-IDs,
- Representation-, Thin-Feature- und Cut-Interface-Entscheidungen,
- Mass-/Volumeninputs und Fehlerbudgets,
- Provenance- und Diagnosereport.

### 9.2 Derived Outputs

- authored oder deterministisch vereinfachte Render-LODs,
- Terrain-/Building-Mesherartefakte nach Domäne,
- Collision-LODs und Compound-/Voxel-/Meshprojektionen,
- Navigationstiles, Walkable-Flächen und Portale,
- BVH-/Raycast-Projektionen,
- Far-Field-, intakte und beschädigte Proxies,
- optionale Cacheartefakte für Browser Worker oder Server.

Derived Outputs tragen Quell- und Algorithmusrevision. Sie dürfen verworfen
und aus Canonical Outputs neu erzeugt werden.

## 10. Terrain And Building Output Separation

Der Compiler darf unterschiedliche Projektionen emittieren:

| Asset-/Domänentyp | Kanonischer Output | Derived Mesher-/Renderziel |
| --- | --- | --- |
| Natürliches Terrain oder Asteroidbasis | quantisierte SDF-/Density-Bricks, Materialien und Provenance | Regular Cells/Transvoxel-Kandidat sowie Far-Field-Projektion |
| Intaktes Gebäude oder Technikteil | Structural Graph, Semantic Volumes und authored Geometrie | authored GLB-LOD oder deterministisch optimierte LODs |
| Achsenharte beschädigte Flächen | Occupancy, Material, Damage und Part-ID | Greedy-Mesherartefakt |
| Freie Bruch- oder Schnittfläche | lokale SDF-/Hermite-Eingaben und Cut-Interface | gekapseltes Dual-Verfahren nach Benchmark |

Ein Editorformat oder Rendermesh wird nie zur alleinigen Zerstörungs- oder
Persistenzwahrheit.

## 11. Golden Asset Corpus

Der Golden Corpus ist ein versionierter Compiler-Testdatensatz. Jeder Fall
besitzt Source-/Generatorinput, erwartete Diagnosen, Canonical-Hashes,
Meshstatistiken, Collision-/Nav-Invarianten und Offline-Referenzen, wo nötig.

Mindestens erforderlich:

- geneigte Fläche über mehrere Bricks für Grenzownership,
- Kugel mit schmalem Tunnel für Volumen und Höhle,
- Ambiguity- und 2:1-LOD-Fälle für Terrainmeshing,
- dünne Platte, Rohr und tragender Stab für Thin Policy,
- Mehrmaterialkeil für Palette und Seam Locks,
- harter Raum mit Tür für Greedy Mesh und Navigation,
- Structural-Assembly-Fachwerk für stabile Komponenten,
- GLB mit Instanzen, negativen Skalen und semantischen `extras`,
- Layered-Shell-Panzerung für Schichten und Restmasse,
- wiederholte Edit-/Reload-Sequenz für persistente Hashes,
- exzentrisch beschädigter Körper für Masse, COM und Inertia.

Referenzbilder können in einem späteren Testsystem entstehen, sind aber kein
Ersatz für kanonische Hashes und Invarianten. Dieser Docs-only-Change erzeugt
keine Bilder oder Binary Captures.

## 12. External Candidate Gates

| Kandidat | Zulässiger Spike | Gate vor jeder weiteren Entscheidung |
| --- | --- | --- |
| meshoptimizer | Offline-/WASM-Adapter für Reordering, Simplification und Codecs | Material-, UV-, Chunk- und Cut-Seams locken; Version/Optionen hashen; Golden Corpus und Qualitätsbudget. |
| three-mesh-bvh | Revisionierte BVH-Projektion für Raycast, Sculpting oder Collisionqueries | Refit-versus-Rebuild-Schwelle, Indexmutation, Staleness, Speicher und optionales COOP/COEP getrennt messen. |
| FastNoiseLite | Generatoradapter für bestimmte Basisfelder | CPU-/WASM-/GPU-Golden-Parität; gleicher Seed allein reicht nicht. |
| Voxelize Mesher | Eng isolierter Rust-/WASM-Mesher hinter eigenem Port | Registry-Isolation, native/WASM-Parität, Indexbreite, Kopierkosten, Peak Memory, Lizenz- und Source-Provenance. |

Kein Kandidat wird durch diese Tabelle zur Dependency. Eine Neubewertung
erfordert Benchmark Evidence und eine aktualisierte Adoption-Entscheidung.

## 13. Runtime Consumption Boundary

Die Runtime lädt nur validierte Compileroutputs:

- Sie prüft Manifest-/Schema-/Registry-/Compiler-Kompatibilität.
- Sie bindet Assetinstanzen über stabile IDs und explizite Frames.
- Sie erstellt Render-, Collision- und Workerressourcen über Adapter.
- Sie persistiert Instance Semantic State und Deltas, nicht Editorzustand.
- Sie schlägt bei unbekannten Pflichtversionen sichtbar fehl.

Three.js erhält ausschließlich Derived Renderdaten. World-, Worker-,
Persistence- und Voxelverträge enthalten keine Three.js-Objekte. Die konkrete
Grenze besitzt
[World Runtime Render Backend Boundary](world-runtime-render-backend-boundary.md).

## 14. Required Invariants

- Gleiche gepinnte Inputs erzeugen gleiche Canonical- und Manifest-Hashes.
- Render-Material und Structural Material bleiben getrennt.
- Ein kritisches Thin Feature verschwindet niemals still.
- Editor-, Plugin- und Exporterversion sind Provenance, nicht Runtime Truth.
- Canonical Outputs bleiben unabhängig vom aktuellen Rendererbackend.
- Derived Mesh-, Collider-, Nav- und BVH-Produkte nennen ihre Quellrevision.
- Kein fremder Source- oder Lizenztext wird in Compileroutputs kopiert.
- Toolnutzung, Toolbundling, Source-Reuse und Assetrechte werden separat
  entschieden.

## 15. Open Benchmarks / Product Questions

- Finales Hestia-Semantikschema und Versionierungs-/Migrationsprozess.
- GLB-Featureallowlist, Extensionpolicy und Umgang mit Skins/Morphs.
- Konservative Voxelization, Inside/Outside-Verfahren und Fehlerbudgets.
- Brickgröße, Kanalencoding, Materialpaletten und `0,25 m`-/`0,50 m`-Profile.
- Terrainmesher, Dual-Verfahren und deterministische LOD-Seams.
- Grenzen zwischen authored Proxy, Semantic Volume und vollständig
  voxelisiertem Asset.
- Compilerlaufzeit, Outputgröße, Cacheformat und inkrementelle Rebuilds.
- Lizenz-/Provenanceautomation und Freigabeprozess für Quellassets.
- Autorität und Migration bereits instanziierter Assets nach Compilerupgrade.

Bis diese Fragen belegt sind, bleibt der Compiler eine Zielarchitektur und kein
implementiertes oder produktionsreifes Tool.
