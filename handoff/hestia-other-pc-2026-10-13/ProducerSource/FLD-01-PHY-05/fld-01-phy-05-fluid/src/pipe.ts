import { MODEL, NUMERICS_PROFILE, MAX_VOLUME_ML, integer, identity, binding, sameBinding, array, canonical, immutable, sum,
  balance, ledger, fields, eventBudget, tick, nextTick, events, restoreEvents } from './common.js';
import type { Binding, Ledger, Seen } from './common.js';

export interface PipeConfig {
  capacitiesML: [number, number]; contentsML: [number, number]; binding: Binding;
  pumpHead: number; valveQ16: number; maxFlowML: number; leakML: number; maxEvents: number;
}
export interface PipeEvent { id: string; tick: number; type: 'valve' | 'pump' | 'leak' | 'spill'; value: number }
interface State { tick: number; paused: boolean; contentsML: [number, number]; pumpHead: number; valveQ16: number; leakML: number; ledger: Ledger; seen: Seen<PipeEvent>[] }

export function createPipe(input: PipeConfig, checkpoint?: unknown) {
  const maxEvents = eventBudget(input.maxEvents);
  array(input.capacitiesML, 2); array(input.contentsML, 2);
  const capacitiesML = input.capacitiesML.map(v => integer(v, 'capacity', MAX_VOLUME_ML)) as [number, number];
  if (capacitiesML.some(v => v === 0)) throw Error('ZERO_CAPACITY');
  const contentsML = input.contentsML.map((v, i) => integer(v, 'content', capacitiesML[i])) as [number, number];
  const config: PipeConfig = { capacitiesML, contentsML, binding: binding(input.binding),
    pumpHead: integer(input.pumpHead, 'pump-head', 65536), valveQ16: integer(input.valveQ16, 'valve', 65536),
    maxFlowML: integer(input.maxFlowML, 'flow', MAX_VOLUME_ML), leakML: integer(input.leakML, 'leak', MAX_VOLUME_ML), maxEvents };
  const configKey = canonical({ model: MODEL, numericsProfile: NUMERICS_PROFILE, config }), initialML = sum(contentsML);
  const validateEvent = (value: unknown): PipeEvent => {
    fields(value, ['id', 'tick', 'type', 'value']);
    if (!['valve', 'pump', 'leak', 'spill'].includes(value.type as string)) throw Error('UNKNOWN_EVENT');
    const type = value.type as PipeEvent['type'];
    return { id: identity(value.id), tick: tick(value.tick), type,
      value: integer(value.value, 'event-value', type === 'valve' || type === 'pump' ? 65536 : MAX_VOLUME_ML) };
  };
  let state: State = { tick: 0, paused: false, contentsML: [...contentsML], pumpHead: config.pumpHead, valveQ16: config.valveQ16,
    leakML: config.leakML, ledger: { initialML, sourceML: 0, rejectedSourceML: 0, drainedML: 0, leakedML: 0 }, seen: [] };
  if (checkpoint !== undefined) {
    fields(checkpoint, ['schema', 'configKey', 'tick', 'paused', 'contentsML', 'pumpHead', 'valveQ16', 'leakML', 'ledger', 'seen']);
    if (checkpoint.schema !== MODEL + ':pipe' || checkpoint.configKey !== configKey || typeof checkpoint.paused !== 'boolean') throw Error('CHECKPOINT_PROFILE');
    const atTick = tick(checkpoint.tick);
    array(checkpoint.contentsML, 2);
    const seen = restoreEvents(checkpoint.seen, atTick, maxEvents, validateEvent);
    for (const { payload } of seen) {
      if (payload.type === 'pump') state.pumpHead = payload.value;
      if (payload.type === 'valve') state.valveQ16 = payload.value;
      if (payload.type === 'leak') state.leakML = payload.value;
    }
    if (checkpoint.pumpHead !== state.pumpHead || checkpoint.valveQ16 !== state.valveQ16 || checkpoint.leakML !== state.leakML) throw Error('CHECKPOINT_CONTROLS');
    const restored = checkpoint.contentsML.map((v, i) => integer(v, 'saved-content', capacitiesML[i])) as [number, number];
    const restoredLedger = ledger(checkpoint.ledger, initialML, sum(restored));
    if (restoredLedger.sourceML || restoredLedger.rejectedSourceML || restoredLedger.drainedML) throw Error('CHECKPOINT_LEDGER');
    state = { ...state, tick: atTick, paused: checkpoint.paused, contentsML: restored, ledger: restoredLedger, seen };
    // Lab-only bounded replay proves that the debit and event cursor belong together.
    const replay = createPipe(config);
    for (let at = 1; at <= atTick; at++) replay.step(at, config.binding, seen.filter(entry => entry.payload.tick === at).map(entry => entry.payload));
    replay.setPaused(checkpoint.paused);
    if (canonical(replay.checkpoint()) !== canonical(checkpoint)) throw Error('CHECKPOINT_REPLAY_MISMATCH');
  }
  // shortcut: synthetic fill head with no pipe storage/inertia, upgrade only for a calibrated hydraulic requirement.
  const pressures = (current: State) => capacitiesML.map((capacity, i) => Number(BigInt(current.contentsML[i]!) * 65536n / BigInt(capacity)));
  const snapshot = () => immutable({ schema: MODEL + ':pipe', configKey, ...structuredClone(state), binding: { ...config.binding },
    pressureQ16: pressures(state), allocatedTanks: 2, balance: balance(state.ledger, sum(state.contentsML)) });
  return Object.freeze({
    snapshot,
    checkpoint: () => immutable({ schema: MODEL + ':pipe', configKey, ...structuredClone(state) }),
    setPaused(value: boolean) { if (typeof value !== 'boolean') throw Error('INVALID_PAUSE'); state.paused = value; return snapshot(); },
    step(requestedTick: number, expectedBinding: Binding, incoming: readonly PipeEvent[] = []) {
      const atTick = nextTick(requestedTick, state.tick, state.paused);
      sameBinding(expectedBinding, config.binding);
      const batch = events(incoming, state.seen, atTick, maxEvents, validateEvent);
      const next: State = { ...structuredClone(state), tick: atTick, seen: batch.seen };
      for (const event of batch.fresh) {
        if (event.type === 'pump') next.pumpHead = event.value;
        if (event.type === 'valve') next.valveQ16 = event.value;
        if (event.type === 'leak') next.leakML = event.value;
        if (event.type === 'spill') {
          const amount = Math.min(event.value, next.contentsML[0]);
          next.contentsML[0] -= amount; next.ledger.leakedML = integer(next.ledger.leakedML + amount, 'leaked-total');
        }
      }
      const heads = pressures(next), drive = Math.max(0, heads[0]! + next.pumpHead - heads[1]!);
      const requested = Number(BigInt(config.maxFlowML) * BigInt(drive) * BigInt(next.valveQ16) / (65536n * 65536n));
      const movedML = Math.min(config.maxFlowML, requested, next.contentsML[0], capacitiesML[1] - next.contentsML[1]);
      next.contentsML[0] -= movedML; next.contentsML[1] += movedML;
      const leakHead = Number(BigInt(next.contentsML[0]) * 65536n / BigInt(capacitiesML[0]));
      const leakedML = Math.min(next.contentsML[0], Number(BigInt(next.leakML) * BigInt(leakHead) / 65536n));
      next.contentsML[0] -= leakedML; next.ledger.leakedML = integer(next.ledger.leakedML + leakedML, 'leaked-total');
      balance(next.ledger, sum(next.contentsML));
      state = next;
      return immutable({ ...snapshot(), lastFlowML: movedML, lastLeakML: leakedML });
    }
  });
}
