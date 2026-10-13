import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spike,sha} from './inputs.mjs';
const root=path.resolve(spike,'../..'),prefix='spikes/rt-02b-dda/',spec='.devtoolbox/specs/changes/rt-02b-2026-10-09/';
const gitExe='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const git=args=>execFileSync(gitExe,['-C',root,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
assert.equal(git(['rev-parse','HEAD']).trim(),'17b1db4201a28e7b607c30707bdc2b75e3484a10');
const excluded=new Map([['receipt.json','Final byte seal envelope reviewed as exact actual receipt alongside this patch'],['binding-manifest.json','Self-referential final full byte inventory reviewed alongside this patch'],['review.patch','Derived patch cannot include itself'],['review-manifest.json','Derived patch membership cannot include itself']].map(([n,why])=>[prefix+n,why]));
const rows=git(['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean),files=[],patches=[];
for(const row of rows){const name=row.slice(3),state=row.slice(0,2);assert.ok(name.startsWith(prefix)||name.startsWith(spec),'Out-of-scope dirty path');assert.ok(!/[DRCU!]/.test(state));if(excluded.has(name))continue;
 const b=await readFile(path.join(root,name));files.push({path:name,gitState:state,byteLength:b.length,sha256:sha(b)});
 if(state==='??'){try{patches.push(git(['diff','--no-index','--binary','--','/dev/null',name]));}catch(e){assert.equal(e.status,1,'git diff expected difference, not failure');patches.push(e.stdout);}}
 else patches.push(git(['diff','--binary','17b1db4201a28e7b607c30707bdc2b75e3484a10','--',name]));
}
const patch=Buffer.from(patches.join(''));await writeFile(path.join(spike,'review.patch'),patch,{flag:'wx'});
await writeFile(path.join(spike,'review-manifest.json'),JSON.stringify({schema:'hestia.rt02b.review-diff.v1',baseCommit:'17b1db4201a28e7b607c30707bdc2b75e3484a10',files:files.sort((a,b)=>a.path.localeCompare(b.path)),patch:{path:prefix+'review.patch',byteLength:patch.length,sha256:sha(patch)},excluded:[...excluded].map(([path,reason])=>({path,reason})),ignoredBuildDependenciesAndRawEvidence:'Complete exact bytes in binding-manifest.json; inspect actual receipt/seal alongside patch. No human approval claimed.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',files:files.length,patchBytes:patch.length,patchSha256:sha(patch)}));
