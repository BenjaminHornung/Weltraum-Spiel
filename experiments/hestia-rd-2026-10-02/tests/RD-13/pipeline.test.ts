import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Group, PerspectiveCamera, Scene, ShaderChunk, ShaderMaterial, Vector3 } from 'three';
import { loadInventory, loadFixture } from '../../src/runner/assets';
import { copyFixturePayload, getFixtureDigest, type LabFixtureV1 } from '../../src/contracts/fixture';
import { createVoxelRayExperiment, type VoxelRayHost } from '../../src/experiments/voxel-rays';
import { VISIBLE_FRAGMENT } from '../../src/experiments/voxel-rays/ray';
import { traceOracle } from '../../src/experiments/voxel-rays/ray';
import { nativeCases } from './native-cases';
import { nativeMismatches } from '../../src/experiments/voxel-rays/qualification';
import { admitProjection, loadRayRecipe, prepareVolumes } from '../../src/experiments/voxel-rays/volume';

const captures=vi.hoisted(()=>({roots:[] as Group[],disposals:0}));
vi.mock('../../src/runner/threeHost',async()=>{
  const original=await vi.importActual<typeof import('../../src/runner/threeHost')>('../../src/runner/threeHost');
  return {...original,async createThreeLabHost(context:any,effects:any[]) {
    let fixture=context.fixture; let mounted:any; let root:Group; let disposed=false;
    async function mount(next:LabFixtureV1) {
      root=new Group(); captures.roots.push(root);
      const effect=await effects[0].mount({scene:new Scene(),camera:new PerspectiveCamera(),root,fixture:next,signal:context.signal,
        capabilities:{},frame:null,resetTick:null,ownerPose:(id:string)=>original.ownerPose(next,id)});
      return effect;
    }
    mounted=await mount(fixture);
    return {setFrame:(frame:any)=>mounted.setFrame(frame),async replaceFixture(next:LabFixtureV1) {
      const old=mounted; const candidate=await mount(next); await old.dispose(); mounted=candidate;fixture=next;
    },readFacts:()=>mounted.readFacts(),readDiagnostics:()=>({fixtureDigest:getFixtureDigest(fixture),nativeExecuted:false}),resize:vi.fn(),setResetTick:vi.fn(),
      async dispose() {if (!disposed) {disposed=true;captures.disposals+=1;await mounted.dispose();}},readCleanup:()=>({disposed})};
  }};
});
// This is a CPU projection/host mock, NOT a WebGL context or native compiler.
class MockCanvas extends EventTarget {
  hidden=false;
  constructor(readonly gl:ReturnType<typeof mockGl>) {super();}
  getContext(type:string,options:unknown) {expect(type).toBe('webgl2');expect(options).toEqual({antialias:true,alpha:false,powerPreference:'high-performance'});return this.gl;}
}
function mockGl() {
  return {RENDERBUFFER:1,RGBA8UI:0x8d7c,RGBA_INTEGER:0x8d99,UNSIGNED_BYTE:0x1401,SAMPLES:2,MAX_VIEWPORT_DIMS:3,
    MAX_3D_TEXTURE_SIZE:4,MAX_TEXTURE_SIZE:5,MAX_TEXTURE_IMAGE_UNITS:6,NO_ERROR:0,
    getInternalformatParameter:vi.fn(()=>new Int32Array()),getParameter:(name:number)=>name===3?new Int32Array([8192,8192]):name===4?2048:name===5?8192:16,
    getError:vi.fn(()=>0),isContextLost:()=>false};
}
const root=new URL('http://rd13.local/'); const fixtureRoot=new URL('../../fixtures/',import.meta.url);
const fetchLocal:typeof fetch=async(input)=>new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1),fixtureRoot)));
const inventory=loadInventory(root,fetchLocal); const fixtures=new Map<string,Promise<LabFixtureV1>>();
function source(id:string) {if (!fixtures.has(id)) {fixtures.set(id,inventory.then((i)=>loadFixture(i.fixtures.find((f)=>f.id===id)!,root,fetchLocal)));}return fixtures.get(id)!;}
const owned:VoxelRayHost[]=[];
async function candidate(id:string,variant='rays-no-ao',gl=mockGl()) {
  const canvas=new MockCanvas(gl);const fixture=await source(id);
  const host=await createVoxelRayExperiment({canvas:canvas as unknown as HTMLCanvasElement,fixture,preset:{id:variant},signal:new AbortController().signal,capabilities:{}}) as VoxelRayHost;
  owned.push(host);return {host,canvas,fixture,gl};
}
beforeEach(()=>{captures.roots=[];captures.disposals=0;vi.stubGlobal('window',{location:{href:root.href}});vi.stubGlobal('fetch',fetchLocal);});
afterEach(async()=>{for (const host of owned.splice(0)) {await host.dispose();}vi.unstubAllGlobals();});

it('CPU mock factory constructs actual dense integer texture/fullscreen triangle, not source solid meshes (NOT NATIVE)',async()=>{
  const {host,gl}=await candidate('F00-CONTROL');const projection=captures.roots[0].children[0] as Group;
  const ray=projection.children.find((m)=>m.name==='RD13:control-cells') as any;
  expect(Array.from(ray.geometry.getAttribute('position').array)).toEqual([-1,-1,0,3,-1,0,-1,3,0]);
  expect(ray.material).toBeInstanceOf(ShaderMaterial);expect(ray.material.uniforms.voxelData.value.internalFormat).toBe('RGBA8UI');
  expect(ray.material.uniforms.voxelData.value.image.data).toEqual(host.readVolumesForQualification()[0].packed);
  expect(host.readFacts().experimentId).toBe('RD-13');expect(host.readFacts().variantId).toBe('rays-no-ao');
  expect(gl.getInternalformatParameter).toHaveBeenCalledWith(gl.RENDERBUFFER,gl.RGBA8UI,gl.SAMPLES);
});
it('CPU mock factory mounts actual selected-F01 greedy rectangles plus original water, no voxel textures or duplicated solids (NOT NATIVE)',async()=>{
  const {host,fixture}=await candidate('F01-HVP-COAST','greedy-no-ao');const projection=captures.roots[0].children[0] as Group;
  const solid=projection.children.find((m)=>m.name==='RD13:coast-crop') as any;
  const water=projection.children.find((m)=>m.name==='RD13:presentation:hvp:water') as any;
  expect(solid.geometry.index.count).toBeGreaterThan(36);expect(solid.geometry.groups.length).toBe(4);expect(solid.material[2].color.r).toBe(fixture.materials.find((m)=>m.id==='hvp-soil')!.colorLinearRgb[0]);
  expect(water.material.opacity).toBe(.55);expect(water.material.depthWrite).toBe(false);expect(water.renderOrder).toBe(1);
  expect(host.readFacts().liveResources.textures).toMatchObject({value:0});expect(host.readFacts().unsupportedFeatures).toContain('selected-f01-not-full-parity');
});
it('CPU mock factory preserves original nonvoxel Float64 marker through checked Float32 projection (NOT NATIVE)',async()=>{
  const {fixture}=await candidate('F05-CUTOUT');const object=fixture.objects.find((o)=>o.ownerId==='figure-marker')!;
  const original=copyFixturePayload(fixture,object.meshes[0].positions);expect(original).toBeInstanceOf(Float64Array);
  const projection=captures.roots[0].children[0] as Group;const marker=projection.children.find((m)=>m.name==='RD13:presentation:figure-marker') as any;
  const ys=Array.from(marker.geometry.attributes.position.array as Float32Array).filter((_,i)=>i%3===1);
  expect(Math.abs(Math.max(...ys)-Math.min(...ys)-1.8)).toBeLessThanOrEqual(1e-5);expect(marker.position.toArray()).toEqual([1.125,.25,2]);
  expect(copyFixturePayload(fixture,object.meshes[0].positions)).toEqual(original);
});
it('CPU mock actual factory retires old roots synchronously; failed replacement disposes and preserves FIRST cause (NOT NATIVE)',async()=>{
  const {host,canvas}=await candidate('F00-CONTROL');const old=captures.roots[0].children[0] as Group;
  canvas.dispatchEvent(new CustomEvent('three-lab-rendered'));expect(canvas.hidden).toBe(false);
  const next=await source('F00-CONTROL');const work=host.rejectReplacementForQualification(next,'format');expect(old.visible).toBe(false);expect(canvas.hidden).toBe(true);
  await expect(work).rejects.toThrow(/RGBA8UI|format/i);expect(captures.disposals).toBe(1);expect(old.children).toHaveLength(0);
  expect(captures.roots[1].children).toHaveLength(0);
  const first=host.readPrivateDiagnostics().firstFailure;await host.terminate('SECOND synthetic cause');expect(host.readPrivateDiagnostics().firstFailure).toBe(first);
});
it('CPU mock format/dimension failure constructs zero owned projection objects (NOT NATIVE)',async()=>{
  const gl=mockGl();gl.RGBA8UI=0;await expect(candidate('F00-CONTROL','rays-no-ao',gl)).rejects.toThrow(/RGBA8UI|format/i);
  expect(captures.roots).toHaveLength(1);expect(captures.roots[0].children).toHaveLength(0);
});
it('CPU mock post-allocation driver fault is terminal cleanup, not pre-allocation success (NOT NATIVE)',async()=>{
  const {host,canvas,gl}=await candidate('F00-CONTROL');const projection=captures.roots[0].children[0] as Group;const mesh=projection.children[0] as any;
  gl.getError.mockReturnValue(1282);expect(()=>mesh.onAfterRender()).toThrow('after allocation');
  canvas.dispatchEvent(new CustomEvent('three-lab-error',{detail:'CONTROLLED post-allocation GL 1282'}));
  await host.dispose();expect(canvas.hidden).toBe(true);expect(projection.children).toHaveLength(0);expect(host.readPrivateDiagnostics().firstFailure).toContain('CONTROLLED post-allocation');
});
it('CPU mock failed native program link with NO GL error is terminal and retains first prepared-source failure (NOT NATIVE)',async()=>{
  const {host,canvas,gl}=await candidate('F00-CONTROL');const projection=captures.roots[0].children[0] as Group;const mesh=projection.children[0] as any;
  Object.assign(gl,{LINK_STATUS:7,getProgramParameter:()=>false,getProgramInfoLog:()=>'CONTROLLED link failure; NOT NATIVE'});
  const renderer={properties:{get:()=>({currentProgram:{program:{}}})}};
  expect(gl.getError()).toBe(0);expect(()=>mesh.onAfterRender(renderer,null,null,mesh.geometry,mesh.material)).toThrow('link failure AFTER allocation');
  canvas.dispatchEvent(new CustomEvent('three-lab-error',{detail:'CONTROLLED link failure; NOT NATIVE'}));await host.dispose();
  expect(canvas.hidden).toBe(true);expect(projection.children).toHaveLength(0);expect(host.readFacts().errors).toContain('CONTROLLED link failure; NOT NATIVE');
});
it('CPU numeric comparison rejects NaN / infinity without a tolerance false PASS; NOT NATIVE',()=>{
  const c=nativeCases[0];const expected=traceOracle(c.volume,c.origin,c.direction);
  const observed={positionT:[...expected.point!,expected.t!],normalSlot:[...expected.normal!,expected.slot!],
    originalCellStatus:[...expected.originalCell!,1],uncertainty:[Number(expected.unknownTraversed),1,0,1],attachmentDepth:.5};
  expect(nativeMismatches(expected,observed,.5)).toEqual([]);
  expect(nativeMismatches(expected,{...observed,positionT:[NaN,0,0,NaN]},.5)).toContain('non-finite native attachment readback');
  expect(nativeMismatches(expected,{...observed,attachmentDepth:Infinity},.5)).toContain('non-finite native attachment readback');
  expect(nativeMismatches(expected,{...observed,attachmentDepth:0},.5)).toContain('actual attachment depth (not recomputed CPU output)');
  const miss={status:'miss' as const,unknownTraversed:false,outsideUnknown:true as const};
  expect(nativeMismatches(miss,{positionT:[0,0,0,0],normalSlot:[0,0,0,0],originalCellStatus:[-1,-1,-1,0],uncertainty:[0,1,0,1],attachmentDepth:0},1))
    .toContain('actual attachment depth (not recomputed CPU output)');
});
it('CPU proves authored original-F01 camera, edited-F06 and inside-F04 native probe inputs are real source hits, not empty control samples; NOT NATIVE',async()=>{
  async function volumes(id:string) {
    const f=await source(id);const recipe=await loadRayRecipe(f,root,fetchLocal);
    const caps={max3D:2048,maxTexture:8192,maxViewport:[8192,8192] as const,fragmentSamplers:16,rgba8ui:true,contextLost:false};
    return prepareVolumes(f,recipe,admitProjection(f,recipe,caps));
  }
  const coast=(await volumes('F01-HVP-COAST'))[0];const d=new Vector3(3,-1.75,4).normalize().toArray() as [number,number,number];
  expect(traceOracle(coast,[-2,1.25,-6],d).status).toBe('hit');
  const old=(await volumes('F06-MATERIAL'))[0];const current=(await volumes('F06-MATERIAL-R1'))[0];
  const i=old.slots.findIndex((slot,index)=>slot!==0&&current.slots[index]===0);const [sx,sy]=current.dimensions;
  const point=new Vector3(i%sx+.5,Math.floor(i/sx)%sy+.5,Math.floor(i/(sx*sy))+.5).applyMatrix4(current.worldFromGrid);
  const direction=new Vector3(0,-1,0).transformDirection(current.worldFromGrid);const origin=point.addScaledVector(direction,-5).toArray() as [number,number,number];
  const before=traceOracle(old,origin,direction.toArray() as [number,number,number]);const after=traceOracle(current,origin,direction.toArray() as [number,number,number]);
  expect(before.status).toBe('hit');expect(after.status).toBe('hit');expect(after.t!).toBeGreaterThan(before.t!);
  const wood=(await volumes('F04-DETACH-R2')).find((v)=>v.source.regionId==='fragment-wood')!;
  expect(traceOracle(wood,[.9375,1.0625,.3125],[0,1,0]).t).toBeGreaterThan(0);
});
it('native probe inputs have independent analytical hits/misses/Unknown including exact boundary and ties; NOT NATIVE',()=>{
  const results=nativeCases.map((c)=>({id:c.id,result:traceOracle(c.volume,c.origin,c.direction)}));
  expect(results).toHaveLength(12);expect(results.filter((r)=>r.result.status==='miss')).toHaveLength(3);
  expect(results.find((r)=>r.id==='inside-contiguous-run')!.result.t).toBe(1.5);
  expect(results.find((r)=>r.id==='exit-at-unknown-face')!.result.unknownTraversed).toBe(true);
  expect(results.find((r)=>r.id==='all-three-tied-axes')!.result.cell).toEqual([1,1,1]);
});
it('CPU shader-chunk assembly only (NOT GLSL native compilation): GLSL3 output/depth/camera and hit-space light/fog bindings exist',()=>{
  let shader=VISIBLE_FRAGMENT;
  for (let n=0;n<32 && shader.includes('#include');n+=1) {shader=shader.replace(/#include <([\w]+)>/g,(_m,name:string)=>{const chunk=ShaderChunk[name as keyof typeof ShaderChunk];expect(chunk,`Missing Three chunk ${name}`).toBeTypeOf('string');return chunk;});}
  expect(shader).not.toContain('#include');expect(shader).toContain('layout(location=0) out vec4 rayColor');expect(shader).toContain('uniform mat4 projectionMatrix');
  expect(shader).toContain('projectionMatrix*viewHit');expect(shader).toContain('gl_FragDepth=hitDepth');expect(shader).toContain('getHemisphereLightIrradiance');expect(shader).toContain('-viewHit.z');
});
