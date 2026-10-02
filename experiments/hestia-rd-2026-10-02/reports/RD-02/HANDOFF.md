# RD-02 Handoff an SO-01 / HEAD / RD-03

## Ergebnis
PASS: F00–F07 sind echte loadable LabFixtureV1-Dateiverzeichnisse: 16 Snapshots,
acht validierte 60-Hz-Szenariostreams. F01 ist product-derived aus tatsächlichen
b3-Bytes; alle Nachherzustände sind ausdrücklich presentation-replay.
ProductIntegrated=false. Keine Produkt-, Contract-, Package-, Lock-, Guard- oder
Registrierungsänderung. Kein Delegieren, Merge, Push, PR, DevToolbox-Tracking,
Dienst, Port, Browser-Tab oder GPU-Job.

Branch: `feature/hestia-rd-rd02-2026-10-02`. START-SHA `63e52eea0f2afbde03ab83b8d66f62941097b314`,
START-TREE `addf696048a320b9739fc1dc901047600d52e51c`.
Produkt-Lesequelle `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Historischer Septemberstatus ist kein Oktoberbeweis.
Die genaue nach Commit erzeugte Kandidaten-SHA/Tree und **jede geänderte Datei mit
Byte-/Git-Bindung** stehen in `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/final-receipt.json` und im terminalen Handoff.
HEADs unabhängige Prüfung/serielle Integration ist nicht vorweggenommen.

## RD-03: statische Daten laden
Alle folgenden Pfade sind relativ zu `fixtures/`. Zuerst Manifestbytes und alle
angegebenen Binärbytes mit dem unveränderten `src/contracts/fixture.ts#importFixture`
importieren; dann die Szenariobytes mit Digest→importiertes Fixture an
`src/contracts/scenario.ts#importScenario` übergeben. Kein URL-/Script-/Worldloader.
Material-Slots sind Zusatzpayloads, deren Zuordnung in `recipe.json#regions` liegt;
Belegung und KnownCoverage bleiben eigene uint8-Dateien. Pflanzen-slot0 ist nicht
globale KnownAir. Die nativen linearen Dekor-Tonpaletten sind quellgebunden unter
`F01-HVP-COAST/recipe.json#cases.nativeVegetationPalettesLinearRgb`; native
Vertexfarben/Materialprofile bleiben unverändert. Geometrie und Bounds sind
owner-lokal, danach den manifestierten Ownerframe anwenden.

Inventar `fixtures/inventory.json`: SHA256 `9ada4198596705053bcaecb68b5a5926bf6792e335feb6cc0cb4cd79fbc7a5f0`.
Es enthält **alle** SourceRefs, Payload-IDs/Pfade/Typen/Endian/Längen/SHA256,
Recipe-SHA und Scenario-Digests. Canonical Manifest-SHA = Fixture-Digest.

| Fixture-ID | Revision / Label | Manifestpfad | Fixture-/Manifest-SHA256 | Payloadbytes |
|---|---|---|---|---:|
| F00-CONTROL | 0 / initial | `F00-CONTROL/manifest.json` | `378513d00d5f2a11f569ff0748d4e42ac1832674104febd052070f0fd258b81d` | 300096 |
| F01-HVP-COAST | 0 / native-crop | `F01-HVP-COAST/manifest.json` | `688fda7d61d4d4a68a9917841ba8b7cb2722e04ddd6c4d9ce53039314d0b5b08` | 23150628 |
| F02-ROOT-GROVE | 0 / initial | `F02-ROOT-GROVE/manifest.json` | `3c93488d90c5382b77cb7c507d8b14518f846bd29322788b0d8e2c7fd269dc73` | 1654128 |
| F03-SHELTER | 0 / initial | `F03-SHELTER/manifest.json` | `442cf721ac4cccdc75004e9d03848fa57cebaac2a9b930ab731bbead417af3b2` | 708408 |
| F03-SHELTER-R1 | 1 / opening | `F03-SHELTER/snapshots/r1-opening/manifest.json` | `e678890af9ca58964bed5ac8a109411e3777e62202a6d576d7dd33d436f91538` | 669360 |
| F04-DETACH | 0 / intact | `F04-DETACH/manifest.json` | `92296096278b054830d3aabf3f320a68f568ec3a9e3b00e310a6c83751c7095b` | 140544 |
| F04-DETACH-R1 | 1 / detach | `F04-DETACH/snapshots/r1-detach/manifest.json` | `c45992d7a859482a869e8deebbecd0e54263986a0acbeca1dc0bde9d8cab4e3b` | 140544 |
| F04-DETACH-R2 | 2 / rotate | `F04-DETACH/snapshots/r2-rotate/manifest.json` | `7e1bb35d1a0ada1ff5ddda9719e7d2ad5710d11d59f0f28c7f72b20a04dce37e` | 140544 |
| F04-DETACH-R3 | 3 / remove | `F04-DETACH/snapshots/r3-remove/manifest.json` | `95e4ebc916e34c14d7ff46b0aa98ad2007d7c9f4e03c2463cc2bd75d7d5414bd` | 125040 |
| F04-DETACH-R4 | 4 / reload | `F04-DETACH/snapshots/r4-reload/manifest.json` | `8b7af46b9292ce40ead9545cf02d38bb7e57bf1205d7fbf1bf9f4c7af783832b` | 125040 |
| F05-CUTOUT | 0 / initial | `F05-CUTOUT/manifest.json` | `c24de4c1597713e11935bf98e8fe7c5a312a615ee3544831f6f97b74c948b904` | 977256 |
| F06-MATERIAL | 0 / initial | `F06-MATERIAL/manifest.json` | `5976e63aa161bd738d2267d67594c0c6cb8c6a1db2131c9ad3a71b2021ddc5cf` | 834480 |
| F06-MATERIAL-R1 | 1 / opening | `F06-MATERIAL/snapshots/r1-opening/manifest.json` | `81de4732517d6cf5259f7ec9afd4d4b7af05379feb7cff56afe9e80e16c6d91a` | 825360 |
| F07-SCALE-1x | 0 / 1x | `F07-SCALE/manifest.json` | `980b930bd3620585c476c5ac23492cb4fc28b0af5fe4d73b7176eb6b5b3e5c0f` | 1654128 |
| F07-SCALE-2x | 1 / 2x | `F07-SCALE/snapshots/r1-2x/manifest.json` | `5c175284f417975e6cea05481b8bc0525dcf9507b4d93f9620561d74db53ce40` | 3308256 |
| F07-SCALE-4x | 2 / 4x | `F07-SCALE/snapshots/r2-4x/manifest.json` | `25b3ce400b0c7384dfec29d54ffd306f66797349b24bab96d3adf22cf9dd7458` | 6616512 |

| Scenario-ID | Pfad | Scenario-/Byte-SHA256 |
|---|---|---|
| F00-CONTROL-REPLAY | `F00-CONTROL/scenario.json` | `24de3e02b3c7d2cf38f0f1dbf0b5f82a5107bc2507118726b5c081b3d05bf878` |
| F01-HVP-COAST-REPLAY | `F01-HVP-COAST/scenario.json` | `e41d4965131f17ad47ec7a7ce6db4a841d60a550abb86cd51206fa973c500bd9` |
| F02-ROOT-GROVE-REPLAY | `F02-ROOT-GROVE/scenario.json` | `bd92a9dce74c2e674ed9564586bea92da8b52952514b58a0fe2d29fde1bae8f9` |
| F03-SHELTER-REPLAY | `F03-SHELTER/scenario.json` | `5ae34ae681ab5525e410f5e815f92e6fa603aa253f1c50377c33fdfd80b21ced` |
| F04-DETACH-REPLAY | `F04-DETACH/scenario.json` | `0d9012b86bac2c620864774038a1aed987d81e2338f1618b4a434b49f9f0a623` |
| F05-CUTOUT-REPLAY | `F05-CUTOUT/scenario.json` | `d5192a3f8198faac430c232cd3604716daeb034211d309031749170c52abae64` |
| F06-MATERIAL-REPLAY | `F06-MATERIAL/scenario.json` | `ffca7e5fe106c613a4128da6abebe93402fa77a1dc8648f83b2317251ce351cf` |
| F07-SCALE-REPLAY | `F07-SCALE/scenario.json` | `8cc2fb2b371d7be61ea355b2db03ee03b6c988c7bfd0db4d34663e2961e5d9dc` |

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
`cf21b909845a2a037643f6e8fd8ec80faafbe37a3387d12515e6ce70fee84f13`, vor/nach Export gleich, nicht detached.
Semantischer Native-Digest `b8fde6b0` ist **kein SHA256**.
Version `hvp-authored-coast-v5`, Seed `hestia-hvp-lagoon-001`.
Crop: [-8,-2,-8],192×80×192,.125m, SHA256
`561b1ea853ee6377ec78337016725d6771f178e734925dd0d6d3a33ec7056c0a`. Jedes Cropbyte ist gegen echte
native8MiB-Bytes geprüft. Native Pflanzen tree/reed/broadleaf/violet/amber mit
gebundenen Anker-/Supportzellen und stabilen nativen Kamera-IDs.

| Produktquellpfad im b3-Tree | Git-Blob | Byte-SHA256 |
|---|---|---|
| `apps/weltraum-browser/src/core/hash.ts` | `d0613db4fbaecc8bfbf2ff80ad6a483e20430833` | `7514fc507d6c83404462d967ff4736790abf6425842b676cefedc4928a2febee` |
| `apps/weltraum-browser/src/hestia-prototype/presentation/look.ts` | `d4cd91baca674a027416e9cd8eab97532803080d` | `1c058c73d4313b6da757b341f6dad66173d73332d169d7dbe04710b96c0219ea` |
| `apps/weltraum-browser/src/hestia-prototype/presentation/vegetation.ts` | `089e5e985ee9ad271a3ed44e0bb3214ab28c0879` | `64806d7f77d6e562c8f1a36e7fb313c6353acca04d05331063af3773a519e1ae` |
| `apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts` | `5d99e23a6bc8dfd80e8bd8d056d3dea393daad2b` | `b02f1d1a114fd143201fd7f516c6bec52dd574d3e511fdc09aa5ffd7931ba31f` |
| `apps/weltraum-browser/src/hvp/hvpCamera.ts` | `3f87cadac0664db2b32aae04b25356bb0ead8c8d` | `b7bec67081a4ec0a9a532cc6b4dbc929fd0be56dd5367a965c66891ae487bf56` |
| `apps/weltraum-browser/src/hvp/hvpCoastMesher.ts` | `1fad35b9ca837256f8acfd1ed1ebeb97ca5b4c26` | `437f3f48a3e578174f23b0956e3a3a2fee975a25b4576cc77b7af87c91930a6a` |
| `apps/weltraum-browser/src/hvp/hvpCoastSource.ts` | `0e9d3226828cc0a233791b77b634aa91c0c39771` | `c13e3107a542b402faf342befb479e6bf74d94730b16c4caf73d1f911fad8be4` |
| `apps/weltraum-browser/src/hvp/hvpTerrain.ts` | `86aeb3b74a8a2c04fb8e8f6624f6ecdd9b66b9d0` | `93019417d3f022ead0ee3f9bf42eefce6e249fe135fa61916424d78b19ba1a11` |
| `apps/weltraum-browser/src/presentation/canonical.ts` | `54720c15972daeccfa1b8bc781deb2933da4c4b4` | `67558d89ff09e99588101618eb02c5820a042a27850e884db91b0e80188862c8` |
| `apps/weltraum-browser/src/presentation/ids.ts` | `a201fa411bd72e4cd39504a6d84ba008267263f1` | `50d7642fe0fbf097bf2cd80275ff5d4243b69cb62c93a7bad14612f5c2ce96a2` |
| `apps/weltraum-browser/src/presentation/index.ts` | `17b2f92823dc571ba2c16268907a904e68f9e3f0` | `d1cc7c04ed7bf95d023f8a75c8d6b6edb558bc67e0c24e16298d81f7d6321d49` |
| `apps/weltraum-browser/src/presentation/materialProfile.ts` | `8c4d6e98721d03d90881c99b152c96bfd20cf063` | `1d871f968781bdf67c9e6b5517daad94bddccf373950b3f022e68769e7278134` |
| `apps/weltraum-browser/src/presentation/meshArtifact.ts` | `d6e3d92f52370e380a081c6a6b5bf1af88ebadc0` | `070a4bef18182a666a8bdd57518da057370ccca2c8d3c9047506a0a12e4ff671` |
| `apps/weltraum-browser/src/presentation/validation.ts` | `351b6f7385dd612724912d58c8288ddb99109117` | `e93eadb015c284865184a997b9542fc351ab4c0b4f67247a9adb80890bafb1ff` |
| `apps/weltraum-browser/src/voxel/blockAmbientOcclusion.ts` | `e01256c79c2c0efa1e871c5de835102adb66f65c` | `ddfb1d22eccdcb83e48f8c21d82605339936600a6afbbc452bdcdce497ca7675` |

Originale, erasure-/specifier-adaptierte Bytes und Adapterhashes:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/stage-v1` einschließlich `source-adapters.json`.
Nur zwölf erforderliche pure TS-Module plus drei read-only Datenquellen; enger
pure-presentation-Barrel statt Runtimekopie. Node22.23.2 native Type-Erasure plus
Importspecifieränderung, keine algorithmischen Produktpatches, kein TS-Loader/
Framework. Der dokumentierte ExperimentalWarning ist sichtbar erhalten.
Synthetischer Generator: `exporters/synthetic.mjs`, Version
`rd02-small-fixtures-v1`, Seed20261002, tatsächlicher Code-SHA256
`ffaaee3e48678eac172fa66dfecd4f48a8b966583f167bbae3918803aceb1dd9`;
alle übrigen Exporter-Codehashes sind pro Recipe aufgeführt.

## Verifikation / ursprüngliche Gegenproben
PASS: FX01–FX05 unverändert als Test-IDs; insgesamt neun fokussierte Vitestchecks,
inklusive independent cell-neighbor/face-center/corner/normal/winding/material
Oracle (kein Produktionsmesher als eigener Beweis), Source-Nullmutation,
privater Importkopien, Coverage-Grenze/fehlender Coverage, atomarer Übergröße/
Hash-/Quellref-Ablehnung ohne frühen Mapzugriff und aller tatsächlichen Dateien.
PASS: Labcheck, ergänzender RD-02 Typecheck (Rootconfig bleibt eingefroren), Build.
PASS: konkrete Task/Start/Base-Grenze,52 Inputhashes,18/18 abhängige Freeze-Dateien.
PASS: alle `429` tatsächlichen Dateien normal/reverse/statisch bytegleich;
gesamter Fixturedateibaum `1c42b187cd540f416e4dbf9495aa9f21ae66c021130865b2a419f88a3faa3665`.
Original-AllfilesGate: **FAIL_ACCEPTED_NARROW_EXCEPTION**, ausschließlich die
automatischen untracked regulären enthaltenen `.opencode/throughput.jsonl` und
`throughput.md`; unberührt, nicht gestaged/committed/publiziert. Keine breite Ignore.

RED zuerst: ursprüngliche sechs Tests scheiterten an fehlendem Exporter.
Zweite RED-Runde: sieben PASS, zwei FAIL wegen noch fehlender statischer Dateien.
Quellpaletten-Gegenprobe scheiterte an fehlender expliziter Tonbindung; anschließend
nur Recipes/Inventar aktualisiert, alle Manifeste/Payloads/Szenarios bytegleich.
Die originalen negativen Source-/Test-/Recipebytes und Rohlogs bleiben außerhalb
des Kandidaten. Alle Logbytes/SHA sind frisch nachgerechnet, nicht nur behauptet.

| Lauf | Exitcode | Rohlogbytes | Rohlog-SHA256 | Rohlogpfad |
|---|---:|---:|---|---|
| own-ci | 0 | 25 | `0192d9ae5a4664d833069d4a2884376c0235e712fff35d0b872a11a76b33f402` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/own-ci-1790962607324.log` |
| red-unit | 1 | 4893 | `0a65ba578c8546d3a61f235e5653c1e860cfce6ef4e6798cbc87d57304326c4b` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/red-unit-1790962618490.log` |
| red-artifact-unit | 1 | 2602 | `25ecec8b1e942818b5e82712cf3730093ab03ed08642743fd863ffb8e539b0da` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/red-artifact-unit-1790964358829.log` |
| red-palette-binding | 1 | 2248 | `2e6d6b3f6caea51733f326cd57dd354499cf2292a3d920f7dcf3c84916f7ebf1` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/red-palette-binding-1790964840371.log` |
| export-final-normal | 0 | 5823 | `5e8c99c42be5a5e51a627b7d8e92e06541ea439711bc3ad5b9ace3fad4ff218c` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/export-final-normal-1790964912448.log` |
| export-final-reverse | 0 | 5823 | `282e7853cb5926aa4940ea374a5b46e85a1060279f3887f10bcc1a10c5bf149a` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/export-final-reverse-1790964955651.log` |
| final2-check | 0 | 177 | `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/final2-check-1790965274055.log` |
| final2-rd02-typecheck | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/final2-rd02-typecheck-1790965289013.log` |
| final-unit | 0 | 458 | `7106e0a253b8294ea0e582450c837699a6e159ad16093d9885e24c602c41901d` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/final-unit-1790965320959.log` |
| final2-build | 0 | 469 | `add98e724242e0552c4bdb3cabdbdad8046ed49224208f6b18a481c852fa7673` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/final2-build-1790965330990.log` |
| final-boundary | 0 | 57750 | `bc4cdcc818f74fb34f95e0065e374ac6e0d0e1d20c7fa04dc46f864ce4f404b2` | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/logs/final-boundary-1790965652901.log` |

Vollständige exakte binary/argv/cwd/process-local PATH/TEMP/cache/exit/log-Bindung:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/commands.jsonl`. Verifikationsevidence
`C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-runs\RD-02\verification-evidence-1790965945760.json` (SHA256 `6616b602c5675d394c1faa0e7fe1947c554a7d846fab6861b8dc48277250f63f`).

## Reproduktion (cwd: eigenes Labverzeichnis)
Alle ausführbaren Dateien unter C:/IFI_SourceCode. Der kleine eigene Wrapper setzt
nur Prozess-PATH, npm-Shell, TEMP/TMP und Cache auf gepinnte eigene C-Pfade.
Kein globaler Configdelta. Sauberes eigenes Labinstall:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-ci npm ci --legacy-peer-deps --no-audit --no-fund
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-export node exporters/export-fixtures.mjs --source-ref b3c6523a94cd050f5a9a22dc27f4777fcc03363e --out C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/reproduce-normal --stage C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/stage-v1
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-reverse node exporters/export-fixtures.mjs --source-ref b3c6523a94cd050f5a9a22dc27f4777fcc03363e --out C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/reproduce-reverse --stage C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/stage-v1 --reverse-order
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-check npm run check
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-rd02-types node node_modules/typescript/bin/tsc --project reports/RD-02/tsconfig.json
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-unit npm run test:unit -- tests/RD-02
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-build npm run build
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-02/run-command.mjs' reproduce-boundary npm run verify:boundary -- --task RD-02 --start 63e52eea0f2afbde03ab83b8d66f62941097b314 --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e
```

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
| normal | 14007.798 | 10312 / 1516 | 309852 | 2115.061 |
| reverse | 15410.948 | 10265 / 1579 | 312776 | 1862.095 |

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
beträfe kleinstenfalls `apps/weltraum-browser/src/hvp/hvpCoastMesher.ts` und
`apps/weltraum-browser/src/hestia-prototype/presentation/vegetation.ts`;
keine aktuelle Produktübernahme, Schema-/Solver-/World-Authority-Änderung erlaubt.
