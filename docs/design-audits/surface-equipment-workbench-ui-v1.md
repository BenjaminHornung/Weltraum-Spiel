# Surface Equipment Workbench UI Prototype V1 — Design Audit

## Audit scope and authority

This audit covers the standalone route `/prototypes/surface-equipment-workbench-v1/` implemented by [the semantic shell](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/index.html), [industrial presentation](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/styles.css), and [local mock state engine](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js). It maps the approved [proposal](../../.devtoolbox/specs/changes/browser-surface-equipment-workbench-ui-v1/proposal.md), [design](../../.devtoolbox/specs/changes/browser-surface-equipment-workbench-ui-v1/design.md), [tasks](../../.devtoolbox/specs/changes/browser-surface-equipment-workbench-ui-v1/tasks.md), and [workbench specification](../../.devtoolbox/specs/changes/browser-surface-equipment-workbench-ui-v1/specs/surface-equipment-workbench/spec.md) to the verified prototype and evidence.

The authority banner is visible at desktop and mobile widths and is exactly:

`UI PROTOTYPE · MOCK BUILDER DATA · NO GAMEPLAY AUTHORITY`

The supporting copy also states that the draft is local and does not affect inventory, saves, or gameplay. Fixtures, installed modules, metrics, readiness, diagnostics, compatibility, and legal labels are mock presentation data and local rules only. The prototype is not Equipment Core, persistence, inventory, economy, legality, compatibility, or gameplay authority; legal class is explicitly rendered with `(mock)`.

## Requirement coverage

| Requirement | Verified implementation | Repository evidence |
| --- | --- | --- |
| Exactly six fixtures | The fixture strip contains Survey Scanner, Mining Cutter, Repair Tool, EMP Breacher, Ballistic Sidearm, and Laser Cutter, each with its own assembly, metrics, readiness, and diagnostics. | [Prototype state and rendering](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js); [fixture/role E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts) |
| 13 visible module roles | The unfiltered palette visibly covers Frame, Tool Head, Delivery Assembly, Power Pack, Thermal Sink, Feed System, Magazine, Optic/Scanner, Control, Safety, Legal Transponder, Grip/Stock, and Utility. The E2E asserts every role independently. | [Mock module catalog](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js); [fixture/role E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts) |
| Three logical work areas | Desktop uses a simultaneous three-column grid. Library provides search, category, compatibility, and legal/license filters plus the palette. Assembly provides schematic slots, installed/empty/selected states, commands, and local history. Inspection provides Mass, Bulk, Continuous Power, Pulse Energy, Heat, Dissipation, Range, Cycle, Ammo/Charge, Capabilities, Suit Interfaces, Legal Class, readiness, diagnostics, suggested fixes, and compare. | [Semantic shell](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/index.html); [responsive styles](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/styles.css); [Scanner desktop evidence](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-scanner.png) |
| Install, remove, replace, move | Explicit buttons and click-to-install/replace call the same local command-intent adapter as HTML5 `dragstart`/`dragover`/`drop`. Available modules can install into empty slots or replace occupied compatible slots; installed modules can move only to compatible empty slots. Remove is explicit and Delete also removes the selected installed module. The automated drag coverage dispatches synthetic drag events with a `DataTransfer`, so it proves the event and command-handler path, not native pointer hit-testing or browser drag initiation. | [Command and drag/drop implementation](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js); [targeted E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts) |
| Invalid-command immutability | Validation returns before `commitMutation`; invalid install, replace, remove, or move attempts therefore leave builds and history unchanged. The E2E attempts an incompatible move and confirms the destination remains empty and history remains `0 undo · 0 redo`. | [Command guards](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js); [invalid-mutation E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts) |
| Local-only undo/redo | Successful mutations snapshot all six local mock builds, append one labeled history entry, and clear the redo branch. Undo/redo restore complete snapshots; a new remove after undo disables redo, and a later redo attempt is rejected without changing the build. Selection, compare, and drag state are not recorded as build history. | [History implementation](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js); [branch-clearing E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts) |
| Compare two builds | Compare shows current and candidate values for all derived metrics plus capabilities, interfaces, legal class, readiness, and module differences. Escape or the exit control closes compare and returns focus to the initiating Compare button. | [Compare renderer](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js); [compare/focus E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts) |
| Responsive panes | At desktop widths all three work areas remain visible. At `390×844`, explicit Library, Assembly, and Inspection tab controls expose one structured pane at a time; Assembly is the default selected and visible pane. The tablist uses roving `tabindex`; ArrowLeft/ArrowRight wrap and activate adjacent panes, while Home/End activate the first/last pane and retain focus on the active tab. Pointer activation moves focus to the selected pane heading, and both paths preserve horizontal fit. | [Responsive styles](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/styles.css); [mobile E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts); [responsive evidence](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-responsive.png) |
| Keyboard, focus, announcements, and motion | Native buttons/inputs/selects provide Enter/Space activation and normal Tab order. Visible `:focus-visible` outlines are defined. Escape cancels compare/replace/move/drag state, Delete removes a selected installed module, Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo, and shortcuts are suppressed in editable controls. Successful operations use a polite atomic status region; blocking diagnostics switch to assertive `role="alert"`. Status always includes text, not color alone. Reduced-motion media rules collapse animation and transition durations; the E2E runs with reduced motion emulated. | [Semantic shell](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/index.html); [focus and reduced-motion styles](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/styles.css); [interaction implementation](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js); [keyboard/responsive E2E](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts) |
| Industrial art direction | Graphite surfaces, hard separators, compact technical typography, restrained radii, a blueprint assembly grid, connector lines, schematic slot indices, and labeled green/amber/red states create a functional workbench hierarchy. The screenshots show no rarity palette, glassmorphism, broad decorative gradient, floating-card dashboard, cockpit theater, or toy-like weapon treatment. | [Industrial styles](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/styles.css); [desktop screenshot set](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-scanner.png) |

## Deterministic diagnostics and scenarios

| Fixture/scenario | Verified result and recovery |
| --- | --- |
| Survey Scanner without Suit Interface | `Blocked`; targets Control Bus and suggests the Suit-linked Scan Controller. Selecting the diagnostic focuses that slot. Installing the controller reaches `Ready`. |
| Mining Cutter over thermal budget | `Limited` because `92 HU` heat exceeds `50 HU` dissipation; suggests the High-load Thermal Sink, which reaches `Ready`. |
| Repair Tool without Consumable | `Blocked`; targets Consumable Feed and suggests the Sealant Feed Cartridge, which reaches `Ready`. |
| EMP Breacher without transponder | Legal class remains `Restricted (mock)` and readiness is `Limited`; the diagnostic targets License Port and suggests the Restricted Tool Transponder. |
| Ballistic Sidearm without Safety | `Blocked`; targets Safety Interlock and suggests the Mechanical Safety Interlock. |
| Ballistic Sidearm without Magazine | `Blocked`; targets Magazine Well and suggests the 12-round Magazine. Installing both missing modules reaches `Ready`. |
| Ready reference | Laser Cutter starts `Ready` with no blocking or limiting diagnostic. Scanner, Cutter, Repair Tool, and Sidearm also reach deterministic Ready states after their stated fixes. |
| Two-build comparison | Laser Cutter and Survey Scanner are compared in the automated flow, including metrics, capabilities, interfaces, legal class, readiness, and module differences. |

These rules are implemented in the [derived mock view model](../../apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/app.js) and exercised by the [six-test Chromium acceptance spec](../../apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts).

## Verification and evidence

Run from `apps/weltraum-browser`:

```powershell
npx playwright test tests/e2e/surface-equipment-workbench-ui.spec.ts --project=chromium
```

Fresh full Chromium result: **6/6 passed in 9.9 s**. The spec owns `npm run dev -- --host 127.0.0.1 --port 5224 --strictPort`, tests the exact prototype route, and stops its owned process; the verification run reported the ports cleaned.

The [health report](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-health.json) records one report for each of the six tests and defines four asserted channels:

- `consoleErrors`: browser console messages with type `error`.
- `uncaughtPageErrors`: uncaught page exceptions observed through `pageerror`.
- `failedRequestsOrResponses`: request failures plus non-404 HTTP responses with status `>= 400`.
- `missingAssetOrResource404s`: HTTP 404 responses, including missing assets/resources.

Only request failures emitted after shutdown starts for the owned `127.0.0.1:5224` process are eligible for filtering. The recorded totals are **0 console errors / 0 uncaught page errors / 0 failed requests or responses / 0 missing assets or resource 404s**; every per-test array, including ignored shutdown failures, is empty.

### Screenshot matrix

| Evidence | State | Viewport |
| --- | --- | --- |
| [Scanner](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-scanner.png) | Survey Scanner Ready with Suit-linked Scan Controller installed | `1440×960` |
| [Cutter](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-cutter.png) | Mining Cutter Limited at `92 HU` heat / `50 HU` dissipation with thermal fix visible | `1440×960` |
| [Sidearm blocked](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-sidearm-blocked.png) | Ballistic Sidearm Blocked by missing Safety and Magazine | `1440×960` |
| [Sidearm ready](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-sidearm-ready.png) | Ballistic Sidearm Ready after Safety and Magazine installation | `1440×960` |
| [Responsive](../../apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-responsive.png) | Mobile Inspection pane after explicit pane navigation; the same test first verifies Assembly as the default | `390×844` |

## Limitations and remaining verification risk

- This is an isolated, in-memory prototype. Refresh resets all builds and history; there is no Equipment Core, runtime, inventory, persistence, economy, legality, compatibility, unlock, crafting, networking, or gameplay integration.
- Compatibility, metrics, thresholds, readiness, legal class, and suggested fixes are frozen mock rules for UX evaluation. They must not be reused as domain contracts.
- The industrial assembly uses schematic slots and connector cues; literal workship/suit-equipment silhouette art is not present.
- Synthetic `DataTransfer` dispatch verifies drag/drop event handling and command routing only. Native pointer hit-testing, drag-threshold initiation, and real pointer-driven HTML5 drag behavior remain unverified.
- The evidence covers Chromium at `1440×960` and `390×844`, keyboard paths exercised by the targeted E2E, reduced-motion emulation, and automated browser-health hooks. It does not establish cross-browser behavior, screen-reader output, forced-colors/high-contrast behavior, touch-device drag behavior, 200% zoom resilience, contrast ratios, or full WCAG conformance.

## Later Equipment Core adapter point

The existing seam is intentionally narrow: replace the local mock catalog and derived view-model snapshot provider with future authoritative Equipment Core snapshots/view models, then map the existing UI command intents for install, remove, replace, move, undo, and redo to future authoritative Equipment Core commands. Rendering and interaction can continue to consume view models and emit command intents.

No DTOs, endpoints, events, enums, legality rules, compatibility rules, persistence behavior, or other unpublished Equipment Core contracts are specified or implied by this prototype.
