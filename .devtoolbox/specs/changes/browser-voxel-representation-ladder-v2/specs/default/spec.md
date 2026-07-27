# Capability: Browser Voxel Representation Ladder V2

## Requirement: Derived-only authority boundary

The ladder shall select and describe derived visual products only. It shall not
change `AdaptiveLevel = 0|1|2|3|4`, the 0.125-m base quantum, level sizes,
Adaptive keys, canonical JSON/FNV-1a64 hashes, provenance, edit journals,
coverage proofs, Structural connectivity/mass/collision, persistence, or
gameplay truth. Graphics quality shall never affect those values.

### Scenario: Low and Ultra gameplay parity

Given identical Authority, Structural, and interaction inputs under Low and
Ultra, when selection runs, then render choices may differ but simulation
requirements, required Authority requests, source bindings, and structural
outcomes are identical.

## Requirement: Versioned count-driven descriptor

A strict versioned descriptor shall contain 1..32 product bands. Rank zero is
finest; ranks and IDs are unique, ranks are contiguous, and geometric error is
strictly increasing. Bands declare stable ID, product kind, algorithm/product
version, positive finite coverage bounds, required source binding kinds,
readiness requirements, bounded costs, allowed domains, and optional visual
Adaptive level. At least 12 bands shall be proven. `Culled` is a selection
decision and never an Authority product.

### Scenario: Pre-copy size rejection

Given more than 32 bands or any over-cap nested collection, when validation is
requested, then it rejects before copying, sorting, or hashing and publishes no
partial descriptor.

### Scenario: Strict immutable descriptor

Given duplicate IDs/ranks, gaps, non-monotone errors, unknown fields,
accessors, sparse arrays, NaN, Infinity, negative/unsafe values, or malformed
bindings, when validation runs, then it rejects without mutating input. Valid
output is a defensive recursively frozen copy.

## Requirement: Public Adaptive canonical foundation

Descriptor, identity, and decision hashes shall call the existing public
Adaptive canonical hash. The ladder shall not implement another JSON encoder,
hash algorithm, key, or authority serialization.

### Scenario: Transient selection metadata excluded

Given equal proxy product sources but different camera, distance, FOV,
viewport, quality, worker, cache, or queue metadata, then proxy content identity
is unchanged.

## Requirement: Revision-bound proxies

Damage-aware object proxies shall bind object ID/revision, Structural content
hash, damage digest, band, proxy algorithm version, and proxy content hash.
Surface region/tile proxies shall bind body/frame, region-or-tile, generator,
source/edit revisions, source content hash, band, algorithm version, and proxy
content hash. Current-source checks shall reject every stale or mismatched
binding.

### Scenario: Damaged object rejects intact proxy

Given a proxy for an older intact Structural revision and a current damaged
source, when readiness is checked, then the proxy is rejected and cannot become
selected or fallback-ready.

## Requirement: Validated screen-space error

Selection shall validate finite semantic camera, viewport, FOV, bounds, radius,
distance, and error values and calculate focal length, distance to bounds, and
projected error using the documented projection. Increasing distance shall not
select a finer product for otherwise equal inputs.

### Scenario: Projection sensitivity

Given equal bounds/error/distance, when viewport height increases or vertical
FOV narrows, then projected error increases according to the formula and the
choice remains equal or finer.

## Requirement: Stable selection and hysteresis

The selector shall choose the coarsest current ready product within the visual
policy using rank/ID tie-breaks independent of array order. Previous selection
is accepted only as explicit hysteresis input. Refinement, collapse, and culling
shall use separate thresholds and produce stable decision reasons/hash.

### Scenario: Boundary hold

Given repeated inputs inside the hysteresis gap and a current ready previous
band, when selection repeats, then it retains that band and returns the same
decision hash without flapping.

### Scenario: Deterministic culling

Given equal validated culling inputs, when selection repeats or candidate order
changes, then the Culled decision and hash are equal.

## Requirement: Render and simulation separation

An accepted outcome shall expose `renderSelection`, `simulationRequirements`,
`requiredAuthorityRequests`, `fallbackDecision`, `readiness`,
`evictionEligibility`, `decisionReasons`, and `decisionHash` separately. A
rejected outcome shall be typed and side-effect empty. Simulation shall never be
derived from render selection. Selection shall validate and preserve supported
soft Adaptive requests; hard interaction reasons shall still resolve to L4.

### Scenario: Coarse render with fine Authority

Given Low quality and an active hard pin, when selection runs, then the render
may be Adaptive L2 or a coarser proxy while the required Authority request is
L4 and pinned.

## Requirement: Hard interaction pins

`CollisionRequired`, `ToolInteraction`, `Explosion`, `ProjectileImpact`,
`MeteorImpact`, and `StructuralFracture` shall always request Adaptive L4.
Representation-only pin reasons shall be separate and shall not alter the
Adaptive reason union. Proxy hits require explicit Authority coordinates.
Missing L4 coverage or Authority budget shall return `NOT_READY`/`Blocked` and
shall never produce a coarse edit.

### Scenario: Quality-independent explosion

Given the same explosion in world metres under Low and Ultra, when requirements
are resolved, then both produce the same L4 key/coverage request and no render
voxel count affects the edit geometry.

## Requirement: Structural lifecycle retention

Dirty, solving, active-rigidbody, unsettled-fragment, or pending-handoff state
shall not be evictable. Sleeping alone shall not override pending handoff. Only
explicit Settled state with no blocking pin may release fine derived products.
Authority, journal, and Structural source bindings shall remain retained.

### Scenario: Settled release

Given an explicitly Settled object with no blocking pins, when eligibility is
derived, then derived products may be released while source bindings remain.

## Requirement: Atomic revision-equal fallback

A complete parent shall remain active for zero, partial, stale, invalid,
cancelled, incomplete, or mixed-revision children. Only all required current
same-revision children replace it atomically; mixed parent/fine settled coverage
shall never be published. Selection shall derive its fallback decision from the
raw bounded group through the atomic resolver rather than accept a caller-built
decision.

### Scenario: Sixty-three of sixty-four

Given a complete parent and 63 of 64 current fine children, when fallback is
resolved, then the parent remains the sole settled coverage. With all 64 current
children, the children replace it atomically.

## Requirement: Finite budgets and atomic admission

Named finite caps shall bound bands, candidates, pins, source bindings,
fallback groups/children, bytes, work, and upload units. Over-cap or
over-budget input shall return one full typed rejection with no partial accepted
selection, Authority edit, or settled coverage. Tests shall assert counters and
caps, not wall-clock durations.

### Scenario: Required budget exceeded

Given required interaction work exceeds the explicit Authority budget, when
resolution runs, then it is Blocked with no partial edit and unchanged input.

## Requirement: Graphics settings V2 migration

The latest exact-key settings schema shall add voxel detail
`Low|Medium|High|Ultra`, independent positive detail distance, and streaming
budget `Low|Medium|High|Ultra`. V1 shall migrate explicitly by preserving every
old field and adding deterministic defaults. Corrupt, invalid, or future data
shall fail closed and shall not be silently overwritten. Camera
`display.renderDistance` shall remain independent.

### Scenario: V1 preservation

Given a valid non-default V1 payload, when loaded by V2, then every prior value
is equal and only deterministic voxel defaults are added.

### Scenario: Future version

Given a future schema version, when storage is loaded, then it returns the
typed future-version failure/default view and does not write storage.

## Requirement: Immutable visual-only quality policy

Settings shall produce a recursively frozen policy. Low normally caps visual
Adaptive detail at L2; Medium and High at L3; Ultra at L4. High has greater
detail range/budget than Medium. Voxel detail distance affects render preference
only; render distance remains camera/culling input. No preset changes
Authority, edits, or Structural outcomes. Provisional distances are versioned
calibration values, not benchmark-certified product truth.

### Scenario: No false Applied claim

Given no production Representation runtime consumer, when UI/capability status
is shown, then voxel settings are hidden or Planned and never reported Applied
or SupportedLive merely because they persist or can form a pure policy.

## Requirement: Normal-route deterministic browser proof

The E2E shall load `/`, prove `window.TestBridge` absent both as own property and
through `in`, import the public module through Vite, exercise 12+ bands,
Low/Ultra parity, proxy-hit L4 requirements, hysteresis, stale rejection, and
the complete fallback transition. Console errors, page errors, request failures,
and HTTP >=400 lists shall be empty. It shall be listed exactly once in
`test:e2e:core`, run twice with one worker/retries zero, and write byte-identical
timestamp-free JSON/Markdown evidence.

### Scenario: Repeatable evidence

Given equal repository inputs on two focused runs, when evidence is regenerated,
then both files and every recorded deterministic hash are byte-identical.

## Requirement: Honest integration status and governance

Documentation shall distinguish the implemented pure foundation/ports from
absent planet streaming, terrain LOD runtime, proxy mesh generation, physics
handoff, building collapse, and live player-settings application. Completion
requires fresh Node-22 verification, technical review, DevToolbox preflights,
final Plannotator review, current-main integration if needed, exact-head CI and
Codex review, an open PR, and no merge.

### Scenario: Scope audit

Given the final diff, when scope is audited, then no Unity, dependency,
lockfile, Adaptive/Structural semantic, renderer-authority, TestBridge, workflow,
or unrelated worktree/branch change exists.
