import { beforeAll, describe, expect, it } from "vitest";
import {createHash} from "node:crypto";
import { PerspectiveCamera, Vector3 } from "three";
import {
  HVP_COAST_MATERIAL_REGISTRY,
  HVP_COAST_SEED_NAME,
  HVP_COAST_SOURCE_VERSION,
  HVP_SOURCE_LEAF_COUNT_X,
  HVP_SOURCE_LEAF_COUNT_Y,
  HVP_SOURCE_LEAF_COUNT_Z,
  HVP_SOURCE_SIZE_X,
  HVP_SOURCE_SIZE_Y,
  HVP_SOURCE_SIZE_Z,
  HVP_SLOT_KNOWN_AIR,
  HVP_SLOT_LIMESTONE_WET,
  HVP_SLOT_MOSS,
  HVP_SLOT_SOIL,
  deriveHvpWaterMask,
  hvpLeafAddressForSlot,
  materializeHvpCoastSource,
  prepareHvpCoastSource,
  readHvpSourceColumnWorld,
  type HvpPreparedCoastSource
} from "../../src/hvp/hvpCoastSource";
import { admitHvpResources, assertHvpProductsBound, buildHvpResourceLedger, createHvpCompactLookTerrain } from "../../src/hvp/hvpBootstrap";
import { createHvpLookProfile } from "../../src/hestia-prototype/presentation/look";
import {
  meshHvpFarField,
  meshHvpCoastSource,
  meshHvpJoinRing,
  meshHvpOccupancy,
  meshHvpTestCells,
  meshHvpWaterMask
} from "../../src/hvp/hvpCoastMesher";

let prepared: HvpPreparedCoastSource;

// Read the actual indexed output, not the mesher's sampling/ownership helpers.
const emittedQuads = (mesh: ReturnType<typeof meshHvpFarField>) => {
  const result: Array<{ min: number[]; max: number[]; normal: number[]; slot: number }> = [];
  let rangeIndex = 0;
  for (let i = 0; i < mesh.indices.length; i += 6) {
    while (i >= mesh.materialRanges[rangeIndex]!.startIndex + mesh.materialRanges[rangeIndex]!.indexCount) {
      rangeIndex += 1;
    }
    const triangles = mesh.indices.slice(i, i + 6);
    const vertices = [...new Set(triangles)];
    expect(vertices).toHaveLength(4);
    const axes = [0, 1, 2].map((axis) => vertices.map((v) => mesh.positions[v * 3 + axis]!));
    const quad = {
      min: axes.map((values) => Math.min(...values)),
      max: axes.map((values) => Math.max(...values)),
      normal: [0, 1, 2].map((axis) => mesh.normals[vertices[0]! * 3 + axis]!),
      slot: mesh.materialRanges[rangeIndex]!.slot
    };
    const plane = quad.normal.findIndex((value) => Math.abs(value) === 1);
    const tangents = [0, 1, 2].filter((axis) => axis !== plane);
    if (plane < 0 || quad.min[plane] !== quad.max[plane]
      || tangents.some((axis) => quad.normal[axis] !== 0 || quad.min[axis] === quad.max[axis])
      || axes.some((values, axis) => values.some((v) => !Number.isInteger(v * 8)
        || (v !== quad.min[axis] && v !== quad.max[axis])))) {
      throw new Error("Emitted face is not an axis-aligned grid rectangle");
    }
    // A shared EXTERIOR edge also gives four vertices and the expected total
    // area, but overlaps the triangles. Require the interior diagonal.
    const shared = [...triangles.slice(0, 3)].filter((v) => triangles.slice(3).includes(v));
    if (shared.length !== 2 || tangents.some((axis) =>
      mesh.positions[shared[0]! * 3 + axis] === mesh.positions[shared[1]! * 3 + axis])) {
      throw new Error("Emitted triangles do not share the rectangle diagonal");
    }
    const area = tangents.reduce((value, axis) => value * (quad.max[axis]! - quad.min[axis]!), 1);
    for (const start of [0, 3]) {
      const a = triangles[start]! * 3;
      const b = triangles[start + 1]! * 3;
      const c = triangles[start + 2]! * 3;
      const u = [0, 1, 2].map((axis) => mesh.positions[b + axis]! - mesh.positions[a + axis]!);
      const v = [0, 1, 2].map((axis) => mesh.positions[c + axis]! - mesh.positions[a + axis]!);
      const cross = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
      if (cross.some((value, axis) => value !== quad.normal[axis]! * area)) {
        throw new Error("Emitted triangle has wrong winding or area");
      }
    }
    result.push(quad);
  }
  return result;
};

const rasterTops = (quads: ReturnType<typeof emittedQuads>, half: number, cell: number) => {
  const dim = 2 * half / cell;
  const heights = new Float32Array(dim * dim);
  const coverage = new Uint8Array(dim * dim);
  for (const q of quads) {
    if (q.normal[1] !== 1) {
      continue;
    }
    for (let x = Math.max(0, Math.ceil((q.min[0]! + half) / cell - 0.5)); x < Math.min(dim, (q.max[0]! + half) / cell - 0.5); x += 1) {
      for (let z = Math.max(0, Math.ceil((q.min[2]! + half) / cell - 0.5)); z < Math.min(dim, (q.max[2]! + half) / cell - 0.5); z += 1) {
      if(coverage[z*dim+x]===0||q.min[1]!>heights[z*dim+x]!){heights[z * dim + x] = q.min[1]!;}
        coverage[z * dim + x]! += 1;
      }
    }
  }
  return { heights, coverage, dim };
};

const assertSeam = (
  inner: ReturnType<typeof meshHvpFarField>,
  outer: ReturnType<typeof meshHvpFarField>,
  half: number
): void => {
  const innerQuads = emittedQuads(inner);
  const outerQuads = emittedQuads(outer);
  const innerTops = rasterTops(innerQuads, half + 1, 0.125);
  const outerTops = rasterTops(outerQuads, half + 1, 0.125);
  const sides = [...innerQuads, ...outerQuads];
  const spanCells = 2 * half / 0.125;
  let badCoverage = 0;
  let expectedFaces = 0;
  for (const axis of [0, 2]) {
    const tangent = axis === 0 ? 2 : 0;
    for (const sign of [-1, 1]) {
      const plane = sign * half;
      const faces = sides.filter((q) => Math.abs(q.normal[axis]!) === 1 && q.min[axis] === plane
        && q.max[axis] === plane && q.max[tangent]! > -half && q.min[tangent]! < half);
      const positive = new Uint8Array(spanCells * 128);
      const negative = new Uint8Array(spanCells * 128);
      for (const q of faces) {
        const counts = q.normal[axis] === 1 ? positive : negative;
        for (let t = Math.max(0, (q.min[tangent]! + half) / 0.125); t < Math.min(spanCells, (q.max[tangent]! + half) / 0.125); t += 1) {
          for (let y = Math.max(0, (q.min[1]! + 8) / 0.125); y < Math.min(128, (q.max[1]! + 8) / 0.125); y += 1) {
            counts[t * 128 + y]! += 1;
          }
        }
      }
      for (let t = -half + 0.0625; t < half; t += 0.125) {
        const inside = plane - sign * 0.0625;
        const outside = plane + sign * 0.0625;
        const indexAt = (edge: number) => Math.floor(((axis === 0 ? t : edge) + half + 1) / 0.125) * innerTops.dim
          + Math.floor(((axis === 0 ? edge : t) + half + 1) / 0.125);
        const ai = indexAt(inside);
        const bi = indexAt(outside);
        expect(innerTops.coverage[ai]).toBe(1);
        expect(outerTops.coverage[bi]).toBe(1);
        const a = innerTops.heights[ai]!;
        const b = outerTops.heights[bi]!;
        for (let y = -7.9375; y < 8; y += 0.125) {
          const index = Math.floor((t + half) / 0.125) * 128 + Math.floor((y + 8) / 0.125);
          const expected = y < a && y >= b ? sign : y < b && y >= a ? -sign : 0;
          expectedFaces += Math.abs(expected);
          if (positive[index] !== (expected === 1 ? 1 : 0) || negative[index] !== (expected === -1 ? 1 : 0)) {
            badCoverage += 1;
          }
        }
      }
    }
  }
  expect(expectedFaces).toBeGreaterThan(0);
  expect(badCoverage, `hidden, missing, double or reversed faces at ±${half}`).toBe(0);
};

beforeAll(() => {
  prepared = prepareHvpCoastSource(materializeHvpCoastSource());
}, 120_000);

it("owns the dry walking shaft as known air above its canonical solid floor", () => {
  console.info("HVP05 source binding", prepared.sourceDigest);
  // Explicit fixture coordinates, independent of the exported shaft descriptor.
  for (let x = 34; x < 46; x += 1) {
    for (let z = 34; z < 46; z += 1) {
      expect(prepared.readSlot(x, 64, z)).not.toBe(HVP_SLOT_KNOWN_AIR); // [0, .125)
      for (let y = 65; y < 128; y += 1) { expect(prepared.readSlot(x, y, z)).toBe(HVP_SLOT_KNOWN_AIR); }
    }
  }
  expect(readHvpSourceColumnWorld(-10.1875, -11).topMeters).toBeGreaterThan(0.5);
});

describe("HVP R10 art-contract falsification", () => {
  // Four-neighbor search on measured coverage: a closed lagoon cannot pass by
  // having unrelated sea elsewhere or by merely extending descriptor metadata.
  const reachesNorthSea = (wetAt: (x: number, z: number) => boolean): boolean => {
    const queue: Array<readonly [number, number]> = [[0.25, 15.25]];
    const visited = new Set<string>();
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const [x, z] = queue[cursor]!;
      const key = `${x},${z}`;
      if (visited.has(key) || x < -20 || x > 20 || z < 14 || z > 56 || !wetAt(x, z)) {
        continue;
      }
      visited.add(key);
      if (z > 55) {
        return true;
      }
      queue.push([x - 0.5, z], [x + 0.5, z], [x, z - 0.5], [x, z + 0.5]);
    }
    return false;
  };

  it("connects the authored northern channel to outer coastal sea", () => {
    expect(reachesNorthSea((x, z) => readHvpSourceColumnWorld(x, z).topMeters < 0),
      "source north outlet is blocked before z=56").toBe(true);
  });

  it("connects emitted water through authority, join and far to northern sea", () => {
    const wet = rasterTops(emittedQuads(meshHvpWaterMask(deriveHvpWaterMask(prepared))), 56, 0.5);
    expect(reachesNorthSea((x, z) => wet.coverage[Math.floor((z + 56) * 2) * wet.dim + Math.floor((x + 56) * 2)] === 1),
      "emitted north outlet is blocked before z=56").toBe(true);
  });

  it("keeps the emitted outer ocean edge outside the fixed views' visible lighting envelope", () => {
    const water = meshHvpWaterMask(deriveHvpWaterMask(prepared));
    const quads = emittedQuads(water);
    let visibleEnds = 0;
    for (const [position, target, fov] of [
      [[-8, 3.15, -11], [0, 1, 5], 60],
      [[-2, 1.25, -6], [1, -0.5, -2], 55],
      [[-24, 18, -28], [0, 1, 1], 55]
    ] as const) {
      const camera = new PerspectiveCamera(fov, 16 / 9, 0.1, 2000);
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(target[0], target[1], target[2]);
      camera.updateMatrixWorld();
      const forward = camera.getWorldDirection(new Vector3());
      for (const q of quads) {
        for (const axis of [0, 2]) {
          const tangent = axis === 0 ? 2 : 0;
          for (const sign of [-1, 1]) {
            const bound = axis === 0 ? water.boundsMeters.max.x : water.boundsMeters.max.z;
            if ((sign < 0 ? q.min[axis] : q.max[axis]) !== sign * bound) {
              continue;
            }
            for (let t = q.min[tangent]! + 0.25; t < q.max[tangent]!; t += 0.5) {
              const point = new Vector3(axis === 0 ? sign * bound : t, 0, axis === 2 ? sign * bound : t);
              const depth = point.clone().sub(camera.position).dot(forward);
              const screen = point.project(camera);
              // The existing look's 170 m envelope is unchanged. Extending
              // actual source-bound geometry, rather than moving this threshold,
              // prevents a finite water cut from masquerading as a shoreline.
              if (depth > 0 && depth < 170 && Math.abs(screen.x) <= 1 && Math.abs(screen.y) <= 1) {
                visibleEnds += 1;
              }
            }
          }
        }
      }
    }
    expect(visibleEnds, "finite emitted water cuts visible before the unchanged 170 m envelope").toBe(0);
  });

  it("admits the complete extended coast without increasing resource caps", () => {
    const terrainMesh = meshHvpCoastSource(prepared);
    const joinMesh = meshHvpJoinRing(prepared);
    const farMesh = meshHvpFarField(prepared);
    const waterMesh = meshHvpWaterMask(deriveHvpWaterMask(prepared));
    const look = createHvpLookProfile("readable");
    const grouped = [createHvpCompactLookTerrain(terrainMesh, look), createHvpCompactLookTerrain(joinMesh, look),
      createHvpCompactLookTerrain(farMesh, look, { allowPartialRoles: true })];
    const ledger = buildHvpResourceLedger({ terrainMesh, joinMesh, farMesh, waterMesh,
      groupedIndexBytes: grouped.reduce((sum, mesh) => sum + mesh.indices.byteLength, 0),
      drawCalls: grouped.reduce((sum, mesh) => sum + mesh.materialRanges.length, 1) });
    console.info("R10 complete coast admission", ledger);
    expect(() => admitHvpResources(ledger)).not.toThrow();
  }, 120_000);

  it("keeps actual wet source cells below the existing 0.375 m splash ceiling", () => {
    const bytes = prepared.copyBytes();
    let count = 0;
    let aboveSplash = 0;
    let maximum = -Infinity;
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === HVP_SLOT_LIMESTONE_WET) {
        const top = -8 + (Math.floor(i / 256) % 128 + 1) * 0.125;
        count += 1;
        maximum = Math.max(maximum, top);
        if (top >= 0.375) {
          aboveSplash += 1;
        }
      }
    }
    console.info("R10 wet source census", { count, aboveSplash, maximum });
    expect(count).toBeGreaterThan(1000);
    expect(aboveSplash, `wet cells above splash margin; max=${maximum}m`).toBe(0);
  });

  it.each([
    { name: "join", mesh: meshHvpJoinRing, cell: 0.125 },
    { name: "far", mesh: meshHvpFarField, cell: 1 }
  ])("preserves submerged source wet-layer depth on emitted $name risers", ({ mesh, cell }) => {
    let checked = 0;
    let mismatches = 0;
    for (const q of emittedQuads(mesh(prepared))) {
      if (q.normal[1] !== 0 || q.max[1]! >= 0) {
        continue;
      }
      const axis = q.normal[0] === 0 ? 2 : 0;
      const tangent = axis === 0 ? 2 : 0;
      for (let t = q.min[tangent]! + 0.0625; t < q.max[tangent]!; t += 0.125) {
        const inside = q.min[axis]! - q.normal[axis]! * 0.0625;
        const x = axis === 0 ? inside : t;
        const z = axis === 2 ? inside : t;
        const column = readHvpSourceColumnWorld(Math.floor(x / cell) * cell + cell / 2, Math.floor(z / cell) * cell + cell / 2);
        for (let y = q.min[1]! + 0.0625; y < q.max[1]!; y += 0.125) {
          const expected = column.topMeters < 0 && y >= column.topMeters - 0.25 ? 2 : 1;
          if (q.slot !== expected) {
            mismatches += 1;
          }
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(mismatches, "submerged riser roles diverge from authority's two wet layers").toBe(0);
  });

  it.each([
    { name: "west foreground", x: -10, z: -5, bearing: 1.55 * Math.PI, radius: 2.5 },
    { name: "west north", x: -9, z: 8, bearing: 1.35 * Math.PI, radius: 2.5 },
    { name: "east", x: 9, z: 4, bearing: 1.1 * Math.PI, radius: 2.5 }
  ])("interrupts the camera-facing $name shelves across a substantial sector", ({ x, z, bearing, radius }) => {
    const at = (angle: number) => readHvpSourceColumnWorld(x + radius * Math.cos(angle), z + radius * Math.sin(angle)).topMeters;
    const flank = Math.min(at(bearing - 0.6), at(bearing + 0.6));
    // Several adjacent bearings, not one hand-picked point: a narrow pinhole
    // cannot stand in for a broken principal shelf visible from C01/C04.
    const drops = [-0.1, 0, 0.1].map((offset) => flank - at(bearing + offset));
    expect(Math.min(...drops), `camera-facing notch drops: ${drops.join(",")}`).toBeGreaterThanOrEqual(0.75);
  });
});

describe("HVP emitted-surface oracle negatives", () => {
  it("rejects overlapping triangles even when four vertices enclose the expected rectangle", () => {
    const mesh = meshHvpTestCells([{ x: 0, y: 0, z: 0, slot: 1 }], 1);
    const invalid = { ...mesh, indices: mesh.indices.slice() };
    // Same four corners, positive winding and total area as a rectangle, but
    // the shared edge is exterior: triangles overlap and leave a hole.
    invalid.indices.set([0, 1, 2, 0, 1, 3]);
    expect(() => emittedQuads(invalid)).toThrow();
  });
});

describe("HVP R2 source version and density provenance", () => {
  it("versions the corrected descriptor and marks densities as unapproved tuning", () => {
    expect(HVP_COAST_SOURCE_VERSION).toBe("hvp-authored-coast-v5");
    expect(HVP_COAST_SEED_NAME).toBe("hestia-hvp-lagoon-001");
    for (const entry of HVP_COAST_MATERIAL_REGISTRY) {
      expect(entry.provenance).toBe("prototype-tuning-unapproved");
    }
    expect(prepared.version).toBe(HVP_COAST_SOURCE_VERSION);
  });
});

describe("HVP R2 bounded 16-cubed leaf reads", () => {
  it("exposes the normative leaf grid without JS cell graphs", () => {
    expect(HVP_SOURCE_LEAF_COUNT_X).toBe(16);
    expect(HVP_SOURCE_LEAF_COUNT_Y).toBe(8);
    expect(HVP_SOURCE_LEAF_COUNT_Z).toBe(16);
    expect(hvpLeafAddressForSlot(0, 0, 0)).toEqual({ lx: 0, ly: 0, lz: 0 });
    expect(hvpLeafAddressForSlot(255, 127, 255)).toEqual({ lx: 15, ly: 7, lz: 15 });
    expect(() => hvpLeafAddressForSlot(256, 0, 0)).toThrow(RangeError);
    expect(() => hvpLeafAddressForSlot(0, -1, 0)).toThrow(RangeError);
    expect(() => prepared.readLeaf(16, 0, 0)).toThrow(RangeError);
    expect(() => prepared.readLeaf(0, 0, -1)).toThrow(RangeError);
  });

  it("reads leaf bytes in adaptive X-fastest local order matching the global pages", () => {
    const leaf = prepared.readLeaf(0, 0, 0);
    expect(leaf.slots).toHaveLength(4096);
    expect(leaf.digest).toMatch(/^[0-9a-f]{8}$/);
    const bytes = prepared.copyBytes();
    let mismatches = 0;
    for (let ly = 0; ly < 16; ly += 1) {
      for (let lz = 0; lz < 16; lz += 1) {
        for (let lx = 0; lx < 16; lx += 1) {
          const local = lx + 16 * (ly + 16 * lz);
          const global = (0 * 16 + lx) + HVP_SOURCE_SIZE_X * ((0 * 16 + ly) + HVP_SOURCE_SIZE_Y * (0 * 16 + lz));
          if (leaf.slots[local] !== bytes[global]) {
            mismatches += 1;
          }
        }
      }
    }
    expect(mismatches).toBe(0);
    const second = prepared.readLeaf(0, 0, 0);
    expect(second.slots).not.toBe(leaf.slots);
  });

  it("compares actual leaf bytes and digests identically across query orders", () => {
    const addresses: Array<{ lx: number; ly: number; lz: number }> = [];
    for (let lz = 0; lz < HVP_SOURCE_LEAF_COUNT_Z; lz += 1) {
      for (let ly = 0; ly < HVP_SOURCE_LEAF_COUNT_Y; ly += 1) {
        for (let lx = 0; lx < HVP_SOURCE_LEAF_COUNT_X; lx += 1) {
          addresses.push({ lx, ly, lz });
        }
      }
    }
    expect(addresses).toHaveLength(2048);
    const combine = (order: Array<{ lx: number; ly: number; lz: number }>): string =>
      order.map((address) => prepared.readLeaf(address.lx, address.ly, address.lz).digest).join("");
    const forward = combine(addresses);
    expect(combine(addresses)).toBe(forward);
    let state = 0x12345678;
    const shuffled = [...addresses];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      const j = state % (i + 1);
      const a = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = a;
    }
    const shuffledLeaves = shuffled.map((address) => prepared.readLeaf(address.lx, address.ly, address.lz));
    const byAddress = new Map(shuffledLeaves.map((leaf, index) => [
      `${shuffled[index]!.lx},${shuffled[index]!.ly},${shuffled[index]!.lz}`,
      [...leaf.slots].join(",")
    ]));
    for (const address of addresses) {
      const canonical = prepared.readLeaf(address.lx, address.ly, address.lz);
      expect(byAddress.get(`${address.lx},${address.ly},${address.lz}`)).toBe([...canonical.slots].join(","));
    }
    const canonicalOrder = [...shuffled].sort((left, right) =>
      left.lz - right.lz || left.ly - right.ly || left.lx - right.lx
    );
    expect(combine(canonicalOrder)).toBe(forward);
  });

  it("binds the combined leaf digests to the source digest", () => {
    expect(prepared.combinedLeafDigest).toBe(prepared.sourceDigest);
  });

  it("reads Unknown outside the region through the owning public path", () => {
    expect(prepared.readCoverage(0, 0, 0)).not.toBe("UnknownCoverage");
    expect(prepared.readCoverage(-1, 0, 0)).toBe("UnknownCoverage");
    expect(prepared.readCoverage(0, 128, 0)).toBe("UnknownCoverage");
    expect(prepared.readCoverage(0, 0, 256)).toBe("UnknownCoverage");
    expect(prepared.readCoverage(256, 0, 0)).toBe("UnknownCoverage");
    const air = prepared.readCoverage(128, 127, 128);
    expect(air === "KnownAir" || air === "KnownSolid").toBe(true);
  });
});

describe("HVP R2 coherent material patches", () => {
  it("grows soil and moss in blobs instead of hash speckle", () => {
    const bytes = prepared.copyBytes();
    const at = (ix: number, iy: number, iz: number): number =>
      bytes[ix + HVP_SOURCE_SIZE_X * (iy + HVP_SOURCE_SIZE_Y * iz)]!;
    let soil = 0;
    let soilWithNeighbors = 0;
    let moss = 0;
    let mossWithNeighbors = 0;
    for (let iz = 1; iz < HVP_SOURCE_SIZE_Z - 1; iz += 1) {
      for (let ix = 1; ix < HVP_SOURCE_SIZE_X - 1; ix += 1) {
        let top = -1;
        for (let iy = HVP_SOURCE_SIZE_Y - 1; iy >= 0; iy -= 1) {
          if (at(ix, iy, iz) !== HVP_SLOT_KNOWN_AIR) {
            top = iy;
            break;
          }
        }
        if (top < 0) {
          continue;
        }
        const slot = at(ix, top, iz);
        if (slot !== HVP_SLOT_SOIL && slot !== HVP_SLOT_MOSS) {
          continue;
        }
        const neighbors = [
          at(ix - 1, top, iz),
          at(ix + 1, top, iz),
          at(ix, top, iz - 1),
          at(ix, top, iz + 1)
        ];
        // Compare against the same-height neighbor columns, tolerating one
        // microstep of terrace difference in either direction.
        const countAt = (jx: number, jz: number): number => {
          for (let jy = Math.min(HVP_SOURCE_SIZE_Y - 1, top + 2); jy >= Math.max(0, top - 2); jy -= 1) {
            const value = at(jx, jy, jz);
            if (value !== HVP_SLOT_KNOWN_AIR) {
              return value;
            }
          }
          return HVP_SLOT_KNOWN_AIR;
        };
        void neighbors;
        const same = [countAt(ix - 1, iz), countAt(ix + 1, iz), countAt(ix, iz - 1), countAt(ix, iz + 1)]
          .filter((value) => value === slot).length;
        if (slot === HVP_SLOT_SOIL) {
          soil += 1;
          if (same >= 2) {
            soilWithNeighbors += 1;
          }
        } else {
          moss += 1;
          if (same >= 2) {
            mossWithNeighbors += 1;
          }
        }
      }
    }
    expect(soil).toBeGreaterThan(1_000);
    expect(moss).toBeGreaterThan(1_000);
    expect(soilWithNeighbors / soil).toBeGreaterThan(0.6);
    expect(mossWithNeighbors / moss).toBeGreaterThan(0.6);
  });
});

describe("HVP R2 broken hill silhouettes at authored positions", () => {
  it("keeps authored peaks while breaking the outline with notches", () => {
    const peaks: Array<{ x: number; z: number; min: number }> = [
      { x: -10, z: -5, min: 3.0 },
      { x: -9, z: 8, min: 2.4 },
      { x: 9, z: 4, min: 2.0 }
    ];
    for (const peak of peaks) {
      const column = readHvpSourceColumnWorld(peak.x, peak.z);
      expect(column.topMeters).toBeGreaterThan(peak.min);
      expect(column.topMeters).toBeLessThanOrEqual(5.5);
    }
    // Notch witness: at fixed mid-flank radius the notched bearing reads far
    // lower than both flanks (deterministic authored bearings on lobe highs).
    const notchRatio = (
      cx: number,
      cz: number,
      notch: number,
      flankA: number,
      flankB: number
    ): number => {
      const at = (bearing: number): number =>
        readHvpSourceColumnWorld(cx + Math.cos(bearing) * 3.0, cz + Math.sin(bearing) * 3.0).topMeters;
      const floor = at(notch);
      return floor / Math.min(at(flankA), at(flankB));
    };
    expect(notchRatio(-10, -5, Math.PI * 0.58, Math.PI * 0.4, Math.PI * 0.7)).toBeLessThan(0.7);
    expect(notchRatio(-9, 8, Math.PI * 0.65, Math.PI * 0.5, Math.PI * 0.8)).toBeLessThan(0.7);
    expect(notchRatio(9, 4, Math.PI * 1.52, Math.PI * 1.3, Math.PI * 1.7)).toBeLessThan(0.7);
  });
});

describe("HVP R2 authority join continuity", () => {
  it("matches tops and slots across all four seams within one microstep", () => {
    const mismatches: string[] = [];
    const check = (insideX: number, insideZ: number, outsideX: number, outsideZ: number): void => {
      const inside = readHvpSourceColumnWorld(insideX, insideZ);
      const outside = readHvpSourceColumnWorld(outsideX, outsideZ);
      // Terrace contract bound: seam neighbors are ordinary neighbors, so at
      // most one 0.5 m terrace step apart. Gap/overlap freedom additionally
      // comes from the shared grid plus ghost culling (see culling test).
      if (Math.abs(inside.topMeters - outside.topMeters) > 0.51) {
        mismatches.push(`top ${insideX},${insideZ}=${inside.topMeters} vs ${outsideX},${outsideZ}=${outside.topMeters}`);
      }
      const band = (top: number): string => {
        if (top < 0) {
          return "wet";
        }
        if (top < 0.375) {
          return "wet";
        }
        return "dry";
      };
      if (inside.slot !== outside.slot && band(inside.topMeters) === band(outside.topMeters)) {
        const soilMoss = (slot: number): boolean => slot === HVP_SLOT_SOIL || slot === HVP_SLOT_MOSS;
        if (!(soilMoss(inside.slot) && soilMoss(outside.slot))) {
          mismatches.push(`slot ${insideX},${insideZ}=${inside.slot} vs ${outsideX},${outsideZ}=${outside.slot}`);
        }
      }
    };
    for (const z of [-12, -6, 0, 6, 12]) {
      check(15.9375, z, 16.0625, z);
      check(-15.9375, z, -16.0625, z);
    }
    for (const x of [-12, -6, 0, 6, 12]) {
      check(x, 15.9375, x, 16.0625);
      check(x, -15.9375, x, -16.0625);
    }
    expect(mismatches).toEqual([]);
  });

  it("culls hidden join faces while conserving every column top", () => {
    const plain = meshHvpCoastSource(prepared, {}, { joinBandMeters: 0 });
    const culled = meshHvpCoastSource(prepared);
    expect(culled.unitFaceCount).toBeLessThan(plain.unitFaceCount);
    // Boundary-scale sanity: culling removes the hidden seam walls (tens of
    // thousands of unit faces on four 256-column planes), never the terrain.
    const removed = plain.unitFaceCount - culled.unitFaceCount;
    expect(removed).toBeGreaterThan(10_000);
    expect(removed).toBeLessThan(100_000);
    const seamSides = (mesh: { positions: Float32Array; normals: Float32Array }): number => {
      let count = 0;
      for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
        const x = mesh.positions[vertex]!;
        const z = mesh.positions[vertex + 2]!;
        const nx = mesh.normals[vertex]!;
        const nz = mesh.normals[vertex + 2]!;
        const onXSeam = (x === 16 || x === -16) && Math.abs(nx) === 1;
        const onZSeam = (z === 16 || z === -16) && Math.abs(nz) === 1;
        if (onXSeam || onZSeam) {
          count += 1;
        }
      }
      return count;
    };
    expect(seamSides(plain)).toBeGreaterThan(0);
    // Exact independent oracle: every culled unit face is a solid authority
    // cell hidden behind solid join truth, recomputed from public reads.
    const topAt = (x: number, z: number): number => readHvpSourceColumnWorld(x, z).topMeters;
    let expectedRemoved = 0;
    for (let iz = 0; iz < 256; iz += 1) {
      const zc = -16 + (iz + 0.5) * 0.125;
      for (let iy = 0; iy < 128; iy += 1) {
        const cellTop = -8 + (iy + 1) * 0.125;
        if (prepared.readSlot(255, iy, iz) !== 0 && cellTop <= topAt(16.0625, zc) + 1e-9) {
          expectedRemoved += 1;
        }
        if (prepared.readSlot(0, iy, iz) !== 0 && cellTop <= topAt(-16.0625, zc) + 1e-9) {
          expectedRemoved += 1;
        }
      }
    }
    for (let ix = 0; ix < 256; ix += 1) {
      const xc = -16 + (ix + 0.5) * 0.125;
      for (let iy = 0; iy < 128; iy += 1) {
        const cellTop = -8 + (iy + 1) * 0.125;
        if (prepared.readSlot(ix, iy, 255) !== 0 && cellTop <= topAt(xc, 16.0625) + 1e-9) {
          expectedRemoved += 1;
        }
        if (prepared.readSlot(ix, iy, 0) !== 0 && cellTop <= topAt(xc, -16.0625) + 1e-9) {
          expectedRemoved += 1;
        }
      }
    }
    expect(removed).toBe(expectedRemoved);
  }, 120_000);

  it("emits only exposed height differences on both authority/join seam directions", () => {
    assertSeam(meshHvpCoastSource(prepared), meshHvpJoinRing(prepared), 16);
  }, 120_000);

  it("meshes the join ring from the same source with bound material roles", () => {
    const join = meshHvpJoinRing(prepared);
    expect(join.sourceDigest).toBe(prepared.sourceDigest);
    expect(join.faceCount).toBeGreaterThan(100);
    const uniqueSlots = [...new Set(join.materialRanges.map((range) => range.slot))].sort();
    expect(uniqueSlots).toEqual([1, 2, 3, 4]);
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

describe("HVP R2 single water plane with no overlap", () => {
  it("covers the authority and the continuation at y=0 from one bound mask", () => {
    const mask = deriveHvpWaterMask(prepared);
    expect(mask.sourceDigest).toBe(prepared.sourceDigest);
    expect(mask.outer.halfMeters).toBe(240);
    expect(mask.outer.cellMeters).toBe(0.5);
    expect(mask.waterCellCount).toBeGreaterThan(3_000);
    expect(mask.outer.waterCellCount).toBeGreaterThan(100);
    const water = meshHvpWaterMask(mask);
    expect(water.sourceDigest).toBe(mask.digest);
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
    expect(area).toBeLessThan(480 * 480);
  });
});

describe("HVP R2 far field from the same macro descriptor", () => {
  it("derives staggered landforms from versioned source math, not proxy cakes", () => {
    const far = meshHvpFarField(prepared);
    expect(far.sourceDigest).toBe(prepared.sourceDigest);
    expect(far.positions.length).toBeGreaterThan(0);
    let maxY = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let islandWitness = false;
    for (let index = 0; index < far.positions.length; index += 3) {
      const x = far.positions[index]!;
      const y = far.positions[index + 1]!;
      const z = far.positions[index + 2]!;
      expect(Number.isFinite(y)).toBe(true);
      if (y > maxY) {
        maxY = y;
      }
      if (y < minY) {
        minY = y;
      }
      const nearIsland =
        (Math.abs(x - 55) < 6 && Math.abs(z - 25) < 6 && y > 4)
        || (Math.abs(x + 52) < 6 && Math.abs(z + 30) < 6 && y > 4)
        || (Math.abs(x - 8) < 6 && Math.abs(z - 68) < 6 && y > 3);
      if (nearIsland) {
        islandWitness = true;
      }
    }
    expect(maxY).toBeGreaterThan(5);
    expect(minY).toBeLessThan(0);
    expect(islandWitness).toBe(true);
  });

  it("emits exact source terrace heights on far footprints, including fractional border tops", () => {
    const tops = rasterTops(emittedQuads(meshHvpFarField(prepared)), 240, 1);
    let mismatches = 0;
    let fractional = 0;
    for (let x = -239.5; x < 240; x += 1) {
      for (let z = -239.5; z < 240; z += 1) {
        const index = (z + 239.5) * tops.dim + x + 239.5;
        if (Math.abs(x) < 20 && Math.abs(z) < 20) {
          if (tops.coverage[index] !== 0) {
            mismatches += 1;
          }
          continue;
        }
        const expected = readHvpSourceColumnWorld(x, z).topMeters;
        if (tops.coverage[index] !== 1 || tops.heights[index] !== expected) {
          mismatches += 1;
        }
        if (Math.max(Math.abs(x), Math.abs(z)) === 20.5 && expected % 1 !== 0) {
          fractional += 1;
        }
      }
    }
    expect(fractional).toBeGreaterThan(0);
    expect(mismatches).toBe(0);
  });

  it("keeps soil and moss in authority/join while the far proxy carries limestone bands only", () => {
    // Documented far simplification: the noneditable 1 m proxy downgrades
    // fine soil/moss to limestone-dry; authority and join retain them. The
    // dry-land proxy policy does not authorize a submerged wet-role mismatch.
    const slotsOf = (mesh: { materialRanges: readonly { slot: number }[] }): number[] =>
      [...new Set(mesh.materialRanges.map((range) => range.slot))].sort((left, right) => left - right);
    expect(slotsOf(meshHvpCoastSource(prepared))).toEqual([1, 2, 3, 4]);
    expect(slotsOf(meshHvpJoinRing(prepared))).toEqual([1, 2, 3, 4]);
    const farSlots = slotsOf(meshHvpFarField(prepared));
    expect(farSlots.length).toBeGreaterThan(0);
    for (const slot of farSlots) {
      expect([1, 2]).toContain(slot);
    }
    expect(farSlots).not.toContain(HVP_SLOT_SOIL);
    expect(farSlots).not.toContain(HVP_SLOT_MOSS);
  }, 120_000);

  it("reports a real far face count while keeping the conservative transient estimate", () => {
    const far = meshHvpFarField(prepared, 21);
    expect(far.faceCount).toBeGreaterThan(0);
    expect(far.unitFaceCount).toBe(far.faceCount);
    const arrayBytes = (far.positions.length + far.normals.length + far.indices.length) * 8;
    expect(far.tempEstimateBytes).toBeGreaterThan(far.faceCount * (8 + 96) + arrayBytes);
  });

  it.each([
    [21,"b8d9cb0a7e3704697584e9e929bb1bb3c83de2ab7116e10b2711e715ed9191ed"],
    [21.5,"9440bab9193f4c75011dcc28c8a875ff986950372ec4dd10780b50206ab993f2"],
    [240,"8f0ae7e408a3f8856a417fad8541b15f2dde401cd7d4909fc02b23422509c962"]
  ] as const)("preserves pre-optimization far projection bytes (%s m)",(half,expected)=>{
    const mesh=meshHvpFarField(prepared,half),hash=createHash("sha256");
    for(const a of [mesh.positions,mesh.normals,mesh.indices]){hash.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}
    hash.update(JSON.stringify({ranges:mesh.materialRanges,bounds:mesh.boundsMeters,faces:mesh.faceCount,unitFaces:mesh.unitFaceCount}));
    expect(hash.digest("hex")).toBe(expected);
  },120_000);
  it("rejects invalid far footprint grids before allocating the height cache",()=>{
    for(const half of [0,-1,Infinity,NaN,.125,10_000]){expect(()=>meshHvpFarField(prepared,half)).toThrow(/BudgetExceeded/);}
  });

  it("emits only exposed height differences on both join/far seam directions", () => {
    assertSeam(meshHvpJoinRing(prepared), meshHvpFarField(prepared), 20);
  }, 120_000);

  it.each([
    { name: "authority", half: 16, cell: 0.125, hole: 0, mesh: meshHvpCoastSource },
    { name: "join", half: 20, cell: 0.125, hole: 16, mesh: meshHvpJoinRing },
    { name: "far", half: 240, cell: 0.5, hole: 20, mesh: meshHvpFarField }
  ])("partitions installed water against actual land tops at every $name footprint", (region) => {
    const water = emittedQuads(meshHvpWaterMask(deriveHvpWaterMask(prepared)));
    const land = rasterTops(emittedQuads(region.mesh(prepared)), region.half, region.cell);
    const wet = rasterTops(water, region.half, region.cell);
    let mismatches = 0;
    for (let x = -region.half + region.cell / 2; x < region.half; x += region.cell) {
      for (let z = -region.half + region.cell / 2; z < region.half; z += region.cell) {
        const index = Math.floor((z + region.half) / region.cell) * land.dim + Math.floor((x + region.half) / region.cell);
        if (Math.abs(x) < region.hole && Math.abs(z) < region.hole) {
          if (land.coverage[index] !== 0) {
            mismatches += 1;
          }
          continue;
        }
        let expectedTops=1,highest=land.heights[index]!;
        if(region.name==="authority"){
          expectedTops=0;highest=-Infinity;
          const ix=Math.floor((x+16)*8),iz=Math.floor((z+16)*8);
          for(let iy=0;iy<128;iy+=1){
            if(prepared.readSlot(ix,iy,iz)!==0&&(iy===127||prepared.readSlot(ix,iy+1,iz)===0)){
              expectedTops+=1;highest=-8+(iy+1)*.125;
            }
          }
        }
        if (land.coverage[index] !== expectedTops || land.heights[index]!==highest || wet.coverage[index] !== (highest < 0 ? 1 : 0)
          || (wet.coverage[index] !== 0 && wet.heights[index] !== 0)) {
          mismatches += 1;
        }
      }
    }
    expect(mismatches).toBe(0);
  }, 120_000);
});

describe("HVP R2 ambient occlusion in the greedy core", () => {
  it("uses non-emitting in-grid neighbors for the same AO as visible occupancy", () => {
    const mesh = (silent: boolean) => meshHvpOccupancy({
      sizeX: 3, sizeY: 3, sizeZ: 3, cellMeters: 1,
      originMeters: { x: 0, y: 0, z: 0 },
      slotAt: (x, y, z) => (x === 1 && y === 0 && z === 1)
        || (!silent && x === 0 && y === 1 && z === 1) ? 1 : 0,
      silentSolidAt: (x, y, z) => silent && x === 0 && y === 1 && z === 1
    }, undefined, "fixture", "fixture", { ao: true });
    const topColors = (value: ReturnType<typeof mesh>) => {
      const colors: number[] = [];
      for (let i = 0; i < value.positions.length; i += 3) {
        if (value.normals[i + 1] === 1 && value.positions[i + 1] === 1) {
          colors.push(value.colors![i]!);
        }
      }
      return colors;
    };
    const visible = topColors(mesh(false));
    expect(visible.some((value) => value < 1)).toBe(true);
    expect(topColors(mesh(true))).toEqual(visible);
  });

  const lFixture = [
    { x: 0, y: 0, z: 0, slot: 1 },
    { x: 1, y: 0, z: 0, slot: 1 },
    { x: 0, y: 0, z: 1, slot: 1 },
    { x: 0, y: 1, z: 0, slot: 1 }
  ];

  it("attaches exact factors to the correct world corners on every face", () => {
    // Fixture: A=(0,0,0) floor, B=(0,1,0) wall on A, E=(1,0,0) floor east.
    // Hand-derived from the sample geometry (no bridge table): B's +x face
    // sees E at two corners (AO 2), E's +y face sees wall B at two corners.
    const wallFixture = [
      { x: 0, y: 0, z: 0, slot: 1 },
      { x: 0, y: 1, z: 0, slot: 1 },
      { x: 1, y: 0, z: 0, slot: 1 }
    ];
    const mesh = meshHvpTestCells(wallFixture, 1, { ao: true });
    expect(mesh.colors).not.toBeNull();
    const at = (nx: number, ny: number, nz: number): Map<string, number> => {
      const found = new Map<string, number>();
      for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
        if (
          mesh.normals[vertex] === nx && mesh.normals[vertex + 1] === ny && mesh.normals[vertex + 2] === nz
        ) {
          found.set(
            `${mesh.positions[vertex]},${mesh.positions[vertex + 1]},${mesh.positions[vertex + 2]}`,
            mesh.colors![vertex]
          );
        }
      }
      return found;
    };
    const closeTo = (actual: number | undefined, expected: number): void => {
      expect(actual).toBeDefined();
      expect(Math.abs(actual! - expected)).toBeLessThan(1e-6);
    };
    // Face 1 (+x): B's shaded quad plus E's open quad.
    const plusX = at(1, 0, 0);
    expect(plusX.size).toBe(8);
    closeTo(plusX.get("1,1,0"), 0.8);
    closeTo(plusX.get("1,2,0"), 1);
    closeTo(plusX.get("1,2,1"), 1);
    closeTo(plusX.get("1,1,1"), 0.8);
    closeTo(plusX.get("2,0,0"), 1);
    closeTo(plusX.get("2,1,0"), 1);
    closeTo(plusX.get("2,1,1"), 1);
    closeTo(plusX.get("2,0,1"), 1);
    // Face 2 (-y): nothing below, every bottom vertex stays open.
    // A and E bottoms share one AO signature and merge into a single quad.
    const minusY = at(0, -1, 0);
    expect(minusY.size).toBe(4);
    for (const value of minusY.values()) {
      closeTo(value, 1);
    }
    // Face 4 (-z): open outward. A/B merge and E stands alone, sharing the
    // (1,0,0) corner, so seven unique vertices carry factors here.
    const minusZ = at(0, 0, -1);
    expect(minusZ.size).toBe(7);
    for (const value of minusZ.values()) {
      closeTo(value, 1);
    }
    // Faces 0/3/5 controls: open outward on this fixture, all factors 1.
    for (const [nx, ny, nz] of [[-1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) {
      const faceVerts = at(nx, ny, nz);
      expect(faceVerts.size).toBeGreaterThan(0);
      if (nx === 0 && ny === 1 && nz === 0) {
        // E's top sees wall B at two corners; B's own top is fully open.
        // Different slices keep the two quads apart: eight vertices total.
        expect(faceVerts.size).toBe(8);
        closeTo(faceVerts.get("1,1,0"), 0.8);
        closeTo(faceVerts.get("1,1,1"), 0.8);
        closeTo(faceVerts.get("2,1,1"), 1);
        closeTo(faceVerts.get("2,1,0"), 1);
        closeTo(faceVerts.get("0,2,0"), 1);
        closeTo(faceVerts.get("0,2,1"), 1);
        closeTo(faceVerts.get("1,2,1"), 1);
        closeTo(faceVerts.get("1,2,0"), 1);
      } else {
        for (const value of faceVerts.values()) {
          closeTo(value, 1);
        }
      }
    }
  });

  it("emits no color buffer without AO and grayscale AO colors with AO", () => {
    const plain = meshHvpTestCells(lFixture, 1);
    expect(plain.colors).toBeNull();
    const shaded = meshHvpTestCells(lFixture, 1, { ao: true });
    expect(shaded.colors).not.toBeNull();
    expect(shaded.colors!.length).toBe(shaded.positions.length);
    expect(shaded.unitFaceCount).toBe(plain.unitFaceCount);
    expect(shaded.faceCount).toBeGreaterThanOrEqual(plain.faceCount);
    for (const value of shaded.colors!) {
      const quantized = [0.4, 0.6, 0.8, 1].some((level) => Math.abs(level - value) < 0.002);
      expect(quantized, `AO factor ${value} must be one of 0.4/0.6/0.8/1.0`).toBe(true);
    }
    let minimum = 1;
    let maximum = 0;
    for (const value of shaded.colors!) {
      if (value < minimum) {
        minimum = value;
      }
      if (value > maximum) {
        maximum = value;
      }
    }
    expect(minimum).toBeLessThan(1);
    expect(maximum).toBe(1);
  });

  it("keeps outward winding with flipped AO diagonals", () => {
    const shaded = meshHvpTestCells(lFixture, 1, { ao: true });
    for (let face = 0; face < shaded.faceCount; face += 1) {
      const base = face * 12;
      const ax = shaded.positions[base + 3]! - shaded.positions[base]!;
      const ay = shaded.positions[base + 4]! - shaded.positions[base + 1]!;
      const az = shaded.positions[base + 5]! - shaded.positions[base + 2]!;
      const bx = shaded.positions[base + 6]! - shaded.positions[base]!;
      const by = shaded.positions[base + 7]! - shaded.positions[base + 1]!;
      const bz = shaded.positions[base + 8]! - shaded.positions[base + 2]!;
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(length).toBeGreaterThan(0);
      const storedX = shaded.normals[base]!;
      const storedY = shaded.normals[base + 1]!;
      const storedZ = shaded.normals[base + 2]!;
      expect((nx * storedX + ny * storedY + nz * storedZ) / length).toBeCloseTo(1, 6);
    }
  });

  it("treats out-of-coverage as non-occluding instead of inventing shadow", () => {
    const single = meshHvpTestCells([{ x: 0, y: 0, z: 0, slot: 2 }], 1, { ao: true });
    expect(single.colors).not.toBeNull();
    for (const value of single.colors!) {
      expect(value).toBe(1);
    }
  });

  it("shades a concave corner below its same-lit open neighbor", () => {
    // Same wall fixture as the exact oracle: concave +x corners read 0.8
    // while open corners of the same faces read 1.0 under identical light.
    const wallFixture = [
      { x: 0, y: 0, z: 0, slot: 1 },
      { x: 0, y: 1, z: 0, slot: 1 },
      { x: 1, y: 0, z: 0, slot: 1 }
    ];
    const mesh = meshHvpTestCells(wallFixture, 1, { ao: true });
    const at = (x: number, y: number, z: number): number[] => {
      const found: number[] = [];
      for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
        if (
          mesh.normals[vertex] === 1 && mesh.normals[vertex + 1] === 0 && mesh.normals[vertex + 2] === 0
          && mesh.positions[vertex] === x && mesh.positions[vertex + 1] === y && mesh.positions[vertex + 2] === z
        ) {
          found.push(mesh.colors![vertex]);
        }
      }
      return found;
    };
    const closeEnough = (values: number[], expected: number): void => {
      expect(values).toHaveLength(1);
      expect(Math.abs(values[0]! - expected)).toBeLessThan(1e-6);
    };
    closeEnough(at(1, 1, 0), 0.8);
    closeEnough(at(1, 2, 0), 1);
  });

  it("rejects uniform darkening on fully open small fixtures", () => {
    // Two open cubes: no occluders anywhere, so every AO factor must be 1.
    // A uniform-darkening defect (flat multiplier) fails here by construction.
    const open = meshHvpTestCells(
      [
        { x: 0, y: 0, z: 0, slot: 1 },
        { x: 3, y: 0, z: 0, slot: 1 }
      ],
      1,
      { ao: true }
    );
    expect(open.colors).not.toBeNull();
    expect(open.colors!.length).toBeGreaterThan(0);
    for (const value of open.colors!) {
      expect(value).toBe(1);
    }
  });

  it("binds production AO colors to the validated source", () => {
    const terrain = meshHvpCoastSource(prepared);
    expect(terrain.colors).not.toBeNull();
    expect(terrain.colors!.length).toBe(terrain.positions.length);
    let minimum = 1;
    let maximum = 0;
    for (const value of terrain.colors!) {
      if (value < minimum) {
        minimum = value;
      }
      if (value > maximum) {
        maximum = value;
      }
    }
    expect(minimum).toBeLessThan(1);
    expect(maximum).toBe(1);
  });
});

describe("HVP R2 product binding negatives", () => {
  it("rejects mismatched terrain and water products before publication", () => {
    const terrain = meshHvpCoastSource(prepared);
    const mask = deriveHvpWaterMask(prepared);
    const water = meshHvpWaterMask(mask);
    const join = meshHvpJoinRing(prepared);
    const far = meshHvpFarField(prepared);
    const bound = {
      prepared,
      terrainMesh: terrain,
      waterMask: mask,
      waterMesh: water,
      joinMesh: join,
      farMesh: far
    };
    expect(() => assertHvpProductsBound(bound)).not.toThrow();
    expect(() => assertHvpProductsBound({
      ...bound,
      terrainMesh: { ...terrain, sourceDigest: "00000000" }
    })).toThrow(/bound|digest|source/i);
    expect(() => assertHvpProductsBound({
      ...bound,
      waterMesh: { ...water, sourceDigest: "00000000" }
    })).toThrow(/bound|digest|source/i);
    expect(() => assertHvpProductsBound({
      ...bound,
      joinMesh: { ...join, sourceDigest: "00000000" }
    })).toThrow(/bound|digest|source/i);
  }, 120_000);
});
