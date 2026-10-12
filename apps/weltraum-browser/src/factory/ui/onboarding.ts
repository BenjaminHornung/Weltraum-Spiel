import type { FactoryUiPanel } from "../session/hostPort";

/** Host-owned cumulative production receipts for this exact steel lineage.
 * Current inventory and UI clicks cannot establish this proof. */
export interface FactoryProductionGoalFacts {
  readonly lineageId: string | null;
  readonly inputSteelMg: number;
  readonly cutBatches: number;
  readonly cutOutputMg: number;
  readonly cutOffcutMg: number;
  readonly profileOutputMg: number;
  readonly sheetOutputMg: number;
  readonly formerOffcutMg: number;
  readonly braceOutputMg: number;
  readonly braceOffcutMg: number;
  readonly installedBraceMg: number;
  readonly paidBraceInstallation: boolean;
}
export interface FactoryOnboardingFacts {
  readonly confirmed: boolean;
  readonly cargoOpened: boolean;
  readonly installedSourceIds: readonly string[];
  readonly powerConnected: boolean | null;
  readonly twoBeltLinesConnected: boolean | null;
  readonly production: FactoryProductionGoalFacts | null;
}
export interface FactoryOnboardingProjection {
  readonly taskId: "confirmation" | "cargo" | "machines" | "power" | "transport" | "cut" | "form" | "bench" | "brace" | "install" | "complete";
  readonly title: string;
  readonly hint: string | null;
  readonly actionSurface: FactoryUiPanel | "build" | null;
  readonly complete: boolean;
}
const task = (taskId: FactoryOnboardingProjection["taskId"], title: string, hint: string | null,
  actionSurface: FactoryOnboardingProjection["actionSurface"]): FactoryOnboardingProjection =>
  Object.freeze({ taskId, title, hint, actionSurface, complete: taskId === "complete" });
const waiting = () => task("confirmation", "Werkstattzustand wird bestätigt", "Bestätigte Produktionsdaten sind noch nicht verfügbar.", null);
const validProduction = (value: FactoryProductionGoalFacts): boolean => [value.inputSteelMg, value.cutBatches, value.cutOutputMg,
  value.cutOffcutMg, value.profileOutputMg, value.sheetOutputMg, value.formerOffcutMg, value.braceOutputMg,
  value.braceOffcutMg, value.installedBraceMg].every(v => Number.isSafeInteger(v) && v >= 0);
const cutComplete = (p: FactoryProductionGoalFacts): boolean => Boolean(p.lineageId) && p.inputSteelMg === 16_000_000 &&
  p.cutBatches === 2 && p.cutOutputMg === 15_000_000 && p.cutOffcutMg === 1_000_000;
const formComplete = (p: FactoryProductionGoalFacts): boolean => cutComplete(p) && p.profileOutputMg === 7_000_000 &&
  p.sheetOutputMg === 7_000_000 && p.formerOffcutMg === 1_000_000;
const braceComplete = (p: FactoryProductionGoalFacts): boolean => formComplete(p) && p.braceOutputMg === 5_800_000 && p.braceOffcutMg === 200_000;

/** One useful task; no progression clock, flags, research locks or commands. */
export const projectFactoryOnboarding = (facts: FactoryOnboardingFacts | null): FactoryOnboardingProjection => {
  if (!facts?.confirmed || (facts.production && !validProduction(facts.production))) return waiting();
  const p = facts.production;
  if (p && braceComplete(p) && p.paidBraceInstallation && p.installedBraceMg === 5_800_000)
    return task("complete", "Erste tragende Stütze gebaut", "16 kg Stahl wurden regulär verarbeitet und die 5,8-kg-Stütze bezahlt verbaut.", null);
  if (!facts.cargoOpened) return task("cargo", "Wrackfracht öffnen", "Das Schiff ist flugunfähig. Seine endliche Fracht versorgt deine erste Werkstatt.", "cargo");
  if (!facts.installedSourceIds.includes("B06") || !facts.installedSourceIds.includes("B07"))
    return task("machines", "Zuschnittstation und Umformwerk aufbauen", "Schwere Chassis zuerst transportieren; Depot und Spielerstand vor der Installation freihalten.", "build");
  if (facts.powerConnected === null) return waiting();
  if (!facts.powerConnected) return task("power", "Maschinen mit Strom versorgen", "Batterie und die vorhandenen Kabel über die sichtbaren Anschlüsse verbinden.", "power");
  if (facts.twoBeltLinesConnected === null) return waiting();
  if (!facts.twoBeltLinesConnected) return task("transport", "Lager und zwei kurze Bandlinien verbinden", "Die Anschlüsse zeigen zulässige Verbindungen; jede Linie benötigt vorhandenes Material.", "power");
  if (!p || !cutComplete(p)) return task("cut", "16 kg Stahl in zwei Zuschnittaufträgen verarbeiten", "Je Auftrag 8 kg sortenbekannten Stahl zuführen. Zusammen entstehen 15 kg Halbzeug und 1 kg Verschnitt.", "machine");
  if (!formComplete(p)) return task("form", "Frische Profile und Blech herstellen", "Ein Profil- und ein Blechauftrag erzeugen je 7 kg Produkt. Rezeptwechsel wartet auf freies WIP.", "machine");
  if (!facts.installedSourceIds.includes("B05")) return task("bench", "Werkbank aufbauen", "Die Werkbank benötigt einen zulässigen erreichbaren Standort und die vorhandenen Bauteile.", "build");
  if (!braceComplete(p)) return task("brace", "Stütze an der Werkbank montieren", "4 kg frische Profile und 2 kg frisches Blech lokal liefern; daraus entstehen 5,8 kg Stütze.", "machine");
  return task("install", "Die neue Stütze bezahlt verbauen", "Bauvorschau an einem zulässigen Standort bestätigen. Erst die tatsächliche Installation schließt das Ziel.", "build");
};
