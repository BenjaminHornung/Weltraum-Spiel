// Throwaway E2 prototype. Derivative storage is never Source/World authority.
const probeSources=new WeakSet<object>();
let probeEnabled=false,ownedMovingSubset=false,ownedTerrainSubset=false;
export const enableProbeKernel=(movingSubset=false,terrainSubset=false)=>{probeEnabled=true;ownedMovingSubset=movingSubset;ownedTerrainSubset=terrainSubset;};
export const isProbeTerrainSubsetEnabled=()=>ownedTerrainSubset;
export const isProbeMovingSubsetEnabled=()=>ownedMovingSubset;
export const isProbeKernelEnabled=()=>probeEnabled;
export const markProbeSource=(source:StructuralObject)=>{if(!isIssuedStructuralObject(source)){throw new Error("Probe source must be issued");}probeSources.add(source);};
export const isProbeSource=(source:StructuralObject)=>probeSources.has(source);
import {fnv1aHash} from "../../core/hash";
import {fnv1aBytes} from "../../workers/protocol";
import {assertHvpTerrainSnapshot,copyHvpOwnedTerrainSlotsSteps,type HvpTerrainSnapshot} from "../../hestia-prototype/terrain/cutPlan";
import {isIssuedStructuralObject,ownedStructuralReconstructionSteps,ownedStructuralSubsetSteps} from "../../voxel/structural/model";
import {globalQuantumForStructuralCell,objectLocalQuantumForGlobal} from "../../voxel/structural/coordinates";
import {structuralAddressForBrickCell} from "../../voxel/structural/model";
import type {StructuralObject,StructuralBrick} from "../../voxel/structural/types";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
import type {HvpStructuralCell} from "../../hestia-prototype/terrain/structuralIngest";

/** Session-fixed Moving experiment; Terrain direct-v1 is unchanged. */
export function* deriveMovingProbeFragmentSteps(ancestor:StructuralObject,id:string,cells:readonly HvpStructuralCell[],reserve:StructuralOwnedReserve){
  if(!ownedMovingSubset){return yield* deriveProbeFragmentSteps(ancestor,id,cells,reserve);}
  const result=yield* ownedStructuralSubsetSteps(ancestor,id,cells,reserve);markProbeSource(result);return result;
}

type Leaf={key:string;x:number;y:number;z:number;revision:number;slots:Uint8Array;digest:string};

export function* createProbeTerrainMirrorSteps(initial:HvpTerrainSnapshot){
  assertHvpTerrainSnapshot(initial);
  const {sizeX:sx,sizeY:sy,sizeZ:sz}=initial,total=sx*sy*sz;
  if(![sx,sy,sz].every(n=>Number.isSafeInteger(n)&&n>0&&n<=256&&n%16===0)||total>8_388_608){throw new Error("Mirror size budget");}
  let slots=new Uint8Array(total);
  const owned=copyHvpOwnedTerrainSlotsSteps(initial,slots);
  if(owned){yield* owned;}
  else{for(let z=0;z<sz;z++){for(let y=0;y<sy;y++){for(let x=0;x<sx;x++){
    const value=initial.readSlot(x,y,z); if(value===undefined){throw new Error("Unknown mirror coverage");}
    slots[x+y*sx+z*sx*sy]=value;
  }yield "mirrorInitialCopy";}}}
  const revisions=new Float64Array(total/4096),digests=new Map<string,string>();
  const index=(x:number,y:number,z:number)=>x+y*(sx/16)+z*(sx/16)*(sy/16);
  for(let z=0;z<sz/16;z++){for(let y=0;y<sy/16;y++){for(let x=0;x<sx/16;x++){
    const revision=initial.leafRevision(x,y,z);revisions[index(x,y,z)]=revision;
    if(revision){const leaf=initial.copyLeaf(x,y,z);digests.set(`${x}:${y}:${z}`,fnv1aBytes([leaf.buffer as ArrayBuffer]));}
    yield "mirrorInitialBinding";
  }}}
  let current=initial,disposed=false;
  type Draft=Readonly<{reader:ReturnType<typeof projection>;wireBytes:number}>;
  let pending:{draft:Draft;target:HvpTerrainSnapshot;leaves:Map<number,Leaf>;previous:HvpTerrainSnapshot}|undefined;
  const bytes={initialCopied:total,deltaPreparedCopied:0,deltaCopied:0,deltaHashed:0,persistentSlots:total,maxDeltaBytes:0};
  const active=()=>{if(disposed){throw new Error("Mirror disposed");}};
  const readSlot=(x:number,y:number,z:number):number|undefined=>{
    active();if(![x,y,z].every(Number.isSafeInteger)){throw new Error("Integer mirror cell required");}
    return x<0||y<0||z<0||x>=sx||y>=sy||z>=sz?undefined:slots[x+y*sx+z*sx*sy];
  };
  const projection=(snapshot:HvpTerrainSnapshot,changes:Map<number,Leaf>,valid:()=>boolean)=>Object.freeze({
    sizeX:sx,sizeY:sy,sizeZ:sz,cellMeters:snapshot.cellMeters,originMeters:snapshot.originMeters,
    sessionId:snapshot.sessionId,epoch:snapshot.epoch,revision:snapshot.revision,sourceDigest:snapshot.sourceDigest,
    readSlot:(x:number,y:number,z:number)=>{
      if(!valid()){throw new Error("Stale mirror reader");}
      const value=readSlot(x,y,z);if(value===undefined){return undefined;}
      const leaf=changes.get(index(Math.floor(x/16),Math.floor(y/16),Math.floor(z/16)));
      return leaf?leaf.slots[x%16+(y%16)*16+(z%16)*256]:value;
    }
  });
  const makeDraft=(target:HvpTerrainSnapshot,leaves:Map<number,Leaf>):Draft=>{
    const draft:Draft=Object.freeze({reader:projection(target,leaves,():boolean=>pending?.draft===draft),wireBytes:leaves.size*4096});
    return draft;
  };
  function* prepareSteps(target:HvpTerrainSnapshot,maxLeafAdvances=1){
    active();if(pending){throw new Error("Mirror pending");}assertHvpTerrainSnapshot(target);
    if(target.sessionId!==initial.sessionId||target.epoch!==initial.epoch||target.baseDigest!==initial.baseDigest
      ||target.sizeX!==sx||target.sizeY!==sy||target.sizeZ!==sz){throw new Error("Foreign mirror source");}
    if(target.revision!==current.revision+1){throw new Error("Mirror generation gap");}
    const leaves=new Map<number,Leaf>(),next=new Map(digests);
    for(let z=0;z<sz/16;z++){for(let y=0;y<sy/16;y++){for(let x=0;x<sx/16;x++){
      active();const at=index(x,y,z),revision=target.leafRevision(x,y,z);
      if(revision!==revisions[at]){
        if(leaves.size===8||!Number.isSafeInteger(maxLeafAdvances)||maxLeafAdvances<1||maxLeafAdvances>2
          ||revision<revisions[at]!+1||revision>revisions[at]!+maxLeafAdvances){throw new Error("Mirror leaf revision/budget");}
        const data=target.copyLeaf(x,y,z),digest=fnv1aBytes([data.buffer as ArrayBuffer]),key=`${x}:${y}:${z}`;
        leaves.set(at,{key,x,y,z,revision,slots:data,digest});next.set(key,digest);bytes.deltaPreparedCopied+=4096;bytes.deltaHashed+=4096;
      }yield "mirrorDeltaBinding";
    }}}
    const digest=next.size?fnv1aHash(JSON.stringify([initial.baseDigest,[...next].sort(([a],[b])=>a<b?-1:a>b?1:0)])):initial.baseDigest;
    if(digest!==target.sourceDigest){throw new Error("Mirror Source digest mismatch");}
    active();const draft=makeDraft(target,leaves);pending={draft,target,leaves,previous:current};
    bytes.maxDeltaBytes=Math.max(bytes.maxDeltaBytes,draft.wireBytes);return draft;
  }
  return {
    get bytes(){return Object.freeze({...bytes});},
    read(){active();const captured=current;return projection(captured,new Map(),()=>current===captured);},prepareSteps,
    commit(draft:ReturnType<typeof makeDraft>,confirmed:HvpTerrainSnapshot){
      active();if(pending?.draft!==draft||pending.previous!==current||pending.target!==confirmed){throw new Error("Stale mirror pending commit");}
      for(const [at,leaf] of pending.leaves){
        for(let z=0;z<16;z++){for(let y=0;y<16;y++){
          slots.set(leaf.slots.subarray(y*16+z*256,y*16+z*256+16),leaf.x*16+(leaf.y*16+y)*sx+(leaf.z*16+z)*sx*sy);
        }}revisions[at]=leaf.revision;digests.set(leaf.key,leaf.digest);
      }
      bytes.deltaCopied+=draft.wireBytes;current=confirmed;pending.leaves.clear();pending=undefined;
    },
    cancel(draft:ReturnType<typeof makeDraft>){active();if(pending?.draft!==draft){throw new Error("Stale mirror pending cancellation");}pending.leaves.clear();pending=undefined;},
    dispose(){if(disposed){return;}disposed=true;pending?.leaves.clear();pending=undefined;digests.clear();slots=new Uint8Array();bytes.persistentSlots=0;}
  };
}

/** A real issued ancestor is retained as provenance. No fake Adaptive binding is minted.
 * The resulting private identity deliberately differs from a fresh AddBox import. */
export function* deriveProbeFragmentSteps(ancestor:StructuralObject,id:string,input:readonly HvpStructuralCell[],reserve:StructuralOwnedReserve){
  if(!isIssuedStructuralObject(ancestor)){throw new Error("Direct fragment requires an issued ancestor");}
  if(id===ancestor.objectId){throw new Error("Direct fragment requires a new object identity");}
  if(input.length<1||input.length>32_768||ancestor.anchors.length||ancestor.joints.length){throw new Error("Direct fragment subset budget/anchors");}
  reserve(64+input.length*256,true);
  const selected=new Map<string,number>();
  for(const cell of input){
    if(![cell.x,cell.y,cell.z,cell.materialId].every(Number.isSafeInteger)){throw new Error("Invalid direct subset cell");}
    const key=`${cell.x}:${cell.y}:${cell.z}`;if(selected.has(key)){throw new Error("Duplicate direct subset cell");}
    selected.set(key,cell.materialId);yield;
  }
  const bricks:StructuralBrick[]=[];let count=0;
  for(const brick of ancestor.bricks){
    const cells:StructuralBrick['cells'][number][]=[];
    for(const cell of brick.cells){
      const p=objectLocalQuantumForGlobal(globalQuantumForStructuralCell(structuralAddressForBrickCell(brick,cell.localIndex)),ancestor.frame);
      const material=selected.get(`${p.x}:${p.y}:${p.z}`);
      if(material!==undefined){if(material!==cell.state.materialId){throw new Error("Direct subset material mismatch");}cells.push(cell);count++;}
      yield;
    }
    if(cells.length){reserve(64+cells.length*128,true);bricks.push(Object.freeze({...brick,cells:Object.freeze(cells)}));}yield;
  }
  if(count!==selected.size){throw new Error("Direct subset occupancy missing from ancestor");}
  const result=yield* ownedStructuralReconstructionSteps(ancestor,{objectId:id,frame:ancestor.frame,source:ancestor.source,
    materials:ancestor.materials,bricks:Object.freeze(bricks),anchors:Object.freeze([]),joints:Object.freeze([]),
    // A new fragment starts at revision0, as the existing fresh-import path does.
    // Reusing the ancestor ID would require its actual destruction-command evidence.
    objectRevision:0,editRevision:0,commandEvidence:[]},reserve);
  markProbeSource(result);return result;
}
