import assert from "node:assert/strict";
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import crypto from "node:crypto";
const {Candidate,context,worldFor,recipe,installFixture,publish}=await import(pathToFileURL(process.argv[2]).href);
const real=WebAssembly.Module,seen=[];
WebAssembly.Module=new Proxy(real,{construct(target,args){
  const input=args[0],bytes=ArrayBuffer.isView(input)?Buffer.from(input.buffer,input.byteOffset,input.byteLength):Buffer.from(input);
  const hash=crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash,"ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9");seen.push(hash);return Reflect.construct(target,args);
}});
try{
  await Candidate.init();
  const fixture={id:"built-node-smoke",cellSize:.125,bounds:[1,1,1],origin:[0,0,0],cells:[[0,0,0]],density:512,rotation:{x:0,y:0,z:0,w:1}};
  for(const profile of ["legacy-impulse-v1","gyroscopic-v1"])for(const kind of ["triangles","multi-cuboid","voxels"]){
    const c=context(profile,kind),r=recipe(fixture,kind),w=worldFor(c);
    try{assert(r.binding.sourceDigest);const i=installFixture(c,w,fixture,true);publish(w);
      i.body.recomputeMassPropertiesFromColliders();assert.equal(i.body.mass(),1);
      assert.equal(i.body.gyroscopicForcesEnabled(),profile==="gyroscopic-v1");}
    finally{w.free();}
  }
  assert.equal(seen.length,1);console.log(JSON.stringify({status:"PASS",runtime:"BUILT_NODE_LIBRARY",actualWasm:seen,recipes:6,
    massPublication:"Explicit native recompute, same as tensor core control; no mass rewrite or physics step"}));
}finally{WebAssembly.Module=real;}
