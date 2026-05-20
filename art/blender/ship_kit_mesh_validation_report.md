# Ship Kit Mesh Validation Report

- Result: PASS
- Object count: 473
- Mesh count: 266
- Material count: 13
- Meshes with material assignment: 266
- Connector/nozzle/muzzle empties: 101
- Negative scale objects: 0
- Meshes missing materials: 0
- Non-opaque materials: 0
- Loose vertices: 0
- Loose edges: 0
- Loose faces: 0
- Non-manifold edges: 0
- Boundary edges: 0
- Zero-area faces: 0
- Missing exports: 0

## Notes

- Materials are expected to be opaque for this prototype, including the dark-blue canopy.
- Blender 5 reports alpha-1 materials as HASHED/DITHERED; this report treats them as opaque-compatible when alpha is 1 and surface mode is not BLENDED.
- Connector, nozzle, and muzzle empties are intentionally counted as builder/gameplay metadata.
- Boundary edge count is expected to remain zero for the current solid low-poly kit.
