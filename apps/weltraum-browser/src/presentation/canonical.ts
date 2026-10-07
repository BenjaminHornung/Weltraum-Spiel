import { compareAscii, contentHash, type ContentHash } from "./ids";

const encoder = new TextEncoder();

class Fnv1a64Writer {
  private high = 0xcbf29ce4;
  private low = 0x84222325;
  readonly scalarData = new DataView(new ArrayBuffer(8));
  readonly scalarBytes = new Uint8Array(this.scalarData.buffer);
  readonly stringBytes = new Uint8Array(512);

  writeByte(value: number): void {
    // FNV prime = 2^40 + 435. Two uint32 limbs preserve modulo-2^64
    // arithmetic without allocating a BigInt for every mesh byte.
    const low = (this.low ^ (value & 0xff)) >>> 0;
    const carry = Math.floor(low * 435 / 0x100000000);
    this.high = (Math.imul(this.high, 435) + carry + (low << 8)) >>> 0;
    this.low = Math.imul(low, 435) >>> 0;
  }

  writeBytes(bytes: Uint8Array, length = bytes.length): void {
    for (let index = 0; index < length; index += 1) {
      this.writeByte(bytes[index]!);
    }
  }

  digest(): ContentHash {
    return contentHash(`fnv1a64:${this.high.toString(16).padStart(8, "0")}${this.low.toString(16).padStart(8, "0")}`);
  }
}

const writeLength = (writer: Fnv1a64Writer, length: number): void => {
  const data = writer.scalarData;
  data.setBigUint64(0, BigInt(length), true);
  writer.writeBytes(writer.scalarBytes);
};

const writeString = (writer: Fnv1a64Writer, value: string): void => {
  if (value.length <= 128) {
    const { written } = encoder.encodeInto(value, writer.stringBytes);
    writeLength(writer, written);
    writer.writeBytes(writer.stringBytes, written);
    return;
  }
  const bytes = encoder.encode(value);
  writeLength(writer, bytes.length);
  writer.writeBytes(bytes);
};

const writeNumber = (writer: Fnv1a64Writer, value: number): void => {
  const data = writer.scalarData;
  data.setFloat64(0, value, true);
  writer.writeBytes(writer.scalarBytes);
};

const writeTypedArray = (writer: Fnv1a64Writer, value: ArrayBufferView): void => {
  writeString(writer, value.constructor.name);
  const scratch = new ArrayBuffer(4);
  const data = new DataView(scratch);
  const bytes = new Uint8Array(scratch);
  const writeElement = (byteLength: 2 | 4): void => writer.writeBytes(bytes, byteLength);
  writeLength(writer, value.byteLength);
  if (value instanceof Float32Array) {
    value.forEach((element) => {
      data.setFloat32(0, element, true);
      writeElement(4);
    });
  } else if (value instanceof Uint16Array) {
    value.forEach((element) => {
      data.setUint16(0, element, true);
      writeElement(2);
    });
  } else if (value instanceof Uint32Array) {
    value.forEach((element) => {
      data.setUint32(0, element, true);
      writeElement(4);
    });
  } else {
    throw new TypeError(`Unsupported canonical typed array: ${value.constructor.name}`);
  }
};

const writeCanonical = (writer: Fnv1a64Writer, value: unknown): void => {
  if (value === null) {
    writer.writeByte(0);
    return;
  }
  if (value === undefined) {
    writer.writeByte(1);
    return;
  }
  if (typeof value === "boolean") {
    writer.writeByte(value ? 3 : 2);
    return;
  }
  if (typeof value === "number") {
    writer.writeByte(4);
    writeNumber(writer, value);
    return;
  }
  if (typeof value === "string") {
    writer.writeByte(5);
    writeString(writer, value);
    return;
  }
  if (ArrayBuffer.isView(value)) {
    writer.writeByte(6);
    writeTypedArray(writer, value);
    return;
  }
  if (Array.isArray(value)) {
    writer.writeByte(7);
    writeLength(writer, value.length);
    value.forEach((entry) => writeCanonical(writer, entry));
    return;
  }
  if (typeof value === "object") {
    writer.writeByte(8);
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => compareAscii(left, right));
    writeLength(writer, entries.length);
    for (const [key, entry] of entries) {
      writeString(writer, key);
      writeCanonical(writer, entry);
    }
    return;
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
};

export const canonicalSignature = (value: unknown): ContentHash => {
  const writer = new Fnv1a64Writer();
  writeString(writer, "weltraum-presentation-canonical-v1");
  writeCanonical(writer, value);
  return writer.digest();
};

// Private presentation preparation uses first-party records and fixed typed
// buffers. Keep the public traversal above, including its forEach observations.
function* writeOwnedString(writer: Fnv1a64Writer, value: string): Generator<string, void, unknown> {
  if (value.length <= 128) {
    writeString(writer, value);
    yield "canonicalString";
    return;
  }
  const endOfChunk = (start: number): number => {
    let end = Math.min(start + 128, value.length);
    const last = value.charCodeAt(end - 1), next = value.charCodeAt(end);
    if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { end -= 1; }
    return end;
  };
  let byteLength = 0;
  for (let start = 0; start < value.length;) {
    const end = endOfChunk(start);
    byteLength += encoder.encodeInto(value.slice(start, end), writer.stringBytes).written;
    start = end;
    yield "canonicalStringLength";
  }
  writeLength(writer, byteLength);
  for (let start = 0; start < value.length;) {
    const end = endOfChunk(start);
    const { written } = encoder.encodeInto(value.slice(start, end), writer.stringBytes);
    writer.writeBytes(writer.stringBytes, written);
    start = end;
    yield "canonicalString";
  }
}

function* writeOwnedCanonical(writer: Fnv1a64Writer, value: unknown): Generator<string, void, unknown> {
  if (typeof value === "string") {
    writer.writeByte(5);
    yield* writeOwnedString(writer, value);
  } else if (ArrayBuffer.isView(value)) {
    writer.writeByte(6);
    yield* writeOwnedString(writer, value.constructor.name);
    writeLength(writer, value.byteLength);
    if (!(value instanceof Float32Array || value instanceof Uint16Array || value instanceof Uint32Array)) {
      throw new TypeError(`Unsupported canonical typed array: ${value.constructor.name}`);
    }
    yield "canonicalTypedHeader";
    const width = value instanceof Uint16Array ? 2 : 4, perChunk = 4096 / width;
    for (let start = 0; start < value.length; start += perChunk) {
      const end = Math.min(start + perChunk, value.length);
      for (let index = start; index < end; index += 1) {
        if (value instanceof Float32Array) { writer.scalarData.setFloat32(0, value[index]!, true); }
        else if (value instanceof Uint16Array) { writer.scalarData.setUint16(0, value[index]!, true); }
        else { writer.scalarData.setUint32(0, value[index]!, true); }
        writer.writeBytes(writer.scalarBytes, width);
      }
      yield "canonicalTypedBytes";
    }
  } else if (Array.isArray(value)) {
    writer.writeByte(7);
    writeLength(writer, value.length);
    yield "canonicalArray";
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) { yield* writeOwnedCanonical(writer, value[index]); }
    }
  } else if (value !== null && typeof value === "object") {
    writer.writeByte(8);
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => compareAscii(left, right));
    writeLength(writer, entries.length);
    yield "canonicalObject";
    for (const [key, entry] of entries) {
      yield* writeOwnedString(writer, key);
      yield* writeOwnedCanonical(writer, entry);
    }
  } else {
    writeCanonical(writer, value);
    yield "canonicalScalar";
  }
}

export function* canonicalSignatureOwnedSteps(value: unknown): Generator<string, ContentHash, unknown> {
  const writer = new Fnv1a64Writer();
  yield* writeOwnedString(writer, "weltraum-presentation-canonical-v1");
  yield* writeOwnedCanonical(writer, value);
  return writer.digest();
}
