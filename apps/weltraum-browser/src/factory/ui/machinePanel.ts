import { createFp02CatalogInput, loadFactoryCatalog } from "../catalog/fp02Catalog";
import type { FactoryUiLotRef, FactoryUiMachine, FactoryUiPort, FactoryUiReadModel } from "../session/hostPort";
import { createFactoryPanel, factoryReason, formatQuantity, formatSeconds, uiButton, uiText, type FactoryPanel } from "./cargoPanel";

// Immutable terms select finite intents; the Host rechecks custody and admission.
const catalog = loadFactoryCatalog(createFp02CatalogInput());
const selectSourceLots = (view: FactoryUiReadModel, machine: FactoryUiMachine): FactoryUiLotRef[] | null => {
  if (view.binding.catalogDigest !== catalog.catalogDigest || !machine.selectedRecipe) return null;
  const selected = machine.selectedRecipe;
  const recipe = catalog.recipes.find(r => r.sourceId === selected.sourceId && r.version === selected.version && r.digest === selected.digest);
  if (!recipe) return null;
  const manual = recipe.processes.some(p => p.kind === "manual" && p.availability === "first-dry-loop");
  const containers = view.inventory.filter(c => c.accessible && (manual ? ["input", "output", "depot"].includes(c.role) : c.id === machine.inputContainerId));
  const lots: FactoryUiLotRef[] = [];
  for (const term of recipe.inputs) {
    let needed = term.quantityUnits;
    for (const container of containers) for (const stack of container.contents) {
      if (!needed || stack.itemId !== term.itemId || (manual && !stack.freshProduction)) continue;
      const quantityUnits = Math.min(needed, stack.quantityUnits);
      if (quantityUnits > 0) lots.push({ containerId: container.id, containerRevision: container.revision, stackId: stack.stackId, quantityUnits });
      needed -= quantityUnits;
    }
    if (needed) return null;
  }
  return lots;
};

export const mountFactoryMachinePanel = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "machine", "Maschinen");
  const cards = new Map<string, { element: HTMLElement; status: HTMLElement; buffers: HTMLElement; recipes: HTMLSelectElement; start: HTMLButtonElement; work: HTMLButtonElement; finish: HTMLButtonElement }>();
  panel.start(view => {
    for (const [id, card] of cards) if (!view.machines.some(m => m.id === id)) { card.element.remove(); cards.delete(id); }
    for (const machine of view.machines) {
      let card = cards.get(machine.id);
      if (!card) {
        const element = doc.createElement("div"), status = uiText(doc, "p", ""), buffers = doc.createElement("div"), recipes = doc.createElement("select");
        recipes.setAttribute("aria-label", `Rezept für ${machine.name}`);
        recipes.addEventListener("change", () => {
          const current = panel.view.machines.find(m => m.id === machine.id), selected = current?.recipes.find(r => r.ref.sourceId === recipes.value);
          if (current?.installed && !current.jobId && selected) panel.submit({ kind: "select-recipe", machine: { id: current.id, revision: current.revision }, recipe: { ...selected.ref } });
        });
        const start = uiButton(doc, "Starten", () => {
          const current = panel.view.machines.find(m => m.id === machine.id), sourceLots = current && selectSourceLots(panel.view, current);
          if (current?.actions.start.enabled && sourceLots) panel.submit({ kind: "start", machine: { id: current.id, revision: current.revision }, sourceLots });
        });
        const work = uiButton(doc, "Aktiv montieren", () => {
          const current = panel.view.machines.find(m => m.id === machine.id);
          if (current?.jobId && current.actions.manualWork.enabled) panel.submit({ kind: "manual-work", machine: { id: current.id, revision: current.revision }, jobId: current.jobId });
        });
        const finish = uiButton(doc, "Montage abschließen", () => {
          const current = panel.view.machines.find(m => m.id === machine.id);
          if (current?.jobId && current.actions.manualFinish.enabled) panel.submit({ kind: "manual-finish", machine: { id: current.id, revision: current.revision }, jobId: current.jobId });
        });
        element.append(uiText(doc, "h3", machine.name), status, recipes, start, work, finish, buffers); panel.content.append(element);
        card = { element, status, buffers, recipes, start, work, finish }; cards.set(machine.id, card);
      }
      card.status.textContent = `${factoryReason(machine.reason ?? machine.status)} · ${formatSeconds(machine.confirmedWorkMs)}${machine.requiredWorkMs === null ? " bestätigte Arbeit" : ` / ${formatSeconds(machine.requiredWorkMs)}`} · ${machine.allocatedWatts} W`;
      const signature = machine.recipes.map(r => `${r.ref.sourceId}:${r.ref.digest}`).join("|");
      if (card.recipes.dataset.recipes !== signature) {
        card.recipes.replaceChildren(); const empty = doc.createElement("option"); empty.value = ""; empty.textContent = "Rezept wählen"; card.recipes.append(empty);
        for (const recipe of machine.recipes) { const option = doc.createElement("option"); option.value = recipe.ref.sourceId; option.textContent = recipe.name; card.recipes.append(option); }
        card.recipes.dataset.recipes = signature;
      }
      card.recipes.value = machine.selectedRecipe?.sourceId ?? "";
      card.recipes.disabled = panel.busy || !machine.installed || machine.jobId !== null || !machine.recipes.length;
      card.start.disabled = panel.busy || !machine.actions.start.enabled || selectSourceLots(view, machine) === null;
      card.start.title = factoryReason(machine.actions.start.reason);
      card.work.disabled = panel.busy || !machine.actions.manualWork.enabled || machine.jobId === null;
      card.finish.disabled = panel.busy || !machine.actions.manualFinish.enabled || machine.jobId === null;
      card.work.hidden = !machine.actions.manualWork.enabled; card.finish.hidden = !machine.actions.manualFinish.enabled;
      card.buffers.replaceChildren();
      for (const [label, id] of [["Eingang", machine.inputContainerId], ["Produkte", machine.outputContainerId], ["Verschnitt", machine.offcutContainerId], ["In Arbeit", machine.wipContainerId]]) {
        const container = view.inventory.find(c => c.id === id);
        if (container) card.buffers.append(uiText(doc, "p", `${label}: ${formatQuantity(container.massMg, "mg")}${container.contents.length ? ` · ${container.contents.map(s => `${s.name} ${formatQuantity(s.quantityUnits, s.quantityBasis)}`).join(", ")}` : ""}`));
      }
    }
  });
  return panel;
};
