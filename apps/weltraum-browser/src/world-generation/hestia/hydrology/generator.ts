import { fnv1aHash } from "../../../core/hash";
import {
  riverSegmentId,
  waterBodyId,
  type D8Direction,
  type HydrologyCell,
  type HydrologyCellCoordinate,
  type HydrologyInput,
  type HydrologyParameters,
  type HydrologySample,
  type HydrologySnapshot,
  type RiverSegment,
  type RiverSegmentPoint,
  type RiverTermination,
  type WaterBody,
  type WaterBodyId
} from "./contracts";
import {
  freezeHydrologyValue,
  estimateHydrologySnapshotRetainedBytes,
  hashCanonicalHydrologyBytes,
  serializeCanonicalHydrologySnapshot
} from "./canonical";
import {
  HESTIA_HYDROLOGY_D8_DIAGONAL_DISTANCE_MULTIPLIER,
  HESTIA_HYDROLOGY_GENERATOR_VERSION_V2,
  HESTIA_HYDROLOGY_GRID_V2,
  HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2
} from "./preset";
import { assertHydrologyInput, finiteDerived } from "./validation";

const SAMPLE_WIDTH = HESTIA_HYDROLOGY_GRID_V2.samplesX;
const SAMPLE_COUNT = HESTIA_HYDROLOGY_GRID_V2.samplesX * HESTIA_HYDROLOGY_GRID_V2.samplesZ;
const CELL_WIDTH = HESTIA_HYDROLOGY_GRID_V2.cellsX;
const CELL_COUNT = HESTIA_HYDROLOGY_GRID_V2.cellsX * HESTIA_HYDROLOGY_GRID_V2.cellsZ;
const QUANTA_PER_SAMPLE = HESTIA_HYDROLOGY_GRID_V2.originAlignmentQuanta;
const QUANTUM_METERS = HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters;
const CARDINAL_DISTANCE_MULTIPLIER = 1;
const UNASSIGNED_INDEX = -1;

interface DirectionDefinition {
  readonly direction: D8Direction;
  readonly dx: number;
  readonly dz: number;
  readonly distanceMultiplier: number;
}

const DIRECTIONS: readonly DirectionDefinition[] = Object.freeze([
  { direction: "N", dx: 0, dz: -1, distanceMultiplier: CARDINAL_DISTANCE_MULTIPLIER },
  { direction: "NE", dx: 1, dz: -1, distanceMultiplier: HESTIA_HYDROLOGY_D8_DIAGONAL_DISTANCE_MULTIPLIER },
  { direction: "E", dx: 1, dz: 0, distanceMultiplier: CARDINAL_DISTANCE_MULTIPLIER },
  { direction: "SE", dx: 1, dz: 1, distanceMultiplier: HESTIA_HYDROLOGY_D8_DIAGONAL_DISTANCE_MULTIPLIER },
  { direction: "S", dx: 0, dz: 1, distanceMultiplier: CARDINAL_DISTANCE_MULTIPLIER },
  { direction: "SW", dx: -1, dz: 1, distanceMultiplier: HESTIA_HYDROLOGY_D8_DIAGONAL_DISTANCE_MULTIPLIER },
  { direction: "W", dx: -1, dz: 0, distanceMultiplier: CARDINAL_DISTANCE_MULTIPLIER },
  { direction: "NW", dx: -1, dz: -1, distanceMultiplier: HESTIA_HYDROLOGY_D8_DIAGONAL_DISTANCE_MULTIPLIER }
]);

const sampleIndex = (x: number, z: number): number => z * SAMPLE_WIDTH + x;
const cellIndex = (x: number, z: number): number => z * CELL_WIDTH + x;
const sampleX = (index: number): number => index % SAMPLE_WIDTH;
const sampleZ = (index: number): number => Math.floor(index / SAMPLE_WIDTH);
const cellX = (index: number): number => index % CELL_WIDTH;
const cellZ = (index: number): number => Math.floor(index / CELL_WIDTH);
const isSampleBoundary = (x: number, z: number): boolean => x === 0 || z === 0 || x === SAMPLE_WIDTH - 1 || z === SAMPLE_WIDTH - 1;
const isCellBoundary = (x: number, z: number): boolean => x === 0 || z === 0 || x === CELL_WIDTH - 1 || z === CELL_WIDTH - 1;
const inSampleGrid = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < SAMPLE_WIDTH && z < SAMPLE_WIDTH;
const inCellGrid = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < CELL_WIDTH && z < CELL_WIDTH;

const coordinateFor = (input: HydrologyInput, x: number, z: number): HydrologyCellCoordinate => {
  const xQuanta = input.origin.xQuanta + x * QUANTA_PER_SAMPLE;
  const zQuanta = input.origin.zQuanta + z * QUANTA_PER_SAMPLE;
  if (!Number.isSafeInteger(xQuanta) || !Number.isSafeInteger(zQuanta)) throw new RangeError("derived global coordinate is unsafe");
  const xMeters = xQuanta * QUANTUM_METERS;
  const zMeters = zQuanta * QUANTUM_METERS;
  if (!Number.isFinite(xMeters) || !Number.isFinite(zMeters)) throw new RangeError("derived global metre coordinate is non-finite");
  return { xQuanta, zQuanta, xMeters, zMeters };
};

const compareCoordinates = (left: HydrologyCellCoordinate, right: HydrologyCellCoordinate): number =>
  left.zQuanta - right.zQuanta || left.xQuanta - right.xQuanta;

class PriorityQueue {
  readonly #heap: number[] = [];

  public constructor(private readonly filled: Float64Array, private readonly input: HydrologyInput) {}

  #less(left: number, right: number): boolean {
    const elevation = this.filled[left]! - this.filled[right]!;
    if (elevation !== 0) return elevation < 0;
    const leftCoordinate = coordinateFor(this.input, sampleX(left), sampleZ(left));
    const rightCoordinate = coordinateFor(this.input, sampleX(right), sampleZ(right));
    return leftCoordinate.zQuanta < rightCoordinate.zQuanta
      || (leftCoordinate.zQuanta === rightCoordinate.zQuanta && (
        leftCoordinate.xQuanta < rightCoordinate.xQuanta
        || (leftCoordinate.xQuanta === rightCoordinate.xQuanta && left < right)
      ));
  }

  public push(value: number): void {
    let index = this.#heap.length;
    this.#heap.push(value);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.#less(value, this.#heap[parent]!)) break;
      this.#heap[index] = this.#heap[parent]!;
      index = parent;
    }
    this.#heap[index] = value;
  }

  public pop(): number | undefined {
    const first = this.#heap[0];
    const last = this.#heap.pop();
    if (first === undefined || last === undefined || this.#heap.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.#heap.length) break;
      const right = left + 1;
      const child = right < this.#heap.length && this.#less(this.#heap[right]!, this.#heap[left]!) ? right : left;
      if (!this.#less(this.#heap[child]!, last)) break;
      this.#heap[index] = this.#heap[child]!;
      index = child;
    }
    this.#heap[index] = last;
    return first;
  }
}

class OrderedIndexQueue {
  readonly #heap: number[] = [];

  public constructor(private readonly compare: (left: number, right: number) => number) {}

  public push(value: number): void {
    let index = this.#heap.length;
    this.#heap.push(value);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(value, this.#heap[parent]!) >= 0) break;
      this.#heap[index] = this.#heap[parent]!;
      index = parent;
    }
    this.#heap[index] = value;
  }

  public pop(): number | undefined {
    const first = this.#heap[0];
    const last = this.#heap.pop();
    if (first === undefined || last === undefined || this.#heap.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.#heap.length) break;
      const right = left + 1;
      const child = right < this.#heap.length && this.compare(this.#heap[right]!, this.#heap[left]!) < 0 ? right : left;
      if (this.compare(this.#heap[child]!, last) >= 0) break;
      this.#heap[index] = this.#heap[child]!;
      index = child;
    }
    this.#heap[index] = last;
    return first;
  }
}

const sampleTerrain = (input: HydrologyInput): Float64Array => {
  const terrain = new Float64Array(SAMPLE_COUNT);
  for (let z = 0; z < SAMPLE_WIDTH; z += 1) {
    for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
      const coordinate = coordinateFor(input, x, z);
      const height = input.terrainHeightSampler(coordinate.xMeters, coordinate.zMeters);
      if (!Number.isFinite(height)) throw new RangeError(`terrainHeightSampler returned a non-finite value at ${coordinate.xQuanta},${coordinate.zQuanta}`);
      terrain[sampleIndex(x, z)] = height;
    }
  }
  return terrain;
};

const classifyOcean = (terrain: Float64Array, seaLevel: number): Uint8Array => {
  const ocean = new Uint8Array(SAMPLE_COUNT);
  const queue = new Int32Array(SAMPLE_COUNT);
  let read = 0;
  let write = 0;
  for (let z = 0; z < SAMPLE_WIDTH; z += 1) {
    for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
      const index = sampleIndex(x, z);
      if (isSampleBoundary(x, z) && terrain[index]! <= seaLevel && ocean[index] === 0) {
        ocean[index] = 1;
        queue[write] = index;
        write += 1;
      }
    }
  }
  while (read < write) {
    const current = queue[read]!;
    read += 1;
    const x = sampleX(current);
    const z = sampleZ(current);
    for (const direction of DIRECTIONS) {
      const nx = x + direction.dx;
      const nz = z + direction.dz;
      if (!inSampleGrid(nx, nz)) continue;
      const next = sampleIndex(nx, nz);
      if (ocean[next] === 0 && terrain[next]! <= seaLevel) {
        ocean[next] = 1;
        queue[write] = next;
        write += 1;
      }
    }
  }
  return ocean;
};

const priorityFlood = (input: HydrologyInput, terrain: Float64Array): {
  filled: Float64Array;
  spill: Float64Array;
  depression: Float64Array;
  floodParent: Int32Array;
} => {
  const filled = new Float64Array(SAMPLE_COUNT);
  const spill = new Float64Array(SAMPLE_COUNT);
  const depression = new Float64Array(SAMPLE_COUNT);
  const floodParent = new Int32Array(SAMPLE_COUNT);
  const visited = new Uint8Array(SAMPLE_COUNT);
  floodParent.fill(UNASSIGNED_INDEX);
  const queue = new PriorityQueue(filled, input);
  for (let z = 0; z < SAMPLE_WIDTH; z += 1) {
    for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
      if (!isSampleBoundary(x, z)) continue;
      const index = sampleIndex(x, z);
      visited[index] = 1;
      filled[index] = terrain[index]!;
      spill[index] = terrain[index]!;
      queue.push(index);
    }
  }
  for (let current = queue.pop(); current !== undefined; current = queue.pop()) {
    const x = sampleX(current);
    const z = sampleZ(current);
    for (const direction of DIRECTIONS) {
      const nx = x + direction.dx;
      const nz = z + direction.dz;
      if (!inSampleGrid(nx, nz)) continue;
      const next = sampleIndex(nx, nz);
      if (visited[next] !== 0) continue;
      visited[next] = 1;
      floodParent[next] = current;
      filled[next] = Math.max(terrain[next]!, filled[current]!);
      spill[next] = filled[next]!;
      depression[next] = filled[next]! - terrain[next]!;
      finiteDerived(filled[next]!, "filledElevation");
      finiteDerived(depression[next]!, "depressionDepth");
      queue.push(next);
    }
  }
  return { filled, spill, depression, floodParent };
};

const solveDrainage = (
  filled: Float64Array,
  floodParent: Int32Array,
  epsilon: number
): { downstream: Int32Array; directionIndex: Int8Array; accumulation: Float64Array } => {
  const downstream = new Int32Array(CELL_COUNT);
  const directionIndex = new Int8Array(CELL_COUNT);
  downstream.fill(UNASSIGNED_INDEX);
  directionIndex.fill(UNASSIGNED_INDEX);
  for (let z = 0; z < CELL_WIDTH; z += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      const currentCell = cellIndex(x, z);
      const currentSample = sampleIndex(x, z);
      let strongestSlope = 0;
      let selectedDirection = UNASSIGNED_INDEX;
      let selectedCell = UNASSIGNED_INDEX;
      for (let directionIndexValue = 0; directionIndexValue < DIRECTIONS.length; directionIndexValue += 1) {
        const direction = DIRECTIONS[directionIndexValue]!;
        const nx = x + direction.dx;
        const nz = z + direction.dz;
        if (!inCellGrid(nx, nz)) continue;
        const nextSample = sampleIndex(nx, nz);
        const slope = (filled[currentSample]! - filled[nextSample]!)
          / (HESTIA_HYDROLOGY_GRID_V2.gridSpacingMeters * direction.distanceMultiplier);
        finiteDerived(slope, "D8 slope");
        if (slope > strongestSlope + epsilon) {
          strongestSlope = slope;
          selectedDirection = directionIndexValue;
          selectedCell = cellIndex(nx, nz);
        }
      }
      if (selectedCell === UNASSIGNED_INDEX && !isCellBoundary(x, z)) {
        const parent = floodParent[currentSample]!;
        if (parent !== UNASSIGNED_INDEX) {
          const px = sampleX(parent);
          const pz = sampleZ(parent);
          const direction = DIRECTIONS.findIndex((entry) => entry.dx === px - x && entry.dz === pz - z);
          if (direction !== UNASSIGNED_INDEX && inCellGrid(px, pz)) {
            selectedDirection = direction;
            selectedCell = cellIndex(px, pz);
          }
        }
      }
      downstream[currentCell] = selectedCell;
      directionIndex[currentCell] = selectedDirection;
    }
  }
  validateAcyclicDrainage(downstream);
  const accumulation = accumulateTopologically(filled, downstream);
  return { downstream, directionIndex, accumulation };
};

const validateAcyclicDrainage = (downstream: Int32Array): void => {
  const state = new Uint8Array(CELL_COUNT);
  for (let start = 0; start < CELL_COUNT; start += 1) {
    let current = start;
    const path: number[] = [];
    while (current !== UNASSIGNED_INDEX && state[current] === 0) {
      state[current] = 1;
      path.push(current);
      current = downstream[current]!;
    }
    if (current !== UNASSIGNED_INDEX && state[current] === 1) throw new RangeError("D8 drainage contains an internal cycle");
    for (const index of path) state[index] = 2;
  }
};

const accumulateTopologically = (filled: Float64Array, downstream: Int32Array): Float64Array => {
  const indegree = new Int32Array(CELL_COUNT);
  const accumulation = new Float64Array(CELL_COUNT);
  accumulation.fill(1);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const next = downstream[index]!;
    if (next !== UNASSIGNED_INDEX) indegree[next] += 1;
  }
  const compare = (left: number, right: number): number => {
    const elevationDifference = filled[sampleIndex(cellX(right), cellZ(right))]!
      - filled[sampleIndex(cellX(left), cellZ(left))]!;
    return elevationDifference || cellZ(left) - cellZ(right) || cellX(left) - cellX(right);
  };
  const ready = new OrderedIndexQueue(compare);
  for (let index = 0; index < CELL_COUNT; index += 1) if (indegree[index] === 0) ready.push(index);
  let processed = 0;
  for (let current = ready.pop(); current !== undefined; current = ready.pop()) {
    processed += 1;
    const next = downstream[current]!;
    if (next !== UNASSIGNED_INDEX) {
      accumulation[next] += accumulation[current]!;
      indegree[next] -= 1;
      if (indegree[next] === 0) ready.push(next);
    }
  }
  if (processed !== CELL_COUNT) throw new RangeError("D8 accumulation did not process every cell");
  return accumulation;
};

const stableWaterBodyId = (
  input: HydrologyInput,
  minimumCoordinate: HydrologyCellCoordinate,
  spillElevation: number,
  parameters: HydrologyParameters
): WaterBodyId => {
  const quantizedSpill = quantizeSpillElevation(spillElevation, parameters);
  const bytes = `${input.datasetId}|${minimumCoordinate.xQuanta}|${minimumCoordinate.zQuanta}|${quantizedSpill}|${HESTIA_HYDROLOGY_GENERATOR_VERSION_V2}`;
  return waterBodyId(`water:${fnv1aHash(bytes)}`);
};

const quantizeSpillElevation = (spillElevation: number, parameters: HydrologyParameters): number => {
  const scaled = spillElevation * parameters.spillElevationQuantizationPerMeter;
  if (!Number.isFinite(scaled) || !Number.isSafeInteger(Math.round(scaled))) {
    throw new RangeError("spill elevation quantization exceeds finite safe-integer precision");
  }
  return Math.round(scaled);
};

interface DepressionBasin {
  readonly id: string;
  readonly indices: readonly number[];
  readonly minimumCoordinate: HydrologyCellCoordinate;
  readonly spillElevation: number;
  readonly maximumDepressionDepth: number;
}

const buildDepressionBasins = (
  input: HydrologyInput,
  ocean: Uint8Array,
  depression: Float64Array,
  spill: Float64Array
): { basins: DepressionBasin[]; basinIdBySample: (string | null)[] } => {
  const visited = new Uint8Array(SAMPLE_COUNT);
  const basinIdBySample: (string | null)[] = Array.from({ length: SAMPLE_COUNT }, () => null);
  const basins: DepressionBasin[] = [];
  for (let start = 0; start < SAMPLE_COUNT; start += 1) {
    if (visited[start] !== 0 || ocean[start] !== 0
      || depression[start]! <= input.parameters.comparisonEpsilonMeters) continue;
    const queue = [start];
    const indices: number[] = [];
    visited[start] = 1;
    let spillElevation = spill[start]!;
    let maximumDepressionDepth = depression[start]!;
    for (let read = 0; read < queue.length; read += 1) {
      const current = queue[read]!;
      indices.push(current);
      spillElevation = Math.max(spillElevation, spill[current]!);
      maximumDepressionDepth = Math.max(maximumDepressionDepth, depression[current]!);
      const x = sampleX(current);
      const z = sampleZ(current);
      for (const direction of DIRECTIONS) {
        const nx = x + direction.dx;
        const nz = z + direction.dz;
        if (!inSampleGrid(nx, nz)) continue;
        const next = sampleIndex(nx, nz);
        if (visited[next] === 0 && ocean[next] === 0
          && depression[next]! > input.parameters.comparisonEpsilonMeters) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    indices.sort((left, right) => left - right);
    finiteDerived(spillElevation, "basin spillElevation");
    const minimumCoordinate = coordinateFor(input, sampleX(indices[0]!), sampleZ(indices[0]!));
    const quantizedSpill = quantizeSpillElevation(spillElevation, input.parameters);
    const id = `basin:${minimumCoordinate.xQuanta}:${minimumCoordinate.zQuanta}:${quantizedSpill}`;
    for (const index of indices) basinIdBySample[index] = id;
    basins.push({ id, indices, minimumCoordinate, spillElevation, maximumDepressionDepth });
  }
  basins.sort((left, right) => compareCoordinates(left.minimumCoordinate, right.minimumCoordinate) || left.id.localeCompare(right.id));
  return { basins, basinIdBySample };
};

const buildWaterBodies = (
  input: HydrologyInput,
  terrain: Float64Array,
  ocean: Uint8Array,
  basins: readonly DepressionBasin[]
): { waterBodies: WaterBody[]; waterBodyBySample: (WaterBodyId | null)[]; waterLevelBySample: Float64Array } => {
  const waterBodyBySample: (WaterBodyId | null)[] = Array.from({ length: SAMPLE_COUNT }, () => null);
  const waterLevelBySample = new Float64Array(SAMPLE_COUNT);
  const visited = new Uint8Array(SAMPLE_COUNT);
  const waterBodies: WaterBody[] = [];
  const collectComponent = (start: number, eligible: (index: number) => boolean): number[] => {
    const queue = [start];
    const result: number[] = [];
    visited[start] = 1;
    for (let read = 0; read < queue.length; read += 1) {
      const current = queue[read]!;
      result.push(current);
      const x = sampleX(current);
      const z = sampleZ(current);
      for (const direction of DIRECTIONS) {
        const nx = x + direction.dx;
        const nz = z + direction.dz;
        if (!inSampleGrid(nx, nz)) continue;
        const next = sampleIndex(nx, nz);
        if (visited[next] === 0 && eligible(next)) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    result.sort((left, right) => left - right);
    return result;
  };
  const publish = (indices: number[], kind: "Ocean" | "Lake", level: number): void => {
    const minimumIndex = indices[0]!;
    const minimumCoordinate = coordinateFor(input, sampleX(minimumIndex), sampleZ(minimumIndex));
    const id = stableWaterBodyId(input, minimumCoordinate, level, input.parameters);
    const wetIndices = indices.filter((index) => kind === "Ocean"
      || terrain[index]! < level - input.parameters.comparisonEpsilonMeters);
    if (wetIndices.length === 0) return;
    const cellIndices = wetIndices
      .filter((index) => sampleX(index) < CELL_WIDTH && sampleZ(index) < CELL_WIDTH)
      .map((index) => cellIndex(sampleX(index), sampleZ(index)));
    for (const index of wetIndices) {
      waterBodyBySample[index] = id;
      waterLevelBySample[index] = level;
    }
    waterBodies.push({ id, kind, minimumCoordinate, spillElevation: level, waterLevel: level, sampleIndices: wetIndices, cellIndices });
  };
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    if (visited[index] === 0 && ocean[index] !== 0) publish(collectComponent(index, (candidate) => ocean[candidate] !== 0), "Ocean", input.seaLevelMeters);
  }
  for (const basin of basins) {
    if (basin.maximumDepressionDepth < input.parameters.minimumLakeDepthMeters) continue;
    publish([...basin.indices], "Lake", basin.spillElevation);
  }
  waterBodies.sort((left, right) => compareCoordinates(left.minimumCoordinate, right.minimumCoordinate) || left.id.localeCompare(right.id));
  return { waterBodies, waterBodyBySample, waterLevelBySample };
};

export const riverCarveDepth = (accumulation: number, parameters: HydrologyParameters): number => {
  const raw = parameters.minimumRiverDepthMeters
    + parameters.carveDepthLog2Coefficient * Math.log2(accumulation / parameters.riverSourceAccumulationCells + 1);
  return Math.max(parameters.minimumRiverDepthMeters, Math.min(parameters.maximumRiverDepthMeters, raw));
};

export const riverHalfWidth = (accumulation: number, parameters: HydrologyParameters): number => {
  const raw = parameters.minimumRiverHalfWidthMeters
    + parameters.halfWidthSqrtCoefficient * Math.sqrt(accumulation / parameters.riverSourceAccumulationCells);
  return Math.max(parameters.minimumRiverHalfWidthMeters, Math.min(parameters.maximumRiverHalfWidthMeters, raw));
};

const buildRivers = (
  input: HydrologyInput,
  filled: Float64Array,
  downstream: Int32Array,
  accumulation: Float64Array,
  waterBodyBySample: readonly (WaterBodyId | null)[],
  waterBodies: readonly WaterBody[]
): { riverSegments: RiverSegment[]; riverIdsByCell: RiverSegment["id"][][] } => {
  const waterKindById = new Map(waterBodies.map((body) => [body.id, body.kind] as const));
  const riverCell = new Uint8Array(CELL_COUNT);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const sample = sampleIndex(cellX(index), cellZ(index));
    if (waterBodyBySample[sample] === null
      && accumulation[index]! >= input.parameters.riverSourceAccumulationCells) riverCell[index] = 1;
  }
  const upstreamRiverCount = new Uint8Array(CELL_COUNT);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const next = downstream[index]!;
    if (riverCell[index] !== 0 && next !== UNASSIGNED_INDEX && riverCell[next] !== 0) {
      upstreamRiverCount[next] += 1;
    }
  }
  const sources: number[] = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (riverCell[index] !== 0 && (upstreamRiverCount[index] === 0 || upstreamRiverCount[index]! > 1)) sources.push(index);
  }
  const riverSegments: RiverSegment[] = [];
  const riverIdsByCell: RiverSegment["id"][][] = Array.from({ length: CELL_COUNT }, () => []);
  for (const source of sources) {
    const sourceCoordinate = coordinateFor(input, cellX(source), cellZ(source));
    const id = riverSegmentId(`river:${fnv1aHash(`${input.datasetId}|${sourceCoordinate.xQuanta}|${sourceCoordinate.zQuanta}|${HESTIA_HYDROLOGY_GENERATOR_VERSION_V2}`)}`);
    const points: RiverSegmentPoint[] = [];
    const visited = new Set<number>();
    let current = source;
    let previousSurface: number | null = null;
    let termination: RiverTermination | null = null;
    let terminalWaterBodyId: WaterBodyId | null = null;
    while (termination === null) {
      if (visited.has(current)) throw new RangeError("river segment contains a cycle");
      visited.add(current);
      const sample = sampleIndex(cellX(current), cellZ(current));
      const carveDepth = riverCarveDepth(accumulation[current]!, input.parameters);
      const halfWidth = riverHalfWidth(accumulation[current]!, input.parameters);
      const candidateSurface = filled[sample]! - carveDepth * input.parameters.riverWaterSurfaceDepthFraction;
      if (previousSurface !== null
        && candidateSurface > previousSurface + input.parameters.comparisonEpsilonMeters) {
        throw new RangeError("river water surface rises downstream");
      }
      // Equality inside the named comparison epsilon has one exact canonical
      // representation while material rises fail above.
      const waterSurfaceHeight: number = previousSurface !== null && candidateSurface > previousSurface
        ? previousSurface
        : candidateSurface;
      finiteDerived(waterSurfaceHeight, "river waterSurfaceHeight");
      const point: RiverSegmentPoint = {
        cellIndex: current,
        coordinate: coordinateFor(input, cellX(current), cellZ(current)),
        accumulation: accumulation[current]!,
        carveDepth,
        halfWidth,
        waterSurfaceHeight
      };
      points.push(point);
      riverIdsByCell[current]!.push(id);
      previousSurface = waterSurfaceHeight;
      if (isCellBoundary(cellX(current), cellZ(current)) || downstream[current] === UNASSIGNED_INDEX) {
        termination = "Boundary";
      } else {
        const next = downstream[current]!;
        const nextSample = sampleIndex(cellX(next), cellZ(next));
        const bodyId = waterBodyBySample[nextSample];
        if (bodyId !== null) {
          termination = waterKindById.get(bodyId) === "Ocean" ? "Ocean" : "Lake";
          terminalWaterBodyId = bodyId;
        } else if (riverCell[next] === 0) {
          throw new RangeError("river path left the qualifying drainage network before reaching an outlet");
        } else if (upstreamRiverCount[next]! > 1) {
          if (accumulation[next]! <= accumulation[current]!) {
            throw new RangeError("river confluence does not enter a strictly larger downstream segment");
          }
          const nextDepth = riverCarveDepth(accumulation[next]!, input.parameters);
          const nextSurface = filled[nextSample]! - nextDepth * input.parameters.riverWaterSurfaceDepthFraction;
          if (nextSurface > waterSurfaceHeight + input.parameters.comparisonEpsilonMeters) {
            throw new RangeError("river water surface rises across a confluence");
          }
          termination = "Confluence";
        } else {
          current = next;
        }
      }
    }
    riverSegments.push({ id, sourceCoordinate, points, termination, terminalWaterBodyId });
  }
  riverSegments.sort((left, right) => compareCoordinates(left.sourceCoordinate, right.sourceCoordinate) || left.id.localeCompare(right.id));
  for (const ids of riverIdsByCell) ids.sort((left, right) => left.localeCompare(right));
  return { riverSegments, riverIdsByCell };
};

export const generateHestiaHydrology = (callerInput: HydrologyInput): HydrologySnapshot => {
  assertHydrologyInput(callerInput);
  const clonedParameters: HydrologyParameters = {
    version: callerInput.parameters.version,
    gridSpacingMeters: callerInput.parameters.gridSpacingMeters,
    seaLevelMeters: callerInput.parameters.seaLevelMeters,
    minimumLakeDepthMeters: callerInput.parameters.minimumLakeDepthMeters,
    riverSourceAccumulationCells: callerInput.parameters.riverSourceAccumulationCells,
    minimumRiverDepthMeters: callerInput.parameters.minimumRiverDepthMeters,
    maximumRiverDepthMeters: callerInput.parameters.maximumRiverDepthMeters,
    minimumRiverHalfWidthMeters: callerInput.parameters.minimumRiverHalfWidthMeters,
    maximumRiverHalfWidthMeters: callerInput.parameters.maximumRiverHalfWidthMeters,
    channelBankSlope: callerInput.parameters.channelBankSlope,
    moistureFalloffMeters: callerInput.parameters.moistureFalloffMeters,
    comparisonEpsilonMeters: callerInput.parameters.comparisonEpsilonMeters,
    spillElevationQuantizationPerMeter: callerInput.parameters.spillElevationQuantizationPerMeter,
    carveDepthLog2Coefficient: callerInput.parameters.carveDepthLog2Coefficient,
    halfWidthSqrtCoefficient: callerInput.parameters.halfWidthSqrtCoefficient,
    riverWaterSurfaceDepthFraction: callerInput.parameters.riverWaterSurfaceDepthFraction,
    d8DirectionOrder: [...callerInput.parameters.d8DirectionOrder],
    priorityFloodKeyOrder: ["filledElevation", "globalZ", "globalX", "stableLinearIndex"],
    accumulationContributionPerCell: callerInput.parameters.accumulationContributionPerCell,
    moistureFormulaVersion: callerInput.parameters.moistureFormulaVersion,
    channelFormulaVersion: callerInput.parameters.channelFormulaVersion,
    flatRoutingPolicyVersion: callerInput.parameters.flatRoutingPolicyVersion,
    bankBlendFormulaVersion: callerInput.parameters.bankBlendFormulaVersion
  };
  const input: HydrologyInput = {
    rootSeed: callerInput.rootSeed,
    bodyId: callerInput.bodyId,
    surfaceFrameId: callerInput.surfaceFrameId,
    datasetId: callerInput.datasetId,
    origin: { xQuanta: callerInput.origin.xQuanta, zQuanta: callerInput.origin.zQuanta },
    seaLevelMeters: callerInput.seaLevelMeters,
    parameters: clonedParameters,
    terrainHeightSampler: callerInput.terrainHeightSampler,
    grid: HESTIA_HYDROLOGY_GRID_V2
  };
  const terrain = sampleTerrain(input);
  const ocean = classifyOcean(terrain, input.seaLevelMeters);
  const flood = priorityFlood(input, terrain);
  const drainage = solveDrainage(flood.filled, flood.floodParent, input.parameters.comparisonEpsilonMeters);
  const depressionBasins = buildDepressionBasins(input, ocean, flood.depression, flood.spill);
  const water = buildWaterBodies(input, terrain, ocean, depressionBasins.basins);
  const rivers = buildRivers(input, flood.filled, drainage.downstream, drainage.accumulation, water.waterBodyBySample, water.waterBodies);
  const samples: HydrologySample[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    samples.push({
      coordinate: coordinateFor(input, sampleX(index), sampleZ(index)),
      stableLinearIndex: index,
      terrainHeight: terrain[index]!,
      filledElevation: flood.filled[index]!,
      depressionDepth: flood.depression[index]!,
      spillElevation: flood.spill[index]!,
      basinId: depressionBasins.basinIdBySample[index]!,
      isOcean: ocean[index] !== 0,
      waterBodyId: water.waterBodyBySample[index]!,
      waterSurfaceHeight: water.waterBodyBySample[index] === null ? null : water.waterLevelBySample[index]!
    });
  }
  const cells: HydrologyCell[] = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const x = cellX(index);
    const z = cellZ(index);
    const sample = samples[sampleIndex(x, z)]!;
    const selectedDirection = drainage.directionIndex[index]!;
    cells.push(Object.assign(Object.create(sample) as HydrologyCell, {
      stableLinearIndex: index,
      flowDirection: selectedDirection === UNASSIGNED_INDEX ? null : DIRECTIONS[selectedDirection]!.direction,
      downstreamCellIndex: drainage.downstream[index] === UNASSIGNED_INDEX ? null : drainage.downstream[index]!,
      isBoundaryOutlet: drainage.downstream[index] === UNASSIGNED_INDEX,
      accumulation: drainage.accumulation[index]!,
      riverSegmentIds: rivers.riverIdsByCell[index]!
    }));
  }
  const content = freezeHydrologyValue({
    generatorVersion: HESTIA_HYDROLOGY_GENERATOR_VERSION_V2,
    rootSeed: input.rootSeed,
    bodyId: input.bodyId,
    surfaceFrameId: input.surfaceFrameId,
    datasetId: input.datasetId,
    origin: input.origin,
    grid: HESTIA_HYDROLOGY_GRID_V2,
    parameters: input.parameters,
    samples,
    cells,
    waterBodies: water.waterBodies,
    riverSegments: rivers.riverSegments
  }) as Omit<HydrologySnapshot, "canonicalBytes" | "contentHash">;
  const canonicalBytes = serializeCanonicalHydrologySnapshot(content);
  const contentHash = hashCanonicalHydrologyBytes(canonicalBytes);
  if (hashCanonicalHydrologyBytes(canonicalBytes) !== contentHash) throw new RangeError("hydrology hash validation failed");
  const snapshot = Object.freeze({ ...content, canonicalBytes, contentHash }) as HydrologySnapshot;
  const memoryEstimate = estimateHydrologySnapshotRetainedBytes(snapshot);
  if (!memoryEstimate.withinBudget || memoryEstimate.totalBytes > HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2) {
    throw new RangeError(
      `hydrology retained representation ${memoryEstimate.totalBytes} bytes `
      + `(graph ${memoryEstimate.snapshotGraphBytes}, canonical ${memoryEstimate.canonicalBytes}) `
      + `exceeds ${HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2} bytes`
    );
  }
  return snapshot;
};

export const generateHestiaHydrologyDataset = generateHestiaHydrology;
export const createHestiaHydrologySnapshot = generateHestiaHydrology;
