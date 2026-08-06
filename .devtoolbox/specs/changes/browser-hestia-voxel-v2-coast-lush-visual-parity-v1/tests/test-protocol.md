# Test Protocol: Coast/Lush Visual Parity V1

## Reference provenance

- Candidate reference directory: `docs/Konzeptart/Hestia` in the source
  checkout. Exact selected filenames, role mapping, dimensions and SHA-256 are
  recorded in `visual-gap-matrix.md` after Phase 0.
- Historical current/rejection baseline: V2 evidence from commit
  `b9ba0e14d897ca2392013c456bd1b88b58934381`.
- Concept art is art-direction input, not runtime acceptance evidence.

## Baseline capture

Build the baseline commit in production preview before source changes. Capture
the four existing baseline views at 1920×1080/DPR1 and record:

- frame current/p50/p95/p99/max;
- main-thread app/update/render-submission p50/p95/p99 where measurable;
- Long Task count/max;
- visible chunks, vertices, triangles and draw calls;
- material/mesh counts;
- initial generation and meshing duration;
- cut input→hit, input→authority and input→current-visible mesh p95;
- worker queue/failure/stale/coalesced counters.

The prior reference values are approximately 129 visible chunks, 160k
triangles, 198 draw calls, zero warm-cut Long Tasks and 29ms cut-to-visible p95.
They remain historical and must not be overwritten.

## Pure/domain verification

- Same seed/version/coordinate produces identical macro descriptor and Near
  quantization; changed seed changes valid content.
- Near/Mid/Far sample agreement and no transition-gap fixtures.
- River/lagoon connects to sea, follows descending source terrain and does not
  intersect dry spawn.
- No perfect circular-island regression; variable terrace spacing/height.
- Material classification responds to height, slope, moisture, curvature and
  water distance.
- Four tree archetypes are connected, branch/root-bearing and non-spherical.
- Deterministic cluster/clearing placement and grouped flora support.
- Render-only flora invalidates after an authority dirty support edit.
- Palette shader mapping exercises material ID, AO, tint, roughness, emissive and
  wetness without creating a material per chunk.
- Existing authority, edit, DDA, collision, mesher, scheduler and player tests
  remain green.

## Browser/visual verification

- Normal `/` and `?surfaceLab=1` route regression remains green; exact V2 query
  gate remains unchanged.
- Focused V2 E2E is run twice with `--retries=0` using real controls/events.
- Production preview at 1920×1080/DPR1 captures fixed Coastal Valley,
  Archipelago/Mountain, Wetland/Root and First-Person views plus before/after
  cut. Beauty captures contain no debug HUD.
- Every candidate/current/target PNG is decoded and dimension-checked; JSON and
  SHA-256 records parse.
- Canonical frusta show no rectangle/void/water-plane edge; Mid/Far products do
  not affect collision or edits; accepted Near cut remains local and
  revision-bound.
- Two equal build/seed/camera captures are stable within documented perceptual
  drift.
- 100 cuts complete without freeze/crash/pause/unbounded queue.

## Performance acceptance

Report both legacy rAF intervals and separated app/main-thread/worker/adoption
timings. Preliminary targets at 1920×1080/DPR1 production preview:

- no Long Task ≥50ms from warm cuts or camera movement;
- app/main-thread work p95 ≤10ms;
- rAF p95 ≤18ms and p99 ≤25ms, with no recurring 33ms idle cadence;
- input→feedback ≤1 displayed frame;
- input→authority ≤16ms;
- input→current visible mesh p95 ≤100ms;
- 100 cuts with no queue growth/freeze/crash;
- Coast beauty draw calls at least 35% below the 198-call baseline, or a
  documented equivalent CPU/GPU improvement.

The original 16.8ms rAF p95 is recorded as baseline evidence and is never
silently rewritten.

## Static/resource guards

- `npm ci`, `npm run build`, `npm run test`, `npm run test:e2e:core`,
  `npm run test:e2e:live`, `npm run test:e2e:ui`.
- `git diff --check`, forbidden legacy/Three-import/TestBridge scan,
  package-lock/Assets guard, JSON/image parse and exact E2E group inventory.
- Repeated renderer regenerate/edit/dispose check shows no resource growth.
- Independent technical review and owner visual gate are mandatory for PASS.
