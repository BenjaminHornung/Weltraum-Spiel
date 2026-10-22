import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'), repo=resolve(root,'../..');
const admin=resolve(repo,'../../artifacts/hestia-cloud-orchestration-2026-10-09');
const state=JSON.parse(readFileSync(resolve(admin,'STATE.json')));
const task=state.tasks.find(t=>t.id==='WXG-07');
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bindings=[],verified=[];
function check(path,binding){const b=readFileSync(path);const expected=(binding.sha256??binding.digest).replace(/^sha256:/,'');if((binding.bytes!==undefined&&b.length!==binding.bytes)||sha(b)!==expected)throw Error('BYTE_BINDING:'+path);verified.push({source:path,bytes:b.length,sha256:sha(b)});return b;}
function copy(source,path,binding){const b=binding?check(source,binding):readFileSync(source);const out=resolve(root,'inputs',path);if(!out.startsWith(resolve(root,'inputs')+'/')&&!out.startsWith(resolve(root,'inputs')+'\\'))throw Error('PATH_ESCAPE');if(existsSync(out)&&!readFileSync(out).equals(b))throw Error('EXISTING_INPUT_CHANGED:'+out);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,b);bindings.push({path:relative(root,out).replaceAll('\\','/'),source,bytes:b.length,sha256:sha(b)});}
if(task.branch!=='feature/wxg-07-2026-10-09'||!state.capacity.activeIds.includes('WXG-07'))throw Error('OWNER_SLOT');
for(const [i,input] of task.boundInputs.entries()){
  const producer=input.root, label=i===0?'wxg':'plt', producerRepo=resolve(producer,'../..');
  check(input.receipt.path,input.receipt);check(input.seal.path,input.seal);
  const receipt=JSON.parse(readFileSync(input.receipt.path)),seal=JSON.parse(readFileSync(input.seal.path));
  const head=execFileSync(git,['rev-parse','HEAD'],{cwd:producerRepo,encoding:'utf8'}).trim();if(head!==state.baseCommit)throw Error('PRODUCER_BASE');
  const index=execFileSync(git,['ls-files','--stage','-z'],{cwd:producerRepo,maxBuffer:64*1024*1024});
  if(seal.indexBinding && 'sha256:'+sha(index)!==seal.indexBinding.digest)throw Error('INDEX_CHANGED');
  for(const f of seal.changedFiles)check(resolve(producerRepo,f.path),f);
  if(seal.reviewPatchDigest)check(resolve(producer,'.runtime/final-seal/review.patch'),{bytes:seal.reviewPatchBytes,sha256:seal.reviewPatchDigest});
  for(const f of receipt.files??[])check(resolve(producer,f.path),f);
  for(const f of receipt.compiledFiles??[])check(resolve(producer,f.path),f);
  copy(input.receipt.path,label+'/receipt.json',input.receipt);copy(input.seal.path,label+'/scope-seal.json',input.seal);
  copy(resolve(producer,'.runtime/final-seal/review.patch'),label+'/review.patch');
  if(i===0){
    copy(resolve(producer,'ConsumerBindings.json'),label+'/ConsumerBindings.json',input.source.consumerManifest);
    copy(resolve(producer,'SourceBindings.json'),label+'/SourceBindings.json',input.source.sourceBindings);
    const cm=JSON.parse(readFileSync(resolve(producer,'ConsumerBindings.json')));
    for(const f of cm.files)copy(resolve(producer,f.path),label+'/'+f.path,f);
    for(const f of receipt.files??[])if(/^(src\/|tests\/|fixtures\/|package|tsconfig|scripts\/build)/.test(f.path))copy(resolve(producer,f.path),label+'/'+f.path,f);
    for(const f of receipt.compiledFiles)copy(resolve(producer,f.path),label+'/'+f.path,f);
    for(const f of input.modelImplementation.inputs)check(resolve(producer,f.path),f);
    check(resolve(producer,input.modelImplementation.config.path),input.modelImplementation.config);
  }else{
    check(resolve(producer,'SourceBindings.json'),{sha256:input.sourceBindingDigest});
    check(resolve(producer,'dependencies.lock.json'),{sha256:input.dependencyBindingDigest});
    for(const p of ['SourceBindings.json','dependencies.lock.json','snapshot/manifest.json','NumericsProfile.json','src/numerics.mjs','snapshot/time.mjs','tests/numerics.test.mjs'])if(existsSync(resolve(producer,p)))copy(resolve(producer,p),label+'/'+p);
    for(const f of seal.changedFiles)if(/\.(wasm|wgsl|lock|json)$/.test(f.path))check(resolve(producerRepo,f.path),f);
  }
}
for(const p of ['00_START_HIER.md','01_PRUEFUNG_UND_ENTSCHEIDUNG.md','03_SCHNITTSTELLEN_UND_UEBERNAHME.md','Cloud/00_GEMEINSAMER_VERTRAG.md','Auftraege/WXG-07.md','Goals/WXG-07.txt','SOURCE_DOCS.json','Quellen/weltraum-universeller-planeten-wetter-climate-core-architektur-v2-2026-10-09.md','Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md'])copy(resolve(state.packagePath,p),'order/'+p);
for(const p of ['STATE.json','USER_OVERRIDES_2026-10-09.md'])copy(resolve(admin,p),'administration/'+p);
for(const p of ['time.ts','ids.ts']){const source='apps/weltraum-browser/src/persistence/'+p;copy(resolve(repo,source),'product/'+p);const b=execFileSync(git,['show',state.baseCommit+':'+source],{cwd:repo});bindings.at(-1).gitBlobSha256=sha(b);bindings.at(-1).workingTreeMatchesBlob=readFileSync(resolve(repo,source)).equals(b);if(!bindings.at(-1).workingTreeMatchesBlob)throw Error('PRODUCT_BLOB');}
const report={schema:'wxg07.frozen-inputs/v1',baseline:state.baseCommit,owner:{nativeId:task.sessionId,agentId:task.paseoAgentId,branch:task.branch},originalZipSha256:state.originalZipSha256,verifiedProducerFiles:verified,files:bindings,wasm:'UPSTREAM_VERIFIED_NOT_CONSUMED',shader:'NOT_APPLICABLE',noMovingImports:true};
writeFileSync(resolve(root,'InputBindings.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verified:verified.length,copied:bindings.length,bytes:bindings.reduce((s,f)=>s+f.bytes,0),manifestSha256:sha(readFileSync(resolve(root,'InputBindings.json')))}));
