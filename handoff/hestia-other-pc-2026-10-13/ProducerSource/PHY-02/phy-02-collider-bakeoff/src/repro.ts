import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import {fixtures,type Cell} from "./fixtures.js";
import {rockarm384} from "./hestiaFixtures.js";
import {recipe,digest,vec,worldPoint,rotate,rayOracle,type Kind} from "./geometry.js";
import {engine,newWorld,install,descriptors,directRay,publishQueries,worldRay,stageEdit,type Mode} from "./native.js";
const modeArg=process.argv.find(a=>a.startsWith("--mode="))?.slice(7)??"all";
assert(["all","A","B","C"].includes(modeArg),"Mode must be A, B, C or all");
const modes:Mode[]=modeArg==="all"?["A","B","C"]:[modeArg as Mode];
const rows:unknown[]=[],inputs=[...fixtures(),rockarm384(.125),rockarm384(.25)];
const runRoot=process.env.PHY02_RUN_DIR??"evidence";
assert(runRoot==="evidence"||/^evidence\/runs\/[a-z0-9-]+$/.test(runRoot),"Output must stay in own evidence scope");
const timed=<T>(operation:()=>T):[T,number]=>{const start=performance.now();return [operation(),performance.now()-start];};
for(const mode of modes){
  const [e,initMs]=await (async()=>{const t=performance.now(),e=await engine(mode);return [e,performance.now()-t] as const;})();
  const kinds:Kind[]=mode==="C"?["voxels"]:["triangles","multi-cuboid"];
  for(const kind of kinds)for(const f of inputs){
    const phases:Record<string,number>={},w=newWorld(e);let disposal=0;
    const before=process.memoryUsage();
    try{
      const [r,deriveMs]=timed(()=>recipe(f,kind));phases.canonicalAndProductMs=deriveMs;
      const [descs,shapeMs]=timed(()=>descriptors(e,r));phases.coldDescriptorMs=shapeMs;
      // Rapier allocates the native shape during createCollider; that cost belongs to nativeStageMs.
      const [i,stageMs]=timed(()=>install(e,w,r,false,true,descs));phases.nativeStageMs=stageMs;
      const [publication,publishMs]=timed(()=>publishQueries(e,w));phases.initialQueryPublicationMs=publishMs;
      const origin={x:-f.cellSize,y:f.cellSize*.5,z:f.cellSize*.5},dir={x:1,y:0,z:0};
      const [hit,queryMs]=timed(()=>directRay(i,worldPoint(f,origin),rotate(f.rotation,dir)));phases.firstCorrectQueryMs=queryMs;
      const expected=rayOracle(f,origin,dir);assert(hit!==null&&expected!==null&&Math.abs(hit-expected)<1e-5);
      const boundaryCases=[{x:-f.cellSize,y:0,z:0},{x:-f.cellSize,y:-1e-5,z:0}].map(o=>({
        rayOriginLocal:o,directionLocal:dir,analyticInclusive:rayOracle(f,o,dir),
        native:directRay(i,worldPoint(f,o),rotate(f.rotation,dir)),classification:"BOUNDARY_DIAGNOSTIC_SEPARATE_FROM_UNAMBIGUOUS_GATE"}));
      const [transferred,transferMs]=timed(()=>{
        const a=new Int32Array(f.cells.flat()),b=structuredClone(a,{transfer:[a.buffer]});assert.equal(a.byteLength,0);return b;
      });phases.snapshotTransferMs=transferMs;
      const removed=f.cells[0],next={...f,cells:f.cells.filter(c=>c.join(":")!==removed.join(":"))};
      for(const edit of (kind==="voxels"?["rebuild","incremental"] as const:["rebuild"] as const)){
        const [rollback,rollbackStage]=timed(()=>stageEdit(i,next,edit==="incremental"));
        const [,rollbackMs]=timed(()=>rollback.rollback());phases[edit+"RollbackStageMs"]=rollbackStage;phases[edit+"RollbackDisposeMs"]=rollbackMs;
      }
      const editStart=performance.now(),[candidate,editStage]=timed(()=>stageEdit(i,next,kind==="voxels"));
      phases.editStageIncludesCloneAndMassMs=editStage;
      const [edited,commitMs]=timed(()=>candidate.commit());phases.commitMs=commitMs;
      const [editPublication,editPublishMs]=timed(()=>publishQueries(e,w));phases.editQueryPublicationMs=editPublishMs;
      const point={x:(removed[0]+.5)*f.cellSize,y:(removed[1]+.5)*f.cellSize,z:-f.cellSize},along={x:0,y:0,z:1};
      const [after,afterQueryMs]=timed(()=>worldRay(edited,worldPoint(f,point),rotate(f.rotation,along)));phases.editCorrectQueryMs=afterQueryMs;
      const editExpected=rayOracle(next,point,along);
      if(editExpected===null)assert.equal(after,null);else assert(after!==null&&Math.abs(after-editExpected)<1e-5);
      phases.editToCorrectQueryMs=performance.now()-editStart;
      const [,stepMs]=timed(()=>w.step());phases.solverStepMs=stepMs;
      let contactPairs=0;w.forEachCollider(c=>w.contactPairsWith(c,()=>{contactPairs++;}));
      const nativeBytes=r.triangles?r.triangles.vertices.byteLength+r.triangles.indices.byteLength
        :r.voxels?r.voxels.byteLength:null;
      const counts={cells:f.cells.length,changedCells:1,bodies:w.bodies.len(),activeDynamicBodies:0,colliders:w.colliders.len(),contactPairs:contactPairs/2};
      const afterMemory=process.memoryUsage();
      const [,disposeMs]=timed(()=>w.free());disposal=1;phases.disposeMs=disposeMs;
      rows.push({mode,version:e.version,kind,fixture:f.id,profile:f.cellSize,fixtureDigest:digest(f),sourceDigest:r.binding.sourceDigest,
        boundaryCases,
        initMs,phases,initialPublicationSteps:publication.steps,editPublicationSteps:editPublication.steps,counts,
        payloadBytes:nativeBytes,transferredCellBytes:transferred.byteLength,
        memory:{processHeapUsedBefore:before.heapUsed,processHeapUsedAfter:afterMemory.heapUsed,retainedBytes:"UNAVAILABLE_NO_FORCED_GC_OR_ALLOCATOR_SENSOR",wasmMemory:"UNAVAILABLE",gc:"UNAVAILABLE"},
        actualAdapter:"CPU_WASM_NO_GPU",oracle:"PASS",editToContact:"NOT_RUN_STATIC_QUERY_ONLY"});
    }finally{if(!disposal)w.free();}
  }
}
fs.mkdirSync(runRoot,{recursive:true});
const result={schemaVersion:1,executionLocation:"LOCAL_WINDOWS_ISOLATED",classification:"FUNCTIONAL_DIAGNOSTIC_CONCURRENT_LOAD_NOT_REFERENCE",
  node:process.version,os:os.platform()+" "+os.release(),arch:process.arch,
  cpu:os.cpus()[0]?.model??"UNAVAILABLE",environmentLoad:"UNAVAILABLE_WINDOWS",loadNote:"Load isolation was not granted; concurrent other sessions known",
  browser:"NOT_RUN_NODE_WASM_PRIMITIVES",actualAdapter:"CPU_WASM_NO_GPU",resolution:"NOT_APPLICABLE",dpr:"NOT_APPLICABLE",
  fixtureDigest:digest(inputs),seed:"DETERMINISTIC_LITERAL_GEOMETRY",order:modes,rows,
  kcc:"NOT_RUN_PHY01_PENDING",sleep:"NOT_RUN_PHY01_PENDING",save:"NOT_RUN_PHY01_PENDING",hvp:"NOT_RUN_PHY01_PENDING",reference:"NOT_RUN"};
fs.writeFileSync(runRoot+"/diagnostics.json",JSON.stringify(result,null,2)+"\n");
console.log("PASS diagnostic rows: "+rows.length+"; no reference or product acceptance");
