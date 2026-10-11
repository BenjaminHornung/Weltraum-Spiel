import { describe, expect, it } from "vitest";
import { createFp02CatalogInput, createFp02Fixture, loadFactoryCatalog } from "../../../src/factory/catalog/fp02Catalog";
import { canonicalJson, canonicalSignature, validateResourceStackForCatalog } from "../../../src/resources";
import { FP02_CARGO_ORACLES } from "../../fixtures/factory/fp02Fixtures";

describe("source-locked FP02 factory catalog", () => {
  it("FP06-T005 admits exactly the finite 28 cargo positions without salvage or equipment", () => {
    const fixture = createFp02Fixture("cargo");
    expect(fixture.cargo.map((row) => [row.cargoId, row.massMg, row.packedVolumeMm3])).toEqual(FP02_CARGO_ORACLES);
    expect(fixture.cargo.reduce((n, row) => n + row.massMg, 0)).toBe(2_984_400_000);
    expect(fixture.cargo.reduce((n, row) => n + row.packedVolumeMm3, 0)).toBe(12_450_000_000);
    expect(fixture.cargo.some((row) => row.cargoId === "SALVAGE-01")).toBe(false);
    expect(fixture.resourceState.contents).toHaveLength(79);
    expect(new Set(fixture.resourceState.contents.map((s) => s.stackId)).size).toBe(79);
    for (const stack of fixture.resourceState.contents) validateResourceStackForCatalog(stack, fixture.catalog.resources);
    expect(fixture.resourceState.contents.filter((s) => s.resourceId.includes("battery"))).toHaveLength(1);
    expect(fixture.initialBatteryEnergyJ).toBe(12_960_000);
  });

  it("FP06-T006 binds the full cutter/former BOM including one finite chassis each", () => {
    const catalog = loadFactoryCatalog(createFp02CatalogInput());
    const mass = (id: string) => catalog.devices.find((d) => d.sourceId === id)!;
    expect(mass("B06").massMg).toBe(208_000_000);
    expect(mass("B07").massMg).toBe(341_000_000);
    expect(mass("B08").massMg).toBe(499_000_000);
    expect(mass("B06").bom.filter((t) => t.itemId === "fp02.chassis.cutter")).toEqual([{ itemId: "fp02.chassis.cutter", quantityUnits: 1 }]);
    expect(mass("B07").bom.filter((t) => t.itemId === "fp02.chassis.former")).toEqual([{ itemId: "fp02.chassis.former", quantityUnits: 1 }]);
    const a = createFp02Fixture("layout-a");
    const b = createFp02Fixture("layout-b");
    expect(a.layout?.totalLoadWatts).toBe(3_500);
    expect(a.layout?.beltLines.map((line) => line.lengthMm)).toEqual([4_000, 4_000]);
    expect(b.layout?.totalLoadWatts).toBe(6_600);
    expect(b.layout?.beltLines.map((line) => line.lengthMm)).toEqual([4_000, 4_000, 4_000]);
    expect(a.resourceState.contents).toEqual(createFp02Fixture("cargo").resourceState.contents);
  });

  it("FP06-T007 keeps placement and real HVP terrain scale/source provenance distinct", () => {
    const catalog = loadFactoryCatalog(createFp02CatalogInput());
    expect(catalog.frame.placementGridMm).toBe(250);
    expect(catalog.terrain.cellSizeMm).toBe(125);
    expect(catalog.terrain.limestoneDensityKgPerM3).toBe(2_400);
    expect(catalog.terrain.densityProvenance).toBe("prototype-tuning-unapproved");
    expect(8 * (catalog.terrain.cellSizeMm / 1_000) ** 3 * catalog.terrain.limestoneDensityKgPerM3 * 1_000_000).toBe(37_500_000);
    expect(catalog.frame.runtimeAxes).toEqual({ east: "x", north: "z", height: "y" });
    const cutter = catalog.devices.find((d) => d.sourceId === "B06")!;
    expect(cutter.sizeMm).toEqual([3_000, 2_000, 2_500]);
    expect(cutter.ports.find((p) => p.sourceId === "B06:IN-STEEL")).toMatchObject({ centerMm: [-1_500, 0, 1_000], outwardNormal: [-1, 0, 0], sizeMm: [750, 750] });
    expect(catalog.devices.find((d) => d.sourceId === "B07")?.ports.find((p) => p.sourceId === "B07:OUT-PROFILE-OR-SHEET"))
      .toMatchObject({ runtimeId: "fp02_b07_out_profile_or_sheet", centerMm: [2_000, 0, 1_000], outwardNormal: [1, 0, 0] });
  });

  it("FP06-T008 rejects unknown recipe versions and same-ID changed normative bytes", () => {
    const before = createFp02Fixture("cargo");
    const changed = structuredClone(createFp02CatalogInput());
    Object.assign(changed.recipes[0], { version: 2 });
    expect(() => loadFactoryCatalog(changed)).toThrow(/source lock/);
    const altered = structuredClone(createFp02CatalogInput());
    altered.recipes[0].outputs[0].quantityUnits = 7_600_000;
    expect(() => loadFactoryCatalog(altered)).toThrow(/source lock/);
    const alteredMapping = structuredClone(createFp02CatalogInput());
    alteredMapping.items[1].resourceId = alteredMapping.items[0].resourceId;
    expect(() => loadFactoryCatalog(alteredMapping)).toThrow(/source lock/);
    expect(createFp02Fixture("cargo").resourceState).toEqual(before.resourceState);
  });

  it("keeps seven mass-conserving recipes and manual work separate from electrical work", () => {
    const catalog = loadFactoryCatalog(createFp02CatalogInput());
    expect(catalog.recipes).toHaveLength(7);
    const mass = (terms: typeof catalog.recipes[number]["inputs"]) => terms.reduce((n, t) => n + catalog.items.find((item) => item.sourceId === t.itemId)!.massMgPerUnit * t.quantityUnits, 0);
    for (const recipe of catalog.recipes) expect(mass(recipe.inputs)).toBe(mass(recipe.outputs));
    expect(catalog.recipes.slice(0, 4).map((r) => r.processes[0].workJ)).toEqual([36_000, 80_000, 80_000, 60_000]);
    expect(catalog.recipes[4].processes).toMatchObject([{ kind: "manual", durationMs: null, powerWatts: 0, workJ: 0 }, { kind: "electric", durationMs: 30_000, powerWatts: 4_000, workJ: 120_000, availability: "planned" }]);
    expect(catalog.recipes[5].inputs.find((t) => t.itemId === "fp02.comp.machine_drive")?.quantityUnits).toBe(1);
    expect(catalog.recipes[6].outputs).toEqual([{ itemId: "fp02.comp.belt_module", quantityUnits: 1 }]);
  });

  it("uses exact sourcebound pack ratios and conservative envelopes without admitting unknown rock volume", () => {
    const catalog = loadFactoryCatalog(createFp02CatalogInput());
    const item = (id: string) => catalog.items.find((entry) => entry.sourceId === id)!;
    expect(item("fp02.bulk.steel_sheet").volumeProfile).toMatchObject({ kind: "cargo-pack", numeratorMm3: 4, denominatorUnits: 3 });
    expect(item("fp02.bulk.steel_semi").volumeProfile).toMatchObject({ kind: "derived-capacity-envelope", numeratorMm3: 9, denominatorUnits: 4 });
    expect(item("fp02.comp.small_brace").volumeProfile).toMatchObject({ kind: "derived-capacity-envelope", numeratorMm3: 13_050_000, denominatorUnits: 1 });
    expect(item("fp02.comp.drive_module").volumeProfile).toMatchObject({ kind: "derived-capacity-envelope", numeratorMm3: 20_000_000, denominatorUnits: 1 });
    expect(item("fp02.comp.machine_drive").volumeProfile).toMatchObject({ numeratorMm3: 7_500_000, denominatorUnits: 1 });
    expect(item("fp02.comp.machine_controller").volumeProfile).toMatchObject({ numeratorMm3: 2_000_000, denominatorUnits: 1 });
    expect(item("fp02.comp.wiring_harness").volumeProfile).toMatchObject({ numeratorMm3: 3_750_000, denominatorUnits: 1 });
    for (const sourceId of ["fp02.bulk.rock_raw", "fp02.bulk.gravel_mix"]) {
      expect(item(sourceId).volumeProfile.kind).toBe("unknown");
      expect(catalog.resources.resources.some((r) => r.resourceId === item(sourceId).resourceId)).toBe(false);
      expect(() => validateResourceStackForCatalog({ stackId: "unapproved_rock", resourceId: item(sourceId).resourceId, quantity: 20_000_000 }, catalog.resources)).toThrow();
    }
  });

  it("retains an explicit bijection and immutable canonical references", () => {
    const input = structuredClone(createFp02CatalogInput());
    const catalog = loadFactoryCatalog(input);
    expect(new Set(catalog.idMapping.map((m) => m.sourceId)).size).toBe(catalog.idMapping.length);
    expect(new Set(catalog.idMapping.map((m) => m.runtimeId)).size).toBe(catalog.idMapping.length);
    expect(catalog.items.every((item) => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(item.resourceId))).toBe(true);
    expect(catalog.resources.resources.some((r) => r.resourceId === "ore_iron_silicate")).toBe(false);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.items)).toBe(true);
    input.items[0].massMgPerUnit = 1;
    expect(catalog.items[0].massMgPerUnit).toBe(350_000_000);
    expect(() => loadFactoryCatalog({ ...createFp02CatalogInput(), unexpectedAuthority: true })).toThrow(/source lock/);
  });

  it("binds all 74 serial pieces and five bulk/length lots to the sole finite origin", () => {
    const fixture = createFp02Fixture("cargo");
    let pieces = 0;
    for (const stack of fixture.resourceState.contents) {
      const definition = fixture.catalog.items.find((i) => i.resourceId === stack.resourceId)!;
      const provenance = stack.extensions["factory.source"];
      expect(provenance).toMatchObject({ sourceEventId: "fp02_crash_a_cargo_origin", itemId: definition.sourceId,
        definitionVersion: 1, definitionDigest: definition.digest, instanceId: stack.stackId });
      expect(stack.ownerId).toBe("fp02_wreck_owner");
      if (definition.quantityBasis === "piece") { pieces += 1; expect(stack.quantity).toBe(1); }
    }
    expect(pieces).toBe(74);
    expect(fixture.resourceState.ownerId).toBe("fp02_wreck_owner");
  });

  it("keeps unbound capacity/port geometry explicit and every device merely declarative", () => {
    const fixture = createFp02Fixture("layout-a");
    expect(fixture.layout?.installed).toBe(false);
    const container = fixture.catalog.devices.find((d) => d.sourceId === "B09")!;
    expect(container.buffers).toEqual([{ role: "storage", massMg: 200_000_000, volumeMm3: null }]);
    for (const device of fixture.catalog.devices) {
      for (const buffer of device.buffers) expect(buffer.volumeMm3).toBe(null);
      for (const port of device.ports.filter((p) => p.role === "PowerConsumer" || p.role === "WasteCassette")) {
        expect(port.centerMm).toBe(null);
        expect(port.sizeMm).toBe(null);
        expect(port.outwardNormal).toBe(null);
      }
    }
  });

  it("uses complete canonical bytes for deterministic admission independently of FNV signatures", () => {
    const input = createFp02CatalogInput();
    const catalog = loadFactoryCatalog(input);
    const reorderedKeys = Object.fromEntries(Object.entries(input).reverse());
    expect(loadFactoryCatalog(reorderedKeys).canonicalJson).toBe(catalog.canonicalJson);
    for (const ref of [...catalog.items, ...catalog.recipes, ...catalog.devices]) {
      const { digest, ...bytes } = ref;
      expect(digest).toBe(`fnv1a:${canonicalSignature(bytes)}`);
    }
    expect(catalog.sources.every((s) => /^[0-9a-f]{64}$/.test(s.sha256))).toBe(true);
    const corruptSource = createFp02CatalogInput();
    corruptSource.sources[1].sha256 = "0".repeat(64);
    expect(() => loadFactoryCatalog(corruptSource)).toThrow(/source lock/);
    expect(catalog.canonicalJson).toBe(canonicalJson(input));
  });

  it("rejects fractional units, unsafe quantities and changed/absent volume profiles before constructing cargo", () => {
    for (const quantityUnits of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      const input = createFp02CatalogInput();
      input.cargo[9].quantityUnits = quantityUnits;
      expect(() => loadFactoryCatalog(input)).toThrow();
    }
    const changedProfile = createFp02CatalogInput();
    Object.assign(changedProfile.items[9].volumeProfile, { numeratorMm3: 0 });
    expect(() => loadFactoryCatalog(changedProfile)).toThrow(/source lock/);
    const absentProfile = createFp02CatalogInput();
    Reflect.deleteProperty(absentProfile.items[9], "volumeProfile");
    expect(() => loadFactoryCatalog(absentProfile)).toThrow(/source lock/);
  });
});
