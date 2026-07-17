# Design: Hestia Asset Authoring Contract V1 Hardening

## Change

`tools-hestia-authoring-contract-hardening-v1`

This is a contract, schema-clarification, and reproducible-test change. It does
not implement either side of the exporter/compiler handoff.

## Ownership and boundaries

- Agent F owns the GLB exporter transport and the v1 authoring schema.
- Agent G consumes the transport and schema read-only and owns compilation and
  the compiled-manifest schema.
- The authoring contract owns canonical authoring semantics only. The external
  material registry owns structural physical properties and registry identity.
- No compiler or exporter worktree is writable in this change.

## Normative Agent G pipeline

The compiler implementation that later consumes this contract SHALL follow this
order and SHALL fail closed at the first invalid boundary:

1. Parse the GLB with bounds checks for every referenced buffer, view, accessor,
   JSON value, node, and material extras payload. A malformed or out-of-bounds
   input is rejected before semantic interpretation.
2. Inventory `asset.extras.hestia`, node extras, and material extras. The asset
   extras carry the schema and canonical asset fields. A node's Hestia extras
   carry a transport `kind` used only to classify `part`, `joint`, or `marker`.
   Material extras carry canonical material fields. Every member in a Hestia
   transport payload is copied to its corresponding canonical object, except
   that only the required node transport classification discriminator `kind` is
   removed before canonical assembly. A `kind` member inside asset or material
   `extras.hestia` is not a recognized transport discriminator there; it is
   projected into the corresponding canonical object for closed-schema rejection
   or rejected during inventory, and is never silently dropped. Unknown Hestia
   members are not silently dropped. Only unrelated, non-Hestia extras may be
   retained as provenance-only data.
3. Assemble exactly one in-memory closed canonical root:
   `{schema,asset,parts,joints,markers,materials}`. Remove only the required
   node transport classification `kind` at this boundary; it is not a canonical
   property and is not copied into provenance as semantic data. A `kind` member
   from asset or material Hestia extras is rejected, not dropped.
4. Validate the root against the Draft 2020-12 Hestia v1 schema.
5. Apply fail-closed semantic validation for ID syntax and uniqueness, exact
   reference resolution, parent cycles, decorative restrictions, and material
   namespace ownership.
6. Canonicalize deterministically: lexical object-key ordering, stable-ID
   ordering for the canonical arrays, lexical tag ordering, finite-number
   checks, and negative-zero normalization. No timestamps, paths, locale,
   random values, or Blender iteration order enter canonical semantics.
7. Compute the registry-independent authoring/semantic hash from the canonical
   authoring representation. Use the existing lowercase SHA-256 convention.

The implementation may retain unknown optional non-Hestia GLB extras as raw
provenance, including source bytes when needed for a raw-source hash, but it SHALL
not treat them as canonical semantic fields. Unknown canonical Hestia-v1 fields
and unknown schema/version values SHALL fail closed.

## Transport versus canonical contract

Only the required node transport classification discriminator `kind` is allowed
in the GLB transport, where it is consumed during inventory/classification to
route a node as `part`, `joint`, or `marker`. The `kind` member itself is removed
before canonical assembly, is forbidden in every canonical object, and is never
serialized into a canonical record or directly hashed as a field. A `kind`
member inside `asset.extras.hestia` or `material.extras.hestia` is not a
recognized transport discriminator there; it must be projected into the
corresponding canonical object for closed-schema rejection or rejected during
inventory, never silently dropped.

Changing a node's transport `kind` requires full reclassification and validation.
It may change the assembled canonical document and authoring hash, or yield no
valid canonical document and therefore no authoring hash. Only two transport
encodings that classify to the same valid canonical document have the same
authoring hash.

The canonical root remains closed and has exactly four top-level arrays
(`parts`, `joints`, `markers`, and `materials`) plus `schema` and `asset`, as
already defined by v1. This change clarifies existing fields and constraints; it
does not add new required authoring properties.

## Read-only input invariant

Agent F may mutate Blender/export state only as a temporary implementation detail.
It SHALL restore all changed properties, selection, and active object on success,
error, and abort. Neither exporter nor compiler may overwrite or save the source
Blender file or source GLB as a side effect. An explicitly requested new output
file is allowed. Agent G transforms only derived in-memory values or explicitly
requested output and never mutates source input. A failed or cancelled operation
must leave the source and observable authoring state as they were before it began.

## Material namespace and hash domains

- `renderMaterialId` resolves exactly once against exactly one canonical entry in
  the `materials` array.
- `structuralMaterialId` and `defaultStructuralMaterialId` are opaque global IDs
  resolved only through an external versioned registry. They never resolve
  against the canonical `materials` array.
- The authoring schema adds no registry field.
- Agent G compiler configuration pins exactly one registry ID and version. Missing,
  unknown, or ambiguous binding is a fail-closed error.
- The output manifest records compiler version and registry ID/version.
- Authoring/semantic hash excludes registry binding. Compilation/manifest hash
  includes the pinned registry binding and the compiled output inputs.

Therefore, the same canonical authoring input compiled with two different valid
registry bindings has the same authoring hash and different compilation/manifest
hashes.

## Semantic clarifications

- A `Decorative` part SHALL have `destructible: false` and its
  `collisionPolicy` SHALL be `None` or `AuthoredMesh` only.
- Tags are optional, empty is valid, every tag uses the existing ID pattern,
  tags are unique, and canonical tags are lexically sorted. V1 introduces no
  reserved prefixes or cardinality vocabulary. Blender exporter v1 may emit no
  tag properties and therefore empty tags.
- IDs remain case-sensitive, untrimmed, and validated by the existing v1 ID
  pattern. IDs are unique in their category; all references resolve exactly
  once; parent relationships contain no cycles.
- Physical density/strength and other structural material behavior are registry
  data, not arbitrary GLB semantic values.

## Evidence boundary for this change

This change is contract-only. Its executable evidence is limited to the locked
Ajv Draft 2020-12 fixture tests, the embedded-example/fixture deep-equality
test, static and normative contract assertions, schema annotation-equivalence,
and a read-only execution of the existing exporter compatibility tests. The
checked-in schema behavior and fixture inventory remain the authority; no
hand-written validator replaces it.

The focused fixture cases are:

- minimal valid canonical document;
- complete valid golden canonical document;
- missing required property;
- unknown canonical property;
- wrong schema version;
- `kind` present in canonical data;
- decorative part with invalid collision policy;
- duplicate tag;
- `invalid-tag-id.json` with an invalid tag ID and expected Ajv-invalid result;
- `semantic-invalid-unsorted-tags.json`, which is structurally/schema-valid and
  therefore expected Ajv-valid, but semantically invalid because its tags are not
  lexically sorted; it is classified negative at the semantic level.

Executable implementation tests for GLB bounds-safe ingest, transport inventory,
semantic/reference/cycle validation, canonicalization and hash generation,
external registry resolution, and read-only Blender/exporter behavior are
deferred. Agent G owns the ingest, semantic, canonicalization, registry, and
hash implementation tests in the compiler change; Agent F owns Blender and
exporter behavior tests in the exporter change. This change may only execute
those existing exporter tests read-only for compatibility evidence and must not
implement either side.

## Rejected alternatives

### Registry fields in the authoring root

Rejected because it couples every producer to a deployment-specific registry and
turns a registry update into a breaking authoring contract requirement. Registry
binding belongs in compiler configuration and the compiled manifest, not in the
authoring root.

### No registry binding

Rejected because compilation would not be reproducible or auditable when the
external structural-material registry changes. Exactly one registry ID/version is
therefore required at compilation time and recorded in the manifest.

### Hand-written validator or manual-only golden proof

Rejected because it would not provide reproducible Draft 2020-12 schema proof and
could drift from the actual schema. Ajv locked in the Node 22/Vitest lane is the
schema-validation authority, and the complete golden fixture is validated by it.

### Compiler/exporter implementation in this same change

Rejected because it couples two implementation branches to a contract-hardening
change, expands the review surface, and prevents a clean handoff. This change
updates the contract and its reproducible proof only.

## Risks and stop rules

- Treating transport metadata as a canonical field would produce hash drift, and
  ignoring `kind` during classification is a stop condition. A changed `kind`
  may legitimately change the canonical document/hash or yield no valid
  document/hash; only transport encodings that classify to the same valid
  canonical document may have the same authoring hash.
- A schema-valid but semantically unresolved reference must still fail closed.
- Any source mutation, source save/overwrite, missing restoration on error/abort,
  registry ambiguity, unknown canonical field acceptance, non-deterministic
  ordering, or negative-zero hash drift is a stop condition.
- Any test, review, CI, or diff evidence outside the approved scope is not a
  substitute for the required gate and must be reported rather than waived.
