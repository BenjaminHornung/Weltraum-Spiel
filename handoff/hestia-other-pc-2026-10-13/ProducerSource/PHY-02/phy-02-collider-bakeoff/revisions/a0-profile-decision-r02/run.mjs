import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {root,prior,file,json,write,walk,sha,checkPrior} from "./bind.mjs";
const name=process.argv[2];assert(name&&/^[a-z0-9-]+$/.test(name));fs.mkdirSync("runs",{recursive:true});const dir=path.join(root,"runs",name);fs.mkdirSync(dir);
const owner=json("owner-binding.json");for(const f of [owner.decision,owner.olderConsumer])assert.equal(sha(fs.readFileSync(f.ownPath)),f.sha256);
write(path.join(dir,"input-binding.json"),{prior:checkPrior(),ownerBinding:file("owner-binding.json"),source:walk(root,new Set(["runs","node_modules"])).map(file),
  node:{...file(process.execPath),version:process.version},dependencyLock:file(path.join(prior,"package-lock.json")),
  classification:"SERIAL_CPU_WASM_FUNCTIONAL_OWNER_BINDING_AND_GUARDED_NEGATIVE_ONLY_NO_PILOT_OR_BUILD_WAVE"});
const rows=[];
for(const [id,source,filter] of [["selected-profile","tests/selected-profile.test.ts","selected primary candidate"],
  ["historical-f7-guarded","tests/guarded-structuralPgTragwerkF7.test.ts","T1: Dichtepfad"]]){
  const args=[path.join(prior,"node_modules/vitest/vitest.mjs"),"run","--config","vitest.config.ts",source,"-t",filter];
  const env={PHY02_RESULT:path.join(dir,id+".results.json"),PHY02_WASM:path.join(dir,id+".wasm.json"),PHY02_F7_CLEANUP:path.join(dir,"f7-cleanup.json")};
  const r=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,...env},encoding:"utf8",timeout:200000,maxBuffer:4*1024*1024});
  for(const stream of ["stdout","stderr"])fs.writeFileSync(path.join(dir,id+"."+stream+".log"),r[stream]??"",{flag:"wx"});
  const row={id,executable:process.execPath,cwd:root,args,environment:env,exitCode:r.status,signal:r.signal,error:r.error?.message??null,
    outerProcessLimitMs:200000,originalT1DeadlineMs:180000,originalInitDeadlineMs:120000};
  rows.push(row);write(path.join(dir,id+".command.json"),row);console.log(id+": exit "+r.status);
}
write(path.join(dir,"exitcodes.json"),rows);write(path.join(dir,"post-prior-check.json"),checkPrior());process.exitCode=rows.some(r=>r.exitCode!==0)?1:0;
