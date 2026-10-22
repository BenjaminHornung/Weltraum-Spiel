import { englishFactoryText } from "./english";
import type { FactoryUiCommand, FactoryUiInventory, FactoryUiPanel, FactoryUiPort, FactoryUiReadModel, FactoryUiReceipt } from "../session/hostPort";
import { canonicalJson, canonicalizeJsonValue } from "../../resources/serialization";
import { factoryItemIcon, factoryProfileLabel, groupFactoryItems } from "./itemVisuals";

export interface FactoryPanel { readonly element: HTMLElement; dispose(): void }

export type FactoryUiIntent = FactoryUiCommand extends infer C ? C extends FactoryUiCommand ? Omit<C, "version" | "commandId" | "sessionId" | "epoch" | "expected"> : never : never;
export const uiText = (doc: Document, tag: string, text: string): HTMLElement => {
  const element = doc.createElement(tag); element.textContent = englishFactoryText(text); return element;
};
export const uiButton = (doc: Document, text: string, action: () => void): HTMLButtonElement => {
  const button = doc.createElement("button"); button.type = "button"; button.textContent = englishFactoryText(text);
  button.addEventListener("click", action); return button;
};
export const formatQuantity = (units: number, basis: "mg" | "mm" | "piece"): string => {
  const scale = basis === "mg" ? 1_000_000 : basis === "mm" ? 1000 : 1;
  const whole = Math.floor(units / scale), remainder = units % scale;
  const fraction = remainder ? `.${String(remainder).padStart(basis === "mg" ? 6 : 3, "0").replace(/0+$/, "")}` : "";
  return `${whole}${fraction} ${basis === "mg" ? "kg" : basis === "mm" ? "m" : units === 1 ? "item" : "items"}`;
};
export const formatSeconds = (ms: number): string => `${String(ms / 1000)} s`;
export const factoryReason = (reason: string | null): string => {
  const labels: Record<string, string> = {
    IDLE: "Ready", RUNNING: "Running", READY: "Ready", WAIT_POWER: "Waiting for power",
    BLOCKED_OUTPUT: "Output full", WAIT_OUTPUT: "Output full", WAIT_INPUT: "Missing material",
    LAID_OUT: "Material deposited", ASSEMBLED: "Assembled", FINISHED: "Completed", COMPLETED: "Completed",
    NOT_IMPLEMENTED: "Planned", NOT_INSTALLED: "Not built yet", OUT_OF_REACH: "Out of reach",
    SOURCE_STALE: "View expired", STALE: "View expired", RecoveryHold: "Recovery required",
    Waiting: "Please wait", Disposed: "Session ended", Ready: "Ready",
    CarrierSupport: "Load needs solid, level ground. Close Cargo, select Play, step onto clear level ground nearby, reopen Cargo, and retry.",
    "FactoryFacilityRejected:CarrierSupport": "Load needs solid, level ground. Close Cargo, select Play, step onto clear level ground nearby, reopen Cargo, and retry.",
  };
  return reason ? labels[reason] ?? "Action currently unavailable" : "";
};

/** Presentation lifetime and pending intent; all domain numbers come from the Host. */
export const createFactoryPanel = (port: FactoryUiPort, doc: Document, panel: FactoryUiPanel, title: string) => {
  const element = doc.createElement("section");
  element.setAttribute("aria-label", title); element.tabIndex = 0;
  element.className = "factory-panel";
  const content = doc.createElement("div"), status = uiText(doc, "p", "");
  content.className = "factory-panel-content";
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  let view = port.read(), pending: FactoryUiCommand | null = null, disposed = false, focused = false;
  const sessionId = view.sessionId, epoch = view.epoch;
  let render: (view: FactoryUiReadModel) => void = () => {};
  const focus = () => { if (!disposed) { focused = true; port.setPanelFocus(panel); } };
  const blur = (event: Event) => {
    const target = (event as FocusEvent).relatedTarget;
    if (target && element.contains(target as Node)) return;
    if (focused) { focused = false; port.setPanelFocus(null); }
  };
  element.addEventListener("focusin", focus); element.addEventListener("focusout", blur);
  const receiptText = (receipt: FactoryUiReceipt): string => receipt.status === "Committed" ? "Action confirmed" :
    receipt.status === "RecoveryHold" ? "Recovery required" : `Action rejected. ${factoryReason(receipt.reason)}`;
  const settle = (receipt: FactoryUiReceipt) => {
    if (disposed || !pending || receipt.commandId !== pending.commandId || receipt.requestCanonicalJson !== canonicalJson(pending)) return;
    pending = null; check.hidden = true; status.textContent = receiptText(receipt); render(view);
  };
  const check = uiButton(doc, "Check response", () => {
    if (!pending) return;
    const receipt = port.readReceipt(pending.commandId); if (receipt) settle(receipt);
  });
  check.hidden = true;
  const heading = uiText(doc, "h2", title); heading.className = "factory-panel-title"; heading.hidden = true;
  const footer = doc.createElement("footer"); footer.className = "factory-panel-receipt"; footer.append(status, check);
  element.append(heading, content, footer);
  const accept = (next: FactoryUiReadModel) => {
    if (disposed || next.sessionId !== sessionId || next.epoch !== epoch || next.publicationRevision < view.publicationRevision) return;
    view = next; element.dataset.publicationRevision = String(view.publicationRevision);
    if (pending) { const receipt = port.readReceipt(pending.commandId); if (receipt) settle(receipt); }
    render(view); check.hidden = pending === null;
  };
  const unsubscribe = port.subscribe(accept);
  const submit = (intent: FactoryUiIntent) => {
    if (disposed || pending) return;
    const current = port.read();
    if (current.sessionId !== sessionId || current.epoch !== epoch || current.publicationRevision < view.publicationRevision) {
      status.textContent = "View expired. Reopen the panel."; return;
    }
    accept(current);
    if (view.state !== "Ready") { status.textContent = factoryReason(view.state); return; }
    focus();
    // Intent identity only: secure UUIDs avoid collisions across ports/remounts/recovery.
    // The raw Native session UUID remains its own unchanged binding field.
    pending = canonicalizeJsonValue({ ...intent, version: "fp06-ui-command-v1", commandId: `ui_${panel}_${crypto.randomUUID().replace(/-/g, "")}`,
      sessionId: view.sessionId, epoch: view.epoch, expected: { ...view.binding } }) as unknown as FactoryUiCommand;
    const command = pending;
    status.textContent = "Response pending"; check.hidden = false; render(view);
    try {
      void port.submit(command).then(result => {
        if (disposed || pending?.commandId !== command.commandId) return;
        accept(port.read()); settle(result.receipt); check.hidden = pending !== null;
      }).catch(() => {
        if (disposed || pending?.commandId !== command.commandId) return;
        status.textContent = "Response unknown. Check response.";
      });
    } catch { status.textContent = "Response unknown. Check response."; }
  };
  return {
    element, content, submit,
    get view() { return view; }, get busy() { return pending !== null || view.state !== "Ready"; },
    start(renderer: (view: FactoryUiReadModel) => void) { render = renderer; accept(view); },
    dispose() {
      if (disposed) return; disposed = true; unsubscribe();
      element.removeEventListener("focusin", focus); element.removeEventListener("focusout", blur);
      if (focused) port.setPanelFocus(null); element.remove();
    },
  };
};

const roles: Record<FactoryUiReadModel["inventory"][number]["role"], string> = {
  cargo: "Wreck cargo", carrier: "Transport", depot: "Storage", installed: "Installed", input: "Input",
  output: "Products", offcut: "Offcuts", wip: "Work in progress", belt: "Conveyor",
};

const containerName = (view: FactoryUiReadModel, id: string): string => {
  const container = view.inventory.find(c => c.id === id)!;
  const machine = view.machines.find(m => [m.inputContainerId, m.outputContainerId, m.offcutContainerId, m.wipContainerId, m.installedContainerId].includes(id));
  const index = view.inventory.filter(c => c.role === container.role).findIndex(c => c.id === id) + 1;
  return `${roles[container.role]}${machine ? ` · ${englishFactoryText(machine.name)}` : ` ${index}`}`;
};
const containerAccessStatus = (view: FactoryUiReadModel, container: FactoryUiInventory, accessibleLabel: string): string =>
  container.role === "cargo" && !view.interaction.cargoOpened
    ? view.interaction.cargoAccessible ? "Closed · open cargo first" : "Closed · out of reach"
    : container.accessible ? accessibleLabel : "Out of reach";
const exactQuantity = (text: string, basis: "mg" | "mm" | "piece"): number | null => {
  const digits = basis === "mg" ? 6 : basis === "mm" ? 3 : 0;
  const match = /^(\d+)(?:[,.](\d+))?$/.exec(text.trim());
  if (!match || (match[2]?.length ?? 0) > digits) return null;
  const units = BigInt(match[1]!) * 10n ** BigInt(digits) + BigInt((match[2] ?? "").padEnd(digits, "0") || "0");
  return units > 0n && units <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(units) : null;
};
const syncOptions = (doc: Document, select: HTMLSelectElement, options: readonly { value: string; label: string }[]) => {
  const signature = JSON.stringify(options);
  if (select.dataset.options === signature) return;
  const old = select.value; select.replaceChildren();
  for (const choice of options) { const option = doc.createElement("option"); option.value = choice.value; option.textContent = choice.label; select.append(option); }
  select.value = options.some(o => o.value === old) ? old : options[0]?.value ?? ""; select.dataset.options = signature;
};

const pickupItemId = (profileId: string): string => {
  const ids: Readonly<Record<string, string>> = { "B07-BOM": "fp02.chassis.former", "C27-PACK": "fp02.chassis.former", "B06-BOM": "fp02.chassis.cutter", "C26-PACK": "fp02.chassis.cutter", "BATTERY-PACK": "fp02.device.battery_4kwh", "BENCH-PACK": "fp02.device.field_workbench", "BIN-PACK": "fp02.device.material_container", RAW8: "fp02.bulk.steel_known", BELT4: "fp02.comp.belt_module", BRACE: "fp02.comp.small_brace" };
  return Object.hasOwn(ids, profileId) ? ids[profileId]! : profileId.startsWith("CABLE") ? "fp02.comp.field_cable" : "unknown_package";
};

export const mountFactoryCargoPanel = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "cargo", "Cargo & storage");
  const inventory = doc.createElement("div"), controls = doc.createElement("div");
  panel.content.className += " factory-cargo-content";
  inventory.className = "factory-cargo-lots"; inventory.hidden = true; controls.className = "factory-cargo-handling";
  inventory.setAttribute("role", "region"); inventory.setAttribute("aria-label", "Material inventory"); inventory.tabIndex = 0;
  inventory.style.cssText = "max-height:min(32vh,20rem);overflow-y:auto;overscroll-behavior:contain";
  const open = uiButton(doc, "Open cargo", () => { if (panel.view.interaction.openCargo.enabled) panel.submit({ kind: "open-cargo" }); });
  const handling = uiText(doc, "p", "");
  const deposit = uiButton(doc, "Set down here", () => {
    const h = panel.view.interaction.handling;
    if (h && panel.view.interaction.deposit.enabled) panel.submit({ kind: "deposit", handling: { id: h.id, revision: h.revision }, target: { kind: "ground" } });
  });
  const back = uiButton(doc, "Return to cargo", () => {
    const h = panel.view.interaction.handling, target = panel.view.inventory.find(c => c.role === "cargo" && c.accessible);
    if (h && target && panel.view.interaction.returnCargo.enabled) panel.submit({ kind: "return", handling: { id: h.id, revision: h.revision }, target: { id: target.id, revision: target.revision } });
  });
  controls.append(handling, deposit, back);
  const overview = doc.createElement("div"); overview.className = "factory-cargo-materials";
  let materialsExpanded = false;
  const revealMaterials = uiButton(doc, "View materials", () => { materialsExpanded = !materialsExpanded; overview.hidden = !materialsExpanded; revealMaterials.setAttribute("aria-expanded", String(materialsExpanded)); updateTransfer(); });
  revealMaterials.className = "factory-cargo-reveal"; revealMaterials.setAttribute("aria-expanded", "false");
  const packages = doc.createElement("section"); packages.className = "factory-cargo-packages";
  const packageSelect = doc.createElement("select"); packageSelect.setAttribute("aria-label", "Transport package");
  const packageMass = uiText(doc, "p", ""), packageActions = doc.createElement("div"); packageActions.className = "factory-cargo-actions";
  const packageIcon = doc.createElement("div"); packageIcon.className = "factory-package-identity";
  const packageChoices = doc.createElement("div"); packageChoices.className = "factory-package-choices";
  const packageSource = uiText(doc, "p", ""); packageSource.className = "factory-package-source";
  const packageChoiceButtons = new Map<string, HTMLButtonElement>();
  const packageOptions = doc.createElement("details"), optionsTitle = uiText(doc, "summary", "More transport packages"); packageOptions.append(optionsTitle, packageSelect);
  packages.append(packageSource, packageChoices, packageIcon, packageMass, packageOptions);
  packageActions.append(open);
  const materialRows = new Map<string, { element: HTMLElement; title: HTMLElement; summary: HTMLElement; choices: Map<string, HTMLElement> }>();
  const source = doc.createElement("select"), target = doc.createElement("select"), amount = doc.createElement("input");
  source.hidden = true;
  source.setAttribute("aria-label", "Transfer source"); target.setAttribute("aria-label", "Transfer destination"); amount.setAttribute("aria-label", "Transfer quantity");
  amount.type = "text"; amount.inputMode = "decimal"; amount.value = "1";
  const amountLabel = uiText(doc, "span", "Quantity");
  const selection = () => {
    for (const container of panel.view.inventory) for (const stack of container.contents) {
      if (JSON.stringify([container.id, stack.stackId]) === source.value && container.accessible && ["cargo", "depot", "input", "output", "offcut"].includes(container.role)) return { container, stack };
    }
    return null;
  };
  const transfer = uiButton(doc, "Transfer", () => {
    const selected = selection(), destination = panel.view.inventory.find(c => c.id === target.value && c.accessible);
    const units = selected && exactQuantity(amount.value, selected.stack.quantityBasis);
    if (selected && destination && destination.id !== selected.container.id && units && units <= selected.stack.quantityUnits) panel.submit({ kind: "transfer",
      source: { containerId: selected.container.id, containerRevision: selected.container.revision, stackId: selected.stack.stackId, quantityUnits: units }, target: { id: destination.id, revision: destination.revision } });
  });
  const transferForm = doc.createElement("div"); transferForm.className = "factory-cargo-detail";
  const materialDetail = doc.createElement("section"); materialDetail.className = "factory-cargo-selection";
  materialDetail.tabIndex = -1; materialDetail.setAttribute("role", "region"); materialDetail.setAttribute("aria-label", "Transfer material");
  let intentionalSource: string | null = null;
  const selectedName = uiText(doc, "h3", "Choose material"), selectedQuantity = uiText(doc, "p", ""), lotQuantity = uiText(doc, "small", "");
  const sourceToggle = uiButton(doc, "Choose individual lot", () => {
    if (panel.busy || !selection()) return;
    intentionalSource = source.value; source.hidden = !source.hidden;
    sourceToggle.setAttribute("aria-expanded", String(!source.hidden)); updateTransfer();
    if (!source.hidden) source.focus();
  });
  sourceToggle.setAttribute("aria-expanded", "false");
  const allLots = uiButton(doc, "Inspect all lots", () => { inventory.hidden = !inventory.hidden; allLots.setAttribute("aria-expanded", String(!inventory.hidden)); });
  allLots.className = "factory-cargo-all-lots"; allLots.setAttribute("aria-expanded", "false");
  const fields = doc.createElement("div"); fields.className = "factory-cargo-transfer"; fields.append(amountLabel, amount, target, transfer);
  materialDetail.append(selectedName, selectedQuantity, lotQuantity, fields, source);
  transferForm.append(packages, sourceToggle, materialDetail, allLots);
  panel.content.append(controls, transferForm, revealMaterials, overview, inventory, packageActions);
  const rows = new Map<string, { row: HTMLElement; title: HTMLElement; summary: HTMLElement; stacks: HTMLElement; pickups: Map<string, HTMLButtonElement> }>();
  const updateTransfer = () => {
    const selected = selection();
    if (!selected || intentionalSource !== source.value) intentionalSource = null;
    materialDetail.hidden = intentionalSource === null;
    syncOptions(doc, target, [{ value: "", label: "Choose destination" }, ...panel.view.inventory.filter(c => c.accessible && c.id !== selected?.container.id && ["cargo", "depot", "input", "output", "offcut"].includes(c.role)).map(c => ({ value: c.id, label: containerName(panel.view, c.id) }))]);
    amountLabel.textContent = `Quantity in ${selected?.stack.quantityBasis === "mg" ? "kg" : selected?.stack.quantityBasis === "mm" ? "m" : "items"}`;
    const units = selected && exactQuantity(amount.value, selected.stack.quantityBasis);
    transfer.disabled = panel.busy || !selected || !units || units > selected.stack.quantityUnits || !target.value;
    source.disabled = panel.busy; target.disabled = panel.busy; amount.disabled = panel.busy;
    selectedName.textContent = selected ? englishFactoryText(selected.stack.name) : "Choose material";
    const group = selected && groupFactoryItems(selected.container, panel.view.binding.catalogDigest).find(g => g.stacks.some(s => s.stackId === selected.stack.stackId));
    selectedQuantity.textContent = group ? `${formatQuantity(group.quantityUnits, group.quantityBasis)} · ${containerName(panel.view, selected!.container.id)}` : "Choose an accessible material lot.";
    lotQuantity.textContent = selected ? `Selected lot: ${formatQuantity(selected.stack.quantityUnits, selected.stack.quantityBasis)}` : "";
    sourceToggle.hidden = !selected || overview.hidden; sourceToggle.disabled = panel.busy;
    allLots.hidden = overview.hidden;
    if (materialDetail.hidden) { source.hidden = true; sourceToggle.setAttribute("aria-expanded", "false"); }
    for (const row of materialRows.values()) for (const [key, choice] of row.choices) if (choice.tagName === "BUTTON") choice.setAttribute("aria-pressed", String(!materialDetail.hidden && key === group?.key));
  };
  source.addEventListener("change", () => { if (!panel.busy && selection()) intentionalSource = source.value; updateTransfer(); });
  target.addEventListener("change", updateTransfer); amount.addEventListener("input", updateTransfer);
  const updatePackage = () => {
    let current: FactoryUiInventory["pickupProfiles"][number] | undefined, owner: FactoryUiInventory | undefined;
    for (const container of panel.view.inventory) for (const profile of container.pickupProfiles) {
      const match = JSON.stringify([container.id, profile.profileId]) === packageSelect.value;
      const button = rows.get(container.id)?.pickups.get(profile.profileId);
      if (button) button.hidden = !match || (container.role === "cargo" && !panel.view.interaction.cargoOpened);
      if (match) { current = profile; owner = container; }
    }
    packageSelect.disabled = panel.busy;
    for (const [id, choice] of packageChoiceButtons) { choice.disabled = panel.busy; choice.setAttribute("aria-pressed", String(id === packageSelect.value)); }
    let mass = 0n, confirmed = Boolean(current);
    for (const lot of current?.sourceLots ?? []) {
      const container = panel.view.inventory.find(c => c.id === lot.containerId && c.revision === lot.containerRevision), stack = container?.contents.find(s => s.stackId === lot.stackId);
      if (!stack || !Number.isSafeInteger(stack.massMg) || !Number.isSafeInteger(lot.quantityUnits) || stack.quantityUnits <= 0 || lot.quantityUnits <= 0 || lot.quantityUnits > stack.quantityUnits) { confirmed = false; break; }
      const numerator = BigInt(stack.massMg) * BigInt(lot.quantityUnits), denominator = BigInt(stack.quantityUnits);
      if (numerator % denominator) { confirmed = false; break; } mass += numerator / denominator;
    }
    packageMass.textContent = confirmed && mass <= BigInt(Number.MAX_SAFE_INTEGER) ? `${formatQuantity(Number(mass), "mg")} · ${owner ? containerName(panel.view, owner.id) : ""}` : "No confirmed transport package available.";
    if (current && packageIcon.dataset.profile !== current.profileId) {
      const itemId = pickupItemId(current.profileId);
      packageIcon.replaceChildren(factoryItemIcon(doc, itemId, factoryProfileLabel(current.profileId, current.name)), uiText(doc, "strong", factoryProfileLabel(current.profileId, current.name)));
      packageIcon.dataset.profile = current.profileId;
    }
    packages.hidden = packageActions.hidden = !current || panel.view.interaction.handling !== null;
  };
  packageSelect.addEventListener("change", updatePackage);
  panel.start(view => {
    for (const [id, row] of rows) if (!view.inventory.some(c => c.id === id)) { for (const pickup of row.pickups.values()) pickup.remove(); row.row.remove(); rows.delete(id); }
    for (const container of view.inventory) {
      let row = rows.get(container.id);
      if (!row) { const element = doc.createElement("div"), title = uiText(doc, "h3", ""), summary = uiText(doc, "p", ""), stacks = doc.createElement("div");
        element.append(title, summary, stacks); inventory.append(element); row = { row: element, title, summary, stacks, pickups: new Map() }; rows.set(container.id, row); }
      row.title.textContent = containerName(view, container.id);
      row.summary.textContent = `${formatQuantity(container.massMg, "mg")} / ${formatQuantity(container.capacityMassMg, "mg")} · ${containerAccessStatus(view, container, "Accessible")}`;
      const content = container.contents.map(stack => `${englishFactoryText(stack.name)}: ${formatQuantity(stack.quantityUnits, stack.quantityBasis)}${stack.quantityBasis === "mg" ? "" : ` · ${formatQuantity(stack.massMg, "mg")}`}${stack.freshProduction ? " · Freshly produced" : ""}`);
      if (row.stacks.dataset.contents !== JSON.stringify(content)) { row.stacks.replaceChildren(...content.map(t => uiText(doc, "p", t))); row.stacks.dataset.contents = JSON.stringify(content); }
      if (["cargo", "carrier", "depot", "input", "output", "offcut"].includes(container.role) && container.contents.length) {
        let materialRow = materialRows.get(container.id);
        if (!materialRow) { const element = doc.createElement("section"), title = uiText(doc, "h3", ""), summary = uiText(doc, "small", ""); element.append(title, summary); overview.append(element); materialRow = { element, title, summary, choices: new Map() }; materialRows.set(container.id, materialRow); }
        materialRow.title.textContent = containerName(view, container.id); materialRow.summary.textContent = `${container.role === "cargo" && !view.interaction.cargoOpened ? "" : formatQuantity(container.massMg, "mg") + " · "}${containerAccessStatus(view, container, "accessible")}`;
        const groups = groupFactoryItems(container, view.binding.catalogDigest);
        for (const [key, choice] of materialRow.choices) if (!groups.some(g => g.key === key)) { choice.remove(); materialRow.choices.delete(key); }
        for (const group of groups) {
          let choice = materialRow.choices.get(group.key);
          if (!choice) {
            choice = container.role === "carrier" ? doc.createElement("div") : uiButton(doc, "", () => { const owner = panel.view.inventory.find(c => c.id === container.id), current = owner && groupFactoryItems(owner, panel.view.binding.catalogDigest).find(g => g.key === group.key);
              if (!panel.busy && owner?.accessible && current?.stacks[0]) {
                source.value = JSON.stringify([owner.id, current.stacks[0].stackId]); intentionalSource = source.value;
                updateTransfer(); if (!materialDetail.hidden) materialDetail.focus();
              } });
            choice.className = "factory-material-row"; choice.setAttribute("aria-label", container.role === "carrier" ? `${group.name} · carried` : `${group.name} select`);
            materialRow.element.append(choice); materialRow.choices.set(group.key, choice);
          }
          const signature = JSON.stringify([group.name, group.quantityUnits, group.massMg, group.quantityBasis, group.freshProduction]);
          if (choice.dataset.display !== signature) {
            const text = doc.createElement("span"), title = uiText(doc, "strong", group.name), quantity = uiText(doc, "small", `${formatQuantity(group.quantityUnits, group.quantityBasis)}${group.quantityBasis === "mg" ? "" : ` · ${formatQuantity(group.massMg, "mg")}`}${group.freshProduction ? " · fresh" : ""}`);
            text.append(title, quantity); choice.replaceChildren(factoryItemIcon(doc, group.itemId, group.name), text); choice.dataset.display = signature;
          }
          choice.dataset.source = JSON.stringify([container.id, group.stacks[0]!.stackId]); if (choice.tagName === "BUTTON") (choice as HTMLButtonElement).disabled = panel.busy || !container.accessible;
        }
      }
      for (const [id, button] of row.pickups) if (!container.pickupProfiles.some(p => p.profileId === id)) { button.remove(); row.pickups.delete(id); }
      for (const profile of container.pickupProfiles) {
        let pickup = row.pickups.get(profile.profileId);
        if (!pickup) { pickup = uiButton(doc, `Pick up: ${factoryProfileLabel(profile.profileId, profile.name)}`, () => {
          const owner = panel.view.inventory.find(c => c.id === container.id), current = owner?.pickupProfiles.find(p => p.profileId === profile.profileId);
          if (owner?.accessible && current?.capability.enabled) panel.submit({ kind: "pickup", profileId: current.profileId, sourceLots: current.sourceLots.map(l => ({ ...l })) });
        }); row.pickups.set(profile.profileId, pickup); packageActions.append(pickup); }
        pickup.textContent = `Pick up: ${factoryProfileLabel(profile.profileId, profile.name)}`;
        pickup.disabled = panel.busy || !container.accessible || !profile.capability.enabled;
        pickup.title = panel.busy ? "Please wait" : container.role === "cargo" && !view.interaction.cargoOpened
          ? view.interaction.cargoAccessible ? "Open cargo first" : "Out of reach" : factoryReason(profile.capability.reason);
      }
    }
    open.disabled = panel.busy || !view.interaction.openCargo.enabled;
    open.hidden = view.interaction.cargoOpened;
    handling.textContent = view.interaction.handling ? `Cargo load: ${formatQuantity(view.interaction.handling.massMg, "mg")}` : "";
    deposit.hidden = back.hidden = !view.interaction.handling;
    deposit.disabled = panel.busy || !view.interaction.deposit.enabled;
    back.disabled = panel.busy || !view.interaction.returnCargo.enabled || !view.inventory.some(c => c.role === "cargo" && c.accessible);
    syncOptions(doc, source, view.inventory.filter(c => c.accessible && ["cargo", "depot", "input", "output", "offcut"].includes(c.role)).flatMap(c => c.contents.filter(s => s.quantityUnits > 0).map(s => ({ value: JSON.stringify([c.id, s.stackId]), label: `${containerName(view, c.id)} · ${englishFactoryText(s.name)}` }))));
    for (const [id, row] of materialRows) if (!view.inventory.some(c => c.id === id && c.contents.length)) { row.element.remove(); materialRows.delete(id); }
    const profiles = view.inventory.flatMap(c => c.pickupProfiles.map(p => ({ value: JSON.stringify([c.id, p.profileId]), label: `${factoryProfileLabel(p.profileId, p.name)} · ${containerName(view, c.id)}`, profile: p.profileId })));
    const priority = (id: string) => id === "B07-BOM" && !view.machines.some(m => m.definitionId === "B07" && m.installed) ? 0 : id === "B06-BOM" && !view.machines.some(m => m.definitionId === "B06" && m.installed) ? 1 : 2;
    profiles.sort((a, b) => priority(a.profile) - priority(b.profile));
    syncOptions(doc, packageSelect, profiles);
    const preferred = ["B07-BOM", "B06-BOM", "BATTERY-PACK", "CABLE40"];
    const compactProfiles = [...profiles].sort((a, b) => (preferred.includes(a.profile) ? preferred.indexOf(a.profile) : 100) - (preferred.includes(b.profile) ? preferred.indexOf(b.profile) : 100)).slice(0, 4);
    for (const [id, choice] of packageChoiceButtons) if (!compactProfiles.some(p => p.value === id)) { choice.remove(); packageChoiceButtons.delete(id); }
    for (const profile of compactProfiles) {
      let choice = packageChoiceButtons.get(profile.value);
      if (!choice) { choice = uiButton(doc, "", () => { if (!panel.busy) { packageSelect.value = profile.value; updatePackage(); } }); packageChoices.append(choice); packageChoiceButtons.set(profile.value, choice); }
      const owner = view.inventory.find(c => c.pickupProfiles.some(p => JSON.stringify([c.id, p.profileId]) === profile.value));
      const pickup = owner?.pickupProfiles.find(p => p.profileId === profile.profile);
      let mass = 0n, valid = Boolean(pickup);
      for (const lot of pickup?.sourceLots ?? []) {
        const c = view.inventory.find(c => c.id === lot.containerId && c.revision === lot.containerRevision), st = c?.contents.find(st => st.stackId === lot.stackId);
        if (!st || !Number.isSafeInteger(st.massMg) || !Number.isSafeInteger(lot.quantityUnits) || lot.quantityUnits <= 0 || lot.quantityUnits > st.quantityUnits || st.quantityUnits <= 0) { valid = false; break; }
        const numerator = BigInt(st.massMg) * BigInt(lot.quantityUnits), denominator = BigInt(st.quantityUnits);
        if (numerator % denominator) { valid = false; break; } mass += numerator / denominator;
      }
      const name = factoryProfileLabel(profile.profile, pickup?.name ?? "Transport package");
      choice.setAttribute("aria-label", `${name} select`); choice.className = "factory-package-choice";
      const text = valid && mass <= BigInt(Number.MAX_SAFE_INTEGER) ? formatQuantity(Number(mass), "mg") : "Unconfirmed";
      if (choice.dataset.summary !== name + text) { choice.replaceChildren(factoryItemIcon(doc, pickupItemId(profile.profile), name), uiText(doc, "span", name), uiText(doc, "strong", text)); choice.dataset.summary = name + text; }
    }
    packageSource.textContent = view.inventory.filter(c => c.role === "cargo").map(c => `${containerName(view, c.id)} · ${formatQuantity(c.massMg, "mg")} ${containerAccessStatus(view, c, "available")}`).join(" · ");
    overview.hidden = !materialsExpanded && profiles.some(p => p.profile === "B07-BOM" || p.profile === "B06-BOM");
    revealMaterials.hidden = !overview.hidden && !materialsExpanded;
    updateTransfer();
    updatePackage();
  });
  return panel;
};
