// Narrow adaptation of the frozen producer byte bindings; no historical branch script is run.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
export const root=resolve(import.meta.dirname,'..');
export const workspace=resolve(root,'../..');
export const privatePrefix=relative(workspace,root).replaceAll('\\','/');
export const normalEntry='apps/weltraum-browser/src/world-generation/';
export function normalClosure(entries=[normalEntry+'planetaryMacro.ts',normalEntry+'planetaryMacroTerrain.ts']) {
 const found=new Set(),queue=[...entries];
 while(queue.length){const p=queue.pop();if(found.has(p))continue;found.add(p);
  const text=readFileSync(resolve(workspace,p),'utf8');
  for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
   const base=resolve(dirname(resolve(workspace,p)),m[1]);
   const file=m[1].endsWith('.ts')?base:existsSync(base+'.ts')?base+'.ts':resolve(base,'index.ts');
   const target=relative(workspace,file).replaceAll('\\','/');
   if(!target.startsWith('apps/weltraum-browser/src/')||/(rapier|renderer|hestia-prototype|worker|node_modules)/i.test(target))throw Error('NORMAL_IMPORT_SCOPE:'+target);
   readFileSync(resolve(workspace,target));queue.push(target);
  }
 }
 return [...found].sort();
}
export const actualSourcePaths=()=>[...walk(root,'src').filter(p=>p!=='src/model-pin.ts').map(p=>privatePrefix+'/'+p),
 ...normalClosure([...normalClosure(),normalEntry+'hestia/index.ts', 'apps/weltraum-browser/src/celestial/starterSystem.ts'])].sort();
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const json=p=>JSON.parse(readFileSync(p));
export function save(path,value){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
export const bytes=(base,path)=>{const b=readFileSync(resolve(base,path));return {path,bytes:b.length,sha256:hash(b)};};
export function walk(base,sub=''){return readdirSync(resolve(base,sub),{withFileTypes:true}).flatMap(e=>{const p=sub?sub+'/'+e.name:e.name;if(e.isSymbolicLink())throw Error('SYMLINK:'+p);return e.isDirectory()?walk(base,p):[p];}).sort();}
export function verifyFiles(base,files){for(const f of files){if(f.path.includes(':')||f.path.includes('\\')||f.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('INPUT_PATH');const b=bytes(base,f.path);if(b.bytes!==f.bytes||b.sha256!==f.sha256)throw Error('BYTE_DRIFT:'+f.path);}}
export function verifyConsumer(){const m=json(resolve(root,'ConsumerBindings.json'));verifyFiles(root,m.files);if(m.privateSourceInputs)verifyFiles(root,m.privateSourceInputs);if(m.privateBuildInputs)verifyFiles(root,m.privateBuildInputs);if(m.normalSourceInputs)verifyFiles(workspace,m.normalSourceInputs);if(JSON.stringify(walk(root,'vendor/cel'))!==JSON.stringify(m.files.map(f=>f.path).sort()))throw Error('VENDOR_MEMBERSHIP');return m;}
export function verifyBuild(){
 const normal=json(resolve(root,'.runtime/normal-model-binding.json'));
 verifyFiles(workspace,normal.inputs);verifyFiles(workspace,[normal.pin]);
 if('sha256:'+hash(JSON.stringify({inputs:normal.inputs}))!==normal.modelDigest)throw Error('NORMAL_MODEL_BINDING_DRIFT');
 if(JSON.stringify(normalClosure().filter(p=>p!==normal.excludedPin))!==JSON.stringify(normal.inputs.map(f=>f.path)))throw Error('NORMAL_MODEL_MEMBERSHIP');
 if(!readFileSync(resolve(workspace,normal.excludedPin),'utf8').includes(normal.modelDigest))throw Error('NORMAL_MODEL_PIN_DRIFT');
 const m=json(resolve(root,'.runtime/model-binding.json')),b=json(resolve(root,'.runtime/build-bindings.json'));
 verifyFiles(workspace,m.inputs);verifyFiles(workspace,[m.config]);
 if(bytes(root,'ConsumerBindings.json').sha256!==m.consumerDigest)throw Error('MODEL_CONSUMER_DRIFT');
 if('sha256:'+hash(JSON.stringify({inputs:m.inputs,consumerDigest:m.consumerDigest,config:m.config}))!==m.modelDigest)throw Error('MODEL_BINDING_DRIFT');
 if(JSON.stringify(actualSourcePaths())!==JSON.stringify(m.inputs.map(f=>f.path)))throw Error('MODEL_MEMBERSHIP');
 if(!readFileSync(resolve(root,'src/model-pin.ts'),'utf8').includes(m.modelDigest))throw Error('MODEL_PIN_DRIFT');
 verifyFiles(root,b.files);if(JSON.stringify(walk(root,'dist'))!==JSON.stringify(b.files.map(f=>f.path)))throw Error('COMPILED_MEMBERSHIP');
 return {model:m,compiled:b};
}

