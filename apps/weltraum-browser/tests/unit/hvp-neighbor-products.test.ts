import {beforeAll,expect,it} from "vitest";
import {materializeHvpCoastSource,prepareHvpCoastSource,deriveHvpWaterMask} from "../../src/hvp/hvpCoastSource";
import {meshHvpFarField,meshHvpJoinRing,meshHvpWaterMask,type HvpCompactMesh} from "../../src/hvp/hvpCoastMesher";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {createHvpEastRegion} from "../../src/hestia-prototype/runtime/regionSource";
import {buildHvpNeighborProducts,type HvpNeighborProxies} from "../../src/hestia-prototype/runtime/neighborProducts";
import {encodeHvpProjectionPacket,decodeHvpProjectionPacket} from "../../src/hestia-prototype/runtime/projectionPacket";

let primary:ReturnType<typeof createHvpTerrainRoot>,east:ReturnType<typeof createHvpTerrainRoot>,proxies:HvpNeighborProxies;
beforeAll(async()=>{
  const source=prepareHvpCoastSource(materializeHvpCoastSource());primary=createHvpTerrainRoot(source,"primary",0);
  east=createHvpTerrainRoot(await createHvpEastRegion(),"east",0);
  proxies={join:meshHvpJoinRing(source),far:meshHvpFarField(source),water:meshHvpWaterMask(deriveHvpWaterMask(source))};
},120_000);
// Independent indexed-face readback; no projection sampling helpers.
const quads=(meshes:readonly HvpCompactMesh[])=>meshes.flatMap(mesh=>{
  const result:{lo:number[];hi:number[];normal:number[]}[]=[];
  for(let i=0;i<mesh.indices.length;i+=6){
    const ids=[...new Set(mesh.indices.slice(i,i+6))];expect(ids).toHaveLength(4);
    const axes=[0,1,2].map(a=>ids.map(id=>mesh.positions[id*3+a]!));
    result.push({lo:axes.map(a=>Math.min(...a)),hi:axes.map(a=>Math.max(...a)),normal:[0,1,2].map(a=>mesh.normals[ids[0]!*3+a]!)});
  }return result;
});
const tops=(meshes:readonly HvpCompactMesh[])=>{
  const counts=new Uint16Array(272*272),heights=new Float32Array(counts.length);
  for(const q of quads(meshes)){if(q.normal[1]!==1){continue;}
    for(let x=Math.max(0,Math.ceil((q.lo[0]!-15)*8-.5));x<Math.min(272,(q.hi[0]!-15)*8-.5);x+=1){
      for(let z=Math.max(0,Math.ceil((q.lo[2]!+17)*8-.5));z<Math.min(272,(q.hi[2]!+17)*8-.5);z+=1){counts[x+z*272]!+=1;heights[x+z*272]=q.lo[1]!;}
    }
  }return {counts,heights};
};
it.each([.125,.5] as const)("partitions installed land/water and fine/coarse seam spans for LOD %s",lod=>{
  const digest=east.read().sourceDigest,result=buildHvpNeighborProducts(primary.read(),east.read(),lod,proxies);
  const land=tops([...result.region,result.join,result.far]),water=tops([result.waterPatch,result.water]);
  let wrong=0;
  for(let x=0;x<272;x+=1){for(let z=0;z<272;z+=1){
    const wx=15+(x+.5)/8,wz=-17+(z+.5)/8,i=x+z*272;
    if(wx<16&&wz>=-16&&wz<16){expect(land.counts[i]).toBe(0);continue;}
    if(land.counts[i]!==1||water.counts[i]!==Number(land.heights[i]!<0)){wrong+=1;}
  }}
  expect(wrong).toBe(0);expect(east.read().sourceDigest).toBe(digest);
  for(const plane of [20,20.5,48]){
    const positive=new Uint8Array(256*128),negative=new Uint8Array(positive.length);
    for(const q of quads(result.region)){
      if(Math.abs(q.normal[0]!)!==1||q.lo[0]!==plane||q.hi[0]!==plane){continue;}
      const counts=q.normal[0]===1?positive:negative;
      for(let z=Math.max(0,(q.lo[2]!+16)*8);z<Math.min(256,(q.hi[2]!+16)*8);z+=1){
        for(let y=Math.max(0,(q.lo[1]!+8)*8);y<Math.min(128,(q.hi[1]!+8)*8);y+=1){counts[z*128+y]!+=1;}
      }
    }
    let bad=0;
    for(let z=0;z<256;z+=1){const row=z+8,left=(plane-15)*8-1,right=left+1;
      const a=land.heights[left+row*272]!,b=land.heights[right+row*272]!;
      for(let y=0;y<128;y+=1){const h=-8+(y+.5)/8,index=z*128+y;
        if(positive[index]!==Number(h<a&&h>=b)||negative[index]!==Number(h<b&&h>=a)){bad+=1;}
      }
    }expect(bad,`hidden, duplicate or missing spans at x=${plane}`).toBe(0);
  }
  const meshes=[...result.region,result.waterPatch,result.join,result.far,result.water],packet=encodeHvpProjectionPacket(meshes),decoded=decodeHvpProjectionPacket(packet,result.digest);
  expect(decoded.map(m=>m.indices.length)).toEqual(meshes.map(m=>m.indices.length));
  decoded.forEach((m,i)=>{expect(m.positions).toEqual(meshes[i]!.positions);expect(m.colors).toEqual(meshes[i]!.colors);});
  const broken=packet.slice(0),header=new Uint32Array(broken);header[11]=0;
  expect(()=>decodeHvpProjectionPacket(broken,result.digest)).toThrow(/offset/);
  console.info("HVP13 composite projection",{lod,triangles:meshes.reduce((n,m)=>n+m.indices.length/3,0),packetBytes:packet.byteLength});
},120_000);
