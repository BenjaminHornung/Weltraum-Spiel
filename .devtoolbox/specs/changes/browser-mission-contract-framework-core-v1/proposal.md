# Mission Contract Framework Core V1

## Motivation

The browser runtime needs a deterministic, persistence-compatible mission contract authority without coupling mission rules to UI, economy, cargo, factions, world objects, or runtime interaction systems.

## Outcome

Provide a pure TypeScript mission domain core that validates mission definitions, creates and evolves immutable mission instances through explicit CAS commands, exposes reward and penalty descriptors as intents only, and returns persistable mission event intents.

## Scope

- Mission definitions, instances, objective graphs, state transitions, progress, failure, abandonment, expiry, completion, and reward claims.
- Six complete fixtures plus graph/optional/expiry/cycle coverage.
- Focused unit and normal-route browser verification with deterministic JSON and Markdown evidence.
- Reuse public persistence identifiers, time contracts, event contracts, and canonical serialization where suitable.

## Non-goals

- No UI, prototype, Unity, economy, cargo, faction, world-object, navigation, interaction, resource, suit, persistence implementation, package, lockfile, CI, or global configuration changes.
- No global event queue writes and no authority over external mutations.
