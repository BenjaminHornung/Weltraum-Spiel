# P-PG-SLICE1 — Proving-Ground-Scheibe 1 (G1+G2)

Kein Render-, Physik-, Save-Anteil. Pure-Core-Slice ohne UI-/Renderänderung,
daher JSON-Evidence ohne Screenshots (AGENTS.md Evidence-Regeln).

## Fixture PG-TRAGWERK-01

- Terrain-Sockel: Platte y=0, x=0..17, Material 1 (Fels, 1600 kg/m³, nicht
  destruktibel), davon 16 Zellen in Brick x=0 und 2 Zellen in Brick x=16.
- Eine Trägerstruktur: Stütze x=15/y=1..4 (Material 2, Stahl 7800 kg/m³),
  Träger y=5/x=14..18 (x=14..15 Stahl, x=16..18 Material 3, 2700 kg/m³).
- 27 belegte Zellen, 2 Bricks über Chunkgrenze x=16, 2 Anker
  (Sockel + Stützenfuß). Vor dem Schnitt: 1 verankerte Komponente.

## G1 — Kanonischer Schnitt + Naht-Pending

- Spielerkommando `SubtractBox` (global-quantum, min {16,5,0}, max {17,6,1})
  über `applyStructuralDestructionCommand`: `Applied`, selected=1, changed=1,
  nur Brick x=16 betroffen, Revision 0→1, Evidence angehängt,
  Invalidierungen Components/MassProperties/Mesh.
- Schnitt an unbekannter Abdeckung (Box x=32..33, kein Brick): `Rejected`
  mit `MissingBrickCoverage` (Pfad `command/shape`), Objekt unverändert,
  keine Evidence. Der Core kennt kein Pending; Unknown wird fail-closed
  abgewiesen, niemals als Luft erfunden.

## G2 — Komponenten + Massebilanz deterministisch

- Nach dem Schnitt: 2 Komponenten (1 verankert/24 Zellen, 1 abgelöst/2 Zellen),
  1 Fragment. Jede belegte Zelle gehört genau einer Komponente an.
- Zweite Ableitung und zweiter Schnitt auf frischem Fixture liefern identische
  Hashes (Komponenten-JSON, Content-, Result-Hash).
- Masse: 163,4765625 kg → 158,203125 kg; Differenz 5,2734375 kg =
  2700 kg/m³ × 0,125³ m³ (entfernte Zelle). Komponentensumme = Gesamtmasse.
  COM und Trägheit endlich und nachvollziehbar (siehe Summary-JSON).

## Quelle

`tests/unit/structuralPgTragwerkSlice1.test.ts` (5 Tests).
