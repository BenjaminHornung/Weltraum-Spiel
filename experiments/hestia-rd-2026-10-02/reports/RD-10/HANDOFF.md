# RD-10 Phase 1 — READY_FOR_HEAD_WIRING

Implemented, not just planned. Sole leaf writer, logically HEAD→SO02→RD10;
actual HEAD-launched, no delegation/spawning/fabricated child start.
Coordinator67f98ff4-5df7-4f81-a424-d632dd7bb6ff remained read-only/idle.
ProductIntegrated=false. Candidate full SHA/tree/parent/path hashes are in
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/candidate.json` and the
terminal report. Parent/Phase1 START is
`4788520ef7cecc5db62da8d51f0daaa8ac8bdd09`; START tree
`6df6382bfcd596c464828b7938ad9ac5036aca05`; immutable source
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.

## Real implementation

`src/experiments/renderer-probe/index.ts` exports exactly
`createRendererProbeExperiment: LabExperimentFactory`, plus the task-local
`readProbeReport(canvas)` inspector (the shared mount wrapper intentionally
does not expose handle extensions). The native HTML/main.ts consumes actual
validated F00 inventory/manifest/private payload/scenario imports. Fixture,
variant and controlled60Hz/revision metadata are validated; the rendered
triangle intentionally does **not** depict fixture geometry.

Each backend gets a fresh owned canvas; no canvas context-mode reuse/fallback.
WebGL2 compiles/links and submits/flushed draw; WebGPU awaits real adapter,
device, pipeline and bounded queue completion/error scopes. Absent/null GPU
and rejected init are visible unsupported/failed, not WebGPU success. Timeout,
abort, late device, failed partial allocation, context/device loss and
idempotent async disposal are owned; no new loop/services/persistence.
Report-change events keep native status visible on later context/device loss.
Unknown renderer identity stays unknown even with a reported vendor; software,
fallback and headless are never target-qualified. Limits are caps, not usage.

## Current effect seam — no invented integration

RD03 Three host is still WebGLRenderer-only and facts hardcode RD03. Its effect
context borrows scene/camera/root/current fixture/frame/reset getters,
AbortSignal/capabilities/ownerPose(stableID); **no material, wetness, lighting,
shadow or view channels exist**. RD10 does not modify or pretend to use a new
channel. C0 current control exists; C1 Node/TSL port and C2 real WebGPU renderer
are NOT_IMPLEMENTED. Native probe is none of those profiles.

## Exact HEAD-owned wiring delta (not applied here)

In `src/registration.ts`, import the real factory:

```ts
import { createRendererProbeExperiment } from './experiments/renderer-probe';
```

Add these actual factory registrations after the existing entries:

```ts
Object.freeze({ id: 'RD-10', variantId: 'native-webgl2', scenarioId: 'F00-CONTROL-REPLAY',
  preset: Object.freeze({ id: 'native-webgl2', parameters: Object.freeze({ mode: 'webgl2' }) }),
  create: createRendererProbeExperiment }),
Object.freeze({ id: 'RD-10', variantId: 'native-webgpu', scenarioId: 'F00-CONTROL-REPLAY',
  preset: Object.freeze({ id: 'native-webgpu', parameters: Object.freeze({ mode: 'webgpu' }) }),
  create: createRendererProbeExperiment }),
```

In `vite.config.ts`, `build.rolldownOptions.input`, add:

```ts
rd10: fileURLToPath(new URL('./src/experiments/renderer-probe/index.html', import.meta.url)),
```

That real HTML already imports `./main.ts` and the factory. Its optimized
served URL must be
`http://127.0.0.1:5280/src/experiments/renderer-probe/index.html`, not a generated
report page, RD03 host, dev transform or registry-only success. Do **not** feed
the native modes through RD03's host or reinterpret its backend/RD03 facts.
No package/lock/contract changes are needed for this wiring. No shared file
was edited in this candidate.

HEAD reviews/integrates the actual code and wiring, then supplies **this same
leaf** the actual new START/tree/freeze before Phase2. Phase1 wrapper fixes DEV
classification; Phase2 must deliberately choose optimized strict-loopback
preview, assert built HTML/assets/hashes, preserve new task profiles/output,
and finalize the report against that new freeze. Do not invoke RD03 run-lab.mjs.

## Evidence and profile availability

- [TEST-PROTOCOL.md](TEST-PROTOCOL.md): exact commands, RED/GREEN, earlier retained
  failures, cleanup, scopes and skipped checks.
- [capability-report.json](capability-report.json): final real DEV modes,
  source/test/oracle/log/screenshot bindings, truthful metrics/denominators.
- [comparison-freeze.json](comparison-freeze.json): source-bound C0/C1/C2 axes,
  actual F01/F04/F06 manifests/payloads/revisions/cameras/scenarios/look.
- [source-evidence.json](source-evidence.json):13 bounded official/b3 records;
  Three installed source bytes equal pinned official source.
- [engine-shortlist.md](engine-shortlist.md), [bundle-costs.json](bundle-costs.json):
  concrete API/port/file-cost evidence, not measured rendering performance.

Fresh final focused units14/14, DEV browser4/4 and2/2 real submissions, lab root
and focused types PASS; existing-entry root build PASS, **not RD10 optimized**.
Factory hash `b74bec31f5a21ccee00e325ea12999854e700926d427bf8605bc582b5ec25578`.
Source-evidence hash `5c62010bcc78e838d97107fe32b41a15b57bfbfb2256e946babda05d6945c7a5`;
comparison-freeze hash `af25f55d1501ca24ab87f79d066c372788de603533f5e152aec74b2d44f32e1f`.
18 shared freeze bytes verified before work and during source inspection.
Self-review only; independent/human review NOT_RUN. No qualified benchmark,
target GPU, art, native gameplay, product or performance acceptance.

## Cleanup and remaining gate

Owned browser contexts closed, both managed DEV servers cancelled deliberately,
port5280 free. Evidence/cache/profile/build artifacts safely retained; no foreign
shutdown or deletion. Automatic regular untracked root/Lab throughput files
are preserved unmodified/un-staged; original all-files gate is the accepted
narrow exception, not all-files-clean. Final scoped boundary/source-input/hash
results are in the candidate receipt; only the three RD10 path roots changed.

Optimized browser dimension remains **NOT_RUN_PENDING_WIRING**. Phase2 was
not executed. Missing capability would block only its mode; shared channel/
material/profile integration belongs to HEAD/downstream cards with their own
contracts. No B profiles before HEAD's exact Babylon/RD12 pin; no full
PlayCanvas port or physics solver change is proposed.
