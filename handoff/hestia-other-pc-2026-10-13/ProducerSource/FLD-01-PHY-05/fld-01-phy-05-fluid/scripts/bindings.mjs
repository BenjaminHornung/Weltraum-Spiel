import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function fileBinding(path, base = root) {
  const target = resolve(base, path), stat = lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('NON_REGULAR_FILE:' + path);
  const bytes = readFileSync(target);
  return { path, bytes: bytes.length, sha256: hash(bytes) };
}
export function files(directory, base = root) {
  const paths = [];
  for (const entry of readdirSync(resolve(base, directory), { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isSymbolicLink()) throw Error('SYMLINK:' + path);
    if (entry.isDirectory()) paths.push(...files(path, base));
    else if (entry.isFile()) paths.push(path);
    else throw Error('NON_REGULAR_FILE:' + path);
  }
  return paths.sort();
}
export function verifyMembers(members, base = root) {
  const unique = new Set();
  for (const entry of members) {
    if (typeof entry.path !== 'string' || relative(base, resolve(base, entry.path)).startsWith('..') || unique.has(entry.path)) throw Error('INVALID_MEMBER');
    unique.add(entry.path);
    const actual = fileBinding(entry.path, base);
    if (entry.bytes !== actual.bytes || entry.sha256 !== actual.sha256) throw Error('BYTE_DRIFT:' + entry.path);
  }
}
export function sourcePaths() {
  return [...files('src'), ...files('scripts'), ...files('tests'), ...files('fixtures'), 'package.json', 'package-lock.json', 'tsconfig.json',
    'SourceBindings.json', 'DependencyBindings.json', 'SalvaCandidate.json', 'ToolBindings.json'].sort();
}
export function verifyInventory(members, currentPaths) {
  if (JSON.stringify(members.map(x => x.path).sort()) !== JSON.stringify([...currentPaths].sort())) throw Error('SOURCE_MEMBER_DRIFT');
}
export function verifyTools() {
  const tool = JSON.parse(readFileSync(resolve(root, 'ToolBindings.json')));
  if (tool.schema !== 'fluid-tool-bindings/v1' || tool.nodeVersion !== process.version || process.version !== 'v22.23.2') throw Error('TOOL_SCHEMA');
  verifyMembers(tool.compilerMembers);
  verifyInventory(tool.compilerMembers, [...files('node_modules/typescript'), ...files('node_modules/@typescript/typescript-win32-x64')]);
  const node = fileBinding(process.execPath);
  if (node.path !== tool.node.path || node.bytes !== tool.node.bytes || node.sha256 !== tool.node.sha256) throw Error('NODE_BYTE_DRIFT');
  return tool;
}
export function verifyInputs() {
  const manifest = JSON.parse(readFileSync(resolve(root, 'InputBindings.json')));
  if (manifest.schema !== 'fluid-input-bindings/v1' || manifest.copiedMembers.length !== 27) throw Error('INPUT_SCHEMA');
  verifyMembers(manifest.copiedMembers);
  const profile = JSON.parse(readFileSync(resolve(root, 'inputs/plt/NumericsProfile.json')));
  const { contentDigest, ...semantic } = profile;
  if (contentDigest !== 'sha256:' + hash(JSON.stringify(semantic)) || contentDigest !== manifest.profileContentDigest) throw Error('PROFILE_SEMANTIC_DRIFT');
  const { sha256: profileSha } = fileBinding('inputs/plt/NumericsProfile.json');
  if (profileSha !== manifest.profileFileSha256 || profileSha !== 'c7652cc948a0f213a8a29ff75bdb0a76ede71344c315f924fcc541e6f7ead551') throw Error('PROFILE_FILE_DRIFT');
  return manifest;
}
export function verifyBuild() {
  verifyInputs();
  const build = JSON.parse(readFileSync(resolve(root, 'BuildBindings.json')));
  if (process.version !== build.nodeVersion || build.nodeVersion !== 'v22.23.2') throw Error('NODE_VERSION');
  verifyMembers(build.source); verifyMembers(build.outputs);
  verifyInventory(build.source, sourcePaths());
  verifyTools();
  for (const entry of build.tools) {
    if (entry.path !== process.execPath && !entry.path.startsWith('node_modules/')) throw Error('UNKNOWN_TOOL');
    const actual = fileBinding(entry.path);
    if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) throw Error('TOOL_BYTE_DRIFT:' + entry.path);
  }
  if (JSON.stringify(files('dist')) !== JSON.stringify(build.outputs.map(x => x.path))) throw Error('OUTPUT_MEMBER_DRIFT');
  if (build.inputManifestSha256 !== fileBinding('InputBindings.json').sha256) throw Error('INPUT_MANIFEST_DRIFT');
  return build;
}
