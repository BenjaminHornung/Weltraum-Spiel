import type { FactoryUiCapability, FactoryUiPort } from "../session/hostPort";
import { mountFactoryCargoPanel, uiButton, uiText } from "./cargoPanel";
import { mountFactoryMachinePanel } from "./machinePanel";
import { mountFactoryPowerPanel } from "./powerPanel";
import { mountFactoryTechnologyView } from "./technologyView";
import { mountFactoryLocalMap, type FactoryMapSnapshot } from "./localMap";
import { projectFactoryOnboarding, type FactoryOnboardingFacts } from "./onboarding";
import "./factoryShell.css";

export type FactoryShellSurface = "cargo" | "machine" | "power" | "technology" | "build" | "map" | "help" | "pause" | "start" | "settings";
export type FactoryShellCommandKind = "newSession" | "continue" | "play" | "pause" | "save" | "endSession" | "settings";
export interface FactoryShellBinding { readonly sessionId: string; readonly epoch: number }
export interface FactoryShellCommand extends FactoryShellBinding { readonly kind: FactoryShellCommandKind }
export interface FactoryShellView extends FactoryShellBinding {
  readonly publicationRevision: number;
  readonly phase: "start" | "playing" | "paused" | "hold";
  readonly statusText: string;
  /** In particular Continue means an admitted combined Factory save, never a legacy HVP save. */
  readonly capabilities: Readonly<Record<FactoryShellCommandKind, FactoryUiCapability>>;
  readonly hud: Readonly<{ interactionText: string; carrierMassMg: number | null; blockReason: string | null; warnings: readonly string[] }>;
  readonly onboarding: FactoryOnboardingFacts | null;
  readonly map: FactoryMapSnapshot | null;
}
/** Integrator-owned lifecycle, focus, source and confirmed facts. No World handle. */
export interface FactoryShellPort {
  read(): FactoryShellView;
  subscribe(listener: (view: FactoryShellView) => void): () => void;
  dispatch(command: FactoryShellCommand): Promise<void>;
  /** Must immediately clear held inputs/release pointer, then own confirmed pause.
   * A stale binding must never unhold a replacement session. */
  setSurface(surface: FactoryShellSurface | null, binding: FactoryShellBinding): void;
}
export interface FactoryShellOptions {
  readonly port: FactoryShellPort;
  readonly uiPort: FactoryUiPort;
  /** Existing once-created BuildTool controls; ownership stays with Entry. */
  readonly buildPanel: HTMLElement;
  readonly connectionsPanel?: HTMLElement;
  readonly doc?: Document;
  /** Escape order: modal close, existing ghost cancel, then real pause command. */
  readonly cancelBuildPreview?: () => boolean;
}

const titles: Record<FactoryShellSurface, string> = { cargo: "Fracht und Transport", machine: "Maschinen", power: "Energie und Verbindungen",
  technology: "Bau und Technik", build: "Bauen", map: "Lokale Karte", help: "Steuerung und Hilfe", pause: "Pause und Sitzung", start: "Hestia · Erste Werkstatt", settings: "Einstellungen" };

export const mountFactoryShell = (options: FactoryShellOptions) => {
  const doc = options.doc ?? document, port = options.port;
  let view = port.read(), disposed = false, surface: FactoryShellSurface | null = null, pending: FactoryShellCommandKind | null = null;
  const binding: FactoryShellBinding = Object.freeze({ sessionId: view.sessionId, epoch: view.epoch });
  const current = (): boolean => { const next = port.read(), ui = options.uiPort.read(); return !disposed &&
    next.sessionId === binding.sessionId && next.epoch === binding.epoch && next.publicationRevision >= view.publicationRevision && ui.sessionId === binding.sessionId && ui.epoch === binding.epoch; };
  // Keep each canonical controller's request/receipt lifetime. Its blur cannot
  // release the shell modal; final stale disposal cannot unhold a new epoch.
  const uiPort: FactoryUiPort = { read: () => options.uiPort.read(), subscribe: listener => options.uiPort.subscribe(listener),
    submit: command => options.uiPort.submit(command), readReceipt: id => options.uiPort.readReceipt(id),
    setPanelFocus: panel => { if (current() && (panel !== null || surface === null)) options.uiPort.setPanelFocus(panel); } };
  const panels = { cargo: mountFactoryCargoPanel(uiPort, doc), machine: mountFactoryMachinePanel(uiPort, doc),
    power: mountFactoryPowerPanel(uiPort, doc), technology: mountFactoryTechnologyView(uiPort, doc) };
  const map = mountFactoryLocalMap(doc);
  const element = doc.createElement("section"); element.id = "factory-shell"; element.className = "factory-shell";
  const hud = doc.createElement("header"); hud.className = "factory-shell-hud";
  const goal = uiText(doc, "strong", ""), hint = uiText(doc, "p", ""), state = uiText(doc, "span", "");
  const objective = doc.createElement("div"); objective.className = "factory-shell-objective";
  const nextAction = uiButton(doc, "Aufgabe öffnen", () => { const next = projectFactoryOnboarding(view.onboarding).actionSurface; if (next) openSurface(next); });
  objective.append(uiText(doc, "small", "Erste Werkstatt"), goal, hint, nextAction);
  const handling = uiText(doc, "p", ""), warning = uiText(doc, "p", ""); warning.setAttribute("role", "status");
  const interaction = uiText(doc, "p", ""); interaction.className = "factory-shell-interaction"; interaction.setAttribute("role", "status");
  const dock = doc.createElement("nav"); dock.className = "factory-shell-dock"; dock.setAttribute("aria-label", "Werkstattoberflächen");
  const tabs = new Map<FactoryShellSurface, HTMLButtonElement>();
  for (const [name, label] of [["cargo", "Fracht"], ["build", "Bauen"], ["machine", "Maschinen"], ["power", "Energie"], ["technology", "Technik"], ["map", "Karte"], ["help", "Hilfe"], ["pause", "Pause"]] as const) {
    const tab = uiButton(doc, label, () => { if (name === "pause") command("pause"); else openSurface(name); });
    tab.setAttribute("aria-controls", `factory-shell-${name}`); dock.append(tab); tabs.set(name, tab);
  }
  const modal = doc.createElement("section"); modal.className = "factory-shell-modal"; modal.tabIndex = -1;
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-labelledby", "factory-shell-modal-title");
  const modalHeader = doc.createElement("header"); modalHeader.className = "factory-shell-modal-header";
  const modalTitle = uiText(doc, "h1", ""); modalTitle.id = "factory-shell-modal-title";
  const close = uiButton(doc, "Schließen", () => closeSurface()); modalHeader.append(modalTitle, close);
  const body = doc.createElement("div"); body.className = "factory-shell-modal-body";
  const commandStatus = uiText(doc, "p", ""); commandStatus.setAttribute("role", "status"); commandStatus.setAttribute("aria-live", "polite");
  const surfaces = new Map<FactoryShellSurface, HTMLElement>();
  for (const [name, panel] of Object.entries(panels)) surfaces.set(name as FactoryShellSurface, panel.element);
  const power = doc.createElement("div"); power.append(panels.power.element);
  if (options.connectionsPanel) power.append(options.connectionsPanel);
  surfaces.set("power", power); surfaces.set("build", options.buildPanel); surfaces.set("map", map.element);
  const help = doc.createElement("section");
  help.append(uiText(doc, "h2", "Deine erste Werkstatt"), uiText(doc, "p", "Das Schiff ist flugunfähig. Berge nur benötigte Fracht, errichte die Maschinen und fertige aus 16 kg Stahl eine tragende Stütze."),
    uiText(doc, "p", "Spielen: bewusst anklicken, um Mausblick und Bewegung zu aktivieren. WASD: gehen · Shift: sprinten · Leertaste: springen · V: Ego/3. Person · F: vorhandener Körperstoß."),
    uiText(doc, "p", "B: Bauen · M: Karte · Escape: offene Oberfläche schließen, sonst Bauvorschau verwerfen, sonst pausieren. Tab navigiert durch die Bedienelemente."),
    uiText(doc, "p", "Bauvorschau: Pfeile versetzen um 25 cm · R dreht um 90° · Bestätigen bezahlt die zulässige Installation. Abbrechen verbraucht kein Material."),
    uiText(doc, "p", "Schwere Chassis zuerst transportieren. Erst sicher absetzen und selbst die künftige Maschinenfläche verlassen, dann bauen."),
    uiText(doc, "p", "Ein offenes Panel hält Gameplayeingaben zurück. Schließen setzt keine gehaltenen Tasten fort. Nach Browserfokusverlust ausdrücklich wieder Spielen wählen."),
    uiText(doc, "p", "E bleibt ohne neue Interaktionsbelegung, damit die vorhandene Inspektionskamera nicht zugleich einen anderen Befehl erhält. 1/2/3 bleiben vorhandene HVP-Werkzeugtasten."));
  surfaces.set("help", help);
  const lifecycleButtons: { kind: FactoryShellCommandKind; button: HTMLButtonElement; reason: HTMLElement }[] = [];
  const addCommand = (parent: HTMLElement, kind: FactoryShellCommandKind, label: string) => {
    const row = doc.createElement("div"); row.className = "factory-shell-command";
    const button = uiButton(doc, label, () => command(kind)), reason = uiText(doc, "small", "");
    reason.id = `factory-shell-reason-${kind}-${lifecycleButtons.length}`; button.setAttribute("aria-describedby", reason.id);
    row.append(button, reason); parent.append(row); lifecycleButtons.push({ kind, button, reason }); return button;
  };
  const start = doc.createElement("section"); start.append(uiText(doc, "p", "Ein havariertes Schiff, nutzbare endliche Fracht und eine erste kleine Werkstatt. Baue eine echte tragende Stütze."));
  addCommand(start, "newSession", "Neues Spiel"); addCommand(start, "continue", "Fortsetzen"); addCommand(start, "settings", "Einstellungen");
  start.append(uiButton(doc, "Steuerung ansehen", () => openSurface("help")), uiText(doc, "p", "Kleiner Factory-Prototyp: keine flugfähige Reparatur, globale Erkundung oder spätere Stadt. Nicht verfügbare Funktionen sind mit Grund gesperrt.")); surfaces.set("start", start);
  const pause = doc.createElement("section"); pause.append(uiText(doc, "p", "Der angezeigte Status folgt der bestätigten Sitzung. Produktion erhält nur bestätigte Simulationszeit."), state);
  addCommand(pause, "play", "Spielen"); addCommand(pause, "save", "Speichern"); addCommand(pause, "continue", "Spielstand laden"); addCommand(pause, "settings", "Einstellungen öffnen"); addCommand(pause, "endSession", "Zurück zum Menü"); surfaces.set("pause", pause);
  const settings = doc.createElement("section"); settings.append(uiText(doc, "p", "Grafik und Lautstärke werden nur über die tatsächlich angebundenen Einstellungen geändert.")); addCommand(settings, "settings", "Verfügbare Einstellungen öffnen"); surfaces.set("settings", settings);
  const playDock = addCommand(dock, "play", "Spielen");
  for (const [name, node] of surfaces) { node.id = `factory-shell-${name}`; node.className += " factory-shell-surface"; node.hidden = true; body.append(node); }
  modal.append(modalHeader, body, commandStatus); hud.append(objective, handling, warning); element.append(hud, interaction, dock, modal);

  function openSurface(next: FactoryShellSurface): void {
    if (!current()) return;
    surface = next; for (const [name, node] of surfaces) node.hidden = name !== next;
    modal.hidden = false; modalTitle.textContent = titles[next];
    for (const [name, button] of tabs) button.setAttribute("aria-pressed", String(name === next));
    port.setSurface(next, binding); modal.focus({ preventScroll: true });
  }
  function closeSurface(): void {
    if (!current() || surface === null) return;
    surface = null; modal.hidden = true; for (const node of surfaces.values()) node.hidden = true;
    for (const button of tabs.values()) button.setAttribute("aria-pressed", "false");
    options.uiPort.setPanelFocus(null); port.setSurface(null, binding);
    // No Play, pointer lock, held-key restoration or world mutation here.
  }
  function render(next: FactoryShellView): void {
    if (disposed || next.sessionId !== binding.sessionId || next.epoch !== binding.epoch || next.publicationRevision < view.publicationRevision) return;
    const oldPhase = view.phase; view = next;
    const task = projectFactoryOnboarding(next.onboarding);
    goal.textContent = task.title; hint.textContent = task.hint ?? ""; hint.hidden = task.hint === null; nextAction.hidden = task.actionSurface === null;
    state.textContent = next.statusText; handling.textContent = next.hud.carrierMassMg === null ? "" : `Trägerlast: ${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(next.hud.carrierMassMg / 1_000_000)} kg`;
    handling.hidden = next.hud.carrierMassMg === null;
    warning.textContent = [next.hud.blockReason, ...next.hud.warnings.slice(0, 2)].filter(Boolean).join(" · "); warning.hidden = !warning.textContent;
    interaction.textContent = next.hud.interactionText;
    for (const row of lifecycleButtons) { const capability = next.capabilities[row.kind]; row.button.disabled = pending !== null || !capability.enabled;
      row.button.title = capability.reason ?? ""; row.reason.textContent = capability.enabled ? "" : capability.reason ?? "Zurzeit nicht verfügbar"; row.reason.hidden = capability.enabled; }
    playDock.hidden = next.phase === "playing";
    const ui = options.uiPort.read(), m = next.map;
    map.update(m && m.sessionId === binding.sessionId && m.epoch === binding.epoch && m.frame.sourceDigest === ui.binding.terrainSourceDigest &&
      m.terrainRevision === ui.binding.terrainRevision && m.facilityRevision === ui.binding.facilityRevision ? m : null);
    if (oldPhase !== next.phase) {
      if (next.phase === "playing") closeSurface();
      else if (next.phase === "start") openSurface("start");
      else if (next.phase === "paused" || next.phase === "hold") openSurface("pause");
    }
  }
  function command(kind: FactoryShellCommandKind): void {
    if (!current() || pending !== null || !port.read().capabilities[kind].enabled) return;
    pending = kind; commandStatus.textContent = "Aktion wird noch bestätigt"; if (kind === "pause") openSurface("pause"); render(view);
    // Direct call preserves user activation for real pointer lock in Play.
    try {
      void port.dispatch({ ...binding, kind }).then(() => {
        if (!current()) return; pending = null; commandStatus.textContent = port.read().statusText; render(port.read());
      }).catch(() => { if (current()) { pending = null; commandStatus.textContent = "Aktion nicht bestätigt. Status prüfen und erneut wählen."; render(port.read()); } });
    } catch { if (current()) { pending = null; commandStatus.textContent = "Aktion nicht bestätigt. Status prüfen und erneut wählen."; render(port.read()); } }
  }
  const onKey = (event: KeyboardEvent) => {
    if (!current() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation();
      if (surface) closeSurface(); else if (!options.cancelBuildPreview?.()) command("pause"); return; }
    if (surface) {
      if (event.key === "Tab") {
        const focusable = [...modal.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']")]
          .filter(node => !node.hidden && !node.closest("[hidden]"));
        const first = focusable[0], last = focusable.at(-1);
        if (first && (doc.activeElement === modal || !modal.contains(doc.activeElement))) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
        else if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
      }
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("input,select,textarea,[contenteditable=true]")) return;
    if (event.key.toLowerCase() === "b" || event.key.toLowerCase() === "m") { event.preventDefault(); event.stopImmediatePropagation(); openSurface(event.key.toLowerCase() === "b" ? "build" : "map"); }
  };
  doc.addEventListener("keydown", onKey, true);
  const unsubscribe = port.subscribe(render); render(view);
  if (view.phase === "start") openSurface("start"); else if (view.phase !== "playing") openSurface("pause"); else modal.hidden = true;
  return {
    element, openSurface, closeSurface, readMarkers: map.readMarkers, restoreMarkers: map.restoreMarkers,
    dispose(): void {
      if (disposed) return;
      if (current()) { surface = null; options.uiPort.setPanelFocus(null); port.setSurface(null, binding); }
      disposed = true; unsubscribe(); doc.removeEventListener("keydown", onKey, true);
      for (const panel of Object.values(panels)) panel.dispose(); map.dispose(); element.remove();
    }
  };
};
