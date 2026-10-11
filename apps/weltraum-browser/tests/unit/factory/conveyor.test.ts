import { describe, expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { readMaterialMassMg } from "../../../src/factory/material/resourcesAdapter";
import { createFactoryMaterialView, type MaterialView } from "../../../src/factory/material/reservations";
import { advanceFactoryBelt, commitFactoryBeltStep, type BeltState, type BeltStepInput, type BeltPowerReceipt } from "../../../src/factory/conveyor/beltReference";
import type { BeltInstallation } from "../../../src/factory/conveyor/beltPorts";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../../src/resources/containers";
import { canonicalJson, canonicalSignature } from "../../../src/resources/serialization";

const catalog = createFp02Fixture("cargo").catalog;
const itemId = "fp02.bulk.steel_known";
const item = catalog.items.find((entry) => entry.sourceId === itemId)!;
const device = catalog.devices.find((entry) => entry.sourceId === "B09")!;
const binding = { sessionId: "belt_test_session", epoch: 1, netRevision: 1, catalogDigest: catalog.catalogDigest, sourceProfileDigest: "TEST:installed-straight-ports-v1" };
/** Isolated installation admission fixture, NOT native World/W07 support acceptance. */
const installation: BeltInstallation = {
  version: "fp06-straight-installed-belt-v1", installationId: "belt_install_a", revision: 1,
  catalogDigest: catalog.catalogDigest, sourceProfileDigest: binding.sourceProfileDigest,
  source: { instanceId: "source_device", installRevision: 1, deviceId: "B09", deviceDigest: device.digest,
    portSourceId: "B09:MAT-OUT", containerId: "source", nativePortId: "source_out", placementCenterMm: [1_000, 0, 6_000], quarterTurns: 0,
    centerMm: [2_000, 1_000, 6_000], outwardNormal: [1, 0, 0] },
  target: { instanceId: "target_device", installRevision: 1, deviceId: "B09", deviceDigest: device.digest,
    portSourceId: "B09:MAT-IN", containerId: "target", nativePortId: "target_in", placementCenterMm: [7_000, 0, 6_000], quarterTurns: 0,
    centerMm: [6_000, 1_000, 6_000], outwardNormal: [-1, 0, 0] },
  lengthMm: 4_000, moduleInstanceIds: ["belt_module_a", "belt_module_b", "belt_module_c", "belt_module_d"],
  driveInstanceId: "belt_drive_a", powerPortId: "belt_power_a", consumerId: "belt_consumer_a", jobId: "belt_job_a",
  bandContainerId: "band", bandInPortId: "band_in", bandOutPortId: "band_out"
};
const bin = (id: string, contents: readonly unknown[] = [], maxMassKg = 40, actor = "pilot") => createResourceContainerSnapshot(
  createResourceContainerDefinition({ containerId: id, kind: "OutpostStorage", maxMassKg, maxVolumeM3: 1, maxStackCount: id === "band" ? 1 : 20,
    transferPorts: id === "source" ? [{ portId: "source_out", direction: "Outbound", allowedActorIds: [actor] }]
      : id === "target" ? [{ portId: "target_in", direction: "Inbound", allowedActorIds: [actor] }]
      : [{ portId: "band_in", direction: "Inbound", allowedActorIds: [actor] }, { portId: "band_out", direction: "Outbound", allowedActorIds: [actor] }] }),
  createResourceContainerState({ containerId: id, contents, ownerId: "pilot" }, catalog.resources), catalog.resources);
const initial = (quantity = 10_000_000, targetMassKg = 40) => ({
  line: { version: "fp06-one-packet-belt-v1", lineId: "belt_a", revision: 0, binding, installation,
    tickEndUs: "0", creditMg: 0, packetCursor: 0, packet: null, lastStep: null } as BeltState,
  material: createFactoryMaterialView(catalog, [bin("source", [{ stackId: "steel_parent", resourceId: item.resourceId, quantity,
    grade: "source_grade", condition: .8, extensions: { "factory.source": { eventId: "known_finite_test_lot" } } }]), bin("band", [], 10), bin("target", [], targetMassKg)])
});
const power = (line: BeltState, powered: boolean): BeltPowerReceipt => {
  const end = String(BigInt(line.tickEndUs) + 100_000n);
  const grant = { consumerId: installation.consumerId, deviceInstanceId: installation.driveInstanceId, jobId: installation.jobId, portId: installation.powerPortId,
    requiredMilliWatt: "100000", allocatedMilliWatt: powered ? "100000" : "0", work: { n: powered ? "10000" : "0", d: "1" }, status: powered ? "Powered" as const : "WAIT_POWER" as const };
  const body = { ok: true as const, binding: line.binding, tickStartUs: line.tickEndUs, tickEndUs: end, grants: [grant] };
  return { ...body, canonicalJson: canonicalJson(body), digest: canonicalSignature(body) };
};
const input = (pair: ReturnType<typeof initial>, powered = true, source = true, quantityUnits?: number): BeltStepInput => ({ confirmed: true, binding: pair.line.binding,
  tickStartUs: pair.line.tickEndUs, tickEndUs: String(BigInt(pair.line.tickEndUs) + 100_000n), installation: pair.line.installation,
  material: pair.material, power: power(pair.line, powered), actorId: "pilot", sourceLot: source ? { stackId: "steel_parent", itemId,
    ...(quantityUnits === undefined ? {} : { quantityUnits }) } : null });
const step = (pair: ReturnType<typeof initial>, powered = true, source = true, quantityUnits?: number) => {
  const request = input(pair, powered, source, quantityUnits);
  const proposal = advanceFactoryBelt(pair.line, request);
  expect(proposal.status, proposal.status === "Rejected" ? proposal.reason : proposal.outcome).toBe("Prepared");
  const result = commitFactoryBeltStep(pair.line, request, proposal);
  expect(result.status).toBe("Committed");
  return { line: result.line, material: result.material };
};
const ticks = (pair: ReturnType<typeof initial>, count: number, powered = true, source = true, quantityUnits?: number) => {
  for (let index = 0; index < count; index++) pair = step(pair, powered, source, quantityUnits);
  return pair;
};
const lots = (material: MaterialView, id: string) => material.containers.find((entry) => entry.state.containerId === id)!.state.contents;
const persistedFacts = (pair: ReturnType<typeof initial>) => canonicalJson({ packet: pair.line.packet, creditMg: pair.line.creditMg,
  material: { revision: pair.material.revision, receipts: pair.material.receipts, reservations: pair.material.reservations,
    containers: pair.material.containers.map((entry) => JSON.parse(entry.canonicalJson)) } });

describe("FP06 native one-packet conveyor reference", () => {
  it("FP06-T033 pays entry credit, then needs 54 confirmed moves on 4m before actual target custody", () => {
    let pair = initial();
    pair = ticks(pair, 99);
    expect(pair.line.creditMg).toBe(9_900_000);
    expect(lots(pair.material, "source")[0].quantity).toBe(10_000_000);
    pair = step(pair);
    expect(pair.line.packet?.positionMm).toBe(0);
    expect(lots(pair.material, "source")).toEqual([]);
    expect(lots(pair.material, "band")[0].quantity).toBe(10_000_000);
    pair = ticks(pair, 53, true, false);
    expect(pair.line.packet?.positionMm).toBe(3_975);
    expect(lots(pair.material, "target")).toEqual([]);
    pair = step(pair, true, false);
    expect(pair.line.packet).toBeNull();
    expect(lots(pair.material, "band")).toEqual([]);
    expect(lots(pair.material, "target")[0].quantity).toBe(10_000_000);
    expect(readMaterialMassMg(pair.material)).toBe(10_000_000);
  });

  it("FP06-T034 transports 20kg as two paced native 10kg children with receipt-bound parent lineage", () => {
    let pair = initial(20_000_000);
    pair = ticks(pair, 100);
    const first = pair.line.packet!;
    expect(lots(pair.material, "source")[0].quantity).toBe(10_000_000);
    expect(lots(pair.material, "band")[0].quantity).toBe(10_000_000);
    expect(first.parentStackId).toBe("steel_parent");
    expect(JSON.parse(first.injectionReceiptCanonicalJson).requestCanonicalJson).toContain('"quantityUnits":10000000');
    pair = ticks(pair, 54);
    expect(pair.line.packet).toBeNull();
    pair = ticks(pair, 45);
    expect(lots(pair.material, "source")[0].quantity).toBe(10_000_000);
    expect(pair.line.creditMg).toBe(9_900_000);
    pair = step(pair);
    const second = pair.line.packet!;
    expect(second.stackId).not.toBe(first.stackId);
    expect(second.parentStackId).toBe(first.parentStackId);
    pair = ticks(pair, 54, true, false);
    expect(lots(pair.material, "target").map((lot) => lot.quantity)).toEqual([10_000_000, 10_000_000]);
    expect(lots(pair.material, "source")).toEqual([]);
    expect(readMaterialMassMg(pair.material)).toBe(20_000_000);
    expect(lots(pair.material, "target")[0]).toMatchObject({ grade: "source_grade", condition: .8,
      extensions: { "factory.source": { eventId: "known_finite_test_lot" } } });
  });

  it("FP06-T035 holds real band custody at a full receiver and transfers once after freeing capacity", () => {
    let pair = initial(10_000_000, 0);
    pair = ticks(pair, 154);
    expect(pair.line.packet?.positionMm).toBe(4_000);
    expect(lots(pair.material, "target")).toEqual([]);
    expect(lots(pair.material, "band")[0].quantity).toBe(10_000_000);
    pair = ticks(pair, 30, true, false);
    expect(pair.line.packet?.positionMm).toBe(4_000);
    const containers = pair.material.containers.map((entry) => entry.state.containerId === "target" ? bin("target") : entry);
    pair = { ...pair, material: { ...pair.material, containers } };
    const request = input(pair, true, false);
    const proposal = advanceFactoryBelt(pair.line, request);
    const delivered = commitFactoryBeltStep(pair.line, request, proposal);
    expect(delivered.status).toBe("Committed");
    expect(delivered.line.packet).toBeNull();
    expect(lots(delivered.material, "target")[0].quantity).toBe(10_000_000);
    const replay = commitFactoryBeltStep(delivered.line, { ...request, material: delivered.material }, proposal);
    expect(replay.status).toBe("NoOp");
    expect(replay.material).toBe(delivered.material);
    expect(readMaterialMassMg(replay.material)).toBe(10_000_000);
  });

  it("FP06-T036 persists partial credit/position, freezes without actual power and rejects offline catch-up", () => {
    let pair = ticks(initial(), 37);
    const credit = pair.line.creditMg;
    pair = ticks(pair, 15, false);
    expect(pair.line.creditMg).toBe(credit);
    pair = JSON.parse(JSON.stringify(pair)) as typeof pair;
    expect(pair.line.creditMg).toBe(3_700_000);
    pair = ticks(pair, 63);
    pair = ticks(pair, 17, true, false);
    expect(pair.line.packet?.positionMm).toBe(1_275);
    const before = persistedFacts(pair);
    pair = JSON.parse(JSON.stringify(pair)) as typeof pair;
    pair = ticks(pair, 20, false, false);
    expect(persistedFacts(pair)).toBe(before);
    const request = input(pair, true, false);
    expect(advanceFactoryBelt(pair.line, { ...request, tickEndUs: String(BigInt(request.tickEndUs) + 100_000n * 360_000n) })).toMatchObject({ status: "Rejected" });
    expect(advanceFactoryBelt(pair.line, { ...request, confirmed: false })).toMatchObject({ status: "Rejected" });
    expect(readMaterialMassMg(pair.material)).toBe(10_000_000);
  });

  it("caps credit with no source, uses one occupancy slot and rejects fabricated initial credit", () => {
    let pair = ticks(initial(20_000_000), 150, true, false);
    expect(pair.line.creditMg).toBe(10_000_000);
    pair = step(pair);
    pair = ticks(pair, 30);
    expect(pair.line.packetCursor).toBe(1);
    expect(lots(pair.material, "source")[0].quantity).toBe(10_000_000);
    expect(lots(pair.material, "band")).toHaveLength(1);
    const virgin = initial();
    expect(advanceFactoryBelt({ ...virgin.line, creditMg: 10_000_000 }, input(virgin))).toMatchObject({ status: "Rejected" });
  });

  it("requires actual exact energy, native Device/consumer/tick binding and complete receipt bytes", () => {
    const pair = initial();
    const request = input(pair);
    const modified = (delta: Partial<BeltPowerReceipt["grants"][number]>) => {
      const { canonicalJson: _bytes, digest: _digest, ...body } = request.power;
      const changed = { ...body, grants: [{ ...body.grants[0], ...delta }] };
      return { ...changed, canonicalJson: canonicalJson(changed), digest: canonicalSignature(changed) };
    };
    const partial = advanceFactoryBelt(pair.line, { ...request, power: modified({ allocatedMilliWatt: "90000", work: { n: "9000", d: "1" } }) });
    expect(partial).toMatchObject({ status: "Prepared", outcome: "WAIT_POWER", nextLine: { creditMg: 0, packet: null } });
    for (const delta of [{ deviceInstanceId: "other_drive" }, { portId: "other_port" }, { jobId: "other_job" }, { consumerId: "other_consumer" }]) {
      expect(advanceFactoryBelt(pair.line, { ...request, power: modified(delta) })).toMatchObject({ status: "Rejected" });
    }
    expect(advanceFactoryBelt(pair.line, { ...request, power: { ...request.power, canonicalJson: "{}" } })).toMatchObject({ status: "Rejected" });
    const advanced = step(pair);
    expect(advanceFactoryBelt(advanced.line, { ...input(advanced), power: request.power })).toMatchObject({ status: "Rejected" });
  });

  it("checks actual source-bound geometry/port roles/native directions and rejects route changes", () => {
    const pair = initial();
    const request = input(pair);
    const changes: BeltInstallation[] = [
      { ...installation, lengthMm: 0 }, { ...installation, lengthMm: 4_250 },
      { ...installation, lengthMm: 13_000 }, { ...installation, moduleInstanceIds: ["one_unpaid_module"] },
      { ...installation, source: { ...installation.source, portSourceId: "B09:MAT-IN" } },
      { ...installation, target: { ...installation.target, centerMm: [6_000, 1_250, 6_000] } },
      { ...installation, target: { ...installation.target, outwardNormal: [1, 0, 0] } },
      { ...installation, bandContainerId: "source" }
    ];
    for (const changed of changes) {
      expect(advanceFactoryBelt({ ...pair.line, installation: changed }, { ...request, installation: changed })).toMatchObject({ status: "Rejected" });
    }
    const badNative = bin("target");
    const definition = createResourceContainerDefinition({ ...badNative.definition, transferPorts: [{ portId: "target_in", direction: "Outbound" }] });
    const material = { ...pair.material, containers: pair.material.containers.map((entry) => entry.state.containerId === "target"
      ? createResourceContainerSnapshot(definition, badNative.state, catalog.resources) : entry) };
    expect(advanceFactoryBelt(pair.line, { ...request, material })).toMatchObject({ status: "Rejected" });
    expect(advanceFactoryBelt(pair.line, { ...request, installation: { ...installation, revision: 2 } })).toMatchObject({ status: "Rejected" });
  });

  it("rejects stale receiver/capacity/clock and forged candidates without a material or position partial commit", () => {
    let pair = ticks(initial(), 100);
    pair = ticks(pair, 53, true, false);
    const request = input(pair, true, false);
    const proposal = advanceFactoryBelt(pair.line, request);
    expect(proposal.status).toBe("Prepared");
    const material = { ...pair.material, containers: pair.material.containers.map((entry) => entry.state.containerId === "target" ? bin("target", [], 0) : entry) };
    const stale = commitFactoryBeltStep(pair.line, { ...request, material }, proposal);
    expect(stale).toMatchObject({ status: "Rejected", line: pair.line, material });
    expect(stale.line.packet?.positionMm).toBe(3_975);
    expect(lots(stale.material, "band")[0].quantity).toBe(10_000_000);
    if (proposal.status !== "Prepared") throw new Error("Unreachable");
    const forged = { ...proposal, nextLine: { ...proposal.nextLine, creditMg: 10_000_000 } };
    expect(commitFactoryBeltStep(pair.line, request, forged)).toMatchObject({ status: "Rejected", line: pair.line, material: pair.material });
    const committed = commitFactoryBeltStep(pair.line, request, proposal);
    expect(committed.status).toBe("Committed");
    expect(advanceFactoryBelt(committed.line, { ...request, material: committed.material })).toMatchObject({ status: "Rejected" });
    expect(commitFactoryBeltStep({ ...pair.line, revision: pair.line.revision + 1 }, request, proposal)).toMatchObject({ status: "Rejected" });
  });

  it("starts a newly installed line at the current confirmed factory cursor with zero historical credit", () => {
    const virgin = initial();
    const pair = { ...virgin, line: { ...virgin.line, tickEndUs: "30000000" } };
    const proposal = advanceFactoryBelt(pair.line, input(pair));
    expect(proposal).toMatchObject({ status: "Prepared", outcome: "WAIT_CREDIT", nextLine: { tickEndUs: "30100000", creditMg: 100_000, packet: null } });
  });

  it("rejects a forged no-op acknowledgement for a never-adopted confirmed step", () => {
    const pair = initial();
    const request = input(pair);
    const proposal = advanceFactoryBelt(pair.line, request);
    if (proposal.status !== "Prepared") throw new Error(proposal.reason);
    expect(commitFactoryBeltStep(pair.line, request, { ...proposal, nextLine: pair.line })).toMatchObject({ status: "Rejected", line: pair.line, material: pair.material });
  });

  it("rejects a wrong material family at Cutter IN-STEEL despite generic native container rights", () => {
    const pair = initial();
    const elastomer = catalog.items.find((entry) => entry.sourceId === "fp02.bulk.elastomer_reclaimed")!;
    const cutter = catalog.devices.find((entry) => entry.sourceId === "B06")!;
    const changed: BeltInstallation = { ...installation, target: { ...installation.target, deviceId: "B06", deviceDigest: cutter.digest,
      portSourceId: "B06:IN-STEEL", placementCenterMm: [7_500, 0, 6_000] } };
    const material = createFactoryMaterialView(catalog, [bin("source", [{ stackId: "elastomer_parent", resourceId: elastomer.resourceId, quantity: 10_000_000 }]), bin("band", [], 10), bin("target")]);
    const request = { ...input(pair), installation: changed, material, sourceLot: { stackId: "elastomer_parent", itemId: elastomer.sourceId } };
    expect(advanceFactoryBelt({ ...pair.line, installation: changed }, request)).toMatchObject({ status: "Rejected" });
  });

  it("rejects a stale production RecipeRef before transporting its native lot", () => {
    const pair = initial();
    const material = createFactoryMaterialView(catalog, [bin("source", [{ stackId: "steel_parent", resourceId: item.resourceId, quantity: 10_000_000,
      extensions: { "factory.production": { recipeRef: { sourceId: "REC-01-CUT", version: 1, digest: "stale_recipe_digest" }, sourceLots: [] } } }]), bin("band", [], 10), bin("target")]);
    expect(advanceFactoryBelt(pair.line, { ...input(pair), material })).toMatchObject({ status: "Rejected" });
  });

  it("admits an explicit 8kg Cutter batch from a native20kg parent", () => {
    const virgin = initial(20_000_000, 8);
    const cutter = catalog.devices.find((entry) => entry.sourceId === "B06")!;
    const changed: BeltInstallation = { ...installation, target: { ...installation.target, deviceId: "B06", deviceDigest: cutter.digest,
      portSourceId: "B06:IN-STEEL", placementCenterMm: [7_500, 0, 6_000] } };
    let pair = { ...virgin, line: { ...virgin.line, installation: changed } };
    pair = ticks(pair, 79, true, true, 8_000_000);
    expect(pair.line.packet).toBeNull();
    pair = step(pair, true, true, 8_000_000);
    expect(pair.line.packet?.positionMm).toBe(0);
    expect(lots(pair.material, "source")[0].quantity).toBe(12_000_000);
    expect(lots(pair.material, "band")[0].quantity).toBe(8_000_000);
    expect(pair.line.creditMg).toBe(0);
    pair = ticks(pair, 54, true, false);
    expect(pair.line.packet).toBeNull();
    expect(lots(pair.material, "target")[0].quantity).toBe(8_000_000);
    expect(readMaterialMassMg(pair.material)).toBe(20_000_000);
  });

  it("rejects invalid intake commands instead of rounding or ignoring the source quantity", () => {
    const pair = initial(20_000_000);
    for (const quantity of [0, -1, .5, 10_000_001, 20_000_001, Number.MAX_SAFE_INTEGER + 1]) {
      expect(advanceFactoryBelt(pair.line, input(pair, true, true, quantity))).toMatchObject({ status: "Rejected" });
    }
    const small = initial(4_000_000);
    expect(advanceFactoryBelt(small.line, input(small, true, true, 8_000_000))).toMatchObject({ status: "Rejected" });
  });
});
