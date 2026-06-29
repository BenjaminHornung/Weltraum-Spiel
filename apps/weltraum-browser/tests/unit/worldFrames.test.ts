import { describe, expect, it } from "vitest";
import { distance, vec3 } from "../../src/core";
import { absoluteToLocal, absoluteVelocity, createLocalPhysicsFrame, localToAbsolute, velocityToAbsolute, velocityToLocalPhysics, worldCoordinate } from "../../src/world/frames";
import { projectEntityToLocalFrame, shiftFloatingOriginProjection, type WorldEntityState } from "../../src/world/floatingOrigin";

describe("world/local frame contracts", () => {
  it("keeps large absolute coordinates separate from local render coordinates", () => {
    const absolutePosition = worldCoordinate(vec3(1_000_000_250, -12, -999_999_900));
    const localFrame = createLocalPhysicsFrame("player-local", vec3(1_000_000_000, 0, -1_000_000_000));

    const localPosition = absoluteToLocal(absolutePosition, localFrame);
    const roundTrip = localToAbsolute(localPosition);

    expect(absolutePosition.kind).toBe("WorldCoordinate");
    expect(localPosition.kind).toBe("LocalCoordinate");
    expect(localPosition.frame.id).toBe("player-local");
    expect(localPosition.value).toEqual(vec3(250, -12, 100));
    expect(roundTrip.value).toEqual(absolutePosition.value);
  });

  it("preserves velocity values while changing only the velocity frame", () => {
    const localFrame = createLocalPhysicsFrame("player-local", vec3(10_000, 0, 0));
    const absolute = absoluteVelocity(vec3(12, -0.5, 3));

    const local = velocityToLocalPhysics(absolute, localFrame);

    expect(local.value).toEqual(absolute.value);
    expect(local.value).not.toBe(absolute.value);
    expect(local.relationship).toBe("LocalPhysics");
    expect(local.frame).toBe(localFrame);

    (local.value as any).x = 999;
    expect(absolute.value).toEqual(vec3(12, -0.5, 3));

    const roundTrip = velocityToAbsolute(local);
    expect(roundTrip.value).toEqual(vec3(999, -0.5, 3));
    expect(roundTrip.value).not.toBe(local.value);

    (roundTrip.value as any).z = 321;
    expect(local.value).toEqual(vec3(999, -0.5, 3));
  });
});

describe("floating-origin projection shifts", () => {
  it("does not mutate absolute state or velocity when the local projection origin shifts", () => {
    const previousFrame = createLocalPhysicsFrame("local-before", vec3(1_000_000, 0, 2_000_000));
    const nextFrame = createLocalPhysicsFrame("local-after", vec3(1_000_128, 0, 1_999_936));
    const entities: readonly WorldEntityState[] = [
      { id: "ship", absolutePosition: worldCoordinate(vec3(1_000_160, 5, 1_999_980)), absoluteVelocity: absoluteVelocity(vec3(4, 0, -2)) },
      { id: "target", absolutePosition: worldCoordinate(vec3(1_000_260, 5, 1_999_980)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)) }
    ];

    const shift = shiftFloatingOriginProjection(entities, previousFrame, nextFrame);
    const beforeShip = shift.before.find((entity) => entity.id === "ship");
    const beforeTarget = shift.before.find((entity) => entity.id === "target");
    const afterShip = shift.after.find((entity) => entity.id === "ship");
    const afterTarget = shift.after.find((entity) => entity.id === "target");

    expect(shift.event.originShiftAbsolute).toEqual(vec3(128, 0, -64));
    expect(afterShip?.absolutePosition.value).toEqual(entities[0].absolutePosition.value);
    expect(afterShip?.absoluteVelocity.value).toEqual(entities[0].absoluteVelocity.value);
    expect(afterShip?.localVelocity.value).toEqual(beforeShip?.localVelocity.value);
    expect(afterShip?.localVelocity.value).not.toBe(entities[0].absoluteVelocity.value);
    expect(afterShip?.localPosition.value).toEqual(vec3(32, 5, 44));
    expect(distance(beforeShip!.localPosition.value, beforeTarget!.localPosition.value)).toBe(
      distance(afterShip!.localPosition.value, afterTarget!.localPosition.value)
    );

    (afterShip!.localVelocity.value as any).x = 999;
    expect(entities[0].absoluteVelocity.value).toEqual(vec3(4, 0, -2));
    expect(afterShip?.absoluteVelocity.value).toEqual(vec3(4, 0, -2));
  });

  it("does not expose absolute velocity vector references through projected entities", () => {
    const frame = createLocalPhysicsFrame("mutation-test-local", vec3(10, 0, 0));
    const entity: WorldEntityState = {
      id: "probe",
      absolutePosition: worldCoordinate(vec3(12, 0, 0)),
      absoluteVelocity: absoluteVelocity(vec3(4, 1, -2))
    };

    const projected = projectEntityToLocalFrame(entity, frame);

    expect(projected.localVelocity.value).toEqual(entity.absoluteVelocity.value);
    expect(projected.localVelocity.value).not.toBe(entity.absoluteVelocity.value);

    (projected.localVelocity.value as any).x = 999;
    expect(entity.absoluteVelocity.value).toEqual(vec3(4, 1, -2));
    expect(projected.absoluteVelocity.value).toEqual(vec3(4, 1, -2));
  });
});
