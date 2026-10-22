# PMD shared global source — 2026-10-19

**PRIVATE_SHARED_PMD_SOURCE_PENDING_ROOT_REVIEW.** Privater Sourcekandidat fertig; normale Source-/Produktadoption bleibt HOLD. Derselbe bestehende Hestia A0, App `01a13648-c55b-7250-bf07-34921d70b43b`, tatsächlicher Turn `01a154f1-40c8-7e32-8a59-5728eed9e9cf`. Keine Kinder, neuen Owner oder Worktrees.

P = `C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-pmd-shared-global-source-r01`.

## 1. Tatsächlich implementierter gemeinsamer Pfad

`src/world-generation/planetaryMacro.ts` erzeugt eine versionierte globale PMD. `planetaryMacroTerrain.ts` transformiert reale SurfaceLocal-Punkte mit dem vorhandenen `transformPosition` nach BodyFixed und verwendet denselben Sampler wie `macro.ts` → `climate.ts` → `weather.ts`/`createAnalyticReadView`. Tatsächliche `allocateVoxelChannels`, `voxelSampleIndex`, `createVoxelBrick` und `validateVoxelBrick` erzeugen und validieren vollständige Float32-/Uint8-Bricks. Terrainbindung, Macroprojektion, ClimateNormals und WeatherEpochBinding verwenden denselben PMD-ExactRef.

Der Kern bekommt den autoritativen Bodykontext vom Caller. Er validiert ihn mit vorhandenem `createCelestialBodyDefinition`; Factory/Seed/Validator/Terrain erzwingen Hestia nicht. Das Kandidatenszenario wählt Hestia aus dem echten Starterkatalog: `planet.hestia`, Radius **8.282.000m**, kanonischer BodyFixed-Nordpol **+Z**. Der bestehende Geometry-Fall verwendet zusätzlich `moon.hestia.luma`, Radius650.000m, und weist einen falschen erwarteten Body ab. Der WXG-Adapter übernimmt den Body aus dem validierten Fixturekatalog; getrennte Vendor-/Engine-ID-Brands werden an dieser Grenze mit dem vorhandenen Bodyvalidator aufgelöst.

Profil `pmd.generated-global.candidate.v1`, expliziter Seed `pmd.generated-global.r01`, Generator `pmd.global-fbm3.v1`, Revision1. Globaler Domainseed enthält ausschließlich expliziten Seed, BodyId, Generatorversion und Long-/Detail-Domain. SurfaceFrame, Region, Wetter und Zeit gehen nicht in ihn ein. Hauptprofil:

`h(n) = 2500 * (0.75 * fbm3(longSeed, 2*n, 4) + 0.25 * fbm3(detailSeed, 16*n, 3))`.

Vorhandene Noisebytes bleiben unverändert, vorhandene ASCII-/Lattice-Hasharithmetik wird privat aus dem SurfaceFrame-lokalen Seed-API entkoppelt. Beide fBm-Werte und die Höhe werden gegen ihre Hüllen geprüft. 2/16 sind dimensionslose Latticeskalen. Datum ist die Radiuskugel, Hüllbereich **[-2500,+2500]m**. Die 2499m-Variante ist ausschließlich der von Root erlaubte Consumer-Kopplungstest; der eigentliche Kandidat bleibt2500m.

Der Brick liegt nahe seiner generierten Oberfläche; 32×64×32Zellen, 35×67×35Samples, 0,25m, also16m vertikale Kernhöhe. SignedDensity ist `fround(length(p)-radius-h(unit(p)))`. MaterialID0 ist ausdrücklich erzeugtes vorhandenes dark_rock/SolidRock, auch für unbenutzte Airsamples; density>0 bestimmt Luft. Keine neue Air-ID.

## 2. Tatsächliche Kopplung und Wissensgrenzen

Finaler PMD-ExactRef-Digest: `sha256:902eece5cabdc36b62dfc5fafdf028f8e5f8a4d4b68ee4a86050b6f0d74ae3c3`.

Im erfolgreichen `PMD_CLIMATE_R03` wurden zwei vollständige echte Bricks erzeugt und validiert. Tatsächliche Contenthashes: Hauptprofil `fnv1a64:2ffd7b87ac122fb3`, Amplitudenvariante `fnv1a64:5f0293df73e831ee`. Am selben kanonischen Punkt ändern sich Höhe865,4578500843073→865,1116669442736m und tatsächlich gespeicherte Dichte ca.0→0,3461831510066986. Die WXG-Lapsetemperatur ändert sich gleichzeitig282,7607693068899→282,76180785631K bei0,003K/m. Beide Bricks haben positive und negative Samples, alle Materialsamples erfüllen die explizite ID0-Policy. Die Macroprojektion wurde gegen denselben Terrain-PMD-Ref geprüft; der AnalyticReadView-Fall prüft seinen tatsächlichen WeatherEpochBinding gegen ClimateNormals und PMD.

Negative Höhe−188,99383052485064m liefert285,9241243487174K innerhalb der Klimahülle[233,78571428571428;326,2142857142857]K. Die warme Grenze berücksichtigt nun `-minimumElevation*lapse`. Der Null-Lapse-Gegenvergleich prüft die zusätzliche2500m-Erwärmungsreserve.

`physicalComposition`, `realReservoirInventory` und `biome` bleiben **UNKNOWN**. Reservoir ist explizit `{status:'UNKNOWN'}`, nicht null/0; Biom-/Hydrologiehinweise bleiben UNKNOWN. Eine Flüssigkeitshülle unter Datum0 ist nur eine geometrische Kandidatenannahme. Keine bekannte Spezies, Masse, natürliche Atmosphäre oder reale Geologie wird daraus abgeleitet. Die bestehenden synthetischen Fixtures und Klimakonstanten behalten TestAssumption-Provenienz, die ursprünglichen Hestia-/CEL-Status bleiben erhalten. Präzipitation bleibt im geprüften trockenen Pfad leer.

## 3. Frische Checks und erhaltene Fehlerbelege

| Finaler Check | Ergebnis |
|---|---|
| `PMD_PREPARE_R04`, `PMD_TSC_R04`, `PMD_SEAL_R02` | PASS, strikter TS7-Emit, 159 gebundene Emit-Dateien |
| `PMD_GEOMETRY_R03` | 8 PASS, 0 FAIL |
| `PMD_CLIMATE_R03` | 7 PASS, 0 FAIL |
| `PMD_WXG_R02` | 12 PASS, 0 FAIL, 1 ausdrücklicher Worker-SKIP |

Insgesamt final **27 PASS / 0 FAIL / 1 SKIP**. Die drei vorhandenen Pure-Testdateien wurden erweitert; keine parallele Suite. Hooks/Imports wurden vor dem Lauf gelesen; der bestehende Workerfall bleibt ausgeschlossen und wird nicht als PASS gezählt. Kein Worker wurde gestartet. Node wird direkt mit dem jeweiligen Testdateipfad aufgerufen; kein Browser-/Spielprozess.

Alle18 unverändert über `Run-Check.ps1` ausgeführten Toolaufrufe haben Terminal, stdout/stderr EOF und geschlossenes eigenes Handle; kein Prozess-/Cleanupfehler, Maximum4084ms einschließlich eigener Bereinigung. Runner3295Bytes/SHA256 `e5d5f7ee00e7a6d3b7f14d240c5ff133c44e4230b87a99a3a543efdc8a8f6abe` unverändert. Die Rohbelege enthalten die exakten Node-/TSC-Kommandos, PID, CreationTime und Exitstatus.

Vier frühere eigene Source-/Testfehler wurden innerhalb dieses Auftrags korrigiert; ihre Rohbelege bleiben erhalten: TSC_R01 leeres Tuple/`includes`, GEOMETRY_R01 ungültige Großbuchstaben im Test-Frame-ID, CLIMATE_R01 Objektprototyp statt kanonischer Datenvergleich, TSC_R03 getrennte Vendor-/Engine-ID-Brands. Keine Wiederholung nach einem Prozess-/Cleanup-/Deadline-HOLD. Kein separater RED-Lauf auf dem unveränderten Vorgänger wird behauptet. Ein fehlgeschlagener PowerShell-Metadatenversuch (`true` statt `$true`) schrieb noch keinen Preservationbeleg; der korrigierte Readback ist separat erfolgreich. Scoped Git-Diff enthält nur zwei CRLF-Hinweise, keine Byteänderung der Originale.

## 4. Konkrete Byte-, Diff- und Importbindungen

Neuer wirksamer Modellpin: `sha256:70989d6d354df4ccb81ae3073289964b52d30969761647ae96041b894f2335b2`. Der alte72665dc1-Pin ist kein Kandidatenpin. Die vorhandene Build-/Bindingmechanik wurde weiterverwendet: 45 tatsächliche private Sourceinputs einschließlich Profile, Provider, Terrain und aller übernommenen Enginequellen; zusätzlich binden ConsumerBindings die45 Quellen und beide vorhandenen Buildskripte. Testhelpers prüfen Consumer-/Emitbytes vor dem dynamischen Fixtureimport.

Datei-SHA256: `.runtime/model-binding.json` `023f94598de660fa1e827031410616929ce3510c05573a49935956ff94b8142b`; `ConsumerBindings.json` `12b0b11d42e0ad3e2ecd50a1b5d494b494b28d0483c9997db874941e89fb0cfb`; `.runtime/build-bindings.json` `df9ef99fc4b9831615092b1186e5b68fd04b10be7d8310b54fad91092970b8ab`.

`evidence/SOURCE_DIFF.patch` enthält15 konkrete Änderungen gegenüber den gebundenen WXG-Originalen bzw. der normalen Seedquelle und drei neue PMD-Dateien, SHA256 `b92a71576e497dccfb924c63fc2be1d45f4e6dbbfad369f6133e606b58f15044`. `SOURCE_CHANGE_BINDINGS.json` bindet jeden Before-/Afterpfad und Hash. Die34 Enginekopien sind in `ENGINE_INPUT_BINDINGS.json` einzeln aufgelöst;33 bleiben byteidentisch, nur die private Seedkopie wurde entkoppelt. `IMPORT_GRAPH_FINAL.json` löst153 relative Sourceimporte auf, keine ausgeschlossene Runtimekante. Quell-/Typ-/Katalog-/Voxelabhängigkeiten bleiben innerhalb P; kein breites Renderer-/Rapierbarrel.

Frisch vor Verwendung geprüft und final erneut bestätigt: alle118 Rootinputs (88WXG,23kritische normale Quellen,2Tools,5Rootbelege), alle34 übernommenen normalen Originalquellen und alle275 ursprünglichen BodyFixed-Rootmanifestdateien unverändert. `INPUT_PRESERVATION_FINAL.json` enthält die konkreten Readbacks, keine globale Inventurbehauptung. `ROOT_INPUTS.json` und `ENGINE_INPUT_BINDINGS.json` sind die aktuellen Eingangsbindungen; die mitkopierte historische `INPUT_REFERENCES.json` wird nicht als neuer PMD-Sourcebeleg umgedeutet.

## 5. Lieferung, Zeit und verbleibende Grenzen

Relevante Belege unter P: `evidence/PMD_BRICK_WXG_PROOF.json` (aus tatsächlichem erfolgreichem stdout extrahiert), die18 Prozessrohbelege, Diff-/Import-/Preservationbelege, `SOURCE_MANIFEST_FINAL.json`, `FREEZE.json` und separate `APP_TURN_CLOSE.json`. Das abschließende Manifest bindet alle Dateien außer diesen drei sich selbst bzw. zeitlich nachgeordneten Abschlussdateien; Freeze bindet den Manifesthash. Die separate Abschlussdatei bindet Bericht/Freeze und den letzten Zeitpunkt vor der finalen Rückgabe.

Tatsächlicher Appstart16:14:19UTC; unveränderter früherer Rootendpunkt16:48:54UTC; letzte180s ab16:45:54UTC ausschließlich Abschluss. Kein Fristreset und keine Check-/Timeoutverlängerung. Freeze und Abschlussvorbereitung sind **nicht** das tatsächliche Appende. Dessen Hostzeitpunkt kann dieser noch laufende Turn nicht selbst beobachten; Root muss nach final/idle den abgeschlossenen Turn lesen. `APP_TURN_CLOSE.json` weist diese Grenze ausdrücklich aus.

Normale Sources, Produktdefault, Saves, Golden-/Rootbelege und bisherige Gatebedingungen bleiben unverändert. Keine Runtime-/Referenz-/Cross-Device-/Produktabnahme; Worker, Rapier/WASM, Renderer/GPU, Browser, Physik/M5/Native24, GFX05-Referenz und Saveausführung **NOT_RUN**. Natürliche Geologie, Reservoirinventare, reale Biom-/Atmosphärenvalidierung und Welt-/Produktanwendung bleiben offen. Root prüft die finalen Bytes separat; keine automatische Fortsetzung.
