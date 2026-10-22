import { englishFactoryText } from "./english";
import type { FactoryUiCapability, FactoryUiPort } from "../session/hostPort";
import { mountFactoryCargoPanel, uiButton, uiText } from "./cargoPanel";
import { mountFactoryMachinePanel } from "./machinePanel";
import { mountFactoryPowerPanel } from "./powerPanel";
import { mountFactoryTechnologyView } from "./technologyView";
import { mountFactoryLocalMap, type FactoryMapSnapshot } from "./localMap";
import { projectFactoryOnboarding, type FactoryOnboardingFacts } from "./onboarding";
import { factoryToolIcon, factoryProfileLabel } from "./itemVisuals";
import "./factoryShell.css";

export type FactoryShellSurface = "cargo" | "machine" | "power" | "technology" | "build" | "map" | "help" | "pause" | "start" | "settings";
export type FactoryShellCommandKind = "newSession" | "continue" | "play" | "pause" | "save" | "endSession" | "settings" | "recoverSimulation";
export interface FactoryShellBinding { readonly sessionId: string; readonly epoch: number }
export interface FactoryShellCommand extends FactoryShellBinding { readonly kind: FactoryShellCommandKind }
export interface FactoryShellView extends FactoryShellBinding {
  readonly publicationRevision: number;
  readonly phase: "start" | "playing" | "paused" | "hold";
  readonly statusText: string;
  /** In particular Continue means an admitted combined Factory save, never a legacy HVP save. */
  readonly capabilities: Readonly<Record<Exclude<FactoryShellCommandKind,"recoverSimulation">, FactoryUiCapability>&Partial<Record<"recoverSimulation",FactoryUiCapability>>>;
  readonly hud: Readonly<{ interactionText: string; carrierMassMg: number | null; blockReason: string | null; warnings: readonly string[] }>;
  readonly onboarding: FactoryOnboardingFacts | null;
  readonly map: FactoryMapSnapshot | null;
}
/** Integrator-owned lifecycle, focus, source and confirmed facts. No World handle. */
export interface FactoryShellPort {
  /** Safe owner-lifecycle probe; must not read from the host. */
  isCurrent(): boolean;
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

const titles: Record<FactoryShellSurface, string> = { cargo: "Cargo & transport", machine: "Machines", power: "Power & connections",
  technology: "Technology", build: "Build", map: "Local map", help: "Field guide", pause: "Pause and session", start: "HESTIA", settings: "Settings" };
const workshopSurfaces = new Set<FactoryShellSurface>(["cargo", "build", "machine", "power", "technology", "map"]);
const compactReason = (reason: string | null): string => {
  reason = reason === null ? null : englishFactoryText(reason);
  if (reason === "Combined save not available yet" || reason === "No confirmed combined factory save is available yet") return "No save yet";
  if (reason === "Combined factory save is not connected yet" || reason === "Saving not available yet") return "Saving not available yet";
  if (reason === "Settings are not connected yet" || reason === "Settings noch nicht angebunden") return "Not available here yet";
  return reason ?? "Currently unavailable";
};

export const mountFactoryShell = (options: FactoryShellOptions) => {
  const doc = options.doc ?? document, port = options.port;
  let view = port.read(), disposed = false, surface: FactoryShellSurface | null = null, pending: FactoryShellCommandKind | null = null, navigationOpen = false;
  const binding: FactoryShellBinding = Object.freeze({ sessionId: view.sessionId, epoch: view.epoch });
  const current = (): boolean => { if (disposed || !port.isCurrent()) return false; const next = port.read(), ui = options.uiPort.read();
    return next.sessionId === binding.sessionId && next.epoch === binding.epoch && next.publicationRevision >= view.publicationRevision && ui.sessionId === binding.sessionId && ui.epoch === binding.epoch; };
  const uiPort: FactoryUiPort = { read: () => options.uiPort.read(), subscribe: listener => options.uiPort.subscribe(listener),
    submit: command => options.uiPort.submit(command), readReceipt: id => options.uiPort.readReceipt(id),
    setPanelFocus: panel => { if (current() && (panel !== null || surface === null)) options.uiPort.setPanelFocus(panel); } };
  // Visibility changes never remount a controller or lose an unknown receipt.
  const panels = { cargo: mountFactoryCargoPanel(uiPort, doc), machine: mountFactoryMachinePanel(uiPort, doc),
    power: mountFactoryPowerPanel(uiPort, doc), technology: mountFactoryTechnologyView(uiPort, doc) };
  const map = mountFactoryLocalMap(doc);
  const mini = mountFactoryLocalMap(doc, { compact: true }); mini.element.className += " factory-shell-minimap";
  const element = doc.createElement("section"); element.id = "factory-shell"; element.className = "factory-shell";
  const hud = doc.createElement("header"); hud.className = "factory-shell-hud";
  const objective = uiButton(doc, "", () => { const next = projectFactoryOnboarding(view.onboarding).actionSurface; if (next) openSurface(next); });
  objective.className = "factory-shell-objective"; objective.setAttribute("aria-label", "View objective");
  const goal = uiText(doc, "strong", ""), chapter = uiText(doc, "small", "Goal"); objective.append(factoryToolIcon(doc, "cargo"), chapter, goal); hud.append(objective);
  const utility = doc.createElement("div"); utility.className = "factory-shell-utility";
  const pauseButton = uiButton(doc, "", () => command("pause")); pauseButton.append(factoryToolIcon(doc, "pause"), uiText(doc, "span", "Pause")); pauseButton.setAttribute("aria-label", "Pause and menu"); utility.append(pauseButton);
  const context = doc.createElement("div"); context.className = "factory-shell-context";
  const contextName = uiText(doc, "small", "");
  const contextButton = uiButton(doc, "View cargo", () => openSurface("cargo")); context.append(contextName, contextButton);
  const handling = doc.createElement("div"); handling.className = "factory-shell-handling";
  const handlingMass = uiText(doc, "strong", ""); handling.append(factoryToolIcon(doc, "cargo"), handlingMass);
  const warning = uiText(doc, "p", ""); warning.className = "factory-shell-warning"; warning.setAttribute("role", "status");
  const keyHints = uiText(doc, "p", "B  Build   ·   M  Map   ·   E  Cargo   ·   I  Inventory   ·   Esc  Menu"); keyHints.className = "factory-shell-key-hints";
  const modal = doc.createElement("section"); modal.className = "factory-shell-modal"; modal.tabIndex = -1;
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-labelledby", "factory-shell-modal-title");
  const modalHeader = doc.createElement("header"); modalHeader.className = "factory-shell-modal-header";
  const modalTitle = uiText(doc, "h1", ""); modalTitle.id = "factory-shell-modal-title";
  const close = uiButton(doc, "Close", () => closeSurface());
  const navigation = uiButton(doc, "Views", () => { navigationOpen = !navigationOpen; presentation(); });
  navigation.setAttribute("aria-expanded", "false"); navigation.setAttribute("aria-controls", "factory-shell-navigation");
  const headerActions = doc.createElement("div"); headerActions.className = "factory-shell-header-actions"; headerActions.append(navigation, close);
  modalHeader.append(modalTitle, headerActions);
  const dock = doc.createElement("nav"); dock.className = "factory-shell-dock"; dock.setAttribute("aria-label", "Workshop views");
  dock.id = "factory-shell-navigation";
  const tabs = new Map<FactoryShellSurface, HTMLButtonElement>();
  for (const [name, label] of [["cargo", "Cargo"], ["build", "Build"], ["machine", "Machines"], ["power", "Power"], ["technology", "Technology"], ["map", "Map"]] as const) {
    const tab = uiButton(doc, "", () => openSurface(name)); tab.append(factoryToolIcon(doc, name), uiText(doc, "span", label));
    tab.setAttribute("aria-controls", `factory-shell-${name}`); tab.setAttribute("aria-label", label); dock.append(tab); tabs.set(name, tab);
  }
  const body = doc.createElement("div"); body.className = "factory-shell-modal-body";
  const commandStatus = uiText(doc, "p", ""); commandStatus.className = "factory-shell-command-status"; commandStatus.setAttribute("role", "status"); commandStatus.setAttribute("aria-live", "polite");
  const panelState = uiText(doc, "small", ""); panelState.className = "factory-shell-panel-state";
  const surfaces = new Map<FactoryShellSurface, HTMLElement>();
  for (const [name, panel] of Object.entries(panels)) surfaces.set(name as FactoryShellSurface, panel.element);
  const power = doc.createElement("div"); power.append(panels.power.element);
  if (options.connectionsPanel) power.append(options.connectionsPanel);
  surfaces.set("power", power); surfaces.set("build", options.buildPanel); surfaces.set("map", map.element);
  const help = doc.createElement("section"); help.className = "factory-shell-help";
  const missionHint = uiText(doc, "p", "");
  help.append(uiText(doc, "h2", "Next action"), missionHint,
    uiText(doc, "h2", "Movement"), uiText(doc, "p", "WASD to walk · Shift to sprint · Space to jump · V to change view. Play enables mouse look."),
    uiText(doc, "h2", "Workshop"), uiText(doc, "p", "B opens Build; M opens the local map. Escape closes a view, otherwise cancels the build preview or pauses. Tab moves focus between controls."),
    uiText(doc, "p", "Build preview: arrows move by 25 cm; R rotates by 90°. Confirm charges an admitted build. Cancel retains all material."),
    uiText(doc, "p", "Transport heavy chassis first. Set them down safely, step outside the machine footprint, then build."),
    uiText(doc, "h2", "Pause and focus"), uiText(doc, "p", "Closing a view does not resume play. Select Play after an interruption; held movement keys are cleared."),
    uiText(doc, "p", "F pushes an existing detached body; 1/2/3 select tools. In the world, Q/E move the inspection camera. While playing, E instead opens Cargo for reachable wreck cargo or a carried load; I opens Cargo/transport."),
    uiText(doc, "small", "Factory prototype: the ship remains permanently grounded. Global exploration and cities are outside this workshop."));
  surfaces.set("help", help);
  const lifecycleButtons: { kind: FactoryShellCommandKind; row:HTMLElement; button: HTMLButtonElement; reason: HTMLElement; detail: HTMLElement }[] = [];
  const addCommand = (parent: HTMLElement, kind: FactoryShellCommandKind, label: string) => {
    const row = doc.createElement("div"); row.className = "factory-shell-command";
    const button = uiButton(doc, label, () => command(kind)), reason = uiText(doc, "small", ""), detail = uiText(doc, "span", "");
    detail.hidden = true; reason.id = `factory-shell-reason-${kind}-${lifecycleButtons.length}`; button.setAttribute("aria-describedby", reason.id);
    row.append(button, reason, detail); parent.append(row); lifecycleButtons.push({ kind, row, button, reason, detail }); return button;
  };
  const start = doc.createElement("section"); start.className = "factory-shell-start";
  start.append(uiText(doc, "small", "EXPEDITION · CRASH SITE"), uiText(doc, "p", "The ship is grounded. Its cargo will supply your first workshop."));
  addCommand(start, "newSession", "New game"); addCommand(start, "continue", "Continue"); addCommand(start, "settings", "Settings");
  start.append(uiButton(doc, "Field guide", () => openSurface("help")), uiText(doc, "small", "Factory prototype · First structural brace")); surfaces.set("start", start);
  const pause = doc.createElement("section"); pause.className = "factory-shell-pause";
  const state = uiText(doc, "p", ""); state.setAttribute("role", "status"); pause.append(state);
  addCommand(pause,"recoverSimulation","Recover session");
  addCommand(pause, "play", "Play"); addCommand(pause, "save", "Save"); addCommand(pause, "continue", "Load game"); addCommand(pause, "settings", "Open settings"); addCommand(pause, "endSession", "End session");
  pause.append(uiButton(doc, "Open workshop", () => openSurface("cargo")), uiButton(doc, "Open field guide", () => openSurface("help"))); surfaces.set("pause", pause);
  const settings = doc.createElement("section"); addCommand(settings, "settings", "Open available settings"); surfaces.set("settings", settings);
  const resume = doc.createElement("section"); resume.className = "factory-shell-resume";
  const resumeState = uiText(doc, "p", ""); resume.append(resumeState);addCommand(resume,"recoverSimulation","Recover session"); addCommand(resume, "play", "Play");
  for (const [name, node] of surfaces) { node.id = `factory-shell-${name}`; node.className += " factory-shell-surface"; node.hidden = true; body.append(node); }
  modal.append(modalHeader, dock, body, commandStatus, panelState); element.append(hud, utility, mini.element, context, handling, warning, keyHints, resume, modal);

  function presentation(): void {
    const opened = surface !== null, inWorld = !opened && view.phase !== "start";
    element.dataset.mode = surface === "start" ? "start" : opened ? "inspect" : "world";
    modal.dataset.surface = surface ?? "none";
    hud.hidden = view.phase === "start";
    utility.hidden = opened || view.phase === "start";
    keyHints.hidden = view.phase === "start";
    keyHints.textContent = surface === "build" ? "Arrows  Move   ·   R  Rotate   ·   Esc  Back" : "B  Build   ·   M  Map   ·   E  Cargo   ·   I  Inventory   ·   Esc  Menu";
    mini.element.hidden = view.phase === "start" || surface === "map";
    context.hidden = opened || view.phase !== "playing" || !(options.uiPort.read().interaction.cargoAccessible || options.uiPort.read().interaction.handling);
    handling.hidden = !inWorld || view.hud.carrierMassMg === null;
    warning.hidden = !inWorld || !warning.textContent;
    resume.hidden = opened || view.phase === "start" || view.phase === "playing";
    dock.hidden = !navigationOpen || surface === null || !workshopSurfaces.has(surface);
    navigation.hidden = surface === null || !workshopSurfaces.has(surface);
    navigation.setAttribute("aria-expanded", String(!dock.hidden));
    close.hidden = surface === "start";
  }
  function openSurface(next: FactoryShellSurface): void {
    if (!current()) return;
    navigationOpen = false;
    if (pending === null) commandStatus.textContent = "";
    surface = next; for (const [name, node] of surfaces) node.hidden = name !== next;
    modal.hidden = false; modalTitle.textContent = titles[next];
    for (const [name, button] of tabs) button.setAttribute("aria-pressed", String(name === next));
    presentation(); port.setSurface(next, binding); modal.focus({ preventScroll: true });
    if (next === "pause") body.scrollTop = 0;
  }
  function closeSurface(): void {
    if (!current() || surface === null) return;
    if (view.phase === "start") {
      if (surface !== "start") openSurface("start");
      return;
    }
    surface = null; modal.hidden = true; for (const node of surfaces.values()) node.hidden = true;
    for (const button of tabs.values()) button.setAttribute("aria-pressed", "false");
    options.uiPort.setPanelFocus(null); port.setSurface(null, binding); presentation();
  }
  function render(next: FactoryShellView): void {
    if (disposed || next.sessionId !== binding.sessionId || next.epoch !== binding.epoch || next.publicationRevision < view.publicationRevision) return;
    const oldPhase = view.phase; view = next;
    if (pending === null && commandStatus.textContent === next.statusText) commandStatus.textContent = "";
    panelState.textContent = englishFactoryText(next.statusText);
    const task = projectFactoryOnboarding(next.onboarding);
    goal.textContent = task.title; objective.disabled = task.actionSurface === null; missionHint.textContent = task.hint ?? task.title;
    state.textContent = resumeState.textContent = englishFactoryText(next.statusText);
    handlingMass.textContent = next.hud.carrierMassMg === null ? "" : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 6 }).format(next.hud.carrierMassMg / 1_000_000)} kg`;
    warning.textContent = [next.hud.blockReason, ...next.hud.warnings.slice(0, 2)].filter(Boolean).join(" · ");
    const ui = options.uiPort.read(), carried = ui.interaction.handling;
    contextName.textContent = carried ? factoryProfileLabel(carried.profileId, "Cargo load") : "WRECK CARGO";
    contextButton.textContent = carried ? "View transport" : "View cargo";
    contextButton.disabled = !ui.host.confirmed || ui.state !== "Ready";
    pauseButton.disabled = pending !== null || !next.capabilities.pause.enabled;
    for (const row of lifecycleButtons) { row.row.hidden=row.kind==="recoverSimulation"&&(next.phase!=="hold"||!next.capabilities.recoverSimulation);const capability = next.capabilities[row.kind]??{enabled:false,reason:null}; row.button.disabled = pending !== null || !capability.enabled;
      row.button.title = compactReason(capability.reason); row.reason.textContent = capability.enabled ? "" : compactReason(capability.reason); row.reason.hidden = capability.enabled;
      row.detail.textContent = capability.reason && compactReason(capability.reason) !== capability.reason ? englishFactoryText(capability.reason) : ""; }
    const m = next.map;
    const confirmedMap = m && m.sessionId === binding.sessionId && m.epoch === binding.epoch && m.frame.sourceDigest === ui.binding.terrainSourceDigest &&
      m.terrainRevision === ui.binding.terrainRevision && m.facilityRevision === ui.binding.facilityRevision && ui.host.confirmed && ui.state === "Ready" ? m : null;
    map.update(confirmedMap); mini.update(confirmedMap); mini.restoreMarkers(map.readMarkers());
    if (oldPhase !== next.phase) {
      if (next.phase === "playing") closeSurface();
      else if (next.phase === "start") openSurface("start");
      else if (next.phase === "hold" || (next.phase === "paused" && (!surface || !workshopSurfaces.has(surface)))) openSurface("pause");
    }
    presentation();
  }
  function command(kind: FactoryShellCommandKind): void {
    if (!current() || pending !== null || !port.read().capabilities[kind]?.enabled) return;
    pending = kind; commandStatus.textContent = "Waiting for action confirmation"; if (kind === "pause") openSurface("pause"); render(view);
    // No await before the admitted Play callback: preserve real user activation.
    try {
      void port.dispatch({ ...binding, kind }).then(() => {
        if (!current()) return; pending = null; commandStatus.textContent = englishFactoryText(port.read().statusText); render(port.read());
      }).catch(() => { if (current()) { pending = null; commandStatus.textContent = "Action unconfirmed. Check status before retrying."; render(port.read()); } });
    } catch { if (current()) { pending = null; commandStatus.textContent = "Action unconfirmed. Check status before retrying."; render(port.read()); } }
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
    const key = event.key.toLowerCase();
    if (key === "e") {
      const ui = options.uiPort.read();
      if (port.read().phase !== "playing" || !ui.host.confirmed || ui.state !== "Ready" || !(ui.interaction.cargoAccessible || ui.interaction.handling)) return;
    }
    if (key === "e" || key === "i" || key === "b" || key === "m") {
      event.preventDefault(); event.stopImmediatePropagation(); openSurface(key === "b" ? "build" : key === "m" ? "map" : "cargo");
    }
  };
  doc.addEventListener("keydown", onKey, true);
  const unsubscribe = port.subscribe(render); render(view);
  if (view.phase === "start") openSurface("start"); else if (view.phase !== "playing") openSurface("pause"); else { modal.hidden = true; presentation(); }
  return {
    element, openSurface, closeSurface, readMarkers: map.readMarkers, restoreMarkers: map.restoreMarkers,
    dispose(): void {
      if (disposed) return;
      if (current()) { surface = null; options.uiPort.setPanelFocus(null); port.setSurface(null, binding); }
      disposed = true; unsubscribe(); doc.removeEventListener("keydown", onKey, true);
      for (const panel of Object.values(panels)) panel.dispose(); map.dispose(); mini.dispose(); element.remove();
    }
  };
};
