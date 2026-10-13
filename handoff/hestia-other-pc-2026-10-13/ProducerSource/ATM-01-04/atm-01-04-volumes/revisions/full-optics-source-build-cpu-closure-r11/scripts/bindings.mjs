import {readFileSync,readdirSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
export const root=resolve(import.meta.dirname,'..'),repo=resolve(root,'../..');
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const json=p=>JSON.parse(readFileSync(resolve(root,p)));
export const save=(p,v)=>{const out=resolve(root,p);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(v,null,2)+'\n');};
export function walk(base,sub=''){return readdirSync(resolve(base,sub),{withFileTypes:true}).flatMap(f=>{
 const p=sub?sub+'/'+f.name:f.name;if(f.isSymbolicLink())throw Error('SYMLINK:'+p);
 return f.isDirectory()?walk(base,p):f.isFile()?[p]:[];}).sort();}
export const bytes=p=>{const b=readFileSync(resolve(root,p));return {path:p,bytes:b.length,sha256:hash(b)};};
export function verifyMembers(files,dirs=[]){
 const seen=new Set();
 for(const f of files){if(typeof f.path!=='string'||f.path.includes(':')||f.path.includes('\\')||f.path.split('/').some(p=>!p||p==='..'||p==='.')||seen.has(f.path)||!Number.isSafeInteger(f.bytes)||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('BINDING_INVALID');seen.add(f.path);
  let p=root;for(const s of f.path.split('/')){p=resolve(p,s);if(lstatSync(p).isSymbolicLink())throw Error('SYMLINK');}
  const actual=bytes(f.path);if(actual.bytes!==f.bytes||actual.sha256!==f.sha256)throw Error('BYTE_DRIFT:'+f.path);
 }
 for(const dir of dirs)if(JSON.stringify(walk(root,dir))!==JSON.stringify(files.filter(f=>f.path.startsWith(dir+'/')).map(f=>f.path).sort()))throw Error('MEMBERSHIP_DRIFT:'+dir);
}
export function verifyInputs(){const m=json('InputBindings.json');verifyMembers(m.files,['inputs/gfx','inputs/cel','inputs/wxg','inputs/rd','inputs/order','inputs/base']);return m;}
