import assert from "node:assert/strict";
import Reporter from "./owner65-progress-reporter-r73.candidate.mjs";

const lines = [], original = process.stdout.write;
process.stdout.write = value => { lines.push(String(value)); return true; };
try {
  for (const duration of [0, 12.5, undefined, NaN, Infinity, -1]) {
    const reporter = new Reporter();
    reporter.onTestCaseResult({name:"same completed case", result:()=>({state:"passed"}), diagnostic:()=>({duration})});
    const event = JSON.parse(lines.pop().slice("OWNER65_PROGRESS ".length));
    assert.equal(event.state, "passed");
    assert.equal(event.name, "same completed case");
    assert.equal(event.durationMs, Number.isFinite(duration) && duration >= 0 ? duration : undefined);
  }
  for (const field of ["result", "diagnostic"]) {
    const reporter = new Reporter(), before = lines.length;
    const entity = {name:"throwing getter", result:()=>({state:"passed"}), diagnostic:()=>undefined};
    entity[field] = () => { throw new Error("diagnostic sentinel"); };
    assert.doesNotThrow(()=>reporter.onTestCaseResult(entity));
    assert.equal(reporter.disabled, true);
    assert.equal(lines.length, before);
  }
  const reporter = new Reporter();
  reporter.onTestCaseReady({name:"ready"});
  assert.equal(JSON.parse(lines.pop().slice("OWNER65_PROGRESS ".length)).durationMs, undefined);
  reporter.bytes = 512 * 1024 - 128;
  reporter.onTestCaseReady({name:"overflow"});
  assert.equal(reporter.disabled, true);
  assert.equal(lines.pop(), "OWNER65_PROGRESS_TRUNCATED diagnostic limit reached\n");
  const count = lines.length;
  reporter.onTestCaseReady({name:"after disabled"});
  assert.equal(lines.length, count);
} finally { process.stdout.write = original; }
process.stdout.write("R73 reporter duration/guard/bound controls PASS\n");
