# Planning Consistency Audit - 2026-06-14

Status: audit report only
Repository: `BenjaminHornung/Weltraum-Spiel`
Branch reviewed: `main`
Purpose: find design contradictions, missing links, duplicated concepts, unclear terminology, and recommended next spec slices across the latest planning documents.

This report does not fix source documents. It creates a single follow-up map so the next specs can align ship builder, planet-first-person mode, resources, mining, weapons, factions, economy, drones, navigation, autopilot validation, and roadmap sequencing without changing runtime code, tests, scenes, assets, prefabs, Blender files, or autopilot harness evidence.

## Source Set

Required documents read:

- `docs/legacy-unity/current-prototype-state-2026-06-15.md`
- `README.md`
- `docs/spielkonzept/ship-builder-modular-parts.md`
- `docs/art/blender-modular-ship-parts-guidelines.md`
- `docs/art/blender-mcp-part-generation-prompts.md`
- `docs/spielkonzept/on-planet-first-person-mode.md`
- `docs/spielkonzept/resources-mining-crafting.md`
- `docs/spielkonzept/weapons-combat-progression.md`
- `docs/spielkonzept/worldbuilding-factions-economy.md`
- `docs/spielkonzept/planetary-exploration-loop.md`
- `docs/spielkonzept/planetary-settlements-outposts.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-ship-builder-modular-parts-art-pipeline-v1/proposal.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-ship-builder-modular-parts-art-pipeline-v1/design.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-ship-builder-modular-parts-art-pipeline-v1/tasks.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-ship-builder-modular-parts-art-pipeline-v1/specs/ship-builder-modular-parts/spec.md`
- `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/proposal.md`
- `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/design.md`
- `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/tasks.md`
- `.devtoolbox/specs/changes/planet-first-person-worldbuilding-v1/specs/planet-first-person-mode/spec.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-autopilot-large-local-test-range-v1/proposal.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-autopilot-large-local-test-range-v1/design.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-autopilot-large-local-test-range-v1/tasks.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-autopilot-large-local-test-range-v1/specs/autopilot-large-local-test-range/spec.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-fix-autopilot-exact-point-arrival-v1/proposal.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-fix-autopilot-exact-point-arrival-v1/design.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-fix-autopilot-exact-point-arrival-v1/tasks.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-fix-autopilot-exact-point-arrival-v1/specs/default/spec.md`

Supporting documents sampled for existing conventions:

- `docs/spielkonzept/real-scale-world-architecture.md`
- `docs/spielkonzept/player-map-and-hud.md`
- `docs/spielkonzept/navigation-computer.md`
- `docs/spielkonzept/drones-and-remote-missions.md`
- `docs/spielkonzept/persistence-and-offline-simulation.md`
- `docs/spielkonzept/startsystem.md`
- `docs/spielkonzept/ship-builder-gameplay-ux.md`
- `docs/spielkonzept/ship-builder-mvp-flow.md`
- `.devtoolbox/specs/changes/ship-builder-gameplay-ux-v1/proposal.md`
- `.devtoolbox/specs/changes/ship-builder-gameplay-ux-v1/design.md`
- `.devtoolbox/specs/changes/ship-builder-gameplay-ux-v1/tasks.md`
- `.devtoolbox/specs/changes/ship-builder-gameplay-ux-v1/specs/ship-builder-gameplay-ux/spec.md`
- `docs/spielkonzept/resource-cargo-inventory-model.md`
- `.devtoolbox/specs/changes/resource-cargo-inventory-model-v1/`

## Executive Summary

The new planning package is directionally consistent. The strongest shared design rule is that planet gameplay must reinforce the space loop: surface actions should return as cargo, data, repairs, fuel, ammo, reputation, map discoveries, upgrades, routes, or ship-builder progress. The second strongest rule is that navigation/autopilot must be honest: target points, route previews, authority limits, fuel limits, and exact arrival cannot be blurred into vague success.

No fatal contradiction blocks the planning docs. The main risks are unresolved data contracts. The docs repeatedly mention mass, volume, cargo slots, suit inventory, ship cargo, outpost storage, ownership, legality, faction reputation, resource tiers, tool tiers, and ship-part metadata. A local resource/cargo/inventory draft now sketches much of the needed shared model, but it should be treated as the candidate contract to validate and reconcile, not as fully integrated across all gameplay specs yet. Without that integration, later implementation can easily create parallel inventories, duplicated economy values, or cargo mass that the autopilot cannot understand.

The most urgent follow-up after exact-arrival is not a large content spec. It is a contract-hardening pass: validate the resource/cargo/inventory draft, define surface target descriptors and local frames, and decide which UI owns route/legal/authority messages. The first playable surface slice should wait until those contracts are at least sketched, otherwise the project risks a fun but disconnected surface prototype.

## 1. Terminology Consistency

### Resource vs Cargo vs Storage vs Inventory

Current usage:

| Term | Current meaning across docs | Consistency risk | Recommended canonical rule |
| --- | --- | --- | --- |
| `resource` | A material, sample, artifact, fuel input, ammo input, construction material, or research object. | Sometimes means raw material, sometimes economy commodity, sometimes mission object. | Use `ResourceDefinition` for what it is and `ResourceStack` for a typed quantity with grade, mass, volume, containment, ownership, and legal state. |
| `cargo` | Anything transported by ship, drone, vehicle, outpost port, or sometimes suit. | Could become interchangeable with resource or inventory. | Use `cargo` only when an item/resource is inside a logistics container intended for transfer, hauling, selling, crafting, refining, or mission delivery. |
| `inventory` | Player/suit carried items, tools, samples, ammo, and small resources. | The phrase `suit cargo` appears conceptually, but suit inventory has different constraints than ship cargo. | Use `Inventory` for actor-carried, quick-access, low-volume containers. Treat it as a container type, not a separate item model. |
| `storage` | Persistent ship, outpost, crate, refinery, player-owned, or faction container. | Could duplicate cargo if each storage type gets its own rules. | Use `Storage` for stationary or persistent container endpoints with owner/access/service rules. Storage can contain cargo stacks. |
| `capacity` | Cargo slots, mass, volume, tonnes, fuel units, or UI carrying limits depending on file. | High conflict risk when cargo mass must affect ship physics/autopilot. | Canonical capacity should be mass in kg and volume in cubic meters. UI slots can be a derived simplification for early prototype screens. |

Finding: the documents agree that logistics matter, but they do not yet define one container model. This affects mining, ship builder, drones, outposts, save/load, economy, and autopilot fuel/brake estimates.

Current draft note: `docs/spielkonzept/resource-cargo-inventory-model.md` already defines a promising shared vocabulary around stable resource IDs, resource categories, mass per unit, volume per unit, stack rules, legal status, ownership implications, containers, transfer commands, and ship cargo mass queries. This draft should be reconciled into the main planning sequence before runtime work depends on cargo, mining, ship-builder costs, or economy values.

Recommended follow-up: validate and reconcile `resource-cargo-inventory-model-v1` as the canonical resource/cargo/inventory contract.

### Module vs Part vs Hardpoint vs Socket

Current usage:

| Term | Current meaning across docs | Consistency risk | Recommended canonical rule |
| --- | --- | --- | --- |
| `part` | Catalog entry such as cockpit, RCS block, cargo block, turret, fuel tank, utility piece. | Sometimes overlaps with module. | Use `part` for a buildable catalog definition and `part instance` for one placed item on a ship. |
| `module` | Sometimes a physical ship piece, sometimes a runtime system unit, sometimes a future gameplay package. | Can become a synonym for part and blur catalog vs runtime system. | Use `module` only when the part has active gameplay behavior or belongs to a runtime system such as fuel, RCS, cargo, weapon, sensor, or utility. |
| `hardpoint` | A structural mount/socket in ship builder docs; also appears in `Landing/maintenance hardpoint`; runtime has `PrototypeShipHardpoint`. | Could mean generic connector, weapon mount, landing support, or gameplay service point. | Reserve `Hardpoint` for builder attachment semantics. Name the utility catalog item `LandingMaintenanceMount` or similar in a later catalog cleanup. |
| `socket` | A named Blender/Unity marker such as `SOCKET_THR_MAIN_AFT_01`, compatibility alias, or gameplay attach point. | Multiple formats coexist: primary markers, compatibility names, runtime names, `CONN_*`, `RCS_Nozzle_*`, `RCS_NOZZLE_*`. | Use `SocketMarker` for scene/object markers and `SocketAlias` for importer compatibility names. Maintain one explicit alias table. |
| `connector` | Structural link point, docking connector, or `SOCKET_CONN_*` marker. | Docking connector and builder connector can diverge. | Use `ConnectorSocket` for builder attachment; use `DockingPort` or `DockingConnectorPart` for docking gameplay. |

Finding: the ship-builder docs are precise, but they intentionally support legacy/current compatibility names. That is useful short term, but it requires an alias contract before artists or importers create new assets.

Additional note: the Ship Builder Gameplay UX planning docs add a player-facing builder loop with hangar entry, debug entry, edit/test-flight separation, validation rows, stats panel, and a `0.5 m` player-facing snap grid. That reinforces the modular art-pipeline conventions, but it also increases the need for stable metadata because builder stats must not come from final mesh details.

Recommended follow-up: `ship-part-socket-alias-and-metadata-contract-v1`.

### Waypoint vs Target Point vs Landing Zone

Current usage:

| Term | Current meaning across docs | Consistency risk | Recommended canonical rule |
| --- | --- | --- | --- |
| `waypoint` | Current prototype target marker selected by `Tab`/`B`, used by waypoint autopilot. | Sounds like a loose navigation marker, but exact-arrival specs require point precision. | Use `waypoint` for a player/map marker that can resolve to one or more target descriptors. |
| `target point` | Exact point the autopilot must reach, especially for point-arrival validation. | Can conflict with surface `landing zone` language if the zone is treated as enough for arrival. | Use `target point` only for a precise coordinate/state with explicit arrival tolerance and hold criteria. |
| `landing zone` | Surface area, outpost pad, dropship point, safe approach area, or map site. | A zone is not the same as an exact autopilot completion target. | A `LandingZone` should resolve to a `LandingTargetPoint` or `ApproachTargetPoint` before autopilot executes. |
| `site` | Resource field, cave, outpost, wreck, anomaly, camp, biome, or activity marker. | A site can be large and procedural, while navigation needs points. | Use `SurfaceSite` for activity/location metadata and expose one or more `SiteTargetPoint` entries for navigation, landing, pickup, drone pathing, and map markers. |
| `pickup point` | Future surface return/drop location. | Can be player body, drone, cargo, or ship retrieval point. | Model it as a target descriptor with actor, cargo, and permission requirements. |

Finding: the docs are philosophically aligned: routes must be readable and targets must be clear. The gap is a formal target taxonomy that preserves exact arrival while allowing surface activities to be zones.

Recommended follow-up: `surface-target-descriptor-and-map-handoff-v1`.

### Faction Ownership vs Legality vs Reputation

Current usage:

| Term | Current meaning across docs | Consistency risk | Recommended canonical rule |
| --- | --- | --- | --- |
| `ownership` | Who owns a resource node, crate, outpost, wreck, drone, claim, pad, or cargo. | Ownership can be unknown, obsolete, contested, or illegal to act on. | Store `ownerId`, `ownerType`, and `ownershipConfidence` separately from legal permissions. |
| `legality` | Whether mining, salvage, weapons, landing, cargo, or access is allowed. | Legal state may be inferred ad hoc from owner/faction. | Store `legalState` or `actionPermission` per action, not just per object. |
| `claim` | Mining/resource control, claim beacon, faction territory, or player right. | Claim status can overlap with owner. | Use `claimState` for resource rights and territory rules; it can point to owner/faction/license. |
| `reputation` | Standing that affects prices, missions, hostility, docking, inspections, and access. | Could become one number too early and lose action-specific consequences. | Define `FactionStanding` plus event-based reputation changes. Keep V0 simple, but preserve event reasons. |
| `license/permit` | Mining, sample, weapon, landing, or salvage permission. | Multiple permit types likely need separate rules. | Treat licenses as inventory/account permissions with issuer, scope, expiry, and covered actions. |

Finding: the faction/economy docs are rich and consistent as worldbuilding, but they need a small legal-state model before scanner, outpost, mission, and cargo UI can be fair.

Recommended follow-up: `faction-reputation-legality-rules-v1`.

## 2. Cross-System Integration Gaps

### Mining Resources -> Ship Parts

Evidence:

- Resource docs say raw ores, salvage parts, electronics, exotics, construction materials, and ammo materials feed ship builder, repairs, fuel, weapons, upgrades, economy, and exploration.
- Ship-builder docs define part IDs, categories, planned stats, mass tiers, fuel units, cargo slots, sockets, markers, metadata fields, and 32 v0 part variants.
- Worldbuilding docs say factions specialize in ship parts, resources, and market restrictions.

Gap:

There is no recipe or unlock bridge from `ResourceDefinition` to `ShipPartDefinition`. The ship builder has categories and planned stats, but not required materials, blueprint sources, faction locks, research unlocks, or economy cost inputs.

Risk:

Implementation could create a ship builder catalog first and a resource economy later, forcing either duplicate balancing or retrofitted recipes.

Recommended spec:

`ship-builder-economy-and-unlock-progression-v1`

Minimum questions:

- Which resources unlock or fabricate each v0 ship part category?
- Which parts are buy-only, craftable, salvageable, faction-licensed, or research-locked?
- Are ship parts discrete items, build recipes, or service installations?
- How do cargo mass, installed part mass, and inventory parts differ?

### Ship Builder UX -> Part Metadata, Validation, And Test Flight

Evidence:

- Ship Builder Gameplay UX docs define hangar/debug entry, edit mode, test flight mode, ghost placement, `0.5 m` snap, yaw rotation, mirror mode, validation errors/warnings, and stats panels.
- Ship Builder MVP Flow docs define a full loop from open builder through save draft, test flight, return, named variant, and active ship selection.
- Modular parts docs define sockets, markers, part categories, and metadata-only planned stats.

Gap:

The UX docs expect stats such as dry mass, fuel mass, cargo capacity, loaded mass, thrust, acceleration, RCS authority, delta-v, cargo volume, weapon count, COM/thrust offset, and validity. The modular parts docs provide planned stats and marker contracts, but the shared metadata schema that connects part definitions, player-visible stats, builder validation, test-flight spawn, and future resource costs is not yet frozen.

Risk:

Builder implementation could compute some values from blueprint metadata, some from part catalog docs, some from current runtime components, and some from visual bounds. That would violate the UX design rule that gameplay stats come from gameplay metadata, not final art or helper objects.

Recommended specs:

- `ship-builder-gameplay-metadata-contract-v1`
- `ship-builder-economy-and-unlock-progression-v1`

Minimum questions:

- Which part metadata fields are required for MVP validation and stats?
- Which fields are art/import metadata only?
- How does a valid draft become a test-flight instance without mutating the active ship?
- Which future resource/cost fields can be placeholder-only in MVP?
- How do builder warnings map to runtime flight authority warnings?

### Cargo Mass -> Ship Physics And Autopilot

Evidence:

- Current prototype uses fuel mass in kg and generated ship parts affect mass/COM/fuel/thrust/RCS.
- Resource docs explicitly say cargo mass changes fuel estimates, brake reserve, and route validity.
- Autopilot exact-arrival docs require authority-limited outcomes instead of false success.
- Navigation Computer inputs include current ship mass, fuel mass, thrust capabilities, and RCS capabilities.

Gap:

There is no single cargo mass source that updates ship mass, COM, autopilot estimates, fuel reserve, brake reserve, RCS authority, or UI warnings.

Risk:

A mining/cargo loop could appear to work while the autopilot still plans against old ship mass. That would directly conflict with exact-arrival and authority honesty.

Recommended spec:

`ship-cargo-mass-authority-integration-v1`

Minimum questions:

- Which cargo containers contribute to `currentMassKg`?
- Does cargo distribution affect COM or only total mass in V0?
- How do volatile tanks, outpost transfers, drone cargo, and temporary containers update route plans?
- Which UI warning owns "cargo too heavy for exact arrival"?

### On-Foot Inventory -> Ship Cargo

Evidence:

- Planet docs require suit inventory with mass/volume limits and transfer to ship, drone, vehicle, outpost, or deployable container.
- Planet spec requires resources transferred to ship cargo keep type, quantity, mass/volume, and legal/ownership state.
- Persistence docs already have `CargoState` on ships/drones.

Gap:

The transfer endpoint model is not defined. The docs do not yet say whether suit inventory, drone cargo, ship cargo, outpost storage, cargo crates, and mission containers share one schema.

Risk:

V0 may accidentally implement suit inventory as a one-off list that cannot transfer cleanly into ship cargo or save/load.

Recommended spec:

`player-ship-drone-cargo-transfer-v1`

Minimum questions:

- What is the minimum shared stack/container schema?
- Which transfers require cargo ports, sealed storage, legal checks, fees, or hold-to-confirm?
- How are partial stacks, hazardous cargo, and mission items represented?
- What happens if transfer fails because of mass, volume, ownership, or containment?

### Outposts -> Missions And Economy

Evidence:

- Settlement docs define terminals, service roles, cargo ports, markets, repair/refit, mission boards, faction ownership, landing pads, and storage.
- Exploration docs use outposts as repeatable activity anchors.
- Worldbuilding docs define economy hooks and faction mission types.

Gap:

There is no mission/contract framework or settlement service data model. "Mission board", "simple job", "cargo contract", "license office", "trade terminal", and "service terminal" all appear, but their shared data shape is missing.

Risk:

Outposts could become disconnected UI islands, with trade, missions, repairs, licenses, and cargo each implemented differently.

Recommended specs:

- `settlement-service-model-v1`
- `mission-contract-framework-v1`

Minimum questions:

- What service types exist in V0?
- What is the shared transaction model for buy, sell, refuel, repair, license, storage, and mission accept?
- How does a contract reference cargo, target descriptors, faction reputation, reward, deadline, legality, and route risk?

### Factions -> World Locations

Evidence:

- Faction docs define motivation, visual identity, valued resources, ships/equipment style, relation to player, mission types, hostility, and locations created.
- Exploration docs classify activity types and procedural vs hand-authored suitability.
- Settlement docs define outpost types and ownership.

Gap:

There is no placement or location ownership contract. The docs say factions create locations, but not how a generated site chooses owner, services, restrictions, hostility, market values, legal rules, or defense behavior.

Risk:

Procedural locations may feel arbitrary or use faction labels only as decoration.

Recommended spec:

`faction-location-placement-and-ownership-v1`

Minimum questions:

- Which faction can own which activity/outpost type?
- Which services, defenses, resources, and legal states are implied by owner and location?
- How does ownership become unknown, obsolete, contested, protected, pirate-hidden, or player-owned?

### Surface Targets -> Navigation, Autopilot, And Map

Evidence:

- Surface docs use map/HUD marks, landing zones, outpost pads, dropship points, safe landing markers, pickup points, and surface sites.
- Navigation docs already use `TargetDescriptor`, route modes, and surface approach as future route mode.
- Real-scale docs define `SurfaceLocalFrame`.
- Exact-arrival specs require strict point completion.

Gap:

There is no `SurfaceTargetDescriptor` or route handoff rule that turns a broad site/zone into exact approach, landing, pickup, drone, or cargo target points.

Risk:

Surface landing could unintentionally reintroduce vague arrival radius behavior after exact-arrival is fixed.

Recommended spec:

`surface-target-descriptor-and-map-handoff-v1`

Minimum questions:

- How does a map site expose safe landing, approach, cargo, pickup, and scan points?
- Which target types require exact arrival, area entry, or player confirmation?
- How do map icons, ship HUD, on-foot HUD, scanner, and Navigation Computer share target state?
- How are unsafe landing reasons represented?

### Drones -> Mining And Surface Logistics

Evidence:

- Drone docs define drone roles, `DroneState`, `RemoteMission`, mission steps, risk policy, return policy, cargo, autonomy, and background behavior.
- Planet docs require scout, mining, cargo, repair, vehicle/remote-control, and deployed-drone surface use.
- Persistence docs already expect background drones and event-based simulation.

Gap:

The drone model is mostly space/asteroid oriented. Surface mining, surface pathing, cargo shuttle behavior, local surface frames, remote-control handoff, and unloaded surface operations are not yet unified with `RemoteMission`.

Risk:

Surface drones may be implemented as separate AI helpers instead of mission-capable drones that share navigation, cargo, risk, and persistence rules.

Recommended spec:

`surface-drone-logistics-and-background-simulation-v1`

Minimum questions:

- Does a surface drone use `SurfaceLocalFrame`, absolute state, or both?
- How does a drone move between ship cargo port, node, outpost storage, and player?
- What mission steps are needed for scan, mine, haul, guard, repair, recall, and lost-link?
- Which events persist when the player leaves the area?

## 3. Contradictions Or Likely Future Conflicts

### Coordinate Conventions

Conflict risk:

Ship-builder art uses `+Z` forward, `+Y` up, `+X` right. RCS markers use axis names such as `POS_X` and `NEG_X`. Real-scale docs introduce `SurfaceLocalFrame` for planet terrain, landing points, bases, and rovers. A walking player on a curved planet needs surface-up, north/east/tangent, gravity-down, and local chunk coordinates.

Why it matters:

Ship parts, landing gear, surface placement, player camera, drones, map markers, and autopilot targets will all cross coordinate frames. If "up" means ship local +Y in one place and terrain normal in another, landing, cargo ports, hardpoints, and surface drones can silently rotate wrong.

Recommendation:

Create `surface-local-frame-architecture-v1` before any serious surface implementation. It should define:

- absolute state to surface frame projection,
- local tangent axes,
- gravity/up direction,
- conversion between ship local axes and landed ship frame,
- how landing pads and cargo ports expose target points,
- how floating-origin shifts preserve saved absolute state.

### Socket Naming

Conflict risk:

The planning docs intentionally mix primary socket markers, compatibility aliases, runtime names, and historical names:

- `SOCKET_<FUNCTION>_<SIDE_OR_AXIS>_<NN>`
- `SOCKET_<SocketType>_<Direction>_<Role>`
- `SOCKET_THR_MAIN_AFT_01`
- `SOCKET_Hardpoint_Back_ConnectorNormal`
- `SOCKET_CONN_FRONT_01`
- `CONN_*`
- `RCS_Nozzle_<PodId>_<Direction>`
- `RCS_NOZZLE_*`
- `THRUST_NOZZLE_MAIN*`
- `WEAPON_MUZZLE_PRIMARY`

Why it matters:

This is acceptable as transition planning, but unsafe as an implementation contract unless one parser owns canonical and alias formats.

Recommendation:

Create `ship-part-socket-alias-and-metadata-contract-v1` before asset generation or import work. It should include:

- canonical marker naming,
- compatibility aliases,
- case sensitivity,
- direction alias mapping (`Forward`, `Front`, `AFT`, `Back`),
- role mapping,
- failure mode for ambiguous or duplicate markers,
- how cargo volume helpers relate to `SOCKET_Volume_Cargo_*` and `HELPER_CARGO_VOLUME_*`.

### Cargo Capacity Units

Conflict risk:

Cargo appears as slots, kg, tonnes, volume boxes, mass/volume, fuel units, fuel mass kg, ammo materials, and storage fees. Current ship physics already uses kg for fuel and mass. Ship builder planning uses cargo slots plus empty/full tonnes. Surface docs require mass and volume. Economy docs use commodity value.

Why it matters:

Autopilot, ship builder, drones, suit movement, outpost storage, and economy all need compatible logistics.

Recommendation:

Use SI units as authoritative:

- mass in kg,
- volume in cubic meters,
- fuel in kg or a named propellant unit that converts to kg,
- UI slots only as derived display/capacity simplification.

Resolve in `resource-cargo-inventory-model-v1`.

### Resource Tiers

Conflict risk:

Resources use tool tiers (`Tier 1` to `Tier 4`), progression roles (`early`, `mid`, `late`), part mass tiers (`Light`, `Medium`, `Heavy`), faction locks, legal permissions, and future research unlocks. These are all useful but currently separate.

Why it matters:

Players need to understand why a node, part, tool, or weapon is unavailable. Designers need one way to express progression without a pile of overlapping "tier" labels.

Recommendation:

Define separate axes:

- `ToolTier` for extraction capability,
- `TechTier` for blueprint/system complexity,
- `MassTier` for ship-building balance,
- `RarityGrade` for economy and generation,
- `LegalAccess` for permits and faction rights.

### Weapon Ammo And Material Costs

Conflict risk:

Weapon docs define resource categories and consequences, but not stack units, recipe costs, heat/capacitor units, ship-vs-foot ammo compatibility, or whether ship turrets use the same ammo categories. README documents projectile speed, mass, recoil, and current ship weapons.

Why it matters:

Ammo is one of the clearest bridges between mining, crafting, combat, cargo, economy, ship weapons, and factions. If foot weapons and ship weapons diverge too early, the economy loses coherence.

Recommendation:

Create `weapon-ammo-material-taxonomy-v1` after the resource/cargo model. It should define:

- ammo stack types,
- ballistic, laser/capacitor, EMP, coil/rail, explosive, and tool durability resources,
- foot-vs-ship weapon relation,
- crafting/refill stations,
- heat/coolant constraints,
- legal restrictions.

### UI Authority Between Ship HUD, Map, And On-Foot HUD

Conflict risk:

Ship HUD, Navigation Panel, System Map, Local Map, drone console, alert feed, scanner, settlement terminal, and suit HUD all need to show route, risk, fuel, ETA, cargo, legality, ownership, authority, and warnings. Several docs correctly say UI must explain why an action is blocked, but not which system owns each truth.

Why it matters:

Conflicting UI sources are a fast path to player confusion. For example, a scanner might say a node is legal, a settlement terminal might reject the cargo, and the ship HUD might still plan a route that cannot brake with the loaded mass.

Recommendation:

Create `player-facing-status-authority-v1`. It should define:

- Navigation Computer owns route/fuel/arrival/authority validity.
- Scanner owns local detection confidence and observed hazard/ownership data.
- Faction/legal service owns license, permit, and enforcement result.
- Cargo service owns transfer feasibility and containment state.
- HUD/map/suit displays are views, not independent truth sources.

### Scope Conflicts With Autopilot Exact-Arrival Work

Conflict risk:

Planet docs use landing zones, safe landing markers, surface sites, pickup points, outposts, and drones. Autopilot exact-arrival docs demand precise point arrival and explicit limited/no-authority states. Large local range docs are blocked until exact-arrival passes. Surface integration and gravity/orbit/landing are Phase 10 future scope in the planet package.

Why it matters:

Landing and surface pickup can accidentally become a loophole that says "close enough to the zone" after exact-arrival has been fixed.

Recommendation:

Keep these terms separate:

- `SurfaceSite`: activity area.
- `LandingZone`: evaluated safe area.
- `LandingTargetPoint`: exact point selected inside a zone for final approach/touchdown.
- `PickupTargetPoint`: exact rendezvous/cargo/player retrieval point.
- `ArrivalEnvelope`: visible tolerance and velocity/attitude gates for the selected target type.

No surface landing implementation should start until exact-arrival has a passing baseline and the target descriptor spec exists.

## 4. Duplicated Concepts To Consolidate

### Route Preview And Autopilot Status

Duplicated across:

- README/current prototype state,
- Navigation Computer docs,
- Player Map and HUD docs,
- autopilot exact-arrival and large-local-range specs,
- planet exploration docs for landing/approach.

Consolidation target:

`navigation-route-preview-and-status-contract-v1`

Keep one source of truth for route segment labels, ETA, fuel, brake reserve, authority warnings, risk labels, replan reasons, obstacle/reacquire state, and target arrival status.

### Cargo Transfer

Duplicated across:

- on-planet first-person loop,
- resource mining loop,
- settlements/outposts cargo transfer,
- drone roles,
- persistence state,
- ship-builder cargo modules.

Consolidation target:

`resource-cargo-inventory-model-v1` plus `player-ship-drone-cargo-transfer-v1`.

### Faction Ownership And Legal Labels

Duplicated across:

- resources/mining,
- weapons/combat,
- worldbuilding/economy,
- settlements/outposts,
- exploration activities.

Consolidation target:

`faction-reputation-legality-rules-v1`.

### Surface Activities And Settlement Services

Duplicated across:

- planetary exploration activity table,
- settlement/outpost type table,
- worldbuilding faction location table,
- economy hooks.

Consolidation target:

`settlement-service-model-v1` and `faction-location-placement-and-ownership-v1`.

### Drones As Space Objects And Surface Helpers

Duplicated across:

- drones/remote mission docs,
- on-planet mode,
- resources/mining,
- exploration loop,
- outpost storage/service docs.

Consolidation target:

`surface-drone-logistics-and-background-simulation-v1`.

## 5. Missing Required Follow-Up Specs

### 1. `resource-cargo-inventory-model-v1`

Purpose:

Promote, validate, and reconcile the emerging shared data contract for resources, cargo stacks, inventories, storage, containers, containment, mass, volume, ownership, legal state, value, and persistence.

Why required:

This is the highest-leverage contract. A draft already exists in the workspace, and it should become the canonical base before mining, cargo transfer, drone cargo, ship cargo mass, outpost storage, economy, ammo, crafting, or ship builder recipes are implemented.

Minimum output:

- `ResourceDefinition`
- `ResourceStack`
- `ContainerState`
- `CargoState`
- `InventoryState`
- mass/volume/slot display rules
- ownership/legal fields
- containment/hazard fields
- transfer failure reasons

### 2. `ship-builder-gameplay-metadata-contract-v1`

Purpose:

Define the metadata fields that feed builder palette cards, validation, stats, warnings, test-flight spawn, save variants, active ship selection, and future cost/lock placeholders.

Why required:

The ship-builder UX docs correctly require player-facing stats and validation to come from gameplay metadata rather than mesh details. That metadata bridge should be frozen before runtime builder UI starts.

Minimum output:

- part definition fields required for MVP,
- part instance fields required for placement,
- validation input fields,
- stats aggregation fields,
- art-only vs gameplay metadata separation,
- test-flight instance handoff fields,
- future resource/cost/license placeholder fields.

### 3. `ship-cargo-mass-authority-integration-v1`

Purpose:

Define how cargo mass affects ship physics, autopilot estimates, brake reserve, fuel reserve, RCS authority, COM simplification, UI warnings, and save/load.

Why required:

Exact-arrival and authority honesty depend on true mass. Mining and cargo without flight consequences would undermine the space loop.

### 4. `surface-target-descriptor-and-map-handoff-v1`

Purpose:

Define surface sites, landing zones, landing target points, pickup points, cargo ports, outpost pads, map discovery states, scanner states, and Navigation Computer `TargetDescriptor` handoff.

Why required:

This protects exact-arrival semantics while enabling map/HUD/surface planning.

### 5. `surface-local-frame-architecture-v1`

Purpose:

Define `SurfaceLocalFrame` data, transforms, landing frame, surface up/tangent axes, chunk origin, floating-origin behavior, saved absolute state, and player/ship/drone conversion rules.

Why required:

Surface play, landing, cargo transfer, drones, vehicles, and outposts need consistent coordinate behavior before implementation.

### 6. `player-ship-drone-state-handoff-v1`

Purpose:

Define entering/exiting ship, entering/exiting drones/vehicles, remote control, return-to-body behavior, save/load reconstruction, failure recovery, and UI state ownership.

Why required:

The first playable planet loop depends on clean handoff between cockpit, first-person body, drone, vehicle, and cargo interaction.

### 7. `ship-builder-economy-and-unlock-progression-v1`

Purpose:

Map resource categories, refined materials, salvage, electronics, exotics, faction styles, blueprints, recipes, unlocks, and market costs to ship-builder parts.

Why required:

Ship builder planning currently has strong part metadata, but resources/economy do not yet drive part availability.

### 8. `mission-contract-framework-v1`

Purpose:

Define contracts for delivery, mining, salvage, scan, bounty, repair, rescue, escort, illegal cargo, faction jobs, and mission-generated target descriptors.

Why required:

Outposts and factions need jobs before economy and exploration can produce repeatable purpose.

### 9. `settlement-service-model-v1`

Purpose:

Define service terminals, cargo ports, refuel, repair, refit, market, mission board, storage, license office, drone services, defense, owner, access, fees, and persistence.

Why required:

Settlement docs are clear at concept level but need V0 service data before any terminal UI or outpost implementation.

### 10. `faction-reputation-legality-rules-v1`

Purpose:

Define ownership, claims, licenses, permits, reputation changes, hostility thresholds, inspections, contraband, black market, salvage legality, protected biomes, and enforcement escalation.

Why required:

Legality and reputation are repeatedly referenced as gameplay levers. They need predictable rules before scanner/outpost/combat warnings are trusted.

### 11. `surface-drone-logistics-and-background-simulation-v1`

Purpose:

Define surface drone mission steps, surface navigation targets, mining/hauling loops, local frame handling, risk policies, lost link behavior, cargo transfer, and unloaded event simulation.

Why required:

Drones are a core bridge between surface and space loops. They should not become one-off surface companions.

### 12. `weapon-ammo-material-taxonomy-v1`

Purpose:

Define on-foot and ship weapon ammo/resource costs, heat/capacitor/coolant concepts, tool durability, crafting inputs, legal restrictions, and relation to ship weapon technology.

Why required:

Weapons are explicitly tied to resources, mining, crafting, economy, cargo, and factions, but the cost model is not yet actionable.

### 13. `ship-part-socket-alias-and-metadata-contract-v1`

Purpose:

Finalize canonical socket/marker naming, alias mapping, direction roles, case sensitivity, required failure behavior, cargo volume helpers, and transition compatibility with existing imported ships.

Why required:

The art pipeline is precise but intentionally transitional. Asset generation should not start at scale until the aliases are frozen.

## 6. Recommended Next Order

This order assumes the current autopilot harness/exact-arrival work finishes first and passes with fresh evidence.

1. Complete `fix-autopilot-exact-point-arrival-v1`.
   - Exact target completion must pass the proving-ground harness.
   - Direct no-obstacle, lateral/off-axis, obstacle corridor, low-RCS, and no-RCS negative scenarios must have fresh evidence.
   - Do not relax target thresholds.

2. Run a small HUD/control authority cleanup.
   - Align ship HUD, map, and Navigation Computer warning ownership for `NO TARGET`, `NO AUTHORITY`, `FUEL INSUFFICIENT`, `LIMITED RCS`, `HOLDING`, stale plan, and manual override states.
   - This keeps player-facing status honest before more systems depend on it.

3. Implement or prepare `autopilot-large-local-test-range-v1`.
   - Keep it additive and separate from the current proving-ground harness.
   - Validate 1km, 5km, 10km, lateral-start, obstacle-corridor, return-to-origin, Floating Origin readiness, and UI readability.
   - This should happen before surface navigation relies on kilometer-scale targets.

4. Spec `surface-target-descriptor-and-map-handoff-v1`.
   - Define site vs zone vs exact target point.
   - Connect System Map, Local Map, ship HUD, scanner, outpost pad, cargo port, drone target, and Navigation Computer.

5. Spec `surface-local-frame-architecture-v1`.
   - Define transforms and frame handoffs before first-person, landing, rover, drone, or outpost implementation.

6. Validate and reconcile `resource-cargo-inventory-model-v1`.
   - Promote the draft into the canonical resource stack, container, mass/volume, legal/ownership, storage, transfer, and persistence contract.

7. Spec `ship-cargo-mass-authority-integration-v1`.
   - Make cargo mass feed ship physics, fuel/brake estimates, RCS authority, and route validity.
   - This should happen before profitable mining or heavy cargo modules are treated as gameplay-complete.

8. Spec `ship-builder-gameplay-metadata-contract-v1`.
   - Freeze the metadata fields that drive builder validation, stats, warnings, test flight, save variants, and future cost placeholders.
   - Keep gameplay stats independent from final mesh details.

9. Spec `player-ship-drone-state-handoff-v1`.
   - Define cockpit to first-person, first-person to drone/vehicle, remote-control, return-to-body, save/load, and failure states.

10. Build the minimum isolated surface slice.
   - Landed ship or test ship in isolated surface test range.
   - Exit/enter.
   - First-person controller.
   - Suit HUD placeholder.
   - Scanner.
   - One resource node.
   - Hand mining tool.
   - Suit inventory to ship cargo transfer.
   - Return-to-ship completion.

11. Add ship-builder economy and unlock progression.
    - Use the resource/cargo model and ship-part metadata.
    - Define part recipes, blueprints, salvage, faction locks, and market costs before broad catalog implementation.

12. Add one basic combat slice only after the surface logistics loop works.
    - Mining cutter as weak weapon.
    - One simple sidearm or rifle.
    - One enemy drone.
    - Ammo/energy/damage feedback.
    - Keep ship weapons from solving the site trivially.

13. Add outpost services, mission contracts, and faction legality.
    - Start with terminal services, owner label, buy/sell/refuel/storage, one simple job, and visible legal state.
    - Then layer reputation and black-market behavior.

14. Add surface drone logistics.
    - Scout, mine, haul, recall, lost-link, and background events should extend the existing `RemoteMission` model.

15. Defer larger planet, procedural placement, full economy, gravity/orbit/landing integration, and gravity-assist research until the above slices are stable.
    - This matches the planet-first-person phase plan and the current roadmap warning not to mix gravity/orbital/slingshot work into exact local arrival.

## 7. Audit Conclusion

The planning docs are coherent in intent: Weltraum-Spiel should remain a space game where ships, drones, cargo, navigation, resources, factions, and surface play reinforce one another. The current risk is not a lack of ideas. It is that several docs now point at the same future systems from different angles without one shared data contract.

The safest next design move is to freeze terminology and data handoffs before building more runtime features. Exact arrival should remain the active autopilot priority. After it is green, the project should protect target semantics, cargo mass, resource stacks, and frame handoffs before expanding into first-person planet content, ship-builder economy, outposts, drones, or large-scale surface placement.
