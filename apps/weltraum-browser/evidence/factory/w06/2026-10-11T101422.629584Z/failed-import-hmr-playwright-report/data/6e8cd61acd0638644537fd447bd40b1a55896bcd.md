# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-host.spec.ts >> T026–T028 real Factory entry keeps one host and advances only confirmed native ticks
- Location: tests/e2e/factory-host.spec.ts:20:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Werkstatt pausieren', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic "HVP-02 readable coast viewport" [ref=e3]
    - region "Hestia coast and vegetation controls" [ref=e4]:
      - strong [ref=e5]: HVP-13 HESTIA COAST
      - status [ref=e6]: "State: Ready"
      - generic [ref=e7]: "Camera: C04-WIDE (Orbit)"
      - generic [ref=e8]: "Terrain faces: 49436 · vertices: 197744 · triangles: 98872 · scene: 186876 voxel quads / 374632 total tris (coast+flora+sky)"
      - status [ref=e9]: "Physics: Running · 4 bodies / 88 colliders · g=11.79 m/s² · Fallhöhe y=0.62 m · Player: Inspection"
      - status [ref=e10]: "Plasmacutter: Zelle · Idle · Spielen: 1 Zelle · 2 Box · 3 Kugel · Linksklick · 1/2/3, Linksklick · Terrain: SafeQuarry / Holz: Ast · F: Schieben (4 m / 15 N·s) · L-Körper bereit · Ast: Idle · Taste 2 + Linksklick · Fragment: Idle · 1 Zelle / 2 Box / 3 Kugel erneut schneiden"
      - status [ref=e11]: "Spielstand: Idle · Lokaler Hestia-Spielstand"
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
        - button "Spielstand laden" [ref=e35]
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
  - alert [ref=e50]: "Werkstatt konnte nicht starten: Error: HVP-02 already mounted: dispose the live session before starting again."
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
  23 |   await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit", { timeout: 20_000 });
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
> 37 |   await page.getByRole("button", { name: "Werkstatt pausieren", exact: true }).click();
     |                                                                                ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
