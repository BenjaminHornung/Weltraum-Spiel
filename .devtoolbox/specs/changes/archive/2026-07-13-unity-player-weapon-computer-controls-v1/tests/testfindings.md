# player-weapon-computer-controls-v1 Test Findings

## Result

PASS for the scoped Weapon Computer controls slice.

## Findings

- Basic Player HUD now shows Combat controls in the Combat context: `Prev`, `Next`, `Clear`, `Auto Off/On`, and `Prio ...`.
- The controls reuse `PrototypeWeaponComputer` as the target-selection authority. New helper APIs live on `PrototypeWeaponComputer`; the HUD does not duplicate target ordering, pruning, or priority selection.
- The runtime screenshot shows the legacy debug Weapon Computer window hidden while player-facing Combat controls are visible.
- No debug-only weapon values are displayed in the player context; hit chance, projectile tuning, yaw/pitch internals, and recoil values remain outside the Basic HUD.
- Layout tests confirm the Combat control row stays separated from body text, gauges, and adjacent buttons across ultrawide, 16:9, 4:3, portrait, and small viewport layouts.
- DevToolbox `verify_run` recorded the expected project-root blocker: specs passed, while generic `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed because the Unity workspace has multiple MSBuild project/solution files and the configured commands do not name the solution. The explicit solution build passed.

## Residual Risk

- This is the compact v1 HUD control row, not the later full target-list/map overlay.
- DevToolbox task completion preflight remains blocked by the generic `verify_run` result, so tasks are intentionally left unchecked until the verifier can use the explicit solution or the blocker is overridden by project policy.
- The project still has order-dependent projectile visual/simulation failures in the full `PrototypeWeaponComputerTurretValidationTests` suite. Focused Weapon Computer helper tests and HUD tests pass, and no projectile runtime files were changed in this slice.
- TextMeshPro/readability remains a separate pending UI slice.
