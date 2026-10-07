import {expect,it} from "vitest";
import {createHash} from "node:crypto";
import {canonicalAdaptiveJson,hashAdaptiveCanonical} from "../../src/voxel/adaptive";
import {createOwnedCanonicalHashCursor} from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import {adaptiveDenseArraySteps,adaptiveFreezeArraySteps,isValidatedFrozenDenseArray} from "../../src/voxel/adaptive/validation";
import {structuralFreezeArraySteps} from "../../src/voxel/structural/validation";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";

it("uses the measured native freeze only after bounded complete shape proof for at most32768 private hash entries",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128),nativeDefine=Object.defineProperty;
  try{for(const length of [4096,32768]){
    const values=Array.from({length},(_,index)=>index===0?-0:index===1?NaN:index/3),before=values.slice();let locks=0;
    Object.defineProperty=((value:object,key:PropertyKey,attributes:PropertyDescriptor)=>{
      if(value===values&&key!=="length")locks+=1;return nativeDefine(value,key,attributes);
    }) as typeof Object.defineProperty;
    const steps=adaptiveFreezeArraySteps(values,ledger.reserve);let yields=0;
    try{for(;;){const step=steps.next();if(step.done){expect(step.value).toBe(values);break;}yields+=1;}}
    finally{steps.return(undefined as never);Object.defineProperty=nativeDefine;}
    expect(yields).toBeGreaterThanOrEqual(length);expect(locks).toBe(0);expect(Object.isFrozen(values)).toBe(true);
    expect(values.every((value,index)=>Object.is(value,before[index]))).toBe(true);expect(isValidatedFrozenDenseArray(values)).toBe(true);
  }}finally{Object.defineProperty=nativeDefine;ledger.release();}
});
it("proves produced dense shape during both bounded freeze routes without witnessing holes, accessors or cancellation",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const drain=<T>(steps:Generator<void,T,void>):T=>{try{for(;;){const next=steps.next();if(next.done)return next.value;}}finally{steps.return(undefined as never);}};
  try{
    for(const freeze of [adaptiveFreezeArraySteps,structuralFreezeArraySteps]){
      let prepaid=0;const binaryReserve=(bytes:number)=>{prepaid+=bytes;if(prepaid>512)throw new Error("fixed freeze allowance exhausted");};
      const binaryValues=[1,2,3];drain(freeze(binaryValues,binaryReserve));
      expect(prepaid).toBe(512);expect(isValidatedFrozenDenseArray(binaryValues)).toBe(false);
      const values=[1,undefined,-0];expect(drain(freeze(values,ledger.reserve))).toBe(values);
      expect(Object.isFrozen(values)).toBe(true);expect(isValidatedFrozenDenseArray(values)).toBe(true);
      let reads=0;const accessor:number[]=[];Object.defineProperty(accessor,"0",{enumerable:true,configurable:true,get:()=>{reads+=1;return 1;}});
      const hole=[,1],cancel=[1,2,3],steps=freeze(cancel,ledger.reserve);
      drain(freeze(accessor,ledger.reserve));expect(()=>drain(freeze(hole,ledger.reserve))).toThrow(TypeError);
      expect(reads).toBe(0);expect(isValidatedFrozenDenseArray(accessor)).toBe(false);expect(isValidatedFrozenDenseArray(hole)).toBe(false);
      const fixedAccessor:number[]=[];Object.defineProperty(fixedAccessor,"0",{enumerable:true,get:()=>1});
      expect(()=>drain(freeze(fixedAccessor,ledger.reserve))).toThrow(TypeError);
      expect(isValidatedFrozenDenseArray(fixedAccessor)).toBe(false);
      expect(steps.next().done).toBe(false);steps.return(undefined as never);expect(isValidatedFrozenDenseArray(cancel)).toBe(false);
      const rejected=[1],first=new Error("produced shape credit failure"),credit=(bytes:number,retained?:boolean)=>{
        if(retained){throw first;}ledger.reserve(bytes);
      };
      Object.defineProperty(credit,"hashUnits",{value:128});
      expect(thrown(()=>drain(freeze(rejected,credit)))).toBe(first);expect(isValidatedFrozenDenseArray(rejected)).toBe(false);
    }
  }finally{ledger.release();}
});
it("reuses only proven immutable array shape while preserving bytes, default work, nested errors and open yields",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024);
  const witness=(value:readonly unknown[])=>{
    const steps=adaptiveDenseArraySteps(value,"witness","InvalidCanonicalValue",{maximumLength:4096},ledger.reserve,true);
    try{for(;;){const step=steps.next();if(step.done){expect(step.value).toBe(value);return step.value;}}}
    finally{steps.return(undefined as never);}
  };
  const count=(value:unknown,reuse:boolean)=>{
    const bytes:Uint8Array[]=[],cursor=createOwnedCanonicalHashCursor(value,part=>bytes.push(part.slice()),reuse);let units=0;
    try{for(;;){units+=1;const result=cursor.advance(1);if(result!==undefined){return {result,units,bytes:Buffer.concat(bytes)};}}}
    finally{cursor.dispose();}
  };
  const failure=(value:unknown,reuse:boolean)=>{
    const cursor=createOwnedCanonicalHashCursor(value,undefined,reuse);let found=false,first:unknown;
    try{for(let unit=0;unit<20000;unit+=1){try{cursor.advance(1);}catch(error){found=true;first=error;break;}}
      expect(found).toBe(true);expect(thrown(()=>cursor.advance(1))).toBe(first);return first;
    }finally{cursor.dispose();cursor.dispose();}
  };
  try{
    const array=Object.freeze(Array.from({length:4096},(_,index)=>index));
    expect(isValidatedFrozenDenseArray(array)).toBe(false);witness(array);
    expect(isValidatedFrozenDenseArray(array)).toBe(true);
    const generic=count(array,false),nativeDescriptor=Object.getOwnPropertyDescriptor;let reads=0;
    Object.getOwnPropertyDescriptor=(value,key)=>{if(value===array&&key!=="length"){reads+=1;}return nativeDescriptor(value,key);};
    let owned:ReturnType<typeof count>;
    try{owned=count(array,true);}finally{Object.getOwnPropertyDescriptor=nativeDescriptor;}
    expect(reads).toBe(0);
    expect(owned.bytes).toEqual(generic.bytes);expect(owned.result).toEqual(generic.result);
    expect(owned.result.contentHash).toBe(hashAdaptiveCanonical(array));
    expect(generic.units-owned.units).toBe(2*array.length+1);
    const clone=Object.freeze(structuredClone(array));expect(isValidatedFrozenDenseArray(clone)).toBe(false);
    expect(count(clone,true).units).toBe(generic.units);
    const empty=Object.freeze(Array.from({length:512},()=>witness(Object.freeze([]))));witness(empty);
    const opened=count(empty,true);expect(opened.units).toBeGreaterThanOrEqual(513);
    expect(opened.result.contentHash).toBe(hashAdaptiveCanonical(empty));
    for(const value of [Object.freeze([{}]),Object.freeze([undefined]),Object.freeze([NaN])]){
      witness(value);const expected=failure(value,false),actual=failure(value,true);
      expect(actual).toMatchObject({code:(expected as {code:string}).code,path:(expected as {path:string}).path,
        message:(expected as Error).message});
    }
    const cycle:unknown[]=[];cycle.push(cycle);Object.freeze(cycle);witness(cycle);
    expect(failure(cycle,true)).toMatchObject({code:"InvalidCanonicalValue",path:"/0",message:"Cycles are not canonical."});
    const cancel=createOwnedCanonicalHashCursor(empty,undefined,true);expect(cancel.advance(3)).toBeUndefined();
    cancel.dispose();cancel.dispose();expect(()=>cancel.advance(1)).toThrow("disposed");
    const rejected=Object.freeze([42]),first=new Error("witness credit failed");
    const credit=(bytes:number,retained?:boolean)=>{if(retained){throw first;}ledger.reserve(bytes);};
    const steps=adaptiveDenseArraySteps(rejected,"witness","InvalidCanonicalValue",{},credit,true);
    expect(thrown(()=>{for(;;){if(steps.next().done){break;}}})).toBe(first);
    expect(isValidatedFrozenDenseArray(rejected)).toBe(false);steps.return(undefined as never);
  }finally{ledger.release();}
  expect(ledger.resources.reservedBytes).toBe(0);
});

const journal=Object.freeze(Array.from({length:4096},(_,index)=>index));
it("checks immutable owned dense shape once without changing descriptor, credit, hole or cancellation precedence",()=>{
  const reserve=(_bytes:number)=>undefined;
  const drain=(value:unknown,retain:boolean,credit:(bytes:number)=>void=reserve)=>{
    const cursor=retain?adaptiveDenseArraySteps(value,"dense","InvalidCanonicalValue",{},credit,true)
      :adaptiveDenseArraySteps(value,"dense","InvalidCanonicalValue",{},credit);
    try{for(;;){const step=cursor.next();if(step.done){return step.value;}}}
    finally{cursor.return(undefined as never);}
  };
  const frozen=Object.freeze([1,undefined,-0]),mutable=[1,2,3],nativeDescriptor=Object.getOwnPropertyDescriptor;
  for(const [value,retain,expected] of [[frozen,true,3],[frozen,false,6],[mutable,true,6],[frozen,true,0]] as const){
    let reads=0;
    Object.getOwnPropertyDescriptor=(object,key)=>{if(object===value&&key!=="length"){reads+=1;}
      return nativeDescriptor(object,key);};
    let result:readonly unknown[];
    try{result=drain(value,retain);}finally{Object.getOwnPropertyDescriptor=nativeDescriptor;}
    expect(reads).toBe(expected);expect(result!).toEqual(value);
    expect(result! === value).toBe(retain&&value===frozen);
  }
  for(const options of [{exactLength:2},{maximumLength:2}]){
    const cursor=adaptiveDenseArraySteps(frozen,"dense","InvalidCanonicalValue",options,reserve,true);
    try{expect(thrown(()=>cursor.next())).toMatchObject({path:"dense"});}finally{cursor.return(undefined as never);}
  }
  const creditFailure=new Error("witnessed array credit failed");
  expect(thrown(()=>drain(frozen,true,bytes=>{if(bytes===64+frozen.length*128){throw creditFailure;}}))).toBe(creditFailure);
  let getterReads=0;
  for(const accessor of [true,false]){
    const invalid:unknown[]=[,1];Object.defineProperty(invalid,"1",accessor
      ?{enumerable:true,get:()=>{getterReads+=1;return 1;}}
      :{enumerable:false,value:1});Object.freeze(invalid);
    expect(thrown(()=>drain(invalid,true))).toMatchObject({path:"dense/1",message:"Array entries must be enumerable data properties."});
    expect(isValidatedFrozenDenseArray(invalid)).toBe(false);
  }
  expect(getterReads).toBe(0);
  const sparse=Object.freeze([,1]),first=new Error("dense credit before hole");
  expect(thrown(()=>drain(sparse,true,(bytes:number)=>{if(bytes===64+2*128){throw first;}}))).toBe(first);
  expect(thrown(()=>drain(sparse,true))).toMatchObject({path:"dense/0",message:"Sparse arrays are rejected."});
  expect(isValidatedFrozenDenseArray(sparse)).toBe(false);
  const cancelled=Object.freeze([1,2,3]),cursor=adaptiveDenseArraySteps(cancelled,"dense","InvalidCanonicalValue",{},reserve,true);
  expect(cursor.next().done).toBe(false);cursor.return(undefined as never);
  expect(isValidatedFrozenDenseArray(cancelled)).toBe(false);
});
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
