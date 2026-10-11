import { materializeFactoryStartSite,readFactorySourceColumnWorld } from "./fixtures/startSite";
import { createFactoryBuildTool } from "./ui/buildTool";
import { readMaterialMassMg } from "./material/resourcesAdapter";
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
  panel.setAttribute("style", "position:fixed;right:12px;top:12px;max-width:320px;padding:14px;background:#10202aeb;color:#f1f5f7;font:14px/1.5 system-ui;z-index:21");
  const title = document.createElement("strong"); title.textContent = "Hestia · Werkstatt";
  const status = document.createElement("p"); status.id = "factory-status"; status.setAttribute("role", "status");
  const note = document.createElement("p"); note.textContent = "Wähle eine Bauvorschau. Die Werkstatt pausiert; Pfeile verschieben um 25 cm, R dreht, Escape verwirft. Wrackfracht öffnen, anschließend mit Spielen und WASD zum Bauplatz gehen. Bauteile bleiben bis zur Bestätigung in der endlichen Wrackfracht. Gemeinsames Speichern folgt.";
  const pause = document.createElement("button"); pause.type = "button"; pause.textContent = "Werkstatt pausieren";
  const resume = document.createElement("button"); resume.type = "button"; resume.textContent = "Werkstatt fortsetzen";
  pause.setAttribute("style", "margin:4px;padding:6px"); resume.setAttribute("style", "margin:4px;padding:6px");
  let disposed = false;
  let lastBuildProjection="";
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
  const cargoOpen=button("Wrackfracht öffnen","factory-open-cargo",()=>{void host.construction?.openCargo().then(()=>{updateBuild();buildStatus.textContent="Wrackfracht geöffnet · endlicher Bestand verfügbar";}).catch(error=>{buildStatus.textContent=`Wrackfracht nicht erreichbar · ${String(error)}`;});});
  const cutter=button("Zuschnitt vorschauen","factory-build-cutter",()=>{void choose("B06",[-6250,1500,5000],1);});
  const battery=button("Batterie vorschauen","factory-build-battery",()=>{void choose("fp02.device.battery_4kwh",[-6250,1500,11500],3);});
  const distributor=button("Verteiler vorschauen","factory-build-distributor",()=>{void choose("fp02.device.distribution_40kw",[-10250,1500,5500],1);});
  const rotate=button("Bauvorschau drehen","factory-build-rotate",()=>{tool?.rotate();projectGhost();});
  const cancel=button("Bauvorschau verwerfen","factory-build-cancel",()=>{tool?.cancel();projectGhost();});
  const confirm=button("Bau bestätigen","factory-build-confirm",()=>{void (async()=>{const result=await tool?.confirm();projectGhost();if(result?.status!=="Committed")buildStatus.textContent=`Bau angehalten · ${result?.reason}`;})();});
  const onBuildKey=(event:KeyboardEvent)=>{if(!tool?.read()||construction?.busy)return;if(event.key==="Escape"){event.preventDefault();tool.cancel();}else if(event.key.toLowerCase()==="r"){event.preventDefault();tool.rotate();}else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();tool.move(event.key==="ArrowLeft"?-1:event.key==="ArrowRight"?1:0,event.key==="ArrowUp"?-1:event.key==="ArrowDown"?1:0);}else return;projectGhost();};
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
    pause.disabled = paused || !available; resume.disabled = !paused || !available;
  };
  const command = async (kind: "pause" | "resume") => {
    try { await host[kind](); project(session.read()); }
    catch (error) { if (!disposed && host.current()) status.textContent = `Werkstatt angehalten · ${String(error)}`; }
  };
  const onPause = () => { void command("pause"); };
  const onResume = () => { void command("resume"); };
  pause.addEventListener("click", onPause); resume.addEventListener("click", onResume);
  panel.append(title, status, note, pause, resume,cargoOpen,cutter,battery,distributor,rotate,cancel,confirm,buildStatus); document.querySelector("#app")!.append(panel);
  const unsubscribe = session.subscribe(project);
  const unsubscribeHost = host.subscribeConfirmed(() => { project(session.read()); });
  project(session.read());
  return Object.freeze({ isQuiescent: session.isQuiescent, canEndSession: session.canEndSession, dispose: async () => {
    if (disposed) return;
    disposed = true;document.removeEventListener("keydown",onBuildKey); unsubscribe(); unsubscribeHost(); pause.removeEventListener("click", onPause); resume.removeEventListener("click", onResume);
    await session.dispose(); panel.remove();
    // A stale close may not remove a replacement session's projection.
    const current = document.body.dataset.hestiaFactoryClock;
    if (current && JSON.parse(current).epoch === session.read().epoch) {
      delete document.body.dataset.hestiaFactory; delete document.body.dataset.hestiaFactoryClock;delete document.body.dataset.hestiaFactoryConstruction;
    }
  } });
};

/** The real HVP mount guard owns exclusivity; there is no parallel renderer/World. */
export const startFactoryEntry = (): Promise<HvpBootstrapHandle> => startHvp({ factoryExtension: extension,createSourceSnapshot:materializeFactoryStartSite,factorySourceProfile:{version:"hvp-factory-startsite-v1",readColumn:readFactorySourceColumnWorld} });
void startFactoryEntry().catch(error => {
  const status = document.createElement("p"); status.setAttribute("role", "alert");
  status.textContent = `Werkstatt konnte nicht starten: ${String(error)}`; document.body.append(status);
});
