import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

interface PngSampleResult {
  readonly width: number;
  readonly height: number;
  readonly totalSampleCount: number;
  readonly nonDarkSampleCount: number;
  readonly uniqueSampledColors: number;
}

const paethPredictor = (left: number, up: number, upLeft: number): number => {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) {
    return left;
  }
  if (pb <= pc) {
    return up;
  }
  return upLeft;
};

const samplePng = (png: Buffer): PngSampleResult => {
  const signature = "89504e470d0a1a0a";
  if (png.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("Canvas screenshot is not a PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const channelsByColorType: Record<number, number> = {
    0: 1,
    2: 3,
    4: 2,
    6: 4
  };
  const channels = channelsByColorType[colorType];
  if (!width || !height || bitDepth !== 8 || !channels) {
    throw new Error(`Unsupported PNG format: width=${width} height=${height} bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const rows: Buffer[] = [];
  let source = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source];
    const raw = inflated.subarray(source + 1, source + 1 + stride);
    const row = Buffer.alloc(stride);
    const prev = rows[y - 1];
    source += stride + 1;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = prev ? prev[x] : 0;
      const upLeft = prev && x >= channels ? prev[x - channels] : 0;
      const value =
        filter === 0
          ? raw[x]
          : filter === 1
            ? raw[x] + left
            : filter === 2
              ? raw[x] + up
              : filter === 3
                ? raw[x] + Math.floor((left + up) / 2)
                : filter === 4
                  ? raw[x] + paethPredictor(left, up, upLeft)
                  : raw[x];
      row[x] = value & 0xff;
    }

    rows.push(row);
  }

  let totalSampleCount = 0;
  let nonDarkSampleCount = 0;
  const uniqueColors = new Set<string>();
  const stepX = Math.max(1, Math.floor(width / 80));
  const stepY = Math.max(1, Math.floor(height / 80));

  for (let y = 0; y < height; y += stepY) {
    const row = rows[y];
    for (let x = 0; x < width; x += stepX) {
      const base = x * channels;
      const r = row[base];
      const g = channels === 1 ? r : row[base + 1];
      const b = channels === 1 ? r : row[base + 2];
      const maxColor = Math.max(r, g, b);
      const minColor = Math.min(r, g, b);
      totalSampleCount += 1;
      uniqueColors.add(`${r},${g},${b}`);
      if (r + g + b > 40 || maxColor - minColor > 12) {
        nonDarkSampleCount += 1;
      }
    }
  }

  return { width, height, totalSampleCount, nonDarkSampleCount, uniqueSampledColors: uniqueColors.size };
};

async function assertCanvasHasNonDarkPixels(page: Page, selector = "#debug-scene") {
  const canvas = page.locator(selector);
  await expect(canvas).toBeVisible();
  const result = samplePng(await canvas.screenshot());
  expect(result.totalSampleCount, "No samples were collected from debug canvas").toBeGreaterThan(0);
  const minNonDarkPixels = Math.max(8, Math.ceil(result.totalSampleCount * 0.001));
  expect(result.nonDarkSampleCount, `Canvas is too dark/bland: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(
    minNonDarkPixels
  );
  expect(result.uniqueSampledColors, `Canvas lacks color variation: ${JSON.stringify(result)}`).toBeGreaterThan(4);
}

async function waitForShipVisualReady(page: Page) {
  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge?.getRenderSnapshot?.();
    return snapshot?.shipVisual?.visualSource?.state && snapshot.shipVisual.visualSource.state !== "Loading";
  });
  return page.evaluate(() => (window as any).TestBridge.getRenderSnapshot().shipVisual);
}

function findShipVisualBinding(shipVisual: any, id: string) {
  const binding = shipVisual.markerBindings.find((candidate: any) => candidate.id === id);
  expect(binding, `Missing ship visual marker binding ${id}`).toBeTruthy();
  return binding;
}

test("browser vertical slice selects a target, previews a route, engages autopilot, and writes evidence", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  const initialShipVisual = await waitForShipVisualReady(page);
  expect(initialShipVisual.visualSource.state).toBe("GLBLoaded");
  expect(initialShipVisual.visualSource.browserAssetPath).toBe("/ships/demo_scout_mk1.glb");
  expect(initialShipVisual.descriptorValidation.ok).toBe(true);
  expect(initialShipVisual.markerBindings.some((binding: any) => binding.source === "GLBNode")).toBe(true);
  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB");

  const initialTelemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(initialTelemetry.executor.planHash).toBeNull();
  expect(initialTelemetry.lockedPlan).toBeNull();
  expect(initialTelemetry.selectedTarget?.id).toBe("nav-alpha");
  expect(initialTelemetry.routePreview?.state).toBe("Ready");
  expect(initialTelemetry.routePreview?.plan?.target.id).toBe("nav-alpha");
  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expect(page.getByTestId("selected-target")).toContainText("Navigation Alpha");
  await expect(page.locator("#route-status")).toContainText("preview ready");
  await expect(page.getByTestId("radar-status")).toContainText("local contact Navigation Alpha");

  await page.locator('[data-target-id="nav-beta"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().selectedTarget?.id)).toBe("nav-beta");
  const betaPreview = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(betaPreview.executor.planHash).toBeNull();
  expect(betaPreview.routePreview?.state).toBe("Ready");
  expect(betaPreview.routePreview?.plan?.target.id).toBe("nav-beta");
  expect(betaPreview.routePreview?.plan?.segments.at(-1).end).toEqual(betaPreview.selectedTarget.position);
  await expect(page.getByTestId("selected-target")).toContainText("Navigation Beta");
  await expect(page.getByTestId("runtime-message")).toContainText("Selected Navigation Beta");

  await page.waitForFunction(() => (window as any).TestBridge.getRenderSnapshot?.().selectedTargetId === "nav-beta");
  const betaRenderSnapshot = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(betaRenderSnapshot.targetVisible).toBe(true);
  expect(betaRenderSnapshot.selectedTargetId).toBe("nav-beta");
  expect(betaRenderSnapshot.targetPosition).toEqual(betaPreview.selectedTarget.position);
  expect(betaRenderSnapshot.routePreviewTargetPosition).toEqual(betaPreview.selectedTarget.position);
  expect(betaRenderSnapshot.routePreviewPlanHash).toBe(betaPreview.routePreview.plan.planHash);

  await page.locator("#engage-autopilot").click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().executor.status)).toBe("Executing");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().lockedPlan?.target.id)).toBe("nav-beta");
  const telemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(telemetry.executor.planHash).toMatch(/^[a-f0-9]{8}$/);
  expect(telemetry.routePreview?.plan?.planHash).toBe(telemetry.executor.planHash);
  expect(telemetry.lockedPlan?.segments.length).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("autopilot-active")).toContainText("Autopilot executing");
  await expect(page.locator("#mode")).toHaveText(telemetry.flightSnapshot.authority.mode);
  await expect(page.locator("#fuel-status")).toContainText("Ready");
  await expect(page.locator("#authority-status")).toContainText("AP ready");
  await expect(page.locator("#brake-status")).toContainText("ready");

  const burnTelemetry = await page.evaluate(() => {
    let current = (window as any).TestBridge.getTelemetry();
    for (let i = 0; i < 90 && !current.ship.actuatorTelemetry.mainThrustActive; i += 1) {
      current = (window as any).TestBridge.step(1);
    }
    return current;
  });
  expect(burnTelemetry.executor.status).toBe("Executing");
  expect(burnTelemetry.executor.planHash).toBe(telemetry.executor.planHash);
  expect(burnTelemetry.ship.position.x).toBeGreaterThan(telemetry.ship.position.x);
  expect(burnTelemetry.ship.actuatorTelemetry.mainThrustActive).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getRenderSnapshot().shipVisual.vfx.mainThrustVisible)).toBe(true);
  const evidenceDir = path.resolve(process.cwd(), "evidence");
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, "demo-scout-glb-loaded.png"), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, "demo-scout-main-thruster.png"), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-thruster-burn.png"), fullPage: true });

  await page.locator('[data-target-id="nav-alpha"]').click();
  const retargetedWhileLocked = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(retargetedWhileLocked.executor.planHash).toBe(telemetry.executor.planHash);
  expect(retargetedWhileLocked.lockedPlan?.target.id).toBe("nav-beta");
  expect(retargetedWhileLocked.selectedTarget?.id).toBe("nav-beta");
  expect(retargetedWhileLocked.routePreview?.target?.id).toBe("nav-beta");
  await expect(page.getByTestId("selected-target")).toContainText("Navigation Beta");
  await expect(page.getByTestId("runtime-message")).toContainText("Cancel the current autopilot route before selecting another target");
  const lockedRenderSnapshot = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(lockedRenderSnapshot.selectedTargetId).toBe("nav-beta");
  expect(lockedRenderSnapshot.targetPosition).toEqual(telemetry.lockedPlan.target.position);

  const arrivalTelemetry = await page.evaluate(() => {
    let current = (window as any).TestBridge.getTelemetry();
    for (let i = 0; i < 1_200 && current.executor.status !== "Arrived"; i += 1) {
      current = (window as any).TestBridge.step(1);
    }
    return current;
  });
  expect(arrivalTelemetry.executor.status).toBe("Arrived");
  expect(arrivalTelemetry.executor.distanceToTarget).toBeLessThanOrEqual(arrivalTelemetry.selectedTarget.arrivalEnvelope.radius);
  expect(arrivalTelemetry.ship.position).not.toEqual(arrivalTelemetry.selectedTarget.position);
  const arrivalTerminalSpeed = arrivalTelemetry.selectedTarget.arrivalEnvelope.terminalSpeed ?? Number.POSITIVE_INFINITY;
  expect(arrivalTelemetry.ship.velocity.x ** 2 + arrivalTelemetry.ship.velocity.y ** 2 + arrivalTelemetry.ship.velocity.z ** 2).toBeLessThanOrEqual(
    arrivalTerminalSpeed ** 2 + 0.000001
  );
  expect(arrivalTelemetry.executor.planHash).toBeNull();
  expect(arrivalTelemetry.executor.completedPlanHash).toBe(telemetry.executor.planHash);
  expect(arrivalTelemetry.executor.canAcceptNewPlan).toBe(true);
  expect(arrivalTelemetry.executor.canSelectNewTarget).toBe(true);
  expect(arrivalTelemetry.lockedPlan).toBeNull();
  await expect(page.getByTestId("autopilot-active")).toContainText("Arrived at selected target");
  await page.waitForFunction(() => (window as any).TestBridge.getRenderSnapshot?.().executorStatus === "Arrived");
  const renderSnapshot = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(renderSnapshot.shipVisual.visualSource.state).toBe("GLBLoaded");
  expect(renderSnapshot.camera.anchorId).toBe("chase-camera-anchor");
  expect(renderSnapshot.camera.anchorLocalPosition).toEqual(renderSnapshot.shipVisual.cameraAnchorBinding.localPosition);
  expect(renderSnapshot.usesInterpolatedPose).toBe(true);
  expect(renderSnapshot.targetVisible).toBe(true);
  expect(renderSnapshot.targetPosition).toEqual(arrivalTelemetry.selectedTarget.position);
  expect(renderSnapshot.lockedTargetPosition).toBeNull();
  expect(renderSnapshot.selectedTargetId).toBe("nav-beta");
  expect(renderSnapshot.distanceToTarget).toBeLessThanOrEqual(renderSnapshot.arrivalRadius);
  expect(renderSnapshot.shipPosition).not.toEqual(arrivalTelemetry.selectedTarget.position);
  expect(renderSnapshot.planHash).toBeNull();
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-arrival.png"), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, "demo-scout-autopilot-arrival.png"), fullPage: true });
  expect(renderSnapshot.lowPolyInstanceBatch).toEqual(
    expect.objectContaining({
      id: "debug-low-poly-asteroids",
      batchKey: "low-poly-asteroid",
      sourceId: "proving-ground-world",
      frameId: "debug-local-render-frame",
      count: 6,
      maxInstances: 64,
      renderOnly: true,
      rendererOwnsWorldTruth: false
    })
  );

  await page.locator('[data-target-id="nav-alpha"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().selectedTarget?.id)).toBe("nav-alpha");
  await page.locator("#engage-autopilot").click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().lockedPlan?.target.id)).toBe("nav-alpha");
  const newRouteTelemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(newRouteTelemetry.executor.planHash).toMatch(/^[a-f0-9]{8}$/);
  expect(newRouteTelemetry.executor.planHash).not.toBe(telemetry.executor.planHash);
  expect(newRouteTelemetry.executor.completedPlanHash).toBe(telemetry.executor.planHash);
  expect(newRouteTelemetry.executor.canAcceptNewPlan).toBe(false);
  expect(newRouteTelemetry.executor.canSelectNewTarget).toBe(false);
  const scenarioIds = await page.evaluate(() => (window as any).TestBridge.listScenarios());
  expect(scenarioIds).toEqual([
    "direct-local-arrival",
    "obstacle-avoidance-route",
    "insufficient-fuel",
    "no-authority",
    "no-main-thrusters",
    "brake-reserve-insufficient",
    "off-route-divergence",
    "locked-plan-hash-preservation",
    "explicit-replan-required-signal"
  ]);
  const matrixResults = await page.evaluate((ids: string[]) => ids.map((id) => (window as any).TestBridge.runScenario(id)), scenarioIds);
  expect(matrixResults.every((result: any) => result.classification === "PASS")).toBe(true);
  expect(matrixResults.every((result: any) => result.planHashAfter === result.planHashBefore)).toBe(true);
  expect(
    matrixResults.every(
      (result: any) =>
        typeof result.finalSpeed === "number" &&
        typeof result.arrivalPhase === "string" &&
        (typeof result.terminalSpeedLimit === "number" || result.terminalSpeedLimit === null) &&
        (typeof result.terminalSpeedError === "number" || result.terminalSpeedError === null) &&
        typeof result.terminalRadialSpeed === "number" &&
        typeof result.terminalTangentialSpeed === "number" &&
        typeof result.desiredTerminalVelocity?.x === "number" &&
        typeof result.desiredTerminalVelocity?.y === "number" &&
        typeof result.desiredTerminalVelocity?.z === "number" &&
        typeof result.terminalCaptureActive === "boolean" &&
        typeof result.terminalHoldingActive === "boolean" &&
        typeof result.fuelUsed === "number" &&
        typeof result.initialMass === "number" &&
        typeof result.finalMass === "number" &&
        typeof result.finalPosition?.x === "number" &&
        typeof result.finalPosition?.y === "number" &&
        typeof result.finalPosition?.z === "number" &&
        typeof result.targetPosition?.x === "number" &&
        typeof result.targetPosition?.y === "number" &&
        typeof result.targetPosition?.z === "number" &&
        ["Waypoint", "Point"].includes(result.targetKind) &&
        typeof result.arrivalEnvelope?.radius === "number" &&
        result.routeValidation?.ok === true &&
        Array.isArray(result.routeValidation?.issues) &&
        typeof result.routeScore?.distance === "number" &&
        typeof result.routeScore?.segmentCount === "number" &&
        typeof result.routeScore?.total === "number" &&
        Array.isArray(result.routeScore?.reasons) &&
        Array.isArray(result.failureReasonCodes) &&
        typeof result.routeValid === "boolean" &&
        typeof result.initialFuel === "number" &&
        typeof result.finalFuel === "number" &&
        ["Manual", "Assisted", "Autopilot"].includes(result.authority?.mode) &&
        typeof result.authority?.mainThrustersAvailable === "boolean" &&
        typeof result.authority?.rcsAvailable === "boolean" &&
        typeof result.authority?.autopilotAvailable === "boolean" &&
        typeof result.brakingReserve?.requiredDeltaV === "number" &&
        typeof result.brakingReserve?.availableDeltaV === "number" &&
        Array.isArray(result.brakingReserve?.reasonCodes) &&
        typeof result.brakingReserve?.canBrake === "boolean"
    )
  ).toBe(true);
  const directLocalArrival = matrixResults.find((result: any) => result.id === "direct-local-arrival");
  expect(directLocalArrival.finalPosition).not.toEqual(directLocalArrival.targetPosition);
  expect(directLocalArrival.distanceToTarget).toBeLessThanOrEqual(directLocalArrival.arrivalEnvelope.radius);
  const insufficientFuel = matrixResults.find((result: any) => result.id === "insufficient-fuel");
  expect(insufficientFuel).toEqual(
    expect.objectContaining({
      status: "OutOfFuel",
      initialFuel: 0,
      finalFuel: 0,
      fuelUsed: 0,
      finalSpeed: 0,
      brakingReserve: expect.objectContaining({ canBrake: false })
    })
  );
  expect(insufficientFuel.failureReasonCodes).toEqual(expect.arrayContaining(["FuelInsufficient", "FuelDepleted"]));
  const brakeReserveInsufficient = matrixResults.find((result: any) => result.id === "brake-reserve-insufficient");
  expect(brakeReserveInsufficient.failureReasonCodes).toEqual(expect.arrayContaining(["FuelInsufficient", "BrakeReserveInsufficient"]));
  expect(brakeReserveInsufficient.brakingReserve.reasonCodes).toEqual(expect.arrayContaining(["FuelInsufficient", "BrakeReserveInsufficient"]));
  const offRouteDivergence = matrixResults.find((result: any) => result.id === "off-route-divergence");
  expect(offRouteDivergence).toEqual(
    expect.objectContaining({
      status: "Diverged",
      replanRequired: true,
      routeValid: false,
      fuelUsed: 0,
      finalSpeed: 0
    })
  );
  expect(offRouteDivergence.failureReasonCodes).toContain("OffLockedRoute");
  await assertCanvasHasNonDarkPixels(page);

  await page.screenshot({ path: path.join(evidenceDir, "debug-scene.png"), fullPage: true });
  await writeFile(path.join(evidenceDir, "telemetry.json"), JSON.stringify(newRouteTelemetry, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "vertical-slice-telemetry.json"), JSON.stringify({ initialTelemetry, betaPreview, arrivalTelemetry, newRouteTelemetry }, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "scenario-matrix.json"), JSON.stringify(matrixResults, null, 2), "utf8");
});

test("playable manual flight exposes ship visual, ChaseLocked camera, controls, and telemetry VFX", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  const readyVisual = await waitForShipVisualReady(page);
  expect(readyVisual.visualSource.state).toBe("GLBLoaded");

  const initialRender = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(initialRender.shipVisual.oldConeOnlyPlaceholder).toBe(false);
  expect(initialRender.shipVisual.descriptor.strategy).toBe("BrowserGlbAsset");
  expect(initialRender.shipVisual.visualSource.state).toBe("GLBLoaded");
  expect(initialRender.shipVisual.visualSource.candidateAssetPath).toBe("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb");
  expect(initialRender.shipVisual.visualSource.browserAssetPath).toBe("/ships/demo_scout_mk1.glb");
  expect(initialRender.shipVisual.visualSource.axisCorrection.mapping).toBe("browserX=-glbZ,browserY=glbY,browserZ=glbX");
  expect(initialRender.shipVisual.descriptorValidation.ok).toBe(true);
  expect(initialRender.shipVisual.markerCounts.hullParts).toBeGreaterThanOrEqual(4);
  expect(initialRender.shipVisual.markerCounts.rcs).toBeGreaterThanOrEqual(4);
  expect(initialRender.shipVisual.markerCounts.mainEngines).toBeGreaterThanOrEqual(1);
  expect(initialRender.shipVisual.markerCounts.muzzle).toBe(1);
  const cockpitBinding = findShipVisualBinding(initialRender.shipVisual, "cockpit-front");
  const mainEngineBinding = findShipVisualBinding(initialRender.shipVisual, "main-engine-aft");
  const muzzleBinding = findShipVisualBinding(initialRender.shipVisual, "muzzle-placeholder");
  expect(cockpitBinding.source).toBe("GLBNode");
  expect(cockpitBinding.localPosition.x).toBeGreaterThan(0);
  expect(mainEngineBinding.source).toBe("GLBNode");
  expect(mainEngineBinding.localPosition.x).toBeLessThan(0);
  expect(muzzleBinding.source).toBe("GLBNode");
  expect(muzzleBinding.localPosition.x).toBeGreaterThan(0);
  expect(initialRender.camera.mode).toBe("ChaseLocked");
  expect(initialRender.camera.followsShip).toBe(true);
  expect(initialRender.camera.anchorId).toBe("chase-camera-anchor");
  expect(initialRender.shipVisual.cameraAnchorBinding.source).toBe("ManifestFallback");
  expect(initialRender.camera.anchorSource).toBe("ManifestFallback");
  expect(initialRender.camera.anchorLocalPosition).toEqual(initialRender.shipVisual.cameraAnchorBinding.localPosition);
  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB");

  await page.keyboard.down("Shift");
  await page.waitForTimeout(700);
  await page.keyboard.up("Shift");
  await page.keyboard.down("w");
  await page.waitForTimeout(350);
  await page.keyboard.up("w");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().ship.position.x)).toBeGreaterThan(0.05);
  const manualTelemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(manualTelemetry.ship.actuatorTelemetry.mainThrustActive).toBe(true);
  expect(manualTelemetry.ship.actuatorTelemetry.rcsRotationActive || manualTelemetry.ship.actuatorTelemetry.sasCorrectionActive).toBe(true);
  const manualRender = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(manualRender.shipVisual.vfx.mainThrustVisible).toBe(true);
  expect(manualRender.shipVisual.vfx.mainEngineBinding.id).toBe("main-engine-aft");
  expect(manualRender.shipVisual.vfx.mainEngineBinding.source).toBe("GLBNode");
  expect(manualRender.camera.mode).toBe("ChaseLocked");
  expect(manualRender.camera.followTarget.x).toBeGreaterThan(initialRender.camera.followTarget.x);
  expect(manualRender.camera.distanceToShip).toBeGreaterThan(0);
  await expect(page.getByTestId("control-mode")).toContainText("Cruise");
  await expect(page.getByTestId("throttle-status")).toContainText("main burn");
  await expect(page.getByTestId("control-mode-effect")).toContainText("main thrust enabled");
  await expect(page.getByTestId("control-mode-effect")).toContainText("main thrust active");
  await expect(page.getByTestId("velocity-status")).toContainText("m/s");
  await expect(page.getByTestId("velocity-status")).not.toContainText(/\(-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?\)/);
  await expect(page.getByTestId("rcs-sas-status")).toContainText("RCS");
  await expect(page.getByTestId("camera-mode")).toContainText("ChaseLocked");
  await expect(page.getByTestId("help-hint")).toContainText("Desktop keyboard/mouse manual flight");
  await expect(page.getByTestId("help-hint")).toContainText("CapsLock mode");
  await expect(page.getByTestId("help-hint")).toContainText("Mobile: target selection and autopilot only");

  const evidenceDir = path.resolve(process.cwd(), "evidence");
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, "manual-flight-chasecam.png"), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, "demo-scout-chasecam.png"), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, "control-mode-cruise-main-thrust.png"), fullPage: true });

  await page.keyboard.press("CapsLock");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().manualInput.controlMode)).toBe("Precision");
  await page.keyboard.down("w");
  await page.waitForTimeout(450);
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().ship.actuatorTelemetry.rcsRotationActive)).toBe(true);
  const precisionTelemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  const precisionRender = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  await page.keyboard.up("w");
  expect(precisionTelemetry.ship.actuatorTelemetry.mainThrustActive).toBe(false);
  expect(precisionTelemetry.ship.actuatorTelemetry.controlModeEffect.mainThrustAllowed).toBe(false);
  expect(precisionTelemetry.ship.actuatorTelemetry.controlModeEffect.modeEffectLabel).toBe("RCS attitude / main thrust blocked");
  expect(precisionTelemetry.ship.actuatorTelemetry.controlModeEffect.rcsRotationAllowed).toBe(true);
  expect(precisionRender.shipVisual.vfx.mainThrustVisible).toBe(false);
  await expect(page.getByTestId("control-mode")).toContainText("Precision");
  await expect(page.getByTestId("control-mode-effect")).toContainText("RCS attitude / main thrust blocked");
  await expect(page.getByTestId("control-mode-effect")).toContainText("main thrust mode-blocked");
  await expect(page.getByTestId("rcs-sas-status")).toContainText(/RCS rotate|SAS correction/);
  await page.screenshot({ path: path.join(evidenceDir, "control-mode-precision-rcs-rotation.png"), fullPage: true });

  await page.keyboard.press("CapsLock");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().manualInput.controlMode)).toBe("Translation");
  await page.keyboard.down("h");
  await page.waitForTimeout(450);
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().ship.actuatorTelemetry.rcsTranslationActive)).toBe(true);
  const rcsRender = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  const translationTelemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(translationTelemetry.ship.actuatorTelemetry.mainThrustActive).toBe(false);
  expect(translationTelemetry.ship.actuatorTelemetry.controlModeEffect.modeEffectLabel).toBe("RCS translation / main thrust blocked");
  expect(rcsRender.shipVisual.vfx.rcsTranslationVisible).toBe(true);
  expect(rcsRender.shipVisual.vfx.visibleRcsPuffCount).toBeGreaterThanOrEqual(4);
  expect(rcsRender.shipVisual.vfx.rcsBindings.every((binding: any) => binding.source === "GLBNode")).toBe(true);
  await expect(page.getByTestId("control-mode-effect")).toContainText("RCS translation / main thrust blocked");
  await expect(page.getByTestId("control-mode-effect")).toContainText("RCS translation active");
  await page.screenshot({ path: path.join(evidenceDir, "rcs-translation.png"), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, "demo-scout-rcs-puffs.png"), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, "control-mode-translation-rcs-translation.png"), fullPage: true });
  await page.keyboard.down("q");
  await page.waitForTimeout(250);
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().ship.actuatorTelemetry.rcsRotationActive)).toBe(true);
  await page.keyboard.up("q");
  await page.keyboard.up("h");

  await page.keyboard.press("CapsLock");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().manualInput.controlMode)).toBe("Cruise");

  await page.keyboard.press("v");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().manualInput.cameraMode)).toBe("OrbitInspect");
  await page.mouse.click(420, 320, { button: "right" });
  await page.mouse.down({ button: "right" });
  await page.mouse.move(520, 360);
  await page.mouse.up({ button: "right" });
  await page.mouse.wheel(0, -240);
  const orbitRender = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(orbitRender.camera.mode).toBe("OrbitInspect");

  await page.keyboard.press("v");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().manualInput.cameraMode)).toBe("Side");
  await page.keyboard.press("v");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().manualInput.cameraMode)).toBe("FreeInspect");
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test("debug scene renders on mobile and writes mobile screenshot", async ({ page }) => {
    await page.goto("/?testBridge=1");
    await page.waitForFunction(() => Boolean((window as any).TestBridge));
    await page.waitForSelector("#debug-scene", { state: "visible" });
    await page.waitForTimeout(250);

    const telemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
    expect(telemetry.executor.planHash).toBeNull();
    expect(telemetry.routePreview?.plan?.planHash).toMatch(/^[a-f0-9]{8}$/);
    expect(telemetry.routePreview?.plan?.segments.length).toBeGreaterThanOrEqual(1);
    expect(telemetry.executor.status).toBe("Idle");
    await expect(page.locator("#mode")).toHaveText(telemetry.flightSnapshot.authority.mode);
    await expect(page.getByTestId("radar-status")).toContainText("local contact");
    await expect(page.getByTestId("help-hint")).toContainText("Mobile: target selection and autopilot only");
    await assertCanvasHasNonDarkPixels(page);

    const evidenceDir = path.resolve(process.cwd(), "evidence");
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDir, "debug-scene-mobile.png"), fullPage: true });
  });
});

test("product bootstrap does not expose the E2E TestBridge by default", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("#debug-scene")).toHaveAttribute("aria-label", "Flight viewport");
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
  await expect(page.locator("body")).not.toContainText("TestBridge");
  await expect(page.locator("#telemetry")).toHaveCount(0);
  await expect(page.locator("#mode")).toBeVisible();
  await expect(page.getByTestId("velocity-status")).not.toContainText(/\(-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?\)/);
  await expect(page.getByTestId("help-hint")).toContainText("Desktop keyboard/mouse manual flight");
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
});

test("malformed browser GLB load fails into a visible procedural fallback", async ({ page }) => {
  await page.route("**/ships/demo_scout_mk1.glb", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "model/gltf-binary",
      body: Buffer.from("not-a-valid-glb")
    });
  });

  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  const shipVisual = await waitForShipVisualReady(page);

  expect(shipVisual.visualSource.state).toBe("GLBFailedFallback");
  expect(shipVisual.visualSource.browserAssetPath).toBe("/ships/demo_scout_mk1.glb");
  expect(shipVisual.visualSource.fallbackReason).toEqual(expect.any(String));
  expect(shipVisual.visualSource.fallbackReason.length).toBeGreaterThan(0);
  expect(shipVisual.descriptor.strategy).toBe("ProceduralLowPolyFallback");
  expect(shipVisual.descriptorValidation.ok).toBe(true);
  expect(shipVisual.markerCounts).toEqual({ hullParts: 4, mainEngines: 1, rcs: 6, muzzle: 1, cameraAnchors: 1 });
  expect(shipVisual.markerBindings.every((binding: any) => binding.source === "ManifestFallback")).toBe(true);
  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Procedural fallback");
  await assertCanvasHasNonDarkPixels(page);
});

test("real HUD buttons dispatch autopilot commands without exposing DirectLocal controls", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await expect(page.locator("#engage-direct-autopilot")).toHaveCount(0);

  await page.locator("#cancel-autopilot").click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().executor.status)).toBe("Idle");
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().executor.planHash)).toBeNull();
  await expect(page.locator("#status")).toContainText("Autopilot standby");
  await expect(page.locator("#target-status")).toContainText("Navigation Alpha");

  await page.locator('[data-target-id="nav-beta"]').click();
  await page.locator("#engage-autopilot").click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().lockedPlan?.planner)).toBe("ObstacleAvoidanceLocal");
  await expect(page.locator("#status")).toContainText("Autopilot executing");
  await expect(page.locator("#target-status")).toContainText("Navigation Beta");
});

test("TestBridge is exposed only when the testBridge query gate is enabled", async ({ page }) => {
  await page.goto("/?flightCase=insufficient-fuel");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);

  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await expect.poll(() => page.evaluate(() => typeof (window as any).TestBridge?.runScenario)).toBe("function");
  await expect.poll(() => page.evaluate(() => typeof (window as any).TestBridge?.useDirectPlan)).toBe("undefined");
  await expect.poll(() => page.evaluate(() => typeof (window as any).TestBridge?.useObstacleAvoidancePlan)).toBe("undefined");
});

test("insufficient fuel warning is visible in the browser HUD", async ({ page }) => {
  await page.goto("/?testBridge=1&flightCase=insufficient-fuel");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await page.locator("#engage-autopilot").click();
  await page.evaluate(() => (window as any).TestBridge.step(1));

  await expect(page.locator("#status")).toContainText("Autopilot blocked: fuel");
  await expect(page.locator("#fuel-status")).toContainText("Blocked");
  await expect(page.locator("#failure-reasons")).toContainText("Fuel insufficient");
  await expect(page.locator("#failure-reasons")).not.toContainText("FuelInsufficient");
  await expect(page.getByTestId("warning-state")).toContainText("Fuel insufficient");
});

test("no authority warning is visible in the browser HUD", async ({ page }) => {
  await page.goto("/?testBridge=1&flightCase=no-authority");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await page.locator("#engage-autopilot").click();
  await page.evaluate(() => (window as any).TestBridge.step(1));

  await expect(page.locator("#status")).toContainText("Autopilot blocked: authority");
  await expect(page.locator("#authority-status")).toContainText("AP blocked");
  await expect(page.locator("#failure-reasons")).toContainText("Autopilot unavailable");
  await expect(page.locator("#failure-reasons")).not.toContainText("AutopilotUnavailable");
});
