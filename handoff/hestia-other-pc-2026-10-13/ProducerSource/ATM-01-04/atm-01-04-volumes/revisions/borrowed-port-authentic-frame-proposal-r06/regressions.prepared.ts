// A41/R06: prepared source specifications only. No imports, harness, top-level calls or execution.
// A0 must supply an authorized existing-owner harness before turning these assertions into executed tests.
export const frameScalarRegressionSources = [
  {
    "id": "R06-01",
    "source": "hvpBootstrap.ts:publishCurrentSet/deferInitialProjection",
    "setup": {
      "deferInitialProjection": true,
      "backendRevision": 7,
      "frameId": "hvp:frame"
    },
    "actions": [
      "admit a representation while initial projection is deferred",
      "readPublishedProjectionScalars()"
    ],
    "assertions": [
      "projection === undefined",
      "no ApplyFrameProjection command was added by the getter"
    ],
    "expect": "Pending: projection publication absent; no zero pose/fov/epoch substitute."
  },
  {
    "id": "R06-02",
    "source": "hvpBootstrap.ts:publishCurrentSet/FrameProjectionSnapshot",
    "setup": {
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
    "actions": [
      "accept projection and visibility; read p1",
      "change live camera.position.x to 9 without publication",
      "read p2",
      "publish again; read p3"
    ],
    "assertions": [
      "p1.cameraPositionRelative.x === 1",
      "p2.cameraPositionRelative.x === 1",
      "p3.cameraPositionRelative.x === 9",
      "p1.cameraPositionRelative.x === 1",
      "Object.isFrozen(p1.cameraPositionRelative)"
    ],
    "expect": "Last publication is immutable, not a live-camera-currentness proof. Overall proposal remains Pending."
  },
  {
    "id": "R06-03",
    "source": "hvpBootstrap.ts:publishCurrentSet + threeCameraProjection.ts:applyCameraProjection",
    "setup": {
      "near": 0.2,
      "far": 900,
      "verticalFovDegrees": 55,
      "aspect": 1.5
    },
    "actions": [
      "accept p1",
      "change near to 0.4 and aspect to 2 before next publication",
      "inspect proposed and live values independently"
    ],
    "assertions": [
      "p1.projectionParameters.near === 0.2",
      "p1.projectionParameters.aspect === 1.5",
      "!('currentProjectionUnjittered' in p1)",
      "!('cameraEpoch' in p1)",
      "!('projectionEpoch' in p1)"
    ],
    "expect": "Stale near/aspect cannot admit depth. No matrix, inverse or camera/projection epoch fabricated; A0 defines discontinuity rule."
  },
  {
    "id": "R06-04",
    "source": "hvpBootstrap.ts:recordDispatch/readPublishedProjectionScalars",
    "setup": {
      "acceptedBackendRevision": 7,
      "nextBackendRevision": 8
    },
    "actions": [
      "publish on backendRevision 7",
      "observe reset to 8 via the underlying backend",
      "read getter",
      "publish a new projection at 8"
    ],
    "assertions": [
      "staleRead === undefined",
      "freshRead.backendRevision === 8",
      "!('resourceGeneration' in freshRead)"
    ],
    "expect": "Backend revision mismatch hides last publication; backend reset counter is not image generation."
  },
  {
    "id": "R06-05",
    "source": "hvpBootstrap.ts:publishCurrentSet/requireAccepted",
    "setup": {
      "acceptedBackendRevision": 7,
      "nextProjectionRevision": 2
    },
    "actions": [
      "retain p1",
      "reject the next ApplyFrameProjection or ApplyVisibilityPlan",
      "read getter after the original error"
    ],
    "assertions": [
      "original requireAccepted error is retained",
      "projectionAfterFailure === undefined",
      "no dispose/release/render invoked by getter"
    ],
    "expect": "Failure is not a successful fresh publication; do not suppress existing rejection."
  },
  {
    "id": "R06-06",
    "source": "hvpBootstrap.ts:startHvpCore/myEpoch/successful handle",
    "setup": {
      "myEpoch": 4,
      "laterMountEpoch": 5
    },
    "actions": [
      "read a successful handle at mount 4",
      "dispose it or supersede mount epoch to 5",
      "read old optional getter"
    ],
    "assertions": [
      "oldHandle.readFrameScalarProposal() === undefined",
      "no backend/producer resource disposal is triggered by reading"
    ],
    "expect": "Closed/superseded mount cannot export current owner facts. Existing early-cancel/error handles may have no getter."
  },
  {
    "id": "R06-07",
    "source": "hvpBootstrap.ts:terrainRoot.read + cutPlan.ts:make/read",
    "setup": {
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
    "actions": [
      "read proposal A",
      "replace terrain owner with a different current origin",
      "read proposal B"
    ],
    "assertions": [
      "A.terrainSource.originMeters.x === -16",
      "B.terrainSource.originMeters.x === 100",
      "A.terrainSource.originMeters.x === -16",
      "!('originMeters' in B)",
      "B.status === 'Pending'"
    ],
    "expect": "Copied terrain grid origin is data in meters; it is not bound camera/body/tangent origin. Rebase event and camera association remain absent."
  },
  {
    "id": "R06-08",
    "source": "hvpBootstrap.ts:terrainSource/viewportRequest/projection",
    "setup": {
      "sourceEpoch": 4,
      "sourceRevision": 2,
      "backendRevision": 7,
      "publicationRevision": 9,
      "mountEpoch": 4
    },
    "actions": [
      "read all independently owned counters",
      "try to locate R04 cameraEpoch/projectionEpoch/resourceGeneration"
    ],
    "assertions": [
      "proposal.terrainSource.epoch === 4",
      "proposal.projection.backendRevision === 7",
      "proposal.projection.frameRevision === 9",
      "!('cameraEpoch' in proposal)",
      "!('resourceGeneration' in proposal)"
    ],
    "expect": "Do not alias terrain/mount/backend/publication counters to missing temporal epochs; atomic source/projection association is OwnerOPEN."
  },
  {
    "id": "R06-09",
    "source": "hvpBootstrap.ts:viewport init/resize; threeRenderBackend.ts:resizeViewport",
    "setup": {
      "windowWidth": 800,
      "windowHeight": 600,
      "dprAtMount": 1.5,
      "nextWidth": 1024,
      "nextHeight": 768,
      "laterDpr": 2
    },
    "actions": [
      "read configured mount request",
      "accept resize to 1024x768",
      "change browser DPR to 2 without renderer pixel-ratio reconfiguration",
      "read request"
    ],
    "assertions": [
      "request.width === 1024 && request.height === 768",
      "request.pixelRatioAtMount === 1.5",
      "!('imagePixels' in request)",
      "!('renderWidth' in request)",
      "!('outputWidth' in request)"
    ],
    "expect": "Configured logical dimensions and mount pixel-ratio setting do not prove 1536x1152, actual texture dimensions or current DPR. Actual image getter remains Pending."
  },
  {
    "id": "R06-10",
    "source": "hvpBootstrap.ts:resizeViewport/requireAccepted",
    "setup": {
      "previousWidth": 800,
      "previousHeight": 600,
      "requestedWidth": 1024,
      "requestedHeight": 768
    },
    "actions": [
      "reject resize, preserving existing requireAccepted error",
      "or use a backend with no optional resizeViewport method",
      "read previous request"
    ],
    "assertions": [
      "request.width === 800 && request.height === 600",
      "missing method is not Accepted",
      "no actual image-dimension evidence is emitted"
    ],
    "expect": "No new accepted-request record from rejection/absent method; failure semantics unchanged."
  },
  {
    "id": "R06-11",
    "source": "R04 borrowed-port-fixed.ts:validateBorrowedPort + R05 OWNER_GAPS",
    "setup": {
      "requestedPort": "DEPTH",
      "authenticWeather": "absent",
      "authenticDepth": "absent",
      "cameraEpoch": "absent",
      "resourceGeneration": "absent"
    },
    "actions": [
      "inspect proposed scalar getter result as source data",
      "do not construct WeatherAdmission or BorrowedImageRef",
      "record retained validator prerequisite only; do not execute it"
    ],
    "assertions": [
      "proposal.status === 'Pending' && proposal.temporalReady === false",
      "!('weatherSnapshotId' in proposal)",
      "!('depth' in proposal)",
      "!('history' in proposal)"
    ],
    "expect": "Actual valid-port request with absent weather remains Pending/WEATHER_READ_MISSING under retained R04 ordering; depth/history/jitter/resource proofs remain absent, all13 bundles BLOCKED."
  },
  {
    "id": "R06-12",
    "source": "R04 PresentationFrameBinding/light/reactive/history + frozen look/visualEffects",
    "setup": {
      "staticLighting": "present",
      "privateShadowRevision": "present",
      "transparentWaterOpacity": 0.55,
      "depthWrite": false,
      "authenticLightning": "absent",
      "reactive": "absent",
      "history": "absent"
    },
    "actions": [
      "inspect candidate data fields only",
      "reject proposals to substitute shadow revision, mount Ready, physics m/s, opaque water or zero-lightning"
    ],
    "assertions": [
      "!('lighting' in proposal)",
      "!('reactive' in proposal)",
      "!('velocity' in proposal)",
      "!('jitter' in proposal)",
      "no handle has a dispose/release method in scalar data"
    ],
    "expect": "Conditional retained Pending LIGHTNING_LIGHT_PROJECTION_MISSING/REACTIVE_COVERAGE_MISSING/PACKAGE_HISTORY_MISSING only after earlier inputs exist; no actual validator run, synthetic pixels or producer handle acceptance."
  }
] as const;
export const regressionDisposition = {
  prepared: 12, executed: 0, result: "NOT_RUN",
  population: "R06_PREPARED_SYNTHETIC_METADATA_SOURCE",
  historicalR03Unique: 20, historicalR04Unique: 12, historicalReplays: 0,
  temporalReady: false, productIntegration: "NO"
} as const;
