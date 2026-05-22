# player-weapon-computer-controls-v1 Spec

## Capability: Player Weapon Computer Controls

### Requirements

- The Player HUD SHALL show a compact Weapon Computer control row when the current context is Combat.
- The control row SHALL be hidden in Navigation, Docking, Objective, Nominal, and Critical contexts.
- The controls SHALL support:
  - selecting the next available combat target;
  - selecting the previous available combat target;
  - clearing the current combat target selection;
  - toggling Auto Fire;
  - cycling priority mode.
- Controls SHALL use existing `PrototypeWeaponComputer` state and behavior. Any new helper APIs must live on `PrototypeWeaponComputer` and must preserve existing priority/selection semantics.
- Controls SHALL expose safe disabled states when the Weapon Computer is missing or no target candidates exist.
- The Combat context SHALL keep player-facing status visible: active target, health/integrity, range, fire status, Auto Fire state, and priority mode.
- The Player HUD SHALL NOT show debug-only weapon data such as hit chance, projectile tuning, requested/applied yaw/pitch, or recoil values.
- The legacy `PrototypeWeaponComputerPanel` SHALL remain hidden in Basic preset and remain available in diagnostics/F7 flows.
- The HUD layout SHALL keep Combat controls separated from body text, gauges, radar, bottom bar, and adjacent buttons across supported aspect ratios.

### Important Scenarios

- No Weapon Computer: controls hidden or disabled without exceptions.
- No available target: target cycle buttons disabled, clear disabled, Auto Fire can still toggle if the Weapon Computer exists.
- Available targets but no active selection: Next/Previous select a target; Clear remains disabled until a selection exists.
- Active target selected: context shows target health/range/fire state; Clear removes selection; Auto Fire toggles Armed/Off/No target wording.
- Priority cycling rotates through `ManualOrder`, `Nearest`, `HighestHealth`, and `LowestHealth` without changing debug-only UI.

### Verification

- EditMode tests SHALL cover helper API selection/priority behavior.
- EditMode HUD tests SHALL cover visibility, labels, button interactions, hidden non-combat state, and aspect-ratio separation.
- Unity MCP validation/tests and a GameView screenshot SHALL be captured as evidence under this change's `tests/` folder.
