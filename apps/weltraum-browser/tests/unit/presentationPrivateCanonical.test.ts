import {expect,it,vi} from "vitest";
import {canonicalSignature,canonicalSignaturePrivateSteps} from "../../src/presentation/canonical";
const drain=(steps:ReturnType<typeof canonicalSignaturePrivateSteps>)=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
it("preserves the complete public v1 hash grammar in private custody",()=>{
  for(const value of [null,undefined,true,false,0,-0,Math.PI,"world:\u{1f680}",{z:undefined,a:[1,"rock",null]},new Float32Array([-0,1.125,-3.5]),new Uint16Array([0,65535]),new Uint32Array([0,4294967295]),
    {positions:Float32Array.from({length:4097},(_,i)=>i/8),indices:new Uint32Array([0,1,2]),text:"\u{1f680}".repeat(256)}]){
    expect(drain(canonicalSignaturePrivateSteps(value))).toBe(canonicalSignature(value));
  }
});
it("does not expose custody arrays through ambient reflection or constructor getters",()=>{
  const value={positions:new Float32Array([1,2,3]),normals:new Float32Array([0,0,1])},expected=canonicalSignature(value);
  const original=Object.getOwnPropertyDescriptor(Float32Array.prototype,"constructor")!,getter=vi.fn(()=>Float32Array),entries=vi.spyOn(Object,"entries");
  try{
    Object.defineProperty(Float32Array.prototype,"constructor",{get:getter,configurable:true});
    expect(drain(canonicalSignaturePrivateSteps(value))).toBe(expected);expect(getter).not.toHaveBeenCalled();expect(entries).not.toHaveBeenCalled();
  }finally{Object.defineProperty(Float32Array.prototype,"constructor",original);entries.mockRestore();}
});
