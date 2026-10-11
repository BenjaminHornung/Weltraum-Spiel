# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-host.spec.ts >> one actual Factory host through normal player actions >> real Factory entry reaches Ready once
- Location: tests/e2e/factory-host.spec.ts:46:3

# Error details

```
Error: tracing.start: Tracing has been already started
```

```
Error: apiRequestContext._wrapApiCall: Must start tracing before stopping
```

# Test source

```ts
  1   | import { expect, test, type BrowserContext, type Page } from "@playwright/test";
  2   | import { mkdir, writeFile } from "node:fs/promises";
  3   | import path from "node:path";
  4   |
  5   | test("T025 normal flight and legacy HVP request no Factory modules", async ({ page }) => {
  6   |   const requests: string[] = [];
  7   |   page.on("request", request => { requests.push(new URL(request.url()).pathname); });
  8   |   await page.goto("/");
  9   |   await expect(page.locator("#flight-hud")).toBeVisible();
  10  |   await expect(page.locator("#factory-status")).toHaveCount(0);
  11  |   expect(requests.filter(url => url.includes("/factory/"))).toEqual([]);
  12  |   requests.length = 0;
  13  |   await page.goto("/?hestiaPrototype=1");
  14  |   await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  15  |   await expect(page.locator("#factory-status")).toHaveCount(0);
  16  |   expect(requests.filter(url => url.includes("/factory/"))).toEqual([]);
  17  |   expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
  18  | });
  19  |
  20  | const openFactory = async (page: Page) => {
  21  |   await page.goto("/factory.html");
  22  |   await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit", { timeout: 20_000 });
  23  | };
  24  | const readClock = (page: Page) => page.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryClock!));
  25  | const evidenceRun = () => {
  26  |   const run = process.env.WELTRAUM_FACTORY_EVIDENCE_RUN ?? new Date().toISOString().replaceAll(":", "");
  27  |   if (!/^[A-Za-z0-9._-]{1,100}$/.test(run)) throw new Error("Invalid Factory evidence run ID");
  28  |   return path.resolve("evidence/factory/w06", run);
  29  | };
  30  |
  31  | test.describe.serial("one actual Factory host through normal player actions", () => {
  32  |   let context: BrowserContext;
  33  |   let page: Page;
  34  |   let pausedClock: Awaited<ReturnType<typeof readClock>>;
  35  |   test.beforeAll(async ({ browser }, testInfo) => {
  36  |     context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  37  |     await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  38  |     page = await context.newPage();
  39  |   });
  40  |   test.afterAll(async () => {
  41  |     if (!context) return;
  42  |     const directory = evidenceRun(); await mkdir(directory, { recursive: true });
  43  |     try { await context.tracing.stop({ path: path.join(directory, "factory-flow-trace.zip") }); }
> 44  |     finally { await context.close(); }
      |                             ^ Error: apiRequestContext._wrapApiCall: Must start tracing before stopping
  45  |   });
  46  |   test("real Factory entry reaches Ready once", async () => {
  47  |     await openFactory(page);
  48  |     await expect(page.locator("#hvp-hud")).toHaveCount(1); await expect(page.locator("canvas")).toHaveCount(1);
  49  |   });
  50  |
  51  |   test("T026 duplicate Factory entry creates no second worker or renderer", async () => {
  52  |     const workers = page.workers().length; expect(workers).toBeGreaterThan(0);
  53  |     const duplicate = await page.evaluate(async () => {
  54  |       const entryPath = "/src/factory/factoryEntry.ts"; const entry = await import(entryPath);
  55  |       try { await entry.startFactoryEntry(); return "unexpected second host"; } catch (error) { return String(error); }
  56  |     });
  57  |     expect(duplicate).toMatch(/already mounted/i); expect(page.workers().length).toBe(workers);
  58  |     await expect(page.locator("canvas")).toHaveCount(1); await expect(page.locator("#hvp-hud")).toHaveCount(1);
  59  |     await expect(page.locator("#factory-panel")).toHaveCount(1);
  60  |   });
  61  |
  62  |   test("T028 native pause preserves clock through presentation frames", async ({}, testInfo) => {
  63  |     const errors: string[] = []; page.on("pageerror", error => { errors.push(error.message); });
  64  |     await expect.poll(async () => (await readClock(page)).steps).toBeGreaterThan(0);
  65  |     await page.getByRole("button", { name: "Werkstatt pausieren", exact: true }).click();
  66  |     await expect(page.locator("#factory-status")).toContainText("Pausiert"); const paused = await readClock(page); pausedClock = paused;
  67  |     await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
  68  |     expect(await readClock(page)).toEqual(paused); expect(paused.elapsedMs).toBe(paused.steps * 100);
  69  |     expect(paused.remainderTicks).toBeGreaterThanOrEqual(0); expect(paused.remainderTicks).toBeLessThan(6);
  70  |     const capture = await page.screenshot(); await testInfo.attach("factory-single-host", { body: capture, contentType: "image/png" });
  71  |     const directory = evidenceRun(); await mkdir(directory, { recursive: true });
  72  |     await writeFile(path.join(directory, "factory-single-host.png"), capture);
  73  |     await writeFile(path.join(directory, "browser-host-clock.json"), JSON.stringify({ state: paused, errors }, null, 2) + "\n");
  74  |     expect(errors).toEqual([]); expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
  75  |   });
  76  |
  77  |   test("Factory refuses all legacy persistence paths with an honest reason", async () => {
  78  |     for (const id of ["hvp-save", "hvp-load", "hvp-load-new"]) {
  79  |       await page.locator(`#${id}`).click(); await expect(page.locator("#hvp-save-status")).toContainText("Factory");
  80  |       await expect(page.locator("#hvp-save-status")).toContainText("Rejected");
  81  |     }
  82  |     await expect(page).toHaveURL(/factory\.html$/);
  83  |   });
  84  |
  85  |   test("Factory explicitly resumes the same paused native host", async () => {
  86  |     await expect(page.locator("#factory-status")).toContainText("Pausiert");
  87  |     expect(await readClock(page)).toEqual(pausedClock);
  88  |     const paused = pausedClock;
  89  |     await page.getByRole("button", { name: "Werkstatt fortsetzen", exact: true }).click();
  90  |     await expect.poll(async () => (await readClock(page)).steps).toBeGreaterThan(paused.steps);
  91  |     await expect(page.locator("#hvp-hud")).toHaveCount(1); await expect(page.locator("canvas")).toHaveCount(1);
  92  |   });
  93  |
  94  |   test("T027 actual Factory teardown retires projection and native workers", async ({}, testInfo) => {
  95  |     page.once("dialog", dialog => { void dialog.accept(); });
  96  |     await page.getByRole("button", { name: "Sitzung beenden", exact: true }).click();
  97  |     await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");
  98  |     await expect(page.locator("#factory-panel")).toHaveCount(0); await expect(page.locator("#hvp-hud")).toHaveCount(0);
  99  |     await expect.poll(() => page.workers().length).toBe(0);
  100 |     const receipt = await page.evaluate(() => {
  101 |       if (document.body.dataset.hestiaFactoryClock !== undefined) throw new Error("Disposed Factory projection survived");
  102 |       return JSON.parse(document.body.dataset.hestiaPrototypeDisposal!);
  103 |     });
  104 |     expect(receipt.state).toBe("Disposed"); expect(receipt.errors).toEqual([]);
  105 |     for (const name of ["workers", "timers", "listeners", "pendingJobs", "bodies", "colliders", "ownedBytes"]) expect(receipt.disposed[name], name).toBe(0);
  106 |     await testInfo.attach("factory-host-disposal", { body: JSON.stringify(receipt), contentType: "application/json" });
  107 |     const directory = evidenceRun(); await mkdir(directory, { recursive: true });
  108 |     await writeFile(path.join(directory, "browser-host-disposal.json"), JSON.stringify(receipt, null, 2) + "\n");
  109 |   });
  110 |
  111 | });
  112 |
```
