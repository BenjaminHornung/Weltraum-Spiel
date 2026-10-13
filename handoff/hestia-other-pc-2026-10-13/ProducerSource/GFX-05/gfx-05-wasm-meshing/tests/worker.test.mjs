import test from "node:test";
import assert from "node:assert/strict";
import {createProfileWorker,runProfileJob} from "../scripts/profile.mjs";
import {fixture} from "../src/fixtures.mjs";
import {tsProducts} from "../dist/adapter.mjs";
import {savedFixture} from "../src/saved-fixture.mjs";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
test("one real transferable worker at a time; TS and WASM output/identity parity",async()=>{
  const saved=savedFixture(),inputs=[fixture("full"),fixture("materials",.25),fixture("seam"),saved,
    {...saved,purpose:"collision"},{...saved,purpose:"render-and-collision"}];
  for(const variant of ["ts","scalar"]){
    const handle=await createProfileWorker(variant);
    try{
      for(const input of inputs){
        const result=await runProfileJob(handle,input);
        assert.deepEqual(result.products,tsProducts(input));assert.equal(result.transferredInputDetached,true);
        assert.equal(input.slots.byteLength,34**3);
        for(const [phase,value] of Object.entries(result.costs))assert.ok(Number.isFinite(value)&&value>=0,`cost ${phase} must be a real nonnegative reading`);
      }
    }finally{await handle.worker.terminate();}
  }
});
test("finite profile refuses missing measurement authority before jobs; declared bound matches loop",()=>{
  const profile=JSON.parse(readFileSync(new URL("../runner-profile.json",import.meta.url)));
  assert.equal(profile.maxMeasuredJobs,profile.variantOrder.length*profile.workloads.length*(profile.warmCount+profile.dirtyCount));
  assert.throws(()=>execFileSync(process.execPath,["scripts/profile.mjs"],{stdio:"pipe"}),error=>error.status===1&&error.stderr.toString().includes("NOT_RUN: explicit A0"));
});
