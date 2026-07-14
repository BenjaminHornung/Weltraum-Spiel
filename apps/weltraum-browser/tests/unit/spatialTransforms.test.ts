import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUniverseClock } from "../../src/persistence";
import {
  SpatialError,
  angularVelocityToSystemInertial,
  createFrameStateAtTime,
  createQuaternionFromAxisAngle,
  createSpatialKinematicState,
  createSpatialQuaternion,
  createSpatialVector3,
  createSystemInertialFrameState,
  directionFromSystemInertial,
  directionToSystemInertial,
  positionToSystemInertial,
  normalizeSpatialVector,
  quaternionAngularDistanceRadians,
  serializeCanonicalSpatialValue,
  spatialVector3,
  transformAngularVelocity,
  transformDirection,
  transformKinematicState,
  transformLinearVelocity,
  transformOrientation,
  transformPosition,
  velocityToSystemInertial
} from "../../src/spatial";

const errorMagnitude = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }) =>
  Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

const frames = () => {
  const time = createUniverseClock(1_200);
  const system = createSystemInertialFrameState("frame:system", time);
  const rotating = createFrameStateAtTime({
    frameId: "frame:rotating",
    systemFrameId: system.systemFrameId,
    time,
    originPositionMeters: { x: 100, y: 200, z: 300 },
    orientation: createQuaternionFromAxisAngle(spatialVector3(0, 0, 1), Math.PI / 2),
    originVelocityMetersPerSecond: { x: 5, y: -2, z: 1 },
    angularVelocityRadiansPerSecond: { x: 0, y: 0, z: 2 }
  });
  return { time, system, rotating };
};

describe("spatial frame transformations", () => {
  it("roundtrips position and direction between connected frames", () => {
    const { system, rotating } = frames();
    const position = spatialVector3(10.25, -4.5, 3);
    const direction = spatialVector3(1, 2, -3);
    const transformedPosition = transformPosition(position, rotating, system);
    const transformedDirection = transformDirection(direction, rotating, system);

    expect(errorMagnitude(transformPosition(transformedPosition, system, rotating), position)).toBeLessThanOrEqual(1e-5);
    expect(errorMagnitude(transformDirection(transformedDirection, system, rotating), direction)).toBeLessThanOrEqual(1e-12);
    expect(errorMagnitude(directionFromSystemInertial(directionToSystemInertial(direction, rotating), rotating), direction)).toBeLessThanOrEqual(1e-12);
  });

  it("includes omega cross radius when transforming linear velocity and roundtrips it", () => {
    const { system, rotating } = frames();
    const localPosition = spatialVector3(10, 0, 0);
    const localVelocity = spatialVector3(0, 0, 0);
    const absolutePosition = positionToSystemInertial(localPosition, rotating);
    const absoluteVelocity = velocityToSystemInertial(localVelocity, localPosition, rotating);

    expect(errorMagnitude(absolutePosition, { x: 100, y: 210, z: 300 })).toBeLessThanOrEqual(1e-12);
    expect(errorMagnitude(absoluteVelocity, { x: -15, y: -2, z: 1 })).toBeLessThanOrEqual(1e-12);

    const targetVelocity = transformLinearVelocity(localVelocity, localPosition, rotating, system);
    expect(errorMagnitude(targetVelocity, absoluteVelocity)).toBeLessThanOrEqual(1e-12);
    expect(
      errorMagnitude(
        transformLinearVelocity(targetVelocity, absolutePosition, system, rotating),
        localVelocity
      )
    ).toBeLessThanOrEqual(1e-9);
  });

  it("roundtrips actor orientation independently from frame orientation", () => {
    const { system, rotating } = frames();
    const actorOrientation = createQuaternionFromAxisAngle(spatialVector3(1, 2, 3), 0.72);
    const systemOrientation = transformOrientation(actorOrientation, rotating, system);
    const roundtrip = transformOrientation(systemOrientation, system, rotating);

    expect(quaternionAngularDistanceRadians(roundtrip, actorOrientation)).toBeLessThanOrEqual(1e-10);
    expect(quaternionAngularDistanceRadians(systemOrientation, rotating.orientation)).toBeGreaterThan(0.1);
  });

  it("roundtrips angular velocity while accounting for frame angular velocity", () => {
    const { system, rotating } = frames();
    const local = spatialVector3(0.1, -0.2, 0.3);
    const absolute = angularVelocityToSystemInertial(local, rotating);
    const roundtrip = transformAngularVelocity(absolute, system, rotating);

    expect(errorMagnitude(roundtrip, local)).toBeLessThanOrEqual(1e-12);
    expect(errorMagnitude(absolute, { x: 0.2, y: 0.1, z: 2.3 })).toBeLessThanOrEqual(1e-12);
  });

  it("roundtrips a complete pose, velocity, orientation, and angular velocity state", () => {
    const { system, rotating } = frames();
    const local = createSpatialKinematicState({
      positionMeters: { x: 20, y: -30, z: 40 },
      velocityMetersPerSecond: { x: 3, y: 4, z: 5 },
      orientation: createQuaternionFromAxisAngle(spatialVector3(0, 1, 0), 1.1),
      angularVelocityRadiansPerSecond: { x: 0.01, y: 0.02, z: 0.03 }
    });
    const absolute = transformKinematicState(local, rotating, system);
    const roundtrip = transformKinematicState(absolute, system, rotating);

    expect(errorMagnitude(roundtrip.positionMeters, local.positionMeters)).toBeLessThanOrEqual(1e-5);
    expect(errorMagnitude(roundtrip.velocityMetersPerSecond, local.velocityMetersPerSecond)).toBeLessThanOrEqual(1e-9);
    expect(quaternionAngularDistanceRadians(roundtrip.orientation, local.orientation)).toBeLessThanOrEqual(1e-10);
    expect(errorMagnitude(roundtrip.angularVelocityRadiansPerSecond, local.angularVelocityRadiansPerSecond)).toBeLessThanOrEqual(1e-12);
    expect(Object.isFrozen(absolute)).toBe(true);
    expect(Object.isFrozen(absolute.positionMeters)).toBe(true);
  });

  it("treats floating-origin translation as a derived projection without changing canonical IDs or states", () => {
    const { time, system } = frames();
    const renderRelative = createFrameStateAtTime({
      frameId: "frame:render-relative.test",
      systemFrameId: system.systemFrameId,
      time,
      originPositionMeters: { x: 9e12, y: -8e12, z: 7e12 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      originVelocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      angularVelocityRadiansPerSecond: { x: 0, y: 0, z: 0 }
    });
    const canonicalPosition = spatialVector3(9e12 + 100, -8e12 + 200, 7e12 - 300);
    const systemBefore = serializeCanonicalSpatialValue(system);
    const projectionBefore = serializeCanonicalSpatialValue(renderRelative);
    const relative = transformPosition(canonicalPosition, system, renderRelative);

    expect(errorMagnitude(relative, { x: 100, y: 200, z: -300 })).toBe(0);
    expect(system.frameId).toBe("frame:system");
    expect(renderRelative.systemFrameId).toBe("frame:system");
    expect(serializeCanonicalSpatialValue(system)).toBe(systemBefore);
    expect(serializeCanonicalSpatialValue(renderRelative)).toBe(projectionBefore);
    expect(canonicalPosition).toEqual({ x: 9e12 + 100, y: -8e12 + 200, z: 7e12 - 300 });
  });

  it("rejects NaN, Infinity, and zero quaternions and never mutates caller inputs", () => {
    expect(() => createSpatialVector3({ x: Number.NaN, y: 0, z: 0 })).toThrowError(
      expect.objectContaining<Partial<SpatialError>>({ code: "NONFINITE_VALUE" })
    );
    expect(() => createSpatialVector3({ x: 0, y: Number.POSITIVE_INFINITY, z: 0 })).toThrowError(
      expect.objectContaining<Partial<SpatialError>>({ code: "NONFINITE_VALUE" })
    );
    expect(() => createSpatialQuaternion({ x: 0, y: 0, z: 0, w: 0 })).toThrowError(
      expect.objectContaining<Partial<SpatialError>>({ code: "ZERO_QUATERNION" })
    );
    expect(() => normalizeSpatialVector({ x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: 0 })).toThrowError(
      expect.objectContaining<Partial<SpatialError>>({ code: "NONFINITE_VALUE" })
    );
    expect(() =>
      createQuaternionFromAxisAngle({ x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: 0 }, 1)
    ).toThrowError(expect.objectContaining<Partial<SpatialError>>({ code: "NONFINITE_VALUE" }));

    const caller = {
      positionMeters: { x: -0, y: 2, z: 3 },
      velocityMetersPerSecond: { x: 4, y: 5, z: 6 },
      orientation: { x: 0, y: 0, z: 0, w: 2 },
      angularVelocityRadiansPerSecond: { x: 7, y: 8, z: 9 }
    };
    const before = structuredClone(caller);
    const parsed = createSpatialKinematicState(caller);
    expect(caller).toEqual(before);
    expect(Object.is(parsed.positionMeters.x, -0)).toBe(false);
    expect(parsed.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it("keeps Spatial and Physics-Space renderer-, DOM-, and wall-clock-independent", () => {
    const collectTypeScript = (directory: string): string =>
      readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
          const path = `${directory}/${entry.name}`;
          if (entry.isDirectory()) {
            return collectTypeScript(path);
          }
          return entry.isFile() && entry.name.endsWith(".ts") ? readFileSync(path, "utf8") : "";
        })
        .join("\n");
    const source = [collectTypeScript("src/spatial"), collectTypeScript("src/physics-space")].join("\n");

    expect(source).not.toMatch(/(?:from\s+|import\s*\()["'][^"']*three/i);
    expect(source).not.toMatch(/\b(?:window|document|HTMLElement|Date\.now|performance\.now)\b/);
  });
});
