import type { FactoryUiPort } from "../session/hostPort";
import { createFactoryPanel, factoryReason, uiText, type FactoryPanel } from "./cargoPanel";

export const mountFactoryPowerPanel = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "power", "Stromversorgung");
  panel.start(view => {
    const power = view.power;
    panel.content.replaceChildren(uiText(doc, "p", factoryReason(power.status)),
      uiText(doc, "p", `Erzeugung: ${power.generationWatts} W · Zuweisung: ${power.allocatedWatts} W`),
      uiText(doc, "p", power.batteryEnergyJ === null ? "Batterie: Keine bestätigte Energiemenge" :
        `Batterie: ${power.batteryEnergyJ} J${power.batteryCapacityJ === null ? "" : ` / ${power.batteryCapacityJ} J`}`),
      uiText(doc, "p", power.reserveEnergyJ === null ? "Reserve: Keine bestätigte Energiemenge" : `Reserve: ${power.reserveEnergyJ} J`));
    for (const consumer of power.consumers) panel.content.append(uiText(doc, "p", `${consumer.name}: ${consumer.allocatedWatts} / ${consumer.requestedWatts} W${consumer.reason ? ` · ${factoryReason(consumer.reason)}` : ""}`));
    panel.content.append(uiText(doc, "p", "Stromanschlüsse werden an den Anlagen verbunden."));
  });
  return panel;
};
