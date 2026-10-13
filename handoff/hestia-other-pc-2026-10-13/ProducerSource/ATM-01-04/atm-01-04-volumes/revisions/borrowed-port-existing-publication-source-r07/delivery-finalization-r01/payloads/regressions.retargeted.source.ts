// A42/R07: concrete source-review regression specifications; no imports or top-level execution.
// Retargets R06 twelve prepared cases to actual frozen publication/reset/dispose sites; executes none.
export const publicationSourceRegressions = [
  {
    "id": "R07-01",
    "retainedOriginCase": "R06-01",
    "retainedSetup": {
      "deferInitialProjection": true,
      "backendRevision": 7,
      "frameId": "hvp:frame"
    },
    "retargetedSourceIds": [
      "P1",
      "B1",
      "D2"
    ],
    "setup": {
      "deferred": true,
      "emptyRepresentationSet": true
    },
    "sourceSequence": [
      "Leave original publication deferred or without shared representation frame",
      "Reach available backend render owner with projection undefined only as source review scenario"
    ],
    "expected": [
      "Original publisher returns without ApplyFrameProjection",
      "Backend render guard tests availability, not projection existence; Accepted is not atmosphere admission",
      "No frame/epoch=0 or empty image fallback"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "P1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          497,
          530
        ]
      },
      {
        "id": "B1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
            "bytes": 1380,
            "sha256": "5656b59685478c52ee69be7c3c2285415368d52d6345ea45267fc96f51dc6052"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
          "match": true
        },
        "lines": [
          1,
          39
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      }
    ]
  },
  {
    "id": "R07-02",
    "retainedOriginCase": "R06-02",
    "retainedSetup": {
      "position": {
        "x": 1,
        "y": 2,
        "z": 3
      },
      "orientation": {
        "x": 0,
        "y": 0,
        "z": 0,
        "w": 1
      },
      "near": 0.2,
      "far": 900,
      "aspect": 1.5,
      "verticalFovDegrees": 55
    },
    "retargetedSourceIds": [
      "C1",
      "H1",
      "B1",
      "P1",
      "D2"
    ],
    "setup": {
      "mode": "Fly",
      "pressedKeys": [
        "KeyW"
      ],
      "deltaSeconds": 0.05,
      "cameraPositionXBefore": 1,
      "dirty": false
    },
    "sourceSequence": [
      "Apply camera-only fly update inside batch with no projection request",
      "Batch flushIfReady returns because dirty=false",
      "Actual draw sees moved live camera; retained factory projection may still be old"
    ],
    "expected": [
      "Retained projection and live camera are different source moments",
      "No new publication/cameraEpoch is fabricated",
      "R07 conditional routing does not add updateProjection or silently reset history"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "C1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpCamera.ts",
            "bytes": 12227,
            "sha256": "52a1a4a0694f3acfbd2ee615bf1fb54cb73c9388d8889feef44a9e531bb3be5a"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpCamera.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpCamera.ts",
          "match": true
        },
        "lines": [
          107,
          148,
          167,
          196,
          215,
          245
        ]
      },
      {
        "id": "H1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          3173,
          3202
        ]
      },
      {
        "id": "B1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
            "bytes": 1380,
            "sha256": "5656b59685478c52ee69be7c3c2285415368d52d6345ea45267fc96f51dc6052"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
          "match": true
        },
        "lines": [
          1,
          39
        ]
      },
      {
        "id": "P1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          497,
          530
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      }
    ]
  },
  {
    "id": "R07-03",
    "retainedOriginCase": "R06-03",
    "retainedSetup": {
      "near": 0.2,
      "far": 900,
      "verticalFovDegrees": 55,
      "aspect": 1.5
    },
    "retargetedSourceIds": [
      "H1",
      "B1",
      "P1",
      "P4",
      "P5",
      "D2"
    ],
    "setup": {
      "dirty": true,
      "requestedNear": 0.2,
      "requestedAspect": 1.5,
      "cameraMovedInBatch": true
    },
    "sourceSequence": [
      "Request projection during physics phase",
      "camera.update completes before outer batch ends",
      "flush factory copies current camera then applyCameraProjection fround, visibility command, draw"
    ],
    "expected": [
      "Request time is not publication-copy time",
      "Factory near=0.2 is distinguished from Math.fround(0.2) applied camera near",
      "Source order does not prove final GPU Float32 buffers or current matrix/resource lease"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "H1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          3173,
          3202
        ]
      },
      {
        "id": "B1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
            "bytes": 1380,
            "sha256": "5656b59685478c52ee69be7c3c2285415368d52d6345ea45267fc96f51dc6052"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/presentation/synchronousBatch.ts",
          "match": true
        },
        "lines": [
          1,
          39
        ]
      },
      {
        "id": "P1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          497,
          530
        ]
      },
      {
        "id": "P4",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeCameraProjection.ts",
            "bytes": 1713,
            "sha256": "b93ace4a89df22b445ad2a16108e1bef5e8efce78c6bc3f122bf89884d7e08f3"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeCameraProjection.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeCameraProjection.ts",
          "match": true
        },
        "lines": [
          4,
          29
        ]
      },
      {
        "id": "P5",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          534,
          549
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      }
    ]
  },
  {
    "id": "R07-04",
    "retainedOriginCase": "R06-04",
    "retainedSetup": {
      "acceptedBackendRevision": 7,
      "nextBackendRevision": 8
    },
    "retargetedSourceIds": [
      "R1",
      "D2",
      "P3"
    ],
    "setup": {
      "backendRevisionBefore": 7,
      "nextBackendRevision": 8
    },
    "sourceSequence": [
      "Successful backend reset clears projection/visibility, rebuilds renderer and sets revision8",
      "Potential available render may occur with no new projection"
    ],
    "expected": [
      "Reset counter8 not image resource generation",
      "No old projection token carried as current frame",
      "Uncertain reset early returns retain original ownership/error path"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "R1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          584,
          616
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      },
      {
        "id": "P3",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          550,
          581
        ]
      }
    ]
  },
  {
    "id": "R07-05",
    "retainedOriginCase": "R06-05",
    "retainedSetup": {
      "acceptedBackendRevision": 7,
      "nextProjectionRevision": 2
    },
    "retargetedSourceIds": [
      "P3",
      "P5",
      "H1",
      "D1"
    ],
    "setup": {
      "projectionAccepted": true,
      "visibilityRejected": true
    },
    "sourceSequence": [
      "ApplyFrameProjection accepts and mutates camera/backend projection",
      "ApplyVisibilityPlan rejection throws via existing requireAccepted",
      "Batch propagates original error and HVP failFrame returns before draw"
    ],
    "expected": [
      "Projection acceptance alone not joint projection/visibility admission",
      "No swallowed error or synthesized fresh frame",
      "Original batch AggregateError semantics retained if action+flush both fail"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "P3",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          550,
          581
        ]
      },
      {
        "id": "P5",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          534,
          549
        ]
      },
      {
        "id": "H1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          3173,
          3202
        ]
      },
      {
        "id": "D1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          3147,
          3211,
          3214
        ]
      }
    ]
  },
  {
    "id": "R07-06",
    "retainedOriginCase": "R06-06",
    "retainedSetup": {
      "myEpoch": 4,
      "laterMountEpoch": 5
    },
    "retargetedSourceIds": [
      "R2",
      "R3",
      "D2"
    ],
    "setup": {
      "disposed": true,
      "supersededMount": true
    },
    "sourceSequence": [
      "Inspect existing mount disposed/backend DisposeBackend states",
      "Read no new shared HvpBootstrapHandle getter because R07 adds none"
    ],
    "expected": [
      "Backend guard remains BackendUnavailable when disposed/unavailable",
      "No new cleanup/disposal/producer lease call",
      "Original shared return remains dispose-only; R06 optional getter remains unapplied OPEN"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "R2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          618,
          676
        ]
      },
      {
        "id": "R3",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          968,
          1046
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      }
    ]
  },
  {
    "id": "R07-07",
    "retainedOriginCase": "R06-07",
    "retainedSetup": {
      "terrainOrigin": {
        "x": -16,
        "y": -8,
        "z": -16
      },
      "nextTerrainOrigin": {
        "x": 100,
        "y": 0,
        "z": 200
      },
      "sourceEpoch": 4,
      "sourceRevision": 2
    },
    "retargetedSourceIds": [
      "O1",
      "O2",
      "D2"
    ],
    "setup": {
      "terrainOriginBefore": {
        "x": -16,
        "y": -8,
        "z": -16
      },
      "terrainOriginAfter": {
        "x": 100,
        "y": 0,
        "z": 200
      }
    },
    "sourceSequence": [
      "Terrain root replacement changes current grid origin",
      "Compare with generic ProjectionShiftEvent source; no HVP camera wire appears"
    ],
    "expected": [
      "New terrain origin does not become camera/body/tangent origin",
      "No rebaseEpoch or CommonHistoryState constructed",
      "A0 must bind actual origin/camera/source publication before temporal usage"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "O1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
            "bytes": 28881,
            "sha256": "d35b37dfce3d3ba29ace56c9c63769054fd211bca012ad598d855e5783aca3cb"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
          "match": true
        },
        "lines": [
          140,
          150,
          340,
          350
        ]
      },
      {
        "id": "O2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/world/floatingOrigin.ts",
            "bytes": 2088,
            "sha256": "f83082ab4a697a1409129c7eaa9d6da4917b72677de193de44b8c8be5d79e1fa"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/world/floatingOrigin.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/world/floatingOrigin.ts",
          "match": true
        },
        "lines": [
          38,
          57
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      }
    ]
  },
  {
    "id": "R07-08",
    "retainedOriginCase": "R06-08",
    "retainedSetup": {
      "sourceEpoch": 4,
      "sourceRevision": 2,
      "backendRevision": 7,
      "publicationRevision": 9,
      "mountEpoch": 4
    },
    "retargetedSourceIds": [
      "P1",
      "R1",
      "O1",
      "R3"
    ],
    "setup": {
      "mountEpoch": 4,
      "sourceEpoch": 4,
      "sourceRevision": 2,
      "backendRevision": 7,
      "frameRevision": 9
    },
    "sourceSequence": [
      "Map each retained writer/counter independently at its source site",
      "Attempt no alias conversion to cameraEpoch/projectionEpoch/resourceGeneration"
    ],
    "expected": [
      "Same numeric values do not share authority",
      "No monotonic cross-owner token invented",
      "No coherent PresentationFrameBinding emitted"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "P1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          497,
          530
        ]
      },
      {
        "id": "R1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          584,
          616
        ]
      },
      {
        "id": "O1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
            "bytes": 28881,
            "sha256": "d35b37dfce3d3ba29ace56c9c63769054fd211bca012ad598d855e5783aca3cb"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
          "match": true
        },
        "lines": [
          140,
          150,
          340,
          350
        ]
      },
      {
        "id": "R3",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          968,
          1046
        ]
      }
    ]
  },
  {
    "id": "R07-09",
    "retainedOriginCase": "R06-09",
    "retainedSetup": {
      "windowWidth": 800,
      "windowHeight": 600,
      "dprAtMount": 1.5,
      "nextWidth": 1024,
      "nextHeight": 768,
      "laterDpr": 2
    },
    "retargetedSourceIds": [
      "V1",
      "C1",
      "V2",
      "D2"
    ],
    "setup": {
      "width": 800,
      "height": 600,
      "dprAtMount": 1.5,
      "nextWidth": 1024,
      "nextHeight": 768,
      "laterDpr": 2
    },
    "sourceSequence": [
      "Camera resize listener changes aspect/projection matrix",
      "HVP resizeViewport sets configured logical size; construction pixelRatio remains initial",
      "Generic settings adapter caps DPR/scale only in its separate source path"
    ],
    "expected": [
      "No current image pixel 1536x1152/2048x1536 calculation accepted as evidence",
      "Separate viewport/camera writes are not central resolution epoch",
      "DPR-at-mount is not freshly sampled/applied DPR on resize"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "V1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          1086,
          1092,
          1823,
          1831
        ]
      },
      {
        "id": "C1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpCamera.ts",
            "bytes": 12227,
            "sha256": "52a1a4a0694f3acfbd2ee615bf1fb54cb73c9388d8889feef44a9e531bb3be5a"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpCamera.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpCamera.ts",
          "match": true
        },
        "lines": [
          107,
          148,
          167,
          196,
          215,
          245
        ]
      },
      {
        "id": "V2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/graphicsSettingsAdapter.ts",
            "bytes": 11985,
            "sha256": "87658dc71a20a9221be96a431bf0e14d99427ee338bdd9a73342a08a3849f777"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/graphicsSettingsAdapter.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/graphicsSettingsAdapter.ts",
          "match": true
        },
        "lines": [
          131,
          151
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      }
    ]
  },
  {
    "id": "R07-10",
    "retainedOriginCase": "R06-10",
    "retainedSetup": {
      "previousWidth": 800,
      "previousHeight": 600,
      "requestedWidth": 1024,
      "requestedHeight": 768
    },
    "retargetedSourceIds": [
      "V1",
      "D2"
    ],
    "setup": {
      "requestWidth": 1024,
      "requestHeight": 768,
      "invalidWidth": 0,
      "optionalResizeMethod": "absent"
    },
    "sourceSequence": [
      "Inspect original invalid/unavailable resize rejection and missing optional method branch",
      "Do not insert acceptance fallback or actual size exporter"
    ],
    "expected": [
      "Original InvalidViewport/BackendNotAvailable returns retained",
      "Missing optional method not an accepted resource resize",
      "No default render/output dimension or null-as-0 proof"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "V1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          1086,
          1092,
          1823,
          1831
        ]
      },
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      }
    ]
  },
  {
    "id": "R07-11",
    "retainedOriginCase": "R06-11",
    "retainedSetup": {
      "requestedPort": "DEPTH",
      "authenticWeather": "absent",
      "authenticDepth": "absent",
      "cameraEpoch": "absent",
      "resourceGeneration": "absent"
    },
    "retargetedSourceIds": [
      "D2",
      "D3",
      "O1"
    ],
    "setup": {
      "weather": "absent",
      "opaqueDepth": "absent",
      "cameraEpoch": "absent",
      "resourceEpoch": "absent"
    },
    "sourceSequence": [
      "List existing local source pointers at draw site",
      "Retained R04 valid-port request with absent weather has first missing prerequisite",
      "Do not run validator or instantiate images"
    ],
    "expected": [
      "Conditional retained outcome Pending/WEATHER_READ_MISSING, not an executed result",
      "No depth/HDR/history/jitter/image lease/source tuple emitted",
      "All13 actual bundles remain BLOCKED"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "D2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          298,
          304
        ]
      },
      {
        "id": "D3",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts",
            "bytes": 15917,
            "sha256": "a2e02243c1ee237e7313708743912829dd24759871594954be783ffaa64c944d"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts",
          "match": true
        },
        "lines": [
          201,
          241
        ]
      },
      {
        "id": "O1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
            "bytes": 28881,
            "sha256": "d35b37dfce3d3ba29ace56c9c63769054fd211bca012ad598d855e5783aca3cb"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan.ts",
          "match": true
        },
        "lines": [
          140,
          150,
          340,
          350
        ]
      }
    ]
  },
  {
    "id": "R07-12",
    "retainedOriginCase": "R06-12",
    "retainedSetup": {
      "staticLighting": "present",
      "privateShadowRevision": "present",
      "transparentWaterOpacity": 0.55,
      "depthWrite": false,
      "authenticLightning": "absent",
      "reactive": "absent",
      "history": "absent"
    },
    "retargetedSourceIds": [
      "D1",
      "D3",
      "D4",
      "R2"
    ],
    "setup": {
      "submitDraw": false,
      "backendResult": "Accepted",
      "staticShadowCache": "present",
      "lightning": "absent",
      "history": "absent",
      "waterOpacity": 0.55,
      "waterDepthWrite": false
    },
    "sourceSequence": [
      "Inspect diagnostic draw suppression wrapper and cutObservation callback path",
      "Compare backend Accepted/mount Ready/private shadow revision with absent GPU/light/reactive/history evidence"
    ],
    "expected": [
      "Accepted draw callback result may be returned even when actual GPU draw suppressed; no pixel/temporalReady proof",
      "Private shadow cache and zero-lightning not genuine temporal/light inputs",
      "Transparent water stays transparent; no producer handle disposal or fabricated velocity/pixels"
    ],
    "programme": "NOT_RUN",
    "actualRun": null,
    "sourceBindings": [
      {
        "id": "D1",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          3147,
          3211,
          3214
        ]
      },
      {
        "id": "D3",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts",
            "bytes": 15917,
            "sha256": "a2e02243c1ee237e7313708743912829dd24759871594954be783ffaa64c944d"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts",
          "match": true
        },
        "lines": [
          201,
          241
        ]
      },
      {
        "id": "D4",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
            "bytes": 233635,
            "sha256": "d671499ba5f735013ae2e06a04ec225d408648ceb0c49d6072202f26e8804dbc"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/hvp/hvpBootstrap.ts",
          "match": true
        },
        "lines": [
          1094,
          1101,
          3211,
          3218
        ]
      },
      {
        "id": "R2",
        "source": {
          "member": {
            "path": "apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
            "bytes": 51369,
            "sha256": "c1c32b35c10f1e0732b917e7cef9c4e65350cfabe412a1ef983365c29b0436c8"
          },
          "canonicalPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-fresh-canonical-r01/frozen/canonical-fresh-r01/snapshot/source/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "driverPath": "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-browser-driver-r03/frozen/browser-driver-r03/snapshot/runtime/apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts",
          "match": true
        },
        "lines": [
          618,
          676
        ]
      }
    ]
  }
] as const;
export const disposition = {prepared:12, executed:0, status:"NOT_RUN",
  population:"R07_PREPARED_SOURCE_ORDER_METADATA_CASES", historicalR03:20, historicalR04:12,
  historicalReplayed:0, temporalReady:false, productIntegration:"NO"} as const;
