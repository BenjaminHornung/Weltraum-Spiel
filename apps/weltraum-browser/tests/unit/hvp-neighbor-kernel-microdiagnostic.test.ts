import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {expect,it,vi} from "vitest";
import type {TransferableBufferBundle,WorkerJobRequest} from "../../src/workers/protocol";

// ponytail: local saved-input diagnostic; promote only after a portable qualification fixture exists.
it.skipIf(!process.env.HVP_NEIGHBOR_KERNEL_INPUT)("measures the real saved-East kernel with unchanged Source and packet bytes",async()=>{
  const {decodeHvpGame}=await import("../../src/hestia-prototype/persistence/gameCheckpoint");
  const {validateSaveGameEnvelopeV1}=await import("../../src/persistence");
  const coast=await import("../../src/hvp/hvpCoastSource");
  const mesher=await import("../../src/hvp/hvpCoastMesher");
  const region=await import("../../src/hestia-prototype/runtime/regionSource");
  const {copyHvpTerrainSlots}=await import("../../src/hestia-prototype/terrain/terrainProducts");
  const {encodeHvpProjectionPacket}=await import("../../src/hestia-prototype/runtime/projectionPacket");
  const {canonicalizeContentKey}=await import("../../src/streaming/contentKey");
  const {hvpRegionContentKey}=await import("../../src/hestia-prototype/runtime/residency");
  const ids=await import("../../src/workers/ids"),protocol=await import("../../src/workers/protocol");
  const inputPath=process.env.HVP_NEIGHBOR_KERNEL_INPUT!,outputPath=process.env.HVP_NEIGHBOR_KERNEL_OUTPUT;
  if(!outputPath){throw new Error("Set HVP_NEIGHBOR_KERNEL_OUTPUT to a fresh diagnostic receipt path");}
  const candidate=JSON.parse(readFileSync(inputPath,"utf8"));
  const saved=candidate.nativeWake.residentEastColdLoad.saved as string;
  const envelope=validateSaveGameEnvelopeV1(JSON.parse(saved),[]),game=decodeHvpGame(envelope.player.data.hestia);
  expect(game.neighborRoot).toBeDefined();
  const primary=game.root.read(),east=game.neighborRoot!.read(),prepared=coast.prepareHvpOwnedCoastSource(game.base);
  const buffers=[(await copyHvpTerrainSlots(primary)).buffer as ArrayBuffer,(await copyHvpTerrainSlots(east)).buffer as ArrayBuffer,
    encodeHvpProjectionPacket([mesher.meshHvpJoinRing(prepared),mesher.meshHvpFarField(prepared),mesher.meshHvpWaterMask(coast.deriveHvpWaterMask(prepared))])];
  const rawInputHash=protocol.fnv1aBytes(buffers),saveSignature=game.checkpoint.signature;
  const savedSha256=createHash("sha256").update(saved).digest("hex");
  const phases:Array<{phase:string;lod:number;start:number;end:number;ms:number;extent?:number[]}>=[];
  let activeLod:.125|.5=.5;
  const originalMesh=mesher.meshHvpOccupancy,originalProjection=region.projectHvpRegionOccupancy;
  try{
  vi.spyOn(mesher,"meshHvpOccupancy").mockImplementation((...args)=>{
    const start=performance.now();try{return originalMesh(...args);}finally{
      const end=performance.now();phases.push({phase:"mesh",lod:activeLod,start,end,ms:end-start,extent:[args[0].sizeX,args[0].sizeY,args[0].sizeZ]});}
  });
  vi.spyOn(region,"projectHvpRegionOccupancy").mockImplementation((...args)=>{
    const start=performance.now();try{return originalProjection(...args);}finally{
      const end=performance.now();phases.push({phase:"projection",lod:activeLod,start,end,ms:end-start});}
  });
    const job=await import("../../src/workers/hvpNeighborJob");
    const samples:Array<{lod:number;start:number;end:number;ms:number;packetSha256:string;packetBytes:number}>=[];
    for(const [index,lod,epoch] of [[0,.5,1],[1,.125,3]] as const){
      activeLod=lod;expect(protocol.fnv1aBytes(buffers)).toBe(rawInputHash);
      const key=canonicalizeContentKey(hvpRegionContentKey({region:"east",seed:coast.HVP_COAST_SEED_NAME,
        generator:coast.HVP_COAST_SOURCE_VERSION,materials:coast.HVP_COAST_REGISTRY_DIGEST,source:east.sourceDigest,
        revision:east.revision,neighbours:primary.sourceDigest,lod}));
      const payload={epoch,primaryRevision:primary.revision,eastRevision:east.revision,primaryDigest:primary.sourceDigest,eastDigest:east.sourceDigest,lod,key};
      const bundle:TransferableBufferBundle={ownership:"SenderToWorker",revision:ids.contentRevision(east.revision),buffers,
        byteLength:ids.byteCount(buffers.reduce((n,b)=>n+b.byteLength,0)),views:buffers.map((b,i)=>({name:["primary","east","proxies"][i]!,kind:"Uint8Array",bufferIndex:i,byteOffset:0,elementCount:b.byteLength}))};
      const request:WorkerJobRequest={jobId:ids.workerJobId(`saved-east-${index}`),targetKey:ids.workerTargetKey("hvp-east-projection"),
        jobKind:ids.workerJobKind(job.HVP_NEIGHBOR_JOB),workerEpoch:ids.workerEpoch(0),planningEpoch:ids.planningEpoch(0),
        inputRevision:ids.contentRevision(east.revision),sourceInputDigest:job.hvpNeighborInputDigest(payload,buffers),algorithmVersion:ids.algorithmVersion(1),
        priority:"Normal",deadline:ids.jobDeadline(index+1),estimatedInputBytes:bundle.byteLength,estimatedOutputBytes:ids.byteCount(job.HVP_NEIGHBOR_MAX_OUTPUT),payload};
      const start=performance.now(),output=job.executeHvpNeighborJob(request,bundle).bundle,end=performance.now(),ms=end-start;
      const spans=phases.filter(phase=>phase.lod===lod);
      expect(spans.filter(phase=>phase.phase==="projection")).toHaveLength(1);
      expect(spans.filter(phase=>phase.phase==="mesh")).toHaveLength(lod===.5?3:2);
      for(const span of spans){expect(Number.isFinite(span.start)&&Number.isFinite(span.end)&&Number.isFinite(span.ms)).toBe(true);
        expect(span.start).toBeGreaterThanOrEqual(start);expect(span.end).toBeLessThanOrEqual(end);expect(span.ms).toBeGreaterThanOrEqual(0);}
      expect(protocol.fnv1aBytes(buffers)).toBe(rawInputHash);expect(output.contentHash).toBe(protocol.fnv1aBytes(output.buffers));
      samples.push({lod,start,end,ms,packetSha256:createHash("sha256").update(new Uint8Array(output.buffers[0]!)).digest("hex"),packetBytes:output.byteLength});
    }
    expect(game.checkpoint.signature).toBe(saveSignature);
    if(process.env.HVP_NEIGHBOR_KERNEL_BASELINE){const baseline=JSON.parse(readFileSync(process.env.HVP_NEIGHBOR_KERNEL_BASELINE,"utf8"));
      expect(savedSha256).toBe(baseline.savedSha256);expect(rawInputHash).toBe(baseline.rawInputHash);expect(saveSignature).toBe(baseline.saveSignature);
      expect(samples.map(({lod,packetSha256,packetBytes})=>({lod,packetSha256,packetBytes})))
        .toEqual(baseline.samples.map(({lod,packetSha256,packetBytes}:typeof samples[number])=>({lod,packetSha256,packetBytes})));}
    const receipt={classification:"SAVED_EAST_KERNEL_MICRODIAGNOSTIC_NOT_PRODUCT_QUALIFICATION",inputPath,
      savedSha256,saveSignature,rawInputHash,samples,phases};
    writeFileSync(outputPath,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});console.info("saved East kernel diagnostic",receipt);
  }finally{vi.restoreAllMocks();}
},120_000);
