# Browser First-Person Surface Expedition UI Prototype v1

## Motivation and outcome

Create an implementation-ready browser prototype for a first-person Hestia surface-expedition HUD so stakeholders can evaluate hierarchy, interactions, accessibility, and visual direction without implying gameplay, world, inventory, hazard, ownership, or progression authority.

DevToolbox MCP/CLI is unavailable in this worktree. Direct-file fallback tracking therefore applies, and every task checkbox remains open until the orchestrator has fresh evidence and completion preflight.

## Scope

- Add an isolated prototype under `apps/weltraum-browser/prototypes/first-person-surface-expedition-v1/**`, served at `/prototypes/first-person-surface-expedition-v1/` by the existing setup.
- Present exactly six deterministic local primary states: `Exploration`, `Scanner`, `InteractionHold`, `HazardWarning`, `InventoryDetail`, and `MinimalHud`.
- Provide exact keyboard behavior and visible-button parity for Q Scanner, E Interaction/Hold, I Inventory Detail, Tab Detail Panels, 1–5 Toolbelt, H Minimal HUD, R deterministic Hazard Scenario activation/reset, and Escape overlay dismissal.
- Present the specified top-left, top-center, right, bottom-left, bottom-center, bottom-right, and center HUD fields while preserving a structurally center-clear safe zone.
- Use readable dark translucent hard-sci-fi rails with restrained styling, visible focus, non-color redundancy, deterministic decorative CSS/canvas world rendering, reduced-motion behavior, 200% zoom reflow, and a persistent visible `Prototype Fixture` honesty notice.
- Add one focused E2E file at `apps/weltraum-browser/tests/e2e/first-person-surface-expedition-ui-prototype.spec.ts`, using existing port 5202 configuration, and exactly six required PNGs under `apps/weltraum-browser/evidence/`.
- Permit final changes only in this change folder, the prototype folder, the focused E2E file, evidence files with the approved prefix, and `docs/design-audits/first-person-surface-expedition-ui-prototype-v1.md`.

## Non-goals and forbidden scope

- No gameplay authority, persistence, backend, simulation, progression, inventory mutation, hazard calculation, world truth, or product runtime integration.
- Do not place the prototype in Vite's public static directory, and do not edit `src/**`, package/lock files, Vite or Playwright configuration, routes, Hestia/Voxel/Worker code, existing UI/concepts, or Unity files.
- No dashboard, glass-card, or MMO clutter; no external assets or network-loaded media.
- No PR, merge, archive, force-push, or task closure. Commit and normal push occur only in the separately authorized final task.

## Success criteria

- The isolated route loads and persistently displays `Prototype Fixture`.
- All six primary states, the separate Tab detail toggle, exact HUD fields, exact keys, and equivalent visible buttons are deterministic and testable.
- Focused E2E verifies route isolation, state/input coverage, ARIA and focus order, 1280×720 overflow, exact screenshot dimensions, no `window.TestBridge`, and zero console/page/request/HTTP errors.
- Exactly six approved screenshots exist under `apps/weltraum-browser/evidence/`; InventoryDetail, MinimalHud, reduced-motion, and 200% zoom remain behavior tests without additional required PNGs.
- Focused E2E, `git diff --check`, focused UI review, independent reviewer review, and human visual review have no blocking finding.
