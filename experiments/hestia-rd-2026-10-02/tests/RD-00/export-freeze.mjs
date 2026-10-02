import assert from 'node:assert/strict';
import { verifyFreeze, START } from '../../exporters/stage-source.mjs';

// A caller-supplied input pin must never be ignored, even before root bytes change.
assert.throws(() => verifyFreeze('../not-a-commit'), /freeze reference/i);
assert.throws(() => verifyFreeze('0'.repeat(40)));
const ref = process.argv[2] ?? START;
const rows = verifyFreeze(ref);
assert.equal(rows.length, 18);
assert.equal(new Set(rows.map(row => row.path)).size, 18);
assert.ok(rows.every(row => row.expectedSha256 === row.actualSha256));
console.log(JSON.stringify({ status: 'PASS', inputFreezeRef: ref, frozenFiles: rows.length, productIntegrated: false }));
