import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../../src/resources/serialization";
import { createFp02CatalogInput, loadFactoryCatalog } from "../../../src/factory/catalog/fp02Catalog";
import type { FactoryUiCommand, FactoryUiPort, FactoryUiReadModel, FactoryUiReceipt } from "../../../src/factory/session/hostPort";
import { mountFactoryCargoPanel } from "../../../src/factory/ui/cargoPanel";
import { mountFactoryMachinePanel } from "../../../src/factory/ui/machinePanel";

// Published immutable UI facts, not a simulated World or production clock.
class Element extends EventTarget {
  readonly children: Element[] = []; parent: Element | null = null;
  readonly attributes = new Map<string, string>(); readonly dataset: Record<string, string> = {};
  readonly style = { cssText: "" }; id = ""; className = ""; value = ""; type = "";
  hidden = false; disabled = false; tabIndex = 0; open = false; innerHTML = "";
  private text = "";
  constructor(readonly tagName: string) { super(); }
  get textContent(): string { return this.text + this.children.map(c => c.textContent).join(" "); }
  set textContent(value: string | null) { this.text = value ?? ""; this.replaceChildren(); }
  append(...nodes: Element[]): void { for (const node of nodes) { node.remove(); node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes: Element[]): void { for (const node of this.children) node.parent = null; this.children.length = 0; this.append(...nodes); }
  setAttribute(key: string, value: string): void { this.attributes.set(key, value); }
  getAttribute(key: string): string | null { return this.attributes.get(key) ?? null; }
  remove(): void { if (this.parent) { const index = this.parent.children.indexOf(this); if (index >= 0) this.parent.children.splice(index, 1); this.parent = null; } }
  contains(node: unknown): boolean { return this === node || this.children.some(c => c.contains(node)); }
  click(): void { if (!this.disabled) this.dispatchEvent(new Event("click")); }
  focus(): void { this.dispatchEvent(new Event("focusin")); }
}
const doc = () => ({ createElement: (name: string) => new Element(name.toUpperCase()), createElementNS: (_namespace: string, name: string) => new Element(name.toUpperCase()) }) as unknown as Document;
const all = (element: Element): Element[] => [element, ...element.children.flatMap(all)];
const visible = (element: Element): boolean => !element.hidden && (!element.parent || visible(element.parent));
const byLabel = (root: HTMLElement, name: string) => all(root as unknown as Element).find(e => e.attributes.get("aria-label") === name);
const button = (root: HTMLElement, name: string) => all(root as unknown as Element).find(e => e.tagName === "BUTTON" && e.textContent === name);
const catalog = loadFactoryCatalog(createFp02CatalogInput());
const cap = (enabled = true) => ({ enabled, reason: enabled ? null : "Nicht verfügbar" });
const initial = (): FactoryUiReadModel => ({ version: "fp06-ui-read-v1", sessionId: "game_ui", epoch: 4, publicationRevision: 1,
  binding: { catalogDigest: catalog.catalogDigest, terrainSourceDigest: "ground", powerSourceProfileDigest: "power", terrainRevision: 1, facilityRevision: 1, materialRevision: 2, netRevision: 1, handlingRevision: 0 },
  host: { sessionId: "game_ui", epoch: 4, nativeTick: 0, physicsStatus: "Paused", confirmed: true, terrain: { epoch: 4, revision: 1, sourceDigest: "ground", baseDigest: "base", cellMeters: .125, originMeters: { x: 0, y: 0, z: 0 }, sizeX: 256, sizeY: 128, sizeZ: 256 } },
  factorySteps: 0, elapsedMs: 0, state: "Ready", reason: null, focusedPanel: null,
  inventory: [{ id: "wreck", revision: 2, ownerId: "wreck_owner", role: "cargo", accessible: true, massMg: 24_000_001, capacityMassMg: 4_000_000_000, capacityVolumeMm3: 1_000_000_000,
    contents: [{ stackId: "steel_a", itemId: "fp02.bulk.steel_known", name: "Schiffsstahl", quantityUnits: 16_000_001, quantityBasis: "mg", massMg: 16_000_001, freshProduction: false },
      { stackId: "steel_b", itemId: "fp02.bulk.steel_known", name: "Schiffsstahl", quantityUnits: 8_000_000, quantityBasis: "mg", massMg: 8_000_000, freshProduction: false }],
    pickupProfiles: [{ profileId: "RAW8", name: "RAW8", sourceLots: [{ containerId: "wreck", containerRevision: 2, stackId: "steel_a", quantityUnits: 8_000_000 }], capability: cap() }] },
    { id: "cut_input", revision: 3, ownerId: "cutter", role: "input", accessible: true, massMg: 0, capacityMassMg: 16_000_000, capacityVolumeMm3: 1_000_000_000, contents: [], pickupProfiles: [] }],
  machines: [], power: { status: "IDLE", generationWatts: 0, allocatedWatts: 0, batteryEnergyJ: null, batteryCapacityJ: null, reserveEnergyJ: null, sourceQuality: "confirmed", consumers: [] }, technologies: [],
  interaction: { cargoOpened: true, cargoAccessible: true, handling: null, openCargo: cap(false), deposit: cap(false), returnCargo: cap(false) }, lastReceipt: null });
const harness = () => {
  let value = initial(); const commands: FactoryUiCommand[] = [], listeners = new Set<(next: FactoryUiReadModel) => void>(), receipts = new Map<string, FactoryUiReceipt>();
  const port: FactoryUiPort = { read: () => value, subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, setPanelFocus: () => {},
    submit: command => { commands.push(command); return new Promise(() => {}); }, readReceipt: id => receipts.get(id) };
  return { port, commands, receipts, get value() { return value; }, publish: (next: FactoryUiReadModel) => { value = next; for (const fn of listeners) fn(next); } };
};
const visualsPath = "../../../src/factory/ui/itemVisuals";
const visuals = async () => existsSync(new URL("../../../src/factory/ui/itemVisuals.ts", import.meta.url)) ? await import(visualsPath) : null;

describe("game item and selected inspector presentation", () => {
  it("recognizes real steel forms with different physical symbols", async () => {
    const module = await visuals();
    expect(module?.factoryItemSymbol("fp02.bulk.steel_known")).toBe("stock");
    expect(module?.factoryItemSymbol("fp02.bulk.steel_profile")).toBe("profile");
    expect(module?.factoryItemSymbol("fp02.bulk.steel_sheet")).toBe("sheet");
    expect(module?.factoryItemSymbol("fp02.bulk.steel_offcut")).toBe("offcut");
    expect(module?.factoryItemSymbol("unknown_material")).toBe("package");
  });

  it("combines only matching known item custody and keeps original exact stack references", async () => {
    const module = await visuals(), value = initial(), container = value.inventory[0]!;
    const groups = module?.groupFactoryItems(container, value.binding.catalogDigest);
    expect(groups?.length).toBe(1);
    expect(groups?.[0]).toMatchObject({ quantityUnits: 24_000_001, massMg: 24_000_001, stacks: container.contents });
    expect(module?.groupFactoryItems({ ...container, contents: [container.contents[0]!, { ...container.contents[1]!, freshProduction: true }] }, value.binding.catalogDigest)?.length).toBe(2);
    expect(module?.groupFactoryItems(container, "unrecognized_catalog")?.length).toBe(2);
  });

  it("starts Cargo with material selection rather than a visible global source form", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const selection = byLabel(panel.element, "Schiffsstahl auswählen");
    expect(selection).toBeDefined(); expect(selection && visible(selection)).toBe(true);
    expect(panel.element.textContent).toContain("24,000001 kg");
    expect(visible(byLabel(panel.element, "Transferquelle")!)).toBe(false);
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("selected material still sends a finite exact original lot and preserves its pending receipt", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const select = byLabel(panel.element, "Schiffsstahl auswählen"); expect(select).toBeDefined(); select!.click();
    const amount = byLabel(panel.element, "Transfermenge")!, target = byLabel(panel.element, "Transferziel")!;
    amount.value = "8,000001"; amount.dispatchEvent(new Event("input")); target.value = "cut_input"; target.dispatchEvent(new Event("change"));
    button(panel.element, "Übertragen")!.click(); button(panel.element, "Übertragen")!.click();
    expect(h.commands).toHaveLength(1);
    expect(h.commands[0]).toMatchObject({ kind: "transfer", source: { containerId: "wreck", containerRevision: 2, stackId: "steel_a", quantityUnits: 8_000_001 }, target: { id: "cut_input", revision: 3 } });
    const request = h.commands[0]!;
    h.receipts.set(request.commandId, { commandId: request.commandId, requestCanonicalJson: canonicalJson(request), status: "Committed", reason: null, publicationRevision: 1, binding: h.value.binding });
    button(panel.element, "Antwort prüfen")!.click();
    expect(panel.element.textContent).toContain("Aktion bestätigt"); expect(panel.element.textContent).toContain("24,000001 kg"); panel.dispose();
  });

  it("shows one selected machine and lets selection change without a production command", () => {
    const h = harness(), base = h.value;
    const machine = (id: string, name: string) => ({ id, revision: 1, definitionId: id === "cutter" ? "B06" : "B07", name, installed: true, status: "WAIT_POWER", reason: "WAIT_POWER", selectedRecipe: null, recipes: [], jobId: null, confirmedWorkMs: 0, requiredWorkMs: 30_000, allocatedWatts: 0,
      inputContainerId: `${id}_in`, outputContainerId: `${id}_out`, offcutContainerId: `${id}_off`, wipContainerId: `${id}_wip`, installedContainerId: `${id}_installed`, ports: [], actions: { start: cap(false), manualWork: cap(false), manualFinish: cap(false), toggle: cap(false) } });
    h.publish({ ...base, machines: [machine("cutter", "Zuschnittstation"), machine("former", "Umformwerk")] });
    const panel = mountFactoryMachinePanel(h.port, doc());
    const inspect = byLabel(panel.element, "Umformwerk ansehen"); expect(inspect).toBeDefined(); inspect!.click();
    const visibleRecipes = all(panel.element as unknown as Element).filter(e => e.tagName === "SELECT" && visible(e));
    expect(visibleRecipes).toHaveLength(1); expect(visibleRecipes[0]!.getAttribute("aria-label")).toBe("Rezept für Umformwerk");
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("shows carried material without offering an unsupported source transfer selection", () => {
    const h = harness(), base = h.value;
    h.publish({ ...base, inventory: [...base.inventory, { ...base.inventory[0]!, id: "carried", role: "carrier", contents: [{ ...base.inventory[0]!.contents[0]!, stackId: "carried_steel", name: "Trägerstahl" }], pickupProfiles: [] }] });
    const panel = mountFactoryCargoPanel(h.port, doc());
    expect(panel.element.textContent).toContain("Trägerstahl");
    expect(byLabel(panel.element, "Trägerstahl auswählen")).toBeUndefined();
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("removes a vanished source's pickup button while retaining its unknown canonical receipt", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const pickup = button(panel.element, "Aufnehmen: Stahlauftrag · 8 kg"); expect(pickup).toBeDefined(); pickup!.click();
    const request = h.commands[0]!;
    h.publish({ ...h.value, publicationRevision: 2, inventory: h.value.inventory.filter(c => c.id !== "wreck") });
    expect(button(panel.element, "Aufnehmen: Stahlauftrag · 8 kg")).toBeUndefined();
    expect(h.commands).toHaveLength(1); expect(button(panel.element, "Antwort prüfen")!.hidden).toBe(false);
    h.receipts.set(request.commandId, { commandId: request.commandId, requestCanonicalJson: canonicalJson(request), status: "Committed", reason: null, publicationRevision: 2, binding: h.value.binding });
    button(panel.element, "Antwort prüfen")!.click();
    expect(panel.element.textContent).toContain("Aktion bestätigt"); expect(h.commands).toHaveLength(1); panel.dispose();
  });

  it.each(["constructor", "__proto__", "toString"])("keeps the unrecognized %s identity an honest neutral item and profile", async identity => {
    const module = await visuals();
    expect(module?.factoryItemSymbol(identity)).toBe("package");
    expect(module?.factoryProfileLabel(identity, "Unbekanntes Transportgut")).toBe("Unbekanntes Transportgut");
    const d = doc();
    expect(module?.factoryToolIcon(d, identity).innerHTML).toBe(module?.factoryToolIcon(d, "unknown_tool").innerHTML);
  });

  it.each(["constructor", "__proto__", "toString"])("shows the neutral package for an unknown %s pickup profile", identity => {
    const h = harness(), container = h.value.inventory[0]!, profile = container.pickupProfiles[0]!;
    h.publish({ ...h.value, inventory: [{ ...container, pickupProfiles: [{ ...profile, profileId: identity, name: "Unbekanntes Transportgut" }] }] });
    const panel = mountFactoryCargoPanel(h.port, doc());
    expect(byLabel(panel.element, "Unbekanntes Transportgut")?.dataset.factoryItem).toBe("unknown_package");
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("reveals a transfer only after deliberate material selection while leaving finite pickup visible", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const amount = byLabel(panel.element, "Transfermenge")!, target = byLabel(panel.element, "Transferziel")!;
    expect(visible(amount)).toBe(false); expect(visible(target)).toBe(false);
    expect(visible(button(panel.element, "Aufnehmen: Stahlauftrag · 8 kg")!)).toBe(true);
    h.publish({ ...h.value, publicationRevision: 2 });
    expect(visible(amount)).toBe(false);
    const detail = byLabel(panel.element, "Material übertragen")!; let focused = 0;
    detail.addEventListener("focusin", () => { focused++; });
    byLabel(panel.element, "Schiffsstahl auswählen")!.click();
    expect(visible(amount)).toBe(true); expect(visible(target)).toBe(true); expect(focused).toBe(1);
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("lets explicit individual-lot inspection reveal the same finite source without submitting", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const source = byLabel(panel.element, "Transferquelle")!, amount = byLabel(panel.element, "Transfermenge")!;
    expect(visible(amount)).toBe(false);
    button(panel.element, "Einzelposten wählen")!.click();
    expect(visible(source)).toBe(true); expect(visible(amount)).toBe(true);
    source.value = JSON.stringify(["wreck", "steel_b"]); source.dispatchEvent(new Event("change"));
    amount.value = "8"; amount.dispatchEvent(new Event("input"));
    const target = byLabel(panel.element, "Transferziel")!; target.value = "cut_input"; target.dispatchEvent(new Event("change"));
    button(panel.element, "Übertragen")!.click();
    expect(h.commands).toHaveLength(1);
    expect(h.commands[0]).toMatchObject({ kind: "transfer", source: { containerId: "wreck", containerRevision: 2, stackId: "steel_b", quantityUnits: 8_000_000 } });
    panel.dispose();
  });

  it("hides a vanished selected source rather than revealing the next default and preserves the pending transfer receipt", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    byLabel(panel.element, "Schiffsstahl auswählen")!.click();
    const amount = byLabel(panel.element, "Transfermenge")!, target = byLabel(panel.element, "Transferziel")!;
    amount.value = "8"; amount.dispatchEvent(new Event("input")); target.value = "cut_input"; target.dispatchEvent(new Event("change"));
    button(panel.element, "Übertragen")!.click(); const request = h.commands[0]!;
    const original = h.value.inventory[0]!;
    h.publish({ ...h.value, publicationRevision: 2, inventory: [{ ...original, contents: [original.contents[1]!], pickupProfiles: [] }, h.value.inventory[1]!] });
    expect(visible(amount)).toBe(false); expect(h.commands).toHaveLength(1);
    expect(button(panel.element, "Antwort prüfen")!.hidden).toBe(false);
    h.receipts.set(request.commandId, { commandId: request.commandId, requestCanonicalJson: canonicalJson(request), status: "Committed", reason: null, publicationRevision: 2, binding: h.value.binding });
    button(panel.element, "Antwort prüfen")!.click();
    expect(panel.element.textContent).toContain("Aktion bestätigt"); expect(visible(amount)).toBe(false); expect(h.commands).toHaveLength(1);
    panel.dispose();
  });
});
