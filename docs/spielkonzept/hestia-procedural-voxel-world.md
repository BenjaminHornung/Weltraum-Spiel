# Spielkonzept: Hestia als prozedurale Microvoxelwelt

Stand: 2026-07-13
Status: Verbindliche Docs-only-Planungsgrundlage, keine Runtime-Implementierung

## 1. Zweck und Authority

Hestia wird als prozedurale Low-Poly-Microvoxelwelt geplant, deren globale
planetare Form, lokale begehbare Regionen und handgebaute Orte aus einer
gemeinsamen, versionierten Weltbasis hervorgehen.

Die kanonischen physischen Daten, Monde, Klima- und Biomvorgaben bleiben in
[Spielkonzept: Starter-Sonnensystem](./startsystem.md). Dieses Dokument kopiert
oder verändert diese Werte nicht. Es legt ausschließlich fest, wie Hestia als
Produktwelt aus prozeduraler Basis, authored Hotspots und persistenten
Änderungen zusammengesetzt wird.

Die technischen Verträge für `SurfaceTile`, `SurfaceRegion`, `VoxelBrick`, LOD
und Streaming gehören in
[Procedural Voxel Planet Runtime](../architecture/procedural-voxel-planet-runtime.md).
Der Koordinatenvertrag bleibt
[Surface Local Frame Architecture](../architecture/surface-local-frame-architecture.md).

## 2. Verbindliche Zielentscheidungen

- Hestia ist eine prozedurale Low-Poly-Microvoxelwelt.
- Der Planet wird global nicht als vollständig volumetrisches Voxelvolumen
  gespeichert, übertragen oder gerendert.
- Planetare Makrodaten, `SurfaceTile`s, lokale `SurfaceRegion`s und
  `VoxelBrick`s bleiben getrennte Repräsentationen mit expliziten Handoffs.
- Echte volumetrische Microvoxels sind im Near Field für Gelände, Höhlen,
  Freilegung, Bauzustand und lokale Zerstörung zulässig.
- `0,25 m` ist das Qualitätsziel für relevante Microvoxelbereiche.
- `0,50 m` ist der definierte Performance-Fallback. Er ist kein Ersatz für das
  Qualitätsziel und nicht mit dem 0,5-m-Snap-Raster des Ship Builders
  gleichzusetzen.
- Handgebaute Städte und Story-Hotspots überlagern die prozedurale Basis über
  stabile, versionierte authored Deskriptoren.
- Terrain und Gebäude dürfen unterschiedliche Mesher und LOD-Produkte
  verwenden. Ihre semantische und persistente Wahrheit bleibt trotzdem in
  derselben World-/Voxel-Authority.
- World State und Voxel State sind unabhängig von Three.js. Three.js erhält nur
  abgeleitete Renderdaten über den
  [World Runtime / Render Backend Boundary](../architecture/world-runtime-render-backend-boundary.md).

## 3. Zusammensetzung der Hestia-Welt

Die Welt wird in dieser Reihenfolge ausgewertet:

```text
WorldTemplate und Generatorversionen
  -> prozedurale planetare Basis
  -> semantische Regionen, Biome und Site-Kandidaten
  -> authored Städte und Story-Hotspots
  -> WorldInstance Semantic State und Deltas
  -> Collision-, Navigation- und Renderprojektionen
```

Die Reihenfolge ist eine Authority-Reihenfolge, keine Renderreihenfolge.
Abgeleitete Meshes, Three.js-Objekte und Worker-Buffer dürfen niemals in die
prozedurale Basis oder den persistenten Zustand zurückschreiben.

### 3.1 Repräsentationsgrenzen

| Begriff | Produktverantwortung auf Hestia | Nicht seine Verantwortung |
| --- | --- | --- |
| Planetare Makrodaten | Globale Form, Klima-/Biomfelder, Materialverteilung und langlebige Site-Adressen. | Keine vollständige volumetrische Geometrie. |
| `SurfaceTile` | Adressierbare Shell-/LOD-Repräsentation für planetare Sichtbarkeit und Annäherung. | Kein lokaler Gameplay- oder Persistence-Owner. |
| `SurfaceRegion` | Begrenzter, rekonstruierbarer lokaler Simulations- und Handoffbereich in einem `SurfaceLocalFrame`. | Kein Ersatz für die globale Planetenshell. |
| `VoxelBrick` | Sparse, lokal editierbare volumetrische Datenbasis im Near Field. | Keine globale Planetendatenbank und kein Rendererobjekt. |
| Authored Hotspot | Stabile Überlagerung für Stadt, Story-Ort, Ruine oder andere kuratierte Identität. | Kein zweiter unabhängiger Weltzustand. |

Die feinere Repräsentation ersetzt die gröbere erst, wenn Daten, Collision und
notwendige semantische Bindungen bereit sind. Bis dahin bleibt die gröbere
Repräsentation aktiv.

### 3.2 Prozedurale Basis

Die prozedurale Basis muss aus Seeds, Algorithmusversionen und kanonischen
Parametern rekonstruierbar sein. Sie darf Hestias Vorgaben aus
[Starter-Sonnensystem](./startsystem.md) nicht durch zufällige Generatorwerte
überschreiben.

Die Basis darf unter anderem Küsten, Inselbögen, Riffe, Höhenfelder,
Materialzonen, Höhlenkandidaten und Site-Kandidaten liefern. Welche konkreten
Generatoren und Parameter verwendet werden, bleibt einem späteren
`Voxel Runtime Architecture Benchmark` und fachlichen Hestia-Biom-Specs
vorbehalten.

### 3.3 Handgebaute Städte und Story-Hotspots

Ein authored Hotspot braucht mindestens:

- eine stabile Hotspot-ID,
- eine Referenz auf Hestia und die betroffene globale Oberflächenadresse,
- einen Anchor in einem expliziten Frame,
- eine versionierte räumliche Maske und klare Überlagerungspriorität,
- Referenzen auf authored oder compiler-erzeugte Assets,
- semantische Rollen und Zustands-IDs,
- definierte Übergänge zu `WorldInstance` Semantic State und Deltas,
- deterministische Regeln für Kollisionen mit prozedural erzeugten Sites.

Ein Hotspot darf prozedurale Geometrie maskieren, ersetzen oder ergänzen, aber
nicht stillschweigend die globale Seedbasis verändern. Sein Zustand wird nicht
aus dem sichtbaren Mesh abgeleitet.

Die konkreten Services, Besitzer- und Cargo-Regeln eines Orts bleiben in
[Planetary Settlements And Outposts](./planetary-settlements-outposts.md).
Aktivitätstypen und die Trennung von wiederholbarem prozeduralem Content und
einzigartigen authored Orten bleiben in
[Planetary Exploration Loop](./planetary-exploration-loop.md).

Die in [Starter-Sonnensystem](./startsystem.md) beschriebenen
`Riff-Megacities` sind biologische Großbiome. Sie sind nicht automatisch eine
handgebaute Stadt, eine technologische Zivilisation oder ein Story-Hotspot.
Eine solche Zuordnung benötigt einen eigenen authored Deskriptor und eine
separate Storyentscheidung.

## 4. Ground Origin und späterer Space Loop

Der Spieler startet auf Hestia ohne eigenes Schiff. Die verbindliche
Progression steht in
[Ground Origin, Progression und erstes Schiff](./ground-origin-progression-and-first-ship.md).

Die Startregion ist ein authored Einstieg innerhalb der Hestia-Welt, aber dieses
Dokument legt weder konkrete Stadt noch Faction, Quest, Spawngebäude oder erstes
Schiff fest. Der Einstieg muss dieselben WorldTemplate-/WorldInstance- und
Hotspot-Regeln verwenden wie spätere Hestia-Orte; er ist keine separate
Tutorialwelt.

## 5. Persistence und Weltidentität

[WorldTemplate und WorldInstance](../architecture/world-template-instance-online-offline-transition.md)
trennen die rekonstruierbare Hestia-Basis von veränderlichem Zustand:

- Das `WorldTemplate` referenziert Seeds, Generator-/Compiler-Versionen,
  kanonische Hestia-Definitionen und authored Hotspots.
- Die `WorldInstance` hält Semantic State und Deltas wie Discovery, Ownership,
  Depletion, lokale Voxeländerungen und Storyzustand.
- Meshes, Collider, Navigation und Render-LOD sind abgeleitete Produkte und
  werden nicht als World Truth gespeichert.

## 6. Aktuelle Foundation auf main

Die Browser-Mainline besitzt bereits rendererunabhängige World-Snapshots,
stabile lokale/absolute Frame-Grundlagen sowie eine Chunk-/Residency-Foundation.
Die Grenzen sind in
[Browser Mainline Architecture](../browser-mainline/browser-architecture.md)
und im [Living Master Plan](../roadmap/living-master-plan.md) beschrieben.

Nicht vorhanden sind eine echte Hestia-Planetenshell, Surface-Streaming,
Microvoxel-Bricks, authored Städte, Ground-Origin-Runtime oder persistente
Voxel-Deltas. Dieses Dokument ändert keinen dieser Statuswerte.

## 7. Research-Unterstützung

- Der
  [Planet LOD & Streaming Reference Audit](../research/planet-lod-streaming-reference-audit-v1.md)
  unterstützt eine Representation Ladder mit globaler Shell, begrenzter
  `SurfaceRegion`, lokalem Microvoxel-Layer und Parent-Fallback.
- Der
  [Voxel Meshing, Destruction and Asset Audit](../research/voxel-meshing-destruction-asset-audit-v1.md)
  unterstützt getrennte Terrain-/Gebäude-Mesher, authored GLB-Repräsentationen
  und sparse persistente Edits.
- Der
  [Browser Voxel Runtime Reference Audit](../research/browser-voxel-runtime-reference-audit-v1.md)
  unterstützt eine eigene Authority-, Persistence- und Three.js-Grenze.

Diese Audits sind Research-Evidence. Sie beschließen keine externe Engine oder
Bibliothek und beweisen keine Hestia-Runtime.

## 8. Spätere Nachweise

Vor Runtime-Umsetzung müssen eigene Specs und Benchmarks mindestens zeigen:

- dass `0,25 m` in repräsentativen Near-Field-Szenarien innerhalb der Budgets
  bleibt oder kontrolliert auf `0,50 m` fällt,
- dass authored Hotspots dieselbe Basisadresse deterministisch überlagern,
- dass grobe Repräsentationen ohne Loch oder Wahrheitswechsel aktiv bleiben,
- dass Terrain- und Gebäude-Mesher kompatible, aber getrennte Produkte liefern,
- dass Save/Load aus Seeds, Versionen, Semantic State und Deltas denselben Ort
  rekonstruiert,
- dass Three.js-Objekte weder World State noch Voxel State besitzen.

## 9. Offene Produkt- und Benchmarkentscheidungen

- konkrete Startstadt oder Start-Hotspot auf Hestia,
- Anzahl, Größe und Verteilung handgebauter Städte,
- genaue Generatoren für Geologie, Biome und Höhlen,
- Materialpalette und Microvoxel-Kanalvertrag,
- messbare Umschaltkriterien zwischen `0,25 m` und `0,50 m`,
- Prioritätsregeln, wenn authored Hotspot, prozedurale Site und spätere Deltas
  dieselbe Fläche beanspruchen,
- konkrete Spieler- und Storyrolle der biologischen Riff-Megacities.

Diese Fragen dürfen nicht durch Asset-, Renderer- oder Library-Defaults
entschieden werden.
