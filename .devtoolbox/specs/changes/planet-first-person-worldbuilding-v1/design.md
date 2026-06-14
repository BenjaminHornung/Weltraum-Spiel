# Design: Planet First-Person Worldbuilding v1

## Status

Concept and spec only. This change must not modify runtime code, tests, Unity scenes, assets, prefabs, Blender files, autopilot harnesses or ship builder runtime code.

## Chosen Shape

The on-planet layer should be designed as an extension of the space game rather than a separate genre. The player goes to planet surfaces to solve problems that benefit from first-person precision: scanning, sampling, hand mining, salvage, outpost interaction, legal/faction decisions, close-range combat and cargo transfer.

The first implementation should be an isolated test slice, not a full planet.

## Reuse Strategy

Future implementation should reuse existing directions and systems where possible:

- Navigation Computer and Autopilot for route planning to orbit targets, landing zones, outposts and pickup points.
- Drones and Remote Missions for scouting, mining, hauling and remote control.
- Persistence and Background Simulation for unloaded resource nodes, drones, outposts and cargo.
- Real-Scale World Architecture for `SurfaceLocalFrame`, local chunks and absolute state separation.
- Existing ship weapons, fuel, cargo and ship builder concepts as resource sinks.

New systems should be added only when surface gameplay needs a capability that ship/droid systems cannot already express.

## Implementation Slicing

### Phase 0: Concept Only

Goal:

- Define the future player experience, resource model, combat direction, worldbuilding, exploration loop, outposts and formal requirements.

Files likely touched later:

- Planning docs and DevToolbox specs only.

Tests/evidence needed later:

- Markdown/spec validation only.

Non-goals:

- No Unity implementation, no controller, no assets, no tests, no scenes.

Risks:

- Over-specifying future details before runtime constraints are known.
- Designing too much content without a small playable slice.

### Phase 1: First-Person Prototype Controller In Isolated Test Scene

Goal:

- Prove the player can move in first person inside a tiny surface test area with suit HUD placeholders and stable camera behavior.

Files likely touched later:

- New prototype first-person controller scripts.
- New isolated test scene.
- Input bindings or prototype control adapter.
- HUD/suit readout scripts.

Tests/evidence needed later:

- Unity console/script validation.
- PlayMode smoke test for spawn, movement, camera and no missing references.
- Screenshot or short protocol for controller state.

Non-goals:

- No terrain streaming.
- No full planet landing.
- No combat balance.
- No final animations.

Risks:

- Control conflicts with existing ship controls.
- Camera nausea or poor feel.
- Scope creep into full character system.

### Phase 2: Planet Surface Test Range

Goal:

- Create a small local surface range with ship, exit point, terrain placeholder, scanner targets and safe return path.

Files likely touched later:

- Prototype test scene or programmatic setup.
- Surface marker/landing point definitions.
- Placeholder terrain/geometry.
- Ship entry/exit adapter.

Tests/evidence needed later:

- PlayMode evidence that player exits and re-enters ship.
- Scene validation and screenshot evidence.
- Boundary checks for spawn safety.

Non-goals:

- No full planet.
- No procedural terrain.
- No seamless orbit-to-surface.

Risks:

- Scene becomes a content sink too early.
- Entry/exit state can desync from ship state.

### Phase 3: Resource Node + Scanner + Hand Mining Tool

Goal:

- Implement one resource node that the player can scan, mine by hand, and deplete into suit inventory.

Files likely touched later:

- Resource node definition.
- Scanner interaction component.
- Hand mining tool.
- Suit inventory data.
- Basic resource catalog.

Tests/evidence needed later:

- EditMode tests for resource node data.
- PlayMode test for scan, mine, inventory increment and depletion.
- Evidence protocol with node state before/after.

Non-goals:

- No full crafting tree.
- No drone mining yet.
- No economy yet.

Risks:

- Inventory/cargo model may diverge from ship cargo.
- Tool mining can become a generic progress bar without risk.

### Phase 4: Cargo Transfer Between Player And Ship

Goal:

- Move resources from suit inventory to ship cargo and make cargo mass visible to the wider ship game.

Files likely touched later:

- Suit inventory.
- Ship cargo state.
- Cargo transfer UI or interaction.
- Save/load state if persistence is in scope.

Tests/evidence needed later:

- Transfer unit tests where possible.
- PlayMode test for suit-to-ship transfer.
- Evidence that ship cargo changes and suit inventory decreases.

Non-goals:

- No market.
- No refinery.
- No full cargo containers.

Risks:

- Cargo mass may not yet affect fuel/autopilot estimates.
- Duplicate inventory systems.

### Phase 5: Basic On-Foot Weapon And One Enemy Drone

Goal:

- Add one basic weapon/tool combat interaction and one readable enemy drone threat.

Files likely touched later:

- Weapon/tool prototype.
- Enemy drone AI.
- Damage/health adapter.
- Suit health feedback.

Tests/evidence needed later:

- PlayMode combat smoke test.
- Evidence for hit detection, damage, death/disable state and player feedback.

Non-goals:

- No full combat progression.
- No humanoid AI.
- No complex loot.

Risks:

- Combat can dominate the surface loop too early.
- Weapon systems may duplicate ship weapon logic without a clear adapter.

### Phase 6: Small Outpost/Settlement Interaction

Goal:

- Add one small outpost with owner label, terminal, cargo/service interaction and a simple job.

Files likely touched later:

- Outpost data.
- Terminal UI.
- Faction/owner metadata.
- Trade or service prototype.
- Mission board stub.

Tests/evidence needed later:

- PlayMode interaction test.
- UI/readback evidence for owner, services and cargo transaction.

Non-goals:

- No full NPC dialogue.
- No dynamic settlement simulation.
- No faction war.

Risks:

- UI and economy scope can expand quickly.
- Faction data must remain simple but not throwaway.

### Phase 7: Drones/Remote Mining

Goal:

- Allow a drone to scout, mine or haul in the surface test range while following mission-style state.

Files likely touched later:

- Drone mission adapter.
- Surface path targets.
- Drone mining/cargo behavior.
- Risk policy hooks.

Tests/evidence needed later:

- PlayMode test for drone deploy, mine, return or transfer.
- Background simulation evidence if unloaded behavior is included.

Non-goals:

- No full fleet autonomy.
- No complex pathfinding across full terrain.

Risks:

- Drone behavior may need navigation/pathing not yet available on surfaces.
- Surface and space drone models may split if not carefully shared.

### Phase 8: Faction/Economy Hooks

Goal:

- Attach ownership, legality, simple prices, licenses and reputation consequences to surface resources/outposts.

Files likely touched later:

- Faction data definitions.
- Economy price table or simple market.
- Ownership/legal scanner labels.
- Mission reward logic.

Tests/evidence needed later:

- Unit tests for legal/illegal extraction where possible.
- PlayMode evidence that scanner and terminal show ownership/prices.

Non-goals:

- No dynamic macroeconomy.
- No full dialogue.
- No multiplayer law enforcement.

Risks:

- Economy can become spreadsheet-heavy before core loop is fun.
- Legal states must be visible or they feel unfair.

### Phase 9: Procedural Placement / Larger Planet Surface

Goal:

- Expand from fixed test range to reusable placement of resource fields, outposts, hazards and activities.

Files likely touched later:

- Placement definitions.
- Seeds.
- Surface chunk/spawn systems.
- Map discovery state.

Tests/evidence needed later:

- Deterministic seed tests.
- PlayMode traversal and discovery evidence.
- Performance notes for chunk size and active objects.

Non-goals:

- No final planet-scale streaming unless separately planned.
- No full biome/ecology simulation.

Risks:

- Procedural content can become bland without authored anchors.
- Performance and save-state complexity rise sharply.

### Phase 10: Gravity/Orbit/Landing Integration

Goal:

- Connect orbital approach, gravity/landing, surface zones and return-to-orbit into a coherent navigation flow.

Files likely touched later:

- Navigation Computer route modes.
- Autopilot surface approach/landing logic.
- Gravity/orbit integration.
- SurfaceLocalFrame transitions.
- Landing pad/outpost approach data.

Tests/evidence needed later:

- Route validation evidence.
- Landing approach PlayMode scenarios.
- Autopilot safety and authority checks.
- Save/load across orbit/surface transition.

Non-goals:

- No gravity assist or slingshot scope unless separately specified.
- No final flight model overhaul hidden in surface work.

Risks:

- This phase touches major systems and must wait for stable local-space autopilot and real-scale architecture.
- Poor transition design can create state bugs between ship, player and surface.

## Cross-Cutting Requirements For Later

- Surface gameplay must preserve singleplayer compatibility.
- Ship, suit, drone and outpost cargo must not become separate incompatible inventories.
- If a tool, route, landing point or extraction is impossible, UI must explain why.
- Background simulation should use events and data state, not unloaded per-frame Unity physics.
- V0 must be small enough to test: landed ship, exit, scan, mine, transfer, return.

## Verification Boundary For This Change

For this spec-only package:

- Run `specs_validate planet-first-person-worldbuilding-v1` if available.
- Run Markdown/path sanity checks.
- Do not run Unity tests.
- Do not run dotnet build unless required by project policy.
