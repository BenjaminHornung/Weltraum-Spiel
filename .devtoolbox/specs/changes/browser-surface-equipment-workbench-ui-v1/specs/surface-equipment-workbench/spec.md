# Surface Equipment Workbench

## Authority and route

### Requirement: standalone mock prototype

The browser SHALL expose the workbench at `/prototypes/surface-equipment-workbench-v1/` without requiring changes to application source, package, build, Playwright, or CI configuration.

The workbench SHALL visibly display `UI PROTOTYPE · MOCK BUILDER DATA · NO GAMEPLAY AUTHORITY` at all supported viewport sizes.

The prototype SHALL NOT claim domain authority, persistence, inventory/economy effects, or compatibility/legal truth beyond its explicitly local mock rules.

## Fixture catalog

### Requirement: exactly six starting devices

The initial catalog SHALL visibly contain exactly these six devices:

1. Survey Scanner
2. Mining Cutter
3. Repair Tool
4. EMP Breacher
5. Ballistic Sidearm
6. Laser Cutter

Each device SHALL be selectable and SHALL expose its assembly, installed modules, readiness, diagnostics, and derived mock metrics.

### Requirement: module-role coverage

Across the catalog and module palette, the UI SHALL visibly represent these roles: Frame, Tool Head, Delivery Assembly, Power Pack, Thermal Sink, Feed System, Magazine, Optic/Scanner, Control, Safety, Legal Transponder, Grip/Stock, and Utility.

## Workbench layout

### Requirement: three logical work areas

The left work area SHALL provide Categories, Module Palette, Search, Compatibility Filter, and Legal/License Filter.

The central work area SHALL provide a schematic assembly view with slots, installed modules, empty-state labels, selected-module state, and commands for install, remove, replace, move, undo, and redo.

The right work area SHALL expose Mass, Bulk, Continuous Power, Pulse Energy, Heat, Dissipation, Range, Cycle, Ammo/Charge, Capabilities, Suit Interfaces, Legal Class, readiness (Ready/Limited/Blocked), diagnostics, and a suggested fix.

## Editing behavior

### Requirement: local commands and history

A compatible available module SHALL be installable by click and by drag/drop.

An installed module SHALL be removable. A compatible candidate SHALL replace an occupied slot through an explicit replace action. A movable installed module SHALL move to another compatible slot.

Each successful mutating command SHALL append one local prototype-history entry. Undo and redo SHALL restore the complete prior/next local build state. A new command after undo SHALL clear the redo branch. Invalid commands SHALL NOT mutate the build or history.

The history SHALL be labeled and implemented as local prototype state only.

### Requirement: compare two builds

Compare mode SHALL present current and candidate builds together and identify changed mass, power/energy, heat/dissipation, capabilities, interfaces, legal class, readiness, and module differences. Exiting compare SHALL return focus to the initiating control.

## Diagnostics and scenarios

### Requirement: deterministic scenario coverage

The mock rules SHALL make these scenarios directly reproducible and visibly distinguish blocking from limited/warning states:

- Ballistic Sidearm without Safety is Blocked with an actionable suggested fix.
- Ballistic Sidearm without Magazine is Blocked with an actionable suggested fix.
- Mining Cutter over its thermal budget is Blocked or Limited according to the displayed mock threshold and explains the required thermal fix.
- Survey Scanner without a Suit Interface is Blocked and suggests a compatible interface/control module.
- EMP Breacher is visibly Restricted and explains the legal/transponder requirement.
- Repair Tool without its Consumable is Blocked or Limited and identifies the missing consumable.
- At least one device configuration is Ready with no blocking diagnostic.
- Two builds can be compared.

Every diagnostic SHALL identify the issue, affected slot/module or metric, and a suggested fix. Selecting a diagnostic SHALL focus the affected workbench target when one exists.

## Accessibility and responsive behavior

### Requirement: keyboard and focus

All actions SHALL use keyboard-operable native controls or equivalent semantics. Tab and Shift+Tab SHALL traverse usable controls with a visible focus indicator. Enter/Space SHALL activate applicable actions. Escape SHALL cancel transient compare/replace/drag state. Delete SHALL remove a selected installed module. Ctrl+Z SHALL undo; Ctrl+Y and Ctrl+Shift+Z SHALL redo. Builder shortcuts SHALL NOT fire while typing in text inputs.

Successful operations SHALL be announced politely; blocking diagnostics SHALL be announced as alerts. Status SHALL never rely on color alone.

### Requirement: responsive work areas

At desktop widths the three work areas SHALL remain simultaneously visible. At small widths the same logical areas SHALL be reachable through explicit Library, Assembly, and Inspection pane controls; the Assembly pane SHALL be the primary/default editing pane and content SHALL NOT degrade into an unstructured single long stack.

## Visual direction

The UI SHALL be functional and industrial, with workship/suit-equipment silhouettes and clear technical hierarchy. It SHALL avoid fantasy/loot rarity coloring, fighter-cockpit cosplay, toy-like sci-fi styling, glassmorphism, generic gradient dashboards, excessive pills, and decorative panels without function.

## Verification and evidence

The targeted E2E SHALL use port 5224 and verify six fixtures, install/remove/replace/move, diagnostics, undo/redo, compare, keyboard/focus, responsive behavior, and browser health 0/0/0/0.

Evidence SHALL include deterministic screenshots for Survey Scanner, Mining Cutter, Ballistic Sidearm Blocked, Ballistic Sidearm Ready, and a responsive viewport. Browser-health evidence SHALL define and report the four zero-valued channels.

## Future adapter seam

The prototype SHALL keep mock fixtures, validation, derived metrics, and commands behind an internal boundary that can later be replaced by Equipment Core snapshots/view-models and command adapters. The change SHALL document that seam but SHALL NOT prescribe unpublished core types, endpoints, event schemas, or domain rules.