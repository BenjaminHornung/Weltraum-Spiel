// Narrow adaptation of the frozen producer byte bindings; no historical branch script is run.
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
export const root=resolve(import.meta.dirname,'..');
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const json=p=>JSON.parse(readFileSync(p));
export function save(path,value){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
export const bytes=(base,path)=>{const b=readFileSync(resolve(base,path));return {path,bytes:b.length,sha256:hash(b)};};
export function walk(base,sub=''){return readdirSync(resolve(base,sub),{withFileTypes:true}).flatMap(e=>{const p=sub?sub+'/'+e.name:e.name;if(e.isSymbolicLink())throw Error('SYMLINK:'+p);return e.isDirectory()?walk(base,p):[p];}).sort();}
export function verifyFiles(base,files){for(const f of files){if(f.path.includes(':')||f.path.includes('\\')||f.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('INPUT_PATH');const b=bytes(base,f.path);if(b.bytes!==f.bytes||b.sha256!==f.sha256)throw Error('BYTE_DRIFT:'+f.path);}}
export function verifyConsumer(){const m=json(resolve(root,'ConsumerBindings.json'));verifyFiles(root,m.files);if(JSON.stringify(walk(root,'vendor/cel'))!==JSON.stringify(m.files.map(f=>f.path).sort()))throw Error('VENDOR_MEMBERSHIP');return m;}
export function verifyBuild(){
 const m=json(resolve(root,'.runtime/model-binding.json')),b=json(resolve(root,'.runtime/build-bindings.json'));
 verifyFiles(root,m.inputs);verifyFiles(root,[m.config]);
 if(bytes(root,'ConsumerBindings.json').sha256!==m.consumerDigest)throw Error('MODEL_CONSUMER_DRIFT');
 if('sha256:'+hash(JSON.stringify({inputs:m.inputs,consumerDigest:m.consumerDigest,config:m.config}))!==m.modelDigest)throw Error('MODEL_BINDING_DRIFT');
 if(JSON.stringify(walk(root,'src').filter(p=>p!=='src/model-pin.ts'))!==JSON.stringify(m.inputs.map(f=>f.path)))throw Error('MODEL_MEMBERSHIP');
 if(!readFileSync(resolve(root,'src/model-pin.ts'),'utf8').includes(m.modelDigest))throw Error('MODEL_PIN_DRIFT');
 verifyFiles(root,b.files);if(JSON.stringify(walk(root,'dist'))!==JSON.stringify(b.files.map(f=>f.path)))throw Error('COMPILED_MEMBERSHIP');
 return {model:m,compiled:b};
}

