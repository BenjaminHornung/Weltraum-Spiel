# Window State Persistence

## Requirements

### Requirement: Window state writes are dirty and throttled

`PrototypeUiWindowState` SHALL persist state only after the stored values actually change and SHALL avoid `PlayerPrefs` writes on unchanged repaint events.

#### Scenario: Unchanged repaint

- GIVEN a remembered window whose current rect, visibility, and collapsed values match the last persisted values
- WHEN a repaint requests persistence
- THEN no storage write SHALL occur

#### Scenario: Rect change

- GIVEN a remembered window
- WHEN its rect, width, or height changes
- THEN the window state SHALL become dirty
- AND the next allowed persistence pass SHALL write the changed rect values

#### Scenario: Visibility or collapsed change

- GIVEN a remembered window
- WHEN `Visible` or `Collapsed` changes
- THEN the window state SHALL become dirty
- AND the next allowed persistence pass SHALL write the changed flags

#### Scenario: Throttle interval

- GIVEN a dirty remembered window has just been persisted
- WHEN another state change occurs before the throttle interval expires
- THEN persistence MAY be delayed
- AND repeated repaint calls SHALL NOT write every frame

### Requirement: Persistence remains testable

Window state persistence SHALL expose a small test hook or storage abstraction so EditMode tests can count writes without depending on real `PlayerPrefs` state.

#### Scenario: Test storage

- GIVEN an in-memory test storage implementation
- WHEN window state is loaded, changed, reset, or saved
- THEN tests SHALL be able to assert the number of float/int/delete writes

### Requirement: Reset preserves existing behavior

Resetting layout SHALL restore defaults, delete persisted keys for remembered windows, clamp to the target bounds, and mark changed state for future persistence as needed.
