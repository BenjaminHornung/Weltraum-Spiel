# W09 schwere Bootstrapfracht — Sourcepreflight, READONLY

2026-10-11, `/root/fp06_domain`; nur kleine Datei-/Quellenreads und dieser externe Bericht. Keine Tests, Builds, Browser-, Native- oder Profiljobs; keine Produktwrites, Scopefreigabe oder neue Produktannahme. Domain bleibt sauber bei `6929bf2447b72c9f3f8fa3bcae0a59c0691966c0`. Alle Transport-Runtimegates **NOT_RUN**.

## Eingefrorene Ware, keine eingefrorene Universaltraglast

FP02 `HESTIA_FP02_PRODUKTIONSKETTEN_GEBAEUDE_LAYOUTS_DETAILPLAN_2026-10-10.md:399–401` und akzeptierter W01-Katalog `catalog/fp02Catalog.ts:53–55,138–139` führen unverändert **C26 quantity1/180kg/0,80m³, C27 quantity1/300kg/1,40m³, C28 quantity1/450kg/1,80m³**, jeweils serialisierte **Pieces**, kein teilbares mg-Bulk. C28 bleibt optional und keine Voraussetzung für W09. C27 muss als identisches vollständiges Stück zum Former gelangen, nicht in kleinere erfundene Chassisteile zerlegt werden.

Eine allgemeine normative Carry-mass-/volume-/Toolgrenze ist in den geprüften verbindlichen Quellen und akzeptierten W01-Katalogverträgen **nicht eingefroren**. FP01 `HESTIA_FP01_EINSTIEG_ENERGIE_DETAILPLAN_2026-10-10.md:399,411` bindet Baukomfort und Inventargrenzen an tatsächliches Equipment/Kapazitätsprofile, nennt hier keine Zahlen; :403–407 verbietet aus geringerem Baukomfort ein Bauverbot abzuleiten. Daraus folgt keine zusätzliche Hoverpack-/Exoskelett-Mindestvoraussetzung. FP02:437 verbietet schwere Packs in einem Spielerinventar **mit**20kg-Taschenlimit; dieser bedingte Satz ist kein universelles Defaultprofil. Ebenso sind B09s200kg-Lagergrenze (FP02:266) oder W07s4000kg/30m³-ShipCargo keine Spieler-/Carrierkapazität. Weder20kg nochInfinity darf daraus übernommen werden.

## Explizit zulässige schwere Handhabung

- **FP01§5.5:415–417:** vorkonfektioniertes Roll-/Tragegestell, einfacher Karren oder glaubwürdige Montagepalette; kurze einheitliche Aufnahme→legaler Bodenanker→Kabel→Bestätigung genügt. Vollständiger Fahrzeug-/Schwerkrafttransport-Simulator ist keine Voraussetzung; entfernte Frachtteleportation bleibt verboten.
- **FP02§6.1:366, §6.4:438–441:** schwere Pakete über vorhandene Fahr-/Rollgestelle, Montagepaletten/Arbeitskarren; spätere autonome Logistik folgt FP04. Baucommands verwenden nur nachweislich erreichbare Depots, erhalten IDs und erzeugen keine Duplikate.
- **FP02§8.7:771:** Montage-/Rollgestell ausdrücklich auch für die wenigen schweren geborgenen Chassis; kein einzelnes Bolzen-Minispiel erforderlich.
- **FP02§6.2:370,404:** Verpackung/Gestell ist Teil der genannten Packmasse; Equipment außerhalb C01–C28 darf nicht als zusätzliche Fertigungsressource erscheinen. Ein Handlingadapter ist kein kostenloses weiteres Chassis, Werkzeuglos oder Lagerbauprodukt.

Diese Quellen erlauben den Formerbootstrap mit bestehender unterstützter mechanischer Handhabung, ohne Fluidtechnik, Bergbau, neues Fahrzeug oder spätere FP04-Autonomie zu verlangen. Daraus folgt keine zwingende neue Ownerfrage; konkrete technische Carrieradmission und Geometrie brauchen ihren späteren exakten Grant und Review.

## Aktueller tatsächlicher Mechanismus und kleinste Lücke

Rootberichte `w09-cargo-reach-preflight.md`, `w09-cargo-s0-site-preflight.md`, `w09-normal-flow-preflight.md` und die offizielle Kopie meines Normalflowchecks `e4402ed4…` vollständig gelesen. Das heutige W07-Draft liefert nativen festen Cargo-S0 mit Zugriff, LOS/Support und idempotentem Open (`physics/factoryFacilitySession.ts:102–125`). `session/hostPort.ts:4–17` bietet Open/Build/Projection; **keine Pickup-/Carrier-/Depositaufnahme**. `construction/placement.ts:60–68` akzeptiert ausschließlich ursprüngliches `fp02_wreck_cargo` und verlangt gleichzeitig Source≤4m/Service≤3m. Das genügt nicht für den entfernten Former und kleine zugehörige BOMs. Suche in den aktuellen Factory-/Physicsmodulen fand keinen vorhandenen Carryhandler. Beweglicher Snapshot, kein finales W07-Urteil.

Kleinste später aufzunehmende technische Folge: sourcegebundene ausgewählte vollständige Pieces/BOMlose bei echtem Cargozugang atomar in einen **endlichen, jobgebundenen** Handlingcontainer bewegen → bestätigten Nativeplayerweg mit eigener geprüfter Payloadhülle/Coverage/Kollision verfolgen → am tatsächlich legalen lokalen Depotanker atomar ablegen → aus genau diesem erreichbaren Depot bauen. Kapazität/zulässige Payloadliste aus den konkreten unveränderten Sourceitems des begrenzten Auftrags ableiten und exakt rational prüfen; keine allgemeine Rucksackregel oder neues Geschwindigkeits-/Energieprofil erfinden. Packvolumen ist kein Beleg einer Colliderform (FP02:370).

Jede Quelle benötigt eigene Nativepose-/Access-/Containerrevisionen; Playercapsule allein beweist keinen breiten Chassisweg. Gleiche Instance-/Lineage-IDs, einmalige Resourcescustody, Cancel/Stale/Unknown-Hold bleiben erhalten. Kein Source→Fernziel-Klicktransfer, Cargoanker-Umsetzen, Materialcopy oder ownerweiter Inventarscan. Dieser fehlende Host-/Nativevertrag ist technische W09-Arbeit, **nicht bereits implementiert oder freigegeben**.
