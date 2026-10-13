import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import R012 from "rapier012";
import R021 from "rapier021";
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const originalInstantiate=WebAssembly.instantiate;
let used=[];
WebAssembly.instantiate=function(source,...args){
  if(!(source instanceof WebAssembly.Module)){
    const bytes=ArrayBuffer.isView(source)?Buffer.from(source.buffer,source.byteOffset,source.byteLength):Buffer.from(source);
    used.push({byteLength:bytes.length,sha256:sha(bytes)});
  }
  return Reflect.apply(originalInstantiate,this,[source,...args]);
};
const results=[];
for (const [alias,R,version,wasm] of [
  ["rapier012",R012,"0.12.0","rapier_wasm3d_bg.wasm"],
  ["rapier021",R021,"0.21.0","dist/rapier_wasm3d_bg.wasm"]]) {
  const pkg=JSON.parse(fs.readFileSync("node_modules/"+alias+"/package.json","utf8"));
  assert.equal(pkg.version,version);assert.equal(pkg.license,"Apache-2.0");
  used=[];await R.init();
  const w=new R.World({x:0,y:0,z:0});
  try {
    const c=w.createCollider(R.ColliderDesc.cuboid(.125,.125,.125).setTranslation(.125,.125,.125));
    assert.equal(c.shapeType(),R.ShapeType.Cuboid);
    assert(Math.abs(c.castRay(new R.Ray({x:-1,y:.125,z:.125},{x:1,y:0,z:0}),3,true)-1)<1e-6);
    const wasmSha256=sha(fs.readFileSync("node_modules/"+alias+"/"+wasm));
    assert(used.some(b=>b.sha256===wasmSha256),"Use-time WASM bytes mismatch "+alias);
    const entry={alias,version,license:pkg.license,wasmSha256,useTimeWasm:used,nativeVersion:R.version(),box:"PASS"};
    if (version==="0.21.0") {
      for(const method of ["setVoxel","combineVoxelStates","propagateVoxelChange"]) assert.equal(typeof R.Collider.prototype[method],"function");
      const v=w.createCollider(R.ColliderDesc.voxels(new Int32Array([0,0,0]),{x:.25,y:.25,z:.25}));
      assert.equal(v.shapeType(),R.ShapeType.Voxels);
      entry.voxelRayTime=v.castRay(new R.Ray({x:-1,y:.125,z:.125},{x:1,y:0,z:0}),3,true);
      entry.voxelBounds="OBSERVED_FROM_RAY";
      entry.exports=["voxels","setVoxel","combineVoxelStates","propagateVoxelChange"];
    }
    results.push(entry);
  } finally { w.free(); }
}
fs.mkdirSync("evidence",{recursive:true});
fs.writeFileSync("evidence/api-control.json",JSON.stringify(results,null,2)+"\n");
console.log(JSON.stringify(results,null,2));
