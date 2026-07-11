# Design: Browser Ship Builder Domain Catalog v1

## Context

The feature is a pure TypeScript domain boundary for the Browser mainline. It must remain usable by later UI, validation, stat, resource, migration, and runtime layers without depending on any of them. Existing `core/hash.ts` exports FNV-1a and a planner-specific stable stringify; the latter is unsuitable because it rounds numbers and omits `planHash` by key.

## Module boundaries

- `ids.ts`: branded identity/version constructors and grammar.
- `types.ts`: JSON-safe primitives and serialized domain shapes.
- `categories.ts`: built-in constants, records, and deterministic ordering.
- `components.ts`: typed component union, socket-reference extraction, future handler interface.
- `sockets.ts`: socket constants and schema integrity helpers.
- `validation.ts`: shared structured errors, unknown-value readers, finite/range/integer/extension/deep-freeze utilities.
- `canonicalJson.ts`: generic JSON-safe key ordering plus domain canonical projections; hashes use `fnv1aHash` only.
- `catalog.ts`: validated immutable snapshot, summary, signature, and generated indexes.
- `blueprint.ts`: instance/connection/blueprint construction, transform helpers, reference integrity, layout projection/hash.
- `serialization.ts`: catalog/blueprint JSON parse/serialize and migration registry seams.
- `starterCatalog.ts`, `fixtures.ts`, `index.ts`: fixed v1 data, fixtures, and public API.

No root/core barrel file changes are required; the browser smoke imports the ship-builder barrel directly.

## Identity design

Use `type Brand<T, Name extends string> = T & { readonly __brand: Name }` (or equivalent) internally and explicit parser functions at all unknown/JSON boundaries. The v1 grammar accepts stable ASCII IDs beginning with a lowercase letter, followed by ASCII letters/digits with optional `.`, `_`, `-`, `:`, or `/` separators, with bounded length and no whitespace; this permits the required camelCase built-in category IDs. Distinct branded concepts prevent accidental cross-use at compile time while serialization stays plain JSON strings.

Do not provide random/time-based generators. Fixtures use fixed IDs. Transform helpers copy `stableInstanceId` and connection IDs unchanged.

Versions are branded positive integers. Current catalog, part/component, and blueprint schema constants are `1`; parsers reject greater versions with a specific unsupported-version code before applying v1 field allowlists or component-kind dispatch.

## Structured validation errors

Expose one error class carrying:

- stable `code` from a documented string union;
- JSON-pointer-like `path`;
- concise deterministic message;
- optional JSON-safe details.

Code families cover malformed JSON/type/required field, ID/version, duplicate, unknown reference/category/socket/instance, unsupported rotation/schema, invalid numeric/range/vector/extension, and canonicalization. Catalog validation follows fixed category order, then part ID, then socket/component ID, so the first failure is deterministic.

## Category and component design

Categories remain ordinary validated records, not a closed enum. Built-in IDs/constants are compile-time conveniences. A category may advertise allowed/recommended kinds for palette hints, but catalog indexing and all capability queries inspect explicit component `kind` values only.

The built-in component union is discriminated by the exact required PascalCase kinds. Shared fields live in a base interface. Component-specific fields follow the task contract, including explicit referenced socket arrays/IDs. `PowerHeatReserved` stores only typed non-negative reservation metadata and has no behavior.

`FunctionalComponentHandler<T>` and `FunctionalComponentHandlerRegistry` are code-side interfaces that may contain functions. They are not accepted by serializers and are not fields on component records.

## Spatial and socket representation

Use serializable `{x,y,z}` vectors, positive `{x,y,z}` dimensions/footprints, Euler degree `{yaw,pitch,roll}` for placed-instance rotation, and a finite normalized quaternion `{x,y,z,w}` (or a consistently validated serializable rotation record) for socket local rotation. V1 instance parsing accepts yaw normalized to `0|90|180|270` with pitch/roll exactly zero.

All sockets carry a direction vector and role. Functional direction vectors must be finite and nonzero; starter data uses unit vectors. Component reference extraction validates that every referenced socket exists in the same part. `requiredForComponentIds` likewise resolves locally. Type-pair compatibility and graph/flight validation remain future work.

## Canonical JSON and hashing

A generic canonicalizer recursively:

- accepts only JSON scalar/array/plain-object values;
- sorts object keys lexically;
- preserves exact finite JSON numbers except normalizing negative zero;
- rejects unsupported values/cycles;
- emits compact `JSON.stringify` output.

Domain normalization occurs before generic canonicalization:

- categories: sort order then ID;
- parts: category order then part ID;
- tags/aliases/compatible IDs/reference ID arrays: unique lexical order;
- sockets/components: ID order;
- blueprint instances/connections/mirror groups: stable ID order.

Catalog signature hashes only the canonical serialized catalog document, never summary/index/signature fields. Blueprint canonical serialization includes supported draft/cache fields for lossless roundtrip, while `blueprintLayoutHash` hashes a separate layout projection excluding blueprint ID/name, custom labels, draft metadata/timestamps, cache fields, and active-ship state. Catalog identity/version remains in the layout projection so a changed definition set cannot reuse a layout hash accidentally.

## Immutable snapshot design

Avoid exposing mutable `Map` or `Set` instances. Build null-prototype or normal plain records keyed by branded strings and readonly, deep-frozen arrays for:

- `partById`;
- `categoryById`;
- `partsByCategory`;
- `partsByComponentKind`;
- `partsByTag`.

Deep-freeze all category/part/component/socket/summary/index data. Serialize only the normalized catalog document.

## Parse and migration seam

Serialization accepts string or unknown decoded objects and reconstructs validated domain values field by field. It does not cast `JSON.parse` results to domain interfaces. Catalog and blueprint migration registry interfaces map a source schema version to a deterministic pure migration step. Empty v1 registries are provided. A future version without a registered migration produces the unsupported-schema code.

## Starter catalog and provisional balance

Implement two definitions for each built-in category, preserving the four IDs published in the data-model example and using fixed English concept slugs for the rest. Numeric values are coherent SI placeholders required to exercise typed fields, not final balance. Each definition carries namespaced extension metadata such as `weltraum.balance` with `provisional: true` and a concept-document source. Build costs are omitted.

Fixtures use explicit structural connections and functional socket references. They demonstrate schema integrity only and must not be described as passing the future flight-ready validator.

## Browser evidence design

The E2E runs at normal `/`, asserts no TestBridge, then executes a native browser dynamic import of `/src/ship-builder/index.ts` through Vite. It creates and serializes data entirely in page context, returning a compact summary to the Playwright process, which writes deterministic JSON and Markdown evidence under `evidence/`. There is no screenshot because no visual contract changes.

## Tradeoffs

- **Open categories, closed v1 component union:** categories can extend without code; new executable component shapes require a schema/code version, which preserves runtime safety.
- **Records instead of Maps:** slightly less ergonomic but materially stronger runtime immutability and JSON separation.
- **Independent canonicalizer:** avoids planner-specific rounding/omissions and makes serialized bytes an explicit ship-builder contract.
- **No full validator/stat engine:** keeps the slice focused while preserving every typed input and future handler/migration seam.

## Parallel-work protection

All work occurs in the dedicated feature worktree. Implementers own only the paths in their current task and may not reformat or absorb unrelated files. Any required change outside the allowlist, overlap with another worker, or need for Unity/UI/runtime integration is a stop-and-escalate condition.