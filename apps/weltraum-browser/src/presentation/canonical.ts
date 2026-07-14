import { compareAscii, contentHash, type ContentHash } from "./ids";

const encoder = new TextEncoder();

class Fnv1a64Writer {
  private hash = 0xcbf29ce484222325n;

  writeByte(value: number): void {
    this.hash ^= BigInt(value & 0xff);
    this.hash = BigInt.asUintN(64, this.hash * 0x100000001b3n);
  }

  writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) {
      this.writeByte(byte);
    }
  }

  digest(): ContentHash {
    return contentHash(`fnv1a64:${this.hash.toString(16).padStart(16, "0")}`);
  }
}

const writeLength = (writer: Fnv1a64Writer, length: number): void => {
  const data = new DataView(new ArrayBuffer(8));
  data.setBigUint64(0, BigInt(length), true);
  writer.writeBytes(new Uint8Array(data.buffer));
};

const writeString = (writer: Fnv1a64Writer, value: string): void => {
  const bytes = encoder.encode(value);
  writeLength(writer, bytes.length);
  writer.writeBytes(bytes);
};

const writeNumber = (writer: Fnv1a64Writer, value: number): void => {
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, value, true);
  writer.writeBytes(new Uint8Array(data.buffer));
};

const writeTypedArray = (writer: Fnv1a64Writer, value: ArrayBufferView): void => {
  writeString(writer, value.constructor.name);
  const scratch = new ArrayBuffer(4);
  const data = new DataView(scratch);
  const bytes = new Uint8Array(scratch);
  const writeElement = (byteLength: 2 | 4): void => writer.writeBytes(bytes.subarray(0, byteLength));
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
