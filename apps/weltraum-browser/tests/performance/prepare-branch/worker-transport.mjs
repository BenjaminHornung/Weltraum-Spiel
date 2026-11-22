import { parentPort, workerData } from "node:worker_threads";

// The product installs globalThis.onmessage and posts its own structured-cloned replies.
globalThis.onmessage = null;
globalThis.postMessage = (value, transfers = []) => parentPort.postMessage(value, transfers);
await import(workerData.bundle);
if (typeof globalThis.onmessage !== "function") throw new Error("The physics bundle did not install a message handler");
parentPort.on("message", data => globalThis.onmessage({ data }));
