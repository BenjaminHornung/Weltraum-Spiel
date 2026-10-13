import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {meshHvpOccupancy} from "../dist/oracle.mjs";
import {fixture,occupancy,budgets} from "../src/fixtures.mjs";
test("actual r33 TS empty/full control",()=>{
  const empty=fixture("empty"),full=fixture("full");
  assert.equal(meshHvpOccupancy(occupancy(empty),budgets,empty.sourceDigest,"hvp-terrain-chunk-v1",{ao:true}).faceCount,0);
  const mesh=meshHvpOccupancy(occupancy(full),budgets,full.sourceDigest,"hvp-terrain-chunk-v1",{ao:true});
  assert.equal(mesh.unitFaceCount,6*32*32);assert.equal(mesh.faceCount,6);assert.ok(mesh.colors.every(v=>v===1));
});
test("scalar WASM artifact is actually built",()=>assert.ok(WebAssembly.validate(readFileSync(new URL("../dist/scalar.wasm",import.meta.url)))));
