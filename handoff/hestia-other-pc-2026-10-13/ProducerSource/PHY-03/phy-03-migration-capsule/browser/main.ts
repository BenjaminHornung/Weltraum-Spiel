import {runIndexedDbChecks} from "./indexeddb-check";
import {migrateLegacy,encodeEnvelope,decodeEnvelope,sha256} from "../src/capsule";
import {createUniquePhy03DatabaseName,openIndexedDbPublicationStore,PUBLICATION_CRASH_PHASES} from "../src/publication";
import legacyWorldText from "../fixtures/legacy-world.json?raw";

declare global {interface Window {PHY03Result?:unknown}}
function assert(value:unknown,message:string):asserts value{if(!value){throw new Error(message);}}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
async function run(){
  const checks:{name:string;status:"PASS"|"FAIL";detail?:string}[]=[],raw=new TextEncoder().encode(legacyWorldText);
  const envelope=await migrateLegacy(raw,"world"),candidate=encodeEnvelope(envelope);
  const storage=await runIndexedDbChecks();
  for(const phase of PUBLICATION_CRASH_PHASES){
    const name=createUniquePhy03DatabaseName(),a=await openIndexedDbPublicationStore(name),b=await openIndexedDbPublicationStore(name);
    try{
      const pointer=await a.seedLegacy("legacy-control",raw);
      let crashed=false;
      try{await a.publish({slotId:"candidate-envelope",bytes:candidate,expectedPointer:pointer,
        validate:async bytes=>{await decodeEnvelope(bytes);},crashAt:phase});}
      catch(error){assert((error as {code?:string}).code==="SIMULATED_CRASH",`Unexpected failure ${String(error)}`);crashed=true;}
      assert(crashed,`Crash not reached: ${phase}`);
      const visible=await b.getPointer(),original=await b.readSlot("legacy-control");
      assert(original&&same([...original.bytes],[...raw]),"Original bytes changed");
      assert(visible?.slotId===(phase==="afterPointer"?"candidate-envelope":"legacy-control"),"Wrong crash pointer");
      if(phase==="afterPointer"){
        const staged=await b.readSlot("candidate-envelope");assert(staged,"Missing committed bytes");await decodeEnvelope(staged.bytes);
        const back=await b.compareAndSwapPointer(visible!,"legacy-control",pointer.digest);assert(back.revision===2,"Rollback revision/ABA");
        let stale=false;try{await a.compareAndSwapPointer(pointer,"candidate-envelope");}catch{stale=true;}assert(stale,"ABA CAS accepted");
      }
      checks.push({name:`real-envelope-indexeddb-crash-${phase}`,status:"PASS"});
    }catch(error){checks.push({name:`real-envelope-indexeddb-crash-${phase}`,status:"FAIL",detail:String(error)});}
    finally{
      a.close();b.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);
        request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error("Test cleanup blocked"));});
    }
  }
  const name=createUniquePhy03DatabaseName(),a=await openIndexedDbPublicationStore(name),b=await openIndexedDbPublicationStore(name);
  try{
    const p=await a.seedLegacy("legacy-control",raw);
    const results=await Promise.allSettled([a.publish({slotId:"writer-a",bytes:candidate,expectedPointer:p,validate:async bytes=>{await decodeEnvelope(bytes);}}),
      b.publish({slotId:"writer-b",bytes:candidate,expectedPointer:p,validate:async bytes=>{await decodeEnvelope(bytes);}})]);
    assert(results.filter(r=>r.status==="fulfilled").length===1,"CAS race must have one winner");
    const visible=await a.getPointer();assert(visible,"Missing CAS winner");const slot=await a.readSlot(visible.slotId);assert(slot,"Missing winner slot");
    await decodeEnvelope(slot.bytes);checks.push({name:"real-envelope-two-connection-CAS-race",status:"PASS"});
  }catch(error){checks.push({name:"real-envelope-two-connection-CAS-race",status:"FAIL",detail:String(error)});}
  finally{a.close();b.close();await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error("cleanup blocked"));});}
  return {status:storage.status==="PASS"&&checks.every(c=>c.status==="PASS")?"PASS":"FAIL",
    execution:"LOCAL_WINDOWS_ISOLATED",qualification:"FUNCTIONAL_DIAGNOSTIC_ONLY",actualBackend:"IndexedDB",
    actualAdapter:"NOT_REQUESTED_NO_RENDERER",gpuTimer:"NOT_REQUESTED",hardwareReference:"NOT_RUN",newSolverLifecycle:"NOT_RUN",
    inputSha256:await sha256(raw),envelopeSha256:await sha256(candidate),storage,checks,
    browser:{userAgent:navigator.userAgent,platform:navigator.platform,dpr:devicePixelRatio,width:innerWidth,height:innerHeight,
      visibility:document.visibilityState,hardwareConcurrency:navigator.hardwareConcurrency},environmentLoad:"CONCURRENT_SESSIONS_NO_EXCLUSIVE_SLOT"};
}
run().then(result=>{window.PHY03Result=result;document.querySelector("#result")!.textContent=JSON.stringify(result,null,2);})
  .catch(error=>{window.PHY03Result={status:"FAIL",error:String(error)};document.querySelector("#result")!.textContent=String(error);});
