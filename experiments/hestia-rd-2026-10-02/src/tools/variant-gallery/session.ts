import type { LabExperimentHandle } from '../../contracts/experiment';
import type { LabFixtureV1 } from '../../contracts/fixture';
import { createScenarioRunner } from '../../runner/scenarioRunner';
import { comparison, deriveReplay, GalleryDisposalError, type Comparison, type PreparedReplay, type Replay, type Sample, type Selection, type Submission } from './model';
import { freezeJson, requireValue } from '../../contracts/validation';

/** Local seam for exactly the known gallery hosts, not a public plugin contract. */
export interface GalleryHost {
  readonly handle: LabExperimentHandle; setResetTick(tick: number | null): void;
  readSubmission(): Submission; waitFor(sample: Sample, baseline: number, signal: AbortSignal): Promise<Submission>;
  dispose(): Promise<unknown>;
}
export interface GalleryState {
  readonly status: 'IDLE' | 'PREPARING' | 'READY' | 'ERROR'; readonly busy: boolean; readonly message: string;
  readonly inputError: string | null;
  readonly generation: number; readonly selection: Selection | null; readonly comparison: Comparison | null;
  readonly submission: Submission | null; readonly cleanup: unknown; readonly durationTicks: number;
}
export function seekTickError(tick: unknown, durationTicks: number): string | null {
  return typeof tick === 'number' && Number.isSafeInteger(tick) && tick >= 0 && tick <= durationTicks
    ? null : `Enter an integer tick between 0 and ${durationTicks}`;
}
export function createGallerySession(options: {
  load(selection: Selection, signal: AbortSignal): Promise<Replay>;
  mount(selection: Selection, initial: LabFixtureV1, signal: AbortSignal, onError: (error: unknown) => void): Promise<GalleryHost>;
  changed?: (state: GalleryState) => void;
}) {
  type Active = { selection: Selection; prepared: PreparedReplay; host: GalleryHost; controller: AbortController;
    runner: ReturnType<typeof createScenarioRunner>; generation: number };
  let state: GalleryState = freezeJson({ status: 'IDLE', busy: false, message: 'Choose a frozen replay', generation: 0,
    inputError: null, selection: null, comparison: null, submission: null, cleanup: null, durationTicks: 0 });
  let active: Active | null = null; let generation = 0; let desired: Selection | null = null;
  let mounting: AbortController | null = null; let work: Promise<void> | null = null; let commandWork: Promise<void> | null = null;
  let retirement: Promise<void> | null = null;
  let position = { tick: 0, paused: true }; let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false; let unsafeCleanup = false;
  const read = () => state;
  function publish(patch: Partial<GalleryState>) { state = freezeJson({ ...state, ...patch, generation }); options.changed?.(state); }
  function stopClock() { if (timer !== null) { clearTimeout(timer); timer = null; } }
  async function clean(host: GalleryHost) {
    try { publish({ cleanup: await host.dispose() }); }
    catch (error) { unsafeCleanup = true; throw new GalleryDisposalError(`Disposal failed; remount blocked: ${String(error)}`); }
  }
  function retire(): Promise<void> {
    if (retirement) { return retirement; }
    const old = active; if (!old) { return Promise.resolve(); } active = null;
    retirement = Promise.resolve().then(async () => {
      old.controller.abort(); await old.runner.settled(); await commandWork; await clean(old.host);
    }).finally(() => { retirement = null; });
    return retirement;
  }
  function fail(error: unknown) {
    stopClock(); generation++; desired = null; mounting?.abort(); active?.controller.abort();
    publish({ status: 'ERROR', busy: false, inputError: null, message: String(error), comparison: null, submission: null });
    if (!work && !commandWork) {
      work = retire().catch((cleanupError: unknown) => { publish({ message: String(cleanupError) }); }).then(pump).finally(finished);
    }
  }
  function finished() { work = null; if (desired && !closed && !unsafeCleanup) { work = pump().finally(finished); } }
  function schedule() {
    stopClock();
    if (closed || state.status !== 'READY' || position.paused) { return; }
    // This advances the controlled clock only. Rendering belongs solely to the selected host.
    timer = setTimeout(() => { timer = null; void command(state.comparison!.frame.tick >= state.durationTicks ? 'pause' : 'advance'); }, 1000 / 60);
  }
  async function pump() {
    while (desired && !closed && !unsafeCleanup) {
      let selection = desired; desired = null; const ticket = generation; const controller = new AbortController(); mounting = controller;
      let host: GalleryHost | null = null;
      try {
        await retire(); controller.signal.throwIfAborted();
        const replay = await options.load(selection, controller.signal); controller.signal.throwIfAborted();
        selection = { ...selection, cameraId: selection.cameraId || replay.scenario.initialCameraId };
        const prepared = await deriveReplay(replay, selection); controller.signal.throwIfAborted();
        host = await options.mount(selection, replay.initialFixture, controller.signal, (error) => {
          if (ticket === generation && !controller.signal.aborted) { fail(error); }
        });
        controller.signal.throwIfAborted();
        const runner = createScenarioRunner(prepared.effective, host.handle, host.setResetTick);
        const baseline = host.readSubmission().submittedFrames; const captured = { ...position };
        requireValue(captured.tick <= prepared.effective.durationTicks, 'Preserved tick exceeds selected replay');
        await runner.pause(true); const sample = await runner.seek(captured.tick);
        let submission = await host.waitFor(sample, baseline, controller.signal); controller.signal.throwIfAborted();
        if (!captured.paused) {
          const before = submission.submittedFrames; submission = await host.waitFor(await runner.pause(false), before, controller.signal);
        }
        controller.signal.throwIfAborted(); requireValue(ticket === generation, 'Superseded selection');
        active = { host, runner, prepared, selection, controller, generation: ticket }; host = null;
        publish({ status: 'READY', busy: false, message: 'Matching actual frame submitted', selection,
          comparison: comparison(prepared, submission), submission, durationTicks: prepared.effective.durationTicks }); schedule();
      } catch (error) {
        controller.abort();
        if (error instanceof GalleryDisposalError) { unsafeCleanup = true; }
        if (host) { try { await clean(host); } catch (cleanupError) { error = cleanupError; } }
        if (ticket === generation || unsafeCleanup) { fail(error); }
      } finally { if (mounting === controller) { mounting = null; } }
    }
  }
  function select(selection: Selection): Promise<void> {
    if (closed || unsafeCleanup) { return Promise.resolve(); }
    stopClock();
    if (state.comparison) { position = { tick: state.comparison.frame.tick, paused: state.comparison.frame.paused }; }
    if (selection.scenarioId !== state.selection?.scenarioId) { position = { tick: 0, paused: true }; }
    generation++; desired = { ...selection }; mounting?.abort(); active?.controller.abort();
    publish({ status: 'PREPARING', busy: true, inputError: null, selection, message: 'Stopping old host; preparing latest selection', comparison: null, submission: null });
    if (!work) { work = pump().finally(finished); }
    return work;
  }
  async function command(kind: 'play' | 'pause' | 'step' | 'seek' | 'reset' | 'advance', tick?: number) {
    const owner = active;
    if (!owner || state.status !== 'READY' || closed) { return; }
    if (kind === 'seek') {
      const inputError = seekTickError(tick, owner.prepared.effective.durationTicks);
      if (inputError) { publish({ inputError }); return; }
    }
    if (commandWork) {
      if (kind === 'pause') {
        stopClock(); await commandWork;
        if (active === owner && owner.generation === generation) { await command('pause'); }
      }
      return;
    }
    stopClock(); publish({ busy: true, inputError: null });
    const job = async () => {
      try {
        const baseline = owner.host.readSubmission().submittedFrames;
        let sample: Sample;
        if (kind === 'play' || kind === 'pause') { sample = await owner.runner.pause(kind === 'pause'); }
        else if (kind === 'reset') { await owner.runner.reset(); sample = await owner.runner.pause(true); }
        else if (kind === 'seek') { requireValue(tick !== undefined, 'Seek requires a tick'); sample = await owner.runner.seek(tick); }
        else if (kind === 'step') { sample = await owner.runner.seek(Math.min(owner.runner.read().tick + 1, owner.prepared.effective.durationTicks)); }
        else { sample = await owner.runner.advance(); }
        const submission = await owner.host.waitFor(sample, baseline, owner.controller.signal);
        owner.controller.signal.throwIfAborted(); requireValue(owner.generation === generation, 'Stale command');
        position = { tick: sample.frame.tick, paused: sample.frame.paused };
        publish({ busy: false, comparison: comparison(owner.prepared, submission), submission });
      } catch (error) {
        if (owner.generation === generation) { fail(error); }
      }
    };
    commandWork = job(); await commandWork; commandWork = null;
    if (read().status === 'ERROR') { try { await retire(); } catch (error) { fail(error); } }
    schedule();
  }
  async function dispose() {
    closed = true; stopClock(); generation++; desired = null; mounting?.abort(); active?.controller.abort();
    await work; await commandWork;
    try { await retire(); } catch (error) { fail(error); }
    publish({ busy: false, inputError: null, comparison: null, submission: null, status: state.status === 'ERROR' ? 'ERROR' : 'IDLE', message: state.status === 'ERROR' ? state.message : 'Disposed; no active host' });
  }
  return { read, select, command, dispose };
}
