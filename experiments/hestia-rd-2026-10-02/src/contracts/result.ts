import { validateSourceRefs, type SourceRef } from './fixture';
import { array, canonicalJson, digest, finite, freezeJson, id, integer, keys,
  parseBoundedJson, relativePath, requireValue, text } from './validation';

export type LabMetric = { readonly status: 'measured' | 'estimated'; readonly value: number;
  readonly unit: string; readonly reason?: string } | { readonly status: 'unsupported' | 'not-run';
  readonly unit: string; readonly reason: string; readonly value?: never };

export function validateMetric(value: unknown): LabMetric {
  keys(value, ['status', 'value', 'unit', 'reason'], ['status', 'unit']);
  const metric = value as LabMetric; text(metric.unit);
  if (metric.status === 'measured' || metric.status === 'estimated') {
    finite(metric.value, 0);
    if (metric.status === 'estimated') { text(metric.reason); }
    if (metric.reason !== undefined) { text(metric.reason); }
  } else {
    requireValue(metric.status === 'unsupported' || metric.status === 'not-run', 'Invalid measurement status');
    requireValue(!Object.hasOwn(metric, 'value'), 'Unavailable measurement must not have a value (including zero/null)');
    text(metric.reason);
  }
  return freezeJson(JSON.parse(canonicalJson(metric)) as LabMetric);
}

export interface LabRunResultV1 {
  readonly schema: 'hestia-rd-result-v1'; readonly runId: string;
  readonly scenarioId: string; readonly scenarioDigest: string; readonly variantId: string;
  readonly fixtureDigest: string; readonly sourceRefs: readonly SourceRef[];
  readonly buildDigest: string; readonly lockDigest: string; readonly sourceDigest: string; readonly sourceBytesDigest: string;
  readonly browser: { readonly executable: string; readonly version: string };
  readonly device: { readonly id: string; readonly description: string; readonly driver: LabMetric };
  readonly backend: string; readonly runClass: 'diagnostic' | 'image-motion' | 'selection-benchmark';
  readonly temperature: 'warm' | 'document-cold' | 'process-cold' | 'driver-cold';
  readonly samples: { readonly planned: number; readonly observed: number; readonly skipped: number;
    readonly failed: number; readonly skippedReasons: readonly string[] };
  readonly rawDataPaths: readonly string[]; readonly errors: readonly string[];
  readonly metrics: { readonly cpuMs: LabMetric; readonly gpuMs: LabMetric; readonly frameMs: LabMetric;
    readonly uploadBytes: LabMetric; readonly cpuBytes: LabMetric; readonly gpuBytes: LabMetric };
  readonly media: readonly { readonly path: string; readonly sha256: string; readonly kind: 'image' | 'video' }[];
  readonly gates: readonly { readonly id: string; readonly status: 'PASS' | 'FAIL' | 'NOT_RUN' | 'UNSUPPORTED'; readonly reason: string }[];
  readonly productIntegrated: false;
}

export function createRunResult(value: unknown): LabRunResultV1 {
  const result = value as LabRunResultV1;
  keys(result, ['schema', 'runId', 'scenarioId', 'scenarioDigest', 'variantId', 'fixtureDigest', 'sourceRefs',
    'buildDigest', 'lockDigest', 'sourceDigest', 'sourceBytesDigest', 'browser', 'device', 'backend', 'runClass', 'temperature',
    'samples', 'rawDataPaths', 'errors', 'metrics', 'media', 'gates', 'productIntegrated']);
  requireValue(result.schema === 'hestia-rd-result-v1' && result.productIntegrated === false, 'Lab result only; unsupported schema/integration claim');
  [result.runId, result.scenarioId, result.variantId].forEach(id);
  [result.scenarioDigest, result.fixtureDigest, result.buildDigest, result.lockDigest, result.sourceBytesDigest].forEach(digest); id(result.sourceDigest);
  validateSourceRefs(result.sourceRefs); keys(result.browser, ['executable', 'version']); text(result.browser.version);
  requireValue(typeof result.browser.executable === 'string' && result.browser.executable.startsWith('C:/IFI_SourceCode/')
    && !result.browser.executable.includes('..') && !result.browser.executable.includes('\\'), 'Browser outside allowed execution tree');
  keys(result.device, ['id', 'description', 'driver']); id(result.device.id); text(result.device.description); validateMetric(result.device.driver);
  text(result.backend); requireValue(['diagnostic', 'image-motion', 'selection-benchmark'].includes(result.runClass), 'Invalid run class');
  requireValue(['warm', 'document-cold', 'process-cold', 'driver-cold'].includes(result.temperature), 'Invalid cold/warm class');
  keys(result.samples, ['planned', 'observed', 'skipped', 'failed', 'skippedReasons']);
  [result.samples.planned, result.samples.observed, result.samples.skipped, result.samples.failed].forEach((count) => { integer(count); });
  requireValue(result.samples.observed + result.samples.skipped === result.samples.planned
    && result.samples.failed <= result.samples.observed, 'Samples/failures must remain in the planned denominator');
  array(result.samples.skippedReasons); result.samples.skippedReasons.forEach(text);
  requireValue(result.samples.skipped === 0 || result.samples.skippedReasons.length > 0, 'Missing skipped-sample reason');
  array(result.rawDataPaths); result.rawDataPaths.forEach(relativePath); array(result.errors); result.errors.forEach(text);
  keys(result.metrics, ['cpuMs', 'gpuMs', 'frameMs', 'uploadBytes', 'cpuBytes', 'gpuBytes']);
  Object.values(result.metrics).forEach(validateMetric); array(result.media);
  for (const media of result.media) {
    keys(media, ['path', 'sha256', 'kind']); relativePath(media.path); digest(media.sha256);
    requireValue(media.kind === 'image' || media.kind === 'video', 'Invalid media kind');
  }
  array(result.gates);
  for (const gate of result.gates) {
    keys(gate, ['id', 'status', 'reason']); id(gate.id); text(gate.reason);
    requireValue(['PASS', 'FAIL', 'NOT_RUN', 'UNSUPPORTED'].includes(gate.status), 'Invalid gate status');
  }
  return freezeJson(JSON.parse(canonicalJson(result)) as LabRunResultV1);
}

export function importRunResult(bytes: Uint8Array): LabRunResultV1 { return createRunResult(parseBoundedJson(bytes)); }
