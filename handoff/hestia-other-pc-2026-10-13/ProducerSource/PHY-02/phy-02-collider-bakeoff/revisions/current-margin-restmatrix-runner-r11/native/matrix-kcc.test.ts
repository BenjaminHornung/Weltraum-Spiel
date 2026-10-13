import { beforeAll, expect } from "vitest";
import { createHvpLocomotion, HVP_PLAYER_PROFILE } from "@phy02-product/hestia-prototype/player/locomotion";
import type { Fixture } from "@phy02-current/fixtures";
import { active, functional, observe, withWorld, withCleanup } from "./harness";
import { Candidate, installFixture, publish, worldFor } from "../src/fork";
import { covered, floorFixture, stairFixture } from "../src/fixtures";

const gravity = 9.81;
const spawn = { x: 0, y: 0.92, z: 0 };
const identity = { x: 0, y: 0, z: 0, w: 1 } as const;

beforeAll(() => Candidate.init());

function installSources(world: ReturnType<typeof worldFor>, fixtures: readonly Fixture[]) {
  world.timestep = 1 / 60;
  const installed = fixtures.map(fixture => installFixture(active, world, fixture));
  publish(world);
  observe({
    sourceCount: fixtures.length,
    fixtureCount: fixtures.length,
    sourceCellCount: fixtures.reduce((count, fixture) => count + fixture.cells.length, 0),
    colliderCount: installed.reduce((count, source) => count + source.colliders.length, 0),
    initialQueryPublicationPhysicalSteps: 0
  });
}

function tick(world: ReturnType<typeof worldFor>, player: ReturnType<typeof createHvpLocomotion>, count: number) {
  for (let i = 0; i < count; i += 1) {
    player.step();
    world.step();
  }
}

function report(player: ReturnType<typeof createHvpLocomotion>) {
  const state = player.read();
  observe({ finalPosition: state.position, grounded: state.grounded, jumpCount: state.jumpCount });
  return state;
}

function stepFixture(heightCells: 1 | 2 | 3): Fixture {
  const cells: [number, number, number][] = [];
  for (let x = 0; x < 32; x += 1) {
    for (let y = 0; y < heightCells; y += 1) {
      for (let z = 0; z < 16; z += 1) cells.push([x, y, z]);
    }
  }
  return {
    id: `kcc-canonical-step-${heightCells}`,
    cellSize: 0.125,
    bounds: [32, heightCells, 16],
    origin: [-2, 0, -3],
    cells,
    density: 2400,
    rotation: identity
  };
}

functional("walks at 3 m/s on the canonical floor", () => withWorld(world => {
  const fixture = floorFixture();
  installSources(world, [fixture]);
  const player = createHvpLocomotion(world, spawn, gravity, covered(fixture));
  return withCleanup(() => {
    player.setEnabled(true);
    tick(world, player, 10);
    player.setInput({ x: 0, z: -1, sprint: false, jump: false });
    tick(world, player, 60);
    const state = report(player);
    expect(Math.hypot(state.position.x, state.position.z)).toBeCloseTo(3, 2);
    expect(state.grounded).toBe(true);
    const feet = state.position.y - HVP_PLAYER_PROFILE.height / 2;
    expect(feet).toBeGreaterThanOrEqual(0);
    expect(feet).toBeLessThanOrEqual(0.02);
  }, () => player.dispose(), "player");
}, gravity));

functional("normalizes diagonal walking on the canonical floor", () => withWorld(world => {
  const fixture = floorFixture();
  installSources(world, [fixture]);
  const player = createHvpLocomotion(world, spawn, gravity, covered(fixture));
  return withCleanup(() => {
    player.setEnabled(true);
    tick(world, player, 10);
    player.setInput({ x: 1, z: -1, sprint: false, jump: false });
    tick(world, player, 60);
    const state = report(player);
    expect(Math.hypot(state.position.x, state.position.z)).toBeCloseTo(3, 2);
    expect(state.grounded).toBe(true);
    const feet = state.position.y - HVP_PLAYER_PROFILE.height / 2;
    expect(feet).toBeGreaterThanOrEqual(0);
    expect(feet).toBeLessThanOrEqual(0.02);
  }, () => player.dispose(), "player");
}, gravity));

for (const tread of [1, 2, 4] as const) {
  functional(`walks canonical ${tread}-voxel stairs without jumping`, () => withWorld(world => {
    const fixture = stairFixture(tread);
    installSources(world, [fixture]);
    const player = createHvpLocomotion(world, spawn, gravity, covered(fixture));
    return withCleanup(() => {
      player.setEnabled(true);
      tick(world, player, 10);
      player.setInput({ x: 0, z: -1, sprint: false, jump: false });
      tick(world, player, 100);
      const state = report(player);
      expect(state.position.z).toBeLessThan(-3.5);
      expect(state.position.y).toBeGreaterThan(1.6);
      expect(state.jumpCount).toBe(0);
    }, () => player.dispose(), "player");
  }, gravity));
}

for (const [height, cells] of [[0.125, 1], [0.25, 2], [0.375, 3]] as const) {
  functional(`respects the 0.26 m autostep limit on a ${height} m canonical step`, () => withWorld(world => {
    const floor = floorFixture();
    const step = stepFixture(cells);
    installSources(world, [floor, step]);
    const player = createHvpLocomotion(world, spawn, gravity, covered(floor));
    return withCleanup(() => {
      player.setEnabled(true);
      tick(world, player, 10);
      player.setInput({ x: 0, z: -1, sprint: false, jump: false });
      tick(world, player, 60);
      const state = report(player);
      if (height <= 0.26) expect(state.position.z).toBeLessThan(-2);
      else expect(state.position.z).toBeGreaterThan(-0.75);
    }, () => player.dispose(), "player");
  }, gravity));
}

