import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ScalarMesher,selectKernel,tsProducts} from "../dist/adapter.mjs";
import {fixture,bindFixture} from "../src/fixtures.mjs";
const bytes=new Uint8Array(readFileSync(new URL("../dist/scalar.wasm",import.meta.url)));
const sha=JSON.parse(readFileSync(new URL("../build-binding.json",import.meta.url))).files.find(x=>x.path==="dist/scalar.wasm").sha256;
const create=()=>ScalarMesher.create(bytes,sha);
test("input ABI rejects missing coverage, material, size, scale, identity, shared memory",async()=>{
  const a=await create();
  try{
    for(const change of [{coverage:"UNKNOWN"},{slots:new Uint8Array(10)},{cellMeters:.2},{generation:-1},{origin:[NaN,0,0]},{purpose:"anything"},{coreOrigin:[1,0,0]},{sourceDigest:""}])
      await assert.rejects(a.run({...fixture("empty"),...change}),/Invalid/);
    const p=fixture("empty");p.slots[0]=255;await assert.rejects(a.run(p),/Invalid/);
    await assert.rejects(a.run({...fixture("empty"),slots:new Uint8Array(new SharedArrayBuffer(34**3))}),/Invalid/);
  }finally{a.dispose();}
});
test("raw WASM ABI invalid material and actual allocator failure are controlled",async()=>{
  const {instance}=await WebAssembly.instantiate(bytes),e=instance.exports,ptr=e.input_ptr();
  new Uint8Array(e.memory.buffer,ptr,34**3)[0]=255;
  assert.equal(e.run(.125,0,0,0,1,16*1024*1024),1);assert.equal(e.count(0),0);
  assert.equal(e.allocation_probe(100*1024*1024),3);
  assert.throws(()=>e.memory.grow(1024),RangeError);e.release();
});
test("allocation cap failure leaves no stale output and recovery works",async()=>{
  const a=await create();
  try{await assert.rejects(a.run(fixture("full"),undefined,0),/Allocation/);
    assert.deepEqual((await a.run(fixture("ao"))).products,tsProducts(fixture("ao")));
  }finally{a.dispose();}
});
test("single invocation, cancel, invalidate and dispose before adoption",async()=>{
  const a=await create(),p=fixture("full");
  try{
    const first=a.run(p);await assert.rejects(a.run(p),/already active/);await first;
    const controller=new AbortController();controller.abort();await assert.rejects(a.run(p,controller.signal),/Cancelled/);
    const pending=a.run(p);a.invalidate();await assert.rejects(pending,/Cancelled/);
    const c=await a.run(p);a.invalidate();await assert.rejects(a.adopt(c,p),/Stale/);
    const last=a.run(p);a.dispose();await assert.rejects(last,/Cancelled/);
    await assert.rejects(a.run(p),/Disposed/);assert.equal(a.memoryBytes(),0);
  }finally{a.dispose();}
});
test("stale source/generation/purpose, mutated outputs and concurrent adoption mutation reject",async()=>{
  const a=await create(),p=fixture("full");
  try{
    const c=await a.run(p);
    for(const change of [{generation:2},{purpose:"render-and-collision"},{sourceDigest:"other"},{physicalHalo:"east"},{cellMeters:.5}])
      await assert.rejects(a.adopt(c,bindFixture({...p,...change})),/Stale/);
    const pending=a.adopt(c,p);p.sourceDigest="changed";await assert.rejects(pending,/Stale/);
    p.sourceDigest="fixture:full:0.125";c.products.render.colors[0]=0;await assert.rejects(a.adopt(c,p),/AO/);
  }finally{a.dispose();}
});
test("owned copies survive heap growth/reuse and caller mutation",async()=>{
  const a=await create(),p=fixture("ao");
  try{
    const pending=a.run(p);p.slots.fill(0);const small=await pending;
    assert.equal(small.products.render.faceCount>0,true);
    const saved=structuredClone(small.products),before=a.memoryBytes();
    await a.run(fixture("bounded-checker"));assert.ok(a.memoryBytes()>before);
    assert.deepEqual(small.products,saved);
    const full=await a.run(fixture("full"));await a.adopt(full,fixture("full"));
    const next=await a.run(fixture("thin"));assert.equal(next.memory.previousGenerationBytes,full.memory.candidateBytes);
    assert.ok(next.memory.overlapLogicalBytes>next.memory.candidateBytes);
  }finally{a.dispose();}
});
test("missing SIMD has an explicit scalar policy and wrong artifact digest rejects",async()=>{
  assert.equal(selectKernel(false,"scalar"),"scalar");
  assert.throws(()=>selectKernel(false,"simd"),/unsupported/);
  assert.equal(selectKernel(false,"simd",true),"scalar");
  await assert.rejects(ScalarMesher.create(bytes,"0".repeat(64)),/digest/);
});
