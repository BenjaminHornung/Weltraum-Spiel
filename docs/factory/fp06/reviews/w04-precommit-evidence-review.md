# W04 — unabhängige PRECOMMIT-Evidence-/Gitprüfung

2026-10-11, Reviewer `/root/w11_evidence`, ausschließlich read-only Git-/Datei-/gzip-/JSONinspektion. Keine Tests, Builds, Browser, Native-/Renderjobs, Repoänderungen, Stage, Commit oder LFS-Reparatur.

**PRECOMMIT_SCOPE_SEAL_EVIDENCE: PASS.** **Git/LFS-Stage-/Commitadmission: PENDING**, kein neuer Commit vorhanden. Dieses Urteil bindet die tatsächlichen Arbeitsdateien und verfügbaren Ausführungsreceipts; es ist weder ein neuer Spec-/Codequalitätstest noch eine HEAD-Bindung.

## Tatsächlicher Stand und Scope

WT `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11`, Branch `codex/hestia-fp06-domain-2026-10-11`. Tatsächlicher HEAD gleich BASE **`1f2c568ec9db7b6b2895eb2a3b4f37797030dac8`**. Alle **44** Kandidatenpfade sind noch **untracked**, Index und tracked HEADdiff sind leer. Kein Clean-Worktree- oder staged-Diff-PASS behauptet.

Eigenes `git ls-files --others --exclude-standard`/`git diff --name-only HEAD` liefert exakt **3 Produktdateien +41 Dateien** unter `apps/weltraum-browser/evidence/factory/w04/run-20261011T124704Z/`; keine fehlenden/zusätzlichen Pfade. Die3 Produkte entsprechen dem tatsächlichen `w04-grant.json`. Alle44 tatsächlichen Pfade, Größen und SHA256 sind im unabhängigen JSONbericht enthalten.

| Produkt unter `apps/weltraum-browser/` | Bytes | Tatsächlich SHA256 = Seal |
|---|---:|---|
| `src/factory/production/productionStep.ts` |29154|`f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449`|
| `src/factory/production/recipeAdmission.ts` |12898|`c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102`|
| `tests/unit/factory/production.test.ts` |23542|`7c31bf5f375af31c3ed0057cda4ce2a87951fff7412506fcab057c0d517769b6`|

Produktseal tatsächlich SHA256 **`01bd38888e4dc808c1d1acfc921f5e7a44ccdd36e39b498c8ebee7879f4266d0`**. Unabhängig aus3 aktuellen neuen Dateien mittels `git diff --no-index --binary -- /dev/null <path>` rekonstruierter Patch ist byteidentisch zum externen Sealpatch und ownRun `product-diff.patch`: **`2cd262226ac36464316b18f6cdf4f70c18ff78c5d92fdcde9cdd8a57059b47ed`**,67259Bytes.

Unabhängige `git diff --no-index --check -- /dev/null <product>` für alle3 Produkte: jeweils Exit1 mit **leerem stdout/stderr**, also normale Newfile-Differenz ohne Whitespacefehler. Kein ersatzweise als Exit0 ausgegebener stagedCheck.

## Tatsächliche Evidenceintegrität

Manifest-SHA256 **`7654cb46edef96a71211555c7b6d71a530664634a6e5d150d31ede42b5dbe621`**, **40/40** eindeutige Referenzen vorhanden, tatsächliche SHA-/Bytegrößen passend. Sie decken exakt die41 eigenen Rundateien außer dem selbstreferenzfreien `manifest.json` ab. Produkt-SHA/Bytes im Manifest passen zu allen3 Arbeitsdateien.14Originalreceipts und deren Manifestprojektionen stimmen bei allen gemeinsamen Originalfeldern überein; deklarierte Vitestresultate stehen tatsächlich in den entpackten Logs.

**14/14** `.log.raw.gz`: tatsächliches Entpacken erfolgreich, CRC/ISIZE korrekt, gzip-SHA/Bytes passend zum jeweiligen Originalreceipt und Manifest; entpackte tatsächliche Bytes stimmen exakt mit dessen **zeitnah gespeicherten precompression rawSHA/rawBytes**. Damit ist die verfügbare lossless Rawbindung konkret bestätigt. Keine Lognormalisierung oder Rekonstruktion alter stdoutbytes. Die12 Vitestlogs zeigen den aufgezeichneten Domain-CWD; die2 Buildlogs enthalten keinen eigenen RUN/CWD-Banner und sind dafür an ihr Original-CWDreceipt gebunden.

**4/4** V8profile parsebar, tatsächliche SHA/Bytes passend zu Manifest und Profileanalyse; samples/timeDeltas cardinality stimmt. Beide vorhandenen Analysen unabhängig aus Originalsamples und gewichteten timeDeltas nachgerechnet: erster Worker **9275310/11168093µs=83,05%**, zweiter Worker **7556503/10471098µs=72,17%** inclusive canonicalSerialization. Parentprofile jeweils0%; alle7 zweiten inclusive Kategorien stimmen ebenfalls. Überschneidende Kategorien werden nicht addiert; das sind zwei historische Timeoutdiagnosen, keine W11-/FPS-/Geräteperformancebehauptung.

## RED-/GREEN-/Buildbindung

| Tatsächliches Originalreceipt | Tatsächliches Ergebnis |
|---|---|
| `red-initial` |7 gesammelte AssertionFAIL, Exit1; Prepared-Admissional assertions stoppen die nachfolgenden Rezeptprüfungen. Keine Import-/Setupfehler als BusinessRED verkauft.|
| `green-attempt-1`, `green-byte-cache-original-seven`, `green-authority-core-fifteen` |Je4 historische TimeoutFAIL; die Originalfehlversuche bleiben FAIL.|
| `red-safety-five`, `red-noop-four`, `red-closed-keys` |5/4/1 echte gesammelte AssertionFAIL, jeweilige Skipzahlen erhalten.|
| `green-canonical-segments-fifteen` |15PASS, später durch16-Fälle-Suite erweitert.|
| `green-final-affected` |**175PASS/13 Dateien**, Vitest34,74s, Wrapper35,127s, Exit0; Step-SHA**`4fb7d6388ec2c6312beb4f0a31142184de29aefb6a44d39fc416de4493598ecb`**,29119Bytes.|
| `build-final` |Echter TS18048-BuildFAIL am selben vorherigen Stepstand, Exit1/2,779s.|
| `green-type-narrowing` |**4PASS/12Skip**, Vitest2,95s, Wrapper3,331s, Exit0; alle3 **finalen** Produkt-SHA/Bytes exakt gebunden.|
| `build-final-type-fixed` |Vollständiges tsc+VitePASS, Exit0/4,338s, Vite1,72s; alle3 **finalen** Produkt-SHA/Bytes exakt gebunden.|

Zusätzlich unabhängig bytegenau geprüft: Entfernung der einen finalen Zeile `const commandId = command.commandId;` und Rücksetzung des unmittelbar folgenden Callbackzugriffs `commandId`→`command.commandId` rekonstruiert exakt die29119Bytes/SHA des tatsächlichen175er-Receipts. Damit ist die einzige spätere Quelländerung konkret belegt. **Kein frischer175er-PASS auf den finalen29154Bytes behauptet.** Die finale4er-Ausführung und der vollständige finale Build binden diese letzte Captureänderung; die übrigen zwei Produktdateien blieben gegenüber dem175er unverändert.

## Noch ausstehende LFS-/Commitbindung und Grenzen

Tatsächliches `git check-attr filter` identifiziert **14 LFS-pflichtige gzip-Pfade**,14eindeutige PayloadSHA. Ihre Originalpayloads sind vorhanden und wie oben geprüft. Im gemeinsamen `.git/lfs/objects` sind bei dieser **noch vollständig untracked** Aufnahme jedoch **0/14** entsprechende Objekte angelegt; es gibt noch keine indexierten/committeten W04-LFSpointer. Das ist **ausstehendes normales Packaging**, kein behaupteter beschädigter eigener LFSbestand. Keine `git lfs clean/add/fetch/fsck`-Operation oder Repositoryänderung durch den Reviewer. Die4 `.cpuprofile` sind laut bestehender Attributes gewöhnliche Gitdateien, kein erfundener zusätzlicher LFSscope.

Nach autorisiertem Stage/Commit benötigt der tatsächliche neue HEAD eine getrennte enge Prüfung: exact44Änderungspfade, unveränderte3Produktbytes,40Manifestpayloads aus normalem Gitblob bzw.14LFSpointern, echte lokale14Object-SHA/Bytes, Commitparent und clean/diffcheck. **Hier kein Commit-/LFSgesamtPASS.** Spec/Quality bleibt Root/separatem fachlichem Reviewer vorbehalten. Pure synthetische Host-/Power-/Productiontests belegen weder Live-Worldadoption/W09-Normalflow noch Combinedsave/W10 oder W11-Browser-/Gameplay-/Art-/Performanceprüfung.

## Berichtbindung

- Writer `/workspace/.cloud-setup/fp06-task-briefs/w04-report.md`: SHA256`76b2915eff8b8a1aaff5036f49fcbe225f0840763a58688e99917c9934769d18`.
- Writer `.json`: SHA256`ddfb82eb0c8c4a3925ee6d96aaebf8b42a4b0531c5ef799222a39077ef64d291`.
- Unabhängige tatsächliche44Pfadhashes,14Rawreceipts/LFSstatus,4Profile/2Analysen,Scope/Patch/Capturecheck: `/workspace/.cloud-setup/fp06-w04-precommit-evidence-review.json`, SHA256**`e9771737cf00d25db800836121ef598e98951c21b7ee2727caed06743ecf6f88`**.

Werkzeuge: `functions.exec`→`tools.exec_command`, kleine read-only Python-stdlib-/Gitabfragen; größter Inspektionsaufruf0,051s Toolwall, Profilanalyse0,043s. Historische Tests/Builds wurden ausschließlich gelesen, nicht erneut ausgeführt. Eigene Writes nur diese zwei externen Reviewdateien.

Root delivery copy: only Markdown trailing spaces/final blank lines normalized. Independent original SHA256 `517f90f81f31e2cba47c4782f236bfff1566944cba5be649beee606bedbd527e`, 7928 bytes; original remains `/workspace/.cloud-setup/fp06-w04-precommit-evidence-review.md`. Scope, evidence and verdict unchanged.
