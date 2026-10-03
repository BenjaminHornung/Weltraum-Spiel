import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runLab, parseRunArgs } from '../../scripts/run-lab.mjs';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

// Controlled signal-handler check, not an OS Ctrl-C or rendering/performance claim.
const id = process.argv[2];
const options = parseRunArgs(['inspect', '--experiment', 'RD-03', '--variant', 'fixture-control', '--fixture', 'F00-CONTROL',
  '--scenario', 'F00-CONTROL-REPLAY', '--run', id, '--samples', '3']);
const directory = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03/inspect/${id}`;
assertIsolation({ task: 'RD-03', runRoot: directory });
const operation = runLab(options); setImmediate(() => { process.emit('SIGINT'); });
assert.equal(await operation, 1);
const result = JSON.parse(readFileSync(`${directory}/terminal.json`, 'utf8'));
assert.equal(result.status, 'ABORTED'); assert.equal(result.productIntegrated, false);
assert.deepEqual(result.samples, { planned: 3, observed: 0, skipped: 3, failed: 0, skippedReasons: ['ABORTED: run interrupted'] });
console.log('PASS: controlled SIGINT abort retained manifest, terminal status and planned denominator');
