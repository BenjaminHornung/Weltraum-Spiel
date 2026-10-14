import type { FactoryUiPort } from "../session/hostPort";
import { createFactoryPanel, factoryReason, uiButton, uiText, type FactoryPanel } from "./cargoPanel";

export const mountFactoryPowerPanel = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "power", "Stromversorgung");
  panel.start(view => {
    const power = view.power;
    panel.content.replaceChildren(uiText(doc, "p", factoryReason(power.status)),
      uiText(doc, "p", power.allocationConfirmed===false?"Leistung wird im nächsten bestätigten Fabrikschritt ermittelt.":`Erzeugung: ${power.generationWatts} W · Zuweisung: ${power.allocatedWatts} W`),
      uiText(doc, "p", power.batteryEnergyJ === null ? "Batterie: Keine bestätigte Energiemenge" :
        `Batterie: ${power.batteryEnergyJ} J${power.batteryCapacityJ === null ? "" : ` / ${power.batteryCapacityJ} J`}`),
      uiText(doc, "p", power.reserveEnergyJ === null ? "Reserve: Keine bestätigte Energiemenge" : `Reserve: ${power.reserveEnergyJ} J`));
    for (const consumer of power.consumers) panel.content.append(uiText(doc, "p", `${consumer.name}: ${consumer.allocatedWatts} / ${consumer.requestedWatts} W${consumer.reason ? ` · ${factoryReason(consumer.reason)}` : ""}`));
    for(const device of power.devices??[]){
      const row=doc.createElement("div"),toggle=uiButton(doc,`${device.name} ${device.enabled?"ausschalten":"einschalten"}`,()=>{
        const current=panel.view.power.devices?.find(d=>d.id===device.id);
        if(current?.capability.enabled&&!panel.busy)panel.submit({kind:"set-enabled",machine:{id:current.id,revision:current.revision},enabled:!current.enabled});
      });
      toggle.disabled=panel.busy||!device.capability.enabled;row.append(uiText(doc,"p",`${device.name}: ${device.enabled?"eingeschaltet":"ausgeschaltet"}`),toggle);
      if(!device.capability.enabled&&device.capability.reason)row.append(uiText(doc,"p",device.capability.reason));panel.content.append(row);
    }
    panel.content.append(uiText(doc, "p", "Stromanschlüsse werden an den Anlagen verbunden."));
  });
  return panel;
};
