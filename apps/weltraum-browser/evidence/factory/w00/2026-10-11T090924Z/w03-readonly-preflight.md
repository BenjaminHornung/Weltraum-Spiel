# FP06 W03 Preflight – Powerpolicy und Ship-Core-Vergleich

Stand: 2026-10-11. Reale delegierte Analyse: `/root/w00_architecture`. Read-only am Produktcheckout `BenjaminHornung/Weltraum-Spiel`, HEAD bei dieser Untersuchung `e40592c113b72a8dc93725187f92cf948e07f44d`. Nur dieses Hilfsdokument außerhalb des Produktworktrees geschrieben. Keine Produktänderungen, Tests, Branches oder Commits. Keine Entscheidung angenommen und kein Write-Grant erzeugt. W03 hängt weiter am bestandenen W01-Gate und den tatsächlich benötigten Policy-/Quellenfreigaben.

## Quellbasis und Status

- Vollständig gelesen: FP01 §§6–7 und §13, FP02 §1.1, FP06 W03 und relevante Energieorakel.
- FP01-Datei: `01_PLANUNG_VERBINDLICHE_QUELLEN/HESTIA_FP01_EINSTIEG_ENERGIE_DETAILPLAN_2026-10-10.md`, SHA-256 frisch geprüft `ec3e605de2c6a4877c2ff0afae244b3215e7bf8bb267feef4c466b546477080c`.
- Tatsächliche Dateien: `apps/weltraum-browser/src/ship-power-thermal/{types,powerAllocation,battery,step,protection,validation,fixtures,canonical,ids}.ts`; Vertrag `docs/browser-mainline/ship-power-thermal-core-v1.md`.
- FP01 ist fachlich angenommen laut Handoff; konkrete Mess-/Balance-/Hysteresewerte darin sind weiterhin als vorgeschlagene Testprofile kenntlich. Dieses Dokument macht keine ungemessenen Zahlen zu Runtime-Evidence.
- W03-Ziel: `stepFactoryPower(state: FactoryPowerState, input: FactoryPowerInput): FactoryPowerStep`, mit tatsächlich zugeteilter Arbeit/Leistung, nextState, Verlustbilanz und stabilen Wartegründen. Öffentliche Typen gehören dem Contract-Integrator, nicht einem zweiten Inventar-/Worldowner.

## Normative Grundregeln aus FP01

| Thema | Quelle | W03-Folge |
|---|---|---|
| Leistung und Energie getrennt |§6.1 |W bzw. kW ist Rate; J/kWh ist Inhalt/Arbeit. 4kWh ist kein 4kW-Generator |
| Elektrischer Zugang |§6.3,§6.9 |Nur über bestätigten aktiven leitenden Port-/Linkpfad; keine Energie aus räumlicher Nähe, Rendererlinie oder isoliertem Mast |
| Höhere Priorität |§6.4 |P0 LIFE-SAFETY→P1 BASIC→P2 PRODUCTION→P3 OPTIONAL; nur tatsächlich verfügbare Energie, auch P0 erhält keine Gratisversorgung |
| Innerhalb gleicher Klasse |§6.4.1 |Dokumentierte gespeicherte stabile Ordnungsregel ODER ausdrücklich definierte faire zeitliche Slots. Map-/Render-Ladereihenfolge verboten |
| Auftragszulassung |§6.4.1 |Ausreichende Leistung und definierter Arbeitshorizont reservieren. Tatsächliche Arbeit niemals größer als zugeteilte/gelieferte Energie |
| Unterversorgung |§6.10 |WAIT_POWER hält Materialreservation und progressWork; frühe Kaltprozesse konstruktiv stoppbar. Unbekannte lokale Halteenergie ist keine versteckte Gratisquelle |
| Netzmangel vs Netzfehler |§6.11 |Erzeugungsmangel von fehlendem/defektem Port/Kabel/Verteiler unterscheiden; stabile konkrete Wartegründe |
| Atomarer Speicherfluss |§6.7.2 |Dasselbe Batterieasset innerhalb eines Schritts nicht gleichzeitig positiv laden und entladen; genau ein Solver besitzt SOC |
| Authority |§13.1–13.2 |PowerState und autoritative Receipts maßgeblich; Three.js/UI/Animation/Worker besitzen keine eigene Energie- oder Worldauthority |
| Determinismus und Restführung |§13.5 |Gleiche Inputs, bestätigte Simulationszeit und Events ergeben identische Bilanz. Exakte Integer-/Rationalrechnung mit persistiertem Bruchrest, nicht Rundung pro Tick |
| Savepflicht |§13.7 |SOC, Reserven/Policy, Content-/Wetterbindungen, Linkrevisionen, Prioritäten, offene Arbeit, Remainder, Receipt-/Idempotenzzustand werden im gemeinsamen Save erfasst |

## Speicherprofil und genaue Energiebilanzen

| Parameter | Fixturewert | Einordnung |
|---|---:|---|
| Nennkapazität |4kWh = **14,400,000J** |FP01-BAT-4KWH-A und FP06 W03 |
| Tatsächlicher Anfangs-SOC |3.6kWh = **12,960,000J** |C03, 90%; Diagnoseentnahme zählt gegen genau dieses Asset |
| Produktionsreserve |1kWh = **3,600,000J** |P2-Produktion darf SOC nicht darunter entladen; P3 darf diese Produktionsreserve nicht zu einer Allzweck-Reserve umgehen |
| Hardwareminimum |.2kWh = **720,000J** |FP01§6.7.1 nennt es Beispiel, FP06 W03 fordert getrennte Abbildung dieses Fixturewerts. Nicht mit Produktionsreserve verwechseln |
| Max. Lade-/Entladeleistung |je **8,000W** |Busseitige tatsächlich angeforderte/gelieferte Leistung; unabhängige Inhaltsgrenze; ein Akku kann60kW-Last nicht allein bedienen |
| Lade-/Entladewirkungsgrad |je **.95 =19/20** |Getrennte Verluste, nicht ein gemeinsamer .95-Roundtripwirkungsgrad |
| Standbyverlust |explizit, ggf.0 in Startfixture |Keine feste positive numerische FP01-Regel; Fixtureentscheidung ausweisen |

Busgrenze für ein gemeinsames bestätigtes Intervall:

`E_source_actual + E_battery_to_bus = E_load_actual + E_charge_from_bus + E_link_bus_losses + E_other_real_outflows`.

Speichergrenze:

`delta_E_stored = (19/20)*E_charge_from_bus - (20/19)*E_discharge_to_bus - E_idle_losses`.

Ladeverlust: `E_charge_from_bus/20`; Entladeverlust: `E_discharge_to_bus/19`. Dieselbe Umwandlung niemals doppelt als Generator-/Busverlust buchen. Potenzielles ungenutztes Quellangebot ist Abregelungsdiagnose und keine tatsächlich erzeugte elektrische Energie.

**Reserveeligibilität:** Unterhalb1kWh dürfen P0/P1 bei Bedarf bis zum echten Hardwareminimum versorgt werden. Diese Sonderenergie darf nicht durch ein undifferenziertes gemeinsames Battery-Powerbudget an P2/P3 durchsickern. Quellenenergie kann Produktion auch bei erreichtem Batterie-Reservewert versorgen; `SOC<=reserve` allein ist kein generelles Produktionsverbot. Bei fehlender/kleiner Quelle darf P2/P3 die Batterie nicht unter3,600,000J bringen. Bei Hardwareminimum ist jede weitere Batterieabgabe0, auch für P0/P1; Quellenbetrieb bleibt separat möglich. Ein bereits unter Hardwareminimum geladener Save wird nicht heimlich auf Minimum aufgefüllt.

**Schrittgrenzen:** Für ein konstant versorgtes Intervall ohne neue Quelle ist die Busenergiegrenze oberhalb Produktionsreserve `(E_stored-E_reserve)*19/20`. Für P0/P1 gilt entsprechend `(E_stored-E_hardwareMin)*19/20`, abzüglich höherer bereits bestätigter Entnahmen. Bei einem notwendigen Teilintervall muss die Policy entscheiden, ob es exakt segmentiert oder eine ganze Motorzulassung verweigert; keine Vollproduktion mit zu wenig Energie.

**Restführung:** .95-Entladung produziert normalerweise rationale19er-Reste. Bei3500W*.1s sind350J externe Arbeit und **7000/19J** Speicherentnahme. `mJ` pro Tick einfach abzurunden verliert Energie. FP01§13.5 nennt `EnergyMilliJoule = PowerMilliWatt*deltaTimeMicroseconds/1_000_000`; Bruchreste gehören dem Energieowner und dessen Checkpoint. Vor W03-Write Maßeinheit, sichere Bounds und kanonische Remainderrepräsentation definieren; keine pauschale Number-Präzisionsbehauptung.

Weitere exakte Referenzen:

- Vollakku bis Produktionsreserve:3kWh Speicherenergie→**2.85kWh/10,260,000J** an Lasten.
- Tatsächlicher Start3.6→1kWh:2.6kWh intern→**2.47kWh/8,892,000J** extern. Konstante3500W ohne weitere Last ergibt2540.571428…s =42.342857…min, keine garantierte Wetterautonomie.
- Start3.6→4kWh braucht1,440,000J Speicherzuwachs und **28,800,000/19J** Busladeenergie. Bei konstant3300W Überschuss dauert dies459.330…s =7.6555…min.
- C03-Energie bleibt beim Verschieben/Falten/Build/Rückbau dieselbe Assetenergie. Keine zweite volle Batterie aus einer Blueprint-/Cargo-Kopie.

## Wiederanlauf, Hysterese und Fairness

FP01§6.4.2 verlangt Hysterese, Mindesthaltedauer und vorhersehbare Taktgrenzen. Seine **Testvorschläge** sind `2s` Mindest-Wartefenster und Wiederanlauf erst mit `.5kW=500W` Reserve für relevante Fabriklasten. Diese Zahlen besitzen laut Quelle keine Bedeutung außerhalb der Fixture und sind nicht als aktuelle Ship-Core-Funktion implementiert.

Vor einem verbindlichen T016-Golden sind folgende Details offen und dürfen nicht versteckt erfunden werden:

1. Beginnt2s bei Stromverlust, bestätigter sicherer Stoppphase oder beim ersten ausreichenden Angebot? Muss die ausreichende Leistung kontinuierlich2s vorhanden sein oder nur die letzte Beobachtung?
2. Ist500W-Headroom auf einzelne neu startende Maschine, ganze P2/P3-Gruppe oder gesamte tatsächlich zugelassene Netzlast bezogen? Zählt verfügbare Akku-Spitzenleistung als Headroom oder nur Quellleistung?
3. Gilt die zusätzliche Wiederanlaufreserve nur für Restart nach WAIT_POWER oder auch Initialstart? Ein blindes Gesamtlast+500W-Startgate würde eine6.6kW-Zelle bei6.8kW Angebot trotz ausreichender Betriebsmittel blockieren; dieses Verhalten darf nicht als T014-Grün verborgen werden.
4. Start-/Stop- und Sicherheitsphasengrenzen, nötiger reservierter Arbeitshorizont und lokale Halteenergie sind nicht numerisch komplett spezifiziert. Für KISS können frühe Phasen ausdrücklich sicher stoppbar sein; ein realer lokaler Energiespeicher benötigt eigene bezahlte gespeicherte Energie.
5. FP01 erlaubt stabile Sortierung ODER zeitliche Fairness, schreibt keine Round-Robin-Quantengröße vor. Ein gespeicherter Fairnesscursor wird erst nach Policyfreeze eingeführt; andernfalls deterministische stabile ID-Ordnung mit dokumentierter möglicher Dauerwarteposition. Keine unbelegte Fairnessgarantie.
6. Das .1kW-P1-Grundlastprofil enthält teilweise optionale UI-Beleuchtung; die exakt nicht abschaltbare Mindeststeuerlast ist nicht aufgeteilt. Ein Factory-Power-Contract muss seine konkrete P1-Admission/Throttlingregel offen benennen.

Die Policy benötigt autoritative Simulationszeit bzw. einen expliziten bestätigten deltaTime-Input, keine Date.now-/rAF-Hysterese. Wiederanlauf-/Wartezähler und optionaler Fairnesscursor müssen savefähig sein. D05 legt die konkrete100ms-/Hostbindungsrate separat fest; W03-Math kann eine explizite Deltazeit als Input konsumieren und benötigt keine unabhängige Uhr.

## Quellenprofile und numerische Lücken

| Quelle | Fest in der referenzierten Fixture | Weiter offen / genaue Adaptergrenze |
|---|---|---|
| `FP01-WIND-6KW-A` |2 reale350kg-Packs, je6000W elektrische Nennleistung, D6m, Nabenhöhe ungefähr10m, Startwind3m/s, Ratedwind ungefähr11m/s |Monotone versionierte begrenzte P(v,rho)-Kennlinie bzw. Stützpunkte nicht vollständig vorgegeben; Cut-out24–25m/s und Schutz-Wiederanlauf numerisch offen; Exposition/Integrität/Ausrichtung/Atmosphärengültigkeit ausdrücklich binden |
| Wind-Plausibilität |rho1.2kg/m³ nur isolierte Referenz; beispielhaft Cp=.33,eta=.90 |Die Formel .5*rho*A*v³*Cp*eta ergibt bei7m/s ungefähr1.73kW und bei11 ungefähr6.71kW vor6kW-Cap. Keine allgemeine Hestia-Atmosphäre oder final akzeptierte Kurve daraus erfinden |
| `FP01-SOLAR-2KWP-A` |4 reale80kg-Arrays, je2000Wp DC; Nacht0W; ungefähr10m² wirksame Fläche,4Segmente |Planeirradiance/Orientierung/Sichtabschattung/Zelltemperatur/Regler- und Inverterlimits brauchen versionierte numerische Profile. Rendering-/Shadowmap-/Wolken-Settings sind kein Quellinput |
| `WX-FAV-01` |WindA1800W,WindB1800W,PV1–4 je800W, Summe**6800W** |Momentan-Snapshot, bereits nach gerätespezifischer Umwandlung am Netz; vor optionalen externen Leitungsverlusten. Keine6800W-Wettermindestgarantie und keine zweite zusätzliche Generatorwirkungsgradabwertung |
| Startakku |ein4kWh-Asset,3.6kWh tatsächlicher Start,8000W Grenzen,eta=.95 |Hardwareminimum/.0Standby-Fixturestatus transparent; Quellen- und Storage-ID von demselben installierten C03-Asset |
| Verteiler/Kabel |40kW Verteilkapazität; beispielhaft15kW je frühem Netzstrang; echte Endpunkte/Längen |15kW-Detailprofile und Leitungsverlustklasse nicht vollständig gefreezt; Fixture ohne externe Leitungsverluste ausdrücklich ausweisen, keine Verdopplung bereits netzseitiger Verluste |
| `FP01-BIO-15KW-A` |Optional,0Generatoren aufgebaut am Start;15kW netto,16MJ/kg vorgegebenes trockenes Material,eta=.20;10kg→32MJ elektrisch |Atmosphäre/Oxidationsmittel, Fuel-/Ash-/Abgasbilanz und Mindestlast/Teillastregeln bleiben offen. C06 ist150kg-Kern und kein aufgestellter Brenner/Fuel-Lot. Für W03/W09 keine Biomassevoraussetzung einführen |

FP01§13.9 nennt eine schmale Environmentquery `planetId+frameId+stationPosition+simulationTick→solarIrradiance,windVector,airDensity,quality,sourceRevision`. In den untersuchten aktuellen Produktpfaden wurden keine FP01-EnvironmentPowerQuery/Profile implementiert gefunden. Das ist eine begrenzte Symbol-/Pfadprüfung, keine vollständige Aussage über jedes spätere Konzeptdokument. W03 kann ausdrücklich versionierte feste Fixtureobservations lesen; nicht behaupten, sie seien live Hestia-Klima.

`pending`/`unsupported` darf nicht als sonnig, als tatsächlich Windstille oder als100%-genaue Beobachtung gespeichert werden. Es liefert ohne gültige Admission keine neue bestätigte Quellenergie; validierter Akku/andere bestätigte Quellen dürfen ihren eigenen zulässigen Betrieb fortsetzen. Zeit-/Wetter-/Source-/Netrevision und Epoch müssen zusammenpassen; stale Ergebnis wird abgewiesen, nicht vergangene Arbeit umgebucht.

## Vergleich mit tatsächlichem Ship-Power-Core

| Aktueller Codebeleg | Aktuelles Verhalten | FP01/FP06-Differenz und Konsequenz |
|---|---|---|
| `types.ts:20` POWER_PRIORITIES |Critical/Flight/Safety/Mission/Utility/Comfort |Nicht einfach P0–P3 umbenennen; alter Schiffskern bleibt unverändert. FP01-Powerpolicy braucht einen eng lokalen Factoryallocator |
| `powerAllocation.ts:52` dispatchSource |Verfügbare maxOutputW*availableFraction; Ziel=min(restliche Verbraucherlast,Quellenkapazität), rampgebunden |Kein eigener Batterie-Ladebedarf im Quellziel. Bei steady output und ausreichendem Ramp kann6800W-Potenzial/6600W-Last auf6600W tatsächliche Quellenabgabe gekürzt werden, dadurch kein obligatorischer200W-Ladeüberschuss wie T014. Ladefähigkeit/Source-Dispatch muss Factory-spezifisch passen |
| `powerAllocation.ts:147` allocateBusConsumers |Prioritätsklasse unterversorgt→proportionale Shares mit stable-ID-Floatrest; finalize: unthrottlebare Loads mit Unterdeckung→0/Shed; kein zweiter Allokationspass |Zwei1200W/2000W-Motoren können bei2400W Klassenbudget beide fallen, obwohl ein Motor zulassbar wäre. FP01 erlaubt stattdessen stabile Admissionordnung/zeitliche Slots. Keine Änderung des alten One-pass-Vertrags |
| `battery.ts:55` dischargeShipBatteries |Alle Lasten oberhalbreserve; zusätzliche Reserve nur beiAllowCriticalReserveUse und verbleibendemCriticaldefizit |FP01 P0 und P1 haben separate erlaubte Entnahme bis Hardwareminimum; Ship Safety/Utility sind keine entsprechend definierte P1-Notreserve |
| `battery.ts:103–145` Notentladung |Energiebegrenzung bisstoredEnergy, nächsterSOC=max(0,...); kein Hardwareminimum |FP06-W03 verlangt720000J Minimum, das ShipDefinition/Validator nicht als separates Feld führt. Ein externes UI-Minimum würde den Solver nicht richtig begrenzen |
| `battery.ts:180` chargeShipBatteries |Nur Akku ohne Entladung im selben Schritt laden; Grenzen/Effizienz/Verlustwärme getrennt |Arithmetische Prinzipien kompatibel; tatsächliche T014-Quelle/Reserveeligibilität nicht automatisch kompatibel. Nie parallel zweiter Solver am selbenC03 |
| `types.ts:86`, `validation.ts:258` BatteryDefinition |capacityJ/reserveEnergyJ/maxCharge/Discharge/eta/reservePolicy; Schema geschlossen |Kein neuesfactoryHardwareMinimum-Feld heimlich in die alteAPI ergänzen. Factoryzustand/Policy definieren, alter Decoder/Testgolden erhalten |
| `step.ts:37` evaluateShipPowerThermalStep |Validation→Source/Discharge→eineConsumer-Runde→Charge→Thermal/Cooling/Protection/Events→immutableResult |Eigener Schiff-/Thermal-Kontext; kein World-, Facility-, Factory-/Savehook. Nicht die Thermalstufen als vollständige Fabriksemantik ausgeben |
| `powerAllocation.ts`, `battery.ts`, `types.ts` |Keine zustandsführende Restart-/Wait-/Hysteresepolicy oder Fairnesscursor |T016 benötigt neue lokaleFactorypolicy und deren gefreezte Parameter; Shipreadiness ist kein Runtime-Wiederanlaufbeweis |
| `fixtures.ts` |Numerische Felder komplett callerprovided, keine Balance-Defaults |Keine versteckte akzeptierte FP01-Konfiguration ableiten. Die Factory-Fixtureprofile separat referenzieren und binden |
| `docs/browser-mainline/ship-power-thermal-core-v1.md` |StandaloneCore ausdrücklich nicht liveRuntime/Flight/Resources/UI integriert |Bestehende bestandene Shiptests sind Kompatibilitätsreferenz, kein Factory-PASS und keine verknüpfte Fabrikstromworld |

**Enger Implementierungsvorschlag, keine Freigabe:** Factoryallocator mit P0/P1/P2/P3, eindeutiger stabiler Last-/Source-/Assetidentität und exakt zwei Batterieenergiegrenzen; gewünschter Ladebezug zählt im tatsächlichen Dispatch neben zugelassenen Lasten. Vernünftige Teile der Einheiten-/Validierungs-/arithmetischen Prinzipien wiederverwenden, ohne Shippriority-/Battery-/Source-/Thermalverträge zu ändern. Energie an konkretes consumerId/jobId/Interval/Netrevision zuweisen; W04 arbeitet nur mit diesem bestätigten Grant. Nicht zugeteilte Motorleistung kann keine progressWork erzeugen.

## T013–T016: fachliche Orakel und notwendige Gegenfälle

| Fall | Konkrete Fixture / Goldenergebnis | Beobachtungsgrenze |
|---|---|---|
| **T013** |3500W echteLast über60s vollständig versorgt→**210000J externeArbeit**. Wahlquelle/Batterie undVerluste separat. Sourceonly ohneexterneVerluste:source_actual=load_actual=210000J |Erst tatsächlicheGrantenergie beweistVersorgung; requested/nameplate/UI reichtnicht. MehrRenderframes ohne bestätigteZeit erzeugen0Extraarbeit |
| **T014** |6800W validiertes netzseitigesAngebot,6600W zugelasseneLast,freierAkkuraum,keinezusätzlichenLeitungsverluste→200W Chargeinput. Bei1s:loads6600J,charge_input200J,stored_delta**190J**,charge_loss**10J**; bus_actual6800J |Keineerneute .9Generatorabwertung vonbereitsnetzseitigem WX-FAV. Runningfixture/Restartpolicy trennen; Akkuvoll:200W Potenzial ungenutzt/abgeregelt,keinSOCÜberlauf |
| **T015** |SOCgenau3,600,000J,source0,P2/P3Anfragen→keineBatterieentnahmefürProduktion. P0/P1dürfen nachderenverbindlicherPolicy bis720,000J nutzen. SOCgenauHardwareminimum→battery_output0 |Directsource kann ProduktionbeiReserveweitertragen; Notreserve darfP2nicht durchgemeinsamenPool beliefern; nieSOCauffüllen,negativwerdenoder unterMinimumfallen |
| **T016** |IdentischeQuellen/Lasten/Prioritäten/IDs/Zeit/Events invertauschterInsertionorder→identischeGrants,SOC,Losse,Wartegründe,Hysteresetimer undggf.Cursor; schwankendesAngebot umgefreezteStartgrenze erzeugt deklariertePause/Restartfolgen |2s/500W genaueSemantik istvorGreenGOLDENoffen. WartunginRenderframes undunbegrenztesEin-/Ausschaltflattern sindkeinPASS. Fairnessnurbeanspruchen,wennPolicy tatsächlichzeitlichfairist |

Zusätzliche nötige fachliche Negative: staleNet-/Sourceepoch, unterbrochenerleitenderPfad trotzglobalgenügendQuelle, negativer/NaN/InfinityOffer,8kWPowercap trotzvollemSOC,Output-/WIP-blockierterMotor fordert keinefingierteProduktionsarbeit,ReservekreuzungmitgenauemIntervall,FullSOC-Curtailment,keinepositiveChargeundDischargeam selbenAsset,gleicherBilanzendzustandbei1/10/1000-Intervallteilen mitsourceboundRemainder.

Für zukünftige Tests ist ein500W-Restartboundaryfall erst nachFreeze derFragen oben konkret:bei definiertem Headroom499W keinRestart;bei500W erst zurdefinierten bestätigtenWait-/Phasegrenze. Diese mathematischen Beispiele sind keine jetztakzeptierteProduktpolicy.

## Write-/Readgrenzen und spätere Verifikation

**Möglicher W03-Write erst nach Grant:** `apps/weltraum-browser/src/factory/power/factoryPower.ts`, `sourceAdapter.ts`, `powerReadView.ts`; `tests/unit/factory/power.test.ts`; paket-/runbezogene `evidence/factory/w03/<echter-run-id>/**`. Zentrale `src/factory/contracts.ts` ausschließlich vom einen Integrator. KeineShip-Power-/HVP-/Physics-/Save-/Host-/package-/lock-/UI-/Rendereränderung durchW03-Writer.

**Readset:** gefreezte FP01 §§6–7/13, FP02 §1.1,FP06 §7.3/W03, W00-/W01Quell-/Ownership-/Decisionlocks undKatalog;aktuellerShip-Power-Core/Vertragsdokument/Tests;ClockBindingdefinitionnurlesen. KeineW12–W29ausführen;Biomasse-/Schürferlastbeispiele dürfen pureReferenzdatenbleiben.

NachImplementierung erforderliche fokussierte Befehle laut W03: `npm run test -- tests/unit/factory/power.test.ts`; Kompatibilitätsbrowser `npm run test:e2e -- tests/e2e/ship-power-thermal-core.spec.ts`. Betroffene read-only-Regressionsauswahl: `shipBattery.test.ts`, `shipPowerAllocation.test.ts`, `shipPowerThermalDeterminism.test.ts`, `shipPowerValidation.test.ts` aus `tests/unit`. Keine Tests wurden für diese Analyse ausgeführt. Die spätere Evidence benötigt echte Red-/Greenlogs,Source-/Policyversionen,Resultate und unabhängigenReview; keinePASSübernahme aus historischenReports.

**Noch zu freeze/prüfen, ohne es eigenmächtig anzunehmen:** genaueHysterese/Wiederanlauf- undSame-classAdmissionregel;separateP0/P1Hardwareminimum-Eligibility;Integer-/Remainderprofil;Space-/Clock-/Netrevisionbindung;WIND/SOLARCurve oder ausdrücklich festeEnvironmentfixtures;Leitungsverlust-/Kapazitätsprofile;Standbyverlust;eventuelle lokaleHalteenergie. Diese Lücken blockieren nurjeweilsdieabhängigeProduktbehauptung/Schreibgrenze;vorliegendeAnalyse schafft keinenGrant.
