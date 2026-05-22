# Recommended Assets for Weltraum-Spiel

Generated UTC: 2026-05-22T20:31:06.2713735Z

This decision aid records metadata and recommendations only. It does not include paid package contents or copied asset files.

## Weltraum-Spiel Usefulness Matrix
| Category | Candidate assets | What to reuse | What to adapt | What to avoid |
|---|---|---|---|---|
| Player-facing UI/HUD | PrototypePlayerHud.cs; PrototypeFlightHud.cs; PrototypeMinimapOverlay.cs; PrototypeUiStyle.cs; uGUI/UIElements; In-game Debug Console cache | Reuse the existing HUD snapshot/rendering and minimap model first. | Test PrimeTween or debug console later for polish/debug builds. | Avoid replacing the current HUD stack with an imported UI kit before input, scaling, and tests are checked. |
| Space ships / modular ship parts | Assets/Art/PrototypeShipKit/Parts; DemoShips; prototype_ship_kit_manifest.json; PrototypeShipVisualSwitcher.cs | Reuse imported FBX/GLB parts and manifest for builder/runtime visual modes. | Adapt materials, hardpoints, and socket metadata as the builder matures. | Avoid nature/environment packs for ships; they do not cover hardpoints or ship-scale constraints. |
| Thruster/RCS VFX | MainThrusterVfx.prefab; RcsThrusterVfx.prefab; PrototypeShipVfxLibrary.asset; Unity Particle Pack cache | Use existing VFX prefabs directly for current flight evidence. | Inspect particle packs in a throwaway project for exhaust variants. | Avoid importing legacy particle content directly until shader/render pipeline compatibility is verified. |
| Weapons/projectiles/combat VFX | gun_mount_light_mk1; PrototypeTurretWeapon.cs; PrototypeProjectileSimulation.cs; Particle Pack cache | Reuse weapon binder and projectile runtime systems. | Adapt particle effects for muzzle flashes, impacts, and trails after test import. | Avoid imported projectile scripts that overlap the deterministic combat simulation. |
| Space environment/skybox/planets/asteroids | URP settings; FREE Skybox Extended Shader cache; low-poly nature/environment caches | Reuse URP settings as the rendering baseline. | Test skybox shader and low-poly packs as placeholder planet-surface art only. | Avoid assuming nature packs solve space needs; planets, asteroids, nebulae, and starfields are still missing. |
| Docking/stations/hangars | connector_hardpoint_mk1; DockingPort.cs; PrototypeDockingApproachAssist.cs; UModeler X cache | Reuse docking code and connector hardpoint art. | Use UModeler or simple FBX blockouts in a test project for station/hangar grayboxes. | Avoid importing broad editor modeling tools before licensing and generated-asset workflow are settled. |
| Ship builder/UI inventory | PrototypeShipBlueprint.cs; PrototypeShipLayout.cs; PrototypeShipVariant.cs; PrototypeUiViewModels.cs; PrimeTween cache | Reuse blueprint/layout/view-model code. | Adapt UI animation tooling only after the builder flow is stable. | Avoid adding a second inventory framework before the current model is exhausted. |
| Audio/SFX/music | Unity audio module only; no imported SFX/music assets found | Use built-in audio support. | Add thruster, weapon, impact, docking, alert, ambience, and music packs later. | Avoid wiring a large audio system until actual clips exist. |
| Editor tooling | MCP for Unity; Test Framework; UModeler X cache; Easy Poly Map Creator cache | Reuse Unity MCP and tests for iteration and evidence. | Evaluate modeling/terrain extensions in a throwaway project. | Avoid editor extensions that change settings or generate assets without a rollback plan. |
| Performance/optimization | Burst/Collections transitive packages; PrototypeRuntimeJobSystems.cs; URP | Reuse current job-system and runtime snapshot architecture. | Consider Burst only for measured hotspots. | Avoid optimization packages or import-setting changes without profiler evidence. |
| Networking/save/persistence | Multiplayer Center installed; no Netcode or persistence asset found | Reuse none yet beyond package discovery. | Evaluate save-game and networking approaches after gameplay contracts stabilize. | Avoid importing networking frameworks speculatively. |

## Final Recommendations

### Top 10 assets/packages to inspect first
- Assets/Art/PrototypeShipKit/Parts/*.fbx and *.glb - current modular ship vocabulary.
- Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1 and demo_cargo_mk1 - assembled visual baselines.
- Assets/Art/PrototypeShipKit/VFX/Prefabs/MainThrusterVfx.prefab and RcsThrusterVfx.prefab - already bound to flight evidence.
- Assets/Art/PrototypeShipKit/prototype_ship_kit_manifest.json - metadata for parts, sockets, and categories.
- PrototypePlayerHud.cs plus PrototypeMinimapOverlay.cs - player-facing HUD and tactical scan surface.
- com.unity.render-pipelines.universal - active rendering path and shader compatibility baseline.
- com.unity.inputsystem - current controls/input action foundation.
- Unity Technologies/Particle Pack.unitypackage - candidate combat and thruster VFX, throwaway import first.
- BOXOPHOBIC/FREE Skybox Extended Shader.unitypackage - candidate skybox tooling, verify URP compatibility first.
- Kyrylo Kuzyk/PrimeTween.unitypackage or yasirkula/In-game Debug Console.unitypackage - optional UI/debug polish after throwaway import.

### Assets that should be imported into a throwaway test project first
- All local Asset Store .unitypackage archives, especially Particle Pack, Legacy Particle Pack, UModeler X, PrimeTween, In-game Debug Console, and Skybox Extended Shader.
- Shader or render-pipeline-affecting packages before they touch URP settings.
- Editor extensions that may add project settings, menu items, generated assets, or dependencies.
- Large environment/nature packs because they are mostly planet-surface placeholders and can add many materials/textures.

### Assets safe to use directly
- Imported PrototypeShipKit FBX/GLB parts, materials, demo ships, and VFX prefabs already under Assets/Art.
- Installed Unity packages already referenced by the project: URP, Input System, Test Framework, uGUI/UIElements, Physics, Audio, Particle System.
- Existing scripts and tests under Assets/Scripts/Prototype and Assets/Tests as project-owned implementation evidence.

### Assets that may conflict with project settings
- Skybox/shader packages if they assume Built-in Render Pipeline instead of URP 17.4.
- Particle packs that include legacy materials, shaders, or quality settings.
- Runtime debug console or UI packages that bind input, canvases, or EventSystem state.
- UModeler X or terrain/editor extensions that may add editor settings, generated assets, or paid-license constraints.
- Visual Scripting if used as a parallel gameplay logic path without tests.

### Missing asset categories
- Purpose-built space skyboxes/starfields/nebulae verified on URP.
- Planets, moons, asteroids, debris fields, stations, docking bays, hangars, and cargo props.
- Weapon muzzle flashes, projectile trails, shield/impact/explosion VFX tuned for space combat.
- Thruster, RCS, weapon, impact, docking, UI alert, ambience, and music audio packs.
- Save-game/persistence and networking packages or project-owned implementations.
