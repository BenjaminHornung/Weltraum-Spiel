import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {expect,it,vi} from "vitest";
import {decodeHvpGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {validateSaveGameEnvelopeV1} from "../../src/persistence";
import {createHvpTerrainCompiler,releaseHvpOwnedTerrainProducts} from "../../src/hestia-prototype/terrain/terrainProducts";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {WorkerPool,type WorkerJobTerminal} from "../../src/workers/workerPool";
import {executeHvpChunkJobOwned} from "../../src/workers/hvpChunkJob";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {workerEpoch} from "../../src/workers/ids";
import {transferListFor} from "../../src/workers/protocol";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import type {HvpChunkPayload} from "../../src/hestia-prototype/terrain/terrainChunkInput";
import * as model from "../../src/voxel/structural/model";
import * as support from "../../src/hestia-prototype/terrain/supportPlan";
import * as persistence from "../../src/persistence";
import * as gridCheckpoint from "../../src/hestia-prototype/persistence/gridCheckpoint";
import * as coastSource from "../../src/hvp/hvpCoastSource";
import * as terrainCut from "../../src/hestia-prototype/terrain/cutPlan";
import * as worldCheckpoint from "../../src/hestia-prototype/persistence/worldCheckpoint";
import * as regionSource from "../../src/hestia-prototype/runtime/regionSource";
import * as bodyCheckpoint from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import * as structural from "../../src/voxel/structural";
import * as rigidRecipe from "../../src/hestia-prototype/physics/rigidRecipe";

const decode=vi.hoisted(()=>({enabled:false,calls:0,nextCalls:0,activeNextMs:0,completed:0}));
const trace=vi.hoisted(()=>{
  const row=()=>({calls:0,nextCalls:0,activeNextMs:0,completed:0});
  const phases={meshPrimary:row(),meshEast:row(),renderPack:row(),collisionMesh:row(),collisionOccupancyMesh:row(),inputHash:row(),renderHash:row(),outputHash:row()};
  const scope={inWorkerNext:false,eastWorker:false};
  const wrap=<Y,T,N>(steps:Generator<Y,T,N>,value:ReturnType<typeof row>)=>{
    if(!scope.inWorkerNext){return steps;}value.calls+=1;const next=steps.next.bind(steps);
    steps.next=(...args)=>{const start=performance.now();value.nextCalls+=1;
      try{const result=next(...args);if(result.done){value.completed+=1;}return result;}
      finally{value.activeNextMs+=performance.now()-start;}};
    return steps;
  };return {scope,phases,wrap};
});
vi.mock("../../src/hvp/hvpCoastMesher",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hvp/hvpCoastMesher")>();
  return {...actual,meshHvpOccupancySteps:(...args:Parameters<typeof actual.meshHvpOccupancySteps>)=>{
    const steps=actual.meshHvpOccupancySteps(...args),row=args[3]==="hvp-terrain-chunk-v1"?(trace.scope.eastWorker?trace.phases.meshEast:trace.phases.meshPrimary):args[3]==="hvp-collision-greedy-v1"?trace.phases.collisionOccupancyMesh:undefined;
    return row===undefined?steps:trace.wrap(steps,row);
  }};
});
vi.mock("../../src/workers/hvpTerrainJob",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/workers/hvpTerrainJob")>();
  return {...actual,packHvpTerrainMeshSteps:(...args:Parameters<typeof actual.packHvpTerrainMeshSteps>)=>trace.wrap(actual.packHvpTerrainMeshSteps(...args),trace.phases.renderPack)};
});
vi.mock("../../src/hestia-prototype/physics/terrainColliders",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/terrainColliders")>();
  return {...actual,meshCollisionInputOwnedSteps:(...args:Parameters<typeof actual.meshCollisionInputOwnedSteps>)=>trace.wrap(actual.meshCollisionInputOwnedSteps(...args),trace.phases.collisionMesh)};
});
vi.mock("../../src/workers/hvpBodyCutWire",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/workers/hvpBodyCutWire")>();
  return {...actual,fnv1aBytesSteps:(...args:Parameters<typeof actual.fnv1aBytesSteps>)=>{
    const steps=actual.fnv1aBytesSteps(...args),row=args[0].length===1?trace.phases.inputHash:args[0].length===6?trace.phases.renderHash:args[0].length===8?trace.phases.outputHash:undefined;
    return row===undefined?steps:trace.wrap(steps,row);
  }};
});
vi.mock("../../src/workers/hvpChunkJob",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/workers/hvpChunkJob")>();
  return {...actual,decodeHvpChunkOutputSteps:(...args:Parameters<typeof actual.decodeHvpChunkOutputSteps>)=>{
    const steps=actual.decodeHvpChunkOutputSteps(...args);if(!decode.enabled){return steps;}
    decode.calls+=1;const next=steps.next.bind(steps);
    steps.next=(...input)=>{const start=performance.now();decode.nextCalls+=1;
      try{const value=next(...input);if(value.done){decode.completed+=1;}return value;}
      finally{decode.activeNextMs+=performance.now()-start;}};
    return steps;
  }};
});

// ponytail: saved-input local attribution; promote only with a portable qualification fixture.
it.skipIf(!process.env.HVP_CHUNK_STARTUP_INPUT)("attributes the saved-East 512 real chunk kernels and consumer decode with fixed counters",async()=>{
  const outputPath=process.env.HVP_CHUNK_STARTUP_OUTPUT;if(!outputPath){throw new Error("Set a fresh startup receipt path");}
  const baselinePath=process.env.HVP_CHUNK_STARTUP_BASELINE;if(!baselinePath){throw new Error("Set the sealed startup packet baseline");}
  const baselineText=readFileSync(baselinePath,"utf8"),baselineSha256=createHash("sha256").update(baselineText).digest("hex");
  const baseline=JSON.parse(baselineText);expect(baseline.status).toBe("PASS");
  expect(baseline.orderedPacketSha256).toBe("314aa27bf2a0fee5d94ba9b4221a8b717125e2c03a5329cfa71b68574c7af809");
  const input=JSON.parse(readFileSync(process.env.HVP_CHUNK_STARTUP_INPUT!,"utf8"));
  const saved=input.nativeWake.residentEastColdLoad.saved as string,savedSha256=createHash("sha256").update(saved).digest("hex");
  const envelope=validateSaveGameEnvelopeV1(JSON.parse(saved),[]),checkpoint=envelope.player.data.hestia;
  const canonicalRow=()=>({calls:0,elapsedMs:0,completed:0});
  const sourceDecode={wallMs:0,transport:canonicalRow(),signature:canonicalRow(),canonicalCopy:canonicalRow(),
    primaryGrid:canonicalRow(),primaryCoast:canonicalRow(),primaryRoot:canonicalRow(),worldRestore:canonicalRow(),eastRestore:canonicalRow(),
    bodyDecode:canonicalRow(),bodyRegionDecode:canonicalRow(),bodyRecipe:canonicalRow()};
  const serialize=persistence.serializeCanonicalPersistenceValue,sign=persistence.createPersistenceSignature,canonical=persistence.canonicalizePersistenceValue;
  const serializeSpy=vi.spyOn(persistence,"serializeCanonicalPersistenceValue").mockImplementation(value=>{
    if(value!==checkpoint){return serialize(value);}const start=performance.now();sourceDecode.transport.calls+=1;
    try{const result=serialize(value);sourceDecode.transport.completed+=1;return result;}finally{sourceDecode.transport.elapsedMs+=performance.now()-start;}
  });
  const signSpy=vi.spyOn(persistence,"createPersistenceSignature").mockImplementation(value=>{
    if(!value||typeof value!=="object"||!("version" in value)||value.version!=="hvp-game-checkpoint-v1"||Object.hasOwn(value,"signature")){return sign(value);}
    const start=performance.now();sourceDecode.signature.calls+=1;
    try{const result=sign(value);sourceDecode.signature.completed+=1;return result;}finally{sourceDecode.signature.elapsedMs+=performance.now()-start;}
  });
  const copySpy=vi.spyOn(persistence,"canonicalizePersistenceValue").mockImplementation(value=>{
    if(value!==checkpoint){return canonical(value) as ReturnType<typeof canonical>;}const start=performance.now();sourceDecode.canonicalCopy.calls+=1;
    try{const result=canonical(value);sourceDecode.canonicalCopy.completed+=1;return result as ReturnType<typeof canonical>;}finally{sourceDecode.canonicalCopy.elapsedMs+=performance.now()-start;}
  });
  const rawCheckpoint=checkpoint as unknown as ReturnType<typeof decodeHvpGame>["checkpoint"];
  let primaryGrid:ReturnType<typeof gridCheckpoint.decodeHvpGrid>|undefined,primaryCoast:ReturnType<typeof coastSource.restoreHvpOwnedCoastGrid>|undefined;
  const measured=<Args extends unknown[],Result>(fn:(...args:Args)=>Result,row:ReturnType<typeof canonicalRow>,filter:(...args:Args)=>boolean,onResult?:(value:Result)=>void)=>(...args:Args):Result=>{
    if(!filter(...args)){return fn(...args);}const start=performance.now();row.calls+=1;
    try{const value=fn(...args);row.completed+=1;onResult?.(value);return value;}finally{row.elapsedMs+=performance.now()-start;}
  };
  let inWorldRestore=false,inBodyDecode=false;
  const originalGrid=gridCheckpoint.decodeHvpGrid,originalCoast=coastSource.restoreHvpOwnedCoastGrid,originalRoot=terrainCut.createHvpPrivateTerrainRoot,
    originalWorld=worldCheckpoint.decodeHvpWorld,originalEast=regionSource.restoreHvpEastRegion,originalBody=bodyCheckpoint.decodeHvpBody,
    originalRegion=structural.decodeStructuralRegionSave,originalRecipe=rigidRecipe.prepareHvpRigidBody;
  const sourceSpies=[
    vi.spyOn(gridCheckpoint,"decodeHvpGrid").mockImplementation(measured(originalGrid,sourceDecode.primaryGrid,value=>value===rawCheckpoint.terrain.base,value=>{primaryGrid=value;})),
    vi.spyOn(coastSource,"restoreHvpOwnedCoastGrid").mockImplementation(measured(originalCoast,sourceDecode.primaryCoast,value=>value===primaryGrid,value=>{primaryCoast=value;})),
    vi.spyOn(terrainCut,"createHvpPrivateTerrainRoot").mockImplementation(measured(originalRoot,sourceDecode.primaryRoot,(base,_session,_epoch,_observe,savedTerrain)=>base===primaryCoast&&savedTerrain===rawCheckpoint.terrain)),
    vi.spyOn(worldCheckpoint,"decodeHvpWorld").mockImplementation(measured((value:unknown)=>{
      const previous=inWorldRestore;inWorldRestore=true;try{return originalWorld(value);}finally{inWorldRestore=previous;}
    },sourceDecode.worldRestore,value=>value===rawCheckpoint.world)),
    vi.spyOn(regionSource,"restoreHvpEastRegion").mockImplementation(measured(originalEast,sourceDecode.eastRestore,value=>value===rawCheckpoint.neighbor?.terrain)),
    vi.spyOn(bodyCheckpoint,"decodeHvpBody").mockImplementation(measured((value:unknown)=>{
      const previous=inBodyDecode;inBodyDecode=true;try{return originalBody(value);}finally{inBodyDecode=previous;}
    },sourceDecode.bodyDecode,()=>inWorldRestore)),
    vi.spyOn(structural,"decodeStructuralRegionSave").mockImplementation(measured(originalRegion,sourceDecode.bodyRegionDecode,()=>inWorldRestore&&inBodyDecode)),
    vi.spyOn(rigidRecipe,"prepareHvpRigidBody").mockImplementation(measured(originalRecipe,sourceDecode.bodyRecipe,()=>inWorldRestore&&inBodyDecode))
  ];
  let game:ReturnType<typeof decodeHvpGame>;const decodeStart=performance.now();
  try{game=decodeHvpGame(checkpoint);}finally{sourceDecode.wallMs=performance.now()-decodeStart;
    for(const spy of sourceSpies){spy.mockRestore();}copySpy.mockRestore();signSpy.mockRestore();serializeSpy.mockRestore();}
  for(const row of [sourceDecode.transport,sourceDecode.signature,sourceDecode.canonicalCopy,sourceDecode.primaryGrid,sourceDecode.primaryCoast,
    sourceDecode.primaryRoot,sourceDecode.worldRestore,sourceDecode.eastRestore]){
    expect(row).toMatchObject({calls:1,completed:1});expect(Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0).toBe(true);
  }
  expect(inWorldRestore||inBodyDecode).toBe(false);expect(rawCheckpoint.world.bodies.length).toBeGreaterThan(0);
  for(const row of [sourceDecode.bodyDecode,sourceDecode.bodyRegionDecode,sourceDecode.bodyRecipe]){
    expect(row).toMatchObject({calls:rawCheckpoint.world.bodies.length,completed:rawCheckpoint.world.bodies.length});
    expect(Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0).toBe(true);
  }
  expect(JSON.stringify(game.checkpoint)).toBe(JSON.stringify(checkpoint));
  const coldRecipeRows:Array<{ownerId:string;cells:number;colliders:number;elapsedMs:number;sourceIdentityPreserved:boolean;fullJsonEqual:boolean;spans:rigidRecipe.HvpRigidRecipeSpans}>=[];
  let coldRecipeResources:ReturnType<typeof model.createStructuralOwnerLedger>["resources"]|undefined;
  if(process.env.HVP_COLD_RECIPE_ORACLE==="1"){
    expect(game.world.bodies).toHaveLength(4);const ledger=model.createStructuralOwnerLedger(game.decodeWorkingBytes);
    try{
      for(const body of game.world.bodies){
        const spans:rigidRecipe.HvpRigidRecipeSpans={},steps=rigidRecipe.prepareHvpRigidBodyOwnedHashSteps(body.recipe.source,spans,undefined,ledger.reserve);
        const start=performance.now();let actual:rigidRecipe.HvpRigidRecipe;
        try{for(;;){const step=steps.next();if(step.done){actual=step.value;break;}}}finally{steps.return(undefined as never);}
        const elapsedMs=performance.now()-start;
        const fullJsonEqual=JSON.stringify(actual)===JSON.stringify(body.recipe),sourceIdentityPreserved=actual.source===body.recipe.source;
        expect(fullJsonEqual).toBe(true);expect(sourceIdentityPreserved).toBe(true);
        expect(Number.isFinite(elapsedMs)&&elapsedMs>=0).toBe(true);expect(spans).toMatchObject({transitionPerVoxelMs:0,transitionHashMs:0,preparedFactsReused:1});
        coldRecipeRows.push({ownerId:body.checkpoint.ownerId,cells:actual.source.bricks.reduce((n,b)=>n+b.cells.length,0),colliders:actual.colliders.length,elapsedMs,sourceIdentityPreserved,fullJsonEqual,spans});
      }
      coldRecipeResources=ledger.resources;
    }finally{ledger.release();expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});}
  }
  expect(game.neighborRoot).toBeDefined();
  const signature=game.checkpoint.signature,source=game.root.read(),east=game.neighborRoot!.read();
  const totals={jobs:0,executeWallMs:0,quantumCount:0,quantumActiveMs:0,interQuantumGapMs:0};
  const inputClasses={airHalo:0,solidHalo:0,mixedHalo:0,primaryAirHalo:0,eastAirHalo:0,airQuantumMs:0,otherQuantumMs:0};
  const packetDigests=new Uint8Array(512*32),packetSeen=new Uint8Array(512);
  const resources={inputBytesEach:34**3,inputTrafficBytes:0,activeJobs:0,activeJobsMax:0,activeInputBytes:0,activeInputBytesMax:0,
    workerReserveMax:0,activeWorkerReserveBytes:0,activeWorkerReserveMax:0,workerGrantMin:Number.MAX_SAFE_INTEGER,workerGrantMax:0,outputTrafficBytes:0,outputMax:0};
  let startupLedger:ReturnType<typeof model.createStructuralOwnerLedger>|undefined,startupCredits:ReturnType<typeof support.createHvpSupportPhaseCredits>|undefined;
  let ledgerBeforeRelease:ReturnType<typeof model.createStructuralOwnerLedger>["resources"]|undefined,cacheBeforeRelease=0,pendingBeforeRelease=0,creditsRemainingBeforeRelease=0,baselineChecked=false;
  const createLedger=model.createStructuralOwnerLedger,createCredits=support.createHvpSupportPhaseCredits;
  const ledgerSpy=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((...args)=>{
    const ledger=createLedger(...args);if(args[0]===16*1024*1024&&args[2]===128){if(startupLedger){throw new Error("Duplicate startup ledger");}startupLedger=ledger;}return ledger;
  });
  const creditsSpy=vi.spyOn(support,"createHvpSupportPhaseCredits").mockImplementation((...args)=>{
    const credits=createCredits(...args);if(args[0]===32768&&args[1]===16*1024*1024){if(startupCredits){throw new Error("Duplicate startup credits");}startupCredits=credits;}return credits;
  });
  let population:Readonly<{primaryJobs:number;primaryEmptyBoth:number;eastJobs:number;eastEmptyBoth:number}>|undefined;
  let passed=false,quantumValid=true,startupWallMs=0,collisionDigest="",renderColumns=0,collisionChunks=0;
  const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);
    let air=true,solid=true;
    for(const slot of new Uint8Array(bundle.buffers[0]!)){air=air&&slot===0;solid=solid&&slot!==0;if(!air&&!solid){break;}}
    if(air){inputClasses.airHalo+=1;}else if(solid){inputClasses.solidHalo+=1;}else{inputClasses.mixedHalo+=1;}
    const transferred=structuredClone(bundle,{transfer:transferListFor(bundle)});let previousEnd:number|undefined;
    expect(bundle.buffers[0]!.byteLength).toBe(0);expect(transferred.byteLength).toBe(resources.inputBytesEach);
    resources.inputTrafficBytes+=transferred.byteLength;resources.activeJobs+=1;resources.activeJobsMax=Math.max(resources.activeJobsMax,resources.activeJobs);
    resources.activeInputBytes+=transferred.byteLength;resources.activeInputBytesMax=Math.max(resources.activeInputBytesMax,resources.activeInputBytes);
    resources.workerGrantMin=Math.min(resources.workerGrantMin,grant);resources.workerGrantMax=Math.max(resources.workerGrantMax,grant);
    const phaseReserve=createHvpBodyMeshPhaseReserve(grant);let workerReserved=0;
    const measuredReserve:typeof phaseReserve=(...args)=>{
      phaseReserve(...args);workerReserved+=args[0];resources.activeWorkerReserveBytes+=args[0];
      resources.workerReserveMax=Math.max(resources.workerReserveMax,workerReserved);resources.activeWorkerReserveMax=Math.max(resources.activeWorkerReserveMax,resources.activeWorkerReserveBytes);
    };
    const pump=createHvpBodyMeshTaskPump(()=>{},(_label,at,duration)=>{
      if(!Number.isFinite(at)||!Number.isFinite(duration)||duration<0){quantumValid=false;return;}
      if(previousEnd!==undefined){const gap=at-previousEnd;if(gap<0){quantumValid=false;return;}totals.interQuantumGapMs+=gap;}
      totals.quantumCount+=1;totals.quantumActiveMs+=duration;previousEnd=at+duration;
      if(air){inputClasses.airQuantumMs+=duration;}else{inputClasses.otherQuantumMs+=duration;}
    });
    const run=pump.run.bind(pump);
    const payload=request.payload as HvpChunkPayload;
    if(air){if(payload.sourceOrigin.x===east.originMeters.x){inputClasses.eastAirHalo+=1;}else{inputClasses.primaryAirHalo+=1;}}
    pump.run=<T>(steps:Generator<string,T,unknown>)=>{
      const next=steps.next.bind(steps);
      steps.next=(...args)=>{const previous=trace.scope.inWorkerNext,previousEast=trace.scope.eastWorker;
        trace.scope.inWorkerNext=true;trace.scope.eastWorker=payload.sourceOrigin.x===east.originMeters.x;
        try{return next(...args);}finally{trace.scope.inWorkerNext=previous;trace.scope.eastWorker=previousEast;}};
      return run(steps);
    };
    const at=performance.now();
    try{
      const output=await executeHvpChunkJobOwned(request,transferred,pump,measuredReserve);totals.jobs+=1;
      expect(output.bundle.byteLength).toBeLessThanOrEqual(8*1024*1024);
      resources.outputTrafficBytes+=output.bundle.byteLength;resources.outputMax=Math.max(resources.outputMax,output.bundle.byteLength);
      const offset=payload.sourceOrigin.x===source.originMeters.x?0:payload.sourceOrigin.x===east.originMeters.x?256:NaN;
      const index=offset+payload.chunk;
      if(!Number.isSafeInteger(index)||index<0||index>=512||packetSeen[index]!==0){throw new Error("Invalid or duplicate chunk packet index");}
      const hash=createHash("sha256").update(JSON.stringify({views:output.bundle.views,ownership:output.bundle.ownership,revision:output.bundle.revision,byteLength:output.bundle.byteLength,contentHash:output.bundle.contentHash}));
      for(const buffer of output.bundle.buffers){hash.update(new Uint8Array(buffer));}
      packetDigests.set(hash.digest(),index*32);packetSeen[index]=1;
      return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
    }finally{totals.executeWallMs+=performance.now()-at;pump.dispose();resources.activeJobs-=1;
      resources.activeInputBytes-=transferred.byteLength;resources.activeWorkerReserveBytes-=workerReserved;}
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler();
  let products:Awaited<ReturnType<typeof compiler.initialChunks>>|undefined;
  try{
    await compiler.prepare(()=>true,game.root);decode.enabled=true;const at=performance.now();
    products=await compiler.initialChunks(source,east,16*1024*1024,"saved-east-startup-attribution",undefined,value=>{population=value;});
    startupWallMs=performance.now()-at;decode.enabled=false;
    expect(population).toMatchObject({primaryJobs:256,eastJobs:256});expect(totals.jobs).toBe(512);
    expect(packetSeen.every(value=>value===1)).toBe(true);
    expect(inputClasses.airHalo+inputClasses.solidHalo+inputClasses.mixedHalo).toBe(512);
    expect(decode).toMatchObject({calls:512,completed:512});expect(decode.nextCalls).toBeGreaterThan(0);
    for(const value of [startupWallMs,...Object.values(totals),decode.activeNextMs]){expect(Number.isFinite(value)&&value>=0).toBe(true);}
    expect(totals.quantumCount).toBeGreaterThanOrEqual(512);
    expect(quantumValid).toBe(true);
    expect(resources.activeJobsMax).toBeLessThanOrEqual(2);expect(resources.activeJobsMax).toBeGreaterThan(0);
    expect(resources.activeInputBytesMax).toBeLessThanOrEqual(2*resources.inputBytesEach);
    expect(resources.activeWorkerReserveMax).toBeLessThanOrEqual(96*1024*1024);
    expect(resources).toMatchObject({activeJobs:0,activeInputBytes:0,activeWorkerReserveBytes:0,inputTrafficBytes:512*34**3});
    expect(startupLedger).toBeDefined();expect(startupCredits).toBeDefined();
    ledgerBeforeRelease=startupLedger!.resources;expect(ledgerBeforeRelease).toMatchObject({residentBytes:16*1024*1024,reservedBytes:96*1024*1024,peakEstimateBytes:112*1024*1024,physicalHeap:"NOT_PROVEN"});
    creditsRemainingBeforeRelease=startupCredits!.remainingBytes;expect(creditsRemainingBeforeRelease).toBeGreaterThanOrEqual(0);
    expect(trace.scope).toEqual({inWorkerNext:false,eastWorker:false});
    for(const [name,row] of Object.entries(trace.phases)){
      const expectedCalls=name==="meshPrimary"?256-inputClasses.primaryAirHalo:name==="meshEast"?256-inputClasses.eastAirHalo
        :name==="collisionMesh"||name==="collisionOccupancyMesh"?512-inputClasses.airHalo:512;
      expect(row.calls).toBe(expectedCalls);expect(row.completed).toBe(expectedCalls);expect(row.nextCalls).toBeGreaterThan(0);
      expect(Number.isFinite(row.activeNextMs)&&row.activeNextMs>=0).toBe(true);
    }
    collisionDigest=hvpCollisionDigest([...products.collision.values()]);renderColumns=products.render.size;collisionChunks=products.collision.size;
    expect(renderColumns).toBe(16);expect(collisionChunks).toBe(256);expect(products.source).toBe(source);
    expect(game.checkpoint.signature).toBe(signature);expect(createHash("sha256").update(saved).digest("hex")).toBe(savedSha256);
    expect(savedSha256).toBe(baseline.savedSha256);expect(signature).toBe(baseline.signature);
    expect(createHash("sha256").update(packetDigests).digest("hex")).toBe(baseline.orderedPacketSha256);
    expect(population).toEqual(baseline.population);expect(collisionDigest).toBe(baseline.collisionDigest);baselineChecked=true;
    cacheBeforeRelease=compiler.diagnostics().chunkCacheBytes;pendingBeforeRelease=compiler.diagnostics().pendingChunkBytes;
    expect(cacheBeforeRelease).toBe(0);expect(pendingBeforeRelease).toBeGreaterThan(0);
    releaseHvpOwnedTerrainProducts(products);products=undefined;
    expect(startupLedger!.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0,peakEstimateBytes:112*1024*1024});
    expect(()=>startupCredits!.remainingBytes).toThrow(/released/);expect(compiler.diagnostics().pendingChunkBytes).toBe(0);
    expect(compiler.diagnostics().chunkCacheBytes).toBeGreaterThan(0);passed=true;
  }finally{
    decode.enabled=false;if(products){releaseHvpOwnedTerrainProducts(products);}await compiler.dispose();compiler.releaseDisposedSupportResources();
    accepted.mockRestore();enqueue.mockRestore();start.mockRestore();creditsSpy.mockRestore();ledgerSpy.mockRestore();
    const disposed=compiler.diagnostics(),cleanup=disposed.chunkCacheBytes===0&&disposed.pendingChunkBytes===0;
    const receipt=JSON.stringify({classification:"SAVED_EAST_CHUNK_MICROATTRIBUTION_NOT_GAME_ACCEPTANCE",status:passed&&cleanup?"PASS":"FAIL",savedSha256,signature,
      startupWallMs,totals,quantumValid,consumerDecode:{calls:decode.calls,nextCalls:decode.nextCalls,activeNextMs:decode.activeNextMs,completed:decode.completed},
      sourceDecode,
      coldRecipeOracle:{enabled:process.env.HVP_COLD_RECIPE_ORACLE==="1",residentArgument:game.decodeWorkingBytes,rows:coldRecipeRows,resources:coldRecipeResources,
        meaning:"Full per-body public Recipe JSON and Source identity oracle. decodeWorkingBytes is the existing logical decode working estimate, not physical heap or a complete old-Recipe coexistence proof. No production decoder adoption."},
      population,renderColumns,collisionChunks,collisionDigest,kernelPhases:trace.phases,inputClasses,orderedPacketSha256:createHash("sha256").update(packetDigests).digest("hex"),baselineChecked,baselineSha256,expectedOrderedPacketSha256:baseline.orderedPacketSha256,
      logicalResources:{residentBytesArgument:16*1024*1024,reservedHeadroomBytes:96*1024*1024,resources,ledgerBeforeRelease,ledgerAfterRelease:startupLedger?.resources,
        cacheBeforeRelease,pendingBeforeRelease,creditsRemainingBeforeRelease,afterDispose:disposed,physicalHeap:"NOT_PROVEN",
        meaning:"Worker reservation maxima are prepaid logical allocation estimates; never add them to already reserved 96MiB headroom. Input/output traffic totals are not simultaneous residency. Sender input is detached and counted once. Pool/runtime transport is mocked; physical worker heap is unsupported."},
      meaning:"Kernel quantum sums include full validation/mesh/pack/hash/worker-side decode and observer overhead. Per-job walls overlap; gaps estimate cooperative wait. Enqueue mock bypasses Worker runtime checkpoints/transport. Consumer decode is actual original cursor active-next time; no second decode pass. Kernel phase times are inclusive; renderHash is contained in renderPack and collisionOccupancyMesh is contained in collisionMesh; neither must be added again. Worker-side decode and other cursor work remain outside selected phase counters."})+"\n";
    if(Buffer.byteLength(receipt)>8192){throw new Error("Startup receipt exceeds 8KiB bound");}writeFileSync(outputPath,receipt,{flag:"wx"});expect(cleanup).toBe(true);
  }
},120_000);
