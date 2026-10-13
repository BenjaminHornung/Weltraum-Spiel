import type {Fixture,Cell} from "../previous/src/fixtures";
const identity={x:0,y:0,z:0,w:1};
export function floorFixture():Fixture{
  const cells:Cell[]=[];for(let x=0;x<64;x++)for(let z=0;z<64;z++)cells.push([x,0,z]);
  return {id:"kcc-canonical-floor",cellSize:.125,bounds:[64,1,64],origin:[-4,-.125,-5],cells,density:2400,rotation:identity};
}
/** Exact input and occupancy formula of the frozen hvp-locomotion stair oracle. */
export function stairFixture(tread:1|2|4):Fixture{
  const cells:Cell[]=[];
  for(let x=0;x<16;x++)for(let y=0;y<16;y++)for(let z=0;z<64;z++)
    if(y<=Math.min(8,Math.max(0,Math.floor((40-z)/tread))))cells.push([x,y,z]);
  return {id:"kcc-canonical-stair-"+tread,cellSize:.125,bounds:[16,16,64],origin:[-1,-.125,-6],cells,density:2400,rotation:identity};
}
export const covered=(f:Fixture)=>(x:number,z:number)=>x>=f.origin[0]&&x<f.origin[0]+f.bounds[0]*f.cellSize
  &&z>=f.origin[2]&&z<f.origin[2]+f.bounds[2]*f.cellSize;
