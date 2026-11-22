import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readR05Bundle } from "../../../scripts/r05Build.mjs";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Worker } from "node:worker_threads";

const [appPath, expectedWorkerSha, reportPath] = process.argv.slice(2);
if (!appPath || !/^[a-f0-9]{64}$/.test(expectedWorkerSha ?? "")) {
  throw new Error("Usage: node worker-cut.mjs APP EXPECTED_WORKER_SHA256 [REPORT.json]");
}
const app = resolve(appPath);
const profile = JSON.parse(await readFile(join(app, "vendor/rapier-phy01-positive-margin-r05/profile.json"), "utf8"));
const pin = await readR05Bundle(app, profile);
assert.equal(pin.workerSha256, expectedWorkerSha, "unexpected worker build");
assert.equal(pin.wasmSha256, "f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb");
const workerPath = join(app, "dist/assets", pin.worker);
const fixtureBytes = await readFile(new URL("./branch-fixture.json", import.meta.url));
assert.equal(createHash("sha256").update(fixtureBytes).digest("hex"),
  "c853e5d3160c2dc8bf65faf5b9999182da7525c0cb2af026738cd3a2ce18f363");
const fixture = JSON.parse(fixtureBytes);
const protocol = "hvp-physics-owner-v3";
const incarnation = "p1-node-worker-cut";
const worker = new Worker(new URL("./worker-transport.mjs", import.meta.url), {
  workerData: {bundle: pathToFileURL(workerPath).href}
});
const run = { date: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
  kind: "unqualified Node worker_threads diagnostic", ownerMode: "public Initialize without checkpoint",
  binding: pin, rows: [], checks: {} };
let nextId = 0, lastSequence = 0, pending, fatal, disposed = false, done = false;
function fail(error) {
  fatal = error;
  pending?.reject(error);
}
worker.on("error", fail);
worker.on("exit", code => { if (!done) fail(Error("Premature Worker exit " + code)); });
worker.on("message", reply => {
  if (reply.id === -1) return fail(Error("Worker timer error: "+reply.error));
  if (!pending || reply.id !== pending.id || reply.sequence !== lastSequence + 1 ||
      reply.protocol !== protocol || reply.incarnation !== incarnation) return fail(Error("Worker reply binding or sequence mismatch"));
  lastSequence = reply.sequence;
  pending.resolve(reply);
});
async function send(request, transfers = []) {
  if (fatal) throw fatal;
  assert.equal(pending, undefined);
  const id = ++nextId;
  const start = performance.now();
  let timeout;
  try {
    const reply = await new Promise((resolve, reject) => {
      pending = { id, resolve, reject };
      timeout = setTimeout(() => reject(Error("Timed out waiting for "+request.kind)), 15000);
      worker.postMessage({ ...request, id, protocol, incarnation }, transfers);
    });
    const s = reply.snapshot;
    run.rows.push({
      id, command: request.kind, sequence: reply.sequence,
      roundTripMs: performance.now()-start, workerHandlerMs: reply.clock?.lastHandlerMs,
      status: s?.status, ticks: s?.ticks, bodies: s?.bodyCount, colliders: s?.colliderCount,
      branchState: s?.structural?.state, branchGeneration: s?.structural?.generation,
      movingState: s?.moving?.state, movingSequence: s?.moving?.sequence,
      timerCount: reply.clock?.timers, workerTimeOrigin: reply.timings?.origin,
      recordedStepSpans: reply.timings?.steps, recordedTimerSpans: reply.timings?.timers,
      droppedTimings: reply.timings?.dropped, lastSnapshotStepMs: s?.stepCpuMs,
      ...(reply.rejected || reply.error ? { issue: reply.rejected ?? reply.error } : {})
    });
    if (reply.rejected || reply.error) throw Error(request.kind+": "+(reply.rejected ?? reply.error));
    return reply;
  } finally { clearTimeout(timeout); pending=undefined; }
}
function aim(target, player) {
  const dx = target.x-player.x, dy = target.y-player.y-0.75, dz = target.z-player.z, norm = Math.hypot(dx,dy,dz);
  return {x:dx/norm,y:dy/norm,z:dz/norm};
}
function splitSummary(structural) {
  return structural.parts.map(({ownerId,sourceDigest,anchored,massKg,cellCount})=>({ownerId,sourceDigest,anchored,massKg,cellCount}));
}

try {
  const sectors = fixture.sectors.map(m => ({vertices:Float32Array.from(m.vertices),indices:Uint32Array.from(m.indices)}));
  const transfers = sectors.flatMap(s => [s.vertices.buffer,s.indices.buffer]);
  const initialized = (await send({ kind:"Initialize",sectors,spawn:fixture.spawn,player:fixture.player,branchSpawn:fixture.branchSpawn,
    inertiaSpawn:fixture.inertiaSpawn,gravity:fixture.gravity,sessionId:incarnation,measure:true },transfers)).snapshot;
  assert(transfers.every(b=>b.byteLength===0));
  assert.equal(initialized.solver,"rapier-0.21.0-phy01.migration2:legacy-impulse-v1");
  assert.equal(initialized.structural.generation,0);
  assert.equal(initialized.structural.parts.length,1);
  const initial = initialized.structural.parts[0];
  assert.equal(initial.cellCount,384);
  assert.equal(initial.massKg,450);
  await send({kind:"Play"});
  const playing = (await send({kind:"Read"})).snapshot;
  const direction = aim(fixture.aimPoint,playing.player.position);
  const preview = (await send({kind:"Read",cutAim:direction})).snapshot.structural.preview;
  assert(preview && preview.cell[0]>=4 && preview.cell[0]<8 && preview.cell[1]>=8 && preview.cell[1]<12);
  const id = "release";
  const prepared = (await send({kind:"PrepareBranch",request:{id,generation:0,sourceDigest:initialized.structural.sourceDigest,direction}})).snapshot;
  assert.equal(prepared.structural.state,"PreparedHeld");
  assert.equal(prepared.structural.generation,0);
  assert.equal(prepared.structural.last.removedCells,64);
  assert.equal(prepared.structural.last.removedMassKg,75);
  const committed = (await send({kind:"CommitBranch",transactionId:id})).snapshot;
  assert.equal(committed.structural.state,"CommittedHeld");
  assert.equal(committed.structural.generation,1);
  const applied = (await send({kind:"FinalizeBranch",transactionId:id})).snapshot;
  assert.equal(applied.structural.state,"Idle");
  assert.equal(applied.structural.last.status,"Applied");
  assert.equal(applied.structural.generation,1);
  assert.notEqual(applied.structural.sourceDigest,initialized.structural.sourceDigest);
  const parts = splitSummary(applied.structural);
  assert.deepEqual(parts.map(p=>p.cellCount).sort((a,b)=>a-b),[128,192]);
  assert.equal(parts.reduce((n,p)=>n+p.massKg,75),450);
  assert.equal(parts.reduce((n,p)=>n+p.cellCount,64),384);
  const dynamic = parts.find(p=>!p.anchored);
  assert(dynamic && parts.some(p=>p.anchored));
  assert.equal(applied.structural.attachment.ownerId,dynamic.ownerId);
  assert(applied.bodies.some(b=>b.ownerId===dynamic.ownerId));
  assert.equal(applied.bodyCount,initialized.bodyCount+1);
  run.checks.branch = {sourceFixture:fixture.source,solver:initialized.solver,parent:splitSummary(initialized.structural)[0],contact:preview,
    sourceDigestBefore:initialized.structural.sourceDigest,sourceDigestAfter:applied.structural.sourceDigest,
    applied:applied.structural.last,fragmentCount:parts.length,parts,attachmentOwnerId:applied.structural.attachment.ownerId};
  // Let the product's unmodified timer run and observe the live detached collider moving under gravity.
  await delay(55);
  const live = (await send({kind:"Read"})).snapshot;
  const oldPart = applied.structural.parts.find(p=>p.ownerId===dynamic.ownerId);
  const livePart = live.structural.parts.find(p=>p.ownerId===dynamic.ownerId);
  assert(live.ticks>applied.ticks && livePart.position.y<oldPart.position.y);
  run.checks.liveDetachedBody = {fromTick:applied.ticks,toTick:live.ticks,fromY:oldPart.position.y,toY:livePart.position.y};
} catch (error) {
  run.failure = {message:error.message,stack:error.stack};
  process.exitCode = 1;
} finally {
  try {
    const release = await send({kind:"Dispose"});
    assert.equal(release.snapshot.status,"Disposed");
    assert.equal(release.snapshot.bodyCount,0);
    assert.equal(release.snapshot.colliderCount,0);
    assert.equal(release.clock.timers,0);
    disposed = true;
    run.checks.disposed={status:release.snapshot.status,bodies:release.snapshot.bodyCount,colliders:release.snapshot.colliderCount,
      timers:release.clock.timers,nativeBytes:release.snapshot.nativeBytes};
  } catch (error) {
    run.disposeFailure = error.message;
    process.exitCode = 1;
  }
  done = true;
  run.threadTerminationCode = await worker.terminate();
  run.passed = disposed && !run.failure;
  const data = JSON.stringify(run,null,2)+"\n";
  if (reportPath) await writeFile(resolve(reportPath),data);
  else process.stdout.write(data);
}
