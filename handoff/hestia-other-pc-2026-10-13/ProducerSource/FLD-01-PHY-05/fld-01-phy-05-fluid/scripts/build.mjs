import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, files, fileBinding, verifyInputs, verifyTools, sourcePaths, hash } from './bindings.mjs';

verifyInputs();
if (process.version !== 'v22.23.2') throw Error('NODE_VERSION');
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
const pin = lock.packages['node_modules/typescript'];
if (pin.version !== '7.0.2' || pin.integrity !== 'sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==' || pin.license !== 'Apache-2.0') throw Error('COMPILER_PIN');
const frozenTools = verifyTools();
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { cwd: root, windowsHide: true, encoding: 'utf8' });
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
if (result.status !== 0) { console.error('TYPECHECK_EXIT=' + result.status + ':' + (result.error?.code ?? '')); process.exit(1); }
// Preserve frozen input runtime bytes; the compiler's JS formatting is not a new PLT implementation.
for (const path of ['src/numerics.mjs', 'src/fixture.mjs', 'snapshot/time.mjs']) copyFileSync(resolve(root, 'inputs/plt', path), resolve(root, 'dist/inputs/plt', path));
verifyTools(); // Detect an in-flight tool mutation rather than rebinding it.
const source = sourcePaths().map(path => fileBinding(path));
const tools = [frozenTools.node, ...frozenTools.compilerMembers];
const outputs = files('dist').map(path => fileBinding(path));
const build = { schema: 'fluid-build/v1', nodeVersion: process.version, compiler: 'typescript@7.0.2', typecheckExitCode: result.status,
  inputManifestSha256: fileBinding('InputBindings.json').sha256, source, outputs, tools,
  sourceDigest: 'sha256:' + hash(JSON.stringify(source)), outputDigest: 'sha256:' + hash(JSON.stringify(outputs)) };
mkdirSync(resolve(root, '.runtime'), { recursive: true });
writeFileSync(resolve(root, 'BuildBindings.json'), JSON.stringify(build, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', typecheckExitCode: 0, sources: source.length, outputs: outputs.length, toolFiles: tools.length, sourceDigest: build.sourceDigest, outputDigest: build.outputDigest }));
