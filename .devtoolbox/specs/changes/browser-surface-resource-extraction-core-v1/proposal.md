# Surface Resource Extraction Core V1

## Motivation

The browser prototype needs a first deterministic, renderer-independent domain core for scanning surface resource nodes, evaluating actor readiness, extracting material through explicit pulses, transferring it through the existing Resource Core, and emitting mission/event intents.

## Outcome

Callers can run the complete surface loop from immutable snapshots and explicit inputs: scan, prepare, begin, pulse, transfer, pause/resume/cancel, and depletion handling. Identical inputs produce byte-identical results.

## Scope

- Pure TypeScript domain code under `src/surface-extraction/**`.
- Public integration only through the existing resource, surface-equipment, interaction, suit, surface-frame, and planetary-environment barrels.
- Fixtures, focused unit tests, one normal-route Playwright proof on port 5237, deterministic JSON/Markdown evidence, and browser-mainline documentation.
- Typed blocking results for readiness, legality, ownership, revisions, active sessions, capacity, hazards, depletion, and invalid pulses.

## Non-goals

No UI, renderer objects, Three.js, DOM ownership, physics simulation, First-Person UI, Hestia implementation changes, Unity changes, package/config/CI changes, or duplicate resource container/transfer engines.
