import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lab, git, node, start, sha, freshRoot, run, environment } from './phase1.mjs';

export const parent = 'fb6e9678e312b7716025ab358b14a550ae56e12e';
export const headProof = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd40-phase1-head-fb6e9678.json';
export const originalOracle = 'b542ba1faffceafd01c821939fb4adbeb97b9a94c6c41f3c0d7c4034712495bf';
export const owned = ['src/tools/variant-gallery/', 'tests/RD-40/', 'reports/RD-40/'];
export function check(root, ...args) {
  return execFileSync(git, args, { cwd: lab, env: environment(root), encoding: 'utf8', timeout: 120_000 }).trim();
}
const [action, id] = process.argv.slice(2);
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(lab, 'reports/RD-40/repair.mjs')) {
  if (!/^c5317835-phase1-repair-[a-z0-9-]+$/.test(id)) { throw new Error('Fresh repair ID required'); }
  const root = freshRoot(id);
  if (sha(readFileSync(headProof)) !== '53b114d1e5388a2c48c1072a09ef5f44315c8be3d0b5338aed930d64d035bd00'
    || sha(readFileSync(path.join(lab, 'tests/RD-40/unit.test.ts'))) !== originalOracle) { throw new Error('HEAD proof/original oracle changed'); }
  if (action === 'admission') {
    if (check(root, 'rev-parse', 'HEAD') !== parent || check(root, 'rev-parse', 'HEAD^{tree}') !== '939e61f1dca900975d8408c891f6e589637b3ab1') { throw new Error('Exact repair parent required'); }
    writeFileSync(path.join(root, 'admission.json'), JSON.stringify({ productIntegrated: false, parent, start,
      headProof, headProofSha256: sha(readFileSync(headProof)), originalOracle, browser: 'NOT_RUN', services: 0, delegation: 'NOT_RUN' }, null, 2), { flag: 'wx' });
    process.exitCode = run(root, 'boundary', node, [path.join(lab, 'scripts/verify-boundary.mjs'), '--task', 'RD-40', '--start', start, '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e']);
  } else if (action === 'red' || action === 'verify') {
    const unit = [path.join(lab, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'reports/RD-40/vitest.phase1.config.ts',
      ...(action === 'red' ? ['tests/RD-40/repair.test.ts'] : ['tests/RD-40/unit.test.ts', 'tests/RD-40/repair.test.ts']), '--reporter=json', `--outputFile=${path.join(root, 'unit.json')}`];
    const jobs = action === 'red' ? [['repair-red', node, unit]] : [
      ['root-types', path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'tsconfig.json']],
      ['focused-types', path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'reports/RD-40/tsconfig.json']],
      ['focused-unit', node, unit],
      ['gallery-build', node, [path.join(lab, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'reports/RD-40/vite.phase1.config.ts', '--configLoader', 'native', '--outDir', path.join(root, 'build')]],
      ['boundary', node, [path.join(lab, 'scripts/verify-boundary.mjs'), '--task', 'RD-40', '--start', start, '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e']],
    ];
    for (const [name, binary, args] of jobs) { const exit = run(root, name, binary, args); if (exit !== 0) { process.exitCode = exit; break; } }
  } else if (action === 'commit') {
    if (check(root, 'rev-parse', 'HEAD') !== parent || check(root, 'branch', '--show-current') !== 'feature/hestia-rd-rd40-2026-10-04'
      || check(root, 'diff', '--name-only')) { throw new Error('Exact parent/branch and no unstaged changes required'); }
    const files = check(root, 'diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
    if (files.length !== 9 || files.some((file) => !owned.some((dir) => file.startsWith(`experiments/hestia-rd-2026-10-02/${dir}`)))) { throw new Error('Only the nine bounded repair files may be staged'); }
    const exit = run(root, 'staged-diff-check', git, ['diff', '--cached', '--check']);
    process.exitCode = exit || run(root, 'staged-diff', git, ['diff', '--no-ext-diff', '--no-renames', '--cached', parent]) || run(root, 'local-commit', git, ['commit', '-m', 'RD40 Repair seek admission, evidence imports and initial pair controls',
      '-m', 'Preserve valid owners on invalid input, preflight all selected evidence before copying and serialize binding. Guard uninitialized pair switches. Original 13-test oracle retained; additive controlled CPU regressions. ProductIntegrated=false.']);
  } else { throw new Error('Unknown repair action'); }
}
