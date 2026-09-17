import {beforeAll,expect,it} from "vitest";
import {materializeHvpCoastSource,readHvpSourceColumnWorld} from "../../src/hvp/hvpCoastSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {createHvpEastRegion,restoreHvpEastRegion,meshHvpRegionLod} from "../../src/hestia-prototype/runtime/regionSource";
import {createHvpRegionResidency,hvpRegionContentKey} from "../../src/hestia-prototype/runtime/residency";
import {canonicalizeContentKey} from "../../src/streaming/contentKey";
import {clipHvpProjection,meshHvpOccupancy,meshHvpWaterPatch} from "../../src/hvp/hvpCoastMesher";

let east:Awaited<ReturnType<typeof createHvpEastRegion>>;
it("removes overlapping proxy surfaces without altering canonical inputs or inventing collision walls",()=>{
  const mesh=meshHvpOccupancy({sizeX:16,sizeY:4,sizeZ:16,cellMeters:.125,originMeters:{x:14,y:0,z:-1},slotAt:()=>1},undefined,"source","fixture",{ao:true});
  const before=Array.from(mesh.positions),clipped=clipHvpProjection(mesh,{minX:15,maxX:49,minZ:-17,maxZ:17},"replacement");
  let topArea=0;
  for(let f=0;f<clipped.faceCount;f+=1){
    const base=f*12,normal=Array.from(clipped.normals.subarray(base,base+3)),center=[0,0,0];
    for(let v=0;v<4;v+=1){for(let a=0;a<3;a+=1){center[a]!+=clipped.positions[base+v*3+a]!/4;}}
    expect(center[0]!-normal[0]!*.0625).toBeLessThan(15);
    if(normal[1]===1){const xs=[0,1,2,3].map(v=>clipped.positions[base+v*3]!),zs=[0,1,2,3].map(v=>clipped.positions[base+v*3+2]!);
      topArea+=(Math.max(...xs)-Math.min(...xs))*(Math.max(...zs)-Math.min(...zs));}
  }
  expect(topArea).toBe(2);expect(clipped.faceCount).toBe(5);expect(Array.from(mesh.positions)).toEqual(before);
  expect(clipped.colors?.every(v=>v===1)).toBe(true);
});
it("emits a top-only water replacement with exact coverage and outward winding",()=>{
  const mask=new Uint8Array(16);for(const i of [0,1,4,5]){mask[i]=1;}
  const mesh=meshHvpWaterPatch(mask,4,4,.125,{x:16,z:-16},"water");
  expect(mesh.faceCount).toBe(1);expect(mesh.boundsMeters).toEqual({min:{x:16,y:0,z:-16},max:{x:16.25,y:0,z:-15.75}});
  for(let i=0;i<mesh.indices.length;i+=3){const a=mesh.indices[i]!*3,b=mesh.indices[i+1]!*3,c=mesh.indices[i+2]!*3;
    const ux=mesh.positions[b]!-mesh.positions[a]!,uz=mesh.positions[b+2]!-mesh.positions[a+2]!;
    const vx=mesh.positions[c]!-mesh.positions[a]!,vz=mesh.positions[c+2]!-mesh.positions[a+2]!;
    expect(uz*vx-ux*vz).toBeGreaterThan(0);
  }
  expect(mesh.normals.filter((_,i)=>i%3===1).every(y=>y===1)).toBe(true);
  expect(()=>meshHvpWaterPatch(new Uint8Array(16).fill(2),4,4,.125,{x:16,z:-16},"bad")).toThrow(/cell/);
});
beforeAll(async()=>{east=await createHvpEastRegion();},120_000);
it("uses global source coordinates and material bands on both sides of the region boundary",async()=>{
  const primary=materializeHvpCoastSource(),again=await createHvpEastRegion();
  expect(again.sourceDigest).toBe(east.sourceDigest);
  let localNoiseMismatches=0;
  for(const [source,ox] of [[primary,-16],[east,16]] as const){
    for(const x of [0,1,254,255]){for(let z=0;z<256;z+=7){
      const column=readHvpSourceColumnWorld(ox+(x+.5)*.125,-16+(z+.5)*.125);
      const top=Math.max(0,Math.min(128,Math.floor((column.topMeters+8)/.125+1e-6)));
      for(let y=0;y<128;y+=1){
        const expected=y>=top?0:y===top-1?column.slot:y===top-2&&column.topMeters<0&&column.slot===2?2:1;
        expect(source.readSlot(x,y,z)).toBe(expected);
        if(source===east&&source.readSlot(x,y,z)!==primary.readSlot(x,y,z)){localNoiseMismatches+=1;}
      }
    }}
  }
  expect(localNoiseMismatches).toBeGreaterThan(0);
},120_000);
it("binds every semantic input instead of caching only a spatial address",()=>{
  const input={region:"east" as const,seed:"seed",generator:"g1",materials:"m1",source:"a1234567",revision:0,neighbours:"n1",lod:.125 as const};
  const key=canonicalizeContentKey(hvpRegionContentKey(input));
  expect(canonicalizeContentKey(hvpRegionContentKey({...input}))).toBe(key);
  for(const change of [{seed:"s2"},{generator:"g2"},{materials:"m2"},{source:"b1234567"},{revision:1},{neighbours:"n2"},{lod:.5 as const}]){
    expect(canonicalizeContentKey(hvpRegionContentKey({...input,...change}))).not.toBe(key);
  }
});
it("changes only projection for LOD and restores edited neighbour cells from its checkpoint",()=>{
  const root=createHvpTerrainRoot(east,"east",0);
  let y=127;while(root.read().readSlot(80,y,80)===0){y-=1;}
  root.commit(root.prepare({sessionId:"east",epoch:0,revision:0,sourceDigest:root.read().sourceDigest,commandId:"edit",toolPolicy:"hvp-plasma-v1",
    shape:{kind:"Box",min:[80,y,80],max:[81,y+1,81]}}));
  const saved=root.checkpoint(),before=root.read().sourceDigest;
  const fine=meshHvpRegionLod(root.read(),.125),far=meshHvpRegionLod(root.read(),.5);
  expect(fine.positions).not.toEqual(far.positions);expect(fine.algorithmVersion).not.toBe(far.algorithmVersion);
  expect(root.read().sourceDigest).toBe(before);expect(root.checkpoint()).toEqual(saved);
  const restored=restoreHvpEastRegion(JSON.parse(JSON.stringify(saved)));
  expect(restored.read().sourceDigest).toBe(before);expect(restored.read().readSlot(80,y,80)).toBe(0);
  const bad=JSON.parse(JSON.stringify(saved));bad.base.runs[0]=4;
  expect(()=>restoreHvpEastRegion(bad)).toThrow(/digest|material/);
  console.info("HVP13 east projections",{fineTriangles:fine.indices.length/3,coarseTriangles:far.indices.length/3,
    fineMeshBytes:fine.positions.byteLength+fine.normals.byteLength+fine.indices.byteLength+(fine.colors?.byteLength??0)});
},120_000);
it("holds coverage until complete and rejects cancelled/recreated tickets before adoption",()=>{
  const state=createHvpRegionResidency();expect(state.update(0)).toBeUndefined();
  expect(state.update(10)).toBe("Load");const old=state.begin("key-a");
  expect(state.read().collisionReady).toBe(false);
  expect(()=>state.accept(old,{source:"key-a",render:"key-a",collision:"missing"})).toThrow(/binding/);
  state.update(3);expect(state.accept(old,{source:"key-a",render:"key-a",collision:"key-a"})).toBe(false);
  state.update(11);const current=state.begin("key-a");expect(current.epoch).toBeGreaterThan(old.epoch);
  expect(state.accept(current,{source:"key-a",render:"key-a",collision:"key-a"})).toBe(true);
  expect(state.read().collisionReady).toBe(true);
  for(let i=0;i<200;i+=1){state.update(9+(i%2));}
  expect(state.read().transitions).toBeLessThan(10);
  state.update(0,true);expect(state.read().wanted).toBe(true);
  state.update(0);expect(()=>state.evict(false)).toThrow(/checkpoint/);
  state.evict(true);expect(state.read().collisionReady).toBe(false);
  expect(state.accept(current,{source:"key-a",render:"key-a",collision:"key-a"})).toBe(false);
});
