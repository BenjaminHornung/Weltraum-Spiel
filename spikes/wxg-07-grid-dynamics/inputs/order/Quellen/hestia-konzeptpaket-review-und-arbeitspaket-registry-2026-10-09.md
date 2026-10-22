# Hestia / Weltraum-Spiel: Review des Konzeptpakets vom 2026-10-09 und einheitliche Arbeitspaket-Registry

Stand: 2026-10-09
Status: `REVIEW / PROPOSED`, Docs-only, kein Produktcode, keine Messung, keine Spec-Freigabe
Basis: `origin/main` @ `e40592c1` (nicht `25bc7f5b`, siehe X-01)
Prüfobjekte (alle fünf liegen unverändert in `docs/spielkonzept/`):

| Kürzel | Dokument |
|---|---|
| **GFX** | [Adaptive Shader- und Grafikarchitektur](hestia-adaptive-shader-grafikarchitektur-threejs-webgpu-wasm-2026-10-09.md) |
| **RT** | [Three.js Cross-Vendor-Raytracing](threejs-raytracing-intel-amd-nvidia-2026-10-09.md) |
| **WX** | [Universeller Planeten-Wetter- und Climate-Core v2](weltraum-universeller-planeten-wetter-climate-core-architektur-v2-2026-10-09.md) |
| **DF** | [Dimforge-Technologie-Audit-Handoff](hestia-dimforge-technologie-audit-handoff-2026-10-09.md) |
| **VW** | [Dynamisches volumetrisches Wetter (Vorgänger von WX, nachgereicht)](hestia-dynamisches-volumetrisches-wetter-architekturkonzept-2026-10-09.md) |

Dieses Dokument **ersetzt keines der fünf**. Es besitzt die Korrekturen, die verifizierten Fakten und die gemeinsame Paket-Registry. Die fünf Quelldokumente bleiben unverändert und werden bei Widerspruch durch dieses Dokument übersteuert.

## 0. Methode, Evidenzklassen, Grenzen

Evidenzklassen wie im DF-Dokument:

| Klasse | Bedeutung |
|---|---|
| **BESTÄTIGT** | Im Repo (`origin/main` @ `e40592c1`, Datei:Zeile) oder in einer verlinkten Primärquelle am 2026-10-09 geprüft |
| **PROJEKTDOKUMENTIERT** | Steht in einem Projektdokument oder einer Owner-Entscheidung |
| **BERECHNET** | Aus BESTÄTIGTEN Eingaben gerechnet, nicht gemessen |
| **HYPOTHESE** | Plausibel, nicht für Hestia gemessen |
| **OFFEN** | Nicht verifiziert; vor Nutzung prüfen |
| **EMPFEHLUNG** | Abgeleitete Priorität, keine Freigabe |

Was in diesem Arbeitsschritt **nicht** passiert ist: kein Build, kein Test, kein Browserlauf, kein Benchmark, kein `npm install` (es existiert kein `node_modules` im geprüften Worktree). Alle Aussagen über Paket-APIs aus Typings sind deshalb OFFEN, sofern nicht ausdrücklich als Quelle belegt.

**Fehlende Eingaben:**

1. Das Vorgängerdokument `HESTIA_DYNAMISCHES_VOLUMETRISCHES_WETTER_ARCHITEKTURKONZEPT_2026-10-09.md` (**VW**) wurde nach Beginn der Prüfung nachgereicht und in §3.5 mitbewertet. Es liegt noch nicht im Repo; Ablage als `docs/spielkonzept/hestia-dynamisches-volumetrisches-wetter-architekturkonzept-2026-10-09.md` ist Teil von GOV-01. WX stützt sich für F0-F3 und den Cloud-Render-Port darauf.
2. **Der Rapier-Bakeoff vom 2026-10-02 hat einen Ergebnisbericht** (`Hestia_Rapier_Bakeoff_2026-10-02.pdf` in `Downloads`, Evidence-Commit `bfa6efce`, Entscheid **KEEP 0.12 FOR NOW**, Details §4.2). Das DF-Dokument kennt ihn nicht (DF §1: „kein akzeptierter Abschlussbericht belegt“). Im Repo ist er nicht: `bfa6efce`, die Branches `research/rapier-*-2026-10-02` und `experiments/rapier-bakeoff/` existieren lokal nicht; der Push wurde laut Bericht abgelehnt, die Quellen liegen im „Begleitarchiv“ (Git-Bundle), dessen Ablageort OFFEN ist (GOV-01). Die Zips `Hestia_Parallelpakete_b3c6523a_2026-10-02`, `Hestia_RD_Orchestratorpaket_2026-10-02` und `Hestia_Destruction_Gesamtpaket_Phase1_2_3_2026-10-07` in `Downloads` enthalten es nicht (Dateinamen per Python-`zipfile` geprüft: keine Treffer für `rapier`, `bundle`, `bakeoff`, `experiments/`).
3. Eine Definition der Hardwareklassen H1/H2/H3 existiert in keinem der vier Dokumente. Die Owner-Entscheidung vom 2026-10-07 nennt das Referenzgerät `HVP-PLAY-720-v1` (Hardware-Freeze). Die Abbildung H1/H2/H3 auf dieses Gerät ist offen (GOV-01).

## 1. Gesamturteil

| Dokument | Urteil | Tragende Stärke | Wichtigste Korrektur |
|---|---|---|---|
| **GFX** | **Tragfähig, aber in Teilen redundant.** Annehmen nach Umschreiben von GRAPH-01/02 zu „bestehendes Settings-Modul erweitern“. | Trennung Fähigkeit / Wunsch / Laufzeitwert, Hysterese, Render Scale zuerst, WASM nur nach Nettomessung | Der Vorschlagsbaum `src/graphics/**` dupliziert `src/settings/**` und `render/three/graphicsSettingsAdapter.ts` (X-02, G-01) |
| **RT** | **Tragfähig als Spike-Programm, nicht als Produktplan.** Ehrliche Grenzen (kein HW-RT im Browser), saubere Authority/Projection-Trennung, gute Oracles. | `unknown-coverage != air`, Revisions-Bindung, History-Invalidierung, Stop-Regeln | Probe und Presets doppeln GFX; GPU-Timing-Gate ist so nicht messbar (R-02); Bibliotheksstände veraltet (R-01) |
| **WX** | **Konzeptionell stark, aber nicht an den Code gebunden.** Als `[RESEARCH]` einstufen, nicht `[OPEN]`. | Eine Wahrheit pro Planet, Strategie A vor B, ehrliche Modellgrenze, Hazard- und Gasriesen-Regeln | Tick-Typ passt nicht zum Universe-Clock (W-01); `AtmosphereDefinition` im Code hat nicht die Felder, die WX braucht (W-02); Determinismus-Anspruch ohne Mathe-Policy nicht erfüllbar (W-07) |
| **VW** | **Gute Render-/Interaktionsplanung, ehrliche F0-F3-Grenze.** Als Renderseite zu WX annehmen. | Ehrlichkeit zu Fluidphysik, Wasser-Tiefenproblem erkannt, Ownership-Regeln für den Renderer | Gate-IDs `WX-xx` kollidieren mit WX; Zeitbegriff und Wetterschritt (2-10 s) passen nicht zum Planetenmaßstab; Takram braucht `postprocessing`, React-Peers sind optional (V-01, V-02, V-07) |
| **DF** | **Fachlich solide, Reihenfolge teilweise überholt.** Rapier-Priorität P0 bleibt, aber der Bakeoff vom 2026-10-02 existiert und ändert die Aufgabe: nicht „Upgrade planen“, sondern drei konkrete Verhaltensblocker lösen. | Evidenzklassen, Trennung Authority / Solver, „Migration ist kein Ausschlusskriterium“ | „Kein Abschlussbericht“ ist falsch (D-01); „API-Bruch ist nur ein Implementierungsproblem“ gilt nicht, weil 0.21 Walking, Treppen und Sleeping verändert (D-07); R-F entfällt (D-09); Stand-Fakten teils veraltet (D-10) |

## 2. Querschnittsbefunde (gelten für mehrere Dokumente)

**X-01 Basis-Commit veraltet.** Alle vier nennen `25bc7f5b` bzw. `b3c6523a`. Aktuell: `origin/main` = `e40592c1`; die zwei Commits dazwischen (`0995fffe`, `e40592c1`) haben nur GFX und RT nach `docs/spielkonzept/` gelegt. BESTÄTIGT. Ergänzend sind Paketstände überholt (BESTÄTIGT per `npm view`, 2026-10-09): `three` 0.186.1 (Pin im Repo: 0.185.1), `three-mesh-bvh` 0.9.16, `three-gpu-pathtracer` 0.0.27 (RT nennt 0.0.26).

**X-02 Ein Settings-Modul existiert bereits.** `apps/weltraum-browser/src/settings/*` (Schema, Presets, Controller mit Draft/Confirmed, `GraphicsCapabilityProbe`, `GraphicsRuntimePort`), `src/render/three/graphicsSettingsAdapter.ts`, `src/ui/graphicsSettingsPanel.ts`, E2E `tests/e2e/graphics-settings.spec.ts` (in `test:e2e:ui`). 19 `GraphicsSettingId`, Presets Low/Medium/High/Ultra (`renderScale` 0.65/0.8/1.0/1.25, `renderScale`-Grenzen 0.5-1.25, `fpsLimit` ∈ {0,30,60,120}), `CapabilityStatus` ∈ {SupportedLive, SupportedAfterRendererRestart, BrowserManaged, Unsupported, Planned}. BESTÄTIGT. **Nicht vorhanden:** WebGPU-Probe, Timestamp-Query, `deviceMemory`, adaptiver Controller, Frame-p50/p95 im Produkt (p95/p99 nur in `tests/e2e/hvp-performance-evidence.ts:55`). BESTÄTIGT. Folge: GRAPH-01/02 und RT-Probe/Presets werden zu **Erweiterungen** dieses Moduls (GFX-01/02), nicht zu einem neuen Baum.

**X-03 Zwei Probes, zwei Preset-Systeme.** GFX (`detectGraphicsCapabilities`, Low-Ultra) und RT (`probeWebGpu`, Off/Auto/Contact/Hybrid/Photo) überlappen. EMPFEHLUNG: genau **ein** Probe-Vertrag (`GraphicsCapabilityProbe` erweitert um `webgpu`, `gpuTimestamp`, `adapterLimits`) und Raytracing als **eine zusätzliche Setting-Dimension** `rayTracing: off|auto|contact|hybrid|photo` und Wetter als `weatherQuality` im bestehenden ID-Satz. Beide sind **neue** IDs: VW §1.2 verlangt ausdrücklich, das vorhandene `effectsQuality` nicht still umzudeuten. RT-00/RT-01 gehen in GFX-01/GFX-03 auf.

**X-04 Referenzgerät und Budgets.** PROJEKTDOKUMENTIERT (Owner 2026-10-07): ms-Budgets sind an `HVP-PLAY-720-v1` gebunden; Ressourcen werden maximal genutzt, Budgets **geräteabgeleitet** statt kleiner Festdeckel; Nahfeld-Zellgröße ist **pro Welt** fest, Sicht-/Fernfeld-/Mesh-Dichte, später Shader und Raytracing sind **pro Gerät/Setting** skalierbar. Konsequenz: Die Zahlen „p95 Ray ≤ 2 ms“ (RT §13.2), „Main-Thread ≤ 0,5 ms“, „Render Scale min 0,65“ (GFX §11.3) sind nur Startwerte für dieses Gerät. Jede Gate-Zahl in Paketkarten nennt das Gerät (GOV-01).

**X-05 Fluide werden dreifach geplant.** WX W4/F2 (lokales 3D-Fluid, 64³), DF Phase E (Salva-SPH / Nexus-MPM / Dammbruch / Rohrnetz), RT-/GFX-Wasser (nur Darstellung). EMPFEHLUNG: **ein** Entscheidungspaket FLD-01 (Wasser-/Fluid-Authority: wer besitzt Menge, Druck, Fluss, Persistenz; was ist reine Projektion). WX-W4, DF-Phase-E und GFX-04 sind Konsumenten.

**X-06 WASM wird zweifach geplant.** GFX-05 (Meshing/AO/Kompression) und DF R-F (eigener Rust-0.36.1-Build; **entfällt**, D-09), dazu Nexus (Rust/WASM+WebGPU) und WX-Strategie B (Gridkern). EMPFEHLUNG: **eine** Policy PLT-01: Toolchain-Pin, Artefakt-Digests, Fallback ohne SIMD (der Bakeoff prüfte SIMD-Fallbackauswahl nur im Test, nicht auf einem Browser ohne SIMD), SharedArrayBuffer nur mit entschiedenem COOP/COEP (siehe §5.7), Lizenz-/Provenienzprüfung. Rapier selbst ist bereits WASM (`tests/performance/hvp-performance.spec.ts:77` hasht `rapier_wasm3d_bg.wasm`; ab JS 0.20 liegen die `-compat`-Dateien unter `dist/`, der Pfad bricht).

**X-07 Determinismus-Policy fehlt.** WX verlangt „identische Bytes“ (W-DET-01, W-TIME-02) und DF/RT verlangen Replay/Hash-Gleichheit. In JS sind `Math.sin/cos/exp/pow` laut ECMA-262 nur angenähert und zwischen Engines nicht bitgleich (BESTÄTIGT, §5.4). Ohne eigene Policy sind „maschinenübergreifend identische Wetterbytes“ nicht erfüllbar. EMPFEHLUNG: PLT-02.

**X-08 Paket-IDs kollidieren nicht, hängen aber voneinander ab.** GRAPH-*, RT-*, WXG-*, DF-Phasen A-F, dazu die bestehende Master-Plan-Gruppierung `P00-P14` (`docs/roadmap/living-master-plan.md`, dort Stand 2026-07-13, `P04.04.02 Atmosphere/Cloud/Lighting Foundation` und `P04.04.04 Planetweite Terrain-/Biome-Generierung` = `[DEFERRED]`). Die einheitliche Registry steht in §7; sie ordnet jedes Paket einem P-Eintrag zu.

**X-09 Schreibkonflikte mit Cut-V3.** Dauerhaft betroffene „Freeze-Zone“ (Branches `feature/hvp-cut-rt-v3-*`, `feature/resume-hvp-cut-v3-2026-10-05`, `feature/hestia-cut-core-experiments-2026-10-07`, `agent/hvp-parallel-p0*`): `src/hestia-prototype/physics/**`, `src/hestia-prototype/persistence/**`, `src/hestia-prototype/terrain/**`, `src/hestia-prototype/presentation/visualEffects.ts`, `src/hvp/hvpBootstrap.ts`. Kein Paket außer ausdrücklich freigegebenem Produkt-Handoff schreibt dort (PHY-03, GFX-06, RT-07, WXG-04+). BESTÄTIGT (Branchnamen), die genauen Dateimengen der Branches sind OFFEN.

**X-10 WebGPU-Typen fehlen im Repo.** Kein `navigator.gpu`, `GPUAdapter` oder `@webgpu/types` in `src`, `tests`, `tsconfig.json`, `package.json`; `tsconfig` hat `lib ["ES2022","DOM","DOM.Iterable"]`, TypeScript 7.0.2. BESTÄTIGT. Ob `three/webgpu`-Typen allein genügen, ist OFFEN. Spikes pinnen bei Bedarf `@webgpu/types` im Spike-Paket, nicht im Produkt-`package.json`.

**X-11 Ein `solver`-String ist an vier Stellen hart verdrahtet.** `worldCheckpoint.ts:17,49` (strikte Gleichheit, lehnt andere Werte ab), `gameCheckpoint.ts:21`, `session.ts:234`, `tests/e2e/hvp-visible-coast.spec.ts:1063`. Jeder Rapier-Bump invalidiert damit gespeicherte Checkpoints und kollidiert mit der offenen Cut-V3-Entscheidung zur persistierten Quellidentität (`owned-subset-v1`). BESTÄTIGT / PROJEKTDOKUMENTIERT. Migration nur im Paket PHY-03 und mit Cut-V3-Save-Vertrag abgestimmt.

## 3. Review je Dokument

### 3.1 GFX (Adaptive Shader- und Grafikarchitektur)

| ID | Befund | Klasse | Korrektur |
|---|---|---|---|
| G-01 | §13 schlägt `src/graphics/{capabilities,telemetry,quality,materials,effects,backends}` vor. `settings/` + `render/three/graphicsSettingsAdapter.ts` decken Capabilities, Presets, Draft/Confirmed und Runtime-Port bereits ab (X-02). | BESTÄTIGT | GRAPH-01/02 → GFX-01/02: erweitern. Neu bleibt nur `src/render/telemetry/**` (Frame-Fenster) und der pure Controller. `materials/effects/backends` erst nach GFX-03-Entscheid. |
| G-02 | §11.3-Schema `GraphicsSettingsV1` (`preset`, `targetFps`, `resolution.dynamic`) parallel zum bestehenden Schema v1 (`storage key weltraum.browser.graphics-settings`). | BESTÄTIGT | Kein zweites Schema. Neue Felder als Schema-v2-Migration im bestehenden Store; flüchtiger Zustand (`currentScale`) bleibt im `GraphicsRuntimeSnapshot`, nie im persistierten Setting (deckt GFX-Aussage §11.3 ab). |
| G-03 | Controller-Ziel „Render Scale zuerst“ ist umsetzbar: `renderScale` und `maxDevicePixelRatio` sind bereits live setzbar (`SupportedLive`). | BESTÄTIGT | GFX-02 treibt nur diese Settings; kein Rendererwechsel nötig. |
| G-04 | `powerPreference` wird nirgends gesetzt (`threeRenderBackend.ts` ~425-430, `visualEffects.ts:47`, `debugScene.ts:280`). GFX §6.4 nennt es nur als Hinweis. | BESTÄTIGT | Als Setting „Energieprofil“ in GFX-01 führen, mit dokumentierter Neuinitialisierung („nach Renderer-Neustart“). |
| G-05 | `detect-gpu`: GFX nennt keine Bibliothek, RT/GFX-Recherche legt sie nahe. Das unscoped Paket `detect-gpu` ist veraltet (5.0.70, 2025-02-23); gepflegt ist `@pmndrs/detect-gpu` 6.0.25 (2026-10-04). Die Benchmarkdatenquelle (gfxbench.com) wird seit Dez 2025 nicht mehr aktualisiert. | BESTÄTIGT | **Keine neue Abhängigkeit.** GFX selbst lehnt GPU-Namenstabellen als Hauptentscheidung ab. Falls später gewünscht: nur das scoped Paket, nur als Starthinweis. |
| G-06 | GPU-Timing: `EXT_disjoint_timer_query_webgl2` wurde in Chrome 2018 deaktiviert (aktueller Status OFFEN, Verfügbarkeit teilweise); WebGPU-`timestamp-query` ist in Chrome auf 100 µs quantisiert (Flag nur für Entwicklung). | BESTÄTIGT (Quelle) / OFFEN (aktuelle Chrome-Lage) | GFX-01 verspricht **CPU-seitige Frame- und Pass-Zeiten** als Pflicht und GPU-Pass-Zeiten als best-effort mit `unavailable`. Kein Gate unterhalb von ~0,2 ms. |
| G-07 | Portierungsfläche für WebGPURenderer ist **klein**: nur `presentation/visualEffects.ts` (ein `ShaderMaterial` für den Himmel, `onBeforeCompile` für Wasser/Oberfläche) und `tests/unit/hvp-visual-effects.test.ts`. Kein `EffectComposer`, kein `WebGLRenderTarget`, kein `RawShaderMaterial`. 18 Dateien importieren `three`. | BESTÄTIGT | GFX-03 kann HVP-nahe Fixtures realistisch abbilden. Aber: r186 hat `PCFSoftShadowMap` für WebGPURenderer entfernt, nur die Shadow-Stufe `High` (Preset Ultra) nutzt PCFSoft, die Preset-Stufe High nutzt Shadow `Medium` = PCF (`presets.ts:81-85`) → Mapping für Ultra im Backend-Adapter nötig. |
| G-08 | Three.js `WebGPURenderer`: Doku nennt ihn „neue Alternative“ mit WebGL2-Fallback und **nicht** mehr ausdrücklich „experimentell“ (Abruf 2026-10-09). GFX/RT behaupten „experimentell“; RT zitiert das Handbuch `threejs.org/manual/pages/webgpurenderer.html`, das hier **nicht** gelesen wurde. | BESTÄTIGT (Doku-Seite) / OFFEN (Handbuch) | Keine Korrektur der Quelldokumente auf Basis einer Seite; GFX-03 liest Doku **und** Handbuch am gepinnten Stand. Die Entscheidung (WebGL2 als Referenz, WebGPU isoliert) bleibt wegen G-09 richtig. |
| G-09 | WebGPU-Verfügbarkeit: caniuse ≈ 87,8 % global; Firefox-Angaben widersprüchlich (caniuse „aus“, Mozilla/Sekundärquellen: Windows ab 141, Apple-Silicon ab 147); Linux-Firefox und Safari-Primärnotizen OFFEN. | BESTÄTIGT / OFFEN | WebGL2 bleibt Referenz- und Fallbackpfad. Die Browser-Unterstützungsmatrix ist Teil von GFX-01-Evidence, nicht Annahme. |
| G-10 | Doku-Migrationsliste r185/r186 (BESTÄTIGT, Wiki): u. a. r185 WebGPURenderer premultiplied alpha, TSL-Umbenennungen; r186 `PCFSoftShadowMap` entfernt, `LightProbeGrid` umbenannt. | BESTÄTIGT | Pin-Update 0.185.1 → 0.186.1 ist eigener kleiner Change (GFX-03 Voraussetzung, nicht in Cut-V3 mischen). |
| G-11 | `compileAsync` und `KHR_parallel_shader_compile` konnten nicht auf der Three-Doku-Seite gefunden werden (§5.3 GFX). | OFFEN | In GFX-03 am gepinnten Source prüfen, nicht aus der Doku zitieren. |
| G-12 | GFX §10.2 „Block-AO aus Voxelnachbarschaft, revisionsgebunden“: deckt sich mit der Authority/Derived-Regel (`world-runtime-render-backend-boundary.md`). Aber „AO nach Zerstörung neu berechnen“ konkurriert mit dem Ziel Cut p95 ≤ 120 ms (Owner 2026-10-07). | PROJEKTDOKUMENTIERT | AO-Neuberechnung läuft im Presentation-Pfad nach dem Commit, niemals im Cut-Latenzpfad; Messpunkt `t_ao_visible` getrennt von `t_cut_committed` (GFX-04). |

### 3.2 RT (Cross-Vendor-Raytracing)

| ID | Befund | Klasse | Korrektur |
|---|---|---|---|
| R-01 | Stände: RT nennt `three-gpu-pathtracer` 0.0.26, aktuell ist 0.0.27 (2026-10-08); `three-mesh-bvh` aktuell 0.9.16 (2026-10-08); Peer-Anforderung des Pathtracers: `three >= 0.185.0`, `three-mesh-bvh >= 0.9.15`. Pathtracer-WebGPU-Pfad: „benötigt WebGPU“, kein WebGL-Fallback. | BESTÄTIGT | RT-08 pinnt 0.0.27 oder dokumentiert die Wahl; `three` bleibt im Spike auf dem Pin des Spikes (nicht des Produkts). |
| R-02 | Das Gate „Ray-Pass p95 ≤ 2 ms“ ist nur messbar, wenn GPU-Zeit verfügbar ist; WebGPU-Timestamps sind in Chrome auf 100 µs quantisiert, WebGL-Timer sind unzuverlässig (G-06). | BESTÄTIGT | Gate wird CPU-seitig über Frame-Differenz A/B (mit/ohne Ray-Pass, gleiche Kamera) plus optional GPU-Timestamps formuliert; Median über ≥ 300 Frames. |
| R-03 | `gpuweb#535` (Ray tracing extension): offen, Milestone „4+“, kein Chrome-Origin-Trial in Suchen gefunden. | BESTÄTIGT (Issue) / OFFEN (Firefox, Safari) | RT-Kernaussage „kein HW-RT im Browser“ bleibt; „nicht auf Standard warten“ ebenso. |
| R-04 | Default-Limits: `maxStorageBufferBindingSize` 128 MiB, `maxBufferSize` 256 MiB, `maxStorageBuffersPerShaderStage` 8. Die RT-Zahl „32 KiB pro dichtem 32³-Chunk“ ist korrekt (32³ × 1 B). **BERECHNET:** 128 MiB / 32 KiB = **4096 dichte Chunks pro Binding**; bei 0,25 m Zellen (8-m-Chunk) sind das 16³ Chunks = **128-m-Würfel**. Das trägt den 32-64-m-Ray-Radius des Spikes, aber nur bei Default-Limits und dichter Belegung. | BESTÄTIGT (Limits laut Spezifikation) / BERECHNET | RT-02B misst Residency gegen **angefragte** Adapterlimits, nicht gegen Defaults; Sparse-Brick-Tabelle ist Pflicht, sobald Region > 128 m. `maxComputeInvocationsPerWorkgroup` und `maxComputeWorkgroupSizeX`: Wert 128 vs. 256 **OFFEN** (128 könnten Compat-Mode-Defaults sein), an der Core-Limits-Tabelle der Live-Spezifikation prüfen. Die Werte 128 MiB / 256 MiB / 8 / 4 sind davon unberührt. |
| R-05 | Voxel-Owner läuft laut Owner-Entscheidung (2026-10-07) als **eigener Worker**. RT §7 baut `RaySceneSnapshot` „aus der Authority“, ohne Besitzer zu nennen. | PROJEKTDOKUMENTIERT | `RaySceneSnapshot` wird vom Voxel-Owner-Worker als transferierbarer, immutabler Snapshot erzeugt; Producer: Owner-Worker, Consumer: Render-Thread, Transfer per `postMessage` mit Transferables. In RT-03 als Interface-Annahme dokumentieren. |
| R-06 | Hestias Nahfeld-Zellgröße ist pro Welt fest; Sub-0,125-m-Authority braucht Contract-Amendment (Cut-V3). RT §2.2 schreibt keine globale Zellgröße vor. | PROJEKTDOKUMENTIERT | Ist konform. `voxelMeters` stets aus Quellprofil lesen; Fixtures mit mindestens zwei Zellgrößen (0,25 und 0,125 m). |
| R-07 | Vergleichsvorlage fehlt: „kein Browser-WebGPU-Voxel-DDA-Demo gefunden“. Nächstes Analogon: `three-mesh-bvh` GPU-Pathtracing-Beispiel (BVH, Compute). Voxel-DDA-Referenz: `dubiousconst282/VoxelRT` vergleicht flaches DDA (~28 Mrays/s), Zwei-Ebenen-Brick-DDA, ESVO, Tree64 (~110 Mrays/s) auf nativer API. | BESTÄTIGT (Quelle) / HYPOTHESE (Übertragbarkeit) | RT-02B bewertet mindestens flaches Brick-DDA **und** eine Zwei-Ebenen-Variante; die Zahlen sind Orientierung, kein Ziel. |
| R-08 | „`three-mesh-bvh/webgpu` ist instabil, braucht r185“ (RT §5.3) und `BVHComputeData`: nicht in der gelesenen README bestätigt. Export `./webgpu` existiert; Hauptpaket-Peer `three >= 0.159.0`. | OFFEN | RT-02A liest `WEBGPU_API.md` am gepinnten Tag und dokumentiert Stabilitätsstatus und Mindest-`three`. |
| R-09 | RT-07 („Produkt-Handoff“) und RT-08 („Fotomodus“) sind in RT als Pakete geführt, aber ohne Eigentümer des Renderer-Einstiegs. | EMPFEHLUNG | RT-07 ist ein Gate-Paket, das GFX-06 mitbenutzt (ein gemeinsamer Renderer-Eingriff, nicht zwei). |
| R-10 | Rasterbasierte Alternativen (SSAO/GTAO, Shadow-Maps) sind der Vergleichsmaßstab von RT-04. Three.js `GTAONode` existiert für WebGPU; für WebGL2 nicht. | BESTÄTIGT (Doku, GFX §10.2) | RT-04-Gate „visuell nachweisbarer Mehrwert gegenüber SSAO/Shadowmaps“ vergleicht auf **demselben** Backend; sonst bleibt der Mehrwert Backend-, nicht Ray-bedingt. |

### 3.3 WX (Planeten-Wetter- und Climate-Core v2)

| ID | Befund | Klasse | Korrektur |
|---|---|---|---|
| W-01 | WX §15 definiert `TickUs: string` (Mikrosekunden-Dezimalstring). Der Universe-Clock (`spatial/universeClock.ts`, `persistence/time.ts`) zählt `SimulationTick` als JS-`number`, `UNIVERSE_TICKS_PER_SECOND = 120`, Ticks ≤ `Number.MAX_SAFE_INTEGER`. | BESTÄTIGT | Wetter-Zeit = `SimulationTick` (120 Hz) und daraus abgeleiteter diskreter `weatherStep = floor(tick / ticksPerWeatherStep)`. Kein zweiter Zeitbegriff. Gilt für `WeatherEpochBindingV2.currentWeatherTickUs` und `PlanetWeatherQueryV2.atTickUs`. |
| W-02 | WX stützt sich auf Atmosphäreneigenschaften (Gasmischung, Skalenhöhe, Druckprofil, Außenradius). Im Code hat `AtmosphereDefinition` nur `hasAtmosphere`, `surfacePressurePa?`, `hazards` (`celestial/types.ts:50-69`); `GasMixture`, `scaleHeightMeters`, `atmosphereOuterRadiusMeters` stehen nur im Spec-Doc (`celestial-runtime-data-contract.md` §10), nicht im Code. Es fehlen außerdem Bond-Albedo, innere Wärme, Sterndaten-Bindung für Einstrahlung. | BESTÄTIGT | Vorpaket **CEL-01** vor WXG-00: ein **neues, versioniertes Profil** `AtmospherePhysicsProfile` (Gasmischung, Skalenhöhe, Außenradius, Albedo, innere Wärme, Sternbindung) und `AtmosphereOpticsProfile`, vom Körper per `{id, version, digest}` referenziert. Das entspricht VW §1.2/§11.1 („Definition nicht ungesehen erweitern, neue versionierte Referenz“) und vermeidet eine stille In-Place-Schemaänderung von `AtmosphereDefinition`. Dazu: Validierung gegen `AtmosphereDefinition` (Hazards, Druck konsistent), `starterSystem.ts` pflegen, `celestial-gravity-core`-E2E erweitern. |
| W-03 | `docs/research/planet-lod-streaming-reference-audit-v1.md` §10 definiert bereits `AtmosphereRenderInput` mit `WeatherSnapshotId`, Windvektor im Körperframe, Wetterzeit/Epoch. | BESTÄTIGT | WX-Ergebnisobjekt liefert diese Felder; **kein** paralleler Name. `WeatherSnapshotId` = Hash über `(bodyId, weatherStep, profileDigest, authorityRevision)`. |
| W-04 | WX `MacroGeographyAtlasV1` ist faktisch das, was `procedural-voxel-planet-runtime.md` §5.1 „Planetary Macro Data“ nennt (grobe Höhen-/Klima-/Biome-/Material-/Hazardkanäle, klein, deterministisch). Ein zweiter Atlas wäre eine zweite Autorität. | BESTÄTIGT | WXG-01 definiert `MacroGeographyAtlasV1` als **Profil/Projektion von Planetary Macro Data**, nicht als neue Quelle. Das Klimakanal-Feld dort ist der Platz für `ClimateNormals`-Digest. SurfaceTile-Adressen (Body, Cube-Face, Level, x, y) werden für W1 wiederverwendet, W1-Gridlevel ist vom Terrain-LOD entkoppelt (WX stimmt zu). |
| W-05 | Gittergrößen für Hestia (R = 8.282 km, `starterSystem.ts:137`): Face-Kante π/2·R ≈ 13.009 km. **BERECHNET:** 32² → 406,5 km/Zelle (6.144 Zellen); 48² → 271,0 km (13.824); 64² → **203,3 km (24.576)**; 96² → 135,5 km; 128² → 101,6 km. Speicher 64²×4 Level×8 Kanäle×4 B = 3 MiB (WX-Angabe stimmt). Äquiangulare Zellen sind zu den Ecken kleiner (Verhältnis OFFEN). Ein 1.000-km-Frontsystem überdeckt bei 64² nur ~5 Zellen. | BERECHNET | Spike-Matrix in WXG-07 um 96²/128² ergänzen; Aussage „Gewitterzellen sind Subgrid“ bleibt richtig. |
| W-06 | Zeitschritt 10/30/60 min „nur Testprofile“ (WX §7.2). **BERECHNET** mit Δt ≤ Δx / (u + c): Hestia hat g = μ/R² = 11,79 m/s² (`starterSystem.ts:138`), bei T = 288 K und Erdluft ist H ≈ 7,0 km. Wellengeschwindigkeit je nach Modellterm: externe Schwerewelle c = √(gH) = √(RT) ≈ 287 m/s oder Lamb-Welle c = √(γRT) ≈ 340 m/s. Bei 64² (Δx = 203 km) ergibt das **Δt ≲ 11,8 min** (√(gH)) bzw. **≲ 10 min** (√(γRT)), jeweils ohne Wind; bei 48² ≲ 15,7 / 13,3 min, bei 32² ≲ 23,6 / 19,9 min. Advektion allein (u = 100 m/s, Courant 1) erlaubt ~34 min bei 64². Die Profile 30/60 min sind für ein explizites Schwerewellen-Schema nicht stabil. | BERECHNET | WXG-07 muss entweder semi-implizit/Subcycling oder ein gefiltertes Modell (kein Schwerewellenterm) wählen, oder Δt ≲ 10 min (konservativ, 64²) festlegen. Die Entscheidung ist ein Spike-Ergebnis, nicht Vorgabe. |
| W-07 | WX verlangt Byte-Gleichheit (W-DET-01, W-TIME-02, Replay full vs checkpoint+tail). `Math.sin/cos/exp/pow` sind laut ECMA-262 implementierungsabhängig angenähert; Chrome und Firefox weichen für gleiche Eingaben ab. + − × ÷, `sqrt`, `Math.fround`, `Math.imul` sind exakt/bitgleich. WASM ist deterministisch bis auf NaN-Bitmuster; Relaxed-SIMD nicht architekturübergreifend. | BESTÄTIGT (Quellen §5.4) | PLT-02: Zustandspfad nur mit + − × ÷ `sqrt`, Integer-/Fixed-Point; `sin/cos/exp/log` als eigene Festkoeffizienten-Polynome mit Hex-Float-Konstanten; kanonische Little-Endian-Serialisierung; **keine GPU in der Autoritätskette**. Counter-based RNG: Threefry-2x32 oder PCG3D (nur u32; Philox braucht 32×32→64-Multiplikation, die WGSL nicht hat). |
| W-08 | WX Strategie B (Grid + Checkpoints + Replay) braucht persistierten Wetterzustand. Persistenz-Dokumente führen Planeten nur als Katalogdefinition, **ohne** Dormant-/Wetterzustand (`persistence-and-offline-simulation.md`: persistierte Objektarten Ships, Drones, Stations, Bases, Missions, Autopilot-Pläne, Cargo, Discoveries); `background-simulation-boundaries.md` erlaubt für „surface weather windows“ ausdrücklich nur analytische/vereinfachte Simulation. | BESTÄTIGT | Strategie A ist mit dem Bestand vereinbar (Seed + Epoch + Event-Journal). Strategie B ist eine **neue persistierte Domäne** → Save-Vertrag-Änderung (P12) mit Owner-Gate. WX-Empfehlung „A für v1, B nur nach Spike“ wird zur Pflicht. |
| W-09 | Objektgebundener Timewarp: `autopilot-timewarp.md` Z.21: Planetenrotation, Wetter, Wirtschaft laufen in **normaler Spielzeit** weiter. | BESTÄTIGT | Catch-up (WX §8) betrifft nur Offline-/Save-Lücken, nicht Timewarp. Das senkt das Risiko von B; der Replaykostentest in WXG-07 nutzt realistische Offline-Lücken statt beliebiger Zeitsprünge (Offline-Lücke OFFEN, P12). |
| W-10 | Hestia deklariert die Hazards `HighPressure, HighOxygen, Storms` (`starterSystem.ts:149-154`). WX §5 kennt dazu kein Konsistenzgebot. | BESTÄTIGT | Validator in WXG-02: Hazardflag `Storms` ⇒ Profil enthält ein Sturmmodell mit Eintrittswahrscheinlichkeit > 0; umgekehrt kein Sturm ohne Flag. Hazards bleiben Autoren-Input, Wetter liefert nur Details. |
| W-11 | Master-Plan führt `P04.04.02 Atmosphere/Cloud/Lighting Foundation` als `[OPEN]` mit „datengetrieben, ohne vollständige Wetter-/Aero-Simulation“ und `P04.04.04` (planetweite Terrain-/Biomgenerierung) als `[DEFERRED]`. | BESTÄTIGT | WXG-01 (planetweiter Atlas) hängt faktisch an P04.04.04. Einstufung: WXG-00..03 `[RESEARCH]`; WXG-04+ erst nach Surface-Vertical-Slice. Render-Port WXG-05 konsumiert die Hülle aus P04.04.02, ersetzt sie nicht. |
| W-12 | Klimakompilierer „billig und physikalisch motiviert“ (WX §6.1): Konkrete Bausteine aus der Recherche (§5.2): Energiebilanz-Modell (Budyko-Sellers), Held-Hou-Zirkulation, Held-Suarez als Benchmark. Hadley-Breite skaliert mit Rotationsrate Ω: axialsymmetrisch ∝ Ω⁻¹, mit Eddy-Einfluss ∝ Ω⁻¹ᐟ³ (Mitchell & Hill 2021). Hestia dreht 36 h (Ω ≈ 0,67 Ω_Erde, `starterSystem.ts:143-148`), also breitere Zellen als Erde. | BESTÄTIGT (Quelle) / HYPOTHESE (Übertragung) | WXG-02 implementiert genau diese drei Bausteine, Rotationsabhängigkeit als Parameter, und vergleicht die Hestia-Normals mit Held-Suarez-Ergebnissen qualitativ. |
| W-13 | Wolkenrendering aus der Wetterkarte: Nubis-Vortragsreihe (SIGGRAPH 2015/2017/2022/2023) ist die nächste dokumentierte Referenz (2D-Wetterkarte, Höhenprofil je Wolkentyp, Shape-/Detailrauschen). Die konkrete Datenmodell-Aussage ist nur aus dem Gedächtnis des Rechercheagenten. | OFFEN | WXG-05 beginnt mit Lesen von Nubis 2015 und 2022 und legt das tatsächliche Kanalmodell in die Evidence. Keine Zahl aus diesem Review verwenden. |
| W-14 | Hestia-Atmosphäre 145 kPa: Faktor 1,43 gegen Erde; bei g = 11,79 ist die Säulenmasse P/g = 12.300 kg/m² (Erde ≈ 10.330, ×1,19). Skalenhöhe bei 288 K und Erdluft ≈ 7,0 km. Plausibel, die Gaszusammensetzung ist **nicht** im Code (W-02). | BERECHNET | Skalenhöhe nie aus Erd-Defaults annehmen; sie folgt aus `CEL-01`-Feldern. |
| W-15 | Kondensat-Basisdaten für Profile (§5.3) wurden teils nur aus Gedächtnis genannt (Tripelpunkte CH₄, CO₂, N₂; Fray-&-Schmitt-Fits). Magnus-Form für H₂O (6,1094·exp(17,625·T/(T+243,04)) hPa, T in °C; Alduchov & Eskridge 1996) ist per Quelle bestätigt. | BESTÄTIGT (H₂O) / OFFEN (übrige) | WXG-02 zieht Koeffizienten aus NIST WebBook / Fray & Schmitt, nicht aus diesem Review; Gültigkeitsbereich je Spezies im Profil. |
| W-16 | WX §8 „Pending statt erfundenem Default“ ist richtig, aber Sicherheitsaktionen (Flug) sind heute **nicht** wetterabhängig (WX §18 stimmt zu: `VisualOnly/GameplayUnavailable`). | BESTÄTIGT | Kein Paket schreibt Wind-/Aerodynamik in Flight; das bleibt ein eigenes Folgepaket außerhalb dieser Registry. |
| W-17 | WX-Paket WXG-06 (lokales Fluid) überlappt DF Phase E und GFX-04 (X-05). | EMPFEHLUNG | WXG-06 wird nach FLD-01 ein reiner Konsument für Luft-/Wake-Volumen. |

### 3.4 DF (Dimforge-Technologie-Audit)

Aus dem Repo und dem Bakeoff-Bericht BESTÄTIGT (externe Paketfakten: §4.2):

| ID | Befund | Klasse |
|---|---|---|
| D-02 | **Migrationsfläche Rapier 0.12.0.** Ein einziger Value-Import in `src/hestia-prototype/physics/rapierPort.ts:1`; 12 Source-Dateien unter `hestia-prototype/{physics,player,persistence}` nutzen `R` über den Port (≈ 100 Aufrufstellen, ≈ 25 Rapier-spezifische Query-/Desc-Konstruktoren). Vier Unit-Tests importieren Rapier direkt (`structuralPgTragwerk{F7,R3,R4,Slice2}.test.ts`). Genutzt: `World`, `RigidBodyDesc.{dynamic,fixed,kinematicPositionBased}`, `ColliderDesc.{trimesh,cuboid,capsule}`, `setMassProperties`, `castRay`/`castRayAndGetNormal`/`castShape` (positionale Argumente), `createCharacterController`/`computeColliderMovement`, `applyImpulseAtPoint`, CCD, Sleep/WakeUp. **Nicht** genutzt: `ColliderDesc.compound`/`convexHull`, `takeSnapshot`/`restoreSnapshot`, `EventQueue`, Joints, `integrationParameters`. | BESTÄTIGT |
| D-03 | Prüfstellen für die Migration: `.toi` an ≈ 9 Stellen (`bodyCut.ts:38`, `branchSession.ts:56,61`, `session.ts:152,154,157`, `locomotion.ts:42,93,94`), `.timeOfImpact` nirgends; Workaround-Kommentar `rapierPort.ts:12-18` (numerisches `EXCLUDE_SENSORS`-Flag verhielt sich in 0.12 falsch, stattdessen Prädikat); Kommentar `tests/unit/structuralPgTragwerkR3.test.ts:410-415` (`body.principalInertia()` für Mehrfach-Collider-Körper in 0.12 falsch, Test meidet es). Ob 0.21 diese Punkte ändert, ist OFFEN. | BESTÄTIGT (Stellen) / OFFEN (Verhalten) |
| D-04 | Persistenz: Checkpoints sind **projekteigenes Format** (`encodeHvpBody`, World-Checkpoint), keine Rapier-Snapshots. Das senkt das Risiko des DF-§11-Punkts „alte WASM-Snapshots“ erheblich. Hart verdrahtet bleibt der `solver`-String (X-11). | BESTÄTIGT |
| D-05 | Das DF-Dokument ist die einzige Quelle, die „nur Greedy-Cuboid-Compound vs Voxel-Cuboid-Compound“ (PG-TRAGWERK-R3) als Baseline nennt. Im Produktcode existiert **kein** `ColliderDesc.compound`; „Compound“ bedeutet dort mehrere Cuboid-Collider an einem Körper. Die DF-Kandidaten C2 (Greedy-Cuboid-Compound) ist als Multi-Collider-Körper zu lesen. | BESTÄTIGT |
| D-06 | Im Repo gibt es keinen Branch mit „rapier“ oder „bakeoff“ im Namen und keinen Commit `bfa6efce`; Commits mit „rapier“: `9341fb90`, `192a3ffb`. Der Ergebnisbericht des Bakeoffs existiert nur als PDF plus (nicht auffindbares) Begleitarchiv (siehe D-01). | BESTÄTIGT |
| D-01 | **Der Rapier-Bakeoff vom 2026-10-02 liegt als Ergebnisbericht vor** (PDF, §4.2): Kandidaten A 0.12 compat, B 0.21 compat, C 0.21 simd-compat, D 0.21 deterministic-compat, E 0.21 `@dimforge/rapier3d` (non-compat); Entscheid **KEEP 0.12 FOR NOW**, B-E `REQUIRES LARGER SPIKE`; Stopregeln des Auftrags griffen. DF §1 und Phase A („Vorhandenen Bakeoff suchen“) sind damit erledigt: **vorhandene Evidenz wiederverwenden**, nicht neu messen. | BESTÄTIGT (PDF gelesen; Rohdaten nicht verfügbar) |
| D-07 | **Verhaltensdrift statt reiner API-Bruch.** Unveränderte HVP-Tests: A 91/91; direkter Pakettausch B/C/D 33/91; mit Shim 65/91 (26 Restfehler: branch-session 3, locomotion 3, mass-inertia 2, moving-cut 8, moving-session 5, physics 1, world-save 4). Walking nach 60 Schritten z = −3,000028 m (A) vs −2,905889 m (B): **9,41 cm gegen Toleranz 1 cm**; feinste Treppe: A ungrounded, B grounded (0,125-m-Autostep); Sleep: erster Schlaf Tick 169 (A) vs 82 (B); nach 1200 Schritten schlafen die A-Kinder, B/C/D/E bewegen sich weiter (x-Abweichung 3,37/3,83 m). Ursachen laut Bericht **nicht isoliert**. | BESTÄTIGT (PDF) |
| D-08 | Zwei **HYPOTHESEN** für die Ursachen, aus dem Changelog abgeleitet (zu prüfen, nicht bewiesen): (a) Rust 0.35.0-beta.0 änderte Sleep-Schwellen (`normalized_linear_threshold` 0,4 → 0,05, `time_until_sleep` 2,0 → 0,5 s), was zum Sleep-Befund (früherer Erstschlaf, kein Endschlaf) passt, **sofern** die JS-API diese Aktivierungsparameter bereitstellt (OFFEN, sonst ist der erste PHY-01-Schritt nicht ausführbar und Alternativen wie ein Kontrollbody mit manuellem `sleep()` zu prüfen); (b) JS 0.13.0: `FIX_INTERNAL_EDGES` ist für Trimeshes nicht mehr standardmäßig an; HVP erzeugt Terrain über `ColliderDesc.trimesh` (`session.ts:69,394`, `neighborRegion.ts`), was zu Walking-/Treppendrift passen kann. | HYPOTHESE (Quellen: Rapier-Changelogs, §4.2) |
| D-09 | **R-F (eigener Rust-0.36.1-WASM-Build) entfällt:** es gibt auf crates.io kein `rapier3d` 0.36.1 (aktuell 0.36.0); das GitHub-Tag v0.36.1 enthält laut Changelog nur Python-Binding-Einträge. Der Build brächte keinen Physikunterschied gegenüber JS 0.21.0. | BESTÄTIGT |
| D-10 | Weitere Stand-Korrekturen zu DF: (1) PR #71 (Dependabot, `0.12.0 → 0.20.0`, offen, Stand 2026-09-21) hebt nur `package.json`/Lockfile; sein Text zitiert den Rust-Changelog „v0.20.0 (9 June 2024)“ statt JS 0.20.0 (2026-08-08) und ist irreführend; JS 0.21.0 ist neuer. Empfehlung an GOV-01: PR schließen oder auf Zielversion umstellen, **nicht** mergen (Bruch, D-07). (2) Der Nexus-Crate heißt auf crates.io nicht `nexus`: echte Pakete sind `nexus2d/3d`, `nexus_rbd2d/3d`, `nexus_mpm2d/3d`, `nexus_viewer2d/3d` (0.6.0, 2026-10-04). (3) Nexus-MPM koppelt laut README nur **einseitig** (Starrkörper schieben Partikel, nicht umgekehrt). | BESTÄTIGT |
| D-11 | **Zusätzliche Migrationsstellen aus dem Changelog** (JS 0.12 → 0.21, BESTÄTIGT, §4.2): `.toi` → `.timeOfImpact` (0.13.0; HVP ≈ 9 Stellen), `castShape` bekommt `targetDistance` vor `maxToi` (0.13.0; `locomotion.ts:40,76`), `updateSceneQueries` fehlt in 0.21 (neue Collider sind erst nach einem `step` abfragbar: **Blocker**, bestätigt im Bakeoff), Character-Controller-Filter `c => !c.isSensor()` kann einen WASM-Borrow hinterlassen (`world.free()` wirft; `locomotion.ts:69` und `rapierPort.ts:12-18`), `-compat`-Dateien unter `dist/`, `World`-/`PhysicsPipeline.step`-Signatur mit `SoftBodySet` (0.21.0; ob der `World.step()`-Wrapper schützt: OFFEN), `invPrincipalInertia`-Umbenennung (0.19.0). Native WASM-Snapshots früherer Versionen sind ab Rust 0.36.0 nicht ladbar; HVP nutzt sie nicht (D-04). | BESTÄTIGT / OFFEN |
| D-12 | Bakeoff-Messbasis: Chromium 134 headless, Linux-VM (AMD EPYC), Node 24, `--single-process`; keine Aussage über Zielbrowser oder Nutzergerät. SIMD (C) ergab bei contact-heavy −69,7 % CPU gegen A, aber +25 % bei fixed gegen B; Init B +86 % (68,5 ms gegen 36,9 ms), gzip-Bundle B ≈ +97 % gegen A (1,81 MB vs 0,92 MB); E (non-compat) spart gegen B 22,9 % gzip und läuft mit Vite 8.1.5 ohne Plugin. CPU-Unterschiede sind wegen der Sleep-/Kontaktdrift nur explorativ. | BESTÄTIGT (PDF) / Messbasis begrenzt |

### 3.5 VW (Vorgänger: Dynamisches volumetrisches Wetter, nachgereicht)

VW (Basis `main` `25bc7f5b` plus Feature-Branch `aa2eabd9`) ist die Render-/Interaktionsseite, WX die Autoritätsseite. WX §24 erklärt, WX „ersetze die allein auf Hestia ausgerichteten Profilschwerpunkte“ von VW. Beide bleiben gültig, mit folgender Arbeitsteilung: **WX besitzt Wetterautorität, Zeit, Profile; VW besitzt Renderpfad, Lichtung, F0-F3-Interaktion, Editor-Klassen.**

| ID | Befund | Klasse | Korrektur |
|---|---|---|---|
| V-01 | **Paket-ID-Kollision.** VW nennt seine Gates `WX-00..WX-08`, WX nennt seine `WXG-00..WXG-08` mit anderem Inhalt. | BESTÄTIGT | `WX-nn` aus VW wird nicht mehr vergeben; Abbildung auf die Registry in §7.2. Neue Pakete heißen `WXG-*` (Autorität) und `ATM-*` (Rendering). |
| V-02 | Zeitbegriff: VW `simulationTick: string` und Wetterschritt „alle 2 bis 10 In-Game-Sekunden“; WX `TickUs: string`; Code `SimulationTick` (JS-`number`, 120 Hz). | BESTÄTIGT | Einheitlich `SimulationTick` (W-01). **BERECHNET:** Ein Planetengitter mit ~200 km Zellen braucht keine 2-10-s-Schritte; bei 5 s wären das 17.280 Schritte pro 24-h-Tag gegenüber 144 bei 10 min. Die 2-10-s-Rate gehört nur zum lokalen F2-Pfad. |
| V-03 | VW §1.2 schlägt vor, `AtmosphereDefinition` nicht in-place zu erweitern, sondern neue versionierte Referenzen (`atmosphereDefinitionRef`, `atmosphericOpticsRef`) zu führen. WX §15 nutzt dieselbe Referenztechnik. | BESTÄTIGT | Konsistent; CEL-01 setzt es um (siehe W-02). |
| V-04 | VW §1.2: `src/settings` meldet Postprocessing ohne Pipeline als unsupported; Wetter ist eine neue echte Capability. | BESTÄTIGT (`CapabilityStatus` kennt `Unsupported`/`Planned`) | `weatherQuality` als neue Setting-ID, Status `Planned` bis ATM-Paket geliefert (X-03). |
| V-05 | VW §10.2 plant neue Pfade `src/environment/{weather-core,volume-fields,atmosphere-contracts}/**` und `src/render/three/atmosphere/**`. `src/environment` existiert auf `main` nicht (Top-Level-Verzeichnisse: u. a. `celestial`, `hvp`, `hestia-prototype`, `render`, `settings`, `spatial`, `streaming`, `surface-lab`, `voxel`, `workers`, `world`, `world-generation`). `world-generation/` könnte `MacroGeography` berühren; Inhalt nicht geprüft. | BESTÄTIGT / OFFEN | Registry übernimmt die VW-Pfade für Wetterkern und Atmosphäre. Vor WXG-01 prüft ein Leseauftrag `src/world-generation/**` und `src/world/**` auf Überschneidung mit „Planetary Macro Data“. |
| V-06 | VW §10.1: HVP-Wasser ist `depthWrite:false`; ein einfacher Opaque-Depth-Raymarch sieht Wasser nicht. Reihenfolge der Passes G/H ausdrücklich „vorläufig“. | BESTÄTIGT (Konzept) | Pflichtfall in ATM-Spike und in GFX-04 (Wasser) und RT-04 (RTF-09, Wasserreflexion): Wasser-Tiefenstrategie muss entschieden werden, bevor Volumen und Ray-Pässe Wasser berühren. |
| V-07 | VW §10.4: `@takram/three-clouds` (WebGL, GLSL, Beer-Shadow-Maps). **BESTÄTIGT (npm):** Version 0.7.6, MIT, letzte Änderung 2026-05-06; Peer-Dependencies: `three >= 0.170.0`, `postprocessing >= 6.36.7`, `react >= 19`, `@react-three/fiber >= 9.0.4`, `@react-three/postprocessing >= 3.0.4`. **Die React-Peers (`react`, `@react-three/fiber`, `@react-three/postprocessing`, `@react-three/drei`) sind laut `peerDependenciesMeta` optional.** Verpflichtend bleiben `three` und `postprocessing`. `postprocessing` 6.39.5 (Lizenz **Zlib**), Peer `three >= 0.168.0 < 0.187.0`, also mit `three` 0.186.1 vereinbar. `@takram/three-atmosphere` 0.19.1, MIT, ebenfalls mit optionalen React-Peers. | BESTÄTIGT | Kein React nötig; der Spike bringt `postprocessing` (Zlib) als Pflichtabhängigkeit mit und muss die Composer-Integration (kein `three/examples/jsm`-`EffectComposer`) gegen die Hestia-Rendererfactory prüfen. ATM-02 klärt, ob die tatsächliche API ohne React nutzbar ist (README/Source), sonst eigener schlanker GLSL-Raymarcher. |
| V-08 | VW §14.3 setzt `EXT_disjoint_timer_query_webgl2` als GPU-Zeitquelle. | BESTÄTIGT (Verfügbarkeit fraglich, G-06) | `Unavailable` ist Normalfall, kein Fehler. |
| V-09 | VW F0-F3 und die Aussage „F2 beweist keine Überschall-Druckwelle“ sind konsistent mit WX §14 und DF Phase E. | BESTÄTIGT | Beibehalten. `PressureImpulseEvent` bleibt analytisches Ereignis. |
| V-10 | VW T0-T6 und WX 20.1 (W-DET-01 … W-ART-01) überlappen. | BESTÄTIGT | Testkatalog in §7.4 vereinigt beide; keine doppelte Testimplementierung. |
| V-11 | VW §10.2 verbietet Writes in `hvpBootstrap.ts` vor „kontrolliertem Integrationsgate“ und nennt „Route-Code-Splitting“ als Integrationsvoraussetzung. | BESTÄTIGT | Entspricht X-09; Route-Splitting wird in GFX-06 als Voraussetzung geführt (Status OFFEN). |
| V-12 | VW §6.4/§11.3: `PlumeIntent`/`WeatherInteractionGateway` hängen an einem Craft-/Flight-Authority mit echtem Thrust-/Massenstrom. Im Code existiert kein Wetter- oder Aero-Vertrag. | BESTÄTIGT | Bleibt außerhalb der Registry (eigenes Folgepaket „Wetter-Gateway“); bis dahin kosmetisches VFX-Profil, wie VW §6.4 selbst fordert. |

## 4. Extern verifizierte Fakten (Stand 2026-10-09)

### 4.1 Paketstände (npm, BESTÄTIGT)

| Paket | Stand | Datum | Lizenz | Anmerkung |
|---|---|---|---|---|
| `three` | 0.186.1 | 2026-09-24 | MIT | Repo-Pin 0.185.1 (2026-07-01); 0.186.0 am 2026-09-08 |
| `three-mesh-bvh` | 0.9.16 | 2026-10-08 | MIT | Export `./webgpu`; Peer `three >= 0.159.0` (Hauptpaket) |
| `three-gpu-pathtracer` | 0.0.27 | 2026-10-08 | MIT | `./webgpu`; Peer `three >= 0.185.0`, `three-mesh-bvh >= 0.9.15`, `xatlas-web ^0.1.0`; „requires WebGPU“ |
| `@pmndrs/detect-gpu` | 6.0.25 | 2026-10-04 | MIT | Unscoped `detect-gpu` stale; Benchmarkquelle seit Dez 2025 nicht aktualisiert |
| `@react-three/drei` | 10.7.9 | 2026-09-25 | MIT | enthält `PerformanceMonitor` (nicht relevant: kein React im Projekt, OFFEN) |

### 4.2 Rapier, Dimforge-Crates und Lizenzen (BESTÄTIGT, soweit nicht OFFEN)

**Rapier JS (npm).** Alle sechs Paketnamen (`@dimforge/rapier3d-compat`, `-simd-compat`, `-deterministic-compat`, `@dimforge/rapier3d`, `-simd`, `-deterministic`) existieren; `latest` = **0.21.0** (2026-09-25), nicht deprecated. Versionen des Compat-Pakets seit 0.12.0 (2024-01-28): 0.13.0/0.13.1 (2024-05), 0.14.0 (2024-07-20), 0.15.0 (2025-03-06), 0.15.1, 0.16.0 (2025-04-24), 0.16.1, 0.16.2, 0.17.0 (2025-05-16), 0.17.1-0.17.3, 0.18.0-beta.0 (Prerelease) und 0.18.0 (2025-07-24), 0.18.1, 0.18.2, 0.19.0 (2025-09-05), 0.19.1-0.19.3 (2025-11-05), **0.20.0 (2026-08-08)**, **0.21.0 (2026-09-25)**. `-simd-compat`/`-deterministic-compat` ab 0.15.0. Der Changelog liegt jetzt unter `dimforge/rapier/bindings/typescript/CHANGELOG.md` (das alte `rapier.js`-Repo endet bei 0.19.3).

**Versionsabbildung:** JS 0.20.0 = Rapier Rust 0.35.0; JS 0.21.0 = Rust 0.36.0 + Parry 0.31 (BESTÄTIGT). Rust-Crate `rapier3d` aktuell 0.36.0 (2026-09-25, Apache-2.0); `parry3d` 0.31.1 (2026-09-18, Apache-2.0).

**Breaking changes JS 0.12 → 0.21 (Changelog):**

| Version | Änderung |
|---|---|
| 0.13.0 | `RayIntersection/RayColliderHit/ShapeCastHit.toi` → `timeOfImpact`; `ShapeTOI` → `ShapeCastHit`; `castShape/castCollider` mit `targetDistance`; `FIX_INTERNAL_EDGES` nicht mehr Standard |
| 0.15.0 | Pakete aufgeteilt in simd/deterministic; non-compat nicht mehr „enhanced-determinism“ |
| 0.18.0-beta.0 | Broadphase-Umbau; `.cjs/.mjs`-Dateinamen |
| 0.18.2 / 0.20.0 | `-compat` `init()`-Parameter als Objekt (`{ module_or_path }`) |
| 0.19.0 | `invPrincipalInertiaSqrt` → `invPrincipalInertia` (liefert jetzt echte inverse Trägheit); PGS-Umschalter entfernt |
| 0.20.0 | `-compat`-Dateien unter `dist/`; `IntegrationParameters.minIslandSize` entfernt; `NarrowPhase.contactPair` mit `RigidBodySet`; `friction()/restitution()` statt `solverContact*` |
| 0.21.0 | `SoftBodySet` als zusätzlicher Parameter in `PhysicsPipeline.step`, `SerializationPipeline.serializeAll`, `RigidBodySet.remove`, `ColliderSet.remove`; `World`-Konstruktor geändert; `RigidBodyType.SoftFrame` |
| Rust 0.35.0-beta.0 | Sleep-Schwellen und Island-Serialisierung geändert (0,4 → 0,05; 2,0 → 0,5 s) |
| Rust 0.36.0 | Snapshots früherer Versionen nicht ladbar |
| ab 0.18.0 (Dist) | `updateSceneQueries` in 0.17.3 vorhanden, in 0.18.0/0.21.0 nicht (genaue Entfernung in 0.18.0-beta.0: OFFEN) |

Nicht verifiziert (OFFEN): JS-Namen und Format von `takeSnapshot/restoreSnapshot`; Feature-Satz des 0.12.0-Builds; ob der `-compat`-Build die WASM base64-eingebettet liefert (Bakeoff behauptet es, nicht separat geprüft); `World.step()`-Wrapper unter 0.21.

**Voxel-Collider (JS):** `ColliderDesc.voxels`/`Voxels`/`setVoxel` seit 0.16.0 (experimentell, zunächst ohne dynamische Körper, Shape-Cast, Voxel-Voxel-/Mesh-Kollision); dynamische Körper seit 0.17.0; CCD und Shape-Cast seit 0.16.1; `Collider.combineVoxelStates` (0.17.1) ist für benachbarte Voxel-Collider nötig, um Innenkanten-Artefakte zu vermeiden; Sparse-Storage seit 0.19.1 (Parry-Changelog nennt Parry 0.25.0; Zuordnung widersprüchlich, beide zitieren); Parry 0.21.0 ergänzte `MassProperties::from_voxels` und Voxel-Voxel-/Compound-Kontaktmanifolds. OFFEN: ob das Label „experimentell“ in 0.21 entfernt wurde, Mesh/Heightfield/Polyline-Kontakte, ob der JS-Massenpfad für dynamische Voxel-Körper `from_voxels` nutzt.

**Weitere Dimforge-Crates (crates.io, Apache-2.0):** `salva3d`/`salva2d` 0.10.0 (2026-08-08); `vortx` 0.5.0 (2026-10-04; README: WebGPU-Default, CUDA, CPU, „still very incomplete“); Nexus-Familie `nexus2d`, `nexus3d`, `nexus_rbd2d/3d`, `nexus_mpm2d/3d`, `nexus_viewer2d/3d` 0.6.0 (2026-10-04; README: „rapier on the GPU“, WebGPU über Rust-GPU/SPIR-V, wasm32-Ziel, MPM nur einseitig gekoppelt, „heavy development“, Safari nicht unterstützt, keine Determinismus-Aussage gefunden). Der crates.io-Name `nexus` ist ein fremdes 2016-Paket.

**PR #71:** offen, Dependabot, `0.12.0 → 0.20.0`, nur `package.json` und Lockfile; Text zitiert falschen Changelog-Eintrag (D-10).

**Lizenzen externer Wetter-/Klima-Werkzeuge:** ExoPlaSim **GPL-2.0** (Bündelung in MIT-/proprietäre Build-Werkzeuge erzeugt Copyleft-Pflichten; Offline-Datenerzeugung unproblematisch, Output-Lizenz: GNU-GPL-FAQ, keine Rechtsberatung); NOAA-GFDL FV3 (`GFDL_atmos_cubed_sphere`) **LGPL-3.0** (Text geprüft); ROCKE-3D: GitHub-Repos `NASA-GISS/ROCKE-3D` und `GISS-ROCKE/ROCKE-3D` liefern 404, Quelle laut GISS-Seite über modelE-Snapshots, **Lizenz OFFEN**. Folge (Entscheidung 10): nur Offline-Datenerzeugung, nie im Produkt-Bundle; ROCKE-3D erst nach Lizenzklärung.

**Bakeoff-Ergebnis vom 2026-10-02 (PDF, BESTÄTIGT):** Basis `b3c6523a`, Änderungen nur unter `experiments/rapier-bakeoff/`, Evidence-Commit `bfa6efce`. Kandidaten A-E (D-01), Population: 11 bestehende HVP-Testdateien, 91 Tests, unveränderte Assertions; Toleranzen vorab: Position 0,01 m, lineare Geschwindigkeit 0,02 m/s, Quaternion 0,01 rad, Masse/COM/Trägheit 1e-5. Befunde (zusätzlich zu D-07/D-11/D-12): Eigener Snapshot-Restore je Build stabil (1e-6) und lokal wiederholbar (identische Hashes); **keine** Cross-Build- oder Cross-Platform-Hashgleichheit geprüft; offiziell garantiert nur Variante D plattformübergreifende Determinismus (A ohne Garantie); Vite 8.1.5 bündelt `@dimforge/rapier3d@0.21.0` direkt (`build.target=es2022`, WASM als `application/wasm`); Compat ist dafür nicht erforderlich; SIMD-Fallback-Auswahl in vier Tests, aber **kein** realer Browser ohne SIMD; Fallback **nach** World-Erzeugung ist für Replay unzulässig. Empfohlene Folgereihenfolge des Berichts: (1) zeitschrittfreie Query-Sichtbarkeit und borrow-freier Filter, (2) Walking-/Treppen-/Sleep-Drift isolieren (unveränderte Produktassertions), (3) Save-/Solver-Versionierungsstrategie, (4) danach erst serielle Messung auf regulären Zielbrowsern inkl. echter Deployment-WASM-Auslieferung; C nur mit repräsentativem Kontaktanteil, D nur mit begründeter Cross-Platform-Anforderung. Die Rohdaten (`final-browser-raw.json`, `summary.json`, Logs) liegen im Begleitarchiv, **nicht** im Repo (OFFEN: Ablageort).

## 5. Zusätzliche Recherche (Lücken der Quelldokumente)

### 5.1 Raytracing-/WebGPU-Plattform

- Kein Browser liefert heute Ray-Query/Acceleration-Structure in WebGPU; `gpuweb#535` offen, Milestone „4+“ (BESTÄTIGT, Issue). Absenz in Firefox/Safari OFFEN.
- Subgroups in Chrome 134 (Feb 2025) ausgeliefert (BESTÄTIGT, Chrome-Blog). `timestamp-query-inside-passes`-Status in Chrome stable OFFEN.
- WebGPU-Support global ≈ 87,8 % (caniuse); Firefox-Quellen widersprüchlich (G-09).
- Spec-Defaults: `maxStorageBufferBindingSize` 128 MiB, `maxBufferSize` 256 MiB, `maxStorageBuffersPerShaderStage` 8, `maxBindGroups` 4. **OFFEN** (Core vs. Compat-Mode-Defaults nicht getrennt geprüft): `maxComputeWorkgroupSizeX` 128, `maxComputeInvocationsPerWorkgroup` 128 vs 256, `maxComputeWorkgroupStorageSize` 16.384 B.
- Referenzen für Spike-Design: `three-mesh-bvh`-WebGPU-Pathtracing-Beispiel; `VoxelRT` (DDA/Brick/ESVO/Tree64-Vergleich, nativ); Unity-/Unreal-Dynamic-Resolution-Dokumentation (Controller-Muster); Three.js `TAAUNode` (WebGPU-TAAU, MSAA aus) und `pmndrs/upscaler` (FSR-artig, WebGPU, `three >= r184`). Kein Browser-WebGPU-Voxel-DDA-Demo gefunden (OFFEN).

### 5.2 Klima- und Zirkulationsbausteine (für ClimateNormals-Compiler)

- Äquiangulare Cube-Sphere: Face-Kante = πR/2; Zellbogen am Face-Zentrum = (π/2)R/N. Referenz: ExoCubed (arXiv:2403.06844). Wind über Faces: kovariante/kontravariante Komponenten und Vektor-Rotation an Panel-Rändern; Referenz GFDL FV3 (Harris et al., TM 2021-001); die einschlägigen Abschnitte wurden nur per Titel geprüft (OFFEN im Detail).
- Energiebilanz Budyko-Sellers: C dT/dt = Q(1−α(T)) − (A+BT). Held-Suarez-Benchmark (1994): Newtonsche Relaxation, ca. 40 d freie Atmosphäre / 4 d Oberfläche, Rayleigh-Reibung ca. 1 d. Isca und PlaSim als offene Vergleichsmodelle (alles aus Gedächtnis des Agenten: OFFEN, vor Nutzung nachlesen).
- Hadley-Breite gegen Rotation: Mitchell & Hill 2021 (arXiv:1903.11656; BESTÄTIGT als Quelle): ∝ Ω⁻¹ axialsymmetrisch, ∝ Ω⁻¹ᐟ³ in eddy-beeinflussten GCMs.
- Gezeitengebundene und langsam rotierende (Venus-)Zirkulation: nicht geprüft (OFFEN).
- Titan: ~1,5 bar, ~94 K, CH₄ nahe Oberfläche ~3-6 % (Lora & Ádámkovics 2016, arXiv:1610.06277; BESTÄTIGT). Mars: ~25 % des CO₂ zyklisch (18-30 %, USGS; BESTÄTIGT). Venus: Hauptwolkendeck 48-70 km, drei Schichten (BESTÄTIGT als Sekundärquelle). Jupiter/Saturn-Jets: nicht geprüft (OFFEN).

### 5.3 Wolken aus der Wetterkarte

Nubis (SIGGRAPH Advances in Real-Time Rendering 2015, 2017, 2022, 2023; URLs im Agentenbericht) und Bruneton & Neyret 2008 (Atmosphärenstreuung) sind die nächsten dokumentierten Referenzen. Das Datenmodell (2D-Wetterkarte → Höhengradient je Wolkentyp → Shape-/Detailrauschen, Wind als UV-Offset) ist **nicht** aus den Vorträgen verifiziert (OFFEN, W-13).

### 5.4 Determinismus in JS/WASM

- ECMA-262 definiert `Math.sin/cos/exp/pow` nur als angenähert; die Empfehlung `fdlibm` ist nicht verpflichtend. Browser-Unterschiede für gleiche Eingaben sind dokumentiert (esdiscuss, test262-Bug 285; BESTÄTIGT).
- + − × ÷ und `sqrt` sind IEEE-754-korrekt gerundet; `Math.fround` exakt (spezifiziert, BESTÄTIGT durch Spezifikationswissen, nicht separat zitiert).
- WASM: einzige Core-Nichtdeterminismen sind NaN-Bitmuster und Relaxed-SIMD (webassembly.org/docs/nondeterminism; Wasmtime-Doku; BESTÄTIGT).
- Counter-based RNG: Random123 (Salmon et al. 2011; Philox/Threefry); Jarzynski & Olano 2020, JCGT 9(3): PCG-Varianten auf der Pareto-Front (BESTÄTIGT). Empfehlung: Threefry-2x32 oder PCG3D für JS **und** WGSL.

### 5.5 Lokale Fluide

- `luma.gl` WebGPU-VolumetricFireSimulation: dichtes Gitter 64×96×64, 6 Jacobi-Iterationen, fester 1/60-s-Schritt; keine FPS-Zahlen (OFFEN, auf Zielgerät messen).
- **BERECHNET:** 64³ = 262.144 Zellen; RGBA16F = 8 B/Zelle → 2 MiB je Feld, ≈ 12 MiB für sechs Felder; 128³ = 16 MiB je Feld.
- Virtual-Pipes/Shallow-Water: Mei, Decaudin & Hu, PG 2007, S. 47-56 (Zitat BESTÄTIGT; ob MDH07 die Virtual-Pipes eingeführt hat: OFFEN). Als einfache Alternative zu SPH für Fluss/Dammbruch.

### 5.6 Zeit, Timewarp, Multiplayer, Readability (Risikoliste)

Aus Rechercheagenten-Gedächtnis, alle OFFEN, aber relevant als Testpunkte: Sampling nach Epochen, nicht nach Frame-Δt; nur Integer-Epochen am Sampler bei lokaler Berechnung auf Clients; Checkpoints nur an Epochengrenzen plus Replay-Tail; Forecast liest dieselben stabilen IDs wie die Physik; Seam-Test der Windrotation an jeder Panelkante; gerenderte Bewölkung muss am Kamerapunkt mit dem gesampelten Wert übereinstimmen.

### 5.7 WASM-Threads und Isolation

SharedArrayBuffer braucht `crossOriginIsolated` (COOP `same-origin` plus COEP `require-corp` oder `credentialless`). `credentialless`: Chrome 96+, Firefox Desktop 119+, Safari nicht unterstützt (WebKit-Bug 230550 offen). Relaxed-SIMD: Chrome/Edge 114+, Firefox 146+, Safari laut Quelle nicht; Fixed-Width-SIMD-Baseline nicht geprüft (OFFEN). Konsequenz: nicht-SIMD-Fallback verpflichtend; COOP/COEP ist eine Deployment-Entscheidung, die Playwright-E2E und externe Assets betrifft (PLT-01).

## 6. Offene Owner-Entscheidungen (konsolidiert)

Die vier Dokumente haben insgesamt ≈ 21 offene Fragen. Hier auf 10 reduziert; Empfehlung jeweils in Klammern. Antworten gehören in GOV-01.

1. **Referenzgerät/Hardwareklassen:** Wird H2 = `HVP-PLAY-720-v1`? Welche Geräte stellen H1 und H3 (reale Intel/AMD/NVIDIA-Testgeräte)? (Empfehlung: H2 = HVP-PLAY-720-v1 festschreiben; H1/H3 nur benennen, wenn physisch verfügbar, sonst `UNAVAILABLE`.)
2. **WebGPU im Produkt:** Nur isolierte Spike-Route oder auch optionaler Rendererpfad hinter Flag? (Empfehlung: nur Spike bis GFX-03/RT-06 `ACCEPT`.)
3. **Three.js-Pin-Update** 0.185.1 → 0.186.1 als eigener Change vor GFX-03? (Empfehlung: ja, separat, nicht in Cut-V3-Branches.)
4. **Spike-Ort und Abhängigkeiten:** `spikes/<id>/` im Repo-Root mit eigenem `package.json` und Lockfile, nie im Produkt-`package.json`? (Empfehlung: ja.)
5. **Rapier-Ziel:** Der Bakeoff-Entscheid „KEEP 0.12 FOR NOW“ bleibt bis zum Follow-up-Spike (PHY-01) in Kraft? 0.21.0 non-compat (E) als bevorzugter späterer Zielpfad (kleiner, Vite-direkt), SIMD (C) nur mit repräsentativem Kontaktanteil und Fallback, deterministic (D) nur bei konkreter Cross-Platform-Anforderung? Wo liegt das Begleitarchiv des Bakeoffs, und wer koordiniert den `solver`-String-/Checkpoint-Schnitt mit Cut-V3 (X-11)? (Empfehlung: ja, Archiv sichern, PHY-01 vor jedem Schnitt, PHY-03 erst nach Cut-V3-Gate; PR #71 schließen.)
6. **Fluid-Authority** (FLD-01): Wasser als eigene Domäne mit Mengenbilanz, Visualisierung nur Projektion? (Empfehlung: ja.)
7. **COOP/COEP und WASM-Threads:** aktivieren oder bewusst nicht? (Empfehlung: zunächst nicht; erst bei nachgewiesenem Nettovorteil.)
8. **Wetterziel Hestia:** `AnalyticSynopticV1` für spielbares Wetter, `CoarseGridDynamicsV1` nur Forschungs-Bakeoff? Erste supported Planetenfamilien: Hestia, Airless, Staubplanet, Methanplanet? (Empfehlung: ja, GasGiant nur Render-Spike.)
9. **Raytracing-Priorität:** Gameplay-Licht (Kontaktschatten, Wurzeln/Höhle/Wrack) vor Fotomodus, Fotomodus parallel als Developer-Route? (Empfehlung: ja.)
10. **Lizenzgrenze Bake-Tools** (ExoPlaSim GPL, ROCKE-3D, FV3): nur Offline-Datenerzeugung, nie im Produkt-Bundle? (Empfehlung: ja, Lizenzprüfung in WXG-02-Vorarbeit; Ergebnis der Lizenzprüfung siehe §4.)

## 7. Einheitliche Arbeitspaket-Registry

Diese Registry ist der Katalog, aus dem später DevToolbox-Changes und Agentenaufträge erzeugt werden. Sie legt **keinen** Change an und startet keine Execution (AGENTS.md: spec-first, Changes nur bei Zuweisung). Ein Paket wird erst Arbeit, wenn es einen Change `.devtoolbox/specs/changes/<paket-id-klein>-v1/` mit Tasks und Evidence bekommt.

### 7.1 Konventionen

- **ID-Familien:** `GOV` Entscheidungen, `PLT` Plattformpolicies, `FLD` Fluid-Authority, `CEL` Celestial-Vertrag, `GFX` Grafik/Qualität, `ATM` Atmosphäre-Rendering, `RT` Raytracing, `PHY` Physik/Dimforge, `WXG` Wetterautorität. IDs der Quelldokumente (GRAPH-*, RT-00/01, DF-Phasen A-F, WX-* aus VW) werden nicht mehr vergeben (Abbildung §7.2).
- **Status im Master-Plan:** Jedes Paket wird `[RESEARCH]` (Spike/Entscheidung), `[OPEN]` (Produktänderung mit Spec) oder `[DEFERRED]`. Zuordnung zu `P`-Einträgen steht je Paket.
- **Pfadkonvention:** Pfade in den Karten, die mit `src/`, `tests/`, `package.json` oder `package-lock.json` beginnen, sind relativ zu `apps/weltraum-browser/`; Pfade mit `spikes/`, `docs/`, `.devtoolbox/` sind relativ zum Repo-Root. Der Scope-Guard normalisiert das (siehe unten). `[RESEARCH]` heißt: Ergebnis ist Bericht/Entscheidung, Code liegt in `spikes/` oder `docs/`; `[OPEN]` heißt: Produktcode mit Spec. Produktcode aus einem Spike entsteht erst nach dessen `ACCEPT` in einem eigenen `[OPEN]`-Paket.
- **Spike-Ort:** `spikes/<paket-id-klein>/` im Repo-Root mit eigenem `package.json` und Lockfile. Spikes ändern **nie** `apps/weltraum-browser/package.json`, `package-lock.json` oder `node_modules` des Produkts (GOV-01, Entscheidung 4). Gemeinsame, nach Freeze unveränderliche Fixtures: `spikes/_shared/**` (Eigentümer RT-01; nur RT-01 schreibt).
- **Branch/Worktree:** `agent/<paket-id-klein>-<datum>` aus dem dann aktuellen `origin/main`, Worktree unter `.worktrees/`.
- **Evidence-Ort:** im zugehörigen DevToolbox-Change; ohne Change `spikes/<id>/evidence/`. Pflichtmanifest je Messlauf: Repo-SHA und dirty-Status, Paketversionen mit Lockfile-Digest, WASM-/Shader-Digest, Browser+Version, OS, CPU, GPU/Treiber, Adapter-Features/-Limits, DPR/Auflösung, Warmup, Run-Reihenfolge (alternierend), Seed, Fixture-Digest, Rohsamples; p50/p95/p99/Max. Fehlende Sensorik = `UNAVAILABLE`, nie `0`. Referenzgerät: `HVP-PLAY-720-v1` (GOV-01).
- **Gate-Vokabular:** `ACCEPT`, `REJECT`, `REQUIRES_SPIKE`, `UNAVAILABLE`, `INCONCLUSIVE` (zu wenige Samples). Ein Paket mit `INCONCLUSIVE` ist nicht abgeschlossen.
- **Produktgrenzen (gelten für jedes Paket):** keine zweite Weltwahrheit (Voxel-Zellen, Materialien, IDs, Revisionen bleiben Authority); keine Änderung von Cut-, Physics-, Save-, Voxel-Semantik außerhalb ausdrücklich zugewiesener Pakete (PHY-03, GFX-06); kein Merge/Push durch den Agenten; keine stillen Fallbacks; Tasks erst nach Evidence und Completion-Preflight schließen.
- **Standard-Verify Produktpakete** (aus `apps/weltraum-browser`; Kommandos laut `package.json`):

```bash
npm run build          # tsc -p tsconfig.json && vite build
npm test               # vitest run
npm run test:e2e:ui    # graphics-settings, ui-concept-parity (bei Settings-/UI-Änderungen)
npm run test:e2e:core  # bei Celestial-/Physik-/Persistenz-Änderungen
```

- **Standard-Verify Spikes und Produktpakete:** im Spike-Verzeichnis `npm ci && npm test` bzw. Standard-Verify oben, plus Scope-Guard (`<kartenpfade>` durch die Schreibpfade der Karte als Regex ersetzen; leer lassen, wenn die Karte nur Spike-/Docs-Pfade hat):

```bash
git diff --name-only origin/main...HEAD | sed 's#^apps/weltraum-browser/##' \
  | grep -v -E '^(<kartenpfade>|spikes/<id>/|\.devtoolbox/specs/changes/<id>-v1/)' \
  && echo "SCOPE VIOLATION" || echo "scope ok"
```

### 7.2 Abbildung der Quell-IDs

| Quelle | Neue ID | Anmerkung |
|---|---|---|
| GFX GRAPH-01 | **GFX-01** | Erweiterung `src/settings/**`, nicht neuer Baum (G-01) |
| GFX GRAPH-02 | **GFX-02** | reiner Controller, treibt vorhandene Live-Settings |
| GFX GRAPH-03 + RT-00/RT-01 (Probe/Smoke) | **GFX-03** (+ **GFX-00** Pin-Update) | ein WebGL2-vs-WebGPU-Spike |
| GFX GRAPH-04 | **GFX-04** | Vegetation/Wasser/Wetterpartikel-Harnesses |
| GFX GRAPH-05 | **GFX-05** | nach PLT-01 |
| GFX GRAPH-06 + RT-07 | **GFX-06** (RT-07 bleibt Gate-Verweis) | ein gemeinsamer Renderer-Eingriff |
| RT-00 (Fixtures/Oracle/Messvertrag, ohne GPU) | **RT-01** | CPU-Referenz, 1000 Goldens, Cut-Commandstream |
| RT-02A / RT-02B / RT-03 / RT-04 / RT-05 / RT-06 / RT-08 | unverändert | RT-07 → GFX-06 |
| DF Phase A (Inventur) | in diesem Dokument (§3.4, §4) | erledigt soweit ohne `npm install` möglich |
| DF Phase B (R-A..R-E) | **PHY-01** (als Follow-up-Spike auf dem Bakeoff vom 2026-10-02, D-01) | R-F entfällt (D-09) |
| DF Phase C | **PHY-02** | C1-C4 |
| DF Phase D | **PHY-04** | Nexus |
| DF Phase E | **FLD-01** (Entscheidung) + **PHY-05** (Spike) | |
| DF Phase F | **PHY-06** | |
| VW WX-00 | GFX-01 + GFX-03 (Baseline-Frames, Runner) | |
| VW WX-01 | WXG-00..WXG-04 | Autorität jetzt nach WX (Strategie A/B) |
| VW WX-02 | **ATM-01** | Sky/Aerial LUT vs Analytik |
| VW WX-03 | **ATM-02** | Cloud-Raymarch: Takram vs eigener GLSL |
| VW WX-04 | **ATM-03** | lokaler Nebel, Regen, Blitz, Wolkenschatten (Feature-Flag) |
| VW WX-05 | **WXG-06** (nach FLD-01) | F1/F2 |
| VW WX-06 | GFX-06 | HVP-Adapter |
| VW WX-07 | außerhalb der Registry | Gameplay-Gateway (V-12) |
| VW WX-08 | WXG-08 | Editor/Orbit-LOD, `[DEFERRED]` |
| WX WXG-00..04, 06, 07, 08 | unverändert | WXG-05 → ATM-01..04 |

### 7.3 Abhängigkeiten und Wellen

```text
Welle 0 (Entscheidungen, ohne Code):   GOV-01   FLD-01   PLT-01(Policy-Teil)
Welle 1 (parallel, disjunkte Pfade):   GFX-01   PLT-02   CEL-01   PHY-01   RT-01   ATM-01
                                       WXG-00 (nach CEL-01-Vertragsentwurf und PLT-02-Schnittstelle)
Welle 2:  GFX-02 (GFX-01)   GFX-03   GFX-05 (PLT-01)   PHY-02 (PHY-01)
          RT-02A, RT-02B (RT-01, GFX-03-Harness)   WXG-01, WXG-02 (WXG-00, CEL-01)   ATM-02
          PHY-04, PHY-05 (PLT-01, FLD-01)   GFX-04 (GFX-03)
Welle 3:  RT-03 (RT-02A/B)   WXG-03 (WXG-02)   ATM-03 (ATM-02)   WXG-07 (WXG-03)   WXG-06 (FLD-01, WXG-03)
Welle 4:  RT-04 (RT-03)   RT-05 (RT-04)   WXG-04 (WXG-03)   ATM-04 (WXG-04, ATM-02)   PHY-06 (PHY-02, PHY-04, PHY-05)
Welle 5 (Gates, nur mit Owner-Slot):  RT-06   GFX-00* → GFX-06 (+RT-07)   PHY-03   RT-08   WXG-08
* GFX-00 = Three-Pin-Update des Produkts; Owner-Slot wegen Lockfile-Konflikt mit Cut-V3-Branches; blockiert nur GFX-06. Spikes pinnen ihre Versionen selbst (§7.1).
```

Echte Parallelität: Alle Welle-1-Pakete haben disjunkte Schreibpfade (§7.5). Welle 2 benötigt eingefrorene Verträge aus Welle 1 (RT-01 Fixtures, GFX-01 Probe-Vertrag, CEL-01 Profile).

### 7.4 Vereinigter Testkatalog (keine doppelte Implementierung)

| Quelle | Test-IDs | Eigentümerpaket |
|---|---|---|
| RT §14 | RTF-01 … RTF-13 | RT-01 (Oracle/Goldens), RT-02A/B (Backends), RT-03 (RTF-03/04/05/06/10/12), RT-04/05 (Bild), RT-08 (RTF-13) |
| WX §20.1 | W-DET-01 … W-ART-01 | WXG-00..04 (DET/TIME/GEO/PLANET), WXG-07 (W-TIME-02/03, W-PHYS-01/02), ATM-04 (W-CONT-01), WXG-06 (W-CONT-02) |
| VW §15 | T0 … T6 | T0 → WXG-00; T1/T2 → ATM-02/03; T3 → ATM-03/WXG-04; T4 → WXG-06; T5 → GFX-06; T6 → Owner-Art-Gate in ATM-02/03/04 |
| DF §10 | Testfamilien (Freier Fall … Wasserfluss) | PHY-02 (Collider/Cut/CCD/Charakter), PHY-04 (GPU), PHY-05 (Wasser), PHY-03 (Save/Load/Replay) |
| GFX §14.1 | funktionale Mindesttests | GFX-01/02 (Probe, Controller), GFX-06 (Context-/Device-Loss, Preset-Zyklen) |

### 7.5 Schreibzonen (Konfliktmatrix)

| Zone | Pfade | Schreiber |
|---|---|---|
| **Freeze (Cut-V3)** | `src/hestia-prototype/{physics,persistence,terrain}/**`, `src/hestia-prototype/presentation/visualEffects.ts`, `src/hvp/hvpBootstrap.ts`, `package.json`/Lockfile | nur PHY-03, GFX-06, GFX-00 mit Owner-Slot nach Cut-V3-Gate |
| Settings/Telemetrie | `src/settings/**`, `src/render/three/graphicsSettingsAdapter.ts`, `src/ui/graphicsSettingsPanel.ts`, `src/render/telemetry/**`, `src/render/quality/**` | GFX-01, GFX-02 (serialisiert: GFX-01 vor GFX-02, getrennte Dateien) |
| Celestial | `src/celestial/**`, `docs/spielkonzept/celestial-runtime-data-contract.md` | nur CEL-01 |
| Determinismus | `src/determinism/**` (Namen gegen `src/core/**` prüfen) | nur PLT-02 |
| Wetterkern (Produkt) | `src/environment/atmosphere-contracts/**` (WXG-00), `src/environment/{weather-core,volume-fields}/**` (WXG-04) | WXG-00, WXG-04; WXG-01..03, 06, 07 arbeiten nur in `spikes/` |
| Atmosphäre-Render | `src/render/three/atmosphere/**` | ATM-04 (Produkt); ATM-01..03 nur Spike |
| Spikes | `spikes/<id>/**` | je ein Paket; `spikes/_shared/**` nur RT-01 |
| Docs | `docs/research/**`, `docs/architecture/**` | GOV-01, FLD-01, PLT-01, PHY-06 je eigene Dateien |

### 7.6 Paketkarten

Jedes Paket nennt: Ziel, Lesen, **exakte Schreibpfade**, Voraussetzung, Deliverables, Gate. **Nicht-Ziele** und **Verify** sind je Familie unter der Tabelle zusammengefasst und gelten für jedes Paket der Familie. Evidence-Ort und -Inhalt: §7.1.

#### Familie GOV / PLT / FLD / CEL (Entscheidungen und Verträge)

| ID | Ziel | Lesen | Schreibt | Voraussetzung | Deliverables | Gate |
|---|---|---|---|---|---|---|
| **GOV-01** `[RESEARCH]` P00.04 | Owner-Entscheidungsblatt (§6) beantworten lassen und festschreiben; die fünf Quelldokumente ins Repo ablegen. | dieses Dokument | `docs/spielkonzept/` (VW-Ablage) und `docs/architecture/owner-decisions-hestia-concepts-2026-10.md` | keine | 10 Antworten, Abbildung H1/H2/H3 → Geräte, Pin-Update-Entscheid, Spike-Ort | Owner hat alle 10 Punkte beantwortet; offene bleiben als solche markiert |
| **PLT-01** `[RESEARCH]` P14 | Eine WASM-/Threads-/Isolation-Policy: Toolchain-Pin, Digest-Pflicht, Nicht-SIMD-Fallback, COOP/COEP-Entscheid, Lizenz-/Provenienz-Regeln. | `docs/architecture/world-runtime-render-backend-boundary.md` (WASM-Gate Z.250-270), `vite.config.ts`, `playwright.config.ts` | `docs/architecture/wasm-and-isolation-policy-v1.md`, `spikes/plt-01-isolation/**` | GOV-01 (Entscheidung 7) | Policy; Mini-Spike: `crossOriginIsolated` mit COOP+COEP (`require-corp` und `credentialless`) unter Vite und Playwright; Liste der Produktassets/Drittressourcen, die COEP bricht | Entscheid „aktivieren/nicht“ mit Beleg; Nicht-SIMD-Fallback beschrieben |
| **PLT-02** `[OPEN]` P01.01 | Deterministische Mathe/RNG-Bibliothek: Festkoeffizienten-`sin/cos/exp/log`, Threefry-2x32 und PCG3D (u32), kanonische LE-Serialisierung, Hash-Helfer; JS-Referenz und WGSL-Spiegel für RNG. | `src/spatial/canonical.ts`, `src/persistence/time.ts`, `src/core/**` (Inventur) | `src/determinism/**`, `tests/unit/determinism-*.test.ts` | PLT-01 (nur Fallbackregel) | Funktionen mit Fehlerschranken (ulp-Vergleich gegen hochpräzise Referenz), Goldens (Hex-Float), Cross-Browser-Lauf Chromium + Firefox | Byte-identische Goldens in zwei Engines; Fehlerschranken dokumentiert |
| **FLD-01** `[RESEARCH]` P08/P12 | Wasser-/Fluid-Authority entscheiden: wer besitzt Menge, Druck, Fluss, Persistenz (Meer/Fluss, Dammbruch, Rohrnetz, Luft-Wake); was ist Projektion. | DF §5, WX §14, VW §6, `docs/architecture/voxel-destruction-mass-rotation-orbit.md` | `docs/architecture/water-and-fluid-authority-v1.md` | GOV-01 | Entscheidungsmatrix, Authority-Grenzen, Save-Folgen, Konsumentenliste (WXG-06, PHY-05, GFX-04) | `ACCEPT` für ein Modell je Fachfall oder `REQUIRES_SPIKE` mit Spike-Auftrag in PHY-05 |
| **CEL-01** `[OPEN]` P04.01 | Neues versioniertes `AtmospherePhysicsProfile` und `AtmosphereOpticsProfile` mit Body-Referenz; Validierung gegen `AtmosphereDefinition`; Hestia-Daten. | `src/celestial/{types,validation,canonical,catalog,starterSystem}.ts`, `docs/spielkonzept/celestial-runtime-data-contract.md` §10 | `src/celestial/**` (neue Dateien, additive Einträge), `tests/unit/celestial-*.test.ts`, `tests/e2e/celestial-gravity-core.spec.ts`, Spec-Doc §10 | GOV-01 | Felder: Gasmischung (Spezies, Molanteile), Skalenhöhe, Außenradius, Bond-Albedo, innere Wärme, Sternbindung; Hestia-Werte mit Quellenvermerk (Annahmen als solche markiert); Schema-Version | `npm run build`, `npm test`, `test:e2e:core` grün; `AtmosphereDefinition` unverändert; Savegame-Kompatibilität nachgewiesen (nur Katalog-IDs, keine Kopie) |

*Nicht-Ziele (Familie):* keine Produkt-Renderer-Änderung; keine Wetterlogik; keine Änderung der Freeze-Zone. *Verify:* Docs-Pakete: Links prüfen, `git diff --stat` nur Docs; Code-Pakete: Standard-Verify §7.1.

#### Familie GFX (Grafik/Qualität)

| ID | Ziel | Lesen | Schreibt | Voraussetzung | Deliverables | Gate |
|---|---|---|---|---|---|---|
| **GFX-00** `[OPEN]` P14 | `three` und `@types/three` von 0.185.1 auf 0.186.1 heben, eigener Change. | Three-Migration-Guide r185/r186, `visualEffects.ts`, `presets.ts` | `apps/weltraum-browser/package.json`, `package-lock.json` | GOV-01 (Entscheidung 3), Owner-Slot (X-09); **Voraussetzung nur für GFX-06**, nicht für Spikes | Pin-Update; Liste betroffener Stellen (z. B. `PCFSoftShadowMap`-Mapping nur falls WebGPU genutzt) | `build`, `test`, `test:e2e:live` + `core` wie vor dem Update; Evidence-Bildvergleich Referenzszenen |
| **GFX-01** `[OPEN]` P14.0x | Probe und Telemetrie: WebGPU-Probe, Timestamp-Feature, Adapterlimits, `powerPreference` als Setting, `deviceMemory`/`hardwareConcurrency` als Hinweis (null = unbekannt), Frame-Fenster p50/p95/p99 im Produkt, `rayTracing`/`weatherQuality` als `Planned`. | `src/settings/**`, `render/three/graphicsSettingsAdapter.ts`, `docs/architecture/webgl-observability-and-performance-evidence.md`, `tests/e2e/hvp-performance-evidence.ts` | `src/settings/**`, `src/render/three/graphicsSettingsAdapter.ts`, `src/render/telemetry/**`, `src/ui/graphicsSettingsPanel.ts` (nur neue Einträge), `tests/unit/**`, `tests/e2e/graphics-settings.spec.ts` | GOV-01 | Erweiterter `GraphicsCapabilityProbe`, Schema-v2-Migration, Telemetriefenster mit `unavailable`, Spezialisierungsnotiz im Observability-Doc | Probe-Tests für „WebGPU fehlt“, „Timer fehlt“, „Gerät unbekannt“; keine erfundenen Werte; v1-Settings laden weiter |
| **GFX-02** `[OPEN]` P14 | Adaptiver Controller als reine Funktion: Messfenster → Entscheidung, Hysterese, Cooldown, Nutzergrenzen, nur `renderScale`/`maxDevicePixelRatio`. | GFX §8-§9, `presets.ts`, GFX-01-Vertrag | `src/render/quality/**`, `tests/unit/adaptive-quality-*.test.ts` | GFX-01-Vertrag eingefroren | Synthetische Messreihen (Spike, Dauerlast, Flattern, Hintergrund-Tab, Nutzerfixierung) | Gleiche Reihe ⇒ gleicher Entscheidungsverlauf; kein Flattern; manuelle Werte nie überschrieben; kein Three-Import |
| **GFX-03** `[RESEARCH]` P14 | Backend-Bakeoff: gleiche Terrain-/Vegetations-/Wasser-Fixtures auf WebGL2 und WebGPU/TSL; Context-/Device-Loss-Injection; Fallback; Shader-Kompilier- und Upload-Kosten. | `visualEffects.ts`, `threeRenderBackend.ts`, GFX §3, RT §5 | `spikes/gfx-03-backend-bakeoff/**` | keine (der Spike pinnt `three@0.186.1` im eigenen `package.json`; GFX-00 nicht nötig) | Vergleichsbericht p50/p95/p99, Kompilierzeiten, Speicher; TSL-Portierungsaufwand für die zwei vorhandenen Shaderstellen | `ACCEPT WebGL2-only` / `ACCEPT WebGPU-optional` / `REQUIRES_SPIKE`; kein Backend verändert Spielinhalt |
| **GFX-04** `[RESEARCH]` P04.04/P13 | Effekt-Harnesses mit Qualitätsstufen: Vegetationswind, Wasser (inkl. Tiefenstrategie für `depthWrite:false`), Wetterpartikel. | GFX §10, VW §10.1/§9, `look.ts` | `spikes/gfx-04-effects/**` | GFX-03-Fixtures | Je Effekt Low/Medium/High mit Kosten und Bild; Wasser-/Volumen-Tiefenlösung dokumentiert | Qualität unabhängig regelbar; Zerstörung/Fragmentbesitz unverändert; Owner-Art-Gate |
| **GFX-05** `[RESEARCH]` P14 | TS-vs-WASM(-SIMD)-Bakeoff an Meshing/AO/Kompression einschließlich Transfers. | `src/voxel/**` (nur lesen), PLT-01 | `spikes/gfx-05-wasm-meshing/**` | PLT-01 | Ende-zu-Ende-Messung (inkl. Kopien, Init), identischer Ergebnisvertrag | Nettogewinn nachgewiesen oder `REJECT` (TS bleibt) |
| **GFX-06** `[OPEN]` P14 | Kontrollierte Produktintegration der angenommenen Ergebnisse (GFX-02/03/04, ATM, RT) hinter Flags, inkl. Route-Splitting-Voraussetzung. | alle Spike-Berichte | `src/hvp/hvpBootstrap.ts`, `src/hestia-prototype/presentation/visualEffects.ts`, `src/render/three/backend/**` | Owner-Slot, Cut-V3-Gate, **GFX-00**, `ACCEPT`-Gates der genutzten Spikes | Flag-gesteuerte Integration, Fallback getestet, Preset-Zyklen ohne Leck | keine Regression in Gameplay, Save, Welt-Hash, Context-Recovery; reversibel; kein Standard-On ohne Beleg |

*Nicht-Ziele (Familie):* keine Änderung von Voxel-, Physik-, Save-Semantik; kein Qualitätswert im kanonischen Save; kein Renderer-Wechsel im Standardpfad; keine neue Abhängigkeit ohne Lizenz-/Versionsnotiz. *Verify:* GFX-00/01/02/06 Standard-Verify §7.1 inkl. `test:e2e:ui` und `test:e2e:live`; GFX-03/04/05 Spike-Verify; Leistungsaussagen nur mit Manifest §7.1.

#### Familie ATM (Atmosphäre-Rendering)

| ID | Ziel | Lesen | Schreibt | Voraussetzung | Deliverables | Gate |
|---|---|---|---|---|---|---|
| **ATM-01** `[RESEARCH]` P04.04.02 | Sky/Aerial-Perspective: Bruneton-artige LUT gegen einfache Analytik, mit Hestia-Parametern (CEL-01-Entwurf). | VW §7, `planet-lod-streaming-reference-audit-v1.md` §10, Bruneton & Neyret 2008 | `spikes/atm-01-sky/**` | keine (Parameter als Fixture) | Boden/Innen/Orbit, Tag/Nacht, GPU-Kosten, LUT-Invalidierungsregel | Entscheid LUT vs Analytik mit Bild und Kosten |
| **ATM-02** `[RESEARCH]` P04.04.02 | Cloud-Raymarch WebGL2: `@takram/three-clouds` (Peer-Prüfung V-07) gegen eigenen GLSL-Raymarcher; Wolke von unten/innen/oben, Schatten, Temporal. | VW §4, §10.4, Nubis-Vorträge | `spikes/atm-02-clouds/**` | GFX-03-Fixtures (Kamerapfade) | Kanalmodell der Wetterkarte (aus Nubis 2015/2022 belegt), Kosten, Ghosting-Befund, Lizenz-/Peer-Bericht | `ACCEPT` Takram / eigener Pfad / `REJECT`; Nutzbarkeit ohne React am Source belegt |
| **ATM-03** `[RESEARCH]` P04.04.02 | Lokaler Nebel, Regen, Blitz, Wolkenschatten als Präsentation hinter Feature-Flag; Doppelnebel-Vermeidung (`scene.fog`). | VW §7-§9 | `spikes/atm-03-local-fx/**` | ATM-02 | Wasser-/Dach-/Höhlen-Fälle, Low-End-Fallback | VW T2/T3 (Präsentationsteile) bestanden; Owner-Art-Gate |
| **ATM-04** `[OPEN]` P04.04.02 | `AtmosphereRenderPort` an `PlanetWeatherReadView` binden (`WeatherSnapshotId`), Produkt-Port ohne HVP-Eingriff. | VW §10.3, WXG-04-Vertrag | `src/render/three/atmosphere/**`, `tests/unit/atmosphere-port-*.test.ts` | WXG-04, ATM-02 `ACCEPT` | Port, Historyreset-Regeln, Dispose-Vertrag | Zehnfaches Mount/Unmount ohne Ressourcenanstieg; W-CONT-01 im Spike-Maßstab |

*Nicht-Ziele (Familie):* keine Wetterautorität; keine Änderung von `hvpBootstrap.ts`; keine zur Laufzeit von GitHub geladenen Assets (Lizenz-/SHA-Provenienz im Bundle). *Verify:* Spike-Verify; ATM-04 Standard-Verify.

#### Familie RT (Raytracing)

| ID | Ziel | Lesen | Schreibt | Voraussetzung | Deliverables | Gate |
|---|---|---|---|---|---|---|
| **RT-01** `[RESEARCH]` P14 | Fixture-, Oracle- und Messvertrag-Freeze ohne GPU: immutable Voxelfixtures (zwei Zellgrößen 0,25/0,125 m, negative Koordinaten, Chunkgrenze), CPU-Referenz-DDA, 1000 Golden-Rays, Cut-Commandstream, Telemetrie-Schema (`t_authority_commit`, `t_mesh_visible`, `t_ray_projection_accepted`, `t_lighting_current_visible`). | RT §14-§16, `src/voxel/**` (nur lesen) | `spikes/_shared/**`, `spikes/rt-01-oracle/**` | GOV-01 | Fixtures mit Digest, CPU-Oracle mit Tests | Goldens reproduzierbar; danach `_shared` read-only |
| **RT-02A** `[RESEARCH]` | BVH-Compute (`three-mesh-bvh/webgpu`) gegen die Fixtures; Bau-/Refit-/Rayzeiten; Stabilitätsstatus der WebGPU-API (R-08). | RT §8 | `spikes/rt-02a-bvh/**` | RT-01, GFX-03-Harness | ClosestHit/AnyHit, negative Koordinaten, Geometrieänderung Rebuild/Refit, Teardown | Hit-Parität 100 % gegen RT-01-Oracle; Rohdatenbericht |
| **RT-02B** `[RESEARCH]` | Voxel-DDA-Compute: Brick-Atlas, PageTable, `UNKNOWN != AIR`, flaches und Zwei-Ebenen-DDA; Residency gegen angefragte Adapterlimits (R-04). | RT §9 | `spikes/rt-02b-dda/**` | RT-01, GFX-03-Harness | gleiche Goldens, Tie-Policy, Dirty-Brick-Upload, Frame-Origin | Hit-Parität 100 %; Unknown korrekt; Rohdatenbericht vergleichbar zu RT-02A |
| **RT-03** `[RESEARCH]` | Dynamik: Cut-Commandstream-Replay, Dirty-Revisionen, Fragment-Transform, Generationswechsel der GPU-Ressourcen, Annahme: Snapshot kommt vom Voxel-Owner-Worker (R-05). | RT §12, RTF-03/04/05/06/10/12 | `spikes/rt-03-dynamic/**` | RT-02A/B | Update-Kosten BVH vs DDA, stale-Adoption-Tests | Korrektes aktuelles Licht, kein Leck (RTF-12 Plateau), p99 dokumentiert |
| **RT-04** `[RESEARCH]` | Low-Res-Hybrid: Raster-G-Buffer, ein kurzer Ray, Composite; Vergleich mit SSAO/GTAO/Shadowmap **auf demselben Backend** (R-10). | RT §10 | `spikes/rt-04-hybrid/**` | RT-03 | Bildvergleich, Kosten | nachweisbarer Mehrwert (Owner-Art-Gate) |
| **RT-05** `[RESEARCH]` | Temporal/Spatial: Velocity/Depth/Normal/Revision-History, konservatives Verwerfen. | RT §11 | `spikes/rt-05-denoise/**` | RT-04 | Ghosting-/Light-Leak-Tests (Rotation, Cut, Fragment, Sonne, Unknown) | kein Blocker-Ghosting |
| **RT-06** `[RESEARCH]` | Hersteller-/Browser-Matrix und Entscheidungsvorlage; GPU-Zeit nur wo `timestamp-query` verfügbar (R-02). | RT §15 | `spikes/rt-06-matrix/**`, `docs/research/rt-decision-v1.md` | RT-02A/B, RT-05, Geräte aus GOV-01 | Messmatrix mit `UNAVAILABLE`-Zellen | `ACCEPT BVH` / `ACCEPT DDA` / `ACCEPT HYBRID` / `REJECT FOR GAMEPLAY` |
| **RT-07** → **GFX-06** | Produkt-Handoff läuft über GFX-06. | | | | | |
| **RT-08** `[RESEARCH]` | Fotomodus mit `three-gpu-pathtracer` 0.0.27 (WebGPU-only), eingefrorener Snapshot, 32/128/512 spp. | RT §5.2 | `spikes/rt-08-photo/**` | GFX-03 | Konvergenz, Speicher, Stalls, nicht unterstützte Materialien | Capture ohne Gameplay-Eingriff; Developer-Route |

*Nicht-Ziele (Familie):* kein Ray als Treffer-/Mining-/Kollisionsautorität; keine HW-RT-/DXR-Annahme; kein Pathtracing im Gameplayframe; keine Änderung von HVP-Cut, Physics, Save. *Verify:* Spike-Verify; GPU-Aussagen nur mit Manifest; CI ohne GPU validiert nur Build, Verträge, CPU-Oracle.

#### Familie PHY (Physik/Dimforge)

| ID | Ziel | Lesen | Schreibt | Voraussetzung | Deliverables | Gate |
|---|---|---|---|---|---|---|
| **PHY-01** `[RESEARCH]` P02/P04.07 | **Follow-up-Spike auf dem Bakeoff vom 2026-10-02** (D-01), nicht Neumessung: (1) Begleitarchiv/Git-Bundle sichern und Harness wiederherstellen; (2) zeitschrittfreie Query-Sichtbarkeit und borrow-freien Character-Controller-Filter lösen; (3) Walking-/Treppen-/Sleep-Drift mit **unveränderten** Produktassertions isolieren; erste Hypothesen D-08 (Sleep-Schwellen explizit auf 0.12-Werte setzen; `FIX_INTERNAL_EDGES` für Terrain-Trimeshes explizit an); (4) Migrationsmatrix aller Aufrufstellen gegen die echten 0.21-`.d.ts`. | Bakeoff-PDF, `src/hestia-prototype/physics/**` (nur lesen, D-02/D-03/D-11), `tests/unit/structuralPgTragwerk*.test.ts`, Rapier-Changelog (§4.2) | `spikes/phy-01-rapier-followup/**`, `docs/research/rapier-js-migration-matrix-v1.md` | GOV-01 (Entscheidung 5; Archiv-Ablageort) | Wiederherstellbarer Harness (README, Runner); Ursachenbericht je Drift (Hypothese bestätigt/widerlegt); Migrationsmatrix je Aufrufstelle (`unverändert/umgestellt/entfällt`); Kandidaten B (compat), E (non-compat, Vite-direkt), C (SIMD) auf den **gelösten** Blockern; D nur bei Cross-Platform-Anforderung; R-F entfällt | Walking ≤ 1 cm, Treppen-/Grounded-Entscheidung identisch, Sleep-Befunde erklärt oder per Parameter geschlossen, 91-Test-Population mit Shim ohne Verhaltensfehler; sonst `REJECT`/`KEEP 0.12` bestätigt |
| **PHY-02** `[RESEARCH]` | Collider-Bakeoff C1 Trimesh, C2 Multi-Cuboid, C3 native Voxel-Shape (`combineVoxelStates` Pflicht, „experimentell“-Status prüfen, §4.2), C4 Hybrid: Edit-to-Contact-Latenz, Speicher, GC, CCD, Treppe/Kante, Masse/COM/Tensor mit unabhängigem Oracle. | DF §4/§9 Phase C | `spikes/phy-02-collider-bakeoff/**` | PHY-01 (Blocker gelöst) | Rohdaten, Korrektheitsbericht | Empfehlung je Lastprofil; kein Sieger ohne Hestia-Workload |
| **PHY-03** `[OPEN]` | Rapier-Migration im Produkt: Adapter, Tests, `solver`-String und Checkpoint-Migration (versioniert), Rebake abgeleiteter Collider, Pfad der WASM-Hash-Prüfung (`dist/`). | PHY-01/02-Berichte, Cut-V3-Save-Vertrag | `src/hestia-prototype/physics/**`, `persistence/{worldCheckpoint,gameCheckpoint}.ts`, 4 `structuralPgTragwerk*.test.ts`, `tests/e2e/hvp-visible-coast.spec.ts:1063`, `tests/performance/hvp-performance.spec.ts:77`, `package.json`/Lockfile | Owner-Slot, Cut-V3-Gate, GOV-01, PHY-01 `ACCEPT` | Migration mit Migrator, alte Saves laden oder lehnen sauber ab (dokumentiert), Rollbackpfad | `build`, `test`, `test:e2e:core`, `test:e2e:live`; kein stiller Zustandswechsel |
| **PHY-04** `[RESEARCH]` | Nexus-GPU-Spike (Rust/WASM/WebGPU) gegen Rapier-CPU mit identischer Fixture; Device-Loss, Readback, Determinismus nur gleiche Maschine. | DF §6, Nexus-README | `spikes/phy-04-nexus-gpu/**` | PLT-01 | 10/100/1000 Körper, Dispatch-/Readbackkosten, CPU-Fallback | `ACCEPT`/`REJECT`/`REQUIRES_SPIKE`; keine Runtime-Integration |
| **PHY-05** `[RESEARCH]` | Fluid-Spikes je FLD-01: Salva-SPH, Raster/Shallow-Water (Virtual Pipes), optional Nexus-MPM, Rohrnetz als Netzwerkmodell; Massenbilanz-Oracle. | DF §5, FLD-01, VW §6 | `spikes/phy-05-fluid/**` | FLD-01, PLT-01 | je Fachfall Kosten und Bilanzabweichung | Empfehlung je Fachfall |
| **PHY-06** `[RESEARCH]` | Entscheidungsdossier (DF Phase F, §12-Deliverables). | PHY-01/02/04/05 | `docs/research/dimforge-hestia/**` | genannte Pakete | Owner-Decision-Sheet, Matrix, Gates | Owner kann Rapier-Profil, Collider, GPU-Frage, Fluidmodell entscheiden |

*Nicht-Ziele (Familie):* kein Merge; keine zweite Weltwahrheit (Rapier-/Nexus-/Salva-Daten sind abgeleitet); kein Vortx als eigenes Paket (DF §7: nur bei nachgewiesenem Mehrnutzen über Nexus hinaus); kein Parry-WASM ohne Sondernutzen. *Verify:* Spike-Verify; PHY-03 Standard-Verify.

#### Familie WXG (Wetterautorität)

| ID | Ziel | Lesen | Schreibt | Voraussetzung | Deliverables | Gate |
|---|---|---|---|---|---|---|
| **WXG-00** `[OPEN]` P04.04.02 | Vokabular und Verträge: `ExactRef`, Profil-/Epoch-/Query-/Result-Typen (`Known/Pending/Unsupported/UnknownCoverage`), `SimulationTick`-Bindung (W-01), `WeatherSnapshotId` (W-03). | WX §15, VW §11, `spatial/*`, `persistence/time.ts` | `src/environment/atmosphere-contracts/**`, `tests/unit/weather-contracts-*.test.ts` | CEL-01-Entwurf, PLT-02-Schnittstelle | Typen, Schema-Goldens, Digest-Regeln | Schema-/Digest-Goldens; keine Produktimporte außer `spatial`/`persistence` read-only |
| **WXG-01** `[RESEARCH]` P04.04.04 (Code im Spike, Übernahme in WXG-04) | `MacroGeographyAtlasV1` als Projektion von „Planetary Macro Data“; Land/Ozean/Höhe/Reservoire deterministisch, Cube-Face-Adressierung wiederverwendet. | `procedural-voxel-planet-runtime.md` §5, `src/world-generation/**`, `src/world/**` | `spikes/wxg-01-macro/**` (importiert Verträge aus `src/environment/atmosphere-contracts/**` nur lesend) | WXG-00, CEL-01 | Atlas-Generator für Fixture-Planeten | Gleiche Eingabe ⇒ gleicher Digest, unabhängig von Chunk-Reihenfolge (W-GEO-01) |
| **WXG-02** `[RESEARCH]` | `ClimateNormalsCompiler` (Budyko-Sellers-Energiebilanz, Held-Hou-Zirkulation mit Rotationsparameter, Held-Suarez-Vergleich) und sechs Fixture-Planeten: Hestia, Airless, Staub, Methan, GasGiant (Druckniveaus), TidallyLocked; Hazard-Validator (W-10). | WX §5-§6, §5.2 dieses Dokuments | `spikes/wxg-02-climate/**` | WXG-01, PLT-02 | reproduzierbare Klimakarten, Stoffdaten-Registry mit Gültigkeitsbereich, Lizenzprüfung externer Bake-Tools | W-PLANET-01/02/03 bestanden; undefinierte Stoffmodelle ⇒ `Unsupported` |
| **WXG-03** `[RESEARCH]` | `AnalyticSynopticV1`: stabile Front-/Sturm-IDs, Counter-based RNG je Epoch, kontinuierliche Übergänge, Query-Budget je Aufruf. | WX §7.1, §8 | `spikes/wxg-03-synoptic/**` | WXG-02 | A→B→A-Reise, Tick-Unabhängigkeit | W-DET-01/02/03, W-TIME-01 bestanden |
| **WXG-04** `[OPEN]` P04.04.02 | `PlanetWeatherReadView` + Meso-Verfeinerung, Streaming-/Cache-Bindung (Digest-Schlüssel, WX §12). | WX §9-§13 | `src/environment/weather-core/**` (übernimmt Code aus WXG-01..03-Spikes nach deren `ACCEPT`), `src/environment/volume-fields/meso/**` | WXG-03 `ACCEPT` | Read-View mit `supportRadiusM`, Cache-Regeln | gleiches W1 bei Vorabfetch/Reload/Reorder (W-DET-03/04) |
| **WXG-06** `[RESEARCH]` | Lokale Luft-Wake-Volumen (F1/F2) als Konsument von FLD-01: Obstacle-Projektion, Randbedingung aus W1/W2-Wind. | VW §6, WX §14 | `spikes/wxg-06-local-fluid/**` | FLD-01, WXG-03 | Plume/Schock-Synthetik, Bilanzprüfung | W-CONT-02; keine Kompressibilitätsbehauptung |
| **WXG-07** `[RESEARCH]` | `CoarseGridDynamicsV1`-Bakeoff: 32²-128², Zeitschrittwahl (W-06), Seam-Wind (W-PHYS-01), Replay full vs Checkpoint+Tail, WASM-Kern erwägen (PLT-01). | WX §7.2, §10 | `spikes/wxg-07-grid-dynamics/**` | WXG-03 | Stabilitäts-/Bilanz-/Replaykosten | W-TIME-02/03, W-PHYS-01/02; Save-Vertrag-Änderung nur als Vorschlag an P12 |
| **WXG-08** `[DEFERRED]` | Authoring-Workspace (Wetterprofil, Scrubber, Szenarien), Versionierung, Orbit-LOD-Konsistenz. | WX §19, VW §12 | nach Editor-Entscheid | Editor-Programm | – | Owner-Gate |

*Nicht-Ziele (Familie):* keine Wind-/Aero-Kraft auf Flight; keine Änderung von Celestial außer über CEL-01; keine Änderung von Save-Semantik (WXG-07 nur Vorschlag); kein JS/WGSL-Code aus Content-Paketen (G13). *Verify:* WXG-00/01/02/03/04 Standard-Verify §7.1 inkl. Determinismus-Goldens; WXG-06/07 Spike-Verify.

### 7.7 Bewusst nicht in der Registry

- Wetter-/Aero-Kraftwirkung auf Flug und Gameplay-Gateway (VW WX-07, V-12).
- Native Vulkan-/DXR-Runtime (RT §6 Variante G).
- Vortx als eigene Integration (DF §7), vollständiger Ozean-SPH, Rigid-Body-pro-Voxel, GPU-Engine-Migration (DF §13).
- Dauerhafte Simulation unbeobachteter Regionen jenseits Strategie A.

### 7.8 Worker-Zuordnung (Delegationsregel)

Projektregel laut Supermemory-Recall (Wortlaut **abgeschnitten**, volle Fassung und Namen der „verifizierten“ Worker-Klasse OFFEN, GOV-01 bestätigt): Implementierungen ohne visuelle Prüfung dürfen von generischen Workern (`worker`, `backend-worker`, `frontend-worker`) erledigt werden; Implementierungen, die visuelle Prüfung verlangen (UI-Oberflächen, Terrain, Vegetation, Rendering u. a.), müssen von einem verifizierten Worker ausgeführt werden. Die Zuordnung unten ist **EMPFEHLUNG** nach dieser Regel.

| Klasse | Pakete |
|---|---|
| **G** generisch | GOV-01, PLT-01, PLT-02, FLD-01, CEL-01, GFX-00, GFX-02, GFX-05, RT-01, RT-02A, RT-02B, PHY-01, PHY-02, PHY-04, PHY-05, PHY-06, WXG-00, WXG-01, WXG-02, WXG-03, WXG-04, WXG-06, WXG-07 |
| **V** visuell verifiziert | GFX-01 (nur der UI-Anteil `graphicsSettingsPanel.ts`; Probe/Telemetrie-Logik ist G), GFX-03, GFX-04, GFX-06, ATM-01, ATM-02, ATM-03, ATM-04, RT-04, RT-05, RT-08 |
| **G + V-Abnahme** | RT-03 (Bildprüfung RTF-03), RT-06 (Entscheidungsvorlage mit Bildern), PHY-03 (Live-E2E-Sichtprüfung), WXG-08 (Editor) |

Folgen: Eine **V**-Aufgabe mit Bildbefund wird nie von einem generischen Worker abgenommen; Owner-Art-Gates (GFX-04, ATM-02/03, RT-04) bleiben Owner-Entscheidungen. Visuelle Pakete erzeugen Screenshots mit Manifest nach §7.1 (Szene, Seed, SimTick, Kamera, GPU, Browser). Kein Paket gibt Hardware-, Art- oder Merge-Freigabe.

## 8. Nicht geprüft und Restrisiken

**Nicht geprüft (in diesem Arbeitsschritt bewusst nicht gelaufen):**

- Kein Build, Test, Browserlauf, Benchmark und kein `npm install`; alle Leistungszahlen der Quelldokumente bleiben `HYPOTHESE`. Die Zahlen des Rapier-Bakeoffs stammen aus einer Linux-VM mit headless Chromium 134 und gelten nicht für `HVP-PLAY-720-v1`.
- Der Inhalt von `src/world-generation/**`, `src/world/**`, `src/core/**`, `src/streaming/**` und `src/voxel/**` wurde nicht gelesen (V-05, PLT-02, WXG-01, RT-01).
- Die Nubis-Vorträge, GFDL TM 2021-001 (Cube-Sphere-Windtransformation), die Datenmodell-Aussagen zu Wolkenkarten, Held-Suarez-Parameter, Venus-/Jupiter-/Gezeitenzirkulation, `three-mesh-bvh/webgpu`-Stabilitätsstatus und die WebGPU-Spezifikationswerte `maxComputeInvocationsPerWorkgroup` wurden nicht an der Primärquelle gelesen (jeweils OFFEN markiert).
- Das Begleitarchiv des Rapier-Bakeoffs (Git-Bundle, Rohdaten) und `bfa6efce` wurden nicht gefunden.
- Branch-Inhalte der Cut-V3-Zweige wurden nicht diffend gegen die Freeze-Zone geprüft (X-09 stützt sich auf Branchnamen und die Pfadliste aus VW §10.2 und der Inventur).
- Die Schreibpfade der Registry (`src/environment/**`, `src/determinism/**`, `src/render/quality/**`, `src/render/telemetry/**`, `spikes/**`) sind Vorschläge; Kollisionen mit künftigen Cut-V3-Änderungen sind erst beim Zuweisen eines Pakets prüfbar (Scope-Guard §7.1).

**Restrisiken der Planung:**

1. **Cut-V3-Gate:** PHY-03, GFX-06, RT-07 und GFX-00 hängen an einem Termin, den dieses Dokument nicht kennt. Ohne Slot bleibt die Spike-Welt folgenlos.
2. **Referenzgerät:** Alle ms-Gates sind erst scharf, wenn GOV-01 die Hardwareabbildung festlegt.
3. **Wetterumfang:** WXG-00..04 sind groß, ohne dass ein Spielfeature sie heute verlangt (kein Wind-/Aero-Vertrag, W-16). Empfehlung: nach WXG-03 ein Owner-Check, ob Strategie B und planetenweite Abdeckung vor dem Surface-Vertical-Slice (P04.04.04 `[DEFERRED]`) überhaupt gewünscht sind.
4. **Rapier:** Der Bakeoff spricht für „0.12 behalten“; die Registry ist deshalb auf Ursachenklärung statt Migration ausgelegt. Fällt PHY-01 negativ aus, bleibt 0.12 ohne Schaden (PR #71 schließen).
5. **Dokumentpflege:** Die fünf Quelldokumente bleiben unverändert und enthalten die oben korrigierten Aussagen weiter. Wer sie später liest, muss dieses Dokument mitlesen (Verweis in `docs/spielkonzept/` genügt als Hinweis; eine Änderung der Quelldokumente wurde nicht vorgenommen).
