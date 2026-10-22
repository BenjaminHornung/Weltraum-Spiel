import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../../src/resources/serialization";
import { createFp02CatalogInput, loadFactoryCatalog } from "../../../src/factory/catalog/fp02Catalog";
import type { FactoryUiCommand, FactoryUiPort, FactoryUiReadModel, FactoryUiReceipt } from "../../../src/factory/session/hostPort";
import { mountFactoryCargoPanel } from "../../../src/factory/ui/cargoPanel";
import { mountFactoryMachinePanel } from "../../../src/factory/ui/machinePanel";
import { mountFactoryTechnologyView } from "../../../src/factory/ui/technologyView";
import { mountFactoryPowerPanel } from "../../../src/factory/ui/powerPanel";

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
  it("projects legacy technology requirements and stock deficits into English without changing published facts", () => {
    const h = harness();
    h.publish({ ...h.value, technologies: [{ id: "B03", name: "Expeditionsbatterie", status: "MISSING_REQUIREMENTS",
      requirements: ["Endliche C03-Batterie, bezahlter lokaler Aufbau, tragfähige Auflage und Kabel; Leistung und tatsächlicher Ladezustand begrenzt", "Im freien Bestand fehlen 2 Stück Getriebemotor", "Quelle: FP03 §4.7 / FP01"], reason: "MISSING_MATERIAL" }] });
    const before = canonicalJson(h.value), panel = mountFactoryTechnologyView(h.port, doc());
    expect(panel.element.textContent).toContain("Finite C03 battery");
    expect(panel.element.textContent).toContain("Missing from free stock: 2 items");
    expect(panel.element.textContent).toContain("Source: FP03 §4.7 / FP01");
    expect(canonicalJson(h.value)).toBe(before); expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("distinguishes nominal demand from assigned power and retains interrupted work", () => {
    const h = harness(), base = h.value, recipe = catalog.recipes.find(r => r.sourceId === "REC-01-CUT")!;
    const ref = { sourceId: recipe.sourceId, version: recipe.version, digest: recipe.digest };
    h.publish({ ...base, machines: [{ id: "cutter", revision: 1, definitionId: "B06", name: "Zuschnitt", installed: true,
      status: "WAIT_POWER", reason: "WAIT_POWER", selectedRecipe: ref, recipes: [{ ref, name: "Zuschnitt", durationMs: 30_000, powerWatts: 1200 }],
      jobId: "interrupted_job", confirmedWorkMs: 12_000, requiredWorkMs: 30_000, allocatedWatts: 0,
      inputContainerId: "cut_input", outputContainerId: "cut_out", offcutContainerId: "cut_off", wipContainerId: "cut_wip", installedContainerId: "cut_installed",
      ports: [], actions: { start: cap(false), manualWork: cap(false), manualFinish: cap(false), toggle: cap(false) } }],
      power: { ...base.power, allocationConfirmed: true, consumers: [{ id: "consumer_cutter", name: "cutter", requestedWatts: 1200, allocatedWatts: 0, reason: "WAIT_POWER" }] } });
    const panel = mountFactoryMachinePanel(h.port, doc());
    expect(panel.element.textContent).toContain("Rated power 1.2 kW");
    expect(panel.element.textContent).toContain("Allocated 0 W");
    expect(panel.element.textContent).toContain("Progress retained");
    expect(panel.element.textContent).toContain("Nominal rate 15 kg/min");
    expect(h.value.machines[0]!.confirmedWorkMs).toBe(12_000);
    const power = mountFactoryPowerPanel(h.port, doc());
    expect(power.element.textContent).toContain("Progress retained");
    expect(power.element.textContent).toContain("Nominal demand 1.2 kW");
    h.publish({ ...h.value, publicationRevision: 2, machines: [{ ...h.value.machines[0]!, jobId: null, status: "IDLE" }],
      power: { ...h.value.power, consumers: [{ ...h.value.power.consumers[0]!, requestedWatts: 0 }] } });
    expect(power.element.textContent).toContain("Current demand 0 W");
    expect(power.element.textContent).toContain("Nominal demand 1.2 kW");
    power.dispose();
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("does not present unconfirmed consumer allocations as measured watts", () => {
    const h = harness(), base = h.value;
    h.publish({ ...base, power: { ...base.power, allocationConfirmed: false,
      consumers: [{ id: "cutter", name: "Zuschnitt", requestedWatts: 1200, allocatedWatts: 0, reason: "WAIT_POWER" }] } });
    const panel = mountFactoryPowerPanel(h.port, doc());
    expect(panel.element.textContent).toContain("Allocation pending");
    expect(panel.element.textContent).not.toContain("Allocated 0 W");
    h.publish({ ...h.value, publicationRevision: 2, power: { ...h.value.power, allocationConfirmed: true } });
    expect(panel.element.textContent).toContain("Allocated 0 W");
    expect(panel.element.textContent).toContain("Current demand 1,200 W");
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("offers an explicit package choice without submitting or fabricating material lots", () => {
    const h = harness(), base = h.value, container = base.inventory[0]!, profile = container.pickupProfiles[0]!;
    h.publish({ ...base, inventory: [{ ...container, pickupProfiles: [{ ...profile, profileId: "B07-BOM", name: "Umformung" }, { ...profile, profileId: "B06-BOM", name: "Zuschnitt" }] }] });
    const panel = mountFactoryCargoPanel(h.port, doc());
    const choose = byLabel(panel.element, "Cutter kit select");
    expect(choose).toBeDefined(); choose!.click();
    expect(byLabel(panel.element, "Transport package")!.value).toBe(JSON.stringify(["wreck", "B06-BOM"]));
    expect(h.commands).toHaveLength(0);
    button(panel.element, "Pick up: Cutter kit")!.click();
    expect(h.commands[0]).toMatchObject({ kind: "pickup", profileId: "B06-BOM", sourceLots: profile.sourceLots });
    panel.dispose();
  });
  it("shows the closed and raw cable package choices in metres", () => {
    const h = harness(), base = h.value, container = base.inventory[0]!, profile = container.pickupProfiles[0]!;
    const labels = [["CABLE2750", "Cable · 2.75 m"], ["CABLE5000", "Cable · 5 m"], ["CABLE5750", "Cable · 5.75 m"],
      ["CABLE7750", "Cable · 7.75 m"], ["CABLE8500", "Cable · 8.5 m"]] as const;
    h.publish({ ...base, inventory: [{ ...container, pickupProfiles: labels.map(([profileId]) => ({ ...profile, profileId, name: profileId })) }, base.inventory[1]!] });
    const panel = mountFactoryCargoPanel(h.port, doc());
    for (const [, label] of labels) expect(button(panel.element, `Pick up: ${label}`)).toBeDefined();
    panel.dispose();
  });
  it("previews a finite cable connection and submits the current admitted lot once on confirmation", () => {
    const h = harness(), base = h.value, lot = { containerId: "wreck", containerRevision: 2, stackId: "cable", quantityUnits: 8000 };
    h.publish({ ...base, inventory: [{ ...base.inventory[0]!, contents: [...base.inventory[0]!.contents,
      { stackId: "cable", itemId: "fp02.comp.field_cable", name: "Feldkabel", quantityUnits: 40000, quantityBasis: "mm", massMg: 10000000, freshProduction: false }] }],
      connections: { power: [{ id: "battery_cutter", sourcePortId: "battery_port", targetPortId: "cutter_port", lengthMm: 8000, cableLot: lot, capability: cap() }], belts: [] } });
    const panel = mountFactoryPowerPanel(h.port, doc()), choice = byLabel(panel.element, "Power connection")!;
    expect(choice).toBeDefined(); choice.value = "battery_cutter"; choice.dispatchEvent(new Event("change"));
    expect(panel.element.textContent).toContain("Cable required 8 m");
    expect(panel.element.textContent).toContain("Field cable available 40 m");
    expect(h.commands).toHaveLength(0);
    button(panel.element, "Confirm connection")!.click(); button(panel.element, "Confirm connection")!.click();
    expect(h.commands).toHaveLength(1);
    expect(h.commands[0]).toMatchObject({ kind: "connect-power", sourcePortId: "battery_port", targetPortId: "cutter_port", cableLot: lot });
    panel.dispose();
  });
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
    const selection = byLabel(panel.element, "Ship steel select");
    expect(selection).toBeDefined(); expect(selection && visible(selection)).toBe(true);
    expect(panel.element.textContent).toContain("24.000001 kg");
    expect(visible(byLabel(panel.element, "Transfer source")!)).toBe(false);
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("selected material still sends a finite exact original lot and preserves its pending receipt", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const select = byLabel(panel.element, "Ship steel select"); expect(select).toBeDefined(); select!.click();
    const amount = byLabel(panel.element, "Transfer quantity")!, target = byLabel(panel.element, "Transfer destination")!;
    amount.value = "8,000001"; amount.dispatchEvent(new Event("input")); target.value = "cut_input"; target.dispatchEvent(new Event("change"));
    button(panel.element, "Transfer")!.click(); button(panel.element, "Transfer")!.click();
    expect(h.commands).toHaveLength(1);
    expect(h.commands[0]).toMatchObject({ kind: "transfer", source: { containerId: "wreck", containerRevision: 2, stackId: "steel_a", quantityUnits: 8_000_001 }, target: { id: "cut_input", revision: 3 } });
    const request = h.commands[0]!;
    h.receipts.set(request.commandId, { commandId: request.commandId, requestCanonicalJson: canonicalJson(request), status: "Committed", reason: null, publicationRevision: 1, binding: h.value.binding });
    button(panel.element, "Check response")!.click();
    expect(panel.element.textContent).toContain("Action confirmed"); expect(panel.element.textContent).toContain("24.000001 kg"); panel.dispose();
  });

  it("shows one selected machine and lets selection change without a production command", () => {
    const h = harness(), base = h.value;
    const machine = (id: string, name: string) => ({ id, revision: 1, definitionId: id === "cutter" ? "B06" : "B07", name, installed: true, status: "WAIT_POWER", reason: "WAIT_POWER", selectedRecipe: null, recipes: [], jobId: null, confirmedWorkMs: 0, requiredWorkMs: 30_000, allocatedWatts: 0,
      inputContainerId: `${id}_in`, outputContainerId: `${id}_out`, offcutContainerId: `${id}_off`, wipContainerId: `${id}_wip`, installedContainerId: `${id}_installed`, ports: [], actions: { start: cap(false), manualWork: cap(false), manualFinish: cap(false), toggle: cap(false) } });
    h.publish({ ...base, machines: [machine("cutter", "Zuschnittstation"), machine("former", "Umformwerk")] });
    const panel = mountFactoryMachinePanel(h.port, doc());
    const inspect = byLabel(panel.element, "Former inspect"); expect(inspect).toBeDefined(); inspect!.click();
    const visibleRecipes = all(panel.element as unknown as Element).filter(e => e.tagName === "SELECT" && visible(e));
    expect(visibleRecipes).toHaveLength(1); expect(visibleRecipes[0]!.getAttribute("aria-label")).toBe("Recipe for Former");
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("shows carried material without offering an unsupported source transfer selection", () => {
    const h = harness(), base = h.value;
    h.publish({ ...base, inventory: [...base.inventory, { ...base.inventory[0]!, id: "carried", role: "carrier", contents: [{ ...base.inventory[0]!.contents[0]!, stackId: "carried_steel", name: "Trägerstahl" }], pickupProfiles: [] }] });
    const panel = mountFactoryCargoPanel(h.port, doc());
    expect(panel.element.textContent).toContain("Carried steel");
    expect(byLabel(panel.element, "Carried steel select")).toBeUndefined();
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("removes a vanished source's pickup button while retaining its unknown canonical receipt", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const pickup = button(panel.element, "Pick up: Steel batch · 8 kg"); expect(pickup).toBeDefined(); pickup!.click();
    const request = h.commands[0]!;
    h.publish({ ...h.value, publicationRevision: 2, inventory: h.value.inventory.filter(c => c.id !== "wreck") });
    expect(button(panel.element, "Pick up: Steel batch · 8 kg")).toBeUndefined();
    expect(h.commands).toHaveLength(1); expect(button(panel.element, "Check response")!.hidden).toBe(false);
    h.receipts.set(request.commandId, { commandId: request.commandId, requestCanonicalJson: canonicalJson(request), status: "Committed", reason: null, publicationRevision: 2, binding: h.value.binding });
    button(panel.element, "Check response")!.click();
    expect(panel.element.textContent).toContain("Action confirmed"); expect(h.commands).toHaveLength(1); panel.dispose();
  });

  it.each(["constructor", "__proto__", "toString"])("keeps the unrecognized %s identity an honest neutral item and profile", async identity => {
    const module = await visuals();
    expect(module?.factoryItemSymbol(identity)).toBe("package");
    expect(module?.factoryProfileLabel(identity, "Unknown cargo")).toBe("Unknown cargo");
    const d = doc();
    expect(module?.factoryToolIcon(d, identity).innerHTML).toBe(module?.factoryToolIcon(d, "unknown_tool").innerHTML);
  });

  it.each(["constructor", "__proto__", "toString"])("shows the neutral package for an unknown %s pickup profile", identity => {
    const h = harness(), container = h.value.inventory[0]!, profile = container.pickupProfiles[0]!;
    h.publish({ ...h.value, inventory: [{ ...container, pickupProfiles: [{ ...profile, profileId: identity, name: "Unbekanntes Transportgut" }] }] });
    const panel = mountFactoryCargoPanel(h.port, doc());
    expect(byLabel(panel.element, "Unknown cargo")?.dataset.factoryItem).toBe("unknown_package");
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("reveals a transfer only after deliberate material selection while leaving finite pickup visible", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const amount = byLabel(panel.element, "Transfer quantity")!, target = byLabel(panel.element, "Transfer destination")!;
    expect(visible(amount)).toBe(false); expect(visible(target)).toBe(false);
    expect(visible(button(panel.element, "Pick up: Steel batch · 8 kg")!)).toBe(true);
    h.publish({ ...h.value, publicationRevision: 2 });
    expect(visible(amount)).toBe(false);
    const detail = byLabel(panel.element, "Transfer material")!; let focused = 0;
    detail.addEventListener("focusin", () => { focused++; });
    byLabel(panel.element, "Ship steel select")!.click();
    expect(visible(amount)).toBe(true); expect(visible(target)).toBe(true); expect(focused).toBe(1);
    expect(h.commands).toHaveLength(0); panel.dispose();
  });

  it("lets explicit individual-lot inspection reveal the same finite source without submitting", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    const source = byLabel(panel.element, "Transfer source")!, amount = byLabel(panel.element, "Transfer quantity")!;
    expect(visible(amount)).toBe(false);
    button(panel.element, "Choose individual lot")!.click();
    expect(visible(source)).toBe(true); expect(visible(amount)).toBe(true);
    source.value = JSON.stringify(["wreck", "steel_b"]); source.dispatchEvent(new Event("change"));
    amount.value = "8"; amount.dispatchEvent(new Event("input"));
    const target = byLabel(panel.element, "Transfer destination")!; target.value = "cut_input"; target.dispatchEvent(new Event("change"));
    button(panel.element, "Transfer")!.click();
    expect(h.commands).toHaveLength(1);
    expect(h.commands[0]).toMatchObject({ kind: "transfer", source: { containerId: "wreck", containerRevision: 2, stackId: "steel_b", quantityUnits: 8_000_000 } });
    panel.dispose();
  });

  it("hides a vanished selected source rather than revealing the next default and preserves the pending transfer receipt", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, doc());
    byLabel(panel.element, "Ship steel select")!.click();
    const amount = byLabel(panel.element, "Transfer quantity")!, target = byLabel(panel.element, "Transfer destination")!;
    amount.value = "8"; amount.dispatchEvent(new Event("input")); target.value = "cut_input"; target.dispatchEvent(new Event("change"));
    button(panel.element, "Transfer")!.click(); const request = h.commands[0]!;
    const original = h.value.inventory[0]!;
    h.publish({ ...h.value, publicationRevision: 2, inventory: [{ ...original, contents: [original.contents[1]!], pickupProfiles: [] }, h.value.inventory[1]!] });
    expect(visible(amount)).toBe(false); expect(h.commands).toHaveLength(1);
    expect(button(panel.element, "Check response")!.hidden).toBe(false);
    h.receipts.set(request.commandId, { commandId: request.commandId, requestCanonicalJson: canonicalJson(request), status: "Committed", reason: null, publicationRevision: 2, binding: h.value.binding });
    button(panel.element, "Check response")!.click();
    expect(panel.element.textContent).toContain("Action confirmed"); expect(visible(amount)).toBe(false); expect(h.commands).toHaveLength(1);
    panel.dispose();
  });
});
