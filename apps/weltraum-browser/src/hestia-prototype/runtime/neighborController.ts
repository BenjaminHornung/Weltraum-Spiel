import {MemoryContentCache,type ContentLease} from "../../streaming/memoryContentCache";
import {canonicalizeContentKey} from "../../streaming/contentKey";
import {computeContentHash} from "../../streaming/canonical";
import {HVP_COAST_SOURCE_VERSION,HVP_COAST_SEED_NAME,HVP_COAST_REGISTRY_DIGEST} from "../../hvp/hvpCoastSource";
import {byteCount,contentRevision} from "../../workers/ids";
import {fnv1aBytes} from "../../workers/protocol";
import {decodeHvpNeighborOutput,type HvpNeighborPayload} from "../../workers/hvpNeighborJob";
import type {HvpPhysicsClient} from "../physics/client";
import {createHvpTerrainRoot,type HvpTerrainCheckpoint,type HvpTerrainSnapshot} from "../terrain/cutPlan";
import type {createHvpTerrainCompiler} from "../terrain/terrainProducts";
import type {HvpStagedTerrain} from "../terrain/terrainConsumer";
import {createHvpEastRegion,restoreHvpEastRegion} from "./regionSource";
import {createHvpRegionResidency,hvpRegionContentKey,type HvpNeighborCheckpoint} from "./residency";
import type {HvpNeighborProxies} from "./neighborProducts";

type Compiler=Pick<ReturnType<typeof createHvpTerrainCompiler>,"neighborProjection"|"neighborSeams">;
type Products=ReturnType<typeof decodeHvpNeighborOutput>;
type Seams=Awaited<ReturnType<Compiler["neighborSeams"]>>;
export interface HvpNeighborStage {
  readonly products:Products|null;readonly seams:Seams|null;readonly epoch:number;
  readonly source:HvpTerrainSnapshot|null;readonly cacheBytes:number;readonly checkpointBytes:number;
}
const LAYOUT="hvp-projection-meshes-v1";
const checkpointBytes=(c:HvpTerrainCheckpoint|undefined)=>c?c.base.runs.length*8+c.leaves.reduce((n,l)=>n+l.grid.runs.length*8+128,0)+1024:0;

/** One finite neighbour; source ownership survives render/collider eviction. */
export const createHvpNeighborController=(options:{
  primary:()=>HvpTerrainSnapshot;physics:Pick<HvpPhysicsClient,"read"|"prepareNeighbor"|"commitNeighbor"|"publishNeighbor"|"rollbackNeighbor"|"finalizeNeighbor"|"command">;
  compiler:Compiler;proxies:HvpNeighborProxies;baseSectorCount:number;current:()=>boolean;blocked:()=>boolean;
  admit:(bytes:Readonly<{source:number;cache:number;checkpoint:number;preparing:boolean}>)=>void;
  stage:(value:HvpNeighborStage)=>HvpStagedTerrain;
  cache?:MemoryContentCache;
  load?: (signal:AbortSignal)=>Promise<ReturnType<typeof createHvpTerrainRoot>>;
})=>{
  if(!Number.isSafeInteger(options.baseSectorCount)||options.baseSectorCount<64||options.baseSectorCount>4030){throw new Error("Invalid observed primary collider catalog");}
  const policy=createHvpRegionResidency(),cache=options.cache??new MemoryContentCache(32*1024*1024);
  let east:ReturnType<typeof createHvpTerrainRoot>|undefined,saved:HvpTerrainCheckpoint|undefined;
  let checkpointSource:HvpTerrainSnapshot|undefined;
  let activeLease:ContentLease|undefined,activePrimaryDigest:string|undefined,activeLod:.125|.5|undefined;
  let activeProducts:Products|undefined;
  let pending:Promise<void>|undefined,abort:AbortController|undefined,disposed=false,hold=false,failure="",retryBlocked=false,publishing=false;
  let cacheHits=0,cacheMisses=0,adoptions=0,stale=0,lastKey="";
  const valid=()=>!disposed&&options.current();
  const admit=(preparing:boolean,extraCache=0,extraCheckpoint=0)=>options.admit({source:east?8_388_608+east.read().overlayBytes*2:8_388_608,
    cache:cache.totalBytes+extraCache,checkpoint:checkpointBytes(saved)+extraCheckpoint,preparing});
  const decode=(lease:ContentLease,p:HvpNeighborPayload):Products=>{
    if(!lease.isValid||lease.layout!==LAYOUT){throw new Error("Invalid neighbour cache lease");}
    return decodeHvpNeighborOutput({buffers:[lease.buffer],ownership:"WorkerToConsumer",revision:contentRevision(p.eastRevision),
      byteLength:byteCount(lease.byteLength),contentHash:fnv1aBytes([lease.buffer]),views:[{name:"projections",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:lease.byteLength}]},p);
  };
  const load=async(projectionOnly=false)=>{
    const signal=abort!.signal;
    let ticket:ReturnType<typeof policy.begin>|undefined,lease:ContentLease|undefined,render:HvpStagedTerrain|undefined;
    let prepared=false,finalized=false,transactionId="";
    try{
      admit(true);
      if(!east){east=saved?restoreHvpEastRegion(saved):await(options.load?.(signal)??createHvpEastRegion(signal).then(source=>createHvpTerrainRoot(source,`${options.primary().sessionId}:east`,options.primary().epoch)));
        if(saved&&east){checkpointSource=east.read();}}
      const loaded=east;
      if(!loaded||!valid()||signal.aborted||(!projectionOnly&&!policy.read().wanted)){throw new Error("Cancelled neighbour load");}
      const primary=options.primary(),source=loaded.read(),lod=policy.read().lod;
      const key=hvpRegionContentKey({region:"east",seed:HVP_COAST_SEED_NAME,generator:HVP_COAST_SOURCE_VERSION,
        materials:HVP_COAST_REGISTRY_DIGEST,source:source.sourceDigest,revision:source.revision,neighbours:primary.sourceDigest,lod});
      const validKeys=new Set(([.125,.5] as const).map(level=>canonicalizeContentKey(hvpRegionContentKey({region:"east",seed:HVP_COAST_SEED_NAME,
        generator:HVP_COAST_SOURCE_VERSION,materials:HVP_COAST_REGISTRY_DIGEST,source:source.sourceDigest,revision:source.revision,neighbours:primary.sourceDigest,lod:level}))));
      for(const entry of cache.snapshot().entries){
        if(entry.key.namespace==="hvp-region"&&entry.leaseCount===0&&entry.pinCount===0&&!validKeys.has(canonicalizeContentKey(entry.key))){cache.delete(entry.key);}
      }
      const canonical=canonicalizeContentKey(key);ticket=projectionOnly?policy.beginProjection(canonical):policy.begin(canonical);transactionId=`neighbor-${ticket.epoch}`;
      const isCurrent=()=>valid()&&!signal.aborted&&options.primary()===primary&&east?.read()===source
        &&policy.read().wanted===!projectionOnly&&policy.read().lod===lod&&policy.read().epoch===ticket!.epoch;
      const payload:HvpNeighborPayload={epoch:ticket.epoch,primaryRevision:primary.revision,eastRevision:source.revision,
        primaryDigest:primary.sourceDigest,eastDigest:source.sourceDigest,lod,key:canonical};
      lease=cache.get(key);
      if(lease){cacheHits+=1;}else{
        cacheMisses+=1;const built=await options.compiler.neighborProjection(primary,source,lod,ticket.epoch,canonical,options.proxies,signal);
        if(!isCurrent()){stale+=1;throw new Error("Cancelled stale neighbour output before cache");}
        // put owns a copy; both the accepted worker buffer and cache copy coexist.
        // Projection worker has completed. Its scratch does not overlap the
        // accepted packet plus cache copy; reserve worker work again below.
        admit(false,built.buffer.byteLength*2);
        cache.put({key,buffer:built.buffer,byteLength:built.buffer.byteLength,contentHash:computeContentHash(built.buffer),layout:LAYOUT});
        lease=cache.get(key)!;
      }
      if(!isCurrent()){stale+=1;throw new Error("Cancelled neighbour cache adoption");}
      const products=decode(lease,payload),native=options.physics.read().neighbor;
      const collisionChanged=!projectionOnly&&(!native?.resident||activePrimaryDigest!==primary.sourceDigest||native.sourceDigest!==source.sourceDigest);
      if(collisionChanged||projectionOnly){admit(true);}
      const seams=collisionChanged||projectionOnly?await options.compiler.neighborSeams(primary,source,signal,projectionOnly,projectionOnly):null;
      if(!isCurrent()){stale+=1;throw new Error("Cancelled neighbour seam adoption");}
      render=options.stage({products,seams,epoch:ticket.epoch,source:projectionOnly?null:source,cacheBytes:cache.totalBytes,checkpointBytes:checkpointBytes(saved)});
      publishing=true;
      if(collisionChanged){
        const checkpoint:HvpNeighborCheckpoint={version:"hvp-neighbor-world-v1",epoch:Math.max(ticket.epoch,(native?.epoch??0)+1),resident:true,
          sourceDigest:source.sourceDigest,baseSectorCount:native?.baseSectorCount??options.baseSectorCount};
        // The normal source catalog is observed by the caller's real World.
        await options.physics.prepareNeighbor(transactionId,checkpoint,seams!.east,[...seams!.primary.collision].map(([index,mesh])=>({index,mesh})));prepared=true;
        if(!isCurrent()){throw new Error("Cancelled prepared neighbour");}
        await options.physics.commitNeighbor(transactionId);
        if(!isCurrent()){throw new Error("Cancelled neighbour before publication");}
        options.physics.publishNeighbor();
      }
      render.publish();
      if(prepared){await options.physics.finalizeNeighbor(transactionId);}finalized=true;
      render.finish();
      const accepted=projectionOnly?policy.acceptProjection(ticket,{source:canonical,render:canonical}):policy.accept(ticket,{source:canonical,render:canonical,collision:canonical});
      if(!accepted){throw new Error("Neighbour ticket lost before publication");}
      activeLease?.release();activeLease=lease;lease=undefined;
      activePrimaryDigest=primary.sourceDigest;activeLod=lod;activeProducts=products;lastKey=canonical;adoptions+=1;failure="";
      if(projectionOnly){east=undefined;checkpointSource=undefined;}
    }catch(error){
      let restored=!finalized;
      if(!finalized){try{render?.rollback();}catch{restored=false;}
        if(prepared){try{await options.physics.rollbackNeighbor(transactionId);}catch{restored=false;}}}
      if(ticket){policy.reject(ticket,signal.aborted||!valid()||String(error).includes("Cancelled"));}
      lease?.release();
      if(!restored||String(error).includes("RecoveryHold")){hold=true;try{await options.physics.command("Pause");}catch{/* Never claim restoration. */}}
      if(!signal.aborted&&valid()&&!String(error).includes("Cancelled")){failure=String(error);retryBlocked=true;}
    }
  };
  const unload=async()=>{
    const primary=options.primary(),native=options.physics.read().neighbor;
    if(!east||!native?.resident){return;}
    let render:HvpStagedTerrain|undefined,prepared=false,finalized=false;
    const id=`neighbor-evict-${native.epoch+1}`;
    try{
      const source=east.read();
      if(!saved||checkpointSource!==source){
        // Keep input responsive while the independent solver still has held keys.
        // Checkpoint work precedes, rather than overlaps, the collision workers.
        admit(false,0,4*1024*1024+source.overlayBytes*16+1024);
        const checkpoint=await east.checkpointAsync(abort!.signal);
        if(!valid()||abort!.signal.aborted||east?.read()!==source){throw new Error("Cancelled stale neighbour checkpoint");}
        saved=checkpoint;checkpointSource=source;
      }
      admit(true);
      const seams=await options.compiler.neighborSeams(primary,undefined,abort!.signal);
      if(!valid()||abort!.signal.aborted||policy.read().wanted||options.primary()!==primary||!saved){throw new Error("Cancelled neighbour eviction");}
      // Preserve the accepted edited projection instead of restoring a seed proxy.
      const keepProjection=saved.revision>0&&activeProducts!==undefined;
      render=options.stage({products:keepProjection?activeProducts!:null,
        seams:keepProjection?{...seams,primary:{...seams.primary,render:new Map()}}:seams,
        epoch:native.epoch+1,source:null,cacheBytes:cache.totalBytes,checkpointBytes:checkpointBytes(saved)});
      publishing=true;
      const checkpoint={...native,epoch:native.epoch+1,resident:false};
      await options.physics.prepareNeighbor(id,checkpoint,[],[...seams.primary.collision].map(([index,mesh])=>({index,mesh})));prepared=true;
      if(!valid()||policy.read().wanted||abort!.signal.aborted){throw new Error("Cancelled prepared eviction");}
      await options.physics.commitNeighbor(id);options.physics.publishNeighbor();render.publish();
      await options.physics.finalizeNeighbor(id);finalized=true;render.finish();
      policy.evict(true);
      if(!keepProjection){activeLease?.release();activeLease=undefined;activeProducts=undefined;activePrimaryDigest=undefined;activeLod=undefined;}
      east=undefined;checkpointSource=undefined;adoptions+=1;
    }catch(error){
      let restored=!finalized;
      if(!finalized){try{render?.rollback();}catch{restored=false;}if(prepared){try{await options.physics.rollbackNeighbor(id);}catch{restored=false;}}}
      if(!restored||String(error).includes("RecoveryHold")){hold=true;try{await options.physics.command("Pause");}catch{/* Held until explicit recovery. */}}
      if(valid()&&!abort!.signal.aborted&&!String(error).includes("Cancelled")&&!String(error).includes("Pinned")){failure=String(error);retryBlocked=true;}
    }
  };
  const release=()=>{activeLease?.release();activeLease=undefined;activeProducts=undefined;activePrimaryDigest=undefined;if(!options.cache){cache.clear();}east=undefined;saved=undefined;checkpointSource=undefined;};
  return {
    async initialize(root:ReturnType<typeof createHvpTerrainRoot>,lod:.125|.5){
      if(pending||east||saved||activeLease||disposed){throw new Error("Neighbour already initialized");}
      const native=options.physics.read().neighbor;
      if(!native||native.sourceDigest!==root.read().sourceDigest){throw new Error("Restored neighbour/World mismatch");}
      saved=root.checkpoint();checkpointSource=root.read();
      if(!native.resident){
        policy.restoreEvicted(native.epoch,lod);
        if(root.read().revision===0){return;}
        east=root;abort=new AbortController();pending=load(true).finally(()=>{pending=undefined;abort=undefined;publishing=false;});
        await pending;if(hold||failure||!activeLease){throw new Error(failure||"Saved edited projection failed");}return;
      }
      east=root;activePrimaryDigest=options.primary().sourceDigest;
      policy.update(lod===.125?12:10,true);
      abort=new AbortController();pending=load().finally(()=>{pending=undefined;abort=undefined;publishing=false;});
      await pending;if(hold||failure||!activeLease){throw new Error(failure||"Restored neighbour publication failed");}
    },
    update(x:number,pinned:boolean):void{
      if(disposed||hold||(pending&&publishing)){return;}const previous=policy.read(),action=policy.update(x,pinned);
      if(pending){if(previous.wanted!==policy.read().wanted||previous.lod!==policy.read().lod){abort?.abort();}return;}
      if(options.blocked()||retryBlocked){return;}
      if(!policy.read().wanted&&policy.read().state==="Evicted"&&activeProducts&&activePrimaryDigest!==options.primary().sourceDigest){
        abort=new AbortController();pending=load(true).finally(()=>{pending=undefined;abort=undefined;publishing=false;});return;
      }
      const needsRefresh=policy.read().wanted&&(!activeLease||activePrimaryDigest!==options.primary().sourceDigest||activeLod!==policy.read().lod);
      if(action==="Unload"||needsRefresh||action==="Load"){
        abort=new AbortController();pending=(action==="Unload"?unload():load()).finally(()=>{pending=undefined;abort=undefined;publishing=false;});
      }
    },
    retry(){if(!hold&&!pending){failure="";retryBlocked=false;}},
    read:()=>Object.freeze({...policy.read(),busy:pending!==undefined,recoveryHold:hold,error:failure,key:lastKey,
      renderLod:activeLod??null,proxyOnly:activeProducts!==undefined&&!policy.read().collisionReady,
      sourceDigest:east?.read().sourceDigest??saved?.sourceDigest??null,sourceBytes:east?8_388_608+east.read().overlayBytes*2:0,
      checkpointBytes:checkpointBytes(saved),cacheBytes:cache.totalBytes,cacheEntries:cache.size,cacheHits,cacheMisses,adoptions,stale}),
    checkpoint(){if(pending||hold){throw new Error("Neighbour checkpoint Pending/RecoveryHold");}
      if(east&&checkpointSource!==east.read()){saved=east.checkpoint();checkpointSource=east.read();}
      return saved??null;},
    retire(){if(pending){throw new Error("Cannot retire a pending neighbour");}disposed=true;release();},
    async dispose(){if(disposed){return;}disposed=true;abort?.abort();await pending;release();}
  };
};
