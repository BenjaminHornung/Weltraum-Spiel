# Separater Startsite-V3-Kandidat: Randreserve

Status: `OWNER_APPROVED_ISOLATED_CANDIDATE; RUNTIME_GRANT_ISSUED; OWNER_REVIEW_PENDING_FOR_FINAL_TERRAIN`. Tatsächliche Ownerantwort: „Diesen V3-Kandidaten freigeben“. Noch keine Runtimeprüfung behauptet. Der neue Folgeauftrag erlaubt ausdrücklich den exakten V2-Kandidaten; diese zusätzliche Geometrie liegt deshalb separat als genauer Diff zur Ownerentscheidung vor. Die endgültige Terrainabnahme bleibt offen.

## Exakter Diff gegenüber V2

Alle 15 ursprünglichen Masken bleiben identisch. Nur diese drei bereits vorhandenen Erweiterungsmasken ändern sich; Grenzen sind halb offen, Einheit Meter im bestehenden E/N-Frame:

| Maske | V2 [Emin,Emax,Nmin,Nmax] | Vorgeschlagener V3-Kandidat |
| --- | --- | --- |
| S1 | [0.75,6,3.25,3.5] | [0.75,6,3.0,3.5] |
| S2 | [8,15.5,3.25,3.5] | [8,15.5,3.0,3.5] |
| S3 | [2,13,4.5,4.75] | [2,13,4.5,5.0] |

Weiterhin Kalkstein-Slot1 bis yIndex75, Luft darüber, 125mm-HVP-Zellen und 250mm-Baugitter separat. 380 zusätzliche adressierte Spalten / 5.9375m²; insgesamt5240 flache Spalten /81.875m². Tatsächlich ändern289Spalten und2492Slots:268Air→Solid,2224Solid→Air,0Materialwechsel. Keine Materialgutschrift(0mg), keine Cargo-/BOM-/Collider-/Foot-/Sweep-/Budgetänderung.

Der gemessene Slotdigest ist `e569c7fd` unter dem vorhandenen V2-Header; eine separate geschlossene Runtime-V3-Profilidentität muss nach Freigabe angelegt und geprüft werden. V2-Digest bleibt `ec8ba9b1`. Vorgeschlagene Slot-SHA256: `267230ca09cf7d8a9fa0d6f6bc2e3fac6cc0cd7adaaf2af57c3c24d60a6187d7`.

## Befund und Grenzen

Normaler Lauf17 schaffte341kgTransport/Depot/Playerexit/Former. Lauf19 blockierte bei tatsächlichem x−8.2429189682m (7.081mm Abweichung), z12.02958393m, südlichem Zieltick11.97958393m mit `CarrierOverlap`. Das ist kein robuster Anfängerweg. Die Änderung verbreitert die betroffenen geraden Ränder; ihre tatsächliche native Steuerreserve ist noch `NOT_RUN`.

Die Batterie hat einen separaten `CarrierSupport`-Befund am Querzugang. Aus den gespeicherten tatsächlichen Native-Samplingkoordinaten liegen10/100Proben im aktuellenSourceprofil nicht auf1.5m; im begrenzten Proposal0/100. Das ist Sourceanalyse, kein neuer nativer Durchlauf und keine vollständige Querwegfreigabe. Weitere Lücken bis zur Batterie bleiben ungeprüft und brauchen gegebenenfalls einen weiteren separaten exakten Diff. Dieser Kandidat wird nicht als fertige W09-Lösung ausgegeben.

Pflanzenplan97/96gültig, derselbe einzige dekorativeBroadleaf-Ausfall wieV2. Beide vorhandenen WoodOwner-Sources/Slots bytegleich. Keine zusätzliche Pflanzen-/Holzentfernung.

## Tatsächliche Berechnung

Ein einziger read-only Scratchcensus, exit0/1.4638s; keine NativeWorld oder Produktwrites. Sparse-Diff34.890Bytes, SHA256 `8a35adf0e084f1d6ed28c7f9e9d50b5b85fedad649ab02f480fb7933b841856e`. Original-Census/Script/argv/time/Rawlog unter dem Integrator-Evidenzlauf `PLAY-01/20261012T082813Z`.

Ownerfreigabe dieses isolierten versionierten Runtimekandidaten ist erteilt und im Grant `play-01-v3-candidate.json` gebunden. Nächster Gate: BusinessRED/GREEN für den separaten geschlossenen Source-/Save-Profilvertrag und normale native Route. UI/Art/C1/Balancinganalyse laufen unabhängig weiter. Endgültige Terrain-, Gameplay- und Art-Abnahmen bleiben `OWNER_REVIEW_PENDING`.
