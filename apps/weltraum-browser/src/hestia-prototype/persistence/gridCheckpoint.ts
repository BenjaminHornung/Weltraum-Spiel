import type {HvpCellReader} from "../terrain/picking";

/** Complete X-fastest checkpoint. Runs describe material truth, not a generator seed. */
export interface HvpGridCheckpoint {
  readonly version:"hvp-grid-v1";
  readonly size:readonly [number,number,number];
  readonly origin:Readonly<{x:number;y:number;z:number}>;
  readonly cellMeters:0.125;
  readonly runs:readonly number[];
}
const maxSlots=8_388_608,maxRuns=262_144;
const dimensions=(size:readonly number[],origin:HvpGridCheckpoint["origin"],cellMeters:number):number=>{
  if(!Array.isArray(size)||size.length!==3||!size.every(n=>Number.isSafeInteger(n)&&n>0&&n<=256)
    ||size[0]!*size[1]!*size[2]!>maxSlots||cellMeters!==.125||!origin
    ||![origin.x,origin.y,origin.z].every(n=>Number.isFinite(n)&&Number.isSafeInteger(n*8))){throw new Error("Invalid grid checkpoint dimensions");}
  return size[0]!*size[1]!*size[2]!;
};
/** Shared RLE algorithm; each yield bounds a slice to 16,384 source reads. */
export function* encodeHvpGridChunks(source:HvpCellReader):Generator<void,HvpGridCheckpoint>{
  const size=[source.sizeX,source.sizeY,source.sizeZ] as const;
  dimensions(size,source.originMeters,source.cellMeters);
  const runs:number[]=[];
  let visited=0;
  for(let z=0;z<source.sizeZ;z+=1){for(let y=0;y<source.sizeY;y+=1){for(let x=0;x<source.sizeX;x+=1){
    const slot=source.readSlot(x,y,z);
    if(slot===undefined||!Number.isInteger(slot)||slot<0||slot>4){throw new Error("Checkpoint requires complete known material coverage");}
    if(runs.length>0&&runs[runs.length-2]===slot){runs[runs.length-1]!+=1;}
    else{if(runs.length===maxRuns*2){throw new Error("Grid checkpoint run BudgetExceeded");}runs.push(slot,1);}
    if(++visited===16_384){visited=0;yield;}
  }}}
  return Object.freeze({version:"hvp-grid-v1",size:Object.freeze(size),origin:Object.freeze({...source.originMeters}),cellMeters:.125,runs:Object.freeze(runs)});
}
export const encodeHvpGrid=(source:HvpCellReader):HvpGridCheckpoint=>{
  const chunks=encodeHvpGridChunks(source);
  for(;;){const next=chunks.next();if(next.done){return next.value;}}
};
export const hvpGridCheckpointBytes=(value:unknown):number=>{
  const grid=value as HvpGridCheckpoint|null;
  if(!grid||grid.version!=="hvp-grid-v1"||Object.keys(grid).sort().join(",")!=="cellMeters,origin,runs,size,version"){
    throw new Error("Unsupported grid checkpoint version or fields");
  }
  const count=dimensions(grid.size,grid.origin,grid.cellMeters);
  if(!Array.isArray(grid.runs)||grid.runs.length===0||grid.runs.length%2!==0||grid.runs.length>maxRuns*2){throw new Error("Invalid bounded checkpoint runs");}
  let total=0,last=-1;
  for(let i=0;i<grid.runs.length;i+=2){
    const slot=grid.runs[i]!,length=grid.runs[i+1]!;
    if(!Number.isInteger(slot)||slot<0||slot>4||slot===last||!Number.isSafeInteger(length)||length<1||length>count-total){throw new Error("Invalid checkpoint material/count");}
    last=slot;total+=length;
  }
  if(total!==count){throw new Error("Incomplete grid checkpoint");}
  return count;
};
export const decodeHvpGrid=(value:unknown)=>{
  const count=hvpGridCheckpointBytes(value),grid=value as HvpGridCheckpoint;
  // All transport counts and material codes are checked before the first buffer.
  const slots=new Uint8Array(count);let offset=0;
  for(let i=0;i<grid.runs.length;i+=2){const end=offset+grid.runs[i+1]!;slots.fill(grid.runs[i]!,offset,end);offset=end;}
  const [sizeX,sizeY,sizeZ]=grid.size;
  return Object.freeze({sizeX,sizeY,sizeZ,cellMeters:.125,originMeters:Object.freeze({...grid.origin}),byteLength:slots.byteLength,
    readSlot(x:number,y:number,z:number):number|undefined{
      if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!Number.isSafeInteger(z)){throw new Error("Integer checkpoint cell required");}
      return x<0||y<0||z<0||x>=sizeX||y>=sizeY||z>=sizeZ?undefined:slots[x+y*sizeX+z*sizeX*sizeY];
    },copySlots:()=>new Uint8Array(slots)});
};
