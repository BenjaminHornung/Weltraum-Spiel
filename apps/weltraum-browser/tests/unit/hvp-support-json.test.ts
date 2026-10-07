import {expect,it} from "vitest";
import * as supportJson from "../../src/workers/hvpSupportJson";

type Reader=(bytes:Uint8Array)=>Generator<string,unknown,unknown>;
const read=(bytes:Uint8Array)=>{
  const steps=(supportJson as unknown as {readHvpSupportJsonSteps:Reader}).readHvpSupportJsonSteps(bytes);let units=0;
  for(;;){const step=steps.next();if(step.done){return {value:step.value,units};}units+=1;}
};
it("reads the existing JSON wire across real UTF8 and escape boundaries without a bulk parse",()=>{
  const value={binding:["support",1,2,"12345678",[256,128,256],[[3,4,5]]],report:{reason:"x".repeat(4000)+"🌍\\\"\n",
    fragments:Array.from({length:32},(_,i)=>({id:i,cells:Array.from({length:256},(_,j)=>({x:j,y:i,z:3,materialId:4})),
      affectedLeaves:Array.from({length:128},(_,j)=>`${j}:2:3`)}))}};
  const bytes=new TextEncoder().encode(JSON.stringify(value)),result=read(bytes);
  expect(result.value).toEqual(JSON.parse(new TextDecoder().decode(bytes)));expect(result.units).toBeGreaterThan(100);
  const writer=supportJson.encodeHvpSupportJsonSteps(value,8*1024*1024);let written:Uint8Array|undefined;
  for(;;){const step=writer.next();if(step.done){written=step.value;break;}}
  expect(written).toEqual(bytes);
  const small=supportJson.encodeHvpSupportJsonSteps(value,128);
  expect(()=>{for(;;){if(small.next().done){break;}}}).toThrow(/BudgetExceeded/);
});
it("rejects malformed syntax and UTF8, and cancellation never returns a partial graph",()=>{
  for(const text of ['{"a":1,}','[1,]','{"a":01}','[true false]','{"a":"\\uZZZZ"}','{"a":1} trailing']){
    expect(()=>read(new TextEncoder().encode(text))).toThrow();
  }
  expect(()=>read(new Uint8Array([123,34,120,34,58,34,0xff,34,125]))).toThrow();
  const steps=(supportJson as unknown as {readHvpSupportJsonSteps:Reader}).readHvpSupportJsonSteps(new TextEncoder().encode('[1,2,3]'));
  expect(steps.next().done).toBe(false);expect(steps.return(undefined)).toEqual({done:true,value:undefined});expect(steps.next()).toEqual({done:true,value:undefined});
});
it("proves UTF8 and escape splits at4096, duplicate keys/proto semantics, and allocation credit before parsing",()=>{
  const encoder=new TextEncoder(),prefix='{"x":"',padding="a".repeat(4095-encoder.encode(prefix).length);
  for(const atom of ["🌍","\\n","\\uD83C\\uDF0D"]){
    const text=prefix+padding+atom+'"}',bytes=encoder.encode(text);
    expect(encoder.encode(prefix+padding).length).toBe(4095);expect(bytes[4095]).toBe(atom==="🌍"?0xf0:0x5c);
    expect(read(bytes).value).toEqual(JSON.parse(text));
  }
  const text='{"x":1,"x":2,"__proto__":{"safe":true}}',actual=read(encoder.encode(text)).value as Record<string,unknown>;
  expect(actual).toEqual(JSON.parse(text));expect(Object.getPrototypeOf(actual)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(actual,"__proto__")?.value).toEqual({safe:true});
  expect(()=>read(new Uint8Array([34,0xf0,0x9f]))).toThrow();
  const invalid=new Uint8Array(4100);invalid.fill(32);invalid[0]=93;invalid[4099]=0xff;
  expect(()=>read(invalid)).toThrow(/encoded data|encoding/i);
  const sentinel=new Error("credit refused"),steps=supportJson.readHvpSupportJsonSteps(encoder.encode('["hello"]'),bytes=>{if(bytes<32768){throw sentinel;}});
  expect(()=>{for(;;){if(steps.next().done){break;}}}).toThrow(sentinel);expect(steps.next().done).toBe(true);
});
