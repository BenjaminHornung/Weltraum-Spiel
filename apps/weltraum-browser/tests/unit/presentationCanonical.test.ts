import {expect,it,vi} from "vitest";
import {canonicalSignature} from "../../src/presentation/canonical";
import * as presentationCanonical from "../../src/presentation/canonical";

// Independent reference: explicit canonical byte stream and the original BigInt
// definition of FNV-1a modulo 2^64. No production hash/encoding helpers are used.
const reference=(value:unknown):string=>{
  const parts:Buffer[]=[];
  const byte=(n:number)=>{parts.push(Buffer.from([n]));};
  const length=(n:number)=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));parts.push(b);};
  const string=(s:string)=>{const b=Buffer.from(s,"utf8");length(b.length);parts.push(b);};
  const write=(v:unknown):void=>{
    if(v===null){byte(0);return;}
    if(v===undefined){byte(1);return;}
    if(typeof v==="boolean"){byte(v?3:2);return;}
    if(typeof v==="number"){byte(4);const b=Buffer.alloc(8);b.writeDoubleLE(v);parts.push(b);return;}
    if(typeof v==="string"){byte(5);string(v);return;}
    if(v instanceof Float32Array||v instanceof Uint16Array||v instanceof Uint32Array){
      byte(6);string(v.constructor.name);length(v.byteLength);
      const b=Buffer.alloc(v.byteLength);
      for(let i=0;i<v.length;i+=1){
        if(v instanceof Float32Array){b.writeFloatLE(v[i]!,i*4);}
        else if(v instanceof Uint16Array){b.writeUInt16LE(v[i]!,i*2);}
        else{b.writeUInt32LE(v[i]!,i*4);}
      }
      parts.push(b);return;
    }
    if(Array.isArray(v)){byte(7);length(v.length);for(const e of v){write(e);}return;}
    if(v&&typeof v==="object"){
      const entries=Object.entries(v).filter(([,e])=>e!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0);
      byte(8);length(entries.length);for(const [k,e] of entries){string(k);write(e);}return;
    }
    throw new Error("Unsupported reference value");
  };
  string("weltraum-presentation-canonical-v1");write(value);
  let hash=0xcbf29ce484222325n;
  for(const b of Buffer.concat(parts)){hash=((hash^BigInt(b))*0x100000001b3n)&0xffffffffffffffffn;}
  return `fnv1a64:${hash.toString(16).padStart(16,"0")}`;
};

it("preserves canonical byte order and all 64 hash bits against an independent BigInt oracle",()=>{
  let state=0xdeadbeef;
  const words=Uint32Array.from({length:65_537},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;});
  const floats=Float32Array.from(words.subarray(0,16_385),n=>(n/2**32-.5)*1024);
  const cases:unknown[]=[null,undefined,false,true,0,-0,NaN,Infinity,-Infinity,2**53-1,"Hestia\u0000🌿\ud800",
    new Uint16Array(),new Uint16Array([0,65535,32768,1]),words,words.subarray(1,32770),floats,floats.subarray(1),
    {z:undefined,bounds:{max:{z:3,y:2,x:1},min:{x:-1,y:-2,z:-3}},arrays:[words.subarray(0,257),floats.subarray(0,257)],flag:true}];
  for(const value of cases){expect(canonicalSignature(value)).toBe(reference(value));}
  expect(canonicalSignature({b:2,a:1})).toBe(canonicalSignature({a:1,b:2}));
  expect(canonicalSignature(words)).not.toBe(canonicalSignature(words.subarray(1)));
  expect(canonicalSignature(0)).not.toBe(canonicalSignature(-0));
});
it("encodes short UTF8 strings into writer scratch and preserves long and surrogate boundary bytes",()=>{
  const values=["", "a".repeat(127), "a".repeat(128), "é".repeat(128), "\ud800".repeat(128), "🌿".repeat(64),
    "x".repeat(127)+"\ud800", "a".repeat(129), "🌿".repeat(65), "long".repeat(1024)];
  const expected=values.map(reference),encode=vi.spyOn(TextEncoder.prototype,"encode"),into=vi.spyOn(TextEncoder.prototype,"encodeInto");
  try{
    values.forEach((value,i)=>expect(canonicalSignature(value)).toBe(expected[i]));
    expect(encode).toHaveBeenCalledTimes(3);expect(into).toHaveBeenCalledTimes(values.length*2-3);
    const alternating=["long".repeat(1024),"\u0000é🌿\ud800","", "b".repeat(128),"z",""];
    expect(canonicalSignature(alternating)).toBe(reference(alternating));
  }finally{encode.mockRestore();into.mockRestore();}
});
it("reuses one scalar scratch per writer while preserving mixed numeric length string and typed bytes",()=>{
  const value={rows:Array.from({length:128},(_,i)=>({n:i-.5,text:`r${i}🌿`,flag:i%2===0})),words:new Uint16Array([0,65535,1]),
    numbers:[-0,NaN,Infinity,-Infinity,Number.MIN_VALUE,Number.MAX_VALUE]};
  const expected=reference(value),Original=globalThis.DataView;let scalarViews=0;
  try{globalThis.DataView=new Proxy(Original,{construct(target,args,newTarget){
    if((args[0] as ArrayBuffer).byteLength===8){scalarViews+=1;}return Reflect.construct(target,args,newTarget);
  }});
    expect(canonicalSignature(value)).toBe(expected);expect(scalarViews).toBe(1);
  }finally{globalThis.DataView=Original;}
});
it("hashes every owned typed element and Unicode byte in bounded steps without changing the binary canonical format",()=>{
  const stepsFor=(presentationCanonical as unknown as {canonicalSignatureOwnedSteps:(value:unknown)=>Generator<string,ReturnType<typeof canonicalSignature>,unknown>}).canonicalSignatureOwnedSteps;
  const words=Uint32Array.from({length:65_537},(_,i)=>Math.imul(i,1664525)>>>0),floats=Float32Array.from({length:8193},(_,i)=>(i-4000)/7);
  const values=[{words,floats,small:new Uint16Array([0,65535,1]),bounds:{min:{x:-0,y:NaN,z:-Infinity},max:{x:Infinity,y:1e-7,z:1e21}}},
    {text:"x".repeat(127)+"🌿\ud800"+"é".repeat(4097),empty:"",list:[false,true,null,undefined,-0]}];
  for(const value of values){const expected=reference(value),steps=stepsFor(value);let yields=0;
    try{for(;;){const next=steps.next();if(next.done){expect(next.value).toBe(expected);expect(next.value).toBe(canonicalSignature(value));break;}
      expect(next.value).toMatch(/^canonical/);yields+=1;}}finally{steps.return(undefined as never);}
    expect(yields).toBeGreaterThan(64);
  }
  const steps=stepsFor({words});for(;;){const next=steps.next();expect(next.done).toBe(false);if(next.value==="canonicalTypedBytes")break;}
  expect(steps.return(undefined as never)).toEqual({done:true,value:undefined});expect(steps.next()).toEqual({done:true,value:undefined});
  for(const value of [new Int32Array([1]),1n,Symbol("unsupported")]){
    let old:unknown;try{canonicalSignature(value);}catch(error){old=error;}
    const own=stepsFor(value);try{expect(()=>{for(;;){if(own.next().done){break;}}}).toThrow((old as Error).message);}finally{own.return(undefined as never);}
  }
});
it("bounds each native typed fold to 4096 bytes even when instance element width is shadowed",()=>{
  const stepsFor=(presentationCanonical as unknown as {canonicalSignatureOwnedSteps:(value:unknown)=>Generator<string,string,unknown>}).canonicalSignatureOwnedSteps;
  for(const array of [new Float32Array(4097),new Uint16Array(8193),new Uint32Array(4097)]){
    Object.defineProperty(array,"BYTES_PER_ELEMENT",{value:8192});
    const expected=canonicalSignature(array),steps=stepsFor(array);let bytes=0;
    const f=vi.spyOn(DataView.prototype,"setFloat32"),u=vi.spyOn(DataView.prototype,"setUint32"),s=vi.spyOn(DataView.prototype,"setUint16");
    try{for(;;){f.mockClear();u.mockClear();s.mockClear();const next=steps.next();
      const count=4*(f.mock.calls.length+u.mock.calls.length)+2*s.mock.calls.length;
      expect(count).toBeLessThanOrEqual(4096);bytes+=count;
      if(next.done){expect(next.value).toBe(expected);break;}}
      expect(bytes).toBe(array.byteLength);
    }finally{steps.return(undefined as never);f.mockRestore();u.mockRestore();s.mockRestore();}
  }
});
