import {it,type TestContext} from "vitest";
import fs from "node:fs";
import path from "node:path";
import {selectCase} from "../src/selection";
import {activeContext,worldFor} from "../src/fork";
import {prepareCase,receiverBatch,type CaseObservation} from "@phy02-current/observer";
import type {CaseRecord,ErrorValue,ResourceObservation} from "../src/case-types";
export const active=activeContext();
export const records:CaseRecord[]=[];
let current:CaseRecord|undefined;
const encodeError=(error:unknown):ErrorValue=>error===undefined?{kind:"ThrownUndefined"}:error instanceof Error?{kind:"Error",name:error.name,message:error.message}:{kind:"ThrownValue",value:String(error)};
function serialObservation(o:CaseObservation):ResourceObservation{
 return {...o,
 acquisition:o.acquisition.status==="FAIL"?{status:"FAIL",error:encodeError(o.acquisition.error)}:o.acquisition,
 primary:o.primary.status==="FAIL"?{status:"FAIL",error:encodeError(o.primary.error)}:{status:o.primary.status},
 cleanup:o.cleanup.status==="FAIL"?{status:"FAIL",error:encodeError(o.cleanup.error)}:{status:o.cleanup.status}};
}
export function functional(name:string,run:(ctx:TestContext)=>void|Promise<void>){
 it(name,async ctx=>{
   const c=selectCase(active.profile,active.kind,process.env.PHY02_GROUP??"",name);
   const row:CaseRecord={caseId:c.id,ordinal:c.ordinal,profile:c.profile,kind:c.kind,group:c.group,gyro:c.gyro,
     status:"NOT_RUN",primaryPresent:false,resources:[],diagnostics:{},poisoned:receiverBatch.poisoned,
     engineBinding:"CURRENT_A0_A65_196_F26",wasmSha256:"f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb",classification:"DIAGNOSTIC_NOT_REFERENCE"};
   records.push(row);
   if(receiverBatch.poisoned){ctx.skip("Prior trap/acquisition/cleanup/output failure poisoned this case process");return;}
   current=row;let primaryPresent=false;
   try{await run(ctx);row.status="PASS";}
   catch(error){primaryPresent=true;row.primaryPresent=true;row.status="FAIL";row.primary=encodeError(error);if(error instanceof WebAssembly.RuntimeError)receiverBatch.poisoned=true;throw error;}
   finally{
     row.poisoned=receiverBatch.poisoned;current=undefined;
     try{writeRecord(row);}catch(error){receiverBatch.poisoned=true;row.poisoned=true;if(!primaryPresent)throw error;}
   }
 });
}
function writeRecord(row:CaseRecord){
 const output=process.env.PHY02_OBSERVATIONS_ROOT;if(!output)throw new Error("Missing Runner-owned observation root");
 const resolved=path.resolve(output),root=path.resolve(process.cwd(),"runs");
 if(!resolved.startsWith(root+path.sep))throw new Error("Observation output outside own new runs");
 const bytes=Buffer.from(JSON.stringify(row)+"\n");if(bytes.length>1024*1024)throw new Error("Case record byte limit");
 fs.writeFileSync(path.join(resolved,row.ordinal+".json"),bytes,{flag:"wx"});
}
function resource<T,W>(owner:string,acquire:()=>W,body:(w:W)=>T,dispose:(w:W)=>void):T{
 if(!current)throw new Error("Resource acquisition outside a bound functional case");
 const owned=prepareCase(receiverBatch,current.caseId+"/"+owner+"/"+current.resources.length);
 try{return owned.run(acquire,body,dispose);}
 finally{
  if(owned.observation.acquisition.status==="FAIL")receiverBatch.poisoned=true;
  current.resources.push(serialObservation(owned.observation));
 }
}
export function withWorld<T>(body:(world:ReturnType<typeof worldFor>)=>T,gravity:Parameters<typeof worldFor>[1]=0):T{
 return resource("world",()=>worldFor(active,gravity),body,w=>w.free());
}
export function withCleanup<T>(body:()=>T,dispose:()=>void,owner:string):T{
 return resource(owner,()=>undefined,body,dispose);
}
export function observe(values:Record<string,unknown>){if(current)Object.assign(current.diagnostics,values);}

