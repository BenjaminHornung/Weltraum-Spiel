import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createPersistenceSignature } from "../../src/persistence/canonical";
import { createSyntheticAuthoredCodecFixtures } from "../fixtures/phy01LabCodecFixtures";
import { decodeHvpGame, decodeHvpLabGame, encodeHvpLabGame, type HvpDecodedLabGame } from "../../src/hestia-prototype/persistence/gameCheckpoint";
import { hvpCollisionDigest, type HvpLabWorldCheckpoint, type HvpWorldCheckpoint } from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {
  createHvpChunkLabPhysicsSession,
  createHvpLabPhysicsSession,
  createHvpPhysicsSession,
  type HvpLabPhysicsSession,
  type HvpPhysicsSession
} from "../../src/hestia-prototype/physics/session";
import { HVP_SOLVER_PROFILE, resolveHvpGravity } from "../../src/hestia-prototype/physics/profile";
import { collisionSectors, type HvpCollisionSector } from "../../src/hestia-prototype/physics/terrainColliders";
import { prepareHvpLabWorldReplacement } from "../../src/hestia-prototype/physics/worldReplacement";
import type { HvpChunkStaticLayout } from "../../src/hestia-prototype/physics/staticTerrainLayout";
import { createHvpEastRegion } from "../../src/hestia-prototype/runtime/regionSource";
import { createHvpTerrainRoot } from "../../src/hestia-prototype/terrain/cutPlan";

const nativeAdmission = vi.hoisted(() => ({
  initializeCalls: 0,
  worldConstructorCalls: 0,
  pumpCreateCalls: 0,
  pumpRunCalls: 0,
  pumpDisposeCalls: 0,
  pumpSteps: 0,
  sentinel: new Error("FAKE_RAPIER_WORLD_SENTINEL")
}));

vi.mock("../../src/hestia-prototype/physics/rapierPort", () => ({
  R: { World: class { constructor() { nativeAdmission.worldConstructorCalls += 1; throw nativeAdmission.sentinel; } } },
  initializeHvpRapier: async () => { nativeAdmission.initializeCalls += 1; },
  isHvpSolidCollider: () => true
}));
vi.mock("../../src/workers/hvpBoundedPump", () => ({
  createHvpBodyMeshTaskPump: () => {
    nativeAdmission.pumpCreateCalls += 1;
    return {
      run: async (steps: IterableIterator<unknown>) => {
        nativeAdmission.pumpRunCalls += 1;
        for (const step of steps) { void step; nativeAdmission.pumpSteps += 1; }
      },
      dispose: () => { nativeAdmission.pumpDisposeCalls += 1; }
    };
  }
}));
vi.mock("../../src/workers/hvpBodyMeshJob", () => ({
  decodeHvpBodyMeshOutput: () => { throw new Error("UNEXPECTED_WORKER_OUTPUT"); },
  decodeHvpBodyMeshOutputSteps: () => { throw new Error("UNEXPECTED_WORKER_OUTPUT"); }
}));

type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;
type IsSame<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never;
export type LabSessionIsNotPublic = AssertFalse<HvpLabPhysicsSession extends HvpPhysicsSession ? true : false>;
export type LabCheckpointIsNotPublic = AssertFalse<HvpLabWorldCheckpoint extends HvpWorldCheckpoint ? true : false>;
export type ChunkLabKeepsDirectLabArguments = AssertTrue<IsSame<
  Tail<Parameters<typeof createHvpChunkLabPhysicsSession>>,
  Parameters<typeof createHvpLabPhysicsSession>
>>;

const layout: HvpChunkStaticLayout = Object.freeze({
  version: "hvp-static-chunks-v1",
  primaryTerrainCount: 256,
  neighborTerrainCount: 256
});
const floor = {
  sizeX: 8,
  sizeY: 4,
  sizeZ: 8,
  cellMeters: 0.125,
  originMeters: { x: 0, y: 0, z: 0 },
  readSlot: (_x: number, y: number, _z: number) => y === 0 ? 1 : 0
};
const emptySector = (): HvpCollisionSector => ({ vertices: new Float32Array(0), indices: new Uint32Array(0) });
const makeChunkSectors = (): HvpCollisionSector[] => [
  ...Array.from({ length: 256 }, emptySector),
  ...collisionSectors(floor)
];

let fixtures: ReturnType<typeof createSyntheticAuthoredCodecFixtures>;
beforeAll(() => { fixtures = createSyntheticAuthoredCodecFixtures(); });
beforeEach(() => {
  nativeAdmission.initializeCalls = 0;
  nativeAdmission.worldConstructorCalls = 0;
  nativeAdmission.pumpCreateCalls = 0;
  nativeAdmission.pumpRunCalls = 0;
  nativeAdmission.pumpDisposeCalls = 0;
  nativeAdmission.pumpSteps = 0;
});

const createChunkLab = (
  sectors: readonly HvpCollisionSector[],
  game?: HvpDecodedLabGame,
  selectedLayout: HvpChunkStaticLayout = layout
) => createHvpChunkLabPhysicsSession(selectedLayout, sectors, { x: 0, y: 4, z: 0 }, resolveHvpGravity(),
  undefined, undefined, undefined, "synthetic-codec", game);
const createLabGame = (sectors: readonly HvpCollisionSector[]) => {
  const { version: _version, profiles: _profiles, signature: _signature, ...data } = fixtures.lab;
  const checkpoint = encodeHvpLabGame({
    ...data,
    world: { ...fixtures.lab.world, collisionDigest: hvpCollisionDigest(sectors) }
  });
  return decodeHvpLabGame(checkpoint);
};
const expectNoNativeAdmission = () => {
  expect(nativeAdmission.initializeCalls).toBe(0);
  expect(nativeAdmission.worldConstructorCalls).toBe(0);
};
const resignLab = (value: Record<string, any>) => {
  const { signature: _signature, ...data } = value;
  return { ...value, signature: createPersistenceSignature(data) };
};

if (false) {
  // @ts-expect-error Direct LAB factory deliberately has no layout parameter.
  void createHvpLabPhysicsSession(layout, makeChunkSectors(), { x: 0, y: 4, z: 0 });
}

it("validates the exact chunk layout before constructing pump or admitting Native", async () => {
  const invalid = { ...layout, primaryTerrainCount: 255 } as unknown as HvpChunkStaticLayout;
  await expect(createChunkLab(makeChunkSectors(), undefined, invalid)).rejects.toThrow(/Invalid private static terrain layout/);
  expect(nativeAdmission.pumpCreateCalls).toBe(0);
  expectNoNativeAdmission();
});

it("rejects incomplete primary segmentation before pump or fake Native initialization", async () => {
  await expect(createChunkLab(makeChunkSectors().slice(0, 255))).rejects.toThrow(/Saved neighbour collision membership mismatch/);
  expect(nativeAdmission.pumpCreateCalls).toBe(0);
  expectNoNativeAdmission();
});

it("rejects a missing primary slot and disposes the pump when XYZ validation fails", async () => {
  const sparse = makeChunkSectors();
  delete sparse[41];
  const missing = new Proxy(sparse, {
    get(target, property, receiver) {
      if (property === "41" && !Object.hasOwn(target, property)) return emptySector();
      return Reflect.get(target, property, receiver);
    }
  });
  await expect(createChunkLab(missing)).rejects.toThrow(/Incomplete primary chunk coverage/);
  expect(nativeAdmission.pumpCreateCalls).toBe(1);
  expect(nativeAdmission.pumpDisposeCalls).toBe(1);
  expectNoNativeAdmission();

  beforeEachResetCounters();
  const wrongXyz = makeChunkSectors();
  wrongXyz[0] = {
    vertices: new Float32Array([100, 0, 0, 101, 0, 0, 100, 1, 0]),
    indices: new Uint32Array([0, 1, 2])
  };
  await expect(createChunkLab(wrongXyz)).rejects.toThrow(/Primary chunk bounds do not match XYZ coverage/);
  expect(nativeAdmission.pumpRunCalls).toBe(1);
  expect(nativeAdmission.pumpDisposeCalls).toBe(1);
  expectNoNativeAdmission();
});

function beforeEachResetCounters(): void {
  nativeAdmission.initializeCalls = 0;
  nativeAdmission.worldConstructorCalls = 0;
  nativeAdmission.pumpCreateCalls = 0;
  nativeAdmission.pumpRunCalls = 0;
  nativeAdmission.pumpDisposeCalls = 0;
  nativeAdmission.pumpSteps = 0;
}

it("admits 256 empty primary slots plus the mature floor as an extra, then stops at the fake World sentinel", async () => {
  const sectors = makeChunkSectors();
  expect(sectors).toHaveLength(257);
  await expect(createChunkLab(sectors)).rejects.toBe(nativeAdmission.sentinel);
  expect(nativeAdmission.pumpCreateCalls).toBe(1);
  expect(nativeAdmission.pumpRunCalls).toBe(1);
  expect(nativeAdmission.pumpDisposeCalls).toBe(1);
  expect(nativeAdmission.pumpSteps).toBe(256);
  expect(nativeAdmission.initializeCalls).toBe(1);
  expect(nativeAdmission.worldConstructorCalls).toBe(1);
});

it("admits an issued private restore checkpoint only with the matching complete collision digest", async () => {
  const sectors = makeChunkSectors();
  const issued = createLabGame(sectors);
  await expect(createChunkLab(sectors, issued)).rejects.toBe(nativeAdmission.sentinel);
  expect(nativeAdmission.pumpSteps).toBe(256);
  expect(nativeAdmission.initializeCalls).toBe(1);
  expect(nativeAdmission.worldConstructorCalls).toBe(1);
});

it("rejects resident neighbor XYZ before fake Native initialization", async () => {
  const primary = makeChunkSectors();
  const neighborRoot = createHvpTerrainRoot(await createHvpEastRegion(), "synthetic-codec-east", 0);
  const neighborSectors = Array.from({ length: 256 }, emptySector);
  neighborSectors[0] = {
    vertices: new Float32Array([100, -8, -16, 101, -8, -16, 100, -7, -16]),
    indices: new Uint32Array([0, 1, 2])
  };
  const sectors = [...primary, ...neighborSectors];
  const { version: _version, profiles: _profiles, signature: _signature, ...data } = fixtures.lab;
  const checkpoint = encodeHvpLabGame({
    ...data,
    world: {
      ...fixtures.lab.world,
      coverage: [...fixtures.lab.world.coverage, { minX: 16, maxX: 48, minZ: -16, maxZ: 16 }],
      neighbor: {
        version: "hvp-neighbor-world-v1",
        epoch: 1,
        resident: true,
        sourceDigest: neighborRoot.read().sourceDigest,
        baseSectorCount: primary.length
      },
      collisionDigest: hvpCollisionDigest(sectors)
    },
    neighbor: { version: "hvp-neighbor-scene-v1", terrain: neighborRoot.checkpoint(), lod: 0.125 }
  });
  const issued = decodeHvpLabGame(checkpoint);

  await expect(createChunkLab(sectors, issued)).rejects.toThrow(/Invalid neighbour collision geometry/);
  expectNoNativeAdmission();
});

it("rejects unissued, public-admitted, falsely profiled, and mismatched-collision values before fake Native", async () => {
  const sectors = makeChunkSectors();
  await expect(createChunkLab(sectors, fixtures.lab as unknown as HvpDecodedLabGame))
    .rejects.toThrow(/Unvalidated Hestia lab restore candidate/);
  const publicGame = decodeHvpGame(fixtures.legacy);
  await expect(createChunkLab(sectors, publicGame as unknown as HvpDecodedLabGame))
    .rejects.toThrow(/Unvalidated Hestia lab restore candidate/);

  const falseProfile = {
    ...fixtures.lab,
    profiles: { ...fixtures.lab.profiles, solver: { ...HVP_SOLVER_PROFILE, dynamicGyroscopicForces: true } }
  };
  expect(() => decodeHvpLabGame(resignLab(falseProfile))).toThrow(/schema\/profile/);

  const expectedDigest = hvpCollisionDigest(sectors);
  const wrongDigest = expectedDigest === "00000000" ? "ffffffff" : "00000000";
  const wrongCheckpoint = (() => {
    const { version: _version, profiles: _profiles, signature: _signature, ...data } = fixtures.lab;
    return encodeHvpLabGame({ ...data, world: { ...fixtures.lab.world, collisionDigest: wrongDigest } });
  })();
  await expect(createChunkLab(sectors, decodeHvpLabGame(wrongCheckpoint)))
    .rejects.toThrow(/Saved collision does not match candidate sources/);
  expect(nativeAdmission.pumpCreateCalls).toBe(0);
  expectNoNativeAdmission();
});

it("preserves the public restore guard and the direct LAB chunk-replacement guard", async () => {
  const sectors = makeChunkSectors();
  await expect(createHvpPhysicsSession(sectors, { x: 0, y: 4, z: 0 }, resolveHvpGravity(),
    undefined, undefined, undefined, "synthetic-codec", fixtures.legacy.world)).rejects.toThrow(/noch nicht freigegeben/);

  const issued = createLabGame(sectors);
  const chunkOwner = { staticTerrainLayout: () => layout } as unknown as HvpLabPhysicsSession;
  await expect(prepareHvpLabWorldReplacement(chunkOwner, issued, [], () => true))
    .rejects.toThrow(/Unsupported direct LAB chunk World replacement/);
  expect(nativeAdmission.pumpCreateCalls).toBe(0);
  expectNoNativeAdmission();
});
