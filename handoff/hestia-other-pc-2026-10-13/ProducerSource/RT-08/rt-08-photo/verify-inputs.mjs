import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyInputs(root=process.cwd()){
 const binding=JSON.parse(await readFile(path.join(root,'input-bindings.json')));
 assert.equal(binding.gfx03VisualParity,'FAIL');assert.equal(binding.productIntegration,'NO');
 for(const ref of binding.files){assert.ok(ref.path.startsWith('inputs/')&&!ref.path.includes('..'));const p=path.join(root,ref.path);const st=await lstat(p);assert.ok(st.isFile()&&!st.isSymbolicLink());const bytes=await readFile(p);assert.equal(bytes.length,ref.byteLength);assert.equal(sha(bytes),ref.sha256,ref.path);}
 return binding;
}
if(process.argv[1]?.endsWith('verify-inputs.mjs'))console.log(`PASS ${(await verifyInputs()).files.length} use-time immutable inputs`);
