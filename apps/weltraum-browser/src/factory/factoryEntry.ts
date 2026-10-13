import { materializeFactoryStartSiteV5,readFactorySourceColumnWorldV5 } from "./fixtures/startSite";
import { createFactoryBuildTool } from "./ui/buildTool";
import { readMaterialMassMg } from "./material/resourcesAdapter";
import {createFactoryPanel} from "./ui/cargoPanel";
import {mountFactoryShell,type FactoryShellPort,type FactoryShellView} from "./ui/factoryShell";
import "../style.css";
import { startHvp, type HvpBootstrapHandle } from "../hvp/hvpBootstrap";
import { createFp02CatalogInput, loadFactoryCatalog } from "./catalog/fp02Catalog";
import { mountFactorySession, type FactorySessionView } from "./session/factorySession";
import type { FactoryHostExtension } from "./session/hostPort";

const extension: FactoryHostExtension = async host => {
  // Initialize exactly one finite source-bound Cargo view; objects remain uninstalled until the player confirms a paid build.
  const session = await mountFactorySession(host, loadFactoryCatalog(createFp02CatalogInput()));
  const panel = document.createElement("section");
  panel.id = "factory-panel"; panel.setAttribute("aria-label", "Werkstatt");
  const title = document.createElement("strong"); title.textContent = "Bauen";
  const status = document.createElement("p"); status.id = "factory-status"; status.setAttribute("role", "status");
  const note = document.createElement("p"); note.textContent = "Wähle eine Bauvorschau. Pfeile versetzen um 25 cm, R dreht. Schwere Chassis zuerst transportieren, sicher absetzen und selbst die künftige Maschinenfläche verlassen. Bestätigen bezahlt den Bau aus erreichbarer endlicher Fracht.";
  let disposed = false;
  let lastBuildProjection="";
  let refreshShell=()=>{};
  const construction=session.construction,tool=construction?createFactoryBuildTool(construction):undefined;
  const buildStatus=document.createElement("p");buildStatus.id="factory-build-status";buildStatus.setAttribute("role","status");
  const buildButtons:HTMLButtonElement[]=[];
  const button=(label:string,id:string,action:()=>void)=>{const value=document.createElement("button");value.type="button";value.textContent=label;value.id=id;value.setAttribute("style","margin:4px;padding:6px");value.addEventListener("click",action);buildButtons.push(value);return value;};
  const updateBuild=()=>{if(!construction||!tool)return;const state=construction.read(),ghost=tool.read();
    const cargo=host.construction?.readFacts().cargoAccess;
    const key=JSON.stringify([cargo?.opened,cargo?.accessible,state.state,state.material.revision,ghost?.request??null,ghost?.placement.status??null,ghost?.placement.status==="Rejected"?ghost.placement.reason:null]);if(key===lastBuildProjection)return;lastBuildProjection=key;
    document.body.dataset.hestiaFactoryConstruction=JSON.stringify({cargo,state:state.state,installations:state.installations,revision:state.material.revision,massMg:readMaterialMassMg(state.material),containers:state.material.containers.map(value=>({containerId:value.state.containerId,massKg:value.currentMassKg,contents:value.state.contents})),reservations:state.material.reservations.length,ghost:ghost?{request:ghost.request,status:ghost.placement.status,reason:ghost.placement.status==="Rejected"?ghost.placement.reason:null}:null});
    buildStatus.textContent=state.state==="RecoveryHold"?"Bau angehalten · Wiederherstellung erforderlich":ghost?ghost.placement.status==="Prepared"?`Bau bereit · ${ghost.placement.installation.massMg/1_000_000} kg Bauteile · Material vollständig erhalten`:`Bau nicht möglich · ${ghost.placement.reason}`:`${state.installations.length} installierte Objekte · ${readMaterialMassMg(state.material)/1_000_000} kg Gesamtmaterial`;
  };
  const projectGhost=()=>{host.construction?.projectGhost(tool?.read()?.request??null);updateBuild();};
  const choose=async(sourceId:string,centerMm:readonly number[],turns:number)=>{try{await host.pause();if(disposed)return;tool?.select({transactionId:`build_${sourceId.toLowerCase().replaceAll(".","_")}_${construction!.read().material.revision}`,instanceId:`facility_${sourceId.toLowerCase().replaceAll(".","_")}_${construction!.read().material.revision}`,definitionSourceId:sourceId,centerMm,quarterTurns:turns});projectGhost();}catch(error){buildStatus.textContent=`Bau angehalten · ${String(error)}`;}};
  const cutter=button("Zuschnitt vorschauen","factory-build-cutter",()=>{void choose("B06",[-7250,1500,5000],1);});
  const battery=button("Batterie vorschauen","factory-build-battery",()=>{void choose("fp02.device.battery_4kwh",[-2250,1500,2500],1);});
  const distributor=button("Verteiler vorschauen","factory-build-distributor",()=>{void choose("fp02.device.distribution_40kw",[-2250,1500,2000],1);});
  const former=button("Umformung vorschauen","factory-build-former",()=>{void choose("B07",[-7250,1500,-2500],1);});
  const rawStorage=button("Rohlager vorschauen","factory-build-raw-storage",()=>{void choose("B09",[-7250,1500,11500],1);});
  const productStorage=button("Produktlager vorschauen","factory-build-product-storage",()=>{void choose("B09",[-6250,1500,-5500],1);});
  const bench=button("Werkbank vorschauen","factory-build-bench",()=>{void choose("B05",[-10250,1500,5500],1);});
  const brace=button("Neue Stütze platzieren","factory-build-brace",()=>{void choose("fp02.comp.small_brace",[-8750,1500,5500],1);});
  const rotate=button("Bauvorschau drehen","factory-build-rotate",()=>{tool?.rotate();projectGhost();});
  const cancel=button("Bauvorschau verwerfen","factory-build-cancel",()=>{tool?.cancel();projectGhost();});
  const confirm=button("Bau bestätigen","factory-build-confirm",()=>{void (async()=>{const result=await tool?.confirm();projectGhost();if(result?.status!=="Committed")buildStatus.textContent=`Bau angehalten · ${result?.reason}`;})();});
  const onBuildKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null,surface=host.read().input?.surface;if((surface&&surface!=="build")||(!surface&&session.ui.read().focusedPanel)||target?.closest?.("input,select,textarea,[contenteditable=true]"))return;if(!tool?.read()||construction?.busy)return;if(event.key==="Escape"){event.preventDefault();tool.cancel();}else if(event.key.toLowerCase()==="r"){event.preventDefault();tool.rotate();}else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();tool.move(event.key==="ArrowLeft"?-1:event.key==="ArrowRight"?1:0,event.key==="ArrowUp"?-1:event.key==="ArrowDown"?1:0);}else return;projectGhost();};
  document.addEventListener("keydown",onBuildKey);
  if(!tool)buildButtons.forEach(value=>{value.disabled=true;});
  const project = (view: FactorySessionView) => {
    if (disposed || !host.current()) return;
    document.body.dataset.hestiaFactory = "1";
    document.body.dataset.hestiaFactoryClock = JSON.stringify(view);
    const native = host.read(), paused = native.physicsStatus === "Paused";
    const available = view.state === "Ready" && native.confirmed;
    status.textContent = available ? `Werkstatt bereit · ${paused ? "Pausiert" : "Aktiv"}`
      : view.state === "RecoveryHold" ? "Werkstatt angehalten · Sitzung neu starten" : "Werkstatt wartet · Host angehalten";
    updateBuild();
    refreshShell();
  };
  panel.append(title, status, note,cutter,former,rawStorage,productStorage,bench,brace,battery,distributor,rotate,cancel,confirm,buildStatus);
  // Reuse the admitted canonical pending/receipt/session/focus lifetime for
  // all Entry actions; unknown replies retain the same request until resolved.
  const actions=createFactoryPanel(session.ui,document,"power","Anlagen verbinden und beliefern");
  const connections=actions.element;connections.id="factory-connections";panel.append(connections);
  const connectionButtons=new Map<string,HTMLButtonElement>();
  actions.start(snapshot=>{
    const choices=[...(snapshot.connections?.power??[]).map(choice=>({kind:"connect-power" as const,choice})),...(snapshot.connections?.belts??[]).map(choice=>({kind:"connect-belt" as const,choice})),...(snapshot.interaction.localDeposits??[]).map(choice=>({kind:"deposit" as const,choice:{...choice,id:choice.target.id}}))];
    const portLabel=(id:string)=>{
      const device=snapshot.power.devices?.find(d=>id===`power_${d.id}`);if(device)return device.name;
      const machine=snapshot.machines.find(m=>m.ports.some(p=>p.id===id));if(machine){const port=machine.ports.find(p=>p.id===id)!;return `${machine.name} · ${port.role==="SolidBatchIn"?"Eingang":port.role==="SolidBatchOut"?"Ausgang":"Strom"}`;}
      const owner=host.handling?.read().solidPorts?.find(p=>p.portId===id),storage=snapshot.inventory.find(c=>c.id===`storage_${owner?.instanceId}`);
      return storage?`Lager ${snapshot.inventory.filter(c=>c.role===storage.role).findIndex(c=>c.id===storage.id)+1}`:"Anschluss";
    };
    const targetLabel=(id:string)=>{const target=snapshot.inventory.find(c=>c.id===id),machine=snapshot.machines.find(m=>m.inputContainerId===id);
      return machine?`Eingang · ${machine.name}`:target?`Lager ${snapshot.inventory.filter(c=>c.role===target.role).findIndex(c=>c.id===id)+1}`:"Lager";};
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
      value.textContent=kind==="connect-power"&&"lengthMm" in choice?`Strom: ${portLabel(choice.sourcePortId)} → ${portLabel(choice.targetPortId)} · ${choice.lengthMm/1000} m`:kind==="connect-belt"&&"sourcePortId" in choice?`Band: ${portLabel(choice.sourcePortId)} → ${portLabel(choice.targetPortId)} · 4 m`:`Gesamten Transport einlagern · ${"target" in choice?targetLabel(choice.target.id):"Lager"}`;
    }
  });
  let started=false,shellRevision=0,uiView=session.ui.read(),lastShellKey="";
  const shellListeners=new Set<(view:FactoryShellView)=>void>();
  const readShell=():FactoryShellView=>{
    const native=host.read(),input=native.input,facilities=host.handling?.read();
    const hold=uiView.state==="RecoveryHold"||!["Running","Paused"].includes(native.physicsStatus);
    const playing=Boolean(input?.active&&input.pointerLocked&&!input.activationPending&&native.confirmed);
    const available=native.confirmed&&session.isQuiescent()&&!input?.activationPending;
    const cap=(enabled:boolean,reason:string)=>Object.freeze({enabled,reason:enabled?null:reason});
    const veto=facilities?.lastCarrierVeto?.reason??null;
    const reasons:Record<string,string>={CarrierSupport:"Fracht benötigt vollständige ebene Bodenauflage",CarrierOverlap:"Hindernis im Transportweg",CarrierSweep:"Hindernis im Transportweg",CarrierCoverage:"Transportfläche noch nicht bestätigt",CarrierGroundHeight:"Transport benötigt eine ebene Fläche"};
    const interaction=uiView.interaction.handling?"WASD: Transport bewegen · Escape: Pause · Fracht: absetzen oder lokal liefern":uiView.interaction.cargoAccessible?"Wrackfracht erreichbar · Fracht öffnen":playing?"WASD: gehen · B: bauen · M: Karte · Escape: Pause":"Spielen bewusst anklicken, um Mausblick und Bewegung zu aktivieren";
    return Object.freeze({sessionId:native.sessionId,epoch:native.epoch,publicationRevision:shellRevision,
      phase:!started?"start":hold?"hold":playing?"playing":"paused",
      statusText:input?.error??(hold?(native.physicsStatus==="SimulationHold"?"Sitzung unterbrochen. Bestätigte Arbeit und Fracht sind erhalten. Freigeben, danach Spielen wählen.":`Sitzung angehalten · ${native.physicsStatus}`):input?.pausePending?"Pause wird noch bestätigt":input?.activationPending?"Spielstart wird noch bestätigt":playing?"Spiel aktiv":native.physicsStatus==="Paused"?"Sitzung pausiert":"Eingaben gesperrt · Pause wird bestätigt"),
      capabilities:{recoverSimulation:cap(started&&native.simulationRecoveryAvailable===true&&Boolean(host.recoverSimulationHold),"Sitzung muss für die Freigabe bereit sein"),newSession:cap(!started&&available,"Für eine neue Sitzung zum Menü zurückkehren"),continue:cap(false,"Noch kein gemeinsam bestätigter Factory-Spielstand verfügbar"),play:cap(started&&available&&Boolean(host.play),!started?"Zuerst Neues Spiel wählen":"Host muss sichtbar, bestätigt und frei sein"),pause:cap(started&&!hold&&!input?.pausePending,"Pause wird bereits bestätigt oder Host angehalten"),save:cap(false,"Gemeinsamer Factory-Spielstand noch nicht angebunden"),endSession:cap(Boolean(host.endSession)&&session.canEndSession?.()===true,"Laufenden Vorgang vor dem Beenden abwarten"),settings:cap(false,"Keine bestätigte Einstellungsanbindung verfügbar")},
      hud:{interactionText:interaction,carrierMassMg:uiView.interaction.handling?.massMg??null,blockReason:veto?reasons[veto]??veto:null,warnings:[]},
      onboarding:session.readOnboarding(native),map:session.readLocalMap(tool?.read()?.request??null)});
  };
  refreshShell=()=>{
    if(disposed||!host.current())return;
    const view=readShell(),key=JSON.stringify({...view,publicationRevision:0});if(key===lastShellKey)return;lastShellKey=key;shellRevision++;
    const next=Object.freeze({...view,publicationRevision:shellRevision});for(const listener of shellListeners)listener(next);
  };
  const shellPort:FactoryShellPort={read:readShell,subscribe:listener=>{shellListeners.add(listener);return()=>shellListeners.delete(listener);},
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
      else if(command.kind==="endSession")await host.endSession!();
      else throw Error("Factory lifecycle capability unavailable");
      if(!disposed&&host.current())refreshShell();
    }};
  const shell=mountFactoryShell({port:shellPort,uiPort:session.ui,buildPanel:panel,connectionsPanel:connections,
    cancelBuildPreview:()=>{if(!tool?.read()||construction?.busy)return false;tool.cancel();projectGhost();return true;}});
  document.querySelector("#app")!.append(shell.element);
  const uiUnsubscribe=session.ui.subscribe(snapshot=>{uiView=snapshot;document.body.dataset.hestiaFactoryUi=JSON.stringify(snapshot);refreshShell();});
  document.body.dataset.hestiaFactoryUi=JSON.stringify(uiView);
  const unsubscribe = session.subscribe(project);
  const unsubscribeHost = host.subscribeConfirmed(() => { project(session.read()); });
  project(session.read());
  return Object.freeze({ isQuiescent: session.isQuiescent, canRecoverSimulationHold:session.canRecoverSimulationHold,recoverSimulationHold:session.recoverSimulationHold, canEndSession: session.canEndSession, readFactoryPresentation:session.readPresentation, dispose: async () => {
    if (disposed) return;
    disposed = true;document.removeEventListener("keydown",onBuildKey); unsubscribe(); unsubscribeHost();shell.dispose();shellListeners.clear();
    actions.dispose();uiUnsubscribe();await session.dispose(); panel.remove();
    // A stale close may not remove a replacement session's projection.
    const current = document.body.dataset.hestiaFactoryClock;
    if (current && JSON.parse(current).epoch === session.read().epoch) {
      delete document.body.dataset.hestiaFactory; delete document.body.dataset.hestiaFactoryClock;delete document.body.dataset.hestiaFactoryConstruction;delete document.body.dataset.hestiaFactoryUi;
    }
  } });
};

/** The real HVP mount guard owns exclusivity; there is no parallel renderer/World. */
export const startFactoryEntry = (): Promise<HvpBootstrapHandle> => startHvp({ factoryExtension: extension,createSourceSnapshot:materializeFactoryStartSiteV5,factorySourceProfile:{version:"hvp-factory-startsite-v5",readColumn:readFactorySourceColumnWorldV5} });
void startFactoryEntry().catch(error => {
  const status = document.createElement("p"); status.setAttribute("role", "alert");
  status.textContent = `Werkstatt konnte nicht starten: ${String(error)}`; document.body.append(status);
});
