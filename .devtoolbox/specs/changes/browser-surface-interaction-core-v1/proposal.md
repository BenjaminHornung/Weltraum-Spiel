# Browser Surface Interaction Core v1

## Motivation
The Browser mainline has no shared authority for deciding and progressing surface or interior interactions. Implementing these rules in UI, renderer, or world adapters would make results dependent on presentation state and fragment behavior across doors, resource nodes, terminals, and later interactable targets.

## Outcome
Provide a deterministic, renderer-independent and UI-independent Surface/Interior Interaction Core that evaluates candidates, exposes stable decisions and block reasons, progresses held interactions by integer ticks, fails closed on stale authority, and returns atomic mutation intents/results for external owners to apply.

## Scope
- Stable actor, target, revision, capability, tool, verb, candidate, decision, session, progress, completion, result, and event contracts.
- Verbs exactly `Inspect`, `Scan`, `Extract`, `Repair`, `Open`, `Close`, `Activate`, `Deactivate`, `Pickup`, `Place`, and `Transfer`.
- Deterministic `Allowed`, `Blocked`, and `Unavailable` evaluation with closed block reasons and fixed precedence.
- Pure integer-tick start, advance, cancel, and complete behavior with explicit interruption policy and exact revision checks.
- Deterministic canonical serialization/hashing, exhaustive unit coverage, and a normal-browser dynamic-import proof with timestamp-free JSON/Markdown evidence.

## Non-goals
- No raycasts, animation, inventory transfer implementation, scene/render positions, world mutation, UI, renderer, Three.js, DOM, or runtime integration.
- No ownership of distance, line of sight, reachability, focus ranking, energy/resource stores, target state, actor state, or mutation application.
- No Surface Lab, voxel, worker, Ship Builder, Combat, Cargo, Persistence, Unity, CI-group, package, configuration, main entry, or style changes.

## Success
Equivalent inputs produce byte-stable decisions, outputs, and hashes; all failures use the closed vocabulary and precedence; sessions advance only through explicit integer ticks; stale completion fails closed; no-op outcomes contain no mutation; all 18 required behavioral cases pass; the normal browser route can dynamically import and exercise the module without TestBridge authority; and only the approved paths change.
