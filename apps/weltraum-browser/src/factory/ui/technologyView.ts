import type { FactoryUiPort } from "../session/hostPort";
import { createFactoryPanel, uiButton, uiText, type FactoryPanel } from "./cargoPanel";

export const mountFactoryTechnologyView = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "technology", "Bau und Technik");
  let selected: string | null = null;
  const choices = doc.createElement("div"), details = doc.createElement("div");
  const buttons = new Map<string, HTMLButtonElement>();
  panel.content.append(choices, details);
  const render = () => {
    for (const [id, button] of buttons) if (!panel.view.technologies.some(t => t.id === id)) { button.remove(); buttons.delete(id); }
    details.replaceChildren();
    for (const technology of panel.view.technologies) {
      let button = buttons.get(technology.id);
      if (!button) {
        button = uiButton(doc, technology.name, () => { selected = technology.id; render(); });
        choices.append(button); buttons.set(technology.id, button);
      }
      button.textContent = technology.name;
      button.setAttribute("aria-pressed", String(selected === technology.id));
      if (selected === technology.id) {
        details.append(uiText(doc, "h3", technology.name), uiText(doc, "p", technology.status === "AVAILABLE" ? "Verfügbar" : technology.status === "PLANNED" ? "Geplant" : "Voraussetzungen fehlen"));
        for (const requirement of technology.requirements) details.append(uiText(doc, "p", requirement));
        details.append(uiText(doc, "p", technology.status === "PLANNED" ? "Für diesen Prototyp noch nicht verfügbar." : "Gebaut wird mit der Bauvorschau an einem geeigneten Standort."));
      }
    }
  };
  panel.start(render); return panel;
};
