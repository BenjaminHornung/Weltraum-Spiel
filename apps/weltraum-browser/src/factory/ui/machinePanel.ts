import { englishFactoryText } from "./english";
import { createFp02CatalogInput, loadFactoryCatalog } from "../catalog/fp02Catalog";
import type { FactoryUiLotRef, FactoryUiMachine, FactoryUiPort, FactoryUiReadModel } from "../session/hostPort";
import { factoryItemIcon, factoryToolIcon, groupFactoryItems } from "./itemVisuals";
import { createFactoryPanel, factoryReason, formatQuantity, formatSeconds, uiButton, uiText, type FactoryPanel } from "./cargoPanel";

// Immutable terms select finite intents; the Host rechecks custody and admission.
const catalog = loadFactoryCatalog(createFp02CatalogInput());
type FactoryRecipeLotSelection = Readonly<{ sourceLots: readonly FactoryUiLotRef[] | null; requiresTransfer: boolean }>;
const selectSourceLots = (view: FactoryUiReadModel, machine: FactoryUiMachine): FactoryRecipeLotSelection | null => {
  if (view.binding.catalogDigest !== catalog.catalogDigest || !machine.selectedRecipe) return null;
  const selected = machine.selectedRecipe;
  const recipe = catalog.recipes.find(r => r.sourceId === selected.sourceId && r.version === selected.version && r.digest === selected.digest);
  if (!recipe) return null;
  const manual = recipe.processes.some(p => p.kind === "manual" && p.availability === "first-dry-loop");
  const containers = view.inventory.filter(c => c.accessible && (manual ? ["input", "output", "depot"].includes(c.role) : c.id === machine.inputContainerId));
  const lots: FactoryUiLotRef[] = [];
  let requiresTransfer = false;
  for (const term of recipe.inputs) {
    const item = catalog.items.find(i => i.sourceId === term.itemId);
    if (!item) return null;
    const eligible = containers.flatMap(container => container.contents
      .filter(stack => stack.itemId === term.itemId && (!manual || stack.freshProduction))
      .map(stack => ({ container, stack })));
    const complete = eligible.find(({ stack }) => stack.quantityUnits >= term.quantityUnits);
    if (complete) {
      lots.push({ containerId: complete.container.id, containerRevision: complete.container.revision, stackId: complete.stack.stackId, quantityUnits: term.quantityUnits });
      continue;
    }
    if (item.quantityBasis !== "mg") return null;
    const aggregate = eligible.reduce((total, { stack }) => Number.isSafeInteger(stack.quantityUnits) && stack.quantityUnits > 0
      ? total + BigInt(stack.quantityUnits) : total, 0n);
    if (aggregate < BigInt(term.quantityUnits)) return null;
    requiresTransfer = true;
  }
  return { sourceLots: requiresTransfer ? null : lots, requiresTransfer };
};

export const mountFactoryMachinePanel = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "machine", "Machines");
  const directory = doc.createElement("nav"); directory.className = "factory-machine-directory"; directory.setAttribute("aria-label", "Installed machines");
  const content = doc.createElement("div"), empty = uiText(doc, "p", "No machines installed yet. Build your workshop first.");
  panel.content.append(directory, content, empty);
  let selected: string | null = null;
  const choices = new Map<string, HTMLButtonElement>();
  const cards = new Map<string, { element: HTMLElement; status: HTMLElement; workText: HTMLElement; progress: HTMLElement; progressFill: HTMLElement;
    buffers: HTMLElement; flow: HTMLElement; metrics: HTMLElement; recipes: HTMLSelectElement; start: HTMLButtonElement; mergeHint: HTMLElement; work: HTMLButtonElement; finish: HTMLButtonElement }>();
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
        choice.setAttribute("aria-label", `${englishFactoryText(machine.name)} inspect`); directory.append(choice); choices.set(machine.id, choice);
        const element = doc.createElement("section"); element.className = "factory-machine-card";
        const status = uiText(doc, "p", ""), workText = uiText(doc, "p", ""), progress = doc.createElement("div"), progressFill = doc.createElement("span");
        status.className = "factory-machine-state"; workText.className = "factory-machine-work";
        progress.className = "factory-machine-progress"; progress.setAttribute("role", "progressbar"); progress.setAttribute("aria-label", "Confirmed recipe work"); progress.append(progressFill);
        const buffers = doc.createElement("div"), flow = doc.createElement("div"), metrics = doc.createElement("div"), recipes = doc.createElement("select"), actions = doc.createElement("div");
        const mergeHint = uiText(doc, "p", "Falls kompatibel: Schüttgut über Fracht → Übertragen durch einen anderen erreichbaren Behälter zusammenführen und anschließend hierher zurückbringen.");
        mergeHint.className = "factory-machine-work"; mergeHint.hidden = true; mergeHint.setAttribute("role", "status");
        metrics.className = "factory-machine-metrics";
        buffers.className = "factory-machine-buffers"; flow.className = "factory-machine-recipe"; actions.className = "factory-machine-actions";
        recipes.setAttribute("aria-label", `Recipe for ${englishFactoryText(machine.name)}`);
        recipes.addEventListener("change", () => {
          const current = panel.view.machines.find(m => m.id === machine.id), selected = current?.recipes.find(r => r.ref.sourceId === recipes.value);
          if (current?.installed && !current.jobId && selected) panel.submit({ kind: "select-recipe", machine: { id: current.id, revision: current.revision }, recipe: { ...selected.ref } });
        });
        const start = uiButton(doc, "Start job", () => {
          const current = panel.view.machines.find(m => m.id === machine.id), selection = current && selectSourceLots(panel.view, current);
          if (current?.actions.start.enabled && selection?.sourceLots) panel.submit({ kind: "start", machine: { id: current.id, revision: current.revision }, sourceLots: [...selection.sourceLots] });
        });
        const work = uiButton(doc, "Assemble by hand", () => {
          const current = panel.view.machines.find(m => m.id === machine.id);
          if (current?.jobId && current.actions.manualWork.enabled) panel.submit({ kind: "manual-work", machine: { id: current.id, revision: current.revision }, jobId: current.jobId });
        });
        const finish = uiButton(doc, "Finish assembly", () => {
          const current = panel.view.machines.find(m => m.id === machine.id);
          if (current?.jobId && current.actions.manualFinish.enabled) panel.submit({ kind: "manual-finish", machine: { id: current.id, revision: current.revision }, jobId: current.jobId });
        });
        actions.append(recipes, start, work, finish);
        element.append(uiText(doc, "h3", machine.name), status, flow, metrics, progress, workText, actions, mergeHint, buffers); content.append(element);
        card = { element, status, workText, progress, progressFill, buffers, flow, metrics, recipes, start, mergeHint, work, finish }; cards.set(machine.id, card);
      }
      card.status.textContent = factoryReason(machine.reason ?? machine.status);
      const required = machine.requiredWorkMs, progressKnown = required !== null && Number.isFinite(required) && required > 0 && Number.isFinite(machine.confirmedWorkMs);
      card.progress.hidden = !progressKnown;
      if (progressKnown) {
        const confirmed = Math.min(required!, Math.max(0, machine.confirmedWorkMs)); card.progressFill.style.width = `${confirmed / required! * 100}%`;
        card.progress.setAttribute("aria-valuemin", "0"); card.progress.setAttribute("aria-valuemax", String(required)); card.progress.setAttribute("aria-valuenow", String(confirmed));
      }
      const interrupted = machine.jobId !== null && ["WAIT_POWER", "BLOCKED_OUTPUT"].includes(machine.status);
      card.workText.textContent = `${interrupted ? "Progress retained · " : ""}${formatSeconds(machine.confirmedWorkMs)}${required === null ? " confirmed work" : ` / ${formatSeconds(required)}`}${interrupted ? " · Material is retained" : ""}`;
      card.workText.hidden = machine.jobId === null;
      const signature = machine.recipes.map(r => `${r.ref.sourceId}:${r.ref.digest}`).join("|");
      if (card.recipes.dataset.recipes !== signature) {
        card.recipes.replaceChildren(); const empty = doc.createElement("option"); empty.value = ""; empty.textContent = "Choose recipe"; card.recipes.append(empty);
        for (const recipe of machine.recipes) { const option = doc.createElement("option"); option.value = recipe.ref.sourceId; option.textContent = englishFactoryText(recipe.name); card.recipes.append(option); }
        card.recipes.dataset.recipes = signature;
      }
      card.recipes.value = machine.selectedRecipe?.sourceId ?? "";
      card.recipes.disabled = panel.busy || !machine.installed || machine.jobId !== null || !machine.recipes.length;
      const selection = selectSourceLots(view, machine);
      const mergeHintVisible = !panel.busy && view.host.confirmed && machine.installed && machine.jobId === null
        && machine.actions.start.enabled && selection?.requiresTransfer === true;
      card.start.disabled = panel.busy || !machine.actions.start.enabled || !selection?.sourceLots;
      card.start.title = factoryReason(machine.actions.start.reason);
      card.mergeHint.hidden = !mergeHintVisible;
      card.work.disabled = panel.busy || !machine.actions.manualWork.enabled || machine.jobId === null;
      card.finish.disabled = panel.busy || !machine.actions.manualFinish.enabled || machine.jobId === null;
      card.work.hidden = !machine.actions.manualWork.enabled; card.finish.hidden = !machine.actions.manualFinish.enabled;
      const selectedRecipe = machine.selectedRecipe;
      const recipe = view.binding.catalogDigest === catalog.catalogDigest && selectedRecipe ? catalog.recipes.find(r => r.sourceId === selectedRecipe.sourceId && r.version === selectedRecipe.version && r.digest === selectedRecipe.digest) : undefined;
      const nominal = recipe ? machine.recipes.find(r => r.ref.sourceId === recipe.sourceId && r.ref.digest === recipe.digest) : undefined;
      const output = recipe?.outputs.find(t => t.itemId !== "fp02.bulk.steel_offcut"), item = output && catalog.items.find(i => i.sourceId === output.itemId);
      const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 6 });
      const rate = output && item && nominal?.durationMs ? output.quantityUnits * 60_000 / nominal.durationMs / (item.quantityBasis === "mg" ? 1_000_000 : item.quantityBasis === "mm" ? 1000 : 1) : null;
      const metrics = [nominal ? nominal.durationMs === null ? "Active manual work" : `Duration ${formatSeconds(nominal.durationMs)}` : null,
        nominal ? rate === null ? "Nominal rate: manual work" : `Nominal rate ${number.format(rate)} ${item?.quantityBasis === "mg" ? "kg" : item?.quantityBasis === "mm" ? "m" : "items"}/min` : null,
        nominal ? `Rated power ${number.format(nominal.powerWatts / 1000)} kW` : null,
        view.power.allocationConfirmed === false ? "Allocation pending" : `Allocated ${number.format(machine.allocatedWatts)} W`].filter((v): v is string => v !== null);
      const signatureMetrics = JSON.stringify(metrics);
      if (card.metrics.dataset.values !== signatureMetrics) { card.metrics.replaceChildren(...metrics.map(text => uiText(doc, "p", text))); card.metrics.dataset.values = signatureMetrics; }
      const recipeKey = recipe?.digest ?? "none";
      if (card.flow.dataset.recipe !== recipeKey) {
        card.flow.replaceChildren(); card.flow.dataset.recipe = recipeKey;
        if (recipe) for (const [label, terms] of [["Input", recipe.inputs], ["Output", recipe.outputs]] as const) {
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
        for (const [label, id] of [["Input", machine.inputContainerId], ["Products", machine.outputContainerId], ["Offcuts", machine.offcutContainerId], ["Work in progress", machine.wipContainerId]]) {
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
