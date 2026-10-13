import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBasin } from '../dist/src/basin.js';
import { createPipe } from '../dist/src/pipe.js';

const f = JSON.parse(readFileSync(new URL('../fixtures/cases.json', import.meta.url)));
const basinConfig = () => ({ ...structuredClone(f.basinDefaults), binding: { ...f.binding } });
const pipeConfig = () => ({ ...structuredClone(f.pipeDefaults), binding: { ...f.binding } });
const total = values => values.reduce((a, b) => a + b, 0);
function independentBalance(snapshot) {
  const current = total(snapshot.volumesML ?? snapshot.contentsML);
  const { initialML, sourceML, drainedML, leakedML } = snapshot.ledger;
  assert.equal(current, initialML + sourceML - drainedML - leakedML);
  assert.equal(snapshot.balance.errorML, 0);
  for (const value of snapshot.volumesML ?? snapshot.contentsML) assert.ok(Number.isSafeInteger(value) && value >= 0);
}
const oneCell = (initial, capacity = 2000) => ({ ...basinConfig(), width: 1, height: 1, capacityML: capacity,
  floorML: [0], volumesML: [initial], obstacles: ['open'] });
function advance(model, end, eventAt = new Map()) {
  for (let at = model.snapshot().tick + 1; at <= end; at++) {
    const snapshot = model.step(at, model.snapshot().binding, eventAt.get(at) ?? []);
    independentBalance(snapshot);
  }
  return model.snapshot();
}

test('rest control preserves a level surface across unequal floors for 240 ticks', () => {
  const config = { ...basinConfig(), floorML: f.rest.floorML, volumesML: f.rest.volumesML, obstacles: ['open', 'open', 'open'] };
  const result = advance(createBasin(config), f.rest.ticks);
  assert.deepEqual(result.volumesML, [400, 300, 200]); assert.equal(total(result.volumesML), 900);
});
test('constant inflow has independent 100 + 120*5 = 700 ml oracle', () => {
  const config = { ...oneCell(100), sources: [{ cell: 0, rateML: 5 }] };
  const result = advance(createBasin(config), 120);
  assert.deepEqual(result.volumesML, [700]); assert.equal(result.ledger.sourceML, 600); assert.equal(result.ledger.rejectedSourceML, 0);
});
test('open drain has independent 1000 - 100*7 = 300 ml oracle and stops at empty', () => {
  const config = { ...oneCell(1000), drains: [{ cell: 0, rateML: 7 }] };
  const basin = createBasin(config), result = advance(basin, 100);
  assert.deepEqual(result.volumesML, [300]); assert.equal(result.ledger.drainedML, 700);
  assert.deepEqual(advance(basin, 300).volumesML, [0]); assert.equal(basin.snapshot().ledger.drainedML, 1000);
});
test('full closed basin reports admitted and rejected inflow separately', () => {
  const result = advance(createBasin({ ...oneCell(990, 1000), sources: [{ cell: 0, rateML: 20 }] }), 3);
  assert.deepEqual(result.volumesML, [1000]); assert.equal(result.ledger.sourceML, 10); assert.equal(result.ledger.rejectedSourceML, 50);
});
test('closed dam retains volume; exact tick4 opening and tick5 routing match literal vectors', () => {
  const basin = createBasin(basinConfig());
  assert.deepEqual(advance(basin, 3).volumesML, [800, 0, 0]);
  assert.deepEqual(basin.step(4, f.binding, [f.dam.event]).volumesML, [700, 100, 0]);
  assert.deepEqual(basin.step(5, f.dam.event.nextBinding).volumesML, [600, 175, 25]);
  const end = advance(basin, 180);
  assert.equal(total(end.volumesML), 800); assert.ok(end.volumesML[2] > 0);
  assert.equal(end.ledger.sourceML, 0); assert.equal(end.ledger.drainedML, 0);
});
test('two-dimensional edges cannot spend donor volume twice or overflow receiving cells', () => {
  const config = { ...basinConfig(), width: 2, height: 2, capacityML: 100,
    floorML: [1000, 0, 0, 0], volumesML: [10, 0, 0, 99], obstacles: ['open', 'open', 'open', 'open'], maxEdgeML: 100 };
  const result = advance(createBasin(config), 60);
  assert.equal(total(result.volumesML), 109); assert.ok(result.volumesML.every(v => v <= 100));
});
test('basin pause and JSON checkpoint+tail preserve exact state and open-event cursor', () => {
  const uninterrupted = createBasin(basinConfig()), split = createBasin(basinConfig());
  const schedule = new Map([[4, [f.dam.event]]]);
  advance(uninterrupted, 20, schedule); advance(split, 10, schedule);
  split.setPaused(true); const paused = split.snapshot();
  assert.throws(() => split.step(11, paused.binding), /PAUSED/); assert.deepEqual(split.snapshot(), paused);
  const loaded = createBasin(basinConfig(), JSON.parse(JSON.stringify(split.checkpoint())));
  assert.deepEqual(loaded.snapshot(), paused); loaded.setPaused(false);
  loaded.step(11, loaded.snapshot().binding, [f.dam.event]); advance(loaded, 20);
  assert.deepEqual(loaded.snapshot(), uninterrupted.snapshot());
});
test('valve and pump controls are applied at SimulationTick and capped independently', () => {
  const closed = createPipe({ ...pipeConfig(), valveQ16: 0 });
  assert.deepEqual(closed.step(1, f.binding).contentsML, [800, 0]);
  const opened = closed.step(2, f.binding, [{ id: 'valve-open', tick: 2, type: 'valve', value: 65536 }]);
  assert.deepEqual(opened.contentsML, [700, 100]); assert.equal(opened.lastFlowML, 100);
  const noHead = createPipe({ ...pipeConfig(), pumpHead: 0, contentsML: [100, 900] });
  assert.equal(noHead.step(1, f.binding).lastFlowML, 0);
  assert.ok(noHead.step(2, f.binding, [{ id: 'pump-on', tick: 2, type: 'pump', value: 65536 }]).lastFlowML > 0);
});
test('pressure-dependent leak is exactly 100 then 89 ml with no visible particles', () => {
  const config = { ...pipeConfig(), contentsML: [1000, 0], valveQ16: 0, pumpHead: 0, leakML: 100 };
  const pipe = createPipe(config);
  assert.deepEqual(pipe.step(1, f.binding).contentsML, [900, 0]);
  assert.deepEqual(pipe.step(2, f.binding).contentsML, [811, 0]);
  assert.equal(pipe.snapshot().ledger.leakedML, 189);
  const result = advance(pipe, 120); assert.equal(result.ledger.leakedML + total(result.contentsML), 1000);
});
test('same spill delivered twice, later and after load debits only once', () => {
  const config = { ...pipeConfig(), valveQ16: 0 }, pipe = createPipe(config);
  const first = pipe.step(1, f.binding, [f.spill, f.spill]);
  assert.deepEqual(first.contentsML, [700, 0]); assert.equal(first.ledger.leakedML, 100); assert.equal(first.seen.length, 1);
  pipe.step(2, f.binding, [f.spill]);
  const saved = JSON.parse(JSON.stringify(pipe.checkpoint())), loaded = createPipe(config, saved);
  assert.deepEqual(loaded.step(3, f.binding, [f.spill]).contentsML, [700, 0]); assert.equal(loaded.snapshot().ledger.leakedML, 100);
});
test('load rejects a lost spill cursor even when quantity and aggregate ledger still balance', () => {
  const config = { ...pipeConfig(), valveQ16: 0 }, pipe = createPipe(config);
  pipe.step(1, f.binding, [f.spill]);
  const saved = JSON.parse(JSON.stringify(pipe.checkpoint())); saved.seen = [];
  assert.throws(() => createPipe(config, saved), /CHECKPOINT_REPLAY_MISMATCH/);
});
test('finite laboratory tick/replay budget rejects before saved-state allocation', () => {
  const saved = { schema: 'fluid-lab-v1:pipe', configKey: createPipe(pipeConfig()).checkpoint().configKey,
    tick: 4097, paused: false, get contentsML() { throw Error('SAVED_ARRAY_TOUCHED'); }, pumpHead: 65536, valveQ16: 65536, leakML: 0, ledger: {}, seen: [] };
  assert.throws(() => createPipe(pipeConfig(), saved), /tick-budget/);
});
test('pipe pause and checkpoint+tail preserve controls, quantity and event cursor', () => {
  const control = createPipe(pipeConfig()), split = createPipe(pipeConfig());
  const schedule = new Map([[3, [{ id: 'leak', tick: 3, type: 'leak', value: 40 }]], [6, [{ id: 'close', tick: 6, type: 'valve', value: 0 }]]]);
  advance(control, 30, schedule); advance(split, 10, schedule);
  split.setPaused(true); const before = split.snapshot(); assert.throws(() => split.step(11, f.binding), /PAUSED/);
  assert.deepEqual(split.snapshot(), before);
  const loaded = createPipe(pipeConfig(), JSON.parse(JSON.stringify(split.checkpoint())));
  loaded.setPaused(false); advance(loaded, 30); assert.deepEqual(loaded.snapshot(), control.snapshot());
});
test('water snapshots are immutable and cannot mutate resolver authority', () => {
  for (const model of [createBasin(basinConfig()), createPipe(pipeConfig())]) {
    const snap = model.snapshot(), values = snap.volumesML ?? snap.contentsML;
    assert.throws(() => { values[0] = 0; }, TypeError); assert.throws(() => { snap.ledger.initialML = 0; }, TypeError);
    assert.deepEqual(model.snapshot(), snap);
  }
});
test('caller-owned inputs and checkpoint arrays are copied before future use', () => {
  const config = basinConfig(), model = createBasin(config); config.volumesML[0] = 0; config.binding.owner = 'foreign';
  assert.deepEqual(model.snapshot().volumesML, [800, 0, 0]);
  const saved = JSON.parse(JSON.stringify(model.checkpoint())), loaded = createBasin(basinConfig(), saved);
  saved.volumesML[0] = 0; assert.deepEqual(loaded.snapshot().volumesML, [800, 0, 0]);
});
test('budget admission precedes accessing any basin water arrays', () => {
  const config = { width: 16, height: 16, maxCells: 2, get volumesML() { throw Error('WATER_ARRAY_TOUCHED'); } };
  assert.throws(() => createBasin(config), /CELL_BUDGET/);
  assert.throws(() => createPipe({ ...pipeConfig(), maxEvents: 65 }), /event-budget/);
});
test('NaN, negative, unsafe and Unknown quantities/coverage reject rather than become zero', () => {
  for (const value of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createBasin({ ...basinConfig(), volumesML: [value, 0, 0] }));
    assert.throws(() => createPipe({ ...pipeConfig(), contentsML: [value, 0] }));
  }
  assert.throws(() => createBasin({ ...basinConfig(), obstacles: ['open', 'Unknown', 'open'] }), /UNKNOWN_COVERAGE/);
  assert.throws(() => createPipe({ ...pipeConfig(), binding: { ...f.binding, digest: null } }), /INVALID_IDENTITY/);
  assert.throws(() => createPipe({ ...pipeConfig(), capacitiesML: Array(2) }), /UNKNOWN_ARRAY_COVERAGE/);
  assert.throws(() => createBasin({ ...basinConfig(), sources: Array(1) }), /UNKNOWN_ARRAY_COVERAGE/);
});
test('stale source/obstacle, invalid tick and invalid event leave the complete state unchanged', () => {
  const basin = createBasin(basinConfig());
  const before = basin.snapshot();
  for (const invoke of [
    () => basin.step(1, { ...f.binding, revision: 1 }),
    () => basin.step(1, f.binding, [{ ...f.dam.event, tick: 1, fromRevision: 99 }]),
    () => basin.step(2, f.binding),
    () => basin.step(NaN, f.binding),
    () => basin.step(1, f.binding, [{ ...f.dam.event, tick: 2 }])
  ]) { assert.throws(invoke); assert.deepEqual(basin.snapshot(), before); }
  advance(basin, 3); basin.step(4, f.binding, [f.dam.event]);
  const opened = basin.snapshot(); assert.throws(() => basin.step(5, f.binding), /STALE_SOURCE_BINDING/); assert.deepEqual(basin.snapshot(), opened);
});
test('conflicting duplicate, unknown event, unsafe debit and journal budget fail transactionally', () => {
  const pipe = createPipe({ ...pipeConfig(), valveQ16: 0, maxEvents: 1 });
  pipe.step(1, f.binding, [f.spill]); const before = pipe.snapshot();
  for (const event of [
    { ...f.spill, value: 200 },
    { id: 'new', tick: 2, type: 'Unknown', value: 100 },
    { id: 'new', tick: 2, type: 'spill', value: NaN },
    { id: 'new', tick: 2, type: 'spill', value: 100 }
  ]) { assert.throws(() => pipe.step(2, f.binding, [event])); assert.deepEqual(pipe.snapshot(), before); }
});
test('load rejects profile, stale obstacle, ledger, control and event-cursor corruption', () => {
  const basin = createBasin(basinConfig()); advance(basin, 5, new Map([[4, [f.dam.event]]]));
  const basinSave = JSON.parse(JSON.stringify(basin.checkpoint()));
  for (const mutate of [s => { s.schema = 'other'; }, s => { s.volumesML[0] = -1; }, s => { s.ledger.sourceML++; },
    s => { s.binding.revision = 0; }, s => { s.obstacles[1] = 'blocked'; }, s => { s.seen[0].payload.tick = 99; }]) {
    const saved = structuredClone(basinSave); mutate(saved); assert.throws(() => createBasin(basinConfig(), saved));
  }
  const pipe = createPipe(pipeConfig()); pipe.step(1, f.binding, [f.spill]);
  const pipeSave = JSON.parse(JSON.stringify(pipe.checkpoint()));
  for (const mutate of [s => { s.schema = 'other'; }, s => { s.contentsML[0] = NaN; }, s => { s.ledger.leakedML++; },
    s => { s.valveQ16 = 0; }, s => { s.seen.push(s.seen[0]); }, s => { s.seen[0].id = 'different'; }]) {
    const saved = structuredClone(pipeSave); mutate(saved); assert.throws(() => createPipe(pipeConfig(), saved));
  }
});
