import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";
import {
  engageVisiblePreview,
  previewVisibleRoute,
  selectVisiblePlannerProfile,
  selectVisiblePlannerTarget
} from "./support/plannerWorkflow";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const storageKey = "weltraum.browser.graphics-settings";

interface BrowserFailures {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly errorResponses: string[];
}

function collectBrowserFailures(page: Page): BrowserFailures {
  const failures: BrowserFailures = { consoleErrors: [], pageErrors: [], failedRequests: [], errorResponses: [] };
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(`${message.text()} ${message.location().url}`.trim());
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => failures.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.errorResponses.push(`${response.status()} ${response.url()}`);
  });
  return failures;
}

function expectNoBrowserFailures(failures: BrowserFailures): void {
  expect(failures, "Unexpected browser console, page, or network failures").toEqual({
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: []
  });
}

async function waitForGraphicsRuntime(page: Page): Promise<void> {
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("body")).toHaveAttribute("data-graphics-settings-ready", "true");
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
}

async function openGraphicsSettings(page: Page): Promise<void> {
  await page.getByTestId("graphics-settings-open").click();
  await expect(page.getByTestId("graphics-settings-dialog")).toBeVisible();
  await expect(page.locator("#flight-hud")).toHaveAttribute("data-flight-input-blocked", "true");
}

async function applyGraphicsSettings(page: Page): Promise<void> {
  await page.getByTestId("graphics-apply").click();
  await expect(page.getByTestId("graphics-settings-dialog")).toHaveAttribute("data-last-apply", "Success");
  await expect(page.getByTestId("graphics-pending-state")).toHaveAttribute("data-state", "Applied");
}

async function waitFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, count);
}

test("normal graphics settings flow applies, persists, cancels, resets, and captures runtime evidence", async ({ page }) => {
  test.setTimeout(ciTimeout(65_000, 150_000));
  mkdirSync(evidenceDirectory, { recursive: true });
  const failures = collectBrowserFailures(page);
  await page.setViewportSize({ width: 1_920, height: 1_080 });
  await page.goto("/");
  await waitForGraphicsRuntime(page);
  await openGraphicsSettings(page);

  const dialog = page.getByTestId("graphics-settings-dialog");
  await expect(dialog).toHaveAttribute("role", "dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("High");
  await page.getByTestId("graphics-preset-high").focus();
  await page.screenshot({ path: path.join(evidenceDirectory, "graphics-settings-panel-1920x1080.png") });

  const idleState = await page.locator("#throttle-status, #velocity-status, #fuel-status, #status, #target-distance").allTextContents();
  await page.keyboard.press("y");
  await waitFrames(page, 5);
  expect(await page.locator("#throttle-status, #velocity-status, #fuel-status, #status, #target-distance").allTextContents()).toEqual(idleState);

  const focusable = dialog.locator("button:enabled, input:enabled, select:enabled");
  await focusable.last().focus();
  await page.keyboard.press("Tab");
  await expect(focusable.first()).toBeFocused();

  await page.getByTestId("graphics-preset-low").click();
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("Low");
  await expect(page.getByTestId("graphics-pending-state")).toHaveAttribute("data-state", "Pending");
  await applyGraphicsSettings(page);
  await expect(dialog).toBeVisible();
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-preset", "Low");
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-render-scale", "0.65");
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-fov", "58");
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-render-distance", "1500");
  await expect(page.getByTestId("graphics-restart-state")).toHaveAttribute("data-required", "true");
  expect(await page.locator("#throttle-status, #velocity-status, #fuel-status, #status, #target-distance").allTextContents()).toEqual(idleState);
  const canvasScale = await page.locator("#debug-scene").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    return { x: element.width / element.clientWidth, y: element.height / element.clientHeight };
  });
  expect(canvasScale.x).toBeCloseTo(0.65, 2);
  expect(canvasScale.y).toBeCloseTo(0.65, 2);
  await page.getByTestId("graphics-cancel").click();
  await openGraphicsSettings(page);
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("Low");
  await waitFrames(page, 3);
  await page.screenshot({ path: path.join(evidenceDirectory, "graphics-settings-low-preset-1920x1080.png") });

  const storedLow = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
  expect(storedLow).toContain('"qualityPreset":"Low"');
  await page.reload();
  await waitForGraphicsRuntime(page);
  await openGraphicsSettings(page);
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("Low");
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-antialias-applied", "false");
  await expect(page.getByTestId("graphics-restart-state")).toHaveAttribute("data-required", "false");

  const lowRuntimeBeforeReset = await page.locator("#debug-scene").getAttribute("data-graphics-preset");
  await page.getByTestId("graphics-reset").click();
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("High");
  await expect(page.getByTestId("graphics-pending-state")).toHaveAttribute("data-state", "Pending");
  expect(await page.locator("#debug-scene").getAttribute("data-graphics-preset")).toBe(lowRuntimeBeforeReset);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(storedLow);
  await page.getByTestId("graphics-cancel").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#flight-hud")).not.toHaveAttribute("data-flight-input-blocked", "true");
  await openGraphicsSettings(page);
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("Low");

  await page.getByTestId("graphics-preset-high").click();
  await applyGraphicsSettings(page);
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-preset", "High");
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-render-scale", "1");
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-render-distance", "5000");
  await expect(page.getByTestId("graphics-restart-state")).toHaveAttribute("data-required", "true");
  await expect(page.getByTestId("graphics-shadows")).toBeDisabled();
  await expect(page.getByTestId("graphics-bloom")).toBeDisabled();
  await expect(page.getByTestId("graphics-motion-effects")).toBeDisabled();
  await expect(page.getByTestId("graphics-vsync-status")).toContainText("Browsergesteuert");
  await expect(page.locator("[data-capability-for='fullscreen']")).toHaveAttribute("data-capability-status", "BrowserManaged");
  await expect(page.getByTestId("graphics-fullscreen")).toBeEnabled();

  await page.getByTestId("graphics-render-scale").fill("0.8");
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("Custom");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await openGraphicsSettings(page);
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("High");
  await page.getByTestId("graphics-cancel").click();
  await page.keyboard.press("y");
  await expect(page.locator("#throttle-status")).toContainText("100%");
  expectNoBrowserFailures(failures);
});

test("captures High runtime evidence after a persisted Low renderer startup", async ({ page }) => {
  test.setTimeout(ciTimeout(35_000, 90_000));
  mkdirSync(evidenceDirectory, { recursive: true });
  const failures = collectBrowserFailures(page);
  await page.setViewportSize({ width: 1_920, height: 1_080 });
  await page.goto("/");
  await waitForGraphicsRuntime(page);
  await openGraphicsSettings(page);
  await page.getByTestId("graphics-preset-low").click();
  await applyGraphicsSettings(page);
  await page.reload();
  await waitForGraphicsRuntime(page);
  await openGraphicsSettings(page);
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-antialias-applied", "false");
  await page.getByTestId("graphics-preset-high").click();
  await applyGraphicsSettings(page);
  await expect(page.getByTestId("graphics-restart-state")).toHaveAttribute("data-required", "true");
  await page.getByTestId("graphics-cancel").click();
  await openGraphicsSettings(page);
  await expect(page.getByTestId("graphics-preset-current")).toHaveText("High");
  await waitFrames(page, 3);
  await page.screenshot({ path: path.join(evidenceDirectory, "graphics-settings-high-preset-1920x1080.png") });
  expectNoBrowserFailures(failures);
});

test("normal locked-route UI preserves the active plan while live presentation settings change", async ({ page }) => {
  test.setTimeout(ciTimeout(45_000, 120_000));
  const failures = collectBrowserFailures(page);
  await page.setViewportSize({ width: 1_640, height: 900 });
  await page.goto("/");
  await waitForGraphicsRuntime(page);

  await selectVisiblePlannerTarget(page, "range-2500m", "Range 2500m");
  await selectVisiblePlannerProfile(page, "Balanced");
  const lockedHash = await previewVisibleRoute(page);
  await engageVisiblePreview(page, lockedHash);
  await expect(page.getByTestId("autopilot-active")).toContainText(/Autopilot executing|Arrived at selected target/);
  await page.locator("#open-navigation-planner").click();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", lockedHash);
  await expect(page.locator("#planner-route-detail")).toContainText(lockedHash);
  await page.locator("#planner-close").click();

  await openGraphicsSettings(page);
  await page.getByTestId("graphics-fov").fill("64");
  await applyGraphicsSettings(page);
  await expect(page.locator("#debug-scene")).toHaveAttribute("data-graphics-fov", "64");
  await page.getByTestId("graphics-cancel").click();
  await page.locator("#open-navigation-planner").click();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", lockedHash);
  await expect(page.locator("#planner-route-detail")).toContainText(lockedHash);
  await expect(page.getByTestId("autopilot-active")).toContainText(/Autopilot executing|Arrived at selected target/);
  await expect(page.locator("#fuel-status")).toContainText(/kg/);
  await expect(page.getByTestId("velocity-status")).toContainText(/m\/s/);
  expectNoBrowserFailures(failures);
});
