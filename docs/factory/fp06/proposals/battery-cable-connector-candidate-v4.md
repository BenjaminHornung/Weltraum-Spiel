# Separater Batterie-/Kabelconnector: isolierter Kandidat V4

Status **PROPOSED_UNGRANTED**. Aktuell erlaubter V3-Kandidat bleibt unverändert. Dieser Vorschlag ist keine endgültige Terrainabnahme und kein tatsächlicher Native-/Browser-/LOS-PASS. Freigabegrundlage wäre der explizite Owner-Folgeauftrag: Weitere Geometrieänderungen müssen separat als exakter Diff vorliegen. Dieser vollständige Vorschlag liegt vor; Runtimewrites beginnen erst nach einer genauen zusätzlichen Freigabe.

## Anlass und exakter Umfang

Der lesende [Routenpreflight](/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-01/v3-route-preflight.md) zeigt zwei Lücken zwischen Mainkorridor und Batteriepad. V3 deckt nur die erste zuvor beobachtete Supportstelle ab. Eine weitere schmale Verbindung ermöglicht einen geplanten gemeinsamen 3-m-Kabelstandpunkt zur Formeranlage. Die Angaben sind Source-/Planungsbefunde; ein Spieler muss diese Wege weiterhin normal begehen und Native muss Unterstützung, Hindernisse, Reach und LOS tatsächlich bestätigen.

Unveränderte Metertransformation: NativeX=N−12,25, NativeZ=12,5−E, Y=Höhe. Baugrid0,25m und HVP-Zellen0,125m bleiben getrennt. Die folgenden **drei neuen halb offenen E/N-Masken** werden als neue initiale Version ergänzt:

| ID | Exakte neue Maske [Emin,Emax,Nmin,Nmax] | Fläche | 125-mm-Spalten |
| --- | --- | ---: | ---: |
| BATT-A | `[9,11,5,5.5]` | 1 m² | 64 |
| BATT-B | `[9,11,6.5,8.5]` | 4 m² | 256 |
| CABLE-STAND | `[11,13,7.5,8.5]` | 2 m² | 128 |

Jede dieser 448 zusätzlichen Spalten nutzt ausschließlich die bestehende Initialbodenregel: Slot1 bis einschließlich yIndex75, Slot0 darüber; OberkanteY1,5m. Keine Änderung außerhalb dieser drei Masken. Alle ursprünglichen15 und V2/V3-Bänder bleiben exakt erhalten. Gesamte flache Initialfläche danach 5688Spalten/88,875m² statt5240/81,875m².

## Tatsächlicher vollständiger Slotcensus

Genau ein lesender Offline-Census lief am2026-10-12T10:12:44.285809Z bis10:12:45.866295Z, Node22.23.3, Exit0,1,580659s. Keine Native-/World-/Browser-/Produktmutation; nur eine Kopie der8.388.608Sourcebytes und externe Evidencedateien.

- Basis: aktueller V3-Headerdigest`16dbaa28`; SlotSHA256`267230ca09cf7d8a9fa0d6f6bc2e3fac6cc0cd7adaaf2af57c3c24d60a6187d7`.
- **1164 geänderte Slots** in448Spalten:1058Air→Solid,0Solid→Air,106Solid-Slotremaps nachSlot1. Dies sind initiale Geologiebytes; **0mg Material-/Inventargutschrift**.
- Kandidat-SlotSHA256`ea7ccf99cb3ec14f284793664df4535544a76aa7e26a83ff107f98504a1c977d`.
- Offline-Digest`5190c339` gilt ausschließlich **unter dem alten V3-Header**. Der neue geschlossene Runtimeheader/dessen Digest ist **NOT_IMPLEMENTED**; diese Prüfsnapshotkopie wird niemals als bestehender V3-Nativeworld ausgegeben.
- Alle anderen8MSourcebytes wurden verglichen und sind identisch. Vollständiger [sparser Exaktdiff](../play/2026-10-12/proposals/connector-v4/v3-to-connector-sparse-slot-diff.json):16298Bytes/SHA256`647a9699a58ce784ccbd77b5aff8b121d12ea04addc7f28998630baff155503d`.
- [Census inklusive Per-Mask-Werten](../play/2026-10-12/proposals/connector-v4/source-census.json) und [echte Prozessreceipt](../play/2026-10-12/proposals/connector-v4/command.receipt.json) liegen daneben. Quellhashes blieben während der Messung gleich.

Vegetationsplanner vorher/nachher byte-identisch:97Records, dieselbe eine bereits gebundene ungültige Deko`hvp:flora:bed-52-220`, weiterhin96zulässige Records; keine zusätzliche Ausschlussliste oder neue Pflanze. Unveränderte Plannerrecords und Generatorquellen bleiben Grundlage derselben Woodsource-Initialisierung; eine neue tatsächliche Native-/Wood-/Colliderprüfung wird hier nicht behauptet.

Die100 unveränderten Medium-Carrier-Probenpositionen am geplanten Querwegmittelpunkt hatten inV3 **50**Sourcehöhenabweichungen von1,5m, im Vorschlag **0**. An der alten erstenRun19-Supportstelle hatte schonV3 **0**, beideProfile bleiben dort gleich. Dies sind Sourcecolumnwerte, **keine Native-Rays oder vollständige Wegfreigabe**.

## Kabelstandpunkte und Grenzen

Geplanter Player E9,4/N8,05→Native`[-4.2,2.4,3.1]` liegt im Batterieconnector; statische Entfernungen zu Batterie/Cutter-Sockets sind2.524381/2.907533m. Geplanter Player E11,5/N8→Native`[-4.25,2.4,1]` liegt im neuen schmalen CABLE-STAND; Batterie/Former-Sockets sind2.917190/2.829090m entfernt. Jeder Wert liegt unter dem bestehenden3-m-Limit. NativeSockets, tatsächliche Playerhaltung/Erreichbarkeit, Bodyfreiheit und LOS sind weiterhin zu prüfen; kein Standpunkt wird injiziert.

Die zusätzliche2-m²-Maske schließt den vorgesehenen Standpunkt an die vorhandene Former-Servicefläche an. Sie ist Bestandteil genau dieses7-m²-Kandidaten und darf nicht als mitV3 freigegeben gelten. Die drei vorhandenen endlichen Kabeljobs7m/5,25m/7,5m ergeben19,75m aus40m; Mengen/Rezepte und historische andere Kabelprofile bleiben unverändert.

## Zulässige Umsetzung erst nach Ownerfreigabe

Eigene geschlossene InitialversionV4, ausdrücklich **kein Hot-Replacement oder Save-Migration** vonV1/V2/V3/Coast. Alte Constructorbytes/-semantik bleiben erhalten; unbekannteV5/Profile/Digestmismatches werden abgewiesen. Gemeinsamer W10-Save muss das neue exakte Profil pinnen. CargoC01–C28, Materialbuchungen, Collidergrößen, NativeFootproben, maximal16Factoryowner inklCarrier sowie alle bisherigen Body-/Collider-/Queue-/Zeit-/Renderbudgets unverändert. Kein Gelände-/Holz-/Rig-/Materialbonus, keine Fahrzeuge/Fluidtechnik/W12–29. ErstSourceBusinessRED/GREEN/build und reale normale341-kg-/Batterie-/Kabelroute mit eigener Evidence liefern einen technischen Kandidaten-PASS. Finale Terrain-/Gameplay-/Art-/Hardwareabnahmen bleiben **OWNER_REVIEW_PENDING**.
