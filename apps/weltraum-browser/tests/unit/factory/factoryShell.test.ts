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
  id = ""; className = ""; value = ""; disabled = false; hidden = false; type = ""; tabIndex = 0;
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
  let view = initial(); let uiSubscribers = 0; const uiCommands: unknown[] = [], lifecycleCommands: unknown[] = [], surfaces: unknown[] = [];
  const listeners = new Set<(value: ReturnType<typeof initial>) => void>();
  const uiPort: FactoryUiPort = { read: uiView, subscribe: () => { uiSubscribers++; return () => { uiSubscribers--; }; }, setPanelFocus: () => {}, readReceipt: () => undefined,
    submit: command => { uiCommands.push(command); return new Promise(() => {}); } };
  const port = { read: () => view, subscribe: (listener: (value: ReturnType<typeof initial>) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispatch: async (command: unknown) => { lifecycleCommands.push(command); }, setSurface: (surface: unknown, binding: unknown) => { surfaces.push({ surface, binding }); } };
  return { port, uiPort, uiCommands, lifecycleCommands, surfaces, get uiSubscribers() { return uiSubscribers; },
    publish: (next: ReturnType<typeof initial>) => { view = next; for (const listener of listeners) listener(next); } };
};

describe("Factory player shell", () => {
  it("keeps Continue disabled with the real unavailable Save reason", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    const button = find(shell?.element, "Fortsetzen");
    expect(button?.disabled).toBe(true);
    expect(shell?.element.textContent).toContain("Gemeinsamer Spielstand noch nicht verfügbar");
    expect(h.lifecycleCommands).toHaveLength(0);
    shell?.dispose();
  });

  it("keeps a pending Cargo receipt alive across tab hiding", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell?.openSurface("cargo"); find(shell?.element, "Fracht öffnen")?.click();
    shell?.openSurface("machine"); shell?.openSurface("cargo");
    expect(h.uiCommands).toHaveLength(1);
    expect(h.uiSubscribers).toBe(4);
    expect(find(shell?.element, "Antwort prüfen")?.hidden).toBe(false);
    shell?.dispose(); expect(h.uiSubscribers).toBe(0);
  });

  it("sends explicit user Play and never auto-resumes when closing a panel", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell?.openSurface("cargo"); shell?.closeSurface();
    expect(h.lifecycleCommands).toHaveLength(0);
    find(shell?.element, "Spielen")?.click();
    expect(h.lifecycleCommands).toEqual([{ kind: "play", sessionId: "shell_session", epoch: 1 }]);
    shell?.dispose();
  });

  it("ignores stale epoch updates and cannot close focus in a replacement session", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    h.publish({ ...initial(), epoch: 2, publicationRevision: 2, statusText: "Replacement" });
    shell?.openSurface("cargo"); shell?.dispose();
    expect(h.surfaces).toHaveLength(1); // Initial start surface, before epoch replacement.
    expect(shell?.element.textContent).not.toContain("Replacement");
  });

  it("keeps pending pause distinct from a confirmed Native pause", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module?.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    find(shell?.element, "Pause")?.click();
    expect(shell?.element.textContent).toContain("Aktion wird noch bestätigt");
    expect(shell?.element.textContent).not.toContain("Spiel pausiert");
    shell?.dispose();
  });

  it("shows the start menu without competing World tool actions", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    expect(visibleButton(shell.element, "Neues Spiel")).toBeDefined();
    for (const label of ["Fracht", "Bauen", "Maschinen", "Energie", "Technik", "Karte", "Pause", "Aufgabe öffnen"])
      expect(visibleButton(shell.element, label), `${label} competes with New Game`).toBeUndefined();
    shell.dispose();
  });

  it("leaves walking free of the all-workshop navigation until inspection is opened", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    for (const label of ["Fracht", "Bauen", "Maschinen", "Energie", "Technik", "Karte"])
      expect(visibleButton(shell.element, label)).toBeUndefined();
    shell.openSurface("cargo");
    expect(visibleButton(shell.element, "Maschinen")).toBeDefined();
    shell.closeSurface();
    expect(visibleButton(shell.element, "Maschinen")).toBeUndefined();
    expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });

  it("offers one local Cargo inspection without inventing an aimed pickup command", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    const context = visibleButton(shell.element, "Fracht ansehen");
    expect(context).toBeDefined(); context!.click();
    expect(h.surfaces.at(-1)).toEqual({ surface: "cargo", binding: { sessionId: "shell_session", epoch: 1 } });
    expect(h.uiCommands).toHaveLength(0); expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });

  it("does not advertise local Cargo inspection when the confirmed source is inaccessible", async () => {
    const module = await load(), h = harness(), doc = docDouble(); h.publish({ ...initial(), phase: "playing", statusText: "Aktiv" });
    const uiPort = { ...h.uiPort, read: () => { const value = uiView(); return { ...value, interaction: { ...value.interaction, cargoAccessible: false, openCargo: cap(false, "Außer Reichweite") } }; } };
    const shell = module!.mountFactoryShell({ port: h.port, uiPort, buildPanel: doc.createElement("section"), doc });
    expect(visibleButton(shell.element, "Fracht ansehen")).toBeUndefined();
    expect(h.uiCommands).toHaveLength(0); shell.dispose();
  });

  it("returns to New Game after closing help from the unstarted session", async () => {
    const module = await load(), h = harness(), doc = docDouble();
    const shell = module!.mountFactoryShell({ port: h.port, uiPort: h.uiPort, buildPanel: doc.createElement("section"), doc });
    shell.openSurface("help"); expect(visibleButton(shell.element, "Neues Spiel")).toBeUndefined();
    shell.closeSurface();
    expect(visibleButton(shell.element, "Neues Spiel")).toBeDefined();
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
    expect(visibleButton(shell.element, "Neues Spiel")).toBeDefined();
    expect(h.surfaces.at(-1)).toEqual({ surface: "start", binding: { sessionId: "shell_session", epoch: 1 } });
    expect(h.lifecycleCommands).toHaveLength(0); shell.dispose();
  });
});
