import { expect, test, type Locator, type Page } from "@playwright/test";
import { ciTimeout } from "./support/ciTiming";
import {
  currentVisiblePreviewHash,
  engageVisiblePreview,
  openVisiblePlanner,
  PREVIEW_HASH_PATTERN,
  previewVisibleRoute,
  readVisiblePreviewHash,
  selectVisiblePlannerProfile,
  selectVisiblePlannerTarget
} from "./support/plannerWorkflow";

async function waitFrames(page: Page, frameCount: number): Promise<void> {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, frameCount);
}

async function waitForNormalFlight(page: Page): Promise<void> {
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("body")).toHaveAttribute("data-debug-hud", "false");
  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expect(page.locator("#debug-hud")).toBeHidden();
  await expect(page.locator("#debug-scene")).toHaveCSS("opacity", "1");
}

async function expectNoTestBridge(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
  await expect(page.locator("body")).not.toContainText("TestBridge");
}

async function openPlanner(page: Page): Promise<Locator> {
  const openButton = page.locator("#open-navigation-planner");
  await expect(openButton, "Normal flight HUD must expose the functional planner entry point").toBeVisible();
  const legacyEngage = page.locator("#engage-autopilot");
  if (await legacyEngage.isVisible()) {
    const [openBox, engageBox] = await Promise.all([openButton.boundingBox(), legacyEngage.boundingBox()]);
    expect(openBox).toBeTruthy();
    expect(engageBox).toBeTruthy();
    const overlapWidth = Math.max(0, Math.min(openBox!.x + openBox!.width, engageBox!.x + engageBox!.width) - Math.max(openBox!.x, engageBox!.x));
    const overlapHeight = Math.max(0, Math.min(openBox!.y + openBox!.height, engageBox!.y + engageBox!.height) - Math.max(openBox!.y, engageBox!.y));
    expect(overlapWidth * overlapHeight, "Legacy Engage must not cover the functional planner entry point").toBe(0);
  }
  const planner = await openVisiblePlanner(page);
  await expect(planner).toHaveAttribute("role", "dialog");
  await expect(planner).toHaveAttribute("aria-modal", "true");
  return planner;
}

async function choosePlannerTarget(page: Page, targetId: string, label: string): Promise<void> {
  await selectVisiblePlannerTarget(page, targetId, label);
  await expect(page.getByTestId("planner-route-status")).toContainText(/preview ready/i);
}

interface ProfileEvidence {
  readonly profile: "Safe" | "Balanced" | "Fast";
  readonly hash: string;
  readonly metrics: string;
  readonly timeline: string;
}

async function chooseProfile(page: Page, profile: ProfileEvidence["profile"]): Promise<ProfileEvidence> {
  const hash = await selectVisiblePlannerProfile(page, profile);
  for (const other of ["Safe", "Balanced", "Fast"].filter((candidate) => candidate !== profile)) {
    await expect(page.locator(`#planner-profile-${other.toLowerCase()}`)).toHaveAttribute("aria-pressed", "false");
  }

  const metrics = (await page.locator("#planner-metric-route").innerText()).trim();
  const timeline = (await page.locator("#planner-timeline").innerText()).trim();
  expect(metrics).toContain(profile);
  expect(metrics).toContain(hash);
  expect(timeline).toMatch(/m\/s/i);
  await expect(page.locator("#planner-route-detail")).toContainText(hash);
  return { profile, hash, metrics, timeline };
}

function distanceInMetres(text: string): number {
  const match = text.match(/([\d.]+)\s*(km|m)\b/i);
  if (!match) {
    throw new Error(`Missing visible route distance: ${text}`);
  }
  const value = Number(match[1]);
  return match[2].toLowerCase() === "km" ? value * 1_000 : value;
}

async function visibleDistance(page: Page): Promise<number> {
  return distanceInMetres((await page.locator("#target-distance").innerText()).trim());
}

test("normal runtime executes the authoritative target-profile-preview-replan-engage workflow", async ({ page }) => {
  test.setTimeout(ciTimeout(55_000, 150_000));
  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto("/");
  await waitForNormalFlight(page);
  await expectNoTestBridge(page);

  await openPlanner(page);
  await choosePlannerTarget(page, "range-2500m", "Range 2500m");

  const profiles = [
    await chooseProfile(page, "Safe"),
    await chooseProfile(page, "Balanced"),
    await chooseProfile(page, "Fast")
  ];
  expect(new Set(profiles.map((entry) => entry.hash)).size, "Each speed profile should produce visible plan data").toBe(3);
  expect(new Set(profiles.map((entry) => entry.metrics)).size).toBe(3);
  expect(new Set(profiles.map((entry) => entry.timeline)).size).toBeGreaterThan(1);

  const previewHash = await previewVisibleRoute(page);
  await expect(page.locator("#planner-route-detail")).toContainText(previewHash);

  await waitFrames(page, 2);
  await page.locator("#planner-replan-route").click();
  await expect.poll(() => currentVisiblePreviewHash(page)).not.toBe(previewHash);
  const replannedHash = await readVisiblePreviewHash(page);
  await expect(page.locator("#planner-route-detail")).toContainText(replannedHash);
  await expect(page.locator("#planner-feedback")).toContainText(/replanned/i);

  const immediatelyVisibleHash = await readVisiblePreviewHash(page);
  expect(immediatelyVisibleHash).toBe(replannedHash);
  await engageVisiblePreview(page, immediatelyVisibleHash);

  await expect(page.getByTestId("navigation-planner")).toBeHidden();
  await expect(page.locator("#open-navigation-planner")).toBeFocused();
  await expect(page.getByTestId("autopilot-active")).toContainText(/Autopilot executing|Arrived at selected target/);
  await expect(page.locator("#route-status")).toContainText(/Autopilot active|Holding at target/i);
  await expect(page.locator("#route-status")).toHaveAttribute("title", /locked route valid|holding at target/i);

  await page.keyboard.down("w");
  await waitFrames(page, 2);
  await page.locator("#open-navigation-planner").click();
  await page.keyboard.up("w");
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", immediatelyVisibleHash);
  await expect(page.locator("#planner-route-detail")).toContainText(immediatelyVisibleHash);
  await expect(page.getByTestId("planner-route-status")).toContainText(/executor (Executing|Arrived)/i);
  await expect(page.locator("#planner-lock-reason")).toBeVisible();
  await expect(page.locator("#planner-lock-reason")).toContainText("Cancel the locked route");

  for (const selector of [
    "#planner-profile-safe",
    "#planner-profile-balanced",
    "#planner-profile-fast",
    "#planner-preview-route",
    "#planner-replan-route",
    "#planner-engage-route"
  ]) {
    await expect(page.locator(selector)).toBeDisabled();
    await expect(page.locator(selector)).toHaveAttribute("aria-disabled", "true");
  }
  for (const target of await page.locator("#planner-target-options button").all()) {
    await expect(target).toBeDisabled();
  }

  const distanceBefore = await visibleDistance(page);
  await expect.poll(() => visibleDistance(page), { timeout: 15_000, intervals: [250, 500, 750] }).toBeLessThan(distanceBefore - 1);
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", immediatelyVisibleHash);
});

test("Escape, Close, focus trap, and keyboard map controls preserve route and view state", async ({ page }) => {
  test.setTimeout(ciTimeout(45_000, 135_000));
  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto("/");
  await waitForNormalFlight(page);
  await expectNoTestBridge(page);

  const planner = await openPlanner(page);
  await choosePlannerTarget(page, "range-1000m", "Range 1000m");
  await chooseProfile(page, "Balanced");
  const preservedHash = await readVisiblePreviewHash(page);

  for (const selector of ["#debug-scene", ".hud-center-safe-area", "#hud-left-panel", "#hud-right-panel", "#debug-hud"]) {
    await expect(page.locator(selector)).toHaveAttribute("inert", "");
  }

  const focusable = planner.locator("button:enabled");
  expect(await focusable.count()).toBeGreaterThan(2);
  await focusable.last().focus();
  await page.keyboard.press("Tab");
  await expect(focusable.first()).toBeFocused();
  await focusable.first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(focusable.last()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(planner).toBeHidden();
  await expect(page.locator("#open-navigation-planner")).toBeFocused();
  await openPlanner(page);
  expect(await readVisiblePreviewHash(page)).toBe(preservedHash);
  await page.locator("#planner-close").click();
  await expect(planner).toBeHidden();
  await expect(page.locator("#open-navigation-planner")).toBeFocused();

  await openPlanner(page);
  expect(await readVisiblePreviewHash(page)).toBe(preservedHash);
  const svg = page.locator("#planner-route-svg");
  const initialTransform = await svg.getAttribute("data-map-transform");
  await expect(svg).toHaveAttribute("data-zoom", "1");

  const orbit = page.locator("#planner-map-orbit");
  await orbit.focus();
  await page.keyboard.press("Enter");
  await expect(orbit).toHaveAttribute("aria-pressed", "true");
  await expect(svg).toHaveAttribute("data-orbit", "ship-up");
  expect(await svg.getAttribute("data-map-transform")).not.toBe(initialTransform);

  const zoom = page.locator("#planner-map-zoom");
  await zoom.focus();
  await page.keyboard.press("Enter");
  await expect(svg).toHaveAttribute("data-zoom", "1.25");
  const retainedTransform = await svg.getAttribute("data-map-transform");
  await waitFrames(page, 30);
  await expect(svg).toHaveAttribute("data-zoom", "1.25");
  await expect(svg).toHaveAttribute("data-orbit", "ship-up");
  await expect(svg).toHaveAttribute("data-map-transform", retainedTransform!);

  await page.keyboard.press("Enter");
  await expect(svg).toHaveAttribute("data-zoom", "1.6");
  await page.keyboard.press("Enter");
  await expect(svg).toHaveAttribute("data-zoom", "1");
  await page.keyboard.press("Enter");
  await expect(svg).toHaveAttribute("data-zoom", "1.25");

  const focus = page.locator("#planner-map-focus");
  await focus.focus();
  await page.keyboard.press("Enter");
  await expect(svg).toHaveAttribute("data-zoom", "1");
  expect(await readVisiblePreviewHash(page)).toBe(preservedHash);
});

test("explicit TestBridge instrumentation preserves exact lock and terminal hashes while planner gates input", async ({ page }) => {
  test.setTimeout(55_000);
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await waitForNormalFlight(page);
  await expect(page.locator("#debug-hud")).toBeHidden();

  await openPlanner(page);
  await choosePlannerTarget(page, "range-500m", "Range 500m");
  await chooseProfile(page, "Fast");
  const previewHash = await previewVisibleRoute(page);
  await page.locator("#planner-replan-route").click();
  await expect.poll(() => currentVisiblePreviewHash(page)).not.toBe(previewHash);
  const exactVisibleHash = await readVisiblePreviewHash(page);
  await engageVisiblePreview(page, exactVisibleHash);

  const locked = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(locked.routePreview?.plan?.planHash).toBe(exactVisibleHash);
  expect(locked.lockedPlan?.planHash).toBe(exactVisibleHash);
  expect(locked.executor.planHash).toBe(exactVisibleHash);
  expect(await page.evaluate(() => (window as any).TestBridge.getPlanHash())).toBe(exactVisibleHash);

  await page.keyboard.down("w");
  await expect.poll(() => page.evaluate(() => {
    const input = (window as any).TestBridge.getTelemetry().manualInput;
    return Math.hypot(input.rotationCommand.x, input.rotationCommand.y, input.rotationCommand.z);
  })).toBeGreaterThan(0);
  await page.locator("#open-navigation-planner").click();
  await expect.poll(() => page.evaluate(() => {
    const input = (window as any).TestBridge.getTelemetry().manualInput;
    return Math.hypot(input.translationCommand.x, input.translationCommand.y, input.translationCommand.z,
      input.rotationCommand.x, input.rotationCommand.y, input.rotationCommand.z);
  })).toBe(0);
  await page.keyboard.up("w");

  const whileOpen = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().executor.tick), { timeout: 5_000 }).toBeGreaterThan(whileOpen.executor.tick);
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().executor.distanceToTarget), { timeout: 10_000 }).toBeLessThan(whileOpen.executor.distanceToTarget);
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  await expect(page.getByTestId("planner-engage-route")).toBeDisabled();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", exactVisibleHash);

  await page.locator("#planner-close").click();
  const terminal = await page.evaluate(() => {
    let telemetry = (window as any).TestBridge.getTelemetry();
    for (let index = 0; index < 1_600 && telemetry.executor.status !== "Arrived"; index += 1) {
      telemetry = (window as any).TestBridge.step(1);
    }
    return telemetry;
  });
  expect(terminal.executor.status).toBe("Arrived");
  expect(terminal.executor.planHash).toBeNull();
  expect(terminal.executor.completedPlanHash).toBe(exactVisibleHash);
  expect(terminal.lockedPlan).toBeNull();
  expect(terminal.routePreview?.plan?.planHash).toBe(exactVisibleHash);
});

test("hash-mismatch Engage fails visibly, remains modal, and focuses the inline live error", async ({ page }) => {
  test.setTimeout(ciTimeout(30_000, 90_000));
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await waitForNormalFlight(page);

  await openPlanner(page);
  await choosePlannerTarget(page, "range-1000m", "Range 1000m");
  await chooseProfile(page, "Balanced");
  const originalHash = await readVisiblePreviewHash(page);

  await page.evaluate(() => (window as any).TestBridge.dispatchCommand({ type: "CancelAutopilot" }));
  await expect(page.getByTestId("planner-engage-route")).toBeDisabled();
  await expect(page.locator("#planner-route-detail")).toContainText(/stale/i);
  await expect(page.getByTestId("planner-engage-route")).toHaveAttribute("aria-description", /stale|preview or replan/i);
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", originalHash);

  await previewVisibleRoute(page);
  await expect(page.getByTestId("planner-engage-route")).toBeEnabled();
  const hashRenderedIntoEngage = await readVisiblePreviewHash(page);

  const mismatch = await page.evaluate(() => {
    const bridge = (window as any).TestBridge;
    const result = bridge.dispatchCommand({ type: "SetRouteProfile", profile: "Fast" });
    const currentHash = result.telemetry.routePreview?.plan?.planHash ?? null;
    (document.getElementById("planner-engage-route") as HTMLButtonElement).click();
    return { currentHash, lockedPlanHash: bridge.getTelemetry().lockedPlan?.planHash ?? null };
  });

  expect(mismatch.currentHash).toMatch(PREVIEW_HASH_PATTERN);
  expect(mismatch.currentHash).not.toBe(hashRenderedIntoEngage);
  expect(mismatch.lockedPlanHash).toBeNull();
  await expect(page.getByTestId("navigation-planner")).toBeVisible();
  const feedback = page.locator("#planner-feedback");
  await expect(feedback).toHaveAttribute("role", "alert");
  await expect(feedback).toContainText(/visible route changed|review the current preview/i);
  await expect(feedback).toBeFocused();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().executor.planHash)).toBeNull();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().lockedPlan)).toBeNull();
});
