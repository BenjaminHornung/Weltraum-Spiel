# Browser Voxel Representation Ladder V2 Evidence

This timestamp-free artifact is generated from the same in-memory result as the JSON summary.

## Result

- Status: **PASS**
- Route: `/`
- Scope: `pure-core-normal-route-chromium-proof`
- Exact E2E group: `test:e2e:core`
- TestBridge absent as own property and via `in`: `true`
- Visual UI claim: `false`
- Screenshot required: `false`
- Browser console/page/request/HTTP errors: `0/0/0/0`

## Deterministic observations

```json
{
  "descriptor": {
    "schemaVersion": "voxel-representation-ladder-v2",
    "descriptorId": "ladder.browser-proof.v2",
    "descriptorHash": "fnv1a64-v1:2006fd1a0fdd357c",
    "bandCount": 12,
    "productKinds": [
      "AdaptiveMicrovoxel",
      "VoxelRenderProxy",
      "DamageAwareObjectProxy",
      "SurfaceRegionProxy",
      "SurfaceTileProxy",
      "CelestialProxy"
    ],
    "culledIsSelectionOnly": true
  },
  "adaptiveAuthority": {
    "levels": [
      0,
      1,
      2,
      3,
      4
    ],
    "fixedTable": [
      {
        "level": 4,
        "cellSizeMeters": 0.125
      },
      {
        "level": 3,
        "cellSizeMeters": 0.25
      },
      {
        "level": 2,
        "cellSizeMeters": 0.5
      },
      {
        "level": 1,
        "cellSizeMeters": 1
      },
      {
        "level": 0,
        "cellSizeMeters": 2
      }
    ],
    "unchanged": true
  },
  "policies": {
    "Low": {
      "schemaVersion": "voxel-quality-policy-v2",
      "detail": "Low",
      "maximumVisualAdaptiveLevel": 2,
      "detailDistanceMeters": 750,
      "streamingBudget": "Low",
      "maximumEstimatedBytes": 64000000,
      "maximumWorkUnits": 100000,
      "maximumUploadUnits": 100000
    },
    "Ultra": {
      "schemaVersion": "voxel-quality-policy-v2",
      "detail": "Ultra",
      "maximumVisualAdaptiveLevel": 4,
      "detailDistanceMeters": 8000,
      "streamingBudget": "Ultra",
      "maximumEstimatedBytes": 512000000,
      "maximumWorkUnits": 1000000,
      "maximumUploadUnits": 1000000
    },
    "visualOnly": true,
    "authorityRequestEqual": true,
    "simulationRequirementsEqual": true
  },
  "sse": {
    "formula": "projectedErrorPixels = geometricErrorMeters * (viewportHeightPixels / (2 * tan(verticalFovRadians / 2))) / max(minimumDistanceMeters, centerDistanceMeters - boundsRadiusMeters)",
    "input": {
      "cameraPosition": {
        "x": 0,
        "y": 0,
        "z": 100
      },
      "boundsCenter": {
        "x": 0,
        "y": 0,
        "z": 0
      },
      "boundsRadiusMeters": 1,
      "viewportHeightPixels": 1000,
      "verticalFovRadians": 1.5707963267948966,
      "minimumDistanceMeters": 0.1,
      "geometricErrorMeters": 2
    },
    "vector": {
      "focalLengthPixels": 500.00000000000006,
      "centerDistanceMeters": 100,
      "distanceToBoundsMeters": 99,
      "projectedErrorPixels": 10.101010101010102,
      "projectedBoundsRadiusPixels": 5.050505050505051
    }
  },
  "hysteresis": {
    "thresholds": {
      "refineErrorPixels": 10,
      "collapseErrorPixels": 8,
      "cullDistanceMeters": 100000,
      "cullProjectedBoundsRadiusPixels": 0.01
    },
    "hold": {
      "renderSelection": {
        "kind": "Band",
        "bandId": "band.03"
      },
      "reasons": [
        "HysteresisHoldBeforeCollapse"
      ],
      "decisionHash": "fnv1a64-v1:f4c9c94a748998f5"
    },
    "refine": {
      "renderSelection": {
        "kind": "Band",
        "bandId": "band.03"
      },
      "reasons": [
        "RefinedAcrossBoundary"
      ],
      "decisionHash": "fnv1a64-v1:238a353cad2e4f02"
    },
    "collapse": {
      "renderSelection": {
        "kind": "Band",
        "bandId": "band.04"
      },
      "reasons": [
        "CollapsedAcrossBoundary"
      ],
      "decisionHash": "fnv1a64-v1:bf2caee567a1f87b"
    },
    "candidateOrderIndependent": true
  },
  "pins": {
    "reasons": [
      "CollisionRequired",
      "ToolInteraction",
      "Explosion",
      "ProjectileImpact",
      "MeteorImpact",
      "StructuralFracture"
    ],
    "requestedLevels": [
      4,
      4,
      4,
      4,
      4,
      4
    ],
    "requiredForCoverage": [
      true,
      true,
      true,
      true,
      true,
      true
    ]
  },
  "lowUltra": {
    "renderSelections": {
      "Low": {
        "kind": "Band",
        "bandId": "band.04"
      },
      "Ultra": {
        "kind": "Band",
        "bandId": "band.03"
      }
    },
    "hardAuthorityRequestsEqual": true,
    "simulationRequirementsEqual": true,
    "sourceBindingsEqual": true,
    "lowDecisionHash": "fnv1a64-v1:1fd6e2ae4df398ed",
    "ultraDecisionHash": "fnv1a64-v1:60556918c4b1148d"
  },
  "culling": {
    "renderSelection": {
      "kind": "Culled"
    },
    "decisionHash": "fnv1a64-v1:3ce9fef62f9ca269"
  },
  "proxyInteraction": {
    "status": "READY",
    "authorityCoordinates": {
      "x": 4,
      "y": 5,
      "z": 6
    },
    "authorityRequest": {
      "requestId": "request.browser.tool",
      "reason": "ToolInteraction",
      "region": {
        "kind": "sphere",
        "center": {
          "x": 4,
          "y": 5,
          "z": 6
        },
        "radiusQuantum": 1
      },
      "targetLevel": 4,
      "requiredForCoverage": true,
      "priority": 5
    }
  },
  "proxyRejections": {
    "stale": {
      "status": "Rejected",
      "code": "StaleObjectRevision"
    },
    "damaged": {
      "status": "Rejected",
      "code": "DamageDigestMismatch"
    },
    "objectProxyHash": "fnv1a64-v1:ec332e1c8e1fd802"
  },
  "typedRejections": {
    "malformed": {
      "code": "InvalidContract",
      "path": "descriptor/bands/0/geometricErrorMeters"
    },
    "over32Bands": {
      "code": "InvalidContract",
      "path": "descriptor/bands"
    },
    "overCapEntryReads": 0
  },
  "fallback": [
    {
      "readyChildren": 0,
      "decision": {
        "groupId": "fallback.browser",
        "settledCoverage": "Parent",
        "parentId": "parent.coarse",
        "childIds": [],
        "reason": "ParentRetainedUntilAtomicReplacement"
      },
      "hash": "fnv1a64-v1:2bf1cdd08094b217"
    },
    {
      "readyChildren": 1,
      "decision": {
        "groupId": "fallback.browser",
        "settledCoverage": "Parent",
        "parentId": "parent.coarse",
        "childIds": [],
        "reason": "ParentRetainedUntilAtomicReplacement"
      },
      "hash": "fnv1a64-v1:2bf1cdd08094b217"
    },
    {
      "readyChildren": 63,
      "decision": {
        "groupId": "fallback.browser",
        "settledCoverage": "Parent",
        "parentId": "parent.coarse",
        "childIds": [],
        "reason": "ParentRetainedUntilAtomicReplacement"
      },
      "hash": "fnv1a64-v1:2bf1cdd08094b217"
    },
    {
      "readyChildren": 64,
      "decision": {
        "groupId": "fallback.browser",
        "settledCoverage": "Children",
        "parentId": null,
        "childIds": [
          "child.00",
          "child.01",
          "child.02",
          "child.03",
          "child.04",
          "child.05",
          "child.06",
          "child.07",
          "child.08",
          "child.09",
          "child.10",
          "child.11",
          "child.12",
          "child.13",
          "child.14",
          "child.15",
          "child.16",
          "child.17",
          "child.18",
          "child.19",
          "child.20",
          "child.21",
          "child.22",
          "child.23",
          "child.24",
          "child.25",
          "child.26",
          "child.27",
          "child.28",
          "child.29",
          "child.30",
          "child.31",
          "child.32",
          "child.33",
          "child.34",
          "child.35",
          "child.36",
          "child.37",
          "child.38",
          "child.39",
          "child.40",
          "child.41",
          "child.42",
          "child.43",
          "child.44",
          "child.45",
          "child.46",
          "child.47",
          "child.48",
          "child.49",
          "child.50",
          "child.51",
          "child.52",
          "child.53",
          "child.54",
          "child.55",
          "child.56",
          "child.57",
          "child.58",
          "child.59",
          "child.60",
          "child.61",
          "child.62",
          "child.63"
        ],
        "reason": "AllRequiredCurrentChildrenReady"
      },
      "hash": "fnv1a64-v1:cb2467c257bf4472"
    }
  ]
}
```

## Explicit runtime gaps

- No production planetary voxel streaming consumer is proven.
- No proxy mesh generation or renderer integration is proven.
- No physics handoff or building-collapse runtime is proven.
- No live player-settings application is proven.

## Excluded claims

- visual UI behavior
- renderer authority
- streaming runtime
- worker integration
- physics integration
- building collapse
- live settings consumption
- TestBridge integration
