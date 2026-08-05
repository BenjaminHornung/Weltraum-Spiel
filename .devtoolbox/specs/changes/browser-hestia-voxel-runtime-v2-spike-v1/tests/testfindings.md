# Test Findings: Hestia Voxel Runtime V2 Spike V1

## Status

`NO-GO / REMOTE SNAPSHOT` — the isolated V2 runtime is executable and has
focused/unit, full Node-22, real-Chrome, visual and production-preview evidence.
The user accepted skipping the unavailable final Plannotator review and judged
the result substantially better than prior attempts, but not yet at 1:1 visual
parity with the supplied reference screenshots. The strict frame-time threshold
is also a measured fail; no GO claim is made.

- DevToolbox change: `browser-hestia-voxel-runtime-v2-spike-v1`
- Recovery execution used for all remaining work:
  `0c78a1dfa78a40ba9cac3e7f55461602`
- Unusable initial execution: `e0db265e132744dc98fa6b4c82db4e02`
  (synchronous verification timeout corrupted history; no third execution is
  permitted)
- `specs_validate`: PASS, proposal/design/spec/tasks present and 10 tasks parsed.

## Repository Baseline

- Fresh fetch: 2026-08-05.
- `origin/main` and worktree start SHA:
  `15f3550bd604856b25d40a7ac700ec4d5106b89e`.
- Branch: `experiment/browser-hestia-voxel-runtime-v2-spike-v1`.
- Historical integration evidence:
  `feature/browser-hestia-first-person-combat-integration-v1` at
  `6ab40322c38565f204b9e337caf3ea0391efd33e`, read-only.
- PR #53 `feature/browser-voxel-representation-ladder-v2` remains open,
  unmerged and read-only.
- Original checkout contains unrelated changes; all V2 writes are isolated in
  the dedicated worktree.

## Fresh Pre-Change Evidence

| Check | Runtime | Result | Detail |
|---|---|---:|---|
| `npm ci` | Node 26.2.0 / npm 11.13.0 | PASS | 59 packages; one existing moderate advisory; no lock mutation |
| `npm run build` | Node 26.2.0 | PASS | 165 modules; existing >500 KiB chunk warning |
| `npm run test` | Node 26.2.0 | PASS | 136 files, 1,333 tests, 105.63 s |
| `npm run test:e2e:core` | Node 26.2.0 | BASELINE FAIL | 39 passed; one environment assertion expected Node major 22 |
| focused failed core spec | Node 22.23.2 | PASS | 1/1, proving the failure is unsupported host version rather than V2 |
| live E2E group | Node 22.23.2 | PASS | 14/14, about 2.5 min |
| UI E2E group | Node 22.23.2 | PASS | 12/12, 28.5 s |

The final complete core group still requires a fresh Node-22 run. Tests and
package metadata are not changed to hide the Node-26 mismatch.

## Fresh V2 Domain Evidence

| Check | Result | Detail |
|---|---:|---|
| `npx vitest run tests/unit/voxelV2Domain.test.ts` | PASS | 1 file, 19 tests; signed mapping, palette/signature, deterministic world, ordered edits, halo copies, DDA and authority-only collision |
| `npx tsc -p tsconfig.json --noEmit` | PASS | Fresh after the authority domain slice |
| DevToolbox completion preflight | PASS with advisory | Tasks 2.1 and 2.2 linked to recovery execution and toggled only after fresh evidence; advisory notes no formal `VerificationResults` record |

Authority cells remain privately owned and all derived snapshots are copies.
No historical Surface/Voxel implementation, Three.js or existing WorkerPool is
imported by the V2 domain.

## Fresh V2 Derived/Runtime Evidence

| Check | Result | Detail |
|---|---:|---|
| Focused V2 unit selection | PASS | 6 files / 35 tests: query, authority domain, greedy mesher, scheduler, player controller and recursive import guard |
| `npx tsc -p tsconfig.json --noEmit` | PASS | Includes dynamic route, worker, renderer boundary and E2E types |
| `npm run build` | PASS | 181 modules; V2 worker and route are separate build assets; existing >500 KiB normal-bundle warning remains |
| V2 dev Chromium focused run | PASS | Real Chrome, 1920×1080/DPR1, Ready, movement, pointer lock fire, accepted cut, current mesh convergence, 100 real cut inputs, screenshots, no browser errors |
| V2 production preview telemetry run | PASS as execution; threshold decision below | `vite preview` against built `dist`, installed Chrome 151.0.7922.72, 1920×1080/DPR1; 100 real cut inputs, 96 accepted / 4 rejected outcomes after the focused cut, Ready and mesh convergence, no browser errors |

## Technical Review Disposition

The independent runtime reviewer found no P0. Confirmed P1/P2 issues were
fixed and reverified: empty mesh acceptance, incremental initialization, fixed
step jump latching, per-edit convergence timing, stress outcome assertions,
static TestBridge assignment guard and removal of unused custom-palette
flexibility. Earlier mesher/scheduler findings were also fixed: mesh
authority-revision validation, retry marker clearing, caller-owned halo copies,
stale output byte/timing accounting and strict mesh invariant validation. Fresh
focused verification after those fixes is PASS 35/35. Residual risk is now the
binding production frame threshold and the remaining reference-image parity gap.

## Production Preview Metrics

Evidence: `apps/weltraum-browser/evidence/hestia-voxel-runtime-v2-spike/production-telemetry.json`.

- Machine: Windows (`win32`), Node `v26.2.0` for this preview runner; final
  supported repository E2E still uses portable Node 22.
- Browser: installed Chrome `151.0.7922.72` (UA reports Chromium 149); viewport
  1920×1080, DPR1.
- Warm resident chunks: 129; visible chunks: 129; final vertices 320,152;
  triangles 160,076; final draw calls 198.
- One worker; generation 256 jobs, meshing 247 jobs; final pending/in-flight 0;
  worker failures 0; stale results 0; coalesced jobs 0.
- Final warm/stress frame time: current 16.7 ms, p50 16.7 ms, p95 16.8 ms,
  max 16.9 ms. **Binding frame p95 target ≤16.7 ms: FAIL.**
- Input→hit p95 0.1 ms: PASS; input→authority p95 1.3 ms: PASS;
  input→current-visible-mesh p95 29.0 ms: PASS; mesh upload/adoption p95
  1.1 ms: PASS; remesh chunks/edit p95 2, max 3.
- Warm local-cut Long Tasks delta: 0 and initialization Long Task count/max:
  0/0 after incremental adoption/yielding: PASS.
- Stress: 100 real click inputs, 96 accepted and 4 rejected after the focused
  cut; state Ready, visible mesh revision 97 equals authority revision 97,
  queue empty, no browser errors or permanent pause.
- Fixed PNGs: all five decoded at 1920×1080. SHA-256 values are recorded in the
  same JSON next to each path.

The strict frame p95 failure is not waived or replaced with worker-only timing;
the current decision is **NO-GO / needs frame-pacing redesign** until a fresh
production run meets ≤16.7 ms.

## Final Fresh Verification Matrix

| Command/check | Result | Evidence |
|---|---:|---|
| `npm ci` | PASS | 59 packages installed; existing one moderate advisory; no lock mutation |
| `npm run test` | PASS | 142 files / 1,368 tests |
| `npm run build` | PASS | 181 modules; existing >500 KiB warning only |
| Node-22 core Playwright group | PASS | 40/40, `--retries=0`, one worker |
| Node-22 live Playwright group including V2 token | PASS | 16 passed / 1 intentionally skipped production-only test, `--retries=0`, one worker |
| Node-22 UI Playwright group | PASS | 12/12, `--retries=0`, one worker |
| V2 focused dev E2E | PASS | Two complete no-retry runs; each 2 functional tests passed and production-only test skipped |
| V2 production preview E2E | PASS execution | `vite preview`, Chrome 151, five screenshots, JSON parse, stress assertions; strict frame threshold recorded FAIL |
| Recursive V2 forbidden-import guard | PASS | No legacy Surface/Voxel/WorkerPool/Surface Nets names; Three only in render-three; casted TestBridge fixture rejected |
| Package/lock/Assets/foreign evidence guards | PASS | One V2 E2E group token, no package-lock/Assets drift, historical evidence restored; only V2 evidence remains |
| `specs_validate` | PASS | Proposal/design/spec/tasks present; 10 tasks parsed |

Full Node-22 groups were run after the runtime fixes. Their generated foreign
historical evidence was restored with the explicitly authorized scoped cleanup;
the final production JSON and five V2 PNGs were captured afterward.

## Historical Failure Evidence Driving V2

Historical Surface Play reports recorded mirrored A/D, 10–30 second click
stalls, a permanent movement freeze after tree contact/revision, sinking after
cuts, failed detached-tree contact and 450/739 ms tree hotpath publication.
These are rejection diagnostics, not current V2 reproduction or acceptance.

PR #53 evidence covers pure representation contracts only; it cannot support a
claim about live authority, collision, workers, rendering, streaming, physics
or destruction latency.

## Research Availability

- Voxagon index and Acko's Teardown article were reachable only for bounded
  source claims.
- GitHub repository pages were partially retrievable.
- re-flora license metadata reports GPL-3.0; assets may have separate terms.
  No source or assets are copied/adapted.
- All supplied Reddit bodies, including the blob-like formation post, remain
  `Unavailable` because direct/alternate fetches returned 403/network-policy
  blocks.
- No external performance value is treated as Hestia benchmark evidence.

## Findings Register

| ID | Priority | State | Finding / evidence | Resolution |
|---|---|---|---|---|
| BASE-001 | P2 | ACCEPTED BASELINE | Host Node 26 fails one core spec that explicitly requires Node 22. | Use portable Node 22.23.2 for final E2E; do not modify the assertion. |
| BASE-002 | P2 | ACCEPTED BASELINE | Production build reports the existing >500 KiB chunk warning. | Compare final build; V2 is dynamically gated and must not regress normal startup. |
| BASE-003 | P2 | ACCEPTED BASELINE | `npm ci` reports one moderate advisory. | No audit fix or dependency mutation is in scope. |

No unresolved V2 correctness P0/P1/P2 finding remains. The strict frame-time
threshold remains an acceptance residual and is recorded as NO-GO below.

## Closeout State

- The final Plannotator repository review was unavailable because the isolated
  worktree is outside the active project root; the user explicitly accepted
  skipping that tool-only gate.
- Human visual feedback: substantially better than prior attempts, but not yet
  at 1:1 parity with the supplied reference screenshots.
- A remote branch snapshot was requested so remote agents can continue from the
  measured state. No GO, merge or normal acceptance claim is made.
- DevToolbox task 6.2 remains open for later visual/performance continuation and
  any eventual PR closeout.

## Final Decision

`NO-GO` on the current measured spike because production frame-time p95 is
16.8 ms against the binding ≤16.7 ms threshold, and user review confirms that
the presentation has not yet reached 1:1 reference-image parity. This is a
functional but rejected snapshot for remote continuation; any later PR must stay
clearly marked as failed/incomplete unless a redesign closes both residuals
without waiving the threshold.
