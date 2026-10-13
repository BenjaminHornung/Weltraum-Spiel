import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
const spike=resolve(import.meta.dirname,".."),runtime=resolve(spike,".runtime");mkdirSync(runtime,{recursive:true});
const mode=process.argv[2]??"full",env={...process.env,TEMP:runtime,TMP:runtime};
const commands={test:["node_modules/vitest/vitest.mjs","run","--reporter=json","--outputFile=evidence/final-tests.json"],
  typecheck:["node_modules/typescript/bin/tsc","-p","tsconfig.json"],build:["node_modules/vite/bin/vite.js","build"]};
const selected=mode==="full"?["test","typecheck","build"]:mode==="build"?["typecheck","build"]:[mode];
if(selected.some(n=>!commands[n])){throw new Error("Mode must be full, test, typecheck or build");}
const records=[];
for(const name of selected){
  const args=commands[name],result=spawnSync(process.execPath,args,{cwd:spike,env,encoding:"utf8",maxBuffer:8*1024*1024});
  const record={name,command:[process.execPath,...args],exitCode:result.status,signal:result.signal,error:result.error?.message??null};
  writeFileSync(resolve(spike,`evidence/${name}.log`),(result.stdout??"")+(result.stderr??""));records.push(record);console.log(JSON.stringify(record));
  if(result.status!==0){break;}
}
const sha=file=>createHash("sha256").update(readFileSync(resolve(spike,file))).digest("hex");
writeFileSync(resolve(spike,"evidence/verification.json"),JSON.stringify({execution:"LOCAL_WINDOWS_ISOLATED",node:process.version,
  concurrentLoad:true,referenceQualification:"NOT_RUN",createdAt:new Date().toISOString(),records,
  bindings:{sourceManifest:sha("source-manifest.json"),lock:sha("package-lock.json"),solverProfile:sha("solver-profile.json")}},null,2)+"\n");
process.exitCode=records.every(r=>r.exitCode===0)&&records.length===selected.length?0:1;
