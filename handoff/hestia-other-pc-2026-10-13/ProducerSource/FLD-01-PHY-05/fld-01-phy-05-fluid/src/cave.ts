import { fields, identity, immutable, integer } from './common.js';

const MAX_CHAMBERS = 8;
type Address = { x: number; z: number; yMin: number; yMax: number };
type Chamber = { id: string; address: Address; volumeML: number; connections: string[] };

function address(value: unknown): Address {
  fields(value, ['x', 'z', 'yMin', 'yMax']);
  const result = {
    x: integer(value.x, 'x'), z: integer(value.z, 'z'),
    yMin: integer(value.yMin, 'y-min'), yMax: integer(value.yMax, 'y-max')
  };
  if (result.yMin >= result.yMax) throw Error('INVALID_CHAMBER_INTERVAL');
  return result;
}

export function inspectCave(value: unknown) {
  fields(value, ['chambers', 'solidRoofs']);
  if (!Array.isArray(value.chambers) || value.chambers.length === 0) throw Error('INVALID_CHAMBERS');
  if (value.chambers.length > MAX_CHAMBERS) throw Error('CHAMBER_BUDGET');
  if (!Array.isArray(value.solidRoofs)) throw Error('INVALID_SOLID_ROOFS');
  if (value.solidRoofs.length > MAX_CHAMBERS) throw Error('ROOF_BUDGET');

  const chambers: Chamber[] = value.chambers.map(raw => {
    fields(raw, ['id', 'address', 'volumeML', 'connections']);
    if (!Array.isArray(raw.connections) || raw.connections.length > MAX_CHAMBERS) throw Error('CONNECTIVITY_BUDGET');
    return { id: identity(raw.id), address: address(raw.address), volumeML: integer(raw.volumeML, 'chamber-volume'),
      connections: raw.connections.map(identity) };
  });
  const roofs = value.solidRoofs.map(address);
  const ids = new Set(chambers.map(chamber => chamber.id));
  if (ids.size !== chambers.length) throw Error('DUPLICATE_CHAMBER_ID');
  for (const chamber of chambers) for (const target of chamber.connections) {
    if (!ids.has(target) || target === chamber.id) throw Error('UNKNOWN_CONNECTION');
  }

  for (let i = 0; i < chambers.length; i++) for (let j = i + 1; j < chambers.length; j++) {
    const a = chambers[i]!, b = chambers[j]!;
    if (a.address.x !== b.address.x || a.address.z !== b.address.z || a.connections.length || b.connections.length) continue;
    const [lower, upper] = a.address.yMin < b.address.yMin ? [a, b] : [b, a];
    if (lower.address.yMax >= upper.address.yMin) continue;
    if (roofs.some(roof => roof.x === lower.address.x && roof.z === lower.address.z &&
      roof.yMin === lower.address.yMax && roof.yMax === upper.address.yMin)) {
      return immutable({ status: 'UNSUPPORTED' as const,
        reason: 'HEIGHTFIELD_CANNOT_PRESERVE_STACKED_SEALED_CHAMBERS' as const,
        chamberCount: chambers.length, allocatedCells: 0 });
    }
  }
  return immutable({ status: 'UNSUPPORTED' as const, reason: 'CAVE_DOMAIN_OUTSIDE_THIS_SPIKE' as const,
    chamberCount: chambers.length, allocatedCells: 0 });
}

export function caveCounterexample() {
  return immutable({
    status: 'UNSUPPORTED' as const,
    reason: 'HEIGHTFIELD_CANNOT_PRESERVE_STACKED_SEALED_CHAMBERS' as const,
    chamberVolumesA: [1000, 0], chamberVolumesB: [0, 1000],
    columnTotalsA: [1000], columnTotalsB: [1000], exactTotalA: 1000, exactTotalB: 1000,
    topology: {
      chambers: [
        { id: 'lower', address: { x: 0, z: 0, yMin: 0, yMax: 1 }, connections: [] },
        { id: 'upper', address: { x: 0, z: 0, yMin: 2, yMax: 3 }, connections: [] }
      ],
      solidRoofs: [{ x: 0, z: 0, yMin: 1, yMax: 2 }]
    },
    allocatedCells: 0
  });
}
