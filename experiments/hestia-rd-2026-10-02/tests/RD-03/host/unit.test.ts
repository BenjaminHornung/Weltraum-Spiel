import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createThreeLabHost, liveThreeHostCounts, type ThreeLabEffectContext } from '../../../src/runner/threeHost';
import { mountThreeEffect } from '../../../src/experiments/three-control';
import { loadInventory, loadReplay } from '../../../src/runner/assets';
import { getFixtureDigest } from '../../../src/contracts/fixture';
import { createFrameInput, type LabExperimentContext } from '../../../src/contracts/experiment';

// CPU lifecycle oracle only. No fake renderer count is offered as real WebGL/browser evidence.
vi.mock('three', async (original) => {
  const three = await original<typeof import('three')>();
  return { ...three, WebGLRenderer: class {
    capabilities = { isWebGL2: true, maxTextureSize: 8192 }; shadowMap = { enabled: false };
    info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0, triangles: 0 } };
    outputColorSpace = ''; toneMapping = 0; toneMappingExposure = 1;
    size = new three.Vector2(); ratio = 1;
    getSize(out: InstanceType<typeof three.Vector2>) { return out.copy(this.size); }
    getDrawingBufferSize(out: InstanceType<typeof three.Vector2>) { return out.copy(this.size).multiplyScalar(this.ratio); }
    getPixelRatio() { return this.ratio; }
    setPixelRatio(value: number) { this.ratio = value; }
    setSize(width: number, height: number) { this.size.set(width, height); }
    render() {} dispose() {} forceContextLoss() {}
  } };
});

async function context(): Promise<{ context: LabExperimentContext; replay: Awaited<ReturnType<typeof loadReplay>> }> {
  const root = new URL('http://127.0.0.1:5280/');
  const fetcher: typeof fetch = async (input) => new Response(readFileSync(new URL(`../../../fixtures/${new URL(String(input)).pathname.slice(1)}`, import.meta.url)));
  const replay = await loadReplay(await loadInventory(root, fetcher), 'F04-DETACH-REPLAY', root, fetcher);
  const canvas = Object.assign(new EventTarget(), { getContext: () => ({ getExtension: () => null, isContextLost: () => false }) }) as unknown as HTMLCanvasElement;
  return { context: { canvas, fixture: replay.initialFixture, preset: { id: 'fixture-control' }, signal: new AbortController().signal, capabilities: {} }, replay };
}

it('RUN02 host atomically adopts all detached effects; thrown/late aborted candidates never publish (CPU oracle)', async () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const data = await context(); const next = data.replay.scenario.snapshots[0].manifest;
  let fail = false; let delay = false; let captured: ThreeLabEffectContext | undefined;
  let finish!: () => void; let started!: () => void; let lateDisposed = 0;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const release = new Promise<void>((resolve) => { finish = resolve; });
  const host = await createThreeLabHost(data.context, [
    { mount: mountThreeEffect, preset: { id: 'fixture-control' } },
    { preset: { id: 'fixture-control' }, mount: async (borrowed, preset) => {
      if (fail) { throw new Error('second candidate failed'); }
      const effect = await mountThreeEffect(borrowed, preset); captured = borrowed;
      if (delay) { started(); await release; return { ...effect, async dispose() { lateDisposed += 1; await effect.dispose(); } }; }
      return effect;
    } },
  ]);
  try {
    const scene = host.scene; const complete = scene.children[0]; const previousContext = captured!;
    fail = true; await expect(host.replaceFixture(next)).rejects.toThrow('second candidate failed');
    expect(scene.children[0]).toBe(complete); expect(host.readFacts().fixtureDigest).toBe(getFixtureDigest(data.context.fixture));
    fail = false; await host.replaceFixture(next); expect(host.scene).toBe(scene); expect(scene.children[0]).not.toBe(complete);
    expect(complete.children).toHaveLength(0); expect(captured).not.toBe(previousContext);
    expect(captured!.fixture).toBe(next); expect(captured!.ownerPose(next.objects[0].ownerId)!.sourceRevision).toBe(next.objects[0].sourceRevision);
    host.setResetTick(120);
    host.setFrame(createFrameInput({ tick: 180, seconds: 3, paused: true, cameraId: next.cameras[0].id, sourceRevision: next.sourceRevision,
      weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } }));
    expect(captured!.resetTick).toBe(120); expect(captured!.frame.tick).toBe(180);
    const adopted = scene.children[0]; delay = true; const replacement = host.replaceFixture(data.context.fixture);
    const rejected = expect(replacement).rejects.toThrow(/abort/i); await ready; expect(scene.children[0]).toBe(adopted);
    const disposing = host.dispose(); finish(); await rejected; await disposing;
    expect(lateDisposed).toBe(1); expect(host.scene.children).toHaveLength(0); expect(liveThreeHostCounts()).toEqual({ renderers: 0, renderloops: 0, hostListeners: 0 });
  } finally { finish(); await host.dispose(); vi.unstubAllGlobals(); }
});

it('RUN03 absent WebGL2 is explicit unsupported, never a downgraded renderer (CPU oracle)', async () => {
  const data = await context(); data.context.canvas.getContext = () => null;
  await expect(createThreeLabHost(data.context, [{ mount: mountThreeEffect, preset: data.context.preset }])).rejects.toThrow('UNSUPPORTED: WebGL2');
  expect(liveThreeHostCounts().renderers).toBe(0);
});
it('RUN02/LIF03 requested preview cancellation retains the prior complete source and releases the detached candidate (CPU oracle)',async()=>{vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());const data=await context();let delay=false,release!:()=>void,started!:()=>void,discarded=0;const ready=new Promise<void>(r=>started=r),hold=new Promise<void>(r=>release=r);const host=await createThreeLabHost(data.context,[{preset:{id:'fixture-control'},mount:async(c,p)=>{const effect=await mountThreeEffect(c,p);if(delay){started();await hold;return{...effect,async dispose(){discarded++;await effect.dispose();}};}return effect;}}]);try{const original=host.scene.children[0],request=new AbortController();delay=true;const work=host.replaceFixture(data.replay.scenario.snapshots[0].manifest,request.signal),rejected=expect(work).rejects.toThrow(/abort/i);await ready;request.abort();release();await rejected;expect(host.scene.children[0]).toBe(original);expect(host.readFacts().fixtureDigest).toBe(getFixtureDigest(data.context.fixture));expect(discarded).toBe(1);expect(liveThreeHostCounts().renderers).toBe(1);}finally{release();await host.dispose();vi.unstubAllGlobals();}});
