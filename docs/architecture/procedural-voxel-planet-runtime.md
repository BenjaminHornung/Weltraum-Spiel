# Procedural Voxel Planet Runtime

Stand: 2026-07-13
Status: verbindliche Zielarchitektur, Docs-only, keine Runtime-Implementierung

## 1. Binding Target Decision

Hestias planetare Runtime wird als hierarchische, revisionierte
Repräsentationsleiter gebaut. Ein Planet ist global keine vollständig
volumetrische Voxelwelt. Globale und lokale Ebenen bleiben getrennt:

```text
Planetary Macro Data
  -> SurfaceTile
     -> SurfaceRegion
        -> local VoxelBrick
```

- `Planetary Macro Data` besitzt Körperparameter, deterministische
  Generatorgrundlagen, grobe Höhen-/Biome-/Materialfelder und stabile
  planetare Adressen.
- `SurfaceTile` ist die hierarchische Shell-/Streamingadresse für globale und
  regionale Oberflächenprodukte.
- `SurfaceRegion` bindet eine begrenzte lokale Simulation an einen stabilen
  planetaren Anker und einen `SurfaceLocalFrame`.
- `VoxelBrick` ist die sparse, editierbare Near-Field-Repräsentation für echte
  volumetrische Microvoxels, Höhlen, Überhänge und lokale Zerstörung.

World State, Voxel State und Simulation Authority bleiben von Three.js und
allen Render-LOD-Produkten unabhängig. Der Renderer darf grobe und feine
Darstellungen überblenden; er darf keine Terrain-, Entity- oder
Editentscheidung besitzen.

Das Qualitätsziel für lokale Microvoxels bleibt `0,25 m`. `0,50 m` ist der
verbindliche Performance-Fallback. Beide Werte sind Produktdirektiven, keine
bereits gemessenen Budgets. Reichweite, Brickgröße, Kanalbreite und
Hardwareprofil werden erst durch Benchmarks festgelegt.

## 2. Current Main / Code Foundation

- [Browser / Three.js Mainline ADR](../browser-mainline/adr-0001-threejs-mainline.md)
  legt Three.js als Browser-Mainline fest und weist Gameplay Truth dem
  deterministischen Core statt Scene Objects zu.
- [Browser Mainline Architecture](../browser-mainline/browser-architecture.md)
  trennt `world`, `render-three`, `sim`, UI und Testharness. Der Renderer
  konsumiert Snapshots.
- [Coordinate Spaces And Floating Origin](coordinate-spaces-and-floating-origin.md),
  [Real-Scale World Architecture](real-scale-world-architecture.md) und
  [Surface Local Frame Architecture](surface-local-frame-architecture.md)
  besitzen bereits die Frame-, Absolute-State-, Local-Projection- und
  Surface-Handoff-Regeln. Dieses Dokument spezialisiert sie für Planet-Tiles
  und Voxel-Bricks und definiert keine konkurrierende Framehierarchie.
- **[Code Evidence]** Der Planet-LOD-Audit beschreibt im aktuellen Browserpfad
  bereits deterministische World-Streaming-Zuweisungen, Budgets und
  Transitionen. Das ist eine generische Foundation, keine implementierte
  prozedurale Planet-Shell oder Microvoxel-Region.
- Eine produktive planetare Shell, ein SurfaceRegion-Handoff und ein
  Microvoxel-Mesher werden durch dieses Dokument nicht als vorhanden behauptet.

## 3. Research Evidence

Die Zielentscheidung normalisiert folgende Quellen:

- [Voxel Platform Reference Adoption Matrix v1](../research/voxel-platform-reference-adoption-matrix-v1.md)
- [Planet LOD & Streaming Reference Audit v1](../research/planet-lod-streaming-reference-audit-v1.md)
- [Browser Voxel Runtime Reference Audit v1](../research/browser-voxel-runtime-reference-audit-v1.md)
- [Voxel Meshing, Destruction, and Asset Audit v1](../research/voxel-meshing-destruction-asset-audit-v1.md)

**[Code Evidence]** Die Audits belegen bei mehreren Referenzen verwendbare
Motive für Cube-Sphere-/Quadtree-Adressierung, Screen-Space-Error,
Horizon-Culling, Parentfallback, getrennte Queues, sparse Bricks,
Worker-Revisionen und unterschiedliche Mesherrollen.

**[Observed Demo Evidence]** Sichtbare Planet-, Voxel- oder
Surface-to-Orbit-Demos belegen nur ihre beobachtete Darstellung. Sie beweisen
weder rissfreie Geometrie noch deterministische Adressierung, Authority,
Persistenz oder Simulationskontinuität.

**[Inference]** Keine untersuchte Engine wird Planet-, World- oder
Voxel-Authority. Konzepte werden in eigene Verträge überführt; Bibliotheken
bleiben gemäß Adoption Matrix Studien-, Adapter- oder Reuse-Kandidaten.

## 4. Frames And Precision

Die planetare Runtime verwendet die bestehende Frame-Authority, ohne deren
Transformationsmathematik hier zu wiederholen:

```text
Absolute/System Frame
  -> Body Inertial / Planet-Centered Frame
     -> Body-Fixed Frame at time
        -> SurfaceTile address
           -> SurfaceLocalFrame
              -> SurfaceRegion / VoxelBrick coordinates
```

Verbindliche Regeln:

- Astronomische, Körper- und dauerhafte Entitydaten verwenden hierarchische
  Double-Precision-Frames.
- GPU- und aktive lokale Physikwerte sind `float`-Projektionen relativ zur
  aktuellen Kamera oder zum lokalen Ursprung.
- Ein Floating-Origin-Wechsel ändert keine Body-, Tile-, Region-, Brick-,
  Entity- oder Editidentität.
- Position und Geschwindigkeit tragen beim Framewechsel Frame-ID,
  Referenzkörper und gemeinsame Zeit/Epoch.
- Tile- und Brickschlüssel werden nie aus einem aktuellen Three.js-Transform
  oder lokalen Floatwert rekonstruiert.

Die kanonischen Frame-Deskriptoren und Handoff-Invarianten bleiben Eigentum von
[Coordinate Spaces And Floating Origin](coordinate-spaces-and-floating-origin.md)
und [Surface Local Frame Architecture](surface-local-frame-architecture.md).

## 5. Planetary Data Model

### 5.1 Planetary Macro Data

Makrodaten sind klein, deterministisch rekonstruierbar und unabhängig von
aktueller Sichtbarkeit. Sie enthalten mindestens:

- stabile `BodyId` und Generator-/Dataset-Version,
- Body-Radius, Rotation und Framebindung aus dem
  [Celestial Runtime Data Contract](../spielkonzept/celestial-runtime-data-contract.md),
- Seed und versionierte globale Feldparameter,
- grobe Höhen-, Klima-, Biome-, Material- und Hazardkanäle,
- stabile authored Site-/Hotspot-Referenzen,
- Content-/Discovery-/Semantic-State-Versionen,
- keine vollständigen Voxelvolumen oder Rendermeshes.

### 5.2 SurfaceTile

Ein `SurfaceTile` besitzt eine stabile räumliche Identität aus Body, Cube-Face,
Level und ganzzahliger Tile-Adresse. Content-Epoch, Cacheort und Renderqualität
sind Metadaten, nicht räumliche Identität.

Getrennte Readiness-Kanäle umfassen:

- Geometrie und konservative Bounds,
- Material-/Biomeparameter,
- authored oder prozedurale Scatter-/Hotspot-Proxies,
- optionale Kollision nur für aktive Übergänge,
- referenzierten Semantic State, niemals aus dem Mesh zurückgelesen.

### 5.3 SurfaceRegion

Eine `SurfaceRegion` ist eine begrenzte, rekonstruierbare Simulations- und
Streamingeinheit. Sie besitzt:

- stabile `RegionId`, `BodyId` und abgedeckte Tile-Adressen,
- planetfesten Anker und `SurfaceLocalFrame`-Bindung,
- vertikalen Gültigkeitsbereich,
- Basis-Seed, Generatorversion und Editrevision,
- benötigte Render-, Collision-, Entity- und Semantic-Kanäle,
- expliziten Residency- und Handoffstatus.

Eine Region darf mehrere Tiles schneiden. Ihr Anker bleibt unabhängig vom
aktuellen Floating Origin.

### 5.4 Local VoxelBrick

Ein Brick enthält kanonische, sparse Kanäle für die aktive oder veränderte
Region. Sein Vertrag umfasst mindestens:

- `RegionId`, LOD und ganzzahlige Brickkoordinate,
- Auflösung, Samplemaß und benötigte Apron-/Nachbarrevisionen,
- Generator-, Schema-, Registry- und Editrevision,
- Density/SDF, Occupancy, Material und semantische IDs nach Bedarf,
- Contenthash und Provenance,
- keine Three.js-Objekte, Colliderinstanzen oder GPUhandles.

Aprons und Derived Products werden aus revisionierten Nachbarn erzeugt.
Ungeladene Nachbardaten dürfen nicht still als Luft oder unverändert behandelt
werden.

## 6. Authored Hotspot Overlay

Handgebaute Städte und Story-Hotspots überlagern die prozedurale Basis, ohne
deren globale Adressierung zu ersetzen:

1. Die prozedurale Basis erzeugt die reproduzierbare Makro- und
   SurfaceRegion-Grundlage.
2. Ein authored Hotspot besitzt stabile Site-/Asset-/Story-IDs, Bounds,
   Platzierungsframe und eine Prioritätsregel.
3. Der Hotspot kann Basisgeometrie maskieren, ergänzen oder durch vorbereitete
   semantische Volumen ersetzen.
4. Instanzzustand, Schäden, Ownership und Storyfortschritt liegen als Semantic
   State und Deltas über Template und Compileroutputs.
5. Fernproxies, lokale GLB-Darstellung und beschädigte Voxelbereiche sind
   verschiedene Projektionen derselben Hotspot-Instanz.

Die fachliche Story-Normalisierung ist Produktentscheidung und wird nicht aus
einem Mesher oder externen Planetprojekt abgeleitet. Das geplante
[Hestia-Konzept](../spielkonzept/hestia-procedural-voxel-world.md) besitzt die
Inhalts- und Spielerperspektive; diese Datei besitzt nur die Runtimegrenze.

## 7. Terrain And Building Meshing

Eine universelle Mesherpipeline ist ausdrücklich nicht Ziel:

| Domäne | Kanonische Grundlage | Bevorzugte Projektion | Grenze |
| --- | --- | --- | --- |
| Organisches Terrain, Höhlen, Überhänge | quantisierte SDF-/Density-Bricks | Regular Cells mit geprüftem Transvoxel-Übergang | Algorithmus und Auflösung bleiben Benchmarkentscheidung. |
| Achsenharte Microvoxel-Flächen | Occupancy plus Material-/Damage-Key | Greedy Meshing | Merge-Key und Grenzownership müssen deterministisch sein. |
| Intakte authored Gebäude | Compiler-Manifest und authored LODs | GLB-/optimierte Render-LODs | Kein unnötiges Runtime-Voxelmeshing des gesamten intakten Assets. |
| Freie Bruchflächen | lokale SDF-/Semantic-Bricks | gekapseltes Dual-Verfahren | QEF-/Fallback-Verfahren erst nach Golden-Corpus-Benchmark. |

Mesh, Collider, Navigation, BVH und Far-Field-Proxies sind getrennte Derived
Products derselben Eingaberevision. Ein schneller Render-Swap darf keinen noch
nicht bereiten Collision- oder Simulationshandoff vortäuschen.

## 8. LOD, Residency, Readiness And Authority

Diese vier Begriffe sind orthogonal:

| Begriff | Frage | Eigentümer |
| --- | --- | --- |
| LOD | Welche geometrische oder visuelle Detailstufe ist für den aktuellen View angemessen? | Selection/Scheduler und Rendererprojektion |
| Residency | Welche Macro-, Tile-, Region-, Brick- und Derived-Daten sind CPU-/Worker-/GPU-seitig vorhanden? | World Streaming und Caches |
| Readiness | Welche ausdrücklich benötigten Kanäle sind für Render- oder Simulationshandoff vollständig und revisionsgleich? | Pipeline-Gates |
| Authority | Welcher dauerhafte Zustand entscheidet über Terrain, Edits, Entities und Semantik? | World/Voxel/Simulation State |

Ein sichtbares Tile kann render-ready sein, obwohl lokale Kollision oder Entity
State noch nicht bereit ist. Ein Handoff in eine begehbare Region wartet auf
seine Simulationkanäle oder meldet begründetes `NOT READY`.

Bei `REPLACE` bleibt die gröbere Parent-/Proxy-Repräsentation aktiv, bis die für
den aktuellen View benötigte Kindabdeckung bereit ist. Teilfehler behalten den
Parent für die fehlende Coverage. Fade, Dither, Geomorph oder Atmosphäre dürfen
Pop-in kaschieren, aber keine fehlende Authority oder Collision verbergen.

## 9. Predictive Scheduler And Pipeline

Der Scheduler verarbeitet einen unveränderlichen Input-Snapshot und erzeugt
einen erklärbaren Plan. Auswahl und Ausführung bleiben getrennt:

```text
Selection and Priority
  -> Fetch or Generate
  -> Decode or Sample
  -> Mesh and Derived Products
  -> Upload or Physics Integration
  -> Readiness Gate
  -> Visibility or Simulation Handoff
```

Priorität berücksichtigt mindestens:

- Sicherheits- und Handoffpflicht,
- Sichtbarkeit und projizierten Fehler,
- aktuelle Geschwindigkeit und Zeit bis Bedarf,
- geplante Route, Brems- und Ausweichkorridor,
- Deadline und verfügbare Qualitätsfallbacks,
- Parent-/Nachbarabhängigkeiten,
- Queue-, Byte-, CPU-, Worker-, GPU- und Residencybudgets,
- stabile Tile-/Region-/Brick-ID als deterministischen Tie-Breaker.

Jeder Job trägt Request-ID, Planning Epoch, Zielschlüssel, Eingaberevision,
Generationstoken, Deadline und geschätzte Kosten. Cancellation entfernt noch
nicht gestartete Arbeit, bricht teure Stufen kooperativ ab, wo möglich, und
verhindert immer die Integration veralteter Ergebnisse. Ein verwertbares
stales Ergebnis darf nur revisionssicher in einen inhaltsadressierten Cache
gehen.

Wenn die Deadline nicht erreichbar ist, bleibt ein grober Proxy aktiv, die
Qualität wird reduziert, ein Autopilot-/Geschwindigkeitsgate greift oder der
Handoff meldet `NOT READY`. Die Runtime erzeugt kein Loch und behauptet keine
nicht vorhandene Simulationsfähigkeit.

## 10. Persistence And Reconstruction Boundary

Die planetare Runtime persistiert keine Renderbäume. Gespeichert werden:

- Seeds und versionierte Basisparameter,
- Template-, Generator-, Registry-, Compiler- und Schema-Versionen,
- stabile IDs und Semantic State,
- authored Hotspot-Instanzen,
- kanonische Voxel-/Struktur-Deltas und Revisionen,
- optional revisionierte Checkpoints und Cachehinweise.

Tiles, Meshes, Colliders, BVHs und GPUressourcen dürfen verworfen und aus dieser
Wahrheit rekonstruiert werden. Die genaue `WorldTemplate`-/`WorldInstance`- und
Online-/Offline-Grenze besitzt
[World Template, Instance, Online/Offline Transition](world-template-instance-online-offline-transition.md).

## 11. Required Invariants

- Gleiche Body-/Template-/Generator-/Editinputs erzeugen gleiche räumliche
  Schlüssel und kanonische Samples.
- Floating-Origin- und Renderframewechsel verändern keinen Plan-, Tile-,
  Region-, Brick- oder Contenthash.
- Eine alte Workerantwort kann keine neuere Revision überschreiben.
- Parentcoverage bleibt bis bestätigter Child-Readiness lückenlos verfügbar.
- Renderer-, Collision- und Navprodukte nennen ihre Quellrevision.
- Ein authored Hotspot kann prozedurale Basis überlagern, aber keine zweite
  globale World Authority eröffnen.
- Unpersistierte Edits und handoffkritische Produkte sind nicht evictbar.
- View-LOD und Simulation Residency dürfen unabhängig degradieren.

## 12. Open Benchmarks / Product Questions

- Reichweite und Kosten von `0,25 m` gegenüber `0,50 m` auf definierten
  Hardwareprofilen.
- Brick-Kantenlänge, Kanalencoding, Apronbreite und Memorybudget.
- Konkreter Terrainmesher, Dual-Verfahren und CPU-/WASM-/WebGPU-Aufteilung.
- Deterministische Face-Nachbartabelle, Horizon-Culling-Toleranzen und
  Surface-to-Orbit-Depthstrategie.
- Schedulergewichte, Deadlines, Cancellationkosten und High-Speed-Gates.
- SurfaceRegion-Größe, benachbarte Tangentialframes und sehr große Städte oder
  Höhlensysteme.
- Bake- und Invalidierungsweg für statische Far-Field-Stadtproxies.
- Netzwerkreplikation, Konflikte und Offline-/Online-Übergänge persistenter
  Voxel- und Semantic-Deltas.

Keine dieser offenen Fragen erlaubt bis zu ihrem Nachweis die Darstellung
einer Bibliothek, eines Meshers oder einer Performanceklasse als beschlossen
oder implementiert.
