/** FNV-1a 64-bit as 16 lowercase hex digits, with the original modulo-2^64 arithmetic. */
export function fnv1a64Bytes(bytes: Uint8Array): string {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (let index = 0; index < bytes.length; index += 1) {
    // Prime = 2^40 + 435; the low-product carry is exact below Number's 2^53 limit.
    const xoredLow = (low ^ bytes[index]!) >>> 0;
    const carry = Math.floor(xoredLow * 435 / 0x100000000);
    high = (Math.imul(high, 435) + carry + (xoredLow << 8)) >>> 0;
    low = Math.imul(xoredLow, 435) >>> 0;
  }
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
}
