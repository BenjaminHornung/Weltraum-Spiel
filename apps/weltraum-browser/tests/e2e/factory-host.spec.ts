import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test("T025 normal flight and legacy HVP request no Factory modules", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { requests.push(new URL(request.url()).pathname); });
  await page.goto("/");
  await expect(page.locator("#flight-hud")).toBeVisible();
  await expect(page.locator("#factory-status")).toHaveCount(0);
  expect(requests.filter(url => url.includes("/factory/"))).toEqual([]);
  requests.length = 0;
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await expect(page.locator("#factory-status")).toHaveCount(0);
  expect(requests.filter(url => url.includes("/factory/"))).toEqual([]);
  expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
});

const openFactory = async (page: Page) => {
  await page.goto("/factory.html");
  await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit", { timeout: 20_000 });
};
const readClock = (page: Page) => page.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryClock!));
const evidenceRun = () => {
  const run = process.env.WELTRAUM_FACTORY_EVIDENCE_RUN ?? new Date().toISOString().replaceAll(":", "");
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(run)) throw new Error("Invalid Factory evidence run ID");
  return path.resolve("evidence/factory/w06", run);
};

test.describe.serial("one actual Factory host through normal player actions", () => {
  let context: BrowserContext;
  let page: Page;
  let pausedClock: Awaited<ReturnType<typeof readClock>>;
  test.beforeAll(async ({ browser }, testInfo) => {
    context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    page = await context.newPage();
  });
  test.afterAll(async () => {
    if (!context) return;
    await context.close();
  });
  test("real Factory entry reaches Ready once", async () => {
    await openFactory(page);
    await expect(page.locator("#hvp-hud")).toHaveCount(1); await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("T026 duplicate Factory entry creates no second worker or renderer", async () => {
    const workers = page.workers().length; expect(workers).toBeGreaterThan(0);
    const duplicate = await page.evaluate(async () => {
      const entryPath = "/src/factory/factoryEntry.ts"; const entry = await import(entryPath);
      try { await entry.startFactoryEntry(); return "unexpected second host"; } catch (error) { return String(error); }
    });
    expect(duplicate).toMatch(/already mounted/i); expect(page.workers().length).toBe(workers);
    await expect(page.locator("canvas")).toHaveCount(1); await expect(page.locator("#hvp-hud")).toHaveCount(1);
    await expect(page.locator("#factory-panel")).toHaveCount(1);
  });

  test("T028 native pause preserves clock through presentation frames", async ({}, testInfo) => {
    const errors: string[] = []; page.on("pageerror", error => { errors.push(error.message); });
    await expect.poll(async () => (await readClock(page)).steps).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Werkstatt pausieren", exact: true }).click();
    await expect(page.locator("#factory-status")).toContainText("Pausiert"); const paused = await readClock(page); pausedClock = paused;
    await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    expect(await readClock(page)).toEqual(paused); expect(paused.elapsedMs).toBe(paused.steps * 100);
    expect(paused.remainderTicks).toBeGreaterThanOrEqual(0); expect(paused.remainderTicks).toBeLessThan(6);
    const capture = await page.screenshot(); await testInfo.attach("factory-single-host", { body: capture, contentType: "image/png" });
    const directory = evidenceRun(); await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "factory-single-host.png"), capture);
    await writeFile(path.join(directory, "browser-host-clock.json"), JSON.stringify({ state: paused, errors }, null, 2) + "\n");
    expect(errors).toEqual([]); expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
  });

  test("Factory refuses all legacy persistence paths with an honest reason", async () => {
    for (const id of ["hvp-save", "hvp-load", "hvp-load-new"]) {
      await page.locator(`#${id}`).click(); await expect(page.locator("#hvp-save-status")).toContainText("Factory");
      await expect(page.locator("#hvp-save-status")).toContainText("Rejected");
    }
    await expect(page).toHaveURL(/factory\.html$/);
  });

  test("Factory explicitly resumes the same paused native host", async () => {
    await expect(page.locator("#factory-status")).toContainText("Pausiert");
    expect(await readClock(page)).toEqual(pausedClock);
    const paused = pausedClock;
    await page.getByRole("button", { name: "Werkstatt fortsetzen", exact: true }).click();
    await expect.poll(async () => (await readClock(page)).steps).toBeGreaterThan(paused.steps);
    await expect(page.locator("#hvp-hud")).toHaveCount(1); await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("T027 actual Factory teardown retires projection and native workers", async ({}, testInfo) => {
    page.once("dialog", dialog => { void dialog.accept(); });
    await page.getByRole("button", { name: "Sitzung beenden", exact: true }).click();
    await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");
    await expect(page.locator("#factory-panel")).toHaveCount(0); await expect(page.locator("#hvp-hud")).toHaveCount(0);
    await expect.poll(() => page.workers().length).toBe(0);
    const receipt = await page.evaluate(() => {
      if (document.body.dataset.hestiaFactoryClock !== undefined) throw new Error("Disposed Factory projection survived");
      return JSON.parse(document.body.dataset.hestiaPrototypeDisposal!);
    });
    expect(receipt.state).toBe("Disposed"); expect(receipt.errors).toEqual([]);
    for (const name of ["workers", "timers", "listeners", "pendingJobs", "bodies", "colliders", "ownedBytes"]) expect(receipt.disposed[name], name).toBe(0);
    await testInfo.attach("factory-host-disposal", { body: JSON.stringify(receipt), contentType: "application/json" });
    const directory = evidenceRun(); await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "browser-host-disposal.json"), JSON.stringify(receipt, null, 2) + "\n");
  });

});
