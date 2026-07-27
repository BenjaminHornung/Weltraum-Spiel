import { describe, expect, it, vi } from "vitest";
import {
  createRevisionBoundSurfaceCollisionPort,
  type SurfaceCollisionDelegate
} from "../../src/surface-play/collision";
import {
  createSurfaceGroundContactQuery,
  type SurfaceAuthorityBinding,
  type SurfaceGroundContactQuery
} from "../../src/surface-play/contracts";

const groundQuery = (regionRevision = 4, simulationTick = 12) => createSurfaceGroundContactQuery({
  kind: "GroundContact",
  queryId: `authority:ground:${regionRevision}:${simulationTick}`,
  bodyId: "body:hestia",
  regionId: "region:hestia-test",
  surfaceFrameId: "frame:hestia-test",
  regionRevision,
  simulationTick,
  capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
  positionMeters: { x: 0, y: 0.9, z: 0 },
  maximumDistanceMeters: 0.08
});

const bindingFrom = (query: SurfaceGroundContactQuery): SurfaceAuthorityBinding => ({
  bodyId: query.bodyId,
  regionId: query.regionId,
  surfaceFrameId: query.surfaceFrameId,
  regionRevision: query.regionRevision,
  simulationTick: query.simulationTick
});

const delegate = (queryGroundContact: SurfaceCollisionDelegate["queryGroundContact"]): SurfaceCollisionDelegate => ({
  queryGroundContact,
  sweepCapsule: (query) => ({ status: "Resolved", queryId: query.queryId, fraction: 1, contact: null }),
  queryRay: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null }),
  queryLine: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null })
});

describe("revision-bound surface collision authority", () => {
  it("resolves current bindings and preserves the query identity", () => {
    const query = groundQuery();
    const queryGroundContact = vi.fn<SurfaceCollisionDelegate["queryGroundContact"]>((value) => ({
      status: "Resolved",
      queryId: value.queryId,
      contact: {
        pointMeters: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 1, z: 0 },
        distanceMeters: 0,
        colliderId: "terrain:floor"
      }
    }));
    const port = createRevisionBoundSurfaceCollisionPort({
      readAuthorityBinding: () => bindingFrom(query),
      delegate: delegate(queryGroundContact)
    });

    const result = port.queryGroundContact(query);

    expect(result.status).toBe("Resolved");
    expect(result.queryId).toBe(query.queryId);
    expect(queryGroundContact).toHaveBeenCalledOnce();
  });

  it.each([
    ["BodyMismatch", { bodyId: "body:other" }],
    ["RegionMismatch", { regionId: "region:other" }],
    ["FrameMismatch", { surfaceFrameId: "frame:other" }],
    ["StaleRevision", { regionRevision: 5 }],
    ["StaleTick", { simulationTick: 13 }]
  ] as const)("rejects %s before invoking the delegate", (expectedCode, replacement) => {
    const query = groundQuery();
    const queryGroundContact = vi.fn<SurfaceCollisionDelegate["queryGroundContact"]>();
    const port = createRevisionBoundSurfaceCollisionPort({
      readAuthorityBinding: () => ({ ...bindingFrom(query), ...replacement }) as SurfaceAuthorityBinding,
      delegate: delegate(queryGroundContact)
    });

    const result = port.queryGroundContact(query);

    expect(result).toMatchObject({ status: "Rejected", code: expectedCode });
    expect(queryGroundContact).not.toHaveBeenCalled();
  });

  it("fails closed when the delegate returns NaN or a mismatched query id", () => {
    const query = groundQuery();
    const invalidPort = createRevisionBoundSurfaceCollisionPort({
      readAuthorityBinding: () => bindingFrom(query),
      delegate: delegate((value) => ({
        status: "Resolved",
        queryId: value.queryId,
        contact: {
          pointMeters: { x: Number.NaN, y: 0, z: 0 },
          normal: { x: 0, y: 1, z: 0 },
          distanceMeters: 0,
          colliderId: "terrain:floor"
        }
      }))
    });
    const mismatchedPort = createRevisionBoundSurfaceCollisionPort({
      readAuthorityBinding: () => bindingFrom(query),
      delegate: delegate(() => ({ status: "Resolved", queryId: "authority:other", contact: null }))
    });

    expect(invalidPort.queryGroundContact(query)).toMatchObject({
      status: "Rejected",
      code: "AuthorityUnavailable"
    });
    expect(mismatchedPort.queryGroundContact(query)).toMatchObject({
      status: "Rejected",
      code: "AuthorityUnavailable"
    });
  });
});
