import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spike,loadInputs,sha} from './inputs.mjs';
import {createSparseVolume} from './src/sparse.mts';
import {analyticalVolume,setCell} from './imported/rt01/fixtures.mjs';
const {volumes,rays}=await loadInputs(),population=[];
for(const [id,v] of volumes){const s=await createSparseVolume(v,v.binding),row={id,provenance:v.provenance,rays:rays.filter(r=>r.volumeId===id).length,modes:[]};
 for(const mode of ['flat','two-level']){const counters={pageLookups:0,rootLookups:0,cellTests:0,emptySkips:0};for(const r of rays.filter(r=>r.volumeId===id)){const c=s.traceFrozen(r.ray,r.sourceBinding,mode).counters;for(const k of Object.keys(c))counters[k]+=c[k];}
 row.modes.push({mode,counters,residency:s.residency(mode,4,64*64),allocationPolicy:'4-byte WebGPU buffer size; no dynamic offsets; requested-device admission later'});}
 population.push(row);s.dispose();}
const v=analyticalVolume(.125,[64,4,4],'skip');setCell(v,[63,1,1],1);const s=await createSparseVolume(v,v.binding),ray={id:'empty-skip-control',origin:[v.origin[0],v.origin[1]+.1875,v.origin[2]+.1875],direction:[1,0,0],maxDistance:100,maxSteps:9999};
const skip={flat:s.traceFrozen(ray,v.binding,'flat'),twoLevel:s.traceFrozen(ray,v.binding,'two-level')};
assert.ok(skip.twoLevel.counters.pageLookups+skip.twoLevel.counters.rootLookups<skip.flat.counters.pageLookups);
const lock=JSON.parse(await readFile(path.join(spike,'package-lock.json'))),dependencies=[];
for(const [name,ref] of Object.entries(lock.packages).filter(([n])=>n)){const p=JSON.parse(await readFile(path.join(spike,name,'package.json')));assert.equal(p.version,ref.version);assert.ok(ref.integrity&&ref.resolved.startsWith('https://registry.npmjs.org/'));
 dependencies.push({path:name,name:p.name,version:p.version,license:p.license??null,exports:p.exports??null,registryIntegrity:ref.integrity});}
const result={schema:'hestia.rt02b.cpu-diagnostic.v1',status:'PASS',location:'LOCAL_WINDOWS_ISOLATED',hostLoad:'UNCONTROLLED_PARALLEL_SESSIONS',population,skip,dependencies,lockSha256:sha(await readFile(path.join(spike,'package-lock.json'))),timings:{gpuMilliseconds:null,qualifiedCpuMilliseconds:null},actualAdapter:null,hardware:'NOT_RUN',productIntegration:'NO'};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',rays:1000,skipCounters:{flat:skip.flat.counters,twoLevel:skip.twoLevel.counters},dependencyPins:dependencies.filter(p=>['three','@types/three','typescript','@webgpu/types'].includes(p.name)).map(p=>({name:p.name,version:p.version,license:p.license})),gpu:'NOT_RUN'}));
