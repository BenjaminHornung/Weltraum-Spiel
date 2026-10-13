import assert from "node:assert/strict";
import { prepareCase } from "../source/observer.ts";

const results = [];
for (const [id, bodyFails, freeFails, undefinedPrimary] of [
  ["bodyPASS/freePASS", false, false, false],
  ["primaryFAIL/freePASS", true, false, false],
  ["primaryPASS/freeFAIL", false, true, false],
  ["bothFAIL", true, true, false],
  ["bothFAIL/undefined-primary", true, true, true],
]) {
  const batch = { poisoned: false };
  const primary = undefinedPrimary ? undefined : { sentinel: "original-primary" };
  const cleanup = { sentinel: "original-cleanup" };
  const bodyResult = { sentinel: "body-result" };
  let bodyCalls = 0, freeCalls = 0, caught = false, thrown, returned;
  const fakeWorld = { free() { freeCalls++; if (freeFails) throw cleanup; } };
  const owned = prepareCase(batch, id);
  const next = prepareCase(batch, id + "/prepared-next");
  try {
    returned = owned.run(() => { bodyCalls++; if (bodyFails) throw primary; return bodyResult; }, () => fakeWorld.free());
  } catch (error) { caught = true; thrown = error; }
  const o = owned.observation;
  assert.equal(bodyCalls, 1);
  assert.equal(freeCalls, 1);
  assert.equal(o.releaseAttempts, 1);
  assert.equal(o.primary.status, bodyFails ? "FAIL" : "PASS");
  assert.equal(o.cleanup.status, freeFails ? "FAIL" : "PASS");
  assert.equal(caught, bodyFails || freeFails);
  if (bodyFails) { assert.equal(o.primary.error, primary); assert.equal(thrown, primary); }
  else { assert.equal(o.primary.result, bodyResult); if (!freeFails) assert.equal(returned, bodyResult); }
  if (freeFails) { assert.equal(o.cleanup.error, cleanup); if (!bodyFails) assert.equal(thrown, cleanup); }
  else assert.equal(o.cleanup.result, undefined);
  assert.equal(batch.poisoned, freeFails);
  assert.equal(o.disposition, freeFails ? "POISONED" : "RELEASED");
  assert.throws(() => owned.run(() => { bodyCalls++; }, () => { freeCalls++; }), /cannot be reused/);
  assert.equal(bodyCalls, 1);
  assert.equal(freeCalls, 1);
  let blockedBody = 0, blockedFree = 0;
  if (freeFails) {
    assert.throws(() => prepareCase(batch, "next-case"), /poisoned/);
    assert.throws(() => next.run(() => { blockedBody++; }, () => { blockedFree++; }), /cannot be reused/);
    assert.equal(next.observation.primary.status, "NOT_RUN");
    assert.equal(next.observation.cleanup.status, "NOT_RUN");
    assert.equal(next.observation.releaseAttempts, 0);
  }
  assert.equal(blockedBody, 0);
  assert.equal(blockedFree, 0);
  results.push({ id, sourceContract: "PASS", primary: o.primary.status, cleanup: o.cleanup.status,
    primaryObservation: o.primary, cleanupObservation: o.cleanup, primaryIsUndefined: bodyFails && undefinedPrimary,
    thrownIdentity: bodyFails ? "ORIGINAL_PRIMARY" : freeFails ? "ORIGINAL_CLEANUP" : "NO_THROW",
    releaseAttempts: o.releaseAttempts, reusedCalls: 0, poisoned: batch.poisoned, disposition: o.disposition });
}
console.log(JSON.stringify({ schema: "phy02.cleanup-observer.pure-mock.r04", status: "SOURCE_MOCK_PASS",
  scenarios: results.length, results, nativeExecutions: 0, nativeCleanupRecovery: "UNPROVEN",
  receiver: "SOURCE_ONLY/NOT_SLOT_READY/NO_GRANTS" }));
