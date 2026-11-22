import { bindHvpPhysicsOwner, type HvpPhysicsOwnerPort, type HvpWorkerMessage, type HvpWorkerReply } from "./physicsWorkerHost";

/** Measurement placement. Retain the production wire DTO and transfer ownership in both directions. */
export function createMainThreadPhysicsEndpoint() {
  let closed = false;
  const port: HvpPhysicsOwnerPort = {
    postMessage(reply, transfers = []) {
      if (closed) return;
      const data = structuredClone(reply, { transfer: transfers });
      endpoint.onmessage?.(new MessageEvent("message", { data }));
    }
  };
  const close = bindHvpPhysicsOwner(port);
  const endpoint = {
    onmessage: null as ((event: MessageEvent<HvpWorkerReply>) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    onmessageerror: null as (() => void) | null,
    postMessage(request: HvpWorkerMessage, transfers: Transferable[] = []) {
      if (closed) return;
      const data = structuredClone(request, { transfer: transfers });
      const result = port.onmessage!(new MessageEvent("message", { data }));
      if (result) void result.catch(error => {
        if (!closed) endpoint.onerror?.(new ErrorEvent("error", { message: String(error) }));
      });
    },
    terminate() {
      if (closed) return;
      closed = true;
      void close().catch(() => { /* Owner is detached. */ });
    }
  };
  return endpoint;
}
