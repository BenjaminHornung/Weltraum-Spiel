import { initSync } from "./rapier_wasm3d.js";
import { wasmBase64 } from "./wasmBytes";
export async function init() { initSync({ module: Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0)) }); }
