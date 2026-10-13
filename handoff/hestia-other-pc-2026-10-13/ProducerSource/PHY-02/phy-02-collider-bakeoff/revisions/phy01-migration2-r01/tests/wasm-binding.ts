import {afterAll,expect} from "vitest";
import {createHash} from "node:crypto";
import fs from "node:fs";
const expected="ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9";
const modules:{bytes:number;sha256:string}[]=[];
const original=WebAssembly.Module;
WebAssembly.Module=new Proxy(original,{construct(target,args){
  const input=args[0] as BufferSource;
  const bytes=ArrayBuffer.isView(input)?Buffer.from(input.buffer,input.byteOffset,input.byteLength):Buffer.from(input as ArrayBuffer);
  const sha256=createHash("sha256").update(bytes).digest("hex");
  if(sha256!==expected)throw new Error("Unexpected use-time WASM module: "+sha256);
  modules.push({bytes:bytes.length,sha256});
  return Reflect.construct(target,args);
}});
afterAll(()=>{
  WebAssembly.Module=original;
  if(process.env.PHY02_WASM)fs.writeFileSync(process.env.PHY02_WASM,JSON.stringify({
    capture:"Real WebAssembly.Module constructor, original native compilation forwarded unchanged",modules
  },null,2)+"\n",{flag:"wx"});
  expect(modules.length,"actual supplied WASM compiled in this test process").toBeGreaterThan(0);
});
