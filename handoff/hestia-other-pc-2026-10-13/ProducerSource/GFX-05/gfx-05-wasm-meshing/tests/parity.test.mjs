import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ScalarMesher,tsProducts,validateCoverage,validateProducts} from "../dist/adapter.mjs";
import {fixture,bindFixture} from "../src/fixtures.mjs";
import {meshHvpOccupancy,hvpVertexAo,hvpPackAoSignature,hvpUnpackAoSignature,hvpFaceAoSamples} from "../dist/oracle.mjs";
import {occupancy,budgets} from "../src/fixtures.mjs";
const wasm=new Uint8Array(readFileSync(new URL("../dist/scalar.wasm",import.meta.url)));
const binding=JSON.parse(readFileSync(new URL("../build-binding.json",import.meta.url)));
const sha=binding.files.find(x=>x.path==="dist/scalar.wasm").sha256;
for(const name of ["empty","full","full-halo","bounded-checker","cave","thin","materials","seam","ao"])for(const scale of [.125,.25,.5]){
  test(`exact TS/WASM and independent coverage ${name} ${scale}`,async()=>{
    const input=fixture(name,scale),adapter=await ScalarMesher.create(wasm,sha);
    try{
      const expected=tsProducts(input),actual=await adapter.run(input);
      assert.deepEqual(actual.products,expected);validateProducts(input,actual.products);
      assert.deepEqual(await adapter.adopt(actual,input),expected);
      if(name==="bounded-checker")assert.ok(actual.products.render.indices instanceof Uint32Array);
      if(name==="full")assert.ok(actual.products.render.indices instanceof Uint16Array);
    }finally{adapter.dispose();}
  });
}
for(const purpose of ["collision","render-and-collision"])for(const physicalHalo of ["closed-exterior","east","west"]){
  test(`purpose parity ${purpose} ${physicalHalo}`,async()=>{
    const p=bindFixture({...fixture("seam",.5),purpose,physicalHalo,coreOrigin:[224,0,0]}),a=await ScalarMesher.create(wasm,sha);
    try{assert.deepEqual((await a.run(p)).products,tsProducts(p));}finally{a.dispose();}
  });
}
test("historical full checker BudgetExceeded remains on both controls",async()=>{
  const p=fixture("checker"),a=await ScalarMesher.create(wasm,sha);
  try{assert.throws(()=>tsProducts(p),/BudgetExceeded/);await assert.rejects(a.run(p),/BudgetExceeded/);
    assert.equal((await a.run(fixture("empty"))).products.render.faceCount,0);
  }finally{a.dispose();}
});
test("AO truth table, all signatures and Lab face sample bridge preserved",()=>{
  for(let bits=0;bits<8;bits++){
    const one=!!(bits&1),two=!!(bits&2),c=!!(bits&4);
    assert.equal(hvpVertexAo(one,two,c),one&&two?0:3-Number(one)-Number(two)-Number(c));
  }
  for(let s=0;s<256;s++)assert.equal(hvpPackAoSignature(hvpUnpackAoSignature(s)),s);
  assert.deepEqual(hvpFaceAoSamples(15,15,15,0,0).corner,[14,14,14]);
  assert.deepEqual(hvpFaceAoSamples(15,15,15,1,0).corner,[16,14,14]);
});
test("independent oracle rejects coverage/material/AO/winding mutations",()=>{
  const p=fixture("ao"),m=meshHvpOccupancy(occupancy(p),budgets,p.sourceDigest,"hvp-terrain-chunk-v1",{ao:true});
  const copy=()=>structuredClone(m);
  let bad=copy();bad.indices[0]=bad.indices[2];assert.throws(()=>validateCoverage(p,bad),/Inward/);
  bad=copy();bad.colors[0]=.5;assert.throws(()=>validateCoverage(p,bad),/AO/);
  bad=copy();bad.materialRanges[0].slot=4;assert.throws(()=>validateCoverage(p,bad),/surface/);
  bad=copy();bad.unitFaceCount++;assert.throws(()=>validateCoverage(p,bad),/channels|coverage/);
  bad=copy();bad.positions[0]+=.0625;assert.throws(()=>validateCoverage(p,bad),/Off-grid/);
  bad=copy();bad.indices=new Uint32Array(bad.indices);assert.throws(()=>validateCoverage(p,bad),/channels/);
  bad=copy();bad.outerFaceCount++;assert.throws(()=>validateCoverage(p,bad),/channels/);
});
