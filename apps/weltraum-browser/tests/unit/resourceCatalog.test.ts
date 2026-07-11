import { describe, expect, it } from "vitest";
import {
  CanonicalSerializationError,
  ResourceValidationError,
  canonicalJson,
  canonicalSignature,
  canonicalizeJsonValue,
  cloneResourceExtensions,
  createResourceCatalog,
  createResourceDefinition,
  createResourceId,
  createResourceStackRule,
  createStarterResourceCatalog,
  resourceCatalogFixture,
  resourceCategoryFixture,
  resourceDefinitionFixture,
  resourceRequirementFixture,
  starterResourceCategories,
  starterResourceDefinitions,
  validateResourceRequirement,
  validateResourceRequirements,
  validateResourceStackForCatalog
} from "../../src/resources";

const expectResourceValidation = (action: () => unknown, code: ResourceValidationError["code"]): void => {
  try {
    action();
    throw new Error(`Expected ResourceValidationError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ResourceValidationError);
    expect((error as ResourceValidationError).code).toBe(code);
  }
};

const ownRecord = (entries: readonly (readonly [string, unknown])[]): Record<string, unknown> => {
  const result = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of entries) {
    Object.defineProperty(result, key, { configurable: true, enumerable: true, value, writable: true });
  }
  return result;
};

describe("resource catalog identity and starter data", () => {
  it("creates all eight explicit provisional resources in extensible category entries", () => {
    const catalog = createStarterResourceCatalog();

    expect(catalog.resources.map((resource) => resource.resourceId)).toEqual([
      "ammo_ballistic_powder",
      "cargo_mission_sealed_crate",
      "component_scrap_electronics",
      "fuel_refined_propellant",
      "material_structural_plate",
      "ore_iron_silicate",
      "sample_geology_core",
      "volatile_water_ice"
    ]);
    expect(catalog.categories.map((category) => category.categoryId)).toEqual([
      "ammo_material",
      "component",
      "fuel",
      "mission_cargo",
      "raw_ore",
      "refined_material",
      "research_sample",
      "volatile_fuel"
    ]);
    expect(catalog.resources.find((resource) => resource.resourceId === "ore_iron_silicate")).toMatchObject({
      massPerUnitKg: 8,
      volumePerUnitM3: 0.004,
      baseValueCredits: 4
    });
    expect(catalog.resources.find((resource) => resource.resourceId === "cargo_mission_sealed_crate")).toMatchObject({
      massPerUnitKg: 50,
      volumePerUnitM3: 0.08,
      baseValueCredits: 0,
      stackRule: { kind: "Sealed", maxQuantity: 1, splitAllowed: false }
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.resources)).toBe(true);
    expect(Object.isFrozen(catalog.resources[0])).toBe(true);
  });

  it("brands and rejects malformed save-safe identities at runtime", () => {
    expect(createResourceId("ore_iron_silicate")).toBe("ore_iron_silicate");
    expectResourceValidation(() => createResourceId("Ore Iron"), "INVALID_ID");
    expectResourceValidation(() => createResourceId("ore__iron"), "INVALID_ID");
  });

  it("defensively clones canonical resource data instead of retaining input references", () => {
    const tags = ["fixture", "builder", "fixture"];
    const extensions = { "weltraum.fixture": { weight: 0.123456789 } };
    const definition = createResourceDefinition(
      resourceDefinitionFixture({ tags, extensions, massPerUnitKg: 0.123456789 })
    );
    tags.push("mutated");
    extensions["weltraum.fixture"].weight = 99;

    expect(definition.tags).toEqual(["builder", "fixture"]);
    expect(definition.extensions).toEqual({ "weltraum.fixture": { weight: 0.123456789 } });
    expect(Object.isFrozen(definition.extensions)).toBe(true);
    expect(Object.isFrozen(definition.extensions["weltraum.fixture"])).toBe(true);
  });

  it("keeps own prototype-like extension keys distinct through canonicalization and cloning", () => {
    const first = ownRecord([
      ["__proto__", "stored_prototype"],
      ["constructor", "stored_constructor"],
      ["toString", "stored_to_string"]
    ]);
    const second = ownRecord([
      ["__proto__", "different_prototype"],
      ["constructor", "stored_constructor"],
      ["toString", "stored_to_string"]
    ]);
    const json = canonicalJson(first);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const canonical = canonicalizeJsonValue(first) as Readonly<Record<string, unknown>>;
    const cloned = cloneResourceExtensions({ "weltraum.fixture": first })["weltraum.fixture"] as Readonly<Record<string, unknown>>;

    expect(json).toBe('{"__proto__":"stored_prototype","constructor":"stored_constructor","toString":"stored_to_string"}');
    expect(Object.getPrototypeOf(canonical)).toBeNull();
    expect(Object.hasOwn(canonical, "__proto__")).toBe(true);
    expect(parsed["__proto__"]).toBe("stored_prototype");
    expect(Object.getPrototypeOf(cloned)).toBeNull();
    expect(Object.hasOwn(cloned, "__proto__")).toBe(true);
    expect(Object.isFrozen(cloned)).toBe(true);
    expect(canonicalSignature(first)).not.toBe(canonicalSignature(second));
  });

  it("rejects sparse arrays and unsupported extension values instead of collapsing them", () => {
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = "present";

    expect(() => canonicalJson(sparse)).toThrow(CanonicalSerializationError);
    expect(() => canonicalJson({ unsupported: undefined })).toThrow(CanonicalSerializationError);
    expectResourceValidation(() => cloneResourceExtensions({ "weltraum.fixture": sparse }), "INVALID_EXTENSION");
    expectResourceValidation(
      () => cloneResourceExtensions({ "weltraum.fixture": { unsupported: undefined } }),
      "INVALID_EXTENSION"
    );
  });
});

describe("resource catalog runtime validation", () => {
  it("rejects duplicate category and resource identities deterministically", () => {
    const category = resourceCategoryFixture();
    const resource = resourceDefinitionFixture();

    expectResourceValidation(
      () => resourceCatalogFixture({ categories: [category, category], resources: [resource] }),
      "DUPLICATE_CATEGORY_ID"
    );
    expectResourceValidation(
      () => resourceCatalogFixture({ categories: [category], resources: [resource, resource] }),
      "DUPLICATE_RESOURCE_ID"
    );
  });

  it("rejects resources with unknown categories, invalid numeric metadata, and invalid stack rules", () => {
    expectResourceValidation(
      () =>
        resourceCatalogFixture({
          resources: [resourceDefinitionFixture({ categoryId: "unknown_category" })]
        }),
      "UNKNOWN_CATEGORY"
    );
    expectResourceValidation(
      () => createResourceDefinition(resourceDefinitionFixture({ massPerUnitKg: Number.NaN })),
      "INVALID_NUMERIC_VALUE"
    );
    expectResourceValidation(
      () => createResourceDefinition(resourceDefinitionFixture({ volumePerUnitM3: -0.001 })),
      "INVALID_NUMERIC_VALUE"
    );
    expectResourceValidation(
      () => createResourceStackRule({ kind: "Sealed", maxQuantity: 2, splitAllowed: false }),
      "INVALID_STACK_RULE"
    );
  });
});

describe("resource catalog determinism and requirement seam", () => {
  it("uses byte-stable JSON and signatures independent of registration order without numeric rounding", () => {
    const forward = createResourceCatalog({
      catalogId: "order_independent_catalog",
      categories: starterResourceCategories,
      resources: starterResourceDefinitions
    });
    const reversed = createResourceCatalog({
      catalogId: "order_independent_catalog",
      categories: [...starterResourceCategories].reverse(),
      resources: [...starterResourceDefinitions].reverse()
    });

    expect(forward.canonicalJson).toBe(reversed.canonicalJson);
    expect(forward.signature).toBe(reversed.signature);
    expect(forward.signature).toBe(forward.signature);
    expect(canonicalJson({ z: 0.123456789, a: { y: 2, b: 1 } })).toBe('{"a":{"b":1,"y":2},"z":0.123456789}');
  });

  it("validates requirements against a supplied catalog and rejects unknown or invalid quantities", () => {
    const catalog = resourceCatalogFixture();
    const valid = validateResourceRequirement(resourceRequirementFixture(), catalog);

    expect(valid).toEqual({ resourceId: "fixture_resource", quantity: 1 });
    expect(Object.isFrozen(valid)).toBe(true);
    expectResourceValidation(
      () => validateResourceRequirement(resourceRequirementFixture({ resourceId: "unknown_resource" }), catalog),
      "UNKNOWN_RESOURCE"
    );
    expectResourceValidation(
      () => validateResourceRequirement(resourceRequirementFixture({ quantity: 0 }), catalog),
      "INVALID_REQUIREMENT"
    );
    expectResourceValidation(
      () => validateResourceRequirements([resourceRequirementFixture(), resourceRequirementFixture()], catalog),
      "DUPLICATE_REQUIREMENT_RESOURCE"
    );
  });

  it("applies catalog stack constraints without a global registry", () => {
    const catalog = createStarterResourceCatalog();
    const valid = validateResourceStackForCatalog(
      {
        stackId: "mission_crate_stack",
        resourceId: "cargo_mission_sealed_crate",
        quantity: 1,
        sealed: true
      },
      catalog
    );

    expect(valid.stackId).toBe("mission_crate_stack");
    expectResourceValidation(
      () =>
        validateResourceStackForCatalog(
          {
            stackId: "unsealed_mission_crate",
            resourceId: "cargo_mission_sealed_crate",
            quantity: 1,
            sealed: false
          },
          catalog
        ),
      "INVALID_STACK"
    );
  });
});
