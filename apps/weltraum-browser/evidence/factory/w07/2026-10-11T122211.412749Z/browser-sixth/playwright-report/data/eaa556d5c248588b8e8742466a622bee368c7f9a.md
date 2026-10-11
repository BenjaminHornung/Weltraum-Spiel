# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-placement.spec.ts >> W07 real player construction in one confirmed Factory session >> at most four more released D/A taps confirm the actual source-checked west stand
- Location: tests/e2e/factory-placement.spec.ts:54:3

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= -6.125
Received:    -5.5
```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic "HVP-02 readable coast viewport" [active] [ref=e3]
  - region "Ziel und Physikstoß":
    - generic: Kein Treffer innerhalb von 4 m – näher an einen gelösten Körper herangehen.
    - status: F stößt in Blickrichtung; es greift oder zieht kein Objekt.
    - status: "Zelle · Linksklick: Kein Ziel innerhalb 4 m"
    - generic: "1/2/3 + Linksklick: Schneiden an freigegebenen Stellen · V: Perspektive · Esc: Pause / Übersicht"
  - region "Werkstatt" [ref=e4]:
    - strong [ref=e5]: Hestia · Werkstatt
    - status [ref=e6]: Werkstatt bereit · Aktiv
    - paragraph [ref=e7]: Wähle eine Bauvorschau. Die Werkstatt pausiert; Pfeile verschieben um 25 cm, R dreht, Escape verwirft. Wrackfracht öffnen, anschließend mit Spielen und WASD zum Bauplatz gehen. Bauteile bleiben bis zur Bestätigung in der endlichen Wrackfracht. Gemeinsames Speichern folgt.
    - button "Werkstatt pausieren" [ref=e8]
    - button "Werkstatt fortsetzen" [disabled] [ref=e9]
    - button "Wrackfracht öffnen" [ref=e10]
    - button "Zuschnitt vorschauen" [ref=e11]
    - button "Batterie vorschauen" [ref=e12]
    - button "Verteiler vorschauen" [ref=e13]
    - button "Bauvorschau drehen" [ref=e14]
    - button "Bauvorschau verwerfen" [ref=e15]
    - button "Bau bestätigen" [ref=e16]
    - status [ref=e17]: Wrackfracht geöffnet · endlicher Bestand verfügbar
```

# Test source

```ts
  1   | import { expect, test, type BrowserContext, type Page } from "@playwright/test";
  2   | import { mkdir, writeFile } from "node:fs/promises";
  3   | import path from "node:path";
  4   | 
  5   | const runDirectory=()=>{
  6   |   const run=process.env.WELTRAUM_FACTORY_EVIDENCE_RUN;
  7   |   if(!run||!/^[A-Za-z0-9._-]{1,100}$/.test(run))throw new Error("W07 needs its actual unique evidence run");
  8   |   return path.resolve("evidence/factory/w07",run);
  9   | };
  10  | const readNative=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics!));
  11  | const readBuild=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaFactoryConstruction!));
  12  | 
  13  | test.describe.serial("W07 real player construction in one confirmed Factory session",()=>{
  14  |   let context:BrowserContext,page:Page;const errors:string[]=[];
  15  |   let beforeCargo:Awaited<ReturnType<typeof readBuild>>,nativeBeforeCargo:Awaited<ReturnType<typeof readNative>>;
  16  |   let beforeSecond:Awaited<ReturnType<typeof readBuild>>,nativeBeforeSecond:Awaited<ReturnType<typeof readNative>>;
  17  |   test.beforeAll(async({browser},info)=>{context=await browser.newContext({baseURL:info.project.use.baseURL});page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));});
  18  |   test.afterAll(async()=>{if(context)await context.close();});
  19  |   test("accepted source reaches Ready with one renderer and finite uninstalled Cargo",async()=>{
  20  |     await page.goto("/factory.html");await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit",{timeout:20_000});
  21  |     await expect(page.locator("canvas")).toHaveCount(1);await expect(page.locator("#hvp-hud")).toHaveCount(1);
  22  |     const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations).toEqual([]);expect(state.reservations).toBe(0);expect(state.cargo.opened).toBe(false);expect(state.cargo.accessible).toBe(true);expect(state.cargo.positionMm).toEqual([-5500,2000,13125]);
  23  |     expect((await readNative(page)).factoryFacilities.cargo.bodyHandle).toBe(state.cargo.bodyHandle);
  24  |     expect(await page.evaluate(()=>document.body.dataset.hestiaPrototypeVegetationCount)).toBe("97");
  25  |     expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);
  26  |   });
  27  |   test("closed Cargo refuses an actual build preview and Escape retires that ghost",async()=>{
  28  |     beforeCargo=await readBuild(page);nativeBeforeCargo=await readNative(page);
  29  |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("CARGO_CLOSED");await page.keyboard.press("Escape");
  30  |     await expect.poll(async()=>(await readBuild(page)).ghost).toBeNull();
  31  |   });
  32  |   test("normal Cargo Open is idempotent in this same actual native session",async()=>{
  33  |     await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect.poll(async()=>(await readBuild(page)).cargo.opened).toBe(true);
  34  |     const first=await readNative(page);await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Wrackfracht geöffnet");expect((await readNative(page)).factoryFacilities.revision).toBe(first.factoryFacilities.revision);
  35  |   });
  36  |   const nativeWalkTaps:unknown[]=[];
  37  |   const tapToward=async(axis:"x"|"z",target:number,negativeKey:string,positiveKey:string)=>{
  38  |     for(let tap=0;tap<4;tap++){
  39  |       const before=await readNative(page),value=before.player.position[axis];
  40  |       if(Math.abs(value-target)<=0.125)break;
  41  |       const key=value>target?negativeKey:positiveKey;
  42  |       const holdMs=Math.min(100,Math.max(25,Math.round(Math.abs(value-target)/3*1000)));
  43  |       // A real trusted short press releases BEFORE the native projection read; no held key during CDP polling.
  44  |       await page.keyboard.press(key,{delay:holdMs});
  45  |       const after=await readNative(page);
  46  |       nativeWalkTaps.push({axis,target,key,holdMs,beforePlayer:before.player,afterPlayer:after.player,beforeTicks:before.ticks,afterTicks:after.ticks});
  47  |       await writeFile(path.join(runDirectory(),"browser-native-walk-taps.json"),JSON.stringify(nativeWalkTaps,null,2)+"\n");
  48  |     }
  49  |   };
  50  |   test("normal Play acquires the same actual native Walking session",async()=>{
  51  |     await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");await expect.poll(async()=>(await readNative(page)).player.status).toBe("Walking");
  52  |   });
  53  |   test("at most four actual released D/A taps approach the source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");});
> 54  |   test("at most four more released D/A taps confirm the actual source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");const native=await readNative(page);expect(native.player.position.x).toBeGreaterThanOrEqual(-6.4);expect(native.player.position.x).toBeLessThanOrEqual(-6.125);expect(native.player.grounded).toBe(true);});
      |                                                                                                                                                                                                                                                                           ^ Error: expect(received).toBeLessThanOrEqual(expected)
  55  |   test("at most four actual released S/W taps approach the source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");});
  56  |   test("at most four more released S/W taps confirm the actual source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");const native=await readNative(page);expect(native.player.position.z).toBeGreaterThanOrEqual(8.75);expect(native.player.position.z).toBeLessThanOrEqual(9);expect(native.player.grounded).toBe(true);expect(native.factoryFacilities.cargo.accessible).toBe(true);});
  57  |   test("Escape pauses the same walked session and native readback proves material and Cargo unchanged",async()=>{
  58  |     await page.keyboard.press("Escape");await expect.poll(async()=>(await readNative(page)).status).toBe("Paused");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  59  |     const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeCargo.containers);expect(after.massMg).toBe(beforeCargo.massMg);expect(after.cargo.positionMm).toEqual(beforeCargo.cargo.positionMm);expect(nativeAfter.ticks).toBeGreaterThan(nativeBeforeCargo.ticks);expect(nativeAfter.player.position.z).toBeLessThan(9.2);expect(nativeAfter.player.position.x).toBeLessThan(-6.1);expect(nativeAfter.player.grounded).toBe(true);expect(nativeAfter.factoryFacilities.cargo.accessible).toBe(true);
  60  |     const directory=runDirectory();await writeFile(path.join(directory,"browser-cargo-open-native-walk.json"),JSON.stringify({before:beforeCargo,after,nativeBefore:nativeBeforeCargo,nativeAfter,nativeWalkTaps},null,2)+"\n");
  61  |   });
  62  |   test("T030 real move, quarter-turn and Escape retire the ghost with no native or material mutation",async()=>{
  63  |     const before=await readBuild(page);
  64  |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  65  |     const ghost=await readBuild(page);expect(ghost.ghost.request.quarterTurns).toBe(1);
  66  |     await page.keyboard.press("ArrowRight");await expect.poll(async()=> (await readBuild(page)).ghost.request.centerMm[0]).toBe(-6000);
  67  |     await page.keyboard.press("r");await expect.poll(async()=> (await readBuild(page)).ghost.request.quarterTurns).toBe(2);
  68  |     await page.keyboard.press("Escape");await expect.poll(async()=> (await readBuild(page)).ghost).toBeNull();
  69  |     const after=await readBuild(page);expect(after.containers).toEqual(before.containers);expect(after.massMg).toBe(before.massMg);expect(after.installations).toEqual([]);expect(after.reservations).toBe(0);
  70  |     const directory=runDirectory();await mkdir(directory,{recursive:true});await writeFile(path.join(directory,"browser-ghost-cancel.json"),JSON.stringify({before,after},null,2)+"\n");
  71  |   });
  72  |   test("T029 a real confirmed build publishes exactly one paid208kg Cutter",async({},info)=>{
  73  |     const nativeBefore=await readNative(page),before=await readBuild(page);
  74  |     expect(before.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo").contents.filter((s:any)=>s.resourceId==="fp02_chassis_cutter").reduce((n:number,s:any)=>n+s.quantity,0)).toBe(1);
  75  |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  76  |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect.poll(async()=> (await readBuild(page)).installations.length).toBe(1);
  77  |     await expect.poll(async()=> (await readBuild(page)).state).toBe("Ready");
  78  |     const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations[0].massMg).toBe(208_000_000);expect(state.reservations).toBe(0);
  79  |     const cargo=state.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo");expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_profile").quantity).toBe(68_000_000);expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_sheet").quantity).toBe(50_000_000);expect(cargo.contents.some((s:any)=>s.resourceId==="fp02_chassis_cutter")).toBe(false);
  80  |     const installed=state.containers.find((c:any)=>c.containerId===state.installations[0].materialContainerId);expect(installed.massKg).toBe(208);expect(installed.contents.find((s:any)=>s.resourceId==="fp02_chassis_cutter").extensions["factory.source"].cargoId).toBe("C26");
  81  |     const nativeAfter=await readNative(page);expect(nativeAfter.factoryFacilities.owners).toHaveLength(1);expect(nativeAfter.factoryFacilities.owners[0].instanceId).toBe(state.installations[0].instanceId);expect(nativeAfter.bodyCount).toBe(nativeBefore.bodyCount+1);expect(nativeAfter.factoryFacilities.owners[0].colliderHandles.length).toBeGreaterThan(0);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBefore.factoryFacilities.cargo.bodyHandle);
  82  |     const directory=runDirectory(),capture=await page.screenshot();await info.attach("paid-native-cutter",{body:capture,contentType:"image/png"});await writeFile(path.join(directory,"paid-native-cutter.png"),capture);await writeFile(path.join(directory,"browser-paid-cutter.json"),JSON.stringify({before,state,nativeBefore,nativeAfter,errors},null,2)+"\n");expect(errors).toEqual([]);
  83  |   });
  84  |   test("normal second-Cutter ghost moves seven quarter-grid steps toward the independent source-checked site",async()=>{
  85  |     beforeSecond=await readBuild(page);nativeBeforeSecond=await readNative(page);
  86  |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();
  87  |     for(let step=0;step<7;step++)await page.keyboard.press("ArrowLeft");
  88  |     await expect.poll(async()=>(await readBuild(page)).ghost.request.centerMm[0]).toBe(-8000);
  89  |   });
  90  |   test("seven more actual ghost moves reach the disjoint supported site and specifically prove BOM_MISSING",async()=>{
  91  |     for(let step=0;step<7;step++)await page.keyboard.press("ArrowLeft");
  92  |     const state=await readBuild(page);expect(state.ghost.request.centerMm).toEqual([-9750,1500,5000]);expect(state.ghost.request.quarterTurns).toBe(1);
  93  |     await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
  94  |   });
  95  |   test("finite C26 failed confirmation preserves the complete first installation and all actual native members",async()=>{
  96  |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
  97  |     const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeSecond.containers);expect(after.installations).toEqual(beforeSecond.installations);expect(after.massMg).toBe(beforeSecond.massMg);expect(after.reservations).toBe(0);
  98  |     expect(nativeAfter.factoryFacilities.owners).toEqual(nativeBeforeSecond.factoryFacilities.owners);expect(nativeAfter.bodyCount).toBe(nativeBeforeSecond.bodyCount);expect(nativeAfter.colliderCount).toBe(nativeBeforeSecond.colliderCount);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBeforeSecond.factoryFacilities.cargo.bodyHandle);
  99  |     await page.keyboard.press("Escape");
  100 |     await writeFile(path.join(runDirectory(),"browser-second-cutter-depletion.json"),JSON.stringify({before:beforeSecond,after,nativeBefore:nativeBeforeSecond,nativeAfter},null,2)+"\n");
  101 |   });
  102 |   test("Legacy persistence stays closed and actual disposal retires paid Facility projection and native World",async()=>{
  103 |     await page.locator("#hvp-save").click();await expect(page.locator("#hvp-save-status")).toContainText("Rejected");await expect(page.locator("#hvp-save-status")).toContainText("Factory");
  104 |     page.once("dialog",dialog=>{void dialog.accept();});await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");await expect(page.locator("#factory-panel")).toHaveCount(0);await expect.poll(()=>page.workers().length).toBe(0);
  105 |     expect(await page.evaluate(()=>document.body.dataset.hestiaFactoryConstruction)).toBeUndefined();expect(errors).toEqual([]);
  106 |     const directory=runDirectory();await writeFile(path.join(directory,"browser-native-disposal.json"),await page.evaluate(()=>document.body.dataset.hestiaPrototypeDisposal!)+"\n");
  107 |   });
  108 | });
  109 | 
```