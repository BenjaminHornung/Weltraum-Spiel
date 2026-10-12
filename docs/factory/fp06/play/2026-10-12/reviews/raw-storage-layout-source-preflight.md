# Raw-B09 / Cargo-Access: enger Layout- und Source-Preflight

Stand 2026-10-12, eigene READONLY-Prüfung am Integrator-Worktree. **Der Default-Raw-B09 blockiert den echten Cargo-Access-Cuboid mit seinem Body und einem Fuß.** Native-X −1 m für Raw/B06/B07 (und zweckmäßig Produkt-B09) beseitigt diese konkrete Überschneidung und erhält beide 4-m-Materialstrecken. Auf unverändertem V4 erfüllen die beiden so verschobenen BELT4 jedoch die vorgesehene Source-Bodenhöhe an drei oberen Füßen nicht. Deshalb **kein vollständiger Fixed-V4-Layout-PASS** und kein Native-Clearance-PASS.

Der separat prüfbare Geometrievorschlag ist jetzt exakt **3 m² / 192 neue 125-mm-Spalten**, ausschließlich als unveröffentlichte Kopie: `[2,6,5,5.5]` und `[11,13,5,5.5]` in Source-East/North. Das schon vorhandene V4 `[9,11,5,5.5]` wird nicht erneut gezählt. Owner-Terrainentscheidung und ein Runtime-Writegrant stehen aus. Kein V5-Header und kein Runtime-V5-Digest wurden implementiert oder behauptet.

## 1. Quelle, Frame und echte Cargo-Überschneidung

Actual V4 ist `hvp-factory-startsite-v4`, Digest **913c0c46**, Seed `hestia-factory-layout-a-001`, Registry `c1be281a`. Raster: Native-Origin `[-16,-8,-16]` m, 0.125 m, `256×128×256`; Index `x+256*(y+128*z)`. Sourceframe: **Native-X = North−12.25; Native-Z = 12.5−East; Native-Y = Height**. Das diskutierte „west −1 m“ ist somit Native-X −1 m / Source-North −1 m, kein Source-East-Versatz. q1: `worldX=centerX+localZ`, `worldZ=centerZ−localX`, `worldY=ground+localY`.

Die tatsächlichen maßgeblichen Pfade sind `src/factory/factoryEntry.ts:35–41` (Default-Baupositionen), `src/factory/presentation/factoryAssets.ts` (B09s fünf Originalboxen und BELT4), `src/factory/fixtures/cargoSite.ts` (immutable Cargo-/Accessprofil), `src/factory/construction/installationProfile.ts` (q1/Service-/Supportprofile), `src/factory/construction/placement.ts` (Pure-Air/Support/Actorchecks) und `src/hestia-prototype/physics/factoryFacilitySession.ts` (Native-Cargo-Clearance/Support/LOS). Die aktuellen SHA/Bytebindings dieser Dateien und der ursprünglichen Cutter/Former/Powerkit-JSONs stehen vollständig im Census.

Default Raw-B09: Center `[-6250,1500,11500]` mm, q1. Cargo-Access bleibt `min[-6250,1500,11625]`, `max[-4750,3500,12625]` mm. `cargoClearance()` fragt den **vollen** Cuboid ab; pro Seite zieht es 0.5 mm ab. In Metern ist der abgefragte Innenraum X `[-6.2495,-4.7505]`, Y `[1.5005,3.4995]`, Z `[11.6255,12.6245]`. Der Raw-Fixedbody ist kein ausgeschlossener Cargo-/Player-/Carrierbody oder Sensor.

| Original B09-Part | Tatsächliche Default-Worldbox, m | Positiver Accessschnitt |
|---|---|---|
| body, local center `[0,.875,0]`, size `[2,1.25,2]` | X `[-7.25,-5.25]`, Y `[1.75,3]`, Z `[10.5,12.5]` | **Ja**: Breiten `.9995×1.25×.8745` m |
| support_0, local `[-.75,.125,-.75]` | X `[-7.125,-6.875]`, Y `[1.5,1.75]`, Z `[12.125,12.375]` | Nein, X getrennt |
| support_1, local `[-.75,.125,.75]` | X `[-5.625,-5.375]`, Y `[1.5,1.75]`, Z `[12.125,12.375]` | **Ja**, X/Z vollständig im Accessinneren |
| support_2, local `[.75,.125,-.75]` | X `[-7.125,-6.875]`, Y `[1.5,1.75]`, Z `[10.625,10.875]` | Nein |
| support_3, local `[.75,.125,.75]` | X `[-5.625,-5.375]`, Y `[1.5,1.75]`, Z `[10.625,10.875]` | Nein, Z getrennt |

Dies ist kein bloßer Gesamt-BBox-Befund: Alle fünf unveränderten Cuboids wurden bei q1 statisch einzeln verglichen. X −1 m lässt den Body bei X −6.25 enden; das Accessinneres beginnt bei −6.2495. Alle fünf Parts sind dann getrennt, mit 0.5-mm-Queryabstand am nächsten Bodyrand. Bei 0.25-m-Baupositionen ist −1 m die kleinste reine X-Verschiebung dieser Variante; −0.75 m lässt einen positiven Body-Schnitt. **Keine Rapier-/Native-Abfrage wurde dafür gestartet.**

## 2. Eine konkrete Positionstabelle; unveränderte Profile

Alle Centers in mm, q1, Ground-Y 1500. Dimensions, Supportpatches, Originalparts, SourcePorts, JointSweeps, Cargo und Worldbudgets bleiben gleich.

| Eigentümer | Default-Center | Lesend untersuchter Center | Source E/N danach |
|---|---|---|---|
| Raw B09 | `[-6250,1500,11500]` | `[-7250,1500,11500]` | `1 / 5` |
| Cutter B06 | `[-6250,1500,5000]` | `[-7250,1500,5000]` | `7.5 / 5` |
| Former B07 | `[-6250,1500,-2500]` | `[-7250,1500,-2500]` | `15 / 5` |
| Produkt B09 | `[-6250,1500,-5500]` | `[-7250,1500,-5500]` | `18 / 5` |
| Bench B05 | `[-10250,1500,5500]` | unverändert | `7 / 2` |
| Battery, optional −0.5 m X | `[-2250,1500,2500]` | `[-2750,1500,2500]` | `10 / 9.5` |
| Original B04 Distributor | `[-2250,1500,2000]` | `[-4750,1500,5500]` | `7 / 7.5` |

Raw/Cutter/Former/Produkt: Source-Body-/Foot-/Serviceflächen passen nach X−1 in die bestehende V4-Maskunion. Konkret Raw E0..2/N4..6, Service N6..7; Cutter E6..9/N4..6, normativer Service N6..7; Former E13..17/N3.5..6.5, Service N6.5..7.5; Produkt E17..19/N4..6, Service N6..7. B06 verwendet das echte Profile-Override `[-1.5,0,1]..[1.5,2,2]`, nicht den früheren Source-Servicebeginn bei 1.25. Die B06/B07-Sweeps bleiben innerhalb ihrer abgedeckten Maschinenfläche. Bench Body/Füße E6..8/N1.5..2.5 und Service N2.5..3.5 bleiben getrennt vom verschobenen Cutterbody (Beginn N4). Das ist Mask-/Profilcontainment, keine Abnahme des aktuellen Worlds oder fremder Collider.

B04 bleibt `fp02.device.distribution_40kw`, Originalfootpatches 500×250 mm an local X±.75/Z±.375. Der Default kollidiert mit der Default-Battery; der Root-Beispielplatz `[-4750,1500,7500]` liegt mit Füßen bei E4..6/N7..8 außerhalb der bewiesenen flachen Fläche. Der obige fokussierte Platz E7/N7.5 hat Body/Footfläche E6..8/N7..8 innerhalb des existierenden Cutter-Servicebodens; die kleine frühere Sourceprobe sah 128/128 Höhen 1.5 m, 32 Spalten. Sein **eigener Service E6..8/N8.5..9.5 ist nicht als flacher Boden bewiesen**; erforderliche Air-/Native-Serviceprüfung bleibt offen. Keine zusätzliche Fläche wurde dafür vorgeschlagen. Die optionale Batteryposition hat Body/Füße E9..11/N9..10 innerhalb der vorhandenen V4-/Battery-Korridormasken. Battery50kg ist die Originalbattery; keine Heavy-Umdeklaration oder Profiländerung.

Die beiden unveränderten 4-m-Portpaare lauten:

- Raw OUT `[-7250,2500,10500]` → Cutter IN `[-7250,2500,6500]`; BELT4 Center `[-7250,1500,8500]`, Source E4/N5.
- Cutter OUT `[-7250,2500,3500]` → Former IN `[-7250,2500,-500]`; BELT4 Center `[-7250,1500,1500]`, Source E11/N5.

Beide Belts haben Body-Fußabdruck E2..6 bzw. E9..13, N4.625..5.375; Service N5.375..6.375. Die obere Fußreihe ist N5.25 an E2.25/5.75/9.25/12.75. E9.25 ist bereits V4; die übrigen drei Füße sind die konkrete Lücke.

## 3. Tatsächliche alte Höhen und exakt separater 3-m²-Diff

Native `productionObservation()` sampelt 62.5 mm mit anfänglichem 0.5-mm-Inwardoffset. Für einen 125-mm-BELT4-Patch sind die beiden lokalen Achsenwerte −62 mm und +0.5 mm; bei q1 ergeben sich Source-E/N-Offsets −.062 und +.0005 m. Beispiel E2.25/N5.25 adressiert Native-grid X71/72, Z210/209, nicht einen frei gewählten interpolierten Rasterpunkt.

Aus den **versiegelten V4-Percolumnbytes** des neuen Census ergibt sich:

| Oberer Fuß | Alte V4-Tops der vier echten Rasteradressen | Unpublished Kopie |
|---|---|---|
| E2.25/N5.25 | `3,2.5,3,3` m | viermal 1.5 m |
| E5.75/N5.25 | viermal 1.25 m | viermal 1.5 m |
| E9.25/N5.25 | bestehender V4-Streifen, unverändert 1.5 m | nicht neu gezählt |
| E12.75/N5.25 | viermal 1.25 m | viermal 1.5 m |

Das beweist die Source-Lücke unabhängig von der bloßen Abwesenheit einer Maske. Einzelne 2×2-Footpads würden die höheren Felsen unter Band-/Servicefläche nicht beseitigen: Der erste ältere Sourceprobe zeigte auch 30 nicht-flache Servicecolumns und 91 nicht-flache Body-BBox-Columns. Dessen vollständiges stdout wurde nicht persistiert und vom Tool gekürzt; er ist keine vollständig versiegelte neue Native-Evidence. Die konkret censusierten Bänder decken zusätzlich die ganze jeweilige fehlende Body-/Servicebandbreite ab.

| Neue Source-Maske `[E0,E1,N0,N1]` | Fläche | Exact grid X/Z (half-open) | Spalten geändert / adressiert | Slots `+Air→Solid / −Solid→Air` |
|---|---:|---|---:|---:|
| `[2,6,5,5.5]` | 2 m² | X `[70,74)`, Z `[180,212)` | 121 / 128 | +32 / −1032 |
| `[11,13,5,5.5]` | 1 m² | X `[70,74)`, Z `[124,140)` | 64 / 64 | +182 / 0 |
| **Summe** | **3 m²** | **192 distinct columns** | **185 / 192** | **+214 / −1032** |

Operation ausschließlich auf `V4.copySlots().slice()`: für diese 192 Spalten alle Y0..127 setzen, `slot=1` genau bei `y<=75`, sonst `slot=0`. Top ist damit −8+76×.125=1.5 m. 1.246 tatsächlich unterschiedliche Slots, Transitionen **0→1:214; 1→0:1018; 3→0:14; 0 Solid→Solid-Remaps**. Soil ist der echte Slot3, keine erfundene Sediment-/Flora-Zuordnung. Sieben adressierte Columns waren schon natürlich exakt gleich. Full-8.388.608-Slotvergleich: **0 Änderungen außerhalb der 192 Columns**.

V4-Maskunion bleibt tatsächlich 5.688 Columns / 88.875 m²; die bloß vorgeschlagene Union hätte 5.880 / 91.875 m². Existing `[9,11,5,5.5]` =64 Columns/1 m² ist vollständig ausgeschlossen. **0 mg Ressourcencredit**, keine Mining-, Bau-, Salvage-, Cargo-, World- oder Actoradoption. Der Vorschlag lässt V1/V2/V3/V4-Quellen und Budgets unverändert. Vegetationcode/-source ist nur gehasht und unverändert gelesen; Planner/Habitat/Flora-/Woodcolliderdiff und endgültige Terrainabnahme sind **nicht geprüft**.

## 4. Reproduzierbare Evidence; keine Runtime-V5-Digestbehauptung

Externer OwnRun: `raw-layout-v5-proposal-census-20261012T135152Z/`. Genau eine Sourceconstructor/Censusinvocation nach Cell-/Integrator-CPUfreigabe, Start **13:51:52.461404**, Ende **13:51:55.080392 UTC**, **2.618728004 s**, Exit0, Node22.23.3. Danach Lease direkt zurückgegeben. argv, cwd, Sourcebinding-vor/nach-Prüfung und Script/Wrapperhash stehen im [Commandreceipt](raw-layout-v5-proposal-census-20261012T135152Z/01-readonly-v4-to-proposed-v5-census.command.json). Configfreies Vite-SSR lädt nur startSite→hvpCoastSource→core/hash; kein Serverlistener, Rapier, Nativeworld oder Produktowner.

| Artefakt | Bytes | SHA256 |
|---|---:|---|
| Actual V4 raw slots | 8.388.608 | `ea7ccf99cb3ec14f284793664df4535544a76aa7e26a83ff107f98504a1c977d` |
| Unpublished vorgeschlagene raw slots | 8.388.608 | `106a3c5ba17e7bb8861d853e1889d71ebf42a686f3d0605d0cb8efabb20c7911` |
| [Census](raw-layout-v5-proposal-census-20261012T135152Z/census-output/source-census.json) | 8.572 | `a17bd31087c17ecb61ae16b01dc5cd5c3fe1523ac60408e7d1f05ec0c20491fe` |
| [Alle sparse slotcoords](raw-layout-v5-proposal-census-20261012T135152Z/census-output/v4-to-proposed-v5-sparse-slot-diff.json), `[index,x,y,z,old,new]` | 29.906 | `31beb508272de396959323ba478200025b4391a247e71e6e3cddf6a21454f3ac` |
| [Alle 192 Percolumnfacts](raw-layout-v5-proposal-census-20261012T135152Z/census-output/per-column-census.json) | 79.027 | `1cf768c7f31976b97d2e92aef2c5fe57bd012ac73409dc1bd21251be38414d83` |
| Vollständiges Command-raw, gzip bewahrt | 1.492 uncompressed | `b82ed73fd08f5f9badb63dea9e76721877d13def217c03bddfde79c08224730d` |
| [Censuscode](raw-layout-v5-readonly-census.mjs) | 8.983 | `58b8f5515d227c10fe74ef4472398e9adb1cd8cc43c2685939685d929b6951af` |

Ein zusätzlicher reiner Read der versiegelten JSON/raws prüfte Raw-/Artefakthash und -size, X-fastest gridindex, strikt sortierte sparsecoords, target `y<=75`, Maskcontainment, Transitionen und Percolumn-Summen: [Readreceipt](raw-layout-v5-proposal-census-20261012T135152Z/02-sealed-census-arithmetic-read-receipt.json). Kein Sourcector-/Censusrerun. Der ältere Mathprobe 13:34:05.423–13:34:06.273 UTC, Exit0/.849608135 s, `node --input-type=module`, derselbe app-cwd, bleibt getrennt: voller Rawhash **NOT_REPORTED**. Die damaligen Source-/Profilebindings passen zu den jetzt im Census versiegelten Bytes; fehlender damaliger stdout wird nicht rekonstruiert oder überschrieben.

Die after-RawSHA ist nur der Hash einer Bytekopie. **Kein `createHvpFactorySourceSnapshotV5`, kein neuer Header, kein FNV-Digest unter altem Header, keine Coverage-/Save-/Admissionausweitung.** OriginalC1/5000-ms-Budget bleibt geschlossen.

## 5. Kabel und Playerpunkte: präzise Lücken für den Integrator

Mit optionaler Battery-X−.5 und obigem Original-B04 ergeben die echten q1-SourcePOWER-Offsets folgende Nativeports, mm: Battery `[-2250,2500,2500]`, B06 `[-6375,2625,5750]`, B07 `[-5875,2625,-1750]`, Rawbelt `[-6875,2250,10250]`, Formerbelt `[-6875,2250,3250]`, B04 `[-4250,2500,5500]`. `factorySession.ts` verlangt **ceil(L1/250)×250 mm**, ganzen korrekt deponierten Nativecustodyjob, tatsächliche erreichbare Nativeports und unveränderte Materialadoption.

| Konkrete Verbindung | Raw L1 | Erforderlich | Bestehendes closed Profil |
|---|---:|---:|---|
| Battery→B06 | 7.5 m | 7.5 m | CABLE7500 |
| Battery→B07 | 8 m | 8 m | CABLE8000 |
| Battery→Formerbelt | 5.625 m | 5.75 m | **fehlt** |
| Battery→B04 | 5 m | 5 m | **fehlt** |
| B04→Rawbelt | 7.625 m | 7.75 m | **fehlt** |

Summe34 m, unter dem Original40-m-Stock mit6 m Rest. Der aktuelle Closedkatalog enthält nur 4750/6500/8000/7000/5250/7500; **5750/5000/7750 sind fachliche Profil-Lücken**, keine automatisch zulässigen neuen Caller-sized Carrier. CABLE40 bleibt in Nativecustody unteilbar. Dieser Report implementiert keinen Cablejob und beweist keine versorgte Maschine/16-kg-Produktion.

Konkrete Viertelmeterraster-Playerpunkte für weitere reale Prüfungen, Native-X/Y/Z m; Y2.4 ist nur der Standpunkt für statische Reacharithmetik, kein Positionssnap oder Physicszustand:

- B04/Rawbelt: `[-6.25,2.4,7.5]` =Source E5/N6, Abstand zu beiden Ports jeweils <2.84 m. Conservative Placement-Hull ±.35 m liegt in der ursprünglichen Wegfläche E2..6/N5.5..6.5.
- Battery/B07: `[-4.25,2.4,.5]` =E12/N8, beide <2.84 m; Hull auf vorhandenem V4-Cablestand E11..13/N7.5..8.5.
- Battery/B04: `[-3.75,2.4,3]` =E9.5/N8.5, Portabstände ca1.58/2.55 m; Hull im bestehenden Batterykorridor/V4-Connector.
- Battery/B06: `[-4.75,2.4,3.75]` =E8.75/N7.5, Portabstände ca2.80/2.59 m; Hull innerhalb Cutter-Serviceboden plus vorhandenem V4-Connector.
- Battery/Formerbelt: `[-4.75,2.4,3]` =E9.5/N7.5, Portabstände ca2.55/2.15 m; Hull innerhalb des vorhandenen V4-Connectors E9..11/N6.5..8.5.

Integrator muss pro tatsächlichem Standpunkt nach Adoption lesen: Playerpose/bodymembership und vollständigen Ground-/Hindernis-/Exitpfad; Originalcargo `intact/support/clearance/accessible`; aktuelle owner/profile/source/installation/facility/terrain bindings; beide Portrollen, `confirmed`, `supported`, `accessible`, tatsächliche **3-m-Reach und castRay-LOS**; für jede Maschine/Line `serviceClear`, `sweepClear`, tatsächliche Fußrays und fremde Collider; deponierte Carrierprofile/-menge und unveränderte40-m-Kabelbilanz. Native-Clearance/LOS/Playerroute ist **NOT_RUN**, die komplette B04-Serviceairprüfung **NOT_PROVEN**. Keine finale Terrainabnahme, kein W10-Gate und keine weitere Layout-/V5-Implementation aus diesem Preflight.
