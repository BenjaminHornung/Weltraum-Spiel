import { createFp02CatalogInput, loadFactoryCatalog } from "../catalog/fp02Catalog";
import type { FactoryUiLotRef, FactoryUiMachine, FactoryUiPort, FactoryUiReadModel } from "../session/hostPort";
import { factoryItemIcon, factoryToolIcon, groupFactoryItems } from "./itemVisuals";
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
  const directory = doc.createElement("nav"); directory.className = "factory-machine-directory"; directory.setAttribute("aria-label", "Installierte Maschinen");
  const content = doc.createElement("div"), empty = uiText(doc, "p", "Noch keine Maschine vorhanden. Baue zuerst deine Werkstatt auf.");
  panel.content.append(directory, content, empty);
  let selected: string | null = null;
  const choices = new Map<string, HTMLButtonElement>();
  const cards = new Map<string, { element: HTMLElement; status: HTMLElement; workText: HTMLElement; progress: HTMLElement; progressFill: HTMLElement;
    buffers: HTMLElement; flow: HTMLElement; recipes: HTMLSelectElement; start: HTMLButtonElement; work: HTMLButtonElement; finish: HTMLButtonElement }>();
  const select = () => {
    for (const [id, card] of cards) card.element.hidden = id !== selected;
    for (const [id, choice] of choices) choice.setAttribute("aria-pressed", String(id === selected));
  };
  panel.start(view => {
    for (const [id, card] of cards) if (!view.machines.some(m => m.id === id)) { card.element.remove(); cards.delete(id); choices.get(id)?.remove(); choices.delete(id); }
    if (!view.machines.some(m => m.id === selected)) selected = view.machines.find(m => m.installed)?.id ?? view.machines[0]?.id ?? null;
    empty.hidden = view.machines.length > 0; directory.hidden = view.machines.length < 2;
    for (const machine of view.machines) {
      let card = cards.get(machine.id);
      if (!card) {
        const choice = uiButton(doc, "", () => { selected = machine.id; select(); }); choice.append(factoryToolIcon(doc, "machine"), uiText(doc, "span", machine.name));
        choice.setAttribute("aria-label", `${machine.name} ansehen`); directory.append(choice); choices.set(machine.id, choice);
        const element = doc.createElement("section"); element.className = "factory-machine-card";
        const status = uiText(doc, "p", ""), workText = uiText(doc, "p", ""), progress = doc.createElement("div"), progressFill = doc.createElement("span");
        status.className = "factory-machine-state"; workText.className = "factory-machine-work";
        progress.className = "factory-machine-progress"; progress.setAttribute("role", "progressbar"); progress.setAttribute("aria-label", "Bestätigte Rezeptarbeit"); progress.append(progressFill);
        const buffers = doc.createElement("div"), flow = doc.createElement("div"), recipes = doc.createElement("select"), actions = doc.createElement("div");
        buffers.className = "factory-machine-buffers"; flow.className = "factory-machine-recipe"; actions.className = "factory-machine-actions";
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
        actions.append(recipes, start, work, finish);
        element.append(uiText(doc, "h3", machine.name), status, progress, workText, flow, actions, buffers); content.append(element);
        card = { element, status, workText, progress, progressFill, buffers, flow, recipes, start, work, finish }; cards.set(machine.id, card);
      }
      card.status.textContent = factoryReason(machine.reason ?? machine.status);
      const required = machine.requiredWorkMs, progressKnown = required !== null && Number.isFinite(required) && required > 0 && Number.isFinite(machine.confirmedWorkMs);
      card.progress.hidden = !progressKnown;
      if (progressKnown) {
        const confirmed = Math.min(required!, Math.max(0, machine.confirmedWorkMs)); card.progressFill.style.width = `${confirmed / required! * 100}%`;
        card.progress.setAttribute("aria-valuemin", "0"); card.progress.setAttribute("aria-valuemax", String(required)); card.progress.setAttribute("aria-valuenow", String(confirmed));
      }
      card.workText.textContent = `${formatSeconds(machine.confirmedWorkMs)}${required === null ? " bestätigte Arbeit" : ` / ${formatSeconds(required)}`} · Versorgung ${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(machine.allocatedWatts / 1000)} kW`;
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
      const selectedRecipe = machine.selectedRecipe;
      const recipe = view.binding.catalogDigest === catalog.catalogDigest && selectedRecipe ? catalog.recipes.find(r => r.sourceId === selectedRecipe.sourceId && r.version === selectedRecipe.version && r.digest === selectedRecipe.digest) : undefined;
      const recipeKey = recipe?.digest ?? "none";
      if (card.flow.dataset.recipe !== recipeKey) {
        card.flow.replaceChildren(); card.flow.dataset.recipe = recipeKey;
        if (recipe) for (const [label, terms] of [["Einsatz", recipe.inputs], ["Ergebnis", recipe.outputs]] as const) {
          const group = doc.createElement("div"); group.append(uiText(doc, "small", label));
          for (const term of terms) { const item = catalog.items.find(i => i.sourceId === term.itemId); if (!item) continue;
            const row = doc.createElement("div"); row.className = "factory-material-row"; const text = doc.createElement("span");
            text.append(uiText(doc, "strong", item.displayName), uiText(doc, "small", formatQuantity(term.quantityUnits, item.quantityBasis))); row.append(factoryItemIcon(doc, item.sourceId, item.displayName), text); group.append(row); }
          card.flow.append(group);
        }
      }
      const bufferSignature = JSON.stringify([machine.inputContainerId, machine.outputContainerId, machine.offcutContainerId, machine.wipContainerId].map(id => view.inventory.find(c => c.id === id)));
      if (card.buffers.dataset.contents !== bufferSignature) {
        card.buffers.dataset.contents = bufferSignature; card.buffers.replaceChildren();
        for (const [label, id] of [["Eingang", machine.inputContainerId], ["Produkte", machine.outputContainerId], ["Verschnitt", machine.offcutContainerId], ["In Bearbeitung", machine.wipContainerId]]) {
          const container = view.inventory.find(c => c.id === id); if (!container) continue;
          const row = doc.createElement("div"); row.className = "factory-machine-buffer"; row.append(uiText(doc, "strong", label));
          const groups = groupFactoryItems(container, view.binding.catalogDigest);
          if (!groups.length) row.append(uiText(doc, "span", formatQuantity(container.massMg, "mg")));
          for (const item of groups) row.append(factoryItemIcon(doc, item.itemId, item.name), uiText(doc, "span", `${item.name} · ${formatQuantity(item.quantityUnits, item.quantityBasis)}`));
          card.buffers.append(row);
        }
      }
    }
    select();
  });
  return panel;
};
