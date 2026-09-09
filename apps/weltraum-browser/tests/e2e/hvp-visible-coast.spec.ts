import { expect, test } from "@playwright/test";
import path from "node:path";

const screenshotPath = path.resolve(process.cwd(), "evidence/hvp-visible-coast-1920x1080.png");
const focusedCommand = "npx playwright test tests/e2e/hvp-visible-coast.spec.ts --reporter=list";

test.use({ viewport: { width: 1920, height: 1080 } });

test("HVP-01 visible coast reaches Ready through the real UI", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => requestFailures.push(request.url()));

  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-hud")).toBeVisible();
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await expect(page.locator("#debug-scene")).toHaveAttribute("aria-label", "HVP-01 visible coast viewport");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-state", "Ready");
  await expect(page.locator("#hvp-detail")).toContainText("Terrain faces:");
  await expect(page.locator("#hvp-failure")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath });

  expect(consoleErrors, `console errors (${focusedCommand})`).toEqual([]);
  expect(pageErrors, `page errors (${focusedCommand})`).toEqual([]);
  expect(requestFailures, `request failures (${focusedCommand})`).toEqual([]);
});

test("HVP-01 camera presets switch through real buttons", async ({ page }) => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });

  await page.getByRole("button", { name: "C01-EYE" }).click();
  await expect(page.locator("#hvp-mode")).toContainText("C01-EYE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C01-EYE");

  await page.getByRole("button", { name: "C04-WIDE" }).click();
  await expect(page.locator("#hvp-mode")).toContainText("C04-WIDE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C04-WIDE");
});

test("existing routes stay untouched and combined queries resolve to Surface Lab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#flight-hud")).toBeVisible();
  await expect(page.locator("#hvp-hud")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);

  await page.goto("/?surfaceLab=1&hestiaPrototype=1");
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab", "1");
  await expect(page.locator("#hvp-hud")).toHaveCount(0);
});
