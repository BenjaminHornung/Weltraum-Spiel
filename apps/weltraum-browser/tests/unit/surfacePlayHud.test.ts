import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createSurfacePlayHudSnapshot,
  type SurfacePlayHudSnapshot
} from "../../src/surface-play/contracts";
import { createSurfacePlayHud } from "../../src/surface-play/ui/surfacePlayHud";
import { SURFACE_PLAY_UI_STYLES } from "../../src/surface-play/ui/surfacePlayUiStyles";

class FakeElement extends EventTarget {
  id = "";
  className = "";
  textContent = "";
  type = "";
  hidden = false;
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  parent: FakeElement | undefined;

  constructor(readonly tagName: string) { super(); }

  append(...children: FakeElement[]): void {
    children.forEach((child) => { child.parent = this; });
    this.children.push(...children);
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  remove(): void {
    if (this.parent === undefined) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = undefined;
  }
}

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

const hudSnapshot = (
  overrides: Partial<SurfacePlayHudSnapshot> = {}
): Readonly<SurfacePlayHudSnapshot> => createSurfacePlayHudSnapshot({
  mode: "SurfaceFirstPerson",
  movementMode: "Sprint",
  grounded: true,
  energyJoules: 80,
  maximumEnergyJoules: 100,
  heatJoules: 10,
  maximumHeatJoules: 50,
  cooldownSeconds: 0,
  targetCondition: "Damaged",
  latestAction: "TERRAIN IMPACT",
  latestBlock: "CUTTER COOLING",
  ...overrides
});

const createHudFixture = () => {
  const host = new FakeElement("main");
  const documentPort = { createElement: (tagName: string) => new FakeElement(tagName) };
  const hud = createSurfacePlayHud({
    host: host as unknown as HTMLElement,
    documentPort: documentPort as unknown as Document
  });
  const all = (): FakeElement[] => descendants(host);
  const byId = (id: string): FakeElement => all().find((element) => element.id === id)!;
  return { all, byId, host, hud };
};

describe("Surface Play HUD", () => {
  it("renders the player-facing Hestia suit snapshot and accessible meters", () => {
    const fixture = createHudFixture();
    fixture.hud.update(hudSnapshot());

    expect(fixture.all().map((element) => element.textContent)).toEqual(expect.arrayContaining([
      "SURFACE · HESTIA",
      "REGION · HESTIA",
      "OBJECTIVE: TEST CUTTER ON SURVEY DRONE",
      "SUIT",
      "SPRINT",
      "GROUNDED",
      "ENERGY",
      "80 / 100 J",
      "PULSE CUTTER",
      "READY",
      "HEAT",
      "10 / 50 J",
      "COOLDOWN 0.00 S",
      "TARGET · DAMAGED",
      "TERRAIN IMPACT",
      "CUTTER COOLING"
    ]));

    const energyMeter = fixture.byId("surface-play-energy-meter");
    expect(energyMeter.getAttribute("role")).toBe("progressbar");
    expect(energyMeter.getAttribute("aria-valuenow")).toBe("80");
    expect(energyMeter.getAttribute("aria-valuemax")).toBe("100");
    expect(energyMeter.getAttribute("aria-valuetext")).toBe("80 of 100 joules");
    expect(fixture.byId("surface-play-heat-meter").getAttribute("aria-valuetext")).toBe("10 of 50 joules");
    expect(fixture.byId("surface-play-weapon-status").getAttribute("aria-live")).toBe("polite");
    expect(fixture.byId("surface-play-block").getAttribute("aria-live")).toBe("assertive");
  });

  it.each([
    [{ maximumHeatJoules: 50, heatJoules: 50, energyJoules: 0, cooldownSeconds: 2 }, "OVERHEATED", "overheated"],
    [{ maximumHeatJoules: 50, heatJoules: 10, energyJoules: 0, cooldownSeconds: 2 }, "NO ENERGY", "no-energy"],
    [{ maximumHeatJoules: 50, heatJoules: 10, energyJoules: 80, cooldownSeconds: 2 }, "COOLDOWN", "cooldown"],
    [{ maximumHeatJoules: 50, heatJoules: 10, energyJoules: 80, cooldownSeconds: 0 }, "READY", "ready"]
  ] as const)("renders explicit weapon status text for %o", (overrides, expectedText, expectedKey) => {
    const fixture = createHudFixture();
    fixture.hud.update(hudSnapshot(overrides));
    expect(fixture.byId("surface-play-weapon-status").textContent).toBe(expectedText);
    const weapon = fixture.all().find((element) => element.dataset.zone === "edge-bottom-right");
    expect(weapon?.dataset.status).toBe(expectedKey);
  });

  it("shows target context only for a valid target condition", () => {
    const fixture = createHudFixture();
    fixture.hud.update(hudSnapshot({ targetCondition: "None" }));
    expect(fixture.byId("surface-play-target").hidden).toBe(true);
    expect(fixture.byId("surface-play-target").textContent).toBe("");

    fixture.hud.update(hudSnapshot({ targetCondition: "Operational" }));
    expect(fixture.byId("surface-play-target").hidden).toBe(false);
    expect(fixture.byId("surface-play-target").textContent).toBe("TARGET · OPERATIONAL");
  });

  it("presents terrain results and fire blocks only from explicit snapshot text", () => {
    const fixture = createHudFixture();
    fixture.hud.update(hudSnapshot({
      heatJoules: 50,
      latestAction: null,
      latestBlock: null
    }));
    expect(fixture.byId("surface-play-action").hidden).toBe(true);
    expect(fixture.byId("surface-play-block").hidden).toBe(true);
    expect(fixture.all().map((element) => element.textContent)).not.toContain("EDIT APPLIED");
    expect(fixture.all().map((element) => element.textContent)).not.toContain("INSUFFICIENT ENERGY");

    fixture.hud.update(hudSnapshot({
      latestAction: "EDIT APPLIED",
      latestBlock: "INSUFFICIENT ENERGY"
    }));
    expect(fixture.byId("surface-play-action").textContent).toBe("EDIT APPLIED");
    expect(fixture.byId("surface-play-block").textContent).toBe("INSUFFICIENT ENERGY");
  });

  it("keeps the 1280x720 DOM contract edge-bound and the center free of panels", () => {
    const fixture = createHudFixture();
    fixture.hud.update(hudSnapshot());
    const zones = fixture.all().filter((element) => element.dataset.zone !== undefined);
    expect(zones.map((element) => element.dataset.zone)).toEqual([
      "edge-top-left",
      "edge-bottom-left",
      "edge-bottom-right",
      "center-safe"
    ]);
    const center = zones.find((element) => element.dataset.zone === "center-safe")!;
    expect(descendants(center).map((element) => element.textContent)).not.toEqual(expect.arrayContaining([
      "SURFACE · HESTIA",
      "SUIT",
      "PULSE CUTTER"
    ]));
    expect(SURFACE_PLAY_UI_STYLES).toContain("@media (max-width: 80rem) and (max-height: 45rem)");
    expect(SURFACE_PLAY_UI_STYLES).toContain(".surface-play-hud__center-safe");
  });

  it("contains no player HUD dependency on debug telemetry or TestBridge", () => {
    const sources = [
      "surfacePlayHud.ts",
      "surfacePlayUi.ts",
      "index.ts"
    ].map((fileName) => readFileSync(new URL(`../../src/surface-play/ui/${fileName}`, import.meta.url), "utf8").toLowerCase());
    for (const source of sources) {
      expect(source).not.toMatch(/\b(worker|queue|hash|brick|revision|debug|testbridge|damage)\b/);
    }
  });
});
