import {expect,type Page} from "@playwright/test";
import type {HvpMeasuredRun,HvpPerfScenario} from "../e2e/hvp-performance-evidence";

// Fixed normal-input fixtures. No browser/solver/character state is written here.
export const HVP_WALK_ROUTE=Object.freeze([
  {id:"C01-EYE",x:-8,z:-11},{id:"C02-SHORE",x:-2,z:-6},
  {id:"C03-ROOTS",x:3,z:4},{id:"SALVAGE-CLEARING",x:-9,z:-9}
]);
export const measurementUrl=(scenario:HvpPerfScenario)=>
  `http://127.0.0.1:5173/?hestiaPrototype=1&hvpMeasure=1${scenario==="PERF-07"?"&hvpScenario=east-edge":""}`;
const read=(page:Page)=>page.evaluate(()=>{
  const p=JSON.parse(document.body.dataset.hestiaPrototypePhysics??"{}"),n=JSON.parse(document.body.dataset.hestiaPrototypeNeighbor??"{}");
  const c=JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera??"null");
  return {atMs:performance.now(),status:p.status,player:p.player,neighbor:n,nativeNeighbor:p.neighbor,
    colliderCount:p.colliderCount,generation:document.body.dataset.hestiaPrototypeTerrainGeneration,camera:c,
    input:JSON.parse(document.body.dataset.hestiaPrototypeInput??"{}"),clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??"null")};
});
const healthy=(s:Awaited<ReturnType<typeof read>>)=>{
  if(!["Running","Paused","CoverageHold"].includes(s.status)||s.neighbor.error||s.neighbor.recoveryHold){
    throw new Error(`Workload stopped: ${JSON.stringify(s)}`);
  }
};
const play=async(page:Page)=>{
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(async()=>{const s=await read(page);healthy(s);
    return s.player?.status==="Walking"&&s.input.owner==="Player"&&s.camera!==null;},{timeout:10_000}).toBe(true);
  expect(await page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
};
export const prepareHvpWorkload=async(page:Page,scenario:HvpPerfScenario):Promise<void>=>{
  if(scenario!=="PERF-01"&&scenario!=="PERF-05"){await play(page);}
};

export type HvpWorkloadProgress=Pick<HvpMeasuredRun,"crossings"|"route"|"walking"|"lifecycle">;
export const runHvpWorkload=async(page:Page,scenario:HvpPerfScenario,durationMs:number,progress:HvpWorkloadProgress={},collect?:()=>Promise<void>):Promise<HvpWorkloadProgress>=>{
  if(scenario==="PERF-01"){return progress;}
  if(scenario==="PERF-05"){
    if(!collect){throw new Error("Lifecycle collection must retain each document's raw population");}
    progress.lifecycle=[];
    const endAt=await page.evaluate(()=>performance.timeOrigin+performance.now())+durationMs;
    for(let cycle=0;cycle<20;cycle+=1){
      await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
      await page.getByRole("button",{name:"C04-WIDE",exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>Boolean(document.body.dataset.hestiaPrototypeOwnedRender)),{timeout:10_000}).toBe(true);
      const observed=await page.evaluate(()=>{const p=JSON.parse(document.body.dataset.hestiaPrototypePhysics!),r=JSON.parse(document.body.dataset.hestiaPrototypeOwnedRender!);
        if(p.status!=="Running"){throw new Error(`Lifecycle game failure: ${JSON.stringify({status:p.status,ticks:p.ticks,
          clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??"null"),atMs:performance.now(),origin:performance.timeOrigin})}`);}
        return {geometries:r.geometries,materials:r.materials,representations:r.representations,ownedBytes:r.ownedCpuBytes,bodies:p.bodyCount,colliders:p.colliderCount};});
      const retained={...observed,workers:page.workers().length};
      if(cycle===19){const remaining=endAt-await page.evaluate(()=>performance.timeOrigin+performance.now());if(remaining>0){await page.waitForTimeout(remaining);}}
      const stamp=await page.evaluate(()=>performance.now());
      await page.waitForFunction(start=>(window as unknown as {hvpRawMeasurements:()=>{entries:{name:string;start:number}[]}}).hvpRawMeasurements().entries
        .some(e=>e.name==="hvp.resources"&&e.start>=start),stamp,{timeout:5_000});
      await collect();
      page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();
      await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet",{timeout:30_000});
      const receipt=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeDisposal!));
      progress.lifecycle.push({cycle,disposed:receipt.disposed,retained});await collect();
      if(receipt.state!=="Disposed"||receipt.errors.length||receipt.cacheBytes!==0||Object.values(receipt.disposed).some(v=>v!==0)){
        throw new Error(`Incomplete native/resource disposal: ${JSON.stringify(receipt)}`);
      }
      await expect.poll(()=>page.workers().length).toBe(0);
      if(cycle<19){await page.getByRole("button",{name:"Neu starten",exact:true}).click();}
    }
    return progress;
  }
  if(scenario==="PERF-07"){
    const crossings:NonNullable<HvpMeasuredRun["crossings"]>=[];
    progress.crossings=crossings;
    const walk=async(east:boolean)=>{
      const key=east?"KeyW":"KeyS";
      await page.keyboard.down("ShiftLeft");await page.keyboard.down(key);
      try{await expect.poll(async()=>{const s=await read(page);healthy(s);
        return east?s.player.position.x>17:s.player.position.x<3.5;},{timeout:60_000,intervals:[16,32,50]}).toBe(true);}
      finally{await page.keyboard.up(key);await page.keyboard.up("ShiftLeft");}
      await expect.poll(async()=>{const s=await read(page);healthy(s);return !s.neighbor.busy&&Boolean(s.nativeNeighbor?.resident)===east;},{timeout:60_000}).toBe(true);
      await expect.poll(async()=>{const s=await read(page);healthy(s);return s.player.grounded;},{timeout:5_000}).toBe(true);
      const s=await read(page);healthy(s);return s;
    };
    let source:string|undefined,colliders:number|undefined;
    for(let i=0;i<20;i+=1){
      const out=await walk(true),back=await walk(false);
      source??=out.neighbor.sourceDigest;colliders??=out.colliderCount;
      const confirmed=out.neighbor.collisionReady===true&&out.nativeNeighbor?.resident===true&&out.colliderCount===colliders;
      const intact=out.player.position.y>-7&&back.player.position.y>-7&&out.neighbor.sourceDigest===source&&back.neighbor.sourceDigest===source
        &&out.generation==="0"&&back.generation==="0";
      crossings.push({id:`crossing-${i+1}`,outbound:out.player.position.x>17,inbound:back.player.position.x<3.5,collisionReady:confirmed,holeFree:intact});
      expect(confirmed&&intact,JSON.stringify({out,back})).toBe(true);
    }
    return progress;
  }
  if(scenario==="PERF-02"){
    const route:NonNullable<HvpMeasuredRun["route"]>=[];
    const walking:NonNullable<HvpMeasuredRun["walking"]>=[];progress.route=route;progress.walking=walking;
    const cursor={x:640,y:360};
    const endAt=(await read(page)).atMs+durationMs;let segment=0;
    while((await read(page)).atMs<endAt){
      const target=HVP_WALK_ROUTE[segment%HVP_WALK_ROUTE.length]!;segment+=1;
      const started=Date.now();let previous=await read(page),progressAt=Date.now(),jumpAt=0,distance=0;
      let lastPosition=previous.player.position;const startMs=previous.atMs;
      await page.keyboard.down("KeyW");
      try{while(true){
        const s=await read(page);healthy(s);
        distance+=Math.hypot(s.player.position.x-lastPosition.x,s.player.position.z-lastPosition.z);lastPosition=s.player.position;
        if(s.input.owner!=="Player"){throw new Error(`Walking input lost: ${JSON.stringify(s)}`);}
        const dx=target.x-s.player.position.x,dz=target.z-s.player.position.z;
        if(s.generation!=="0"){throw new Error("Walking workload must not edit canonical cells");}
        if(s.atMs>=endAt){break;}
        if(Math.hypot(dx,dz)<=.6){route.push({id:target.id,atMs:s.atMs,position:{...s.player.position},rootRevision:0});break;}
        if(Date.now()-started>30_000){throw new Error(`Walking route blocked at ${target.id}: ${JSON.stringify(s)}`);}
        const [x,y,z,w]=s.camera.orientation as number[];
        const fx=-2*(x!*z!+w!*y!),fz=2*(x!*x!+y!*y!)-1;
        let angle=Math.atan2(dx,dz)-Math.atan2(fx,fz);
        while(angle>Math.PI){angle-=2*Math.PI;}while(angle< -Math.PI){angle+=2*Math.PI;}
        const pitch=Math.asin(Math.max(-1,Math.min(1,2*(w!*x!-y!*z!))));
        cursor.x+=Math.max(-180,Math.min(180,-angle/.002));cursor.y+=Math.max(-100,Math.min(100,pitch/.002));
        await page.mouse.move(cursor.x,cursor.y);
        if(Math.hypot(s.player.position.x-previous.player.position.x,s.player.position.z-previous.player.position.z)>.05){progressAt=Date.now();previous=s;}
        if(s.player.grounded&&Date.now()-progressAt>500&&Date.now()-jumpAt>600){await page.keyboard.press("Space");jumpAt=Date.now();}
        await page.waitForTimeout(50);
      }}finally{await page.keyboard.up("KeyW");const last=await read(page);
        walking.push({startMs,endMs:last.atMs,distanceMeters:distance});}
    }
    return progress;
  }
  throw new Error(`Workload ${scenario} is not implemented; no substitute population collected`);
};
