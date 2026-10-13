import type { HvpCameraPose, HvpCameraPreset } from "./hvpCamera";
import type { HvpPhysicsClient } from "../hestia-prototype/physics/client";
import type { createHvpPlasmaTool } from "../hestia-prototype/terrain/plasmaTool";
import {createHvpListeners} from "../hestia-prototype/runtime/listeners";
import type {createHvpSalvageLoop} from "../hestia-prototype/gameplay/salvageLoop";
import type {createHvpNeighborController} from "../hestia-prototype/runtime/neighborController";
import type {createHvpDormancyController} from "../hestia-prototype/runtime/dormancyController";
import type {HvpImpulseTarget} from "../hestia-prototype/physics/session";

/** Legacy tool/mission messages are presentation only; source identities and checkpoints remain unchanged. */
const legacyHvpText: Readonly<Record<string, string>> = Object.freeze({
  "Spielen: 1 Zelle · 2 Box · 3 Kugel · Linksklick": "Play: 1 cell · 2 box · 3 sphere · left click",
  "Loses Fragment: Linksklick schneidet erneut (auch nach dem Fallen)": "Detached fragment: left click to cut again, including after falling",
  "Bergung: markierte Verbindung · 1 Zelle": "Salvage: marked joint · 1 cell",
  "Holz: Box 0,5 m · verankerten Ast trennen": "Wood: 0.5 m box · detach the anchored branch",
  "Keine bestätigte Zellabdeckung": "Cell coverage unconfirmed",
  "Kein Ziel innerhalb 4 m": "No target within 4 m",
  "Andere Mutation Pending": "Another world change is pending",
  "Zelle": "Cell", "Box 0,5 m": "Box 0.5 m", "Kugel 0,25 m": "Sphere 0.25 m",
  "Bergungsplatz erreichen": "Reach the salvage site",
  "Markierte Verbindung schneiden": "Cut the marked joint",
  "Mit etwas Abstand per F in die blaue Ablage schieben": "Stand back and use F to push it into the blue depot",
  "Spielstand sichern": "Save your game",
  "Bergung gesichert. Neuer Durchlauf über bestätigten Neustart.": "Salvage secured. Use the confirmed restart to begin again."
});
const englishHvpText = (value: string): string => {
  if (Object.hasOwn(legacyHvpText, value)) return legacyHvpText[value]!;
  const key = /^Holz: Taste ([12])$/.exec(value);
  if (key) return `Wood: key ${key[1]}`;
  const cells = /^(\d+) Zellen · sicherer Steinbruch$/.exec(value);
  if (cells) return `${cells[1]} cells · safe quarry`;
  const support = /^(\d+) Stützzellen · Zusammenhang wird vor Commit geprüft$/.exec(value);
  if (support) return `${support[1]} support cells · connectivity checked before commit`;
  return value;
};

export const describeHvpImpulseTarget=(target:HvpImpulseTarget|undefined):string=>{
  const name=target?.target==="hvp:physics:inertia"?"L-shaped wood body":target?.target==="hvp:physics:drop"?"Stone cube":"Movable body";
  switch(target?.kind){
    case "Dynamic":return `${name} · ${target.massKg!.toFixed(1)} kg · ${target.distanceMeters!.toFixed(1)} m · Tap F: push forward`;
    case "Fixed":return "Fixed object – F pushes only detached bodies, not terrain or anchored trees.";
    case "Cooldown":return "Wait briefly – one push every 0.25 seconds.";
    case "SpeedLimit":return "Speed limit reached – no further push.";
    case "Busy":return "World updating – please wait.";
    case "NotPlaying":return "Select Play and capture the mouse, then aim at a detached body.";
    default:return "No hit within 4 m – move closer to a detached body.";
  }
};
export const describeHvpImpulseResult=(reason:string|undefined):string=>{
  switch(reason){
    case "Solver contact impulse":return "Impulse applied. Heavier bodies move less under the same force.";
    case "Contact is not dynamic":return "No push: the target is still anchored.";
    case "No contact within 4 m":return "No push: no body hit within 4 m.";
    case "Player is not running":return "No push: resume play first.";
    case "Cooldown 250 ms":return "No further push: release the key and press again.";
    case "Speed budget":return "No push: speed limit reached.";
    case "Invalid aim":return "No push: aim direction not confirmed yet.";
    default:return "F pushes in your aim direction; it does not grab or pull an object.";
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
  /** Optional presentation of confirmed host observations; carries no action or world authority. */
  readContextHint?():Readonly<{target:string;feedback:string;cut:string;keys:string}>|undefined;
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

export const createHvpHud = (options: HvpHudOptions): HvpHud => {
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
  interaction.setAttribute("aria-label","Target and physics push");
  interaction.setAttribute("style","position:fixed;bottom:22px;left:50%;transform:translateX(-50%);max-width:650px;padding:8px 14px;background:#12252be8;color:#f2f4ec;font:14px/1.45 system-ui;text-align:center;pointer-events:none;z-index:19");
  const targetValue=documentPort.createElement("div");targetValue.id="hvp-interaction-target";
  const feedback=documentPort.createElement("div");feedback.id="hvp-interaction-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
  const cutFeedback=documentPort.createElement("div");cutFeedback.id="hvp-cut-feedback";cutFeedback.setAttribute("role","status");cutFeedback.setAttribute("aria-live","polite");
  const defaultKeys="1/2/3 + left click: cut at admitted locations · V: view · Esc: pause / overview";
  const keysValue=documentPort.createElement("div");keysValue.textContent=defaultKeys;
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
      physicsValue.textContent = `Physics error: ${error instanceof Error ? error.message : String(error)}`;
    });
  };
  const pauseButton = makeButton("hvp-physics-pause", "Pause physics", () => {
    command(options.actions.readPhysics().status === "Running" ? "Pause" : "Resume");
  });
  const dropButton = makeButton("hvp-physics-drop", "Restart falling body", () => command("Drop"));
  const viewButton = makeButton("hvp-player-view", "View: first person (V)", () => options.actions.togglePlayerView());
  const goalPanel=documentPort.createElement("section");goalPanel.id="hvp-salvage-panel";goalPanel.setAttribute("aria-label","Salvage objective");
  goalPanel.setAttribute("style","position:fixed;right:16px;top:16px;max-width:290px;padding:12px;background:#12252be8;color:#f2f4ec;font:14px/1.5 system-ui;z-index:20");
  const goalTitle=documentPort.createElement("strong"),goalText=documentPort.createElement("p"),goalSteps=documentPort.createElement("div");
  goalText.id="hvp-salvage-instruction";goalText.setAttribute("role","status");goalTitle.textContent="Salvage objective";
  const goalPlay=makeButton("hvp-salvage-play","Play",()=>options.actions.play());
  const goalSave=makeButton("hvp-salvage-save","Save salvage",()=>options.actions.save());
  const goalRestart=makeButton("hvp-salvage-restart","New objective",()=>options.actions.restartSalvage());
  goalPanel.append(goalTitle,goalText,goalSteps,goalPlay,goalSave,goalRestart);options.host.append(goalPanel);goalPanel.hidden=true;
  const updateSave = () => {
    const save=options.actions.readSave();saveValue.textContent=`Save: ${save.state} · ${save.message}${save.revision===null?"":` · r${save.revision}`}`;
    documentPort.body.dataset.hestiaPrototypeSave=JSON.stringify(save);
    for(const child of Array.from(controls.children)){if(child!==hideButton){(child as HTMLButtonElement).disabled=["Saving","Loading","RecoveryHold"].includes(save.state);}}
    for(const b of [goalPlay,goalSave,goalRestart]){b.disabled=["Saving","Loading","RecoveryHold"].includes(save.state);}
    return save;
  };
  const updatePhysics = (): void => {
    updateSave();
    const tool=options.actions.readTool();
    toolValue.textContent=`Plasma cutter: ${englishHvpText(tool.mode!)} · ${tool.state} · ${englishHvpText(tool.last?.reason??tool.message)} · 1/2/3, left click · Terrain: safe quarry / wood: branch`;
    viewButton.textContent = options.actions.readThirdPerson() ? "View: third person (V)" : "View: first person (V)";
    const state = options.actions.readPhysics();
    const neighbor=options.actions.readNeighbor();
    neighborValue.textContent=neighbor?`East region: ${neighbor.state}${neighbor.busy?" (Pending)":""} · LOD ${neighbor.renderLod??neighbor.lod} m${neighbor.proxyOnly?" (Checkpoint projection)":""} · Collision ${neighbor.collisionReady?"ready":"missing"}${neighbor.error?` · ${neighbor.error}`:""}`:"";
    const dormancy=options.actions.readDormancy();
    if(dormancy){neighborValue.textContent+=` · Dormant fragments: ${options.actions.readPhysics().parked?.length??0}${dormancy.busy?" (Pending)":""}${dormancy.error?` · ${dormancy.error}`:""}`;}
    const goal=options.actions.readSalvage();goalPanel.hidden=goal===null||!uiVisible;
    // Keep the real player objective separate from the inspection/diagnostic panel.
    const playing=state.player?.status==="Walking";
    root.hidden=playing;
    interaction.hidden=!playing||!uiVisible;
    const aim=options.actions.readAimScreen();reticle.hidden=!playing||!uiVisible||!aim.visible;
    reticle.style.left=`${aim.x}%`;reticle.style.top=`${aim.y}%`;
    reticle.style.background=state.impulseTarget?.kind==="Dynamic"?"#9ce8bf":"#f2f4ec";
    const context=options.actions.readContextHint?.();
    const targetText=context?.target??describeHvpImpulseTarget(state.impulseTarget);
    if(targetValue.textContent!==targetText){targetValue.textContent=targetText;}
    const resultText=context?.feedback??((state.lastImpulse?"Last attempt: ":"")+describeHvpImpulseResult(state.lastImpulse?.reason));
    if(feedback.textContent!==resultText){feedback.textContent=resultText;}
    const cutStates=[tool.state,tool.structural?.state,tool.moving?.state];
    const cutText=context?.cut??(cutStates.includes("RecoveryHold")?"Cut on hold: recovery unconfirmed."
      :cutStates.includes("Pending")?"Cutting … preparing connectivity, geometry and collision."
        :`${englishHvpText(tool.mode!)} · left click: ${englishHvpText(tool.message)}`);
    if(cutFeedback.textContent!==cutText){cutFeedback.textContent=cutText;}
    const keys=context?.keys??defaultKeys;if(keysValue.textContent!==keys)keysValue.textContent=keys;
    if(goal){
      goalText.textContent=goal.targetLost?"Salvage piece changed or lost. Load a save or start a new objective.":englishHvpText(goal.instruction!);
      goalSteps.textContent=`${goal.mission.objectiveStates.filter(o=>o.state==="Completed").length}/4 · WASD / Space · 1 + click: joint · F: push · Esc: pause`;
      goalPlay.hidden=state.player?.status==="Walking"||goal.stage==="Save"||goal.stage==="Completed";
      goalSave.hidden=goal.stage!=="Save";
    }
    if(state.inertia) { toolValue.textContent+=` · F: push (4 m / 15 N·s) · ${state.lastImpulse?.reason??"L-shaped body ready"}`; }
    if(state.structural) {toolValue.textContent+=` · Branch: ${tool.structural?.last?.status??state.structural.state} · ${tool.structural?.last?.reason??`Key ${state.structural.cutEdge===1?1:2} + left click`}`;}
    if(state.moving){toolValue.textContent+=` · Fragment: ${tool.moving?.last?.status??tool.moving?.state??state.moving.state} · ${tool.moving?.last?.reason??"1 cell / 2 box / 3 sphere: cut again"}`;}
    const support=options.actions.readSupport();
    if(support.state!=="Idle"){toolValue.textContent+=` · Support preview: ${support.state} · ${support.fragments} parts / ${support.cells} cells / ${support.massKg.toFixed(2)} kg · ${support.message}`;}
    pauseButton.textContent = state.status === "Running" ? "Pause physics" : "Resume physics";
    const drop = state.bodies[0];
    physicsValue.textContent = `Physics: ${state.status} · ${state.bodyCount} bodies / ${state.colliderCount} colliders · g=${state.gravity.toFixed(2)} m/s²`
      + (drop === undefined ? "" : ` · Drop height y=${drop.position.y.toFixed(2)} m`);
    if (state.player != null) {
      physicsValue.textContent += ` · Player: ${state.player.status}${state.player.grounded ? " (Ground)" : ""}`;
      modeValue.textContent = state.player.status === "Inspection"
        ? `Camera: ${documentPort.body.dataset.hestiaPrototypeCamera} (${options.actions.readInspectEnabled() ? "Fly" : "Orbit"})`
        : `Player: ${state.player.status} · ${options.actions.readThirdPerson() ? "Third Person" : "First Person"} · 1.80 m`;
    }
    const inputError = documentPort.body.dataset.hestiaPrototypeInputError;
    if (inputError !== undefined) { physicsValue.textContent += ` · ${inputError}`; }
  };
  controls.append(
    makeButton("hvp-end-session","End session",()=>options.actions.endSession()),
    makeButton("hvp-play", "Play · WASD / mouse / Space", () => options.actions.play()),
    viewButton,
    makeButton("hvp-camera-eye", "C01-EYE", () => options.actions.setPreset("C01-EYE")),
    makeButton("hvp-camera-shore", "C02-SHORE", () => options.actions.setPreset("C02-SHORE")),
    makeButton("hvp-camera-roots", "C03-ROOTS", () => options.actions.setPreset("C03-ROOTS")),
    makeButton("hvp-camera-wide", "C04-WIDE", () => options.actions.setPreset("C04-WIDE")),
    makeButton("hvp-camera-rockarm", "C05-ROCKARM", () => options.actions.setPreset("C05-ROCKARM")),
    makeButton("hvp-support-preview", "Check rock-arm support (no cut)", () => options.actions.previewSupport()),
    makeButton("hvp-aim-rock", "Aim at support (2 + click)", () => options.actions.aimRock()),
    makeButton("hvp-restart-rock", "Restart: rock arm", () => options.actions.restartRock()),
    makeButton("hvp-restart-salvage","New salvage objective",()=>options.actions.restartSalvage()),
    makeButton("hvp-restart-east","Restart: east path",()=>options.actions.restartEast()),
    makeButton("hvp-neighbor-retry","Retry east region",()=>options.actions.retryNeighbor()),
    makeButton("hvp-camera-quarry", "View: cut location", () => options.actions.setPreset("C07-QUARRY")),
    makeButton("hvp-aim-inertia", "Aim at L-shaped body (F)", () => options.actions.aimImpulse()),
    makeButton("hvp-aim-branch", "Aim at branch (2 + click)", () => options.actions.aimBranch()),
    makeButton("hvp-tool-cell","1: Cell",()=>options.actions.selectTool(1)),
    makeButton("hvp-tool-box","2: Box",()=>options.actions.selectTool(2)),
    makeButton("hvp-tool-sphere","3: Sphere",()=>options.actions.selectTool(3)),
    makeButton("hvp-save","Save game",()=>options.actions.save()),
    makeButton("hvp-load","Load game",()=>options.actions.load()),
    makeButton("hvp-load-new","Reopen saved session",()=>options.actions.loadNewSession()),
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
  let disposed = false;

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
