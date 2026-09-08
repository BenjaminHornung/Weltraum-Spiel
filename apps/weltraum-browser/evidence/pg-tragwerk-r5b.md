# PG-TRAGWERK-01 R5B Evidence

## Result

- Status: `PASS`
- Normal route `/`, TestBridge absent before and after: `true`
- Harness: `640x360`, DPR `1`, antialias `false`, lighting `None`
- Destruction: `27 -> 26` Zellen, Masse `158.203125 kg`, Mesh `fnv1a64-v1:0f2c00f581a70d46`

## Estimate vs Measurement

`estimatedWork` ist eine Schaetzung (`estimate:9x-occupied-cells`), keine Messung:

| Kennzahl | Wert |
| --- | --- |
| occupiedCells | `26` |
| brickCount | `7` |
| estimatedWork (9x occupiedCells) | `234` |
| measured visitedCells | `26` |
| measured components | `2` |
| measured fragments | `1` |
| measured quads | `23` |
| measured colliders | `3` |
| measured total | `55` |
| classifyMs / meshMs / transitionMs (Dev-Maschine) | `4.5 / 4.5 / 9.399999998509884` |

Timings sind Dev-Maschinen-Beobachtungen (`performance.now()`, finite ms), keine Hardware-Aussagen.

## Render-LOD (echte Renderer-Verzweigung)

- Low: `1` gemergte Box(en), `r5-low-shared`
- High: `2` per-Voxel-Boxen, `r5-high-per-voxel`
- Before/After-Delta: `109` px (`0.0004717797783933518`), max Kanal-Delta `210`
- Low/High-Delta: `4324` px (`0.018715373961218838`), max Kanal-Delta `166`
- Physik-Approximation (Collider-Wahl) und Render-LOD (Geometrie+Material-Projektion) sind getrennte Entscheidungen ueber demselben Plan; Occupancy/Masse/Fragmente/Mesh-Hash sind LOD-uebergreifend gleich.

## Deferred-Vollzug

- Entscheidung: `Deferred`, Completion: `Ready`, Job `pg-r5-deferred-run`
- Anker `24` + Fragmente `2` bilanzieren jede Zelle; dynamisch `2`, Masse `158.203125 kg`.

## Coverage-Bindung

- Regel: `object.pg-tragwerk-01@revision-0+empty-evidence`; ausserhalb fail-closed.

## Screenshots

- `evidence/pg-tragwerk-r5b-before.png`
- `evidence/pg-tragwerk-r5b-after.png`
- `evidence/pg-tragwerk-r5b-lod-low.png`
- `evidence/pg-tragwerk-r5b-lod-high.png`
