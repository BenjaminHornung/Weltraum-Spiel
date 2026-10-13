import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, '../..');
const git = process.env.GFX_GIT ?? 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const baseline = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
if (execFileSync(git, ['rev-parse', 'HEAD'], { cwd: repo }).toString().trim() !== baseline) throw Error('Wrong baseline');
const prefix = 'apps/weltraum-browser/';
const files = execFileSync(git, ['ls-tree', '-r', '--name-only', baseline, prefix + 'src/settings'], { cwd: repo })
  .toString().trim().split('\n');
for (const name of ['Schema', 'Storage', 'Presets', 'Capabilities']) files.push(prefix + `tests/unit/graphicsSettings${name}.test.ts`);
files.push(prefix + 'src/render/three/graphicsSettingsAdapter.ts', prefix + 'tests/e2e/graphics-settings.spec.ts',
  prefix + 'src/surface-lab/surfaceLabHud.ts', prefix + 'package.json', prefix + 'package-lock.json');
const entries = [];
for (const file of files) {
  const bytes = execFileSync(git, ['show', `${baseline}:${file}`], { cwd: repo, maxBuffer: 4 * 1024 * 1024 });
  const path = 'control/' + file.slice(prefix.length);
  const target = resolve(root, path);
  if (existsSync(target)) throw Error(`Already frozen: ${path}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  entries.push({ originalPath: file, snapshotPath: path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  if (file.startsWith(prefix + 'src/settings/')) {
    const candidate = resolve(root, 'settings-v2-candidate/' + file.slice(prefix.length));
    if (existsSync(candidate)) throw Error(`Candidate already exists: ${candidate}`);
    mkdirSync(dirname(candidate), { recursive: true });
    writeFileSync(candidate, bytes);
  }
}
writeFileSync(resolve(root, 'source-manifest.json'), JSON.stringify({ baseline, entries }, null, 2) + '\n');
console.log(`Frozen ${entries.length} exact sources; candidate seeded. No product writes.`);
