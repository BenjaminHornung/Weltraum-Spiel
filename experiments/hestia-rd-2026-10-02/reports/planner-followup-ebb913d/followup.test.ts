import { it, expect } from 'vitest';
import { Group, Scene, PerspectiveCamera } from 'three';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as baselineWet from './runtime/baseline/src/experiments/wet-surface';
import * as candidateWet from '../../src/experiments/wet-surface';
import { fixtureReplay as candidateReplay } from '../../tests/resume/fixtures';
import { fixtureReplay as baselineReplay } from './runtime/baseline/tests/resume/fixtures';
import { ownerPose as candidatePose } from '../../src/runner/threeHost';
import { ownerPose as baselinePose } from './runtime/baseline/src/runner/threeHost';
import { fixtureRevision as candidateRevision } from '../../src/contracts/fixture';
import { fixtureRevision as baselineRevision } from './runtime/baseline/src/contracts/fixture';

it('whole actual face populations remain byte-equivalent across direction, opening, rotated owner and backward seek', async () => {
  const receipt = JSON.parse(readFileSync(new URL('./runs/control-02-build.json', import.meta.url), 'utf8'));
  for (const [relative, expected] of Object.entries(receipt.sourceHashes)) {
    const bytes = readFileSync(new URL('./runtime/baseline/' + relative, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex'), relative).toBe(expected);
  }
  expect(createHash('sha256').update(readFileSync(new URL('./runtime/baseline/tests/resume/fixtures.ts', import.meta.url))).digest('hex'))
    .toBe('50876d5023aecc63326f66457113cca5fe2f07c830cb39710efe73b05e09a32b');
  for (const scenario of ['F03-SHELTER-REPLAY', 'F04-DETACH-REPLAY']) {
    const replays = await Promise.all([baselineReplay(scenario), candidateReplay(scenario)]);
    for (const sourceIndex of [-1, 0, 1]) {
      if (sourceIndex >= replays[0].scenario.snapshots.length) continue;
      const fixtures = replays.map(r => sourceIndex < 0 ? r.initialFixture : r.scenario.snapshots[sourceIndex].manifest);
      const effects = [];
      for (let side = 0; side < 2; side++) {
        const fixture = fixtures[side], modules = side ? candidateWet : baselineWet, pose = side ? candidatePose : baselinePose;
        const revision = (side ? candidateRevision : baselineRevision)(fixture), scene = new Scene(), camera = new PerspectiveCamera(), root = new Group();
        const initial = { tick: 600, seconds: 10, paused: true, cameraId: fixture.cameras[0].id,
          sourceRevision: revision, weather: { windMps: [0, 0, 0] as const, rain01: .8, cloud01: .8, snow01: 0 } };
        const context = { scene, camera, root, fixture, frame: initial, resetTick: null, signal: new AbortController().signal,
          capabilities: {}, ownerPose: (id: string) => pose(fixture, id) };
        effects.push({ effect: await modules.mountThreeEffect(context, { id: 'analytic-current-exposure' }), frame: initial });
      }
      for (const [tick, wind] of [[600, 0], [601, 2], [602, 3], [600, 0], [120, 0]] as const) {
        const states = effects.map(({ effect, frame }) => { effect.setFrame({ ...frame, tick, seconds: tick / 60,
          weather: { ...frame.weather, windMps: [wind, 0, wind / 3], rain01: tick < 240 ? 0 : .8 } }); return effect.readWetnessState(); });
        expect(states[1].result).toEqual(states[0].result);
        expect(states[1].rain).toEqual(states[0].rain);
      }
      await Promise.all(effects.map(({ effect }) => effect.dispose()));
    }
  }
});
