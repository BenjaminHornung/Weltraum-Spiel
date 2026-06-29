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

test("debug scene exposes telemetry and writes evidence", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await page.evaluate(() => (window as any).TestBridge.step(90));
  await page.waitForTimeout(250);

  const telemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(telemetry.executor.planHash).toMatch(/^[a-f0-9]{8}$/);
  expect(telemetry.lockedPlan?.segments.length).toBeGreaterThanOrEqual(1);
  expect(telemetry.executor.status).toMatch(/Executing|Arrived|Diverged/);
  await expect(page.locator("#mode")).toHaveText(telemetry.ship.authority.mode);

  const originalHash = telemetry.executor.planHash;
  const divergent = await page.evaluate(() => (window as any).TestBridge.disturbShip(0));
  expect(divergent.executor.replanRequired).toBe(true);
  expect(divergent.executor.planHash).toBe(originalHash);
  const scenarioIds = await page.evaluate(() => (window as any).TestBridge.listScenarios());
  expect(scenarioIds).toEqual([
    "direct-local-arrival",
    "obstacle-avoidance-route",
    "insufficient-fuel",
    "no-authority",
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
        typeof result.initialFuel === "number" &&
        typeof result.finalFuel === "number" &&
        ["Manual", "Assisted", "Autopilot"].includes(result.authority?.mode) &&
        typeof result.authority?.mainThrusters === "boolean" &&
        typeof result.authority?.rcs === "boolean" &&
        typeof result.authority?.autopilot === "boolean" &&
        typeof result.brakingReserve?.canBrake === "boolean"
    )
  ).toBe(true);
  const insufficientFuel = matrixResults.find((result: any) => result.id === "insufficient-fuel");
  expect(insufficientFuel).toEqual(
    expect.objectContaining({
      status: "OutOfFuel",
      initialFuel: 0,
      finalFuel: 0,
      fuelUsed: 0,
      finalSpeed: 0,
      brakingReserve: expect.objectContaining({ fuelAvailable: false, canBrake: false })
    })
  );
  await assertCanvasHasNonDarkPixels(page);

  const evidenceDir = path.resolve(process.cwd(), "evidence");
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, "debug-scene.png"), fullPage: true });
  await writeFile(path.join(evidenceDir, "telemetry.json"), JSON.stringify(divergent, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "scenario-matrix.json"), JSON.stringify(matrixResults, null, 2), "utf8");
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test("debug scene renders on mobile and writes mobile screenshot", async ({ page }) => {
    await page.goto("/?testBridge=1");
    await page.waitForFunction(() => Boolean((window as any).TestBridge));
    await page.waitForSelector("#debug-scene", { state: "visible" });
    await page.evaluate(() => (window as any).TestBridge.step(90));
    await page.waitForTimeout(250);

    const telemetry = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
    expect(telemetry.executor.planHash).toMatch(/^[a-f0-9]{8}$/);
    expect(telemetry.lockedPlan?.segments.length).toBeGreaterThanOrEqual(1);
    expect(telemetry.executor.status).toMatch(/Executing|Arrived|Diverged/);
    await expect(page.locator("#mode")).toHaveText(telemetry.ship.authority.mode);
    await assertCanvasHasNonDarkPixels(page);

    const evidenceDir = path.resolve(process.cwd(), "evidence");
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDir, "debug-scene-mobile.png"), fullPage: true });
  });
});

test("product bootstrap does not expose the E2E TestBridge by default", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("#mode")).toBeVisible();
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
});
