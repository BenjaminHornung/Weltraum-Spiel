import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {relative} from 'node:path';
import {root,repo} from '../scripts/bindings.mjs';
import {newFilePatch,blobOid} from '../scripts/patch.mjs';
test('actual Git binary/text/empty patch creation roundtrip, no index or deletion',()=>{
 const dir=root+'/.runtime/patch-self-check/'+randomUUID();mkdirSync(dir,{recursive:true});
 const binary=Buffer.from([0,255,1,2,3,128]),text=Buffer.from('line1\r\nline2\n'),empty=Buffer.alloc(0);
 const prefix=relative(repo,dir).replaceAll('\\','/')+'/';
 const patch=newFilePatch(prefix+'sample.bin',binary)+newFilePatch(prefix+'sample.txt',text)+newFilePatch(prefix+'empty.txt',empty);writeFileSync(dir+'/input.patch',patch);
 const command=spawnSync('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe',['apply','--no-index','--binary','input.patch'],{cwd:dir,encoding:'utf8',windowsHide:true});
 assert.equal(command.status,0,command.stderr);assert.deepEqual(readFileSync(dir+'/sample.bin'),binary);assert.deepEqual(readFileSync(dir+'/sample.txt'),text);assert.deepEqual(readFileSync(dir+'/empty.txt'),empty);
 const check=spawnSync('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe',['apply','--no-index','--reverse','--check','--binary','input.patch'],{cwd:dir,encoding:'utf8',windowsHide:true});assert.equal(check.status,0,check.stderr);
 assert.equal(blobOid(empty),'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');assert.throws(()=>newFilePatch('../bad',binary),/PATH/);
});
