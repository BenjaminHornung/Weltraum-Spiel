import { build } from './runtime/node_modules/vite/dist/node/index.js';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url)), lab = path.resolve(own, '../..');
const name = process.argv[2];
const inputVariant = process.argv[3] ?? 'original';
if (!['original', 'direction'].includes(inputVariant)) throw Error('Only original or explicit direction-input probe');
if (!name || !/^[a-z0-9-]+$/.test(name)) throw Error('Unique bounded build name required');
const out = path.join(own, 'builds', name);
if (existsSync(out)) throw Error('Preserve prior build; choose a fresh name');
const deps = path.join(own, 'runtime/node_modules');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [...walk(path.join(lab, 'src')), path.join(lab, 'package.json'), path.join(lab, 'package-lock.json')];
const snapshot = () => Object.fromEntries(sourcePaths.map(p => [path.relative(lab, p).replaceAll('\\', '/'), hash(readFileSync(p))]));
const before = snapshot();
const input = Object.fromEntries([path.join(lab, 'index.html'), ...sourcePaths.filter(p => p.endsWith('/index.html') || p.endsWith('\\index.html'))].map((p, i) => ['entry' + i, p]));
input.nativeAbort = path.join(own, 'native-abort.html');
await build({ configFile: false, root: lab, publicDir: path.join(own, 'reproduction/package-01/fixtures'),
  plugins: inputVariant === 'direction' ? [{ name: 'followup-declared-direction-input', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/') !== path.join(lab, 'src/qa/combined-scene/main.ts').replaceAll('\\', '/')) return;
    const original = "import{buildCombinedScenario,COMBINED_STAGES,sampleCombined}from'./scenario';";
    if (!code.includes(original)) throw Error('Declared input seam changed; refuse silent replacement');
    return { code: code.replace(original, "import{buildCombinedScenario,COMBINED_STAGES}from'./scenario';\nimport{sampleCombined}from"
      + JSON.stringify(path.join(own, 'direction-input.ts').replaceAll('\\', '/')) + ';'), map: null };
  } }] : [],
  cacheDir: path.join(own, 'runtime/vite-cache'),
  resolve: { alias: [
    { find: 'three/webgpu', replacement: path.join(deps, 'three/build/three.webgpu.js') },
    { find: 'three/tsl', replacement: path.join(deps, 'three/build/three.tsl.js') },
    { find: /^three\/addons\//, replacement: path.join(deps, 'three/examples/jsm/') },
    { find: 'three', replacement: path.join(deps, 'three/build/three.module.js') },
    { find: /^@babylonjs\/core\//, replacement: path.join(deps, '@babylonjs/core/') },
    { find: /^@babylonjs\/core$/, replacement: path.join(deps, '@babylonjs/core/index.js') },
  ] },
  build: { outDir: out, emptyOutDir: false, sourcemap: true, rolldownOptions: { input } } });
const after = snapshot();
if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Source changed during build');
mkdirSync(path.join(own, 'runs'), { recursive: true });
const receipt = { runId: name, startCommit: 'ebb913d133f4109a8898e70e9b0889edcc2d7662', node: process.version,
  sourceState: name.startsWith('control') ? 'PINNED_START_WORKTREE_BYTES' : 'UNCOMMITTED_HASH_BOUND',
  unchangedDuringBuild: true, sourceHashes: before,
  helperSourceHashes: Object.fromEntries(['build.mjs', 'native-abort.html', 'native-abort.ts'].map(p => [p, hash(readFileSync(path.join(own, p)))])),
  inputVariant, inputHelperSha256: inputVariant === 'direction' ? hash(readFileSync(path.join(own, 'direction-input.ts'))) : null,
  artifactHashes: Object.fromEntries(walk(out).map(p => [path.relative(out, p).replaceAll('\\', '/'), hash(readFileSync(p))])),
  fixtureOrigin: 'verified original package MANIFEST 254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170',
  productIntegrated: false };
writeFileSync(path.join(own, 'runs', name + '-build.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ runId: name, sourceFiles: sourcePaths.length, unchangedDuringBuild: true, out }));
