import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const layoutReportPath = path.join(evidenceDir, "browser-ui-concept-parity-v2-layout-report.json");

interface RectReport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}

interface LayoutEntry {
  readonly name: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly boxes: Record<string, RectReport>;
  readonly centerSafeArea: RectReport;
  readonly overlapPercentages: Record<string, number>;
  readonly screenshotPath: string;
  readonly v1ComparisonPath: string | null;
  readonly pixelDeltaFromRejectedV1: number | null;
}

const layoutEntries: LayoutEntry[] = [];

const toReportRect = (box: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>): RectReport => ({
  x: Math.round(box.x),
  y: Math.round(box.y),
  width: Math.round(box.width),
  height: Math.round(box.height),
  right: Math.round(box.x + box.width),
  bottom: Math.round(box.y + box.height)
});

const overlapArea = (left: RectReport, right: RectReport): number => {
  const overlapX = Math.max(0, Math.min(left.right, right.right) - Math.max(left.x, right.x));
  const overlapY = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y));
  return overlapX * overlapY;
};

async function boxFor(page: Page, selector: string): Promise<RectReport> {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} should have a measurable bounding box`).toBeTruthy();
  return toReportRect(box!);
}

async function expectNoTestBridge(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
  await expect(page.locator("#debug-hud")).toBeHidden();
  expect(new URL(page.url()).searchParams.get("testBridge")).toBeNull();
}

async function waitForNormalRuntime(page: Page): Promise<void> {
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB", { timeout: 20_000 });
  await expectNoTestBridge(page);
}

async function waitFrames(page: Page, frameCount: number): Promise<void> {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, frameCount);
}

async function expectLiveFlightCanvas(page: Page): Promise<void> {
  const canvas = page.locator("#debug-scene");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS("opacity", "1");

  const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => ({
    bufferWidth: element.width,
    bufferHeight: element.height,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight
  }));
  expect(dimensions.bufferWidth).toBeGreaterThan(0);
  expect(dimensions.bufferHeight).toBeGreaterThan(0);
  expect(dimensions.clientWidth).toBeGreaterThan(900);
  expect(dimensions.clientHeight).toBeGreaterThan(500);

  const before = await canvas.screenshot();
  expect(before.byteLength, "Live WebGL canvas screenshot should not be blank").toBeGreaterThan(10_000);
  await page.keyboard.press("KeyY");
  await waitFrames(page, 90);
  const after = await canvas.screenshot();
  expect(after.byteLength, "Later live WebGL frame should not be blank").toBeGreaterThan(10_000);
  expect(after.equals(before), "Live WebGL canvas should change across flight frames").toBe(false);
}

async function expectNoStaticFlightReplacement(page: Page): Promise<void> {
  const presentation = await page.locator("#app").evaluate((element) => {
    const style = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    return {
      backgroundImage: style.backgroundImage,
      beforeBackgroundImage: before.backgroundImage,
      beforeContent: before.content
    };
  });
  expect(presentation.backgroundImage).toBe("none");
  expect(presentation.beforeBackgroundImage).toBe("none");
  expect(presentation.beforeContent).toMatch(/none|normal/);
}

async function changedPixelRatio(page: Page, previousPath: string, currentBuffer: Buffer): Promise<number> {
  const previous = `data:image/png;base64,${(await readFile(previousPath)).toString("base64")}`;
  const current = `data:image/png;base64,${currentBuffer.toString("base64")}`;
  return page.evaluate(
    async ({ previous, current }) => {
      const loadImage = async (source: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = source;
        });

      const [previousImage, currentImage] = await Promise.all([loadImage(previous), loadImage(current)]);
      const width = Math.min(previousImage.naturalWidth, currentImage.naturalWidth);
      const height = Math.min(previousImage.naturalHeight, currentImage.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context || width <= 0 || height <= 0) {
        return 0;
      }

      context.drawImage(previousImage, 0, 0, width, height);
      const previousData = context.getImageData(0, 0, width, height).data;
      context.clearRect(0, 0, width, height);
      context.drawImage(currentImage, 0, 0, width, height);
      const currentData = context.getImageData(0, 0, width, height).data;

      const step = 2;
      let changed = 0;
      let sampled = 0;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const offset = (y * width + x) * 4;
          const red = Math.abs(previousData[offset] - currentData[offset]);
          const green = Math.abs(previousData[offset + 1] - currentData[offset + 1]);
          const blue = Math.abs(previousData[offset + 2] - currentData[offset + 2]);
          const alpha = Math.abs(previousData[offset + 3] - currentData[offset + 3]);
          if (red + green + blue + alpha > 48) {
            changed += 1;
          }
          sampled += 1;
        }
      }

      return sampled === 0 ? 0 : Number((changed / sampled).toFixed(4));
    },
    { previous, current }
  );
}

async function captureAndRecord(
  page: Page,
  name: string,
  fileName: string,
  selectors: readonly string[],
  rejectedV1FileName: string | null = null
): Promise<LayoutEntry> {
  const viewport = page.viewportSize();
  expect(viewport, "Viewport should be known for layout report").toBeTruthy();
  const centerSafeArea = await boxFor(page, ".hud-center-safe-area");
  const boxes: Record<string, RectReport> = {};
  const overlapPercentages: Record<string, number> = {};

  for (const selector of selectors) {
    const box = await boxFor(page, selector);
    boxes[selector] = box;
    const centerArea = centerSafeArea.width * centerSafeArea.height;
    overlapPercentages[selector] = centerArea === 0 ? 0 : Number(((overlapArea(box, centerSafeArea) / centerArea) * 100).toFixed(2));
  }

  const screenshotPath = path.join(evidenceDir, fileName);
  const screenshot = await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(existsSync(screenshotPath), `${fileName} should exist after screenshot capture`).toBe(true);

  const v1ComparisonPath = rejectedV1FileName ? path.join(evidenceDir, rejectedV1FileName) : null;
  let pixelDeltaFromRejectedV1: number | null = null;
  if (v1ComparisonPath) {
    expect(
      existsSync(v1ComparisonPath),
      `Required rejected-V1 comparison artifact is missing: ${v1ComparisonPath}`
    ).toBe(true);
    pixelDeltaFromRejectedV1 = await changedPixelRatio(page, v1ComparisonPath, screenshot);
  }

  const entry: LayoutEntry = {
    name,
    viewport: viewport!,
    boxes,
    centerSafeArea,
    overlapPercentages,
    screenshotPath,
    v1ComparisonPath,
    pixelDeltaFromRejectedV1
  };
  layoutEntries.push(entry);
  return entry;
}

async function expectCenterClear(entry: LayoutEntry, maxOverlapPercent: number): Promise<void> {
  for (const [selector, percentage] of Object.entries(entry.overlapPercentages)) {
    if (selector.includes("reticle") || selector.includes("marker") || selector.includes("cockpit-frame")) {
      continue;
    }
    expect(percentage, `${selector} should not cover the center safe area`).toBeLessThanOrEqual(maxOverlapPercent);
  }
}

async function expectDiagnosticLineHiddenButPresent(page: Page): Promise<void> {
  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB");
  const diagnosticBox = await page.locator(".hud-readout--diagnostic").boundingBox();
  expect(diagnosticBox?.width ?? 0).toBeLessThanOrEqual(2);
  expect(diagnosticBox?.height ?? 0).toBeLessThanOrEqual(2);
}

test.afterAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    layoutReportPath,
    JSON.stringify(
      {
        generatedBy: "apps/weltraum-browser/tests/e2e/ui-concept-parity-v2.spec.ts",
        normalRuntimeOnly: true,
        testBridgeUsed: false,
        rejectedV1Comparison: true,
        entries: layoutEntries
      },
      null,
      2
    ),
    "utf8"
  );
});

test("authoritative normal flight surface keeps live WebGL and concept HUD boundaries", async ({ page }) => {
  test.setTimeout(80_000);
  await mkdir(evidenceDir, { recursive: true });

  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto("/");
  await waitForNormalRuntime(page);
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("body")).toHaveAttribute("data-debug-hud", "false");
  await expectNoStaticFlightReplacement(page);
  await expectLiveFlightCanvas(page);
  await expectDiagnosticLineHiddenButPresent(page);
  expect(new URL(page.url()).searchParams.get("debugGrid")).toBeNull();
  expect(new URL(page.url()).searchParams.get("testBridge")).toBeNull();
  await expect(page.locator("#velocity-status")).toContainText("m/s");
  await expect(page.locator("#hud-left-panel")).toBeVisible();
  await expect(page.locator("#hud-radar-panel")).toBeVisible();
  await expect(page.locator("#hud-right-panel")).toBeVisible();
  await expect(page.locator("#hud-bottom-strip")).toBeHidden();
  await expect(page.getByTestId("selected-target")).toContainText("Navigation Alpha");
  await expect(page.getByTestId("radar-scope")).toBeVisible();

  const entry = await captureAndRecord(page, "flight-hud-v2-1640x900", "ui-concept-parity-v2-flight-hud.png", [
    "#hud-left-panel",
    "#hud-radar-panel",
    "#hud-right-panel",
    ".cockpit-frame"
  ], "ui-concept-parity-v1-rejected-flight-hud.png");
  await expectCenterClear(entry, 2.5);
  expect(entry.pixelDeltaFromRejectedV1, "Rejected V1 flight comparison should produce a pixel delta").not.toBeNull();
  expect(entry.pixelDeltaFromRejectedV1!, "Authoritative live flight should visibly differ from the rejected V1 HUD").toBeGreaterThan(0.1);

  await page.setViewportSize({ width: 1280, height: 720 });
  await waitFrames(page, 45);
  const compact = await captureAndRecord(page, "flight-hud-v2-1280x720", "ui-concept-parity-v2-flight-hud-1280x720.png", [
    "#hud-left-panel",
    "#hud-radar-panel",
    "#hud-right-panel"
  ], "ui-concept-parity-v1-rejected-flight-hud-1280x720.png");
  await expectCenterClear(compact, 3.5);
  await expectNoTestBridge(page);
});

test("navigation planner presents a full star-map route plan in normal runtime", async ({ page }) => {
  test.setTimeout(ciTimeout(55_000, 135_000));
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto("/");
  await waitForNormalRuntime(page);

  await page.locator("#open-navigation-planner").click();
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  await expect(page.getByTestId("navigation-planner-map")).toBeVisible();
  await expect(page.getByTestId("route-details-panel")).toBeVisible();
  await expect(page.getByTestId("route-profile-controls")).toContainText("Balanced");
  await page.locator('#planner-target-options button[data-planner-target-id="range-2500m"]').click();
  await expect(page.getByTestId("planner-selected-target")).toContainText("Range 2500m");
  await expect(page.getByTestId("planner-route-status")).toContainText(/preview ready/i);
  await expect(page.getByTestId("planner-engage-route")).toBeEnabled();

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const map = await boxFor(page, "#nav-planner-map");
  const details = await boxFor(page, "#nav-planner-details");
  expect(map.width).toBeGreaterThan(viewport!.width * 0.52);
  expect(map.height).toBeGreaterThan(viewport!.height * 0.62);
  expect(details.width).toBeGreaterThan(300);
  await page.locator("#nav-planner-details").evaluate((element) => {
    element.scrollTop = 0;
  });
  await waitFrames(page, 6);

  const entry = await captureAndRecord(page, "navigation-planner-v2", "ui-concept-parity-v2-navigation-planner.png", [
    "#navigation-planner",
    "#nav-planner-map",
    "#nav-planner-details"
  ], "ui-concept-parity-v1-rejected-navigation-planner.png");
  expect(entry.boxes["#nav-planner-map"].width).toBeGreaterThan(entry.boxes["#nav-planner-details"].width);
  expect(entry.pixelDeltaFromRejectedV1, "Rejected V1 planner comparison should produce a pixel delta").not.toBeNull();
  expect(entry.pixelDeltaFromRejectedV1!, "V2 planner screenshot should visibly differ from the rejected V1 planner").toBeGreaterThan(0.1);
  await expectNoTestBridge(page);
});

test("combat contact scenario is a red-accented UI shell without default TestBridge exposure", async ({ page }) => {
  test.setTimeout(ciTimeout(55_000, 135_000));
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto("/?uiScenario=combat-contact");
  await waitForNormalRuntime(page);
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "combat");
  await expect(page.getByTestId("combat-contact-hud")).toBeVisible();
  await expect(page.getByTestId("combat-contact-panel")).toBeVisible();
  await expect(page.getByTestId("contact-target-card")).toBeVisible();
  await expect(page.getByTestId("contact-reticle")).toBeVisible();
  await expect(page.getByTestId("contact-marker")).toContainText(/Navigation Alpha/i);
  await expect(page.getByTestId("contact-target-card")).toContainText("No real combat system active");
  await expect(page.getByTestId("contact-target-card")).toContainText("Navigation telemetry only");

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const contactPanel = await boxFor(page, "#contact-panel");
  const contactCard = await boxFor(page, "#contact-target-card");
  expect(contactPanel.right).toBeGreaterThan(viewport!.width - 40);
  expect(contactCard.right).toBeGreaterThan(viewport!.width - 40);
  expect(contactPanel.width).toBeGreaterThan(300);

  const entry = await captureAndRecord(page, "combat-contact-v2", "ui-concept-parity-v2-combat-contact.png", [
    "#hud-left-panel",
    "#hud-radar-panel",
    "#contact-panel",
    "#contact-target-card",
    ".contact-reticle",
    ".contact-marker"
  ], "ui-concept-parity-v1-rejected-combat-contact.png");
  await expectCenterClear(entry, 3);
  expect(entry.pixelDeltaFromRejectedV1, "Rejected V1 combat comparison should produce a pixel delta").not.toBeNull();
  expect(entry.pixelDeltaFromRejectedV1!, "V2 combat screenshot should visibly differ from the rejected V1 contact shell").toBeGreaterThan(0.1);
  await expectNoTestBridge(page);
});
