/** Private Worker layout only; v1 Save retains its exact ordered collision digest. */
export interface HvpChunkStaticLayout {
  readonly version:"hvp-static-chunks-v1";
  readonly primaryTerrainCount:256;
  readonly neighborTerrainCount:256;
}
export const validateHvpChunkStaticLayout=(value:unknown):HvpChunkStaticLayout=>{
  const p=value as HvpChunkStaticLayout|null;
  if(!p||typeof p!=="object"||Object.keys(p).sort().join(",")!=="neighborTerrainCount,primaryTerrainCount,version"
    ||p.version!=="hvp-static-chunks-v1"||p.primaryTerrainCount!==256||p.neighborTerrainCount!==256){throw new Error("Invalid private static terrain layout");}
  return Object.freeze({version:p.version,primaryTerrainCount:256,neighborTerrainCount:256});
};
import type {HvpCollisionSector} from "./terrainColliders";
import {validateHvpChunkBuffers} from "../../workers/hvpChunkJob";

export function* validateHvpChunkCollisionSteps(mesh:HvpCollisionSector,index:number):Generator<string,void,unknown>{
  if(!Number.isSafeInteger(index)||index<0||index>=256||!(mesh.vertices instanceof Float32Array)||!(mesh.indices instanceof Uint32Array)
    ||mesh.vertices.length%3||mesh.indices.length%3){throw new Error("Invalid primary chunk coverage");}
  validateHvpChunkBuffers([mesh.vertices.buffer as ArrayBuffer,mesh.indices.buffer as ArrayBuffer]);
  const min=[-16+index%8*4,-8+Math.floor(index/8)%4*4,-16+Math.floor(index/32)*4],max=min.map(n=>n+4);
  for(let i=0;i<mesh.vertices.length;i+=1){const n=mesh.vertices[i]!;
    if(!Number.isFinite(n)||!Number.isInteger(n*8)||n<min[i%3]!||n>max[i%3]!){throw new Error("Primary chunk bounds do not match XYZ coverage");}
    if((i+1)%4096===0){yield "nativeChunkBounds";}}
  for(let i=0;i<mesh.indices.length;i+=1){if(mesh.indices[i]!>=mesh.vertices.length/3){throw new Error("Invalid primary chunk geometry");}
    if((i+1)%4096===0){yield "nativeChunkIndices";}}
  yield "nativeChunkCoverage";
}
