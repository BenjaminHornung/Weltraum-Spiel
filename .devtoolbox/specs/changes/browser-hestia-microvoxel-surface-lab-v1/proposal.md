# Proposal: Browser Hestia Microvoxel Surface Lab V1

## Motivation
The browser mainline has celestial, spatial, worker-streaming, presentation, and Three.js backend foundations, but no live deterministic voxel surface. This change adds the first technical proving ground that connects those foundations into a browser-visible Hestia landscape at /?surfaceLab=1.

## Outcome
A developer can run npm run dev and inspect a deterministic low-poly microvoxel region with camera controls, fog, water, reconstructable vegetation, read-only telemetry, resolution switching, regeneration, and evidence. Terrain is generated and meshed in the existing Web Worker pool and rendered through MeshArtifact and ThreeRenderBackend.

## Scope
- Hestia celestial definition through UniverseTime, BodyFixed, and SurfaceLocalFrame.
- Neutral VoxelBrick, sample/apron/material contracts and canonical hashes.
- Deterministic Hestia density, material, and scatter generation.
- Uniform-grid Surface Nets V1 with stable seams and faceted normals.
- GenerateHestiaVoxelBrickMesh in the existing worker protocol and pool.
- Transferable multi-buffer results, stale rejection, cancellation, byte budgets, and reconstructable cache integration.
- The only Presentation ownership coupling in src/voxel/meshArtifactAdapter.ts.
- Query-gated full-screen Surface Lab, controls, HUD, telemetry, screenshots, unit and live E2E evidence.

## Compatibility
The query-less flight runtime and all query values other than surfaceLab=1 remain unchanged. No planner, executor, FlightController, Presentation-core, ThreeRenderBackend, dependency, or lockfile change is permitted.

## Non-Goals
No complete planet, voxel LOD, Transvoxel, octree, QEF, production cave system, collision/controller, mining, persistent edits, city/outpost, mission, cargo, multiplayer, atmosphere/water simulation, WASM, SharedArrayBuffer, new dependency, fake player, TestBridge, or fake progression.

## Success
- 16/16 default chunks become visible with no holes and stable worker state.
- Same inputs produce identical brick and mesh hashes; changed seed changes valid hashes.
- Neighbor samples are byte-identical and border vertices numerically identical.
- Stale or cancelled work cannot publish.
- Runtime terrain flows through ThreeRenderBackend via the isolated adapter.
- Required unit, build, grouped E2E, visual, and evidence gates pass.

## Approved Task 4.1 Replan (2026-07-15)
Task 4.1 must make content-changing seed and resolution transitions compatible with the real render-backend revision contract, integrate the existing canonical brick cache rather than fabricate cache telemetry, and harden async generation/disposal behavior. Completed Tasks 1.1-3.2 remain unchanged. The revision permits focused canonical representation-identity and Surface Lab controller/test changes; Presentation, render-backend, worker, streaming implementation, gameplay, visual Task 4.2, package and lockfile changes remain out of scope. Success requires deterministic content-addressed representation keys, no mixed old/new generation artifacts, truthful read-only cache/hash telemetry, accepted-terminal ownership safety, and executable lifecycle regressions.

## Approved Task 4.1 Amendment 2 (2026-07-15)
Worker request target identity and generated mesh representation identity are separate contracts. Task 4.1 may make the focused worker-protocol validation-order change needed to validate content-addressed mesh identity only after reconstructing and validating the transferred canonical VoxelBrick. WorkerPool, result gate, streaming worker/cache implementation, Presentation and backend behavior remain unchanged.


## Approved Task 4.1 Amendment 3 (2026-07-15)
Task 4.1 separates neutral Surface Nets V1 artifact revision zero from monotone Presentation publication revisions. Every superseding generation clears prior publications and republishes accepted current results at a strictly higher Presentation artifact revision, including same-input regenerate and revisit of a previously removed configuration. The focused adapter revision seam, cached-mode snapshot rule, truthful zero-based request telemetry, disposal-safe replacement handling and real-ledger regressions are in scope; Presentation core/backend/WorkerPool behavior remains unchanged.
