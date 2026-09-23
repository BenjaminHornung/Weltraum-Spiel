import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {Quaternion,Vector3} from "three";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const pngName = "hvp-visible-coast-1920x1080.png";
const recordEvidence = process.env.WELTRAUM_RECORD_EVIDENCE === "1";
const hvpDimensions = { width: 1920, height: 1080 } as const;
const focusedCommand = "npx playwright test tests/e2e/hvp-visible-coast.spec.ts --reporter=list";

interface PixelEvidenceContract {
  readonly dimensions: typeof hvpDimensions;
  readonly perChannelTolerance: 12;
  readonly nonEmptyMinimumRatio: 0.01;
  readonly minimumDistinctColorCount: 4;
  readonly minimumPalettePixels: 256;
  readonly minimumWaterFamilyRatio: 0.01;
  readonly minimumTerrainFamilyRatio: 0.01;
  readonly liveFrameDelta: {
    readonly minChangedPixels: 0;
    readonly maxChangedPixels: 8192;
  };
}

const pixelEvidenceContract: PixelEvidenceContract = {
  dimensions: hvpDimensions,
  perChannelTolerance: 12,
  nonEmptyMinimumRatio: 0.01,
  minimumDistinctColorCount: 4,
  minimumPalettePixels: 256,
  minimumWaterFamilyRatio: 0.01,
  minimumTerrainFamilyRatio: 0.01,
  liveFrameDelta: {
    minChangedPixels: 0,
    maxChangedPixels: 8192
  }
};

interface PixelComparison {
  readonly width: number;
  readonly height: number;
  readonly changedPixels: number;
  readonly changedRatio: number;
  readonly maximumChannelDelta: number;
}

interface CanvasMetrics {
  readonly width: number;
  readonly height: number;
  readonly nonBackgroundPixels: number;
  readonly nonBackgroundRatio: number;
  readonly distinctColorCount: number;
  readonly waterFamilyPixels: number;
  readonly terrainFamilyPixels: number;
}

const persistDeterministicEvidence = async (fileName: string, content: Buffer | string): Promise<void> => {
  const filePath = path.join(evidenceDirectory, fileName);
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  try {
    if ((await readFile(filePath)).equals(bytes)) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!recordEvidence) {
    throw new Error(`Evidence differs at ${fileName}; rerun with WELTRAUM_RECORD_EVIDENCE=1 to record it explicitly.`);
  }
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(filePath, bytes);
};

const readStoredPngEvidence = async (directory: string): Promise<Buffer> => {
  const filePath = path.join(directory, pngName);
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing stored PNG evidence at ${filePath}; record it explicitly with WELTRAUM_RECORD_EVIDENCE=1.`, { cause: error });
    }
    throw error;
  }
};

const decodeAndCompare = async (page: Page, expected: Buffer, actual: Buffer): Promise<PixelComparison> =>
  page.evaluate(async ({ expectedBase64, actualBase64, perChannelTolerance }) => {
    const decode = async (base64: string): Promise<{ width: number; height: number; pixels: Uint8ClampedArray }> => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("Canvas 2D context unavailable for PNG comparison");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      return { width: canvas.width, height: canvas.height, pixels };
    };
    const expectedImage = await decode(expectedBase64);
    const actualImage = await decode(actualBase64);
    if (expectedImage.width !== actualImage.width || expectedImage.height !== actualImage.height) {
      throw new Error(`PNG size mismatch: ${expectedImage.width}x${expectedImage.height} vs ${actualImage.width}x${actualImage.height}`);
    }
    let changedPixels = 0;
    let maximumChannelDelta = 0;
    for (let offset = 0; offset < expectedImage.pixels.length; offset += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(expectedImage.pixels[offset + channel] - actualImage.pixels[offset + channel]);
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
        if (delta > perChannelTolerance) changed = true;
      }
      if (changed) changedPixels += 1;
    }
    return {
      width: actualImage.width,
      height: actualImage.height,
      changedPixels,
      changedRatio: changedPixels / (actualImage.width * actualImage.height),
      maximumChannelDelta
    };
  }, {
    expectedBase64: expected.toString("base64"),
    actualBase64: actual.toString("base64"),
    perChannelTolerance: pixelEvidenceContract.perChannelTolerance
  });

const measureCanvas = async (page: Page, image: Buffer): Promise<CanvasMetrics> =>
  page.evaluate(async ({ base64, perChannelTolerance, minimumPalettePixels }) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Canvas 2D context unavailable for PNG measurement");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0], pixels[1], pixels[2], pixels[3]];
    let nonBackgroundPixels = 0;
    let waterFamilyPixels = 0;
    let terrainFamilyPixels = 0;
    const colorBuckets = new Map<string, number>();
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const red = pixels[offset]!;
      const green = pixels[offset + 1]!;
      const blue = pixels[offset + 2]!;
      const differs = background.some((value, channel) => Math.abs(value - pixels[offset + channel]!) > perChannelTolerance);
      if (!differs) continue;
      nonBackgroundPixels += 1;
      const bucket = `${Math.floor(red / 16)},${Math.floor(green / 16)},${Math.floor(blue / 16)}`;
      colorBuckets.set(bucket, (colorBuckets.get(bucket) ?? 0) + 1);
      if (blue >= 64 && blue - red >= 28 && green - red >= 14) waterFamilyPixels += 1;
      if (red >= 80 && red - blue >= 16 && green - blue >= 8) terrainFamilyPixels += 1;
    }
    if (nonBackgroundPixels === 0) throw new Error("HVP canvas is empty");
    return {
      width: canvas.width,
      height: canvas.height,
      nonBackgroundPixels,
      nonBackgroundRatio: nonBackgroundPixels / (canvas.width * canvas.height),
      distinctColorCount: [...colorBuckets.values()].filter((count) => count >= minimumPalettePixels).length,
      waterFamilyPixels,
      terrainFamilyPixels
    };
  }, {
    base64: image.toString("base64"),
    perChannelTolerance: pixelEvidenceContract.perChannelTolerance,
    minimumPalettePixels: pixelEvidenceContract.minimumPalettePixels
  });

const assertCanvasEvidence = async (page: Page, name: string, image: Buffer): Promise<CanvasMetrics> => {
  const metrics = await measureCanvas(page, image);
  expect(metrics.width, `${name} must use the deterministic 1920 width`).toBe(hvpDimensions.width);
  expect(metrics.height, `${name} must use the deterministic 1080 height`).toBe(hvpDimensions.height);
  expect(metrics.nonBackgroundRatio, `${name} must be visibly non-empty`).toBeGreaterThan(pixelEvidenceContract.nonEmptyMinimumRatio);
  expect(metrics.distinctColorCount, `${name} must contain several stable palette colors`).toBeGreaterThan(
    pixelEvidenceContract.minimumDistinctColorCount
  );
  expect(metrics.waterFamilyPixels, `${name} must contain the water color family`).toBeGreaterThan(
    hvpDimensions.width * hvpDimensions.height * pixelEvidenceContract.minimumWaterFamilyRatio
  );
  expect(metrics.terrainFamilyPixels, `${name} must contain the terrain color family`).toBeGreaterThan(
    hvpDimensions.width * hvpDimensions.height * pixelEvidenceContract.minimumTerrainFamilyRatio
  );
  return metrics;
};

const renderBlankPng = async (page: Page, width: number, height: number): Promise<Buffer> => {
  const blankImageBase64 = await page.evaluate(({ w, h }) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, { w: width, h: height });
  return Buffer.from(blankImageBase64, "base64");
};

const renderWrongSizePng = async (page: Page, width: number, height: number): Promise<Buffer> => {
  const imageBase64 = await page.evaluate(({ w, h }) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context unavailable for wrong-size PNG");
    context.fillStyle = "#ff00ff";
    context.fillRect(Math.floor(w / 2), Math.floor(h / 2), 1, 1);
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, { w: width, h: height });
  return Buffer.from(imageBase64, "base64");
};

const loadAndValidateStoredHvpEvidence = async (page: Page, directory: string): Promise<Buffer> => {
  const stored = await readStoredPngEvidence(directory);
  await assertCanvasEvidence(page, `stored ${pngName}`, stored);
  return stored;
};

const readHvpSaveRecord=(page:Page)=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("weltraum-hestia-prototype-v1");
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{r.transaction?.abort();reject(new Error("Expected existing HVP database"));};});
  try{const record=await new Promise<{metadata:unknown;payloadBytes:Uint8Array}>((resolve,reject)=>{
    const r=db.transaction("saveSlots","readonly").objectStore("saveSlots").get("hvp-primary");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const hash=await crypto.subtle.digest("SHA-256",new Uint8Array(record.payloadBytes));
    return {metadata:record.metadata,hash:Array.from(new Uint8Array(hash)),payload:new TextDecoder().decode(record.payloadBytes)};
  }finally{db.close();}
});
const abortNextHvpSave=(page:Page)=>page.evaluate(()=>{
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){const result=put.call(this,value,key);
    if(this.name==="saveSlots"&&this.transaction.db.name==="weltraum-hestia-prototype-v1"){
      IDBObjectStore.prototype.put=put;result.addEventListener("success",()=>this.transaction.abort(),{once:true});
    }return result;};
});

const waitForHvpPlayer = async (page: Page): Promise<void> => {
  await expect.poll(() => page.evaluate(() => ({
    locked: document.pointerLockElement?.id,
    owner: JSON.parse(document.body.dataset.hestiaPrototypeInput ?? "{}").owner,
    status: JSON.parse(document.body.dataset.hestiaPrototypePhysics ?? "{}").player?.status
  }))).toEqual({ locked: "debug-scene", owner: "Player", status: "Walking" });
};

test.use({ viewport: { width: 1920, height: 1080 } });

test("HVP-14 the real end-session action releases owned resources before another start",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/?hestiaPrototype=1");
  const receipts:unknown[]=[];
  for(let cycle=0;cycle<2;cycle+=1){
    await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
    if(cycle===0){page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();
      await expect(page.locator("#hvp-state")).toContainText("State: Ready");}
    page.once("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();
    await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet",{timeout:30_000});
    const receipt=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeDisposal!));receipts.push(receipt);
    expect(receipt.state,JSON.stringify(receipt)).toBe("Disposed");expect(receipt.errors).toEqual([]);
    for(const name of ["geometries","materials","textures","workers","listeners","timers","pendingJobs","bodies","colliders","ownedBytes"]){expect(receipt.disposed[name],name).toBe(0);}
    expect(receipt.visual).toMatchObject({geometries:0,textures:0});expect(receipt.cacheBytes).toBe(0);
    await expect.poll(()=>page.workers().length).toBe(0);
    await expect(page.locator("#hvp-hud")).toHaveCount(0);await expect(page.locator("#hvp-player-pause")).toHaveCount(0);
    if(cycle===0){await page.getByRole("button",{name:"Neu starten",exact:true}).click();}
  }
  await testInfo.attach("actual-disposal-receipts",{body:JSON.stringify(receipts),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

for(const reload of [false,true]) {
test(`HVP-13 a sleeping terrain fragment dematerializes and returns from its checkpoint (${reload?"cold":"live"})`,async({page},testInfo)=>{
  test.setTimeout(180_000);
  await page.goto("/?hestiaPrototype=1&hvpScenario=rock-arm");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  let recordedHold=false;
  const read=async()=>{const state=await page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),tool:JSON.parse(document.body.dataset.hestiaPrototypeTool!),
    dormancy:JSON.parse(document.body.dataset.hestiaPrototypeBodyResidency??"{}"),neighbor:JSON.parse(document.body.dataset.hestiaPrototypeNeighbor??"{}"),
    save:JSON.parse(document.body.dataset.hestiaPrototypeSave??"{}"),
    clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??"null"),
    camera:JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera??"null")}));
    if(state.physics.status==="SimulationHold"&&!recordedHold){recordedHold=true;
      console.info("HVP-DORMANCY-FIRST-HOLD",JSON.stringify({clock:state.clock,physics:state.physics,neighbor:state.neighbor}));
      await testInfo.attach("first-residency-simulation-hold",{body:JSON.stringify(state,null,2),contentType:"application/json"});
    }
    return state;
  };
  await page.getByRole("button",{name:"Stütze anvisieren (2 + Klick)",exact:true}).click();
  const box=await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).boundingBox();if(!box){throw new Error("Missing play control");}
  const cursor={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).tool.message).toContain("Stützzellen");
  await waitForHvpPlayer(page);
  const aim=async(target:Vector3|number)=>{
    for(let i=0;i<4;i+=1){const s=await read(),q=new Quaternion().fromArray(s.camera.orientation),f=new Vector3(0,0,-1).applyQuaternion(q);
      const p=s.physics.player.position,desired=typeof target==="number"?new Vector3(target,0,0):target.clone().sub(new Vector3(p.x,p.y+.75,p.z)).normalize();
      if(f.dot(desired)>.9999){return;}
      const delta=Math.atan2(Math.sin(Math.atan2(-desired.x,-desired.z)-Math.atan2(-f.x,-f.z)),Math.cos(Math.atan2(-desired.x,-desired.z)-Math.atan2(-f.x,-f.z)));
      cursor.x-=delta/.002;cursor.y+=(Math.asin(f.y)-Math.asin(desired.y))/.002;await page.mouse.move(cursor.x,cursor.y);
      await expect.poll(async()=>(await read()).physics.ticks).toBeGreaterThan(s.physics.ticks);
    }
  };
  const walk=async(key:string,done:(p:{x:number;z:number})=>boolean,segments:number)=>{
    await page.keyboard.down(key);
    for(let i=0;i<segments&&!done((await read()).physics.player.position);i+=1){
      const s=await read();if(s.physics.player.grounded){await page.keyboard.press("Space");}
      await expect.poll(async()=>{const now=await read();return done(now.physics.player.position)||now.physics.ticks>s.physics.ticks+30;},
        {timeout:20_000,intervals:[20,40,80]}).toBe(true);
    }
    await page.keyboard.up(key);const result=await read();
    expect(done(result.physics.player.position),JSON.stringify({key,player:result.physics.player,status:result.physics.status,neighbor:result.neighbor,camera:result.camera,
      input:await page.evaluate(()=>document.body.dataset.hestiaPrototypeInput)})).toBe(true);
  };
  // Leave the overhang before detaching it, instead of standing under the fall.
  await aim(1);await walk("KeyW",p=>p.x>10.25,12);
  await expect.poll(async()=>{const s=await read();if(s.neighbor.error){throw new Error(s.neighbor.error);}return s.neighbor.busy;},
    {timeout:60_000}).toBe(false);
  // Stop/Read cross an asynchronous solver boundary: correct overshoot with
  // ordinary short backwards steps rather than snapping the player's pose.
  for(let i=0;i<8&&(await read()).physics.player.position.x>=10.35;i+=1){
    const tick=(await read()).physics.ticks;
    await page.keyboard.press("KeyS",{delay:100});
    await expect.poll(async()=>(await read()).physics.ticks).toBeGreaterThan(tick+12);
  }
  expect((await read()).physics.player.position.x).toBeLessThan(10.5);
  await expect.poll(async()=>(await read()).physics.player.grounded,{timeout:10_000}).toBe(true);
  await aim(new Vector3(6.4999,2.0625,-6.25));
  await expect.poll(async()=>(await read()).tool.message).toContain("Stützzellen");
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.last?.status,{timeout:30_000}).toBe("Applied");
  const fragment=(await read()).physics.terrainFragments[0];
  await expect.poll(async()=>(await read()).physics.bodies.find((b:{ownerId:string})=>b.ownerId===fragment.ownerId).sleeping,{timeout:20_000}).toBe(true);
  await testInfo.attach("sleeping-terrain-fragment",{body:await page.screenshot(),contentType:"image/png"});
  await aim(1);
  // Walk south around the real root tree at (12,-6), not through its collider.
  await walk("KeyA",p=>p.z<-10.5,12);
  await walk("KeyW",p=>p.x>26.5,16);
  const far=await read();
  await testInfo.attach("body-residency-far-observation",{body:JSON.stringify(far),contentType:"application/json"});
  expect(far.physics.player.position.x).toBeGreaterThan(26.5);
  await expect.poll(async()=>{const s=await read();return {
    parked:s.physics.parked.some((p:{ownerId:string})=>p.ownerId===fragment.ownerId),
    body:s.physics.bodies.find((b:{ownerId:string})=>b.ownerId===fragment.ownerId),
    player:s.physics.player.position,dormancy:s.dormancy,physicsStatus:s.physics.status
  };},{timeout:20_000}).toMatchObject({parked:true});
  await expect.poll(async()=>(await read()).dormancy.parkedRenderOwners).toContain(fragment.ownerId);
  const parked=await read();expect(parked.physics.bodies.some((b:{ownerId:string})=>b.ownerId===fragment.ownerId)).toBe(false);
  expect(parked.physics.terrainFragments.find((b:{ownerId:string})=>b.ownerId===fragment.ownerId).sourceDigest).toBe(fragment.sourceDigest);
  let saved:Awaited<ReturnType<typeof read>>|undefined,restored:Awaited<ReturnType<typeof read>>|undefined;
  if(reload){
  // Save the genuinely dematerialized owner, then destroy the whole document.
  await expect.poll(async()=>(await read()).neighbor.busy).toBe(false);
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:60_000}).not.toBe("Saving");
  expect((await read()).save,JSON.stringify((await read()).save)).toMatchObject({state:"Saved",revision:1});
  saved=await read();
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Gespeicherte Sitzung neu öffnen",exact:true}).click();
  await expect(page).toHaveURL(/hvpLoad=primary/);await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:60_000});
  restored=await read();expect(restored.save).toMatchObject({state:"Loaded",revision:1});
  expect(restored.physics.parked).toEqual(saved.physics.parked);expect(restored.physics.bodies).toEqual(saved.physics.bodies);
  expect(restored.physics.terrainFragments).toEqual(saved.physics.terrainFragments);
  expect(restored.dormancy.parkedRenderOwners).toContain(fragment.ownerId);
  const play=await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).boundingBox();if(!play){throw new Error("Missing restored play control");}
  cursor.x=play.x+play.width/2;cursor.y=play.y+play.height/2;
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.hestiaPrototypePlayerCamera)).toBeTruthy();
  await waitForHvpPlayer(page);
  }
  const parkedBody=parked.physics.parked.find((body:{ownerId:string})=>body.ownerId===fragment.ownerId);
  expect(parkedBody).toBeTruthy();
  await aim(-1);
  try {
    // Remain within the 12 m wake radius while neighbour work owns the World.
    // Walking through the entire radius can miss the first safe restore tick.
    try {
      await page.keyboard.down("KeyW");
      await expect.poll(async()=>{
        const state=await read(),p=state.physics.player.position;
        if(state.physics.status==="SimulationHold"){throw new Error(`Unexpected residency SimulationHold: ${JSON.stringify(state)}`);}
        return state.physics.bodies.some((b:{ownerId:string})=>b.ownerId===fragment.ownerId)
          ||Math.hypot(p.x-parkedBody.position.x,p.z-parkedBody.position.z)<10;
      },{timeout:30_000,intervals:[16,32,50]}).toBe(true);
    } finally { await page.keyboard.up("KeyW"); }
    await expect.poll(async()=>{const state=await read();
      if(state.physics.status==="SimulationHold"){throw new Error(`Unexpected residency SimulationHold: ${JSON.stringify(state)}`);}
      return state.physics.bodies.some((b:{ownerId:string})=>b.ownerId===fragment.ownerId);
    },{timeout:30_000,intervals:[16,32,50]}).toBe(true);
  } catch(error) {
    await testInfo.attach("body-residency-failure-clock",{body:JSON.stringify(await read(),null,2),contentType:"application/json"});throw error;
  }
  await expect.poll(async()=>(await read()).dormancy.busy).toBe(false);
  const near=await read();expect(near.dormancy.parkedRenderOwners).not.toContain(fragment.ownerId);
  expect(near.dormancy.error).toBe("");expect(near.physics.bodyResidencyTransaction).toBe("Idle");
  expect(near.physics.terrainFragments.find((b:{ownerId:string})=>b.ownerId===fragment.ownerId)).toEqual(fragment);
  await testInfo.attach("restored-terrain-fragment",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("body-residency-checkpoint-round-trip",{body:JSON.stringify({reload,fragment,parked,saved,restored,near}),contentType:"application/json"});
});
}

test("HVP-13 real walking admits eastern collision and replaces overlapping projections",async({page},testInfo)=>{
  test.setTimeout(180_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?hestiaPrototype=1&hvpScenario=east-edge");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),
    neighbor:JSON.parse(document.body.dataset.hestiaPrototypeNeighbor!),resources:JSON.parse(document.body.dataset.hestiaPrototypeResources!),
    generation:document.body.dataset.hestiaPrototypeTerrainGeneration,admission:document.body.dataset.hestiaPrototypeNeighborAdmission,
    clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??"null"),input:JSON.parse(document.body.dataset.hestiaPrototypeInput??"{}"),
    save:JSON.parse(document.body.dataset.hestiaPrototypeSave!)}));
  const before=await read();expect(before.physics.player.position.x).toBe(7);expect(before.physics.neighbor).toBeNull();
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).not.toBe("Saving");
  expect((await read()).save).toMatchObject({state:"Saved",revision:1});
  const absentSave=await read();
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.status).toBe("Walking");
  await page.keyboard.down("KeyW");
  try{await expect.poll(async()=>{const s=await read();if(s.neighbor.error){throw new Error(`${s.neighbor.error}: ${s.admission}`);}return s.physics.player.position.x;},{timeout:60_000}).toBeGreaterThan(17);}
  finally{await page.keyboard.up("KeyW");}
  const after=await read();expect(after.physics.neighbor.resident).toBe(true);expect(after.neighbor.collisionReady).toBe(true);
  expect(after.physics.colliderCount).toBeGreaterThan(before.physics.colliderCount);expect(after.generation).toBe(before.generation);
  expect(after.resources.ledger.triangles).toBeLessThanOrEqual(500_000);expect(after.resources.ledger.totalCpuBytes).toBeLessThanOrEqual(256*1024*1024);
  await testInfo.attach("east-region-real-walk",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("east-region-admission",{body:JSON.stringify({before,after},null,2),contentType:"application/json"});
  await expect.poll(async()=>(await read()).neighbor.busy).toBe(false);
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await expect.poll(async()=>(await read()).physics.status).toBe("Paused");
  // The old World and its leased render products stay owned until the saved
  // no-neighbour generation is ready. This is a live restore, not a reload.
  await page.getByRole("button",{name:"Spielstand laden",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:60_000}).not.toBe("Loading");
  const absentLoaded=await read();expect(absentLoaded.save,JSON.stringify(absentLoaded.save)).toMatchObject({state:"Loaded",revision:1});
  expect(absentLoaded.physics.neighbor).toBeNull();expect(absentLoaded.neighbor.collisionReady).toBe(false);
  expect(absentLoaded.physics.bodies).toEqual(absentSave.physics.bodies);expect(absentLoaded.physics.player.position).toEqual(absentSave.physics.player.position);
  const walk=async(east:boolean)=>{
    await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
    await expect.poll(async()=>(await read()).physics.player.status).toBe("Walking");
    await page.keyboard.down("ShiftLeft");await page.keyboard.down(east?"KeyW":"KeyS");
    try{await expect.poll(async()=>{const s=await read();if(s.neighbor.error||s.neighbor.recoveryHold){throw new Error(`${s.neighbor.error}: ${s.admission}`);}
      if(s.physics.status==="SimulationHold"){throw new Error(`Uninterrupted walk held: ${JSON.stringify(s)}`);}
      return east?s.physics.player.position.x>17:s.physics.player.position.x<3.5;},{timeout:60_000}).toBe(true);}
    finally{await page.keyboard.up(east?"KeyW":"KeyS");await page.keyboard.up("ShiftLeft");}
    await expect.poll(async()=>(await read()).neighbor.busy,{timeout:60_000}).toBe(false);
    await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
    await expect.poll(async()=>(await read()).physics.status).toBe("Paused");
  };
  await walk(true);
  const saved=await read();
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).not.toBe("Saving");
  expect((await read()).save,JSON.stringify((await read()).save)).toMatchObject({state:"Saved",revision:2});
  await walk(false);expect((await read()).physics.neighbor.resident).toBe(false);
  await page.getByRole("button",{name:"Spielstand laden",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:60_000}).not.toBe("Loading");
  const hotLoaded=await read();expect(hotLoaded.save,JSON.stringify(hotLoaded.save)).toMatchObject({state:"Loaded",revision:2});
  expect(hotLoaded.physics.neighbor).toEqual(saved.physics.neighbor);expect(hotLoaded.neighbor.collisionReady).toBe(true);
  expect(hotLoaded.physics.bodies).toEqual(saved.physics.bodies);expect(hotLoaded.physics.player.position).toEqual(saved.physics.player.position);
  expect(hotLoaded.physics.ticks).toBe(saved.physics.ticks);
  await testInfo.attach("east-region-live-generation-replacements",{body:JSON.stringify({absentSave,absentLoaded,saved,hotLoaded},null,2),contentType:"application/json"});
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Gespeicherte Sitzung neu öffnen",exact:true}).click();
  await expect(page).toHaveURL(/hvpLoad=primary/);
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:45_000});
  const loaded=await read();expect(loaded.save.state).toBe("Loaded");expect(loaded.physics.neighbor).toEqual(saved.physics.neighbor);
  expect(loaded.neighbor.sourceDigest).toBe(saved.neighbor.sourceDigest);expect(loaded.neighbor.collisionReady).toBe(true);
  expect(loaded.physics.player.position).toEqual(saved.physics.player.position);expect(loaded.physics.bodies).toEqual(saved.physics.bodies);
  expect(loaded.physics.ticks).toBe(saved.physics.ticks);expect(loaded.resources.ledger.totalCpuBytes).toBeLessThanOrEqual(256*1024*1024);
  await testInfo.attach("east-region-cold-restore",{body:JSON.stringify({saved,loaded},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

// The filtered resource check runs with --trace off; it attaches its own raw
// samples and does not claim a timing benchmark. Other test tracing is unchanged.
test("HVP-13 twenty real round trips keep the regional cache and native/render resources bounded",async({page},testInfo)=>{
  test.setTimeout(600_000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/?hestiaPrototype=1&hvpScenario=east-edge");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),neighbor:JSON.parse(document.body.dataset.hestiaPrototypeNeighbor!),
    resources:JSON.parse(document.body.dataset.hestiaPrototypeResources!),frame:JSON.parse(document.body.dataset.hestiaPrototypeFrameDiagnostics??"{}"),
    clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??"null"),input:JSON.parse(document.body.dataset.hestiaPrototypeInput??"{}"),
    owned:JSON.parse(document.body.dataset.hestiaPrototypeOwnedRender??"{}"),
    generation:document.body.dataset.hestiaPrototypeTerrainGeneration,admission:document.body.dataset.hestiaPrototypeNeighborAdmission}));
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.status).toBe("Walking");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeInput??"{}").owner)).toBe("Player");
  const walk=async(east:boolean,target=east?17:3.5)=>{
    await page.keyboard.down("ShiftLeft");await page.keyboard.down(east?"KeyW":"KeyS");
    let latest=await read();
    try{await expect.poll(async()=>{const s=await read();if(s.neighbor.error||s.neighbor.recoveryHold){throw new Error(`${s.neighbor.error}: ${s.admission}`);}
      latest=s;
      if(s.physics.status==="SimulationHold"){throw new Error(`Uninterrupted round trip held: ${JSON.stringify(s)}`);}
      // At 5 m/s the default 1 s polling interval can overshoot the route into water.
      return east?s.physics.player.position.x>target:s.physics.player.position.x<target;},{timeout:60_000,intervals:[16,32,50]}).toBe(true);}
    catch(error){await testInfo.attach("failed-regional-walk",{body:JSON.stringify({east,target,latest},null,2),contentType:"application/json"});
      throw new Error(`Regional walk failed: ${JSON.stringify({east,target,latest})}`,{cause:error});}
    finally{await page.keyboard.up(east?"KeyW":"KeyS");await page.keyboard.up("ShiftLeft");}
    await expect.poll(async()=>{const s=await read();if(s.neighbor.error){throw new Error(`${s.neighbor.error}: ${s.admission}`);}
      return !s.neighbor.busy&&s.physics.neighbor?.resident===(target>4);},{timeout:60_000}).toBe(true);
    await page.evaluate(()=>new Promise<void>(resolve=>{let left=75;const frame=()=>{if(--left===0){resolve();}else{requestAnimationFrame(frame);}};requestAnimationFrame(frame);}));
    return read();
  };
  const fine=await walk(true),coarse=await walk(false,7);
  expect(coarse.neighbor.lod).toBe(.5);expect(coarse.physics.neighbor).toEqual(fine.physics.neighbor);
  expect(coarse.physics.colliderCount).toBe(fine.physics.colliderCount);expect(coarse.neighbor.sourceDigest).toBe(fine.neighbor.sourceDigest);
  await walk(false);
  const resident=[],evicted=[];
  for(let trip=0;trip<20;trip+=1){
    const a=await walk(true);resident.push(a);
    expect(a.generation).toBe("0");expect(a.neighbor.collisionReady).toBe(true);expect(a.neighbor.cacheEntries).toBeLessThanOrEqual(2);
    expect(a.neighbor.cacheBytes).toBeLessThanOrEqual(32*1024*1024);expect(a.resources.ledger.totalCpuBytes).toBeLessThanOrEqual(256*1024*1024);
    const b=await walk(false);evicted.push(b);expect(b.neighbor.sourceBytes).toBe(0);expect(b.neighbor.checkpointBytes).toBeGreaterThan(0);
    expect(b.resources.ledger.triangles).toBeLessThanOrEqual(500_000);
    if(trip>1){
      expect(a.physics.colliderCount).toBe(resident[1]!.physics.colliderCount);
      expect(a.owned.geometries-a.owned.previewCount).toBe(resident[1]!.owned.geometries-resident[1]!.owned.previewCount);
      expect(b.physics.colliderCount).toBe(evicted[1]!.physics.colliderCount);
      expect(b.owned.geometries-b.owned.previewCount).toBe(evicted[1]!.owned.geometries-evicted[1]!.owned.previewCount);
      expect(a.owned.representations).toBe(a.owned.geometries);expect(b.owned.representations).toBe(b.owned.geometries);
      expect(a.neighbor.sourceDigest).toBe(resident[1]!.neighbor.sourceDigest);
    }
  }
  // Twenty resident entries reuse the warmed content; cancelled in-flight LOD
  // requests must not be counted as successful extra cache adoptions.
  expect(resident[19]!.neighbor.cacheHits).toBeGreaterThanOrEqual(20);
  await page.keyboard.press("Escape");
  await testInfo.attach("twenty-regional-round-trips",{body:JSON.stringify({fine,coarse,resident,evicted},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

test("HVP-05 the authored dry shaft has a real rim and bottom, not an invisible floor", async ({ page },testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 30_000 });
  const read = () => page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePhysics ?? "{}").player);
  await page.getByRole("button", { name: "Spielen · WASD / Maus / Space" }).click();
  await waitForHvpPlayer(page);
  await expect.poll(async () => (await read()).grounded).toBe(true);
  const top = (await read()).position.y;
  // Initial view faces +z; screen-right is -x, toward the authored shaft at (-11,-11).
  // Stop with the whole 0.3 m-radius capsule clear of both rims. Waiting only
  // for a fall while continuing to strafe can drive it into the opposite wall.
  await page.keyboard.down("KeyD");
  try { await expect.poll(async () => (await read()).position.x,{intervals:[16,32,50]}).toBeLessThan(-10.95); }
  finally { await page.keyboard.up("KeyD"); }
  await expect.poll(async () => (await read()).position.y).toBeLessThan(top - 0.4);
  await expect.poll(async () => (await read()).grounded).toBe(true);
  const bottom = await read();
  await testInfo.attach("shaft-contact-state",{body:JSON.stringify({top,bottom},null,2),contentType:"application/json"});
  expect(bottom.position.x+0.3).toBeLessThan(-10.25);
  expect(bottom.position.x-0.3).toBeGreaterThan(-11.75);
  // The actual controller keeps a 0.01 m skin; ground snapping may close it.
  expect(bottom.position.y - 0.9).toBeGreaterThanOrEqual(0.124);
  expect(bottom.position.y - 0.9).toBeLessThanOrEqual(0.145);
  await page.keyboard.press("Escape");
});

test("HVP-05 real capsule walks with pointer ownership, pauses and stays fixed in inspection", async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 30_000 });
  const read = () => page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePhysics ?? "{}"));
  expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.getByRole("button", { name: "Spielen · WASD / Maus / Space" }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async () => (await read()).player.grounded).toBe(true);
  expect((await read()).player.jumpCount).toBe(0); // acquiring pointer lock is not a gameplay action
  const before = (await read()).player.position;
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await read()).player.position.z).toBeGreaterThan(before.z + 0.4);
  await page.keyboard.up("KeyW");
  const moved = await read();
  expect(moved.player.grounded).toBe(true);
  const view = await page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera ?? "{}"));
  expect(view.position[1]).toBeCloseTo(view.visualBody[1] + 0.75, 5);
  expect(Math.abs(view.visualBody[1] - moved.player.position.y)).toBeLessThan(0.3);
  expect(view.heightMeters).toBe(1.8);
  await page.keyboard.press("KeyV");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-player-view", "ThirdPerson");
  await expect.poll(() => page.evaluate(() => {
    const c = JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera ?? "{}");
    return Math.hypot(...c.position.map((v: number, i: number) => v - c.visualBody[i]));
  })).toBeGreaterThan(1);
  await testInfo.attach("third-person-player-scale", { body: await page.screenshot(), contentType: "image/png" });
  await page.keyboard.press("KeyV");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-player-view", "FirstPerson");
  await page.keyboard.down("Space");
  await expect.poll(async () => (await read()).player.position.y).toBeGreaterThan(moved.player.position.y + 0.1);
  await page.keyboard.down("Space"); // repeat while held must not queue a second jump
  await expect.poll(async () => (await read()).player.grounded).toBe(true);
  expect((await read()).player.jumpCount).toBe(1);
  await page.keyboard.up("Space");
  await page.mouse.move(800, 500);
  await expect.poll(() => page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera ?? "{}").orientation)).not.toEqual(view.orientation);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Spiel pausiert" })).toBeVisible();
  await expect.poll(async () => (await read()).status).toBe("Paused");
  const paused = (await read()).player.position;
  await page.keyboard.down("KeyW"); await page.waitForTimeout(250); await page.keyboard.up("KeyW");
  expect((await read()).player.position).toEqual(paused);
  await page.getByRole("button", { name: "Zur Inspektionsansicht" }).click();
  await page.getByRole("button", { name: "C03-ROOTS" }).click();
  expect((await read()).player.position).toEqual(paused);
  expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.getByRole("button", { name: "Spielen · WASD / Maus / Space" }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe("debug-scene");
  await page.keyboard.down("KeyW");
  await page.mouse.down();
  const other = await context.newPage();
  await other.goto("about:blank"); await other.bringToFront();
  await expect.poll(async () => (await read()).status).toBe("Paused");
  await page.bringToFront(); await other.close();
  await page.mouse.up();
  expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypeInput ?? "{}").pressedKeys)).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
});

for(const mode of [1,2,3]) {
test(`HVP-06 a real click commits local quarry mode ${mode} with matching World generation`, async ({page},testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:20_000});
  const read=()=>page.evaluate(()=>({tool:JSON.parse(document.body.dataset.hestiaPrototypeTool!),
    revision:Number(document.body.dataset.hestiaPrototypeTerrainGeneration),
    sectors:JSON.parse(document.body.dataset.hestiaPrototypeTerrainSectors!) as {id:number;key:string;hash:string}[],
    physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!)}));
  const before=await read();expect(before.sectors).toHaveLength(16);
  await page.getByRole("button",{name:"Ansicht: Schnittstelle",exact:true}).click();
  await testInfo.attach("quarry-before-real-cut",{body:await page.screenshot(),contentType:"image/png"});
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await page.keyboard.press(`Digit${mode}`);
  await expect.poll(async()=>(await read()).tool.message,{timeout:10_000}).toContain("sicherer Steinbruch");
  expect((await read()).tool.issued).toBe(0); // Lock acquisition was not a tool command.
  // Pointer Lock aims with relative movement; click without moving the aim first.
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.last?.status,{timeout:30_000}).toBe("Applied");
  const after=await read();expect(after.revision).toBe(before.revision+1);
  expect(after.physics.terrainGeneration).toBe(after.revision);
  expect(after.tool.issued).toBe(1);
  if(mode===1) { expect(after.tool.last.removedCells).toBe(1); }
  expect(after.tool.last.removedCells).toBeGreaterThan(0);expect(after.tool.last.removedCells).toBeLessThanOrEqual(512);
  const changed=after.sectors.filter((s:{id:number;hash:string})=>s.hash!==before.sectors.find(b=>b.id===s.id)!.hash);
  expect(changed.length).toBeGreaterThan(0);expect(changed.length).toBeLessThanOrEqual(4);
  expect(after.physics.terrainTransaction).toBe("Idle");
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"Ansicht: Schnittstelle",exact:true}).click();
  await testInfo.attach("quarry-after-real-cut",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("quarry-generation-receipt",{body:JSON.stringify({mode,before,after},null,2),contentType:"application/json"});
  expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);
});
}

test("HVP-11 real local save and live load restore the confirmed Root, World and input state",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  // Corrupt one actual worker acknowledgement, not product state or controls.
  await page.addInitScript(()=>{
    const state={loseAck:false,lost:0};(window as unknown as {hvpSaveFault:typeof state}).hvpSaveFault=state;
    const descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,"onmessage");
    if(!descriptor?.set){throw new Error("Worker event boundary unavailable");}
    Object.defineProperty(Worker.prototype,"onmessage",{...descriptor,set(handler:((this:Worker,event:MessageEvent)=>void)|null){
      descriptor.set!.call(this,handler===null?null:function(this:Worker,event:MessageEvent){
        if(state.loseAck&&event.data?.restoreState==="Prepared"){
          state.loseAck=false;state.lost+=1;handler.call(this,new MessageEvent("message",{data:{...event.data,snapshot:undefined}}));
        }else{handler.call(this,event);}
      });
    }});
  });
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),tool:JSON.parse(document.body.dataset.hestiaPrototypeTool!),
    save:JSON.parse(document.body.dataset.hestiaPrototypeSave!),generation:Number(document.body.dataset.hestiaPrototypeTerrainGeneration),
    digest:document.body.dataset.hestiaPrototypeSourceDigest,camera:document.body.dataset.hestiaPrototypeCamera,
    water:document.body.dataset.hestiaPrototypeWater,ao:document.body.dataset.hestiaPrototypeAo,restore:document.body.dataset.hestiaPrototypeRestoreSource}));
  await page.getByRole("button",{name:"Ansicht: Schnittstelle",exact:true}).click();
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).tool.message).toContain("sicherer Steinbruch");
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.last?.status,{timeout:30_000}).toBe("Applied");
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"Ansicht: Schnittstelle",exact:true}).click();
  await page.getByRole("button",{name:"Water: on",exact:true}).click();
  await page.getByRole("button",{name:"Inspect-only ambient occlusion toggle",exact:true}).click();
  const saved=await read();expect(saved.generation).toBe(1);
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).not.toBe("Saving");
  expect((await read()).save,JSON.stringify((await read()).save)).toMatchObject({state:"Saved",revision:1});
   const stored=()=>readHvpSaveRecord(page);
   const savedRecord=await stored();
   await testInfo.attach("complete-hestia-save-envelope",{body:savedRecord.payload,contentType:"application/json"});
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.status).toBe("Walking");
  await expect.poll(async()=>(await read()).tool.message).toContain("sicherer Steinbruch");
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.issued).toBe(2);
  await expect.poll(async()=>(await read()).tool.last?.commandId,{timeout:30_000}).toBe("cut-2");
  expect((await read()).tool.last.status,JSON.stringify((await read()).tool.last)).toBe("Applied");
  expect((await read()).generation).toBe(2);
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"C03-ROOTS",exact:true}).click();
  await page.getByRole("button",{name:"Water: off",exact:true}).click();
  await page.getByRole("button",{name:"Inspect-only ambient occlusion toggle",exact:true}).click();
  const liveA=await read();
  // Abort the real IndexedDB transaction AFTER its put request succeeded.
  await abortNextHvpSave(page);
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).toBe("Rejected");
  expect(await stored()).toEqual(savedRecord);expect((await read()).digest).toBe(liveA.digest);
  expect((await read()).physics.bodies).toEqual(liveA.physics.bodies);
  await page.evaluate(()=>{(window as unknown as {hvpSaveFault:{loseAck:boolean}}).hvpSaveFault.loseAck=true;});
  await page.getByRole("button",{name:"Spielstand laden",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).toBe("Rejected");
  expect(await page.evaluate(()=>(window as unknown as {hvpSaveFault:{lost:number}}).hvpSaveFault.lost)).toBe(1);
  const failedLoad=await read();expect(failedLoad.generation).toBe(2);expect(failedLoad.digest).toBe(liveA.digest);
  expect(failedLoad.physics.bodies).toEqual(liveA.physics.bodies);expect(failedLoad.physics.ticks).toBe(liveA.physics.ticks);
  expect(await stored()).toEqual(savedRecord);
  await page.getByRole("button",{name:"Spielstand laden",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).not.toBe("Loading");
  const loaded=await read();expect(loaded.save,JSON.stringify(loaded.save)).toMatchObject({state:"Loaded",revision:1});
  expect(loaded.generation).toBe(saved.generation);expect(loaded.digest).toBe(saved.digest);expect(loaded.camera).toBe("C07-QUARRY");
  expect(loaded.physics.terrainGeneration).toBe(1);expect(loaded.physics.status).toBe("Paused");
  expect(loaded.physics.bodies).toEqual(saved.physics.bodies);expect(loaded.physics.ticks).toBe(saved.physics.ticks);
  expect(loaded.physics.player.position).toEqual(saved.physics.player.position);expect(loaded.tool.issued).toBe(1);
  expect(loaded.ao).toBe("off");expect(loaded.water).toBe("off");
  expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await testInfo.attach("restored-confirmed-scene",{body:await page.screenshot(),contentType:"image/png"});
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Gespeicherte Sitzung neu öffnen",exact:true}).click();
  await expect(page).toHaveURL(/hvpLoad=primary/);
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const cold=await read();expect(cold.restore).toBe("artifact");expect(cold.save).toMatchObject({state:"Loaded",revision:1});
  expect(cold.generation).toBe(1);expect(cold.digest).toBe(saved.digest);expect(cold.physics.bodies).toEqual(saved.physics.bodies);
  expect(cold.physics.ticks).toBe(saved.physics.ticks);expect(cold.physics.player.position).toEqual(saved.physics.player.position);
  expect(cold.camera).toBe("C07-QUARRY");expect(cold.water).toBe("off");expect(cold.ao).toBe("off");expect(cold.tool.issued).toBe(1);
  expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await expect.poll(()=>page.workers().filter(w=>w.url().includes("physicsWorker")).length).toBe(1);
  await testInfo.attach("save-load-receipt",{body:JSON.stringify({saved,loaded,cold},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

for(const family of ["terrain","branch"] as const){
test(`HVP-11 cold artifact restores a recut ${family} owner and accepts its next real cut`,async({page},testInfo)=>{
  test.setTimeout(180_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(family==="terrain"?"/?hestiaPrototype=1&hvpScenario=rock-arm":"/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),tool:JSON.parse(document.body.dataset.hestiaPrototypeTool!),
    save:JSON.parse(document.body.dataset.hestiaPrototypeSave!),generation:Number(document.body.dataset.hestiaPrototypeTerrainGeneration),
    digest:document.body.dataset.hestiaPrototypeSourceDigest,restore:document.body.dataset.hestiaPrototypeRestoreSource}));
  await page.getByRole("button",{name:family==="terrain"?"Stütze anvisieren (2 + Klick)":"Ast anvisieren (2 + Klick)",exact:true}).click();
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.grounded).toBe(true);
  if(family==="terrain"){await expect.poll(async()=>(await read()).tool.message,{timeout:10_000}).toContain("Stützzellen");}
  else{await expect.poll(async()=>(await read()).physics.structural.preview,{timeout:10_000}).toBeTruthy();}
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>family==="terrain"?(await read()).tool.last?.status:(await read()).tool.structural.last?.status,{timeout:30_000}).toBe("Applied");
  const detached=await read();
  const parent=family==="terrain"?detached.physics.terrainFragments[0]:detached.physics.structural.parts.find((p:{anchored:boolean})=>!p.anchored);
  expect(parent).toBeTruthy();await page.keyboard.press("Digit1");
  const cursor={x:960,y:540};await aimAtHvpBody(page,parent.ownerId,cursor);
  await expect.poll(async()=>(await read()).physics.moving.preview?.ownerId,{timeout:10_000}).toBe(parent.ownerId);
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.moving.last?.status,{timeout:30_000}).toBe("Applied");
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await expect.poll(async()=>(await read()).physics.status).toBe("Paused");
  const saved=await read();expect(saved.physics.bodies.some((b:{ownerId:string})=>b.ownerId===parent.ownerId)).toBe(false);
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).not.toBe("Saving");
  expect((await read()).save,JSON.stringify((await read()).save)).toMatchObject({state:"Saved",revision:1});
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Gespeicherte Sitzung neu öffnen",exact:true}).click();
  await expect(page).toHaveURL(/hvpLoad=primary/);await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const restored=await read();expect(restored.restore).toBe("artifact");expect(restored.generation).toBe(saved.generation);expect(restored.digest).toBe(saved.digest);
  expect(restored.physics.status).toBe("Paused");expect(restored.physics.ticks).toBe(saved.physics.ticks);
  expect(restored.physics.bodies).toEqual(saved.physics.bodies);expect(restored.physics.terrainFragments).toEqual(saved.physics.terrainFragments);
  expect(restored.physics.structural).toEqual(saved.physics.structural);expect(restored.physics.moving.last).toEqual(saved.physics.moving.last);
  expect(restored.tool.moving.last).toEqual(saved.tool.moving.last);expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await testInfo.attach(`artifact-restored-${family}`,{body:await page.screenshot(),contentType:"image/png"});
  const child=family==="terrain"?restored.physics.terrainFragments[0]:restored.physics.structural.parts.find((p:{anchored:boolean})=>!p.anchored);
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await aimAtHvpBody(page,child.ownerId,{x:960,y:540});
  await expect.poll(async()=>(await read()).physics.moving.preview?.ownerId,{timeout:10_000}).toBe(child.ownerId);
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.moving.last?.id,{timeout:30_000}).not.toBe(saved.tool.moving.last.id);
  const continued=await read();expect(continued.tool.moving.last.status,JSON.stringify(continued.tool.moving.last)).toBe("Applied");
  expect(continued.physics.bodies.some((b:{ownerId:string})=>b.ownerId===child.ownerId)).toBe(false);
  expect(continued.generation).toBe(saved.generation);expect(continued.physics.moving.sequence).toBe(saved.physics.moving.sequence+1);
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save.state,{timeout:30_000}).not.toBe("Saving");
  expect((await read()).save,JSON.stringify((await read()).save)).toMatchObject({state:"Saved",revision:2});
  await testInfo.attach(`artifact-continuation-${family}`,{body:JSON.stringify({saved,restored,continued},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
});
}

test("HVP-12 completes a real salvage contract by walking, cutting, contact impulses and a durable save",async({page},testInfo)=>{
  test.setTimeout(180_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?hestiaPrototype=1");await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  page.once("dialog",d=>d.dismiss());await page.getByRole("button",{name:"Neuer Bergungsauftrag",exact:true}).click();
  await expect(page).not.toHaveURL(/hvpScenario=salvage/);
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Neuer Bergungsauftrag",exact:true}).click();
  await expect(page).toHaveURL(/hvpScenario=salvage/);await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),goal:JSON.parse(document.body.dataset.hestiaPrototypeSalvage??"null"),
    save:JSON.parse(document.body.dataset.hestiaPrototypeSave??"null")}));
  await expect.poll(async()=>(await read()).goal?.stage).toBe("Find");
  await page.getByRole("button",{name:"Spielen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await waitForHvpPlayer(page);
  await page.keyboard.down("KeyW");
  try{await expect.poll(async()=>(await read()).goal?.stage).toBe("Cut");}finally{await page.keyboard.up("KeyW");}
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"Ast anvisieren (2 + Klick)",exact:true}).click();
  await page.getByRole("button",{name:"Spielen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.structural.preview?.cell).toEqual([1,7,0]);
  await testInfo.attach("salvage-marked-link",{body:await page.screenshot(),contentType:"image/png"});
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).goal?.stage,{timeout:20_000}).toBe("Deliver");
  const cut=await read(),owner=cut.goal.targetOwnerId;
  expect(cut.physics.structural.last).toMatchObject({status:"Applied",removedCells:1,removedMassKg:1.171875});
  const cargo=cut.physics.bodies.find((b:{ownerId:string})=>b.ownerId===owner);expect(cargo.massKg).toBeCloseTo(9.375,6);
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save?.state,{timeout:30_000}).toBe("Saved");
  const half=await read(),halfRecord=await readHvpSaveRecord(page);
  expect(half.goal.stage).toBe("Deliver");expect(half.save.revision).toBe(1);
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Gespeicherte Sitzung neu öffnen",exact:true}).click();
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  await expect.poll(async()=>(await read()).goal?.stage).toBe("Deliver");
  expect((await read()).goal.mission).toEqual(half.goal.mission);expect((await read()).physics.bodies).toEqual(half.physics.bodies);
  await page.getByRole("button",{name:"Spielen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  // A downward close-range impulse pins the cargo. Walk to a shallower push
  // angle using ordinary input; never rewrite camera/avatar/body poses.
  await waitForHvpPlayer(page);
  await page.keyboard.down("KeyS");
  try{await expect.poll(async()=>(await read()).physics.player.position.z,{intervals:[16,32,50]}).toBeLessThan(-15.1);}finally{await page.keyboard.up("KeyS");}
  await page.keyboard.down("KeyA");
  try{await expect.poll(async()=>(await read()).physics.player.position.x,{intervals:[16,32,50]}).toBeGreaterThan(cargo.position.x-.04);}finally{await page.keyboard.up("KeyA");}
  const cursor={x:640,y:360};
  for(let i=0;i<20&&(await read()).goal.stage==="Deliver";i+=1){
    const p=(await read()).physics.bodies.find((b:{ownerId:string})=>b.ownerId===owner).position;
    if(p.x>=-11.9&&p.x<-11.1&&p.z>=-13&&p.z<-12.25){break;}
    await aimAtHvpBody(page,owner,cursor);
    const tick=(await read()).physics.ticks;
    await page.keyboard.press("KeyF");
    await expect.poll(async()=>(await read()).physics.ticks,{timeout:5000}).toBeGreaterThan(tick+30);
  }
  await testInfo.attach("salvage-push-observation",{body:JSON.stringify(await read(),null,2),contentType:"application/json"});
  await expect.poll(async()=>(await read()).goal.stage,{timeout:15_000}).toBe("Save");
  const delivered=await read();expect(delivered.goal.mission.objectiveStates.map((s:{state:string})=>s.state)).toEqual(["Completed","Completed","Completed","Active"]);
  expect(delivered.physics.lastImpulse).toMatchObject({status:"Applied",target:owner});
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await abortNextHvpSave(page);
  await page.getByRole("button",{name:"Bergung speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save?.state,{timeout:30_000}).toBe("Rejected");
  expect((await read()).goal.stage).toBe("Save");expect(await readHvpSaveRecord(page)).toEqual(halfRecord);
  await page.getByRole("button",{name:"Bergung speichern",exact:true}).click();
  await expect.poll(async()=>(await read()).save?.state,{timeout:30_000}).toBe("Saved");
  await expect.poll(async()=>(await read()).goal.stage).toBe("Completed");const saved=await read();
  expect(saved.save.revision).toBe(2);
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Gespeicherte Sitzung neu öffnen",exact:true}).click();
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  await expect.poll(async()=>(await read()).goal?.stage).toBe("Completed");
  expect((await read()).goal.mission).toEqual(saved.goal.mission);
  expect((await read()).physics.bodies).toEqual(saved.physics.bodies);
  const completeRecord=await readHvpSaveRecord(page);
  page.once("dialog",d=>d.dismiss());await page.getByRole("button",{name:"Neuer Auftrag",exact:true}).click();
  expect((await read()).goal.stage).toBe("Completed");expect(await readHvpSaveRecord(page)).toEqual(completeRecord);
  await testInfo.attach("salvage-saved-completion",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("salvage-domain-receipts",{body:JSON.stringify({cut,half,delivered,saved,restored:await read()},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

test("HVP-09B a normal undercut transfers actual rock-arm cells to one falling body",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Neustart: Felsarm",exact:true}).click();
  await expect(page).toHaveURL(/hvpScenario=rock-arm/);
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),tool:JSON.parse(document.body.dataset.hestiaPrototypeTool!),
    clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??"null"),
    generation:Number(document.body.dataset.hestiaPrototypeTerrainGeneration),sectors:JSON.parse(document.body.dataset.hestiaPrototypeTerrainSectors!) as {id:number;hash:string}[]}));
  const before=await read();expect(before.physics.terrainFragments).toHaveLength(0);expect(before.generation).toBe(0);
  expect(before.physics.player.position.x).toBe(7); // Authored new-session spawn, never a live teleport.
  await page.getByRole("button",{name:"Stütze anvisieren (2 + Klick)",exact:true}).click();
  await testInfo.attach("rock-arm-before-undercut",{body:await page.screenshot(),contentType:"image/png"});
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.grounded).toBe(true);
  await expect.poll(async()=>(await read()).tool.message).toContain("Stützzellen");
  expect((await read()).tool.issued).toBe(0);
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.last,{timeout:30_000}).toBeTruthy();
  const after=await read();expect(after.tool.last.status,JSON.stringify(after.tool.last)).toBe("Applied");
  expect(after.generation).toBe(1);expect(after.physics.terrainGeneration).toBe(1);
  expect(after.physics.terrainTransaction).toBe("Idle");expect(after.physics.terrainFragments).toHaveLength(1);
  expect(after.physics.bodyCount).toBe(before.physics.bodyCount+1);
  expect(after.tool.last).toMatchObject({removedCells:64,transferredCells:384});
  const fragment=after.physics.terrainFragments[0];expect(fragment.cellCount).toBe(384);
  expect(fragment.massKg).toBeCloseTo(after.tool.last.transferredMassKg,5);
  expect(after.tool.last.materialRemovedKg).toBeGreaterThan(0);
  const native={recipeMs:after.clock?.lastTerrainRecipeMs,cookMs:after.clock?.lastTerrainCookMs,
    installMs:after.clock?.lastTerrainInstallMs,holdMs:after.clock?.lastTerrainHoldMs};
  for(const [key,value] of Object.entries(native)){expect(typeof value,`clock.${key}`).toBe("number");expect(value as number,`clock.${key}`).toBeGreaterThanOrEqual(0);}
  expect(native.holdMs as number).toBeLessThan(30_000);
  // Step-3 contract: the native owner admits the transferred recipe (ingest +
  // cheap verification) instead of recomputing classification + transition.
  // Measured before: 632-684ms. Headroom is deliberately wide: 2.5x above the
  // expected ~170-200ms, ~20% below the old floor.
  expect(native.recipeMs as number).toBeLessThan(500);
  await testInfo.attach("terrain-stage-sub-spans",{body:Buffer.from(JSON.stringify(native)),contentType:"application/json"});
  const changed=after.sectors.filter(s=>s.hash!==before.sectors.find(b=>b.id===s.id)!.hash);
  expect(changed.length).toBeGreaterThan(0);expect(changed.length).toBeLessThanOrEqual(4);
  await expect.poll(async()=>(await read()).physics.bodies.find((b:{ownerId:string})=>b.ownerId===fragment.ownerId).position.y,{timeout:10_000})
    .toBeLessThan(-8+fragment.centerOfMass.y-.2);
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  await page.getByRole("button",{name:"C05-Felsarm",exact:true}).click();
  await testInfo.attach("rock-arm-after-real-fall",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("terrain-fragment-transfer-receipt",{body:JSON.stringify({before,after,settled:await read()},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

// Read actual published poses; steer through real relative mouse input only.
const aimAtHvpBody=async(page:Page,ownerId:string,cursor:{x:number;y:number}):Promise<void>=>{
  // Pointer lock arrives before Play acknowledgement and the first solver camera frame.
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.hestiaPrototypePlayerCamera)).toBeTruthy();
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),
    camera:JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera!)}));
  for(let correction=0;correction<12;correction+=1){
    const current=await read(),body=current.physics.bodies.find((b:{ownerId:string})=>b.ownerId===ownerId);
    if(!body){throw new Error("Moving aim owner disappeared");}
    const eye=new Vector3(current.physics.player.position.x,current.physics.player.position.y+.75,current.physics.player.position.z);
    const desired=new Vector3(body.position.x,body.position.y,body.position.z).sub(eye).normalize();
    const forward=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(current.camera.orientation));
    if(desired.dot(forward)>.999&&current.physics.moving.preview?.ownerId===ownerId){break;}
    const yawDelta=Math.atan2(Math.sin(Math.atan2(-desired.x,-desired.z)-Math.atan2(-forward.x,-forward.z)),
      Math.cos(Math.atan2(-desired.x,-desired.z)-Math.atan2(-forward.x,-forward.z)));
    cursor.x-=yawDelta/.002;cursor.y-=(Math.asin(desired.y)-Math.asin(forward.y))/.002;
    await page.mouse.move(cursor.x,cursor.y);
    await expect.poll(async()=>(await read()).physics.ticks).toBeGreaterThan(current.physics.ticks);
  }
  await expect.poll(async()=>(await read()).physics.moving.preview?.ownerId,{timeout:15_000}).toBe(ownerId);
};

test("HVP-10 normal input recuts a terrain-origin body without changing static Root generation",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?hestiaPrototype=1&hvpScenario=rock-arm");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),tool:JSON.parse(document.body.dataset.hestiaPrototypeTool!),
    generation:Number(document.body.dataset.hestiaPrototypeTerrainGeneration),sectors:JSON.parse(document.body.dataset.hestiaPrototypeTerrainSectors!),
    camera:JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera??"null")}));
  await page.getByRole("button",{name:"Stütze anvisieren (2 + Klick)",exact:true}).click();
  const playBox=await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).boundingBox();
  if(!playBox){throw new Error("Play control missing");}
  const cursor={x:playBox.x+playBox.width/2,y:playBox.y+playBox.height/2};
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.grounded).toBe(true);
  await expect.poll(async()=>(await read()).tool.message).toContain("Stützzellen");
  await testInfo.attach("rock-arm-before-detach-and-recut",{body:await page.screenshot(),contentType:"image/png"});
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.last?.status,{timeout:30_000}).toBe("Applied");
  const detached=await read();const parent=detached.physics.terrainFragments[0];
  expect(parent.cellCount).toBe(384);expect(detached.generation).toBe(1);
  await aimAtHvpBody(page,parent.ownerId,cursor);
  await page.keyboard.press("KeyF");
  await expect.poll(async()=>(await read()).physics.lastImpulse?.status).toBe("Applied");
  expect((await read()).physics.lastImpulse.target).toBe(parent.ownerId);
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.moving.last,{timeout:30_000}).toBeTruthy();
  const after=await read();expect(after.tool.moving.last.status,JSON.stringify(after.tool.moving.last)).toBe("Applied");
  const receipt=after.physics.moving.last;
  expect(receipt.parentId).toBe(parent.ownerId);expect(receipt.removedCells).toBeGreaterThan(0);expect(receipt.removedCells).toBeLessThanOrEqual(512);
  expect(receipt.commitTick).toBeGreaterThan(receipt.issuedTick);
  expect(after.physics.moving.state).toBe("Idle");expect(after.physics.bodies.some((b:{ownerId:string})=>b.ownerId===parent.ownerId)).toBe(false);
  const children=after.physics.terrainFragments.filter((b:{ownerId:string})=>receipt.children.includes(b.ownerId));
  expect(children.length).toBe(receipt.children.length);
  expect(children.reduce((n:number,b:{cellCount:number})=>n+b.cellCount,receipt.removedCells)).toBe(parent.cellCount);
  expect(children.reduce((n:number,b:{massKg:number})=>n+b.massKg,receipt.removedMassKg)).toBeCloseTo(parent.massKg,5);
  expect(after.generation).toBe(detached.generation);expect(after.sectors).toEqual(detached.sectors);
  await testInfo.attach("terrain-body-after-recut",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("moving-recut-receipt",{body:JSON.stringify({detached,after},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

test("HVP-10 a released timber recut keeps its foliage on the live support owner",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),tool:JSON.parse(document.body.dataset.hestiaPrototypeTool!),
    generation:document.body.dataset.hestiaPrototypeTerrainGeneration,sectors:document.body.dataset.hestiaPrototypeTerrainSectors}));
  await page.getByRole("button",{name:"Ast anvisieren (2 + Klick)",exact:true}).click();
  const box=await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).boundingBox();
  if(!box){throw new Error("Play control missing");}
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.grounded).toBe(true);
  await expect.poll(async()=>(await read()).physics.structural.preview).not.toBeNull();
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.structural.last?.status,{timeout:30_000}).toBe("Applied");
  const before=await read(),parent=before.physics.structural.parts.find((p:{anchored:boolean})=>!p.anchored);
  expect(before.physics.structural.attachment.ownerId).toBe(parent.ownerId);expect(parent.cellCount).toBe(128);
  expect(before.physics.terrainFragments).toHaveLength(0);
  await page.keyboard.press("Digit1");
  await aimAtHvpBody(page,parent.ownerId,{x:box.x+box.width/2,y:box.y+box.height/2});
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.moving.last,{timeout:30_000}).toBeTruthy();
  const after=await read();expect(after.tool.moving.last.status,JSON.stringify(after.tool.moving.last)).toBe("Applied");
  const receipt=after.physics.moving.last,children=after.physics.structural.parts.filter((p:{ownerId:string})=>receipt.children.includes(p.ownerId));
  expect(receipt.parentId).toBe(parent.ownerId);expect(receipt.removedCells).toBe(1);expect(children).toHaveLength(1);
  expect(children[0].cellCount+receipt.removedCells).toBe(128);
  expect(children[0].massKg+receipt.removedMassKg).toBeCloseTo(parent.massKg,5);
  expect(after.physics.structural.attachment.ownerId).toBe(children[0].ownerId);
  expect(after.physics.bodies.some((b:{ownerId:string})=>b.ownerId===parent.ownerId)).toBe(false);
  expect(new Set(after.physics.bodies.map((b:{ownerId:string})=>b.ownerId)).size).toBe(after.physics.bodies.length);
  expect(after.physics.terrainFragments).toHaveLength(0);expect(after.generation).toBe(before.generation);expect(after.sectors).toBe(before.sectors);
  await testInfo.attach("released-timber-after-recut",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("released-timber-owner-receipt",{body:JSON.stringify({before,after},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

test("HVP-08 a normal cutter click detaches timber and its supported foliage in the real World",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics??"{}"),tool:JSON.parse(document.body.dataset.hestiaPrototypeTool??"{}")}));
  await page.getByRole("button",{name:"Ast anvisieren (2 + Klick)",exact:true}).click();
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=>(await read()).physics.player.grounded).toBe(true);
  await expect.poll(async()=>(await read()).physics.structural.preview,{timeout:10_000}).not.toBeNull();
  const before=await read();expect(before.physics.structural.generation).toBe(0);
  expect(before.tool.structural.issued).toBe(0);
  await testInfo.attach("branch-before-cut",{body:await page.screenshot(),contentType:"image/png"});
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await read()).tool.structural.last?.status,{timeout:20_000}).toBe("Applied");
  const after=await read();const branch=after.physics.structural;
  expect(branch.generation).toBe(1);expect(branch.state).toBe("Idle");expect(branch.parts).toHaveLength(2);
  expect(branch.last.removedCells).toBe(64);expect(branch.last.removedMassKg).toBeCloseTo(75,6);
  const falling=branch.parts.find((p:{anchored:boolean})=>!p.anchored);
  const fixed=branch.parts.find((p:{anchored:boolean})=>p.anchored);
  expect(falling.massKg).toBeCloseTo(150,4);expect(fixed.massKg).toBeCloseTo(225,4);
  expect(branch.attachment.ownerId).toBe(falling.ownerId);
  expect(after.physics.bodies.some((p:{ownerId:string})=>p.ownerId==="hvp:branch:parent")).toBe(false);
  await expect.poll(async()=>(await read()).physics.structural.parts.find((p:{anchored:boolean})=>!p.anchored).position.y,{timeout:10_000})
    .toBeLessThan(before.physics.structural.parts[0].position.y-.2);
  expect((await read()).physics.structural.parts.find((p:{anchored:boolean})=>p.anchored).position).toEqual(fixed.position);
  await testInfo.attach("branch-after-real-fall",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("branch-generation-receipt",{body:JSON.stringify({before,after,settled:await read()},null,2),contentType:"application/json"});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>"TestBridge"in window)).toBe(false);
});

test("HVP-04 real worker-owned body falls, contacts the coast, pauses and disposes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 30_000 });
  await expect.poll(() => page.workers().filter(w => w.url().includes("physicsWorker")).length).toBe(1);
  const read = () => page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePhysics ?? "{}"));
  await page.getByRole("button", { name: "Fallkörper neu starten" }).click();
  await page.getByRole("button", { name: "Physik pausieren", exact: true }).click();
  await expect.poll(async () => (await read()).status).toBe("Paused");
  const before = await read();
  expect(before.solver).toBe("rapier-0.12.0");
  expect(before.gravity).toBeCloseTo(8.09e14 / 8_282_000 ** 2, 8);
  expect(before.bodyCount).toBe(4); // drop, L specimen, anchored timber and the separate kinematic avatar
  expect(before.bodies[0].massKg).toBeCloseTo(300, 4);
  expect(before.colliderCount).toBeLessThanOrEqual(4096);
  await page.getByRole("button", { name: "Physik fortsetzen", exact: true }).click();
  await expect.poll(async () => (await read()).bodies[0].position.y).toBeLessThan(before.bodies[0].position.y - 0.1);
  await expect.poll(async () => (await read()).bodies[0].sleeping, { timeout: 20_000 }).toBe(true);
  const settled = await read();
  expect(settled.bodies[0].position.y).toBeGreaterThan(-1);
  expect(settled.bodies[0].position.y).toBeLessThan(before.bodies[0].position.y);
  await page.getByRole("button", { name: "Physik pausieren", exact: true }).click();
  await expect.poll(async () => (await read()).status).toBe("Paused");
  const paused = await read();
  await page.getByRole("button", { name: "C03-ROOTS" }).click();
  expect((await read()).ticks).toBe(paused.ticks);
  expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
  await page.goto("/");
  await expect.poll(() => page.workers().filter(w => w.url().includes("physicsWorker")).length).toBe(0);
});

test("HVP-04 failed solver worker startup is visible and never Ready", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/physicsWorker.ts*", route => route.abort());
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-failure")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-state", "Error");
  await expect(page.locator("#hvp-hud")).toHaveCount(0);
});

test("HVP-01 visible coast reaches Ready through the real UI and renders the bound scene structure", async ({ page }) => {
  // Startup plus two full-resolution captures share the same budget as HVP look tests.
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => requestFailures.push(request.url()));

  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await expect(page.locator("#hvp-hud")).toBeVisible();
  await page.getByRole("button", { name: "Physik pausieren", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePhysics ?? "{}").status)).toBe("Paused");
  await expect(page.locator("#debug-scene")).toHaveAttribute("aria-label", "HVP-02 readable coast viewport");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-state", "Ready");
  await expect(page.locator("#hvp-detail")).toContainText("Terrain faces:");
  await expect(page.locator("#hvp-failure")).toHaveCount(0);
  await expect(page.locator(".hud-center-safe-area")).toBeHidden();

  const liveImage = await page.screenshot();
  const secondLiveImage = await page.screenshot();
  await assertCanvasEvidence(page, "live HVP frame", liveImage);
  await assertCanvasEvidence(page, "second live HVP frame", secondLiveImage);
  if (recordEvidence) {
    await persistDeterministicEvidence(pngName, liveImage);
  }
  const comparison = await decodeAndCompare(page, liveImage, secondLiveImage);
  // eslint-disable-next-line no-console
  console.log(`HVP-LIVE-CALIBRATION changedPixels=${comparison.changedPixels} changedRatio=${comparison.changedRatio} maximumChannelDelta=${comparison.maximumChannelDelta}`);
  expect(comparison.changedPixels, "live-vs-live changed-pixel lower band").toBeGreaterThanOrEqual(
    pixelEvidenceContract.liveFrameDelta.minChangedPixels
  );
  expect(comparison.changedPixels, "live-vs-live changed-pixel upper band").toBeLessThanOrEqual(
    pixelEvidenceContract.liveFrameDelta.maxChangedPixels
  );

  expect(consoleErrors, `console errors (${focusedCommand})`).toEqual([]);
  expect(pageErrors, `page errors (${focusedCommand})`).toEqual([]);
  expect(requestFailures, `request failures (${focusedCommand})`).toEqual([]);
});

test("HVP-01 camera presets switch through real buttons", async ({ page }) => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });

  await page.getByRole("button", { name: "C01-EYE" }).click();
  await expect(page.locator("#hvp-mode")).toContainText("C01-EYE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C01-EYE");

  await page.getByRole("button", { name: "C04-WIDE" }).click();
  await expect(page.locator("#hvp-mode")).toContainText("C04-WIDE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C04-WIDE");
});

test("HVP-07 the normal push input moves a source-bound asymmetric rigid body",async({page},testInfo)=>{
  test.setTimeout(120_000);
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:20_000});
  const read=()=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics!));
  await expect.poll(async()=> (await read()).bodies.find((b:{ownerId:string})=>b.ownerId==="hvp:physics:inertia")?.sleeping,{timeout:20_000}).toBe(true);
  const before=await read();
  expect(before.inertia.tensor.xy).not.toBe(0);expect(before.inertia.colliders).toBe(2);
  await page.getByRole("button",{name:"L-Körper anvisieren (F)",exact:true}).click();
  await expect.poll(async()=> (await read()).status).toBe("Paused");
  await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");
  await expect.poll(async()=> (await read()).player.grounded).toBe(true);
  await expect.poll(async()=> (await read()).impulseTarget?.kind).toBe("Dynamic");
  await expect(page.locator("#hvp-interaction-target")).toContainText("F kurz drücken");
  await expect(page.locator("#hvp-aim-reticle")).toBeVisible();
  await expect(page.locator("#hvp-hud")).toBeHidden();
  await page.keyboard.press("KeyF");
  await expect.poll(async()=> (await read()).lastImpulse?.status).toBe("Applied");
  const after=await read();
  expect(after.lastImpulse.target).toBe("hvp:physics:inertia");expect(after.inertia.impulses).toBe(1);
  const impulse=after.lastImpulse.impulse;
  expect(Math.hypot(impulse.x,impulse.y,impulse.z)).toBeLessThanOrEqual(15.000001);
  const initial=before.bodies.find((b:{ownerId:string})=>b.ownerId==="hvp:physics:inertia");
  await expect.poll(async()=>{
    const current=(await read()).bodies.find((b:{ownerId:string})=>b.ownerId==="hvp:physics:inertia");
    return Math.hypot(current.position.x-initial.position.x,current.position.y-initial.position.y,current.position.z-initial.position.z);
  }).toBeGreaterThan(.001);
  await expect(page.locator("#hvp-interaction-feedback")).toContainText("Stoß ausgelöst");
  await testInfo.attach("real-inertia-impulse",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("inertia-motion",{body:Buffer.from(JSON.stringify({before,after})),contentType:"application/json"});
  await page.keyboard.press("KeyV");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-player-view","ThirdPerson");
  await expect(page.locator("#hvp-aim-reticle")).toBeVisible();
  await testInfo.attach("third-person-native-target",{body:await page.screenshot(),contentType:"image/png"});
  // Aim down at actual fixed terrain, not through it at a body. No test-side ray or pose writes.
  await page.mouse.move(320,900);
  await expect.poll(async()=> (await read()).impulseTarget?.kind).toBe("Fixed");
  await expect(page.locator("#hvp-interaction-target")).toContainText("nur gelöste Körper");
  await page.keyboard.press("KeyF");
  await expect.poll(async()=> (await read()).lastImpulse?.reason).toBe("Contact is not dynamic");
  await expect(page.locator("#hvp-interaction-feedback")).toContainText("fest verankert");
  expect((await read()).inertia.impulses).toBe(1);
  await testInfo.attach("fixed-ground-rejects-push-clearly",{body:await page.screenshot(),contentType:"image/png"});
  await expect(page.evaluate(()=>"TestBridge" in window)).resolves.toBe(false);
});

test("HVP-09A previews the real rock-arm support without publishing a cut or a body",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:20_000});
  await page.getByRole("button",{name:"Physik pausieren",exact:true}).click();
  const read=()=>page.evaluate(()=>({physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics!),
    generation:document.body.dataset.hestiaPrototypeTerrainGeneration,digest:document.body.dataset.hestiaPrototypeSourceDigest,
    sectors:document.body.dataset.hestiaPrototypeTerrainSectors,support:JSON.parse(document.body.dataset.hestiaPrototypeSupport||"null")}));
  await expect.poll(async()=>(await read()).physics.status).toBe("Paused");
  const before=await read();
  await page.getByRole("button",{name:"Felsarm-Stütze prüfen (ohne Schnitt)",exact:true}).click();
  await expect.poll(async()=>(await read()).support?.state,{timeout:30_000}).toBe("Ready");
  const after=await read();
  expect(after.support).toMatchObject({fragments:1,cells:384,massKg:1722.65625,changedCells:64});
  expect(after.support.probes).toBeGreaterThan(384);expect(after.support.probes).toBeLessThanOrEqual(262_144);
  expect(after.support.timings).toMatchObject({fragmentCount:1,fragmentCells:384});
  for(const key of ["seedsMs","supportMs","ingestMs","recipeMs","totalMs"] as const){
    expect(typeof after.support.timings[key],`support.timings.${key}`).toBe("number");
    expect(after.support.timings[key],`support.timings.${key}`).toBeGreaterThanOrEqual(0);
  }
  expect(after.support.timings.totalMs).toBeLessThan(30_000);
  const breakdown=after.support.timings.recipeBreakdown;
  expect(breakdown,`recipeBreakdown ${JSON.stringify(after.support.timings)}`).toBeTruthy();
  for(const key of ["massMs","classifyMs","transitionMs","axesMs"] as const){
    expect(typeof breakdown[key],`recipeBreakdown.${key}`).toBe("number");
    expect(breakdown[key],`recipeBreakdown.${key}`).toBeGreaterThanOrEqual(0);
  }
  await testInfo.attach("support-sub-spans",{body:Buffer.from(JSON.stringify(after.support.timings)),contentType:"application/json"});
  expect(after.generation).toBe(before.generation);expect(after.digest).toBe(before.digest);expect(after.sectors).toBe(before.sectors);
  expect(after.physics.bodies).toEqual(before.physics.bodies);expect(after.physics.ticks).toBe(before.physics.ticks);
  expect(after.physics.bodyCount).toBe(before.physics.bodyCount);expect(after.physics.colliderCount).toBe(before.physics.colliderCount);
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera","C05-ROCKARM");
  await testInfo.attach("canonical-rock-support-preview",{body:await page.screenshot(),contentType:"image/png"});
  await testInfo.attach("support-preview-readonly",{body:Buffer.from(JSON.stringify({before,after})),contentType:"application/json"});
  await expect(page.evaluate(()=>"TestBridge" in window)).resolves.toBe(false);expect(errors).toEqual([]);
});

test("existing routes stay untouched and combined queries resolve to Surface Lab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#flight-hud")).toBeVisible();
  await expect(page.locator(".hud-center-safe-area")).toBeVisible();
  await expect(page.locator("#hvp-hud")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);

  await page.goto("/?surfaceLab=1&hestiaPrototype=1");
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab", "1");
  await expect(page.locator("#hvp-hud")).toHaveCount(0);
});

test("stored HVP PNG evidence rejects missing, corrupt, blank, and wrong-size replacements", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });

  const validImage = await readStoredPngEvidence(evidenceDirectory);
  const blankImage = await renderBlankPng(page, hvpDimensions.width, hvpDimensions.height);
  const wrongSizeImage = await renderWrongSizePng(page, 640, 360);
  await assertCanvasEvidence(page, `stored ${pngName}`, validImage);

  const expectRejected = async (label: string, mutate: (directory: string) => Promise<void>): Promise<void> => {
    const directory = await mkdtemp(path.join(tmpdir(), "hvp-visible-coast-negative-"));
    try {
      await writeFile(path.join(directory, pngName), validImage);
      await mutate(directory);
      await expect(loadAndValidateStoredHvpEvidence(page, directory), label).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };

  await expectRejected("missing stored PNG", async (directory) => {
    await rm(path.join(directory, pngName));
  });
  await expectRejected("corrupt stored PNG", async (directory) => {
    await writeFile(path.join(directory, pngName), Buffer.from("not a PNG"));
  });
  await expectRejected("blank stored PNG", async (directory) => {
    await writeFile(path.join(directory, pngName), blankImage);
  });
  await expectRejected("wrong-size stored PNG", async (directory) => {
    await writeFile(path.join(directory, pngName), wrongSizeImage);
  });
});
