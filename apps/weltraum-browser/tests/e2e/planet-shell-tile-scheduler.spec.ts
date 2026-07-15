import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const snapshotDirectory = path.resolve(
  process.cwd(),
  "tests/e2e/planet-shell-tile-scheduler.spec.ts-snapshots"
);
const updateSnapshots = process.env.UPDATE_PLANET_SHELL_SNAPSHOTS === "1";

const screenshotNames = [
  "planet-shell-far-orbit.png",
  "planet-shell-near-orbit-parent-fallback.png",
  "planet-shell-near-orbit-child-ready.png"
] as const;

type ScreenshotName = (typeof screenshotNames)[number];

interface BrowserFailures {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface HestiaSnapshot {
  readonly state: "far-orbit" | "near-orbit" | "parent-fallback" | "child-ready" | "evicted";
  readonly selectionRevision: number;
  readonly readinessRevision: number;
  readonly cameraPositionMeters: { readonly x: number; readonly y: number; readonly z: number };
  readonly primary: readonly string[];
  readonly fallback: readonly string[];
  readonly culled: readonly string[];
  readonly visibleTileIds: readonly string[];
  readonly visibleRepresentationKeys: readonly string[];
  readonly loadRequests: readonly Readonly<{
    tileId: string;
    reason: string;
    requiredForCoverage: boolean;
  }>[];
  readonly reasons: readonly Readonly<{ tileId: string; code: string }>[];
  readonly highlightedReason: Readonly<{ tileId: string; code: string }>;
  readonly coverageStatus: "READY" | "NOT_READY";
}

interface PixelComparison {
  readonly width: number;
  readonly height: number;
  readonly changedPixels: number;
  readonly changedRatio: number;
  readonly maximumChannelDelta: number;
}

const targetParentId = "planet-tile:v1:hestia:+Z:0:0:0";
const targetChildIds = [
  "planet-tile:v1:hestia:+Z:1:0:0",
  "planet-tile:v1:hestia:+Z:1:1:0",
  "planet-tile:v1:hestia:+Z:1:0:1",
  "planet-tile:v1:hestia:+Z:1:1:1"
] as const;
const horizonRootId = "planet-tile:v1:hestia:-Z:0:0:0";

const installFailureCollectors = (page: Page): BrowserFailures => {
  const failures: BrowserFailures = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: []
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    failures.consoleErrors.push(
      `${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`
    );
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => failures.requestFailures.push(
    `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`
  ));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return failures;
};

const readTestBridgeState = (page: Page): Promise<{ ownProperty: boolean; inWindow: boolean }> =>
  page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));

const comparePngs = async (page: Page, expected: Buffer, actual: Buffer): Promise<PixelComparison> =>
  page.evaluate(async ({ expectedBase64, actualBase64 }) => {
    const decode = async (base64: string) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("Canvas 2D context unavailable for screenshot comparison.");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: context.getImageData(0, 0, canvas.width, canvas.height).data
      };
    };
    const expectedImage = await decode(expectedBase64);
    const actualImage = await decode(actualBase64);
    if (expectedImage.width !== actualImage.width || expectedImage.height !== actualImage.height) {
      throw new Error(
        `Screenshot size mismatch: ${expectedImage.width}x${expectedImage.height} vs ${actualImage.width}x${actualImage.height}`
      );
    }
    let changedPixels = 0;
    let maximumChannelDelta = 0;
    for (let offset = 0; offset < expectedImage.pixels.length; offset += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(expectedImage.pixels[offset + channel] - actualImage.pixels[offset + channel]);
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
        if (delta > 12) changed = true;
      }
      if (changed) changedPixels += 1;
    }
    return {
      width: actualImage.width,
      height: actualImage.height,
      changedPixels,
      changedRatio: changedPixels / (actualImage.width * actualImage.height),
      maximumChannelDelta
    };
  }, {
    expectedBase64: expected.toString("base64"),
    actualBase64: actual.toString("base64")
  });

const compareOrUpdateBaseline = async (
  page: Page,
  name: ScreenshotName,
  actual: Buffer
): Promise<PixelComparison> => {
  const baselinePath = path.join(snapshotDirectory, name);
  if (updateSnapshots) await writeFile(baselinePath, actual);
  let expected: Buffer;
  try {
    expected = await readFile(baselinePath);
  } catch (error) {
    throw new Error(`Missing baseline ${baselinePath}; rerun with UPDATE_PLANET_SHELL_SNAPSHOTS=1.`, { cause: error });
  }
  const comparison = await comparePngs(page, expected, actual);
  expect(comparison.width).toBe(1_920);
  expect(comparison.height).toBe(1_080);
  expect(comparison.changedRatio, `${name} changed-pixel ratio`).toBeLessThanOrEqual(0.005);
  return comparison;
};

test("normal route mounts the deterministic Hestia orbit tile-scheduler harness", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1_920, height: 1_080 });
  const failures = installFailureCollectors(page);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");
  expect(await readTestBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });

  const controller = await page.evaluateHandle(async () => {
    const harnessPath = "/src/planet/harness/hestiaOrbitHarness.ts";
    const harnessModule = await import(/* @vite-ignore */ harnessPath);
    return harnessModule.mountHestiaOrbitHarness(document.body);
  });
  const harness = page.locator("[data-hestia-orbit-harness='v1']");
  const canvas = harness.locator("canvas[data-render-backend-harness='v1']");
  const panel = harness.locator("[data-hestia-orbit-panel='v1']");
  const status = harness.getByRole("status");
  await expect(harness).toHaveCount(1);
  await expect(canvas).toHaveCount(1);
  await expect(panel.getByRole("heading", { name: "DIAGNOSTIC · Hestia orbit harness" })).toBeVisible();
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(canvas).toHaveCSS("width", "1920px");
  await expect(canvas).toHaveCSS("height", "1080px");
  await expect(harness.locator("[data-local-voxel-region]")).toHaveCount(0);

  const far = await controller.evaluate((value) => value.showFarOrbit() as HestiaSnapshot);
  expect(far).toMatchObject({
    state: "far-orbit",
    selectionRevision: 101,
    readinessRevision: 201,
    cameraPositionMeters: { x: 0, y: 0, z: 3_000 },
    highlightedReason: { tileId: horizonRootId, code: "culled-horizon" }
  });
  expect(far.culled).toContain(horizonRootId);
  expect(far.primary).toContain(targetParentId);
  await expect(status).toContainText("FAR ORBIT");
  const farImage = await page.screenshot();

  const near = await controller.evaluate((value) => value.showNearOrbit() as HestiaSnapshot);
  expect(near).toMatchObject({
    state: "near-orbit",
    selectionRevision: 102,
    readinessRevision: 202,
    cameraPositionMeters: { x: 0, y: 0, z: 1_300 },
    highlightedReason: { tileId: targetParentId, code: "primary-max-level" }
  });

  const fallback = await controller.evaluate((value) => value.showParentFallback() as HestiaSnapshot);
  expect(fallback).toMatchObject({
    state: "parent-fallback",
    selectionRevision: 103,
    readinessRevision: 203,
    highlightedReason: { tileId: targetParentId, code: "fallback-incomplete-child-coverage" },
    coverageStatus: "READY"
  });
  expect(fallback.fallback).toContain(targetParentId);
  expect(fallback.visibleTileIds).toContain(targetParentId);
  for (const childId of targetChildIds) expect(fallback.visibleTileIds).not.toContain(childId);
  expect(fallback.loadRequests).toContainEqual(expect.objectContaining({
    tileId: targetChildIds[3],
    reason: "requested-child-loading",
    requiredForCoverage: false
  }));
  await expect(status).toContainText("PARENT FALLBACK ACTIVE");
  const fallbackImage = await page.screenshot();

  const ready = await controller.evaluate((value) => value.showChildReady() as HestiaSnapshot);
  expect(ready).toMatchObject({
    state: "child-ready",
    selectionRevision: 104,
    readinessRevision: 204,
    highlightedReason: { tileId: targetParentId, code: "parent-hidden-complete-child-coverage" },
    coverageStatus: "READY"
  });
  expect(ready.primary).toEqual(expect.arrayContaining([...targetChildIds]));
  expect(ready.visibleTileIds).toEqual(expect.arrayContaining([...targetChildIds]));
  expect(ready.visibleTileIds).not.toContain(targetParentId);
  await expect(status).toContainText("ATOMIC CHILD HANDOFF");
  const readyImage = await page.screenshot();

  const evicted = await controller.evaluate((value) => value.showEvicted() as HestiaSnapshot);
  expect(evicted).toMatchObject({
    state: "evicted",
    selectionRevision: 105,
    readinessRevision: 205,
    highlightedReason: { tileId: targetChildIds[2], code: "requested-child-evicted" },
    coverageStatus: "READY"
  });
  expect(evicted.fallback).toContain(targetParentId);
  expect(evicted.visibleTileIds).toContain(targetParentId);
  for (const childId of targetChildIds) expect(evicted.visibleTileIds).not.toContain(childId);
  expect(evicted.loadRequests).toContainEqual(expect.objectContaining({
    tileId: targetChildIds[2],
    reason: "requested-child-evicted",
    requiredForCoverage: false
  }));
  await expect(status).toContainText("PARENT REACTIVATED");

  const firstSequence = [far, near, fallback, ready, evicted];
  const repeatedFar = await controller.evaluate((value) => value.reset() as HestiaSnapshot);
  const repeatedNear = await controller.evaluate((value) => value.showNearOrbit() as HestiaSnapshot);
  const repeatedFallback = await controller.evaluate((value) => value.showParentFallback() as HestiaSnapshot);
  const repeatedReady = await controller.evaluate((value) => value.showChildReady() as HestiaSnapshot);
  const repeatedEvicted = await controller.evaluate((value) => value.showEvicted() as HestiaSnapshot);
  expect([repeatedFar, repeatedNear, repeatedFallback, repeatedReady, repeatedEvicted]).toEqual(firstSequence);

  const images: Readonly<Record<ScreenshotName, Buffer>> = {
    "planet-shell-far-orbit.png": farImage,
    "planet-shell-near-orbit-parent-fallback.png": fallbackImage,
    "planet-shell-near-orbit-child-ready.png": readyImage
  };
  const fallbackToReady = await comparePngs(page, fallbackImage, readyImage);
  expect(fallbackToReady.changedRatio, "atomic handoff must be visibly distinct").toBeGreaterThan(0.01);

  expect(await readTestBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  const disposed = await controller.evaluate((value) => value.dispose() as { status: string });
  expect(disposed.status).toBe("Accepted");
  const repeatedDisposed = await controller.evaluate((value) => value.dispose() as { status: string });
  expect(repeatedDisposed).toEqual(disposed);
  await expect(
    controller.evaluate((value) => value.reset() as HestiaSnapshot)
  ).rejects.toThrow("The Hestia orbit harness is disposed.");
  await controller.dispose();
  await expect(harness).toHaveCount(0);
  expect(failures).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });

  if (updateSnapshots) await mkdir(snapshotDirectory, { recursive: true });
  const baselineComparisons = await Promise.all(
    screenshotNames.map((name) => compareOrUpdateBaseline(page, name, images[name]))
  );
  expect(baselineComparisons).toHaveLength(screenshotNames.length);
  await mkdir(evidenceDirectory, { recursive: true });
  await Promise.all(
    screenshotNames.map((name) => writeFile(path.join(evidenceDirectory, name), images[name]))
  );
});
