import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { importFixture, copyFixturePayload, getFixtureDigest, type LabFixtureV1 } from '../../src/contracts/fixture';
import { createFrameInput, type LabExperimentHandle } from '../../src/contracts/experiment';
import { loadFixture, loadInventory } from '../../src/runner/assets';
import { ownerPose } from '../../src/runner/threeHost';
import { sha256 } from '../../src/contracts/validation';
import { loadRayRecipe, admitProjection, prepareVolumes, buildGreedy, F01_SELECTION, type RayVolume } from '../../src/experiments/voxel-rays/volume';
import { traceOracle, hitDepth, PRODUCTION_KERNEL } from '../../src/experiments/voxel-rays/ray';
import { wrapTerminalHost } from '../../src/experiments/voxel-rays';

const root = new URL('http://127.0.0.1:5280/');
const fixtureRoot = new URL('../../fixtures/', import.meta.url);
const localFetch: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), fixtureRoot)));
const caps = { max3D: 2048, maxTexture: 8192, maxViewport: [8192,8192] as const, fragmentSamplers: 16, rgba8ui: true, contextLost: false };
const inventory = loadInventory(root, localFetch);
const fixtures = new Map<string, Promise<LabFixtureV1>>();
async function source(id: string) {
  if (!fixtures.has(id)) {
    fixtures.set(id, inventory.then((i) => loadFixture(i.fixtures.find((e) => e.id === id)!, root, localFetch)));
  }
  const fixture = await fixtures.get(id)!;
  const recipe = await loadRayRecipe(fixture, root, localFetch);
  return { fixture, recipe, volumes: prepareVolumes(fixture, recipe, admitProjection(fixture, recipe, caps)) };
}
function tiny(slots: number[], dims: [number,number,number] = [slots.length,1,1], coverage = slots.map(()=>1)): RayVolume {
  return { dimensions:dims, offset:[0,0,0], originMeters:[0,0,0], quantumMeters:1, slots:Uint8Array.from(slots),
    coverage:Uint8Array.from(coverage), packed:new Uint8Array(slots.length*4), worldFromGrid:new Matrix4(), gridFromWorld:new Matrix4(),
    materialIds:['dry','wet','wood'], materials:[], source:{ownerId:'tiny',sourceNamespace:'test-only',sourceRevision:0,regionId:'tiny',
      fixtureDigest:'0'.repeat(64),recipeSha256:'1'.repeat(64),sourceIds:[],sourceIdMeaning:{},originalDimensions:dims,originalOriginMeters:[0,0,0]},
    sourceSlotSha256:'2'.repeat(64) };
}
function hit(volume: RayVolume, origin: [number,number,number], direction: [number,number,number]) {
  const result = traceOracle(volume, origin, direction); expect(result.status).toBe('hit'); return result;
}

it('RAY01: unabhängiges CPU-DDA-Oracle für Randtreffer, negative Richtung, Nullkomponente, innen startenden Strahl und Unknown', () => {
  const v = tiny([1,1,0,2]);
  expect(hit(v,[-1,0.5,0.5],[1,0,0])).toMatchObject({t:1,point:[0,0.5,0.5],normal:[-1,0,0],slot:1,cell:[0,0,0]});
  expect(hit(v,[5,0.5,0.5],[-1,0,0])).toMatchObject({t:1,point:[4,0.5,0.5],normal:[1,0,0],slot:2,cell:[3,0,0]});
  expect(hit(v,[0.5,0.5,0.5],[1,0,0])).toMatchObject({t:1.5,point:[2,0.5,0.5],normal:[1,0,0],cell:[1,0,0]});
  expect(hit(v,[1,0.5,0.5],[-1,0,0])).toMatchObject({t:1,point:[0,0.5,0.5],normal:[-1,0,0]});
  expect(hit(v,[-0.25,0.5,0.5],[1,0,0]).t).toBe(0.25);
  expect(hit(v,[2.5,0.5,0.5],[-1,0,0]).t).toBe(0.5);
  expect(traceOracle(v,[-1,1,0.5],[1,0,0]).status).toBe('miss');
  expect(traceOracle(v,[-1,2,0.5],[1,0,0]).status).toBe('miss');
  const unknown = tiny([0,0,1],[3,1,1],[1,0,1]);
  expect(hit(unknown,[0.5,0.5,0.5],[1,0,0])).toMatchObject({t:1.5,unknownTraversed:true,outsideUnknown:true});
  expect(traceOracle(tiny([0,0],[2,1,1],[1,0]),[0.5,0.5,0.5],[1,0,0])).toMatchObject({status:'miss',unknownTraversed:true,outsideUnknown:true});
  expect(() => traceOracle(v,[0,0,0],[0,0,0])).toThrow(/unit|direction/i);
});
it('RAY01: tied corners skip zero-length intermediate cells; first cell and hollow exit', () => {
  const d = 1/Math.sqrt(3);
  const v = tiny([0,1,1,0,1,0,0,2],[2,2,2]);
  expect(hit(v,[-1,-1,-1],[d,d,d])).toMatchObject({slot:2,cell:[1,1,1],normal:[-1,0,0]});
  expect(hit(v,[-1,-1,-1],[d,d,d]).t).toBeCloseTo(2*Math.sqrt(3),9);
  expect(hit(tiny([1,0,1]),[1.5,0.5,0.5],[1,0,0])).toMatchObject({t:0.5,normal:[-1,0,0],cell:[2,0,0]});
  expect(hit(tiny([1,2]),[0.5,0.5,0.5],[1,0,0])).toMatchObject({t:1.5,slot:2,normal:[1,0,0]});
});
it('RAY02: Position/Depth/Material/Normal nach Edit stimmt mit belegter Quelle; keine geglättete SDF-Oberfläche', async () => {
  const before = await source('F06-MATERIAL'); const after = await source('F06-MATERIAL-R1');
  const a = before.volumes[0]; const b = after.volumes[0];
  const removed = a.slots.findIndex((slot,index)=>slot!==0 && b.slots[index]===0); expect(removed).toBeGreaterThanOrEqual(0);
  const [sx,sy] = a.dimensions; const cell = [removed%sx,Math.floor(removed/sx)%sy,Math.floor(removed/(sx*sy))];
  const p = new Vector3(...a.originMeters).add(new Vector3(...cell).addScalar(0.5).multiplyScalar(a.quantumMeters));
  const o = p.clone().add(new Vector3(0,5,0)).toArray() as [number,number,number];
  const h0 = hit(a,o,[0,-1,0]); const h1 = traceOracle(b,o,[0,-1,0]);
  expect(h0.materialId).toBe(a.materialIds[h0.slot!-1]); expect(h0.normal).toEqual([0,1,0]);
  expect(h1.status !== 'hit' || h1.t! > h0.t!).toBe(true);
  const camera = new PerspectiveCamera(55,16/9,0.01,2000); camera.position.set(...o); camera.up.set(0,0,-1); camera.lookAt(p); camera.updateMatrixWorld();
  const expected = new Vector3(...h0.point!).project(camera).z*0.5+0.5;
  expect(hitDepth(h0.point!,camera)).toBeCloseTo(expected,12);
  expect(getFixtureDigest(before.fixture)).not.toBe(getFixtureDigest(after.fixture));
});
it('RAY02: actual greedy rectangles preserve original material ordering and occupancy', async () => {
  const v = tiny([1,1,1,1],[2,2,1]); const mesh = buildGreedy(v);
  expect(mesh.faceCount).toBe(6); expect(mesh.unitFaceCount).toBe(16); expect(mesh.colors).toBeNull();
  expect(mesh.materialRanges.every((r)=>r.slot===1)).toBe(true);
  const f = await source('F00-CONTROL'); expect(f.volumes[0].materialIds[0]).toBe('dry');
  expect(f.fixture.materials[0].id).toBe('accent');
  expect(f.volumes[0].slots.every((n,index)=>n===0 || f.volumes[0].coverage[index]===1)).toBe(true);
});
it('RAY03: Transform eines lokalen Volumens ändert keine Source-ID; Kamera im Volumen und Überhang korrekt', async () => {
  const r0 = await source('F04-DETACH'); const r1 = await source('F04-DETACH-R1'); const r2 = await source('F04-DETACH-R2');
  const a = r1.volumes.find((v)=>v.source.regionId==='fragment-wood')!; const b = r2.volumes.find((v)=>v.source.regionId==='fragment-wood')!;
  expect(r0.volumes.find((v)=>v.source.regionId==='fragment-wood')!.source.ownerId).not.toBe(a.source.ownerId);
  expect(b.source.ownerId).toBe(a.source.ownerId); expect(b.source.sourceIds).toEqual(a.source.sourceIds);
  expect(b.source.sourceIdMeaning).toEqual(a.source.sourceIdMeaning); expect([...b.slots]).toEqual([...a.slots]);
  const i = a.slots.findIndex((n)=>n!==0); const [sx,sy] = a.dimensions;
  const local = new Vector3(i%sx+0.5,Math.floor(i/sx)%sy+0.5,Math.floor(i/(sx*sy))+0.5);
  const normal = new Vector3(1,0,0).transformDirection(b.worldFromGrid);
  const h = hit(b,local.clone().applyMatrix4(b.worldFromGrid).toArray() as [number,number,number],normal.toArray() as [number,number,number]);
  expect(h.t).toBeGreaterThan(0); expect(h.sourceIds).toContain('branch:wood/0/0/0');
  expect(h.normal![1]).toBeCloseTo(1,9); expect(h.normal![0]).toBeCloseTo(0,9);
  expect(ownerPose(r2.fixture,b.source.ownerId)?.originMeters).toEqual([1,1,0.25]);
});
it('RAY03: partial removal, retained removal, separate removable roof and real X39 Unknown', async () => {
  const r3 = await source('F04-DETACH-R3'); const r4 = await source('F04-DETACH-R4');
  expect(r3.volumes.some((v)=>v.source.regionId==='fragment-leaf')).toBe(false);
  expect(r4.volumes.some((v)=>v.source.regionId==='fragment-leaf')).toBe(false);
  expect([...r4.volumes.find((v)=>v.source.regionId==='fragment-wood')!.slots]).toEqual([...r3.volumes.find((v)=>v.source.regionId==='fragment-wood')!.slots]);
  const before = await source('F03-SHELTER'); const after = await source('F03-SHELTER-R1');
  const shell = before.volumes.find((v)=>v.source.regionId==='shelter-shell')!;
  expect(shell.dimensions).toEqual([40,32,32]); expect(shell.coverage[39]).toBe(0);
  expect(before.volumes.some((v)=>v.source.regionId==='removable-roof-cells')).toBe(true);
  expect(after.volumes.some((v)=>v.source.regionId==='removable-roof-cells')).toBe(false);
  const roof = before.volumes.find((v)=>v.source.regionId==='removable-roof-cells')!;
  expect(hit(roof,[2.0625,1,0.4375],[0,1,0])).toMatchObject({point:[2.0625,1.5,0.4375],normal:[0,-1,0]});
});
it('RAY03: exact canonical Float64 1.8 m marker survives unchanged, not quantum-rounded', async () => {
  const f = await source('F05-CUTOUT'); const marker = f.fixture.objects.find((o)=>o.ownerId==='figure-marker')!;
  const positions = copyFixturePayload(f.fixture,marker.meshes[0].positions); expect(positions).toBeInstanceOf(Float64Array);
  const ys = [...positions].filter((_,i)=>i%3===1); expect(Math.max(...ys)-Math.min(...ys)).toBe(1.8);
  expect(marker.frame.originMeters).toEqual([1.125,0.25,2]); expect(f.volumes.some((v)=>v.source.ownerId==='figure-marker')).toBe(false);
});
it('RAY04: GPU-Formatlimit oder Uploadüberlauf scheitert vor Allokation; alte Volumenversion wird nicht weitergezeichnet', async () => {
  const f = await source('F00-CONTROL');
  expect(()=>admitProjection(f.fixture,f.recipe,{...caps,rgba8ui:false})).toThrow(/format|RGBA8UI/i);
  expect(()=>admitProjection(f.fixture,f.recipe,{...caps,max3D:16})).toThrow(/limit|dimension/i);
  expect(()=>admitProjection(f.fixture,f.recipe,caps,{cpuBytes:Number.MAX_SAFE_INTEGER,projectionBytes:Number.MAX_SAFE_INTEGER})).toThrow(/budget|overflow|safe/i);
  let reject!: (e: Error)=>void; const pending = new Promise<void>((_,r)=>{reject=r;});
  const retire = vi.fn(); const dispose = vi.fn(async()=>{});
  const base = {replaceFixture:vi.fn(()=>pending),dispose,setFrame:vi.fn(),readFacts:vi.fn()} as unknown as LabExperimentHandle;
  const canvas = {hidden:false,dispatchEvent:vi.fn()} as unknown as HTMLCanvasElement;
  const host = wrapTerminalHost(base,retire,canvas); const replacement = host.replaceFixture(f.fixture);
  expect(retire).toHaveBeenCalledOnce(); expect(canvas.hidden).toBe(true);
  reject(new Error('CONTROLLED upload rejected')); await expect(replacement).rejects.toThrow('CONTROLLED upload rejected');
  expect(dispose).toHaveBeenCalledOnce(); expect(()=>host.setFrame({} as any)).toThrow('CONTROLLED upload rejected');
  expect(host.readPrivateDiagnostics().firstFailure).toContain('CONTROLLED upload rejected');
  await expect(host.replaceFixture(f.fixture)).rejects.toThrow('CONTROLLED upload rejected');
});
it('RAY04: bounded recipe resolver rejects wrong source and never sorts slots', async () => {
  const f = await source('F00-CONTROL'); let calls = 0;
  const corrupted: typeof fetch = async (input) => { calls+=1; const r = await localFetch(input);
    if (String(input).endsWith('recipe.json')) { return new Response((await r.text()).replace('"fixtureId":"F00-CONTROL"','"fixtureId":"F00-OTHER"')); }
    return r; };
  await expect(loadRayRecipe(f.fixture,root,corrupted)).rejects.toThrow(/hash|SHA|digest/i); expect(calls).toBe(2);
});
it('RAY04: exact slot/coverage/addressing and <=64 axis admission reject, never truncate', async () => {
  const f = await source('F00-CONTROL');
  const raw = JSON.parse(readFileSync(new URL('F00-CONTROL/manifest.json',fixtureRoot),'utf8'));
  const bytes = new Map<string,Uint8Array<ArrayBuffer>>();
  for (const p of raw.payloads) { bytes.set(p.id,new Uint8Array(readFileSync(new URL(`F00-CONTROL/${p.path}`,fixtureRoot)))); }
  const slots = raw.payloads.find((p:any)=>p.id==='control-cells-material-slots'); const data = bytes.get(slots.id)!;
  data[data.findIndex((n)=>n!==0)]=8; slots.sha256=await sha256(data);
  const changed = await importFixture(new TextEncoder().encode(JSON.stringify(raw)),bytes);
  const bound = {...f.recipe,fixtureDigest:getFixtureDigest(changed)};
  expect(()=>prepareVolumes(changed,bound,admitProjection(changed,bound,caps))).toThrow(/slot|material/i);
  const malformed = {...f.recipe,regions:f.recipe.regions.map((r:any)=>({...r,materialIds:['not-a-material']}))};
  expect(()=>admitProjection(f.fixture,malformed,caps)).toThrow(/material/i);
});
it('RAY04: selected F01 window is frozen, outside Unknown, same greedy/ray input; full F01 refused', async () => {
  const f = await source('F01-HVP-COAST'); expect(f.volumes).toHaveLength(1);
  const v = f.volumes[0]; expect(v.dimensions).toEqual([64,64,64]); expect(v.offset).toEqual([32,0,16]);
  expect(v.originMeters).toEqual([-4,-2,-6]); expect(F01_SELECTION.upper).toEqual([96,64,80]);
  expect(v.materialIds).toEqual(['hvp-limestone-dry','hvp-limestone-wet','hvp-soil','hvp-moss']);
  expect(v.source.originalDimensions).toEqual([192,80,192]); expect(v.packed.byteLength).toBe(64**3*4);
  expect(()=>admitProjection(f.fixture,f.recipe,caps,undefined,{fullF01:true})).toThrow(/64|limit|dimension/i);
  const mesh = buildGreedy(v); expect(mesh.faceCount).toBeGreaterThan(0); expect(mesh.sourceDigest).toBe(v.source.fixtureDigest);
});
it('RAY04: GLSL is production integer texture DDA, first-cell/ties/overflow/depth authored, NOT NATIVE proof', () => {
  expect(PRODUCTION_KERNEL).toContain('usampler3D'); expect(PRODUCTION_KERNEL).toContain('texelFetch');
  expect(PRODUCTION_KERNEL).toContain('traversalFault'); expect(PRODUCTION_KERNEL).not.toContain('normalize(gridDirection)');
});
