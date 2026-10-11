# W09 Live-loop Command-Seams v1

Read-only Aufnahme 2026-10-11T21:37:20.728224+00:00, Integrator-HEAD `aeb6680044eb455a10d0bba6e67979c153fd248f` plus beweglicher WIP; unten einzeln gebundene Sourcebytes, kein akzeptierter Paket-Seal. Integrator bestätigt Commands/Belt/Recipewahl ausdrücklich als unverbundenen Draft. Keine Produktwrites, Tests, Builds oder Native-/Browserjobs. Alle genannten fachlichen Gegenproben NOT_RUN; keine Runtime-FAIL-/W09-PASS-Behauptung.

1. **Publizierte Prozesskommandos werden noch nicht ausgeführt.** `factorySession.ts:126–137` behandelt Open/Pickup/Deposit/Return/Transfer; SelectRecipe/Start/ManualWork/ManualFinish/Power-/BeltConnect bleiben UnsupportedCommand. Readmodel Start/Montage/Finish sind disabled. `advanceDomain:62–66` reicht keine Productioncommands und `belts:[]` weiter. Bestehende `hostPort.ts:78–89` und W04/W08 reichen als finite Commandshape; Host muss exakte current Source-/Lot-/Machine-/Revisionbindungen prüfen und einmal in den nächsten bestätigten 100-ms-Schritt aufnehmen. Promise/Receipt erst nach tatsächlicher gemeinsamer Adoption auflösen, nicht schon nach Queueannahme; unverändertes historisches Command bleibt NoOp. Kein UI-Timer/eigener Powerschritt.

2. **Former-Ausgabewahl fehlt als Hostzustand.** `readUi:123` publiziert `job?.recipeRef ?? recipes[0]`; abgeschlossener PROFILE-Job hält damit weiterhin seine alte Auswahl. Normalkreislauf braucht zwei CUT8kg→7,5kg Halbzeug, dann einmal REC-02-PROFILE→7kg Profile und einmal REC-03-SHEET→7kg Blech. SelectRecipe muss vollständigen Ref+Maschinenrevision binden, aktive Jobs unverändert lassen und nach COMPLETED eine neue Auswahl zulassen; alten Job/Commandreceipts nicht löschen. Aus dem frischen Output gehen 4kg Profile+2kg Blech zur bezahlten B05-Werkbank.

3. **Native Produktionsbelege fehlen.** `factsFor:55–60` setzt supported/serviceClear/installationRevision/confirmed konstant true/1. `factoryFacilitySession.ts:118–134` belegt echten Fixed/Enabled-Owner, Profil/Pose, Service-Reach und LOS; `read:241` veröffentlicht jedoch nur Containeraccess. Kleinster Integrator-Seam: gebundene Readonly-Productionfacts pro Owner aus demselben World, mit aktuellen NativeTick/Terrain-/Facilityrevisionen, gedeckten Supportpatch-Groundqueries sowie Service-/Sweep-Solidclearance. Owner/Actor im Clearancequery sinnvoll ausschließen. Stabile Installationsidentität getrennt von laufender Observation halten: W04 bindet `job.installationCanonicalJson`, daher aktuelle Tick-/Accessrevision nicht unbemerkt in immutable Installation einbauen. Tool-ID/Condition weiterhin aus tatsächlichem bezahltem Installed-Container, Actorreach aus aktueller Nativeprojection, keine synthetischen UI-Facts.

4. **Echte Bandverbindung hat einen Rotationsvertragskonflikt.** Native `installationProfile.ts:22` q1 `[x,y,z]→[z,y,-x]`, W08 `beltPorts.ts:27–29` q1 dagegen `[-z,y,x]`. Entry q1 Cuttercenter[-6250,1500,5000] und Formercenter[-6250,1500,-2500] ergeben tatsächlichen OUT[-6250,2500,3500]→IN[-6250,2500,-500]: 4m Richtung−Z. Unverändertes native q1 im W08-Port berechnet z6500→−4500 bei +Z-Normal und scheitert DirectedRoute. Nötig ist ein explizit versionierter transparenter Native→Belt-Rotationsadapter oder ein später separat gewährter enger W08-Geometryfix; accepted Bytes bleiben hier unverändert. Zusätzlich fehlen derzeit Entry-Connectbedienung und bezahlte Native-Lineaufnahme: BELT4-Pickup allein installiert keine vier Module/Drive; `factoryAssets.sources` enthält keine BeltModule/Drive-Installationsquelle. Tatsächliche Ports/Cable-/Module-/Drive-Lose, 1-Packet-Custody und Nativeowner müssen gemeinsam gebunden werden. 4m kostet100W/10J je versorgtem Step; Kredit initial0, Route mindestens54Moves.

5. **REC05 und WIP müssen bei Verdrahtung die vorhandenen Verträge behalten.** Paid B05 hat keinen elektrischen In-Port; DrySlice lässt dessen Demand korrekt aus. Aktive Start→LAID_OUT, Montage→ASSEMBLED, Finish→5,8kg Stütze+0,2kg Verschnitt benötigen aktuelle lokale Quellen/Sinks und echte Receipts. Passive Away-/NoPower-/Blocked-Schritte behalten WIP, vollständige Produkt-/Cassetteclaims und bestätigte Arbeit; keine Rückbuchung, Neuinitialisierung oder Wiederholung des alten Starts. Cutter/Former haben getrennte offcut-Container, niemals Bandrouting für Verschnitt. UI-Lotmengen im Host gegen gefrorene Rezeptterms und aktuelle Resources erneut prüfen; vollständigen erfolgreichen W03-Receipt weiterreichen. Vorhandener Brace-Entrybutton und technischer paid Placementprofile sind bereits da; benutzbares Produkt muss aus dem neuen REC05-Receipt stammen und beim Platzieren einmal aus lokalem Depot verbraucht werden, nicht verschenkt.

Sourceprefix: `apps/weltraum-browser/src/`; SHA256:

`factory/factoryEntry.ts` `d110bbe6877d5796660cde4630ace45f04bef4457feebe149c00749d8bf6db8a` (10993 B).

`factory/session/factorySession.ts` `37b70a9f8bd2487d5bdf490cfe9ff81ce8687b2ee842b29f9ad9027d1ef00c63` (20854 B).

`factory/session/hostPort.ts` `e84d17ea0b2f07db1d6e1427b4d7009ffde8f4588daa414b5a0bf206cdf5393a` (9550 B).

`factory/session/dryFactorySlice.ts` `1ca4dd544a201126e82ea9c5facdf3e5c0e6906daedcb2f00bcfba130bb4fdf0` (19253 B).

`hestia-prototype/physics/factoryFacilitySession.ts` `1e713b44fa66a97b35a5855e8697ebde751e4e5b527c861d661507f1aaef03f8` (46120 B).

`factory/construction/installationProfile.ts` `64df3962d652649301e1a7f411516829e6e7fd915d5fa48f566f18090c32832f` (5733 B).

`factory/presentation/factoryAssets.ts` `c80339580cc87b038c8a82e2d9e10981f8c125dc40b2a174248616d55daa487c` (12189 B).

`factory/conveyor/beltPorts.ts` `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9` (7259 B).

`factory/conveyor/beltReference.ts` `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211` (20546 B).

`factory/production/recipeAdmission.ts` `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102` (12898 B).

`factory/production/productionStep.ts` `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449` (29154 B).

`factory/ui/machinePanel.ts` `9905cc0d9bd04ee2dc15903b03fca2399e4fa95fdf828ed6853787f97a19c2e7` (6494 B).
