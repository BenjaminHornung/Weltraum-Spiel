import {writeFileSync} from "node:fs";
import {expect,it,vi} from "vitest";
import {createHvpTerrainOwner,createHvpTerrainRoot,restoreHvpPrivateTerrainRoot,prepareHvpPrivateTerrainCut} from "../../src/hestia-prototype/terrain/cutPlan";
import {createHvpTerrainCompiler,releaseHvpOwnedTerrainProducts} from "../../src/hestia-prototype/terrain/terrainProducts";
import {executeHvpChunkJobOwned} from "../../src/workers/hvpChunkJob";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {WorkerPool,type WorkerJobTerminal} from "../../src/workers/workerPool";
import {workerEpoch} from "../../src/workers/ids";
import {transferListFor} from "../../src/workers/protocol";
import * as model from "../../src/voxel/structural/model";
import * as support from "../../src/hestia-prototype/terrain/supportPlan";

it.skipIf(!process.env.HVP_CHUNK_COEXISTENCE_OUTPUT)("accounts old and pending chunk products through discard commit and in-flight sibling cancellation",async()=>{
  const outputPath=process.env.HVP_CHUNK_COEXISTENCE_OUTPUT!;
  vi.stubGlobal("navigator",{hardwareConcurrency:8});
  const root=createHvpTerrainOwner(restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,
    originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",readSlot:(x,y,z)=>y===10&&z===10&&(x===31||x===32)?1:0},"coexistence-root",0).checkpoint()));
  const ledgers:Array<ReturnType<typeof model.createStructuralOwnerLedger>>=[],credits:Array<ReturnType<typeof support.createHvpSupportPhaseCredits>>=[];
  const nativeLedger=model.createStructuralOwnerLedger,nativeCredits=support.createHvpSupportPhaseCredits;
  const ledgerSpy=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((...args)=>{
    const value=nativeLedger(...args);if(ledgers.length>=4){throw new Error("Unexpected ledger population");}ledgers.push(value);return value;
  });
  const creditsSpy=vi.spyOn(support,"createHvpSupportPhaseCredits").mockImplementation((...args)=>{
    const value=nativeCredits(...args);if(credits.length>=4){throw new Error("Unexpected credits population");}credits.push(value);return value;
  });
  let cancelling=false,injectedJobs=0,cancelCalls=0,heldResolve:((terminal:WorkerJobTerminal)=>void)|undefined;
  const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);const input=structuredClone(bundle,{transfer:transferListFor(bundle)});
    expect(bundle.buffers[0]!.byteLength).toBe(0);
    if(cancelling){
      injectedJobs+=1;if(injectedJobs>2){throw new Error("Cancellation started an extra job");}
      if(injectedJobs===1){
        const result=new Promise<WorkerJobTerminal>(resolve=>{heldResolve=resolve;});
        return {jobId:request.jobId,workerEpoch:workerEpoch(0),result,cancel:()=>{
          cancelCalls+=1;const resolve=heldResolve;heldResolve=undefined;resolve?.({kind:"Cancelled",reason:"CancelledDuringExecution"});return true;
        }};
      }
      const result=new Promise<WorkerJobTerminal>(resolve=>setTimeout(()=>resolve({kind:"Cancelled",reason:"CancelledDuringExecution"}),0));
      return {jobId:request.jobId,workerEpoch:workerEpoch(0),result,cancel:()=>false};
    }
    const pump=createHvpBodyMeshTaskPump(()=>{});
    try{const output=await executeHvpChunkJobOwned(request,input,pump,createHvpBodyMeshPhaseReserve(grant));
      return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
    }finally{pump.dispose();}
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler();
  const snapshots:Array<{phase:string;cacheBytes:number;pendingBytes:number;ledger:ReturnType<typeof model.createStructuralOwnerLedger>["resources"]}>=[];
  const capture=(phase:string)=>{
    if(snapshots.length>=6){throw new Error("Unexpected snapshot population");}
    const d=compiler.diagnostics();snapshots.push({phase,cacheBytes:d.chunkCacheBytes,pendingBytes:d.pendingChunkBytes,ledger:ledgers.at(-1)!.resources});
  };
  const cut=(x:number,id:string)=>{const before=root.read();return prepareHvpPrivateTerrainCut(root,{sessionId:before.sessionId,epoch:before.epoch,
    revision:before.revision,sourceDigest:before.sourceDigest,commandId:id,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[x,10,10],max:[x+1,11,11]}});};
  let products:Awaited<ReturnType<typeof compiler.initialChunks>>|undefined,passed=false;
  try{
    await compiler.prepare(()=>true,root);products=await compiler.initialChunks(root.read(),undefined,16*1024*1024,"coexistence-world");
    releaseHvpOwnedTerrainProducts(products);products=undefined;const oldCache=compiler.diagnostics().chunkCacheBytes;expect(oldCache).toBeGreaterThan(0);capture("initialPromoted");
    const first=cut(31,"coexistence-discard");products=await compiler.compile(first,undefined,16*1024*1024);capture("oldAndPendingDiscard");
    expect(compiler.diagnostics().chunkCacheBytes).toBe(oldCache);expect(compiler.diagnostics().pendingChunkBytes).toBeGreaterThan(0);
    releaseHvpOwnedTerrainProducts(products);products=undefined;capture("discarded");
    expect(compiler.diagnostics().chunkCacheBytes).toBe(oldCache);expect(compiler.diagnostics().pendingChunkBytes).toBe(0);
    products=await compiler.compile(first,undefined,16*1024*1024);capture("oldAndPendingCommit");
    expect(compiler.diagnostics().chunkCacheBytes).toBe(oldCache);expect(compiler.diagnostics().pendingChunkBytes).toBeGreaterThan(0);
    root.commit(first);releaseHvpOwnedTerrainProducts(products);products=undefined;capture("committed");
    const committedCache=compiler.diagnostics().chunkCacheBytes;expect(committedCache).toBeGreaterThan(0);expect(compiler.diagnostics().pendingChunkBytes).toBe(0);
    cancelling=true;await expect(compiler.compile(cut(32,"coexistence-cancel"),undefined,16*1024*1024)).rejects.toThrow(/Cancelled/);capture("inFlightCancelled");
    expect(injectedJobs).toBe(2);expect(cancelCalls).toBe(1);expect(heldResolve).toBeUndefined();
    expect(compiler.diagnostics().chunkCacheBytes).toBe(committedCache);expect(compiler.diagnostics().pendingChunkBytes).toBe(0);
    expect(ledgers).toHaveLength(4);expect(credits).toHaveLength(4);
    for(const ledger of ledgers){expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0,physicalHeap:"NOT_PROVEN"});}
    for(const phase of credits){expect(()=>phase.remainingBytes).toThrow(/released/);}passed=true;
  }finally{
    if(products){releaseHvpOwnedTerrainProducts(products);}heldResolve?.({kind:"Cancelled",reason:"CancelledDuringExecution"});heldResolve=undefined;
    await compiler.dispose();compiler.releaseDisposedSupportResources();
    accepted.mockRestore();enqueue.mockRestore();start.mockRestore();creditsSpy.mockRestore();ledgerSpy.mockRestore();vi.unstubAllGlobals();
    const disposed=compiler.diagnostics(),cleanup=disposed.chunkCacheBytes===0&&disposed.pendingChunkBytes===0;
    const receipt=JSON.stringify({classification:"LOGICAL_CHUNK_COEXISTENCE_TEST_NOT_PHYSICAL_HEAP",status:passed&&cleanup?"PASS":"FAIL",residentBytesArgument:16*1024*1024,
      snapshots,injectedJobs,cancelCalls,disposed,physicalHeap:"NOT_PROVEN",meaning:"Cache and pending candidate coexist. Ledger already includes old cache in resident admission plus prepaid96MiB; do not add headroom twice. In-flight sibling terminal/cancellation is injected in mocked pool; not a real browser worker fault."},null,2)+"\n";
    if(Buffer.byteLength(receipt)>8192){throw new Error("Coexistence receipt exceeds 8KiB");}writeFileSync(outputPath,receipt,{flag:"wx"});expect(cleanup).toBe(true);
  }
},120_000);
