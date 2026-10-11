import { materializeFactoryStartSite } from "../../../src/factory/fixtures/startSite";
import { describe, expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createFactoryMaterialView } from "../../../src/factory/material/reservations";
import { readMaterialMassMg } from "../../../src/factory/material/resourcesAdapter";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../../src/resources/containers";
import { canonicalJson } from "../../../src/resources/serialization";
import { createFactoryInstallationProfile, transformFactoryPoint } from "../../../src/factory/construction/installationProfile";
import { prepareFactoryPlacement } from "../../../src/factory/construction/placement";
import { createFactoryConstruction } from "../../../src/factory/construction/buildStep";
import { createFactoryBuildTool } from "../../../src/factory/ui/buildTool";

const fixture = createFp02Fixture("cargo");
const material = () => createFactoryMaterialView(fixture.catalog, [createResourceContainerSnapshot(
  createResourceContainerDefinition({ containerId: fixture.resourceState.containerId, kind: "ShipCargo", maxMassKg: 4000, maxVolumeM3: 30, maxStackCount: 200 }), fixture.resourceState, fixture.catalog.resources)]);
const materialBytes = (value: ReturnType<typeof material>) => canonicalJson({ catalogBytes: value.catalog.canonicalJson, revision: value.revision,
  containers: value.containers.map(s => ({ definitionBytes: s.definition.canonicalJson, stateBytes: s.state.canonicalJson })), reservations: value.reservations, receipts: value.receipts });
const request = { transactionId: "build_cut_1", instanceId: "factory_cut_1", definitionSourceId: "B06", centerMm: [-6250, 1500, 5000], quarterTurns: 1 };
/** Explicit headless terrain/read/actor fixture; native Browser evidence is separate. */
const view = () => ({ binding: { sessionId: "factory_test", epoch: 1, terrainRevision: 0, sourceDigest: "fixture-flat-limestone-v1", baseDigest: "fixture-flat-limestone-v1", facilityRevision: 0 },
  cargoAccess:{ownerId:"fp02_wreck_owner",containerId:"fp02_wreck_cargo",opened:true,sourceDigest:"fixture-flat-limestone-v1",profileDigest:"explicit-synthetic-headless-access-v1",positionMm:[-4750,1500,5000],accessBoundsMm:{min:[-5000,1500,4750] as const,max:[-4500,3000,5250] as const},bodyHandle:0},
  material: material(), installations: [], actor: { actorId: "pilot", ownerId: fixture.resourceState.ownerId, positionMm: [-4750, 2400, 5000], cargoPositionMm: [-4750, 1500, 5000], canBuild: true },
  terrain: { cellMm: 125, originMm: [-16000, -8000, -16000], size: [256, 128, 256], readSlot: (_x: number, y: number, _z: number) => y <= 75 ? 1 : 0 } });

describe("W07 source-bound paid placement", () => {
  it("freezes source geometry separately and transforms East+X/North+Z into accepted site World-Z/+X", () => {
    const p = createFactoryInstallationProfile("B06");
    expect(p).toMatchObject({ version: "fp06-installation-profile-v1", definitionRef: { sourceId: "B06" }, massMg: 208_000_000 });
    expect(p.supportPatchesMm).toHaveLength(4);
    expect(p.colliders.length).toBeGreaterThan(0);
    expect(transformFactoryPoint([1500, 1000, 0], request.centerMm, 1)).toEqual([-6250, 2500, 3500]);
    expect(transformFactoryPoint([0, 0, 1000], request.centerMm, 1)).toEqual([-5250, 1500, 5000]);
    expect(fixture.catalog.devices.find(d => d.sourceId === "B06")!.ports.find(p => p.role === "PowerConsumer")!.centerMm).toBeNull();
  });
  it("FP06-T029 prepares one paid208kg Cutter while retaining all actual finite BOM original identities", () => {
    const initial = view(), before = materialBytes(initial.material);
    const plan = prepareFactoryPlacement(initial, request);
    expect(plan.status).toBe("Prepared");
    if (plan.status !== "Prepared") throw new Error(plan.reason);
    expect(plan.installation.massMg).toBe(208_000_000);
    expect(plan.materialCandidate.containers.find((s: any) => s.state.containerId === plan.installation.materialContainerId)!.currentMassKg).toBe(208);
    expect(readMaterialMassMg(plan.materialCandidate)).toBe(2_984_400_000);
    const remaining = plan.materialCandidate.containers.find((s: any) => s.state.containerId === fixture.resourceState.containerId)!.state.contents;
    expect(remaining.find((s: any) => s.resourceId === "fp02_bulk_steel_profile")!.quantity).toBe(68_000_000);
    expect(remaining.find((s: any) => s.resourceId === "fp02_bulk_steel_sheet")!.quantity).toBe(50_000_000);
    expect(remaining.some((s: any) => s.resourceId === "fp02_chassis_cutter")).toBe(false);
    expect(materialBytes(initial.material)).toBe(before);
  });
  it("FP06-T030 selecting/moving then Escape cancels a ghost without material mutation or reservations", () => {
    const initial = view(); const before = materialBytes(initial.material);
    const construction = createFactoryConstruction({ readPlacementView: () => initial }, initial.material);
    const tool = createFactoryBuildTool(construction); tool.select(request);
    expect(tool.read()).not.toBeNull();
    tool.cancel(); expect(tool.read()).toBeNull();
    expect(materialBytes(construction.read().material)).toBe(before);
    expect(construction.read().material.reservations).toEqual([]);
    expect(construction.read().installations).toEqual([]);
  });
  it("FP06-T032 rejects actual unknown support before reserving materials", () => {
    const initial = view(); const before = materialBytes(initial.material);
    const unknown = { ...initial, terrain: { ...initial.terrain, readSlot: () => undefined } };
    expect(prepareFactoryPlacement(unknown, request)).toMatchObject({ status: "Rejected", reason: "TERRAIN_UNKNOWN" });
    expect(materialBytes(unknown.material)).toBe(before);
  });
});


describe("W07 stale ghost and transaction failures",()=>{
  it("FP06-T031 rechecks terrain/material/epoch changes after preview, before any native stage",async()=>{
    let initial=view();let stages=0;
    const construction=createFactoryConstruction({readPlacementView:()=>initial,prepareNative:async()=>{stages++;}},initial.material);
    const plan=construction.preview(request);expect(plan.status).toBe("Prepared");if(plan.status!=="Prepared")throw new Error(plan.reason);
    initial={...initial,binding:{...initial.binding,terrainRevision:1}};
    expect(await construction.commit(plan)).toMatchObject({status:"Rejected",reason:"STALE_PLACEMENT"});expect(stages).toBe(0);expect(readMaterialMassMg(construction.read().material)).toBe(2_984_400_000);
  });
  it("FP06-T032 a rejected Native prepare preserves finite BOM without any refund or installed owner",async()=>{
    const initial=view();const before=materialBytes(initial.material);
    const construction=createFactoryConstruction({readPlacementView:()=>initial,pause:async()=>{},prepareNative:async()=>{throw new Error("NATIVE_REJECTED");},commitNative:async()=>{},publishNative:()=>{},rollbackNative:async()=>{},finalizeNative:async()=>{},stageProjection:async()=>{},publishProjection:()=>{},rollbackProjection:()=>{},finalizeProjection:()=>{}},initial.material);
    const plan=construction.preview(request);if(plan.status!=="Prepared")throw new Error(plan.reason);
    expect(await construction.commit(plan)).toMatchObject({status:"Rejected",reason:"NATIVE_REJECTED"});expect(construction.read().state).toBe("Ready");expect(materialBytes(construction.read().material)).toBe(before);expect(construction.read().installations).toEqual([]);
  });
});


it("W07 actual accepted Layout A has four solid feet, known body/service air and a fully admitted source-bound Cutter",()=>{
  const source=materializeFactoryStartSite(),initial=view();
  const actual={...initial,terrain:{...initial.terrain,readSlot:(x:number,y:number,z:number)=>source.readSlot(x,y,z)}};
  expect(prepareFactoryPlacement(actual,request)).toMatchObject({status:"Prepared"});
});


it("W07 reserves the actual normative1m service corridor immediately at the Cutter edge, including the old S0-authoring gap",()=>{
  const initial=view();
  const obstacle={instanceId:"explicit_headless_service_obstacle",definitionSourceId:"explicit_synthetic_box",profileDigest:"test-only",sourceDigest:"test-only",massMg:1,materialContainerId:"test-only",centerMm:[-5125,1750,5000] as const,quarterTurns:0,
    boundsMm:{min:[-5175,1500,4950] as const,max:[-5075,2000,5050] as const},serviceBoundsMm:{min:[-5175,1500,4950] as const,max:[-5075,2000,5050] as const}};
  expect(prepareFactoryPlacement({...initial,installations:[obstacle]},request)).toMatchObject({status:"Rejected",reason:"FACILITY_OVERLAP"});
});
it("W07 refuses same-owner BOM in a remote unadmitted source and preserves its actual finite serialized C26",()=>{
  const initial=view(),cargo=initial.material.containers[0]!,chassis=cargo.state.contents.find(s=>s.resourceId==="fp02_chassis_cutter")!;
  const local=createResourceContainerSnapshot(cargo.definition,createResourceContainerState({...cargo.state,contents:cargo.state.contents.filter(s=>s!==chassis)},fixture.catalog.resources),fixture.catalog.resources);
  const remote=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:"remote_unadmitted_depot",kind:"OutpostStorage",maxMassKg:1000,maxVolumeM3:10,maxStackCount:1}),createResourceContainerState({containerId:"remote_unadmitted_depot",ownerId:fixture.resourceState.ownerId,contents:[chassis]},fixture.catalog.resources),fixture.catalog.resources);
  const isolated={...initial,material:createFactoryMaterialView(fixture.catalog,[local,remote])},before=materialBytes(isolated.material);
  expect(prepareFactoryPlacement(isolated,request)).toMatchObject({status:"Rejected",reason:"BOM_MISSING"});expect(materialBytes(isolated.material)).toBe(before);
});


it("W07 Cargo source requires a real opened Native owner, not only a material container and free pose",()=>{
 const initial=view(),before=materialBytes(initial.material);
 expect(prepareFactoryPlacement({...initial,cargoAccess:undefined},request)).toMatchObject({status:"Rejected",reason:"CARGO_UNAVAILABLE"});
 expect(materialBytes(initial.material)).toBe(before);
});

it("W07 refuses a new Facility identity that aliases the actual initial Cargo owner",()=>{
 const initial=view(),before=materialBytes(initial.material);
 expect(prepareFactoryPlacement(initial,{...request,instanceId:initial.cargoAccess.ownerId})).toMatchObject({status:"Rejected",reason:"DUPLICATE_OR_CAPACITY"});
 expect(materialBytes(initial.material)).toBe(before);
});
it("W07 Cargo source rejects a closed access owner before any paid candidate",()=>{
 const initial=view(),before=materialBytes(initial.material);
 const closed={...initial,cargoAccess:{ownerId:"fp02_wreck_owner",containerId:"fp02_wreck_cargo",opened:false,sourceDigest:initial.binding.sourceDigest,profileDigest:"synthetic-headless-access-v1",positionMm:[-4750,1500,5000],accessBoundsMm:{min:[-5000,1500,4750] as const,max:[-4500,3000,5250] as const},bodyHandle:0}};
 expect(prepareFactoryPlacement(closed,request)).toMatchObject({status:"Rejected",reason:"CARGO_CLOSED"});
 expect(materialBytes(initial.material)).toBe(before);
});
