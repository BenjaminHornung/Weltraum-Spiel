# Design

## Authority boundary

`src/missions` owns deterministic mission rules only. It imports public contracts from `src/persistence/index.ts`; it does not import persistence internals or any forbidden runtime subsystem. Commands return a new frozen mission instance and persistent event intents. External consumers decide whether and where to persist or execute reward/penalty intents.

## Data model

Definitions are versioned, content-key based, and use stable IDs. Objective nodes carry explicit prerequisites and a typed descriptor. Mission instances contain revisioned state, objective state/progress, immutable facts, expiry, reward claim state, reasons, and a canonical signature.

## Graph semantics

Validation first orders objectives deterministically by stable objective ID, validates references, performs a deterministic topological sort, and fails closed on cycles. Sequential groups unlock one required objective at a time; ParallelAll requires all required children; ParallelAny completes when any required child completes and skips remaining eligible siblings; Optional nodes may be skipped explicitly and never block mission completion. Hidden nodes remain Locked until prerequisites are satisfied.

## Commands and replay

Every mutating command supplies `expectedRevision` plus a stable `commandId`. A command accepted at the current revision returns revision + 1. Repeating the identical command against the prior revision returns the byte-equivalent prior result. Reusing the same command identity with different payload is a typed conflicting-replay rejection. Other stale revisions are CAS rejections.

## Progress and completion

Progress payloads are discriminated unions. Descriptor/progress compatibility and resource/target/item identities are checked before accumulation. Numeric progress clamps at required values, never producing negative remaining quantities. Terminal mission/objective states reject progress.

When expiry and a time-based failure condition become due on the same tick, expiry has deterministic precedence: `expireMission` is the legal explicit terminal transition, while other commands remain fail-closed.

## Determinism and immutability

Canonical public persistence serialization/signature helpers are reused when compatible. No Date, Random, DOM, Three.js, ambient clock, or hidden global authority is used. Inputs are not mutated; accepted results and nested data are deeply frozen.

## Evidence

A dedicated Playwright config uses port 5233 and the normal route. The page must expose no `TestBridge`; the test dynamically imports only `/src/missions/index.ts`, executes the required scenarios twice, and writes byte-identical JSON and Markdown artifacts without screenshots.
