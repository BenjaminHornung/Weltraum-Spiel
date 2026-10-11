import { expect, test, type BrowserContext, type CDPSession, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const runDirectory=()=>{
  const run=process.env.WELTRAUM_FACTORY_EVIDENCE_RUN;
  if(!run||!/^[A-Za-z0-9._-]{1,100}$/.test(run))throw new Error("W07 needs its actual unique evidence run");
  return path.resolve("evidence/factory/w07",run);
};
const readNative=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics!));
const readBuild=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaFactoryConstruction!));

test.describe.serial("W07 real player construction in one confirmed Factory session",()=>{
  let context:BrowserContext,page:Page,keyboard:CDPSession;const errors:string[]=[];
  let beforeCargo:Awaited<ReturnType<typeof readBuild>>,nativeBeforeCargo:Awaited<ReturnType<typeof readNative>>;
  let beforeSecond:Awaited<ReturnType<typeof readBuild>>,nativeBeforeSecond:Awaited<ReturnType<typeof readNative>>;
  test.beforeAll(async({browser},info)=>{context=await browser.newContext({baseURL:info.project.use.baseURL});page=await context.newPage();keyboard=await context.newCDPSession(page);page.on("pageerror",error=>errors.push(error.message));});
  test.afterAll(async()=>{if(context)await context.close();});
  test("accepted source reaches Ready with one renderer and finite uninstalled Cargo",async()=>{
    await page.goto("/factory.html");await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit",{timeout:20_000});
    await expect(page.locator("canvas")).toHaveCount(1);await expect(page.locator("#hvp-hud")).toHaveCount(1);
    const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations).toEqual([]);expect(state.reservations).toBe(0);expect(state.cargo.opened).toBe(false);expect(state.cargo.accessible).toBe(true);expect(state.cargo.positionMm).toEqual([-5500,2000,13125]);
    expect((await readNative(page)).factoryFacilities.cargo.bodyHandle).toBe(state.cargo.bodyHandle);
    expect(await page.evaluate(()=>document.body.dataset.hestiaPrototypeVegetationCount)).toBe("97");
    expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);
  });
  test("closed Cargo refuses an actual build preview and Escape retires that ghost",async()=>{
    beforeCargo=await readBuild(page);nativeBeforeCargo=await readNative(page);
    await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("CARGO_CLOSED");await page.keyboard.press("Escape");
    await expect.poll(async()=>(await readBuild(page)).ghost).toBeNull();
  });
  test("normal Cargo Open is idempotent in this same actual native session",async()=>{
    await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect.poll(async()=>(await readBuild(page)).cargo.opened).toBe(true);
    const first=await readNative(page);await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Wrackfracht geöffnet");expect((await readNative(page)).factoryFacilities.revision).toBe(first.factoryFacilities.revision);
  });
  const nativeWalkTaps:unknown[]=[];
  const walkPulseCaps={x:125,z:125};
  // Read-only source preflight bb709f… proves these complete flat hull windows;
  // actual native ground, Cargo LOS/reach and normal previews remain required.
  const sourceStandDepth=(x:number):readonly[number,number]=>x<=-6.35?[8.75,9.15]:x<=-6.225?[8.725,9.075]:[8.7,9];
  const tapToward=async(axis:"x"|"z",target:number,negativeKey:string,positiveKey:string)=>{
    for(let tap=0;tap<4;tap++){
      const before=await readNative(page),value=before.player.position[axis];
      const window=axis==="x"?[-6.4,-6.1] as const:sourceStandDepth(before.player.position.x);
      if(value>=window[0]&&value<=window[1])break;
      target=(window[0]+window[1])/2;
      const key=value>target?negativeKey:positiveKey;
      const capBeforeMs=walkPulseCaps[axis];
      const holdMs=Math.max(25,Math.min(capBeforeMs,Math.round(Math.abs(value-target)/3*1000)));
      const keyCode=({a:65,d:68,s:83,w:87} as Record<string,number>)[key];if(keyCode===undefined)throw new Error("Unsupported walking key");
      const code="Key"+key.toUpperCase();
      const upEvent={type:"keyUp" as const,modifiers:0,key,windowsVirtualKeyCode:keyCode,code,location:0};
      // Source-bound Chromium RawKeyboard payload, same Page target and trace.
      // Driver times measure this test runner, never DOM/native event time.
      const driverTimes:Record<string,number>={downIssuedMs:performance.now()};
      const down=keyboard.send("Input.dispatchKeyEvent",{type:"keyDown",modifiers:0,windowsVirtualKeyCode:keyCode,code,commands:[],key,text:key,unmodifiedText:key,autoRepeat:false,location:0,isKeypad:false}).then(()=>{driverTimes.downAckMs=performance.now();});
      const up=new Promise<void>(resolve=>setTimeout(resolve,holdMs)).then(async()=>{
        driverTimes.upIssuedMs=performance.now();await keyboard.send("Input.dispatchKeyEvent",upEvent);driverTimes.upAckMs=performance.now();
      });
      const failures:unknown[]=[];
      try{for(const result of await Promise.allSettled([down,up]))if(result.status==="rejected")failures.push(result.reason);}
      finally{
        // Fresh release after both requests settles any protocol-hook reordering.
        try{driverTimes.finalUpIssuedMs=performance.now();await keyboard.send("Input.dispatchKeyEvent",upEvent);driverTimes.finalUpAckMs=performance.now();}
        catch(releaseError){
          failures.push(releaseError);
          try{await context.close();}catch(closeError){failures.push(closeError);}
        }
      }
      if(failures.length===1)throw failures[0];
      if(failures.length>1)throw new AggregateError(failures,"Trusted keyboard gesture or final release failed");
      let after=await readNative(page);const releasedReads=[after];
      // Every key is already released. Observe bounded real tick/pose readbacks;
      // delayed neutral delivery must settle before the next corrective press.
      for(let read=0;read<3;read++){
        const next=await readNative(page);releasedReads.push(next);
        const stable=next.ticks>after.ticks&&Math.abs(next.player.position.x-after.player.position.x)<0.000001
          &&Math.abs(next.player.position.z-after.player.position.z)<0.000001;
        after=next;if(stable)break;
      }
      const overshotTarget=(value-target)*(after.player.position[axis]-target)<0;
      if(overshotTarget)walkPulseCaps[axis]=Math.max(25,Math.round(capBeforeMs/2));
      nativeWalkTaps.push({axis,target,sourceStandWindow:window,key,holdMs,capBeforeMs,capAfterMs:walkPulseCaps[axis],overshotTarget,driverTimes,beforePlayer:before.player,afterPlayer:after.player,beforeTicks:before.ticks,afterTicks:after.ticks,releasedReads});
      await writeFile(path.join(runDirectory(),"browser-native-walk-taps.json"),JSON.stringify(nativeWalkTaps,null,2)+"\n");
    }
  };
  test("normal Play acquires the same actual native Walking session",async()=>{
    await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");await expect.poll(async()=>(await readNative(page)).player.status).toBe("Walking");
  });
  test("at most four actual released D/A taps approach the source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");});
  test("at most four more released D/A taps confirm the actual source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");const native=await readNative(page);expect(native.player.position.x).toBeGreaterThanOrEqual(-6.4);expect(native.player.position.x).toBeLessThanOrEqual(-6.1);expect(native.player.grounded).toBe(true);});
  test("at most four actual released S/W taps approach the source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");});
  test("at most four further released S/W taps continue the same native walk",async()=>{await tapToward("z",8.875,"s","w");});
  test("at most four further released S/W taps approach the actual Cutter stand",async()=>{await tapToward("z",8.875,"s","w");});
  test("at most four final released S/W taps confirm the actual source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");const native=await readNative(page),p=native.player.position,window=sourceStandDepth(p.x);expect(p.x).toBeGreaterThanOrEqual(-6.4);expect(p.x).toBeLessThanOrEqual(-6.1);expect(p.z).toBeGreaterThanOrEqual(window[0]);expect(p.z).toBeLessThanOrEqual(window[1]);expect(p.y).toBeGreaterThanOrEqual(2.38);expect(p.y).toBeLessThanOrEqual(2.44);expect(native.player.grounded).toBe(true);expect(native.factoryFacilities.cargo.accessible).toBe(true);
    const cargo=native.factoryFacilities.cargo.site.accessPointMm;expect(Math.hypot(p.x-cargo[0]/1000,p.y-cargo[1]/1000,p.z-cargo[2]/1000)).toBeLessThanOrEqual(4);
    expect(Math.hypot(-5.25-p.x,p.z-6.5)).toBeLessThanOrEqual(3);expect(Math.hypot(p.x+7.75,p.z-6.5)).toBeLessThanOrEqual(3);
  });
  test("Escape pauses the same walked session and native readback proves material and Cargo unchanged",async()=>{
    await page.keyboard.press("Escape");await expect.poll(async()=>(await readNative(page)).status).toBe("Paused");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
    const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeCargo.containers);expect(after.massMg).toBe(beforeCargo.massMg);expect(after.cargo.positionMm).toEqual(beforeCargo.cargo.positionMm);expect(nativeAfter.ticks).toBeGreaterThan(nativeBeforeCargo.ticks);expect(nativeAfter.player.position.z).toBeLessThan(9.2);expect(nativeAfter.player.position.x).toBeLessThanOrEqual(-6.1);expect(nativeAfter.player.grounded).toBe(true);expect(nativeAfter.factoryFacilities.cargo.accessible).toBe(true);
    const directory=runDirectory();await writeFile(path.join(directory,"browser-cargo-open-native-walk.json"),JSON.stringify({before:beforeCargo,after,nativeBefore:nativeBeforeCargo,nativeAfter,nativeWalkTaps},null,2)+"\n");
  });
  test("T030 real move, quarter-turn and Escape retire the ghost with no native or material mutation",async()=>{
    const before=await readBuild(page);
    await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
    const ghost=await readBuild(page);expect(ghost.ghost.request.quarterTurns).toBe(1);
    await page.keyboard.press("ArrowRight");await expect.poll(async()=> (await readBuild(page)).ghost.request.centerMm[0]).toBe(-6000);
    await page.keyboard.press("r");await expect.poll(async()=> (await readBuild(page)).ghost.request.quarterTurns).toBe(2);
    await page.keyboard.press("Escape");await expect.poll(async()=> (await readBuild(page)).ghost).toBeNull();
    const after=await readBuild(page);expect(after.containers).toEqual(before.containers);expect(after.massMg).toBe(before.massMg);expect(after.installations).toEqual([]);expect(after.reservations).toBe(0);
    const directory=runDirectory();await mkdir(directory,{recursive:true});await writeFile(path.join(directory,"browser-ghost-cancel.json"),JSON.stringify({before,after},null,2)+"\n");
  });
  test("T029 a real confirmed build publishes exactly one paid208kg Cutter",async({},info)=>{
    const nativeBefore=await readNative(page),before=await readBuild(page);
    expect(before.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo").contents.filter((s:any)=>s.resourceId==="fp02_chassis_cutter").reduce((n:number,s:any)=>n+s.quantity,0)).toBe(1);
    await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
    await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect.poll(async()=> (await readBuild(page)).installations.length).toBe(1);
    await expect.poll(async()=> (await readBuild(page)).state).toBe("Ready");
    const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations[0].massMg).toBe(208_000_000);expect(state.reservations).toBe(0);
    const cargo=state.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo");expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_profile").quantity).toBe(68_000_000);expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_sheet").quantity).toBe(50_000_000);expect(cargo.contents.some((s:any)=>s.resourceId==="fp02_chassis_cutter")).toBe(false);
    const installed=state.containers.find((c:any)=>c.containerId===state.installations[0].materialContainerId);expect(installed.massKg).toBe(208);expect(installed.contents.find((s:any)=>s.resourceId==="fp02_chassis_cutter").extensions["factory.source"].cargoId).toBe("C26");
    const nativeAfter=await readNative(page);expect(nativeAfter.factoryFacilities.owners).toHaveLength(1);expect(nativeAfter.factoryFacilities.owners[0].instanceId).toBe(state.installations[0].instanceId);expect(nativeAfter.bodyCount).toBe(nativeBefore.bodyCount+1);expect(nativeAfter.factoryFacilities.owners[0].colliderHandles.length).toBeGreaterThan(0);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBefore.factoryFacilities.cargo.bodyHandle);
    const directory=runDirectory(),capture=await page.screenshot();await info.attach("paid-native-cutter",{body:capture,contentType:"image/png"});await writeFile(path.join(directory,"paid-native-cutter.png"),capture);await writeFile(path.join(directory,"browser-paid-cutter.json"),JSON.stringify({before,state,nativeBefore,nativeAfter,errors},null,2)+"\n");expect(errors).toEqual([]);
  });
  test("normal second-Cutter ghost moves seven quarter-grid steps toward the independent source-checked site",async()=>{
    beforeSecond=await readBuild(page);nativeBeforeSecond=await readNative(page);
    await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();
    await expect.poll(async()=>{const request=(await readBuild(page)).ghost?.request;return request?{centerMm:request.centerMm,quarterTurns:request.quarterTurns}:null;}).toEqual({centerMm:[-6250,1500,5000],quarterTurns:1});
    for(let step=0;step<7;step++){
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async()=>(await readBuild(page)).ghost?.request.centerMm[0]).toBe(-6250-(step+1)*250);
    }
  });
  test("seven more actual ghost moves reach the disjoint supported site and specifically prove BOM_MISSING",async()=>{
    for(let step=0;step<7;step++){
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async()=>(await readBuild(page)).ghost?.request.centerMm[0]).toBe(-8000-(step+1)*250);
    }
    const state=await readBuild(page);expect(state.ghost.request.centerMm).toEqual([-9750,1500,5000]);expect(state.ghost.request.quarterTurns).toBe(1);
    await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
  });
  test("finite C26 failed confirmation preserves the complete first installation and all actual native members",async()=>{
    await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
    const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeSecond.containers);expect(after.installations).toEqual(beforeSecond.installations);expect(after.massMg).toBe(beforeSecond.massMg);expect(after.reservations).toBe(0);
    expect(nativeAfter.factoryFacilities.owners).toEqual(nativeBeforeSecond.factoryFacilities.owners);expect(nativeAfter.bodyCount).toBe(nativeBeforeSecond.bodyCount);expect(nativeAfter.colliderCount).toBe(nativeBeforeSecond.colliderCount);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBeforeSecond.factoryFacilities.cargo.bodyHandle);
    await page.keyboard.press("Escape");
    await writeFile(path.join(runDirectory(),"browser-second-cutter-depletion.json"),JSON.stringify({before:beforeSecond,after,nativeBefore:nativeBeforeSecond,nativeAfter},null,2)+"\n");
  });
  test("Legacy persistence stays closed and actual disposal retires paid Facility projection and native World",async()=>{
    await page.locator("#hvp-save").click();await expect(page.locator("#hvp-save-status")).toContainText("Rejected");await expect(page.locator("#hvp-save-status")).toContainText("Factory");
    page.once("dialog",dialog=>{void dialog.accept();});await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");await expect(page.locator("#factory-panel")).toHaveCount(0);await expect.poll(()=>page.workers().length).toBe(0);
    expect(await page.evaluate(()=>document.body.dataset.hestiaFactoryConstruction)).toBeUndefined();expect(errors).toEqual([]);
    const directory=runDirectory();await writeFile(path.join(directory,"browser-native-disposal.json"),await page.evaluate(()=>document.body.dataset.hestiaPrototypeDisposal!)+"\n");
  });
});
