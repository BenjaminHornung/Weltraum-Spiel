# Recommended Assets for Weltraum-Spiel

Generated UTC: 2026-05-23T09:33:23.9647455Z

This decision aid records metadata and recommendations only. It does not include paid package contents or copied asset files.

## Weltraum-Spiel Usefulness Matrix
| Category | Candidate assets | What to reuse | What to adapt | What to avoid |
|---|---|---|---|---|
| Player-facing UI/HUD | PrototypePlayerHud.cs; PrototypeFlightHud.cs; PrototypeMinimapOverlay.cs; PrototypeUiStyle.cs; TextMesh Pro assets; 3D Modern Menu UI; PrimeTween; In-game Debug Console | Reuse the existing HUD snapshot/rendering, minimap model, and TMP text assets first. | Test SlimUI/PrimeTween/debug console in a throwaway project for menu polish and debug builds. | Avoid replacing the current HUD stack with an imported UI kit before input, scaling, and tests are checked. |
| Space ships / modular ship parts | Assets/Art/PrototypeShipKit/Parts; DemoShips; prototype_ship_kit_manifest.json; Sci-Fi Styled Modular Pack | Reuse imported FBX/GLB parts and manifest for builder/runtime visual modes. | Inspect the sci-fi modular pack in a throwaway project for alternate hull, station, and hangar pieces. | Avoid nature/environment packs for ships; they do not cover hardpoints or ship-scale constraints. |
| Thruster/RCS VFX | MainThrusterVfx.prefab; RcsThrusterVfx.prefab; PrototypeShipVfxLibrary.asset; Particle Pack; Free Quick Effects Vol 1; Weather And Elemental VFX Pack | Use existing VFX prefabs directly for current flight evidence. | Inspect particle and quick-effect packs in a throwaway project for exhaust, sparks, trails, and impact variants. | Avoid importing legacy particle content directly until shader/render pipeline compatibility is verified. |
| Weapons/projectiles/combat VFX | gun_mount_light_mk1; PrototypeTurretWeapon.cs; PrototypeProjectileSimulation.cs; War FX; Free Quick Effects Vol 1; Particle Pack | Reuse weapon binder and projectile runtime systems. | Adapt imported muzzle flashes, impacts, explosions, and projectile trails after test import. | Avoid imported projectile scripts that overlap the deterministic combat simulation. |
| Space environment/skybox/planets/asteroids | URP settings; FREE Skybox Extended Shader; Real Stars Skybox Lite; low-poly terrain/tree/environment caches | Reuse URP settings as the rendering baseline. | Test skybox shader, Real Stars, terrain, and tree packs as space/planet-surface placeholders. | Avoid assuming nature packs solve space needs; planets, asteroids, nebulae, and station exteriors are still missing. |
| Docking/stations/hangars | connector_hardpoint_mk1; DockingPort.cs; PrototypeDockingApproachAssist.cs; Sci-Fi Styled Modular Pack; UModeler X; ProBuilder 2x | Reuse docking code and connector hardpoint art. | Use sci-fi modular pieces, ProBuilder, or UModeler in a test project for station/hangar grayboxes. | Avoid importing broad editor modeling tools before licensing and generated-asset workflow are settled. |
| Ship builder/UI inventory | PrototypeShipBlueprint.cs; PrototypeShipLayout.cs; PrototypeShipVariant.cs; PrototypeUiViewModels.cs; 3D Modern Menu UI; PrimeTween | Reuse blueprint/layout/view-model code. | Adapt UI animation and menu assets only after the builder flow is stable. | Avoid adding a second inventory framework before the current model is exhausted. |
| Audio/SFX/music | Unity audio module; FMOD for Unity 202; no discovered SFX/music clip pack | Use built-in audio support for now. | Evaluate FMOD in a throwaway project before deciding whether the prototype needs middleware. | Avoid integrating audio middleware until actual thruster, weapon, impact, docking, alert, ambience, and music clips exist. |
| Editor tooling | MCP for Unity; Test Framework; UModeler X; ProBuilder 2x; Easy Poly Map Creator; Unity Asset Manager package | Reuse Unity MCP and tests for iteration and evidence. | Evaluate modeling/terrain/asset-manager tools in a throwaway project. | Avoid editor extensions that change settings or generate assets without a rollback plan. |
| Performance/optimization | Burst/Collections transitive packages; PrototypeRuntimeJobSystems.cs; URP | Reuse current job-system and runtime snapshot architecture. | Consider Burst only for measured hotspots. | Avoid optimization packages or import-setting changes without profiler evidence. |
| Networking/save/persistence | Multiplayer Center installed; no Netcode or persistence asset found | Reuse none yet beyond package discovery. | Evaluate save-game and networking approaches after gameplay contracts stabilize. | Avoid importing networking frameworks speculatively. |

## Final Recommendations

### Top 10 assets/packages to inspect first
- Assets/Art/PrototypeShipKit/Parts plus demo_scout_mk1/demo_cargo_mk1 - current modular ship vocabulary and assembled baselines.
- Assets/Art/PrototypeShipKit/VFX/Prefabs/MainThrusterVfx.prefab and RcsThrusterVfx.prefab - already bound to flight evidence.
- Assets/Art/PrototypeShipKit/prototype_ship_kit_manifest.json - metadata for parts, sockets, and categories.
- PrototypePlayerHud.cs plus PrototypeMinimapOverlay.cs - player-facing HUD and tactical scan surface.
- com.unity.render-pipelines.universal and com.unity.inputsystem - active rendering and control baselines.
- Real Stars Skybox Lite plus FREE Skybox Extended Shader - candidate space backdrop work, verify URP compatibility first.
- War FX, Free Quick Effects Vol 1, Weather And Elemental VFX Pack, and Particle Pack - candidate combat/thruster VFX, throwaway import first.
- Sci-Fi Styled Modular Pack - candidate station, hangar, and alternate modular ship kit pieces.
- 3D Modern Menu UI, PrimeTween, and In-game Debug Console - optional UI/debug polish after throwaway import.
- FMOD for Unity 202 - candidate audio middleware only after concrete SFX/music needs are known.

### Assets that should be imported into a throwaway test project first
- All local Asset Store .unitypackage archives, especially VFX packs, skyboxes, Sci-Fi Styled Modular Pack, FMOD, SlimUI, UModeler X, ProBuilder 2x, PrimeTween, and In-game Debug Console.
- Shader or render-pipeline-affecting packages before they touch URP settings.
- Editor extensions and middleware that may add project settings, menu items, generated assets, native plugins, or dependencies.
- Large environment/nature packs because they are mostly planet-surface placeholders and can add many materials/textures.

### Assets safe to use directly
- Imported PrototypeShipKit FBX/GLB parts, materials, demo ships, and VFX prefabs already under Assets/Art.
- Installed Unity packages already referenced by the project: URP, Input System, Test Framework, uGUI/UIElements, Physics, Audio, Particle System.
- Existing scripts and tests under Assets/Scripts/Prototype and Assets/Tests as project-owned implementation evidence.

### Assets that may conflict with project settings
- Skybox, post-processing, or shader packages if they assume Built-in Render Pipeline instead of URP 17.4.
- Particle packs that include legacy materials, shaders, or quality settings.
- Runtime debug console or UI packages that bind input, canvases, or EventSystem state.
- FMOD if it introduces native plugin setup, bank generation, or audio initialization outside the current prototype architecture.
- UModeler X or terrain/editor extensions that may add editor settings, generated assets, or paid-license constraints.
- Visual Scripting if used as a parallel gameplay logic path without tests.

### Missing asset categories
- Purpose-built space skyboxes/starfields/nebulae verified on URP.
- Planets, moons, asteroids, debris fields, stations, docking bays, hangars, and cargo props.
- Weapon muzzle flashes, projectile trails, shield/impact/explosion VFX tuned for space combat.
- Thruster, RCS, weapon, impact, docking, UI alert, ambience, and music audio packs.
- Save-game/persistence and networking packages or project-owned implementations.
