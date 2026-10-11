# W08 — unabhängiges Intake-Nachreview

Reviewer `/root/w00_architecture`, 2026-10-11, ausschließlich read-only Produktprüfung und dieser externe Report. **Spec: PASS. Quality: PASS für den neuen versiegelten reinen W08-Referenzsnapshot.** Kein konkreter Produktfehler im eng erweiterten Intakepfad gefunden. Das ursprüngliche Review und der alte Seal bleiben unverändert; dieses Nachreview prüft nur deren tatsächliche Änderungen. Keine eigenen Tests, Builds, Browserläufe, Produktwrites oder Unteragenten. Gesamtpaket-, Commit- und Evidencegate setzt Root nach abschließender Verpackung.

## Gegenstand und enge Differenz

- Domainbranch `codex/hestia-fp06-domain-2026-10-11`, Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11`, BASE/HEAD `26d5e892c2b401b9011234dabf86955af7462fb8`.
- Neuer Seal `/workspace/.cloud-setup/fp06-w08-product-working-hashes.json`, `sealedAtUtc=2026-10-11T12:25:33.377917+00:00`; Produktpatch `/workspace/.cloud-setup/fp06-w08-product-working.patch`, SHA256 `1ddcf341c9233fb06b3fabde98ba7f2aa9eb919343a126247fe710d4ad3cfecb`.
- Alter Produktpatch im OwnRun `product.diff` hat weiterhin SHA256 `e3267d2fdf593043902ea2e795422bb2423e13cf554d9be9a1fda4b592e2f350`. `product-before-batch-seal.json` und `manifest-before-batch.json` bewahren dessen alte drei Dateihashes. Neuer OwnRun `product-final.diff` ist bytegleich zum neuen Sealpatch.
- Exakt drei staged Produktpfade. Gegen den alten Seal geändert: `beltReference.ts` nur optionales Intakekommando und seine Mengenprüfung; `conveyor.test.ts` nur Helperweitergabe und zwei tatsächliche Fachfälle. `beltPorts.ts` bytegleich. Keine Änderungen an W01/W02/Resources/W03/Host/Native/Save/Dependencies/Timeouts/Queues; kein neuer Source-/Ownerfreeze.

| Produktdatei (unter `apps/weltraum-browser/`) | Neuer SHA256 |
|---|---|
| `src/factory/conveyor/beltReference.ts` | `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211` |
| `src/factory/conveyor/beltPorts.ts` | `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9` |
| `tests/unit/factory/conveyor.test.ts` | `31c9212810bea211f56b9145efa6aef7b926272022e843124afe2bf35b5f7682` |

## Spec und Quality

`beltReference.ts:46–47,190–199` erweitert den **Command**, keinen Packet-/Inventarzustand. Fehlt `quantityUnits`, bleibt der alte Default exakt `min(native Sourcequantity, floor(10kg/Unitmass))`. Ist der Wert vorhanden, akzeptiert `safeWhole` ausschließlich positive sichere Ganzzahlen (`material/quantity.ts:16–18`); kein Clamping oder Runden. Der Wert muss ≤ tatsächlich vorhandenem Sourcebestand sein. Sourcegebundene Itemquantisierung, sichere exakte Mass-/Volumeberechnung und native Definitionsbindung bleiben über `validateFactoryAmount` erhalten (`quantity.ts:28–42`); die resultierende Masse muss ≤10000000 mg sein. Native Splitallowed/Sealed-Grenzen bleiben erhalten. Beispielsweise 8000000 Bulkunits bedeuten aufgrund des bestehenden 1mg-Profils genau 8kg; das Feld bedeutet nicht pauschal kg oder mg für jedes Item.

`beltReference.ts:200,205–218` prüft und bezahlt genau diese berechnete Masse. Die bestehende W02-Transferprepare erhält denselben exakten Wert; W02 ruft weiterhin echten Resourcestransfer mit `allowPartial:false` auf und verlangt `acceptedQuantity === requestedQuantity` (`material/reservations.ts:126–146`). Danach prüft der Belt den tatsächlich entstandenen einzigen Bandchild auf ID und exakt diese Menge. Erst der Prepared-Materialcandidate erzeugt Packetreferenz und Creditdebit; das gemeinsame Commit adoptiert beide oder behält das Originalpaar. Source→Band verbraucht Credit einmal, Delivery keinen zweiten Creditdebit. Kein neuer Quantitycache: `BeltPacket` bleibt unverändert mengenfrei (`beltReference.ts:26–33`), State-/Injectionreceiptprüfung verwendet die tatsächliche native Bandmenge (`:114–130`) und Delivery dieselbe aktuelle native Menge (`:171–175`).

Die neue optionale Commandmenge ist durch die unveränderten vollständigen Inputbytes gebunden (`beltReference.ts:77,161,227–229`). Commit und Replay binden ganze Before-/After-/Material-/Inputfakten und berechnen das Proposal erneut (`:237–255`). Eine nach Prepare geänderte Commandmenge kann deshalb nicht dieselbe Adoption oder einen NoOp erhalten; eine gefälschte kleinere/größere Candidatequantity ebenso wenig. Dies ist Sourceanalyse des echten bestehenden CAS, kein neu ausgeführter zusätzlicher Test. Unpowered oder bereits belegte Linie erzeugt weiterhin keine neue Sourceadmission; das Feld wird erst bei tatsächlich möglicher Sourceadmission ausgewertet und schafft keine zweite Authority.

Der neue echte Intakefall (`conveyor.test.ts:261–277`) verwendet einen nativen 20kg-Parent, targetmaxMass **8kg** und den tatsächlichen frozen B06 `IN-STEEL`-Port mit dessen korrekter Placementpose. Er beobachtet nach 79 bezahlten 100ms-Steps noch kein Packet, nach Step80 Packet bei s=0, Source12kg, Band8kg und Credit0; erst nach weiteren 54 Bewegungen Target8kg, Packetnull und Total20kg. Das belegt pure native Materialadmission und Transport zum 8kg-Cuttercontainer. Es behauptet keine reale W07-Installations-/Footsupportadoption und keinen W04-Produktionsjob. Der zweite Fachfall (`:280–286`) weist 0, negative/fractional/unsafe Integers, >10kg sowie requested8kg bei nativeavailable4kg ab.

Der Default-T034-Test bleibt fachlich unverändert (`conveyor.test.ts:89–111`) und ist Bestandteil des tatsächlich gelaufenen finalen 14er GREEN: nativer20kg-Parent → zwei unterschiedliche native10kg-Transportchildren mit Parent-/Receiptbindung, kein verlorenes oder neues Material. Die zwei Helperänderungen (`:48–62`) reichen die optionale exakte Menge weiter und lassen für bisherige Aufrufe das Feld vollständig weg. Kein Bedarf an zusätzlichem Katalog-, Rezept-, Cargo- oder Ressourcenwrite.

Quality PASS für diese enge Erweiterung: ein optionales vorhandenes Admissionkommando, keine neue Strategieklasse, Queue, Welt, Writerauthority oder separate Menge. Die ursprünglichen Grenzen bezüglich Whole-CAS-Kosten und nicht gemessener Performance bleiben bestehen. Kein Performance-PASS aus Laufdauer oder neuem Intakefeld.

## Tatsächlich gelesene neue Laufbelege

OwnRun: `apps/weltraum-browser/evidence/factory/w08/run-20261011T115409Z`. Alle Laufwerte stammen aus den tatsächlich gelesenen `.log.gz` und `.receipt.json`, nicht aus eigenen Ausführungen.

| Artefakt / tatsächlicher Befehl | Resultat |
|---|---|
| `red-batch-intake`: `npm run test -- tests/unit/factory/conveyor.test.ts -t "explicit 8kg"` | Erster kombinierter Fall: **1 Assertion FAIL/12 skipped**, Exit1, Vitest0.537s/Wrapper0.994s. Fehler ist das ignorierte ungültige Intakekommando; dieser erste Fall erreicht die eigentliche 8kg-Assertion noch nicht. Kein falscher 8kg-RED-Nachweis daraus. |
| `red-batch-intake-2`: `npm run test -- tests/unit/factory/conveyor.test.ts -t "explicit 8kg\|invalid intake"` | Nach fachlicher Trennung **2 Assertion FAIL/12 skipped**, Exit1, Vitest1.45s/Wrapper1.843s. Intakefall erreicht Step80: erwartetes s=0 tatsächlich `undefined`; eigener Negativefall bekommt Prepared statt Rejected. Damit liegt ein wirklicher 8kg-aus20kg-RED vor der kleinen Implementierung vor. |
| `green-batch-intake`: `npm run test -- tests/unit/factory/conveyor.test.ts` | **14 PASS/1 Datei**, Exit0; **Vitest15.02s**, Tests14.65s, **Wrapper15.406s**. Enthält bisherigen Default und beide neuen Intakefälle. |
| `build-batch-intake`: `npm run build` | Tatsächliches `tsc -p tsconfig.json && vite build`, Exit0; Vite1.83s, **Wrapper4.694s**. |

Alle vier neuen Receipts enthalten explizit das tatsächliche CWD `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11/apps/weltraum-browser`; die Log-Runnerpfade stimmen überein. Die neue Suite ersetzt keine erfundene spätere 61er Regression: deren tatsächlicher ältere Lauf bleibt wie im Originalreview benannt, Vorgängermodule unverändert. Browser/W09/W10 und zusätzliche Whole-CAS-Commandmutationstests hier **NOT_RUN**.

## Offene Evidence-/Paketgateitems

**Vorheriger CWD-Restpunkt während Review korrigiert:** Beim ersten Lesen fehlte `cwd` weiterhin in den zwei historischen REDreceipts und deren Manifestprojektion; Root wurde konkret informiert. Der danach ergänzte `receipt-corrections.json`-Addendum bewahrt die Originalreceiptbytes und ergänzt das Domain-App-CWD ausdrücklich als **reconstructed**, mit Herkunft `actual exec_command.workdir` plus tatsächlichem `Vitest RUN`-Pfad. Der abschließende enge Evidencecheck bestätigt beide Originalreceipt-SHA256 und die matching Runnerpfade in den unveränderten historischen Logs. Das aktualisierte `manifest.json.actualCommandReceipts` enthält nun beide CWDs mit `cwdMetadataStatus=reconstructed`, Originaldigest und spezifischer Supplementreferenz; `receiptCorrections` bindet den Addendum. Diese ehrliche nachträgliche Metadatenergänzung ist prüfbar; kein erfundener historischer Rerun und kein Anspruch auf zeitgleich gespeichertes CWD. Root prüft die finale Artefaktbindung im Paketgate.

Beim Lesen bleibt `manifest.json.commitSha=null` und `independentReview` enthält das noch nicht integrierte Followup. Abschließende Reviewbindung, aktuelles Manifest/Hashes, vollständiger Commit-SHA und tatsächlich gebundene Git-/LFSartefakte bleiben Root/Writer-Gatearbeit. Der Report gewährt keinen Commit-/Evidence-PASS und keinen echten Gameplay-/Combinedsave-PASS.

Abschließender produktbezogener Recheck: alle drei Bytehashes und ganzer Patch entsprechen weiterhin exakt dem oben genannten neuen Seal; `product.diff` behält den alten Sealhash und `product-final.diff` den neuen. HEAD bleibt BASE; Gitstatus zeigt genau die drei staged Produktpfade sowie inzwischen ausschließlich paketzugehörige W08-Evidence staged. Die laufende Evidenceverpackung änderte keine Produktbytes. Das eng begrenzte neue Produktreview ist **Spec PASS / Quality PASS**, vorbehaltlich unveränderter Bytes.
