import { createResourceCategory } from "../../resources/categories";
import { createResourceCatalog } from "../../resources/catalog";
import { createResourceContainerState } from "../../resources/containers";
import { createResourceId } from "../../resources/ids";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";
import { createResourceDefinition, type ResourceStackInput } from "../../resources/types";
import type { FactoryCatalog, FactoryCatalogData, FactoryCatalogInput, FactoryCargoPosition, FactoryDevice, FactoryFixture, FactoryItem,
  FactoryLayout, FactoryPort, FactoryProcess, FactoryRecipe, FactoryTerm, FactoryVolumeProfile } from "../contracts";
import { FP02_SOURCE_REFS, readFactoryTerrainSource } from "./sourceLock";

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const sign = <T extends object>(value: T): T & { readonly digest: string } => freeze({ ...value, digest: `fnv1a:${canonicalSignature(value)}` });
const pack = (numeratorMm3: number, denominatorUnits: number, cargoId: string): FactoryVolumeProfile =>
  ({ kind: "cargo-pack", version: "fp02-pack-volume-v1", numeratorMm3, denominatorUnits, sourceRefs: [`FP02:6.2:${cargoId}`] });
const envelope = (numeratorMm3: number, denominatorUnits: number, sourceRefs: readonly string[]): FactoryVolumeProfile =>
  ({ kind: "derived-capacity-envelope", version: "fp06-conservative-envelope-v1", numeratorMm3, denominatorUnits, sourceRefs });
const steelEnvelopeRefs = ["FP02:6.2:C10", "FP02:6.2:C11", "FP02:6.2:C12"];
const item = (sourceId: string, runtimeId: string, displayName: string, quantityBasis: FactoryItem["quantityBasis"], massMgPerUnit: number,
  volumeProfile: FactoryVolumeProfile, sourceRef = "FP02:4"): FactoryItem =>
  sign({ sourceId, resourceId: createResourceId(runtimeId), version: 1 as const, displayName, quantityBasis, massMgPerUnit, volumeProfile, sourceRef });
const items: readonly FactoryItem[] = freeze([
  item("fp02.device.wind_pack_6kw", "fp02_device_wind_pack_6kw", "Falt-Windanlage 6 kW", "piece", 350_000_000, pack(1_400_000_000, 1, "C01"), "FP01:8:B01"),
  item("fp02.device.pv_pack_2kwp", "fp02_device_pv_pack_2kwp", "PV-Faltarray 2 kWp", "piece", 80_000_000, pack(280_000_000, 1, "C02"), "FP01:8:B02"),
  item("fp02.device.battery_4kwh", "fp02_device_battery_4kwh", "Expeditionsakku 4 kWh", "piece", 50_000_000, pack(100_000_000, 1, "C03"), "FP01:6.7"),
  item("fp02.device.distribution_40kw", "fp02_device_distribution_40kw", "40-kW-Verteiler", "piece", 25_000_000, pack(80_000_000, 1, "C04"), "FP01:8:B04"),
  item("fp02.device.field_workbench", "fp02_device_field_workbench", "Feldwerkbank", "piece", 40_000_000, pack(200_000_000, 1, "C05"), "FP02:7:B05"),
  item("fp02.device.thermal_generator_core", "fp02_device_thermal_generator_core", "Thermogeneratorkern", "piece", 150_000_000, pack(700_000_000, 1, "C06")),
  item("fp02.comp.field_cable", "fp02_comp_field_cable", "Feldkabel", "mm", 250, pack(3_000, 1, "C07")),
  item("fp02.device.material_container", "fp02_device_material_container", "Materialcontainer", "piece", 60_000_000, pack(420_000_000, 1, "C08")),
  item("fp02.comp.foundation_foot", "fp02_comp_foundation_foot", "Fundamentschuh", "piece", 12_000_000, pack(70_000_000, 1, "C09")),
  item("fp02.bulk.steel_known", "fp02_bulk_steel_known", "Geprüfter Schiffsstahl", "mg", 1, pack(5, 8, "C10")),
  item("fp02.bulk.steel_profile", "fp02_bulk_steel_profile", "Stahlprofile", "mg", 1, pack(9, 4, "C11")),
  item("fp02.bulk.steel_sheet", "fp02_bulk_steel_sheet", "Stahlblech", "mg", 1, pack(4, 3, "C12")),
  item("fp02.bulk.elastomer_reclaimed", "fp02_bulk_elastomer_reclaimed", "Rückgewinnungs-Elastomer", "mg", 1, pack(15, 4, "C13")),
  item("fp02.comp.belt_module", "fp02_comp_belt_module", "Passives 1-m-Bandmodul", "piece", 5_000_000, pack(30_000_000, 1, "C14")),
  item("fp02.comp.machine_drive", "fp02_comp_machine_drive", "Maschinenantriebskern", "piece", 2_000_000, pack(7_500_000, 1, "C15")),
  item("fp02.comp.machine_controller", "fp02_comp_machine_controller", "Maschinensteuerung", "piece", 200_000, pack(2_000_000, 1, "C16")),
  item("fp02.comp.wiring_harness", "fp02_comp_wiring_harness", "Leitersatz", "piece", 800_000, pack(3_750_000, 1, "C17")),
  item("fp02.tool.cutter_head", "fp02_tool_cutter_head", "Zuschnitt-Werkzeugkopf", "piece", 3_000_000, pack(20_000_000, 1, "C18")),
  item("fp02.tool.forming_die", "fp02_tool_forming_die", "Umformwerkzeuge", "piece", 4_000_000, pack(20_000_000, 1, "C19")),
  item("fp02.tool.crusher_jaw", "fp02_tool_crusher_jaw", "Brecherbacke", "piece", 6_000_000, pack(30_000_000, 1, "C20")),
  item("fp02.tool.assembly_fixture", "fp02_tool_assembly_fixture", "Montage-Werkzeugsatz", "piece", 3_000_000, pack(20_000_000, 1, "C21")),
  item("fp02.tool.pit_head", "fp02_tool_pit_head", "Kleinschürfer-Werkzeugkopf", "piece", 5_000_000, pack(30_000_000, 1, "C22")),
  item("fp02.comp.belt_drive", "fp02_comp_belt_drive", "Dedizierter Bandantrieb", "piece", 6_000_000, pack(20_000_000, 1, "C23")),
  item("fp02.comp.field_generator_core", "fp02_comp_field_generator_core", "Reservegenerator-/Lagerkern", "piece", 35_000_000, pack(80_000_000, 1, "C24")),
  item("fp02.comp.rotor_hub_kit", "fp02_comp_rotor_hub_kit", "Rotor-/Naben-Bausatz", "piece", 40_000_000, pack(200_000_000, 1, "C25")),
  item("fp02.chassis.cutter", "fp02_chassis_cutter", "Geborgenes Cutterchassis", "piece", 180_000_000, pack(800_000_000, 1, "C26")),
  item("fp02.chassis.former", "fp02_chassis_former", "Geborgenes Formerchassis", "piece", 300_000_000, pack(1_400_000_000, 1, "C27")),
  item("fp02.chassis.crusher", "fp02_chassis_crusher", "Geborgenes Brecherchassis", "piece", 450_000_000, pack(1_800_000_000, 1, "C28")),
  // Maximum source-packed steel ratio; these envelopes are not physical densities.
  item("fp02.bulk.steel_semi", "fp02_bulk_steel_semi", "Stahlhalbzeug", "mg", 1, envelope(9, 4, steelEnvelopeRefs)),
  item("fp02.bulk.steel_offcut", "fp02_bulk_steel_offcut", "Stahlverschnitt", "mg", 1, envelope(9, 4, steelEnvelopeRefs)),
  item("fp02.comp.small_brace", "fp02_comp_small_brace", "Kleine Stütze", "piece", 5_800_000, envelope(13_050_000, 1, steelEnvelopeRefs)),
  item("fp02.comp.drive_module", "fp02_comp_drive_module", "Antriebsmodul", "piece", 6_000_000,
    envelope(20_000_000, 1, ["FP02:5.2:REC-06-DRIVE", "FP02:6.2:C11", "FP02:6.2:C15", "FP02:6.2:C16", "FP02:6.2:C17"])),
  item("fp02.bulk.rock_raw", "fp02_bulk_rock_raw", "Lokales Gestein", "mg", 1, { kind: "unknown", version: "unbound-v1", sourceRefs: ["FP02:10.3"] }),
  item("fp02.bulk.gravel_mix", "fp02_bulk_gravel_mix", "Schottermix", "mg", 1, { kind: "unknown", version: "unbound-v1", sourceRefs: ["FP02:5.2:REC-04-CRUSH"] })
]);
const term = (itemId: string, quantityUnits: number): FactoryTerm => ({ itemId, quantityUnits });
const electric = (capability: string, durationMs: number, powerWatts: number,
  availability: FactoryProcess["availability"] = "first-dry-loop"): FactoryProcess =>
  ({ kind: "electric", capability, durationMs, powerWatts, workJ: durationMs * powerWatts / 1_000, availability });
const manual = (capability: string, durationMs: number | null): FactoryProcess =>
  ({ kind: "manual", capability, durationMs, powerWatts: 0, workJ: 0, availability: "first-dry-loop" });
const recipe = (sourceId: string, runtimeId: string, inputs: readonly FactoryTerm[], outputs: readonly FactoryTerm[], processes: readonly FactoryProcess[]): FactoryRecipe =>
  sign({ sourceId, runtimeId, version: 1 as const, inputs, outputs, processes, sourceRef: `FP02:5.2:${sourceId}` });
const recipes: readonly FactoryRecipe[] = freeze([
  recipe("REC-01-CUT", "fp02_rec_01_cut", [term("fp02.bulk.steel_known", 8_000_000)],
    [term("fp02.bulk.steel_semi", 7_500_000), term("fp02.bulk.steel_offcut", 500_000)], [electric("steel.cold-cut", 30_000, 1_200)]),
  recipe("REC-02-PROFILE", "fp02_rec_02_profile", [term("fp02.bulk.steel_semi", 7_500_000)],
    [term("fp02.bulk.steel_profile", 7_000_000), term("fp02.bulk.steel_offcut", 500_000)], [electric("steel.cold-form", 40_000, 2_000)]),
  recipe("REC-03-SHEET", "fp02_rec_03_sheet", [term("fp02.bulk.steel_semi", 7_500_000)],
    [term("fp02.bulk.steel_sheet", 7_000_000), term("fp02.bulk.steel_offcut", 500_000)], [electric("steel.cold-form", 40_000, 2_000)]),
  recipe("REC-04-CRUSH", "fp02_rec_04_crush", [term("fp02.bulk.rock_raw", 20_000_000)],
    [term("fp02.bulk.gravel_mix", 20_000_000)], [electric("rock.crush", 20_000, 3_000, "planned")]),
  recipe("REC-05-BRACE", "fp02_rec_05_brace", [term("fp02.bulk.steel_profile", 4_000_000), term("fp02.bulk.steel_sheet", 2_000_000)],
    [term("fp02.comp.small_brace", 1), term("fp02.bulk.steel_offcut", 200_000)], [manual("bench.assembly", null), electric("assembly.small", 30_000, 4_000, "planned")]),
  recipe("REC-06-DRIVE", "fp02_rec_06_drive", [term("fp02.bulk.steel_profile", 3_000_000), term("fp02.comp.wiring_harness", 1), term("fp02.comp.machine_drive", 1), term("fp02.comp.machine_controller", 1)],
    [term("fp02.comp.drive_module", 1)], [electric("assembly.small", 60_000, 4_000, "planned")]),
  recipe("REC-07-BELT", "fp02_rec_07_belt", [term("fp02.bulk.steel_profile", 2_000_000), term("fp02.bulk.steel_sheet", 1_000_000), term("fp02.bulk.elastomer_reclaimed", 2_000_000)],
    [term("fp02.comp.belt_module", 1)], [manual("bench.belt-join", 90_000)])
]);
const port = (sourceId: string, runtimeId: string, role: FactoryPort["role"], eastMm: number): FactoryPort => {
  const materialPort = role === "SolidBatchIn" || role === "SolidBatchOut";
  return { sourceId, runtimeId, role, centerMm: materialPort ? [eastMm, 0, 1_000] : null,
    outwardNormal: materialPort ? [eastMm < 0 ? -1 : 1, 0, 0] : null,
    sizeMm: materialPort ? [750, 750] : null, externallyConnectable: role !== "WasteCassette" };
};
const machineBom = (chassis: string, profiles: number, sheet: number, tool: string): readonly FactoryTerm[] =>
  [term(chassis, 1), term("fp02.bulk.steel_profile", profiles), term("fp02.bulk.steel_sheet", sheet), term("fp02.comp.machine_drive", 1),
    term("fp02.comp.machine_controller", 1), term("fp02.comp.wiring_harness", 1), term(tool, 1)];
const massOfTerms = (terms: readonly FactoryTerm[], catalogItems: readonly FactoryItem[] = items): number => terms.reduce((sum, entry) => {
  const definition = catalogItems.find((candidate) => candidate.sourceId === entry.itemId);
  if (!definition || !Number.isSafeInteger(entry.quantityUnits) || entry.quantityUnits <= 0) throw new Error("Invalid factory term");
  const mass = definition.massMgPerUnit * entry.quantityUnits;
  if (!Number.isSafeInteger(mass) || !Number.isSafeInteger(sum + mass)) throw new Error("Factory term mass overflow");
  return sum + mass;
}, 0);
const device = (sourceId: string, runtimeId: string, sizeMm: FactoryDevice["sizeMm"], bom: readonly FactoryTerm[], capabilities: readonly string[],
  powerWatts: number, ports: readonly FactoryPort[], inputMg: number, outputMg: number, offcutMg = 0,
  bufferOverride?: FactoryDevice["buffers"]): FactoryDevice =>
  sign({ sourceId, runtimeId, version: 1 as const, sizeMm, massMg: massOfTerms(bom), bom, capabilities, powerWatts, ports,
    buffers: bufferOverride ?? [...(inputMg ? [{ role: "input" as const, massMg: inputMg, volumeMm3: null }] : []),
      ...(outputMg ? [{ role: "output" as const, massMg: outputMg, volumeMm3: null }] : []),
      ...(offcutMg ? [{ role: "offcut" as const, massMg: offcutMg, volumeMm3: null }] : [])],
    minimumServiceClearanceMm: 1_000, sourceRef: `FP02:7:${sourceId}` });
const devices: readonly FactoryDevice[] = freeze([
  device("B05", "fp02_device_b05_workbench", [2_000, 1_000, 1_100], [term("fp02.device.field_workbench", 1)], ["bench.assembly", "bench.belt-join"], 0, [], 0, 0),
  device("B06", "fp02_device_b06_cutter", [3_000, 2_000, 2_500], machineBom("fp02.chassis.cutter", 12_000_000, 10_000_000, "fp02.tool.cutter_head"),
    ["steel.cold-cut"], 1_200, [port("B06:IN-STEEL", "fp02_b06_in_steel", "SolidBatchIn", -1_500), port("B06:OUT-SEMI", "fp02_b06_out_semi", "SolidBatchOut", 1_500),
      port("B06:POWER-IN", "fp02_b06_power_in", "PowerConsumer", 0), port("B06:OFFCUT", "fp02_b06_offcut", "WasteCassette", 0)], 16_000_000, 22_500_000, 6_000_000),
  device("B07", "fp02_device_b07_former", [4_000, 3_000, 3_000], machineBom("fp02.chassis.former", 20_000_000, 14_000_000, "fp02.tool.forming_die"),
    ["steel.cold-form"], 2_000, [port("B07:IN-SEMI", "fp02_b07_in_semi", "SolidBatchIn", -2_000), port("B07:OUT-PROFILE-OR-SHEET", "fp02_b07_out_profile_or_sheet", "SolidBatchOut", 2_000),
      port("B07:POWER-IN", "fp02_b07_power_in", "PowerConsumer", 0), port("B07:OFFCUT", "fp02_b07_offcut", "WasteCassette", 0)], 15_000_000, 21_000_000, 6_000_000),
  device("B08", "fp02_device_b08_crusher", [3_000, 3_000, 3_000], machineBom("fp02.chassis.crusher", 24_000_000, 16_000_000, "fp02.tool.crusher_jaw"),
    ["rock.crush"], 3_000, [port("B08:IN-ROCK", "fp02_b08_in_rock", "SolidBatchIn", -1_500), port("B08:OUT-GRAVEL", "fp02_b08_out_gravel", "SolidBatchOut", 1_500),
      port("B08:POWER-IN", "fp02_b08_power_in", "PowerConsumer", 0)], 40_000_000, 60_000_000),
  device("B09", "fp02_device_b09_container", [2_000, 2_000, 1_500], [term("fp02.device.material_container", 1)], [], 0,
    [port("B09:MAT-IN", "fp02_b09_mat_in", "SolidBatchIn", -1_000), port("B09:MAT-OUT", "fp02_b09_mat_out", "SolidBatchOut", 1_000)],
    0, 0, 0, [{ role: "storage", massMg: 200_000_000, volumeMm3: null }])
]);
// Explicit source/runtime pairs. Source punctuation is never rewritten at lookup.
const cargoRows: readonly (readonly [string, string, number, number])[] = [
  ["C01", "fp02_cargo_c01", 2, 2_800_000_000], ["C02", "fp02_cargo_c02", 4, 1_120_000_000], ["C03", "fp02_cargo_c03", 1, 100_000_000],
  ["C04", "fp02_cargo_c04", 1, 80_000_000], ["C05", "fp02_cargo_c05", 1, 200_000_000], ["C06", "fp02_cargo_c06", 1, 700_000_000],
  ["C07", "fp02_cargo_c07", 40_000, 120_000_000], ["C08", "fp02_cargo_c08", 3, 1_260_000_000], ["C09", "fp02_cargo_c09", 6, 420_000_000],
  ["C10", "fp02_cargo_c10", 96_000_000, 60_000_000], ["C11", "fp02_cargo_c11", 80_000_000, 180_000_000], ["C12", "fp02_cargo_c12", 60_000_000, 80_000_000],
  ["C13", "fp02_cargo_c13", 16_000_000, 60_000_000], ["C14", "fp02_cargo_c14", 24, 720_000_000], ["C15", "fp02_cargo_c15", 4, 30_000_000],
  ["C16", "fp02_cargo_c16", 5, 10_000_000], ["C17", "fp02_cargo_c17", 8, 30_000_000], ["C18", "fp02_cargo_c18", 1, 20_000_000],
  ["C19", "fp02_cargo_c19", 1, 20_000_000], ["C20", "fp02_cargo_c20", 1, 30_000_000], ["C21", "fp02_cargo_c21", 1, 20_000_000],
  ["C22", "fp02_cargo_c22", 1, 30_000_000], ["C23", "fp02_cargo_c23", 4, 80_000_000], ["C24", "fp02_cargo_c24", 1, 80_000_000],
  ["C25", "fp02_cargo_c25", 1, 200_000_000], ["C26", "fp02_cargo_c26", 1, 800_000_000], ["C27", "fp02_cargo_c27", 1, 1_400_000_000],
  ["C28", "fp02_cargo_c28", 1, 1_800_000_000]
];
const cargo: readonly FactoryCargoPosition[] = freeze(cargoRows.map(([cargoId, runtimeId, quantityUnits, packedVolumeMm3], index) =>
  ({ cargoId, runtimeId, itemId: items[index].sourceId, quantityUnits, massMg: items[index].massMgPerUnit * quantityUnits, packedVolumeMm3 })));
const lockedData: FactoryCatalogData = freeze({
  version: "fp02-factory-catalog-v1", sources: FP02_SOURCE_REFS, items, recipes, devices, cargo,
  idMapping: [...items.map((e) => ({ sourceId: e.sourceId, runtimeId: e.resourceId })), ...recipes.map((e) => ({ sourceId: e.sourceId, runtimeId: e.runtimeId })),
    ...devices.map((e) => ({ sourceId: e.sourceId, runtimeId: e.runtimeId })), ...devices.flatMap((e) => e.ports.map((p) => ({ sourceId: p.sourceId, runtimeId: p.runtimeId }))),
    ...cargo.map((e) => ({ sourceId: e.cargoId, runtimeId: e.runtimeId }))],
  frame: { version: "fp02-east-north-height-to-hvp-xyz-v1", placementGridMm: 250, runtimeAxes: { east: "x", north: "z", height: "y" },
    sourceRefs: ["FP02:8.2", "src/hvp/hvpCoastSource.ts:northern-shelf-positive-z", "src/hestia-prototype/presentation/vegetation.ts:north-young"] },
  terrain: readFactoryTerrainSource(),
  conveyor: { version: "fp02-conveyor-reference-v1", speedMmPerSecond: 750, maxPacketMassMg: 10_000_000, powerWattsPerMeter: 25,
    moduleLengthMm: 1_000, maxFixtureLineLengthMm: 12_000, nominalRateMgPerSecond: 1_000_000, sourceRef: "FP02:8.3" }
});
const lockedCanonicalJson = canonicalJson(lockedData);
/** Fresh mutable transport bytes; no world state or inventory authority. */
export const createFp02CatalogInput = (): FactoryCatalogInput => JSON.parse(lockedCanonicalJson) as FactoryCatalogInput;
export const loadFactoryCatalog = (input: unknown): FactoryCatalog => {
  const json = canonicalJson(input);
  // Compare complete normative bytes, not only the noncryptographic FNV digest.
  // This deliberately admits the single frozen v1 profile, not arbitrary catalog extensions.
  if (json !== lockedCanonicalJson) throw new Error("Factory catalog source lock mismatch: unknown version, ID mapping or normative bytes");
  const data = JSON.parse(json) as FactoryCatalogData;
  const sourceIds = new Set(data.idMapping.map((e) => e.sourceId));
  const runtimeIds = new Set(data.idMapping.map((e) => e.runtimeId));
  if (sourceIds.size !== data.idMapping.length || runtimeIds.size !== data.idMapping.length) throw new Error("Factory ID mapping must be bijective");
  for (const entry of data.recipes) if (massOfTerms(entry.inputs, data.items) !== massOfTerms(entry.outputs, data.items)) throw new Error("Factory recipe must conserve mass");
  for (const entry of data.devices) if (massOfTerms(entry.bom, data.items) !== entry.massMg) throw new Error("Factory device BOM must retain all material");
  for (const row of data.cargo) {
    const definition = data.items.find((candidate) => candidate.sourceId === row.itemId)!;
    const profile = definition.volumeProfile;
    if (!Number.isSafeInteger(row.quantityUnits) || row.quantityUnits <= 0 || !Number.isSafeInteger(row.packedVolumeMm3)
      || row.packedVolumeMm3 <= 0 || definition.massMgPerUnit * row.quantityUnits !== row.massMg || profile.kind !== "cargo-pack"
      || BigInt(profile.numeratorMm3) * BigInt(row.quantityUnits) !== BigInt(row.packedVolumeMm3) * BigInt(profile.denominatorUnits)) {
      throw new Error("Factory cargo requires exact source-packed volume and integer quantities");
    }
  }
  const definitions = data.items.filter((entry) => entry.volumeProfile.kind !== "unknown").map((entry) => {
    const profile = entry.volumeProfile;
    if (profile.kind === "unknown") throw new Error("Unknown volume profile cannot enter Resources");
    return createResourceDefinition({ resourceId: entry.resourceId, displayName: entry.displayName,
      categoryId: entry.quantityBasis === "piece" ? "factory_component" : "factory_bulk",
      massPerUnitKg: entry.massMgPerUnit / 1_000_000, volumePerUnitM3: profile.numeratorMm3 / profile.denominatorUnits / 1_000_000_000,
      baseValueCredits: 0, stackRule: entry.quantityBasis === "piece" ? { kind: "Discrete", maxQuantity: 1, splitAllowed: false }
        : { kind: "Bulk", maxQuantity: Number.MAX_SAFE_INTEGER, splitAllowed: true },
      rarityTier: "Common", tags: ["factory", entry.quantityBasis], hazardFlags: [], legalStatus: "Legal", ownershipImplication: "ClaimedCargo", defaultUse: "factory",
      extensions: { "factory.definition": { sourceId: entry.sourceId, version: entry.version, digest: entry.digest, quantityBasis: entry.quantityBasis,
        volumeProfile: { ...profile, sourceRefs: [...profile.sourceRefs] } } }
    });
  });
  const resources = createResourceCatalog({ catalogId: "fp02_factory_resources_v1", categories: [
    createResourceCategory({ categoryId: "factory_bulk", label: "Factory material" }), createResourceCategory({ categoryId: "factory_component", label: "Factory component" })
  ], resources: definitions, extensions: { "factory.source-lock": "fp02-factory-catalog-v1" } });
  return freeze({ ...data, resources, canonicalJson: json, catalogDigest: `fnv1a:${canonicalSignature(data)}` });
};
const layout = (name: "layout-a" | "layout-b"): FactoryLayout => freeze({
  sourceId: name === "layout-a" ? "FP02-LAYOUT-A" : "FP02-LAYOUT-B", sizeMm: name === "layout-a" ? [22_000, 12_000] : [22_000, 20_000],
  placements: [
    { instanceId: "fp02_c08_a", deviceId: "B09", centerMm: [1_000, 6_000, 0], quarterTurns: 0 },
    { instanceId: "fp02_cutter_a", deviceId: "B06", centerMm: [7_500, 6_000, 0], quarterTurns: 0 },
    { instanceId: "fp02_former_a", deviceId: "B07", centerMm: [15_000, 6_000, 0], quarterTurns: 0 },
    { instanceId: "fp02_c08_b", deviceId: "B09", centerMm: [18_000, 6_000, 0], quarterTurns: 0 },
    { instanceId: "fp02_workbench_a", deviceId: "B05", centerMm: [7_000, 2_000, 0], quarterTurns: 0 },
    ...(name === "layout-b" ? [
      { instanceId: "fp02_crusher_b", deviceId: "B08", centerMm: [7_500, 13_000, 0] as const, quarterTurns: 0 as const },
      { instanceId: "fp02_c08_c", deviceId: "B09", centerMm: [14_000, 13_000, 0] as const, quarterTurns: 0 as const }
    ] : [])
  ], beltLines: [
    { instanceId: "fp02_belt_a1", startMm: [2_000, 6_000, 1_000], endMm: [6_000, 6_000, 1_000], lengthMm: 4_000, moduleCount: 4, driveCount: 1 },
    { instanceId: "fp02_belt_a2", startMm: [9_000, 6_000, 1_000], endMm: [13_000, 6_000, 1_000], lengthMm: 4_000, moduleCount: 4, driveCount: 1 },
    ...(name === "layout-b" ? [{ instanceId: "fp02_belt_b3", startMm: [9_000, 13_000, 1_000] as const, endMm: [13_000, 13_000, 1_000] as const,
      lengthMm: 4_000, moduleCount: 4, driveCount: 1 as const }] : [])
  ], totalLoadWatts: name === "layout-a" ? 3_500 : 6_600, extraCableLengthMm: name === "layout-a" ? 13_000 : 17_000, installed: false
});
/** Declarative fixture only: the Resources state is the sole inventory. */
export const createFp02Fixture = (name: "cargo" | "layout-a" | "layout-b"): FactoryFixture => {
  if (!["cargo", "layout-a", "layout-b"].includes(name)) throw new Error("Unknown FP02 fixture");
  const catalog = loadFactoryCatalog(createFp02CatalogInput());
  const contents: ResourceStackInput[] = [];
  for (const row of catalog.cargo) {
    const definition = catalog.items.find((candidate) => candidate.sourceId === row.itemId)!;
    const count = definition.quantityBasis === "piece" ? row.quantityUnits : 1;
    for (let index = 0; index < count; index += 1) {
      const instanceId = `${row.runtimeId}_${definition.quantityBasis === "piece" ? "unit" : "lot"}_${index + 1}`;
      contents.push({ stackId: instanceId, resourceId: definition.resourceId, quantity: definition.quantityBasis === "piece" ? 1 : row.quantityUnits,
        ownerId: "fp02_wreck_owner", extensions: { "factory.source": { cargoId: row.cargoId, itemId: row.itemId, definitionVersion: definition.version,
          definitionDigest: definition.digest, sourceEventId: "fp02_crash_a_cargo_origin", instanceId } } });
    }
  }
  return freeze({ name, catalog, cargo: catalog.cargo, resourceState: createResourceContainerState({ containerId: "fp02_wreck_cargo",
    ownerId: "fp02_wreck_owner", revision: 0, contents }, catalog.resources), layout: name === "cargo" ? null : layout(name), initialBatteryEnergyJ: 12_960_000 });
};
