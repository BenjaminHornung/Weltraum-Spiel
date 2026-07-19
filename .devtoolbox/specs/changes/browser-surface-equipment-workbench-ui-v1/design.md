# Design: Surface Equipment Workbench UI Prototype V1

## Constraints

The prototype is intentionally isolated from the browser product source and from the unpublished Equipment Core. The only implementation surface is a nested static Vite page (`index.html`, `styles.css`, `app.js`) plus the explicitly scoped E2E, evidence, audit, and change artifacts. Existing public fonts/assets may be referenced but not modified.

## Chosen structure

```text
prototypes/surface-equipment-workbench-v1/
  index.html   semantic shell and stable landmarks
  styles.css   industrial three-pane and responsive presentation
  app.js       frozen mock data, local state, derived rules, commands, rendering
```

Vite already serves nested HTML files from the browser-app root, so no router or configuration change is needed.

## Local prototype boundary

`app.js` keeps four conceptual layers even though it is a single script:

1. **Mock catalog** — immutable device/module definitions with explicit prototype identifiers and metric contributions.
2. **Draft state** — selected fixture/module/slot, per-device installed modules, filters, compare state, and local history.
3. **Derived view model** — aggregate metrics, capability/interface/legal labels, readiness, diagnostics, and suggested fixes.
4. **Commands** — select, install, remove, replace, move, undo, redo, enter/exit compare, and choose responsive pane.

Rendering consumes only the derived view model. Mutation occurs only through commands. Invalid commands return a visible diagnostic/announcement and do not touch history.

## History model

Use full, small JSON-safe snapshots of the six local mock builds rather than diff patches. Before each successful mutation, push the current build snapshot to `past`, clear `future`, then apply the command. Undo moves current to `future` and restores the newest `past`; redo performs the inverse. Selection and temporary compare/drag UI state are not domain state and may be normalized after restore.

## Diagnostic model

Rules are deterministic and fixture-specific, with explicit diagnostic IDs, severity (`blocked` or `limited`), affected target, message, and suggested fix. Aggregate readiness is `Blocked` when any blocking rule exists, `Limited` when only warnings/restrictions exist, otherwise `Ready`. Restricted EMP legality remains visibly non-authoritative mock data.

## Interaction design

The left pane combines fixture/category selection, searchable palette, compatibility filter, and legal/license filter. The center uses a technical slot diagram backed by a semantic slot list. Pointer drag/drop and click-to-install call the same command. Selected installed modules expose Remove and Move; candidates expose Install or Replace. Compare renders current/candidate deltas in the inspection pane.

The right pane is one inspection surface rather than a KPI-card dashboard. Metrics use compact rows; readiness and diagnostics use text, icons/shapes, and color together.

## Responsive and accessibility

Desktop uses a fixed/narrow left rail, flexible assembly center, and fixed/narrow inspection rail. Small viewports retain the same DOM landmarks and show one pane at a time through Library/Assembly/Inspection controls; Assembly is the default. Native inputs/buttons, roving or conventional list focus, visible `:focus-visible`, live regions, alert semantics, and shortcut suppression inside editable controls provide keyboard support.

## Port 5224 test strategy

The existing Playwright config is fixed to 5173 and cannot be edited. The scoped E2E therefore owns a dedicated Vite process on `127.0.0.1:5224`, targets the prototype with an absolute URL or test-level base override, waits for readiness, and shuts down only the process it started. The existing global 5173 webServer may still start as a runner prerequisite but is not the tested application URL. If reliable 5224 lifecycle cannot be achieved entirely inside the scoped spec, implementation stops for a scope decision rather than changing configuration.

Browser health records four channels: console errors, uncaught page errors, failed network responses/requests, and missing assets (404/resource failures). The exact hooks and exclusions are documented in the audit; all must be zero.

## Visual system

Reuse the existing browser’s compact technical typography and graphite/industrial palette as reference, not source coupling. Use hard separators, restrained corner clipping/radii, blueprint-grid/connector cues, and meaningful green/amber/red status treatments. Avoid rarity colors, glass, broad gradients, decorative glow, floating-card shells, fighter HUD theater, and toy-like weapon presentation.

## Future Equipment Core adapter

A future adapter can replace the mock catalog/derived-rule provider with snapshots or view models and map local command intents to authoritative Equipment Core commands. The rendering and interaction surfaces should not require a redesign. This change deliberately does not name core DTOs, APIs, events, legality enums, or compatibility contracts because they are unpublished and outside prototype authority.