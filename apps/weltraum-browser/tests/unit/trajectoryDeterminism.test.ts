import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createCompletedTrajectoryPredictionResult,
  createHestiaAccelerationImpulseTrajectoryRequest,
  createHestiaTrajectoryHazard,
  createRejectedTrajectoryPredictionResult,
  predictTrajectory,
  type TrajectoryPredictionRequest
} from "../../src/trajectory";

const expectRecursivelyFrozen = (value: unknown, seen = new WeakSet<object>()): void => {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectRecursivelyFrozen(descriptor.value, seen);
    }
  }
};

const collectTypeScriptSources = (directory: URL): readonly { readonly path: string; readonly source: string }[] => {
  const sources: { path: string; source: string }[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryUrl = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory);
    if (entry.isDirectory()) {
      sources.push(...collectTypeScriptSources(entryUrl));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      sources.push({ path: entryUrl.pathname, source: readFileSync(entryUrl, "utf8") });
    }
  }
  return sources;
};

describe("trajectory determinism and architecture", () => {
  it("returns identical canonical results and signatures for identical inputs", () => {
    const request = createHestiaAccelerationImpulseTrajectoryRequest();

    const first = predictTrajectory(request);
    const second = predictTrajectory(request);

    expect(first).toEqual(second);
    expect(first.canonicalSignature).toBe(second.canonicalSignature);
  });

  it("is invariant to hazard insertion order", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const firstHazard = createHestiaTrajectoryHazard("hazard:a-order");
    const secondHazard = createHestiaTrajectoryHazard("hazard:z-order");
    const forward = predictTrajectory({ ...base, hazards: [firstHazard, secondHazard] });
    const reverse = predictTrajectory({ ...base, hazards: [secondHazard, firstHazard] });

    expect(forward.status).toBe("Completed");
    expect(reverse.status).toBe("Completed");
    if (forward.status !== "Completed" || reverse.status !== "Completed") {
      throw new Error("Hazard insertion-order fixtures must both complete before canonical comparison.");
    }
    expect(forward).toEqual(reverse);
    expect(forward.canonicalSignature).toBe(reverse.canonicalSignature);
  });

  it("does not mutate caller-owned input", () => {
    const request: TrajectoryPredictionRequest = structuredClone(createHestiaAccelerationImpulseTrajectoryRequest());
    const segmentsReference = request.segments;
    const initialStateReference = request.initialState;
    const before = structuredClone(request);

    predictTrajectory(request);

    expect(request).toEqual(before);
    expect(request.segments).toBe(segmentsReference);
    expect(request.initialState).toBe(initialStateReference);
  });

  it("returns a recursively immutable result", () => {
    const result = predictTrajectory(createHestiaAccelerationImpulseTrajectoryRequest());

    expectRecursivelyFrozen(result);
  });

  it("excludes a stale own canonicalSignature from completed-result signing", () => {
    const request = createHestiaAccelerationImpulseTrajectoryRequest();
    const completed = predictTrajectory(request);
    if (completed.status !== "Completed") {
      throw new Error("Expected completed fixture result.");
    }
    const stalePayload = { ...completed, canonicalSignature: "fnv1a32:00000000" };

    const clean = createCompletedTrajectoryPredictionResult(request, completed);
    const stale = createCompletedTrajectoryPredictionResult(request, stalePayload);

    expect(stale.canonicalSignature).toBe(clean.canonicalSignature);
    expect(stale.canonicalSignature).not.toBe("fnv1a32:00000000");
  });

  it("canonicalizes, freezes and signs rejected results without mutating invalid input", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const request = structuredClone({ ...base, stepTicks: 0 });
    const segmentsReference = request.segments;
    const before = structuredClone(request);

    const first = predictTrajectory(request);
    const second = predictTrajectory(request);

    expect(first.status).toBe("RejectedInvalidRequest");
    expect(first).toEqual(second);
    expect(first.canonicalSignature).toBe(second.canonicalSignature);
    expect(request).toEqual(before);
    expect(request.segments).toBe(segmentsReference);
    expectRecursivelyFrozen(first);
    expect("segmentResults" in first).toBe(false);
    expect("samples" in first).toBe(false);
    expect("hazardEvents" in first).toBe(false);
    expect("closestApproaches" in first).toBe(false);
    expect("metrics" in first).toBe(false);
    if (first.status === "Completed") {
      throw new Error("Expected invalid request rejection.");
    }
    const clean = createRejectedTrajectoryPredictionResult(first);
    const stalePayload = {
      ...first,
      canonicalSignature: "fnv1a32:00000000"
    };
    const stale = createRejectedTrajectoryPredictionResult(stalePayload);
    expect(stale).toEqual(clean);
    expect(stale.canonicalSignature).not.toBe("fnv1a32:00000000");
  });

  it("keeps the standalone core free of owner imports and nondeterministic APIs", () => {
    const trajectoryDirectory = new URL("../../src/trajectory/", import.meta.url);
    const files = collectTypeScriptSources(trajectoryDirectory);
    const importExpression = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["']([^"']+)["']/g;
    const forbiddenImports = files.flatMap((file) =>
      Array.from(file.source.matchAll(importExpression), (match) => match[1] ?? "")
        .filter((specifier) => {
          const pathParts = specifier.toLowerCase().split(/[\\/]/);
          return specifier === "three" || specifier.startsWith("three/") ||
            pathParts.some((part) =>
              part === "navigation" || part === "flight" || part === "runtime" || part === "ui" ||
              part.includes("autopilot") || part.includes("renderer") || part.startsWith("render")
            );
        })
        .map((specifier) => `${file.path}: ${specifier}`)
    );
    const sources = files.map((file) => file.source).join("\n");

    expect(forbiddenImports).toEqual([]);
    expect(sources).not.toMatch(/\bDate\.now\s*\(/);
    expect(sources).not.toMatch(/\bperformance\.now\s*\(/);
    expect(sources).not.toMatch(/\bMath\.random\s*\(/);
    expect(sources).not.toMatch(/\b(?:window|document)\b/);
    expect(sources).not.toMatch(/\bTestBridge\b/);
  });
});
