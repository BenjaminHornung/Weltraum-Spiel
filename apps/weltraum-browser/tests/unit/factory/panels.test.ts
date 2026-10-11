import { describe, expect, it } from "vitest";
import { isSaveSafeResourceId } from "../../../src/resources/ids";
import { loadFactoryCatalog, createFp02CatalogInput } from "../../../src/factory/catalog/fp02Catalog";
import type { FactoryUiCommand, FactoryUiPanel, FactoryUiPort, FactoryUiReadModel, FactoryUiReceipt, FactoryUiResult } from "../../../src/factory/session/hostPort";
import { mountFactoryCargoPanel } from "../../../src/factory/ui/cargoPanel";
import { mountFactoryMachinePanel } from "../../../src/factory/ui/machinePanel";
import { mountFactoryPowerPanel } from "../../../src/factory/ui/powerPanel";
import { mountFactoryTechnologyView } from "../../../src/factory/ui/technologyView";

// Synthetic published-UI snapshots and a Document double exercise only the UI
// protocol; native grounding, movement, focus cancellation and world adoption
// remain Integrator tests. No fake World, elapsed clock or inventory mutation.
class ElementDouble extends EventTarget {
  readonly children: ElementDouble[] = [];
  parent: ElementDouble | null = null;
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { cssText: "" };
  id = ""; value = ""; disabled = false; hidden = false; type = "";
  open = false; selected = false; tabIndex = 0;
  private content = "";
  constructor(readonly tagName: string) { super(); }
  get textContent(): string { return this.content + this.children.map(c => c.textContent).join(" "); }
  set textContent(v: string | null) { this.content = v ?? ""; this.replaceChildren(); }
  append(...items: ElementDouble[]): void { for (const child of items) { child.parent = this; this.children.push(child); } }
  replaceChildren(...items: ElementDouble[]): void { for (const child of this.children) child.parent = null; this.children.length = 0; this.append(...items); }
  setAttribute(k: string, v: string): void { this.attributes.set(k, v); }
  getAttribute(k: string): string | null { return this.attributes.get(k) ?? null; }
  contains(v: unknown): boolean { return this === v || this.children.some(c => c.contains(v)); }
  remove(): void { if (this.parent) { const index = this.parent.children.indexOf(this); if (index >= 0) this.parent.children.splice(index, 1); this.parent = null; } }
  focus(): void { this.dispatchEvent(new Event("focusin")); }
  click(): void { if (!this.disabled) this.dispatchEvent(new Event("click")); }
}
const documentDouble = () => ({ createElement: (tag: string) => new ElementDouble(tag.toUpperCase()) }) as unknown as Document;
const descendants = (root: ElementDouble): ElementDouble[] => [root, ...root.children.flatMap(descendants)];
const button = (root: HTMLElement, label: string): ElementDouble | undefined => descendants(root as unknown as ElementDouble).find(e => e.tagName === "BUTTON" && e.textContent === label);
const freeze = <T>(v: T): T => { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const catalog = loadFactoryCatalog(createFp02CatalogInput());
const binding = { catalogDigest: catalog.catalogDigest, terrainSourceDigest: "terrain_source", powerSourceProfileDigest: "power_source", terrainRevision: 1, facilityRevision: 1, materialRevision: 0, netRevision: 1, handlingRevision: 0 };
const cap = (enabled = true, reason: string | null = null) => ({ enabled, reason });
const initialView = (): FactoryUiReadModel => freeze({
  version: "fp06-ui-read-v1", sessionId: "ui_session", epoch: 1, publicationRevision: 1, binding,
  host: { sessionId: "ui_session", epoch: 1, nativeTick: 6, physicsStatus: "Paused", confirmed: true,
    terrain: { epoch: 1, revision: 1, sourceDigest: "terrain_source", baseDigest: "terrain_base", cellMeters: .125, originMeters: { x: 0, y: 0, z: 0 }, sizeX: 16, sizeY: 16, sizeZ: 16 } },
  factorySteps: 1, elapsedMs: 100, state: "Ready", reason: null, focusedPanel: null,
  inventory: [{ id: "wreck", revision: 0, ownerId: "wreck_owner", role: "cargo", accessible: true, massMg: 576_000_000, capacityMassMg: 4_000_000_000, capacityVolumeMm3: 30_000_000_000,
    contents: [{ stackId: "steel", itemId: catalog.cargo.find(c => c.cargoId === "C10")!.itemId, name: "Schiffsstahl", quantityUnits: 96_000_000, quantityBasis: "mg", massMg: 96_000_000, freshProduction: false },
      { stackId: "c26", itemId: catalog.cargo.find(c => c.cargoId === "C26")!.itemId, name: "Zuschnitt-Grundchassis", quantityUnits: 1, quantityBasis: "piece", massMg: 180_000_000, freshProduction: false },
      { stackId: "c27", itemId: catalog.cargo.find(c => c.cargoId === "C27")!.itemId, name: "Umform-Grundchassis", quantityUnits: 1, quantityBasis: "piece", massMg: 300_000_000, freshProduction: false }],
    pickupProfiles: [{ profileId: "raw8", name: "8 kg Stahl", sourceLots: [{ containerId: "wreck", containerRevision: 0, stackId: "steel", quantityUnits: 8_000_000 }], capability: cap() }] }],
  machines: [{ id: "cutter", revision: 1, definitionId: "B06", name: "Zuschnittstation", installed: true, status: "WAIT_POWER", reason: "WAIT_POWER", selectedRecipe: null, recipes: [], jobId: "job_1", confirmedWorkMs: 1200, requiredWorkMs: 30000, allocatedWatts: 0, inputContainerId: "cut_in", outputContainerId: "cut_out", offcutContainerId: "cut_waste", wipContainerId: "cut_wip", installedContainerId: "cut_installed", ports: [], actions: { start: cap(false, "WAIT_POWER"), manualWork: cap(false), manualFinish: cap(false), toggle: cap(false) } }],
  power: { status: "WAIT_POWER", generationWatts: 0, allocatedWatts: 0, batteryEnergyJ: 12_960_000, batteryCapacityJ: 14_400_000, reserveEnergyJ: 3_600_000, sourceQuality: "confirmed", consumers: [{ id: "cut_power", name: "Zuschnittstation", requestedWatts: 1200, allocatedWatts: 0, reason: "WAIT_POWER" }] },
  technologies: [{ id: "blast_furnace", name: "Hochofen", status: "PLANNED", requirements: ["Erzkonzentrat", "Reduktionsmittel"], reason: "NOT_IMPLEMENTED" }],
  interaction: { cargoOpened: true, cargoAccessible: true, handling: null, openCargo: cap(false), deposit: cap(false), returnCargo: cap(false) }, lastReceipt: null
});
const harness = () => {
  let view = initialView(); const listeners = new Set<(v: FactoryUiReadModel) => void>();
  const commands: FactoryUiCommand[] = []; const focuses: (FactoryUiPanel | null)[] = [];
  const receipts = new Map<string, FactoryUiReceipt>();
  let resolve: ((result: FactoryUiResult) => void) | undefined;
  let reject: ((reason: Error) => void) | undefined;
  const port: FactoryUiPort = {
    read: () => view, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setPanelFocus: panel => { focuses.push(panel); }, readReceipt: id => receipts.get(id),
    submit: command => { commands.push(command); return new Promise((r, j) => { resolve = r; reject = j; }); }
  };
  const publish = (v: FactoryUiReadModel) => { view = freeze(v); for (const listener of listeners) listener(view); };
  const complete = (status: FactoryUiResult["status"] = "Committed") => {
    const command = commands.at(-1)!;
    const receipt: FactoryUiReceipt = freeze({ commandId: command.commandId, requestCanonicalJson: JSON.stringify(command), status: status === "NoOp" ? "Committed" : status, reason: null, publicationRevision: view.publicationRevision, binding: view.binding });
    receipts.set(command.commandId, receipt); resolve!({ status, receipt });
  };
  return { port, commands, focuses, publish, complete, failTransport: () => reject!(new Error("Lost reply")), receipts, get view() { return view; }, get subscribers() { return listeners.size; } };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("W09 frozen panel projection and finite player intents", () => {
  it("entering the power panel delegates focus neutralization to the Host", () => {
    const h = harness(), panel = mountFactoryPowerPanel(h.port, documentDouble());
    panel.element.dispatchEvent(new Event("focusin"));
    expect(h.focuses).toEqual(["power"]);
    expect(h.commands).toHaveLength(0);
    panel.dispose();
  });
  it("renders exact source quantities and only adopts published material changes", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, documentDouble());
    expect(panel.element.textContent).toContain("96 kg");
    expect(panel.element.textContent).toContain("180 kg");
    expect(panel.element.textContent).toContain("300 kg");
    expect(panel.element.textContent).toContain("1 Stück");
    const source = h.view.inventory[0]!;
    h.publish({ ...h.view, publicationRevision: 2, binding: { ...h.view.binding, materialRevision: 1 }, inventory: [{ ...source, revision: 1, massMg: 568_000_000, contents: source.contents.map(s => s.stackId === "steel" ? { ...s, quantityUnits: 88_000_000, massMg: 88_000_000 } : s) },
      { id: "carrier", revision: 1, ownerId: "wreck_owner", role: "carrier", accessible: true, massMg: 8_000_000, capacityMassMg: 8_000_000, capacityVolumeMm3: 5_000_000, contents: [{ ...source.contents[0]!, stackId: "steel_child", quantityUnits: 8_000_000, massMg: 8_000_000 }], pickupProfiles: [] }] });
    expect(panel.element.textContent).toContain("88 kg");
    expect(panel.element.textContent).toContain("8 kg");
    expect(panel.element.dataset.publicationRevision).toBe("2");
    expect(h.commands).toHaveLength(0);
    panel.dispose();
  });
  it("shows planned technology requirements without granting a hidden research unlock", () => {
    const h = harness(), panel = mountFactoryTechnologyView(h.port, documentDouble());
    const select = button(panel.element, "Hochofen");
    expect(select).toBeDefined(); select!.click();
    expect(panel.element.textContent).toContain("Geplant");
    expect(panel.element.textContent).toContain("Erzkonzentrat");
    expect(panel.element.textContent).toContain("Reduktionsmittel");
    expect(panel.element.textContent).not.toMatch(/Level|Forschung freischalten/i);
    expect(h.commands).toHaveLength(0);
    panel.dispose();
  });
  it("keeps finite pickup pending and never changes stock or submits a second command", async () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, documentDouble());
    const pickup = button(panel.element, "Aufnehmen: 8 kg Stahl");
    expect(pickup).toBeDefined(); pickup!.click(); pickup!.click();
    expect(h.focuses).toContain("cargo");
    expect(h.commands).toHaveLength(1);
    expect(h.commands[0]).toMatchObject({ kind: "pickup", profileId: "raw8", sourceLots: [{ stackId: "steel", quantityUnits: 8_000_000 }] });
    expect(panel.element.textContent).toContain("96 kg");
    expect(panel.element.textContent).toContain("Antwort ausstehend");
    h.complete("NoOp"); await flush();
    expect(h.commands).toHaveLength(1);
    expect(panel.element.textContent).toContain("96 kg");
    const machine = mountFactoryMachinePanel(h.port, documentDouble());
    expect(machine.element.textContent).toContain("Wartet auf Strom");
    expect(machine.element.textContent).toContain("1,2 s");
    machine.dispose(); panel.dispose();
    expect(h.subscribers).toBe(0);
  });
  it("preserves a focused pickup control across unrelated confirmed publications", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, documentDouble());
    const pickup = button(panel.element, "Aufnehmen: 8 kg Stahl")!;
    h.publish({ ...h.view, publicationRevision: 2, power: { ...h.view.power, batteryEnergyJ: 12_959_990 } });
    expect(button(panel.element, "Aufnehmen: 8 kg Stahl")).toBe(pickup);
    expect(h.commands).toHaveLength(0); panel.dispose();
  });
  it("rejects foreign-session intent submission and ignores older inventory publications", () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, documentDouble());
    h.publish({ ...h.view, publicationRevision: 4 });
    h.publish({ ...h.view, publicationRevision: 2, inventory: [] });
    expect(panel.element.dataset.publicationRevision).toBe("4");
    expect(panel.element.textContent).toContain("96 kg");
    h.publish({ ...initialView(), sessionId: "other_session", publicationRevision: 5 });
    button(panel.element, "Aufnehmen: 8 kg Stahl")!.click();
    expect(h.commands).toHaveLength(0); panel.dispose();
  });
  it("keeps one unknown intent until a matching authoritative receipt is found", async () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, documentDouble());
    button(panel.element, "Aufnehmen: 8 kg Stahl")!.click();
    h.failTransport(); await flush();
    expect(panel.element.textContent).toContain("Antwort unbekannt");
    button(panel.element, "Aufnehmen: 8 kg Stahl")!.click();
    expect(h.commands).toHaveLength(1);
    const command = h.commands[0]!;
    h.receipts.set(command.commandId, { commandId: "wrong", requestCanonicalJson: "{}", status: "Committed", reason: null, publicationRevision: 1, binding });
    button(panel.element, "Antwort prüfen")!.click();
    expect(panel.element.textContent).toContain("Antwort unbekannt");
    h.receipts.set(command.commandId, { commandId: command.commandId, requestCanonicalJson: "{}", status: "Committed", reason: null, publicationRevision: 1, binding });
    button(panel.element, "Antwort prüfen")!.click();
    expect(panel.element.textContent).toContain("Antwort unbekannt");
    h.receipts.set(command.commandId, { commandId: command.commandId, requestCanonicalJson: JSON.stringify(command), status: "Committed", reason: null, publicationRevision: 1, binding });
    button(panel.element, "Antwort prüfen")!.click();
    expect(panel.element.textContent).toContain("Aktion bestätigt");
    expect(button(panel.element, "Antwort prüfen")!.hidden).toBe(true);
    expect(panel.element.textContent).toContain("96 kg"); panel.dispose();
  });
  it("does not release focus between controls or revive disposed panels after an answer", async () => {
    const h = harness(), panel = mountFactoryCargoPanel(h.port, documentDouble());
    panel.element.dispatchEvent(new Event("focusin"));
    const event = new Event("focusout");
    Object.defineProperty(event, "relatedTarget", { value: button(panel.element, "Aufnehmen: 8 kg Stahl") });
    panel.element.dispatchEvent(event); expect(h.focuses).toEqual(["cargo"]);
    button(panel.element, "Aufnehmen: 8 kg Stahl")!.click();
    panel.dispose(); const count = h.focuses.length, text = panel.element.textContent;
    h.complete(); await flush();
    expect(h.focuses).toHaveLength(count); expect(panel.element.textContent).toBe(text);
    expect(h.subscribers).toBe(0);
  });
  it("transfers an exact local published amount without resetting the player's entry each step", () => {
    const h = harness();
    h.publish({ ...h.view, inventory: [...h.view.inventory, { ...h.view.inventory[0]!, id: "cut_in", role: "input", contents: [], pickupProfiles: [], massMg: 0 }] });
    const panel = mountFactoryCargoPanel(h.port, documentDouble());
    const elements = descendants(panel.element as unknown as ElementDouble);
    const amount = elements.find(e => e.tagName === "INPUT" && e.getAttribute("aria-label") === "Transfermenge");
    expect(amount).toBeDefined(); amount!.value = "8,000001";
    const target = elements.find(e => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Transferziel")!;
    target.value = "cut_in"; target.dispatchEvent(new Event("change"));
    h.publish({ ...h.view, publicationRevision: 2 });
    expect(amount!.value).toBe("8,000001");
    button(panel.element, "Übertragen")!.click();
    expect(h.commands).toHaveLength(1);
    expect(h.commands[0]).toMatchObject({ kind: "transfer", source: { containerId: "wreck", containerRevision: 0, stackId: "steel", quantityUnits: 8_000_001 }, target: { id: "cut_in", revision: 0 }, expected: h.view.binding });
    expect(panel.element.textContent).toContain("96 kg"); panel.dispose();
  });
  it("starts only the frozen finite recipe from actual input and blocks catalog mismatches", () => {
    const h = harness(), recipe = catalog.recipes.find(r => r.sourceId === "REC-01-CUT")!;
    const ref = { sourceId: recipe.sourceId, version: recipe.version, digest: recipe.digest };
    const machine = { ...h.view.machines[0]!, jobId: null, selectedRecipe: ref, recipes: [{ ref, name: "Zuschnitt", durationMs: 30000, powerWatts: 1200 }], actions: { ...h.view.machines[0]!.actions, start: cap() } };
    h.publish({ ...h.view, machines: [machine], inventory: [{ ...h.view.inventory[0]!, id: "cut_in", role: "input", revision: 3, pickupProfiles: [] }] });
    const panel = mountFactoryMachinePanel(h.port, documentDouble());
    button(panel.element, "Starten")!.click();
    expect(h.commands[0]).toMatchObject({ kind: "start", machine: { id: "cutter", revision: 1 }, sourceLots: [{ containerId: "cut_in", containerRevision: 3, stackId: "steel", quantityUnits: 8_000_000 }] });
    panel.dispose();
    const wrong = harness(); wrong.publish({ ...h.view, binding: { ...binding, catalogDigest: "other_catalog" } });
    const rejected = mountFactoryMachinePanel(wrong.port, documentDouble());
    expect(button(rejected.element, "Starten")!.disabled).toBe(true);
    button(rejected.element, "Starten")!.click(); expect(wrong.commands).toHaveLength(0); rejected.dispose();
  });
  it("rejects zero, over-lot, nonfinite and sub-mg transfer amounts", () => {
    const h = harness(); h.publish({ ...h.view, inventory: [...h.view.inventory, { ...h.view.inventory[0]!, id: "cut_in", role: "input", contents: [], pickupProfiles: [], massMg: 0 }] });
    const panel = mountFactoryCargoPanel(h.port, documentDouble()), elements = descendants(panel.element as unknown as ElementDouble);
    const amount = elements.find(e => e.tagName === "INPUT")!, target = elements.find(e => e.getAttribute("aria-label") === "Transferziel")!;
    target.value = "cut_in"; target.dispatchEvent(new Event("change"));
    for (const invalid of ["0", "97", "0,0000001", "-1", "Infinity", "NaN", "1e2"]) {
      amount.value = invalid; amount.dispatchEvent(new Event("input"));
      expect(button(panel.element, "Übertragen")!.disabled).toBe(true); button(panel.element, "Übertragen")!.click();
    }
    expect(h.commands).toHaveLength(0); panel.dispose();
  });
  it("uses save-safe unique command IDs with a real UUID-shaped Native session across remounts", async () => {
    const h = harness(), sessionId = "839b1cc4-dc9d-4c8f-9433-7662c4e15462";
    h.publish({ ...h.view, sessionId });
    const panel = mountFactoryCargoPanel(h.port, documentDouble());
    button(panel.element, "Aufnehmen: 8 kg Stahl")!.click();
    expect(h.commands[0]!.sessionId).toBe(sessionId);
    expect(isSaveSafeResourceId(h.commands[0]!.commandId)).toBe(true);
    h.complete(); await flush(); panel.dispose();
    const remounted = mountFactoryCargoPanel(h.port, documentDouble());
    button(remounted.element, "Aufnehmen: 8 kg Stahl")!.click();
    expect(h.commands[1]!.commandId).not.toBe(h.commands[0]!.commandId);
    expect(isSaveSafeResourceId(h.commands[1]!.commandId)).toBe(true); remounted.dispose();
  });
  it("retains the selected technology keyboard control after selection and confirmed publications", () => {
    const h = harness(), panel = mountFactoryTechnologyView(h.port, documentDouble());
    const choice = button(panel.element, "Hochofen")!;
    choice.focus(); choice.click();
    expect(button(panel.element, "Hochofen")).toBe(choice);
    expect((panel.element as unknown as ElementDouble).contains(choice)).toBe(true);
    h.publish({ ...h.view, publicationRevision: 2, elapsedMs: 200, factorySteps: 2 });
    expect(button(panel.element, "Hochofen")).toBe(choice);
    choice.click(); expect(panel.element.textContent).toContain("Erzkonzentrat");
    expect(h.commands).toHaveLength(0); panel.dispose();
  });
});
