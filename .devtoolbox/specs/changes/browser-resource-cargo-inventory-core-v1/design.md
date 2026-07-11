# Design

## Module boundary
All implementation lives under `apps/weltraum-browser/src/resources/**` and is exported from `resources/index.ts`. It has no hidden registry and no import from Ship Builder, UI, runtime, render, sim, or Unity code.

## Identity and extension model
IDs are branded strings validated at runtime with a lowercase save-safe pattern. Categories are catalog entries, not an enum. Resource definitions carry readonly metadata and optional namespaced extension records. Stack rules are discriminated unions with kind-specific invariant validation.

## Canonicalization and signatures
A resource-local canonical JSON helper recursively sorts object keys, rejects non-finite numbers/unsupported values, and preserves semantically ordered arrays. Catalog/category/resource arrays, tags, hazards, summaries, totals, and container contents are normalized before serialization. Signatures use a deterministic synchronous hash over canonical JSON. Catalog registration order and input stack order therefore cannot affect signatures. Planner hash rounding is not reused because persistent cargo quantities must not silently lose precision.

## Immutable state and snapshots
Definitions and states are readonly values. Constructors/validators clone and canonically order arrays/metadata. Container mass, volume, capacity, totals, hazard/legality summaries, depletion, and signature are derived from contents and catalog definitions; they are never authoritative mutable fields.

## Transfer algorithm
1. Validate command identity, quantity, container IDs, revisions, resource, and deterministic source-stack candidates.
2. Evaluate access, ownership, mission/sealed, category/tag/hazard, and target policy constraints in a stable code order.
3. Calculate transferable quantity as the minimum of available quantity, stack-rule limits, target stack capacity/count, remaining mass, and remaining volume.
4. Atomic mode rejects if the whole request cannot be accepted. Partial mode also requires compatible container policy and a splittable stack.
5. Produce new canonical source/target arrays, preserving retained source stack IDs and metadata. Merge only metadata-compatible target stacks; otherwise use the supplied target ID or a deterministic command-derived ID. Never use clock/random/global state.
6. Increment both revisions once for an accepted non-zero change and return before/after signatures/deltas. Rejections preserve prior values/revisions/signatures.

Optional `sourceStackId` is allowed for precise selection; absent it, candidates use canonical stack ID order. Heterogeneous metadata is never silently merged.

## Policy semantics
Hazards/categories/tags are blocked only by explicit target policy and can emit ordered risk warnings when allowed. Ownership, legality, sealed and mission context metadata is preserved. V1 reports no fines, police, reputation, pricing dynamics, or mining behavior.

## Evidence
The Playwright test loads normal `/`, confirms TestBridge is absent, dynamically imports `/src/resources/index.ts`, executes full/partial/rejected flows, repeats deterministic constructions, and writes task-owned JSON/Markdown evidence only.