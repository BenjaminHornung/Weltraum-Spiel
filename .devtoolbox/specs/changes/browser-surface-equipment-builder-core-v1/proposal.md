# Proposal: Surface Equipment Builder Core V1

## Motivation

Surface tools and on-foot weapons need one deterministic, save-safe builder and validation authority before runtime adapters can expose them to interaction, suit, combat, or resource systems. Current subsystem contracts exist, but no equipment assembly core composes modules, validates compatibility, derives stats, or reports readiness without side effects.

## Outcome

Add a pure TypeScript core under `src/surface-equipment/` that builds immutable equipment blueprints from explicit catalog modules and slots; applies atomic revisioned commands; derives canonical stats, diagnostics, suit readiness, and immutable Interaction/Combat capability projections; and ships six provisional deterministic fixtures with unit and browser proof.

## Scope

- Stable equipment/catalog/module/blueprint/slot/command/tag/legal identities and deterministic canonical signatures.
- Closed V1 equipment categories, module roles, legal classes, delivery classes, readiness states, and diagnostic codes.
- Data-driven slot/module compatibility, discrete calibration, CAS commands, duplicate-command rejection, and atomic rejection.
- Derived stats, validation diagnostics, suit readiness, Interaction projection, Combat projection, and ResourceRequirement projection.
- Six explicitly `provisional-v0` built-ins: Survey Scanner, Mining Cutter, Repair Tool, EMP Breacher, Ballistic Sidearm, Laser Cutter.
- Unit tests, isolated browser E2E via dynamic import, timestamp-free byte-stable evidence, implementation documentation, scans, review, and verification.

## Required authority reuse

Import public contracts through subsystem barrels: `InteractionCapabilityId` and Interaction helpers from `src/interaction`; `SuitInterfaceId` and `SuitEquipmentInterfaceSnapshot` from `src/suit`; `DamageType` from `src/combat`; `ResourceRequirement` from `src/resources`. No duplicate capability, suit-energy/equipment-bus, damage, or resource authority may be introduced.

## Non-goals

V1 does not fire weapons, create runtime weapon state, simulate projectiles/hits/damage, complete interactions, mutate suit energy, reserve/consume inventory, transfer resources, add UI, integrate `main.ts`, spawn/render 3D models, add dependencies, or alter dependency cores. Legal metadata does not enforce faction/security consequences.

## Success

Identical valid inputs produce deeply frozen, canonical byte-identical outputs and signatures; invalid operations are deterministic and non-mutating; all six fixtures validate; required dependency contracts are imported rather than duplicated; targeted/full tests, build, isolated E2E, scans, dual review, completion preflight, and human review provide evidence.