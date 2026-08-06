# Iteration 00 — V2 Baseline Reproduction

## Source

- Commit: `b9ba0e14d897ca2392013c456bd1b88b58934381`.
- Route: `/?voxelV2=1` and production preview `vite preview`.
- Browser: Chrome `151.0.7922.76`, 1920×1080, DPR1.
- Runtime: Node `v26.2.0`, 16 logical cores, 33.8GB reported memory.
- Fresh prerequisite: `npm ci` PASS, 59 packages, existing one moderate audit advisory.
- Production build: `npm run build` PASS, 181 modules, existing >500KiB warning.
- Production E2E: one telemetry test PASS; two development-only tests skipped by
  the production flag. The first attempt without an explicit Chrome path failed
  to launch the bundled headless shell; the rerun with installed Chrome passed.

## Captures

The five fresh production captures are:

- `current-01-coast-lagoon-vista.png`
- `current-02-inland-river-valley-vista.png`
- `current-03-first-person-spawn.png`
- `current-04-before-terrain-cut.png`
- `current-05-after-terrain-cut.png`

The four required current baseline references are also preserved under
`../reference/current/` with their original hashes. This iteration records the
fresh reproduction, while the reference directory remains the historical
baseline comparison source.

## Fresh baseline measurements

| Metric | Warmup | After 100 real cuts |
|---|---:|---:|
| State | `Ready` | `Ready` |
| Visible/resident chunks | 129 / 129 | 129 / 129 |
| Vertices / triangles | 317,548 / 158,774 | 320,156 / 160,078 |
| Draw calls | 207 | 197 |
| Frame p50 / p95 / max | 16.7 / 16.8 / 17.7ms | 16.7 / 16.8 / 16.9ms |
| Generation p95 | 10.0ms | — |
| Meshing p95 | 8.4ms | — |
| Input → hit p95 | — | 0.1ms |
| Input → authority p95 | — | 2.1ms |
| Input → current visible mesh p95 | — | 33.6ms |
| Remesh chunks/edit p95 / max | — | 2 / 3 |
| Long Tasks | 0 / 0ms | 0 / 0ms |
| Accepted / rejected edits | 0 / 0 warmup | 93 / 7 stress delta |
| Final world/visible revision | 0 / 0 | 94 / 94 |
| Pending queue / worker failures | 0 / 0 | 0 / 0 |

Main-thread application update/render-submission duration was **not separately
instrumented by the baseline runtime**; the table therefore reports the
available rAF intervals and Long Task observer honestly rather than deriving an
unsupported app-work claim. This visual-parity change must add that separation
before final budget acceptance.

Full raw telemetry: `production-telemetry.json`.
