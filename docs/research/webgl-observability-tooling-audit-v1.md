# WebGL/WebGPU Observability Tooling Audit v1

Status: Research decision record
Datum: 2026-07-13
Repository: `BenjaminHornung/Weltraum-Spiel`
Basis: `origin/main` at `c780656c29ff4e5794be9ba58d6b78396a5826d5`
(`2026-07-13T16:16:52+02:00`)
Branch: `research/webgl-observability-tooling-audit-v1`

## Kurzurteil

Wir benötigen keine einzelne „allwissende“ Profiler-Lösung, sondern eine
sechsschichtige Toolkette:

1. **Eigene Runtime Telemetry** ist die kontinuierliche, maschinenlesbare Quelle
   für Chunk-, Queue-, Worker-, Mesh-, Cache- und Save-Backlog-Wahrheit.
2. **Playwright** reproduziert feste Abläufe, liest Diagnostics, prüft Console und
   Network und erzeugt Screenshots/Traces; es ist kein CPU-/GPU-Profiler.
3. **Chrome DevTools MCP** erklärt Main-Thread-, Network-, Console-, Screenshot-,
   Performance-Trace- und Heap-Verhalten in Chrome.
4. **Spector.js** erklärt einzelne WebGL-Frames: Draw Calls, Programme, State,
   Shader, Texturen und Buffer. Es beweist kein WebGPU-Verhalten.
5. **MemLab MCP** analysiert wiederholbare Heap-Serien, Dominatoren, Retainer,
   Detached DOM und Cachewachstum.
6. **stats-gl** ist höchstens ein Dev-only-Indikator für Render-CPU/GPU/Compute;
   es ersetzt weder Chrome-Traces noch eigene Telemetrie.

Die empfohlene Reihenfolge ist: zuerst Diagnostics Contract plus Playwright,
danach Spector.js für WebGL, danach Worker/Memory-Lab. Chrome DevTools MCP und
MemLab bleiben externe On-demand-Werkzeuge. Keine dieser Entscheidungen fügt
diesem Repository in diesem Change eine Dependency hinzu.

## Methode und Evidenzsprache

Jede materielle Aussage ist als **README Claim**, **Code Evidence**,
**Test Evidence**, **Benchmark Evidence**, **Observed Demo Evidence** oder
**Inference** gekennzeichnet. Ein sichtbarer Demoerfolg beweist nur die sichtbare
Funktion, nicht die intern behauptete Architektur. Fehlende Benchmarks werden
nicht durch Marketingbegriffe ersetzt.

Klassifikationskonvention: Explizit präfixierte Belege behalten ihre angegebene
Klasse. Tabellen mit Scores/Urteilen, Empfehlungen, Zielverträge, Testpläne und
sonstige nicht präfixierte normative Aussagen sind **Inference**. Statuswerte
wie PASS/FAIL/NOT RUN sind **Test Evidence** beziehungsweise **Observed Demo
Evidence**, wie in der jeweiligen Projektzeile angegeben.

Bewertung: 1 ist schwach, 5 ist stark. Bei **Integration Cost** bedeutet 5
geringe/einfache Integrationskosten. Die Bewertung bezieht sich auf den
Weltraum-Spiel-Browserpfad, nicht auf allgemeine Produktqualität.

## 1. Tool Adoption Matrix

### 1.1 Externe Projekte

| Projekt | Problem | Arch. | Browser | Determ. | Test | Perf.-Evidence | Lizenz | Integration | Reife | Urteil |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Spector.js | 4 | 3 | 3 | 2 | 4 | 1 | 5 | 3 | 3 | **Prototype behind adapter** |
| Chrome DevTools MCP | 5 | 4 | 5 | 3 | 5 | 3 | 5 | 4 | 4 | **Adopt as external tool** |
| stats-gl | 3 | 3 | 5 | 2 | 2 | 1 | 3 | 4 | 3 | **Prototype behind adapter** |
| MemLab / MemLab MCP | 4 | 4 | 3 | 3 | 3 | 2 | 5 | 3 | 4 | **Adopt as external tool** |
| Comlink | 4 | 4 | 5 | 3 | 4 | 2 | 5 | 4 | 4 | **Prototype behind adapter** |

### 1.2 Rollenmatrix

| Werkzeug | Zweck | Löst ausdrücklich nicht | Wo / wann | Dependency | Datenschutz | Erwartete Kosten |
| --- | --- | --- | --- | --- | --- | --- |
| Playwright | Reproduzierbare Flows, Assertions, Diagnostics-JSON, Worker-Lifecycle, Console, Network, Screenshots und funktionale Traces | Keine Main-/Worker-CPU-Flamecharts, GPU-Kommandos, Dominatoren oder Gameplay-Truth | Lokal und CI; kontinuierlich für funktionale/invariante Gates | Bereits Dev-Tool, keine Productiondependency | Trace, HAR, Console und Screenshots können URLs, Payloads und Secrets enthalten | Niedrig bis mittel; Browserstart und Szenariolauf |
| Chrome DevTools MCP | Chrome Performance Trace, Main-Thread-Frames/Tasks, Network, Console, Screenshots und Heap-Werkzeuge | Keine deterministische Chunk-/Queue-Wahrheit; keine WebGL-Draw-Command-Liste; Worker-Task-Auswertung nicht als eigene MCP-Oberfläche | Lokal/on demand; gepinnte Diagnose-Lane in CI | Externes Tool | Usage, CrUX, Updatecheck und Header aktiv absichern; Profile/Traces/Heaps sensitiv | Mittel; Traceauswertung, Browserbindung; Heap hoch |
| Spector.js MCP / Embedded | WebGL-Framecapture, Draw Calls, Command State, Shader, Textures, Buffer und Context Info | Kein WebGPU, keine CPU-Tasks, kein JS-Heap, kein Chunk-Vertrag | Lokal/on demand; höchstens dedizierte gepinnte WebGL-Lane | Extern; Embedded nur temporär oder Dev-only | Frame, Shader, Texturen und URLs können vertrauliche Inhalte tragen | Mittel bis hoch während Capture; nicht kontinuierlich |
| stats-gl | Schneller Dev-Indikator für FPS, instrumentierte CPU, GPU und WebGPU-Compute | Keine vollständige Framezeit, keine Retainer, keine Queue-/Chunk-/Upload-Wahrheit | Lokal/dev-only; bei Bedarf, nicht als hartes CI-Gate | Später optional hinter Dev-Adapter | Gering ohne Texture Preview; Preview kann Frameinhalt exponieren | Niedrig ohne Preview; Queries/Readback verfälschen Messung |
| MemLab MCP | Snapshotserie, Growth Signals, Dominatoren, Retainer, Detached DOM, Object Cost, Cacheanalyse | Kein GPU-Driver-Speicher, keine GPU-Uploadzeit, keine fachliche Eviction-Entscheidung | Lokal/on demand; lange Nightly/Weekly-Lane | Externes Tool | Heap enthält Strings, URLs, Nutzdaten und potenziell Credentials | Hoch: Pause, Snapshotgröße und etwa mehrfacher RAM-Bedarf |
| Eigene Runtime Telemetry | Aktuelle und historische Chunk-, Queue-, Worker-, Mesh-, Cache-, Save-, Frame- und Three.js-Zähler | Keine Browser-Flamechart-Ursache, keine GL-Kommandos, keine Retainer Chain | Lokal und CI; kontinuierlich mit begrenzter Samplingrate | Produktdiagnostics, aber read-only und abschaltbar | Niedrig bei IDs/Counts; keine Nutzdaten oder Secrets aufnehmen | Niedrig und budgetiert; keine Allokation pro Frame |

### 1.3 Identität und Ausführungsstatus der externen Projekte

#### Spector.js

- **Code Evidence** — Kanonische URLs:
  <https://github.com/BabylonJS/Spector.js> und öffentliche Projekt-/Demoseite
  <https://spector.babylonjs.com/>.
- **Code Evidence** — Untersucht: `97927a00940d4c86620ee9de6e0e56f94d19db7c`,
  `2026-07-04T03:05:15+02:00`, Branch `master`, kein Tag an HEAD; Root-Paket
  `spectorjs` `0.9.33`, MCP-Paket `@spectorjs/mcp` `1.0.0`.
- **Code Evidence** — MIT, exakter Pfad
  [`LICENSE.txt`](https://github.com/BabylonJS/Spector.js/blob/97927a00940d4c86620ee9de6e0e56f94d19db7c/LICENSE.txt).
- **Code Evidence** — Untersucht: `README.md`, `package*.json`, Extension-,
  Embedded-/UI-, Capture-/Command-/State-/Shader-/Texture-/Context-Code,
  Worker Spy/Bridge, `spector.worker.bundle.js`, MCP-README/Paket/Server/Tools
  und relevante Unit-/Integration-/E2E-Tests.
- **Test Evidence** — Build/Test NOT RUN. Package-Scripts und transitive
  Install-Hooks wurden vorab geprüft; die vorhandenen gepinnten Bundles wurden
  ohne Dependency-Installation für die Captures verwendet.
- **Observed Demo Evidence** — Öffentliche Instanced-Bones-Demo und temporärer
  Weltraum-Spiel-Capture in Chromium: PASS mit den in Abschnitt 2 beschriebenen
  erheblichen Capture-/Console-Einschränkungen.

#### Chrome DevTools MCP

- **Code Evidence** — Kanonische URL:
  <https://github.com/ChromeDevTools/chrome-devtools-mcp>
- **Code Evidence** — Untersucht: `c1736a071b8050b3f49dfa7521b5af703948d14a`,
  `2026-07-13T11:11:56Z`, Branch `main`, kein Tag an HEAD, Paket `1.5.0`.
- **Code Evidence** — Apache-2.0, exakter Pfad
  [`LICENSE`](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/c1736a071b8050b3f49dfa7521b5af703948d14a/LICENSE).
- **Code Evidence** — Untersucht: `README.md`, `package*.json`,
  `docs/{tool-reference,cli}.md`, CLI-Optionen, `src/tools/{performance,memory,network,console,screenshot}.ts`,
  Trace Processing, HeapSnapshotManager, Telemetry, relevante Tests und CI.
- **Test Evidence** — `npm ci --ignore-scripts`, Prepare und Build: PASS;
  gezielte CLI-, Telemetry- und Trace-Parser-Tests: PASS. Full Suite,
  Performance-/Heap-Browserintegration: NOT RUN. npm meldete 17 moderate
  Findings, die in diesem Audit nicht einzeln triagiert wurden.
- **Observed Demo Evidence** — Kein eigenständiges Demo ausgeführt; Browserstatus
  NOT RUN im Projekt-Clone.

#### stats-gl

- **Code Evidence** — Kanonische URL:
  <https://github.com/RenaudRohlinger/stats-gl>
- **Code Evidence** — Untersucht: `dae82f5a4a14d19a3ec21bc47b28a491a668a036`,
  `2026-07-10T19:54:48+09:00`, Branch `main`, kein Tag an HEAD, Paket `4.2.3`.
- **Code Evidence** — MIT ist in `package.json`/README deklariert, aber im
  Checkout fehlt ein eigenständiger Lizenztext. Exakter deklarierender Pfad:
  [`package.json`](https://github.com/RenaudRohlinger/stats-gl/blob/dae82f5a4a14d19a3ec21bc47b28a491a668a036/package.json).
- **Code Evidence** — Untersucht: `README.md`, `llms.txt`, `package.json`,
  `lib/{core,main,profiler,textureCapture,statsGLNode}.ts`, Addon, Worker-Demos und
  das einzelne Node-Testskript.
- **Test Evidence** — Build/Test NOT RUN; keine Dependencies installiert.
- **Observed Demo Evidence** — Öffentliche Three.js- und Worker-Demo in Chromium:
  PASS. Worker wurde sichtbar gestartet und gestoppt; Worker-Demo ohne
  Consolefehler. Hauptdemo hatte eine Duplicate-Three-Warnung und eine irrelevante
  favicon-404. Screenshots blieben unter `C:\tmp`.

#### MemLab / offizieller MemLab MCP

- **Code Evidence** — Kanonische URL: <https://github.com/facebook/memlab>
- **Code Evidence** — Untersucht: `b1cb666c2965495049d873992fc4556dcebfbbe2`,
  `2026-07-11T11:14:39-07:00`, Branch `main`; HEAD ungetaggt, erreichbarer
  `v2.0.4` zeigt auf einen älteren Commit. MCP-Paket `2.18.2`.
- **Code Evidence** — MIT, exakte Pfade
  [`LICENSE`](https://github.com/facebook/memlab/blob/b1cb666c2965495049d873992fc4556dcebfbbe2/LICENSE)
  und `packages/mcp-server/LICENSE`.
- **Code Evidence** — Der MCP-Server ist Teil des offiziellen facebook/memlab-
  Repositories. Untersucht wurden Root/MCP-README, Paketskripte, MCP-Skill und
  Tools, Heap Parser/Analyzer, Heap Analysis/API und Detached-DOM-Dokumentation.
- **Test Evidence** — Build/Test/MCP-Server NOT RUN. Der Core hat umfangreiche
  Tests, das MCP-Paket deklariert derzeit `no tests yet`.
- **Observed Demo Evidence** — Demo/Browser/Heapcapture NOT RUN.

#### Comlink

- **Code Evidence** — Kanonische URL:
  <https://github.com/GoogleChromeLabs/comlink>
- **Code Evidence** — Untersucht: `114a4a6448a855a613f1cb9a7c89290606c003cf`,
  `2025-06-17T17:01:59-07:00`, Branch `main`, kein Tag an HEAD; letzter sichtbarer
  Release-Tag `v4.4.2`.
- **Code Evidence** — Apache-2.0, exakter Pfad
  [`LICENSE`](https://github.com/GoogleChromeLabs/comlink/blob/114a4a6448a855a613f1cb9a7c89290606c003cf/LICENSE).
- **Code Evidence** — Untersucht: `README.md`, `package.json`, `LICENSE`,
  `structured-clone-table.md`, `src/{comlink,protocol,node-adapter}.ts`, Worker-,
  Iframe-, Cross-Origin-, Transfer-, Error- und Lifecycle-Tests sowie Beispiele.
- **Test Evidence** — Kein Lockfile vorhanden. Nach `npm install --ignore-scripts`
  baute `npm run build` mit Exit 0, aber mit vielen TypeScript/@types-Driftwarnungen.
  `test:types` FAIL wegen zu neuer transitiver Node-Typen für TypeScript 4.9;
  `test:node` FAIL unter Node 26 durch ein CJS/ESM-Problem in Mocha/Yargs.
  Browser-Unit-Test: NOT RUN. npm meldete acht nicht triagierte Findings.
- **Observed Demo Evidence** — Demo/Browserstatus NOT RUN.

### 1.4 Hauptrisiken je Projekt

| Projekt | Main Risks |
| --- | --- |
| Spector.js | WebGL-only; Capture verändert Timing stark; MCP zählt Extension-Draws unvollständig, bietet kein Capture-Diff und erreicht DOM-fremde OffscreenCanvas-/Worker-Kontexte nicht |
| Chrome DevTools MCP | Chrome-only; Worker-Tasks nicht als eigene MCP-Abfrage; Trace/Heap groß und sensitiv; Telemetrie/CrUX/Updatecheck standardmäßig aktiv beziehungsweise netzwerkfähig |
| stats-gl | Observer-Effekt, Render-CPU ist keine Frame-CPU, private Three-WebGPU-Interna, keine Genauigkeitsbenchmarks, fehlender Lizenztext im Checkout |
| MemLab MCP | Hoher RSS-/Snapshotbedarf, synchroner Dominatorpass, GC-Rauschen, Window-/Worker-Heaps getrennt, kein GPU-Speicher, MCP ohne eigene Tests |
| Comlink | RPC-/Proxy-Roundtrips, implizite Structured-Clone-Kopien, keine eingebaute Cancellation/Deadline/Restart-Semantik, Lifecycle bleibt Anwendungscode |

## 2. Spector Proof

### 2.1 Projektidentität und Fähigkeiten

- **README Claim** — Spector.js wird als WebGL-Capture- und Debugwerkzeug für
  Browser Extension und Embedded Mode angeboten.
- **Code Evidence** — Extension und Embedded Mode instrumentieren WebGL-
  Kontexte und erfassen eine Frame-Kommandofolge mit Draw Calls, Command State,
  Shadern, Programmen, Texturen, Buffern und Context Information. Die aktuelle
  UI enthält außerdem Texture Inspection und LCS-basierten Capture-Vergleich;
  beides ist nicht als MCP-Tool verfügbar.
- **Code Evidence** — Der offizielle Source enthält einen MCP-Server, der über
  Playwright einen Chromium-Browser startet, das Bundle nach Navigation per
  `addScriptTag` injiziert und Capture-/Analysewerkzeuge bereitstellt. Für den
  untersuchten Stand wurde kein veröffentlichter, getaggter MCP-Release
  nachgewiesen.
- **Code Evidence** — Die MCP-Draw-Allowlist lässt ANGLE/WEBGL-
  Extensionvarianten aus; bei der Instanced-Bones-Demo hätte sie daher nur drei
  statt der beobachteten 13 Draw Calls gemeldet. Die MCP-Dauerberechnung
  multipliziert bereits in Millisekunden gemessene Werte erneut mit 1000.
- **Code Evidence** — GL Errors werden im MCP nur aus aufgezeichneten, von Null
  verschiedenen `getError`-Commands abgeleitet. Das ist kein Beweis für eine
  fehlerfreie Console oder einen fehlerfreien Kontext. Das MCP-Texturtool listet
  Upload-Commands des Captures, nicht residente Texturen oder deren Pixel.
- **Code Evidence** — Core und Tests decken Main-Thread-OffscreenCanvas sowie
  Worker Spy/Bridge ab. Der vollständige Capture wird ohne Transferliste über
  `postMessage` geklont. Das MCP verwendet jedoch DOM-
  `querySelectorAll('canvas')` und kann eine nur im Worker gehaltene
  `OffscreenCanvas` nicht adressieren.
- **Code Evidence** — Module-Worker-Injection ist best effort; der aktive
  Extension-Pfad überspringt Module Worker. Das MCP setzt kein `bypassCSP`.
- **Inference** — Main-Thread-Injection beweist deshalb keine Worker-
  Instrumentierung. CSP, CORS und `blob:`-Regeln können Script-/Worker-Injection
  blockieren; keine CSP-Abschwächung für Produktion vornehmen.
- **Benchmark Evidence** — Keine reproduzierbare Benchmark-Suite für
  Capture-Overhead oder Messabweichung gefunden.
- **Inference** — **Urteil: Prototype behind adapter.** Extension/Embedded Core
  sind als externes On-demand-Werkzeug brauchbar, der aktuelle MCP-Pfad braucht
  aber vor Adoption einen gepinnten Adapter mit korrigierter Draw-/Dauer-/Error-
  Summary und explizitem Worker-Gap.

### 2.2 Temporärer Proof gegen Weltraum-Spiel

#### Kontrolllauf ohne Spector

- **Observed Demo Evidence** — Die App wurde aus einem temporären `git archive`
  von exakt `origin/main` exportiert. Keine Datei unter `apps/**` wurde verändert.
- **Test Evidence** — `npm ci --ignore-scripts`: PASS, 59 Pakete, npm Audit 0.
- **Test Evidence** — `npm run build`: PASS. Vite meldete das bestehende große
  Hauptchunk (`860.28 kB`, gzip `222.23 kB`) als Warnung.
- **Test Evidence** — `npm run test`: PASS, 40 Testdateien / 473 Tests.
- **Observed Demo Evidence** — Echte Chromium-Sitzung bei 1280x720: sichtbarer
  Flight-Viewport/HUD, Network-Request für `demo_scout_mk1.glb` HTTP 200, Console
  nur mit `favicon.ico` 404, temporärer Screenshot unter `C:\tmp`.
- **Observed Demo Evidence** — Canvas: WebGL 2.0 / GLSL ES 3.00, antialias true,
  `preserveDrawingBuffer=false`, Max Texture Size 16384, 32 kombinierte
  Texture Units; `gl.getError()` ergab `0` (`NO_ERROR`).

#### Instrumentierter Capture

- **Observed Demo Evidence** — Source-Bundle `spector.bundle.js`, SHA-256
  `223009BA80EA5B12EED5C32C54EA5DE9AA4607FE7BB0BAF74B485AAA9AE43337`, wurde
  nach Navigation per lokalem `page.addScriptTag({path})` injiziert;
  `captureNextFrame(canvas, true)` capturte den WebGL2-Canvas. Keine
  Repository-Dependency und kein persistenter Browserzustand wurden erzeugt.
- **Observed Demo Evidence** — Weltraum-Spiel-Capture: 421 Commands, **112 Draw
  Calls** (`93 drawElements`, `17 drawArrays`, `2 drawArraysInstanced`), **7
  Programme**, **0 capture-referenzierte Texturen**, **200
  capture-referenzierte Buffer**. Die State-/Commandfolge und Shaderprogramme
  waren im Capture vorhanden.
- **Observed Demo Evidence** — Spector zeichnete keinen von Null verschiedenen
  `getError`-Command auf. Gleichzeitig erzeugte die Instrumentierung 189
  `WebGL INVALID_OPERATION`-Warnungen bei `getTranslatedShaderSource` auf bereits
  gelöschten Objekten. Der belastbare Befund lautet daher: **0 beobachtete
  nonzero-getError-Commands; tatsächliche Console nicht fehlerfrei**.
- **Observed Demo Evidence** — Die Capture-Dauer betrug einmalig etwa **26,83 s**
  trotz `quickCapture=true`. Das ist starker Observer-Effekt und kein Benchmark.
  Ohne Spector war `gl.getError()` 0 und die Console enthielt nur die favicon-404.
- **Observed Demo Evidence** — Öffentliche Instanced-Bones-Kontrolle: 448
  Commands, 13 Draw Calls, 5 Programme, 7 capture-referenzierte Texturen und 40
  capture-referenzierte Buffer; einmalige Capture-Dauer etwa 1,07 s. Der sichtbare
  Demozustand wurde per temporärem Screenshot dokumentiert.
- **Inference** — „Capture-referenziert“ ist keine Residency-Metrik: null
  referenzierte Texturen im lokalen Capture beweisen weder null residente
  Texturen noch null frühere Uploads. Dafür bleiben Three.js- und eigene
  Runtime-Zähler zuständig.
- **Observed Demo Evidence** — Direkte Pre-Navigation-Injection via
  `addInitScript` schlug fehl, weil das Bundle CSS vor vorhandenem `head/body`
  einfügte. Für echte frühe Interception ist ein späterer lokaler HTML-Response-
  Preload vor den App-Scripts nötig; post-navigation beweist keine lückenlose
  Context-Lifecycle-Erfassung.

Ein Capture beweist die tatsächlich aufgezeichnete WebGL-Kommandofolge, nicht
die interne Streaming-, Worker- oder WebGPU-Architektur.

## 3. Chrome DevTools Setup

### 3.1 Nachgewiesene Oberfläche

- **Code Evidence** — `performance_start_trace`, `performance_stop_trace` und
  `performance_analyze_insight` verwenden Puppeteer Tracing plus Chrome Trace
  Engine. Raw Traces können JSON/gzip gespeichert werden; nur ein Trace kann
  gleichzeitig laufen.
- **Code Evidence** — MCP-formatierte Traces liefern Main-Thread-Callframes und
  Network Requests. Es gibt keine allgemeine Raw-Event-Query-Oberfläche.
- **Inference** — Worker-Events können im Raw Trace liegen, aber es gibt keinen
  öffentlichen Worker-Selector oder Worker-Task-Formatter. Worker Tasks müssen
  vorerst im Performance-Panel/Raw Trace oder in einem späteren Adapter geprüft
  werden.
- **Code Evidence** — Network, Console und Page/Element/Full-Page-Screenshots sind
  direkt verfügbar.
- **Code Evidence** — `take_heapsnapshot` ist ohne Experimental-Flag verfügbar.
  Summary, Compare, Dominators, Retainers, Retaining Paths, Edges, Class
  Instances und Duplicate Strings brauchen `--memory-debugging`. Es gibt keine
  Allocation Timeline und keinen Heap-VM-/Worker-Selector im öffentlichen MCP.
- **Benchmark Evidence** — Kein reproduzierbarer Capture-Overhead-Benchmark
  gefunden.
- **README Claim** — Offiziell werden Google Chrome und Chrome for Testing
  unterstützt; andere Chromium-Browser sind nicht garantiert.

### 3.2 Sichere ephemere Konfiguration

Versionen in CI pinnen; `@latest` ist kein reproduzierbarer Performance-Gate.
Keine Benutzerkonfiguration wird dauerhaft verändert.

```json
{
  "command": "npx",
  "args": [
    "-y",
    "chrome-devtools-mcp@1.5.0",
    "--headless",
    "--isolated",
    "--no-usage-statistics",
    "--no-performance-crux",
    "--redact-network-headers"
  ],
  "env": {
    "CI": "1",
    "CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS": "1",
    "CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS": "1"
  }
}
```

- **Code Evidence** — Usage Statistics sind standardmäßig aktiv. Sie können
  Toolname, Erfolg, Latenz, OS, Clientkategorie, Session-/App-Identifier, Flags
  und sanitisierte Parametermerkmale enthalten.
- **Code Evidence** — Mit CrUX können Trace-URLs einschließlich Main-Frame-URL
  an die CrUX API gehen. Updatechecks kontaktieren npm.
- **Code Evidence** — `--redact-network-headers` ist vorhanden, default aber
  false; `--isolated` verwendet ein temporäres Profil.
- **Inference** — `--memory-debugging` nur für explizite Leakläufe ergänzen.
  `--allow-unrestricted-paths`, `--accept-insecure-certs`, `--auto-connect` und
  experimentelle Third-Party-Tools ausgeschaltet lassen.
- **Inference** — Nie das normale Benutzerprofil anbinden. Chrome for Testing
  oder ein separates temporäres `user-data-dir` verwenden und Debugging nur an
  Loopback binden.

### 3.3 Arbeitsteilung mit Playwright

- **README Claim** — Playwright Tracing erfasst Browseroperationen, Network,
  DOM-Snapshots und Screenshots; Playwright Test ergänzt Assertions.
- **README Claim** — Playwright kann Worker-Erzeugung, Schließung, Evaluation und
  Worker-Console beobachten, aber keine Worker-CPU-Taskdauer liefern.
- **Inference** — Genau ein Tool besitzt die Flow-Steuerung. Empfohlen:
  Playwright startet/steuert den deterministischen Szenariolauf; Chrome DevTools
  MCP besitzt nur den klar begrenzten Trace-/Heap-Start-Stopp-Bereich. Zwei
  konkurrierende Controller erzeugen sonst Timing-Races.

## 4. stats-gl Verdict

- **Code Evidence** — Erkennt Three.js WebGLRenderer/WebGPURenderer, nativen
  WebGL2-Kontext und `GPUDevice` getrennt. WebGL1 ist nicht unterstützt.
- **Code Evidence** — WebGL-GPU-Zeit nutzt
  `EXT_disjoint_timer_query_webgl2` und verwirft disjoint/fehlende Ergebnisse.
- **Code Evidence** — WebGPU instrumentiert Render-/Compute-Pässe mit
  Timestamp-Paaren; der asynchrone `mapAsync`-Readback kann später als der
  angezeigte Frame eintreffen.
- **Code Evidence** — CPU misst `performance.now()` um instrumentierte
  Rendergrenzen bzw. `begin/end`, nicht die vollständige Frame-, Worker- oder
  Streaming-Pipeline.
- **Code Evidence** — `StatsProfiler` liefert headless
  `{fps,cpu,gpu,gpuCompute}`; Worker können Daten per `setData` zur Anzeige
  schicken. OffscreenCanvas/Worker-Demos sind vorhanden.
- **Code Evidence** — Texture Preview führt bei WebGL synchrones `readPixels`
  aus; WebGPU erzeugt zusätzlichen Blit/Staging/Map-Readback. Das verändert die
  gemessene Arbeit.
- **Code Evidence** — Die Three.js-Anbindung patcht Render-/Info-Verhalten und
  nutzt für WebGPU private/instabile Rendererfelder; Upgrade-Risiko.
- **Code Evidence** — `llms.txt` existiert, ist aber Dokumentation, kein
  Qualitätsnachweis.
- **Benchmark Evidence** — Keine Genauigkeits- oder Observer-Overhead-Benchmarks.

**Urteil: Prototype behind adapter.** Ein späterer Dev-only-Adapter darf den
headless Profiler bei explizit aktivierter Diagnostik einschalten. Texture
Preview bleibt bei Timing-Läufen aus; Werte werden als Hinweis, nicht als
Gameplay-Truth oder hartes CI-Gate geführt. Der Adapter muss bei Three.js-
Upgrades separat geprüft werden.

## 5. MemLab Test Plan

### 5.1 Eignung und Grenzen

- **Code Evidence** — Der offizielle MemLab MCP lädt vollständige Heapgraphen,
  berechnet Dominatoren/Retained Sizes und bietet Summary, Class Histogram,
  Largest Objects, Growth Signals, Dominator Subtree, Retainer Summary/Trace,
  Detached DOM, Object Cost und Cache Analysis.
- **Code Evidence** — `memlab_sequence_analysis` verarbeitet geordnete
  Snapshotserien transient, trennt strikt monotones Wachstum von netto
  gewachsenen, GC-rauschenden Klassen und warnt, dass Node IDs nur
  snapshotlokal sind.
- **Code Evidence** — `growth_signals` ist eine Single-Snapshot-Heuristik und
  verlangt Bestätigung durch spätere Snapshots.
- **Code Evidence** — `cache_analysis` trennt „cache-like“ nur heuristisch von
  Collection/Working Set. `object_cost_breakdown` analysiert JS/V8-Kosten, nicht
  GPU-Speicher.
- **README Claim** — Für den MCP werden 8 GB Old Space empfohlen; der residente
  Graph könne etwa 3-5x Snapshotgröße benötigen. Das ist Kapazitätsplanung, kein
  Benchmark.
- **Code Evidence** — Serverstatus liefert RSS/Heap und residente Snapshots;
  gezieltes Unload begrenzt Peaks. Dominatoraufbau ist bei großen Graphen
  synchron und schwer abbrechbar.
- **Inference** — Window- und Worker-Heaps getrennt capturen. GPU-Residency und
  tatsächliche Meshuploadzeit bleiben außerhalb von MemLab.

### 5.2 Späterer Streaming-Leak-Lauf

Fester Seed, identischer Viewport/Qualitätsmodus und identische Route. Vor jedem
Snapshot warten, bis eigene Telemetrie leere Generation-/Mesh-/Collision-Queues,
keinen Save-Backlog und stabilen Residencybestand meldet. Danach gleiche GC- und
Settle-Sequenz verwenden.

| Snapshot | Phase | Erwartung |
| --- | --- | --- |
| S0 | Surface A nach Warm-up | Baseline; vollständige stabile Residency |
| S1 | Orbit | Surface-Ressourcen nach Policy evicted; Queues leer |
| S2 | zweite Surface B | definierter neuer Working Set |
| S3 | Rückkehr Surface A | B evicted; A darf auf warmen Baselinekorridor zurückkehren |
| S4-S11 | zwei weitere vollständige Wiederholungen | gleiche Phasen dürfen nach GC nicht monoton wachsen |

Auswertung:

1. Main Window und relevante Generation-/Mesh-Worker getrennt capturen.
2. Header/Größe jeder Datei prüfen; `capture_numeric_value` ausgeschaltet lassen.
3. Serie zuerst transient mit `memlab_sequence_analysis` auswerten.
4. Starkes Signal: gleiche Phase wächst in jedem Zyklus; Klassenanzahl/Self Size
   strikt monoton; Heap kehrt nach GC nicht in den Korridor zurück; gleichzeitig
   verletzen `residentChunks`, Three.js-Counts oder Cachecounter ihre erwartete
   Obergrenze.
5. Letzten verdächtigen Snapshot einzeln laden und in dieser Reihenfolge prüfen:
   Summary, Growth Signals, Cache Analysis, Class Histogram, Largest Objects,
   Object Cost, Detached DOM, Retainer Summary und Retainer Trace.
6. Für die klassische Dreierlogik zusätzlich S0 als Baseline, S2 als Target und
   S3 als Final vergleichen: nach S2 entstandene Objekte, die nach S3/GC ohne
   fachlichen Grund leben, sind Kandidaten.
7. Server-RSS zwischen teuren Analysen prüfen und Snapshots sofort entladen.

**Urteil: Adopt as external tool**, ausschließlich on demand. MemLab beweist
Retention. Ob ein Chunk fachlich hätte evicted werden müssen, beweist nur der
Runtime-Diagnostics-Vertrag.

## 6. Comlink Verdict

### 6.1 Was der Source beweist

- **README Claim** — Comlink ist RPC über `postMessage` plus ES6 Proxy.
- **Code Evidence** — Das Protokoll besitzt `GET`, `SET`, `APPLY`, `CONSTRUCT`,
  `ENDPOINT` und `RELEASE`. Jeder Remotezugriff ist asynchron und erzeugt eine
  Message/Promise-Runde.
- **Code Evidence** — Parameter und Ergebnisse laufen standardmäßig durch
  Structured Clone. `Comlink.transfer(value, transferables)` hängt eine explizite
  Transferliste an; der Source und Tests decken ArrayBuffer und MessagePort ab.
- **Code Evidence** — Remote-Exceptions werden mit Name, Message und Stack
  serialisiert und auf der Gegenseite erneut geworfen; auch nicht-Error-Werte
  sind getestet.
- **Code Evidence** — `releaseProxy`/`finalizer` lösen Proxy/Endpoint-Ressourcen;
  MessagePorts aus `createEndpoint` werden geschlossen.
- **Code Evidence** — Im öffentlichen Protokoll gibt es kein Abort-/Cancel-
  Kommando, kein Deadline-/Timeout-Feld und kein Worker-Restart-Konzept. Eine
  Request-Promise wird über eine Pending-Listener-Map aufgelöst.
- **Benchmark Evidence** — Keine belastbaren RPC-/Proxy-Overhead-Benchmarks im
  untersuchten Checkout.

### 6.2 Empfohlene Trennung

Kleine Control-Plane-Kommandos dürfen später über einen eigenen Adapter auf
Comlink laufen:

- `configurePool`, `setBudgets`, `enqueueChunk`, `cancelJob`, `releaseChunk`
- `getStatus`, `getDiagnostics`, `ackRevision`, `shutdown`
- kleine IDs, Bounding Boxes, LOD-/Revision-/Priority-Metadaten und Result Codes

Große Data-Plane-Payloads dürfen nicht implizit kopiert werden:

- Vertex-/Index-/Collision-/Voxel-/Height-/Normal-Buffer explizit als
  `ArrayBuffer`/Typed-Array-Backing-Buffer mit `Comlink.transfer` senden.
- Besitzübergang im Vertrag benennen; der Senderbuffer ist danach detached.
- Mehrere kleine Buffer pro Job bündeln, statt tausende Proxyzugriffe zu machen.
- `SharedArrayBuffer` ist Shared Memory, kein Transferable. Nur nach separater
  Entscheidung mit COOP/COEP, Atomics, Ownership- und Race-Vertrag einsetzen.

Cancellation und Lifecycle bleiben Anwendungscode:

- Job IDs, Revision, Deadline und idempotentes `cancelJob(jobId)` definieren.
- Worker bestätigt `Cancelled`/`Completed`; stale Revisionen werden verworfen.
- Auf `error`, `messageerror` oder Worker-Ende alle offenen Anfragen mit
  deterministischem Fehlercode ablehnen; Worker bei Bedarf neu erzeugen.
- `releaseProxy`, `port.close()` und `worker.terminate()` sind Cleanup, kein
  Beweis, dass ein laufender Job kooperativ abgebrochen wurde.

**Urteil: Prototype behind adapter.** Comlink kann die kleine Control Plane
vereinfachen. Der Adapter besitzt Commands, Transfer-Ownership, Cancellation,
Timeouts, Lifecycle und Fehlercodes; Domänen- oder Queueentscheidungen gehören
nicht in Comlink.

## 7. Runtime Telemetry Contract

### 7.1 Versioniertes JSON

Der folgende spätere `BrowserDiagnosticsSnapshotV1` ist eine Zieldefinition,
keine in diesem Change implementierte API:

```json
{
  "schema": "weltraum.browser-diagnostics",
  "version": 1,
  "sessionId": "diagnostics-session-id",
  "counterEpoch": 1,
  "capturedAtMs": 0,
  "frameId": 0,
  "simulationTick": 0,
  "rendererBackend": "webgl2",
  "activeChunks": 0,
  "visibleChunks": 0,
  "residentChunks": 0,
  "queuedGenerationJobs": 0,
  "queuedMeshJobs": 0,
  "queuedCollisionJobs": 0,
  "workerUtilization": {
    "windowMs": 5000,
    "aggregate": 0.0,
    "byPool": {}
  },
  "workerQueueLatency": {
    "windowJobs": 128,
    "p50Ms": null,
    "p95Ms": null,
    "maxMs": null
  },
  "generatedTriangles": 0,
  "meshUploadBytes": 0,
  "cacheHits": 0,
  "cacheMisses": 0,
  "evictions": 0,
  "chunkRevisions": {
    "changedThisFrame": 0,
    "maximum": 0,
    "sum": 0
  },
  "dirtyChunks": 0,
  "saveBacklog": 0,
  "cpuFrameMs": {
    "last": null,
    "p50": null,
    "p95": null,
    "windowFrames": 120
  },
  "gpuFrameMs": {
    "last": null,
    "p50": null,
    "p95": null,
    "windowFrames": 120,
    "source": null
  },
  "largestFrameSpike": {
    "windowMs": 60000,
    "valueMs": null,
    "frameId": null
  },
  "threeGeometryCount": null,
  "threeTextureCount": null,
  "threeProgramCount": null
}
```

### 7.2 Semantik

| Feld | Typ/Einheit | Exakte Bedeutung |
| --- | --- | --- |
| `activeChunks` | Gauge/count | Chunks im fachlichen Full- oder Snapshot-Simulationsmodus; nicht „sichtbar“ ableiten |
| `visibleChunks` | Gauge/count | Streaming-Zuweisungen mit Render-LOD ungleich `Culled`; keine Occlusion-Behauptung |
| `residentChunks` | Gauge/count | Chunks mit CPU-seitig residentem Chunk-/Mesh-/Collision-/Save-Record, unabhängig von aktiv/sichtbar |
| `queuedGenerationJobs` | Gauge/jobs | Wartende, noch nicht gestartete Generationjobs |
| `queuedMeshJobs` | Gauge/jobs | Wartende Meshbuildjobs |
| `queuedCollisionJobs` | Gauge/jobs | Wartende Collisionbuildjobs |
| `workerUtilization` | Ratio 0..1 | Busy-Zeit / verfügbare Workerzeit im Fenster; aggregate und pro Pool |
| `workerQueueLatency` | ms distribution | Enqueue-to-start, nicht Joblaufzeit; `null`, bis genügend Samples vorhanden |
| `generatedTriangles` | Monotonic counter/triangles | Erfolgreich generierte Dreiecke seit `counterEpoch`; nicht aktuell sichtbare Dreiecke |
| `meshUploadBytes` | Monotonic counter/bytes | Tatsächlich zur Renderer-/GPU-Uploadgrenze übergebene Vertex-/Index-/Attributbytes; einmal pro Upload zählen |
| `cacheHits`, `cacheMisses` | Monotonic counters | Lookups mit explizit dokumentiertem Cache-Scope; Hit Rate nur daraus ableiten |
| `evictions` | Monotonic counter | Fachlich bestätigte Residency-/Cache-Evictions, nicht bloß Sichtbarkeitswechsel |
| `chunkRevisions` | Snapshot aggregate | Anzahl in diesem Frame geänderter Chunks plus Maximum/Summe zur deterministischen Trendprüfung |
| `dirtyChunks` | Gauge/count | Persistenzpflichtige Chunks, deren aktuelle Revision noch nicht bestätigt gespeichert ist |
| `saveBacklog` | Gauge/jobs | Enqueued/in-flight Savejobs ohne erfolgreiche Bestätigung |
| `cpuFrameMs` | ms distribution | Gesamter Browser-App-Frame an definierter RAF-Grenze, nicht stats-gl-Render-CPU |
| `gpuFrameMs` | ms distribution/null | GPU-Framezeit aus benannter Queryquelle; `null` bei unsupported/disjoint, nie 0 erfinden |
| `largestFrameSpike` | max ms/window | Größte gemessene CPU-Framezeit im rollenden Fenster mit Frame-ID |
| `threeGeometryCount` | Gauge/null | `renderer.info.memory.geometries` für WebGL; sonst öffentliche äquivalente Quelle oder null |
| `threeTextureCount` | Gauge/null | `renderer.info.memory.textures` für WebGL; sonst öffentliche äquivalente Quelle oder null |
| `threeProgramCount` | Gauge/null | `renderer.info.programs.length` für WebGL; für WebGPU ohne stabile öffentliche Entsprechung null |

### 7.3 Wahrheits- und Performance-Regeln

- Snapshot wird nach Eigentümertransitionen gelesen, nie als Entscheidungsinput
  für Gameplay, LOD, Queuepriorität, Workerzahl oder Savepolicy verwendet.
- Normaler Diagnostics-Endpunkt und TestBridge serialisieren dieselbe Quelle;
  TestBridge erfindet keine eigene Wahrheit.
- Keine Strings/Arrays pro Frame neu erzeugen; rollende Histogramme haben feste
  Buckets/Ringbuffer. Volle Chunklisten nur auf expliziten Detailabruf.
- Counter sind monotonic pro `counterEpoch`; ein Diagnostics-Reset ändert nur
  Diagnosecounter, nie Produktzustand.
- Unsupported, disabled und disjoint sind `null` plus Source/Reason, nicht 0.
- Snapshot enthält keine Meshdaten, Userdaten, Tokens oder beliebige URLs.

## 8. WebGL-vs-WebGPU-Diagnostics

| Evidenz | WebGL2 heute | WebGPU später |
| --- | --- | --- |
| Backendidentität | WebGL context info plus `rendererBackend=webgl2` | `WebGPURenderer` muss effektiven Backendtyp melden; WebGL2-Fallback separat markieren |
| Three.js Counts | `renderer.info.render`, `.memory`, `.programs` öffentlich dokumentiert | Nur stabile öffentliche Renderer-Info verwenden; fehlende Programm-/Speichercounter null |
| GPU-Commandcapture | Spector.js Framecapture | Spector.js nicht verwendbar; im auditierten Set kein gleichwertig bewiesener Command-Debugger |
| CPU/Browsertrace | Chrome Performance / DevTools MCP | Gleich, aber Backend/Chrome/Driver pinnen |
| Lightweight timing | stats-gl WebGL2 Timer Query | stats-gl WebGPU Timestamps/Compute, featureabhängig und verzögert |
| Worker/OffscreenCanvas | Canvas/Context können im Worker liegen; Instrumentierung muss vor Worker-Kontexterzeugung vorhanden sein | WebGPU ist im Worker verfügbar, aber Tool-/Target-Oberflächen separat verifizieren |
| Heap/Retention | Chrome Heap + MemLab; keine GPU-Residency | Gleich; GPUBuffer/GPUTexture-Treiberallokation bleibt außerhalb des JS-Heaps |

- **README Claim** — Three.js `WebGLRenderer.info` dokumentiert Calls,
  Triangles, Points, Lines, aktive Geometries, Textures und Programmliste.
- **README Claim** — `WebGPURenderer` wählt standardmäßig WebGPU und fällt auf
  WebGL2 zurück; `forceWebGL` ist möglich. `await renderer.init()` ist Teil der
  Initialisierung.
- **README Claim** — Die offizielle Three.js-Dokumentation bezeichnet
  WebGPURenderer weiterhin als experimentell; ShaderMaterial/RawShaderMaterial,
  `onBeforeCompile` und klassischer EffectComposer brauchen andere Pfade.
- **Inference** — Jeder Benchmark/Capture speichert Rendererbackend, Three.js,
  Browser, OS, GPU/Driver, Auflösung, DPR und Qualitätsprofil. Ohne diese
  Dimensionen sind WebGL-/WebGPU-Vergleiche nicht belastbar.
- **Inference** — Der fehlende WebGPU-Command-Debugger ist ein explizites Gap,
  kein Grund, Spector-Ergebnisse umzudeuten.

## 9. Privacy and Security

1. Externe MCPs nur prozesslokal, gepinnt, headless/isoliert und an Loopback.
   Kein normales Browserprofil, kein Auto-Connect, keine unbeschränkten Pfade.
2. Chrome: Usage Statistics, CrUX und Updatecheck in privaten/reproduzierbaren
   Läufen ausschalten; Network Headers redigieren.
3. Heap, Trace, HAR, Console, Screenshot, Framecapture, Shader und Texture können
   Source, URLs, Nutzdaten oder Credentials enthalten. Nur synthetische Daten,
   restriktiver Artefaktzugriff, kurze Retention, keine Standarduploads.
4. Spector/Playwright-Injection ist Debugcode. Keine Remote-CDN-Injection in
   Produktumgebungen und keine CSP-Abschwächung für Produktion.
5. Worker-CSP gilt für die Worker-Ressource. Module Worker und OffscreenCanvas
   sind separate Realms; Main-Thread-Injection beweist keine Workerinstrumentierung.
6. Transferables übertragen Ownership. Nach Transfer darf der Senderbuffer
   fachlich nicht mehr gelesen werden; Revision/Owner im Vertrag führen.
7. `SharedArrayBuffer` verlangt Cross-Origin Isolation. COOP/COEP verändern
   Popup-/Embedding- und Third-Party-Resource-Verhalten; Einführung ist eine
   eigene Security-/Hosting-Entscheidung, kein Performance-Schalter.
8. Telemetrie enthält Counts/IDs, keine Meshpayloads, Tokens, Header, Userstrings
   oder vollständige URLs. Detailendpunkte begrenzen Größe und Rate.

## 10. CI Strategy

### PR-Gate: deterministisch und günstig

- Unit/contract tests für Diagnostics-Schema, Countersemantik, null/unsupported,
  Epoch und invariant read-only Verhalten.
- Ein gepinntes Playwright-Chromium-Szenario pro kritischem Streamingpfad; CI
  mit einem Worker. Assertions auf Queue-Drain, Residency-/LOD-Obergrenzen,
  Revisionsfortschritt, Savebacklog und Three.js-Baseline-Rückkehr.
- Console errors, failed requests und Diagnostics-JSON anhängen. Screenshots nur
  bei Fehlern. Keine harte GPU-ms-Schwelle auf wechselnden Hosted Runnern.

### Nightly: Browserperformance

- Gepinnte Chrome-for-Testing-/MCP-Version, feste Auflösung/DPR/Quality/Seed.
- Sichere Flags aus Abschnitt 3; Performance Trace über definierten Flow.
- Main-Thread Long Tasks, Worker/raw-trace Track, Network, CPU-Spikes und Runtime-
  Telemetrie gemeinsam korrelieren. Trends auf derselben Runnerklasse statt
  universeller Hardwaregrenzen.
- stats-gl höchstens zusätzlich protokollieren; Texture Preview aus.

### On demand / Weekly: GPU und Memory

- Spector-Capture nur WebGL, gleicher Build/Browser/GPU; strukturelle Counts und
  GL errors vergleichen, Capture nicht als kontinuierlichen Frame laufen lassen.
- MemLab-Serie aus Abschnitt 5 mit separaten Window-/Worker-Snapshots. Erst
  Sequence Analysis, dann gezielte Dominator/Retainer-Arbeit.
- Raw Traces, Heaps und Framecaptures standardmäßig nicht als öffentliche CI-
  Artefakte hochladen. Stattdessen redigierte Summaries und Diagnostics-JSON.

### Keine falschen Gates

- Keine Gleichsetzung von stats-gl CPU mit `cpuFrameMs`.
- Keine Gleichsetzung JS Heap mit GPU Memory.
- Keine Spector-Schwelle für WebGPU.
- Keine absolute GPU-ms-Schwelle ohne kontrollierte Hardware/Driver.
- Kein Leakurteil aus einem einzelnen Snapshot oder einem warmen Cache.

## 11. Maximal drei konkrete Tooling-Spikes

### Spike 1: Diagnostics v1 + Playwright Budget Probe

Implementiere `BrowserDiagnosticsSnapshotV1` hinter der normalen Diagnostics-
Oberfläche, ergänze renderer.info-Zähler und einen Playwright-Flow, der Chunk-
Streaming ausführt, JSON speichert und Invarianten statt Hardwaretimings prüft.

**Exit:** Schema/Owner dokumentiert; keine Gameplay-Änderung durch Polling;
Unit-/Browsertests; Queue-/Residency-/Renderer-Baseline sichtbar.

### Spike 2: Spector WebGL Capture Harness

Temporärer/gepinnter Spector-MCP- oder Playwright-Preload gegen einen festen
Weltraum-WebGL-Flow. Erfasst Frame, Draw Calls, Programme, Texturen, GL Errors,
Buffer/State/Shader und dokumentiert CSP-, Module-Worker-, OffscreenCanvas- und
Overhead-Grenzen. Keine Productiondependency.

**Exit:** reproduzierbarer lokaler Capture, redigierte Summary, klare
WebGL-only-Kennzeichnung, sauberer Lauf ohne permanenten Config-/Repoeingriff.

### Spike 3: Worker Transfer and Streaming Leak Lab

Ein kleiner Workeradapter mit Comlink-Control-Plane, expliziten Transferables,
Job-ID/Revision/Cancellation und Diagnostics. Playwright führt die Surface-
Orbit-Surface-Rückkehr-Serie; Chrome Trace korreliert Main/Worker; MemLab prüft
Window-/Worker-Heaps und Retainer.

**Exit:** Bufferownership und Cancellation getestet; keine stale Revision;
Heap gleicher Phasen stabil oder Retainerpfad dokumentiert; RAM/Artefaktbudget
für MemLab festgehalten.

## Offizielle Dokumentation

- Playwright: [Tracing](https://playwright.dev/docs/api/class-tracing),
  [Network](https://playwright.dev/docs/network),
  [Worker API](https://playwright.dev/docs/api/class-worker),
  [CI](https://playwright.dev/docs/ci)
- Web Platform: [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API),
  [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers),
  [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas),
  [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects),
  [Structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm),
  [crossOriginIsolated / SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
- Chrome: [Performance reference](https://developer.chrome.com/docs/devtools/performance/reference),
  [Analyze runtime performance](https://developer.chrome.com/docs/devtools/performance),
  [Performance monitor](https://developer.chrome.com/docs/devtools/performance-monitor),
  [Heap snapshots](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots),
  [Remote debugging security](https://developer.chrome.com/blog/remote-debugging-port)
- Three.js: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html),
  [WebGPURenderer API](https://threejs.org/docs/pages/WebGPURenderer.html),
  [WebGPURenderer guide](https://threejs.org/manual/en/webgpurenderer)

## Repositorybezug und bekannte Grenzen dieses Audits

- **Code Evidence** — Aktuell erzeugt
  `apps/weltraum-browser/src/render/three/debugScene.ts` einen Three.js
  `WebGLRenderer`; es gibt noch keinen WebGPURenderer-Produktpfad.
- **Code Evidence** — `worldStreaming.ts` besitzt bereits deterministische
  Zuordnungen, Budgets, Transitionen und Signaturen, aber die normale
  `TelemetrySnapshot` enthält die in Abschnitt 7 geforderten Performance-/Queue-
  Zähler noch nicht.
- **Code Evidence** — `browserBridge.ts` ist ein Testharness; die neue Telemetrie
  soll deshalb aus normalen Diagnostics kommen und nur dort serialisiert werden.
- **Test Evidence** — Der temporäre origin/main-App-Build und die 473 Unit Tests
  waren grün; dies beweist nicht die vorgeschlagene Tooling-Integration.
- **Inference** — Messabweichung, Hardwarestreuung und Captureoverhead benötigen
  spätere kontrollierte Baselines. Dieser Audit implementiert keine Grenzwerte.
