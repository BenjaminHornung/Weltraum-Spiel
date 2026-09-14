import { describe, expect, it } from "vitest";
import {
  HVP_AO_DARKNESS,
  hvpAoDarknessFactor,
  hvpFaceAoSamples,
  hvpPackAoSignature,
  hvpQuadIndexPattern,
  hvpUnpackAoSignature,
  hvpUsesFlippedDiagonal,
  hvpVertexAo,
  type HvpAoFace,
  type HvpAoLevel,
  type HvpAoQuad
} from "../../src/voxel/blockAmbientOcclusion";

/**
 * Lab oracle vectors below proved against
 * hestia-voxel-kernel-lab @ 94bd8acd tests/unit/palette-ao.test.ts
 * ("maps face %i vertices to independent exact AO sample offsets"):
 * expected[faceId][vertex] = [faceAir, side1, side2, corner] for cell origin.
 * Only the AO math and sample layout are reused; palette/debug/UI are not.
 */
const LAB_ORACLE: ReadonlyArray<ReadonlyArray<readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number]
]>> = [
  [
    [[-1, 0, 0], [-1, -1, 0], [-1, 0, -1], [-1, -1, -1]],
    [[-1, 0, 0], [-1, -1, 0], [-1, 0, 1], [-1, -1, 1]],
    [[-1, 0, 0], [-1, 1, 0], [-1, 0, 1], [-1, 1, 1]],
    [[-1, 0, 0], [-1, 1, 0], [-1, 0, -1], [-1, 1, -1]]
  ],
  [
    [[1, 0, 0], [1, -1, 0], [1, 0, 1], [1, -1, 1]],
    [[1, 0, 0], [1, -1, 0], [1, 0, -1], [1, -1, -1]],
    [[1, 0, 0], [1, 1, 0], [1, 0, -1], [1, 1, -1]],
    [[1, 0, 0], [1, 1, 0], [1, 0, 1], [1, 1, 1]]
  ],
  [
    [[0, -1, 0], [-1, -1, 0], [0, -1, 1], [-1, -1, 1]],
    [[0, -1, 0], [-1, -1, 0], [0, -1, -1], [-1, -1, -1]],
    [[0, -1, 0], [1, -1, 0], [0, -1, -1], [1, -1, -1]],
    [[0, -1, 0], [1, -1, 0], [0, -1, 1], [1, -1, 1]]
  ],
  [
    [[0, 1, 0], [-1, 1, 0], [0, 1, -1], [-1, 1, -1]],
    [[0, 1, 0], [-1, 1, 0], [0, 1, 1], [-1, 1, 1]],
    [[0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]],
    [[0, 1, 0], [1, 1, 0], [0, 1, -1], [1, 1, -1]]
  ],
  [
    [[0, 0, -1], [1, 0, -1], [0, -1, -1], [1, -1, -1]],
    [[0, 0, -1], [-1, 0, -1], [0, -1, -1], [-1, -1, -1]],
    [[0, 0, -1], [-1, 0, -1], [0, 1, -1], [-1, 1, -1]],
    [[0, 0, -1], [1, 0, -1], [0, 1, -1], [1, 1, -1]]
  ],
  [
    [[0, 0, 1], [-1, 0, 1], [0, -1, 1], [-1, -1, 1]],
    [[0, 0, 1], [1, 0, 1], [0, -1, 1], [1, -1, 1]],
    [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]],
    [[0, 0, 1], [-1, 0, 1], [0, 1, 1], [-1, 1, 1]]
  ]
];

describe("HVP product AO convention", () => {
  it("maps side/corner occupancy to the four Lab AO levels", () => {
    const cases: ReadonlyArray<readonly [boolean, boolean, boolean, number]> = [
      [false, false, false, 3],
      [false, false, true, 2],
      [true, false, false, 2],
      [false, true, false, 2],
      [true, false, true, 1],
      [false, true, true, 1],
      [true, true, false, 0],
      [true, true, true, 0]
    ];
    for (const [side1, side2, corner, expected] of cases) {
      expect(hvpVertexAo(side1, side2, corner)).toBe(expected);
    }
    expect(HVP_AO_DARKNESS).toBe(0.6);
    expect(hvpAoDarknessFactor(3)).toBe(1);
    expect(hvpAoDarknessFactor(2)).toBeCloseTo(0.8, 12);
    expect(hvpAoDarknessFactor(1)).toBeCloseTo(0.6, 12);
    expect(hvpAoDarknessFactor(0)).toBeCloseTo(0.4, 12);
    expect(() => hvpAoDarknessFactor(4 as HvpAoLevel)).toThrow(RangeError);
  });

  it("packs and unpacks every AO4 signature bijectively", () => {
    for (let signature = 0; signature < 256; signature += 1) {
      expect(hvpPackAoSignature(hvpUnpackAoSignature(signature))).toBe(signature);
    }
    expect(() => hvpPackAoSignature([3, 3, 3])).toThrow(RangeError);
    expect(() => hvpPackAoSignature([3, 3, 3, 4])).toThrow(RangeError);
    expect(() => hvpUnpackAoSignature(256)).toThrow(RangeError);
  });

  it("uses the deterministic normal or flipped diagonal rule", () => {
    expect(hvpUsesFlippedDiagonal([0, 3, 0, 3])).toBe(false);
    expect(hvpUsesFlippedDiagonal([3, 3, 3, 3])).toBe(false);
    expect(hvpUsesFlippedDiagonal([3, 0, 3, 0])).toBe(true);
  });

  it("samples the exact Lab offsets in HVP corner order for all six faces", () => {
    // Deliberate corner bridge under test (HVP corner -> Lab vertex):
    const bridge: ReadonlyArray<readonly [number, number, number, number]> = [
      [0, 1, 2, 3],
      [1, 2, 3, 0],
      [1, 2, 3, 0],
      [0, 1, 2, 3],
      [1, 2, 3, 0],
      [0, 1, 2, 3]
    ];
    for (let face = 0; face < 6; face += 1) {
      for (let corner = 0; corner < 4; corner += 1) {
        const samples = hvpFaceAoSamples(0, 0, 0, face as HvpAoFace, corner);
        const [faceAir, side1, side2, cornerCell] = LAB_ORACLE[face]![bridge[face]![corner]]!;
        expect(samples.faceAir).toEqual([...faceAir]);
        expect(samples.side1).toEqual([...side1]);
        expect(samples.side2).toEqual([...side2]);
        expect(samples.corner).toEqual([...cornerCell]);
      }
      expect(() => hvpFaceAoSamples(0, 0, 0, face as HvpAoFace, 4)).toThrow(RangeError);
    }
  });

  it("winds both diagonal patterns outward in HVP corner order for all faces", () => {
    const faceDefs: ReadonlyArray<{ axis: 0 | 1 | 2; row: 0 | 1 | 2; col: 0 | 1 | 2; delta: -1 | 1; normal: readonly [number, number, number]; rowFirst: boolean }> = [
      { axis: 0, row: 1, col: 2, delta: -1, normal: [-1, 0, 0], rowFirst: false },
      { axis: 0, row: 1, col: 2, delta: 1, normal: [1, 0, 0], rowFirst: true },
      { axis: 1, row: 0, col: 2, delta: -1, normal: [0, -1, 0], rowFirst: true },
      { axis: 1, row: 0, col: 2, delta: 1, normal: [0, 1, 0], rowFirst: false },
      { axis: 2, row: 0, col: 1, delta: -1, normal: [0, 0, -1], rowFirst: false },
      { axis: 2, row: 0, col: 1, delta: 1, normal: [0, 0, 1], rowFirst: true }
    ];
    const cornersOf = (face: number): Array<[number, number, number]> => {
      const def = faceDefs[face]!;
      const origins = [5, 6, 7];
      const plane = origins[def.axis]! + (def.delta === 1 ? 1 : 0);
      const row = [origins[def.row]!, origins[def.row]! + 2];
      const col = [origins[def.col]!, origins[def.col]! + 3];
      const spans: Array<[number, number]> = def.rowFirst
        ? [[row[0]!, col[0]!], [row[1]!, col[0]!], [row[1]!, col[1]!], [row[0]!, col[1]!]]
        : [[row[0]!, col[0]!], [row[0]!, col[1]!], [row[1]!, col[1]!], [row[1]!, col[0]!]];
      return spans.map(([r, c]) => {
        const corner: [number, number, number] = [plane, plane, plane];
        corner[def.axis] = plane;
        corner[def.row] = r;
        corner[def.col] = c;
        return corner;
      });
    };
    const cross = (a: [number, number, number], b: [number, number, number], c: [number, number, number]): [number, number, number] => {
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      return [
        ab[1]! * ac[2]! - ab[2]! * ac[1]!,
        ab[2]! * ac[0]! - ab[0]! * ac[2]!,
        ab[0]! * ac[1]! - ab[1]! * ac[0]!
      ];
    };
    for (let face = 0; face < 6; face += 1) {
      const corners = cornersOf(face);
      const normal = faceDefs[face]!.normal;
      for (const ao of [[3, 3, 3, 3], [3, 0, 3, 0]] as ReadonlyArray<HvpAoQuad>) {
        const pattern = hvpQuadIndexPattern(face as HvpAoFace, ao);
        for (const offset of [0, 3]) {
          const n = cross(corners[pattern[offset]!]!, corners[pattern[offset + 1]!]!, corners[pattern[offset + 2]!]!);
          expect(n.map((value) => (value === 0 ? 0 : value / Math.abs(value)))).toEqual([...normal]);
        }
      }
    }
  });
});
