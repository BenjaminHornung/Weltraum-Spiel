# PLANS.md - ExecPlans for Weltraum-Spiel

An ExecPlan is a living implementation document for a large refactor,
multi-step feature or risky repository operation. It must be self-contained so
another agent can execute it without prior conversation memory.

## When to use one

```text
- Browser architecture or public data-contract changes
- Repository cleanup or large evidence/spec reconciliation
- World/chunk streaming and large-coordinate runtime work
- Ship Builder domain, compatibility, persistence or UI slices
- Planet runtime, surface handoff or celestial/gravity integration
- Cross-cutting autopilot/flight/controller changes
- Historical Unity extraction or archive work (legacy-only example)
```

Unity is not a default implementation target. A Unity-related ExecPlan may only
extract, validate or archive historical intent/assets unless a task explicitly
targets the preserved legacy branch.

## Required structure

```markdown
# ExecPlan: <name>

## Goal
What must be true at the end?

## Context
Which files, docs, specs, tests, evidence and integration points matter?

## Non-goals
What must not change opportunistically?

## Architecture decision
Which boundaries, modules, owner snapshots and data contracts apply?

## Implementation phases
Small ordered steps with a verifiable result after each phase.

## Tests and evidence
Which unit, build, Playwright, signature, screenshot, JSON or performance gates
prove the result?

## Risks
What can break, be lost or silently drift?

## Rollback / safe stop
Which condition stops mutation, and how can completed work be reversed?

## Progress log
- [ ] Phase 1 ...
- [ ] Phase 2 ...

## Definition of Done
Concrete behavior, verification and documentation gates.
```

## Plan rules

- Keep product truth in browser core/simulation contracts; do not treat render
  objects or screenshots as gameplay proof.
- Name exact files, commands and evidence outputs.
- Separate discovery, mutation and independent verification.
- Record newly discovered facts and explain plan changes in the progress log.
- Do not mark phases complete without fresh evidence.
- Preserve stable `planHash`, locked-plan execution, explicit replan-required
  state and the no-snap/no-velocity-zero invariants in autopilot work.
