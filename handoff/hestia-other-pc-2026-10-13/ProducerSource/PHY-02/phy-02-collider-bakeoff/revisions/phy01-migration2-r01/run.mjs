import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {root,file,write,scope,verifyCopies,inputs} from "./bindings.mjs";
const name=process.argv.find(a=>a.startsWith("--run="))?.slice(6);
assert(name&&/^[a-z0-9-]+$/.test(name),"Required new --run=unique-name; outputs never overwrite");
const only=process.argv.find(a=>a.startsWith("--only="))?.slice(7);
assert(!only||["core","kcc","lifecycle","seam","source"].includes(only));
const dir=path.join(root,"runs",name);fs.mkdirSync(path.dirname(dir),{recursive:true});fs.mkdirSync(dir);
write(path.join(dir,"input-binding.json"),{classification:"SERIAL_CPU_WASM_FUNCTIONAL_NOT_HARDWARE_OR_HVP_PILOT",scope:scope(),copies:verifyCopies(),
  source:inputs(),node:{...file(process.execPath),version:process.version},git:file("C:\\IFI_SourceCode\\Utils\\opencode-migration\\runtime\\git\\cmd\\git.exe"),
  nativeTools:"NOT_EXECUTED_PRODUCER_NATIVE_RECEIPT_ONLY",environment:{hardwareSlot:"NOT_GRANTED",workers:1,fileParallelism:false}});
const rows=[];
function run(id,args,env={}){
  const start=new Date().toISOString();
  const result=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,...env},encoding:"utf8",timeout:120000,maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(dir,id+".stdout.log"),result.stdout??"",{flag:"wx"});
  fs.writeFileSync(path.join(dir,id+".stderr.log"),result.stderr??"",{flag:"wx"});
  const row={id,executable:process.execPath,cwd:root,args,environment:env,start,end:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?.message??null};
  rows.push(row);write(path.join(dir,id+".command.json"),row);console.log(id+": exit "+result.status);
  return result.status;
}
if(run("typecheck",["node_modules/typescript/bin/tsc","--noEmit"])!==0){write(path.join(dir,"exitcodes.json"),rows);process.exit(1);}
if(run("build",["node_modules/vite/bin/vite.js","build","--outDir",path.relative(root,path.join(dir,"dist"))])!==0){write(path.join(dir,"exitcodes.json"),rows);process.exit(1);}
if(run("build-smoke",["build-smoke.mjs",path.join(dir,"dist/phy02-consumer.js")])!==0){write(path.join(dir,"exitcodes.json"),rows);process.exit(1);}
function test(id,source,profile,kind,extra=[]){
  return run(id,["node_modules/vitest/vitest.mjs","run",source,...extra],{
    PHY02_PROFILE:profile,PHY02_KIND:kind,PHY02_RESULT:path.join(dir,id+".vitest.json"),
    PHY02_OBSERVATIONS:path.join(dir,id+".observations.json"),PHY02_WASM:path.join(dir,id+".wasm.json"),
    ...(id.includes("-seam-")?{PHY02_SEAM:id.split("-seam-")[1]}:{})
  });
}
for(const profile of ["legacy-impulse-v1","gyroscopic-v1"])for(const kind of ["triangles","multi-cuboid","voxels"]){
  for(const group of ["core","kcc","lifecycle"]){if(only&&only!==group)continue;
    test(profile+"-"+kind+"-"+group,"tests/matrix-"+group+".test.ts",profile,kind);}
  if(!only||only==="seam")for(const s of ["0.125","0.25"])for(const axis of ["x","y","z"])
    for(const phase of ["slide","edit"])test(profile+"-"+kind+"-seam-"+axis+"-"+s+"-"+phase,"tests/matrix-seam.test.ts",profile,kind);
}
if(!only||only==="source"){
  test("source-query-unchanged","producer/tests/candidate-query.test.ts","legacy-impulse-v1","multi-cuboid");
  test("source-profile-positive-unchanged","producer/tests/candidate-profile.test.ts","legacy-impulse-v1","multi-cuboid",
    ["-t","corrects the historical F7|binds the actual gyro"]);
  test("source-moving-cut-unchanged","producer/snapshot/c/tests/unit/hvp-moving-cut.test.ts","legacy-impulse-v1","multi-cuboid");
  test("source-body-save-unchanged","producer/snapshot/c/tests/unit/hvp-body-save.test.ts","legacy-impulse-v1","multi-cuboid");
  test("source-locomotion-unchanged","producer/snapshot/c/tests/unit/hvp-locomotion.test.ts","legacy-impulse-v1","multi-cuboid");
}
write(path.join(dir,"exitcodes.json"),rows);
write(path.join(dir,"post-copy-check.json"),verifyCopies());
process.exitCode=rows.some(r=>r.exitCode!==0)?1:0;
