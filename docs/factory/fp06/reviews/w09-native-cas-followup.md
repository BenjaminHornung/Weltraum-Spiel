# W09 – enges Read-only-Nachreview, Phasen 26–31

2026-10-11 20:51:33–20:53:56 UTC, Integrator-HEAD `43a61c0f5be5df69e4f8bb42db89da3d7a3a4b2b` plus beweglicher WIP. Vorherige Berichte bleiben erhalten. Keine eigenen Tests/Build-/Browser-/Nativejobs. **Kein finales Paketgate.**

## Historischer F1: geschlossen

`dryFactorySlice.ts:14,26,69,75–78` speichert und vergleicht jetzt sämtliche Nichtmaterial-Eingabefakten separat. Der aktuelle Nachmaterialzustand bleibt gegen `lastStep.materialBytes` gebunden. Damit wird derselbe historische gültige Schritt NoOp, `confirmed:false` dagegen Rejected; nach mutierenden Schritten werden keine alten Materialbasebytes mit aktuellem Nachmaterial verwechselt. Das ist die richtige enge Vertragskorrektur.

Tatsächlich gelesene und entpackte Receipts: Phase26 ein Assertion-FAIL (NoOp statt Rejected), Phase27 ein Assertion-FAIL (Carrying statt PreparedHeld), Phase28 drei PASS/22skipped/2Dateien, Phase29 zwei PASS/19skipped, Phase30 ein Assertion-FAIL `InvalidProductionId`, Phase31 ein PASS/6skipped. Bei allen sechs stimmen SHA256 und Bytezahl der Rohlogs mit dem jeweiligen `.command.json`; tatsächliches CWD ist das Integrator-Appverzeichnis. Vitest-/Wrapperzeiten:26 512ms/0,870193600s;27 1,62s/2,018751116s;28 2,60s/3,012639769s;29 1,42s/1,803185708s;30 554ms/0,964862168s;31 564ms/0,986496584s. Phase31 beweist ausschließlich Productionstate/IDkodierung, keinen gemeinsamen Power-/Belt-Schritt.

## Slot-/Bewegungsnachweis

Native `prepareCarrierRelease():273–287` verlangt ein kanonisches leeres Custody-Statefragment, das in den gebundenen Hostmaterialbytes vorkommt. `finalizeCarrier():338–344` entfernt erst nach gehaltenem Commit/Publish genau den vorhandenen Body mit fünf Collidern und beweist alle anderen alten Members; vorher bleibt der Slot belegt. Rollback restauriert ursprünglichen Kin- beziehungsweise Fixedmodus und Members. Das hält den freigegebenen Einzelplatzvertrag. Das Fachorakel `facilitySession.test.ts:122–134` prüft Release/Rollback/Counts und nächste Pickupallocation; sein Leerfragment ist explizite Unit-Hostevidence, noch kein echter kompletter Resources→Native-Hostfluss.

`hvp-locomotion.test.ts:193–209` prüft nun tatsächlich einen geerdeten Jump gegen Carrierhindernis: beide Poses und Jumpcount bleiben unverändert, die konsumierte Jumpedge kommt anschließend nicht wieder. Das zweite echte Rapierorakel hebt die Capsule über eine native Stufe, während der Carrier auf separat belegter ebener Wheelstütze bleibt. Phase29 bestätigt beide Fälle auf synthetischem Boden; kein Beleg für die D07-Worldroute.

## Neuer enger Samebinding-Befund F2

Anfangshash Dryslice `3895ffbcd8a085da52f7f4a8bf88d0cb50e21c18d622cac555f324d273af0c80`, damaliger Adapter `:125–128`: normale Native-UUID mit 36 UTF-16-Units ergibt **16+144=160 Zeichen**. Das unveränderte W03 `factoryPower.ts:96,117` lässt maximal128 zu. W04/W08 verlangen dagegen save-safe IDs ohne diese Längengrenze. Deshalb **Samebindinggate dieser Phase FAIL** trotz GREEN31: gültiger bestätigter 100ms-Power-/Dryschritt mit demselben adaptierten UUID scheitert `InvalidId`. Root/Integrator informiert.

Während des Reviews begann der enge v2-Fix: Endhash `4b374d95ab02967fe930f5c411e74e17249a6a66ddc12ad2c30bc282916a7f46`, Adapter `:125–131`: begrenzte UTF-16-Länge, explizite Originallänge plus Base32-Payload, unveränderte RawID. Führende Nullunits, Surrogates und Separatorunterschiede bleiben rekonstruierbar; resultierende IDs sind save-safe und explizit ≤128. Source-seitig geeignet; v2 verlangt eigenes echtes Same-Powerbinding-RED/GREEN und spätere stabile Bytebindung. Native/UI behalten die rohe UUID; W10 muss die versionierte Ableitung aus dieser RawID erneut prüfen. Es wird keine Domain-ID als Ersatz der Native-ID vorgeschlagen.

## Weitere aktuelle Handling-Gegenfälle, gemeldet

F3: `cargoHandling.ts:63,102,107` verlangt beim festen Depot `native.carrier.accessible===true`, doch `factoryFacilitySession.readCarrier():161–167` publiziert dieses Feld nicht. Selbst benachbarte Return-/Transferaktionen bleiben dadurch nach groundDeposit gesperrt. Benötigt wird tatsächliche Reach/LOS-Projektion und ein lokales Depot→Ziel-Orakel.

F4: `cargoHandling.ts:96–111` erlaubt beispielsweise 4kg-Teilentnahme aus RAW8-Custody mit8kg. Der Restcontainer ist nicht leer, daher folgt keine Nativeoperation; Materials können bereits Committed sein, während Nativebody/Profilebinding unverändert8kg besitzen. Enges Mass-/Custody-Orakel erforderlich; ein geschlossener Jobpfad darf Teilentnahme vor Mutation ablehnen. Keine neue Ownerpolicy wird daraus abgeleitet.

Beide Source-Gegenfälle gelten für stabile Readbytes Handling `83b51e776121eb325ed51e0b9bd5b26c9e1ed2877b321d30df3d15cce3389142` und Nativefacility `d54f611c573b1cc3aa170d8de16671507813180949c7da1688d9d1b250bce341` am Anfang und Ende. Neue HostFactorySession ist ausdrücklich laufende Integration. D07-Route, Gesamtkreislauf und W10 bleiben offen; keine Paket- oder Browsererfolgsbehauptung.

## Enge anschließende Korrekturphase 39–42, Read 20:55:24 UTC

Die im vorigen Absatz gebundenen Readbytes drifteten nach20:53:56 autorisiert weiter. Der aktuelle Nachreview bindet Dryslice `4b374d95ab02967fe930f5c411e74e17249a6a66ddc12ad2c30bc282916a7f46`, Handling `b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018` und Nativefacility `169c93d151cb726ac2529b5bfc6230a0a717083fd9f051c6e4953685bdb89014`. Die ursprünglichen Befunde und Phasen werden dadurch nicht rückwirkend als bestanden umetikettiert.

**F01 / obiges F2 Samebinding: geschlossen im engen Source-/Fachtestscope.** Phase39 tatsächlich ein Assertion-FAIL im vollständigen leeren bestätigten100ms-Dry/Power-Schritt mit echter UUID; RawSHA `8e00dcb6dbc1e3dfa9900577887a4786b0840f8b95698103db92a9887e683755`, Vitest516ms/Wrapper0,902482009s. Phase40 tatsächlich zweiPASS/fünfskipped, RawSHA `6f16980b9c3677d0e471107ec760d54535bb68a7834fae676093d1eb09bfa15e`, Vitest511ms/Wrapper0,866954614s. Aktueller Adapterv2 encodiert festbreite UTF-16-Units als BigInt/Base32 plus explizite Originallänge. Leading-zero-Units lassen sich dadurch eindeutig zurückpadden; unterschiedliche Originalstrings können keine identische Länge/Payload-Kombination erzeugen. Bei maximal37Units liegt die ID selbst im schlechtesten Fall bei≤125Zeichen, zusätzliche128-Prüfung bleibt. RawNativeID wird unverändert separat behalten. Aktuelles UUID-Orakel rekonstruiert die RawID einschließlich Surrogate/Separatorvarianten und verwendet denselben Adapter im Productionstate sowie tatsächlichen Dry-Power-Schritt. W08 akzeptiert source-seitig dieselbe save-safe Session-ID; ein tatsächlicher Belt-/Machine-Gesamtlauf ist dadurch noch nicht belegt.

**F02 / obiges F3 Depotzugriff: geschlossen für den berichteten Gegenfall.** `factoryFacilitySession.ts:165–172` berechnet bei Deposited/Fix/Enabled eine auf dem bekannten q1-Hull geclampte Zugriffsstelle, tatsächliche Actorentfernung≤3m, native Coverage und native LOS; publiziert `accessible`. Eigenes Depot und echter Player werden aus dem Ray ausgeschlossen, sonstige Hindernisse bleiben wirksam. Das neue native Orakel prüft zugängliches Depot, echte LOS-Blockierung und Fernposition. Kein renderer- oder UI-getriebenes `true`.

**F03 / obiges F4 Teilentnahme: geschlossen für den geschlossenen Carrierjob.** `cargoHandling.ts:99` weist Transfer eines Teilstacks oder nur eines Members eines mehrteiligen Carrierjobs vor W02Prepare/Commit und vor CAS zurück. Das neue Resources-Orakel erstellt tatsächlich8kg-Custody, versucht4kg und verlangt unveränderte vollständige Materialbytes. Ganze mehrteilige Übergabe bleibt über den vorhandenen Containerdeposit-/Returnzweig möglich.

Phase41 tatsächlich zwei Assertion-FAIL (fehlende Depotaccessible-Projektion und Committed statt abgewiesener4kg-Entnahme), RawSHA `3648aa508a1b4f208cd6d6e446b5f9ca274e4b9a9fb3c9b32e2c6b95e3902ee9`, Vitest2,31s/Wrapper2,724062077s. Phase42 tatsächlich zweiPASS/25skipped/2Dateien, RawSHA `233679c35b5a5d080e40d8c2549ebf1a392f70a1f397562d39bc808d532b5d6f`, Vitest2,05s/Wrapper2,446598678s. Beide Rohlogs sowie39/40 wurden unabhängig entpackt: SHA256/Bytezahl stimmen jeweils mit der Receipt überein; CWD ist korrekt. Diese Ergebnisnamen bedeuten keinen Fullpackage-/Browser-/Belt- oder W10-PASS.

Abschluss-Hashread20:56:35 UTC: alle drei vorgenannten aktuellen Sourcehashes unverändert gegenüber20:55:24. Keine neuen Restfunde im engen überprüften Delta; Hostintegration bleibt beweglich und ohne Abschlussgate.
