import { describe, expect, it } from "vitest";
import {
  createMaterialProfile,
  frameId,
  materialProfileId,
  representationKey,
  sourceRevision,
  artifactRevision,
  createMeshArtifact,
  validateMeshArtifact,
  type MeshArtifact
} from "../../src/presentation";
import { prepareThreeMesh } from "../../src/render/three/backend/threeMeshFactory";
import { ThreeMaterialFactory } from "../../src/render/three/backend/threeMaterialFactory";

const testProfile = (id: string) =>
  createMaterialProfile({
    id: materialProfileId(id),
    kind: "BasicLit",
    baseColor: { r: 0.5, g: 0.5, b: 0.5 },
    opacity: 1,
    doubleSided: true,
    wireframe: false,
    depthWrite: true
  });

const quadArtifact = (withColor: boolean): MeshArtifact =>
  createMeshArtifact({
    representationKey: representationKey("test:quad"),
    sourceRevision: sourceRevision(1),
    artifactRevision: artifactRevision(0),
    algorithmVersion: "test-quad-v1",
    frameId: frameId("test:frame"),
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    materialRanges: [{ materialProfileId: materialProfileId("test:mat"), startIndex: 0, indexCount: 6 }],
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
    attributes: withColor
      ? { color: new Float32Array([1, 1, 1, 0.8, 0.8, 0.8, 0.6, 0.6, 0.6, 0.4, 0.4, 0.4]) }
      : undefined
  });

describe("ThreeMaterialFactory vertex-color variants", () => {
  it("renders uncolored profiles without vertex colors by default", () => {
    const factory = new ThreeMaterialFactory();
    const lease = factory.acquire([testProfile("test:mat")]);
    try {
      expect(lease.materials).toHaveLength(1);
      expect((lease.materials[0] as { vertexColors?: boolean }).vertexColors).toBe(false);
      expect(factory.allocations).toBe(1);
    } finally {
      lease.release();
    }
    expect(factory.disposals).toBe(1);
  });

  it("serves colored and uncolored variants of one profile id without conflict", () => {
    const factory = new ThreeMaterialFactory();
    const plain = factory.acquire([testProfile("test:mat")]);
    const colored = factory.acquire([testProfile("test:mat")], { vertexColors: true });
    try {
      expect((plain.materials[0] as { vertexColors?: boolean }).vertexColors).toBe(false);
      expect((colored.materials[0] as { vertexColors?: boolean }).vertexColors).toBe(true);
      expect(colored.materials[0]).not.toBe(plain.materials[0]);
      expect((colored.materials[0] as { color?: { r: number } }).color?.r).toBe(
        (plain.materials[0] as { color?: { r: number } }).color?.r
      );
      expect(factory.allocations).toBe(2);
    } finally {
      colored.release();
      plain.release();
    }
    expect(factory.disposals).toBe(2);
  });

  it("keeps variant flags correct across toggle-like reacquire sequences", () => {
    const factory = new ThreeMaterialFactory();
    const profile = testProfile("test:mat");
    const colored = factory.acquire([profile], { vertexColors: true });
    const plain = factory.acquire([profile]);
    const coloredAgain = factory.acquire([profile], { vertexColors: true });
    try {
      expect((colored.materials[0] as { vertexColors?: boolean }).vertexColors).toBe(true);
      expect((plain.materials[0] as { vertexColors?: boolean }).vertexColors).toBe(false);
      expect((coloredAgain.materials[0] as { vertexColors?: boolean }).vertexColors).toBe(true);
      expect(coloredAgain.materials[0]).toBe(colored.materials[0]);
      expect(plain.materials[0]).not.toBe(colored.materials[0]);
    } finally {
      coloredAgain.release();
      plain.release();
      colored.release();
    }
    expect(factory.disposals).toBe(2);
  });

  it("shares variant entries regardless of acquisition order and still rejects conflicts", () => {
    const factory = new ThreeMaterialFactory();
    const coloredFirst = factory.acquire([testProfile("test:mat")], { vertexColors: true });
    const coloredSecond = factory.acquire([testProfile("test:mat")], { vertexColors: true });
    try {
      expect(coloredSecond.materials[0]).toBe(coloredFirst.materials[0]);
      expect(factory.allocations).toBe(1);
    } finally {
      coloredSecond.release();
      coloredFirst.release();
    }
    const divergent = { ...testProfile("test:mat"), opacity: 0.5 };
    expect(() => factory.acquire([divergent])).toThrow(/conflict/i);
  });

  it("enables vertex colors through prepareThreeMesh only when the artifact carries color", () => {
    const factory = new ThreeMaterialFactory();
    const profiles = [testProfile("test:mat")];
    const uncolored = prepareThreeMesh(quadArtifact(false), profiles, factory);
    try {
      expect(uncolored.geometry.getAttribute("color")).toBeUndefined();
      expect((uncolored.sceneNode.material as readonly { vertexColors?: boolean }[])[0]?.vertexColors).toBe(false);
    } finally {
      uncolored.dispose();
    }
    const colored = prepareThreeMesh(quadArtifact(true), profiles, factory);
    try {
      expect(colored.geometry.getAttribute("color")).toBeDefined();
      expect((colored.sceneNode.material as readonly { vertexColors?: boolean }[])[0]?.vertexColors).toBe(true);
    } finally {
      colored.dispose();
    }
    expect(factory.disposals).toBe(2);
  });

  it("rejects malformed color attributes fail-closed at the artifact boundary", () => {
    const valid = quadArtifact(true);
    expect(validateMeshArtifact(valid)).toEqual({ valid: true });
    const short = { ...valid, attributes: { color: new Float32Array([1, 1, 1]) } };
    const shortResult = validateMeshArtifact(short);
    expect(shortResult.valid).toBe(false);
    if (!shortResult.valid) {
      expect(shortResult.issues.some((entry) => entry.path.includes("color"))).toBe(true);
    }
    const nonFinite = {
      ...valid,
      attributes: { color: new Float32Array([1, 1, Number.NaN, 1, 1, 1, 1, 1, 1, 1, 1, 1]) }
    };
    const nonFiniteResult = validateMeshArtifact(nonFinite);
    expect(nonFiniteResult.valid).toBe(false);
    if (!nonFiniteResult.valid) {
      expect(nonFiniteResult.issues.some((entry) => entry.path.includes("color"))).toBe(true);
    }
    expect(() =>
      createMeshArtifact({
        ...valid,
        attributes: { color: new Float32Array([1, 1, 1]) }
      })
    ).toThrow();
  });
});
