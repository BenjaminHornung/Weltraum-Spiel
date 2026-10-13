import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,readdirSync,lstatSync,mkdirSync,existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash,randomUUID} from "node:crypto";
const spike=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),root=path.resolve(spike,"../..");
const git="C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe",base="17b1db4201a28e7b607c30707bdc2b75e3484a10";
const scope=["spikes/gfx-05-wasm-meshing/",".devtoolbox/specs/changes/gfx-05-2026-10-09/"];
const call=args=>execFileSync(git,["-C",root,...args],{maxBuffer:32*1024*1024});
const sha=b=>createHash("sha256").update(b).digest("hex");
const destination=path.join(spike,"delivery-seal.json");
if(!process.argv.includes("--check")&&!existsSync(destination))writeFileSync(destination,"{}\n");
assert.equal(call(["rev-parse","HEAD"]).toString().trim(),base);assert.equal(call(["branch","--show-current"]).toString().trim(),"feature/gfx-05-2026-10-09");
const status=call(["status","--porcelain=v1","-z","-uall"]).toString().split("\0").filter(Boolean);
for(const row of status){assert.ok(!/[DRCU!]/.test(row.slice(0,2)),"Unsupported Git operation");assert.ok(scope.some(s=>row.slice(3).startsWith(s)),"Foreign dirty path: "+row.slice(3));}
const files=[];
function scan(dir){
  for(const name of readdirSync(dir).sort()){
    const p=path.join(dir,name),rel=path.relative(root,p).replaceAll("\\","/");
    if(rel==="spikes/gfx-05-wasm-meshing/delivery-seal.json"||rel.startsWith("spikes/gfx-05-wasm-meshing/node_modules/")||rel.endsWith("/node_modules")
      ||rel.startsWith("spikes/gfx-05-wasm-meshing/.runtime/")||rel.endsWith("/.runtime")||rel.startsWith("spikes/gfx-05-wasm-meshing/rust/target/"))continue;
    const st=lstatSync(p);assert.ok(!st.isSymbolicLink(),"No payload symlinks");
    if(st.isDirectory())scan(p);else files.push({path:rel,bytes:st.size,sha256:sha(readFileSync(p))});
  }
}
for(const s of scope)scan(path.join(root,s));
files.sort((a,b)=>a.path.localeCompare(b.path,"en"));
const staged=sha(call(["diff","--cached","--binary",base])),unstaged=sha(call(["diff","--binary"]));
const index=call(["ls-files","--stage","-z","--",...scope]).toString().split("\0").filter(Boolean).sort();
const dependencies=JSON.parse(readFileSync(path.join(spike,"dependency-binding.json")));
assert.equal(sha(readFileSync(path.join(spike,"package-lock.json"))),dependencies.lockSha256,"Pinned dependency lock");
for(const f of dependencies.files)assert.equal(sha(readFileSync(path.join(spike,f.path))),f.sha256,"Dependency use-time digest");
for(const f of JSON.parse(readFileSync(path.join(spike,"source-binding.json"))).imports){
  const dest=path.join(spike,f.contractOnly?"contracts":"oracle",f.path);assert.equal(sha(readFileSync(dest)),f.sha256,"TS oracle bytes changed");
}
const port=JSON.parse(readFileSync(path.join(spike,"port-binding.json")));
const original=readFileSync(path.join(spike,"contracts",port.original)),text=original.toString();
assert.equal(sha(original),port.originalSha256,"Frozen port source");
const body=text.slice(text.indexOf("const payloadKeys="),text.indexOf("export const validateHvpEastChunkCollisionPayload=")).replaceAll("\r\n","\n");
assert.equal(sha(Buffer.from(body)),port.bodySha256,"Exact original validation bodies");
assert.equal(sha(readFileSync(path.join(spike,port.generatedPort))),port.generatedSha256,"Import-only port use-time bytes");
const tools=JSON.parse(readFileSync(path.join(spike,"toolchain-binding.json")));
for(const f of tools.executables)assert.equal(sha(readFileSync(f.path)),f.sha256,"Executable use-time binding");
for(const f of tools.files)assert.equal(sha(readFileSync(path.join(spike,tools.sysroot,f.path))),f.sha256,"Private Rust std use-time binding");
const current={schema:"hestia.gfx05.delivery.v1",base,branch:"feature/gfx-05-2026-10-09",scope,gitStatus:status,index,stagedDiffSha256:staged,unstagedDiffSha256:unstaged,files,
  contentDigest:sha(Buffer.from(JSON.stringify(files))),dirtyTreeDigest:sha(Buffer.from(JSON.stringify({status,index,staged,unstaged,files}))),
  exclusions:["delivery-seal.json self envelope",".runtime private tool caches and detached review.patch","node_modules bound separately by dependency-binding.json"],
  productIntegration:"NO",hardwareReference:"NOT_RUN",approval:"NOT_GRANTED_NO_COMMIT_PUSH"};
if(process.argv.includes("--check")){
  assert.deepEqual(JSON.parse(readFileSync(destination)),current,"Exact final scope/dirty byte binding");
  const review=JSON.parse(readFileSync(path.join(spike,".runtime/review-patch-binding.json")));
  const patch=readFileSync(path.join(spike,review.path));
  assert.equal(patch.length,review.bytes,"Review patch size");
  assert.equal(sha(patch),review.sha256,"Exact detached review patch");
  assert.equal(sha(readFileSync(destination)),review.sealSha256,"Review patch belongs to this seal");
  assert.equal(review.roundtrip,"PASS","Review patch reconstruction");
  const expected=process.argv.indexOf("--expected-seal");
  if(expected>=0)assert.equal(sha(readFileSync(destination)),process.argv[expected+1],"Trusted handoff seal SHA");
}
else{
  writeFileSync(destination,JSON.stringify(current,null,2)+"\n");
  mkdirSync(path.join(spike,".runtime"),{recursive:true});
  let patch=call(["diff",base,"--binary","--",...scope]);
  const tracked=new Set(call(["ls-files","-z"]).toString().split("\0").filter(Boolean));
  const envelope={path:path.relative(root,destination).replaceAll("\\","/"),bytes:readFileSync(destination).length,sha256:sha(readFileSync(destination))};
  const cache=path.join(spike,".runtime"),raw=path.join(cache,`patch-source-${randomUUID()}`);
  // Repository eol attributes must not rewrite the frozen control bytes in this detached patch.
  const patchEnv={...process.env,GIT_CEILING_DIRECTORIES:cache,GIT_ATTR_NOSYSTEM:"1"};
  for(const f of [...files,envelope].filter(f=>!tracked.has(f.path))){
    const p=path.join(raw,f.path);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,readFileSync(path.join(root,f.path)));
    let diff;
    try{diff=execFileSync(git,["-C",raw,"-c","core.autocrlf=false","-c","core.attributesFile=NUL","diff","--no-index","--no-ext-diff","--no-textconv","--binary","--","/dev/null",f.path],{env:patchEnv,maxBuffer:16*1024*1024,stdio:["ignore","pipe","pipe"]});}
    catch(error){if(error.status!==1)throw error;diff=error.stdout;}
    patch=Buffer.concat([patch,diff]);
  }
  writeFileSync(path.join(spike,".runtime/review.patch"),patch);
  assert.equal(index.length,0,"This delivery patch requires the original untracked spike scopes");
  const roundtrip=path.join(spike,".runtime",`patch-roundtrip-${randomUUID()}`);
  assert.ok(roundtrip.startsWith(path.join(spike,".runtime")+path.sep),"Owned reconstruction path");
  mkdirSync(roundtrip,{recursive:true});
  for(const flag of ["--check","--whitespace=nowarn"])execFileSync(git,["-C",roundtrip,"-c","core.autocrlf=false","-c","core.attributesFile=NUL","apply",flag,path.join(spike,".runtime/review.patch")],{env:patchEnv,maxBuffer:32*1024*1024});
  for(const f of [...files,envelope])assert.equal(sha(readFileSync(path.join(roundtrip,f.path))),f.sha256,"Review patch raw-byte roundtrip: "+f.path);
  writeFileSync(path.join(spike,".runtime/review-patch-binding.json"),JSON.stringify({path:".runtime/review.patch",bytes:patch.length,sha256:sha(patch),sealSha256:envelope.sha256,roundtrip:"PASS",reconstructedFiles:files.length+1,base,branch:current.branch},null,2)+"\n");
}
console.log(JSON.stringify({status:"PASS",payloadFiles:files.length,dirtyTreeDigest:current.dirtyTreeDigest,contentDigest:current.contentDigest}));
