# W09 unabhängige Aufnahmeprüfung — 2026-10-11 20:12:17 UTC

Reviewer `/root/w00_architecture`, **READ_ONLY/MUTABLE DRAFT, kein finaler Spec-/Quality-/Paket-PASS**. Basis `7b23d072670ecfd4b0b5f1c3f037539f24e5b07e`, Integratorbranch `codex/hestia-fp06-integrator-2026-10-11`, tatsächlicher25-Pfadgrant gelesen. Zusätzlicher D11-Transport wurde laut tatsächlicher Receipt um19:54:17.321634Z ausdrücklich angenommen: ein kinematischer Owner/≤5Collider,≤16Factoryowner **einschließlich Cargo+Carrier**, unveränderte64/32/4096-Budgets. Frühere Fixed-only-Blockade deshalb aufgehoben; die historische PROPOSED-Proposalüberschrift ersetzt diese Antwort nicht. Keine Ausführungsjobs, Produktwrites oder Unteragenten.

## Tatsächliche Evidence

Run `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z/` gelesen; dekomprimierte Rawbytes selbst gegen Receipt-SHA gehasht.

| Receipt | Tatsächliches Ergebnis | Grenze |
|---|---|---|
| `01-cargo-custody-business-red` |4 gesammelt/3 AssertionFAIL/1 C28scopePASS; Exit1; wrapper0,781402315s; raw`7d25921b90972d09fa82c3721a8dcf20fc21df4a940f6a545d09c7c4fec54394` | keine Setupfehler; undefinierte Profile/Rejected statt Prepared waren fachliche REDs |
| `02-cargo-custody-green` |4PASS; Exit0; wrapper0,814556090s/Vitest436ms; raw`87fc2418fafbbb8e795d03c16e904b47e85f638ccdb50f6dc5fa992497ef1525` | ausschließlich reines Material-/Profilmodul; kein Native-/Browser-/W09-Gate |

## Tests: Quellbindung und verbleibende Belege

`tests/unit/factory/cargoHandling.test.ts:15,20–40` nimmt den **echten Sourcefixture-C27-Stack**, prüft300kg/1,4m³, vollständige Unteilbarkeit, Gesamtmassenerhaltung, exaktes identisches Lot inklusive Instance-/Herkunftsmetadaten im Carrier, Sourceentfernung und W02-NoOp. Der Test ist ein sinnvolles Fachorakel. B07 `24–28` bindet341kg, vollständige gefrorene BOM und rationales Volumenceiling1496916667mm³; ein **wirklicher Transfer der gesamten BOM** ist damit noch nicht bewiesen. C28-Ausschluss ist ein legitimer Source-Scopefall. Carrierfixture341kg/1,5m³ ist bewusst testseitig leerer Container, kein zusätzliches Item; konkrete profilexakte Hostkapazitätsadmission muss später belegt werden.

Neue `facilitySession.test.ts:104ff` benutzt echte RapierWorld und explizit synthetischen Floor, kein D07-Routen-PASS. Gute Orakel: tatsächliche `body.mass()/localCom()/principalInertia()`, disabled kinematicBody/5Collider, Rollbackcounts, fremder Kinematicblocker vor Allocation. Ganzen Floor entfernen beweist fehlenden Boden, **keine vollständigen vier125mm-Supportflächen**. Neue Native-RED-/GREENreceipts wurden in dieser Phase nicht gelesen: NOT_OBSERVED.

## Konkrete frühe Befunde an Root gemeldet

1. **Historischer Handlingreplay muss vor frischer CAS geprüft werden.** `session/cargoHandling.ts:20` verwirft identische alte Intents zunächst alsStale. Nach Pickup→Return→Slotreuse kann alteCommandID mit aktualisierterExpectedRevision dagegen aufW02-NoOp treffen: dessen Receipt bindet nurderivedTransfermoves, keine vollständigen Handling-/Nativecommandbytes. Kein neuer Nativeowner/Phasenwechsel aus einem historischen Material-NoOp. Notwendiges Fach-RED: identische volle historische Bytes liefern denselben Receipt, veränderteRevision/Profile/Sourcebits derselbenID conflict; keines verändert Material oder Nativecounts.

2. **PreparedIntent ist nur shallowfrozen.** `cargoHandling.ts:43` friert lediglich die JSON-Kopie außen; `sourceLots`/Children bleiben veränderlich. Host-/ACK-/Nativebindung muss vollständige kanonische Bytes/rekursiv immutable Fakten benutzen. Echtes Negativorakel: nach Prepare manipulierte Childquantity/SourceID darf keine andere Nativeadmission erzeugen. Der W02-Materialplan selbst bleibt immutable.

3. **Footrays erfassen nur Innenpunkte.** Native `factoryFacilitySession.ts` `carrierPose()` tastet±31,25mm, Patchhalbweite ist62,5mm. Kleine tragende Innenpads können alleRays treffen, obwohl äußere Patchflächen frei liegen. RED mit solchen echten Nativepads/äußerer Lücke erforderlich; keine Footgröße-/Supportpolicylockerung.

4. **Owner-ID-Prüfung noch asymmetrisch.** `prepare():255` sperrt Cargo/bestehendeFacilities, nicht `carrier.ownerId`; `prepareCarrier():205` prüft hingegen bestehendeFacilities. Nach finalizeCarrier kann ein sonst legaler Facilityrequest mit `ownerId=instanceId="factory_carrier"` an freierPose denselben Ownernamen verwenden. NativebusinessRED muss vor Allocation rejecten; counts/Carrier/Material bleiben gleich.

5. **EigenerPlayerhandle noch nicht durchgereicht.** Neue `obstacle()` schließt ihn nur über `actorBodyHandle()` aus; `session.ts:143` übergibt aktuell ausschließlich Actorposition. Damit kann der geänderte Cargo-LOS-/Clearancefilter den eigenen Player einschließen. Dies ist eine **noch nicht integrierte Draftseam**, keine Behauptung über finalen Code. Reale NativeSession-Cargoaufnahme mit vorhandenem Player sowie fremdeKinematicLOS-Blockade notwendig.

## Noch offene Gatearbeit

Nativecarrier-Materialcandidatekopplung/ACKreplay, genau eine gemeinsame Materialadoption statt BuildStep-Privatview, vollständigeBOM-Custody, paired Player/Carrier-Endbewegung einschließlichAutostep/Jump **vor beiden Posen**, Unknowncoverage/Holds ohne Deadlock, Depot Kin→Fixed/safeSnap/Consume-Rollback/allmembers, vollständigeMassreceipt/Quellbindung, tatsächliche D07-Route/Service/LOS, gewöhnliche Browserbedienung und W10-Combinedrestore bleiben NOT_RUN/PENDING. Autorisierten Writer nicht aufhalten; konkrete REDs und schmale Integration schließen diese Grenzen.

## Bytephase

Gelesene reine3Dateien waren um20:09:47Z und20:12:17Z hashgleich: Profile`6faa1b01b5410474805f54a79f7033265ea01a5c899547b6575e3e33331354f0`, Custody`025a29d52e91961cf9d37fe3470fa1bfce9be971f218a695ee1cc39ad6c23d76`, Test`76895cf12b1a3810c885a93f2a7028b1922262128ac0cb14e317a073c96f14d6`. Native-Delta war erst anschließend verfügbar, EndhashFacility`57ca95be23c1e13754fe7690f598aad056438c997cfade113e782f5efce44c1c`, Nativeunit`17743036c6b7a3872941bb3973a765d8d46ef53826de02d723f832c8aa137e8c`. Session`3bd432ac…`, Locomotion`59957019…`, Client`4b8bfe57…` noch unverändert. **Kein versiegelter Snapshot/keine Endhashbindung für zukünftige Writes behauptet.**
