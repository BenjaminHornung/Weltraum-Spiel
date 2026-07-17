# Proposal: Hestia Asset Authoring Contract V1 Hardening

## Change
`tools-hestia-authoring-contract-hardening-v1`

## Problem

The existing Hestia v1 material describes the intended GLB `extras` convention and
canonical root, but it does not yet provide a decision-complete boundary between
transport metadata, canonical authoring data, semantic validation, and compiled
registry-bound output. In particular, `kind`, decorative collision rules, material
namespace ownership, read-only authoring behavior, unknown-field handling, and the
two hash domains are not sufficiently executable or reproducibly tested.

Without one fail-closed contract, an exporter can emit data that a compiler accepts
differently, a compiler can accidentally alter source authoring state, and a
registry change can be confused with an authoring change.

## Goal

Harden Hestia Asset Authoring Contract V1 so Agent F's exporter and Agent G's
compiler share one normative GLB transport, canonicalization, read-only, material
registry binding, hashing, and validation contract. Prove the Draft 2020-12
authoring schema with the existing Node 22/Vitest lane and exactly locked Ajv,
without implementing the exporter or compiler.

## Outcome

The completed change will provide:

- an explicit bounds-safe GLB inventory and canonicalization pipeline;
- a closed canonical root `{schema,asset,parts,joints,markers,materials}` in which
  the transport `kind` member is never serialized into a canonical record or
  directly hashed as a field, but is consumed during inventory/classification;
  changing it requires full reclassification and validation and may change the
  canonical document/hash or yield no valid document/hash; equal hashes require
  the transport encodings to classify to the same valid canonical document;
- fail-closed schema and semantic rules for IDs, references, cycles, decorative
  parts, tags, and material namespaces;
- a source read-only invariant covering success, error, and abort paths;
- registry-independent authoring hashes and registry-bound compilation/manifest
  hashes with deterministic normalization;
- one complete schema-valid golden fixture, plus reproducible positive and
  negative Ajv/Vitest coverage.

## Scope

In scope for the eventual implementation change:

- the existing Hestia v1 contract document and its non-breaking
  `schemas/hestia-asset-authoring-v1.schema.json` clarifications;
- one exact Ajv devDependency and matching `apps/weltraum-browser/package-lock.json`;
- focused Vitest tests and fixtures in `apps/weltraum-browser` for the canonical
  contract and hash/namespace invariants;
- exporter compatibility tests that verify the v1 transport remains consumable;
- evidence, review, verification, and handoff gates described in `tasks.md`.

The current task populates only this change's four generated Markdown artifacts.

## Non-goals

- No compiler implementation or compiled-manifest implementation.
- No exporter feature implementation; exporter/compiler branches are compatibility
  context only and remain read-only.
- No runtime, UI, E2E, Unity, scene, asset, source-asset migration, or test-data
  change outside the later explicitly scoped contract tests and fixtures.
- No schema v2, new required authoring properties, registry fields in the
  authoring root, reserved tag prefixes, tag cardinality vocabulary, or registry
  coupling in authoring data.
- No source Blender or source GLB overwrite/save side effect.

## Acceptance gates

The change is handoff-ready only when the contract, schema, fixtures, tests, and
evidence satisfy every unchecked task in `tasks.md`; focused and full allowed
verification is fresh; one technical review is clean or its findings are fixed;
the DevToolbox verification and completion preflight pass; and the single final
human review for this worktree has approved the exact diff. Any changed path
outside the authorized implementation scope, contradictory current-main
evidence, missing registry/version information, or non-green required check is a
stop condition.
