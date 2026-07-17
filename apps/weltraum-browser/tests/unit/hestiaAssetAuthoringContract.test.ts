import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

interface ExpectedError {
  readonly instancePath: string;
  readonly keyword: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

interface FixtureCase {
  readonly file: string;
  readonly schemaValid: boolean;
  readonly expectedError?: ExpectedError;
}

interface TaggedValue {
  readonly tags: readonly string[];
}

interface CompleteFixture {
  readonly schema: string;
  readonly asset: TaggedValue & {
    readonly defaultStructuralMaterialId: string;
  };
  readonly parts: readonly (TaggedValue & {
    readonly partId: string;
    readonly representation: string;
    readonly destructible: boolean;
    readonly collisionPolicy: string;
    readonly defaultRenderMaterialId?: string;
    readonly structuralMaterialId?: string;
    readonly shell?: {
      readonly layers: readonly { readonly structuralMaterialId: string }[];
    };
  })[];
  readonly joints: readonly TaggedValue[];
  readonly markers: readonly TaggedValue[];
  readonly materials: readonly (TaggedValue & {
    readonly renderMaterialId: string;
    readonly structuralMaterialId?: string;
  })[];
}

interface UnsortedTagsFixture {
  readonly asset: TaggedValue;
}

const fixtureDirectory = fileURLToPath(
  new URL("../../../../schemas/fixtures/hestia-asset-authoring-v1/", import.meta.url)
);
const schemaPath = fileURLToPath(
  new URL("../../../../schemas/hestia-asset-authoring-v1.schema.json", import.meta.url)
);
const contractPath = fileURLToPath(
  new URL("../../../../docs/tools/hestia-asset-authoring-contract-v1.md", import.meta.url)
);
const contract = readFileSync(contractPath, "utf8");
const normalizedContract = contract.replace(/\s+/g, " ").trim();
const normalizedContractParagraphs = contract
  .split(/\r?\n\s*\r?\n/)
  .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
  .filter((paragraph) => paragraph.length > 0);

const loadJson = <T = unknown>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const fixturePath = (file: string): string => `${fixtureDirectory}${file}`;

const fixtureCases: readonly FixtureCase[] = [
  { file: "valid-minimal.json", schemaValid: true },
  { file: "valid-complete.json", schemaValid: true },
  {
    file: "invalid-missing-required.json",
    schemaValid: false,
    expectedError: { instancePath: "", keyword: "required", params: { missingProperty: "materials" } }
  },
  {
    file: "invalid-unknown-property.json",
    schemaValid: false,
    expectedError: {
      instancePath: "",
      keyword: "additionalProperties",
      params: { additionalProperty: "registryVersion" }
    }
  },
  {
    file: "invalid-wrong-version.json",
    schemaValid: false,
    expectedError: { instancePath: "/schema", keyword: "const" }
  },
  {
    file: "invalid-kind-in-canonical.json",
    schemaValid: false,
    expectedError: {
      instancePath: "/parts/0",
      keyword: "additionalProperties",
      params: { additionalProperty: "kind" }
    }
  },
  {
    file: "invalid-decorative-collision.json",
    schemaValid: false,
    expectedError: { instancePath: "/parts/0/collisionPolicy", keyword: "enum" }
  },
  {
    file: "invalid-duplicate-tag.json",
    schemaValid: false,
    expectedError: { instancePath: "/asset/tags", keyword: "uniqueItems" }
  },
  {
    file: "invalid-tag-id.json",
    schemaValid: false,
    expectedError: { instancePath: "/asset/tags/0", keyword: "pattern" }
  },
  { file: "semantic-invalid-unsorted-tags.json", schemaValid: true }
];

const schema = loadJson<Record<string, unknown>>(schemaPath);
const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(schema);

describe("Hestia asset authoring contract v1", () => {
  it("discovers exactly the explicitly classified fixture inventory", () => {
    const discovered = readdirSync(fixtureDirectory)
      .filter((file) => file.endsWith(".json"))
      .sort();
    const expected = fixtureCases.map(({ file }) => file).sort();

    expect(discovered).toEqual(expected);
  });

  it.each(fixtureCases)("validates $file with the declared Draft 2020-12 outcome", (fixtureCase) => {
    const document = loadJson(fixturePath(fixtureCase.file));
    const actual = validate(document);

    expect(actual, JSON.stringify(validate.errors, null, 2)).toBe(fixtureCase.schemaValid);
    if (fixtureCase.expectedError) {
      const expectedError = {
        instancePath: fixtureCase.expectedError.instancePath,
        keyword: fixtureCase.expectedError.keyword,
        ...(fixtureCase.expectedError.params
          ? { params: expect.objectContaining(fixtureCase.expectedError.params) }
          : {})
      };
      expect(validate.errors).toEqual(expect.arrayContaining([expect.objectContaining(expectedError)]));
    } else {
      expect(validate.errors).toBeNull();
    }
  });

  it("keeps the complete golden document representative and canonical", () => {
    const golden = loadJson<CompleteFixture>(fixturePath("valid-complete.json"));
    const decorative = golden.parts.find(({ representation }) => representation === "Decorative");
    const shell = golden.parts.find(({ representation }) => representation === "Shell");
    const renderMaterialIds = golden.materials.map(({ renderMaterialId }) => renderMaterialId);
    const taggedValues: readonly TaggedValue[] = [golden.asset, ...golden.parts, ...golden.joints, ...golden.markers, ...golden.materials];

    expect(golden.schema).toBe("hestia.asset-authoring.v1");
    expect(golden.parts.length).toBeGreaterThan(0);
    expect(golden.joints.length).toBeGreaterThan(0);
    expect(golden.markers.length).toBeGreaterThan(0);
    expect(golden.materials.length).toBeGreaterThan(0);
    expect(decorative).toMatchObject({ destructible: false, collisionPolicy: "AuthoredMesh" });
    expect(shell?.shell?.layers.length).toBeGreaterThan(0);
    expect(renderMaterialIds).toContain(shell?.defaultRenderMaterialId);
    expect(shell?.structuralMaterialId).toBe(golden.asset.defaultStructuralMaterialId);
    expect(shell?.shell?.layers[0]?.structuralMaterialId).toBe(golden.asset.defaultStructuralMaterialId);
    expect(golden.materials[0]?.structuralMaterialId).toBe(golden.asset.defaultStructuralMaterialId);
    expect(taggedValues.every(({ tags }) => tags.length > 0 && tags.join("\0") === [...tags].sort().join("\0"))).toBe(true);
    expect(JSON.stringify(golden)).not.toContain('"kind"');
    expect(Object.keys(golden)).not.toContain("registryId");
    expect(Object.keys(golden)).not.toContain("registryVersion");
  });

  it("keeps unsorted tags outside JSON Schema authority", () => {
    const fixture = loadJson<UnsortedTagsFixture>(fixturePath("semantic-invalid-unsorted-tags.json"));

    expect(validate(fixture), JSON.stringify(validate.errors, null, 2)).toBe(true);
    expect(fixture.asset.tags).not.toEqual([...fixture.asset.tags].sort());
  });

  it("keeps the embedded contract example deeply equal to the complete golden fixture", () => {
    const fixtureReference = "schemas/fixtures/hestia-asset-authoring-v1/valid-complete.json";
    const embeddedExamples = [...contract.matchAll(/```json\s*([\s\S]*?)```/g)].map((match) =>
      JSON.parse(match[1] ?? "null")
    );
    const golden = loadJson<CompleteFixture>(fixturePath("valid-complete.json"));

    expect(contract.includes(fixtureReference)).toBe(true);
    expect(embeddedExamples).toHaveLength(1);
    expect(embeddedExamples[0]).toEqual(golden);
  });

  it("asserts lossless Hestia projection and provenance-only extras", () => {
    const anchors: readonly [string, RegExp][] = [
      ["lossless Hestia member projection", /every member of each\s+Hestia transport payload SHALL be copied/i],
      ["node-only kind removal", /only the required node transport classification\s+discriminator `kind` is removed before canonical assembly/i],
      ["unrelated-only provenance", /Only unrelated extras outside the\s+Hestia namespace may be retained as\s+provenance-only data/i]
    ];

    for (const [name, anchor] of anchors) {
      expect(normalizedContract, `Missing normative contract anchor: ${name}`).toMatch(anchor);
    }

    const normativeKindClauses: readonly [string, string][] = [
      [
        "`asset.extras.hestia`",
        "- `asset.extras.hestia`: A member named `kind` is not a transport discriminator in this namespace; it MUST be projected into the corresponding canonical object for closed-schema rejection or MUST be rejected during inventory; it MUST NOT be silently dropped."
      ],
      [
        "`material.extras.hestia`",
        "- `material.extras.hestia`: A member named `kind` is not a transport discriminator in this namespace; it MUST be projected into the corresponding canonical object for closed-schema rejection or MUST be rejected during inventory; it MUST NOT be silently dropped."
      ]
    ];

    for (const [namespace, expectedClause] of normativeKindClauses) {
      const scopedClauses = normalizedContractParagraphs.filter((candidate) => candidate.startsWith(`- ${namespace}:`));
      expect(scopedClauses, `Expected one independently scoped normative clause for ${namespace}`).toHaveLength(1);
      const scopedClause = scopedClauses[0] ?? "";

      expect(scopedClause, `Normative clause must be bound to ${namespace}`).toBe(expectedClause);
      expect(scopedClause).toMatch(/not a transport discriminator in this namespace/i);
      expect(scopedClause).toMatch(/MUST be projected into the corresponding canonical object/i);
      expect(scopedClause).toMatch(/MUST be rejected during inventory/i);
      expect(scopedClause).toMatch(/MUST NOT be silently dropped/i);
    }
  });

  it("asserts the complete node kind classification and hash invariant", () => {
    const requiredKindClauses: readonly string[] = [
      "The required node transport `kind` is consumed as an input to inventory/classification/routing into `parts`, `joints`, or `markers`.",
      "the `kind` member itself is not a canonical property, is not serialized in a canonical record, and is not directly hashed as a field.",
      "Changing a node transport `kind` SHALL trigger reclassification and full validation. It MAY change the assembled canonical document and authoring hash, or make the input invalid so no authoring hash is produced.",
      "Equal authoring hashes are guaranteed only when two transports classify and normalize to the same valid canonical document."
    ];

    for (const clause of requiredKindClauses) {
      expect(normalizedContract, `Missing normative node-kind clause: ${clause}`).toContain(clause);
    }
  });

  it("asserts the normative tag contract", () => {
    const anchors: readonly [string, RegExp][] = [
      ["empty tags are allowed", /Tags are optional; an absent or empty array is valid/i],
      ["tag ID shape", /Each tag is an ID-shaped string/i],
      ["tag uniqueness", /is unique within its array/i],
      ["lexical tag ordering", /lexically sorted in canonical form/i]
    ];

    for (const [name, anchor] of anchors) {
      expect(normalizedContract, `Missing normative contract anchor: ${name}`).toMatch(anchor);
    }
  });

  it("asserts material namespaces and registry hash domains", () => {
    const anchors: readonly [string, RegExp][] = [
      ["render IDs resolve in canonical materials", /renderMaterialId[\s\S]{0,160}canonical entry in `materials`/i],
      ["structural IDs use the external registry", /structuralMaterialId[\s\S]{0,180}external structural material registry/i],
      ["registry binding is pinned", /pins exactly one known external registry ID and registry version/i],
      ["authoring hash excludes registry binding", /registry binding[\s\S]{0,180}excluded from the (?:canonical )?authoring representation/i],
      ["compilation hash includes registry binding", /compilation\/manifest hash includes\s+the compiler version,\s+pinned external registry ID\/version/i]
    ];

    for (const [name, anchor] of anchors) {
      expect(normalizedContract, `Missing normative contract anchor: ${name}`).toMatch(anchor);
    }
  });

  it("asserts read-only source and temporary-state restoration", () => {
    const anchors: readonly [string, RegExp][] = [
      ["temporary Blender state is implementation-only", /temporary export implementation detail/i],
      ["state restoration covers every outcome", /restored on success, error, and abort/i],
      ["source files are not overwritten or saved", /Neither Agent F nor Agent G may save or\s+overwrite the source Blender file or source GLB/i],
      ["cancelled operations preserve source state", /failed or\s+cancelled operation leaves the source and observable authoring state unchanged/i]
    ];

    for (const [name, anchor] of anchors) {
      expect(normalizedContract, `Missing normative contract anchor: ${name}`).toMatch(anchor);
    }
  });
});
