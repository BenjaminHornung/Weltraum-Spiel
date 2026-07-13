# UI Performance

## Requirements

### Requirement: Normal Play Mode UI stays lightweight

The prototype IMGUI UI SHALL keep the default Flight Test preset responsive by avoiding unnecessary work during `OnGUI()` repaints.

#### Scenario: Flight Test default windows

- WHEN the Flight Test preset is applied
- THEN HUD/Navball and Minimap MAY be visible
- AND compact Flight Diagnostics MAY be visible
- AND Debug Console SHALL be hidden
- AND Weapon Computer Panel SHALL be hidden unless explicitly toggled or using Full Diagnostics

#### Scenario: Collapsed windows

- WHEN a prototype window is collapsed
- THEN it SHALL render only its lightweight header controls
- AND it SHALL NOT build heavy diagnostics, discover targets, or traverse child component hierarchies for hidden content

#### Scenario: Existing UI functions remain available

- WHEN the player uses F1, F2, F3, F4, F5, or F7
- THEN the matching prototype UI window SHALL remain toggleable
- AND no debug action or quick action present before this change SHALL be removed

### Requirement: Repaint paths avoid repeated model churn

Visible prototype windows SHOULD draw from cached or sampled state where possible instead of rebuilding view models, string blocks, or reference graphs on every repaint.

#### Scenario: HUD values remain functional

- WHEN the ship velocity, control mode, target marker, or warning state changes
- THEN the HUD SHALL update its displayed view model within the sampling window
- AND quick action buttons SHALL continue to invoke their existing actions

#### Scenario: Minimap labels stay bounded

- WHEN minimap labels are enabled
- THEN relevant label selection SHALL remain bounded and SHOULD avoid unnecessary rebuilding when labels are disabled
