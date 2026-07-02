# Browser Flight UI Screenshot Audit

Scope: all 38 tracked PNG references under `docs/UI-Screenshots/`. The user-specified `ui-screenshots/` folder was absent, so this audit uses the approved tracked source folder. Source screenshots are read-only references and were not modified.

Common visual vocabulary across the set: dark navy/black cockpit base, cool blue panel strokes, cyan/green route/ready accents, amber/red warning accents, compact Inter-like labels/values, restrained frosted panels, and a center viewport reserved for ship/target/route visuals. v1 implements structure and contracts (top/edge/bottom HUD, center-safe area, player/debug split) rather than copying unfinished large map/builder/combat/economy screens.

| # | Screenshot | Visible layout regions | HUD/UI elements | Rough colors / typography / spacing | v1 decision |
| --- | --- | --- | --- | --- | --- |
| 01 | `01-hauptmenue-hangar-startbildschirm.png` | Hangar/menu composition with broad center hero area and side actions. | Start/menu actions, ship context, hangar framing. | Dark base, cool-blue separators, compact labels; larger hero spacing than cockpit. | Deferred: menu/hangar shell is not part of flight HUD foundation. |
| 02 | `02-flug-hud-asteroidenguertel-cruise.png` | Flight viewport with top status, edge ship/nav panels, bottom message/action strip. | Mode, speed/throttle, target/nav, warnings without center obstruction. | Navy glass, cyan borders, green ready state, amber warning chips; tight 6-12px HUD rhythm. | Implement now: primary cruise HUD layout reference. |
| 03 | `03-navigationsplaner-sternenkarte-route.png` | Large star-map planner with route table/side details. | Map route planner, target list, trajectory metadata. | Map-heavy cyan lines over dark field; dense data panels. | Deferred: full map/planner UI; v1 only exposes route preview/target state in edge panel. |
| 04 | `04-schiffsbauer-ausruestung-hangar.png` | Builder/hangar editor with inventory and ship details. | Part slots, equipment list, stats. | Dark card grid with cyan section titles; larger panels. | Deferred: ship builder/equipment UI. |
| 05 | `05-einstellungen-grafik-audio-steuerung.png` | Settings screen with centered option groups. | Graphics/audio/control settings. | Neutral dark panels, blue focus lines, form spacing. | Deferred: settings UI. |
| 06 | `06-ui-konzeptuebersicht-cockpit-navigation-systeme.png` | Concept overview for cockpit/navigation systems; clear central flight space with edge instruments. | Top mode strip, left/right systems panels, bottom action/status band. | Cool-blue outlines, cyan/green state labels, compact uppercase labels. | Implement now: main structural reference for `#hud-top-strip`, edge panels, bottom strip, center-safe area. |
| 07 | `07-kampf-hud-asteroidenfeld-feindkontakt.png` | Combat HUD overlay around asteroid field; center remains tactical viewport. | Target/weapon/warning chrome, alert states. | Red/amber alert accents with same blue cockpit chrome. | Chrome only: warning treatment and edge density; no combat system UI. |
| 08 | `08-stationsmodule-produktion-ausbau-uebersicht.png` | Station module management grid. | Production/build module cards and side details. | Dense management panels, cyan/amber progress accents. | Deferred: station/outpost management. |
| 09 | `09-effekte-vfx-waffen-antriebe-explosionen.png` | VFX showcase over flight scene. | Minimal overlay, focus on thrusters/weapons/explosions. | Dark scene with bright cyan/orange effects; sparse labels. | Deferred for UI; useful reminder to not block ship/VFX center. |
| 10 | `10-autopilot-route-asteroidenfeld.png` | Flight route through asteroid field with route/target HUD. | Autopilot status, route plan, selected target, warnings. | Cyan route strokes, green ready/running state, amber caution chips. | Implement now: right navigation panel and autopilot state reference. |
| 11 | `11-kampf-beute-bergung-nach-gefecht.png` | Post-combat salvage/loot panel over space. | Loot list, recovery actions. | Denser panel stack with amber/green item states. | Deferred: combat/loot/cargo flow. |
| 12 | `12-docking-anflug-raumstation.png` | Docking approach HUD, station in center, guidance around edges. | Docking/nav readouts, distance/target cues. | Blue station guidance, green approach/ready labels, compact distance values. | Implement now for target/distance/nav readout style; docking logic deferred. |
| 13 | `13-raumstation-hangar-markt-handel.png` | Station interior/market panels. | Hangar/market/trade controls. | Dense economy cards, blue borders, amber prices. | Deferred: station/economy UI. |
| 14 | `14-orbit-navigation-planetentransfer.png` | Orbital transfer navigation with planet/route center. | Orbit nav, route status, transfer info. | Dark space, cyan trajectories, compact nav stats. | Implement now for navigation language/chrome; orbit mechanics/UI deferred. |
| 15 | `15-planetenbasis-landeplatz-aussenansicht.png` | Planet base exterior with landing pad framing. | Landing/context overlays. | Dark/surface lighting, cyan location labels. | Deferred: landing/surface runtime. |
| 16 | `16-sternensystem-karte-missionen.png` | System map and mission markers. | Star-system map, mission list. | Large map canvas with side cards; cyan/amber markers. | Deferred: full map/missions. |
| 17 | `17-planet-hesta-uebersicht-landezonen.png` | Planet overview with landing zones. | Planet regions, landing zone list. | Blue/green zone markers over dark planet. | Deferred: planet overview/landing zone UI. |
| 18 | `18-planetenlandung-missionsplanung.png` | Mission planning for landing. | Landing mission cards and route context. | Dense panels, cyan headers, amber constraints. | Deferred: landing/mission planning. |
| 19 | `19-lokale-karte-siedlung-outpost.png` | Local outpost map. | Settlement map, POI panels. | Map grid with blue outlines and green POIs. | Deferred: local map/outpost UI. |
| 20 | `20-auftragstafel-mining-konvoi-mission.png` | Mission board. | Contract/mission list and details. | Card list with amber rewards/green status. | Deferred: mission/economy UI. |
| 21 | `21-frontier-fuel-depot-aussenposten.png` | Fuel depot/outpost context. | Location/fuel service panels. | Industrial dark, amber fuel warnings, cyan labels. | Deferred as depot UI; warning colors inform fuel-warning chips. |
| 22 | `22-ressourcen-scan-asteroidenabbau.png` | Asteroid resource scan overlay. | Resource scan, mining indicators. | Cyan scan lines, amber resource/value callouts. | Deferred: mining/resource scan. |
| 23 | `23-biom-wald-ressourcen-scan.png` | Surface biome scan. | Biome/resource overlay. | Surface palette plus cyan scan chrome. | Deferred: surface resource UI. |
| 24 | `24-frontier-mining-camp-terminal.png` | Mining camp terminal UI. | Terminal panels, operations/status. | Dense dark terminal, green/amber system states. | Deferred: camp terminal/operations. |
| 25 | `25-frachttransfer-inventar-laderaum.png` | Cargo transfer/inventory screen. | Inventory/cargo columns, transfer action. | Dense table spacing, amber quantity/value accents. | Deferred: cargo/inventory UI. |
| 26 | `26-oberflaechenkampf-schuerfposten-verteidigung.png` | Surface combat defense HUD. | Combat alerts, objective/status overlays. | Red/amber alert states over dark/surface scene. | Deferred: surface combat; warning severity color reference only. |
| 27 | `27-drohnenwarnung-konvoi-route.png` | Convoy route with drone warning. | Warning banner/chips, route context. | Amber/red warning accents, still edge-aligned and center-clear. | Implement now for warning placement/chips; drone gameplay deferred. |
| 28 | `28-kallisto-foundry-outpost-management.png` | Outpost management screen. | Production/logistics cards. | Dense management grid with blue/green/amber statuses. | Deferred: outpost management. |
| 29 | `29-logistiknetz-remote-operations.png` | Logistics network screen. | Network map, remote ops list. | Cyan network lines over dark map; compact tables. | Deferred: logistics/remote ops. |
| 30 | `30-hestia-biom-atlas-regionen.png` | Biome atlas/regions. | Atlas panels and region data. | Map/list split with cyan region marks. | Deferred: atlas UI. |
| 31 | `31-aurelia-system-planetenvergleich.png` | System/planet comparison. | Planet comparison panels. | Dark comparative cards, cyan headers, amber metrics. | Deferred: comparison/map UI. |
| 32 | `32-auftragstafel-vertraege-missionsliste.png` | Contracts/mission list. | Contract board with filters/details. | Compact data list, blue separators, amber rewards. | Deferred: mission contract UI. |
| 33 | `33-autopilot-plan-ungueltig-route.png` | Invalid route/autopilot warning state. | Autopilot blocked/invalid route, warning and next action. | Amber/red invalid route accents, concise reason/action text. | Implement now: route invalid/warning labels and action state. |
| 34 | `34-schiffswartung-moduldiagnose.png` | Ship maintenance/diagnostics. | Module health diagnostics. | Diagnostic dark panels, amber/red component warnings. | Deferred: maintenance UI; debug separation reminder. |
| 35 | `35-lava-mond-landschaft-konzept.png` | Landscape concept. | Minimal/no HUD. | Environment-focused, warm lava colors. | Deferred: concept art only; reinforces center viewport priority. |
| 36 | `36-hestia-archipel-landschaft-konzept.png` | Landscape concept. | Minimal/no HUD. | Environment-focused, cooler atmospheric palette. | Deferred: concept art only. |
| 37 | `37-tharos-wuestenlandschaft-surface-guidance.png` | Surface guidance concept. | Surface path/guidance overlays. | Sparse guidance chrome over terrain. | Deferred: surface guidance. |
| 38 | `38-hestia-nebelwald-outpost-konzept.png` | Outpost/landscape concept. | Minimal location/context labels. | Atmospheric dark/green palette, sparse overlays. | Deferred: concept/outpost UI. |

## Implemented-now summary

- Flight HUD/navigation/autopilot/warnings from `02`, `06`, `10`, `12`, `14`, `27`, and `33` inform the v1 edge HUD.
- `#flight-hud` is split into `#hud-top-strip`, `#hud-left-panel`, `#hud-right-panel`, and `#hud-bottom-strip` with `.hud-center-safe-area` keeping the central ship/target/route view clear.
- Player UI shows mode, autopilot, ship status, target/navigation, warnings, route action state, and concise ship visual source. Diagnostic/control-effect/help data remains in `#debug-hud` and TestBridge remains query-gated for evidence only.

## Deferred summary

Full system map, navigation planner, builder, combat, cargo/inventory, station/outpost/economy, surface, drone/logistics, maintenance, and landscape/concept screens are intentionally deferred until their data contracts and runtime slices exist.
