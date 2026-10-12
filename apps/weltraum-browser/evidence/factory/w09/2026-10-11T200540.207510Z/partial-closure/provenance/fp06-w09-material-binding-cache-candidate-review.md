# W09 exakte Materialbindung: unabhängiger Review des einen v2-Kandidaten

**Spec PASS; Codequalität PASS für den eng gelesenen Cache-Delta. Performance FAIL / NOT_MET.** 160 enthält weiterhin einen echten Timeout5355ms bei originalen5000ms; der v2-Runtimekandidat ist ausgeschöpft. Kein Gesamt-W09-/Native-/Browser-/Gitgate, keine neue Performanceiteration.

Read-only Reviewer `/root/w00_architecture`. Keine eigenen Tests, Builds, Native-, Browser- oder Profiljobs. Geprüft wurden bestehende Sources, Snapshotdiffs, Szenariobytes und Rawgzip-/Commandreceipts. Historische F2-Abschlussbewertung bleibt gültig; ihre fehlerhafte Methoden-Erklärung zu Fixture151 wird ausschließlich im getrennten Sidecar `fp06-w09-output-alias-151-provenance-correction.md`, SHA `f5bb25ddbdbbc0fa57f4dd890796b773487dff2d97731290e67bb563043371b6`, korrigiert. Keine historischen Rawbytes umgeschrieben.

## Source- und Grantbindung

Integrator-WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, tatsächlicher HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus W09-Draft. Startread `2026-10-11T23:21:52.784752+00:00`: `src/factory/session/dryFactorySlice.ts` 31347 B / `2122581f9075c53db0441002b650d6a6c2cb9eddd0c858f1b0078d58c3746a4a`; Test 36398 B / `5755aa42645b19aa762d1e75436d9346a2cb8639f0ec940184c07921e5fcbdec`.

Der gelesene OwnRun `material-binding-cache-v2-before/` bindet den Vorgänger Dryslice30936B/`ddd2ff8…` und Test35206B/`c1b65a…`. Aktivierung `23:18:08.497279Z` folgt tatsächlich den geschlossenen144–147-/153-Gegenfällen,154/156 und157Fullbuild. Der v2-Goal begrenzt **einen Runtimekandidaten, null zusätzliche CPUprofile**, dieselben beiden Fachfälle/original5000ms und nur Dryslice plus Countertests. Der vorherige Zwei-Kandidaten-Goal bleibt unverändert NOT_MET.

Der Runtime-Diff zum gebundenen Vorgänger enthält ausschließlich den Importalias und die lokale WeakMapfunktion `dryFactorySlice.ts:66–73`. `factoryMaterialBytes(material)` speichert weiterhin **exakt die Ausgabe der geschützten ursprünglichen Funktion**, keine Digest-/Hashersetzung, keine Mengen-/Tick-/Receipt-Neuberechnung und keine Authority. Auf einem Coldmiss müssen zuerst `validateDryMaterial:55–65` mit tatsächlicher W04-Katalog-/Native-Snapshot-Prüfung sowie bestehender W02-Receipt-/Reservation-/Kapazitätsprüfung erfolgreich sein. Der hypothetische leere Transfer samt Receipt wird nicht adoptiert. Erst danach und nur für streng lokal geprüfte tief unveränderliche Plain-Data-Identität entsteht ein Cacheeintrag. Fehler werfen vor dem Set; mutable/getter-/exotische/neue Cloneidentitäten durchlaufen den Originalpfad. Warmlookup ist deshalb an dieselbe bereits geprüfte unveränderliche Gesamtmaterialidentität gebunden; neue Revisions-/Bestands-/Receiptobjekte können den alten Eintrag nicht übernehmen.

Alle zuvor geschlossenen gemeinsamen Commit-/Replay-/Powerbody-/WIP-/Outputalias-Grenzen bleiben Source-byteinhaltlich unverändert. Insbesondere liefert der externe Commit weiter frisch `checked.state`/`checked.material`; private Preparedidentitäten bleiben deepimmutable und vollständig an frische Basis-/Input-/Materialbytes gebunden. Keine zweite Inventar-/Worldautorität, kein Source-/Port-/Clock-/Budgetwechsel.

## Gleiches tatsächliches Fachszenario

Der gespeicherte Szenarioblock `unchanged-scenario.ts` ist6563B / SHA `ce1fb626500b8b05fcbd255f574f4a0597d1ebd864dab82d74a98dbd64951cd1` und wurde unabhängig **byteidentisch als zusammenhängender Block im aktuellen Testsource gefunden**. Außerhalb davon zeigt der Testdiff nur den unabhängigen Originalbytesimport und den neuen Cold-/Warm-/Cloneguard; keine Änderungen vorhandener bezahlter Fixtures. Die originale Blackout-/Graph-/Custodyprobe bleibt unverändert, ebenso die zweite Probe mit55Schritten plus weiteremHold plus tatsächlicherReceiverfreigabe, insgesamt57adoptierten Übergängen. Keine Assert-, Loop-, Stock-, Queue- oder Timeoutreduktion.

## Tatsächliche Evidence

OwnRun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z/`; alle genannten Rawbytecounts/SHA256 unabhängig bestätigt.

| Phase | Tatsächlich | Wrapper / Raw-SHA256 |
|---|---|---|
| 160 | 1 PASS/1 Timeout/31 skipped; Outputcase5355ms bei5000ms, Exit1 | 9,152665s / `807c8a726a9ab47f5aa622578d4ec7ea339c62a572bb4731fcc2d1fe6044db9c` |
| 161 | 19 PASS/1 Fixture-TypeError/14 skipped: nach Prepared ist Clone bereits gefroren, direktes Rootassignment unzulässig; **kein Runtime-Cachebug nachgewiesen** | 5,101401s / `71105933a44e5788d981959bb5bed1e1d1ffb37ae689f260e1bdf4001b7fb78f` |
| 162 | echte Material-/Conveyor-/Production-Regressionsdateien,45 PASS | 29,611218s / `b36c12a183443036b588cc0de3462fe22e569835f8f373fa1b37ec3a7ebf478f` |
| 163 | ursprünglicher vollständiger TS/Vite-Build PASS | 4,092539s / `cb754cf4531f1d4b21581376b817a205b633c229048478dba4e2b43e0b72d03d` |
| 164 | nach reiner Testfixturekorrektur20 PASS/14 skipped; unveränderter Runtimesource | 4,894942s / `1acbc6e502433e24a2433034ca74665a8fbfa49334780791bfb70e77852dae8e` |
| 165 | ursprünglicher vollständiger TS/Vite-Build PASS | 4,322501s / `d43ecf620533f52431a772f50cdb5cb31be4d1afd56bad6a532468a5432d1e3f` |

Der tatsächliche neue Test (`dryFactorySlice.test.ts:41–48`) vergleicht Cold-/Warmmaterialbytes mit der **geschützten Originalfunktion**; überprüft identische Inputbytes, einen gültigen getrennten Clone, anschließend eine neue mutable Kopie mit realer C10quantity+1 bei kopierten Receipts und danach unverändert gültige Originalbytes. Bereits vorhandene echte negative Orakel zu Quantity/Input/Output, Receiptchain/Claims, Power-/gemeinsamer Receipt, Prototyp/Zyklus/Sparse/Symbol/Nichtendlich, eigenen Arraymethoden, Gettern und Calleroutputalias bleiben enthalten.161 wird als fehlerhafte Mutation eines gefrorenen Testfixtures bewahrt;164 ist deren ehrlicher GREEN, kein erfundenes Fach-RED vor dem Cache.

Endread `2026-10-11T23:23:12.382604+00:00`: Runtime weiterhin `2122581…`; Test nach legitimer Fixture-/Typkorrektur36419B / `e83081b79cd68180974f679000945dec0ea4c2c5642cbd4a83d810be7a043a8b`. Kein neuer Runtimekandidat oder Profillauf beobachtet. Geschützte Startbytes: W02 `reservations.ts` `4f5c1d17db3c5167dc42b23e0ab6b0a63f3a9b441684bc5140c367dd7d4d483e`; W04 `productionStep.ts` `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449` und `recipeAdmission.ts` `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102`; W03 `factoryPower.ts` `70ddfe44c9a81c6355262bed928ee4d72b410b4b0db2a6c6bf08a36ec71b2825`; W08 `beltReference.ts` `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211`, `beltPorts.ts` `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9`.

Kein belegter Cache-Vertragsblocker in diesem Delta. **5355ms bleibt NOT_MET**; eine unverfälschte Vergleichsbaseline nach allen Admissionguard-Ergänzungen wurde nicht gemessen. Daher keine Gewinnprozent-, Hardware-, FPS- oder Browserperformancebehauptung aus dem Unterschied zu historischen Phasen.

Finale erneute Bindung `2026-10-11T23:24:31.823106+00:00`: `2122581…`/`e83081…` und alle oben genannten geschützten W02/W03/W04/W08-Sources unverändert. Das gelesene `material-binding-cache-v2-after/outcome.json` bindet exakt diese beiden finalen Sourcehashes, denselben6563B-Szenariohash sowie160NOT_MET/161FixtureFAIL/16420PASS/16245PASS/163+165BuildPASS. Andere mutable Native-/Hostseams werden hier nicht als überprüft oder abgeschlossen dargestellt.
