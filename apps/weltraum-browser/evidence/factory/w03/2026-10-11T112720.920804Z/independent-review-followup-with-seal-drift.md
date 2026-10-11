# W03 enges unabhängiges Folgereview R1/R2

SPEC_COMPLIANCE: **PASS** für den tatsächlich versiegelten technischen W03-Produktkandidaten. CODE_QUALITY / CONTRACT_QUALITY: **PASS**. Beide Findings des ersten Reviews sind geschlossen; im engen Folgediff wurden keine weiteren konkreten Vertragsfehler gefunden.

Finaler Candidate-, Commit-, vollständiger Manifest- und Git/LFS-Checkoutbind: **PENDING**, getrennt von diesem technischen Produkturteil. Die drei Runtimefiles passen unverändert; der verpflichtende Enddigest zeigte eine während WRITE HOLD veränderte Testdatei (Details unten). W03 ist noch nicht committed; dieser Bericht erklärt keine zukünftigen Integrations-, Save-, Wetter-, Performance- oder Gameplaygates für bestanden.

## Exakter Kandidat

Actor `/root/fp06_integrator`; Branch `codex/hestia-fp06-integrator-2026-10-11`; Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`; tatsächlich erneut gelesener HEAD/Implementierungsparent `2c044e02f1f31a2db3de3a0df9156bd71a431a7a`.

Neuer WRITE-HOLD-Snapshot `2026-10-11T11:52:23.905114+00:00`, extern `/workspace/.cloud-setup/fp06-w03-product-working-hashes.json`. Voller neuer Vierproduktpatch SHA256 **`ca7696aa788f31a345b741e3d146db439bfac4f16497f806e913a25abe071d57`**. Snapshot nennt originalen Grantbase `5b596f932dc769052e17603965d0179a4937d948` und ausdrücklich tatsächlichen Implementierungsparent2c044; der zwischenliegende W06-Packagingcommit ist kein zusätzlicher Produktwrite.

| Produkt | SHA256 | Bytes |
|---|---|---:|
| `apps/weltraum-browser/src/factory/power/factoryPower.ts` | `70ddfe44c9a81c6355262bed928ee4d72b410b4b0db2a6c6bf08a36ec71b2825` | 19844 |
| `apps/weltraum-browser/src/factory/power/sourceAdapter.ts` | `3c4886c67b79475783f287e93edcb8412db5a26f1156624c70283416fbeb5d9b` | 8655 |
| `apps/weltraum-browser/src/factory/power/powerReadView.ts` | `0921116600c4a50ba0b6bdcf8f46a2368d9d3ac0717e9cfcb6cd564d298d727a` | 1752 |
| `apps/weltraum-browser/tests/unit/factory/power.test.ts` | `0faaeb66822c254b39d2fb8737ef30cc7a2a704c11efe041b3e6e79f46c0d999` | 24073 |

Alle vier tatsächlichen Produktbytes wurden unabhängig gegen Größe/SHA256 zu Beginn geprüft und waren zu Beginn passend. Der abschließende erneute Vergleich zeigte jedoch `power.test.ts` verändert: SHA256 `91b8e559baed841a66e830532b8ec78192471912d26fa6c885c7eadf6a5bc13c`,24386Bytes statt des Übergabeseals0faaeb/24073Bytes. Externer Snapshot/Patch blieben dabei unverändert; alle drei Runtimefiles passen weiterhin. Deshalb ist der End-Candidatebind ausdrücklich PENDING und braucht einen neuen zutreffenden Seal. Dieses Drift wurde dem Root sofort gemeldet; es wird nicht als passende versiegelte Enddatei ausgegeben.

Alter Snapshot/Vollpatch sind weiterhin in `before-independent-product-final-hashes.json` und `before-independent-product-final.patch.raw.gz` vorhanden; dessen entpackter SHA256 ist unverändert `0f3cbd17027f4af38044fa984d47f2660736c534f7d0ca81e14743ac9e029e9b`. Der aus diesen Originalbytes gebildete enge Vergleich betrifft ausschließlich die beiden Guards, explizite Request-/Grantgeräteidentität und ihre passenden Oracles. `powerReadView.ts`, Energiearithmetik, Prioritätsvergabe, Zeit-/Restartlogik und bestehender Shipkern sind unverändert.

Der erste unabhängige Bericht `/workspace/.cloud-setup/fp06-w03-independent-review.md` bleibt unangetastet, SHA256 `f080f90f1b4ff0abf6a735188b24afa7fabebe07cdb4ced0e90761078947b240`. `before-independent-review.md` im eigenen Run ist korrekt der alte SELF-review; er ist keine Kopie des externen unabhängigen Berichts.

## R1 — CLOSED

`factoryPower.ts:31` und51 führen jetzt die erforderliche `deviceInstanceId` ausdrücklich in Request und Grant. Zeile210 validiert ihre ID; Zeile212 verlangt vor Trial/Adoption zugleich `consumerPort.direction === "in"` und `consumerPort.assetId === r.deviceInstanceId`. Ein Verteiler-/Akku-`both`-Port und ein fremder `in`-Port können deshalb keine zugehörige Cutterarbeit mehr liefern. Bei Ablehnung wird der vorherige Zustand unverändert zurückgegeben; bereits lokal geplante frühere Requests werden nicht veröffentlicht.

Der gültige Gegenfall `consumerId:"cut_motor", deviceInstanceId:"cut"` ist bewusst zulässig: logischer Verbrauchername und physische Geräteinstanz sind jetzt getrennt und beide im Grant vorhanden. Diese präzise Zuordnung löst das alte Problem ohne eine erfundene Gleichheit aller logischen und physischen IDs. Die spätere Hostadoption muss zusätzlich den realen Job dieser Geräteinstanz und dem vollständigen Supply zuordnen; der pure Planner ersetzt keine World-Adoption.

Zeile214 verwendet weiterhin `canonicalJson(r)` für das vollständige Requestkey. Die neue Geräteidentität wird dadurch in der persistierten Wiederanlaufhistorie und im kanonischen Resultat gebunden. Wechselnde Geräte-/Job-/Port-/Prioritäts-/Bedarfsbytes können keine fremde bereits akkumulierte Stabilitätszeit übernehmen. FNV allein entscheidet diese Gleichheit nicht. Die aktualisierten Collisionoracles `jak7yxej28s7d` und `jx3ru1udh6xuh` besitzen im neuen tatsächlichen Requestformat unabhängig nachgerechnete gleiche FNV1a-Signatur `2cbc150f` bei verschiedenen vollständigen kanonischen Bytes; die gelesenen bestehenden Tests bestätigen die Resetsemantik. Diese unabhängige Berechnung war ausschließlich ein Byte-/Hashaudit, kein neuer Allocator-/Testlauf.

Quellenbindung bleibt FP01§6.3 und§13.3 mit typisiertem tatsächlichen PowerPort/DeviceInstance und W03-Arbeitsgrant.

## R2 — CLOSED

`sourceAdapter.ts:92` setzt jetzt ohne gerätespezifischen Sample ausdrücklich `quality:"unsupported"`. Ein vorhandener bestätigter Sample mit der tatsächlich gelieferten Zeichenfolge`"0"` bleibt in der separaten FIXED-NET-OBSERVATION semantisch bestätigte Null; fehlender Sample wird nicht damit gleichgesetzt. Beide Fälle erhalten nur tatsächlich zulässige Energie. Die versionierte WX-FAV-Fixture mit ihren unveränderten1800W/800W-Literalen, Unknown-/Pending-Nulladmission, beschädigte Geräte und getrennte reale Batterie bleiben unverändert.

Dies entspricht FP01§6.5.3/§13.9 und erfindet weder Wetterquerys noch Kennlinien oder neue Ownerzahlen. Alle fünf fehlenden Samples in der tatsächlich vorhandenen Sechsquellen-Resourcesfixture werden nun als unsupported0 veröffentlicht.

## Tatsächliche Vorher-/Nachherverifikation

Run `apps/weltraum-browser/evidence/factory/w03/2026-10-11T112720.920804Z`; bestehende unveränderte Rawlogs wurden gelesen, nicht neu ausgeführt.

| Nachweis | Tatsächliches Ergebnis und Bytebasis |
|---|---|
| `17-independent-r1-r2-business-red.log.raw.gz` | Echter fachlicher RED:2 FAIL/21 SKIP,23 Fälle,11:50:55UTC. R1 berechnete alle drei Missbrauchfälle vor der Assertion und erhielt `[true,true,true]` statt dreimalfalse. R2 erhielt für alle fünf fehlenden Samplesconfirmed stattunsupported. Keine Setup-/Importfehlklassifikation. Rawgz SHA256 `65c61135f631ddae715adf302b48838735eac430ddbb3c7b8ad09047c0fc7773`. |
| `18-independent-r1-r2-focused-green.log.raw.gz` | Nach beiden Guards80/80 PASS in5 Dateien,23 Factory+57 alte Shipfälle,2.05s,11:51:19UTC. Exakter Command: `npm run test -- tests/unit/factory/power.test.ts tests/unit/shipBattery.test.ts tests/unit/shipPowerAllocation.test.ts tests/unit/shipPowerThermalDeterminism.test.ts tests/unit/shipPowerValidation.test.ts`. Rawgz SHA256 `728d8bc2c5043d564809c98ff7a1a8519311d1a7a901d35c0907fa8562bbeac6`. |
| `19-explicit-device-grant-green.log.raw.gz` | Nach ergänzter expliziter Geräteidentität im Arbeitsgrant und Gegenoracle1 PASS/22 SKIP,11:51:56UTC,352ms. Command `npm run test -- tests/unit/factory/power.test.ts -t R1 rejects`. Rawgz SHA256 `4aba5ae3d772b7c8f8118b6f2f72e45a6ba9eb2c5773af51a94711457c9b0988`. |
| `20-post-review-typecheck.log.raw.gz` | Entpackt exakt leer; laut tatsächlicher Übergabe vollständiger TypeScriptcheck erfolgreich. Leerestdout wird hier nicht als eigener Exitcode-/Commandreceipt erfunden. Voller Endmanifestbind hierfür bleibt separat ausstehend. Rawgz SHA256 `f61f27bd17de546264aa58f40f3aafaac7021e0ef69c17f6b1b4cd7664a037ec`. |
| Vorherige `14`/`15`/`16`-Logs |78/78 Units,tsc+Vite Build und bestehender Legacy-Ship-Chromium1/1 PASS wurden bereits am ersten Produktseal gelesen. Build und Browser liefen **vor** den engen neuen Guards und werden hier nicht als erneute Nachfixläufe behauptet. |

Die initialen echten AllocatorRED9FAIL/1PASS, der getrennte fehlerhafte Sourcefixtureversuch, die danach tatsächlichen4Source-/ReadviewREDs, frühere spätere FachREDs und der reale historische TypeScript-Buildfail bleiben im ersten Review/eigenen Run sichtbar. Dieses Folgereview ersetzt deren Geschichte nicht durch einen pauschalen rückwirkenden PASS.

Keine offenen Ownerentscheidungen für diese zwei Korrekturen: angenommene D03-/D05-Policies und die bestehenden exakten Grenzen reichen aus. Kein neuer Timeout, Queuebudget, Native-Worldcommitter, Renderer-/UIauthority, Dependencyupgrade oder pauschaler Architekturwechsel im Folgediff.

Reviewer: keine Produktedits, Test-/Build-/Browserprozesse, Commit-/Branchänderungen oder Unteragenten. Nur dieser externe Folgebericht wurde geschrieben. Finale committed Reproduzierbarkeit und vollständige Evidenceadmission sind weiterhin separat nachzuweisen; tatsächliche Factoryhost-/Production-/Facility-/CombinedSaveintegration, Live-Wetter, Gameplay, visuelle Abnahme und Performance sind in W03 **NOT_RUN**.
