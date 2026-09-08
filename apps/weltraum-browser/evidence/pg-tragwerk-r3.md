# P-PG-R3 — Echter Physikuebergang in laufender Welt + P1-Schliessung

Kein Render-, Save-, Residency-Anteil. Pure-Core-Scheibe plus Solver-Nachweis
ohne UI-/Renderänderung, daher JSON-/Markdown-Evidence ohne Screenshots
(AGENTS.md Evidence-Regeln).

Basis: Branch `feature/pg-tragwerk-slice1` @ `409035ea`, derselbe Branch/Worktree,
lokal, kein Push. Fixture PG-TRAGWERK-01 aus Slice 1 (unverändert wiederverwendet).

## P1 — Collider und kanonische Masse gebunden (Audit Abschnitt 4)

Befund: `deriveStructuralPhysicsTransition` baute Collider aus
`fragment.occupiedCells`, Masse aus dem Component — ohne Setgleichheit,
ohne paarweise Disjunktheit aller Fragmente, ohne ID-/Hash-/Revisionsbindung.
Audit-Repro (Fragmentzellen durch leere Adressen ersetzt) installierte mit
`disjoint:true, complete:true` bei divergenter Geometrie.

Fix (`src/voxel/structural/physicsTransition.ts`, einzge Produktdatei):

- Fragment und Component muessen dieselbe Objektversion binden
  (`objectId`/`objectRevision`/`sourceContentHash` == Objekt; Authority-Digest
  Fragment == Component), sonst `InvalidStructuralState`.
- Exakte Zellmengenbindung Fragment <-> Component (sortierter Mengenvergleich).
- `fragmentContentHash` und `fragmentId` werden kanonisch nachgerechnet
  (`hashStructuralFragmentContent`, `hashStructuralFragmentId`) und muessen
  mit den uebergebenen Werten uebereinstimmen.
- Exakte Partition per Einzelzaehlung (kein Set): jede behauptete Zelle wird
  gegen die kanonische Brick-Occupancy geprueft (Phantom/veraltet -> Reject),
  jede Doppelbelegung — verankert/Fragment, fragmentintern, zwischen
  Fragmenten — wird rejected (Duplikat -> Reject). Union == Occupancy.
- Verankerte Components werden ebenfalls an Objektversion/Hash gebunden.
- Plan enthaelt neu: `inertiaTensorKgMetersSquared` pro Fragment-Body
  (kanonisch aus den Component-Masseneigenschaften) und im Debris per Satz
  von Steiner verschmolzen; `parentMotionSource: "explicit" | "live-parent-body"`
  belegt die Herkunft der Parentmotion (6. Parameter, Default `"explicit"`,
  abwaertskompatibel — Slice-1..4-Suites unveraendert gruen).

## G3 — Echter Uebergang in laufender Welt (Audit Abschnitt 5)

- Intakte Welt: Parent-Body ueber der VOLLEN Prae-Schnitt-Occupancy (27 Zellen,
  Materialdichten pro Collider), 20 Steps VOR dem Schnitt (Welt laeuft).
- Schnitt ueber den vorgesehenen Structural-Commandpfad
  (`applyStructuralDestructionCommand`, heterogener Schnitt: Stuetzenzelle
  (15,4,0) entfernt -> Traegerzeile x=14..18/y=5 als EIN Fragment aus 2x Stahl
  + 3x Traeger).
- Parentmotion EINDEUTIG bezogen: live aus dem Parent-Body gelesen
  (`linvel`/`angvel`, beide ungleich null), Plan mit Quelle
  `"live-parent-body"`. Kein hartes Omega, keine Einheitsdichte.
- Swap am sicheren Simulationspunkt: Parent-Remove + verankert-statisch (21)
  + Fragment-dynamisch (5) bei Step-Zaehler-Differenz 0 (weder Doppelbelegung
  noch Luecke beobachtbar). Inventar: Bodies 2 -> 3, Collider 28 -> 27.
- Fehlerfaelle: Vorbereitung mit manipuliertem Fragment -> Ablehnung VOR
  Weltberuehrung (Welt laeuft 60 Steps weiter, Inventar identisch); veralteter
  Plan (Revision 1 gegen live Revision 2) -> Commit verweigert, frischer Plan
  ableitbar.
- Heterogene Uebertragung: Masse 46,2890625 kg = (2x7800 + 3x2700) x 0,125^3,
  COM (1,9818037975 / 0,6875 / 0,0625) m, Tensor diagonal
  (0,1205444336 / 1,4212885989 / 1,4212885989) kg m^2 — Solver-Masse relativ
  1e-6, localCom ~ 0, Tensor per Ruecklese-Steiner (Masse+Position jedes
  installierten Colliders aus dem Solver gelesen) alle 6 Komponenten in
  Toleranz. Split-Regel gegen live Motion unabhaengig nachgerechnet.
  Fragment faellt eine Zelle auf den Stuetzenstumpf, kollidiert, schlaeft.

## Collidervergleich ehrlich benannt

BEIDE Varianten sind Cuboid-Zusammenfassungen ueber derselben Occupancy:
Voxel-Cuboid-Compound (ein Cuboid pro Zelle, Materialdichten) vs.
Greedy-Cuboid-Compound (eine Box, massenerhaltende Dichte). KEIN
Voxelshape-Vergleich wird behauptet; KEIN Timing aufgezeichnet oder als
Shapeentscheidung/Budget verwendet (Minifixture). Gleiche Masse (1e-6),
beide schlafen, Ruhe-Y-Differenz < 0,05 m.

## Bekannte Einschraenkung (Residuum, offen dokumentiert)

`RigidBody.principalInertia()` in @dimforge/rapier3d-compat 0.12.0 liefert
fuer Compounds auf der langen Achse (Iy+Iz-Ix, Iy, Iz) statt (Ix, Iy, Iz) —
empirisch charakterisiert (uniforme 5er-Reihe/-Spalte: kurze Achsen exakt,
lange Achse folgt der Kombinationsformel; Einzel-Cuboid exakt). Ob
Solver-intern oder nur Reader-seitig, ist unentschieden; der Reader wird
daher NICHT als Orakel benutzt (Ruecklese-Steiner stattdessen). Verhalten
(Fall/Ruhe/Sleep) und Masse/COM-Transfer sind davon unberuehrt nachgewiesen.
Installationspose ist die Autorpose (kein Pose-Kontinuitaetsmapping auf die
leicht versetzte Parent-Ruhelage) — dokumentiert, kein Kriterium.

## Quelle und Kennzahlen

`tests/unit/structuralPgTragwerkR3.test.ts` (8 Tests), Produktdiff nur
`src/voxel/structural/physicsTransition.ts` (+137/-23).

- Basis-SHA: `409035ea2e9a0395264a5997c688fd3960a82c15`
- Failing-first: Audit-Repro (verschobene Zellen) gegen ungefixten Code
  FAIL (1 failed), nach Fix PASS.
- R3-Datei: 8/8 PASS. Vollsuite: 141 Dateien / 1359 Tests PASS.
  `tsc --noEmit` sauber.
- Live-Transition: 20 Pre-Steps, Swap bei 0 Interim-Steps, Bodies 2 -> 3,
  Collider 28 -> 27 (1 Grund + 21 verankert + 5 Fragment).
- Solver: @dimforge/rapier3d-compat 0.12.0 (transitiv, lockfile-pin,
  kein Manifest-Eingriff; fail-closed bei Wegfall).
- Kein Push (Paketvorgabe).

## Befund -> Fix -> Test-Mapping

| Auditbefund | Fix | Test |
|---|---|---|
| P1 verschobene Zellen (Audit-Repro) | Zellmengen-/Hash-/Revisionsbindung + Phantomprobe | `P1-Repro aus dem Audit` (pre-fix FAIL) |
| P1 doppelte Zellen | Zaehler-Partition statt Set | `doppelte Fragmentzellen` |
| P1 veraltete Zellen | Objektversions-/Hashbindung | `veraltete Klassifikation` + Commit-Fall |
| G3 Plan statt laufender Uebergang | Parent laeuft 20 Steps, Swap bei 0 Interim-Steps, Inventar | `Parent laeuft ... heterogene Uebertragung` |
| G3 Fehlerfaelle Vorbereitung/Commit | Ablehnung vor Weltberuehrung / Revisions-Guard | `Fehlerfall Vorbereitung`, `Fehlerfall Commit` |
| G3 heterogene Masse/COM/Tensor/Parentmotion | Tensor im Plan, live gelesene Motion + Quelle, Ruecklese-Steiner | Live-Test (Masse/COM/Tensor/Split) |
| G3 irrefuehrender Collidervergleich | ehrliche Cuboid-Benennung, kein Timing, keine Dichtek Claims | `Cuboid-Zusammenfassungen im Vergleich` |
| G3 hartes Omega / Einheitsdichte | Motion live gelesen, Materialdichten pro Collider | Live-Test + Vergleich |
