# P-PG-R5 — Sichtbarer Zielnachweis und begrenzte Last (Schlusspaket)

Kein Render-, Physik-, Save-, Schema-Anteil. Reine Core-Scheibe auf den
auditierten R3/R4-Vertraegen (nur verwendet, nicht umgebaut): Bestands-Mesher-,
Connectivity-, Massen- und Physiktransition-Pfade plus ein additiver R5-Pfad
(Coverage/LOD/begrenzte Vorbereitung/Pruef-Szene). Kein neuer Renderer/Shader,
keine Szene im Produkt, keine Engine-Entscheidung, keine Zielhardwarebudgets.
Alle Arbeits-/Zaehlangaben sind Metriken auf Pruefhardware (Entwicklungsrechner).

Basis: Branch `feature/pg-tragwerk-slice1` @ `497729ff9824492d1b1a0cf13760855a07f8b8cd`
(R3+R4, Reviews ACCEPT), derselbe Branch/Worktree, lokal, kein Push. Fixture
PG-TRAGWERK-01 und kanonischer Schnitt wie Slice 1/4 (27 -> 26 Zellen).

## R5a — Vollstaendige bekannte Coverage erzeugt Mesh (kein Face-Schein)

- Ohne Coverage verweigert der Bestands-Mesher explizit (K12-Bestand, keine
  Halluzination); mit Coverage wird produziert.
- Fehlende Nachbar-Bricks werden dynamisch berechnet (`missingNeighborBrickOrigins`)
  und als leere Bricks (bekannte Aussenluft, keine erfundene Materie) beigelegt:
  2 -> 7 Bricks (5 Luft: -x, -y beidseitig, -z beidseitig — nur flaechenadjazente,
  keine Diagonalen), Occupancy identisch (27 Keys), danach 0 fehlende.
- Ablaufvorgabe: Coverage auf dem ungeschnittenen Objekt (Revision 0) beilegen,
  danach schneiden. Coverage nach einem akzeptierten Edit auf unbedecktem Objekt
  bricht die Evidence-Kette und schlaegt fail-closed fehl (Test belegt).
- Kanonischer Schnitt auf der Coverage-Variante: 26 Zellen, Mesh produziert.
- Vorher: 21 Quads / 84 Vertices; Nachher: 23 Quads / 92 Vertices (eine Zelle
  entfernt legt Nachbar-Faces frei). Bounds identisch
  (min 0/0/0, max 2,375/0,75/0,125 m). Material-Ranges decken alle Indices,
  Materialien 1/2/3, alle Normalen achsenparallel (harte Quads, keine
  Normalen-Mittelung — AO-Pfad existiert im Core nicht, kein AO-Halo).
- Vorher-/Nachher-Produkte als Dateien: `pg-tragwerk-r5-mesh-before.json`,
  `pg-tragwerk-r5-mesh-after.json` (kanonisches JSON, inkl. contentHash).

## R5b — Low/High/LOD-Wechsel wirklich angewendet, Authority unveraendert

- LOD ist reine Projektion aus demselben Transition-Plan
  (`parentMotionSource: "live-parent-body"`, R3-Vertrag):
  low = Greedy-Collider, high = Voxel-Collider, jeweils inkl. Fallback-Debris.
- 2-Zellen-Fragment: low 1 Box (echter Merge), high 2 Boxen — Wechsel messbar
  angewendet. Im Fallback deckt die LOD-Auswahl dynamisch + Debris ab
  (High-Voxel-Anzahl == Fragment-Voxel).
- 2-Zellen-Fragment: low 1 Box (echter Merge), high 2 Boxen — Wechsel messbar
  angewendet.
- Authority-Gleichheit: gleiche Belegung (26 Keys), gleiche Masse, gleiche
  Fragmente (kanonisch re-deriviert identisch), gleiches Mesh-Produkt
  (gleicher contentHash) und gleiche Szene (Mesh-/Source-Hash, Bounds) ueber
  beide LODs.

## R5c — Begrenzte Vorbereitung misst endliche Gesamtarbeit

- Budgets VOR schwerer Ableitung gegen billige Zaehler geprueft
  (`prepareR5Bounded`: occupied + 6*occupied Faces + 2*occupied Collider);
  ungueltige Budgets (NaN/Infinity/-0/negativ/null/undefined) werden fail-closed
  rejected (`r5/budgets/invalid`).
- Vorher-/Nachher-Dateien mit Vergleich-vor-Schreiben: Eine geaenderte
  Implementation kann abgelegte Evidence nicht still regenerieren (Test
  vergleicht erst, schreibt nur bei Erst-Erzeugung).
- Ready-Pfad: 26 Zellen, 7 Bricks, Schaetzung 234 <= Limit 512.
- Erst nach Ready (Schnitt-Budgets steuern den Schnitt selbst, R5-Prep die
  Folgeableitungen): Connectivity + Mesh + Transition; gemessene Gesamtarbeit
  (Zellen + Komponenten + Fragmente + Quads + Collider) <= 512.

## R5d — Ueberlast deferriert/rejected ohne Materieverlust

- Unmoeglich eng (maxOccupiedCells 1): `Rejected` (`r5/budgets/occupied-or-bricks`).
- Knapp (maxTotalWork 10): `Deferred` (`r5/budgets/total-work`) — sichtbare
  Verzoegerung statt Verlust.
- Pending ueber die bestehende `StableWorkerJobQueue` (Kapazitaet 1): das
  deferrierte R5-Arbeitspaket wird mit R5-Nutzlast eingereiht, zweites Enqueue ->
  `RejectedQueueFull`, Snapshot belegt Paket + Nutzlast, Cancel gibt den Slot
  frei, Dispatch liefert aus — nichts faellt still weg.
- Authority nach beiden Entscheidungen unveraendert (26 Keys, contentHash).

## R5e — Groesserer Fallback-Fall (>2 Fragmentzellen, mehrere Fragmente)

- Zweiter Schnitt (Stuetzensegment 15,2..3,0) nach dem kanonischen Schnitt:
  24 Zellen, >= 2 Fragmente, > 2 Fragment-Voxel (Oberteil + abgeloeste
  Traeger-Restzellen).
- Referenz mit grosszuegigem Budget: `Installed`; Ueberlast (maxFragments 1):
  `Fallback` (`merge-excess-fragments-into-single-debris-body`).
- Bilanz: jede Fragment-ID dynamisch oder im Debris; Occupancy-Proof disjunkt +
  vollstaendig; dynamisch + Debris = Fragment-Voxel; Masse dynamisch + Debris ==
  Referenzmasse (12 Nachkommastellen); Debris-Masse == Overflow-Fragmentmasse;
  Re-Derivation hash-identisch (prozesslokal).

## R5f — Pruef-Szene deterministisch (Material/Licht/Komposition)

- `describeR5Scene`: Materialien 1/2/3 mit Dichten + struktureller Klasse +
  Pruef-Farben (Terrain #8a7f6a, Stahl #7d8ea3, Traeger #c2a15a, roughness 0,85),
  Licht fix (Key 2,5 / Fill 0,8 / Ambient 0,4), Kamera deterministisch aus Bounds,
  Bounds + Quad-Anzahl aus dem Mesh-Produkt. Gleiche Eingabe -> gleiche Szene.
  Fail-closed: fremdes/veraltetes Mesh (Hash-/Revisions-Mismatch) und unbekannte
  LOD-Stufen werden in Selektor UND Szene abgewiesen statt still zu komponieren.
- Debris-Budgetflagge konkret belegt (Budget 16, kleine Boxenzahl -> false);
  die LOD-Auswahl deckt dynamisch + Debris ab.
- Spielerpfad-Anker lesbar: `anchor.pg-sockel`, `anchor.pg-stuetzenfuss`.
- Kein Live-Solver in R5 (Plan-/Mesh-/Budget-Scheibe); laufender Uebergang mit
  Solver bleibt durch R3 bewiesen und wird hier nicht neu behauptet.

## Quelle und Kennzahlen

- Neu: `src/voxel/structural/provingGroundR5.ts` (Coverage/LOD/Prep/Szene),
  `src/voxel/structural/index.ts` (1 Export-Zeile),
  `tests/unit/structuralPgTragwerkR5.test.ts` (7 Tests).
- Dateien: `evidence/pg-tragwerk-r5-mesh-before.json` (21 Quads),
  `evidence/pg-tragwerk-r5-mesh-after.json` (23 Quads).
- Basis-SHA: `497729ff9824492d1b1a0cf13760855a07f8b8cd`
- R5-Datei: 7/7 PASS. Vollsuite: 143 Dateien / 1370 Tests PASS. `tsc --noEmit` sauber.
- Kein Push (Paketvorgabe).

## Befund -> Fix -> Test-Mapping

| Auditbefund (Abschnitt 8 R5 / G5 / K12) | Fix/Umsetzung | Test |
|---|---|---|
| Fixture mit vollstaendiger bekannter Coverage renderbar | Fehlende Nachbar-Bricks berechnet + als leere Luft beigelegt; Mesh produziert | R5a (Reject-vorher, Coverage-, Mesh-, Datei-Assertions) |
| Bedienbare Szene mit Material/Licht; Geometrie/Material/Licht/Vorher-Nachher pruefen | Deterministische Pruef-Szene aus Mesh + Authority; Vorher-/Nachher-Dateien | R5a + R5f (Normalen-, Ranges-, Bounds-, Szenen-Assertions) |
| Low/High/LOD-Wechsel wirklich anwenden; Authority-Gleichheit | LOD waehlt Greedy-/Voxel-Collider desselben Plans; Gleichheit gemessen | R5b (Collider-Anzahlen, Hash-/Belegungs-/Massen-Gleichheit) |
| Collider-/Connectivity-/Queuearbeit begrenzen; Gesamtarbeit endlich | Vorbereitung mit billigen Zaehlern + Limit; Messung nach Ready | R5c (Ready-Schaetzung 234/512, Messung <= 512) |
| Ueberlast explizit deferieren/zurueckweisen ohne Materieverlust | Rejected/Deferred vor Ableitung + ungueltige Budgets fail-closed; Pending-Queue mit R5-Nutzlast ohne Verlust | R5d + R5d2 (Reject-/Defer-/Invalid-Kinds, Queue-, Authority-Assertions) |
| Fallback-Budget mit mehr als 2 Fragmentzellen testen | Zweischnitt-Szenario (>= 2 Fragmente, > 2 Voxel), Fallback-Bilanz | R5e (Fragment-, Occupancy-, Massen-, Determinismus-Assertions) |
| Budgets VOR Produktaufbau pruefen (G5) | `prepareR5Bounded` laeuft vor Connectivity/Mesh/Transition | R5c + R5d (Reihenfolge-, Nichtberuehrungs-Belege) |
| Coverage-Reject ist keine Bildabnahme (K12) | Produziertes Mesh aus voller Abdeckung + Dateien statt Reject | R5a (Produced- statt Reject-Assertions + Dateien) |
