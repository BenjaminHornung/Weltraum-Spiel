import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core";
import { worldCoordinate } from "../../src/world/frames";
import { createSimulationBubble, determineSimulationBubbleMembership } from "../../src/world/simulationBubble";

describe("simulation bubble membership", () => {
  it("deterministically assigns full, snapshot and dormant update modes in absolute space", () => {
    const bubble = createSimulationBubble({
      id: "player-bubble",
      center: worldCoordinate(vec3(10_000, 0, -10_000)),
      fullUpdateRadius: 250,
      snapshotRadius: 1_000
    });

    const membership = determineSimulationBubbleMembership(bubble, [
      { id: "z-dormant", absolutePosition: worldCoordinate(vec3(12_000, 0, -10_000)) },
      { id: "b-boundary-full", absolutePosition: worldCoordinate(vec3(10_250, 0, -10_000)) },
      { id: "a-ship", absolutePosition: worldCoordinate(vec3(10_000, 0, -10_000)) },
      { id: "c-snapshot", absolutePosition: worldCoordinate(vec3(10_251, 0, -10_000)) },
      { id: "d-boundary-snapshot", absolutePosition: worldCoordinate(vec3(11_000, 0, -10_000)) }
    ]);

    expect(membership.map((entry) => [entry.entityId, entry.updateMode])).toEqual([
      ["a-ship", "Full"],
      ["b-boundary-full", "Full"],
      ["c-snapshot", "Snapshot"],
      ["d-boundary-snapshot", "Snapshot"],
      ["z-dormant", "Dormant"]
    ]);
  });
});
