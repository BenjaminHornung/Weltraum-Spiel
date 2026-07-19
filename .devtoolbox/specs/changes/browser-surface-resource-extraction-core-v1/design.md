# Design

## Authority boundaries

The extraction module owns resource-node definitions/state, scans, extraction sessions, pulse orchestration, deterministic yield, and mission/event intents. It does not own resource/container transfer semantics, equipment construction, interaction truth, suit truth, local-frame math, or planetary-environment truth.

All cross-domain imports must come from the public `index.ts` barrels named in the approved task. Existing Resource Core reservoir, container, and transfer snapshots remain the sole cargo authority.

## Determinism and immutability

All operations are pure functions over explicit immutable snapshots. Canonical signatures are derived from versioned canonical data. Yield uses definition inputs, node grade, equipment stats, pulse index, explicit deterministic seed/sequence, and environment modifiers; it never reads global randomness, time, DOM state, or renderer state.

Revision checks use compare-and-swap semantics. A pulse consumes the expected session/node revisions and a strictly ordered pulse index, and returns new frozen node/session/container snapshots plus the transfer result and emitted intents. Repeating an already-applied pulse with the same idempotency identity returns the same result without double transfer.

## Workflow

1. Scan exposes only permitted pre-scan facts and returns confidence, estimates, hazards, legal/ownership facts, required capability, and deterministic signatures.
2. Prepare evaluates tool/capability/equipment, suit, environment, legal/ownership, depletion, active-session, target-container, and hazard-container readiness.
3. Begin claims the node with a stable active session.
4. Pulse validates revisions/order, computes deterministic yield, delegates the deposit to Resource Core transfer authority, and updates depletion/session state.
5. Pause/resume/cancel are explicit revisioned transitions; no silent replan or implicit retry occurs.
6. Mission/event intents describe domain outcomes without dispatching runtime side effects.

## Verification

Focused unit coverage exercises every required block reason and lifecycle property. The browser proof dynamically imports only `/src/surface-extraction/index.ts` on normal `/`, asserts `window.TestBridge` is absent, runs scan through three pulses and depletion update twice, compares byte-identical output, and records browser health 0/0/0/0.
