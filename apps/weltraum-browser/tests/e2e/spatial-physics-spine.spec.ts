import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-spatial-physics-spine-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-spatial-physics-spine-v1.md");
const generator = "apps/weltraum-browser/tests/e2e/spatial-physics-spine.spec.ts";
const focusedCommand = "npm run test:e2e -- tests/e2e/spatial-physics-spine.spec.ts";

interface Vector3Value {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface NormalPageGuard {
  readonly route: string;
  readonly testBridgeOwnProperty: boolean;
  readonly testBridgeInWindow: boolean;
}

interface BrowserRun {
  readonly modulePaths: readonly string[];
  readonly importedPublicApi: readonly string[];
  readonly time: {
    readonly rotationEpochTick: number;
    readonly scenarioTick: number;
    readonly scenarioEpochSeconds: number;
    readonly ticksPerSecond: number;
  };
  readonly body: {
    readonly bodyId: string;
    readonly radiusMeters: number;
  };
  readonly frameIds: {
    readonly system: string;
    readonly bodyInertial: string;
    readonly bodyFixed: string;
    readonly surfaceLocal: string;
  };
  readonly surface: {
    readonly convention: "+X East, +Y Up, +Z South; North is -Z";
    readonly definitionSignature: string;
    readonly stateSignature: string;
    readonly upNormalError: number;
    readonly maximumBasisLengthError: number;
    readonly maximumOrthogonalityError: number;
    readonly maximumHandednessError: number;
    readonly northPoleFinite: boolean;
    readonly southPoleFinite: boolean;
    readonly actorOrientationIndependent: boolean;
    readonly actorOrientationSeparationRadians: number;
  };
  readonly transformRoundtrip: {
    readonly positionErrorMeters: number;
    readonly velocityErrorMetersPerSecond: number;
    readonly orientationErrorRadians: number;
    readonly angularVelocityErrorRadiansPerSecond: number;
    readonly bodyFixedRelativeSpeedMetersPerSecond: number;
  };
  readonly gravity: {
    readonly fieldSignature: string;
    readonly dominantSourceBodyId: string | null;
    readonly frameIndependenceErrorMetersPerSecondSquared: number;
    readonly accelerationMagnitudeMetersPerSecondSquared: number;
  };
  readonly probe: {
    readonly stepCount: number;
    readonly signature: string;
    readonly canonicalResult: string;
    readonly finalTick: number;
    readonly finalAbsolutePositionMeters: Vector3Value;
  };
  readonly handoff: {
    readonly spaceIds: readonly string[];
    readonly signatures: readonly string[];
    readonly maximumPositionErrorMeters: number;
    readonly maximumVelocityErrorMetersPerSecond: number;
    readonly maximumOrientationErrorRadians: number;
    readonly maximumAngularVelocityErrorRadiansPerSecond: number;
    readonly gravityBindingsChanged: boolean;
  };
  readonly canonicalResult: string;
  readonly suiteSignature: string;
}

interface SpatialPhysicsEvidence {
  readonly schemaVersion: "browser-spatial-physics-spine-v1";
  readonly generator: string;
  readonly test: string;
  readonly baseRevision: {
    readonly expectedAtAssignment: "8bb98b1b084ce86fb262a4fee554a573d43b94f5";
    readonly usedOriginMain: "9f63c1cecda5a14563d4b6be3452b89d07055092";
    readonly deviation: string;
  };
  readonly normalPageGuard: NormalPageGuard;
  readonly browserHealth: {
    readonly consoleErrors: readonly string[];
    readonly pageErrors: readonly string[];
    readonly failedRequests: readonly string[];
    readonly errorResponses: readonly string[];
  };
  readonly dynamicImport: {
    readonly modulePaths: readonly string[];
    readonly importedPublicApi: readonly string[];
  };
  readonly deterministicRepeat: {
    readonly identicalCanonicalResult: boolean;
    readonly identicalSuiteSignature: boolean;
    readonly identicalProbeCanonicalResult: boolean;
    readonly suiteSignature: string;
    readonly probeSignature: string;
  };
  readonly universeTime: BrowserRun["time"];
  readonly bodyAndFrames: BrowserRun["body"] & BrowserRun["frameIds"];
  readonly surface: BrowserRun["surface"];
  readonly transformRoundtrip: BrowserRun["transformRoundtrip"];
  readonly gravity: BrowserRun["gravity"];
  readonly probe: Omit<BrowserRun["probe"], "canonicalResult">;
  readonly handoff: BrowserRun["handoff"];
  readonly scope: readonly string[];
  readonly nonGoals: readonly string[];
  readonly verification: {
    readonly command: string;
    readonly expectedResult: string;
    readonly observedResult: "pass";
    readonly screenshot: "not captured: no visible representation in this slice";
  };
}

const expectNormalPageGuard = async (page: Page): Promise<NormalPageGuard> => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
  const guard = await page.evaluate(() => ({
    route: location.pathname,
    testBridgeOwnProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    testBridgeInWindow: "TestBridge" in window
  }));
  expect(guard).toEqual({ route: "/", testBridgeOwnProperty: false, testBridgeInWindow: false });
  return guard;
};

const createMarkdown = (evidence: SpatialPhysicsEvidence): string => `# Browser Spatial Physics Spine v1 Evidence

Generated by \`${evidence.generator}\`.

## Browser Boundary

- Normal route: \`${evidence.normalPageGuard.route}\`
- TestBridge own property / in window: \`${evidence.normalPageGuard.testBridgeOwnProperty}\` / \`${evidence.normalPageGuard.testBridgeInWindow}\`
- Vite imports: ${evidence.dynamicImport.modulePaths.map((modulePath) => `\`${modulePath}\``).join(", ")}
- Console / page / request / HTTP errors: \`${evidence.browserHealth.consoleErrors.length}\` / \`${evidence.browserHealth.pageErrors.length}\` / \`${evidence.browserHealth.failedRequests.length}\` / \`${evidence.browserHealth.errorResponses.length}\`

## Deterministic Time And Frames

- Origin main used: \`${evidence.baseRevision.usedOriginMain}\` (assignment expected \`${evidence.baseRevision.expectedAtAssignment}\`)
- Deviation: ${evidence.baseRevision.deviation}
- Universe tick / epoch: \`${evidence.universeTime.scenarioTick}\` / \`${evidence.universeTime.scenarioEpochSeconds}\` s at \`${evidence.universeTime.ticksPerSecond}\` Hz
- Body: \`${evidence.bodyAndFrames.bodyId}\`, radius \`${evidence.bodyAndFrames.radiusMeters}\` m
- Frames: \`${evidence.bodyAndFrames.system}\` -> \`${evidence.bodyAndFrames.bodyInertial}\` -> \`${evidence.bodyAndFrames.bodyFixed}\` -> \`${evidence.bodyAndFrames.surfaceLocal}\`
- Repeated canonical bytes / suite signature / probe bytes identical: \`${evidence.deterministicRepeat.identicalCanonicalResult}\` / \`${evidence.deterministicRepeat.identicalSuiteSignature}\` / \`${evidence.deterministicRepeat.identicalProbeCanonicalResult}\`
- Suite signature: \`${evidence.deterministicRepeat.suiteSignature}\`
- Probe signature: \`${evidence.deterministicRepeat.probeSignature}\`

## Geographic Surface Frame

- Convention: ${evidence.surface.convention}
- Pole rule: latitude is inclusive; the explicit canonical longitude selects East at both poles, avoiding a global-up cross-product fallback.
- Maximum handedness error for East x Up = South, Up x South = East, South x East = Up: \`${evidence.surface.maximumHandednessError}\`
- Maximum basis length / orthogonality error: \`${evidence.surface.maximumBasisLengthError}\` / \`${evidence.surface.maximumOrthogonalityError}\`
- Surface Up versus radial normal error: \`${evidence.surface.upNormalError}\`
- North / south pole finite: \`${evidence.surface.northPoleFinite}\` / \`${evidence.surface.southPoleFinite}\`
- Actor orientation remains independent from the geographic frame: \`${evidence.surface.actorOrientationIndependent}\` (actor separation \`${evidence.surface.actorOrientationSeparationRadians}\` rad)
- Definition / state signatures: \`${evidence.surface.definitionSignature}\` / \`${evidence.surface.stateSignature}\`

## Transform, Gravity, Probe, And Handoff

- Position roundtrip error: \`${evidence.transformRoundtrip.positionErrorMeters}\` m
- Velocity roundtrip error (including rotating-frame omega x radius): \`${evidence.transformRoundtrip.velocityErrorMetersPerSecond}\` m/s
- Orientation / angular-velocity roundtrip error: \`${evidence.transformRoundtrip.orientationErrorRadians}\` rad / \`${evidence.transformRoundtrip.angularVelocityErrorRadiansPerSecond}\` rad/s
- Body-fixed relative speed proves no velocity zeroing: \`${evidence.transformRoundtrip.bodyFixedRelativeSpeedMetersPerSecond}\` m/s
- Gravity field / dominant body: \`${evidence.gravity.fieldSignature}\` / \`${evidence.gravity.dominantSourceBodyId}\`
- Gravity frame-independence error: \`${evidence.gravity.frameIndependenceErrorMetersPerSecondSquared}\` m/s^2
- Fixed-step probe count / final tick: \`${evidence.probe.stepCount}\` / \`${evidence.probe.finalTick}\`
- Physics spaces: ${evidence.handoff.spaceIds.map((spaceId) => `\`${spaceId}\``).join(", ")}
- Maximum handoff reconstruction position / velocity error: \`${evidence.handoff.maximumPositionErrorMeters}\` m / \`${evidence.handoff.maximumVelocityErrorMetersPerSecond}\` m/s
- Handoff gravity bindings changed: \`${evidence.handoff.gravityBindingsChanged}\`

## Scope

${evidence.scope.map((item) => `- ${item}`).join("\n")}

### Deferred

${evidence.nonGoals.map((item) => `- ${item}`).join("\n")}

## Focused Verification

- Command: \`${evidence.verification.command}\`
- Expected: ${evidence.verification.expectedResult}
- Observed: ${evidence.verification.observedResult}
- Screenshot: ${evidence.verification.screenshot}
`;

test("normal page proves the deterministic spatial and physics spine through real Vite modules", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const errorResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    const entry = `${message.text()}${location.url ? ` [${location.url}]` : ""}`;
    consoleErrors.push(entry);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errorResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  const normalPageGuard = await expectNormalPageGuard(page);
  const repeated = await page.evaluate(async (): Promise<{ readonly first: BrowserRun; readonly second: BrowserRun }> => {
    const spatialPath = "/src/spatial/index.ts";
    const physicsPath = "/src/physics-space/index.ts";
    const celestialPath = "/src/celestial/index.ts";
    const [spatial, physics, celestial] = await Promise.all([
      import(spatialPath),
      import(physicsPath),
      import(celestialPath)
    ]);
    const spatialApi = [
      "createRuntimeUniverseClock",
      "createSystemInertialFrameState",
      "createBodyInertialFrameState",
      "createBodyFixedFrameState",
      "createSurfaceLocalFrameDefinition",
      "createSurfaceLocalFrameState",
      "computeSurfaceBasis",
      "transformKinematicState",
      "createSpatialSignature"
    ];
    const physicsApi = [
      "createGravitySourceBinding",
      "createGravityFieldSnapshot",
      "queryGravityField",
      "runPhysicsProbeSimulation",
      "createPhysicsSpaceDescriptor",
      "handoffPhysicsSpace"
    ];
    const celestialApi = ["createStarterCelestialCatalog", "computeCatalogEphemeris", "STARTER_BODY_IDS"];
    for (const name of spatialApi) {
      if (typeof spatial[name] !== "function") throw new Error(`Missing spatial public API ${name}.`);
    }
    for (const name of physicsApi) {
      if (typeof physics[name] !== "function") throw new Error(`Missing physics-space public API ${name}.`);
    }
    for (const name of celestialApi) {
      if (!(name in celestial)) throw new Error(`Missing celestial public API ${name}.`);
    }

    const run = (): BrowserRun => {
      const vectorError = (left: Vector3Value, right: Vector3Value): number =>
        Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
      const magnitude = (value: Vector3Value): number => Math.hypot(value.x, value.y, value.z);
      const clock = spatial.createRuntimeUniverseClock(0);
      const rotationEpoch = clock.snapshot();
      const time = clock.advance({ kind: "AdvanceSeconds", deltaSeconds: 12_000, roundingMode: "exact" });
      const catalog = celestial.createStarterCelestialCatalog();
      const hestia = catalog.indexes.bodyById[celestial.STARTER_BODY_IDS.hestia];
      const star = catalog.indexes.bodyById[celestial.STARTER_BODY_IDS.aurelia];
      const systemFrameId = spatial.createSystemInertialFrameId("aurelia");

      const buildEpoch = (epochTime: { readonly tick: number; readonly epochSeconds: number }) => {
        const ephemeris = celestial.computeCatalogEphemeris(catalog, {
          epochSeconds: 0,
          requestedTimeSeconds: epochTime.epochSeconds
        });
        const system = spatial.createSystemInertialFrameState(systemFrameId, epochTime);
        const hestiaRuntime = ephemeris.stateByBodyId[hestia.bodyId];
        const starRuntime = ephemeris.stateByBodyId[star.bodyId];
        const bodyInertial = spatial.createBodyInertialFrameState({
          body: hestia,
          runtimeState: hestiaRuntime,
          time: epochTime,
          systemFrameId
        });
        const bodyFixed = spatial.createBodyFixedFrameState(bodyInertial, {
          body: hestia,
          runtimeState: hestiaRuntime,
          time: epochTime,
          rotationEpoch
        });
        const hestiaBinding = physics.createGravitySourceBinding({ body: hestia, runtimeState: hestiaRuntime, time: epochTime });
        const starBinding = physics.createGravitySourceBinding({ body: star, runtimeState: starRuntime, time: epochTime });
        const gravityField = physics.createGravityFieldSnapshot({
          time: epochTime,
          systemFrameState: system,
          bindings: [hestiaBinding, starBinding]
        });
        return { ephemeris, system, bodyInertial, bodyFixed, gravityField, hestiaRuntime };
      };

      const epoch = buildEpoch(time);
      const surfaceDefinition = spatial.createSurfaceLocalFrameDefinition({
        frameId: spatial.createSurfaceLocalFrameId("hestia-browser-proof"),
        anchor: {
          bodyId: hestia.bodyId,
          latitudeRadians: 0.43,
          longitudeRadians: -1.17,
          altitudeMeters: 25
        }
      });
      const surface = spatial.createSurfaceLocalFrameState(surfaceDefinition, hestia, epoch.bodyFixed, time);
      const basis = spatial.computeSurfaceBasis(surfaceDefinition.anchor);
      const northPole = spatial.computeSurfaceBasis({
        bodyId: hestia.bodyId,
        latitudeRadians: Math.PI / 2,
        longitudeRadians: 0.71,
        altitudeMeters: 0
      });
      const southPole = spatial.computeSurfaceBasis({
        bodyId: hestia.bodyId,
        latitudeRadians: -Math.PI / 2,
        longitudeRadians: -2.03,
        altitudeMeters: 0
      });
      const bases = [basis, northPole, southPole];
      const crossErrors = bases.flatMap((entry) => [
        vectorError(spatial.crossSpatialVectors(entry.east, entry.up), entry.south),
        vectorError(spatial.crossSpatialVectors(entry.up, entry.south), entry.east),
        vectorError(spatial.crossSpatialVectors(entry.south, entry.east), entry.up)
      ]);
      const basisLengthErrors = bases.flatMap((entry) =>
        [entry.east, entry.up, entry.south].map((axis) => Math.abs(magnitude(axis) - 1))
      );
      const orthogonalityErrors = bases.flatMap((entry) => [
        Math.abs(spatial.dotSpatialVectors(entry.east, entry.up)),
        Math.abs(spatial.dotSpatialVectors(entry.up, entry.south)),
        Math.abs(spatial.dotSpatialVectors(entry.south, entry.east))
      ]);
      const finiteBasis = (entry: typeof basis): boolean =>
        [entry.east, entry.up, entry.south, entry.north].every((axis) =>
          [axis.x, axis.y, axis.z].every(Number.isFinite)
        );
      const radialNormal = spatial.normalizeSpatialVector(surface.bodyFixedPositionMeters);
      const surfaceStateSignatureBeforeActors = spatial.createSpatialSignature({
        definition: surface.definition,
        frameId: surface.frameId,
        originPositionMeters: surface.originPositionMeters,
        orientation: surface.orientation
      });
      const actorA = spatial.createSpatialPose({
        positionMeters: { x: 0, y: 2, z: 0 },
        orientation: spatial.IDENTITY_SPATIAL_QUATERNION
      });
      const actorB = spatial.createSpatialPose({
        positionMeters: actorA.positionMeters,
        orientation: spatial.createQuaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.63)
      });
      const surfaceStateSignatureAfterActors = spatial.createSpatialSignature({
        definition: surface.definition,
        frameId: surface.frameId,
        originPositionMeters: surface.originPositionMeters,
        orientation: surface.orientation
      });

      const absoluteActor = spatial.createSpatialKinematicState({
        positionMeters: {
          x: epoch.hestiaRuntime.absoluteState.positionMeters.x + hestia.radiusMeters + 250,
          y: epoch.hestiaRuntime.absoluteState.positionMeters.y + 120,
          z: epoch.hestiaRuntime.absoluteState.positionMeters.z - 80
        },
        velocityMetersPerSecond: {
          x: epoch.hestiaRuntime.absoluteState.velocityMetersPerSecond.x + 17,
          y: epoch.hestiaRuntime.absoluteState.velocityMetersPerSecond.y + 230,
          z: epoch.hestiaRuntime.absoluteState.velocityMetersPerSecond.z - 11
        },
        orientation: spatial.createQuaternionFromAxisAngle({ x: 1, y: 2, z: -3 }, 0.72),
        angularVelocityRadiansPerSecond: { x: 0.012, y: -0.008, z: 0.021 }
      });
      const inBodyInertial = spatial.transformKinematicState(absoluteActor, epoch.system, epoch.bodyInertial);
      const inBodyFixed = spatial.transformKinematicState(inBodyInertial, epoch.bodyInertial, epoch.bodyFixed);
      const inSurface = spatial.transformKinematicState(inBodyFixed, epoch.bodyFixed, surface);
      const backToFixed = spatial.transformKinematicState(inSurface, surface, epoch.bodyFixed);
      const backToBodyInertial = spatial.transformKinematicState(backToFixed, epoch.bodyFixed, epoch.bodyInertial);
      const roundtrip = spatial.transformKinematicState(backToBodyInertial, epoch.bodyInertial, epoch.system);

      const gravitySystem = physics.queryGravityField({
        field: epoch.gravityField,
        positionMeters: absoluteActor.positionMeters,
        positionFrameState: epoch.system,
        outputFrameState: epoch.system
      });
      const gravityFromBody = physics.queryGravityField({
        field: epoch.gravityField,
        positionMeters: inBodyInertial.positionMeters,
        positionFrameState: epoch.bodyInertial,
        outputFrameState: epoch.system
      });

      const time1 = spatial.createRuntimeUniverseClock(time.tick).advance({ kind: "AdvanceTicks", deltaTicks: 1 });
      const time2 = spatial.createRuntimeUniverseClock(time1.tick).advance({ kind: "AdvanceTicks", deltaTicks: 1 });
      const epoch1 = buildEpoch(time1);
      const epoch2 = buildEpoch(time2);
      const probeInitial = physics.createPhysicsProbeState({
        probeId: "probe:hestia-browser-proof",
        frameId: epoch.system.frameId,
        time,
        positionMeters: absoluteActor.positionMeters,
        velocityMetersPerSecond: absoluteActor.velocityMetersPerSecond
      });
      const deltaTimeSeconds = 1 / 120;
      const probe = physics.runPhysicsProbeSimulation(probeInitial, [
        {
          deltaTimeSeconds,
          startFrameState: epoch.system,
          endFrameState: epoch1.system,
          gravityField: epoch.gravityField
        },
        {
          deltaTimeSeconds,
          startFrameState: epoch1.system,
          endFrameState: epoch2.system,
          gravityField: epoch1.gravityField
        }
      ]);

      const systemSpace = physics.createPhysicsSpaceDescriptor({
        spaceId: "physics-space:system-browser-proof",
        kind: "SystemSpace",
        frameKind: "SystemInertial",
        frameDefinition: {
          frameId: epoch.system.frameId,
          kind: "SystemInertial",
          parentFrameId: null,
          canonicalAuthority: true
        },
        frameState: epoch.system
      });
      const bodySpace = physics.createPhysicsSpaceDescriptor({
        spaceId: "physics-space:body-browser-proof",
        kind: "BodyLocalSpace",
        frameKind: "BodyFixed",
        frameDefinition: {
          frameId: epoch.bodyFixed.frameId,
          kind: "BodyFixed",
          parentFrameId: epoch.bodyInertial.frameId,
          canonicalAuthority: true
        },
        frameState: epoch.bodyFixed
      });
      const surfaceSpace = physics.createPhysicsSpaceDescriptor({
        spaceId: "physics-space:surface-browser-proof",
        kind: "SurfaceLocalSpace",
        frameKind: "SurfaceLocal",
        frameDefinition: {
          frameId: surface.frameId,
          kind: "SurfaceLocal",
          parentFrameId: epoch.bodyFixed.frameId,
          canonicalAuthority: true
        },
        frameState: surface
      });
      const bindingIds = epoch.gravityField.bindings.map((binding: { readonly bindingId: string }) => binding.bindingId);
      const systemToBody = physics.handoffPhysicsSpace({
        sourceSpace: systemSpace,
        targetSpace: bodySpace,
        sourceState: absoluteActor,
        sourceGravityBindingIds: bindingIds,
        targetGravityBindingIds: bindingIds
      });
      const bodyToSurface = physics.handoffPhysicsSpace({
        sourceSpace: bodySpace,
        targetSpace: surfaceSpace,
        sourceState: systemToBody.targetState,
        sourceGravityBindingIds: bindingIds,
        targetGravityBindingIds: bindingIds
      });
      const handoffErrors = [systemToBody.reconstructionError, bodyToSurface.reconstructionError];

      const payload = {
        modulePaths: [spatialPath, physicsPath, celestialPath],
        importedPublicApi: [...spatialApi, ...physicsApi, ...celestialApi],
        time: {
          rotationEpochTick: rotationEpoch.tick,
          scenarioTick: time.tick,
          scenarioEpochSeconds: time.epochSeconds,
          ticksPerSecond: 120
        },
        body: { bodyId: hestia.bodyId, radiusMeters: hestia.radiusMeters },
        frameIds: {
          system: epoch.system.frameId,
          bodyInertial: epoch.bodyInertial.frameId,
          bodyFixed: epoch.bodyFixed.frameId,
          surfaceLocal: surface.frameId
        },
        surface: {
          convention: "+X East, +Y Up, +Z South; North is -Z" as const,
          definitionSignature: surfaceDefinition.signature,
          stateSignature: surfaceStateSignatureBeforeActors,
          upNormalError: vectorError(basis.up, radialNormal),
          maximumBasisLengthError: Math.max(...basisLengthErrors),
          maximumOrthogonalityError: Math.max(...orthogonalityErrors),
          maximumHandednessError: Math.max(...crossErrors),
          northPoleFinite: finiteBasis(northPole),
          southPoleFinite: finiteBasis(southPole),
          actorOrientationIndependent:
            surfaceStateSignatureBeforeActors === surfaceStateSignatureAfterActors &&
            spatial.quaternionAngularDistanceRadians(actorA.orientation, actorB.orientation) > 0,
          actorOrientationSeparationRadians: spatial.quaternionAngularDistanceRadians(actorA.orientation, actorB.orientation)
        },
        transformRoundtrip: {
          positionErrorMeters: vectorError(absoluteActor.positionMeters, roundtrip.positionMeters),
          velocityErrorMetersPerSecond: vectorError(absoluteActor.velocityMetersPerSecond, roundtrip.velocityMetersPerSecond),
          orientationErrorRadians: spatial.quaternionAngularDistanceRadians(absoluteActor.orientation, roundtrip.orientation),
          angularVelocityErrorRadiansPerSecond: vectorError(
            absoluteActor.angularVelocityRadiansPerSecond,
            roundtrip.angularVelocityRadiansPerSecond
          ),
          bodyFixedRelativeSpeedMetersPerSecond: magnitude(inBodyFixed.velocityMetersPerSecond)
        },
        gravity: {
          fieldSignature: epoch.gravityField.signature,
          dominantSourceBodyId: gravitySystem.dominantSource?.source.bodyId ?? null,
          frameIndependenceErrorMetersPerSecondSquared: vectorError(
            gravitySystem.systemAccelerationMetersPerSecondSquared,
            gravityFromBody.systemAccelerationMetersPerSecondSquared
          ),
          accelerationMagnitudeMetersPerSecondSquared: magnitude(gravitySystem.systemAccelerationMetersPerSecondSquared)
        },
        probe: {
          stepCount: probe.steps.length,
          signature: probe.signature,
          canonicalResult: probe.canonicalJson,
          finalTick: probe.finalState.time.tick,
          finalAbsolutePositionMeters: probe.steps[probe.steps.length - 1].absolutePositionMeters
        },
        handoff: {
          spaceIds: [systemSpace.spaceId, bodySpace.spaceId, surfaceSpace.spaceId],
          signatures: [systemToBody.signature, bodyToSurface.signature],
          maximumPositionErrorMeters: Math.max(...handoffErrors.map((error) => error.positionMeters)),
          maximumVelocityErrorMetersPerSecond: Math.max(...handoffErrors.map((error) => error.velocityMetersPerSecond)),
          maximumOrientationErrorRadians: Math.max(...handoffErrors.map((error) => error.orientationRadians)),
          maximumAngularVelocityErrorRadiansPerSecond: Math.max(
            ...handoffErrors.map((error) => error.angularVelocityRadiansPerSecond)
          ),
          gravityBindingsChanged: systemToBody.gravityBindingsChanged || bodyToSurface.gravityBindingsChanged
        }
      };
      const canonicalResult = spatial.serializeCanonicalSpatialValue(payload);
      return { ...payload, canonicalResult, suiteSignature: spatial.createSpatialSignature(payload) };
    };

    return { first: run(), second: run() };
  });

  const first = repeated.first;
  const positionAllowance = 1e-5 + 2e-15 * Math.hypot(
    first.probe.finalAbsolutePositionMeters.x,
    first.probe.finalAbsolutePositionMeters.y,
    first.probe.finalAbsolutePositionMeters.z
  );
  expect(first.time.ticksPerSecond).toBe(120);
  expect(first.body.bodyId).toBe("planet.hestia");
  expect(first.surface.maximumBasisLengthError).toBeLessThanOrEqual(1e-12);
  expect(first.surface.maximumOrthogonalityError).toBeLessThanOrEqual(1e-12);
  expect(first.surface.maximumHandednessError).toBeLessThanOrEqual(1e-12);
  expect(first.surface.upNormalError).toBeLessThanOrEqual(1e-12);
  expect(first.surface.northPoleFinite).toBe(true);
  expect(first.surface.southPoleFinite).toBe(true);
  expect(first.surface.actorOrientationIndependent).toBe(true);
  expect(first.surface.actorOrientationSeparationRadians).toBeGreaterThan(0);
  expect(first.transformRoundtrip.positionErrorMeters).toBeLessThanOrEqual(positionAllowance);
  expect(first.transformRoundtrip.velocityErrorMetersPerSecond).toBeLessThanOrEqual(1e-9);
  expect(first.transformRoundtrip.orientationErrorRadians).toBeLessThanOrEqual(1e-10);
  expect(first.transformRoundtrip.angularVelocityErrorRadiansPerSecond).toBeLessThanOrEqual(1e-12);
  expect(first.transformRoundtrip.bodyFixedRelativeSpeedMetersPerSecond).toBeGreaterThan(0);
  expect(first.gravity.dominantSourceBodyId).toBe("planet.hestia");
  expect(first.gravity.accelerationMagnitudeMetersPerSecondSquared).toBeGreaterThan(0);
  expect(first.gravity.frameIndependenceErrorMetersPerSecondSquared).toBeLessThanOrEqual(1e-12);
  expect(first.probe.stepCount).toBe(2);
  expect(first.probe.finalTick).toBe(first.time.scenarioTick + 2);
  expect(first.handoff.spaceIds).toEqual([
    "physics-space:system-browser-proof",
    "physics-space:body-browser-proof",
    "physics-space:surface-browser-proof"
  ]);
  expect(first.handoff.maximumPositionErrorMeters).toBeLessThanOrEqual(positionAllowance);
  expect(first.handoff.maximumVelocityErrorMetersPerSecond).toBeLessThanOrEqual(1e-9);
  expect(first.handoff.maximumOrientationErrorRadians).toBeLessThanOrEqual(1e-10);
  expect(first.handoff.maximumAngularVelocityErrorRadiansPerSecond).toBeLessThanOrEqual(1e-12);
  expect(first.handoff.gravityBindingsChanged).toBe(false);
  expect(first.canonicalResult).toBe(repeated.second.canonicalResult);
  expect(first.suiteSignature).toBe(repeated.second.suiteSignature);
  expect(first.probe.canonicalResult).toBe(repeated.second.probe.canonicalResult);
  expect(first.probe.signature).toBe(repeated.second.probe.signature);
  expect(errorResponses).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  const evidence: SpatialPhysicsEvidence = {
    schemaVersion: "browser-spatial-physics-spine-v1",
    generator,
    test: "normal page proves the deterministic spatial and physics spine through real Vite modules",
    baseRevision: {
      expectedAtAssignment: "8bb98b1b084ce86fb262a4fee554a573d43b94f5",
      usedOriginMain: "9f63c1cecda5a14563d4b6be3452b89d07055092",
      deviation: "origin/main had advanced by two review-gate-only commits; the isolated worktree was created from current origin/main."
    },
    normalPageGuard,
    browserHealth: {
      consoleErrors,
      pageErrors,
      failedRequests,
      errorResponses
    },
    dynamicImport: { modulePaths: first.modulePaths, importedPublicApi: first.importedPublicApi },
    deterministicRepeat: {
      identicalCanonicalResult: first.canonicalResult === repeated.second.canonicalResult,
      identicalSuiteSignature: first.suiteSignature === repeated.second.suiteSignature,
      identicalProbeCanonicalResult: first.probe.canonicalResult === repeated.second.probe.canonicalResult,
      suiteSignature: first.suiteSignature,
      probeSignature: first.probe.signature
    },
    universeTime: first.time,
    bodyAndFrames: { ...first.body, ...first.frameIds },
    surface: first.surface,
    transformRoundtrip: first.transformRoundtrip,
    gravity: first.gravity,
    probe: {
      stepCount: first.probe.stepCount,
      signature: first.probe.signature,
      finalTick: first.probe.finalTick,
      finalAbsolutePositionMeters: first.probe.finalAbsolutePositionMeters
    },
    handoff: first.handoff,
    scope: [
      "Normal / browser startup without TestBridge and dynamic Vite imports of the public Spatial and Physics Space barrels.",
      "Explicit 120 Hz Universe clock, Hestia ephemeris, SystemInertial, BodyInertial, BodyFixed, and geographic SurfaceLocal frames.",
      "Position, velocity, actor orientation, and angular velocity roundtrip through rotating frames without snapping or zeroing.",
      "Celestial-backed gravity query, two deterministic semi-implicit fixed steps, and explicit System->Body->Surface physics-space handoffs."
    ],
    nonGoals: [
      "No planet renderer, terrain, voxels, atmosphere, collision, thruster, or active flight-ship integration.",
      "No FlightController, navigation planner, executor, autopilot, game-loop clock wiring, or automatic gravity-source switch.",
      "No ellipsoid, geoid, terrain height, landing zone, player handoff, actor-facing frame, camera-facing frame, or visible UI.",
      "No screenshot because this slice intentionally has no visible representation."
    ],
    verification: {
      command: focusedCommand,
      expectedResult: "one focused Playwright test passes twice deterministically and writes both task-owned evidence files",
      observedResult: "pass",
      screenshot: "not captured: no visible representation in this slice"
    }
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
