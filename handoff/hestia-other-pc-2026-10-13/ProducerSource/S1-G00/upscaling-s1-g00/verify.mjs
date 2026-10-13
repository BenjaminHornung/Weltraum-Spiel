import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const spike=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(spike,'../..');
const prefix='spikes/upscaling-s1-g00/',change='.devtoolbox/specs/changes/upscaling-s1-g00-2026-10-09/';
const sealPath=prefix+'delivery-seal.json',lab='17b1db4201a28e7b607c30707bdc2b75e3484a10';
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
assert(process.argv.slice(2).every(a=>a==='--seal'),'Only frozen-input verification and --seal are supported; no moving-WIP comparison');
const hash=(b,a='sha256',e='hex')=>createHash(a).update(b).digest(e);
const read=p=>readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const owned=p=>p.startsWith(prefix)||p.startsWith(change);
const enumerate=(dir,prefixPath)=>readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{
  assert(!e.isSymbolicLink(),'Symlinks are not delivery files');
  const p=prefixPath+e.name;return e.isDirectory()?enumerate(path.join(dir,e.name),p+'/'):[p];
});
const names=()=>[...enumerate(spike,prefix),...enumerate(path.join(root,change),change)].filter(p=>p!==sealPath).sort();
const run=(args,at=root)=>{
  const r=spawnSync(git,['--no-optional-locks','-C',at,...args],{encoding:'utf8',timeout:60000,maxBuffer:32*1024*1024,windowsHide:true});
  assert.equal(r.status,0,r.error?.message??r.stderr);return r.stdout.trimEnd();
};
assert.equal(path.basename(root),'Hestia-Upscaling-S1-G00-2026-10-09');
assert.equal(run(['rev-parse','HEAD']),lab);
assert.equal(run(['branch','--show-current']),'feature/upscaling-s1-g00-2026-10-09');
const parseStatus=text=>{
  const records=text.split('\0').filter(Boolean),paths=[];
  for(let i=0;i<records.length;i++){
    const r=records[i];paths.push(r.slice(3));
    if(/[RC]/.test(r.slice(0,2)))paths.push(records[++i]);
  }return paths;
};
assert.deepEqual(parseStatus('?? spikes/upscaling-s1-g00/a file\0'),['spikes/upscaling-s1-g00/a file']);
assert.deepEqual(parseStatus('R  spikes/upscaling-s1-g00/new\0foreign/old\0'),['spikes/upscaling-s1-g00/new','foreign/old']);
assert(!owned('apps/weltraum-browser/package.json'));
const dirtyPaths=parseStatus(run(['status','--porcelain=v1','-z','-uall']));
assert(dirtyPaths.every(owned),'Out-of-scope repository changes: '+dirtyPaths.filter(p=>!owned(p)).join(', '));
const current=names().map(p=>{assert(owned(p));const b=read(p);return{path:p,bytes:b.length,sha256:hash(b)};});
const sealing=process.argv.includes('--seal');
if(!sealing){
  assert(existsSync(path.join(root,sealPath)),'Create delivery seal with --seal');
  const seal=json(sealPath);assert.deepEqual(seal.files,current,'Delivery bytes/paths changed');assert.equal(seal.contentDigest,hash(JSON.stringify(current)));
  assert.equal(seal.root,root);assert.equal(seal.head,lab);
}
const receipt=json(prefix+'receipt.json'),ownership=json(prefix+'ownership.json');
assert.equal(receipt.productFreeze,null);assert.equal(receipt.a0.movingWipIsFrozen,false);assert.equal(receipt.nextGateProductWrites,'NO_PRODUCT_GATE_OR_SLOT_GRANTED_G01_NOT_STARTED');
assert.equal(receipt.candidateAcceptance,'NOT_ACCEPTED_PENDING_USER_ROOT_PACKET_REVIEW');assert.equal(receipt.slotsGranted,false);
assert.equal(receipt.gateAcceptance,'PENDING_INDEPENDENT_ROOT_REVIEW_NO_PASS_CLAIM');
assert.equal(receipt.programClaims.currentSourceBuild,'NOT_RUN');assert.equal(receipt.programClaims.humanApproval,'NOT_CLAIMED');
assert.equal(receipt.programClaims.stage1Completed,false);assert.equal(receipt.programClaims.stage2Implemented,false);
assert.deepEqual(ownership.allowedCurrentProductWrites,[]);assert.equal(ownership.productIntegrationOwner,'A0_ONLY');
for(const p of ['HANDOFF.md','rendering-baseline-inventory.md','conflict-map.md','test-scenarios-and-commands.md','README.md'])assert(existsSync(path.join(spike,p)),p);
const observation=prefix+'evidence/closing-r02/';
const inputs=json(observation+'input-manifest.json');
const master=inputs.inputs.find(p=>p.path.startsWith('sources/'));assert.equal(master.bytes,132508);assert.equal(master.sha256,receipt.masterplan.sha256);
for(const producer of inputs.producers)assert(producer.stateDigestChecks.every(c=>c.matches.length>0),'Producer STATE digest mismatch');
const committedIds=['lab','local-main','stored-origin-main'];
let verifiedBlobs=0;
for(const id of committedIds){
  const source=json(observation+`source-${id}.json`);
  assert.equal(source.digest,hash(JSON.stringify(source.files)));
  const r=spawnSync(git,['--no-optional-locks','-C',root,'cat-file','--batch'],{input:source.files.map(f=>f.object).join('\n')+'\n',timeout:60000,maxBuffer:128*1024*1024,windowsHide:true});
  assert.equal(r.status,0,r.error?.message??r.stderr.toString());let offset=0;
  for(const f of source.files){const end=r.stdout.indexOf(10,offset);assert(end>=0);const header=r.stdout.subarray(offset,end).toString().split(' ');assert.equal(header[1],'blob');const n=Number(header[2]),b=r.stdout.subarray(end+1,end+1+n);assert.equal(f.bytes,n);assert.equal(f.sha256,hash(b));offset=end+2+n;verifiedBlobs++;}
  assert.equal(offset,r.stdout.length);
}
const carrier=json(observation+'source-carrier-wip.json');
for(const f of carrier.files){assert(!f.error,f.path);const b=read(f.path);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256,'Carrier product changed: '+f.path);}
const closure=json(observation+'render-closure-a0-wip.json');
assert.equal(closure.unresolved.length,0);assert(closure.hits.some(h=>h.text.includes('new THREE.ShaderMaterial')&&h.file.includes('visualEffects')));
assert(closure.closures.normal.includes('apps/weltraum-browser/src/hvp/hvpCoastSource.ts'),'Normal-route helper reachability must remain visible');
// Consume only registered immutable snapshots; management observations never become a full WIP freeze.
const a0=path.resolve(root,'../Hestia-CutV3-Resume-2026-10-05');
const safe=(base,p)=>{const absolute=path.resolve(base,p);assert(absolute.startsWith(path.resolve(base)+path.sep),'Input path escape: '+p);return absolute;};
const check=(base,row,p=row.path)=>{const b=readFileSync(safe(base,p));assert.equal(b.length,row.bytes,p);assert.equal(hash(b),row.sha256,p);return b;};
assert.throws(()=>safe(a0,'../outside'));
const frozenDir=prefix+'evidence/a0-frozen-r03/',frozen=json(frozenDir+'a0-r01-binding.json');
assert.equal(path.resolve(frozen.a0Root),a0);assert.equal(frozen.head,lab);
for(const f of frozen.entryBindings)check(a0,f);
const frozenInput=JSON.parse(check(a0,frozen.entryBindings.find(f=>f.path.endsWith('/INPUT.json'))));
assert.equal(frozen.entryBindings.find(f=>f.path.endsWith('/INPUT.json')).sha256,'6cda4f268f3442bfc7249768e8ca7798ecf9c9cbe28012f4fae3d95fb3193521');
const pyJson=v=>Array.isArray(v)?'['+v.map(pyJson).join(', ')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>pyJson(k)+': '+pyJson(v[k])).join(', ')+'}':JSON.stringify(v).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
assert.equal(hash(pyJson(frozenInput.source)),'f292a7f57f5bc8c6e848b08a566c9f5f8225c13a30b396434423a561cc839982');
assert.equal(hash(pyJson(frozenInput.built)),'958428bf2cfd237dfcdbf2190cd2924d2b12a347ab8d4dd1f62b75b9a4e985a1');
let frozenFiles=0;
for(const [kind,count,base] of [['source',462,frozen.sourceRoot],['built',93,frozen.buildRoot],['dirty',14,frozen.snapshotRoot],['dependencies',2174,frozen.snapshotRoot],['evidence',12,frozen.snapshotRoot]]){
  assert.equal(frozenInput[kind].length,count);for(const f of frozenInput[kind]){check(base,f);frozenFiles++;}
}
assert.equal(frozenFiles,2755);
assert.deepEqual(enumerate(frozen.sourceRoot,'').sort(),frozenInput.source.map(f=>f.path).sort(),'Frozen source membership');
assert.deepEqual(enumerate(frozen.buildRoot,'').sort(),frozenInput.built.map(f=>f.path).sort(),'Frozen build membership');
assert.equal(hash(readFileSync(frozen.helper.path)),'933dbdc5a65a4b4ba3020b8c984d8ed7b2c7826de2d8868bd0896b2086625d72');
assert.equal(frozen.helper.exitCode,0);assert.equal(JSON.parse(frozen.helper.stdout).status,'BOUND_INPUT_ONLY');
assert.equal(hash(read(frozenDir+'frozen-helper-verify.log')),frozen.helper.logSha256);
const fixtures=json(frozenDir+'frozen-fixtures.json');
const candidate=JSON.parse(check(fixtures.fixtureBinding.root,fixtures.fixtureBinding));
const saved=candidate.nativeWake.residentEastColdLoad.saved;assert.equal(typeof saved,'string');assert.equal(Buffer.byteLength(saved),697368);
assert.equal(hash(saved),'326b325a7c5f4027316bbe4a9f1f967666e05407620330726d538eb49d9a51a0');
assert.equal(JSON.parse(saved).player.data.hestia.signature,'fnv1a32:a93a402a');
const memo=JSON.parse(check(fixtures.memoBinding.root,fixtures.memoBinding));
assert.equal(memo.rawInputHash,frozenInput.savedFixture.rawInputHash);
for(const f of frozenInput.savedFixture.packets){const s=memo.samples.find(s=>s.lod===f.lod);assert.equal(s.packetBytes,f.packetBytes);assert.equal(s.packetSha256,f.packetSha256);}
const mapEvidence=json(frozenDir+'built-source-map-bindings.json'),maps=new Map();
assert.equal(mapEvidence.matchCount,442);assert.equal(mapEvidence.missingCount,0);
for(const row of mapEvidence.matches){
  if(!maps.has(row.map))maps.set(row.map,JSON.parse(readFileSync(safe(frozen.buildRoot,row.map))));
  const map=maps.get(row.map),i=map.sources.findIndex(s=>!s.includes('node_modules/')&&s.endsWith(row.source.replace('apps/weltraum-browser/','')));
  assert(i>=0,row.source);assert.equal(hash(map.sourcesContent[i]),row.sha256);assert.equal(row.status,'EXACT_SOURCE_CONTENT_MATCH');
}
for(const c of json(frozenDir+'frozen-contract-source-excerpts.json')){
  assert(c.binding,'Missing exact contract source: '+c.file);const lines=check(frozen.sourceRoot,c.binding).toString('utf8').split(/\r?\n/);
  for(const l of c.exactSourceExcerpts)assert.equal(lines[l.line-1],l.text,c.file);
}
const currentDir=prefix+'evidence/a0-current-r02/',bound=json(currentDir+'a0-current-r02-binding.json');
assert.equal(path.resolve(bound.a0Root),a0);const input=JSON.parse(check(a0,bound.receiptBinding));
assert.equal(bound.receiptBinding.sha256,'acca9a427126d6118ad293b07a298fa9d61ef5e9eb42eefa2828d42a55bdc34c');
assert.deepEqual(bound.value,input);assert.equal(input.head,lab);assert.equal(input.branch,receipt.a0.branch);
const snapshot=f=>{assert(f.snapshot,'Explicit snapshot required: '+f.path);return check(a0,f,f.snapshot);};
for(const [kind,count,digest] of [['source',463,'2f0401b883716b884c81582e7f1c666209dbf0413556a638618f071c6cc71a91'],['dirty',17,'8503b3646281b8fdac18321f09bfa11361859a5d4e9da9be3aea233586cd88d0'],['index',817,'3c8d8421ca4492db9788df56dba76f4c38202b181f5a18def261ab4cdff0d44d']]){
  assert.equal(input[kind].length,count);assert.equal(hash(JSON.stringify(input[kind])),digest);assert.equal(input[kind+'ManifestSha256'],digest);
}
input.source.forEach(snapshot);assert.equal(new Set(input.source.map(f=>f.path)).size,463);
assert.equal(input.assets.length,77);input.assets.forEach(snapshot);snapshot(input.lock);
assert.equal(input.lock.sha256,'df777f04bd29b891cccefcffb3b54cdd9f4dec8ae59d3de258ecdb85696c3890');
assert.equal(input.source.find(f=>f.path==='apps/weltraum-browser/index.html').sha256,'93c4ec358bca75fa789e61d8e8fc7caec322d9500f0a541440052a9a8c3bd1bf');
assert.equal(bound.verifiedDirtySnapshots.length,17);
for(const f of bound.verifiedDirtySnapshots){snapshot(f);const row=input.dirty.find(r=>r.path===f.path);assert.equal(row.sha256,f.sha256);assert.equal(row.bytes,f.bytes);assert.equal(row.gitState,f.gitState);}
check(a0,bound.dispositionBinding);assert.equal(bound.dispositionBinding.sha256,'008ee3fa1676251fb8c77738c3e05647bf8ed084fb5c5b0ef3e7586c3b8302f8');
assert.equal(input.currentBuild.status,'NOT_RUN');assert.equal(input.currentBuild.hash,null);
assert.equal(input.dependencyWriteSlot,'A0_EXISTING_SLOT_ONLY_AFTER_FINAL_G00_SEAL_AND_ROOT_REVIEW');
assert.equal(receipt.acceptedSourceOnlyInput.sha256,bound.receiptBinding.sha256);
for(const kind of ['source','dirty','index'])assert.equal(receipt.acceptedSourceOnlyInput[kind+'ManifestSha256'],input[kind+'ManifestSha256']);
assert.equal(receipt.conflictDisposition.sha256,bound.dispositionBinding.sha256);assert.equal(receipt.conflictDisposition.g01Started,false);
assert.equal(input.hardwareSlot,'NOT_GRANTED');assert.equal(input.referenceWindow,'NOT_CONFIRMED');assert.equal(input.humanApproval,'NOT_CLAIMED');
assert.equal(bound.liveGit.head.exitCode,0);assert.equal(bound.liveGit.branch.exitCode,0);assert.equal(bound.liveGit.indexExit,0);assert.equal(bound.liveGit.dirtyExit,0);
assert.equal(bound.liveGit.indexMatches,true);assert.equal(bound.liveGit.dirtyMembershipMatches,true);assert.equal(bound.g01Started,false);
const currentClosure=json(currentDir+'render-closure-a0-current-source-r02.json');assert.equal(currentClosure.unresolved.length,0);
assert.deepEqual(Object.fromEntries(Object.entries(currentClosure.closures).map(([k,v])=>[k,v.length])),{hvp:205,normal:137,surfaceLab:162});
const delta=json(prefix+'evidence/a0-delta-r02/delta-bindings.json');assert.equal(delta.receipts.length,2);assert.equal(delta.snapshots.length,6);assert.equal(delta.reports.length,5);
for(const f of delta.receipts)assert.deepEqual(JSON.parse(check(a0,f)),f.value);
for(const f of delta.snapshots)snapshot(f);
assert.equal(delta.receipts[1].value.artifacts.length,4);
for(const f of delta.reports){const r=JSON.parse(check(a0,f));assert.equal(r.numPassedTests,f.passed);assert.equal(r.numFailedTests,f.failed);assert.equal(r.numPendingTests,f.pending);}
assert.equal(delta.newRootTests,false);assert.equal(delta.route.liveIsR33,false);assert.equal(delta.phy01IndependentFreeze,'PENDING');
for(const b of json(prefix+'runner-profile.json').binaries){assert(path.resolve(b.path).startsWith('C:\\IFI_SourceCode\\'));assert.equal(hash(readFileSync(b.path)),b.sha256,b.name);}
assert.equal(hash(readFileSync(frozen.helper.python)),frozen.helper.pythonSha256);
const external=prefix+'evidence/baseline-r01/external/',packages=json(external+'external-manifest.json');
assert.equal(packages.packages.length,4);
for(const p of packages.packages){assert(p.packageIntegrityVerified);const b=read(external+`packages/${p.id}/package.tgz`);assert.equal(hash(b),p.tarballSha256);assert(p.dist.integrity.split(' ').includes('sha512-'+hash(b,'sha512','base64')));assert.equal(hash(b,'sha1'),p.dist.shasum);}
for(const f of json(external+'package-contract-source-manifest.json').files){const b=read(external+f.file);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);}
const upscaler=packages.packages.find(p=>p.id==='upscaler');
assert.equal(json(external+'release-ref-resolution.json').upscalerTagObject.object.sha,upscaler.gitHead);
assert.equal(json(external+'release-provenance-final.json').commit.sha,packages.packages.find(p=>p.id==='three').gitHead);
const baseline=json(prefix+'evidence/baseline-r01/baseline/results.json');assert.equal(baseline.productPass,false);assert(baseline.steps.every(s=>s.status==='FAIL_ENV'&&s.exitCode===1));
for(const s of baseline.steps)assert.equal(hash(read(prefix+'evidence/baseline-r01/baseline/'+s.log)),s.logSha256);
const index=run(['ls-files','--stage','-z']),staged=run(['diff','--cached','--name-only']);
assert.equal(staged,'','No inventory files are staged or committed');
if(sealing){
  writeFileSync(path.join(root,sealPath),JSON.stringify({schema:'hestia.s1g00.delivery-seal.v2',at:new Date().toISOString(),root,head:lab,branch:'feature/upscaling-s1-g00-2026-10-09',carrierTree:run(['rev-parse','HEAD^{tree}']),carrierIndexSha256:hash(index),carrierIndexRows:index.split('\0').filter(Boolean).length,stagedPaths:[],excluded:[sealPath],files:current,contentDigest:hash(JSON.stringify(current)),verificationCommand:'C:/IFI_SourceCode/Utils/opencode-migration/runtime/node26/node.exe spikes/upscaling-s1-g00/verify.mjs',verifierSha256:hash(read(prefix+'verify.mjs')),tools:json(prefix+'runner-profile.json'),inputBindings:{currentReceiptSha256:bound.receiptBinding.sha256,sourceManifestSha256:input.sourceManifestSha256,dirtyManifestSha256:input.dirtyManifestSha256,indexManifestSha256:input.indexManifestSha256,lockSha256:input.lock.sha256,dispositionSha256:bound.dispositionBinding.sha256,historicalInputSha256:frozen.entryBindings.find(f=>f.path.endsWith('/INPUT.json')).sha256},approval:'NONE_LOCAL_DIGEST_ONLY_ROOT_REVIEW_PENDING'},null,2)+'\n');
}
const seal=json(sealPath);assert.equal(seal.carrierIndexSha256,hash(index));
console.log(JSON.stringify({status:'PASS_DELIVERY_INVENTORY_ONLY',root,head:lab,files:current.length,verifiedCommittedBlobs:verifiedBlobs,carrierFiles:carrier.files.length,historicalFrozenFiles:frozenFiles,historicalSourceMapMatches:442,currentSnapshotSources:463,currentDirtySnapshots:17,currentIndexRecords:817,currentAssets:77,deltaReceipts:2,deltaSnapshotRows:6,producerReportRows:5,packages:4,productBaseline:'FAIL_ENV',currentSourceBuild:'NOT_RUN',g00Acceptance:'PENDING_INDEPENDENT_ROOT_REVIEW_NO_PASS_CLAIM',g01Started:false,liveWipConsumption:false,contentDigest:seal.contentDigest}));
