# P-PG-SLICE4 — Proving-Ground-Schlussscheibe (G5 + Bildabnahme)

Kein Render-, Physik-, Save-, Schema-Anteil. Pure-Core-Kompositions-Scheibe
ohne UI-/Renderänderung, daher JSON-/Markdown-Evidence ohne Screenshots
(AGENTS.md Evidence-Regeln). Keine neue Core-Logik, keine
Persistenz-Schemaänderung, keine Dependencies: ausschließlich
wiederverwendete, auditierte Primitiven (Structural-Command-Budgets,
Greedy-Mesher, Physiktransition mit Debris-Fallback, Worker-Result-Gate,
StableWorkerJobQueue mit Starvation-Schranken).

Basis: Fixture PG-TRAGWERK-01 aus Slice 1 (unverändert wiederverwendet),
kanonischer Schnitt wie Slice 1/2/3 (26 Zellen danach: 24 verankert,
2 abgelöst, Revision 1).

## K11 — Überlast: explizite Degradation, niemals stille Löschung

- Befehl (zu enges Besuchs-Budget `maxVisitedCells` 1): `Rejected` /
  `BudgetExceeded` am Pfad `command/budgets/maxVisitedCells`; das Resultat
  traegt Kommando-Bindung, unversehrte Authority (Belegung, `contentHash`)
  und Ledger-Hash — kein partielles Objekt, keine Evidence-Anhaengung.
- Mesh (`maxVisitedCells` 1): `Rejected` / `BudgetExceeded` ohne
  `missingNeighborKey`, kein partielles Produkt; Authority (26 Zellen,
  Hash) unverändert.
- Physiktransition (`maxVoxelsPerFragment` 1 gegen 2-Voxel-Fragment):
  Status `Fallback`, Art `merge-excess-fragments-into-single-debris-body`;
  jede Fragment-ID entweder dynamisch oder im Debris nachweisbar;
  Occupancy-Proof 24 + 2 = 26 (disjunkt, vollständig); Debris-Masse
  10,546875 kg = 2 × 2700 kg/m³ × 0,125³ m³, Summe dynamisch + Debris ==
  Referenzmasse; Fallback-`contentHash` bei gleicher Eingabe
  re-deriviert identisch (prozesslokal; Encode/Decode-Determinismus in
  Slice 3 K8).
- Queue: Kapazität 2, drittes Enqueue → `RejectedQueueFull`; Snapshot
  dokumentiert beide Wartenden; `cancel` gibt den Job explizit zurück und
  schafft den Slot frei (sichtbare Verzögerung, kein Verlust).
- Priorisierung/Starvationgrenze (Urgent/Normal-Szenario): Urgent zuerst,
  aber nach 4 Urgent-Dispatches weicht die Queue aus — der Normal-Job steht
  bei 10-facher Urgent-Flut an Position 5 von 11 (getesteter Prefix; die
  High-Lane-Schranke `nonNormalBurst >= 8` ist in der Queue-Suite gepinnt).
- Result-Gate (reine Entscheidungsfunktion ohne Objekt-Input):
  `cancelled` → `RejectedCancelled`, 4 Bytes gegen Maximum 2
  → `RejectedOverBudget`, alte Planning-Epoch → `RejectedStalePlanningEpoch`
  (G5-Triple-Bestaetigung von K7); Akzeptanz-Kontrolle steht in Slice 3 K7;
  die Fixture bleibt kanonisch (26 Zellen, Hash).

## K12 — Bildabnahme ohne neuen Renderer (bestehende Pfade)

- Harte Zellen auf der Fixture: exakt eine achsenparallele Collider-Box
  pro Zelle, alle Koordinaten auf dem 0,125-m-Raster, Boxvolumen-Summe ==
  Zellzahl × Zellvolumen; das 2-Zellen-Fragment mergt in genau eine
  Greedy-Box (echter Merge-Nachweis).
- Mesher-Vertrag (gleiche Algorithmus-Version): genau 6 Achsen-Faces
  (`-x,+x,-y,+y,-z,+z`), CCW-Ecken, reine Dreiecke (0,1,2)+(0,2,3) als
  Konstanten; echte Normalen aus produziertem Mesh sowie Verbot von
  Material-Crossing sind in `structuralMicrovoxelGreedyMesher.test.ts`
  bewiesen (produziertes Ein-Zell-Mesh; kein Merge über
  Material/Part/Semantik/Damage) und werden hier referenziert, nicht
  dupliziert.
- Kein erfundener Face-Schein: jenseits der Fixture-Abdeckung (Nachbar
  x=-1, Brick-Origin -16) antwortet der Mesher mit
  `MissingNeighborCoverage` statt halluzinierter Geometrie.
- Scope-Grenze (nicht assertiert, keine neue Behauptung): kein AO-Pfad im
  Core — Kanten kommen aus harten Quads ohne Normalen-Mittelung; kein neuer
  Renderer/Shader hinzugefügt.

## Quelle

`tests/unit/structuralPgTragwerkSlice4.test.ts` (6 Tests),
Fixture-Helper `tests/unit/pgTragwerkFixture.ts` (unverändert).
Keine Src-Änderung.
