import { describe, expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import type { FactoryCatalog, FactoryItem } from "../../../src/factory/contracts";
import { validateFactoryAmount } from "../../../src/factory/material/quantity";
import { readMaterialMassMg } from "../../../src/factory/material/resourcesAdapter";
import { commitFactoryMaterialStep, createFactoryMaterialView, prepareFactoryMaterialStep, type MaterialIntent, type MaterialView } from "../../../src/factory/material/reservations";
import { createResourceCatalog } from "../../../src/resources/catalog";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState, type ResourceContainerSnapshot } from "../../../src/resources/containers";
import { canonicalJson, canonicalSignature } from "../../../src/resources/serialization";

const fixture = createFp02Fixture("cargo");
const item = (catalog: FactoryCatalog, sourceId: string) => catalog.items.find((entry) => entry.sourceId === sourceId)!;
const bin = (id: string, catalog = fixture.catalog, contents: readonly unknown[] = [], maxMassKg = 4_000, maxVolumeM3 = 30, extra: Record<string, unknown> = {}): ResourceContainerSnapshot =>
  createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: id, kind: "OutpostStorage", maxMassKg, maxVolumeM3, maxStackCount: 200, ...extra }),
    createResourceContainerState({ containerId: id, contents, ownerId: "pilot" }, catalog.resources), catalog.resources);
const cargo = () => createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: fixture.resourceState.containerId, kind: "ShipCargo", maxMassKg: 4_000, maxVolumeM3: 30, maxStackCount: 200 }), fixture.resourceState, fixture.catalog.resources);
const view = () => createFactoryMaterialView(fixture.catalog, [cargo(), bin("wip_a"), bin("wip_b"), bin("product"), bin("offcut")]);
const commit = (current: MaterialView, intent: MaterialIntent) => {
  const plan = prepareFactoryMaterialStep(current, intent);
  if (plan.status !== "Prepared") throw new Error(`Unexpected prepare rejection: ${plan.reason}`);
  return commitFactoryMaterialStep(current, plan);
};
const contents = (v: MaterialView, id: string) => v.containers.find((entry) => entry.state.containerId === id)!.state.contents;
const containerBytes = (v: MaterialView) => canonicalJson(v.containers.map((snapshot) => ({ definition: snapshot.definition, state: snapshot.state })));
const move = (v: MaterialView, sourceId: string, quantityUnits: number, targetContainerId: string, targetStackId: string) => ({
  sourceContainerId: fixture.resourceState.containerId, sourceStackId: contents(v, fixture.resourceState.containerId).find((stack) => stack.resourceId === item(v.catalog, sourceId).resourceId)!.stackId,
  targetContainerId, targetStackId, itemId: sourceId, quantityUnits
});
const startCut = (v: MaterialView): MaterialIntent => ({ kind: "reserve", transactionId: "start_cut", ownerId: "job_cut", actorId: "pilot", reservationId: "cut_outputs", wipContainerId: "wip_a",
  recipeRef: { sourceId: "REC-01-CUT", version: 1, digest: v.catalog.recipes[0].digest }, moves: [move(v, "fp02.bulk.steel_known", 8_000_000, "wip_a", "cut_input")],
  outputs: [{ itemId: "fp02.bulk.steel_semi", quantityUnits: 7_500_000, targetContainerId: "product", stackId: "cut_semi" }, { itemId: "fp02.bulk.steel_offcut", quantityUnits: 500_000, targetContainerId: "offcut", stackId: "cut_offcut" }] });

/** Isolated, versioned admission fixture. This adds no real rock/gravel cargo or mining authority. */
const syntheticGravelCatalog = (): FactoryCatalog => {
  const original = item(fixture.catalog, "fp02.bulk.gravel_mix");
  const unsigned = { ...original, sourceRef: "TEST:synthetic-gravel-capacity-profile-v1", volumeProfile: { kind: "derived-capacity-envelope" as const, version: "fp06-conservative-envelope-v1" as const,
    numeratorMm3: 1, denominatorUnits: 1, sourceRefs: ["TEST:synthetic-gravel-capacity-profile-v1"] } };
  const profile: FactoryItem = Object.freeze({ ...unsigned, digest: canonicalSignature(unsigned) });
  const resources = createResourceCatalog({ catalogId: "synthetic_gravel_profile_v1", categories: fixture.catalog.resources.categories,
    resources: [...fixture.catalog.resources.resources, { ...fixture.catalog.resources.resources.find((entry) => entry.resourceId === "fp02_bulk_steel_known")!, resourceId: profile.resourceId,
      displayName: "Synthetic test-only gravel v1", massPerUnitKg: 0.000001, volumePerUnitM3: 0.000000001 }] });
  const catalog = { ...fixture.catalog, items: fixture.catalog.items.map((entry) => entry.sourceId === profile.sourceId ? profile : entry), resources,
    catalogDigest: "TEST:synthetic-gravel-capacity-profile-v1", canonicalJson: canonicalJson({ profile, resourceCatalog: resources.canonicalJson }) };
  return Object.freeze(catalog);
};

describe("FP06 exact material transactions over Resources snapshots", () => {
  it("FP06-T009 splits one explicitly synthetic 20kg origin into two unique 10kg children without an available parent", () => {
    const catalog = syntheticGravelCatalog();
    const source = bin("synthetic_source", catalog, [{ stackId: "gravel_parent", resourceId: item(catalog, "fp02.bulk.gravel_mix").resourceId, quantity: 20_000_000,
      extensions: { "factory.source": { sourceEventId: "synthetic_gravel_event_v1" } } }]);
    const initial = createFactoryMaterialView(catalog, [source, bin("packets", catalog)]);
    const intent: MaterialIntent = { kind: "split", transactionId: "split_gravel", ownerId: "belt_a", actorId: "pilot", sourceContainerId: "synthetic_source", sourceStackId: "gravel_parent",
      children: [{ targetContainerId: "packets", stackId: "gravel_child_a", quantityUnits: 10_000_000 }, { targetContainerId: "packets", stackId: "gravel_child_b", quantityUnits: 10_000_000 }] };
    const plan = prepareFactoryMaterialStep(initial, intent);
    expect(plan.status).toBe("Prepared");
    if (plan.status !== "Prepared") return;
    const result = commitFactoryMaterialStep(initial, plan);
    expect(result.status).toBe("Committed");
    expect(readMaterialMassMg(result.view)).toBe(20_000_000);
    expect(contents(result.view, "synthetic_source")).toEqual([]);
    expect(contents(result.view, "packets").map((stack) => [stack.stackId, stack.quantity])).toEqual([["gravel_child_a", 10_000_000], ["gravel_child_b", 10_000_000]]);
    for (const stack of contents(result.view, "packets")) {
      expect(stack.extensions["factory.source"]).toEqual({ sourceEventId: "synthetic_gravel_event_v1" });
      expect(stack.extensions["factory.partition"]).toMatchObject({ parentStackId: "gravel_parent", childStackId: stack.stackId, transactionId: "split_gravel" });
    }
    expect(commitFactoryMaterialStep(result.view, plan)).toMatchObject({ status: "NoOp", view: result.view });
    expect(source.state.contents[0].quantity).toBe(20_000_000);
  });

  it("FP06-T010 gives the actual finite C26 chassis to exactly one WIP owner", () => {
    const initial = view();
    const intent: MaterialIntent = { kind: "reserve", transactionId: "build_a", ownerId: "build_job_a", actorId: "pilot", reservationId: "build_a_hold", wipContainerId: "wip_a",
      moves: [move(initial, "fp02.chassis.cutter", 1, "wip_a", "c26_in_wip")], outputs: [] };
    const planA = prepareFactoryMaterialStep(initial, intent);
    const planB = prepareFactoryMaterialStep(initial, { ...intent, transactionId: "build_b", ownerId: "build_job_b", reservationId: "build_b_hold", wipContainerId: "wip_b",
      moves: [move(initial, "fp02.chassis.cutter", 1, "wip_b", "c26_second_claim")] });
    expect(planA.status).toBe("Prepared");
    expect(planB.status).toBe("Prepared");
    if (planA.status !== "Prepared" || planB.status !== "Prepared") return;
    const first = commitFactoryMaterialStep(initial, planA);
    expect(first.status).toBe("Committed");
    const second = commitFactoryMaterialStep(first.view, planB);
    expect(second).toMatchObject({ status: "Rejected", reason: "StaleMaterialView", view: first.view });
    expect(contents(first.view, "wip_a")[0].resourceId).toBe("fp02_chassis_cutter");
    expect(contents(first.view, fixture.resourceState.containerId).some((s) => s.resourceId === "fp02_chassis_cutter")).toBe(false);
    expect(readMaterialMassMg(first.view)).toBe(2_984_400_000);
  });

  it("FP06-T011 rejects changed target capacity even when its revision is unchanged", () => {
    const initial = view();
    const intent: MaterialIntent = { kind: "transfer", transactionId: "transfer_steel", ownerId: "pilot", actorId: "pilot", moves: [move(initial, "fp02.bulk.steel_known", 8_000_000, "product", "steel_product")] };
    const plan = prepareFactoryMaterialStep(initial, intent);
    if (plan.status !== "Prepared") throw new Error(plan.reason);
    const changed = { ...initial, containers: initial.containers.map((s) => s.state.containerId === "product" ? bin("product", initial.catalog, [], 1, 30) : s) };
    const before = containerBytes(changed);
    expect(commitFactoryMaterialStep(changed, plan)).toMatchObject({ status: "Rejected", reason: "StaleMaterialView", view: changed });
    expect(containerBytes(changed)).toBe(before);
    const revised = { ...initial, revision: initial.revision + 1 };
    expect(commitFactoryMaterialStep(revised, plan)).toMatchObject({ status: "Rejected", reason: "StaleMaterialView", view: revised });
  });

  it("FP06-T012 rejects foreign fractions and overflow without a rounded credit", () => {
    for (const amount of [0, -1, 0.1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => validateFactoryAmount("fp02.bulk.steel_known", amount, fixture.catalog)).toThrow();
    expect(() => validateFactoryAmount("fp02.chassis.cutter", 0.5, fixture.catalog)).toThrow();
    expect(() => validateFactoryAmount("fp02.chassis.cutter", Number.MAX_SAFE_INTEGER, fixture.catalog)).toThrow(/overflow/i);
    expect(validateFactoryAmount("fp02.comp.field_cable", 1, fixture.catalog)).toMatchObject({ quantityUnits: 1, massMg: 250, quantityBasis: "mm" });
    const initial = view();
    const rejected = prepareFactoryMaterialStep(initial, { kind: "transfer", transactionId: "invalid_fraction", ownerId: "pilot", moves: [move(initial, "fp02.bulk.steel_known", 0.1, "product", "bad_credit")] });
    expect(rejected.status).toBe("Rejected");
    expect(initial.revision).toBe(0);
    expect(contents(initial, "product")).toEqual([]);
  });

  it("admits exact rational packed volume, with no per-mg rounding", () => {
    const sheet = item(fixture.catalog, "fp02.bulk.steel_sheet");
    const source = bin("sheet_source", fixture.catalog, [{ stackId: "sheet_lot", resourceId: sheet.resourceId, quantity: 4 }]);
    const initial = createFactoryMaterialView(fixture.catalog, [source, bin("tiny_target", fixture.catalog, [], 1, 5e-9)]);
    const request: MaterialIntent = { kind: "transfer", transactionId: "rational_transfer", ownerId: "pilot", moves: [{ sourceContainerId: "sheet_source", sourceStackId: "sheet_lot", targetContainerId: "tiny_target", targetStackId: "small_sheet", itemId: sheet.sourceId, quantityUnits: 4 }] };
    expect(prepareFactoryMaterialStep(initial, request)).toMatchObject({ status: "Rejected", reason: "TargetVolumeExceeded" });
    expect(commit(initial, { ...request, moves: [{ ...request.moves[0], quantityUnits: 3 }] }).status).toBe("Committed");
  });

  it("holds inputs once in actual WIP and completes recipe products plus offcut atomically and idempotently", () => {
    const initial = view();
    const started = commit(initial, startCut(initial));
    expect(started.status).toBe("Committed");
    expect(contents(started.view, "wip_a")[0].quantity).toBe(8_000_000);
    expect(contents(started.view, "product")).toEqual([]);
    expect(started.view.reservations).toHaveLength(1);
    const finish: MaterialIntent = { kind: "finish-recipe", transactionId: "finish_cut", ownerId: "job_cut", actorId: "pilot", reservationId: "cut_outputs" };
    const plan = prepareFactoryMaterialStep(started.view, finish);
    if (plan.status !== "Prepared") throw new Error(plan.reason);
    const completed = commitFactoryMaterialStep(started.view, plan);
    expect(completed.status).toBe("Committed");
    expect(contents(completed.view, "wip_a")).toEqual([]);
    expect(contents(completed.view, "product")).toMatchObject([{ resourceId: "fp02_bulk_steel_semi", quantity: 7_500_000 }]);
    expect(contents(completed.view, "offcut")).toMatchObject([{ resourceId: "fp02_bulk_steel_offcut", quantity: 500_000 }]);
    expect(readMaterialMassMg(completed.view)).toBe(2_984_400_000);
    expect(completed.view.reservations).toEqual([]);
    expect(commitFactoryMaterialStep(completed.view, plan)).toMatchObject({ status: "NoOp", view: completed.view });
  });

  it("refuses another owner filling reserved output space and refuses an occupied WIP release", () => {
    const original = view();
    const initial = { ...original, containers: original.containers.map((s) => s.state.containerId === "product" ? bin("product", fixture.catalog, [], 7.5, 30) : s) };
    const started = commit(initial, startCut(initial));
    const competing: MaterialIntent = { kind: "transfer", transactionId: "fill_output", ownerId: "other_job", actorId: "pilot", moves: [move(started.view, "fp02.bulk.steel_known", 1, "product", "other_steel")] };
    expect(prepareFactoryMaterialStep(started.view, competing)).toMatchObject({ status: "Rejected", reason: "TargetMassExceeded" });
    expect(prepareFactoryMaterialStep(started.view, { kind: "release", transactionId: "foreign_release", ownerId: "other_job", reservationId: "cut_outputs" })).toMatchObject({ status: "Rejected", reason: "ReservationOwnerMismatch" });
    expect(prepareFactoryMaterialStep(started.view, { kind: "release", transactionId: "occupied_release", ownerId: "job_cut", reservationId: "cut_outputs" })).toMatchObject({ status: "Rejected", reason: "WipOccupied" });
  });

  it("rejects incomplete recipe input, conflicting request IDs and forged candidates", () => {
    const initial = view();
    const cut = startCut(initial);
    if (cut.kind !== "reserve") throw new Error("bad test intent");
    expect(prepareFactoryMaterialStep(initial, { ...cut, moves: [{ ...cut.moves[0], quantityUnits: 7_999_999 }] })).toMatchObject({ status: "Rejected", reason: "RecipeInputMismatch" });
    const started = commit(initial, cut);
    expect(prepareFactoryMaterialStep(started.view, { ...cut, ownerId: "different_job" })).toMatchObject({ status: "Rejected", reason: "IdempotencyConflict" });
    const plan = prepareFactoryMaterialStep(initial, cut);
    if (plan.status !== "Prepared") throw new Error(plan.reason);
    const forged = { ...plan, candidate: { ...plan.candidate, revision: 100 } };
    expect(commitFactoryMaterialStep(initial, forged)).toMatchObject({ status: "Rejected", reason: "InvalidMaterialPlan", view: initial });
  });

  it("keeps multi-source failure atomic and preserves ownership, access and mission restrictions", () => {
    const initial = view();
    const cut = startCut(initial);
    if (cut.kind !== "reserve") throw new Error("bad test intent");
    const sourceBefore = containerBytes(initial);
    const { recipeRef: _recipeRef, ...genericHold } = cut;
    expect(prepareFactoryMaterialStep(initial, { ...genericHold, moves: [...cut.moves, { ...cut.moves[0], sourceStackId: "missing_stack", targetStackId: "missing_product" }] }).status).toBe("Rejected");
    expect(containerBytes(initial)).toBe(sourceBefore);
    const ownedSource = bin("owned_source", fixture.catalog, [{ stackId: "owned_steel", resourceId: "fp02_bulk_steel_known", quantity: 10, ownerId: "pilot" }], 1, 1, { policy: { ownershipPolicy: "OwnerOnly" } });
    const owned = createFactoryMaterialView(fixture.catalog, [ownedSource, bin("open_target")]);
    const request: MaterialIntent = { kind: "transfer", transactionId: "steal_steel", ownerId: "outsider", actorId: "outsider", moves: [{ sourceContainerId: "owned_source", sourceStackId: "owned_steel", targetContainerId: "open_target", targetStackId: "stolen", itemId: "fp02.bulk.steel_known", quantityUnits: 10 }] };
    expect(prepareFactoryMaterialStep(owned, request)).toMatchObject({ status: "Rejected", reason: "OwnershipDenied" });
    const restricted = { ...owned, containers: [bin("owned_source", fixture.catalog, ownedSource.state.contents, 1, 1, { policy: { allowedActorIds: ["pilot"] } }), bin("open_target")] };
    expect(prepareFactoryMaterialStep(restricted, request)).toMatchObject({ status: "Rejected", reason: "AccessDenied" });
  });

  it("does not admit unbound real rock/gravel volumes or duplicate serialized identities", () => {
    expect(() => validateFactoryAmount("fp02.bulk.gravel_mix", 20_000_000, fixture.catalog)).toThrow(/volume|unknown/i);
    const first = cargo();
    expect(() => createFactoryMaterialView(fixture.catalog, [first, bin("duplicate", fixture.catalog, [first.state.contents[0]])])).toThrow(/duplicate/i);
  });

  it("locks recipe WIP against ordinary transfers even by its owner, retaining the material for authorized completion", () => {
    const initial = view();
    const started = commit(initial, startCut(initial));
    const request: MaterialIntent = { kind: "transfer", transactionId: "pull_workpiece", ownerId: "job_cut", actorId: "pilot", moves: [{ sourceContainerId: "wip_a", sourceStackId: "cut_input",
      targetContainerId: "product", targetStackId: "pretend_pristine", itemId: "fp02.bulk.steel_known", quantityUnits: 8_000_000 }] };
    expect(prepareFactoryMaterialStep(started.view, request)).toMatchObject({ status: "Rejected", reason: "RecipeWipLocked" });
    expect(contents(started.view, "wip_a")[0].quantity).toBe(8_000_000);
  });

  it("preserves directional ports and mission locks, and verifies output filters before starting a job", () => {
    const source = bin("port_source", fixture.catalog, [{ stackId: "port_steel", resourceId: "fp02_bulk_steel_known", quantity: 10, missionId: "mission_a" }], 1, 1,
      { transferPorts: [{ portId: "only_in", direction: "Inbound" }] });
    const initial = createFactoryMaterialView(fixture.catalog, [source, bin("port_target")]);
    const request: MaterialIntent = { kind: "transfer", transactionId: "wrong_port", ownerId: "pilot", actorId: "pilot", moves: [{ sourceContainerId: "port_source", sourceStackId: "port_steel",
      sourcePortId: "only_in", targetContainerId: "port_target", targetStackId: "port_copy", itemId: "fp02.bulk.steel_known", quantityUnits: 10 }] };
    expect(prepareFactoryMaterialStep(initial, request)).toMatchObject({ status: "Rejected", reason: "AccessDenied" });
    const missionView = createFactoryMaterialView(fixture.catalog, [bin("port_source", fixture.catalog, source.state.contents), bin("port_target")]);
    const { sourcePortId: _sourcePortId, ...unrestrictedMove } = request.moves[0];
    expect(prepareFactoryMaterialStep(missionView, { ...request, moves: [unrestrictedMove] })).toMatchObject({ status: "Rejected", reason: "MissionLocked" });
    expect(commit(missionView, { ...request, missionId: "mission_a", moves: [unrestrictedMove] }).status).toBe("Committed");
    const original = view();
    // Use an actual source tag rather than inventing a filtering convention.
    const tag = fixture.catalog.resources.resources.find((entry) => entry.resourceId === "fp02_bulk_steel_semi")!.tags[0];
    const filtered = { ...original, containers: original.containers.map((s) => s.state.containerId === "product" ? bin("product", fixture.catalog, [], 4_000, 30, { policy: { blockedTags: [tag] } }) : s) };
    expect(prepareFactoryMaterialStep(filtered, startCut(filtered))).toMatchObject({ status: "Rejected", reason: "ResourceTagBlocked" });
    expect(contents(filtered, "wip_a")).toEqual([]);
  });

  it("releases only an empty owner-bound reservation and rejects nonquantized container capacity", () => {
    const initial = view();
    const reserved = commit(initial, { kind: "reserve", transactionId: "reserve_empty", ownerId: "future_job", reservationId: "empty_outputs", wipContainerId: "wip_a", moves: [],
      outputs: [{ itemId: "fp02.bulk.steel_semi", quantityUnits: 7_500_000, targetContainerId: "product", stackId: "future_semi" }] });
    expect(reserved.view.reservations).toHaveLength(1);
    const released = commit(reserved.view, { kind: "release", transactionId: "release_empty", ownerId: "future_job", reservationId: "empty_outputs" });
    expect(released.status).toBe("Committed");
    expect(released.view.reservations).toEqual([]);
    expect(readMaterialMassMg(released.view)).toBe(readMaterialMassMg(initial));
    expect(() => createFactoryMaterialView(fixture.catalog, [bin("fractional_capacity", fixture.catalog, [], 0.0000001, 1)])).toThrow(/NonQuantizedMassCapacity/);
  });

  it("preserves declared source grade and condition instead of silently upgrading the finished material", () => {
    const original = view();
    const source = contents(original, fixture.resourceState.containerId).map((stack) => stack.resourceId === "fp02_bulk_steel_known" ? { ...stack, grade: "declared_grade", condition: 0.4 } : stack);
    const initial = createFactoryMaterialView(fixture.catalog, original.containers.map((snapshot) => snapshot.state.containerId === fixture.resourceState.containerId ? bin(fixture.resourceState.containerId, fixture.catalog, source) : snapshot));
    const started = commit(initial, startCut(initial));
    const finished = commit(started.view, { kind: "finish-recipe", transactionId: "finish_graded_cut", ownerId: "job_cut", actorId: "pilot", reservationId: "cut_outputs" });
    expect(contents(finished.view, "product")[0]).toMatchObject({ grade: "declared_grade", condition: 0.4 });
    expect(contents(finished.view, "offcut")[0]).toMatchObject({ grade: "declared_grade", condition: 0.4 });
  });

  it("rejects a recipe combining incompatible declared grades before withdrawing any inputs", () => {
    const original = view();
    const source = contents(original, fixture.resourceState.containerId).map((stack) => stack.resourceId === "fp02_bulk_steel_profile" ? { ...stack, grade: "grade_a" }
      : stack.resourceId === "fp02_bulk_steel_sheet" ? { ...stack, grade: "grade_b" } : stack);
    const initial = createFactoryMaterialView(fixture.catalog, original.containers.map((snapshot) => snapshot.state.containerId === fixture.resourceState.containerId ? bin(fixture.resourceState.containerId, fixture.catalog, source) : snapshot));
    const recipe = fixture.catalog.recipes.find((entry) => entry.sourceId === "REC-05-BRACE")!;
    const request: MaterialIntent = { kind: "reserve", transactionId: "mixed_grade_brace", ownerId: "bench_job", actorId: "pilot", reservationId: "brace_outputs", wipContainerId: "wip_a",
      recipeRef: { sourceId: recipe.sourceId, version: recipe.version, digest: recipe.digest },
      moves: [move(initial, "fp02.bulk.steel_profile", 4_000_000, "wip_a", "brace_profiles"), move(initial, "fp02.bulk.steel_sheet", 2_000_000, "wip_a", "brace_sheet")],
      outputs: [{ itemId: "fp02.comp.small_brace", quantityUnits: 1, targetContainerId: "product", stackId: "brace_product" }, { itemId: "fp02.bulk.steel_offcut", quantityUnits: 200_000, targetContainerId: "offcut", stackId: "brace_offcut" }] };
    expect(prepareFactoryMaterialStep(initial, request)).toMatchObject({ status: "Rejected", reason: "MixedMaterialQuality" });
    expect(contents(initial, "wip_a")).toEqual([]);
  });
});
