import { describe, expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createFactoryMaterialView, prepareFactoryMaterialStep, commitFactoryMaterialStep,
  type MaterialIntent, type MaterialView } from "../../../src/factory/material/reservations";
import { readMaterialMassMg } from "../../../src/factory/material/resourcesAdapter";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../../src/resources/containers";
import { canonicalJson, canonicalSignature } from "../../../src/resources/serialization";
import { stepFactoryPower, type FactoryPowerBinding, type FactoryPowerState, type FactoryPowerSupply } from "../../../src/factory/power/factoryPower";
import { createFactoryProductionState, stepFactoryProduction, commitFactoryProductionStep, readFactoryProductionRequest,
  type ProductionCommand, type ProductionProposal, type ProductionStepInput } from "../../../src/factory/production/productionStep";
import type { ProductionHostFacts, ProductionStart } from "../../../src/factory/production/recipeAdmission";

const fixture = createFp02Fixture("cargo"), catalog = fixture.catalog;
const binding: FactoryPowerBinding = { sessionId: "production_test_session", epoch: 1, netRevision: 1,
  catalogDigest: catalog.catalogDigest, sourceProfileDigest: "fp01-fixed-net-observation-v1" };
const contents = (v: MaterialView, id: string) => v.containers.find(c => c.state.containerId === id)!.state.contents;
const bin = (id: string, lots: readonly unknown[] = [], maxMassKg = 4_000, maxVolumeM3 = 30) =>
  createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: id, kind: "OutpostStorage", maxMassKg, maxVolumeM3, maxStackCount: 200 }),
    createResourceContainerState({ containerId: id, ownerId: "pilot", contents: lots }, catalog.resources), catalog.resources);
const commitMaterial = (material: MaterialView, intent: MaterialIntent): MaterialView => {
  const p = prepareFactoryMaterialStep(material, intent); if (p.status !== "Prepared") throw Error(p.reason);
  const r = commitFactoryMaterialStep(material, p); if (r.status === "Rejected") throw Error(r.reason); return r.view;
};
const cargoMove = (v: MaterialView, itemId: string, quantityUnits: number, targetContainerId: string, targetStackId: string) => ({
  itemId, quantityUnits, sourceContainerId: fixture.resourceState.containerId,
  sourceStackId: contents(v, fixture.resourceState.containerId).find(s => s.resourceId === catalog.items.find(i => i.sourceId === itemId)!.resourceId)!.stackId,
  targetContainerId, targetStackId
});

/** Full finite cargo is retained. Pure-unit native admission and power net are
 * explicitly synthetic host facts, not a W07/W09 browser or native claim. */
const initial = (deviceId = "B06", withInput = true, outputMassKg = deviceId === "B07" ? 21 : 22.5, offcutMassKg = 6) => {
  const definition = catalog.devices.find(d => d.sourceId === deviceId)!;
  const cargo = createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: fixture.resourceState.containerId,
    kind: "ShipCargo", maxMassKg: 4_000, maxVolumeM3: 30, maxStackCount: 200 }), fixture.resourceState, catalog.resources);
  let material = createFactoryMaterialView(catalog, [cargo, bin("installed"), bin("input", [], definition.buffers.find(b => b.role === "input")?.massMg ? definition.buffers.find(b => b.role === "input")!.massMg / 1_000_000 : 8), bin("wip", [], 8, .03),
    bin("product", [], outputMassKg, .1), bin("offcut", [], offcutMassKg, .1), bin("fixture_wip")]);
  material = commitMaterial(material, { kind: "transfer", transactionId: "paid_install_fixture", ownerId: "pilot", actorId: "pilot",
    moves: definition.bom.map((term, i) => cargoMove(material, term.itemId, term.quantityUnits, "installed", `installed_part_${i}`)) });
  if (withInput && deviceId === "B06") material = commitMaterial(material, { kind: "transfer", transactionId: "feed_cut_fixture", ownerId: "pilot", actorId: "pilot",
    moves: [cargoMove(material, "fp02.bulk.steel_known", 8_000_000, "input", "raw_input")] });
  if (withInput && deviceId === "B07") {
    // Source-conserving pre-existing processed lot fixture through the reviewed
    // W02 material seam; no claim of a preceding native work/power execution.
    material = commitMaterial(material, { kind: "reserve", transactionId: "preexisting_cut_start", ownerId: "fixture_job", actorId: "pilot",
      reservationId: "fixture_cut_reservation", wipContainerId: "fixture_wip", recipeRef: { sourceId: "REC-01-CUT", version: 1, digest: catalog.recipes[0]!.digest },
      moves: [cargoMove(material, "fp02.bulk.steel_known", 8_000_000, "fixture_wip", "fixture_raw")],
      outputs: [{ itemId: "fp02.bulk.steel_semi", quantityUnits: 7_500_000, targetContainerId: "input", stackId: "semi_input" },
        { itemId: "fp02.bulk.steel_offcut", quantityUnits: 500_000, targetContainerId: fixture.resourceState.containerId, stackId: "fixture_cut_offcut" }] });
    material = commitMaterial(material, { kind: "finish-recipe", transactionId: "preexisting_cut_finish", ownerId: "fixture_job", actorId: "pilot", reservationId: "fixture_cut_reservation" });
  }
  const toolId = deviceId === "B06" ? "fp02.tool.cutter_head" : deviceId === "B07" ? "fp02.tool.forming_die" : "fp02.device.field_workbench";
  const facts: ProductionHostFacts = { version: "fp06-production-host-facts-v1", binding, confirmed: true, tickEndUs: "0",
    installation: { instanceId: "machine", definitionRef: { sourceId: deviceId, version: definition.version, digest: definition.digest }, installationRevision: 1,
      confirmed: true, supported: true, serviceClear: true, installedContainerId: "installed", inputContainerId: "input", outputContainerId: "product",
      offcutContainerId: "offcut", wipContainerId: "wip", powerConsumerId: "machine_work", powerPortId: "machine_power",
      tool: { partId: "surviving_tool", sourceItemId: toolId, revision: 1, condition: "OK" } },
    interaction: { actorId: "pilot", actorRevision: 1, confirmed: true, serviceReachable: true,
      accessibleContainers: material.containers.map(c => ({ containerId: c.state.containerId, revision: c.state.revision })) } };
  const recipeId = deviceId === "B06" ? "REC-01-CUT" : deviceId === "B07" ? "REC-02-PROFILE" : "REC-05-BRACE";
  const recipe = catalog.recipes.find(r => r.sourceId === recipeId)!;
  const command: ProductionStart = { kind: "start", commandId: "begin_job", jobId: "job", batchOrdinal: 0, ownerId: "job_owner", actorId: "pilot",
    recipeRef: { sourceId: recipe.sourceId, version: recipe.version, digest: recipe.digest }, processKind: deviceId === "B05" ? "manual" : "electric",
    sourceLots: recipe.inputs.map(term => ({ itemId: term.itemId, containerId: deviceId === "B05" ? fixture.resourceState.containerId : "input",
      stackId: (deviceId === "B05" ? contents(material, fixture.resourceState.containerId) : contents(material, "input")).find(s => s.resourceId === catalog.items.find(i => i.sourceId === term.itemId)!.resourceId)?.stackId ?? "missing_input" })) };
  const powerState: FactoryPowerState = { version: "fp06-factory-power-v1", binding, tickEndUs: "0", revision: 0, battery: null, consumers: [] };
  return { material, state: createFactoryProductionState("machine", binding), facts, command, powerState,
    lastInput: null as ProductionStepInput | null, lastProposal: null as ProductionProposal | null };
};
type Pair = ReturnType<typeof initial>;
const input = (pair: Pair, powered = true, command?: ProductionCommand, includeRequest = true): ProductionStepInput => {
  const tickStartUs = pair.state.tickEndUs, tickEndUs = String(BigInt(tickStartUs) + 100_000n);
  const facts = { ...pair.facts, tickEndUs, interaction: pair.facts.interaction ? { ...pair.facts.interaction,
    accessibleContainers: pair.material.containers.map(c => ({ containerId: c.state.containerId, revision: c.state.revision })) } : null };
  const base = { confirmed: true, binding, tickStartUs, tickEndUs, material: pair.material, facts, ...(command ? { command } : {}) };
  const request = readFactoryProductionRequest(pair.state, base);
  const data = { version: "fp06-power-supply-v1" as const, binding, tickStartUs, tickEndUs,
    offers: [{ instanceId: "fp02_cargo_c01_unit_1", portId: "source", availableMilliWatt: powered ? "6000000" : "0", nameplateMilliWatt: "6000000", quality: "confirmed" as const }],
    ports: [{ portId: "source", assetId: "fp02_cargo_c01_unit_1", direction: "out" as const, active: true, maxMilliWatt: "6000000" },
      { portId: "machine_power", assetId: "machine", direction: "in" as const, active: true, maxMilliWatt: "6000000" }],
    links: [{ linkId: "actual_fixture_cable", fromPortId: "source", toPortId: "machine_power", active: true, maxMilliWatt: "6000000" }],
    battery: null, authorityBytes: canonicalJson({ kind: "synthetic-production-unit-net-v1" }) };
  const supply: FactoryPowerSupply = { ...data, canonicalJson: canonicalJson(data), digest: canonicalSignature(data) };
  const power = stepFactoryPower(pair.powerState, { binding, tickStartUs, tickEndUs, confirmed: true, supply, requests: includeRequest ? [request] : [] });
  if (!power.ok) throw Error(power.reason);
  return { ...base, power };
};
const advance = (pair: Pair, powered = true, command?: ProductionCommand, includeRequest = true): Pair => {
  const request = input(pair, powered, command, includeRequest); const proposal = stepFactoryProduction(pair.state, request);
  expect(proposal.status).toBe("Prepared");
  const result = commitFactoryProductionStep(pair.state, request, proposal); expect(result.status).toBe("Committed");
  return { ...pair, state: result.state, material: result.material, powerState: request.power!.nextState, lastInput: request, lastProposal: proposal };
};
const ticks = (pair: Pair, count: number, powered = true) => { for (let i = 0; i < count; i++) pair = advance(pair, powered); return pair; };

describe("FP06 W04 exact paid process steps over native Resources", () => {
  it("FP06-T017 has no CUT product at299 paid steps and atomically yields7.5+.5kg at300/36000J", () => {
    let pair = initial(); const mass = readMaterialMassMg(pair.material);
    pair = advance(pair, true, pair.command); pair = ticks(pair, 298);
    expect(pair.state.job?.workMilliJoule).toBe("35880000"); expect(contents(pair.material, "product")).toEqual([]);
    expect(contents(pair.material, "wip")[0]!.quantity).toBe(8_000_000);
    pair = advance(pair);
    expect(pair.state.status).toBe("COMPLETED"); expect(pair.state.job?.workMilliJoule).toBe("36000000");
    expect(contents(pair.material, "product")).toMatchObject([{ resourceId: "fp02_bulk_steel_semi", quantity: 7_500_000 }]);
    expect(contents(pair.material, "offcut")).toMatchObject([{ resourceId: "fp02_bulk_steel_offcut", quantity: 500_000 }]);
    expect(contents(pair.material, "wip")).toEqual([]); expect(readMaterialMassMg(pair.material)).toBe(mass);
  });
  it("FP06-T018 permits empty product space, freezes full sinks/inputabsence and finishes Former at400/80000J", () => {
    let pair = initial("B07"); pair = advance(pair, true, pair.command); pair = ticks(pair, 398);
    expect(pair.state.job?.workMilliJoule).toBe("79800000"); expect(contents(pair.material, "product")).toEqual([]);
    pair = advance(pair); expect(pair.state.job?.workMilliJoule).toBe("80000000");
    expect(contents(pair.material, "product")[0]!.quantity).toBe(7_000_000); expect(contents(pair.material, "offcut")[0]!.quantity).toBe(500_000);
    for (const [frozen, status] of [[initial("B07", false), "WAIT_INPUT"], [initial("B07", true, 0), "WAIT_OUTPUT"], [initial("B06", true, 22.5, .25), "WAIT_WASTE"]] as const) {
      const r = advance(frozen, true, frozen.command); expect(r.state.status).toBe(status); expect(r.state.job).toBeNull();
      expect(contents(r.material, "wip")).toEqual([]); expect(r.material).toEqual(frozen.material); expect(r.lastInput!.power!.grants[0]!.work.n).toBe("0");
    }
  });
  it("FP06-T019 retains18kJ and WIP through power loss and actual W03 restart headroom delay", () => {
    let pair = initial(); pair = advance(pair, true, pair.command); pair = ticks(pair, 149);
    const wip = contents(pair.material, "wip"); pair = ticks(pair, 20, false);
    expect(pair.state.status).toBe("WAIT_POWER"); expect(pair.state.job?.workMilliJoule).toBe("18000000"); expect(contents(pair.material, "wip")).toEqual(wip);
    pair = ticks(pair, 20, true); expect(pair.state.job?.workMilliJoule).toBe("18000000");
    pair = ticks(pair, 150, true); expect(pair.state.status).toBe("COMPLETED"); expect(pair.state.job?.workMilliJoule).toBe("36000000");
    expect(contents(pair.material, "product")).toHaveLength(1);
  });
  it("FP06-T020 replays adopted completion/work once and rejects a changed command identity", () => {
    let pair = initial(); pair = advance(pair, true, pair.command); const one = pair;
    const once = commitFactoryProductionStep(one.state, { ...one.lastInput!, material: one.material }, one.lastProposal!);
    expect(once.status).toBe("NoOp"); expect(once.state.job?.workMilliJoule).toBe("120000");
    pair = ticks(pair, 299); const material = pair.material;
    const replay = commitFactoryProductionStep(pair.state, { ...pair.lastInput!, material }, pair.lastProposal!);
    expect(replay.status).toBe("NoOp"); expect(replay.material).toBe(material); expect(contents(replay.material, "product")).toHaveLength(1);
    const conflict = input(pair, true, { ...pair.command, recipeRef: { ...pair.command.recipeRef, digest: "forged" } });
    expect(stepFactoryProduction(pair.state, conflict).status).toBe("Rejected");
  });
  it("holds stale or forged paired proposals without publishing partial product or unearned work", () => {
    const pair = initial(); const request = input(pair, true, pair.command), proposal = stepFactoryProduction(pair.state, request);
    expect(proposal.status).toBe("Prepared"); if (proposal.status !== "Prepared") return;
    const stale = { ...pair.material, containers: pair.material.containers.map(c => c.state.containerId === "product" ? bin("product", [], 0, .1) : c) };
    const result = commitFactoryProductionStep(pair.state, { ...request, material: stale }, proposal);
    expect(result.status).toBe("Rejected"); expect(result.material).toBe(stale); expect(result.state).toBe(pair.state);
    const forged = { ...proposal, nextState: { ...proposal.nextState, job: { ...proposal.nextState.job!, workMilliJoule: "36000000" } } };
    expect(commitFactoryProductionStep(pair.state, request, forged).status).toBe("Rejected");
  });
  it.each(["base", "material", "plans", "work"] as const)("rejects forged adopted NoOp proposal %s independently", field => {
    const pair = initial(), adopted = advance(pair, true, pair.command), proposal = adopted.lastProposal!;
    expect(proposal.status).toBe("Prepared"); if (proposal.status !== "Prepared") return;
    const replayInput = { ...adopted.lastInput!, material: adopted.material };
    const forged = field === "base" ? { ...proposal, baseStateCanonicalJson: canonicalJson({ forged: true }) }
      : field === "material" ? { ...proposal, material: { ...proposal.material, receipts: [] } }
      : field === "plans" ? { ...proposal, materialPlans: [] } : { ...proposal, workMilliJoule: "0" };
    const result = commitFactoryProductionStep(adopted.state, replayInput, forged);
    expect(result.status).toBe("Rejected"); expect(result.state).toBe(adopted.state); expect(result.material).toBe(adopted.material);
  });
  it("closed replay byte-binding rejects a joined-key alias with inherited data", () => {
    const pair = initial(), adopted = advance(pair, true, pair.command), proposal = adopted.lastProposal!;
    expect(proposal.status).toBe("Prepared"); if (proposal.status !== "Prepared") return;
    const alias = Object.freeze(Object.create(proposal.inputBinding, {
      "authorityCanonicalJson|materialCanonicalJson": { value: 0, enumerable: true }
    }));
    const result = commitFactoryProductionStep(adopted.state, { ...adopted.lastInput!, material: adopted.material }, { ...proposal, inputBinding: alias });
    expect(result.status).toBe("Rejected"); expect(result.state).toBe(adopted.state); expect(result.material).toBe(adopted.material);
  });
  it("omitted disabled/manual power requests need no invented electric In-port, enabled work still needs a grant", () => {
    let pair = initial("B05"); pair = advance(pair, false, pair.command, false);
    expect(pair.lastInput!.power!.grants).toEqual([]); expect(pair.state.status).toBe("LAID_OUT");
    pair = advance(pair, false, { kind: "manual-work", commandId: "no_electric_montage", jobId: "job", actorId: "pilot" }, false);
    pair = advance(pair, false, { kind: "manual-finish", commandId: "no_electric_output", jobId: "job", actorId: "pilot" }, false);
    expect(pair.state.status).toBe("COMPLETED"); expect(pair.lastInput!.power!.balance.work.n).toBe("0");
    const blocked = initial("B06", true, 0);
    expect(advance(blocked, true, blocked.command, false).state.status).toBe("WAIT_OUTPUT");
    const enabled = initial(); expect(stepFactoryProduction(enabled.state, input(enabled, true, enabled.command, false)).status).toBe("Rejected");
  });
  it("historical manual command replay preserves its receipt and leaves a later laid-out job untouched", () => {
    let pair = initial("B05"); pair = advance(pair, false, pair.command);
    const montage: ProductionCommand = { kind: "manual-work", commandId: "montage_a", jobId: "job", actorId: "pilot" };
    const finish: ProductionCommand = { kind: "manual-finish", commandId: "finish_a", jobId: "job", actorId: "pilot" };
    pair = advance(pair, false, montage); pair = advance(pair, false, finish);
    const oldReceipts = pair.state.commandReceipts;
    pair = advance(pair, false, { ...pair.command, commandId: "begin_b", jobId: "job_b", batchOrdinal: 1 });
    const wip = contents(pair.material, "wip"), material = pair.material, receipts = pair.state.commandReceipts;
    for (const old of [montage, finish]) {
      pair = advance(pair, false, old);
      expect(pair.state.status).toBe("LAID_OUT"); expect(pair.state.job?.start.jobId).toBe("job_b");
      expect(pair.state.job?.manualWorkReceiptId).toBeNull(); expect(pair.state.commandReceipts).toEqual(receipts);
      expect(pair.material).toBe(material); expect(contents(pair.material, "wip")).toEqual(wip);
      expect(pair.state.commandReceipts.find(r => r.commandId === old.commandId)).toEqual(oldReceipts.find(r => r.commandId === old.commandId));
    }
  });
  it("passive manual clock accepts walking away and returning without advancing montage or losing WIP", () => {
    let pair = initial("B05"); pair = advance(pair, false, pair.command);
    const reachable = pair.facts, material = pair.material, receipts = pair.state.commandReceipts;
    pair = { ...pair, facts: { ...pair.facts, interaction: null } }; pair = ticks(pair, 5, false);
    expect(pair.state.tickEndUs).toBe("600000"); expect(pair.state.status).toBe("LAID_OUT");
    expect(pair.material).toBe(material); expect(pair.state.commandReceipts).toEqual(receipts); expect(contents(pair.material, "product")).toEqual([]);
    const unreachable = input(pair, false, { kind: "manual-work", commandId: "away_montage", jobId: "job", actorId: "pilot" });
    expect(stepFactoryProduction(pair.state, unreachable).status).toBe("Rejected");
    pair = { ...pair, facts: reachable };
    pair = advance(pair, false, { kind: "manual-work", commandId: "return_montage", jobId: "job", actorId: "pilot" });
    pair = { ...pair, facts: { ...pair.facts, interaction: { ...pair.facts.interaction!, serviceReachable: false } } }; pair = ticks(pair, 5, false);
    expect(pair.state.status).toBe("ASSEMBLED"); expect(contents(pair.material, "product")).toEqual([]);
    pair = { ...pair, facts: reachable }; pair = advance(pair, false, { kind: "manual-finish", commandId: "return_output", jobId: "job", actorId: "pilot" });
    expect(pair.state.status).toBe("COMPLETED"); expect(contents(pair.material, "product")).toHaveLength(1);
  });
  it("source native resource data mutation cannot reuse previously validated catalog bytes", () => {
    const pair = initial(); const request = input(pair, true, pair.command);
    expect(stepFactoryProduction(pair.state, request).status).toBe("Prepared");
    const mutated = { ...pair.material, catalog: { ...catalog, resources: { ...catalog.resources,
      resources: catalog.resources.resources.map((r, i) => i === 0 ? { ...r, displayName: "changed outside frozen source" } : r) } } };
    expect(stepFactoryProduction(pair.state, { ...request, material: mutated }).status).toBe("Rejected");
  });
  it("manual REC05 needs laid-out→active montage→check/output and never produces from clock or zero-J", () => {
    let pair = initial("B05"); const mass = readMaterialMassMg(pair.material);
    pair = advance(pair, false, pair.command); expect(pair.state.status).toBe("LAID_OUT"); expect(contents(pair.material, "wip")).toHaveLength(2);
    pair = ticks(pair, 25, false); expect(pair.state.status).toBe("LAID_OUT"); expect(contents(pair.material, "product")).toEqual([]);
    const tooSoon = input(pair, false, { kind: "manual-finish", commandId: "premature", jobId: "job", actorId: "pilot" });
    expect(stepFactoryProduction(pair.state, tooSoon).status).toBe("Rejected");
    pair = advance(pair, false, { kind: "manual-work", commandId: "montage", jobId: "job", actorId: "pilot" });
    expect(pair.state.status).toBe("ASSEMBLED"); expect(pair.state.job?.manualWorkReceiptId).toBe("montage");
    const restored = JSON.parse(JSON.stringify(pair.state)); expect(restored.job.phase).toBe("ASSEMBLED");
    pair = { ...pair, state: restored }; pair = ticks(pair, 5, false); expect(contents(pair.material, "product")).toEqual([]);
    pair = advance(pair, false, { kind: "manual-finish", commandId: "take_product", jobId: "job", actorId: "pilot" });
    expect(pair.state.status).toBe("COMPLETED"); expect(pair.state.job?.workMilliJoule).toBe("0");
    expect(contents(pair.material, "product")).toMatchObject([{ resourceId: "fp02_comp_small_brace", quantity: 1 }]);
    expect(contents(pair.material, "offcut")).toMatchObject([{ resourceId: "fp02_bulk_steel_offcut", quantity: 200_000 }]); expect(readMaterialMassMg(pair.material)).toBe(mass);
    expect(pair.lastInput!.power!.balance.work.n).toBe("0");
  });
  it("manual actor/bench/tool/reach rejects preserve already laid-out inputs and ordered receipt", () => {
    let pair = initial("B05"); pair = advance(pair, false, pair.command);
    const command: ProductionCommand = { kind: "manual-work", commandId: "montage", jobId: "job", actorId: "pilot" };
    for (const facts of [{ ...pair.facts, interaction: null }, { ...pair.facts, interaction: { ...pair.facts.interaction!, serviceReachable: false } },
      { ...pair.facts, installation: { ...pair.facts.installation, tool: { ...pair.facts.installation.tool, condition: "damaged" as const } } }]) {
      const request = input({ ...pair, facts }, false, command); expect(stepFactoryProduction(pair.state, request).status).toBe("Rejected");
      expect(contents(pair.material, "wip")).toHaveLength(2); expect(pair.state.job?.manualWorkReceiptId).toBeNull();
    }
    const wrongActor = input(pair, false, { ...command, actorId: "remote_actor" }); expect(stepFactoryProduction(pair.state, wrongActor).status).toBe("Rejected");
  });
});
