# World Runtime Render Backend Boundary

Stand: 2026-07-13
Status: verbindliche Zielarchitektur, Docs-only, keine Runtime-Implementierung

## 1. Binding Target Decision

World State und Voxel State sind vollständig unabhängig von Three.js.
Three.js ist der aktuelle Browser-`RenderBackend`-Adapter, nicht die
World Authority und nicht das kanonische Datenformat.

Der Renderer konsumiert unveränderliche oder revisionsgebundene Snapshots,
Commands und Typed-Array-Artefakte. Keine Three.js-Klasse, kein Scene Object,
kein Material und kein GPUhandle darf in Domain-, Persistence-, Netzwerk- oder
Workerverträgen erscheinen.

Große Workerpayloads bilden eine explizite Data Plane mit Transferables. RPC
und ein möglicher Comlink-Adapter dürfen nur die kleine Control Plane
vereinfachen. Ownership, Cancellation, Deadline, Revision, Stale-Result-
Rejection, Worker-Restart und Fehlercodes bleiben eigene Produktverträge.

WASM wird nur nach Benchmark und Paritätsnachweis eingeführt. Shared Memory
bleibt optional und benötigt eine eigene COOP/COEP-, Security-, Hosting- und
Deploymentprüfung.

## 2. Current Main / Code Foundation

- [ADR-0001: Browser / Three.js Mainline](../browser-mainline/adr-0001-threejs-mainline.md)
  ist akzeptiert. Three.js rendert Snapshots; Gameplay Truth lebt im
  deterministischen Browser Core.
- [Browser Mainline Architecture](../browser-mainline/browser-architecture.md)
  definiert `world` und `render-three` als getrennte Layer und verbietet
  Rendererwissen in den Eigentümern der Wahrheit.
- [Browser Live World Presentation Truth v1](../browser-mainline/live-world-presentation-truth-v1.md)
  dokumentiert, dass sichtbare World Presentation aus einem
  Navigation-/Telemetry-Snapshot stammt und der Renderer keine zweite World
  Truth besitzt.
- **[Code Evidence]** Der Observability-Audit bestätigt für den untersuchten
  Stand einen Three.js-`WebGLRenderer`. Ein produktiver WebGPU-Backendpfad ist
  dort nicht belegt.
- Die aktuellen Browserverträge bilden eine geeignete Foundation, aber keinen
  bereits implementierten allgemeinen `RenderBackend`, Voxel-Worker-Data-Plane
  oder Shared-Memory-Pfad.

## 3. Research Evidence

Quellen:

- [Voxel Platform Reference Adoption Matrix v1](../research/voxel-platform-reference-adoption-matrix-v1.md)
- [Browser Voxel Runtime Reference Audit v1](../research/browser-voxel-runtime-reference-audit-v1.md)
- [WebGL/WebGPU Observability Tooling Audit v1](../research/webgl-observability-tooling-audit-v1.md)
- [Planet LOD & Streaming Reference Audit v1](../research/planet-lod-streaming-reference-audit-v1.md)
- [Voxel Meshing, Destruction, and Asset Audit v1](../research/voxel-meshing-destruction-asset-audit-v1.md)

**[Code Evidence]** Die Audits belegen bei Referenzprojekten schmale
Renderergrenzen, kompakte Meshpakete, native/WASM-Mesher, Transferables,
optionale Shared-Memory-Pfade und Workerrollen. Sie belegen zugleich starke
Kopplungs-, Kopier-, Lifecycle- und Stalenessrisiken.

**[Inference]** Diese Befunde begründen einen eigenen Adapter und eigene
Contracts. Sie begründen weder die Übernahme einer fremden Engine noch eine
Runtime-Abhängigkeit von Voxelize, Divine Voxel Engine, Comlink oder einem
WebGPU-Renderer.

**[Observed Demo Evidence]** Sichtbares WebGL-, Voxel- oder Planetverhalten
beweist keine rendererneutrale Domainarchitektur, keine Worker-Authority und
keine Performanceklasse.

## 4. Boundary Ownership

| Layer | Besitzt | Darf nicht besitzen |
| --- | --- | --- |
| World/Simulation | Entity-, Body-, Surface-, Semantic- und Authorityzustand; stabile IDs und Revisionen | Three.js-Objekte, GPUhandles oder sichtbarkeitsabhängige Wahrheit |
| Voxel/Structural State | kanonische Brickkanäle, Registry-/Materialversionen, Deltas und Komponenten | Rendermesh als einzige Wahrheit |
| Scheduler/Worker Control | Jobs, Priorität, Budget, Deadline, Cancellation, Restart und Resultstatus | Gameplayentscheidungen aus Rendererzustand |
| Mesher/Compiler Products | revisionierte Typed-Array-Artefakte und Bounds | Scene Attachment oder persistente World Authority |
| RenderBackend | GPUressourcen, Scenegraphprojektion, Kameras, Draw- und Uploadlebenszyklus | Mutation kanonischer World-/Voxelzustände |
| UI/Diagnostics | read-only ViewModels, Snapshots und Zähler | versteckte Authority oder Reparatur von Produktzustand |

## 5. RenderBackend Contract

Ein zukünftiger Backendvertrag konsumiert Daten, keine Domainobjekte. Mögliche
Operationen sind konzeptionell:

```text
initialize(capabilities, qualityProfile)
applyWorldSnapshot(snapshot)
upsertMeshArtifact(key, revision, buffers, bounds, materialRanges)
removeRepresentation(key, expectedRevision)
setVisibilityPlan(planRevision, visibleKeys, fallbackKeys)
setCameraProjection(frameSnapshot)
readDiagnostics()
dispose()
```

Verbindliche Eigenschaften:

- Snapshots und Commands tragen Schema-, Frame-, Planning- und
  Contentrevisionen.
- Meshartefakte bestehen aus primitiven Metadaten, Bounds und Typed Arrays.
- Materialien werden über stabile IDs oder backendneutrale Parameterprofile
  referenziert.
- `RenderBackend` bestätigt Aufnahme oder Ablehnung mit explizitem Grund.
- Scenegraph-, Shader-, Pipeline- und GPU-Cachetypen bleiben backendintern.
- Entfernen und Ersetzen sind revisionssicher und idempotent.
- Renderdiagnostics sind Beobachtung, kein Entscheidungsinput für World State.

Three.js implementiert diesen Vertrag als aktueller Adapter. Ein zukünftiger
WebGPU-, Headless- oder Testadapter muss dieselben Domaininputs konsumieren,
ohne die World-/Voxelcontracts zu ändern.

## 6. Immutable And Revisioned Inputs

Der Renderer erhält vier getrennte Inputklassen:

| Input | Inhalt | Lebensdauer |
| --- | --- | --- |
| World Presentation Snapshot | sichtbare Entities, semantische Rollen, Frames, LOD-/Fallbackplan und stabile IDs | pro World-/Planning-Revision |
| Mesh Artifact | Vertex-, Index-, Attribut- und Materialbereichsbuffer, Bounds und Quellrevision | bis ersetzt oder evicted |
| Frame Projection Snapshot | camera-relative Body-/Entityposes und aktuelle Renderframe-Revision | häufig, aber ohne Änderung dauerhafter Identität |
| Render Command | atomare Upsert-/Remove-/Visibility-/Quality-Anweisung mit erwarteter Revision | einmalig und idempotent |

Mutable Domainobjekte werden nicht an Three.js gereicht. Der Adapter darf
backendinterne Objekte mutieren, solange deren Zuordnung zu stabiler ID und
Quellrevision nachvollziehbar bleibt.

## 7. Worker Data Plane

Die Data Plane transportiert große Nutzdaten in wenigen Messages:

- Voxel-/Density-/Height-/Materialbuffer,
- Vertex-, Index-, Normal-, UV- und Materialbereichsbuffer,
- Collision-/Nav-/BVH-Artefakte,
- kompakte Bounds und Inhaltsmetadaten.

Regeln:

- Payloads verwenden `ArrayBuffer` oder dokumentierte Typed-Array-Layouts.
- Transfer Ownership wird im Jobvertrag benannt; der Sender behandelt einen
  transferierten Buffer anschließend als detached.
- Mehrere kleine Buffer werden pro Artefakt gebündelt, statt Proxyzugriffe pro
  Vertex oder Brick auszuführen.
- Input- und Outputrevision, Registry-/Mesher-/Compiler-Version und Contenthash
  begleiten die Payload.
- Kopie, Transfer und optional Shared Memory sind messbare Transportmodi, keine
  implizite Optimierung.

Data-Plane-Nachrichten enthalten keine Three.js-`BufferGeometry`, Materials,
Meshes oder Scene Nodes.

## 8. Worker Control Plane

Die Control Plane darf kleine RPC-Kommandos verwenden:

- Workerpool konfigurieren und Budgets setzen,
- Job mit ID, Schlüssel, Revision, Priorität und Deadline enqueueen,
- Job kooperativ abbrechen,
- Status und begrenzte Diagnostics lesen,
- Revision bestätigen, Ressourcen freigeben und Worker herunterfahren.

Ein möglicher Comlink-Adapter ist gemäß Adoption Matrix nur ein Spike. Der
Produktvertrag besitzt weiterhin:

- Job- und Request-ID,
- erwartete Eingangs- und Ergebnisrevision,
- Deadline und deterministischen Timeoutgrund,
- idempotentes `cancel` und bestätigten Endstatus,
- `error`-/`messageerror`-/Worker-Ende-Behandlung,
- Ablehnung aller offenen Requests bei Workerfehler,
- Restartpolicy und neue Worker-/Generation-Epoch,
- explizites Release von Proxy, Port und Worker.

Cleanup ist kein Beweis kooperativer Cancellation. Ein beendeter Workerjob darf
kein Ergebnis mehr veröffentlichen.

## 9. Result Integration And Stale Rejection

Jedes Worker- oder Compilerergebnis passiert vor Integration ein Gate:

1. Zielslot und stabile ID existieren noch.
2. Planning-/Worker-Epoch stimmt.
3. World-, Brick-, Neighbor-, Registry- und Algorithmusrevision entsprechen
   dem erwarteten Input.
4. Bufferlayout, Bounds und Indexbereiche sind gültig.
5. Das Ergebnis erfüllt den angeforderten Kanal und Quality Contract.
6. Das Backend kann die benötigte Capability unterstützen oder nennt einen
   definierten Fallback.

Ein stales Ergebnis wird nicht über neuere Daten gelegt. Es darf nur dann in
einen Cache gehen, wenn sein vollständiger Contentkey weiterhin gültig ist.
Integration und Veröffentlichung erfolgen atomar aus Sicht der sichtbaren
Repräsentation.

## 10. GPU Resource Lifecycle

GPUressourcen sind Derived State mit explizitem Owner:

- Der `RenderBackend` besitzt Buffer, Textures, Materials, Program-/Pipeline-
  Caches, RenderTargets und temporale History.
- Jede Ressource ist einem stabilen Representation Key, einer Quellrevision,
  geschätzten Bytes und einem Dispose-Grund zugeordnet.
- Parent-/Fallbackressourcen bleiben gepinnt, bis feinere Coverage bereit und
  sichtbar übernommen ist.
- Eviction entfernt keine kanonischen World-/Voxel-/Semantic-Daten.
- Ersetzen publiziert zuerst die neue gültige Ressource und entsorgt danach die
  alte nach backendgerechter Synchronisation.
- Device-/Context-Loss erzeugt einen expliziten Backendzustand; Ressourcen
  werden aus revisionierten Artefakten rekonstruiert.
- Diagnostics zählen Allocations, Uploads, Residency und Dispose-Ereignisse,
  entscheiden aber nicht über Gameplay.

Ein fehlendes `dispose` oder eine verlorene Zuordnung gilt als Lifecyclefehler,
nicht als akzeptierter Cachezustand.

## 11. Three.js Adapter Rules

Der Three.js-Adapter darf:

- `BufferGeometry`, Attribute, Materials, Meshes, Instancing und Scene Nodes
  aus backendneutralen Inputs erzeugen,
- kamera-relative Floattransforms anwenden,
- LOD-/Fallbacksichtbarkeit und Dither/Fade darstellen,
- backendinterne Caches und Drawoptimierungen führen,
- Three.js-spezifische Diagnostics bereitstellen.

Er darf nicht:

- World-, Voxel-, Entity-, Ownership- oder Persistenzzustand erfinden,
- lokale Three.js-Positionswerte als dauerhafte Koordinaten zurückschreiben,
- aus Sichtbarkeit Simulation Residency ableiten,
- aus Meshes Terrain- oder Structural State rekonstruieren,
- stille Replans, Chunkregeneration oder Editannahmen auslösen,
- Three.js-Typen über die Adaptergrenze exportieren.

## 12. WASM Introduction Gate

WASM ist eine Ausführungsoption für eng begrenzte Rechenkerne, keine
Architekturvoraussetzung. Vor Einführung sind erforderlich:

- derselbe versionierte Inputvertrag für TypeScript/Native/WASM,
- Golden-Hashes oder definierte numerische Toleranzen,
- Messung von Compile-/Init-, Kopier-, Transfer-, Laufzeit- und Peak-Memory-
  Kosten,
- Indexbreiten-, Alignment- und Bufferlayoutprüfung,
- Worker- und Main-Thread-Vergleich,
- reproduzierbarer Fallback ohne WASM,
- Lizenz- und Artefaktprovenance.

Ein README-Performanceclaim oder eine Demo rechtfertigt keinen WASM-Pfad.

## 13. Optional Shared Memory Gate

`SharedArrayBuffer` bleibt optional. Ein Shared-Memory-Pfad benötigt vor jeder
Produktfreigabe:

- nachgewiesenen Nutzen gegenüber Transferables,
- COOP/COEP- und `crossOriginIsolated`-Deploymentprüfung,
- Auswirkungen auf Embedding, Popups, CDN- und Drittressourcen,
- expliziten Owner-, Lock-, Atomics-, Lebenszeit- und Race-Vertrag,
- Capability Negotiation und funktionsgleichen Copy-/Transferfallback,
- Speicherbudget und Leak-/Restarttests,
- Security- und Privacy-Review.

Shared Memory darf nie unbemerkt zur Mindestvoraussetzung werden.

## 14. Backend Capabilities And Degradation

Beim Start meldet ein Backend nur tatsächlich unterstützte Fähigkeiten, zum
Beispiel:

- Backendidentität (`webgl2`, später eventuell `webgpu`),
- Index- und Buffergrenzen,
- Timerquery-/Diagnosticsfähigkeit,
- Instancing, Kompression und Textureformate,
- Worker-/OffscreenCanvas-Verfügbarkeit,
- unterstützte Qualitätsprofile.

World State bleibt unverändert, wenn ein Backend eine Fähigkeit nicht besitzt.
Der Scheduler wählt ein dokumentiertes Derived-Product-Fallback oder meldet
`NOT READY` beziehungsweise `UNSUPPORTED`. Er erfindet keine Worlddaten und
ändert keine Authorityrevision.

## 15. Required Invariants

- Domain-, Persistence-, Netzwerk- und Workercontracts enthalten keine
  Three.js-Objekte.
- Gleiche World-/Voxel-/Frameinputs können von mehreren Backends konsumiert
  werden.
- Floating-Origin- und Renderframewechsel ändern keine dauerhafte Identität.
- Ein stales Workerergebnis kann keine neuere Repräsentation ersetzen.
- Transfer Ownership und Bufferlebenszeit sind eindeutig.
- Backend-/Context-Loss verliert keine kanonische Weltwahrheit.
- RPC vereinfacht nur die Control Plane; große Data-Plane-Payloads bleiben
  explizit.
- WASM und Shared Memory besitzen immer einen funktionsgleichen, getesteten
  Fallback, solange keine spätere Authority etwas anderes beschließt.

## 16. Open Benchmarks / Product Questions

- Konkrete `RenderBackend`-API und Granularität von Snapshots gegenüber
  Commands.
- Bufferlayouts, Bundling, Transferkosten und Peak Memory je Artefaktklasse.
- Workerpoolgrößen, Queuebudgets, Deadline- und Restartpolicy.
- TypeScript-versus-WASM-Meshing und Datenkopien auf Zielhardware.
- Shared-Memory-Nutzen und Deploymentfolgen.
- Three.js-WebGL2-Upgradepfad und späterer WebGPU-Adapter.
- Device-/Context-Loss, atomarer Resource Swap und GPU-Fence-Strategie.
- Cachekey, GPUresidency, Eviction und Leakbudgets.
- Headless-/Testadapter für deterministische Renderplanverifikation.

Diese Fragen bleiben Benchmarks oder Produktentscheidungen. Three.js ist die
akzeptierte Mainline, aber kein unveränderlicher Domainvertrag; kein weiterer
Renderer oder Workerframework ist durch Research als Dependency beschlossen.
