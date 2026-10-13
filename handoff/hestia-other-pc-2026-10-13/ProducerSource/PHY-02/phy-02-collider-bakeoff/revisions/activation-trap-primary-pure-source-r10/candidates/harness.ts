import {afterAll,it,type TestContext} from "vitest";
import fs from "node:fs";
import path from "node:path";
import {context,worldFor,type Profile,type Context} from "../../phy01-migration2-r01/src/fork";
import type {Kind} from "../../phy01-migration2-r01/previous/src/geometry";
import {prepareCase,receiverBatch} from "./observer";
const profile=process.env.PHY02_PROFILE as Profile,kind=process.env.PHY02_KIND as Kind;
export const active=context(profile,kind);
export const records:Record<string,unknown>[]=[];
let current:Record<string,unknown>|undefined;
export const errorData=(e:unknown)=>e instanceof Error?{name:e.name,message:e.message,stack:e.stack}:String(e);
export function functional(name:string,run:(ctx:TestContext)=>void|Promise<void>){
  it(name,async ctx=>{
    const row:Record<string,unknown>={name,profile:active.id,kind,status:"NOT_RUN",cleanup:"NOT_RUN"};
    records.push(row);
    if(receiverBatch.poisoned){row.reason="Earlier native trap or cleanup failure poisoned this proposed receiver module instance";ctx.skip(String(row.reason));return;}
    current=row;const start=performance.now();
    try{await run(ctx);row.status="PASS";}
    catch(error){row.status="FAIL";row.primary=errorData(error);if(error instanceof WebAssembly.RuntimeError)receiverBatch.poisoned=true;throw error;}
    finally{row.diagnosticElapsedMs=performance.now()-start;current=undefined;}
  });
}
export function withWorld<T>(run:(world:ReturnType<typeof worldFor>)=>T,gravity:Parameters<typeof worldFor>[1]=0):T{
  const owned=prepareCase(receiverBatch,`${profile}-${kind}-lifecycle::${String(current?.name??"withWorld")}`);
  if(current)current.resourceObservation=owned.observation;
  try{return owned.run(()=>worldFor(active,gravity),run,world=>world.free());}
  finally{
    if(current){
      const cleanup=owned.observation.cleanup;
      current.cleanup=cleanup.status==="FAIL"?{status:"FAIL",error:errorData(cleanup.error)}:cleanup.status;
    }
  }
}
export function observe(values:Record<string,unknown>){if(current)Object.assign(current,values);}
export function withCleanup<T>(run:()=>T,dispose:()=>void,owner:string):T{
  const owned=prepareCase(receiverBatch,owner);
  const cleanups=(current?.ownerCleanup??[]) as unknown[];
  if(current)current.ownerCleanup=cleanups;
  cleanups.push(owned.observation);
  return owned.run(()=>undefined,run,dispose);
}
afterAll(()=>{
  const output=process.env.PHY02_OBSERVATIONS;if(!output)return;
  const resolved=path.resolve(output),root=process.cwd();
  if(!resolved.startsWith(root+path.sep)||!resolved.includes(path.sep+"runs"+path.sep))throw new Error("Observation output outside own run scope");
  fs.writeFileSync(resolved,JSON.stringify({classification:"SERIAL_CPU_WASM_FUNCTIONAL_NOT_HARDWARE_OR_HVP_PILOT",profile:active.id,kind,records},null,2)+"\n",{flag:"wx"});
});

