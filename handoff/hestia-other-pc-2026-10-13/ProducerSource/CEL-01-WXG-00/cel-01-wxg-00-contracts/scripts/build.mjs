import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, repo, baseline, git, verifyLocal, verifyProducer, hash } from './bind-inputs.mjs';
if(process.versions.node!=='22.23.2')throw new Error('NODE_PIN_MISMATCH');
if(git(['rev-parse','HEAD']).toString().trim()!==baseline)throw new Error('BASELINE_CHANGED');
const sourceBindings=verifyLocal(); verifyProducer();
const modelInputs=['src/contracts.ts','src/types.ts',...sourceBindings.files.map(f=>f.localPath)].sort().map(path=>{
  const b=readFileSync(resolve(root,path));return {path,bytes:b.length,sha256:hash(b)};
});
const modelDigest='sha256:'+hash(JSON.stringify(modelInputs));
mkdirSync(resolve(root,'src'),{recursive:true});
writeFileSync(resolve(root,'src/model-pin.ts'),`// Generated from the closed source inputs by scripts/build.mjs.\nexport const IMPLEMENTATION_DIGEST = '${modelDigest}' as const;\n`);
mkdirSync(resolve(root,'.runtime'),{recursive:true});
writeFileSync(resolve(root,'.runtime/model-binding.json'),JSON.stringify({modelDigest,modelInputs,excluded:'Generated model-pin.ts avoids self-reference; itself covered by final dirty-tree seal.'},null,2)+'\n');
const pkg=JSON.parse(readFileSync(resolve(root,'node_modules/typescript/package.json')));
if(pkg.version!=='7.0.2')throw new Error('TYPESCRIPT_PIN_MISMATCH');
const result=spawnSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json','--singleThreaded'],{cwd:root,windowsHide:true,encoding:'utf8'});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
if(result.status!==0)process.exit(result.status??1);
const files=[];
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.js')||e.name.endsWith('.d.ts')){
  if(e.name.endsWith('.js')){
    const text=readFileSync(p,'utf8').replace(/(from\s*|import\s*)['"](\.[^'"]+)['"]/g,(whole,prefix,path)=>`${prefix}'${/\.(m?js)$/.test(path)?path:path+'.js'}'`);
    writeFileSync(p,text);
  }
  const b=readFileSync(p);files.push({path:p.slice(root.length).replaceAll('\\','/'),bytes:b.length,sha256:hash(b)});
}}}
walk(resolve(root,'dist'));
mkdirSync(resolve(root,'dist/vendor/plt/src'),{recursive:true});cpSync(resolve(root,'vendor/plt/src/numerics.mjs'),resolve(root,'dist/vendor/plt/src/numerics.mjs'));
files.push({path:'dist/vendor/plt/src/numerics.mjs',bytes:readFileSync(resolve(root,'dist/vendor/plt/src/numerics.mjs')).length,sha256:hash(readFileSync(resolve(root,'dist/vendor/plt/src/numerics.mjs')))});
mkdirSync(resolve(root,'.runtime'),{recursive:true});writeFileSync(resolve(root,'.runtime/build-bindings.json'),JSON.stringify({status:'PASS',typescript:pkg.version,node:process.versions.node,files},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',typecheck:'PASS',runtimeModules:files.filter(f=>!f.path.endsWith('.d.ts')).length,declarations:files.filter(f=>f.path.endsWith('.d.ts')).length,modelDigest,productBuild:'NOT_RUN'}));
