import {rotate,vec} from "./geometry.js";
export type Cell = readonly [number, number, number];

export type Fixture = Readonly<{
  id: string;
  cellSize: number;
  origin: Cell;
  /** Extent in voxel counts; inside is known (unlisted cells are air), outside is Unknown. */
  bounds: Cell;
  cells: readonly Cell[];
  /** kg/m³ from the pinned dry-limestone prototype tuning; not approved physical authority. */
  density: number;
  rotation: Readonly<{ x: number; y: number; z: number; w: number }>;
}>;

export type Axis = "x" | "y" | "z";

type Geometry = Omit<Fixture, "cellSize">;

const CELL_SIZES = [0.125, 0.25] as const;
// Matches the pinned HVP dry-limestone prototype value, whose material registry marks it unapproved.
const DENSITY = 2_400;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 } as const;
const ROTATED_Y_90 = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } as const;
const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

function rectangularCells(bounds: Cell, isHole: (x: number, y: number, z: number) => boolean = () => false): Cell[] {
  const cells: Cell[] = [];
  for (let x = 0; x < bounds[0]; x += 1) {
    for (let y = 0; y < bounds[1]; y += 1) {
      for (let z = 0; z < bounds[2]; z += 1) {
        if (!isHole(x, y, z)) cells.push([x, y, z]);
      }
    }
  }
  return cells;
}

const bridgeBlock = rectangularCells([2, 2, 2]);

const GEOMETRIES: readonly Geometry[] = [
  {
    id: "box",
    origin: [0, 0, 0],
    bounds: [4, 4, 4],
    cells: rectangularCells([4, 4, 4]),
    density: DENSITY,
    rotation: IDENTITY,
  },
  {
    id: "perforated-wall",
    origin: [0, 0, 0],
    bounds: [5, 5, 1],
    cells: rectangularCells([5, 5, 1], (x, y) => (x === 1 || x === 3) && y === 2),
    density: DENSITY,
    rotation: IDENTITY,
  },
  {
    id: "cave-overhang",
    origin: [0, 0, 0],
    bounds: [5, 4, 4],
    cells: rectangularCells([5, 4, 4], (x, y, z) => x < 4 && y >= 1 && y <= 2 && z >= 1 && z <= 2),
    density: DENSITY,
    rotation: IDENTITY,
  },
  {
    id: "fine-stair",
    origin: [0, 0, 0],
    bounds: [6, 4, 2],
    cells: [1, 2, 3, 4, 3, 2].flatMap((height, x) => {
      const cells: Cell[] = [];
      for (let y = 0; y < height; y += 1) {
        cells.push([x, y, 0], [x, y, 1]);
      }
      return cells;
    }),
    density: DENSITY,
    rotation: IDENTITY,
  },
  {
    id: "one-voxel-bridge",
    origin: [0, 0, 0],
    bounds: [5, 2, 2],
    cells: [
      ...bridgeBlock,
      ...bridgeBlock.map(([x, y, z]): Cell => [x + 3, y, z]),
      [2, 0, 0],
    ],
    density: DENSITY,
    rotation: IDENTITY,
  },
  {
    id: "rotated-body",
    origin: [-1, 0, 2],
    bounds: [3, 2, 1],
    cells: rectangularCells([3, 2, 1]),
    density: DENSITY,
    rotation: ROTATED_Y_90,
  },
];

function copyCell(cell: Cell): Cell {
  return [cell[0], cell[1], cell[2]];
}

function withAxis(cell: Cell, axis: 0 | 1 | 2, value: number): Cell {
  const result: [number, number, number] = [cell[0], cell[1], cell[2]];
  result[axis] = value;
  return result;
}

function makeFixture(geometry: Geometry, cellSize: number): Fixture {
  return {
    ...geometry,
    cellSize,
    origin: copyCell(geometry.origin),
    bounds: copyCell(geometry.bounds),
    cells: geometry.cells.map(copyCell),
    rotation: { ...geometry.rotation },
  };
}

export function fixtures(): Fixture[] {
  return CELL_SIZES.flatMap((cellSize) => GEOMETRIES.map((geometry) => makeFixture(geometry, cellSize)));
}

export function fixture(id: string, cellSize: number): Fixture {
  const geometry = GEOMETRIES.find((candidate) => candidate.id === id);
  if (!geometry) throw new RangeError(`Unknown fixture: ${id}`);
  if (!CELL_SIZES.some((profile) => profile === cellSize)) throw new RangeError(`Unsupported cell size: ${cellSize}`);
  return makeFixture(geometry, cellSize);
}

export function splitFixture(source: Fixture, axis: Axis): [Fixture, Fixture] {
  if (!Object.hasOwn(AXIS_INDEX, axis)) throw new RangeError(`Unsupported split axis: ${axis}`);
  const axisIndex = AXIS_INDEX[axis];
  if (!Number.isInteger(source.bounds[axisIndex]) || source.bounds[axisIndex] < 2) {
    throw new RangeError(`Fixture bounds cannot be split on ${axis}`);
  }
  const splitAt = Math.floor(source.bounds[axisIndex] / 2);

  const leftCells: Cell[] = [];
  const rightCells: Cell[] = [];
  for (const cell of source.cells) {
    if (cell[axisIndex] < splitAt) leftCells.push(copyCell(cell));
    else rightCells.push(withAxis(cell, axisIndex, cell[axisIndex] - splitAt));
  }

  const leftBounds = withAxis(source.bounds, axisIndex, splitAt);
  const rightBounds = withAxis(source.bounds, axisIndex, source.bounds[axisIndex] - splitAt);
  const offset=rotate(source.rotation,vec(withAxis([0,0,0],axisIndex,splitAt*source.cellSize)));
  const rightOrigin:Cell=[source.origin[0]+offset.x,source.origin[1]+offset.y,source.origin[2]+offset.z];
  return [
    { ...source, id: `${source.id}-${axis}-0`, bounds: leftBounds, cells: leftCells },
    { ...source, id: `${source.id}-${axis}-1`, origin: rightOrigin, bounds: rightBounds, cells: rightCells },
  ];
}
