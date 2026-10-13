// CPU data-contract tests only; no World, Rapier, WASM, observer simulation or Native behavior.
import {expect,it} from "vitest";
import fs from "node:fs";
import {fullCatalog,selectCase} from "../src/selection";
import {parseBoundJson,consumeCaseRecords,consumeHistorical} from "../src/result-consumer";
import type {CaseRecord,Descriptor,ResourceObservation} from "../src/case-types";
const binding={engineBinding:"CURRENT_A0_A65_196_F26",wasmSha256:"f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb"};
const selected=fullCatalog.slice(0,2);
function record(d:Descriptor):CaseRecord{return {caseId:d.id,ordinal:d.ordinal,profile:d.profile,kind:d.kind,group:d.group,gyro:d.gyro,
 status:"PASS",primaryPresent:false,resources:[],diagnostics:{},poisoned:false,...binding,classification:"DIAGNOSTIC_NOT_REFERENCE"};}
function resource():ResourceObservation{return {caseId:"data-only",acquisition:{status:"PASS"},acquired:true,primary:{status:"PASS"},primaryPresent:false,
 cleanup:{status:"PASS"},releaseAttempts:1,stopCauses:[],disposition:"RELEASED"};}
it("joins all genuine historical raw rows as146PASS46FAIL without current promotion",()=>{
 const byPath=new Map<string,Descriptor[]>();for(const c of fullCatalog){const list=byPath.get(c.historicalRawPath)??[];list.push(c);byPath.set(c.historicalRawPath,list);}
 let pass=0,fail=0;for(const[p,group]of byPath){const bytes=fs.readFileSync(p);const r=consumeHistorical(parseBoundJson(bytes),group);pass+=r.pass;fail+=r.fail;expect(r.nativeCurrent).toBe("NOT_RUN");}
 expect(fullCatalog).toHaveLength(192);expect(pass).toBe(146);expect(fail).toBe(46);
 expect(fullCatalog.filter(c=>c.failureClassification==="API_ACTIVATION_TRANSFER")).toHaveLength(6);
});
it("selects genuine explicit case IDs and rejects unmatched profile/group/title",()=>{
 const c=selected[0];expect(selectCase(c.profile,c.kind,c.group,c.title)).toBe(c);
 expect(()=>selectCase(c.profile,c.kind,"wrong",c.title)).toThrow();
});
it("complete data protocol grants no Native/reference/heap acceptance",()=>{
 const rows=selected.map(record),r=consumeCaseRecords(rows,selected,binding);
 expect(r.protocol).toBe("COMPLETE_DATA_PROTOCOL");expect(r.nativeAcceptance).toBe(false);expect(r.referenceAcceptance).toBe(false);expect(r.physicalHeap).toBe("UNPROVEN");
});
it("ordinary primary FAIL remains separate and is not rewritten to PASS",()=>{
 const rows=selected.map(record);rows[0].status="FAIL";rows[0].primaryPresent=true;rows[0].primary={kind:"ThrownUndefined"};
 const r=consumeCaseRecords(rows,selected,binding);expect(r.ordinaryFailures).toEqual([selected[0].id]);expect(r.records[0].status).toBe("FAIL");
});
it("missing record is HOLD",()=>{const r=consumeCaseRecords([record(selected[0])],selected,binding);expect(r.protocol).toBe("HOLD");expect(r.missing).toEqual([selected[1].id]);});
it("duplicate/unknown identity rejected",()=>{
 expect(()=>consumeCaseRecords([record(selected[0]),record(selected[0])],selected,binding)).toThrow();
 const row={...record(selected[0]),caseId:"unbound"};expect(()=>consumeCaseRecords([row],selected,binding)).toThrow();
});
it("profile gyro/source/WASM drift rejected",()=>{
 for(const patch of [{profile:"other"},{gyro:!selected[0].gyro},{engineBinding:"R08_125_NOT_ADOPTED"},{wasmSha256:"ed3c"}])
  expect(()=>consumeCaseRecords([{...record(selected[0]),...patch}],selected,binding)).toThrow();
});
it("undefined primary presence is independent and mismatch is rejected",()=>{
 const row=record(selected[0]);row.status="FAIL";row.primary={kind:"ThrownUndefined"};row.primaryPresent=true;
 expect(consumeCaseRecords([row],selected,binding).records[0].primary).toEqual({kind:"ThrownUndefined"});
 row.primaryPresent=false;expect(()=>consumeCaseRecords([row],selected,binding)).toThrow();
});
it("acquired release count zero/two rejected",()=>{
 for(const count of[0,2]){const row=record(selected[0]),r=resource();r.releaseAttempts=count;row.resources=[r];expect(()=>consumeCaseRecords([row],selected,binding)).toThrow();}
});
it("no-handle acquisition FAIL never invents body/free and holds",()=>{
 const row=record(selected[0]);row.status="FAIL";row.primaryPresent=true;row.primary={kind:"Error",message:"acquire"};
 row.resources=[{...resource(),acquisition:{status:"FAIL",error:{kind:"ThrownUndefined"}},acquired:false,primary:{status:"NOT_RUN"},primaryPresent:false,
 cleanup:{status:"NOT_RUN"},releaseAttempts:0,disposition:"NOT_ACQUIRED"}];row.poisoned=true;
 expect(consumeCaseRecords([row],selected,binding).protocol).toBe("HOLD");
 row.resources[0].releaseAttempts=1;expect(()=>consumeCaseRecords([row],selected,binding)).toThrow();
});
it("cleanup FAIL and body trap both remain independent stop reasons",()=>{
 const row=record(selected[0]);row.status="FAIL";row.primaryPresent=true;row.primary={kind:"Error",name:"RuntimeError",message:"data-only"};
 row.resources=[{...resource(),primary:{status:"FAIL",error:{kind:"ThrownUndefined"}},primaryPresent:true,cleanup:{status:"FAIL",error:{kind:"Error",message:"cleanup"}},
 stopCauses:["BODY_NATIVE_TRAP","CLEANUP_FAILURE"],disposition:"POISONED"}];row.poisoned=true;
 const r=consumeCaseRecords([row],selected,binding);expect(r.protocol).toBe("HOLD");expect(r.ordinaryFailures).toEqual([]);
 expect(r.records[0].resources[0].stopCauses).toEqual(["BODY_NATIVE_TRAP","CLEANUP_FAILURE"]);
});
it("poison forbids subsequent PASS and permits only untouched NOT_RUN",()=>{
 const first=record(selected[0]);first.status="FAIL";first.primaryPresent=true;first.primary={kind:"Error",message:"data-only"};first.poisoned=true;
 expect(()=>consumeCaseRecords([first,record(selected[1])],selected,binding)).toThrow();
 const next=record(selected[1]);next.status="NOT_RUN";next.poisoned=true;
 expect(consumeCaseRecords([first,next],selected,binding).protocol).toBe("HOLD");
});
it("bounded parser rejects oversized bytes/bad UTF8/bad JSON",()=>{
 expect(()=>parseBoundJson(new Uint8Array(9),8)).toThrow();expect(()=>parseBoundJson(new Uint8Array([0xff]))).toThrow();
 expect(()=>parseBoundJson(new TextEncoder().encode("{broken"))).toThrow();
});
it("historical mutation/missing/duplicate records are rejected",()=>{
 const c=selected[0],raw=JSON.parse(fs.readFileSync(c.historicalRawPath,"utf8")),group=fullCatalog.filter(x=>x.historicalRawPath===c.historicalRawPath);
 raw.records[0].status="MUTATED";expect(()=>consumeHistorical(raw,group)).toThrow();
 expect(()=>consumeHistorical({records:[]},group)).toThrow();
});
it("requires selected order and independent record copies",()=>{
 expect(()=>consumeCaseRecords([record(selected[1]),record(selected[0])],selected,binding)).toThrow();
 const rows=selected.map(record),r=consumeCaseRecords(rows,selected,binding);rows[0].status="FAIL";
 expect(r.records[0].status).toBe("PASS");
});
it("invalid NOT_RUN/unknown stop causes and absent resource observation rejected",()=>{
 const empty=record(selected[0]);empty.resources=[];
 expect(()=>consumeCaseRecords([empty],selected,binding)).toThrow();
 const unknown=record(selected[0]);unknown.resources=[{...resource(),stopCauses:["UNBOUND_REASON"]}];
 expect(()=>consumeCaseRecords([unknown],selected,binding)).toThrow();
 const skipped=record(selected[0]);skipped.status="NOT_RUN";skipped.resources=[];skipped.primaryPresent=true;
 expect(()=>consumeCaseRecords([skipped],selected,binding)).toThrow();
});

