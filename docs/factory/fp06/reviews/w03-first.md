# Unabhängiges W03-Review — erster versiegelter Produktkandidat

SPEC_COMPLIANCE: **FAIL**. CODE_QUALITY / CONTRACT_QUALITY: **FAIL**.

Zwei konkrete Vertragsfehler verhindern die technische Freigabe dieses Kandidaten. Bestehende positive Logs werden dadurch nicht zurückdatiert oder als nicht ausgeführt dargestellt. Downstream-Pakete benötigen einen korrigierten, erneut gebundenen Kandidaten und ein enges Folgereview.

## Kandidat und Grenzen

- Implementierer: `/root/fp06_integrator`; Branch `codex/hestia-fp06-integrator-2026-10-11`; Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`.
- Tatsächlicher Git-Parent: `2c044e02f1f31a2db3de3a0df9156bd71a431a7a`; W03 noch nicht committed. Grant/Snapshot nennen zusätzlich `5b596f932dc769052e17603965d0179a4937d948`, den vorherigen W06-Codecommit. Der zwischenliegende W06-Packagingcommit verändert keine W03-Produkte; die finale Provenienz muss den tatsächlichen Parent ausdrücklich binden.
- WRITE HOLD laut Snapshot vom `2026-10-11T11:44:01.489163+00:00`.
- Vollpatch `/workspace/.cloud-setup/fp06-w03-product-working.patch`, SHA256 `0f3cbd17027f4af38044fa984d47f2660736c534f7d0ca81e14743ac9e029e9b`, unabhängig mit dem Snapshot verglichen.
- Exakt vier Produkte, jeweils SHA256 zu Beginn und nach der Prüfung erneut passend:

| Datei | SHA256 | Bytes |
|---|---|---:|
| `apps/weltraum-browser/src/factory/power/factoryPower.ts` | `b2218dafab45cf64e8fc4da10cd9f3478a40b5cb9ce2429f275fb091cba24255` | 19536 |
| `apps/weltraum-browser/src/factory/power/sourceAdapter.ts` | `f0ee09d374a19af6c2c191968867847c77160b0395b00b20d801ec0977550de8` | 8632 |
| `apps/weltraum-browser/src/factory/power/powerReadView.ts` | `0921116600c4a50ba0b6bdcf8f46a2368d9d3ac0717e9cfcb6cd564d298d727a` | 1752 |
| `apps/weltraum-browser/tests/unit/factory/power.test.ts` | `d1a6ce0abc1e5e36965e413ce91bf54284be65bec1fc6172a5d5b20166aeb791` | 22186 |

Reviewer führte keine Tests, Builds, Browserprozesse oder Produktänderungen aus und startete keine Unteragenten. Nur Quellen, Code, bestehende Logs, Gitstatus und Digests wurden gelesen; ausschließlich dieser externe Bericht wurde geschrieben.

## R1 — P1: Arbeit kann am Verteiler oder am fremden Verbraucherport entstehen

**Ort:** `apps/weltraum-browser/src/factory/power/factoryPower.ts:210`, in Verbindung mit Pfadsuche ab Zeile167 und Grant-Publikation Zeile240.

Requestadmission prüft die Portexistenz, aber weder `direction === "in"` noch die Zuordnung des Ports zum angeforderten Verbraucher. Die Pfadsuche erlaubt ein Ziel mit `direction === "both"`.

**Konkreter Trigger, statisch nachgewiesen:** Das unverändert gültige Unit-Supply mit Wind3500W, Verteilerport `bus` (`direction:"both"`, `assetId:"fp02_cargo_c04_unit_1"`) und Cutterport `cut` wird mit Request `{consumerId:"cut", jobId:"job-cut", portId:"bus", priority:"P2", requiredMilliWatt:"3500000", enabled:true}` aufgerufen. Der Pfad Wind→Bus gilt als erreichbar. `draw()` bucht die volle Quelle an diesen Bus, und der Grant lautet `Powered`, Cutterarbeit `350000mJ` pro100ms. Die Stromstrecke zum Cutter wird nicht verwendet. Ein vorhandener fremder `in`-Port mit ausreichend Versorgung funktioniert ebenfalls als fachfremdes Ziel.

**Folge:** Eine korrekt bilanzierte Strommenge wird als Arbeit des falschen Geräts ausgegeben. Die globale Bilanzprüfung der vorhandenen Tests entdeckt diesen Fehler nicht. UI-/Hostadmission bleiben notwendig, ersetzen aber nicht den typisierten Verbraucher-/Portvertrag des pure Planners.

**Quellen:** FP01§6.3 verlangt den aktiven leitenden Pfad zum tatsächlichen Gerät; FP01§13.3 trennt stabile DeviceInstance-Identität, typisierten PowerPort, Bedarf und AllocationReceipt. W03 liefert zugeteilte Arbeit an identifizierte Verbrauchsanfragen. Im aktuellen Requestmodell und seinen Fixtures ist `consumerId` die Verbraucherassetidentität; es existiert keine zusätzliche zugelassene alternative Ownerabbildung.

**Erforderliche Korrektur:** Vor Trial/Grantpublikation Consumerporttyp und Consumer-/Portownerbindung explizit validieren; fremde `in`-Ports sowie Storage-/Distributor-`both`-Ports fachlich negativ prüfen. Für abgelehnte Eingaben bleiben vorheriger Zustand, SOC und Arbeit unverändert. Kein neuer World-State und keine Änderung am alten Schiffskern nötig.

## R2 — P2: Fehlende Quellenbeobachtung erhält fälschlich bestätigte Nullqualität

**Ort:** `apps/weltraum-browser/src/factory/power/sourceAdapter.ts:91` bis95.

Bei einer partiellen bestätigten Beobachtung wird die globale `observation.quality` auf jedes installierte Gerät übertragen, auch wenn für dessen `instanceId` überhaupt kein `values`-Sample vorhanden ist. Fehlendes Sample führt zu `availableMilliWatt:"0"`, gleichzeitig jedoch `quality:"confirmed"`.

**Konkreter Trigger:** Alle zwei C01-/vier C02-Instanzen sind in den tatsächlich validierten Resources-Installationsfixtures enthalten; ein `FIXED-NET-OBSERVATION` mit `quality:"confirmed"` enthält nur den Sample von C01-unit1. C01-unit2 und alle vier C02-Angebote werden als bestätigte0W veröffentlicht, obwohl ihre Beobachtung fehlt. Die Adaptervalidierung erlaubt eine solche partielle Liste ausdrücklich.

**Folge:** Die sichere Nulladmission verhindert Gratisenergie, erklärt fehlende Datengüte aber als bestätigte Nullerzeugung. Damit können spätere Diagnose/Adoption unbekannte Umweltwerte nicht von tatsächlich beobachteter Windstille oder Nullsonne unterscheiden.

**Quellen:** FP01§6.5.3 verlangt `unknown/pending` bei unbekannter Datengüte; §13.9 verbietet aus fehlender Abfrage automatisch Windstille oder100%-Genauigkeit abzuleiten. Die angenommenen Vorgaben gestatten für unbekannte Wind-/PV-Energie0, geben jedoch keine bestätigte Beobachtung aus fehlenden Samples frei.

**Erforderliche Korrektur:** Fehlendes Sample mit explizit unbestätigter Qualität und0W führen oder die unvollständige bestätigte Beobachtung ablehnen. Positiv- und Negativfälle unterscheiden fehlenden Sample und explizit bestätigten0W-Sample. Dies benötigt keine neue Wetterkennlinie oder Ownerzahl.

## Geprüfte positive Vertragsgrenzen

FP01§§6–7 und13 wurden vollständig gelesen, einschließlich der exakten Bus-/Speicherbilanzen; FP02§1.1 und FP06-W03-Karte sowie Energie-Testregister wurden abgeglichen. Das aktuelle Root-Controlplane-D03-Receipt enthält die tatsächliche Antwort „D03-Policy freigeben“: stabile ID je Priorität, erster Start nur Bedarf, Wiederanlauf nach WAIT_POWER mit gemeinsam reserviertem Bedarf+500W über2 bestätigte Sekunden, kein Fairnesscursor.

Der Kandidat bildet14.4MJ Kapazität,12.96MJ durch den vorhandenen Cargo-Initialzustand,3.6MJ Produktionsreserve,720kJ Hardwareminimum, gemeinsame8kW und19/20 je Richtung getrennt ab. SOC und Verluste bleiben kanonische rationale mJ; Dezimallängen werden vor BigIntconversion begrenzt, denominator ist auf die versionierte mW/µs-/Wirkungsgradlattice beschränkt. Kein negativer Akku, automatische SOC-Füllung oder Rundung pro Takt wurde gefunden. Die gemeinsame virtuelle Wiederanlaufreservation wird nicht als verbrauchte Arbeit/Energie gebucht. Teilversorgung wird als Ganzintervalladmission verworfen. Volle Akkus und blockierte/disabled Requests erzeugen keine Gratisarbeit.

Port-/Linkkapazitäten, tatsächliche aktive Pfade, stabile Ordnungen und ein ausdrücklich begrenzter azyklischer Netzvertrag sind sichtbar. Zyklische Netze werden abgewiesen; ein allgemeiner Solver oder allgemeines Leitungverlustmodell wird nicht behauptet. Epoch-/Intervall-/Netz-/Quellenbindungen und volle kanonische Source-/Requestbytes werden mitgeführt; tatsächliche World-Adoption ist ausdrücklich ein nachfolgender atomarer Hostvertrag. W03 besitzt keinen World-/UI-/Renderer-/Workercommitter. Die Sources lesen kanonisch neu validierte bestehende Resources-Snapshots und einzelne endliche Herkunftsinstanzen statt eigener Cargo-Bestände. `WX-FAV-01` bleibt ein fixes busseitiges Beobachtungsfixture, kein live implementiertes Wind-/PV-Klimamodell.

Der alte Schiffskern wurde anhand tatsächlicher `powerAllocation.ts`, `battery.ts` und seines öffentlichen Dokuments verglichen: andere Prioritäten, proportionaler Ein-Pass-Abwurf, Critical-only Reserve und bedarfsorientiertes Source-Dispatch sind kein semantischer Ersatz für die angenommenen Factoryregeln. Der eigene enge Allocator ist daher sachlich gerechtfertigt; der Schiffskern wird nicht verändert.

## Tatsächliche Test-/Evidenceprovenienz

Eigener Run: `apps/weltraum-browser/evidence/factory/w03/2026-10-11T112720.920804Z`.

- `01-business-red.log.raw.gz`:9 fachliche FAIL,1 PASS,10 Fälle; echte erste Allocator-REDs, kein Importfehler.
- `03-source-readview-red.log.raw.gz`:5 FAIL/10 PASS; enthält den später korrigierten Fixturefall und ersetzt keinen fachlichen REDnachweis.
- `04-source-readview-business-red.log.raw.gz`: nach Fixturekorrektur4 tatsächliche FAIL/11 PASS; danach `05-source-readview-green-attempt.log.raw.gz`15/15 PASS.
- `06-review-business-red.log.raw.gz`:2 FAIL/16 PASS; `07-request-bytes-business-red.log.raw.gz`:1 FAIL/18 SKIP; `11-resource-source-bytes-business-red.log.raw.gz`:1 FAIL/19 SKIP. Diese REDs zählen nur für ihre tatsächlich ausgeführten späteren Fachfälle.
- `14-literal-source-focused-green.log.raw.gz`:5 Testdateien,78/78 PASS am11:43:10UTC;21 Factoryfälle und57 unveränderte Shipfälle laut aktuellem Paketumfang. Tatsächlich ausgeführter Befehl: `npm run test -- tests/unit/factory/power.test.ts tests/unit/shipBattery.test.ts tests/unit/shipPowerAllocation.test.ts tests/unit/shipPowerThermalDeterminism.test.ts tests/unit/shipPowerValidation.test.ts`.
- `09-build.log.raw.gz`: tatsächlicher früherer TypeScriptfehler TS2339; als Build-Fail erhalten, kein Business-RED. `15-final-build.log.raw.gz`: `npm run build` mit tsc+Vite tatsächlich erfolgreich; vorhandene Chunkgrößenwarnung ist keine neue Timeout-/Dependencyänderung.
- `16-normal-browser-ship-core.log.raw.gz`: tatsächlicher Chromiumlauf der unveränderten `tests/e2e/ship-power-thermal-core.spec.ts`,1/1 PASS, Test3.6s/Gesamt5.0s. Command nutzt `/workspace/.cloud-setup/fp06-w03.playwright.config.mts`; kein Factory-Gameplay-/Native-Installation-/Wetter-/Save-PASS daraus abgeleitet.

Die vier Produktdigests und der Patch passen zum noch uncommitted tatsächlich geprüften Snapshot. Vollständiger finaler Runmanifest-/Command-/Git-LFS-Checkoutbind und vollständiger Commit-SHA lagen zum Abschluss dieses ersten technischen Reviews noch nicht vor: **NOT_RUN/PENDING**, unabhängig von den tatsächlich gelesenen positiven Logs. Die zwei konkreten Findings sind nicht durch die vorhandenen positiven Tests abgedeckt; hierzu führte der Reviewer keinen neuen Testlauf aus. Performance, neue native Facilityinstallation, Live-Umweltquellen, vollständiger Worldcommit, Combined-Save und Spielerflow sind hier **NOT_RUN**.
