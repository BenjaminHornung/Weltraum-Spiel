import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const spike = path.dirname(fileURLToPath(import.meta.url));
const carrier = path.resolve(spike, '../..');
const primary = path.resolve(carrier, '../..');
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const lab = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
const app = 'apps/weltraum-browser';
const hash = b => createHash('sha256').update(b).digest('hex');
const lfs = b => {
  const m = /^version https:\/\/git-lfs.github.com\/spec\/v1\r?\noid sha256:([a-f0-9]{64})\r?\nsize (\d+)/.exec(b.toString('utf8',0,256));
  return m ? { lfsOidSha256:m[1], lfsPayloadBytes:Number(m[2]) } : {};
};
const utc = () => new Date().toISOString();
const runId = process.argv[2];
const currentOnly = process.argv[3] === '--a0-current';
const frozenOnly = currentOnly || process.argv[3] === '--a0-frozen';
assert.match(runId ?? '', /^[a-zA-Z0-9-]+$/, 'Provide a new simple run ID');
assert.equal(path.basename(carrier), 'Hestia-Upscaling-S1-G00-2026-10-09');
const out = path.join(spike, 'evidence', runId);
assert(!existsSync(out), 'Existing observations are immutable; choose a new run ID');
const command = (cwd, args, input, encoding = 'utf8') => {
  const r = spawnSync(git, ['--no-optional-locks', '-C', cwd, ...args], { input, encoding, timeout: 60000, maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  return { exitCode: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message ?? null };
};
const g = (cwd, ...args) => {
  const r = command(cwd, args); assert.equal(r.exitCode, 0, `${args.join(' ')}: ${r.error ?? r.stderr}`); return r.stdout.trimEnd();
};
assert.equal(g(carrier, 'rev-parse', 'HEAD'), lab);
assert.equal(g(carrier, 'branch', '--show-current'), 'feature/upscaling-s1-g00-2026-10-09');
mkdirSync(out, { recursive: true });
const save = (name, value) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const files = (root, prefix = '') => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name, 'en')).flatMap(e => {
    if (e.isSymbolicLink() || ['node_modules', '.git', 'dist', '.runtime', 'evidence'].includes(e.name)) return [];
    const p = prefix + e.name;
    return e.isDirectory() ? files(path.join(root, e.name), p + '/') : [p];
  });
};
const bind = (root, p) => {
  try { const b = readFileSync(path.join(root, p)); return { path: p, bytes: b.length, sha256: hash(b) }; }
  catch (e) { return { path: p, error: e.code }; }
};
const manifestNames = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts', 'index.html'].map(p => `${app}/${p}`);
const productPaths = [app + '/src', app + '/tests', app + '/public'];
const committed = (ref) => {
  const listed = g(carrier, 'ls-tree', '-r', '-z', ref, '--', ...productPaths, ...manifestNames).split('\0').filter(Boolean).map(line => {
    const m = /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(line); assert(m); return { object: m[3], path: m[4] };
  }).filter(e => !e.path.includes('/evidence/'));
  const r = command(carrier, ['cat-file', '--batch'], listed.map(e => e.object).join('\n') + '\n', null);
  assert.equal(r.exitCode, 0); let offset = 0;
  const texts = new Map();
  const rows = listed.map(e => {
    const end = r.stdout.indexOf(10, offset); assert(end >= 0);
    const h = r.stdout.subarray(offset, end).toString().split(' '); assert.equal(h[1], 'blob');
    const bytes = Number(h[2]); const b = r.stdout.subarray(end + 1, end + 1 + bytes); assert.equal(b.length, bytes);
    offset = end + 2 + bytes;
    if (/\.(ts|css|json)$/.test(e.path)) texts.set(e.path, b.toString('utf8'));
    return { ...e, bytes, sha256: hash(b), ...lfs(b) };
  });
  assert.equal(offset, r.stdout.length);
  return { rows, texts };
};
const observed = root => {
  const startedAt = utc(); const statusBefore = g(root, 'status', '--porcelain=v1', '-uall');
  const names = [...new Set([...productPaths.flatMap(p => files(path.join(root, p)).map(f => p + '/' + f)), ...manifestNames])].sort();
  const texts = new Map();
  const rows = names.map(p => {
    try {
      const b=readFileSync(path.join(root,p));
      if (/\.(ts|css|json)$/.test(p)) texts.set(p,b.toString('utf8'));
      return {path:p,bytes:b.length,sha256:hash(b),...lfs(b)};
    } catch(e) { return {path:p,error:e.code}; }
  });
  const statusAfter = g(root, 'status', '--porcelain=v1', '-uall');
  return { rows, texts, dirty: { root, head: g(root,'rev-parse','HEAD'), branch: g(root,'branch','--show-current'), startedAt, endedAt:utc(),
    atomicFreeze:false, statusStableDuringRead:statusBefore === statusAfter, statusBefore, statusAfter,
    statusBeforeSha256:hash(statusBefore), statusAfterSha256:hash(statusAfter),
    sourceDigest:hash(JSON.stringify(rows)), limitation:'Full dirty path inventory; byte hashes bind product src/tests/public/manifests only. Other dirty evidence/docs are not byte-frozen. A0 owner freeze is absent.' } };
};

const refs = frozenOnly ? [] : g(carrier,'for-each-ref','--format=%(refname) %(objectname)').split('\n');
const worktreeRaw = frozenOnly ? '' : g(carrier,'worktree','list','--porcelain');
const worktrees = worktreeRaw.split(/\r?\n\r?\n/).filter(Boolean).map(block => {
  const lines=block.split(/\r?\n/), root=lines.find(l=>l.startsWith('worktree ')).slice(9);
  const status = existsSync(path.join(root,'.git')) ? command(root,['status','--porcelain=v1','-uall']) : null;
  return { registration:block, root, accessible:!!status, status:status?.stdout, statusExit:status?.exitCode, statusSha256:status ? hash(status.stdout) : null,
    head:lines.find(l=>l.startsWith('HEAD '))?.slice(5), branch:lines.find(l=>l.startsWith('branch '))?.slice(7),
    activeSession:'NOT_LIVE_VERIFIED; no process/session inventory or new chats' };
});
const bases = frozenOnly ? {lab,carrierHead:g(carrier,'rev-parse','HEAD')} : { lab, carrierHead:g(carrier,'rev-parse','HEAD'), primaryHead:g(primary,'rev-parse','HEAD'), localMain:g(carrier,'rev-parse','main'), storedOriginMain:g(carrier,'rev-parse','origin/main') };
const populations = frozenOnly ? [] : [['lab',lab],['local-main',bases.localMain],['stored-origin-main',bases.storedOriginMain]];
const sourceSummary = [];
const lockManifest = [];
const assets = [];
const hitPattern = /WebGLRenderer|WebGPURenderer|ShaderMaterial|RawShaderMaterial|onBeforeCompile|EffectComposer|\bComposer\b|RenderPipeline|shadowMap|ShadowMaterial|customDepthMaterial|customDistanceMaterial|WebGLRenderTarget|DepthTexture|rendererFactory|createBackend|new THREE\.\w*(?:Material|Texture)|requestAnimationFrame|readPixels|mapAsync/;
// shortcut: lexical conservative graph, use the real bundle/network oracle in S1-G01 before claiming runtime load isolation.
const audit = (id, texts) => {
  const hits = [], edges = [], external = [], unresolved = [];
  for (const [file, text] of texts) {
    if (!file.startsWith(app+'/src/') || !/\.(ts|css)$/.test(file)) continue;
    text.split(/\r?\n/).forEach((line,i) => { if(hitPattern.test(line)) hits.push({file,line:i+1,text:line.trim()}); });
    const re = /(?:\b(import|export)\s+(type\s+)?[^;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*['"]([^'"]+)['"]|new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url)/g;
    for (const m of text.matchAll(re)) {
      const specifier=m[3]??m[4]??m[5]??m[6], kind=m[2]?'type':m[4]?'dynamic':m[6]?'worker-url':'static';
      const line=text.slice(0,m.index).split('\n').length;
      if(!specifier.startsWith('.')){external.push({file,line,specifier,kind});continue;}
      const stem=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));
      const candidates=[stem,stem+'.ts',stem+'/index.ts',stem.replace(/\.js$/,'.ts')];
      const target=candidates.find(p=>texts.has(p));
      if(target) edges.push({file,line,target,kind}); else unresolved.push({file,line,specifier,kind});
    }
  }
  const closure = root => {
    const seen=new Set([root]), queue=[root];
    while(queue.length){const from=queue.shift();for(const e of edges.filter(e=>e.file===from&&e.kind!=='type')){if(!seen.has(e.target)){seen.add(e.target);queue.push(e.target);}}}
    return [...seen].sort();
  };
  save(`render-closure-${id}.json`,{population:id,analysis:'LEXICAL_CONSERVATIVE_NOT_BUNDLE_OR_GPU_PROOF',hits,edges,external,unresolved,
    closures:{hvp:closure(app+'/src/hvp/hvpBootstrap.ts'),normal:closure(app+'/src/render/three/debugScene.ts'),surfaceLab:closure(app+'/src/surface-lab/surfaceLabBootstrap.ts')}});
};
const record = (id, rootOrRef, value) => {
  save(`source-${id}.json`,{population:id,rootOrRef,files:value.rows,digest:hash(JSON.stringify(value.rows)),atomicFreeze:id.endsWith('wip')?false:true});
  sourceSummary.push({id,rootOrRef,files:value.rows.length,digest:hash(JSON.stringify(value.rows))});
  assets.push({population:id,rootOrRef,files:value.rows.filter(r=>r.path.startsWith(app+'/public/'))});
  audit(id,value.texts);
  for(const p of manifestNames){if(p.endsWith('package-lock.json')||p.endsWith('package.json')){
    const text=value.texts.get(p); if(!text)continue; const parsed=JSON.parse(text);
    lockManifest.push({population:id,path:p,binding:value.rows.find(r=>r.path===p),lockfileVersion:parsed.lockfileVersion??null,
      scripts:parsed.scripts??null,dependencies:parsed.dependencies??null,devDependencies:parsed.devDependencies??null,
      packages:parsed.packages?Object.fromEntries(['','node_modules/three','node_modules/@types/three','node_modules/@dimforge/rapier3d-compat','node_modules/@pmndrs/upscaler'].filter(k=>parsed.packages[k]).map(k=>[k,parsed.packages[k]])):null});
  }}
};
for(const [id,ref] of populations) record(id,ref,committed(ref));
for(const [id,root] of frozenOnly ? [] : [['carrier-wip',carrier],['a0-wip',path.join(primary,'.worktrees/Hestia-CutV3-Resume-2026-10-05')]]){
  const value=observed(root);record(id,root,value);save(`dirty-${id}.json`,value.dirty);
}
const inputRoot=path.join(primary,'artifacts/hestia-cloud-orchestration-2026-10-09');
const inputPaths=['USER_OVERRIDES_2026-10-09.md','STATE.json','sources/WELTRAUM_WEBGPU_TEMPORAL_UPSCALING_FRAME_GENERATION_MASTERPLAN_2026-10-09.md'];
const inputs=inputPaths.map(p=>({...bind(inputRoot,p),root:inputRoot}));
assert.equal(inputs[2].bytes,132508);assert.equal(inputs[2].sha256,'8da71eef9ba4767878dcc22514f6c6777a2350a0c2f7e5f5837cfe8edb3f411b');
const state=JSON.parse(readFileSync(path.join(inputRoot,'STATE.json')));
const producers=[];
for(const id of frozenOnly ? [] : ['GFX-03','GFX-01-02','RT-01','PHY-01']){
  const task=state.tasks.find(t=>t.id===id);assert(task);
  const root=task.worktree.replaceAll('\\\\','\\');
  const owned=files(path.join(root,task.scope)).map(p=>bind(root,task.scope+'/'+p));
  if(id==='RT-01')owned.push(...files(path.join(root,'spikes/_shared/rt-2026-10-09')).map(p=>bind(root,'spikes/_shared/rt-2026-10-09/'+p)));
  const expected=Object.entries(task.handoff??{}).filter(([k,v])=>/Sha256$/.test(k)&&typeof v==='string');
  producers.push({id,root,scope:task.scope,head:existsSync(root)?g(root,'rev-parse','HEAD'):null,stateStatus:task.status,
    handoffPresent:existsSync(path.join(root,task.scope,'HANDOFF.md')),receiptPresent:existsSync(path.join(root,task.scope,'receipt.json')),
    ownership:'INPUT ONLY; not product integration',files:owned,
    stateDigestChecks:expected.map(([key,expectedSha256])=>({key,expectedSha256,matches:owned.filter(f=>f.sha256===expectedSha256).map(f=>f.path)}))});
}
if(frozenOnly&&!currentOnly){
  const a0=path.join(primary,'.worktrees/Hestia-CutV3-Resume-2026-10-05');
  const base='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07';
  const entry=base+'/A0/recovery-input-r01';
  const expected=[
    ['CONSUMER_RECEIPT.json',1296,'61e6eeed44bf513f84f2579c80b17d5b70f8a67ba8c8af733ffcd61bec8d0186'],
    ['INPUT.json',583053,'6cda4f268f3442bfc7249768e8ca7798ecf9c9cbe28012f4fae3d95fb3193521'],
    ['INPUT.sha256',66,'18dfbd91d4fed3729016fe099f837b370593329d3e9d4a5c286e4134ad22152e'],
    ['HANDOFF.md',4864,'7dc8de07541a44f0a6a618882eb489e8001bd824bed5d243bdec66b5454ba7ad'],
    ['COMMANDS.json',3221,'83baa06610774baa92017cc37611784d885c7baed5f0e9923757e55eafa7f94d']
  ];
  const entryBindings=expected.map(([file,bytes,sha256])=>{const row=bind(a0,entry+'/'+file);assert.equal(row.bytes,bytes);assert.equal(row.sha256,sha256);return row;});
  const input=JSON.parse(readFileSync(path.join(a0,entry,'INPUT.json'))),consumer=JSON.parse(readFileSync(path.join(a0,entry,'CONSUMER_RECEIPT.json')));
  assert.equal(input.head,lab);assert.equal(input.branch,'feature/hestia-destruction-program-2026-10-07');
  assert.equal(input.nativeId,'01a120eb-c6c5-7b40-bb95-cdf703ecb5c3');assert.equal(input.agentId,'37dddeb2-1688-47cc-af00-b03edd394215');
  assert(consumer.acceptedFor.includes('S1-G00 inventory input'));assert.equal(consumer.productIntegrated,false);
  const python='C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe';
  const helper=base+'/tools/freeze-a0-recovery-input.py',helperSha='933dbdc5a65a4b4ba3020b8c984d8ed7b2c7826de2d8868bd0896b2086625d72';
  assert.equal(hash(readFileSync(python)),'e9f7e4baa0da1c21ffc3c2c2a644459b1a38dced56dfc7846e16f801645d520f');
  const frozenHelper=path.join(a0,entry,'snapshot',helper);
  assert.equal(hash(readFileSync(frozenHelper)),helperSha);
  // The preserved helper derives A0 paths from __file__; execute its bound bytes with that original locator, never the moving helper code.
  const bootstrap='import hashlib,pathlib,sys; b=pathlib.Path(sys.argv[1]).read_bytes(); assert hashlib.sha256(b).hexdigest()==sys.argv[3]; locator=sys.argv[2]; sys.argv=[locator,"verify"]; exec(compile(b,locator,"exec"),{"__file__":locator,"__name__":"__main__"})';
  const pythonArgs=['-c',bootstrap,frozenHelper,path.join(a0,helper),helperSha];
  const result=spawnSync(python,pythonArgs,{cwd:carrier,encoding:'utf8',timeout:60000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.status,0,result.error?.message??result.stderr);assert.equal(JSON.parse(result.stdout).status,'BOUND_INPUT_ONLY');
  writeFileSync(path.join(out,'frozen-helper-verify.log'),result.stdout+result.stderr);
  const safe=(root,p)=>{const full=path.resolve(root,p);assert(full.startsWith(path.resolve(root)+path.sep),'Input path escape');return full;};
  const sourceRoot=safe(a0,input.frozenSourceRoot),buildRoot=safe(a0,input.frozenBuildRoot),snapshotRoot=safe(a0,entry+'/snapshot');
  const checked=[];const texts=new Map();
  for(const [kind,rows,root] of [['source',input.source,sourceRoot],['built',input.built,buildRoot],['dirty',input.dirty,snapshotRoot],['dependencies',input.dependencies,snapshotRoot],['evidence',input.evidence,snapshotRoot]]){
    for(const row of rows){const b=readFileSync(safe(root,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(hash(b),row.sha256,row.path);checked.push({kind,root,...row});if(kind==='source'&&/\.(ts|css|json)$/.test(row.path))texts.set(row.path,b.toString('utf8'));}
  }
  const sourceNames=files(sourceRoot);assert.deepEqual([...input.source.map(f=>f.path)].sort(),sourceNames.sort(),'Frozen source membership mismatch');
  const buildNames=files(buildRoot);assert.deepEqual([...input.built.map(f=>f.path)].sort(),buildNames.sort(),'Frozen build membership mismatch');
  const pyJson=v=>Array.isArray(v)?'['+v.map(pyJson).join(', ')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>pyJson(k)+': '+pyJson(v[k])).join(', ')+'}':JSON.stringify(v).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  assert.equal(hash(pyJson(input.source)),input.sourceManifestHash);assert.equal(hash(pyJson(input.built)),input.buildManifestHash);
  assert.equal(input.sourceManifestHash,'f292a7f57f5bc8c6e848b08a566c9f5f8225c13a30b396434423a561cc839982');
  assert.equal(input.buildManifestHash,'958428bf2cfd237dfcdbf2190cd2924d2b12a347ab8d4dd1f62b75b9a4e985a1');
  record('a0-r01-frozen',sourceRoot,{rows:input.source,texts});
  const contracts=[];
  for(const p of ['hvp/hvpCoastMesher.ts','hvp/hvpCoastSource.ts','voxel/blockAmbientOcclusion.ts','workers/hvpChunkJob.ts','workers/hvpNeighborJob.ts','hestia-prototype/terrain/terrainChunkInput.ts','hestia-prototype/runtime/neighborProducts.ts','hestia-prototype/terrain/terrainProducts.ts','hestia-prototype/presentation/look.ts','hestia-prototype/presentation/visualEffects.ts','hestia-prototype/presentation/shadowRevision.ts','hvp/hvpBootstrap.ts','hestia-prototype/persistence/saveStore.ts','hestia-prototype/persistence/gameCheckpoint.ts','hestia-prototype/persistence/worldCheckpoint.ts','hestia-prototype/persistence/sceneReplacement.ts']){
    const file=app+'/src/'+p,text=texts.get(file);if(!text){contracts.push({file,status:'ABSENT_LOOKUP_USE_CLOSURE'});continue;}
    const fullVisual=/\/presentation\/(look|visualEffects)\.ts$/.test(file);
    const lines=text.split(/\r?\n/).flatMap((line,i)=>fullVisual||/export|HVP_CHUNK|purpose|collision-only|\bAO\b|Ao|memo|packet|saveSignature|aggregate|phase|sourceDigest|materialDigest|terrainCell|\*\.125|\* \.125|1024|shadow|lighting|neighbor|prepare|upsertPrivate|initialize|dispose/i.test(line)?[{line:i+1,text:line}]:[]);
    contracts.push({file,binding:input.source.find(f=>f.path===file),exactSourceExcerpts:lines});
  }
  save('frozen-contract-source-excerpts.json',contracts);
  const evidenceBindings=checked.filter(f=>f.kind==='evidence');
  const fixture=evidenceBindings.find(f=>f.path.endsWith('normal-pilot-r23/d3-d4-pair-0/candidate.json'));
  const candidate=JSON.parse(readFileSync(safe(snapshotRoot,fixture.path)));
  const saved=candidate.nativeWake?.residentEastColdLoad?.saved;
  assert.equal(typeof saved,'string');assert.equal(hash(saved),input.savedFixture.savedSha256);
  const savedGame=JSON.parse(saved).player.data.hestia;assert.equal(savedGame.signature,input.savedFixture.saveSignature);
  const memoPath=base+'/A0/neighbor-authored-column-candidate-r01.json';
  const memo=JSON.parse(readFileSync(safe(snapshotRoot,memoPath)));
  assert.equal(memo.savedSha256,input.savedFixture.savedSha256);assert.equal(memo.saveSignature,input.savedFixture.saveSignature);assert.equal(memo.rawInputHash,input.savedFixture.rawInputHash);
  for(const packet of input.savedFixture.packets){const sample=memo.samples.find(s=>s.lod===packet.lod);assert(sample);assert.equal(sample.packetSha256,packet.packetSha256);assert.equal(sample.packetBytes,packet.packetBytes);}
  save('frozen-fixtures.json',{parameters:input.parameters,savedFixture:input.savedFixture,fixtureBinding:fixture,candidateKeys:Object.keys(candidate),savedLocation:'candidate.nativeWake.residentEastColdLoad.saved',savedValuePresent:true,savedBytes:Buffer.byteLength(saved),savedSha256:hash(saved),saveSignatureVerified:savedGame.signature,rawInputHashSource:'Bound memo/input metadata, not a newly reconstructed mesher packet',memoBinding:evidenceBindings.find(f=>f.path===memoPath),memoSamples:memo.samples,classification:'HISTORICAL_PARAMETERS_AND_PACKET_DIGESTS_NOT_RECOMPUTED_MESHER_OR_HARDWARE_RESULT'});
  const mapChecks=[];
  for(const row of input.built.filter(f=>f.path.endsWith('.map'))){
    const map=JSON.parse(readFileSync(safe(buildRoot,row.path)));
    for(let i=0;i<(map.sources??[]).length;i++){
      const match=/(?:^|\/)(src\/.+)$/.exec(map.sources[i]);if(!match||map.sources[i].includes('node_modules/'))continue;
      const repositoryPath=app+'/'+match[1],source=input.source.find(f=>f.path===repositoryPath);
      if(!source){mapChecks.push({map:row.path,source:repositoryPath,status:'NOT_IN_FROZEN_SOURCE'});continue;}
      const content=map.sourcesContent?.[i];assert.equal(typeof content,'string');
      const actual=hash(content);assert.equal(actual,source.sha256,'Built sourcemap differs from frozen source: '+repositoryPath);
      mapChecks.push({map:row.path,source:repositoryPath,bytes:Buffer.byteLength(content),sha256:actual,status:'EXACT_SOURCE_CONTENT_MATCH'});
    }
  }
  save('built-source-map-bindings.json',{classification:'SOURCE_CONTENT_BINDING_NOT_RUNTIME_OR_HARDWARE_ACCEPTANCE',matches:mapChecks,matchCount:mapChecks.filter(r=>r.status==='EXACT_SOURCE_CONTENT_MATCH').length,missingCount:mapChecks.filter(r=>r.status==='NOT_IN_FROZEN_SOURCE').length});
  save('a0-r01-binding.json',{classification:'FROZEN_INPUT_ONLY_CONSUMED_NO_PRODUCT_OR_HARDWARE_ACCEPTANCE',a0Root:a0,entry,entryBindings,sourceRoot,buildRoot,snapshotRoot,sourceManifestHash:input.sourceManifestHash,buildManifestHash:input.buildManifestHash,nativeId:input.nativeId,agentId:input.agentId,head:input.head,branch:input.branch,helper:{path:frozenHelper,originalLocator:path.join(a0,helper),sha256:helperSha,python,pythonSha256:hash(readFileSync(python)),args:pythonArgs,mode:'BOUND_SNAPSHOT_BYTES_VERIFY_ORIGINAL_A0_LOCATOR',exitCode:result.status,stdout:result.stdout,logSha256:hash(result.stdout+result.stderr)},counts:{source:input.source.length,built:input.built.length,dirty:input.dirty.length,dependencies:input.dependencies.length,evidence:input.evidence.length},verifiedFiles:checked,dirtyScope:input.dirtyScope,fullWipStatusSha256:input.fullWipStatusSha256,fullWipIsOnlyListing:true,fullA0IndexFreezeProvided:false,dirtyGitStates:input.dirty.map(({path,gitState})=>({path,gitState})),parameters:input.parameters,savedFixture:input.savedFixture,gates:input.gates,consumerReceipt:consumer});
  save('index-manifest.json',{carrierHead:lab,carrierTree:g(carrier,'rev-parse',lab+'^{tree}'),carrierIndex:g(carrier,'ls-files','--stage','-z'),carrierStagedPaths:g(carrier,'diff','--cached','--name-only'),a0FrozenHead:input.head,a0FrozenDirtyGitStates:input.dirty.map(({path,gitState})=>({path,gitState})),fullA0IndexFrozen:false,limitation:'A0 r01 supplies per-file dirty gitState and listing hash, not a complete frozen .git/index artifact. No moving A0 index content is consumed.'});
}
if(currentOnly){
  const a0=path.join(primary,'.worktrees/Hestia-CutV3-Resume-2026-10-05'),base='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07';
  const receiptPath=base+'/A0/G00_CURRENT_SOURCE_R02.json',receiptBinding=bind(a0,receiptPath);
  assert.equal(receiptBinding.bytes,309407);assert.equal(receiptBinding.sha256,'acca9a427126d6118ad293b07a298fa9d61ef5e9eb42eefa2828d42a55bdc34c');
  const value=JSON.parse(readFileSync(path.join(a0,receiptPath)));
  assert.equal(value.head,lab);assert.equal(value.branch,'feature/hestia-destruction-program-2026-10-07');
  assert.equal(value.baseInputSha256,'6cda4f268f3442bfc7249768e8ca7798ecf9c9cbe28012f4fae3d95fb3193521');
  for(const [kind,expected,count] of [['source','2f0401b883716b884c81582e7f1c666209dbf0413556a638618f071c6cc71a91',463],['dirty','8503b3646281b8fdac18321f09bfa11361859a5d4e9da9be3aea233586cd88d0',17],['index','3c8d8421ca4492db9788df56dba76f4c38202b181f5a18def261ab4cdff0d44d',817]]){
    assert.equal(value[kind].length,count);assert.equal(hash(JSON.stringify(value[kind])),expected);assert.equal(value[kind+'ManifestSha256'],expected);
  }
  assert.equal(value.assets.length,77);assert.equal(value.currentBuild.status,'NOT_RUN');assert.equal(value.currentBuild.hash,null);
  const safe=p=>{const full=path.resolve(a0,p);assert(full.startsWith(a0+path.sep),'Snapshot path escape');return full;};
  const verified=(row)=>{assert(row.snapshot,'Explicit immutable snapshot required');const b=readFileSync(safe(row.snapshot));assert.equal(b.length,row.bytes,row.path);assert.equal(hash(b),row.sha256,row.path);return b;};
  const texts=new Map();for(const row of value.source){const b=verified(row);if(/\.(ts|css|json)$/.test(row.path))texts.set(row.path,b.toString('utf8'));}
  value.assets.forEach(verified);verified(value.lock);
  const disposition=bind(a0,value.conflictDisposition.path);assert.equal(disposition.bytes,4808);assert.equal(disposition.sha256,'008ee3fa1676251fb8c77738c3e05647bf8ed084fb5c5b0ef3e7586c3b8302f8');
  const historical=JSON.parse(readFileSync(path.join(a0,base,'A0/recovery-input-r01/INPUT.json')));
  const repairs=JSON.parse(readFileSync(path.join(a0,base,'A0/REVIEW_REPAIRS_RECEIPT_R02.json')));
  assert.equal(bind(a0,base+'/A0/REVIEW_REPAIRS_RECEIPT_R02.json').sha256,'820b8baa55aa181f286955da37c615fce99f39fa8f135525ce5d0c8b5884268c');
  const candidates=new Map(historical.dirty.map(f=>[f.path,{...f,snapshot:base+'/A0/recovery-input-r01/snapshot/'+f.path}]));
  for(const f of repairs.artifacts)candidates.set(f.path,f);for(const f of value.source)candidates.set(f.path,f);
  const dirtySnapshots=value.dirty.map(f=>{const row=candidates.get(f.path);assert(row,'Dirty snapshot unavailable: '+f.path);assert.equal(row.sha256,f.sha256);assert.equal(row.bytes,f.bytes);verified(row);return{...f,snapshot:row.snapshot};});
  record('a0-current-source-r02',a0,{rows:value.source,texts});
  const actualIndex=command(a0,['ls-files','--stage','--',...value.dirtyScope]);
  const indexRows=actualIndex.stdout.trimEnd().split(/\r?\n/).filter(Boolean);
  const actualDirty=command(a0,['status','--porcelain=v1','-z','-uall','--',...value.dirtyScope]);
  const dirtyRows=actualDirty.stdout.split('\0').filter(Boolean).map(r=>({gitState:r.slice(0,2),path:r.slice(3)}));
  const liveGit={classification:'METADATA_CONFLICT_OBSERVATION_NOT_SOURCE_CONSUMPTION',head:command(a0,['rev-parse','HEAD']),branch:command(a0,['branch','--show-current']),indexExit:actualIndex.exitCode,indexCount:indexRows.length,indexSha256:hash(JSON.stringify(indexRows)),indexMatches:JSON.stringify(indexRows)===JSON.stringify(value.index),dirtyExit:actualDirty.exitCode,dirtyCount:dirtyRows.length,dirtyMembershipMatches:JSON.stringify(dirtyRows)===JSON.stringify(value.dirty.map(({gitState,path})=>({gitState,path})))};
  save('a0-current-r02-binding.json',{classification:'IMMUTABLE_CURRENT_SOURCE_ONLY_NOT_CURRENT_BUILD_OR_GATE_ACCEPTANCE',a0Root:a0,receiptPath,receiptBinding,value,verifiedDirtySnapshots:dirtySnapshots,dispositionBinding:disposition,nativeId:'01a120eb-c6c5-7b40-bb95-cdf703ecb5c3',agentId:'37dddeb2-1688-47cc-af00-b03edd394215',liveGit,productWriteAuthorization:false,g01Started:false});
  save('index-manifest.json',{scope:value.dirtyScope,records:value.index,sha256:value.indexManifestSha256,recordCount:817,liveGit});
  save('dirty-manifest.json',{records:dirtySnapshots,manifestRecords:value.dirty,sha256:value.dirtyManifestSha256,recordCount:17,classification:'SCOPED_BYTES_AT_EXPLICIT_SNAPSHOT_PATHS_NOT_FULL_WIP_FREEZE'});
}
save('input-manifest.json',{observedAt:utc(),inputs,modelAndEffort:'user requested gpt-6.1-sol/xhigh; runtime model not self-verified',producers});
save('lock-manifest.json',lockManifest);
save('asset-manifest.json',assets);
save('source-summary.json',sourceSummary);
const relations=[];
for(const [name,ref] of frozenOnly ? [] : [['historical-main',bases.storedOriginMain],['hud','7e608d4f1e909dbc6576cde821b595a5bc41927b'],['route','d8fa02867e538dab3363819f10394fd059bda321']]){
  relations.push({name,ref,lab,mergeBase:command(carrier,['merge-base',ref,lab]),ancestorExit:command(carrier,['merge-base','--is-ancestor',ref,lab]).exitCode,
    fileDiff:command(carrier,['diff','--name-status',ref,lab,'--',...productPaths,...manifestNames])});
}
save('git-inventory.json',{observedAt:utc(),bases,refs,worktrees,stashes:frozenOnly?'NOT_REOBSERVED_FROZEN_MODE':g(carrier,'stash','list','--format=%gd %H %s'),relations,
  primaryBranch:frozenOnly?'NOT_CONSUMED':g(primary,'branch','--show-current'),carrierProductDependenciesPresent:existsSync(path.join(carrier,app,'node_modules')),
  immutableCarrierIsProductBase:false,productFreeze:null});
console.log(JSON.stringify({status:'INVENTORY_CAPTURED_NOT_PRODUCT_ACCEPTED',runId,sources:sourceSummary,producerChecks:producers.map(p=>({id:p.id,handoff:p.handoffPresent,receipt:p.receiptPresent,unmatched:p.stateDigestChecks.filter(c=>c.matches.length===0).map(c=>c.key)}))}));
