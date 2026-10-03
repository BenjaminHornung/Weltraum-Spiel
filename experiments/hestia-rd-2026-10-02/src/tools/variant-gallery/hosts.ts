import { mountExperiment, type LabExperimentHandle } from '../../contracts/experiment';
import type { LabFixtureV1 } from '../../contracts/fixture';
import { requireValue } from '../../contracts/validation';
import { createThreeControlExperiment } from '../../experiments/three-control';
import { createThreeWebGpuExperiment, type ThreeWebGpuHost } from '../../experiments/three-webgpu';
import { LAB_REGISTRATIONS } from '../../registration';
import type { ThreeLabHost } from '../../runner/threeHost';
import { GalleryDisposalError, matchesSubmission, type Sample, type Selection, type Submission, type Variant } from './model';
import type { GalleryHost } from './session';

export function registration(variant: Variant) {
  const value = LAB_REGISTRATIONS.find((entry) => entry.variantId === variant && entry.id === (variant === 'fixture-control' ? 'RD-03' : 'RD-11'));
  requireValue(value && value.create === (variant === 'fixture-control' ? createThreeControlExperiment : createThreeWebGpuExperiment), 'Known gallery registration unavailable');
  return value;
}
export function knownHostMount(freshCanvas: () => HTMLCanvasElement) {
  return async (selection: Selection, initial: LabFixtureV1, signal: AbortSignal, onError: (error: unknown) => void): Promise<GalleryHost> => {
    const canvas = freshCanvas(); const entry = registration(selection.variant);
    let raw: ThreeLabHost | ThreeWebGpuHost | null = null; let fixture = initial; let handle: LabExperimentHandle;
    const eventName = selection.variant === 'fixture-control' ? 'three-lab-error' : 'rd11-error';
    const failure = (event: Event) => { onError((event as CustomEvent<unknown>).detail ?? 'Renderer error'); };
    canvas.addEventListener(eventName, failure);
    function cleanupProof() {
      try {
        requireValue(raw, 'Missing concrete host'); const cleanup = raw.readCleanup();
        requireValue(cleanup.disposed && cleanup.liveHosts.renderers === 0 && cleanup.liveHosts.renderloops === 0, 'Known host did not dispose its renderer/loop');
        if ('ownedMaterials' in cleanup) {
          requireValue(cleanup.ownedGeometries === 0 && cleanup.ownedMaterials === 0 && cleanup.liveHosts.abortListeners === 0, 'RD11 retained owned resources/listeners');
        } else { requireValue(cleanup.geometries === 0 && cleanup.textures === 0 && cleanup.programs === 0 && cleanup.liveHosts.hostListeners === 0, 'C0 retained logical resources/listeners'); }
        return cleanup;
      } catch (error) { throw new GalleryDisposalError(`Unsafe known-host cleanup: ${String(error)}`); }
    }
    try {
      handle = await mountExperiment(async (context) => {
        raw = selection.variant === 'fixture-control' ? await createThreeControlExperiment(context) : await createThreeWebGpuExperiment(context); return raw;
      }, { canvas, fixture, preset: { ...entry.preset, parameters: { ...entry.preset.parameters, width: selection.width, height: selection.height, dpr: selection.dpr } },
        signal, capabilities: { webgl2: true, webgpu: Boolean(navigator.gpu) } });
    } catch (error) {
      canvas.removeEventListener(eventName, failure);
      // mountExperiment intentionally hides failed-init cleanup errors; inspect the concrete owner if it returned.
      if (raw) { cleanupProof(); }
      throw error;
    }
    requireValue(raw, 'Factory returned no known host'); const host = raw as ThreeLabHost | ThreeWebGpuHost;
    const wrapped: LabExperimentHandle = { ...handle, async replaceFixture(next) { await handle.replaceFixture(next); fixture = next; } };
    function readSubmission(): Submission {
      const facts = handle.readFacts();
      if (selection.variant === 'fixture-control') {
        const d = (host as ThreeLabHost).readDiagnostics();
        return { frame: d.frame, fixtureDigest: d.fixtureDigest, resetTick: d.resetTick,
          backend: { requested: 'webgl2', actual: d.webgl2 ? 'webgl2' : 'unsupported', label: facts.backend },
          resolution: d.resolution, presentationProfile: d.presentationProfile, sourceRefs: fixture.sourceRefs,
          quality: { requested: { antialias: true, backend: 'WebGL2' }, observed: { antialias: canvas.getContext('webgl2')?.getContextAttributes()?.antialias ?? 'UNSUPPORTED',
            effectiveSamples: { status: 'not-run', unit: 'sample', reason: 'C0 does not expose qualified scene/final sample counts' },
            colorSpace: d.colorSpace, toneMapping: d.toneMapping, exposure: d.exposure } },
          submittedFrames: d.submittedFrames, projectionGeneration: null,
          rendered: d.rendered ? { ...d.rendered, cameraId: null, projectionGeneration: null } : null,
          errors: facts.errors, unsupportedFeatures: facts.unsupportedFeatures, logicalCosts: facts.logicalCosts };
      }
      const d = (host as ThreeWebGpuHost).readDiagnostics(); const { requested, ...observed } = d.quality;
      return { frame: d.frame, fixtureDigest: d.fixtureDigest, resetTick: d.resetTick,
        backend: { requested: selection.variant === 'C2' ? 'webgpu' : 'webgl2', actual: d.backend.actual, label: facts.backend },
        resolution: d.resolution, presentationProfile: d.presentationProfile, sourceRefs: d.sourceRefs,
        quality: { requested, observed: { ...observed, colorSpace: d.colorSpace, toneMapping: d.toneMapping, exposure: d.exposure } },
        submittedFrames: d.submittedFrames, projectionGeneration: d.projectionGeneration, rendered: d.rendered,
        errors: [...facts.errors, ...d.errors, ...(d.terminal ? [d.terminal] : []), ...(d.disposed || d.pending ? ['Host disposed or projection pending'] : [])],
        unsupportedFeatures: facts.unsupportedFeatures, logicalCosts: facts.logicalCosts };
    }
    return { handle: wrapped, setResetTick: (tick) => host.setResetTick(tick), readSubmission,
      async waitFor(sample: Sample, baseline: number, abort: AbortSignal) {
        const began = performance.now();
        while (true) {
          abort.throwIfAborted(); const value = readSubmission();
          requireValue(value.errors.length === 0, value.errors.join('; '));
          requireValue(value.backend.actual === value.backend.requested, `UNSUPPORTED requested ${value.backend.requested}; observed ${value.backend.actual}; no C2→C1 substitution`);
          if (matchesSubmission(value, sample, selection, baseline)) { return value; }
          requireValue(performance.now() - began < 15_000, 'Matching submitted frame timed out');
          await new Promise<void>((resolve) => setTimeout(resolve, 16));
        }
      },
      async dispose() {
        canvas.removeEventListener(eventName, failure);
        try { await handle.dispose(); return cleanupProof(); } catch (error) { throw new GalleryDisposalError(String(error)); }
      },
    };
  };
}
