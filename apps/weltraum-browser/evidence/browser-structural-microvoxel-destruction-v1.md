# Browser Structural Microvoxel Destruction V1 Evidence

This timestamp-free artifact is generated from the same in-memory result as the JSON summary.

## Result

- Status: **PASS**
- Route: `/`
- Scope: `pure-core-browser-proof-via-direct-vite-import`
- TestBridge absent: `true`
- Visual UI change: `false`
- Browser console/page/request/HTTP errors: `0/0/0/0`
- Excluded claims: `runtime-wiring`, `renderer-integration`, `physics-integration`, `gameplay-integration`

This proves only pure Structural/Adaptive core execution inside Chromium through direct Vite imports on the normal application route. It does not claim runtime, renderer, physics, gameplay, or visual-product integration, and no screenshot is required because there is no visual UI change.

## Obligations

| ID | Status | Deterministic detail |
| --- | --- | --- |
| SMV-BROWSER-01 | PASS | Normal route loaded and both TestBridge absence checks passed before direct Vite imports. |
| SMV-BROWSER-02 | PASS | The 85-cell Level-4 fixture uses binary material 1 at 512 kg/m^3, or exactly 1 kg per cell. |
| SMV-BROWSER-03 | PASS | Center-inclusion SubtractSphere removed exactly neck cells z=1 and z=2: 2 cells and 2 kg. |
| SMV-BROWSER-04 | PASS | Six-neighbor classification yielded one 64-cell anchored base and one 19-cell detached upper component while both endpoints of the retained bridging Joint remained active without adding connectivity. |
| SMV-BROWSER-05 | PASS | Mass, COM, bounds, and all six symmetric inertia values are finite; every COM is inside its bounds. |
| SMV-BROWSER-06 | PASS | Identical repeats preserved component IDs/content hashes and object content/evidence/result hashes. |
| SMV-BROWSER-07 | PASS | Greedy mesh arrays are finite, axis-aligned, externally complete, and contain no occupied-to-occupied internal face. |
| SMV-BROWSER-08 | PASS | The proof exercises only public pure-core barrels and makes no runtime, renderer, physics, or gameplay integration claim. |

## Stable observations

```json
{
  "fixture": {
    "adaptiveLevel": 4,
    "occupiedBrickCount": 1,
    "knownAirNeighborBrickCount": 3,
    "materialId": 1,
    "densityKgPerCubicMeter": 512,
    "cellMassKg": 1,
    "base": "8x8 at z=0",
    "neck": "(8,8,z=1..3)",
    "upper": "3x3x2 at x/y=7..9,z=4..5"
  },
  "command": {
    "kind": "SubtractSphere",
    "space": "global-quantum",
    "centerQuantum": {
      "x": 8,
      "y": 8,
      "z": 2
    },
    "radiusQuantum": 1,
    "status": "Applied",
    "selectedVoxelCount": 2,
    "changedVoxelCount": 2
  },
  "mass": {
    "beforeVoxelCount": 85,
    "afterVoxelCount": 83,
    "beforeMassKg": 85,
    "afterMassKg": 83,
    "removedMassKg": 2,
    "componentMassesKg": [
      64,
      19
    ],
    "finite": true,
    "centersOfMassInsideBounds": true,
    "inertiaValueCountPerProduct": 6
  },
  "components": {
    "totalCount": 2,
    "anchoredCount": 1,
    "detachedCount": 1,
    "anchoredVoxelCount": 64,
    "detachedVoxelCount": 19,
    "jointsCreateConnectivity": false
  },
  "joint": {
    "jointId": "joint.base-to-upper",
    "remainsPresent": true,
    "endpointAActive": true,
    "endpointBActive": true,
    "endpointComponentIdsDistinct": true
  },
  "deterministicHashes": {
    "componentIdsEqual": true,
    "componentContentHashesEqual": true,
    "objectContentHashesEqual": true,
    "evidenceHashesEqual": true,
    "resultHashesEqual": true
  },
  "mesh": {
    "status": "Produced",
    "arraysFinite": true,
    "axisAlignedNormals": true,
    "noInternalFaces": true,
    "exposedUnitFaceCoverageExact": true
  }
}
```
