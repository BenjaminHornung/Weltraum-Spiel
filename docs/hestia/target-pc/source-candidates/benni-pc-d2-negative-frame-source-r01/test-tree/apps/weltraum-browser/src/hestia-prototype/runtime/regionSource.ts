import {fnv1aHash} from "../../core/hash";
import {HVP_COAST_SOURCE_VERSION,HVP_COAST_SEED_NAME,HVP_COAST_REGISTRY_DIGEST,materializeHvpRegionRows,readHvpSourceColumnWorld} from "../../hvp/hvpCoastSource";
import {meshHvpOccupancy,type HvpMeshOccupancy} from "../../hvp/hvpCoastMesher";
import {hvpGridCheckpointBytes,type HvpGridCheckpoint} from "../persistence/gridCheckpoint";
import {restoreHvpTerrainRoot,type HvpTerrainCheckpoint,type HvpTerrainSnapshot} from "../terrain/cutPlan";
import type {HvpCellReader} from "../terrain/picking";
export type HvpRegionSource=HvpCellReader&{readonly sourceDigest:string};

export const HVP_EAST_REGION=Object.freeze({id:"east",sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:Object.freeze({x:16,y:-8,z:-16})});
const digestStart=()=>Number.parseInt(fnv1aHash(JSON.stringify([HVP_EAST_REGION,HVP_COAST_SOURCE_VERSION,HVP_COAST_SEED_NAME,HVP_COAST_REGISTRY_DIGEST])),16);
const hex=(n:number)=>(n>>>0).toString(16).padStart(8,"0");
const digestSlots=(slots:Uint8Array):string=>{
  let hash=digestStart();for(const slot of slots){hash=Math.imul(hash^slot,0x01000193);}return hex(hash);
};
const digestCheckpoint=(grid:HvpGridCheckpoint):string=>{
  let hash=digestStart();for(let i=0;i<grid.runs.length;i+=2){for(let n=0;n<grid.runs[i+1]!;n+=1){hash=Math.imul(hash^grid.runs[i]!,0x01000193);}}return hex(hash);
};
export const createHvpEastRegion=async(signal?:AbortSignal)=>{
  if(signal?.aborted){throw new Error("Neighbour loading cancelled");}
  const slots=new Uint8Array(256*128*256);
  for(let z=0;z<256;z+=16){
    if(signal?.aborted){throw new Error("Neighbour loading cancelled");}
    materializeHvpRegionRows(slots,16,z,z+16);await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  const sourceDigest=digestSlots(slots);
  return Object.freeze({...HVP_EAST_REGION,sourceDigest,copySlots:()=>slots.slice(),
    readSlot:(x:number,y:number,z:number)=>{
      if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)){throw new Error("Region cells require integer addresses");}
      return x<0||x>=256||y<0||y>=128||z<0||z>=256?undefined:slots[x+y*256+z*32768];
    }});
};
export const restoreHvpEastRegion=(value:unknown)=>{
  const c=value as HvpTerrainCheckpoint;
  if(!c?.base||hvpGridCheckpointBytes(c.base)!==8_388_608||JSON.stringify(c.base.size)!=="[256,128,256]"
    ||c.base.origin.x!==16||c.base.origin.y!==-8||c.base.origin.z!==-16||c.baseDigest!==digestCheckpoint(c.base)){
    throw new Error("Neighbour checkpoint origin/digest mismatch");
  }
  return restoreHvpTerrainRoot(c);
};

/** Projection-only majority material/occupied coverage. Canonical bytes are never replaced. */
export const projectHvpRegionOccupancy=(source:HvpRegionSource,lod:.125|.5):HvpMeshOccupancy=>{
  if(lod!==.125&&lod!==.5){throw new Error("Unsupported region LOD");}
  const stride=lod/.125,sx=source.sizeX/stride,sy=source.sizeY/stride,sz=source.sizeZ/stride;
  if(source.cellMeters!==.125||![sx,sy,sz].every(n=>Number.isInteger(n)&&n>0&&n<=256)){throw new Error("Invalid region projection dimensions");}
  const coarse=lod===.5?new Uint8Array(sx*sy*sz):undefined;
  if(coarse){
    const counts=new Uint16Array(5);
    for(let z=0;z<sz;z+=1){for(let y=0;y<sy;y+=1){for(let x=0;x<sx;x+=1){
      counts.fill(0);
      for(let dz=0;dz<stride;dz+=1){for(let dy=0;dy<stride;dy+=1){for(let dx=0;dx<stride;dx+=1){
        const slot=source.readSlot(x*stride+dx,y*stride+dy,z*stride+dz);
        if(slot===undefined||slot<0||slot>4){throw new Error("Missing canonical projection coverage");}counts[slot]!+=1;
      }}}
      let slot=0;for(let material=1;material<=4;material+=1){if(counts[material]!>0&&(slot===0||counts[material]!>counts[slot]!)){slot=material;}}
      coarse[x+y*sx+z*sx*sy]=slot;
    }}}
  }
  return {sizeX:sx,sizeY:sy,sizeZ:sz,cellMeters:lod,originMeters:source.originMeters,
    slotAt:(x,y,z)=>{const slot=coarse?coarse[x+y*sx+z*sx*sy]:source.readSlot(x,y,z);if(slot===undefined){throw new Error("Missing canonical projection coverage");}return slot;},
    ghostSlotAt:(x,y,z)=>{
      if(y<0||y>=sy){return 0;}
      const column=readHvpSourceColumnWorld(source.originMeters.x+(x+.5)*lod,source.originMeters.z+(z+.5)*lod);
      return source.originMeters.y+(y+1)*lod<=column.topMeters?1:0;
    }};
};
export const meshHvpRegionLod=(source:HvpTerrainSnapshot,lod:.125|.5)=>
  meshHvpOccupancy(projectHvpRegionOccupancy(source,lod),undefined,source.sourceDigest,`hvp-region-lod-${lod}`,{ao:lod===.125});
