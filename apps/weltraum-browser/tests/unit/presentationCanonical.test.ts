import {expect,it} from "vitest";
import {canonicalSignature} from "../../src/presentation/canonical";

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
