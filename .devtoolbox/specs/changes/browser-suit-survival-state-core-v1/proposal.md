# Browser Suit Survival State Core V1

## Motivation and outcome

Browser surface play needs one deterministic, renderer/UI-independent TypeScript authority for suit and life-support truth. This change specifies—but does not implement—a pure domain core whose state, events, alerts, and equipment-facing snapshot are reproducible across Node and a normal browser page.

Success means later implementation can model health, oxygen stock/supply, suit energy, seal integrity, internal temperature, cumulative radiation, contamination, life-support mode, workload, subsystems, alerts, critical state, incapacitation, and canonical semantic events without borrowing authority from UI, rendering, world, combat, or resources.

## Scope

The core accepts only evaluated `SuitEnvironmentExposure`, actor workload, activated subsystem state, explicit external damage/repair/resupply commands, and simulation ticks. Its public contract includes deterministic validated identities, immutable definitions/snapshots, commands and CAS transitions, fixed-step advancement, power starvation, damaged-suit oxygen leakage, health consequences, alerts/events, signatures, errors, and a read-only equipment interface snapshot for Agent O.

World/combat/resource/UI owners remain separate. Exposure is already evaluated input and never atmosphere, fluid, body, collision, raycast, or hit simulation.

## Non-goals

No UI, renderer, Three.js, audio, input, persistence, FPS controller, world/atmosphere/fluid/body physics, collision, raycast, inventory transfer, combat-hit resolution, animation, or randomness. No integration into existing owners and no `window.TestBridge`.

## Eventual implementation allowlist

Only this change directory and the following paths may change:

- `apps/weltraum-browser/src/suit/**`
- `apps/weltraum-browser/tests/unit/suit*.test.ts`
- `apps/weltraum-browser/tests/e2e/suit-survival-state-core.spec.ts`
- `apps/weltraum-browser/evidence/browser-suit-survival-state-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-suit-survival-state-core-v1.md`
- `docs/browser-mainline/suit-survival-state-core-v1.md`

Forbidden: `main.ts`, `style.css`, combat, resources, ship-builder, interaction, surface-lab, voxel, workers, package/lock files, Vite/Playwright configuration, `.github`, infrastructure, and every Unity path. The E2E spec is intentionally not assigned to a package test group.

## Acceptance summary

- Fixed 10 Hz safe-integer simulation is aggregation-equivalent and byte-reproducible: scheduled commands execute exactly once immediately before their designated in-window tick, out-of-window commands reject deterministically, and duplicate IDs anywhere in the schedule pre-reject before mutation.
- Inputs, channels, identities, revisions, commands, alerts, events, errors, and immutable publication obey the normative spec.
- Public direct accepted commands publish canonical alert raise/clear deltas, while aggregate execution suppresses direct duplicates and publishes consolidated phase-11 transitions. Derived alert IDs and remainder keys remain regex-valid and at most 128 characters for full-length public IDs.
- Unit and browser proof cover the numbered protocol, including two identical full scenario runs and timestamp-free evidence regenerated twice byte-identically.
- Node 22 verification, scans, reviewers, completion preflight, and one final human review pass; no PR, merge, archive, or CI grouping.
