import { createSimulationTick, UNIVERSE_TICKS_PER_SECOND } from '../snapshot/time.mjs';
import { threefry2x32, tickCounter, q16Smoothstep, encodeNumbers, normalizeIdentity } from './numerics.mjs';

export async function sha256(bytes) {
  return 'sha256:' + hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

export const hex = bytes => [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');

export function assertCurrent(result, request, profile) {
  if (request.profileDigest !== profile.contentDigest || result.profileDigest !== profile.contentDigest ||
      request.version !== profile.version || request.modelDigest !== profile.implementationDigest) throw new Error('STALE_PROFILE');
  for (const field of ['requestId', 'bodyId', 'tick', 'profileDigest', 'climateDigest', 'geographyDigest', 'epoch', 'revision']) {
    if (result[field] !== request[field]) throw new Error('STALE_' + field);
  }
  if (JSON.stringify(result.seed) !== JSON.stringify(request.seed)) throw new Error('STALE_SEED');
  if (result.modelDigest !== profile.implementationDigest || result.version !== profile.version) throw new Error('STALE_MODEL');
  return result;
}

// This scalar envelope is a numerics consumer fixture, not a meteorological model.
export async function sampleQuery(request, profile) {
  if (request.version !== profile.version || request.modelDigest !== profile.implementationDigest ||
      request.profileDigest !== profile.contentDigest) throw new Error('STALE_PROFILE');
  request = { ...request, seed: Object.freeze([...request.seed]) };
  const bodyId = normalizeIdentity(request.bodyId);
  const tick = createSimulationTick(request.tick);
  const period = BigInt(60 * UNIVERSE_TICKS_PER_SECOND);
  const epoch = BigInt(tick) / period;
  const phase = Number((BigInt(tick) % period) * 65536n / period);
  const random = threefry2x32(tickCounter(Number(epoch)), request.seed);
  const envelope = q16Smoothstep(phase);
  const numbers = encodeNumbers({ u32: random[0], tick, f64: envelope / 65536 });
  const strings = [bodyId, request.profileDigest, request.climateDigest, request.geographyDigest,
    request.modelDigest, normalizeIdentity(request.epoch), normalizeIdentity(request.revision)];
  const encoded = strings.map(s => new TextEncoder().encode(normalizeIdentity(s)));
  const bytes = new Uint8Array(numbers.length + encoded.reduce((sum, b) => sum + 4 + b.length, 0) + 12);
  bytes.set(numbers);
  const view = new DataView(bytes.buffer);
  view.setUint32(24, random[1], true);
  view.setUint32(28, request.seed[0], true);
  view.setUint32(32, request.seed[1], true);
  let offset = 36;
  for (const data of encoded) {
    view.setUint32(offset, data.length, true);
    bytes.set(data, offset + 4);
    offset += 4 + data.length;
  }
  return Object.freeze({ ...request, bodyId: request.bodyId, canonicalBodyId: bodyId, envelope,
    random, version: profile.version, modelDigest: profile.implementationDigest,
    canonicalHex: hex(bytes), snapshotDigest: await sha256(bytes) });
}
