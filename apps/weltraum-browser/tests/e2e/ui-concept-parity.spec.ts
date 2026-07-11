import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const layoutReportPath = path.join(evidenceDir, "browser-ui-concept-parity-v1-layout-report.json");

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

async function captureAndRecord(
  page: Page,
  name: string,
  fileName: string,
  selectors: readonly string[]
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
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(existsSync(screenshotPath), `${fileName} should exist after screenshot capture`).toBe(true);

  const entry: LayoutEntry = {
    name,
    viewport: viewport!,
    boxes,
    centerSafeArea,
    overlapPercentages,
    screenshotPath
  };
  layoutEntries.push(entry);
  return entry;
}

async function expectFlightHudStructure(page: Page): Promise<void> {
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("body")).toHaveAttribute("data-debug-hud", "false");
  await expect(page.locator("#debug-scene")).toBeVisible();
  await expect(page.locator("#debug-scene")).toHaveCSS("opacity", "1");
  await expect(page.locator("#hud-left-panel")).toBeVisible();
  await expect(page.locator("#hud-radar-panel")).toBeVisible();
  await expect(page.locator("#hud-right-panel")).toBeVisible();
  await expect(page.locator("#hud-top-strip")).toBeHidden();
  await expect(page.locator("#hud-bottom-strip")).toBeHidden();
  await expect(page.locator("#velocity-status")).toContainText("m/s");
  await expect(page.locator("#throttle-status")).toBeVisible();
  await expect(page.locator("#fuel-status")).toBeVisible();
  await expect(page.locator("#rcs-sas-status")).toContainText("RCS");
  await expect(page.getByTestId("radar-scope")).toBeVisible();
  await expect(page.getByTestId("selected-target")).toBeVisible();
  await expect(page.locator("#route-status")).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const left = await boxFor(page, "#hud-left-panel");
  const radar = await boxFor(page, "#hud-radar-panel");
  const right = await boxFor(page, "#hud-right-panel");
  const safe = await boxFor(page, ".hud-center-safe-area");

  expect(left.x).toBeLessThan(48);
  expect(left.width).toBeLessThanOrEqual(360);
  expect(radar.x).toBeLessThan(48);
  expect(radar.bottom).toBeGreaterThan(viewport!.height - 36);
  expect(right.right).toBeGreaterThan(viewport!.width - 48);
  expect(right.width).toBeLessThanOrEqual(460);
  expect(safe.width).toBeGreaterThan(300);
  expect(safe.height).toBeGreaterThan(240);

  const cssTokens = await page.locator("#flight-hud").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      cyan: style.getPropertyValue("--hud-cyan").trim(),
      border: style.getPropertyValue("--hud-border").trim(),
      panelBackground: style.getPropertyValue("--hud-panel-bg").trim()
    };
  });
  expect(cssTokens.cyan).toBe("#23d6f2");
  expect(cssTokens.border).toContain("35, 214, 242");
  expect(cssTokens.panelBackground).toContain("linear-gradient");
}

async function expectCenterClear(entry: LayoutEntry, maxOverlapPercent: number): Promise<void> {
  for (const [selector, percentage] of Object.entries(entry.overlapPercentages)) {
    expect(percentage, `${selector} should not cover the center safe area`).toBeLessThanOrEqual(maxOverlapPercent);
  }
}

test.afterAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    layoutReportPath,
    JSON.stringify(
      {
        generatedBy: "apps/weltraum-browser/tests/e2e/ui-concept-parity.spec.ts",
        normalRuntimeOnly: true,
        testBridgeUsed: false,
        entries: layoutEntries
      },
      null,
      2
    ),
    "utf8"
  );
});

test("normal flight HUD follows concept edge layout and records screenshots", async ({ page }) => {
  test.setTimeout(70_000);
  await mkdir(evidenceDir, { recursive: true });

  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto("/");
  await waitForNormalRuntime(page);
  await expectFlightHudStructure(page);
  const flight1640 = await captureAndRecord(page, "flight-hud-1640x900", "ui-concept-parity-flight-hud.png", [
    "#hud-left-panel",
    "#hud-radar-panel",
    "#hud-right-panel"
  ]);
  await expectCenterClear(flight1640, 1.5);

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitFrames(page, 30);
  await expectFlightHudStructure(page);
  const flight1440 = await captureAndRecord(page, "flight-hud-1440x900", "ui-concept-parity-flight-hud-1440x900.png", [
    "#hud-left-panel",
    "#hud-radar-panel",
    "#hud-right-panel"
  ]);
  await expectCenterClear(flight1440, 1.5);

  await page.setViewportSize({ width: 1280, height: 720 });
  await waitFrames(page, 30);
  await expectFlightHudStructure(page);
  const flight1280 = await captureAndRecord(page, "flight-hud-1280x720", "ui-concept-parity-flight-hud-1280x720.png", [
    "#hud-left-panel",
    "#hud-radar-panel",
    "#hud-right-panel"
  ]);
  await expectCenterClear(flight1280, 2.5);

  await page.locator("#open-navigation-planner").click();
  await page.locator('#planner-target-options button[data-planner-target-id="range-1000m"]').click();
  await page.locator("#planner-close").click();
  await expect(page.getByTestId("selected-target")).toContainText("Range 1000m");
  await expect(page.locator("#route-status")).toContainText(/preview ready/i);
  await page.screenshot({ path: path.join(evidenceDir, "ui-concept-parity-flight-hud-target-selected.png"), fullPage: true });

  await expectNoTestBridge(page);
});

test("normal runtime navigation planner opens with dominant route map and route details", async ({ page }) => {
  test.setTimeout(45_000);
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await waitForNormalRuntime(page);

  await page.locator("#open-navigation-planner").click();
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  await expect(page.getByTestId("navigation-planner-map")).toBeVisible();
  await expect(page.getByTestId("route-details-panel")).toBeVisible();
  await expect(page.getByTestId("route-profile-controls")).toContainText("Balanced");
  await expect(page.getByTestId("planner-engage-route")).toBeVisible();
  await expect(page.getByTestId("planner-target-options")).toContainText("Range 1000m");

  await page.locator('#planner-target-options button[data-planner-target-id="range-2500m"]').click();
  await expect(page.getByTestId("planner-selected-target")).toContainText("Range 2500m");
  await expect(page.getByTestId("planner-route-status")).toContainText(/preview ready/i);
  await expect(page.getByTestId("planner-engage-route")).toBeEnabled();

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const map = await boxFor(page, "#nav-planner-map");
  const details = await boxFor(page, "#nav-planner-details");
  expect(map.width).toBeGreaterThan(viewport!.width * 0.48);
  expect(map.height).toBeGreaterThan(viewport!.height * 0.58);
  expect(details.right).toBeGreaterThan(viewport!.width - 32);
  expect(details.width).toBeGreaterThan(300);

  const entry = await captureAndRecord(page, "navigation-planner", "ui-concept-parity-navigation-planner.png", [
    "#navigation-planner",
    "#nav-planner-map",
    "#nav-planner-details"
  ]);
  expect(entry.boxes["#nav-planner-map"].width).toBeGreaterThan(entry.boxes["#nav-planner-details"].width);
  await expectNoTestBridge(page);
});

test("query-scoped combat contact presentation shell is visible without TestBridge", async ({ page }) => {
  test.setTimeout(45_000);
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
  await expect(page.getByTestId("radar-scope")).toBeVisible();
  await expect(page.getByTestId("contact-target-card")).toContainText("No real combat system active");

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const contactPanel = await boxFor(page, "#contact-panel");
  const contactCard = await boxFor(page, "#contact-target-card");
  expect(contactPanel.right).toBeGreaterThan(viewport!.width - 40);
  expect(contactCard.right).toBeGreaterThan(viewport!.width - 40);
  expect(contactPanel.width).toBeGreaterThan(260);

  await captureAndRecord(page, "combat-contact", "ui-concept-parity-combat-contact.png", [
    "#hud-left-panel",
    "#hud-radar-panel",
    "#contact-panel",
    "#contact-target-card"
  ]);
  await expectNoTestBridge(page);
});
