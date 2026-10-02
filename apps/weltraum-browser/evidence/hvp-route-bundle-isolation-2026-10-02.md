# HVP route bundle isolation, 2026-10-02

Base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Branch: `perf/hvp-route-bundle-isolation-2026-10-02`.

## Root cause and scope

`main.ts` imported `startHvpRoute` statically from `hvpBootstrap.ts`. That module imports Three.js, HVP terrain/presentation, session owners, persistence and physics-client code. The later query gate controlled execution, but could not remove that static import from the normal entry dependency graph. The former `import("./hvp")` loaded a 4,005-byte export barrel after most HVP code had already been loaded in the entry.

The patch removes the static bootstrap import and dynamically imports `./hvp/hvpBootstrap` only in the existing HVP branch. Its resolved namespace is passed directly to `startHvpRoute` through the existing loader callback. There is one dynamic import and no subsequent barrel import. Surface Lab still precedes HVP, and the normal runtime and TestBridge branches are unchanged.

No changes to `hvpBootstrap.ts`, Cut-RT-V3, renderer, physics, voxel/save/gameplay code, dependencies, lockfile or Vite configuration. No merge. DevToolbox is not exposed in this environment; repository-native build/tests and Git checks are used instead.

## Production diff

```diff
-import { startHvpRoute } from "./hvp/hvpBootstrap";

 } else if (isHvpQuery(searchParams)) {
-  void startHvpRoute(document, () => import("./hvp"));
+  void import("./hvp/hvpBootstrap").then((hvp) => hvp.startHvpRoute(document, async () => hvp));
```

Additional changes are the production-build graph regression test, the existing route E2E regression assertions, and this Markdown/JSON evidence. No other production file changes.

## Production bundle inventory

Sizes are exact emitted JavaScript bytes, excluding maps. Gzip uses Node's `gzipSync` default settings consistently for both builds, so it can differ slightly from Vite's displayed compression figures.

| Output | Before bytes | After bytes |
| --- | ---: | ---: |
| Normal entry | 1,633,384 | 1,257,434 |
| Normal entry, gzip | 438,157 | 329,984 |
| Deferred HVP barrel / bootstrap | 4,005 | 270,168 |
| Deferred shared render backend | Included in entry | 98,762 |
| Surface Lab chunk | 56,157 | 56,170 |
| TestBridge chunk | 61,668 | 61,661 |
| Streaming worker | 225,840 | 225,840 |
| Rapier physics worker | 2,409,039 | 2,409,039 |

Normal entry reduction: **375,950 bytes, 23.02%**. This is a bundle measurement, not an FPS, latency or loading-time benchmark. The streaming and physics worker files retain identical names and SHA-256 hashes.

The initial normal entry contains 53 HVP/Hestia source-map sources before and 17 afterward. Those 17 consist of the lightweight query gate and 16 shared worker/job helpers. The remaining import chain is `main -> BrowserRuntime -> pgTragwerkPlayerSlice -> voxel/structural -> provingGroundR5 -> workers barrel -> WorkerPool/HVP jobs`. This patch isolates the HVP bootstrap and route owners; it does **not** claim that all HVP-named helper code is absent from Flight. Removing that separate worker-barrel coupling would require an additional scoped change.

| Dependency | Before normal `/` | After normal `/` | HVP request |
| --- | --- | --- | --- |
| Three.js | Initial entry | Initial entry | Reuses entry; Flight already needs it |
| Rapier | Absent | Absent | Physics worker only |
| HVP bootstrap, session/player/save owners | Initial entry | Absent | Deferred bootstrap chunk |
| HVP shared worker/job helpers | Initial entry | Initial entry | Reused; workers carry their own copies |
| Render backend | Initial entry | Deferred | HVP or Surface Lab request |
| TestBridge | Absent | Absent | Only normal `?testBridge=1` enables it |

## Actual production requests

Each check uses a fresh browser context against the saved baseline build or the patched production build. Counts are distinct JavaScript URLs. Repeated worker URL requests are separate worker instances, not additional chunk files.

| Route | Before main-thread JS chunks | After main-thread JS chunks | Distinct worker chunks | Worker instances |
| --- | ---: | ---: | ---: | ---: |
| `/` | 1 | 1 | 0 | 0 |
| `/?testBridge=1` | 2 | 2 | 0 | 0 |
| `/?surfaceLab=1` | 2 | 3 | 1 | 4 |
| `/?surfaceLab=1&hestiaPrototype=1` | 2 | 3 | 1 | 4 |
| `/?hestiaPrototype=1` | 2 | 3 | 2 | 3 |
| `/?hestiaPrototype=1&testBridge=1` | 2 | 3 | 2 | 3 |

All 12 captures reached the expected Flight/HVP/Surface Lab state, with no page errors or failed requests. Combined queries reached Surface Lab Ready without an HVP HUD. TestBridge was present only on the normal `?testBridge=1` route, including absence on the HVP-plus-TestBridge query. Neither HVP bootstrap nor shared backend was requested on normal `/` or normal `?testBridge=1`.

The extra Surface Lab/HVP main-thread request is the backend which Vite automatically separated from the entry. On the normal route, initial JS request count remains one.

## Regression and verification

The new unit test builds the actual production dependency graph in memory, walks static chunk imports, and verifies that the bootstrap and HVP route owners are deferred. It fails against the original base and passes after the patch. It also verifies that a bootstrap chunk exists, so deleting HVP altogether cannot satisfy the check. The existing live route E2E now checks bootstrap requests as well as Flight, TestBridge, Surface Lab and combined-query precedence. E2E group membership is unchanged.

- Baseline `npm run build`: PASS.
- Baseline `npm test -- tests/unit/hvp-query.test.ts tests/unit/hvp-bootstrap.test.ts`: 62/62 PASS.
- Regression against original `main.ts`: expected FAIL; patched graph/query tests: 3/3 PASS.
- `npx tsc -p tsconfig.json`: PASS.
- Patched `npm run build`: PASS.
- Route/TestBridge E2E: 3/3 PASS.
- HVP visible-coast startup and normal planner workflow E2E: 2/2 PASS.
- HVP failed physics-worker startup E2E: 1/1 PASS, visibly Error and never Ready.
- Production route/network assertions: 12/12 PASS.
- E2E CI inventory: 41 specs, each assigned to exactly one existing group; PASS.
- Default full `npm test`: interrupted manually before completion; no PASS claimed. A native-library error from a separate process inspection was initially misattributed to the suite, although it was absent from the Vitest log.
- Full `npm test -- --reporter=verbose --maxWorkers=2`: **220/220 files and 2,572/2,572 tests PASS**, exit 0, 769.37 s. This rerun changes only CLI reporting/concurrency, not project configuration.
- Final pre-commit `npm run build`: PASS (TypeScript plus Vite); all emitted chunk sizes and SHA-256 hashes match the measured after-inventory. `git diff --check`: PASS. Protected production paths and dependency/config files remain unchanged.

Browser environment: project Playwright 1.61.1 controlling Chromium Headless Shell 134.0.6998.35 through `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH`. The ordinary Chromium executable failed before test execution because this environment blocks its process-singleton Unix socket; Headless Shell completed the checks. The installed project browser download failed with an invalid archive, so the independently downloaded browser executable was used without changing project dependencies. Node 24.19.0, TypeScript 7.0.2, Vite 8.1.5, Vitest 4.1.11. Existing large-chunk, npm proxy-config and Playwright color warnings remain; no chunk thresholds were modified.

Existing HVP initialization failures remain handled inside `startHvpRoute` once the bootstrap loads. The new bootstrap network request itself is outside that existing handler, like the current normal TestBridge dynamic import; no new chunk-fetch recovery UI is introduced. Successful query routes and worker-startup failure behavior are verified above.

## Cherry-pick scope

At inspection, remote `feature/hvp-cut-rt-v3-completion-2026-09-23` still pointed exactly to the required base SHA. The sole production diff is removal of one import and replacement of one route statement in `main.ts`; `hvpBootstrap.ts` and V3 owners remain byte-identical. This is low-conflict for later V3 work that changes bootstrap internals. Future V3 commits are not available to verify: edits to `main.ts` route dispatch or the same E2E block may require manual conflict resolution, followed by a fresh build and route checks.

Exact chunk names, sizes, hashes, source inventories, graph edges, route states and request inventories: [hvp-route-bundle-isolation-2026-10-02.json](hvp-route-bundle-isolation-2026-10-02.json).
