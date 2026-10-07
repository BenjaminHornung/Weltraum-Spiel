import {beforeAll,expect,it} from "vitest";
import {writeFileSync} from "node:fs";
import {join} from "node:path";
import {deepFreeze} from "../../src/voxel/adaptive/validation";

// Independent exact preimage, including its intentional string-key-only recursion.
const originalFreeze=<T>(value:T,seen=new WeakSet<object>()):T=>{
  if(typeof value!=="object"||value===null||seen.has(value)){return value;}
  seen.add(value);
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){
    if("value" in descriptor){originalFreeze(descriptor.value,seen);}
  }
  return Object.freeze(value);
};

// Offline same-process A/B diagnosis; never a product timing assertion or browser gate.
beforeAll(()=>{
  const folder=process.env.WELTRAUM_A02_CPU_PROFILE_DIR;if(folder===undefined){return;}
  const rows:unknown[]=[];
  const input=()=>({density:Array.from({length:4096},(_,i)=>i/4096),occupancy:new Array<number>(4096).fill(1),
    material:new Array<string>(4096).fill("hvp.material.65535"),semantic:new Array<string>(4096).fill("semantic.base")});
  for(let pair=0;pair<12;pair+=1){
    const order=pair%2===0?["preimage","candidate"] as const:["candidate","preimage"] as const;
    for(const label of order){const value=input(),cpu=process.cpuUsage(),start=process.hrtime.bigint();
      (label==="preimage"?originalFreeze:deepFreeze)(value);
      const wallMs=Number(process.hrtime.bigint()-start)/1e6,used=process.cpuUsage(cpu);
      expect(Object.isFrozen(value)).toBe(true);expect(Object.values(value).every(Object.isFrozen)).toBe(true);
      expect(value.density[4095]).toBe(4095/4096);expect(value.material[4095]).toBe("hvp.material.65535");
      rows.push({pair,label,phase:pair===0?"cold":pair<3?"excluded-warmup":"measurement",wallMs,userMs:used.user/1000,systemMs:used.system/1000});
    }
  }
  writeFileSync(join(folder,"freeze-same-process-ab.json"),JSON.stringify({pairs:12,measuredPairs:9,order:"alternating",rows}),{flag:"wx"});
});

const fixture=()=>{
  const trace:string[]=[],symbolValue={mutable:true},inherited={mutable:true};
  const observe=(name:string,target:Record<PropertyKey,unknown>)=>new Proxy(target,{
    ownKeys(value){trace.push(`${name}:keys`);return Reflect.ownKeys(value);},
    getOwnPropertyDescriptor(value,key){trace.push(`${name}:descriptor:${String(key)}`);return Reflect.getOwnPropertyDescriptor(value,key);},
    preventExtensions(value){trace.push(`${name}:preventExtensions`);return Reflect.preventExtensions(value);},
    defineProperty(value,key,descriptor){trace.push(`${name}:define:${String(key)}`);return Reflect.defineProperty(value,key,descriptor);},
    get(value,key,receiver){trace.push(`${name}:get:${String(key)}`);return Reflect.get(value,key,receiver);}
  });
  const child=observe("child",{value:1});
  const target=Object.create({inherited}) as Record<PropertyKey,unknown>;
  target["2"]=child;target.alias=child;target[Symbol("ignored")]=symbolValue;
  Object.defineProperty(target,"hidden",{value:{value:2},enumerable:false,configurable:true,writable:true});
  Object.defineProperty(target,"accessor",{get(){throw new Error("Getter must not run");},enumerable:true,configurable:true});
  const root=observe("root",target);target.self=root;
  return {root,child,trace,symbolValue,inherited};
};

it("preserves complete Proxy descriptor/freeze ordering, cycles, aliases and ignored inherited/symbol values",()=>{
  const before=fixture(),after=fixture();
  expect(originalFreeze(before.root)).toBe(before.root);expect(deepFreeze(after.root)).toBe(after.root);
  expect(after.trace).toEqual(before.trace);
  expect(Object.isFrozen(after.root)).toBe(true);expect(Object.isFrozen(after.child)).toBe(true);
  expect(Object.isFrozen(Reflect.getOwnPropertyDescriptor(after.root,"hidden")!.value)).toBe(true);
  expect(Object.isFrozen(after.symbolValue)).toBe(false);expect(Object.isFrozen(after.inherited)).toBe(false);
});

it("preserves first thrown descriptor error and caller-provided seen membership",()=>{
  const sentinel=new Error("descriptor failure"),trace:string[]=[];
  const value=new Proxy({},{ownKeys(){trace.push("keys");throw sentinel;}});
  expect(()=>deepFreeze(value)).toThrow(sentinel);expect(trace).toEqual(["keys"]);
  const seen=new WeakSet<object>([value]);expect(deepFreeze(value,seen)).toBe(value);expect(trace).toEqual(["keys"]);
});
