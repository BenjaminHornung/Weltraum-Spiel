export const PRODUCT_READ_BASE = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
export const MAX_MANIFEST_BYTES = 1024 * 1024;
export const MAX_PAYLOAD_BYTES = 128 * 1024 * 1024;

export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) { throw new Error(message); }
}

export function record(value: unknown): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected JSON object');
  return value as Record<string, unknown>;
}

export function keys(value: unknown, allowed: readonly string[], required = allowed): void {
  const object = record(value);
  requireValue(Object.keys(object).every((key) => allowed.includes(key)), 'Unknown field');
  requireValue(required.every((key) => Object.hasOwn(object, key)), 'Missing field');
}

export function array(value: unknown): asserts value is unknown[] {
  requireValue(Array.isArray(value), 'Expected array');
}

export function text(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= 1024, 'Expected bounded text');
}

export function id(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(value), 'Invalid stable ID');
}

export function relativePath(value: unknown): asserts value is string {
  text(value);
  requireValue(!value.startsWith('/') && !value.includes('\\') && !value.includes(':')
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..'), 'Unsafe relative path');
}

export function digest(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && /^[0-9a-f]{64}$/.test(value), 'Expected full SHA-256');
}

export function finite(value: unknown, min = -Infinity, max = Infinity): asserts value is number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, 'Invalid finite number');
}

export function integer(value: unknown, min = 0): asserts value is number {
  finite(value, min);
  requireValue(Number.isSafeInteger(value), 'Expected safe integer');
}

export function vector(value: unknown, length = 3): void {
  array(value);
  requireValue(value.length === length, 'Invalid vector length');
  value.forEach((component) => { finite(component); });
}

export function unique(values: readonly string[]): void {
  requireValue(new Set(values).size === values.length, 'Duplicate identity');
}

// Canonicalization belongs only to this bounded JSON serialization boundary.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) { return `[${value.map(canonicalJson).join(',')}]`; }
  if (value !== null && typeof value === 'object') {
    const object = record(value);
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  const json = JSON.stringify(value);
  requireValue(json !== undefined, 'Not JSON data');
  return json;
}

export function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((child) => { freezeJson(child); });
    Object.freeze(value);
  }
  return value;
}

export function parseBoundedJson(bytes: Uint8Array): unknown {
  requireValue(bytes.byteLength <= MAX_MANIFEST_BYTES, 'Manifest exceeds 1 MiB');
  requireValue(bytes.buffer instanceof ArrayBuffer, 'Shared manifest buffer is not supported');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
