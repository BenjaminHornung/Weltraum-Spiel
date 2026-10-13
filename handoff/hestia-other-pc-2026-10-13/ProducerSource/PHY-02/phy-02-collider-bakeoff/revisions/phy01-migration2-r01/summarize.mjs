import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {root,json,write,sha,file,verifyCopies} from "./bindings.mjs";
const dir="runs/full-functional-04",commands=json(dir+"/exitcodes.json");assert.equal(commands.length,98);
const cases=fs.readdirSync(dir).filter(p=>p.endsWith(".observations.json")).sort().flatMap(p=>json(dir+"/"+p).records.map(row=>({
  ...row,evidence:dir+"/"+p,acceptance:row.status!=="PASS"?row.status:row.matureBodyCut?.startsWith("UNSUPPORTED")?"UNSUPPORTED":row.nativeNeighborApi==="NOT_APPLICABLE"?"NOT_APPLICABLE":"PASS"
})));
const count=(rows,key)=>Object.fromEntries([...new Set(rows.map(r=>r[key]))].sort().map(s=>[s,rows.filter(r=>r[key]===s).length]));
assert.equal(cases.length,192);assert.deepEqual(count(cases,"status"),{FAIL:46,PASS:146});
assert.deepEqual(count(cases,"acceptance"),{FAIL:46,NOT_APPLICABLE:4,PASS:138,UNSUPPORTED:4});
const traps=cases.filter(c=>c.primary?.name==="RuntimeError");assert.equal(traps.length,12);assert(traps.every(c=>c.cleanup?.status==="FAIL"));
for(const f of json(dir+"/input-binding.json").source.filter(f=>/^(src\/|tests\/|package|vite.config|tsconfig|build-smoke)/.test(f.path)))
  assert.equal(sha(fs.readFileSync(f.path)),f.sha256,"Changed executed runtime/test input after full04 "+f.path);
const groups=[...new Set(cases.map(c=>c.profile+"/"+c.kind))].sort().map(id=>{
  const rows=cases.filter(c=>c.profile+"/"+c.kind===id);return {id,raw:count(rows,"status"),acceptance:count(rows,"acceptance"),cleanupFailures:rows.filter(c=>c.cleanup?.status==="FAIL").length};
});
const sources=["source-query-unchanged","source-moving-cut-unchanged","source-body-save-unchanged","source-locomotion-unchanged"].map(id=>{
  const r=json(dir+"/"+id+".vitest.json");return {id,passed:r.numPassedTests,failed:r.numFailedTests,skipped:r.numPendingTests,evidence:dir+"/"+id+".vitest.json"};
});
for(const id of ["positive-source-repaired","historical-f7-t1-unchanged","fixture-binding"]){const p="runs/supplemental-05/"+id+".vitest.json",r=json(p);
  sources.push({id,passed:r.numPassedTests,failed:r.numFailedTests,filtered:r.numPendingTests,evidence:p});}
write("matrix.json",{schema:"phy02.migration2.matrix.r01",status:"PARTIAL_RETAINED_NEGATIVES",executionLocation:"LOCAL_WINDOWS_ISOLATED",
  productIntegration:"NO",raw:count(cases,"status"),acceptance:count(cases,"acceptance"),groups,cases,sources,
  historicalImportFailure:{id:"source-profile-positive-unchanged",status:"FAIL_BEFORE_TEST_IMPORT",repairedBy:"runs/supplemental-05/positive-source-repaired.vitest.json"},
  commands:commands.map(r=>({id:r.id,exitCode:r.exitCode,commandBinding:dir+"/"+r.id+".command.json"})),
  copies:verifyCopies(),wasmCaptures:fs.readdirSync(dir).filter(p=>p.endsWith(".wasm.json")).sort().map(p=>({...file(dir+"/"+p),capture:json(dir+"/"+p)})),
  timings:"diagnostic only, concurrent sessions, no qualified edit-to-contact or reference claim",externalGates:"runner-rest-profile.json"});
console.log("PASS aggregate:192 own cases146PASS46FAIL,138 acceptancePASS;12 primary native traps with secondary cleanupFAIL; executed runtime/test bytes unchanged");
