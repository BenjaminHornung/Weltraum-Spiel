# Unity Weapon Computer / Blender Turret Probe - 2026-05-22

Scene: `Assets/Scenes/PrototypeBootstrapHost.unity`

Probe path:

- Entered Play Mode through Unity MCP.
- Expanded `PrototypeWeaponComputerPanel` at runtime for explicit visual evidence.
- Refreshed weapon targets.
- Selected the first discovered target with AutoFire disabled.
- Ticked turret aim manually for a short visual tracking sample.
- Captured Game View screenshot: `tests/screenshots/weapon-computer-blender-turret-gameview-verified.png`

Runtime result:

```text
playing=True changing=True
bootstrap=True mode=ImportedDemoScoutFunctionalDefault
ship=True visual=Imported Demo Scout
weaponComputer=True panel=True panelVisible=True panelCollapsed=False
targets=13 active=PrototypeArenaTarget_03 autoFire=False status=out of arc
turret=True muzzle=WEAPON_MUZZLE_PRIMARY muzzleForward=(0.470, 0.671, 0.574)
```

Interpretation:

- The default runtime path stayed on the imported Demo Scout.
- The Weapon Computer UI was visible and usable in the normal play scene.
- Target discovery did not require the debug fallback.
- The selected target drove turret status while AutoFire remained off.
- The active muzzle remained the imported/proxy `WEAPON_MUZZLE_PRIMARY`.
