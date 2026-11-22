import {matchesHvpFragmentSourceDigest,supportsCompactArchive} from "./compactFragmentIdentity";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";
import type {HvpCollisionSector} from "./terrainColliders";
import type {HvpPhysicsSnapshot} from "./physicsWorkerHost";
import {requireExactKeys,requirePlainRecord} from "../../voxel/adaptive/validation";

export type TerrainReplacements=readonly {index:number;mesh:HvpCollisionSector}[];
export type TerrainViews=Readonly<HvpPhysicsSnapshot["preparedTerrainFragments"]>;

/** Fixed amount of native validation per single-command turn. Larger work retains the sliced path. */
export function admitsCompactTerrainApply(replacements:TerrainReplacements,fragments:readonly HvpTerrainFragmentRequest[]) {
  const f=fragments[0];
  return fragments.length===1 && !!f?.compactSource && supportsCompactArchive(f.compactSource)
    && (f.cells.length===0 || f.cells.length===f.compactSource.cellCount) && !f.sourceSubset && !f.sourceRegion && f.colliderBoxes.length>0 && f.colliderBoxes.length<=64
    && replacements.length>0 && replacements.length<=8
    && replacements.reduce((n,r)=>n+r.mesh.vertices.byteLength+r.mesh.indices.byteLength,0)<=256*1024;
}

export function readTerrainSourceViews(values:unknown,requests:readonly HvpTerrainFragmentRequest[]):TerrainViews {
  if(!Array.isArray(values)||values.length!==requests.length)throw new Error("Invalid Native terrain source views");
  return Object.freeze(values.map((value,index)=>{
    const view=requirePlainRecord(value,"terrainPlan/sourceViews"),request=requests[index]!;
    requireExactKeys(view,["ownerId","sourceDigest","centerOfMass","cellCount","massKg","colliders","sourceBytes"],"terrainPlan/sourceViews");
    const center=requirePlainRecord(view.centerOfMass,"terrainPlan/sourceViews/centerOfMass");
    requireExactKeys(center,["x","y","z"],"terrainPlan/sourceViews/centerOfMass");
    const cellCount=request.compactSource?.cellCount??request.cells.length;
    if(request.cells.length>0&&request.cells.length!==cellCount || view.ownerId!==request.ownerId||!matchesHvpFragmentSourceDigest(view.sourceDigest,request)
      ||![center.x,center.y,center.z].every(v=>typeof v==="number"&&Number.isFinite(v))||view.cellCount!==cellCount
      ||typeof view.massKg!=="number"||!Number.isFinite(view.massKg)||view.massKg<=0||Math.abs(view.massKg-request.massKg)>1e-8
      ||!Number.isSafeInteger(view.colliders)||view.colliders!==request.colliderBoxes.length
      ||!Number.isSafeInteger(view.sourceBytes)||(view.sourceBytes as number)<131072||(view.sourceBytes as number)>256*1024*1024){
      throw new Error("Invalid Native terrain source view binding");
    }
    return Object.freeze({ownerId:request.ownerId,sourceDigest:view.sourceDigest,centerOfMass:Object.freeze({x:center.x as number,y:center.y as number,z:center.z as number}),
      cellCount,massKg:view.massKg,colliders:view.colliders as number,sourceBytes:view.sourceBytes as number});
  }));
}
