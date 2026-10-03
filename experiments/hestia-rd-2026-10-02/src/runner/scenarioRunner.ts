import { getFixtureDigest } from '../contracts/fixture';
import { createControlledClock, sampleScenario, type LabScenarioV1 } from '../contracts/scenario';
import type { LabExperimentHandle } from '../contracts/experiment';

/** Commands serialize snapshot adoption before frame publication; render cadence is not scenario time. */
export function createScenarioRunner(scenario: LabScenarioV1, handle: Pick<LabExperimentHandle, 'setFrame' | 'replaceFixture'>,
  setResetTick: (tick: number | null) => void) {
  const clock = createControlledClock(scenario.durationTicks);
  let digest = scenario.fixtureDigest; let lastTick = 0; let lastResetTick: number | null = null; let queue = Promise.resolve();
  async function apply() {
    const state = clock.read(); const sample = sampleScenario(scenario, state.tick, state.paused);
    const nextDigest = getFixtureDigest(sample.fixture);
    // Reset/backward seek remounts projection caches even when source bytes did not change.
    if (nextDigest !== digest || sample.resetTick !== lastResetTick || state.tick < lastTick) {
      await handle.replaceFixture(sample.fixture); digest = nextDigest;
    }
    setResetTick(sample.resetTick); handle.setFrame(sample.frame); lastTick = state.tick; lastResetTick = sample.resetTick; return sample;
  }
  function command(mutate: () => unknown) {
    const work = queue.then(async () => {
      const before = clock.read(); mutate();
      try { return await apply(); }
      catch (error) { clock.seek(before.tick); clock.pause(before.paused); throw error; }
    });
    queue = work.then(() => {}, () => {}); return work;
  }
  return {
    read: clock.read,
    render: () => command(() => {}),
    advance: (count = 1) => command(() => clock.advance(count)),
    pause: (paused: boolean) => command(() => clock.pause(paused)),
    seek: (tick: number) => command(() => clock.seek(tick)),
    reset: () => command(() => clock.reset()),
    settled: () => queue,
  };
}
