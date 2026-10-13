import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {root,json,check,hash,walk,member,save} from './inputs.mjs';
for(const f of json('InputBindings.json').members)check(f);
for(const f of json('SourceBindings.json').sources)check(f);
for(const f of [...json('ToolBindings.json').files,...json('ToolBindings.json').npm])check(f);
const build=json('.runtime/build-bindings.json');for(const f of [...build.files,...build.inputs,build.inputBinding])check(f);
const evidence=resolve(root,'../../.devtoolbox/specs/changes/wxg-08-2026-10-09/tests');
const dom=JSON.parse(readFileSync(resolve(evidence,'dom-r07/summary.json'))),exp=readFileSync(resolve(evidence,'dom-r07/scenario-export.json'));
assert.equal(dom.status,'PASS');assert.ok(dom.checks.every(c=>c.status==='PASS'));assert.equal(hash(exp),dom.exportDigest);
const {parseStored}=await import('../dist/src/core.js');await parseStored(exp.toString(),'HestiaAuthoring');
for(const name of ['control-geometry','build-r05','core-r03']){
 const c=JSON.parse(readFileSync(resolve(evidence,'runs',name,'command.json')));assert.equal(c.exitCode,0);
 if(name.startsWith('core'))assert.match(readFileSync(resolve(evidence,'runs',name,'stdout.log'),'utf8'),/# fail 0/);
}
const chrome='C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64';
save('BrowserBindings.json',{binaryVersion:dom.browserVersion,executablePath:dom.executablePath,files:walk(chrome).map(p=>{const b=readFileSync(p);return {path:p,bytes:b.length,sha256:hash(b)};}),proof:'OWN_LAUNCH_PERSISTENT_CONTEXT_WITH_EXPLICIT_EXECUTABLE; --disable-gpu; DOM_ONLY'});
save('.runtime/evidence-bindings.json',{files:walk(evidence).map(member),build:member(resolve(root,'.runtime/build-bindings.json')),input:member(resolve(root,'InputBindings.json')),source:member(resolve(root,'SourceBindings.json')),lock:member(resolve(root,'package-lock.json')),ownWasm:'NOT_APPLICABLE',inheritedWasm:json('InputBindings.json').members.filter(f=>f.path.endsWith('.wasm')),shader:json('InputBindings.json').members.filter(f=>/\.glsl$|\.wgsl$/.test(f.path)),ownShader:'NOT_APPLICABLE',browserTest:member(resolve(root,'tests/dom.js')),browser:member(resolve(root,'BrowserBindings.json'))});
console.log(JSON.stringify({status:'PASS',dom:dom.checks.length,exportSha256:hash(exp),browser:dom.browserVersion}));
