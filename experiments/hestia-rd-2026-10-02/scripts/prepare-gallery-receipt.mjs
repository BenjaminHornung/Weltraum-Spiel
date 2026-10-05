import fs from'node:fs';
import path from'node:path';
import{createHash}from'node:crypto';
import{execFileSync}from'node:child_process';
import{canonicalJson}from'../src/contracts/validation.ts';
import{assertPortFree}from'./verify-boundary.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),root=process.cwd(),git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe',output='.resume-runs/gallery-resume-admission.json';
if(fs.existsSync(output))throw Error('Preserve earlier gallery receipt');
await assertPortFree();
const paths=[];for(const dir of['src/contracts','src/runner','src/experiments/three-control','src/experiments/three-webgpu','src/tools/variant-gallery'])for(const file of fs.readdirSync(dir))if(/\.ts$/.test(file)||(dir.endsWith('variant-gallery')&&(/\.css$/.test(file)||file==='index.html')))paths.push(dir+'/'+file);
paths.push('src/registration.ts','package-lock.json','reference-cards/index.json','reference-cards/concepts.json');const files=[...new Set(paths)].sort().map(p=>({path:p,sha256:sha(fs.readFileSync(p))}));
const old=JSON.parse(fs.readFileSync('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/32e88a34f417ae4f92fa7ed278e772846928eaf5.json'));
function walk(dir,prefix=''){return fs.readdirSync(dir).sort().flatMap(n=>{const p=path.join(dir,n);return fs.statSync(p).isDirectory()?walk(p,prefix+n+'/'):[{path:prefix+n,sha256:sha(fs.readFileSync(p))}];});}
const build=walk('dist'),receipt={phase:'RD40-PHASE2',productIntegrated:false,entryWired:true,port5280Released:true,sourceCommit:execFileSync(git,['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceTree:execFileSync(git,['rev-parse','HEAD^{tree}'],{encoding:'utf8',windowsHide:true}).trim(),sourceState:'UNCOMMITTED_HASH_BOUND',sourceBytesDigest:sha(canonicalJson(files)),files,buildDigest:sha(canonicalJson(build)),buildRoot:path.join(root,'dist'),entrySha256:sha(fs.readFileSync('dist/src/tools/variant-gallery/index.html')),shared18:old.frozenFiles.map(r=>({path:r.path,sha256:sha(fs.readFileSync(r.path))})),note:'Git commit/tree are the execution anchor, not the changed-byte identity; current source/build hashes above and the execution receipt bind the actual run.'};
fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({path:path.resolve(output),sha256:sha(fs.readFileSync(output)),sourceBytesDigest:receipt.sourceBytesDigest}));
