# Ship Kit Mesh Validation Report

- Result: PASS
- Object count: 475
- Mesh count: 266
- Material count: 14
- Meshes with material assignment: 266
- Connector/nozzle/muzzle empties: 103
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
- Missing Demo Scout functional markers: 0
- Demo Scout turret hierarchy issues: 0

## Notes

- Materials are expected to be opaque for this prototype, including the dark-blue canopy.
- Blender 5 reports alpha-1 materials as HASHED/DITHERED; this report treats them as opaque-compatible when alpha is 1 and surface mode is not BLENDED.
- Connector, nozzle, and muzzle empties are intentionally counted as builder/gameplay metadata.
- Demo Scout runtime markers are required: main/RCS nozzles and WEAPON_* turret/muzzle markers fail this report when missing.
- Marker axes: Unity forward is force/projectile direction; plume VFX renders opposite the nozzle forward axis.
- Boundary edge count is expected to remain zero for the current solid low-poly kit.
