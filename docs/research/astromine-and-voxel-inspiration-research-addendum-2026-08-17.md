# WELTRAUM - Astromine and Voxel Inspiration Research Addendum

**Datum:** 2026-08-17  
**Dokumentstatus:** `PROPOSED_RESEARCH_ADDENDUM`  
**Reviewstatus:** `READY_FOR_OWNER_REVIEW`  
**Implementierungsstatus:** `NO_NEW_IMPLEMENTATION_AUTHORITY`  
**Produktrepository:** `BenjaminHornung/Weltraum-Spiel`  
**Geprüfter Produkt-Remote-Stand:** `main@15f3550bd604856b25d40a7ac700ec4d5106b89e`  
**Voxel-Lab, aktuelle Integrationsreferenz:** `integration/voxel-kernel-lab-v1@c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d`  
**Historische Research-Basis der R01-R10-Synthese:** `d95992df05952ac4be6221ca1809c1c9e3c0ac9d`  

## 0. Kurzentscheidung

Die neuen Referenzen ändern die WELTRAUM-Architektur nicht grundlegend. Sie liefern aber starke externe Evidenz und konkrete UX-, Toolchain- und Presentation-Ideen für vier bereits vorhandene Projektstränge.

1. **Astromine** ist die stärkste neue Produkt- und Architekturreferenz für die bereits akzeptierte Richtung `globale Terrainchunks + objektlokale Voxelvolumen + Face-6-Connectivity + Fragmenttransfer + spätere Rigid-Body-Physik`. Besonders wertvoll ist die Entwickleraussage, dass abgetrennte Strukturen dynamisch in neue Voxelvolumen aufgeteilt werden. Das entspricht sehr genau der bestehenden R05-Richtung.
2. **Windy Voxel Forest** ist kein Vorbild für unsere World Authority, aber ein relevanter Research-Kandidat für spätere voxelbasierte Animationsbakes, sparse Render-Bricks, Instancing und Animation-Streaming. Die hohen Speicherwerte sind zugleich ein Warnsignal.
3. **Castle Craft** zeigt, wie stark eine blockige Welt allein durch eine separate Foliage-/Presentation-Schicht an Dichte und Eigenständigkeit gewinnen kann. Die dort verwendeten 1-m-Voxels und nicht-voxelisierten Bäume werden nicht übernommen.
4. **Vengi/VoxEdit** ist bereits korrekt in G12 als gepinnter Adapter- und Orakelpfad vorgesehen. Die neue Prüfung stärkt diese Entscheidung. Vengi wird nicht zur HVOX-Authority und nicht zum Produkteditor.
5. Der ältere **Voxel-Godrealm-Meme-Post** besitzt keine belastbare technische Evidenz. Seine einzige sinnvolle Rolle ist ein Produktprinzip: Voxels sollen in WELTRAUM mechanische Konsequenz haben und nicht nur eine austauschbare Grafikhaut sein.

**Gesamturteil:** `ADOPT_AS_RESEARCH_REFERENCES`, nicht `ADOPT_AS_ARCHITECTURE`.

---

## 1. Scope und Evidenzklassen

Dieses Addendum untersucht ausschließlich, was aus den fünf neuen Referenzen für bestehende WELTRAUM-Verträge sinnvoll übernommen werden kann.

### 1.1 Neue externe Referenzen

- Astromine Reddit-Thread: `https://www.reddit.com/r/VoxelGameDev/comments/1jtt18s/destruction_and_building_in_our_unannounced_voxel/`
- Astromine Steam: `https://store.steampowered.com/app/1833210/Astromine/`
- Windy Voxel Forest: `https://www.reddit.com/r/VoxelGameDev/comments/1l7r6un/windy_voxel_forest/`
- Castle Craft Foliage: `https://www.reddit.com/r/VoxelGameDev/comments/yelhom/were_using_blocky_voxels_with_lots_of_foliage_to/`
- Voxel editor, später Vengi/VoxEdit: `https://www.reddit.com/r/VoxelGameDev/comments/f0ytgu/first_windows_release_of_my_voxel_editor/`
- Voxel Godrealm Meme: `https://www.reddit.com/r/VoxelGameDev/comments/cvh7kq/virgin_minecraft_wannabe_vs_chad_voxel_godrealm/`
- Vengi Repository: `https://github.com/vengi-voxel/vengi`
- Vengi v0.5.0: `https://github.com/vengi-voxel/vengi/releases/tag/v0.5.0`

### 1.2 Relevante Projektquellen

- `WELTRAUM_RESEARCH_SYNTHESIS_2026-08-12.md`
- `WELTRAUM_RESEARCH_DECISION_LOG_2026-08-12.md`
- `05_destruction_connectivity_physics_research_report(1).md`
- `08_planet_scale_streaming_lod_persistence_research_report(1).md`
- `10_asset_pipeline_visual_style_research_report(1).md`
- `G12_Blender_to_HVOX_Toolchain_Architekturbericht_2026-08-12.md`
- `G14_UX_MODES_EDITOR_SURFACE_CITY_SPACE_ABSCHLUSSBERICHT_2026-08-12.md`
- `G01_core_game_loop_progression_vertical_slices_abschlussbericht_2026-08-12.md`

### 1.3 Aussageklassen

- **EXTERNAL FACT:** direkt vom Entwickler, Steam-Eintrag oder verifiziertem Upstream-Repository belegt.
- **PROJECT FACT:** bereits akzeptierte WELTRAUM-Entscheidung.
- **INFERENCE:** technische Ableitung aus externen und internen Fakten.
- **PROPOSAL:** neue Empfehlung dieses Addendums, noch keine akzeptierte Projektentscheidung.
- **UNKNOWN:** öffentlich nicht belegt oder nicht durch eigene Messung bestätigt.

Community-Performancewerte werden niemals als WELTRAUM-Benchmark behandelt.

---

## 2. Bereits akzeptierte WELTRAUM-Grenzen

Die neuen Quellen müssen sich in bestehende Entscheidungen einordnen und dürfen diese nicht still überschreiben.

### 2.1 Destruction und Physik

Bereits akzeptiert beziehungsweise `ACCEPTED_FOR_LATER`:

- globale statische Terrainchunks plus objektlokale Voxelvolumen;
- Face-6-Connectivity;
- Boundary-Ergebnis `Unknown`, niemals voreilig `Detached`;
- regional begrenzte, resumierbare Connectivity-Analyse;
- atomarer, revisionsgeprüfter Zelltransfer in Fragmente;
- voxelbasierte Masse, Schwerpunkt und Trägheit;
- Rapier als erster Browser-Physikspike;
- greedy 3D-Cuboid-Compounds als Collider-Baseline;
- kein Rigid Body und kein Collider pro Voxel.

Entscheidungen: `D-018`, `D-019`, `D-020`.

### 2.2 Planet

Bereits akzeptierte Forschungsrichtung:

- echte planetare Addressierung und persistente Welt, nicht nur visuelle Kugelillusion;
- Cube-Sphere plus Generator, Eventlog und Brick-Checkpoints als stärkster WELTRAUM-Kandidat;
- globaler dynamischer SVO/64-Tree als alleinige Planetauthority ist `REJECTED` (`D-017`);
- Render-LOD und Simulations-LOD bleiben getrennt.

### 2.3 Assetpipeline

Bereits akzeptierte Richtung:

- `HVOX v1 + asset.hestia.json` als geplante Asset-Authority;
- GLB nur Source-/Preview-/Proxyrolle;
- Blender, VOX, Vengi, Blockbench und Qubicle sind Source- oder Adapterpfade;
- stabile Materialkeys, Anchors, Pivots, Face-6-Validierung und Provenienz;
- Human Art Review bleibt zwingend (`D-022`).

### 2.4 Player Construction

G14 spezifiziert bereits:

- veröffentlichte Asset-/Part-Kataloge;
- Placement Ghost und Anchor-/Support-Cues;
- Face-6-Connectivity und Support als überprüfbare Fakten;
- `valid`, `warning`, `invalid`, `pending`, `unknown`, `missingCoverage`, `stale`;
- Draft -> Validate -> Commit;
- UI ist keine World Authority.

Astromine erweitert diesen Vertrag nicht um eine zweite Construction-Authority. Es liefert vor allem eine gute visuelle Referenz für Connection Feedback.

---

## 3. Astromine

### 3.1 Belegte Entwickler-Claims aus Reddit

**EXTERNAL FACT:** Der Entwickler nennt Unity als Engine und beschreibt starke Nutzung von Unity Job System und Burst sowie einen Teil der Voxelberechnung auf der GPU.

**EXTERNAL FACT:** Die Planetenoberfläche verwendet Marching Cubes mit LOD. Der Planet ist laut Entwickler tatsächlich kugelförmig und keine reine Shaderillusion.

**EXTERNAL FACT:** Für LOD-Übergänge wird Transvoxel verwendet. Der Entwickler nennt drei bis vier Iterationen, bis der Übergangspfad funktionierte.

**EXTERNAL FACT:** Der Entwickler nennt echte sphärische Planeten als zusätzliche Schwierigkeit für AI-Pathfinding und sogar für Unity-Szene-Debugging, weil eine einheitliche globale Up-Richtung entfällt.

**EXTERNAL FACT:** Sichtbare Voxelobjekte werden als klassische Triangle Meshes mit Greedy Meshing gerendert.

**EXTERNAL FACT:** Beim Trennen einer Struktur wird diese laut Entwickler dynamisch in neue Voxelvolumen aufgeteilt.

**EXTERNAL FACT:** Die grünen Flächen während des Bauens zeigen an, womit ein neues Bauteil verbunden wird. Sie sind keine vorab definierten Bruchsegmente.

### 3.2 Belegte Produkt-Claims aus Steam

Steam beschreibt Astromine aktuell als 1- bis 4-Spieler-Survival-Mining-Spiel in einem vollständig zerstörbaren Sonnensystem. Der Eintrag nennt:

- vollständig zerstörbare prozedurale kugelförmige Planeten;
- voxelbasierte Planeten, Kreaturen und Strukturen;
- Materialeigenschaften mit unterschiedlicher struktureller Wirkung;
- Feuer und strukturelles Versagen;
- Stromnetze;
- voxelbasiertes Bauen von Basen und Raumschiffen;
- physisches Zerstören von Gegnern;
- Flug zwischen Planeten.

Diese Punkte sind Produktversprechen beziehungsweise öffentliche Featurebeschreibungen. Sie sind keine vollständige technische Dokumentation.

### 3.3 Bedeutung für R05

Astromine ist die stärkste neue externe Stütze für `D-018`.

Der interessante Zusammenhang ist:

```text
Authoritative voxel structure
  -> local edit / damage
  -> connectivity changes
  -> disconnected component
  -> new voxel volume
  -> separate physics representation
```

Das ist praktisch dieselbe grobe Zustandsfolge, die R05 für WELTRAUM empfiehlt.

**PROPOSAL:** Astromine wird künftig neben Teardown als `HIGH_VALUE_COMMUNITY_PRODUCT_REFERENCE` für R05/WP14-WP16 geführt.

Dabei muss die Evidenzklasse sauber bleiben:

- Entwicklerkommentare sind externe Entwickler-Claims.
- Steam ist Produkt-/Marketing-Claim.
- Interne Algorithmen, Collider, Connectivity-Suche, Fragmentcaps, Mass Properties und Schedulerdetails sind weiterhin `UNKNOWN`.

### 3.4 Bedeutung für Player Construction

Astromines grüne Connection-Cues sind direkt als UX-Inspiration brauchbar.

**PROPOSAL:** WELTRAUM Player Construction soll bei Placement nicht nur geometrisches Snapping zeigen, sondern mindestens getrennt visualisieren:

1. `mate candidate` - geometrisch kompatibler Anchor/Socket;
2. `structural support` - trägt Face-6-seitig zur tatsächlichen Unterstützung bei;
3. `functional connection` - etwa Power, Data, Fluid, Joint;
4. `invalid` - Kollision, Permission, Material-, Support- oder Coverageproblem;
5. `unknown/pending` - Connectivity oder Streamingwissen nicht vollständig.

Die visuelle Farbe ist keine Authority. Der Cue ist eine Projektion eines revisionsgebundenen Support-/Connection-Receipts.

**ADOPT:** Connection-Cue-Idee.  
**DO NOT ADOPT:** UI-Farbe oder ein einzelnes grünes Highlight als Beweis struktureller Stabilität.

### 3.5 Bedeutung für Planetarchitektur

Astromine zeigt, dass ein echtes sphärisches Voxelspiel öffentlich als Produktziel verfolgt wird und dass die dadurch entstehenden Pathfinding- und Debugprobleme real sind.

Es bestätigt aber **nicht**, dass WELTRAUM Marching Cubes oder Transvoxel übernehmen sollte.

WELTRAUM hat harte Block-/Microvoxel-Nahdarstellung als Projektregel. Deshalb:

- Marching Cubes: `REFERENCE_ONLY`
- Transvoxel: `REFERENCE_ONLY_FOR_LOD_RESEARCH`
- echte sphärische Welt statt visueller Fake-Sphere: `CONCEPTUALLY_ALIGNED`
- Pathfinding-/Up-Vector-Probleme: `ADOPT_AS_RISK_REGISTER_ITEM`

### 3.6 Performanceaussagen

Steam nennt als Mindest-GPU eine GTX-1060-Klasse und als Empfehlung eine GTX-1080-Klasse. Daraus darf **keine** WELTRAUM-Leistungsannahme entstehen.

Gründe:

- unbekannte Auflösung und Qualitätseinstellungen;
- unbekannte Worst-Case-Zerstörung;
- unbekannte CPU-/GPU-Aufteilung;
- unbekannte Framerate;
- andere Engine und andere Renderingtechnik;
- keine identischen Fixtures.

**Status:** `INSPIRATIONAL_ONLY`, kein Benchmark.

---

## 4. Windy Voxel Forest

### 4.1 Belegte technische Claims

**EXTERNAL FACT:** Die Szene enthält laut Autor ungefähr 8.000 Bäume. Jeder Baum ist eine Top-Level-Instanz in der BVH. Nur Terrain wird LOD-ed.

**EXTERNAL FACT:** Animationen werden offline aus skinned GLTF-Modellen gebacken. Ein Tool voxelisiert die Animationsframes. Dadurch kann der Autor klassische Modeling-/Rigging-Tools verwenden und die Voxelrepräsentation nachgelagert erzeugen.

**EXTERNAL FACT:** Vier Baumtypen benötigen für fünf Sekunden Animation bei 12,5 FPS ungefähr 630 MB BLAS-Daten. Ein einzelner Frame für alle Baumtypen zusammen liegt laut Autor bei ungefähr 10 MB. Animation Frames werden deshalb aus System-RAM in relevante Animation-BLASes kopiert, statt alles permanent in VRAM zu halten.

**EXTERNAL FACT:** CPU-seitig nutzt der Autor einen 64-tree/Contree-Speicher. Für Rendering verwendet er eine 4-wide BVH mit 2-level Contrees als Primitive, grob `16^3` sparse bricks.

**EXTERNAL FACT:** Der Autor beschreibt das Projekt als hauptsächlich selbstgeschriebene C++-/Vulkan-Hobbyengine, compute-basiert und zum Zeitpunkt des Posts noch ohne Hardware-Raytracing-API.

### 4.2 Was daran für WELTRAUM relevant ist

Der wichtigste Gedanke ist nicht der konkrete Tree.

Relevant ist die Pipeline:

```text
skinned authored mesh
  -> offline animation sampling
  -> voxelized frame sequence
  -> compressed/sparse render representation
  -> instance many copies
  -> stream only needed animation data
```

Das passt zu unserer G12-Grundidee, Source-Semantik und Runtime-Voxelprodukt zu trennen.

### 4.3 Was wir nicht übernehmen

**REJECT AS AUTHORITY:** globaler 64-tree/Contree als neue World Authority. Das widerspricht `D-017`.

**REJECT FOR V1:** vollständig frameweise voxelisierte Vegetation als Standardanimation. Die vom Autor selbst genannten Speichergrößen zeigen, dass das ein spezialisierter und teurer Pfad ist.

**REJECT:** Community-FPS-Werte als Browser-Benchmark.

### 4.4 Sinnvoller späterer Spike

**PROPOSAL: `VA-01 Voxel Animation Bake Comparison`**, frühestens nach einem stabilen HVOX-/Asset-Contract und nicht als Bestandteil der aktuellen Voxel-Lab-Roadmap.

Ein einziges authored Hero-Tree-Asset mit identischem Windclip wird in drei Darstellungen verglichen:

A. klassische Rig-/Vertex-/Bone-Animation als Presentation;
B. prozedurale Winddeformation auf einer abgeleiteten Renderrepräsentation;
C. offline voxelisierte Framefolge nach dem Windy-Forest-Prinzip.

Zu messen:

- autoritative Bytes;
- Derived Bytes pro Frame;
- Unique Bricks;
- Changed Bricks pro Frame;
- Uploadbytes pro Sekunde;
- CPU-Decode;
- GPU-Upload;
- Draw/Traversal-Kosten;
- visuelle Blocktreue;
- Verhalten bei Zerstörung oder Astabtrennung.

**Erwarteter Default:** A oder B für normale Vegetation, C nur bei nachgewiesenem visuellen oder spielmechanischen Mehrwert.

---

## 5. Castle Craft

### 5.1 Belegte Claims

**EXTERNAL FACT:** Der Entwickler beschreibt die Welt als individuell texturierte `1x1x1 m`-Voxels.

**EXTERNAL FACT:** Gras wird über einen hierarchischen Instanced-Static-Mesh-Spawner erzeugt.

**EXTERNAL FACT:** Die Bäume sind absichtlich keine Voxels, um organischer zu wirken.

**EXTERNAL FACT:** Communityfeedback kritisierte eine zu hohe Menge fliegender Blätter in offenem Gelände. Der Entwickler bestätigte, dass die Partikelmenge angepasst werden soll. Ein weiterer Kommentar schlug für Wetlands Staub, trockenes Gras und Cattail-Fluff statt generischer Blätter vor.

### 5.2 Bedeutung für unsere Art Direction

Castle Craft zeigt einen wichtigen Presentation-Grundsatz:

> Eine blockige Welt muss ihre visuelle Dichte nicht vollständig aus autoritativen Voxelzellen beziehen.

Für WELTRAUM ist das besonders relevant, weil eine feinere Voxelauflösung allein keine glaubwürdige Vegetationsdichte garantiert.

**PROPOSAL:** Vegetation wird in zwei Klassen geteilt.

#### Structural Flora

- Hero Trees;
- große Wurzeln;
- dicke Äste;
- gameplayrelevante Büsche oder Pflanzen;
- zerstörbare große Pflanzenbestandteile.

Diese können objektlokale Voxelautorität besitzen.

#### Presentation Flora

- Gras;
- kleine Halme;
- Reeds;
- kleine Blätter;
- Moose;
- Blüten;
- dünne dekorative Zweige;
- biomeabhängige kleine Windpartikel.

Diese werden aus revisionsgebundenen Surface-/Biome-Facts instanziert und sind keine zweite World Authority.

### 5.3 Klare Abgrenzung

**REJECT:** 1-m-Voxelmaß als Zielrichtung.  
**REJECT:** nicht-voxelbasierte Hero Trees als Hestia-Hauptsprache.  
**ADOPT:** dichte Instancing-Schicht für kleine Vegetation.  
**ADOPT:** biomeabhängige Windpartikel statt generischem `spawn leaves everywhere`.  
**ADOPT:** Foliage als wichtiges Mittel, eine Blockwelt visuell von Minecraft-Assoziationen zu lösen.

### 5.4 Biome Particle Vocabulary

**PROPOSAL:** Ambient Particles werden Teil der Biome-Presentation-Definition und erhalten keine pauschale globale Vorlage.

Beispiele:

- Wetland: Cattail fluff, pollen, insects, fine mist droplets;
- forest: leaves, bark dust, spores;
- dry grassland: dust, grass fibers, seeds;
- coast: spray, salt mist, foam specks;
- volcanic/mining: ash, mineral dust, sparks nur bei physischer Quelle.

Partikeldichte wird aus lokalen Source-Facts abgeleitet. Ein einzelner Baum rechtfertigt keine Waldmenge fliegender Blätter.

---

## 6. Vengi / VoxEdit

### 6.1 Herkunft

Der ursprüngliche Reddit-Post stammt von `mgerhardy`. Der Autor erklärt dort, dass er einen offenen, hackbaren und plattformübergreifenden Voxel-Editor benötigte, weil viele vorhandene Editoren ihren Quellcode nicht offenlegten.

Das Projekt entwickelte sich zu Vengi/VoxEdit weiter.

### 6.2 Verifizierter aktueller Pin

Für dieses Addendum wurde Upstream erneut geprüft:

```text
repository: vengi-voxel/vengi
release:    v0.5.0
commit:     4d5fbc9993c9bd877e0e0a4936cacdca41320439
published:  2026-04-18
code license: MIT
```

Der Release stellt unter anderem Emscripten-Artefakte für `voxconvert` und `voxedit` bereit.

Im v0.5.0-Release sind außerdem unter anderem dokumentiert:

- GLTF-Animation-Fixes;
- Teardown `bin`-Support;
- Teardown `TDCZ`-Chunk-Support;
- Mesh-Voxelization-Fixes;
- stark verbesserter greedy texture mesher;
- weitere Format- und Editorverbesserungen.

Die Repository-Lizenz ist MIT für den Code. Enthaltene Assets können dagegen CC BY-SA 3.0 oder eigene Lizenzdateien haben. Assetlizenz und Codelizenz dürfen nicht vermischt werden.

### 6.3 Abgleich mit G12

G12 hat Vengi bereits korrekt eingeordnet:

- Vengi ist Source Adapter oder Orakel;
- `SourceScene v1` bleibt die normalisierte Compilergrenze;
- HVOX bleibt die Asset-Authority;
- Konvertierungen brauchen Verlustberichte;
- Upstream-Version und Commit werden gepinnt;
- Qubicle wird in V1 vorzugsweise über Vengi importiert;
- Vengi darf die normative Ausgabe nicht unbemerkt bestimmen.

**Ergebnis:** keine neue Architekturentscheidung erforderlich.

### 6.4 Zusätzliche sinnvolle Nutzung

**PROPOSAL:** AT-06 soll explizit vier Vengi-Fixtures erhalten:

1. `.vox -> Vengi -> SourceScene/HVOX`;
2. Qubicle -> Vengi -> SourceScene/HVOX;
3. Vengi-Szene mit Animation/Transforms -> Loss Report;
4. Teardown `bin/TDCZ` ausschließlich als Research-/Interoperability-Fixture, nicht als Produktimportvertrag.

Ziel ist nicht maximale Formatunterstützung. Ziel ist, Semantikverlust sichtbar und deterministisch zu machen.

**REJECT:** Vengi als Runtime Dependency im Browserprodukt ohne separaten Bedarf.  
**REJECT:** Vengi-Dateien als kanonischer Save oder Asset Contract.  
**ADOPT:** gepinnter External Tool/Oracle am Toolchain-Rand.

---

## 7. Voxel-Godrealm-Meme

Der alte Meme-Post liefert keine belastbare technische Implementierungsinformation und wird nicht als Researchquelle für Algorithms, Performance oder Architektur verwendet.

Sein sinnvoller Wert ist eine Produktwarnung:

> Wenn Voxels nur aussehen wie Würfel, aber keine systemische Konsequenz haben, konkurriert das Spiel primär über einen visuellen Stil. Wenn Material, Zerstörung, Bauen, Mining, Masse, Support und Persistenz aus der Voxelrepräsentation folgen, wird die Technik Teil der Spielerfantasie.

Das entspricht bereits G01:

- Voxels und Physik sind sinnvoll, wenn sie Entscheidungen verändern;
- Zugang, Mining, Reparatur, Navigation, Taktik und Engineering sollen dieselbe materielle Welt nutzen.

**Status:** `DESIGN_PRINCIPLE_ONLY`.

---

## 8. Cross-Source-Synthese

### 8.1 Vier getrennte Schichten

Die Referenzen sollen nicht zu einer einzigen Fremdarchitektur vermischt werden.

| Schicht | Referenz | Was wir daraus lernen |
|---|---|---|
| Simulation / Destruction | Astromine | Connectivity erzeugt neue Voxelobjekte; Building und Destruction sollten dieselbe strukturelle Wahrheit teilen |
| Animation / Rendering Research | Windy Voxel Forest | authored Animation kann offline in Voxelframes gebacken und sparse gestreamt werden, ist aber speicherintensiv |
| Environment Presentation | Castle Craft | Foliage-Dichte und Winddetails können blockige Welten stark aufwerten, ohne alles zur Voxel-Authority zu machen |
| Asset Toolchain | Vengi | Multi-Format-Konvertierung, Voxel-Editing und externe Oracles sind wertvoll, solange HVOX und Provenienz die Authority-Grenze behalten |

### 8.2 Das gemeinsame Zielbild

Für WELTRAUM entsteht daraus folgendes Zielbild:

```text
CANONICAL WORLD / OBJECT STATE
  hard block voxels
  stable material identity
  anchors / sockets / support
  revisions / events
  ownership / persistence

        |
        +--> STRUCTURAL ANALYSIS
        |      Face-6 connectivity
        |      support / unknown / detached
        |      fragment candidates
        |
        +--> PHYSICS DERIVATION
        |      mass / COM / inertia
        |      greedy cuboid colliders
        |      bounded rigid bodies
        |
        +--> BUILD PRESENTATION
        |      placement ghost
        |      mate cues
        |      support cues
        |      validation / unknown
        |
        +--> VISUAL PRESENTATION
        |      greedy meshes
        |      AO
        |      vegetation instancing
        |      particles / wind
        |      optional animation products
        |
        +--> TOOLCHAIN
               Blender / VOX / Vengi / Blockbench
                 -> SourceScene
                 -> HVOX
                 -> derived GLB / evidence
```

Die zentrale Regel bleibt: **jede Schicht darf komplex sein, aber keine zweite World Truth bilden.**

---

## 9. Adopt / Spike / Reference / Reject Matrix

| Finding | Entscheidung | Zielstrang | Begründung |
|---|---|---|---|
| Disconnected structure -> new voxel volume | `ADOPT_AS_REFERENCE` | R05/WP14-WP16 | starke Übereinstimmung mit bestehender Zielarchitektur |
| Building connection highlights | `ADOPT_UX_IDEA` | G14 Player Construction | gute Visualisierung einer bereits vorhandenen Support-/Mate-Semantik |
| Unity Jobs/Burst/GPU compute | `REFERENCE_ONLY` | Scheduler/Backend | Engine-spezifisch, keine Browserentscheidung |
| Greedy triangle meshes | `ALIGNED` | Voxel Lab | bereits eigene Richtung |
| Marching Cubes terrain | `REJECT_FOR_NEAR_FIELD` | Planet/Rendering | widerspricht harter Blockdarstellung |
| Transvoxel | `REFERENCE_ONLY` | Planet LOD | LOD-Lernquelle, nicht automatisch kompatibel |
| echte sphärische Welt | `ALIGNED_CONCEPT` | R08 | bestätigt Relevanz echter Planetgeometrie |
| spherical-world AI/debug complexity | `ADOPT_RISK` | NPC/Nav/Editor | konkretes Planetrisiko |
| frame-voxelized GLTF animation | `SPIKE_LATER` | Asset/Animation | technisch interessant, zu teuer als Default |
| 64-tree als CPU-Worldstore | `REJECT_AS_WORLD_AUTHORITY` | Planet | D-017 bleibt gültig |
| sparse `16^3` Render-Bricks | `REFERENCE_ONLY` | Renderer Research | als Derived Structure zulässig |
| mass foliage instancing | `ADOPT_PRESENTATION_DIRECTION` | Hestia Art/Worldgen | hohe visuelle Wirkung, geringe Authority-Kosten |
| non-voxel Hero Trees | `REJECT_FOR_HESTIA_HERO_LANGUAGE` | Art Direction | große relevante Bäume sollen voxelkompatibel bleiben |
| biome-specific wind particles | `ADOPT_ART_RULE` | Biome Presentation | verbessert Plausibilität und Identität |
| Vengi v0.5.0 as adapter/oracle | `CONFIRM_EXISTING_G12_DIRECTION` | AT-06 | bereits projektkonform eingeplant |
| Vengi as authority/runtime core | `REJECT` | Asset/Runtime | HVOX/SourceScene bleiben Grenzen |
| Voxel-Godrealm meme | `DESIGN_PRINCIPLE_ONLY` | G01 | keine technische Evidenz |

---

## 10. Auswirkungen auf bestehende Work Packages

Dieses Addendum erzeugt **keine neue serielle Kernroadmap** und darf die bestehenden Gates nicht überspringen.

### 10.1 WP14 - Face-6 Connectivity, mark-only

Zusätzliche Fixture-Idee:

- kleine aus Placement Commands gebaute Wand-/Trägerstruktur;
- Supportvisualisierung;
- gezieltes Entfernen eines tragenden Bereichs;
- Ergebnis bleibt `supported`, `detached-candidate`, `unknown` oder `pending`;
- noch kein Zelltransfer und keine Physik.

Ziel: Astromine-artiges Building/Destruction-Zusammenspiel auf unserem Contract testen, ohne WP15/WP16 vorzuziehen.

### 10.2 WP15 - genau eine statische Fragmentextraktion

Zusätzliche Fixture-Idee:

- Struktur wird zunächst über Builder-Commands zusammengesetzt;
- danach wird eine Verbindung entfernt;
- genau eine bestätigte Face-6-Komponente wird atomar in ein objektlokales Voxelvolumen transferiert;
- ursprüngliche und neue Authority dürfen keine Zelle doppelt besitzen.

### 10.3 WP16 - genau ein Rapier-Fragment

Zusätzliche Akzeptanzfrage:

- verhält sich ein aus tatsächlich gebauter Struktur erzeugtes Fragment genauso wie ein authored Fragment;
- Masse, COM, Inertia und Collider stammen ausschließlich aus übertragenen Materialzellen;
- Placement-UI, Render-Mesh und frühere Socketinformationen dürfen die Physics Truth nicht ersetzen.

### 10.4 G14 Player Construction

Kein neuer Core-Contract. Ergänzen:

- getrennte Visual States für mate, support, functional, invalid, unknown/pending;
- Connection Cue darf nur nach Resolve/Validation erscheinen;
- bei `missingCoverage` keine sichere grüne Supportanzeige.

### 10.5 G12 / AT-06

Vengi bleibt bereits geplanter Adapter-/Orakelpfad. Dieses Addendum empfiehlt lediglich, die Upstream-Fähigkeiten von v0.5.0 in den Testkatalog aufzunehmen.

### 10.6 Art-/Worldgen-Programm

Neue spätere Presentation-Gates, getrennt von Voxel-Kernel-WPs:

- `VF-01 Foliage Instancing Fixture`
- `VF-02 Biome Wind Particle Vocabulary`
- `VA-01 Voxel Animation Bake Comparison`

Diese Gates sind Vorschläge und noch nicht in die akzeptierte Kernroadmap einzufügen.

---

## 11. Vorgeschlagene kleine Folgegates

### VF-01 - Foliage Instancing Fixture

**Ziel:** Beweisen, dass dichte Kleinstvegetation aus revisionsgebundenen Surface-Facts abgeleitet werden kann, ohne neue Voxel-Authority.

Fixture:

- ein Wetland-Patch;
- ein Hero Tree als strukturelles Asset;
- Reeds, grass, moss und kleine leaves als instanzierte Presentation;
- identischer Seed ergibt identische Platzierung;
- Edit des Bodens invalidiert ausschließlich betroffene Instanzen;
- keine Instanz-ID wird Gameplay-/Save-Identität.

### VF-02 - Biome Wind Particle Vocabulary

**Ziel:** Partikel nach biome- und source-spezifischen Regeln statt globalen Effekten.

Gate:

- kein Partikeltyp ohne lokale Quelle;
- Dichte folgt Quellflächen/Vegetationsdichte;
- fester Seed für Evidence;
- Reduced Motion Variante;
- keine Gameplaywirkung ohne separaten Domain-Event.

### VA-01 - Voxel Animation Bake Comparison

Bereits in Abschnitt 4.4 beschrieben. Dieser Spike soll explizit **nicht** entscheiden, dass WELTRAUM Voxel-Raytracing übernehmen soll.

### AT-06V - Vengi Loss-Oracle Extension

Kein neues Toolchain-Hauptgate, sondern Unterfixture von AT-06:

- gepinnter Upstream-Commit;
- Input-/Output-Hashes;
- Axis, Pivot, Palette, Scenegraph und Animation Loss Report;
- kein Silent Repair;
- Asset- und Codelizenz getrennt erfassen.

---

## 12. Risiken und Stop-Regeln

1. **Astromine nicht reverse-engineeren, um interne Details zu erfinden.** Nur Entwickler-/Produktclaims übernehmen.
2. **Kein Marching-Cubes-Rückfall.** Die Referenz legitimiert keine glatte Near-Field-Darstellung.
3. **Kein globaler 64-tree-Reboot.** Windy Forest ist ein Render-/Storage-Forschungsfall, kein Grund `D-017` zu öffnen.
4. **Kein Voxel-Animation-Default ohne Messung.** Speicher- und Uploadkosten sind offensichtlich relevant.
5. **Foliage ist nicht automatisch Gameplay.** Kleine Instanzen bleiben Presentation, solange kein Domainvertrag anderes verlangt.
6. **Keine grüne Builderfläche als Authority.** Support muss aus Resolve/Connectivity/Revision stammen.
7. **Vengi nicht als Universalwahrheit.** Jeder Importpfad braucht Loss Report und Provenienz.
8. **Keine Fremdbenchmarks als eigene Evidence.** Steam-Anforderungen und Reddit-FPS sind nur Kontext.
9. **Keine Lizenzannahme für Assets.** Vengi-Code ist MIT, beigefügte Assets können andere Lizenzen besitzen.
10. **Keine neue Kernroadmap durch dieses Addendum.** Die serielle Voxel-/Benchmark-/Physics-Folge bleibt erhalten.

---

## 13. Offene Fragen

### Astromine

Öffentlich derzeit nicht belegt:

- Connectivity-Algorithmus;
- Anchor-/Supportmodell;
- Fragmentbudget;
- Collidergeneration;
- Masse-/Trägheitsberechnung;
- Umgang mit sehr kleinen Komponenten;
- Worker-/Job-Adoption und stale data;
- Speicherung persistenter Zerstörung;
- exakter Building-Command-Vertrag;
- Netzwerkreplikation der strukturellen Änderungen.

Diese Punkte dürfen nicht aus dem Video erraten werden.

### WELTRAUM

Später zu entscheiden oder zu messen:

- wann Structural Flora eigene Voxel Authority benötigt;
- ob Hero-Tree-Wind nur Presentation bleibt oder Zellpositionen beeinflussen darf;
- welche Foliage-Dichte auf H2/H3 tragfähig ist;
- ob VA-01 überhaupt nötig wird, falls billigere Windrepräsentationen visuell genügen;
- welche Support-/Mate-Cues im Player Builder farb- und accessibilityseitig endgültig verwendet werden.

---

## 14. Quellenregister

### Externe Quellen

1. LVermeulen, Reddit, Astromine Destruction and Building Thread, abgerufen 2026-08-17.
2. Astromine Steam Store Page, Alientrap, abgerufen 2026-08-17.
3. UnalignedAxis111, Reddit, Windy Voxel Forest, abgerufen 2026-08-17.
4. lordscottish, Reddit, Castle Craft blocky voxels and foliage, abgerufen 2026-08-17.
5. mgerhardy, Reddit, First Windows Release of My Voxel Editor, abgerufen 2026-08-17.
6. Vengi `v0.5.0`, commit `4d5fbc9993c9bd877e0e0a4936cacdca41320439`, veröffentlicht 2026-04-18.
7. Vengi LICENSE am Tag `v0.5.0`, MIT für Code, Assetlizenzen separat.
8. Voxel Godrealm meme thread, nur als Design-/Communitykontext, keine technische Evidenz.

### Projektquellen

1. `WELTRAUM_RESEARCH_SYNTHESIS_2026-08-12.md`
2. `WELTRAUM_RESEARCH_DECISION_LOG_2026-08-12.md`
3. `05_destruction_connectivity_physics_research_report(1).md`
4. `08_planet_scale_streaming_lod_persistence_research_report(1).md`
5. `G12_Blender_to_HVOX_Toolchain_Architekturbericht_2026-08-12.md`
6. `G14_UX_MODES_EDITOR_SURFACE_CITY_SPACE_ABSCHLUSSBERICHT_2026-08-12.md`
7. `G01_core_game_loop_progression_vertical_slices_abschlussbericht_2026-08-12.md`

---

## 15. Abschlussstatus

### Neue Erkenntnisse

- Astromine liefert starke reale Entwicklungsreferenz für dynamisches Splitten getrennt gewordener Voxelstrukturen und visuelle Connection-Cues beim Bauen.
- Windy Voxel Forest liefert einen konkreten, aber speicherintensiven Offline-Bake-Pfad für voxelisierte Animation.
- Castle Craft bestätigt die hohe visuelle Hebelwirkung einer separaten, instanzierten Foliage-Schicht.
- Vengi v0.5.0 bestätigt und erweitert die bereits vorgesehene G12-Rolle als Toolchain-Adapter und Orakel.

### Keine geänderten akzeptierten Entscheidungen

Dieses Addendum ändert ausdrücklich **nicht**:

- `D-017` globaler 64-tree/SVO als alleinige Planetwahrheit bleibt abgelehnt;
- `D-018` Terrainchunks + objektlokale Voxelvolumen + Face-6 + atomarer Transfer bleibt die Destruction-Richtung;
- `D-019` Rapier + greedy 3D-Cuboids bleibt erster Physikspike;
- `D-021` HVOX + Asset Contract bleibt Assetpipeline-Richtung;
- `D-022` Human Art Review bleibt zwingend;
- harte Block-/Microvoxel-Nahdarstellung bleibt gesetzt;
- keine Produktintegration vor dem dafür vorgesehenen Integrationsgate.

### Empfohlener Projektstatus

```text
ASTROMINE_AND_VOXEL_INSPIRATION_RESEARCH_ADDENDUM
= READY_FOR_OWNER_REVIEW

Astromine reference
= ADOPT_AS_HIGH_VALUE_REFERENCE

Windy Forest
= REFERENCE + LATER_SPIKE_CANDIDATE

Castle Craft foliage
= ADOPT_PRESENTATION_PRINCIPLES

Vengi
= CONFIRM_EXISTING_G12_DIRECTION

Architecture reset
= NO
```
