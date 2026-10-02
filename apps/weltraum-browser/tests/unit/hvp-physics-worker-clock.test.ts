import { expect, it, vi } from "vitest";
import { collisionSectors } from "../../src/hestia-prototype/physics/terrainColliders";
import { R } from "../../src/hestia-prototype/physics/rapierPort";
import type { HvpPhysicsMessage, HvpPhysicsReply } from "../../src/hestia-prototype/physics/physicsWorker";

type TimingClock = NonNullable<HvpPhysicsReply["clock"]> & { readonly lastTerrainCommandId?: string };
type WorkerHost = {
  onmessage?: (event: MessageEvent<HvpPhysicsMessage>) => void | Promise<void>;
  postMessage?: (reply: HvpPhysicsReply) => void;
};

it("terrain timing projects one coherent transaction through the real worker handler", async () => {
  let now = 0;
  let nowSpy: { mockRestore: () => void } | undefined;
  const intervalCallbacks: (() => void)[] = [];
  const previousSetInterval = globalThis.setInterval;
  const previousClearInterval = globalThis.clearInterval;
  const previousOnmessage = Object.getOwnPropertyDescriptor(globalThis, "onmessage");
  const previousPostMessage = Object.getOwnPropertyDescriptor(globalThis, "postMessage");
  const host = globalThis as typeof globalThis & WorkerHost;
  const replies: HvpPhysicsReply[] = [];
  let workerLoaded = false;
  const send = async (message: HvpPhysicsMessage): Promise<HvpPhysicsReply> => {
    const handler = host.onmessage;
    if (handler === undefined) {
      throw new Error("Physics worker handler was not installed");
    }
    const replyIndex = replies.length;
    await handler({ data: message } as MessageEvent<HvpPhysicsMessage>);
    expect(replies).toHaveLength(replyIndex + 1);
    return replies[replyIndex]!;
  };
  const clock = (reply: HvpPhysicsReply): TimingClock => reply.clock as TimingClock;
  const expectNoTerrainClock = (reply: HvpPhysicsReply): void => {
    expect(clock(reply).lastTerrainRecipeMs).toBeUndefined();
    expect(clock(reply).lastTerrainCookMs).toBeUndefined();
    expect(clock(reply).lastTerrainInstallMs).toBeUndefined();
    expect(clock(reply).lastTerrainHoldMs).toBeUndefined();
    expect(clock(reply).lastTerrainCommandId).toBeUndefined();
  };
  const floor = { sizeX: 16, sizeY: 8, sizeZ: 16, cellMeters: 0.125,
    originMeters: { x: -1, y: -0.125, z: -1 }, readSlot: (_x: number, y: number, _z: number) => y === 0 ? 1 : 0 };
  const mesh = (layers: number) => [...collisionSectors({ ...floor, sizeY: 16, originMeters: { x: -1, y: 0, z: -1 }, readSlot: (_x: number, y: number) => y < layers ? 1 : 0 })][0]!;
  try {
    nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    globalThis.setInterval = ((handler: TimerHandler) => {
      intervalCallbacks.push(handler as () => void);
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;
    globalThis.clearInterval = (() => undefined) as typeof clearInterval;
    host.postMessage = reply => { replies.push(reply); };
    await import("../../src/hestia-prototype/physics/physicsWorker");
    workerLoaded = true;
    const initializedReply = await send({ id: 1, kind: "Initialize", sectors: [...collisionSectors(floor)], spawn: { x: 0, y: 2, z: 0 }, gravity: 9.81, sessionId: "worker-timing" });
    expect(initializedReply.error).toBeUndefined();
    expect(intervalCallbacks).toHaveLength(1);

    const prepared = await send({ id: 2, kind: "PrepareTerrain", transactionId: "one", generation: 0, replacements: [{ index: 0, mesh: mesh(4) }] });
    expect(clock(prepared)).toMatchObject({ lastTerrainCommandId: "one", lastTerrainRecipeMs: expect.any(Number), lastTerrainCookMs: expect.any(Number), lastTerrainInstallMs: expect.any(Number) });
    expect(clock(prepared).lastTerrainHoldMs).toBeUndefined();

    const overlap = await send({ id: 3, kind: "PrepareTerrain", transactionId: "overlap", generation: 0, replacements: [{ index: 0, mesh: mesh(2) }] });
    expect(overlap.id).toBe(3);
    expect(overlap.rejected).toMatch(/Stale or invalid terrain transaction/);
    expect(clock(overlap).lastTerrainCommandId).toBeUndefined();
    expect(clock(overlap).lastTerrainRecipeMs).toBeUndefined();
    expect(clock(overlap).lastTerrainHoldMs).toBeUndefined();

    now = 20;
    const committed = await send({ id: 4, kind: "CommitTerrain", transactionId: "one" });
    expect(clock(committed)).toMatchObject({ lastTerrainCommandId: "one", lastTerrainRecipeMs: expect.any(Number), lastTerrainCookMs: expect.any(Number), lastTerrainInstallMs: expect.any(Number) });
    expect(clock(committed).lastTerrainHoldMs).toBeUndefined();
    now = 120;
    const finalized = await send({ id: 5, kind: "FinalizeTerrain", transactionId: "one" });
    expect(clock(finalized)).toMatchObject({ lastTerrainCommandId: "one", lastTerrainHoldMs: 120 });

    now=135;intervalCallbacks[0]!();
    const read = await send({ id: 6, kind: "Read" });
    expect(clock(read)).toMatchObject({ lastTerrainCommandId: "one", lastTerrainHoldMs: 120 });
    expect(clock(read).maxTimerGapMs).toBeGreaterThanOrEqual(135);
    expect(read.snapshot?.status).toBe("Running");

    now = 200;
    const stale = await send({ id: 7, kind: "PrepareTerrain", transactionId: "stale", generation: 0, replacements: [{ index: 0, mesh: mesh(2) }] });
    expect(stale.id).toBe(7);
    expect(stale.rejected).toMatch(/Stale or invalid terrain transaction/);
    expect(stale.snapshot?.terrainGeneration).toBe(1);
    expect(clock(stale).lastTerrainCommandId).toBeUndefined();
    expect(clock(stale).lastTerrainRecipeMs).toBeUndefined();
    expect(clock(stale).lastTerrainCookMs).toBeUndefined();
    expect(clock(stale).lastTerrainInstallMs).toBeUndefined();
    expect(clock(stale).lastTerrainHoldMs).toBeUndefined();

    const second = await send({ id: 8, kind: "PrepareTerrain", transactionId: "two", generation: 1, replacements: [{ index: 0, mesh: mesh(2) }] });
    expect(clock(second)).toMatchObject({ lastTerrainCommandId: "two", lastTerrainHoldMs: undefined });
    now = 260;
    const rolledBack = await send({ id: 9, kind: "RollbackTerrain", transactionId: "two" });
    expect(clock(rolledBack)).toMatchObject({ lastTerrainCommandId: "two", lastTerrainHoldMs: 60 });

    now = 300;
    const createSpy = vi.spyOn(R.World.prototype, "createCollider").mockImplementationOnce(() => {
      now += 250; throw new Error("worker timing create failure");
    });
    try {
      const failed = await send({ id: 10, kind: "PrepareTerrain", transactionId: "fault", generation: 1, replacements: [{ index: 0, mesh: mesh(4) }] });
      expect(failed.id).toBe(10);
      expect(failed.rejected).toMatch(/worker timing create failure/);
      expect(clock(failed)).toMatchObject({ lastTerrainCommandId: "fault", lastTerrainRecipeMs: expect.any(Number), lastTerrainHoldMs: 250 });
      expect(clock(failed).lastTerrainCookMs).toBeUndefined();
      expect(clock(failed).lastTerrainInstallMs).toBeUndefined();
      expect(failed.snapshot?.terrainTransaction).toBe("Idle");
    } finally {
      createSpy.mockRestore();
    }
    // 40 ms elapsed while running before pause and 11 ms after rollback must
    // still advance normally; only the 250 ms verified transaction hold is excluded.
    now = 561;
    intervalCallbacks[0]!();
    const resumed = await send({ id: 11, kind: "Read" });
    expect(resumed.snapshot?.status).toBe("Running");
    expect(resumed.snapshot?.ticks).toBe((rolledBack.snapshot?.ticks??0)+3);
    expect(clock(resumed).maxTimerGapMs).toBeGreaterThanOrEqual(301);
    expect(clock(resumed).simulationHold).toBeUndefined();

    // Two more separate, proven native hold releases before ONE callback must
    // each be deducted once, with the surrounding 40+11 ms still simulated.
    now = 601;
    for(const [index,heldMs] of [250,125].entries()){
      const fault=vi.spyOn(R.World.prototype,"createCollider").mockImplementationOnce(()=>{
        now+=heldMs;throw new Error(`worker batched failure ${index}`);
      });
      try{
        const reply=await send({id:12+index,kind:"PrepareTerrain",transactionId:`batch-${index}`,generation:1,
          replacements:[{index:0,mesh:mesh(4)}]});
        expect(reply.rejected).toContain(`worker batched failure ${index}`);
        expect(reply.snapshot?.terrainTransaction).toBe("Idle");
        expect(clock(reply).lastTerrainHoldMs).toBe(heldMs);
      }finally{fault.mockRestore();}
    }
    now = 987;
    intervalCallbacks[0]!();
    const afterBatched=await send({id:14,kind:"Read"});
    expect(afterBatched.snapshot?.status).toBe("Running");
    expect(afterBatched.snapshot?.ticks).toBe(resumed.snapshot!.ticks+3);
    expect(clock(afterBatched).delayedCallbacks.at(-1)?.gapMs).toBeCloseTo(426,6);
    expect(clock(afterBatched).simulationHold).toBeUndefined();

    await send({ id: 15, kind: "Pause" });
    const checkpointReply = await send({ id: 16, kind: "Checkpoint" });
    expect(checkpointReply.checkpoint).toBeDefined();
    await send({ id: 17, kind: "PrepareRestore", transactionId: "restore", checkpoint: checkpointReply.checkpoint!, replacements: [{ index: 0, mesh: mesh(4) }] });
    const committedRestore = await send({ id: 18, kind: "CommitRestore", transactionId: "restore" });
    expectNoTerrainClock(committedRestore);
    const finalizedRestore = await send({ id: 19, kind: "FinalizeRestore", transactionId: "restore" });
    expectNoTerrainClock(finalizedRestore);

    const invalidMessage = await send(1 as unknown as HvpPhysicsMessage);
    expect(invalidMessage.error).toBe("Invalid physics message id");
    expect(invalidMessage.clock?.timers).toBe(0);
  } finally {
    try {
      if (workerLoaded) {
        await send({ id: 20, kind: "Dispose" });
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
});
