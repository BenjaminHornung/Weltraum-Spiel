import { describe, expect, it } from "vitest";
import {
  PREPARED_STRUCTURAL_FIRE_SEED_VIEW,
  PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW,
  encodePreparedStructuralFireContinuationInput,
} from "../../src/surface-play/workers/preparedStructuralFireCodec";

describe("Prepared Structural Fire codec", () => {
  it("uses distinct seed, command, and continuation layouts", () => {
    expect(PREPARED_STRUCTURAL_FIRE_SEED_VIEW).not.toBe(
      PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW,
    );
    const continuation = encodePreparedStructuralFireContinuationInput(0, {
      rootJobId: "prepared-fire:test",
      batchIndex: 1,
      tokenHash: "token",
      chainHash: "chain",
    });
    expect(continuation.views.map((view) => view.name)).toEqual([
      "preparedStructuralFireContinuation",
    ]);
  });
});
