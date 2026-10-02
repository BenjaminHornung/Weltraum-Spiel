# Drei kleine Laborgrenzen und ein gemeinsamer Szenensatz

**Status:** neue, ausschließlich laborinterne Verträge. Kein HVOX-, Save-, MeshArtifact- oder World-Authority-Ersatz. RD-00 implementiert nur diese nötigen Übergaben, nicht einen universellen Plugin- oder Enginekern.

## A. Eingefrorene Fixturedaten

Pfad: `src/contracts/fixture.ts`; Validator und Kontrollfälle daneben. Erzeugung in RD-02, getrennt von Anzeige und Effekten.

`LabFixtureV1` beschreibt `schema: hestia-rd-fixture-v1`, `id`, `kind: synthetic | product-derived`, `sourceRefs`, `units: meter`, `quantumMeters`, `frame`, `materials`, `objects`, optionale `voxelRegions` und `attachments` sowie `cameras`. Große numerische Payloads liegen in separaten Binärdateien mit Elementtyp, Byteordnung, Länge und SHA-256. Das Manifest enthält keine Three-Objekte, GPU-Handles oder ausführbaren Scripts.

`sourceRefs` enthält Repository/vollen Commit, konkrete Pfade/Blob- oder Bytehashes, Erzeugerversion und Quelldigest. Bei synthetischen Daten nennt es stattdessen Generatorcodehash, Seed und ausdrücklichen Testcharakter. Es wird nie so getan, als habe ein synthetischer Baum den echten Produkt-Save-/Physikvertrag bestanden.

`objects`: stabile `ownerId`, Quellrevision, Objektframe, Materialrollen, Meshpayloads und tatsächliche geometrische Bounds. `voxelRegions` tragen neben Belegung eine **eigene Known-Coverage**. Ein exportierter Ausschnitt ist außerhalb seiner Coverage unknown, nicht Air. `attachments` beziehen Dekoration auf Owner und konkrete Source-/Support-IDs. Ein GPU-Instanzindex ersetzt keine Owner-ID.

Die Renderpayloads müssen keine neue kanonische Geometrie definieren. Greedy- und Raymarchkandidaten erhalten denselben belegten Voxelbestand, dieselben Materialrollen, Frames und Kameras. Die im Produkt vorhandenen validierten Typen werden vom read-only Exporter adaptiert, nicht in ein konkurrierendes Produktformat migriert.

Lab-Importlimits: Manifest maximal 1 MiB; binärer Szenenpayload maximal 128 MiB pro Fixture. Große Stressfälle benötigen vorab deklariertes abweichendes Laborprofil und bleiben außerhalb der automatischen HVP-Übernahme. Die Limitprüfung erfolgt vor Kopie, Decodierung oder GPU-Allokation. Diese Grenzen beschränken nur Laborimporte, keine vorhandenen legalen Produktpayloads.

Typed-Array-Read-only ist ein Eigentumsvertrag, kein durch `Object.freeze` erzeugter Sicherheitsbeweis. Einmaliges Kopieren an der Lab-Importgrenze und private Puffer schützen den Snapshot; kein unkontrollierter Mutations-/Transferzugriff auf ausgeliehene Produktarrays. Export lässt seine Quelldaten unverändert.

## B. Frame-/Umweltinput und enger Rendereradapter

Pfad: `src/contracts/experiment.ts`. Vorgeschlagene Methodennamen sind beim RD-00-Freeze verbindlich für dieses Labor:

```ts
interface LabFrameInput {
  readonly tick: number;              // nichtnegativer sicherer Integer
  readonly seconds: number;           // aus Szenariozeit, nicht aus Date.now
  readonly paused: boolean;
  readonly cameraId: string;
  readonly sourceRevision: number;
  readonly weather: LabWeatherSample;
}
interface LabWeatherSample {
  readonly windMps: readonly [number, number, number];
  readonly rain01: number;
  readonly snow01: number;
  readonly cloud01: number;
}
interface LabExperimentHandle {
  setFrame(input: LabFrameInput): void;
  replaceFixture(next: LabFixtureV1): Promise<void>;
  readFacts(): LabExperimentFacts;
  dispose(): Promise<void>;
}
```

`LabExperimentFacts` hat exakt die gemeinsam benötigten Felder: `experimentId`, `variantId`, `backend`, `fixtureDigest`, `sourceRevision`, `liveResources`, `logicalCosts`, `unsupportedFeatures`, `errors`. Messwerte verwenden `{status: measured | estimated | unsupported | not-run, value?: number, unit: string, reason?: string}`; fehlender GPU-Speicher ist nicht null Byte. Backend muss z.B. Three-WebGPU, Three-WebGPU-WebGL2-fallback, Three-WebGLRenderer oder Babylon-WebGPU unterscheiden.

Die Factory erhält nur eigenes Canvas, gelesenes Fixture, statisch registriertes Preset, eigenen Abort-/Lifecyclekontext und Capabilitydaten. Kein Fenster auf Produkt-World, nativen Solver oder echte Savedaten. Diese drei Interfaces sind das gemeinsame Minimum. Spezifische Partikel-/Wetness-/Attachment-Adapter bleiben beim jeweiligen Experiment und werden nicht vorsorglich zu einem allgemeinen ECS aufgeblasen.

Eine Labvariante darf bei fehlender Fähigkeit `unsupported` melden. Sie darf nicht heimlich auf einen anderen Backendtyp, weniger Geometrie, deaktivierte Schatten oder niedrigere Auflösung wechseln. Ein sichtbarer Vergleich zweier Fidelity-Profile ist zulässig, aber kein gleichwertiger Backendbenchmark.

Szenariozeit ist kontrolliert. Pause friert die vereinbarte Visualzeit ein, Seek rekonstruiert den Effektzustand und Reset verwirft dessen privaten Cache. Shadertranszendenten sind nicht automatisch GPU-übergreifend bitgleich. Kanonische CPU-Inputs werden exakt, Shaderantworten mit vorab eingefrorenen visuellen/numerischen Toleranzen geprüft. Die Produktzeit wird nie verändert.

## C. Szenariostream und Messrecord

Pfad: `src/contracts/scenario.ts` und `src/contracts/result.ts`.

`LabScenarioV1`: `id`, `fixtureDigest`, `ticksPerSecond: 60`, `durationTicks`, sortierte Keyframes für Kamera-/Wetterpreset, sortierte Source-Snapshot-Wechsel und `mode: presentation-replay`. Ein Wechsel verweist auf ein vollständiges geprüftes nächstes Snapshotmanifest; er ist **kein natives Cut-Command**. Uhr, Kamera, Inputs und Solver-Replays verschiedener Versuche dürfen nicht vermischt werden.

Konkrete Read-only-Ereignisse: `ReplaceSnapshot`, `SetWeatherPreset`, `SelectCamera`, `ResetLab`. Weitere produktive Commands, JavaScript oder frei ausführbare Expressions sind in diesem Format verboten. Ein simuliertes `Detach` wird als vorher/nachher Source-Snapshot und Ownerposefolge geliefert und im UI als Replay beschriftet. `Applied` darf nur als originaler, quellgebundener historischer Feldwert erscheinen, nicht als neu erzeugter Physiknachweis.

`LabRunResultV1`: Szenario-/Variant-/Source-/Build-/Lock-/Browser-/Gerätebindungen, warm/cold-Klasse, geplante und beobachtete Samplezahl, Rohdatenpfade, Fehler/ausgelassene Proben, CPU/GPU/Frame-/Upload-/Speicherdaten mit Verfügbarkeitsstatus, Medienmanifest und Gate-Ergebnisse. Die Rohdaten bleiben außerhalb des kanonischen Fixturehashes.

## Gemeinsame Fixtures

| ID | Inhalt | Wesentliche Gegenprobe |
|---|---|---|
| F00-CONTROL | kleine 0,125-m-Stufen, Materialflächen, einzelner Schattenwerfer | Achsen, Maßstab, Material-/Farbmanagement, Backendparität |
| F01-HVP-COAST | aus b3 abgeleiteter Küstenausschnitt samt vorhandener Vegetation und Kameras | kein generisches neues Demo-Motiv statt des eigentlichen Produktes |
| F02-ROOT-GROVE | asymmetrischer Wurzelbaum, Schilf, Akzentcluster, Freiflächen | Pflanzenhierarchie, freie Wurzelbögen, Nah-/Mittel-/Fernansicht |
| F03-SHELTER | zwei Dachhöhen, Überhang, Höhle/Seiteneingang, dünnes Dach, entfernbares Dachteil | Regen/Nässe ohne falsche allwissende Höhenkarte |
| F04-DETACH | eindeutig gebundene vorher/nachher Owner und Dekor, Rotation, gelöschter Teil | kein Wiedererscheinen durch Wind, LOD, Schatten oder späte Reply |
| F05-CUTOUT | 1,8-m-Figurmarker, enge Passage, Wurzeln, Fenster, Kamera im Hindernis | Kamerasicht wird besser; physische Belegung bleibt gleich |
| F06-MATERIAL | trockener/nasser Kalk, Holz, Laub, Emission, schattiger Innenraum | neue Öffnung aktualisiert Licht; kein Geisterschatten/GI-Nachbild |
| F07-SCALE | 1x/2x/4x klar beschriftete Wiederholung desselben Patches | CPU/GPU/Overdraw-/Bufferkosten, keine universelle Planetenkapazitätsbehauptung |

F01 wird nur `product-derived`, wenn die Quellbytes tatsächlich aufgelöst und geprüft sind. Ansonsten laufen F00/F03/F05 mit `synthetic`, F01 bleibt `NOT_AVAILABLE`. Referenzbilder sind in keinem Fall Laufzeitevidenz. F07 oberhalb HVP-Caps ist ein beschrifteter Skalierungsversuch und nie automatisch übernahmefähig.

## Empfohlene Laborstruktur

```text
experiments/hestia-rd-2026-10-02/
  package.json / package-lock.json / tsconfig.json
  vite.config.ts / vitest.config.ts / playwright.config.ts
  src/contracts/       # RD-00, danach nur Hauptorchestrator
  src/runner/          # RD-03
  src/experiments/     # ein Unterordner pro Leaf-Worker
  src/tools/           # ein Unterordner pro Werkzeug
  src/qa/              # unabhängige Prüf-/Kombinationsmodule
  exporters/           # RD-02, read-only Produktquelle
  fixtures/            # RD-02, einzeln gepinnte Artefakte
  reference-cards/      # RD-01
  tests/<task-id>/      # exklusiv pro Paket
  reports/<task-id>/    # exklusive Ergebnisdokumente
  docs/coordination/    # Hauptorchestrator
```

Nur RD-00 schreibt initial package/lock/config/contracts. Nach seinem Handoff besitzt der Hauptorchestrator diese Dateien und die statische Modulregistrierung. Modulworker melden Abhängigkeitswünsche, ändern nicht parallel den Lock. Keine flächige Kopie von `apps/weltraum-browser/src` ins Labor.

## D. Zusammensetzen der Effekte ohne mehrere Renderer

Der rendererneutrale LabExperimentHandle genügt für den Enginevergleich. Die auf Three entwickelten Effekte brauchen zusätzlich eine schmale **Three-only-Labornaht**, damit RD-51 nicht sechs getrennte Renderer übereinanderlegt.

RD-03 stellt in `src/runner/threeHost.ts` einen Host mit genau einem Renderer, einer Scene, einer Kamera und einem Renderloop bereit. Er besitzt Mount-/Frame-/Sourcewechsel und nur abgeleitete Owneransichten. Kein Effect-Modul erzeugt einen zweiten WebGLRenderer oder einen eigenen rAF-Loop.

`ThreeLabEffectContext` enthält die geliehene Scene/Kamera, die aktuelle read-only Fixtureansicht, eine Ownerpose-Abfrage nach stabiler Owner-ID und den gemeinsamen Frame-/Capabilityinput. `ThreeLabEffect` besitzt `setFrame`, `replaceFixture`, `readFacts` und `dispose`. `mountThreeEffect(context, preset)` ist die zusätzliche Exportfunktion jedes Three-Effektmoduls; die jeweilige create...Experiment-Factory ist nur sein Standalone-Wrapper auf demselben Host. Diese Grenze betrifft RD-14, RD-15, RD-21, optional RD-22, RD-31, RD-32 und optional RD-33.

Materialbesitz bleibt explizit: RD-14 besitzt die Solid-/Wasser-Materialantwort; RD-21/22 ihre Dekormaterialien; RD-31/33 ihre Partikelmaterialien. RD-32 steuert ausschließlich den ausdrücklich angebotenen Wetness-/Wasserparameterkanal von RD-14. RD-15 fordert eine view-only Occlusionprojektion an; der Host/Materialowner muss sie in den betreffenden Viewpass einbringen. Es dürfen nicht mehrere Module dasselbe `onBeforeCompile` überschreiben oder Shadow-/Depth-Materialeinstellungen gegenseitig verlieren.

RD-03 friert dafür nur die konkret benötigten Parameterkanäle ein. Kein allgemeines Shader-Pluginframework. Besteht kein passender Kanal, meldet der Worker HEAD die genaue Lücke; ein einzelner zuständiger Writer ergänzt sie vor Kombination. Wind-/Quelländerung und View-Cutout werden im richtigen gemeinsamen Depth-/Shadow-/Colorpfad geprüft. Ein Material kann nicht durch einen später gemounteten Effekt still seine vorige Semantik verlieren.

RD-51 testet explizit: genau ein Canvas/Renderer/Renderloop, alle Effekte aktiv, identischer Source-/Tickinput, kombinierte Pass-/Texturkosten und vollständiger gemeinsamer Teardown. Ein Splitview oder mehrere überlagerte Canvases erfüllt dieses Gate nicht. Nicht-Three-Gegenrenderer bleiben eigenständige Vergleichsadapter; ein kompletter Effektport auf jeden Enginekandidaten ist kein Pflicht-Kartesisches-Produkt.
