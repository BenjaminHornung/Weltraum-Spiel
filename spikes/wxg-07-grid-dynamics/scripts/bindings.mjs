import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
export const root=resolve(import.meta.dirname,'..');
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const load=p=>JSON.parse(readFileSync(resolve(root,p)));
export function save(p,value){const out=resolve(root,p);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(value,null,2)+'\n');}
export const binding=p=>{const b=readFileSync(resolve(root,p));return {path:p,bytes:b.length,sha256:sha(b)};};
export function walk(p){return readdirSync(resolve(root,p),{withFileTypes:true}).flatMap(e=>{const child=(p?p+'/':'')+e.name;if(e.isSymbolicLink())throw Error('SYMLINK_MEMBER:'+child);return e.isDirectory()?walk(child):[child];}).sort();}
export function verifyInputs(){const m=load('InputBindings.json');for(const f of m.files){const b=binding(f.path);if(b.bytes!==f.bytes||b.sha256!==f.sha256)throw Error('INPUT_DRIFT:'+f.path);}const expected=[...new Set(m.files.map(f=>f.path))].sort();if(JSON.stringify(walk('inputs'))!==JSON.stringify(expected))throw Error('INPUT_MEMBERSHIP');return m;}
if(process.argv[1]===resolve(import.meta.filename)){verifyInputs();console.log('PASS frozen input bytes');}
