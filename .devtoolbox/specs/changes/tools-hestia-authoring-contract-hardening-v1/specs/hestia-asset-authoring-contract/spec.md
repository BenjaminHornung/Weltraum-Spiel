# Capability: hestia-asset-authoring-contract

## Requirement

The Hestia Asset Authoring Contract V1 SHALL define one fail-closed, deterministic
handoff from GLB transport to a canonical authoring root and one explicit boundary
from canonical authoring data to registry-bound compilation. The contract SHALL be
validated with locked Ajv in the existing Node 22/Vitest lane. This change SHALL
not implement the exporter or compiler.

## Scope and invariants

1. Agent G SHALL perform bounds-safe GLB parsing before interpreting values.
2. Inventory SHALL include `asset.extras.hestia`, Hestia extras on nodes, and
    material extras. The transport node `kind` SHALL classify only `part`, `joint`,
    or `marker`. Every member inside a Hestia transport payload SHALL be copied
    into the corresponding canonical object except that only the required node
    transport classification discriminator `kind` is removed before canonical
    assembly. A `kind` member inside `asset.extras.hestia` or
    `material.extras.hestia` is not a recognized transport discriminator there
    and SHALL be projected into the corresponding canonical object for closed
    schema rejection or rejected during inventory; it SHALL never be silently
    dropped. Unknown Hestia members SHALL not be silently dropped or whitelisted
    away.
3. The only canonical root SHALL be
   `{schema,asset,parts,joints,markers,materials}`. The required node transport
   classification `kind` SHALL be consumed during inventory/classification and
   removed at this boundary. The `kind` member SHALL be absent from every
   canonical object and SHALL never be serialized or directly hashed as a field;
   its classification result SHALL be reflected in the assembled canonical
   records. A `kind` member from asset or material Hestia extras SHALL instead
   be projected for closed-schema rejection or rejected during inventory, never
   silently dropped.
4. The canonical root SHALL pass the Draft 2020-12 v1 schema, then fail-closed
   semantic validation for ID syntax/uniqueness, exact references, parent cycles,
   decorative rules, tags, and material namespaces.
5. Canonicalization SHALL sort object keys lexically, sort each stable-ID array
   deterministically, sort tags lexically, reject non-finite numbers, and
   normalize negative zero. Blender iteration order, timestamps, paths, locale,
   and random values SHALL not affect canonical semantics.
6. The authoring/semantic hash SHALL be computed after canonicalization and SHALL
   exclude registry binding. The compilation/manifest hash SHALL include the
   compiler version and pinned registry ID/version.
7. Agent F SHALL restore temporary Blender/export state, including properties,
   selection, and active object, on success, error, and abort. Neither exporter
   nor compiler SHALL overwrite or save the source Blender file or source GLB as
   a side effect. Explicitly requested new output is allowed; compiler transforms
   are in-memory or derived-output only.
8. The authoring schema SHALL add no registry fields and SHALL not add new
   required properties. Unknown canonical Hestia-v1 fields and wrong schema
   values SHALL fail closed. Unknown optional non-Hestia GLB extras MAY be kept
   only as raw provenance and SHALL not become canonical semantic fields.
9. `renderMaterialId` SHALL resolve exactly once against the canonical `materials`
   array. `structuralMaterialId` and `defaultStructuralMaterialId` SHALL be
   opaque global IDs resolved only in the external registry.
10. Decorative parts SHALL be non-destructible and SHALL use only `None` or
     `AuthoredMesh` collision policy. Tags MAY be empty, SHALL use the existing ID
     pattern, SHALL be unique, and SHALL be lexically sorted. V1 adds no reserved
     prefixes or cardinality vocabulary; Blender exporter v1 may emit empty tags.

## Evidence boundary and ownership

The requirements and scenarios below define the normative handoff contract, but
this change does not implement either producer or consumer. Evidence produced
here is limited to locked Ajv Draft 2020-12 validation of the checked-in schema
and fixtures, embedded-example/fixture deep equality, static and normative
contract assertions, schema annotation-equivalence, and read-only execution of
the existing exporter compatibility tests.

Executable implementation tests for GLB ingest, semantic/reference/cycle
validation, canonicalization, registry resolution, and authoring/compilation
hash generation are deferred to Agent G's compiler change. Blender state
restoration and exporter behavior tests are deferred to Agent F's exporter
change. No implementation of those behaviors belongs in this change.

## Scenarios

### Scenario: Bounds-safe GLB transport is inventoried

- Given a GLB contains bounded JSON, buffers, accessors, asset Hestia extras,
  classified node Hestia extras, and material extras
- When Agent G inventories the input
- Then every referenced range is checked before use, the asset and material
  metadata is collected, and node `kind` values classify transport records only
- And any malformed or out-of-bounds reference is rejected without source
  mutation or source save

### Scenario: Canonical root is assembled and normalized

- Given valid transport metadata for an asset
- When Agent G assembles canonical data
- Then exactly one in-memory root with keys
  `{schema,asset,parts,joints,markers,materials}` is produced
- And object keys, stable-ID arrays, and tags are deterministically sorted,
  finite numbers are accepted, negative zero is normalized, and the transport
  `kind` member is absent from canonical records and direct hash input
- And the authoring hash is computed from this canonical representation only

### Scenario: Minimal valid canonical fixture is accepted

- Given the minimal valid v1 fixture with the required root and asset fields and
  empty `parts`, `joints`, `markers`, and `materials` collections
- When locked Ajv validates the fixture against Draft 2020-12
- Then validation succeeds and the fixture is eligible for Agent G's deferred
  semantic validation

### Scenario: Complete golden canonical fixture is accepted

- Given the complete schema-valid golden fixture containing representative asset,
  part, joint, marker, material, shell, tags, and reference data
- When locked Ajv validates the fixture against Draft 2020-12
- Then validation succeeds; Agent G's deferred semantic validation,
  canonicalization, and authoring-hash tests consume this fixture later
- And the test uses the complete fixture rather than an incomplete inline example

### Scenario: Missing required canonical property fails closed

- Given a canonical fixture with one required property removed
- When locked Ajv validates it
- Then validation fails and no canonical or compiled success result is produced

### Scenario: Unknown canonical property fails closed

- Given a canonical Hestia-v1 object with an additional unknown property
- When locked Ajv validates it
- Then validation fails because canonical objects are closed

### Scenario: Wrong schema version fails closed

- Given a root whose `schema` value is not `hestia.asset-authoring.v1`
- When transport or canonical validation runs
- Then validation fails and no v1 interpretation or aliasing is attempted

### Scenario: Transport kind classifies records but is not canonical data

- Given transport nodes use required `kind` values `part`, `joint`, or `marker`
- When Agent G inventories and classifies the input
- Then `kind` is consumed to route each node record and full reclassification and
  validation is required if a transport `kind` changes
- And when the canonical root is assembled, `kind` is removed before schema,
  semantic, and hash processing and is not serialized or directly hashed as a
  field
- And given a canonical object containing `kind`
- When Ajv validates it
- Then validation fails
- And if a changed transport `kind` still classifies to the same valid canonical
  document, the authoring hash is the same
- But if it changes the assembled canonical document, the authoring hash may
  change, and if validation fails, no valid canonical document or authoring hash
  is issued

### Scenario: ID, uniqueness, reference, and cycle violations fail closed

- Given IDs use the existing case-sensitive pattern and are not trimmed
- When IDs are unique by category and every parent, joint, marker, and material
  reference resolves exactly once with no parent cycle
- Then semantic validation succeeds
- But given an invalid ID, duplicate category ID, missing/ambiguous reference,
  or parent cycle
- When semantic validation runs
- Then validation fails with an explicit diagnostic and no success hash is issued

### Scenario: Decorative restrictions are enforced

- Given a part has `representation: "Decorative"`
- When semantic validation runs
- Then `destructible` SHALL be `false` and `collisionPolicy` SHALL be `None` or
  `AuthoredMesh`
- But given a decorative part with `destructible: true` or `Compound`/`Voxel`
  collision
- When validation runs
- Then validation fails closed

### Scenario: Tags are deterministic and permissive within v1

- Given tags are absent or an empty list
- When semantic validation runs
- Then validation succeeds
- Given tags use the existing ID pattern with no duplicates
- When canonicalization runs
- Then tags are lexically sorted
- But given a malformed or duplicate tag
- When validation runs
- Then validation fails; no reserved prefix or cardinality rule is introduced

### Scenario: Material namespaces resolve once and remain separate

- Given each `renderMaterialId` resolves exactly once in canonical `materials`
- And `structuralMaterialId` and `defaultStructuralMaterialId` are opaque IDs
  resolved only by the external registry
- When authoring validation runs
- Then render and structural namespaces remain separate
- And no registry field is added to the authoring root
- But a missing, duplicate, or ambiguous render material reference fails closed

### Scenario: Registry binding is pinned at compilation

- Given compiler configuration names exactly one known registry ID and version
- When compilation runs
- Then the output manifest records compiler version and registry ID/version
- But given absent, unknown, or ambiguous registry binding
- When compilation is requested
- Then compilation fails closed without changing the authoring hash

### Scenario: Authoring and compilation hash domains differ correctly

- Given the same canonical authoring input is compiled once with registry A/version
  1 and once with registry B/version 2
- When authoring hashes are computed
- Then both authoring hashes are equal
- When compilation/manifest hashes are computed
- Then the hashes differ because the compiler and registry binding are included
- And given only input ordering changes
- Then the authoring hash remains equal after canonicalization
- And given a transport `kind` change, full reclassification and validation run
- Then the authoring hash is equal only when both transport encodings classify to
  the same valid canonical document; otherwise it may differ or no valid
  document/hash is issued

### Scenario: Unknown optional GLB extras remain provenance-only

- Given GLB extras outside the Hestia namespace are present
- When the input is canonicalized
- Then they may be retained as raw provenance/source-hash material only
- And they SHALL not be accepted as canonical semantic fields or alter the
  authoring hash
- But an unknown field inside canonical Hestia-v1 data fails closed

### Scenario: Read-only state is restored on every exporter outcome

- Given Agent F temporarily changes Blender/export properties, selection, or
  active object
- When export succeeds, errors, or is aborted
- Then all changed state is restored exactly
- And the source Blender file and source GLB are neither overwritten nor saved
- And an explicitly requested new output file may be written

### Scenario: Reproducible locked CI proof is used

- Given the existing Node 22/Vitest lane and one exact Ajv devDependency resolution
- When focused contract tests run
- Then Ajv Draft 2020-12 validates the schema and the checked-in positive and
  negative fixtures, and the embedded example is deeply equal to the complete
  fixture
- And static/normative contract assertions and schema annotation-equivalence
  remain within this change's evidence boundary
- And existing exporter compatibility tests may be executed read-only
- And no hand-written validator is used as schema authority

## Compatibility and exclusions

The change SHALL preserve exporter v1 compatibility, including empty tags and
transport `kind`, while adding no exporter feature requirement. It SHALL not
implement compiler behavior, runtime/UI/E2E/Unity behavior, schema v2, new required
properties, authoring-root registry fields, source migration, or test-data writes.
