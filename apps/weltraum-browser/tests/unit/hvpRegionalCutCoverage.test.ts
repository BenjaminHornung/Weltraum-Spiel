import {afterEach,expect,it,vi} from "vitest";
import {Vector3} from "three";
import {createHvpPlasmaTool} from "../../src/hestia-prototype/terrain/plasmaTool";
import {createHvpTerrainRoot,type HvpTerrainSnapshot} from "../../src/hestia-prototype/terrain/cutPlan";
import {createHvpTerrainConsumer} from "../../src/hestia-prototype/terrain/terrainConsumer";

const base={sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",readSlot:()=>0};
function setup(){
  const primary=createHvpTerrainRoot(base,"coverage-fixture",2);
  const makeEast=(material:number)=>createHvpTerrainRoot({...base,originMeters:{...base.originMeters,x:16},
    readSlot:(x:number)=>x===2?material:0},"coverage-fixture:east",2).read();
  const compile=vi.fn(async()=>{throw Error("East has no mutation authority");});
  const consumer=createHvpTerrainConsumer(primary,compile,()=>{throw Error("unexpected render");},{} as never);
  let resolve!:(s:HvpTerrainSnapshot|undefined)=>void;
  const request=vi.fn(()=>new Promise<HvpTerrainSnapshot|undefined>(yes=>{resolve=yes;}));
  const aim={origin:new Vector3(15.9,2,0),direction:new Vector3(1,0,0)};
  let playing=true;const readAim=()=>playing?aim:undefined;
  const tool=createHvpPlasmaTool(primary,consumer,readAim,()=>{},[],undefined,undefined,{readAim,request});
  return {tool,consumer,compile,request,primary,makeEast,aim,pause:()=>{playing=false;},deliver:async(s:HvpTerrainSnapshot|undefined)=>{resolve(s);await Promise.resolve();}};
}
afterEach(()=>vi.useRealTimers());
it.each([[4,"ProtectedRegion"],[0,"Miss"]] as const)("resolves original ray with material %d without writing",async(material,state)=>{
  const h=setup(),before=h.primary.read();
  await h.tool.confirm();await h.tool.confirm();
  expect(h.request).toHaveBeenCalledTimes(1);
  expect(h.tool.read()).toMatchObject({coverage:{state:"PendingCoverage"},issued:0,queued:0,receipts:0});
  h.aim.direction.set(-1,0,0);
  await h.deliver(h.makeEast(material));
  expect(h.tool.read().coverage?.state).toBe(state);
  expect(h.primary.read()).toBe(before);expect(h.compile).not.toHaveBeenCalled();
  expect((await h.consumer.checkpoint()).entries).toEqual([]);
});
it.each(["save","restore","dispose","timeout","foreign"] as const)("cannot adopt a late reply after %s",async(action)=>{
  vi.useFakeTimers();
  const h=setup(),saved=h.tool.checkpoint();
  await h.tool.confirm();
  if(action==="save") h.tool.checkpoint();
  if(action==="restore"){h.pause();h.tool.restore(saved);}
  if(action==="dispose")h.tool.dispose();
  if(action==="timeout")await vi.advanceTimersByTimeAsync(5000);
  const east=h.makeEast(3);
  await h.deliver(action==="foreign"?{...east,epoch:9}:east);
  expect(h.tool.read().coverage?.state).toBe(action==="foreign"||action==="timeout"?"CoverageUnavailable":"Cancelled");
  expect(saved.sequence).toBe(0);
  expect(h.primary.read().revision).toBe(0);expect(h.compile).not.toHaveBeenCalled();
});
it("only requests the reachable eastern region",async()=>{
  const h=setup();
  h.aim.origin.set(-15.9,2,0);h.aim.direction.set(-1,0,0);
  await h.tool.confirm();
  expect(h.request).not.toHaveBeenCalled();expect(h.tool.read().coverage).toBeUndefined();
});
