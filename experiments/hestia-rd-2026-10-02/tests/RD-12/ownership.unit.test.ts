import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { EngineStore } from '@babylonjs/core/Engines/engineStore.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { readFileSync } from 'node:fs';
import { loadInventory, loadReplay } from '../../src/runner/assets';
import { applyPresentation, buildBabylonProjection } from '../../src/experiments/babylon/projection';
import { bounded } from '../../src/experiments/babylon/readiness';

it('BAB02 supplementary emission adds declared emissive WITHOUT disabling C0 Lambert lighting', async () => {
  const root = new URL('http://127.0.0.1:5280/'); const fixtures = new URL('../../fixtures/', import.meta.url);
  const fetcher: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), fixtures)));
  const { initialFixture } = await loadReplay(await loadInventory(root, fetcher), 'F06-MATERIAL-REPLAY', root, fetcher);
  const engine = new NullEngine(); const scene = new Scene(engine); scene.useRightHandedSystem = true;
  const projection = buildBabylonProjection(initialFixture, scene, new AbortController().signal);
  try {
    const declared = initialFixture.materials.find((material) => material.role === 'emission')!;
    const material = projection.materials.find((material) => material.name === declared.id)!;
    expect(material.disableLighting).toBe(false); expect(material.diffuseColor.asArray()).toEqual(declared.colorLinearRgb); expect(material.emissiveColor.asArray()).toEqual(declared.colorLinearRgb);
  } finally { projection.dispose(); scene.dispose(); engine.dispose(); }
});

it('BAB02 supplementary sRGB24 clear output is not incorrectly linearized; synthetic fog/tone defaults remain absent', async () => {
  const root = new URL('http://127.0.0.1:5280/'); const fixtures = new URL('../../fixtures/', import.meta.url);
  const fetcher: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), fixtures)));
  const { initialFixture } = await loadReplay(await loadInventory(root, fetcher), 'F06-MATERIAL-REPLAY', root, fetcher);
  const engine = new NullEngine(); const scene = new Scene(engine); const projection = buildBabylonProjection(initialFixture, scene, new AbortController().signal);
  try {
    applyPresentation(scene, projection.presentation); expect(scene.clearColor.asArray()).toEqual([0x19 / 255, 0x24 / 255, 0x30 / 255, 1]);
    expect(scene.fogMode).toBe(Scene.FOGMODE_NONE); expect(scene.imageProcessingConfiguration.toneMappingEnabled).toBe(false); expect(scene.imageProcessingConfiguration.exposure).toBe(1);
  } finally { projection.dispose(); scene.dispose(); engine.dispose(); }
});

it('BAB04 supplementary actual SDK forceCompilation poll terminates after discarded owner disposal; no late allocation/EngineStore slot', async () => {
  const root = new URL('http://127.0.0.1:5280/'); const fixtures = new URL('../../fixtures/', import.meta.url);
  const fetcher: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), fixtures)));
  const { initialFixture } = await loadReplay(await loadInventory(root, fetcher), 'F04-DETACH-REPLAY', root, fetcher);
  const instances = EngineStore.Instances.length; const engine = new NullEngine(); const scene = new Scene(engine); scene.useRightHandedSystem = true;
  const projection = buildBabylonProjection(initialFixture, scene, new AbortController().signal);
  vi.useFakeTimers(); const notReady = vi.spyOn(StandardMaterial.prototype, 'isReadyForSubMesh').mockReturnValue(false);
  try {
    const mesh = projection.meshes[0]; const abort = new AbortController();
    const sdkWork = (mesh.material as StandardMaterial).forceCompilationAsync(mesh); const work = bounded(sdkWork, abort.signal, 'Supplementary real SDK polling');
    const rejected = expect(work).rejects.toThrow(/aborted/); await vi.advanceTimersByTimeAsync(32); expect(notReady.mock.calls.length).toBeGreaterThan(1);
    abort.abort(); await rejected; projection.dispose(); const calls = notReady.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100); await sdkWork; expect(notReady.mock.calls).toHaveLength(calls); expect(vi.getTimerCount()).toBe(0);
    expect(scene.meshes).toHaveLength(0); expect(scene.materials).toHaveLength(0); expect(scene.lights).toHaveLength(0);
  } finally { vi.restoreAllMocks(); vi.useRealTimers(); scene.dispose(); engine.dispose(); }
  expect(EngineStore.Instances).toHaveLength(instances);
});

it('BAB04 supplementary first owned loss during INITIAL compile reaches rejected factory, not a secondary abort message (CONTROLLED context)', async () => {
  // Real projection/Scene/Camera/Material, controlled C3 acquisition only.
  vi.doMock('@babylonjs/core/Engines/engine.js', () => ({ Engine: class extends NullEngine { override get webGLVersion() { return 2; } } }));
  const { createBabylonExperiment, liveBabylonHostCounts } = await import('../../src/experiments/babylon');
  const root = new URL('http://127.0.0.1:5280/'); const fixtures = new URL('../../fixtures/', import.meta.url);
  const fetcher: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), fixtures)));
  const { initialFixture } = await loadReplay(await loadInventory(root, fetcher), 'F04-DETACH-REPLAY', root, fetcher);
  const canvas = Object.assign(new EventTarget(), { width: 1280, height: 720, style: {}, getContext: () => ({}) });
  vi.spyOn(StandardMaterial.prototype, 'forceCompilationAsync').mockImplementation(() => Promise.resolve().then(() => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); throw new Error('secondary shader failure');
  }));
  try {
    await expect(createBabylonExperiment({ canvas: canvas as unknown as HTMLCanvasElement, fixture: initialFixture, preset: { id: 'C3' }, signal: new AbortController().signal, capabilities: {} })).rejects.toThrow(/WebGL context lost/);
    expect(liveBabylonHostCounts()).toEqual({ engines: 0, renderloops: 0, listeners: 0, pendingNativeInitializations: 0 });
  } finally { vi.restoreAllMocks(); vi.doUnmock('@babylonjs/core/Engines/engine.js'); }
});
