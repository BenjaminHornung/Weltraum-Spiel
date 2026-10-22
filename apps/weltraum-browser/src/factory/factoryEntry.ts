import { englishFactoryText } from "./ui/english";
import { materializeFactoryStartSiteV6,readFactorySourceColumnWorldV6 } from "./fixtures/startSiteV6";
import { createFactoryBuildTool } from "./ui/buildTool";
import { readMaterialMassMg } from "./material/resourcesAdapter";
import {createFactoryPanel, uiText} from "./ui/cargoPanel";
import {factoryItemIcon} from "./ui/itemVisuals";
import {mountFactoryShell,type FactoryShellPort,type FactoryShellView} from "./ui/factoryShell";
import "../style.css";
import { startHvp, type HvpBootstrapHandle } from "../hvp/hvpBootstrap";
import { createHvpMeasurements } from "../hestia-prototype/runtime/measurements";
import { createFp02CatalogInput, loadFactoryCatalog } from "./catalog/fp02Catalog";
import { mountCompactFactorySession, type FactorySessionView } from "./session/factorySession";
import type { FactoryHostExtension } from "./session/hostPort";

const extension: FactoryHostExtension = async (host,restore,owner) => {
  // Initialize exactly one finite source-bound Cargo view; objects remain uninstalled until the player confirms a paid build.
  const catalog = loadFactoryCatalog(createFp02CatalogInput());
  const session = await mountCompactFactorySession(host, catalog,restore,owner);
  const onboardingMeasurement=createHvpMeasurements(new URLSearchParams(window.location.search).get("hvpMeasure")==="1");
  const sessionBinding=session.read();
  let disposed = false;
  const cleanupStack:Array<()=>void|Promise<void>>=[()=>session.dispose()];
  const disposeExtension=async()=>{
    if(disposed)return;disposed=true;const failures:unknown[]=[];
    for(const cleanup of cleanupStack.reverse())try{await cleanup();}catch(error){failures.push(error);}
    if(failures.length)throw new Error(`Factory extension cleanup failed: ${failures.map(String).join("; ")}`);
  };
  cleanupStack.push(()=>{
    const owns=(value:string|undefined)=>{if(!value)return false;try{const projection=JSON.parse(value);return projection.sessionId===sessionBinding.sessionId&&projection.epoch===sessionBinding.epoch;}catch{return false;}};
    if(owns(document.body.dataset.hestiaFactoryClock)||owns(document.body.dataset.hestiaFactoryUi)){
      delete document.body.dataset.hestiaFactory;delete document.body.dataset.hestiaFactoryClock;
      delete document.body.dataset.hestiaFactoryConstruction;delete document.body.dataset.hestiaFactoryUi;
    }
  });
  try {
  const panel = document.createElement("section");
  cleanupStack.push(()=>panel.remove());
  panel.id = "factory-panel"; panel.setAttribute("aria-label", "Workshop");
  const title = document.createElement("strong"); title.textContent = "Build";
  const status = document.createElement("p"); status.id = "factory-status"; status.setAttribute("role", "status");
  const note = document.createElement("p"); note.textContent = "Choose a build preview. Arrow keys move it by 25 cm; R rotates it. Transport heavy chassis first, set them down safely and step outside the machine footprint. Confirming a build uses accessible finite cargo.";
  let lastBuildProjection="", browseBuild = false;
  const buildDirectory = document.createElement("div"); buildDirectory.className = "factory-build-directory";
  const buildPreview = document.createElement("section"); buildPreview.className = "factory-build-preview";
  const previewTitle = uiText(document, "h2", ""), previewState = uiText(document, "p", ""); previewState.className = "factory-machine-state";
  const costs = document.createElement("dl"), costLabel = uiText(document, "dt", "Kit"), costValue = uiText(document, "dd", ""), gridLabel = uiText(document, "dt", "Build grid"), gridValue = uiText(document, "dd", "0.25 m");
  costs.append(costLabel, costValue, gridLabel, gridValue); buildPreview.append(previewTitle, previewState, costs);
  const browse = document.createElement("button"); browse.type = "button"; browse.textContent = "Choose another facility"; browse.addEventListener("click", () => { browseBuild = true; updateBuild(); });
  let refreshShell=()=>{};
  const construction=session.construction,tool=construction?createFactoryBuildTool(construction):undefined;
  const buildStatus=document.createElement("p");buildStatus.id="factory-build-status";buildStatus.setAttribute("role","status");
  const buildButtons:HTMLButtonElement[]=[];
  const button=(label:string,id:string,action:()=>void)=>{const value=document.createElement("button");value.type="button";value.textContent=label;value.id=id;value.setAttribute("style","margin:4px;padding:6px");value.addEventListener("click",action);buildButtons.push(value);return value;};
  const updateBuild=()=>{if(!construction||!tool)return;const state=construction.read(),ghost=tool.read();
    const cargo=host.construction?.readFacts().cargoAccess;
    const key=JSON.stringify([cargo?.opened,cargo?.accessible,state.state,state.material.revision,ghost?.request??null,ghost?.placement.status??null,ghost?.placement.status==="Rejected"?ghost.placement.reason:null,browseBuild,construction.busy,host.read().confirmed,host.read().physicsStatus]);if(key===lastBuildProjection)return;lastBuildProjection=key;
    document.body.dataset.hestiaFactoryConstruction=JSON.stringify({cargo,state:state.state,installations:state.installations,revision:state.material.revision,massMg:readMaterialMassMg(state.material),containers:state.material.containers.map(value=>({containerId:value.state.containerId,massKg:value.currentMassKg,contents:value.state.contents})),reservations:state.material.reservations.length,ghost:ghost?{request:ghost.request,status:ghost.placement.status,reason:ghost.placement.status==="Rejected"?ghost.placement.reason:null}:null});
    const sourceId = ghost?.request.definitionSourceId;
    const device = catalog.devices.find(d => d.sourceId === sourceId), item = catalog.items.find(i => i.sourceId === sourceId);
    const mass = device?.massMg ?? (item?.quantityBasis === "piece" ? item.massMgPerUnit : null);
    const labels: Record<string, string> = { B06: "Cutter", B07: "Former", B09: "Storage", B05: "Workbench" };
    const reasons: Record<string, string> = { OUT_OF_REACH: "Build site out of reach", CARGO_CLOSED: "Open the wreck cargo first", ACTOR_OVERLAP: "Step outside the machine footprint", SUPPORT: "Ground does not support this facility yet" };
    buildDirectory.hidden = Boolean(ghost) && !browseBuild; buildPreview.hidden = !ghost;
    browse.hidden = !ghost || browseBuild; rotate.hidden = cancel.hidden = confirm.hidden = !ghost;
    if (ghost) {
      previewTitle.textContent = sourceId && Object.hasOwn(labels, sourceId) ? labels[sourceId]! : englishFactoryText(item?.displayName ?? "Facility");
      previewState.textContent = ghost.placement.status === "Prepared" ? "Placement verified · kit admitted" : ghost.placement.reason && Object.hasOwn(reasons, ghost.placement.reason) ? reasons[ghost.placement.reason]! : "Placement rejected · material is retained";
      costValue.textContent = mass === null ? "Not confirmed yet" : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 6 }).format(mass / 1_000_000)} kg`;
    }
    confirm.disabled = !ghost || ghost.placement.status !== "Prepared" || construction.busy || state.state !== "Ready" || !host.read().confirmed || host.read().physicsStatus !== "Paused";
    rotate.disabled = cancel.disabled = !ghost || construction.busy;
    buildStatus.textContent=state.state==="RecoveryHold"?"Build on hold · Recovery required":ghost?ghost.placement.status==="Prepared"?`Ready to build · ${ghost.placement.installation.massMg/1_000_000} kg components · All material retained`:previewState.textContent:`${state.installations.length} installed objects · ${readMaterialMassMg(state.material)/1_000_000} kg total material`;
  };
  const projectGhost=()=>{host.construction?.projectGhost(tool?.read()?.request??null);updateBuild();};
  const choose=async(sourceId:string,centerMm:readonly number[],turns:number)=>{browseBuild=false;try{await host.pause();if(disposed)return;tool?.select({transactionId:`build_${sourceId.toLowerCase().replaceAll(".","_")}_${construction!.read().material.revision}`,instanceId:`facility_${sourceId.toLowerCase().replaceAll(".","_")}_${construction!.read().material.revision}`,definitionSourceId:sourceId,centerMm,quarterTurns:turns});projectGhost();}catch(error){buildStatus.textContent=`Build on hold · ${String(error)}`;}};
  const cutter=button("Preview cutter","factory-build-cutter",()=>{void choose("B06",[-7250,1500,5000],1);});
  const battery=button("Preview battery","factory-build-battery",()=>{void choose("fp02.device.battery_4kwh",[-2250,1500,2500],1);});
  const distributor=button("Preview distributor","factory-build-distributor",()=>{void choose("fp02.device.distribution_40kw",[-4750,1500,5250],1);});
  const former=button("Preview former","factory-build-former",()=>{void choose("B07",[-7250,1500,-2500],1);});
  const rawStorage=button("Preview raw storage","factory-build-raw-storage",()=>{void choose("B09",[-7250,1500,11500],1);});
  const productStorage=button("Preview product storage","factory-build-product-storage",()=>{void choose("B09",[-7250,1500,-5500],1);});
  const bench=button("Preview workbench","factory-build-bench",()=>{void choose("B05",[-10250,1500,5500],1);});
  const brace=button("Place new brace","factory-build-brace",()=>{void choose("fp02.comp.small_brace",[-8750,1500,5500],1);});
  const rotate=button("Rotate preview","factory-build-rotate",()=>{tool?.rotate();projectGhost();});
  const cancel=button("Cancel preview","factory-build-cancel",()=>{tool?.cancel();projectGhost();});
  const confirm=button("Confirm build","factory-build-confirm",()=>{void (async()=>{const result=await tool?.confirm();projectGhost();if(result?.status!=="Committed")buildStatus.textContent=`Build on hold · ${result?.reason}`;})();});
  const onBuildKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null,surface=host.read().input?.surface;if((surface&&surface!=="build")||(!surface&&session.ui.read().focusedPanel)||target?.closest?.("input,select,textarea,[contenteditable=true]"))return;if(!tool?.read()||construction?.busy)return;if(event.key==="Escape"){event.preventDefault();tool.cancel();}else if(event.key.toLowerCase()==="r"){event.preventDefault();tool.rotate();}else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();tool.move(event.key==="ArrowLeft"?-1:event.key==="ArrowRight"?1:0,event.key==="ArrowUp"?-1:event.key==="ArrowDown"?1:0);}else return;projectGhost();};
  document.addEventListener("keydown",onBuildKey);
  cleanupStack.push(()=>document.removeEventListener("keydown",onBuildKey));
  if(!tool)buildButtons.forEach(value=>{value.disabled=true;});
  const project = (view: FactorySessionView) => {
    if (disposed || !host.current()) return;
    document.body.dataset.hestiaFactory = "1";
    document.body.dataset.hestiaFactoryClock = JSON.stringify(view);
    const native = host.read(), paused = native.physicsStatus === "Paused";
    const available = view.state === "Ready" && native.confirmed;
    status.textContent = available ? `Workshop ready · ${paused ? "Paused" : "Active"}`
      : view.state === "RecoveryHold" ? "Workshop on hold · check session recovery" : "Workshop waiting · simulation on hold";
    updateBuild();
    refreshShell();
  };
  const buildIcons = ["fp02.chassis.cutter", "fp02.chassis.former", "fp02.device.material_container", "fp02.device.material_container", "fp02.device.field_workbench", "fp02.comp.small_brace", "fp02.device.battery_4kwh", "fp02.device.distribution_40kw"];
  [cutter,former,rawStorage,productStorage,bench,brace,battery,distributor].forEach((value, i) => { const label = value.textContent; value.setAttribute("aria-label", label ?? "Facility"); value.replaceChildren(factoryItemIcon(document, buildIcons[i]!, label ?? "Facility"), uiText(document, "span", label ?? "Facility")); buildDirectory.append(value); });
  confirm.setAttribute("aria-describedby", "factory-build-status");
  panel.append(title, status, note,buildDirectory,buildPreview,browse,rotate,cancel,confirm,buildStatus);
  // Reuse the admitted canonical pending/receipt/session/focus lifetime for
  // all Entry actions; unknown replies retain the same request until resolved.
  const actions=createFactoryPanel(session.ui,document,"power","Facility connections and local deliveries");
  cleanupStack.push(()=>actions.dispose());
  const connections=actions.element;connections.id="factory-connections";panel.append(connections);
  const connectionButtons=new Map<string,HTMLButtonElement>();
  actions.start(snapshot=>{
    const choices=[...(snapshot.connections?.power??[]).map(choice=>({kind:"connect-power" as const,choice})),...(snapshot.connections?.belts??[]).map(choice=>({kind:"connect-belt" as const,choice})),...(snapshot.interaction.localDeposits??[]).map(choice=>({kind:"deposit" as const,choice:{...choice,id:choice.target.id}}))].filter(c=>!["connect-power"].includes(c.kind));
    const portLabel=(id:string)=>{
      const device=snapshot.power.devices?.find(d=>id===`power_${d.id}`);if(device)return englishFactoryText(device.name);
      const machine=snapshot.machines.find(m=>m.ports.some(p=>p.id===id));if(machine){const port=machine.ports.find(p=>p.id===id)!;return `${englishFactoryText(machine.name)} · ${port.role==="SolidBatchIn"?"Input":port.role==="SolidBatchOut"?"Output":"Power"}`;}
      const owner=host.handling?.read().solidPorts?.find(p=>p.portId===id),storage=snapshot.inventory.find(c=>c.id===`storage_${owner?.instanceId}`);
      return storage?`Storage ${snapshot.inventory.filter(c=>c.role===storage.role).findIndex(c=>c.id===storage.id)+1}`:"Port";
    };
    const targetLabel=(id:string)=>{const target=snapshot.inventory.find(c=>c.id===id),machine=snapshot.machines.find(m=>m.inputContainerId===id);
      return machine?`Input · ${englishFactoryText(machine.name)}`:target?`Storage ${snapshot.inventory.filter(c=>c.role===target.role).findIndex(c=>c.id===id)+1}`:"Storage";};
    for(const value of connectionButtons.values())value.hidden=true;
    for(const {kind,choice} of choices){const id=`${kind}_${choice.id}`;let value=connectionButtons.get(id);
      if(!value){value=document.createElement("button");value.type="button";value.dataset.factoryConnection=id;value.setAttribute("style","display:block;margin:4px;padding:6px");
        value.addEventListener("click",()=>{
          const current=session.ui.read();if(actions.busy)return;
          if(kind==="connect-power"){const option=current.connections?.power.find(p=>p.id===choice.id);if(option?.capability.enabled&&option.cableLot)actions.submit({kind,sourcePortId:option.sourcePortId,targetPortId:option.targetPortId,cableLot:option.cableLot});}
          else if(kind==="connect-belt"){const option=current.connections?.belts.find(p=>p.id===choice.id);if(option?.capability.enabled)actions.submit({kind,sourcePortId:option.sourcePortId,targetPortId:option.targetPortId,sourceLots:option.sourceLots});}
          else{const option=current.interaction.localDeposits?.find(p=>p.target.id===choice.id),handling=current.interaction.handling;if(option?.capability.enabled&&handling)actions.submit({kind,handling:{id:handling.id,revision:handling.revision},target:{kind:"container",container:option.target}});}
        });actions.content.append(value);connectionButtons.set(id,value);
      }
      value.hidden=false;value.disabled=actions.busy||!choice.capability.enabled;value.title=choice.capability.reason??"";
      value.textContent=kind==="connect-power"&&"lengthMm" in choice?`Power: ${portLabel(choice.sourcePortId)} → ${portLabel(choice.targetPortId)} · ${choice.lengthMm/1000} m`:kind==="connect-belt"&&"sourcePortId" in choice?`Belt: ${portLabel(choice.sourcePortId)} → ${portLabel(choice.targetPortId)} · 4 m`:`Deposit entire load · ${"target" in choice?targetLabel(choice.target.id):"Storage"}`;
    }
  });
  let started=Boolean(restore),shellRevision=0,uiView=session.ui.read(),lastShellKey="";
  const shellListeners=new Set<(view:FactoryShellView)=>void>();
  const readShell=():FactoryShellView=>{
    const native=host.read(),input=native.input,facilities=host.handling?.read();
    const hold=uiView.state==="RecoveryHold"||!["Running","Paused"].includes(native.physicsStatus);
    const playing=Boolean(input?.active&&input.pointerLocked&&!input.activationPending&&native.confirmed);
    const available=native.confirmed&&session.isQuiescent()&&!input?.activationPending;
    const persistence=native.persistence;
    const saveAvailable=persistence?.saveAvailable===true&&session.canBeginFactoryCheckpoint();
    const continueAvailable=persistence?.continueAvailable===true&&Boolean(host.continueSession);
    const saveReason=persistence?.saveAvailable===true?"Pause with neutral input and wait for Factory operations to finish":persistence?.message??"Combined Factory save is not connected yet";
    const continueReason=persistence?.continueAvailable===true&&!host.continueSession?"Continue is not connected yet":persistence?.message??"No confirmed combined factory save is available yet";
    const cap=(enabled:boolean,reason:string)=>Object.freeze({enabled,reason:enabled?null:reason});
    const veto=facilities?.lastCarrierVeto?.reason??null;
    const reasons:Record<string,string>={CarrierSupport:"Cargo needs full support on level ground",CarrierOverlap:"Obstacle in transport path",CarrierSweep:"Obstacle in transport path",CarrierCoverage:"Transport ground not confirmed yet",CarrierGroundHeight:"Transport needs level ground"};
    const interaction=uiView.interaction.handling?"WASD: move cargo · E: Cargo/transport while playing · I: inventory · Escape: pause · Cargo: set down or deliver locally":uiView.interaction.cargoAccessible?"Wreck cargo accessible · E: Cargo while playing · I: inventory · Open cargo":playing?"WASD: walk · B: build · M: map · E: Cargo when reachable · I: inventory · Escape: pause":"Select Play to capture the mouse and enable movement · I: inventory";
    const lifecycleStatus=input?.error??(hold?(native.physicsStatus==="SimulationHold"?"Session interrupted. Confirmed work and cargo are retained. Recover, then select Play.":`Session on hold · ${native.physicsStatus}`):input?.pausePending?"Pause confirmation pending":input?.activationPending?"Play confirmation pending":playing?"Playing":native.physicsStatus==="Paused"?"Session paused":"Input blocked · confirming pause");
    const statusText=persistence&&persistence.state!=="Idle"?`${lifecycleStatus} · ${persistence.message}`:lifecycleStatus;
    const onboardingStarted=onboardingMeasurement.enabled?performance.now():0;
    const onboarding=session.readOnboarding(native);
    if(onboardingMeasurement.enabled)onboardingMeasurement.record("factoryReadOnboarding",onboardingStarted,performance.now()-onboardingStarted,{calls:1});
    return Object.freeze({sessionId:native.sessionId,epoch:native.epoch,publicationRevision:shellRevision,
      phase:!started?"start":hold?"hold":playing?"playing":"paused",
      statusText,
      capabilities:{recoverSimulation:cap(started&&native.simulationRecoveryAvailable===true&&Boolean(host.recoverSimulationHold),"Session must be ready for recovery"),newSession:cap(!started&&available,"Return to the menu before starting a new session"),continue:cap(continueAvailable,continueReason),play:cap(started&&available&&Boolean(host.play),!started?"Select New game first":"Simulation must be visible, confirmed and available"),pause:cap(started&&!hold&&!input?.pausePending,"Pause is pending or simulation is on hold"),save:cap(saveAvailable,saveReason),endSession:cap(Boolean(host.endSession)&&session.canEndSession?.()===true,"Wait for the current operation before leaving"),settings:cap(false,"Settings are not connected yet")},
      hud:{interactionText:interaction,carrierMassMg:uiView.interaction.handling?.massMg??null,blockReason:veto?reasons[veto]??veto:null,warnings:[]},
      onboarding,map:session.readLocalMap(tool?.read()?.request??null)});
  };
  refreshShell=()=>{
    if(disposed||!host.current())return;
    const view=readShell(),key=JSON.stringify({...view,publicationRevision:0});if(key===lastShellKey)return;lastShellKey=key;shellRevision++;
    const next=Object.freeze({...view,publicationRevision:shellRevision});for(const listener of shellListeners)listener(next);
  };
  const shellPort:FactoryShellPort={isCurrent:host.current,read:readShell,subscribe:listener=>{shellListeners.add(listener);return()=>shellListeners.delete(listener);},
    setSurface:(surface,binding)=>{if(disposed||!host.current())return;host.setSurface?.(surface,binding);refreshShell();},
    dispatch:async command=>{
      const native=host.read();
      // Opening the modal already requests native Pause. Its same-lifetime
      // explicit Pause action may await that transition instead of treating
      // our own pausePending capability as a rejection.
      const ownPause=command.kind==="pause"&&started&&uiView.state!=="RecoveryHold"
        &&["Running","Paused"].includes(native.physicsStatus)&&(native.input?.pausePending||native.physicsStatus==="Paused");
      if(disposed||!host.current()||command.sessionId!==native.sessionId||command.epoch!==native.epoch
        ||(readShell().capabilities[command.kind]?.enabled!==true&&!ownPause))throw Error("Factory shell command unavailable or stale");
      if(command.kind==="recoverSimulation")await host.recoverSimulationHold!();
      else if(command.kind==="play"){const activation=host.play!();refreshShell();await activation;}
      else if(command.kind==="pause")await host.pause();
      else if(command.kind==="newSession"){await host.pause();started=true;}
      else if(command.kind==="save")await host.save!();
      else if(command.kind==="continue")host.continueSession!();
      else if(command.kind==="endSession")await host.endSession!();
      else throw Error("Factory lifecycle capability unavailable");
      if(!disposed&&host.current())refreshShell();
    }};
  const shell=mountFactoryShell({port:shellPort,uiPort:session.ui,buildPanel:panel,connectionsPanel:connections,
    cancelBuildPreview:()=>{if(!tool?.read()||construction?.busy)return false;tool.cancel();projectGhost();return true;}});
  cleanupStack.push(()=>shell.dispose());
  document.querySelector("#app")!.append(shell.element);
  const uiUnsubscribe=session.ui.subscribe(snapshot=>{uiView=snapshot;document.body.dataset.hestiaFactoryUi=JSON.stringify(snapshot);refreshShell();});
  cleanupStack.push(uiUnsubscribe);
  document.body.dataset.hestiaFactoryUi=JSON.stringify(uiView);
  const unsubscribe = session.subscribe(project);
  cleanupStack.push(unsubscribe);
  const unsubscribeHost = host.subscribeConfirmed(() => { project(session.read()); });
  cleanupStack.push(unsubscribeHost);
  project(session.read());
  cleanupStack.push(()=>shellListeners.clear());
  return Object.freeze({ isQuiescent: session.isQuiescent,canBeginFactoryCheckpoint:session.canBeginFactoryCheckpoint,beginFactoryCheckpoint:session.beginFactoryCheckpoint,readFactoryCheckpointMemory:session.readFactoryCheckpointMemory, canRecoverSimulationHold:session.canRecoverSimulationHold,recoverSimulationHold:session.recoverSimulationHold, canEndSession: session.canEndSession, readFactoryPresentation:session.readPresentation, dispose: disposeExtension });
  } catch(error) {
    try{await disposeExtension();}catch(cleanupError){throw new Error(`Factory extension setup failed: ${String(error)}; cleanup failed: ${String(cleanupError)}`);}
    throw error;
  }
};

/** The real HVP mount guard owns exclusivity; there is no parallel renderer/World. */
export const startFactoryEntry = (): Promise<HvpBootstrapHandle> => startHvp({ factoryExtension: extension,createSourceSnapshot:materializeFactoryStartSiteV6,factorySourceProfile:{version:"hvp-factory-startsite-v6",readColumn:readFactorySourceColumnWorldV6} });
void startFactoryEntry().catch(error => {
  const status = document.createElement("p"); status.setAttribute("role", "alert");
  status.textContent = `Workshop could not start: ${String(error)}`; document.body.append(status);
});
