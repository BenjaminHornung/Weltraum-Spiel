# PG-TRAGWERK-01 R5B Evidence

## Result

- Status: `PASS`
- Normal route `/`; TestBridge absent before and after: `true`
- Deterministic harness: `640x360`, screenshot contract `640x360`, DPR `1`, antialias `false`, lighting `None`
- Destruction: `27 -> 26` Zellen, Masse `158.203125 kg`
- Content: `fnv1a64-v1:8a0c50f4a811382b` -> `fnv1a64-v1:e2e234c9f752d25a`; Mesh `fnv1a64-v1:0f2c00f581a70d46`

## Harness Scope

- Typ: `test-side-harness-slice`
- Produktpfade: `applyStructuralDestructionCommand`, `prepareR5Bounded / StableWorkerJobQueue / completeR5DeferredRun`, `extractStructuralMeshData / describeR5Scene`, `selectR5RenderLodGeometry`
- Harness-only: `test-created PG-TRAGWERK overlay`, `deterministic Three.js canvas projection`
- Explizit nicht behauptet: `normal scene wiring`, `player gameplay state`, `persistence`

## Fix -> Befund -> Test

- **F1 Button-Command:** Der sichtbare Button ruft den Structural-Command auf; E2E klickt den Button und prüft den echten Cut über `lastCut`.
- **F2 Deferred-Bindung:** Job-ID, Target, Revision und Content-Payload werden vor Re-Prepare/Hooks geprüft; R5B-f prüft Fremd-/Stale-Jobs und Hook-Fehler mit Requeue.
- **F3 Coverage:** Vollständige Coverage wird nach Rekonstruktion an den authored Digest gebunden; R5B-d und R5B-g prüfen Fremd-ID, Revision und Same-ID-Fremdinhalt.
- **F4 Deterministische Evidence:** Timings bleiben Laufzeit-Messwerte und werden nicht persistiert; PNG/JSON/Markdown werden nur mit `WELTRAUM_RECORD_EVIDENCE=1` geändert oder byte-identisch bestätigt.
- **F5 Harness-Grenze:** Der Browsergraph importiert das Fixture ausschließlich aus `tests/support`; der Harness dokumentiert echte Produktpfade und testseitige Projektion separat.

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

## Scene und Render-LOD

- Scene-Descriptor: `pg-tragwerk-r5-scene-v1`, Source-Hash `fnv1a64-v1:e2e234c9f752d25a`, Low/High-Quads `23/23`
- Low: `1` gemergte Box(en), `r5-low-shared`
- High: `2` per-Voxel-Boxen, `r5-high-per-voxel`
- Before/After-Delta: `109` px (`0.0004730902777777778`), max Kanal-Delta `210`
- Low/High-Delta: `4324` px (`0.01876736111111111`), max Kanal-Delta `166`
- Physik-Approximation und Render-LOD bleiben getrennte Projektionen desselben Plans.

## Deferred-Vollzug

- Entscheidung: `Deferred`, Completion: `Ready`
- Job: `PgTragwerkR5Deferred`, Target `object.pg-tragwerk-01`, Revision `1`, Input-Hash `fnv1a64-v1:e2e234c9f752d25a`
- Dispatched Job-ID: `pg-r5-deferred:object.pg-tragwerk-01:1:fnv1a64-v1:e2e234c9f752d25a`
- Anker `24` + Fragmente `2` bilanzieren jede Zelle; dynamisch `2`, Masse `158.203125 kg`.

## Coverage-Bindung

- Regel: `object.pg-tragwerk-01@revision-0+empty-evidence`; authored Digest `fnv1a64-v1:17528f827d9344b2`; Bricks `7`.
- Fremde Objekt-ID wird verworfen: `true`; Same-ID-Fremdinhalt: Unit `R5B-g`.

## Screenshots

- Alle vier PNGs: `640x360`.
- `evidence/pg-tragwerk-r5b-before.png`
- `evidence/pg-tragwerk-r5b-after.png`
- `evidence/pg-tragwerk-r5b-lod-low.png`
- `evidence/pg-tragwerk-r5b-lod-high.png`

## Browser Health

- Console errors: `0`; page errors: `0`; request failures: `0`; HTTP errors: `0`
