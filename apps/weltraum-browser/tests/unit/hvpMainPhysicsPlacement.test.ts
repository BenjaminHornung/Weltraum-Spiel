import { expect, it } from "vitest";
import { createMainThreadPhysicsEndpoint } from "../../src/hestia-prototype/physics/mainThreadPhysics";
import { HVP_PHYSICS_PROTOCOL } from "../../src/hestia-prototype/physics/physicsProtocol";
import type { HvpPhysicsRequest, HvpPhysicsReply } from "../../src/hestia-prototype/physics/physicsWorker";

function peer(incarnation: string) {
  const endpoint = createMainThreadPhysicsEndpoint();
  let sequence = 0;
  const send = (command: HvpPhysicsRequest, transfer: Transferable[] = []) => {
    const id = ++sequence;
    return new Promise<HvpPhysicsReply>((resolve, reject) => {
      endpoint.onerror = event => reject(Error(event.message));
      endpoint.onmessage = event => {
        const reply = event.data;
        if (reply.id === id) resolve(reply);
      };
      endpoint.postMessage({ ...command, protocol: HVP_PHYSICS_PROTOCOL, id, incarnation }, transfer);
    });
  };
  return { endpoint, send };
}

it("isolates two colocated owner incarnations, transfers the physics input and releases their clocks", async () => {
  const a = peer("fixture-a"), b = peer("fixture-b");
  try {
    for (const [index, actor] of [a,b].entries()) {
      const vertices = new Float32Array([-4,0,-4, 4,0,-4, 0,0,4]);
      const indices = new Uint32Array([0,2,1]);
      const pending = actor.send({kind:"Initialize",sectors:[{vertices,indices}],spawn:{x:0,y:2,z:0},
        gravity:9.81,sessionId:"placement-"+index,measure:true},[vertices.buffer,indices.buffer]);
      expect(vertices.byteLength).toBe(0);
      expect((await pending).snapshot?.status).toBe("Running");
    }
    expect((await a.send({kind:"Pause"})).snapshot?.status).toBe("Paused");
    const reply = await b.send({kind:"Read"});
    expect(reply.snapshot?.status).toBe("Running");
    expect(reply.timings?.replyReady).toBeGreaterThanOrEqual(reply.timings!.dispatchStarted!);
    const closed = await a.send({kind:"Dispose"});
    expect(closed.snapshot?.bodyCount).toBe(0);
    expect(closed.clock?.timers).toBe(0);
    const other = await b.send({kind:"Read"});
    expect(other.snapshot!.bodyCount).toBeGreaterThan(0);
    expect((await b.send({kind:"Dispose"})).clock?.timers).toBe(0);
  } finally {a.endpoint.terminate();b.endpoint.terminate();}
});
