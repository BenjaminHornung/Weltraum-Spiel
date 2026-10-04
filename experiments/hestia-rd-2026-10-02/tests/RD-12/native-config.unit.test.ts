import { afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// CPU config-import harness only. Two synthetic HEAD files and rev-parse are
// controlled; output admission/re-entry/records use actual fresh C-only files.
// No browser binary, server, port bind or native lease is exercised/granted.
const control = vi.hoisted(() => ({ files: new Map<string, string>(), head: 'a'.repeat(40), tree: 'b'.repeat(40), ordinal: 0 }));
vi.mock('node:fs', async () => {
  const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
  const mapped = (file: Parameters<typeof fs.readFileSync>[0]) => control.files.get(String(file)) ?? file;
  return { ...fs,
    readFileSync: (file: Parameters<typeof fs.readFileSync>[0], options: any) => fs.readFileSync(mapped(file), options),
    existsSync: (file: Parameters<typeof fs.existsSync>[0]) => fs.existsSync(mapped(file) as typeof file),
    lstatSync: (file: Parameters<typeof fs.lstatSync>[0], options: any) => fs.lstatSync(mapped(file) as typeof file, options),
    realpathSync: Object.assign((file: Parameters<typeof fs.realpathSync>[0], options: any) => fs.realpathSync(file, options),
      { native: (file: Parameters<typeof fs.realpathSync>[0], options: any) => control.files.has(String(file)) ? String(file) : fs.realpathSync.native(file, options) }),
  };
});
vi.mock('node:child_process', () => ({ execFileSync: (_binary: string, args: string[]) => {
  if (args.join(' ') === 'rev-parse HEAD') { return control.head + '\n'; }
  if (args.join(' ') === 'rev-parse HEAD^{tree}') { return control.tree + '\n'; }
  throw new Error('CPU config harness prohibits child execution');
} }));
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
const headRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/';
async function reload() { vi.resetModules(); return (await import('../../reports/RD-12/playwright.config')).default; }
function setup() {
  control.head = 'a'.repeat(40); control.tree = 'b'.repeat(40); const runId = `config-test-${++control.ordinal}`;
  const files = `${process.env.HESTIA_RD12_COMMAND_ROOT}/config-control/${runId}`; mkdirSync(files, { recursive: true });
  const outputRoot = files + '/native-root'; const executablePath = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
  const baseURL = 'http://127.0.0.1:5280'; let snapshotSha256 = ''; let revision = 0;
  function freeze() {
    const bytes = JSON.stringify({ start: control.head, tree: control.tree, productIntegrated: false, syntheticImmutableIdentity: true, nativeExecution: 'NOT_RUN_CONTROLLED_CPU' });
    const file = `${files}/synthetic-freeze-${++revision}.json`; writeFileSync(file, bytes, { flag: 'wx' });
    const snapshot = `${headRoot}freezes/${control.head}.json`; control.files.set(snapshot, file); snapshotSha256 = sha(bytes);
    vi.stubEnv('HESTIA_RD12_PHASE2_SNAPSHOT', snapshot); vi.stubEnv('HESTIA_RD12_PHASE2_SNAPSHOT_SHA256', snapshotSha256);
  }
  function lease(id: string) {
    const bytes = JSON.stringify({ id, status: 'RD12_NATIVE_AUTHORIZED', start: control.head, tree: control.tree, freezeSha256: snapshotSha256,
      runId, outputRoot, executablePath, baseURL, productIntegrated: false, syntheticImmutableIdentity: true, nativeExecution: 'NOT_RUN_CONTROLLED_CPU' });
    const file = `${files}/synthetic-lease-${++revision}.json`; writeFileSync(file, bytes, { flag: 'wx' });
    const virtual = `${headRoot}leases/RD12-${runId}-${revision}.json`; control.files.set(virtual, file);
    vi.stubEnv('HESTIA_RD12_NATIVE_LEASE', virtual); vi.stubEnv('HESTIA_RD12_NATIVE_LEASE_SHA256', sha(bytes));
  }
  vi.stubEnv('HESTIA_RD12_BROWSER_EXECUTABLE', executablePath); vi.stubEnv('HESTIA_RD12_NATIVE_BASE_URL', baseURL);
  vi.stubEnv('HESTIA_RD12_NATIVE_OUTPUT', outputRoot); vi.stubEnv('HESTIA_RD_BROWSER_RUN_ID', runId);
  vi.stubEnv('HESTIA_RD12_ADMITTED_BROWSER_ROOT', ''); vi.stubEnv('HESTIA_RD12_ADMISSION_SHA256', '');
  freeze(); lease('synthetic-lease-1'); return { outputRoot, freeze, lease };
}
afterEach(() => { vi.unstubAllEnvs(); control.files.clear(); }); // Deliberately retain every fresh directory/receipt.

it('REPAIR P2 config admits fresh freeze/lease-bound output once and accepts worker config reload without browser invocation', async () => {
  const { outputRoot } = setup(); expect(existsSync(outputRoot)).toBe(false);
  const first = await reload(); mkdirSync(first.outputDir!, { recursive: true }); // Simulated worker-owned results directory, not Playwright.
  const next = await reload(); expect(next.outputDir).toBe(first.outputDir); expect(next.outputDir).toBe(outputRoot + '/results');
  expect(process.env.HESTIA_RD12_ADMITTED_BROWSER_ROOT).toBe(outputRoot);
  expect(sha(readFileSync(outputRoot + '/admission.json', 'utf8'))).toBe(process.env.HESTIA_RD12_ADMISSION_SHA256);
});
it('REPAIR P2 config rejects arbitrary existing sink even with a matching env root and a foreign hash-bound admission record', async () => {
  const { outputRoot } = setup(); mkdirSync(outputRoot); vi.stubEnv('HESTIA_RD12_ADMITTED_BROWSER_ROOT', outputRoot);
  await expect(reload()).rejects.toThrow(/Fresh|Existing|admission/i);
  const foreign = JSON.stringify({ schema: 'rd12-native-output-admission-v1', foreign: true }); writeFileSync(outputRoot + '/admission.json', foreign, { flag: 'wx' });
  vi.stubEnv('HESTIA_RD12_ADMISSION_SHA256', sha(foreign)); await expect(reload()).rejects.toThrow(/Fresh|Existing|admission/i);
  expect(readFileSync(outputRoot + '/admission.json', 'utf8')).toBe(foreign);
});
it('REPAIR P2 config rejects same existing output under another lease or freeze and preserves the first admitted record', async () => {
  const { outputRoot, freeze, lease } = setup(); const first = await reload(); mkdirSync(first.outputDir!, { recursive: true });
  expect(existsSync(outputRoot + '/admission.json')).toBe(true); const record = readFileSync(outputRoot + '/admission.json', 'utf8');
  lease('synthetic-lease-2'); await expect(reload()).rejects.toThrow(/Fresh|Existing|admission/i);
  control.head = 'c'.repeat(40); freeze(); lease('synthetic-lease-3'); await expect(reload()).rejects.toThrow(/Fresh|Existing|admission/i);
  expect(readFileSync(outputRoot + '/admission.json', 'utf8')).toBe(record);
});
