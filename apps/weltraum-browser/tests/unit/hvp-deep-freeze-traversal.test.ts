import {expect,it} from "vitest";
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
