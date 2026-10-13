import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(path.basename(root),'Hestia-CutV3-Resume-2026-10-05');
const stage=process.argv[2];assert.equal(stage,'lab-replacement-r01');
const spec='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-replacement-r01';
const capsule=`${spec}/frozen/${stage}`,manifestPath=path.join(root,capsule,'INPUT.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const walk=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>{
  const next=`${relative}/${entry.name}`;
  if(next.includes('/node_modules/.a0-g01-npm-cache')||next.includes('/node_modules/.vite')||next.endsWith('/node_modules/@hestia/rapier3d-phy01-candidate'))return [];
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
const gitRead=args=>execFileSync(git,['--no-optional-locks',...args],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const head=gitRead(['rev-parse','HEAD']),branch=gitRead(['branch','--show-current']);
assert.equal(head,'17b1db4201a28e7b607c30707bdc2b75e3484a10');
assert.equal(branch,'feature/hestia-destruction-program-2026-10-07');
const app='apps/weltraum-browser',packageJson=JSON.parse(readFileSync(path.join(root,app,'package.json')));
assert.equal(packageJson.dependencies['@dimforge/rapier3d-compat'],undefined);
assert.equal(packageJson.dependencies['@hestia/rapier3d-phy01-candidate'],'file:vendor/rapier-phy01-migration2');
assert.equal(packageJson.dependencies.three,'0.186.1');
assert.equal(packageJson.devDependencies['@types/three'],'0.186.0');
assert.equal(packageJson.dependencies['@pmndrs/upscaler'],'0.5.0');
const installedLocalDependency=()=>realpathSync(path.join(root,app,'node_modules/@hestia/rapier3d-phy01-candidate'));
const localTarget=realpathSync(path.join(root,app,'vendor/rapier-phy01-migration2'));
assert.equal(installedLocalDependency(),localTarget,'Local dependency must resolve to the exact owned vendor');
const excludedDependencies=[`${app}/node_modules/.a0-g01-npm-cache`,`${app}/node_modules/.vite`,`${app}/node_modules/.vite-temp`];
const dependencies=()=>walk(`${app}/node_modules`).filter(p=>!excludedDependencies.some(prefix=>p===prefix||p.startsWith(prefix+'/')));
assert(!dependencies().some(p=>p.endsWith('/.npmrc')),'Do not snapshot credential/config files');
const selected=()=>({
  source:[...walk(`${app}/src`),...walk(`${app}/public`),...['index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','playwright.config.ts'].map(p=>`${app}/${p}`)].sort(),
  tests:walk(`${app}/tests`),
  vendor:walk(`${app}/vendor/rapier-phy01-migration2`),
  dependencies:dependencies(),
  build:walk(`${app}/evidence/hestia-phy01-lab-replacement-r01`),
  commands:[...walk(`${spec}/commands`),`${spec}/SCOPE_BINDINGS.json`].sort(),
  helper:['tools/freeze-phy01-lab-replacement-stage.mjs','.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-lab-replacement-checks.mjs',...['PHY01_LAB_REPLACEMENT_SCOPE_R01.md','PHY01_LAB_REPLACEMENT_BEFORE_R01.json','PHY01_LAB_REPLACEMENT_TEST_HANDOFF_R01.md','PHY01_LAB_REPLACEMENT_TEST_REPAIRS_R01.md','PHY01_LAB_REPLACEMENT_BUDGET_SCOPE_R02.md','PHY01_LAB_REPLACEMENT_BUDGET_BEFORE_R02.json','PHY01_LAB_REPLACEMENT_BUDGET_WORKER_HANDOFF_R02.md','PHY01_LAB_REPLACEMENT_REVIEW_REPAIRS_R02.md','PHY01_LAB_REPLACEMENT_PREEXECUTION_REVIEW_R02.md','PHY01_LAB_REPLACEMENT_TYPE_REPAIR_R03.md'].map(p=>'.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/'+p)]
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
assert.equal(installedLocalDependency(),localTarget,'Installed local dependency changed during freeze');
const tools=['C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe',git,
  'C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe',
  'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js',
  path.join(root,app,'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe')].map(p=>{const bytes=readFileSync(p);return {path:p,bytes:bytes.length,sha256:hash(bytes)};});
const input={schema:'hestia.a0.phy01.bound-lab-replacement.v1',classification:'FROZEN_STATIC_PURE_CAPTURE_AND_MOCK_TRANSACTION_INPUT_ONLY',stage,at:new Date().toISOString(),head,branch,
  inventories,index:{text:index,sha256:hash(index)},trackedDirty:{text:dirty,sha256:hash(dirty)},excludedDependencies,tools,packageJson,installedLocalDependency:{path:`${app}/node_modules/@hestia/rapier3d-phy01-candidate`,target:localTarget},
  gpuBrowserNetwork:'NOT_RUN',privateThreeHandles:'NOT_QUALIFIED',strictTypes:'PASS_ACTUAL_TS7_SKIPLIBCHECK_FALSE',publicSave:'LEGACY_WRAPPERS_AND_SCHEMA_UNCHANGED; RUNTIME_GUARDED',labSave:'DIRECT_LAB_CAPTURE_AND_WORLDREPLACEMENT_CODE; SIX_PURE_COPY_SEVEN_FAKE_ADMISSION_SEVENTEEN_MOCK_TRANSACTION_CASES_ONLY',nativeGameplayColliderF7:'NOT_RUN',workerClientBootstrapWorldReplacement:'DIRECT_LAB_REPLACEMENT_CODE_ONLY; WORKER_CLIENT_BOOTSTRAP_CHUNK_NOT_WIRED_TO_LAB',physicalHeap:'NOT_QUALIFIED',productAcceptance:false,g01Complete:false};
writeFileSync(manifestPath,JSON.stringify(input,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stage,inputSha256:hash(readFileSync(manifestPath)),counts:Object.fromEntries(Object.entries(inventories).map(([k,v])=>[k,v.rows.length])),productAcceptance:false}));
