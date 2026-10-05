import {expect,it} from "vitest";
import {createHash} from "node:crypto";
import {canonicalAdaptiveJson,hashAdaptiveCanonical} from "../../src/voxel/adaptive";
import {createOwnedCanonicalHashCursor} from "../../src/voxel/adaptive/ownedCanonicalHashSteps";

const journal=Object.freeze(Array.from({length:4096},(_,index)=>index));
const payload=Object.freeze({journal,schemaVersion:1});
const thrown=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected hash failure");};
const failed=(value:unknown)=>{
  const cursor=createOwnedCanonicalHashCursor(value);let first:unknown;
  try{
    for(let index=0;index<100;index+=1){
      try{cursor.advance(1);}catch(error){first=error;break;}
    }
    expect(first).toBeDefined();expect(thrown(()=>cursor.advance(1))).toBe(first);
  }finally{cursor.dispose();cursor.dispose();}
  expect(thrown(()=>cursor.advance(1))).toBe(first);
  return first;
};

it("opens owned4096 arrays cooperatively without changing bytes, integrity precedence or cleanup",()=>{
  // Captured before the fix by an independent numeric JSON/FNV loop, not by this cursor.
  const expected=canonicalAdaptiveJson(payload),expectedBytes=new TextEncoder().encode(expected);
  expect(expectedBytes.length).toBe(19401);
  expect(createHash("sha256").update(expectedBytes).digest("hex"))
    .toBe("d1b5b88125e2dfe8d37c78382ffcd78b7cf6e89ab3837d53e344620d0d9b8e6d");
  expect(hashAdaptiveCanonical(payload)).toBe("fnv1a64-v1:e15bf64571353054");
  const samples:unknown[]=[];
  for(const units of [1,7,64,257]){
    const chunks:Uint8Array[]=[];let bulk=0,indexChecks=0,prototypeAt=-1,maxChecks=0,advances=0;
    const cursor=createOwnedCanonicalHashCursor(payload,bytes=>chunks.push(bytes.slice()));
    const nativeFrozen=Object.isFrozen,nativeDescriptor=Object.getOwnPropertyDescriptor,nativePrototype=Object.getPrototypeOf;
    let result:ReturnType<typeof cursor.advance>;
    try{
      expect(()=>cursor.advance(0)).toThrow(RangeError);
      do{
        const before=indexChecks;
        Object.isFrozen=value=>{if(value===journal){bulk+=1;}return nativeFrozen(value);};
        Object.getOwnPropertyDescriptor=(value,key)=>{
          if(value===journal&&key!=="length"){indexChecks+=1;}
          return nativeDescriptor(value,key);
        };
        Object.getPrototypeOf=value=>{
          if(value===journal&&prototypeAt<0){prototypeAt=indexChecks;}
          return nativePrototype(value);
        };
        try{result=cursor.advance(units);}
        finally{
          Object.isFrozen=nativeFrozen;Object.getOwnPropertyDescriptor=nativeDescriptor;Object.getPrototypeOf=nativePrototype;
        }
        advances+=1;maxChecks=Math.max(maxChecks,indexChecks-before);
        // The prechange source genuinely fails here on its first array opening.
        expect(bulk).toBe(0);expect(indexChecks-before).toBeLessThanOrEqual(units);
        if(advances>20000){throw new Error("Hash cursor made no bounded progress");}
      }while(result===undefined);
      expect(prototypeAt).toBe(4096);expect(indexChecks).toBe(3*4096);
      expect(Buffer.concat(chunks)).toEqual(Buffer.from(expectedBytes));
      expect(result).toEqual({contentHash:"fnv1a64-v1:e15bf64571353054",byteLength:19401});
      expect(()=>cursor.advance(1)).toThrow("exhausted");
      samples.push({units,advances,indexChecks,maxChecks,bulkFrozenCalls:bulk,prototypeAfterIntegrityIndices:prototypeAt});
    }finally{cursor.dispose();cursor.dispose();}
    expect(()=>cursor.advance(1)).toThrow("exhausted");
    expect(result?.contentHash).toBe("fnv1a64-v1:e15bf64571353054");
  }

  let getterReads=0;
  const mutableLate=[0,1];
  Object.defineProperty(mutableLate,"0",{enumerable:false,configurable:false,get:()=>{getterReads+=1;return 0;}});
  Object.defineProperty(mutableLate,"length",{writable:false});Object.seal(mutableLate);
  expect(Object.isFrozen(mutableLate)).toBe(false);
  expect(failed(mutableLate)).toMatchObject({name:"AdaptiveAuthorityError",code:"InvalidCanonicalValue",path:"",
    message:"Owned canonical containers must be frozen."});
  const mutablePrototype=[0,1];Object.defineProperty(mutablePrototype,"length",{writable:false});
  Object.setPrototypeOf(mutablePrototype,null);Object.seal(mutablePrototype);
  expect(failed(mutablePrototype)).toMatchObject({path:"",message:"Owned canonical containers must be frozen."});
  expect(failed(Object.freeze(mutablePrototype))).toMatchObject({path:"",message:"Owned canonical arrays must be plain arrays."});
  for(const accessor of [false,true]){
    const badPresent:unknown[]=[,1];
    Object.defineProperty(badPresent,"1",accessor
      ?{enumerable:true,configurable:false,get:()=>{getterReads+=1;return 1;}}
      :{enumerable:false,configurable:false,writable:false,value:1});
    Object.defineProperty(badPresent,"length",{writable:false});Object.preventExtensions(badPresent);
    expect(Object.isFrozen(badPresent)).toBe(true);
    const publicError=thrown(()=>canonicalAdaptiveJson(badPresent));
    expect(failed(badPresent)).toMatchObject({name:"AdaptiveAuthorityError",code:"InvalidCanonicalValue",path:"/1",
      message:(publicError as Error).message});
  }
  const sparse:unknown[]=[,1];Object.defineProperty(sparse,"1",{writable:false,configurable:false});
  Object.defineProperty(sparse,"length",{writable:false});Object.preventExtensions(sparse);
  expect(Object.isFrozen(sparse)).toBe(true);
  expect(failed(sparse)).toMatchObject({path:"/0",message:"Sparse arrays are rejected."});
  const cycle:unknown[]=[];cycle.push(cycle);Object.freeze(cycle);
  expect(failed(cycle)).toMatchObject({path:"/0",message:"Cycles are not canonical."});
  expect(getterReads).toBe(0);
  for(const units of [1,2048,4097]){
    let emitted=0;const partial=createOwnedCanonicalHashCursor(payload,bytes=>{emitted+=bytes.length;});
    const host=new Error("owned-array host finally sentinel");
    expect(thrown(()=>{try{expect(partial.advance(units)).toBeUndefined();throw host;}
      finally{partial.dispose();partial.dispose();}})).toBe(host);
    expect(emitted).toBe(0);expect(()=>partial.advance(1)).toThrow("disposed");
  }
  let sinkCalls=0;
  const reentry=createOwnedCanonicalHashCursor(payload,()=>{sinkCalls+=1;reentry.dispose();});
  for(let index=0;sinkCalls===0&&index<200;index+=1){expect(reentry.advance(257)).toBeUndefined();}
  expect(sinkCalls).toBe(1);reentry.dispose();expect(()=>reentry.advance(1)).toThrow("disposed");
  expect(canonicalAdaptiveJson(payload)).toBe(expected);
  console.info("OWNED_HASH_ARRAY_OPEN",JSON.stringify({samples,canonicalBytes:19401,
    contentHash:"fnv1a64-v1:e15bf64571353054",activation:"OFF",physicalAndTimingAcceptance:"NOT_PROVEN"}));
});
