import { describe, expect, it } from "vitest";
import { hashAdaptiveCanonical, isDeepFrozen } from "../../src/voxel/adaptive";
import {
  checkObjectProxyCurrentSource,
  checkSurfaceProxyCurrentSource,
  createObjectProxyIdentity,
  createSurfaceProxyIdentity
} from "../../src/voxel/representation";

const hash = (value: string) => hashAdaptiveCanonical({ value });

describe("voxel representation revision-bound proxies", () => {
  it("binds object/Structural/damage identity and excludes transient selection metadata", () => {
    const source = {
      objectId: "object.ship",
      objectRevision: 7,
      structuralContentHash: hash("structural"),
      damageDigest: "damage.3",
      bandId: "band.proxy",
      proxyAlgorithmVersion: "proxy.v2"
    };
    const first = createObjectProxyIdentity(source);
    const second = createObjectProxyIdentity({ ...source });
    expect(first).toEqual(second);
    expect(isDeepFrozen(first)).toBe(true);
    expect(first).not.toHaveProperty("camera");
    expect(first).not.toHaveProperty("distance");
    expect(first).not.toHaveProperty("quality");
    expect(first).not.toHaveProperty("fov");
  });

  it("rejects stale revisions, mismatched Structural hashes, and old intact proxies after damage", () => {
    const proxy = createObjectProxyIdentity({
      objectId: "object.ship", objectRevision: 1, structuralContentHash: hash("intact"), damageDigest: "intact",
      bandId: "band.proxy", proxyAlgorithmVersion: "proxy.v2"
    });
    const current = {
      objectId: proxy.objectId, objectRevision: proxy.objectRevision, structuralContentHash: proxy.structuralContentHash,
      damageDigest: proxy.damageDigest, bandId: proxy.bandId, proxyAlgorithmVersion: proxy.proxyAlgorithmVersion
    };
    expect(checkObjectProxyCurrentSource(proxy, { ...current, objectRevision: 2, structuralContentHash: hash("damaged"), damageDigest: "damage.1" })).toMatchObject({ code: "StaleObjectRevision" });
    expect(checkObjectProxyCurrentSource(proxy, { ...current, structuralContentHash: hash("damaged") })).toMatchObject({ code: "StructuralContentHashMismatch" });
    expect(checkObjectProxyCurrentSource(proxy, { ...current, damageDigest: "damage.1" })).toMatchObject({ code: "DamageDigestMismatch" });
  });

  it("rejects tampered object and surface proxy content hashes", () => {
    const objectProxy = createObjectProxyIdentity({
      objectId: "object.ship", objectRevision: 1, structuralContentHash: hash("intact"), damageDigest: "intact",
      bandId: "band.proxy", proxyAlgorithmVersion: "proxy.v2"
    });
    const surfaceProxy = createSurfaceProxyIdentity({
      bodyId: "planet.test", surfaceFrameId: "frame.surface", locationKind: "Tile", locationId: "tile.4.5",
      generatorVersion: "generator.v2", sourceRevision: 10, editRevision: 3, sourceContentHash: hash("surface"),
      bandId: "band.tile", proxyAlgorithmVersion: "tile-proxy.v2"
    });

    expect(checkObjectProxyCurrentSource(
      { ...objectProxy, proxyContentHash: hash("tampered") },
      {
        objectId: objectProxy.objectId, objectRevision: objectProxy.objectRevision,
        structuralContentHash: objectProxy.structuralContentHash, damageDigest: objectProxy.damageDigest,
        bandId: objectProxy.bandId, proxyAlgorithmVersion: objectProxy.proxyAlgorithmVersion
      }
    )).toEqual({ status: "Rejected", code: "ProxyContentHashMismatch" });
    expect(checkSurfaceProxyCurrentSource(
      { ...surfaceProxy, proxyContentHash: hash("tampered") },
      {
        bodyId: surfaceProxy.bodyId, surfaceFrameId: surfaceProxy.surfaceFrameId,
        locationKind: surfaceProxy.locationKind, locationId: surfaceProxy.locationId,
        generatorVersion: surfaceProxy.generatorVersion, sourceRevision: surfaceProxy.sourceRevision,
        editRevision: surfaceProxy.editRevision, sourceContentHash: surfaceProxy.sourceContentHash,
        bandId: surfaceProxy.bandId, proxyAlgorithmVersion: surfaceProxy.proxyAlgorithmVersion
      }
    )).toEqual({ status: "Rejected", code: "ProxyContentHashMismatch" });
  });

  it("rejects unsupported proxy schemas and non-exact proxy records before current-source hashing", () => {
    const objectProxy = createObjectProxyIdentity({
      objectId: "object.ship", objectRevision: 1, structuralContentHash: hash("intact"), damageDigest: "intact",
      bandId: "band.proxy", proxyAlgorithmVersion: "proxy.v2"
    });
    const objectCurrent = {
      objectId: objectProxy.objectId, objectRevision: objectProxy.objectRevision,
      structuralContentHash: objectProxy.structuralContentHash, damageDigest: objectProxy.damageDigest,
      bandId: objectProxy.bandId, proxyAlgorithmVersion: objectProxy.proxyAlgorithmVersion
    };
    const forgedObjectPayload = { ...objectProxy, schemaVersion: "forged-object-v99" };
    const { proxyContentHash: _objectHash, ...objectPayload } = forgedObjectPayload;
    const forgedObject = { ...objectPayload, proxyContentHash: hashAdaptiveCanonical(objectPayload) };
    expect(() => checkObjectProxyCurrentSource(forgedObject as never, objectCurrent)).toThrow();
    expect(() => checkObjectProxyCurrentSource({ ...objectProxy, unexpected: true } as never, objectCurrent)).toThrow();

    const surfaceProxy = createSurfaceProxyIdentity({
      bodyId: "planet.test", surfaceFrameId: "frame.surface", locationKind: "Tile", locationId: "tile.4.5",
      generatorVersion: "generator.v2", sourceRevision: 10, editRevision: 3, sourceContentHash: hash("surface"),
      bandId: "band.tile", proxyAlgorithmVersion: "tile-proxy.v2"
    });
    const surfaceCurrent = {
      bodyId: surfaceProxy.bodyId, surfaceFrameId: surfaceProxy.surfaceFrameId, locationKind: surfaceProxy.locationKind,
      locationId: surfaceProxy.locationId, generatorVersion: surfaceProxy.generatorVersion,
      sourceRevision: surfaceProxy.sourceRevision, editRevision: surfaceProxy.editRevision,
      sourceContentHash: surfaceProxy.sourceContentHash, bandId: surfaceProxy.bandId,
      proxyAlgorithmVersion: surfaceProxy.proxyAlgorithmVersion
    };
    const forgedSurfacePayload = { ...surfaceProxy, schemaVersion: "forged-surface-v99" };
    const { proxyContentHash: _surfaceHash, ...surfacePayload } = forgedSurfacePayload;
    const forgedSurface = { ...surfacePayload, proxyContentHash: hashAdaptiveCanonical(surfacePayload) };
    expect(() => checkSurfaceProxyCurrentSource(forgedSurface as never, surfaceCurrent)).toThrow();
    expect(() => checkSurfaceProxyCurrentSource({ ...surfaceProxy, unexpected: true } as never, surfaceCurrent)).toThrow();
  });

  it("rejects cross-object and product binding mismatches", () => {
    const proxy = createObjectProxyIdentity({
      objectId: "object.ship", objectRevision: 1, structuralContentHash: hash("intact"), damageDigest: "intact",
      bandId: "band.proxy", proxyAlgorithmVersion: "proxy.v2"
    });
    const current = {
      objectId: proxy.objectId, objectRevision: proxy.objectRevision, structuralContentHash: proxy.structuralContentHash,
      damageDigest: proxy.damageDigest, bandId: proxy.bandId, proxyAlgorithmVersion: proxy.proxyAlgorithmVersion
    };

    expect(checkObjectProxyCurrentSource(proxy, { ...current, objectId: "object.other" })).toMatchObject({ code: "ObjectIdMismatch" });
    expect(checkObjectProxyCurrentSource(proxy, { ...current, bandId: "band.other" })).toMatchObject({ code: "BandIdMismatch" });
    expect(checkObjectProxyCurrentSource(proxy, { ...current, proxyAlgorithmVersion: "proxy.v3" })).toMatchObject({ code: "ProxyAlgorithmVersionMismatch" });
  });

  it("binds region/tile generator, source, edit, and source-hash revisions", () => {
    const proxy = createSurfaceProxyIdentity({
      bodyId: "planet.test", surfaceFrameId: "frame.surface", locationKind: "Tile", locationId: "tile.4.5",
      generatorVersion: "generator.v2", sourceRevision: 10, editRevision: 3, sourceContentHash: hash("surface"),
      bandId: "band.tile", proxyAlgorithmVersion: "tile-proxy.v2"
    });
    const current = {
      bodyId: proxy.bodyId, surfaceFrameId: proxy.surfaceFrameId, locationKind: proxy.locationKind,
      locationId: proxy.locationId, generatorVersion: proxy.generatorVersion, sourceRevision: proxy.sourceRevision,
      editRevision: proxy.editRevision, sourceContentHash: proxy.sourceContentHash,
      bandId: proxy.bandId, proxyAlgorithmVersion: proxy.proxyAlgorithmVersion
    };
    expect(checkSurfaceProxyCurrentSource(proxy, current)).toEqual({ status: "Ready" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, sourceRevision: 9 })).toMatchObject({ code: "StaleSourceRevision" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, editRevision: 4 })).toMatchObject({ code: "StaleEditRevision" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, sourceContentHash: hash("other") })).toMatchObject({ code: "SourceContentHashMismatch" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, bodyId: "planet.other" })).toMatchObject({ code: "BodyIdMismatch" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, surfaceFrameId: "frame.other" })).toMatchObject({ code: "SurfaceFrameIdMismatch" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, locationKind: "Region" })).toMatchObject({ code: "LocationKindMismatch" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, locationId: "tile.other" })).toMatchObject({ code: "LocationIdMismatch" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, generatorVersion: "generator.v3" })).toMatchObject({ code: "GeneratorVersionMismatch" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, bandId: "band.other" })).toMatchObject({ code: "BandIdMismatch" });
    expect(checkSurfaceProxyCurrentSource(proxy, { ...current, proxyAlgorithmVersion: "tile-proxy.v3" })).toMatchObject({ code: "ProxyAlgorithmVersionMismatch" });
  });
});
