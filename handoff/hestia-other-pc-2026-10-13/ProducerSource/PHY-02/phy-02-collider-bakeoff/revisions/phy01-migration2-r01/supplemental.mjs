import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {root,verifyCopies,inputs,file,scope,write} from "./bindings.mjs";
const name=process.argv[2];assert(name&&/^[a-z0-9-]+$/.test(name));const dir=path.join(root,"runs",name);fs.mkdirSync(dir);
write(path.join(dir,"input-binding.json"),{scope:scope(),copies:verifyCopies(),source:inputs(),node:{...file(process.execPath),version:process.version},
  classification:"SUPPLEMENTAL_SERIAL_FUNCTIONAL_NO_HARDWARE_NATIVE_TOOLCHAIN_HVP_PILOT"});
const rows=[];
for(const [id,source,extra] of [
  ["positive-source-repaired","producer/tests/candidate-profile.test.ts",["-t","corrects the historical F7|binds the actual gyro"]],
  ["historical-f7-t1-unchanged","producer/snapshot/c/tests/unit/structuralPgTragwerkF7.test.ts",["-t","T1: Dichtepfad"]],
  ["fixture-binding","tests/fixture-binding.test.ts",[]]
]){
  const args=["node_modules/vitest/vitest.mjs","run","--config","supplemental.config.ts",source,...extra];
  const env={PHY02_RESULT:path.join(dir,id+".vitest.json"),PHY02_WASM:path.join(dir,id+".wasm.json"),PHY02_FIXTURES:path.join(dir,"fixtures.json")};
  const r=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,...env},encoding:"utf8",timeout:120000,maxBuffer:8*1024*1024});
  for(const stream of ["stdout","stderr"])fs.writeFileSync(path.join(dir,id+"."+stream+".log"),r[stream]??"",{flag:"wx"});
  const row={id,executable:process.execPath,args,cwd:root,environment:env,exitCode:r.status,error:r.error?.message??null,signal:r.signal};
  rows.push(row);write(path.join(dir,id+".command.json"),row);console.log(id+": exit "+r.status);
}
write(path.join(dir,"exitcodes.json"),rows);write(path.join(dir,"post-copy-check.json"),verifyCopies());process.exitCode=rows.some(r=>r.exitCode!==0)?1:0;
