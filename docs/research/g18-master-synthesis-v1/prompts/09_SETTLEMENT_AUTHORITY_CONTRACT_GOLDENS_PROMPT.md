# Folgeprompt 09: Settlement-Authority-Contract-Goldens

## Zweck

Pruefe die semantischen Settlement-Vertraege ohne Geometriegenerator, Renderer, Economy-Simulation oder NPC-Verhalten.

## Autoritative Eingaben

- G04, G06, G08 und G16 in den in G18 eingefrorenen Fassungen
- `X01_CONTRACT_CROSSWALK_V1.md`
- `MASTER_GDD_V1.md`
- `EDITOR_COMMAND_CONTRACT_V1.md`

## Entry Gate

Beginne nur, wenn der Owner Settlement-Authority, G08 als einzige Economy-Authority, die Population-LOD-Aufloesung und den einen globalen `PlanetEvent`-Log akzeptiert hat.

## Fixierter Scope

- Headless Schemas und Goldens fuer RoadRef, Block, Parcel mit Lineage, BuildingInstance, ServiceConnection und ConstructionState.
- Ein synthetisches Settlement mit 12 Parzellen und wenigen Gebaeuden.
- Referenzen auf Economy- und NPC-IDs nur als externe IDs, ohne fremde Ledgers zu mutieren.

## Auftrag

1. Definiere stabile IDs, Versionen und Ownership fuer jedes Objekt.
2. Erzeuge eine positive Golden-Siedlung und negative Faelle fuer fehlende Frontage, gebrochene Lineage und unzulaessigen State-Uebergang.
3. Belege deterministische Reducer und Receipts fuer genau einen Bauzustandswechsel.
4. Modellieren `80-250` als aktives Detailfenster und `2048` als vorgeschlagene persistente Stadtidentitaeten, nicht als konkurrierende Gesamtlimits.
5. Weise Economy-Werte als abgeleitete, read-only Zusammenfassung aus.

## Verbotener Scope

- Kein Strassenalgorithmus, Mesh, Voxel, Utility-Solver, NPC-AI, Markt, UI oder Produktintegration.
- Kein zweites EconomyLedger und kein separater City-Eventlog.
- Keine Prototype-Screenshots als Contract-Evidence.

## Exit Gate

Erfolgreich nur, wenn jede mutierbare Entitaet genau einer Authority gehoert, die negativen Goldens stabil abgelehnt werden, Economy- und NPC-Grenzen read-only bleiben und der globale Eventlog-Vertrag konsistent ist.

## Stop Gate

Stoppen, wenn G04 Economy mutieren soll, das Populationmodell zwei unvereinbare Gesamtzahlen verlangt, Parcel-Lineage nicht stabil darstellbar ist oder ein eigener City-Eventlog erforderlich scheint.

## Handoff

Nur nach Contract-Review-`ACCEPT` `10_ROAD_BLOCK_PARCEL_GEOMETRY_SPIKE_PROMPT.md` starten.
