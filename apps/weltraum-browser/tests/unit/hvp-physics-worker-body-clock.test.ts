import { expect, it, vi } from "vitest";
import { collisionSectors } from "../../src/hestia-prototype/physics/terrainColliders";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";
import { prepareHvpLocalBodyCut } from "../../src/hestia-prototype/physics/bodyCutPlan";
import type { HvpPhysicsMessage, HvpPhysicsReply,HvpPhysicsRequest } from "../../src/hestia-prototype/physics/physicsWorker";

type WorkerHost = {
  onmessage?: (event: MessageEvent<HvpPhysicsMessage>) => void | Promise<void>;
  postMessage?: (reply: HvpPhysicsReply) => void;
};
type BodyClock = NonNullable<HvpPhysicsReply["clock"]>;
type BodySnapshot = NonNullable<HvpPhysicsReply["snapshot"]>;
type BodyCutResult = {
  readonly status: string;
  readonly ticks: number;
  readonly backlogSeconds: number;
  readonly discardedSeconds: number;
  readonly bodyCount: number;
  readonly colliderCount: number;
  readonly bodies: BodySnapshot["bodies"];
  readonly moving: BodySnapshot["moving"];
  readonly structural: BodySnapshot["structural"];
};

const bodyCutResult = (snapshot: BodySnapshot): BodyCutResult => ({
  status: snapshot.status,
  ticks: snapshot.ticks,
  backlogSeconds: snapshot.backlogSeconds,
  discardedSeconds: snapshot.discardedSeconds,
  bodyCount: snapshot.bodyCount,
  colliderCount: snapshot.colliderCount,
  bodies: snapshot.bodies,
  moving: snapshot.moving,
  structural: snapshot.structural
});

const floor = {
  sizeX: 64,
  sizeY: 8,
  sizeZ: 64,
  cellMeters: 0.125,
  originMeters: { x: -4, y: -0.125, z: -4 },
  readSlot: (_x: number, y: number, _z: number) => y === 0 ? 1 : 0
};
const player = { spawn: { x: 0.75, y: 0.92, z: -1 }, coverage: [{ minX: -4, maxX: 4, minZ: -4, maxZ: 4 }] };
const direction = (point: { x: number; y: number; z: number }, position: { x: number; y: number; z: number }) => {
  const dx = point.x - position.x;
  const dy = point.y - (position.y + 0.75);
  const dz = point.z - position.z;
  const length = Math.hypot(dx, dy, dz);
  return { x: dx / length, y: dy / length, z: dz / length };
};

const expectNoBodyDiagnostics = (clock: BodyClock | undefined): void => {
  expect(clock).not.toHaveProperty("lastBodyHoldMs");
  expect(clock).not.toHaveProperty("lastBodyCommandId");
  expect(clock).not.toHaveProperty("lastBodyManualPause");
};

const runBodyCut = async (
  measure: boolean,
  failStage = false,
  recoveryHoldExit?: "Dispose" | "Resume",
  restoreBeforeCut = false,
  disableDuringRestore = false
): Promise<BodyCutResult> => {
  if(disableDuringRestore&&!restoreBeforeCut){throw new Error("Disable probe requires a real restore");}
  vi.resetModules();
  let now = 0;
  let nowSpy: { mockRestore: () => void } | undefined;
  const intervalCallbacks: (() => void)[] = [];
  const previousSetInterval = globalThis.setInterval;
  const previousClearInterval = globalThis.clearInterval;
  const previousOnmessage = Object.getOwnPropertyDescriptor(globalThis, "onmessage");
  const previousPostMessage = Object.getOwnPropertyDescriptor(globalThis, "postMessage");
  const host = globalThis as typeof globalThis & WorkerHost;
  const replies: HvpPhysicsReply[] = [];
  let messageId = 0;
  let projectedMeasure=measure;
  let workerLoaded = false;
  const send = async (message: HvpPhysicsRequest&{readonly id:number}): Promise<HvpPhysicsReply> => {
    const handler = host.onmessage;
    if (handler === undefined) {
      throw new Error("Physics worker handler was not installed");
    }
    await handler({ data: {...message,protocol:"hvp-physics-owner-v3",incarnation:"worker-body-clock-test"} } as MessageEvent<HvpPhysicsMessage>);
    const reply = replies.find(value=>value.id===message.id);
    if(reply===undefined){throw new Error(`No physics reply for ${message.id}`);}
    if (!projectedMeasure) {
      expectNoBodyDiagnostics(reply.clock);
    }
    return reply;
  };

  try {
    nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    globalThis.setInterval = ((handler: TimerHandler) => {
      intervalCallbacks.push(handler as () => void);
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;
    globalThis.clearInterval = (() => undefined) as typeof clearInterval;
    host.postMessage = reply => { replies.push(reply); };
    await import("../../src/hestia-prototype/physics/physicsWorker");
    const { R: workerRapier } = await import("../../src/hestia-prototype/physics/rapierPort");
    workerLoaded = true;

    const initialized = await send({
      id: ++messageId,
      kind: "Initialize",
      sectors: [...collisionSectors(floor)],
      spawn: { x: -2, y: 3, z: -2 },
      gravity: 9.81,
      player,
      inertiaSpawn: { x: 2, y: 2, z: 2 },
      branchSpawn: { x: 0, y: 0, z: 0 },
      sessionId: "worker-body-clock",
      measure
    });
    expect(initialized.error).toBeUndefined();
    expect(intervalCallbacks).toHaveLength(1);
    await send({ id: ++messageId, kind: "Play" });

    // Match the mature native fixture's first real fixed step before its branch hit.
    now = 1000 / 60;
    intervalCallbacks[0]!();
    let branchState = await send({ id: ++messageId, kind: "Read" });
    if (restoreBeforeCut) {
      await send({ id: ++messageId, kind: "Pause" });
      const checkpoint = await send({ id: ++messageId, kind: "Checkpoint" });
      expect(checkpoint.checkpoint).toBeDefined();
    const preparingRestore = send({
      id: ++messageId,
      kind: "PrepareRestore",
      transactionId: "body-clock-restore",
      checkpoint: checkpoint.checkpoint!,
      replacements: []
    });
    void preparingRestore.catch(()=>undefined);
    if(disableDuringRestore){
      projectedMeasure=false;
      const disabled=await send({id:++messageId,kind:"Read",measure:false});
      expect(disabled.timings).toBeUndefined();
      expect(disabled.restoreState).toBe("Preparing");
      expect(disabled.snapshot?.status).toBe("Paused");
    }
    const preparedRestore = await preparingRestore;
    expect(preparedRestore.restoreState).toBe("Prepared");
      const committedRestore = await send({ id: ++messageId, kind: "CommitRestore", transactionId: "body-clock-restore" });
      expect(committedRestore.restoreState).toBe("Committed");
      const finalizedRestore = await send({ id: ++messageId, kind: "FinalizeRestore", transactionId: "body-clock-restore" });
      expect(finalizedRestore.restoreState).toBe("Finalized");
      await send({ id: ++messageId, kind: "Play" });
      branchState = await send({ id: ++messageId, kind: "Read" });
      expect(branchState.snapshot?.status).toBe("Running");
    }
    const playerPosition = branchState.snapshot?.player?.position;
    const branchSource = branchState.snapshot?.structural;
    expect(playerPosition).toBeDefined();
    expect(branchSource).not.toBeNull();
    const branchDirection = direction({ x: 0.75, y: 1.25, z: 0 }, playerPosition!);
    const preparedBranch = await send({
      id: ++messageId,
      kind: "PrepareBranch",
      request: { id: "release", generation: 0, sourceDigest: branchSource!.sourceDigest, direction: branchDirection }
    });
    expect(preparedBranch.rejected).toBeUndefined();
    await send({ id: ++messageId, kind: "CommitBranch", transactionId: "release" });
    const releasedBranch = await send({ id: ++messageId, kind: "FinalizeBranch", transactionId: "release" });
    if (failStage) {
      now = 1000 / 60 + 40;
      intervalCallbacks[0]!();
    }
    const beforeBodyCut = await send({ id: ++messageId, kind: "Read" });
    const parent = beforeBodyCut.snapshot?.structural?.parts.find(part => !part.anchored);
    expect(parent).toBeDefined();

    const bodyDirection = direction(parent!.position, beforeBodyCut.snapshot!.player!.position);
    const aim = await send({ id: ++messageId, kind: "Read", cutAim: bodyDirection });
    const hit = aim.snapshot?.moving.preview;
    expect(hit?.ownerId).toBe(parent!.ownerId);
    const transactionId = "recut";
    const begun = await send({
      id: ++messageId,
      kind: "BeginBodyCut",
      request: { id: transactionId, ownerId: hit!.ownerId, sourceDigest: hit!.sourceDigest, edge: 1, direction: bodyDirection }
    });
    const preparation = begun.bodyPreparation;
    expect(preparation?.payload.commandId).toBe(transactionId);
    expect(preparation?.payload.ownerId).toBe(hit!.ownerId);

    const payload = preparation!.payload;
    const local = prepareHvpLocalBodyCut(
      ingestHvpStructuralCells(payload.sourceId, preparation!.cells, payload.materials),
      payload.cell,
      payload.commandId,
      payload.edge
    );
    const products = {
      removedCells: local.plan.removedCells,
      removedMassKg: local.plan.removedMassKg,
      parts: local.plan.parts.map(part => ({
        ownerId: part.ownerId,
        sourceDigest: part.recipe.source.contentHash,
        massKg: part.recipe.mass.totalMassKg,
        center: part.recipe.mass.centerOfMassMeters!
      }))
    };

    if (recoveryHoldExit !== undefined) {
      now = 100;
      const beforeFailure = await send({ id: ++messageId, kind: "Read" });
      expect(beforeFailure.snapshot?.status).toBe("Running");
      expect(beforeFailure.snapshot?.moving.pendingId).toBe(transactionId);

      const originalCreateCollider = workerRapier.World.prototype.createCollider;
      const createColliderSpy = vi.spyOn(workerRapier.World.prototype, "createCollider").mockImplementationOnce(function(
        this: InstanceType<typeof workerRapier.World>,
        ...args: Parameters<typeof originalCreateCollider>
      ) {
        Reflect.apply(originalCreateCollider, this, args);
        now += 250;
        throw new Error("worker body-stage injected collider failure");
      });
      const removeRigidBodySpy = vi.spyOn(workerRapier.World.prototype, "removeRigidBody").mockImplementationOnce(() => {
        throw new Error("worker body-stage injected removeRigidBody failure");
      });
      let failed: HvpPhysicsReply;
      try {
        failed = await send({ id: ++messageId, kind: "StageBodyCut", transactionId, products });
        expect(createColliderSpy).toHaveBeenCalledTimes(1);
        expect(removeRigidBodySpy).toHaveBeenCalledTimes(1);
      } finally {
        createColliderSpy.mockRestore();
        removeRigidBodySpy.mockRestore();
      }
      expect(failed.rejected).toContain("worker body-stage injected collider failure");
      expect(failed.rejected).toContain("worker body-stage injected removeRigidBody failure");
      expect(failed.snapshot?.status).toBe("Paused");
      expect(failed.snapshot?.moving.state).toBe("RecoveryHold");
      expect(failed.snapshot?.moving.pendingId).toBe(transactionId);
      expect(failed.snapshot?.bodyCount).toBe(beforeFailure.snapshot!.bodyCount + 1);
      expect(failed.snapshot?.colliderCount).toBe(beforeFailure.snapshot!.colliderCount + 1);
      expect(failed.snapshot?.ticks).toBe(beforeFailure.snapshot?.ticks);
      expect(failed.snapshot?.backlogSeconds).toBe(beforeFailure.snapshot?.backlogSeconds);
      expect(failed.clock?.simulationHold).toBeUndefined();
      expect(failed.clock?.lastBodyHoldMs).toBeNull();
      if (projectedMeasure) {
        expect(failed.clock).toMatchObject({ lastBodyCommandId: transactionId, lastBodyManualPause: false });
      }

      const rollback = await send({ id: ++messageId, kind: "RollbackBodyCut", transactionId });
      expect(rollback.rejected).toContain("RecoveryHold: moving restoration is unproven");
      expect(rollback.snapshot?.status).toBe("Paused");
      expect(rollback.snapshot?.moving.state).toBe("RecoveryHold");
      expect(rollback.snapshot?.bodyCount).toBe(failed.snapshot?.bodyCount);
      expect(rollback.snapshot?.colliderCount).toBe(failed.snapshot?.colliderCount);
      expect(rollback.snapshot?.ticks).toBe(failed.snapshot?.ticks);
      expect(rollback.clock?.lastBodyHoldMs).toBeUndefined();

      const checkpoint = await send({ id: ++messageId, kind: "Checkpoint" });
      expect(checkpoint.rejected).toMatch(/checkpoint requires a confirmed paused generation/i);
      expect(checkpoint.snapshot?.status).toBe("Paused");
      expect(checkpoint.snapshot?.moving.state).toBe("RecoveryHold");
      expect(checkpoint.snapshot?.bodyCount).toBe(failed.snapshot?.bodyCount);
      expect(checkpoint.snapshot?.colliderCount).toBe(failed.snapshot?.colliderCount);

      if (recoveryHoldExit === "Resume") {
        const resume = await send({ id: ++messageId, kind: "Resume" });
        expect(resume.error).toMatch(/RecoveryHold/i);
        expect(resume.snapshot).toBeUndefined();
        expect(resume.clock?.timers).toBe(0);
        expect(resume.clock?.lastBodyHoldMs).toBeNull();
      }

      const disposed = await send({ id: ++messageId, kind: "Dispose" });
      workerLoaded = false;
      expect(disposed.error).toBeUndefined();
      expect(disposed.snapshot?.status).toBe("Disposed");
      expect(disposed.snapshot?.bodyCount).toBe(0);
      expect(disposed.snapshot?.colliderCount).toBe(0);
      expect(disposed.clock?.timers).toBe(0);
      expect(disposed.snapshot?.moving.state).toBe("RecoveryHold");
      return bodyCutResult(disposed.snapshot!);
    }

    if (failStage) {
      expect(beforeBodyCut.snapshot?.status).toBe("Running");
      expect(beforeBodyCut.snapshot?.ticks).toBe(releasedBranch.snapshot!.ticks + 2);
      now += 40;
      const beforeFailure = await send({ id: ++messageId, kind: "Read" });
      expect(beforeFailure.snapshot?.status).toBe("Running");
      expect(beforeFailure.snapshot?.moving.pendingId).toBe(transactionId);

      const createColliderSpy = vi.spyOn(workerRapier.World.prototype, "createCollider").mockImplementationOnce(() => {
        now += 250;
        throw new Error("worker body-stage injected collider failure");
      });
      let failed: HvpPhysicsReply;
      try {
        failed = await send({ id: ++messageId, kind: "StageBodyCut", transactionId, products });
        expect(createColliderSpy).toHaveBeenCalledTimes(1);
      } finally {
        createColliderSpy.mockRestore();
      }
      expect(failed.rejected).toContain("worker body-stage injected collider failure");
      expect(failed.snapshot?.status).toBe("Running");
      expect(failed.snapshot?.moving.state).toBe("Preparing");
      expect(failed.snapshot?.moving.pendingId).toBe(transactionId);
      expect(failed.snapshot?.bodyCount).toBe(beforeFailure.snapshot?.bodyCount);
      expect(failed.snapshot?.colliderCount).toBe(beforeFailure.snapshot?.colliderCount);
      expect(failed.snapshot?.bodies).toEqual(beforeFailure.snapshot?.bodies);
      if (projectedMeasure) {
        expect(failed.clock).toMatchObject({ lastBodyCommandId: transactionId, lastBodyHoldMs: 250, lastBodyManualPause: false });
      }

      const rolledBack = await send({ id: ++messageId, kind: "RollbackBodyCut", transactionId });
      expect(rolledBack.rejected).toBeUndefined();
      expect(rolledBack.snapshot?.status).toBe("Running");
      expect(rolledBack.snapshot?.moving.state).toBe("Idle");
      expect(rolledBack.snapshot?.bodyCount).toBe(beforeFailure.snapshot?.bodyCount);
      expect(rolledBack.snapshot?.colliderCount).toBe(beforeFailure.snapshot?.colliderCount);
      expect(rolledBack.snapshot?.bodies).toEqual(beforeFailure.snapshot?.bodies);

      const ticksBeforeCorrection = rolledBack.snapshot!.ticks;
      now += 11;
      intervalCallbacks[0]!();
      const afterCorrection = await send({ id: ++messageId, kind: "Read" });
      expect(afterCorrection.clock?.maxTimerGapMs).toBeCloseTo(301, 6);
      expect(afterCorrection.clock?.delayedCallbacks.at(-1)?.gapMs).toBeCloseTo(301, 6);
      expect(afterCorrection.clock?.simulationHold).toBeUndefined();
      expect(afterCorrection.snapshot?.status).toBe("Running");
      expect(afterCorrection.snapshot?.ticks).toBe(ticksBeforeCorrection + 3);
      expect(afterCorrection.snapshot?.backlogSeconds).toBeLessThan(1 / 60);
      expect(afterCorrection.snapshot?.bodyCount).toBe(beforeFailure.snapshot?.bodyCount);
      expect(afterCorrection.snapshot?.colliderCount).toBe(beforeFailure.snapshot?.colliderCount);
      expect(afterCorrection.snapshot?.bodies.map(body => body.ownerId).sort()).toEqual(
        beforeFailure.snapshot?.bodies.map(body => body.ownerId).sort()
      );
      if (projectedMeasure) {
        expect(afterCorrection.clock).toMatchObject({ lastBodyCommandId: transactionId, lastBodyHoldMs: 250, lastBodyManualPause: false });
      }

      const ticksAfterCorrection = afterCorrection.snapshot!.ticks;
      now += 1000 / 60;
      intervalCallbacks[0]!();
      const secondTimer = await send({ id: ++messageId, kind: "Read" });
      expect(secondTimer.clock?.maxTimerGapMs).toBeCloseTo(301, 6);
      expect(secondTimer.clock?.simulationHold).toBeUndefined();
      expect(secondTimer.snapshot?.status).toBe("Running");
      expect(secondTimer.snapshot?.ticks).toBe(ticksAfterCorrection + 1);
      expect(secondTimer.snapshot?.backlogSeconds).toBeLessThan(1 / 60);
      return bodyCutResult(secondTimer.snapshot!);
    }

    now = 100;
    const staged = await send({ id: ++messageId, kind: "StageBodyCut", transactionId, products });
    expect(staged.rejected).toBeUndefined();
    expect(staged.snapshot?.moving.state).toBe("PreparedHeld");
    if (projectedMeasure) {
      expect(staged.clock).toMatchObject({ lastBodyCommandId: transactionId, lastBodyHoldMs: null, lastBodyManualPause: false });
    }

    const foreign = await send({ id: ++messageId, kind: "StageBodyCut", transactionId: "foreign", products });
    expect(foreign.rejected).toMatch(/Stale body preparation/);
    expect(foreign.snapshot?.moving.state).toBe("PreparedHeld");
    expect(foreign.clock?.lastBodyCommandId).toBeUndefined();
    expect(foreign.clock?.lastBodyHoldMs).toBeUndefined();
    expect(foreign.clock?.lastBodyManualPause).toBeUndefined();

    const duplicate = await send({ id: ++messageId, kind: "StageBodyCut", transactionId, products });
    expect(duplicate.rejected).toMatch(/Stale body preparation/);
    expect(duplicate.snapshot?.moving.state).toBe("PreparedHeld");
    expect(duplicate.clock?.lastBodyCommandId).toBeUndefined();
    expect(duplicate.clock?.lastBodyHoldMs).toBeUndefined();
    expect(duplicate.clock?.lastBodyManualPause).toBeUndefined();

    const committed = await send({ id: ++messageId, kind: "CommitBodyCut", transactionId });
    expect(committed.snapshot?.moving.state).toBe("CommittedHeld");
    if (projectedMeasure) {
      expect(committed.clock).toMatchObject({ lastBodyCommandId: transactionId, lastBodyHoldMs: null, lastBodyManualPause: false });
    }

    now = 150;
    const finalized = await send({ id: ++messageId, kind: "FinalizeBodyCut", transactionId });
    expect(finalized.snapshot?.status).toBe("Running");
    expect(finalized.snapshot?.moving.state).toBe("Idle");
    expect(finalized.snapshot?.moving.last?.status).toBe("Applied");
    if (projectedMeasure) {
      expect(finalized.clock).toMatchObject({ lastBodyCommandId: transactionId, lastBodyHoldMs: 50, lastBodyManualPause: false });
    }

    const ticksAtRelease = finalized.snapshot!.ticks;
    now = 150 + 1000 / 60;
    intervalCallbacks[0]!();
    const afterInterval = await send({ id: ++messageId, kind: "Read" });
    expect(afterInterval.clock?.maxTimerGapMs).toBeCloseTo(150, 6);
    expect(afterInterval.clock?.delayedCallbacks.at(-1)?.gapMs).toBeCloseTo(150, 6);
    expect(afterInterval.snapshot?.ticks).toBe(ticksAtRelease + 1);
    expect(afterInterval.snapshot?.status).toBe("Running");

    if (projectedMeasure) {
      expect(afterInterval.clock).toMatchObject({ lastBodyCommandId: transactionId, lastBodyHoldMs: 50, lastBodyManualPause: false });
    }
    return bodyCutResult(afterInterval.snapshot!);
  } finally {
    try {
      if (workerLoaded) {
        await send({ id: ++messageId, kind: "Dispose" });
      }
    } finally {
      nowSpy?.mockRestore();
      globalThis.setInterval = previousSetInterval;
      globalThis.clearInterval = previousClearInterval;
      if (previousOnmessage === undefined) {
        Reflect.deleteProperty(globalThis, "onmessage");
      } else {
        Object.defineProperty(globalThis, "onmessage", previousOnmessage);
      }
      if (previousPostMessage === undefined) {
        Reflect.deleteProperty(globalThis, "postMessage");
      } else {
        Object.defineProperty(globalThis, "postMessage", previousPostMessage);
      }
    }
  }
};

it("measures native body World-Hold without simulating the timer gap", async () => {
  const measured = await runBodyCut(true);
  const unmeasured = await runBodyCut(false);
  expect(unmeasured).toEqual(measured);
}, 120_000);

it("corrects a restored native body-stage hold once in both measurement modes", async () => {
  const measured = await runBodyCut(true, true);
  const unmeasured = await runBodyCut(false, true);
  expect(unmeasured).toEqual(measured);
}, 120_000);

it("keeps unrecoverable native body restoration held and disposes safely", async () => {
  for (const exit of ["Dispose", "Resume"] as const) {
    const disposed = await runBodyCut(true, false, exit);
    expect(disposed.status).toBe("Disposed");
    expect(disposed.bodyCount).toBe(0);
    expect(disposed.colliderCount).toBe(0);
    expect(disposed.moving.state).toBe("RecoveryHold");
  }
}, 120_000);

it("retains body clock diagnostics after restoring the worker world", async () => {
  const restored = await runBodyCut(true, false, undefined, true);
  expect(restored.status).toBe("Running");
  expect(restored.moving.state).toBe("Idle");
  expect(restored.moving.last?.status).toBe("Applied");
}, 120_000);

it("disables optional timing during a prepared restore without changing the native cut",async()=>{
  const disabled=await runBodyCut(true,false,undefined,true,true);
  const neverEnabled=await runBodyCut(false,false,undefined,true);
  expect(disabled).toEqual(neverEnabled);
},120_000);
