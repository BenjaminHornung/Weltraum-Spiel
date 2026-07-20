import { describe, expect, it, vi } from "vitest";
import { startSurfaceLabRoute } from "../../src/surface-lab/surfaceLabFailurePresenter";

class FakeElement {
  id = "";
  className = "";
  textContent = "";
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();

  constructor(readonly tagName: string) {}

  append(...children: FakeElement[]): void { this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
}

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

const harness = () => {
  const body = new FakeElement("body");
  const host = new FakeElement("main");
  body.append(host);
  const documentPort = {
    body,
    querySelector: (selector: string) => selector === "#app" ? host : null,
    createElement: (tagName: string) => new FakeElement(tagName)
  } as unknown as Pick<Document, "body" | "querySelector" | "createElement">;
  return { body, host, documentPort };
};

const failureAlert = (host: FakeElement): FakeElement | undefined =>
  descendants(host).find((element) => element.id === "surface-lab-failure");

describe("Surface Lab route failure presentation", () => {
  it("marks Surface Lab synchronously and contains a split-module import rejection", async () => {
    const source = harness();
    const loadSurfaceLab = vi.fn(async () => { throw new Error("synthetic chunk failure"); });

    const starting = startSurfaceLabRoute(source.documentPort, loadSurfaceLab);

    expect(source.body.dataset.surfaceLab).toBe("1");
    await expect(starting).resolves.toBeUndefined();
    const alert = failureAlert(source.host);
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(descendants(alert!).map((element) => element.textContent)).toEqual([
      "SURFACE LAB UNAVAILABLE",
      "Technical initialization failure: synthetic chunk failure",
      "NOT GAMEPLAY · no terrain readiness is being claimed"
    ]);
    expect(source.body.dataset).toMatchObject({ surfaceLab: "1", surfaceLabState: "Failed" });
  });

  it("contains a loaded start rejection without revealing flight chrome", async () => {
    const source = harness();
    const startSurfaceLab = vi.fn(async () => { throw new Error("synthetic loaded start failure"); });

    await expect(startSurfaceLabRoute(source.documentPort, async () => ({ startSurfaceLab }))).resolves.toBeUndefined();

    expect(startSurfaceLab).toHaveBeenCalledOnce();
    expect(failureAlert(source.host)?.getAttribute("role")).toBe("alert");
    expect(source.body.dataset).toMatchObject({ surfaceLab: "1", surfaceLabState: "Failed" });
  });

  it("leaves the failure presentation absent after a successful dynamic start", async () => {
    const source = harness();
    const startSurfaceLab = vi.fn(async () => undefined);

    await startSurfaceLabRoute(source.documentPort, async () => ({ startSurfaceLab }));

    expect(startSurfaceLab).toHaveBeenCalledOnce();
    expect(failureAlert(source.host)).toBeUndefined();
    expect(source.body.dataset.surfaceLab).toBe("1");
    expect(source.body.dataset.surfaceLabState).toBeUndefined();
  });
});
