import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FactoryUiPort, FactoryUiReadModel } from "../../../src/factory/session/hostPort";
import type { FactoryShellView } from "../../../src/factory/ui/factoryShell";

const modulePath = "../../../src/factory/ui/factoryShell";
const load = async (): Promise<typeof import("../../../src/factory/ui/factoryShell") | null> => existsSync(new URL("../../../src/factory/ui/factoryShell.ts", import.meta.url)) ? await import(modulePath) : null;

// Document double checks DOM projection and real existing panel lifetime only.
// Native focus/movement and adopted save generations remain Integrator evidence.
class ElementDouble extends EventTarget {
  readonly children: ElementDouble[] = [];
  parent: ElementDouble | null = null;
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { cssText: "" };
  id = ""; className = ""; value = ""; disabled = false; hidden = false; type = ""; tabIndex = 0; scrollTop = 0;
  private content = "";
  constructor(readonly tagName: string) { super(); }
  get textContent(): string { return this.content + this.children.map(c => c.textContent).join(" "); }
  set textContent(v: string | null) { this.content = v ?? ""; this.replaceChildren(); }
  append(...items: ElementDouble[]): void { for (const child of items) { child.remove(); child.parent = this; this.children.push(child); } }
  replaceChildren(...items: ElementDouble[]): void { for (const child of this.children) child.parent = null; this.children.length = 0; this.append(...items); }
  setAttribute(k: string, v: string): void { this.attributes.set(k, v); }
  getAttribute(k: string): string | null { return this.attributes.get(k) ?? null; }
  contains(v: unknown): boolean { return this === v || this.children.some(c => c.contains(v)); }
  remove(): void { if (this.parent) { const index = this.parent.children.indexOf(this); if (index >= 0) this.parent.children.splice(index, 1); this.parent = null; } }
  focus(): void { this.dispatchEvent(new Event("focusin")); }
  click(): void { if (!this.disabled) this.dispatchEvent(new Event("click")); }
  querySelectorAll(): ElementDouble[] { return descendants(this).filter(e => ["BUTTON", "INPUT", "SELECT"].includes(e.tagName)); }
}
const descendants = (root: ElementDouble): ElementDouble[] => [root, ...root.children.flatMap(descendants)];
const visible = (node: ElementDouble): boolean => !node.hidden && (!node.parent || visible(node.parent));
const visibleButton = (root: HTMLElement, label: string) => descendants(root as unknown as ElementDouble).find(e => e.tagName === "BUTTON" && e.textContent.trim() === label && visible(e));
const docDouble = () => Object.assign(new EventTarget(), { createElement: (tag: string) => new ElementDouble(tag.toUpperCase()), createElementNS: (_ns: string, tag: string) => new ElementDouble(tag.toUpperCase()), activeElement: null }) as unknown as Document;
const find = (root: HTMLElement | undefined, label: string) => root && descendants(root as unknown as ElementDouble).find(e => e.tagName === "BUTTON" && e.textContent.trim() === label);
const cap = (enabled: boolean, reason: string | null = null) => ({ enabled, reason });
const initial = (): FactoryShellView => ({ sessionId: "shell_session", epoch: 1, publicationRevision: 1, phase: "start", statusText: "Pausiert",
  capabilities: { newSession: cap(true), continue: cap(false, "Gemeinsamer Spielstand noch nicht verfügbar"), play: cap(true), pause: cap(true), save: cap(false, "Speichern noch nicht verfügbar"), endSession: cap(true), settings: cap(false, "Einstellungen noch nicht angebunden") },
  hud: { interactionText: "Wrackfracht erreichen", carrierMassMg: null, blockReason: null, warnings: [] }, onboarding: null, map: null });
const uiView = (): FactoryUiReadModel => ({ version: "fp06-ui-read-v1", sessionId: "shell_session", epoch: 1, publicationRevision: 1,
  binding: { catalogDigest: "catalog", terrainSourceDigest: "source", powerSourceProfileDigest: "power", terrainRevision: 1, facilityRevision: 0, materialRevision: 0, netRevision: 0, handlingRevision: 0 },
  host: { sessionId: "shell_session", epoch: 1, nativeTick: 0, physicsStatus: "Paused", confirmed: true, terrain: { epoch: 1, revision: 1, sourceDigest: "source", baseDigest: "base", cellMeters: .125, originMeters: { x: 0, y: 0, z: 0 }, sizeX: 16, sizeY: 16, sizeZ: 16 } },
  factorySteps: 0, elapsedMs: 0, state: "Ready", reason: null, focusedPanel: null, inventory: [], machines: [],
  power: { status: "IDLE", generationWatts: 0, allocatedWatts: 0, batteryEnergyJ: null, batteryCapacityJ: null, reserveEnergyJ: null, sourceQuality: "confirmed", consumers: [] }, technologies: [],
  interaction: { cargoOpened: false, cargoAccessible: true, handling: null, openCargo: cap(true), deposit: cap(false), returnCargo: cap(false) }, lastReceipt: null });
const harness = () => {
  let view = initial(), ownerCurrent = true, hostReads = 0; let uiSubscribers = 0; const uiCommands: unknown[] = [], lifecycleCommands: unknown[] = [], surfaces: unknown[] = [], panelFocus: unknown[] = [];
  const listeners = new Set<(value: ReturnType<typeof initial>) => void>();
  const uiPort: FactoryUiPort = { read: uiView, subscribe: () => { uiSubscribers++; return () => { uiSubscribers--; }; }, setPanelFocus: panel => { panelFocus.push(panel); }, readReceipt: () => undefined,
    submit: command => { uiCommands.push(command); return new Promise(() => {}); } };
  const port = { isCurrent: () => ownerCurrent, read: () => { hostReads++; if (!ownerCurrent) throw new Error("Disposed test host read"); return view; }, subscribe: (listener: (value: ReturnType<typeof initial>) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispatch: async (command: unknown) => { lifecycleCommands.push(command); }, setSurface: (surface: unknown, binding: unknown) => { surfaces.push({ surface, binding }); } };
  return { port, uiPort, uiCommands, lifecycleCommands, surfaces, panelFocus, setOwnerCurrent: (current: boolean) => { ownerCurrent = current; }, get hostReads() { return hostReads; }, get uiSubscribers() { return uiSubscribers; },
    publish: (next: ReturnType<typeof initial>) => { view = next; for (const listener of listeners) listener(next); } };
};

describe("Factory player shell", () => {
  it("presents English player controls without changing published session facts", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    expect(find(shell.element, "New game")).toBeDefined();
    expect(find(shell.element, "Continue")).toBeDefined();
    expect(h.port.read().statusText).toBe("Pausiert");
    expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });
  it("keeps the goal and a source-bound minimap visible while inspecting Cargo", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "paused" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell.openSurface("cargo");
    const nodes = descendants(shell.element as unknown as ElementDouble);
    expect(nodes.find(n => n.className === "factory-shell-hud")?.hidden).toBe(false);
    const mini = nodes.find(n => n.className.includes("factory-shell-minimap"));
    expect(mini).toBeDefined();
    expect(mini?.textContent).toContain("No confirmed map source");
    expect(h.lifecycleCommands).toHaveLength(0);
    shell.dispose();
  });
  it("keeps Continue disabled with the real unavailable Save reason", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    const button = find(shell?.element, "Continue");
    expect(button?.disabled).toBe(true);
    expect(shell?.element.textContent).toContain("Combined save not available yet");
    expect(h.lifecycleCommands).toHaveLength(0);
    shell?.dispose();
  });

  it("keeps a pending Cargo receipt alive across tab hiding", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell?.openSurface("cargo"); find(shell?.element, "Open cargo")?.click();
    shell?.openSurface("machine"); shell?.openSurface("cargo");
    expect(h.uiCommands).toHaveLength(1);
    expect(h.uiSubscribers).toBe(4);
    expect(find(shell?.element, "Check response")?.hidden).toBe(false);
    shell?.dispose(); expect(h.uiSubscribers).toBe(0);
  });

  it("sends explicit user Play and never auto-resumes when closing a panel", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell?.openSurface("cargo"); shell?.closeSurface();
    expect(h.lifecycleCommands).toHaveLength(0);
    find(shell?.element, "Play")?.click();
    expect(h.lifecycleCommands).toEqual([{ kind: "play", sessionId: "shell_session", epoch: 1 }]);
    shell?.dispose();
  });

  it("ignores stale epoch updates and cannot close focus in a replacement session", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    h.publish({ ...initial(), epoch: 2, publicationRevision: 2, statusText: "Replacement" });
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
    shell?.openSurface("cargo"); shell?.dispose();
    expect(h.surfaces).toHaveLength(1); // Initial start surface, before epoch replacement.
    expect(shell?.element.textContent).not.toContain("Replacement");
  });

  it("cleans up without reading a disposed owner or letting a late command touch it", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    let finishDispatch!: () => void;
    const port = { ...h.port, dispatch: () => new Promise<void>(resolve => { finishDispatch = resolve; }) };
    const shell = module!.mountFactoryShell({ port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    const root = doc.createElement("main") as unknown as ElementDouble; root.append(shell.element as unknown as ElementDouble);
    visibleButton(shell.element, "New game")?.click();
    expect(finishDispatch).toBeTypeOf("function");
    const readsBeforeDispose = h.hostReads, focusWritesBeforeDispose = h.panelFocus.length, surfaceWritesBeforeDispose = h.surfaces.length;

    h.setOwnerCurrent(false);
    expect(() => shell.dispose()).not.toThrow();
    finishDispatch(); await Promise.resolve(); await Promise.resolve();

    expect(h.hostReads).toBe(readsBeforeDispose);
    expect(h.panelFocus).toHaveLength(focusWritesBeforeDispose);
    expect(h.surfaces).toHaveLength(surfaceWritesBeforeDispose);
    expect(root.children).toHaveLength(0);
    expect(h.uiSubscribers).toBe(0);
  });

  it("still releases focus and surface when disposing the live owner", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "paused" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell.openSurface("cargo");
    shell.dispose();
    expect(h.panelFocus.at(-1)).toBe(null);
    expect(h.surfaces.at(-1)).toMatchObject({ surface: null, binding: { sessionId: "shell_session", epoch: 1 } });
  });

  it("keeps pending pause distinct from a confirmed Native pause", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    find(shell?.element, "Pause")?.click();
    expect(shell?.element.textContent).toContain("Waiting for action confirmation");
    expect(shell?.element.textContent).not.toContain("Game paused");
    shell?.dispose();
  });

  it("keeps the M-opened map visible through its paused acknowledgement and waits for explicit Play", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const port = { ...h.port, setSurface: (surface: unknown, binding: unknown) => {
      h.port.setSurface(surface, binding);
      if (surface === "map" && h.port.read().phase === "playing") {
        const current = h.port.read(); h.publish({ ...current, phase: "paused", publicationRevision: current.publicationRevision + 1 });
      }
    } };
    const shell = module!.mountFactoryShell({ port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    try {
      const key = Object.assign(new Event("keydown", { cancelable: true }), { key: "m" }); doc.dispatchEvent(key);
      expect(key.defaultPrevented).toBe(true); expect(h.port.read().phase).toBe("paused");
      const map = descendants(shell.element as unknown as ElementDouble).find(node => node.id === "factory-shell-map");
      expect(map).toBeDefined(); expect(visible(map!)).toBe(true);
      expect(descendants(shell.element as unknown as ElementDouble).find(node => node.className.includes("factory-shell-minimap"))?.hidden).toBe(true);
      expect(h.surfaces.at(-1)).toMatchObject({ surface: "map" });

      shell.closeSurface();
      expect(h.port.read().phase).toBe("paused"); expect(visible(map!)).toBe(false); expect(h.lifecycleCommands).toHaveLength(0);
      const surfacesAfterClose = h.surfaces.length;
      doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
      expect(h.surfaces).toHaveLength(surfacesAfterClose);
      const play = visibleButton(shell.element, "Play"); expect(play).toBeDefined(); play!.click();
      expect(h.port.read().phase).toBe("paused");
      expect(h.lifecycleCommands).toEqual([{ kind: "play", sessionId: "shell_session", epoch: 1 }]);
    } finally { shell.dispose(); }
  });

  it.each(["Escape", "Pause button"] as const)("opens Pause for %s without an open workshop view", async input => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    try {
      if (input === "Escape") doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" }));
      else visibleButton(shell.element, "Pause")?.click();
      expect(visibleButton(shell.element, "Play")).toBeDefined();
      expect(h.surfaces.at(-1)).toMatchObject({ surface: "pause" });
      expect(h.lifecycleCommands).toEqual([{ kind: "pause", sessionId: "shell_session", epoch: 1 }]);
      h.publish({ ...h.port.read(), phase: "paused", publicationRevision: h.port.read().publicationRevision + 1 });
      expect(descendants(shell.element as unknown as ElementDouble).find(node => node.id === "factory-shell-pause")?.hidden).toBe(false);
    } finally { shell.dispose(); }
  });

  it("resets only the Pause surface scroll when the paused phase is acknowledged", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    try {
      visibleButton(shell.element, "Pause")?.click();
      const body = descendants(shell.element as unknown as ElementDouble).find(node => node.className === "factory-shell-modal-body");
      expect(body).toBeDefined();
      body!.scrollTop = 129;

      const paused = h.port.read();
      h.publish({ ...paused, phase: "paused", publicationRevision: paused.publicationRevision + 1 });
      expect(body!.scrollTop).toBe(0);
      expect(h.surfaces.at(-1)).toMatchObject({ surface: "pause" });

      body!.scrollTop = 42;
      const confirmed = h.port.read();
      h.publish({ ...confirmed, publicationRevision: confirmed.publicationRevision + 1 });
      expect(body!.scrollTop).toBe(42);
      expect(h.lifecycleCommands).toEqual([{ kind: "pause", sessionId: "shell_session", epoch: 1 }]);
    } finally { shell.dispose(); }
  });

  it("replaces an open workshop view with Pause on a published hold", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    try {
      shell.openSurface("map");
      const map = descendants(shell.element as unknown as ElementDouble).find(node => node.id === "factory-shell-map");
      expect(map).toBeDefined(); expect(visible(map!)).toBe(true);
      h.publish({ ...h.port.read(), phase: "hold", publicationRevision: h.port.read().publicationRevision + 1, statusText: "Session on hold" });
      expect(descendants(shell.element as unknown as ElementDouble).find(node => node.id === "factory-shell-pause")?.hidden).toBe(false);
      expect(visible(map!)).toBe(false); expect(h.lifecycleCommands).toHaveLength(0);
    } finally { shell.dispose(); }
  });

  it("shows the start menu without competing World tool actions", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "i" }));
    expect(h.surfaces.at(-1)).toMatchObject({ surface: "start" });
    expect(visibleButton(shell.element, "New game")).toBeDefined();
    for (const label of ["Cargo", "Build", "Machines", "Power", "Technology", "Map", "Pause", "Aufgabe öffnen"])
      expect(visibleButton(shell.element, label), `${label} competes with New Game`).toBeUndefined();
    shell.dispose();
  });

  it("leaves walking free of the all-workshop navigation until inspection is opened", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    for (const label of ["Cargo", "Build", "Machines", "Power", "Technology", "Map"])
      expect(visibleButton(shell.element, label)).toBeUndefined();
    shell.openSurface("cargo");
    expect(visibleButton(shell.element, "Machines")).toBeUndefined();
    visibleButton(shell.element, "Views")?.click();
    expect(visibleButton(shell.element, "Machines")).toBeDefined();
    shell.closeSurface();
    expect(visibleButton(shell.element, "Machines")).toBeUndefined();
    expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });

  it("offers one local Cargo inspection without inventing an aimed pickup command", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    const context = visibleButton(shell.element, "View cargo");
    expect(context).toBeDefined(); context!.click();
    expect(h.surfaces.at(-1)).toEqual({ surface: "cargo", binding: { sessionId: "shell_session", epoch: 1 } });
    shell.closeSurface();
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
    expect(h.surfaces.at(-1)).toEqual({ surface: "cargo", binding: { sessionId: "shell_session", epoch: 1 } });
    expect(h.uiCommands).toHaveLength(0); expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });

  it("does not advertise local Cargo inspection when the confirmed source is inaccessible", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const uiPort = { ...h.uiPort, read: () => { const value = uiView(); return { ...value, interaction: { ...value.interaction, cargoAccessible: false, openCargo: cap(false, "Außer Reichweite") } }; } };
    const shell = module!.mountFactoryShell({ port: h.port, uiPort, buildPanel: doc.createElement("section"), doc });
    expect(visibleButton(shell.element, "View cargo")).toBeUndefined();
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
    expect(h.surfaces).toHaveLength(0);
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "i" }));
    expect(h.surfaces.at(-1)).toMatchObject({ surface: "cargo" });
    expect(h.uiCommands).toHaveLength(0); shell.dispose();
  });

  it("opens the existing Cargo panel with E when the player is carrying a load", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const value = uiView();
    const uiPort = { ...h.uiPort, read: () => ({ ...value, interaction: { ...value.interaction, cargoAccessible: false,
      handling: { id: "load_1", revision: 1, profileId: "C27-PACK", phase: "Carrying" as const, massMg: 1_000_000 } } }) };
    const shell = module!.mountFactoryShell({ port: h.port, uiPort, buildPanel: doc.createElement("section"), doc });
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
    expect(h.surfaces.at(-1)).toMatchObject({ surface: "cargo" });
    expect(h.uiCommands).toHaveLength(0); expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });

  it.each(["unconfirmed", "not ready"] as const)("does not open Cargo with E when the source is %s", async state => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const value = uiView();
    const next = state === "unconfirmed" ? { ...value, host: { ...value.host, confirmed: false } } : { ...value, state: "RecoveryHold" as const };
    const uiPort = { ...h.uiPort, read: () => next };
    const shell = module!.mountFactoryShell({ port: h.port, uiPort, buildPanel: doc.createElement("section"), doc });
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
    expect(h.surfaces).toHaveLength(0); expect(h.uiCommands).toHaveLength(0); shell.dispose();
  });

  it("uses the fresh shell phase for E before a paused publication is delivered", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    let fresh: FactoryShellView = { ...initial(), phase: "playing", statusText: "Aktiv" };
    h.publish(fresh);
    const port = { ...h.port, read: () => fresh };
    const shell = module!.mountFactoryShell({ port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    try {
      fresh = { ...fresh, phase: "paused", publicationRevision: fresh.publicationRevision + 1 };
      const key = Object.assign(new Event("keydown", { cancelable: true }), { key: "e" });
      doc.dispatchEvent(key);
      expect(key.defaultPrevented).toBe(false);
      expect(h.surfaces).toHaveLength(0);
      expect(h.uiCommands).toHaveLength(0);
    } finally { shell.dispose(); }
  });

  it("keeps repeat, modified and typing E keydowns out of Cargo", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    for (const event of [
      Object.assign(new Event("keydown", { cancelable: true }), { key: "e", repeat: true }),
      Object.assign(new Event("keydown", { cancelable: true }), { key: "e", altKey: true }),
      Object.assign(new Event("keydown", { cancelable: true }), { key: "e", ctrlKey: true }),
      Object.assign(new Event("keydown", { cancelable: true }), { key: "e", metaKey: true })
    ]) doc.dispatchEvent(event);
    const typing = Object.assign(new Event("keydown", { cancelable: true }), { key: "e" });
    Object.defineProperty(typing, "target", { value: { closest: () => true } });
    doc.dispatchEvent(typing);
    expect(h.surfaces).toHaveLength(0); expect(h.uiCommands).toHaveLength(0); shell.dispose();
  });

  it("returns to New Game after closing help from the unstarted session", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell.openSurface("help"); expect(visibleButton(shell.element, "New game")).toBeUndefined();
    shell.closeSurface();
    expect(visibleButton(shell.element, "New game")).toBeDefined();
    expect(h.surfaces.at(-1)).toEqual({ surface: "start", binding: { sessionId: "shell_session", epoch: 1 } });
    expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });

  it.each(["start", "help"] as const)("keeps New Game reachable after Escape from %s before starting", async surface => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    if (surface === "help") shell.openSurface("help");
    const escape = Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" });
    doc.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(visibleButton(shell.element, "New game")).toBeDefined();
    expect(h.surfaces.at(-1)).toEqual({ surface: "start", binding: { sessionId: "shell_session", epoch: 1 } });
    expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });
});


it("PLAY04 hold recovery is a separate explicit action and never dispatches Play",async()=>{
 const module=await load(),h=harness(),doc=docDouble();
 const held={...initial(),phase:"hold" as const,capabilities:{...initial().capabilities,play:cap(false),recoverSimulation:cap(true)}};
 h.publish(held);const shell=module!.mountFactoryShell({port:h.port,uiPort:h.uiPort,buildPanel:doc.createElement("section"),doc});
 try{
  doc.dispatchEvent(Object.assign(new Event("keydown",{cancelable:true}),{key:"e"}));
  doc.dispatchEvent(Object.assign(new Event("keydown",{cancelable:true}),{key:"i"}));
  expect(h.surfaces.at(-1)).toMatchObject({surface:"pause"});expect(h.uiCommands).toHaveLength(0);
  const button=visibleButton(shell.element,"Recover session");expect(button).toBeDefined();expect(button?.disabled).toBe(false);
  button!.click();await Promise.resolve();await Promise.resolve();expect(h.lifecycleCommands).toEqual([{sessionId:held.sessionId,epoch:held.epoch,kind:"recoverSimulation"}]);
  h.publish({...held,phase:"paused",publicationRevision:2,capabilities:{...held.capabilities,recoverSimulation:cap(false),play:cap(true)}});
  expect(visibleButton(shell.element,"Recover session")).toBeUndefined();expect(visibleButton(shell.element,"Play")?.disabled).toBe(false);expect(h.lifecycleCommands).toHaveLength(1);
 }finally{shell.dispose();}
});
