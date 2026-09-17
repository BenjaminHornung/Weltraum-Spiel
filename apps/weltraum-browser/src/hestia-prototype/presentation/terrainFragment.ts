import {meshHvpOccupancy} from "../../hvp/hvpCoastMesher";
import type {HvpPreparedTerrainBody} from "../terrain/terrainConsumer";
import type {HvpStructuralCell} from "../terrain/structuralIngest";

/** Immutable source-derived local geometry; native COM/pose remains the World owner's. */
export const meshHvpBodyCells=(cells:readonly HvpStructuralCell[],center:Readonly<{x:number;y:number;z:number}>,sourceDigest:string)=>{
  const min=[256,128,256],max=[0,0,0];
  for(const c of cells){for(const [i,v] of [c.x,c.y,c.z].entries()){min[i]=Math.min(min[i]!,v);max[i]=Math.max(max[i]!,v+1);}}
  const [sx,sy,sz]=max.map((v,i)=>v-min[i]!) as [number,number,number];
  if(sx*sy*sz>262_144){throw new Error("Fragment mesh preparation BudgetExceeded");}
  const slots=new Uint8Array(sx*sy*sz);
  for(const c of cells){slots[c.x-min[0]!+(c.y-min[1]!)*sx+(c.z-min[2]!)*sx*sy]=c.materialId;}
  const mesh=meshHvpOccupancy({sizeX:sx,sizeY:sy,sizeZ:sz,cellMeters:.125,
    originMeters:{x:min[0]!*.125,y:min[1]!*.125,z:min[2]!*.125},slotAt:(x,y,z)=>slots[x+y*sx+z*sx*sy]!},
    {maxVisitedCells:262_144,maxQuads:64_000,maxVertices:256_000,maxIndices:384_000},sourceDigest,"hvp-terrain-fragment-v1",{ao:true});
  for(let i=0;i<mesh.positions.length;i+=3){mesh.positions[i]!-=center.x;mesh.positions[i+1]!-=center.y;mesh.positions[i+2]!-=center.z;}
  return Object.freeze({...mesh,tempEstimateBytes:mesh.tempEstimateBytes+slots.byteLength,
    // The upload positions have already rounded to Float32 after subtracting
    // a mixed-material COM. Bounds must enclose those bytes, not ideal doubles.
    boundsMeters:{min:{x:Math.fround(mesh.boundsMeters.min.x-center.x),y:Math.fround(mesh.boundsMeters.min.y-center.y),z:Math.fround(mesh.boundsMeters.min.z-center.z)},
      max:{x:Math.fround(mesh.boundsMeters.max.x-center.x),y:Math.fround(mesh.boundsMeters.max.y-center.y),z:Math.fround(mesh.boundsMeters.max.z-center.z)}}});
};
export const meshHvpTerrainFragment=({request,state}:HvpPreparedTerrainBody)=>meshHvpBodyCells(request.cells,state.centerOfMass,state.sourceDigest);
