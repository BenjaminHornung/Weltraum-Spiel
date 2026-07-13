# Capability: Deterministic Browser World Chunk Registry and Streaming

## Requirements

### Canonical chunk identity and registry
- Chunk coordinates SHALL contain safe integer x/y/z values and normalize negative zero.
- Chunk IDs SHALL be the canonical deterministic string `chunk:x:y:z` derived only from coordinates.
- Bounds SHALL be finite absolute-world AABBs derived from the configured cubic chunk size.
- Registration SHALL reject duplicate IDs, occupied coordinates, non-canonical IDs, invalid coordinates/bounds, and invalid metadata with stable typed error codes.
- Registry reads SHALL return readonly immutable data and stable coordinate/ID ordering independent of registration order.
- Radius and bounds queries SHALL use inclusive deterministic intersection rules.

### Separate residency and render LOD
- Streaming SHALL reuse the existing Full/Snapshot/Dormant simulation contract.
- Render LOD SHALL be an independent Near/Medium/Far/Culled contract.
- Culling SHALL never delete registry/world truth, and simulation mode SHALL not imply render LOD.

### Deterministic planning and budgets
- Plans SHALL depend only on an immutable registry snapshot, absolute observer position, explicit policy, and an optional compatible previous snapshot.
- Candidate priority SHALL be minimum observer-to-chunk-AABB distance, then code-unit chunk ID.
- Full, Snapshot, visible, and optional estimated-entity budgets SHALL be explicit non-negative integer limits.
- Full overflow MAY fall back to Snapshot; Snapshot overflow SHALL become Dormant; visible overflow SHALL become Culled.
- Every budget downgrade or rejection SHALL be recorded with chunk, requested state, final state, and reason.
- Simulation and render budgets SHALL be applied independently.

### Hysteresis and transitions
- Hysteresis values SHALL be explicit, finite, non-negative, and validated so adjacent deadbands do not overlap.
- Previous requested bands, not budget-constrained final bands, SHALL govern hysteresis.
- Inner bands SHALL exit above radius plus hysteresis and be entered below radius minus hysteresis.
- Identical consecutive inputs SHALL emit no transitions; a clear crossing SHALL emit one final transition per affected domain even after a multi-band teleport.
- Events SHALL use the required activation/promotion/demotion/dormancy/render-entry/LOD-change/render-exit vocabulary and stable chunk-ID/type ordering.
- A first snapshot SHALL establish a baseline with no transition events.
- A previous snapshot with a different registry or policy signature SHALL be rejected rather than silently reused.

### Canonical snapshot and floating-origin invariance
- The snapshot SHALL include absolute observer position, simulation bubble, registered count, Full/Snapshot IDs, Dormant count, visible LODs, assignments, budget summary, ordered transitions, and deterministic signatures.
- Registry and streaming signatures SHALL use existing canonical stringify/hash utilities and exclude local frames, renderer objects, timestamps, registration order, and transition history.
- Canonical serialization SHALL be byte-equivalent for identical input.
- Changing only the floating-origin projection SHALL not change IDs, registry contents, residency, LOD, budgets, absolute position/velocity, or streaming signature.

### Browser evidence
- A deterministic parameterless TestBridge scenario SHALL exercise initial, boundary-transition, and farther observer positions, budgets, ordered transitions, and floating-origin invariance.
- The bridge SHALL be available only with `?testBridge=1`; normal `/` SHALL not expose an own `TestBridge` property.
- Playwright SHALL write the required Markdown and JSON evidence without requiring HUD, render, or live-runtime truth.

## Scenarios
1. Canonical IDs cover positive, negative, and negative-zero coordinates.
2. Duplicate IDs, coordinate conflicts, invalid/non-finite bounds, and non-canonical metadata are rejected.
3. Stable listing and radius/bounds queries are independent of registration order.
4. Full/Snapshot/Dormant and Near/Medium/Far/Culled remain separate and deterministic.
5. Count/entity/visible overflows use distance then ID and report all rejections.
6. Stationary and jittering observers do not churn; clear crossings and teleports emit ordered final transitions.
7. Floating-origin frame changes alter only projected local positions.
8. Repeated unit and browser scenarios produce byte-equivalent canonical JSON.
9. Normal Browser startup remains TestBridge-free and existing flight/autopilot regressions remain green.