import {expect,it,vi} from "vitest";
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import manifest from "../source-manifest.json";
import solver from "../solver-profile.json";
const sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
it("binds all unchanged controls and transitive source files to their actual byte digests",()=>{
  expect(manifest.modifiedPorts).toEqual([]);expect(manifest.files.length).toBeGreaterThan(100);
  for(const file of manifest.files){
    const copy=new Uint8Array(readFileSync(file.path)),original=new Uint8Array(readFileSync(resolve("../..",file.original)));
    expect(sha(copy),file.path).toBe(file.sha256);
    expect(sha(original),file.original).toBe("checkoutSha256" in file?file.checkoutSha256:file.sha256);
  }
});
it("binds the ACTUAL instantiated compatibility WASM to solver profile, lock and module exports",async()=>{
  const spy=vi.spyOn(WebAssembly,"instantiate");
  try{
    const {R,initializeHvpRapier}=await import("../snapshot/src/hestia-prototype/physics/rapierPort");
    await initializeHvpRapier();expect(typeof R.World).toBe("function");expect(typeof R.ColliderDesc.cuboid).toBe("function");
    const buffers=spy.mock.calls.flatMap(([input])=>input instanceof ArrayBuffer?[new Uint8Array(input)]
      :ArrayBuffer.isView(input)?[new Uint8Array(input.buffer,input.byteOffset,input.byteLength)]:[]);
    expect(buffers.length).toBeGreaterThan(0);
    const actual=buffers.find(bytes=>sha(bytes)===solver.wasmSha256);expect(actual).toBeDefined();
    const file=new Uint8Array(readFileSync("node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm"));
    expect(sha(file)).toBe(solver.wasmSha256);expect(WebAssembly.validate(file)).toBe(true);
    const corrupt=file.slice();corrupt[0]=255;expect(WebAssembly.validate(corrupt)).toBe(false);
    const lock=JSON.parse(readFileSync("package-lock.json","utf8"));
    expect(lock.packages["node_modules/@dimforge/rapier3d-compat"].integrity).toBe(solver.packageIntegrity);
    writeFileSync("evidence/actual-wasm.json",JSON.stringify({status:"PASS",sha256:sha(actual!),bytes:actual!.length,
      exports:{World:typeof R.World,cuboid:typeof R.ColliderDesc.cuboid,init:typeof R.init},version:R.version(),
      artifactSha256:sha(file),negativeCorruptionDetected:true,qualification:"FUNCTIONAL_DIAGNOSTIC_ONLY"},null,2)+"\n");
  }finally{spy.mockRestore();}
});
