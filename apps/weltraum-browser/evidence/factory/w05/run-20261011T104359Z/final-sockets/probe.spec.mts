import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const run=process.env.FP06_E2E_RUN_DIR!;
test("synthetic S0 GPU import, source poses, missing part and owned cleanup",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/evidence/factory/w05/"+run.split("/evidence/factory/w05/")[1]+"/probe.html");
  await page.waitForFunction(()=>window.__factoryS0ProbeReady===true);
  const captures:unknown[]=[];
  const capture = async (name: string, metadata: {assetId:string;status:string;phase:string}) => {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator("#status")).toHaveText(metadata.assetId + " · " + metadata.status + " · " + metadata.phase);
    await page.screenshot({path:join(run,name)});
  };
  for(const definition of ["B06","B07"]){
    for(const view of ["full","side","top","player"]){
      const metadata=await page.evaluate(({definition,view})=>window.__factoryS0Probe.show(definition,view,"IDLE",0),{definition,view});
      expect(metadata.diagnostics.visibleRepresentationKeys.length).toBeGreaterThan(0);
      expect(metadata.gpu.geometries).toBeGreaterThan(0);
      await capture(definition+"-"+view+"-idle.png",metadata);
      captures.push({definition,view,metadata});
    }
    for(const work of [definition==="B06"?7500:10000,definition==="B06"?18000:24000,definition==="B06"?28500:38000]){
      const metadata=await page.evaluate(({definition,work})=>window.__factoryS0Probe.show(definition,"full","RUNNING",work),{definition,work});
      await capture(definition+"-run-"+work+".png",metadata);captures.push({definition,work,metadata});
    }
    const paused=await page.evaluate(()=>window.__factoryS0Probe.sample("WAIT_POWER",15000));
    expect(await page.evaluate(()=>window.__factoryS0Probe.sample("WAIT_POWER",15000))).toMatchObject({partPoses:paused.partPoses});
    await capture(definition+"-wait-power.png",paused);
    const damage=await page.evaluate(()=>window.__factoryS0Probe.damageTool());
    for(let i=0;i<3;i++) expect((await page.evaluate(()=>window.__factoryS0Probe.sample("FAULT",15000))).partPoses).toEqual(damage.partPoses);
    await capture(definition+"-synthetic-tool-missing.png",damage);captures.push({definition,paused,damage});
    const night=await page.evaluate(({definition})=>window.__factoryS0Probe.show(definition,"full","IDLE",0,"night"),{definition});
    await capture(definition+"-night-low-dpr1.png",night);captures.push({definition,night});
  }
  for(const definition of ["fp02.device.wind_pack_6kw","fp02.device.pv_pack_2kwp","fp02.device.battery_4kwh","fp02.device.distribution_40kw"]){
    const metadata=await page.evaluate(definition=>window.__factoryS0Probe.show(definition,"full"),definition);
    await capture(metadata.instanceId+".png",metadata);captures.push({definition,metadata});
    if(definition.includes("wind_") || definition.includes("pv_")) {
      const socket=await page.evaluate(definition=>window.__factoryS0Probe.show(definition,"socket"),definition);
      await capture(socket.instanceId+"-socket-close.png",socket);captures.push({definition,view:"socket",metadata:socket});
    }
  }
  const churn=await page.evaluate(()=>window.__factoryS0Probe.churn());
  expect(churn).toHaveLength(100);
  for(const result of churn){expect(result.canvasListeners).toBe(0);expect(result.gpu.geometries).toBe(0);expect(result.diagnostics.ownedCpuBytes).toBe(0);}
  expect(errors).toEqual([]);
  await writeFile(join(run,"browser-probe-result.json"),JSON.stringify({status:"PASS",synthetic:true,catalogDigest:await page.evaluate(()=>window.__factoryS0Probe.catalogDigest),artOwnerAcceptance:"NOT_RUN",hvoxCompilation:"NOT_RUN",gameplayDamage:"NOT_RUN",captures,churn,pageErrors:errors},null,2)+"\n");
});
