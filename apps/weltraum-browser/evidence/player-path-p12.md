# P-PROD-P12 Spielerpfad-Slice — Evidence

Spec: `tests/e2e/player-path-p12.spec.ts` auf `/` (startNormalRuntime, ohne Query).

- HUD-Einstieg `#pg-proving-ground-open` oeffnet den engen Dialog `pg-tragwerk-dialog` (Badge "Modus: Proving Ground").
- Genau eine primaere Aktion `pg-tragwerk-destroy` ("Zerstoerung ausloesen") per echtem `locator.click()`.
- Produktivpfad: `dispatchCommand({ type: "DestroyPgTragwerk" })` → `applyStructuralDestructionCommand`
  (kanonischer Schnitt min{16,5,0} max{17,6,1}, actor player.pg-tragwerk-01, source tool.pg-canonical-cut)
  → `encodeStructuralRegionSave`/`decodeStructuralRegionSave`-Roundtrip
  → `commitStructuralPhysicsTransition` im frischen Modus (kein persistierter Vorzustand, Fragmente starten
  aus der Author-Geometrie in Ruhe; Wahl: fresh statt restore, da kein Region-Save-Vorzustand existiert).
- Seed: produktiver Nachbau des authored Fixtures (27 Zellen, volle bekannte Coverage wie
  `createCoveredPgTragwerk01`), keine tests/support-Imports im Produktpfad.
- Ergebnis: Zellen 27→26, Cut Applied, Physik-Receipt (Bodies/Collider/Fragmente) + Save-Hash,
  Authority-/Source-Zeile mit echten Command-/Objektfeldern.
- Blockiert: Zweitklick → RevisionConflict in `#pg-tragwerk-status[role=status]`, kein State-Change.
- `window.TestBridge` auf `/` abwesend (Gate im Spec); Debug-HUD unberuehrt.
- Mutant-Kontrolle: entfernter Destroy-Button → keine Applied-Aussage (rot-nachweisbar).

## Screenshots

- `apps/weltraum-browser/evidence/player-path-p12-before.png`
- `apps/weltraum-browser/evidence/player-path-p12-after.png`
