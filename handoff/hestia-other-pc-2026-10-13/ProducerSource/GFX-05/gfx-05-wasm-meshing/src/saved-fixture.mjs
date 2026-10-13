import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {restoreHvpTerrainRoot,buildHvpChunkInput} from "../dist/oracle.mjs";
import {fixture,index,bindFixture} from "./fixtures.mjs";
const sha=b=>createHash("sha256").update(b).digest("hex");
export function savedFixture(){
  const bytes=readFileSync(new URL("../fixtures/saved.json",import.meta.url));
  assert.equal(sha(bytes),"326b325a7c5f4027316bbe4a9f1f967666e05407620330726d538eb49d9a51a0");
  const s=JSON.parse(bytes).player.data.hestia;assert.equal(s.signature,"fnv1a32:a93a402a");
  const source=restoreHvpTerrainRoot(s.terrain).read(),neighbor=restoreHvpTerrainRoot(s.neighbor.terrain).read();
  // Real saved east seam at x=224..255, y=64..95, z=128..159, including its confirmed neighbor.
  const readHalo=(x,y,z)=>x>=256?neighbor.readSlot(x-256,y,z):source.readSlot(x,y,z);
  const {slots,payload}=buildHvpChunkInput(source,151,readHalo,"gfx05-saved-r01",source.sessionId,neighbor);
  return {...fixture("empty"),name:"saved-east-seam",slots,origin:Object.values(payload.originMeters),sourceDigest:payload.sourceDigest,
    generation:payload.generation,physicalHalo:payload.physicalHalo,coreOrigin:payload.coreOrigin,manifest:payload,originalSavedSha256:sha(bytes)};
}
export function rtFixture(){
  const bytes=readFileSync(new URL("../fixtures/rt-grid.json",import.meta.url));
  const binding=JSON.parse(readFileSync(new URL("../fixtures/import-binding.json",import.meta.url)));
  assert.equal(sha(bytes),binding.rt.sha256);
  const v=JSON.parse(bytes),p=fixture("empty");assert.equal(v.exteriorCoverage,"KnownEmpty");
  for(let z=0;z<v.size[2];z++)for(let y=0;y<v.size[1];y++)for(let x=0;x<v.size[0];x++)
    p.slots[index(x,y,z)]=v.cells[x+y*v.size[0]+z*v.size[0]*v.size[1]];
  return bindFixture({...p,name:"rt-analytical",sourceDigest:`rt01:${v.binding.sourceDigest}`,origin:[v.origin[0],-8,-16],
    originalOrigin:v.origin,originalMaterialSemantics:"RT slots are geometry labels only; analytical crop translated into the normative chunk frame, never a physical material mapping"});
}
