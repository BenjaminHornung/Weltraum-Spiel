# ExecPlan: RD-03 code-phase control and replay

## Goal
Deliver real Three/WebGL2 projection, deterministic snapshot replay, a single
Three-only host, CLI and runnable tests; commit locally as READY_FOR_HEAD_WIRING.
Optimized browser/lifecycle/image acceptance is phase 2, not this phase's claim.

## Context
Immutable start `16faf55a9782fb12d2f30df4547a619957792089`, accepted RD00/01/02,
18 verified shared files and inventory `26bf86bb…`. Frozen contracts and section D
own data/lifecycle. HEAD owns multi-entry build, exports, registration and scripts.

## Non-goals
No product/World/physics/save bootstrap, dependency changes, art/performance
acceptance, publication, shared-file edits, delegation or GPU lease inference.

## Architecture decision
Use native Three BufferGeometry/material groups and private Float32 projections.
One host owns renderer/scene/camera/renderloop and stages detached effect roots;
source replacement constructs all candidates privately before atomic adoption.
Effects borrow current frame/fixture/owner poses and never create renderers/loops.
Replay awaits selected snapshot adoption then supplies resetTick outside the
frozen LabFrameInput. Reset/seek reconstruct presentation, not native actions.
Import bounded pinned inventory/manifest/payloads through existing validators.

## Implementation phases
1. Verify immutable inputs/install exact locked lab dependencies (complete).
2. Write RUN01–04 and negative/import/projection tests; retain missing-code RED
   source and logs under the exclusive external RD-03 run root.
3. Implement importer, host/control, replay UI and inspect/evidence/bench CLI.
4. Fresh focused units, types, inspect, baseline root build, boundary,
   whitespace/self-diff review; commit exact allowed paths only.
5. HEAD wires actual multi-entry build. Phase-2 snapshot/browser acceptance pending.

## Tests and evidence
`npm run test:unit -- tests/RD-03`; `npm run check`; `npm run build` (root Canvas2D
baseline only); `scripts/verify-boundary.mjs --task RD-03 --start 16faf55a9782fb12d2f30df4547a619957792089 --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Browser RUN03/04 and screenshots must execute against actual optimized
`/src/runner/index.html` in phase 2. Bench stays NOT_RUN without exclusive slot.
Raw commands, exits, source/log hashes and manifests remain external and additive.

## Risks
Float64→Float32 is projection-only (absolute tolerance 1e-5 m, declared before
tests). Native PCF/sky/water-shader parity is unavailable, explicitly labeled.
Future wetness/occlusion channels require concrete RD14 material-owner contracts;
no placeholder shader plugins. Arbitrary effects must honor detached-root ownership.

## Rollback / safe stop
Failed/aborted candidates dispose without publication; old complete snapshot stays.
If inputs drift or HEAD-owned contract delta is needed, stop only affected scope.
No destructive cleanup; only owned managed runtime/profile may be stopped.

## Progress log
- [x] Inputs: exact branch/start/tree, acceptance receipt, shared 18/18 and inventory.
- [x] Exact lab npm ci, ignore scripts, own caches/temp; no package/lock edits.
- [x] RED then implementation and fresh focused checks (13 CPU tests).
- [x] DEV/DIAGNOSTIC WebGL2: nine views, backward seek/reset and 20 lifecycle cycles;
      optimized browser evidence remains NOT_RUN.
- [x] CLI inspect, failed-input and controlled abort checks; evidence/bench NOT_RUN gates.
- [x] Scope deviation: broad inherited suite passed 40 tests but created additive
      RD00/RD01/RD02 oracle directories. Stopped broad runs; retained, reported, no cleanup.
- [ ] Narrow local code commit and complete HEAD wiring handoff.
- [ ] Phase-2 optimized browser evidence (NOT_RUN until HEAD snapshot).

## Definition of Done
Phase 1: implemented code and focused tests/types/inspect/boundary/self-review,
local SHA/tree/parent and precise wiring delta. Not whole RD03 completion.
Phase 2: real WebGL2 source/image/DPR/timer evidence and 20 real mount/dispose
cycles against HEAD-wired optimized build, with cleanup and honest unavailable metrics.
