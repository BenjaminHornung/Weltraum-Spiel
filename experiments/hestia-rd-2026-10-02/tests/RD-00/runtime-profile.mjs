import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

assert.doesNotThrow(() => assertIsolation());
assert.doesNotThrow(() => assertIsolation({ task: 'RD-03', runRoot: 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03' }));
assert.throws(() => assertIsolation({ task: 'RD-03', runRoot: 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00' }));
assert.throws(() => assertIsolation({ task: 'RD-03', databaseName: 'hestia-rd-rd00' }));
assert.throws(() => assertIsolation({ task: 'RD-99' }));
assert.throws(() => assertIsolation({ task: 'RD-03', origin: 'http://127.0.0.1:5173' }));
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03';
mkdirSync(run, { recursive: true });
const probe = mkdtempSync(`${run}/profile-negative-`);
symlinkSync('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00', `${probe}/linked`, 'junction');
assert.throws(() => assertIsolation({ task: 'RD-03', runRoot: `${probe}/linked/missing-child` }), /link/i);
console.log('PASS: real card runtime profiles, no product/cross-card origin, DB or artifacts');
