# Hestia Asset Authoring Contract V1

## Ownership and version boundary

Agent F owns the GLB exporter transport and this authoring schema. Agent G
consumes the transport and schema read-only and owns compilation and the
compiled-manifest schema. This contract is V1: there is no migration or
aliasing. An unknown schema value, unknown canonical Hestia field, or
schema-version mismatch fails closed.

The canonical authoring root is closed and has exactly these members:
`schema`, `asset`, `parts`, `joints`, `markers`, and `materials`. The schema
does not add a registry field or a new required authoring property.

## Normative GLB transport-to-hash pipeline

Agent G SHALL perform these steps in this order and SHALL reject the input at
the first invalid boundary:

1. Parse the GLB container and JSON/BIN chunks with bounds checks. Every
   referenced buffer, buffer view, accessor, JSON value, node, and material
   extras payload must be present and within its containing range before it is
   interpreted. Malformed or out-of-bounds input is rejected.
2. Inventory the project Hestia extras in memory:
   - `asset.extras.hestia` supplies `schema` and the canonical asset fields.
   - Hestia node extras supply transport records. Their required `kind` value is
     consumed as an input to inventory/classification/routing and classifies the
     record into `parts`, `joints`, or `markers` only.
   - `material.extras.hestia` supplies canonical material entries.
   Inventory is lossless within the Hestia namespace: every member of each
   Hestia transport payload SHALL be copied into its corresponding canonical
   object, except that only the required node transport classification
   discriminator `kind` is removed before canonical assembly.

   - `asset.extras.hestia`: A member named `kind` is not a transport discriminator in this namespace; it MUST be projected into the corresponding canonical object for closed-schema rejection or MUST be rejected during inventory; it MUST NOT be silently dropped.

   - `material.extras.hestia`: A member named `kind` is not a transport discriminator in this namespace; it MUST be projected into the corresponding canonical object for closed-schema rejection or MUST be rejected during inventory; it MUST NOT be silently dropped.

   Implementations SHALL not
   whitelist known members and silently drop other Hestia members. Only
   unrelated extras outside the Hestia namespace may be retained as
   provenance-only data.
3. Assemble exactly one in-memory canonical root with the six members listed
   above. The assembly is derived data; it does not rewrite the source GLB.
 4. Remove only the required node transport classification `kind` while entering
    the canonical model. The separate asset and material namespace clauses above
    govern `kind` in those Hestia extras. The node transport `kind` has already
    been consumed as an input to inventory/classification/routing; the `kind`
    member itself is not a canonical property, is not serialized in a canonical
    record, and is not directly hashed as a field.
5. Validate the assembled root against
   `schemas/hestia-asset-authoring-v1.schema.json` using Draft 2020-12. The
   closed schema rejects unknown properties, including `kind` in any
   canonical object.
6. Apply fail-closed semantic validation: ID syntax and category uniqueness,
   exact reference resolution, parent-cycle rejection, decorative rules, tag
   rules, and material namespace ownership.
7. Normalize deterministically: object keys are lexical, stable-ID arrays and
   tags are lexical, all numbers are finite, and negative zero is normalized
   to zero. Timestamps, paths, locale, random values, and Blender iteration
   order are excluded from canonical semantics.
 8. Compute the registry-independent authoring/semantic hash only after all
    preceding steps, from the normalized canonical authoring representation,
    using lowercase SHA-256.

Changing a node transport `kind` SHALL trigger reclassification and full
validation. It MAY change the assembled canonical document and authoring hash,
or make the input invalid so no authoring hash is produced. Equal authoring
hashes are guaranteed only when two transports classify and normalize to the
same valid canonical document.

Unknown optional extras outside the Hestia-v1 namespace may be retained only as
raw provenance. They are not accepted Hestia semantics and must not enter the
canonical authoring representation or authoring hash. A separate raw-source
hash may cover their source bytes. This provenance-only allowance does not
permit dropping or silently accepting unknown members inside a Hestia payload.

## Read-only source invariant

Agent F may change Blender properties, selection, and active object only as a
temporary export implementation detail. The exact observable state must be
restored on success, error, and abort. Neither Agent F nor Agent G may save or
overwrite the source Blender file or source GLB as a side effect. An explicitly
requested new exporter output file is allowed. Agent G may normalize only an
in-memory derived model or an explicitly requested output artifact. A failed or
cancelled operation leaves the source and observable authoring state unchanged.

## Transport records and canonical objects

The GLB transport contains `asset.extras.hestia` for asset metadata, node
extras with `kind: "part"`, `kind: "joint"`, or `kind: "marker"`, and material
extras for material metadata. The required node transport `kind` is consumed as
an input to inventory/classification/routing into `parts`, `joints`, or
`markers`. Only after that classification is the `kind` member removed before
schema validation, semantic validation, normalization, and hashing. The
separate asset and material namespace clauses above govern `kind` members in
those Hestia extras. The node discriminator must not be copied into the
canonical root, asset, part, joint, marker, or material objects.

## IDs, references, and semantic validation

IDs match `^[a-z0-9][a-z0-9._:-]{0,127}$`. They are case-sensitive, are not
trimmed, and are not otherwise normalized. IDs are unique within each
category. Every parent, joint, marker, and render-material reference resolves
exactly once; parent relationships contain no cycle. Structural-material
references are checked against the pinned external registry at compilation,
not against the canonical render-material array.

The schema provides structural shape and existing lexical constraints. The
compiler adds the semantic checks that JSON Schema does not express, including
cross-object uniqueness, reference resolution, cycle detection, canonical tag
ordering, and the material namespace boundary.

## Asset and parts

`asset` requires `assetId`, a safe nonnegative integer `assetRevision`,
`representation`, `metersPerUnit: 1`, and the exact right-handed coordinate
frame `upAxis: "+Y"`, `forwardAxis: "+Z"`, `handedness: "RIGHT"`.

Every part requires `partId`, `representation`, `destructible`,
`collisionPolicy`, `navigationPolicy`, and `thinFeature`. `Shell` and
`LayeredShell` parts require a shell object with positive thickness and at
least one layer. Every part declares a thin-feature policy and positive
minimum thickness; the compiler measures actual geometry, and authored
metadata is not proof of physical thickness.

A `Decorative` part is always `destructible: false` and may use only
`collisionPolicy: "None"` or `"AuthoredMesh"`. `Compound` and `Voxel` are
invalid for Decorative parts.

## Joints, markers, and materials

Joints and markers are separate transport records and canonical arrays.
Threshold joints require a positive break force or torque. `CutInterface`
markers require `interfaceId`. Transport node transforms carry joint/marker
placement and are normalized by the compiler into derived output; transforms
are not additional canonical schema fields in this V1 document.

Each canonical material has one `renderMaterialId`. Every render identifier,
including a part's `defaultRenderMaterialId`, resolves exactly once against
exactly one canonical entry in `materials`. Duplicate or missing render
matches fail closed.

`structuralMaterialId` and `defaultStructuralMaterialId` are globally
namespaced opaque IDs. They resolve only through the external structural
material registry and never through `materials`. Registry-owned density,
strength, and other physical values are not arbitrary GLB authoring fields.

## Tags

Tags are optional; an absent or empty array is valid. Each tag is an ID-shaped
string using the existing ID pattern, is unique within its array, and is
lexically sorted in canonical form. V1 adds no reserved prefix or cardinality
vocabulary. Exporter V1 may therefore emit deterministic empty tag arrays.

## Complete canonical example

This is a complete schema-valid canonical example and is the documentation
counterpart of the complete golden fixture at
`schemas/fixtures/hestia-asset-authoring-v1/valid-complete.json`; the fixture
must remain object-equivalent to this example.

```json
{
  "schema": "hestia.asset-authoring.v1",
  "asset": {
    "assetId": "ship.demo-scout",
    "assetRevision": 1,
    "representation": "Hybrid",
    "metersPerUnit": 1,
    "coordinateFrame": {
      "upAxis": "+Y",
      "forwardAxis": "+Z",
      "handedness": "RIGHT"
    },
    "defaultStructuralMaterialId": "structural.aluminum-6061",
    "tags": [
      "canonical",
      "ship"
    ]
  },
  "parts": [
    {
      "partId": "hull.core",
      "representation": "Shell",
      "defaultRenderMaterialId": "render.hull",
      "structuralMaterialId": "structural.aluminum-6061",
      "destructible": true,
      "collisionPolicy": "AuthoredMesh",
      "navigationPolicy": "Obstacle",
      "thinFeature": {
        "policy": "PreserveAsShell",
        "declaredMinimumThicknessMeters": 0.02
      },
      "shell": {
        "thicknessMeters": 0.02,
        "layers": [
          {
            "structuralMaterialId": "structural.aluminum-6061",
            "thicknessMeters": 0.02
          }
        ]
      },
      "tags": [
        "hull",
        "primary"
      ]
    },
    {
      "partId": "trim.decorative",
      "parentPartId": "hull.core",
      "representation": "Decorative",
      "defaultRenderMaterialId": "render.hull",
      "destructible": false,
      "collisionPolicy": "AuthoredMesh",
      "navigationPolicy": "None",
      "thinFeature": {
        "policy": "DecorativeOnly",
        "declaredMinimumThicknessMeters": 0.005
      },
      "tags": [
        "decorative",
        "trim"
      ]
    }
  ],
  "joints": [
    {
      "jointId": "joint.trim",
      "parentPartId": "hull.core",
      "childPartId": "trim.decorative",
      "jointType": "Fixed",
      "breakPolicy": "Never",
      "tags": [
        "assembly",
        "fixed"
      ]
    }
  ],
  "markers": [
    {
      "markerId": "docking.front",
      "markerType": "Docking",
      "partId": "hull.core",
      "tags": [
        "docking",
        "front"
      ]
    }
  ],
  "materials": [
    {
      "renderMaterialId": "render.hull",
      "structuralMaterialId": "structural.aluminum-6061",
      "paletteIndex": 7,
      "tags": [
        "hull",
        "metal"
      ]
    }
  ]
}
```

## Canonicalization and hash domains

Canonical serialization is UTF-8 compact JSON with lexically ordered object
keys, parts/joints/markers/materials sorted by stable ID, and tags sorted
lexically. Only finite numbers are accepted and negative zero becomes zero.
The node transport `kind` has already served its classification role and is
excluded from the canonical authoring representation; it is not serialized in a
canonical record or directly hashed as a field. Raw foreign extras, registry
binding, timestamps, paths, locale, random values, and Blender iteration order
are also excluded from the authoring representation. The authoring/semantic hash
is the lowercase SHA-256 of that representation.

Agent G pins exactly one known external registry ID and registry version in
compiler configuration. Missing, unknown, or ambiguous bindings fail closed.
The `hestia.asset-manifest.v1` output records at least compiler version,
external structural-material registry ID, and registry version, alongside
source inventory, normalized semantics, thin-feature decisions, deterministic
diagnostics, and compiled geometry/semantics/voxelization data. The compiled
geometry is represented by sparse `16^3` bricks at exactly `0.125 m` or
`0.25 m` resolution. The manifest SHALL include the geometry hash, semantics
hash, voxelization hash, and manifest-tree hash. The compilation/manifest hash
includes the compiler version, pinned external registry ID/version, and the
compiled inputs; these obligations do not relax any of the manifest outputs or
hashes required by the baseline contract.
It is therefore valid for the same canonical authoring input to have the same
authoring hash but different compilation/manifest hashes under different valid
registry bindings.
