# Test Protocol: Browser Hestia Hydrology Terrain Generator V2

## Preconditions and scope

- Run from `apps/weltraum-browser` with Node 22.
- The implementation allowlist is `apps/weltraum-browser/src/world-generation/hestia/hydrology/**`,
  `tests/unit/hestiaHydrology*.test.ts`,
  `tests/e2e/hestia-hydrology-generator-v2.spec.ts`,
  `evidence/browser-hestia-hydrology-generator-v2*`, this protocol, and
  `docs/browser-mainline/hestia-hydrology-terrain-generator-v2.md`.
- Direct hydrology module imports are required; barrel integration is deferred.
- V1 is unchanged. `src/voxel/adaptive/**`, central application wiring,
  existing renderer/worker/runtime authorities, package files, lockfiles, and
  unrelated paths are forbidden.
- No TestBridge, screenshot, decorative water plate, dynamic liquid, globally
  complete planet hydrology, DOM, camera, Three.js, runtime, wall-clock, or
  random dependency is permitted.

## Exact contract fixture

Use a valid `HydrologyGridDefinition` with 128x128 cells, 129x129 samples,
2.0 m spacing, 256x256 m extent, and an origin represented in global 0.125 m
quanta aligned to 16 quanta. Every fixture sampler must receive global X/Z;
the local array index must never be used as identity.

Use the exact versioned parameters:

```text
gridSpacingMeters             = 2.0
seaLevelMeters                = 0
minimumLakeDepthMeters        = 0.15
riverSourceAccumulationCells  = 48
minimumRiverDepthMeters       = 0.20
maximumRiverDepthMeters       = 2.50
minimumRiverHalfWidthMeters   = 0.50
maximumRiverHalfWidthMeters   = 4.00
channelBankSlope              = 0.65
moistureFalloffMeters         = 18
```

## Mandatory unit matrix — numbered cases 1-20 plus focused regressions

1. A flat sloped plane fully drains to the lowest boundary edge.
2. The D8 flow graph contains no internal cycles.
3. Symmetric slope ties choose the canonical deterministic direction.
4. An isolated depression becomes a lake with the correct spill level.
5. An isolated below-sea depression is not classified as ocean.
6. A boundary-connected below-sea area is classified as ocean.
7. River accumulation increases downstream.
8. River water surface height never rises downstream.
9. Channel adjustment places adjusted terrain below original terrain.
10. Lake water exists only in basin cells.
11. Dry slopes do not receive floating water.
12. Equivalent generation produces stable water-body IDs.
13. Identical input produces identical snapshot bytes and hashes.
14. Caller/input array order does not influence the snapshot.
15. Moisture is finite and within `[0,1]`.
16. A non-finite terrain sampler result fails closed.
17. Unsafe global coordinates fail closed.
18. The returned snapshot and nested values are recursively frozen.
19. Forbidden imports/APIs are absent from hydrology modules.
20. A full 129x129 dataset remains inside the documented memory budget.

Each case must assert the externally observable contract, not only an internal
helper. Cases 13, 14, and 18 include IDs, collections, sample outputs, bytes,
and hashes where applicable.

## Determinism and canonical-output audits

- Generate the same canonical input twice in one process and in two fresh Node
  invocations; compare canonical snapshot bytes, hashes, cell order, water-body
  IDs, river IDs, and sampler outputs byte-for-byte.
- Reorder equivalent caller-provided inputs and confirm identical output.
- Change only `rootSeed`, then only terrain input, and require a changed
  snapshot hash while retaining valid contracts.
- Confirm all samples were derived from global coordinates and all published
  arrays use global Z ascending, then global X ascending order.
- Confirm priority-flood keys are `filledElevation`, global Z, global X, stable
  linear index; D8 order is `N, NE, E, SE, S, SW, W, NW`.
- Confirm no internal D8 cycle, every river ends at lake/ocean/boundary, lake
  levels are horizontal, and river water is downstream non-increasing.

## Memory-budget audit

The V2 contract cap is **8 MiB for the deterministic retained-representation
estimate of one snapshot**. The full fixture has 16,641 samples and 16,384
cells. Count the frozen snapshot graph with documented fixed-width
value/reference/container assumptions and the packed canonical representation
at two bytes per string code unit. Count shared objects and distinct graph
strings once. Repeat generation and require identical estimates. Generation
must fail closed above 8 MiB.

Record the estimator version, method, assumptions, component values, and total
in evidence. This is not V8/browser heap telemetry and must not be described as
an actual process peak; temporary solver storage, allocator behavior, engine
object headers, and garbage collection are outside the estimator scope.

## Forbidden import/API and path audits

The hydrology implementation must contain no imports or references to
Three.js, DOM APIs, camera state, runtime state, wall-clock APIs, or random APIs
(`Math.random`, `Date`, `performance.now`, `crypto.random*`, or equivalent).
Use a scoped text audit over `apps/weltraum-browser/src/world-generation/hestia/hydrology/**`; do not broaden
the audit into a product refactor.

The exact changed-path audit must prove that every implementation/test/evidence/
documentation change is within the allowlist, including the exact approved
`docs/browser-mainline/hestia-hydrology-terrain-generator-v2.md` path, and that no file under
`apps/weltraum-browser/src/voxel/adaptive/**` changed. The audit also rejects
package, lockfile, central wiring, V1, renderer, worker, and unrelated runtime
changes. Evidence JSON and Markdown must contain no timestamp fields or
wall-clock values.

## Browser fixture and health arrays

The one browser spec is
`apps/weltraum-browser/tests/e2e/hestia-hydrology-generator-v2.spec.ts`.
It loads the normal route, does not use TestBridge, dynamically imports the
hydrology module, and uses a deterministic valley fixture containing an
isolated lake and a boundary-connected ocean. It must:

- generate the fixture twice and compare snapshot bytes/hashes;
- prove the river ends at lake, ocean, or boundary;
- prove downstream water levels never rise;
- prove no `WaterSample` floats over dry terrain;
- retain solver checks as separately named domain diagnostics; and
- install listeners before `page.goto`, then emit and assert exactly these four
  browser-health arrays empty:

```json
{
  "consoleErrors": [],
  "pageErrors": [],
  "requestFailures": [],
  "httpErrors": []
}
```

The browser proof is functional and deterministic only. No screenshot is
required or allowed by this contract.

## Evidence names and PASS criteria

Write timestamp-free artifacts only at:

- `apps/weltraum-browser/evidence/browser-hestia-hydrology-generator-v2-summary.json`
- `apps/weltraum-browser/evidence/browser-hestia-hydrology-generator-v2-summary.md`

Evidence records documented commands, Node version, unit/browser outcomes,
browser-health arrays, separately named domain diagnostics, repeat-audit
outcome, forbidden-scan outcome, changed-path outcome, estimator method/scope
and value, snapshot hashes, river-terminal chain counts/details, lake/ocean
proof, and known residual risk. Fixture-generated evidence marks external unit,
typecheck, path, and API scan outcomes as not run by the browser proof; later
verification metadata may record them only after those commands run. It must
not contain `generatedAt`, timestamps, screenshots, or claims outside this V2
contract.

PASS requires all 20 unit cases, the focused browser proof, four empty health
arrays, deterministic same-input equality, changed-input hash inequality,
valid lake/ocean/river invariants, no floating water, recursive freeze, fail-
closed invalid inputs, the 8 MiB budget, clean path/API scans, and timestamp-
free evidence.

## Node 22 verification commands

Run these commands from `apps/weltraum-browser`, exactly as written:

```text
npx tsc -p tsconfig.json
npx vitest run tests/unit/hestiaHydrology*.test.ts
npm run test
npm run build
npm run test:e2e -- tests/e2e/hestia-hydrology-generator-v2.spec.ts
```

Also perform the deterministic repeat audit, forbidden import/API scan, exact
path allowlist audit, V1-unchanged audit, reviewer pass, reviewer-glm pass, and
DevToolbox Completion Preflight. Reviewer and preflight are evidence gates;
they do not authorize a commit or push.

## Separately authorized closing steps

Commit and push are listed as closing steps only. They require separate explicit
user authorization and must not be performed as part of this protocol handoff.
