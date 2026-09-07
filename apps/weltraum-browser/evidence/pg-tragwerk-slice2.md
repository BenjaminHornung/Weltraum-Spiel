# P-PG-SLICE2 — Proving-Ground-Scheibe 2 (G3)

Kein Render-, Save-, Residency-Anteil. Pure-Core-Scheibe plus Solver-Gegenprobe
ohne UI-/Renderänderung, daher JSON-/Markdown-Evidence ohne Screenshots
(AGENTS.md Evidence-Regeln).

Basis: Fixture PG-TRAGWERK-01 aus Slice 1 (unverändert wiederverwendet),
kanonischer Schnitt wie Slice 1 (26 Zellen danach: 24 verankert, 2 abgelöst).

## G3 — Atomarer Physikübergang am Step-Grenzpunkt

- `deriveStructuralPhysicsTransition` (neu: `src/voxel/structural/physicsTransition.ts`):
  alter Rest-Collider (24 verankerte Zellen, statisch) plus neuer Fragment-Body
  (2 Zellen) werden als EIN Plan installiert. Occupancy-Proof: disjunkt und
  vollständig (24 + 2 = 26, keine Doppelbelegung, kein Loch).
- Split ohne Impuls: v_f = v + ω × (c_f − c), exakt nachgerechnet
  (Toleranz 1e-12). Fragmentmasse 10,546875 kg = 2 × 2700 kg/m³ × 0,125³ m³,
  COM (2,25 / 0,6875 / 0,0625) m analytisch bestätigt.
- Masse/COM/Trägheit hängen am Body (Dichte × Volumen), nicht an der
  Collider-Variante: Rapier-Masse stimmt in beiden Welten auf 1e-9 überein.
- Fragmentbudgets (`maxFragments`, `maxCollidersPerFragment`,
  `maxVoxelsPerFragment`) mit semantischem Fallback
  `merge-excess-fragments-into-single-debris-body`: Überzählige Fragmente
  verschmelzen in EINEN expliziten Debris-Body, jede Fragment-ID bleibt
  dynamisch oder im Debris nachweisbar — kein stilles Löschen.

## G3 — Rapier-Gegenprobe (keine Vorentscheidung, Entscheidung per Messung)

Solver: @dimforge/rapier3d-compat 0.12.0 (transitiv über @types/three,
lockfile-pin; kein package.json-/package-lock-Eingriff; fällt der Pin weg,
bricht der Test beim Import fail-closed). Weltaufbau vollständig VOR dem
ersten Step (dt 1/60, Gravitation −9,81 m/s², CCD an, Grundplatte y=0).

| Variante | Collider | Steps bis Sleep | Fall (m) | Rotation (rad) | Ruhe-Y (m) | Sleep |
|---|---|---|---|---|---|---|
| Greedy-Cuboid-Compound | 1 | 170 | 0,6264 | 3,1412 | 0,0611 | true |
| Voxelshape | 2 | 172 | 0,6255 | 3,1402 | 0,0620 | true |

- Beide Varianten: gefallen, rotiert (Anfang ω_z = 2 rad/s plus Kippung über
  Sockelkante), kollidiert (Ruhe auf Sockel Oberkante 0,125 / Grund 0,0),
  geschlafen. Ruhe-Y-Abweichung 0,0009 m < 0,05 m.
- Entscheidung per Messung: **Greedy-Cuboid-Compound** (halbe Colliderzahl,
  identische Masse, identisches Ruheverhalten).

## Quelle

`tests/unit/structuralPgTragwerkSlice2.test.ts` (3 Tests),
Fixture-Helper `tests/unit/pgTragwerkFixture.ts` (Slice-1-Fixture, Slice-1-Datei unverändert).
