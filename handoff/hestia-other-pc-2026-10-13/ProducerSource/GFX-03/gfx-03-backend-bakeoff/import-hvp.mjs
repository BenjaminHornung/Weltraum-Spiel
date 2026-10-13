import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const spike=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(spike,'../..');
const git='C:\\IFI_SourceCode\\Utils\\opencode-migration\\runtime\\git\\cmd\\git.exe';
const base='17b1db4201a28e7b607c30707bdc2b75e3484a10',rd='04902cef0b3b7129a6069bf945f39f22e414b6f9';
const rdRoot='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-RD-followup-ebb913d-2026-10-07';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources=[
  [base,'apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts','hvp/visualEffects.ts','a2e02243c1ee237e7313708743912829dd24759871594954be783ffaa64c944d'],
  [base,'apps/weltraum-browser/tests/unit/hvp-visual-effects.test.ts','hvp/hvp-visual-effects.test.ts','caabd26558c19be971e148ea29a7110cf016727a77c830981eeb3373b226a1de'],
  ...['src/experiments/three-control/index.ts','src/experiments/three-webgpu/index.ts','src/experiments/three-webgpu/projection.ts',
    'src/experiments/material-light/index.ts','src/experiments/foliage-wind/index.ts','reports/codex-resume-2026-10-05/oracle-v2.ts','RESULTS.md'].map(p=>[rd,`experiments/hestia-rd-2026-10-02/${p}`,`historical/${p}`,null])
];
const records=[];
for(const [commit,source,target,pin] of sources){const repository=commit===rd?rdRoot:root;
  const bytes=execFileSync(git,['-C',repository,'show',`${commit}:${source}`],{maxBuffer:8*1024*1024});
  if(pin&&sha(bytes)!==pin)throw new Error(`Fixed-base source drift ${source}`);
  const destination=path.join(spike,'imported',target);await mkdir(path.dirname(destination),{recursive:true});
  try{const prior=await readFile(destination);if(!prior.equals(bytes))throw new Error(`Existing imported bytes differ: ${target}`);}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(destination,bytes,{flag:'wx'});}
  records.push({commit,sourceRepository:commit===rd?'historical-isolated-rd-repository':'fixed-base-product-repository',sourcePath:source,targetPath:`imported/${target}`,byteLength:bytes.length,sha256:sha(bytes),modified:false});
}
const manifest={schema:'hestia.gfx03.source-import.v1',baseCommit:base,rdCommit:rd,records,
  adapterChanges:[{target:'src/materials.ts',source:'hvp/visualEffects.ts',reason:'Bounded shader formulas/sky tile extracted; TSL equivalent; explicit vertex AO and RD14 wetness added; single HDR output'},
    {target:'src/port.ts',source:'historical/src/experiments/foliage-wind/index.ts',reason:'Same stable cluster/tick/owner-local wind formula; small explicit-input port with validation; no world authority'},
    {target:'src/main.ts',source:'historical/src/experiments/three-webgpu/index.ts',reason:'One renderer at a time; actual backend admission, single demand loop, own disposal; no imported engine tree'}],
  historicalImageEvidence:'External videos/concept images/run-sink screenshot bytes NOT_VERIFIED; no historical image reference acceptance'};
const destination=path.join(spike,'imported/source-manifest.json');const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
try{if(!(await readFile(destination)).equals(bytes))throw new Error('Source import manifest drift');}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(destination,bytes,{flag:'wx'});}
console.log(`PASS ${records.length} source snapshots at fixed Git objects`);
