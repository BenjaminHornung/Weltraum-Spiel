# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-placement.spec.ts >> W07 real player construction in one confirmed Factory session >> at most four more released D/A taps confirm the actual source-checked west stand
- Location: tests/e2e/factory-placement.spec.ts:87:3

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= -6.4
Received:    -6.400003433227539
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
  37  |   const walkPulseCaps={x:125,z:125};
  38  |   // Read-only source preflight bb709f… proves these complete flat hull windows;
  39  |   // actual native ground, Cargo LOS/reach and normal previews remain required.
  40  |   const sourceStandDepth=(x:number):readonly[number,number]=>x<=-6.35?[8.75,9.15]:x<=-6.225?[8.725,9.075]:[8.7,9];
  41  |   const tapToward=async(axis:"x"|"z",target:number,negativeKey:string,positiveKey:string)=>{
  42  |     for(let tap=0;tap<4;tap++){
  43  |       const before=await readNative(page),value=before.player.position[axis];
  44  |       const window=axis==="x"?[-6.4,-6.1] as const:sourceStandDepth(before.player.position.x);
  45  |       if(value>=window[0]&&value<=window[1])break;
  46  |       target=(window[0]+window[1])/2;
  47  |       const key=value>target?negativeKey:positiveKey;
  48  |       const capBeforeMs=walkPulseCaps[axis];
  49  |       const holdMs=Math.max(25,Math.min(capBeforeMs,Math.round(Math.abs(value-target)/3*1000)));
  50  |       // Driver times measure this test runner, never DOM/native event time.
  51  |       const driverTimes:Record<string,number>={downIssuedMs:performance.now()};
  52  |       const down=page.keyboard.down(key).then(()=>{driverTimes.downAckMs=performance.now();});
  53  |       const up=new Promise<void>(resolve=>setTimeout(resolve,holdMs)).then(async()=>{
  54  |         driverTimes.upIssuedMs=performance.now();await page.keyboard.up(key);driverTimes.upAckMs=performance.now();
  55  |       });
  56  |       const failures:unknown[]=[];
  57  |       try{for(const result of await Promise.allSettled([down,up]))if(result.status==="rejected")failures.push(result.reason);}
  58  |       finally{
  59  |         // Fresh release after both requests settles any protocol-hook reordering.
  60  |         try{driverTimes.finalUpIssuedMs=performance.now();await page.keyboard.up(key);driverTimes.finalUpAckMs=performance.now();}
  61  |         catch(releaseError){
  62  |           failures.push(releaseError);
  63  |           try{await context.close();}catch(closeError){failures.push(closeError);}
  64  |         }
  65  |       }
  66  |       if(failures.length===1)throw failures[0];
  67  |       if(failures.length>1)throw new AggregateError(failures,"Trusted keyboard gesture or final release failed");
  68  |       let after=await readNative(page);const releasedReads=[after];
  69  |       // Every key is already released. Observe bounded real tick/pose readbacks;
  70  |       // delayed neutral delivery must settle before the next corrective press.
  71  |       for(let read=0;read<3;read++){
  72  |         const next=await readNative(page);releasedReads.push(next);
  73  |         const stable=next.ticks>after.ticks&&Math.abs(next.player.position.x-after.player.position.x)<0.000001
  74  |           &&Math.abs(next.player.position.z-after.player.position.z)<0.000001;
  75  |         after=next;if(stable)break;
  76  |       }
  77  |       const overshotTarget=(value-target)*(after.player.position[axis]-target)<0;
  78  |       if(overshotTarget)walkPulseCaps[axis]=Math.max(25,Math.round(capBeforeMs/2));
  79  |       nativeWalkTaps.push({axis,target,sourceStandWindow:window,key,holdMs,capBeforeMs,capAfterMs:walkPulseCaps[axis],overshotTarget,driverTimes,beforePlayer:before.player,afterPlayer:after.player,beforeTicks:before.ticks,afterTicks:after.ticks,releasedReads});
  80  |       await writeFile(path.join(runDirectory(),"browser-native-walk-taps.json"),JSON.stringify(nativeWalkTaps,null,2)+"\n");
  81  |     }
  82  |   };
  83  |   test("normal Play acquires the same actual native Walking session",async()=>{
  84  |     await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");await expect.poll(async()=>(await readNative(page)).player.status).toBe("Walking");
  85  |   });
  86  |   test("at most four actual released D/A taps approach the source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");});
> 87  |   test("at most four more released D/A taps confirm the actual source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");const native=await readNative(page);expect(native.player.position.x).toBeGreaterThanOrEqual(-6.4);expect(native.player.position.x).toBeLessThanOrEqual(-6.1);expect(native.player.grounded).toBe(true);});
      |                                                                                                                                                                                                             ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  88  |   test("at most four actual released S/W taps approach the source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");});
  89  |   test("at most four further released S/W taps continue the same native walk",async()=>{await tapToward("z",8.875,"s","w");});
  90  |   test("at most four further released S/W taps approach the actual Cutter stand",async()=>{await tapToward("z",8.875,"s","w");});
  91  |   test("at most four final released S/W taps confirm the actual source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");const native=await readNative(page),p=native.player.position,window=sourceStandDepth(p.x);expect(p.x).toBeGreaterThanOrEqual(-6.4);expect(p.x).toBeLessThanOrEqual(-6.1);expect(p.z).toBeGreaterThanOrEqual(window[0]);expect(p.z).toBeLessThanOrEqual(window[1]);expect(p.y).toBeGreaterThanOrEqual(2.38);expect(p.y).toBeLessThanOrEqual(2.44);expect(native.player.grounded).toBe(true);expect(native.factoryFacilities.cargo.accessible).toBe(true);
  92  |     const cargo=native.factoryFacilities.cargo.site.accessPointMm;expect(Math.hypot(p.x-cargo[0]/1000,p.y-cargo[1]/1000,p.z-cargo[2]/1000)).toBeLessThanOrEqual(4);
  93  |     expect(Math.hypot(-5.25-p.x,p.z-6.5)).toBeLessThanOrEqual(3);expect(Math.hypot(p.x+7.75,p.z-6.5)).toBeLessThanOrEqual(3);
  94  |   });
  95  |   test("Escape pauses the same walked session and native readback proves material and Cargo unchanged",async()=>{
  96  |     await page.keyboard.press("Escape");await expect.poll(async()=>(await readNative(page)).status).toBe("Paused");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  97  |     const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeCargo.containers);expect(after.massMg).toBe(beforeCargo.massMg);expect(after.cargo.positionMm).toEqual(beforeCargo.cargo.positionMm);expect(nativeAfter.ticks).toBeGreaterThan(nativeBeforeCargo.ticks);expect(nativeAfter.player.position.z).toBeLessThan(9.2);expect(nativeAfter.player.position.x).toBeLessThanOrEqual(-6.1);expect(nativeAfter.player.grounded).toBe(true);expect(nativeAfter.factoryFacilities.cargo.accessible).toBe(true);
  98  |     const directory=runDirectory();await writeFile(path.join(directory,"browser-cargo-open-native-walk.json"),JSON.stringify({before:beforeCargo,after,nativeBefore:nativeBeforeCargo,nativeAfter,nativeWalkTaps},null,2)+"\n");
  99  |   });
  100 |   test("T030 real move, quarter-turn and Escape retire the ghost with no native or material mutation",async()=>{
  101 |     const before=await readBuild(page);
  102 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  103 |     const ghost=await readBuild(page);expect(ghost.ghost.request.quarterTurns).toBe(1);
  104 |     await page.keyboard.press("ArrowRight");await expect.poll(async()=> (await readBuild(page)).ghost.request.centerMm[0]).toBe(-6000);
  105 |     await page.keyboard.press("r");await expect.poll(async()=> (await readBuild(page)).ghost.request.quarterTurns).toBe(2);
  106 |     await page.keyboard.press("Escape");await expect.poll(async()=> (await readBuild(page)).ghost).toBeNull();
  107 |     const after=await readBuild(page);expect(after.containers).toEqual(before.containers);expect(after.massMg).toBe(before.massMg);expect(after.installations).toEqual([]);expect(after.reservations).toBe(0);
  108 |     const directory=runDirectory();await mkdir(directory,{recursive:true});await writeFile(path.join(directory,"browser-ghost-cancel.json"),JSON.stringify({before,after},null,2)+"\n");
  109 |   });
  110 |   test("T029 a real confirmed build publishes exactly one paid208kg Cutter",async({},info)=>{
  111 |     const nativeBefore=await readNative(page),before=await readBuild(page);
  112 |     expect(before.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo").contents.filter((s:any)=>s.resourceId==="fp02_chassis_cutter").reduce((n:number,s:any)=>n+s.quantity,0)).toBe(1);
  113 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  114 |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect.poll(async()=> (await readBuild(page)).installations.length).toBe(1);
  115 |     await expect.poll(async()=> (await readBuild(page)).state).toBe("Ready");
  116 |     const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations[0].massMg).toBe(208_000_000);expect(state.reservations).toBe(0);
  117 |     const cargo=state.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo");expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_profile").quantity).toBe(68_000_000);expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_sheet").quantity).toBe(50_000_000);expect(cargo.contents.some((s:any)=>s.resourceId==="fp02_chassis_cutter")).toBe(false);
  118 |     const installed=state.containers.find((c:any)=>c.containerId===state.installations[0].materialContainerId);expect(installed.massKg).toBe(208);expect(installed.contents.find((s:any)=>s.resourceId==="fp02_chassis_cutter").extensions["factory.source"].cargoId).toBe("C26");
  119 |     const nativeAfter=await readNative(page);expect(nativeAfter.factoryFacilities.owners).toHaveLength(1);expect(nativeAfter.factoryFacilities.owners[0].instanceId).toBe(state.installations[0].instanceId);expect(nativeAfter.bodyCount).toBe(nativeBefore.bodyCount+1);expect(nativeAfter.factoryFacilities.owners[0].colliderHandles.length).toBeGreaterThan(0);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBefore.factoryFacilities.cargo.bodyHandle);
  120 |     const directory=runDirectory(),capture=await page.screenshot();await info.attach("paid-native-cutter",{body:capture,contentType:"image/png"});await writeFile(path.join(directory,"paid-native-cutter.png"),capture);await writeFile(path.join(directory,"browser-paid-cutter.json"),JSON.stringify({before,state,nativeBefore,nativeAfter,errors},null,2)+"\n");expect(errors).toEqual([]);
  121 |   });
  122 |   test("normal second-Cutter ghost moves seven quarter-grid steps toward the independent source-checked site",async()=>{
  123 |     beforeSecond=await readBuild(page);nativeBeforeSecond=await readNative(page);
  124 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();
  125 |     for(let step=0;step<7;step++)await page.keyboard.press("ArrowLeft");
  126 |     await expect.poll(async()=>(await readBuild(page)).ghost.request.centerMm[0]).toBe(-8000);
  127 |   });
  128 |   test("seven more actual ghost moves reach the disjoint supported site and specifically prove BOM_MISSING",async()=>{
  129 |     for(let step=0;step<7;step++)await page.keyboard.press("ArrowLeft");
  130 |     const state=await readBuild(page);expect(state.ghost.request.centerMm).toEqual([-9750,1500,5000]);expect(state.ghost.request.quarterTurns).toBe(1);
  131 |     await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
  132 |   });
  133 |   test("finite C26 failed confirmation preserves the complete first installation and all actual native members",async()=>{
  134 |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
  135 |     const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeSecond.containers);expect(after.installations).toEqual(beforeSecond.installations);expect(after.massMg).toBe(beforeSecond.massMg);expect(after.reservations).toBe(0);
  136 |     expect(nativeAfter.factoryFacilities.owners).toEqual(nativeBeforeSecond.factoryFacilities.owners);expect(nativeAfter.bodyCount).toBe(nativeBeforeSecond.bodyCount);expect(nativeAfter.colliderCount).toBe(nativeBeforeSecond.colliderCount);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBeforeSecond.factoryFacilities.cargo.bodyHandle);
  137 |     await page.keyboard.press("Escape");
  138 |     await writeFile(path.join(runDirectory(),"browser-second-cutter-depletion.json"),JSON.stringify({before:beforeSecond,after,nativeBefore:nativeBeforeSecond,nativeAfter},null,2)+"\n");
  139 |   });
  140 |   test("Legacy persistence stays closed and actual disposal retires paid Facility projection and native World",async()=>{
  141 |     await page.locator("#hvp-save").click();await expect(page.locator("#hvp-save-status")).toContainText("Rejected");await expect(page.locator("#hvp-save-status")).toContainText("Factory");
  142 |     page.once("dialog",dialog=>{void dialog.accept();});await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");await expect(page.locator("#factory-panel")).toHaveCount(0);await expect.poll(()=>page.workers().length).toBe(0);
  143 |     expect(await page.evaluate(()=>document.body.dataset.hestiaFactoryConstruction)).toBeUndefined();expect(errors).toEqual([]);
  144 |     const directory=runDirectory();await writeFile(path.join(directory,"browser-native-disposal.json"),await page.evaluate(()=>document.body.dataset.hestiaPrototypeDisposal!)+"\n");
  145 |   });
  146 | });
  147 | 
```