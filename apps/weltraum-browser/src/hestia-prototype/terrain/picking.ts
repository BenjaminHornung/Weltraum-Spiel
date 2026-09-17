export type HvpCell = readonly [number, number, number];
export interface HvpCellReader {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly cellMeters: number;
  readonly originMeters: Readonly<{ x: number; y: number; z: number }>;
  readSlot(x: number, y: number, z: number): number | undefined;
}
export type HvpCellHit = { readonly kind: "Hit"; readonly cell: HvpCell; readonly slot: number; readonly distance: number; readonly normal: HvpCell }
  | { readonly kind: "Unknown" | "Miss"; readonly distance: number };

/** Direction-owned half-open cells, including exact negative boundaries. No mesh input. */
export const pickHvpCell = (source: HvpCellReader, origin: HvpCell, direction: HvpCell, range = 4): HvpCellHit => {
  if (source.cellMeters !== 0.125 || ![...origin, ...direction, range].every(Number.isFinite)
    || range <= 0 || range > 4 || Math.abs(Math.hypot(...direction) - 1) > 1e-6) {
    throw new RangeError("Invalid canonical tool ray");
  }
  const lower = [source.originMeters.x, source.originMeters.y, source.originMeters.z];
  const sizes = [source.sizeX, source.sizeY, source.sizeZ];
  const q = origin.map((v, a) => (v - lower[a]!) / source.cellMeters);
  const cell = q.map((v, a) => Math.floor(v) - (direction[a]! < 0 && Number.isInteger(v) ? 1 : 0));
  const step = direction.map(Math.sign);
  const delta = direction.map(v => v === 0 ? Infinity : source.cellMeters / Math.abs(v));
  const next = direction.map((v, a) => v === 0 ? Infinity
    : (lower[a]! + (cell[a]! + (step[a]! > 0 ? 1 : 0)) * source.cellMeters - origin[a]!) / v);
  let distance = 0;
  let normal: HvpCell = [0, 0, 0];
  for (let visited = 0; visited < 100 && distance <= range; visited += 1) {
    if (cell.some((v, a) => v < 0 || v >= sizes[a]!)) { return { kind: "Unknown", distance }; }
    const slot = source.readSlot(cell[0]!, cell[1]!, cell[2]!);
    if (slot === undefined) { return { kind: "Unknown", distance }; }
    if (slot !== 0) {
      return Object.freeze({ kind: "Hit", cell: Object.freeze([...cell]) as HvpCell, slot, distance, normal });
    }
    distance = Math.min(...next);
    const axis = next.indexOf(distance); // Corner ties have one deterministic reported normal.
    normal = Object.freeze([0, 0, 0].map((_, a) => a === axis ? -step[a]! : 0)) as HvpCell;
    for (let a = 0; a < 3; a += 1) {
      if (next[a] === distance) { cell[a]! += step[a]!; next[a]! += delta[a]!; }
    }
  }
  return { kind: "Miss", distance: range };
};
