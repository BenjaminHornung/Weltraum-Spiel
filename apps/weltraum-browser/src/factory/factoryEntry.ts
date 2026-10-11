import "../style.css";
import { startHvp, type HvpBootstrapHandle } from "../hvp/hvpBootstrap";
import { createFp02CatalogInput, loadFactoryCatalog } from "./catalog/fp02Catalog";
import { mountFactorySession, type FactorySessionView } from "./session/factorySession";
import type { FactoryHostExtension } from "./session/hostPort";

const extension: FactoryHostExtension = async host => {
  // Loading the immutable catalogue does not install objects or grant cargo.
  const session = await mountFactorySession(host, loadFactoryCatalog(createFp02CatalogInput()));
  const panel = document.createElement("section");
  panel.id = "factory-panel"; panel.setAttribute("aria-label", "Werkstatt");
  panel.setAttribute("style", "position:fixed;right:12px;top:12px;max-width:320px;padding:14px;background:#10202aeb;color:#f1f5f7;font:14px/1.5 system-ui;z-index:21");
  const title = document.createElement("strong"); title.textContent = "Hestia · Werkstatt";
  const status = document.createElement("p"); status.id = "factory-status"; status.setAttribute("role", "status");
  const note = document.createElement("p"); note.textContent = "Werkstatt vorbereitet. Bau und Produktion folgen. Gemeinsames Speichern ist noch nicht verfügbar.";
  const pause = document.createElement("button"); pause.type = "button"; pause.textContent = "Werkstatt pausieren";
  const resume = document.createElement("button"); resume.type = "button"; resume.textContent = "Werkstatt fortsetzen";
  pause.setAttribute("style", "margin:4px;padding:6px"); resume.setAttribute("style", "margin:4px;padding:6px");
  let disposed = false;
  const project = (view: FactorySessionView) => {
    if (disposed || !host.current()) return;
    document.body.dataset.hestiaFactory = "1";
    document.body.dataset.hestiaFactoryClock = JSON.stringify(view);
    const native = host.read(), paused = native.physicsStatus === "Paused";
    const available = view.state === "Ready" && native.confirmed;
    status.textContent = available ? `Werkstatt bereit · ${paused ? "Pausiert" : "Aktiv"}`
      : view.state === "RecoveryHold" ? "Werkstatt angehalten · Sitzung neu starten" : "Werkstatt wartet · Host angehalten";
    pause.disabled = paused || !available; resume.disabled = !paused || !available;
  };
  const command = async (kind: "pause" | "resume") => {
    try { await host[kind](); project(session.read()); }
    catch (error) { if (!disposed && host.current()) status.textContent = `Werkstatt angehalten · ${String(error)}`; }
  };
  const onPause = () => { void command("pause"); };
  const onResume = () => { void command("resume"); };
  pause.addEventListener("click", onPause); resume.addEventListener("click", onResume);
  panel.append(title, status, note, pause, resume); document.querySelector("#app")!.append(panel);
  const unsubscribe = session.subscribe(project);
  const unsubscribeHost = host.subscribeConfirmed(() => { project(session.read()); });
  project(session.read());
  return Object.freeze({ isQuiescent: session.isQuiescent, canEndSession: session.canEndSession, dispose: async () => {
    if (disposed) return;
    disposed = true; unsubscribe(); unsubscribeHost(); pause.removeEventListener("click", onPause); resume.removeEventListener("click", onResume);
    await session.dispose(); panel.remove();
    // A stale close may not remove a replacement session's projection.
    const current = document.body.dataset.hestiaFactoryClock;
    if (current && JSON.parse(current).epoch === session.read().epoch) {
      delete document.body.dataset.hestiaFactory; delete document.body.dataset.hestiaFactoryClock;
    }
  } });
};

/** The real HVP mount guard owns exclusivity; there is no parallel renderer/World. */
export const startFactoryEntry = (): Promise<HvpBootstrapHandle> => startHvp({ factoryExtension: extension });
void startFactoryEntry().catch(error => {
  const status = document.createElement("p"); status.setAttribute("role", "alert");
  status.textContent = `Werkstatt konnte nicht starten: ${String(error)}`; document.body.append(status);
});
