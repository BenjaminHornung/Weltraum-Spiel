import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ScalarMesher,tsProducts,validateCoverage} from "../dist/adapter.mjs";
import {fixture,bindFixture} from "../src/fixtures.mjs";
import {createProfileWorker,runProfileJob} from "../scripts/profile.mjs";
const bytes=new Uint8Array(readFileSync(new URL("../dist/scalar.wasm",import.meta.url)));
const sha=JSON.parse(readFileSync(new URL("../build-binding.json",import.meta.url))).files.find(x=>x.path==="dist/scalar.wasm").sha256;
test("review: cross-world/session/neighbor identity cannot adopt old candidate",async()=>{
  const a=await ScalarMesher.create(bytes,sha),p=fixture("full");
  try{
    const c=await a.run(p);
    for(const change of [{worldId:"other-world"},{sessionId:"other-session"},{epoch:1},{baseDigest:"other-base"},{haloBinding:"other-halo"},{materialDigest:"wrong"}])
      await assert.rejects(a.adopt(c,{...p,manifest:{...p.manifest,...change}}),/Stale|Invalid/);
    const neighbor=bindFixture({...fixture("seam"),physicalHalo:"east"}),nc=await a.run(neighbor);
    for(const change of [{sessionId:"changed-neighbor"},{epoch:1},{generation:2},{sourceDigest:"changed"},{baseDigest:"changed"}])
      await assert.rejects(a.adopt(nc,{...neighbor,manifest:{...neighbor.manifest,haloNeighbor:{...neighbor.manifest.haloNeighbor,...change}}}),/Stale/);
  }finally{a.dispose();}
});
test("review: a recreated adapter cannot adopt another instance's candidate",async()=>{
  const a=await ScalarMesher.create(bytes,sha),b=await ScalarMesher.create(bytes,sha),p=fixture("full");
  try{const c=await a.run(p);await assert.rejects(b.adopt(c,p),/Stale/);}finally{a.dispose();b.dispose();}
});
test("review: duplicated half quad is missing triangle coverage",()=>{
  const p=fixture("full"),m=structuredClone(tsProducts(p).render);m.indices.set(m.indices.subarray(0,3),3);
  assert.throws(()=>validateCoverage(p,m),/triangulation|coverage/);
  const flipped=structuredClone(tsProducts(p).render);flipped.indices.set([0,1,3,1,2,3],0);
  assert.throws(()=>validateCoverage(p,flipped),/AO triangulation/);
});
test("review: worker profile uses the complete offered admission path",async()=>{
  const h=await createProfileWorker("scalar");
  try{const r=await runProfileJob(h,fixture("full"));assert.equal(r.adoptionPath,"SHARED_FULL_CANDIDATE_ADMISSION");}finally{await h.worker.terminate();}
});
