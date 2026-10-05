import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),[name,...inputs]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
if(!name||!/^[a-z0-9-]+$/.test(name)||!inputs.length)throw Error('Fresh bounded name and explicit file/directory inputs required');
const output=path.resolve(root,'.resume-runs/review-snapshots',name);
if(fs.existsSync(output))throw Error('Cannot overwrite prior review evidence');
const selected=new Set();
function collect(input){const absolute=path.resolve(root,input),relative=path.relative(root,absolute).replaceAll('\\','/');
 if(!relative||relative.startsWith('../')||path.isAbsolute(relative)||relative.split('/').some(p=>['.git','node_modules','dist'].includes(p))||relative.startsWith('.resume-runs/review-snapshots/'))throw Error('Input outside explicit lab evidence/source scope');
 const stat=fs.lstatSync(absolute);if(stat.isSymbolicLink())throw Error('Review source symlink rejected');
 if(stat.isDirectory()){for(const file of fs.readdirSync(absolute).sort())collect(path.join(relative,file));}
 else if(stat.isFile())selected.add(relative);else throw Error('Unsupported review input');
}
inputs.forEach(collect);const files=[];
for(const relative of [...selected].sort()){const bytes=fs.readFileSync(path.join(root,relative)),target=path.join(output,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});files.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});}
const manifest={schema:'hestia-rd-review-seal-v1',resumeBase:'16a5d29a5cddea372abae139da618aa000a058be',productRead:'b3c6523a94cd050f5a9a22dc27f4777fcc03363e',sourceRoot:root,name,files},bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(output,'manifest.json'),bytes,{flag:'wx'});console.log(JSON.stringify({output,files:files.length,manifestSha256:sha(bytes)}));
