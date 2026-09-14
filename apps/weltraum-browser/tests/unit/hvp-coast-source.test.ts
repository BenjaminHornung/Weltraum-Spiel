import { beforeAll, describe, expect, it } from "vitest";
import {
  HVP_CHANNEL_POLYLINE_XZ,
  HVP_COAST_HILLS,
  HVP_COAST_MATERIAL_REGISTRY,
  HVP_COAST_REGISTRY_DIGEST,
  HVP_COAST_SEED_NAME,
  HVP_COAST_SOURCE_VERSION,
  HVP_SLOT_KNOWN_AIR,
  HVP_SLOT_LIMESTONE_DRY,
  HVP_SLOT_LIMESTONE_WET,
  HVP_SLOT_MOSS,
  HVP_SLOT_SOIL,
  HVP_SOURCE_CELL_METERS,
  HVP_SOURCE_LEAF_COUNT,
  HVP_SOURCE_SIZE_X,
  HVP_SOURCE_SIZE_Y,
  HVP_SOURCE_SIZE_Z,
  HVP_SOURCE_SLOT_COUNT,
  assertHvpSourceComplete,
  deriveHvpWaterMask,
  hvpChannelSignedDistanceMeters,
  hvpSourceColumnTopMeters,
  hvpSourceSlotRole,
  hvpSourceSurfaceMeters,
  materializeHvpCoastSource,
  materializeHvpCoastSourceAsync,
  prepareHvpCoastSource,
  readHvpSourceSlot,
  type HvpCoastSourceSnapshot,
  type HvpPreparedCoastSource
} from "../../src/hvp/hvpCoastSource";
import {
  HVP_COAST_MESH_ALGORITHM_VERSION,
  HVP_FARFIELD_MESH_ALGORITHM_VERSION,
  HVP_WATER_MESH_ALGORITHM_VERSION,
  meshHvpCoastSource,
  meshHvpFarField,
  meshHvpJoinRing,
  meshHvpTestCells,
  meshHvpWaterMask,
  type HvpCompactMesh
} from "../../src/hvp/hvpCoastMesher";
import type { HvpWaterMask } from "../../src/hvp/hvpCoastSource";

let snapshot: HvpCoastSourceSnapshot;
let prepared: HvpPreparedCoastSource;
let productionMesh: HvpCompactMesh;
let waterMask: HvpWaterMask;
let productionWater: HvpCompactMesh;

beforeAll(async () => {
  snapshot = await materializeHvpCoastSourceAsync();
  prepared = prepareHvpCoastSource(snapshot);
  productionMesh = meshHvpCoastSource(prepared);
  waterMask = deriveHvpWaterMask(prepared);
  productionWater = meshHvpWaterMask(waterMask);
}, 300_000);

describe("HVP coast source region contract", () => {
  it("binds the normative 256x128x256 slot region at 0.125 m", () => {
    expect(HVP_SOURCE_CELL_METERS).toBe(0.125);
    expect(HVP_SOURCE_SIZE_X).toBe(256);
    expect(HVP_SOURCE_SIZE_Y).toBe(128);
    expect(HVP_SOURCE_SIZE_Z).toBe(256);
    expect(HVP_SOURCE_SLOT_COUNT).toBe(8_388_608);
    expect(HVP_SOURCE_LEAF_COUNT).toBe(2_048);
    expect(HVP_COAST_SEED_NAME).toBe("hestia-hvp-lagoon-001");
    expect(HVP_COAST_SOURCE_VERSION).toBe("hvp-authored-coast-v3");
    expect(HVP_SLOT_KNOWN_AIR).toBe(0);
  });

  it("binds four registry slots to stable material keys and roles", () => {
    expect(HVP_COAST_MATERIAL_REGISTRY.map((entry) => entry.slot)).toEqual([1, 2, 3, 4]);
    expect(new Set(HVP_COAST_MATERIAL_REGISTRY.map((entry) => entry.key)).size).toBe(4);
    expect(HVP_COAST_MATERIAL_REGISTRY.map((entry) => entry.role)).toEqual([
      "limestone-dry",
      "limestone-wet",
      "soil",
      "moss"
    ]);
    expect(HVP_COAST_REGISTRY_DIGEST).toMatch(/^[0-9a-f]{8}$/);
  });

  it("uses the exact six-point macro channel polyline in x/z meters", () => {
    expect(HVP_CHANNEL_POLYLINE_XZ).toEqual([
      [-3, -16],
      [-4, -10],
      [3, -4],
      [2, 3],
      [-3, 9],
      [0, 16]
    ]);
  });
});

describe("HVP channel distance to segments with stable ties", () => {
  it("measures zero on the centerline and stays deterministic", () => {
    const first = hvpChannelSignedDistanceMeters(-3.5, -13);
    expect(first.distance).toBeCloseTo(0, 9);
    expect(first.segmentIndex).toBe(0);
    expect(hvpChannelSignedDistanceMeters(-3.5, -13)).toEqual(first);
  });

  it("lets the lower segment index win an exact vertex tie", () => {
    const tied = hvpChannelSignedDistanceMeters(3, -4);
    expect(tied.distance).toBeCloseTo(0, 9);
    expect(tied.segmentIndex).toBe(1);
  });

  it("reports outer banks far from the polyline", () => {
    expect(hvpChannelSignedDistanceMeters(14, -12).distance).toBeGreaterThan(3);
    expect(hvpChannelSignedDistanceMeters(-14, 12).distance).toBeGreaterThan(3);
  });

  it("rejects non-finite inputs with TypeError", () => {
    expect(() => hvpChannelSignedDistanceMeters(Number.NaN, 0)).toThrow(TypeError);
    expect(() => hvpChannelSignedDistanceMeters(0, Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => hvpSourceSurfaceMeters(Number.NaN, 0)).toThrow(TypeError);
  });
});

describe("HVP macro surface with asymmetric plateaus and hills", () => {
  it("holds the -1.5 m floor inside the channel core", () => {
    expect(hvpSourceSurfaceMeters(-3.5, -13)).toBe(-1.5);
    expect(hvpSourceSurfaceMeters(2, 3)).toBe(-1.5);
  });

  it("keeps the west plateau near 1.5 m and the east plateau near 0.75 m", () => {
    const west = hvpSourceSurfaceMeters(-14, 12);
    const east = hvpSourceSurfaceMeters(14, -12);
    expect(west).toBeGreaterThan(1.0);
    expect(west).toBeLessThan(2.0);
    expect(east).toBeGreaterThan(0.25);
    expect(east).toBeLessThan(1.25);
    expect(west).toBeGreaterThan(east);
  });

  it("raises asymmetric hills without breaking the normative maxima", () => {
    expect(hvpSourceSurfaceMeters(-10, -5)).toBeGreaterThan(3.0);
    expect(hvpSourceSurfaceMeters(9, 4)).toBeGreaterThan(2.0);
    expect(hvpSourceSurfaceMeters(-10, -5)).not.toBeCloseTo(hvpSourceSurfaceMeters(9, 4), 4);
    let maximum = Number.NEGATIVE_INFINITY;
    for (let ix = 0; ix < 64; ix += 1) {
      for (let iz = 0; iz < 64; iz += 1) {
        const value = hvpSourceSurfaceMeters(-16 + ix * 0.5, -16 + iz * 0.5);
        if (value > maximum) {
          maximum = value;
        }
      }
    }
    expect(maximum).toBeLessThanOrEqual(5.5);
  });
});

describe("HVP terraced microsteps on the 0.125 m grid", () => {
  it("quantizes every column top to whole 0.125 m steps", () => {
    for (let sample = 0; sample < 3_000; sample += 1) {
      const ix = (sample * 37) % 256;
      const iz = (sample * 91) % 256;
      const top = hvpSourceColumnTopMeters(-16 + (ix + 0.5) * 0.125, -16 + (iz + 0.5) * 0.125);
      expect(Math.abs(top / 0.125 - Math.round(top / 0.125))).toBeLessThan(1e-6);
    }
  });

  it("varies terrace steps across 0.125, 0.25 and 0.5 m with notches as the only cliffs", () => {
    const tops: number[][] = [];
    for (let iz = 0; iz < 256; iz += 1) {
      const row: number[] = [];
      for (let ix = 0; ix < 256; ix += 1) {
        row.push(hvpSourceColumnTopMeters(-16 + (ix + 0.5) * 0.125, -16 + (iz + 0.5) * 0.125));
      }
      tops.push(row);
    }
    const nearNotch = (ix: number, iz: number): boolean => {
      const x = -16 + (ix + 0.5) * 0.125;
      const z = -16 + (iz + 0.5) * 0.125;
      for (const hill of HVP_COAST_HILLS.slice(0, 3)) {
        const dx = x - hill.centerX;
        const dz = z - hill.centerZ;
        const radius = Math.sqrt(dx * dx + dz * dz);
        if (radius > hill.baseRadius * 1.2) {
          continue;
        }
        let bearing = Math.atan2(dz, dx);
        for (const notch of hill.notchBearings) {
          let delta = Math.abs(bearing - notch) % (Math.PI * 2);
          if (delta > Math.PI) {
            delta = Math.PI * 2 - delta;
          }
          if (delta < 0.35) {
            return true;
          }
        }
      }
      return false;
    };
    const steps = new Set<number>();
    let maximumStep = 0;
    let notchStep = 0;
    for (let iz = 0; iz < 256; iz += 1) {
      for (let ix = 0; ix < 256; ix += 1) {
        const here = tops[iz]![ix]!;
        const check = (other: number, otherIx: number, otherIz: number): void => {
          const step = Math.abs(other - here);
          if (step < 1e-9) {
            return;
          }
          steps.add(Number(step.toFixed(4)));
          if (nearNotch(ix, iz) || nearNotch(otherIx, otherIz)) {
            notchStep = Math.max(notchStep, step);
          } else {
            maximumStep = Math.max(maximumStep, step);
          }
        };
        if (ix + 1 < 256) {
          check(tops[iz]![ix + 1]!, ix + 1, iz);
        }
        if (iz + 1 < 256) {
          check(tops[iz + 1]![ix]!, ix, iz + 1);
        }
      }
    }
    expect(steps.has(0.125)).toBe(true);
    expect(steps.has(0.25)).toBe(true);
    expect(steps.has(0.5)).toBe(true);
    expect(maximumStep).toBeLessThanOrEqual(0.501);
    // Authored notch gashes break the terrace bound on purpose: steep broken
    // ledges, never smooth ring stacks.
    expect(notchStep).toBeGreaterThan(0.5);
  });
});

describe("HVP registry-bound material bands", () => {
  it("marks submerged column tops as wet limestone", () => {
    const top = hvpSourceColumnTopMeters(2, 3);
    expect(top).toBeLessThan(0);
    const iyTop = Math.round((top - -8) / 0.125);
    expect(readHvpSourceSlot(snapshot, 144, iyTop - 1, 152)).toBe(HVP_SLOT_LIMESTONE_WET);
  });

  it("fills all four slots with real coverage and maps them to distinct roles", () => {
    const slots = snapshot.copySlots();
    const counts = [0, 0, 0, 0, 0];
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index]!;
      if (slot < 0 || slot > 4) {
        throw new Error(`slot out of range at ${String(index)}: ${String(slot)}`);
      }
      counts[slot] += 1;
    }
    expect(counts[HVP_SLOT_KNOWN_AIR]).toBeGreaterThan(1_000_000);
    expect(counts[HVP_SLOT_LIMESTONE_DRY]).toBeGreaterThan(1_000);
    expect(counts[HVP_SLOT_LIMESTONE_WET]).toBeGreaterThan(1_000);
    expect(counts[HVP_SLOT_SOIL]).toBeGreaterThan(1_000);
    expect(counts[HVP_SLOT_MOSS]).toBeGreaterThan(1_000);
    expect([
      hvpSourceSlotRole(HVP_SLOT_LIMESTONE_DRY),
      hvpSourceSlotRole(HVP_SLOT_LIMESTONE_WET),
      hvpSourceSlotRole(HVP_SLOT_SOIL),
      hvpSourceSlotRole(HVP_SLOT_MOSS)
    ]).toEqual(["limestone-dry", "limestone-wet", "soil", "moss"]);
    expect(() => hvpSourceSlotRole(0)).toThrow(RangeError);
    expect(() => hvpSourceSlotRole(9)).toThrow(RangeError);
  });
});

describe("HVP compact page ownership and addressing", () => {
  it("addresses X-fastest without exposing the writable authority", () => {
    const copy = snapshot.copySlots();
    expect(copy).toHaveLength(HVP_SOURCE_SLOT_COUNT);
    expect(copy[(3 + 256 * (5 + 256 * 7)) | 0]).toBe(readHvpSourceSlot(snapshot, 3, 7, 5));
    const second = snapshot.copySlots();
    expect(second).not.toBe(copy);
    expect(second.length).toBe(copy.length);
    let mismatches = 0;
    for (let index = 0; index < copy.length; index += 1) {
      if (second[index] !== copy[index]) {
        mismatches += 1;
      }
    }
    expect(mismatches).toBe(0);
    copy[0] = 255;
    expect(readHvpSourceSlot(snapshot, 0, 0, 0)).not.toBe(255);
    expect(readHvpSourceSlot(snapshot, 0, 0, 0)).toBe(second[0]);
  }, 60_000);

  it("rejects out-of-region and non-integer slot reads fail-closed", () => {
    expect(() => readHvpSourceSlot(snapshot, 256, 0, 0)).toThrow(RangeError);
    expect(() => readHvpSourceSlot(snapshot, 0, -1, 0)).toThrow(RangeError);
    expect(() => readHvpSourceSlot(snapshot, 1.5, 0, 0)).toThrow(TypeError);
  });

  it("hashes the same named seed deterministically across sync and async builds", async () => {
    const synchronous = materializeHvpCoastSource();
    expect(synchronous.sourceDigest).toMatch(/^[0-9a-f]{8}$/);
    expect(synchronous.sourceDigest).toBe(snapshot.sourceDigest);
    expect(synchronous.registryDigest).toBe(HVP_COAST_REGISTRY_DIGEST);
    let progressCalls = 0;
    const asynchronous = await materializeHvpCoastSourceAsync(() => {
      progressCalls += 1;
    });
    expect(asynchronous.sourceDigest).toBe(snapshot.sourceDigest);
    expect(progressCalls).toBeGreaterThan(0);
    expect(() => assertHvpSourceComplete(snapshot)).not.toThrow();
    expect(() => assertHvpSourceComplete({ ...snapshot, sourceDigest: "deadbeef" })).toThrow(/source/i);
    expect(() => assertHvpSourceComplete(undefined as unknown as HvpCoastSourceSnapshot)).toThrow(/source/i);
  });
});

describe("HVP water mask derived from the same source at y=0", () => {
  it("covers submerged columns while excluding dry and coplanar tops", () => {
    const mask = deriveHvpWaterMask(prepared);
    expect(mask.sizeX).toBe(256);
    expect(mask.sizeZ).toBe(256);
    expect(mask.waterCellCount).toBeGreaterThan(3_000);
    expect(mask.waterCellCount).toBeLessThan(256 * 256 * 0.9);
    expect(mask.digest).toMatch(/^[0-9a-f]{8}$/);
    let coplanarDryWitnessed = false;
    for (let iz = 0; iz < 256; iz += 1) {
      for (let ix = 0; ix < 256; ix += 1) {
        const top = hvpSourceColumnTopMeters(-16 + (ix + 0.5) * 0.125, -16 + (iz + 0.5) * 0.125);
        const wet = mask.cells[iz * 256 + ix] === 1;
        if (wet) {
          expect(top).toBeLessThan(0);
        } else if (Math.abs(top) < 1e-9) {
          coplanarDryWitnessed = true;
        }
      }
    }
    expect(coplanarDryWitnessed).toBe(true);
  });

  it("keeps the lagoon channel continuously submerged", () => {
    const mask = deriveHvpWaterMask(prepared);
    const dryGaps: string[] = [];
    for (let step = 0; step <= 60; step += 1) {
      const worldZ = -15 + step * 0.5;
      let bestX = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let scan = 0; scan <= 128; scan += 1) {
        const worldX = -16 + scan * 0.25;
        const distance = hvpChannelSignedDistanceMeters(worldX, worldZ).distance;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestX = worldX;
        }
      }
      if (bestDistance > 0.5) {
        dryGaps.push(`no centerline near z=${worldZ}`);
        continue;
      }
      const ix = Math.floor((bestX + 16) / 0.125);
      const iz = Math.floor((worldZ + 16) / 0.125);
      if (mask.cells[iz * 256 + ix] !== 1) {
        dryGaps.push(`dry gap at (${bestX.toFixed(2)},${worldZ.toFixed(2)})`);
      }
    }
    expect(dryGaps).toEqual([]);
    const fresh = deriveHvpWaterMask(prepared);
    expect(fresh.digest).toBe(mask.digest);
    expect(fresh.cells).not.toBe(mask.cells);
  });
});

describe("HVP compact greedy mesher oracles on tiny fixtures", () => {
  it("merges two adjacent cubes into 6 quads covering 10 unit faces", () => {
    const mesh = meshHvpTestCells(
      [
        { x: 0, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY },
        { x: 1, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY }
      ],
      1
    );
    expect(mesh.faceCount).toBe(6);
    expect(mesh.unitFaceCount).toBe(10);
    expect(mesh.positions).toHaveLength(6 * 4 * 3);
    expect(mesh.indices).toHaveLength(6 * 6);
  });

  it("keeps 60 unit faces with 6 cavity faces for the hollow 26-cell cube", () => {
    const cells: { x: number; y: number; z: number; slot: number }[] = [];
    for (let x = 0; x < 3; x += 1) {
      for (let y = 0; y < 3; y += 1) {
        for (let z = 0; z < 3; z += 1) {
          if (x === 1 && y === 1 && z === 1) {
            continue;
          }
          cells.push({ x, y, z, slot: HVP_SLOT_LIMESTONE_DRY });
        }
      }
    }
    const mesh = meshHvpTestCells(cells, 1);
    expect(mesh.faceCount).toBe(12);
    expect(mesh.unitFaceCount).toBe(60);
    expect(mesh.cavityFaceCount).toBe(6);
    expect(mesh.outerFaceCount).toBe(54);
  });

  it("winds every face counter-clockwise seen from outside", () => {
    const mesh = meshHvpTestCells(
      [
        { x: -2, y: -1, z: 3, slot: HVP_SLOT_LIMESTONE_WET },
        { x: -1, y: -1, z: 3, slot: HVP_SLOT_SOIL }
      ],
      0.5
    );
    // Different slots never merge: 10 unit faces stay 10 quads here.
    expect(mesh.faceCount).toBe(10);
    expect(mesh.unitFaceCount).toBe(10);
    for (let face = 0; face < mesh.faceCount; face += 1) {
      const base = face * 12;
      const ax = mesh.positions[base + 3]! - mesh.positions[base]!;
      const ay = mesh.positions[base + 4]! - mesh.positions[base + 1]!;
      const az = mesh.positions[base + 5]! - mesh.positions[base + 2]!;
      const bx = mesh.positions[base + 6]! - mesh.positions[base]!;
      const by = mesh.positions[base + 7]! - mesh.positions[base + 1]!;
      const bz = mesh.positions[base + 8]! - mesh.positions[base + 2]!;
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(length).toBeGreaterThan(0);
      const storedX = mesh.normals[base]!;
      const storedY = mesh.normals[base + 1]!;
      const storedZ = mesh.normals[base + 2]!;
      const alignment = (nx * storedX + ny * storedY + nz * storedZ) / length;
      expect(alignment).toBeCloseTo(1, 6);
    }
    for (let vertex = 0; vertex < mesh.normals.length; vertex += 3) {
      const nx = mesh.normals[vertex]!;
      const ny = mesh.normals[vertex + 1]!;
      const nz = mesh.normals[vertex + 2]!;
      expect(nx * nx + ny * ny + nz * nz).toBeCloseTo(1, 9);
    }
  });

  it("orders deterministically, supports negative cells, and caps tiny fixtures", () => {
    const cells = [
      { x: 1, y: 0, z: -1, slot: HVP_SLOT_MOSS },
      { x: 0, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY },
      { x: -3, y: 2, z: -4, slot: HVP_SLOT_SOIL }
    ];
    const forward = meshHvpTestCells(cells, 0.25);
    const backward = meshHvpTestCells([...cells].reverse(), 0.25);
    expect([...backward.positions]).toEqual([...forward.positions]);
    expect([...backward.indices]).toEqual([...forward.indices]);
    const oversized: { x: number; y: number; z: number; slot: number }[] = [];
    for (let index = 0; index < 4_097; index += 1) {
      oversized.push({ x: index, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY });
    }
    expect(() => meshHvpTestCells(oversized, 1)).toThrow(/BudgetExceeded/);
  });

  it("groups material ranges deterministically under role permutation", () => {
    const cells = [
      { x: 0, y: 0, z: 0, slot: HVP_SLOT_MOSS },
      { x: 1, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY },
      { x: 0, y: 0, z: 1, slot: HVP_SLOT_SOIL },
      { x: 1, y: 0, z: 1, slot: HVP_SLOT_LIMESTONE_WET }
    ];
    const mesh = meshHvpTestCells(cells, 1);
    const uniqueSlots = [...new Set(mesh.materialRanges.map((range) => range.slot))].sort((left, right) => left - right);
    expect(uniqueSlots).toEqual([1, 2, 3, 4]);
    const covered = mesh.materialRanges.reduce((total, range) => total + range.indexCount, 0);
    expect(covered).toBe(mesh.indices.length);
    mesh.materialRanges.forEach((range, index, ranges) => {
      const expectedStart = index === 0 ? 0 : ranges[index - 1]!.startIndex + ranges[index - 1]!.indexCount;
      expect(range.startIndex).toBe(expectedStart);
    });
  });
});

describe("HVP production mesh from compact pages", () => {
  it("meshes the full region inside triangle and byte budgets", () => {
    const mesh = productionMesh;
    expect(mesh.algorithmVersion).toBe(HVP_COAST_MESH_ALGORITHM_VERSION);
    expect(mesh.sourceDigest).toBe(snapshot.sourceDigest);
    expect(mesh.faceCount).toBeGreaterThan(1_000);
    const triangles = mesh.indices.length / 3;
    expect(triangles).toBeLessThanOrEqual(500_000);
    const meshBytes = mesh.positions.byteLength + mesh.normals.byteLength + mesh.indices.byteLength;
    expect(meshBytes).toBeLessThanOrEqual(128 * 1024 * 1024);
    expect(8_388_608 + meshBytes).toBeLessThanOrEqual(256 * 1024 * 1024);
    expect(mesh.cavityFaceCount).toBe(0);
    const uniqueSlots = [...new Set(mesh.materialRanges.map((range) => range.slot))].sort((left, right) => left - right);
    expect(uniqueSlots).toEqual([1, 2, 3, 4]);
    const covered = mesh.materialRanges.reduce((total, range) => total + range.indexCount, 0);
    expect(covered).toBe(mesh.indices.length);
  }, 120_000);

  it("conserves every column top as upward face area", () => {
    const mesh = productionMesh;
    let upwardArea = 0;
    for (let face = 0; face < mesh.faceCount; face += 1) {
      const ny = mesh.normals[face * 12 + 1]!;
      if (ny > 0.5) {
        const base = face * 12;
        const ax = mesh.positions[base + 3]! - mesh.positions[base]!;
        const az = mesh.positions[base + 5]! - mesh.positions[base + 2]!;
        const bx = mesh.positions[base + 6]! - mesh.positions[base]!;
        const bz = mesh.positions[base + 8]! - mesh.positions[base + 2]!;
        upwardArea += Math.abs(ax * bz - az * bx);
      }
    }
    expect(upwardArea).toBeCloseTo(256 * 256 * 0.125 * 0.125, 3);
  }, 120_000);

  it("rejects over-budget mesh requests before allocating outputs", () => {
    expect(() => meshHvpCoastSource(prepared, { maxQuads: 8 })).toThrow(/BudgetExceeded/);
  }, 120_000);
});

describe("HVP production water mesh from the source mask", () => {
  it("emits flat outward water quads with conserved area", () => {
    const mask = waterMask;
    const water = productionWater;
    expect(water.algorithmVersion).toBe(HVP_WATER_MESH_ALGORITHM_VERSION);
    expect(water.sourceDigest).toBe(mask.digest);
    expect(water.faceCount).toBeGreaterThan(10);
    for (let index = 0; index < water.positions.length; index += 3) {
      expect(water.positions[index + 1]).toBe(0);
    }
    for (let index = 0; index < water.normals.length; index += 3) {
      expect(water.normals[index]).toBe(0);
      expect(water.normals[index + 1]).toBe(1);
      expect(water.normals[index + 2]).toBe(0);
    }
    let area = 0;
    for (let face = 0; face < water.faceCount; face += 1) {
      const base = face * 12;
      const ax = water.positions[base + 3]! - water.positions[base]!;
      const az = water.positions[base + 5]! - water.positions[base + 2]!;
      const bx = water.positions[base + 6]! - water.positions[base]!;
      const bz = water.positions[base + 8]! - water.positions[base + 2]!;
      area += Math.abs(ax * bz - az * bx);
    }
    const expected = (mask.waterCellCount + mask.join.waterCellCount) * 0.125 * 0.125 + mask.outer.waterCellCount * 0.5 * 0.5;
    expect(area).toBeCloseTo(expected, 3);
    expect(area).toBeGreaterThan(mask.waterCellCount * 0.125 * 0.125);
    expect(area).toBeLessThan(480 * 480);
  });

  it("rejects over-budget water output before materializing arrays", () => {
    expect(() => meshHvpWaterMask(waterMask, {
      maxVisitedCells: 8_388_608,
      maxQuads: 1,
      maxVertices: 4,
      maxIndices: 6
    })).toThrow(/meshHvpWaterMask BudgetExceeded/);
  });

  it("rejects malformed water-grid dimensions before iterating", () => {
    expect(() => meshHvpWaterMask({
      ...waterMask,
      outer: { ...waterMask.outer, cellMeters: 0 }
    })).toThrow(/finite positive outer grid/);
  });
});

describe("HVP far field and join ring geometry", () => {
  it("derives staggered far landforms from the versioned macro surface", () => {
    const far = meshHvpFarField(prepared);
    expect(far.algorithmVersion).toBe(HVP_FARFIELD_MESH_ALGORITHM_VERSION);
    expect(far.sourceDigest).toBe(prepared.sourceDigest);
    expect(far.positions.length).toBeGreaterThan(0);
    expect(far.indices.length % 3).toBe(0);
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const heights = new Set<number>();
    for (let index = 0; index < far.positions.length; index += 3) {
      const x = far.positions[index]!;
      const y = far.positions[index + 1]!;
      const z = far.positions[index + 2]!;
      expect(Number.isFinite(y)).toBe(true);
      expect(Math.abs(x)).toBeLessThanOrEqual(240);
      expect(Math.abs(z)).toBeLessThanOrEqual(240);
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }
      heights.add(Number(y.toFixed(3)));
    }
    expect(minY).toBeLessThan(0);
    expect(maxY).toBeGreaterThan(4);
    // 1 m horizontal footprints with source-faithful terrace heights.
    expect(heights.size).toBeGreaterThan(3);
  }, 120_000);

  it("meshes the join ring inside the 16 to 20 m band with bound roles", () => {
    const join = meshHvpJoinRing(prepared);
    expect(join.faceCount).toBeGreaterThan(100);
    let minRim = Number.POSITIVE_INFINITY;
    let maxRim = 0;
    for (let index = 0; index < join.positions.length; index += 3) {
      const rim = Math.max(Math.abs(join.positions[index]!), Math.abs(join.positions[index + 2]!));
      if (rim < minRim) {
        minRim = rim;
      }
      if (rim > maxRim) {
        maxRim = rim;
      }
    }
    expect(minRim).toBeLessThanOrEqual(16.01);
    expect(maxRim).toBeLessThanOrEqual(20.01);
  });
});
