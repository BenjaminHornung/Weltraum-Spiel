import {expect,it} from "vitest";
import {createHash} from "node:crypto";
import {canonicalAdaptiveJson,deepFreeze,isDeepFrozen} from "../../src/voxel/adaptive";
import * as structural from "../../src/voxel/structural";
import {deriveStructuralComponentClassification,deriveStructuralComponentMassProperties,deriveStructuralObjectMassProperties,
  serializeStructuralObject,type StructuralComponentMassBudgets} from "../../src/voxel/structural";
import {deriveStructuralSingleComponentMasses,structuralOwnedSingleComponentMassesSteps} from "../../src/voxel/structural/massProperties";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {drainStructuralSteps,structuralDenseArray,structuralMapSteps,structuralPositiveBudget} from "../../src/voxel/structural/validation";
import {validateStructuralCellAddress} from "../../src/voxel/structural/coordinates";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";

const budgets=Object.freeze({maxVisitedCells:32768,maxConnectivityCells:32768,maxComponents:32,maxConnectivityFacts:262144});
const material=(materialId:number,densityKgPerCubicMeter:number)=>({materialId,densityKgPerCubicMeter,
  structuralClass:"stone",destructible:true,tags:null});
const materials=deepFreeze([material(256,768.1),material(1,512)]);
const fixture=()=>{
  const cells:HvpStructuralCell[]=[];
  for(let z=0;z<2;z+=1){for(let y=4;y<8;y+=1){for(let x=-2;x<6;x+=1){
    cells.push({x,y,z,materialId:x<=0&&z===0?1:256});
  }}}
  return ingestHvpStructuralCells("mass.child.literal",deepFreeze(cells),materials);
};
const sha=(bytes:string)=>createHash("sha256").update(bytes).digest("hex");
type Prepared=ReturnType<typeof deriveStructuralSingleComponentMasses>;
type Source=ReturnType<typeof fixture>;

it("reuses the fresh immutable sole-component mass only after complete classification",()=>{
  const source=fixture(),ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const generic=deriveStructuralSingleComponentMasses(source,budgets,()=>{},()=>{});
  expect(generic.componentMass).not.toBe(generic.objectMass);
  const steps=structuralOwnedSingleComponentMassesSteps(source,budgets,ledger.reserve,()=>{},()=>{});
  try{for(;;){const step=steps.next();if(step.done){
    const value=step.value;
    expect(value.componentMass).toBe(value.objectMass);expect(Object.isFrozen(value.objectMass)).toBe(true);
    expect(canonicalAdaptiveJson(value)).toBe(canonicalAdaptiveJson(generic));
    expect(value.classification.fragments[0]!.occupiedCells).toHaveLength(value.objectMass.occupiedVoxelCount);
    break;
  }}}finally{steps.return(undefined as never);ledger.release();}
  expect(ledger.resources.reservedBytes).toBe(0);
});

// Complete original-kernel literal captured BEFORE any mass implementation change, including
// decimal roundoff and the near-zero signed cross terms. Never recomputed from an owned result.
const literalMass={schemaVersion:"structural-microvoxel-mass-properties-v1",algorithmVersion:"structural-microvoxel-mass-v1",
  totalMassKg:90.01015624999991,centerOfMassMeters:{x:0.27083911971739333,y:0.7500000000000007,z:0.12916782394347878},
  boundsMeters:{min:{x:-0.25,y:0.5,z:0},max:{x:0.75,y:1,z:0.25}},
  inertiaTensorKgMetersSquared:{xx:2.3424509411771925,yy:7.772686059148695,zz:9.180658295054839,
    xy:9.71445146547012e-17,xz:0.1250509988666372,yz:3.469446951953614e-17},
  occupiedVoxelCount:64,sourceRevision:0,sourceContentHash:"fnv1a64-v1:b8aaeadb512d9c13",contentHash:"fnv1a64-v1:bc0809441cb9eeb9"};

const own=(source:Source,budgetValue:StructuralComponentMassBudgets=budgets,limit=96*1024*1024,
  afterMass:Parameters<typeof deriveStructuralSingleComponentMasses>[2]=()=>{},
  afterClassification:Parameters<typeof deriveStructuralSingleComponentMasses>[3]=()=>{})=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,limit);ledger.reserve(16384);
  let phase="objectMass";
  const nextPeaks=new Map<string,{count:number;maxMilliseconds:number;worstUnit:number;nextPhase:string;yieldMarker:string|null}>();
  const advances=new Map<number,number[]>();
  let steps:ReturnType<typeof structuralOwnedSingleComponentMassesSteps>|undefined=
    structuralOwnedSingleComponentMassesSteps(source,budgetValue,ledger.reserve,
      mass=>{afterMass(mass);phase="classification";},classification=>{afterClassification(classification);phase="componentMass";});
  let state:"open"|"done"|"failed"|"disposed"="open",first:unknown,units=0,maxAdvanceMilliseconds=0;
  const stop=()=>{try{steps?.return(undefined as never);}catch{/* preserve the first failure */}steps=undefined;};
  return {advance(value:number){
    if(state==="failed"){throw first;}if(state!=="open"){throw new Error("Once-only mass result");}
    const started=performance.now();
    try{
      const budget=structuralPositiveBudget(value,"cursor/maxUnits");
      for(let index=0;index<budget;index+=1){
        const nextStarted=performance.now(),phaseBefore=phase;units+=1;const step=steps!.next();
        const nextMilliseconds=performance.now()-nextStarted;
        let peak=nextPeaks.get(phaseBefore);
        if(peak===undefined){peak={count:0,maxMilliseconds:0,worstUnit:0,nextPhase:phaseBefore,yieldMarker:null};nextPeaks.set(phaseBefore,peak);}
        peak.count+=1;
        if(nextMilliseconds>peak.maxMilliseconds){
          peak.maxMilliseconds=nextMilliseconds;peak.worstUnit=units;peak.nextPhase=phase;
          peak.yieldMarker=step.done?"result":typeof step.value==="string"?step.value:null;
        }
        if(step.done){state="done";stop();ledger.release(true);return {done:true as const,value:step.value};}
      }
      return {done:false as const};
    }catch(error){state="failed";first=error;stop();ledger.release();throw error;}
    finally{
      const duration=performance.now()-started;maxAdvanceMilliseconds=Math.max(maxAdvanceMilliseconds,duration);
      const values=advances.get(value);
      if(values===undefined){advances.set(value,[duration]);}else{values.push(duration);}
    }
  },dispose(){if(state!=="failed"){state="disposed";}stop();ledger.release();},
  get nextPeaks(){return [...nextPeaks].map(([phaseBefore,peak])=>({phaseBefore,...peak}));},
  get advanceTimings(){return [...advances].map(([budget,raw])=>{
    const sorted=[...raw].sort((a,b)=>a-b);
    return {budget,count:raw.length,rawMilliseconds:[...raw],p95Milliseconds:sorted[Math.ceil(sorted.length*.95)-1]!,
      maxMilliseconds:sorted[sorted.length-1]!};
  });},
  get units(){return units;},get maxAdvanceMilliseconds(){return maxAdvanceMilliseconds;},get resources(){return ledger.resources;}};
};
const finish=(cursor:ReturnType<typeof own>,work:readonly number[])=>{
  const counts=new Map<number,number>();let index=0,maxAdvance=0;
  for(;;){
    const budget=work[index%work.length]!,before=cursor.units,step=cursor.advance(budget);index+=1;
    const used=cursor.units-before;maxAdvance=Math.max(maxAdvance,used);counts.set(budget,(counts.get(budget)??0)+1);
    if(used>budget||cursor.units>1_000_000){throw new Error("Mass fixture work/progress bound exceeded");}
    if(step.done){return {value:step.value,maxAdvance,budgetCounts:[...counts]};}
  }
};
const failureOf=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected mass failure");};

it("keeps complete single-component source, float traversal, callbacks and one borrowed inactive mass lifetime",()=>{
  const source=fixture(),sourceBefore=serializeStructuralObject(source),samples:unknown[]=[];
  expect(source.bricks).toHaveLength(2);expect(isIssuedStructuralObject(source)).toBe(true);
  const objectMass=deriveStructuralObjectMassProperties(source,budgets);
  const classification=deriveStructuralComponentClassification(source,{maxVisitedCells:budgets.maxConnectivityCells,
    maxComponents:budgets.maxComponents,maxIndexedFacts:budgets.maxConnectivityFacts});
  const componentMass=deriveStructuralComponentMassProperties(source,classification.detachedComponents[0]!,budgets);
  const oracle=deepFreeze({objectMass,classification,componentMass,budgets}),bytes=canonicalAdaptiveJson(oracle);
  expect(source.contentHash).toBe("fnv1a64-v1:b8aaeadb512d9c13");expect(Buffer.byteLength(sourceBefore)).toBe(7949);
  expect(sha(sourceBefore)).toBe("00f99aacadc5f8e6e45c145e53b99158c4c145b2de60918c169bd03c1508c3df");
  expect(objectMass).toEqual(literalMass);expect(componentMass).toEqual(literalMass);
  expect(Buffer.byteLength(bytes)).toBe(54820);expect(sha(bytes)).toBe("9f9c5767fd5c9df57c0b93b2067df242152497bbe6743ea840ce6cb355217a85");
  const addresses=classification.detachedComponents[0]!.occupiedCells,addressBytes=canonicalAdaptiveJson(addresses),mapSamples:unknown[]=[];
  for(let pair=0;pair<6;pair+=1){
    for(const kind of pair%2===0?["native","shared"]:["shared","native"]){
      let mapped:ReturnType<typeof validateStructuralCellAddress>[]=[];
      const started=performance.now();
      for(let repeat=0;repeat<8;repeat+=1){
        mapped=kind==="native"
          ?structuralDenseArray(addresses,"occupiedCells",budgets.maxVisitedCells).map((address,index)=>validateStructuralCellAddress(address,`occupiedCells/${index}`))
          :drainStructuralSteps(structuralMapSteps(addresses,"occupiedCells",budgets.maxVisitedCells,
            function*(address,index){return validateStructuralCellAddress(address,`occupiedCells/${index}`);}));
      }
      const milliseconds=performance.now()-started;
      expect(canonicalAdaptiveJson(mapped)).toBe(addressBytes);
      mapSamples.push({pair,kind,repetitions:8,validatedAddresses:8*64,milliseconds});
    }
  }
  for(let index=0;index<3;index+=1){
    const order:string[]=[],start=performance.now();let afterMass=0,afterClassification=0;
    const prepared=deriveStructuralSingleComponentMasses(source,budgets,()=>{afterMass=performance.now();order.push("mass");},
      ()=>{afterClassification=performance.now();order.push("classification");});
    const end=performance.now();
    expect(prepared).toEqual(oracle);expect(canonicalAdaptiveJson(prepared)).toBe(bytes);
    expect(order).toEqual(["mass","classification"]);expect(isDeepFrozen(prepared)).toBe(true);
    samples.push({milliseconds:end-start,objectMassMilliseconds:afterMass-start,
      classificationMilliseconds:afterClassification-afterMass,componentMassMilliseconds:end-afterClassification});
  }
  const ownedSamples:unknown[]=[];let whole=0,retained:Prepared|undefined;
  for(const work of [[1,7,16,32,64,257],[257],[257],[16],[16]]){
    const order:string[]=[],start=performance.now(),cursor=own(source,budgets,96*1024*1024,
      ()=>{order.push("mass");},()=>{order.push("classification");});
    const done=finish(cursor,work),milliseconds=performance.now()-start;
    whole=cursor.units;retained=done.value;
    expect(retained).toEqual(oracle);expect(canonicalAdaptiveJson(retained)).toBe(bytes);expect(order).toEqual(["mass","classification"]);
    expect(isDeepFrozen(retained)).toBe(true);expect(retained.budgets).not.toBe(budgets);
    expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.resources.retainedEstimateBytes).toBe(0);
    expect(cursor.resources.peakEstimateBytes).toBeLessThanOrEqual(256*1024*1024);expect(cursor.resources.hashReservations).toBeGreaterThan(2);
    expect(cursor.nextPeaks.reduce((count,phase)=>count+phase.count,0)).toBe(whole);
    ownedSamples.push({work,units:whole,maxAdvance:done.maxAdvance,budgetCounts:done.budgetCounts,milliseconds,
      maxAdvanceMilliseconds:cursor.maxAdvanceMilliseconds,nextPeaks:cursor.nextPeaks,advanceTimings:cursor.advanceTimings,resources:cursor.resources});
    expect(()=>cursor.advance(1)).toThrow("Once-only");cursor.dispose();cursor.dispose();
    expect(canonicalAdaptiveJson(retained)).toBe(bytes);expect(isIssuedStructuralObject(source)).toBe(true);
  }
  expect(structural).not.toHaveProperty("structuralOwnedSingleComponentMassesSteps");
  const negatives:readonly [Source,StructuralComponentMassBudgets][]=[
    [Object.freeze({...source}),budgets],[new Proxy(source,{}),budgets],
    [source,Object.freeze({...budgets,maxVisitedCells:63})],[source,Object.freeze({...budgets,maxConnectivityCells:63})],
    [source,Object.freeze({...budgets,maxComponents:0})],[source,Object.freeze({...budgets,maxConnectivityFacts:0})],
    [ingestHvpStructuralCells("mass.split",deepFreeze([{x:0,y:0,z:0,materialId:1},{x:5,y:0,z:0,materialId:1}]),materials),budgets],
    [ingestHvpStructuralCells("mass.anchored",deepFreeze([{x:0,y:0,z:0,materialId:1}]),materials,deepFreeze([{x:0,y:0,z:0}])),budgets]
  ];
  for(const [input,limits] of negatives){
    const genericOrder:string[]=[],ownedOrder:string[]=[];
    const expected=failureOf(()=>deriveStructuralSingleComponentMasses(input,limits,()=>{genericOrder.push("mass");},()=>{genericOrder.push("classification");}));
    const cursor=own(input,limits,96*1024*1024,()=>{ownedOrder.push("mass");},()=>{ownedOrder.push("classification");});
    const actual=failureOf(()=>finish(cursor,[257]));
    expect(actual).toMatchObject({name:(expected as Error).name,message:(expected as Error).message,
      code:(expected as {code:string}).code,path:(expected as {path:string}).path});
    expect(ownedOrder).toEqual(genericOrder);cursor.dispose();expect(failureOf(()=>cursor.advance(1))).toBe(actual);
    expect(cursor.resources.reservedBytes).toBe(0);
  }
  for(const phase of ["mass","classification"]){
    const sentinel=new Error(`callback-${phase}`),cursor=own(source,budgets,96*1024*1024,
      ()=>{if(phase==="mass"){throw sentinel;}},()=>{if(phase==="classification"){throw sentinel;}});
    expect(failureOf(()=>finish(cursor,[257]))).toBe(sentinel);cursor.dispose();expect(failureOf(()=>cursor.advance(1))).toBe(sentinel);
    expect(cursor.resources.reservedBytes).toBe(0);
  }
  const tight=own(source,budgets,20_000),cap=failureOf(()=>finish(tight,[1]));expect(cap).toMatchObject({path:"cursor/prepareBytes"});
  tight.dispose();expect(failureOf(()=>tight.advance(257))).toBe(cap);expect(tight.resources.reservedBytes).toBe(0);
  const boundaries=[0,1,64,Math.floor(whole/3),Math.floor(whole/2),whole-1];
  for(const boundary of boundaries){
    const cursor=own(source);if(boundary>0){expect(cursor.advance(boundary).done).toBe(false);}cursor.dispose();cursor.dispose();
    expect(cursor.resources.reservedBytes).toBe(0);expect(()=>cursor.advance(1)).toThrow("Once-only");
  }
  const host=own(source),sentinel=new Error("host finally");
  try{host.advance(Math.floor(whole/2));throw sentinel;}catch(error){expect(error).toBe(sentinel);}finally{host.dispose();}
  expect(host.resources.reservedBytes).toBe(0);
  const invalid=own(source);expect(invalid.advance(Math.floor(whole/2)).done).toBe(false);
  const badBudget=failureOf(()=>invalid.advance(0));invalid.dispose();expect(failureOf(()=>invalid.advance(1))).toBe(badBudget);
  expect(badBudget).toMatchObject({path:"cursor/maxUnits"});expect(invalid.resources.reservedBytes).toBe(0);
  const parent=createStructuralOwnerLedger(32*1024*1024);parent.reserve(4096);
  const steps=structuralOwnedSingleComponentMassesSteps(source,budgets,parent.reserve,()=>{},()=>{});let borrowed:Prepared|undefined;
  try{for(;;){const step=steps.next();if(step.done){borrowed=step.value;break;}}}finally{steps.return(undefined as never);}
  expect(canonicalAdaptiveJson(borrowed)).toBe(bytes);expect(parent.resources.reservedBytes).toBeGreaterThan(4096);
  parent.release();expect(parent.resources.reservedBytes).toBe(0);expect(canonicalAdaptiveJson(borrowed)).toBe(bytes);
  expect(serializeStructuralObject(source)).toBe(sourceBefore);
  console.info("SINGLE_COMPONENT_MASS_GENERIC_MAP_DIAGNOSTIC",JSON.stringify({mapSamples,
    workload:"Same64 existing validated component addresses; six paired runs alternate direct native and shared generic map order, eight full maps each; all samples retained",
    sourceSha256:sha(sourceBefore),completeSha256:sha(bytes),productSourceChanged:false,
    ownerRestore5000RootCause:"NOT_PROVEN",performanceAcceptance:"NOT_PROVEN"}));
  console.info("SINGLE_COMPONENT_MASS_GENERIC_BASELINE_EVIDENCE",JSON.stringify({samples,sourceHash:source.contentHash,
    sourceBytes:Buffer.byteLength(sourceBefore),sourceSha256:sha(sourceBefore),completeBytes:Buffer.byteLength(bytes),
    completeSha256:sha(bytes),objectMass,componentMass,completeCanonical:bytes,
    productionActivation:"OFF",physicalHeap:"NOT_PROVEN",exclusive8ms:"NOT_PROVEN"}));
  console.info("SINGLE_COMPONENT_MASS_OWNED_EVIDENCE",JSON.stringify({ownedSamples,wholeUnits:whole,sourceHash:source.contentHash,
    completeBytes:54820,completeSha256:sha(bytes),negativeChecks:negatives.length,callbackFailureChecks:2,cancelBoundaries:boundaries.length,
    budgetCoverage:"Six budgets cycled in ONE complete lifetime, plus two257 and two16 samples, not six complete drains",
    timingInstrumentation:"Per-next clocks/phase peaks and raw per-budget advance timings; overhead is included in advances/total. Raw historical257 failure retained; no time threshold relaxed or timing acceptance claimed.",
    noPlanRecipeWorldAuthority:true,finalScratchBytes:0,physicalHeap:"NOT_PROVEN",exclusive8ms:"NOT_PROVEN",productionActivation:"OFF"}));
});
