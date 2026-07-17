# Proposal: Structural Microvoxel Destruction Core V1

## Change

`browser-structural-microvoxel-destruction-core-v1`

## Problem

The published Adaptive Authority supplies deterministic, immutable Level-4
microvoxel data and provenance, but it does not define the separate authority
needed to destructively edit a structural object. Without that contract,
occupancy, commands, connectivity, mass properties, mesh derivation,
revision identity, and persistence could drift into renderer, physics, or
duplicate-journal implementations.

This change defines one pure, renderer- and physics-independent Structural core
bound directly to the Adaptive Authority at dependency SHA
`5fb372bdba677e43e71566121c53efb5e244b93a` on
`feature/browser-adaptive-microvoxel-authority-v1`. The inherited Adaptive
default-parallel full-suite timeout/contended execution risk remains a known
risk; this change does not repair, hide, or weaken it.

## Goal

Specify and later implement a versioned Structural V1 authority with:

- binary occupancy where material `0` is Air and `1..65535` is fully occupied;
- direct public reuse of Adaptive keys, Level-4 coordinates, quantum,
  canonical JSON/hashes, validation, freeze, provenance, and resident proofs;
- immutable Structural objects and integer-translation frame binding;
- exactly four deterministic command kinds, exact CAS, duplicate rejection,
  atomic fail-closed transactions, and the explicit `NoChange` revision rule;
- deterministic 6-neighbor Components, persistent but non-connective
  Anchor/Joint metadata, revision-bound IDs, mass/COM/full inertia, and a
  fail-closed greedy mesher;
- persistence and evidence that never become a second Adaptive edit journal;
- explicit budgets, hashes, algorithm/schema versions, and recursive freeze;
- a pure-core browser proof on the normal `/` route, without TestBridge
  authority or claims of renderer/runtime/physics integration.

## Approved boundary

The exclusive write allowlist is:

```text
.devtoolbox/specs/changes/browser-structural-microvoxel-destruction-core-v1/**
apps/weltraum-browser/src/voxel/structural/**
apps/weltraum-browser/tests/unit/structuralMicrovoxel*.test.ts
apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts
apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1*
docs/browser-mainline/structural-microvoxel-destruction-core-v1.md
```

Everything else is forbidden, especially
`apps/weltraum-browser/src/voxel/adaptive/**` (no changes under
`adaptive/**`), `src/voxel/index.ts`, `main.ts`, styles, workers, streaming,
Surface Lab, World Generation, package/lock/Vite/Playwright files,
`.github/**`, `infra/**`, and other agents' changes. The new E2E spec is not
assigned to a package script or test group.

## Non-goals and gates

There is no Three.js, renderer, physics engine, Rigidbody, collider, particle,
runtime wiring, gameplay, UI, worker, streaming, surface, economy,
database/savegame migration, package integration, or global dense-world work.
There is no fractional occupancy, cut-cell, rotation, scale, or Joint-based
connectivity. No Adaptive source or public contract is changed. The approved
plan remains authoritative; any required public-contract deviation sets
`replan_required=true` and stops for a new decision.

This handoff writes only the five approved spec artifacts. It does not install
dependencies, run builds/tests, create or mutate a DevToolbox execution,
toggle tasks, start services, commit, push, or archive the change.
