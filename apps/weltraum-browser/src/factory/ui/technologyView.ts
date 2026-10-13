import { englishFactoryText } from "./english";
import type { FactoryUiPort } from "../session/hostPort";
import { createFactoryPanel, uiButton, uiText, type FactoryPanel } from "./cargoPanel";

export const mountFactoryTechnologyView = (port: FactoryUiPort, doc: Document = document): FactoryPanel => {
  const panel = createFactoryPanel(port, doc, "technology", "Construction & technology");
  let selected: string | null = null;
  const choices = doc.createElement("div"), details = doc.createElement("div");
  choices.className = "factory-technology-directory"; details.className = "factory-technology-detail";
  const buttons = new Map<string, HTMLButtonElement>();
  panel.content.append(choices, details);
  const render = () => {
    for (const [id, button] of buttons) if (!panel.view.technologies.some(t => t.id === id)) { button.remove(); buttons.delete(id); }
    details.replaceChildren();
    if (!panel.view.technologies.some(t => t.id === selected)) selected = panel.view.technologies.find(t => t.status === "AVAILABLE")?.id ?? panel.view.technologies[0]?.id ?? null;
    for (const technology of panel.view.technologies) {
      let button = buttons.get(technology.id);
      if (!button) {
        button = uiButton(doc, technology.name, () => { selected = technology.id; render(); });
        choices.append(button); buttons.set(technology.id, button);
      }
      button.textContent = englishFactoryText(technology.name);
      button.title = technology.status === "AVAILABLE" ? "Available" : technology.status === "PLANNED" ? "Later" : "Requirements missing";
      button.setAttribute("aria-pressed", String(selected === technology.id));
      if (selected === technology.id) {
        details.append(uiText(doc, "h3", technology.name), uiText(doc, "p", technology.status === "AVAILABLE" ? "Available" : technology.status === "PLANNED" ? "Planned" : "Requirements missing"));
        for (const requirement of technology.requirements) details.append(uiText(doc, "p", requirement));
        details.append(uiText(doc, "p", technology.status === "PLANNED" ? "Not available in this prototype yet." : "Build using a placement preview at a suitable location."));
      }
    }
  };
  panel.start(render); return panel;
};
