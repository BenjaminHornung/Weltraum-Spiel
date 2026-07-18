import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prototypeBaseUrl = process.env.WELTRAUM_SURFACE_PROTOTYPE_BASE_URL ?? "http://127.0.0.1:5202";
const prototypeUrl = new URL("/prototypes/first-person-surface-expedition-v1/", prototypeBaseUrl);
const expectedOrigin = prototypeUrl.origin;
const evidenceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../evidence");
const prototypePath = prototypeUrl.pathname;
const allowedRequestPaths = new Set([
  prototypePath,
  `${prototypePath}prototype.css`,
  `${prototypePath}prototype.js`,
  "/@vite/client",
  "/node_modules/vite/dist/client/env.mjs",
]);

const screenshots = {
  exploration: ["first-person-surface-expedition-ui-prototype-v1-exploration-1920x1080.png", 1920, 1080],
  scanner: ["first-person-surface-expedition-ui-prototype-v1-scanner-1920x1080.png", 1920, 1080],
  interaction: ["first-person-surface-expedition-ui-prototype-v1-interaction-hold-1920x1080.png", 1920, 1080],
  hazard: ["first-person-surface-expedition-ui-prototype-v1-hazard-warning-1920x1080.png", 1920, 1080],
  responsive: ["first-person-surface-expedition-ui-prototype-v1-responsive-1280x720.png", 1280, 720],
  focus: ["first-person-surface-expedition-ui-prototype-v1-keyboard-focus-1920x1080.png", 1920, 1080],
} as const;

interface Diagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
  unexpectedRequests: string[];
}

const diagnosticsByPage = new WeakMap<Page, Diagnostics>();

test.beforeEach(async ({ page }) => {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    unexpectedRequests: [],
  };
  diagnosticsByPage.set(page, diagnostics);

  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown error"}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    const isAllowed = url.origin === expectedOrigin && allowedRequestPaths.has(url.pathname);
    if (!isAllowed) diagnostics.unexpectedRequests.push(`${request.method()} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
  });
});

test.afterEach(async ({ page }) => {
  const diagnostics = diagnosticsByPage.get(page);
  expect(diagnostics, "Scenario diagnostics should be installed").toBeDefined();
  expect(diagnostics!.consoleErrors, "Console errors").toEqual([]);
  expect(diagnostics!.pageErrors, "Uncaught page errors").toEqual([]);
  expect(diagnostics!.failedRequests, "Failed requests").toEqual([]);
  expect(diagnostics!.badResponses, "HTTP responses >= 400").toEqual([]);
  expect(diagnostics!.unexpectedRequests, "Requests outside the exact local fixture allowlist").toEqual([]);
});

async function waitForFixtureReady(page: Page): Promise<void> {
  await expect(page.locator("#world-root")).toHaveAttribute("data-state", "Exploration");
  await expect(page.locator("#world-root")).toHaveAttribute("data-details", "collapsed");
  await expect(page.getByTestId("fixture-notice")).toBeVisible();
  await expect(page.getByTestId("fixture-notice")).toContainText("Prototype Fixture");
  await expect(page.getByTestId("fixture-notice")).toContainText("Deterministic mock values");
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe("complete");
  await expect.poll(() => page.locator("#surface-vista").evaluate((canvas: HTMLCanvasElement) => canvas.width > 0 && canvas.height > 0)).toBe(true);
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
}

async function openFixture(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  const response = await page.goto(prototypeUrl.href, { waitUntil: "domcontentloaded" });
  expect(response?.status(), "Prototype route should return HTTP 200").toBe(200);
  await waitForFixtureReady(page);
}

async function expectState(page: Page, state: string, buttonTestId: string): Promise<void> {
  await expect(page.getByTestId("prototype-state")).toHaveText(state);
  await expect(page.locator("#world-root")).toHaveAttribute("data-state", state);
  await expect(page.getByTestId(buttonTestId)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("fixture-notice")).toBeVisible();
}

async function pressFromWorld(page: Page, key: string): Promise<void> {
  await page.locator("#world-root").focus();
  await page.keyboard.press(key);
}

function rectanglesOverlap(left: DOMRect, right: DOMRect): boolean {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

async function expectNoCenterOverlap(page: Page, selectors: readonly string[]): Promise<void> {
  const center = await page.locator(".crosshair").evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (await locator.isVisible()) {
      const rectangle = await locator.evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
      expect(rectanglesOverlap(rectangle, center), `${selector} must not obscure the center target`).toBe(false);
    }
  }
}

async function expectReachable(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box, "Reachable control should have a bounding box").toBeTruthy();
  expect(viewport, "Viewport should be available").toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function pngDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const png = await readFile(filePath);
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${filePath} should be a PNG`).toBe(true);
  expect(png.subarray(12, 16).toString("ascii"), `${filePath} should begin with an IHDR chunk`).toBe("IHDR");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function capture(page: Page, evidence: readonly [string, number, number]): Promise<void> {
  const [fileName, width, height] = evidence;
  expect(page.viewportSize()).toEqual({ width, height });
  const filePath = path.join(evidenceDir, fileName);
  await page.screenshot({ path: filePath, animations: "disabled" });
  await expect(pngDimensions(filePath)).resolves.toEqual({ width, height });
}

async function deterministicSnapshot(page: Page) {
  return page.evaluate(() => {
    const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();
    const fixtureIds = Array.from(document.querySelectorAll<HTMLElement>("[data-fixture-id]"), (element) => element.dataset.fixtureId);
    return {
      state: document.querySelector<HTMLElement>("#world-root")?.dataset.state,
      details: document.querySelector<HTMLElement>("#world-root")?.dataset.details,
      activeTool: text("#active-tool"),
      nextAction: text("#next-action"),
      hazard: text("#hazard-level"),
      suit: text("#fixture-suit-status"),
      objective: text("#fixture-objective"),
      fixtureIds,
      canvas: document.querySelector<HTMLCanvasElement>("#surface-vista")?.toDataURL("image/png"),
    };
  });
}

test("direct fixture route is deterministic and captures the four primary state views", async ({ page }) => {
  await openFixture(page, 1920, 1080);
  await expect(page).toHaveTitle("Hestia Surface Expedition — Prototype Fixture");
  await expect(page.locator("canvas#surface-vista")).toHaveAttribute("aria-hidden", "true");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForFixtureReady(page);
  const firstReload = await deterministicSnapshot(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForFixtureReady(page);
  expect(await deterministicSnapshot(page)).toEqual(firstReload);
  await capture(page, screenshots.exploration);

  await pressFromWorld(page, "q");
  await expectState(page, "Scanner", "key-q-scanner");
  await expect(page.getByText("Scan Reveal · Tier 2")).toBeVisible();
  await capture(page, screenshots.scanner);

  await page.getByTestId("key-escape-exploration").click();
  await page.getByTestId("key-e-interaction").click();
  await expectState(page, "InteractionHold", "key-e-interaction");
  await expect(page.getByText("Hold Progress", { exact: true })).toBeVisible();
  await capture(page, screenshots.interaction);

  await pressFromWorld(page, "r");
  await expectState(page, "HazardWarning", "key-r-hazard");
  await expect(page.getByRole("alert")).toContainText("HZ-RESET-00");
  await pressFromWorld(page, "r");
  await expectState(page, "HazardWarning", "key-r-hazard");
  await expect(page.getByRole("alert")).toContainText("HZ-RESET-00");
  await capture(page, screenshots.hazard);
});

test("every exact key and visible button has equivalent deep deterministic behavior", async ({ page }) => {
  await openFixture(page, 1920, 1080);
  const stateCases = [
    { key: "q", state: "Scanner", testId: "key-q-scanner" },
    { key: "e", state: "InteractionHold", testId: "key-e-interaction" },
    { key: "i", state: "InventoryDetail", testId: "key-i-inventory" },
    { key: "h", state: "MinimalHud", testId: "key-h-minimal" },
    { key: "r", state: "HazardWarning", testId: "key-r-hazard" },
  ] as const;
  for (const stateCase of stateCases) {
    await pressFromWorld(page, "Escape");
    await pressFromWorld(page, stateCase.key);
    await expectState(page, stateCase.state, stateCase.testId);
    await pressFromWorld(page, "Escape");
    await page.getByTestId(stateCase.testId).click();
    await expectState(page, stateCase.state, stateCase.testId);
  }

  await page.getByTestId("key-i-inventory").click();
  await expectState(page, "InventoryDetail", "key-i-inventory");
  const inventory = page.getByTestId("hud-inventory-detail");
  await expect(inventory).toBeVisible();
  await expect(inventory).toContainText("Inventory Detail · Read-only Mock");
  await expect(inventory).toContainText("[LOCKED] No gameplay authority");

  const toolNames = ["Multi-Tool", "Terrain Scanner", "Sample Extractor", "Beacon Launcher", "Repair Applicator"];
  for (let slot = 1; slot <= 5; slot += 1) {
    const toolButton = page.getByTestId(`key-${slot}-tool`);
    await pressFromWorld(page, String(slot));
    await expect(toolButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("active-tool")).toHaveText(toolNames[slot - 1]);
    const otherSlot = slot === 5 ? 1 : slot + 1;
    await page.getByTestId(`key-${otherSlot}-tool`).click();
    await expect(page.getByTestId(`key-${otherSlot}-tool`)).toHaveAttribute("aria-pressed", "true");
    await toolButton.click();
    await expect(page.getByTestId("active-tool")).toHaveText(toolNames[slot - 1]);
  }

  await page.getByTestId("key-5-tool").click();
  await page.getByTestId("key-h-minimal").click();
  await expectState(page, "MinimalHud", "key-h-minimal");
  await expect(page.getByTestId("hud-objective")).toBeHidden();
  await expect(page.getByTestId("hud-radar")).toBeHidden();
  await expect(page.getByTestId("hud-tool-status")).toBeHidden();
  await expect(page.getByTestId("fixture-notice")).toBeVisible();
  await expect(page.getByTestId("hud-suit-status")).toContainText("Health");
  await expect(page.getByTestId("hud-suit-status")).toContainText("Oxygen");
  await expect(page.getByTestId("active-tool")).toHaveText("Repair Applicator");
  await expect(page.getByTestId("hud-toolbelt")).toBeVisible();
  await expect(page.getByTestId("command-controls")).toBeVisible();
  await expect(page.getByText("Seal channel", { exact: true })).toBeHidden();
  await page.getByTestId("detail-toggle").click();
  await expect(page.getByTestId("detail-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Seal channel", { exact: true })).toBeVisible();
  await expect(page.getByText("Thermal margin", { exact: true })).toBeVisible();
  await expect(page.getByTestId("active-tool")).toHaveText("Repair Applicator");

  await pressFromWorld(page, "Escape");
  await expectState(page, "Exploration", "key-escape-exploration");
  await expect(page.getByTestId("detail-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("key-q-scanner").click();
  await page.getByTestId("key-escape-exploration").click();
  await expectState(page, "Exploration", "key-escape-exploration");
});

test("ARIA names, pressed states, focus order, and visible focus are keyboard accessible", async ({ page }) => {
  await openFixture(page, 1920, 1080);
  const namedControls = [
    ["key-escape-exploration", "Escape, close overlays and return to Exploration"],
    ["key-q-scanner", "Key Q, Scanner"],
    ["key-e-interaction", "Key E, Interaction Hold"],
    ["key-r-hazard", "Key R, reset Hazard Scenario"],
    ["key-i-inventory", "Key I, Inventory Detail"],
    ["key-h-minimal", "Key H, toggle Minimal HUD"],
    ["detail-toggle", "Tab, toggle Detail Panels"],
  ] as const;
  for (const [testId, name] of namedControls) {
    await expect(page.getByTestId(testId)).toHaveAccessibleName(name);
    await expect(page.getByTestId(testId)).toHaveAttribute("aria-pressed", /^(true|false)$/);
  }
  const toolNames = ["Multi-Tool", "Terrain Scanner", "Sample Extractor", "Beacon Launcher", "Repair Applicator"];
  for (let slot = 1; slot <= 5; slot += 1) {
    await expect(page.getByTestId(`key-${slot}-tool`)).toHaveAccessibleName(`Key ${slot}, select ${toolNames[slot - 1]}`);
  }

  const root = page.locator("#world-root");
  await root.focus();
  await expect(root).toBeFocused();
  await expect(page.getByTestId("detail-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("detail-toggle")).toHaveAttribute("aria-pressed", "true");
  const expectedSequence = ["key-1-tool", "key-2-tool", "key-3-tool", "key-4-tool", "key-5-tool", "key-escape-exploration", "key-q-scanner"];
  for (const testId of expectedSequence) {
    await expect(page.getByTestId(testId)).toBeFocused();
    if (testId !== expectedSequence.at(-1)) await page.keyboard.press("Tab");
  }

  const scannerButton = page.getByTestId("key-q-scanner");
  const focusStyle = await scannerButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0);
  expect(focusStyle.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
  await capture(page, screenshots.focus);

  await page.getByTestId("key-1-tool").focus();
  await page.keyboard.press("Shift+Tab");
  await expect(root).toBeFocused();
  await expect(page.getByTestId("detail-toggle")).toHaveAttribute("aria-pressed", "true");
});

test("1280x720 is overflow-safe, reachable, and center-clear", async ({ page }) => {
  await openFixture(page, 1280, 720);
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  for (const testId of ["key-escape-exploration", "key-q-scanner", "key-e-interaction", "key-r-hazard", "key-i-inventory", "key-h-minimal", "detail-toggle"]) {
    await expectReachable(page, page.getByTestId(testId));
  }
  await expectNoCenterOverlap(page, [".suit-panel", ".objective-panel", ".radar-panel", ".toolbelt-panel", ".tool-panel", ".state-detail-lane", ".command-deck"]);
  await page.getByTestId("key-i-inventory").click();
  await expectState(page, "InventoryDetail", "key-i-inventory");
  await expectNoCenterOverlap(page, [".state-detail-lane", ".command-deck"]);
  await capture(page, screenshots.responsive);
});

test("reduced motion and a 200 percent equivalent layout remain operable", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The optional page-scale assertion is Chromium-specific");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page, 960, 540);
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const nonZeroMotion = await page.locator("*").evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const durations = `${style.animationDuration},${style.transitionDuration}`.split(",").map((value) => value.trim());
    return durations.some((value) => value !== "0s" && value !== "0ms") ? [element.tagName] : [];
  }));
  expect(nonZeroMotion, "Reduced-motion mode should zero all computed animation and transition durations").toEqual([]);
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  for (const testId of ["key-q-scanner", "key-i-inventory", "key-h-minimal", "detail-toggle", "key-5-tool"]) {
    const control = page.getByTestId(testId);
    await expectReachable(page, control);
    await control.click();
  }
  await expect(page.getByTestId("active-tool")).toHaveText("Repair Applicator");
  await expect(page.getByTestId("detail-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Seal channel", { exact: true })).toBeVisible();
  await expectNoCenterOverlap(page, [".suit-panel", ".state-detail-lane", ".toolbelt-panel", ".command-deck"]);

  await expectReachable(page, page.getByTestId("key-escape-exploration"));
  await page.getByTestId("key-escape-exploration").click();
  await expectState(page, "Exploration", "key-escape-exploration");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(2);
  await expectReachable(page, page.getByTestId("key-escape-exploration"));
  await page.getByTestId("key-escape-exploration").focus();
  await expect(page.getByTestId("key-escape-exploration")).toBeFocused();
  await page.keyboard.press("Enter");
  await expectState(page, "Exploration", "key-escape-exploration");
});
