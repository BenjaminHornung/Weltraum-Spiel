import { describe, expect, it } from "vitest";
import { SpatialError, createFrameGraph } from "../../src/spatial";

const system = {
  frameId: "frame:system",
  kind: "SystemInertial" as const,
  parentFrameId: null
};

const expectSpatialError = (action: () => unknown, code: SpatialError["code"]): void => {
  try {
    action();
    throw new Error(`Expected SpatialError ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(SpatialError);
    expect((error as SpatialError).code).toBe(code);
  }
};

describe("FrameGraph", () => {
  it("rejects cycles after IDs and parent existence have been validated", () => {
    expectSpatialError(
      () =>
        createFrameGraph([
          system,
          { frameId: "frame:a", kind: "BodyInertial", parentFrameId: "frame:b" },
          { frameId: "frame:b", kind: "BodyFixed", parentFrameId: "frame:a" }
        ]),
      "FRAME_CYCLE"
    );
  });

  it("rejects an unknown parent", () => {
    expectSpatialError(
      () =>
        createFrameGraph([
          system,
          { frameId: "frame:body", kind: "BodyInertial", parentFrameId: "frame:missing" }
        ]),
      "UNKNOWN_PARENT_FRAME"
    );
  });

  it("rejects duplicate frame IDs", () => {
    expectSpatialError(
      () =>
        createFrameGraph([
          system,
          { frameId: "frame:system", kind: "BodyInertial", parentFrameId: null }
        ]),
      "DUPLICATE_FRAME_ID"
    );
  });

  it("reports duplicate IDs before validating frame kinds", () => {
    expectSpatialError(
      () =>
        createFrameGraph([
          system,
          { frameId: "frame:system", kind: "NotAFrameKind", parentFrameId: null } as never
        ]),
      "DUPLICATE_FRAME_ID"
    );
  });

  it("sorts definitions canonically and signs independently of input order", () => {
    const body = { frameId: "frame:body", kind: "BodyInertial" as const, parentFrameId: "frame:system" };
    const fixed = { frameId: "frame:fixed", kind: "BodyFixed" as const, parentFrameId: "frame:body" };
    const first = createFrameGraph([fixed, system, body]);
    const second = createFrameGraph([body, fixed, system]);

    expect(first.definitions.map((definition) => definition.frameId)).toEqual([
      "frame:body",
      "frame:fixed",
      "frame:system"
    ]);
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.signature).toBe(second.signature);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.definitions)).toBe(true);
    expect(Object.isFrozen(first.definitions[0])).toBe(true);
  });

  it("never permits RenderRelative to become canonical world authority", () => {
    expectSpatialError(
      () =>
        createFrameGraph([
          system,
          {
            frameId: "frame:render-relative",
            kind: "RenderRelative",
            parentFrameId: "frame:system",
            canonicalAuthority: true
          }
        ]),
      "INVALID_FRAME_AUTHORITY"
    );

    const graph = createFrameGraph([
      system,
      { frameId: "frame:render-relative", kind: "RenderRelative", parentFrameId: "frame:system" }
    ]);
    expect(graph.getDefinition("frame:render-relative").canonicalAuthority).toBe(false);
  });
});
