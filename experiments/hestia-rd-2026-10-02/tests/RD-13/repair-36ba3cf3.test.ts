import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { fixtureRevision, getFixtureDigest, type LabFixtureV1, type Vec3 } from '../../src/contracts/fixture';
import { mountExperiment, registeredMountCount, type LabExperimentFacts, type LabExperimentHandle } from '../../src/contracts/experiment';
import { loadFixture, loadInventory } from '../../src/runner/assets';
import { wrapTerminalHost } from '../../src/experiments/voxel-rays';
import { PRODUCTION_KERNEL, VISIBLE_FRAGMENT, traceOracle } from '../../src/experiments/voxel-rays/ray';
import type { RayVolume } from '../../src/experiments/voxel-rays/volume';
import { nativeCases } from './native-cases';
import { productionCpu } from './production-cpu';

/** New explicitly synthetic supplementary inputs; never modify nativeCases or canonical materials/fixtures. */
function row(slots:number[],coverage=slots.map(()=>1),doubles:number[]=[],dimensions:Vec3=[slots.length,1,1],quantum=1):RayVolume {
  const template=nativeCases[0].volume;const packed=new Uint8Array(slots.length*4);
  slots.forEach((slot,i)=>packed.set([Number(slot!==0),coverage[i],slot,0],i*4));
  const worldFromGrid=new Matrix4().makeScale(quantum,quantum,quantum);
  const materials=[1,2,3].map((n)=>({id:template.materialIds[n-1],role:'dry' as const,colorLinearRgb:[.5,.5,.5] as Vec3,doubleSided:doubles.includes(n)}));
  return {...template,dimensions,slots:Uint8Array.from(slots),coverage:Uint8Array.from(coverage),packed,materials,quantumMeters:quantum,
    worldFromGrid,gridFromWorld:worldFromGrid.clone().invert(),source:{...template.source,originalDimensions:dimensions}};
}
const origin:Vec3=[.5,.5,.5];const direction:Vec3=[1,0,0];
function later(h:ReturnType<typeof productionCpu>) {expect(h).toMatchObject({hit:true,traversalFault:false,t:1.5,cell:[2,0,0],slot:1,normal:[-1,0,0]});}
it('P2 visible owner SOURCE/CPU: inside front-only rejects first back exit and selects later front; geometric oracle unchanged (NOT NATIVE)',()=>{
  const v=row([1,0,1]);expect(traceOracle(v,origin,direction)).toMatchObject({status:'hit',t:.5,normal:[1,0,0]});
  const geometric=productionCpu(v,origin,direction);expect(geometric).toMatchObject({hit:true,t:.5});
  geometric.normal.forEach((n,a)=>expect(n).toBeCloseTo(a===0?1:0,12));later(productionCpu(v,origin,direction,true));
});
it('P2 visible owner SOURCE/CPU: double-sided first exit remains selected without changing geometry/materials (NOT NATIVE)',()=>{
  const result=productionCpu(row([1,0,1],undefined,[1]),origin,direction,true);expect(result).toMatchObject({hit:true,t:.5,cell:[0,0,0]});
  result.normal.forEach((n,a)=>expect(n).toBeCloseTo(a===0?1:0,12));
});
it('P2 visible owner SOURCE/CPU: exit uses LAST contiguous cell material, not origin material sidedness (NOT NATIVE)',()=>{
  expect(productionCpu(row([2,1,0,3],undefined,[2]),origin,direction,true)).toMatchObject({hit:true,t:2.5,slot:3,cell:[3,0,0],normal:[-1,0,0]});
});
it('P2 visible owner SOURCE/CPU: front-only run without a later front is a miss, not a forced double-sided hit (NOT NATIVE)',()=>{
  expect(productionCpu(row([1,1]),origin,direction,true)).toMatchObject({hit:false,traversalFault:false});
  expect(productionCpu(row([1,0],[1,0]),origin,direction,true)).toMatchObject({hit:false,unknown:true,traversalFault:false});
});
it('P2 visible owner SOURCE/CPU: skipped interval retains Unknown before later front (NOT NATIVE)',()=>{
  const result=productionCpu(row([1,0,1],[1,0,1]),origin,direction,true);later(result);expect(result.unknown).toBe(true);
});
it('P2 visible owner SOURCE/CPU: negative direction retains world t, opposite normal and original cell (NOT NATIVE)',()=>{
  expect(productionCpu(row([1,0,1]),[2.5,.5,.5],[-1,0,0],true)).toMatchObject({hit:true,t:1.5,cell:[0,0,0],normal:[1,0,0]});
});
it('P2 visible owner SOURCE/CPU: exact negative internal boundary chooses preceding cell, no invented t-zero face (NOT NATIVE)',()=>{
  expect(productionCpu(row([1,0,1]),[2,.5,.5],[-1,0,0],true)).toMatchObject({hit:true,t:1,cell:[0,0,0],normal:[1,0,0]});
});
it('P2 visible owner SOURCE/CPU: all tied axes advance once and zero-length ghost cells are not sampled (NOT NATIVE)',()=>{
  const slots=Array(27).fill(0);slots[0]=1;slots[26]=1;slots[3]=2;const coverage=slots.map(()=>1);coverage[13]=0;
  const d=1/Math.sqrt(3);const result=productionCpu(row(slots,coverage,[],[3,3,3]),origin,[d,d,d],true);
  expect(result).toMatchObject({hit:true,cell:[2,2,2],normal:[-1,0,0],unknown:true});expect(result.t).toBeCloseTo(1.5*Math.sqrt(3),12);
});
it('P2 visible owner SOURCE/CPU: thin scaled cells retain original world-metre parameter without epsilon restart (NOT NATIVE)',()=>{
  const q=1e-8;const result=productionCpu(row([1,0,1],undefined,[],[3,1,1],q),[q*.5,q*.5,q*.5],direction,true);
  expect(result).toMatchObject({hit:true,cell:[2,0,0],normal:[-1,0,0]});expect(result.t).toBeCloseTo(q*1.5,20);
});
it('P2 visible owner SOURCE/CPU: one total admitted traversal budget across skipped exit and far front (NOT NATIVE)',()=>{
  const slots=Array(64).fill(0);slots[0]=1;slots[63]=1;const result=productionCpu(row(slots),origin,direction,true);
  expect(result).toMatchObject({hit:true,t:62.5,cell:[63,0,0]});expect(result.iterations).toBeLessThanOrEqual(67);
});
it('P2 shared production SOURCE/CPU: original twelve geometric inputs still agree with unchanged independent interval oracle (NOT NATIVE)',()=>{
  for (const c of nativeCases) {
    const expected=traceOracle(c.volume,c.origin,c.direction);const actual=productionCpu(c.volume,c.origin,c.direction);
    expect(actual.traversalFault,c.id).toBe(false);expect(actual.hit,c.id).toBe(expected.status==='hit');expect(actual.unknown,c.id).toBe(expected.unknownTraversed);
    if (expected.status==='hit') {expect(actual.t,c.id).toBeCloseTo(expected.t!,12);expect(actual.cell,c.id).toEqual(expected.cell);expect(actual.slot,c.id).toBe(expected.slot);
      const normal=new Vector3(...actual.normal).transformDirection(c.volume.worldFromGrid).toArray();normal.forEach((n,a)=>expect(n,c.id).toBeCloseTo(expected.normal![a],12));}
  }
});
it('P2 visible shared SOURCE contract: production fragment selects within bounded kernel, numeric geometric call remains distinct (NOT NATIVE)',()=>{
  expect(VISIBLE_FRAGMENT).toContain('VoxelHit h=traceVisibleVoxels(gridOrigin,gridDirection);');
  expect(VISIBLE_FRAGMENT).not.toContain('if (back && slotDoubleSided[h.slot]==0) { discard; }');
  expect(PRODUCTION_KERNEL).toContain('return traceVoxels(o,gridDirection,false);');expect(PRODUCTION_KERNEL).toContain('return traceVoxels(o,gridDirection,true);');
  expect(PRODUCTION_KERNEL).toContain('insideRun=false;');expect(PRODUCTION_KERNEL).not.toContain('normalize(gridDirection)');
});
it('P2 visible SOURCE/CPU negative fault: reverting rejected exit to whole-volume discard fails the actual owner witness (NOT NATIVE)',()=>{
  const v=row([1,0,1]);later(productionCpu(v,origin,direction,true));
  const fault=PRODUCTION_KERNEL.replace('insideRun=false;','return h;');expect(fault).not.toBe(PRODUCTION_KERNEL);
  expect(()=>later(productionCpu(v,origin,direction,true,fault))).toThrow();
});

const assetRoot=new URL('http://rd13-repair.local/');const fixtureRoot=new URL('../../fixtures/',import.meta.url);
const fetchLocal:typeof fetch=async(input)=>new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1),fixtureRoot)));
async function fixtures() {const inventory=await loadInventory(assetRoot,fetchLocal);return Promise.all(['F06-MATERIAL','F06-MATERIAL-R1'].map((id)=>loadFixture(inventory.fixtures.find((f)=>f.id===id)!,assetRoot,fetchLocal)));}
function facts(fixture:LabFixtureV1):LabExperimentFacts {return {experimentId:'RD-13',variantId:'rays-no-ao',backend:'CPU ownership mock; NOT NATIVE',
  fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),liveResources:{},logicalCosts:{},unsupportedFeatures:['native-not-run'],errors:['prepared-source warning']};}
async function mounted(failReplacement=false,invalidAdoption=false) {
  const [r0,r1]=await fixtures();let current=r0;let terminal!:ReturnType<typeof wrapTerminalHost>;
  const canvas={hidden:false,dispatchEvent:vi.fn()} as unknown as HTMLCanvasElement;const retire=vi.fn();const disposed=vi.fn(async()=>{});
  const reads: {digest:string;pending:boolean|undefined}[]=[];
  const base:LabExperimentHandle={setFrame:vi.fn(),dispose:disposed,async replaceFixture(next) {if (failReplacement) {throw new Error('CONTROLLED candidate failure');}current=next;},
    readFacts() {reads.push({digest:getFixtureDigest(current),pending:terminal?.readPrivateDiagnostics().pending});return facts(invalidAdoption?r0:current);}};
  const count=registeredMountCount();const outer=await mountExperiment(async()=>terminal=wrapTerminalHost(base,retire,canvas),
    {fixture:r0,canvas,preset:{id:'rays-no-ao'},capabilities:{},signal:new AbortController().signal});
  return {r0,r1,outer,terminal,canvas,retire,disposed,reads,count};
}
it('P2 real wrapper + outer mount: adopted R1 remains typed/readable after R1 driver fault without any intervening facts read',async()=>{
  const m=await mounted();try {
    await m.outer.replaceFixture(m.r1);await m.terminal.terminate('CONTROLLED first R1 driver error');
    const result=m.outer.readFacts();expect(result.fixtureDigest).toBe(getFixtureDigest(m.r1));expect(result.sourceRevision).toBe(fixtureRevision(m.r1));
    expect(result.errors).toEqual(['prepared-source warning','CONTROLLED first R1 driver error']);
    expect(m.reads).toEqual([{digest:getFixtureDigest(m.r0),pending:undefined},{digest:getFixtureDigest(m.r1),pending:true}]);
    expect(m.canvas.hidden).toBe(true);expect(m.disposed).toHaveBeenCalledOnce();
    await m.terminal.terminate('SECOND error must not replace first');expect(m.outer.readFacts().errors).not.toContain('SECOND error must not replace first');
    expect(m.terminal.readPrivateDiagnostics()).toMatchObject({disposed:true,pending:false,firstFailure:'CONTROLLED first R1 driver error'});
  } finally {await m.outer.dispose();expect(registeredMountCount()).toBe(m.count);}
});
it('P2 real wrapper + outer mount: failed replacement retains previous R0 facts and first candidate error',async()=>{
  const m=await mounted(true);try {
    await expect(m.outer.replaceFixture(m.r1)).rejects.toThrow('CONTROLLED candidate failure');const result=m.outer.readFacts();
    expect(result.fixtureDigest).toBe(getFixtureDigest(m.r0));expect(result.sourceRevision).toBe(fixtureRevision(m.r0));expect(result.errors.join(' ')).toContain('CONTROLLED candidate failure');
    expect(m.reads).toHaveLength(1);expect(m.canvas.hidden).toBe(true);expect(m.disposed).toHaveBeenCalledOnce();
  } finally {await m.outer.dispose();expect(registeredMountCount()).toBe(m.count);}
});
it('P2 real wrapper + outer mount: invalid adopted source facts fail before unlock and preserve previous valid snapshot',async()=>{
  const m=await mounted(false,true);try {
    await expect(m.outer.replaceFixture(m.r1)).rejects.toThrow(/adopted|bound|fixture/i);
    const result=m.outer.readFacts();expect(result.fixtureDigest).toBe(getFixtureDigest(m.r0));expect(result.errors.join(' ')).toMatch(/adopted|bound|fixture/i);
    expect(m.reads[1].pending).toBe(true);expect(m.canvas.hidden).toBe(true);expect(m.disposed).toHaveBeenCalledOnce();
  } finally {await m.outer.dispose();expect(registeredMountCount()).toBe(m.count);}
});
