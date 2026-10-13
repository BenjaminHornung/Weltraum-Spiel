import { collisionSectors } from "../snapshot/a/src/hestia-prototype/physics/terrainColliders";
import type { HvpPhysicsRequest as ARequest, HvpPhysicsReply as AReply } from "../snapshot/a/src/hestia-prototype/physics/physicsWorker";
import type { HvpPhysicsRequest as CRequest, HvpPhysicsReply as CReply } from "../snapshot/c/src/hestia-prototype/physics/physicsWorker";
import { HVP_SOLVER_VERSION } from "../snapshot/c/src/hestia-prototype/physics/profile";
type HvpPhysicsRequest = ARequest | CRequest;
type HvpPhysicsReply = AReply | CReply;
type Variant = "a" | "b" | "c";
const expectedSolver = (version: Variant) => version === "a" ? "rapier-0.12.0" : version === "b" ? "rapier-0.21.0" : HVP_SOLVER_VERSION;

const protocol = "hvp-physics-owner-v3";
const sectors = [...collisionSectors({ sizeX: 4, sizeY: 16, sizeZ: 4, cellMeters: .125,
  originMeters: { x: 0, y: 0, z: 0 }, readSlot: (_x: number, y: number) => y === 0 ? 1 : 0 })];
const fragment = { ownerId: "hvp:terrain-fragment:r1:12345678", origin: { x: -16, y: -8, z: -16 }, massKg: 9.375,
  cells: [{ x: 128, y: 76, z: 128, materialId: 1 }, { x: 129, y: 76, z: 128, materialId: 1 }],
  colliderBoxes: [{ min: [128, 76, 128] as const, max: [130, 77, 129] as const }] };
const prepare = (): HvpPhysicsRequest => ({ kind: "PrepareTerrainPlan", transactionId: "owned", generation: 0,
  sourceDigest: "root-after-1", sourceSessionId: "root-session", sourceEpoch: 3,
  allowanceBytes: 48 * 1024 * 1024, replacements: [{ index: 0, mesh: sectors[0]! }], fragments: [fragment] });
const lateStage = (prepareRequestId: number): HvpPhysicsRequest => ({ kind: "PrepareTerrain", transactionId: "owned",
  generation: 0, sourceDigest: "root-after-1", sourceSessionId: "root-session", sourceEpoch: 3,
  prepareRequestId, replacements: [], fragments: [] });
type Pending = { resolve: (reply: HvpPhysicsReply) => void; reject: (error: Error) => void; timer: number };

function owner(version: Variant, incarnation: string) {
  const worker = version === "a"
    ? new Worker(new URL("./worker-a.ts", import.meta.url), { type: "module" })
    : version === "b" ? new Worker(new URL("./worker-b.ts", import.meta.url), { type: "module" })
    : new Worker(new URL("./worker-c.ts", import.meta.url), { type: "module" });
  let id = 0, terminated = false;
  const pending = new Map<number, Pending>();
  const unsolicited: HvpPhysicsReply[] = [];
  const message = (event: MessageEvent<HvpPhysicsReply>): void => {
    const reply = event.data;
    if (reply.protocol !== protocol || reply.incarnation !== incarnation) {
      failure(new Error("Unexpected real worker binding")); return;
    }
    const request = pending.get(reply.id);
    if (request === undefined) { unsolicited.push(reply); return; }
    clearTimeout(request.timer); pending.delete(reply.id); request.resolve(reply);
  };
  const failure = (error: Error): void => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
    pending.clear();
  };
  const error = (event: ErrorEvent): void => { failure(new Error(event.message)); };
  worker.addEventListener("message", message); worker.addEventListener("error", error);
  return {
    send(request: HvpPhysicsRequest): Promise<HvpPhysicsReply> {
      if (terminated) { return Promise.reject(new Error("Worker terminated")); }
      const current = ++id;
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => { pending.delete(current); reject(new Error("Worker request timed out: " + request.kind)); }, 15_000);
        pending.set(current, { resolve, reject, timer });
        worker.postMessage({ ...request, id: current, protocol, incarnation });
      });
    },
    terminate(): void {
      if (terminated) { return; }
      terminated = true;
      worker.terminate(); worker.removeEventListener("message", message); worker.removeEventListener("error", error);
      failure(new Error("Owned worker aborted"));
    },
    read: () => ({ pending: pending.size, listeners: terminated ? 0 : 2, terminated, unsolicited })
  };
}
const nativeDisposed = (reply: HvpPhysicsReply): boolean => reply.error === undefined &&
  reply.snapshot?.status === "Disposed" && reply.snapshot.bodyCount === 0 && reply.snapshot.colliderCount === 0 && reply.clock?.timers === 0;

export async function runWorkerSmoke(versions: readonly Variant[] = ["a", "b"]) {
  const results: object[] = [];
  for (const version of versions) {
    for (const mode of ["normal-cancel", "dispose-running", "reset", "abort"] as const) {
      const connection = owner(version, version + "-" + mode);
      const replies: HvpPhysicsReply[] = [];
      const check: { name: string; status: string }[] = [];
      const send = async (request: HvpPhysicsRequest) => {
        const reply = await connection.send(request); replies.push(reply); return reply;
      };
      let exception: string | null = null;
      try {
        const ready = await send({ kind: "Initialize", sectors, spawn: { x: .4, y: 2, z: .4 }, gravity: 9.81, sessionId: "phy-01-browser" });
        check.push({ name: "real Initialize body/collider", status: ready.error === undefined &&
          ready.snapshot?.bodyCount === 1 && ready.snapshot.colliderCount === 2 ? "PASS" : "FAIL" });
        check.push({ name: "snapshot matches the actual solver profile", status: ready.snapshot?.solver === expectedSolver(version) ? "PASS" : "FAIL" });
        if (ready.error !== undefined) { throw new Error(ready.error); }
        await send({ kind: "Pause" });
        if (mode === "normal-cancel") {
          const checkpoint = await send({ kind: "Checkpoint" });
          check.push({ name: "save profile matches actual solver", status: checkpoint.checkpoint?.solver === expectedSolver(version) ? "PASS" : "FAIL" });
          const prepared = await send(prepare());
          check.push({ name: "actual Source prepare", status: prepared.terrainPlan?.sourceViews.length === 1 && prepared.rejected === undefined ? "PASS" : "FAIL" });
          await send({ kind: "ReleaseTerrainPlan", transactionId: "owned", generation: 0,
            sourceDigest: "root-after-1", sourceSessionId: "root-session", sourceEpoch: 3, prepareRequestId: prepared.id });
          const late = await send(lateStage(prepared.id));
          check.push({ name: "cancel then late Stage rejected", status: late.rejected?.includes("ticket") ? "PASS" : "FAIL" });
          const disposed = await send({ kind: "Dispose" });
          check.push({ name: "normal native Dispose ACK", status: nativeDisposed(disposed) ? "PASS" : "FAIL" });
        } else if (mode === "dispose-running") {
          const preparing = send(prepare());
          const disposed = await send({ kind: "Dispose" }), terminal = await preparing;
          check.push({ name: "native drain before Dispose ACK", status: nativeDisposed(disposed) ? "PASS" : "FAIL" });
          check.push({ name: "producer cancelled during work", status: terminal.terrainPlan === undefined &&
            /disposed|cancelled/i.test(terminal.rejected ?? "") ? "PASS" : "FAIL" });
          const late = await send(lateStage(terminal.id));
          check.push({ name: "late Stage after Dispose rejected", status: /not ready/i.test(late.rejected ?? "") ? "PASS" : "FAIL" });
        } else if (mode === "reset") {
          const disposed = await send({ kind: "Dispose" });
          check.push({ name: "old owner native Dispose before reset", status: nativeDisposed(disposed) ? "PASS" : "FAIL" });
          connection.terminate();
          const fresh = owner(version, version + "-fresh-reset");
          try {
            const second = await fresh.send({ kind: "Initialize", sectors, spawn: { x: .4, y: 2, z: .4 }, gravity: 9.81, sessionId: "phy-01-browser-reset" });
            replies.push(second);
            check.push({ name: "fresh real owner after reset", status: second.error === undefined && second.snapshot?.bodyCount === 1 &&
              second.snapshot.colliderCount === 2 && second.snapshot.ticks === 0 ? "PASS" : "FAIL" });
            const end = await fresh.send({ kind: "Dispose" }); replies.push(end);
            check.push({ name: "fresh owner native Dispose ACK", status: nativeDisposed(end) ? "PASS" : "FAIL" });
          } finally { fresh.terminate(); }
        } else {
          const preparing = connection.send(prepare()).then(() => "reply", error => String(error));
          connection.terminate();
          check.push({ name: "owned browser Worker abort releases frontend pending", status: (await preparing).includes("Owned worker aborted") ? "PASS" : "FAIL" });
          check.push({ name: "native cleanup ACK on forced abort", status: "UNSUPPORTED" });
        }
      } catch (error) { exception = String(error); check.push({ name: "execution", status: "FAIL" }); }
      finally { connection.terminate(); }
      check.push({ name: "frontend listeners/pending released", status: connection.read().pending === 0 && connection.read().listeners === 0 ? "PASS" : "FAIL" });
      results.push({ version, mode, execution: "REAL_BROWSER_WORKER", checks: check, replies, exception,
        cleanup: connection.read(), runtimeSolver: expectedSolver(version), productIntegration: "NO" });
    }
  }
  return { environment: "LOCAL_WINDOWS_ISOLATED", qualification: "FUNCTIONAL_DIAGNOSTIC",
    userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, visibility: document.visibilityState,
    actualAdapter: "NOT_USED_CPU_WASM_WORKER", gpuTimers: "NOT_USED", backgroundLoad: "CONCURRENT_OTHER_SESSIONS_UNCONTROLLED",
    results };
}
