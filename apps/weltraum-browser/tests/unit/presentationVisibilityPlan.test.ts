import { describe, expect, it } from "vitest";
import {
  createVisibilityPlan,
  representationKey,
  resolveVisibility,
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
});
