import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";
import { readVisiblePreviewHash } from "./support/plannerWorkflow";

const evidenceRoot = path.resolve(
  process.cwd(),
  "test-results/browser-navigation-map-world-truth"
);
const repositoryRoot = path.resolve(process.cwd(), "../..");
const screenshotRoot = path.join(evidenceRoot, "screenshots");

test.use({ screenshot: "off", trace: "retain-on-failure" });

async function waitFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, count);
}

async function openPlanner(page: Page): Promise<Locator> {
  const planner = page.getByTestId("navigation-planner");
  if (!(await planner.isVisible())) {
    await page.locator("#open-navigation-planner").click();
  }
  await expect(planner).toBeVisible();
  await expect(page.locator("#planner-route-svg")).toHaveAttribute("data-snapshot", "ready");
  return planner;
}

async function closePlanner(page: Page): Promise<void> {
  await page.locator("#planner-close").click();
  await expect(page.getByTestId("navigation-planner")).toBeHidden();
}

const numericAttribute = async (locator: Locator, name: string): Promise<number> => {
  const value = Number(await locator.getAttribute(name));
  expect(Number.isFinite(value), `${name} must be a finite runtime value`).toBe(true);
  return value;
};

test("normal runtime owns local map geometry, interaction, live ship state, and FHD/QHD evidence", async ({ page }) => {
  test.setTimeout(ciTimeout(70_000, 180_000));
  await mkdir(screenshotRoot, { recursive: true });
  await page.setViewportSize({ width: 1_920, height: 1_080 });
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  expect(new URL(page.url()).search).toBe("");
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);

  await openPlanner(page);
  await expect(page.locator(".planner-title")).toHaveText("LOCAL NAVIGATION MAP");
  const svg = page.locator("#planner-route-svg");
  const map = page.getByTestId("navigation-planner-map");
  const background = await map.evaluate((element) => ({
    image: getComputedStyle(element).backgroundImage,
    before: getComputedStyle(element, "::before").backgroundImage,
    after: getComputedStyle(element, "::after").backgroundImage
  }));
  expect(background.image).not.toContain("url(");
  expect(background.before).not.toContain("planner-system-map-clean");
  expect(background.after).not.toContain("planner-system-map-clean");

  const arbitraryTargetId = "range-1000m";
  const arbitraryTarget = svg.locator(`[data-map-object="target"][data-target-id="${arbitraryTargetId}"]`);
  await expect(arbitraryTarget).toBeVisible();
  const targetAbsoluteX = await numericAttribute(arbitraryTarget, "data-absolute-x");
  const targetAbsoluteZ = await numericAttribute(arbitraryTarget, "data-absolute-z");
  await expect(page.locator(`#planner-target-options button[data-planner-target-id="${arbitraryTargetId}"]`)).toBeEnabled();
  const targetHit = arbitraryTarget.locator(`[data-target-hit-id="${arbitraryTargetId}"]`);
  const hitTest = await targetHit.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      hitTag: hit?.tagName ?? null,
      hitTargetId: (hit as HTMLElement | null)?.dataset?.targetHitId ?? (hit?.closest("[data-target-id]") as HTMLElement | null)?.dataset?.targetId ?? null,
      pathPointerEvents: getComputedStyle(element).pointerEvents,
      groupPointerEvents: getComputedStyle(element.parentElement!).pointerEvents
    };
  });
  expect(hitTest.hitTargetId, JSON.stringify(hitTest)).toBe(arbitraryTargetId);
  await targetHit.click();
  await expect(arbitraryTarget).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#planner-selected-target")).toContainText("Range 1000m");
  const previewHash = await readVisiblePreviewHash(page);
  await expect(svg).toHaveAttribute("data-route-plan-hash", previewHash);

  const routeSegments = svg.locator("[data-map-layer='route'] [data-segment-id]");
  await expect(routeSegments.first()).toBeVisible();
  const lastSegment = routeSegments.last();
  expect(await numericAttribute(lastSegment, "data-end-x")).toBe(targetAbsoluteX);
  expect(await numericAttribute(lastSegment, "data-end-z")).toBe(targetAbsoluteZ);
  await numericAttribute(lastSegment, "x1");
  await numericAttribute(lastSegment, "y1");
  await numericAttribute(lastSegment, "x2");
  await numericAttribute(lastSegment, "y2");

  const obstacle = svg.locator("[data-map-layer='obstacles'] [data-obstacle-id]").first();
  await expect(obstacle).toBeVisible();
  expect(await numericAttribute(obstacle, "data-radius-metres")).toBeGreaterThan(0);
  await numericAttribute(obstacle, "data-absolute-x");
  await numericAttribute(obstacle, "data-absolute-z");
  const entity = svg.locator("[data-map-layer='world-entities'] [data-world-entity-id]").first();
  await expect(entity).toBeVisible();
  await expect(entity).toHaveAttribute("data-residence", /Full|Snapshot/);

  const ship = svg.locator("[data-map-object='active-ship']");
  await expect(ship).toHaveAttribute("data-display-name", "Demo Scout GLB");
  await expect(ship).toHaveAttribute("data-blueprint-id", "demo-scout-mk1");
  await expect(ship).toHaveAttribute("data-visual-id", "demo-scout-mk1-glb");
  const initialShipX = await numericAttribute(ship, "data-absolute-x");
  const initialShipZ = await numericAttribute(ship, "data-absolute-z");
  const initialHeading = await numericAttribute(ship, "data-heading-degrees");
  const initialShipTransform = await ship.getAttribute("transform");

  const initialViewCenter = await svg.getAttribute("data-view-center");
  await page.locator("#planner-map-zoom").click();
  await expect(svg).toHaveAttribute("data-zoom", "1.25");
  await page.locator("#planner-map-orbit").click();
  await expect(svg).toHaveAttribute("data-orbit", "ship-up");
  await expect(ship).toHaveAttribute("transform", /rotate\(0\.0000\)/);
  const box = await svg.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width * 0.48, box!.y + box!.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.56, box!.y + box!.height * 0.61, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => svg.getAttribute("data-view-center")).not.toBe(initialViewCenter);
  await page.locator("#planner-map-focus").click();
  await expect(svg).toHaveAttribute("data-zoom", "1");
  expect(await readVisiblePreviewHash(page)).toBe(previewHash);

  await closePlanner(page);
  await page.keyboard.press("z");
  await page.waitForTimeout(1_100);
  await page.keyboard.press("x");
  await openPlanner(page);
  await expect.poll(async () => ({
    x: await numericAttribute(ship, "data-absolute-x"),
    z: await numericAttribute(ship, "data-absolute-z")
  }), { timeout: 8_000 }).not.toEqual({ x: initialShipX, z: initialShipZ });
  const movedShipX = await numericAttribute(ship, "data-absolute-x");
  const movedShipZ = await numericAttribute(ship, "data-absolute-z");
  expect(await ship.getAttribute("transform")).not.toBe(initialShipTransform);

  await page.locator("#planner-map-orbit").click();
  await expect(svg).toHaveAttribute("data-orbit", "north-up");
  await closePlanner(page);
  await page.keyboard.down("a");
  await page.waitForTimeout(1_000);
  await page.keyboard.up("a");
  await waitFrames(page, 20);
  await openPlanner(page);
  await expect.poll(() => numericAttribute(ship, "data-heading-degrees"), { timeout: 8_000 }).not.toBe(initialHeading);
  const changedHeading = await numericAttribute(ship, "data-heading-degrees");
  await expect(ship).not.toHaveAttribute("transform", /rotate\(90\.0000\)/);
  expect(await readVisiblePreviewHash(page)).toBe(previewHash);

  const scale = page.locator("#planner-map-scale");
  await expect(scale).toHaveAttribute("data-metres", /\d/);
  await expect(page.locator("#planner-map-scale-label")).toContainText(/m|km/);
  const fhdPath = path.join(screenshotRoot, "browser-navigation-map-world-truth-fhd-1920x1080.png");
  await page.screenshot({ path: fhdPath, fullPage: false });

  await page.setViewportSize({ width: 2_560, height: 1_440 });
  await waitFrames(page, 4);
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  const qhdPath = path.join(screenshotRoot, "browser-navigation-map-world-truth-qhd-2560x1440.png");
  await page.screenshot({ path: qhdPath, fullPage: false });

  await writeFile(path.join(evidenceRoot, "browser-navigation-map-world-truth-evidence.json"), JSON.stringify({
    route: { targetId: arbitraryTargetId, targetAbsoluteX, targetAbsoluteZ, previewHash },
    ship: { initialShipX, initialShipZ, movedShipX, movedShipZ, initialHeading, changedHeading },
    layers: {
      targets: Number(await svg.getAttribute("data-target-count")),
      routeSegments: Number(await svg.getAttribute("data-segment-count")),
      obstacles: Number(await svg.getAttribute("data-obstacle-count")),
      entities: Number(await svg.getAttribute("data-entity-count"))
    },
    background,
    screenshots: [fhdPath, qhdPath].map((filePath) => path.relative(repositoryRoot, filePath).replaceAll("\\", "/"))
  }, null, 2), "utf8");
});
