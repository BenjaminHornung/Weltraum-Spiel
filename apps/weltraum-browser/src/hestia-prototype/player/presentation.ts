import { BoxGeometry, Color, Vector3 } from "three";
import type { HvpCompactMesh } from "../../hvp/hvpCoastMesher";
import { HVP_PLAYER_PROFILE } from "../physics/profile";

export const HVP_AVATAR_KEY = "hvp:player:avatar";

/** Render-only lag filter: never extrapolates or changes the solver position. */
export const createHvpPlayerVisualPose = () => {
  const position = new Vector3();
  let initialized = false;
  return {
    position,
    update(target: Readonly<{ x: number; y: number; z: number }>, seconds: number, reset = false): void {
      if (![target.x, target.y, target.z, seconds].every(Number.isFinite) || seconds < 0) {
        throw new RangeError("Invalid player presentation sample");
      }
      const distance = position.distanceTo(new Vector3(target.x, target.y, target.z));
      if (!initialized || reset || distance > 2) {
        position.set(target.x, target.y, target.z); initialized = true; return;
      }
      const alpha = 1 - Math.exp(-seconds / 0.045);
      position.lerp(new Vector3(target.x, target.y, target.z), alpha);
    }
  };
};

/** Small authored suit mesh at the capsule's real 1.8 m height, not a voxel source. */
export const createHvpAvatarMesh = (): HvpCompactMesh => {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  // Width/height/depth, then center relative to feet. All parts share one draw.
  const parts: readonly (readonly [number, number, number, number, number, number, number])[] = [
    [0.34, 0.32, 0.34, 0, 1.64, 0, 0xdee8e5],
    [0.29, 0.14, 0.025, 0, 1.65, -0.18, 0x155867],
    [0.45, 0.57, 0.28, 0, 1.18, 0, 0xcee2df],
    [0.25, 0.30, 0.06, 0, 1.21, -0.17, 0x268b8b],
    [0.34, 0.22, 0.27, 0, 0.79, 0, 0x305464],
    [0.17, 0.63, 0.19, -0.13, 0.39, 0, 0x54717b],
    [0.17, 0.63, 0.19, 0.13, 0.39, 0, 0x54717b],
    [0.20, 0.12, 0.29, -0.13, 0.06, -0.045, 0x263b47],
    [0.20, 0.12, 0.29, 0.13, 0.06, -0.045, 0x263b47],
    [0.14, 0.54, 0.16, -0.30, 1.17, 0, 0xd7e0d8],
    [0.14, 0.54, 0.16, 0.30, 1.17, 0, 0xd7e0d8],
    [0.14, 0.13, 0.17, -0.30, 0.84, 0, 0xba702c],
    [0.14, 0.13, 0.17, 0.30, 0.84, 0, 0xba702c],
    [0.32, 0.40, 0.16, 0, 1.2, 0.21, 0x37636c]
  ];
  for (const [w, h, d, x, y, z, tint] of parts) {
    const box = new BoxGeometry(w, h, d);
    const rgb = new Color(tint);
    try {
      const p = box.getAttribute("position"), n = box.getAttribute("normal"), base = positions.length / 3;
      for (let v = 0; v < p.count; v += 1) {
        positions.push(p.getX(v) + x, p.getY(v) + y - HVP_PLAYER_PROFILE.height / 2, p.getZ(v) + z);
        normals.push(n.getX(v), n.getY(v), n.getZ(v)); colors.push(rgb.r, rgb.g, rgb.b);
      }
      for (const index of box.index!.array) { indices.push(base + index); }
    } finally { box.dispose(); }
  }
  return { faceCount: parts.length * 6, unitFaceCount: parts.length * 6, outerFaceCount: parts.length * 6, cavityFaceCount: 0,
    positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), indices: new Uint16Array(indices),
    materialRanges: [{ slot: 1, startIndex: 0, indexCount: indices.length }],
    boundsMeters: { min: { x: -0.38, y: -0.9, z: -0.21 }, max: { x: 0.38, y: 0.9, z: 0.30 } },
    sourceDigest: "hvp-suit-model-v1", algorithmVersion: "authored-box-model-v1",
    tempEstimateBytes: (positions.length + normals.length + colors.length + indices.length) * 8 };
};
