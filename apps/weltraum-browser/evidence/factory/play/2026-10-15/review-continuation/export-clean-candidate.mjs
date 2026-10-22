import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const [sourceArg, destinationArg] = process.argv.slice(2);
assert(sourceArg && destinationArg, 'Pass the candidate repository and a NEW clean-copy directory');
const source = realpathSync(sourceArg), destination = resolve(destinationArg);
assert(!existsSync(destination), 'Clean-copy directory already exists; never overwrite a prior run');
assert(destination.toLowerCase().startsWith(resolve(source, '..').toLowerCase() + sep), 'Destination must stay in the explicitly named local FP06 workspace');
assert(!destination.toLowerCase().startsWith(source.toLowerCase() + sep), 'Do not export recursively into the candidate');
const git = (...args) => execFileSync('git', ['-c', 'filter.lfs.process=', '-c', 'filter.lfs.required=false', ...args], { cwd: source, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const prefix = 'apps/weltraum-browser/';
const assetRoots = ['art/factory/fp01/power-kit/', 'art/factory/fp02/cutter/', 'art/factory/fp02/former/', 'art/factory/play-cargo-surface-v2-2026-10-19/'];
const playRecords = [
  ...['EXEC_PLAN.md', 'COMPOSITION_RESULTS.md', 'FINAL_RESULT.md'].map(name => 'docs/factory/fp06/play/2026-10-15/review-continuation/' + name),
  ...['EXEC_PLAN.md', 'RESULTS.md', 'RUNTIME_PROFILE_REUSE_R01_DECISION.md', 'BELT_CURRENT_MATERIAL_R01_DECISION.md',
    'MACHINE_SOURCE_SELECTION_R01_DECISION.md', 'ISSUED_PROPOSAL_HASH_R01_DECISION.md', 'WORKER_READ_TIMING_R01_DECISION.md']
    .map(name => 'docs/factory/fp06/play/2026-10-18/performance-continuation/' + name)
];
playRecords.push(...['EXEC_PLAN.md', 'RESULTS.md', 'FRAME_PROJECTION_REUSE_R01.md', 'RAF_PROJECTION_R01.md', 'MATERIAL_ADOPTION_R01.md', 'PAUSE_SCROLL_R01.md', 'CARRIER_COM_FLOAT32_R01.md', 'LOGICAL_CAMERA_F64_R01.md'].map(name => 'docs/factory/fp06/play/2026-10-18/performance-round2/' + name));
playRecords.push('docs/factory/fp06/play/2026-10-19/mouse-input/RAW_POINTER_INPUT_R01.md');
playRecords.push(...['CARGO_ACCESS_R01.md', 'MOUSE_DIRECTION_BACKPRESSURE_R01.md', 'CARGO_SURFACE_V2_R01.md', 'CARGO_SURFACE_V2_R02.md', 'CARGO_SHADOW_RECEIVER_R03.md', 'SHELL_DISPOSAL_R01.md', 'CLEAN_BUILD_TEST_TYPES_R01.md'].map(name => 'docs/factory/fp06/play/2026-10-19/cargo-wreck-input/' + name));
playRecords.push('docs/factory/fp06/play/2026-10-19/cargo-wreck-input/RESULTS.md', 'docs/factory/fp06/play/2026-10-19/cargo-pickup/EXEC_PLAN.md', 'FP06_INPUT_CARGO_ACCEPTANCE.json');
playRecords.push('docs/factory/fp06/play/2026-10-20/cargo-flow/EXEC_PLAN.md', 'FP06_CARGO_PICKUP_ACCEPTANCE.json');
const files = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', prefix, ...assetRoots, ...playRecords).split('\0').filter(Boolean))]
  .filter(path => (path.startsWith(prefix) || assetRoots.some(root => path.startsWith(root)) || playRecords.includes(path)) && !path.startsWith(prefix + 'evidence/'))
  .filter(path => !path.endsWith('.tsbuildinfo'))
  .filter(path => !/(^|\/)(\.env[^/]*|[^/]*credentials[^/]*|secrets[^/]*)$/i.test(path)).sort();
assert(files.includes(prefix + 'factory.html') && files.includes(prefix + 'src/factory/factoryEntry.ts'));
assert(files.includes(prefix + 'package-lock.json'));
assert(playRecords.every(path => files.includes(path)), 'Keep the README play-record links usable in the clean copy');
assert(!files.some(path => path.endsWith('.tsbuildinfo')));
assert(files.includes('art/factory/fp02/cutter/source.scene.json') && files.includes('art/factory/fp02/former/authoring-v1.json'));
mkdirSync(destination, { recursive: true });
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest = [];
for (const path of files) {
  const input = join(source, path), output = join(destination, path);
  assert(realpathSync(input).toLowerCase().startsWith(source.toLowerCase() + sep), 'Source symlink leaves the candidate');
  assert(output.toLowerCase().startsWith(destination.toLowerCase() + sep), 'Invalid export path');
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(input, output);
  const digest = sha256(input);
  assert.equal(sha256(output), digest, 'Copied bytes differ: ' + relative(destination, output));
  manifest.push({ path, sha256: digest });
}
const appDirectory = join(destination, prefix);
assert(!existsSync(join(appDirectory, 'node_modules')) && !existsSync(join(appDirectory, 'dist')));
const receipt = { schema: 'hestia.fp06.clean-copy/v1', createdAtUtc: new Date().toISOString(),
  source, destination, head: git('rev-parse', 'HEAD').trim(), branch: git('branch', '--show-current').trim(),
  policy: 'Actual materialized tracked and nonignored app files, three existing imported authoring asset trees and the bounded two-model Cargo-V2 derivatives/provenance, historical play records and current bounded-continuation decisions/results, original repository-relative layout and current working changes included; no Git metadata, dependencies, build output, raw evidence, or environment credentials', files: manifest };
writeFileSync(join(destination, 'FP06_CLEAN_COPY.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ destination, appDirectory, head: receipt.head, copiedFiles: files.length, manifest: join(destination, 'FP06_CLEAN_COPY.json') }) + '\n');
