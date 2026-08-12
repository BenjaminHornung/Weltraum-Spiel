# Folgeprompt 10: Road-Block-Parcel-Geometrie-Spike

## Zweck

Pruefe ausschliesslich die risikoreiche deterministische Road-, Block- und Parcel-Geometrie aus G16 in einem kleinen isolierten Feld. Dieser Prompt beendet die G18-Folgequeue.

## Autoritative Eingaben

- akzeptierte Settlement-Contract-Goldens aus Folgeprompt 09
- G04 und G16 in den eingefrorenen Fassungen
- `FEATURE_DEPENDENCY_GRAPH.md`
- `TECHNICAL_READINESS_CROSSWALK.md`

## Entry Gate

Beginne nur, wenn lokales Integer-Koordinatensystem, Seed-Ableitung, authored reservations, Feature-Ownership und getrennte Content-/Mesh-Dependency-Revisions akzeptiert sind. Ein isoliertes Spike-Verzeichnis ausserhalb von Produktrepo und Voxel-Lab muss freigegeben sein.

## Fixierter Scope

- Ein lokales Feld von `128 x 128` Einheiten.
- Zwei feste Seeds, eine authored reservation und ein Anschluss-Paar.
- Feature Graph, Road-Referenzlinien, Blocks und Parcels.
- Headless JSON-Ausgabe und optionale diagnostische SVG-Projektion, die niemals Authority ist.

## Auftrag

1. Implementiere stateless Seed-Ableitung und quantisierte lokale Koordinaten.
2. Erzeuge fuer beide Seeds deterministische Road-, Block- und Parcel-Ergebnisse.
3. Erhalte authored reservations und Anschlussbedingungen.
4. Pruefe Topologie, Mindestfrontage, Flaechenvorzeichen, Ueberlappung und stabile Parcel-Lineage.
5. Trenne semantische Content-Revision von abgeleiteter Mesh-/Projektionsrevision.
6. Erzeuge Goldens, Property-Tests und einen Evidence-Index.

## Verbotener Scope

- Kein Planet-Mesh, Cube-Sphere-Streaming, Voxel, Gebaeudegenerator, Utility-Netz, Economy, NPC, Mission, Editor-UI oder Produktintegration.
- Keine G18-/C08-Vermischung.
- Keine visuelle SVG-Uebereinstimmung als alleiniger Korrektheitsbeleg.

## Exit Gate

Erfolgreich nur, wenn beide Seeds byteidentische Wiederholungen liefern, alle Topologie- und Reservation-Invarianten bestehen, Content- und Projektionsrevision getrennt bleiben und ein Reviewer die Evidence mit `ACCEPT` bewertet.

## Stop Gate

Stoppen, wenn numerische Plattformabweichung auftritt, authored reservations verletzt werden, Feature-Ownership ungeklärt ist oder fuer einen Test Voxel-, Economy- oder NPC-Logik benoetigt wird. Nach dem Evidence-Review stoppen. Keine Produktintegration beginnen.

## Abschlussstatus

Setze genau einen Status: `READY_FOR_NEXT_PLANNING`, `REQUIRES_OWNER_DECISION`, `REQUIRES_SPIKE_REVISION`, `INSUFFICIENT_EVIDENCE` oder `NO_GO`. Starte keinen elften Prompt automatisch.
