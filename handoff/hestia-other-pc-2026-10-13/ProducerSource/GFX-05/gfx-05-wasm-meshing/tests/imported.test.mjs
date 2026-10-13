import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ScalarMesher,tsProducts} from "../dist/adapter.mjs";
import {savedFixture,rtFixture} from "../src/saved-fixture.mjs";
const bytes=new Uint8Array(readFileSync(new URL("../dist/scalar.wasm",import.meta.url)));
const sha=JSON.parse(readFileSync(new URL("../build-binding.json",import.meta.url))).files.find(x=>x.path==="dist/scalar.wasm").sha256;
test("actual digest-bound saved source restores through original r33 checkpoint and chunk input",async()=>{
  const p=savedFixture(),a=await ScalarMesher.create(bytes,sha);
  try{
    assert.equal(p.physicalHalo,"east");assert.deepEqual(p.coreOrigin,[224,64,128]);assert.ok(p.slots.some(v=>v>0));
    for(const purpose of ["render","collision","render-and-collision"]){
      const input={...p,purpose};assert.deepEqual((await a.run(input)).products,tsProducts(input));
    }
  }finally{a.dispose();}
});
test("RT-01 frozen analytical fixture embeds only its declared KnownEmpty exterior",async()=>{
  const p=rtFixture(),a=await ScalarMesher.create(bytes,sha);
  try{assert.deepEqual((await a.run(p)).products,tsProducts(p));}finally{a.dispose();}
});
