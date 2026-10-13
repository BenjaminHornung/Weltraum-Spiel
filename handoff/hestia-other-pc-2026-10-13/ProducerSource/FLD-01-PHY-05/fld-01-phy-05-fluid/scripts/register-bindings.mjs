import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, files, fileBinding, verifyInputs, hash } from './bindings.mjs';

verifyInputs();
const code = [...files('src'), ...files('scripts'), ...files('tests'), ...files('fixtures'), 'package.json', 'package-lock.json', 'tsconfig.json'].sort().map(path => fileBinding(path));
const inputs = JSON.parse(readFileSync(resolve(root, 'InputBindings.json')));
const salvaMembers = files('inputs/salva').map(path => ({ ...fileBinding(path), url: 'https://raw.githubusercontent.com/dimforge/salva/51c153e05974836eea17db445e30f1ff64bb5b32/' + path.replace('inputs/salva/', '') }));
const source = { schema: 'fluid-source-bindings/v1', baseline: inputs.baseline, branch: 'feature/fld-01-phy-05-2026-10-09',
  originalZipSha256: '0136d515ce6c86e3110bfb7fb91e1ccf1ceb8536cbef56dad9b4d6e4a6dd3d4d', inputManifest: fileBinding('InputBindings.json'),
  profileFileSha256: inputs.profileFileSha256, profileSemanticDigest: inputs.profileContentDigest,
  code, codeDigest: 'sha256:' + hash(JSON.stringify(code)), immutableInputMembers: inputs.copiedMembers,
  imports: [{ source: 'PLT-01-02 src/numerics.mjs and snapshot/time.mjs', changedPort: false, semantics: 'Tick validation and canonical identity; unchanged closure snapshot' }],
  derivedHelper: { source: 'PLT-01-02 scripts/seal.mjs', adaptation: 'Own branch/scopes/index/patch binding',
    origin: fileBinding('scripts/seal.mjs', resolve(root, '../../../../.worktrees/Hestia-Spike-PLT-01-02-2026-10-09/spikes/plt-01-02-numerics')) },
  shader: 'NOT_APPLICABLE_CPU_MODELS', wasm: 'NONE_CONSUMED; frozen producer scalar/SIMD were only load probes' };
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
const dependency = { schema: 'fluid-dependency-bindings/v1', npmPackages: Object.entries(lock.packages).filter(([key]) => key && (key === 'node_modules/typescript' || key === 'node_modules/@typescript/typescript-win32-x64')).map(([path, item]) => ({ path, ...item })),
  packageLock: fileBinding('package-lock.json'), compilerOnly: true, lifecycleScriptsExecuted: false,
  node: { version: process.version, ...fileBinding(process.execPath) },
  npmTool: { versionObserved: '10.9.8', ...fileBinding('C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js') },
  frozenTools: fileBinding('ToolBindings.json'),
  python: { versionObserved: '3.12.13', usedByRuntime: false, ...fileBinding('C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe') },
  git: fileBinding('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe'),
  browser: { chromeFileVersionObserved: '155.0.8059.40', execution: 'NOT_RUN_NOT_REQUIRED_CPU_ONLY', adapter: 'NOT_REQUESTED' },
  rust: { build: 'NOT_RUN_NO_NATIVE_SLOT', runtimeDependency: false },
  salvaSource: { commit: '51c153e05974836eea17db445e30f1ff64bb5b32', tag: 'v0.10.0', license: 'Apache-2.0', members: salvaMembers } };
const candidate = { schema: 'salva-source-candidate/v1', name: 'salva3d', version: '0.10.0', commit: dependency.salvaSource.commit,
  declaredRustRapier: '0.35.1', hestiaRequiredJsRapier: '0.21.0', hestiaRequiredRustRapier: '0.36.0',
  status: 'REQUIRES_SEPARATE_COMPATIBILITY_SPIKE', sourceInspection: 'PASS', rustBuild: 'NOT_RUN', wasmExports: 'NOT_RUN', runtimeCoupling: 'NOT_RUN',
  sourceMembers: salvaMembers, reason: 'Exact source crate declares Rapier0.35.1; current Hestia target uses Rust0.36.0. No shared JS World handles, cdylib/wrapper or built WASM are established by source inspection.',
  futureCouplingCost: ['Particle spacing/kernel-radius discretisation', 'Rigid-body/Collider conversion and full joint ownership', 'Boundary sampling', 'Particle memory/init/step/readback/dispose', 'Volume ledger coupling and duplicate-event policy'],
  productIntegration: 'NO', forkPolicy: 'If needed, explicit pinned source fork for target0.21.0 with legacy-impulse-v1 and gyroFALSE; never create an implicit0.12 fallback world.' };
for (const [name, value] of [['SourceBindings.json', source], ['DependencyBindings.json', dependency], ['SalvaCandidate.json', candidate]]) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (process.argv.includes('--check')) { if (readFileSync(resolve(root, name), 'utf8') !== text) throw Error('BINDING_DRIFT:' + name); }
  else writeFileSync(resolve(root, name), text);
}
console.log(JSON.stringify({ status: 'PASS', codeMembers: code.length, salvaMembers: salvaMembers.length, codeDigest: source.codeDigest }));
