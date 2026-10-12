# W09 F2: enger unabhängiger Output-Alias-Abschluss

**Spec PASS; Codequalität PASS für den exakt gelesenen F2-Delta.** Die drei echten Sourcegegenfälle sind durch einen minimalen verified-Return geschlossen. Der historische Build155-Test-Typfehler ist durch tatsächliches Fixturefollowup156 und Fullbuild157 geschlossen. Performance bleibt NOT_MET, kein Gesamt-W09-/Browser-/Native-/Gitgate.

Read-only `/root/w00_architecture`, keine eigenen Tests/Builds/Browser/Native/Profiljobs. Historische Berichte unverändert: `fp06-w09-composition-performance-source-review.md` SHA `aaf8e07301cb1f71a63319a2b0e7cb1fce28ca1e71d9dd7ab82cbace0ff47819` und `fp06-w09-composition-admission-closure-review.md` SHA `85ce86e83d4386434c9e388c1e5a11cc99f47744966fb5309dc9e6e051f60431`.

Startread `2026-10-11T23:16:05.926273+00:00`; Integrator-WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, tatsächlicher HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus beweglicher Draft. Source `src/factory/session/dryFactorySlice.ts`: 30936 B / `ddd2ff8cd718be451624bb3e5e709f86a48372a77a1e4899ced57f46e2ea6015`; Test `tests/unit/factory/dryFactorySlice.test.ts`: 35206 B / `c1b65afb114370f0a4fc856e5fe41ace3e6ffe72faba9803643ac516b35d3a65`.

Der Sourcevergleich gegen den bytegenauen 148-Snapshot `94762ca…` enthält **genau eine Runtimezeile**: `commitDryFactoryStep:249` gibt nach vollständiger externer Neuberechnung und Vergleichen nun `checked.state` und `checked.material` zurück. Externe Callerreferenzen werden anschließend nicht erneut gelesen oder publiziert. Der private Deep-Immutable-WeakMap-Shortcut `:240–243` bleibt unverändert; ebenso Native-/W02-Doppelvalidation, vollständige Basis-/Input-/Material-CAS-Bytes, gemeinsame Receipt, vollständige Powerausgabe und Replaygrenzen aus dem vorigen Nachreview. Keine W04-/W08-Vertragslockerung oder neue Autorität.

Die Fachorakel prüfen echte Werte statt Implementierungsschritte (`dryFactorySlice.test.ts:57–73`): mutable Kopie eines gültigen Vorschlags wird tatsächlich Committed; nach Calleränderung bleiben Powerrevision, Materialrevision und reale C10-quantity des Ergebnisses unverändert. Die Materialprobe ersetzt den gesamten weiterhin mutablen Containerroot; der Getter liefert dem Caller separat gehaltene gültige Kopien, deren spätere Revisionsänderung das Ergebnis ebenfalls nicht verändern darf. Native-Snapshot-Methoden bleiben im Fixture erhalten; es wird keine unzulässige komplette JSONserialisierung des Methodenobjekts vorausgesetzt.

OwnRun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z/`: alle gelesenen Rawgzipbytes passen zu Receiptbytes und SHA256.

| Phase | Tatsächliche Einordnung | Raw-SHA256 |
|---|---|---|
| 151 | unzulässiges Full-JSON-Fixture, keine gültige F2-Gesamt-REDphase | `74f484953d19c17c68070fc6a0d6aaff8880222d150664cd7fa1b071cd21ba59` |
| 152 | ein echter State-AssertionFAIL; zwei Material-TypeErrororacles wegen bereits gefrorener Quantity | `35f238c48e1e97b65b745ac59d1b5271f04da515e7d9743c9c4209edacb6ddbd` |
| 153 | **3 echte AssertionFAIL/30 skipped**: Powerrevision1→99; C10quantity96000000→96000001; Getter-Materialrevision0→99 | `10994511c872f3323bafb4a70e8160f8d8b05477edb6b731c21da4f6f1eabc14` |
| 154 | **19 PASS/14 skipped**, 1 Datei, Exit0; Wrapper4,677113 s; Start23:15:27.762921Z→End23:15:32.439662Z | `ad7d42d29defb52d2287e847a71e92927e65f052175078b1864831f135a9f87a` |
| 155 | ursprünglicher Fullbuild **FAIL**, ausschließlich TS7006 in Test63:176, Parameter `s` implizit any | `6e186a84a4293ad42b0e146d244713874881f3be1216bd26366939962ee841ba` |
| 156 | nach reiner Test-Typannotation **3 PASS/30 skipped**, 1 Datei, Exit0; Wrapper1,367129 s | `313e69129b48c36aa5bbf5ac7f98ce9da5858ea2b9e3328d76b21a82fdedfc0d` |
| 157 | ursprünglicher vollständiger **TS/Vite-Build PASS**, Exit0; Wrapper4,510300 s; End23:16:00.406923Z | `3769a4cdcad9439aa05557c3995f9d28fe00b5e3d2c4501c5dec312dc5563c7c` |

154 enthält die F2-Proben und ausgewählte vorhandene gemeinsame Guards; es ist keine gesamte Regression-/Performance-Suite. Das frühere Zwei-Kandidaten-Performanceziel bleibt beim tatsächlichen 134-Timeout5586ms NOT_MET. Kein Folgeperformancejob wird aus diesem Review abgeleitet.

Geschützte Sourcehashes beim Start unverändert: W02 `reservations.ts` `4f5c1d17db3c5167dc42b23e0ab6b0a63f3a9b441684bc5140c367dd7d4d483e`; W04 `productionStep.ts` `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449` und `recipeAdmission.ts` `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102`; W03 `factoryPower.ts` `70ddfe44c9a81c6355262bed928ee4d72b410b4b0db2a6c6bf08a36ec71b2825`; W08 `beltReference.ts` `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211` und `beltPorts.ts` `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9`.

Finale Endbindung `2026-10-11T23:17:08.046754+00:00`: Dryslice `ddd2ff…`, Test `c1b65a…` und sämtliche oben genannten geschützten Sources byteidentisch zum Startread. Der gelesene OwnRun-Snapshot `external-output-alias-closure-157/source.json` bindet dieselben beiden Sourcehashes und die tatsächlichen Phasen151–157. Root meldet Dryslice/Test-HOLD; andere Native-WIP-Dateien liegen außerhalb dieses engen Reviews.

F2 sowie die vorher geprüften konkreten Admission-Gegenfälle sind auf diesen Bytes geschlossen. Kein weiterer F2-Blocker; keine zusätzliche Performancefreigabe oder Paket-PASS-Aussage aus diesem Befund.
