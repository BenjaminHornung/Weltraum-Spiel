import { describe, expect, it, vi } from "vitest";
import { createSurfacePlayHudSnapshot } from "../../src/surface-play/contracts";
import { createSurfacePlayUi } from "../../src/surface-play/ui/surfacePlayUi";
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
  readonly addedListeners: string[] = [];
  readonly removedListeners: string[] = [];
  parent: FakeElement | undefined;

  constructor(readonly tagName: string) { super(); }

  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
    this.addedListeners.push(type);
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
    this.removedListeners.push(type);
    super.removeEventListener(type, callback, options);
  }

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

class FakeDocument extends EventTarget {
  readonly head = new FakeElement("head");
  pointerLockElement: FakeElement | null = null;
  readonly addedListeners: string[] = [];
  readonly removedListeners: string[] = [];

  createElement(tagName: string): FakeElement { return new FakeElement(tagName); }

  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
    this.addedListeners.push(type);
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
    this.removedListeners.push(type);
    super.removeEventListener(type, callback, options);
  }
}

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

const snapshot = () => createSurfacePlayHudSnapshot({
  mode: "SurfaceFirstPerson",
  movementMode: "Walk",
  grounded: true,
  energyJoules: 80,
  maximumEnergyJoules: 100,
  heatJoules: 10,
  maximumHeatJoules: 50,
  cooldownSeconds: 0,
  weaponReadiness: { kind: "Ready", nextShotReadyInSeconds: 0 },
  targetCondition: "None",
  latestAction: null,
  latestBlock: null
});

const createUiFixture = () => {
  const documentPort = new FakeDocument();
  const host = new FakeElement("main");
  const viewport = new FakeElement("canvas");
  const onIntent = vi.fn();
  const ui = createSurfacePlayUi({
    host: host as unknown as HTMLElement,
    viewport: viewport as unknown as HTMLElement,
    onIntent,
    documentPort: documentPort as unknown as Document
  });
  const all = (): FakeElement[] => descendants(host);
  const byId = (id: string): FakeElement => all().find((element) => element.id === id)!;
  return { all, byId, documentPort, host, onIntent, ui, viewport };
};

describe("Surface Play UI", () => {
  it("presents initial, engaged and released pointer-lock states through an explicit intent", () => {
    const fixture = createUiFixture();
    const button = fixture.byId("surface-play-pointer-button");
    const status = fixture.byId("surface-play-pointer-status");
    const pointerLayer = fixture.all().find((element) => element.className === "surface-play-ui__pointer-lock")!;
    const root = fixture.all().find((element) => element.className === "surface-play-ui")!;

    expect(button.type).toBe("button");
    expect(button.textContent).toBe("CLICK TO ENGAGE SUIT CONTROL");
    expect(button.getAttribute("aria-label")).toBe("Click to engage suit control");
    expect(status.hidden).toBe(true);
    button.dispatchEvent(new Event("click"));
    expect(fixture.onIntent).toHaveBeenCalledExactlyOnceWith({ type: "RequestPointerLock" });

    fixture.documentPort.pointerLockElement = fixture.viewport;
    fixture.documentPort.dispatchEvent(new Event("pointerlockchange"));
    expect(root.dataset.pointerLock).toBe("engaged");
    expect(pointerLayer.hidden).toBe(true);

    fixture.documentPort.pointerLockElement = null;
    fixture.documentPort.dispatchEvent(new Event("pointerlockchange"));
    expect(root.dataset.pointerLock).toBe("released");
    expect(pointerLayer.hidden).toBe(false);
    expect(status.textContent).toBe("POINTER RELEASED");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(button.textContent).toBe("CLICK VIEWPORT TO RESUME");
  });

  it("blocks player input only while the visible UI control owns focus", () => {
    const fixture = createUiFixture();
    const button = fixture.byId("surface-play-pointer-button");

    expect(fixture.ui.isPlayerInputBlocked()).toBe(false);
    button.dispatchEvent(new Event("focusin"));
    expect(fixture.ui.isPlayerInputBlocked()).toBe(true);
    expect(fixture.onIntent).not.toHaveBeenCalled();

    button.dispatchEvent(new Event("focusout"));
    expect(fixture.ui.isPlayerInputBlocked()).toBe(false);

    button.dispatchEvent(new Event("focusin"));
    fixture.documentPort.pointerLockElement = fixture.viewport;
    fixture.documentPort.dispatchEvent(new Event("pointerlockchange"));
    expect(fixture.ui.isPlayerInputBlocked()).toBe(false);
  });

  it("removes listeners, styles and DOM idempotently on dispose", () => {
    const fixture = createUiFixture();
    const button = fixture.byId("surface-play-pointer-button");
    fixture.ui.update(snapshot());
    expect(fixture.host.children).toHaveLength(1);
    expect(fixture.documentPort.head.children).toHaveLength(1);
    expect(fixture.documentPort.addedListeners).toContain("pointerlockchange");
    expect(button.addedListeners).toEqual(expect.arrayContaining(["click", "focusin", "focusout"]));

    fixture.ui.dispose();
    fixture.ui.dispose();
    expect(fixture.host.children).toHaveLength(0);
    expect(fixture.documentPort.head.children).toHaveLength(0);
    expect(fixture.documentPort.removedListeners).toContain("pointerlockchange");
    expect(button.removedListeners).toEqual(expect.arrayContaining(["click", "focusin", "focusout"]));
    expect(fixture.ui.isPlayerInputBlocked()).toBe(false);

    button.dispatchEvent(new Event("click"));
    fixture.documentPort.dispatchEvent(new Event("pointerlockchange"));
    expect(fixture.onIntent).not.toHaveBeenCalled();
  });

  it("keeps focus and state readable without glass, gradients or motion dependence", () => {
    expect(SURFACE_PLAY_UI_STYLES).toContain(".surface-play-ui__pointer-button:focus-visible");
    expect(SURFACE_PLAY_UI_STYLES).toContain("font-size: clamp");
    expect(SURFACE_PLAY_UI_STYLES).toContain("@media (prefers-reduced-motion: reduce)");
    expect(SURFACE_PLAY_UI_STYLES).not.toContain("backdrop-filter");
    expect(SURFACE_PLAY_UI_STYLES).not.toContain("linear-gradient");
    expect(SURFACE_PLAY_UI_STYLES).not.toContain("radial-gradient");
  });
});
