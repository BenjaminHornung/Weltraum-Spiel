# P-PG-SLICE3 — Proving-Ground-Scheibe 3 (G4)

Kein Render-, Physik-, Schema-Anteil. Pure-Core-Kompositions-Scheibe ohne
UI-/Renderänderung, daher JSON-/Markdown-Evidence ohne Screenshots
(AGENTS.md Evidence-Regeln). Keine neue Core-Logik, keine
Persistenz-Schemaänderung, keine Dependencies: ausschließlich
wiederverwendete, auditierte Primitiven (Structural-Serialisierung,
Save-Repository-Besitzsemantik, Worker-Adoption-Gate, Residency-Maschine,
Quality-Presets).

Basis: Fixture PG-TRAGWERK-01 aus Slice 1 (unverändert wiederverwendet),
kanonischer Schnitt wie Slice 1/2 (26 Zellen danach: 24 verankert,
2 abgelöst, Revision 1), Physikplan wie Slice 2 (Spin-Motion,
Fragment 10,546875 kg, COM 2,25/0,6875/0,0625 m).

## K8 — Save/Reload mit atomarem Besitztransfer

- `encodeStructuralObject` → `decodeStructuralObject`: Belegung
  byte-identisch (26 Zellen, Loch erhalten), `objectRevision`,
  `contentHash`, `evidenceHash` und Evidence-Länge identisch;
  Re-Encode ist byte-exakt idempotent.
- Fragment erhalten: Klassifikation auf dem Reload ist kanonisch
  identisch (gleiche Fragments, 1 abgelöst/2 Zellen).
- Bewegung erhalten: gleicher Parent-Motion-Input leitet auf dem Reload
  denselben Transitionsplan ab (gleicher `contentHash`, gleiche
  Body-Velocities); Plan-JSON-Round-Trip erhält Hash + Fragment-IDs.
- Atomar: manipuliertes Dokument wird fail-closed abgewiesen
  (`InvalidContract`), niemals partiell adoptiert; die Authority bleibt
  unangetastet und weiter ableitbar.

## K9 — Residency ohne Wiederauferstehung

- Zyklus `Ready → Evicted → Queued → Loading → Ready` über
  `transitionResidency` (verlassen/evicten/zurückkehren).
- Nach Evict + Rückkehr aus dem Save: Belegung identisch, Fragmente
  identisch, Transitions-`contentHash` identisch, Collider-Anzahl
  identisch, Occupancy-Proof identisch — keine Zelle, kein Collider
  wiederauferstanden, keiner verloren.
- Fernprojektion `{objectRevision, contentHash}` == Authority
  (Revision 1); ein stale Proxy (Revision 0) ist unterscheidbar und wird
  nicht als Truth adoptiert.

## K7 — Asynchronität: Stale-Reject mit Bindung + Adoption-Prüfung

- Worker-Expectation an den Post-Cut-Stand gebunden
  (`inputRevision` = Authority-`objectRevision`).
- Stale Planning-Epoch → `RejectedStalePlanningEpoch`;
  stale Input-Revision (Pre-Cut-Stand) → `RejectedRevisionMismatch`.
- Nur das gebundene, voll validierte Resultat wird adoptiert
  (`Accepted`, Ownership `WorkerToConsumer`).
- Nach beiden Rejects: Authority-Belegung und `contentHash` unverändert —
  kein veraltetes Resultat überschreibt Edits.

## K10 — LOD-Neutralität

- Masse hängt an Dichte × Volumen, nicht an der Collider-Variante:
  Voxel- und Greedy-Volumensumme je Body == Zellzahl × 0,125³ m³.
- Quality-Presets `Low`/`Ultra` (strikt render-seitig) ändern nichts:
  nach jedem Wechsel identische Klassifikation, identische Masse/COM,
  identischer Transitions-`contentHash`, keine neue Evidence, Revision
  und `contentHash` unverändert.

## Quelle

`tests/unit/structuralPgTragwerkSlice3.test.ts` (4 Tests),
Fixture-Helper `tests/unit/pgTragwerkFixture.ts` (unverändert).
Keine Src-Änderung, keine Renderer-/Szenen-Änderung, keine G5-Überlast.
