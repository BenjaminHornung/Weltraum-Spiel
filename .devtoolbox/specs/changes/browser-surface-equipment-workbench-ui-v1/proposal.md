# Surface Equipment Workbench UI Prototype V1

## Motivation

The browser surface-equipment experience needs a visible and interactive weapon/tool builder before the unpublished Equipment Core is available. A standalone prototype lets UX, interaction, diagnostics, accessibility, and visual direction be evaluated without creating or implying gameplay/domain authority.

## Outcome

Provide a standalone browser route at `/prototypes/surface-equipment-workbench-v1/` with six mock starting devices, module assembly interactions, readiness diagnostics, local undo/redo, build comparison, responsive behavior, keyboard/focus support, automated E2E coverage, browser-health evidence, and a design audit.

The UI must continuously identify itself as prototype-only with:

`UI PROTOTYPE · MOCK BUILDER DATA · NO GAMEPLAY AUTHORITY`

## Scope

- Add only the standalone prototype files under `apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/**`.
- Add the targeted Playwright E2E spec `apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts`.
- Add evidence named `apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-*`.
- Add `docs/design-audits/surface-equipment-workbench-ui-v1.md`.
- Track the change only under `.devtoolbox/specs/changes/browser-surface-equipment-workbench-ui-v1/**`.
- Exercise the prototype on port 5224.

## Non-goals

- No Equipment Core or domain contracts.
- No changes to `src/**`, package manifests, lockfiles, build configuration, Playwright configuration, CI, Unity scenes/assets, or gameplay code.
- No economy, unlock, rarity, crafting, persistence, networking, authoritative legality, or authoritative compatibility rules.
- No PR or merge. Commit and non-force push require final explicit user confirmation.

## Success criteria

- Exactly six visible fixtures: Survey Scanner, Mining Cutter, Repair Tool, EMP Breacher, Ballistic Sidearm, and Laser Cutter.
- All requested module roles, stats, diagnostics, and required scenarios are visible and reproducible.
- Install/remove/replace/move, local undo/redo, and compare work by pointer and keyboard-accessible controls.
- Desktop and responsive layouts remain usable and preserve the three logical work areas.
- Targeted E2E passes against port 5224, browser health is 0/0/0/0, and the five required screenshot states exist.
- The audit documents a future adapter seam based on snapshots/view-models and commands without inventing the unpublished Equipment Core API.