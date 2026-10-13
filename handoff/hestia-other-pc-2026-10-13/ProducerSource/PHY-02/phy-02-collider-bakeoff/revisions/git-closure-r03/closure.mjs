import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url)),wt=path.resolve(root,"../../../..");
const git="C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
const branch="feature/phy-02-2026-10-09",head="17b1db4201a28e7b607c30707bdc2b75e3484a10";
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex"),read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const rel=p=>path.relative(wt,p).replaceAll("\\","/"),local=p=>path.relative(root,p).replaceAll("\\","/");
const resolve=p=>{assert(p&&!path.isAbsolute(p));const target=path.resolve(wt,p);assert(target.startsWith(wt+path.sep),"Path escapes own worktree: "+p);return target;};
const info=p=>({path:rel(p),bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))});
const write=(p,value)=>fs.writeFileSync(p,JSON.stringify(value,null,2)+"\n",{flag:"wx"});
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]).sort();
const byteOrder=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
const canonical=rows=>sha(Buffer.from(JSON.stringify(rows),"utf8"));
const byteExclusions=["source-bytes.json","GitClosure.json","before-check.json","after-check.json","receipt.json","seal.json","seal.sha256"];
const generated=["git-index.raw.bin","git-status.raw.bin","git-index.rows.json","git-status.rows.json",...byteExclusions];
const excludedPaths=new Set(byteExclusions.map(p=>rel(path.join(root,p))));
const spec=path.join(wt,".devtoolbox/specs/changes/phy-02-2026-10-09/revisions/git-closure-r03/PLAN.md");
assert.equal(process.cwd(),root,"Run from exact own R03 root");

function command(args,commands){
  const full=["--no-optional-locks",...args],startedAtUtc=new Date().toISOString();
  const result=spawnSync(git,full,{cwd:wt,env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"},maxBuffer:32*1024*1024});
  const stdout=result.stdout??Buffer.alloc(0),stderr=result.stderr??Buffer.alloc(0);
  commands.push({executable:git,args:full,cwd:wt,optionalLocks:false,exitCode:result.status,startedAtUtc,finishedAtUtc:new Date().toISOString(),
    stdoutBytes:stdout.length,stdoutSha256:sha(stdout),stderrBytes:stderr.length,stderrSha256:sha(stderr),error:result.error?.message??null});
  assert.equal(result.status,0,result.error?.message??stderr.toString("utf8"));return stdout;
}
function tokens(bytes){const text=bytes.toString("utf8");assert(Buffer.from(text,"utf8").equals(bytes),"Non-UTF8 Git path cannot be silently normalized");
  if(!bytes.length)return [];assert.equal(text.at(-1),"\0");return text.slice(0,-1).split("\0");}
function snapshot(){
  const commands=[],actualBranch=command(["branch","--show-current"],commands).toString("utf8").trim(),actualHead=command(["rev-parse","HEAD"],commands).toString("utf8").trim();
  assert.equal(actualBranch,branch);assert.equal(actualHead,head);
  const indexRaw=command(["ls-files","--stage","-z"],commands),statusRaw=command(["status","--porcelain=v1","-z","--untracked-files=all"],commands);
  const indexOriginal=tokens(indexRaw).map(row=>{const m=/^([0-7]{6}) ([0-9a-f]{40}) ([0-3])\t([\s\S]+)$/.exec(row);assert(m,"Invalid semantic index row");resolve(m[4]);
    return {mode:m[1],blob:m[2],stage:Number(m[3]),path:m[4]};});
  assert(Buffer.from(indexOriginal.map(r=>`${r.mode} ${r.blob} ${r.stage}\t${r.path}\0`).join(""),"utf8").equals(indexRaw),"Index parse lost bytes");
  const input=tokens(statusRaw),statusOriginal=[];
  for(let n=0;n<input.length;n++){
    const row=input[n];assert(row.length>3&&row[2]===" ");const xy=row.slice(0,2);assert(/^[ MADRCUT?!]{2}$/.test(xy));
    const record={xy,path:row.slice(3)};resolve(record.path);
    if(xy.includes("R")||xy.includes("C")){assert(++n<input.length);record.originalPath=input[n];resolve(record.originalPath);}
    statusOriginal.push(record);
  }
  assert(Buffer.from(statusOriginal.map(r=>`${r.xy} ${r.path}\0`+(r.originalPath===undefined?"":r.originalPath+"\0")).join(""),"utf8").equals(statusRaw),"Porcelain parse lost XY/path bytes");
  const indexRows=indexOriginal.sort((a,b)=>byteOrder(a.path,b.path)||a.stage-b.stage||byteOrder(a.mode,b.mode)||byteOrder(a.blob,b.blob));
  const statusRows=statusOriginal.sort((a,b)=>byteOrder(a.path,b.path)||byteOrder(a.xy,b.xy)||byteOrder(a.originalPath??"",b.originalPath??""));
  assert.equal(new Set(indexRows.map(r=>JSON.stringify([r.path,r.stage]))).size,indexRows.length,"Duplicate index path/stage");
  assert.equal(new Set(statusRows.map(r=>r.path)).size,statusRows.length,"Duplicate porcelain membership");
  for(const r of statusRows)for(const p of [r.path,...(r.originalPath===undefined?[]:[r.originalPath])])
    assert(p.startsWith("spikes/phy-02-collider-bakeoff/")||p.startsWith(".devtoolbox/specs/changes/phy-02-2026-10-09/"),"Foreign dirty scope: "+p);
  return {branch:actualBranch,head:actualHead,indexRaw,statusRaw,indexRows,statusRows,indexDigest:canonical(indexRows),statusDigest:canonical(statusRows),commands};
}
function sameGit(a,b){assert.equal(a.branch,b.branch);assert.equal(a.head,b.head);assert.deepEqual(a.indexRows,b.indexRows,"Semantic index/staged rows changed");
  assert.deepEqual(a.statusRows,b.statusRows,"Full porcelain XY or membership changed");assert.equal(a.indexDigest,b.indexDigest);assert.equal(a.statusDigest,b.statusDigest);}
async function sourceBytes(s){
  const paths=[...new Set([...s.indexRows.map(r=>r.path),...s.statusRows.flatMap(r=>[r.path,...(r.originalPath===undefined?[]:[r.originalPath])])])].sort(byteOrder),rows=[];
  for(const p of paths){if(excludedPaths.has(p))continue;const absolute=resolve(p);let stat;
    try{stat=fs.lstatSync(absolute);}catch(e){if(e.code!=="ENOENT")throw e;rows.push({path:p,exists:false});continue;}
    if(stat.isSymbolicLink()){const target=fs.readlinkSync(absolute);rows.push({path:p,exists:true,type:"symlink",linkBytes:Buffer.byteLength(target),sha256:sha(Buffer.from(target))});continue;}
    assert(stat.isFile(),"Non-file indexed/status source needs explicit separate closure: "+p);
    const hash=crypto.createHash("sha256");for await(const chunk of fs.createReadStream(absolute))hash.update(chunk);
    const after=fs.lstatSync(absolute);assert.equal(after.size,stat.size,p);assert.equal(after.mtimeMs,stat.mtimeMs,"Source changed while hashing: "+p);
    rows.push({path:p,exists:true,type:"file",bytes:stat.size,sha256:hash.digest("hex")});
  }
  return {rows,count:rows.length,digest:canonical(rows),excludedSourceByteControls:[...excludedPaths].sort(byteOrder),
    exclusionMeaning:"Only circular metadata bytes excluded; all their actual Git index rows and full XY/membership remain included with zero Git-row exclusions"};
}
function previous(){
  const r01=path.resolve(root,"../phy01-migration2-r01"),r02=path.resolve(root,"../a0-profile-decision-r02"),original=path.resolve(root,"../../evidence/seal.json");
  const controls=[{path:original,sha256:"693539c26589a1c2f60c4a12e79ad5b91a4d7112a8721415ab9b63fb103dea25"},
    {path:path.join(r01,"seal.json"),sha256:"4fcbc719c54429e750bc33d4b2051392f34c67ecc35a2c145472e1ddaa243eae"},
    {path:path.join(r02,"seal.json"),sha256:"9feabba100528c80ebda4ee34761063841f39ccea2871c2e28fef4d3b7e00f5f"}];
  for(const f of controls)assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
  const historical=read(original).content;assert.equal(historical.length,73);
  for(const f of [...historical,...read(controls[1].path).files,...read(controls[2].path).files]){const p=resolve(f.path);if(f.bytes!==undefined)assert.equal(fs.statSync(p).size,f.bytes);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  const dependencies=read(path.join(r01,"dependencies.json")).files;
  for(const f of dependencies){const p=path.resolve(r01,f.path);assert(p.startsWith(r01+path.sep));assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  for(const f of read(path.join(r01,"tools.json")).ownExecutedBytes){const p=path.isAbsolute(f.path)?f.path:path.resolve(r01,f.path);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  const references=[...controls.map(f=>info(f.path)),...[
    "receipt.json","matrix.json","source-index.json","consumer-input-full.json","consumer-input-support.json","dependencies.json","tools.json","package-lock.json",
    "runs/supplemental-05/fixtures.json","runs/full-functional-04/exitcodes.json","runs/supplemental-05/exitcodes.json"
  ].map(p=>info(path.join(r01,p))),...[
    "receipt.json","owner-binding.json","guarded-source-binding.json","runs/guarded-owner-01/exitcodes.json","runs/guarded-owner-01/f7-cleanup.json"
  ].map(p=>info(path.join(r02,p)))];
  return {status:"PASS_UNCHANGED_PRIOR_BYTES",originalContent:73,r01Payloads:read(controls[1].path).files.length,r02Payloads:read(controls[2].path).files.length,
    dependencies:dependencies.length,references,dirtyMeaning:"Prior path-only inventories are immutable before-freeze references, not exact current-index labels"};
}
const stateSummary=s=>({branch:s.branch,head:s.head,index:{count:s.indexRows.length,digest:s.indexDigest},porcelain:{count:s.statusRows.length,digest:s.statusDigest},commands:s.commands});
const tools=()=>({node:{path:process.execPath,version:process.version,bytes:fs.statSync(process.execPath).size,sha256:sha(fs.readFileSync(process.execPath))},
  git:{path:git,bytes:fs.statSync(git).size,sha256:sha(fs.readFileSync(git))},gitVersionCommand:{args:["--no-optional-locks","--version"],exitCode:0}});

if(process.argv.includes("--inspect")){
  const s=snapshot(),prior=previous(),commands=[];const gitVersion=command(["--version"],commands).toString("utf8").trim();
  console.log(JSON.stringify({status:"READONLY_INSPECTION_PASS",...stateSummary(s),prior:{original:prior.originalContent,r01:prior.r01Payloads,r02:prior.r02Payloads,dependencies:prior.dependencies},gitVersion,
    unmergedIndexRows:s.indexRows.filter(r=>r.stage!==0).length,indexedPorcelainChanges:s.statusRows.filter(r=>r.xy[0]!==" "&&r.xy[0]!=="?").length,
    porcelainXY:[...new Set(s.statusRows.map(r=>r.xy))],gitVersionCommand:commands[0]}));
}else if(process.argv.includes("--check")){
  const seal=read("seal.json");assert.equal(sha(fs.readFileSync("seal.json")),fs.readFileSync("seal.sha256","utf8").trim());
  for(const f of seal.files){const p=resolve(f.path);assert.equal(fs.statSync(p).size,f.bytes);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  const actual=walk(root).filter(p=>!['seal.json','seal.sha256'].includes(local(p))).map(rel).sort(byteOrder);
  assert.deepEqual(actual,seal.files.filter(f=>f.path.startsWith(rel(root)+"/")).map(f=>f.path).sort(byteOrder),"Extra/missing R03 file");
  const prior=previous(),expectedIndex=read("git-index.rows.json"),expectedStatus=read("git-status.rows.json"),closure=read("GitClosure.json");
  const before=snapshot();assert.deepEqual(before.indexRows,expectedIndex.rows);assert.deepEqual(before.statusRows,expectedStatus.rows);
  assert.equal(before.indexDigest,expectedIndex.digest);assert.equal(before.statusDigest,expectedStatus.digest);
  const bytes=await sourceBytes(before);assert.deepEqual(bytes,read("source-bytes.json"));const after=snapshot();sameGit(before,after);
  assert.equal(closure.before.index.digest,before.indexDigest);assert.equal(closure.after.index.digest,after.indexDigest);
  assert.equal(closure.before.porcelain.digest,before.statusDigest);assert.equal(closure.after.porcelain.digest,after.statusDigest);
  assert.equal(sha(fs.readFileSync(git)),read("receipt.json").tools.git.sha256);assert.equal(sha(fs.readFileSync(process.execPath)),read("receipt.json").tools.node.sha256);
  console.log(JSON.stringify({status:"PASS",exitCode:0,sealSha256:sha(fs.readFileSync("seal.json")),indexRows:before.indexRows.length,indexDigest:before.indexDigest,
    porcelainRows:before.statusRows.length,porcelainDigest:before.statusDigest,sourceRows:bytes.count,sourceDigest:bytes.digest,sourceByteExclusions:bytes.excludedSourceByteControls.length,
    gitIndexRowExclusions:0,prior:{original:prior.originalContent,r01:prior.r01Payloads,r02:prior.r02Payloads,dependencies:prior.dependencies},readonlyCommands:[...before.commands,...after.commands],
    technicalDelivery:"PARTIAL",matrix:{cases:192,rawPass:146,rawFail:46},productIntegration:"NO"}));
}else if(process.argv.includes("--seal")){
  assert.equal(read("review.json").result,"SUPPORTED_R03_SEMANTIC_INDEX_XY_CLOSURE");
  const initial=snapshot(),prior=previous(),commands=[],gitVersion=command(["--version"],commands).toString("utf8").trim();
  write("prior-references.json",prior);
  write("source-delta.json",{classification:"R03_ONLY_READONLY_VERIFIER_DOCUMENTATION_DELTA",files:[...walk(root),spec].map(info),
    gitMutation:false,compilerBuildTestNativeBrowserGpuWave:false,previousSourcesOrPopulationsRewritten:false});
  for(const p of generated)fs.writeFileSync(p,"",{flag:"wx"});
  const before=snapshot();assert.equal(initial.indexDigest,before.indexDigest,"Index changed during preparation");
  for(const p of generated){const name=rel(path.join(root,p));assert(!before.indexRows.some(r=>r.path===name),"Self control is indexed");
    assert(before.statusRows.some(r=>r.path===name&&r.xy==="??"),"Self control missing from actual untracked membership");}
  const fill=(p,value,raw=false)=>{assert.equal(fs.statSync(p).size,0,"Generated control cannot be overwritten twice: "+p);fs.writeFileSync(p,raw?value:JSON.stringify(value,null,2)+"\n");};
  fill("git-index.raw.bin",before.indexRaw,true);fill("git-status.raw.bin",before.statusRaw,true);
  fill("git-index.rows.json",{schema:"phy02.complete-semantic-index.r03",encoding:"Canonical UTF8 JSON rows, byte-order path then numeric stage/mode/blob",count:before.indexRows.length,digest:before.indexDigest,rows:before.indexRows,exclusions:[]});
  fill("git-status.rows.json",{schema:"phy02.complete-porcelain-xy.r03",encoding:"Canonical UTF8 JSON rows, exact two-character XY, path/originalPath; no trim",count:before.statusRows.length,digest:before.statusDigest,rows:before.statusRows,
    includes:"All standard porcelain tracked changes and every untracked file; renamed/copied original path where present",excludes:"Ignored entries are outside standard porcelain, not silently counted as tracked/untracked",rowExclusions:[]});
  const bytes=await sourceBytes(before);sameGit(before,snapshot());
  fill("source-bytes.json",bytes);fill("before-check.json",{status:"PASS",actual:stateSummary(before),sourceDigest:bytes.digest,prior,gitVersion,gitVersionCommand:commands[0],sourceControlPlaceholders:"All generated controls actually existed before capture; their XY membership is observed, not predicted"});
  fill("GitClosure.json",{schema:"phy02.exact-semantic-index-status.r03",before:stateSummary(before),after:stateSummary(before),
    afterMeaning:"Expected immutable semantic values; actual after-payload commands/equality in after-check.json, actual post-terminal equality independently verified by --seal final check and --check",
    source:{count:bytes.count,digest:bytes.digest,excludedControls:bytes.excludedSourceByteControls},gitIndexRowExclusions:[],porcelainRowExclusions:[],binaryIndexCacheFlags:"NOT_CLAIMED"});
  fill("receipt.json",{schema:"phy02.git-closure.receipt.r03",status:"PARTIAL",session:"01a12002-e670-70b0-bfe4-8ffe1a688bd5",paseo:"74e93d81-2bb6-464d-a1f6-62e53295f811",
    branch:before.branch,head:before.head,tools:{...tools(),gitVersion,gitVersionCommand:commands[0]},priorReferences:info(path.join(root,"prior-references.json")),sourceDelta:info(path.join(root,"source-delta.json")),
    semanticIndex:info(path.join(root,"git-index.rows.json")),porcelainXY:info(path.join(root,"git-status.rows.json")),rawIndex:info(path.join(root,"git-index.raw.bin")),rawPorcelain:info(path.join(root,"git-status.raw.bin")),
    completeIndexCount:before.indexRows.length,indexCanonicalDigest:before.indexDigest,completePorcelainCount:before.statusRows.length,porcelainCanonicalDigest:before.statusDigest,
    sourceBytes:info(path.join(root,"source-bytes.json")),selfControlByteExclusions:bytes.excludedSourceByteControls,gitRowExclusions:[],sourceDeltaReview:info(path.join(root,"review.json")),
    actualBeforeCommands:"before-check.json",actualAfterPayloadCommands:"after-check.json",terminalReadonlyEvidence:"Actual post-seal --seal final validation and readonly --check tool exit/output; no stored post-terminal result fabricated",
    olderMatrix:{cases:192,rawPass:146,rawFail:46,population:"UNCHANGED_INDEPENDENT_R01"},ownerContext:info(path.join(root,"owner-context.json")),
    primaryCandidate:"rapier-0.21.0-phy01.migration2:legacy-impulse-v1, every new dynamic gyroFALSE",gyroPopulation:"SEPARATE_UNCHANGED_R01",productIntegration:"NO",
    openGates:["PublicSave/actualCold","collider/CAS/S2","qualifiedcost/nativeHeap","Actual native/browser/GPU/HVP and human gates"],
    exclusionsMeaning:"Seven named circular metadata byte controls excluded only from source byte equality, never from complete Git index/status equality; all seven except terminal seal/self-digest receive terminal payload hashes",
    performedActivity:{gitMutation:false,productGlobalWrites:false,newMainSession:false,compilerBuildTestNativeBrowserGpuWave:false,commitPushDeletion:false}});
  const after=snapshot();sameGit(before,after);const afterBytes=await sourceBytes(after);assert.deepEqual(afterBytes,bytes,"Source bytes changed during payload sealing");sameGit(after,snapshot());previous();
  fill("after-check.json",{status:"PASS",exitCode:0,phase:"AFTER_PAYLOAD_WRITES_BEFORE_TERMINAL_SELF_CONTROLS",actual:stateSummary(after),sourceDigest:afterBytes.digest,sourceRows:afterBytes.count,
    priorByteCheck:"PASS_AFTER_PAYLOAD_WRITES",semanticIndexStatusSourceEquality:"PASS",postTerminalMeaning:"Actual equality is independently checked after seal/self-digest filling and in readonly --check; this record is terminal-hash-bound"});
  const payloads=[...walk(root).filter(p=>!['seal.json','seal.sha256'].includes(local(p))),spec].sort();
  fill("seal.json",{schema:"phy02.terminal-semantic-closure-seal.r03",status:"PARTIAL",files:payloads.map(info),priorSealReferences:prior.references.slice(0,3),
    indexDigest:before.indexDigest,porcelainDigest:before.statusDigest,sourceDigest:bytes.digest,
    terminalByteExclusions:["seal.json self digest in seal.sha256","seal.sha256 derivative"],
    selfControlSourceByteExclusions:bytes.excludedSourceByteControls,indexRowExclusions:[],porcelainRowExclusions:[],productIntegration:"NO"});
  fill("seal.sha256",sha(fs.readFileSync("seal.json"))+"\n",true);
  const terminalState=snapshot();sameGit(before,terminalState);const terminalBytes=await sourceBytes(terminalState);assert.deepEqual(terminalBytes,bytes,"Source bytes changed after terminal sealing");sameGit(terminalState,snapshot());previous();
  console.log(JSON.stringify({status:"SEALED_AND_AFTER_CHECK_PASS",sealSha256:sha(fs.readFileSync("seal.json")),indexRows:before.indexRows.length,indexDigest:before.indexDigest,porcelainRows:before.statusRows.length,
    porcelainDigest:before.statusDigest,sourceRows:bytes.count,sourceDigest:bytes.digest,gitRowExclusions:0,prior:{original:prior.originalContent,r01:prior.r01Payloads,r02:prior.r02Payloads,dependencies:prior.dependencies}}));
}else throw new Error("Use --inspect, --seal or --check only");
