import {HVP_COAST_REGISTRY_DIGEST} from "../../hvp/hvpCoastSource";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
import type {HvpPreparedCut,HvpTerrainSnapshot} from "./cutPlan";

export const HVP_CHUNK_EDGE=32;
export const HVP_CHUNK_HALO=34;
export const HVP_CHUNK_COUNT=256;
export interface HvpChunkPayload {
  readonly worldId:string;
  readonly renderVersion:"hvp-terrain-chunk-v1";readonly collisionVersion:"hvp-collision-chunk-v1";
  readonly sessionId:string;readonly epoch:number;readonly generation:number;
  readonly sourceDigest:string;readonly baseDigest:string;readonly materialDigest:string;
  readonly chunk:number;readonly coreOrigin:readonly[number,number,number];
  readonly sizeX:32;readonly sizeY:32;readonly sizeZ:32;readonly haloWidth:1;
  readonly originMeters:Readonly<{x:number;y:number;z:number}>;
  readonly sourceOrigin:Readonly<{x:number;y:number;z:number}>;
  readonly haloBinding:string;
  readonly physicalHalo:"closed-exterior"|"east"|"west";
  readonly haloNeighbor:Readonly<{sessionId:string;epoch:number;generation:number;sourceDigest:string;baseDigest:string;
    originMeters:Readonly<{x:number;y:number;z:number}>}>|null;
}
export const hvpChunkCoordinates=(id:number):readonly[number,number,number]=>{
  if(!Number.isSafeInteger(id)||id<0||id>=HVP_CHUNK_COUNT){throw new Error("Invalid terrain chunk");}
  return [id%8,Math.floor(id/8)%4,Math.floor(id/32)];
};
const validateSource=(s:HvpTerrainSnapshot):void=>{
  if(s.sizeX!==256||s.sizeY!==128||s.sizeZ!==256||s.cellMeters!==.125
    ||![s.originMeters.x,s.originMeters.y,s.originMeters.z].every(v=>Number.isSafeInteger(v*8))
    ||s.originMeters.y!==-8||s.originMeters.z!==-16||![s.epoch,s.revision].every(v=>Number.isSafeInteger(v)&&v>=0)
    ||!/^[-A-Za-z0-9:._]{1,128}$/.test(s.sessionId)||!/^[-A-Za-z0-9:._]{1,128}$/.test(s.sourceDigest)
    ||!/^[-A-Za-z0-9:._]{1,128}$/.test(s.baseDigest)){throw new Error("Normative chunk source required");}
};
export const buildHvpChunkInput=(s:HvpTerrainSnapshot,id:number,readHalo:(x:number,y:number,z:number)=>number|undefined,
  haloBinding="explicit-halo-v1",worldId=s.sessionId,neighbor?:HvpTerrainSnapshot)=>{
  const steps=buildHvpChunkInputSteps(s,id,readHalo,haloBinding,undefined,worldId,neighbor);
  for(;;){const step=steps.next();if(step.done){return step.value;}}
};
export function* buildHvpChunkInputSteps(s:HvpTerrainSnapshot,id:number,readHalo:(x:number,y:number,z:number)=>number|undefined,
  haloBinding:string,reserve?:StructuralOwnedReserve,worldId=s.sessionId,neighbor?:HvpTerrainSnapshot):Generator<string,{slots:Uint8Array;payload:HvpChunkPayload},unknown>{
  validateSource(s);const [cx,cy,cz]=hvpChunkCoordinates(id),sx=cx*32,sy=cy*32,sz=cz*32;
  if(typeof readHalo!=="function"||!/^[-A-Za-z0-9:._]{1,512}$/.test(haloBinding)||!/^[-A-Za-z0-9:._]{1,128}$/.test(worldId)){throw new Error("Invalid chunk halo binding");}
  let physicalHalo:HvpChunkPayload["physicalHalo"]="closed-exterior",haloNeighbor:HvpChunkPayload["haloNeighbor"]=null;
  if(neighbor){validateSource(neighbor);
    if(neighbor.originMeters.x===s.originMeters.x+32){physicalHalo="east";}
    else if(neighbor.originMeters.x===s.originMeters.x-32){physicalHalo="west";}
    else{throw new Error("Invalid chunk physical neighbour coverage");}
    haloNeighbor=Object.freeze({sessionId:neighbor.sessionId,epoch:neighbor.epoch,generation:neighbor.revision,
      sourceDigest:neighbor.sourceDigest,baseDigest:neighbor.baseDigest,originMeters:Object.freeze({...neighbor.originMeters})});
  }
  reserve?.(8192+34**3);const slots=new Uint8Array(34**3);let work=0;
  for(let z=-1;z<=32;z+=1){for(let y=-1;y<=32;y+=1){for(let x=-1;x<=32;x+=1){
    const gx=sx+x,gy=sy+y,gz=sz+z;
    const inside=gx>=0&&gx<256&&gy>=0&&gy<128&&gz>=0&&gz<256;
    const value=inside?s.readSlot(gx,gy,gz):readHalo(gx,gy,gz);
    if(value===undefined){throw new Error("Unknown required chunk coverage");}
    if(!Number.isSafeInteger(value)||value<0||value>4){throw new Error("Invalid chunk material");}
    slots[x+1+(y+1)*34+(z+1)*34*34]=value;
    if(reserve&&++work===1024){work=0;yield "chunkInputCopy";}
  }}}
  const payload:HvpChunkPayload=Object.freeze({worldId,renderVersion:"hvp-terrain-chunk-v1",collisionVersion:"hvp-collision-chunk-v1",
    sessionId:s.sessionId,epoch:s.epoch,generation:s.revision,
    sourceDigest:s.sourceDigest,baseDigest:s.baseDigest,materialDigest:HVP_COAST_REGISTRY_DIGEST,chunk:id,
    coreOrigin:Object.freeze([sx,sy,sz]) as readonly[number,number,number],sizeX:32,sizeY:32,sizeZ:32,haloWidth:1,
    sourceOrigin:Object.freeze({...s.originMeters}),originMeters:Object.freeze({x:s.originMeters.x+sx*.125,y:s.originMeters.y+sy*.125,z:s.originMeters.z+sz*.125}),haloBinding,physicalHalo,haloNeighbor});
  return {slots,payload};
}
export const hvpDirtyChunks=(plan:Pick<HvpPreparedCut,"changed">):number[]=>{
  const ids=new Set<number>();
  for(const {cell:[x,y,z]} of plan.changed){
    if(![x,y,z].every(Number.isSafeInteger)||x<0||x>=256||y<0||y>=128||z<0||z>=256){throw new Error("Invalid chunk change coverage");}
    for(const dz of [-1,0,1]){for(const dy of [-1,0,1]){for(const dx of [-1,0,1]){
      const a=x+dx,b=y+dy,c=z+dz;
      if(a>=0&&a<256&&b>=0&&b<128&&c>=0&&c<256){ids.add(Math.floor(a/32)+Math.floor(b/32)*8+Math.floor(c/32)*32);}
    }}}
  }
  return [...ids].sort((a,b)=>a-b);
};
export const hvpRestoreChunks=(before:HvpTerrainSnapshot,after:HvpTerrainSnapshot):number[]=>{
  const steps=hvpRestoreChunksSteps(before,after);for(;;){const step=steps.next();if(step.done){return step.value;}}
};
export function* hvpRestoreChunksSteps(before:HvpTerrainSnapshot,after:HvpTerrainSnapshot,reserve?:StructuralOwnedReserve):Generator<string,number[],unknown>{
  validateSource(before);validateSource(after);
  if(before.baseDigest!==after.baseDigest||before.originMeters.x!==after.originMeters.x){throw new Error("Compatible chunk restore coverage required");}
  if(before.sourceDigest===after.sourceDigest){return [];}
  reserve?.(40_960);const ids=new Set<number>();let visited=0;
  for(let z=0;z<16;z+=1){for(let y=0;y<8;y+=1){for(let x=0;x<16;x+=1){
    if(++visited%16===0){yield "chunkRestoreCoverage";}
    if(before.leafRevision(x,y,z)===0&&after.leafRevision(x,y,z)===0){continue;}
    reserve?.(8192);const a=before.copyLeaf(x,y,z),b=after.copyLeaf(x,y,z);
    if(a.length!==4096||b.length!==4096){throw new Error("Incomplete chunk restore leaf");}
    if(a.every((v,i)=>v===b[i])){continue;}
    for(let cz=Math.floor(Math.max(0,z*16-1)/32);cz<=Math.floor(Math.min(255,z*16+16)/32);cz+=1){
      for(let cy=Math.floor(Math.max(0,y*16-1)/32);cy<=Math.floor(Math.min(127,y*16+16)/32);cy+=1){
        for(let cx=Math.floor(Math.max(0,x*16-1)/32);cx<=Math.floor(Math.min(255,x*16+16)/32);cx+=1){ids.add(cx+cy*8+cz*32);}
      }
    }
  }}}
  return [...ids].sort((a,b)=>a-b);
}
