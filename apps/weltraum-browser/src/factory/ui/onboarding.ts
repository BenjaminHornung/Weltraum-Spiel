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
const waiting = () => task("confirmation", "Confirming workshop state", "Confirmed production data is not available yet.", null);
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
    return task("complete", "First structural brace installed", "16 kg of steel has been processed and the paid 5.8 kg brace installed.", null);
  if (!facts.cargoOpened) return task("cargo", "Open wreck cargo", "The ship cannot fly. Its finite cargo supplies your first workshop.", "cargo");
  if (!facts.installedSourceIds.includes("B06") || !facts.installedSourceIds.includes("B07"))
    return task("machines", "Build a cutter and former", "Transport heavy chassis first; keep the depot and player clear of the installation footprint.", "build");
  if (facts.powerConnected === null) return waiting();
  if (!facts.powerConnected) return task("power", "Supply power to the machines", "Connect the battery and existing cable through the visible ports.", "power");
  if (facts.twoBeltLinesConnected === null) return waiting();
  if (!facts.twoBeltLinesConnected) return task("transport", "Connect storage and two short belt lines", "Ports show admitted connections; each line requires existing material.", "power");
  if (!p || !cutComplete(p)) return task("cut", "Cut 16 kg of steel in two batches", "Supply 8 kg of known steel per job. Together they produce 15 kg of stock and 1 kg of offcuts.", "machine");
  if (!formComplete(p)) return task("form", "Produce fresh profiles and sheet", "One profile job and one sheet job each yield 7 kg. Recipe changes wait until work in progress clears.", "machine");
  if (!facts.installedSourceIds.includes("B05")) return task("bench", "Build a workbench", "The workbench needs an admitted reachable location and existing components.", "build");
  if (!braceComplete(p)) return task("brace", "Assemble a brace at the workbench", "Deliver 4 kg of fresh profiles and 2 kg of fresh sheet locally to produce a 5.8 kg brace.", "machine");
  return task("install", "Install the newly produced brace", "Confirm the preview at an admitted location. Only the actual installation completes the goal.", "build");
};
