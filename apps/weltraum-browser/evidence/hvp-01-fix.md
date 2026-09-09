# HVP-01-FIX evidence

## Capture binding

- Path: `apps/weltraum-browser/evidence/hvp-visible-coast-1920x1080.png`
- SHA-256: `b47b7e48fbdcfbe514658238a74838986531cdc09b3dc09d35d39aac5620d1e3`
- Bytes: `47221`, dims: `1920x1080` (exact)
- Profile: beauty (real product viewport `?hestiaPrototype=1`, C04-WIDE default); no separate technical harness.
- Tolerance band: per-channel `12`, non-empty `> 0.01`, bound-vs-live changed pixels `<= 8192`.
- Calibration (non-record re-run): `changedPixels=0`, `changedRatio=0`, `maximumChannelDelta=0`
  (bit-identical deterministic re-render). No lower band by design: an identical
  re-render is the expected case. The upper band rejects stale captures and blank
  replacements (blank-vs-bound differs in ~2M pixels).
- Writes happen only with `WELTRAUM_RECORD_EVIDENCE=1`; normal runs compare
  in-memory and leave `git status` clean.

## Fix → Befund → Test

1. Camera contract: presets were `(6,2.4,10)/(20,15,24)` with no FOV control.
   Fix: `src/hvp/hvpCamera.ts` exact Masterplan poses
   C01-EYE `(-8,3.15,-11)→(0,1,5)` FOV 60, C04-WIDE `(-24,18,-28)→(0,1,1)` FOV 55.
   Test: `tests/unit/hvp-camera.test.ts` (3 tests).
2. FOV always set: `applyPreset()` and `resize()` set `camera.fov` from the
   preset plus `updateProjectionMatrix()`; the Three.js backend default 50° is
   never relied on. Test: `hvp-camera.test.ts` "never inherits the backend default 50°".
3. Coverage gate: `startHvp()` builds the coast, derives `hvpServedCoverage`
   (every solid plus every exposed non-solid neighbor), creates the session via
   `createHvpSession`, and `assertHvpCoverageComplete` throws on any
   UnknownCoverage before HUD Ready. Incomplete coverage ends in Loading/Error
   via `presentHvpFailure`, never silent Ready.
   Test: `tests/unit/hvp-terrain.test.ts` "coverage gate", `hvp-bootstrap.test.ts`
   "never reaches Ready on incomplete coverage".
4. T02 seed determinism: `hvpCoastHeightMeters(x, z, seed = 0)` is pure Math
   (no `Math.random`/`Date.now`); seed 0 reproduces the previous output exactly
   (golden `hvpCoastHeightMeters(2.5,-3.5) ≈ 0.8499`). `hvpHashCoastLeaf` sorts
   stably by numeric (x,y,z) and hashes space keys plus seed heights: a 16³ leaf
   hashes identically forward/backward/shuffled, differently for seed 7.
   Test: `hvp-terrain.test.ts` "T02 seed determinism".
5. T08 lifecycle: module-level double-mount guard (second `startHvp()` throws,
   no duplicate `#hvp-hud`, no second backend), exactly-one rAF tick loop,
   dispose exactly once, repeat start after dispose regenerates.
   Test: `tests/unit/hvp-bootstrap.test.ts` (FakeElement/FakeWindow harness
   mirroring `surfaceLabBootstrap.test.ts`).
6. T09 immutability: coast cells and served-coverage snapshots are frozen;
   mesh/water envelopes are frozen; mesh buffers are fresh typed-array copies
   per call; session seeds are copied into lookup sets. Mutating a returned
   snapshot never reaches the authority or fresh reads.
   Test: `hvp-terrain.test.ts` "T09 snapshot immutability".
7. T11 capacity: `hvpBuildCoastBlockCells` counts cells before allocating and
   throws `BudgetExceeded` above 16384 (region volume bound; sub-meter
   refinement exceeds it by construction); `hvpMeshBlocks` gates cell count
   (65536) and exposed-face count (131072) before output allocation, mirroring
   `greedyMesher.ts` visited/output gates. Block sizes `0/-0/NaN/Infinity/
   negative/non-quantum` throw `TypeError`.
   Test: `hvp-terrain.test.ts` "T11 capacity gate and block-size guard".
8. Capture binding: E2E follows the R5B pattern (`decodeAndCompare`,
   `measureCanvas`, `persistDeterministicEvidence`, temp-dir negatives).
   Negatives: missing/corrupt/blank/wrong-size stored PNG rejected;
   self-compare reports 0 changes; blank-vs-bound exceeds the live upper band.
   Test: `tests/e2e/hvp-visible-coast.spec.ts` (4 tests, live group).

## Coastal contract scope (HVP-01 vs HVP-02+)

In HVP-01 (visible region features, T10 context):

- S-channel centerline through `(-3,-16),(-4,-10),(3,-4),(2,3),(-3,9),(0,16)`
  (`hvpChannelCenterX`, piecewise linear).
- Core half-width 1.5 m dredged to the `-1.5` m floor plane, plus 1.5 m margin
  rising to the banks with asymmetric profiles (linear east, smoothstep west).
- Steps are block-quantized: the 1 m block fill terraces floor → banks in whole
  blocks (verified on block tops, not on the continuous function).
- Water stays the flat diagnostic rectangle at y = 0 (`hvpBuildWaterPlane`);
  it is NOT claimed as final water.

Not in HVP-01 (stays HVP-02+): biom/art release, microvoxel refinement below
1 m, final water surface, physics/save integration, economy/cargo.
