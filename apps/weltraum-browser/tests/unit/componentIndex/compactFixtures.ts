import { createHvpTerrainRoot } from "../../../src/hestia-prototype/terrain/cutPlan";
import type { HvpCell } from "../../../src/hestia-prototype/terrain/picking";
import { HVP_SOURCE_MIN_METERS } from "../../../src/hvp/hvpCoastSource";
import type { HvpStructuralCell } from "../../../src/hestia-prototype/terrain/structuralIngest";

export const voxel=(x:number,y:number,z:number,materialId=1):HvpStructuralCell=>({x,y,z,materialId});
export function rootFor(cells:readonly HvpStructuralCell[],size:HvpCell=[48,32,16],unknown?:HvpCell) {
  const key=(x:number,y:number,z:number)=>x+256*(y+256*z);
  const slots=new Map(cells.map(c=>[key(c.x,c.y,c.z),c.materialId]));
  const gap=unknown && key(...unknown);
  return createHvpTerrainRoot({sizeX:size[0],sizeY:size[1],sizeZ:size[2],originMeters:HVP_SOURCE_MIN_METERS,
    cellMeters:.125,sourceDigest:"af34d0c8",readSlot:(x,y,z)=>key(x,y,z)===gap?undefined:slots.get(key(x,y,z))??0},"p1-handoff",7);
}
export function cutAt(root:ReturnType<typeof rootFor>,min:HvpCell,max:HvpCell=[min[0]+1,min[1]+1,min[2]+1]) {
  const before=root.read();
  return root.prepare({sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,sourceDigest:before.sourceDigest,
    commandId:"compact-"+min.join("-"),toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min,max}});
}
export function uFixture() {
  const cells=[voxel(12,0,4),voxel(12,1,4),voxel(12,2,4)];
  for(let x=12;x<=24;x++) cells.push(voxel(x,3,4,x<18?1:3));
  for(let y=4;y<=19;y++) cells.push(voxel(12,y,4,y<12?2:4),voxel(24,y,4,y<9?3:1));
  return cells;
}
export function diagonalFixture(lastBlock:number,anchor=false) {
  const cells=[voxel(14,0,4),voxel(14,1,4),voxel(14,2,4)];
  let y=3;
  for(let x=14;x<=lastBlock*16+5;x++) {
    if(x%16===0){cells.push(voxel(x,y,4,3));y++;}
    cells.push(voxel(x,y,4,(x>>3)%4+1));
  }
  if(anchor) for(let h=y-1;h>=0;h--) cells.push(voxel(lastBlock*16+5,h,4));
  return cells;
}
