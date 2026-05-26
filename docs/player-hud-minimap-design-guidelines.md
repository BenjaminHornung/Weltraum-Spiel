# Player HUD Minimap Design Guidelines

Date: 2026-05-25

Purpose: keep the compact radar and Navigation Planner map readable in real gameplay. The current failure mode is not missing data alone; it is too much undifferentiated data, weak route hierarchy, and no player-controlled zoom/range.

## Source Notes

- UXPin's 2026 game UX guide frames HUD work as a balance between information density and visual clarity. It explicitly calls out prioritization, readability, and customization as HUD design concerns.
- Accessible Game Design's HUD guidance recommends clear at-a-glance UI and, when full HUD customization is too costly, at least scalable HUD elements.
- MinimapTools documents minimaps as a composition of UI element, world bounds, scale, background, and moving icons. It also distinguishes fixed-size icons from icons that scale with the map.
- MinimapTools' design notes describe minimaps as high-level world/player-position views, and note that player-centered zoomed maps can make local features easier to read.
- Game UI Database is a useful reference source for comparing how shipped games handle minimap density, icon priority, and map placement across genres.

References:

- https://www.uxpin.com/studio/blog/game-ux/
- https://accessiblegamedesign.com/guidelines/HUD.html
- https://nickmaltbie.com/MinimapTools/docs/manual/code-design.html
- https://nickmaltbie.com/MinimapTools/docs/manual/minimap-design.html
- https://gamefromscratch.com/the-game-ui-database/

## Decisions For Weltraum Spiel

1. Minimap is a glance tool, not a database.
   - The compact HUD radar should answer: where is my selected target, what direction is the route, what immediate hazards matter, and what range am I viewing?
   - It should not try to show every possible station, combat target, objective, docking target, obstacle, and waypoint at equal visual weight.

2. Add explicit range control.
   - Required modes: `Auto`, `250 m`, `1 km`, `2.5 km`, `5 km`.
   - The current range must be visible in the map label.
   - The player must be able to cycle range from the compact HUD and planner map.
   - `Auto` should prioritize selected/actionable contacts, not far generic contacts.
   - Manual range should persist until changed or until the HUD instance is rebuilt.

3. Separate compact radar and planner map behavior.
   - Compact radar: low detail, local orientation, selected target, selected route, urgent hazards, active combat/objective contacts.
   - Planner map: larger, route-first, target-selection context, fewer generic contacts, route/preview/decel/avoidance visual hierarchy.
   - Do not reuse a full "draw all blips" pass for the planner map without filtering.

4. Layer priority.
   - Highest: ship center, heading, selected navigation target, route line.
   - High: trajectory/deceleration preview, avoidance waypoint, active combat target, mission objective.
   - Medium: nearby hazards, docking target only in docking context.
   - Low: generic waypoints, generic combat targets, environment points.
   - Generic low-priority contacts should be hidden, faded, clustered, or capped before they compete with selected route information.

5. Visual budget.
   - Compact radar should keep generic contacts to a small cap after priority sorting; selected/actionable contacts always survive.
   - No labels inside the compact radar except range/contact summary and possibly selected target distance.
   - Icons should be fixed pixel size across zoom modes so zoom changes distance mapping, not icon legibility.
   - Route and selected target must draw above generic contacts.
   - Off-range selected/actionable contacts should use edge indicators rather than disappear silently.

6. Route/readability rules.
   - If a nav target is selected and no multi-point predicted route exists, show a direct route rather than "no plan".
   - Planned route, direct route, avoidance route, trajectory preview, and decel burn must be visually distinct.
   - `Truncated` is not player-facing error text; translate it to "preview shortened" or show point counts.
   - Planner body text should be concise and never contradict the map label.

7. Responsive rules.
   - Map size and font size must be stable across 4:3, 16:9, ultrawide, and portrait-ish test viewports.
   - Text must not overlap buttons, map, or bottom bar.
   - The planner map should grow before body text gets dense; if space is tight, body detail should reduce.

8. Verification requirements.
   - Screenshot evidence: compact radar at 1280x720, planner map at 1280x720, 1024x768, 2560x1080, and a tall/narrow viewport.
   - Test states: no target, selected nav target/direct route, planned route, avoidance route, combat target, arena/objective contacts, manual zoom range.
   - Assertions should cover route point presence, range label, blip filtering/caps, selected target priority, and no old IMGUI minimap path.

## Immediate Backlog

1. Add manual minimap range mode state and controls.
2. Filter compact radar generic contacts by priority and range.
3. Make planner map route-first and selected-target-first.
4. Distinguish route, trajectory preview, avoidance, and decel burn visually.
5. Add screenshot/test matrix for zoom modes and planner clutter.
