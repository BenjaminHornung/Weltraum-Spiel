/**
 * Block ambient occlusion for product voxel meshers.
 *
 * Provenance: adapted from hestia-voxel-kernel-lab @ 94bd8acd
 * (#VOXEL-LAB-004), files src/voxel/blockAo.ts (vertexAo truth table, face
 * sample coordinates, AO4 pack/signature/diagonal rule) and
 * src/render-three/aoVertexColors.ts (linear AO_DARKNESS factor 0.60).
 * Lab palette, debug modes, UI, and classes were NOT taken.
 *
 * Adaptations for the product core:
 * - Face/corner tables are ordered for the HVP greedy core
 *   (-x/+x/-y/+y/-z/+z faces, emitQuad corner order). The HVP_FACE_LAB_VERTEX
 *   map below is the deliberate bridge to the Lab vertex order; the unit
 *   tests pin every face/corner against Lab's absolute sample vectors.
 * - AO expresses only as grayscale Float32 RGB modulation factors derived
 *   from the shared look baseColor downstream. No palette is duplicated or
 *   multiplied here, and no physical or source material registry changes.
 * - Out-of-coverage samples contribute no occlusion (visually fail-open,
 *   never invented shadow); cell occupancy truth stays untouched.
 */

export const HVP_AO_DARKNESS = 0.6;

export type HvpAoFace = 0 | 1 | 2 | 3 | 4 | 5;
export type HvpAoLevel = 0 | 1 | 2 | 3;
export type HvpAoQuad = readonly [HvpAoLevel, HvpAoLevel, HvpAoLevel, HvpAoLevel];

export const hvpVertexAo = (side1: boolean, side2: boolean, corner: boolean): HvpAoLevel => {
  if (side1 && side2) {
    return 0;
  }
  return (3 - Number(side1) - Number(side2) - Number(corner)) as HvpAoLevel;
};

/** Linear per-vertex darkness factor; 3 is fully open, 0 is fully occluded. */
export const hvpAoDarknessFactor = (level: HvpAoLevel): number => {
  if (!Number.isInteger(level) || level < 0 || level > 3) {
    throw new RangeError(`AO level must be an integer in 0..3, saw ${String(level)}`);
  }
  return 1 - (HVP_AO_DARKNESS * (3 - level)) / 3;
};

interface HvpAoFaceDefinition {
  readonly neighbor: readonly [number, number, number];
  readonly tangent1: readonly [number, number, number];
  readonly tangent2: readonly [number, number, number];
  /** Lab vertex index for each HVP corner 0..3 (corner-order bridge). */
  readonly labVertex: readonly [number, number, number, number];
}

const FACE_SIGNS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-1, -1], [-1, 1], [1, 1], [1, -1]],
  [[-1, 1], [-1, -1], [1, -1], [1, 1]],
  [[-1, 1], [-1, -1], [1, -1], [1, 1]],
  [[-1, -1], [-1, 1], [1, 1], [1, -1]],
  [[1, -1], [-1, -1], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [1, 1], [-1, 1]]
];

const HVP_FACES: ReadonlyArray<HvpAoFaceDefinition> = [
  {
    neighbor: [-1, 0, 0],
    tangent1: [0, 1, 0],
    tangent2: [0, 0, 1],
    labVertex: [0, 1, 2, 3]
  },
  {
    neighbor: [1, 0, 0],
    tangent1: [0, 1, 0],
    tangent2: [0, 0, 1],
    labVertex: [1, 2, 3, 0]
  },
  {
    neighbor: [0, -1, 0],
    tangent1: [1, 0, 0],
    tangent2: [0, 0, 1],
    labVertex: [1, 2, 3, 0]
  },
  {
    neighbor: [0, 1, 0],
    tangent1: [1, 0, 0],
    tangent2: [0, 0, 1],
    labVertex: [0, 1, 2, 3]
  },
  {
    neighbor: [0, 0, -1],
    tangent1: [1, 0, 0],
    tangent2: [0, 1, 0],
    labVertex: [1, 2, 3, 0]
  },
  {
    neighbor: [0, 0, 1],
    tangent1: [1, 0, 0],
    tangent2: [0, 1, 0],
    labVertex: [0, 1, 2, 3]
  }
];

export interface HvpAoSamples {
  readonly side1: readonly [number, number, number];
  readonly side2: readonly [number, number, number];
  readonly corner: readonly [number, number, number];
  readonly faceAir: readonly [number, number, number];
}

/**
 * Absolute integer sample cells for one HVP-ordered face corner: the air
 * cell in front of the face plus the two edge and one diagonal occluders.
 * Matches Lab faceAoSampleCoordinates through the corner bridge above.
 */
export const hvpFaceAoSamples = (
  cellX: number,
  cellY: number,
  cellZ: number,
  face: HvpAoFace,
  corner: number
): HvpAoSamples => {
  if (!Number.isInteger(corner) || corner < 0 || corner > 3) {
    throw new RangeError(`AO corner must be in 0..3, saw ${String(corner)}`);
  }
  const definition = HVP_FACES[face]!;
  const labVertex = definition.labVertex[corner]!;
  const signs = FACE_SIGNS[face]![labVertex]!;
  const sign1 = signs[0]!;
  const sign2 = signs[1]!;
  const faceAir: [number, number, number] = [
    cellX + definition.neighbor[0]!,
    cellY + definition.neighbor[1]!,
    cellZ + definition.neighbor[2]!
  ];
  const side1: [number, number, number] = [
    faceAir[0] + definition.tangent1[0]! * sign1,
    faceAir[1] + definition.tangent1[1]! * sign1,
    faceAir[2] + definition.tangent1[2]! * sign1
  ];
  const side2: [number, number, number] = [
    faceAir[0] + definition.tangent2[0]! * sign2,
    faceAir[1] + definition.tangent2[1]! * sign2,
    faceAir[2] + definition.tangent2[2]! * sign2
  ];
  return Object.freeze({
    faceAir: Object.freeze(faceAir),
    side1: Object.freeze(side1),
    side2: Object.freeze(side2),
    corner: Object.freeze([
      side1[0] + definition.tangent2[0]! * sign2,
      side1[1] + definition.tangent2[1]! * sign2,
      side1[2] + definition.tangent2[2]! * sign2
    ] as const)
  });
};

export const hvpPackAoSignature = (ao: readonly number[]): number => {
  if (ao.length !== 4 || ao.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) {
    throw new RangeError("AO4 requires exactly four integer levels in 0..3.");
  }
  return ao[0]! | (ao[1]! << 2) | (ao[2]! << 4) | (ao[3]! << 6);
};

export const hvpUnpackAoSignature = (signature: number): HvpAoQuad => {
  if (!Number.isSafeInteger(signature) || signature < 0 || signature > 0xff) {
    throw new RangeError(`AO4 signature must be in 0..255, saw ${String(signature)}`);
  }
  return Object.freeze([
    ((signature & 3) as HvpAoLevel),
    (((signature >> 2) & 3) as HvpAoLevel),
    (((signature >> 4) & 3) as HvpAoLevel),
    (((signature >> 6) & 3) as HvpAoLevel)
  ]);
};

export const hvpUsesFlippedDiagonal = (ao: HvpAoQuad): boolean => ao[0] + ao[2] > ao[1] + ao[3];

/**
 * Triangle index pattern for one emitted quad in HVP corner order, choosing
 * the Lab diagonal rule on the Lab-ordered AO levels. Both patterns are
 * verified outward for every face by unit tests.
 */
export const hvpQuadIndexPattern = (face: HvpAoFace, ao: HvpAoQuad): readonly [number, number, number, number, number, number] => {
  const bridge = HVP_FACES[face]!.labVertex;
  const labAo = Object.freeze([ao[bridge.indexOf(0)]!, ao[bridge.indexOf(1)]!, ao[bridge.indexOf(2)]!, ao[bridge.indexOf(3)]!]) as unknown as HvpAoQuad;
  const inverse = (labVertex: number): number => bridge.indexOf(labVertex);
  if (hvpUsesFlippedDiagonal(labAo)) {
    return Object.freeze([
      inverse(0),
      inverse(1),
      inverse(3),
      inverse(1),
      inverse(2),
      inverse(3)
    ]);
  }
  return Object.freeze([
    inverse(0),
    inverse(1),
    inverse(2),
    inverse(0),
    inverse(2),
    inverse(3)
  ]);
};
