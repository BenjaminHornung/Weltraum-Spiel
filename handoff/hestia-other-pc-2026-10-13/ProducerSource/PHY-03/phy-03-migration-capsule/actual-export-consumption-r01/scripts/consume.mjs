// Data-only intake. Never import or execute a producer/capsule module.
import * as fs from 'node:fs';
import * as p from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {finished} from 'node:stream/promises';

const own=p.resolve(import.meta.dirname,'..'),root=p.resolve(own,'../../..');
const a0='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05';
const admin='C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09';
const base='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0';
const actual=base+'/phy021-fixture-export-r01/frozen/actual-export-r01';
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const newPrefix='spikes/phy-03-migration-capsule/actual-export-consumption-r01/';
const mode=process.argv[2];assert(['--capture','--consume','--verify','--seal','--check'].includes(mode));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const load=file=>JSON.parse(fs.readFileSync(file));
const slash=s=>s.replaceAll('\\','/');
const rel=file=>slash(p.relative(root,file));
function fileRow(file){
  assert(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Regular file required');
  const fd=fs.openSync(file,'r'),h=createHash('sha256'),buf=Buffer.alloc(256*1024);let bytes=0;
  try{for(let n;(n=fs.readSync(fd,buf,0,buf.length,null))>0;){h.update(buf.subarray(0,n));bytes+=n;}}finally{fs.closeSync(fd);}
  return {bytes,sha256:h.digest('hex')};
}
function equalFile(file,expected){const got=fileRow(file);assert.equal(got.bytes,expected.bytes,file);assert.equal(got.sha256,expected.sha256,file);return got;}
function write(name,value){const file=p.resolve(own,name);assert(file.startsWith(own+p.sep));fs.mkdirSync(p.dirname(file),{recursive:true});fs.writeFileSync(file,json(value),{flag:'wx'});}
function walk(dir,skip=()=>false){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=p.join(dir,e.name);if(skip(file,e))continue;assert(!e.isSymbolicLink(),'No symlink');if(e.isDirectory())out.push(...walk(file,skip));else{assert(e.isFile());out.push(file);}}return out.sort();}
function gitState(label,persist=true){
  const commands=[['head',['rev-parse','HEAD']],['branch',['branch','--show-current']],['index',['ls-files','--stage','-z']],['dirty',['status','--porcelain=v1','-z','--untracked-files=all']]];
  const results={},logs=[];
  for(const [name,args]of commands){const res=spawnSync(git,['--no-optional-locks',...args],{cwd:root,maxBuffer:32*1024*1024,windowsHide:true});assert(!res.error,res.error?.message);assert.equal(res.status,0,res.stderr?.toString());results[name]=res.stdout;
    const path='evidence/git/'+label+'-'+name+'.raw';if(persist){fs.mkdirSync(p.dirname(p.join(own,path)),{recursive:true});fs.writeFileSync(p.join(own,path),res.stdout,{flag:'wx'});fs.writeFileSync(p.join(own,path+'.stderr'),res.stderr,{flag:'wx'});}
    logs.push({executable:git,args:['--no-optional-locks',...args],cwd:root,exitCode:res.status,raw:{path:persist?path:null,bytes:res.stdout.length,sha256:hash(res.stdout)},stderrBytes:res.stderr.length});
  }
  assert.equal(results.head.toString().trim(),'17b1db4201a28e7b607c30707bdc2b75e3484a10');assert.equal(results.branch.toString().trim(),'feature/phy-03-2026-10-09');
  const index=results.index.toString().split('\0').filter(Boolean).map(s=>{const m=/^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]+)$/.exec(s);assert(m);return {mode:m[1],blob:m[2],stage:+m[3],path:m[4]};});
  const dirty=results.dirty.toString().split('\0').filter(Boolean).map(s=>{assert.equal(s[2],' ');assert(!/[RC]/.test(s.slice(0,2)),'No rename/copy state');return {x:s[0],y:s[1],path:s.slice(3)};});
  assert(dirty.every(r=>r.path.startsWith('spikes/phy-03-migration-capsule/')||r.path.startsWith('.devtoolbox/specs/changes/phy-03-2026-10-09/')),'Foreign dirty path');
  const pointer=fs.readFileSync(p.join(root,'.git'),'utf8');assert(pointer.startsWith('gitdir: '));const gitDir=p.resolve(root,pointer.slice(8).trim());
  return {head:results.head.toString().trim(),branch:results.branch.toString().trim(),indexRows:index,dirtyRows:dirty,indexSha256:hash(json(index)),dirtySha256:hash(json(dirty)),binaryIndex:{path:p.join(gitDir,'index'),...fileRow(p.join(gitDir,'index')),meaning:'FINAL_SEAL_BEFORE_AFTER_BINARY_BYTES; INITIAL_INTAKE_HAS_FULL_RAW_SEMANTIC_INDEX'},commands:logs};
}
function priorFiles(){
  const dirs=['spikes/phy-03-migration-capsule','.devtoolbox/specs/changes/phy-03-2026-10-09'];
  // Existing ignored build/log/seal bytes are included; duplicate review scaffolds and transient installed caches are excluded.
  const skip=(file,e)=>file===own||(e.isDirectory()&&(e.name==='node_modules'||e.name==='npm-cache'||e.name==='vite-cache'||/^review-[a-f0-9-]+$/.test(e.name)));
  return dirs.flatMap(dir=>walk(p.join(root,dir),skip)).sort();
}
function prior(){
  const modern=p.join(root,'spikes/phy-03-migration-capsule/modern-r01');
  equalFile(p.join(modern,'.runtime/seal.json'),{bytes:1318,sha256:'b21000c5ac92e9cd4339a3365dbc8050e3ffa877a153c64e10fc502b34eb3d85'});
  const seal=load(p.join(modern,'.runtime/seal.json'));equalFile(p.join(modern,'SourceDirtyIndex.json'),{bytes:seal.indexBytes,sha256:seal.indexSha256});equalFile(p.join(modern,'receipt.json'),{bytes:seal.receiptBytes,sha256:seal.receiptSha256});equalFile(p.join(modern,'.runtime/full-review.diff'),{bytes:seal.reviewDiffBytes,sha256:seal.reviewDiffSha256});
  const legacy=load(p.join(modern,'input-binding.json'));assert.equal(legacy.legacyRows.length,252);for(const row of legacy.legacyRows)equalFile(p.join(root,row.path),row);
  const index=load(p.join(modern,'SourceDirtyIndex.json'));assert.equal(index.records.length,14353);
  for(const row of index.records){if(row.encoding==='RECEIPT_SELF_DIGEST_NORMALIZED'){const receipt=load(p.join(root,row.path));receipt.bindings.fullDirtyTreeSha256=null;const bytes=json(receipt);assert.equal(bytes.length,row.bytes);assert.equal(hash(bytes),row.sha256);}else equalFile(p.join(root,row.path),row);}
  return {legacyFiles:252,legacyDigest:legacy.legacyDigest,modernBoundFiles:14353,modernScopeDigest:seal.sourceDirtyTreeSha256,modernSeal:fileRow(p.join(modern,'.runtime/seal.json')),modernReview:{bytes:seal.reviewDiffBytes,sha256:seal.reviewDiffSha256},files:priorFiles().map(file=>({path:rel(file),...fileRow(file)})),excluded:'Installed node_modules, npm/vite caches, duplicate review-UUID scaffolds only; no source/test/receipt/seal/log exclusions'};
}
function verifyPrior(before){const anchored=prior();assert.equal(anchored.modernScopeDigest,before.modernScopeDigest);const files=priorFiles();assert.deepEqual(files.map(rel),before.files.map(x=>x.path),'Previous file membership changed');for(const row of before.files)equalFile(p.join(root,row.path),row);return {files:files.length,additionalModernIndexedFiles:14353,legacyFiles:252,digest:hash(json(before.files)),status:'EXACT_UNCHANGED'};}
function origin(relative){assert(typeof relative==='string'&&!p.isAbsolute(relative));const file=p.resolve(a0,relative);assert(file.startsWith(p.resolve(a0)+p.sep));assert(slash(relative).includes('/frozen/'),'Only frozen snapshot origin');return file;}
function secureDataPath(file){assert(!/(^|[\\/])(\.env(?:\..*)?|\.npmrc|id_rsa|id_ed25519|credentials|secrets\.json|connectionstrings\.json)([\\/]|$)/i.test(file),'Credential path excluded');}
function declarations(input){
  const rows=[];const add=(section,name,snapshot,expected)=>rows.push({section,logicalPath:name,origin:origin(snapshot),...expected});
  for(const row of input.artifactRows){add(row.section,row.path,row.immutableSnapshot,{bytes:row.bytes,sha256:row.sha256});rows.at(-1).toolOnlyReference=input.tools.some(t=>t.sha256===row.sha256&&t.bytes===row.bytes);}
  for(const [n,row]of input.preparedControlCopies.entries())add('preparedControl',String(n).padStart(2,'0')+'-'+p.basename(row.snapshot),row.snapshot,{bytes:row.bytes,sha256:row.sha256});
  for(const row of input.newCopies)add('newFrozen',slash(row.snapshot).split('/actual-export-r01/')[1],row.snapshot,{bytes:row.bytes,sha256:row.sha256});
  for(const row of input.git)add('producerGit',p.basename(row.raw.path),row.raw.path,{bytes:row.raw.bytes,sha256:row.raw.sha256});
  add('preparedInput','INPUT.json',input.preparedInput.path,{bytes:input.preparedInput.bytes,sha256:input.preparedInput.sha256});
  return rows;
}
const expectedInput={bytes:2905321,sha256:'0c876294d68951bb911e463427d384c281f7ba3279c8797de4a1b42d2614e1f3'};
function inputMetadata(){
  const rows=[{section:'actualInput',logicalPath:'INPUT.json',origin:p.join(a0,actual,'INPUT.json'),...expectedInput},
    {section:'detachedOwner',logicalPath:'PHY021_FIXTURE_EXPORT_RECEIPT_R02.json',origin:p.join(a0,base,'PHY021_FIXTURE_EXPORT_RECEIPT_R02.json'),bytes:1813,sha256:'c5be78993a77d75aa4c934c907a9db9ffa2ed61e43de020bb37d9ff793bb6b7b'},
    {section:'detachedReview',logicalPath:'VERIFICATION_ACTUAL_EXPORT_R01.md',origin:p.join(a0,base,'phy021-fixture-export-r01/VERIFICATION_ACTUAL_EXPORT_R01.md'),bytes:1710,sha256:'e36225c5a301fa55c9da27db37f40472bbeaec695e27955780cec573608ab57f'}];
  for(const name of ['PHY021_ACTUAL_FIXTURE_EXPORT_R01_TO_PHY03_QUEUED.json','PHY021_ACTUAL_FIXTURE_EXPORT_R01_ROOT_REGISTER.json']){const file=p.join(admin,'handoffs',name);rows.push({section:'rootMetadata',logicalPath:name,origin:file,...fileRow(file)});}
  return rows;
}
function membership(input){
  const folder=p.join(a0,actual),files=walk(folder).map(relA0=>slash(p.relative(a0,relA0))).sort();
  const declared=[actual+'/INPUT.json',...input.newCopies.map(r=>r.snapshot),...input.git.map(r=>r.raw.path)].sort();assert.equal(declared.length,30);assert.deepEqual(files,declared,'Exact producer actual-freeze membership');
  assert.equal(input.newCopies.filter(r=>r.section==='actualRaw').length,15);
  return {files:declared,sha256:hash(json(declared)),actualFreezeFiles:30,rawFiles:15};
}
function tools(input){return [...input.tools,{name:'consumerGit',path:git,...fileRow(git)}].map(row=>{assert(p.resolve(row.path).startsWith('C:\\IFI_SourceCode\\'));equalFile(row.path,row);return {...row,vendoredAsSource:false,execution:'NOT_EXECUTED_EXCEPT_READONLY_CONSUMER_GIT'};});}
function verifyCopies(receipt){assert.equal(hash(json(receipt.copies)),receipt.copyIndexSha256);assert.equal(receipt.copies.reduce((n,r)=>n+r.bytes,0),receipt.copyBytes);for(const row of receipt.copies){equalFile(row.origin,row);equalFile(p.join(own,row.localPath),row);}for(const row of receipt.externalArtifactReferences)equalFile(row.origin,row);const input=load(p.join(own,'inputs/actualInput/INPUT.json'));assert.deepEqual(membership(input),receipt.originMembership);tools(input);const files=walk(p.join(own,'inputs'));assert.deepEqual(files.map(f=>slash(p.relative(own,f))).sort(),receipt.copies.map(r=>r.localPath).sort());return {copies:files.length,toolArtifactReferences:receipt.externalArtifactReferences.length,bytes:receipt.copyBytes,originBeforeAfter:'EXACT',localMembership:'EXACT'};}
function verifyState(before,state){assert.equal(state.indexSha256,before.git.indexSha256,'Git index mutation');const old=rows=>rows.filter(r=>!r.path.startsWith(newPrefix));assert.deepEqual(old(state.dirtyRows),old(before.git.dirtyRows),'Pre-existing dirty state changed');return {index:'UNCHANGED',previousDirty:'UNCHANGED',newDirty:state.dirtyRows.filter(r=>r.path.startsWith(newPrefix)).length};}

if(mode==='--capture'){
  const state=load(p.join(admin,'STATE.json')),task=state.tasks.find(t=>t.id==='PHY-03');assert.equal(task.paseoAgentId,'5ead133e-5607-4405-b9fb-c5adbb021246');assert.equal(p.resolve(task.worktree),root);assert.equal(task.status,'ACTIVE_EXISTING_ACTUAL_EXPORT_BYTE_CONSUMPTION_STATIC_CAPSULE_ONLY');
  const saved={createdAtUtc:new Date().toISOString(),session:{nativeId:'01a12004-8b04-7b41-b64d-5fcf3076d6a6',paseoId:task.paseoAgentId,identitySource:'USER_EXPLICIT_EXISTING_SESSION_AND_STATE_WORKTREE_MAPPING; NO_SESSION_API_OR_CREATION'},stateReference:{path:p.join(admin,'STATE.json'),...fileRow(p.join(admin,'STATE.json')),taskStatus:task.status},userOverridesReference:{path:p.join(admin,'USER_OVERRIDES_2026-10-09.md'),...fileRow(p.join(admin,'USER_OVERRIDES_2026-10-09.md'))},git:gitState('before'),previous:prior(),consumerNode:{path:node,...fileRow(node),version:process.version},importedModulesExecuted:0};
  write('evidence/before.json',saved);console.log(JSON.stringify({status:'CAPTURED',previousFiles:saved.previous.files.length,previousDigest:hash(json(saved.previous.files)),indexRows:saved.git.indexRows.length,dirtyRows:saved.git.dirtyRows.length}));
}else if(mode==='--consume'){
  const before=load(p.join(own,'evidence/before.json'));verifyPrior(before.previous);const meta=inputMetadata();for(const row of meta)equalFile(row.origin,row);const input=load(meta[0].origin);assert.equal(input.artifactRows.length,4543);assert.equal(input.preparedControlCopies.length,16);assert.equal(input.newCopies.length,25);assert.equal(input.git.length,4);
  const rows=[...declarations(input),...meta],copies=[],externalArtifactReferences=[];const seen=new Set();
  for(const row of rows){secureDataPath(row.origin);equalFile(row.origin,row);if(row.toolOnlyReference){externalArtifactReferences.push({...row,localPath:null,meaning:'DECLARED_TOOL_BINARY_HASHED_AND_REFERENCED_ONLY_NOT_VENDORED'});continue;}const localPath=slash(p.join('inputs',row.section,row.logicalPath));assert(!seen.has(localPath.toLowerCase()),'Duplicate local path');seen.add(localPath.toLowerCase());const local=p.resolve(own,localPath);assert(local.startsWith(p.join(own,'inputs')+p.sep));fs.mkdirSync(p.dirname(local),{recursive:true});fs.copyFileSync(row.origin,local,fs.constants.COPYFILE_EXCL);equalFile(local,row);equalFile(row.origin,row);copies.push({...row,localPath,originCheck:'EXACT_BEFORE_AND_AFTER_COPY',localCheck:'EXACT'});}
  const sections={};for(const row of input.artifactRows)sections[row.section]=(sections[row.section]??0)+1;assert.deepEqual(sections,{source:466,vendor:99,dependencies:3969,referenceOnly:3,driver:6});
  const owner=load(meta[1].origin);assert.equal(owner.status,'ACCEPT_SCOPED_NATIVE_PRIVATE_LAB_EXPORT_INPUT');
  const previousOwner={section:'historicalOwner',logicalPath:'PHY021_FIXTURE_EXPORT_RECEIPT_R01.json',origin:p.join(a0,owner.previousOwnerReceipt.path),bytes:owner.previousOwnerReceipt.bytes,sha256:owner.previousOwnerReceipt.sha256};secureDataPath(previousOwner.origin);equalFile(previousOwner.origin,previousOwner);const historicalLocal='inputs/historicalOwner/'+previousOwner.logicalPath;fs.mkdirSync(p.dirname(p.join(own,historicalLocal)),{recursive:true});fs.copyFileSync(previousOwner.origin,p.join(own,historicalLocal),fs.constants.COPYFILE_EXCL);equalFile(p.join(own,historicalLocal),previousOwner);copies.push({...previousOwner,localPath:historicalLocal,originCheck:'EXACT_BEFORE_COPY',localCheck:'EXACT'});
  const receipt={schema:'phy03.actual-export.immutable-consumption.r01',status:'COMPLETE_STATIC_BYTE_CONSUMPTION',cardStatus:'PARTIAL',fullGoal:'ACTIVE_INCOMPLETE',executionLocation:'LOCAL_WINDOWS_ISOLATED',session:before.session,head:before.git.head,branch:before.git.branch,createdAtUtc:new Date().toISOString(),authoritativeDetachedVerdict:owner.status,originalInputVerdict:input.independentReview,originalOwnerR01:'UNCHANGED_HISTORICAL_CREATION_TIME',artifactRows:4543,sections,preparedControlCopies:16,newCopies:25,producerGit:4,preparedInput:1,originMembership:membership(input),copies,externalArtifactReferences,copyBytes:copies.reduce((n,r)=>n+r.bytes,0),copyIndexSha256:hash(json(copies)),tools:tools(input),previousAnchors:before.previous,gitBeforeReference:'evidence/before.json',policy:{onlyFrozenArtifactOrigins:true,runtimePathCopied:false,importedModuleExecution:0,testsBuildRuntimeNativeBrowserGpuPidDbWrites:0,sourceDomainChanges:0,productIntegration:'NO',toolBinaryVendoring:false,toolBinaryMeaning:'DECLARED_EXES_HASHED_REFERENCED_ONLY; NO_EXTRA_EXE_COPY',historical47Pure:'NOT_A_NEW_PAYLOAD_OR_RUNTIME_PASS',humanApproval:'NOT_GRANTED'},sourceInputSha256:input.sourceInputSha256,inheritedActualCases:input.actualCases,inheritedActualCommandExits:input.actualCommandExitCodes,fixture:input.actualFixture,cleanup:input.cleanup,sourceBuildDriverMeaning:input.sourceBuildDriverMeaning};
  verifyCopies(receipt);write('CONSUMER_RECEIPT.json',receipt);console.log(JSON.stringify({status:receipt.status,copies:copies.length,bytes:receipt.copyBytes,copyIndexSha256:receipt.copyIndexSha256,artifactRows:4543,sections}));
}else if(mode==='--verify'){
  const before=load(p.join(own,'evidence/before.json')),receipt=load(p.join(own,'CONSUMER_RECEIPT.json'));const current=gitState('after');const result={status:'PASS_STATIC_DATA_ONLY',createdAtUtc:new Date().toISOString(),previous:verifyPrior(before.previous),copies:verifyCopies(receipt),git:verifyState(before,current),afterGit:current,importedModuleExecution:0,newRuntimeTestBuildNativeGpuPidProbe:0};write('evidence/after.json',result);console.log(JSON.stringify({status:result.status,previous:result.previous,copies:result.copies,git:result.git}));
}else{
  const before=load(p.join(own,'evidence/before.json')),receipt=load(p.join(own,'CONSUMER_RECEIPT.json'));
  for(const name of ['01-capture','02-consume','03-dossier','04-verify'])assert.equal(load(p.join(own,'evidence/commands/'+name+'.result.json')).exitCode,0);
  assert.equal(load(p.join(own,'FIELD_FACTS.json')).status,'PASS_STATIC_JSON_AND_BYTE_LINKAGE_ONLY');assert(fs.existsSync(p.join(own,'REVIEW.md')));
  const indexFile=p.join(own,'SourceDirtyIndex.json'),sealFile=p.join(own,'.runtime/seal.json'),patch=p.join(own,'.runtime/full-review.diff');
  if(mode==='--seal'){assert(!fs.existsSync(sealFile),'Already sealed; never rewrite terminal seal');if(!fs.existsSync(indexFile))fs.writeFileSync(indexFile,'{}\n',{flag:'wx'});}
  const priorResult=verifyPrior(before.previous),copiesResult=verifyCopies(receipt),state=gitState('terminal',false);verifyState(before,state);
  const paths=()=>walk(own,(file,e)=>file===p.join(own,'.runtime')||file===indexFile);
  const records=()=>paths().map(file=>({path:rel(file),...fileRow(file)}));
  const digest=rows=>hash(Buffer.from('phy03-actual-static-consumption-r01\0'+JSON.stringify(rows)));
  if(mode==='--seal'){
    const rows=records(),index={schema:'phy03.actual-export.source-dirty-index.r01',files:rows,digest:digest(rows),git:state,previousAnchors:priorResult,immutableCopies:copiesResult,excluded:'SourceDirtyIndex self-record only; .runtime terminal seal/logs/review staging excluded to break cycles; declared tool exe reference-only; every actual input copy included even if ignored by Git'};
    fs.writeFileSync(indexFile,json(index));
    const runtime=p.join(own,'.runtime');let attempt=1;while(fs.existsSync(p.join(runtime,'staging-'+attempt)))attempt++;const staging=p.join(runtime,'staging-'+attempt),empty=p.join(staging,'empty'),tree=p.join(staging,'tree');fs.mkdirSync(empty,{recursive:true});fs.mkdirSync(tree,{recursive:true});
    const files=[...paths(),indexFile];for(const file of files){const dest=p.join(tree,rel(file));fs.mkdirSync(p.dirname(dest),{recursive:true});fs.copyFileSync(file,dest,fs.constants.COPYFILE_EXCL);}
    const raw=p.join(staging,'raw.diff'),fd=fs.openSync(raw,'wx');
    const diffArgs=['--no-optional-locks','-c','core.longpaths=true','-c','core.quotePath=false','-c','core.autocrlf=false','diff','--no-index','--binary','--no-ext-diff','--no-textconv','--no-color','--src-prefix=a/','--dst-prefix=b/',slash(empty),slash(tree)];
    const diff=spawnSync(git,diffArgs,{cwd:root,stdio:['ignore',fd,'pipe'],maxBuffer:16*1024*1024,windowsHide:true});fs.closeSync(fd);assert(!diff.error,diff.error?.message);assert.equal(diff.status,1,diff.stderr?.toString());
    const out=fs.createWriteStream(patch),treePath=slash(tree);let pending='';
    const normalize=text=>text.replaceAll(treePath+'/','').replaceAll(treePath.replace(/^[A-Z]:/,'')+'/','');
    for await(const chunk of fs.createReadStream(raw,{encoding:'utf8'})){pending+=chunk;const end=pending.lastIndexOf('\n');if(end<0)continue;const text=normalize(pending.slice(0,end+1));pending=pending.slice(end+1);if(!out.write(text))await once(out,'drain');}
    if(pending)out.write(normalize(pending));out.end();await finished(out);
    const patchFd=fs.openSync(patch,'r');const parsed=spawnSync(git,['--no-optional-locks','apply','--numstat'],{cwd:root,stdio:[patchFd,'pipe','pipe'],maxBuffer:16*1024*1024,windowsHide:true});fs.closeSync(patchFd);assert(!parsed.error,parsed.error?.message);assert.equal(parsed.status,0,parsed.stderr?.toString());
    const reviewed=parsed.stdout.toString().trim().split('\n').map(line=>line.split('\t').slice(2).join('\t')).sort();assert.deepEqual(reviewed,files.map(rel).sort(),'Exact additive diff membership');
    assert.deepEqual(records(),rows,'New source changed during sealing');assert.equal(hash(json(gitState('terminal',false))),hash(json(state)),'Index or dirty membership changed during sealing');verifyPrior(before.previous);
    const seal={schema:'phy03.actual-export.terminal-byte-seal.r01',status:'COMPLETE_FINITE_STATIC_DELIVERY',cardStatus:'PARTIAL',fullGoal:'ACTIVE_INCOMPLETE',createdAtUtc:new Date().toISOString(),head:state.head,branch:state.branch,fileCount:rows.length,sourceDirtyTreeSha256:index.digest,index:{path:rel(indexFile),...fileRow(indexFile)},consumerReceipt:{path:rel(p.join(own,'CONSUMER_RECEIPT.json')),...fileRow(p.join(own,'CONSUMER_RECEIPT.json'))},receipt:{path:rel(p.join(own,'receipt.json')),...fileRow(p.join(own,'receipt.json'))},reviewDiff:{path:rel(patch),...fileRow(patch),fileCount:reviewed.length},git:{indexSha256:state.indexSha256,dirtySha256:state.dirtySha256},previousAnchors:priorResult,copies:copiesResult,sealingCommands:[{executable:git,args:diffArgs,exitCode:diff.status,meaning:'1_IS_GIT_NO_INDEX_DIFFERENCES_EXPECTED',stderrBytes:diff.stderr.length},{executable:git,args:['--no-optional-locks','apply','--numstat'],exitCode:parsed.status,meaning:'READONLY_PARSE_NOT_APPLICATION',paths:reviewed.length,numstatSha256:hash(parsed.stdout)}],excluded:index.excluded,importedModuleExecution:0,productIntegration:'NO',humanApproval:'NOT_GRANTED'};
    fs.writeFileSync(sealFile,json(seal),{flag:'wx'});console.log(JSON.stringify({status:'SEALED_STATIC',files:rows.length,seal:fileRow(sealFile),reviewDiff:seal.reviewDiff,sourceDirtyTreeSha256:seal.sourceDirtyTreeSha256}));
  }else{
    const seal=load(sealFile),index=load(indexFile);equalFile(indexFile,seal.index);equalFile(patch,seal.reviewDiff);equalFile(p.join(own,'CONSUMER_RECEIPT.json'),seal.consumerReceipt);equalFile(p.join(own,'receipt.json'),seal.receipt);
    assert.deepEqual(records(),index.files);assert.equal(digest(index.files),seal.sourceDirtyTreeSha256);assert.deepEqual(state,index.git);assert.equal(index.files.length,seal.fileCount);assert.equal(seal.importedModuleExecution,0);
    console.log(JSON.stringify({status:'PASS_STATIC_SEAL_CHECK',readOnly:true,files:seal.fileCount,seal:fileRow(sealFile),reviewDiffSha256:seal.reviewDiff.sha256,previous:priorResult,copies:copiesResult,index:'UNCHANGED',runtime:'NOT_RUN',productIntegration:'NO'}));
  }
}
