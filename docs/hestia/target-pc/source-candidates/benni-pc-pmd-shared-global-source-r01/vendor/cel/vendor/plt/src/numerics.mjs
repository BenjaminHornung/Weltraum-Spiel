const U32_MAX = 0xffffffff;
const U32_MASK = 0xffffffffn;
const MAX_TICK = BigInt(Number.MAX_SAFE_INTEGER);
const Q16_SCALE = 65_536n;
const THREEFRY_C240 = 0x1bd11bda;
const THREEFRY_ROTATIONS = [13, 15, 26, 6, 17, 29, 16, 24];

export const assertU32 = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > U32_MAX) {
    throw new RangeError("Value must be an unsigned 32-bit integer.");
  }
  return value >>> 0;
};

const assertTick = (value) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Tick must be a nonnegative safe integer.");
  }
  return value;
};

export const threefry2x32 = (counter, key) => {
  if (!Array.isArray(counter) || counter.length !== 2 || !Array.isArray(key) || key.length !== 2) {
    throw new TypeError("Threefry2x32 requires two-word counter and key arrays.");
  }

  const counter0 = assertU32(counter[0]);
  const counter1 = assertU32(counter[1]);
  const key0 = assertU32(key[0]);
  const key1 = assertU32(key[1]);
  const keyWords = [key0, key1, (THREEFRY_C240 ^ key0 ^ key1) >>> 0];
  let x0 = (counter0 + key0) >>> 0;
  let x1 = (counter1 + key1) >>> 0;

  for (let round = 0; round < 20; round += 1) {
    x0 = (x0 + x1) >>> 0;
    const rotation = THREEFRY_ROTATIONS[round % THREEFRY_ROTATIONS.length];
    x1 = (((x1 << rotation) | (x1 >>> (32 - rotation))) ^ x0) >>> 0;

    if ((round & 3) === 3) {
      const subkey = (round + 1) / 4;
      x0 = (x0 + keyWords[subkey % 3]) >>> 0;
      x1 = (x1 + keyWords[(subkey + 1) % 3] + subkey) >>> 0;
    }
  }

  return Object.freeze([x0, x1]);
};

export const q16Smoothstep = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 65_536) {
    throw new RangeError("Q16 smoothstep input must be an integer from 0 through 65536.");
  }
  const n = BigInt(value);
  const denominator = Q16_SCALE * Q16_SCALE;
  const numerator = 3n * n * n * Q16_SCALE - 2n * n * n * n;
  return Number((numerator + denominator / 2n) / denominator);
};

export const tickCounter = (tick) => {
  const value = BigInt(assertTick(tick));
  return [Number(value & U32_MASK), Number(value >> 32n)];
};

export const encodeNumbers = ({ u32, tick, f64 }) => {
  const word = assertU32(u32);
  const safeTick = assertTick(tick);
  if (typeof f64 !== "number" || !Number.isFinite(f64)) {
    throw new RangeError("f64 must be finite.");
  }

  const bytes = new Uint8Array(24);
  bytes.set([0x4e, 0x4d, 1, 0]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, word, true);
  view.setBigUint64(8, BigInt(safeTick), true);
  view.setFloat64(16, Object.is(f64, -0) ? 0 : f64, true);
  return bytes;
};

export const decodeNumbers = (bytes) => {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("Numeric record must be a Uint8Array.");
  }
  if (bytes.byteLength !== 24) {
    throw new RangeError("Numeric record must contain exactly 24 bytes.");
  }
  if (bytes[0] !== 0x4e || bytes[1] !== 0x4d || bytes[2] !== 1 || bytes[3] !== 0) {
    throw new RangeError("Numeric record header is invalid.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tick = view.getBigUint64(8, true);
  const f64 = view.getFloat64(16, true);
  if (tick > MAX_TICK) {
    throw new RangeError("Tick exceeds the nonnegative safe integer range.");
  }
  if (!Number.isFinite(f64) || Object.is(f64, -0)) {
    throw new RangeError("f64 must be finite and canonically encoded.");
  }

  return { u32: view.getUint32(4, true), tick: Number(tick), f64 };
};

export const normalizeIdentity = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("Identity must be a nonempty string.");
  }

  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("Identity contains an isolated surrogate.");
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError("Identity contains an isolated surrogate.");
    }
  }

  const normalized = value.normalize("NFC");
  if (new TextEncoder().encode(normalized).byteLength > 256) {
    throw new RangeError("Identity exceeds 256 UTF-8 bytes.");
  }
  return normalized;
};
