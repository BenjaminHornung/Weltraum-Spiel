import { describe, expect, it } from "vitest";
import {
  REPRESENTATION_MAX_FALLBACK_CHILDREN,
  REPRESENTATION_MAX_FALLBACK_GROUPS,
  resolveAtomicFallback,
  resolveAtomicFallbackGroups,
  type AtomicFallbackChild
} from "../../src/voxel/representation";

const children = (count: number, revision = 4): AtomicFallbackChild[] => Array.from({ length: count }, (_, index) => ({
  childId: `child.${String(index).padStart(2, "0")}`,
  revision,
  readiness: "Ready" as const
}));

const group = (count: number, childValues: readonly AtomicFallbackChild[] = children(count)) => ({
  groupId: "fallback.planet.0",
  parent: { parentId: "parent.coarse", revision: 4, readiness: "Ready" as const },
  revision: 4,
  requiredChildIds: children(64).map((child) => child.childId),
  children: childValues
});

describe("voxel representation atomic fallback", () => {
  it("retains the parent for zero, partial, and 63-of-64 children", () => {
    for (const count of [0, 1, 63]) {
      expect(resolveAtomicFallback(group(count))).toEqual({
        groupId: "fallback.planet.0",
        settledCoverage: "Parent",
        parentId: "parent.coarse",
        childIds: [],
        reason: "ParentRetainedUntilAtomicReplacement"
      });
    }
  });

  it("atomically replaces the parent only with all 64 current same-revision ready children", () => {
    const complete = resolveAtomicFallback({ ...group(64), parent: null });
    expect(complete).toMatchObject({ settledCoverage: "Children", parentId: null, reason: "AllRequiredCurrentChildrenReady" });
    if (complete.settledCoverage !== "Children") throw new Error("Expected children.");
    expect(complete.childIds).toHaveLength(64);
    expect(complete.childIds).toEqual([...complete.childIds].sort());
  });

  it("fails closed when incomplete children have no ready parent at the group revision", () => {
    for (const parent of [
      null,
      { parentId: "parent.coarse", revision: 4, readiness: "Stale" as const },
      { parentId: "parent.coarse", revision: 3, readiness: "Ready" as const }
    ]) {
      let fallbackError: unknown;
      try {
        resolveAtomicFallback({ ...group(63), parent });
      } catch (error) {
        fallbackError = error;
      }
      expect(fallbackError).toMatchObject({ code: "InvalidFallback", path: "fallback/parent" });
    }
  });

  it("snapshots proxy-backed parent evidence once before deciding fallback coverage", () => {
    let parentReads = 0;
    let readinessReads = 0;
    const parent = new Proxy(
      { parentId: "parent.coarse", revision: 4, readiness: "Stale" },
      {
        get(target, property, receiver) {
          if (property === "readiness") {
            readinessReads += 1;
            return readinessReads === 1 ? "Stale" : "Ready";
          }
          return Reflect.get(target, property, receiver);
        }
      }
    );
    const value = new Proxy(group(63), {
      get(target, property, receiver) {
        if (property === "parent") {
          parentReads += 1;
          return parent;
        }
        return Reflect.get(target, property, receiver);
      }
    });

    let fallbackError: unknown;
    try {
      resolveAtomicFallback(value);
    } catch (error) {
      fallbackError = error;
    }
    expect(fallbackError).toMatchObject({ code: "InvalidFallback", path: "fallback/parent" });
    expect(parentReads).toBe(1);
    expect(readinessReads).toBe(1);
  });

  it("snapshots proxy-backed child evidence once before deciding fallback coverage", () => {
    let readinessReads = 0;
    const staleChild = new Proxy(
      { childId: "child.00", revision: 4, readiness: "Stale" },
      {
        get(target, property, receiver) {
          if (property === "readiness") {
            readinessReads += 1;
            return readinessReads === 1 ? "Stale" : "Ready";
          }
          return Reflect.get(target, property, receiver);
        }
      }
    );
    const childValues = children(64);
    childValues[0] = staleChild as AtomicFallbackChild;

    let fallbackError: unknown;
    try {
      resolveAtomicFallback({ ...group(64, childValues), parent: null });
    } catch (error) {
      fallbackError = error;
    }
    expect(fallbackError).toMatchObject({ code: "InvalidFallback", path: "fallback/parent" });
    expect(readinessReads).toBe(1);
  });

  it("rejects the legacy bare parent ID and inexact nested parent records", () => {
    const { parent: _parent, ...withoutParent } = group(0);
    expect(() => resolveAtomicFallback({ ...withoutParent, parentId: "parent.coarse" })).toThrow();
    expect(() => resolveAtomicFallback({
      ...group(0),
      parent: { parentId: "parent.coarse", revision: 4, readiness: "Ready", unexpected: true }
    })).toThrow();
    expect(() => resolveAtomicFallback({
      ...group(0),
      parent: { parentId: "parent.coarse", revision: 4 }
    })).toThrow();
  });

  it("retains the parent for stale, invalid, cancelled, incomplete, or mixed-revision children", () => {
    for (const readiness of ["Stale", "Invalid", "Cancelled", "Incomplete"] as const) {
      const values = children(64);
      values[12] = { ...values[12], readiness };
      expect(resolveAtomicFallback(group(64, values))).toMatchObject({ settledCoverage: "Parent" });
    }
    expect(resolveAtomicFallback(group(64, children(64).map((child, index) => index === 63 ? { ...child, revision: 3 } : child)))).toMatchObject({ settledCoverage: "Parent" });
    expect(resolveAtomicFallback(group(64, children(64).map((child, index) => index === 63 ? { ...child, childId: "child.other" } : child)))).toMatchObject({ settledCoverage: "Parent" });
  });

  it("enforces finite child and group caps before publication", () => {
    expect(() => resolveAtomicFallback({
      ...group(0),
      requiredChildIds: Array.from({ length: REPRESENTATION_MAX_FALLBACK_CHILDREN + 1 }, (_, index) => `child.${index}`)
    })).toThrow();
    let requiredChildReads = 0;
    const requiredChildIds = ["child.00"];
    Object.defineProperty(requiredChildIds, "0", { enumerable: true, get: () => { requiredChildReads += 1; throw new Error("must not read"); } });
    let capError: unknown;
    try {
      resolveAtomicFallback({
        ...group(0),
        requiredChildIds,
        children: Array.from({ length: REPRESENTATION_MAX_FALLBACK_CHILDREN + 1 }, () => children(1)[0])
      });
    } catch (error) {
      capError = error;
    }
    expect(capError).toMatchObject({ path: "fallback/children" });
    expect(requiredChildReads).toBe(0);
    expect(() => resolveAtomicFallbackGroups(Array.from({ length: REPRESENTATION_MAX_FALLBACK_GROUPS + 1 }, () => group(0)))).toThrow();
  });

  it("rejects duplicate group IDs before publishing mixed settled coverage", () => {
    expect(() => resolveAtomicFallbackGroups([
      group(64),
      { ...group(0), parent: { parentId: "parent.other", revision: 4, readiness: "Ready" } }
    ])).toThrow();
  });
});
