import { readFileSync,readdirSync,lstatSync } from 'node:fs';
import { resolve,relative } from 'node:path';
import { root,hash,verifyFileBindings } from './bind-inputs.mjs';
export function captureTestedInputs() {
  const paths=[];
  function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile())paths.push(relative(root,p).replaceAll('\\','/'));else throw new Error('NON_REGULAR_TEST_INPUT:'+p);}}
  for(const path of ['src','scripts','tests','fixtures','snapshot','vendor'])walk(resolve(root,path));
  paths.push('SourceBindings.json','DependencyBindings.json','dependencies.lock.json','package.json','package-lock.json','tsconfig.json','.runtime/model-binding.json','.runtime/build-bindings.json');
  return paths.sort().map(localPath=>{const p=resolve(root,localPath);if(lstatSync(p).isSymbolicLink())throw new Error('TEST_INPUT_SYMLINK');const b=readFileSync(p);return {localPath,bytes:b.length,sha256:hash(b)};});
}
export function verifyRunBindings(summary,base=root) {
  if(summary.status!=='PASS'||summary.failed!==0||summary.passed<1||summary.checks?.length!==4||summary.checks.some(c=>c.exitCode!==0))throw new Error('RUN_NOT_PASS');
  if(summary.checks.map(c=>c.label).join('|')!=='tool-bytecheck|build|independent-oracle|focused-tests')throw new Error('RUN_CHECK_SET');
  const required=['src/contracts.ts','src/types.ts','src/fixtures.ts','src/model-pin.ts','fixtures/profiles.json','fixtures/schema-goldens.json','fixtures/read-goldens-input.json','SourceBindings.json','package-lock.json'];
  if(!Array.isArray(summary.testedInputs)||!Array.isArray(summary.compiledInputs)||!summary.compiledInputs.length||
    required.some(p=>!summary.testedInputs.some(f=>f.localPath===p))||!summary.compiledInputs.some(f=>f.localPath==='dist/src/types.d.ts'))throw new Error('MISSING_RUN_BYTEPROOFS');
  verifyFileBindings(base,summary.testedInputs);verifyFileBindings(base,summary.compiledInputs);
}
