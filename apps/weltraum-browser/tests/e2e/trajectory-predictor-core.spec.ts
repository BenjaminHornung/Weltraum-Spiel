import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-shared-trajectory-predictor-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-shared-trajectory-predictor-core-v1.md");
const modulePath = "/src/trajectory/index.ts";
const focusedCommand = "npm run test:e2e -- tests/e2e/trajectory-predictor-core.spec.ts";

interface BrowserHealth {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface NormalRouteGuard {
  readonly route: string;
  readonly testBridgeOwnProperty: boolean;
  readonly testBridgeInWindow: boolean;
}

interface EvidenceVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface BrowserScenarioRun {
  readonly modulePath: string;
  readonly moduleLoaded: boolean;
  readonly importedPublicApi: readonly string[];
  readonly coast: {
    readonly status: "Completed";
    readonly predictionId: string;
    readonly frameId: string;
    readonly startTick: number;
    readonly endTick: number;
    readonly orbitalRadiusMeters: number;
    readonly initialSpeedMetersPerSecond: number;
    readonly segmentKind: "GravityCoast";
    readonly resolvedIntegrator: string;
    readonly integrationSteps: number;
    readonly totalSamples: number;
    readonly circularClosureWithinTolerance: boolean;
    readonly positionClosureDistanceMeters: number;
    readonly finiteOutput: boolean;
  };
  readonly accelerationImpulse: {
    readonly status: "Completed";
    readonly predictionId: string;
    readonly frameId: string;
    readonly startTick: number;
    readonly endTick: number;
    readonly segmentKinds: readonly string[];
    readonly accelerationIntegrator: string;
    readonly accelerationStepCount: number;
    readonly accelerationMetersPerSecondSquared: EvidenceVector3;
    readonly zeroAccelerationFinalPositionMeters: EvidenceVector3;
    readonly acceleratedFinalPositionMeters: EvidenceVector3;
    readonly accelerationPositionEffectMeters: EvidenceVector3;
    readonly zeroAccelerationFinalVelocityMetersPerSecond: EvidenceVector3;
    readonly acceleratedFinalVelocityMetersPerSecond: EvidenceVector3;
    readonly accelerationVelocityEffectMetersPerSecond: EvidenceVector3;
    readonly impulseTick: number;
    readonly impulseDeltaVelocityMetersPerSecond: EvidenceVector3;
    readonly preImpulseVelocityMetersPerSecond: EvidenceVector3;
    readonly postImpulseVelocityMetersPerSecond: EvidenceVector3;
    readonly resultingImpulseVelocityDeltaMetersPerSecond: EvidenceVector3;
    readonly positionPreservedByImpulse: boolean;
    readonly massPreservedByImpulse: boolean;
    readonly impulseSampleReasons: readonly string[];
    readonly totalIntegrationSteps: number;
    readonly totalSamples: number;
    readonly finiteOutput: boolean;
    readonly resultFrozen: boolean;
    readonly nestedOutputFrozen: boolean;
  };
  readonly hazard: {
    readonly status: "Completed";
    readonly predictionId: string;
    readonly frameId: string;
    readonly segmentKind: "GravityCoast";
    readonly resolvedIntegrator: string;
    readonly stepStartTick: number;
    readonly stepEndTick: number;
    readonly hazardId: string;
    readonly entryFraction: number;
    readonly exitFraction: number | null;
    readonly minimumCenterDistanceMeters: number;
    readonly minimumClearanceMeters: number;
    readonly startedInside: boolean;
    readonly tangent: boolean;
    readonly closestApproachHazardId: string;
    readonly finiteOutput: boolean;
  };
  readonly deterministicRepeat: {
    readonly predictionId: string;
    readonly canonicalSignature: string;
    readonly signaturesEqual: boolean;
    readonly canonicalResultsEqual: boolean;
  };
  readonly sourceApproximation: {
    readonly model: "InertialLinearPointMass";
    readonly sourceEpochTick: number;
    readonly ticksPerSecond: 120;
  };
}

interface TrajectoryEvidence {
  readonly schemaVersion: 1;
  readonly feature: "browser-shared-trajectory-predictor-core-v1";
  readonly route: NormalRouteGuard;
  readonly moduleLoad: {
    readonly path: string;
    readonly loaded: boolean;
    readonly importedPublicApi: readonly string[];
  };
  readonly runtime: {
    readonly nodeVersion: string;
    readonly browserEngine: "chromium";
    readonly realBrowserExecution: true;
    readonly ticksPerSecond: 120;
  };
  readonly scenarios: {
    readonly hestiaNearCircularCoast: BrowserScenarioRun["coast"];
    readonly hestiaAccelerationAndImpulse: BrowserScenarioRun["accelerationImpulse"];
    readonly hestiaFrameSweptSphericalHazard: BrowserScenarioRun["hazard"];
  };
  readonly sourceApproximation: BrowserScenarioRun["sourceApproximation"];
  readonly deterministicRepeat: BrowserScenarioRun["deterministicRepeat"];
  readonly browserHealth: BrowserHealth;
  readonly scope: readonly string[];
  readonly nonGoals: readonly string[];
  readonly verification: {
    readonly command: string;
    readonly expectedResult: string;
    readonly observedResult: "PASS";
    readonly screenshot: "not captured: renderer-independent core with no visible representation";
  };
  readonly status: "PASS";
}

const installBrowserHealthCollector = (page: Page): BrowserHealth => {
  const health: BrowserHealth = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: []
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      health.consoleErrors.push(`${message.text()}${location.url ? ` [${location.url}]` : ""}`);
    }
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    health.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      health.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return health;
};

const createMarkdown = (evidence: TrajectoryEvidence): string => `# Browser Shared Trajectory Predictor Core v1 Evidence

Status: **${evidence.status}**

## Browser boundary

- Normal route: \`${evidence.route.route}\`
- TestBridge own property / present in window: \`${evidence.route.testBridgeOwnProperty}\` / \`${evidence.route.testBridgeInWindow}\`
- Dynamic Vite import: \`${evidence.moduleLoad.path}\`
- Node / browser: \`${evidence.runtime.nodeVersion}\` / \`${evidence.runtime.browserEngine}\` (real browser: \`${evidence.runtime.realBrowserExecution}\`)
- Universe tick rate: \`${evidence.runtime.ticksPerSecond} Hz\`
- Console / page / request / HTTP errors: \`${evidence.browserHealth.consoleErrors.length}/${evidence.browserHealth.pageErrors.length}/${evidence.browserHealth.requestFailures.length}/${evidence.browserHealth.httpErrors.length}\`

## Hestia near-circular GravityCoast

- Status / frame: \`${evidence.scenarios.hestiaNearCircularCoast.status}\` / \`${evidence.scenarios.hestiaNearCircularCoast.frameId}\`
- Tick range: \`${evidence.scenarios.hestiaNearCircularCoast.startTick} -> ${evidence.scenarios.hestiaNearCircularCoast.endTick}\`
- Segment / policy: \`${evidence.scenarios.hestiaNearCircularCoast.segmentKind}\` / \`${evidence.scenarios.hestiaNearCircularCoast.resolvedIntegrator}\`
- Integration steps / samples: \`${evidence.scenarios.hestiaNearCircularCoast.integrationSteps}/${evidence.scenarios.hestiaNearCircularCoast.totalSamples}\`
- Orbital radius / initial speed: \`${evidence.scenarios.hestiaNearCircularCoast.orbitalRadiusMeters} m\` / \`${evidence.scenarios.hestiaNearCircularCoast.initialSpeedMetersPerSecond} m/s\`
- Circular closure within tolerance / distance: \`${evidence.scenarios.hestiaNearCircularCoast.circularClosureWithinTolerance}\` / \`${evidence.scenarios.hestiaNearCircularCoast.positionClosureDistanceMeters} m\`
- Finite output: \`${evidence.scenarios.hestiaNearCircularCoast.finiteOutput}\`

## Hestia ConstantInertialAcceleration and ImpulseDeltaV

- Status / tick range: \`${evidence.scenarios.hestiaAccelerationAndImpulse.status}\` / \`${evidence.scenarios.hestiaAccelerationAndImpulse.startTick} -> ${evidence.scenarios.hestiaAccelerationAndImpulse.endTick}\`
- Segment order: ${evidence.scenarios.hestiaAccelerationAndImpulse.segmentKinds.map((kind) => `\`${kind}\``).join(" -> ")}
- Acceleration policy / steps: \`${evidence.scenarios.hestiaAccelerationAndImpulse.accelerationIntegrator}\` / \`${evidence.scenarios.hestiaAccelerationAndImpulse.accelerationStepCount}\`
- Requested acceleration: \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.accelerationMetersPerSecondSquared)} m/s^2\`
- Zero-acceleration / accelerated final position: \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.zeroAccelerationFinalPositionMeters)} m\` / \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.acceleratedFinalPositionMeters)} m\`
- Observed acceleration position effect: \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.accelerationPositionEffectMeters)} m\`
- Zero-acceleration / accelerated final velocity: \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.zeroAccelerationFinalVelocityMetersPerSecond)} m/s\` / \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.acceleratedFinalVelocityMetersPerSecond)} m/s\`
- Observed acceleration velocity effect: \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.accelerationVelocityEffectMetersPerSecond)} m/s\`
- Impulse tick / delta-v: \`${evidence.scenarios.hestiaAccelerationAndImpulse.impulseTick}\` / \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.impulseDeltaVelocityMetersPerSecond)} m/s\`
- Impulse pre / post velocity: \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.preImpulseVelocityMetersPerSecond)} m/s\` / \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.postImpulseVelocityMetersPerSecond)} m/s\`
- Observed impulse velocity delta: \`${JSON.stringify(evidence.scenarios.hestiaAccelerationAndImpulse.resultingImpulseVelocityDeltaMetersPerSecond)} m/s\`
- Impulse preserves position / mass: \`${evidence.scenarios.hestiaAccelerationAndImpulse.positionPreservedByImpulse}\` / \`${evidence.scenarios.hestiaAccelerationAndImpulse.massPreservedByImpulse}\`
- Impulse sample reasons: ${evidence.scenarios.hestiaAccelerationAndImpulse.impulseSampleReasons.map((reason) => `\`${reason}\``).join(", ")}
- Finite / recursively frozen output: \`${evidence.scenarios.hestiaAccelerationAndImpulse.finiteOutput}\` / \`${evidence.scenarios.hestiaAccelerationAndImpulse.resultFrozen && evidence.scenarios.hestiaAccelerationAndImpulse.nestedOutputFrozen}\`

## Swept spherical hazard

- Status / frame: \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.status}\` / \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.frameId}\`
- Segment / policy: \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.segmentKind}\` / \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.resolvedIntegrator}\`
- Swept tick range: \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.stepStartTick} -> ${evidence.scenarios.hestiaFrameSweptSphericalHazard.stepEndTick}\`
- Hazard / entry / exit fractions: \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.hazardId}\` / \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.entryFraction}\` / \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.exitFraction}\`
- Minimum center distance / clearance: \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.minimumCenterDistanceMeters} m\` / \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.minimumClearanceMeters} m\`
- Started inside / tangent / finite: \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.startedInside}\` / \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.tangent}\` / \`${evidence.scenarios.hestiaFrameSweptSphericalHazard.finiteOutput}\`

## Determinism and approximation

- Source model: \`${evidence.sourceApproximation.model}\` at tick \`${evidence.sourceApproximation.sourceEpochTick}\`
- Repeated prediction: \`${evidence.deterministicRepeat.predictionId}\`
- Canonical signature: \`${evidence.deterministicRepeat.canonicalSignature}\`
- Signature / complete canonical result identical: \`${evidence.deterministicRepeat.signaturesEqual}\` / \`${evidence.deterministicRepeat.canonicalResultsEqual}\`

## Scope

${evidence.scope.map((item) => `- ${item}`).join("\n")}

## Non-goals

${evidence.nonGoals.map((item) => `- ${item}`).join("\n")}

## Focused verification

- Command: \`${evidence.verification.command}\`
- Expected: ${evidence.verification.expectedResult}
- Observed: **${evidence.verification.observedResult}**
- Screenshot: ${evidence.verification.screenshot}
`;

test("normal route imports and proves the deterministic shared trajectory predictor core", async ({ page, browserName }) => {
  const health = installBrowserHealthCollector(page);

  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const routeGuard = await page.evaluate((): NormalRouteGuard => ({
    route: location.pathname,
    testBridgeOwnProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    testBridgeInWindow: "TestBridge" in window
  }));
  expect(routeGuard).toEqual({ route: "/", testBridgeOwnProperty: false, testBridgeInWindow: false });

  const browserRun = await page.evaluate(async (): Promise<BrowserScenarioRun> => {
    const trajectoryModulePath = "/src/trajectory/index.ts";
    const trajectory = await import(trajectoryModulePath);
    const importedPublicApi = [
      "createHestiaCircularTrajectoryRequest",
      "createHestiaAccelerationImpulseTrajectoryRequest",
      "createHestiaTrajectoryHazard",
      "createTrajectoryPredictionId",
      "createTrajectorySegmentId",
      "predictTrajectory",
      "serializeCanonicalTrajectoryValue"
    ];
    for (const name of importedPublicApi) {
      if (typeof trajectory[name] !== "function") {
        throw new Error(`Missing trajectory public API ${name}.`);
      }
    }

    const allNumbersFinite = (value: unknown): boolean => {
      if (typeof value === "number") return Number.isFinite(value);
      if (value === null || typeof value !== "object") return true;
      if (Array.isArray(value)) return value.every(allNumbersFinite);
      return Object.values(value).every(allNumbersFinite);
    };
    const sameVector = (
      left: EvidenceVector3,
      right: EvidenceVector3
    ): boolean => left.x === right.x && left.y === right.y && left.z === right.z;
    const subtractVector = (left: EvidenceVector3, right: EvidenceVector3): EvidenceVector3 => ({
      x: left.x - right.x,
      y: left.y - right.y,
      z: left.z - right.z
    });
    const requireCompleted = (result: any, label: string): any => {
      if (result.status !== "Completed") {
        throw new Error(`${label} rejected: ${result.status} ${result.issues?.[0]?.message ?? "unknown"}`);
      }
      return result;
    };

    const coastRequest = trajectory.createHestiaCircularTrajectoryRequest();
    const coastResult = requireCompleted(trajectory.predictTrajectory(coastRequest), "Hestia coast");
    const coastSegment = coastResult.segmentResults[0];
    if (coastSegment?.kind !== "GravityCoast" || coastResult.metrics.circularClosure === null) {
      throw new Error("Hestia circular fixture did not publish its coast and closure facts.");
    }

    const accelerationImpulseRequest = trajectory.createHestiaAccelerationImpulseTrajectoryRequest();
    const accelerationImpulseFirst = requireCompleted(
      trajectory.predictTrajectory(accelerationImpulseRequest),
      "Hestia acceleration/impulse"
    );
    const accelerationImpulseSecond = requireCompleted(
      trajectory.predictTrajectory(accelerationImpulseRequest),
      "Repeated Hestia acceleration/impulse"
    );
    const accelerationRequest = accelerationImpulseRequest.segments[0];
    if (accelerationRequest?.kind !== "ConstantInertialAcceleration") {
      throw new Error("Hestia acceleration/impulse fixture did not publish its acceleration request.");
    }
    const zeroAccelerationRequest = {
      ...accelerationImpulseRequest,
      segments: [
        {
          ...accelerationRequest,
          accelerationMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
        },
        accelerationImpulseRequest.segments[1]
      ]
    };
    const zeroAccelerationResult = requireCompleted(
      trajectory.predictTrajectory(zeroAccelerationRequest),
      "Zero-additional-acceleration baseline"
    );
    const accelerationSegment = accelerationImpulseFirst.segmentResults[0];
    const zeroAccelerationSegment = zeroAccelerationResult.segmentResults[0];
    const impulseSegment = accelerationImpulseFirst.segmentResults[1];
    const impulseRequest = accelerationImpulseRequest.segments[1];
    if (
      accelerationSegment?.kind !== "ConstantInertialAcceleration" ||
      zeroAccelerationSegment?.kind !== "ConstantInertialAcceleration" ||
      impulseSegment?.kind !== "ImpulseDeltaV" ||
      impulseRequest?.kind !== "ImpulseDeltaV"
    ) {
      throw new Error("Hestia acceleration/impulse fixture did not publish the expected segment facts.");
    }
    const impulseSample = accelerationImpulseFirst.samples.find((sample: any) =>
      sample.reasons.includes("ImpulsePostState")
    );
    if (impulseSample === undefined) {
      throw new Error("Hestia acceleration/impulse fixture did not publish its impulse sample.");
    }
    const accelerationPositionEffectMeters = subtractVector(
      accelerationSegment.finalState.positionMeters,
      zeroAccelerationSegment.finalState.positionMeters
    );
    const accelerationVelocityEffectMetersPerSecond = subtractVector(
      accelerationSegment.finalState.velocityMetersPerSecond,
      zeroAccelerationSegment.finalState.velocityMetersPerSecond
    );
    const resultingImpulseVelocityDeltaMetersPerSecond = subtractVector(
      impulseSegment.postImpulseState.velocityMetersPerSecond,
      impulseSegment.preImpulseState.velocityMetersPerSecond
    );
    const firstCanonicalResult = trajectory.serializeCanonicalTrajectoryValue(accelerationImpulseFirst);
    const secondCanonicalResult = trajectory.serializeCanonicalTrajectoryValue(accelerationImpulseSecond);

    const hazardBase = trajectory.createHestiaAccelerationImpulseTrajectoryRequest();
    const sweptHazard = trajectory.createHestiaTrajectoryHazard(
      "hazard:hestia.browser-swept",
      { x: 0, y: 0, z: 0 },
      1,
      0
    );
    const hazardRequest = {
      ...hazardBase,
      predictionId: trajectory.createTrajectoryPredictionId("trajectory:hestia.browser-swept.v1"),
      initialState: {
        ...hazardBase.initialState,
        positionMeters: { x: -2, y: 0, z: 0 },
        velocityMetersPerSecond: { x: 4, y: 0, z: 0 }
      },
      gravitySource: {
        ...hazardBase.gravitySource,
        positionMeters: { x: 1e150, y: 0, z: 0 },
        gravitationalParameterMu: Number.MIN_VALUE
      },
      segments: [{
        kind: "GravityCoast",
        segmentId: trajectory.createTrajectorySegmentId("segment:hestia.browser-hazard-sweep"),
        frameId: hazardBase.initialState.frameId,
        startTick: 0,
        endTick: 120
      }],
      integratorPolicy: {
        ...hazardBase.integratorPolicy,
        gravityCoast: "SemiImplicitEuler"
      },
      stepTicks: 120,
      sampleEverySteps: 1,
      hazards: [sweptHazard]
    };
    const hazardResult = requireCompleted(trajectory.predictTrajectory(hazardRequest), "Hestia-frame swept hazard");
    const hazardSegment = hazardResult.segmentResults[0];
    const hazardEvent = hazardResult.hazardEvents[0];
    const closestApproach = hazardResult.closestApproaches[0];
    if (hazardSegment?.kind !== "GravityCoast" || hazardEvent === undefined || closestApproach === undefined) {
      throw new Error("Hestia-frame swept hazard did not publish segment, event and closest-approach facts.");
    }

    return {
      modulePath: trajectoryModulePath,
      moduleLoaded: true,
      importedPublicApi,
      coast: {
        status: coastResult.status,
        predictionId: coastResult.predictionId,
        frameId: coastResult.frameId,
        startTick: coastResult.startTick,
        endTick: coastResult.endTick,
        orbitalRadiusMeters: coastRequest.initialState.positionMeters.x,
        initialSpeedMetersPerSecond: coastRequest.initialState.velocityMetersPerSecond.y,
        segmentKind: coastSegment.kind,
        resolvedIntegrator: coastSegment.resolvedIntegrator,
        integrationSteps: coastSegment.integrationSteps,
        totalSamples: coastResult.metrics.totalSamples,
        circularClosureWithinTolerance: coastResult.metrics.circularClosure.withinTolerance,
        positionClosureDistanceMeters: coastResult.metrics.circularClosure.positionClosureDistanceMeters,
        finiteOutput: allNumbersFinite(coastResult)
      },
      accelerationImpulse: {
        status: accelerationImpulseFirst.status,
        predictionId: accelerationImpulseFirst.predictionId,
        frameId: accelerationImpulseFirst.frameId,
        startTick: accelerationImpulseFirst.startTick,
        endTick: accelerationImpulseFirst.endTick,
        segmentKinds: accelerationImpulseFirst.segmentResults.map((segment: any) => segment.kind),
        accelerationIntegrator: accelerationSegment.resolvedIntegrator,
        accelerationStepCount: accelerationSegment.integrationSteps,
        accelerationMetersPerSecondSquared: accelerationRequest.accelerationMetersPerSecondSquared,
        zeroAccelerationFinalPositionMeters: zeroAccelerationSegment.finalState.positionMeters,
        acceleratedFinalPositionMeters: accelerationSegment.finalState.positionMeters,
        accelerationPositionEffectMeters,
        zeroAccelerationFinalVelocityMetersPerSecond: zeroAccelerationSegment.finalState.velocityMetersPerSecond,
        acceleratedFinalVelocityMetersPerSecond: accelerationSegment.finalState.velocityMetersPerSecond,
        accelerationVelocityEffectMetersPerSecond,
        impulseTick: impulseSegment.tick,
        impulseDeltaVelocityMetersPerSecond: impulseRequest.deltaVelocityMetersPerSecond,
        preImpulseVelocityMetersPerSecond: impulseSegment.preImpulseState.velocityMetersPerSecond,
        postImpulseVelocityMetersPerSecond: impulseSegment.postImpulseState.velocityMetersPerSecond,
        resultingImpulseVelocityDeltaMetersPerSecond,
        positionPreservedByImpulse: sameVector(
          impulseSegment.preImpulseState.positionMeters,
          impulseSegment.postImpulseState.positionMeters
        ),
        massPreservedByImpulse:
          impulseSegment.preImpulseState.massKilograms === impulseSegment.postImpulseState.massKilograms,
        impulseSampleReasons: impulseSample.reasons,
        totalIntegrationSteps: accelerationImpulseFirst.metrics.totalIntegrationSteps,
        totalSamples: accelerationImpulseFirst.metrics.totalSamples,
        finiteOutput: allNumbersFinite(accelerationImpulseFirst),
        resultFrozen: Object.isFrozen(accelerationImpulseFirst),
        nestedOutputFrozen:
          Object.isFrozen(accelerationImpulseFirst.segmentResults) &&
          Object.isFrozen(accelerationImpulseFirst.samples) &&
          Object.isFrozen(impulseSegment.postImpulseState.velocityMetersPerSecond)
      },
      hazard: {
        status: hazardResult.status,
        predictionId: hazardResult.predictionId,
        frameId: hazardResult.frameId,
        segmentKind: hazardSegment.kind,
        resolvedIntegrator: hazardSegment.resolvedIntegrator,
        stepStartTick: hazardEvent.entry.stepStartTick,
        stepEndTick: hazardEvent.entry.stepEndTick,
        hazardId: hazardEvent.hazardId,
        entryFraction: hazardEvent.entry.fraction,
        exitFraction: hazardEvent.exit?.fraction ?? null,
        minimumCenterDistanceMeters: hazardEvent.minimumCenterDistanceMeters,
        minimumClearanceMeters: hazardEvent.minimumClearanceMeters,
        startedInside: hazardEvent.startedInside,
        tangent: hazardEvent.tangent,
        closestApproachHazardId: closestApproach.hazardId,
        finiteOutput: allNumbersFinite(hazardResult)
      },
      deterministicRepeat: {
        predictionId: accelerationImpulseFirst.predictionId,
        canonicalSignature: accelerationImpulseFirst.canonicalSignature,
        signaturesEqual:
          accelerationImpulseFirst.canonicalSignature === accelerationImpulseSecond.canonicalSignature,
        canonicalResultsEqual: firstCanonicalResult === secondCanonicalResult
      },
      sourceApproximation: coastResult.sourceApproximation
    };
  });

  expect(Number.parseInt(process.versions.node, 10)).toBe(22);
  expect(browserName).toBe("chromium");
  expect(browserRun.modulePath).toBe(modulePath);
  expect(browserRun.moduleLoaded).toBe(true);

  expect(browserRun.coast.status).toBe("Completed");
  expect(browserRun.coast.frameId).toBe("frame:body-inertial.planet.hestia");
  expect(browserRun.coast.segmentKind).toBe("GravityCoast");
  expect(browserRun.coast.resolvedIntegrator).toBe("VelocityVerlet");
  expect(browserRun.coast.integrationSteps).toBeGreaterThan(0);
  expect(browserRun.coast.circularClosureWithinTolerance).toBe(true);
  expect(browserRun.coast.positionClosureDistanceMeters).toBeGreaterThanOrEqual(0);
  expect(browserRun.coast.finiteOutput).toBe(true);

  expect(browserRun.accelerationImpulse.status).toBe("Completed");
  expect(browserRun.accelerationImpulse.frameId).toBe(browserRun.coast.frameId);
  expect(browserRun.accelerationImpulse.segmentKinds).toEqual([
    "ConstantInertialAcceleration",
    "ImpulseDeltaV"
  ]);
  expect(browserRun.accelerationImpulse.accelerationIntegrator).toBe("RungeKutta4");
  expect(browserRun.accelerationImpulse.accelerationStepCount).toBe(100);
  expect(browserRun.accelerationImpulse.accelerationMetersPerSecondSquared).toEqual({ x: 0, y: 0.1, z: 0 });
  expect(Object.values(browserRun.accelerationImpulse.accelerationPositionEffectMeters).every(Number.isFinite)).toBe(true);
  expect(Object.values(browserRun.accelerationImpulse.accelerationVelocityEffectMetersPerSecond).every(Number.isFinite)).toBe(true);
  expect(Object.values(browserRun.accelerationImpulse.accelerationPositionEffectMeters).some((value) => value !== 0)).toBe(true);
  expect(Object.values(browserRun.accelerationImpulse.accelerationVelocityEffectMetersPerSecond).some((value) => value !== 0)).toBe(true);
  expect(browserRun.accelerationImpulse.accelerationPositionEffectMeters.y).toBeGreaterThan(0);
  expect(browserRun.accelerationImpulse.accelerationVelocityEffectMetersPerSecond.y).toBeGreaterThan(0);
  expect(browserRun.accelerationImpulse.impulseTick).toBe(1_200);
  expect(browserRun.accelerationImpulse.impulseDeltaVelocityMetersPerSecond).toEqual({ x: 0, y: 10, z: 0 });
  expect(browserRun.accelerationImpulse.postImpulseVelocityMetersPerSecond).toEqual({
    x:
      browserRun.accelerationImpulse.preImpulseVelocityMetersPerSecond.x +
      browserRun.accelerationImpulse.impulseDeltaVelocityMetersPerSecond.x,
    y:
      browserRun.accelerationImpulse.preImpulseVelocityMetersPerSecond.y +
      browserRun.accelerationImpulse.impulseDeltaVelocityMetersPerSecond.y,
    z:
      browserRun.accelerationImpulse.preImpulseVelocityMetersPerSecond.z +
      browserRun.accelerationImpulse.impulseDeltaVelocityMetersPerSecond.z
  });
  expect(browserRun.accelerationImpulse.resultingImpulseVelocityDeltaMetersPerSecond).toEqual(
    browserRun.accelerationImpulse.impulseDeltaVelocityMetersPerSecond
  );
  expect(browserRun.accelerationImpulse.positionPreservedByImpulse).toBe(true);
  expect(browserRun.accelerationImpulse.massPreservedByImpulse).toBe(true);
  expect(browserRun.accelerationImpulse.impulseSampleReasons).toEqual(["ImpulsePostState", "Final"]);
  expect(browserRun.accelerationImpulse.totalIntegrationSteps).toBe(100);
  expect(browserRun.accelerationImpulse.finiteOutput).toBe(true);
  expect(browserRun.accelerationImpulse.resultFrozen).toBe(true);
  expect(browserRun.accelerationImpulse.nestedOutputFrozen).toBe(true);

  expect(browserRun.hazard.status).toBe("Completed");
  expect(browserRun.hazard.frameId).toBe(browserRun.coast.frameId);
  expect(browserRun.hazard.segmentKind).toBe("GravityCoast");
  expect(browserRun.hazard.resolvedIntegrator).toBe("SemiImplicitEuler");
  expect(browserRun.hazard.stepStartTick).toBe(0);
  expect(browserRun.hazard.stepEndTick).toBe(120);
  expect(browserRun.hazard.hazardId).toBe("hazard:hestia.browser-swept");
  expect(browserRun.hazard.entryFraction).toBeCloseTo(0.25, 12);
  expect(browserRun.hazard.exitFraction).toBeCloseTo(0.75, 12);
  expect(browserRun.hazard.minimumCenterDistanceMeters).toBe(0);
  expect(browserRun.hazard.minimumClearanceMeters).toBe(-1);
  expect(browserRun.hazard.startedInside).toBe(false);
  expect(browserRun.hazard.tangent).toBe(false);
  expect(browserRun.hazard.closestApproachHazardId).toBe(browserRun.hazard.hazardId);
  expect(browserRun.hazard.finiteOutput).toBe(true);

  expect(browserRun.sourceApproximation).toEqual({
    model: "InertialLinearPointMass",
    sourceEpochTick: 0,
    ticksPerSecond: 120
  });
  expect(browserRun.deterministicRepeat.canonicalSignature).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
  expect(browserRun.deterministicRepeat.signaturesEqual).toBe(true);
  expect(browserRun.deterministicRepeat.canonicalResultsEqual).toBe(true);

  expect(health.consoleErrors, "console errors").toEqual([]);
  expect(health.pageErrors, "page errors").toEqual([]);
  expect(health.requestFailures, "failed requests").toEqual([]);
  expect(health.httpErrors, "HTTP responses with status >= 400").toEqual([]);

  const evidence: TrajectoryEvidence = {
    schemaVersion: 1,
    feature: "browser-shared-trajectory-predictor-core-v1",
    route: routeGuard,
    moduleLoad: {
      path: browserRun.modulePath,
      loaded: browserRun.moduleLoaded,
      importedPublicApi: browserRun.importedPublicApi
    },
    runtime: {
      nodeVersion: process.version,
      browserEngine: "chromium",
      realBrowserExecution: true,
      ticksPerSecond: browserRun.sourceApproximation.ticksPerSecond
    },
    scenarios: {
      hestiaNearCircularCoast: browserRun.coast,
      hestiaAccelerationAndImpulse: browserRun.accelerationImpulse,
      hestiaFrameSweptSphericalHazard: browserRun.hazard
    },
    sourceApproximation: browserRun.sourceApproximation,
    deterministicRepeat: browserRun.deterministicRepeat,
    browserHealth: health,
    scope: [
      "Normal-route Chromium execution without TestBridge and a dynamic Vite import of the public trajectory barrel.",
      "Renderer-independent Hestia BodyInertial predictions for near-circular GravityCoast, ConstantInertialAcceleration, exact ImpulseDeltaV and one swept spherical hazard.",
      "Finite immutable results, explicit integrator policies, 120-tick timing, hazard facts and canonical repeat equality."
    ],
    nonGoals: [
      "No FlightController, navigation, autopilot, map, renderer, HUD, runtime loop, timewarp or background-simulation integration.",
      "No SOI transition, patched conics, N-body gravity, atmosphere, fuel use, variable mass, body-fixed thrust or gameplay safety decision.",
      "No screenshot because this pure core slice intentionally has no visible representation."
    ],
    verification: {
      command: focusedCommand,
      expectedResult: "one focused Playwright test passes in real Chromium and writes deterministic timestamp-free JSON and Markdown evidence",
      observedResult: "PASS",
      screenshot: "not captured: renderer-independent core with no visible representation"
    },
    status: "PASS"
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
