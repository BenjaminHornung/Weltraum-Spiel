# Rohlager-/Bandboden: separater isolierter Kandidat V5

Status **OWNER_APPROVED_ISOLATED_CANDIDATE**. Ownerantwort: „Diesen exakten V5-Kandidaten freigeben“. Runtimewrites gelten ausschließlich im exakten Integratorgrant `play-01-v5-raw-belt-floor-candidate.json`; dies ist keine endgültige Terrainabnahme. Der Owner-Folgeauftrag verlangt: „Weitere Geometrieänderungen müssen separat als exakter Diff vorliegen.“ V2, V3 und V4 bleiben eigenständige unveränderte Initialversionen.

## Anlass und normaler Aufbau

Das bisherige Rohlagerziel B09 `[-6250,1500,11500]` / Vierteldrehung1 überlappt mit seinem tatsächlichen Body den unveränderlichen Zugang der Wrackfracht. Zugang und Cargo-Collider bleiben erhalten. Der geplante Aufbau verschiebt Rohlager, Cutter und Former jeweils normal um1m westwärts; Sourceprofile, Körpergrößen und 4-m-Portachsen bleiben gleich. Ihre eigenen Füße passen in bestehende Flächen, die beiden anschließenden Bänder treffen jedoch reale Bodenhöhen1,25/2,5/3m. Die frühere Idee isolierter kleiner Fußflächen reicht für Bandkörper und Servicefreiheit nicht.

Vorgesehene normale Bauziele, noch kein Native-/Browser-PASS:

| Anlage | Native Mittelpunkt mm | Vierteldrehung |
| --- | --- | ---: |
| Rohlager B09 | `[-7250,1500,11500]` | 1 |
| Cutter B06 | `[-7250,1500,5000]` | 1 |
| Former B07 | `[-7250,1500,-2500]` | 1 |

Bauen und Playertransport bleiben normale Eingaben. Keine Poseinjektion, Teleports, Colliderverkleinerung, Gratisressourcen oder pauschalen Zugangs-Ausnahmen. Zusätzliche Stromverteiler-/Batterie-/Kabelziele gehören nicht zur Terrainfreigabe; ihre tatsächliche Unterstützung, finite Kosten, Reichweite und LOS bleiben gesondert zu prüfen.

## Exakter zusätzlicher Terrainumfang

Unveränderte Koordinaten: NativeX=N−12,25; NativeZ=12,5−E; Y=Höhe. Baugrid0,25m bleibt getrennt vom HVP-Raster0,125m. Genau zwei neue halb offene Source-E/N-Masken:

| ID | [Emin,Emax,Nmin,Nmax] | neue Fläche | neue125-mm-Spalten |
| --- | --- | ---: | ---: |
| RAW–CUTTER-NORTH | `[2,6,5,5.5]` | 2m² | 128 |
| CUTTER–FORMER-NORTH | `[11,13,5,5.5]` | 1m² | 64 |

**Zusammen3m² und192Spalten.** `[9,11,5,5.5]` ist bereits inV4 enthalten und wird nicht erneut ergänzt oder gezählt. Alle bisherigen21Masken bleiben unverändert. Gesamte initiale Flachbodenunion wäre5880Spalten/91,875m² statt5688/88,875m². Nur in den192 neuen Spalten gilt dieselbe Initialregel Slot1 bis einschließlich yIndex75, Slot0 darüber (Oberkante1,5m). Andere Sourcebytes bleiben exakt gleich. **0mg Material-/Inventargutschrift.**

## Tatsächlicher lesender Census und vollständiger Diff

Genau ein externer read-only Lauf: 2026-10-12T13:51:52.461404Z–13:51:55.080392Z, Node22.23.3, Exit0,2,618728s. Tatsächlicher V4-Sourceheaderdigest`913c0c46`;8.388.608Slots wurden vollständig mit einer unveröffentlichten Kopie verglichen. Keine World-/Native-/Materialkonstruktion oder Runtime-/Headeränderung.

- V4-Rawslot-SHA256: `ea7ccf99cb3ec14f284793664df4535544a76aa7e26a83ff107f98504a1c977d`.
- Kopie-Rawslot-SHA256: `106a3c5ba17e7bb8861d853e1889d71ebf42a686f3d0605d0cb8efabb20c7911`.
- **1246 geänderte Slots** in185 der192Spalten:214Air→Kalkstein,1018Kalkstein→Air und14Soil→Air;0Solidremaps. 7zusätzliche Spalten hatten bereits passende Bytes. Keine Änderung außerhalb der192Spalten.
- Vollständiger [sparser Slotdiff](../play/2026-10-12/proposals/raw-layout-v5/v4-to-proposed-v5-sparse-slot-diff.json):1246Zeilen,29906Bytes, SHA256`31beb508272de396959323ba478200025b4391a247e71e6e3cddf6a21454f3ac`.
- [Census](../play/2026-10-12/proposals/raw-layout-v5/source-census.json):8572Bytes, SHA256`a17bd31087c17ecb61ae16b01dc5cd5c3fe1523ac60408e7d1f05ec0c20491fe`. [Alle192Spalten](../play/2026-10-12/proposals/raw-layout-v5/per-column-census.json), [echte Prozessreceipt](../play/2026-10-12/proposals/raw-layout-v5/01-readonly-v4-to-proposed-v5-census.command.json), Script und komprimierter unveränderter Rawlog liegen daneben.
- Rawstdout1492Bytes/SHA256`b82ed73fd08f5f9badb63dea9e76721877d13def217c03bddfde79c08224730d`.
- Root hat unabhängig Script, Sparsekoordinaten/-indizes, Eindeutigkeit, Übergangszahlen und Artefakthashes gelesen/geprüft. Kein zweiter Source-/Native-/Profilerlauf. Der frühere0,8496sMathprobe besitzt keinen vollständigen gespeicherten Rawstdout; dessen fehlender Hash bleibt ehrlich NOT_REPORTED.

Neuer V5-Runtimeheader/-digest **NOT_IMPLEMENTED**. Der Kopie-SHA ist kein Runtimeheaderdigest. Keine Flora-/Habitat-/Wood-/Collider-Diff-Abnahme durchgeführt; gebundene Vegetationsquellen bleiben unverändert. Eine eventuelle daraus folgende konkrete Flora-Differenz muss separat dokumentiert werden.

## Grenzen und nachgelagerte Gates

Erst nach expliziter Freigabe darf der alleinige Integrator eine neue geschlossene Initialversion als isolierten Runtimekandidaten implementieren. Kein Hot-Replacement oder stilles Saveupgrade bestehender V1–V4/Coastwelten. Source-/Profil-/Savebindung muss die neue Version ausdrücklich erkennen und unbekannte Versionen abweisen. CargoC01–C28, Inventarhistory, Sourceprofile, Player-/Carrier-/Facility-Collider, Budgets (höchstens16Factoryowner inklusiveCargo/Carrier), Terrainzellengröße und alle Zeit-/Queue-/Renderlimits bleiben gleich.

Fachlicher RED→GREEN, Profil-/Bootstrap-/Cargo-/Hostregression, tsc/build sowie tatsächlicher normaler Zugang, Bandfüße, Body-/Service-/Sweepfreiheit, Socketreach/LOS, finite Montage und poweredRaw→Cutter→Former sind **NOT_RUN**. Der Sourcecensus ist kein Gameplay- oder Native-PASS. W09/W10/W11 und finale Terrain-/Art-/UI-/Gameplay-/Hardwareabnahme bleiben offen; menschliche Abnahmen **OWNER_REVIEW_PENDING**. Keine W12–29, Dependencyupgrades, Veröffentlichung oder Mainmerge.
