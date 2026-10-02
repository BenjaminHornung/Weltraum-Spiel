import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LAB, RUN, START, BASE, ownedPath } from '../../exporters/stage-source.mjs';
import { sha } from '../../exporters/fixture-export.mjs';

const evidencePath = ownedPath(process.argv[2]);
const evidenceBytes = readFileSync(evidencePath); const evidence = JSON.parse(evidenceBytes);
if (evidence.status !== 'PASS') { throw new Error('Verified evidence required'); }
const inventoryBytes = readFileSync(path.join(LAB, 'fixtures/inventory.json'));
const inventory = JSON.parse(inventoryBytes);
const product = inventory.fixtures.find(f => f.id === 'F01-HVP-COAST');
const recipe = JSON.parse(readFileSync(path.join(LAB, 'fixtures', product.recipePath), 'utf8'));
const last = label => evidence.commands.findLast(c => c.label === label);
const labels = ['own-ci', 'red-unit', 'red-artifact-unit', 'red-palette-binding', 'export-final-normal', 'export-final-reverse',
  'final2-check', 'final2-rd02-typecheck', 'final-unit', 'final2-build', 'final-boundary'];
const commandTable = labels.map(label => { const c = last(label); return `| ${label} | ${c.exitCode} | ${c.logBytes} | \`${c.logSha256}\` | \`${c.log}\` |`; }).join('\n');
const fixtureTable = inventory.fixtures.map(f => `| ${f.id} | ${f.sourceRevision} / ${f.revisionLabel} | \`${f.manifestPath}\` | \`${f.fixtureDigest}\` | ${f.payloadBytes} |`).join('\n');
const scenarioTable = inventory.scenarios.map(s => `| ${s.id} | \`${s.path}\` | \`${s.scenarioDigest}\` |`).join('\n');
const sourceTable = product.sourceRefs[0].files.map(f => `| \`${f.path}\` | \`${f.blobSha}\` | \`${f.sha256}\` |`).join('\n');
const costs = evidence.exportCosts.map(c => `| ${c.reverseOrder ? 'reverse' : 'normal'} | ${c.wallMilliseconds.toFixed(3)} | ${c.processCpuUserMilliseconds} / ${c.processCpuSystemMilliseconds} | ${c.processPeakRssKiB} | ${c.productDiagnostic.wallMilliseconds.toFixed(3)} |`).join('\n');
const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const report = `# RD-02 Handoff an SO-01 / HEAD / RD-03

## Ergebnis
PASS: F00–F07 sind echte loadable LabFixtureV1-Dateiverzeichnisse: 16 Snapshots,
acht validierte 60-Hz-Szenariostreams. F01 ist product-derived aus tatsächlichen
b3-Bytes; alle Nachherzustände sind ausdrücklich presentation-replay.
ProductIntegrated=false. Keine Produkt-, Contract-, Package-, Lock-, Guard- oder
Registrierungsänderung. Kein Delegieren, Merge, Push, PR, DevToolbox-Tracking,
Dienst, Port, Browser-Tab oder GPU-Job.

Branch: \`feature/hestia-rd-rd02-2026-10-02\`. START-SHA \`${START}\`,
START-TREE \`addf696048a320b9739fc1dc901047600d52e51c\`.
Produkt-Lesequelle \`${BASE}\`. Historischer Septemberstatus ist kein Oktoberbeweis.
Die genaue nach Commit erzeugte Kandidaten-SHA/Tree und **jede geänderte Datei mit
Byte-/Git-Bindung** stehen in \`${RUN}/final-receipt.json\` und im terminalen Handoff.
HEADs unabhängige Prüfung/serielle Integration ist nicht vorweggenommen.

## RD-03: statische Daten laden
Alle folgenden Pfade sind relativ zu \`fixtures/\`. Zuerst Manifestbytes und alle
angegebenen Binärbytes mit dem unveränderten \`src/contracts/fixture.ts#importFixture\`
importieren; dann die Szenariobytes mit Digest→importiertes Fixture an
\`src/contracts/scenario.ts#importScenario\` übergeben. Kein URL-/Script-/Worldloader.
Material-Slots sind Zusatzpayloads, deren Zuordnung in \`recipe.json#regions\` liegt;
Belegung und KnownCoverage bleiben eigene uint8-Dateien. Pflanzen-slot0 ist nicht
globale KnownAir. Die nativen linearen Dekor-Tonpaletten sind quellgebunden unter
\`F01-HVP-COAST/recipe.json#cases.nativeVegetationPalettesLinearRgb\`; native
Vertexfarben/Materialprofile bleiben unverändert. Geometrie und Bounds sind
owner-lokal, danach den manifestierten Ownerframe anwenden.

Inventar \`fixtures/inventory.json\`: SHA256 \`${sha(inventoryBytes)}\`.
Es enthält **alle** SourceRefs, Payload-IDs/Pfade/Typen/Endian/Längen/SHA256,
Recipe-SHA und Scenario-Digests. Canonical Manifest-SHA = Fixture-Digest.

| Fixture-ID | Revision / Label | Manifestpfad | Fixture-/Manifest-SHA256 | Payloadbytes |
|---|---|---|---|---:|
${fixtureTable}

| Scenario-ID | Pfad | Scenario-/Byte-SHA256 |
|---|---|---|
${scenarioTable}

F04: r0 intact (tick0), r1 detach (360), r2 rotate (720), r3 remove (1080),
r4 reload (1440). Ownerwechsel tree-main→fragment-branch; konkrete Wood-/Leaf-
Zell-IDs und Supportowner sind gebunden. r3/r4 haben gleiche Binärpayloads;
entfernte Leaf-Bindung bleibt entfernt. ResetLab bei1560 ist ein Cache-Resetmarker,
kein nativer Schnitt und kein implizites Source-Rollback; Seek0 wählt r0 wieder.
F03 r1 entfernt das benannte Dach; F06 r1 öffnet das Dach. F07 ist genau der
F02-Patch mit 1/2/4 beschrifteten Kopien und 6.5m Translation, kein Planetentest.
F05s Figure-Marker ist Float64, lokal exakt1.8m hoch und presentationOnly; kein
auf 14/15 Quantum gerundeter physischer Körper. Die Inside-wall-Kamera liegt in
nachgewiesener Belegung; View-Cutout darf diese Belegung nicht umschreiben.

## Reale Produkt- und Generatorbindung
Native Coast-Slots: 8388608 Bytes, SHA256
\`${recipe.cases.nativeSourceSlotSha256}\`, vor/nach Export gleich, nicht detached.
Semantischer Native-Digest \`${recipe.cases.nativeSemanticDigest}\` ist **kein SHA256**.
Version \`${recipe.cases.nativeCoastVersion}\`, Seed \`${recipe.cases.nativeSeed}\`.
Crop: [-8,-2,-8],192×80×192,.125m, SHA256
\`${recipe.cases.cropMaterialSlotSha256}\`. Jedes Cropbyte ist gegen echte
native8MiB-Bytes geprüft. Native Pflanzen tree/reed/broadleaf/violet/amber mit
gebundenen Anker-/Supportzellen und stabilen nativen Kamera-IDs.

| Produktquellpfad im b3-Tree | Git-Blob | Byte-SHA256 |
|---|---|---|
${sourceTable}

Originale, erasure-/specifier-adaptierte Bytes und Adapterhashes:
\`${RUN}/stage-v1\` einschließlich \`source-adapters.json\`.
Nur zwölf erforderliche pure TS-Module plus drei read-only Datenquellen; enger
pure-presentation-Barrel statt Runtimekopie. Node22.23.2 native Type-Erasure plus
Importspecifieränderung, keine algorithmischen Produktpatches, kein TS-Loader/
Framework. Der dokumentierte ExperimentalWarning ist sichtbar erhalten.
Synthetischer Generator: \`exporters/synthetic.mjs\`, Version
\`rd02-small-fixtures-v1\`, Seed20261002, tatsächlicher Code-SHA256
\`${sha(readFileSync(path.join(LAB, 'exporters/synthetic.mjs')))}\`;
alle übrigen Exporter-Codehashes sind pro Recipe aufgeführt.

## Verifikation / ursprüngliche Gegenproben
PASS: FX01–FX05 unverändert als Test-IDs; insgesamt neun fokussierte Vitestchecks,
inklusive independent cell-neighbor/face-center/corner/normal/winding/material
Oracle (kein Produktionsmesher als eigener Beweis), Source-Nullmutation,
privater Importkopien, Coverage-Grenze/fehlender Coverage, atomarer Übergröße/
Hash-/Quellref-Ablehnung ohne frühen Mapzugriff und aller tatsächlichen Dateien.
PASS: Labcheck, ergänzender RD-02 Typecheck (Rootconfig bleibt eingefroren), Build.
PASS: konkrete Task/Start/Base-Grenze,52 Inputhashes,18/18 abhängige Freeze-Dateien.
PASS: alle \`${evidence.comparison.actualFileCount}\` tatsächlichen Dateien normal/reverse/statisch bytegleich;
gesamter Fixturedateibaum \`${evidence.comparison.fixtureTreeSha256}\`.
Original-AllfilesGate: **FAIL_ACCEPTED_NARROW_EXCEPTION**, ausschließlich die
automatischen untracked regulären enthaltenen \`.opencode/throughput.jsonl\` und
\`throughput.md\`; unberührt, nicht gestaged/committed/publiziert. Keine breite Ignore.

RED zuerst: ursprüngliche sechs Tests scheiterten an fehlendem Exporter.
Zweite RED-Runde: sieben PASS, zwei FAIL wegen noch fehlender statischer Dateien.
Quellpaletten-Gegenprobe scheiterte an fehlender expliziter Tonbindung; anschließend
nur Recipes/Inventar aktualisiert, alle Manifeste/Payloads/Szenarios bytegleich.
Die originalen negativen Source-/Test-/Recipebytes und Rohlogs bleiben außerhalb
des Kandidaten. Alle Logbytes/SHA sind frisch nachgerechnet, nicht nur behauptet.

| Lauf | Exitcode | Rohlogbytes | Rohlog-SHA256 | Rohlogpfad |
|---|---:|---:|---|---|
${commandTable}

Vollständige exakte binary/argv/cwd/process-local PATH/TEMP/cache/exit/log-Bindung:
\`${RUN}/commands.jsonl\`. Verifikationsevidence
\`${evidencePath}\` (SHA256 \`${sha(evidenceBytes)}\`).

## Reproduktion (cwd: eigenes Labverzeichnis)
Alle ausführbaren Dateien unter C:/IFI_SourceCode. Der kleine eigene Wrapper setzt
nur Prozess-PATH, npm-Shell, TEMP/TMP und Cache auf gepinnte eigene C-Pfade.
Kein globaler Configdelta. Sauberes eigenes Labinstall:

\`\`\`powershell
& '${node}' './reports/RD-02/run-command.mjs' reproduce-ci npm ci --legacy-peer-deps --no-audit --no-fund
& '${node}' './reports/RD-02/run-command.mjs' reproduce-export node exporters/export-fixtures.mjs --source-ref ${BASE} --out ${RUN}/reproduce-normal --stage ${RUN}/stage-v1
& '${node}' './reports/RD-02/run-command.mjs' reproduce-reverse node exporters/export-fixtures.mjs --source-ref ${BASE} --out ${RUN}/reproduce-reverse --stage ${RUN}/stage-v1 --reverse-order
& '${node}' './reports/RD-02/run-command.mjs' reproduce-check npm run check
& '${node}' './reports/RD-02/run-command.mjs' reproduce-rd02-types node node_modules/typescript/bin/tsc --project reports/RD-02/tsconfig.json
& '${node}' './reports/RD-02/run-command.mjs' reproduce-unit npm run test:unit -- tests/RD-02
& '${node}' './reports/RD-02/run-command.mjs' reproduce-build npm run build
& '${node}' './reports/RD-02/run-command.mjs' reproduce-boundary npm run verify:boundary -- --task RD-02 --start ${START} --base ${BASE}
\`\`\`

Die CLI verweigert fremde/gelinkte Outputs und verschiedene bestehende Artefakte;
für Wiederholung einen neuen eigenen Outputordner wählen. Native Proofbytes aus
dem Export werden von FX09 am dokumentierten eigenen stage-v1-Pfad gelesen.
Noch nicht verfügbarer Productgenerator wurde hier **nicht** behauptet: die reine
b3-Erzeugung läuft tatsächlich. Redditclips/JS-challenged Texte liefern dagegen
keine beobachteten Clipintervalle/Artabnahme, sind kein Ersatzbild und kein Exportblocker.

## Exportkosten und Grenzen
Zeit/CPU/RSS sind tatsächliche Node-**Exportprozess**-Diagnostik (measured), keine
Spiel-Framezeiten. 41370324 Payloadbytes insgesamt,160204 Manifestbytes,
größte Fixture23150628 Bytes. Cap je Fixture vor großen Allokationen: Manifest
1048576 Bytes, Payload134217728 Bytes; kein abweichendes Stressprofil verwendet.
Peak-RSS ist Prozessgesamtverbrauch, nicht das je-Fixture-Payloadlimit.

| Export | Wall ms | CPU user/system ms | Peak RSS KiB | F01 Phase ms |
|---|---:|---:|---:|---:|
${costs}

Der erste native Probeexport fand vier Reeds, aber keiner erfüllte den irrtümlich
engeren hardcoded Centerfilter; Auswahl nun an echten Cropbounds/Quellvolumenmaß.
Weitere Proben deckten echte wiederholte Materialrange-Runs auf: gemeinsame
Vertexpayloads und Index-Gathering je Material statt Buffer-/Manifestduplikaten.
Die1MiB/128MiB-Schwellen und nativen Profile wurden dafür **nicht** angehoben oder
vereinfacht. Kleine synthetische Szenen nutzen bewusst unit faces, keinen neuen
Produktionsmesher. Keine Grafik-/Runtime-Performanceoptimierung behauptet.

Boundarypolicy für zukünftiges Greedy/Ray: außerhalb Crop UnknownCoverage, keine
native analytische4m Ghost-/Join-Ausweitung. Native Water nur cropped Topmask-
Präsentation. Look-/Licht-/Color-Space-/Tonemapdaten sind gebunden; PCF, Sky,
Glints, Wasserpasses oder native GI sind dadurch **nicht** implementiert.
Browser/Screenshot: NOT_APPLICABLE (kein sichtbarer UI-/Renderpatch).
GPU-/Runtimebenchmark, Art-ACCEPT, Produktintegration: NOT_RUN / false.
Review: eigenes vollständiges Diff-/Datenreview; unabhängig/human NOT_RUN.
Defekte außerhalb Scope: keine bestätigten Produktdefekte gefunden.

## Cleanup / kleinster Übernahmevorschlag (KEINE Autorisierung)
Alle Befehle beendet; keine Dienste/Ports/Tabs gestartet, keine fremden Ressourcen
berührt. Eigenes node_modules/dist und eigene externe Quellen/Logs/Probeexports
bleiben nachvollziehbar erhalten; keine Löschung/Publication. Tracking nicht
angefragt und außerhalb des Schreibscopes; lokale äquivalente Prüfungen dokumentiert.
Für RD-03 genügen statisches Inventar/Manifeste/Payloads/Scenario plus die schon
eingefrorenen Importfunktionen. Kein Exporterimport im Browser, keine automatische
Registrierung. HEAD müsste eine Runner-Ladestelle unter src/runner und ggf. die
HEAD-eigene src/registration.ts separat bearbeiten. Ein späterer Produktvergleich
beträfe kleinstenfalls \`apps/weltraum-browser/src/hvp/hvpCoastMesher.ts\` und
\`apps/weltraum-browser/src/hestia-prototype/presentation/vegetation.ts\`;
keine aktuelle Produktübernahme, Schema-/Solver-/World-Authority-Änderung erlaubt.
`;
writeFileSync(path.join(LAB, 'reports/RD-02/HANDOFF.md'), report);
console.log(JSON.stringify({ report: 'reports/RD-02/HANDOFF.md', bytes: Buffer.byteLength(report), sha256: sha(report), fixtureInventorySha256: sha(inventoryBytes) }, null, 2));
