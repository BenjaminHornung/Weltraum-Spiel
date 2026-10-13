import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync } from 'node:fs';
import { resolve, dirname, relative, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const repo = resolve(root, '../..');
export const baseline = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
export const producer = resolve(repo, '../Hestia-Spike-PLT-01-02-2026-10-09');
export const plt = resolve(producer, 'spikes/plt-01-02-numerics');
export const hash = b => createHash('sha256').update(b).digest('hex');
export function git(args) {
  const r = spawnSync('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe', args,
    {cwd:repo, windowsHide:true, maxBuffer:16*1024*1024});
  if (r.status !== 0) throw new Error(`GIT_ERROR:${r.status}:${r.error?.code ?? ''}:${r.stderr ?? ''}`);
  return r.stdout;
}
const anchors = {
  'receipt.json': ['5842f1c2b781c1ce65a347ec45c28da0717215537ebd45ee100b3a255429555a',13793],
  'NumericsProfile.json': ['c7652cc948a0f213a8a29ff75bdb0a76ede71344c315f924fcc541e6f7ead551',1386],
  '.runtime/final-seal/scope-seal.json': ['b4c0daf90e5c91e4f6811e47b08f32dcfc39b2e932b1e9f34fc53c4009586c6d',21203],
  '.runtime/final-seal/review.patch': ['6e1a8d6a835c6d7630554d7c6235727edff0d8e9b48ec2ae66741a232cb7fe71',1300015],
  'SourceBindings.json':['bd7ff8d2e7bb764b1a963234af8c1c1bc7377a92c844504623444bb28aafc82e'],
  'dependencies.lock.json':['f40f0fa6dc38599731845822fa88e5596d5fd845a220939536fccadef935bd56'],
  'package-lock.json':['f5b5fbf862539b97a9e851252af96d5b502dbae3aa38b59ef065dcc222be84a6'],
  'runner-profile.json':['8d0ef02f6fc84097fede912069829defe9389945884993fe9e5c5f3c96b00906'],
  'src/numerics.mjs':['bbb02b325d728c836ef780be9a60e4d210c8bbe4b62a8ade7a477e7a24ead48a'],
  'src/fixture.mjs':['55e40764195e1e185c3c179f6dd3124b3adcbddb764d683059d276ce71324fb6'],
  'snapshot/time.mjs':['dce7b42f3f90f83f3c44dcb26e822a55ff4098277d39c9e3295e8ef46b5c1a8c'],
  'fixtures/queries.json':['df3895c0f285148d4ee852e54efd65dfa2d968798514fc7a533dffdf8e7c3033'],
  'fixtures/smoothstep-goldens.json':['74a2a00458b56361adaab4ecf1f70e667d0c3ff04ab4e3953bde8f9dc3e78fb1'],
  'wasm/scalar.wasm':['4e7fb1fec55509236ceeecb5405ce062f2d64bb88103a844be42e09a77e6087c',458],
  'wasm/simd.wasm':['55f94330fb47c8096f417d0998aed29a26f09385ceb764de9425d2d751638cb4',396]
};
export function verifyProducer() {
  const rows=Object.entries(anchors).map(([path,[sha256,bytes]])=>{
    const data=readFileSync(resolve(plt,path));
    if(hash(data)!==sha256 || (bytes!==undefined && data.length!==bytes)) throw new Error('FROZEN_INPUT_DRIFT:'+path);
    return {path,bytes:data.length,sha256};
  });
  const seal=JSON.parse(readFileSync(resolve(plt,'.runtime/final-seal/scope-seal.json')));
  if(seal.dirtyTreeDigest!=='sha256:e97130b2dc276016649b86f1a6452edeea11d462dc4dc3c3daa418761d3ddd57' ||
    'sha256:'+hash(JSON.stringify(seal.changedFiles))!==seal.dirtyTreeDigest) throw new Error('PRODUCER_SEAL_INVALID');
  for(const f of seal.changedFiles) {
    if(f.deleted) {if(existsSync(resolve(producer,f.path))) throw new Error('PRODUCER_DELETION_DRIFT');continue;}
    const b=readFileSync(resolve(producer,f.path));
    if(b.length!==f.bytes || 'sha256:'+hash(b)!==f.digest) throw new Error('PRODUCER_DIRTY_DRIFT:'+f.path);
  }
  return {anchors:rows,dirtyTreeDigest:seal.dirtyTreeDigest,verifiedDirtyFiles:seal.changedFiles.length};
}
export function verifyFileBindings(baseDir, files) {
  if(!Array.isArray(files)) throw new Error('INVALID_LOCAL_BINDINGS');
  const base=resolve(baseDir), seen=new Set();
  const rootStat=lstatSync(base);
  if(!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('LOCAL_BINDING_ROOT_INVALID');
  for(const f of files) {
    const p=f?.localPath, parts=typeof p==='string'?p.split('/'):[];
    if(typeof p!=='string' || !p || p.includes('\\') || p.includes(':') || win32.isAbsolute(p) ||
      parts.some(x=>!x || x==='.' || x==='..') || !Number.isSafeInteger(f.bytes) || f.bytes<0 ||
      typeof f.sha256!=='string' || !/^[0-9a-f]{64}$/.test(f.sha256) || seen.has(p))
      throw new Error(`INVALID_LOCAL_BINDING:${p ?? ''}`);
    seen.add(p);
    const target=resolve(base,...parts);
    const rel=relative(base,target);
    if(!rel || rel==='..' || rel.startsWith(`..${process.platform==='win32'?'\\':'/'}`))
      throw new Error(`LOCAL_BINDING_PATH_INVALID:${p}`);
    let current=base;
    for(const [i,part] of parts.entries()) {
      current=resolve(current,part);
      let stat;
      try { stat=lstatSync(current); }
      catch(error) {
        if(error.code==='ENOENT' || error.code==='ENOTDIR') throw new Error(`LOCAL_BINDING_PATH_UNRESOLVED:${p}`);
        throw error;
      }
      if(stat.isSymbolicLink()) throw new Error(`LOCAL_BINDING_SYMLINK:${p}`);
      if(i<p.split('/').length-1 ? !stat.isDirectory() : !stat.isFile())
        throw new Error(`LOCAL_BINDING_NOT_FILE:${p}`);
    }
    const data=readFileSync(target);
    if(data.length!==f.bytes || hash(data)!==f.sha256) throw new Error(`LOCAL_SNAPSHOT_DRIFT:${p}`);
  }
  return files;
}
export function verifyLocal() {
  const manifestPath=resolve(root,'SourceBindings.json'),manifestStat=lstatSync(manifestPath);
  if(manifestStat.isSymbolicLink() || !manifestStat.isFile()) throw new Error('LOCAL_BINDING_MANIFEST_INVALID');
  const m=JSON.parse(readFileSync(manifestPath));
  verifyFileBindings(root,m.files);
  return m;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--check')) {const m=verifyLocal(); const p=verifyProducer();console.log(JSON.stringify({status:'PASS',localFiles:m.files.length,...p}));}
  else {
    if(existsSync(resolve(root,'SourceBindings.json'))) throw new Error('BINDINGS_ALREADY_EXIST');
    if(git(['rev-parse','HEAD']).toString().trim()!==baseline) throw new Error('BASELINE_CHANGED');
    const input=verifyProducer(); const files=[];
    const save=(localPath,data,source)=>{const path=resolve(root,localPath);if(existsSync(path)) throw new Error('SNAPSHOT_EXISTS:'+localPath);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data);files.push({localPath,...source,bytes:data.length,sha256:hash(data)});};
    const sourceRoot='apps/weltraum-browser/src/'; const seen=new Set();
    function collect(path) {
      if(seen.has(path))return; seen.add(path);
      if(!path.startsWith(sourceRoot))throw new Error('IMPORT_OUTSIDE_PRODUCT_CORE:'+path);
      const b=git(['show',`${baseline}:${path}`]); const text=b.toString();
      const actual=readFileSync(resolve(repo,path));
      if(hash(actual)!==hash(b))throw new Error('PRODUCT_READ_SOURCE_DRIFT:'+path);
      save('snapshot/product/'+path.slice(sourceRoot.length),b,{source:'product',sourcePath:path,sourceCommit:baseline});
      for(const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
        const target=resolve(dirname(resolve(repo,path)),match[1]);
        const ts=existsSync(target+'.ts')?target+'.ts':resolve(target,'index.ts');
        collect(relative(repo,ts).replaceAll('\\','/'));
      }
    }
    ['celestial/starterSystem.ts','celestial/kepler.ts','spatial/surfaceLocalFrame.ts','spatial/bodyFrames.ts','spatial/universeClock.ts'].forEach(x=>collect(sourceRoot+x));
    const copied=['NumericsProfile.json','src/numerics.mjs','src/fixture.mjs','snapshot/time.mjs','fixtures/queries.json','fixtures/smoothstep-goldens.json','licenses/Random123.txt'];
    for(const path of copied)save('vendor/plt/'+path,readFileSync(resolve(plt,path)),{source:'PLT-01-02',sourcePath:path});
    const packageRoot=resolve(repo,'../../artifacts/hestia-cloud-orchestration-2026-10-09/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09');
    const inputs=['00_START_HIER.md','01_PRUEFUNG_UND_ENTSCHEIDUNG.md','03_SCHNITTSTELLEN_UND_UEBERNAHME.md','Cloud/00_GEMEINSAMER_VERTRAG.md','Auftraege/CEL-01-WXG-00.md','Goals/CEL-01-WXG-00.txt','SOURCE_DOCS.json','Quellen/weltraum-universeller-planeten-wetter-climate-core-architektur-v2-2026-10-09.md','Quellen/hestia-dynamisches-volumetrisches-wetter-architekturkonzept-2026-10-09.md','Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md'].map(path=>{const b=readFileSync(resolve(packageRoot,path));return {path,bytes:b.length,sha256:hash(b)};});
    writeFileSync(resolve(root,'SourceBindings.json'),JSON.stringify({baseline,productSnapshots:'unchanged exact Git blobs and worktree bytes',files,packageInputs:inputs,producer:input,wasm:'verified upstream only; not imported or executed; no weather kernel',shader:'NOT_APPLICABLE'},null,2)+'\n');
    console.log(JSON.stringify({status:'PASS',copiedFiles:files.length,verifiedProducerFiles:input.verifiedDirtyFiles}));
  }
}
