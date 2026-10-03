import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';
import { captureBrowserScreenshot, createBrowserRunDirectory } from './capture-admission.mjs';

const id = process.argv[2];
assert.match(id ?? '', /^[a-z0-9-]{1,96}$/);
const root = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03/checks/${id}`;
assertIsolation({ task: 'RD-03', runRoot: root });
mkdirSync(root);
const cases = [];
const sentinel = Buffer.from('Admission-only retained image sentinel; not a screenshot\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
let callbackCalls = 0;
async function fencedCapture(image) {
  callbackCalls += 1;
  assert.equal(lstatSync(image, { throwIfNoEntry: false }), undefined, 'Fence refuses any existing screenshot destination before writing');
  writeFileSync(image, sentinel, { flag: 'wx' });
}

const fresh = createBrowserRunDirectory(`${root}/browser/fresh/RUN03`);
await captureBrowserScreenshot(`${fresh}/webgl2.png`, fencedCapture);
assert.equal(callbackCalls, 1); assert.deepEqual(readFileSync(`${fresh}/webgl2.png`), sentinel);
cases.push({ id: 'fresh-run03', callbackCalls: 1, status: 'PASS' });

const reused = `${root}/browser/reused/RUN03`;
mkdirSync(reused, { recursive: true });
const retainedImage = `${reused}/webgl2.png`; const retainedJson = `${reused}/functional.json`;
writeFileSync(retainedImage, sentinel, { flag: 'wx' });
writeFileSync(retainedJson, '{"retained":true,"productIntegrated":false}\n', { flag: 'wx' });
const imageBefore = readFileSync(retainedImage); const jsonBefore = readFileSync(retainedJson);
callbackCalls = 0;
await assert.rejects(async () => {
  createBrowserRunDirectory(reused);
  await captureBrowserScreenshot(retainedImage, fencedCapture);
});
assert.deepEqual(readFileSync(retainedImage), imageBefore); assert.deepEqual(readFileSync(retainedJson), jsonBefore);
console.log(JSON.stringify({ id: 'reused-run03', callbackCalls, retainedImageSha256: hash(imageBefore), retainedJsonSha256: hash(jsonBefore), bytesUnchanged: true }));
assert.equal(callbackCalls, 0, 'Reused RUN03 must be rejected before screenshot callback');
cases.push({ id: 'reused-run03', callbackCalls, bytesUnchanged: true, status: 'PASS' });

const lifecycle = createBrowserRunDirectory(`${root}/browser/fresh/RUN04`);
writeFileSync(`${lifecycle}/lifecycle.json`, '{"retained":true}\n', { flag: 'wx' });
const lifecycleBefore = readFileSync(`${lifecycle}/lifecycle.json`);
assert.throws(() => createBrowserRunDirectory(lifecycle), { code: 'EEXIST' });
assert.deepEqual(readFileSync(`${lifecycle}/lifecycle.json`), lifecycleBefore);
cases.push({ id: 'fresh-and-reused-run04', bytesUnchanged: true, status: 'PASS' });

const linkTarget = `${root}/owned-link-target`; mkdirSync(linkTarget);
writeFileSync(`${linkTarget}/retained.txt`, sentinel, { flag: 'wx' });
for (const kind of ['regular-file', 'directory', 'junction', 'dangling-junction']) {
  const directory = createBrowserRunDirectory(`${root}/targets/${kind}/RUN03`); const image = `${directory}/webgl2.png`;
  if (kind === 'regular-file') { writeFileSync(image, sentinel, { flag: 'wx' }); }
  else if (kind === 'directory') { mkdirSync(image); }
  else { symlinkSync(kind === 'junction' ? linkTarget : `${root}/missing-owned-target`, image, 'junction'); }
  const linkBefore = lstatSync(image).isSymbolicLink() ? readlinkSync(image) : undefined;
  callbackCalls = 0;
  await assert.rejects(captureBrowserScreenshot(image, fencedCapture));
  assert.equal(callbackCalls, 0, `${kind} must reject before screenshot callback`);
  if (kind === 'regular-file') { assert.deepEqual(readFileSync(image), sentinel); }
  if (linkBefore !== undefined) { assert.equal(readlinkSync(image), linkBefore); }
  assert.deepEqual(readFileSync(`${linkTarget}/retained.txt`), sentinel);
  cases.push({ id: `existing-screenshot-${kind}`, callbackCalls, status: 'PASS' });
}

const linkedRun = `${root}/linked-RUN03`; symlinkSync(linkTarget, linkedRun, 'junction');
const linkedParent = `${root}/linked-parent`; symlinkSync(linkTarget, linkedParent, 'junction');
const fileRun = `${root}/file-RUN03`; writeFileSync(fileRun, sentinel, { flag: 'wx' });
for (const directory of [linkedRun, `${linkedParent}/RUN03`, fileRun]) {
  assert.throws(() => createBrowserRunDirectory(directory), /Run root link\/non-directory forbidden/);
}
assert.equal(lstatSync(`${linkTarget}/RUN03`, { throwIfNoEntry: false }), undefined);
assert.deepEqual(readFileSync(fileRun), sentinel);
cases.push({ id: 'linked-run-linked-parent-file-run', status: 'PASS' });

const result = { status: 'PASS', qualification: 'NATIVE-ADMISSION-ONLY-NO-BROWSER-OR-RENDERING', cases,
  retained: { imageSha256: hash(imageBefore), jsonSha256: hash(jsonBefore), lifecycleSha256: hash(lifecycleBefore) }, productIntegrated: false };
writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(JSON.stringify(result));
