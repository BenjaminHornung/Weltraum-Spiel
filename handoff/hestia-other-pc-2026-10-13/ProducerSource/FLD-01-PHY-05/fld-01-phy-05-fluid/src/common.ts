import { createSimulationTick, UNIVERSE_TICKS_PER_SECOND } from '../inputs/plt/snapshot/time.mjs';
import { normalizeIdentity } from '../inputs/plt/src/numerics.mjs';

export const MODEL = 'fluid-lab-v1';
export const NUMERICS_PROFILE = 'sha256:64e7977f9b510d74aa61fc37edae076c94ef7a3d0fda09b1fd9cf14e364bb714';
export const TICKS_PER_SECOND = UNIVERSE_TICKS_PER_SECOND;
export const MAX_VOLUME_ML = 1_000_000_000;
export const MAX_LAB_TICK = 4096;
export interface Binding { owner: string; revision: number; digest: string }
export interface Ledger { initialML: number; sourceML: number; rejectedSourceML: number; drainedML: number; leakedML: number }
export interface EventBase { id: string; tick: number }
export interface Seen<E> { id: string; payload: E }

export function integer(value: unknown, name: string, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw Error('INVALID_INTEGER:' + name);
  return value === 0 ? 0 : value;
}
export function identity(value: unknown): string {
  if (typeof value !== 'string' || normalizeIdentity(value) !== value) throw Error('INVALID_IDENTITY');
  return value;
}
export function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('INVALID_OBJECT');
}
export function fields(value: unknown, names: string[]): asserts value is Record<string, unknown> {
  object(value);
  if (Object.keys(value).sort().join('|') !== [...names].sort().join('|')) throw Error('INVALID_FIELDS');
}
export function binding(value: unknown): Binding {
  fields(value, ['owner', 'revision', 'digest']);
  return { owner: identity(value.owner), revision: integer(value.revision, 'revision'), digest: identity(value.digest) };
}
export function sameBinding(actual: unknown, expected: Binding): void {
  if (canonical(binding(actual)) !== canonical(expected)) throw Error('STALE_SOURCE_BINDING');
}
export function array(value: unknown, size: number): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length !== size) throw Error('INVALID_ARRAY_SIZE');
  for (let i = 0; i < size; i++) if (!Object.hasOwn(value, i)) throw Error('UNKNOWN_ARRAY_COVERAGE');
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    object(value);
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  if (typeof value === 'number') integer(value, 'canonical');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  throw Error('INVALID_CANONICAL_VALUE');
}
export function immutable<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total = integer(total + integer(value, 'quantity'), 'sum');
  return total;
}
export function balance(ledger: Ledger, currentML: number) {
  for (const value of Object.values(ledger)) integer(value, 'ledger');
  const expectedML = integer(ledger.initialML + ledger.sourceML, 'ledger-total') - ledger.drainedML - ledger.leakedML;
  if (expectedML !== currentML) throw Error('BALANCE_MISMATCH');
  return { ...ledger, currentML, expectedML, errorML: 0, toleranceML: 0 };
}
export function ledger(value: unknown, initialML: number, currentML: number): Ledger {
  fields(value, ['initialML', 'sourceML', 'rejectedSourceML', 'drainedML', 'leakedML']);
  const result = Object.fromEntries(Object.entries(value).map(([key, v]) => [key, integer(v, key)])) as unknown as Ledger;
  if (result.initialML !== initialML) throw Error('INITIAL_QUANTITY_MISMATCH');
  balance(result, currentML);
  return result;
}
export function eventBudget(value: unknown): number { return integer(value, 'event-budget', 64); }
export function tick(value: unknown): number { return integer(createSimulationTick(value), 'tick-budget', MAX_LAB_TICK); }
export function nextTick(requested: unknown, current: number, paused: boolean): number {
  const result = tick(requested);
  if (paused) throw Error('PAUSED');
  if (result !== current + 1 || current === Number.MAX_SAFE_INTEGER) throw Error('NON_SEQUENTIAL_TICK');
  return result;
}
export function events<E extends EventBase>(incoming: readonly E[], seen: readonly Seen<E>[], atTick: number, max: number, validate: (value: unknown) => E) {
  if (!Array.isArray(incoming) || incoming.length > max || seen.length > max) throw Error('EVENT_BUDGET');
  const next = [...seen];
  const fresh: E[] = [];
  for (const raw of incoming) {
    const event = validate(raw);
    const prior = next.find(item => item.id === event.id);
    if (prior) {
      if (canonical(prior.payload) !== canonical(event)) throw Error('CONFLICTING_DUPLICATE_EVENT');
      continue;
    }
    if (event.tick !== atTick) throw Error('STALE_OR_FUTURE_EVENT');
    if (next.length === max) throw Error('EVENT_BUDGET');
    next.push({ id: event.id, payload: event });
    fresh.push(event);
  }
  return { seen: next, fresh };
}
export function restoreEvents<E extends EventBase>(value: unknown, atTick: number, max: number, validate: (value: unknown) => E): Seen<E>[] {
  if (!Array.isArray(value) || value.length > max) throw Error('EVENT_BUDGET');
  const result: Seen<E>[] = [];
  let priorTick = 0;
  for (const entry of value) {
    fields(entry, ['id', 'payload']);
    const event = validate(entry.payload);
    if (entry.id !== event.id || event.tick === 0 || event.tick > atTick || event.tick < priorTick || result.some(item => item.id === event.id)) throw Error('INVALID_EVENT_CURSOR');
    priorTick = event.tick;
    result.push({ id: event.id, payload: event });
  }
  return result;
}
