import { describe, expect, it } from "vitest";
import { createMacroWorldDescriptor } from "../../src/voxel-v2/domain/macroDescriptor";
import { createVoxelV2RadialProjection } from "../../src/voxel-v2/render-three/voxelV2RenderProjection";

describe("Voxel V2 radial render projection", () => {
  it("is deterministic and keeps its outer boundary circular", () => {
    const descriptor = createMacroWorldDescriptor("projection-test", "macro-v1");
    const first = createVoxelV2RadialProjection(descriptor, { radiusMeters: 96, radialSegments: 32, rings: 4 });
    const second = createVoxelV2RadialProjection(createMacroWorldDescriptor("projection-test", "macro-v1"), {
      radiusMeters: 96,
      radialSegments: 32,
      rings: 4
    });

    expect(Object.isFrozen(first)).toBe(true);
    expect(Array.from(first.positions)).toEqual(Array.from(second.positions));
    expect(Array.from(first.indices)).toEqual(Array.from(second.indices));
    expect(Array.from(first.colors)).toEqual(Array.from(second.colors));
    expect(Array.from(first.waterMask)).toEqual(Array.from(second.waterMask));
    expect(first.indices.length).toBe(32 * 3 + 3 * 32 * 6);

    const outerStart = (1 + (first.rings - 1) * first.radialSegments) * 3;
    for (let segment = 0; segment < first.radialSegments; segment += 1) {
      const x = first.positions[outerStart + segment * 3]!;
      const z = first.positions[outerStart + segment * 3 + 2]!;
      expect(Math.hypot(x, z)).toBeCloseTo(first.radiusMeters, 4);
      expect(Math.min(Math.abs(x), Math.abs(z))).toBeLessThan(first.radiusMeters * 0.72);
    }

    for (let index = 0; index < first.indices.length; index += 3) {
      const a = first.indices[index]! * 3;
      const b = first.indices[index + 1]! * 3;
      const c = first.indices[index + 2]! * 3;
      const abX = first.positions[b]! - first.positions[a]!;
      const abZ = first.positions[b + 2]! - first.positions[a + 2]!;
      const acX = first.positions[c]! - first.positions[a]!;
      const acZ = first.positions[c + 2]! - first.positions[a + 2]!;
      expect(abZ * acX - abX * acZ).toBeGreaterThanOrEqual(0);
    }
  });

  it("generates a bounded annulus without center geometry", () => {
    const projection = createVoxelV2RadialProjection(createMacroWorldDescriptor("projection-test", "macro-v1"), {
      innerRadiusMeters: 40,
      radiusMeters: 96,
      radialSegments: 16,
      rings: 2
    });

    expect(projection.innerRadiusMeters).toBe(40);
    expect(projection.positions.length / 3).toBe(3 * 16);
    expect(projection.indices.length).toBe(2 * 16 * 6);
    expect(Math.hypot(projection.positions[0]!, projection.positions[2]!)).toBeCloseTo(40, 4);
    const outerStart = (2 * projection.radialSegments) * 3;
    expect(Math.hypot(projection.positions[outerStart]!, projection.positions[outerStart + 2]!)).toBeCloseTo(96, 4);
  });

  it("keeps projection bands overlapped across the bounded Near authority", () => {
    const descriptor = createMacroWorldDescriptor("projection-overlap", "macro-v1");
    const beauty = createVoxelV2RadialProjection(descriptor, { radiusMeters: 40, radialSegments: 32, rings: 4 });
    const mid = createVoxelV2RadialProjection(descriptor, { innerRadiusMeters: 28, radiusMeters: 96, radialSegments: 32, rings: 4 });
    const far = createVoxelV2RadialProjection(descriptor, { innerRadiusMeters: 92, radiusMeters: 460, radialSegments: 32, rings: 4 });

    expect(mid.innerRadiusMeters).toBeLessThan(32);
    expect(mid.innerRadiusMeters).toBeLessThan(beauty.radiusMeters);
    expect(far.innerRadiusMeters).toBeLessThan(mid.radiusMeters);
  });

  it("projects descriptor water and channel facts into the circular water pass", () => {
    const projection = createVoxelV2RadialProjection(
      createMacroWorldDescriptor("projection-test", "macro-v1"),
      { kind: "water", radiusMeters: 180, radialSegments: 48, rings: 6 }
    );

    expect(projection.kind).toBe("water");
    expect(projection.waterVertexCount).toBeGreaterThan(0);
    expect(projection.channelVertexCount).toBeGreaterThan(0);
    expect([...projection.positions].every(Number.isFinite)).toBe(true);
    expect([...projection.colors].every((value) => value >= 0 && value <= 255)).toBe(true);
  });

  it("keeps water topology restricted to all-water triangles", () => {
    const source = createMacroWorldDescriptor("projection-water-mask", "macro-v1");
    const descriptor = {
      ...source,
      sample: (xMeters: number, zMeters: number) => {
        const sample = source.sample(xMeters, zMeters);
        const isWater = xMeters > 0;
        return { ...sample, isWater, isChannel: false, waterDepthMeters: isWater ? 1 : 0 };
      }
    };
    const projection = createVoxelV2RadialProjection(descriptor, {
      kind: "water",
      radiusMeters: 24,
      radialSegments: 16,
      rings: 3
    });

    expect(projection.indices.length).toBeGreaterThan(0);
    for (const index of projection.indices) expect(projection.waterMask[index]).toBe(1);
    expect(projection.waterVertexCount).toBeGreaterThan(0);
    expect(projection.channelVertexCount).toBe(0);
  });

  it("emits no water triangles for dry-only samples", () => {
    const source = createMacroWorldDescriptor("projection-dry-mask", "macro-v1");
    const descriptor = {
      ...source,
      sample: (xMeters: number, zMeters: number) => ({
        ...source.sample(xMeters, zMeters),
        isWater: false,
        isChannel: false,
        waterDepthMeters: 0
      })
    };
    const projection = createVoxelV2RadialProjection(descriptor, {
      kind: "water",
      radiusMeters: 24,
      radialSegments: 16,
      rings: 3
    });

    expect(projection.waterVertexCount).toBe(0);
    expect(projection.indices).toHaveLength(0);
  });

  it("applies surface offsets to terrain water samples", () => {
    const source = createMacroWorldDescriptor("projection-water-offset", "macro-v1");
    const descriptor = {
      ...source,
      sample: (xMeters: number, zMeters: number) => ({
        ...source.sample(xMeters, zMeters),
        isWater: true,
        isChannel: false,
        waterDepthMeters: 1
      })
    };
    const base = createVoxelV2RadialProjection(descriptor, { radiusMeters: 8, radialSegments: 8, rings: 1 });
    const offset = createVoxelV2RadialProjection(descriptor, {
      radiusMeters: 8,
      radialSegments: 8,
      rings: 1,
      surfaceOffsetMeters: 0.25
    });

    expect(offset.positions[1]! - base.positions[1]!).toBeCloseTo(0.25, 5);
  });

  it("changes render-only content for a changed macro seed", () => {
    const first = createVoxelV2RadialProjection(createMacroWorldDescriptor("projection-a", "macro-v1"), {
      radiusMeters: 96,
      radialSegments: 24,
      rings: 3
    });
    const changed = createVoxelV2RadialProjection(createMacroWorldDescriptor("projection-b", "macro-v1"), {
      radiusMeters: 96,
      radialSegments: 24,
      rings: 3
    });

    expect(Array.from(changed.positions)).not.toEqual(Array.from(first.positions));
  });

  it("rejects invalid radial geometry instead of rewriting it", () => {
    const descriptor = createMacroWorldDescriptor("projection-test", "macro-v1");
    expect(() => createVoxelV2RadialProjection(descriptor, { radiusMeters: 0 })).toThrow(/positive radius/);
    expect(() => createVoxelV2RadialProjection(descriptor, { innerRadiusMeters: -1 })).toThrow(/non-negative inner radius/);
    expect(() => createVoxelV2RadialProjection(descriptor, { innerRadiusMeters: 96, radiusMeters: 96 })).toThrow(/smaller than the outer radius/);
    expect(() => createVoxelV2RadialProjection(descriptor, { centerX: Number.NaN })).toThrow(/finite/);
    expect(() => createVoxelV2RadialProjection(descriptor, { radialSegments: 4 })).toThrow(/8 segments/);
  });
});
