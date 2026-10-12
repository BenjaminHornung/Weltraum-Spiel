import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FactoryOnboardingFacts } from "../../../src/factory/ui/onboarding";

// A missing UI projection produces no task, so RED is an actual missing
// player instruction assertion rather than an unresolved-module error.
const modulePath = "../../../src/factory/ui/onboarding";
const load = async (): Promise<typeof import("../../../src/factory/ui/onboarding") | null> => existsSync(new URL("../../../src/factory/ui/onboarding.ts", import.meta.url)) ? await import(modulePath) : null;
const facts = (): FactoryOnboardingFacts => ({ confirmed: true, cargoOpened: false, installedSourceIds: [], powerConnected: false, twoBeltLinesConnected: false, production: null });

describe("confirmed Factory onboarding", () => {
  it("gives one useful cargo task before any material work", async () => {
    const projection = await load();
    expect(projection?.projectFactoryOnboarding(facts())?.taskId).toBe("cargo");
  });

  it("recognizes valid reordered installations without a click counter", async () => {
    const projection = await load();
    expect(projection?.projectFactoryOnboarding({ ...facts(), cargoOpened: true, installedSourceIds: ["B06", "B07"], powerConnected: true })?.taskId).toBe("transport");
  });

  it("does not declare the brace goal completed from starting-stock products", async () => {
    const projection = await load();
    const production = { lineageId: null, inputSteelMg: 16_000_000, cutBatches: 2, cutOutputMg: 15_000_000, cutOffcutMg: 1_000_000, profileOutputMg: 7_000_000, sheetOutputMg: 7_000_000, formerOffcutMg: 1_000_000, braceOutputMg: 5_800_000, braceOffcutMg: 200_000, installedBraceMg: 5_800_000, paidBraceInstallation: true };
    expect(projection?.projectFactoryOnboarding({ ...facts(), cargoOpened: true, installedSourceIds: ["B06", "B07"], powerConnected: true, twoBeltLinesConnected: true, production })?.complete).toBe(false);
  });

  it("requires the confirmed paid 16 kg lineage before reporting the goal", async () => {
    const projection = await load();
    const production = { lineageId: "confirmed_steel_16", inputSteelMg: 16_000_000, cutBatches: 2, cutOutputMg: 15_000_000, cutOffcutMg: 1_000_000, profileOutputMg: 7_000_000, sheetOutputMg: 7_000_000, formerOffcutMg: 1_000_000, braceOutputMg: 5_800_000, braceOffcutMg: 200_000, installedBraceMg: 5_800_000, paidBraceInstallation: true };
    expect(projection?.projectFactoryOnboarding({ ...facts(), cargoOpened: true, installedSourceIds: ["B06", "B07"], powerConnected: true, twoBeltLinesConnected: true, production })?.complete).toBe(true);
  });

  it("keeps absent confirmation explicitly unknown", async () => {
    const projection = await load();
    expect(projection?.projectFactoryOnboarding({ ...facts(), confirmed: false })?.taskId).toBe("confirmation");
  });
});
