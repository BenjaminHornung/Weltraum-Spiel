# Tasks: Browser Hestia Hydrology Terrain Generator V2

All tasks are bounded by the approved plan. No task may edit outside the
allowlist in `proposal.md`, change V1, create a second architecture, or create
a DevToolbox execution. Do not toggle task state from this handoff.

## Phase 1 — Contracts and preset

- [x] Implement the direct hydrology contracts in
  `apps/weltraum-browser/src/world-generation/hestia/hydrology/**`:
  `HestiaHydrologyDatasetId`, `HydrologyGridDefinition`,
  `HydrologyCellCoordinate`, `HydrologyGlobalCoordinate`,
  `HydrologyDatasetRevision`, `WaterBodyId`, `RiverSegmentId`,
  `HydrologyParameters`, `HydrologyInput`, `HydrologySnapshot`,
  `HydrologyCell`, `WaterBody`, `RiverSegment`, and `HydrologySample`.
  Enforce 128x128 cells, 129x129 samples, 2.0 m spacing, 256 m extent, and
  0.125 m global quanta with 16-quantum origin alignment.
- [x] Publish the exact versioned preset values and pure finite terrain-sampler
  contract; reject invalid dimensions, parameters, identities, coordinates,
  and non-finite heights before mutation.
- [x] Verify direct module imports and preserve V1; do not add a barrel or
  central runtime integration.

## Phase 2 — Solver

- [x] Implement canonical global-coordinate sampling, boundary-connected ocean
  flood, deterministic priority flood, filled/depression/spill/basin outputs,
  canonical D8 ordering, boundary outlets, cycle rejection, and topological
  accumulation.
- [x] Make every tie and traversal independent of local array/caller order and
  prove no internal flow cycle.

## Phase 3 — Water bodies and rivers

- [x] Implement lake detection, spill-level horizontal water, basin-only water
  coverage, stable `WaterBodyId`, below-sea ocean distinction, and fail-closed
  floating-water validation.
- [x] Implement river sources at accumulation 48, canonical D8 tracing,
  confluence handling, stable `RiverSegmentId`, lake/ocean/boundary termination,
  and downstream non-increasing water surfaces.

## Phase 4 — Sampler and moisture

- [x] Implement the approved channel depth and half-width clamp equations,
  `channelBankSlope=0.65`, incised adjusted terrain, and pure
  `sampleHydrologyTerrainAdjustment(globalX, globalZ)` output.
- [x] Implement finite `[0,1]` moisture from water distance and basin/depression
  depth using the explicit 18 m falloff; keep all water and moisture static and
  non-authoritative to rendering/runtime.
- [x] Implement recursive freeze, canonical snapshot bytes, stable hashes, and
  caller-order independence without changing central hash utilities.

## Phase 5 — Unit tests, budget, and scans

- [x] Preserve all numbered mandatory cases 1-20 and add focused regression cases under
  `apps/weltraum-browser/tests/unit/hestiaHydrology*.test.ts`, including the
  full 129x129 memory-budget measurement and recursive-freeze/hash assertions.
- [x] Run the focused command from `apps/weltraum-browser`:
  `npx vitest run tests/unit/hestiaHydrology*.test.ts`.
- [x] Run the deterministic repeat audit twice and compare snapshot bytes,
  hashes, IDs, and ordering; run the forbidden import/API scan for Three.js,
  DOM, camera, runtime, wall-clock, and random APIs.
- [x] Verify the exact path allowlist, absence of changes under
  `apps/weltraum-browser/src/voxel/adaptive/**`, no package/lock/config changes,
  and the documented 8 MiB deterministic retained-representation budget.

## Phase 6 — Browser proof, evidence, and docs

- [x] Add only
  `apps/weltraum-browser/tests/e2e/hestia-hydrology-generator-v2.spec.ts`.
  Use the normal route, no TestBridge, dynamic module import, deterministic
  valley/lake/boundary-ocean fixture, twice-generated same hashes, termination,
  monotonic downstream water, and no floating `WaterSample`.
- [x] Write timestamp-free evidence only under
  `apps/weltraum-browser/evidence/browser-hestia-hydrology-generator-v2*`:
  `summary.json` and `summary.md`; do not add screenshots.
- [x] Keep mainline documentation changes exclusively in
  `docs/browser-mainline/hestia-hydrology-terrain-generator-v2.md`.
- [x] Verify the four browser health arrays are empty and document measured
  results, commands, Node version, path scan, budget method, and residual risk.

## Phase 7 — Review, verification, and completion preflight

- [x] Request the standard reviewer and the approved reviewer-glm pass; resolve
  only findings within this contract and rerun affected checks.
- [x] With Node 22 and existing dependencies, run the exact verification commands from the protocol:
  `npx tsc -p tsconfig.json`; `npx vitest run tests/unit/hestiaHydrology*.test.ts`;
  `npm run test`; `npm run build`; `npm run test:e2e -- tests/e2e/hestia-hydrology-generator-v2.spec.ts`;
  and `git diff --check`.
- [x] Perform the final exact path allowlist, including
  `docs/browser-mainline/hestia-hydrology-terrain-generator-v2.md`, forbidden
  API/import, timestamp, evidence, deterministic repeat, and V1-unchanged audits.
- [x] Run DevToolbox Completion Preflight only when implementation and fresh
  evidence exist; do not create an execution or toggle tasks in this handoff.

## Separately authorized closing steps

- [ ] Commit the approved change only after explicit user authorization.
- [ ] Push the approved commit only after explicit user authorization.

These closing steps are recorded for handoff and must not be performed here.
