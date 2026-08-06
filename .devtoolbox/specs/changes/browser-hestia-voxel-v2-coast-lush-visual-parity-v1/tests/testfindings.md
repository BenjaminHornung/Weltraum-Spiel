# Test Findings: Coast/Lush Visual Parity V1

## Status

`AWAITING_OWNER_VISUAL_APPROVAL` — all 22 supplied PNG candidates and the four
historical baseline images decoded successfully. Six distinct target-role images
are mapped and the strict baseline matrix is recorded. The final technical
candidate is captured in `evidence/hestia-voxel-v2-coast-lush-visual-parity/iteration-23-candidate`.
No owner-approval claim is made yet.

## Repository truth

- Base: `b9ba0e14d897ca2392013c456bd1b88b58934381`.
- Branch: `experiment/browser-hestia-voxel-v2-coast-lush-visual-parity-v1`.
- Worktree: `.worktrees/browser-hestia-voxel-v2-coast-lush-visual-parity-v1`.
- Historical V2 spike change remains unchanged and is rejection/baseline
  evidence only.

## Evidence log

| Check | Result | Evidence | Status |
|---|---:|---|---|
| Supplied reference candidates decode | PASS | 22 PNGs in `docs/Konzeptart/Hestia`; dimensions in `visual-gap-matrix.md` | Phase 0 |
| Six target-role mapping | PASS | `tests/visual-gap-matrix.md`; six selected copies under `evidence/.../reference/target` | Phase 0 |
| Baseline production reproduction | PASS | `evidence/.../iteration-00-baseline/README.md` and `production-telemetry.json` | Phase 0 |
| Macro descriptor and Voxel V2 units | PASS | `npm test`: 147 files / 1397 tests; focused projection/vegetation/region tests 11/11 | Phase 1–3 |
| Final production candidate | PASS | `evidence/.../iteration-23-candidate/manifest.json`; five 1920×1080 PNGs; no browser errors | Phase 4 |
| Production telemetry and stress | PASS | `evidence/.../iteration-08-production-telemetry/production-telemetry.json`; 100/100 accepted cuts, queue 0, thresholds pass | Phase 5 |
| Full verification | PARTIAL | Build, live E2E 17/17, UI E2E 12/12 pass; core E2E 39/40 pass with unrelated Node 26 vs expected Node 22 assertion | Phase 5 |
| Technical review | PASS | Independent focused review: `APPROVE TECHNICALLY`; no Block/High/Medium findings | Phase 5 |
| Owner visual gate | NOT RUN | — | Required |

## Decisions/residuals

- No new second world truth is permitted.
- No package/lockfile/Unity asset change is planned.
- Fresh b9 baseline reproduction: 129 visible chunks, 207 warmup/197 post-cut
  draw calls, 317,548/320,156 vertices, 158,774/160,078 triangles, rAF p95
  16.8ms and cut-to-visible p95 33.6ms after 100 real cuts; Long Tasks 0.
- Baseline main-thread app-work timing was not available from the old runtime;
  the new change must instrument it rather than infer it from rAF intervals.
- The previous baseline's rAF p95 16.8ms and visual rejection remain factual;
  this change may report improved separated app timing but cannot erase the old
  measurement.
- Final production telemetry passes the stated thresholds: rAF p95/p99 16.8ms,
  input→authority and input→visible mesh below their targets, warm local-cut
  Long Task delta 0, 153 resident chunks, roughly 452k logical vertices, and
  no browser errors. The telemetry and parity manifest record the same
  repository content hash; the hash is intentionally evidence-generated rather
  than duplicated here to avoid self-referential status text.
- The final candidate removes the rectangular slab edge in the coastal view and
  adds broader water/vegetation framing in the archipelago and wetland views;
  final 0–5 rubric scores remain intentionally pending owner judgment.
- The focused V2 production run passed twice without retries. One intervening
  run observed a single 33.4ms p99 frame sample; the final rerun passed at
  16.8ms p99. This remains a runtime-environment variance risk, not a waived
  threshold.
- Final status cannot become `GO` without explicit owner screenshot approval.
