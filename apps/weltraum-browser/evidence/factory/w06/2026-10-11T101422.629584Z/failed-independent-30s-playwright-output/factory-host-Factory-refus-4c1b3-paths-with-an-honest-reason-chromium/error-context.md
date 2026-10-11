# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-host.spec.ts >> Factory refuses all legacy persistence paths with an honest reason
- Location: tests/e2e/factory-host.spec.ts:59:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#hvp-load-new')
    - locator resolved to <button type="button" id="hvp-load-new">Gespeicherte Sitzung neu öffnen</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic "HVP-02 readable coast viewport" [ref=e3]
  - region "Hestia coast and vegetation controls" [ref=e4]:
    - strong [ref=e5]: HVP-13 HESTIA COAST
    - status [ref=e6]: "State: Ready"
    - generic [ref=e7]: "Camera: C04-WIDE (Orbit)"
    - generic [ref=e8]: "Terrain faces: 49436 · vertices: 197744 · triangles: 98872 · scene: 186876 voxel quads / 374632 total tris (coast+flora+sky)"
    - status [ref=e9]: "Physics: Running · 4 bodies / 88 colliders · g=11.79 m/s² · Fallhöhe y=0.62 m · Player: Inspection"
    - status [ref=e10]: "Plasmacutter: Zelle · Idle · Spielen: 1 Zelle · 2 Box · 3 Kugel · Linksklick · 1/2/3, Linksklick · Terrain: SafeQuarry / Holz: Ast · F: Schieben (4 m / 15 N·s) · L-Körper bereit · Ast: Idle · Taste 2 + Linksklick · Fragment: Idle · 1 Zelle / 2 Box / 3 Kugel erneut schneiden"
    - status [ref=e11]: "Spielstand: Rejected · Factory: gemeinsamer Spielstand noch nicht verfügbar; altes Speichern/Laden gesperrt"
    - status [ref=e12]: "Ostregion: NotRequested · LOD 0.5 m · Kollision fehlt · Ruhende Fragmente: 0"
    - generic [ref=e13]:
      - button "Sitzung beenden" [ref=e14]
      - button "Spielen · WASD / Maus / Space" [ref=e15]
      - 'button "Perspektive: Ego (V)" [ref=e16]'
      - button "C01-EYE" [ref=e17]
      - button "C02-SHORE" [ref=e18]
      - button "C03-ROOTS" [ref=e19]
      - button "C04-WIDE" [ref=e20]
      - button "C05-Felsarm" [ref=e21]
      - button "Felsarm-Stütze prüfen (ohne Schnitt)" [ref=e22]
      - button "Stütze anvisieren (2 + Klick)" [ref=e23]
      - 'button "Neustart: Felsarm" [ref=e24]'
      - button "Neuer Bergungsauftrag" [ref=e25]
      - 'button "Neustart: Ostpfad" [ref=e26]'
      - button "Ostregion erneut versuchen" [ref=e27]
      - 'button "Ansicht: Schnittstelle" [ref=e28]'
      - button "L-Körper anvisieren (F)" [ref=e29]
      - button "Ast anvisieren (2 + Klick)" [ref=e30]
      - 'button "1: Zelle" [ref=e31]'
      - 'button "2: Box" [ref=e32]'
      - 'button "3: Kugel" [ref=e33]'
      - button "Spielstand speichern" [ref=e34]
      - button "Spielstand laden" [active] [ref=e35]
      - button "Gespeicherte Sitzung neu öffnen" [ref=e36]
      - button "Reset view" [ref=e37]
      - 'button "Water: on" [ref=e38]'
      - 'button "Inspect: off" [ref=e39]'
      - button "Inspect-only ambient occlusion toggle" [pressed] [ref=e40]: "AO: on"
      - button "Physik pausieren" [ref=e41]
      - button "Fallkörper neu starten" [ref=e42]
      - button "Hide UI" [ref=e43]
  - region "Werkstatt" [ref=e44]:
    - strong [ref=e45]: Hestia · Werkstatt
    - status [ref=e46]: Werkstatt bereit · Aktiv
    - paragraph [ref=e47]: Werkstatt vorbereitet. Bau und Produktion folgen. Gemeinsames Speichern ist noch nicht verfügbar.
    - button "Werkstatt pausieren" [ref=e48]
    - button "Werkstatt fortsetzen" [disabled] [ref=e49]
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
  20 | const openFactory = async (page: import("@playwright/test").Page) => {
  21 |   await page.goto("/factory.html");
  22 |   await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit", { timeout: 20_000 });
  23 | };
  24 | const readClock = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryClock!));
  25 | const evidenceRun = () => {
  26 |   const run = process.env.WELTRAUM_FACTORY_EVIDENCE_RUN ?? new Date().toISOString().replaceAll(":", "");
  27 |   if (!/^[A-Za-z0-9._-]{1,100}$/.test(run)) throw new Error("Invalid Factory evidence run ID");
  28 |   return path.resolve("evidence/factory/w06", run);
  29 | };
  30 |
  31 | test("T026 duplicate Factory entry creates no second worker or renderer", async ({ page }) => {
  32 |   await openFactory(page);
  33 |   const workers = page.workers().length; expect(workers).toBeGreaterThan(0);
  34 |   const duplicate = await page.evaluate(async () => {
  35 |     const entryPath = "/src/factory/factoryEntry.ts"; const entry = await import(entryPath);
  36 |     try { await entry.startFactoryEntry(); return "unexpected second host"; } catch (error) { return String(error); }
  37 |   });
  38 |   expect(duplicate).toMatch(/already mounted/i); expect(page.workers().length).toBe(workers);
  39 |   await expect(page.locator("canvas")).toHaveCount(1); await expect(page.locator("#hvp-hud")).toHaveCount(1);
  40 |   await expect(page.locator("#factory-panel")).toHaveCount(1);
  41 | });
  42 |
  43 | test("T028 native pause preserves clock through presentation frames", async ({ page }, testInfo) => {
  44 |   const errors: string[] = []; page.on("pageerror", error => { errors.push(error.message); });
  45 |   await openFactory(page);
  46 |   await expect.poll(async () => (await readClock(page)).steps).toBeGreaterThan(0);
  47 |   await page.getByRole("button", { name: "Werkstatt pausieren", exact: true }).click();
  48 |   await expect(page.locator("#factory-status")).toContainText("Pausiert"); const paused = await readClock(page);
  49 |   await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
  50 |   expect(await readClock(page)).toEqual(paused); expect(paused.elapsedMs).toBe(paused.steps * 100);
  51 |   expect(paused.remainderTicks).toBeGreaterThanOrEqual(0); expect(paused.remainderTicks).toBeLessThan(6);
  52 |   const capture = await page.screenshot(); await testInfo.attach("factory-single-host", { body: capture, contentType: "image/png" });
  53 |   const directory = evidenceRun(); await mkdir(directory, { recursive: true });
  54 |   await writeFile(path.join(directory, "factory-single-host.png"), capture);
  55 |   await writeFile(path.join(directory, "browser-host-clock.json"), JSON.stringify({ state: paused, errors }, null, 2) + "\n");
  56 |   expect(errors).toEqual([]); expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
  57 | });
  58 |
  59 | test("Factory refuses all legacy persistence paths with an honest reason", async ({ page }) => {
  60 |   await openFactory(page);
  61 |   for (const id of ["hvp-save", "hvp-load", "hvp-load-new"]) {
> 62 |     await page.locator(`#${id}`).click(); await expect(page.locator("#hvp-save-status")).toContainText("Factory");
     |                                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
  63 |     await expect(page.locator("#hvp-save-status")).toContainText("Rejected");
  64 |   }
  65 |   await expect(page).toHaveURL(/factory\.html$/);
  66 | });
  67 |
  68 | test("Factory explicitly resumes the same paused native host", async ({ page }) => {
  69 |   await openFactory(page);
  70 |   await page.getByRole("button", { name: "Werkstatt pausieren", exact: true }).click();
  71 |   await expect(page.locator("#factory-status")).toContainText("Pausiert"); const paused = await readClock(page);
  72 |   await page.getByRole("button", { name: "Werkstatt fortsetzen", exact: true }).click();
  73 |   await expect.poll(async () => (await readClock(page)).steps).toBeGreaterThan(paused.steps);
  74 |   await expect(page.locator("#hvp-hud")).toHaveCount(1); await expect(page.locator("canvas")).toHaveCount(1);
  75 | });
  76 |
  77 | test("T027 actual Factory teardown retires projection and native workers", async ({ page }, testInfo) => {
  78 |   await openFactory(page); page.once("dialog", dialog => { void dialog.accept(); });
  79 |   await page.getByRole("button", { name: "Sitzung beenden", exact: true }).click();
  80 |   await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");
  81 |   await expect(page.locator("#factory-panel")).toHaveCount(0); await expect(page.locator("#hvp-hud")).toHaveCount(0);
  82 |   await expect.poll(() => page.workers().length).toBe(0);
  83 |   const receipt = await page.evaluate(() => {
  84 |     if (document.body.dataset.hestiaFactoryClock !== undefined) throw new Error("Disposed Factory projection survived");
  85 |     return JSON.parse(document.body.dataset.hestiaPrototypeDisposal!);
  86 |   });
  87 |   expect(receipt.state).toBe("Disposed"); expect(receipt.errors).toEqual([]);
  88 |   for (const name of ["workers", "timers", "listeners", "pendingJobs", "bodies", "colliders", "ownedBytes"]) expect(receipt.disposed[name], name).toBe(0);
  89 |   await testInfo.attach("factory-host-disposal", { body: JSON.stringify(receipt), contentType: "application/json" });
  90 |   const directory = evidenceRun(); await mkdir(directory, { recursive: true });
  91 |   await writeFile(path.join(directory, "browser-host-disposal.json"), JSON.stringify(receipt, null, 2) + "\n");
  92 | });
  93 |
```
