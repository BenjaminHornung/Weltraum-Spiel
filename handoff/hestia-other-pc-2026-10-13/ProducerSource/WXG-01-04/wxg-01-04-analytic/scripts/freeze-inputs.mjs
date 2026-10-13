import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {root,repo,baseline,hash,json,save,bytes,verifyFiles,verifyIsolation,walk} from './bindings.mjs';
const cel=resolve(repo,'../Hestia-Spike-CEL-01-WXG-00-2026-10-09/spikes/cel-01-wxg-00-contracts');
const plt=resolve(repo,'../Hestia-Spike-PLT-01-02-2026-10-09/spikes/plt-01-02-numerics');
const anchors=[['CEL',cel,'receipt.json',72216,'3b255ee3e75a272823aa01c734e14baa1157c663625c91254fd6101b6332c67c'],['CEL',cel,'.runtime/final-seal/scope-seal.json',20200,'c5796096462abb45e99740cb7e74620e0f5df46d64691ae631512403c603a0d2'],['CEL',cel,'.runtime/final-seal/review.patch',865967,'fe8be00fbc8d4e533307369652cae579ac0b55e90600c963b71c97feae9b08d4'],['PLT',plt,'receipt.json',13793,'5842f1c2b781c1ce65a347ec45c28da0717215537ebd45ee100b3a255429555a'],['PLT',plt,'.runtime/final-seal/scope-seal.json',21203,'b4c0daf90e5c91e4f6811e47b08f32dcfc39b2e932b1e9f34fc53c4009586c6d']];
verifyIsolation();if(existsSync(resolve(root,'ConsumerBindings.json')))throw Error('FROZEN_INPUTS_EXIST');
const audit=[];
for(const [producer,base,path,size,digest] of anchors){verifyFiles(base,[{path,bytes:size,sha256:digest}]);audit.push({producer,...bytes(base,path)});}
for(const base of [cel,plt]){
  const seal=json(resolve(base,'.runtime/final-seal/scope-seal.json'));
  if('sha256:'+hash(JSON.stringify(seal.changedFiles))!==seal.dirtyTreeDigest)throw Error('SEAL_HASH');
  verifyFiles(resolve(base,'../..'),seal.changedFiles.map(f=>({path:f.path,bytes:f.bytes,sha256:f.digest.slice(7)})));
}
const r=json(resolve(cel,'receipt.json')),d=json(resolve(cel,'DependencyBindings.json'));
for(const t of d.tools){const b=readFileSync(t.executablePath);if(b.length!==t.bytes||hash(b)!==t.sha256)throw Error('TOOL_DRIFT:'+t.name);}
for(const list of [r.files,r.modelImplementation.modelInputs,r.testedInputs,r.compiledInputs,r.compiledRuntime.files,r.source.files])verifyFiles(cel,list);
if('sha256:'+hash(JSON.stringify(r.modelImplementation.modelInputs))!==r.modelImplementation.modelDigest||r.modelImplementation.modelDigest!=='sha256:6a51ff1ab2ca347befe5aca796e230034368671abb98d1fe83a504025ed20c4e')throw Error('MODEL_DIGEST');
verifyFiles(resolve(cel,'node_modules'),d.nodeModules.files);
if(JSON.stringify(walk(resolve(cel,'node_modules')))!==JSON.stringify(d.nodeModules.files.map(f=>f.path).sort()))throw Error('COMPILER_MEMBERSHIP');
const summaryPath=resolve(cel,'../..',r.tests.evidence.path);verifyFiles(resolve(cel,'../..'),[r.tests.evidence]);
const summary=json(summaryPath);if(summary.status!=='PASS'||summary.passed!==72||summary.failed!==0||summary.checks.length!==4||summary.checks.some(c=>c.exitCode!==0))throw Error('UPSTREAM_RUN');
// Raw logs are part of the sealed producer change; no producer helper is executed.
const files=[];function copy(base,path,target,producer){const b=readFileSync(resolve(base,path));const dest=resolve(root,target);if(existsSync(dest))throw Error('COPY_EXISTS:'+target);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,b);files.push({path:target,producer,sourcePath:path,bytes:b.length,sha256:hash(b)});}
const required=new Set([...r.source.files.map(f=>f.localPath),...r.testedInputs.map(f=>f.localPath).filter(p=>/^(src|fixtures|tests|snapshot|vendor)\//.test(p)),...r.compiledInputs.map(f=>f.localPath),...r.files.map(f=>f.path),'README.md','receipt.json']);
// Audit-only upstream scripts/tests are kept unchanged; our controls import only the frozen dist closure.
for(const p of [...required].sort())copy(cel,p,'vendor/cel/'+p,'CEL-01-WXG-00');
for(const [producer,base,path] of anchors.filter(a=>a[2].includes('final-seal')||a[0]==='PLT'))copy(base,path,'upstream/'+producer+'/'+path.replace('.runtime/',''),'sealed-audit');
for(const f of d.nodeModules.files)copy(resolve(cel,'node_modules'),f.path,'node_modules/'+f.path,'CEL-byteverified-compiler');
const lock=json(resolve(cel,'package-lock.json'));lock.name='wxg-01-04-analytic';lock.packages[''].name=lock.name;save(resolve(root,'package-lock.json'),lock);
const packageRoot=resolve(repo,'../../artifacts/hestia-cloud-orchestration-2026-10-09/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09');
const packageInputs=['00_START_HIER.md','01_PRUEFUNG_UND_ENTSCHEIDUNG.md','03_SCHNITTSTELLEN_UND_UEBERNAHME.md','Cloud/00_GEMEINSAMER_VERTRAG.md','Auftraege/WXG-01-04.md','Goals/WXG-01-04.txt','SOURCE_DOCS.json','Quellen/weltraum-universeller-planeten-wetter-climate-core-architektur-v2-2026-10-09.md','Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md'].map(p=>bytes(packageRoot,p));
const fixedProductReads=['world-generation/hestia/seed.ts','world-generation/hestia/types.ts','world-generation/hestia/worldInput.ts','spatial/surfaceLocalFrame.ts','persistence/time.ts'];
const productFiles=[];for(const p of fixedProductReads){const path='apps/weltraum-browser/src/'+p;if(existsSync(resolve(repo,path)))productFiles.push(bytes(repo,path));}
save(resolve(root,'ConsumerBindings.json'),{baseline,environment:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO',anchors:audit,celReadControl:'authored-diagnostic-read-v1 unchanged',modelImplementation:r.modelImplementation.modelDigest,upstreamTests:{passed:72,evidence:r.tests.evidence,checks:summary.checks},sourceBindings:r.source,compiledBindings:r.compiledRuntime,dependencyBindings:d,files:files.sort((a,b)=>a.path.localeCompare(b.path)),packageInputs,productReads:productFiles,pltWasm:'UPSTREAM_TRIVIAL_LOAD_ONLY_NOT_CONSUMED',shader:'NOT_APPLICABLE'});
console.log(JSON.stringify({status:'PASS',copiedFiles:files.length,producerSealedFiles:[92,102],compiledFiles:r.compiledInputs.length,upstreamTests:72,compilerFiles:d.nodeModules.files.length}));
