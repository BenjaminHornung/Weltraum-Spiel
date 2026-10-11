# W10 Restore-Seam-Delta v1

Read-only Aufnahme 2026-10-11T21:02:44.728685+00:00; Integrator-HEAD `aeb6680044eb455a10d0bba6e67979c153fd248f` mit beweglichem W09-Draft. Einzeldateihashes unten binden nur die gelesenen Bytes, keinen akzeptierten W09-Seal. Root-W10 hat derzeit 17 geplante Pfade und keinen Writegrant. Keine Tests, Builds, Native-/Browserjobs oder Repositorywrites ausgeführt. Bestehende Domain-/UI-Worktrees unverändert sauber.

**Konkrete zusätzliche Pfadgrenze: `apps/weltraum-browser/src/factory/construction/buildStep.ts` (17→18, vorgeschlagen).** Zeilen23–30 initialisieren private `installations=[]`; `current()` überschreibt auch vom Host gelieferte Installationen. Allein `factorySession.ts`/Host-Restore kann daher bezahlte Installationen nicht wiederherstellen. Kleinste Ergänzung: interner Restore-Initializer für bereits vollständig validierte, immutable Installationen, gemeinsame wiederhergestellte MaterialAuthority und Zustand Ready. Kein Live-Build-Replay: das würde BOM erneut verbrauchen oder Native-Owner doppelt installieren. Codec prüft eindeutige IDs, Source/Profile/Definition, bezahlte Installed-Container und exakt einen zugehörigen Native-Owner. Dies wurde im älteren Cargo-Save-Preflight bereits als möglicher Scopebedarf benannt; im tatsächlichen 17-Pfadeplan fehlt der Pfad.

**Weitere nötige Seams liegen innerhalb der vorhandenen 17 Pfade:**

- `dryFactorySlice.ts:103–121`: CommandHistory ist eine private, anfangs leere Map ohne Export/Restore. Ergänzen: vollständige immutable Aufnahme und validierte Initialisierung aller angenommenen Requests/Receipts inklusive Rejected und abgeschlossener Handling-/Buildbefehle. IDs, vollständige kanonische Requestbytes, Status und Sessionbindungen prüfen; identisches historisches Kommando nach Load liefert bestehenden Receipt/NoOp, keinen neuen Transfer. Ungeklärte Pending-Ergebnisse vor Capture drainen oder RecoveryHold. UI-Fokus/gedrückte Tasten werden neutral neu gesetzt, nicht als Eingabe restauriert.
- `reservations.ts:51–56,77–108`: gesamte MaterialView einschließlich nichtnull Revision, tatsächlicher Resources-Container, WIP, Outputclaims und lückenloser Receipts validiert restaurieren. `factorySession.ts:37–52` darf beim Load nicht Cargo-Fixture, History oder Clock neu beginnen. Ein gemeinsamer vollständiger Snapshot ersetzt die Initialisierung; keine getrennte Inventarbilanz.
- `dryFactorySlice.ts:125–131`: `fp06-native-session-binding-v2` mit originalem Raw-Native-ID und Domain-ID speichern, verlustfrei neu herleiten und vollständig vergleichen. Native/UI verwenden Raw-ID; Power/Production/Belt Domain-ID. Gespeicherte Domain-Epoche und neue Host-Lifecycle-Epoche brauchen einen expliziten Codec-/Adoptionsvertrag. Blindes Umschreiben ist ungültig: `productionStep.ts:164–168` bindet lastStep an vollständige aktuelle stateCore-Bytes. Historische Command-/Materialreceipts nicht umschreiben oder verwerfen; alte Callbacks dürfen keine neue Host-Epoche mutieren.
- WholeSave enthält vollständige Power-/Production-/Beltcores, Manualphasen und Replaybytes sowie bestätigten Native-Tick, 6-Tick-Rest, Steps/Elapsed und 100-ms-Cursor. Kein Fake-Step als Decodevalidator, Offlinefortschritt, Energie-/Work-/Creditreset. Vorhandenes `assertFactoryBeltState` nach Materialdecode nutzen. Fehlende öffentliche Production-/Power-Restorevalidatoren sind zunächst eine Codecaufgabe innerhalb `factoryCheckpoint.ts`, kein belegter zusätzlicher Writepfad.
- `factoryFacilitySession.ts:32–47,72,344–352`: Carrier Phase/Profil/Pose/Custody, tatsächliche Masseneigenschaften und vollständige Native-Membership gehören in den kombinierten Codec. Nur stabile Carrying/Deposited nach proven Barrier; laufende/Held-/Recoverytransaktionen verweigern. Worldhandles im restaurierten selben World verifizieren beziehungsweise beim Aufbau zuordnen; keine Objectreferenzen serialisieren. Exakte disjunkte Legacy/Cargo/Facility/Carrier-Partition, gleiche Budgets. `completed` auch für entfernte Carrier/ReleaseIDs erhalten; aktive Owner allein reichen nicht. Profil/Lineage gegen aktuellen Container und passende historische Receipts prüfen; alte `materialBinding` nicht fälschlich mit inzwischen verändertem Gesamtmaterial gleichsetzen.

**Kein zusätzlicher `cargoHandling.ts`-Grant begründet:** Zeilen58–67 halten nur Transaktionsphase; stabile Custody liegt in Material/Native. Nach vollständiger geprüfter B-Adoption Handling Ready neu instanziieren; unbekannte Finalisierung bleibt RecoveryHold.

Vorgeschlagene echte W10-Gegenfälle, alle NOT_RUN: bezahlte Installation nach Load ohne zweiten BOM-Abzug; historische Pickup/Deposit/Release/Build-NoOps; halber CUT mit WIP/Claims; Carrier samt einzigem Body und fünf Collidern; korrupte v2-Bindung/fehlender Owner vor Aktivierung ablehnen; neues Hostepoch verhindert alte Callbackwirkung. Kein W09-/W10-PASS behauptet.

## Gelesene Sourcebytes

Prefix der folgenden Pfade: `apps/weltraum-browser/src/`.

`factory/construction/buildStep.ts` SHA256 `f8a620467585df72df30181cadecae0b6c70bdd9e917c4276348e79184b1f8d6` (6382 B).

`factory/session/dryFactorySlice.ts` SHA256 `4b374d95ab02967fe930f5c411e74e17249a6a66ddc12ad2c30bc282916a7f46` (12313 B).

`factory/session/factorySession.ts` SHA256 `98cdb8d21de71c17fcf61c3431fd19b8258ee8e16f60a1f7c76e601dab01e4f2` (13935 B).

`factory/session/cargoHandling.ts` SHA256 `b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018` (13892 B).

`hestia-prototype/physics/factoryFacilitySession.ts` SHA256 `169c93d151cb726ac2529b5bfc6230a0a717083fd9f051c6e4953685bdb89014` (41850 B).

`factory/material/reservations.ts` SHA256 `4f5c1d17db3c5167dc42b23e0ab6b0a63f3a9b441684bc5140c367dd7d4d483e` (22417 B).

`factory/production/productionStep.ts` SHA256 `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449` (29154 B).

`factory/conveyor/beltReference.ts` SHA256 `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211` (20546 B).

`factory/power/factoryPower.ts` SHA256 `70ddfe44c9a81c6355262bed928ee4d72b410b4b0db2a6c6bf08a36ec71b2825` (19844 B).

`source-lock.json` SHA256 `e0d2c42c715c7c68c492908d6bc0d97431426febf7abc49da8d46d19b8ab404a`.

`write-ownership.json` SHA256 `de2452d5c86f546474409d4bf5a2f741770b5d135cfe33118380bdde091b5648`.
