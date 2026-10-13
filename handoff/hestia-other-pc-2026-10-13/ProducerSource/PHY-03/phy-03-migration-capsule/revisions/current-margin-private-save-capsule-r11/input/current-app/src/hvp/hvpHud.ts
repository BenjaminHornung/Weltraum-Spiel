import type { HvpCameraPose, HvpCameraPreset } from "./hvpCamera";
import type { HvpPhysicsClient } from "../hestia-prototype/physics/client";
import type { createHvpPlasmaTool } from "../hestia-prototype/terrain/plasmaTool";
import {createHvpListeners} from "../hestia-prototype/runtime/listeners";
import type {createHvpSalvageLoop} from "../hestia-prototype/gameplay/salvageLoop";
import type {createHvpNeighborController} from "../hestia-prototype/runtime/neighborController";
import type {createHvpDormancyController} from "../hestia-prototype/runtime/dormancyController";
import type {HvpImpulseTarget} from "../hestia-prototype/physics/session";

export const describeHvpImpulseTarget=(target:HvpImpulseTarget|undefined):string=>{
  const name=target?.target==="hvp:physics:inertia"?"L-Holzkörper":target?.target==="hvp:physics:drop"?"Steinwürfel":"Beweglicher Körper";
  switch(target?.kind){
    case "Dynamic":return `${name} · ${target.massKg!.toFixed(1)} kg · ${target.distanceMeters!.toFixed(1)} m · F kurz drücken: Stoß nach vorn`;
    case "Fixed":return "Festes Objekt – F bewegt nur gelöste Körper, nicht Gelände oder verankerte Bäume.";
    case "Cooldown":return "Kurz warten – ein Stoß alle 0,25 Sekunden.";
    case "SpeedLimit":return "Geschwindigkeitsgrenze erreicht – kein weiterer Stoß.";
    case "Busy":return "Welt wird aktualisiert – bitte kurz warten.";
    case "NotPlaying":return "Spielen anklicken und die Maus übernehmen, dann einen gelösten Körper anvisieren.";
    default:return "Kein Treffer innerhalb von 4 m – näher an einen gelösten Körper herangehen.";
  }
};
export const describeHvpImpulseResult=(reason:string|undefined):string=>{
  switch(reason){
    case "Solver contact impulse":return "Stoß ausgelöst. Schwere Körper bewegen sich bei gleicher Kraft weniger.";
    case "Contact is not dynamic":return "Kein Stoß: Das getroffene Objekt ist noch fest verankert.";
    case "No contact within 4 m":return "Kein Stoß: Kein Körper innerhalb von 4 m getroffen.";
    case "Player is not running":return "Kein Stoß: Erst im Spielmodus fortsetzen.";
    case "Cooldown 250 ms":return "Kein weiterer Stoß: Taste kurz loslassen und erneut drücken.";
    case "Speed budget":return "Kein Stoß: Geschwindigkeitsgrenze erreicht.";
    case "Invalid aim":return "Kein Stoß: Noch keine gültige Zielrichtung.";
    default:return "F stößt in Blickrichtung; es greift oder zieht kein Objekt.";
  }
};

export type HvpLifecycleState = "Loading" | "Ready" | "Error";

export interface HvpHudStats {
  /** Authority scope: terrain + water only. */
  readonly faces: number;
  readonly vertices: number;
  readonly triangles: number;
  /** Voxel quads: coast, continuation and vegetation; excludes the non-voxel sky. */
  readonly sceneFaces: number;
  /** All admitted triangles, including presentation effects such as the sky. */
  readonly sceneTriangles: number;
}

export interface HvpHudActions {
  setPreset(preset: HvpCameraPreset): void;
  resetCamera(): void;
  readWaterEnabled(): boolean;
  setWaterEnabled(enabled: boolean): void;
  readInspectEnabled(): boolean;
  setInspectEnabled(enabled: boolean): void;
  readAoEnabled(): boolean;
  setAoEnabled(enabled: boolean): void;
  readPhysics: HvpPhysicsClient["read"];
  physicsCommand: HvpPhysicsClient["command"];
  play(): void;
  readThirdPerson(): boolean;
  readAimScreen():Readonly<{x:number;y:number;visible:boolean}>;
  togglePlayerView(): void;
  readTool(): ReturnType<ReturnType<typeof createHvpPlasmaTool>["read"]>;
  selectTool(mode:number):void;
  aimImpulse():void;
  aimBranch():void;
  previewSupport():void;
  aimRock():void;
  restartRock():void;
  readSupport():Readonly<{state:string;cells:number;massKg:number;fragments:number;message:string}>;
  readSave():Readonly<{state:string;message:string;revision:number|null}>;
  save():void;
  load():void;
  loadNewSession():void;
  readSalvage():ReturnType<ReturnType<typeof createHvpSalvageLoop>["read"]>|null;
  restartSalvage():void;
  readNeighbor():ReturnType<ReturnType<typeof createHvpNeighborController>["read"]>|null;
  readDormancy():ReturnType<ReturnType<typeof createHvpDormancyController>["read"]>|null;
  retryNeighbor():void;
  restartEast():void;
  endSession():void;
}

export interface HvpHudOptions {
  readonly host: HTMLElement;
  readonly actions: HvpHudActions;
  readonly documentPort?: Pick<Document, "createElement" | "body">;
}

export interface HvpHud {
  readonly listenerCount:number;
  update(state: HvpLifecycleState, pose: HvpCameraPose, stats: HvpHudStats, detail?: string): void;
  updatePhysics(): void;
  updateSave(): void;
  dispose(): void;
}

export const clearHvpDataset = (body: HTMLElement): void => {
  for (const key of Object.keys(body.dataset)) {
    if (key === "hestiaPrototype" || key.startsWith("hestiaPrototype")) delete body.dataset[key];
  }
};

const setText = (element: HTMLElement, value: string): void => {
  if (element.textContent !== value) element.textContent = value;
};
const setHidden = (element: HTMLElement, value: boolean): void => {
  if (element.hidden !== value) element.hidden = value;
};
const setDisabled = (element: HTMLButtonElement, value: boolean): void => {
  if (element.disabled !== value) element.disabled = value;
};

export const createHvpHud = (options: HvpHudOptions): HvpHud => {
  let disposed = false;
  const listeners=createHvpListeners();
  const documentPort = options.documentPort ?? document;
  const root = documentPort.createElement("section");
  root.id = "hvp-hud";
  root.setAttribute("aria-label", "Hestia coast and vegetation controls");
  root.setAttribute("style", [
    "position:fixed",
    "left:12px",
    "top:12px",
    "z-index:20",
    "max-width:320px",
    "padding:10px 12px",
    "background:rgba(6,10,16,0.88)",
    "border:1px solid rgba(140,170,210,0.5)",
    "color:#e7eefc",
    "font:12px/1.45 system-ui,sans-serif"
  ].join(";"));

  const title = documentPort.createElement("strong");
  title.textContent = "HVP-13 HESTIA COAST";
  const stateValue = documentPort.createElement("div");
  stateValue.id = "hvp-state";
  stateValue.setAttribute("role", "status");
  const modeValue = documentPort.createElement("div");
  modeValue.id = "hvp-mode";
  const detailValue = documentPort.createElement("div");
  detailValue.id = "hvp-detail";
  const physicsValue = documentPort.createElement("div");
  physicsValue.id = "hvp-physics-status";
  physicsValue.setAttribute("role", "status");
  const toolValue=documentPort.createElement("div");toolValue.id="hvp-tool-status";toolValue.setAttribute("role","status");
  const saveValue=documentPort.createElement("div");saveValue.id="hvp-save-status";saveValue.setAttribute("role","status");
  const neighborValue=documentPort.createElement("div");neighborValue.id="hvp-neighbor-status";neighborValue.setAttribute("role","status");
  const interaction=documentPort.createElement("section");interaction.id="hvp-interaction";
  interaction.setAttribute("aria-label","Ziel und Physikstoß");
  interaction.setAttribute("style","position:fixed;bottom:22px;left:50%;transform:translateX(-50%);max-width:650px;padding:8px 14px;background:#12252be8;color:#f2f4ec;font:14px/1.45 system-ui;text-align:center;pointer-events:none;z-index:19");
  const targetValue=documentPort.createElement("div");targetValue.id="hvp-interaction-target";
  const feedback=documentPort.createElement("div");feedback.id="hvp-interaction-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
  const cutFeedback=documentPort.createElement("div");cutFeedback.id="hvp-cut-feedback";cutFeedback.setAttribute("role","status");cutFeedback.setAttribute("aria-live","polite");
  const keysValue=documentPort.createElement("div");keysValue.textContent="1/2/3 + Linksklick: Schneiden an freigegebenen Stellen · V: Perspektive · Esc: Pause / Übersicht";
  keysValue.setAttribute("style","font-size:12px;margin-top:4px");
  interaction.append(targetValue,feedback,cutFeedback,keysValue);options.host.append(interaction);interaction.hidden=true;
  const reticle=documentPort.createElement("div");reticle.id="hvp-aim-reticle";reticle.setAttribute("aria-hidden","true");
  reticle.setAttribute("style","position:fixed;width:7px;height:7px;border:1px solid #152229;border-radius:50%;background:#f2f4ec;transform:translate(-50%,-50%);pointer-events:none;z-index:19");
  options.host.append(reticle);reticle.hidden=true;

  const inspectButton = documentPort.createElement("button");
  inspectButton.type = "button";
  inspectButton.id = "hvp-camera-inspect";
  inspectButton.setAttribute("style", "margin:6px 6px 0 0;pointer-events:auto");
  inspectButton.setAttribute("aria-pressed", "false");
  const updateInspectButton = (): void => {
    const inspectEnabled = options.actions.readInspectEnabled();
    inspectButton.textContent = `Inspect: ${inspectEnabled ? "on" : "off"}`;
    inspectButton.setAttribute("aria-pressed", inspectEnabled ? "true" : "false");
    root.dataset.inspect = inspectEnabled ? "on" : "off";
  };
  listeners.add(inspectButton,"click", () => {
    options.actions.setInspectEnabled(!options.actions.readInspectEnabled());
    updateInspectButton();
  });
  const aoButton = documentPort.createElement("button");
  aoButton.type = "button";
  aoButton.id = "hvp-ao-toggle";
  aoButton.setAttribute("style", "margin:6px 6px 0 0;pointer-events:auto");
  aoButton.setAttribute("aria-pressed", "true");
  aoButton.setAttribute("aria-label", "Inspect-only ambient occlusion toggle");
  const updateAoButton = (): void => {
    const aoOn = options.actions.readAoEnabled();
    aoButton.textContent = `AO: ${aoOn ? "on" : "off"}`;
    aoButton.setAttribute("aria-pressed", aoOn ? "true" : "false");
    root.dataset.ao = aoOn ? "on" : "off";
  };
  listeners.add(aoButton,"click", () => {
    options.actions.setAoEnabled(!options.actions.readAoEnabled());
    updateAoButton();
  });
  const hideButton = documentPort.createElement("button");
  hideButton.type = "button";
  hideButton.id = "hvp-hide-ui";
  hideButton.textContent = "Hide UI";
  hideButton.setAttribute("style", "margin:6px 6px 0 0;pointer-events:auto");
  hideButton.setAttribute("aria-pressed", "false");
  let uiVisible = true;
  const hideablePanels = [title, stateValue, modeValue, detailValue, physicsValue, toolValue,saveValue];
  const controls = documentPort.createElement("div");
  const waterButton = documentPort.createElement("button");
  waterButton.type = "button";
  waterButton.id = "hvp-water-toggle";
  waterButton.setAttribute("style", "margin:6px 6px 0 0;pointer-events:auto");
  const updateWaterButton = (): void => {
    const waterEnabled = options.actions.readWaterEnabled();
    waterButton.textContent = `Water: ${waterEnabled ? "on" : "off"}`;
    documentPort.body.dataset.hestiaPrototypeWater = waterEnabled ? "on" : "off";
    root.dataset.water = waterEnabled ? "on" : "off";
  };
  listeners.add(waterButton,"click", () => {
    options.actions.setWaterEnabled(!options.actions.readWaterEnabled());
    updateWaterButton();
  });
  const makeButton = (id: string, label: string, action: () => void): HTMLButtonElement => {
    const button = documentPort.createElement("button");
    button.type = "button";
    button.id = id;
    button.textContent = label;
    button.setAttribute("style", "margin:6px 6px 0 0;pointer-events:auto");
    listeners.add(button,"click", action);
    return button;
  };
  const command = (kind: "Pause" | "Resume" | "Drop"): void => {
    void options.actions.physicsCommand(kind).catch((error: unknown) => {
      if (disposed) return;
      physicsValue.textContent = `Physics error: ${error instanceof Error ? error.message : String(error)}`;
    });
  };
  const pauseButton = makeButton("hvp-physics-pause", "Physik pausieren", () => {
    command(options.actions.readPhysics().status === "Running" ? "Pause" : "Resume");
  });
  const dropButton = makeButton("hvp-physics-drop", "Fallkörper neu starten", () => command("Drop"));
  const viewButton = makeButton("hvp-player-view", "Perspektive: Ego (V)", () => options.actions.togglePlayerView());
  const goalPanel=documentPort.createElement("section");goalPanel.id="hvp-salvage-panel";goalPanel.setAttribute("aria-label","Bergungsauftrag");
  goalPanel.setAttribute("style","position:fixed;right:16px;top:16px;max-width:290px;padding:12px;background:#12252be8;color:#f2f4ec;font:14px/1.5 system-ui;z-index:20");
  const goalTitle=documentPort.createElement("strong"),goalText=documentPort.createElement("p"),goalSteps=documentPort.createElement("div");
  goalText.id="hvp-salvage-instruction";goalText.setAttribute("role","status");goalTitle.textContent="Bergungsauftrag";
  const goalPlay=makeButton("hvp-salvage-play","Spielen",()=>options.actions.play());
  const goalSave=makeButton("hvp-salvage-save","Bergung speichern",()=>options.actions.save());
  const goalRestart=makeButton("hvp-salvage-restart","Neuer Auftrag",()=>options.actions.restartSalvage());
  goalPanel.append(goalTitle,goalText,goalSteps,goalPlay,goalSave,goalRestart);options.host.append(goalPanel);goalPanel.hidden=true;
  const goalButtons = [goalPlay, goalSave, goalRestart];
  // Cache scalar values, not snapshot identity: a caller may reuse its save view.
  let saveState: string | undefined, saveMessage: string | undefined, saveRevision: number | null | undefined;
  let aimX: number | undefined, aimY: number | undefined, dynamicTarget: boolean | undefined;
  const updateSave = () => {
    if (disposed) return;
    const save=options.actions.readSave();
    setText(saveValue,`Spielstand: ${save.state} · ${save.message}${save.revision===null?"":` · r${save.revision}`}`);
    if (save.state !== saveState || save.message !== saveMessage || save.revision !== saveRevision) {
      documentPort.body.dataset.hestiaPrototypeSave=JSON.stringify(save);
      saveState = save.state; saveMessage = save.message; saveRevision = save.revision;
    }
    const blocked = save.state === "Saving" || save.state === "Loading" || save.state === "RecoveryHold";
    for (let index = 0; index < controls.children.length; index += 1) {
      const child = controls.children[index]!;
      if (child !== hideButton) setDisabled(child as HTMLButtonElement, blocked);
    }
    for (const button of goalButtons) setDisabled(button, blocked);
    return save;
  };
  const updatePhysics = (): void => {
    if (disposed) return;
    updateSave();
    const tool=options.actions.readTool();
    let toolText=`Plasmacutter: ${tool.mode} · ${tool.state} · ${tool.last?.reason??tool.message} · 1/2/3, Linksklick · Terrain: SafeQuarry / Holz: Ast`;
    const thirdPerson = options.actions.readThirdPerson();
    setText(viewButton, thirdPerson ? "Perspektive: 3. Person (V)" : "Perspektive: Ego (V)");
    const state = options.actions.readPhysics();
    const neighbor=options.actions.readNeighbor();
    let neighborText=neighbor?`Ostregion: ${neighbor.state}${neighbor.busy?" (Pending)":""} · LOD ${neighbor.renderLod??neighbor.lod} m${neighbor.proxyOnly?" (Checkpoint-Projektion)":""} · Kollision ${neighbor.collisionReady?"bereit":"fehlt"}${neighbor.error?` · ${neighbor.error}`:""}`:"";
    const dormancy=options.actions.readDormancy();
    if(dormancy){neighborText+=` · Ruhende Fragmente: ${state.parked?.length??0}${dormancy.busy?" (Pending)":""}${dormancy.error?` · ${dormancy.error}`:""}`;}
    setText(neighborValue, neighborText);
    const goal=options.actions.readSalvage();setHidden(goalPanel, goal===null||!uiVisible);
    // Keep the real player objective separate from the inspection/diagnostic panel.
    const playing=state.player?.status==="Walking";
    setHidden(root, playing);
    setHidden(interaction, !playing||!uiVisible);
    const aim=options.actions.readAimScreen();setHidden(reticle, !playing||!uiVisible||!aim.visible);
    // This HUD exclusively owns the reticle styles. Cache inputs because CSSOM
    // normalizes colors (hex becomes rgb), which defeats raw string comparisons.
    if (aim.x !== aimX) { reticle.style.left=`${aim.x}%`; aimX=aim.x; }
    if (aim.y !== aimY) { reticle.style.top=`${aim.y}%`; aimY=aim.y; }
    const dynamic = state.impulseTarget?.kind==="Dynamic";
    if (dynamic !== dynamicTarget) { reticle.style.background=dynamic?"#9ce8bf":"#f2f4ec"; dynamicTarget=dynamic; }
    const targetText=describeHvpImpulseTarget(state.impulseTarget);
    setText(targetValue, targetText);
    const resultText=(state.lastImpulse?"Letzter Versuch: ":"")+describeHvpImpulseResult(state.lastImpulse?.reason);
    setText(feedback, resultText);
    const recovery = tool.state === "RecoveryHold" || tool.structural?.state === "RecoveryHold" || tool.moving?.state === "RecoveryHold";
    const pending = tool.state === "Pending" || tool.structural?.state === "Pending" || tool.moving?.state === "Pending";
    const cutText=recovery?"Schnitt angehalten: Wiederherstellung nicht bestätigt."
      :pending?"Schneiden … Zusammenhang, Geometrie und Kollision werden vorbereitet."
        :`${tool.mode} · Linksklick: ${tool.message}`;
    setText(cutFeedback, cutText);
    if(goal){
      setText(goalText, goal.targetLost?"Bergungsstück verändert oder verloren. Gesicherten Stand laden oder neuen Auftrag starten.":goal.instruction!);
      let completed = 0;
      for (const objective of goal.mission.objectiveStates) { if (objective.state === "Completed") completed += 1; }
      setText(goalSteps,`${completed}/4 · WASD / Space · 1 + Klick: Verbindung · F: Schieben · Esc: Pause`);
      setHidden(goalPlay, playing||goal.stage==="Save"||goal.stage==="Completed");
      setHidden(goalSave, goal.stage!=="Save");
    }
    if(state.inertia) { toolText+=` · F: Schieben (4 m / 15 N·s) · ${state.lastImpulse?.reason??"L-Körper bereit"}`; }
    if(state.structural) {toolText+=` · Ast: ${tool.structural?.last?.status??state.structural.state} · ${tool.structural?.last?.reason??`Taste ${state.structural.cutEdge===1?1:2} + Linksklick`}`;}
    if(state.moving){toolText+=` · Fragment: ${tool.moving?.last?.status??tool.moving?.state??state.moving.state} · ${tool.moving?.last?.reason??"1 Zelle / 2 Box / 3 Kugel erneut schneiden"}`;}
    const support=options.actions.readSupport();
    if(support.state!=="Idle"){toolText+=` · Stützvorschau: ${support.state} · ${support.fragments} Teile / ${support.cells} Zellen / ${support.massKg.toFixed(2)} kg · ${support.message}`;}
    setText(toolValue, toolText);
    setText(pauseButton, state.status === "Running" ? "Physik pausieren" : "Physik fortsetzen");
    const drop = state.bodies[0];
    let physicsText = `Physics: ${state.status} · ${state.bodyCount} bodies / ${state.colliderCount} colliders · g=${state.gravity.toFixed(2)} m/s²`
      + (drop === undefined ? "" : ` · Fallhöhe y=${drop.position.y.toFixed(2)} m`);
    if (state.player != null) {
      physicsText += ` · Player: ${state.player.status}${state.player.grounded ? " (Boden)" : ""}`;
      setText(modeValue, state.player.status === "Inspection"
        ? `Camera: ${documentPort.body.dataset.hestiaPrototypeCamera} (${options.actions.readInspectEnabled() ? "Fly" : "Orbit"})`
        : `Player: ${state.player.status} · ${thirdPerson ? "Third Person" : "First Person"} · 1.80 m`);
    }
    const inputError = documentPort.body.dataset.hestiaPrototypeInputError;
    if (inputError !== undefined) { physicsText += ` · ${inputError}`; }
    setText(physicsValue, physicsText);
  };
  controls.append(
    makeButton("hvp-end-session","Sitzung beenden",()=>options.actions.endSession()),
    makeButton("hvp-play", "Spielen · WASD / Maus / Space", () => options.actions.play()),
    viewButton,
    makeButton("hvp-camera-eye", "C01-EYE", () => options.actions.setPreset("C01-EYE")),
    makeButton("hvp-camera-shore", "C02-SHORE", () => options.actions.setPreset("C02-SHORE")),
    makeButton("hvp-camera-roots", "C03-ROOTS", () => options.actions.setPreset("C03-ROOTS")),
    makeButton("hvp-camera-wide", "C04-WIDE", () => options.actions.setPreset("C04-WIDE")),
    makeButton("hvp-camera-rockarm", "C05-Felsarm", () => options.actions.setPreset("C05-ROCKARM")),
    makeButton("hvp-support-preview", "Felsarm-Stütze prüfen (ohne Schnitt)", () => options.actions.previewSupport()),
    makeButton("hvp-aim-rock", "Stütze anvisieren (2 + Klick)", () => options.actions.aimRock()),
    makeButton("hvp-restart-rock", "Neustart: Felsarm", () => options.actions.restartRock()),
    makeButton("hvp-restart-salvage","Neuer Bergungsauftrag",()=>options.actions.restartSalvage()),
    makeButton("hvp-restart-east","Neustart: Ostpfad",()=>options.actions.restartEast()),
    makeButton("hvp-neighbor-retry","Ostregion erneut versuchen",()=>options.actions.retryNeighbor()),
    makeButton("hvp-camera-quarry", "Ansicht: Schnittstelle", () => options.actions.setPreset("C07-QUARRY")),
    makeButton("hvp-aim-inertia", "L-Körper anvisieren (F)", () => options.actions.aimImpulse()),
    makeButton("hvp-aim-branch", "Ast anvisieren (2 + Klick)", () => options.actions.aimBranch()),
    makeButton("hvp-tool-cell","1: Zelle",()=>options.actions.selectTool(1)),
    makeButton("hvp-tool-box","2: Box",()=>options.actions.selectTool(2)),
    makeButton("hvp-tool-sphere","3: Kugel",()=>options.actions.selectTool(3)),
    makeButton("hvp-save","Spielstand speichern",()=>options.actions.save()),
    makeButton("hvp-load","Spielstand laden",()=>options.actions.load()),
    makeButton("hvp-load-new","Gespeicherte Sitzung neu öffnen",()=>options.actions.loadNewSession()),
    makeButton("hvp-reset-camera", "Reset view", () => options.actions.resetCamera()),
    waterButton,
    inspectButton,
    aoButton,
    pauseButton,
    dropButton,
    hideButton
  );
  updateWaterButton();
  updateInspectButton();
  updateAoButton();

  const setPanelsVisible = (visible: boolean): void => {
    uiVisible = visible;
    hideButton.textContent = visible ? "Hide UI" : "Show UI";
    hideButton.setAttribute("aria-pressed", visible ? "false" : "true");
    root.dataset.ui = visible ? "on" : "off";
    documentPort.body.dataset.hestiaPrototypeHud = visible ? "visible" : "hidden";
    const hideable: Element[] = [...hideablePanels];
    for (let index = 0; index < controls.children.length; index += 1) {
      const child = controls.children[index]!;
      if (child !== hideButton) {
        hideable.push(child);
      }
    }
    for (const panel of hideable) {
      if (visible) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    }
  };
  listeners.add(hideButton,"click", () => {
    setPanelsVisible(!uiVisible);
  });

  hideablePanels.push(neighborValue);
  root.append(title, stateValue, modeValue, detailValue, physicsValue, toolValue,saveValue,neighborValue, controls);
  options.host.append(root);
  updateSave();

  return {
    updatePhysics,
    updateSave,
    update(state, pose, stats, detail = ""): void {
      if (disposed) return;
      const body = documentPort.body;
      body.dataset.hestiaPrototype = "1";
      body.dataset.hestiaPrototypeState = state;
      body.dataset.hestiaPrototypeCamera = pose.preset;
      body.dataset.hestiaPrototypeFaces = String(stats.faces);
      updateWaterButton();
      updateInspectButton();
      updateAoButton();
      root.dataset.state = state;
      root.dataset.camera = pose.preset;
      stateValue.textContent = `State: ${state}`;
      modeValue.textContent = `Camera: ${pose.preset} (${pose.mode})`;
      detailValue.textContent = detail === ""
        ? `Terrain faces: ${stats.faces} · vertices: ${stats.vertices} · triangles: ${stats.triangles} · scene: ${stats.sceneFaces} voxel quads / ${stats.sceneTriangles} total tris (coast+flora+sky)`
        : detail;
    },
    get listenerCount(){return listeners.size;},
    dispose(): void {
      listeners.dispose();
      if (disposed) return;
      disposed = true;
      root.remove();
      goalPanel.remove();
      interaction.remove();reticle.remove();
    }
  };
};
