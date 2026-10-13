// R10 CPU source/mock qualification of unchanged R07 assertions. Synthetic callbacks; no Candidate.init/World/Rapier imports.
import {expect,it} from "./assertions.js";
import {prepareCase,receiverBatch} from "../candidates/observer.js";

function exercise(id:string,mode:"PASS"|"FAIL"|"UNDEFINED"|"NATIVE_TRAP",freeFails=false){
  const batch={poisoned:false};
  const primary=mode==="UNDEFINED"?undefined:mode==="NATIVE_TRAP"?new WebAssembly.RuntimeError("source-only sentinel"):{sentinel:"primary"};
  const cleanup={sentinel:"cleanup"},result={sentinel:"result"};
  const owned=prepareCase(batch,id),next=prepareCase(batch,id+"/next");
  let bodyCalls=0,freeCalls=0,caught=false,thrown:unknown,returned:unknown;
  try{returned=owned.run(()=>undefined,()=>{bodyCalls++;if(mode!=="PASS")throw primary;return result;},()=>{freeCalls++;if(freeFails)throw cleanup;});}
  catch(error){caught=true;thrown=error;}
  return {batch,primary,cleanup,result,owned,next,bodyCalls,freeCalls,caught,thrown,returned};
}

it("R06-SRC-01 success: one release and unchanged return",()=>{
  const r=exercise("R06-SRC-01","PASS");
  expect(r.returned).toBe(r.result);expect(r.caught).toBe(false);
  expect(r.owned.observation.primaryPresent).toBe(false);
  expect(r.owned.observation.cleanup.status).toBe("PASS");
  expect(r.owned.observation.releaseAttempts).toBe(1);expect(r.freeCalls).toBe(1);
  expect(r.owned.observation.stopCauses).toEqual([]);expect(r.batch.poisoned).toBe(false);
});
it("R06-SRC-02 body undefined/free success: explicit presence",()=>{
  const r=exercise("R06-SRC-02","UNDEFINED");
  expect(r.caught).toBe(true);expect(r.thrown).toBeUndefined();
  expect(r.owned.observation.primaryPresent).toBe(true);
  expect(r.owned.observation.primary).toEqual({status:"FAIL",error:undefined});
  expect(r.owned.observation.cleanup.status).toBe("PASS");expect(r.freeCalls).toBe(1);
});
it("R06-SRC-03 body undefined/free failure: undefined remains original primary",()=>{
  const r=exercise("R06-SRC-03","UNDEFINED",true);
  expect(r.caught).toBe(true);expect(r.thrown).toBeUndefined();
  expect(r.owned.observation.primaryPresent).toBe(true);
  expect(r.owned.observation.cleanup).toEqual({status:"FAIL",error:r.cleanup});
  expect(r.owned.observation.stopCauses).toEqual(["CLEANUP_FAILURE"]);
  expect(r.freeCalls).toBe(1);expect(r.batch.poisoned).toBe(true);
});
it("R06-SRC-04 ordinary body failure/free success: original identity",()=>{
  const r=exercise("R06-SRC-04","FAIL");
  expect(r.caught).toBe(true);expect(r.thrown).toBe(r.primary);
  expect(r.owned.observation.primaryPresent).toBe(true);
  expect(r.owned.observation.cleanup.status).toBe("PASS");
  expect(r.owned.observation.stopCauses).toEqual([]);expect(r.batch.poisoned).toBe(false);
  expect(r.bodyCalls).toBe(1);expect(r.freeCalls).toBe(1);
});
it("R06-SRC-05 existing RuntimeError contract/free success: poison and no next body",()=>{
  const r=exercise("R06-SRC-05","NATIVE_TRAP");
  expect(r.thrown).toBe(r.primary);expect(r.owned.observation.cleanup.status).toBe("PASS");
  expect(r.owned.observation.stopCauses).toEqual(["BODY_NATIVE_TRAP"]);
  expect(r.owned.observation.disposition).toBe("POISONED");expect(r.batch.poisoned).toBe(true);
  let laterCalls=0;expect(()=>r.next.run(()=>{laterCalls++;},()=>{laterCalls++;},()=>{laterCalls++;})).toThrow();
  expect(laterCalls).toBe(0);expect(r.next.observation.releaseAttempts).toBe(0);
  expect(()=>prepareCase(r.batch,"fresh")).toThrow();expect(r.freeCalls).toBe(1);
});
it("R06-SRC-06 body success/free failure: cleanup identity and independent cause",()=>{
  const r=exercise("R06-SRC-06","PASS",true);
  expect(r.caught).toBe(true);expect(r.thrown).toBe(r.cleanup);
  expect(r.owned.observation.primaryPresent).toBe(false);
  expect(r.owned.observation.primary).toEqual({status:"PASS",result:r.result});
  expect(r.owned.observation.stopCauses).toEqual(["CLEANUP_FAILURE"]);expect(r.freeCalls).toBe(1);
});
it("R06-SRC-07 primary plus cleanup failure: primary wins, cleanup retained",()=>{
  const r=exercise("R06-SRC-07","FAIL",true);
  expect(r.thrown).toBe(r.primary);
  expect(r.owned.observation.primary).toEqual({status:"FAIL",error:r.primary});
  expect(r.owned.observation.cleanup).toEqual({status:"FAIL",error:r.cleanup});
  expect(r.owned.observation.stopCauses).toEqual(["CLEANUP_FAILURE"]);expect(r.freeCalls).toBe(1);
});
it("R06-SRC-08 body trap plus cleanup failure: two separate causes",()=>{
  const r=exercise("R06-SRC-08","NATIVE_TRAP",true);
  expect(r.thrown).toBe(r.primary);
  expect(r.owned.observation.cleanup).toEqual({status:"FAIL",error:r.cleanup});
  expect(r.owned.observation.stopCauses).toEqual(["BODY_NATIVE_TRAP","CLEANUP_FAILURE"]);
  expect(r.owned.observation.disposition).toBe("POISONED");expect(r.freeCalls).toBe(1);
});
it("R06-SRC-09 consumed case cannot rerun body or disposer",()=>{
  const r=exercise("R06-SRC-09","PASS");
  let calls=0;expect(()=>r.owned.run(()=>{calls++;},()=>{calls++;},()=>{calls++;})).toThrow();
  expect(calls).toBe(0);expect(r.owned.observation.releaseAttempts).toBe(1);
  expect(r.owned.observation.primaryPresent).toBe(false);expect(r.freeCalls).toBe(1);
});

it("R07-SRC-10 acquisition throws undefined: no body, no release, no acquired handle",()=>{
  const batch={poisoned:false},owned=prepareCase(batch,"R07-SRC-10");
  let acquires=0,bodies=0,frees=0,caught=false,thrown:unknown;
  try{owned.run(()=>{acquires++;throw undefined;},()=>{bodies++;},()=>{frees++;});}
  catch(error){caught=true;thrown=error;}
  expect(caught).toBe(true);expect(thrown).toBeUndefined();expect(acquires).toBe(1);
  expect(owned.observation.acquisition).toEqual({status:"FAIL",error:undefined});
  expect(owned.observation.acquired).toBe(false);expect(owned.observation.primary.status).toBe("NOT_RUN");
  expect(owned.observation.primaryPresent).toBe(false);expect(owned.observation.cleanup.status).toBe("NOT_RUN");
  expect(bodies).toBe(0);expect(frees).toBe(0);expect(owned.observation.releaseAttempts).toBe(0);
  expect(owned.observation.disposition).toBe("NOT_ACQUIRED");expect(batch.poisoned).toBe(false);
  expect(()=>owned.run(()=>{acquires++;},()=>{bodies++;},()=>{frees++;})).toThrow();
  expect(acquires).toBe(1);expect(frees).toBe(0);
});
it("R07-SRC-11 acquisition RuntimeError: poison before another acquire",()=>{
  const batch={poisoned:false},owned=prepareCase(batch,"R07-SRC-11"),next=prepareCase(batch,"next");
  const error=new WebAssembly.RuntimeError("source-only acquisition sentinel");
  let caught:unknown,calls=0;
  try{owned.run(()=>{throw error;},()=>{calls++;},()=>{calls++;});}catch(e){caught=e;}
  expect(caught).toBe(error);expect(batch.poisoned).toBe(true);
  expect(owned.observation.stopCauses).toEqual(["ACQUISITION_NATIVE_TRAP"]);
  expect(owned.observation.acquired).toBe(false);expect(owned.observation.releaseAttempts).toBe(0);
  expect(()=>next.run(()=>{calls++;},()=>{calls++;},()=>{calls++;})).toThrow();expect(calls).toBe(0);
});
it("R07-SRC-12 shared receiver export: prepared18 trap blocks original6 before acquisition",()=>{
  // Same cached observer export used by both candidate import edges; no actual harness import/native call.
  const prepared18Owned=prepareCase(receiverBatch,"prepared18-source-client");
  const original6Owned=prepareCase(receiverBatch,"original6-source-client");
  const error=new WebAssembly.RuntimeError("source-only shared-client sentinel");
  let caught:unknown,freeCalls=0,laterCalls=0;
  try{prepared18Owned.run(()=>({sentinel:"owned"}),()=>{throw error;},()=>{freeCalls++;});}
  catch(e){caught=e;}
  expect(caught).toBe(error);expect(freeCalls).toBe(1);
  expect(prepared18Owned.observation.cleanup.status).toBe("PASS");expect(receiverBatch.poisoned).toBe(true);
  expect(()=>original6Owned.run(()=>{laterCalls++;},()=>{laterCalls++;},()=>{laterCalls++;})).toThrow();
  expect(laterCalls).toBe(0);expect(original6Owned.observation.acquisition.status).toBe("NOT_RUN");
  expect(original6Owned.observation.releaseAttempts).toBe(0);
  expect(()=>prepareCase(receiverBatch,"fresh-after-shared-trap")).toThrow();
});

