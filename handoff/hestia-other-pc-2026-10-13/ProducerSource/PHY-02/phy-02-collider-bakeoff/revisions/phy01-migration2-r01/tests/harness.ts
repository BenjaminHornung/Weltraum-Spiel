import {afterAll,it,type TestContext} from "vitest";
import fs from "node:fs";
import path from "node:path";
import {context,worldFor,type Profile,type Context} from "../src/fork";
import type {Kind} from "../previous/src/geometry";
const profile=process.env.PHY02_PROFILE as Profile,kind=process.env.PHY02_KIND as Kind;
export const active=context(profile,kind);
export const records:Record<string,unknown>[]=[];
let poisoned=false,current:Record<string,unknown>|undefined;
export const errorData=(e:unknown)=>e instanceof Error?{name:e.name,message:e.message,stack:e.stack}:String(e);
export function functional(name:string,run:(ctx:TestContext)=>void|Promise<void>){
  it(name,async ctx=>{
    const row:Record<string,unknown>={name,profile:active.id,kind,status:"NOT_RUN",cleanup:"NOT_RUN"};
    records.push(row);
    if(poisoned){row.reason="Earlier native trap poisoned this disposable test process";ctx.skip(String(row.reason));return;}
    current=row;const start=performance.now();
    try{await run(ctx);row.status="PASS";}
    catch(error){row.status="FAIL";row.primary=errorData(error);if(error instanceof WebAssembly.RuntimeError)poisoned=true;throw error;}
    finally{row.diagnosticElapsedMs=performance.now()-start;current=undefined;}
  });
}
export function withWorld<T>(run:(world:ReturnType<typeof worldFor>)=>T,gravity:Parameters<typeof worldFor>[1]=0):T{
  const world=worldFor(active,gravity);let primary:unknown;
  try{return run(world);}catch(e){primary=e;throw e;}
  finally{
    try{world.free();if(current)current.cleanup="PASS";}
    catch(cleanup){poisoned=true;if(current)current.cleanup={status:"FAIL",error:errorData(cleanup)};if(primary===undefined)throw cleanup;}
  }
}
export function observe(values:Record<string,unknown>){if(current)Object.assign(current,values);}
export function withCleanup<T>(run:()=>T,dispose:()=>void,owner:string):T{
  let primary:unknown;
  try{return run();}catch(error){primary=error;throw error;}
  finally{
    const cleanups=(current?.ownerCleanup??[]) as Record<string,unknown>[];
    if(current)current.ownerCleanup=cleanups;
    try{dispose();cleanups.push({owner,status:"PASS"});}
    catch(error){poisoned=true;cleanups.push({owner,status:"FAIL",error:errorData(error)});if(primary===undefined)throw error;}
  }
}
afterAll(()=>{
  const output=process.env.PHY02_OBSERVATIONS;if(!output)return;
  const resolved=path.resolve(output),root=process.cwd();
  if(!resolved.startsWith(root+path.sep)||!resolved.includes(path.sep+"runs"+path.sep))throw new Error("Observation output outside own run scope");
  fs.writeFileSync(resolved,JSON.stringify({classification:"SERIAL_CPU_WASM_FUNCTIONAL_NOT_HARDWARE_OR_HVP_PILOT",profile:active.id,kind,records},null,2)+"\n",{flag:"wx"});
});
