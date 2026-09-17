import {meshHvpOccupancy, type HvpCompactMesh} from "../../hvp/hvpCoastMesher";
import type {HvpPhysicsSnapshot} from "../physics/physicsWorker";
import {HVP_BRANCH_SUPPORT} from "../physics/profile";

export type HvpBranchSnapshot=NonNullable<HvpPhysicsSnapshot["structural"]>;
export type HvpBranchProduct={key:string;ownerId:string;mesh:HvpCompactMesh;decoration:boolean};
/** Local attachment geometry; pose and live support ownership remain World-owned. */
const meshCells=(cells:readonly {x:number;y:number;z:number}[],center:{x:number;y:number;z:number},sourceDigest:string)=>{
    if(cells.length===0||cells.length>384){throw new Error("Branch render BudgetExceeded");}
    const min={x:Math.min(...cells.map(c=>c.x)),y:Math.min(...cells.map(c=>c.y)),z:Math.min(...cells.map(c=>c.z))};
    const max={x:Math.max(...cells.map(c=>c.x))+1,y:Math.max(...cells.map(c=>c.y))+1,z:Math.max(...cells.map(c=>c.z))+1};
    const occupied=new Set(cells.map(c=>`${c.x}:${c.y}:${c.z}`));
    const mesh=meshHvpOccupancy({sizeX:max.x-min.x,sizeY:max.y-min.y,sizeZ:max.z-min.z,cellMeters:.125,
      originMeters:{x:min.x*.125,y:min.y*.125,z:min.z*.125},slotAt:(x,y,z)=>occupied.has(`${x+min.x}:${y+min.y}:${z+min.z}`)?1:0},
      undefined,sourceDigest,"hvp-branch-greedy-v1");
    for(let i=0;i<mesh.positions.length;i+=3){mesh.positions[i]-=center.x;mesh.positions[i+1]-=center.y;mesh.positions[i+2]-=center.z;}
    return {...mesh,boundsMeters:{min:{x:Math.fround(mesh.boundsMeters.min.x-center.x),y:Math.fround(mesh.boundsMeters.min.y-center.y),z:Math.fround(mesh.boundsMeters.min.z-center.z)},
      max:{x:Math.fround(mesh.boundsMeters.max.x-center.x),y:Math.fround(mesh.boundsMeters.max.y-center.y),z:Math.fround(mesh.boundsMeters.max.z-center.z)}}};
  };
export const meshHvpBranchFoliage=(ownerId:string,center:{x:number;y:number;z:number},sourceDigest:string,key:string):HvpBranchProduct=>{
  const leaves=Array.from({length:8*2*6},(_,i)=>({x:8+i%8,y:12+Math.floor(i/8)%2,z:-1+Math.floor(i/16)}))
    .filter(c=>(c.x+c.z)%5!==0);
  return {key,ownerId,mesh:meshCells(leaves,center,sourceDigest),decoration:true};
};
/** Small authored sample only; canonical cells stay in the single physics owner. */
export const meshHvpBranchProducts=(state:HvpBranchSnapshot):readonly HvpBranchProduct[]=>{
  const products:HvpBranchProduct[]=state.parts.map(part=>{
    if(!part.cells){throw new Error("Missing canonical branch cells");}
    return {key:part.ownerId,ownerId:part.ownerId,mesh:meshCells(part.cells,part.center,state.sourceDigest),decoration:false};
  });
  const support=state.parts.find(p=>p.cells?.some(c=>c.x===HVP_BRANCH_SUPPORT.x&&c.y===HVP_BRANCH_SUPPORT.y&&c.z===HVP_BRANCH_SUPPORT.z));
  if(!support&&state.attachment.ownerId!==null){throw new Error("Missing attachment owner");}
  if(support){products.push(meshHvpBranchFoliage(support.ownerId,support.center,state.sourceDigest,`hvp:branch:foliage:r${state.generation+(state.state==="PreparedHeld"?1:0)}`));}
  return products;
};
