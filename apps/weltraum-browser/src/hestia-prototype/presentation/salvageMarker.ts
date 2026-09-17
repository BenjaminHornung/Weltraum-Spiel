import {BoxGeometry} from "three";
import {fnv1aHash} from "../../core/hash";
import type {HvpCompactMesh} from "../../hvp/hvpCoastMesher";
import {HVP_SALVAGE_CELLS,HVP_SALVAGE_ZONE} from "../physics/profile";

export const HVP_SALVAGE_MARKER_KEY="hvp:salvage:zone";
export const HVP_SALVAGE_LINK_KEY="hvp:salvage:link";
/** Local-space wire highlight follows the actual anchored body, never moves it. */
export const createHvpSalvageLink=():HvpCompactMesh=>{
  const center=["x","y","z"].map(a=>HVP_SALVAGE_CELLS.reduce((n,c)=>n+(c[a as "x"|"y"|"z"]+.5)*.125,0)/HVP_SALVAGE_CELLS.length);
  const box=new BoxGeometry(.14,.14,.14),offset=[.1875-center[0]!,.9375-center[1]!,.0625-center[2]!];
  try{const p=box.getAttribute("position"),positions=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i+=1){positions[i*3]=p.getX(i)+offset[0]!;positions[i*3+1]=p.getY(i)+offset[1]!;positions[i*3+2]=p.getZ(i)+offset[2]!;}
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=1){lo[i%3]=Math.min(lo[i%3]!,positions[i]!);hi[i%3]=Math.max(hi[i%3]!,positions[i]!);}
    return {faceCount:6,unitFaceCount:6,outerFaceCount:6,cavityFaceCount:0,positions,normals:new Float32Array(box.getAttribute("normal").array),indices:new Uint16Array(box.index!.array),colors:null,
      materialRanges:[{slot:1,startIndex:0,indexCount:36}],boundsMeters:{min:{x:lo[0]!,y:lo[1]!,z:lo[2]!},max:{x:hi[0]!,y:hi[1]!,z:hi[2]!}},
      sourceDigest:"hvp-salvage-link-v1",algorithmVersion:"hvp-salvage-link-v1",tempEstimateBytes:2048};
  }finally{box.dispose();}
};
/** Ground marking only: no hidden floor, collider, mass or objective authority. */
export const createHvpSalvageMarker=(groundY:number):HvpCompactMesh=>{
  if(!Number.isFinite(groundY)){throw new Error("Invalid salvage marker height");}
  const z=HVP_SALVAGE_ZONE,w=z.maxX-z.minX,d=z.maxZ-z.minZ,x=(z.minX+z.maxX)/2,cz=(z.minZ+z.maxZ)/2;
  const positions:number[]=[],normals:number[]=[],indices:number[]=[];
  for(const [sx,sz,px,pz] of [[w,.03,x,z.minZ],[w,.03,x,z.maxZ],[.03,d,z.minX,cz],[.03,d,z.maxX,cz]]){
    const box=new BoxGeometry(sx,.03,sz);
    try{const p=box.getAttribute("position"),n=box.getAttribute("normal"),base=positions.length/3;
      for(let i=0;i<p.count;i+=1){positions.push(p.getX(i)+px!,p.getY(i)+groundY+.025,p.getZ(i)+pz!);normals.push(n.getX(i),n.getY(i),n.getZ(i));}
      for(const i of box.index!.array){indices.push(base+i);}
    }finally{box.dispose();}
  }
  const vertices=new Float32Array(positions),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<vertices.length;i+=1){lo[i%3]=Math.min(lo[i%3]!,vertices[i]!);hi[i%3]=Math.max(hi[i%3]!,vertices[i]!);}
  return {faceCount:24,unitFaceCount:24,outerFaceCount:24,cavityFaceCount:0,positions:vertices,normals:new Float32Array(normals),
    indices:new Uint16Array(indices),colors:null,materialRanges:[{slot:1,startIndex:0,indexCount:indices.length}],
    boundsMeters:{min:{x:lo[0]!,y:lo[1]!,z:lo[2]!},max:{x:hi[0]!,y:hi[1]!,z:hi[2]!}},
    sourceDigest:fnv1aHash(JSON.stringify([z,groundY])),algorithmVersion:"hvp-salvage-marker-v1",tempEstimateBytes:(positions.length+normals.length+indices.length)*8};
};
