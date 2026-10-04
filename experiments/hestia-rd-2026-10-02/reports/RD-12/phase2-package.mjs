import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { admit, directory } from './run.mjs';
import { lab, commands, nativeOutput, START2, TREE2, immutable, fresh, regular, bound, files, sha, json, ownBindings } from './phase2-support.mjs';
import { VISUAL_ORACLE_V1, compareSceneRoi } from './oracle.ts';

export const sliceRoot = path.join(lab, 'reports/RD-12/phase2-slice-5e4c1b8f');
const decoderPath = path.join(lab, 'node_modules/playwright-core/lib/utilsBundle.js');
regular(decoderPath); const { PNG } = createRequire(import.meta.url)(decoderPath);
const label = process.argv[2]; const operation = process.argv[3]; assert.match(label ?? '', /^[a-z0-9-]+$/);
const started = new Date().toISOString();
fresh(`${commands}/${label}/started.json`, { started, script: bound(import.meta.filename), source: START2, bindings: ownBindings(), operation, nativeExecution: 'NOT_RUN_OFFLINE_EXTRACTION', productIntegrated: false });
function put(relative, data) {
  assert(!path.isAbsolute(relative) && !relative.split('/').includes('..'));
  const file = path.join(sliceRoot, relative); directory(path.dirname(file), sliceRoot); admit(file, { owner: sliceRoot });
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  writeFileSync(file, bytes, { flag: 'wx' }); return { path: relative, bytes: bytes.length, sha256: sha(bytes) };
}
function attachmentBytes(attachment) {
  if (attachment.body !== undefined) { return Buffer.from(attachment.body, 'base64'); }
  assert(attachment.path); return regular(attachment.path, nativeOutput);
}
function cases(report) {
  return report.suites.flatMap((suite) => [...(suite.specs ?? []), ...cases({ suites: suite.suites ?? [] })]);
}
function crop(image, rect) {
  const x = Math.round(rect[0] * image.width); const y = Math.round(rect[1] * image.height);
  const width = Math.floor(rect[2] * image.width); const height = Math.floor(rect[3] * image.height);
  assert(x >= 0 && y >= 0 && x + width <= image.width && y + height <= image.height);
  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) { image.data.copy(pixels, row * width * 4, ((y + row) * image.width + x) * 4, ((y + row) * image.width + x + width) * 4); }
  return { x, y, width, height, pixels };
}
try {
  immutable();
  if (operation === 'build') {
    assert(!existsSync(sliceRoot), 'Never overwrite an evidence slice'); directory(sliceRoot, path.join(lab, 'reports/RD-12'));
    const gateSource = regular(path.join(lab, 'reports/RD-12/qualification-v2.ts'), lab).toString();
    const linkedGate = gateSource.replace("from './oracle'", `from '${pathToFileURL(path.join(lab, 'reports/RD-12/oracle.ts')).href}'`);
    assert.notEqual(linkedGate, gateSource); const gateFile = `${commands}/${label}/qualification-v2-linked.mjs`;
    fresh(gateFile, stripTypeScriptTypes(linkedGate)); const { requireQualifiedParityV2 } = await import(pathToFileURL(gateFile).href);
    const reports = [
      ['original', 'native-results.json', undefined, 0, 16],
      ['diagnosis-v1', 'diagnosis-v1-results.json', 'e7156837c5e09333b27f07373e406dad5a51b4dd3ff7cd9c43dec9b28f675eed', 3, 0],
      ['functional-v2', 'functional-v2-results.json', 'e7b346c5a0756795ac85665fc688e3f8645a686dcf61e9cfdc76ff5232d0a46e', 12, 4],
    ];
    const reportIndex = []; let functional;
    for (const [version, name, expectedSha, passed, failed] of reports) {
      const file = `${nativeOutput}/${name}`; const report = json(file, expectedSha); const bytes = regular(file, nativeOutput);
      assert.equal(report.stats.expected, passed); assert.equal(report.stats.unexpected, failed); assert.equal(report.stats.skipped, 0);
      const compressed = put(`sources/${version}-report.json.gz`, gzipSync(bytes));
      assert.equal(sha(gunzipSync(regular(path.join(sliceRoot, compressed.path), sliceRoot))), sha(bytes));
      reportIndex.push({ version, source: bound(file), portable: compressed, passed, failed, skipped: 0 });
      if (version === 'functional-v2') { functional = report; }
    }
    const images = []; const matrix = []; const retained = []; const contact = []; const decoded = new Map();
    let imageNumber = 0;
    for (const [caseIndex, spec] of cases(functional).entries()) {
      assert.equal(spec.tests.length, 1); assert.equal(spec.tests[0].results.length, 1); const result = spec.tests[0].results[0];
      const mode = spec.title.match(/native (C[34])/)[1]; const caseDir = `cases/case-${String(caseIndex + 1).padStart(2, '0')}`;
      const record = { case: caseIndex + 1, title: spec.title, mode, status: result.status, error: result.error?.message ?? null, attachments: [] };
      for (const [attachmentIndex, attachment] of result.attachments.entries()) {
        const bytes = attachmentBytes(attachment);
        if (attachment.path) { retained.push({ case: caseIndex + 1, name: attachment.name, source: bound(attachment.path, nativeOutput) }); }
        if (attachment.contentType === 'application/json') {
          const stored = put(`${caseDir}/attachment-${attachmentIndex + 1}.json`, bytes); record.attachments.push({ name: attachment.name, ...stored });
          if (attachment.name === 'supplemental-network-console.json') {
            const network = JSON.parse(bytes); assert.deepEqual(network.offsite, []); assert.deepEqual(network.compilerRequests, []);
            record.network = { requests: network.requests.length, offsite: 0, compilerRequests: 0, pageErrors: network.errors, proof: stored.path };
          }
        }
        if (attachment.contentType === 'image/png' && attachment.name.endsWith('.png')) {
          const metadataAttachment = result.attachments[attachmentIndex + 1]; assert.equal(metadataAttachment.name, `${attachment.name.slice(0, -4)}.json`);
          const metadataBytes = attachmentBytes(metadataAttachment); const metadata = JSON.parse(metadataBytes); const d = metadata.before.diagnostic;
          assert.equal(metadata.screenshotSha256, sha(bytes)); assert.deepEqual(metadata.before.diagnostic.rendered, metadata.after.diagnostic.rendered);
          assert.equal(metadata.productIntegrated, false); assert.equal(d.productIntegrated, false); assert.equal(d.backend.actual, mode === 'C3' ? 'webgl2' : 'webgpu');
          assert.equal(d.rendered.fixtureDigest, d.fixtureDigest); assert.equal(d.rendered.cameraId, d.frame.cameraId);
          assert.equal(d.rendered.projectionGeneration, d.projectionGeneration); assert.equal(d.rendered.presentationGeneration, d.presentationGeneration);
          const png = PNG.sync.read(bytes); assert.equal(png.data.length, png.width * png.height * 4); const id = ++imageNumber;
          const stored = put(`images/image-${String(id).padStart(3, '0')}.png`, bytes); const facts = put(`facts/image-${String(id).padStart(3, '0')}.json`, metadataBytes);
          const image = { id, case: caseIndex + 1, mode, originalAttachment: attachment.name, ...stored, facts, width: png.width, height: png.height,
            decodedRgbaSha256: sha(png.data), decodedBytes: png.data.length, backend: d.backend.actual, resolution: d.resolution,
            frame: d.frame, fixtureDigest: d.fixtureDigest, sourceRevision: d.sourceRevision, rendered: d.rendered,
            evidence: 'native browser presentation screenshot; NOT mapped GPU buffer readback' };
          images.push(image); decoded.set(id, png);
          if (!contact.some((entry) => entry.case === record.case) && /normal visible flow/.test(spec.title)) { contact.push(image); }
        }
      }
      assert(record.network); matrix.push(record);
    }
    assert.equal(matrix.length, 16); assert.equal(images.length, 68);
    const measurements = [];
    for (const mode of ['C3', 'C4']) {
      for (const region of VISUAL_ORACLE_V1.regions) {
        const captures = ['original', 'restored', 'deliberate-fault'].map((suffix) => {
          const image = images.find((entry) => entry.originalAttachment === `${mode}-${region.id}-${suffix}.png`); assert(image); contact.push(image);
          const sampled = crop(decoded.get(image.id), region.rect); const packed = put(`pixels/${mode}-${region.id}-${suffix}.rgba.gz`, gzipSync(sampled.pixels));
          return { image, sampled, packed };
        });
        const [reference, restored, fault] = captures; const positive = compareSceneRoi(reference.sampled.pixels, restored.sampled.pixels);
        const negative = compareSceneRoi(reference.sampled.pixels, fault.sampled.pixels); let qualification;
        try { qualification = { status: 'PASS_SAME_BACKEND_CONTROL_ONLY', result: requireQualifiedParityV2(reference.sampled.pixels, restored.sampled.pixels, fault.sampled.pixels) }; }
        catch (error) { qualification = { status: 'DEFER_INSENSITIVE_FAULT', error: String(error) }; }
        const owning = matrix.find((entry) => entry.title.includes(`native ${mode} ${region.id} `)); assert(owning);
        if (region.id === 'F01-scene-baked-colors') {
          assert.equal(owning.status, 'passed'); assert.equal(qualification.status, 'PASS_SAME_BACKEND_CONTROL_ONLY');
          const oracle = owning.attachments.find((entry) => entry.name.endsWith('-oracle.json')); assert(oracle);
          assert.deepEqual(json(path.join(sliceRoot, oracle.path)).result, qualification.result);
        } else { assert.equal(owning.status, 'failed'); assert.equal(qualification.status, 'DEFER_INSENSITIVE_FAULT'); assert(negative.meanRgbError < VISUAL_ORACLE_V1.minimumFaultMeanRgbError); }
        measurements.push({ mode, region, positive, negative, qualification, crossEngineParity: 'NOT_RUN', captures: captures.map(({ image, sampled, packed }) => ({ image: image.path, facts: image.facts.path,
          fullPngSha256: image.sha256, roi: { x: sampled.x, y: sampled.y, width: sampled.width, height: sampled.height }, decodedRoiSha256: sha(sampled.pixels), decodedBytes: sampled.pixels.length, compressedRgba: packed })), productIntegrated: false });
      }
    }
    put('measurements.json', { schema: 'rd12-native-png-measurements-v1', source: START2, tree: TREE2, decoder: bound(decoderPath), gate: bound(path.join(lab, 'reports/RD-12/qualification-v2.ts')),
      generatedLinkedGate: bound(gateFile), thresholds: VISUAL_ORACLE_V1, measurements, nativeMemory: 'UNKNOWN_UNSUPPORTED', qualifiedGpuPerformance: 'NOT_GRANTED', productIntegrated: false });
    put('result-matrix.json', { original: { passed: 0, failed: 16, reason: 'collapsed facts innerText reader', qualified: false }, diagnosis: { passed: 3, failed: 0 }, functionalV2: { passed: 12, failed: 4, cases: matrix }, retainedFailureFiles: retained, productIntegrated: false });
    const width = 1280; const rows = Math.ceil(contact.length / 4); const height = rows * 180; const raster = Buffer.alloc(width * height * 4);
    for (let offset = 3; offset < raster.length; offset += 4) { raster[offset] = 255; }
    for (const [index, entry] of contact.entries()) {
      const source = decoded.get(entry.id); const scale = Math.min(320 / source.width, 180 / source.height); const w = Math.floor(source.width * scale); const h = Math.floor(source.height * scale);
      // ponytail: nearest-neighbor is only a visual index; use image-aware resampling if preview quality matters. Originals own all measurements.
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const from = (Math.floor(y / scale) * source.width + Math.floor(x / scale)) * 4;
          const to = ((Math.floor(index / 4) * 180 + y) * width + index % 4 * 320 + x) * 4; source.data.copy(raster, to, from, from + 4);
        }
      }
    }
    put('contact-sheet.png', PNG.sync.write({ width, height, data: raster }));
    put('contact-sheet.md', '# Native diagnostic contact sheet\n\nDerived thumbnails, not native evidence or measurements. Rows read left to right; original PNG/facts remain unchanged.\n\n' + contact.map((entry, index) => `${index + 1}. [${entry.originalAttachment}](${entry.path}) — ${entry.mode}; facts [${entry.id}](${entry.facts.path})`).join('\n') + '\n');
    put('README.md', '# RD12 native functional diagnostic slice\n\nExecuted immutable source `' + START2 + '`. ProductIntegrated=false.\n\nOriginal suite: FAIL16 (collapsed facts innerText). Explicit reader-v2 supplement: 12 PASS / 4 FAIL. Native readback: UNSUPPORTED. F06 fault sensitivity: DEFER; thresholds and ROI unchanged. F01 qualifies only same-backend restoration/fault control, not C0/cross-engine material equivalence.\n\n[Result matrix](result-matrix.json), [measurements](measurements.json), [contact sheet legend](contact-sheet.md), [derived sheet](contact-sheet.png), [manifest](manifest.json). All primary media/facts/pixel references are package-relative. Gzip pixel files contain the exact decoded native PNG ROI RGBA.\n\nDPR2 screenshots retain the original locator capture: CSS presentation dimensions, not GPU-buffer readback. Logical teardown zero is not released VRAM. Memory unknown; default adapter observed, not GPU/performance-qualified. Raw reports are losslessly compressed under sources; original failure traces remain at the recorded external run sinks. No art/performance/product or whole RD51/RD52 completion claim.\n');
    const manifest = files(sliceRoot); put('manifest.json', { schema: 'rd12-native-relative-slice-v1', source: START2, tree: TREE2, reports: reportIndex, images, files: manifest,
      relativePrimaryReferences: true, qualification: 'PARTIAL_FUNCTIONAL_DIAGNOSTIC_NOT_FULL_NATIVE_ACCEPTANCE', productIntegrated: false });
  } else {
    assert.equal(operation, 'verify'); const manifest = json(path.join(sliceRoot, 'manifest.json')); assert.equal(manifest.source, START2); assert.equal(manifest.productIntegrated, false);
    for (const entry of manifest.files) { const bytes = regular(path.join(sliceRoot, entry.path), sliceRoot); assert.equal(bytes.length, entry.bytes); assert.equal(sha(bytes), entry.sha256); }
    assert.equal(files(sliceRoot).length, manifest.files.length + 1);
    for (const entry of manifest.images) {
      const pixels = PNG.sync.read(regular(path.join(sliceRoot, entry.path), sliceRoot)); assert.equal(sha(pixels.data), entry.decodedRgbaSha256);
      const facts = json(path.join(sliceRoot, entry.facts.path)); assert.equal(facts.screenshotSha256, entry.sha256); assert.deepEqual(facts.before.diagnostic.rendered, entry.rendered);
    }
    for (const measurement of json(path.join(sliceRoot, 'measurements.json')).measurements) {
      for (const capture of measurement.captures) { const pixels = gunzipSync(regular(path.join(sliceRoot, capture.compressedRgba.path), sliceRoot)); assert.equal(sha(pixels), capture.decodedRoiSha256); assert.equal(pixels.length, capture.decodedBytes); }
    }
  }
  fresh(`${commands}/${label}/receipt.json`, { started, finished: new Date().toISOString(), operation, exitCode: 0, timedOut: false, source: START2, script: bound(import.meta.filename), bindings: ownBindings(),
    slice: bound(path.join(sliceRoot, 'manifest.json')), nativeExecution: 'NOT_RUN_OFFLINE_EXTRACTION', productIntegrated: false });
  console.log(JSON.stringify({ status: 'PASS_NATIVE_EVIDENCE_EXTRACTION_NOT_FULL_QUALIFICATION', operation, sliceRoot, manifest: bound(path.join(sliceRoot, 'manifest.json')) }));
} catch (error) {
  fresh(`${commands}/${label}/receipt.json`, { started, finished: new Date().toISOString(), operation, exitCode: 1, timedOut: false, source: START2, script: bound(import.meta.filename), error: String(error), bindings: ownBindings(), productIntegrated: false }); throw error;
}
