import fs from "node:fs";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import crypto from "node:crypto";
assert(process.cwd().replaceAll("\\","/").startsWith("C:/IFI_SourceCode/"));
const id=process.argv[2];assert(id&&/^[a-z0-9-]+$/.test(id),"Pass unique run ID");
const dir="evidence/runs/"+id;fs.mkdirSync(dir,{recursive:false});
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+"/"+e.name):[d+"/"+e.name]);
const inputs=[...walk("src"),...walk("tests"),...fs.readdirSync(".").filter(p=>p.endsWith(".mjs")),
  "package.json","package-lock.json","tsconfig.json","node_modules/rapier012/rapier.cjs.js","node_modules/rapier012/rapier_wasm3d_bg.wasm",
  "node_modules/rapier021/dist/rapier.mjs","node_modules/rapier021/dist/rapier_wasm3d_bg.wasm"]
  .sort().map(path=>({path,sha256:sha(fs.readFileSync(path))}));
fs.writeFileSync(dir+"/input-binding.json",JSON.stringify({node:process.version,inputs},null,2)+"\n");
const steps=[
  ["snapshot",["snapshot.mjs","--check"]],
  ["build",["node_modules/typescript/bin/tsc","-p","tsconfig.json"]],
  ["tests",["--test","--test-concurrency=1","dist/tests/fixtures.test.js","dist/tests/geometry.test.js","dist/tests/hestia.test.js","dist/tests/native.test.js"]],
  ["repro",["dist/src/repro.js","--mode=all"]],
  ["seam-probe",["seam-probe.mjs"]]];
const results=[];
for(const [name,args] of steps){
  const r=spawnSync(process.execPath,args,{encoding:"utf8",maxBuffer:8*1024*1024,env:{...process.env,PHY02_RUN_DIR:dir}});
  fs.writeFileSync(dir+"/"+name+".log",(r.stdout??"")+(r.stderr??""));
  results.push({name,command:"node "+args.join(" "),exitCode:r.status,error:r.error?.message??null});
  console.log(name+": "+r.status);
  fs.writeFileSync(dir+"/exitcodes.json",JSON.stringify(results,null,2)+"\n");
  if(r.status!==0){process.exitCode=1;if(name==="snapshot"||name==="build")break;}
}
