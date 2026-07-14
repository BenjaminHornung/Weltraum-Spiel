import { describe, expect, it } from "vitest";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  computeCatalogEphemeris,
  requireCelestialBody
} from "../../src/celestial";
import { createUniverseClock } from "../../src/persistence";
import {
  createBodyFixedFrameState,
  createBodyInertialFrameState,
  createFrameStateAtTime,
  createQuaternionFromAxisAngle,
  createSpatialKinematicState,
  createSurfaceLocalFrameDefinition,
  createSurfaceLocalFrameState,
  createSystemInertialFrameId,
  createSystemInertialFrameState,
  quaternionAngularDistanceRadians,
  spatialVector3,
  transformKinematicState
} from "../../src/spatial";
import {
  PhysicsSpaceError,
  createPhysicsSpaceDescriptor,
  handoffPhysicsSpace
} from "../../src/physics-space";

const fixtureAt = (tick = 30_000) => {
  const time = createUniverseClock(tick);
  const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
  const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
    epochSeconds: 0,
    requestedTimeSeconds: time.epochSeconds
  });
  const runtimeState = ephemeris.stateByBodyId[body.bodyId];
  if (runtimeState === undefined) {
    throw new Error("Hestia runtime state is missing.");
  }
  const system = createSystemInertialFrameState(createSystemInertialFrameId(), time);
  const inertial = createBodyInertialFrameState({
    body,
    runtimeState,
    time,
    systemFrameId: system.frameId
  });
  const fixed = createBodyFixedFrameState(inertial, {
    body,
    runtimeState,
    time,
    rotationEpoch: createUniverseClock(0)
  });
  const surfaceDefinition = createSurfaceLocalFrameDefinition({
    frameId: "frame:surface.handoff",
    anchor: {
      bodyId: body.bodyId,
      latitudeRadians: 0.62,
      longitudeRadians: -1.13,
      altitudeMeters: 800
    }
  });
  const surface = createSurfaceLocalFrameState(surfaceDefinition, body, fixed, time);
  const systemSpace = createPhysicsSpaceDescriptor({
    spaceId: "physics-space:system",
    kind: "SystemSpace",
    frameKind: "SystemInertial",
    frameDefinition: {
      frameId: system.frameId,
      kind: "SystemInertial",
      parentFrameId: null,
      canonicalAuthority: true
    },
    frameState: system
  });
  const bodySpace = createPhysicsSpaceDescriptor({
    spaceId: "physics-space:hestia-fixed",
    kind: "BodyLocalSpace",
    frameKind: "BodyFixed",
    frameDefinition: {
      frameId: fixed.frameId,
      kind: "BodyFixed",
      parentFrameId: inertial.frameId,
      canonicalAuthority: true
    },
    frameState: fixed
  });
  const surfaceSpace = createPhysicsSpaceDescriptor({
    spaceId: "physics-space:hestia-surface",
    kind: "SurfaceLocalSpace",
    frameKind: "SurfaceLocal",
    frameDefinition: {
      frameId: surface.frameId,
      kind: "SurfaceLocal",
      parentFrameId: fixed.frameId,
      canonicalAuthority: true
    },
    frameState: surface
  });
  return { time, system, inertial, fixed, surface, systemSpace, bodySpace, surfaceSpace };
};

const vectorError = (
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
) => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

describe("explicit physics-space handoff", () => {
  it("constructs SystemSpace, BodyLocalSpace, and SurfaceLocalSpace with explicit frame authority", () => {
    const fixture = fixtureAt();

    expect(fixture.systemSpace.kind).toBe("SystemSpace");
    expect(fixture.systemSpace.frameKind).toBe("SystemInertial");
    expect(fixture.bodySpace.kind).toBe("BodyLocalSpace");
    expect(fixture.bodySpace.frameKind).toBe("BodyFixed");
    expect(fixture.surfaceSpace.kind).toBe("SurfaceLocalSpace");
    expect(fixture.surfaceSpace.frameKind).toBe("SurfaceLocal");
    expect(Object.isFrozen(fixture.systemSpace)).toBe(true);
    expect(Object.isFrozen(fixture.bodySpace.frameState)).toBe(true);
  });

  it("rejects shifted, rotating, and parented SystemSpace roots", () => {
    const fixture = fixtureAt();
    const createSystemDescriptor = (
      frameState: ReturnType<typeof createFrameStateAtTime>,
      parentFrameId: string | null = null
    ) => () => createPhysicsSpaceDescriptor({
      spaceId: "physics-space:invalid-system-root",
      kind: "SystemSpace",
      frameKind: "SystemInertial",
      frameDefinition: {
        frameId: fixture.system.frameId,
        kind: "SystemInertial",
        parentFrameId,
        canonicalAuthority: true
      },
      frameState
    } as unknown as Parameters<typeof createPhysicsSpaceDescriptor>[0]);
    const shiftedRoot = createFrameStateAtTime({
      ...fixture.system,
      originPositionMeters: { x: 1, y: 0, z: 0 }
    });
    const movingRoot = createFrameStateAtTime({
      ...fixture.system,
      originVelocityMetersPerSecond: { x: 0, y: 1, z: 0 }
    });
    const rotatedRoot = createFrameStateAtTime({
      ...fixture.system,
      orientation: createQuaternionFromAxisAngle(spatialVector3(0, 0, 1), 0.25),
      angularVelocityRadiansPerSecond: { x: 0, y: 0, z: 0.5 }
    });

    expect(createSystemDescriptor(shiftedRoot)).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "FRAME_MISMATCH", path: "/frameState" })
    );
    expect(createSystemDescriptor(movingRoot)).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "FRAME_MISMATCH", path: "/frameState" })
    );
    expect(createSystemDescriptor(rotatedRoot)).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "FRAME_MISMATCH", path: "/frameState" })
    );
    expect(createSystemDescriptor(fixture.system, fixture.inertial.frameId)).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({
        code: "FRAME_MISMATCH",
        path: "/frameDefinition/parentFrameId"
      })
    );
  });

  it("preserves absolute position, velocity, actor orientation, and angular velocity without snap or zeroing", () => {
    const fixture = fixtureAt();
    const sourceState = createSpatialKinematicState({
      positionMeters: {
        x: fixture.surface.originPositionMeters.x + 35,
        y: fixture.surface.originPositionMeters.y - 12,
        z: fixture.surface.originPositionMeters.z + 7
      },
      velocityMetersPerSecond: { x: 172.5, y: -44.25, z: 13.75 },
      orientation: createQuaternionFromAxisAngle(spatialVector3(1, 2, -1), 0.73),
      angularVelocityRadiansPerSecond: { x: 0.03, y: -0.02, z: 0.07 }
    });
    const callerRequest = {
      sourceSpace: fixture.systemSpace,
      targetSpace: fixture.surfaceSpace,
      sourceState,
      sourceGravityBindingIds: [STARTER_BODY_IDS.hestia],
      targetGravityBindingIds: [STARTER_BODY_IDS.luma, STARTER_BODY_IDS.hestia]
    } as const;
    const before = structuredClone(callerRequest);
    const result = handoffPhysicsSpace(callerRequest);
    const reconstructed = transformKinematicState(
      result.targetState,
      fixture.surface,
      fixture.system
    );

    expect(result.sourceSpaceId).toBe(fixture.systemSpace.spaceId);
    expect(result.targetSpaceId).toBe(fixture.surfaceSpace.spaceId);
    expect(result.sourceFrameId).toBe(fixture.system.frameId);
    expect(result.targetFrameId).toBe(fixture.surface.frameId);
    expect(result.time).toEqual(fixture.time);
    expect(result.targetState.frameId).toBe(fixture.surface.frameId);
    expect(result.targetState.time).toEqual(fixture.time);
    expect(result.absoluteState.frameId).toBe(fixture.system.frameId);
    expect(vectorError(result.absoluteState.positionMeters, sourceState.positionMeters)).toBeLessThanOrEqual(1e-5);
    expect(vectorError(result.absoluteState.velocityMetersPerSecond, sourceState.velocityMetersPerSecond)).toBeLessThanOrEqual(1e-9);
    expect(quaternionAngularDistanceRadians(result.absoluteState.orientation, sourceState.orientation)).toBeLessThanOrEqual(1e-10);
    expect(vectorError(result.absoluteState.angularVelocityRadiansPerSecond, sourceState.angularVelocityRadiansPerSecond)).toBeLessThanOrEqual(1e-12);
    expect(vectorError(reconstructed.positionMeters, sourceState.positionMeters)).toBeLessThanOrEqual(1e-5);
    expect(vectorError(reconstructed.velocityMetersPerSecond, sourceState.velocityMetersPerSecond)).toBeLessThanOrEqual(1e-9);
    expect(quaternionAngularDistanceRadians(reconstructed.orientation, sourceState.orientation)).toBeLessThanOrEqual(1e-10);
    expect(vectorError(reconstructed.angularVelocityRadiansPerSecond, sourceState.angularVelocityRadiansPerSecond)).toBeLessThanOrEqual(1e-12);
    expect(result.targetState.velocityMetersPerSecond).not.toEqual(spatialVector3());
    expect(result.targetState.angularVelocityRadiansPerSecond).not.toEqual(spatialVector3());
    expect(result.gravityBindingsChanged).toBe(true);
    expect(result.sourceGravityBindingIds).toEqual([STARTER_BODY_IDS.hestia]);
    expect(result.targetGravityBindingIds).toEqual([STARTER_BODY_IDS.luma, STARTER_BODY_IDS.hestia]);
    expect(callerRequest).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.targetState)).toBe(true);
  });

  it("keeps gravity bindings unchanged unless the request changes them explicitly", () => {
    const fixture = fixtureAt();
    const sourceState = createSpatialKinematicState({
      positionMeters: fixture.inertial.originPositionMeters,
      velocityMetersPerSecond: fixture.inertial.originVelocityMetersPerSecond,
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocityRadiansPerSecond: { x: 0.01, y: 0.02, z: 0.03 }
    });
    const result = handoffPhysicsSpace({
      sourceSpace: fixture.systemSpace,
      targetSpace: fixture.bodySpace,
      sourceState,
      sourceGravityBindingIds: [STARTER_BODY_IDS.hestia],
      targetGravityBindingIds: [STARTER_BODY_IDS.hestia]
    });

    expect(result.gravityBindingsChanged).toBe(false);
    expect(result.sourceGravityBindingIds).toEqual(result.targetGravityBindingIds);
  });

  it("rejects different epochs, RenderRelative authority, and incompatible space/frame kinds", () => {
    const fixture = fixtureAt();
    const next = fixtureAt(30_001);
    const state = createSpatialKinematicState({
      positionMeters: { x: 1, y: 2, z: 3 },
      velocityMetersPerSecond: { x: 4, y: 5, z: 6 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocityRadiansPerSecond: { x: 0.1, y: 0.2, z: 0.3 }
    });

    expect(() =>
      handoffPhysicsSpace({
        sourceSpace: fixture.systemSpace,
        targetSpace: next.surfaceSpace,
        sourceState: state,
        sourceGravityBindingIds: [],
        targetGravityBindingIds: []
      })
    ).toThrow();

    expect(() =>
      createPhysicsSpaceDescriptor({
        spaceId: "physics-space:render-relative",
        kind: "BodyLocalSpace",
        frameKind: "RenderRelative",
        frameDefinition: {
          frameId: fixture.fixed.frameId,
          kind: "RenderRelative",
          parentFrameId: fixture.inertial.frameId,
          canonicalAuthority: false
        },
        frameState: fixture.fixed
      })
    ).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "UNSUPPORTED_FRAME_AUTHORITY" })
    );

    expect(() =>
      createPhysicsSpaceDescriptor({
        spaceId: "physics-space:bad-pair",
        kind: "SystemSpace",
        frameKind: "BodyFixed",
        frameDefinition: {
          frameId: fixture.fixed.frameId,
          kind: "BodyFixed",
          parentFrameId: fixture.inertial.frameId,
          canonicalAuthority: true
        },
        frameState: fixture.fixed
      })
    ).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "INVALID_PHYSICS_SPACE_KIND" })
    );

    expect(() =>
      createPhysicsSpaceDescriptor({
        spaceId: "physics-space:lying-kind",
        kind: "SurfaceLocalSpace",
        frameKind: "SurfaceLocal",
        frameDefinition: {
          frameId: fixture.surface.frameId,
          kind: "RenderRelative",
          parentFrameId: fixture.fixed.frameId,
          canonicalAuthority: false
        },
        frameState: fixture.surface
      })
    ).toThrowError(expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "UNSUPPORTED_FRAME_AUTHORITY" }));

    expect(() =>
      createPhysicsSpaceDescriptor({
        spaceId: "physics-space:wrong-frame-id",
        kind: "SurfaceLocalSpace",
        frameKind: "SurfaceLocal",
        frameDefinition: {
          frameId: fixture.fixed.frameId,
          kind: "SurfaceLocal",
          parentFrameId: fixture.fixed.frameId,
          canonicalAuthority: true
        },
        frameState: fixture.surface
      })
    ).toThrowError(expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "FRAME_MISMATCH" }));
  });

  it("fails closed when reconstruction exceeds explicitly supplied zero tolerance", () => {
    const fixture = fixtureAt();
    const lossyFrame = createFrameStateAtTime({
      frameId: "frame:surface.lossy",
      systemFrameId: fixture.system.frameId,
      time: fixture.time,
      originPositionMeters: { x: 1e16, y: -1e16, z: 1e16 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      originVelocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      angularVelocityRadiansPerSecond: { x: 0, y: 0, z: 0 }
    });
    const lossySpace = createPhysicsSpaceDescriptor({
      spaceId: "physics-space:lossy",
      kind: "SurfaceLocalSpace",
      frameKind: "SurfaceLocal",
      frameDefinition: {
        frameId: lossyFrame.frameId,
        kind: "SurfaceLocal",
        parentFrameId: fixture.system.frameId,
        canonicalAuthority: true
      },
      frameState: lossyFrame
    });

    expect(() =>
      handoffPhysicsSpace({
        sourceSpace: fixture.systemSpace,
        targetSpace: lossySpace,
        sourceState: {
          positionMeters: { x: 1, y: 1, z: 1 },
          velocityMetersPerSecond: { x: 1, y: 1, z: 1 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          angularVelocityRadiansPerSecond: { x: 0.1, y: 0.2, z: 0.3 }
        },
        sourceGravityBindingIds: [],
        targetGravityBindingIds: [],
        tolerances: {
          positionAbsoluteMeters: 0,
          velocityAbsoluteMetersPerSecond: 0,
          orientationRadians: 0,
          angularVelocityAbsoluteRadiansPerSecond: 0,
          relative: 0
        }
      })
    ).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "HANDOFF_TOLERANCE_EXCEEDED" })
    );
  });
});
