import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const spike=fileURLToPath(new URL('./',import.meta.url)),root=path.resolve(spike,'../..');
const scopes=['spikes/rt-02a-bvh','.devtoolbox/specs/changes/rt-02a-2026-10-09'];
const controls=['binding-manifest.json','dirty-tree.json','receipt.json','seal.json'].map(name=>`spikes/rt-02a-bvh/${name}`);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async rel=>JSON.parse(await readFile(path.join(root,rel),'utf8'));
const write=async(name,value)=>writeFile(path.join(spike,name),JSON.stringify(value,null,2)+'\n');
async function files(directory){const found=[];for(const item of await readdir(path.join(root,directory),{withFileTypes:true})){const rel=`${directory}/${item.name}`;const info=await lstat(path.join(root,rel));if(info.isSymbolicLink())throw new Error(`Unbound symlink ${rel}`);if(item.isDirectory())found.push(...await files(rel));else found.push(rel);}return found.sort();}
async function row(rel){const bytes=await readFile(path.join(root,rel));return {path:rel,bytes:bytes.length,sha256:sha(bytes)};}
async function payload(){const names=(await Promise.all(scopes.map(files))).flat().filter(name=>!controls.includes(name)).sort();const result=[];for(const name of names)result.push(await row(name));return result;}
async function tool(file,version){const bytes=await readFile(file);return {path:file,bytes:bytes.length,sha256:sha(bytes),version};}
async function verify(){const seal=await json(controls[3]);for(const control of seal.controls){const actual=await row(control.path);assert.deepEqual(actual,control,`Control drift ${control.path}`);}
  const manifest=await json(controls[0]),actual=await payload();assert.deepEqual(actual,manifest.files,'Full payload membership/byte drift');
  for(const binary of manifest.tools){assert.deepEqual(await tool(binary.path,binary.version),binary,'Tool drift');}
  const git=await json(`${scopes[1]}/tests/git-final.json`);assert.equal(sha(await readFile(git.indexFile)),git.indexSha256,'Current index changed');assert.equal(sha(await readFile(git.headFile)),git.headFileSha256,'Current HEAD reference changed');
  assert.equal((await readFile(git.headFile,'utf8')).trim(),`ref: refs/heads/${git.branch}`,'Current branch changed');assert.equal(sha(await readFile(git.refFile)),git.refFileSha256,'Branch target bytes changed');assert.equal((await readFile(git.refFile,'utf8')).trim(),git.head,'Resolved current commit changed');
  const receipt=await json(controls[2]);console.log(JSON.stringify({status:'PASS',scope:'FULL_BYTE_BINDING_ONLY',sealSha256:sha(await readFile(path.join(root,controls[3]))),files:actual.length,dirtyTreeSha256:receipt.dirtyTreeSha256,hardware:'NOT_RUN',productIntegration:'NO'}));}
async function create(){
  const git=await json(`${scopes[1]}/tests/git-final.json`);assert.equal(git.head,'17b1db4201a28e7b607c30707bdc2b75e3484a10');assert.equal(git.branch,'feature/rt-02a-2026-10-09');assert.equal(git.stagedDiff,'');
  const dirtyPaths=git.statusRaw.split('\0').filter(Boolean).map(line=>line.slice(3));for(const name of dirtyPaths)assert.ok(scopes.some(scope=>name.startsWith(`${scope}/`)),`Outside scope ${name}`);
  const reviewNames=(await Promise.all(scopes.map(files))).flat().filter(name=>/\.(ts|mts|mjs|md|ps1|html)$/.test(name)&&!name.includes('/node_modules/')&&!name.includes('/dist/')&&!name.includes('/imports/')&&!name.includes('/tests/shaders/'));
  let patch='# Human review candidate: authored code/docs. Full imported/fixture/dependency/build/evidence membership is in binding-manifest.json. No approval claimed.\n';
  for(const name of reviewNames.sort()){const text=await readFile(path.join(root,name),'utf8');const lines=text.replace(/\r\n/g,'\n').split('\n');patch+=`diff --git a/${name} b/${name}\nnew file mode 100644\n--- /dev/null\n+++ b/${name}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line=>'+'+line).join('\n')}\n`;}
  await writeFile(path.join(spike,'review.patch'),patch);
  const evidence=await json(`${scopes[1]}/tests/compute-results.json`),browser=await json(`${scopes[1]}/tests/browser-cpu-corrected.json`),provenance=await json(`${scopes[0]}/input-provenance.json`);
  assert.equal(evidence.variants.length,9);assert.equal(evidence.packedRays,1000);assert.equal(browser.result.status,'PASS');
  const externalArtifacts=[];for(const name of ['page-2026-10-09T17-31-48-226Z.yml','console-2026-10-09T17-31-48-095Z.log','page-2026-10-09T17-34-44-727Z.yml','console-2026-10-09T17-34-44-624Z.log']){const file=path.resolve(root,'../../.playwright-mcp',name);const bytes=await readFile(file);externalArtifacts.push({path:file,bytes:bytes.length,sha256:sha(bytes),origin:'AUTOMATIC_BROWSER_TOOL_SIDE_EFFECT_MAIN_CHECKOUT',deleted:false});}
  const tools=[await tool(process.execPath,process.version),await tool('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe',git.gitVersion),await tool('C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js','10.9.8')];
  const records=await payload();const manifest={schema:'hestia.rt02a.binding.v1',head:git.head,branch:git.branch,scopes,controlExclusions:controls,exclusionReason:'Four named control files avoid self-hash cycles; seal binds their exact bytes.',tools,files:records,externalArtifacts,sourceFixtureLockWasmShaderBuildBound:true,wasmExecution:'NOT_RUN_UNUSED_TRANSITIVE_RAPIER_021_ONLY',browserBinary:{path:null,status:'UNAVAILABLE_FROM_MCP',version:'Chrome 155.0.8059.40'}};
  await write('binding-manifest.json',manifest);
  const dirty={schema:'hestia.rt02a.dirty.v1',head:git.head,indexSha256:git.indexSha256,indexLogicalSha256:sha(git.indexRows),statusSha256:sha(git.statusRaw),dirtyPaths,payloadRows:records,controlsExcluded:controls,includesIgnoredDependenciesBuildCacheEvidence:true};await write('dirty-tree.json',dirty);
  const receipt={schema:'hestia.rt02a.receipt.v1',task:'RT-02A',nativeSession:'01a1219c-7022-7070-82a1-30f53e5e28f9',paseoAgent:'4323b637-bbf3-477a-8ba9-2dbadd0aa424',executionLocation:'LOCAL_WINDOWS_ISOLATED',head:git.head,branch:git.branch,
    implementation:'COMPLETE',implementationScope:'FINITE_LAB_CANDIDATE',codeOracle:'PASS',cpuRays:1000,queryModes:2,browserComparisons:4000,bufferPacking:'PASS',shaderSourceEmission:'PASS',shaderVariants:9,realShaderCompile:'NOT_RUN',gpuOracle:'NOT_RUN',hardware:'NOT_RUN',reference:'NOT_RUN',visual:'NOT_RUN',recommendation:'CANDIDATE',runnerStatus:'LOCAL_PENDING',productIntegration:'NO',humanPlannotator:'NOT_REQUESTED_NOT_CLAIMED',commitPushMergePublication:'NOT_RUN',
    provenance:{ANALYTICAL:8,RD_SYNTHETIC:1,PRODUCT_EXPORT:0},producers:provenance.producers,fixtureManifest:provenance.fixtures.manifest,inputProvenanceSha256:sha(await readFile(path.join(spike,'input-provenance.json'))),
    bindingManifest:await row(controls[0]),dirtyTree:await row(controls[1]),dirtyTreeSha256:sha(JSON.stringify(dirty)),indexSha256:git.indexSha256,
    scopes:{authored:'OWN_SPIKE_AND_OWN_SPEC_ONLY',sideEffects:'FOUR_AUTOMATIC_BROWSER_ARTIFACTS_IN_MAIN; PRESERVED_AND_BOUND',externalArtifacts},
    historical:{nativeOriginal:'4/6',correctedHelper:'10/12',RAY02:'FAIL_UNCHANGED',RAY03:'FAIL_UNCHANGED',GFX03visualParity:'FAIL_3/3_UNCHANGED',GFX03backend:'FAIL_3/3_UNCHANGED',goldenThreshold:0.002,fractions:[0.042145,0.038676,0.028381]},
    dependencies:{three:'0.186.1',typesThree:'0.186.0',bvh:'0.9.16',typescript:'5.9.3',rapier:'0.21.0_UNUSED_TRANSITIVE_EXACT_OVERRIDE',upscaler:'NOT_USED_0.5.0_POLICY_UNCHANGED'},
    limitations:['GPU FP32 conformance and real shader compile pending runner slot; no CPU fallback masquerades as GPU','Typed CPU buffer counts exclude JS heap; combined upload/query wall time is not GPU timer','No same-quality DDA hardware cost comparison or genuine HVP/AO/structural-fragment exports','Inherited DevToolbox product typecheck exit1 MODULE_NOT_FOUND; own scoped build passes','Scope incident: automatic browser tool files outside isolated write slice; no destructive cleanup authorization'],runnerProfile:'repro-profile.json'};
  await write('receipt.json',receipt);const bound=[];for(const control of controls.slice(0,3))bound.push(await row(control));await write('seal.json',{schema:'hestia.rt02a.seal.v1',timeUtc:new Date().toISOString(),controls:bound,controlPolicy:'This seal is the only outer self-unhashed control; report its SHA externally.'});await verify();
}
if(process.argv[2]==='verify')await verify();else if(process.argv[2]==='create')await create();else throw new Error('Use create or verify');
