# GFX0102 current-contract private source result — 2026-10-20

Status: **PRIVATE_CURRENT_CONTRACT_SOURCE_PENDING_ROOT_REVIEW**. Der neue private V2-Kandidat übernimmt die zwei bereits im aktuellen normalen Core vorhandenen Korrekturen. Fehlendes verwaltetes Dekor meldet effectsQuality/decorDensity als Unsupported. Vom Port übersprungene angeforderte Änderungen melden gespeichert; sämtliche Portwarnungen bleiben zusätzlich erhalten.

Identität tatsächlich gelesen: derselbe bestehende Hestia A0, App `01a13648-c55b-7250-bf07-34921d70b43b`, Root-gebundenes Paseo `58fc7970-b84f-485d-8cd0-e577205823e9`. Bestehender CIFI-Worktree, Branch `feature/hestia-a0-benni-pc-2026-10-13`, HEAD `6ac0f61947c5a6aa3e5b156831542d8188c75c0a`. Keine Kinder, neuen Owner oder Worktrees.

Private Mappe P: `C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-gfx0102-current-contract-r01`.

Auftrag: `E:/DEV/Weltraum-Spiel/TARGET_PC/GFX0102_CURRENT_CONTRACT_TASK-20261020.md`, SHA256 `4bffb7f7f9fa9829276dac9126c3e7f3e067178ff0a8094728b51a1ad7224711`; Inputs SHA256 `1cb8482321378435c827174dd9258e5c60d11f0f56e6ade8c63f758dac027072`; Decision JSON SHA256 `896d8d77284db470045786151d3e02d250ebda2da022f78bd78dc5b4dba60f11`. Bestehende Root-Entscheidung und unabhängiger READY_SOURCE_ONLY-Planreview, keine neue fachliche Entscheidung.

1. Genau sechs der 36 gehashten Kopien geändert: candidate `types.ts`, `capabilities.ts`, `graphicsSettings.ts`, bestehende `tests/settings-v2-contracts.test.ts`, `tests/review-regressions.test.ts` und `ui/main.ts`. Die drei vorhandenen Probe-Caller erhalten explizite Dekorwerte; der positive Test-Caller ist typisiert. Kein V1-Dateiüberkopieren, keine Schema-/Default-/Packageänderung. Alle 23 V2-IDs, Migration, FutureVersion-/Rohbytes-/Speicherfehlerschutz, Backend-unavailable, Snapshot-Aktualisierung und Restartbehandlung bleiben erhalten. Der vollständig gelesene Before/After-Diff ist `P/EXACT_SIX_FILES.diff`.

2. Tatsächlicher RED gegen alle zehn unveränderten alten kopierten Produktmodule: zwei relevante Assertionfehler, keine Import-/Collection-/Typfehler. Erwartet Unsupported, tatsächlich SupportedLive; erwartet saved, tatsächlich Graphics settings applied. Exit1 wurde ausdrücklich erwartet. Rohdaten `P/evidence/RED_RESULTS.json` und `GFX0102_RED_R01.json` bleiben erhalten. Das vorhandene Capability-Szenario wurde erweitert und genau ein wertvoller Apply-Fall ergänzt: angeforderte ID, persistierter/confirmter Wert, skipped ohne Warnungen und anschließender Erhalt beider Portwarnungen. Nach RED kamen nur der Typeimport und die Probe-Typannotation im Test hinzu; die Assertions blieben gleich. Kein separat vor RED erfasster Testdatei-Hash wird behauptet.

3. Ein vollständiger GREEN-Lauf aller zehn vorhandenen CPU-Testmodule am neuen Stand: **75/75 PASS, 0 FAIL, 0 SKIP**. Originaler strikter Produktions-noEmit mit RT08 TypeScript5.9.3: **Exit0, stdout/stderr leer**, einschließlich UI-Caller. 14 Produktionsroots, 24 lokale TS-Dateien im statischen Produktionsabschluss, keine Tests/Vitest darin. Testimportabschluss: 34 gebundene Mitglieder, 92 Kanten, keine fremden Imports, dynamischen Imports oder Hooks. Die WebGL-/WebGPU-Probetests verwenden ausschließlich eigene lokale Objektports. UI wurde nur vom Compiler gelesen.

4. Preservation vorher/nachher PASS: 30 unveränderte Kopien einschließlich aller 14 historischen Control-Dateien; alle 36 Originalquellen, 93 vorhandenen alten Sealmitglieder, zwölf normalen Schutzpfade einschließlich PMD7 und sieben Supportpins unverändert. Historische Controls bleiben historische Controls; keine Parität mit heutigem Core behauptet. Node22.23.2 unverändert; M5 vollständige1212-Dateien-Digest `6c0ffa1239efd3a27ef2dac356cc9a7dfcf52062b09a50a4f219031e941daf46`, sieben Entrypoints geprüft. RT08 vollständige2756 Manifestpins einschließlich2751 Moduldateien unverändert. Manifest-SHA `48e3a18ce57cbac7aee620fd5a9ff3d36ffd645a4449f87169400bd414d014d3`; Qualification-SHA `2bcbd2a087932887635ac40e668e9059ad1bff5e1bb337a2f71903449a0e619d`. Keine Versionabfrage, Installation oder Tooländerung. Details `P/evidence/PRESERVATION_AFTER.json` und `FINAL_BINDINGS_AND_REVIEW.json`.

5. Alle drei Prozesse liefen über die unveränderte3295B-Run-Check-Kopie, SHA `e5d5f7ee00e7a6d3b7f14d240c5ff133c44e4230b87a99a3a543efdc8a8f6abe`, qualifizierter Node als Exe, CWD/Temp/Cache/Reports unter P. RED910ms, GREEN3199ms, Typecheck805ms; jeweils terminal, beide Streams EOF, SafeHandle geschlossen, kein Lifecyclefehler. Keine Wiederholung eines fehlgeschlagenen Toolversuchs. Private Manifest/Freeze und separater RETURN_CHECKPOINT binden den Abschluss ohne Selbsthashzyklus. Root muss das tatsächliche Appende nach final separat lesen.

Ausgeführte CheckArgs, jeweils unter P mit qualifiziertem Node und unverändertem Run-Check:

```text
<M5>/node_modules/vitest/vitest.mjs run --config <P>/vitest.pure.config.mjs --configLoader native --outputFile <P>/evidence/RED_RESULTS.json tests/settings-v2-contracts.test.ts -t "reports truthful planned|reports requested skipped"
  Run-Check: Label=GFX0102_RED_R01 ExpectedExit=1
<M5>/node_modules/vitest/vitest.mjs run --config <P>/vitest.pure.config.mjs --configLoader native --outputFile <P>/evidence/GREEN_RESULTS.json
  Run-Check: Label=GFX0102_GREEN_R01 ExpectedExit=0
<RT08>/node_modules/typescript/lib/tsc.js -p tsconfig.json --noEmit
  Run-Check: Label=GFX0102_TYPECHECK_R01 ExpectedExit=0
```

M5=`C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/m5-toolchain`; RT08=`C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/rt08-build-toolchain`; Node=`C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-other-pc-restored/Tooling/PortableNode/node.exe`, SHA `0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4`.

Tatsächlicher Appturn `01a15a61-379d-78f1-ac35-183950a348a0`, Hoststart `2026-10-20T17:34:43Z` /1792517683. Früheres bindendes Rootende `2026-10-20T17:54:35Z` einschließlich Appabschluss; Closure-only ab17:51:35Z, letzter60s-Prüfstart17:50:35Z. Kein Fristreset. Freeze-/Rückgabezeit ist ausdrücklich kein tatsächlich beobachtetes Appende.

Inspektionshinweise: Die erste Dokumentlese suchte irrtümlich DECISION.md; vor Effekten wurde die tatsächliche DECISION.json gelesen und gepinnt. Der erste statische Scan meldete lokale Variablen namens window in frameWindow.test.ts und quality.test.ts; ihre tatsächlichen Deklarationen/Verwendungen sind lokal, kein Browserglobal. Die erste Meldung ist im Importabschluss protokolliert. Kein Produkt-/Toolprozess scheiterte unerwartet.

**HOLD bleibt:** Alle sechs alten .devtoolbox-Sealmitglieder fehlen weiterhin; weder rekonstruiert noch ersetzt. Vollständige Originalpaketannahme und ursprüngliches repro.mjs sind NICHT belegt. Dieser neue36-Dateien-Sourcegegenstand ersetzt weder Original74 noch komplette GFX-/Produktabnahme. Normale A0-Quellen bleiben unverändert bei SchemaV1, kein automatischer V2-Intake.

**NOT_RUN:** echte UI-/Maus-/Tastatur-/Viewportabnahme, Browser, GPU, Renderer-/Spielruntime, Physik/M5-Familie/Native24, WASM, Savegame, Benchmark und Referenzläufe. Keine neue Liveauthority, keine Gitänderung, Commit/Push/Publikation. Nach final idle, keine automatische Fortsetzung. Nächster Schritt für Root: diesen gebundenen Sourcegegenstand und den tatsächlichen Appabschluss prüfen.
