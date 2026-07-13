# Planet LOD & Streaming Reference Audit v1

Stand: 2026-07-13
Repository-Basis: `origin/main` @ `c780656c29ff4e5794be9ba58d6b78396a5826d5`
Change: `research-planet-lod-streaming-reference-audit-v1`
Scope: Research und Architekturentscheidung; keine Runtime-, Asset-, Package-, Test- oder Roadmap-Änderung.

## Kurzurteil

**[Inference]** Für Weltraum-Spiel eignet sich keine einzelne durchgehende Geometrie- oder Engine-Repräsentation von Microvoxel bis Sternsystem. Empfohlen wird eine **hierarchische Repräsentationsleiter mit stabiler Datenautorität**:

1. analytische, hochpräzise System- und Körperzustände,
2. ein deterministischer Cube-Sphere-Quadtree als globale Planet Shell,
3. gekachelte makroskopische Oberflächeninhalte,
4. explizit geladene `SurfaceRegion`s in planetgebundenen Tangentialframes,
5. sparse, editierbare SDF-/Microvoxel-Bricks nur im Interaktionsbereich,
6. getrennte Render-, Kollisions- und Simulationsprodukte, die aus demselben dauerhaften Zustand abgeleitet werden.

**[Inference]** Die visuelle Übergabe darf mit Parent-Fallback, Geomorphing, Dither/Fade und Atmosphären-Aerial-Perspective kaschiert werden. Die Simulation darf dabei nie „überblenden“: Entity-ID, absolute Pose, Frame, Geschwindigkeit, Terrainbasis, Edit-Deltas und Missionszustand bleiben diskrete, deterministische Autorität.

**[Inference]** Externe Bibliotheken sollen nicht die Welt besitzen. Die stärksten Übernahmekandidaten sind Scheduler-, Culling-, Frame- und Renderingkonzepte hinter kleinen Adaptern. Globale 3D-Tiles-Datasets sind für statische, serverbereitete Far-Field-Stadtproxies plausibel; sie sind nicht die kanonische Form für dynamisch zerstörbare Voxeloberflächen.

## Fragestellung und Grenzen

Hauptfrage:

> Welche Repräsentations-, Tile-, LOD-, Koordinaten- und Streamingarchitektur eignet sich für kontinuierliche Reise von lokaler Microvoxel-Oberfläche bis Orbit, Systemraum und anderem Planeten?

Der Audit unterscheidet vier Dinge, die häufig unter „seamless“ zusammenfallen:

| Kontinuität | Bedeutung | Geforderter Nachweis |
| --- | --- | --- |
| Visuell | Kein sichtbarer Ladebildschirm, Loch oder harter Meshsprung. | Beobachtete Demo plus Render-/LOD-Evidence. |
| Räumlich | Eine Position lässt sich eindeutig und reversibel zwischen Frames abbilden. | Code-/Test-Evidence für Frame- und Koordinatenkonvertierung. |
| Simulativ | Identität, Zustand, Geschwindigkeit, Kollision, Terrainänderung und Regeln bleiben über den Handoff erhalten. | Code-/Test-Evidence für gemeinsame Datenautorität und Übergabeinvarianten. |
| Deterministisch | Gleiche Seeds, Edits und Eingaben erzeugen dieselbe adressierte Welt und denselben Plan. | Test- oder Benchmark-Evidence; ein sichtbares Video genügt nicht. |

Nicht Gegenstand dieses Changes sind Runtime-Implementierung, Engineport, finales Zahlen-Tuning, Contentpipeline, Netzwerkreplikation und eine Entscheidung für das endgültige Voxelmeshingverfahren.

## Evidenz- und Statusregeln

Jede externe Tatsachenbehauptung trägt eine der verlangten Klassen:

- **README Claim**: Behauptung aus README oder Projektdokumentation; nicht automatisch verifiziert.
- **Code Evidence**: aktueller gepinnter Source, Manifest, Lizenz, Beispiel- oder Implementierungspfad.
- **Test Evidence**: tatsächlich ausgeführter Test oder ein eng zugeordneter Testpfad; bloße Testdateiexistenz wird ausdrücklich so benannt.
- **Benchmark Evidence**: reproduzierbarer Benchmark mit Hardware/Version/Setup; Projekt-FPS ohne Setup sind kein Benchmark.
- **Observed Demo Evidence**: in einem echten Browser oder einer lokalen Demo sichtbar nachvollzogen; beweist keine verborgene Architektur.
- **Inference**: Architekturfolgerung für Weltraum-Spiel oder nicht direkt bewiesene Interpretation.

Statusvokabular:

- `PASS`: in diesem Audit erfolgreich ausgeführt/beobachtet.
- `FAIL`: ausgeführt und fehlgeschlagen.
- `NOT RUN`: nicht ausgeführt; Begründung ist Pflicht.
- `NOT APPLICABLE`: für das Projekt bzw. die Quelle nicht sinnvoll.
- `BLOCKED`: prinzipiell relevant, aber durch Zugriff, fehlende Artefakte oder sicheren Ausführungsrahmen blockiert.
- `PARTIAL`: Browser/Demo lief, aber der verlangte Zielflow oder sichtbare Inhalt wurde nicht vollständig bestätigt.
- `INCONCLUSIVE`: Beobachtung lief, die Ursache des Ergebnisses ist mit der vorhandenen Evidence nicht entscheidbar.
- `UNKNOWN`: statische Evidence reicht für eine Aussage nicht; dies ist kein Ausführungserfolg.

## Interne Projektgrenzen

**[Code Evidence]** `docs/architecture/real-scale-world-architecture.md` und `docs/architecture/coordinate-spaces-and-floating-origin.md` definieren dauerhaften absoluten Zustand als Wahrheit und Unity-Transforms/Rigidbodies als lokale Projektion. Framewechsel dürfen Gameplayzustand und Geschwindigkeit nicht verändern.

**[Code Evidence]** `.devtoolbox/specs/changes/real-scale-world-architecture-v1/specs/real-scale-world/spec.md` verlangt explizite Frame-Daten, `SurfaceLocalFrame`, genaue Surface-Targets, lokale Physikblasen und datengetriebene Hintergrundsimulation.

**[Code Evidence]** `.devtoolbox/specs/changes/browser-world-chunk-registry-streaming-core-v1/specs/default/spec.md` trennt bereits deterministische Residency (`Full`/`Snapshot`/`Dormant`) von Render-LOD (`Near`/`Medium`/`Far`/`Culled`) und verlangt Floating-Origin-Invarianz. Die Planetarchitektur soll diese Trennung erweitern, nicht durch Rendererzustand ersetzen.

**[Code Evidence]** `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/` setzt für V0 bewusst einen isolierten Surface-Testbereich vor vollem Terrainstreaming und nahtloser Landung. Die hier empfohlenen Spikes respektieren diese Reihenfolge.

---

## 1. Representation Ladder

**[Inference]** Die Ladder ist eine Folge von Daten- und Darstellungsprodukten, nicht eine Reihe unabhängiger Welten.

| Stufe | Räumlicher Bereich | Autoritative Daten | Render-/Physikprodukt | Eintritt | Austritt/Fallback |
| --- | --- | --- | --- | --- | --- |
| R0 Katalog/Universum | viele Systeme | Body-/System-IDs, Ephemeriden-/Katalogparameter, Zeit | Karte, Sterne, Marker | Ziel-/Kartenauswahl | R1-Systemzustand |
| R1 Systemraum | Sternsystem | hochpräzise absolute Posen/Geschwindigkeiten und Framegraph | kamera-relative Körperproxies, analytische Bahnen | Systemeintritt/aktive Route | R0-Katalog oder R2-Körperraum |
| R2 Body Far Field | interplanetar bis hoher Orbit | Bodydefinition, Radius, Rotation, Atmosphäre, grobe Oberflächenparameter | Low-LOD-Sphäre/Ellipsoid, Atmosphäre, Wolkenproxy | projizierte Körpergröße/SSE | immer verfügbarer Proxy für R3 |
| R3 Planet Shell | hoher Orbit bis Anflug | deterministische Cube-Face-/Quadtree-IDs, Makrohöhen-/Materialfelder | adaptive Shell-Tiles, Horizon/Frustum Culling | Shell-SSE und Sichtbarkeit | Parent-Tile oder R2-Proxy |
| R4 Surface Macro | niedriger Orbit bis Kilometerbereich | globale Tile-Adresse, Höhen-/Material-/Biomekanäle, langlebige Sites/Entities | hochauflösende Shell-/Heightfield-Tiles, Scatter-Cluster | Route-/Sichtkorridor und SSE | R3-Parent |
| R5 Surface Region | Kilometer bis Meter | `SurfaceRegionId`, Körperframe, Tangentialanker, World-State-Snapshot | lokale Physikblase, Terrain-/Collision-Chunks, Sites | geplante Landung/Interaktion | R4 plus persistenter Snapshot |
| R6 Microvoxel Edit Layer | Meter bis Millimeter/Spielauflösung | deterministische Basisfunktion + sparse Brick-Deltas/Operationen | SDF-/Voxelmeshes, Collider, Nav-/Occlusion-Ableitungen | Nähe, Werkzeug, Schaden, Höhle | gröbere Brick-/Region-Repräsentation |
| R7 Entity Detail | lokaler Kontakt | Entity-/Componentzustand | Schiffe, Spieler, Drohnen, Outpostmodule, VFX | Simulationsbudget | Snapshot/Dormant ohne GameObject |

Regeln:

- **[Inference]** R2/R3 bleiben während R4-R6 als räumlicher und visueller Fallback verfügbar; Detail ersetzt nicht die Identität des Planeten.
- **[Inference]** R6 überdeckt R4/R5 nur dort, wo ein editierbarer Bereich existiert. Ein ganzer Planet wird nicht als fein aufgelöstes Voxelvolumen materialisiert.
- **[Inference]** LOD-Auswahl ist kamera-/fehlergetrieben; Simulationsresidenz ist gameplay-/ereignisgetrieben. Beide dürfen unterschiedliche Budgets und Prioritäten haben.
- **[Inference]** Jede Stufe besitzt einen stabilen Schlüssel und eine Herkunftsversion, sodass Cacheinhalt verworfen werden kann, ohne Weltzustand zu verlieren.

## 2. Planet Shell Architecture

### 2.1 Topologie und Adressierung

**[Inference]** Empfohlen ist eine sechsseitige Cube-Sphere mit Quadtree pro Face. Sie vermeidet Polsingularitäten einer Latitude/Longitude-Kachel und bildet rechteckige Hierarchien für GPU, Cache und Nachbarn.

Vorgeschlagener logischer Schlüssel:

```text
PlanetTileId
  BodyId
  Face          // 0..5, feste dokumentierte Orientierung
  Level         // 0 = Face-Root
  X, Y          // oder MortonKey
  ContentEpoch  // Generator-/Dataset-Version, nicht Teil räumlicher Identität
```

**[Inference]** `BodyId + Face + Level + X + Y` ist die dauerhafte räumliche Identität. Meshformat, Renderer, Cachepfad und aktuelle Qualitätsstufe sind abgeleitete Metadaten.

### 2.2 Tilevertrag

Jedes Shell-Tile sollte getrennte Kanäle deklarieren:

| Kanal | Beispiele | Readiness |
| --- | --- | --- |
| Geometrie | Bounds, geometric error, Height/Displacement oder Mesh | CPU + GPU |
| Oberfläche | Material-/Biome-/Normal-/Albedo-Parameter | GPU oder Fallbackmaterial |
| Atmosphäre/Wolken | nur Body-/Wetterparameter, keine Tileautorität | Adapter-ready |
| Scatter | Felsen, Vegetation, Gebäudeproxy-Referenzen | optional; eigene Budgets |
| Kollision | vereinfachtes Heightfield/Mesh/SDF-Produkt | nur aktive SurfaceRegion |
| Simulation | Sites, Entities, Claims, Ressourcen, Edits | niemals aus sichtbarem Mesh abgeleitet |

**[Inference]** Ein Tile darf renderbereit sein, obwohl Scatter oder lokale Kollision noch fehlen. Ein Landungs-/Interaktionshandoff darf dagegen erst erfolgen, wenn die für diesen Handoff geforderten Kanäle explizit ready sind.

### 2.3 Fehler, Split und Merge

**[Inference]** Die Shell verwendet eine dimensionsbehaftete geometrische Fehlergrenze pro Tile und projiziert sie in Pixel:

```text
screenSpaceErrorPx ~= geometricErrorMeters * projectionScale / max(distanceMeters, epsilon)
```

Die genaue Formel wird im Spike kalibriert. Wichtig sind:

- Split- und Merge-Schwellen mit Hysterese,
- monotone Eltern-/Kindfehler,
- konservative Distanz zu Bounding Volume statt nur Tilezentrum,
- stabile Priorität als reine Funktion aus Snapshot, Kamera, Route und Budgets,
- kein Split allein aufgrund eines Render-Frame-Zeitpunkts.

### 2.4 Kanten und Nähte

**[Inference]** Cube-Face-Nachbarschaft wird in einer zentral getesteten Tabelle definiert. Für sichtbare Nähte sind mehrere, voneinander unabhängige Mechanismen nötig:

- identische Grenzabtastung derselben deterministischen Feldfunktion,
- gleiche Quantisierung/Encoding-Regeln an beiden Seiten,
- Level-Differenzbeschränkung zwischen Nachbarn,
- Skirts als robuste Fern-/Fallback-Abdeckung,
- Geomorph oder Dither/Fade für unterschiedliche Tessellation,
- gemeinsame Normalen-/Materialableitung über die Grenze.

Skirts verdecken Löcher, beweisen aber keine topologisch identische Geometrie. Deshalb wird „seamless“ erst nach Edge-Tests und beobachteter Bewegung bestätigt.

## 3. Surface Region Architecture

### 3.1 Region statt Planetenvollvoxel

**[Inference]** Eine `SurfaceRegion` ist eine begrenzte, rekonstruierbare lokale Simulationseinheit, an eine globale Shelladresse und einen `SurfaceLocalFrame` gebunden:

```text
SurfaceRegionDescriptor
  RegionId
  BodyId
  AnchorPlanetFixed
  TangentFrameOrientation
  CoverageTiles[]
  VerticalRangeMeters
  GeneratorVersion
  BaseSeed
  EditRevision
  RequiredChannels
```

Die Region kann mehrere Shell-Tiles schneiden; ihr stabiler Anker darf nicht aus dem aktuellen Floating Origin abgeleitet werden.

### 3.2 Terrainbasis und destruktive Deltas

**[Inference]** Empfohlen wird ein hybrides Feld:

- deterministische makroskopische Basis aus Height/Noise/Biomefunktion,
- optional volumetrische SDF-Basis für Überhänge/Höhlen in markierten Regionen,
- sparse Brickstruktur nur für aktive oder veränderte Bereiche,
- persistente Editoperationen oder kanonische Brick-Deltas,
- abgeleitete Mesh-, Collider-, Nav-, Occlusion- und Materialprodukte mit Revisionsschlüssel.

**[Inference]** Globale Shellhöhe und lokale Voxelbasis müssen an der Handofffläche dieselbe Basishöhe/-dichte auswerten. Destruktionsdeltas leben oberhalb dieser Basis und dürfen nicht in ein statisches Fern-Tile „zurückgeschrieben“ werden müssen. Fernrepräsentationen können später asynchron aus Deltas aktualisiert oder durch einen konservativen Schadenproxy ergänzt werden.

### 3.3 Chunking

**[Inference]** Microvoxel-Chunks werden in Region-/Brickkoordinaten adressiert, nicht in Render-Transformkoordinaten. Ein Chunkvertrag enthält:

- `RegionId`, `Lod`, ganzzahlige `X/Y/Z`,
- Sample-/Cell-Auflösung und Ghost-/Border-Samples,
- Basisgenerator- und Editrevision,
- Neighbor-Revisionen,
- Produktstatus für Density, Mesh, Collider und GPU,
- Kostenmetadaten für Scheduler und Cache.

**[Inference]** Chunkpooling darf Speicher und Objekte wiederverwenden, nie Identität. Beim Rebind werden Generationstoken erhöht; späte Workerantworten mit altem Token werden verworfen.

### 3.4 Datenautorität

**[Inference]** Die Reihenfolge der Autorität lautet:

```text
World/Body State
  -> deterministic base field + durable edit state
  -> density/height samples
  -> mesh/collider/nav/render products
```

Ein Renderer- oder Worker-Cache ist nie die einzige Quelle einer Zerstörung, Ressourcendepletion oder Höhle.

## 4. Predictive Streaming

### 4.1 Getrennte Pipeline

**[Inference]** Der Scheduler erhält einen unveränderlichen `StreamingInputSnapshot` und erzeugt einen deterministischen Plan. Ausführung und Sichtbarkeit bleiben getrennt:

```text
Selection / Priority
  -> Request Queue
  -> Download or Generate Queue
  -> Parse / Density / Mesh Queue
  -> GPU Upload / Physics Integrate Queue
  -> Readiness Gate
  -> Visibility / Simulation Handoff
```

Jede Queue hat eigenes Concurrency-, Byte-, Zeit- und Ergebnisbudget. Ein einzelnes globales „loading“-Flag reicht nicht.

### 4.2 Kandidaten

Kandidaten entstehen aus:

- Sichtfrustum und projiziertem Fehler,
- konservativem Horizonttest,
- Bewegungsrichtung und Geschwindigkeit,
- Autopilot-/manuellem Routenkorridor,
- Brems-/Ausweichkorridor,
- Ziel-/Landungs-/Missionssemantik,
- Nachbar- und Parent/Child-Abhängigkeiten,
- aktuellen Cache-/Queuekosten.

**[Inference]** Eine mögliche lexikografische Priorität ist:

```text
requiredForSafety
requiredForHandoff
timeToNeedBucket
visibilityBucket
screenSpaceErrorBucket
routeDistanceBucket
cacheCostBucket
stableTileOrChunkId
```

Lexikografische, quantisierte Felder sind leichter deterministisch zu testen als eine schlecht kalibrierte Fließkomma-Gesamtsumme.

### 4.3 Cancellation und Staleness

**[Inference]** Jede Arbeit trägt `RequestId`, Content-/Editrevision und Generationstoken. Cancellation ist kooperativ und stufenbezogen:

- noch nicht gestartete Arbeit wird aus der Queue entfernt,
- Fetch/Worker wird abgebrochen, wenn API und Kosten dies erlauben,
- bereits teure Ergebnisse dürfen in einen inhaltsadressierten Cache gehen,
- Integration verwirft Ergebnisse, deren Token/Revision nicht mehr zum Slot passt,
- sichtbare Parents werden nicht durch Cancellation der Children beeinflusst.

## 5. High-Speed Streaming

**[Inference]** Hohe Geschwindigkeit ist kein bloß größerer Sichtradius. Der Scheduler muss Zeit bis Bedarf und sichere Rückfallstufen berücksichtigen.

### 5.1 Swept Volume

Der Vorhersagebereich kombiniert:

- aktuellen Frustumkörper,
- geschwindigkeitsgestreckten Kegel/Kapselkorridor,
- geplante Route und Kurvenradius,
- Bremsweg aus aktueller Autorität/Masse,
- seitlichen Ausweichkorridor,
- Ziel-/Handoffvolumen.

### 5.2 Qualitätsstufen nach Zeit

| Zeit bis Bedarf | Mindestprodukt |
| --- | --- |
| weit voraus | Body-/Parentproxy und grobe Bounds |
| früh | Shell-Parent/Child-CPU-Daten, grobes Material |
| mittelfristig | GPU-Renderready, Nachbarn/Seams |
| vor Eintritt | Collision-/SurfaceRegion-Snapshot |
| Interaktionsnähe | High-detail Mesh/Collider, relevante Entities, Voxel-Edits |

**[Inference]** Wenn die Pipeline die Deadline nicht erfüllt, muss das System Qualität reduzieren, Geschwindigkeit/Autopilot-Handoff begrenzen oder einen expliziten `NOT READY`-Zustand liefern. Es darf weder in ein Loch fliegen noch Simulationsfähigkeit vortäuschen.

### 5.3 Teleport und Richtungswechsel

**[Inference]** Große Diskontinuitäten erzeugen eine neue Planning Epoch. Sichtbare Fallbackproxies bleiben, alte Prefetcharbeit verliert Priorität oder wird storniert, und Hysterese wird kontrolliert neu initialisiert. Ein Teleport darf nicht tausende obsolete Childloads „abarbeiten“.

## 6. Parent/Child Readiness

### 6.1 Zustandsmodell

**[Inference]** Empfohlene Load-State-Maschine:

```text
Absent
  -> Queued
  -> FetchingOrGenerating
  -> DecodingOrMeshing
  -> CpuReady
  -> UploadingOrIntegrating
  -> Ready
  -> Active
  -> Evicting

Any in-flight -> CancelRequested -> Canceled
Any work stage -> Failed(retry policy)
```

Orthogonale Zustände:

- Refinement: `ADD` oder `REPLACE`,
- Selection: `Wanted`, `Prefetch`, `Fallback`, `Unwanted`,
- Visibility: `Hidden`, `FadingIn`, `Visible`, `FadingOut`,
- Simulation: `Dormant`, `Snapshot`, `Full`,
- Content readiness: Geometrie, Material, Collider, Entities, Edits.

### 6.2 Replacement Gate

**[Inference]** Bei `REPLACE` bleibt der Parent sichtbar, bis die für den aktuellen View relevante Kindabdeckung renderbereit ist. Nicht sichtbare Children dürfen das Gate nicht blockieren, solange keine Lücke entstehen kann. Bei Teilfehler bleibt der Parent für die fehlende Coverage erhalten.

**[Inference]** Fade/Dither startet erst nach Readiness und ändert keine Selection- oder Simulationsentscheidung. Während des Fades sind Parent und Child gleichzeitig Renderkosten; das Budget muss diesen Übergang einplanen.

### 6.3 Eviction

**[Inference]** LRU ist eine Kosten-/Residencyheuristik, kein Wahrheitsmodell. Nicht evictbar sind aktuell sichtbare Fallbackparents, Handoff-kritische Produkte und unpersistierte Edits. Cacheeinträge referenzieren Contenthash, Revision, Größe, letzte Nutzung und Pin-Grund.

## 7. Horizon Culling

**[Inference]** Horizon Culling wird im planetzentrierten oder planetfesten Double-Precision-Frame gerechnet, bevor Tilekoordinaten in den Renderframe projiziert werden.

Erforderliche Bounds:

- konservative Tile-Bounding-Sphere oder OBB,
- minimale/maximale radiale Höhe,
- optional Horizon-/Occlusion-Point bzw. Kegel,
- Atmosphäre/Wolken separat, weil sie über der Terrainhülle liegen.

Pipeline:

1. Body außerhalb des System-/Kamerafrustrums verwerfen.
2. Tile gegen Planet-/Ellipsoid-Occluder konservativ testen.
3. verbleibende Tiles gegen Frustum testen.
4. SSE/Priorität nur für Kandidaten berechnen.

**[Inference]** Nahe Bodenansicht, hohe Berge, Höhlen/Untergrund, stark nichtkugelige Asteroiden und Camera-inside-Bounds brauchen konservative Sonderfälle. Falsch-positive Sichtbarkeit kostet Performance; falsch-negative Sichtbarkeit erzeugt Löcher und ist daher schlimmer.

## 8. Coordinate Frames

### 8.1 Framegraph

**[Inference]** Empfohlene Hierarchie:

```text
SystemInertialFrame
  -> BodyInertialFrame
     -> BodyFixedFrame(time, rotation model)
        -> PlanetTileFrame(face, level, x, y)
           -> SurfaceLocalFrame(anchor, east/north/up or tested tangent basis)
              -> SurfaceRegionFrame
                 -> VoxelChunkFrame

CurrentRenderFrame / CurrentPhysicsFrame are projections, not parents of durable state.
ShipLocalFrame and OutpostSiteFrame attach semantically to an active durable frame.
```

Jede grenzüberschreitende Pose enthält:

- Frame-ID und Referenzkörper,
- Position und Orientierung,
- Geschwindigkeit plus Geschwindigkeitsframe,
- gültige Simulationszeit/Epoch,
- Einheiten/Skala,
- optional Unsicherheit/Quelle bei Katalogdaten.

### 8.2 Große Koordinaten

**[Inference]** System-/Bodyzustände nutzen eine hochpräzise Repräsentation (zunächst `double`, später nur bei nachgewiesenem Bedarf segmentiert/fixed). GPU- und Unity-Transforms erhalten kamera-/origin-relative `float`-Werte. High/low-Splitting oder camera-relative Matrizen sind Renderdetails und dürfen die CPU-Autorität nicht ersetzen.

### 8.3 Framewechsel

**[Inference]** Ein Wechsel ist eine atomare Projektionstransaktion:

1. absoluten/Quellzustand bei Zeit `t` festhalten,
2. Ziel-Frame und Transform bei demselben `t` bestimmen,
3. Pose und Geschwindigkeit inklusive Framebewegung/Rotation konvertieren,
4. lokale Physik-/Renderobjekte neu projizieren,
5. relative Distanzen, Geschwindigkeit, Entity-ID und Zielbindung prüfen,
6. erst danach altes lokales Produkt freigeben.

## 9. Dynamic Near/Far

**[Inference]** Eine einzelne Kamera mit extremem `near/far`-Verhältnis ist nicht die Architektur. Empfohlen wird eine tiefenpräzisionsbewusste Darstellung:

- reversed-Z, sofern Renderpipeline/Plattform verifiziert,
- camera-relative Geometrie,
- dynamische, geglättete Near Plane nach Cockpit-/Hull-/Surfacekontext,
- Far Plane nur bis zum aktuellen lokalen Renderband,
- getrennte Celestial-/Far-Field-Pässe oder Depth Partitioning für astronomische Proxies,
- Atmosphären- und Wolkenpässe mit klarer Depth-Integration.

**[Inference]** Near/Far-Werte werden aus sichtbaren konservativen Bounds, Kamera-/Fahrzeugkontext und Mindestabständen abgeleitet, mit Hysterese gegen Pumpen. Physik-/Streamingradien hängen nicht an der aktuellen Far Plane.

Zu testende Fälle:

- Cockpit-/Schiffsnähe ohne Clipping,
- Boden bis Horizont,
- Start/Oberflächenaufstieg,
- niedriger zu hoher Orbit,
- Mond/Planet hinter lokaler Geometrie,
- schnelle Near/Far-Änderung ohne Z-Fighting-Puls.

## 10. Atmosphere/Cloud Adapter

**[Inference]** Takram oder ein anderer Renderer wird ausschließlich hinter einem Adapter konsumiert. Die Simulation liefert unveränderliche Parameter; der Renderer liefert Renderprodukte, nicht Weltwahrheit.

Vorgeschlagener Input:

```text
AtmosphereRenderInput
  BodyId
  BodyCenterRenderRelative
  GroundRadiusMeters
  AtmosphereOuterRadiusMeters
  ObserverBodyFixedPosition
  SunDirectionsAndRadiance[]
  Rayleigh/Mie/Ozone coefficients and scale heights
  Ground albedo/emission
  Planet rotation/time
  CloudLayerDescriptors[]
  WeatherSnapshotId
  QualityProfile
  Depth/Color integration handles
```

Cloudparameter aus Simulation/Datenautorität:

- Layerhöhe/-dicke,
- Coverage/Density-/Humidityfelder oder Seed+Revision,
- Windvektor im Körperframe,
- Wetterzeit/Epoch,
- Niederschlag/Storm-/Hazardflags,
- Beleuchtungs-/Schattenparameter.

**[Code Evidence]** Der bestehende Weltraum-Spiel-Vertrag docs/spielkonzept/celestial-runtime-data-contract.md liefert bereits surfacePressurePa, scaleHeightMeters, atmosphereOuterRadiusMeters, GasMixture und Hazardflags. **[Inference]** Ein versioniertes Renderprofil leitet daraus Spektral-/Streukoeffizienten ab; Druck, Gase und Hazards bleiben Simulationsdaten und werden nie aus Takramzustand zurückgelesen.

Renderer-owned bleiben LUTs, temporale History, Raymarch-Schritte, Dither, RenderTargets und GPU-Caches. Ein Adapter schützt gegen WebGL-/WebGPU-API-Wechsel und erlaubt einen einfachen Fallback für Tests/headless.

## 11. Surface-to-Orbit Evidence

Ein glaubwürdiger sichtbarer Flug vom Boden in den Orbit beweist nur einen Teil der Architektur. Dieser Audit bewertet Evidence in Stufen:

| Stufe | Nachweis |
| --- | --- |
| E0 Behauptung | README/Video sagt „seamless“. |
| E1 Sichtbar | echter Browser-/Demoablauf zeigt Boden, Aufstieg, Planet und Orbit ohne sichtbaren Ladebruch. |
| E2 Renderintern | Source zeigt tatsächliche Planet-LODs, Parentfallback, Culling, Worker/Queues und Koordinatenstrategie. |
| E3 Räumlich | Tests/Source zeigen stabile Frame-/Origin-Konvertierung und Positionsspeicherung. |
| E4 Simulativ | dieselbe Entity-/Terrain-/Physikautorität bleibt über den Handoff erhalten; lokale Edits bleiben korrekt adressiert. |
| E5 Deterministisch/perf | reproduzierbare Tests/Benchmarks belegen Wiederholbarkeit und Budgetverhalten. |

**[Inference]** Eine Adoptionsempfehlung für Weltraum-Spiel benötigt nicht zwingend E4/E5, aber das Dokument darf E1 niemals als Beweis dafür ausgeben.

## Gepinnte Projekt- und Quellenaudits

Bewertungsskala: 1 = schwach/niedrig, 5 = stark/hoch. Bei Integration Cost bedeutet 5 hohe Kosten. Ein vorhandener Testpfad ist Code Evidence über Testabdeckung; erst eine in diesem Audit ausgeführte Suite wäre Test Evidence.

Pin, Ref, Commitdatum, Lizenzpfad, Manifest und Sourcepfad sind **Code Evidence** aus dem gepinnten Clone. Demo-/Browserbeobachtungen sind **Observed Demo Evidence**; Build-/Teststatus beschreiben die Ausführung dieses Audits. UNKNOWN und Architekturfolgen bleiben ausdrücklich UNKNOWN beziehungsweise Inference.

### Reproduzierbare Statusmatrix

| Projekt | Buildstatus | Teststatus | Demostatus | Browserstatus | Bekannte Einschränkungen |
| --- | --- | --- | --- | --- | --- |
| 3DTilesRendererJS | NOT RUN; Scripts geprüft | NOT RUN; Sources geprüft | PASS Mars/Lunar | PASS, Console/Network | keine Benchmarks; Ion-Abhängigkeit; keine dynamische Autorität |
| Cesium | NOT RUN; Prepare hostinvasiv | NOT RUN; 182 Fälle Source-inspected | Sandcastle erreichbar | PARTIAL für Shell/Ausführung, Inhalt beim Snapshot noch Loading | vollständige Geospatial-Engine; nicht jede Anfrage cancelbar |
| OpenSpace | NOT RUN; nativer Submodulstack | NOT RUN; 29 Fälle Source-inspected | NOT RUN, native App | NOT APPLICABLE | kein Terrain-/Voxelmodell; Datenlizenzen separat |
| Cosmonium | NOT RUN; Panda3D-dev/C++/Datenrepo | NOT RUN; 477 Definitionen Source-inspected | NOT RUN, native App | NOT APPLICABLE | GPL, Mixed Language, frühe Reife, separates Datenrepo |
| neural-planetoid | NOT RUN; Scripts geprüft | NOT RUN; keine Tests gefunden | PASS, öffentliche Demo | PASS, Console/Network | WASM-MIME-Fallback; keine bewiesene Naht/Cancellation/Pool |
| PlanetTech | NOT RUN | NOT RUN; Status UNKNOWN/veraltet | FAIL, GitHub Pages 404 | FAIL, HTTP 404 beobachtet | Lizenzwiderspruch, Alpha, keine Scheduler-/Cullingreife |
| Godot Cuberact | NOT RUN; Godot 4.6 nötig | NOT RUN; keine Tests gefunden | NOT RUN; keine öffentliche Browserdemo | NOT APPLICABLE | synchrones Heightfield, Ein-Planet-Frame, keine Benchmarks |
| ClaudeCitizen | NOT RUN | NOT RUN; keine passende Suite gefunden | PARTIAL | PARTIAL, Console/Network | keine Lizenz, GLTF-404, Handoff nicht beobachtet |
| Takram | NOT RUN; Scripts geprüft | NOT RUN; kleine Testsuite vorhanden | WebGL PASS; WebGPU INCONCLUSIVE | WebGL PASS; WebGPU INCONCLUSIVE/UNKNOWN | API-Rewrite, ECEF/Three-Kopplung, keine Benchmarks |

### NASA-AMMOS/3DTilesRendererJS

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/NASA-AMMOS/3DTilesRendererJS |
| Commit / Datum / Ref | **1ad00acfb12926dea1ce4aa084a4d5ac16676601**; 2026-07-10T16:17:21+09:00; master |
| Lizenz | Apache-2.0; LICENSE |
| Untersuchte Pfade | package.json, README.md, src/core/renderer/tiles/TilesRendererBase.js, traverseFunctions.js, constants.js, LRUCache.js, PriorityQueue.js, src/three/renderer/tiles/TilesRenderer.js, TileBoundingVolume.js, src/three/plugins/fade/*, LoadRegionPlugin.js, test/core/*, test/three/*, Mars/Lunar/LoadRegion examples |
| Build-/Teststatus | NOT RUN; read-only Audit benötigte keine Dependency-Installation; Manifest ohne preinstall/postinstall geprüft, nur prepublishOnly; Tests Source-inspected |
| Demo-/Browserstatus | PASS: Dingo-Gap-Mars und Cesium-Ion-Lunar in echter Playwright-Session; Console und Network geprüft; Screenshots nur temporär unter C:\tmp |
| Einschränkungen | keine Benchmarks; Demos belegen keine editierbare Oberfläche oder Simulationsübergabe; Lunar hängt von Cesium Ion ab |

Pflichtbefunde:

- **Core/Renderer — Code Evidence.** Separate Core- und Three-Exports. [TilesRendererBase](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/core/renderer/tiles/TilesRendererBase.js) besitzt Traversal, Tilezustand, Cache, Queues und Pluginhooks ohne Three-Szenenoperationen; der [Three TilesRenderer](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/three/renderer/tiles/TilesRenderer.js) ergänzt Kamera/Frustum, Bounds, Parser und Scene-Attachment.
- **Tile State Machine — Code Evidence.** UNLOADED -> QUEUED -> LOADING -> PARSING -> LOADED, Fehler nach FAILED, Dispose/Eviction zurück nach UNLOADED; Zustände in [constants.js](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/core/renderer/constants.js).
- **SSE — Code Evidence.** Perspektivisch geometricError/(distance*sseDenominator), orthografisch geometricError/pixelSize; Defaultziel 16 Pixel. Multi-Camera nimmt höchsten sichtbaren Fehler und kleinste Distanz.
- **Download-/Parse-Queues — Code Evidence.** Getrennte [PriorityQueue](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/core/renderer/utilities/PriorityQueue.js)-Instanzen, Defaults 25 Downloads und 5 Parses. Priorität nutzt expliziten Wert, Nutzung, SSE, Distanz und Tiefe.
- **LRU — Code Evidence.** [LRUCache](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/core/renderer/utilities/LRUCache.js) kombiniert Item-/Bytebudgets, Used/Unused je Traversal und geplante Eviction. Defaults 6000/8000 Tiles und etwa 0,3/0,4 GiB; tiefere Children vor Parents, externe Tilesets zuletzt.
- **Cancellation — Code Evidence.** Ein AbortController pro Tile speist Fetch und Parse. Noch nicht gestartete Queuejobs werden entfernt; Cache-Removal abortiert gestartete Arbeit. removeUnusedPendingTiles entfernt bei Kameraänderung bewusst nur QUEUED, nicht LOADING/PARSING: vorhanden, aber kein aggressiver High-Speed-Canceller.
- **Parent/Child-Replacement — Code Evidence.** REPLACE ist Default, ADD hält Parent und Children gemeinsam. loadAncestors=true; bottom-up allChildrenLoaded/allChildrenReady hält einen renderbaren Parent sichtbar und verwirft unvollständig bereite Childcoverage. [Traversal](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/core/renderer/tiles/traverseFunctions.js)
- **Fade — Code Evidence.** [TilesFadePlugin](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/three/plugins/fade/TilesFadePlugin.js) mutiert Materialzustand und hält ausblendende Tiles im Cache; Default 250 ms/50 Fades. Es kaschiert Pop-in, beweist weder Geometrie- noch Simulationskontinuität.
- **Load Region — Code Evidence.** [LoadRegionPlugin](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/1ad00acfb12926dea1ce4aa084a4d5ac16676601/src/three/plugins/LoadRegionPlugin.js) unterstützt Sphere, Ray, OBB, Masken und eigene Fehlerziele. Kein geschwindigkeits-/trajektorienbasierter Prefetcher.
- **Bounding Volumes — Code Evidence.** Sphere, OBB und geodätische Region; Regionen intern teilweise per OBB angenähert. Gut für konservatives Culling, nicht für exakte Gameplaykollision.
- **Three Adapter — Code Evidence.** Kamera/Frustum werden in den Tileset-Rootframe transformiert; Adapter baut Bounds, lädt/parst Content und hängt sichtbare Tile-Scenes an. Das stützt eine Scheduler-/Renderergrenze.
- **Tests — Code Evidence.** Tests existieren für LRU, PriorityQueue, Scheduler, Traversalhelper, Base-Renderer und Three-Typen; keine umfassenden direkten Tests für aktuellen Ancestor-Fallback, Fade oder LoadRegion gefunden. [test/core](https://github.com/NASA-AMMOS/3DTilesRendererJS/tree/1ad00acfb12926dea1ce4aa084a4d5ac16676601/test/core)

Browser/Demo:

- **Observed Demo Evidence.** [Dingo Gap Mars](https://nasa-ammos.github.io/3DTilesRendererJS/three/mars.html) zeigte Terrain sowie Fog-, Bounds-, Topolines- und SSE-Steuerung; beide Tilesets und hunderte B3DM-Requests lieferten HTTP 200. Console: nur favicon 404.
- **Observed Demo Evidence.** [Cesium-Ion Lunar](https://nasa-ammos.github.io/3DTilesRendererJS/three/ionLunar.html) lud Root/Subtilesets und Lunar-B3DM mit HTTP 200. Console: Warnung, dass 3D Tiles ab 1.1 nur eingeschränkt unterstützt werden.
- **Inference.** Mars belegt lokales Photogrammetriestreaming, Lunar eine gekachelte Shell in Orbitnähe. Keines belegt Microvoxelinteraktion, deterministische Terrainregeneration oder Simulation Continuity.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3/5 | 4/5 Konzept; 2/5 direkter Unity-Code | 5/5 | 2/5 | 3/5 | 2/5 | 5/5 | 5/5 Port; 3/5 Far-Field | 4/5 |

**Main Risks — Inference:** Renderzustand als Autorität; keine dynamische Topologie; globale Defaultqueues; begrenzte 3D-Tiles-1.1-Unterstützung.

**Abschlussurteil: Study and extract concepts.** Scheduler-/Readiness-Muster sind übertragbar; ein JS/Three-Port nicht. 3D Tiles ist ein Kandidat als externes Toolformat für statische, serverbereitete Far-Field-Stadtproxies. Dynamische Voxelzerstörung bleibt im separaten Edit-/Regionzustand und invalidiert, überdeckt oder rebaket Proxies.

### CesiumGS/cesium

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/CesiumGS/cesium |
| Commit / Datum / Ref | **4040586054a1abf650dff1a6e2530b3e3e683513**; 2026-07-13T13:48:29Z; main; package 1.143.0 |
| Lizenz | Apache-2.0; LICENSE.md |
| Untersuchte Pfade | QuadtreePrimitive.js, QuadtreeTile.js, GlobeSurfaceTile.js, GlobeSurfaceTileProvider.js, TileReplacementQueue.js, QuantizedMeshTerrainData.js, TerrainEncoding.js, RequestScheduler.js, EncodedCartesian3.js, EllipsoidalOccluder.js, createVerticesFromQuantizedTerrainMesh.js, upsampleQuantizedTerrainMesh.js, GlobeVS.glsl und zugehörige packages/engine/Specs |
| Build-/Teststatus | NOT RUN; Root-prepare würde gulp prepare, Husky und potenziell playwright install --with-deps ausführen; 182 relevante Testfälle Source-inspected |
| Demo-/Browserstatus | PARTIAL: Sandcastle-Shell in echter Playwright-Session ausgeführt, Console/Network geprüft, sichtbarer Globe beim Snapshot noch Loading; Screenshot außerhalb Repo |
| Einschränkungen | Sandcastle-Snapshot noch im Loadingzustand; keine reproduzierten Benchmarks; Earth-/Geospatialannahmen; Cancellation nicht universell |

Aktuelle offizielle Dokumentation: [Globe](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html), [RequestScheduler](https://cesium.com/learn/cesiumjs/ref-doc/RequestScheduler.html), [QuantizedMeshTerrainData](https://cesium.com/learn/cesiumjs/ref-doc/QuantizedMeshTerrainData.html), [CesiumTerrainProvider](https://cesium.com/learn/cesiumjs/ref-doc/CesiumTerrainProvider.html).

Pflichtbefunde:

- **Globe Quadtree — Code Evidence.** [QuadtreePrimitive](https://github.com/CesiumGS/cesium/blob/4040586054a1abf650dff1a6e2530b3e3e683513/packages/engine/Source/Scene/QuadtreePrimitive.js) erzeugt Level-zero-Tiles aus dem Tiling Scheme, sortiert Roots kameranah und traversiert Children near-to-far. Provider, Tilestate, Traversal, Cache und Rendercommands sind getrennte Rollen.
- **SSE — Code Evidence.** Perspektivisch (maxGeometricError*drawingBufferHeight)/(distance*sseDenominator), danach Fog-Abzug und Pixel-Ratio. Globe-Default 2 Pixel; Dokumentation nennt Cachegröße, Ancestor-/Sibling-Preload und loadingDescendantLimit.
- **Horizon Culling — Code Evidence.** [computeTileVisibility](https://github.com/CesiumGS/cesium/blob/4040586054a1abf650dff1a6e2530b3e3e683513/packages/engine/Source/Scene/GlobeSurfaceTileProvider.js#L660) führt Fog-, Frustum/Bounds- und Ellipsoid-Horizon-Culling aus. occludeePointInScaledSpace kommt aus Meshdaten oder OBB, Rectangle und Min/Max-Höhen; unterirdische/orthografische Kamera sind Sonderfälle.
- **Tile Load Priority — Code Evidence.** High für Refinementblocker, Medium für gerenderte/benötigte Tiles, Low für überrefinierte, Ancestor-/Sibling- oder unsichtbare Tiles. Intra-Queue-Priorität: (1-dot(tileDirection,cameraDirection))*distance. Loading hat standardmäßig 5 ms Framebudget.
- **Upsampling — Code Evidence.** Fehlende Terrainchildren entstehen aus Parentdaten; [QuantizedMeshTerrainData.upsample](https://github.com/CesiumGS/cesium/blob/4040586054a1abf650dff1a6e2530b3e3e683513/packages/engine/Source/Core/QuantizedMeshTerrainData.js#L388) delegiert an Worker. Sind alle vier Children nur upsampled, bleibt der Parent statt Verfeinerung ohne Informationsgewinn.
- **Parent/Child-Fallback — Code Evidence.** Vorframe-Selektion verhindert Rückfall auf einen Parent, wenn dadurch sichtbare Terrain-/Imagerydetails verschwänden; sonst bleiben Descendants oder Fill-Meshes. Bei vielen blockierten Descendants priorisiert loadingDescendantLimit den Parent. Stärker als ein binäres Parent-bis-Children-loaded.
- **Terrainquantisierung — Code Evidence.** U, V und Höhe als 16-Bit 0–32767 relativ zu Rectangle und Min/Max-Höhen; GPU-Pfad optional 12-Bit-komprimiert; Skirts verdecken Ränder. Quantized Mesh ist kein destruktives Volumenformat.
- **Camera-relative/large coordinates — Code Evidence.** Terrainvertices liegen relativ zu mesh.center; modifizierte Model-View/-Projection verschiebt die Tilemitte CPU-seitig in Eye Space. [EncodedCartesian3](https://github.com/CesiumGS/cesium/blob/4040586054a1abf650dff1a6e2530b3e3e683513/packages/engine/Source/Core/EncodedCartesian3.js) plus translateRelativeToEye bietet High/Low-Splitting. Der Globe-Morphingshader dokumentiert eine RTC-Lücke/Jitterrisiko.
- **Request Cancellation — Code Evidence.** [RequestScheduler](https://github.com/CesiumGS/cesium/blob/4040586054a1abf650dff1a6e2530b3e3e683513/packages/engine/Source/Core/RequestScheduler.js) aktualisiert Prioritäten frameweise, limitiert global/pro Server und cancelt verdrängte, explizit abgebrochene oder serverblockierte Requests; aktuelle Defaults 50 global/18 pro Server. Optionale cancelFunction bindet Transportabbruch an.
- **Cancellation-Grenze — Code Evidence.** Globe-Terrain nutzt throttle:false und throttleByServer:true; räumliche Queues steuern primär Provideraufrufe. eligibleForUnloading blockiert Eviction während RECEIVING/TRANSFORMING. Nicht jedes nach Richtungswechsel obsolete Paket wird sofort transportseitig abgebrochen.
- **Tests — Code Evidence.** 182 it-Fälle in sechs relevanten Specdateien: Parent-Upsampling, Kinderkanten, Horizon Visibility, Priorität, Heap-Verdrängung, issued/active Cancellation, Serverlimits und Replacement. Suite nicht ausgeführt. [Engine Specs](https://github.com/CesiumGS/cesium/tree/4040586054a1abf650dff1a6e2530b3e3e683513/packages/engine/Specs)

Browser/Demo:

- **Observed Demo Evidence.** [Sandcastle Hello World](https://sandcastle.cesium.com/?src=Hello%20World.html) öffnete Cesium 1.143.0; Quellen und Engine-Module antworteten HTTP 200. Keine Enginefehler; eine Browserwarnung betraf allow-scripts plus allow-same-origin im Iframe.
- **Inference.** Der Snapshot beweist Browserausführung/Erreichbarkeit, nicht vollständigen Streamingpfad, Precision oder Performance.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4/5 Shell; 1/5 Microvoxel | 5/5 Konzept; 1/5 Port | 5/5 | 2/5 | 5/5 | 3/5 | 5/5 | 5/5 | 5/5 |

**Main Risks — Inference:** vollständige Engine statt Library; Earth-/Geospatialannahmen; Render-/Simulationskontinuität verwechselt; Transportcancellation nicht universell.

**Abschlussurteil: Study and extract concepts.** Stärkste Referenz für Shell-Quadtree, Ellipsoid-Horizon-Culling, Bounds, Parent-Readiness/Upsampling und camera-relative Terrain. Kein Port und keine Microvoxelautorität.

### OpenSpace/OpenSpace

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/OpenSpace/OpenSpace |
| Commit / Datum / Ref | **fe66c01ddb5ad2a3604e28041f7c3e50e6eb3c82**; 2026-07-09T10:04:43Z; master |
| Lizenz | MIT; LICENSE.md; zusätzliche Hinweise in THIRD_PARTY_LICENSES.md |
| Untersuchte Pfade | SceneGraphNode, Camera, NavigationState, OrbitalNavigator, RenderEngine; SPICE/Horizons translations/rotations; RenderableStars; digitaluniverse/gaia; relevant Horizons/Kepler/LRU tests |
| Build-/Teststatus | NOT RUN; native C++23/OpenGL, CMake, Qt, SGCT/Ghoul und Submodule; CMake bricht ohne ext/ghoul ab. 29 nahe Tests Source-inspected |
| Demo-/Browserstatus | NOT RUN; keine Browserdemo; nativer Anwendungsstack |
| Einschränkungen | kein Microvoxel-/Terrainmutationsmodell; keine Benchmarks; GPU-Nahpräzision nicht praktisch getestet; Daten-/Drittlizenzen separat |

Pflichtbefunde:

- **Reference Frames/Scene Graph — Code Evidence.** SceneGraphNode besitzt Parent/Children, Translation, Rotation, Scale und optionales Renderable; Weltpose wird hierarchisch und zeitabhängig berechnet. Das trennt Transform-/Datenzustand von Darstellung.
- **Precision — Code Evidence.** Weltposition und Kamera nutzen glm::dvec3, Rotation dquat/dmat3. Die View wird relativ zur Kameraposition aufgebaut, bevor Float-GPU-Matrizen entstehen.
- **Navigation/Camera Scale — Code Evidence.** NavigationState speichert Anchor, Aim, Reference Frame, lokale Double-Position, Orientierung und Zeit. cameraPose löst Anchor/Frame auf. OrbitalNavigator wechselt Anchor/Aim und skaliert Zoom/Horizontalbewegung mit Oberflächenabstand und Körperradius.
- **Planet-/Systemframes — Code Evidence.** SPICE-Translation konsumiert Target, Observer, Frame und Zeit; SPICE-km werden zu Metern. HorizonsTranslation lädt zeitgeordnete JPL-Samples, interpoliert und begrenzt außerhalb des Datenintervalls.
- **Astronomische Kataloge/dynamische Daten — Code Evidence.** Digital-Universe-/Gaia-Module verwalten Kataloge; Gaia nutzt Octree-Manager und asynchrone Read-Tasks; RenderableStars berücksichtigt Proper Motion.
- **Tests — Code Evidence.** 29 Tests in den untersuchten Horizons-, Kepler- und LRU-Dateien; einige Horizons-Fälle benötigen Netzwerk. Nicht ausgeführt.
- **README Claim.** Das Projekt beschreibt Visualisierung über sehr große Skalen. Das ist weder Benchmark noch Beweis für Microvoxel-, Terrainmutations- oder Gameplaykontinuität.
- **Inference.** Übertragbar ist der persistierbare Zustand Anchor/Frame-ID + lokale Double-Pose + Attitude + Zeit. Camera-relative Rendering löst Darstellung, nicht automatisch lokale Physik oder Planet-LOD.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4/5 Frames; 1/5 Microvoxels | 4/5 Konzept; 1/5 direkter Code | 1/5 | 4/5 bei gepinnten Daten | 3/5 | 2/5 | 4/5, Daten separat | 5/5 | 5/5 |

**Main Risks — Inference:** Visualisierungsgraph als Simulationsautorität; native Abhängigkeiten; GPU-Präzisionsgrenzen; fehlende Terrainmutation.

**Abschlussurteil: Study and extract concepts.** Nur Frame-, Scenegraph-, Ephemeris- und camera-relative Konzepte übertragen; keinen nativen Engineport planen.

### Cosmonium

Die kanonische Zuordnung wurde zuerst verifiziert: https://cosmonium.org verlinkt auf https://github.com/cosmonium/cosmonium.

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/cosmonium/cosmonium |
| Commit / Datum / Ref | **f084ed916046a5cb5a04d760e84febbb6fc715ca**; 2026-07-09T22:43:45Z; develop |
| Lizenz | GPL-3.0-or-later; COPYING.md; Drittanbieter in THIRD-PARTY.md |
| Untersuchte Pfade | README/pyproject/setup/requirements; astro frames/orbits/rotations/tables; engine Anchor-/Octreeklassen; SceneAnchor, DynamicSceneManager, RegionSceneManager, SceneRegion, RenderPass; patchedshapes und relevante Tests |
| Build-/Teststatus | NOT RUN; requirements verlangt Panda3D-1.11-Development-Build, C++-Extensions, Submodule und separates Datenrepo; 477 Testdefinitionen Source-inspected |
| Demo-/Browserstatus | NOT RUN; native Panda3D-Anwendung, keine Browserdemo; vorgesehene Browserlane blockiert, kein Workaround |
| Einschränkungen | GPL, Panda3D/Python/C++-Kopplung, separate Daten/Assets, keine Benchmarks, kein bewiesener Microvoxel-Edit- oder beobachteter Surface-to-Orbit-Workflow |

Pflichtbefunde:

- **Reference Frames — Code Evidence.** Framehierarchie umfasst J2000-baryzentrische Ekliptik-/Äquatorframes, Anchor-, Relative-, Orbit-, Equatorial- und Synchronous-Frames. Körper werden über Systemframe und OrbitReferenceFrame hierarchisch lokalisiert.
- **Anchors/Precision — Code Evidence.** Anchors speichern globalen Referenzpunkt und lokale Position getrennt. Observer-relative Pose entsteht aus Referenzpunkt- plus lokaler Differenz. Das stützt Universe -> System -> Body/Orbit -> Local-Surface.
- **Render vs Data Authority — Code Evidence.** SceneAnchor.calc_scene_params projiziert autoritativen Datenraum zu Camera-at-origin-Renderraum, mit Skalierung sowie optional linearer/logarithmischer Tiefenkompression; Cast auf Renderer-Floats erfolgt erst danach.
- **Dynamic Near/Far/Scale — Code Evidence.** DynamicSceneManager berechnet Skalierung und Near/Mid/Infinite-Plane aus Kameradistanzen. RegionSceneManager nutzt getrennte Tiefenregionen mit eigenen Near/Far-Werten. Das ist visuelle Reichweitenkontinuität, kein einheitlicher Physikraum.
- **Scene/LOD — Code Evidence.** Universe-, Stellar-, System- und Camera-Anchors sowie Octree-Traversal strukturieren Sichtbarkeit und Größenwechsel nach Winkelgröße, Distanz und Frustum.
- **Dynamische Himmelsdaten — Code Evidence.** Analytische Tabellen/Rotationen umfassen VSOP87, ELP82, GUST86, Lieske E5 und WGCCRE.
- **Tests — Code Evidence.** 477 Testdefinitionen; patchedshapes deckt unter anderem LOD-Split/Merge und Nachbaranpassung ab. Keine offensichtlich vollständigen E2E-Tests für Framekomposition, Tiefenkompression und gesamte Surface-to-Orbit-Reise gefunden; nicht ausgeführt.
- **README Claim.** Projekt beschreibt große Skalen, nennt sich zugleich frühes Stadium. Keine Performance-/Reife-Evidence.
- **Inference.** Komprimierte Renderkoordinaten dürfen nie zurück in Physik, Persistenz oder Simulation fließen. Das Anchor-Split-Muster ist übertragbar; GPL-/Panda3D-Code nicht.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4/5 Frames; 1/5 Microvoxels | 4/5 Konzept; 1/5 direkter Code | 1/5 | 4/5 analytisch | 3/5 | 1/5 | 2/5 Reuse | 5/5 | 3/5 |

**Main Risks — Inference:** Copyleft; Mixed-Language-/Panda3D-Bindung; Renderraumkompression im Simulationsraum; separate Datenlizenzen.

**Abschlussurteil: Study and extract concepts.** Frameleiter, Anchor-Split und Depth-Regionen studieren; keine Codeintegration.

### Offizielle Hello-Games-/GDC-Vorträge

Browserstatus beider Quellen: **NOT RUN/BLOCKED**. Der vorgesehene Playwright-Aufruf wurde vor Ausführung abgelehnt, weil neu geladener Drittcode ausgeführt worden wäre; eine erlaubte In-App-Browsersteuerung fehlte. Es wurde kein Workaround verwendet. Offizielle Seiten wurden read-only geprüft; daher keine Console-, Network-, Screenshot- oder Observed-Demo-Evidence.

#### Continuous World Generation in No Man's Sky

Kanonische offizielle Quelle: [GDC Vault](https://www.gdcvault.com/play/1024265/Continuous_World_Generation_in__No_Man_s_Sky_); GDC 2017; Innes McKendrick, Hello Games.

- **README Claim — offizielle GDC-Sessionbeschreibung.** Thema ist die Architektur für kontinuierliche Echtzeitgenerierung vom Weltraum zu interaktivem/bevölkertem Terrain.
- **README Claim — offizielle GDC-Sessionbeschreibung.** Genannte Stufen sind voxelbasierte Weltgenerierung, Polygonisierung, Texturierung, Population und Simulation.
- **Inference.** Für Weltraum-Spiel werden diese Stufen getrennt schedulbar: Dichtefeld -> Geometrie -> Material -> Population -> Simulation.
- **Inference.** Der Seitentext beweist keine persistente Simulation, Frames, Cache-Eviction, Parent/Child-Readiness oder Destruktionsjournale.

#### Building Worlds in No Man's Sky Using Math(s)

Kanonische offizielle Quelle: [GDC Festival of Gaming auf YouTube](https://www.youtube.com/watch?v=C9RyEiEzMiU); veröffentlicht 2017-04-17; Sean Murray, Hello Games; 53:52.

- **README Claim — offizielle Videobeschreibung.** Thema ist mathematische Erzeugung realistischer/fremdartiger Terrains ohne manuelle künstlerische Eingabe.
- **README Claim.** Near infinite ist Publisher-Framing, keine Benchmark Evidence.
- **Inference.** Eine mathematische Basis ist nur dann deterministisch rekonstruierbar, wenn Seed, Algorithmusversion, Parameter und Editjournal explizit versioniert sind.
- **Inference.** Die zugängliche Beschreibung belegt kein LOD-Schema, Frame-Modell, Streamingprotokoll, Cacheverhalten oder persistente Simulation.

Für beide Vorträge liegen in diesem Audit keine Observed Demo, Test oder Benchmark Evidence vor. Eine offizielle Caption-URL lieferte keinen nutzbaren Text; kein Transkript wurde als Beleg verwendet.

### 3merillon/neural-planetoid

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/3merillon/neural-planetoid |
| Commit / Datum / Ref | **505c1ad1536c70ef179b075e2ec562b36126e0b7**; 2025-06-07T22:24:05+02:00; main |
| Lizenz | MIT; LICENSE und rust/LICENSE.md |
| Untersuchte Pfade | src/chunking, src/gl, src/ui, src/main.ts, rust/marching-cubes, package.json, build-wasm.cjs |
| Buildstatus | NOT RUN; read-only Audit nutzte den vorhandenen Source und die öffentliche Demo; Package-/WASM-Skripte vorab geprüft |
| Teststatus | NOT RUN; keine Test-/Spec-Dateien und damit keine ausführbare Suite gefunden |
| Demo-/Browserstatus | PASS/OBSERVED: https://cybercyril.com/planetLOD/; Console/Network und temporärer Screenshot außerhalb Repo |
| Einschränkungen | kein Orbit-/Systemframemodell; keine Tests; keine bewiesene wasserdichte LOD-Naht; keine gezielte Cancellation aktiver Jobs; kein belegter Chunkpool |

Pflichtbefunde:

- **Code Evidence.** TypeScript/Vite/WebGL2 und Rust/WASM-Marching-Cubes sind implementiert; vorgebaute WASM-Artefakte liegen vor.
- **Code Evidence.** Räumliche Struktur ist ein 3D-Octree mit acht Children, keine wörtlichen konzentrischen LOD-Ringe. Die README-Bezeichnung ist nur näherungsweise.
- **Code Evidence.** Worker erzeugen Density-Volumes; Hauptthread-WASM extrahiert Meshes. Protokoll überträgt Ursprung, Weltgröße, Voxelauflösung, LOD, Iso-Bias und Seed.
- **Code Evidence.** WorkerManager begrenzt auf acht Worker, priorisiert sichtbar/kameranah, hat Hard-/Soft-Queue-Limits und verwirft obsolete Queueeinträge. Aktive Einzeljobs sind nicht gezielt cancelbar; nur globale Worker-Terminierung.
- **Code Evidence.** Density Field ist seedbasiert und im JS-Verfahren reproduzierbar; plattformübergreifend bitidentische Deterministik unbewiesen.
- **Code Evidence.** Worker/Chunks adressieren Ursprung und Weltgröße in einem einzigen planetzentrierten Raum. Body-/System-/Frame-IDs, ein globaler Planetenschlüssel und ein SurfaceRegion-Handoff fehlen.
- **Code Evidence.** allChildrenReady/shouldRender hält Parent sichtbar; Übergang überlappt Parent/Children mit 4x4-Bayer-Dithering sowie Z-/Iso-Bias.
- **Code Evidence.** Marching-Cubes-Volumes erhalten ein zusätzliches Voxel und teilen deterministische Samples. Keine Transvoxel-Zellen, explizites Neighbor-Stitching oder Skirts.
- **Inference.** Seamless ist nicht bestätigt: Überlappung/Dither kaschiert, beweist aber keine geometrisch wasserdichten LOD-Grenzen.
- **Code Evidence.** Triplanare Multi-Material-Shader, Normal-/Roughness-Mapping, Dither und Live-Stats für FPS, Nodes, Worker, Queue, LOD und Speicher sind vorhanden.
- **Code Evidence.** Entgegen dem README-Claim wurde kein echter Chunkpool gefunden; beim Collapse werden Children gelöscht.
- **Observed Demo Evidence.** Terrain, Höhlen, Wasser, LOD-/Workerstats und laufende Generierung waren sichtbar. Etwa 15–30 FPS im begrenzten Lauf sind kein Benchmark. 34 Requests inklusive WASM und acht Worker-Skripten waren HTTP 200. Console meldete falschen WASM-MIME-Type und langsameren Fallback, keinen fatalen Fehler.
- **Inference.** Der Lauf beweist weder rissfreie Geometrie noch Surface-to-Orbit-Kontinuität.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 4/5 | 3/5 | 4/5 | 3/5 | 1/5 | 2/5 | 5/5 | 4/5 | 2/5 |

**Main Risks — Inference:** keine beweisbare LOD-Naht, aktive Jobs ohne Cancellation, kein Pool, keine Tests, Ein-Planet-Koordinaten.

**Abschlussurteil: Study and extract concepts.** Workerprotokoll, Parent-Readiness, Queuepriorisierung und Dither studieren; nicht als vollständige Architektur übernehmen.

### PlanetTech / OpenWorlds

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/FunSoftWareTechologies/PlanetTech |
| Commit / Datum / Ref | **3d4ecb024b3be3259ad63db8cce09f99a9c868af**; 2026-01-19T12:44:26-05:00; main |
| Lizenz | LICENSE.txt enthält Apache-2.0; package.json deklariert widersprüchlich ISC |
| Untersuchte Pfade | src/components/bodies/planet.js, src/engine/dataStructures, primitives, system, geometries, test, README.md, package.json |
| Build-/Teststatus | NOT RUN; Lizenzkonflikt und defekte Demo rechtfertigen keine Dependency-Installation; Testimports wirken veraltet, Worker-Test auskommentiert; Status UNKNOWN |
| Demo-/Browserstatus | FAIL: README-GitHub-Pages-Link liefert Site not found/HTTP 404 |
| OpenWorlds-Zuordnung | UNKNOWN; kein OpenWorlds-Bezeichner im aktuellen Clone gefunden |
| Einschränkungen | Lizenzkonflikt, Alpha, defekte Demo/Links, keine Performance Evidence |

Pflichtbefunde:

- **Code Evidence.** Planet besteht aus sechs Cube-Sphere-Flächen; jede Fläche wird per Quadtree unterteilt und Cubegeometrie auf die Kugel normalisiert.
- **Code Evidence.** Nodes besitzen aus Ecken/Mittelpunkt abgeleitete Bounding Boxes. Split/Visibility ist kameradistanzgetrieben; kein SSE, Horizon- oder Frustum-Culling gefunden.
- **Code Evidence.** Subdivisions bleiben nach Split im Baum/Collections; Merge schaltet im Wesentlichen Sichtbarkeit. Keine Entfernung/Poolrückgabe erkennbar. **Inference:** Akkumulationsrisiko bei Exploration.
- **Code Evidence.** Blob-Worker parallelisiert Meshbau, aber ein Worker je Meshauftrag; kein zentraler Scheduler, Pool, Backpressure oder Cancellationvertrag.
- **Code Evidence.** Starke Three.js-Kopplung: Nodes erben THREE.Object3D, Meshes/Materials inline, Geometrieklassen für Worker serialisiert.
- **Code Evidence.** Packageversion 0.0.8-alpha.0.1.7; README- und alte InterstellarJS-Links inkonsistent. **README Claim:** Alpha.
- **Observed Demo Evidence.** Offizieller README-Demolink antwortete 404.
- **Inference.** Cube-Sphere-Grundidee ist bekannt, diese Implementierung aber kein belastbares Shellfundament.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 3/5 | 2/5 | 1/5 | 1/5 | 1/5 | 1/5 | 1/5 | 4/5 | 1/5 |

**Main Risks — Inference:** widersprüchliche Lizenz, defekte Demo/veraltete Tests, kein SSE/Horizon Culling, kein echtes Merge/Pooling, keine Schedulergrenze, enge Three-Kopplung.

**Abschlussurteil: Reject.** Selbst als Visual Reference liefert Godot Cuberact stärkere Evidence.

### cuberact/godot-cuberact-planet-chunked-lod

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/cuberact/godot-cuberact-planet-chunked-lod |
| Commit / Datum / Ref | **85e4b9b328a5fedd05eb85627b3f1cf922683bd9**; 2026-03-22T23:35:58+01:00; main |
| Lizenz | MIT; LICENSE |
| Untersuchte Pfade | scripts/planet.gd, planet_camera.gd, quad.gd, chunk.gd, terrain_noise.gd; terrain/atmosphere shaders; Scenes/Materials/Projektdateien |
| Buildstatus | NOT RUN; README verlangt Godot 4.6 |
| Teststatus | NOT RUN; keine Tests gefunden |
| Demo-/Browserstatus | NOT APPLICABLE/NOT RUN; nur Repository und README-Medien, keine Browserdemo |
| Einschränkungen | GDScript/Godot, synchrones Generieren, Shader-Heightfield statt Microvoxels, Ein-Planet-Frame, keine Benchmarks |

Pflichtbefunde:

- **Code Evidence.** Sechs spherifizierte Cube-Flächen mit je einem Quadtree. LOD-Schwellen aus Kantenmaß/Winkel; Split/Merge-Hysterese 0,1 Grad und konfigurierbares Splitbudget, Default acht pro Frame.
- **Code Evidence.** Parentmesh wird erst entfernt, nachdem alle Children synchron aufgebaut sind. Kein Loch in dieser lokalen Pipeline. **Inference:** noch kein allgemeiner asynchroner Netzwerk-Readiness-Vertrag.
- **Code Evidence.** Manuelles AABB-vs-Frustum-Culling mit Parent-inside-Kurzpfad; Bounds berücksichtigen Ecken, Mittelpunkt und maximale Terrainverschiebung.
- **Code Evidence.** Horizon Culling nutzt Winkelradius und berücksichtigt Chunkausdehnung/Terrainhöhe.
- **Code Evidence.** Skirts duplizieren Randvertices und verschieben sie nach innen; Terrainshader überspringt deren Displacement.
- **Code Evidence.** Echter LIFO-Chunkpool mit Acquire, Release und Bereinigung ungenutzter Chunks.
- **Code Evidence.** Terrain-Displacement im Shader; CPU und Shader haben korrespondierende Integer-Noise-Implementierungen für geplante Höhen-/Kollisionsparität. **Inference:** ohne Tests nicht bewiesen.
- **Code Evidence.** Origin Shift setzt Kamera auf Null und verschiebt Planetframe. README empfiehlt Waypoints planet-local zu speichern und bei Bedarf global zu transformieren.
- **Code Evidence.** Dynamische Near/Far-Planes aus Oberflächendistanz; Near relativ zu Far skaliert/begrenzt. Atmosphäre als transparente Außensphäre mit Raymarch-Scattering.
- **README Claim.** Surface-to-Orbit wird beschrieben/gezeigt. **Observed Demo Evidence:** nicht beobachtet, daher kein bestätigter Handoff.
- **Inference.** Ein Systemraum-/Mehrplanet-/dauerhafter Authorityvertrag fehlt.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 4/5 | 4/5 | 1/5 | 3/5 | 2/5 | 1/5 | 5/5 | 4/5 | 3/5 |

**Main Risks — Inference:** nativer Engineansatz, Heightfield statt editierbarer Microvoxels, synchrone Erzeugung, keine Tests/Benchmarks, Ein-Planet-Origin-Shift.

**Abschlussurteil: Study and extract concepts.** Stärkste kompakte Referenz für Cube-Sphere, Horizon/Frustum-Culling, Skirts, Pooling, Splitbudget, Origin Shift und dynamisches Clipping; kein Engineport.

### AlanGreyjoy/claudecitizen

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/AlanGreyjoy/claudecitizen |
| Commit / Datum / Ref | **18bbe28693b9162df01c654a476a3b3a94526457**; 2026-07-13T09:08:47-05:00; main |
| Lizenz | keine Lizenzdatei; README-Text IDK. Whatever. ist keine verwertbare Gewährung |
| Untersuchte Pfade | src/render/planet_tiles, src/world, src/physics, src/render/effects, engineering/planet.md, play.md, Root-/Server-package.json |
| Buildstatus | NOT RUN; Benchmark-only und ohne verwertbare Lizenz, daher keine Dependency-Installation |
| Teststatus | NOT RUN; kein Top-Level-Testscript; Server deklariert Tests, aber keine passenden Test-/Spec-Dateien und damit keine ausführbare Suite gefunden |
| Demo-/Browserstatus | PARTIAL: https://claudecitizen.netlify.app/; Console/Network geprüft, Screenshot temporär; Surface-to-Orbit nicht erreicht |
| Nutzung | ausschließlich Benchmark; kein Code-Reuse |

Pflichtbefunde:

- **Code Evidence.** Six-Face-Cube-Sphere-Quadtree; LOD über projizierten Fehler aus Tile-Spanne/Kameradistanz; winkelbasiertes Horizon Culling.
- **Code Evidence.** Rendering nutzt Maßstab 1:500 und Body-relative Tilegruppe, Simulation bleibt in Metern: konkrete Camera-relative/Floating-Origin-Trennung.
- **Code Evidence.** Modul-Worker verarbeitet Terrainjobs über FIFO; IndexedDB-Meshcache, Framebudget, Maximalcache und Alterseviction vorhanden. Handshake-Timeout mit synchronem Fallback; aktiver Einzeljob nicht gezielt cancelbar.
- **Code Evidence.** Parentfallback steigt über Vorfahren auf; minimaler Fallback synchron möglich. Bei ausgeschöpftem Budget bleibt ein Loch möglich. Kein Fade/Geomorphing.
- **Code Evidence.** Terrainfingerprints sampeln acht feste Richtungen und verwenden FNV-1a zur Cacheinvalidierung. Seedbasiert, aber bitidentische Browser-/Architekturdeterministik unbewiesen.
- **Code Evidence.** Rapier arbeitet in lokalen Gameplay-/Stationsachsen; Surfacecollision nutzt diskrete Terrainsamples statt gerendertem Planetmesh. **Inference:** mehrere Physikräume, aber kein allgemeiner Reference-/Physics-Framegraph.
- **Code Evidence.** Takram wird direkt für Atmosphäre/Wolken importiert, inklusive AtmosphereParameters, LUT, Aerial Perspective, Clouds, Ellipsoid und STBN.
- **Observed Demo Evidence.** Start/Schiffsinterieur, HUD und ungefähr 28–33 FPS sichtbar; kein Benchmark. Surface-to-Orbit wurde nicht nachvollzogen, daher kein Handoffbeweis.
- **Observed Demo Evidence.** Zahlreiche HTTP-404 für Vegetations-GLTFs; Kernassets, Planetworker, STBN und Schiff luden 200.
- **README Claim.** One world, no loading screens und Surface-to-Orbit. **Inference:** nicht als beobachtete Kontinuität bestätigt.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 4/5 | 3/5 | 4/5 | 3/5 | 1/5 | 2/5 | 0/5 | 5/5 | 2/5 |

**Main Risks — Inference:** keine Lizenz, keine Tests, defekte Deployassets, aktive Jobs ohne Cancellation, nicht beobachteter Handoff, monolithischer Integrationsumfang.

**Abschlussurteil: Reject.** Nur Benchmark für Render-/Simulationsmaßstab, Parentfallback und Takram-Integration; keinerlei Code übernehmen.

### takram-design-engineering/three-geospatial

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/takram-design-engineering/three-geospatial |
| Commit / Datum / Ref | **b012ad06d858fc035d88aacfd73f092f93c994e4**; 2026-05-27T15:39:59+09:00; main |
| Lizenz | MIT; LICENSE sowie packages/atmosphere/LICENSE, packages/clouds/LICENSE, packages/core/LICENSE |
| Untersuchte Pfade | packages/atmosphere, clouds, core; README-/WEBGPU-Dokumente; package.json, Nx-Konfigurationen und Tests |
| Buildstatus | NOT RUN; read-only Audit nutzte öffentliche Storybooks statt Dependency-Installation; Package-/Workspace-Skripte vorab geprüft |
| Teststatus | NOT RUN; keine Dependency-Installation; Tests für Texture Sampling, Cloud Layers und Core-Tiling/-Includes Source-inspected |
| Demo-/Browserstatus | WebGL OBSERVED; WebGPU INCONCLUSIVE; echte Browserprüfung, temporäre Screenshots außerhalb Repo |
| Einschränkungen | WebGPU-Neufassung WIP/inkompatibel, ECEF-/Earth-Annahmen, Three/Postprocessing-Kopplung, keine Benchmarks, WebGPU-Clouds unvollständig |

Pflichtbefunde:

- **Code Evidence.** Monorepo trennt Atmosphere 0.19.1, Clouds 0.7.6 und Core 0.9.1. **README Claim:** Atmosphere/Clouds Beta, Core Alpha.
- **Code Evidence.** Veröffentlichte WebGL-API für Three/Postprocessing und parallele nodebasierte WebGPU-API. **README Claim:** WebGPU Rewrite WIP; Atmosphere/Core weitgehend abgeschlossen, Clouds/Effects nicht.
- **Code Evidence.** APIs sind nicht stabil kompatibel: LUT-/Effect-/Light-Klassen weichen Node-/Context-Konzepten; Masken/Integrationspunkte entfallen. **Inference:** enger Adapter zwingend, keine Takramtypen im Simulationsvertrag.
- **Code Evidence.** WebGL-Atmosphäre arbeitet in festem ECEF und dokumentiert Horizont-/Präzisions-/Lightinggrenzen. WebGPU besitzt AtmosphereContext, World-to-ECEF und Beispiel für World-Origin-Rebasing.
- **Code Evidence.** Atmosphäre konsumiert Boden-/Topradius, Albedo, Wellenlängen, Dichte-/Streuung, Sonne/Mond und World-to-ECEF.
- **Code Evidence.** Clouds konsumiert Layerhöhe/-dicke, Coverage-/Weather-/Shape-Felder, Repeat/Offset/Velocity, Streuung/Absorption, Anisotropie, Raymarch-/Shadowqualität.
- **Inference.** Simulation liefert nur physische Radien, Atmosphärengrenze, Body-Frame-Transform, Sonne/Mond, Zeit und abstrahiertes Wetterfeld. LUTs, Noise, Shadow-Cascades und Qualitätsstufen gehören dem Renderer.
- **README Claim.** WebGPU sei deutlich schneller. **Benchmark Evidence:** keine formalen Benchmarks gefunden; unbestätigt.
- **Observed Demo Evidence.** [WebGL Storybook](https://takram-design-engineering.github.io/three-geospatial/) renderte Minimal-Setup-Atmosphäre im Canvas. 41 Requests erfolgreich; Console nur Three-Clock-Deprecation und Form-Accessibility.
- **Observed Demo Evidence.** WebGPU-Storybook lud Shell/Module 200, aber gewählte Space-Story blieb nach 30 s ohne Canvas im Spinner; keine erklärende Exception. Ursache UNKNOWN, nicht als Libraryfehler bewiesen.
- **Inference.** Sichtbare Atmosphäre beweist weder Planet-LOD/Streaming noch Simulation Continuity. Manche Stories können Google-/Cesium-Credentials verlangen; keine Credentials bereitgestellt.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 3/5 | 4/5 | 4/5 | 3/5 | 3/5 | 2/5 | 5/5 | 4/5 | 3/5 |

**Main Risks — Inference:** inkompatible WebGPU-Neufassung, ECEF-Annahmen, Renderstackkopplung, GPU-Kosten ohne Benchmarks, große Demoassets/unvollständige Clouds.

**Abschlussurteil: Prototype behind adapter.** Atmosphere/Clouds als rein visuelle austauschbare Komponente evaluieren; WebGL oder WebGPU exakt pinnen und Simulationsparameter über eigenen stabilen Vertrag liefern.

### Kleine Three.js-Planetengeneratoren — nur Visual Reference

Diese beiden Kleinstprojekte werden ausdrücklich nicht als LOD-, Streaming-, Frame-, Determinismus- oder Simulations-Evidence verwendet.

#### dgreenheck/threejs-procedural-planets

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/dgreenheck/threejs-procedural-planets |
| Commit / Datum / Ref | **23457d4f8e6bedf22aa266e12c92f850822ff3a4**; 2025-02-02T20:25:17-06:00; main |
| Lizenz | MIT; LICENSE |
| Untersuchte Pfade | README.md, package.json/lock, index.html, scripts/main.js, atmosphere.js, ui.js |
| Buildstatus | NOT RUN; reine Visual-Reference, keine Dependency-Installation; Scripts Vite dev/build/preview und Hooks geprüft |
| Teststatus | NOT RUN; kein Testscript oder Testpfad gefunden |
| Demostatus | PASS; https://dgreenheck.github.io/threejs-procedural-planets/ geladen und Terrain-Typ von fractal auf ridgedFractal umgeschaltet |
| Browserstatus | PASS; echte Browserprüfung, 0 Console Errors/Warnings; Hauptseite, JS, CSS, Cloud-, Cube-Map- und SVG-Ressourcen HTTP 200; temporärer Screenshot außerhalb des Repos |
| Einschränkungen | fixe SphereGeometry-Dichte, Math.random-Wolken, lokale Kamera, kein Tile-/Chunk-Lifecycle; README nennt Atmosphärenperformance und Cloud-Scaling als TODO |

- **Code Evidence.** SphereGeometry(1,128,128) wird im Vertexshader durch geschichtetes 3D-Simplex/Fractal Noise verschoben; Fragmentshader rekonstruiert Bumpnormalen aus Höhensamples, nutzt fünf Höhenfarbbänder, Directional Light und Bloom.
- **Code Evidence.** Atmosphäre/Wolken sind randomisierte Points in einer sphärischen Shell mit Noise-Alpha und rotierender Cloudtextur.
- **Observed Demo Evidence.** Die aktive WebGL-Canvas zeigte Terrain-, Atmosphären-, Licht-, Bump- und Bloom-Regler; der Wechsel zu Ridged Fractal blieb funktionsfähig. Das belegt nur die sichtbare Lookdev-Funktion, keine verborgene LOD- oder Streamingarchitektur.
- **Inference.** Nur Shader-/Farb-/Atmosphärenparameter als visuelle Inspiration; kein Beleg für globale Planetarchitektur.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1/5 | 1/5 | 4/5 | 1/5 | 1/5 | 1/5 | 5/5 | 2/5 | 2/5 |

**Main Risks — Inference:** Visualshader mit Terrainarchitektur verwechseln; unseeded Wolken; fixe Dichte; TODO-Performance.

**Abschlussurteil: Revisit later**, ausschließlich als Visual Reference.

#### XenoverseUp/procedural-planets

| Feld | Auditstand |
| --- | --- |
| Kanonische URL | https://github.com/XenoverseUp/procedural-planets |
| Commit / Datum / Ref | **82df52b810edb6a59b7df5d1c39f97708132526e**; 2024-12-08T17:50:22+03:00; main |
| Lizenz | MIT; LICENSE |
| Untersuchte Pfade | README/package.json/lock, settings.ts, components/planet-gpu, planet-cpu/mesh-generation.ts, atmosphere.tsx, GLSL compute/planet/atmosphere, gpu-compute/noise/spherize |
| Buildstatus | NOT RUN; reine Visual-Reference, keine Dependency-Installation; Vite/tsc/serve-Scripts und Hooks geprüft |
| Teststatus | NOT RUN; kein Testscript oder Testpfad gefunden |
| Demostatus | PASS; https://procedural-planets.vercel.app/ geladen und Strength des ersten Noise-Layers von 0.2 auf 0.25 geändert |
| Browserstatus | PARTIAL; Demo funktional, aber 8 Shader/CSM-Warnungen und ein fehlendes icon.png (HTTP 404); Hauptseite, JS und CSS HTTP 200; temporärer Screenshot außerhalb des Repos |
| Einschränkungen | Math.random-Seed/unseeded CPU-Noise, fixe sechs Meshflächen, synchrones GPU-Readback, keine Split/Merge-Hierarchie, minimale Atmosphäre |

- **Code Evidence.** Sechs fixe Cube-Faces werden zur Kugel normalisiert; geschichtetes Simple/Ridged Noise erzeugt Displacement, optionales First-Layer-Masking und konfigurierbare Höhenfarbverläufe.
- **Code Evidence.** GPU-Pfad rendert Positionen in Float-RenderTarget, liest synchron zurück und baut Three BufferGeometry; Default-Faceauflösung 144. Atmosphäre ist größere Backface-Sphäre mit additivem view-normalabhängigem Rim.
- **Observed Demo Evidence.** Die aktive WebGL-Canvas zeigte Meshauflösung, drei Noise-Layer sowie Höhen-/Tiefengradienten; eine Strength-Änderung blieb interaktiv. Console-Warnungen betrafen CSM-Namenskollisionen und potenziell uninitialisierte Shadervariablen. Sichtbare Funktion ist kein Nachweis für Chunk-LOD, Streaming oder Simulationskontinuität.
- **Inference.** Six-Face-Mesh und Noise-/Gradientenparameter sind nur visuelle Experimente, kein Quadtree-/Streaming-/Authority-Beleg.

| Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2/5 | 1/5 | 3/5 | 1/5 | 1/5 | 1/5 | 5/5 | 2/5 | 2/5 |

**Main Risks — Inference:** visuelle Six-Face-Konstruktion mit Shell-LOD verwechseln; unseeded Noise; synchrones Readback; keine Tests.

**Abschlussurteil: Revisit later**, ausschließlich als Visual Reference.

## 12. Library Adoption Matrix

| Projekt | Stärkster Nutzen | Browser/Demo | Lizenzfit | Integrationskosten | Hauptgrenze | Urteil |
| --- | --- | --- | --- | --- | --- | --- |
| 3DTilesRendererJS | Queue-/LRU-/Readiness-/Fade-Muster; statische 3D-Tiles-Proxies | Mars/Lunar PASS | Apache-2.0, hoch | hoch als Port; mittel als externer Proxy-Layer | keine dynamische Terrainautorität | **Study and extract concepts** |
| Cesium | Shell-Quadtree, SSE, Ellipsoid-Horizon-Culling, Upsample/Fallback, RTC | Sandcastle PARTIAL | Apache-2.0, hoch | sehr hoch | vollständige Geospatial-Engine; kein Microvoxelmodell | **Study and extract concepts** |
| OpenSpace | zeitabhängige Framehierarchie, Ephemeriden/Kataloge, camera-relative Double-Pose | N/A | MIT-Code hoch; Daten separat | sehr hoch direkt | native Engine, kein Terrainstreaming | **Study and extract concepts** |
| Cosmonium | Anchor-Split, Frameleiter, Depth-Regionen, dynamisches Near/Far | N/A | GPL-Reuse niedrig | sehr hoch | Panda3D/Mixed-Language/Copyleft | **Study and extract concepts** |
| neural-planetoid | Density->Worker->WASM-Mesh, Parent-Readiness, Dither, Live-Stats | Demo PASS mit MIME-Fallback | MIT, hoch | hoch | keine bewiesene Naht, Tests/Cancellation/Pool fehlen | **Study and extract concepts** |
| PlanetTech | elementare Six-Face-/Quadtree-Struktur | Demo 404 | widersprüchlich, niedrig | hoch | unreif, enges Three, kein SSE/Culling/Merge | **Reject** |
| Godot Cuberact Planet | Cube-Sphere, Horizon/Frustum, Skirts, Pool, Splitbudget, Origin/Near-Far | keine Browserdemo | MIT, hoch | hoch als Port | synchron, Heightfield, Ein-Planet-Frame | **Study and extract concepts** |
| ClaudeCitizen | Benchmark für Rendermaßstab, Worker/cache, Physics-Spaces, Takram-Einbindung | Demo teilweise; GLTF-404; Handoff nicht beobachtet | keine Lizenz, 0 | sehr hoch | keine Tests/Lizenz; Marketing nicht bestätigt | **Reject** |
| Takram three-geospatial | Atmosphere/Cloud-Renderer und Parametergrenze | WebGL PASS; WebGPU INCONCLUSIVE | MIT, hoch | mittel-hoch | API-Rewrite, ECEF/Three-Kopplung, keine Benchmarks | **Prototype behind adapter** |

**Inference:** Kein Projekt wird als planetare Datenautorität adoptiert. Der konkrete Adopt-as-external-tool-Kandidat ist erst ein späterer 3D-Tiles-Far-Field-Stadtproxy-Service, nicht die geprüfte JS-Library als Unity-Runtimecode. Deshalb bleibt dessen heutiges Urteil Study and extract concepts, bis ein isolierter Toolspike Format, Bake-/Invalidierungsweg und Lizenzkette beweist.

## 13. Drei priorisierte technische Spikes

### Spike 1 — Deterministic Planet Shell Scheduler

**Priorität: P0. [Inference]**

Ziel: Einen headless testbaren Cube-Sphere-Quadtree mit SSE, Horizon Culling, Parentfallback, getrennten Download/Generate-/Parse-/Uploadqueues, Cancellation und LRU-Kostenmodell beweisen.

Minimalumfang:

- ein synthetischer Planet mit deterministischer Höhenfunktion,
- stabile `PlanetTileId`s und Face-Nachbartabelle,
- Kamera-/Route-Snapshots für Surface, Aufstieg, Orbit und High-Speed-Flyby,
- Parent bleibt sichtbar bis Kindcoverage ready,
- simulierte Latenzen/Fehler/Cancellation,
- kanonischer Plan-/Transitionhash unabhängig von Floating Origin,
- keine Unity Scene und keine finale Grafiklibrary.

Gates:

- keine sichtbare Coverage-Lücke in Zustands-/Snapshotauswertung,
- gleiche Inputs ergeben byteäquivalenten Plan,
- obsolete Arbeit wird storniert oder sicher verworfen,
- Horizon Culling erzeugt in konservativen Testfällen keine False Negatives,
- Queue-/Cachebudgets und Fallbackgrund sind erklärbar.

### Spike 2 — SurfaceRegion Microvoxel Handoff

**Priorität: P0. [Inference]**

Ziel: Beweisen, dass eine globale Shelladresse und eine lokale editierbare SDF-/Voxelregion dieselbe Oberfläche beschreiben und Edits über Unload/Reload/Origin Shift behalten.

Minimalumfang:

- ein Cube-Face-Testtile und eine `SurfaceRegion`,
- getesteter planetfest -> tangent -> region -> chunk Roundtrip,
- deterministische Density-Basis,
- sparse Destruktions-/Additionsdeltas,
- zwei Voxel-LODs mit Border-/Neighbor-Samples,
- abgeleitete Mesh-/Colliderprodukte mit Revisionstoken,
- Shell-/Region-Überblendung nur als Darstellung.

Gates:

- Grenzsamplewerte stimmen für Nachbarchunks und Shellanker,
- Edit bleibt nach Chunkpool-Rebind und Reload erhalten,
- verspätete Workerantwort kann neuere Revision nicht überschreiben,
- Entity-/Terrainautorität bleibt unabhängig vom Mesh.

### Spike 3 — Surface-to-Orbit Visual/Frame Transition Harness

**Priorität: P1. [Inference]**

Ziel: Visuelle Kontinuität und räumlich/simulative Kontinuität separat messen.

Minimalumfang:

- skriptbarer Pfad Boden -> Atmosphäre -> niedriger/hoher Orbit -> Rückkehr,
- instrumentierte Frame-/Originwechsel,
- Parent/Child-/SurfaceRegion-Readiness und Fallbackanzeige,
- Near/Far-/Depth-Partition-Varianten,
- Atmosphärenadapter mit Fallback und einem Kandidatenrenderer,
- gespeicherte absolute Pose/Geschwindigkeit/Entity-ID und Region-Editrevision,
- Screenshot-/Video nur als zusätzliche sichtbare Evidence.

Gates:

- kein harter visueller Loch-/Proxybruch im Referenzpfad,
- absolute Pose/Geschwindigkeit bleiben innerhalb definierter Toleranzen,
- Rückkehr findet dieselbe editierte Region/Entity wieder,
- Console/Telemetry zeigt keine stille Replan-/Frame-/Queue-Korrektur,
- CPU-/GPU-/Queuebudgets werden mit Hardware und Setup protokolliert.

## 14. Visual Continuity vs Simulation Continuity

### Visual Continuity

**[Inference]** Verantwortlich sind Renderer und Streamingpräsentation:

- Parentfallback,
- Crossfade/Dither/Geomorph,
- Skirts und Nachbarstitching,
- Atmosphären-/Aerial-Perspective-Maskierung,
- camera-relative Rendering und Depthstrategie,
- stabile Materialien/Beleuchtung über LODs,
- vorgewärmte Renderprodukte entlang des Sicht-/Routenkorridors.

Ein visueller Fehler darf repariert werden, indem ein älterer/grober Proxy länger sichtbar bleibt.

### Simulation Continuity

**[Inference]** Verantwortlich sind World State, Framegraph, Persistenz und Simulationshandoff:

- stabile Entity-/Body-/Region-/Tile-/Chunk-IDs,
- absolute/planetfeste Pose und Geschwindigkeit bei gemeinsamer Zeit,
- deterministische Terrainbasis und dauerhafte Editrevision,
- explizite Simulation Residency (`Full`/`Snapshot`/`Dormant`),
- atomare Frame-/Physics-Space-Übergabe,
- Missions-, Cargo-, Ownership-, Resource- und Hazardzustand,
- reproduzierbare Invalidierungsgründe.

Ein Simulationsfehler darf niemals durch einen Crossfade verdeckt werden. Wenn Collision, Terrainrevision oder Zielzustand nicht ready ist, muss der Handoff warten, degradieren oder sichtbar `NOT READY` melden.

### Handoffvertrag

**[Inference]** Der zentrale Vertrag sollte mindestens enthalten:

```text
TransitionTicket
  EntityId
  SourceFrameId / TargetFrameId
  AbsolutePoseAndVelocityAtTime
  TargetRepresentationId
  RequiredRenderChannels
  RequiredSimulationChannels
  TerrainOrContentRevision
  PlanningEpoch
  ReadinessState
  FailureOrDegradationReason
```

Der Renderer darf `RequiredRenderChannels` erfüllen und überblenden. Erst wenn `RequiredSimulationChannels` bestätigt sind, wechselt die Simulationsautorität.

## Offene Entscheidungen nach den Spikes

- **[Inference]** endgültige High-Precision-Repräsentation jenseits von `double`, falls reale Fehlerbudgets dies verlangen,
- **[Inference]** Heightfield-only versus volumetrische Basis pro Biome/Region,
- **[Inference]** CPU-/GPU-Meshing und Colliderstrategie,
- **[Inference]** serverbereitete 3D-Tiles-Pipeline für statische Stadtproxies,
- **[Inference]** konkrete Atmosphären-/Wolkenimplementation nach WebGL/WebGPU-/Unity-Zielentscheidung,
- **[Inference]** Netzwerkreplikation von Voxeloperationen und SurfaceRegion-Handoffs.
