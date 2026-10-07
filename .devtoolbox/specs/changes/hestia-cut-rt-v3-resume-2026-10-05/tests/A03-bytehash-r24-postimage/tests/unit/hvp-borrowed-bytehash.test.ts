import {expect,it} from "vitest";
import {fnv1aBytes,fnv1aBytesSteps} from "../../src/workers/protocol";

const finish=(steps:Generator<string,string,unknown>)=>{
  let yields=0;try{for(;;){const step=steps.next();if(step.done){return {hash:step.value,yields};}yields+=1;}}
  finally{steps.return(undefined as never);}
};
it("preserves the existing literal byte hash across empty and split buffers",()=>{
  const buffers=[new ArrayBuffer(0),new Uint8Array([1]).buffer,new Uint8Array([2,3]).buffer];
  expect(finish(fnv1aBytesSteps(buffers)).hash).toBe("56cf37ab");
  expect(finish(fnv1aBytesSteps([])).hash).toBe("811c9dc5");
  expect(finish(fnv1aBytesSteps(buffers)).hash).toBe(fnv1aBytes(buffers));
});
it("hashes the full legal 8MiB output in cooperative units without changing its bytes",()=>{
  const bytes=new Uint8Array(8*1024*1024);for(let i=0;i<bytes.length;i+=1){bytes[i]=(i*29)%251;}
  const result=finish(fnv1aBytesSteps([bytes.buffer]));expect(result.hash).toBe("82a97ace");
  expect(result.hash).toBe(fnv1aBytes([bytes.buffer]));expect(result.yields).toBeGreaterThan(1);
});
it("closes a partial hash without exposing a final hash after cancellation",()=>{
  const steps=fnv1aBytesSteps([new ArrayBuffer(32*1024)]);expect(steps.next().done).toBe(false);
  expect(steps.return(undefined as never)).toEqual({done:true,value:undefined});expect(steps.next()).toEqual({done:true,value:undefined});
});
it("preserves the original detached-buffer error class at its actual read",()=>{
  const buffer=new ArrayBuffer(8);structuredClone(buffer,{transfer:[buffer]});
  let original:TypeError|undefined;
  try{fnv1aBytes([buffer]);}catch(error){if(!(error instanceof TypeError)){throw error;}original=error;}
  expect(original).toBeInstanceOf(TypeError);
  expect(()=>finish(fnv1aBytesSteps([buffer]))).toThrow(original!.message);
});
