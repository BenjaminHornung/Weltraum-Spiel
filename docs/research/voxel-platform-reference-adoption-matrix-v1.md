# Voxel Platform Reference Adoption Matrix v1

Stand: 2026-07-13
Status: verbindliche Docs-only-Planungsklassifikation, keine Integrationsfreigabe

## Zweck und Geltungsbereich

Diese Matrix normalisiert die Entscheidungen der vier abgeschlossenen
Research-Audits zu genau einer Planungskategorie je eigenständig
klassifizierter Referenz. Sie enthält die 27 ausdrücklich verlangten
Mindest-Referenzen und sechs weitere Referenzen mit eigenem Audit-Urteil. Sie
ist die kanonische Leseschicht über den unveränderten Einzelbefunden:

- [Browser Voxel Runtime Reference Audit v1](browser-voxel-runtime-reference-audit-v1.md)
- [Planet LOD & Streaming Reference Audit v1](planet-lod-streaming-reference-audit-v1.md)
- [Voxel Meshing, Destruction, and Asset Audit v1](voxel-meshing-destruction-asset-audit-v1.md)
- [WebGL/WebGPU Observability Tooling Audit v1](webgl-observability-tooling-audit-v1.md)

Die Einordnung ist eine **[Inference]** aus den in den Audits klassifizierten
Befunden. Sie entscheidet weder eine Runtime-Abhängigkeit noch Packageaufnahme,
Source-Vendoring, Tool-Bundling oder Produktionsreife. Auch
`Adopt as external tool` bezeichnet nur ein außerhalb der Produktruntime
verwendetes Werkzeug mit eigener Versions-, Lizenz-, Datenschutz- und
Provenancekontrolle.

## Evidenzgrenzen

Die Evidenzsprache der vier Audits bleibt verbindlich:

| Evidenzklasse | Zulässige Aussage |
| --- | --- |
| `README Claim` | Dokumentierte Projektbehauptung; kein selbstständiger Nachweis der Implementierung oder Qualität. |
| `Code Evidence` | Im gepinnten Stand untersuchte Implementierung, Datenstruktur, Konfiguration, Lizenz- oder Teststruktur. |
| `Test Evidence` | Tatsächlich ausgeführter Test oder ausdrücklich nur inventarisierter Testpfad mit entsprechendem Status. |
| `Benchmark Evidence` | Reproduzierbare Messung mit Kontext; historische oder fremde Werte sind kein Hestia-Budget. |
| `Observed Demo Evidence` | In einem echten Lauf sichtbares Verhalten; kein Nachweis verborgener Architektur, Authority, Deterministik oder Persistenz. |
| `Inference` | Aus den Belegen abgeleitete Planungsentscheidung, Risikoaussage oder noch zu prüfende Hypothese. |

Ein README, eine sichtbare Demo, ein Screenshot oder vorhandene, aber nicht
ausgeführte Tests werden in dieser Matrix nicht zu Code-, Test- oder
Benchmark-Evidence hochgestuft. Aussagen wie „seamless“, „fast“, „shared“ oder
„persistent“ gelten nur in der jeweils tatsächlich belegten Reichweite.

## Erlaubte Kategorien und Entscheidungskriterien

Nur die folgenden sechs Kategorien sind gültig:

| Kategorie | Verbindliche Bedeutung |
| --- | --- |
| Adopt as external tool | Das Werkzeug darf außerhalb der Produktruntime in einem kontrollierten Authoring-, Diagnose- oder Analyseprozess vorgesehen werden. Keine Source- oder Binary-Bundling-Freigabe ist enthalten. |
| Prototype behind adapter | Ein begrenzter Spike hinter einer eigenen stabilen Schnittstelle ist zulässig. Erst Benchmark, Verifikation, Lizenzprüfung und Docs-Review können eine spätere Integrationsentscheidung begründen. |
| Study concepts | Architektur- oder Algorithmusmotive dürfen studiert und eigenständig neu entworfen werden. Keine Source-Übernahme oder Engineintegration ist vorgesehen. |
| Isolated code reuse candidate | Nur ein ausdrücklich abgegrenzter Source-Teil darf nach erneuter Provenance-, Lizenz-, Paritäts-, Sicherheits- und Performanceprüfung untersucht werden. Die Kategorie gilt nicht für das Gesamtprojekt. |
| Revisit later | Eine Einordnung wird bewusst vertagt, bis ein benanntes Evidence-Gap geschlossen ist. Aktuell besteht keine Integrationsfreigabe. |
| Reject | Die Referenz wird im aktuellen Plattformplan wegen Architektur-, Lizenz-, Provenance-, Reife- oder Evidence-Risiken nicht weiterverfolgt. Eine Neubewertung benötigt einen neuen Auditstand. |

## Verbindliche Referenzmatrix

| ID | Referenz | Kategorie | Begründung und Grenze | Audit-Evidence |
| --- | --- | --- | --- | --- |
| R01 | Voxelize | Isolated code reuse candidate | Ausschließlich der MIT-lizenzierte gemeinsame Rust-/WASM-Mesher ist hinter einem eigenen `MesherPort` prüfbar. Engine, `@voxelize/core` und World-Runtime werden nicht übernommen. Registry-Isolation, 16-/32-Bit-Indizes, native/WASM-Parität, Kopierkosten, Peak Memory und Provenance sind harte Gates. | [Browser-Audit §§5.1, 10.1, 14–16](browser-voxel-runtime-reference-audit-v1.md) |
| R02 | Divine Voxel Engine | Study concepts | Workerrollen, SAB-an/aus, Ownership-Snapshots, Buffer-Recycling und Model-/State-LUTs sind starke Konzepte. Netzwerk-Authority, dauerhafte Persistence und ein belastbarer Three.js-Pfad fehlen; WebGPU ist experimentell. | [Browser-Audit §§5.2, 6.2, 10.2, 16](browser-voxel-runtime-reference-audit-v1.md) |
| R03 | AresRPG | Study concepts | Typed Arrays, gemeinsamer Browser-/Node-Generatorpfad, priorisierte Arbeit und Ein-Voxel-Halo sind nützlich. Fehlende Source-Lizenz, fehlende Revision/Authority, `eval`-Worker und tiefe Three.js-Kopplung schließen Source-Reuse aus. | [Browser-Audit §§4.3–4.4, 5.3, 6.3, 14](browser-voxel-runtime-reference-audit-v1.md) |
| R04 | Veloren | Study concepts | Server-owned World State, deduplizierte Chunkgeneration, Lifecycle und Delta-Persistence sind relevante Muster. Die native GPL-Gesamtbasis und nur teilweise serverautoritative Player-Physik verhindern eine Integration. | [Browser-Audit §§5.4, 8.4, 9.4, 14](browser-voxel-runtime-reference-audit-v1.md) |
| R05 | neural-planetoid | Study concepts | Worker-Density, WASM-Meshing, Parent-Readiness, Queuepriorisierung und Dither sind untersuchenswert. Rissfreie LOD-Nähte, Tests, gezielte Cancellation, Pooling und System-/Body-Frames sind nicht belegt. | [Planet-Audit §3merillon/neural-planetoid und §12](planet-lod-streaming-reference-audit-v1.md) |
| R06 | 3DTilesRendererJS | Study concepts | Queue-, LRU-, Readiness-, Parentfallback- und Fade-Muster sind übertragbar. 3D Tiles bleibt ein später Format-/Tooling-Kandidat für statische Far-Field-Stadtproxies, nicht die Authority dynamisch zerstörbarer Oberflächen. | [Planet-Audit §NASA-AMMOS/3DTilesRendererJS und §12](planet-lod-streaming-reference-audit-v1.md) |
| R07 | CesiumJS | Study concepts | Stärkste Referenz für Shell-Quadtree, SSE, Ellipsoid-Horizon-Culling, Parentfallback/Upsampling und camera-relative Terrain. Die vollständige Geospatial-Engine wird nicht portiert und besitzt kein Microvoxelmodell. | [Planet-Audit §CesiumGS/cesium und §12](planet-lod-streaming-reference-audit-v1.md) |
| R08 | OpenSpace | Study concepts | Zeitabhängige Double-Precision-Framehierarchie, Ephemeriden und camera-relative Darstellung sind übertragbar. Die native Visualisierungsengine liefert keine Terrainmutation oder Microvoxelarchitektur. | [Planet-Audit §OpenSpace/OpenSpace und §12](planet-lod-streaming-reference-audit-v1.md) |
| R09 | PlanetTech/OpenWorlds | Reject | PlanetTech hat widersprüchliche Lizenzangaben, eine defekte Demo, keine belastbare Scheduler-/Culling-/Pooling-Architektur und enge Three.js-Kopplung. Die genaue Zuordnung des Namens `OpenWorlds` blieb im Audit `UNKNOWN`; deshalb besteht für die kombinierte Referenz keine Adoption. | [Planet-Audit §PlanetTech/OpenWorlds und §12](planet-lod-streaming-reference-audit-v1.md) |
| R10 | godot-cuberact | Study concepts | Kompakte Referenz für Cube-Sphere, Horizon-/Frustum-Culling, Skirts, Pooling, Splitbudget, Origin Shift und dynamisches Clipping. Synchrones Godot-Heightfield, Ein-Planet-Frame und fehlender Authorityvertrag schließen einen Port aus. | [Planet-Audit §cuberact/godot-cuberact-planet-chunked-lod und §12](planet-lod-streaming-reference-audit-v1.md) |
| R11 | godot_voxel | Study concepts | Stärkstes Architekturvorbild für getrennte Generator-, Stream-, Data- und Mesherrollen sowie Transvoxel. Ein Godot-/C++-Port oder eine Übernahme als Datenautorität ist nicht vorgesehen. | [Meshing-Audit §§5–7, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R12 | Terraxel | Study concepts | Der volumetrische Near-Field-/2.5D-Far-Field-Vergleich und Transvoxel sind lehrreich. Source benennt Übergangslücken, Edits gehen beim Recycling verloren und im gepinnten Stand fehlt ein Root-Lizenztext; Source-Reuse ist ausgeschlossen. | [Meshing-Audit §§5, 5.1, 7.2, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R13 | Tuntenfisch/Voxels | Study concepts | GPU-Dual-Meshing, Density Graph und CSG liefern Vergleichspunkte. Full-Chunk-Remesh, GPU-Readback, Geometry Shader, fehlende Persistenz und fehlende Tests verhindern eine Übernahme. | [Meshing-Audit §§5, 5.1–5.2, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R14 | ClaudeCitizen | Reject | Keine verwertbare Lizenz, keine passende Testsuite, fehlerhafte GLTF-Requests und kein beobachteter Surface-to-Orbit-Handoff. README-Claims zu Kontinuität werden nicht als Architekturbeweis behandelt. | [Planet-Audit §AlanGreyjoy/claudecitizen und §12](planet-lod-streaming-reference-audit-v1.md) |
| R15 | Takram three-geospatial | Prototype behind adapter | Atmosphäre und Wolken dürfen ausschließlich als austauschbarer Renderer-Adapter gespiket werden. WebGL wurde beobachtet; WebGPU-Rewrite, ECEF-Annahmen, API-Stabilität und Performance bleiben offen. | [Planet-Audit §§10, takram-design-engineering/three-geospatial, 12](planet-lod-streaming-reference-audit-v1.md) |
| R16 | Spector.js | Prototype behind adapter | Geeignet für gepinnte WebGL-Einzelcaptures. WebGL-only, erheblicher Observer-Effekt sowie nachgewiesene MCP-Summary-, Worker- und OffscreenCanvas-Gaps verbieten eine Productiondependency oder kontinuierliche Messung. | [Observability-Audit §§1–2](webgl-observability-tooling-audit-v1.md) |
| R17 | Chrome DevTools MCP | Adopt as external tool | Gepinntes, isoliertes On-demand-Werkzeug für Chrome-Traces, Network, Console und Heap. Usage Statistics, CrUX, Updatechecks, Header und sensible Artefakte müssen explizit kontrolliert werden. | [Observability-Audit §§1, 3, 9–10](webgl-observability-tooling-audit-v1.md) |
| R18 | stats-gl | Prototype behind adapter | Optionaler Dev-only-Indikator für instrumentierte Render-CPU/GPU/Compute-Werte. Kein vollständiger Framewert, keine Gameplay-Truth und kein hartes CI-Gate; Texture Preview bleibt bei Timingläufen aus. | [Observability-Audit §§1, 4, 8, 10](webgl-observability-tooling-audit-v1.md) |
| R19 | MemLab MCP | Adopt as external tool | On-demand-Werkzeug für Heap-Snapshotserien, Dominatoren und Retainer. Es belegt JS-Retention, aber weder GPU-Speicher noch die fachliche Notwendigkeit einer Eviction. | [Observability-Audit §§1, 5, 9–10](webgl-observability-tooling-audit-v1.md) |
| R20 | Comlink | Prototype behind adapter | Nur kleine Control-Plane-Kommandos dürfen RPC nutzen; große Buffer werden explizit transferiert. Cancellation, Deadline, Revision, Restart, Cleanup und Ownership bleiben eigene Verträge. | [Observability-Audit §§1.3–1.4, 6](webgl-observability-tooling-audit-v1.md) |
| R21 | three-mesh-bvh | Prototype behind adapter | Geeignet für revisionierte Raycast-, Sculpting- und Collision-Projektionen. Lokale Deformationen können `refit` nutzen; große Änderungen benötigen einen Rebuild und eigene Staleness-Gates. | [Meshing-Audit §§5, 5.1, 10, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R22 | meshoptimizer | Prototype behind adapter | Offline-/WASM-Adapter für LOD, Reordering und Codecs. Material-, UV-, Chunk- und Cut-Seams müssen gelockt; Version, Optionen und Output im Compiler-Manifest gehasht werden. | [Meshing-Audit §§5, 5.1, 8, 12, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R23 | FastNoiseLite | Prototype behind adapter | Geeigneter Noise-Kandidat hinter eigenem Vertrag. Ein gleicher Seed beweist keine bitidentische Cross-Language-Ausgabe; CPU-/WASM-/GPU-Golden-Parität ist Pflicht. | [Meshing-Audit §§5, 5.1, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R24 | Blender | Adopt as external tool | Primäres Production-Authoring mit GLB-Ausgabe; Custom Properties können `extras` transportieren. Toolversion und Exportoptionen werden gepinnt, evaluierte Geometrie wird kompiliert, Blender-Source wird nicht eingebettet. | [Meshing-Audit §§3.2, 12, 14, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R25 | Blockbench | Adopt as external tool | Externes Authoring für boxige Props und modulare Technikobjekte mit GLB-Ausgabe. Hestia-Semantik benötigt Konvention oder Plugin und Compilerprüfung; GPL-Source bleibt außerhalb der Runtime. | [Meshing-Audit §§5, 12.3, 14, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R26 | Goxel | Study concepts | Copy-on-write-Tiles, Layers, Undo und Painter-Modell sind nützliche Editorideen. Die GPL-native Editorarchitektur ist weder Runtime- noch Compilerfundament. | [Meshing-Audit §§5, 5.1, 14, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R27 | MagicaVoxel | Adopt as external tool | Extern für Stil, Paletten und kleine Referenzassets nutzbar. Software oder Binaries werden nicht gebündelt oder redistribuiert; ein automatisierter Import bleibt ein späterer Prüfpunkt. | [Meshing-Audit §§5, 14, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R28 | Cosmonium | Study concepts | Frameleiter, Anchor-Split, Depth-Regionen und dynamische Near-/Far-Projektion sind relevante Präzisionsmuster. GPL, Panda3D und die Mixed-Language-Basis schließen eine Codeintegration aus; komprimierte Renderkoordinaten dürfen nie Simulationswahrheit werden. | [Planet-Audit §Cosmonium und §12](planet-lod-streaming-reference-audit-v1.md) |
| R29 | dgreenheck/threejs-procedural-planets | Revisit later | Ausschließlich spätere visuelle Lookdev-Referenz für Shader, Höhenfarben und Atmosphäre. Fixe Sphere-Dichte, unseeded Wolken, offene Atmosphärenperformance und fehlender Tile-/Chunk-Lifecycle liefern keine Planet- oder Streamingarchitektur. | [Planet-Audit §dgreenheck/threejs-procedural-planets](planet-lod-streaming-reference-audit-v1.md) |
| R30 | XenoverseUp/procedural-planets | Revisit later | Ausschließlich spätere visuelle Referenz für Six-Face-Mesh, Noise und Gradienten. Unseeded Noise, synchrones GPU-Readback, fixe Flächenauflösung, Shaderwarnungen und fehlende Tests schließen eine aktuelle Adoption aus. | [Planet-Audit §XenoverseUp/procedural-planets](planet-lod-streaming-reference-audit-v1.md) |
| R31 | vanruesc/rabbit-hole | Study concepts | Dual Contouring mit QEF, Sparse Voxel Octree, Clipmaps, CSG, Worker und serialisierte SDF-Operationen sind Konzeptquellen. Das alte, ausdrücklich unvollständige Projekt belegt weder LOD-Seams noch belastbare Persistenz oder Performance. | [Meshing-Audit §§3.1, 5, 5.1, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R32 | EricLengyel/Transvoxel tables | Isolated code reuse candidate | Ausschließlich die MIT-lizenzierten Lookup-Tabellen dürfen nach erneuter Provenance-, Attribution- und Paritätsprüfung isoliert untersucht werden. Mesher, Algorithmus, Indexierung, 2:1-Seamvertrag und Tests bleiben Eigenarbeit. | [Meshing-Audit §§3.1, 5, 7.2, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |
| R33 | Blender Geometry Nodes | Adopt as external tool | Externes prozedurales Authoring für Assetfamilien. Toolversion, Node-Gruppen und Exportoptionen werden gepinnt; Instanzen, Modifier, evaluierte Geometrie und Metadaten müssen vor dem Compiler deterministisch gebaked werden. Der Nodegraph ist keine Runtime-Wahrheit. | [Meshing-Audit §§5, 12, 14, 17, 20](voxel-meshing-destruction-asset-audit-v1.md) |

Verteilung der 33 Entscheidungen:

| Kategorie | Anzahl |
| --- | ---: |
| Adopt as external tool | 6 |
| Prototype behind adapter | 7 |
| Study concepts | 14 |
| Isolated code reuse candidate | 2 |
| Revisit later | 2 |
| Reject | 2 |

## Verbindliche Cross-Audit-Architektur

Die folgenden Richtungen werden von mehreren Audits gemeinsam getragen und
sind für die nachgelagerte Plattformplanung verbindlich:

1. World State und Voxel State sind unabhängig von Three.js. Three.js erhält
   ausschließlich revisionierte Renderartefakte über einen Renderer-Adapter.
2. Astronomische und planetare Daten verwenden einen hierarchischen
   Double-Precision-Framegraph. GPU- und lokale Physiktransforms sind
   camera-/origin-relative Projektionen, keine dauerhafte Wahrheit.
3. Ein Planet wird global nicht vollständig volumetrisch materialisiert.
   Planetare Makrodaten, Surface Tiles, `SurfaceRegion`s und lokale
   Voxel-Bricks sind getrennte, stabil adressierte Ebenen.
4. Das Near Field darf echte sparse Microvoxels verwenden. Ein uniformer,
   revisionierter Brickbestand ist die mutable Wahrheit; Octrees, Meshes,
   BVHs, Collider, Navmeshes und Far-Field-Heightfields sind Derived State.
5. Terrain und Gebäude dürfen unterschiedliche Mesher und Renderprojektionen
   verwenden. Organisches Terrain favorisiert SDF/Regular Cells/Transvoxel;
   harte intakte Strukturen nutzen authored GLB-LODs und beschädigte Bereiche
   lokale Greedy- oder gekapselte Dual-Verfahren.
6. Persistenz besteht aus Seeds, Schema-/Generator-/Compiler-Versionen,
   Semantic State und dauerhaften Deltas beziehungsweise Editrevisionen.
   Coalescte Snapshots ersetzen keine geordnete Commit- und Recovery-Grenze.
7. GLB/glTF 2.0 ist der kanonische Input des Offline-Asset-Compilers. `extras`
   sind nur ein validierter Transportkanal; das kanonische Manifest ist die
   interne Wahrheit.
8. Die Worker Data Plane verwendet wenige große, explizit übertragene Buffer.
   RPC darf nur die kleine Control Plane vereinfachen. Ownership, Revision,
   Deadline, Cancellation und Fehlercodes bleiben eigene Contracts.
9. WASM wird erst nach Paritäts-, Speicher- und Performancebenchmarks
   eingeführt. Shared Memory bleibt optional und benötigt eine gesonderte
   COOP/COEP-, Hosting-, Security-, Ownership- und Race-Prüfung.
10. Grobe Parents und Proxies bleiben aktiv, bis die für den aktuellen Handoff
    erforderliche feinere Coverage ausdrücklich ready ist. Visuelles Fading
    darf fehlende Simulationsbereitschaft nicht kaschieren.
11. Streaming berücksichtigt Sichtbarkeit, Geschwindigkeit, Route,
    Sicherheitskorridor, Zeit bis Bedarf und Deadline. Bei verfehlter Deadline
    wird Qualität reduziert oder `NOT READY` gemeldet.
12. Eigene Runtime Telemetry, Playwright, Chrome DevTools MCP, Spector.js,
    stats-gl und MemLab besitzen getrennte Rollen. Kein Tool ersetzt die
    fachliche Chunk-, Queue-, Revision- oder Persistence-Wahrheit.
13. Lokale Voxelzerstörung verändert nicht automatisch Rotation oder Orbit
    eines Planeten. Masse, COM, Inertia, echte Massentransfers,
    Impulsübertragung und Orbitkopplung werden langfristig in getrennten,
    aufeinander aufbauenden Stufen bilanziert.

## Verbindliche Produktdirektiven, nicht Research-Schlussfolgerungen

Die folgenden Festlegungen stammen aus dem Plattformauftrag. Die vier Audits
liefern dafür teilweise technische Bausteine, aber keinen fachlichen Nachweis.
Sie dürfen daher nicht als externe Research-Ergebnisse zitiert werden:

- `0,25 m` bleibt Qualitätsziel für lokale Microvoxels; `0,50 m` bleibt
  Performance-Fallback. Erst der Mesherbenchmark bestimmt zulässige Reichweite,
  Brickgröße, Kanäle und Hardwareprofile.
- Authored Städte und Story-Hotspots überlagern die prozedurale Hestia-Basis.
  Ihre Platzierung, semantische Priorität und Story-Normalisierung benötigen
  eigene Produktverträge.
- Der Spieler startet auf Hestia ohne eigenes Schiff. Ground-Origin und erstes
  Schiff sind Progressionsentscheidungen, keine LOD- oder Engine-Evidence.
- `WorldTemplate` beschreibt reproduzierbare Basis, Regeln und Versionen;
  `WorldInstance` beschreibt die konkrete semantische Geschichte und Deltas.
  Die endgültigen Schemas werden separat spezifiziert.
- Das private Heimatsystem kann später als galaktischer Birth Cluster in die
  gemeinsame Galaxie überführt werden.
- Nur uncommitted oder unobserved Sektoren dürfen einen Birth Cluster
  aufnehmen. Umliegende unentdeckte Systeme bilden eine temporäre Pufferzone;
  andere Spieler können den Cluster später normal entdecken.
- Ein vollständig bidirektionaler Offline-/Online-Merge bleibt Research. Die
  Seed-/Version-/Delta-Architektur ist eine Voraussetzung, aber kein Beweis für
  konfliktfreie Zusammenführung.

## Benchmark-, Reuse- und Revisit-Gates

Eine spätere Änderung der Matrix benötigt neue Evidence, einen aktualisierten
Auditstand und eine ausdrückliche Planungsentscheidung. Mindestens folgende
Gates bleiben offen:

| Gate | Betroffene Referenzen oder Plattformgrenze | Erforderliche Evidence |
| --- | --- | --- |
| Shared-Mesher-Parität | Voxelize | Gleicher versionierter Chunk-/Registry-Input auf Native und WASM; Topologie-/Attribut-Hashes, Indexgrenzen, Copy- und Peak-Memory-Messung sowie vollständige Reuse-Provenance. |
| Microvoxel-Mesherbenchmark | godot_voxel, Tuntenfisch/Voxels, Terraxel sowie eigene Mesher | Vergleich bei `0,25 m` und `0,50 m` für Terrain, harte Strukturen und freie Bruchflächen; CPU, Worker, WASM und optional WebGPU getrennt. |
| Planet-Tile-Scheduler | 3DTilesRendererJS, CesiumJS, neural-planetoid, godot-cuberact | Deterministische Cube-Sphere-Adressen, SSE, Horizon Culling ohne False Negatives, Route/Deadline, Cancellation, LRU und Parent-Readiness. |
| Representation Handoff | Planet Shell, Surface Tiles und Voxel-Bricks | Getesteter Frame-Roundtrip, gleiche Basissamples, persistente Edits, stale-result rejection und getrennte visuelle/simulative Readiness. |
| GLB-to-Voxel-Compiler | Blender, Blockbench, meshoptimizer | Reproduzierbare Normalisierung, Schema-Validierung, Thin-Feature-Policy, Structural Graph, Golden Asset Corpus, Collision/Nav-LODs, Hashes und Mass Properties. |
| Noise-Parität | FastNoiseLite oder eigener Generator | Gepinnte CPU-/WASM-/GPU-Goldenwerte; Seed allein genügt nicht. |
| Worker Data/Control Plane | Divine Voxel Engine, Comlink | Copy-versus-Transfer-Benchmark, gebündelte Buffer, Ownership, Backpressure, Cancellation, Restart und optionaler SAB-Lauf mit Deploymentprüfung. |
| Atmosphärenadapter | Takram three-geospatial | Gepinnter WebGL- oder WebGPU-Pfad, stabiler eigener Parametervertrag, Frame-/Depth-Integration, Fallback und kontrolliertes GPU-Budget. |
| WebGL-Capture und Telemetrie | Spector.js, Chrome DevTools MCP, stats-gl | Gepinnte Tools, dokumentierter Observer-Effekt, WebGL-only-Kennzeichnung, getrennte Runtimezähler und keine hardwareunabhängigen falschen CI-Gates. |
| Streaming-Leak-Harness | MemLab MCP und Runtime Telemetry | Wiederholte Surface-Orbit-Surface-Serie, getrennte Window-/Worker-Heaps, gleiche Phasen nach GC im Korridor sowie fachlich erklärbare Residency und Evictions. |
| Statische Stadtproxies | 3D Tiles als Formatoption | Bake-/Invalidierungsweg, Lizenzkette, Zuordnung zu authored Hotspots und klare Trennung von dynamischer Voxelautorität. |
| Persistente Deltas und Offline/Online | eigener World-State-Vertrag | Journal, Checkpoints, Schema-Migration, Recovery, Netzwerkrevision, Konfliktmodell und belegte Merge-Grenzen. |
| Mass Properties und Orbitkopplung | zerstörbare Strukturen und Asteroiden | Komponentenstabilität, Offline-Referenz für Masse/COM/Inertia, Impuls-/Drehimpulserhaltung und erst danach Rotation-/Orbit-Kopplung. |

## Provenance- und Lizenzgrenzen

- Keine Kategorie erlaubt das Kopieren fremder Sourcefragmente oder
  Lizenztexte in die Plattformdokumentation.
- Jeder spätere Source-Reuse-Kandidat benötigt erneut kanonische URL, exakten
  Commit, Originalpfad, Lizenzpfad, transitive Abhängigkeiten, lokale
  Transformationen und reproduzierbare Verifikation.
- Toollizenz, Source-Lizenz, Assetlizenz und Datenlizenz sind getrennte
  Inventare. Die Nutzung eines externen Editors lizenziert weder fremde Assets
  noch erlaubt sie das Bundling der Editorsoftware.
- Fehlende oder widersprüchliche Lizenzen schließen Source-Reuse aus. Ein
  Lockfile oder die Lizenz einer Abhängigkeit lizenziert nicht das untersuchte
  Projekt.
- Der Name `OpenWorlds` konnte im gepinnten PlanetTech-Stand nicht eindeutig
  verifiziert werden. Bis eine kanonische URL und ein eigener Auditstand
  vorliegen, darf `PlanetTech/OpenWorlds` weder als bewiesene Identität noch als
  Integrationskandidat dargestellt werden.
