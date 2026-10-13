import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Source-only preparation. This programme was NOT_RUN in A68 after the compiler deadline.
const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'build/source-r01'),target=path.join(root,'build/esm-r01');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const regular=async p=>{try{return (await stat(p)).isFile();}catch{return false;}};
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile())files.push(p);else throw new Error('Nonregular output');}}
await walk(source);
if(files.length===0)throw new Error('Actual contained emission is missing');
await mkdir(target); // Exclusive new context: never rewrite a failed/preexisting one.
const specifiers=/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const rows=[];
for(const origin of files){
  const relative=path.relative(source,origin),dest=path.join(target,relative),bytes=await readFile(origin);
  await mkdir(path.dirname(dest),{recursive:true});let result=bytes;
  if(origin.endsWith('.js')){
    const original=bytes.toString('utf8');let text=original;const patches=[];
    for(const match of original.matchAll(specifiers)){
      const spec=match[1]??match[2];let next=spec;
      if(spec==='vitest')next=path.relative(path.dirname(dest),path.join(root,'pure/assertions.mjs')).replaceAll('\\','/');
      else if(spec.startsWith('.')){
        const resolved=path.resolve(path.dirname(origin),spec);
        if(!resolved.startsWith(source+path.sep))throw new Error('Escaping Source import: '+spec);
        if(await regular(resolved))next=spec;
        else if(await regular(resolved+'.js'))next=spec+'.js';
        else if(await regular(path.join(resolved,'index.js')))next=spec.replace(/\/$/,'')+'/index.js';
        else throw new Error('Unresolved emitted literal: '+relative+' '+spec);
      }
      if(spec==='vitest'&&!next.startsWith('.'))next='./'+next;
      let replacement=match[0].replace(spec,next);
      if(next.endsWith('.json')&&match[1]&&!/with\s*\{/.test(original.slice(match.index+match[0].length,match.index+match[0].length+40)))replacement+=' with {type:"json"}';
      if(replacement!==match[0])patches.push({at:match.index,before:match[0],after:replacement});
    }
    for(const patch of patches.reverse())text=text.slice(0,patch.at)+patch.after+text.slice(patch.at+patch.before.length);
    result=Buffer.from(text);rows.push({relative:relative.replaceAll('\\','/'),originBytes:bytes.length,originSha256:hash(bytes),copyBytes:result.length,copySha256:hash(result),changes:patches.reverse()});
  }else rows.push({relative:relative.replaceAll('\\','/'),originBytes:bytes.length,originSha256:hash(bytes),copyBytes:bytes.length,copySha256:hash(bytes),changes:[]});
  await writeFile(dest,result,{flag:'wx'});
}
await writeFile(path.join(target,'package.json'),' {"private":true,"type":"module"}\n',{flag:'wx'});
await writeFile(path.join(root,'evidence/ESM_PREPARATION.json'),JSON.stringify({rows,transformation:'REAL_EXTENSION_DIRECTORY_JSON_AND_TEST_IMPORT_REBASE_NO_CODEC_SUBSTITUTION',sourceEvaluation:0},null,2),{flag:'wx'});
console.log(JSON.stringify({sourceFiles:files.length,target,sourceEvaluation:0}));
