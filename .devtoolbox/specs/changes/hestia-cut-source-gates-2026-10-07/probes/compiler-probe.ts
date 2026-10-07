// Complete throwaway support path: persistent derivative, direct fragment Source,
// existing exact search/recipes/compiler and the existing real Physics Worker.
import {createHvpTerrainCompiler} from '../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/terrainProducts';
import {createProbeTerrainMirrorSteps,deriveProbeFragmentSteps} from '../../../../../apps/weltraum-browser/src/hestia-prototype/experiments/cutKernelProbe';
import {analyzeHvpSupportSnapshotOwnedSteps,bindHvpSupportPlan,createHvpSupportPhaseCredits,createHvpSupportTimingsCollector,releaseHvpOwnedSupportPlan,type HvpSupportPlan} from '../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/supportPlan';
import {prepareHvpStructuralIngestOwnedSteps,type HvpStructuralCell} from '../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/structuralIngest';
import {createStructuralOwnerLedger,ownedStructuralSubsetSteps} from '../../../../../apps/weltraum-browser/src/voxel/structural/model';
import {hvpTerrainSubsetCloneBytes} from '../../../../../apps/weltraum-browser/src/hestia-prototype/physics/terrainFragment';
import {encodeStructuralObject,type StructuralObject} from '../../../../../apps/weltraum-browser/src/voxel/structural';
import {HVP_COAST_MATERIAL_REGISTRY,HVP_ROCK_ARM} from '../../../../../apps/weltraum-browser/src/hvp/hvpCoastSource';
import {createHvpBodyMeshTaskPump} from '../../../../../apps/weltraum-browser/src/workers/hvpBoundedPump';
import type {HvpPreparedCut,HvpTerrainSnapshot} from '../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan';
import type {HvpCutTrace} from '../../../../../apps/weltraum-browser/src/hestia-prototype/runtime/cutTrace';
import {borrowedHvpPlanSteps} from '../../../../../apps/weltraum-browser/src/hestia-prototype/physics/hvpPlanSteps';

const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,structuralClass:m.role,destructible:true,tags:null}));
export const createProbeCompiler=(observePoolStartup?:((start:number,duration:number)=>void),ownedTerrain=false)=>{
  const base=createHvpTerrainCompiler(observePoolStartup),livePumps=new Set<ReturnType<typeof createHvpBodyMeshTaskPump>>(),retained=new Set<HvpSupportPlan>();
  // Explicit return-type helper avoids a second runtime abstraction.
  type Mirror=ReturnType<typeof createProbeTerrainMirrorSteps> extends Generator<unknown,infer T,unknown>?T:never;
  let ownedMirror:Mirror|undefined,ancestor:StructuralObject|undefined,last:HvpTerrainSnapshot|undefined,disposed=false,busy=false,nativeAncestorReady=false;
  const stats={initializationMs:0,coldSourceCells:0,supportSnapshotTransferredBytes:0,sourceRegionUtf16Bytes:0,cuts:0,maxQuantumMs:0};
  const reset=()=>{ownedMirror?.dispose();ownedMirror=undefined;ancestor=undefined;last=undefined;nativeAncestorReady=false;};
  const compiler={...base,
    confirmNativeAncestor(){if(ownedTerrain&&ancestor){nativeAncestorReady=true;}},
    extraCpuBytes:()=> (ownedMirror?.bytes.persistentSlots??0)+(ancestor?2*1024*1024:0),
    probeFacts:()=>({...stats,nativeAncestorReady,ownedTerrain,mirror:ownedMirror?.bytes??null,retainedSupportPlans:retained.size,livePumps:livePumps.size,sourceIdentity:'IssuedAncestorBindingDifferentFromLegacyImport',placement:'MainDerivativeCompute_PhysicsWorkerAuthority',fiveMeshHashPasses:'RETAINED'}),
    async analyze(plan:HvpPreparedCut,residentBytes=plan.before.sizeX*plan.before.sizeY*plan.before.sizeZ,trace?:HvpCutTrace){
      if(disposed||busy){throw new Error('Probe compiler disposed/busy');}busy=true;
      const ledger=createStructuralOwnerLedger(residentBytes+8*1024*1024+2*1024*1024,96*1024*1024,128);
      const pump=createHvpBodyMeshTaskPump(()=>{if(disposed){throw new Error('Probe preparation disposed');}},(_label,start,duration)=>{
        stats.maxQuantumMs=Math.max(stats.maxQuantumMs,duration);
        try{trace?.({commandId:plan.request.commandId,thread:'main',phase:'probeSupportQuantumMs',origin:performance.timeOrigin,start,duration});}catch{}
      });livePumps.add(pump);
      let draft:ReturnType<Mirror['prepareSteps']> extends Generator<unknown,infer T,unknown>?T:never;
      let handed=false;
      try{
        if(!ownedMirror){const begin=performance.now();ownedMirror=await pump.run(createProbeTerrainMirrorSteps(plan.before));last=plan.before;
          const cells:HvpStructuralCell[]=[];
          const q=(v:number,a:'x'|'y'|'z')=>Math.round((v-plan.before.originMeters[a])/.125);
          for(let z=q(HVP_ROCK_ARM.roofMinZ,'z');z<q(HVP_ROCK_ARM.roofMaxZ,'z');z++){
            for(let y=q(HVP_ROCK_ARM.floor,'y');y<q(HVP_ROCK_ARM.roofTop,'y');y++){
              for(let x=q(HVP_ROCK_ARM.roofMinX,'x');x<q(HVP_ROCK_ARM.roofMaxX,'x');x++){
                const materialId=plan.before.readSlot(x,y,z);if(materialId){cells.push(Object.freeze({x,y,z,materialId}));}
              }
            }
          }
          stats.coldSourceCells=cells.length;
          ancestor=await pump.run(borrowedHvpPlanSteps(prepareHvpStructuralIngestOwnedSteps('hvp-cut-probe-rockarm-seed',Object.freeze(cells),materials,[],ledger.reserve),'probeColdIngest'));
          stats.initializationMs+=performance.now()-begin;
        }
        if(plan.before!==last){
          const sync=await pump.run(ownedMirror.prepareSteps(plan.before,2));ownedMirror.commit(sync,plan.before);last=plan.before;
        }
        draft=await pump.run(ownedMirror.prepareSteps(plan.after));
        const sources=new Map<string,StructuralObject>(),clock=createHvpSupportTimingsCollector();
        const report=await pump.run(analyzeHvpSupportSnapshotOwnedSteps(draft.reader,plan.changed.map(c=>c.cell),{},clock,{
          reserve:ledger.reserve,retain:n=>ledger.reserve(n,true),beginFragment:()=>{},endFragment:()=>{},
          sourceFromCells:function*(id,cells,reserve){
            const digest=id.slice(id.lastIndexOf('-')+1),ownerId=`hvp:terrain-fragment:r${plan.after.revision}:${digest}`;
            const source=yield* (ownedTerrain?ownedStructuralSubsetSteps:deriveProbeFragmentSteps)(ancestor!,ownerId,cells,reserve);sources.set(id,source);return source;
          }
        }));
        const fragments=[];let outputBytes=0;
        for(const f of report.fragments){const source=sources.get(f.id);if(!source){throw new Error('Probe fragment Source missing');}
          if(ownedTerrain){
            const a=ancestor!,sourceSubset=Object.freeze({ancestorDigest:a.contentHash,expectedDigest:source.contentHash,
              ...(nativeAncestorReady?{}:{ancestorInput:Object.freeze({objectId:a.objectId,frame:a.frame,source:a.source,materials:a.materials,
                bricks:a.bricks,anchors:a.anchors,joints:a.joints,objectRevision:a.objectRevision,editRevision:a.editRevision,commandEvidence:a.commandEvidence})})});
            outputBytes+=hvpTerrainSubsetCloneBytes(sourceSubset);if(outputBytes>8*1024*1024){throw new Error('Probe runtime Source clone budget');}
            ledger.reserve(hvpTerrainSubsetCloneBytes(sourceSubset),true);fragments.push(Object.freeze({...f,sourceSubset}));continue;
          }
          const sourceRegion=await pump.run((function*(){const value=encodeStructuralObject(source);yield 'probeSourceEncode';return value;})());
          outputBytes+=sourceRegion.length*2;if(outputBytes>8*1024*1024){throw new Error('Probe source output budget');}
          ledger.reserve(sourceRegion.length*4,true);stats.sourceRegionUtf16Bytes+=sourceRegion.length*2;
          fragments.push(Object.freeze({...f,sourceRegion}));}
        ownedMirror.cancel(draft);draft=undefined as never;stats.cuts++;
        const timings=clock.done(report.fragments.length,report.fragments.reduce((n,f)=>n+f.cells.length,0));
        const credits=createHvpSupportPhaseCredits(8*1024*1024+2*1024*1024+report.workingBytes+fragments.reduce((n,f)=>n+(f.sourceRegion?.length??0)*4+hvpTerrainSubsetCloneBytes(f.sourceSubset),0),residentBytes);
        const accepted=bindHvpSupportPlan(plan,Object.freeze({...report,fragments:Object.freeze(fragments),timings}),()=>{retained.delete(accepted);ledger.release();},credits);
        retained.add(accepted);handed=true;return accepted;
      }finally{if(draft!&&ownedMirror){ownedMirror.cancel(draft!);}pump.dispose();livePumps.delete(pump);busy=false;if(!handed){ledger.release();}}
    },
    async rolloverAfterLoad(live:()=>boolean){if(busy){throw new Error('Probe rollover busy');}reset();await base.rolloverAfterLoad(live);},
    async dispose(){disposed=true;for(const pump of livePumps){pump.dispose();}await base.dispose();reset();},
    releaseDisposedSupportResources(){if(!disposed||busy){throw new Error('Probe disposal not drained');}for(const p of [...retained]){releaseHvpOwnedSupportPlan(p);}base.releaseDisposedSupportResources();}
  };
  return compiler;
};
