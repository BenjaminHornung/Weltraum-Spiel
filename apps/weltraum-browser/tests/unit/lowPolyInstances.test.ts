import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core";
import { createLocalPhysicsFrame } from "../../src/world/frames";
import { projectEntitiesToLocalFrame } from "../../src/world/floatingOrigin";
import { createLowPolyInstanceBatch, summarizeLowPolyInstanceBudget } from "../../src/world/lowPolyInstances";
import { createProvingGroundLowPolyRenderBatch, provingGroundAsteroidField } from "../../src/world/provingGroundWorld";

describe("low-poly render instance descriptors", () => {
  it("creates render-only instance descriptors without making meshes own simulation truth", () => {
    const frame = createLocalPhysicsFrame("render-frame", vec3(0, 0, 0));
    const projected = projectEntitiesToLocalFrame(provingGroundAsteroidField, frame);
    const batch = createLowPolyInstanceBatch(projected, {
      batchId: "asteroid-smoke",
      batchKey: "low-poly-asteroid",
      maxInstances: 4,
      localScale: 1.25
    });
    const budget = summarizeLowPolyInstanceBudget(batch, provingGroundAsteroidField.length);

    expect(batch.renderOnly).toBe(true);
    expect(batch.rendererOwnsWorldTruth).toBe(false);
    expect(batch.sourceId).toBeUndefined();
    expect(batch.instances).toHaveLength(4);
    expect(batch.instances[0]).toEqual(
      expect.objectContaining({ sourceEntityId: "asteroid-a", batchKey: "low-poly-asteroid", renderOnly: true, localScale: 1.25 })
    );
    expect("absolutePosition" in batch.instances[0]).toBe(false);
    expect("absoluteVelocity" in batch.instances[0]).toBe(false);
    expect(budget).toEqual({ sourceEntityCount: 6, renderedInstanceCount: 4, maxInstances: 4, culledByBudget: 2 });
  });

  it("builds the proving-ground render descriptor outside the renderer", () => {
    const batch = createProvingGroundLowPolyRenderBatch();

    expect(batch).toEqual(
      expect.objectContaining({
        id: "debug-low-poly-asteroids",
        batchKey: "low-poly-asteroid",
        sourceId: "proving-ground-world",
        renderOnly: true,
        rendererOwnsWorldTruth: false,
        maxInstances: 64
      })
    );
    expect(batch.frame.id).toBe("debug-local-render-frame");
    expect(batch.instances).toHaveLength(provingGroundAsteroidField.length);
    expect(batch.instances.every((instance) => instance.frame === batch.frame)).toBe(true);
    expect(batch.instances.every((instance) => !("absolutePosition" in instance) && !("absoluteVelocity" in instance))).toBe(true);
  });
});
