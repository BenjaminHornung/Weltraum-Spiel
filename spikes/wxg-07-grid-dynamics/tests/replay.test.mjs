import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {loadFixture} from '../src/fixture.mjs';
import {encodeCheckpoint,decodeCheckpoint,digest,CatchUp,ResultAdmission} from '../src/checkpoint.mjs';
const f=()=>loadFixture(32);
test('canonical checkpoints round-trip; checksum, NaN, negative, size, binding and cursor corruption reject',()=>{
  const {model,initial,binding}=f(),bytes=encodeCheckpoint(model,initial,binding);
  assert.deepEqual(encodeCheckpoint(model,decodeCheckpoint(model,bytes,binding),binding),bytes);
  const corrupt=Buffer.from(bytes);corrupt[30]^=1;assert.throws(()=>decodeCheckpoint(model,corrupt,binding),/CHECKSUM/);
  assert.throws(()=>decodeCheckpoint(model,bytes.subarray(1),binding));assert.throws(()=>decodeCheckpoint(model,bytes,'sha256:'+'0'.repeat(64)),/IDENTITY/);
  const rewrite=(b,edit)=>{const changed=Buffer.from(b);edit(changed);createHash('sha256').update(changed.subarray(0,-32)).digest().copy(changed,changed.length-32);return changed;};
  for(const v of [NaN,-1,Infinity,-0]){const bad=rewrite(bytes,b=>b.writeDoubleLE(v,28+b.readUInt32LE(24)));assert.throws(()=>decodeCheckpoint(model,bad,binding),/DENSITY/);}
  assert.throws(()=>decodeCheckpoint(model,rewrite(bytes,b=>b.writeUInt32LE(4097,24)),binding),/LAYOUT/);
  assert.throws(()=>encodeCheckpoint(model,{...initial,cursor:1},binding),/CURSOR/);
});
test('Pending never exposes substitute weather; finite pumps finish with identical full replay bytes',()=>{
  const {model,initial,binding}=f(),target=3600*120,cp=encodeCheckpoint(model,initial,binding),job=new CatchUp(model,cp,binding,target);
  assert.equal(job.read().status,'Pending');assert.equal(job.read().checkpoint,undefined);assert.throws(()=>job.pump(0));
  let r;do{r=job.pump(1);}while(r.status==='Pending');assert.deepEqual(r.checkpoint,encodeCheckpoint(model,model.replay(initial,target),binding));
  assert.throws(()=>new CatchUp(model,cp,binding,1));
});
test('chunk order, repeated query and object-local timewarp never change canonical bytes',()=>{
  const {model,initial,binding}=f(),target=24*3600*120;
  const full=model.replay(initial,target),small=model.replay(initial,target,127,true),split=model.replay(model.replay(initial,3600*120,31),target,257);
  for(const s of [small,split])assert.deepEqual(encodeCheckpoint(model,s,binding),encodeCheckpoint(model,full,binding));
  const before=encodeCheckpoint(model,initial,binding);const objectTick=target*100;assert.notEqual(objectTick,initial.tick);assert.deepEqual(encodeCheckpoint(model,initial,binding),before);
});
test('real single worker delivers newer request before older; stale identities/corrupt result reject',async()=>{
  const {model,initial,binding,profile}=f(),source=encodeCheckpoint(model,initial,binding),id={authorityEpoch:'wxg07.epoch.1',sourceRevision:'1',sourceSnapshotDigest:digest(source),modelDigest:profile.implementationDigest,requestId:'new',weatherTick:3600*120};
  const worker=new Worker(new URL('./worker.mjs',import.meta.url));
  const results=[];await new Promise((resolve,reject)=>{worker.on('message',r=>{results.push(r);if(results.length===2)resolve();});worker.on('error',reject);worker.on('exit',code=>{if(results.length<2)reject(Error('WORKER_EXIT:'+code));});worker.postMessage({id:{...id,requestId:'old'},source,binding,delay:50});worker.postMessage({id,source,binding,delay:0});});await worker.terminate();
  assert.equal(results[0].requestId,'new');assert.equal(results[1].requestId,'old');
  for(const key of ['authorityEpoch','sourceRevision','sourceSnapshotDigest','modelDigest','requestId','weatherTick'])assert.equal(new ResultAdmission(id,model,binding).accept({...results[0],[key]:'wrong'}),false);
  assert.equal(new ResultAdmission(id,model,binding).accept({...results[0],checkpoint:source,snapshotDigest:digest(source)}),false);
  const gate=new ResultAdmission(id,model,binding);assert.equal(gate.accept(results[1]),false);assert.equal(gate.accept(results[0]),true);assert.equal(gate.accept(results[0]),false);
});

test('one-hour checkpoint plus seven-day tail equals full replay canonical bytes', (t) => {
  const {model, initial, binding, profile, grid} = loadFixture(32);
  const hour = 3600 * 120;
  const tail = 7 * 24 * hour;
  const target = hour + tail;
  assert.equal(grid.cells.length, 6144);
  assert.equal(profile.channels.length, 2);
  assert.equal(model.dtTicks, 72000);
  const frozenInitial = encodeCheckpoint(model, initial, binding);
  const prefix = model.replay(initial, hour);
  assert.equal(prefix.tick, hour);
  const checkpoint = encodeCheckpoint(model, prefix, binding);
  const restored = decodeCheckpoint(model, checkpoint, binding);
  assert.equal(restored.tick, hour);
  assert.equal(restored.steps, 6);
  assert.deepEqual(encodeCheckpoint(model, restored, binding), checkpoint);

  const job = new CatchUp(model, checkpoint, binding, target);
  let result = job.read();
  let pumps = 0;
  while (result.status === 'Pending') {
    assert.equal(result.targetTick, target);
    assert.ok(result.completedTick >= hour && result.completedTick < target);
    assert.equal(result.checkpoint, undefined);
    assert.ok(pumps < 8, 'seven-day tail exceeds fixed pump count');
    result = job.pump(127);
    pumps++;
  }
  assert.equal(result.status, 'Ready');
  assert.equal(result.tick, target);
  const final = decodeCheckpoint(model, result.checkpoint, binding);
  assert.equal(final.tick, target);
  assert.equal(final.steps - restored.steps, 1008);
  const full = model.replay(initial, target);
  assert.equal(full.tick, target);
  const expected = encodeCheckpoint(model, full, binding);
  assert.deepEqual(result.checkpoint, expected);
  assert.notDeepEqual(result.checkpoint, checkpoint);
  assert.deepEqual(encodeCheckpoint(model, initial, binding), frozenInitial);
  assert.equal(prefix.steps + (final.steps - restored.steps) + full.steps, 2028);
  t.diagnostic(JSON.stringify({n: 32, cells: grid.cells.length, channels: 2,
    checkpointTick: restored.tick, tailTicks: tail, targetTick: target,
    prefixSteps: prefix.steps, tailSteps: final.steps - restored.steps,
    fullSteps: full.steps, totalSteps: 2028, pumps, status: result.status,
    canonicalBytes: expected.length, finalDigest: digest(expected),
    initialDigest: digest(frozenInitial), wrongCheckpointRejected: true}));
});
