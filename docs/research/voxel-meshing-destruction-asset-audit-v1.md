# Voxel Meshing, Destruction, and Asset Audit v1

Status: Research-Entscheidung, keine Runtime-Freigabe
Repository: `BenjaminHornung/Weltraum-Spiel`
Basis: `origin/main` bei `c780656c29ff4e5794be9ba58d6b78396a5826d5`
Audit-Branch: `research/voxel-meshing-destruction-asset-audit-v1`
Stichtag: 2026-07-13

## 1. Ergebnis in einem Satz

[Inference] Hestia sollte **keine einzelne universelle Voxelmesh-Pipeline**
bekommen, sondern eine gemeinsame kanonische Datenbasis mit zwei bewusst
getrennten Oberflächenpfaden: quantisierte SDF-Bricks plus Transvoxel für
organisches Terrain und Höhlen; Semantic-Volume-/Structural-Assembly-Bricks mit
authored GLB-Proxies, Greedy Meshing für achsenharte Flächen und einem
eingekapselten Dual-Verfahren für freie Bruchflächen bei Gebäuden,
Microvoxels und Asteroiden.

[Inference] Das mutable Primärformat ist ein **sparsches Set uniformer Bricks**,
nicht ein Octree und nicht das Dreiecksmesh. Octrees, BVHs, Geometry
Clipmaps/CDLOD, Render-LODs, Collider und Navmeshes sind abgeleitete Indizes oder
Projektionen. Diese Grenze hält Edits, Persistenz, Worker-Determinismus und
Mass/COM/Inertia nachvollziehbar.

## 2. Methode und Aussageklassen

[Inference] Aussagen tragen eine der folgenden Klassen. Tabellenzellen erben
die Klasse ihrer Zeile oder der expliziten Klassen-Spalte.

| Klasse | Bedeutung |
| --- | --- |
| `README Claim` | Aussage aus README, Website oder Projektdokumentation; nicht selbst bewiesen. |
| `Code Evidence` | Im gepinnten Source-Stand vorhandene Implementierung, Datenstruktur oder Buildkonfiguration. |
| `Test Evidence` | Vorhandener oder ausgeführter Test. `vorhanden, nicht ausgeführt` ist kein PASS. |
| `Benchmark Evidence` | Reproduzierbare oder veröffentlichte Messung mit genanntem Kontext. Alte Fremdmessungen werden nicht auf Hestia übertragen. |
| `Observed Demo Evidence` | In einem echten Browser in diesem Audit sichtbar nachvollzogen; beweist keine interne Architektur. |
| `Inference` | Abgeleitete Bewertung, Empfehlung oder noch zu beweisende Hypothese. |

[Code Evidence] Alle Git-Projekte wurden flach in
`C:\tmp\voxel-audit-external-20260713` geklont. Keine externe Datei wurde nach
Weltraum-Spiel kopiert. [Code Evidence] Vor Builds wurden vorhandene
`package.json`, Unity-/CMake-/SCons-Manifeste, Lifecycle-Skripte und
`build.rs`-Vorkommen geprüft. [Inference] Es wurde bewusst kein Build und keine
Installation gestartet: Der Auftrag ist Dokumentation, mehrere Projekte sind
Unity-/Desktop-Anwendungen, und die Ergebnisse brauchen keine Ausführung
unbekannter Lifecycle-Skripte.

[Observed Demo Evidence] Browser-Captures liegen ausschließlich temporär unter
`C:\tmp\voxel-audit-browser-20260713`; kein Capture wird committed.

## 3. Gepinnte Quellen und Lizenzen

### 3.1 Repositories

| Projekt | Commit, Datum, Branch/Tag | Lizenz und exakter Pfad | Untersuchte Pfade (Auswahl) |
| --- | --- | --- | --- |
| [Code Evidence] [Zylann/godot_voxel](https://github.com/Zylann/godot_voxel) | `889202e670db593d22b5f4a49cf8c69ba46bda8e`, 2026-07-02, `master`, kein HEAD-Tag | MIT, `LICENSE.md`; zusätzlicher Hinweis in `meshers/transvoxel/transvoxel_tables.cpp` | `storage/voxel_buffer.*`, `storage/voxel_data.*`, `storage/mixel4.h`, `generators/**`, `streams/**`, `meshers/{transvoxel,blocky,cubes}/**`, `terrain/**`, `edition/**`, `engine/priority_dependency.*`, `tests/voxel/**`, `doc/source/**` |
| [Code Evidence] [Tuntenfisch/Voxels](https://github.com/Tuntenfisch/Voxels) | `761990553668fa9173db4c79d73f1c086d4f8cc0`, 2022-08-20, `release`, kein HEAD-Tag | MIT, `LICENSE` | `Assets/Compute/Voxels/DualContouring.compute`, `Assets/Compute/Include/**`, `Assets/Scripts/Voxels/**`, `Assets/Scripts/World/**`, `Assets/Shaders/Voxels/Voxel.shader`, `Packages/manifest.json` |
| [Code Evidence] [Fobri/Terraxel-Unity](https://github.com/Fobri/Terraxel-Unity) | `24175e81778d46680a6b310f284ac9a8e1ec5b48`, 2023-06-27, `main`, kein HEAD-Tag | README verlinkt MIT; **kein Root-Lizenztext** | `Assets/Scripts/TerrainGeneration/**`, `Assets/Scripts/Managers/**`, `Assets/Scripts/Player/TerrainDeformer.cs`, `Assets/Shaders/{Noise3D,Noise2D}.compute`, `Assets/Resources/Generated/**`, `Packages/**` |
| [Code Evidence] [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | `d6b69a107ab9d3271b861be041d37ce6c3811ca8`, 2026-07-10, `master`, kein HEAD-Tag | MIT, `LICENSE` | `API.md`, `WEBGPU_API.md`, `src/core/**`, `src/workers/**`, `src/webgpu/**`, `example/sculpt.js`, `test/**`, `benchmark/run-benchmark.js`, `package.json` |
| [Code Evidence] [zeux/meshoptimizer](https://github.com/zeux/meshoptimizer) | `441ff309c04559e7438234aa7b5424755b0c7ed6`, 2026-07-11, `master`, kein HEAD-Tag | MIT, `LICENSE.md` | `src/meshoptimizer.h`, `src/simplifier.cpp`, optimizer/codecs, `js/**`, `demo/tests.cpp`, `tools/{codecbench,codecfuzz}.cpp`, `CMakeLists.txt` |
| [Code Evidence] [Auburn/FastNoiseLite](https://github.com/Auburn/FastNoiseLite) | `785f37a9ad76e283586a379675085f2063ae03f7`, 2026-06-21, `master`, kein HEAD-Tag | MIT, `LICENSE` | `JavaScript/src/FastNoiseLite.ts`, `JavaScript/test/**`, `Cpp/**`, `CSharp/**`, `HLSL/**`, `GLSL/**`, `Rust/Cargo.toml`, `WebPreviewApp/**` |
| [Code Evidence] [guillaumechereau/goxel](https://github.com/guillaumechereau/goxel) | `c84ad6dc6dbff474ba2ac04af84a727278d9927e`, 2026-04-30, `master`, kein HEAD-Tag | GPL-3.0-or-later, `COPYING` und Source-Header | `INTERNALS.md`, `src/{volume,image,action,file_format,tests}.c`, `src/tools/**`, `src/formats/gltf.c`, `SConstruct`, `Makefile` |
| [Code Evidence] [JannisX11/blockbench](https://github.com/JannisX11/blockbench) | `8fe8d9d9568de8233d77cd592744acad495d46b0`, 2026-04-25, `master`, Tag `v5.1.4` | GPL-3.0-or-later, `LICENSE.MD`; als externes Tool getrennt von Source-Reuse bewerten | `js/outliner/types/cube.js`, `js/formats/standards/gltf.js`, `js/lib/GLTFExporter.js`, `js/formats/bbmodel.js`, `js/plugin_loader.ts`, `package.json`, `package-lock.json` |
| [Code Evidence] [ephtracy/ephtracy.github.io](https://github.com/ephtracy/ephtracy.github.io) (offizielle MagicaVoxel-Site) | `2f37e6b28f23edde7386504b880f9df873294fae`, 2026-04-27, `master`, kein HEAD-Tag | Nutzungsbedingungen in `mv_main.html`; kein Open-Source-Lizenzfile | `mv_main.html`, `mv_vox_format.html`, `mv_controls.html`, `mv_commands.html`, `index.html` |
| [Code Evidence] [vanruesc/rabbit-hole](https://github.com/vanruesc/rabbit-hole) | `9e8f1a30577f92e976711d81ee6bd3bd9206b34b`, 2021-05-02, `main`, kein HEAD-Tag | zlib, `LICENSE.md` | `src/core/Terrain.js`, `src/clipmap/**`, `src/octree/**`, `src/isosurface/dual-contouring/**`, `src/math/QEF*`, `src/worker/**`, `src/volume/**`, `test/**`, `package.json` |
| [Code Evidence] [EricLengyel/Transvoxel](https://github.com/EricLengyel/Transvoxel) | `51a494f03c5b024cd153b596bcc7152eb3cc93a6`, 2023-11-01, `main`, kein HEAD-Tag | MIT, `LICENSE` | `Transvoxel.cpp`, `README.md`, `LICENSE` |
| [Code Evidence] [KhronosGroup/glTF](https://github.com/KhronosGroup/glTF) | `5ec16c42e5ed044f26ce2a5b741ed5c57cf622f3`, 2026-07-03, `main`, kein HEAD-Tag | gemischt; `LICENSE.adoc`, `COPYING.adoc`, `LICENSES/**` | `specification/2.0/Specification.adoc`, `specification/2.0/schema/{extras,node,mesh,material}.schema.json`, `extensions/**` |
| [Code Evidence] [Blender](https://projects.blender.org/blender/blender) | `8ebfcce398ffdd1a9f3ee0544cb5b66eec55d32f`, 2026-07-13, `main`, kein HEAD-Tag | GPL, `COPYING`; Drittanbieter separat | `source/blender/nodes/geometry/**`, `scripts/addons_core/io_scene_gltf2/**`, insbesondere `blender/com/extras.py` und `blender/exp/nodes.py` |

[Code Evidence] Das verlangte „rabbit-hole Repository“ ist damit exakt als
`https://github.com/vanruesc/rabbit-hole` verifiziert. Der Eintrag wird nicht
stillschweigend entfernt; wegen Alter, `0.0.0`, engem `three`-Peerbereich und
eigener README-Warnung wird er nur als Konzeptquelle geführt.

### 3.2 Papers, Artikel und Spezifikationen

| Quelle | Evidenz und Grenze |
| --- | --- |
| [README Claim] [Dual Contouring of Hermite Data, Ju et al., SIGGRAPH 2002](https://people.eecs.berkeley.edu/~jrs/meshpapers/JuLosassoSchaeferWarren.pdf) | Signierter Octree, Hermite-Schnittpunkte/-Normalen und QEF; Paper zeigt scharfe Features und destruktive Modifikation. Paper-Copyright ist keine Source-Lizenz. |
| [README Claim] [Transvoxel-Übersicht](https://transvoxel.org/) und [Dissertation](https://transvoxel.org/Lengyel-VoxelTerrain.pdf) | Transition Cells verbinden exakt 2:1 aufgelöste Volumenmeshes; Dissertation 2010, PDF laut eigener Schlussseite im April 2025 aktualisiert, CC BY-ND 3.0. Tabellenrepository separat MIT. |
| [Benchmark Evidence] [0 FPS: Meshing in a Minecraft Game](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/), [Teil 2](https://0fps.net/2012/07/07/meshing-minecraft-part-2/) | Erklärt und misst Naive/Culling/Greedy/Monotone in damaligem JavaScript. Werte sind historisch und keine Hestia-Budgetwerte. |
| [Benchmark Evidence] [0 FPS: Smooth Voxel Terrain Part 2](https://0fps.net/2012/07/12/smooth-voxel-terrain-part-2/) | Vergleicht Marching Cubes, Marching Tetrahedra und naive Surface Nets auf einem `65^3`-Versuch; Surface Nets erzeugt dort weniger Facetten. Der Artikel implementiert Dual Contouring ausdrücklich nicht. |
| [Benchmark Evidence] [Geometry Clipmaps, Losasso/Hoppe 2004](https://hhoppe.com/proj/geomclipmap/) | Nested regular grids, inkrementell nachgeladene Heightmap-Pyramide; publizierte 60-fps-Demo auf historischer Hardware. Nur 2.5D Heightfields. |
| [README Claim] [CDLOD, Strugar 2009](https://doi.org/10.1080/2151237X.2009.10129287) | Quadtree regulärer Heightmap-Grids, 3D-Distanz-LOD und Vertex-Geomorphing ohne Stitch-Mesh. Nur 2.5D Heightfields; Originalcode wurde nicht gebaut. |
| [Code Evidence] [Khronos glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) | Rechts-händig, Meter, `+Y` up, `+Z` forward; `extras` sind application-specific, sollten für Portabilität JSON-Objekte sein. `extras` haben kein standardisiertes Hestia-Schema. |
| [README Claim] [Blender glTF Manual](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html) | Custom Properties können als glTF `extras` exportiert werden. [Code Evidence] Der gepinnte Exporter filtert Blacklist-Properties und serialisiert JSON-kompatible Custom Properties in `extras.py`. |

## 4. Ausführungs-, Test- und Browserstatus

| Projekt | Buildstatus | Teststatus | Demostatus | Browserstatus | Bekannte Einschränkung |
| --- | --- | --- | --- | --- | --- |
| godot_voxel | [Inference] NOT RUN; SCons/SCsub gelesen | [Test Evidence] Tests vorhanden, NOT RUN; benötigen `voxel_tests=yes`/`--run_voxel_tests` | [README Claim] externe Demo verlinkt, NOT RUN | [Inference] kein geprüfter Browserdemo | Godot/C++; Web-Build-Caveats; Transvoxel-Testabdeckung schmal |
| Voxels | [Inference] NOT RUN; Unity 2021.1.16f1, Manifest/LFS gelesen | [Test Evidence] keine First-Party-Suite gefunden | [README Claim] Scene/Video vorhanden, NOT RUN | [Inference] N/A | Full-chunk Remesh, GPU-Readback, keine Persistenz, Geometry Shader |
| Terraxel | [Inference] NOT RUN; Manifest gelesen, `ProjectSettings/` fehlt | [Test Evidence] keine Suite gefunden | [README Claim] Scene/Video vorhanden, NOT RUN | [Inference] N/A | 2D/3D-Transition-TODO, Edits nicht far-field-/save-stabil, Lizenztext fehlt |
| three-mesh-bvh | [Inference] NOT RUN; npm-Skripte/Installflags gelesen | [Test Evidence] umfangreiche Tests vorhanden, NOT RUN | [Observed Demo Evidence] Sculpt-Demo geladen; BVH-Helper sichtbar umgeschaltet | [Observed Demo Evidence] Kernrequests 200; nur `/favicon.ico` 404 | Refit degradiert nach großen Deformationen; ParallelWorker braucht COOP/COEP |
| meshoptimizer | [Inference] NOT RUN; CMake/JS-Skripte gelesen | [Test Evidence] C++/JS/Fuzz-Tests vorhanden, NOT RUN | [Code Evidence] lokales `demo/simplify.html`, NOT RUN | [Inference] keine kanonische öffentliche Demo geprüft | Vereinfachung kann an vielen Seams stoppen; falsche Locks erzeugen Risse |
| FastNoiseLite | [Inference] NOT RUN; JS/Rust/CMake gelesen, kein `build.rs` | [Test Evidence] JS-Goldenwerte vorhanden, NOT RUN | [Observed Demo Evidence] offizielle WASM-GUI sichtbar geladen | [Observed Demo Evidence] Seite 200; Console meldete Main-loop-timing-Fehler und Favicon 404 | Keine Cross-Language-Bitparität bewiesen |
| Goxel | [Inference] NOT RUN; SCons/Make gelesen | [Test Evidence] schmale Importtests vorhanden, NOT RUN | [Inference] Desktop-App NOT RUN | [Inference] kein Browserziel | GPL, native Editorarchitektur, GLTF- aber kein belegter GLB-Pfad |
| Blockbench | [Inference] NOT RUN; riskante Publish-/Install-Skripte gelesen | [Test Evidence] keine Produkttestsuite gefunden | [Observed Demo Evidence] Web-App 5.1.4; lokales Generic-Model-Projekt erstellt | [Observed Demo Evidence] keine Console-Warnung/-Fehler; App/Assets 200; Telemetrie-POST 200 | Semantische `extras` brauchen Plugin/Postprocess; GPL für Source-Reuse |
| MagicaVoxel | [Inference] closed-source Editor, Build N/A | [Test Evidence] keine Suite verfügbar | [README Claim] Feature-Videos; Editor NOT RUN | [Observed Demo Evidence] Produktseite zeigt 0.99.7.2; Site-Assets 200; Patreon-Widget warf Console-Fehler | Software darf nicht weiterverkauft/gebündelt werden; Seite ist kein Editornachweis |
| rabbit-hole | [Inference] NOT RUN; npm-Skripte gelesen, kein pre/postinstall | [Test Evidence] AVA-Tests vorhanden, NOT RUN | [Observed Demo Evidence] Torus konturiert: 1734 Vertices/3912 Faces | [Observed Demo Evidence] alle Demoassets 200; nur Favicon 404 | README nennt Projekt unvollständig; alte `three`-Peergrenze; `0.0.0` |
| Transvoxel tables | [Inference] Build N/A | [Test Evidence] keine Tests im Tabellenrepo | [Inference] N/A | [Inference] N/A | Daten lösen nur 2:1-Seams eines kompatiblen Regular-Meshers |
| glTF spec | [Inference] Spec-Build N/A | [Inference] Validierungstools nicht ausgeführt | [Inference] N/A | [Inference] Registry gelesen, keine Demo | `extras` sind absichtlich unstandardisiert; eigenes Schema nötig |
| Blender / Geometry Nodes | [Inference] NOT RUN; blobloser Source-Audit | [Test Evidence] Upstream-Suite nicht ausgeführt | [Inference] Desktop-Editor NOT RUN | [Inference] N/A | GPL bei Source-Einbettung; Export muss gebaked/validiert werden |

## 5. Projektbewertung

[Inference] Skala 1 (schwach) bis 5 (stark). Bei `Integration Cost` bedeutet 1
niedrige und 5 hohe Kosten. Der Score ersetzt nicht die textlichen Risiken.

| Projekt | Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity | Main Risks | Urteil |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| godot_voxel | 4 | 4 | 1 | 4 | 3 | 3 | 4 | 5 | 4 | Godot-Port, Collider-Hauptthread, kein Struktur-/Massvertrag | **Study and extract concepts** |
| Voxels | 4 | 2 | 1 | 2 | 1 | 1 | 5 | 5 | GPU-Readback, Geometry Shader, keine Persistenz/Tests | **Study and extract concepts** |
| Terraxel | 4 | 3 | 1 | 2 | 1 | 1 | 1 | 5 | fehlender Lizenztext, 2D/3D-Gaps, unsafe/Unity, verlorene Edits | **Study and extract concepts** |
| three-mesh-bvh | 4 | 4 | 5 | 3 | 5 | 3 | 5 | 2 | 4 | Refit-Qualität, Indexmutation, COOP/COEP | **Prototype behind adapter** |
| meshoptimizer | 4 | 4 | 5 | 4 | 5 | 4 | 5 | 2 | 5 | Seam-/Material-Locks, Quantisierung, mutierte Reihenfolgen | **Prototype behind adapter** |
| FastNoiseLite | 4 | 4 | 5 | 3 | 3 | 3 | 5 | 2 | 4 | Float-/Portabweichungen, keine gemeinsame Golden-Suite | **Prototype behind adapter** |
| Goxel | 3 | 2 | 1 | 2 | 2 | 1 | 1 | 5 | GPL, native Kopplung, schmale Tests | **Study and extract concepts** |
| Blockbench | 4 | 3 | 5 | 2 | 1 | 1 | 4 als Tool / 1 Reuse | 2 | 5 | unstandardisierte Metadaten, Plugins, GPL Source | **Adopt as external tool** |
| MagicaVoxel | 3 | 2 | 1 | 2 | 1 | 1 | 3 als Tool / 1 Reuse | 2 | 4 | closed source, Software-Redistribution untersagt | **Adopt as external tool** |
| rabbit-hole | 3 | 3 | 4 | 2 | 3 | 2 | 5 | 4 | unvollständig, alter Stack, schwache Maturity | **Study and extract concepts** |
| Transvoxel tables | 4 | 3 | 5 | 5 | 1 | 2 | 5 | 3 | 4 | nur Tabellen, Algorithmus- und Seamvertrag bleibt Eigenarbeit | **Isolated code reuse candidate** |
| Blender | 5 | 4 | 1 | 3 | 4 | 3 | 5 als Tool / 1 Reuse | 2 | 5 | Exportvarianten, Modifiers/Instances müssen gebaked werden | **Adopt as external tool** |
| Geometry Nodes | 4 | 4 | 1 | 3 | 3 | 2 | 5 als Tool / 1 Reuse | 2 | 4 | prozedurales Authoring ist nicht kanonische Runtime-Wahrheit | **Adopt as external tool** |

### 5.1 Entscheidende Source-Befunde

- [Code Evidence] `godot_voxel` trennt `VoxelGenerator`, `VoxelStream`,
  `VoxelData`, `VoxelMesher` und Terrain-Wiring. `VoxelBuffer` hat acht feste
  Channels, uniforme Blockkompression und einen Mixel4-Pfad mit bis zu vier
  aktiven Materialien pro Zelle. Diese Trennung ist das stärkste Architekturvorbild.
- [Code Evidence] `godot_voxel` hat keinen einzelnen „EditBuffer“-Typ. Der
  praktische Bulk-Edit ist `VoxelTool.copy()` -> lokaler `VoxelBuffer` ->
  `paste()`. Fixed-LOD remesht eine gepaddete Region; Variable-LOD markiert
  betroffene LOD0-Blöcke und LOD-Ancestors.
- [Code Evidence] `godot_voxel` erzeugt Regular- plus sechs Transition-Surfaces,
  hat blockige, cubes/greedy und SDF/Transvoxel-Modi, SQLite-/Region-Streams,
  Instancing, Collision-Projektion und viewer-/LOD-basierte Taskpriorität. Save-
  Tasks bilden eine eigene, nicht distanzverwerfbare Klasse.
- [Code Evidence] `Tuntenfisch/Voxels` verwendet in
  `CalculateCellVertex` einen iterativen Schmitz-Partikel-Solver statt QEF. Die
  LOD-Strategie hält den äußeren Zellring hochaufgelöst, nicht Transvoxel.
  Multi-Material wählt einen Materialindex pro Zellvertex; der Geometry Shader
  mischt die drei Dreiecksvertex-Materialien.
- [Code Evidence] `Voxels` kompiliert einen Density-Graph in eine GPU-seitige
  lineare Auswertung und führt CSG-Destruction aus, remesht aber jeweils den
  ganzen Chunk und verliert Edits beim Chunk-Recycling.
- [Code Evidence] `Terraxel` nutzt Regular-/Transition-Tabellen, `sbyte` Density,
  fixed-point-artige Kanteninterpolation, ein Distanz-Octree, GPU-Noise und
  CPU/Burst-Meshing. Der 2D-Far-Field ist ein neu erzeugtes Heightfield, kennt
  Höhlen/3D-Edits nicht; `TODO: Fix 2d 3d transition gaps` bleibt im Source.
- [Code Evidence] `three-mesh-bvh` deckt Raycast, `shapecast`, Sculpting-Refit,
  Worker- und WebGPU-Pfade ab. Ein Refit ist nur für lokale Deformationen
  geeignet; nach großen Änderungen ist ein Rebuild erforderlich.
- [Code Evidence] `meshoptimizer` trennt Cache-/Overdraw-/Fetch-Reordering,
  Simplification und Codecs. `meshopt_SimplifyLockBorder`, explizite Locks und
  attributbewusste Vereinfachung sind Pflicht an Chunk-, UV- und Materialseams.
- [Code Evidence] FastNoiseLite hat parallele Ports für JS/TS, C++, C#, Rust,
  HLSL und GLSL sowie Domain Warping. Gleicher Seed ist ein semantischer, aber
  kein bitidentischer Cross-Language-Vertrag.
- [Code Evidence] Goxel zeigt `16^3` Copy-on-Write-Tiles, Layers, günstige
  Undo-Snapshots, Painter-Operationen und Formatadapter. Das sind Editorideen,
  keine Runtime-Übernahme.
- [Code Evidence] Blockbench modelliert Cuboids direkt und exportiert glTF/GLB.
  Der enthaltene GLTFExporter kann JSON-fähiges `Object3D.userData` als
  `extras` serialisieren; der Standardpfad befüllt Hestia-Semantik aber nicht.
- [Code Evidence] Blender exportiert JSON-kompatible Custom Properties nach
  Blacklist-Filterung als glTF `extras`. Geometry Nodes kann prozedurale
  Assetfamilien erzeugen; der Compiler muss die evaluierte Geometrie, Instanzen,
  Modifier und Metadaten anschließend normalisieren.
- [Code Evidence] rabbit-hole besitzt Dual Contouring mit QEF, Sparse Voxel
  Octree, Clipmap-Shells, CSG, Web Worker und Save/Load von serialisierten
  SDF-Operationen. [Observed Demo Evidence] Der Browserdemo konturierte einen
  Torus, beweist aber weder LOD-Seams noch Persistenz oder Performance.

### 5.2 Angeforderte Subsystemabdeckung

| Projekt / Thema | Befund |
| --- | --- |
| godot_voxel: Voxel Data | [Code Evidence] `VoxelData` hält Blockspeicher, Generator-/Streambezug und LOD-Operationen getrennt; LOD0 ist die primäre Editbasis, höhere LODs sind abgeleitet. |
| godot_voxel: Voxel Channels | [Code Evidence] `VoxelBuffer` definiert acht Kanäle (`TYPE`, `SDF`, `COLOR`, `INDICES`, `WEIGHTS`, `DATA5..7`) mit 8/16/32/64-Bit-Tiefen und Uniform-Kompression. |
| godot_voxel: SDF und Material Channels | [Code Evidence] SDF liegt als normalisiertes `int8`/`int16` oder `float32` vor; `INDICES`/`WEIGHTS` und Mixel4 repräsentieren bis zu vier aktive Texturen je Zelle aus einer Palette von 16. |
| godot_voxel: Generator / Streamer / Mesher | [Code Evidence] `VoxelGenerator`, `VoxelStream` und `VoxelMesher` sind getrennte, thread-sichere Extension Points; Mesher liefern reguläre, bis zu sechs Transition- und optionale Collision-Surfaces. |
| godot_voxel: Edit Buffer | [Code Evidence] Es gibt keinen gleichnamigen zentralen Typ; Bulk-Edits laufen über lokalen `VoxelBuffer` mit `VoxelTool.copy()`/`paste()`, danach werden gepaddete Fixed-LOD- beziehungsweise LOD-Ancestor-Regionen dirty. |
| godot_voxel: Transvoxel / blockig / glatt | [Code Evidence] Smooth Terrain nutzt SDF und Regular-/Transition-Cells; Blocky erzeugt Modellflächen, der Cubes-Mesher hat Greedy-Merging. Transvoxel-LOD-Seams besitzen zusätzlich Shader-/Border-Korrekturen. |
| godot_voxel: Collision / Decoration | [Code Evidence] Collision wird mesher-/viewerabhängig projiziert; `VoxelInstancer`, `VoxelInstanceGenerator` und `VoxelInstanceLibrary` decken dekorative MultiMesh-/Scene-Instanzen mit Distanz- und LOD-Verhalten ab. |
| godot_voxel: Persistence / Job Priority | [Code Evidence] Memory-, Region- und SQLite-Streams sowie serializer-versionierte Blockdaten sind vorhanden. Viewer, Distanz, LOD und Jobtyp beeinflussen Priorität; Save-Jobs dürfen nicht wie entfernte Renderjobs fallen gelassen werden. |
| Voxels: GPU Dual Contouring | [Code Evidence] Compute Shader erzeugen aktive Zellen, Zellvertices und Indizes auf der GPU; die CPU liest Meshdaten für Unity-Mesh/Collider zurück. |
| Voxels: Partikel statt QEF / Sharp Features | [Code Evidence] `CalculateCellVertex` iteriert einen Schmitz-Partikelpunkt statt eine QEF zu lösen. Eine Winkelgrenze beeinflusst Normalen; eine robuste scharfe Geometriekante ist weder Test- noch Demo-belegt. |
| Voxels: Multi-Material / LOD Seams | [Code Evidence] Ein Zellvertex trägt einen Materialindex, der Geometry Shader mischt Dreiecksmaterialien. LOD-Seams halten einen äußeren Zellring hochaufgelöst; es gibt keine Transvoxel-Transition-Topologie. |
| Voxels: graphbasierte Density / Destruction | [Code Evidence] Ein Graph wird in eine lineare GPU-Auswertung übersetzt. CSG-Edits ändern die Chunk-Density, erzwingen aber Full-Chunk-Remesh und werden beim Chunk-Recycling nicht persistiert. |
| Voxels: HLSL -> WGSL/TSL | [Inference] Kern-Compute ist übertragbar, aber Atomics/Bufferlayouts müssen explizit werden, Geometry Shader muss durch Compute/Vertex-/Materialpfade ersetzt werden und GPU-Readback ist neu zu budgetieren. WGSL ist der direkte Zielvertrag; TSL bleibt ein Adapterexperiment. |
| Terraxel: Near Field / Transvoxel | [Code Evidence] Nahbereich ist volumetrisches Regular-/Transition-Cell-Meshing mit `sbyte`-Density und Burst-Jobs. |
| Terraxel: Octree / 2.5D Far Field | [Code Evidence] Ein Distanz-Octree selektiert volumetrische Near-Chunks; das Far Field ist ein separat erzeugtes Heightfield und kann Höhlen oder lokale 3D-Edits nicht abbilden. |
| Terraxel: Collider Baking / GPU Noise | [Code Evidence] Der Hauptmeshpfad backt/ersetzt MeshCollider; 2D-/3D-Noise entsteht per Compute Shader und Readback, Meshing bleibt CPU/Burst. |
| Terraxel: volumetrisch -> nicht volumetrisch | [Code Evidence] Der Übergang ist kein informationsbewahrender LOD desselben Datensatzes; ein Source-TODO benennt verbleibende 2D-/3D-Lücken. |

## 6. Meshing Decision Matrix

[Inference] `++` sehr geeignet, `+` geeignet, `0` bedingt, `-` schwach,
`--` ungeeignet. `Triangles` ist relativ und inputabhängig; keine Zelle ist ein
Hestia-Benchmark.

| Verfahren | Triangle Count | Sharp Features | Organic Surfaces | Multiple Materials | Chunk Boundaries | LOD Transitions | Incremental Remesh | Worker Suitability | WASM Suitability | WebGPU Suitability | Determinism | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Greedy Meshing | [Inference] sehr niedrig auf koplanaren Blockflächen; schlecht bei Rauschen | ++ achsenparallel, - freie Schnitte | -- | +, Merge-Key muss Material/Normal/AO enthalten | + mit Ghost-Layer und deterministischer Face-Ownership | -; Skirts/locked borders separat | ++, lokaler Slice-/Brick-Rebuild | ++ | ++ | + Compute möglich, aber CPU oft einfacher | ++ bei kanonischer Scan-/Merge-Reihenfolge | niedrig-mittel |
| Marching Cubes | [Inference] mittel-hoch; 0 FPS erzeugte in seinen Fällen etwa doppelt so viele Facetten wie Surface Nets | - ohne Extended-/Feature-Verfahren | ++ | 0; Vertex-/Cell-Materialpolicy nötig | + bei identischen Samples/Ambiguity-Regeln | + mit Transvoxel, sonst - | ++ pro Dirty Brick plus 1-Sample-Apron | ++ | ++ | ++ table-/compute-freundlich | + bei fixed tables/interpolation | mittel |
| Surface Nets, centroid | [Benchmark Evidence] in den 0-FPS-Fällen deutlich weniger Facetten als MC | -/0, Kanten werden gerundet | ++ | 0/+ | + bei geteilter Vertexregel | - ohne eigene Transitionstopologie | ++ | ++ | ++ | ++ | + bei fester Edge-Reihenfolge | mittel; Non-Manifold-Fälle beachten |
| Dual Contouring mit QEF | [Inference] häufig niedrig, da ein Vertex pro aktiver Zelle | ++ mit guten Hermite-Daten | + | 0/+ | 0; QEF/clamp/ownership müssen exakt übereinstimmen | -; Standard-Transvoxel passt nicht automatisch | +; Hermite/QEF lokal, Topologie komplex | + | +, robuster Solver nötig | 0/+; SVD/QEF auf GPU komplex | 0/+; Floatsolver braucht kanonische Regeln | hoch |
| Dual: Edge-Centroid / Mass Point | [Inference] wie duale Topologie | 0; stabiler als freie QEF-Ausreißer, aber weich | ++ | 0/+ | + bei fester Summenreihenfolge | - | ++ | ++ | ++ | ++ | +, besonders mit fixed point | mittel |
| Dual: Schmitz-Partikel | [Inference] wie duale Topologie | + laut Geometriehypothese, aber im Audit ungetestet | + | 0/+ | 0/+; feste Iterationen nötig | 0; High-res Border möglich | + | + | + | ++ | 0; GPU-Float-Crossdevice unbewiesen | mittel-hoch |
| Dual: constrained/clamped QEF + centroid fallback | [Inference] wie Dual Contouring | ++, verhindert viele Zell-Ausreißer | + | 0/+ | + wenn Clamp/Fallback kanonisch | - ohne spezielle Transitionstopologie | + | + | + | 0/+ | + bei fixed solver/fester Fallfolge | hoch, aber bester Qualitätskandidat für freie Bruchflächen |
| Transvoxel | [Inference] Regular MC plus zusätzliche Transition-Triangles | -/0; für glattes Terrain ausgelegt | ++ | 0/+ mit eigener Materialinterpolation | ++ für exakt 2:1 und kompatible Samples | ++, Kernzweck | +; Transition Faces mit dirty markieren | ++ | ++ | ++ tables/compute | ++ bei festen Tables/Samples | mittel-hoch; viele Randfälle |
| Uniformes Grid im Brick | [Inference] keine eigene Meshzahl; Datenstruktur | ++/-- abhängig vom Mesher | ++ | ++ Kanäle | ++ mit Apron | + mit Mips/Transitions | ++ | ++ | ++ | ++ | ++ | niedrig; Speicher wird durch Sparse Bricks begrenzt |
| Octree als Primärspeicher | [Inference] adaptive Reduktion möglich | + mit DC | + | + | 0; Nachbarn/Balance komplex | + adaptiv, aber crack-frei schwierig | -; Edit/Split/Merge und Parallelität komplex | 0 | 0/+ | - für unregelmäßige Pointer-/Traversalstruktur | 0; Tree-Rebalancing/Floatfehler | sehr hoch |
| Hybrid Terrain/Building | [Inference] je Domäne optimiert | ++ | ++ | ++ | +, Domänengrenzen als getrennte Meshes | ++ mit Terrain-Transvoxel und authored Building-LODs | ++ bei getrennten Dirty Graphs | ++ | ++ | ++ selektiv | ++ bei kanonischer gemeinsamer Datenbasis | hoch initial, niedrigere Langzeitrisiken |

### 6.1 Algorithmusentscheidung

- [Inference] **Terrain/Höhlen:** Regular-Cell-Meshing plus Transvoxel. Erstes
  Spike darf Marching-Cubes-kompatibel sein; Surface Nets ist der einfache
  Triangle-Count-Vergleich, nicht automatisch die Produktentscheidung.
- [Inference] **Intakte harte Gebäude:** authored GLB-/compiler-erzeugte
  Render-LODs. Nicht jedes unbeschädigte Gebäude zur Laufzeit voxelmeshen.
- [Inference] **Achsengerade Microvoxels und freigelegte Blockflächen:** Greedy
  Meshing mit Material-/Normal-/Damage-Key.
- [Inference] **Freie Bruch-, Schnitt- und Asteroidenflächen:** gekapseltes Dual
  Contouring mit constrained/clamped QEF und Edge-Centroid-Fallback. Der
  Schmitz-Partikel-Solver ist ein Spike-Kandidat, kein voreiliger Standard.
- [Inference] **Octree:** Spatial-/LOD-Index, nicht mutable Datenwahrheit.

## 7. Terrain-vs-Building-Strategie

### 7.1 Kanonische Datenrepräsentation

[Inference] Hestia sollte nicht zwischen einem einzigen universellen Mesher und
zwei inkompatiblen Welten wählen. Die gemeinsame Wahrheit ist ein
**versionierter, gehashter Satz spärlich allokierter uniformer Bricks**. Darauf
liegen zwei Domänen mit verschiedenen Renderprojektionen:

1. **Terrain-Domäne:** signiertes Distanzfeld für organisches Terrain, Höhlen,
   Tunnel und freie Bruchflächen. Nahe Bricks werden volumetrisch gemesht;
   abgeleitete Mips treiben Transvoxel-Übergänge.
2. **Structure-Domäne:** semantische Volumen plus Structural-Assembly-Graph für
   Material, Bauteil, Verbindung und Tragwirkung. Solange ein Bauteil intakt
   ist, bleibt sein authored GLB-/Compiler-LOD die bevorzugte Renderquelle.
   Erst beschädigte Bereiche werden lokal als Greedy- oder Dual-Contour-Mesh
   projiziert.

[Inference] Ein Sparse Voxel Octree darf Sichtbarkeit, Streaming oder räumliche
Suche beschleunigen, ist aber nicht die mutable Wahrheit. Uniforme Bricks haben
stabile Schlüssel, einfache Aprons, vorhersehbare Worker-Jobs und direkte
GPU-/WASM-Layouts. Ein 2.5D-Heightfield ist ausschließlich eine entfernte,
neu erzeugbare Terrain-Projektion; Höhlen, Überhänge und Edits bleiben in den
volumetrischen Bricks.

[README Claim] [Real-Scale World Architecture](../architecture/real-scale-world-architecture.md)
und [Surface Local Frame Architecture](../architecture/surface-local-frame-architecture.md)
verlangen durable absolute Weltzustände und explizite `SurfaceLocalFrame`-/
lokale Physics-Projektionen.
[Inference] Brick-Schlüssel und persistente Editkoordinaten werden deshalb an
einen expliziten Frame-Descriptor gebunden; Unity-Transforms und Floating-
Origin-Offsets dürfen weder Brick-Identität noch Inhalts-Hash verändern.

### 7.2 Empfohlene Auflösungshierarchie

- [Inference] **Makro:** Welt-/Region-Index und Persistenzjournal referenzieren
  Brick-Schlüssel; sie enthalten keine Rendertriangles.
- [Inference] **Meso:** Basisbricks enthalten kanonische Kanäle und eine
  ein Sample breite Ghost-/Apron-Schicht beim Meshing. Eine konkrete
  Brick-Kantenlänge wird erst durch Messungen festgelegt.
- [Inference] **Mikro:** Kleine Voxel sind lokal aktivierbare Detailbricks,
  keine globale Weltauflösung. Unterhalb der Thin-Feature-Grenze bleiben
  Stäbe, Kabel und Bleche analytische oder authored Bauteile.
- [Inference] **Far Field:** clipmap-/CDLOD-artige Heightfield-Ringe dürfen aus
  der volumetrischen Wahrheit gebacken werden. [Code Evidence] Terraxels
  2.5D-Pfad zeigt den Kostenvorteil, aber auch den Informationsverlust bei
  Höhlen und persistenten Edits.

## 8. LOD-Seam-Strategien

[Inference] Alle Strategien und Grenzen der folgenden Matrix sind
Architekturentscheidungen, sofern eine Zelle nicht ausdrücklich anders markiert ist.

| Grenze | Strategie | Deterministischer Vertrag | Bekannte Grenze |
| --- | --- | --- | --- |
| Terrain, gleiche LOD | identische Apron-Samples; genau ein Brick besitzt die Grenzfläche | sortierte Brick-Schlüssel, gleiche Quantisierung, gleiche Ambiguity-Tabelle | fehlende Nachbardaten dürfen nicht als Luft persistiert werden |
| Terrain, 2:1 | Transvoxel-Transition-Cells auf der feineren Seite | maximal eine LOD-Stufe pro Nachbar; feste Lookup-Tables und Edge-Interpolation | löst keine beliebigen n:1- oder Dual-Contouring-Seams |
| Terrain, Far Field | Überlappungsannulus plus Geomorph/Crossfade zwischen Volumenrand und Heightfield | Heightfield aus derselben Revision und demselben Downsample-Operator | verdeckt keine semantischen Abweichungen; Höhlen enden vor der Projektion |
| Building, authored LODs | compiler-geprüfte Material-/Silhouetten-Seams und locked border vertices | LOD-Set und meshoptimizer-Optionen im Manifest gehasht | keine Laufzeit-Topologiegarantie nach freiem Bruch |
| Building, beschädigt | lokaler hochaufgelöster Bruchrand; Übergang zum intakten authored Mesh an vorgegebenem Cut Interface | Cut-Interface-ID, Snap-Grid und Vertex-Ownership | benötigt vorbereitete Schnittzonen oder eine robuste CSG-Schnittstelle |
| Vorübergehender Streaming-Fehler | konservativer Skirt oder letztes gültiges Mesh | niemals als kanonische Geometrie speichern | Skirts sind eine visuelle Notmaßnahme, kein Crack-Fix |

[Inference] Density-Mips werden **vorzeichenbewahrend und materialbewusst** aus
der Basisrevision erzeugt. Mittelwertbildung allein kann dünne Wände löschen
oder Höhlen schließen. Für Zellen mit gemischtem Vorzeichen werden konservative
Min-/Max-Informationen oder eine explizite Feature-Belegung mitgeführt. LOD-
Nachbarschaften werden vor Jobfreigabe auf 2:1 balanciert.

## 9. Chunk Data Channels

[Inference] Die folgenden Kanäle und Repräsentationen sind der vorgeschlagene
Datenvertrag; die genannten `godot_voxel`-Parallelen bleiben Code Evidence aus
Abschnitt 5.

| Kanal | Kanonisch? | Vorschlag | Zweck |
| --- | --- | --- | --- |
| `sdf` | ja, Terrain/Bruch | quantisiertes `int16`, definierte Welt-zu-SDF-Skala; optional schmaler Bandbereich | Oberfläche, Höhlen, freie Schnitte |
| `occupancy` / Solid Fraction | ja | `uint8` oder analytische Fraction | blockige Microvoxels, Masse und Downsampling |
| Render Material | ja | kleine lokale Palette plus bis zu vier IDs/Gewichte pro Zelle | Blendoberflächen ohne globale breite IDs |
| Structural Material | ja | stabiler Material-Datensatzschlüssel | Dichte, Festigkeit, Wärmeparameter; nicht mit Renderfarbe verwechseln |
| Assembly / Part / Component | ja | stabile IDs, `0 = none` | Bauteilzuordnung, Verbindungen, persistente Zerstörung |
| Damage / Fracture State | ja | quantisierte Zustandswerte plus Ereignisrevision | lokale Remesh- und Structural-Graph-Invalidierung |
| Provenance | ja | Generator-ID/-Version, Seed, Compiler-Asset-Hash, Base-Revision | Reproduktion und Migration |
| Edit Mask / Edit Revision | ja | Brick-Bitset beziehungsweise monotone Revision | Base-Generation von persistenten Änderungen trennen |
| Feature / Thin Policy | ja, wo nötig | Feature-ID, Repräsentationsklasse und Mindestdicke | verhindert stilles Verschwinden kleiner Bauteile |
| SDF-Gradient/Normal | nein | aus SDF/Apron ableiten und cachen | Meshing, QEF/Hermite-Daten |
| Rendermesh/BVH | nein | revisionierter Cache | Rendering, Raycasts, Sculpting |
| Collider/Nav Tile | nein | separate LOD-Projektionen | Physik und Navigation |
| Heat/Gas/Liquid | später eigener Vertrag | separate sparse Felder mit eigener Tick-/Persistenzrate | D3; nicht vorab in jeden Terrain-Sample packen |

[Inference] Ein Brick-Header enthält Schema-Version, Koordinate, LOD, aktive
Kanäle, Basis-/Editrevision, Inhalts-Hash, Generator-/Compiler-Version und
Nachbarschaftsanforderungen. Aprons werden nicht doppelt persistiert, sondern
aus revisionierten Nachbarn erzeugt. Der Content-Hash umfasst kanonische Bytes,
nicht abgeleitete Meshes.

## 10. Incremental Remesh

[Inference] Empfohlener Ablauf:

```text
Edit-Transaktion
  -> kanonische Brick-Kanäle atomar ändern und Revision erhöhen
  -> betroffene Basisbricks + Apron-Nachbarn markieren
  -> LOD-Ancestors, Transitions, Structural Graph und Mass Accumulator invalidieren
  -> priorisierte Worker-Jobs mit Input-Revision erzeugen
  -> Rendermesh veröffentlichen, falls Revision noch passt
  -> Collider, Navigation, BVH und Far-Field-Projektion getrennt aktualisieren
```

- [Inference] Dirty Bounds werden um den Stencil des Meshers erweitert. Bei
  Dual Contouring gehören Hermite-Daten und alle an der Zellvertexbildung
  beteiligten Nachbarsamples dazu; bei Transvoxel auch die betroffenen sechs
  Transition Faces.
- [Inference] Jobs tragen `(brickKey, channelMask, inputRevision,
  mesherVersion)`. Ergebnisse einer überholten Revision werden verworfen, nicht
  nachträglich über neuere Daten gelegt.
- [Inference] Gleiche Priorität wird durch sortierte Brick-Schlüssel gebrochen.
  Falltabellen, Edge-Reihenfolge, Palette und Summationsreihenfolge sind fest;
  GPU-Floatergebnisse dürfen nicht ungeprüft Persistenz-Hashes bestimmen.
- [Inference] Kleine Edits bauen nur die überlappenden Meshlets/Bricks neu.
  Überschreitet die Dirty-Fraktion einen gemessenen Grenzwert oder ist die BVH
  stark deformiert, folgt ein kompletter Brick-/BVH-Rebuild. [Code Evidence]
  `three-mesh-bvh` unterstützt `refit`, weist aber für weitreichende Änderungen
  auf Rebuild hin.
- [Inference] Persistenz-, Render-, Collision- und Nav-Jobs haben getrennte
  Warteschlangen. Persistenz darf nicht wegen Viewer-Distanz verworfen werden;
  sichtbares Meshing priorisiert Nähe und Frustum.

## 11. Collision/Nav Projection

[Inference] Die folgende Projektionsmatrix ist eine Hestia-Empfehlung.

| Domäne | Collision | Navigation | Aktualisierung |
| --- | --- | --- | --- |
| Nahes Terrain | vereinfachtes watertight Mesh oder deterministische SDF-Abfrage; nicht zwingend Render-LOD | gekachelte begehbare Oberflächenprojektion mit Steigung/Freiraum | Dirty Brick plus Sicherheitsrand; alte sichere Projektion bleibt bis Swap aktiv |
| Höhlen | geschlossene Collider-Projektion mit Decke/Boden; keine 2.5D-Annahme | getrennte Bodeninseln und Portale | nach Topologieänderung Tile/Portal neu prüfen |
| Intaktes Gebäude | authored/Compiler-Compound-Collider pro Structural Component | authored Semantik plus gebackene Nav-Flächen | Assetrevision bestimmt Cache |
| Beschädigtes Gebäude | lokaler Voxel-/Bruch-Collider, später Compound-Fragmente | betroffene Tiles und Verbindungen invalidieren | Render darf früher erscheinen; Physics-Swap nur an Tick-Grenze |
| Far Field | kein detaillierter Collider außerhalb Simulationsradius | grober strategischer Graph, keine Agentenfläche | aus kanonischer Revision neu ableitbar |

[Inference] Rendermesh, Collider und Navigation sind drei Projektionen derselben
Revision, aber keine identischen Meshes. Ein Manifest protokolliert deren
Quellrevision. Bei Verzögerung muss Gameplay einen expliziten Zustand wie
`collisionProjectionPending` sehen; unsichtbare veraltete Collider dürfen nicht
als aktueller Zustand ausgegeben werden.

## 12. Asset-zu-Voxel-Compiler

### 12.1 Bewertete Pipeline

[Inference] Die Pipeline-Stufen und Gates sind die vorgeschlagene
Compilerarchitektur; eingebettete `[Code Evidence]`-Zellen benennen Standards.

| Stufe | Vertrag und Gate |
| --- | --- |
| GLB/glTF | nur unterstützte glTF-2.0-Features; URI, Container und Extension-Set protokollieren |
| Unit/Axis Normalize | [Code Evidence] glTF nutzt Meter sowie rechtshändig `+Y` oben und `+Z` vorwärts; alle Inputs in kanonische Hestia-Achsen/Einheiten transformieren, negative Determinanten explizit behandeln |
| Geometry Validation | finite Werte, Indexbereiche, degenerierte/duplizierte Dreiecke, offene/non-manifold Kanten, Selbstschnitt-Hinweise, Tangenten/UVs, Instanzen und Skin/Morph-Support prüfen |
| Semantic Metadata | namespaced `extras` gegen versioniertes JSON-Schema validieren; unbekannte Pflichtwerte sind Fehler, unbekannte optionale Werte bleiben erhalten |
| Material Mapping | Render-Material auf kleine Brick-Palette; Structural Material separat auf Dichte/Festigkeit/Bruch-/Thermikdaten abbilden |
| Voxelization | konservative Triangle-Coverage plus Inside/Outside-Klassifikation; offene Flächen nur mit expliziter Shell-Policy |
| Thin Feature Policy | Mindestdicke messen; Voxel, analytischer Träger oder DecorativeOnly wählen; Verlust nie still akzeptieren |
| Sparse Bricks | nur belegte/narrow-band Bricks emittieren; kanonische Sortierung, Apron-Anforderungen und Channel-Versionen festhalten |
| Structural Graph | Parts, Verbindungen, Lastpfade, Sollbruchstellen und Parent/Child-Assembly aus Metadaten plus Geometriekontakt erzeugen und validieren |
| Mass/COM/Inertia | Volumen-/Shell-/Part-Dichten integrieren; Ergebnis mit Fehlerbudget und Quellhash speichern |
| Collision LOD | getrennte Compound-/Voxel-/Mesh-Projektion mit Maximalfehler und Feature-Locks |
| Navigation LOD | begehbare Flächen, Freiraum, Portale und semantische Sperren; nicht aus Rendertriangles erraten, wenn Metadaten existieren |
| Render LOD | authored LODs prüfen oder deterministisch vereinfachen; Material-/Chunk-/Cut-Seams sperren |
| Canonical Manifest | Schema, Koordinaten, Repräsentationsmodus, Parts, Kanäle, LODs, Toolversionen, Warnungen und Fehlerbudgets |
| Hashes | Source-GLB, normalisierte Geometrie, Semantik, Materialdaten, jeder Output und kompletter Manifestbaum separat hashen |

[Inference] Der Compiler ist ein offline, reproduzierbares Tool hinter einem
Adapter. Runtime-Import ist kein Ersatz: Validierung, Thin-Feature-Entscheidung,
Structural Graph und Masseneigenschaften müssen vor Auslieferung sichtbar
fehlschlagen können.

[README Claim] Die Repository-Konventionen verwenden im Builder `+X` rechts,
`+Y` oben, `+Z` vorwärts und verlangen frame-explizite Welt-/Surface-Daten.
[Inference] Der Compiler normalisiert GLB daher in dieses lokale Assetframe und
speichert zusätzlich den Frame-Typ; die Platzierung in einem Surface- oder
Body-Frame bleibt eine separate Instanztransformation.

### 12.2 Repräsentationsmodi

[Inference] Die folgende Bewertung definiert die vorgesehenen Compiler-Modi.

| Modus | Fit | Stärken | Hauptrisiko / Gate |
| --- | --- | --- | --- |
| `SolidFill` | Fels, massive Fundamente, Asteroiden | eindeutiges Volumen und Masse | offene Meshes oder Hohlräume werden falsch gefüllt; watertight Gate |
| `Shell` | dünne Verkleidung ohne Innenlagen | erhält Oberfläche bei geringeren Datenkosten | keine plausible Masse ohne Dicke; explizite `thickness` Pflicht |
| `LayeredShell` | Panzerung, Wandaufbau, Hitzeschild | Schichtmaterial und Ablation | Offsets/Selbstüberschneidung; Mindestdicke je Lage prüfen |
| `SemanticVolume` | Terrainblock, Schott, Maschinenkörper | Render- und Strukturmaterial getrennt | Semantikschema und Materialdatenbank müssen versioniert sein |
| `StructuralAssembly` | Gebäude, Station, Fahrzeug | Verbindungen, Teilbruch und Massensumme | Graphpflege; jedes tragende Teil braucht stabile ID und Joint-Vertrag |
| `ModularPart` | austauschbare Technikmodule | Instanzierung, Reparatur und authored Collider | Snap-/Interface-Kompatibilität muss Compiler prüfen |
| `DecorativeOnly` | Kabeldeko, Decals, kleine Props | kein erzwungener Voxelverlust | darf keine Kollision, Last oder Masse vortäuschen |
| `Hybrid` | Hestia-Standard für komplexe Assets | authored Außenwirkung plus selektive Volumen/Assembly-Wahrheit | höchste Authoringkosten; Manifest muss Teilrepräsentationen eindeutig trennen |

[Inference] Standardwahl: `Hybrid` für große zerstörbare Assets,
`StructuralAssembly`/`ModularPart` für harte Technik und `SolidFill` oder
`SemanticVolume` für massive natürliche Körper. Ein Modus ist eine bewusste
Authoringentscheidung, keine automatische Heuristik ohne Diagnose.

### 12.3 glTF `extras` und Node-Metadaten

[Code Evidence] Die Khronos-Schemas erlauben an unter anderem Node, Mesh und
Material ein anwendungsspezifisches JSON-Objekt `extras`. [Code Evidence]
Blenders glTF-Exporter serialisiert JSON-kompatible Custom Properties nach
Filterung; Blockbenchs eingebetteter Three.js-Exporter kann `userData` in
`extras` schreiben. Das ist ein geeigneter **Transportkanal**, aber nicht die
Runtime-Datenwahrheit.

[Inference] Empfohlenes, versioniertes Namespace-Muster:

```json
{
  extras: {
    hestia: {
      schema: asset-semantics/1,
      representation: StructuralAssembly,
      partId: hab/ring/a17,
      structuralMaterial: steel.s42,
      shellThicknessM: 0.018,
      interfaces: [dock.port.a],
      collisionPolicy: compound,
      navigationPolicy: walkable-top
    }
  }
}
```

[Inference] Der Compiler kopiert `extras` nicht blind. Er validiert Typen,
normalisiert IDs, löst Materialschlüssel auf, schreibt Diagnosen und emittiert
eine kanonische Manifestdarstellung. Sicherheits- oder Masseneigenschaften aus
Metadaten gelten erst nach Geometrie- und Plausibilitätsprüfung.

## 13. Thin Feature Policy

1. [Inference] Jedes strukturell, kollisions- oder navigationsrelevante Feature
   muss in seiner feinsten Richtung mindestens **zwei belegte Samples plus
   Rekonstruktionsrand** besitzen. Die konkrete Metergrenze folgt aus der
   Assetklasse und Basisauflösung, nicht aus einer globalen Zahl.
2. [Inference] Dünnere tragende Stäbe, Kabel, Rohre und Platten werden als
   analytische Beam-/Rod-/Shell-Elemente im Structural Graph erhalten und nur
   visuell authored gerendert. Sie werden nicht auf eine zufällige Voxelkette
   gerundet.
3. [Inference] Dünne nichttragende, nichtkollidierende Details werden
   `DecorativeOnly`. Der Compiler protokolliert Anzahl, Bounds und entfallene
   Volumen-/Massenobergrenze.
4. [Inference] `LayeredShell` verlangt pro Lage Material, Dicke und Priorität bei
   Unterauflösung. Lagen dürfen nur mit dokumentierter Mischregel kollabieren.
5. [Inference] Kritische unteraufgelöste Features ohne zulässige Ersatzklasse
   sind Compilerfehler. Warnungen benötigen Asset-ID, Node-Pfad, gemessene
   Dicke, Zielauflösung und vorgeschlagene Abhilfe.

## 14. Authoring Tool Matrix

[Inference] Rollen und Integrationsgrenzen der Matrix sind Empfehlungen;
Lizenzpfade und Source-Fähigkeiten verweisen auf `[Code Evidence]`, sichtbare
Interaktionen auf `[Observed Demo Evidence]`.

| Werkzeug | Rolle | Evidence-basierter Fit | Einschränkung / Lizenz |
| --- | --- | --- | --- |
| Blender | primäre Production-Pipeline und GLB | [Code Evidence] glTF-Exporter und Custom-Property-`extras`; Modelling, LOD, Collider-/Node-Authoring | Blender GPL; exportierte eigene Assets sind nicht dadurch automatisch GPL. Exporteroptionen und Version im Manifest pinnen |
| Blender Geometry Nodes | prozedurale Assetfamilien | [README Claim] [Code Evidence] wiederverwendbare Node-Gruppen und evaluierte Geometrie; gut für Varianten mit stabilen Metadaten | Modifier/Instanzen vor Compile deterministisch evaluieren; Nodegraph ist nicht Runtime-Wahrheit |
| Blockbench | boxige Props und modulare Technikobjekte | [Observed Demo Evidence] Web-App konnte ein Generic Model anlegen; [Code Evidence] Cuboid-/GLB-Pfad und `userData`-Extras vorhanden | GPL-3.0-or-later für das Tool; Hestia-Semantik braucht Plugin/Exporter-Konvention und Validierung |
| MagicaVoxel | Stil, Palette, kleine Referenzassets | [Observed Demo Evidence] offizielle Site nennt Version `0.99.7.2`; eignet sich für Palette/kleine `.vox`-Vorlagen | keine Repository-Lizenz; Site-Bedingungen untersagen Verkauf/Distribution der Software in Paketen. Nur externes Tool, keine Bundlung |
| Goxel | Voxel-Editing-Ideen | [Code Evidence] `16^3`-Tiles, Copy-on-Write, Layer/Undo und Painter-Modell | GPL-3.0-or-later: Konzepte studieren; Source-Reuse in proprietärer Runtime vermeiden beziehungsweise separat juristisch prüfen |

[Inference] Kein Editor bestimmt Grid, Materialkanäle, Structural Graph oder
Persistenzformat. Diese Wahrheit entsteht erst im versionierten Compiler und
seinem Canonical Manifest.

## 15. Destruction Architecture

[Inference] Stufen, Abhängigkeiten und Gates sind die empfohlene
Einführungsreihenfolge.

| Stufe | Umfang | Benötigte kanonische Daten | Gate zur nächsten Stufe |
| --- | --- | --- | --- |
| D0 Terrain Edits | Graben, Bohren, Auf-/Abtrag | SDF/occupancy, Material, Editrevision, Brickjournal | deterministische Replay-/Reload-Golden-Tests und crackfreie Nachbar-/LOD-Remeshes |
| D1 Structures | Bauteilschaden, Schnitt, Trennung | Structural Assembly, Part-/Joint-IDs, Bruchpolicy, Collider/Nav-Projektion | stabile Komponentenbildung, keine verlorenen dünnen Träger, definierte Restmasse |
| D2 City-scale Persistence | viele zerstörte Assets/Regionen | Base-Hash plus kompakte Edit-/Graph-Events, Checkpoints, Schema-Migration | Budget für Savegröße, Streaming, Merge/Conflict und Wiederaufbau |
| D3 Fire/Gas/Liquid/Heat | gekoppelte Felder | eigene sparse Temperatur-, Stoff-, Druck-/Flusskanäle und Materialparameter | konservative Solver, getrennte Tickraten, Persistenz- und Gameplayvertrag |
| D4 Destructible Asteroids | frei bewegte Volumenkörper | lokale Brick-Koordinaten, CSG/Bruch, Component-Split und Collider | D0/D1 plus robuste Inselbildung und räumliche Rebasierung |
| D5 Body Mass Properties | Masse, COM, Inertia je Insel | Dichte, Solid Fraction/Shell-Dicke, lokale Momente, Component-Graph | inkrementelle Ergebnisse gegen Offline-Referenz innerhalb Toleranz |
| D6 Rotation/Orbit Coupling | Impuls, Rotation, Orbit nach Bruch | D5-Tensor, Frame-/Origin-Vertrag, Impuls-/Drehimpulserhaltung | deterministische Simulationsgrenzen und belastbares großes-Koordinaten-Modell |

[Inference] Die Reihenfolge ist eine Abhängigkeitskette, kein Marketing-
Reifegrad. D3 wird nicht durch zusätzliche Bytekanäle „mitgenommen“; D4 bis D6
sind ohne D0/D1-Persistenz und stabile Komponenten-IDs nicht belastbar.

## 16. Mass/COM/Inertia Inputs

[Inference] Die Masseneigenschaften werden aus der kanonischen Material- und
Volumenrepräsentation berechnet, nicht aus dem aktuellen Rendermesh.

Für Element `i` mit Masse `m_i`, Schwerpunkt `r_i` und lokalem Trägheitstensor
`I_i`:

```text
M   = Σ m_i
COM = (Σ m_i r_i) / M
I_COM = Σ [ I_i + m_i ((d_i · d_i) E - d_i d_iᵀ) ], d_i = r_i - COM
```

Erforderliche Eingaben:

- [Inference] Structural-Material-ID und versionierte Dichte; Porosität,
  Füllgrad und Hohlraumanteil getrennt.
- [Inference] Volumenzellen mit Solid Fraction oder genauer Schnittzellen-
  Integration; bloße Center-Belegung liefert ein messbares Fehlerbudget.
- [Inference] Shells mit Fläche, Dicke, Schichtreihenfolge und Flächendichte;
  analytische Beams mit Querschnitt und Länge.
- [Inference] Part-Transformationen in einem kanonischen lokalen Frame,
  Assembly-Hierarchie, Joint-Zustand und getrennte Component-IDs nach Bruch.
- [Inference] Abgetragene/hinzugefügte Delta-Momente pro Dirty Brick:
  `Σm`, `Σmr`, `Σmxx`, `Σmyy`, `Σmzz`, `Σmxy`, `Σmxz`, `Σmyz`. Diese erlauben
  inkrementelle Aktualisierung; periodische Vollintegration begrenzt Drift.
- [Inference] Source-/Material-/Brickrevision, Algorithmusversion,
  Quantisierung und Ergebnis-Hash im Manifest. Negative Eigenwerte, nicht
  symmetrische Tensoren oder Massenverlust außerhalb Toleranz sind Fehler.

## 17. License Risks

[Code Evidence] Die Lizenzlagen und Pfade stammen aus den gepinnten Quellen in
Abschnitt 3. [Inference] Die Integrationsentscheidungen sind technische
Risikobewertungen, keine Rechtsauskunft.

| Quelle | Lizenzlage | Integrationsentscheidung |
| --- | --- | --- |
| godot_voxel | MIT, `LICENSE.md` | Konzepte und isolierte Reuse-Kandidaten möglich; Godot-/Engine-Abhängigkeiten trotzdem kapseln |
| Tuntenfisch/Voxels | MIT, `LICENSE` | Algorithmuskonzepte studieren; HLSL/Unity-Code nicht ungeprüft übernehmen |
| Terraxel-Unity | README behauptet MIT, aber im untersuchten Commit fehlt eine Lizenzdatei | keine Source-Reuse; nur Beobachtung/Neuentwurf bis Rechte geklärt |
| three-mesh-bvh | MIT, `LICENSE` | externer Tool-/Runtime-Adapter vertretbar |
| meshoptimizer | MIT, `LICENSE.md` | externer Offline-/WASM-Adapter vertretbar; Codec-/Versionvertrag pinnen |
| FastNoiseLite | MIT, `LICENSE` | externer Adapter vertretbar; Port-Parität selbst testen |
| Goxel | GPL-3.0-or-later, `COPYING` | externes Tool/Konzeptstudie; keine proprietäre Runtime-Source-Reuse ohne Rechtsprüfung |
| Blockbench | GPL-3.0-or-later, `LICENSE.MD` | externes Authoring-Tool; nicht als Runtime-Abhängigkeit bundeln |
| MagicaVoxel | keine Repo-Lizenz; Nutzungsbedingungen auf offizieller Site | extern nutzen; Software/Binaries nicht redistribuieren; Assetrechte je Quelle dokumentieren |
| rabbit-hole | zlib, `LICENSE.md` | Konzepte/isolierter Kandidat; Projekt selbst ausdrücklich unvollständig und alt |
| Transvoxel-Tables | MIT, `LICENSE` | Tabellen mit Attribution/License übernehmen möglich; Implementierung neu testen |
| Transvoxel-Webtext/Dissertation | Website nennt patentfrei; Dissertation CC BY-ND 3.0 | Paper/Abbildungen nicht bearbeiten/redistribuieren; Algorithmus und MIT-Tabellen getrennt behandeln |
| Khronos glTF | `LICENSE.adoc`: je Artefakt Apache-2.0, CC-BY-4.0 beziehungsweise Khronos-Spezifikationsbedingungen | Spezifikation referenzieren; Schema-/Tool-Lizenzen beim Vendoring separat erhalten |
| Blender | GPL, `COPYING` | externes Production-Tool; eigene Outputs/Assets separat lizenzieren und Quellassets inventarisieren |

[Inference] Dies ist eine technische Lizenzinventur, keine Rechtsberatung. Vor
Source-Vendoring, Tool-Bundling oder Veröffentlichung von abgeleiteten Tabellen
ist ein projektbezogener Legal Review erforderlich.

## 18. Golden Asset Corpus

[Inference] Jeder Fall besitzt Source-GLB/Generatorparameter, erwartete
Compilerdiagnosen, kanonische Brick-/Manifest-Hashes, Referenzbilder nur im
separaten Testsystem, Meshstatistiken, Collider-/Nav-Invarianten und Offline-
Masseneigenschaften mit Toleranz.

| Golden Case | Deckt ab | Muss beweisen |
| --- | --- | --- |
| geneigte Ebene über 2x2 Bricks | Basis-Seams | identische Grenzvertices, keine Doppel-/Fehlflächen |
| Kugel plus schmaler Tunnel | organisch/Höhle | watertight innen/außen, korrekte Normalen |
| SDF-Sattel/Ambiguity-Cases | MC/Topology | feste Fallauflösung auf CPU/WASM/WebGPU |
| 2:1-Terrainkreuz | Transvoxel | alle sechs Faces, Kanten/Ecken und Neighbor-Reihenfolgen crackfrei |
| dünne Platte und Rohrleiter | Thin Policy | Shell/Beam oder harter Fehler; kein stilles Verschwinden |
| Materialkeil mit vier Gewichten | Material Channels | Palette, Interpolation und Seam-Locks deterministisch |
| harter Cuboid-Raum mit Tür | Building/Greedy/Nav | scharfe Kanten, Öffnung und begehbare Projektion |
| Structural-Assembly-Fachwerk | D1/Graph | Verbindungstrennung und Komponenten-IDs stabil |
| GLB mit negativen Skalen, Instanzen und `extras` | Compiler | Achsen, Winding, Instanzauflösung und Metadatenschema |
| LayeredShell-Panzerung | Schichten | Reihenfolge, Dicke, Restmasse und Bruchfläche |
| wiederholte CSG-Editsequenz nach Reload | D0/D2 | identische Brick-/Mesh-/Manifest-Hashes |
| exzentrisch beschädigter Asteroid | D4/D5 | Masse, COM und Inertia gegen hochpräzise Offline-Integration |

## 19. Maximal vier spätere Spikes

[Inference] Genau diese vier späteren Experimente sind priorisiert:

1. **Deterministic Terrain Brick Spike.** CPU und WASM implementieren dieselben
   quantisierten Samples, Marching-Cubes-Regular-Cells und Transvoxel-Seams für
   den Golden-2:1-Korpus. Gate: identische Topologie/indizierte Hashes,
   Zeit-/Speicherbudget und keine Cracks.
2. **GLB Structural Compiler Spike.** Blender-GLB mit `hestia`-`extras` durch
   Normalisierung, Thin Policy, Sparse Bricks, Structural Graph, Collision/Nav-
   LOD und Mass Properties führen. Gate: reproduzierbares Manifest und harte
   Diagnosen für offene Solids sowie unteraufgelöste tragende Features.
3. **Dual Vertex WebGPU Spike.** constrained QEF, Edge-Centroid und
   Schmitz-Partikel auf identischer Hermite-Suite vergleichen. Gate: scharfe
   Featurefehler, Cell-Containment, Cross-device-Determinismus, Worker-/WASM-
   Fallback und WGSL-Kosten; kein TSL-Zwang vor Messung.
4. **Persistent Destruction/Mass Spike.** Dirty-Brick-Journal, Structure-
   Component-Split, Collider/Nav-Swap und inkrementelle Momentensummen über
   Edit/Save/Reload testen. Gate: Referenzmasse/-COM/-Inertia innerhalb
   Toleranz und begrenzte Save-/Remesh-Amplifikation.

## 20. Abschlussentscheidung

[Inference] Die geeignete Hestia-Pipeline ist ein **hybrides, kanalisiertes
Sparse-Brick-System**: quantisiertes SDF plus Transvoxel für organisches Terrain
und Höhlen; semantische Volumen plus Structural-Assembly-Graph für harte,
vollständig zerstörbare Strukturen; authored GLB-LODs für intakte Darstellung;
Greedy Meshing für blockige Flächen und gekapseltes Dual Contouring erst für
freie Bruchflächen. Persistente Edits, Collision/Nav, Render-LODs und
Masseneigenschaften sind revisionierte Projektionen derselben kanonischen
Kanäle, nicht voneinander abgeleitete Wahrheiten.

[Inference] Externe Entscheidungen:

- **Adopt as external tool:** Blender, Blockbench.
- **Prototype behind adapter:** three-mesh-bvh, meshoptimizer, FastNoiseLite.
- **Study and extract concepts:** godot_voxel, Tuntenfisch/Voxels, Terraxel,
  Goxel, rabbit-hole, Transvoxel, Geometry Clipmaps und CDLOD.
- **Revisit later:** MagicaVoxel-Bundling oder automatisierter Import über die
  öffentliche Referenzasset-Nutzung hinaus.
- **Reject:** ein einheitlicher Octree als mutable Weltwahrheit, Terraxel-
  Source-Reuse ohne Lizenzdatei und ein Editorformat als Runtime-Datenwahrheit.

## 21. Traceability der geforderten Ergebnisse

| Ergebnis | Abschnitt |
| --- | --- |
| Meshing Decision Matrix | 6 |
| Terrain-vs-Building-Strategie | 7 |
| LOD-Seam-Strategien | 8 |
| Chunk Data Channels | 9 |
| Incremental Remesh | 10 |
| Collision/Nav Projection | 11 |
| Asset Compiler | 12 |
| Thin Feature Policy | 13 |
| Authoring Tool Matrix | 14 |
| Destruction Architecture | 15 |
| Mass/COM/Inertia Inputs | 16 |
| License Risks | 17 |
| Golden Asset Corpus | 18 |
| maximal vier spätere Spikes | 19 |
