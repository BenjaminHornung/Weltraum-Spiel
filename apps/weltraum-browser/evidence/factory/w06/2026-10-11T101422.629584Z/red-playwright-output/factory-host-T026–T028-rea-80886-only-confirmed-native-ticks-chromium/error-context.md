# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-host.spec.ts >> T026–T028 real Factory entry keeps one host and advances only confirmed native ticks
- Location: tests/e2e/factory-host.spec.ts:20:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#factory-status')
Expected substring: "Werkstatt bereit"
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 20000ms
  - waiting for locator('#factory-status')

```

```yaml
- main:
  - region "Flight HUD":
    - complementary "Ship status":
      - text: Schub 0%
      - meter "Throttle"
      - text: Geschwindigkeit Speed 0.00 m/s RCS / SAS RCS on, SAS on Treibstoff 100/100 kg
    - complementary "Local radar": N LOKAL 10 contacts 2.5 km
    - complementary "Navigation":
      - text: Ziel Navigation Alpha Waypoint Entfernung 138.4 m
      - strong: NAVIGATION
      - text: KURS
      - strong: Reach Range 500m
      - text: ENTFERNUNG
      - strong: 500.0 m
      - text: STATUS
      - strong: Available
      - button "Navigationsplaner"
      - text: Auftrag Autopilot Preview ready
    - button "Proving Ground"
    - button "Grafik"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { mkdir, writeFile } from "node:fs/promises";
  3  | import path from "node:path";
  4  |
  5  | test("T025 normal flight and legacy HVP request no Factory modules", async ({ page }) => {
  6  |   const requests: string[] = [];
  7  |   page.on("request", request => { requests.push(new URL(request.url()).pathname); });
  8  |   await page.goto("/");
  9  |   await expect(page.locator("#flight-hud")).toBeVisible();
  10 |   await expect(page.locator("#factory-status")).toHaveCount(0);
  11 |   expect(requests.filter(url => url.includes("/factory/"))).toEqual([]);
  12 |   requests.length = 0;
  13 |   await page.goto("/?hestiaPrototype=1");
  14 |   await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  15 |   await expect(page.locator("#factory-status")).toHaveCount(0);
  16 |   expect(requests.filter(url => url.includes("/factory/"))).toEqual([]);
  17 |   expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
  18 | });
  19 |
  20 | test("T026–T028 real Factory entry keeps one host and advances only confirmed native ticks", async ({ page }, testInfo) => {
  21 |   const errors: string[] = []; page.on("pageerror", error => { errors.push(error.message); });
  22 |   await page.goto("/factory.html");
> 23 |   await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit", { timeout: 20_000 });
     |                                                 ^ Error: expect(locator).toContainText(expected) failed
  24 |   await expect(page.locator("#hvp-hud")).toHaveCount(1);
  25 |   await expect(page.locator("canvas")).toHaveCount(1);
  26 |   const read = () => page.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryClock!));
  27 |   await expect.poll(async () => (await read()).steps).toBeGreaterThan(0);
  28 |   const duplicate = await page.evaluate(async () => {
  29 |     const entryPath = "/src/factory/factoryEntry.ts";
  30 |     const entry = await import(entryPath);
  31 |     try { await entry.startFactoryEntry(); return "unexpected second host"; }
  32 |     catch (error) { return String(error); }
  33 |   });
  34 |   expect(duplicate).toMatch(/already mounted/i);
  35 |   await expect(page.locator("canvas")).toHaveCount(1);
  36 |   await expect(page.locator("#hvp-hud")).toHaveCount(1);
  37 |   await page.getByRole("button", { name: "Werkstatt pausieren", exact: true }).click();
  38 |   await expect(page.locator("#factory-status")).toContainText("Pausiert");
  39 |   const paused = await read();
  40 |   // Hundreds of presentation frames are permitted; only a new native tick could grant work.
  41 |   await page.evaluate(async () => {
  42 |     for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  43 |   });
  44 |   expect(await read()).toEqual(paused);
  45 |   expect(paused.elapsedMs).toBe(paused.steps * 100);
  46 |   expect(paused.remainderTicks).toBeGreaterThanOrEqual(0);
  47 |   expect(paused.remainderTicks).toBeLessThan(6);
  48 |   await page.locator("#hvp-save").click();
  49 |   await expect(page.locator("#hvp-save-status")).toContainText("Factory");
  50 |   await expect(page.locator("#hvp-save-status")).toContainText("Rejected");
  51 |   await page.locator("#hvp-load-new").click();
  52 |   await expect(page).toHaveURL(/factory\.html$/);
  53 |   await page.getByRole("button", { name: "Werkstatt fortsetzen", exact: true }).click();
  54 |   await expect.poll(async () => (await read()).steps).toBeGreaterThan(paused.steps);
  55 |   await page.getByRole("button", { name: "Werkstatt pausieren", exact: true }).click();
  56 |   await expect(page.locator("#factory-status")).toContainText("Pausiert");
  57 |   const capture = await page.screenshot();
  58 |   const state = await read();
  59 |   await testInfo.attach("factory-single-host", { body: capture, contentType: "image/png" });
  60 |   await testInfo.attach("factory-confirmed-ticks", { body: Buffer.from(JSON.stringify(state)), contentType: "application/json" });
  61 |   const run = process.env.WELTRAUM_FACTORY_EVIDENCE_RUN ?? new Date().toISOString().replaceAll(":", "");
  62 |   if (!/^[A-Za-z0-9._-]{1,100}$/.test(run)) throw new Error("Invalid Factory evidence run ID");
  63 |   const directory = path.resolve("evidence/factory/w06", run);
  64 |   await mkdir(directory, { recursive: true });
  65 |   await writeFile(path.join(directory, "factory-single-host.png"), capture);
  66 |   await writeFile(path.join(directory, "browser-host-clock.json"), JSON.stringify({ state, errors, test: testInfo.title }, null, 2) + "\n");
  67 |   expect(errors).toEqual([]);
  68 |   expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
  69 | });
  70 |
```
