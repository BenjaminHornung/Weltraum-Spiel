import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { SurfacePlayDriver } from "./support/surfacePlayDriver";

type SurfacePlayModule = typeof import("../../src/surface-play/index");
type HestiaUmbrellaTreeModule = typeof import("../../src/surface-play/vegetation/hestiaUmbrellaTree");
type SurfacePlaySnapshot = NonNullable<ReturnType<SurfacePlayModule["readActiveSurfacePlaySnapshot"]>>;

interface BrowserHealth {
  readonly console: string[];
  readonly page: string[];
  readonly request: string[];
  readonly http: string[];
}

interface SmallSurfacePlaySnapshot {
  readonly authority: {
    readonly regionRevision: number;
    readonly editRevision: number;
    readonly regionHash: string;
    readonly voxelHash: string;
    readonly materializedBrickCount: number;
  };
  readonly world: null | {
    readonly identity: { readonly bodyId: string; readonly regionId: string; readonly surfaceFrameId: string; readonly regionRevision: number };
    readonly environmentIdentity: { readonly bodyId: string; readonly regionId: string; readonly surfaceFrameId: string; readonly regionRevision: number };
    readonly anchor: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly verticalBand: Readonly<{ readonly minimumMeters: number; readonly maximumExclusiveMeters: number }>;
    readonly residentInsetBoundsMeters: {
      readonly minInclusive: Readonly<{ readonly x: number; readonly z: number }>;
      readonly maxExclusive: Readonly<{ readonly x: number; readonly z: number }>;
    };
    readonly componentBoundsMeters: {
      readonly minInclusive: Readonly<{ readonly x: number; readonly z: number }>;
      readonly maxExclusive: Readonly<{ readonly x: number; readonly z: number }>;
      readonly size: Readonly<{ readonly x: number; readonly z: number }>;
    };
    readonly waterSurfaceHeightMeters: number;
    readonly environmentWaterSurfaceHeightMeters: number;
    readonly traversalCellCount: number;
    readonly dryCellCount: number;
    readonly spawnPerimeterDistanceMeters: number;
    readonly decorativePopulationCount: number;
    readonly waterPatchCount: number;
    readonly surveyDronePositionMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly structuralTreeRoots: readonly Readonly<{ readonly x: number; readonly y: number; readonly z: number }>[];
  };
  readonly fixedStep: { readonly interpolationAlpha: number; readonly accumulatorSeconds: number };
  readonly player: {
    readonly positionMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly velocityMetersPerSecond: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly yawRadians: number;
    readonly pitchRadians: number;
    readonly grounded: boolean;
    readonly movementMode: string;
    readonly simulationTick: number;
    readonly capsule: Readonly<{ readonly radiusMeters: number; readonly heightMeters: number }>;
    readonly supportState: string;
  };
  readonly view: {
    readonly eyePositionMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly forward: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  };
  readonly combat: {
    readonly energyJoules: number;
    readonly maximumEnergyJoules: number;
    readonly heatJoules: number;
    readonly maximumHeatJoules: number;
    readonly cooldownSeconds: number;
    readonly readiness: SurfacePlaySnapshot["combat"]["readiness"];
    readonly latestFireResult: SurfacePlaySnapshot["combat"]["latestFireResult"];
    readonly target: SurfacePlaySnapshot["combat"]["target"];
    readonly events: SurfacePlaySnapshot["combat"]["events"];
  };
  readonly hud: SurfacePlaySnapshot["hud"];
  readonly presentation: {
    readonly target: SurfacePlaySnapshot["presentation"]["target"];
    readonly latestVoxelTransition: null | {
      readonly result: NonNullable<SurfacePlaySnapshot["latestVoxelTransition"]>["result"];
      readonly remeshPlan: NonNullable<SurfacePlaySnapshot["latestVoxelTransition"]>["remeshPlan"];
    };
    readonly appliedVoxelTransitionCount: number;
    readonly structural: null | {
      readonly objects: SurfacePlaySnapshot["presentation"]["structural"] extends infer T
        ? T extends { readonly objects: infer O } ? O : never
        : never;
      readonly components: SurfacePlaySnapshot["presentation"]["structural"] extends infer T
        ? T extends { readonly components: infer C } ? C : never
        : never;
      readonly bodySources: SurfacePlaySnapshot["presentation"]["structural"] extends infer T
        ? T extends { readonly bodySources: infer S } ? S : never
        : never;
      readonly dynamicBodies: SurfacePlaySnapshot["presentation"]["structural"] extends infer T
        ? T extends { readonly dynamicBodies: infer B } ? B : never
        : never;
      readonly latestTransition: SurfacePlaySnapshot["presentation"]["structural"] extends infer T
        ? T extends { readonly latestTransition: infer L } ? L : never
        : never;
      readonly physicsFailure: SurfacePlaySnapshot["presentation"]["structural"] extends infer T
        ? T extends { readonly physicsFailure: infer F } ? F : never
        : never;
    };
  };
  readonly latestRejection: SurfacePlaySnapshot["latestRejection"];
  readonly testBridge: { readonly ownProperty: boolean; readonly inWindow: boolean };
}

test.use({
  viewport: { width: 1_920, height: 1_080 },
  screenshot: "off",
  trace: "retain-on-failure"
});

const collectBrowserHealth = (page: Page): BrowserHealth => {
  const health: BrowserHealth = { console: [], page: [], request: [], http: [] };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    health.console.push(`${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`);
  });
  page.on("pageerror", (error) => health.page.push(error.message));
  page.on("requestfailed", (request) => health.request.push(
    `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`
  ));
  page.on("response", (response) => {
    if (response.status() >= 400) health.http.push(
      `${response.status()} ${response.request().method()} ${response.url()}`
    );
  });
  return health;
};

const testBridgeState = async (page: Page): Promise<{ readonly ownProperty: boolean; readonly inWindow: boolean }> =>
  page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));

const readSmallSnapshot = async (page: Page): Promise<SmallSurfacePlaySnapshot> =>
  page.evaluate<SmallSurfacePlaySnapshot>(async () => {
    const modulePath = String("/src/surface-play/index.ts");
    const surfacePlay = (await import(/* @vite-ignore */ modulePath)) as SurfacePlayModule;
    const snapshot = surfacePlay.readActiveSurfacePlaySnapshot();
    if (snapshot === null) throw new Error("Surface Play read-only snapshot probe is unavailable.");
    const structural = snapshot.presentation.structural;
    const world = snapshot.world;
    return {
      authority: {
        regionRevision: snapshot.authorityState.regionRevision,
        editRevision: snapshot.authorityState.editRevision,
        regionHash: snapshot.authorityState.currentRegionContentHash,
        voxelHash: snapshot.authorityState.currentVoxelContentHash,
        materializedBrickCount: snapshot.authorityState.materializedBricks.length
      },
      world: world === null ? null : {
        identity: world.identity,
        environmentIdentity: world.environment.identity,
        anchor: world.anchorCenterMeters,
        verticalBand: world.verticalBand,
        residentInsetBoundsMeters: world.traversalDomain.residentInsetBoundsMeters,
        componentBoundsMeters: world.traversalDomain.componentBoundsMeters,
        waterSurfaceHeightMeters: world.waterSurfaceHeightMeters,
        environmentWaterSurfaceHeightMeters: world.environment.waterSurfaceHeightMeters,
        traversalCellCount: world.traversalDomain.cells.length,
        dryCellCount: world.shoreBoundary.dryCellKeys.length,
        spawnPerimeterDistanceMeters: world.traversalDomain.spawnPerimeterDistanceMeters,
        decorativePopulationCount: world.environment.decorativePopulation.length,
        waterPatchCount: world.environment.waterPatches.length,
        surveyDronePositionMeters: world.encounter.surveyDronePositionMeters,
        structuralTreeRoots: world.encounter.structuralTrees.map((tree) => ({
          x: tree.rootQuantum.x * 0.125,
          y: tree.rootQuantum.y * 0.125,
          z: tree.rootQuantum.z * 0.125
        }))
      },
      fixedStep: {
        interpolationAlpha: snapshot.fixedStep.interpolationAlpha,
        accumulatorSeconds: snapshot.fixedStep.accumulatorSeconds
      },
      player: {
        ...snapshot.player,
        supportState: snapshot.fixedStep.currentState.supportState
      },
      view: {
        eyePositionMeters: snapshot.firstPersonView.eyePositionMeters,
        forward: snapshot.firstPersonView.forward
      },
      combat: {
        energyJoules: snapshot.combat.energyJoules,
        maximumEnergyJoules: snapshot.combat.maximumEnergyJoules,
        heatJoules: snapshot.combat.heatJoules,
        maximumHeatJoules: snapshot.combat.maximumHeatJoules,
        cooldownSeconds: snapshot.combat.cooldownSeconds,
        readiness: snapshot.combat.readiness,
        latestFireResult: snapshot.combat.latestFireResult,
        target: snapshot.combat.target,
        events: snapshot.combat.events.slice(-12)
      },
      hud: snapshot.hud,
      presentation: {
        target: snapshot.presentation.target,
        latestVoxelTransition: snapshot.latestVoxelTransition === null ? null : {
          result: snapshot.latestVoxelTransition.result,
          remeshPlan: snapshot.latestVoxelTransition.remeshPlan
        },
        appliedVoxelTransitionCount: snapshot.appliedVoxelTransitions.length,
        structural: structural === null ? null : {
          objects: structural.objects,
          components: structural.components,
          bodySources: structural.bodySources,
          dynamicBodies: structural.dynamicBodies,
          latestTransition: structural.latestTransition,
          physicsFailure: structural.physicsFailure
        }
      },
      latestRejection: snapshot.latestRejection,
      testBridge: {
        ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
        inWindow: "TestBridge" in window
      }
    };
  });

const writeJsonEvidence = async (testInfo: TestInfo, name: string, value: unknown): Promise<string> => {
  const outputPath = testInfo.outputPath(`${name}.json`);
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await testInfo.attach(name, { path: outputPath, contentType: "application/json" });
  return outputPath;
};

const captureScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Expected an explicit browser viewport.");
  const outputPath = testInfo.outputPath(`${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  await testInfo.attach(`${name}-${viewport.width}x${viewport.height}`, { path: outputPath, contentType: "image/png" });
  return outputPath;
};

const gotoReady = async (page: Page, route = "/?surfacePlay=1"): Promise<void> => {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator('body[data-ui-surface="surface-play"][data-surface-play-state="ready"]'))
    .toHaveCount(1, { timeout: 120_000 });
  await expectSurfacePlayReady(page);
  await expect.poll(async () => (await readSmallSnapshot(page)).player.simulationTick, { timeout: 15_000 })
    .toBeGreaterThan(0);
};

type MovementKey = "a" | "d" | "s" | "w";
type HorizontalAxis = "x" | "z";

interface PointerMousePosition {
  x: number;
  y: number;
}

interface InteriorTerrainTarget {
  readonly gridX: number;
  readonly gridZ: number;
  readonly pointMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  readonly treeClearanceMeters: number;
}

interface StructuralTreeAimTarget {
  readonly treeInstanceId: string;
  readonly treeContentHash: string;
  readonly pointMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
}

const LOOK_SENSITIVITY_RADIANS_PER_PIXEL = 0.0025;

const shortestAngleDelta = (fromRadians: number, toRadians: number): number => {
  const fullTurn = Math.PI * 2;
  return ((toRadians - fromRadians + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
};

const horizontalDistance = (
  left: Readonly<{ readonly x: number; readonly z: number }>,
  right: Readonly<{ readonly x: number; readonly z: number }>
): number => Math.hypot(left.x - right.x, left.z - right.z);

const horizontalDisplacement = (
  from: Readonly<{ readonly x: number; readonly z: number }>,
  to: Readonly<{ readonly x: number; readonly z: number }>
): Readonly<{ readonly x: number; readonly z: number }> => ({
  x: to.x - from.x,
  z: to.z - from.z
});

const movementEvidenceState = (snapshot: SmallSurfacePlaySnapshot): unknown => ({
  authority: snapshot.authority,
  player: snapshot.player,
  view: snapshot.view,
  latestRejection: snapshot.latestRejection,
  testBridge: snapshot.testBridge
});

const engagePointerLock = async (page: Page): Promise<PointerMousePosition> => {
  const engageControl = page.getByRole("button", { name: "Click to engage suit control", exact: true });
  const box = await engageControl.boundingBox();
  if (box === null) throw new Error("Surface Play engage control has no browser-space bounds.");
  await engageControl.click();
  await expect(page.locator(".surface-play-ui")).toHaveAttribute("data-pointer-lock", "engaged");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const turnToYawWithRealMouse = async (
  page: Page,
  pointer: PointerMousePosition,
  targetYawRadians: number
): Promise<SmallSurfacePlaySnapshot> => {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Expected an explicit viewport for real mouse look.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const before = await readSmallSnapshot(page);
    const delta = shortestAngleDelta(before.player.yawRadians, targetYawRadians);
    if (Math.abs(delta) <= 0.04) return before;

    const requestedPixels = Math.max(-500, Math.min(500, -delta / LOOK_SENSITIVITY_RADIANS_PER_PIXEL));
    const nextX = Math.max(2, Math.min(viewport.width - 2, pointer.x + requestedPixels));
    if (Math.abs(nextX - pointer.x) < 2) {
      throw new Error("Real mouse look reached the viewport edge before the requested yaw.");
    }
    await page.mouse.move(nextX, pointer.y, {
      steps: Math.max(1, Math.min(8, Math.ceil(Math.abs(nextX - pointer.x) / 80)))
    });
    pointer.x = nextX;
    await expect.poll(
      async () => Math.abs(shortestAngleDelta(before.player.yawRadians, (await readSmallSnapshot(page)).player.yawRadians)),
      { timeout: 2_000, intervals: [25, 50, 100] }
    ).toBeGreaterThan(0.002);
  }

  const result = await readSmallSnapshot(page);
  expect(Math.abs(shortestAngleDelta(result.player.yawRadians, targetYawRadians))).toBeLessThanOrEqual(0.04);
  return result;
};

const turnToWorldPointWithRealMouse = async (
  page: Page,
  pointer: PointerMousePosition,
  pointMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>
): Promise<SmallSurfacePlaySnapshot> => {
  const beforeYaw = await readSmallSnapshot(page);
  await turnToYawWithRealMouse(
    page,
    pointer,
    Math.atan2(
      pointMeters.x - beforeYaw.view.eyePositionMeters.x,
      pointMeters.z - beforeYaw.view.eyePositionMeters.z
    )
  );
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Expected an explicit viewport for real mouse aim.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const before = await readSmallSnapshot(page);
    const deltaX = pointMeters.x - before.view.eyePositionMeters.x;
    const deltaY = pointMeters.y - before.view.eyePositionMeters.y;
    const deltaZ = pointMeters.z - before.view.eyePositionMeters.z;
    const targetPitchRadians = Math.atan2(deltaY, Math.hypot(deltaX, deltaZ));
    const delta = targetPitchRadians - before.player.pitchRadians;
    if (Math.abs(delta) <= 0.025) return before;

    const requestedPixels = Math.max(-400, Math.min(400, -delta / LOOK_SENSITIVITY_RADIANS_PER_PIXEL));
    const nextY = Math.max(2, Math.min(viewport.height - 2, pointer.y + requestedPixels));
    if (Math.abs(nextY - pointer.y) < 2) {
      throw new Error("Real mouse aim reached the viewport edge before the requested pitch.");
    }
    await page.mouse.move(pointer.x, nextY, {
      steps: Math.max(1, Math.min(8, Math.ceil(Math.abs(nextY - pointer.y) / 80)))
    });
    pointer.y = nextY;
    await expect.poll(
      async () => Math.abs((await readSmallSnapshot(page)).player.pitchRadians - before.player.pitchRadians),
      { timeout: 2_000, intervals: [25, 50, 100] }
    ).toBeGreaterThan(0.002);
  }

  const result = await readSmallSnapshot(page);
  const deltaX = pointMeters.x - result.view.eyePositionMeters.x;
  const deltaY = pointMeters.y - result.view.eyePositionMeters.y;
  const deltaZ = pointMeters.z - result.view.eyePositionMeters.z;
  const targetPitchRadians = Math.atan2(deltaY, Math.hypot(deltaX, deltaZ));
  expect(Math.abs(result.player.pitchRadians - targetPitchRadians)).toBeLessThanOrEqual(0.025);
  return result;
};

const readStructuralTreeAimTarget = async (page: Page): Promise<StructuralTreeAimTarget> =>
  page.evaluate<StructuralTreeAimTarget>(async () => {
    const surfacePlayPath = String("/src/surface-play/index.ts");
    const treeModulePath = String("/src/surface-play/vegetation/hestiaUmbrellaTree.ts");
    const surfacePlay = (await import(/* @vite-ignore */ surfacePlayPath)) as SurfacePlayModule;
    const treeModule = (await import(/* @vite-ignore */ treeModulePath)) as HestiaUmbrellaTreeModule;
    const snapshot = surfacePlay.readActiveSurfacePlaySnapshot();
    const placement = snapshot?.world?.encounter.structuralTrees[0];
    if (snapshot === null || placement === undefined) {
      throw new Error("Surface Play Structural Tree target probe is unavailable.");
    }
    const tree = treeModule.createHestiaUmbrellaTree(placement);
    return {
      treeInstanceId: tree.instanceId,
      treeContentHash: tree.contentHash,
      pointMeters: {
        x: (tree.rootQuantum.x + 0.5) * 0.125,
        y: tree.rootQuantum.y * 0.125 + tree.graph.trunkHeightMeters * 0.45,
        z: (tree.rootQuantum.z + 0.5) * 0.125
      }
    };
  });

const readInteriorTerrainTarget = async (page: Page): Promise<InteriorTerrainTarget> =>
  page.evaluate<InteriorTerrainTarget>(async () => {
    const modulePath = String("/src/surface-play/index.ts");
    const surfacePlay = (await import(/* @vite-ignore */ modulePath)) as SurfacePlayModule;
    const snapshot = surfacePlay.readActiveSurfacePlaySnapshot();
    if (snapshot === null) throw new Error("Surface Play interior target probe is unavailable.");
    const world = snapshot.world;
    if (world === null || world === undefined) throw new Error("Surface Play World target probe is unavailable.");
    const tree = world.encounter.structuralTrees[0];
    if (tree === undefined) throw new Error("Surface Play World target probe found no Structural tree.");
    const treePoint = {
      x: tree.rootQuantum.x * 0.125,
      z: tree.rootQuantum.z * 0.125
    };
    const origin = snapshot.player.positionMeters;
    const distanceToSegment = (
      point: Readonly<{ readonly x: number; readonly z: number }>,
      end: Readonly<{ readonly x: number; readonly z: number }>
    ): number => {
      const dx = end.x - origin.x;
      const dz = end.z - origin.z;
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - origin.x) * dx + (point.z - origin.z) * dz) / lengthSquared));
      return Math.hypot(point.x - (origin.x + dx * t), point.z - (origin.z + dz * t));
    };
    const desired = [
      { x: world.anchorCenterMeters.x + 8, z: world.anchorCenterMeters.z + 8 },
      { x: world.anchorCenterMeters.x - 8, z: world.anchorCenterMeters.z + 8 },
      { x: world.anchorCenterMeters.x + 8, z: world.anchorCenterMeters.z - 8 },
      { x: world.anchorCenterMeters.x - 8, z: world.anchorCenterMeters.z - 8 }
    ];
    const candidates = desired.map((target) => {
      const cell = world.traversalDomain.cells.reduce((best, candidate) => {
        const candidateDistance = Math.hypot(
          candidate.centerMeters.x - target.x,
          candidate.centerMeters.z - target.z
        );
        const bestDistance = Math.hypot(best.centerMeters.x - target.x, best.centerMeters.z - target.z);
        return candidateDistance < bestDistance ? candidate : best;
      });
      return {
        gridX: cell.gridX,
        gridZ: cell.gridZ,
        pointMeters: {
          x: cell.centerMeters.x,
          y: cell.groundHeightMeters - 0.05,
          z: cell.centerMeters.z
        },
        treeClearanceMeters: distanceToSegment(treePoint, cell.centerMeters)
      };
    });
    candidates.sort((left, right) => right.treeClearanceMeters - left.treeClearanceMeters
      || left.gridZ - right.gridZ
      || left.gridX - right.gridX);
    const selected = candidates[0];
    if (selected === undefined || selected.treeClearanceMeters < 2) {
      throw new Error("No deterministic interior Terrain target has a clear Structural ray.");
    }
    return selected;
  });

const waitForSimulationTicks = async (
  page: Page,
  fromTick: number,
  tickCount: number,
  timeoutMilliseconds = 5_000
): Promise<{ readonly snapshot: SmallSurfacePlaySnapshot; readonly elapsedMilliseconds: number }> => {
  const startedAt = Date.now();
  const targetTick = fromTick + tickCount;
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const snapshot = await readSmallSnapshot(page);
    if (snapshot.player.simulationTick >= targetTick) {
      return { snapshot, elapsedMilliseconds: Date.now() - startedAt };
    }
    await page.waitForTimeout(25);
  }
  throw new Error(`Surface Play did not advance ${tickCount} simulation ticks within ${timeoutMilliseconds} ms.`);
};

const waitForMovementIdle = async (page: Page): Promise<SmallSurfacePlaySnapshot> => {
  await expect(page.locator("body")).toHaveAttribute("data-locomotion-state", "idle", { timeout: 5_000 });
  await expect.poll(async () => {
    const velocity = (await readSmallSnapshot(page)).player.velocityMetersPerSecond;
    return Math.hypot(velocity.x, velocity.z);
  }, { timeout: 5_000, intervals: [25, 50, 100] }).toBeLessThanOrEqual(0.05);
  return readSmallSnapshot(page);
};

const moveForTicks = async (
  page: Page,
  key: MovementKey,
  tickCount: number
): Promise<{ readonly before: SmallSurfacePlaySnapshot; readonly after: SmallSurfacePlaySnapshot }> => {
  const before = await readSmallSnapshot(page);
  await page.keyboard.down(key);
  try {
    await waitForSimulationTicks(page, before.player.simulationTick, tickCount);
  } finally {
    await page.keyboard.up(key);
  }
  return { before, after: await waitForMovementIdle(page) };
};

const expectNoSurfaceStatePause = async (page: Page): Promise<void> => {
  await expect(page.getByText("Movement paused because the surface state changed.", { exact: true }))
    .toHaveCount(0);
};

interface BoundaryInputCase {
  readonly name: "east" | "north" | "south" | "west";
  readonly axis: HorizontalAxis;
  readonly direction: -1 | 1;
  readonly key: MovementKey;
  readonly returnKey: MovementKey;
}

const reachBoundaryAndProveLiveness = async (
  page: Page,
  boundary: BoundaryInputCase,
  minimumTravelMeters: number
): Promise<{
  readonly start: SmallSurfacePlaySnapshot;
  readonly blocked: SmallSurfacePlaySnapshot;
  readonly held: SmallSurfacePlaySnapshot;
  readonly heldTickElapsedMilliseconds: number;
  readonly maximumSampleElapsedMilliseconds: number;
}> => {
  const start = await readSmallSnapshot(page);
  let previous = start;
  let stalledSamples = 0;
  let blocked: SmallSurfacePlaySnapshot | null = null;
  let held: SmallSurfacePlaySnapshot | null = null;
  let heldTickElapsedMilliseconds = Number.POSITIVE_INFINITY;
  let maximumSampleElapsedMilliseconds = 0;

  await page.keyboard.down("Shift");
  await page.keyboard.down(boundary.key);
  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const sampleStartedAt = Date.now();
      await page.waitForTimeout(100);
      const current = await readSmallSnapshot(page);
      maximumSampleElapsedMilliseconds = Math.max(
        maximumSampleElapsedMilliseconds,
        Date.now() - sampleStartedAt
      );
      const progress = boundary.direction * (
        current.player.positionMeters[boundary.axis] - start.player.positionMeters[boundary.axis]
      );
      const stepDistance = horizontalDistance(previous.player.positionMeters, current.player.positionMeters);
      stalledSamples = progress >= minimumTravelMeters && stepDistance <= 0.035
        ? stalledSamples + 1
        : 0;
      previous = current;
      if (stalledSamples >= 4) {
        blocked = current;
        break;
      }
    }
    if (blocked === null) {
      throw new Error(`${boundary.name} boundary was not reached by bounded real input.`);
    }
    const heldResult = await waitForSimulationTicks(page, blocked.player.simulationTick, 60, 5_000);
    held = heldResult.snapshot;
    heldTickElapsedMilliseconds = heldResult.elapsedMilliseconds;
  } finally {
    await page.keyboard.up(boundary.key);
    await page.keyboard.up("Shift");
  }

  if (blocked === null || held === null) {
    throw new Error(`${boundary.name} boundary liveness proof did not complete.`);
  }
  await waitForMovementIdle(page);
  return { start, blocked, held, heldTickElapsedMilliseconds, maximumSampleElapsedMilliseconds };
};

const returnFromBoundary = async (
  page: Page,
  boundary: BoundaryInputCase,
  anchor: Readonly<{ readonly x: number; readonly z: number }>
): Promise<{
  readonly start: SmallSurfacePlaySnapshot;
  readonly reachedAnchor: SmallSurfacePlaySnapshot;
  readonly idle: SmallSurfacePlaySnapshot;
}> => {
  const start = await readSmallSnapshot(page);
  const startDelta = start.player.positionMeters[boundary.axis] - anchor[boundary.axis];
  const startingSide = Math.sign(startDelta);
  if (startingSide === 0) throw new Error(`${boundary.name} return started on the anchor axis.`);
  let reachedAnchor: SmallSurfacePlaySnapshot | null = null;

  await page.keyboard.down("Shift");
  await page.keyboard.down(boundary.returnKey);
  try {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(50);
      const current = await readSmallSnapshot(page);
      const currentDelta = current.player.positionMeters[boundary.axis] - anchor[boundary.axis];
      const resumedDistance = horizontalDistance(start.player.positionMeters, current.player.positionMeters);
      if (
        resumedDistance >= 1
        && (Math.abs(currentDelta) <= 0.75 || Math.sign(currentDelta) !== startingSide)
      ) {
        reachedAnchor = current;
        break;
      }
    }
  } finally {
    await page.keyboard.up(boundary.returnKey);
    await page.keyboard.up("Shift");
  }

  if (reachedAnchor === null) {
    throw new Error(`${boundary.name} boundary return did not resume to the anchor axis.`);
  }
  return { start, reachedAnchor, idle: await waitForMovementIdle(page) };
};

const expectSurfacePlayReady = async (page: Page): Promise<void> => {
  const body = page.locator("body");
  await expect(body).toHaveAttribute("data-ui-surface", "surface-play");
  await expect(body).toHaveAttribute("data-surface-play-state", "ready");
  await expect(body).toHaveAttribute("data-locomotion-state", /^(idle|moving|sprinting|airborne)$/);

  const viewport = page.locator('canvas[aria-label="Hestia surface viewport"]');
  await expect(page.locator("canvas:visible")).toHaveCount(1);
  await expect(viewport).toHaveCount(1);
  await expect(viewport).toBeVisible();

  const hud = page.locator("#surface-play-hud");
  await expect(hud).toBeVisible();
  await expect(hud).toHaveAttribute("aria-label", "Hestia surface suit status");
  await expect(page.getByRole("region", { name: "Suit status", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pulse Cutter status", exact: true })).toBeVisible();

  await expect(page.getByRole("region", { name: "Suit control engagement", exact: true })).toBeVisible();
  const engageControl = page.getByRole("button", { name: "Click to engage suit control", exact: true });
  await expect(engageControl).toBeVisible();
  await expect(engageControl).toBeEnabled();
  await expect(engageControl).toHaveText("CLICK TO ENGAGE SUIT CONTROL");
};

test("Surface Play exposes its ready player viewport, locomotion state, HUD and control intent", async ({ page }) => {
  await gotoReady(page);
});

test("reusable Surface Play Driver controls and measures the player through real browser input only", async ({
  page
}, testInfo) => {
  test.setTimeout(150_000);
  const driver = new SurfacePlayDriver(page);
  let runEvidence: unknown = null;
  let cleanupEvidence: unknown = null;

  try {
    const ready = await driver.openRoute();
    const engaged = await driver.engagePointerLock();
    const movement = await driver.moveSequence(["w", "a", "s", "d", "Space"], 100);
    const aimed = await driver.aimByMouseDelta(24, -12);
    const fired = await driver.clickFire();
    const performance = await driver.measureFrameAndLongTasks(350);
    const optionalF1 = await driver.toggleF1IfPresent("#surface-play-debug-overlay");
    const afterF1 = await driver.readDomEvidence();
    const screenshot = await driver.captureScreenshot(testInfo.outputPath("surface-play-driver-real-input.png"));
    await testInfo.attach("surface-play-driver-real-input", { path: screenshot, contentType: "image/png" });

    expect(ready.testBridge).toEqual({ ownProperty: false, inWindow: false });
    expect(engaged.pointerLockState).toBe("engaged");
    expect(engaged.pointerLockElement).toBe("Hestia surface viewport");
    expect(movement.some(({ during }) => /^(moving|sprinting)$/.test(during.locomotionState ?? ""))).toBe(true);
    expect(aimed.testBridge).toEqual({ ownProperty: false, inWindow: false });
    expect(fired.testBridge).toEqual({ ownProperty: false, inWindow: false });
    expect(afterF1.pointerLockState).toBe("engaged");
    expect(afterF1.testBridge).toEqual({ ownProperty: false, inWindow: false });
    expect(performance.frameCount).toBeGreaterThan(1);
    expect(optionalF1).toMatchObject({
      available: true,
      selector: "#surface-play-debug-overlay",
      before: {
        hidden: true,
        ariaHidden: "true",
        state: "false"
      },
      after: {
        hidden: false,
        ariaHidden: "false",
        state: "true"
      }
    });

    runEvidence = { ready, engaged, movement, aimed, fired, performance, optionalF1, afterF1, screenshot };
  } finally {
    cleanupEvidence = await driver.release();
  }

  await writeJsonEvidence(testInfo, "surface-play-driver-real-input", {
    run: runEvidence,
    cleanup: cleanupEvidence
  });
  expect(cleanupEvidence).toMatchObject({ pointerLockReleased: true });
});

test("Surface Play visibly traverses its real monotonic startup phases before becoming ready", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const health = collectBrowserHealth(page);
  await page.addInitScript(() => {
    interface LoadingEvidence {
      readonly phase: string;
      readonly detail: string;
      readonly role: string | null;
      readonly ariaBusy: string | null;
      readonly ariaValueNow: string | null;
      readonly ariaValueText: string | null;
      readonly observedAtMilliseconds: number;
    }
    const evidence: LoadingEvidence[] = [];
    Object.defineProperty(window, "__surfacePlayLoadingEvidence", {
      value: evidence,
      configurable: true
    });
    const startedAt = performance.now();
    const capture = (): void => {
      const root = document.querySelector<HTMLElement>("#surface-play-loading");
      const phase = root?.dataset.phase;
      if (root === null || phase === undefined || evidence.at(-1)?.phase === phase) return;
      const progress = root.querySelector<HTMLElement>('[role="progressbar"]');
      evidence.push({
        phase,
        detail: root.querySelector("p")?.textContent ?? "",
        role: root.getAttribute("role"),
        ariaBusy: root.getAttribute("aria-busy"),
        ariaValueNow: progress?.getAttribute("aria-valuenow") ?? null,
        ariaValueText: progress?.getAttribute("aria-valuetext") ?? null,
        observedAtMilliseconds: performance.now() - startedAt
      });
    };
    new MutationObserver(capture).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-phase", "aria-valuetext"]
    });
    capture();
  });

  await page.goto("/?surfacePlay=1", { waitUntil: "commit" });
  const loader = page.locator("#surface-play-loading");
  await expect(loader).toBeVisible({ timeout: 15_000 });
  const loadingScreenshot = await captureScreenshot(page, testInfo, "surface-play-startup-loading");

  await expect(page.locator('body[data-ui-surface="surface-play"][data-surface-play-state="ready"]'))
    .toHaveCount(1, { timeout: 120_000 });
  await expectSurfacePlayReady(page);
  await expect(loader).toHaveCount(0);
  const evidence = await page.evaluate(() => (
    window as unknown as Window & {
      readonly __surfacePlayLoadingEvidence: readonly {
        readonly phase: string;
        readonly detail: string;
        readonly role: string | null;
        readonly ariaBusy: string | null;
        readonly ariaValueNow: string | null;
        readonly ariaValueText: string | null;
        readonly observedAtMilliseconds: number;
      }[];
    }
  ).__surfacePlayLoadingEvidence);

  expect(evidence.map(({ phase }) => phase)).toEqual([
    "loading-module",
    "preparing-world",
    "materializing-terrain",
    "resolving-spawn",
    "starting-runtime",
    "preparing-presentation",
    "connecting-controls"
  ]);
  expect(evidence.every(({ detail, ariaValueText }) => detail.length > 0 && detail === ariaValueText)).toBe(true);
  expect(evidence.every(({ role, ariaBusy }) => role === "status" && ariaBusy === "true")).toBe(true);
  expect(evidence.every(({ ariaValueNow }) => ariaValueNow === null)).toBe(true);
  expect(evidence.every(({ observedAtMilliseconds }, index) =>
    index === 0 || observedAtMilliseconds >= evidence[index - 1]!.observedAtMilliseconds
  )).toBe(true);
  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });
  await writeJsonEvidence(testInfo, "surface-play-startup-loading-evidence", {
    loadingScreenshot,
    phases: evidence,
    finalSurfaceState: await page.locator("body").getAttribute("data-surface-play-state"),
    testBridge: await testBridgeState(page),
    health
  });
});

test("Surface Play keyboard movement updates player-facing locomotion and returns to idle", async ({ page }) => {
  await gotoReady(page);

  const body = page.locator("body");
  await expect(body).toHaveAttribute("data-locomotion-state", "idle");
  await page.getByRole("button", { name: "Click to engage suit control", exact: true }).click();
  await expect(page.locator(".surface-play-ui")).toHaveAttribute("data-pointer-lock", "engaged");
  await page.keyboard.down("w");
  try {
    await expect(body).toHaveAttribute("data-locomotion-state", /^(moving|sprinting)$/);
  } finally {
    await page.keyboard.up("w");
  }

  await expect(page.locator("#surface-play-grounded")).toHaveText("GROUNDED");
  await expect(body).toHaveAttribute("data-locomotion-state", "idle");
});

test("Surface Play applies one real Pointer-Lock cutter shot to the survey drone without stalling", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const health = collectBrowserHealth(page);
  await gotoReady(page);
  const before = await readSmallSnapshot(page);
  if (before.world === null) throw new Error("Surface Play did not publish the survey-drone position.");
  const pointer = await engagePointerLock(page);
  await turnToWorldPointWithRealMouse(page, pointer, before.world.surveyDronePositionMeters);
  await page.evaluate(() => {
    const entries: { readonly startTime: number; readonly duration: number }[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) entries.push({
        startTime: entry.startTime,
        duration: entry.duration
      });
    });
    observer.observe({ entryTypes: ["longtask"] });
    Object.defineProperty(window, "__surfacePlayTargetShotLongTasks", {
      value: { entries, observer },
      configurable: true
    });
  });

  const previousCommandId = before.combat.latestFireResult?.commandId ?? null;
  const startedAt = Date.now();
  await page.mouse.click(pointer.x, pointer.y, { button: "left" });
  await expect.poll(
    async () => (await readSmallSnapshot(page)).combat.latestFireResult?.commandId ?? null,
    { timeout: 30_000, intervals: [25, 50, 100, 250] }
  ).not.toBe(previousCommandId);
  const clickToPublishedMilliseconds = Date.now() - startedAt;
  const after = await readSmallSnapshot(page);
  const longTasks = await page.evaluate(() => {
    const state = (
      window as unknown as Window & {
        readonly __surfacePlayTargetShotLongTasks: {
          readonly entries: readonly { readonly startTime: number; readonly duration: number }[];
          readonly observer: PerformanceObserver;
        };
      }
    ).__surfacePlayTargetShotLongTasks;
    state.observer.disconnect();
    return state.entries;
  });
  const maximumLongTaskMilliseconds = longTasks.reduce(
    (maximum, entry) => Math.max(maximum, entry.duration),
    0
  );
  const screenshot = await captureScreenshot(page, testInfo, "real-input-survey-drone-hit");
  await writeJsonEvidence(testInfo, "real-input-survey-drone-hit", {
    clickToPublishedMilliseconds,
    maximumLongTaskMilliseconds,
    longTasks,
    before: {
      player: before.player,
      view: before.view,
      combat: before.combat
    },
    after: {
      player: after.player,
      view: after.view,
      combat: after.combat,
      latestRejection: after.latestRejection
    },
    screenshot,
    pointerLock: await page.locator(".surface-play-ui").getAttribute("data-pointer-lock"),
    testBridge: await testBridgeState(page),
    health
  });

  if (before.combat.target === null || after.combat.target === null) {
    throw new Error("Surface Play did not publish the survey-drone Combat target around the accepted shot.");
  }
  expect(after.combat.latestFireResult).toMatchObject({ status: "Accepted", hit: "Target" });
  expect(after.combat.target.integrity).toBeLessThan(before.combat.target.integrity);
  expect(after.latestRejection).toBeNull();
  expect(clickToPublishedMilliseconds).toBeLessThanOrEqual(250);
  expect(maximumLongTaskMilliseconds).toBeLessThanOrEqual(100);
  await expect(page.locator(".surface-play-ui")).toHaveAttribute("data-pointer-lock", "engaged");
  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });
});

test("Surface Play accepts a real interior crater cut without reapplying the initial 12 m reserve", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const health = collectBrowserHealth(page);
  await gotoReady(page);
  const pointer = await engagePointerLock(page);
  const target = await readInteriorTerrainTarget(page);
  const before = await readSmallSnapshot(page);
  if (before.world === null) throw new Error("Surface Play did not publish World-owned Hestia facts.");
  const targetDistanceFromAnchor = horizontalDistance(target.pointMeters, before.world.anchor);
  expect(targetDistanceFromAnchor).toBeGreaterThan(10.5);
  expect(targetDistanceFromAnchor).toBeLessThan(12);
  expect(target.treeClearanceMeters).toBeGreaterThanOrEqual(2);
  await turnToWorldPointWithRealMouse(page, pointer, target.pointMeters);

  const fireStartedAt = Date.now();
  await page.mouse.click(pointer.x, pointer.y, { button: "left" });
  await expect.poll(
    async () => (await readSmallSnapshot(page)).presentation.appliedVoxelTransitionCount,
    { timeout: 30_000, intervals: [25, 50, 100, 250] }
  ).toBeGreaterThan(before.presentation.appliedVoxelTransitionCount);
  const authoritativeVisibleMilliseconds = Date.now() - fireStartedAt;
  const after = await readSmallSnapshot(page);
  if (after.world === null) throw new Error("Surface Play lost its World after an accepted interior cut.");

  expect(after.presentation.latestVoxelTransition?.result.status).toBe("Applied");
  expect(after.authority.regionRevision).toBe(before.authority.regionRevision + 1);
  expect(after.authority.editRevision).toBe(before.authority.editRevision + 1);
  expect(after.world.identity.regionRevision).toBe(after.authority.regionRevision);
  expect(after.presentation.appliedVoxelTransitionCount).toBe(before.presentation.appliedVoxelTransitionCount + 1);
  expect(after.world.dryCellCount).toBe(before.world.dryCellCount);
  expect(after.world.spawnPerimeterDistanceMeters).toBeLessThan(12);
  expect(after.combat.energyJoules).toBe(before.combat.energyJoules - 12);
  expect(after.latestRejection).toBeNull();
  expect(after.presentation.structural?.physicsFailure ?? null).toBeNull();
  expect(authoritativeVisibleMilliseconds).toBeLessThan(2_000);
  await expect(page.locator(".surface-play-ui")).toHaveAttribute("data-pointer-lock", "engaged");
  await expectNoSurfaceStatePause(page);

  const deeperCuts: unknown[] = [];
  let latestCut = after;
  for (let cutIndex = 1; cutIndex <= 2; cutIndex += 1) {
    await expect.poll(async () => (await readSmallSnapshot(page)).combat.readiness.kind, {
      timeout: 5_000,
      intervals: [25, 50, 100]
    }).toBe("Ready");
    await turnToWorldPointWithRealMouse(page, pointer, {
      ...target.pointMeters,
      y: target.pointMeters.y - cutIndex * 0.5
    });
    const priorCut = await readSmallSnapshot(page);
    const startedAt = Date.now();
    await page.mouse.click(pointer.x, pointer.y, { button: "left" });
    await expect.poll(
      async () => (await readSmallSnapshot(page)).presentation.appliedVoxelTransitionCount,
      { timeout: 30_000, intervals: [25, 50, 100, 250] }
    ).toBeGreaterThan(priorCut.presentation.appliedVoxelTransitionCount);
    latestCut = await readSmallSnapshot(page);
    expect(latestCut.presentation.latestVoxelTransition?.result.status).toBe("Applied");
    expect(latestCut.authority.regionRevision).toBe(priorCut.authority.regionRevision + 1);
    expect(latestCut.world?.dryCellCount).toBe(before.world.dryCellCount);
    expect(latestCut.latestRejection).toBeNull();
    expect(latestCut.presentation.structural?.physicsFailure ?? null).toBeNull();
    deeperCuts.push({
      cutIndex,
      authoritativeVisibleMilliseconds: Date.now() - startedAt,
      authority: latestCut.authority,
      world: latestCut.world,
      latestVoxelTransition: latestCut.presentation.latestVoxelTransition
    });
  }

  const approachStartedAt = Date.now();
  const approachStart = await readSmallSnapshot(page);
  const approachSamples: unknown[] = [];
  let closestDistanceMeters = Number.POSITIVE_INFINITY;
  let closestSnapshot = approachStart;
  let maximumSampleMilliseconds = 0;
  await page.keyboard.down("w");
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const sampleStartedAt = Date.now();
      await page.waitForTimeout(50);
      const sample = await readSmallSnapshot(page);
      maximumSampleMilliseconds = Math.max(maximumSampleMilliseconds, Date.now() - sampleStartedAt);
      const distanceMeters = horizontalDistance(sample.player.positionMeters, target.pointMeters);
      if (distanceMeters < closestDistanceMeters) {
        closestDistanceMeters = distanceMeters;
        closestSnapshot = sample;
      }
      approachSamples.push({
        simulationTick: sample.player.simulationTick,
        positionMeters: sample.player.positionMeters,
        velocityMetersPerSecond: sample.player.velocityMetersPerSecond,
        grounded: sample.player.grounded,
        supportState: sample.player.supportState,
        distanceMeters
      });
      if (distanceMeters <= 0.8) break;
    }
  } finally {
    await page.keyboard.up("w");
  }
  const approachElapsedMilliseconds = Date.now() - approachStartedAt;
  const approachDistanceMeters = horizontalDistance(
    approachStart.player.positionMeters,
    closestSnapshot.player.positionMeters
  );
  expect(closestDistanceMeters).toBeLessThanOrEqual(0.8);
  expect(approachDistanceMeters).toBeGreaterThan(9.5);
  expect(approachDistanceMeters / (approachElapsedMilliseconds / 1_000)).toBeGreaterThan(2.5);
  expect(maximumSampleMilliseconds).toBeLessThan(1_000);
  expect(closestSnapshot.player.simulationTick).toBeGreaterThan(approachStart.player.simulationTick + 90);

  await expect.poll(async () => {
    const snapshot = await readSmallSnapshot(page);
    return snapshot.player.grounded && snapshot.player.supportState === "SupportedResting";
  }, { timeout: 5_000, intervals: [25, 50, 100] }).toBe(true);
  const craterRest = await readSmallSnapshot(page);
  const jumpStartTick = craterRest.player.simulationTick;
  await page.keyboard.press("Space");
  await expect.poll(async () => (await readSmallSnapshot(page)).player.grounded, {
    timeout: 2_000,
    intervals: [25, 50]
  }).toBe(false);
  const airborne = await readSmallSnapshot(page);
  await expect.poll(async () => {
    const snapshot = await readSmallSnapshot(page);
    return snapshot.player.grounded && snapshot.player.supportState === "SupportedResting";
  }, { timeout: 5_000, intervals: [25, 50, 100] }).toBe(true);
  const landed = await readSmallSnapshot(page);
  expect(airborne.player.simulationTick).toBeGreaterThan(jumpStartTick);
  expect(landed.player.simulationTick).toBeGreaterThan(airborne.player.simulationTick);

  const exited = await moveForTicks(page, "w", 60);
  expect(horizontalDistance(exited.after.player.positionMeters, target.pointMeters)).toBeGreaterThan(2);
  expect(exited.after.player.grounded).toBe(true);
  expect(exited.after.player.supportState).toBe("SupportedResting");
  expect(exited.after.latestRejection).toBeNull();
  expect(exited.after.presentation.structural?.physicsFailure ?? null).toBeNull();
  await expect(page.locator(".surface-play-ui")).toHaveAttribute("data-pointer-lock", "engaged");
  await expectNoSurfaceStatePause(page);
  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });

  const screenshot = await captureScreenshot(page, testInfo, "real-input-interior-crater-locomotion");
  await writeJsonEvidence(testInfo, "real-input-interior-crater-cut", {
    target,
    targetDistanceFromAnchor,
    authoritativeVisibleMilliseconds,
    before,
    after,
    deeperCuts,
    latestCut,
    locomotion: {
      approachElapsedMilliseconds,
      approachDistanceMeters,
      closestDistanceMeters,
      maximumSampleMilliseconds,
      samples: approachSamples,
      craterRest,
      airborne,
      landed,
      exited
    },
    screenshot,
    health
  });
});

test("Surface Play maps A and D to camera-local left and right at two real mouse yaw orientations", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const health = collectBrowserHealth(page);
  await gotoReady(page);
  const pointer = await engagePointerLock(page);
  const firstOrientation = await readSmallSnapshot(page);
  const orientationEvidence: unknown[] = [];

  for (const [index, yawRadians] of [
    firstOrientation.player.yawRadians,
    firstOrientation.player.yawRadians + Math.PI / 2
  ].entries()) {
    const orientation = index === 0
      ? await readSmallSnapshot(page)
      : await turnToYawWithRealMouse(page, pointer, yawRadians);
    if (index === 1) {
      expect(Math.abs(shortestAngleDelta(firstOrientation.player.yawRadians, orientation.player.yawRadians)))
        .toBeGreaterThan(1.3);
    }

    const left = await moveForTicks(page, "a", 30);
    const right = await moveForTicks(page, "d", 30);
    const leftDisplacement = horizontalDisplacement(
      left.before.player.positionMeters,
      left.after.player.positionMeters
    );
    const rightDisplacement = horizontalDisplacement(
      right.before.player.positionMeters,
      right.after.player.positionMeters
    );
    const viewRight = {
      x: -Math.cos(orientation.player.yawRadians),
      z: Math.sin(orientation.player.yawRadians)
    };
    const leftDotViewRight = leftDisplacement.x * viewRight.x + leftDisplacement.z * viewRight.z;
    const rightDotViewRight = rightDisplacement.x * viewRight.x + rightDisplacement.z * viewRight.z;

    expect(leftDotViewRight).toBeLessThan(-0.65);
    expect(rightDotViewRight).toBeGreaterThan(0.65);
    expect(left.after.latestRejection).toBeNull();
    expect(right.after.latestRejection).toBeNull();
    expect(left.after.testBridge).toEqual({ ownProperty: false, inWindow: false });
    expect(right.after.testBridge).toEqual({ ownProperty: false, inWindow: false });
    await expect(page.locator("body")).toHaveAttribute("data-locomotion-state", "idle");

    orientationEvidence.push({
      index,
      yawRadians: orientation.player.yawRadians,
      viewRight,
      left: {
        before: movementEvidenceState(left.before),
        after: movementEvidenceState(left.after),
        displacement: leftDisplacement,
        dotViewRight: leftDotViewRight
      },
      right: {
        before: movementEvidenceState(right.before),
        after: movementEvidenceState(right.after),
        displacement: rightDisplacement,
        dotViewRight: rightDotViewRight
      }
    });
  }

  await expectNoSurfaceStatePause(page);
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });
  await writeJsonEvidence(testInfo, "real-input-camera-local-strafe", { orientations: orientationEvidence, health });
  await captureScreenshot(page, testInfo, "real-input-camera-local-strafe");
});

test("Surface Play tree contact blocks penetration without pausing simulation and real steering escapes", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const health = collectBrowserHealth(page);
  await gotoReady(page);
  const pointer = await engagePointerLock(page);
  const start = await readSmallSnapshot(page);
  if (start.world === null) throw new Error("Surface Play did not publish World-owned Hestia facts.");
  const treeRoot = start.world.structuralTreeRoots[0];
  if (treeRoot === undefined) throw new Error("Surface Play published no Structural tree root.");
  const initialTreeDistance = horizontalDistance(start.player.positionMeters, treeRoot);
  expect(initialTreeDistance).toBeGreaterThanOrEqual(6);
  await turnToYawWithRealMouse(
    page,
    pointer,
    Math.atan2(
      treeRoot.x - start.player.positionMeters.x,
      treeRoot.z - start.player.positionMeters.z
    )
  );

  let previous = await readSmallSnapshot(page);
  let stalledSamples = 0;
  let contactStart: SmallSurfacePlaySnapshot | null = null;
  let contactEnd: SmallSurfacePlaySnapshot | null = null;
  let contactTickElapsedMilliseconds = Number.POSITIVE_INFINITY;
  let maximumApproachSampleElapsedMilliseconds = 0;
  await page.keyboard.down("w");
  try {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const sampleStartedAt = Date.now();
      await page.waitForTimeout(100);
      const current = await readSmallSnapshot(page);
      maximumApproachSampleElapsedMilliseconds = Math.max(
        maximumApproachSampleElapsedMilliseconds,
        Date.now() - sampleStartedAt
      );
      const distanceToTree = horizontalDistance(current.player.positionMeters, treeRoot);
      const stepDistance = horizontalDistance(previous.player.positionMeters, current.player.positionMeters);
      stalledSamples = distanceToTree < 1.5 && stepDistance <= 0.025
        ? stalledSamples + 1
        : 0;
      previous = current;
      if (stalledSamples >= 4) {
        contactStart = current;
        break;
      }
    }
    if (contactStart === null) {
      throw new Error("Real forward input did not reach a stable Structural trunk collision.");
    }
    const contactTickResult = await waitForSimulationTicks(page, contactStart.player.simulationTick, 60, 5_000);
    contactEnd = contactTickResult.snapshot;
    contactTickElapsedMilliseconds = contactTickResult.elapsedMilliseconds;
  } finally {
    await page.keyboard.up("w");
  }

  if (contactStart === null || contactEnd === null) {
    throw new Error("Structural trunk liveness proof did not complete.");
  }
  const contactIdle = await waitForMovementIdle(page);
  const contactDistance = horizontalDistance(contactEnd.player.positionMeters, treeRoot);
  const contactHoldDrift = horizontalDistance(
    contactStart.player.positionMeters,
    contactEnd.player.positionMeters
  );
  expect(contactDistance).toBeGreaterThanOrEqual(contactEnd.player.capsule.radiusMeters + 0.2);
  expect(contactDistance).toBeLessThan(1.5);
  expect(contactHoldDrift).toBeLessThanOrEqual(0.2);
  expect(contactEnd.player.simulationTick - contactStart.player.simulationTick).toBeGreaterThanOrEqual(60);
  expect(contactTickElapsedMilliseconds).toBeLessThan(3_000);
  expect(maximumApproachSampleElapsedMilliseconds).toBeLessThan(2_000);
  expect(contactEnd.latestRejection).toBeNull();
  expect(contactIdle.latestRejection).toBeNull();
  await expectNoSurfaceStatePause(page);
  await captureScreenshot(page, testInfo, "real-input-tree-contact-live");

  await turnToYawWithRealMouse(page, pointer, contactIdle.player.yawRadians + Math.PI / 2);
  const escaped = await moveForTicks(page, "w", 45);
  const escapeDistance = horizontalDistance(
    escaped.before.player.positionMeters,
    escaped.after.player.positionMeters
  );
  expect(escapeDistance).toBeGreaterThan(1.25);
  expect(horizontalDistance(escaped.after.player.positionMeters, treeRoot)).toBeGreaterThan(contactDistance + 0.25);
  expect(escaped.after.latestRejection).toBeNull();
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });

  await writeJsonEvidence(testInfo, "real-input-tree-contact-live", {
    treeRoot,
    initialTreeDistance,
    contact: {
      start: movementEvidenceState(contactStart),
      end: movementEvidenceState(contactEnd),
      idle: movementEvidenceState(contactIdle),
      distanceMeters: contactDistance,
      holdDriftMeters: contactHoldDrift,
      tickElapsedMilliseconds: contactTickElapsedMilliseconds,
      maximumApproachSampleElapsedMilliseconds
    },
    escape: {
      before: movementEvidenceState(escaped.before),
      after: movementEvidenceState(escaped.after),
      distanceMeters: escapeDistance
    },
    health
  });
  await captureScreenshot(page, testInfo, "real-input-tree-contact-escaped");
});

test("Surface Play publishes responsive Structural cuts and a visibly evolving deterministic Tree fall", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const health = collectBrowserHealth(page);
  await gotoReady(page);
  const pointer = await engagePointerLock(page);
  const target = await readStructuralTreeAimTarget(page);
  await turnToWorldPointWithRealMouse(page, pointer, target.pointMeters);
  const initial = await readSmallSnapshot(page);
  const initialStructural = initial.presentation.structural;
  if (initialStructural === null) throw new Error("Surface Play published no Structural presentation.");
  expect(initialStructural.bodySources).toHaveLength(0);
  expect(initialStructural.dynamicBodies).toHaveLength(0);

  const longTaskCollector = await page.evaluateHandle(() => {
    const entries: { readonly name: string; readonly startTime: number; readonly duration: number }[] = [];
    if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      throw new Error("This Chromium build does not expose the Long Tasks API.");
    }
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        entries.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration
        });
      }
    });
    observer.observe({ type: "longtask", buffered: false });
    return { entries, observer };
  });

  const shots: {
    readonly ordinal: number;
    readonly clickToPublishedMilliseconds: number;
    readonly previousObjectRevision: number;
    readonly resultingObjectRevision: number;
    readonly fireResult: SmallSurfacePlaySnapshot["combat"]["latestFireResult"];
    readonly latestTransition: NonNullable<SmallSurfacePlaySnapshot["presentation"]["structural"]>["latestTransition"];
    readonly bodySourceCount: number;
    readonly dynamicBodyCount: number;
    readonly energyJoules: number;
  }[] = [];
  const poses: {
    readonly lifecycle: string;
    readonly simulationTick: number;
    readonly positionMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly orientation: Readonly<{ readonly x: number; readonly y: number; readonly z: number; readonly w: number }>;
    readonly linearVelocityMetersPerSecond: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly angularVelocityRadiansPerSecond: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  }[] = [];
  let firstFallingScreenshot: string | null = null;
  let restingScreenshot: string | null = null;
  let longTasks: readonly { readonly name: string; readonly startTime: number; readonly duration: number }[] = [];

  try {
    for (let ordinal = 0; ordinal < 6; ordinal += 1) {
      await expect.poll(
        async () => (await readSmallSnapshot(page)).combat.readiness.kind,
        { timeout: 15_000, intervals: [25, 50, 100] }
      ).toBe("Ready");
      await turnToWorldPointWithRealMouse(page, pointer, target.pointMeters);
      const before = await readSmallSnapshot(page);
      const beforeStructural = before.presentation.structural;
      if (beforeStructural === null) throw new Error("Structural presentation disappeared before a Tree shot.");
      const previousObjectRevision = beforeStructural.objects[0]?.objectRevision;
      if (previousObjectRevision === undefined) throw new Error("Structural Tree object revision is unavailable.");
      const previousFireCommandId = before.combat.latestFireResult?.commandId ?? null;

      const startedAt = Date.now();
      await page.mouse.click(pointer.x, pointer.y);
      await expect.poll(
        async () => (await readSmallSnapshot(page)).combat.latestFireResult?.commandId ?? null,
        { timeout: 15_000, intervals: [10, 25, 50, 100] }
      ).not.toBe(previousFireCommandId);
      await expect.poll(
        async () => (await readSmallSnapshot(page)).presentation.structural?.objects[0]?.objectRevision ?? -1,
        { timeout: 15_000, intervals: [10, 25, 50, 100] }
      ).toBeGreaterThan(previousObjectRevision);
      const after = await readSmallSnapshot(page);
      const afterStructural = after.presentation.structural;
      if (afterStructural === null) throw new Error("Structural presentation disappeared after a Tree shot.");
      const resultingObjectRevision = afterStructural.objects[0]?.objectRevision;
      if (resultingObjectRevision === undefined) throw new Error("Resulting Structural Tree revision is unavailable.");
      const fireResult = after.combat.latestFireResult;
      expect(fireResult).toMatchObject({ status: "Accepted", hit: "Structural" });
      shots.push({
        ordinal,
        clickToPublishedMilliseconds: Date.now() - startedAt,
        previousObjectRevision,
        resultingObjectRevision,
        fireResult,
        latestTransition: afterStructural.latestTransition,
        bodySourceCount: afterStructural.bodySources.length,
        dynamicBodyCount: afterStructural.dynamicBodies.length,
        energyJoules: after.combat.energyJoules
      });
      if (afterStructural.dynamicBodies.length > 0) break;
    }

    const fallDeadline = Date.now() + 20_000;
    let lastPoseKey: string | null = null;
    while (Date.now() < fallDeadline) {
      const snapshot = await readSmallSnapshot(page);
      const structural = snapshot.presentation.structural;
      if (structural === null) throw new Error("Structural presentation disappeared during Tree fall.");
      if (structural.physicsFailure !== null) break;
      const body = structural.dynamicBodies[0];
      if (body === undefined) {
        await page.waitForTimeout(16);
        continue;
      }
      const poseKey = JSON.stringify([
        body.lifecycle,
        body.positionMeters.x,
        body.positionMeters.y,
        body.positionMeters.z,
        body.orientation.x,
        body.orientation.y,
        body.orientation.z,
        body.orientation.w
      ]);
      if (poseKey !== lastPoseKey) {
        poses.push({
          lifecycle: body.lifecycle,
          simulationTick: body.simulationTick,
          positionMeters: body.positionMeters,
          orientation: body.orientation,
          linearVelocityMetersPerSecond: body.linearVelocityMetersPerSecond,
          angularVelocityRadiansPerSecond: body.angularVelocityRadiansPerSecond
        });
        lastPoseKey = poseKey;
      }
      if (body.lifecycle === "Falling" && firstFallingScreenshot === null) {
        firstFallingScreenshot = await captureScreenshot(page, testInfo, "real-input-tree-fall-falling");
      }
      if (body.lifecycle === "Resting") {
        restingScreenshot = await captureScreenshot(page, testInfo, "real-input-tree-fall-resting");
        break;
      }
      await page.waitForTimeout(16);
    }
  } finally {
    longTasks = await longTaskCollector.evaluate((collector) => {
      collector.observer.disconnect();
      return collector.entries;
    });
    await longTaskCollector.dispose();
  }

  const final = await readSmallSnapshot(page);
  const finalStructural = final.presentation.structural;
  if (finalStructural === null) throw new Error("Structural presentation disappeared after Tree fall.");
  const fallingPoses = poses.filter((pose) => pose.lifecycle === "Falling");
  const maximumLongTaskMilliseconds = longTasks.reduce(
    (maximum, entry) => Math.max(maximum, entry.duration),
    0
  );
  const maximumClickToPublishedMilliseconds = shots.reduce(
    (maximum, shot) => Math.max(maximum, shot.clickToPublishedMilliseconds),
    0
  );
  const firstFallingPose = fallingPoses[0];
  const lastPose = poses.at(-1);
  const restingPose = lastPose?.lifecycle === "Resting" ? lastPose : undefined;
  const restingTiltRadians = restingPose === undefined
    ? 0
    : Math.acos(Math.max(
        -1,
        Math.min(
          1,
          1 - 2 * (
            restingPose.orientation.x * restingPose.orientation.x
            + restingPose.orientation.z * restingPose.orientation.z
          )
        )
      ));
  const horizontalFallDisplacementMeters = firstFallingPose === undefined || restingPose === undefined
    ? 0
    : horizontalDistance(firstFallingPose.positionMeters, restingPose.positionMeters);

  await writeJsonEvidence(testInfo, "real-input-tree-cut-and-fall", {
    target,
    initial: {
      authority: initial.authority,
      object: initialStructural.objects[0],
      energyJoules: initial.combat.energyJoules
    },
    shots,
    poses,
    performance: {
      maximumClickToPublishedMilliseconds,
      maximumLongTaskMilliseconds,
      longTasks
    },
    physicalFall: {
      restingTiltRadians,
      horizontalFallDisplacementMeters
    },
    screenshots: {
      firstFallingScreenshot,
      restingScreenshot
    },
    final: {
      authority: final.authority,
      structural: finalStructural,
      player: final.player,
      latestRejection: final.latestRejection,
      testBridge: final.testBridge
    },
    health
  });

  expect(shots.length).toBeGreaterThan(0);
  expect(finalStructural.bodySources).toHaveLength(1);
  expect(finalStructural.dynamicBodies).toHaveLength(1);
  expect(fallingPoses.length).toBeGreaterThanOrEqual(3);
  expect(poses.at(-1)?.lifecycle).toBe("Resting");
  expect(firstFallingScreenshot).not.toBeNull();
  expect(restingScreenshot).not.toBeNull();
  expect(finalStructural.physicsFailure).toBeNull();
  expect(final.latestRejection).toBeNull();
  expect(final.testBridge).toEqual({ ownProperty: false, inWindow: false });
  expect.soft(
    maximumClickToPublishedMilliseconds,
    "Every real click must publish its authoritative Structural revision within 250 ms."
  ).toBeLessThanOrEqual(250);
  expect.soft(
    maximumLongTaskMilliseconds,
    "Structural cuts and the visible fall must not create a browser Long Task over 100 ms."
  ).toBeLessThanOrEqual(100);
  expect.soft(
    restingTiltRadians,
    "A severed Tree must physically topple by at least 45 degrees before Resting."
  ).toBeGreaterThanOrEqual(Math.PI / 4);
  expect.soft(
    horizontalFallDisplacementMeters,
    "A severed Tree center of mass must move laterally by at least 0.5 m before Resting."
  ).toBeGreaterThanOrEqual(0.5);
  await expect(page.locator(".surface-play-ui")).toHaveAttribute("data-pointer-lock", "engaged");
  await expectNoSurfaceStatePause(page);
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });
});

test("Surface Play keeps all four bounded-domain edges live under sustained real input", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const health = collectBrowserHealth(page);
  await gotoReady(page);
  await engagePointerLock(page);
  const start = await readSmallSnapshot(page);
  if (start.world === null) throw new Error("Surface Play did not publish World-owned Hestia facts.");
  expect(Math.abs(shortestAngleDelta(start.player.yawRadians, Math.PI))).toBeLessThan(0.01);
  const minimumTravelMeters = Math.max(4, Math.min(8, start.world.spawnPerimeterDistanceMeters * 0.45));
  const boundaries: readonly BoundaryInputCase[] = [
    { name: "north", axis: "z", direction: -1, key: "w", returnKey: "s" },
    { name: "south", axis: "z", direction: 1, key: "s", returnKey: "w" },
    { name: "west", axis: "x", direction: -1, key: "a", returnKey: "d" },
    { name: "east", axis: "x", direction: 1, key: "d", returnKey: "a" }
  ];
  const boundaryEvidence: unknown[] = [];

  for (const boundary of boundaries) {
    const proof = await reachBoundaryAndProveLiveness(page, boundary, minimumTravelMeters);
    const bounds = start.world.componentBoundsMeters;
    const heldPosition = proof.held.player.positionMeters;
    const heldDrift = horizontalDistance(proof.blocked.player.positionMeters, heldPosition);
    const directionalTravel = boundary.direction * (
      proof.blocked.player.positionMeters[boundary.axis] - proof.start.player.positionMeters[boundary.axis]
    );
    expect(directionalTravel).toBeGreaterThanOrEqual(minimumTravelMeters);
    expect(heldDrift).toBeLessThanOrEqual(0.25);
    expect(proof.held.player.simulationTick - proof.blocked.player.simulationTick).toBeGreaterThanOrEqual(60);
    expect(proof.heldTickElapsedMilliseconds).toBeLessThan(3_000);
    expect(proof.maximumSampleElapsedMilliseconds).toBeLessThan(2_000);
    expect(heldPosition.x).toBeGreaterThanOrEqual(bounds.minInclusive.x - 0.5);
    expect(heldPosition.x).toBeLessThanOrEqual(bounds.maxExclusive.x + 0.5);
    expect(heldPosition.z).toBeGreaterThanOrEqual(bounds.minInclusive.z - 0.5);
    expect(heldPosition.z).toBeLessThanOrEqual(bounds.maxExclusive.z + 0.5);
    expect(proof.held.latestRejection).toBeNull();
    expect(proof.held.testBridge).toEqual({ ownProperty: false, inWindow: false });
    await expect(page.locator("body")).toHaveAttribute("data-surface-play-state", "ready");
    await expectNoSurfaceStatePause(page);
    expect(health).toEqual({ console: [], page: [], request: [], http: [] });
    const screenshot = await captureScreenshot(page, testInfo, `real-input-boundary-${boundary.name}`);

    const returned = await returnFromBoundary(page, boundary, start.world.anchor);
    const resumedDistance = horizontalDistance(
      returned.start.player.positionMeters,
      returned.reachedAnchor.player.positionMeters
    );
    expect(resumedDistance).toBeGreaterThan(1);
    expect(returned.idle.latestRejection).toBeNull();
    boundaryEvidence.push({
      boundary,
      screenshot,
      directionalTravel,
      heldDrift,
      heldTickElapsedMilliseconds: proof.heldTickElapsedMilliseconds,
      maximumSampleElapsedMilliseconds: proof.maximumSampleElapsedMilliseconds,
      blocked: movementEvidenceState(proof.blocked),
      held: movementEvidenceState(proof.held),
      returned: movementEvidenceState(returned.idle),
      resumedDistance
    });
  }

  await expect(page.locator("body")).toHaveAttribute("data-locomotion-state", "idle");
  await expectNoSurfaceStatePause(page);
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });
  await writeJsonEvidence(testInfo, "real-input-bounded-domain-edges", {
    world: {
      anchor: start.world.anchor,
      componentBoundsMeters: start.world.componentBoundsMeters,
      residentInsetBoundsMeters: start.world.residentInsetBoundsMeters,
      spawnPerimeterDistanceMeters: start.world.spawnPerimeterDistanceMeters
    },
    minimumTravelMeters,
    boundaries: boundaryEvidence,
    health
  });
});

test("Surface Play remains isolated from Surface Lab and TestBridge query flags", async ({ page }) => {
  await gotoReady(page, "/?surfacePlay=1&surfaceLab=1&testBridge=1");

  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  await expect(page.locator("#surface-lab-hud")).toHaveCount(0);
});

test("Surface Play spawns on bound dry Hestia ground and remains at rest for 600 real fixed ticks", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const health = collectBrowserHealth(page);
  await gotoReady(page);

  await expect.poll(async () => (await readSmallSnapshot(page)).player.supportState, { timeout: 10_000 })
    .toBe("SupportedResting");
  const start = await readSmallSnapshot(page);
  expect(start.world).not.toBeNull();
  if (start.world === null) throw new Error("Surface Play did not publish World-owned Hestia facts.");

  expect(start.world.identity).toEqual(start.world.environmentIdentity);
  expect(start.world.identity).toMatchObject({
    bodyId: start.authority.regionRevision === 0 ? "planet.hestia" : start.world.identity.bodyId,
    regionId: "region:hestia.surface-play.v1",
    surfaceFrameId: "frame:surface_hestia_surface_play_v1",
    regionRevision: start.authority.regionRevision
  });
  expect(start.world.environmentWaterSurfaceHeightMeters).toBe(start.world.waterSurfaceHeightMeters);
  expect(start.world.traversalCellCount).toBe(start.world.dryCellCount);
  expect(start.world.traversalCellCount).toBeGreaterThan(4_000);
  expect(start.world.spawnPerimeterDistanceMeters).toBeGreaterThanOrEqual(12);
  expect(start.world.structuralTreeRoots).toHaveLength(1);
  expect(start.world.decorativePopulationCount).toBeGreaterThan(0);
  // The admitted real-route footprint is wholly dry; water facts may exist for
  // other deterministic selections, but no water geometry belongs inside this
  // selected traversal domain.
  expect(start.world.waterPatchCount).toBe(0);
  expect(start.player.positionMeters.x).toBe(start.world.anchor.x);
  expect(start.player.positionMeters.z).toBe(start.world.anchor.z);
  const materializedGroundY = start.player.positionMeters.y - start.player.capsule.heightMeters / 2;
  const anchorGroundDeltaMeters = Math.abs(materializedGroundY - start.world.anchor.y);
  expect(anchorGroundDeltaMeters).toBeLessThanOrEqual(0.001);
  expect(start.player.positionMeters.y - start.player.capsule.heightMeters / 2 - start.world.waterSurfaceHeightMeters)
    .toBeGreaterThanOrEqual(1);
  expect(start.view.eyePositionMeters.y).toBeGreaterThan(start.world.waterSurfaceHeightMeters);
  expect(start.view.eyePositionMeters.y).toBeGreaterThan(start.world.verticalBand.minimumMeters);
  expect(start.view.eyePositionMeters.y).toBeLessThan(start.world.verticalBand.maximumExclusiveMeters);
  expect(start.player.grounded).toBe(true);
  expect(start.player.velocityMetersPerSecond).toEqual({ x: 0, y: 0, z: 0 });
  expect(start.testBridge).toEqual({ ownProperty: false, inWindow: false });

  await expect.poll(
    async () => (await readSmallSnapshot(page)).player.simulationTick,
    { timeout: 20_000, intervals: [100, 250, 500] }
  ).toBeGreaterThanOrEqual(start.player.simulationTick + 600);
  const end = await readSmallSnapshot(page);
  const drift = {
    x: end.player.positionMeters.x - start.player.positionMeters.x,
    y: end.player.positionMeters.y - start.player.positionMeters.y,
    z: end.player.positionMeters.z - start.player.positionMeters.z
  };
  const speed = Math.hypot(
    end.player.velocityMetersPerSecond.x,
    end.player.velocityMetersPerSecond.y,
    end.player.velocityMetersPerSecond.z
  );
  expect(end.player.simulationTick - start.player.simulationTick).toBeGreaterThanOrEqual(600);
  expect(Math.hypot(drift.x, drift.y, drift.z)).toBeLessThanOrEqual(1e-6);
  expect(speed).toBeLessThanOrEqual(1e-6);
  expect(end.player.grounded).toBe(true);
  expect(end.player.supportState).toBe("SupportedResting");
  expect(end.latestRejection).toBeNull();
  expect(health).toEqual({ console: [], page: [], request: [], http: [] });

  await writeJsonEvidence(testInfo, "dry-spawn-idle-600-ticks", {
    start,
    end,
    materializedGroundY,
    anchorGroundDeltaMeters,
    drift,
    speed,
    health
  });
  await captureScreenshot(page, testInfo, "dry-spawn-idle-600-ticks");
});

test("invalid and duplicate Surface Play queries fall through while Surface Lab remains available", async ({ page }) => {
  for (const route of ["/?surfacePlay=0", "/?surfacePlay=1&surfacePlay=1"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const body = page.locator("body");
    await expect(body).not.toHaveAttribute("data-ui-surface", "surface-play");
    await expect(body).not.toHaveAttribute("data-surface-play-state", "ready");
    await expect(page.locator("#surface-play-hud")).toHaveCount(0);
    await expect(page.locator("#debug-scene")).toBeVisible();
  }

  await page.goto("/?surfaceLab=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab", "1");
  await expect(page.locator("#surface-lab-hud")).toBeVisible();
  await expect(page.getByRole("region", { name: "Surface Lab controls", exact: true })).toBeVisible();
  await expect(page.locator("#surface-play-hud")).toHaveCount(0);
});
