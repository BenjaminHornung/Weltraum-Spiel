import { describe, expect, it } from "vitest";
import { distance } from "../../src/core";
import { autopilotProvingGroundCourses } from "../../src/world/autopilotProvingGroundCourses";

const targetDistance = (course: (typeof autopilotProvingGroundCourses)[number]): number => distance(course.initialShip.position, course.target.position);

const courseById = (id: string): (typeof autopilotProvingGroundCourses)[number] => {
  const course = autopilotProvingGroundCourses.find((candidate) => candidate.id === id);
  if (!course) {
    throw new Error(`Missing expected course ${id}`);
  }
  return course;
};

describe("autopilot proving-ground course catalog", () => {
  it("covers the long-range matrix with unique IDs and real distance tiers", () => {
    const ids = autopilotProvingGroundCourses.map((course) => course.id);
    const distances = autopilotProvingGroundCourses.map(targetDistance);
    const catalogDistances = autopilotProvingGroundCourses.map((course) => course.distanceMeters);

    expect(autopilotProvingGroundCourses.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ids).size).toBe(ids.length);
    expect(distances.filter((value) => value >= 500).length).toBeGreaterThanOrEqual(3);
    expect(distances.filter((value) => value >= 1_000).length).toBeGreaterThanOrEqual(2);
    expect(distances.filter((value) => value >= 2_500).length).toBeGreaterThanOrEqual(1);
    expect(catalogDistances).toEqual(autopilotProvingGroundCourses.map((course) => Math.round(targetDistance(course))));
  });

  it("declares the required categories and evidence speed profiles", () => {
    const categories = new Set(autopilotProvingGroundCourses.map((course) => course.category));
    const profiles = new Set(autopilotProvingGroundCourses.map((course) => course.speedProfile));

    expect(Array.from(categories)).toEqual(expect.arrayContaining([
      "DirectShort",
      "DirectMedium",
      "DirectLong",
      "DirectExtreme",
      "LateralInitialVelocity",
      "HighInitialSpeed",
      "LowAuthorityTerminal",
      "LowFuelExpectedFail",
      "NoMainThrusterExpectedFail",
      "NoAuthorityExpectedFail",
      "OffRouteDisturbanceExpectedFail",
      "ObstacleSingle",
      "ObstacleStress"
    ]));
    expect(profiles).toEqual(new Set(["Safe", "Balanced", "Fast"]));
    expect(courseById("direct-long-safe").speedProfile).toBe("Safe");
    expect(courseById("direct-long-balanced").speedProfile).toBe("Balanced");
    expect(courseById("direct-long-fast").speedProfile).toBe("Fast");
  });

  it("anchors representative course geometry at the 500m, 1000m, and 2500m tiers", () => {
    expect(targetDistance(courseById("direct-medium-stop"))).toBeCloseTo(500, 4);
    expect(targetDistance(courseById("direct-long-stop"))).toBeCloseTo(1_000, 4);
    expect(targetDistance(courseById("direct-very-long-stop"))).toBeCloseTo(2_500, 4);
    expect(targetDistance(courseById("direct-very-long-fast-stress"))).toBeCloseTo(2_500, 4);
  });

  it("includes the requested long-range category IDs", () => {
    expect(autopilotProvingGroundCourses.map((course) => course.id)).toEqual(expect.arrayContaining([
      "direct-short-stop",
      "direct-medium-stop",
      "direct-long-stop",
      "direct-very-long-stop",
      "direct-very-long-fast-stress",
      "single-blocking-obstacle-long",
      "s-curve-obstacles-long",
      "narrow-corridor-long",
      "offset-gates-long",
      "target-behind-obstacle-long",
      "target-near-obstacle-long",
      "low-main-thrust-long",
      "low-rcs-terminal-long",
      "low-fuel-long-route",
      "no-main-thrusters-negative",
      "no-autopilot-authority-negative",
      "midcourse-position-disturbance",
      "midcourse-velocity-disturbance",
      "terminal-overspeed-disturbance",
      "off-route-fail-closed",
      "direct-long-safe",
      "direct-long-balanced",
      "direct-long-fast",
      "corridor-safe",
      "corridor-balanced"
    ]));
  });

  it("keeps pass-course terminal gates strict and documents stress/fail outcomes", () => {
    for (const course of autopilotProvingGroundCourses) {
      expect(course.expectedOutcome).toMatch(/^(Pass|KnownStress|ExpectedFail)$/);

      if (course.expectedOutcome === "Pass") {
        expect(course.target.arrivalEnvelope.stopBehavior).toBe("StopWithinEnvelope");
        expect(course.target.arrivalEnvelope.terminalSpeed).toBeLessThanOrEqual(0.5);
        expect(course.acceptance.maxFinalSpeed).toBeLessThanOrEqual(0.5);
      }

      if (course.expectedOutcome === "KnownStress") {
        expect(course.notes?.join(" ") ?? "").toMatch(/KnownStress|one-obstacle|first blocking obstacle/i);
        expect(course.acceptance.allowReplanRequired).not.toBe(true);
      }

      if (course.expectedOutcome === "ExpectedFail") {
        expect(course.acceptance.expectedFailureReasonCodes?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
