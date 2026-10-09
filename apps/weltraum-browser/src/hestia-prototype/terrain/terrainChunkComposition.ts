import type {HvpCompactMesh,HvpCompactMaterialRange} from "../../hvp/hvpCoastMesher";
import {HVP_TERRAIN_MAX_OUTPUT} from "../../workers/hvpTerrainJob";
import {structuralFreezeArraySteps,type StructuralOwnedReserve} from "../../voxel/structural/validation";
import type {HvpTerrainSnapshot} from "./cutPlan";
import {hvpChunkCoordinates} from "./terrainChunkInput";

const NativeFloat32Array=Float32Array,NativeUint32Array=Uint32Array;
/** Owner-internal: compiler keeps decoded chunk channels private; only these independent columns escape. */
export function* composeHvpTerrainColumnSteps(chunks:ReadonlyMap<number,HvpCompactMesh>,
  source:Pick<HvpTerrainSnapshot,"originMeters"|"sourceDigest">,column:number,reserve:StructuralOwnedReserve):Generator<string,HvpCompactMesh,unknown>{
  if(!Number.isSafeInteger(column)||column<0||column>=16){throw new Error("Invalid terrain column");}
  reserve(8192);const parts:HvpCompactMesh[]=[],cx=column%4*2,cz=Math.floor(column/4)*2;
  let vertices=0,indicesCount=0,rangesCount=0,faceCount=0,unitFaceCount=0,outerFaceCount=0,cavityFaceCount=0;
  for(let z=cz;z<cz+2;z+=1){for(let y=0;y<4;y+=1){for(let x=cx;x<cx+2;x+=1){
    const id=x+y*8+z*32,part=chunks.get(id),c=hvpChunkCoordinates(id);
    const min={x:source.originMeters.x+c[0]*4,y:source.originMeters.y+c[1]*4,z:source.originMeters.z+c[2]*4};
    if(part===undefined||part.algorithmVersion!=="hvp-terrain-chunk-v1"
      ||part.boundsMeters.min.x!==min.x||part.boundsMeters.min.y!==min.y||part.boundsMeters.min.z!==min.z
      ||part.boundsMeters.max.x!==min.x+4||part.boundsMeters.max.y!==min.y+4||part.boundsMeters.max.z!==min.z+4){throw new Error("Incomplete terrain chunk column coverage");}
    if(part.positions.length!==part.faceCount*12||part.indices.length!==part.faceCount*6||part.normals.length!==part.positions.length
      ||part.colors?.length!==part.positions.length||![part.faceCount,part.unitFaceCount,part.outerFaceCount,part.cavityFaceCount].every(n=>Number.isSafeInteger(n)&&n>=0)){
      throw new Error("Invalid decoded terrain column geometry");}
    parts.push(part);vertices+=part.positions.length;indicesCount+=part.indices.length;rangesCount+=part.materialRanges.length;
    faceCount+=part.faceCount;unitFaceCount+=part.unitFaceCount;outerFaceCount+=part.outerFaceCount;cavityFaceCount+=part.cavityFaceCount;
    yield "chunkColumnMetadata";
  }}}
  const bytes=vertices*12+indicesCount*4;
  if(!Number.isSafeInteger(bytes)||bytes>HVP_TERRAIN_MAX_OUTPUT){throw new Error("Terrain column output BudgetExceeded");}
  reserve(8192+bytes+rangesCount*320,true);
  const positions=new NativeFloat32Array(vertices),normals=new NativeFloat32Array(vertices),colors=new NativeFloat32Array(vertices),indices=new NativeUint32Array(indicesCount);
  const ranges:HvpCompactMaterialRange[]=[];let vertexOffset=0,indexOffset=0,work=0;
  for(const part of parts){
    for(let i=0;i<part.positions.length;i+=1){positions[vertexOffset+i]=part.positions[i]!;normals[vertexOffset+i]=part.normals[i]!;colors[vertexOffset+i]=part.colors![i]!;
      if(++work===1024){work=0;yield "chunkColumnVertices";}}
    for(let i=0;i<part.indices.length;i+=1){indices[indexOffset+i]=part.indices[i]!+vertexOffset/3;
      if(++work===1024){work=0;yield "chunkColumnIndices";}}
    let cursor=0;
    for(const range of part.materialRanges){
      if(range.startIndex!==cursor||range.indexCount<=0||range.indexCount%6||range.slot<1||range.slot>4){throw new Error("Invalid column material coverage");}
      const last=ranges.at(-1);
      if(last?.slot===range.slot){ranges[ranges.length-1]=Object.freeze({...last,indexCount:last.indexCount+range.indexCount});}
      else{ranges.push(Object.freeze({slot:range.slot,startIndex:indexOffset+range.startIndex,indexCount:range.indexCount}));}
      cursor+=range.indexCount;if(++work===1024){work=0;yield "chunkColumnRanges";}
    }
    if(cursor!==part.indices.length){throw new Error("Incomplete column material coverage");}
    vertexOffset+=part.positions.length;indexOffset+=part.indices.length;
  }
  const min={x:source.originMeters.x+cx*4,y:source.originMeters.y,z:source.originMeters.z+cz*4};
  const freeze=structuralFreezeArraySteps(ranges,reserve);let materialRanges:readonly HvpCompactMaterialRange[];
  try{for(;;){const step=freeze.next();if(step.done){materialRanges=step.value;break;}yield "chunkColumnFreeze";}}
  finally{freeze.return(undefined as never);}
  return {positions,normals,colors,indices,materialRanges,faceCount,unitFaceCount,outerFaceCount,cavityFaceCount,
    sourceDigest:source.sourceDigest,algorithmVersion:"hvp-terrain-column-v1",boundsMeters:{min,max:{x:min.x+8,y:min.y+16,z:min.z+8}},tempEstimateBytes:0};
}
