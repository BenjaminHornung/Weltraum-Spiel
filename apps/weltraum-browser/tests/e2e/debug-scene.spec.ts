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

test("browser vertical slice selects a target, previews a route, engages autopilot, and writes evidence", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await page.waitForTimeout(250);

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
  expect(arrivalTelemetry.executor.distanceToTarget).toBeLessThanOrEqual(arrivalTelemetry.lockedPlan.target.arrivalEnvelope.radius);
  expect(arrivalTelemetry.ship.position).toEqual(arrivalTelemetry.lockedPlan.target.position);
  expect(arrivalTelemetry.executor.planHash).toBe(telemetry.executor.planHash);
  await expect(page.getByTestId("autopilot-active")).toContainText("Arrived at selected target");
  await page.waitForFunction(() => (window as any).TestBridge.getRenderSnapshot?.().executorStatus === "Arrived");
  const renderSnapshot = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(renderSnapshot.targetVisible).toBe(true);
  expect(renderSnapshot.shipPosition).toEqual(arrivalTelemetry.lockedPlan.target.position);
  expect(renderSnapshot.targetPosition).toEqual(arrivalTelemetry.lockedPlan.target.position);
  expect(renderSnapshot.lockedTargetPosition).toEqual(arrivalTelemetry.lockedPlan.target.position);
  expect(renderSnapshot.selectedTargetId).toBe("nav-beta");
  expect(renderSnapshot.distanceToTarget).toBeLessThanOrEqual(renderSnapshot.arrivalRadius);
  expect(renderSnapshot.planHash).toBe(arrivalTelemetry.executor.planHash);
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

  const originalHash = arrivalTelemetry.executor.planHash;
  const divergent = await page.evaluate(() => (window as any).TestBridge.disturbShip(0));
  expect(divergent.executor.replanRequired).toBe(true);
  expect(divergent.executor.planHash).toBe(originalHash);
  expect(divergent.flightSnapshot.routeValid).toBe(false);
  expect(divergent.flightSnapshot.failureReasonCodes).toContain("OffLockedRoute");
  await expect(page.locator("#route-status")).toContainText("invalid");
  await expect(page.locator("#failure-reasons")).toContainText("Plan invalidated");
  await expect(page.locator("#failure-reasons")).not.toContainText("OffLockedRoute");
  await expect(page.getByTestId("warning-state")).toContainText("Plan invalidated");
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
  expect(directLocalArrival.finalPosition).toEqual(directLocalArrival.targetPosition);
  expect(directLocalArrival.distanceToTarget).toBe(0);
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

  const evidenceDir = path.resolve(process.cwd(), "evidence");
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, "debug-scene.png"), fullPage: true });
  await writeFile(path.join(evidenceDir, "telemetry.json"), JSON.stringify(divergent, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "vertical-slice-telemetry.json"), JSON.stringify({ initialTelemetry, betaPreview, arrivalTelemetry, divergent }, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "scenario-matrix.json"), JSON.stringify(matrixResults, null, 2), "utf8");
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
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
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
