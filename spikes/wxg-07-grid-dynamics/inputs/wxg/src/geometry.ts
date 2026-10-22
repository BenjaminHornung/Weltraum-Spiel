export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type Face = "px" | "nx" | "py" | "ny" | "pz" | "nz";

export const FACES = Object.freeze(["px", "nx", "py", "ny", "pz", "nz"] as const);

export interface CubeCoordinates {
  readonly face: Face;
  readonly u: number;
  readonly v: number;
}

export interface CellAddress {
  readonly face: Face;
  readonly level: number;
  readonly x: number;
  readonly y: number;
}

export interface TangentFrame {
  readonly normal: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
}

interface FaceAxes {
  readonly normal: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
}

const AXES: Readonly<Record<Face, FaceAxes>> = Object.freeze({
  px: { normal: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 0, z: -1 }, v: { x: 0, y: 1, z: 0 } },
  nx: { normal: { x: -1, y: 0, z: 0 }, u: { x: 0, y: 0, z: 1 }, v: { x: 0, y: 1, z: 0 } },
  py: { normal: { x: 0, y: 1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: -1 } },
  ny: { normal: { x: 0, y: -1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } },
  pz: { normal: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
  nz: { normal: { x: 0, y: 0, z: -1 }, u: { x: -1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } }
});

const finite = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
};

const vector = (value: unknown, name = "vector"): Vec3 => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a Vec3`);
  }
  const candidate = value as Record<string, unknown>;
  return {
    x: finite(candidate.x, `${name}.x`),
    y: finite(candidate.y, `${name}.y`),
    z: finite(candidate.z, `${name}.z`)
  };
};

const assertFace = (value: unknown): Face => {
  if (!FACES.includes(value as Face)) throw new RangeError(`unknown cube face: ${String(value)}`);
  return value as Face;
};

const assertCoordinate = (value: unknown, name: string): number => {
  const coordinate = finite(value, name);
  if (coordinate < -1 || coordinate > 1) throw new RangeError(`${name} must be in [-1, 1]`);
  return coordinate;
};

const grid = (level: unknown): number => {
  if (!Number.isSafeInteger(level) || (level as number) < 0 || (level as number) > 6) {
    throw new RangeError("level must be a safe integer in [0, 6]");
  }
  return 2 ** (level as number);
};

export const add = (a: Vec3, b: Vec3): Vec3 => {
  const left = vector(a, "a");
  const right = vector(b, "b");
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
};

export const scale = (value: Vec3, factor: number): Vec3 => {
  const v = vector(value);
  const amount = finite(factor, "factor");
  return { x: v.x * amount, y: v.y * amount, z: v.z * amount };
};

export const dot = (a: Vec3, b: Vec3): number => {
  const left = vector(a, "a");
  const right = vector(b, "b");
  return left.x * right.x + left.y * right.y + left.z * right.z;
};

export const cross = (a: Vec3, b: Vec3): Vec3 => {
  const left = vector(a, "a");
  const right = vector(b, "b");
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
};

export const unit = (value: Vec3): Vec3 => {
  const v = vector(value);
  const largest = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  if (largest === 0) throw new RangeError("cannot normalize the zero vector");
  const x = v.x / largest;
  const y = v.y / largest;
  const z = v.z / largest;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
};

export const direction = (faceValue: Face, uValue: number, vValue: number): Vec3 => {
  const face = assertFace(faceValue);
  const u = assertCoordinate(uValue, "u");
  const v = assertCoordinate(vValue, "v");
  const axes = AXES[face];
  return unit(add(add(axes.normal, scale(axes.u, u)), scale(axes.v, v)));
};

const dominantFace = (v: Vec3): Face => {
  const x = Math.abs(v.x);
  const y = Math.abs(v.y);
  const z = Math.abs(v.z);
  if (x >= y && x >= z) return v.x >= 0 ? "px" : "nx";
  if (y >= z) return v.y >= 0 ? "py" : "ny";
  return v.z >= 0 ? "pz" : "nz";
};

export const coordinates = (value: Vec3, faceValue?: Face): CubeCoordinates => {
  const v = vector(value);
  if (v.x === 0 && v.y === 0 && v.z === 0) throw new RangeError("direction vector must be nonzero");
  const face = faceValue === undefined ? dominantFace(v) : assertFace(faceValue);
  const axes = AXES[face];
  const denominator = dot(v, axes.normal);
  if (denominator <= 0) throw new RangeError("direction does not face the requested cube face");
  let u = dot(v, axes.u) / denominator;
  let w = dot(v, axes.v) / denominator;
  if (!Number.isFinite(u) || !Number.isFinite(w) || Math.abs(u) > 1 + 1e-12 || Math.abs(w) > 1 + 1e-12) {
    throw new RangeError("direction lies outside the requested cube face");
  }
  if (Math.abs(u) > 1) u = Math.sign(u);
  if (Math.abs(w) > 1) w = Math.sign(w);
  return { face, u, v: w };
};

export const frame = (faceValue: Face, uValue: number, vValue: number): TangentFrame => {
  const face = assertFace(faceValue);
  const normal = direction(face, uValue, vValue);
  const faceU = AXES[face].u;
  const tangentU = unit(add(faceU, scale(normal, -dot(faceU, normal))));
  const tangentV = unit(cross(normal, tangentU));
  return { normal, u: tangentU, v: tangentV };
};

const frameVectors = (value: TangentFrame): TangentFrame => {
  if (value === null || typeof value !== "object") throw new TypeError("frame must be a tangent frame");
  return { normal: vector(value.normal, "frame.normal"), u: vector(value.u, "frame.u"), v: vector(value.v, "frame.v") };
};

export const toBody = (frameValue: TangentFrame, tangent: Readonly<{ u: number; v: number }>): Vec3 => {
  const basis = frameVectors(frameValue);
  const u = finite(tangent?.u, "tangent.u");
  const v = finite(tangent?.v, "tangent.v");
  return add(scale(basis.u, u), scale(basis.v, v));
};

export const toTangent = (frameValue: TangentFrame, value: Vec3): Readonly<{ u: number; v: number }> => {
  const basis = frameVectors(frameValue);
  const body = vector(value);
  return { u: dot(basis.u, body), v: dot(basis.v, body) };
};

const cellIndex = (index: unknown, resolution: number, name: string): number => {
  if (!Number.isSafeInteger(index) || (index as number) < 0 || (index as number) >= resolution) {
    throw new RangeError(`${name} must be an integer in [0, ${resolution - 1}]`);
  }
  return index as number;
};

export const cellAddress = (value: Vec3, level: number): CellAddress => {
  const resolution = grid(level);
  const point = coordinates(value);
  const index = (coordinate: number): number => Math.min(resolution - 1, Math.floor(((coordinate + 1) * resolution) / 2));
  return { face: point.face, level, x: index(point.u), y: index(point.v) };
};

const cellBounds = (level: number, xValue: number, yValue: number): Readonly<{ resolution: number; u0: number; u1: number; v0: number; v1: number }> => {
  const resolution = grid(level);
  const x = cellIndex(xValue, resolution, "x");
  const y = cellIndex(yValue, resolution, "y");
  return {
    resolution,
    u0: -1 + (2 * x) / resolution,
    u1: -1 + (2 * (x + 1)) / resolution,
    v0: -1 + (2 * y) / resolution,
    v1: -1 + (2 * (y + 1)) / resolution
  };
};

export const cellCenter = (faceValue: Face, level: number, x: number, y: number): Vec3 => {
  const face = assertFace(faceValue);
  const bounds = cellBounds(level, x, y);
  return direction(face, (bounds.u0 + bounds.u1) / 2, (bounds.v0 + bounds.v1) / 2);
};

const solidAnglePrimitive = (u: number, v: number): number => Math.atan2(u * v, Math.sqrt(1 + u * u + v * v));

export const cellArea = (faceValue: Face, level: number, x: number, y: number, radius: number): number => {
  assertFace(faceValue);
  const bounds = cellBounds(level, x, y);
  const r = finite(radius, "radius");
  if (r <= 0) throw new RangeError("radius must be positive and finite");
  const radiusSquared = r * r;
  if (!Number.isFinite(radiusSquared) || radiusSquared === 0) throw new RangeError("radius squared is outside the representable range");
  const solidAngle = solidAnglePrimitive(bounds.u1, bounds.v1)
    - solidAnglePrimitive(bounds.u0, bounds.v1)
    - solidAnglePrimitive(bounds.u1, bounds.v0)
    + solidAnglePrimitive(bounds.u0, bounds.v0);
  const area = solidAngle * radiusSquared;
  if (!Number.isFinite(area) || area <= 0) throw new RangeError("cell area is outside the representable range");
  return area;
};
