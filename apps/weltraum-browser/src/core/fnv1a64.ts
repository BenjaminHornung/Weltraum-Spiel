/**
 * Incremental FNV-1a 64-bit state as two unsigned 32-bit halves (module export only; not in any
 * barrel). Folding a byte sequence in any partition gives the same state as folding it at once.
 */
export interface Fnv1a64State {
  high: number;
  low: number;
}

/** A fresh state at the FNV-1a 64-bit offset basis; never shared. */
export const createFnv1a64State = (): Fnv1a64State => ({ high: 0xcbf29ce4, low: 0x84222325 });

/** Folds `bytes` into `state` with the original modulo-2^64 arithmetic; `bytes` is only read. */
export const updateFnv1a64State = (state: Fnv1a64State, bytes: Uint8Array): void => {
  let high = state.high;
  let low = state.low;
  for (let index = 0; index < bytes.length; index += 1) {
    // Prime = 2^40 + 435; the low-product carry is exact below Number's 2^53 limit.
    const xoredLow = (low ^ bytes[index]!) >>> 0;
    const carry = Math.floor(xoredLow * 435 / 0x100000000);
    high = (Math.imul(high, 435) + carry + (xoredLow << 8)) >>> 0;
    low = Math.imul(xoredLow, 435) >>> 0;
  }
  state.high = high;
  state.low = low;
};

/** The 16 lowercase hex digits of a state (high half first). */
export const fnv1a64StateHex = (state: Fnv1a64State): string =>
  state.high.toString(16).padStart(8, "0") + state.low.toString(16).padStart(8, "0");

/** FNV-1a 64-bit as 16 lowercase hex digits, with the original modulo-2^64 arithmetic. */
export function fnv1a64Bytes(bytes: Uint8Array): string {
  const state = createFnv1a64State();
  updateFnv1a64State(state, bytes);
  return fnv1a64StateHex(state);
}
