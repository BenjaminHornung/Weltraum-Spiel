# Test Protocol: browser-world-chunk-registry-streaming-core-v1

## Scope

Capture deterministic chunk registry and world streaming contracts for M6 world-scale foundation and validate that all evidence paths are generated via a query-gated browser bridge.

## Required commands

Run npm/Playwright commands from `apps/weltraum-browser` inside this change's worktree.
Run git and JSON commands from repo root.

```powershell
# 1) Unit-level hardening slice
npm run test -- tests/unit/chunkRegistry.test.ts
npm run test -- tests/unit/worldStreaming.test.ts
npm run test -- tests/unit/worldFrames.test.ts tests/unit/simulationBubble.test.ts tests/unit/lowPolyInstances.test.ts

# 2) Full browser unit test suite
npm run test

# 3) Build check
npm run build

# 4) e2e slice and full app smoke
npm run test:e2e -- tests/e2e/world-chunk-streaming.spec.ts
npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts
npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts

# 5) Verification-only checks (repo root)
git diff --check
git diff --cached --check

# Forbidden-path audit vs origin/main must return no changes (repo root)
git diff --name-only origin/main -- package.json package-lock.json Assets apps/weltraum-browser/package.json apps/weltraum-browser/package-lock.json apps/weltraum-browser/src/main.ts apps/weltraum-browser/src/style.css apps/weltraum-browser/src/ui apps/weltraum-browser/src/render apps/weltraum-browser/src/runtime
git diff --cached --name-only origin/main -- package.json package-lock.json Assets apps/weltraum-browser/package.json apps/weltraum-browser/package-lock.json apps/weltraum-browser/src/main.ts apps/weltraum-browser/src/style.css apps/weltraum-browser/src/ui apps/weltraum-browser/src/render apps/weltraum-browser/src/runtime

# Evidence integrity check (repo root)
$summary = Get-Content "apps/weltraum-browser/evidence/browser-world-chunk-registry-streaming-v1-summary.json" -Raw | ConvertFrom-Json
$invariantProperties = $summary.floatingOrigin.invariants.PSObject.Properties
$invariantCount = $invariantProperties.Count
$falseInvariantCount = @($invariantProperties | Where-Object { $_.Value -ne $true }).Count
if ($invariantCount -ne 11) { throw "Invariant count mismatch: $invariantCount" }
if ($falseInvariantCount -ne 0) { throw "Invariant failures: $falseInvariantCount" }
"False invariant count: $falseInvariantCount"
```

## Post-hardening results (2026-07-11)

- chunkRegistry focused: `16/16` passed using `npm run test -- tests/unit/chunkRegistry.test.ts`.
- worldStreaming focused: `25/25` passed using `npm run test -- tests/unit/worldStreaming.test.ts`.
- worldFrames + simulationBubble + lowPolyInstances focused: `7/7` passed using `npm run test -- tests/unit/worldFrames.test.ts tests/unit/simulationBubble.test.ts tests/unit/lowPolyInstances.test.ts`.
- Full npm test: `16` files, `188` tests passed.
- npm build: `40` modules built in `426ms`; known warning: >500KB asset bundling warning is present and accepted.
- Playwright:
  - `npm run test:e2e -- tests/e2e/world-chunk-streaming.spec.ts`: `2/2` passed.
  - `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts`: `1/1` passed.
  - `npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts`: `3/3` passed.
  - Browser engine: bundled Chromium was used; no fallback path taken.
- Evidence integrity check: `ConvertFrom-Json` passed with `11/11` invariants true and `falseInvariantCount=0`.
- `git diff --check` and `git diff --cached --check` passed after final staging.
- Forbidden-path audits vs `origin/main` for listed paths produced empty diffs for both worktree and staged state.

## Scenario and evidence contract

- `apps/weltraum-browser/src/world/worldStreamingScenario.ts` must remain discoverable through `TestBridge.runWorldStreamingScenario()`.
- The bridge must only exist with `?testBridge=1`; default `/` startup must not expose `window.TestBridge`.
- Evidence files must be written under:
  - `apps/weltraum-browser/evidence/browser-world-chunk-registry-streaming-v1.md`
  - `apps/weltraum-browser/evidence/browser-world-chunk-registry-streaming-v1-summary.json`
- Scenario expectations:
  - deterministic `chunkSizeMeters = 256` planning with eight registered chunks,
  - deterministic observer steps `initial` / `boundary` / `farther` using positions `0`, `240`, `520` meters,
  - independent simulation and render budgets with independent rejections,
  - independent `Full`/`Snapshot`/`Dormant` residency and `Near`/`Medium`/`Far`/`Culled` render LOD,
  - deadband hysteresis for re-entries/exits,
  - ordered transitions from simulation and render domains,
  - fixed transition types:
    - `ChunkActivated`
    - `ChunkPromotedToFull`
    - `ChunkDemotedToSnapshot`
    - `ChunkBecameDormant`
    - `ChunkEnteredRenderRange`
    - `ChunkChangedLod`
    - `ChunkLeftRenderRange`
  - ordered rejection reasons:
    - `FullChunkBudgetExceeded`
    - `SnapshotChunkBudgetExceeded`
    - `EstimatedEntityBudgetExceeded`
    - `VisibleChunkBudgetExceeded`
- floating-origin invariance for absolute observer state and signatures across origin shift.

## M6 remaining limitations to keep explicit

- this slice documents/contracts deterministic registry/streaming and does not implement persistent chunk discovery, async chunk asset loading, terrain/planet surface runtime, or full production world streaming pipeline.
- non-identity frame orientation and orbital-surface conversion math remain in later slices.
