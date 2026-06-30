import { afterEach, describe, expect, it } from "vitest";
import { createFlightSnapshot, createShipStateV2 } from "../../src/core";
import { createStatusHudViewModel, renderStatusHud } from "../../src/ui/statusHud";

const elementIds = [
  "plan-hash",
  "mode",
  "status",
  "route-status",
  "target-status",
  "target-options",
  "target-distance",
  "radar-status",
  "fuel-status",
  "authority-status",
  "brake-status",
  "warning-chips",
  "failure-reasons",
  "runtime-message",
  "engage-autopilot",
  "cancel-autopilot"
] as const;

const installDocumentStub = () => {
  const elements = new Map<string, { textContent: string; onclick: ((event?: unknown) => void) | null }>();
  for (const id of elementIds) {
    elements.set(id, { textContent: "", onclick: null });
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
    expect(elements.get("route-status")?.textContent).toContain("select a target");
    expect(elements.get("fuel-status")?.textContent).toContain("Blocked");
    expect(elements.get("status")?.textContent).toContain("Autopilot blocked: fuel");
    expect(elements.get("failure-reasons")?.textContent).toContain("Fuel insufficient");
    expect(elements.get("failure-reasons")?.textContent).not.toContain("FuelInsufficient");
    expect(elements.get("warning-chips")?.textContent).toContain("Fuel insufficient");
  });

  it("summarizes route failures without exposing raw internal failure codes", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = { ...createFlightSnapshot(ship, null), routeValid: false, failureReasonCodes: ["OffLockedRoute" as const] };

    renderStatusHud({
      ship,
      lockedPlan: null,
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Diverged",
        planHash: "abcdef12",
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 32,
        replanRequired: true,
        invalidationReasons: ownerSnapshot.failureReasonCodes,
        failureReasonCodes: ownerSnapshot.failureReasonCodes,
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("failure-reasons")?.textContent).toContain("Plan invalidated");
    expect(elements.get("warning-chips")?.textContent).toContain("Plan invalidated");
    expect(elements.get("failure-reasons")?.textContent).not.toContain("OffLockedRoute");
    expect(elements.get("warning-chips")?.textContent).not.toContain("OffLockedRoute");
  });

  it("creates a player-facing ViewModel for target, distance, plan state, and warnings", () => {
    const ship = createShipStateV2({ fuel: 0, authority: { mode: "Manual", autopilotAvailable: false } });
    const ownerSnapshot = createFlightSnapshot(ship, {
      id: "plan-a",
      planner: "DirectLocal",
      createdAtTick: 0,
      target: {
        id: "target-a",
        label: "Target A",
        kind: "Waypoint",
        position: ship.position,
        arrivalEnvelope: { radius: 3 }
      },
      segments: [],
      validation: { ok: true, issues: [], rejectedReasonCodes: [] },
      score: { distance: 0, segmentCount: 0, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 0, reasons: [] },
      planHash: "abc123ef"
    });

    const viewModel = createStatusHudViewModel({
      ship,
      lockedPlan: {
        id: "plan-a",
        planner: "DirectLocal",
        createdAtTick: 0,
        target: {
          id: "target-a",
          label: "Target A",
          kind: "Waypoint",
          position: ship.position,
          arrivalEnvelope: { radius: 3 }
        },
        segments: [],
        validation: { ok: true, issues: [], rejectedReasonCodes: [] },
        score: { distance: 0, segmentCount: 0, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 0, reasons: [] },
        planHash: "abc123ef"
      },
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 3,
        status: "OutOfFuel",
        planHash: "abc123ef",
        activeSegmentId: null,
        distanceToTarget: 42.42,
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

    expect(viewModel.target).toBe("Target A [Waypoint]");
    expect(viewModel.distance).toBe("42.4 m");
    expect(viewModel.routeState).toContain("new plan required");
    expect(viewModel.autopilotState).toContain("Autopilot blocked: fuel");
    expect(viewModel.radarState).toContain("local contact Target A");
    expect(viewModel.warningChips.map((chip) => chip.code)).toEqual(expect.arrayContaining(["FuelInsufficient", "FuelDepleted"]));
  });

  it("routes HUD controls through explicit runtime commands", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const commands: unknown[] = [];

    renderStatusHud(
      {
        ship,
        lockedPlan: null,
        flightSnapshot: ownerSnapshot,
        executor: {
          tick: 1,
          status: "Idle",
          planHash: null,
          activeSegmentId: null,
          distanceToTarget: 0,
          offRouteDistance: 0,
          replanRequired: false,
          invalidationReasons: [],
          failureReasonCodes: [],
          fuel: ownerSnapshot.fuel,
          flightSnapshot: ownerSnapshot,
          position: ship.position,
          velocity: ship.velocity
        }
      },
      { dispatch: (command) => commands.push(command) }
    );

    elements.get("engage-autopilot")?.onclick?.();
    elements.get("cancel-autopilot")?.onclick?.();

    expect(commands).toEqual([{ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }, { type: "CancelAutopilot" }]);
  });

  it("renders selected target and route-preview labels from snapshot fields", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const target = {
      id: "target-b",
      label: "Target B",
      kind: "Point" as const,
      position: ship.position,
      arrivalEnvelope: { radius: 3 }
    };

    renderStatusHud({
      ship,
      lockedPlan: null,
      selectedTarget: target,
      selectableTargets: [target],
      routePreview: {
        state: "Ready",
        planner: "ObstacleAvoidanceLocal",
        target,
        plan: {
          id: "preview-b",
          planner: "ObstacleAvoidanceLocal",
          createdAtTick: 0,
          target,
          segments: [{ id: "direct-0", kind: "Direct", start: ship.position, end: target.position, desiredSpeed: 18, clearanceRadius: 3 }],
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          score: { distance: 12, segmentCount: 1, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 12, reasons: [] },
          planHash: "bead1234"
        },
        validation: { ok: true, issues: [], rejectedReasonCodes: [] },
        rejectedReasonCodes: [],
        playerMessage: "Route preview ready for Target B."
      },
      runtimeMessage: "Selected Target B.",
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Idle",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("target-status")?.textContent).toBe("Target B [Point]");
    expect(elements.get("route-status")?.textContent).toContain("preview ready");
    expect(elements.get("radar-status")?.textContent).toContain("local contact Target B");
    expect(elements.get("runtime-message")?.textContent).toContain("Selected Target B");
    expect(elements.get("target-options")?.textContent).toContain("Target B (selected)");
  });
});
