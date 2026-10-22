# PMD normaler Core — Sourceabschluss am 20.10.2026

**NORMAL_CORE_SOURCE_PENDING_ROOT_REVIEW.** Der normale PMD-Core und seine tatsächliche private Terrain-/WXG-Anbindung sind vollständig geprüft im zugelassenen Sourceumfang. Keine Default-, Welt-, Save-, SDK- oder Produktaktivierung. Derselbe Hestia A0, App01a13648-c55b-7250-bf07-34921d70b43b, vorhandener Branch `feature/hestia-a0-benni-pc-2026-10-13`, HEAD `6ac0f61947c5a6aa3e5b156831542d8188c75c0a`.

P = `C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-pmd-normal-core-source-r01`; C = P/`CONTINUE_20261020_R01`. Der19Oct-Altturn01a1551c-97ee-7592-bc85-80b536a47324 bleibt **INTERRUPTED, tatsächliches Ende/Dauer UNKNOWN**. Seine abgelaufene Frist und seine Belege wurden nicht umgeschrieben oder als neuer Grant verwendet.

## 1. Tatsächliche normale Quellen und Caller

Genau sieben normale Pfade im finalen scoped Gitdiff: `src/world-generation/{planetaryMacro.ts,planetaryMacroTerrain.ts,planetaryMacroModelPin.ts,latticeNoise.ts}`, bestehende `hestia/noise.ts`, `hestia/seed.ts` und `tests/unit/hestiaSeedDeterminism.test.ts`, jeweils unter `apps/weltraum-browser`. Die drei ursprünglichen Vorbilder bleiben unverändert unter P/before. Alle sieben aktuellen20Oct-Vorbilder und die fünf aktuellen Bindungsdateien wurden zusätzlich unter C/before gesichert. Heute wurde ausschließlich der Pfadbezug des bestehenden AST-Tests korrigiert; kein Implementierungsneustart.

Der normale Provider verlangt expliziten validierten Body und Profil mit ID, Version, Seed, Amplitude und gewählter Kandidatenpolicy. Er bindet gültigen Radius/Rotation/kanonischen+Z-BodyFixed und verwendet unveränderte2/16-Latticeskalen,4/3Oktaven,0.75/0.25Gewichte. Globale Seeds enthalten keinen SurfaceFrame/Tick/Wetterzustand. Null-/nichtfinite Vektoren werden durch den bestehenden Spatial-Normalizer abgewiesen. Kanonische UTF8-Bytes/WebCrypto-SHA256 bleiben ungerundet. Es gibt kein privates WXG-common, kein Hestia-Kandidatenprofil und keinen privaten Gesamtmodellpin im normalen Provider.

Der normale Terrainadapter bleibt ausdrücklich beim vorhandenen Hestia-V1-Voxel-/Materialvertrag. Caller liefern Body-/Surfaceframe, UniverseTime/causalTick, Region, Brickkoordinate, Voxelmaß und Revisionen. Bestehende Frame-/Time-/Body-/Parent-/Systemprüfungen, `storedSampleToGlobalCoordinate`, `globalSamplePositionMeters`, `transformPosition` und reale Voxelkanäle/create/validate werden verwendet. Positiv bedeutet Luft, MaterialID0 ist ausdrücklich erzeugtes vorhandenes SolidRock auch für unbenutzte Airsamples. Keine neue Material-/Persistenzautorität und keine normale Tick0-/Identitätsframe-Conveniencefunktion.

Private Profil-/Spielwahl, Hestia/Luma-Katalogszenarien und WXG-Klimafixtures bleiben privat. P/src/macro.ts importiert den tatsächlichen normalen Provider; die Tests importieren tatsächliche normale Emissionen unter P/dist/apps/weltraum-browser/src. Keine zweite private Provider-/Terrain-/src-engine-Kopie. Macroprojektion, direkter Sampler, ClimateBuilder und AnalyticReadView verwenden denselben PMD-ExactRef. Physische Zusammensetzung, reale Reservoirinventare und Biome bleiben UNKNOWN; die Flüssigkeitshülle ist nur geometrische Kandidatenpolicy. Negative Höhen sind weiter in der warmen Klimagrenze enthalten.

## 2. Aktuelle sinnvolle Purechecks

| Beleg | Tatsächliches Ergebnis |
|---|---|
| `CONT20_SEED_R01` |6PASS: feste FNV-/Noisevektoren, Byte-/Seed-/Maßgrenzen und vollständiger V1-Brickhash;1FAIL im cwd-abhängigen AST-Guard |
| `CONT20_SEED_GUARD_R02` | korrigierter bestehender AST-Guard1PASS;6bereits erfolgreiche Fälle gezielt ausgefiltert, kein zusätzlicher Erfolg dafür gezählt |
| `CONT20_DENSITY_R01` |14PASS: feste Feldgleichungen, validierter vollständiger Brick, Material-/Fehlergrenzen und X/Y/Z-Apron-Bitparität |
| `CONT20_WXG_R01` | am unveränderten aktuellen Modell12PASS/1ausdrücklicher Worker-SKIP |

Damit sind **21 verschiedene bestehende V1-Fälle nachgewiesen** und WXG aktuell erfolgreich. Es wird kein neuer kompletter7PASS-Seedlauf nach der Pfadkorrektur behauptet: der Beleg ist bewusst6unveränderte erfolgreiche Fälle ausR01 plus der gezielte erfolgreiche Guard ausR02. Der erste Fehlbeleg bleibt erhalten. Keine Testsuite, Countziele, Mock-, Runner- oder Bootstrapumgehung wurde eingeführt; ein Namefilter war kein Beweis für ausgeschlossene Hooks. Beide vollständigen Testdateien und der echte Hook-/Resolverabschluss wurden vorher gelesen.

Der Guard suchte ursprünglich relativ zu process.cwd(), während der unveränderte gebundene Prüfer in P startet. Der bestehende Test bestimmt nun sein normales Appverzeichnis aus `fileURLToPath(new URL('../../',import.meta.url))`; auch TypeScriptAPI liest dieses tatsächliche normale Projekt. Die genaue Sieben-Modul-Grenze, verbotene Inputs und die enge zusätzliche Prüfung von ../latticeNoise mit ../core/hash und ../voxel/ids bleiben bestehen. Keine Guardlockerung und kein Fakeprojekt. Der tatsächliche API-/AST-Check ist erfolgreich.

Goldenbelege: macroSeed1161633489, rockSeed3438350283, lattice735284689, noise2−0.19953450047603027, noise3 0.6146136134701656, fbm2−0.18095702931682447, fadeQuarter0.103515625. Vollständiger Hestia-V1-Brickhash **fnv1a64:12d868170450df55** tatsächlich unverändert; Feldvektor einschließlich density8.518786430358887 im vorhandenen Densityfall bestanden. Dies ist kein bloßer zweimal gleicher Neuoutput.

Alle vier neuen Checks verwenden den unveränderten3295Byte-Run-Check.ps1/SHAe5d5f7ee00e7a6d3b7f14d240c5ff133c44e4230b87a99a3a543efdc8a8f6abe. Eigene PID/CreationTime, Terminal, vollständige Streams und tatsächlich geschlossenes Handle sind in den rohen CONT20_*-Receipts belegt; failure=null, kein Start-/Timeout-/Cleanupfehler. Maximum7473ms bei48sArbeit/60sGesamt. Der erste NichtnullExit ist ein erlaubter reiner Resolver-/Testfehler, keine verschleierte Prozessstörung.

Passende bestehende Belege `NORMAL_GEOMETRY_R03` (8PASS), `NORMAL_CLIMATE_R02` (7PASS) und `NORMAL_TSC_R04` werden mit unveränderten tatsächlichen Source-/Bindungsinputs weiterverwendet. Keine Wiederholung unveränderter erfolgreicher Gruppen. Die alten27PASS/1SKIP des separaten privaten Kandidaten werden nicht als neue Normal-Core-Prüfung ausgegeben.

## 3. Wirkliche Source-/Modell-/Consumer-/Emitbindung

Normaler Algorithmuspin **sha256:67d60634e52c4b47c6a829ea07e4ade44c0f214c3580a4cef966aaa31f54143e** bindet33normale transitive Algorithmus-/Noise-/Typ-/Validierungsquellen. Sein eigener generierter Pin ist zur Zyklusvermeidung ausgeschlossen; keine absolute/private A0-Adresse steht darin. Privater WXG-Gesamtpin **sha256:9df122a0286dffdbe09c5812a49202791f841e8511aa8cb97e39d59ab04a3a5c** ist getrennt und bindet54tatsächliche Inputs einschließlich normaler Quellen/des Pins.177Emitdateien, Consumer- und Build-/TSConfigbindungen stimmen frisch. Die fünf vorliegenden Bindungsdateien wurden in diesem Restauftrag nicht neu erzeugt; nur der AST-Test änderte sich und ist kein Algorithmus-/Emitinput.

`SOURCE_CONSUMER_EMIT_AUDIT.json` prüft alle tatsächlichen Source-/Consumer-/Emit-Hashzeilen und444auflösbare Importkanten.11literale dynamische Imports liegen in privaten Testhelpers,0in normalen Sources. Keine übersehene dynamische Providerkopie, kein Rapier-/Renderer-/Spielworkerbarrel. WXG prüft diese Bindungen selbst vor dem dynamischen Fixtureimport. Die bestehende private Buildmechanik verwendet den realen gemeinsamen Worktree-rootDir und privates outDir, kein P/src-only-Scheinabschluss.

Der aktuelle beibehaltene PMD→Brickbeleg ist unter C/RETAINED_PMD_BRICK_PROOF.json mit Herkunft/SHA des unveränderten ClimateR02 gesichert: PMD-Digestcadc3c8e0f6bdbad5c3c75dd7c9e2a52cdc2d7bb0558ce3696960318d1b52696, vollständiger validierter Brickfnv1a64:1e5d00ed59fd9241. Die explizite Amplitudenvariante hatfnv1a64:e4e838e6a5c06217. Caller-Brickkoordinatey=1 verschiebt den geprüften Samplepunkt tatsächlich16m und ergibtfnv1a64:d90f6db774e69dfc; Regionpmd.fixture.region, causalTick120, SourceRevision7 sind gebunden. Falscher Tick/Epoch-Zustand wurde im bestehenden Climatefall abgewiesen. Kein neuer Runtime-/Produktbeleg wird aus dem bloßen Extrahieren dieser früheren Rohdaten erfunden.

## 4. Vorbilder, Werkzeugkorrektur und finaler Diff

Die vollständigen ursprünglichen1212Werkzeugdateien und sieben Entrypoints stimmen frisch mit der ursprünglichen Qualifikation. Richtiger Digest6c0ffa1239efd3a27ef2dac356cc9a7dfcf52062b09a50a4f219031e941daf46: **relative Pfadschlüssel ordinal sortieren, danach path|bytes|sha256 serialisieren**, LF/UTF8 ohne Schluss-LF. Die alte kompletteZeilensortierung war ein Prüferfehler. Alte M5_TOOL_MODULE_TREE.json/78dbfc... und alte statische Noise-Metadaten bleiben unverändert; keine Werkzeugdrift, Installation, Reparatur oder Versionsabfrage. Private reine Vitestkonfiguration übernimmt das vorhandene qualifizierte Resolvermuster mit echten originalen Vitest-/TypeScriptmodulen; Cache/Temp liegen ausschließlich unter C, eigener Temp nachher leer.

`NORMAL_ORIGINAL_TO_FINAL.patch` enthält den exakt gelesenen598-Zeilen-Diff aller sieben Normalpfade gegenüber den ursprünglichen drei Vorbildern bzw. /dev/null für die vier neuen Dateien:35168Bytes/SHA256369669270c0cce66c8cb6a549f8e1543e770378d6ca887a437fb448c14fbee00. `NORMAL_CHANGE_BINDINGS.json` trennt ursprüngliche Vorbilder, sieben20Oct-Beforeimages und finalen Afterimage.20Oct änderte genau einen dieser Pfade. Der scoped Gitstatus zeigt genau drei Änderungen und vier neue erlaubte Dateien; keine globale Cleanbehauptung. Kein bestätigter verbleibender Sourcefehler im abschließenden eigenen Review; unabhängige finale Rootannahme bleibt offen.

Alle28historischen Schutzdateien,319eingefrorenen Kandidatendateien und sämtliche296Dateien des P-Bestands vor dieser Fortsetzung sind nachher bytegleich. Alle fünf aktuellen Modell-/Consumer-/Emit-/Configbindungen sind bytegleich. Ursprüngliche normale Vorbildbindungen wurden nicht als unveränderte aktuelle Sources umgedeutet: die sieben normalen Afterimages sind bewusst neue Quellen. Vollständiges P-Inventar/Manifest trennt historischen296erBestand, neue Continue-Dateien und neue CONT20-Receipts; Selbst-/nachgeordnete Manifest-/Freeze-/Close-Dateien werden ausdrücklich separat gebunden.

## 5. Zeit und verbleibende Grenzen

Neuer hostgestützter Turn01a15a3c-d4de-7e70-adce-7a32abd246dc: Start20Oct16:54:58UTC, max25Minuten, frühere feste Rootendzeit17:19:54UTC, letzte180s ab17:16:54UTC ausschließlich Abschluss; letzter möglicher60sCheckstart17:15:54UTC. Kein Reset. Alte ACTUAL_TURN/PLAN/18Rawprozessbelege bleiben historische, unveränderte Unterbrechungsbelege; altes Appende UNKNOWN.

Neuer Manifest/Freeze/separater Rückgabecheckpoint liegen unter C. Freeze und Rückgabecheckpoint sind **kein tatsächliches Appende**; Root liest den Hostabschluss nach final/idle. Der Ergebnisbericht wird bytegleich am vorgegebenen E:/DEV/Weltraum-Spiel/TARGET_PC/PMD_NORMAL_CORE_CONTINUE-20261020.md geliefert.

Keine neuen Tests oder Dependencies, kein Benchmark/GFX05Retry, keine M5-/Familien-/Native24-/Rapier-/echtePhysik-/GPU-/Renderer-/Browser-/Saveausführung. Kein Install/UAC/Gitkonfig/Commit/Push/Publication, keine Kinder/Owner/Worktrees. Sourceprüfung ist keine planetweite Produkt-/Defaultaktivierung und keine SDK-Veröffentlichung. Composition, reale Reservoirinventare und Biome bleiben UNKNOWN; reale Welt-/Produkt-/Cross-Device-/Surface-Vertical-Slice-Abnahme bleibt offen. Nach diesem Abschluss final/idle ohne automatische Fortsetzung.
