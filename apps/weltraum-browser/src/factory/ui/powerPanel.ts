import { englishFactoryText } from "./english";
import type { FactoryUiPort } from "../session/hostPort";
import { createFactoryPanel, factoryReason, uiButton, uiText, formatSeconds, type FactoryPanel } from "./cargoPanel";
import { createFp02CatalogInput, loadFactoryCatalog } from "../catalog/fp02Catalog";
import { factoryItemIcon } from "./itemVisuals";

const catalog = loadFactoryCatalog(createFp02CatalogInput());
const beltLineUnitLabels: Readonly<Record<string, string>> = Object.freeze({
  "fp02_cargo_c23_unit_1": "1", "fp02_cargo_c23_unit_2": "2",
});

export const mountFactoryPowerPanel = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "power", "Power supply");
  panel.content.className += " factory-power-content";
  const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 6 });
  const status = uiText(doc, "p", ""), prototypeNote = uiText(doc, "small", "Battery-powered prototype. Wind and solar have no confirmed environmental feed and currently supply no power."), totals = uiText(doc, "p", ""), battery = doc.createElement("div"), charge = uiText(doc, "strong", ""), capacity = uiText(doc, "small", "");
  status.className = "factory-power-state"; battery.className = "factory-power-battery";
  battery.append(factoryItemIcon(doc, "fp02.device.battery_4kwh", "Battery"), charge, capacity);
  const consumers = doc.createElement("div"), devices = doc.createElement("div"), empty = uiText(doc, "p", "Build a power source and a machine, then connect their ports using field cable.");
  panel.content.append(status, prototypeNote, totals, battery, consumers, devices, empty);
  const consumerRows = new Map<string, { element: HTMLElement; title: HTMLElement; nominal: HTMLElement; demand: HTMLElement; allocated: HTMLElement; reason: HTMLElement; work: HTMLElement }>();
  const deviceRows = new Map<string, { element: HTMLElement; state: HTMLElement; toggle: HTMLButtonElement; reason: HTMLElement }>();
  const connections = doc.createElement("section"); connections.className = "factory-power-connections";
  const connectionSelect = doc.createElement("select"); connectionSelect.setAttribute("aria-label", "Power connection");
  const cableNeeded = uiText(doc, "p", ""), cableStock = uiText(doc, "p", ""), connectionReason = uiText(doc, "small", "");
  const connect = uiButton(doc, "Confirm connection", () => {
    const current = panel.view.connections?.power.find(c => c.id === connectionSelect.value);
    if (!panel.busy && current?.capability.enabled && current.cableLot) panel.submit({ kind: "connect-power", sourcePortId: current.sourcePortId, targetPortId: current.targetPortId, cableLot: current.cableLot });
  });
  connections.append(uiText(doc, "h3", "Connect power"), connectionSelect, cableNeeded, cableStock, connectionReason, connect); panel.content.append(connections);
  const renderConnection = () => {
    const view = panel.view, options = view.connections?.power ?? [];
    connections.hidden = options.length === 0;
    const portName = (id: string) => view.machines.find(m => m.ports.some(p => p.id === id))?.name ?? view.power.devices?.find(d => id === `power_${d.id}`)?.name ?? "Port";
    const labels = options.map(c => ({ id: c.id, text: `${englishFactoryText(portName(c.sourcePortId))} → ${englishFactoryText(portName(c.targetPortId))} · ${number.format(c.lengthMm / 1000)} m` })), key = JSON.stringify(labels);
    if (connectionSelect.dataset.options !== key) {
      const old = connectionSelect.value; connectionSelect.replaceChildren();
      const blank = doc.createElement("option"); blank.value = ""; blank.textContent = "Choose connection"; connectionSelect.append(blank);
      for (const c of labels) { const option = doc.createElement("option"); option.value = c.id; option.textContent = c.text; connectionSelect.append(option); }
      connectionSelect.value = options.some(c => c.id === old) ? old : ""; connectionSelect.dataset.options = key;
    }
    const selected = options.find(c => c.id === connectionSelect.value);
    connectionSelect.disabled = panel.busy; connect.disabled = panel.busy || !selected?.capability.enabled || !selected.cableLot;
    cableNeeded.textContent = selected ? `Cable required ${number.format(selected.lengthMm / 1000)} m` : "Choose two existing ports.";
    let stock = 0;
    for (const container of view.inventory) if (container.accessible) for (const item of container.contents) if (item.itemId === "fp02.comp.field_cable" && item.quantityBasis === "mm") stock += item.quantityUnits;
    cableStock.textContent = Number.isSafeInteger(stock) ? `Field cable available ${number.format(stock / 1000)} m` : "Cable inventory not confirmed yet";
    connectionReason.textContent = (selected?.capability.reason ? englishFactoryText(selected.capability.reason) : null) ?? "Connection preview · material is charged on confirmation";
  };
  connectionSelect.addEventListener("change", renderConnection);
  panel.start(view => {
    renderConnection();
    const power = view.power, confirmed = power.allocationConfirmed !== false;
    status.textContent = confirmed ? factoryReason(power.status) : "Allocation pending · next confirmed factory step";
    totals.hidden = !confirmed; totals.textContent = confirmed ? `Generation ${number.format(power.generationWatts)} W · Allocated ${number.format(power.allocatedWatts)} W` : "";
    battery.hidden = power.batteryEnergyJ === null && power.batteryCapacityJ === null;
    charge.textContent = power.batteryEnergyJ === null ? "No confirmed battery charge" : `Charge ${number.format(power.batteryEnergyJ / 3_600_000)} kWh`;
    capacity.textContent = power.batteryCapacityJ === null ? "Capacity not confirmed yet" : `Capacity ${number.format(power.batteryCapacityJ / 3_600_000)} kWh`;
    battery.setAttribute("title", `Confirmed energy: ${power.batteryEnergyJ ?? "unknown"} J · Capacity: ${power.batteryCapacityJ ?? "unknown"} J · Reserve: ${power.reserveEnergyJ ?? "unknown"} J`);
    empty.hidden = Boolean(power.devices?.length || power.consumers.length);
    for (const [id, row] of consumerRows) if (!power.consumers.some(c => c.id === id)) { row.element.remove(); consumerRows.delete(id); }
    for (const consumer of power.consumers) {
      let row = consumerRows.get(consumer.id);
      if (!row) { const element = doc.createElement("section"), title = uiText(doc, "h3", ""), nominal = uiText(doc, "p", ""), demand = uiText(doc, "p", ""), allocated = uiText(doc, "strong", ""), reason = uiText(doc, "p", ""), work = uiText(doc, "small", "");
        element.className = "factory-power-consumer"; element.append(title, nominal, demand, allocated, reason, work); consumers.append(element);
        row = { element, title, nominal, demand, allocated, reason, work }; consumerRows.set(consumer.id, row);
      }
      const machine = view.machines.find(m => consumer.id === `consumer_${m.id}`);
      const ref = machine?.selectedRecipe;
      const recipe = view.binding.catalogDigest === catalog.catalogDigest && ref ? catalog.recipes.find(r => r.sourceId === ref.sourceId && r.version === ref.version && r.digest === ref.digest) : undefined;
      const process = recipe?.processes.find(p => p.availability === "first-dry-loop");
      const sourceName = machine?.name ?? consumer.name, beltUnit = Object.hasOwn(beltLineUnitLabels, sourceName) ? beltLineUnitLabels[sourceName]! : null;
      row.title.textContent = beltUnit === null ? englishFactoryText(sourceName) : `${englishFactoryText("Förderlinie")} · ${beltUnit}`;
      row.nominal.hidden = !process; row.nominal.textContent = process ? `Nominal demand ${number.format(process.powerWatts / 1000)} kW` : "";
      row.demand.textContent = `Current demand ${number.format(consumer.requestedWatts)} W`;
      row.allocated.textContent = confirmed ? `Allocated ${number.format(consumer.allocatedWatts)} W` : "Allocation pending";
      row.reason.textContent = consumer.reason ? factoryReason(consumer.reason) : ""; row.reason.hidden = !consumer.reason;
      row.work.hidden = !machine?.jobId;
      row.work.textContent = machine?.jobId ? `${["WAIT_POWER", "BLOCKED_OUTPUT"].includes(machine.status) ? "Progress retained · " : "Confirmed work · "}${formatSeconds(machine.confirmedWorkMs)} / ${formatSeconds(machine.requiredWorkMs ?? machine.confirmedWorkMs)} · Material is retained in the job` : "";
    }
    for (const [id, row] of deviceRows) if (!power.devices?.some(d => d.id === id)) { row.element.remove(); deviceRows.delete(id); }
    for (const device of power.devices ?? []) {
      let row = deviceRows.get(device.id);
      if (!row) { const element = doc.createElement("div"), state = uiText(doc, "p", ""), reason = uiText(doc, "small", "");
        element.className = "factory-power-device";
        const toggle = uiButton(doc, "", () => {
          const current = panel.view.power.devices?.find(d => d.id === device.id);
          if (current?.capability.enabled && !panel.busy) panel.submit({ kind: "set-enabled", machine: { id: current.id, revision: current.revision }, enabled: !current.enabled });
        });
        element.append(state, toggle, reason); devices.append(element); row = { element, state, toggle, reason }; deviceRows.set(device.id, row);
      }
      row.state.textContent = `${englishFactoryText(device.name)}: ${device.enabled ? "enabled" : "disabled"}`;
      row.toggle.textContent = `${englishFactoryText(device.name)} ${device.enabled ? "disable" : "enable"}`; row.toggle.disabled = panel.busy || !device.capability.enabled;
      row.reason.textContent = device.capability.reason ? englishFactoryText(device.capability.reason) : ""; row.reason.hidden = device.capability.enabled || !device.capability.reason;
    }
  });
  return panel;
};
