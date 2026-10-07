import {createHash} from "node:crypto";
import {expect,it} from "vitest";
import {canonicalAdaptiveJson,deepFreeze,hashAdaptiveCanonical} from "../../src/voxel/adaptive";
import {createOwnedCanonicalHashCursor} from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import {createOwnedCanonicalHashCursor as emissionPreimage} from "../reference/hvp-r79-ownedCanonicalHashSteps";
import {createOwnedCanonicalHashCursor as continuationPreimage} from "../reference/hvp-r91-ownedCanonicalHashSteps";
import {prepareHvpStructuralIngestJournalOwnedSteps} from "../../src/hestia-prototype/terrain/structuralIngest";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {adaptiveDenseArraySteps,isValidatedFrozenDenseArray} from "../../src/voxel/adaptive/validation";

const observe=(factory:typeof emissionPreimage,payload:unknown,units:number,reuse:boolean)=>{
  let advances=0;const chunks:Uint8Array[]=[],prefixes:unknown[]=[];
  const cursor=factory(payload,bytes=>{chunks.push(bytes.slice());prefixes.push([advances,bytes.length,
    createHash("sha256").update(bytes).digest("hex")]);},reuse);
  try{for(;;){advances+=1;const result=cursor.advance(units);if(result!==undefined)return {
    advances,result,bytes:Buffer.concat(chunks),prefixDigest:createHash("sha256").update(JSON.stringify(prefixes)).digest("hex")};}}
  finally{cursor.dispose();}
};
it("preserves short value UTF8 escaping validation advances and sink prefixes at128-unit boundaries",()=>{
  const values=["", "x".repeat(127),"x".repeat(128),"x".repeat(129),"\u0000\n\"\\é🌿",
    "x".repeat(126)+"🌿","x".repeat(127)+"🌿", "x".repeat(128)+"🌿"];
  const payload=deepFreeze({values,again:values,tail:""});
  for(const reuse of [false,true])for(const units of [1,64,128]){
    expect(observe(createOwnedCanonicalHashCursor,payload,units,reuse)).toEqual(observe(continuationPreimage,payload,units,reuse));
  }
  const fail=(factory:typeof continuationPreimage,text:string,units:number)=>{
    let advances=0;const prefixes:unknown[]=[],cursor=factory(deepFreeze({a:"ok",z:text}),bytes=>prefixes.push([advances,Buffer.from(bytes).toString("hex")]),true);
    let first:unknown;
    try{for(;;){advances+=1;cursor.advance(units);}}catch(error){first=error;}
    try{expect(()=>cursor.advance(1)).toThrow(first as Error);return {advances,prefixes,error:first};}finally{cursor.dispose();}
  };
  for(const text of ["\ud800","x".repeat(127)+"\ud800","x".repeat(128)+"\ud800"])for(const units of [1,64,128]){
    expect(fail(createOwnedCanonicalHashCursor,text,units)).toEqual(fail(continuationPreimage,text,units));
  }
});

it("preserves private delegation observations, nested empties, failure identities and disposal boundaries",()=>{
  const shared=deepFreeze({empty:[],text:"x".repeat(127)+"🚀"+"y".repeat(129)});
  const payload=deepFreeze({a:[{},[],shared,{b:[true,null,-0,"",shared]}],z:"z".repeat(5000)});
  for(const reuse of [false,true])for(const units of [1,64,128]){
    expect(observe(createOwnedCanonicalHashCursor,payload,units,reuse)).toEqual(observe(continuationPreimage,payload,units,reuse));
  }
  const trace=(factory:typeof continuationPreimage)=>{
    const calls:string[]=[],target=Object.freeze({a:1,z:Object.freeze([Object.freeze({value:"v"})])});
    const proxy=new Proxy(target,{getPrototypeOf(t){calls.push("prototype");return Reflect.getPrototypeOf(t);},
      ownKeys(t){calls.push("keys");return Reflect.ownKeys(t);},isExtensible(t){calls.push("extensible");return Reflect.isExtensible(t);},
      getOwnPropertyDescriptor(t,k){calls.push(`descriptor:${String(k)}`);return Reflect.getOwnPropertyDescriptor(t,k);},
      get(t,k,r){calls.push(`get:${String(k)}`);return Reflect.get(t,k,r);}});
    const result=observe(factory,proxy,1,true);return {calls,result};
  };
  expect(trace(createOwnedCanonicalHashCursor)).toEqual(trace(continuationPreimage));
  const lifecycle=(factory:typeof continuationPreimage,mode:"throw"|"disposeThrow"|"dispose"|"reenter",sentinel:unknown,large:boolean)=>{
    let calls=0,advance=0,trigger=0,first:unknown,threw=false,result:unknown,after:unknown,afterThrew=false,post:unknown,postThrew=false;
    const cursor=factory(deepFreeze({value:"v".repeat(large?12000:64)}),()=>{
      calls+=1;trigger=advance;if(mode==="disposeThrow"){cursor.dispose();throw sentinel;}if(mode==="throw")throw sentinel;
      if(mode==="dispose")cursor.dispose();else cursor.advance(1);
    },true);
    try{for(let i=0;i<500;i+=1){advance+=1;result=cursor.advance(1);if(result!==undefined||calls>0)break;}}catch(error){threw=true;first=error;}
    try{cursor.advance(128);}catch(error){afterThrew=true;after=error;}
    cursor.dispose();cursor.dispose();
    try{cursor.advance(1);}catch(error){postThrew=true;post=error;}
    if(mode==="throw"||mode==="disposeThrow"){expect(threw).toBe(true);expect(first).toBe(sentinel);expect(afterThrew).toBe(true);expect(after).toBe(sentinel);expect(postThrew).toBe(true);expect(post).toBe(sentinel);}
    return {calls,trigger,threw,afterThrew,postThrew,result,first:first instanceof Error?first.message:first,
      after:after instanceof Error?after.message:after,post:post instanceof Error?post.message:post,sticky:threw&&afterThrew&&postThrew&&Object.is(first,after)&&Object.is(first,post)};
  };
  for(const large of [false,true])for(const sentinel of [null,undefined,new Error("private sink sentinel")]){
    for(const mode of ["throw","disposeThrow","dispose","reenter"] as const){
      expect(lifecycle(createOwnedCanonicalHashCursor,mode,sentinel,large)).toEqual(lifecycle(continuationPreimage,mode,sentinel,large));
    }
  }
  const suspend=(factory:typeof continuationPreimage)=>{
    let calls=0;const cursor=factory(payload,()=>{calls+=1;},true);
    for(const budget of [0,-1,.5,NaN,Infinity])expect(()=>cursor.advance(budget)).toThrow(RangeError);
    for(let i=0;i<200&&calls===0;i+=1){expect(cursor.advance(1)).toBeUndefined();expect(()=>cursor.advance(0)).toThrow(RangeError);}
    expect(calls).toBeGreaterThan(0);const atDispose=calls;
    cursor.dispose();cursor.dispose();expect(()=>cursor.advance(1)).toThrow("Owned canonical hash cursor is disposed.");
    expect(calls).toBe(atDispose);return calls;
  };
  expect(suspend(createOwnedCanonicalHashCursor)).toBe(suspend(continuationPreimage));
});

it("preserves every default and private emission boundary for scalar records and all key chunk edges",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,96*1024*1024,128);
  const scalarArray=Object.freeze(Array.from({length:4096},(_,i)=>[null,true,false,-0,1.5e-7,1e21][i%6]));
  const witness=adaptiveDenseArraySteps(scalarArray,"r79/scalars","InvalidCanonicalValue",{},ledger.reserve,true);
  try{for(;;){if(witness.next().done)break;}}finally{witness.return(undefined as never);ledger.release();}
  expect(isValidatedFrozenDenseArray(scalarArray)).toBe(true);
  const payload=deepFreeze({"":null,["\u0001".repeat(128)]:true,["k".repeat(127)+"🚀"]:false,
    ["k".repeat(126)+"🚀"]:true,["q".repeat(127)+"\ud800"]:false,
    ["x".repeat(128)]:-0,["z".repeat(129)]:1.5e-7,scalars:scalarArray,
    list:Array.from({length:40},(_,i)=>({a:i,b:null,c:i%2===0,d:1e21}))});
  for(const reuse of [false,true])for(const units of [1,64,128]){
    const actual=observe(createOwnedCanonicalHashCursor,payload,units,reuse);
    expect(actual).toEqual(observe(emissionPreimage,payload,units,reuse));
    expect(actual.bytes).toEqual(Buffer.from(canonicalAdaptiveJson(payload)));
    expect(actual.result.contentHash).toBe(hashAdaptiveCanonical(payload));
  }
  const payloadWithFailure=deepFreeze({a:{a:0,z:Number.NaN},z:Infinity});
  const fail=(factory:typeof emissionPreimage)=>{
    const cursor=factory(payloadWithFailure,undefined,true);let first:unknown;
    try{for(;;)cursor.advance(1);}catch(error){first=error;}
    expect(()=>cursor.advance(128)).toThrow(first as Error);cursor.dispose();
    expect(()=>cursor.advance(1)).toThrow(first as Error);return first;
  };
  expect(fail(createOwnedCanonicalHashCursor)).toEqual(fail(emissionPreimage));
});

it("measures complete actual owned ingest journal envelopes against the exact current preimage",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,96*1024*1024,128),payloads:unknown[]=[];
  const cells=Array.from({length:352},(_,i)=>Object.freeze({x:i%16,y:Math.floor(i/16)%8,z:Math.floor(i/128),materialId:i%2+1}));
  const materials=deepFreeze([1,2].map(materialId=>({materialId,densityKgPerCubicMeter:512,
    structuralClass:"wood",destructible:true,tags:null})));
  const steps=prepareHvpStructuralIngestJournalOwnedSteps("r79.record",Object.freeze(cells),materials,ledger.reserve,
    function*(payload){payloads.push(payload);ledger.reserve(32768,false,"hash");
      const cursor=emissionPreimage(payload,undefined,true);
      try{for(;;){const result=cursor.advance(128);if(result!==undefined)return result.contentHash;yield;}}
      finally{cursor.dispose();}});
  try{
    for(;;){const step=steps.next();if(step.done){expect(step.value.editJournal.records).toHaveLength(352);break;}}
    const oracles=payloads.map(payload=>({bytes:canonicalAdaptiveJson(payload),hash:hashAdaptiveCanonical(payload)}));
    const run=(factory:typeof emissionPreimage)=>{
      const start=performance.now(),cursors=payloads.map(payload=>factory(payload,undefined,true)),drainStart=performance.now();const hashes=[];
      try{for(const cursor of cursors){let result;do{result=cursor.advance(128);}while(result===undefined);hashes.push(result.contentHash);}}
      finally{for(const cursor of cursors)cursor.dispose();}
      const end=performance.now();expect(hashes).toEqual(oracles.map(x=>x.hash));return {inclusive:end-start,drain:end-drainStart};
    };
    for(let warm=0;warm<4;warm+=1){run(continuationPreimage);run(createOwnedCanonicalHashCursor);}
    const samples={baseline:[] as number[],candidate:[] as number[],baselineDrain:[] as number[],candidateDrain:[] as number[]};
    for(let pair=0;pair<11;pair+=1)for(const arm of pair%2===0?["baseline","candidate"] as const:["candidate","baseline"] as const){
      let total=0,drain=0;for(let repeat=0;repeat<3;repeat+=1){const v=run(arm==="baseline"?continuationPreimage:createOwnedCanonicalHashCursor);total+=v.inclusive;drain+=v.drain;}
      samples[arm].push(total/3);samples[arm==="baseline"?"baselineDrain":"candidateDrain"].push(drain/3);
    }
    for(let i=0;i<payloads.length;i+=1)expect(canonicalAdaptiveJson(payloads[i])).toBe(oracles[i]!.bytes);
    console.info("R91_RECORD_KERNEL",JSON.stringify({classification:"DIAGNOSTIC_NOT_GAME_ACCEPTANCE",records:352,payloads:payloads.length,samples}));
  }finally{steps.return(undefined as never);ledger.release();}
});

it("preserves complete bytes and sink boundaries for primitive arrays and short/long escaped keys",()=>{
  const scalars=[null,true,false,-0,1.5e-7,1e21,-12.25,5e-324,Number.MAX_SAFE_INTEGER];
  const payload=deepFreeze({"":null,["\u0001".repeat(128)]:true,["k".repeat(127)+"🚀"]:false,
    ["x".repeat(128)]:-0,list:Array.from({length:4096},(_,index)=>scalars[index%scalars.length])});
  const observations=[];
  for(const units of [1,64]){
    let advances=0;const chunks:Uint8Array[]=[],prefixes:unknown[]=[];
    const cursor=createOwnedCanonicalHashCursor(payload,bytes=>{
      chunks.push(bytes.slice());prefixes.push([advances,bytes.length,createHash("sha256").update(bytes).digest("hex")]);
    });
    try{for(;;){advances+=1;const result=cursor.advance(units);if(result!==undefined){
      const bytes=Buffer.concat(chunks);expect(bytes).toEqual(Buffer.from(canonicalAdaptiveJson(payload)));
      expect(result.contentHash).toBe(hashAdaptiveCanonical(payload));
      observations.push({units,advances,prefixDigest:createHash("sha256").update(JSON.stringify(prefixes)).digest("hex")});break;
    }}}finally{cursor.dispose();}
  }
  // Exact observations captured from the unchanged pre-R67 cursor, including fold timing.
  expect(observations).toEqual([
    {units:1,advances:12306,prefixDigest:"379f40bdd9b0cbf7b690263cc748cdad162745ff5651aa16579f891bca1ed14f"},
    {units:64,advances:193,prefixDigest:"824b657c286ca34f00675f26fe37bdff6fd8af590c8671a3269ae418908be7b6"}
  ]);
});
