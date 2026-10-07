import { createVoxelRayExperiment, type VoxelRayHost } from '../../src/experiments/voxel-rays';
import { loadInventory, loadReplay, publicAssetRoot } from '../../src/runner/assets';

async function probe(mode: 'ready' | 'during-init' | 'before-init') {
  const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!, life = new AbortController();
  const root = publicAssetRoot(import.meta.env.BASE_URL, window.location.href);
  const replay = await loadReplay(await loadInventory(root), 'F00-CONTROL-REPLAY', root);
  const native = () => structuredClone((window as any).__rdNative);
  let host: VoxelRayHost | undefined;
  const read = () => {
    try { return { hidden: canvas.hidden, terminal: host!.readPrivateDiagnostics(), diagnostics: host!.readRayDiagnostics() }; }
    catch (error) { return { hidden: canvas.hidden, terminal: host!.readPrivateDiagnostics(), error: String(error) }; }
  };
  try {
    if (mode === 'before-init') life.abort();
    const pending = createVoxelRayExperiment({ canvas, fixture: replay.initialFixture,
      preset: { id: 'rays-no-ao' }, signal: life.signal, capabilities: {} });
    if (mode === 'during-init') life.abort();
    try { host = await pending as VoxelRayHost; }
    catch (error) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return { mode, initRejected: String(error), hidden: canvas.hidden, native: native() };
    }
    const deadline = performance.now() + 10_000;
    while ((host.readRayDiagnostics().host?.submittedFrames ?? 0) === 0) {
      if (performance.now() > deadline) throw Error('No actual native draw before Abort');
      await new Promise(resolve => setTimeout(resolve, 16));
    }
    const before = { state: read(), native: native() };
    life.abort(); const immediate = read();
    await new Promise(resolve => setTimeout(resolve, 0));
    const afterAbort = { state: read(), native: native() }; // No explicit outer dispose yet.
    await host.dispose(); await host.dispose();
    return { mode, before, immediate, afterAbort, afterExplicitDispose: { state: read(), native: native() } };
  } finally { await host?.dispose(); }
}
(window as any).FollowupAbortProbe = probe;
