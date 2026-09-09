import type { PgTragwerkPlayerSnapshot } from "../provingGround/pgTragwerkPlayerSlice";
import type { BrowserRuntimeCommand } from "../runtime/commands";

export interface PgTragwerkPlayerPanelPort {
  dispatchCommand(command: BrowserRuntimeCommand): { readonly code: string; readonly message: string };
  getPgTragwerk(): PgTragwerkPlayerSnapshot;
}

const formatMass = (massKg: number | null): string =>
  massKg === null ? "n/a" : `${massKg.toFixed(3)} kg`;

const renderSnapshot = (snapshot: PgTragwerkPlayerSnapshot): void => {
  const cells = document.querySelector<HTMLElement>("#pg-tragwerk-cells");
  const authority = document.querySelector<HTMLElement>("#pg-tragwerk-authority");
  const receipt = document.querySelector<HTMLElement>("#pg-tragwerk-receipt");
  const status = document.querySelector<HTMLElement>("#pg-tragwerk-status");
  const destroyButton = document.querySelector<HTMLButtonElement>("#pg-tragwerk-destroy");
  if (!cells || !authority || !receipt || !status || !destroyButton) {
    return;
  }
  if (!snapshot.ready) {
    cells.textContent = "Tragwerk nicht verfügbar.";
    authority.textContent = `Actor ${snapshot.actor} · Source ${snapshot.source}`;
    receipt.textContent = "";
    status.textContent = snapshot.readyError ?? snapshot.lastError ?? "Seed fehlgeschlagen.";
    destroyButton.disabled = true;
    return;
  }
  const cellsText = snapshot.applied && snapshot.cellsBefore !== null && snapshot.cellsAfter !== null
    ? `Zellen ${snapshot.cellsBefore}→${snapshot.cellsAfter} · Masse ${formatMass(snapshot.massBeforeKg)}→${formatMass(snapshot.massAfterKg)}`
    : `Bereit · ${snapshot.cellsBefore ?? "?"} Zellen · Masse ${formatMass(snapshot.massBeforeKg)}`;
  cells.textContent = cellsText;
  authority.textContent =
    `Actor ${snapshot.actor} · Source ${snapshot.source} · Objekt ${snapshot.objectId}` +
    ` · Rev ${snapshot.objectRevision ?? "?"} · Hash ${(snapshot.contentHash ?? "").slice(0, 12)}`;
  receipt.textContent = snapshot.applied
    ? `Cut ${snapshot.cutStatus} · Bodies ${snapshot.bodiesBefore}→${snapshot.bodiesAfter}` +
      ` · Collider ${snapshot.collidersBefore}→${snapshot.collidersAfter}` +
      ` · Fragmente ${snapshot.fragmentCount ?? 0}` +
      ` · Save ${(snapshot.regionSaveHash ?? "").slice(0, 12)}`
    : `Cut ${snapshot.cutStatus}`;
  if (snapshot.lastError) {
    status.textContent = snapshot.lastError;
  } else if (snapshot.applied) {
    status.textContent = `Applied: ${cellsText}.`;
  } else {
    status.textContent = "Bereit für den kanonischen Schnitt.";
  }
  destroyButton.disabled = !snapshot.ready;
};

/** Player-Panel: HUD-Einstieg oeffnet den engen PG-Dialog, ein Button dispatcht den Produktivpfad. */
export const createPgTragwerkPlayerPanel = (port: PgTragwerkPlayerPanelPort): void => {
  const openButton = document.querySelector<HTMLButtonElement>("#pg-proving-ground-open");
  const dialog = document.querySelector<HTMLDialogElement>("dialog[data-testid='pg-tragwerk-dialog']");
  const destroyButton = document.querySelector<HTMLButtonElement>("#pg-tragwerk-destroy");
  const closeButton = document.querySelector<HTMLButtonElement>("#pg-tragwerk-close");
  if (!openButton || !dialog || !destroyButton) {
    return;
  }
  renderSnapshot(port.getPgTragwerk());
  openButton.onclick = () => {
    renderSnapshot(port.getPgTragwerk());
    if (!dialog.open) {
      dialog.showModal();
    }
  };
  destroyButton.onclick = () => {
    port.dispatchCommand({ type: "DestroyPgTragwerk" });
    renderSnapshot(port.getPgTragwerk());
  };
  if (closeButton) {
    closeButton.onclick = () => dialog.close();
  }
};
