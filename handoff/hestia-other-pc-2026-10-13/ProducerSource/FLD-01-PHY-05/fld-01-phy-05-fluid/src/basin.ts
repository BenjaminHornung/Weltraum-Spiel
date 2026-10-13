import { MODEL, NUMERICS_PROFILE, MAX_VOLUME_ML, integer, identity, binding, sameBinding, array, canonical, immutable, sum,
  balance, ledger, fields, eventBudget, tick, nextTick, events, restoreEvents } from './common.js';
import type { Binding, Ledger, Seen } from './common.js';

export interface BasinConfig {
  width: number; height: number; maxCells: number; maxEvents: number; capacityML: number;
  floorML: number[]; volumesML: number[]; obstacles: ('open' | 'blocked')[]; binding: Binding; maxEdgeML: number;
  sources: { cell: number; rateML: number }[]; drains: { cell: number; rateML: number }[];
}
export interface OpenEvent { id: string; tick: number; type: 'open'; cell: number; fromRevision: number; nextBinding: Binding }
interface State { tick: number; paused: boolean; volumesML: number[]; obstacles: ('open' | 'blocked')[]; binding: Binding; ledger: Ledger; seen: Seen<OpenEvent>[] }

export function createBasin(input: BasinConfig, checkpoint?: unknown) {
  // Count admission precedes reading or allocating any water/topology arrays.
  const maxCells = integer(input.maxCells, 'cell-budget', 256);
  const width = integer(input.width, 'width', 16), height = integer(input.height, 'height', 16);
  if (!width || !height || width * height > maxCells) throw Error('CELL_BUDGET');
  const count = width * height, maxEvents = eventBudget(input.maxEvents);
  const capacityML = integer(input.capacityML, 'capacity', MAX_VOLUME_ML);
  if (!capacityML) throw Error('ZERO_CAPACITY');
  const maxEdgeML = integer(input.maxEdgeML, 'edge-flow', MAX_VOLUME_ML);
  array(input.floorML, count); array(input.volumesML, count); array(input.obstacles, count);
  for (let i = 0; i < count; i++) {
    integer(input.floorML[i], 'floor', MAX_VOLUME_ML); integer(input.volumesML[i], 'volume', capacityML);
    if (!['open', 'blocked'].includes(input.obstacles[i]!)) throw Error('UNKNOWN_COVERAGE');
    if (input.obstacles[i] === 'blocked' && input.volumesML[i] !== 0) throw Error('WATER_IN_BLOCKED_CELL');
  }
  const initialBinding = binding(input.binding);
  const index = (value: unknown) => integer(value, 'cell', count - 1);
  const rates = (value: unknown) => {
    if (!Array.isArray(value) || value.length > count) throw Error('RATE_BUDGET');
    array(value, value.length);
    return value.map(entry => {
      fields(entry, ['cell', 'rateML']);
      return { cell: index(entry.cell), rateML: integer(entry.rateML, 'rate', MAX_VOLUME_ML) };
    });
  };
  const config: BasinConfig = { width, height, maxCells, maxEvents, capacityML, maxEdgeML,
    floorML: [...input.floorML], volumesML: [...input.volumesML], obstacles: [...input.obstacles], binding: initialBinding,
    sources: rates(input.sources), drains: rates(input.drains) };
  const configKey = canonical({ model: MODEL, numericsProfile: NUMERICS_PROFILE, config }), initialML = sum(config.volumesML);
  const validateEvent = (value: unknown): OpenEvent => {
    fields(value, ['id', 'tick', 'type', 'cell', 'fromRevision', 'nextBinding']);
    if (value.type !== 'open') throw Error('UNKNOWN_EVENT');
    return { id: identity(value.id), tick: tick(value.tick), type: 'open', cell: index(value.cell),
      fromRevision: integer(value.fromRevision, 'revision'), nextBinding: binding(value.nextBinding) };
  };
  function open(state: State, event: OpenEvent) {
    if (event.fromRevision !== state.binding.revision || event.nextBinding.revision !== state.binding.revision + 1 ||
      event.nextBinding.owner !== state.binding.owner || event.nextBinding.digest === state.binding.digest) throw Error('STALE_OBSTACLE');
    if (state.obstacles[event.cell] !== 'blocked') throw Error('OBSTACLE_NOT_BLOCKED');
    state.obstacles[event.cell] = 'open'; state.binding = { ...event.nextBinding };
  }
  let state: State = { tick: 0, paused: false, volumesML: [...config.volumesML], obstacles: [...config.obstacles], binding: { ...initialBinding },
    ledger: { initialML, sourceML: 0, rejectedSourceML: 0, drainedML: 0, leakedML: 0 }, seen: [] };
  if (checkpoint !== undefined) {
    fields(checkpoint, ['schema', 'configKey', 'tick', 'paused', 'volumesML', 'obstacles', 'binding', 'ledger', 'seen']);
    if (checkpoint.schema !== MODEL + ':basin' || checkpoint.configKey !== configKey || typeof checkpoint.paused !== 'boolean') throw Error('CHECKPOINT_PROFILE');
    const atTick = tick(checkpoint.tick);
    array(checkpoint.volumesML, count); array(checkpoint.obstacles, count);
    const seen = restoreEvents(checkpoint.seen, atTick, maxEvents, validateEvent);
    for (const entry of seen) open(state, entry.payload);
    if (canonical(checkpoint.obstacles) !== canonical(state.obstacles)) throw Error('CHECKPOINT_OBSTACLES');
    sameBinding(checkpoint.binding, state.binding);
    const volumesML = checkpoint.volumesML.map((value, i) => {
      const volume = integer(value, 'saved-volume', capacityML);
      if (state.obstacles[i] === 'blocked' && volume !== 0) throw Error('WATER_IN_BLOCKED_CELL');
      return volume;
    });
    const restoredLedger = ledger(checkpoint.ledger, initialML, sum(volumesML));
    if (restoredLedger.leakedML !== 0 || BigInt(restoredLedger.sourceML) + BigInt(restoredLedger.rejectedSourceML) !== BigInt(sum(config.sources.map(x => x.rateML))) * BigInt(atTick) ||
      BigInt(restoredLedger.drainedML) > BigInt(sum(config.drains.map(x => x.rateML))) * BigInt(atTick)) throw Error('CHECKPOINT_LEDGER');
    state = { ...state, tick: atTick, paused: checkpoint.paused, volumesML, ledger: restoredLedger, seen };
  }
  const snapshot = () => immutable({ schema: MODEL + ':basin', configKey, ...structuredClone(state),
    allocatedCells: count, balance: balance(state.ledger, sum(state.volumesML)) });
  return Object.freeze({
    snapshot,
    checkpoint: () => immutable({ schema: MODEL + ':basin', configKey, ...structuredClone(state) }),
    setPaused(value: boolean) { if (typeof value !== 'boolean') throw Error('INVALID_PAUSE'); state.paused = value; return snapshot(); },
    step(requestedTick: number, expectedBinding: Binding, incoming: readonly OpenEvent[] = []) {
      const atTick = nextTick(requestedTick, state.tick, state.paused);
      sameBinding(expectedBinding, state.binding);
      const batch = events(incoming, state.seen, atTick, maxEvents, validateEvent);
      const next: State = { ...structuredClone(state), tick: atTick, seen: batch.seen };
      for (const event of batch.fresh) open(next, event);
      for (const source of config.sources) {
        const admitted = next.obstacles[source.cell] === 'open' ? Math.min(source.rateML, capacityML - next.volumesML[source.cell]!) : 0;
        next.volumesML[source.cell]! += admitted;
        next.ledger.sourceML = integer(next.ledger.sourceML + admitted, 'source-total');
        next.ledger.rejectedSourceML = integer(next.ledger.rejectedSourceML + source.rateML - admitted, 'rejected-source-total');
      }
      const old = [...next.volumesML], available = [...old], space = old.map(v => capacityML - v);
      const transfer = (a: number, b: number) => {
        if (next.obstacles[a] !== 'open' || next.obstacles[b] !== 'open') return;
        const difference = config.floorML[a]! + old[a]! - config.floorML[b]! - old[b]!;
        const from = difference > 0 ? a : b, to = difference > 0 ? b : a;
        const amount = Math.min(Math.floor(Math.abs(difference) / 4), maxEdgeML, available[from]!, space[to]!);
        available[from]! -= amount; space[to]! -= amount;
        next.volumesML[from]! -= amount; next.volumesML[to]! += amount;
      };
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (x + 1 < width) transfer(i, i + 1);
        if (y + 1 < height) transfer(i, i + width);
      }
      for (const drain of config.drains) {
        const amount = next.obstacles[drain.cell] === 'open' ? Math.min(drain.rateML, next.volumesML[drain.cell]!) : 0;
        next.volumesML[drain.cell]! -= amount;
        next.ledger.drainedML = integer(next.ledger.drainedML + amount, 'drain-total');
      }
      balance(next.ledger, sum(next.volumesML));
      state = next;
      return snapshot();
    }
  });
}
