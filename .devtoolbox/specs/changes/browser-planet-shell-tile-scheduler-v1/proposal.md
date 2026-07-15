# Proposal: Browser Planet Shell Tile Scheduler V1

## Motivation

The browser runtime has stable spatial/body contracts and a MeshArtifact/VisibilityPlan render boundary, but no renderer-independent representation for a global planet shell. Without a canonical tile address, conservative bounds, explainable LOD selection, and readiness-aware fallback, visible planet coverage would be coupled to Three.js and could produce nondeterministic holes during streaming transitions.

## Outcome

Implement a deterministic planet-shell and tile-scheduler core under `apps/weltraum-browser/src/planet/**`, plus a separately imported Hestia orbit harness. The core provides cube-sphere addressing, stable PlanetTile IDs, quadtree and cross-face neighbors, conservative bounds, geometric/SSE selection, frustum and horizon culling, readiness planning, atomic parent fallback, and simple shell meshes. One adapter maps core output to existing MeshArtifact and VisibilityPlan contracts.

## Scope

- Six-face canonical cube-sphere mapping with stable edge/corner ties and outward winding.
- PlanetTileKey validation, ID/canonical ordering, parent, children, siblings, and edge neighbors.
- Body-centered double-precision angular/radial bounds and conservative bounding spheres.
- Pure SSE, frustum, horizon, budgeted deterministic selection, reasons, revisions, and requests.
- Revisioned readiness snapshots and hole-free parent/child visibility handoff.
- Deterministic grid shell geometry with a PlanetHeightSampler contract.
- A normal-route browser E2E that dynamically imports a separate Hestia canvas harness without TestBridge or main.ts changes.
- Unit, browser, screenshot, review, and full-regression evidence.

## Non-Goals

- No local voxel region, Surface-Handoff, voxel authority, or fully volumetric global planet.
- No final Hestia macro-geology, terrain streaming, collision, or surface gameplay.
- No Flight, Navigation, Autopilot, Physics-Spine, worker, streaming, voxel, world-generation, or surface-lab changes.
- No changes to presentation/render-backend core, main.ts, style.css, package files, CI, roadmap, or GitHub files during the initial phase.
- No new dependency, WASM, Shared Memory, Math.random, or TestBridge.

## Success

The same validated input snapshot always produces the same sorted selection and stable tile identities; visible front tiles are never removed by horizon culling; incomplete/failed/evicted child coverage never creates a hole; MeshArtifact hashes are stable; focused and full tests/builds pass; and the initial branch is pushed without a PR only after explicit approval.