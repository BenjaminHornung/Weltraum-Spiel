# Browser Voxel Runtime Reference Audit v1

**[Code Evidence]** Stand: 2026-07-13. Untersuchte Weltraum-Spiel-Basis:
`origin/main` bei `c780656c29ff4e5794be9ba58d6b78396a5826d5`.

## 1. Executive Verdict

- **[Inference]** Keine der untersuchten Engines sollte die bestehende
  Browser-Mainline von Weltraum-Spiel als Gesamtbasis ersetzen. Die passende
  Strategie ist ein eigener, versionierter Chunk-/Update-Contract mit eigener
  Game-/World-Authority; Mesher, Generatoren, Persistence-Mechanismen und
  Renderer werden dahinter als austauschbare Dienste oder Adapter behandelt.
- **[Inference]** Voxelize ist der engste technische Referenzpunkt für einen
  zwischen Rust-Server und WASM-Browser geteilten Mesher, getrennte dringende
  und normale Meshqueues, deklarative Generierungsstufen mit Overflow sowie
  coalescte Hintergrundsaves. **[Inference]** Nicht die Engine übernehmen;
  höchstens den MIT-Mesher als isolierten Kandidaten hinter eigenem Adapter
  prototypisieren.
- **[Inference]** Divine Voxel Engine ist der stärkste Referenzpunkt für
  getrennte World-/Generator-/Mesher-Worker, einen echten Shared-Memory-an/aus-
  Pfad, kompakte Meshpakete und kompilierte Model-/State-/Mod-Schemas.
  **[Inference]** DVE nicht übernehmen; die Konzepte SAB-frei zuerst hinter
  eigener Authority-, Persistence- und Three.js-Grenze prototypisieren.
- **[Inference]** AresRPG zeigt brauchbare Einzelmotive -- einen gemeinsamen
  Browser-/Node-Generatorpfad, priorisierte Chunkarbeit, kompakte Typed Arrays
  und einen Ein-Voxel-Halo -- aber weder eine belegte Authority/Persistence
  noch eine erkennbare Source-Lizenz.
- **[Inference]** Veloren belegt eine reife serverseitige World-State- und
  Chunk-Lifecycle-Trennung, einschließlich asynchroner, deduplizierter
  Generierung und persistierter Deltas. Es ist jedoch ein natives
  Rust-Gesamtspiel unter GPL-3.0-or-later, keine Browserengine; zudem ist die
  Player-Physik im untersuchten Stand nicht vollständig serverauthoritativ.
- **[Inference]** Das Zielbild lautet deshalb: **Konzepte extrahieren,
  Schnittstellen selbst besitzen, fremde Implementierungen höchstens isoliert
  hinter einem Adapter prototypisieren.**

## 2. Methode und Evidence-Grenzen

Die Begriffe in eckigen Klammern sind verbindliche Evidenzklassen:
`README Claim`, `Code Evidence`, `Test Evidence`, `Benchmark Evidence`,
`Observed Demo Evidence` oder `Inference`. Offizielle Projektdokumentation
ohne ausführbaren Nachweis wird konservativ als `README Claim` behandelt.

- **[Inference]** Ein README oder eine öffentliche Demo kann Features oder
  sichtbares Verhalten belegen, aber keine interne Architektur, Deterministik,
  Server Authority oder Crash-Sicherheit.
- **[Inference]** `NOT RUN` bedeutet nicht fehlgeschlagen; es bedeutet, dass im
  Research-Auftrag keine Abhängigkeiten installiert oder Builds ausgeführt
  wurden. Package-Skripte, Install-Hooks und Cargo-`build.rs` wurden vor der
  Entscheidung geprüft.
- **[Inference]** Alle Scores verwenden 1 (schwach) bis 5 (stark). Nur bei
  `Integration Cost` bedeutet 5 sehr teuer. `0 / ungeklärt` bei `License Fit`
  kennzeichnet fehlende oder für Source-Reuse nicht belegte Lizenzierung.
- **[Code Evidence]** Externe Repositories wurden ausschließlich unter
  `C:\tmp\external-browser-voxel-runtime-reference-audit-v1-20260713`
  untersucht. Keine externe Datei wurde in Weltraum-Spiel übernommen.

## 3. Projektmatrix

**[Inference]** Die Scores verdichten die unten einzeln belegten Befunde; sie
sind keine Benchmarkwerte.

| Projekt | Problem Fit | Architecture Fit | Browser Fit | Determinism | Testability | Performance Evidence | License Fit | Integration Cost | Maturity | Abschlussurteil |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Voxelize | 4 | 2 | 4 | 2 | 3 | 3 | 5 | 4 | 3 | **Study and extract concepts** |
| Divine Voxel Engine | 4 | 4 Konzepte / 2 direkt | 4 | 2 | 2 | 1 | 5 | 4 | 2.5 | **Study and extract concepts** |
| AresRPG Engine | 3 | 2 | 4 | 3 | 2 | 2 | 0 / ungeklärt | 5 | 2 | **Study and extract concepts** |
| AresRPG World | 3 | 3 | 3 | 4 | 1 | 1 | 0 / ungeklärt | 4 | 2 | **Study and extract concepts** |
| Veloren | 3 | 4 | 1 | 3 | 4 | 3 | 1 | 5 | 4 | **Study and extract concepts** |

**[Inference]** Main Risks je bewertetem Projekt:

| Projekt | Main Risks |
| --- | --- |
| Voxelize | rohe Client-Edits ohne belastbaren Authority-Vertrag; keine Netzwerkrevisionen; Snapshot-Recovery-Lücken; Three.js-Kopplung; hoher Shared-Pool-Speicher; flache Weltgrenzen |
| Divine Voxel Engine | kein Server-Command-/Revisionsvertrag; kein Storage-Backend; SAB-/Snapshot-Kosten; keine automatische Test-/Benchmark-Evidence; stale Three; experimentelles WebGPU |
| AresRPG Engine | fehlende Lizenz; tiefe Three.js-Kopplung; `eval`-Worker; Eingabekopien; keine Revision/Authority; schwache Tests; unvollständiges `dispose` |
| AresRPG World | fehlende Lizenz; kein versionierter Contract; keine Transferables/Persistence/Authority; Three-Typen; globale Zustände; schwache Tests |
| Veloren | GPL; native Rust-/ECS-Gesamtbasis; hohe Integration; experimentelle Terrain-Persistence; Default-Playerphysik nicht vollständig serverauthoritativ |

## 4. Reproduzierbare Provenance und Ausführungsstatus

**Klassifikation:** URL, SHA, Datum, Branch/Tag, Lizenzpfad und statisch
festgestellte Build-/Teststruktur sind **[Code Evidence]**. Ausgeführte
Browserbeobachtungen sind **[Observed Demo Evidence]**. Vorhandene, aber nicht
ausgeführte Tests/Benches werden ausdrücklich als **[Test Evidence]** bzw.
**[Benchmark Evidence]** aus den Quellen und zugleich als `NOT RUN`
gekennzeichnet. Einschränkungen sind **[Inference]**.

### 4.1 Voxelize

| Feld | Feststellung |
| --- | --- |
| Kanonische URL | `https://github.com/voxelize/voxelize` |
| Commit | `1bc80f1546890a5f5e8360ea89c3bd7e0a5b2f8b` |
| Commit-Datum | `2026-07-12T00:30:33-07:00` |
| Branch / Tag | `main` / kein Tag am HEAD |
| Lizenz | MIT; exakter Pfad `LICENSE`, zusätzlich `Cargo.toml:20-23`, `package.json:1-4` |
| Buildstatus | `NOT RUN`: Scripts/Hooks/`build.rs` geprüft; keine Installation oder Buildausführung |
| Teststatus | `NOT RUN`: Testquellen statisch untersucht |
| Benchmarkstatus | `NOT RUN`: Criterion-Harness und eingecheckter Optimierungsbericht untersucht |
| Demostatus | `PASS WITH CAVEATS`: öffentliche eingebettete Multiplayerwelt sichtbar |
| Browserstatus | `FAIL` als Clean-Console/Network-Gate; sichtbare Kernfunktion lief |

- **[Code Evidence] Untersuchte Pfade:** `README.md`, `LICENSE`, `package.json`,
  `Cargo.toml`, `build.rs`, `messages.proto`, `crates/mesher/**`,
  `crates/wasm-mesher/**`, `packages/core/package.json`,
  `packages/core/src/core/world/**`, `packages/core/src/core/world/workers/**`,
  `packages/core/src/core/world/pipelines.ts`, `packages/core/src/core/network/**`,
  `packages/core/src/libs/{worker-pool,worker-transfer,chunk-shared-pool}.ts`,
  `packages/physics-engine/src/**`, `packages/raycast/src/**`, `server/world/**`,
  `server/world/voxels/**`, `server/world/systems/**`,
  `server/server/models.rs`, `tests/**`, `benches/**`.
- **[Code Evidence]** `LICENSE:1-21` enthält MIT und Copyright 2022 Shaoru Ian
  Huang. Der Root-`build.rs:1-8` ruft `prost_build` für `messages.proto` auf
  und benötigt `protoc`; Root-`preinstall` erzwingt pnpm und `prepare`
  startet Husky. Deshalb wurde kein Install-/Buildpfad ausgeführt.
- **[Test Evidence]** Zehn externe Mesher-Tests stehen in
  `tests/mesher_tests.rs:38-433`; weitere Mesher-, Block-, Licht-, Clientevent-,
  Raw-Chunk- und einzelne Physiktests wurden gefunden, aber nicht ausgeführt.
  `tests/lighting.rs:2-5` ist nur ein `2 + 2 == 4`-Platzhalter.
- **[Benchmark Evidence]** Criterion-Definitionen messen Meshing in
  `benches/mesher_bench.rs:57-137` und Lighting/Flood in
  `benches/lights_bench.rs:24-129`. Der eingecheckte Bericht
  `crates/mesher/OPTIMIZATION_REPORT_2026-05-18.md:62-115` nennt konkrete
  Verbesserungen, enthält aber weder aktuelle Rohlogs noch eine Reproduktion am
  Audit-Commit.
- **[Inference] Bekannte Einschränkungen:** Shallow/grafted Historie; Demo-
  Deployment nicht commitgenau zuordenbar; kritische Authority-, Persistence-,
  Reconnect- und Worker-Race-Pfade haben keine ausgeführte Evidence.

### 4.2 Divine Voxel Engine

| Feld | Feststellung |
| --- | --- |
| Kanonische URL | `https://github.com/Divine-Star-Software/DivineVoxelEngine` |
| Commit | `9f0cc2cc8076cb823b5697fde7a8e3053500b88d` |
| Commit-Datum | `2026-07-04T13:45:33-04:00` |
| Branch / Tag | `main` / kein Tag am HEAD |
| Lizenz | MIT; exakter Pfad `LICENSE.md` |
| Buildstatus | `NOT RUN`: Scripts geprüft; keine Dependencies installiert |
| Teststatus | `NOT RUN / keine automatisierte Suite gefunden` |
| Benchmarkstatus | `NOT FOUND` |
| Demostatus | `PASS`: öffentliche Babylon-Classic-Demo sichtbar |
| Browserstatus | `PASS WITH CAVEAT`: geladener Pfad fehler-/warnungsfrei nach initialem Favicon-404 |

- **[Code Evidence]** Die erforderlichen Gitlinks wurden in dem temporären
  externen Clone initialisiert: `divinevoxel-vlox` bei
  `f5c3cafb0dff6d1edc8b470bd630075a34dfac5c` vom
  `2026-07-04T13:45:28-04:00`, MIT in `packages/vlox/LICENSE.md`; sowie
  `divinevoxel-vlox-babylon` bei
  `b5d1abd8c0bbeb90d13b09371e8596138cca19c2` vom
  `2026-07-04T13:45:25-04:00`, MIT in
  `packages/vlox-babylon/LICENSE.md`.
- **[Code Evidence] Untersuchte Pfade:** `README.md`, `LICENSE.md`,
  `.gitmodules`, Root-/Subpackage-`package.json`,
  `.github/workflows/deploygh.yaml`, `packages/vlox/src/Contexts/**`,
  `packages/vlox/src/Settings/**`, `packages/vlox/src/World/**`,
  `packages/vlox/src/WorldSimulation/**`, `packages/vlox/src/Mesher/**`,
  `packages/vlox/src/Renderer/**`, `packages/vlox/src/VoxelModel/**`,
  `packages/vlox/src/Data/**`, `packages/vlox/src/Voxels/**`,
  `packages/vlox/src/Tasks/**`, `packages/vlox-babylon/src/**`,
  `packages/vlox-quantum/src/**`, `testing/{Vlox,VloxBuilder,VloxFlow}/**`,
  `demos/{Vlox,VloxMinimal}/**`.
- **[Code Evidence]** Es gibt keine `preinstall`-/`postinstall`-Scripts und kein
  Cargo/`build.rs`. Build-/Publishscripts erzeugen oder löschen `dist` und
  rufen `npx tsc`; daher keine Ausführung auf dem Host.
- **[Code Evidence]** Root `test-vlox` startet nur einen Webpack-Devserver;
  `testing/Vlox`, `VloxBuilder` und `VloxFlow` sind Szenarioapps. Der
  Workflow baut/deployt eine Demo, führt aber keine Assertions aus.
- **[Inference] Bekannte Einschränkungen:** keine automatischen Tests oder
  Benchmarks; alternative Renderer und Flow-Pfade sind teilweise stale oder
  unfertig; keine dauerhafte Persistence- oder Netzwerk-Authority-Evidence.

### 4.3 AresRPG Engine

| Feld | Feststellung |
| --- | --- |
| Kanonische URL | `https://github.com/aresrpg/aresrpg-engine` |
| Commit | `db79bb97c4a4f70948f82f8da51348c047ad737b` |
| Commit-Datum | `2025-04-20T22:31:34+03:00` |
| Branch / Tag | `master` / `v2.7.15` |
| Lizenz | Keine `LICENSE`, `COPYING` oder `NOTICE`; kein `license`-Feld in `package.json` |
| Buildstatus | `NOT RUN`: `node_modules` und `dist` fehlen; Build würde Output schreiben |
| Teststatus | `NOT APPLICABLE` als automatisierte Suite: kein `test`-Script |
| Benchmarkstatus | `NOT FOUND` |
| Demostatus | `NOT RUN`: lokale Demo erwartet nicht getrackte Buildartefakte |
| Browserstatus | `NOT RUN`: kein öffentlicher Demo-Link und keine gebaute lokale Demo |

- **[Code Evidence] Untersuchte Pfade:** `README.md`, `package.json`,
  `package-lock.json`, `tsconfig.json`, `src/lib/index.ts`,
  `src/lib/libs/three-usage.ts`, `src/lib/terrain/voxelmap/**`,
  `src/lib/helpers/async/dedicatedWorkers/**`, `src/lib/physics/**`,
  `src/test/**`, `test/index.html`, `src/test/webpack.config.js`.
- **[README Claim]** `README.md:12-16` nennt das Projekt eine Voxel Engine für
  AresRPG, enthält aber außer Bildern nur `TODO: documentation`.
- **[Code Evidence]** `package.json:8-17` bietet HTTP-Server und
  Webpack-Watch-Demo, aber kein automatisiertes Testskript.
- **[Code Evidence]** `src/test/test-base.ts:10-104` und
  `src/test/main.ts:16-63` bilden eine interaktive WebGL-Demogalerie mit
  Renderloop, GUI und Stats, keine Assertion-Suite.
- **[Inference] Bekannte Einschränkungen:** Der shallow/grafted Checkout enthält
  nur HEAD; aus dem Commit-Datum kann kein Aktivitätstrend abgeleitet werden.

### 4.4 AresRPG World

| Feld | Feststellung |
| --- | --- |
| Kanonische URL | `https://github.com/aresrpg/aresrpg-world` |
| Commit | `1f75e8fbadb4b889d9bb4ef0286be9da68cc93db` |
| Commit-Datum | `2025-04-30T15:56:48Z` |
| Branch / Tag | `master` / kein Tag am HEAD |
| Lizenz | Keine `LICENSE`, `COPYING` oder `NOTICE`; kein `license`-Feld in `package.json` |
| Buildstatus | `NOT RUN`: `node_modules` und `dist` fehlen |
| Teststatus | `NOT RUN`: Script erwartet fehlendes `dist/test/noreg.test.js` |
| Benchmarkstatus | `NOT FOUND` |
| Demostatus | `NOT RUN`: WebSocket-Chunkstream ist ein PoC, keine sichtbare Demo |
| Browserstatus | `NOT APPLICABLE`: kein erreichbarer visueller Demo-Pfad nachgewiesen |

- **[Code Evidence] Untersuchte Pfade:** `README.md`, `package.json`,
  `package-lock.json`, `tsconfig*.json`, `src/index.ts`, `src/config/**`,
  `src/datacontainers/**`, `src/factory/**`, `src/processing/**`, `src/node/**`,
  `src/procgen/**`, `src/tools/**`, `src/utils/**`, `test/**`.
- **[README Claim]** `README.md:12-14` nennt das Projekt einen prozeduralen
  Terrain-Generator für AresRPG, enthält aber ebenfalls nur
  `TODO: documentation`.
- **[Code Evidence]** `test/noreg.test.ts:1-14` startet Chunk- und Blockpfade;
  `test/chunks.test.ts:20-49,95-103` und `test/utils/tests_common.ts:17-60`
  protokollieren Ergebnisse/Hashes, enthalten aber keine Assertions.
- **[Code Evidence]** `test/blocks.test.ts:5,49-53` importiert die nicht
  vorhandene Source-Datei `src/datacontainers/PatchBase.js`.
- **[Inference] Bekannte Einschränkungen:** Der Testbuild ist statisch
  wahrscheinlich defekt; ohne Ausführung ist das keine `Test Evidence`.

### 4.5 Veloren

| Feld | Feststellung |
| --- | --- |
| Kanonische URL | `https://github.com/veloren/veloren.git` |
| Commit | `754dc94c4ef05e93e45f5870d6e1de0c2cbc93cc` |
| Commit-Datum | `2026-07-11T19:17:39Z` |
| Branch / Tag | `master` / `nightly` |
| Lizenz | GPL-3.0-or-later; exakter Pfad `LICENSE`, Workspace-Metadaten in `Cargo.toml:31-35` |
| Buildstatus | `NOT RUN`: großer Rust-Workspace; `build.rs` vorab geprüft |
| Teststatus | `NOT RUN`: keine Dependencies gebaut; Tests wurden nur statisch inventarisiert |
| Benchmarkstatus | `NOT RUN`: Criterion-Benches vorhanden |
| Demostatus | `NOT RUN`: natives Gesamtspiel, kein für diesen Audit erforderlicher lokaler Start |
| Browserstatus | `NOT APPLICABLE`: keine Browserdemo des untersuchten nativen Projekts |

- **[Code Evidence] Untersuchte Pfade:** `LICENSE`, `Cargo.toml`,
  `common/build.rs`, `voxygen/build.rs`, `server/src/lib.rs`,
  `server/src/chunk_generator.rs`, `server/src/sys/msg/terrain.rs`,
  `server/src/sys/terrain.rs`, `server/src/terrain_persistence.rs`,
  `server/src/persistence/**`, `server/src/rtsim/**`, `rtsim/src/lib.rs`,
  `world/src/lib.rs`, `world/src/sim/**`, `world/src/civ/**`,
  `world/src/site/**`, `common/net/src/msg/**`, `client/src/lib.rs`,
  `world/benches/**`, einschlägige `#[test]`-Pfade.
- **[Code Evidence]** Der Cargo-Workspace trennt `client`, `common`, `network`,
  `rtsim`, `server`, `voxygen` und `world` (`Cargo.toml:3-35`).
- **[Code Evidence]** `common/build.rs` fragt nur Git-Metadaten ab;
  `voxygen/build.rs` kompiliert unter Windows Icon-Ressourcen. Beides wurde
  gelesen, aber nicht ausgeführt.
- **[Code Evidence]** Criterion-Benches für Bäume, Sites und Höhlen sind in
  `world/Cargo.toml:89-97` sowie `world/benches/tree.rs`, `site.rs` und
  `cave.rs` deklariert.
- **[Inference] Bekannte Einschränkungen:** Vorhandene Tests und Benches sind
  Struktur-, keine Ausführungsevidence. Der shallow/grafted Checkout erlaubt
  keine belastbare Aktivitätshistorie.

### 4.6 Browserprüfung

#### Voxelize / öffentliche eingebettete Demo

- **[README Claim]** `README.md:17` verlinkt `https://shaoruu.io`.
- **[Observed Demo Evidence]** Ein echter headed Chromium-Browser zeigte dort
  die Seite „Ian Huang | Building Cursor“ mit eingebetteter
  `create.town`-Voxelwelt, HUD, Chat, Weltwahl, Spieleranzeige und
  Blockauswahl. Die Welt `shaoruu` initialisierte Chunk `(0,0)`, WebSocket,
  WebRTC und einen geöffneten Data Channel.
- **[Observed Demo Evidence]** Network: `POST
  https://core.create.town/rtc/offer` → 200, eingebettete RSC-Requests und
  zahlreiche `.glb`-Assets → 200; `GET
  https://server.create.town/api/users/me` → 401 im Gastzustand.
- **[Observed Demo Evidence]** Console: ein React-Hydrationfehler `#418`,
  ungefähr 200 Warnungen, wiederholte Three.js-Shader-/Gradient-Warnungen,
  wiederholtes WebGL `GL_INVALID_OPERATION` für `glCopyTexSubImage2D` sowie
  ein fehlendes Texture-Group-Mapping `lamp_mount`.
- **[Observed Demo Evidence]** Der Wechsel zu `THE LAB` lief in einen Timeout,
  weil ein Overlay Pointer-Events abfing. Die sichtbare Hauptwelt blieb geladen.
- **[Observed Demo Evidence]** Der temporäre Screenshot liegt ausschließlich in
  `C:\tmp\external-browser-voxel-runtime-reference-audit-v1-20260713\browser-evidence\voxelize\voxelize-embedded-demo.png`;
  er ist nicht Teil des Repositories.
- **[Inference]** Die Demo beweist sichtbares Multiplayer-Voxelverhalten, nicht
  Commitidentität, Mesher-Sharing, Authority, Persistenz oder Lasttauglichkeit.

#### Divine / öffentliche Babylon-Demo

- **[Observed Demo Evidence]** Ein echter headed Chromium-Browser öffnete
  `https://divine-star-software.github.io/DivineVoxelEngine/?demo=classic`.
  Das Menü enthielt unter anderem Classic, Dream Ether, Dread Ether und Forest;
  Classic erzeugte einen sichtbaren, nichtleeren, farblich variablen Canvas.
- **[Observed Demo Evidence]** Console: Babylon.js 9.15.0, WebGL2 und Parallel
  Shader Compilation; nach dem Laden 0 Errors/Warnings. Zuvor trat nur ein
  Favicon-404 auf.
- **[Observed Demo Evidence]** Network: 141 statische Requests; alle in der
  geprüften Response-Liste angezeigten Requests antworteten mit 200.
- **[Observed Demo Evidence]** Temporäre Screenshots liegen ausschließlich in
  `C:\tmp\external-browser-voxel-runtime-reference-audit-v1-20260713\browser-evidence\divine\divine-classic.png`
  und `divine-classic-after-w.png`; sie sind nicht Teil des Repositories.
- **[Inference]** Sichtbar belegt ist der Babylon-WebGL2-Pfad. Nicht belegt sind
  Editieren/Zerstörung, langfristige Persistence, Authority oder die
  Commitidentität des Deployments.

#### Projekte ohne Browserprüfung

- **[Code Evidence]** AresRPG Engine besitzt keine gebaute lokale Demo und
  keinen öffentlichen Demo-Link; AresRPG World besitzt nur einen nichtvisuellen
  WebSocket-PoC. Browserstatus daher `NOT RUN` beziehungsweise
  `NOT APPLICABLE`.
- **[Code Evidence]** Veloren ist im untersuchten Scope ein natives Rust-Spiel
  ohne Browserdemo. Browserstatus `NOT APPLICABLE`.

## 5. Genaue Source Evidence

### 5.1 Voxelize-Pflichtaudit

#### Shared Mesher, Registry, Geometry, Greedy, AO und Licht

- **[README Claim]** `README.md:9` nennt Voxelize eine „super fast browser
  voxel engine“. Ohne aktuell reproduzierte Messung wird dieser Marketingbegriff
  nicht übernommen.
- **[Code Evidence]** Server und WASM binden dieselbe Rust-Crate:
  Root-`Cargo.toml:34-35`, `crates/wasm-mesher/Cargo.toml:12` und
  `crates/wasm-mesher/src/lib.rs:5`.
- **[Code Evidence]** `crates/mesher/src/lib.rs:4-10` exportiert Meshing-Typen
  und den abstrakten `VoxelAccess`; Entry Points in
  `crates/mesher/src/mesher.rs:2414-2469` lesen eine 3×3-Chunknachbarschaft.
- **[Code Evidence]** Blockflags, Faces, AABBs, Custom-/Dynamic-Patterns und
  Blockregistry-Daten fließen durch `crates/mesher/src/mesher.rs:8-31,510-578`
  und `server/world/voxels/block.rs:1318-1415,1635-1657`.
- **[Code Evidence]** Beliebige Rust-`dynamic_fn`-Callbacks werden bei Serde
  übersprungen; nur deklarative `dynamic_patterns` gehören zum geteilten
  Browser-/Serververtrag (`server/world/voxels/block.rs:1635-1657`).
- **[Code Evidence]** Greedy-Eignung, Achsenscans und Merge stehen in
  `crates/mesher/src/mesher.rs:948-983,1293-1578,2099-2411`.
- **[Code Evidence]** Der Merge-Key enthält AO, Licht und UV
  (`crates/mesher/src/mesher.rs:220-230`); Corner-Sampling steht in
  `:1049-1290`.
- **[Code Evidence]** Der WASM-Wrapper kopiert `Uint32Array`-Inhalte in
  wiederverwendete Rust-`Vec`s
  (`crates/wasm-mesher/src/lib.rs:37-61,82-127`). Kapazitätsrecycling bedeutet
  daher nicht zero-copy.
- **[Code Evidence]** Der Core erzeugt `Vec<f32>` und `Vec<i32>`
  (`crates/mesher/src/mesher.rs:129-139`); der Browserworker wandelt Indizes
  ohne sichtbare Bereichsprüfung in `Uint16Array`
  (`packages/core/src/core/world/workers/mesh-worker.ts:292-299`).
- **[Inference]** Der Shared Mesher ist ein isolierter Reuse-Kandidat, sofern
  ein Adapter Registry-Leakage verhindert, 16-/32-Bit-Indizes spezifiziert und
  native/WASM-Parität sowie Kopier- und Speichergrenzen misst.

#### Updates, Stages, Overflow und Netzwerkkanäle

- **[Code Evidence]** `messages.proto:19-26` definiert Chunk-ID, Meshes, Voxels
  und Lichter; `Update` und `BulkUpdate` stehen in `:58-72`. Eine Chunk-,
  Welt- oder Netzwerkrevision ist dort nicht enthalten.
- **[Code Evidence]** Der Client bündelt Updates in
  `packages/core/src/core/world/index.ts:6105-6155`; serverseitig coalesct eine
  `HashMap` Änderungen so, dass für dieselbe Position der zuletzt gestagte Wert
  gewinnt (`server/world/voxels/chunks.rs:508-529`).
- **[Code Evidence]** `VoxelDelta.sequenceId` und lokale Meshgenerationen
  schützen Clientpfade vor einzelnen Races
  (`packages/core/src/core/world/index.ts:245-255,902-925,6417-6444`), bilden
  aber keinen Reconnect-/Replay-Vertrag.
- **[Code Evidence]** `ChunkStage` benennt Nachbarschaftsradius, optionalen
  Space und Overflow als `extra_changes`
  (`server/world/generators/pipeline.rs:49-73`). Stages laufen parallel und
  kompatible Nachbarstufen werden zusammengeführt (`:305-413`).
- **[Code Evidence]** Out-of-bounds-Änderungen werden als Overflow erfasst
  (`server/world/voxels/chunk.rs:184-201`); Generierung wartet auf notwendige
  Nachbarstufen, hält `leftovers` und wendet sie vor Meshing/Speicherung an
  (`server/world/systems/chunk/generating.rs:87-253,374-406`).
- **[Code Evidence]** Entity-, Event-, Update- und Chunkkanäle sind in
  `messages.proto:34-116` getrennt. Kritische, normale und Bulk-Queues stehen
  in `server/world/messages.rs:15-61`; gleichartige Broadcasts werden in
  `server/world/systems/broadcast.rs:31-85` zusammengeführt.
- **[Code Evidence]** LZ4 komprimiert Arrays und ab 4096 Bytes auch Frames
  (`server/server/models.rs:10-37,63-77,286-316`); der Browser dekodiert Frames,
  Blocks und Typed Arrays in
  `packages/core/src/core/network/workers/decode-utils.ts:7-75,154-217`.
- **[Inference]** WebSocket-Reihenfolge innerhalb einer Verbindung ersetzt
  keine Revision, atomare Bulk-Semantik, Replay- oder Resynchronisationsgrenze.

#### Client-/Servermeshing, Persistence und planetare Grenze

- **[Code Evidence]** `client_only_meshing` ist konfigurierbar und standardmäßig
  aktiv (`server/world/config.rs:101-103,150-154`). Bei Deaktivierung mesht der
  Server mit demselben Core (`server/world/generators/mesher.rs:180-221`);
  Sending und Clientauswahl trennen Rohchunk und Mesh
  (`server/world/systems/chunk/sending.rs:37-98`,
  `packages/core/src/core/world/index.ts:4113-4121`).
- **[Code Evidence]** Der Background Saver verwendet eigenen Thread, bounded
  Channel 5000, 50-ms-Coalescing pro Chunk, zlib/Base64, `.json.tmp`,
  `sync_all` und `rename`
  (`server/world/voxels/background_chunk_saver.rs:33-184`).
- **[Code Evidence]** Chunkdateien enthalten JSON mit ID, Voxeln und Height Map;
  Nutzdaten sind zlib-komprimiert und Base64-kodiert
  (`server/world/voxels/chunks.rs:124-310`). Beschädigte Dateien können
  gelöscht und neu generiert werden.
- **[Inference]** Das Save-Muster hat keine WAL-, Schema-, Checksum-,
  Weltrevisions- oder transaktionale Entitygrenze. Bei vollem Channel können
  Saves verloren gehen; Regeneration kann Spieleränderungen verlieren.
- **[Code Evidence]** Weltgrenzen sind rechteckige X/Z-Chunkbereiche mit fixer
  Maximalhöhe (`server/world/config.rs:18-31,125-133,409-416`,
  `server/world/voxels/chunks.rs:484-488`).
- **[Code Evidence]** Keine Cube-Sphere-/Kugeltopologie, Face-Seams, Floating
  Origin, planetare LOD oder Orbit-/Surface-Transition wurde gefunden.

### 5.2 Divine-Voxel-Engine-Pflichtaudit

**[Code Evidence] Pfadkonvention:** In den Divine-Abschnitten sind unpräfixierte
Pfade wie `Contexts/**`, `World/**`, `Mesher/**` und `VoxelModel/**`
relativ zu `packages/vlox/src/`; Babylon- und Quantum-Pfade werden gesondert
benannt.

#### Worker, Data Plane und Control Plane

- **[README Claim]** `README.md:13,38-49` nennt den Kern multi-threaded und
  rendererunabhängig sowie Lighting, Flow, Power, Secondary States, Voxel Model
  System, Archiving und optional Shared Memory. Reife wird für jeden Punkt
  separat am Code bewertet.
- **[Code Evidence]** `Contexts/Render/DVERenderThreads.ts:4-18` definiert
  World-Worker, Mesher-/Generator-Pools und optional Nexus.
  `Contexts/Render/StartRenderer.ts:21-135` verbindet echte Worker, verteilt
  Settings, Tags, LUTs und Schemas und initialisiert den Rendereradapter.
- **[Code Evidence]** Rollen und Browser-/Node-Start stehen in
  `Contexts/World/StartWorld.ts:13-52`,
  `Contexts/Mesher/StartMesher.ts:16-49` und
  `Contexts/Generator/StartGenerator.ts:15-49`.
- **[Code Evidence]** Der Bootstrap exportiert Settings, Threadkonfiguration,
  Tags, Voxel-/Geometry-LUTs und Schemas
  (`Contexts/Base/DataSync/InitDataGenerator.ts:9-22`) und importiert sie in
  den Workern (`Contexts/Base/DataSync/InitDataSync.ts:15-27`). Das bildet das
  Control Plane; Sektorpuffer und Meshpakete bilden das Data Plane.
- **[Code Evidence]** Section-Views verwenden `Uint16Array` für IDs, Licht und
  Secondary State und `Uint8Array` für Level
  (`World/Section/Section.ts:50-55,112-122`). Meshdaten sind kompakte Binär-/
  Typed-Array-Pakete (`Mesher/Mesher.types.ts:2-10`,
  `Mesher/CompactedSectionVoxelMesh.ts:21-89,135-178`).
- **[Code Evidence]** Ein expliziter Chunkrevision-/Update-Sequenz-Vertrag wurde
  nicht gefunden. Locks und Task-Completion ordnen lokale Workerarbeit, nicht
  serverautoritative Commands.

#### Shared Memory an, aus und Kopierkosten

- **[README Claim]** `README.md:80-99` dokumentiert
  `useSharedMemory: false`.
- **[Code Evidence]** Default ist `true` in
  `Settings/EngineSettings.types.ts:51-54`. Fehlt `SharedArrayBuffer`, wird
  der Modus automatisch deaktiviert (`Settings/EngineSettings.ts:75-76`).
- **[Code Evidence]** Mit SAB broadcastet die World neue/entfernte Sektoren und
  Dimensionen (`World/InitTasks.ts:53-79`); Remote-Worker installieren Views
  auf denselben Puffern (`Contexts/Base/Remote/InitWorldDataSync.ts:20-31`).
- **[Inference]** Browser-SAB verlangt Cross-Origin Isolation und macht Locks,
  Lebenszeit und Synchronisierung zu expliziten Betriebsanforderungen.
- **[Code Evidence]** Ohne SAB werden Sektorpuffer ein- und ausgecheckt
  (`World/InitTasks.ts:33-49`,
  `Contexts/Base/Remote/InitWorldDataSync.ts:48-60`). Simulation serialisiert
  Mutationen über Ownership-Transfer
  (`WorldSimulation/SimulationSector.ts:74-115`).
- **[Code Evidence]** Meshing sperrt Nachbarsektoren und kopiert bis zu 27
  Section-Puffer als 3×3×3-Snapshot
  (`WorldSimulation/Tasks/WorldSimulationTasks.ts:201-222`,
  `World/SnapShot/SectionSnapShot.ts:23-30,47-116`). Der Mesher gibt Puffer an
  einen Cache zurück (`Mesher/InitTask.ts:25-40`).
- **[Code Evidence]** `World/Sector/Sector.ts:61-79` verwendet Locks mit
  10-ms-Polling.
- **[Inference]** Der SAB-freie Pfad ist real, zahlt aber Snapshotkopien,
  Ownership-Stalls und Bedarf an Backpressure; er muss zuerst gemessen werden,
  bevor SAB als Optimierung hinzukommt.

#### Archiving, Simulation, Models und authored Assets

- **[Code Evidence]** `World/Storage/WorldStorageInterface.ts:3-7` definiert nur
  `saveSector`, `loadSector`, `unloadSector`; die Implementierung wird in
  `Contexts/World/StartWorld.ts:49-52` injiziert.
- **[Code Evidence]** Archive-Tasks serialisieren/importieren Sektoren und können
  gzip nutzen (`World/Archive/InitTasks.ts:13-129`,
  `Util/BinaryObject.ts:3-17`). `World/Archive/ArchiveJSON.types.ts:19-65`
  trägt Paletten, Schemas, Flags, Zeitstempel und Sections.
- **[Code Evidence]** Kein FS-/IndexedDB-/OPFS-Backend, Atomic Replace,
  Journaling oder Save-Coalescing wurde mitgeliefert.
- **[Inference]** Archiving ist ein Serializer plus Storage-Port, keine bewiesene
  persistente Speicherlösung.
- **[README Claim]** `README.md:108` beschreibt rein JSON-basierte
  Voxelmodelle und vorgelagerte Geometry.
- **[Code Evidence]** Voxel-, Geometry-, State-, Relational- und Mod-Schemas
  stehen in `VoxelModel/VoxelModel.types.ts:19-63` und
  `VoxelModel/VoxelGeometry.types.ts:7-140`. `VoxelModel/BuildLUTs.ts:40-590`
  kompiliert sie in Paletten/LUTs; `Data/BinarySchema/BinarySchemaNode.ts:9-24`
  packt Felder bitweise.
- **[Inference]** Das ist ein starkes Konzept für authored Voxel Assets, aber
  TypeScript-Strukturtypen ersetzen keine Runtime-JSON-Validierung,
  Schema-Version oder Migrationsregeln.
- **[Code Evidence]** Secondary ID, State, Mod und Level werden in
  `Voxels/Voxel.types.ts:10-16` und
  `World/Paint/PaintVoxelData.ts:41-123` verarbeitet.
- **[Code Evidence]** Licht und AO werden in
  `Mesher/Calc/VoxelShaderData.ts:14,29-57`,
  `Mesher/Calc/ShadeRulledFace.ts:17-82` und
  `Mesher/Calc/FaceDataCalc.ts:27-63` berechnet/gepackt.
- **[Code Evidence]** Power besitzt Update-/Removal-Queues und Propagation
  (`WorldSimulation/Tasks/VoxelUpdateTask.ts:162-198`,
  `Tasks/Propagation/Power/PowerUpdate.ts:5-79`).
- **[Code Evidence]** Im Legacy-`Tasks/Propagation/Flow/FlowUpdate.ts:5-24` ist
  der zentrale Body auskommentiert. Ein neuer Tick-/Liquid-Behavior-Pfad
  existiert in `WorldSimulation/WorldSimulation.ts:141-190`,
  `TickQueue.ts:24-70` und
  `Voxels/Behaviors/Types/LiquidVoxelBehavior.ts:4-41`.
- **[Inference]** Die README-Flow-Aussage ist kein Nachweis einer vollständigen,
  getesteten Flüssigkeitssimulation.
- **[Code Evidence]** `FarmlandVoxelBehavior.ts:42` und
  `SimulationSector.ts:165-170` verwenden `Math.random`; asynchrone
  Workerordnung ist nicht über Replaytests abgesichert.

### 5.3 AresRPG: Engine, World und Generatorgrenzen

**[Code Evidence] Pfadkonvention:** In den Ares-Abschnitten bezeichnet
`engine/` den Root `aresrpg-engine/` und `world/` den Root
`aresrpg-world/`.

- **[Code Evidence]** Die Engine exportiert Renderer, Terrain Viewer, Voxel
  Viewer, Collider und Collision Queries (`aresrpg-engine/src/lib/index.ts:3-42`).
- **[Code Evidence]** World exportiert Generator-/Processing-Module,
  Chunkcontainer, WorkerPool, Procgen und Polling, aber keinen Renderer,
  Game-State oder Server-State (`aresrpg-world/src/index.ts:1-30`).
- **[Code Evidence]** Die Pakete importieren einander nicht. World kodiert ein
  Empty-Bit und 13 Datenbits in `Uint16`
  (`world/src/datacontainers/BlockDataAdapter.ts:104-118,177-243`); Engine
  besitzt ein darauf ausgerichtetes, separat definiertes Layout
  (`engine/src/lib/terrain/voxelmap/i-voxelmap.ts:37-64` und
  `encoding/voxel-encoder.ts:13-47`).
- **[Inference]** Das gemeinsame kompakte Layout ist ein gutes Datenmotiv, aber
  wegen duplizierter Definitionen kein belastbarer versionierter Wire Contract.
- **[Code Evidence]** World baut Upper-/Lower-Patches, Ground, Cave Mask und
  Items in getrennten Schritten
  (`world/src/processing/ChunksProcessing.ts:120-242`).
- **[Code Evidence]** Chunks führen einen Voxel-Margin; die Engine erwartet für
  das Meshing einen um eins vergrößerten Chunk
  (`engine/src/lib/terrain/voxelmap/viewer/voxelmap-viewer.ts:130-159,220-223`).
- **[Code Evidence]** World benutzt benannte Seeds mit Alea/Simplex Noise
  (`world/src/procgen/NoiseSampler.ts:20-56,162-183`).
- **[Inference]** Identische Eingaben wirken deterministisch, aber es fehlen
  ausgeführte plattformübergreifende Golden Tests.
- **[Code Evidence]** Der CPU-Mesher entfernt verdeckte Faces und berechnet AO
  aus drei Nachbarvoxeln
  (`engine/src/lib/terrain/voxelmap/voxelsRenderable/voxelsRenderableFactory/cpu/voxels-renderable-factory-cpu.ts:242-316`).
- **[Code Evidence]** Das als Greedy Meshing bezeichnete Verfahren verbindet
  kompatible Faces nur entlang X und schließt Left/Right aus (ebenda:123-187).
- **[Inference]** Das ist kein vollständiger zweidimensionaler Greedy-Sweep je
  Achse.

### 5.4 Veloren: gezielter Authority-/World-Audit

- **[Code Evidence]** Der Server erzeugt und besitzt State, World, Index und
  Datenbank (`server/src/lib.rs:239-322`).
- **[Code Evidence]** Der zentrale Server-Tick ordnet Input, Events,
  Clientnachrichten, State-/Terrainarbeit, Synchronisation und Persistence
  explizit (`server/src/lib.rs:780-834`).
- **[Code Evidence]** Die Worldgeneration ist seedbasiert und stufig; Simulation,
  Zivilisationen, Ökonomie und Spots entstehen vor Chunk-Details
  (`world/src/lib.rs:102-162`).
- **[Code Evidence]** `server/src/chunk_generator.rs:21-95` führt langsame
  Chunkarbeit asynchron aus, dedupliziert Pending-Anfragen und unterstützt
  Abbruch.
- **[Code Evidence]** Der Client sendet begrenzte Chunkanfragen
  (`client/src/lib.rs:2592-2615`); der Server validiert die Sichtdistanz und
  liefert vorhandene Chunks oder reiht Generierung ein
  (`server/src/sys/msg/terrain.rs:55-155`).
- **[Code Evidence]** Terrainänderungen entstehen mit `Origin::Server`, werden
  persistent ergänzt, in den Terrain-State eingesetzt, verteilt und können
  Entities spawnen (`server/src/sys/terrain.rs:100-180`).
- **[Code Evidence]** Unload-Arbeit wird über mehrere Ticks verteilt; große
  Freigaben laufen im Hintergrund (`server/src/sys/terrain.rs:329-408`).
- **[Code Evidence]** Der Server sendet Chunks und Blockupdates über explizite
  Messages (`common/net/src/msg/server.rs:143-202`); der Client setzt Chunks ein
  und wendet dekomprimierte Updates an (`client/src/lib.rs:3103-3121`).
- **[Code Evidence]** Temperatur, Feuchte, Höhe, Bewuchs und Flüsse bestimmen
  Biome (`world/src/sim/mod.rs:2793-2823`).
- **[Code Evidence]** Zivilisationen und Sites werden aus einem Seed mit
  `ChaCha` erzeugt (`world/src/civ/mod.rs:229-275,471-590`); Site-Arten stehen in
  `world/src/site/mod.rs:106-132`.
- **[Inference]** Übertragbar sind die Authority- und Lifecycle-Muster, nicht
  Velorens Renderer, ECS oder Gesamtspiel.

## 6. Worker-Topologien

### 6.1 Voxelize

**[Code Evidence]**

```text
Browser World
  -> ChunkPipeline
  -> MeshPipeline
       -> normaler Mesh-Pool: bis min(hardwareConcurrency, 4)
       -> dringender Mesh-Pool: 1..4 Worker
  -> Light Worker Pool
  -> Network Decode: Priority-INIT + allgemeiner Decode-Pool

Server World
  -> Generation Stages -> Rayon
  -> Shared Mesher -> Rayon
  -> Update Staging / Broadcast Encoding
  -> Background Saver -> eigener Thread + bounded Channel
```

- **[Code Evidence]** Der generische Pool ist FIFO, erzeugt Worker früh und
  transferiert normale `ArrayBuffer`; `SharedArrayBuffer` kommt nicht in die
  Transferliste (`packages/core/src/libs/worker-pool.ts:39-48,77-163`).
- **[Code Evidence]** World-Defaults und getrennte normale/dringende Mesherpools
  stehen in `packages/core/src/core/world/index.ts:360-387,495-505,889-960`.
- **[Code Evidence]** `MeshPipeline` führt `generation`,
  `inFlightGeneration` und `displayedGeneration`; veraltete Resultate werden
  verworfen, dringende Keys zuerst abgearbeitet
  (`packages/core/src/core/world/pipelines.ts:160-307`).
- **[Code Evidence]** Clientedits markieren Chunk, Nachbarn und Subchunk-Level
  als dringend (`packages/core/src/core/world/index.ts:6385-6414`).
- **[Inference]** Lokale Generation Tokens und ein begrenzter Fast Path sind
  direkt übertragbar. Für Weltraum-Spiel fehlen zusätzlich autoritative
  Revision, Deadline, Backpressure und Cancel/Reject über Netzwerkgrenzen.

### 6.2 Divine Voxel Engine

**[Code Evidence]**

```text
Renderer Host
  -> World Worker (lokaler Zustandsbesitzer / Orchestrator)
       <-> Generator Worker Pool
       <-> Mesher Worker Pool
       <-> optional Nexus
  -> kompakte Meshpakete
  -> DVERenderer Adapter
       -> Babylon konkret | Three stale | Quantum experimentell

SAB an: gemeinsame Sektorpuffer + Remote Views + Locks
SAB aus: Check-out/Check-in Ownership + 3x3x3 Mesh-Snapshot
```

- **[Code Evidence]** Die direkten Portverbindungen und der Bootstrap sind in
  `Contexts/Render/StartRenderer.ts:21-135`; Rollen starten über
  `StartWorld.ts`, `StartGenerator.ts` und `StartMesher.ts`.
- **[Code Evidence]** Generate/Decorate/Propagation/Sun nutzen den ownership-
  basierten Simulationspfad in
  `WorldSimulation/Tasks/WorldSimulationTasks.ts:59-166`.
- **[Code Evidence]** Kompakte Mesh-`ArrayBuffer` werden transferiert; bei
  nicht CPU-bound Renderern kann der Ursprungspool sie zurückerhalten
  (`Mesher/InitTask.ts:14-38`, `Renderer/InitTasks.ts:11-15`).
- **[Inference]** DVE zeigt eine brauchbare Host-/Worker-Rollentrennung und
  Buffer-Recycling. Polling/Task-Completion ohne Revision darf nicht als
  Authority- oder Konsistenzmodell übernommen werden.

### 6.3 AresRPG

**[Code Evidence]**

```text
Browser main                         Node host
  -> priorisierter WorkerPool          -> NodeWorkerPool
  -> WorkerProxy                       -> worker_threads
  -> world_compute_worker              -> world_compute_node_worker
            \                         /
             -> WorldWorker.onMessage
             -> WorldModules je Worker
             -> Chunk/Item/Block Handler

VoxelmapViewer
  -> CPU mono | CPU WorkerPool | GPU
  -> least-pending DedicatedWorker
  -> CPU-Mesher
  -> transferierter Uint32-Meshoutput
  -> Three.js BufferGeometry
```

- **[Code Evidence]** Browser und Node rufen denselben Handler auf
  (`world/src/processing/world_compute_worker.ts:11-29`,
  `world/src/node/world_compute_node_worker.ts:1-23`,
  `world/src/processing/WorldWorker.ts:7-44`).
- **[Code Evidence]** World sortiert Tasks nach `rank`; `ChunksPolling`
  priorisiert Distanz, verschiebt Untergrund-Chunks außerhalb der Near Range
  und storniert entfernte Arbeit (`world/src/processing/WorkerPool.ts:53-115`,
  `world/src/tools/ChunksPolling.ts:21-30,89-141`).
- **[Code Evidence]** World verwendet keine Transferlisten, kein
  `SharedArrayBuffer` und keine `Atomics`
  (`world/src/processing/WorkerProxy.ts:31-85`).
- **[Inference]** Typed Arrays und Blobs werden daher zwischen Threads kopiert;
  das begrenzt hochfrequente destruktive Updates.
- **[Code Evidence]** Die Engine nutzt standardmäßig drei CPU-Worker und wählt
  den mit den wenigsten Pending Tasks
  (`engine/src/lib/terrain/voxelmap/viewer/voxelmap-viewer.ts:18-36,65-108`,
  `engine/src/lib/helpers/async/dedicatedWorkers/dedicated-workers-pool.ts:16-43`).
- **[Code Evidence]** Der Worker transferiert den erzeugten `Uint32Array`-
  Buffer zurück, die Eingabe aber ohne Transferliste
  (`engine/src/lib/terrain/voxelmap/voxelsRenderable/voxelsRenderableFactory/merged/cpu/voxels-renderable-factory-cpu-worker.ts:32-52`,
  `engine/src/lib/helpers/async/dedicatedWorkers/dedicated-worker.ts:166-175`).
- **[Code Evidence]** Workerfunktionen werden serialisiert und im Worker mit
  `eval` ausgewertet (`voxels-renderable-factory-cpu-worker.ts:34-49`).
- **[Inference]** Das ist ein CSP- und Wartungsrisiko und kein übernehmbares
  Worker-Bootstrapmuster.

### 6.4 Veloren

**[Code Evidence]**

```text
Client ChunkRequest
  -> Server validiert View Distance / vorhandenen State
  -> deduplizierte SlowJob-Chunkgeneration
  -> serverseitige Terrain-/Persistence-Anwendung
  -> Chunk/BlockUpdate Message
  -> Clientcache und Renderer-Derived-State
```

- **[Code Evidence]** Die klare asynchrone Grenze und deduplizierte Pending-
  Map stehen in `server/src/chunk_generator.rs:21-95`.
- **[Inference]** Das ist keine Browser-Worker-Topologie, aber ein gutes
  serverseitiges Control-Plane-Muster für teure, abbrechbare Chunkarbeit.

## 7. Data Plane vs. Control Plane

### 7.1 Befunde

**[Inference]** Die Tabelle verdichtet die anschließend genannten
Sourcebefunde und ihre Übernahmebewertung.

| Projekt | Data Plane | Control Plane | Bewertung |
| --- | --- | --- | --- |
| Voxelize | `Uint32` Voxel/Licht, protobuf, LZ4, Transferables, kompakte Meshes | Interest, Stagequeues, normal/dringend, lokale Meshgeneration, Events/Entities/Bulk | starke Muster; eigene Revisionen und Formate nötig |
| Divine | Section-Typed-Arrays, optional SAB, Ownership-Snapshots, kompakte Meshpakete | Workerports, Tasks, Settings/Tags/LUT-/Schema-Bootstrap, Locks/Check-in | rendererneutral; ohne Netzwerk-Authority und Revision |
| AresRPG | `Uint16`-Chunks, Bounds/Margin, gzip/Blob; gepackter `Uint32`-Meshoutput | `handlerId`, `taskId`, Rank, Near/Far/Cancel | gute Trennungsidee, aber ohne Schema- und Chunkrevision |
| Veloren | serverseitiges Terrain, Chunk-/Blockupdates, persistierte Deltas | validierte Requests, deduplizierte Generation, Tickordnung, Sync/Persistence | starke Authority-Grenze; nicht browsernah |

- **[Code Evidence]** Voxelize verwendet `Uint32Array` für Voxel/Licht
  (`packages/core/src/core/world/raw-chunk.ts:47-61`) und liefert
  `Float32Array`, `Uint16Array` und `Int32Array` aus dem Worker
  (`packages/core/src/core/world/workers/mesh-worker.ts:292-328`).
- **[Code Evidence]** Transfermodus `transfer`, `shared` oder `auto` steht
  in `packages/core/src/libs/worker-transfer.ts:3-5,65-105`; SAB wird nur mit
  vorhandenem `SharedArrayBuffer` und `crossOriginIsolated` benutzt
  (`chunk-shared-pool.ts:43-48`).
- **[Code Evidence]** Selbst Shared-Daten werden bei der Raw-Chunk-
  Deserialisierung in lokale Arrays kopiert
  (`packages/core/src/core/world/raw-chunk.ts:135-190`), danach folgt die
  WASM-Kopie. Es gibt keine durchgängige zero-copy Pipeline.
- **[Inference]** 512 Defaultslots × 16×256×16 Voxels × zwei `u32`-Arrays
  ergeben rechnerisch 256 MiB Reservierung
  (`packages/core/src/libs/chunk-shared-pool.ts:17`). Gerätebudget und
  Capability Negotiation sind daher Pflicht.
- **[Code Evidence]** Divine legt je nach Setting `SharedArrayBuffer` oder
  `ArrayBuffer` an (`World/Sector/Sector.ts:43-46`) und hält kompakte
  Section-/Meshformate unabhängig vom Renderer.
- **[Inference]** DVE trennt Daten- und Control Plane klarer als Ares und
  Voxelizes Three-gebundene World-Schicht, besitzt aber keinen netzwerkweiten
  Command-/Revision-/ACK-Vertrag.
- **[Code Evidence]** Ares-World speichert Typed Arrays, Bounds, Margin und Key in
  `world/src/datacontainers/ChunkContainer.ts:14-30,437-559`; gzip läuft über
  `world/src/utils/chunk_utils.ts:58-100`.
- **[Code Evidence]** Ares kontrolliert Arbeit über `handlerId`, `taskId`,
  Processing State, Rank und Timestamp Resolver
  (`world/src/processing/TaskProcessing.ts:15-40,62-85`).
- **[Code Evidence]** Ein Revisions-, Generation- oder Protokollfeld wurde in
  diesen Ares-Pfaden nicht gefunden.
- **[Inference]** Kompression und Bulk-Transport dürfen nicht zugleich
  Ordering, ACKs und Revisionen implizieren; das Control Plane muss diese
  Garantien separat und explizit definieren.

### 7.2 Empfohlener eigener Contract

**[Inference]** Weltraum-Spiel sollte die Schnittstelle besitzen, beispielsweise:

```text
VoxelChunkSnapshotV1
  worldId, planetId, localFrameId, chunkKey
  dimensions, haloWidth, voxelEncodingVersion, registryVersion
  generationEpoch, chunkRevision, typedVoxelBuffer, checksum

VoxelEditCommand
  commandId, actorId, expectedRevision, targetChunkKeys, operations, tick

VoxelUpdateResult
  commandId, accepted/rejected, reason, newRevisions, orderedUpdateSequence

MeshingRequest / MeshArtifact
  chunkRevision, neighborRevisions, registryVersion
  typed vertices/indices/material ranges/bounds, no Three.js objects
```

- **[Inference]** Die World-/Server-Authority entscheidet über Commands und
  Revisionen. Worker besitzen nur Jobs und verwerfen Resultate, wenn Revision,
  Generation oder Registry nicht mehr passen.
- **[Inference]** Dringende Arbeit (sichtbare Editfolgen, Collider) und normale
  Arbeit (Prefetch, LOD, Save-Coalescing) braucht getrennte, begrenzte Queues;
  Priorität ersetzt keine Backpressure.

## 8. Client/Server Authority

### 8.1 Voxelize

- **[Code Evidence]** Der Server hält World State, nimmt aber in
  `server/world/mod.rs:1811-1843` Einzel-/Bulkupdates an, ignoriert die
  Client-ID und prüft im Wesentlichen nur Weltgrenzen.
- **[Code Evidence]** Im untersuchten Pfad fehlen Ownership/Rolle, Editreichweite,
  Werkzeug-/Ressourcenvalidierung, Rate Limit, erwartete Chunkrevision,
  Konfliktprüfung und Command-/Result-Korrelation.
- **[Inference]** Voxelize ist eine servergehostete Welt, aber kein direkt
  übernehmbarer sicherer serverautoritärer Editvertrag. Weltraum-Spiel muss
  validierte Commands statt rohe Voxelwerte akzeptieren.

### 8.2 Divine Voxel Engine

- **[Code Evidence]** Die World-Rolle ist lokaler Zustandsbesitzer und
  Orchestrator. Node wird in `Contexts/World/StartWorld.ts:17-21` nur als
  Parent `server` bezeichnet.
- **[Code Evidence]** Kein WebSocket-/Replikations-, Command-Ack-,
  Berechtigungs- oder Chunkrevision-Code wurde in den untersuchten Pfaden
  gefunden.
- **[Inference]** Worker-Ownership ist keine Netzwerk-Authority. DVE kann
  höchstens unterhalb einer eigenen Game-/World-/Server-Authority eingesetzt
  werden.

### 8.3 AresRPG

- **[Code Evidence]** `ProcessingTask` nennt lokale, Worker- und Remote-
  Verarbeitung, aber `request()` ist leer
  (`world/src/processing/TaskProcessing.ts:62-65,130-185`).
- **[Code Evidence]** Der WebSocket-Code ist ausdrücklich ein PoC: er nimmt
  `viewPos/viewRange`, generiert Chunks und sendet Blobs
  (`world/test/tools/chunks_over_ws_server.ts:1-54`).
- **[Inference]** Ohne Identität, Berechtigung, Mutationscommand, Revision,
  Konfliktauflösung und Recovery belegt der PoC keine Server Authority.

### 8.4 Veloren

- **[Code Evidence]** World State, Terrainentstehung und Chunkverteilung sind
  serverseitig geordnet (`server/src/lib.rs:780-834`,
  `server/src/sys/terrain.rs:100-180`).
- **[Code Evidence]** Vollständige Player-Physics-Authority ist jedoch opt-in;
  `common/src/resources.rs:113-152` bezeichnet die aktuelle Trennung als
  Zwischenlösung. `server/src/sys/msg/in_game.rs:141-159` akzeptiert abhängig
  von Konfiguration clientseitige Physics-Updates.
- **[Inference]** Veloren ist deshalb eine starke World-State-, aber im
  untersuchten Default keine vollständige Character-Physics-Authority-Referenz.

### 8.5 Ziel für Weltraum-Spiel

- **[Inference]** Der Client darf Chunks anfordern, vorhersagen und meshen, aber
  nicht die dauerhafte Weltwahrheit definieren.
- **[Inference]** Der Server akzeptiert oder verwirft Voxelcommands gegen eine
  erwartete Revision und sendet eine geordnete, idempotent anwendbare Folge.
- **[Inference]** Ein Client-Mesh ist Derived State. Ein optional vom Server
  geliefertes Mesh ist ein Cache-/Kompatibilitätsartefakt, niemals Ersatz für
  autoritative Voxeldaten und Revisionen.

## 9. Persistence Patterns

### 9.1 Voxelize

- **[Code Evidence]** Persistence ist standardmäßig deaktiviert; Saveintervall
  ist 300 Sekunden (`server/world/config.rs:86-103,150-154`).
- **[Code Evidence]** Der bounded Background-Thread coalesct Snapshots, schreibt
  Temp-Datei, `sync_all` und `rename`
  (`server/world/voxels/background_chunk_saver.rs:33-184`).
- **[Inference]** Übertragbar sind Background Save, begrenzte Queue, Coalescing
  und Tempwrite. Vor Produktnutzung fehlen Journal/Delta-Log, Version, Checksum,
  Weltrevision, Parent-Directory-Fsync, plattformdefinierter Atomic Replace und
  Recoverytests. Ein voller Channel darf keine bestätigten Edits verlieren.

### 9.2 Divine Voxel Engine

- **[Code Evidence]** DVE trennt Archive-Serializer von einem injizierten
  `WorldStorageInterface`, liefert aber kein dauerhaftes Backend, keinen
  Atomic Replace und kein Coalescing.
- **[Inference]** Übertragbar sind versionierbare Archive mit Paletten/Schemas
  und ein Storage-Port. Die eigentliche Haltbarkeit bleibt vollständig eigene
  Verantwortung.

### 9.3 AresRPG

- **[Code Evidence]** In den untersuchten produktiven Pfaden wurden keine
  Datenbank-, Snapshot-, Journal- oder Save/Load-Pfade für World State gefunden.
- **[Code Evidence]** `world/src/tools/SchematicLoader.ts:12-117` importiert
  authored NBT/Schematic-Daten und mappt sie auf Chunks.
- **[Inference]** Asset-Ingestion ist keine World Persistence.

### 9.4 Veloren

- **[Code Evidence]** Terrain Persistence ist standardmäßig kompiliert, aber
  zur Laufzeit experimentell und mit Warnung versehen
  (`server/Cargo.toml:10-19`, `server/src/lib.rs:403-419`).
- **[Code Evidence]** Sie speichert pro Chunk Abweichungen vom regenerierbaren
  Basiszustand, hält sie in einem LRU und wendet sie beim Generieren wieder an
  (`server/src/terrain_persistence.rs:23-96`).
- **[Code Evidence]** Die Implementierung schreibt nur beim Unload und weist
  ausdrücklich darauf hin, dass dies bei Stromverlust nicht zuverlässig ist
  (`server/src/terrain_persistence.rs:89-95`).
- **[Code Evidence]** Korrupte Dateien werden gesichert; Schreiben verwendet
  `atomicwrites` (`server/src/terrain_persistence.rs:116-197`).
- **[Code Evidence]** Charakterdaten verwenden eine Datenbank mit Migrationen
  unter `server/src/persistence/**`.
- **[Code Evidence]** RTSim-Snapshots laufen über einen Hintergrundthread und
  `atomicwrites`; Version-Mismatch oder defekte Daten führen zu Backup und
  Neuaufbau (`server/src/rtsim/mod.rs:5-148`). Speichern wird etwa alle 60
  Sekunden angestoßen (`server/src/rtsim/tick.rs:539-547`).
- **[Code Evidence]** RTSim unterscheidet persistierte/simulierte von geladenen
  NPCs (`server/src/rtsim/tick.rs:594-704`, `rtsim/src/lib.rs:44-105`).
- **[Inference]** Übertragbar sind Delta-gegen-deterministische-Basis,
  Versionsheader, Hintergrundsave, Temp-/Atomic-Replace und Corrupt-Backup.
  Nicht zu übernehmen ist die schwache Haltbarkeitsgarantie „erst bei Unload“.

### 9.5 Empfohlenes Muster

- **[Inference]** Akzeptierte Commands oder Deltas brauchen zunächst eine
  dauerhafte, geordnete Commitgrenze; coalescte Hintergrundsnapshots sind eine
  zusätzliche Beschleunigung, kein Ersatz dafür.
- **[Inference]** Save-Coalescing und Netzwerk-Coalescing sind getrennte
  Entscheidungen. Beide behalten die höchste enthaltene Revision und klare
  ACK-/Recovery-Semantik.
- **[Inference]** Ein Snapshot wird mit Schema-/Registry-/Generation-Version
  und Checksumme in eine Temp-Datei geschrieben, geflusht und atomar ersetzt;
  beim Start werden unvollständige oder korrupte Versionen isoliert.

## 10. Mesher Sharing und Renderer Coupling

### 10.1 Voxelize

- **[Code Evidence]** Der Rust-Mesher liefert rendererneutrale Attributarrays
  und wird nativ/WASM geteilt; dieser Kern ist wesentlich schmaler als die
  Browser-`World`-Klasse.
- **[Code Evidence]** `@voxelize/core` hängt dagegen direkt von Three.js und
  Postprocessing ab (`packages/core/package.json:37-51`) und baut
  `BufferGeometry`, `Mesh`, Attribute, Materialien und Schatten in
  `packages/core/src/core/world/index.ts:4580-4817`.
- **[Inference]** Der Mesher kann hinter `MesherPort -> MeshBuffers` untersucht
  werden; `@voxelize/core` und `World` sind keine geeignete Domänen- oder
  Rendererbasis.
- **[Inference]** Client-only Meshing bleibt Default; server-provided Meshing ist
  optionaler Cache/Fallback mit Capability- und Formatversion, nie kanonischer
  World State.

### 10.2 Divine Voxel Engine

- **[Code Evidence]** `Renderer/DVERenderer.ts:3-5` abstrahiert
  `sectorMeshes` und `init`; `Renderer/Classes/DVESectionMeshes.ts:3-9`
  kapselt Meshupdate/Rückgabe, `Renderer/MeshManager.ts:16-52` dekodiert den
  kompakten Output und ruft den Adapter.
- **[Inference]** Diese schmale Grenze eignet sich konzeptionell für einen
  eigenen Three.js-Adapter. DVE-spezifische Vertex-, Material-, Licht- und
  AO-Semantik bleibt jedoch hohe Integrationsarbeit.
- **[Code Evidence] Babylon-Status:** Das Submodul `vlox-babylon` implementiert
  den Adapter in `DVEBabylonRenderer.ts:24-64`, wählt Single-/Multi-Buffer und
  besitzt Classic-/PBR-Demos. Die Browserprüfung belegt den sichtbaren
  Babylon-WebGL2-Pfad.
- **[README Claim] Three-Status:** `README.md:66-75` führt Three unter „In Dev
  Packages“ und nennt längere Nichtbearbeitung.
- **[Code Evidence] Three-Status:** Ein
  `packages/vlox-three`-Submodul beziehungsweise Source-/Testnachweis fehlt.
- **[Code Evidence] WebGPU-/Quantum-Status:** Paketversion 0.0.0;
  `testing/Vlox/src/QuantumApp.ts:1-102` ist auskommentiert,
  `DVEQuantumRenderer.ts:39` hat leeres `init`, und
  `Engine.ts:13-24` verlangt WebGPU, `shader-f16` und hohe Bufferlimits.
- **[Inference]** Babylon ist der einzige konkret belegte Adapter; Three ist
  stale, Quantum/WebGPU experimentell. Keiner wird als Produktbasis übernommen.
- **[Code Evidence]** Im untersuchten Divine-Mesher wurde kein Greedy-Meshing-
  Nachweis und keine Performance-Messung gefunden.

### 10.3 AresRPG

- **[Code Evidence]** Das Meshformat ist direkt auf Three.js
  `InterleavedBuffer`, `BufferGeometry`, `Group`, `MeshPhongMaterial` und
  `ShaderMaterial` ausgerichtet
  (`engine/src/lib/terrain/voxelmap/voxelsRenderable/voxelsRenderableFactory/merged/voxels-renderable-factory.ts:44-51,308-315,393-410`,
  `engine/src/lib/terrain/voxelmap/viewer/voxelmap-viewer-base.ts:30-90`).
- **[Code Evidence]** Selbst World hat Three.js als Peer Dependency und nutzt
  `Vector2`, `Vector3`, `Box2` und `Box3` in Generator-/Daten-APIs
  (`world/package.json:47-49`, `world/src/procgen/NoiseSampler.ts:1-9`).
- **[Inference]** Das ist für eine eigene Three.js-Adaptergrenze ungeeignet.
  Chunk-, Generator- und Meshverträge sollen nur Primitive und Typed Arrays
  enthalten; Three.js entsteht erst im Rendereradapter.

### 10.4 Eigenes Sharing-Ziel

- **[Inference]** Ein geteilter Mesher muss eine pure Funktion des versionierten
  Chunk-Snapshots, des Ein-Voxel-Halos, der Block Registry und der
  Mesherkonfiguration sein. Native Server- und WASM-Browser-Ausgaben werden mit
  Golden Hashes und normalisierten Float-/Indexregeln verglichen.
- **[Inference]** Client-only Meshing ist für Interaktion und Skalierung der
  sinnvolle Default. Server-provided Meshing kann als optionaler Fallback oder
  Cache hinter demselben `MeshArtifact`-Contract existieren.
- **[Inference]** Greedy Meshing, AO und Beleuchtung sind Derived State. Ihre
  Änderungen dürfen weder Chunkrevisionen noch persistente Blockzustände
  mutieren.

## 11. Lokale Physik: Voxel AABB, Rapier-artig und Authority

**[Inference]** Die Tabelle ist die anforderungsbezogene Synthese der darunter
klassifizierten Source- und Dokumentationsbefunde.

| Thema | Voxel-AABB-Ansatz | Rapier-artiger Ansatz | Erforderliche Authority-Grenze |
| --- | --- | --- | --- |
| Surface Character | einfach, deterministisch gegen Grid; harte Kanten | Capsule/KCC mit Slide, Steigung, Treppe, Snap-to-ground | Game/Server validiert Bewegung und Weltrevision |
| Raycast | DDA/Gridquery direkt gegen Voxeldaten | allgemeine Ray-/Shape-Casts gegen Collider | Query ist keine Worldmutation |
| Capsule/AABB | AABB passt zu Blockwelt, Capsule meist angenehmer | Capsule/Cuboid plus Kinematic Controller | Collider ist Derived State einer Chunkrevision |
| dynamische Voxelupdates | direkte Gridquery sofort aktuell | Collider rebuild/refit nötig | Edit, Mesh und Collider über Revision koppeln |
| Fahrzeuge | kaum ausreichend | Dynamic Bodies, Joints oder Wheel-/Raycastmodell | Server/Game besitzt Zustand und Kräfte |
| zerstörbare Strukturen | einzelne Blocks abfragbar | Compound/Cluster-Collider möglich | Strukturgraph und Fragmentbildung gehören zur World/Game-Authority |

- **[README Claim]** Die offizielle Rapier-JavaScript-Dokumentation beschreibt
  den Character Controller als Shape-Cast-basiertes Move-and-Slide mit
  Steigungen, Treppen, Ground Snapping und bewegten Plattformen; Capsule,
  Cuboid und Ball werden als geeignete Shapes genannt
  ([Rapier Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/)).
- **[README Claim]** Rapier dokumentiert Raycasts und weitere Scene Queries
  separat
  ([Rapier Scene Queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/))
  sowie dynamische, feste und kinematische Rigid Bodies
  ([Rapier Rigid Bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)).
- **[Code Evidence]** Voxelizes
  `packages/physics-engine/src/index.ts` fragt Block-AABBs per Callback ab und
  implementiert Sweep, Reibung, Flüssigkeit und Autostep; Autostep beginnt unter
  anderem in `:179-187` und den Bewegungsroutinen ab etwa `:625`.
- **[Code Evidence]** `packages/raycast/src/index.ts:62-164` führt DDA durch
  Voxels und prüft AABB-Treffer. Damit folgen Raycast und Kollision aktuellen
  Blockdaten ohne kompletten Triangle-Mesh-Rebuild.
- **[Code Evidence]** Serverseitig verwendet
  `server/world/physics/mod.rs:1-125` Rapier-Sets und Capsule-Collider für
  Entitykontakte; Bewegung gegen Voxeloberflächen bleibt eigene AABB-/Sweep-
  Integration (`:165-311`).
- **[Inference]** Voxelize ist damit eine gute Surface-Character-/Raycast-
  Referenz und reagiert natürlich auf statische Voxeländerungen. Capsule gegen
  Terrain, Fahrzeuge, dynamische Rigid Bodies und bewegliche zerstörbare
  Strukturen sind keine vollständige Lösung.
- **[Code Evidence]** Ares bietet `NOT_LOADED`, Raycast, Sphere Intersection und
  kinematische Bewegung mit Radius, Höhe, Gravitation und Ground-State
  (`engine/src/lib/physics/voxelmap-collisions.ts:15-87,158-170,308-370`).
- **[Code Evidence]** `VoxelmapCollider.setChunk` ersetzt Chunkdaten und kann sie
  als Bitset komprimieren, besitzt aber weder Revision noch öffentliche
  Delete-/Unload-Grenze (`engine/src/lib/physics/voxelmap-collider.ts:148-237`).
- **[Inference]** Dynamische Edits müssen Worldrevision, Remeshing und
  Collider-Neuaufbau gemeinsam adressieren; veraltete Mesher- oder
  Physikresultate werden verworfen.
- **[Inference]** Fahrzeuge und zerstörbare Verbundkörper erfordern dynamische
  Bodies beziehungsweise einen expliziten Struktur-/Clustergraphen. Weder ein
  AABB-Character-Controller noch ein Mesher entscheidet, welche Fragmente
  autoritativ existieren.
- **[Inference]** Orbitalphysik bleibt getrennt: sie arbeitet mit anderen
  Größenordnungen, Integrationsschritten, Referenzsystemen und
  Präzisionsanforderungen. Die Verbindung ist ein lokaler Surface Frame
  beziehungsweise Floating-Origin-Adapter, nicht ein gemeinsamer Collider-
  oder Timestep-Kern.

## 12. Geeignete Ideen für Weltraum-Spiel

1. **[Inference] Eigener versionierter Chunkcontract.** Typed Arrays,
   Ein-Voxel-Halo, Block-Registry-Version, Generation Epoch, Chunkrevision und
   Checksumme sind die gemeinsame Grenze für Generator, Mesher, Netzwerk,
   Persistence und lokale Physik.
2. **[Inference] Gemeinsamer reiner Rechenkern, getrennte Hosts.** Browser
   Worker, Node/Server und optional WASM teilen Algorithmus und Fixtures, aber
   nicht DOM-, Three.js- oder globale Engineobjekte.
3. **[Inference] Explizites zweistufiges Worker-Control-Plane.** Urgent/normal,
   begrenzte Pools, Abbruch, Backpressure und stale-result rejection anhand
   von Revision und Generation.
4. **[Inference] Renderer als Derived-State-Adapter.** Der Three.js-Adapter
   übernimmt Typed Meshartefakte; er besitzt keine Weltwahrheit.
5. **[Inference] Deterministische Basis plus persistierte Änderungen.** Eine
   seedbasierte Grundwelt reduziert Speicher, während Commands/Deltas und
   crash-sichere Snapshots die zerstörbare dauerhafte Welt tragen.
6. **[Inference] Loaded/Unknown/Solid als Physikvertrag.** Lokale Queries müssen
   ungeladene Bereiche explizit melden, statt sie still als leer zu behandeln.
7. **[Inference] Dynamische Entities über Load/Simulate-Unload-Brücke.** Das
   Veloren-Motiv einer groben weiterlaufenden Simulation wird als eigener
   World-Service behandelt, nicht als Rendererfeature.
8. **[Inference] Authored Assets nur über Importadapter.** JSON-, Schematic-
   oder andere Voxelmodelle werden validiert und in den internen Registry-/
   Chunkcontract normalisiert; das externe Schema wird nicht Runtime-Truth.

## 13. Nicht geeignete Ideen

- **[Inference]** Eine fremde Engine, ihr ECS oder ihr Renderer als neue
  Gesamtbasis.
- **[Inference]** Three.js-/Babylon-/WebGPU-Objekte in World-, Network- oder
  Persistence-Verträgen.
- **[Inference]** Timestamp-only Requestkorrelation, `eval`-basierte Worker oder
  unversionierte Blob-/gzip-Nachrichten.
- **[Inference]** Clientmesh, Demo-Sichtbarkeit oder Screenshot als Beleg für
  Authority, Determinismus oder Persistence.
- **[Inference]** Shared Memory als unbemerkte Pflichtvoraussetzung ohne
  Isolation-Headers, Capability Negotiation und getesteten Copy-Fallback.
- **[Inference]** Save nur beim Chunk-Unload oder Bulk-Coalescing ohne
  revisionsbezogene ACK- und Crash-Recovery-Grenze.
- **[Inference]** Lokaler Kinematic Controller als Fahrzeug-, Struktur- oder
  Orbitalphysik.
- **[Inference]** AresRPG-Source-Reuse ohne geklärte Lizenz oder Veloren-Code-
  Reuse ohne bewusste GPL-Kompatibilitätsentscheidung.

## 14. Lizenz- und Provenance-Risiken

- **[Code Evidence]** Voxelize steht unter MIT (`LICENSE`); direkte
  Wiederverwendung muss Copyright-/Lizenzhinweise erhalten.
- **[Code Evidence]** `README.md:108-111` führt separate Assetattributionen.
  Die Source-Lizenz darf nicht auf Demoassets, Texturen oder externe Modelle
  verallgemeinert werden.
- **[Inference]** Ein Mesher-Reuse inventarisiert URL, SHA, Originalpfade,
  Lizenz, lokale Änderungen, erzeugte WASM-Artefakte und transitive
  Abhängigkeiten separat.
- **[Code Evidence]** Divine Core, `vlox` und `vlox-babylon` besitzen jeweils
  MIT-Lizenzdateien. Das Quantum-Unterpaket enthält MIT-Text, nennt im Header
  jedoch fälschlich den Babylon-Renderer.
- **[Inference]** Divine-Konzepte können neu implementiert werden. Für jede
  isolierte Codekopie bleiben Notice, Originalpfad/SHA und die nicht vollständig
  auditierten Amodx-/Babylon-Abhängigkeiten gesonderte Provenancepflichten.
- **[Code Evidence]** Die untersuchten AresRPG-Commits enthalten keine
  erkennbare Projektlizenz. Lizenzen von Lockfile-Abhängigkeiten lizenzieren
  nicht den Ares-Quellcode.
- **[Inference]** AresRPG ist damit nur für allgemeines Konzeptstudium, nicht
  für Snippet- oder isolierte Source-Wiederverwendung freigegeben.
- **[Code Evidence]** Veloren steht im untersuchten Commit unter
  GPL-3.0-or-later (`LICENSE`, `Cargo.toml:31-35`).
- **[Inference]** Architekturkonzepte dürfen studiert werden; direkte
  Source-Übernahme in ein inkompatibel lizenziertes Produkt wäre ein hohes
  Compliance-Risiko und benötigt eine gesonderte Rechts-/Lizenzentscheidung.
- **[Inference]** Jeder spätere Code-Reuse-Kandidat braucht erneut URL, exakten
  SHA, Lizenzpfad, übernommenen Pfad und eine Transformations-/Provenance-Notiz.

## 15. Maximal drei spätere Spikes

1. **[Inference] VoxelChunkSnapshot-/Mesher-Parität hinter Adapter.** Einen kleinen
   versionierten Chunk mit Halo, Registry und Revision durch nativen und
   Browser-/WASM-Mesher schicken; Faces, AO, Indizes und normalisierte Hashes
   als Golden Evidence vergleichen. Keine Engine integrieren.
2. **[Inference] Authority-/Persistence-Loopback.** Voxelcommands mit erwarteter Revision,
   accept/reject, geordneter Updatefolge, Reconnect und stale-result rejection
   simulieren; Delta-Log, Coalescing und Temp-/Atomic-Replace unter erzwungenem
   Abbruch prüfen.
3. **[Inference] Surface-Physics-Adapter.** AABB/Gridquery und Rapier-artige Capsule/
   Collider gegen denselben revidierten Chunkcontract vergleichen: Raycast,
   Character, Live-Edit, ein einfaches Fahrzeug und ein zerstörbares Cluster;
   Orbital-/Surface-Frame-Brücke bleibt eine separate Schnittstelle.

## 16. Klare Empfehlung zu Voxelize und Divine

**[Inference]** Die Tabelle ist das verbindliche Abschlussurteil aus den zuvor
klassifizierten Befunden.

| Projekt | Verbindliches Projekturteil | Konkrete Empfehlung |
| --- | --- | --- |
| Voxelize | **Study and extract concepts** | Engine, `@voxelize/core` und World-Runtime nicht übernehmen. Shared Rust-Mesher nur als bedingten **Isolated code reuse candidate** hinter eigenem `MesherPort` im ersten Spike prüfen. Worker-Generation-Tokens, urgent/normal Queues, Stage-/Overflow- und Save-Muster in eigenen Contracts neu implementieren. |
| Divine Voxel Engine | **Study and extract concepts** | DVE nicht übernehmen. World-/Generator-/Mesher-Rollen, SAB-an/aus-Transport, Buffer-Recycling und Model-/State-/Mod-LUTs studieren; SAB-freien Snapshot-/Ownership-Pfad und eigene authored-Asset-Schemas hinter eigener Three.js-Grenze prototypisieren. |

- **[Inference] Voxelize:** Der Mesher ist der einzige Source-Teil mit
  plausibler isolierter Reuse-Grenze, MIT-Lizenz und belegter nativer/WASM-
  Gemeinsamkeit. Der Spike muss Registry-/Lighting-Semantik, native/WASM-
  Parität, Indexbreite, Kopierkosten, Peak Memory und Lizenzprovenance bestehen.
  Bei Leaks oder unbeherrschbaren Kosten bleibt nur Konzeptübernahme.
- **[Inference] Divine:** DVE ist als Datenarchitektur- und authored-Asset-
  Referenz stärker als als Code-Reuse-Kandidat. Eigene Versionierung,
  Runtime-Validierung, Revisionen, Authority und Persistence sind zwingend; der
  bestehende Three-/Quantum-Status rechtfertigt keine Rendererübernahme.
- **[Inference] Gemeinsame Grenze:** Beide Projekte bleiben unterhalb der
  Weltraum-Spiel-eigenen World-/Game-/Server-Authority. Planetare Adressierung,
  Orbit-/Surface-Frames, dauerhafte Commands/Deltas und Three.js-Integration
  bleiben eigene Produktverträge.
