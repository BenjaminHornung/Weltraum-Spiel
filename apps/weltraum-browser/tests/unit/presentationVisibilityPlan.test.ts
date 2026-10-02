import { describe, expect, it } from "vitest";
import {
  backendRevision,
  createFrameProjectionSnapshot,
  createRenderCommand,
  createVisibilityPlan,
  ephemeralRepresentationKey,
  frameId,
  frameRevision,
  representationKey,
  resolveVisibility,
  validateFrameProjectionSnapshot,
  validateRenderCommand,
  validateVisibilityPlan,
  visibilityPlanRevision,
  visibilityPlanSignature
} from "../../src/presentation";

const parent = representationKey("planet:parent");
const child = representationKey("planet:child");

describe("VisibilityPlan", () => {
  it("keeps a ready parent fallback visible while a requested child is missing", () => {
    const plan = createVisibilityPlan({
      planRevision: visibilityPlanRevision(1),
      visibleRepresentationKeys: [child],
      fallbackRepresentationKeys: [parent],
      hiddenRepresentationKeys: []
    });
    const resolved = resolveVisibility(plan, new Set([parent]), new Set([parent]));
    expect(resolved.visibleRepresentationKeys).toEqual([parent]);
    expect(resolved.pinnedFallbackRepresentationKeys).toEqual([parent]);
    expect(resolved.allRequestedPrimariesReady).toBe(false);
  });

  it("switches to an available projected child while keeping its fallback pinned", () => {
    const plan = createVisibilityPlan({
      planRevision: visibilityPlanRevision(2),
      visibleRepresentationKeys: [child],
      fallbackRepresentationKeys: [parent],
      hiddenRepresentationKeys: []
    });
    const ready = new Set([parent, child]);
    const resolved = resolveVisibility(plan, ready, ready);
    expect(resolved.visibleRepresentationKeys).toEqual([child]);
    expect(resolved.pinnedFallbackRepresentationKeys).toEqual([parent]);
    expect(resolved.allRequestedPrimariesReady).toBe(true);
  });

  it("keeps the projected parent when the child is resident but lacks a frame transform", () => {
    const plan = createVisibilityPlan({
      planRevision: visibilityPlanRevision(6),
      visibleRepresentationKeys: [child],
      fallbackRepresentationKeys: [parent],
      hiddenRepresentationKeys: []
    });
    const resolved = resolveVisibility(plan, new Set([parent, child]), new Set([parent]));
    expect(resolved.visibleRepresentationKeys).toEqual([parent]);
    expect(resolved.allRequestedPrimariesReady).toBe(false);
  });

  it("canonicalizes set order and rejects overlap between plan roles", () => {
    const first = createVisibilityPlan({
      planRevision: visibilityPlanRevision(3),
      visibleRepresentationKeys: [representationKey("mesh:z"), child, child],
      fallbackRepresentationKeys: [parent],
      hiddenRepresentationKeys: []
    });
    const second = createVisibilityPlan({
      planRevision: visibilityPlanRevision(3),
      visibleRepresentationKeys: [child, representationKey("mesh:z")],
      fallbackRepresentationKeys: [parent],
      hiddenRepresentationKeys: []
    });
    expect(first.visibleRepresentationKeys).toEqual([representationKey("mesh:z"), child]);
    expect(visibilityPlanSignature(first)).toBe(visibilityPlanSignature(second));

    const overlap = validateVisibilityPlan({
      planRevision: visibilityPlanRevision(4),
      visibleRepresentationKeys: [child],
      fallbackRepresentationKeys: [child],
      hiddenRepresentationKeys: []
    });
    expect(overlap.valid).toBe(false);
    if (!overlap.valid) expect(overlap.issues.map((entry) => entry.code)).toContain("OverlappingVisibilityKey");
  });

  it("does not expose resident keys omitted by the plan", () => {
    const omitted = representationKey("planet:omitted");
    const plan = createVisibilityPlan({
      planRevision: visibilityPlanRevision(5),
      visibleRepresentationKeys: [child],
      fallbackRepresentationKeys: [parent],
      hiddenRepresentationKeys: [omitted]
    });
    const ready = new Set([parent, child, omitted]);
    expect(resolveVisibility(plan, ready, ready).visibleRepresentationKeys).toEqual([child]);
  });

  it("validates ephemeral keys in visibility sets and transform snapshots", () => {
    const fragment = ephemeralRepresentationKey({ kind: "fragment" }, 1, 1);
    const plan = createVisibilityPlan({
      planRevision: visibilityPlanRevision(7),
      visibleRepresentationKeys: [fragment],
      fallbackRepresentationKeys: [],
      hiddenRepresentationKeys: []
    });
    expect(validateVisibilityPlan(plan)).toEqual({ valid: true });

    const snapshot = createFrameProjectionSnapshot({
      frameId: frameId("camera:local"),
      frameRevision: frameRevision(1),
      cameraPositionRelative: { x: 0, y: 0, z: 3 },
      cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
      projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: 1, near: 0.1, far: 100 },
      representationTransforms: [{
        representationKey: fragment,
        positionRelative: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      }]
    });
    expect(validateFrameProjectionSnapshot(snapshot)).toEqual({ valid: true });
    expect(validateRenderCommand(createRenderCommand({
      kind: "ApplyFrameProjection",
      backendRevision: backendRevision(0),
      snapshot
    }))).toEqual({ valid: true });
  });
});
