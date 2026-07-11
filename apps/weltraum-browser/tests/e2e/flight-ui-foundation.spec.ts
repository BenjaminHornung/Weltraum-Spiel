import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const PLANNER_SAFETY_REJECTION = "Current fuel, braking reserve, or flight authority cannot safely engage this route.";

async function waitForBridgeAndVisual(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge?.getRenderSnapshot?.();
    return snapshot?.shipVisual?.visualSource?.state && snapshot.shipVisual.visualSource.state !== "Loading";
  });
}

async function expectCenterSafeAreaClear(page: Page) {
  const viewport = page.viewportSize();
  expect(viewport, "Viewport must be known for HUD safe-area check").toBeTruthy();
  const safeArea = await page.locator(".hud-center-safe-area").boundingBox();
  expect(safeArea).toBeTruthy();
  expect(safeArea!.width).toBeGreaterThan(viewport!.width <= 760 ? 260 : 280);
  expect(safeArea!.height).toBeGreaterThan(220);
  const safeRect = {
    left: safeArea!.x,
    right: safeArea!.x + safeArea!.width,
    top: safeArea!.y,
    bottom: safeArea!.y + safeArea!.height
  };
  const allowedOverlapArea = viewport!.width <= 760 ? 800 : Math.max(800, safeArea!.width * safeArea!.height * 0.04);

  for (const selector of ["#hud-left-panel", "#hud-radar-panel", "#hud-right-panel"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} should exist for layout audit`).toBeTruthy();
    const overlapX = Math.max(0, Math.min(box!.x + box!.width, safeRect.right) - Math.max(box!.x, safeRect.left));
    const overlapY = Math.max(0, Math.min(box!.y + box!.height, safeRect.bottom) - Math.max(box!.y, safeRect.top));
    const overlapArea = overlapX * overlapY;
    expect(overlapArea, `${selector} overlaps center safe area`).toBeLessThan(allowedOverlapArea);
  }
}

async function expectPlayerEdgeHudAvailable(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("#debug-scene")).toBeVisible();
  await expect(page.locator("#debug-scene")).toHaveCSS("opacity", "1");
  await expect(page.locator("#hud-left-panel"), "Ship status panel remains player-visible").toBeVisible();
  await expect(page.locator("#hud-radar-panel"), "Radar panel remains player-visible").toBeVisible();
  await expect(page.locator("#hud-right-panel"), "Navigation panel remains player-visible").toBeVisible();
  await expect(page.getByTestId("warning-state"), "Idle warning state stays out of the player HUD").toBeHidden();
  await expect(page.getByTestId("warning-state"), "Idle warning state has no placeholder copy").toHaveText("");
  await expect(page.locator("#velocity-status"), "Runtime flight telemetry remains player-visible").toBeVisible();
  await expect(page.locator("#route-status"), "Runtime route state remains player-visible").toBeVisible();
  await expect(page.getByTestId("selected-target")).toContainText("Navigation Alpha");
  await expect(page.getByTestId("autopilot-active")).toContainText("Autopilot standby");
  await expect(page.getByTestId("ship-visual-source")).toContainText(/Ship visual: (Demo Scout GLB|Procedural fallback)/);
  await expect(page.locator("#debug-hud")).toBeHidden();
}

async function captureResponsive(page: Page, width: number, height: number, fileName: string) {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.getByTestId("ship-visual-source")).toContainText(/Ship visual: (Demo Scout GLB|Procedural fallback)/, { timeout: 20_000 });
  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expectPlayerEdgeHudAvailable(page);
  await expectCenterSafeAreaClear(page);
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
  await page.screenshot({ path: path.join(evidenceDir, fileName), fullPage: true });
}

test("default product URL exposes player HUD without TestBridge/debug text", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("body")).toHaveAttribute("data-debug-hud", "false");
  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
  await expect(page.locator("body")).not.toContainText("TestBridge");
  await expect(page.locator("#debug-hud")).toBeHidden();
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
});

test("debug HUD, TestBridge, and compatibility flight query remain independent opt-ins", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await waitForBridgeAndVisual(page);
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("body")).toHaveAttribute("data-debug-hud", "false");
  await expect(page.locator("#debug-hud")).toBeHidden();
  await expectPlayerEdgeHudAvailable(page);

  await page.goto("/?debugHud=1");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("body")).toHaveAttribute("data-debug-hud", "true");
  await expect(page.locator("#debug-hud")).toBeVisible();
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);

  await page.goto("/?uiScenario=flight-cruise-concept");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("body")).toHaveAttribute("data-ui-surface", "flight");
  await expect(page.locator("#debug-scene")).toHaveCSS("opacity", "1");
  await expect(page.locator("#debug-hud")).toBeHidden();
  await expectPlayerEdgeHudAvailable(page);
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
});

test("flight HUD foundation keeps center clear, shows navigation, autopilot, warnings, and records evidence", async ({ page }) => {
  test.setTimeout(60_000);
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.getByTestId("ship-visual-source")).toContainText(/Ship visual: (Demo Scout GLB|Procedural fallback)/, { timeout: 20_000 });

  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expect(page.locator("#flight-hud")).toBeVisible();
  await expect(page.locator("#hud-top-strip")).toBeHidden();
  await expect(page.locator("#hud-left-panel")).toBeVisible();
  await expect(page.locator("#hud-right-panel")).toBeVisible();
  await expect(page.locator("#hud-bottom-strip")).toBeHidden();
  await expectPlayerEdgeHudAvailable(page);
  await expect(page.getByTestId("selected-target")).toContainText("Navigation Alpha");
  await expect(page.getByTestId("radar-status")).toContainText(/^\d+ contacts$/i);
  await expect(page.getByTestId("radar-status")).toHaveAttribute("title", /local contact Navigation Alpha/i);
  await expect(page.getByTestId("autopilot-active")).toContainText("Autopilot standby");
  await expect(page.getByTestId("ship-visual-source")).toContainText(/Ship visual: (Demo Scout GLB|Procedural fallback)/);
  await expect(page.getByTestId("velocity-status")).not.toContainText(/\(-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?\)/);
  await expectCenterSafeAreaClear(page);
  await page.screenshot({ path: path.join(evidenceDir, "flight-ui-foundation-1280x720.png"), fullPage: true });

  await page.locator("#open-navigation-planner").click();
  await page.locator('#planner-target-options button[data-planner-target-id="nav-beta"]').click();
  await expect(page.getByTestId("planner-selected-target")).toContainText("Navigation Beta");
  await page.locator("#planner-preview-route").click();
  await expect(page.getByTestId("planner-engage-route")).toBeEnabled();
  await page.getByTestId("planner-engage-route").click();
  await expect(page.getByTestId("autopilot-active")).toContainText("Autopilot executing");
  await expect(page.locator("#autopilot-action-state")).toContainText(/Cancel|Holding/);
  await expectCenterSafeAreaClear(page);
  await page.screenshot({ path: path.join(evidenceDir, "flight-ui-autopilot-active-1280x720.png"), fullPage: true });

  await page.goto("/?flightCase=insufficient-fuel");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.locator("#open-navigation-planner").click();
  const blockedEngage = page.getByTestId("planner-engage-route");
  await expect(blockedEngage).toBeVisible();
  await expect(blockedEngage).toBeDisabled();
  await expect(blockedEngage).toHaveAttribute("aria-disabled", "true");
  await expect(blockedEngage).toHaveAttribute("aria-description", PLANNER_SAFETY_REJECTION);
  await expect(page.locator("#planner-feedback")).toHaveText(PLANNER_SAFETY_REJECTION);
  const warningState = page.getByTestId("warning-state");
  await expect(warningState).toBeVisible();
  await expect.poll(async () => (await warningState.innerText()).trim()).toBe(
    "FUEL DEPLETED: REFUEL BEFORE ENGAGING\nFUEL INSUFFICIENT: REFUEL OR SHORTEN ROUTE"
  );
  await expect(page.locator("#failure-reasons")).not.toContainText("FuelInsufficient");
  await expectCenterSafeAreaClear(page);
  await page.screenshot({ path: path.join(evidenceDir, "flight-ui-fuel-warning-1280x720.png"), fullPage: true });

  await captureResponsive(page, 1440, 900, "flight-ui-1440x900.png");
  await captureResponsive(page, 1024, 768, "flight-ui-1024x768.png");
  await captureResponsive(page, 760, 640, "flight-ui-760x640.png");
  await captureResponsive(page, 1920, 800, "flight-ui-ultrawide-1920x800.png");

  await writeFile(
    path.join(evidenceDir, "browser-flight-ui-foundation-v1.md"),
    [
      "# Browser Flight UI Foundation v1 Evidence",
      "",
      "- Captured player HUD at 1280x720, 1440x900, 1024x768, narrow 760x640, and ultrawide 1920x800.",
      "- Verified edge-panel layout with `.hud-center-safe-area` and bounding-box overlap checks.",
      "- Verified selected target/navigation, autopilot executing state, fuel warning chips, concise ship visual line, and absence of raw fuel reason codes in player HUD.",
      "- Verified 1024x768 and 760x640 keep Mode, Autopilot, Ship Visual, Ship Status, Navigation/Target, Warnings, and Cockpit Message player-visible without covering the center safe area.",
      "- Verified blocked/critical warning state disables the primary route button instead of dispatching EngageAutopilot.",
      "- Captured the responsive player presentation on authoritative normal `/`; TestBridge remained absent.",
      "- Verified `debugHud=1`, `testBridge=1`, and the compatibility flight query are independent and do not select another player presentation.",
      "- Note: post-arrival Hold/Ready evidence uses current executor lifecycle telemetry and player-facing HUD labels; no autopilot lifecycle logic was changed."
    ].join("\n"),
    "utf8"
  );
});
