import type {SourceOnlyReceiver} from "./descriptor";

// Source-only data: no value import, loader, registration or startup.
export const receiver: SourceOnlyReceiver = {
  "schema": "phy02.activation.source-receiver.r03",
  "status": "SOURCE_ONLY",
  "slotStatus": "NOT_SLOT_READY",
  "grants": "NO_GRANTS",
  "startup": "FORBIDDEN",
  "selectedPreparation": {
    "regressions": 18,
    "originalSleepFail": 6,
    "total": 24,
    "populations": 6,
    "newRuntimeExecutions": 0
  },
  "historicalMatrix": {
    "cases": 192,
    "rawPASS": 146,
    "rawFAIL": 46,
    "remainingNativeMechanisms": 40,
    "status": "UNCHANGED_INDEPENDENT_HISTORICAL"
  },
  "sourceMode": {
    "overlayExtension": ".ts.source",
    "loaderInvocations": 0,
    "candidateInit": "DEFERRED_REAL_WASM_LOAD_NOT_CALLED",
    "runtimeResolver": "NOT_QUALIFIED",
    "role": "DATA_AND_SOURCE_ONLY_RECEIVER"
  },
  "candidate": {
    "id": "rapier-0.21.0-phy01.migration2",
    "npmBase": "0.21.0",
    "engineVersion": "0.36.0",
    "parry3dVersion": "0.31.1",
    "vanillaSubstitution": false,
    "vendorCount": 99,
    "wasmSHA256": "ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9",
    "cargoLockSHA256": "49d71b43e4c15d137121f19b917d110f28ab6e49334f5b77bf8de1d75fec2762",
    "adapter": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/producer/src/rapier021Candidate.ts",
      "bytes": 4609,
      "sha256": "c82480009bad0f02f7faef0c9bb0d2bbe44b3fc5702deecc66345458025b7cbb"
    },
    "factory": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/src/fork.ts",
      "bytes": 1877,
      "sha256": "65ee82116ac701c49e5866e3cfaede12ecd885aef7bf2bc3291e5be4f5e51205"
    },
    "profile": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/producer/snapshot/c/src/hestia-prototype/physics/profile.ts",
      "bytes": 3901,
      "sha256": "03d8c8d4d17903c601b8c3b804d0a6ec99a14dd16d17ef09262315ea3c93c32d"
    },
    "stageEdit": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/activation-source-contract-r02/candidates/stageEdit.ts",
      "bytes": 2552,
      "sha256": "c4f2304ba3d5c3a55cca833b2a3553e297931c6a2928fec96f3e68b2d1bdf2eb"
    },
    "stagedOperations": {
      "commit": "commit",
      "cancel": "rollback",
      "matureProtocolAdoption": false
    }
  },
  "fixture": {
    "recordPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/supplemental-05/fixtures.json",
    "recordBytes": 1451826,
    "recordSHA256": "7b9b75990dc2840f7b2958493e252ae0b56e4d81e00804feaf27235c6d2cb276",
    "pointer": "/records/1",
    "id": "perforated-wall",
    "cellSize": 0.125,
    "cellCount": 23,
    "sourceDigest": "fa3bdc7f4ebf56c9b1772bd4b4d5c45be707ac03d2ab94b7470308093fe545ac",
    "generator": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/previous/src/fixtures.ts",
      "bytes": 5097,
      "sha256": "90299cd4d8973ce956a05ebd466a174b961069f8156098f499f9176008197edd"
    },
    "generatorArguments": [
      "perforated-wall",
      0.125
    ],
    "originalRemoval": "removed=f.cells[0]; next.cells=f.cells.filter(c=>c!==removed)",
    "preparedRemoval": "next.cells=f.cells.slice(1)",
    "detachedOriginal": {
      "id": "detached",
      "cells": "[removed]",
      "origin": [
        1,
        0,
        0
      ]
    },
    "oracleChanges": 0
  },
  "selectedPopulations": [
    {
      "profile": "legacy-impulse-v1",
      "kind": "triangles",
      "dynamicGyroscopicForces": false,
      "worldConstructor": "World",
      "sourceStatus": "SOURCE_ONLY",
      "futureCaseCount": 4,
      "preparedRegressionTitles": [
        "legacy-impulse-v1/triangles: transfer latest activation (sleeping) without ghosts or profile rewrite",
        "legacy-impulse-v1/triangles: transfer latest activation (awake) without ghosts or profile rewrite",
        "legacy-impulse-v1/triangles: transfer latest activation (wakes-after-stage) without ghosts or profile rewrite"
      ],
      "originalSleepFail": {
        "id": "legacy-impulse-v1-triangles-lifecycle::dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "matrixOrdinal": 146,
        "title": "dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "rawStatus": "FAIL",
        "rawPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/legacy-impulse-v1-triangles-lifecycle.observations.json",
        "rawSha256": "c0fd48bf1988a503ff904206ec4a8fdaaea98351c1e23a0b6139437764bc6d92",
        "pointer": "/records/1",
        "vitestPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/legacy-impulse-v1-triangles-lifecycle.vitest.json",
        "vitestSha256": "362fcd2b632ee69ddcfe765afe7a1520fb6c5775f79aa7a35f75ae60681d23f5",
        "vitestStatus": "failed"
      },
      "futureTitleRegex": "^(?:dynamic staged recut preserves active state and detached disposal leaves no ghosts|legacy-impulse-v1/triangles: transfer latest activation \\(sleeping\\) without ghosts or profile rewrite|legacy-impulse-v1/triangles: transfer latest activation \\(awake\\) without ghosts or profile rewrite|legacy-impulse-v1/triangles: transfer latest activation \\(wakes-after-stage\\) without ghosts or profile rewrite)$",
      "futureBindingRequirements": {
        "PHY02_PROFILE": "legacy-impulse-v1",
        "PHY02_KIND": "triangles",
        "outputOwner": "LATER_EXPLICIT_GRANT_ONLY"
      },
      "newRuntimeStatus": "NOT_RUN"
    },
    {
      "profile": "legacy-impulse-v1",
      "kind": "multi-cuboid",
      "dynamicGyroscopicForces": false,
      "worldConstructor": "World",
      "sourceStatus": "SOURCE_ONLY",
      "futureCaseCount": 4,
      "preparedRegressionTitles": [
        "legacy-impulse-v1/multi-cuboid: transfer latest activation (sleeping) without ghosts or profile rewrite",
        "legacy-impulse-v1/multi-cuboid: transfer latest activation (awake) without ghosts or profile rewrite",
        "legacy-impulse-v1/multi-cuboid: transfer latest activation (wakes-after-stage) without ghosts or profile rewrite"
      ],
      "originalSleepFail": {
        "id": "legacy-impulse-v1-multi-cuboid-lifecycle::dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "matrixOrdinal": 114,
        "title": "dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "rawStatus": "FAIL",
        "rawPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/legacy-impulse-v1-multi-cuboid-lifecycle.observations.json",
        "rawSha256": "b5ecaf3d13b2d30bc467abd13c9017378840eb6dd52c118b799565c1f25f834b",
        "pointer": "/records/1",
        "vitestPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/legacy-impulse-v1-multi-cuboid-lifecycle.vitest.json",
        "vitestSha256": "acf28a39a25d3c25425ee44954c9481dd9cdff904f053869173a7f9b7943387b",
        "vitestStatus": "failed"
      },
      "futureTitleRegex": "^(?:dynamic staged recut preserves active state and detached disposal leaves no ghosts|legacy-impulse-v1/multi-cuboid: transfer latest activation \\(sleeping\\) without ghosts or profile rewrite|legacy-impulse-v1/multi-cuboid: transfer latest activation \\(awake\\) without ghosts or profile rewrite|legacy-impulse-v1/multi-cuboid: transfer latest activation \\(wakes-after-stage\\) without ghosts or profile rewrite)$",
      "futureBindingRequirements": {
        "PHY02_PROFILE": "legacy-impulse-v1",
        "PHY02_KIND": "multi-cuboid",
        "outputOwner": "LATER_EXPLICIT_GRANT_ONLY"
      },
      "newRuntimeStatus": "NOT_RUN"
    },
    {
      "profile": "legacy-impulse-v1",
      "kind": "voxels",
      "dynamicGyroscopicForces": false,
      "worldConstructor": "World",
      "sourceStatus": "SOURCE_ONLY",
      "futureCaseCount": 4,
      "preparedRegressionTitles": [
        "legacy-impulse-v1/voxels: transfer latest activation (sleeping) without ghosts or profile rewrite",
        "legacy-impulse-v1/voxels: transfer latest activation (awake) without ghosts or profile rewrite",
        "legacy-impulse-v1/voxels: transfer latest activation (wakes-after-stage) without ghosts or profile rewrite"
      ],
      "originalSleepFail": {
        "id": "legacy-impulse-v1-voxels-lifecycle::dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "matrixOrdinal": 178,
        "title": "dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "rawStatus": "FAIL",
        "rawPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/legacy-impulse-v1-voxels-lifecycle.observations.json",
        "rawSha256": "47a76a072a9e36dd17d6dc356b9955bc287a2cdf7ec0d649f0a0cd5781c28e65",
        "pointer": "/records/1",
        "vitestPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/legacy-impulse-v1-voxels-lifecycle.vitest.json",
        "vitestSha256": "c06f70b8956255c9ef57f913ae5d34aa9979b272cea3dcd4e896d3dbe37ed792",
        "vitestStatus": "failed"
      },
      "futureTitleRegex": "^(?:dynamic staged recut preserves active state and detached disposal leaves no ghosts|legacy-impulse-v1/voxels: transfer latest activation \\(sleeping\\) without ghosts or profile rewrite|legacy-impulse-v1/voxels: transfer latest activation \\(awake\\) without ghosts or profile rewrite|legacy-impulse-v1/voxels: transfer latest activation \\(wakes-after-stage\\) without ghosts or profile rewrite)$",
      "futureBindingRequirements": {
        "PHY02_PROFILE": "legacy-impulse-v1",
        "PHY02_KIND": "voxels",
        "outputOwner": "LATER_EXPLICIT_GRANT_ONLY"
      },
      "newRuntimeStatus": "NOT_RUN"
    },
    {
      "profile": "gyroscopic-v1",
      "kind": "triangles",
      "dynamicGyroscopicForces": true,
      "worldConstructor": "GyroscopicWorld",
      "sourceStatus": "SOURCE_ONLY",
      "futureCaseCount": 4,
      "preparedRegressionTitles": [
        "gyroscopic-v1/triangles: transfer latest activation (sleeping) without ghosts or profile rewrite",
        "gyroscopic-v1/triangles: transfer latest activation (awake) without ghosts or profile rewrite",
        "gyroscopic-v1/triangles: transfer latest activation (wakes-after-stage) without ghosts or profile rewrite"
      ],
      "originalSleepFail": {
        "id": "gyroscopic-v1-triangles-lifecycle::dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "matrixOrdinal": 50,
        "title": "dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "rawStatus": "FAIL",
        "rawPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/gyroscopic-v1-triangles-lifecycle.observations.json",
        "rawSha256": "943b11d0d83b4b5760507e0f14eab8283f1070004170ad778dd530de75ec4123",
        "pointer": "/records/1",
        "vitestPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/gyroscopic-v1-triangles-lifecycle.vitest.json",
        "vitestSha256": "af4fd22fb4dc0b27ac8fa882118784082e598bc959ed884fec36bca81230d1cf",
        "vitestStatus": "failed"
      },
      "futureTitleRegex": "^(?:dynamic staged recut preserves active state and detached disposal leaves no ghosts|gyroscopic-v1/triangles: transfer latest activation \\(sleeping\\) without ghosts or profile rewrite|gyroscopic-v1/triangles: transfer latest activation \\(awake\\) without ghosts or profile rewrite|gyroscopic-v1/triangles: transfer latest activation \\(wakes-after-stage\\) without ghosts or profile rewrite)$",
      "futureBindingRequirements": {
        "PHY02_PROFILE": "gyroscopic-v1",
        "PHY02_KIND": "triangles",
        "outputOwner": "LATER_EXPLICIT_GRANT_ONLY"
      },
      "newRuntimeStatus": "NOT_RUN"
    },
    {
      "profile": "gyroscopic-v1",
      "kind": "multi-cuboid",
      "dynamicGyroscopicForces": true,
      "worldConstructor": "GyroscopicWorld",
      "sourceStatus": "SOURCE_ONLY",
      "futureCaseCount": 4,
      "preparedRegressionTitles": [
        "gyroscopic-v1/multi-cuboid: transfer latest activation (sleeping) without ghosts or profile rewrite",
        "gyroscopic-v1/multi-cuboid: transfer latest activation (awake) without ghosts or profile rewrite",
        "gyroscopic-v1/multi-cuboid: transfer latest activation (wakes-after-stage) without ghosts or profile rewrite"
      ],
      "originalSleepFail": {
        "id": "gyroscopic-v1-multi-cuboid-lifecycle::dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "matrixOrdinal": 18,
        "title": "dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "rawStatus": "FAIL",
        "rawPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/gyroscopic-v1-multi-cuboid-lifecycle.observations.json",
        "rawSha256": "1b92e3545e7bf96fe54a39e083174f568ef7ce4f4defd1eb60826aa4ee969a83",
        "pointer": "/records/1",
        "vitestPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/gyroscopic-v1-multi-cuboid-lifecycle.vitest.json",
        "vitestSha256": "a937429c63810cf8def29e73a640f34a862bd5b0c58999759dbab96e9f92cd25",
        "vitestStatus": "failed"
      },
      "futureTitleRegex": "^(?:dynamic staged recut preserves active state and detached disposal leaves no ghosts|gyroscopic-v1/multi-cuboid: transfer latest activation \\(sleeping\\) without ghosts or profile rewrite|gyroscopic-v1/multi-cuboid: transfer latest activation \\(awake\\) without ghosts or profile rewrite|gyroscopic-v1/multi-cuboid: transfer latest activation \\(wakes-after-stage\\) without ghosts or profile rewrite)$",
      "futureBindingRequirements": {
        "PHY02_PROFILE": "gyroscopic-v1",
        "PHY02_KIND": "multi-cuboid",
        "outputOwner": "LATER_EXPLICIT_GRANT_ONLY"
      },
      "newRuntimeStatus": "NOT_RUN"
    },
    {
      "profile": "gyroscopic-v1",
      "kind": "voxels",
      "dynamicGyroscopicForces": true,
      "worldConstructor": "GyroscopicWorld",
      "sourceStatus": "SOURCE_ONLY",
      "futureCaseCount": 4,
      "preparedRegressionTitles": [
        "gyroscopic-v1/voxels: transfer latest activation (sleeping) without ghosts or profile rewrite",
        "gyroscopic-v1/voxels: transfer latest activation (awake) without ghosts or profile rewrite",
        "gyroscopic-v1/voxels: transfer latest activation (wakes-after-stage) without ghosts or profile rewrite"
      ],
      "originalSleepFail": {
        "id": "gyroscopic-v1-voxels-lifecycle::dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "matrixOrdinal": 82,
        "title": "dynamic staged recut preserves active state and detached disposal leaves no ghosts",
        "rawStatus": "FAIL",
        "rawPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/gyroscopic-v1-voxels-lifecycle.observations.json",
        "rawSha256": "fd4ba6782bafdd7199813b94f0748c302ab2b26fed9ce936429a70b117b11eb8",
        "pointer": "/records/1",
        "vitestPath": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/runs/full-functional-04/gyroscopic-v1-voxels-lifecycle.vitest.json",
        "vitestSha256": "1a451a7ae1174642f2879a9033f39a3b65e54f8fc9760aeb7876405dc59c2c28",
        "vitestStatus": "failed"
      },
      "futureTitleRegex": "^(?:dynamic staged recut preserves active state and detached disposal leaves no ghosts|gyroscopic-v1/voxels: transfer latest activation \\(sleeping\\) without ghosts or profile rewrite|gyroscopic-v1/voxels: transfer latest activation \\(awake\\) without ghosts or profile rewrite|gyroscopic-v1/voxels: transfer latest activation \\(wakes-after-stage\\) without ghosts or profile rewrite)$",
      "futureBindingRequirements": {
        "PHY02_PROFILE": "gyroscopic-v1",
        "PHY02_KIND": "voxels",
        "outputOwner": "LATER_EXPLICIT_GRANT_ONLY"
      },
      "newRuntimeStatus": "NOT_RUN"
    }
  ],
  "overlaySources": {
    "typed18Origin": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/activation-source-contract-r02/regressions/activation-transfer.proposal.test.ts",
      "bytes": 2594,
      "sha256": "7586aa21a08a24f76b596aaadd4280fc45b9d418f01f8ee8045aef0f305a9ab4"
    },
    "prepared18": "overlays/prepared18.proposal.test.ts.source",
    "originalSix": "overlays/original-six.proposal.test.ts.source",
    "originalCallback": "overlays/original-six.callback.ts.source",
    "originalOracleSource": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/tests/matrix-lifecycle.test.ts",
      "bytes": 7752,
      "sha256": "f6bb010f3b49937d382cf1dbcf612b40ad4f4414d9d19b092d7a08df4b9d6978"
    },
    "originalCallbackBoundary": "Second functional callback only; exact unchanged title/body/assertions",
    "sourceImportDelta": "Only stageEdit rebound to retained R02 candidate; six-case import preamble isolates the original callback"
  },
  "importGraph": {
    "typed18Proof": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/activation-source-contract-r02/compiler-graph.json",
      "bytes": 94019,
      "sha256": "35b19c92605d9963bbed487a9c33c585f03dbeee94f82671f95402eb13a5d59d",
      "count": 365
    },
    "oldReceiverHarness": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/tests/harness.ts",
      "bytes": 2749,
      "sha256": "670a586672b7dbe6d024b679178fb7458e3e873fae910dd6caaf9139a08aa2cd"
    },
    "futureWasmCapture": {
      "path": "spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/tests/wasm-binding.ts",
      "bytes": 1121,
      "sha256": "d6ba329f54bbb435d73c74c3fa3668a2a6b50642a9a059597f790e4f18bf395f"
    },
    "sourceEdges": "source-import-edges.json",
    "newReceiverValueImports": 0,
    "engineClones": 0
  },
  "cleanupOwnership": {
    "originalSix": {
      "owner": "R01 withWorld case owner",
      "cleanup": "withWorld.finally world.free exactly once",
      "primaryError": "Retained and rethrown independently",
      "cleanupError": "Recorded as cleanup FAIL; only thrown when there is no primary",
      "poisonedProcess": "No continuing acceptance after native trap/free failure",
      "outputBinding": "Old harness requires explicit fresh own runs path; no such runtime path granted"
    },
    "prepared18": {
      "owner": "Each it callback creates its own world",
      "cleanup": "Existing callback finally world.free exactly once",
      "primaryError": "MAY_BE_MASKED_IF_FREE_ALSO_THROWS",
      "collector": "NO_INDEPENDENT_CLEANUP_OBSERVER_IN_EXISTING_SOURCE"
    },
    "futureRequirement": "Root-owned later driver must bind independent primary/cleanup raw observation for18 before any acceptance; do not infer free recovery or SDK.close permission",
    "nativeHeapRecovery": "UNPROVEN"
  },
  "openProofs": [
    "LATER_EXPLICIT_RUNNER_OR_A0_DISPOSITION_AND_HOST_HOLD_RELEASE",
    "Actual runtime module resolver and selected4-case discovery per population",
    "Fresh raw primary/cleanup observer/output ownership for18",
    "Use-time exact WASM capture and actual native24-case outcomes",
    "PublicSaveCold/colliderCAS/S2/qualifiedcost/Owner/Human/42Before1400/Planner"
  ],
  "ownerChoice": false
};
