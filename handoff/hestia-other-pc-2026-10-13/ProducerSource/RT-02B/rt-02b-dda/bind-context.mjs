import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spike,sha} from './inputs.mjs';
const management='C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09',pack=path.join(management,'Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09');
const mb=await readFile(path.join(pack,'PACKAGE_MANIFEST.json')),m=JSON.parse(mb),files=[];
assert.equal(Object.keys(m.files).length,66);for(const [name,ref] of Object.entries(m.files)){
 assert.ok(!path.isAbsolute(name)&&!name.split('/').includes('..'));const b=await readFile(path.join(pack,name));assert.equal(b.length,ref.bytes);assert.equal(sha(b),ref.sha256);files.push({path:name,byteLength:b.length,sha256:sha(b)});}
const consulted=['00_START_HIER.md','01_PRUEFUNG_UND_ENTSCHEIDUNG.md','03_SCHNITTSTELLEN_UND_UEBERNAHME.md','Cloud/00_GEMEINSAMER_VERTRAG.md','Auftraege/RT-02B.md','Goals/RT-02B.txt','Quellen/threejs-raytracing-intel-amd-nvidia-2026-10-09.md','Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md'];
const stateBytes=await readFile(path.join(management,'STATE.json')),state=JSON.parse(stateBytes),t=state.tasks.find(t=>t.id==='RT-02B');
assert.equal(t.sessionId,process.env.CODEX_THREAD_ID);assert.equal(t.model,'gpt-6.1-sol');assert.equal(t.effort,'ultra');assert.equal(state.capacity.limit,6);
const override=await readFile(path.join(management,'USER_OVERRIDES_2026-10-09.md'));
const result={schema:'hestia.rt02b.source-context.v1',packageManifestSha256:sha(mb),packageFilesVerified:66,consultedSources:files.filter(f=>consulted.includes(f.path)),originalZipSha256:'0136d515ce6c86e3110bfb7fb91e1ccf1ceb8536cbef56dad9b4d6e4a6dd3d4d',
 overrides:{path:'USER_OVERRIDES_2026-10-09.md',byteLength:override.length,sha256:sha(override)},stateSnapshot:{path:'STATE.json',byteLength:stateBytes.length,sha256:sha(stateBytes),mainOwner:{nativeId:t.sessionId,paseoAgentId:t.paseoAgentId,model:t.model,effort:t.effort,worktree:t.worktree},capacity:6,a0Native:state.a0.activeIntegratorNativeId,a0Agent:state.a0.activeIntegratorAgentId,hardwareSlot:'NOT_GRANTED'},
 note:'Original package verified read-only; cloud instructions superseded by direct local user update. STATE is a moving management snapshot, not a producer import or runtime authority.'};
await writeFile(path.resolve(spike,'../../.devtoolbox/specs/changes/rt-02b-2026-10-09/tests/source-context.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',packageFiles:66,nativeId:t.sessionId,model:t.model,effort:t.effort,capacity:6}));
