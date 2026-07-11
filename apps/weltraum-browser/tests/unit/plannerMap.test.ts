import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import {
  DEFAULT_ACTIVE_SHIP_PRESENTATION,
  createNavigationMapSnapshot,
  navigationMapShipSnapshot,
  navigationMapTargetSnapshot
} from "../../src/navigation/map";
import { worldCoordinate } from "../../src/world/frames";
import {
  calculateNavigationMapFocus,
  calculateNavigationMapScaleBar,
  selectPlannerMapTarget
} from "../../src/ui/plannerMap";

const snapshotWithArbitraryTarget = () => createNavigationMapSnapshot({
  ship: navigationMapShipSnapshot({
    absolutePosition: worldCoordinate(vec3(10, 0, 20)),
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    presentation: DEFAULT_ACTIVE_SHIP_PRESENTATION
  }),
  targets: [navigationMapTargetSnapshot({
    id: "runtime-target-any-id",
    label: "Runtime target",
    kind: "Point",
    position: vec3(2_510, 0, -480),
    arrivalEnvelope: { radius: 5 }
  })],
  selectedTargetId: "runtime-target-any-id",
  world: {
    registrySignature: "planner-map-test-registry",
    streamingSignature: "planner-map-test-streaming",
    fullChunkIds: [],
    snapshotChunkIds: []
  }
});

describe("planner map viewport and target interaction", () => {
  it("focuses arbitrary runtime geometry with padding and a real minimum scale", () => {
    const focus = calculateNavigationMapFocus(snapshotWithArbitraryTarget());

    expect(focus.centerAbsoluteX).toBeCloseTo(1_262.5, 8);
    expect(focus.centerAbsoluteZ).toBeCloseTo(-232.5, 8);
    expect(focus.metersPerPixel).toBeGreaterThan(0);
    expect(focus.metersPerPixel * (1_000 - 116)).toBeGreaterThanOrEqual(2_500 * 1.1);
  });

  it("uses deterministic 1-2-5 metre and kilometre scale bars", () => {
    expect(calculateNavigationMapScaleBar(2)).toEqual({ metres: 200, pixels: 100, label: "200 m" });
    expect(calculateNavigationMapScaleBar(20)).toEqual({ metres: 2_000, pixels: 100, label: "2 km" });
  });

  it("selects the exact runtime target ID without a CSS coordinate contract", () => {
    let selected = "";
    const button = (id: string) => ({
      children: [],
      dataset: { plannerTargetId: id },
      disabled: false,
      click: () => { selected = id; }
    });
    const options = { children: [button("target-prefix"), button("target-prefix-long")] };
    const root = { getElementById: (id: string) => id === "planner-target-options" ? options : null } as unknown as Document;

    expect(selectPlannerMapTarget("target-prefix-long", root)).toBe(true);
    expect(selected).toBe("target-prefix-long");
  });

  it("keeps static semantics and target-specific positioning out of the map surface", () => {
    const css = readFileSync("src/style.css", "utf8");
    const html = readFileSync("index.html", "utf8");
    const plannerMap = readFileSync("src/ui/plannerMap.ts", "utf8");

    expect(css).not.toContain("planner-system-map-clean.png");
    expect(css).not.toMatch(/data-planner-target-id/);
    expect(css).not.toMatch(/data-target-id[^}]*?(?:left|right|top|bottom)\s*:/s);
    expect(html).toContain("LOCAL NAVIGATION MAP");
    expect(html).not.toContain(">SYSTEM MAP<");
    expect(plannerMap).not.toContain('svgElement("polygon"');
  });
});
