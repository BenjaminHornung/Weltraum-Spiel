import { afterEach, describe, expect, it } from "vitest";
import { createFlightSnapshot, createShipStateV2 } from "../../src/core";
import { renderStatusHud } from "../../src/ui/statusHud";

const elementIds = ["plan-hash", "mode", "status", "route-status", "fuel-status", "authority-status", "brake-status", "failure-reasons", "telemetry"] as const;

const installDocumentStub = () => {
  const elements = new Map<string, { textContent: string }>();
  for (const id of elementIds) {
    elements.set(id, { textContent: "" });
  }

  globalThis.document = {
    getElementById(id: string) {
      return elements.get(id) ?? null;
    }
  } as unknown as Document;

  return elements;
};

describe("renderStatusHud", () => {
  afterEach(() => {
    delete (globalThis as { document?: Document }).document;
  });

  it("renders owner FlightSnapshot values instead of recomputing from ship fields", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ fuel: 100, authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(createShipStateV2({ fuel: 0, authority: { mode: "Manual", autopilotAvailable: false } }), null);

    renderStatusHud({
      ship,
      lockedPlan: null,
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "OutOfFuel",
        planHash: "abcdef12",
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: true,
        invalidationReasons: ownerSnapshot.failureReasonCodes,
        failureReasonCodes: ownerSnapshot.failureReasonCodes,
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("mode")?.textContent).toBe("Manual");
    expect(elements.get("route-status")?.textContent).toBe("invalid");
    expect(elements.get("fuel-status")?.textContent).toContain("Blocked");
    expect(elements.get("failure-reasons")?.textContent).toContain("FuelInsufficient");
  });
});
