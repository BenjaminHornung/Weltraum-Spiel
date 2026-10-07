import {meshHvpOccupancySteps,type HvpCompactMesh} from "../../hvp/hvpCoastMesher";
import type {HvpStructuralCell} from "../terrain/structuralIngest";
import {assertHvpRigidRecipe} from "../physics/rigidRecipe";
import type {prepareHvpLocalBodyCut} from "../physics/bodyCutPlan";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";

type Vec=Readonly<{x:number;y:number;z:number}>;
type LocalPart=ReturnType<typeof prepareHvpLocalBodyCut>["plan"]["parts"][number];
// ponytail: fixed batches for owner-created inputs; calibrate with real Worker slices before wiring.
const CELL_BATCH=128;
const ARRAY_BATCH=4096;

/**
 * Internal immutable-input adapter for the SAME occupancy mesher. It issues no source/native proof.
 * Cancellation is generator.return(); callers must drop the cursor and recheck their pending owner
 * after every real task yield. Do not pass public getters/proxies or mutate inputs across yields.
 */
function* bodyOccupancySteps(cells:readonly HvpStructuralCell[],center:Vec,reserve?:StructuralOwnedReserve){
  if(!Array.isArray(cells)||Object.getPrototypeOf(cells)!==Array.prototype||!Object.isFrozen(cells)
    ||cells.length<1||cells.length>32768||![center.x,center.y,center.z].every(Number.isFinite)){
    throw new Error("Body mesh requires bounded immutable local inputs");
  }
  reserve?.(8_192);
  // Match meshHvpBodyCells' existing bounding-box and forward Float32 projection exactly.
  const min=[256,128,256],max=[0,0,0];
  let wideMaterials=false;
  for(let start=0;start<cells.length;start+=CELL_BATCH){
    for(let i=start;i<Math.min(start+CELL_BATCH,cells.length);i+=1){
      const c=cells[i]!;
      if(!Object.isFrozen(c)||![c.x,c.y,c.z].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1000000)
        ||!Number.isSafeInteger(c.materialId)||c.materialId<1||c.materialId>65535){
        throw new Error("Body mesh requires immutable local cells");
      }
      if(c.materialId>255){wideMaterials=true;}
      for(const [a,v] of [c.x,c.y,c.z].entries()){min[a]=Math.min(min[a]!,v);max[a]=Math.max(max[a]!,v+1);}
    }
    yield "meshBounds";
  }
  const [sx,sy,sz]=max.map((v,i)=>v-min[i]!) as [number,number,number];
  if(sx*sy*sz>262144){throw new Error("Fragment mesh preparation BudgetExceeded");}
  reserve?.(64+sx*sy*sz*(wideMaterials?2:1));
  const slots=wideMaterials?new Uint16Array(sx*sy*sz):new Uint8Array(sx*sy*sz);
  for(let start=0;start<cells.length;start+=CELL_BATCH){
    for(let i=start;i<Math.min(start+CELL_BATCH,cells.length);i+=1){
      const c:HvpStructuralCell=cells[i]!;
      const index=c.x-min[0]!+(c.y-min[1]!)*sx+(c.z-min[2]!)*sx*sy;
      if(slots[index]!==0){throw new Error("Duplicate local body mesh cell");}
      slots[index]=c.materialId;
    }
    yield "meshOccupancy";
  }
  return {sx,sy,sz,slots,min};
}

/** Allocation-only source counts, never geometry, a plan, or a Source/native proof. */
export function* countHvpOwnedBodyMeshSteps(cells:readonly HvpStructuralCell[],reserve:StructuralOwnedReserve):Generator<string,{cells:number;gridCells:number;exposedFaces:number;slotBytes:number},unknown>{
  const {sx,sy,sz,slots,min}=yield* bodyOccupancySteps(cells,{x:0,y:0,z:0},reserve);
  let exposedFaces=0;
  for(let start=0;start<cells.length;start+=CELL_BATCH){
    for(let i=start;i<Math.min(start+CELL_BATCH,cells.length);i+=1){
      const cell=cells[i]!,x=cell.x-min[0]!,y=cell.y-min[1]!,z=cell.z-min[2]!,index=x+y*sx+z*sx*sy;
      if(x===0||slots[index-1]===0){exposedFaces+=1;}if(x+1===sx||slots[index+1]===0){exposedFaces+=1;}
      if(y===0||slots[index-sx]===0){exposedFaces+=1;}if(y+1===sy||slots[index+sx]===0){exposedFaces+=1;}
      if(z===0||slots[index-sx*sy]===0){exposedFaces+=1;}if(z+1===sz||slots[index+sx*sy]===0){exposedFaces+=1;}
    }
    yield "meshQuoteFaces";
  }
  return Object.freeze({cells:cells.length,gridCells:sx*sy*sz,exposedFaces,slotBytes:slots.byteLength});
}

export function* meshHvpOwnedBodyCellsSteps(cells:readonly HvpStructuralCell[],center:Vec,sourceDigest:string,reserve?:StructuralOwnedReserve):Generator<string,HvpCompactMesh,unknown>{
  const {sx,sy,sz,slots,min}=yield* bodyOccupancySteps(cells,center,reserve);
  const mesh=yield* meshHvpOccupancySteps({sizeX:sx,sizeY:sy,sizeZ:sz,cellMeters:.125,
    originMeters:{x:min[0]!*.125,y:min[1]!*.125,z:min[2]!*.125},slotAt:(x,y,z)=>slots[x+y*sx+z*sx*sy]!},
    {maxVisitedCells:262144,maxQuads:64000,maxVertices:256000,maxIndices:384000},sourceDigest,"hvp-terrain-fragment-v1",{ao:true},reserve);
  for(let start=0;start<mesh.positions.length;start+=ARRAY_BATCH*3){
    for(let i=start;i<Math.min(start+ARRAY_BATCH*3,mesh.positions.length);i+=3){
      mesh.positions[i]!-=center.x;mesh.positions[i+1]!-=center.y;mesh.positions[i+2]!-=center.z;
    }
    yield "meshLocalPositions";
  }
  return Object.freeze({...mesh,tempEstimateBytes:mesh.tempEstimateBytes+slots.byteLength,
    boundsMeters:{min:{x:Math.fround(mesh.boundsMeters.min.x-center.x),y:Math.fround(mesh.boundsMeters.min.y-center.y),z:Math.fround(mesh.boundsMeters.min.z-center.z)},
      max:{x:Math.fround(mesh.boundsMeters.max.x-center.x),y:Math.fround(mesh.boundsMeters.max.y-center.y),z:Math.fround(mesh.boundsMeters.max.z-center.z)}}});
}

/**
 * Exact render admission against a child from the retained OWNER-LOCAL plan, never returned cells.
 * One expected mesh lives at a time. Success is not a transferable certificate/native authority.
 * The existing decoder must first prove layout/ownership/bounds; this adds complete geometry.
 */
export function* verifyHvpOwnedBodyMeshSteps(part:LocalPart,actual:HvpCompactMesh,reserve?:StructuralOwnedReserve):Generator<string,void,unknown>{
  assertHvpRigidRecipe(part.recipe);
  const expected=yield* meshHvpOwnedBodyCellsSteps(part.cells,part.recipe.mass.centerOfMassMeters!,part.recipe.source.contentHash,reserve);
  const reject=()=>{throw new Error("Foreign local body mesh geometry");};
  for(const field of ["faceCount","unitFaceCount","outerFaceCount","cavityFaceCount","tempEstimateBytes","sourceDigest","algorithmVersion"] as const){
    if(!Object.is(actual[field],expected[field])){reject();}
  }
  for(const end of ["min","max"] as const){
    for(const axis of ["x","y","z"] as const){
      if(!Object.is(actual.boundsMeters[end][axis],expected.boundsMeters[end][axis])){reject();}
    }
  }
  for(const field of ["positions","normals","colors","indices"] as const){
    const a=actual[field],e=expected[field];
    if(a===null||e===null){if(a!==e){reject();}continue;}
    if(a.constructor!==e.constructor||a.length!==e.length){reject();}
    for(let start=0;start<e.length;start+=ARRAY_BATCH){
      for(let i=start;i<Math.min(start+ARRAY_BATCH,e.length);i+=1){
        if(!Object.is(a[i],e[i])){reject();}
      }
      yield "meshCompare";
    }
  }
  if(actual.materialRanges.length!==expected.materialRanges.length){reject();}
  for(let start=0;start<expected.materialRanges.length;start+=CELL_BATCH){
    for(let i=start;i<Math.min(start+CELL_BATCH,expected.materialRanges.length);i+=1){
      const a=actual.materialRanges[i]!,e=expected.materialRanges[i]!;
      if(!Object.is(a.slot,e.slot)||!Object.is(a.startIndex,e.startIndex)||!Object.is(a.indexCount,e.indexCount)){reject();}
    }
    yield "meshCompareRanges";
  }
}
