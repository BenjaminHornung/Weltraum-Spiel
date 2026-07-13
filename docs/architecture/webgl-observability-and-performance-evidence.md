# WebGL Observability And Performance Evidence

Stand: 2026-07-13
Status: verbindliche Zielarchitektur, Docs-only, keine Toolintegration

## 1. Binding Target Decision

WebGL-/Browser-Observability wird nicht durch ein einzelnes Profilerwerkzeug
gelöst. Die verbindliche Kette trennt Produkttelemetrie, reproduzierbare Flows,
Browserdiagnose, WebGL-Framecapture, leichte Laufzeitindikatoren und
Heap-Retention:

- eigene Runtime Performance Telemetry besitzt Chunk-, Queue-, Worker-, Mesh-,
  Cache-, Save- und Rendererzähler,
- Playwright besitzt den reproduzierbaren Flow und die Assertions,
- Spector.js untersucht gepinnte einzelne WebGL-Frames,
- Chrome DevTools MCP untersucht Trace, Network, Console und Browserheap,
- stats-gl ist ausschließlich ein Dev-only-Indikator,
- MemLab MCP untersucht wiederholbare JS-Heap-Retention und Leakpfade.

Keines dieser Werkzeuge beweist allein funktionale Korrektheit,
Determinismus, World Authority, Produktionsfitness oder ein eingehaltenes
Performancebudget. Tooloutput wird immer mit Runtimezustand, Versionen,
Hardware, Browserbackend, Szenario und Observer-Effekt verbunden.

Dieser Planungschange erzeugt keine Binary Captures, Heapfiles, Traces, Bilder
oder Screenshots.

## 2. Current Main / Code Foundation

- [Browser Mainline Testing And Evidence](../browser-mainline/testing-and-evidence.md)
  besitzt die generischen Evidence Levels, Browser-E2E-Regeln und
  Feature-Readiness-Gates. Dieses Dokument spezialisiert sie für Streaming,
  Worker, WebGL und Memory und definiert keine konkurrierende Evidenceleiter.
- [Browser Live World Presentation Truth v1](../browser-mainline/live-world-presentation-truth-v1.md)
  koppelt sichtbare Darstellung und TestBridge-Evidence an dieselbe
  Telemetrie-/Navigation-Truth.
- **[Code Evidence]** Der Observability-Audit bestätigt im aktuellen Stand
  einen Three.js-WebGL2-Pfad, bestehende Telemetrie-/Testharnessgrundlagen und
  noch fehlende Queue-, Worker-, Upload-, Cache- und Save-Zähler im normalen
  Diagnostics Contract.
- **[Test Evidence]** Im Research-Audit wurden ein temporärer Browserbuild und
  die dort vorhandenen Tests ausgeführt. Das beweist den untersuchten
  Ausgangsstand, nicht die hier geplanten Toolintegrationen oder Budgets.
- Ein Runtime-Telemetrievertrag, Spector-Harness, Workerbenchmark und
  Streaming-Leak-Harness werden durch diese Datei nicht als implementiert
  behauptet.

## 3. Research Evidence

Quellen:

- [Voxel Platform Reference Adoption Matrix v1](../research/voxel-platform-reference-adoption-matrix-v1.md)
- [WebGL/WebGPU Observability Tooling Audit v1](../research/webgl-observability-tooling-audit-v1.md)
- [Browser Voxel Runtime Reference Audit v1](../research/browser-voxel-runtime-reference-audit-v1.md)
- [Planet LOD & Streaming Reference Audit v1](../research/planet-lod-streaming-reference-audit-v1.md)

**[Code Evidence]** Der Tooling-Audit belegt die untersuchten
Tooloberflächen, Protokolle und Grenzen. Spector.js kann WebGL-Kommandos
capturen; Chrome DevTools MCP bietet Trace-, Network-, Console- und
Heapwerkzeuge; stats-gl instrumentiert bestimmte CPU-/GPUgrenzen; MemLab
analysiert JS-Heapgraphen und Retainer.

**[Observed Demo Evidence]** Ein Spector-Capture gegen den aktuellen
Browserpfad zeigte Draw Calls, Programme und Buffer, verursachte aber einen
erheblichen Observer-Effekt und Consolewarnungen. Der Capture beweist nur die
aufgezeichnete WebGL-Kommandofolge, nicht residente Gesamtressourcen,
fehlerfreie Runtime oder Produktionsperformance.

**[Benchmark Evidence]** Für mehrere Tools fehlen reproduzierbare
Genauigkeits- und Overheadbenchmarks. Deshalb bleiben gemessene Toolwerte
Hinweise, bis ein kontrollierter Baselinevergleich ihre Bedeutung festlegt.

## 4. Tool Roles And Non-Claims

| Werkzeug | Verbindliche Rolle | Beweist ausdrücklich nicht |
| --- | --- | --- |
| Runtime Performance Telemetry | Kontinuierliche maschinenlesbare Zähler und Invarianten aus den Produktownern | Browser-Flamechart-Ursache, GL-Kommandos oder Retainerketten |
| Playwright | Gepinnter Szenarioflow, Assertions, Diagnostics-JSON, Console, Network und UI-Evidence | Main-/Worker-CPU-Flamecharts, GPU-Kommandos oder Heapdominanz |
| Spector.js | Gepinnter On-demand-Capture eines WebGL-Frames mit Commands, Draws, Programmen, State, Shadern, Texturen und Buffern | WebGPU, CPU-Tasks, JS-Heap, World Authority oder kontinuierliche Framezeit |
| Chrome DevTools MCP | Chrome Trace, Main-Thread-Diagnose, Network, Console, Screenshotoberfläche und Browserheap | deterministische Chunk-/Queuewahrheit oder vollständige WebGL-Commandliste |
| stats-gl | Dev-only-Indikator für instrumentierte Render-CPU, GPU und gegebenenfalls Compute | vollständige App-Framezeit, fachliche Queues, Retainer oder belastbares universelles CI-Budget |
| MemLab MCP | JS-Heapserien, Dominatoren, Retainer, Detached DOM und Cache-/Growth-Signale | GPU-/Driverspeicher, Uploadzeit oder fachlich korrekte Eviction |

Die Adoption Matrix klassifiziert Chrome DevTools MCP und MemLab MCP als
externe Werkzeuge. Spector.js und stats-gl bleiben Adapterspikes. Keine Zeile
fügt eine Runtime- oder Packageabhängigkeit hinzu.

## 5. Runtime Performance Telemetry

Runtime Telemetry ist die kontinuierliche, read-only Quelle für Produktzustand.
Ein versionierter Snapshot muss mindestens folgende Gruppen abdecken:

### 5.1 Identity And Provenance

- Schema- und Snapshotversion,
- Session-, Counter-Epoch-, Frame- und Simulation-Tick-ID,
- Build-/Commitidentität, soweit verfügbar,
- effektiver Rendererbackendtyp,
- Browser-, OS-, GPU-/Driver-, Auflösungs-, DPR- und Quality-Kontext für
  Performanceevidence,
- Szenario-, Seed-, Route- und Planning-Epoch.

### 5.2 World And Streaming

- aktive, sichtbare und residente Chunks/Tiles/Regions getrennt,
- LOD-, Residency-, Readiness- und Fallbackcounts,
- queued und in-flight Generation-, Mesh-, Collision-, Upload- und Savejobs,
- Cancellation-, Failure-, Retry- und stale-result Counts,
- Dirty State, Savebacklog und höchste bestätigte Revision,
- Cache Hits/Misses, Evictions, gepinnte Fallbacks und geschätzte Bytes.

### 5.3 Workers And Data Plane

- Workeranzahl und Auslastung pro Pool,
- Queue-Latenz und Jobdauer als getrennte Verteilungen,
- Copy-, Transfer- und optional Shared-Memory-Modus,
- übertragene und hochgeladene Bytes,
- Restart-, Error-, MessageError- und offene Requestcounts,
- Deadlineverletzungen und Cancellation-Latenz.

### 5.4 Rendering

- gesamte Browser-App-Framezeit an einer definierten Framegrenze,
- benannte GPU-Timingquelle oder `null` bei unsupported/disjoint,
- erzeugte Dreiecke und Uploadbytes als monotone Counter,
- aktuelle Three.js-Geometrie-, Textur- und Programmcounts, soweit öffentlich
  und backendgerecht verfügbar,
- Context-/Device-Loss, Resource-Create/-Dispose und Peak-Residency,
- größter Framespike mit Frame-ID im definierten Fenster.

### 5.5 Truth Rules

- Unsupported, disabled und disjoint sind `null` plus Grund, niemals erfundene
  Nullwerte.
- Counter sind monoton pro Counter Epoch; ein Diagnosticsreset ändert keinen
  Produktzustand.
- Polling beeinflusst weder Gameplay, LOD, Workerzahl, Queuepriorität noch
  Savepolicy.
- Normaler Diagnostics-Endpunkt und TestBridge serialisieren dieselbe Quelle.
- Keine Meshpayloads, Tokens, Header, Userstrings oder vollständigen URLs.
- Keine per-frame ungebundenen Arrays oder Strings; Fenster und Histogramme
  besitzen feste Budgets.

## 6. Runtime Performance Telemetry Protocol

Jeder Performance- oder Leaklauf definiert vorab:

1. Szenario, Seed, Route und erwartete Handoffs.
2. Browser-/Backend-/Hardware-/DPR-/Qualityprofil.
3. Warm-up-, Mess-, Settle- und Cleanup-Phasen.
4. erlaubte Queue-, Residency-, Fallback- und Saveinvarianten.
5. welche Werte deterministische Gates und welche nur Trends sind.
6. Samplingrate, Fenster, Artefaktbudget und Redaction.
7. Erfolg, Degradation und Abbruchgründe.

Hosted Runner erhalten keine absoluten GPU-ms-Gates ohne kontrollierte
Hardware. Deterministische PR-Gates prüfen Contracts, Queue-Drain,
Revisionfortschritt, Obergrenzen und Rückkehr zu einer Baseline; Hardwarewerte
werden in gepinnten Nightly-/Lab-Lanes getrendet.

## 7. Spector WebGL Capture Protocol

Spector.js wird ausschließlich gepinnt und on demand verwendet:

1. Exakten Build, Browser, WebGL-Backend, GPU/Driver, Auflösung, DPR und
   Qualityprofil protokollieren.
2. Kontrolllauf ohne Spector durchführen und Console, Network und Runtime
   Telemetry sichern.
3. Spector lokal oder über einen geprüften Adapter injizieren; keine
   Production-CDN-Injection und keine CSP-Abschwächung.
4. Einen festen, semantisch benannten Frame nach Warm-up capturen.
5. Draw Calls, Programme, State, Shader, Texturen, Buffer und beobachtete
   GL-Fehler mit klarer „capture-referenziert“-Semantik auswerten.
6. Capture-Dauer, Consoleänderungen und Observer-Effekt dokumentieren.
7. Ergebnis mit Kontrolllauf und Runtimecounts korrelieren.
8. Nur redigierte textuelle Summary als normale Evidence verwenden; rohe
   Captures bleiben sensible, kurzlebige Lab-Artefakte.

Module Worker, OffscreenCanvas, CSP, CORS und Context-Erzeugung vor Injection
sind explizite Gaps. Main-Thread-Injection beweist keine
Workerinstrumentierung. Spector ist WebGL-only; Ergebnisse werden niemals auf
WebGPU umgedeutet.

## 8. Chrome DevTools MCP Protocol

Chrome DevTools MCP ist ein externes Diagnosewerkzeug mit gepinnter Version und
ephemerem, isoliertem Browserprofil:

- Usage Statistics, CrUX und Updatechecks in reproduzierbaren oder privaten
  Läufen deaktivieren,
- Networkheader redigieren,
- Debugging nur auf Loopback und nie am normalen Benutzerprofil,
- genau ein Werkzeug besitzt die Flowsteuerung; empfohlen ist Playwright,
  während DevTools nur den begrenzten Trace-/Heapabschnitt besitzt,
- Trace, Network, Console und Runtime Telemetry über gemeinsame Marker
  korrelieren,
- Memory-Debugging nur für explizite Läufe aktivieren,
- keine unbeschränkten Pfade, unsicheren Zertifikate oder Auto-Connect-
  Funktionen als Default.

Workerereignisse können in Raw Traces liegen, besitzen im auditierten MCP aber
keine vollständige dedizierte Abfrageoberfläche. Dieser Gap bleibt sichtbar.

## 9. stats-gl Dev Indicator Protocol

Ein späterer stats-gl-Adapter bleibt standardmäßig deaktiviert und Dev-only:

- Werte werden mit effektiver Backend- und Timerqueryfähigkeit beschriftet.
- `cpu` bezeichnet nur die instrumentierte Rendergrenze, nicht die gesamte
  Browser-App-Framezeit.
- `gpu` oder `gpuCompute` ist `null`, wenn Query oder Ergebnis nicht belastbar
  ist.
- Texture Preview bleibt bei Timingläufen aus, weil Readback und Blit die
  Arbeit verändern.
- Three.js-Upgrades prüfen private oder instabile Integrationspunkte neu.
- stats-gl-Werte sind Trend-/Hinweiswerte, keine Gameplay-Truth und kein
  universelles CI-Gate.

## 10. Worker Data / Control Plane Benchmark

Der Workerbenchmark vergleicht mindestens:

- Structured Clone/Kopie,
- explizite Transferables,
- gebündelte versus viele kleine Payloads,
- optionale Comlink-Control-Plane gegenüber direktem Messageprotokoll,
- optional Shared Memory erst nach Deploymentfreigabe,
- TypeScript- gegenüber WASM-Rechenkern, falls ein WASM-Kandidat existiert.

Jeder Lauf protokolliert Payloadgröße, Queuezeit, Laufzeit, Transfer-/Copyzeit,
Peak Memory, detached Buffer, GC, Cancellation-Latenz, Deadlineverletzung,
Restart und Ergebnisrevision. Funktionale Gates beweisen Ownership,
stale-result rejection, idempotente Cancellation und Ablehnung offener
Requests bei Workerfehler.

Ein schneller RPC-Mikrobenchmark beweist keine geeignete Data Plane. Große
Voxel-, Mesh-, Collision- und BVH-Buffer bleiben explizite Transferobjekte.

## 11. Streaming Memory Leak Harness

Der Leak-Harness verwendet festen Seed, Viewport, Qualitymodus und Route. Eine
Referenzsequenz ist:

```text
Surface A warm
  -> Orbit settled
  -> Surface B settled
  -> Surface A returned
  -> repeat complete cycle multiple times
```

Vor jedem Snapshot bestätigt Runtime Telemetry:

- Generation-, Mesh-, Collision- und Uploadqueues sind im erwarteten Zustand,
- kein unerklärter Savebacklog besteht,
- Residency und Fallbacks haben die definierte Settlephase erreicht,
- Worker- und Backendlebenszyklen sind abgeschlossen.

Window- und relevante Workerheaps werden getrennt betrachtet. Erst wird die
Snapshotserie auf wiederholtes Phasenwachstum untersucht, danach werden
verdächtige Klassen über Dominatoren und Retainer analysiert. Ein einzelner
Snapshot oder ein warmer Cache ist kein Leakbeweis.

Starkes Leaksignal ist wiederholtes Wachstum derselben Phase nach gleicher
GC-/Settle-Sequenz, korreliert mit verletzten Runtimeobergrenzen oder einem
Retainerpfad. MemLab beweist Retention; Runtime Telemetry entscheidet, ob die
Ressource fachlich hätte evicted werden müssen. GPU-/Driverspeicher bleibt
außerhalb des JS-Heaps und benötigt eigene Zähler oder Backendwerkzeuge.

## 12. Evidence Provenance And Observer Effect

Jede Evidence Summary nennt:

- Datum, Branch/Commit und Buildidentität,
- Befehl, Tool und exakte Version,
- Szenario, Seed, Route und Phase,
- Browser, Backend, OS, GPU/Driver, Auflösung, DPR und Qualityprofil,
- Warm-up-/Messdauer und Sampling,
- PASS, FAIL, NOT RUN oder anderes im jeweiligen Authoritydokument erlaubtes
  Statusvokabular,
- bekannte Toolgrenzen und Observer-Effekt,
- redigierte Artefaktpfade und Retention.

Capture, Trace, Heap, Screenshot und Telemetrie können Source, URLs,
Nutzdaten oder Credentials enthalten. Synthetische Daten, restriktiver Zugriff,
kurze Retention und redigierte Summaries sind Pflicht. Binary Captures und
Bilder gehören nicht in diesen Docs-only-Planungschange.

## 13. WebGL And WebGPU Boundary

| Evidence | WebGL2 | Späterer WebGPU-Pfad |
| --- | --- | --- |
| Backendidentität | WebGL-Kontext plus effektiver Three.js-Backendtyp | Explizit melden, einschließlich möglichem WebGL2-Fallback |
| GPU-Commandcapture | Spector.js, gepinnt und on demand | Im auditierten Set kein gleichwertig belegter Command-Debugger |
| Browser-CPU/Network | Chrome Trace und Runtime Telemetry | grundsätzlich gleich, aber Browser/Backend/Driver pinnen |
| Leichtes Timing | Timerquery-/stats-gl-Hinweis | featureabhängige Timestamps; verzögert und backendbezogen |
| Heap | Chrome/MemLab für JS | ebenfalls JS; GPUBuffer-/GPUTexture-Treiberspeicher bleibt getrennt |

Der fehlende WebGPU-Command-Debugger ist ein offenes Tooling-Gap. Ein
Spector-WebGL-Capture darf nicht als Proxy für WebGPU dienen. Ebenso sind
Three.js-WebGPU-Zähler nur zulässig, wenn sie über eine stabile öffentliche
Oberfläche verfügbar sind; andernfalls bleibt der Wert `null`.

## 14. CI And Lab Lanes

### PR Gate

- Diagnostics-Schema, Countersemantik, `null`/unsupported und read-only
  Verhalten testen.
- Gepinntes Playwright-Szenario mit einem Controller ausführen.
- Queue-Drain, Revisionfortschritt, Residency-/Fallbackobergrenzen,
  Savebacklog und Rendererbaseline prüfen.
- Consolefehler und fehlgeschlagene Requests als textuelle Evidence anhängen.
- Keine harte GPU-ms-Schwelle auf wechselnder Hardware.

### Nightly Performance

- Gepinnte Chrome-for-Testing-/Toolversion und feste Runnerklasse.
- Main-Thread-Long-Tasks, relevante Workertracks, Network, Runtime Telemetry und
  Framespikes korrelieren.
- Trends statt universeller Hardwaregrenzen.
- stats-gl höchstens ergänzend und ohne Texture Preview.

### On Demand / Weekly Lab

- Spector nur für feste WebGL-Flows und einzelne Frames.
- MemLab für mehrzyklische Window-/Worker-Heapserien.
- Raw Traces, Heaps und Framecaptures nicht standardmäßig öffentlich hochladen.
- Redigierte Summaries und Diagnostics-JSON sind die bevorzugten
  Reviewartefakte.

## 15. Required Invariants

- Diagnostics ändern keine Gameplay-, Streaming-, Worker- oder Saveentscheidung.
- Ein Toolwert wird nie ohne Quelle, Einheit, Gültigkeit und Provenance als
  Null oder Wahrheit ausgegeben.
- Spector-Ergebnisse sind WebGL-only und capturebezogen.
- stats-gl-Render-CPU ist nicht die gesamte App-Framezeit.
- JS-Heap ist nicht GPU Memory.
- Ein Leakurteil benötigt wiederholbare Serie und fachliche Runtimekorrelation.
- Tool- und Browsercontroller konkurrieren nicht um denselben Flow.
- Keine Evidence enthält absichtlich Secrets, Tokens oder unredigierte Header.
- Tools beweisen keine World Authority oder Produktionsfitness.

## 16. Open Benchmarks / Product Questions

- Endgültiges Diagnostics-Schema, Owner je Counter und Samplingbudget.
- Kontrollierte CPU-/GPU-/Memory-Budgets je Hardwareklasse.
- Spector-Capture-Overhead, Worker-/OffscreenCanvas-Erreichbarkeit und
  Summarykorrektheit eines späteren Adapters.
- Worker-Track-Auswertung in Chrome und Korrelation mit Runtime Job-IDs.
- stats-gl-Genauigkeit und Upgradeverträglichkeit.
- MemLab-Artefaktgröße, RAMbudget, GC-/Settle-Protokoll und Workerheapzugriff.
- GPUresidency und Resource-Lifecycle-Evidence jenseits des JS-Heaps.
- Gleichwertiges WebGPU-Commanddebugging.
- Retention, Zugriff und Redaction sensibler Labartefakte.

Bis diese Fragen belegt sind, bleiben Tooling- und Performancewerte
diagnostische Evidence, keine Implementierungs- oder Produktionsfreigabe.
