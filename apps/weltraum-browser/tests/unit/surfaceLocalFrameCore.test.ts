import { describe, expect, it } from "vitest";
import {
  SurfaceLocalFrameError,
  assertFiniteRotationDeterminant,
  bodyFixedToGeodetic,
  bodyFixedToSurfaceLocal,
  canonicalSerializeSurfaceLocalFrame,
  createAbsoluteSurfaceState,
  createSurfaceAnchor,
  createSurfaceBodyShape,
  createSurfaceLocalFrame,
  geodeticToBodyFixed,
  projectAbsoluteSurfaceState,
  reanchorSurfaceLocalFrame,
  restoreAbsoluteSurfaceState,
  surfaceLocalFrameSignature,
  surfaceLocalToBodyFixed,
  transformDirectionBodyFixedToLocal,
  transformDirectionLocalToBodyFixed,
  type CreateSurfaceAnchorInput,
  type SurfaceBodyShape,
  type SurfaceCanonicalValue,
  type SurfaceLocalFrame,
  type SurfaceLocalFrameErrorCode,
  type SurfaceVector3
} from "../../src/surface-frame";

const BODY_ID = "body.hestia";
const BODY_FIXED_FRAME_ID = "frame.hestia.body-fixed";

const sphere = (): SurfaceBodyShape => createSurfaceBodyShape({
  bodyId: BODY_ID,
  bodyFixedFrameId: BODY_FIXED_FRAME_ID,
  revision: 3,
  semiMajorAxisMeters: 6_000_000,
  semiMinorAxisMeters: 6_000_000
});

const ellipsoid = (): SurfaceBodyShape => createSurfaceBodyShape({
  bodyId: BODY_ID,
  bodyFixedFrameId: BODY_FIXED_FRAME_ID,
  revision: 3,
  semiMajorAxisMeters: 6_378_137,
  semiMinorAxisMeters: 6_356_752.314245
});

const anchor = (
  shape: SurfaceBodyShape,
  overrides: Partial<Omit<CreateSurfaceAnchorInput, "shape">> = {}
) => createSurfaceAnchor({
  bodyId: BODY_ID,
  bodyFixedFrameId: BODY_FIXED_FRAME_ID,
  anchorId: "anchor.alpha",
  revision: 5,
  shape,
  latitudeRadians: 0,
  longitudeRadians: 0,
  ellipsoidalHeightMeters: 0,
  ...overrides
});

const frame = (
  shape: SurfaceBodyShape,
  surfaceAnchor = anchor(shape),
  surfaceFrameId = "surface.alpha",
  frameRevision = 7,
  authorityContext: SurfaceCanonicalValue = { bodyPoseRevision: 11, tick: 42 }
): SurfaceLocalFrame => createSurfaceLocalFrame({
  bodyId: BODY_ID,
  bodyFixedFrameId: BODY_FIXED_FRAME_ID,
  surfaceFrameId,
  revision: frameRevision,
  shape,
  anchor: surfaceAnchor,
  authorityContext
});

const expectSurfaceError = (action: () => unknown, code: SurfaceLocalFrameErrorCode): void => {
  try {
    action();
    throw new Error(`Expected SurfaceLocalFrameError ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(SurfaceLocalFrameError);
    expect((error as SurfaceLocalFrameError).code).toBe(code);
  }
};

const expectVectorClose = (actual: SurfaceVector3, expected: SurfaceVector3, digits = 9): void => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
};

const dot = (left: SurfaceVector3, right: SurfaceVector3): number =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const cross = (left: SurfaceVector3, right: SurfaceVector3): SurfaceVector3 => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x
});

const expectNoNegativeZero = (value: unknown): void => {
  if (typeof value === "number") {
    expect(Object.is(value, -0)).toBe(false);
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(expectNoNegativeZero);
    return;
  }
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(expectNoNegativeZero);
  }
};

describe("SurfaceLocalFrame body shapes and geodetic conversion", () => {
  it("supports finite positive spheres and oblate ellipsoids without fallback", () => {
    expect(sphere()).toMatchObject({ kind: "Sphere", firstEccentricitySquared: 0 });
    expect(ellipsoid().kind).toBe("OblateEllipsoid");
    expect(ellipsoid().firstEccentricitySquared).toBeGreaterThan(0);

    expectSurfaceError(() => createSurfaceBodyShape({
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      revision: 0,
      semiMajorAxisMeters: 1,
      semiMinorAxisMeters: 2
    }), "InvalidShape");
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectSurfaceError(() => createSurfaceBodyShape({
        bodyId: BODY_ID,
        bodyFixedFrameId: BODY_FIXED_FRAME_ID,
        revision: 0,
        semiMajorAxisMeters: invalid,
        semiMinorAxisMeters: 1
      }), "InvalidNumber");
    }
  });

  it("round-trips sphere and ellipsoid geodetic coordinates at positive and negative heights", () => {
    for (const shape of [sphere(), ellipsoid()]) {
      for (const geodetic of [
        { latitudeRadians: 0, longitudeRadians: 0, ellipsoidalHeightMeters: 125.25 },
        { latitudeRadians: 0.73, longitudeRadians: -2.4, ellipsoidalHeightMeters: -850.5 },
        { latitudeRadians: -1.2, longitudeRadians: Math.PI - 1e-8, ellipsoidalHeightMeters: 42_000 }
      ]) {
        const bodyFixed = geodeticToBodyFixed(shape, geodetic);
        const restored = bodyFixedToGeodetic(shape, bodyFixed);
        expect(restored.latitudeRadians).toBeCloseTo(geodetic.latitudeRadians, 12);
        expect(restored.longitudeRadians).toBeCloseTo(geodetic.longitudeRadians, 12);
        expect(restored.ellipsoidalHeightMeters).toBeCloseTo(geodetic.ellipsoidalHeightMeters, 6);
        expectVectorClose(geodeticToBodyFixed(shape, restored), bodyFixed, 6);
      }
    }
  });

  it("enforces the injective negative-height domain before the minimum normal curvature radius", () => {
    for (const shape of [sphere(), ellipsoid()]) {
      const minimumNormalRadiusMeters = shape.semiMinorAxisMeters * shape.semiMinorAxisMeters /
        shape.semiMajorAxisMeters;
      for (const invalidHeight of [-minimumNormalRadiusMeters, -minimumNormalRadiusMeters - 1]) {
        expectSurfaceError(() => geodeticToBodyFixed(shape, {
          latitudeRadians: 0,
          longitudeRadians: 0.75,
          ellipsoidalHeightMeters: invalidHeight
        }), "InvalidGeodeticHeight");
        expectSurfaceError(() => anchor(shape, {
          ellipsoidalHeightMeters: invalidHeight,
          anchorId: `anchor.invalid-height.${String(invalidHeight)}`
        }), "InvalidGeodeticHeight");
      }

      const validNegativeHeight = -minimumNormalRadiusMeters + 1_000;
      const valid = {
        latitudeRadians: 0,
        longitudeRadians: 0.75,
        ellipsoidalHeightMeters: validNegativeHeight
      };
      const restored = bodyFixedToGeodetic(shape, geodeticToBodyFixed(shape, valid));
      expect(restored.latitudeRadians).toBeCloseTo(valid.latitudeRadians, 12);
      expect(restored.longitudeRadians).toBeCloseTo(valid.longitudeRadians, 12);
      expect(restored.ellipsoidalHeightMeters).toBeCloseTo(validNegativeHeight, 6);
    }
  });

  it("defines equator, both poles, and antimeridian canonically", () => {
    const shape = ellipsoid();
    const equator = anchor(shape);
    expect(equator.bodyFixedPositionMeters).toEqual({ x: shape.semiMajorAxisMeters, y: 0, z: 0 });

    for (const latitudeRadians of [Math.PI / 2, -Math.PI / 2]) {
      const pole = anchor(shape, { latitudeRadians, longitudeRadians: 2.2, anchorId: `pole.${latitudeRadians}` });
      expect(pole.geodetic.longitudeRadians).toBe(0);
      expect(pole.bodyFixedPositionMeters.x).toBe(0);
      expect(pole.bodyFixedPositionMeters.y).toBe(0);
      expect(bodyFixedToGeodetic(shape, pole.bodyFixedPositionMeters).longitudeRadians).toBe(0);
    }
    for (const invalidLongitude of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expectSurfaceError(() => anchor(shape, {
        latitudeRadians: Math.PI / 2,
        longitudeRadians: invalidLongitude,
        anchorId: "pole.invalid-longitude"
      }), "InvalidNumber");
    }

    const antimeridian = anchor(shape, { longitudeRadians: Math.PI });
    expect(antimeridian.geodetic.longitudeRadians).toBe(-Math.PI);
    expect(bodyFixedToGeodetic(shape, antimeridian.bodyFixedPositionMeters).longitudeRadians).toBe(-Math.PI);
    expectNoNegativeZero(antimeridian);
  });

  it("rejects invalid anchors, undefined center, and explicit inverse non-convergence", () => {
    const shape = ellipsoid();
    expectSurfaceError(() => anchor(shape, { latitudeRadians: Math.PI }), "InvalidAnchor");
    expectSurfaceError(() => anchor(shape, { ellipsoidalHeightMeters: Number.NaN }), "InvalidNumber");
    expectSurfaceError(() => anchor(sphere(), { ellipsoidalHeightMeters: -sphere().semiMajorAxisMeters }), "InvalidGeodeticHeight");
    expectSurfaceError(() => bodyFixedToGeodetic(shape, { x: 0, y: 0, z: 0 }), "UndefinedCenter");
    expectSurfaceError(() => bodyFixedToGeodetic(shape, { x: Number.POSITIVE_INFINITY, y: 0, z: 0 }), "InvalidNumber");

    const extreme = createSurfaceBodyShape({
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      revision: 1,
      semiMajorAxisMeters: 1_000,
      semiMinorAxisMeters: 1
    });
    expectSurfaceError(() => bodyFixedToGeodetic(extreme, { x: 490, y: 0, z: 6 }), "GeodeticNonConvergence");
  });
});

describe("SurfaceLocalFrame basis and transforms", () => {
  it("uses the proper +X East, +Y Up, +Z South basis and north-forward -Z", () => {
    const surfaceFrame = frame(ellipsoid(), anchor(ellipsoid(), {
      latitudeRadians: 0.61,
      longitudeRadians: -1.4
    }));
    const { east, up, south } = surfaceFrame.anchor.basis;

    expectVectorClose(cross(east, up), south, 12);
    expect(assertFiniteRotationDeterminant(surfaceFrame.anchor.basis)).toBeCloseTo(1, 12);
    expect(dot(east, up)).toBeCloseTo(0, 12);
    expect(dot(east, south)).toBeCloseTo(0, 12);
    expect(dot(up, south)).toBeCloseTo(0, 12);
    expect(dot(east, east)).toBeCloseTo(1, 12);
    expect(dot(up, up)).toBeCloseTo(1, 12);
    expect(dot(south, south)).toBeCloseTo(1, 12);
    expectVectorClose(transformDirectionBodyFixedToLocal({ x: -south.x, y: -south.y, z: -south.z }, surfaceFrame), {
      x: 0,
      y: 0,
      z: -1
    }, 12);
    const quaternionNorm = Math.hypot(
      surfaceFrame.orientationLocalToBodyFixed.x,
      surfaceFrame.orientationLocalToBodyFixed.y,
      surfaceFrame.orientationLocalToBodyFixed.z,
      surfaceFrame.orientationLocalToBodyFixed.w
    );
    expect(quaternionNorm).toBeCloseTo(1, 12);
  });

  it("round-trips positions and directions while applying translation only to positions", () => {
    const surfaceFrame = frame(ellipsoid(), anchor(ellipsoid(), {
      latitudeRadians: -0.4,
      longitudeRadians: 2.1,
      ellipsoidalHeightMeters: 120
    }));
    const localPosition = { x: 12.5, y: -3.25, z: 7.75 };
    const bodyPosition = surfaceLocalToBodyFixed(localPosition, surfaceFrame);
    expectVectorClose(bodyFixedToSurfaceLocal(bodyPosition, surfaceFrame), localPosition, 8);

    const bodyDirection = { x: 2.5, y: -4.25, z: 1.75 };
    const localDirection = transformDirectionBodyFixedToLocal(bodyDirection, surfaceFrame);
    expectVectorClose(transformDirectionLocalToBodyFixed(localDirection, surfaceFrame), bodyDirection, 11);
    expect(localDirection).not.toEqual(bodyFixedToSurfaceLocal(bodyDirection, surfaceFrame));
  });

  it("retains millimeter-scale local deltas at large planetary radii", () => {
    const largeShape = createSurfaceBodyShape({
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      revision: 9,
      semiMajorAxisMeters: 70_000_000,
      semiMinorAxisMeters: 69_500_000
    });
    const surfaceFrame = frame(largeShape, anchor(largeShape, {
      latitudeRadians: 0.45,
      longitudeRadians: -2.8,
      ellipsoidalHeightMeters: 1_000
    }));
    const local = { x: 0.003, y: -0.002, z: 0.004 };
    const roundTrip = bodyFixedToSurfaceLocal(surfaceLocalToBodyFixed(local, surfaceFrame), surfaceFrame);
    expectVectorClose(roundTrip, local, 7);
  });
});

describe("SurfaceLocalFrame absolute-state projection and reanchor", () => {
  it("preserves position, velocity, orientation, directions, authority, and semantic identity", () => {
    const shape = ellipsoid();
    const firstFrame = frame(shape, anchor(shape, {
      anchorId: "anchor.west",
      latitudeRadians: 0.2,
      longitudeRadians: -1.1,
      ellipsoidalHeightMeters: 15
    }), "surface.west", 10);
    const secondFrame = frame(shape, anchor(shape, {
      anchorId: "anchor.east",
      revision: 6,
      latitudeRadians: -0.35,
      longitudeRadians: 1.7,
      ellipsoidalHeightMeters: 35
    }), "surface.east", 11);
    const absoluteInput = {
      stateId: "state.player",
      semanticIdentity: { kind: "Player", id: "player.one" },
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      bodyRevision: shape.revision,
      positionBodyFixedMeters: geodeticToBodyFixed(shape, {
        latitudeRadians: 0.25,
        longitudeRadians: -0.9,
        ellipsoidalHeightMeters: 850
      }),
      velocityBodyFixedMetersPerSecond: { x: 12.25, y: -3.5, z: 0.125 },
      orientationBodyFixed: { x: 0, y: 0, z: 0, w: 1 },
      directionsBodyFixed: [
        { id: "forward", valueBodyFixed: { x: 0.5, y: -0.25, z: 0.75 } },
        { id: "up", valueBodyFixed: { x: 0, y: 0, z: 1 } }
      ]
    } as const;
    const before = JSON.stringify(absoluteInput);

    const projected = projectAbsoluteSurfaceState(absoluteInput, firstFrame);
    const reanchored = reanchorSurfaceLocalFrame(projected, firstFrame, secondFrame);
    const restored = restoreAbsoluteSurfaceState(reanchored, secondFrame);

    expect(JSON.stringify(absoluteInput)).toBe(before);
    expect(reanchored.positionLocalMeters).not.toEqual(projected.positionLocalMeters);
    expect(reanchored.velocityLocalMetersPerSecond).not.toEqual(projected.velocityLocalMetersPerSecond);
    expect(restored.stateId).toBe(absoluteInput.stateId);
    expect(restored.semanticIdentity).toEqual(absoluteInput.semanticIdentity);
    expect(restored.bodyId).toBe(BODY_ID);
    expect(restored.bodyFixedFrameId).toBe(BODY_FIXED_FRAME_ID);
    expect(restored.bodyRevision).toBe(shape.revision);
    expectVectorClose(restored.positionBodyFixedMeters, absoluteInput.positionBodyFixedMeters, 7);
    expectVectorClose(restored.velocityBodyFixedMetersPerSecond, absoluteInput.velocityBodyFixedMetersPerSecond, 10);
    expect(restored.orientationBodyFixed).toBeDefined();
    expect(restored.orientationBodyFixed?.w).toBeCloseTo(1, 11);
    expect(restored.directionsBodyFixed?.map((entry) => entry.id)).toEqual(["forward", "up"]);
    restored.directionsBodyFixed?.forEach((entry, index) => {
      expectVectorClose(entry.valueBodyFixed, absoluteInput.directionsBodyFixed[index].valueBodyFixed, 10);
    });
  });

  it("fails closed on body, body-frame, revision, frame, and anchor mismatches", () => {
    const shape = sphere();
    const surfaceFrame = frame(shape);
    const state = createAbsoluteSurfaceState({
      stateId: "state.ship",
      semanticIdentity: { kind: "Ship", id: "ship.one" },
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      bodyRevision: shape.revision + 1,
      positionBodyFixedMeters: { x: shape.semiMajorAxisMeters, y: 0, z: 0 },
      velocityBodyFixedMetersPerSecond: { x: 0, y: 1, z: 0 }
    });
    expectSurfaceError(() => projectAbsoluteSurfaceState(state, surfaceFrame), "AuthorityMismatch");

    const valid = projectAbsoluteSurfaceState({ ...state, bodyRevision: shape.revision }, surfaceFrame);
    const otherFrame = frame(shape, anchor(shape, { anchorId: "anchor.other", revision: 99 }), "surface.other", 99);
    expectSurfaceError(() => restoreAbsoluteSurfaceState(valid, otherFrame), "AuthorityMismatch");

    const otherShape = createSurfaceBodyShape({
      bodyId: "body.other",
      bodyFixedFrameId: "frame.other.body-fixed",
      revision: shape.revision,
      semiMajorAxisMeters: 6_000_000,
      semiMinorAxisMeters: 6_000_000
    });
    const otherAnchor = createSurfaceAnchor({
      bodyId: otherShape.bodyId,
      bodyFixedFrameId: otherShape.bodyFixedFrameId,
      anchorId: "anchor.other-body",
      revision: 1,
      shape: otherShape,
      latitudeRadians: 0,
      longitudeRadians: 0,
      ellipsoidalHeightMeters: 0
    });
    const otherBodyFrame = createSurfaceLocalFrame({
      bodyId: otherShape.bodyId,
      bodyFixedFrameId: otherShape.bodyFixedFrameId,
      surfaceFrameId: "surface.other-body",
      revision: 1,
      shape: otherShape,
      anchor: otherAnchor
    });
    expectSurfaceError(() => reanchorSurfaceLocalFrame(valid, surfaceFrame, otherBodyFrame), "AuthorityMismatch");
  });

  it("binds frame authority context and requires canonical equality for restore and reanchor", () => {
    const shape = sphere();
    const currentFrame = frame(shape);
    const absolute = createAbsoluteSurfaceState({
      stateId: "state.authority-context",
      semanticIdentity: { kind: "Ship", id: "ship.authority-context" },
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      bodyRevision: shape.revision,
      positionBodyFixedMeters: { x: shape.semiMajorAxisMeters + 10, y: 20, z: 30 },
      velocityBodyFixedMetersPerSecond: { x: 1, y: 2, z: 3 }
    });
    const projected = projectAbsoluteSurfaceState(absolute, currentFrame);
    expect(projected.authorityContext).toEqual({ bodyPoseRevision: 11, tick: 42 });
    expect(projected.authorityContext).not.toBe(currentFrame.authorityContext);
    expect(Object.isFrozen(projected.authorityContext)).toBe(true);

    const contextlessFrame = createSurfaceLocalFrame({
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      surfaceFrameId: "surface.contextless",
      revision: 1,
      shape,
      anchor: anchor(shape, { anchorId: "anchor.contextless" })
    });
    const contextlessProjected = projectAbsoluteSurfaceState(absolute, contextlessFrame);
    expect(Object.hasOwn(contextlessProjected, "authorityContext")).toBe(false);

    const canonicallyEqualFrame = frame(
      shape,
      currentFrame.anchor,
      currentFrame.surfaceFrameId,
      currentFrame.revision,
      { tick: 42, bodyPoseRevision: 11 }
    );
    expect(restoreAbsoluteSurfaceState(projected, canonicallyEqualFrame).stateId).toBe(absolute.stateId);

    const mismatchedFrame = frame(
      shape,
      currentFrame.anchor,
      currentFrame.surfaceFrameId,
      currentFrame.revision,
      { bodyPoseRevision: 11, tick: 43 }
    );
    expectSurfaceError(() => restoreAbsoluteSurfaceState(projected, mismatchedFrame), "AuthorityMismatch");

    const equalNextFrame = frame(
      shape,
      anchor(shape, { anchorId: "anchor.next-equal-context", longitudeRadians: 0.2 }),
      "surface.next-equal-context",
      8,
      { tick: 42, bodyPoseRevision: 11 }
    );
    expect(reanchorSurfaceLocalFrame(projected, currentFrame, equalNextFrame).authorityContext)
      .toEqual({ bodyPoseRevision: 11, tick: 42 });

    const mismatchedNextFrame = frame(
      shape,
      anchor(shape, { anchorId: "anchor.next-mismatched-context", longitudeRadians: 0.3 }),
      "surface.next-mismatched-context",
      9,
      { bodyPoseRevision: 12, tick: 42 }
    );
    expectSurfaceError(
      () => reanchorSurfaceLocalFrame(projected, currentFrame, mismatchedNextFrame),
      "AuthorityMismatch"
    );
  });
});

describe("SurfaceLocalFrame immutability and canonical identity", () => {
  it("clones caller data, deeply freezes public graphs, and emits no non-finite or negative-zero values", () => {
    const shape = ellipsoid();
    const authorityContext = { tick: 12, nested: { value: -0 }, labels: ["alpha", "beta"] };
    const surfaceFrame = createSurfaceLocalFrame({
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      surfaceFrameId: "surface.frozen",
      revision: 1,
      shape,
      anchor: anchor(shape),
      authorityContext
    });
    authorityContext.nested.value = 99;
    authorityContext.labels[0] = "changed";

    expect(surfaceFrame.authorityContext).toEqual({ labels: ["alpha", "beta"], nested: { value: 0 }, tick: 12 });
    expect(Object.isFrozen(surfaceFrame)).toBe(true);
    expect(Object.isFrozen(surfaceFrame.shape)).toBe(true);
    expect(Object.isFrozen(surfaceFrame.anchor)).toBe(true);
    expect(Object.isFrozen(surfaceFrame.anchor.basis.east)).toBe(true);
    expect(Object.isFrozen(surfaceFrame.authorityContext)).toBe(true);
    expect(Object.isFrozen((surfaceFrame.authorityContext as { labels: readonly string[] }).labels)).toBe(true);
    expectNoNegativeZero(surfaceFrame);

    const projected = projectAbsoluteSurfaceState({
      stateId: "state.frozen",
      semanticIdentity: { kind: "Drone", id: "drone.one" },
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      bodyRevision: shape.revision,
      positionBodyFixedMeters: shape.kind === "Sphere" ? { x: 1, y: 2, z: 3 } : shapePosition(shape),
      velocityBodyFixedMetersPerSecond: { x: -0, y: 0, z: 0 },
      directionsBodyFixed: [{ id: "forward", valueBodyFixed: { x: 1, y: 0, z: -0 } }]
    }, surfaceFrame);
    expect(Object.isFrozen(projected)).toBe(true);
    expect(Object.isFrozen(projected.semanticIdentity)).toBe(true);
    expect(projected.authorityContext).toEqual({ labels: ["alpha", "beta"], nested: { value: 0 }, tick: 12 });
    expect(Object.isFrozen(projected.authorityContext)).toBe(true);
    expect(Object.isFrozen(projected.directionsLocal)).toBe(true);
    expect(Object.isFrozen(projected.directionsLocal?.[0])).toBe(true);
    expectNoNegativeZero(projected);
  });

  it("serializes lexically with shortest precise numbers and stable namespaced signatures", () => {
    const payloadA = {
      schema: "weltraum.test",
      schemaVersion: 1,
      z: [3, -0, 1e-12],
      a: { beta: true, alpha: "Hestia" }
    };
    const payloadB = {
      a: { alpha: "Hestia", beta: true },
      z: [3, 0, 1e-12],
      schemaVersion: 1,
      schema: "weltraum.test"
    };
    const payloadDifferent = { ...payloadB, z: [3, 0, 1.0000001e-12] };

    const serialized = canonicalSerializeSurfaceLocalFrame(payloadA);
    expect(serialized).toBe('{"a":{"alpha":"Hestia","beta":true},"schema":"weltraum.test","schemaVersion":1,"z":[3,0,1e-12]}');
    expect(canonicalSerializeSurfaceLocalFrame(payloadB)).toBe(serialized);
    expect(surfaceLocalFrameSignature(payloadA)).toBe(surfaceLocalFrameSignature(payloadB));
    expect(surfaceLocalFrameSignature(payloadDifferent)).not.toBe(surfaceLocalFrameSignature(payloadB));
    expect(surfaceLocalFrameSignature(payloadA)).toMatch(/^weltraum\.surface-local-frame\/v1\/fnv1a32:[0-9a-f]{8}$/);
    expect(canonicalSerializeSurfaceLocalFrame(payloadA)).toBe(serialized);
  });

  it("rejects undefined, non-finite, cyclic, unversioned, and authority-inconsistent payloads", () => {
    expectSurfaceError(
      () => canonicalSerializeSurfaceLocalFrame({ schema: "x", schemaVersion: 1, value: undefined }),
      "InvalidCanonicalValue"
    );
    expectSurfaceError(
      () => canonicalSerializeSurfaceLocalFrame({ schema: "x", schemaVersion: 1, value: Number.NaN }),
      "InvalidCanonicalValue"
    );
    expectSurfaceError(() => canonicalSerializeSurfaceLocalFrame({ value: 1 }), "InvalidCanonicalValue");
    const cyclic: Record<string, unknown> = { schema: "x", schemaVersion: 1 };
    cyclic.self = cyclic;
    expectSurfaceError(() => canonicalSerializeSurfaceLocalFrame(cyclic), "InvalidCanonicalValue");

    const sparse: string[] = [];
    sparse.length = 2;
    sparse[1] = "present";
    expectSurfaceError(
      () => canonicalSerializeSurfaceLocalFrame({ schema: "x", schemaVersion: 1, value: sparse }),
      "InvalidCanonicalValue"
    );

    const shape = sphere();
    expectSurfaceError(() => createSurfaceLocalFrame({
      bodyId: BODY_ID,
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      surfaceFrameId: "surface.sparse-authority",
      revision: 1,
      shape,
      anchor: anchor(shape),
      authorityContext: sparse
    }), "InvalidCanonicalValue");
    expectSurfaceError(() => createSurfaceAnchor({
      bodyId: "body.wrong",
      bodyFixedFrameId: BODY_FIXED_FRAME_ID,
      anchorId: "anchor.wrong",
      revision: 1,
      shape,
      latitudeRadians: 0,
      longitudeRadians: 0,
      ellipsoidalHeightMeters: 0
    }), "AuthorityMismatch");
  });
});

const shapePosition = (shape: SurfaceBodyShape): SurfaceVector3 => geodeticToBodyFixed(shape, {
  latitudeRadians: 0.1,
  longitudeRadians: 0.2,
  ellipsoidalHeightMeters: 50
});
