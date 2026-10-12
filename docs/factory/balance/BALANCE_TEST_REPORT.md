# BAL-04 — Tatsächlicher Test- und Evidencebericht

Scope: **READONLY_LIVE_SOURCE_AUDIT + ISOLATED_RATIONAL_MATH**, keine Produktintegration. Actor `/root/balance_audit`, Grant `balance-readonly.json`; Arbeitsergebnis ausschließlich diese vier Markdowndateien und [math-receipt.json](math-receipt.json) im freigegebenen externen Verzeichnis. W09/W10/W11 behalten ihre vorhandenen offenen Gates. Kein Commit/Push/PR/Publish, keine Abhängigkeiten, keine Code-/Recipe-/BOM-/Save-/Golden-/Assetmutation durch diesen Actor.

Bindung des Testreceipts: Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, Branch `codex/hestia-fp06-play-candidate-2026-10-12`, Audit-HEAD `96cced23cd285b57f8a557d01ac9ed8a158c927f` plus separat erfasste vorhandene Drafts. Beobachtungszeit **2026-10-12T08:27:11.663555+00:00**. Quellbytes, Dateimtimes, Versionsdefinitionen, vollständig statisch abgeleitete Recipebytes/Digests und gitStatus stehen im Receipt. Der Integrator committe während des Audits seinen autorisierten Source-Kandidaten: Abschluss-HEAD **`393670fccd4789b562d31b721f15d02457420935`**. Der Abschlussvergleich um **08:43:55.239657Z** bestätigte 14 geschützte Vertrags-/Save-/Goldenpfade bytegleich mit Audit-Snapshot und neuem HEAD. Vor späterer Produktimplementation ist ein erneut passender Source-/Grantcheck erforderlich.

## Ausgeführte Prüfungen

| Prüfung | Tatsächlicher Befehl / Scope | Ergebnis |
| --- | --- | --- |
| Archivintegrität | `sha256sum -c SHA256SUMS.txt` im vollständigen Balance-Handoff; Python subprocess bewahrt stdout, stderr und Returncode | **PASS; Exit 0;15/15Dateien OK** |
| Illustratives Archivmodell | Nach vollständiger Prüfung von `tools/verify_illustrative_balance.py`: `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python tools/verify_illustrative_balance.py` im Archiv. Nur Standardbibliothek/json/Fraction/math; liest Fixture und schreibt keine Produktdatei | **PASS; Exit 0**. Sechs Demo-Massenbilanzen, vier Intermediates, drei Ratiofälle, 9,5 kW / 570.000 J. Keine Game-/Save-/Browserprüfung |
| Eigene exakte Quellenmathematik | `python - <<'PY' … PY` aus `/workspace`; Standardbibliothek-Parser der statisch gelesenen7Recipeblöcke/C01–C28, integer mg und `fractions.Fraction`, unabhängige canonical/FNVRecipeableitung; schreibtnur Mathreceipt | **PASS; Exit 0;18benannte Mathchecks**, zusätzlich7/7exakteRezept-Massenerhaltung und28Cargozeilen. Diese Checks sind keine Vitest-Testzahl |
| Source-/Lock-Snapshot | `git rev-parse HEAD`, `git branch --show-current`, `git status --short`, gezielteRead-only-Dateien, Hashes und mtimes und aktuelleRoot-Control-/Grantreads | **PASS für dokumentiertelokale Snapshot-Erhebung**. Frische Remote-/PR-/externe WriterprüfungNOT_RUN/UNKNOWN |
| Vollständige Referenzlesung | Zwei ausschließlich Read-only-Reader, lückenlose Chunkabdeckung und Originalhashes im Audit; keine Tests oder Writes der Reader | **COMPLETE_READ**, kein Runtime-PASS |
| Ergänzende Proposal-Mathematik | Acht genaue Fraction-Assertions für CUT-S/CUT-M, Chemiebilanz, 9,6-kW-Zusatzlast, Akkuwirkungsgrad, ganze Stützen, Paketzeit und Gangue; kein Produktimport | **PASS; Exit 0** im korrigierten Abschlusslauf |
| Abschlussguard, erster Versuch | Nach acht erfolgreichen Zusatzrechnungen und 14 erfolgreichen Bytevergleichen wurde die Annahme `HEAD == Audit-HEAD` geprüft | **Exit 1 / LIVE_HEAD_ADVANCED**. Die autorisierte Integrator-Änderung traf einen zu strengen Auditguard; kein Produktdefekt, keine Produktmutation, keine Receiptdatei aus diesem Versuch geschrieben. Ursache und Fehlermeldung bleiben im Receipt |
| Korrigierter Abschluss | Audit- und aktuellen Abschluss-HEAD getrennt gebunden; 14 geschützte Pfade mit Snapshot und aktuellem HEAD verglichen | **PASS; Exit 0; 14/14 BYTE_IDENTICAL**. Aktive C1-/Host-/UI-/Sourcepfade bleiben außerhalb dieses Freezeclaims |
| Vollständig reproduzierbare Mathematik | Interpreter `-c sourceProgram`; genaue Argumente und gesamter ausgeführter Pythontext unter `verifiedMathReproduction`, CWD `/workspace`. Liest source-bound Katalog, überprüft 7 Recipes/28 Cargozeilen und ursprüngliche 18 plus 8 Zusatzfälle | **PASS; Exit 0; 26 benannte rationale Checks**. Eigenständiger frischer Reproduktionslauf, keine zusätzlichen Produktprüfungen |

Die Python-Ausführung lief unter `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python`, Version 3.12.14. Der Execpath ist im Receipt als Befehlbindung gespeichert. Beide Archivsubprocesses hatten einen 30-s-Timeout, keiner erreichte ihn. Vollständige Ausgabe und Exitcodes stehen im Receipt; eine Null-Signatur ohne ausgeführte Prüfungen wird nicht als PASS verwendet.

Zur Reproduktion aus den Artefakten: `verifiedMathReproduction.commandArguments` unverändert als subprocess-Argumentliste in seinem dokumentierten CWD verwenden. `sourceProgram` ist vollständig enthalten. Bei später abweichender Katalog-SHA stoppt sein Sourceguard ehrlich; der ursprüngliche Snapshot bleibt historische Evidence. Die kurzen Shell-Heredoc-Angaben oben bezeichnen die ersten Toolruns; die letzte Programmfassung ist vollständig überprüfbar und wurde tatsächlich ausgeführt.

## Die18 eigenen benannten Mathematikprüfungen

| Name im Mathreceipt | Tatsächlich geprüfter Inhalt | Ergebnis |
| --- | --- | --- |
| `current-v1-seven-recipes-mass` | Alle7statisch gelesenenRecipes, vollständigeTermmassen inmg, Input=Output | PASS |
| `current-v1-cargo` | Alle28Cargopositionen,2984,4kg/12,45m³packed ausLivequellen | PASS |
| `W09-brace-total` | 16=5,8+3+5+2,2kg exakt | PASS |
| `W09-process-work` | 2×36.000+2×80.000=232.000J; Band/Hand/Zusatzseparat | PASS |
| `v1-CUT-Former-ratio` | 15gegen45/4kg/min ergibt3:4, 1:1-Überschuss15/4 | PASS |
| `v1-planned-profile-assembly-ratio` | 21/2gegen8kg/min ergibt16:21 | PASS |
| `v1-planned-sheet-assembly-ratio` | 21/2gegen4kg/min ergibt8:21 | PASS |
| `v2-ratios` | ExakteRatenpaare60/60,30/15,15/10,20/30 ergeben1:1,1:2,2:3,3:2 | PASS |
| `v2-metal-mass` | 30=25+5,25=15+10,25=5×5kg | PASS |
| `v2-metal-power` | 1,5+2+2,5+3=9kW, plus20m×25W=.5kW;100Wauxergibt9,6 | PASS |
| `v2-metal-energy` | 9,5kW×60s=570.000J | PASS |
| `v2-unit5-rates` | PrimäreDemo-Raten30,25,5,15,10,60 sindexaktVielfache5 | PASS |
| `v2-halfclock` | 15×1/2=7,5kg/min, keine5erRundung | PASS |
| `ore-element-budget` | 60×.30=30×.54+30×.06, Mineralrecovery90%; keinmetallischesEisen | PASS |
| `band-travel-discrete` | ceil(4000mm/75mm)=54Bewegungsteps=5,4s, Injektionseparat | PASS |
| `band-smallpacket-service` | 5kg×60/5,5s=600/11kg/min<60 trotzKredit60 | PASS |
| `band-v2-batch-policy` | 7,5kg/15s ergibt30kg/min,≤10kgPaket; tatsächlichePort-/LieferprüfungNOT_RUN | PASS |
| `battery-energy` | 12.960.000.000mJ→12.960.000J;14.400.000.000mJ→14.400.000J | PASS |

Zusatzfälle: `optional-cut-S`, `optional-cut-M`, `chemistry-stoichiometric-mass`, `v2-control-aux-energy`, `v2-battery-deficit`, `v2-batch-wholepiece`, `v2-line-packet-space`, `ore-gangue-budget`: **8/8 PASS**; Formeln und Details im Receipt. Der Reproduktionslauf bestätigt die gesamten 26 Fälle. Diese Zahlen dürfen nicht als Vitest- oder Gameplaytestzahl verwendet werden.

Die benannten Checks sind positive Mathematik- und Source-Extraktionschecks. Negative Validatorfälle wie 35 kg Output bei 30 kg Input, forgedCommand/CAS, badunit, staleepoch oder duplizierteReceipt wurden **nicht** als Produktfälle ausgeführt. Die Ableitung der Materialmassen und Raten verwendet extrahierte Quellbytes; ein Runtime-Katalogdigest wurde ohneRuntime **NOT_OBSERVED** gelassen. Statische FNV-Rechnung über ASCII-Recipe-Definitionsbytes ersetzt keine Produktloader-Ausführung.

## Frischer Auszug aus der tatsächlich ausgeführten Archivmath

```text
PASS DEMO-SALVAGE-QUALITY-CUT: 30 = 30 kg/min, 3/2 kW
PASS DEMO-FORM-PROFILES: 15 = 15 kg/min, 2 kW
PASS DEMO-FORM-SHEETS: 10 = 10 kg/min, 5/2 kW
PASS DEMO-ASSEMBLE-BRACES: 25 = 25 kg/min, 3 kW
PASS DEMO-CRUSH-IRON-BEARING-ROCK: 60 = 60 kg/min, 3 kW
PASS DEMO-DRY-ORE-CONCENTRATION: 60 = 60 kg/min, 5 kW
PASS intermediate qualified_steel_halfstock: 25 produced = consumed
PASS intermediate formed_profile: 15 produced = consumed
PASS intermediate formed_sheet: 10 produced = consumed
PASS intermediate crushed_selected_ore: 60 produced = consumed
PASS ratio source 15/min -> consumer 10/min: 2:3
PASS ratio source 30/min -> consumer 15/min: 1:2
PASS ratio source 60/min -> consumer 60/min: 1:1
PASS illustrative metal line: nominal 9.5 kW including 20m belt, 570000 J/60 s
PASS all illustrative arithmetic checks; runtime/save/browser/asset tests NOT_RUN
```

Diese Ausgabe wurde frisch erfasst. Das Archivfile `SMOKE_TEST_EVIDENCE.txt` wurde lediglich als historischer Paketbeleg gelesen und **nicht** als heutiger Toolrun ausgegeben. Auch das neue frische PASS betrifft ausschließlich seinen demonstrativen Mathematikscope.

## Unausgeführte Produktprüfungen

| Prüfscope | Ergebnis / Grund |
| --- | --- |
| `CurrentProductUntouched` | **PASS für BAL-Actor-Schreibgrenze**: keine Produktwrites oder Commits, alle eigenen Writes im freigegebenen BALANCE-Verzeichnis. Kein globalesFrozen-Workspace-Versprechen: autorisierte Integrator-/UI-Arbeit darf parallel Dateien ändern. Separater Read-only-Abschlussvergleich der geschützten Bytes wird imReceipt geführt |
| TypeScript/Vitest/Build | **NOT_RUN**; durch den BAL-Grant ausgeschlossen |
| NormaleBrowserbedienung/Screenshots | **NOT_RUN**; keine Browserprozesse oder TestBridge gestartet |
| Spieler-UI/Sichtbarkeit/Ratioanzeige | **NOT_RUN**; Sourceinspection bestätigt vorhandene Felder, beweist keine geprüfte Bedienbarkeit |
| RuntimeProduction / echteBanddelivery / NativePhysics | **NOT_RUN**; echtePorts, Puffer, Paketfolge, Pausen undOwnerbudget des V2-Modells noch ungeprüft |
| Save/Load/WIP-Migration/Import/CAS/Recovery | **NOT_RUN**; W10 noch durch Abhängigkeiten offen, neuerVersion-/Migrationgrant fehlt |
| Perf/Profile/HW/portableBuild/LFS/Art | **NOT_RUN**; kein CPU-/Browserlease, keine Asset-/Native-/Profiljobs oder Scans |
| Gameplay-/Art-/Terrain-/Hardware-Ownerabnahme | **OWNER_REVIEW_PENDING**, kein Agenten-PASS |
| Frische Remote-/PR-API / externe uncommitted Writer | **NOT_RUN / UNKNOWN**; keine entsprechende callable Connector-API. Historische API-Sperre aus ControlDocs nicht neu getestet |

FP02-/FP06-Archivtesttabellen sind PLANNED, alte W00–W08-Belege historische Scope-PASS. Keine Altbelege wurden zu einemneuenW09/W10/W11-Gesamt-PASS addiert. Die von Root beobachteten partiellen Schwerroute-/Idle-/Compositionbefunde bleiben eigene PLAY-Evidence, kein BAL-Toolrun.

## Lieferstatus BAL-00 bis BAL-04

| Schritt | Ergebnis |
| --- | --- |
| BAL-00 | Read-only-Istinventar, Versions-, SHA-, Quellen- und Ratioaudit COMPLETE |
| BAL-01 | Inaktive Vier-Maschinen-V2-Kette mit exakter Masse, Power, Batch, Energie, Band und separatem späteren Erzfall PROPOSED |
| BAL-02 | ReadModel-/Nenn-/Ist-/Blocker-/Ratio-UI-Konzept PROPOSED; Implementierung und Bedienprüfung NOT_RUN |
| BAL-03 | A als Default, B als späterer expliziter Migrationspfad; pinnedJobs/Receipts/freshlineage/CAS-/Recoverymatrix PROPOSED |
| BAL-04 | Vier externe Reviewdokumente plus Mathreceipt erstellt; positive Mathematik PASS, produktive Gates ehrlich NOT_RUN |

W09-Rezeptwerte,16-kg-Abnahme,5,8-kg-Stütze,C01–C28,Akku-/Band-/BOM-/Save-/Goldenverträge wurden durch BAL nicht geändert. Nach einem späteren Ownergrant wären versionsfähige Registry, neue Definitionen, native BOM/Ports, Combined-Save-/Compatibilitytests und normale Browserabnahme erforderlich. Die Dokumente sind ein Reviewhandoff; Rootimport, unabhängiges Review und aktive Contententscheidung bleiben getrennte Schritte.

## Abschließendes unabhängiges Artefaktreview

`/root/balance_audit/fp02_reference_readonly` las alle vier Dokumente vollständig und prüfte das ursprüngliche Receipt. Im ersten Review fand der Reader keine blockierende fachliche oder mathematische Unstimmigkeit; drei Nachweisformulierungen wurden präzisiert. Der anschließende ausschließlich lesende Folgecheck bestätigte die ergänzten Receiptfelder und die korrigierte Prosa: **PASS, keine verbleibende blockierende Dokumentationsabweichung**. Der Reviewer führte keine Mathematik-, Produkt- oder Runtimebefehle aus und schrieb keine Dateien. Dieses Artefaktreview ist keine Owner- oder Gameplayabnahme.
