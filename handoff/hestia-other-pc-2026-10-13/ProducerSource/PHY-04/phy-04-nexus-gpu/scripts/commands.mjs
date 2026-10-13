import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
export const rustRoot = 'C:/IFI_SourceCode/Utils/Rust/rustup-home/toolchains/stable-x86_64-pc-windows-msvc';
export const cargo = rustRoot + '/bin/cargo.exe';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function assertFreshOutputs(id,paths) {
  if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))throw Error('SAFE_UNIQUE_ID_REQUIRED');
  for(const path of paths) if(existsSync(resolve(root,path)))throw Error('IMMUTABLE_OUTPUT_ID:'+id);
}
export function run(id, binary, args, options = {}) {
  const path = resolve(root, 'tests/commands/' + id + '.json');
  assertFreshOutputs(id,['tests/commands/'+id+'.json']);
  if (!binary.replaceAll('\\', '/').startsWith('C:/IFI_SourceCode/')) throw new Error('CIFI_BINARY_REQUIRED');
  const cwd = options.cwd ?? root;
  if (!cwd.replaceAll('\\', '/').startsWith('C:/IFI_SourceCode/')) throw new Error('CIFI_CWD_REQUIRED');
  const startedAt = new Date().toISOString();
  const r = spawnSync(binary, args, { cwd, env: options.env ?? process.env,
    windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: options.timeout ?? 60000 });
  const result = { id, binary, binarySha256: sha256(readFileSync(binary)), args, cwd,
    startedAt, finishedAt: new Date().toISOString(), exitCode: r.status, signal: r.signal,
    spawnError: r.error?.code ?? null, stdout: r.stdout?.toString() ?? '', stderr: r.stderr?.toString() ?? '' };
  mkdirSync(resolve(root, 'tests/commands'), { recursive: true });
  writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ id, exitCode: result.exitCode, spawnError: result.spawnError }));
  return result;
}
