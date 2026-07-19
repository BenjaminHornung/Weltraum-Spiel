# Surface Resource Extraction Core V1

## Purpose

`apps/weltraum-browser/src/surface-extraction/index.ts` is the public entry point for the renderer-independent surface extraction loop:

`scan -> prepare -> begin -> deterministic pulse -> Resource Core transfer -> depletion and intents`

The module owns node definitions and state, scan projections, extraction sessions, deterministic pulse orchestration, and mission/event intents. It does not own UI, rendering, physics, equipment construction, suit simulation, environment simulation, or cargo transfer rules.

## Authority boundaries

The implementation depends only on the public barrels for:

- `resources`: catalog, mining reservoir snapshots, container eligibility, and atomic transfer authority;
- `surface-equipment`: derived equipment stats, suit readiness, and interaction capability projection;
- `interaction`: actor, capability, and tool truth;
- `suit`: immutable suit state and equipment interface snapshots;
- `surface-frame`: the node's immutable local position type;
- `planetary-environment`: immutable sampled environment truth and canonical functions.

No second container or transfer engine exists in this module. Every accepted extraction pulse delegates the material movement to `extractFromMiningReservoir` and returns its immutable transfer result.

## Domain contracts

`SurfaceResourceNodeDefinition` captures stable identity, resource and extraction method, required capability, hardness, grade, pulse range, contamination/dust factors, legal and ownership policy, environment restrictions, schema version, and canonical signature.

`SurfaceResourceNodeState` captures stable node and Surface Frame identity, immutable local position, revision, Resource Core mining-reservoir snapshot, exposure/depletion/claim state, active session identity, and canonical signature. `createUnscannedSurfaceResourceNodeView` deliberately omits composition, grade, quantity, hazards, and protected legal facts.

`ExtractionSession` snapshots equipment, suit, environment, target container, start tick, revision, pulse sequence, receipts, and state. Lifecycle changes are explicit and revision checked: `Prepared`, `Active`, `Paused`, `Completed`, `Blocked`, or `Cancelled`.

`executeExtractionPulse` requires expected node/session/target revisions, explicit tick delta, next pulse index, deterministic seed, and universe tick. It returns energy/heat/tool-use demand intent, extracted quantity, Resource Core transfer result, updated frozen snapshots, and event/mission intents.

## Determinism and concurrency

Yield depends only on the definition, grade, equipment snapshot, pulse index, explicit seed, environment modifiers, remaining reservoir quantity, and catalog rules. It never reads `Date`, global randomness, DOM state, Three.js, or mutable runtime authority.

Node, session, and target revisions form a compare-and-swap boundary. Pulse indexes must be strictly ordered. A successfully recorded idempotency key can be replayed against its exact resulting snapshots without another transfer; reuse with different command content is blocked.

## Blocking vocabulary

V1 exposes the closed reasons `ToolMissing`, `CapabilityMissing`, `EquipmentNotReady`, `SuitNotReady`, `EnvironmentUnsafe`, `NodeDepleted`, `NodeRevisionConflict`, `SessionRevisionConflict`, `IllegalExtraction`, `OwnershipDenied`, `TargetCapacityExceeded`, `HazardContainerRequired`, `ActiveSessionConflict`, and `InvalidPulse`.

Capacity and hazardous-container failures are detected before session activation where possible. Transfer-time rejection remains atomic because the Resource Core returns the unchanged source and target snapshots.

## Fixtures and evidence

The public fixture set includes an iron-silicate vein, water-ice deposit, geological sample core, Hestia contaminated biological sample, claimed illegal node, depleted node, insufficient suit-container target, and mining-drone target.

Focused unit tests cover scan disclosure/confidence, equipment/suit/environment readiness, legality/ownership, deterministic yield, ordering and CAS, transfer and rejection, depletion, active-session conflict, lifecycle transitions, idempotency, deep freezing, and forbidden global/runtime dependencies.

The browser proof uses normal `/` on port 5237, keeps `window.TestBridge` absent, imports only `/src/surface-extraction/index.ts`, and executes the complete three-pulse flow twice. The committed JSON and Markdown evidence records byte-identical output and browser health `0/0/0/0` without screenshots.
