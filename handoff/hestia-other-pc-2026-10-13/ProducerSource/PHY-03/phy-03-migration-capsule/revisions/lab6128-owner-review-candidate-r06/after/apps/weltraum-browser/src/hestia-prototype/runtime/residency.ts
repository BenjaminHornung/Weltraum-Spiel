import {createContentKey} from "../../streaming/contentKey";
import {transitionResidency,type ResidencyState} from "../../streaming/residency";
import {fnv1aHash} from "../../core/hash";

export interface HvpNeighborCheckpoint {
  readonly version:"hvp-neighbor-world-v1";readonly epoch:number;readonly resident:boolean;
  readonly sourceDigest:string;readonly baseSectorCount:number;
}
export const validateHvpNeighborCheckpoint=(value:unknown):HvpNeighborCheckpoint=>{
  const p=value as HvpNeighborCheckpoint|null;
  if(!p||Object.keys(p).sort().join(",")!=="baseSectorCount,epoch,resident,sourceDigest,version"||p.version!=="hvp-neighbor-world-v1"
    ||!Number.isSafeInteger(p.epoch)||p.epoch<1||typeof p.resident!=="boolean"||typeof p.sourceDigest!=="string"||!/^[0-9a-f]{8}$/.test(p.sourceDigest)
    ||!Number.isSafeInteger(p.baseSectorCount)||p.baseSectorCount<64||p.baseSectorCount>4030){throw new Error("Invalid neighbour checkpoint");}
  return p;
};

export const hvpRegionContentKey=(input:{region:"east";seed:string;generator:string;materials:string;source:string;revision:number;neighbours:string;lod:.125|.5})=>{
  if(input.region!=="east"||![input.seed,input.generator,input.materials,input.source,input.neighbours].every(v=>typeof v==="string"&&v.length>0&&v.length<=128)
    ||(input.lod!==.125&&input.lod!==.5)){throw new Error("Unknown or incomplete HVP region context");}
  const digest=fnv1aHash(JSON.stringify([input.region,input.seed,input.generator,input.materials,input.source,input.revision,input.neighbours,input.lod]));
  return createContentKey({namespace:"hvp-region",contentId:`east:${digest}`,inputRevision:input.revision,algorithmVersion:1,outputRevision:input.revision});
};
export const createHvpRegionResidency=()=>{
  let state:ResidencyState="NotRequested",epoch=0,wanted=false,pinned=false,collisionReady=false,transitions=0,lod:.125|.5=.5;
  let current:Readonly<{epoch:number;key:string}>|undefined;
  const change=(next:ResidencyState)=>{state=transitionResidency(state,next);transitions+=1;};
  return {
    read:()=>Object.freeze({state,epoch,wanted,pinned,lod,collisionReady,transitions}),
    restoreEvicted(savedEpoch:number,savedLod:.125|.5){
      if(state!=="NotRequested"||current||!Number.isSafeInteger(savedEpoch)||savedEpoch<1||(savedLod!==.125&&savedLod!==.5)){throw new Error("Invalid dormant region policy restore");}
      state="Evicted";epoch=savedEpoch;lod=savedLod;
    },
    beginProjection(key:string){
      if(state!=="Evicted"||wanted||collisionReady||!key||key.length>512){throw new Error("Unconfirmed dormant projection");}
      current=Object.freeze({epoch:++epoch,key});return current;
    },
    acceptProjection(ticket:Readonly<{epoch:number;key:string}>,proof:{source:string;render:string}):boolean{
      if(current!==ticket||ticket.epoch!==epoch||state!=="Evicted"||wanted||collisionReady){return false;}
      if(proof.source!==ticket.key||proof.render!==ticket.key){throw new Error("Dormant projection binding mismatch");}
      current=undefined;return true;
    },
    update(x:number,keepPinned=false):"Load"|"Unload"|"Lod"|undefined{
      if(!Number.isFinite(x)){throw new Error("Invalid residency position");}pinned=keepPinned;
      if(x>=10||pinned){wanted=true;}else if(x<=4){wanted=false;}
      const previous=lod;if(x>=12){lod=.125;}else if(x<=8){lod=.5;}
      if(!wanted&&(state==="Queued"||state==="Loading")){change("Cancelled");current=undefined;epoch+=1;}
      if(!wanted&&state==="Ready"&&current){current=undefined;epoch+=1;}
      if(wanted&&["NotRequested","Cancelled","Evicted","Failed"].includes(state)){return "Load";}
      if(!wanted&&state==="Ready"){return "Unload";}
      if(wanted&&state==="Ready"&&previous!==lod){return "Lod";}
    },
    begin(key:string){
      if(!wanted||typeof key!=="string"||key.length===0||key.length>512){throw new Error("Unrequested region load");}
      if(state==="Loading"){change("Cancelled");}
      // A projection refresh does not revoke already admitted canonical collision.
      if(!collisionReady){change("Queued");change("Loading");}
      current=Object.freeze({epoch:++epoch,key});return current;
    },
    accept(ticket:Readonly<{epoch:number;key:string}>,proof:{source:string;render:string;collision:string}):boolean{
      if(ticket!==current||ticket.epoch!==epoch||!wanted||(state!=="Loading"&&state!=="Ready")){return false;}
      if(proof.source!==ticket.key||proof.render!==ticket.key||proof.collision!==ticket.key){throw new Error("Incomplete region product binding");}
      if(state!=="Ready"){change("Ready");}collisionReady=true;current=undefined;return true;
    },
    reject(ticket:Readonly<{epoch:number;key:string}>,cancelled:boolean){
      if(current!==ticket){return;}current=undefined;epoch+=1;
      if(state==="Loading"||state==="Queued"){change(cancelled?"Cancelled":"Failed");}
    },
    evict(checkpointed:boolean){
      if(!checkpointed){throw new Error("Region checkpoint required before eviction");}
      if(wanted||pinned||state!=="Ready"){throw new Error("Region remains pinned or active");}
      change("Evicted");collisionReady=false;current=undefined;epoch+=1;
    }
  };
};
