// Generated from unchanged A/B behavior oracles; only B imports, variant labels and artifact prefix differ.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { R as A, initializeHvpRapier as initializeA } from "../snapshot/a/src/hestia-prototype/physics/rapierPort";
import { createHvpLocomotion as createLocomotionA, HVP_PLAYER_PROFILE as PLAYER_A } from "../snapshot/a/src/hestia-prototype/player/locomotion";
import { collisionSectors as collisionSectorsA } from "../snapshot/a/src/hestia-prototype/physics/terrainColliders";
import { ingestHvpStructuralCells as ingestA } from "../snapshot/a/src/hestia-prototype/terrain/structuralIngest";
import { installHvpRigidBody as installA, prepareHvpRigidBody as prepareA } from "../snapshot/a/src/hestia-prototype/physics/rigidBody";
import { captureHvpBodyHit as captureCutA, prepareHvpBodyCut as prepareCutA, stageHvpBodyCut as stageCutA } from "../snapshot/a/src/hestia-prototype/physics/bodyCut";
import { readHvpBodyCells as readBodyCellsA } from "../snapshot/a/src/hestia-prototype/physics/bodyCutPlan";
import { R as B, initializeHvpRapier as initializeB } from "../snapshot/c/src/hestia-prototype/physics/rapierPort";
import { createHvpLocomotion as createLocomotionB } from "../snapshot/c/src/hestia-prototype/player/locomotion";
import { collisionSectors as collisionSectorsB } from "../snapshot/c/src/hestia-prototype/physics/terrainColliders";
import { ingestHvpStructuralCells as ingestB } from "../snapshot/c/src/hestia-prototype/terrain/structuralIngest";
import { installHvpRigidBody as installB, prepareHvpRigidBody as prepareB } from "../snapshot/c/src/hestia-prototype/physics/rigidBody";
import { captureHvpBodyHit as captureCutB, prepareHvpBodyCut as prepareCutB, stageHvpBodyCut as stageCutB } from "../snapshot/c/src/hestia-prototype/physics/bodyCut";
import { readHvpBodyCells as readBodyCellsB } from "../snapshot/c/src/hestia-prototype/physics/bodyCutPlan";

type Vec = Readonly<{ x: number; y: number; z: number }>;
type Quat = Readonly<{ x: number; y: number; z: number; w: number }>;
type Player = ReturnType<typeof createLocomotionA>;
type PlayerRead = ReturnType<Player["read"]>;
type WalkRig = { player: Player; ticks(count: number): void; dispose(): void };
type StairRig = WalkRig & { surfaceAt(z: number): number; fixtureSha256: string };
type ResultStatus = "PASS" | "FAIL";
type CaseResult = {
  caseId: string;
  variant: string;
  status: ResultStatus;
  supplemental?: boolean;
  observed: Record<string, unknown>;
  error?: { name: string; message: string; stack: string | null };
};

const results: CaseResult[] = [];
const baselineStairDigests = new Map<number, string>();
const materials = [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "stone", destructible: true, tags: null }];
const lCells = [
  { x: 0, y: 0, z: 0, materialId: 1 },
  { x: 1, y: 0, z: 0, materialId: 1 },
  { x: 0, y: 1, z: 0, materialId: 1 }
];
const lineCells = [0, 1, 2].map(x => ({ x, y: 0, z: 0, materialId: 1 }));
const zero = { x: 0, y: 0, z: 0 };
const identity = { x: 0, y: 0, z: 0, w: 1 };
const expectedTensor = [
  [7 / 384, 1 / 192, 0],
  [1 / 192, 7 / 384, 0],
  [0, 0, 11 / 384]
];

function runCase(caseId: string, variant: string, body: (observed: Record<string, unknown>) => void,
  supplemental = false): void {
  const observed: Record<string, unknown> = {};
  let thrown: unknown;
  try { body(observed); } catch (error) { thrown = error; }
  const error = thrown === undefined ? undefined : thrown instanceof Error
    ? { name: thrown.name, message: thrown.message, stack: thrown.stack ?? null }
    : { name: typeof thrown, message: String(thrown), stack: null };
  results.push({ caseId, variant, status: error === undefined ? "PASS" : "FAIL",
    ...(supplemental ? { supplemental: true } : {}), observed, ...(error ? { error } : {}) });
  if (thrown !== undefined) { throw thrown; }
}

beforeAll(async () => { await Promise.all([initializeA(), initializeB()]); });
afterAll(() => {
  const label = process.env.PHY_RUN_LABEL;
  if (label === undefined || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(label)) {
    throw new Error("PHY_RUN_LABEL must be a unique lowercase run label");
  }
  mkdirSync(resolve("results"), { recursive: true });
  const expectedCaseCount = 19;
  const status = results.length === expectedCaseCount && results.every(result => result.status === "PASS") ? "PASS" : "FAIL";
  const output = resolve("results", `p2-candidate-${label}.json`);
  writeFileSync(output, JSON.stringify({ environment: "LOCAL_WINDOWS_ISOLATED", runLabel: label, status,
    expectedCaseCount, observedCaseCount: results.length, cases: results }, null, 2) + "\n", { flag: "wx" });
});

type LocomotionOps<W> = {
  createWorld(gravity: Vec): W;
  addFloor(world: W): void;
  addStairs(world: W, tread: number, fixInternalEdges: boolean): void;
  stepWorld(world: W): void;
  freeWorld(world: W): void;
  createPlayer(world: W): Player;
};

const stairSource = (tread: number) => ({
  sizeX: 16, sizeY: 16, sizeZ: 64, cellMeters: 0.125,
  originMeters: { x: -1, y: -0.125, z: -6 },
  readSlot: (_x: number, y: number, z: number) => y <= Math.min(8, Math.max(0, Math.floor((40 - z) / tread))) ? 1 : 0
});

function stairFixtureSha256(tread: number): string {
  const source = stairSource(tread);
  const slots = new Uint8Array(source.sizeX * source.sizeY * source.sizeZ);
  for (let z = 0; z < source.sizeZ; z += 1) {
    for (let y = 0; y < source.sizeY; y += 1) {
      for (let x = 0; x < source.sizeX; x += 1) {
        slots[x + y * source.sizeX + z * source.sizeX * source.sizeY] = source.readSlot(x, y, z);
      }
    }
  }
  return createHash("sha256").update(JSON.stringify({
    sizeX: source.sizeX, sizeY: source.sizeY, sizeZ: source.sizeZ, cellMeters: source.cellMeters,
    originMeters: source.originMeters, tread
  })).update(slots).digest("hex");
}

function surfaceAt(tread: number, z: number): number {
  const zCell = Math.max(0, Math.min(63, Math.floor((z + 6) / 0.125)));
  const topCell = Math.min(8, Math.max(0, Math.floor((40 - zCell) / tread)));
  return topCell * 0.125;
}

function makeWalkRig<W>(ops: LocomotionOps<W>): WalkRig;
function makeWalkRig<W>(ops: LocomotionOps<W>, tread: number, fixInternalEdges?: boolean): StairRig;
function makeWalkRig<W>(ops: LocomotionOps<W>, tread?: number, fixInternalEdges = false): WalkRig | StairRig {
  const world = ops.createWorld({ x: 0, y: -9.81, z: 0 });
  if (tread === undefined) { ops.addFloor(world); }
  else { ops.addStairs(world, tread, fixInternalEdges); ops.stepWorld(world); }
  const player = ops.createPlayer(world);
  player.setEnabled(true);
  const rig = {
    player,
    ticks: (count: number) => { for (let i = 0; i < count; i += 1) { player.step(); ops.stepWorld(world); } },
    dispose: () => { player.dispose(); ops.freeWorld(world); }
  };
  return tread === undefined ? rig : { ...rig, surfaceAt: (z: number) => surfaceAt(tread, z), fixtureSha256: stairFixtureSha256(tread) };
}

const locomotionA: LocomotionOps<InstanceType<typeof A.World>> = {
  createWorld: gravity => { const world = new A.World(gravity); world.timestep = 1 / 60; return world; },
  addFloor: world => { world.createCollider(A.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0)); },
  addStairs: (world, tread, fixInternalEdges) => {
    if (fixInternalEdges) { throw new Error("FIX_INTERNAL_EDGES is not part of the 0.12 control API"); }
    for (const sector of collisionSectorsA(stairSource(tread))) { world.createCollider(A.ColliderDesc.trimesh(sector.vertices, sector.indices)); }
  },
  stepWorld: world => { world.step(); },
  freeWorld: world => { world.free(); },
  createPlayer: world => createLocomotionA(world, { x: 0, y: 0.92, z: 0 }, 9.81, () => true)
};

const locomotionB: LocomotionOps<InstanceType<typeof B.World>> = {
  createWorld: gravity => { const world = new B.World(gravity); world.timestep = 1 / 60; return world; },
  addFloor: world => { world.createCollider(B.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0)); },
  addStairs: (world, tread, fixInternalEdges) => {
    const flags = fixInternalEdges ? B.TriMeshFlags.FIX_INTERNAL_EDGES : undefined;
    for (const sector of collisionSectorsB(stairSource(tread))) {
      world.createCollider(B.ColliderDesc.trimesh(sector.vertices, sector.indices, flags));
    }
  },
  stepWorld: world => { world.step(); },
  freeWorld: world => { world.free(); },
  createPlayer: world => createLocomotionB(world, { x: 0, y: 0.92, z: 0 }, 9.81, () => true)
};

type LocomotionVariantId = "rapier-0.12.0" | "rapier-0.21.0-phy01.migration2";

function walkObservation(variant: LocomotionVariantId): Record<string, unknown> {
  const rig = variant === "rapier-0.12.0" ? makeWalkRig(locomotionA) : makeWalkRig(locomotionB);
  try {
    rig.ticks(10);
    const settled = rig.player.read();
    rig.player.setInput({ x: 0, z: -1, sprint: false, jump: false });
    rig.ticks(60);
    const read = rig.player.read();
    const distanceMeters = Math.hypot(read.position.x, read.position.z);
    return { floor: "cuboid half-extents=(10,0.5,10), topY=0", settleSteps: 10, inputSteps: 60,
      requestedSpeedMetersPerSecond: 3, settled, final: read, distanceMeters, absoluteDistanceErrorMeters: Math.abs(distanceMeters - 3) };
  } finally { rig.dispose(); }
}

function stairsObservation(variant: LocomotionVariantId, tread: number, fixInternalEdges = false): Record<string, unknown> {
  const rig = variant === "rapier-0.12.0" ? makeWalkRig(locomotionA, tread) : makeWalkRig(locomotionB, tread, fixInternalEdges);
  try {
    rig.ticks(10);
    rig.player.setInput({ x: 0, z: -1, sprint: false, jump: false });
    const samples: Array<{ step: number; z: number; feetY: number; surfaceY: number; gapMeters: number; grounded: boolean; noPenetration: boolean }> = [];
    for (let step = 1; step <= 100; step += 1) {
      rig.ticks(1);
      const read = rig.player.read();
      const feetY = read.position.y - PLAYER_A.height / 2;
      const surfaceY = rig.surfaceAt(read.position.z);
      const gapMeters = feetY - surfaceY;
      samples.push({ step, z: read.position.z, feetY, surfaceY, gapMeters, grounded: read.grounded, noPenetration: gapMeters >= -0.001 });
    }
    const final = rig.player.read();
    return { fixture: "canonical-0.125m-stairs", fixtureSha256: rig.fixtureSha256, treadCells: tread,
      stepHeightMeters: 0.125, settleSteps: 10, inputSteps: 100, fixInternalEdges,
      final, samples, groundedSteps: samples.filter(sample => sample.grounded).length,
      firstGroundedStep: samples.find(sample => sample.grounded)?.step ?? null,
      noPenetration: samples.every(sample => sample.noPenetration),
      maxPenetrationMeters: Math.max(0, ...samples.map(sample => -sample.gapMeters)) };
  } finally { rig.dispose(); }
}

function registerSleepCases<W, F, Body extends NativeBody>(variant: string, ops: SleepOps<W, F, Body>): void {
  it(`tracks automatic FirstSleep and every finite state across 1200 fall-cube steps on ${variant}`, () => {
    runCase("fall-cube-first-sleep-1200", variant, observed => {
      const measurement = fallCubeObservation(ops);
      Object.assign(observed, measurement);
      expect(measurement.firstSleepStep).not.toBeNull();
      expect(measurement.finiteSteps).toBe(1200);
      expect(measurement.firstNonFiniteStep).toBeNull();
      expect(measurement.finalSleeping).toBe(true);
      expect(measurement.touchingFloor).toBe(true);
    });
  });
  it(`records manual sleep plus impulse wake without changing thresholds on ${variant}`, () => {
    runCase("manual-sleep-impulse-wake", variant, observed => {
      const measurement = manualWakeObservation(ops);
      Object.assign(observed, measurement);
      const final = measurement.final as NativeState;
      expect(measurement.sleepingAfterManualSleep).toBe(true);
      expect(measurement.sleepingAfterImpulse).toBe(false);
      expect(final.linearVelocity.x).toBeCloseTo(3, 6);
      expect(finiteState(final)).toBe(true);
    });
  });
}

type NativeBody = {
  translation(): Vec;
  rotation(): Quat;
  linvel(): Vec;
  angvel(): Vec;
  mass(): number;
  localCom(): Vec;
  principalInertia(): Vec;
  principalInertiaLocalFrame(): Quat;
  setLinvel(value: Vec, wakeUp: boolean): void;
  setAngvel(value: Vec, wakeUp: boolean): void;
  applyImpulse(value: Vec, wakeUp: boolean): void;
  applyTorqueImpulse(value: Vec, wakeUp: boolean): void;
  isSleeping(): boolean;
  sleep(): void;
};

type NativeState = {
  position: Vec;
  rotation: Quat;
  linearVelocity: Vec;
  angularVelocity: Vec;
  massKg: number;
  localCom: Vec;
  principalInertia: Vec;
  principalFrame: Quat;
};

function nativeState(body: NativeBody): NativeState {
  return { position: { ...body.translation() }, rotation: { ...body.rotation() },
    linearVelocity: { ...body.linvel() }, angularVelocity: { ...body.angvel() }, massKg: body.mass(),
    localCom: { ...body.localCom() }, principalInertia: { ...body.principalInertia() },
    principalFrame: { ...body.principalInertiaLocalFrame() } };
}

function finiteState(state: NativeState): boolean {
  return [state.position.x, state.position.y, state.position.z, state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w,
    state.linearVelocity.x, state.linearVelocity.y, state.linearVelocity.z, state.angularVelocity.x, state.angularVelocity.y,
    state.angularVelocity.z, state.massKg, state.localCom.x, state.localCom.y, state.localCom.z, state.principalInertia.x,
    state.principalInertia.y, state.principalInertia.z, state.principalFrame.x, state.principalFrame.y,
    state.principalFrame.z, state.principalFrame.w].every(Number.isFinite);
}

type SleepOps<W, F, Body extends NativeBody> = {
  createWorld(gravity: Vec): W;
  addFloor(world: W): F;
  createCube(world: W, origin: Vec): Body;
  stepWorld(world: W): void;
  freeWorld(world: W): void;
  touchingFloor(world: W, floor: F, body: Body): boolean;
};

type AWorld = InstanceType<typeof A.World>;
type BWorld = InstanceType<typeof B.World>;
type ABody = ReturnType<AWorld["createRigidBody"]>;
type BBody = ReturnType<BWorld["createRigidBody"]>;
type AFloor = ReturnType<AWorld["createCollider"]>;
type BFloor = ReturnType<BWorld["createCollider"]>;

const sleepOpsA: SleepOps<AWorld, AFloor, ABody> = {
  createWorld: gravity => { const world = new A.World(gravity); world.timestep = 1 / 60; return world; },
  addFloor: world => world.createCollider(A.ColliderDesc.cuboid(2, 0.5, 2).setTranslation(0, -0.5, 0)),
  createCube: (world, origin) => {
    const recipe = prepareA(ingestA("p2-fall-cube", [{ x: 0, y: 0, z: 0, materialId: 1 }], materials));
    return installA(world, recipe, { translationMeters: origin, rotation: identity });
  },
  stepWorld: world => { world.step(); },
  freeWorld: world => { world.free(); },
  touchingFloor: (world, floor, body) => { let touching = false; world.contactPair(floor, body.collider(0), () => { touching = true; }); return touching; }
};

const sleepOpsB: SleepOps<BWorld, BFloor, BBody> = {
  createWorld: gravity => { const world = new B.World(gravity); world.timestep = 1 / 60; return world; },
  addFloor: world => world.createCollider(B.ColliderDesc.cuboid(2, 0.5, 2).setTranslation(0, -0.5, 0)),
  createCube: (world, origin) => {
    const recipe = prepareB(ingestB("p2-fall-cube", [{ x: 0, y: 0, z: 0, materialId: 1 }], materials));
    return installB(world, recipe, { translationMeters: origin, rotation: identity });
  },
  stepWorld: world => { world.step(); },
  freeWorld: world => { world.free(); },
  touchingFloor: (world, floor, body) => { let touching = false; world.contactPair(floor, body.collider(0), () => { touching = true; }); return touching; }
};

function fallCubeObservation<W, F, Body extends NativeBody>(ops: SleepOps<W, F, Body>): Record<string, unknown> {
  const world = ops.createWorld({ x: 0, y: -9.81, z: 0 });
  try {
    const floor = ops.addFloor(world);
    const body = ops.createCube(world, { x: 0, y: 2, z: 0 });
    let firstSleepStep: number | null = null;
    let firstSleepState: NativeState | null = null;
    let firstNonFiniteStep: number | null = null;
    let finiteSteps = 0;
    const stateTrace = createHash("sha256");
    for (let step = 1; step <= 1200; step += 1) {
      ops.stepWorld(world);
      const state = nativeState(body);
      stateTrace.update(JSON.stringify({ step, state, sleeping: body.isSleeping() })).update("\n");
      if (finiteState(state)) { finiteSteps += 1; }
      else if (firstNonFiniteStep === null) { firstNonFiniteStep = step; }
      if (firstSleepStep === null && body.isSleeping()) { firstSleepStep = step; firstSleepState = state; }
    }
    const final = nativeState(body);
    return { fixture: "one 0.125m cube, floor topY=0", steps: 1200, firstSleepStep, firstSleepState,
      firstNonFiniteStep, finiteSteps, stateTraceSha256: stateTrace.digest("hex"),
      finalSleeping: body.isSleeping(), final, touchingFloor: ops.touchingFloor(world, floor, body),
      bodyOriginY: final.position.y - 1 / 16 };
  } finally { ops.freeWorld(world); }
}

function manualWakeObservation<W, Body extends NativeBody>(ops: Pick<SleepOps<W, unknown, Body>, "createWorld" | "createCube" | "freeWorld">): Record<string, unknown> {
  const world = ops.createWorld({ x: 0, y: 0, z: 0 });
  try {
    const body = ops.createCube(world, zero);
    body.sleep();
    const sleepingAfterManualSleep = body.isSleeping();
    body.applyImpulse({ x: 3, y: 0, z: 0 }, true);
    const final = nativeState(body);
    return { policy: "manual sleep() then applyImpulse(..., true); no threshold setter", sleepingAfterManualSleep,
      sleepingAfterImpulse: body.isSleeping(), final };
  } finally { ops.freeWorld(world); }
}

function rotate(q: Quat, value: Vec): Vec {
  const t = { x: 2 * (q.y * value.z - q.z * value.y), y: 2 * (q.z * value.x - q.x * value.z), z: 2 * (q.x * value.y - q.y * value.x) };
  return { x: value.x + q.w * t.x + q.y * t.z - q.z * t.y,
    y: value.y + q.w * t.y + q.z * t.x - q.x * t.z,
    z: value.z + q.w * t.z + q.x * t.y - q.y * t.x };
}

function nativeTensorMeasurement(body: NativeBody): Record<string, unknown> {
  const principal = { ...body.principalInertia() };
  const frame = { ...body.principalInertiaLocalFrame() };
  const axes: Array<"x" | "y" | "z"> = ["x", "y", "z"];
  const basis: Vec[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
  const columns = basis.map(axis => rotate(frame, axis));
  const values = [principal.x, principal.y, principal.z];
  const matrix = axes.map(row => axes.map(column => columns.reduce((sum, axis, index) =>
    sum + axis[row] * values[index]! * axis[column], 0)));
  const tensorColumns: Vec[] = [
    { x: 7 / 384, y: 1 / 192, z: 0 },
    { x: 1 / 192, y: 7 / 384, z: 0 },
    { x: 0, y: 0, z: 11 / 384 }
  ];
  const torqueImpulses = tensorColumns.map((impulse, index) => {
    body.setAngvel(zero, true);
    body.applyTorqueImpulse(impulse, true);
    const angularVelocity = { ...body.angvel() };
    const expected = basis[index]!;
    return { impulse, expected, angularVelocity,
      matches: Math.hypot(angularVelocity.x - expected.x, angularVelocity.y - expected.y, angularVelocity.z - expected.z) <= 0.0001 };
  });
  body.setLinvel(zero, true);
  body.applyImpulse({ x: 3, y: 0, z: 0 }, true);
  const linearVelocityAfter3Ns = { ...body.linvel() };
  const matrixError = Math.max(...matrix.flatMap((row, i) => row.map((value, j) => Math.abs(value - expectedTensor[i]![j]!))));
  // f32 principal values/frame feed a quaternion matrix: allow 32 input-scale ulps, still below the historical 1e-5 bound.
  const matrixTolerance = 32 * 2 ** -23 * Math.max(...expectedTensor.flat().map(Math.abs));
  return { massKg: body.mass(), localCom: { ...body.localCom() }, principal, frame, reconstructedTensor: matrix,
    expectedTensor, matrixError, matrixTolerance, nativeTensorMatchesOracle: matrixError <= matrixTolerance,
    linearImpulseNs: { x: 3, y: 0, z: 0 }, linearVelocityAfter3Ns,
    torqueImpulses, torqueImpulsesMatch: torqueImpulses.every(result => result.matches) };
}

function tensorObservationA(): Record<string, unknown> {
  const world = new A.World({ x: 0, y: 0, z: 0 });
  try {
    world.timestep = 1e-6;
    const recipe = prepareA(ingestA("p2-l-body", lCells, materials));
    const body = installA(world, recipe);
    world.step();
    return { sourceContentHash: recipe.source.contentHash, sourceObjectId: recipe.source.objectId,
      productMassKg: recipe.mass.totalMassKg, productCenterOfMass: recipe.mass.centerOfMassMeters,
      productTensor: recipe.mass.inertiaTensorKgMetersSquared, ...nativeTensorMeasurement(body) };
  } finally { world.free(); }
}

function tensorObservationB(): Record<string, unknown> {
  const world = new B.World({ x: 0, y: 0, z: 0 });
  try {
    world.timestep = 1e-6;
    const recipe = prepareB(ingestB("p2-l-body", lCells, materials));
    const body = installB(world, recipe);
    world.step();
    return { sourceContentHash: recipe.source.contentHash, sourceObjectId: recipe.source.objectId,
      productMassKg: recipe.mass.totalMassKg, productCenterOfMass: recipe.mass.centerOfMassMeters,
      productTensor: recipe.mass.inertiaTensorKgMetersSquared, ...nativeTensorMeasurement(body) };
  } finally { world.free(); }
}

function movingRecutObservationA(): Record<string, unknown> {
  const world = new A.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  try {
    const floor = world.createCollider(A.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0));
    const recipe = prepareA(ingestA("p2-moving-recut", lineCells, materials));
    const body = installA(world, recipe, { translationMeters: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 } });
    const target = { ownerId: "p2-moving-parent", body, recipe };
    world.step();
    const afterInitialStep = nativeState(body);
    const hit = captureCutA(world, new Map([[target.ownerId, target]]),
      { x: 0.9375, y: 2.1875, z: 2 }, { x: 0, y: 0, z: 1 }, 1);
    if (!hit) { throw new Error("Rotated three-cell parent was not hit after its explicit initial step"); }
    const plan = prepareCutA(hit, target, "p2-moving-recut", 1);
    body.setLinvel({ x: 1, y: 2, z: 3 }, true);
    body.setAngvel({ x: 0, y: 0, z: 2 }, true);
    const stage = stageCutA(world, target, plan);
    const parentAtStage = { position: stage.parentPose.position, rotation: stage.parentPose.rotation,
      velocity: stage.parentPose.velocity, angularVelocity: stage.parentPose.angularVelocity };
    const sourceOracle = lineCells.filter(cell => cell.x !== 1).map(cell => `${cell.x}:${cell.y}:${cell.z}`).sort();
    const children = stage.result.parts.map(part => {
      const issued = plan.local.plan.parts.find(candidate => candidate.ownerId === part.ownerId);
      if (!issued) { throw new Error("Missing source recipe for a committed recut child"); }
      return { ownerId: part.ownerId, objectId: issued.recipe.source.objectId, contentHash: issued.recipe.source.contentHash,
        cells: readBodyCellsA(issued.recipe.source).map(cell => `${cell.x}:${cell.y}:${cell.z}`).sort(), massKg: part.body.mass() };
    });
    const parentHandle = body.handle;
    const removedMassKg = stage.removedMomentum.massKg;
    stage.commit();
    stage.finalize();
    const bodiesAfterFinalize = world.bodies.len();
    const collidersAfterFinalize = world.colliders.len();
    const childBodies = stage.result.parts.map(part => part.body);
    const firstSleepSteps: Array<number | null> = childBodies.map(() => null);
    let finiteStateChecks = 0;
    let firstNonFiniteStep: number | null = null;
    const stateTrace = createHash("sha256");
    for (let step = 1; step <= 1200; step += 1) {
      world.step();
      for (const [index, child] of childBodies.entries()) {
        const state = nativeState(child);
        stateTrace.update(JSON.stringify({ step, index, state, sleeping: child.isSleeping() })).update("\n");
        if (finiteState(state)) { finiteStateChecks += 1; }
        else if (firstNonFiniteStep === null) { firstNonFiniteStep = step; }
        if (firstSleepSteps[index] === null && child.isSleeping()) { firstSleepSteps[index] = step; }
      }
    }
    const finalStates = childBodies.map(nativeState);
    const floorContacts = childBodies.map(child => {
      let touching = false;
      world.contactPair(floor, child.collider(0), () => { touching = true; });
      return touching;
    });
    let childrenContact = false;
    world.contactPair(childBodies[0]!.collider(0), childBodies[1]!.collider(0), () => { childrenContact = true; });
    return { initialWorldStepsBeforeHit: 1, afterInitialStep, sourceObjectId: recipe.source.objectId,
      sourceContentHash: recipe.source.contentHash, hitCell: hit.cell, issuedTick: hit.issuedTick, parentAtStage,
      expectedMotion: { velocity: { x: 1, y: 2, z: 3 }, angularVelocity: { x: 0, y: 0, z: 2 } },
      sourceOracle, children, removedMassKg,
      parentRemoved: world.getRigidBody(parentHandle) === null, bodiesAfterFinalize, collidersAfterFinalize,
      finiteSteps: 1200, finiteStateChecks, firstNonFiniteStep, firstSleepSteps,
      stateTraceSha256: stateTrace.digest("hex"), finalSleeping: childBodies.map(child => child.isSleeping()), finalStates, floorContacts, childrenContact,
      bodiesAtEnd: world.bodies.len(), collidersAtEnd: world.colliders.len() };
  } finally { world.free(); }
}

function movingRecutObservationB(): Record<string, unknown> {
  const world = new B.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  try {
    const floor = world.createCollider(B.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0));
    const recipe = prepareB(ingestB("p2-moving-recut", lineCells, materials));
    const body = installB(world, recipe, { translationMeters: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 } });
    const target = { ownerId: "p2-moving-parent", body, recipe };
    world.step();
    const afterInitialStep = nativeState(body);
    const hit = captureCutB(world, new Map([[target.ownerId, target]]),
      { x: 0.9375, y: 2.1875, z: 2 }, { x: 0, y: 0, z: 1 }, 1);
    if (!hit) { throw new Error("Rotated three-cell parent was not hit after its explicit initial step"); }
    const plan = prepareCutB(hit, target, "p2-moving-recut", 1);
    body.setLinvel({ x: 1, y: 2, z: 3 }, true);
    body.setAngvel({ x: 0, y: 0, z: 2 }, true);
    const stage = stageCutB(world, target, plan);
    const parentAtStage = { position: stage.parentPose.position, rotation: stage.parentPose.rotation,
      velocity: stage.parentPose.velocity, angularVelocity: stage.parentPose.angularVelocity };
    const sourceOracle = lineCells.filter(cell => cell.x !== 1).map(cell => `${cell.x}:${cell.y}:${cell.z}`).sort();
    const children = stage.result.parts.map(part => {
      const issued = plan.local.plan.parts.find(candidate => candidate.ownerId === part.ownerId);
      if (!issued) { throw new Error("Missing source recipe for a committed recut child"); }
      return { ownerId: part.ownerId, objectId: issued.recipe.source.objectId, contentHash: issued.recipe.source.contentHash,
        cells: readBodyCellsB(issued.recipe.source).map(cell => `${cell.x}:${cell.y}:${cell.z}`).sort(), massKg: part.body.mass() };
    });
    const parentHandle = body.handle;
    const removedMassKg = stage.removedMomentum.massKg;
    stage.commit();
    stage.finalize();
    const bodiesAfterFinalize = world.bodies.len();
    const collidersAfterFinalize = world.colliders.len();
    const childBodies = stage.result.parts.map(part => part.body);
    const firstSleepSteps: Array<number | null> = childBodies.map(() => null);
    let finiteStateChecks = 0;
    let firstNonFiniteStep: number | null = null;
    const stateTrace = createHash("sha256");
    for (let step = 1; step <= 1200; step += 1) {
      world.step();
      for (const [index, child] of childBodies.entries()) {
        const state = nativeState(child);
        stateTrace.update(JSON.stringify({ step, index, state, sleeping: child.isSleeping() })).update("\n");
        if (finiteState(state)) { finiteStateChecks += 1; }
        else if (firstNonFiniteStep === null) { firstNonFiniteStep = step; }
        if (firstSleepSteps[index] === null && child.isSleeping()) { firstSleepSteps[index] = step; }
      }
    }
    const finalStates = childBodies.map(nativeState);
    const floorContacts = childBodies.map(child => {
      let touching = false;
      world.contactPair(floor, child.collider(0), () => { touching = true; });
      return touching;
    });
    let childrenContact = false;
    world.contactPair(childBodies[0]!.collider(0), childBodies[1]!.collider(0), () => { childrenContact = true; });
    return { initialWorldStepsBeforeHit: 1, afterInitialStep, sourceObjectId: recipe.source.objectId,
      sourceContentHash: recipe.source.contentHash, hitCell: hit.cell, issuedTick: hit.issuedTick, parentAtStage,
      expectedMotion: { velocity: { x: 1, y: 2, z: 3 }, angularVelocity: { x: 0, y: 0, z: 2 } },
      sourceOracle, children, removedMassKg,
      parentRemoved: world.getRigidBody(parentHandle) === null, bodiesAfterFinalize, collidersAfterFinalize,
      finiteSteps: 1200, finiteStateChecks, firstNonFiniteStep, firstSleepSteps,
      stateTraceSha256: stateTrace.digest("hex"), finalSleeping: childBodies.map(child => child.isSleeping()), finalStates, floorContacts, childrenContact,
      bodiesAtEnd: world.bodies.len(), collidersAtEnd: world.colliders.len() };
  } finally { world.free(); }
}

describe("PHY-01 P2 real-WASM behavior probes", () => {
  it("keeps the 3 m/s cuboid-floor walk within 1 cm after 10 settle and 60 input steps on 0.12", () => {
    runCase("walking-60-steps", "rapier-0.12.0", observed => {
      const measurement = walkObservation("rapier-0.12.0");
      Object.assign(observed, measurement);
      expect(measurement.absoluteDistanceErrorMeters).toBeLessThanOrEqual(0.01);
      expect((measurement.final as PlayerRead).grounded).toBe(true);
    });
  });

  it("keeps the 3 m/s cuboid-floor walk within 1 cm after 10 settle and 60 input steps on 0.21", () => {
    runCase("walking-60-steps", "rapier-0.21.0-phy01.migration2", observed => {
      const measurement = walkObservation("rapier-0.21.0-phy01.migration2");
      Object.assign(observed, measurement);
      expect(measurement.absoluteDistanceErrorMeters).toBeLessThanOrEqual(0.01);
      expect((measurement.final as PlayerRead).grounded).toBe(true);
    });
  });

  for (const tread of [1, 2, 4]) {
    it(`retains the real 0.12 stairs oracle for ${tread}-cell treads`, () => {
      runCase(`stairs-tread-${tread}`, "rapier-0.12.0", observed => {
        const measurement = stairsObservation("rapier-0.12.0", tread);
        Object.assign(observed, measurement);
        const digest = measurement.fixtureSha256;
        if (typeof digest !== "string") { throw new Error("Missing independent stairs fixture digest"); }
        baselineStairDigests.set(tread, digest);
        const final = measurement.final as PlayerRead;
        expect(final.position.z).toBeLessThan(-3.5);
        expect(final.position.y).toBeGreaterThan(1.6);
        expect(final.jumpCount).toBe(0);
        expect(final.grounded).toBe(true);
        expect(measurement.noPenetration).toBe(true);
      });
    });
    it(`records the 0.21 stairs migration result for ${tread}-cell treads`, () => {
      runCase(`stairs-tread-${tread}`, "rapier-0.21.0-phy01.migration2", observed => {
        const measurement = stairsObservation("rapier-0.21.0-phy01.migration2", tread);
        Object.assign(observed, measurement);
        const digest = measurement.fixtureSha256;
        if (typeof digest !== "string") { throw new Error("Missing independent stairs fixture digest"); }
        expect(digest).toBe(baselineStairDigests.get(tread));
        const final = measurement.final as PlayerRead;
        expect(final.position.z).toBeLessThan(-3.5);
        expect(final.position.y).toBeGreaterThan(1.6);
        expect(final.jumpCount).toBe(0);
        expect(final.grounded).toBe(true);
        expect(measurement.noPenetration).toBe(true);
      });
    });
    it(`supplementally tests the actual 0.21 FIX_INTERNAL_EDGES=144 flag on ${tread}-cell stairs`, () => {
      runCase(`stairs-fix-internal-edges-${tread}`, "rapier-0.21.0-phy01.migration2", observed => {
        Object.assign(observed, { actualDtsFlag: B.TriMeshFlags.FIX_INTERNAL_EDGES });
        expect(B.TriMeshFlags.FIX_INTERNAL_EDGES).toBe(144);
        const measurement = stairsObservation("rapier-0.21.0-phy01.migration2", tread, true);
        Object.assign(observed, measurement, { supplemental: true, changedParameter: "TriMeshFlags.FIX_INTERNAL_EDGES" });
        expect(measurement.fixtureSha256).toBe(baselineStairDigests.get(tread));
        const final = measurement.final as PlayerRead;
        expect(final.position.z).toBeLessThan(-3.5);
        expect(final.position.y).toBeGreaterThan(1.6);
        expect(final.jumpCount).toBe(0);
        expect(final.grounded).toBe(true);
        expect(measurement.noPenetration).toBe(true);
      }, true);
    });
  }

  registerSleepCases("rapier-0.12.0", sleepOpsA);
  registerSleepCases("rapier-0.21.0-phy01.migration2", sleepOpsB);

  it("reconstructs the hand-derived 3-cell L tensor and torque columns on 0.12", () => {
    runCase("l-body-native-full-tensor-and-impulses", "rapier-0.12.0", observed => {
      const measurement = tensorObservationA();
      Object.assign(observed, measurement, { numericalInterpretation: "f32 reconstruction; this fixture does not infer the historical density-path bug" });
      expect(measurement.productMassKg).toBe(3);
      expect(measurement.productCenterOfMass).toEqual({ x: 5 / 48, y: 5 / 48, z: 1 / 16 });
      expect(measurement.nativeTensorMatchesOracle).toBe(true);
      expect(measurement.torqueImpulsesMatch).toBe(true);
      expect((measurement.linearVelocityAfter3Ns as Vec).x).toBeCloseTo(1, 6);
      expect(measurement.massKg).toBeCloseTo(3, 6);
      const com = measurement.localCom as Vec;
      expect(Math.hypot(com.x, com.y, com.z)).toBeLessThan(1e-6);
    });
  });

  it("reconstructs the hand-derived 3-cell L tensor and torque columns on 0.21", () => {
    runCase("l-body-native-full-tensor-and-impulses", "rapier-0.21.0-phy01.migration2", observed => {
      const measurement = tensorObservationB();
      Object.assign(observed, measurement);
      expect(measurement.productMassKg).toBe(3);
      expect(measurement.productCenterOfMass).toEqual({ x: 5 / 48, y: 5 / 48, z: 1 / 16 });
      expect(measurement.nativeTensorMatchesOracle).toBe(true);
      expect(measurement.torqueImpulsesMatch).toBe(true);
      expect((measurement.linearVelocityAfter3Ns as Vec).x).toBeCloseTo(1, 6);
      expect(measurement.massKg).toBeCloseTo(3, 6);
      const com = measurement.localCom as Vec;
      expect(Math.hypot(com.x, com.y, com.z)).toBeLessThan(1e-6);
    });
  });

  it("diagnoses one-step rotated 3-cell motion before real 0.12 commit/finalize and sleeping read", () => {
    runCase("moving-rotated-three-cell-recut-1200", "rapier-0.12.0", observed => {
      const measurement = movingRecutObservationA();
      Object.assign(observed, measurement);
      expect(measurement.initialWorldStepsBeforeHit).toBe(1);
      expect(measurement.hitCell).toEqual([1, 0, 0]);
      expect(measurement.parentAtStage).toMatchObject({ velocity: { x: 1, y: 2, z: 3 }, angularVelocity: { x: 0, y: 0, z: 2 } });
      expect(measurement.children).toHaveLength(2);
      const children = measurement.children as Array<{ ownerId: string; objectId: string; cells: string[]; massKg: number }>;
      expect(children.flatMap(child => child.cells).sort()).toEqual(measurement.sourceOracle);
      expect(new Set(children.map(child => child.ownerId)).size).toBe(2);
      expect(new Set(children.map(child => child.objectId)).size).toBe(2);
      expect(children.every(child => child.objectId !== measurement.sourceObjectId)).toBe(true);
      expect(children.every(child => child.cells.length === 1 && child.massKg === 1)).toBe(true);
      expect(children.reduce((sum, child) => sum + child.massKg, 0) + Number(measurement.removedMassKg)).toBeCloseTo(3, 6);
      expect(measurement.parentRemoved).toBe(true);
      expect(measurement.bodiesAfterFinalize).toBe(2);
      expect(measurement.collidersAfterFinalize).toBe(3);
      expect(measurement.finiteStateChecks).toBe(2400);
      expect(measurement.firstNonFiniteStep).toBeNull();
      expect(measurement.firstSleepSteps).toEqual([expect.any(Number), expect.any(Number)]);
      expect(measurement.finalSleeping).toEqual([true, true]);
      expect(measurement.finalStates).toHaveLength(2);
      expect(measurement.floorContacts).toEqual([true, true]);
      expect(measurement.childrenContact).toBe(false);
      expect(measurement.bodiesAtEnd).toBe(2);
      expect(measurement.collidersAtEnd).toBe(3);
    });
  });

  it("diagnoses one-step rotated 3-cell motion before real 0.21 commit/finalize and sleeping read", () => {
    runCase("moving-rotated-three-cell-recut-1200", "rapier-0.21.0-phy01.migration2", observed => {
      const measurement = movingRecutObservationB();
      Object.assign(observed, measurement);
      expect(measurement.initialWorldStepsBeforeHit).toBe(1);
      expect(measurement.hitCell).toEqual([1, 0, 0]);
      expect(measurement.parentAtStage).toMatchObject({ velocity: { x: 1, y: 2, z: 3 }, angularVelocity: { x: 0, y: 0, z: 2 } });
      expect(measurement.children).toHaveLength(2);
      const children = measurement.children as Array<{ ownerId: string; objectId: string; cells: string[]; massKg: number }>;
      expect(children.flatMap(child => child.cells).sort()).toEqual(measurement.sourceOracle);
      expect(new Set(children.map(child => child.ownerId)).size).toBe(2);
      expect(new Set(children.map(child => child.objectId)).size).toBe(2);
      expect(children.every(child => child.objectId !== measurement.sourceObjectId)).toBe(true);
      expect(children.every(child => child.cells.length === 1 && child.massKg === 1)).toBe(true);
      expect(children.reduce((sum, child) => sum + child.massKg, 0) + Number(measurement.removedMassKg)).toBeCloseTo(3, 6);
      expect(measurement.parentRemoved).toBe(true);
      expect(measurement.bodiesAfterFinalize).toBe(2);
      expect(measurement.collidersAfterFinalize).toBe(3);
      expect(measurement.finiteStateChecks).toBe(2400);
      expect(measurement.firstNonFiniteStep).toBeNull();
      expect(measurement.firstSleepSteps).toEqual([expect.any(Number), expect.any(Number)]);
      expect(measurement.finalSleeping).toEqual([true, true]);
      expect(measurement.finalStates).toHaveLength(2);
      expect(measurement.floorContacts).toEqual([true, true]);
      expect(measurement.childrenContact).toBe(false);
      expect(measurement.bodiesAtEnd).toBe(2);
      expect(measurement.collidersAtEnd).toBe(3);
    });
  });
});
