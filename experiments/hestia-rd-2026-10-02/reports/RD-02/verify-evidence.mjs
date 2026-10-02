import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { sha } from '../../exporters/fixture-export.mjs';
import { LAB, RUN, START, BASE, ownedPath, verifyFreeze, writeOwned } from '../../exporters/stage-source.mjs';

function tree(root, relative = '') {
  const rows = [];
  for (const name of readdirSync(path.join(root, relative)).sort()) {
    const file = path.join(root, relative, name); const stat = lstatSync(file);
    if (stat.isSymbolicLink()) { throw new Error('Linked artifact in evidence tree'); }
    if (stat.isDirectory()) { rows.push(...tree(root, path.posix.join(relative, name))); }
    else if (stat.isFile()) { const bytes = readFileSync(file); rows.push({ path: path.posix.join(relative, name), bytes: bytes.length, sha256: sha(bytes) }); }
    else { throw new Error('Non-regular evidence artifact'); }
  }
  return rows;
}
const staticTree = tree(ownedPath(path.join(LAB, 'fixtures'), true));
const normalTree = tree(ownedPath(`${RUN}/export-final-normal`));
const reverseTree = tree(ownedPath(`${RUN}/export-final-reverse`));
if (JSON.stringify(staticTree) !== JSON.stringify(normalTree) || JSON.stringify(staticTree) !== JSON.stringify(reverseTree)) {
  throw new Error('Static/normal/reverse actual file-byte drift');
}
for (const row of staticTree) {
  const bytes = readFileSync(path.join(LAB, 'fixtures', row.path));
  for (const root of [`${RUN}/export-final-normal`, `${RUN}/export-final-reverse`]) {
    if (!bytes.equals(readFileSync(path.join(root, row.path)))) { throw new Error('Actual byte equality failed'); }
  }
}
const commands = readFileSync(`${RUN}/commands.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
for (const label of ['final-unit', 'final2-check', 'final2-rd02-typecheck', 'final2-build', 'final-boundary']) {
  if (commands.findLast(c => c.label === label)?.exitCode !== 0) { throw new Error(`Required fresh command did not pass: ${label}`); }
}
for (const command of commands) {
  const bytes = readFileSync(command.log);
  if (bytes.length !== command.logBytes || sha(bytes) !== command.logSha256) { throw new Error('Raw command log binding drift'); }
}
const exportCosts = readdirSync(RUN).filter(name => /^export-\d+-(normal|reverse)\.json$/.test(name))
  .map(name => ({ path: `${RUN}/${name}`, ...JSON.parse(readFileSync(`${RUN}/${name}`, 'utf8')) }))
  .filter(cost => cost.out.endsWith('export-final-normal') || cost.out.endsWith('export-final-reverse'));
if (exportCosts.length !== 2) { throw new Error('Missing final normal/reverse cost observations'); }
const redFiles = ['red/exporters/fixture-export.mjs', 'red/exporters/synthetic.mjs', 'red/tests/RD-02/unit.test.ts',
  'red-artifacts/unit.test.ts', 'red-palette/unit.test.ts', 'red-palette/recipe.json'].map(relative => {
  const bytes = readFileSync(`${RUN}/${relative}`); return { path: `${RUN}/${relative}`, bytes: bytes.length, sha256: sha(bytes) };
});
const fixtureTreeSha256 = sha(JSON.stringify(staticTree));
const record = { schema: 'rd02-verification-evidence-v1', startSha: START, startTree: 'addf696048a320b9739fc1dc901047600d52e51c',
  productReadBase: BASE, productIntegrated: false, status: 'PASS',
  comparison: { status: 'PASS', actualFileCount: staticTree.length, actualTotalBytes: staticTree.reduce((n, row) => n + row.bytes, 0),
    fixtureTreeSha256, actualBytesEqual: true, roots: [path.join(LAB, 'fixtures'), `${RUN}/export-final-normal`, `${RUN}/export-final-reverse`] },
  freeze: verifyFreeze(), commands, redFiles, exportCosts,
  browser: { status: 'NOT_APPLICABLE', reason: 'No UI/render change; source/data export only' },
  gpuRuntimePerformance: { status: 'NOT_RUN', reason: 'No GPU lease or game runtime execution' },
  artAcceptance: { status: 'NOT_RUN', reason: 'No observed media intervals; JS-challenged Reddit text is not image/runtime evidence' },
  independentReview: { status: 'NOT_RUN', reason: 'LEAF no-delegation mandate; HEAD independent verification remains pending' },
  originalAllFilesGate: 'FAIL_ACCEPTED_NARROW_EXCEPTION', exception: 'only automatically generated untracked contained regular throughput.jsonl/throughput.md; untouched/unpublished',
  cleanup: 'No services/ports/tabs/agents started; own install/build and external source/rawlog evidence retained. No foreign cleanup.', blockers: [] };
writeOwned(`${RUN}/verification-evidence-${Date.now()}.json`, `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify({ status: record.status, comparison: record.comparison, rawLogsVerified: commands.length, redFiles,
  exportCosts: exportCosts.map(c => ({ path: c.path, wallMilliseconds: c.wallMilliseconds,
    cpuUserMilliseconds: c.processCpuUserMilliseconds, cpuSystemMilliseconds: c.processCpuSystemMilliseconds,
    peakRssKiB: c.processPeakRssKiB, inventorySha256: c.inventorySha256 })) }, null, 2));
