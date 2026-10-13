import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {root,repo,hash,json,save,bytes,verifyFiles,verifyIsolation,node,python,gitPath} from './bindings.mjs';
verifyIsolation();if(existsSync(resolve(root,'InputBindings.json')))throw Error('FREEZE_ALREADY_EXISTS');
const siblings=resolve(repo,'..'),files=[],anchors=[];
function copy(base,p,dest,expected){const b=readFileSync(resolve(base,p));if(expected&&(b.length!==expected.bytes||hash(b)!==expected.sha256))throw Error('ORIGIN_DRIFT:'+p);const q=resolve(root,dest);if(existsSync(q))throw Error('COPY_EXISTS:'+dest);mkdirSync(dirname(q),{recursive:true});writeFileSync(q,b);files.push({...bytes(root,dest),origin:resolve(base,p),originSha256:hash(b),copy:'UNMODIFIED'});}
const wxg=resolve(siblings,'Hestia-Spike-WXG-01-04-2026-10-09/spikes/wxg-01-04-analytic');
const fld=resolve(siblings,'Hestia-Spike-FLD-01-PHY-05-2026-10-09/spikes/fld-01-phy-05-fluid');
for(const [id,base,rsha,sbytes,ssha] of [
 ['wxg',wxg,'1bc3442c6d068ed42b207857949dd168f3e7f6da64d0842b99228df4608c7106',31984,'03a072879c1d06484d3e8aec78883e8de3dcbef82866fa6722c056612055161e'],
 ['fld',fld,'f7e1d2b684fa4ec6ae5ccf46b522d9d16b82a1a9e3d4ac56854bcdce7873ef0a',17716,'86bc67d36ee052c65c9c36ab143d874d9f578a910e003ae94b9096aec0a64f22']]){
 const rbytes=id==='wxg'?83288:126042;
 copy(base,'receipt.json',`inputs/${id}/receipt.json`,{bytes:rbytes,sha256:rsha});
 copy(base,'.runtime/final-seal/scope-seal.json',`inputs/${id}/.runtime/final-seal/scope-seal.json`,{bytes:sbytes,sha256:ssha});
 const seal=json(resolve(base,'.runtime/final-seal/scope-seal.json'));
 copy(base,'.runtime/final-seal/review.patch',`inputs/${id}/.runtime/final-seal/review.patch`,{bytes:seal.reviewPatchBytes,sha256:seal.reviewPatchDigest.slice(7)});
 copy(base,'HANDOFF.md',`inputs/${id}/HANDOFF.md`);
 anchors.push({producer:id,receiptSha256:rsha,sealSha256:ssha,acceptedFor:id==='wxg'?'FINITE_SYNTHETIC_READ_INPUT':'EVENT_ADMISSION_BALANCE_DISCIPLINE_ONLY'});
}
const wr=json(resolve(wxg,'receipt.json')),consumer=json(resolve(wxg,'ConsumerBindings.json'));
const refs=[...consumer.files,...wr.files,...wr.testedInputs,...wr.compiledFiles,{...wr.source.sourceBindings},wr.source.consumerManifest];
const map=new Map();for(const f of refs){if(map.has(f.path)&&map.get(f.path).sha256!==f.sha256)throw Error('UPSTREAM_CONFLICT:'+f.path);map.set(f.path,f);}
for(const p of ['.runtime/model-binding.json','.runtime/build-bindings.json'])map.set(p,bytes(wxg,p));
for(const [p,f] of [...map].sort(([a],[b])=>a.localeCompare(b))){if(p==='HANDOFF.md')continue;copy(wxg,p,'inputs/wxg/'+p,f);}
const wxgRepo=resolve(wxg,'../..'),run=resolve(wxgRepo,dirname(wr.tests.summaryRepoPath));
copy(wxgRepo,wr.tests.summaryRepoPath,wr.tests.summaryRepoPath,wr.tests.summary);
for(const c of wr.tests.checks)for(const key of ['stdout','stderr'])copy(run,c[key].path,dirname(wr.tests.summaryRepoPath).replaceAll('\\','/')+'/'+c[key].path,c[key]);
for(const p of ['InputBindings.json','SourceBindings.json','DependencyBindings.json','BuildBindings.json','ToolBindings.json','src/basin.ts','src/pipe.ts','src/contracts.ts','scripts/bindings.mjs','scripts/capture-inputs.mjs','fixtures/cases.json','fixtures/numerics-profile.json']){
 if(existsSync(resolve(fld,p)))copy(fld,p,'inputs/fld/'+p);
}
const pkg=resolve('C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09');
for(const p of ['00_START_HIER.md','01_PRUEFUNG_UND_ENTSCHEIDUNG.md','03_SCHNITTSTELLEN_UND_UEBERNAHME.md','Cloud/00_GEMEINSAMER_VERTRAG.md','Auftraege/WXG-06.md','Goals/WXG-06.txt','SOURCE_DOCS.json',...Object.entries(json(resolve(pkg,'SOURCE_DOCS.json'))).filter(([k])=>['WX','VW','REG'].includes(k)).map(([,v])=>'Quellen/'+v)])copy(pkg,p,'inputs/order/'+p);
copy(repo,'LICENSE','inputs/licenses/PROJECT_LICENSE');
copy(resolve(pkg,'..'),'USER_OVERRIDES_2026-10-09.md','inputs/order/USER_OVERRIDES_2026-10-09.md');
const lock=json(resolve(wxg,'package-lock.json'));lock.name='wxg-06-local-fluid';lock.packages[''].name=lock.name;save(resolve(root,'package-lock.json'),lock);files.push({...bytes(root,'package-lock.json'),origin:resolve(wxg,'package-lock.json'),originSha256:wr.compiler.lock.sha256,copy:'ROOT_PACKAGE_NAME_ONLY'});
const tools=[['node',node,'22.23.2'],['python',python,'3.12.13'],['git',gitPath,'2.56.0.windows.1']].map(([name,path,version])=>({name,path,version,bytes:readFileSync(path).length,sha256:hash(readFileSync(path))}));
const toolNode=wr.tools.find(t=>t.name==='node');if(tools[0].sha256!==toolNode.sha256||process.versions.node!==toolNode.version)throw Error('NODE_PIN');
verifyFiles(root,files);save(resolve(root,'InputBindings.json'),{schema:'wxg06.closed-input/v1',anchors,files:files.sort((a,b)=>a.path.localeCompare(b.path)),tools,compiler:'typescript@7.0.2; exact533-member copied WXG closure; no install/link',wxgCompiledFiles:wr.compiledFiles.length,originState:bytes(resolve(pkg,'..'),'STATE.json'),adaptedPort:'scripts/read-port.mjs; original unchanged inputs/wxg/scripts/read-port.mjs retained',waterAsAirAuthority:false});
console.log(JSON.stringify({status:'PASS',files:files.length,wxgCompiledFiles:wr.compiledFiles.length,node:process.versions.node}));
