import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
export const root=path.dirname(fileURLToPath(import.meta.url)),wt=path.resolve(root,"../../../..");
export const git="C:\\IFI_SourceCode\\Utils\\opencode-migration\\runtime\\git\\cmd\\git.exe";
export const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
export const file=p=>({path:p.replaceAll("\\","/"),bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))});
export const json=p=>JSON.parse(fs.readFileSync(p,"utf8"));
export const write=(p,value)=>fs.writeFileSync(p,JSON.stringify(value,null,2)+"\n",{flag:"wx"});
export function walk(dir,ignore=new Set()){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>ignore.has(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name),ignore):[path.join(dir,e.name)]).sort();
}
export function gitOutput(args){const r=spawnSync(git,args,{cwd:wt,encoding:"utf8"});assert.equal(r.status,0,r.error?.message??r.stderr);return r.stdout.trim();}
export function scope(){
  const branch=gitOutput(["branch","--show-current"]),head=gitOutput(["rev-parse","HEAD"]);
  assert.equal(branch,"feature/phy-02-2026-10-09");assert.equal(head,"17b1db4201a28e7b607c30707bdc2b75e3484a10");
  const raw=gitOutput(["status","--porcelain=v1","-uall"]);
  const dirty=raw.split(/\r?\n/).filter(Boolean).map(line=>line.slice(3)).sort();
  for(const p of dirty)assert(p.startsWith("spikes/phy-02-collider-bakeoff/")||p.startsWith(".devtoolbox/specs/changes/phy-02-2026-10-09/"),"Foreign dirty scope "+p);
  return {branch,head,dirty};
}
export function verifyCopies(){
  assert(process.cwd()===root,"Execute from exact own immutable revision root");
  const oldSeal=path.resolve(root,"../../evidence/seal.json");
  assert.equal(sha(fs.readFileSync(oldSeal)),"693539c26589a1c2f60c4a12e79ad5b91a4d7112a8721415ab9b63fb103dea25");
  const old=json(oldSeal);
  for(const f of old.content)assert.equal(sha(fs.readFileSync(path.join(wt,f.path))),f.sha256,"Changed old freeze "+f.path);
  const consumer=json(path.join(root,"consumer-input-full.json"));
  for(const f of consumer.files){const p=path.resolve(root,f.consumerPath);assert(p.startsWith(root+path.sep));
    assert.equal(fs.statSync(p).size,f.bytes,f.consumerPath);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.consumerPath);}
  for(const f of consumer.oldSources){const p=path.resolve(root,f.path);assert(p.startsWith(root+path.sep));
    assert.equal(sha(fs.readFileSync(p)),f.sha256,"Changed reused copy "+f.path);}
  for(const [p,hash] of Object.entries(consumer.controls))assert.equal(sha(fs.readFileSync(path.join(root,"producer/delivery",p))),hash,p);
  const supplemental=fs.existsSync(path.join(root,"consumer-input-support.json"))?json(path.join(root,"consumer-input-support.json")).files:[];
  for(const f of supplemental){const p=path.resolve(root,f.consumerPath);assert(p.startsWith(root+path.sep));
    assert.equal(fs.statSync(p).size,f.bytes);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.consumerPath);}
  return {status:"PASS",oldSealSha256:consumer.oldPhy02SealSha256,oldContentCount:old.content.length,consumerFiles:consumer.files.length,oldSources:consumer.oldSources,
    supplemental,consumerIndex:file(path.join(root,"consumer-input-full.json")),candidate:consumer.candidate};
}
export function inputs(){
  return walk(root,new Set(["node_modules",".npm-cache","runs","dist"])).filter(p=>!p.includes(path.sep+"producer"+path.sep)&&!p.includes(path.sep+"previous"+path.sep))
    .map(p=>({...file(p),path:path.relative(root,p).replaceAll("\\","/")}));
}
