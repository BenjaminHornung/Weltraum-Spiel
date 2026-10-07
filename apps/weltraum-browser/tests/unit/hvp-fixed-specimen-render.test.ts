import {expect,it} from "vitest";
import {meshHvpOccupancy} from "../../src/hvp/hvpCoastMesher";
import {meshHvpBodyCells} from "../../src/hestia-prototype/presentation/terrainFragment";
import {HVP_INERTIA_CELLS} from "../../src/hestia-prototype/physics/profile";
import type {HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";

it.each(["drop","inertia"] as const)("preserves original fixed %s geometry with explicit policy and retains default fragment AO",kind=>{
  const cells:readonly HvpStructuralCell[]=kind==="drop"?Array.from({length:64},(_,i)=>({x:i%4,y:Math.floor(i/4)%4,z:Math.floor(i/16),materialId:1})):HVP_INERTIA_CELLS;
  const center=kind==="drop"?{x:.25,y:.25,z:.25}:{x:0,y:0,z:0};
  const algorithmVersion=kind==="drop"?"hvp-drop-cube-v1":"hvp-inertia-l-v1";
  const original=meshHvpOccupancy({sizeX:kind==="drop"?4:8,sizeY:kind==="drop"?4:8,sizeZ:kind==="drop"?4:2,cellMeters:.125,
    originMeters:{x:-center.x,y:-center.y,z:-center.z},slotAt:(x,y,z)=>cells.some(c=>c.x===x&&c.y===y&&c.z===z)?1:0},undefined,algorithmVersion,algorithmVersion);
  const call=meshHvpBodyCells as unknown as (cells:readonly HvpStructuralCell[],center:{x:number;y:number;z:number},digest:string,
    policy?:{ao?:boolean;algorithmVersion?:string})=>ReturnType<typeof meshHvpBodyCells>;
  const restored=call(cells,center,"fnv1a64-v1:0000000000000000",{ao:false,algorithmVersion});
  for(const key of ["positions","normals","indices"] as const){
    expect(restored[key].constructor).toBe(original[key].constructor);expect(restored[key].length).toBe(original[key].length);
    expect(restored[key].every((value,index)=>Object.is(value,original[key][index]))).toBe(true);
  }
  expect(restored.colors).toBe(original.colors);expect(restored.materialRanges).toEqual(original.materialRanges);
  expect(restored.boundsMeters).toEqual(original.boundsMeters);expect(restored.algorithmVersion).toBe(original.algorithmVersion);
  const generic=meshHvpBodyCells(cells,center,"fnv1a64-v1:0000000000000000");
  expect(generic.colors).not.toBeNull();expect(generic.algorithmVersion).toBe("hvp-terrain-fragment-v1");
  if(kind==="inertia")expect(generic.indices.length).toBeGreaterThan(restored.indices.length);
});
