import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {fullCatalog} from "../src/selection.js";
import {parseBoundJson,consumeCaseRecords} from "../src/result-consumer.js";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const run=process.argv.find(a=>a.startsWith("--run="))?.slice(6);
if(!run||!/^[a-z][a-z0-9-]{0,63}$/.test(run))throw new Error("Explicit owned run slug required");
const dir=path.join(root,"runs",run);
function read(name:string,maxBytes:number){
 const target=path.join(dir,name),stat=fs.lstatSync(target);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)throw new Error("Bound regular raw file required");
 const bytes=fs.readFileSync(target);return {bytes,sha256:createHash("sha256").update(bytes).digest("hex")};
}
const inputFile=read("input-binding.json",256*1024),input=parseBoundJson(inputFile.bytes,256*1024) as Record<string,unknown>;
if(input.engineBinding!=="CURRENT_A0_A65_196_F26"||input.wasmSha256!=="f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb"||!Array.isArray(input.selectedIds))throw new Error("Run source pairing drift");
const selected=input.selectedIds.map(id=>{
 if(typeof id!=="string")throw new Error("Invalid selected ID");
 const c=fullCatalog.find(c=>c.id===id);if(!c)throw new Error("Unknown selected ID");return c;
});
if(selected.length===0||new Set(selected.map(c=>c.id)).size!==selected.length)throw new Error("Selection duplicate/empty");
const raw=[],rawBindings=[];
for(const c of selected){
 const name=c.ordinal+".json";if(!fs.existsSync(path.join(dir,name)))break;
 const file=read(name,1024*1024);raw.push(parseBoundJson(file.bytes,1024*1024));
 rawBindings.push({name,bytes:file.bytes.length,sha256:file.sha256});
}
const result=consumeCaseRecords(raw,selected,{engineBinding:String(input.engineBinding),wasmSha256:String(input.wasmSha256)});
const output={schema:"phy02.r11.bounded-result-consumption",inputBinding:{bytes:inputFile.bytes.length,sha256:inputFile.sha256},rawBindings,
 result,classification:"DATA_PROTOCOL_ONLY_ACTUAL_EXECUTION_REQUIRES_RUNNER_RECEIPT",nativeAcceptance:false,referenceAcceptance:false};
fs.writeFileSync(path.join(dir,"consumed.json"),JSON.stringify(output,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({protocol:result.protocol,records:result.records.length,missing:result.missing.length,ordinaryFailures:result.ordinaryFailures.length,nativeAcceptance:false}));

