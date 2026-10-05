import {expect,it} from "vitest";
import {createHash} from "node:crypto";
import {canonicalAdaptiveJson,deepFreeze,isDeepFrozen} from "../../src/voxel/adaptive";
import {mergeGreedyQuantumBoxes} from "../../src/voxel/structural";
import * as structural from "../../src/voxel/structural";
import {mergeGreedyQuantumBoxesOwnedSteps} from "../../src/voxel/structural/physicsTransition";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {structuralPositiveBudget} from "../../src/voxel/structural/validation";

type Cell=Readonly<{x:number;y:number;z:number}>;
const cube:Cell[]=[];
for(let z=-8;z<24;z+=1){for(let y=4;y<36;y+=1){for(let x=-17;x<15;x+=1){cube.push(Object.freeze({x,y,z}));}}}
Object.freeze(cube);
const comb=deepFreeze([
  {x:-1,y:1,z:1},{x:-2,y:1,z:1},{x:-3,y:1,z:1},{x:-3,y:2,z:1},
  {x:-1,y:2,z:1},{x:-3,y:1,z:2},{x:-1,y:1,z:2}
]);
const samples:unknown[]=[];
const sha=(bytes:string)=>createHash("sha256").update(bytes).digest("hex");
const failureOf=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected greedy failure");};
const owned=(cells:readonly Cell[],limit=96*1024*1024)=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,limit);ledger.reserve(1024);
  let steps:ReturnType<typeof mergeGreedyQuantumBoxesOwnedSteps>|undefined=mergeGreedyQuantumBoxesOwnedSteps(cells,"fixture",ledger.reserve);
  let state:"open"|"done"|"failed"|"disposed"="open",first:unknown,units=0,maxAdvanceMs=0;
  const close=()=>{try{steps?.return(undefined as never);}catch{/* do not replace the original failure */}steps=undefined;};
  return {advance(value:number){
    if(state==="failed"){throw first;}if(state!=="open"){throw new Error("Once-only greedy result");}
    const start=performance.now();
    try{
      const max=structuralPositiveBudget(value,"cursor/maxUnits");
      for(let index=0;index<max;index+=1){
        units+=1;const step=steps!.next();
        if(step.done){state="done";close();ledger.release(true);return {done:true as const,value:step.value};}
      }
      return {done:false as const};
    }catch(error){state="failed";first=error;close();ledger.release();throw error;}
    finally{maxAdvanceMs=Math.max(maxAdvanceMs,performance.now()-start);}
  },dispose(){if(state!=="failed"){state="disposed";}close();ledger.release();},
  get units(){return units;},get maxAdvanceMs(){return maxAdvanceMs;},get resources(){return ledger.resources;}};
};
const finish=(cursor:ReturnType<typeof owned>,work:readonly number[])=>{
  let advances=0;
  for(;;){
    const budget=work[advances%work.length]!,before=cursor.units,step=cursor.advance(budget);advances+=1;
    if(cursor.units-before>budget||cursor.units>2_000_000){throw new Error("Greedy work/progress bound exceeded");}
    if(step.done){return {value:step.value,advances};}
  }
};

it("retains complete greedy seed/expansion/coverage order across cooperative boundaries",()=>{
  const inputBytes=canonicalAdaptiveJson(cube);
  expect(cube).toHaveLength(32768);
  expect(Buffer.byteLength(inputBytes)).toBe(735233);
  expect(sha(inputBytes)).toBe("05197c58fcff66d4ddae848c03669564d3d3a416f15293a1abad6570594423dc");
  for(const [cells,expected] of [
    [cube,[{min:{x:-17,y:4,z:-8},max:{x:15,y:36,z:24}}]],
    [comb,[{min:{x:-3,y:1,z:1},max:{x:0,y:2,z:2}},
      {min:{x:-3,y:2,z:1},max:{x:-2,y:3,z:2}},{min:{x:-1,y:2,z:1},max:{x:0,y:3,z:2}},
      {min:{x:-3,y:1,z:2},max:{x:-2,y:2,z:3}},{min:{x:-1,y:1,z:2},max:{x:0,y:2,z:3}}]]
  ] as const){
    for(let run=0;run<3;run+=1){
      const started=performance.now(),result=mergeGreedyQuantumBoxes(cells,"fixture"),milliseconds=performance.now()-started;
      expect(result).toEqual(expected);expect(isDeepFrozen(result)).toBe(true);
      samples.push({cells:cells.length,run,milliseconds,completeCanonical:canonicalAdaptiveJson(result)});
    }
  }
  expect(mergeGreedyQuantumBoxes([],"empty")).toEqual([]);
  expect(()=>mergeGreedyQuantumBoxes([{x:0,y:0,z:0},{x:0,y:0,z:0}],"duplicate")).toThrow("unique quantum cells");
  expect(()=>mergeGreedyQuantumBoxes([{x:Number.MAX_SAFE_INTEGER+1,y:0,z:0}],"unsafe")).toThrow("safe-integer quantum cells");
  const ownedSamples:unknown[]=[];let whole=0;
  for(const [cells,work] of [[cube,[1,7,64,257]],[comb,[1]],[comb,[7]],[comb,[64]],[comb,[257]]] as const){
    const expected=canonicalAdaptiveJson(mergeGreedyQuantumBoxes(cells,"fixture")),start=performance.now(),cursor=owned(cells);
    const result=finish(cursor,work),milliseconds=performance.now()-start;whole=Math.max(whole,cursor.units);
    expect(canonicalAdaptiveJson(result.value)).toBe(expected);expect(isDeepFrozen(result.value)).toBe(true);
    expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.resources.retainedEstimateBytes).toBe(0);
    expect(cursor.resources.peakEstimateBytes).toBeLessThanOrEqual(256*1024*1024);
    ownedSamples.push({cells:cells.length,work,milliseconds,units:cursor.units,advances:result.advances,
      maxAdvanceMs:cursor.maxAdvanceMs,resources:cursor.resources});
    expect(()=>cursor.advance(1)).toThrow("Once-only");cursor.dispose();cursor.dispose();
    expect(canonicalAdaptiveJson(result.value)).toBe(expected);
  }
  expect(structural).not.toHaveProperty("mergeGreedyQuantumBoxesOwnedSteps");
  const empty=owned([]);expect(finish(empty,[1]).value).toEqual([]);expect(empty.resources.reservedBytes).toBe(0);
  for(const cells of [deepFreeze([{x:0,y:0,z:0},{x:0,y:0,z:0}]),deepFreeze([{x:0.5,y:0,z:0}])]){
    const generic=failureOf(()=>mergeGreedyQuantumBoxes(cells,"fixture")),cursor=owned(cells);
    const error=failureOf(()=>finish(cursor,[7]));
    expect(error).toMatchObject({name:(generic as Error).name,message:(generic as Error).message,
      code:(generic as {code:string}).code,path:(generic as {path:string}).path});
    cursor.dispose();expect(failureOf(()=>cursor.advance(1))).toBe(error);expect(cursor.resources.reservedBytes).toBe(0);
  }
  for(const boundary of [0,1,32768,65536,Math.floor(whole/2),whole-1]){
    const cursor=owned(cube);if(boundary>0){expect(cursor.advance(boundary).done).toBe(false);}cursor.dispose();cursor.dispose();
    expect(cursor.resources.reservedBytes).toBe(0);expect(()=>cursor.advance(1)).toThrow("Once-only");
  }
  const small=owned(cube,2048),cap=failureOf(()=>finish(small,[1]));small.dispose();
  expect(cap).toMatchObject({path:"cursor/prepareBytes"});expect(failureOf(()=>small.advance(257))).toBe(cap);
  expect(small.resources.reservedBytes).toBe(0);
  const invalid=owned(comb);invalid.advance(1);const badBudget=failureOf(()=>invalid.advance(0));invalid.dispose();
  expect(failureOf(()=>invalid.advance(1))).toBe(badBudget);expect(invalid.resources.reservedBytes).toBe(0);
  const parent=createStructuralOwnerLedger(32*1024*1024);parent.reserve(4096);
  const steps=mergeGreedyQuantumBoxesOwnedSteps(comb,"fixture",parent.reserve);let borrowed:ReturnType<typeof mergeGreedyQuantumBoxes>|undefined;
  try{for(;;){const step=steps.next();if(step.done){borrowed=step.value;break;}}}finally{steps.return(undefined as never);}
  expect(borrowed).toEqual(mergeGreedyQuantumBoxes(comb,"fixture"));expect(parent.resources.reservedBytes).toBeGreaterThan(4096);
  parent.release();expect(parent.resources.reservedBytes).toBe(0);expect(borrowed).toEqual(mergeGreedyQuantumBoxes(comb,"fixture"));
  const observed=[{x:8,y:9,z:10}];let iterators=0;
  Object.defineProperty(observed,Symbol.iterator,{value:function*(){iterators+=1;yield {x:8,y:9,z:10};}});
  expect(mergeGreedyQuantumBoxes(observed,"generic")).toEqual([{min:{x:8,y:9,z:10},max:{x:9,y:10,z:11}}]);
  expect(iterators).toBe(1);
  const nativeSort=Array.prototype.sort,sentinel=new Error("native sort returned seed getter");let sortFailure:unknown;
  try{
    Array.prototype.sort=function(compare){
      return new Proxy(nativeSort.call(this,compare),{get(target,key,receiver){
        if(key==="0"){throw sentinel;}return Reflect.get(target,key,receiver);
      }});
    };
    sortFailure=failureOf(()=>mergeGreedyQuantumBoxes([{x:8,y:9,z:10}],"generic/sort-return"));
  }finally{Array.prototype.sort=nativeSort;}
  expect(sortFailure).toBe(sentinel);
  expect(canonicalAdaptiveJson(cube)).toBe(inputBytes);
  console.info("GREEDY_BOXES_BASELINE",JSON.stringify({samples,inputBytes:Buffer.byteLength(inputBytes),inputSha256:sha(inputBytes),
    activation:"OFF",physicalHeap:"NOT_PROVEN",performanceAcceptance:"NOT_PROVEN"}));
  console.info("GREEDY_BOXES_OWNED",JSON.stringify({ownedSamples,wholeCubeUnits:whole,
    coverage:"Complete32768 cube uses one cyclic1/7/64/257 lifetime; comb has four complete lifetimes, not four cube runs",
    finalScratchBytes:0,activation:"OFF",physicalHeap:"NOT_PROVEN",performanceAcceptance:"NOT_PROVEN"}));
});
