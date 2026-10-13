import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(path.basename(root),'Hestia-CutV3-Resume-2026-10-05');
const stage=process.argv[2];assert(['control-r01','candidate-r01'].includes(stage));
const spec='.devtoolbox/specs/changes/hestia-upscaling-s1-g01-2026-10-09';
const capsule=`${spec}/frozen/${stage}`,manifestPath=path.join(root,capsule,'INPUT.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const walk=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>{
  const next=`${relative}/${entry.name}`;
  assert(!entry.isSymbolicLink(),`Do not follow links: ${next}`);
  return entry.isDirectory()?walk(next):[next];
}).sort();
const inside=relative=>{const absolute=path.resolve(root,relative);assert(absolute.startsWith(root+path.sep),relative);return absolute;};

if(process.argv[3]==='--verify'){
  const input=JSON.parse(readFileSync(manifestPath));
  for(const section of Object.values(input.inventories)){
    for(const row of section.rows){const bytes=readFileSync(inside(row.snapshot));assert.equal(bytes.length,row.bytes,row.snapshot);assert.equal(hash(bytes),row.sha256,row.snapshot);}
    assert.equal(hash(JSON.stringify(section.rows)),section.sha256);
  }
  const actual=walk(`${capsule}/snapshot`);
  const expected=Object.values(input.inventories).flatMap(section=>section.rows.map(row=>row.snapshot)).sort();
  assert.deepEqual(actual,expected,'Frozen inventory membership');
  console.log(JSON.stringify({stage,result:'BOUND_STAGE_INPUT_ONLY',inputSha256:hash(readFileSync(manifestPath)),counts:Object.fromEntries(Object.entries(input.inventories).map(([k,v])=>[k,v.rows.length])),movingWipAcceptance:false}));
  process.exit(0);
}

assert.equal(process.argv.length,3,'Freeze once or --verify; no implicit live consumption');
assert(!existsSync(path.join(root,capsule)),'Preserve every earlier freeze');
const state=JSON.parse(readFileSync(path.resolve(root,'../../artifacts/hestia-cloud-orchestration-2026-10-09/STATE.json')));
assert.equal(state.a0.activeIntegratorNativeId,'01a120eb-c6c5-7b40-bb95-cdf703ecb5c3');
assert.equal(state.a0.activeIntegratorAgentId,'37dddeb2-1688-47cc-af00-b03edd394215');
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const gitRead=args=>execFileSync(git,args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const head=gitRead(['rev-parse','HEAD']),branch=gitRead(['branch','--show-current']);
assert.equal(head,'17b1db4201a28e7b607c30707bdc2b75e3484a10');
assert.equal(branch,'feature/hestia-destruction-program-2026-10-07');
const app='apps/weltraum-browser',packageJson=JSON.parse(readFileSync(path.join(root,app,'package.json')));
assert.equal(packageJson.dependencies['@dimforge/rapier3d-compat'],'0.12.0','No unreceived physics integration');
assert.equal(packageJson.dependencies.three,stage==='control-r01'?'0.185.1':'0.186.1');
assert.equal(packageJson.devDependencies['@types/three'],stage==='control-r01'?'0.185.1':'0.186.0');
assert.equal(packageJson.dependencies['@pmndrs/upscaler'],stage==='control-r01'?undefined:'0.5.0');
const excludedDependencies=[`${app}/node_modules/.a0-g01-npm-cache`,`${app}/node_modules/.vite`,`${app}/node_modules/.vite-temp`];
const dependencies=()=>walk(`${app}/node_modules`).filter(p=>!excludedDependencies.some(prefix=>p===prefix||p.startsWith(prefix+'/')));
assert(!dependencies().some(p=>p.endsWith('/.npmrc')),'Do not snapshot credential/config files');
const selected=()=>({
  source:[...walk(`${app}/src`),...walk(`${app}/public`),...['index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','playwright.config.ts'].map(p=>`${app}/${p}`)].sort(),
  tests:walk(`${app}/tests`),
  dependencies:dependencies(),
  build:walk(`${app}/evidence/hestia-g01-${stage}`),
  commands:walk(`${spec}/tests/${stage}`),
  helper:['tools/freeze-g01-stage.mjs']
});
const initial=selected();
const index=gitRead(['ls-files','--stage','--',app]);
const dirty=gitRead(['status','--porcelain=v1','--untracked-files=no','--',app]);
const inventories={};
for(const [section,files] of Object.entries(initial)){
  assert.equal(new Set(files).size,files.length,section);
  const rows=files.map(relative=>{
    const bytes=readFileSync(inside(relative)),snapshot=`${capsule}/snapshot/${section}/${relative}`;
    mkdirSync(path.dirname(inside(snapshot)),{recursive:true});copyFileSync(inside(relative),inside(snapshot));
    assert.equal(hash(readFileSync(inside(snapshot))),hash(bytes),snapshot);
    return {path:relative,bytes:bytes.length,sha256:hash(bytes),snapshot};
  });
  inventories[section]={rows,sha256:hash(JSON.stringify(rows))};
}
assert.deepEqual(selected(),initial,'Live inventory membership changed during freeze');
for(const section of Object.values(inventories))for(const row of section.rows)assert.equal(hash(readFileSync(inside(row.path))),row.sha256,`Foreign/live write during freeze: ${row.path}`);
assert.equal(gitRead(['rev-parse','HEAD']),head);
assert.equal(gitRead(['branch','--show-current']),branch);
assert.equal(gitRead(['ls-files','--stage','--',app]),index);
assert.equal(gitRead(['status','--porcelain=v1','--untracked-files=no','--',app]),dirty);
const tools=['C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe',git,
  'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js',
  path.join(root,app,'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe')].map(p=>{const bytes=readFileSync(p);return {path:p,bytes:bytes.length,sha256:hash(bytes)};});
const input={schema:'hestia.a0.g01.bound-stage.v1',classification:'FROZEN_CODE_BUILD_CONTROL_OR_CANDIDATE_ONLY',stage,at:new Date().toISOString(),head,branch,
  inventories,index:{text:index,sha256:hash(index)},trackedDirty:{text:dirty,sha256:hash(dirty)},excludedDependencies,tools,packageJson,
  gpuBrowserNetwork:'NOT_RUN',privateThreeHandles:'NOT_QUALIFIED',strictTypes:'SEE_ACTUAL_COMMAND_RECEIPTS',productAcceptance:false,g01Complete:false};
writeFileSync(manifestPath,JSON.stringify(input,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stage,inputSha256:hash(readFileSync(manifestPath)),counts:Object.fromEntries(Object.entries(inventories).map(([k,v])=>[k,v.rows.length])),productAcceptance:false}));
