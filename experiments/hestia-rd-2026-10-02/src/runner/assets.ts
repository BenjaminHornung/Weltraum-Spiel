import { getFixtureDigest, importFixture, type LabFixtureV1 } from '../contracts/fixture';
import { getScenarioDigest, importScenario } from '../contracts/scenario';
import { MAX_MANIFEST_BYTES, MAX_PAYLOAD_BYTES, array, digest, id, integer, keys, parseBoundedJson,
  record, relativePath, requireValue, sha256, text } from '../contracts/validation';

export const PINNED_INVENTORY_SHA256 = '26bf86bba1cbd1955d069ab2eac8d491b6cade59d16a004f1d094cc117ebc9c6';
interface FixtureEntry { readonly id: string; readonly fixtureDigest: string; readonly manifestPath: string;
  readonly manifestSha256: string; readonly manifestBytes: number; readonly payloadBytes: number; }
interface ScenarioEntry { readonly id: string; readonly initialFixtureDigest: string; readonly path: string;
  readonly sha256: string; readonly scenarioDigest: string; readonly snapshots: readonly { readonly fixtureDigest: string }[]; }
export interface LabInventory { readonly fixtures: readonly FixtureEntry[]; readonly scenarios: readonly ScenarioEntry[]; }

/** Same-origin public assets only. BASE_URL, not nested HTML or /fixtures/, owns the root. */
export function publicAssetRoot(base: string, pageUrl: string): URL {
  const page = new URL(pageUrl); const root = new URL(base, page.origin);
  requireValue(root.origin === page.origin && root.pathname.endsWith('/') && !root.search && !root.hash, 'Invalid public asset root');
  return root;
}
function assetUrl(relative: string, root: URL): URL {
  relativePath(relative); const url = new URL(relative, root);
  requireValue(url.origin === root.origin && url.pathname.startsWith(new URL('.', root).pathname)
    && !url.search && !url.hash, 'Asset outside public root');
  return url;
}

/** Reject advertised oversize before body allocation; stop streamed oversize before concatenation. */
export async function readBoundedResponse(response: Response, limit: number, exact?: number): Promise<Uint8Array<ArrayBuffer>> {
  requireValue(response.ok && response.body, `Asset request failed: ${response.status}`);
  const advertised = response.headers.get('content-length');
  if (advertised !== null) {
    if (!/^\d+$/.test(advertised) || Number(advertised) > limit || (exact !== undefined && Number(advertised) !== exact)) {
      await response.body.cancel(); throw new Error('Asset size exceeds limit or differs from binding');
    }
  }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) { break; }
      count += value.byteLength;
      requireValue(count <= limit && (exact === undefined || count <= exact), 'Asset size exceeds limit');
      chunks.push(value);
    }
    requireValue(exact === undefined || count === exact, 'Asset actual length differs from binding');
    const bytes = new Uint8Array(count); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
async function fetchBytes(url: URL, limit: number, fetcher: typeof fetch, signal?: AbortSignal, exact?: number) {
  signal?.throwIfAborted();
  const response = await fetcher(url.href, { signal, redirect: 'error', credentials: 'omit' });
  const bytes = await readBoundedResponse(response, limit, exact); signal?.throwIfAborted(); return bytes;
}

export async function loadInventory(root: URL, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<LabInventory> {
  const bytes = await fetchBytes(assetUrl('inventory.json', root), MAX_MANIFEST_BYTES, fetcher, signal);
  requireValue(await sha256(bytes) === PINNED_INVENTORY_SHA256, 'Inventory digest/hash mismatch; HEAD must explicitly rebind a new freeze');
  const raw = record(parseBoundedJson(bytes));
  requireValue(raw.schema === 'rd02-fixture-inventory-v1' && raw.productIntegrated === false, 'Invalid lab inventory');
  array(raw.fixtures); array(raw.scenarios);
  const fixtures = raw.fixtures.map((value): FixtureEntry => {
    const entry = record(value); id(entry.id); digest(entry.fixtureDigest); digest(entry.manifestSha256);
    relativePath(entry.manifestPath); integer(entry.manifestBytes, 1); integer(entry.payloadBytes);
    requireValue(entry.manifestBytes <= MAX_MANIFEST_BYTES && entry.payloadBytes <= MAX_PAYLOAD_BYTES, 'Inventory import limit');
    return Object.freeze({ id: entry.id as string, fixtureDigest: entry.fixtureDigest as string,
      manifestSha256: entry.manifestSha256 as string, manifestPath: entry.manifestPath as string,
      manifestBytes: entry.manifestBytes as number, payloadBytes: entry.payloadBytes as number });
  });
  const scenarios = raw.scenarios.map((value): ScenarioEntry => {
    const entry = record(value); id(entry.id); digest(entry.initialFixtureDigest); relativePath(entry.path);
    digest(entry.sha256); digest(entry.scenarioDigest); requireValue(entry.mode === 'presentation-replay', 'Not a replay'); array(entry.snapshots);
    const snapshots = entry.snapshots.map((snapshot) => { const item = record(snapshot); digest(item.fixtureDigest);
      return Object.freeze({ fixtureDigest: item.fixtureDigest as string }); });
    return Object.freeze({ id: entry.id as string, initialFixtureDigest: entry.initialFixtureDigest as string,
      path: entry.path as string, sha256: entry.sha256 as string, scenarioDigest: entry.scenarioDigest as string, snapshots });
  });
  return Object.freeze({ fixtures: Object.freeze(fixtures), scenarios: Object.freeze(scenarios) });
}

export async function loadFixture(entry: FixtureEntry, root: URL, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<LabFixtureV1> {
  const url = assetUrl(entry.manifestPath, root);
  const bytes = await fetchBytes(url, MAX_MANIFEST_BYTES, fetcher, signal, entry.manifestBytes);
  requireValue(await sha256(bytes) === entry.manifestSha256, 'Manifest SHA-256 mismatch');
  const raw = record(parseBoundedJson(bytes)); array(raw.payloads);
  // Validate transport descriptors and total BEFORE fetching any binary. Full contracts validate after transport.
  let total = 0;
  const descriptors = raw.payloads.map((value) => {
    keys(value, ['id', 'path', 'elementType', 'byteOrder', 'length', 'byteLength', 'sha256']);
    const item = record(value); id(item.id); relativePath(item.path); digest(item.sha256); integer(item.byteLength); integer(item.length);
    text(item.elementType); requireValue(item.byteOrder === 'little' || item.byteOrder === 'big', 'Invalid byte order');
    const widths: Record<string, number> = { uint8: 1, uint16: 2, uint32: 4, int32: 4, float32: 4, float64: 8 };
    requireValue(Object.hasOwn(widths, item.elementType) && item.byteLength === Number(item.length) * widths[item.elementType as string], 'Invalid typed length');
    total += item.byteLength as number; requireValue(Number.isSafeInteger(total) && total <= MAX_PAYLOAD_BYTES, 'Scene payload exceeds 128 MiB');
    return { id: item.id as string, path: item.path as string, byteLength: item.byteLength as number };
  });
  requireValue(total === entry.payloadBytes, 'Inventory payload length mismatch');
  const payloads = new Map<string, Uint8Array>();
  for (const descriptor of descriptors) {
    requireValue(!payloads.has(descriptor.id), 'Duplicate payload');
    payloads.set(descriptor.id, await fetchBytes(assetUrl(descriptor.path, url), descriptor.byteLength, fetcher, signal, descriptor.byteLength));
  }
  const fixture = await importFixture(bytes, payloads); signal?.throwIfAborted();
  requireValue(fixture.id === entry.id && getFixtureDigest(fixture) === entry.fixtureDigest, 'Imported fixture inventory mismatch');
  return fixture;
}

export async function loadReplay(inventory: LabInventory, scenarioId: string, root: URL, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const entry = inventory.scenarios.find((scenario) => scenario.id === scenarioId); requireValue(entry, 'Unknown scenario ID');
  const fixtures = new Map<string, LabFixtureV1>();
  for (const hash of new Set([entry.initialFixtureDigest, ...entry.snapshots.map((snapshot) => snapshot.fixtureDigest)])) {
    const source = inventory.fixtures.find((fixture) => fixture.fixtureDigest === hash); requireValue(source, 'Missing snapshot inventory entry');
    fixtures.set(hash, await loadFixture(source, root, fetcher, signal));
  }
  const bytes = await fetchBytes(assetUrl(entry.path, root), MAX_MANIFEST_BYTES, fetcher, signal);
  requireValue(await sha256(bytes) === entry.sha256, 'Scenario byte SHA-256 mismatch');
  const scenario = importScenario(bytes, fixtures);
  requireValue(scenario.id === entry.id && await getScenarioDigest(scenario) === entry.scenarioDigest, 'Scenario digest mismatch');
  return { initialFixture: fixtures.get(entry.initialFixtureDigest)!, fixtures, scenario, scenarioDigest: entry.scenarioDigest };
}
