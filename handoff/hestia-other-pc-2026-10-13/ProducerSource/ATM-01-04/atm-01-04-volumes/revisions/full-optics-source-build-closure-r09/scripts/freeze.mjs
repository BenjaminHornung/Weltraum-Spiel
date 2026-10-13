import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,copyFileSync,lstatSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),home='C:/IFI_SourceCode/Temp/WeltraumSpiel';
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=[],anchors=[];
function copy(src,dst,expected){
 const bytes=readFileSync(src),sha256=hash(bytes);
 if(expected&&(sha256!==expected.sha256||bytes.length!==(expected.bytes??expected.byteLength)))throw Error('UPSTREAM_DRIFT:'+src);
 const out=resolve(root,dst);if(!out.startsWith(root+'/')&&!out.startsWith(root+'\\'))throw Error('SCOPE');
 mkdirSync(dirname(out),{recursive:true});
 if(existsSync(out)&&hash(readFileSync(out))!==sha256)throw Error('OWN_WIP_CONFLICT:'+dst);
 copyFileSync(src,out);files.push({path:dst,bytes:bytes.length,sha256,producerPath:src});
 return bytes;
}
function tree(src,dst){for(const f of readdirSync(src,{withFileTypes:true})){if(f.isSymbolicLink())throw Error('SYMLINK');if(f.isDirectory())tree(resolve(src,f.name),dst+'/'+f.name);else if(f.isFile())copy(resolve(src,f.name),dst+'/'+f.name);}}
function anchor(base,path,dst,bytes,sha256){copy(resolve(base,path),dst,{bytes,sha256});anchors.push({producerPath:resolve(base,path),path:dst,bytes,sha256});}
const gfx=home+'/.worktrees/Hestia-Spike-GFX-03-2026-10-09/spikes/gfx-03-backend-bakeoff';
anchor(gfx,'receipt.json','inputs/gfx/receipt.json',16521,'19cb90aa136ff917f35318fce26d76ca359ed802782ceae5f5508780cfb9f01e');
anchor(gfx,'binding-manifest.json','inputs/gfx/binding-manifest.json',950615,'b00e1d955341aad056dc4ea6cbbe147949c96af600f5bbd304313d82b0ff9386');
const gm=JSON.parse(readFileSync(resolve(gfx,'binding-manifest.json')));
for(const f of gm.files.filter(f=>/spikes\/gfx-03-backend-bakeoff\/(src\/(materials|port)\.ts|imported\/rt01\/fixtures\/|package(-lock)?\.json|README\.md|REPORT\.md|HANDOFF\.md)/.test(f.path))){
 const p=f.path.replace('spikes/gfx-03-backend-bakeoff/','');copy(resolve(gfx,p),'inputs/gfx/'+p,f);
}
const wx=home+'/.worktrees/Hestia-Spike-WXG-01-04-2026-10-09/spikes/wxg-01-04-analytic',wxDst='inputs/wxg/repo/spikes/wxg-01-04-analytic';
anchor(wx,'receipt.json',wxDst+'/receipt.json',83288,'1bc3442c6d068ed42b207857949dd168f3e7f6da64d0842b99228df4608c7106');
anchor(wx,'.runtime/final-seal/scope-seal.json',wxDst+'/.runtime/final-seal/scope-seal.json',31984,'03a072879c1d06484d3e8aec78883e8de3dcbef82866fa6722c056612055161e');
const wr=JSON.parse(readFileSync(resolve(wx,'receipt.json')));
for(const f of [...wr.files,...JSON.parse(readFileSync(resolve(wx,'ConsumerBindings.json'))).files])copy(resolve(wx,f.path),wxDst+'/'+f.path,f);
for(const d of ['src','scripts','fixtures','snapshot','vendor','node_modules','dist'])tree(resolve(wx,d),wxDst+'/'+d);
for(const f of ['ConsumerBindings.json','SourceBindings.json','package.json','package-lock.json','tsconfig.json','.runtime/model-binding.json','.runtime/build-bindings.json','HANDOFF.md','REPORT.md'])copy(resolve(wx,f),wxDst+'/'+f);
const run=wr.tests.summaryRepoPath,runDir=dirname(run),wrRepo=resolve(wx,'../..');
tree(resolve(wrRepo,runDir),'inputs/wxg/repo/'+runDir);
const cel=home+'/.worktrees/Hestia-Spike-CEL-01-WXG-00-2026-10-09/spikes/cel-01-wxg-00-contracts';
anchor(cel,'receipt.json','inputs/cel/receipt.json',72216,'3b255ee3e75a272823aa01c734e14baa1157c663625c91254fd6101b6332c67c');
anchor(cel,'.runtime/final-seal/scope-seal.json','inputs/cel/scope-seal.json',20200,'c5796096462abb45e99740cb7e74620e0f5df46d64691ae631512403c603a0d2');
for(const p of ['src/types.ts','src/contracts.ts','src/model-pin.ts','fixtures/profiles.json','SourceBindings.json','DependencyBindings.json','HANDOFF.md','REPORT.md'])copy(resolve(cel,p),'inputs/cel/'+p);
const rd=home+'/.worktrees/Hestia-RD-followup-ebb913d-2026-10-07/experiments/hestia-rd-2026-10-02';
const seen=new Set();
function module(p){
 if(seen.has(p))return;seen.add(p);
 const src=resolve(rd,p);if(!src.startsWith(resolve(rd)))throw Error('RD_OUTSIDE:'+p);
 const b=copy(src,'inputs/rd/'+p);
 if(p.endsWith('.ts'))for(const m of b.toString().matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
  let target=resolve(dirname(src),m[1].split('?')[0]);
  if(existsSync(target)&&lstatSync(target).isDirectory())target=resolve(target,'index.ts');
  if(!existsSync(target)){if(existsSync(target+'.ts'))target+='.ts';else throw Error('RD_IMPORT:'+target);}
  module(relative(rd,target).replaceAll('\\','/'));
 }
}
for(const d of ['rain','rain-shield','foliage-wind','wet-surface','three-control'])module('src/experiments/'+d+'/index.ts');
tree(resolve(rd,'fixtures/F00-CONTROL'),'inputs/rd/fixtures/F00-CONTROL');
copy(resolve(rd,'package.json'),'inputs/rd/package.json');
const pkg=home+'/artifacts/hestia-cloud-orchestration-2026-10-09/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09';
for(const p of ['00_START_HIER.md','01_PRUEFUNG_UND_ENTSCHEIDUNG.md','03_SCHNITTSTELLEN_UND_UEBERNAHME.md','Cloud/00_GEMEINSAMER_VERTRAG.md','Auftraege/ATM-01-04.md','Goals/ATM-01-04.txt','SOURCE_DOCS.json',...['hestia-dynamisches-volumetrisches-wetter-architekturkonzept-2026-10-09.md','weltraum-universeller-planeten-wetter-climate-core-architektur-v2-2026-10-09.md','hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md'].map(x=>'Quellen/'+x)])copy(resolve(pkg,p),'inputs/order/'+p);
for(const p of ['AGENTS.md','apps/weltraum-browser/src/persistence/time.ts','docs/design-audits/2026-07-14-hestia-surface-lab-visual-target.md'])copy(resolve(root,'../..',p),'inputs/base/'+p);
copy(home+'/artifacts/hestia-cloud-orchestration-2026-10-09/USER_OVERRIDES_2026-10-09.md','inputs/order/USER_OVERRIDES_2026-10-09.md');
writeFileSync(resolve(root,'InputBindings.json'),JSON.stringify({baseCommit:'17b1db4201a28e7b607c30707bdc2b75e3484a10',anchors,files:[...new Map(files.map(f=>[f.path,f])).values()].sort((a,b)=>a.path.localeCompare(b.path)),originalZipSha256:'0136d515ce6c86e3110bfb7fb91e1ccf1ceb8536cbef56dad9b4d6e4a6dd3d4d',environment:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO'},null,2)+'\n');
console.log(JSON.stringify({status:'FROZEN',members:files.length,anchors:anchors.length}));
