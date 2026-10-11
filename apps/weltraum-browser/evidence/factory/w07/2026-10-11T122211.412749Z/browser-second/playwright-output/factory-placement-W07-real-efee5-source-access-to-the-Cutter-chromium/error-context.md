# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-placement.spec.ts >> W07 real player construction in one confirmed Factory session >> normal Cargo Open is idempotent and actual WASD walks the admitted actor from source access to the Cutter
- Location: tests/e2e/factory-placement.spec.ts:25:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic "HVP-02 readable coast viewport" [ref=e3]
  - region "Werkstatt" [ref=e4]:
    - strong [ref=e5]: Hestia · Werkstatt
    - status [ref=e6]: Werkstatt bereit · Pausiert
    - paragraph [ref=e7]: Wähle eine Bauvorschau. Die Werkstatt pausiert; Pfeile verschieben um 25 cm, R dreht, Escape verwirft. Wrackfracht öffnen, anschließend mit Spielen und WASD zum Bauplatz gehen. Bauteile bleiben bis zur Bestätigung in der endlichen Wrackfracht. Gemeinsames Speichern folgt.
    - button "Werkstatt pausieren" [disabled] [ref=e8]
    - button "Werkstatt fortsetzen" [ref=e9]
    - button "Wrackfracht öffnen" [active] [ref=e10]
    - button "Zuschnitt vorschauen" [ref=e11]
    - button "Batterie vorschauen" [ref=e12]
    - button "Verteiler vorschauen" [ref=e13]
    - button "Bauvorschau drehen" [ref=e14]
    - button "Bauvorschau verwerfen" [ref=e15]
    - button "Bau bestätigen" [ref=e16]
    - status [ref=e17]: "Wrackfracht nicht erreichbar · TypeError: Cannot read properties of undefined (reading 'read')"
  - alert [ref=e18]:
    - heading "HVP-02 UNAVAILABLE" [level=1] [ref=e19]
    - paragraph [ref=e20]: "Technical initialization failure: HVP representations must share one projection frame."
    - paragraph [ref=e21]: NOT GAMEPLAY · no terrain readiness is being claimed
```

# Test source

```ts
  1  | import { expect, test, type BrowserContext, type Page } from "@playwright/test";
  2  | import { mkdir, writeFile } from "node:fs/promises";
  3  | import path from "node:path";
  4  | 
  5  | const runDirectory=()=>{
  6  |   const run=process.env.WELTRAUM_FACTORY_EVIDENCE_RUN;
  7  |   if(!run||!/^[A-Za-z0-9._-]{1,100}$/.test(run))throw new Error("W07 needs its actual unique evidence run");
  8  |   return path.resolve("evidence/factory/w07",run);
  9  | };
  10 | const readNative=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics!));
  11 | const readBuild=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaFactoryConstruction!));
  12 | 
  13 | test.describe.serial("W07 real player construction in one confirmed Factory session",()=>{
  14 |   let context:BrowserContext,page:Page;const errors:string[]=[];
  15 |   test.beforeAll(async({browser},info)=>{context=await browser.newContext({baseURL:info.project.use.baseURL});page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));});
  16 |   test.afterAll(async()=>{if(context)await context.close();});
  17 |   test("accepted source reaches Ready with one renderer and finite uninstalled Cargo",async()=>{
  18 |     await page.goto("/factory.html");await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit",{timeout:20_000});
  19 |     await expect(page.locator("canvas")).toHaveCount(1);await expect(page.locator("#hvp-hud")).toHaveCount(1);
  20 |     const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations).toEqual([]);expect(state.reservations).toBe(0);expect(state.cargo.opened).toBe(false);expect(state.cargo.accessible).toBe(true);expect(state.cargo.positionMm).toEqual([-5500,2000,13125]);
  21 |     expect((await readNative(page)).factoryFacilities.cargo.bodyHandle).toBe(state.cargo.bodyHandle);
  22 |     expect(await page.evaluate(()=>document.body.dataset.hestiaPrototypeVegetationCount)).toBe("97");
  23 |     expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);
  24 |   });
  25 |   test("normal Cargo Open is idempotent and actual WASD walks the admitted actor from source access to the Cutter",async()=>{
  26 |     const before=await readBuild(page),nativeBefore=await readNative(page);
  27 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("CARGO_CLOSED");await page.keyboard.press("Escape");
> 28 |     await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect.poll(async()=>(await readBuild(page)).cargo.opened).toBe(true);
     |                                                                                                                                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  29 |     const first=await readNative(page);await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Wrackfracht geöffnet");expect((await readNative(page)).factoryFacilities.revision).toBe(first.factoryFacilities.revision);
  30 |     await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");await expect.poll(async()=>(await readNative(page)).player.status).toBe("Walking");
  31 |     await page.keyboard.down("d");await expect.poll(async()=>(await readNative(page)).player.position.x,{intervals:[20,40,60]}).toBeLessThan(-6.15);await page.keyboard.up("d");
  32 |     await page.keyboard.down("s");await expect.poll(async()=>(await readNative(page)).player.position.z,{intervals:[20,40,60]}).toBeLessThan(9.15);await page.keyboard.up("s");await page.keyboard.press("Escape");await expect.poll(async()=>(await readNative(page)).status).toBe("Paused");
  33 |     await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  34 |     const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(before.containers);expect(after.massMg).toBe(before.massMg);expect(after.cargo.positionMm).toEqual(before.cargo.positionMm);expect(nativeAfter.ticks).toBeGreaterThan(nativeBefore.ticks);expect(nativeAfter.player.position.z).toBeLessThan(9.2);expect(nativeAfter.player.position.x).toBeLessThan(-6.1);expect(nativeAfter.player.grounded).toBe(true);expect(nativeAfter.factoryFacilities.cargo.accessible).toBe(true);
  35 |     const directory=runDirectory();await writeFile(path.join(directory,"browser-cargo-open-native-walk.json"),JSON.stringify({before,after,nativeBefore,nativeAfter},null,2)+"\n");
  36 |   });
  37 |   test("T030 real move, quarter-turn and Escape retire the ghost with no native or material mutation",async()=>{
  38 |     const before=await readBuild(page);
  39 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  40 |     const ghost=await readBuild(page);expect(ghost.ghost.request.quarterTurns).toBe(1);
  41 |     await page.keyboard.press("ArrowRight");await expect.poll(async()=> (await readBuild(page)).ghost.request.centerMm[0]).toBe(-6000);
  42 |     await page.keyboard.press("r");await expect.poll(async()=> (await readBuild(page)).ghost.request.quarterTurns).toBe(2);
  43 |     await page.keyboard.press("Escape");await expect.poll(async()=> (await readBuild(page)).ghost).toBeNull();
  44 |     const after=await readBuild(page);expect(after.containers).toEqual(before.containers);expect(after.massMg).toBe(before.massMg);expect(after.installations).toEqual([]);expect(after.reservations).toBe(0);
  45 |     const directory=runDirectory();await mkdir(directory,{recursive:true});await writeFile(path.join(directory,"browser-ghost-cancel.json"),JSON.stringify({before,after},null,2)+"\n");
  46 |   });
  47 |   test("T029 a real confirmed build publishes exactly one paid208kg Cutter",async({},info)=>{
  48 |     const nativeBefore=await readNative(page);
  49 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  50 |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect.poll(async()=> (await readBuild(page)).installations.length).toBe(1);
  51 |     await expect.poll(async()=> (await readBuild(page)).state).toBe("Ready");
  52 |     const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations[0].massMg).toBe(208_000_000);expect(state.reservations).toBe(0);
  53 |     const cargo=state.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo");expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_profile").quantity).toBe(68_000_000);expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_sheet").quantity).toBe(50_000_000);expect(cargo.contents.some((s:any)=>s.resourceId==="fp02_chassis_cutter")).toBe(false);
  54 |     const installed=state.containers.find((c:any)=>c.containerId===state.installations[0].materialContainerId);expect(installed.massKg).toBe(208);expect(installed.contents.find((s:any)=>s.resourceId==="fp02_chassis_cutter").extensions["factory.source"].cargoId).toBe("C26");
  55 |     const nativeAfter=await readNative(page);expect(nativeAfter.factoryFacilities.owners).toHaveLength(1);expect(nativeAfter.factoryFacilities.owners[0].instanceId).toBe(state.installations[0].instanceId);expect(nativeAfter.bodyCount).toBe(nativeBefore.bodyCount+1);expect(nativeAfter.factoryFacilities.owners[0].colliderHandles.length).toBeGreaterThan(0);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBefore.factoryFacilities.cargo.bodyHandle);
  56 |     const directory=runDirectory(),capture=await page.screenshot();await info.attach("paid-native-cutter",{body:capture,contentType:"image/png"});await writeFile(path.join(directory,"paid-native-cutter.png"),capture);await writeFile(path.join(directory,"browser-paid-cutter.json"),JSON.stringify({state,nativeBefore,nativeAfter,errors},null,2)+"\n");expect(errors).toEqual([]);
  57 |   });
  58 |   test("finite C26 cannot install a second Cutter; failed confirmation preserves the complete first installation",async()=>{
  59 |     const before=await readBuild(page);await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau nicht möglich");
  60 |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau angehalten");
  61 |     const after=await readBuild(page);expect(after.containers).toEqual(before.containers);expect(after.installations).toEqual(before.installations);expect(after.massMg).toBe(before.massMg);expect(after.reservations).toBe(0);
  62 |     await page.keyboard.press("Escape");
  63 |   });
  64 |   test("Legacy persistence stays closed and actual disposal retires paid Facility projection and native World",async()=>{
  65 |     await page.locator("#hvp-save").click();await expect(page.locator("#hvp-save-status")).toContainText("Rejected");await expect(page.locator("#hvp-save-status")).toContainText("Factory");
  66 |     page.once("dialog",dialog=>{void dialog.accept();});await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");await expect(page.locator("#factory-panel")).toHaveCount(0);await expect.poll(()=>page.workers().length).toBe(0);
  67 |     expect(await page.evaluate(()=>document.body.dataset.hestiaFactoryConstruction)).toBeUndefined();expect(errors).toEqual([]);
  68 |     const directory=runDirectory();await writeFile(path.join(directory,"browser-native-disposal.json"),await page.evaluate(()=>document.body.dataset.hestiaPrototypeDisposal!)+"\n");
  69 |   });
  70 | });
  71 | 
```